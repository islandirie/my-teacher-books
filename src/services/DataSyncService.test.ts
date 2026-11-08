import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { LibraryDatabase } from '../db/database';
import { BookRepository } from '../db/BookRepository';
import { StudentRepository } from '../db/StudentRepository';
import { LoanRepository } from '../db/LoanRepository';
import { DataSyncService } from './DataSyncService';

describe('DataSyncService', () => {
  let db: LibraryDatabase;
  let bookRepo: BookRepository;
  let studentRepo: StudentRepository;
  let loanRepo: LoanRepository;
  let service: DataSyncService;

  beforeEach(() => {
    db = new LibraryDatabase('TestSyncDB_' + Math.random().toString(36).substring(7));
    bookRepo = new BookRepository(db);
    studentRepo = new StudentRepository(db);
    loanRepo = new LoanRepository(db, bookRepo, studentRepo);
    service = new DataSyncService(db);
  });

  it('exports books to CSV and parses them back accurately', async () => {
    const book = await bookRepo.create({
      isbn: '9780064400558',
      title: "Charlotte's Web",
      authors: ['E.B. White'],
      illustrators: ['Garth Williams'],
      pageCount: 192,
      genres: ['Classics', 'Animals'],
      binLocation: 'Bin 4',
      totalCopies: 3
    });

    const csvOutput = service.exportBooksToCsv([book]);
    expect(csvOutput).toContain("Charlotte's Web");
    expect(csvOutput).toContain('Garth Williams');
    expect(csvOutput).toContain('E.B. White');

    const parsed = service.parseBooksFromCsv(csvOutput);
    expect(parsed.length).toBe(1);
    expect(parsed[0].title).toBe("Charlotte's Web");
    expect(parsed[0].authors).toContain('E.B. White');
    expect(parsed[0].illustrators).toContain('Garth Williams');
    expect(parsed[0].totalCopies).toBe(3);
  });

  it('exports and restores a complete atomic JSON database snapshot', async () => {
    const book = await bookRepo.create({ title: 'Frog and Toad', totalCopies: 2 });
    const student = await studentRepo.create({ firstName: 'Alex M.' });
    await loanRepo.checkout(book.id, student.id, 7);

    const jsonBackup = await service.exportFullJsonBackup();
    expect(jsonBackup).toContain('Frog and Toad');
    expect(jsonBackup).toContain('Alex M.');

    // Clear database by instantiating new empty db
    const freshDb = new LibraryDatabase('TestSyncDB_Fresh_' + Math.random().toString(36).substring(7));
    const freshService = new DataSyncService(freshDb);

    const stats = await freshService.restoreFullJsonBackup(jsonBackup);
    expect(stats.booksCount).toBe(1);
    expect(stats.studentsCount).toBe(1);
    expect(stats.loansCount).toBe(1);

    const restoredBooks = await freshDb.books.toArray();
    expect(restoredBooks[0].title).toBe('Frog and Toad');
  });

  it('restores a v1 backup into a default library with a surviving PIN', async () => {
    const legacy = {
      version: 1,
      books: [{
        id: 'b1', isbn: '9780000000001', title: 'Old Book', authors: ['A'], illustrators: [], pageCount: 10,
        genres: ['G'], summary: '', coverUrl: '', binLocation: 'Bin 1', totalCopies: 1, availableCopies: 1,
        borrowCount: 0, lastBorrowedAt: null, createdAt: 1, updatedAt: 1
      }],
      students: [{ id: 's1', firstName: 'Mia K.', avatar: '🦄', color: 'purple', pin: '1234', activeLoansCount: 1, createdAt: 1 }],
      loans: [{ id: 'l1', bookId: 'b1', bookTitle: 'Old Book', studentId: 's1', studentName: 'Mia K.', borrowedAt: 1, dueDate: null, returnedAt: null, daysKept: null, status: 'active', createdAt: 1 }],
      settings: { id: 'default', className: 'My Old Class', teacherPin: '9999', kioskAuthMode: 'class_pin', classPin: '1234', loanPeriodDays: 7, maxBooksPerStudent: 2, maxCopiesPerBook: 10, celebrationGraphic: 'rocket', celebrationSound: true, celebrationMessage: 'm', googleSheetWebhookUrl: '', theme: 'dark' }
    };

    const freshDb = new LibraryDatabase('TestSyncDB_v1_' + Math.random().toString(36).substring(7));
    const freshService = new DataSyncService(freshDb);
    const stats = await freshService.restoreFullJsonBackup(JSON.stringify(legacy));
    expect(stats.booksCount).toBe(1);

    const libs = await freshDb.libraries.toArray();
    expect(libs[0].name).toBe('My Old Class');
    expect((await freshDb.getAppSettings()).teacherPin).toBe('9999');
    expect((await freshDb.books.toArray())[0].libraryId).toBe(libs[0].id);
  });

  it('sends student names in the webhook only when the opt-in setting is on', async () => {
    const loan = {
      id: 'l1', bookId: 'b1', bookTitle: 'X', studentName: 'Mia K.', borrowedAt: 1,
      status: 'active'
    };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''));
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const bodies: string[] = [];
    try {
      await service.syncToGoogleSheetsWebhook('https://script.google.com/macros/s/x/exec', [], [loan] as never, false);
      const offBody = JSON.parse(bodies[0]);
      expect(offBody.loans[0].studentName).toBeUndefined();

      await service.syncToGoogleSheetsWebhook('https://script.google.com/macros/s/x/exec', [], [loan] as never, true);
      const onBody = JSON.parse(bodies[1]);
      expect(onBody.loans[0].studentName).toBe('Mia K.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
