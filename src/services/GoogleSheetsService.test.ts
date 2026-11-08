import { describe, it, expect, vi } from 'vitest';
import {
  GoogleSheetsService,
  bookToRow,
  rowToBook,
  loanToRow,
  rowToLoan,
  spreadsheetNameForLibrary,
  SHEET_TAB_BOOKS,
  SHEET_TAB_LOANS
} from './GoogleSheetsService';
import { Book, Loan } from '../domain/types';

const book: Book = {
  id: 'b1', libraryId: 'lib1', isbn: '9780064400558', title: "Charlotte's Web", subtitle: 'A Story',
  authors: ['E.B. White', 'Garth Williams'], illustrators: ['Garth Williams'], pageCount: 192,
  genres: ['Classics', 'Animals'], summary: 'Some Pig', coverUrl: 'https://example.com/cover.jpg',
  binLocation: 'Bin 4', totalCopies: 3, availableCopies: 2, borrowCount: 1, lastBorrowedAt: 5,
  deleted: false, createdAt: 1, updatedAt: 2
};

describe('sheet format', () => {
  it('joins list fields with " | " and round-trips a book', () => {
    const row = bookToRow(book);
    expect(row[4]).toBe('E.B. White | Garth Williams');
    expect(row[7]).toBe('Classics | Animals');
    const back = rowToBook(row, 'lib1');
    expect(back.authors).toEqual(['E.B. White', 'Garth Williams']);
    expect(back.genres).toEqual(['Classics', 'Animals']);
    expect(back.deleted).toBe(false);
    expect(back.coverUrl).toBe('https://example.com/cover.jpg');
  });

  it('does not write data-URL covers', () => {
    const row = bookToRow({ ...book, coverUrl: 'data:image/png;base64,AAAA' });
    expect(row[9]).toBe('');
  });

  it('round-trips a loan with no student id in the sheet', () => {
    const loan: Loan = {
      id: 'l1', libraryId: 'lib1', bookId: 'b1', bookTitle: 'X', studentId: 's1', studentName: 'Mia K.',
      borrowedAt: 10, dueDate: null, returnedAt: 20, daysKept: null, status: 'returned', createdAt: 10, updatedAt: 20
    };
    const back = rowToLoan(loanToRow(loan), 'lib1');
    expect(back.id).toBe('l1');
    expect(back.studentId).toBe('');
    expect(back.studentName).toBe('Mia K.');
    expect(back.status).toBe('returned');
  });

  it('names the spreadsheet after the library', () => {
    expect(spreadsheetNameForLibrary('Room 14')).toBe('My Teacher Books \u2013 Room 14');
  });
});

describe('GoogleSheetsService API', () => {
  it('finds, creates, reads, and writes via the REST APIs', async () => {
    const calls: string[] = [];
    const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/drive/v3/files')) {
        return new Response(JSON.stringify({ files: [{ id: 'sheet123', name: 'X' }] }), { status: 200 });
      }
      if (url.includes('/spreadsheets/') && url.endsWith('!A:Z')) {
        return new Response(JSON.stringify({ values: [['id', 'title']] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    const svc = new GoogleSheetsService(fakeFetch);
    const found = await svc.findSpreadsheets('tok', 'My Teacher Books – Room 14');
    expect(found).toEqual([{ id: 'sheet123', name: 'X' }]);

    await svc.readTab('tok', 'sheet123', SHEET_TAB_BOOKS);
    await svc.writeTab('tok', 'sheet123', SHEET_TAB_BOOKS, [['id'], ['b1']]);

    expect(calls.some((c) => c.includes('/drive/v3/files'))).toBe(true);
    expect(calls.some((c) => c.includes(':clear'))).toBe(true);
    expect(calls.some((c) => c.startsWith('PUT') && c.includes('!A1'))).toBe(true);
  });

  it('creates the Books and Loans tabs with the spreadsheet', async () => {
    let body = '';
    const fakeFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      body = String(init?.body ?? '');
      return new Response(JSON.stringify({ spreadsheetId: 'new123' }), { status: 200 });
    }) as unknown as typeof fetch;

    const svc = new GoogleSheetsService(fakeFetch);
    expect(await svc.createSpreadsheet('tok', 'My Teacher Books – Room 14')).toBe('new123');
    const sheets = JSON.parse(body).sheets.map((s: { properties: { title: string } }) => s.properties.title);
    expect(sheets).toEqual([SHEET_TAB_BOOKS, SHEET_TAB_LOANS]);
  });
});
