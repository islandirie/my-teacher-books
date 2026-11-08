import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { LibraryDatabase } from '../db/database';
import { BookRepository } from '../db/BookRepository';
import { StudentRepository } from '../db/StudentRepository';
import { LoanRepository } from '../db/LoanRepository';
import { Library } from '../domain/types';
import { GoogleAuthService } from './GoogleAuthService';
import { GoogleSyncService } from './GoogleSyncService';
import { BOOKS_HEADER, LOANS_HEADER } from './GoogleSheetsService';

class FakeSheets {
  private files = new Map<string, string>();
  private tabs = new Map<string, Map<string, (string | number)[][]>>();
  private nextId = 1;

  async findSpreadsheets(_t: string, name: string) {
    const out: { id: string; name: string }[] = [];
    for (const [id, n] of this.files) if (n === name) out.push({ id, name: n });
    return out;
  }
  async createSpreadsheet(_t: string, name: string) {
    const id = 'sheet' + this.nextId++;
    this.files.set(id, name);
    this.tabs.set(id, new Map());
    return id;
  }
  async readTab(_t: string, spreadsheetId: string, tab: string) {
    const rows = this.tabs.get(spreadsheetId)?.get(tab) ?? [];
    return rows.map((r) => r.map(String));
  }
  async writeTab(_t: string, spreadsheetId: string, tab: string, rows: (string | number)[][]) {
    if (!this.tabs.has(spreadsheetId)) this.tabs.set(spreadsheetId, new Map());
    this.tabs.get(spreadsheetId)!.set(tab, rows);
  }
  headerRows() {
    return { booksHeader: BOOKS_HEADER, loansHeader: LOANS_HEADER };
  }
}

async function setupDevice(name: string, libName: string) {
  const db = new LibraryDatabase(name + '_' + Math.random().toString(36).substring(7));
  const lib: Library = { id: 'lib_' + name, name: libName, createdAt: 1 };
  await db.libraries.add(lib);
  await db.getSettings(lib.id);
  db.currentLibraryId = lib.id;
  const bookRepo = new BookRepository(db);
  const studentRepo = new StudentRepository(db);
  const loanRepo = new LoanRepository(db, bookRepo, studentRepo);
  return { db, lib, bookRepo, studentRepo, loanRepo };
}

const fakeAuth = { getAccessToken: () => 'token' } as unknown as GoogleAuthService;

describe('GoogleSyncService', () => {
  it('syncs book availability between two devices through the same sheet', async () => {
    const sheets = new FakeSheets();
    const A = await setupDevice('A', 'Room 14');
    const B = await setupDevice('B', 'Room 14');

    const book = await A.bookRepo.create({ isbn: '9780000000001', title: 'Dog Man', totalCopies: 3, availableCopies: 3 });
    const student = await A.studentRepo.create({ firstName: 'Mia K.' });
    await A.loanRepo.checkout(book.id, student.id, 7, 10);

    await new GoogleSyncService(A.db, fakeAuth, sheets as never).syncNow(A.lib);
    await new GoogleSyncService(B.db, fakeAuth, sheets as never).syncNow(B.lib);

    const booksOnB = await B.bookRepo.getAll();
    expect(booksOnB).toHaveLength(1);
    expect(booksOnB[0].availableCopies).toBe(2);
  });

  it('syncs loans so the second device shows who has the book (opt-in)', async () => {
    const sheets = new FakeSheets();
    const A = await setupDevice('A', 'Room 14');
    const B = await setupDevice('B', 'Room 14');

    await A.db.updateSettings(A.lib.id, { includeWhoCheckedOut: true });
    await B.db.updateSettings(B.lib.id, { includeWhoCheckedOut: true });

    const book = await A.bookRepo.create({ isbn: '9780000000002', title: 'Winnie the Pooh', totalCopies: 1 });
    const student = await A.studentRepo.create({ firstName: 'Leo G.' });
    await A.loanRepo.checkout(book.id, student.id, 7);

    await new GoogleSyncService(A.db, fakeAuth, sheets as never).syncNow(A.lib);
    await new GoogleSyncService(B.db, fakeAuth, sheets as never).syncNow(B.lib);

    const loansOnB = await B.loanRepo.getAllLoans();
    expect(loansOnB).toHaveLength(1);
    expect(loansOnB[0].studentName).toBe('Leo G.');
    expect(loansOnB[0].bookTitle).toBe('Winnie the Pooh');
  });
});
