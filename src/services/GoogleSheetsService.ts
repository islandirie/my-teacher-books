import { Book, Loan, LoanStatus } from '../domain/types';

export const BOOKS_HEADER = [
  'id', 'isbn', 'title', 'subtitle', 'authors', 'illustrators', 'pageCount', 'genres',
  'summary', 'coverUrl', 'binLocation', 'totalCopies', 'availableCopies', 'borrowCount',
  'lastBorrowedAt', 'createdAt', 'updatedAt', 'deleted'
];

export const LOANS_HEADER = [
  'id', 'bookId', 'bookTitle', 'studentName', 'borrowedAt', 'dueDate', 'returnedAt', 'status', 'updatedAt'
];

export const SHEET_TAB_BOOKS = 'Books';
export const SHEET_TAB_LOANS = 'Loans';

const LIST_SEPARATOR = ' | ';

function joinList(items: string[]): string {
  return items.join(LIST_SEPARATOR);
}

function splitList(value: string): string[] {
  return value
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function numberOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isHttpCover(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function spreadsheetNameForLibrary(libraryName: string): string {
  return `My Teacher Books \u2013 ${libraryName}`;
}

export function bookToRow(book: Book): (string | number)[] {
  return [
    book.id,
    book.isbn,
    book.title,
    book.subtitle ?? '',
    joinList(book.authors),
    joinList(book.illustrators),
    book.pageCount,
    joinList(book.genres),
    book.summary,
    isHttpCover(book.coverUrl) ? book.coverUrl : '',
    book.binLocation,
    book.totalCopies,
    book.availableCopies,
    book.borrowCount,
    book.lastBorrowedAt ?? '',
    book.createdAt,
    book.updatedAt,
    book.deleted ? 'TRUE' : 'FALSE'
  ];
}

export function rowToBook(row: (string | number)[], libraryId: string): Book {
  const cell = (i: number): string => (row[i] === undefined ? '' : String(row[i]));
  return {
    id: cell(0),
    libraryId,
    isbn: cell(1),
    title: cell(2),
    subtitle: cell(3) || undefined,
    authors: splitList(cell(4)),
    illustrators: splitList(cell(5)),
    pageCount: numberOr(cell(6), 0),
    genres: splitList(cell(7)),
    summary: cell(8),
    coverUrl: cell(9),
    binLocation: cell(10) || 'General',
    totalCopies: numberOr(cell(11), 1),
    availableCopies: numberOr(cell(12), 0),
    borrowCount: numberOr(cell(13), 0),
    lastBorrowedAt: cell(14) ? numberOr(cell(14), 0) : null,
    createdAt: numberOr(cell(15), Date.now()),
    updatedAt: numberOr(cell(16), 0),
    deleted: cell(17).toUpperCase() === 'TRUE'
  };
}

export function loanToRow(loan: Loan): (string | number)[] {
  return [
    loan.id,
    loan.bookId,
    loan.bookTitle,
    loan.studentName,
    loan.borrowedAt,
    loan.dueDate ?? '',
    loan.returnedAt ?? '',
    loan.status,
    loan.updatedAt
  ];
}

export function rowToLoan(row: (string | number)[], libraryId: string): Loan {
  const cell = (i: number): string => (row[i] === undefined ? '' : String(row[i]));
  return {
    id: cell(0),
    libraryId,
    bookId: cell(1),
    bookTitle: cell(2),
    studentName: cell(3),
    // The Loans tab carries only the display name, never the roster id.
    studentId: '',
    borrowedAt: numberOr(cell(4), Date.now()),
    dueDate: cell(5) ? numberOr(cell(5), 0) : null,
    returnedAt: cell(6) ? numberOr(cell(6), 0) : null,
    daysKept: null,
    status: (cell(7) || 'active') as LoanStatus,
    createdAt: numberOr(cell(4), Date.now()),
    updatedAt: numberOr(cell(8), 0)
  };
}

export interface SpreadsheetResolution {
  spreadsheetId: string | null;
  candidates: { id: string; name: string }[];
}

/**
 * Stateless Google Sheets + Drive client. All methods take the access token so
 * the class is easy to fake in tests (inject a fetch double).
 */
export class GoogleSheetsService {
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  private async request(url: string, accessToken: string, init?: RequestInit): Promise<unknown> {
    const res = await this.fetchFn(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {})
      }
    });
    if (!res.ok) {
      throw new Error(`Google API responded with HTTP ${res.status}`);
    }
    return await res.json();
  }

  async findSpreadsheets(accessToken: string, name: string): Promise<{ id: string; name: string }[]> {
    const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const data = (await this.request(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      accessToken
    )) as { files?: { id: string; name: string }[] };
    return data.files ?? [];
  }

  async createSpreadsheet(accessToken: string, name: string): Promise<string> {
    const data = (await this.request('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: name },
        sheets: [
          { properties: { title: SHEET_TAB_BOOKS } },
          { properties: { title: SHEET_TAB_LOANS } }
        ]
      })
    })) as { spreadsheetId: string };
    return data.spreadsheetId;
  }

  async readTab(accessToken: string, spreadsheetId: string, tab: string): Promise<string[][]> {
    const data = (await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}!A:Z`,
      accessToken
    )) as { values?: string[][] };
    return data.values ?? [];
  }

  async writeTab(accessToken: string, spreadsheetId: string, tab: string, rows: (string | number)[][]): Promise<void> {
    // Clear the whole tab, then write the full snapshot from A1.
    await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}:clear`,
      accessToken,
      { method: 'POST', body: JSON.stringify({}) }
    );
    if (rows.length === 0) return;
    await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}!A1?valueInputOption=USER_ENTERED`,
      accessToken,
      { method: 'PUT', body: JSON.stringify({ range: `${tab}!A1`, majorDimension: 'ROWS', values: rows }) }
    );
  }

  headerRows() {
    return { booksHeader: BOOKS_HEADER, loansHeader: LOANS_HEADER };
  }
}
