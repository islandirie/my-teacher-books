import Papa from 'papaparse';
import { Book, Loan, Student, ClassSettings, Library, AppSettings, DEFAULT_APP_SETTINGS, DEFAULT_LIBRARY_SETTINGS, DEFAULT_LIBRARY_NAME } from '../domain/types';
import { LibraryDatabase, db } from '../db/database';

export interface DatabaseBackup {
  version: 2;
  exportedAt: number;
  libraries: Library[];
  appSettings: AppSettings;
  settings: ClassSettings[];
  books: Book[];
  students: Student[];
  loans: Loan[];
}

interface LegacyBackup {
  version: 1;
  books: (Book & { libraryId?: string; deleted?: boolean })[];
  students: (Student & { libraryId?: string; activeLoansCount?: number })[];
  loans: (Loan & { libraryId?: string; updatedAt?: number })[];
  settings: (ClassSettings & { className?: string; teacherPin?: string });
}

export class DataSyncService {
  private database: LibraryDatabase;

  constructor(database: LibraryDatabase = db) {
    this.database = database;
  }

  // --- CSV Export & Import ---

  exportBooksToCsv(books: Book[]): string {
    const rows = books.map((b) => ({
      ISBN: b.isbn || '',
      Title: b.title,
      Subtitle: b.subtitle || '',
      Authors: b.authors.join('; '),
      Illustrators: b.illustrators.join('; '),
      PageCount: b.pageCount,
      Genres: b.genres.join('; '),
      Summary: b.summary,
      BinLocation: b.binLocation,
      TotalCopies: b.totalCopies,
      AvailableCopies: b.availableCopies,
      BorrowCount: b.borrowCount,
      CoverUrl: b.coverUrl || ''
    }));

    return Papa.unparse(rows);
  }

  exportLoansToCsv(loans: Loan[]): string {
    const rows = loans.map((l) => ({
      LoanID: l.id,
      BookTitle: l.bookTitle,
      StudentName: l.studentName,
      BorrowedDate: new Date(l.borrowedAt).toISOString(),
      DueDate: l.dueDate ? new Date(l.dueDate).toISOString() : '',
      ReturnedDate: l.returnedAt ? new Date(l.returnedAt).toISOString() : '',
      DaysKept: l.daysKept ?? '',
      Status: l.status
    }));

    return Papa.unparse(rows);
  }

  parseBooksFromCsv(csvText: string): Array<{
    isbn?: string;
    title: string;
    subtitle?: string;
    authors?: string[];
    illustrators?: string[];
    pageCount?: number;
    genres?: string[];
    summary?: string;
    binLocation?: string;
    totalCopies?: number;
    availableCopies?: number;
    coverUrl?: string;
  }> {
    const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
      header: true,
      skipEmptyLines: true
    });

    const results: Array<{
      isbn?: string;
      title: string;
      subtitle?: string;
      authors?: string[];
      illustrators?: string[];
      pageCount?: number;
      genres?: string[];
      summary?: string;
      binLocation?: string;
      totalCopies?: number;
      availableCopies?: number;
      coverUrl?: string;
    }> = [];

    for (const row of parsed.data) {
      const title = row['Title'] || row['title'] || '';
      if (!title.trim()) continue;

      const authorsRaw = row['Authors'] || row['authors'] || row['Author'] || '';
      const authors = authorsRaw.split(/[;,]/).map((a) => a.trim()).filter(Boolean);

      const illustratorsRaw = row['Illustrators'] || row['illustrators'] || '';
      const illustrators = illustratorsRaw.split(/[;,]/).map((i) => i.trim()).filter(Boolean);

      const genresRaw = row['Genres'] || row['genres'] || row['Genre'] || '';
      const genres = genresRaw.split(/[;,]/).map((g) => g.trim()).filter(Boolean);

      const totalCopies = parseInt(row['TotalCopies'] || row['totalCopies'] || '1', 10) || 1;
      const availableCopies = parseInt(row['AvailableCopies'] || row['availableCopies'] || String(totalCopies), 10);

      results.push({
        isbn: (row['ISBN'] || row['isbn'] || '').replace(/-/g, '').trim(),
        title: title.trim(),
        subtitle: (row['Subtitle'] || row['subtitle'] || '').trim() || undefined,
        authors: authors.length > 0 ? authors : ['Unknown Author'],
        illustrators,
        pageCount: parseInt(row['PageCount'] || row['pageCount'] || '0', 10) || 0,
        genres: genres.length > 0 ? genres : ['General'],
        summary: (row['Summary'] || row['summary'] || '').trim(),
        binLocation: (row['BinLocation'] || row['binLocation'] || 'General').trim(),
        totalCopies,
        availableCopies: isNaN(availableCopies) ? totalCopies : availableCopies,
        coverUrl: (row['CoverUrl'] || row['coverUrl'] || '').trim()
      });
    }

    return results;
  }

  // --- JSON Backup & Restore ---

  async exportFullJsonBackup(): Promise<string> {
    const [books, students, loans, libraries, settings, appSettings] = await Promise.all([
      this.database.books.toArray(),
      this.database.students.toArray(),
      this.database.loans.toArray(),
      this.database.libraries.toArray(),
      this.database.settings.toArray(),
      this.database.getAppSettings()
    ]);

    const backup: DatabaseBackup = {
      version: 2,
      exportedAt: Date.now(),
      libraries,
      appSettings,
      settings,
      books,
      students,
      loans
    };

    return JSON.stringify(backup, null, 2);
  }

  async restoreFullJsonBackup(jsonText: string): Promise<{
    booksCount: number;
    studentsCount: number;
    loansCount: number;
  }> {
    const data = JSON.parse(jsonText) as DatabaseBackup | LegacyBackup;
    if (!data || !Array.isArray(data.books)) {
      throw new Error('Invalid backup file format');
    }

    const isV2 = data.version === 2 && Array.isArray((data as DatabaseBackup).libraries);
    const legacy = data as LegacyBackup;

    await this.database.transaction(
      'rw',
      [
        this.database.books,
        this.database.students,
        this.database.loans,
        this.database.libraries,
        this.database.settings,
        this.database.appSettings
      ],
      async () => {
        await this.database.books.clear();
        await this.database.students.clear();
        await this.database.loans.clear();
        await this.database.libraries.clear();
        await this.database.settings.clear();
        await this.database.appSettings.clear();

        let fallbackLibId = '';

        if (isV2) {
          const v2 = data as DatabaseBackup;
          if (v2.libraries.length > 0) {
            await this.database.libraries.bulkAdd(v2.libraries);
            fallbackLibId = v2.libraries[0].id;
          }
          await this.database.appSettings.put(v2.appSettings ?? { ...DEFAULT_APP_SETTINGS });
          if (v2.settings && v2.settings.length > 0) await this.database.settings.bulkAdd(v2.settings);
        } else {
          // v1 backup: fold into "Library 1" and split the teacher PIN into app settings.
          const libId = 'library_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
          const name = legacy.settings?.className?.trim() || DEFAULT_LIBRARY_NAME;
          await this.database.libraries.add({ id: libId, name, createdAt: Date.now() });
          await this.database.appSettings.put({
            id: 'app',
            teacherPin: legacy.settings?.teacherPin?.trim() || DEFAULT_APP_SETTINGS.teacherPin
          });
          const { className: _c, teacherPin: _t, id: _id, ...rest } = (legacy.settings || {}) as unknown as Record<string, unknown>;
          await this.database.settings.put({ ...DEFAULT_LIBRARY_SETTINGS, ...rest, id: libId });
          fallbackLibId = libId;
        }

        const books = data.books.map((b) => ({
          ...b,
          libraryId: b.libraryId || fallbackLibId,
          deleted: b.deleted ?? false
        }));
        const students = data.students.map((s) => {
          const { activeLoansCount: _ac, ...rest } = s as Student & { activeLoansCount?: number };
          return { ...rest, libraryId: rest.libraryId || fallbackLibId };
        });
        const loans = data.loans.map((l) => ({
          ...l,
          libraryId: l.libraryId || fallbackLibId,
          updatedAt: l.updatedAt ?? l.returnedAt ?? l.borrowedAt ?? Date.now()
        }));

        if (books.length > 0) await this.database.books.bulkAdd(books);
        if (students.length > 0) await this.database.students.bulkAdd(students);
        if (loans.length > 0) await this.database.loans.bulkAdd(loans);
      }
    );

    return {
      booksCount: data.books.length,
      studentsCount: data.students.length,
      loansCount: data.loans.length
    };
  }

  // --- Google Sheets Webhook Sync (one-way, no sign-in) ---

  async syncToGoogleSheetsWebhook(
    webhookUrl: string,
    books: Book[],
    loans: Loan[],
    includeStudentNames: boolean
  ): Promise<{ success: boolean; message: string }> {
    if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com')) {
      throw new Error('Invalid Google Apps Script Webhook URL');
    }

    const payload = {
      action: 'sync',
      timestamp: Date.now(),
      books: books.map((b) => ({
        isbn: b.isbn,
        title: b.title,
        authors: b.authors.join(', '),
        illustrators: b.illustrators.join(', '),
        genres: b.genres.join(', '),
        bin: b.binLocation,
        totalCopies: b.totalCopies,
        availableCopies: b.availableCopies,
        borrowCount: b.borrowCount
      })),
      loans: loans.map((l) => {
        const row: Record<string, unknown> = {
          id: l.id,
          bookTitle: l.bookTitle,
          borrowedAt: new Date(l.borrowedAt).toLocaleDateString(),
          status: l.status
        };
        if (includeStudentNames) row.studentName = l.studentName;
        return row;
      })
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Google Sheets responded with HTTP ${res.status}`);
    }

    return { success: true, message: 'Successfully synced with Google Sheet!' };
  }

  // Browser download trigger helper
  downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const dataSyncService = new DataSyncService();
