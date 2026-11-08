import { LibraryDatabase, db } from '../db/database';
import { Book, Library, Loan } from '../domain/types';
import { GoogleAuthService } from './GoogleAuthService';
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
import { reconcileBooks, reconcileLoans } from './sync';

export interface SyncSummary {
  spreadsheetId: string;
  booksCount: number;
  loansCount: number;
}

function rowsToBooks(rows: string[][], libraryId: string): Book[] {
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== '' && c !== undefined))
    .map((r) => rowToBook(r, libraryId));
}

function rowsToLoans(rows: string[][], libraryId: string): Loan[] {
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== '' && c !== undefined))
    .map((r) => rowToLoan(r, libraryId));
}

export class GoogleSyncService {
  constructor(
    private database: LibraryDatabase,
    private auth: GoogleAuthService,
    private sheets: GoogleSheetsService
  ) {}

  async syncNow(library: Library): Promise<SyncSummary> {
    const token = this.auth.getAccessToken();
    if (!token) throw new Error('NOT_SIGNED_IN');

    const name = spreadsheetNameForLibrary(library.name);
    let spreadsheetId = library.spreadsheetId;

    if (!spreadsheetId) {
      const found = await this.sheets.findSpreadsheets(token, name);
      if (found.length > 1) {
        throw new Error('MULTIPLE_SHEETS:' + JSON.stringify(found));
      }
      spreadsheetId = found.length === 1 ? found[0].id : await this.sheets.createSpreadsheet(token, name);
      await this.database.libraries.put({ ...library, spreadsheetId });
    }

    const localBooks = (await this.database.books.toArray()).filter((b) => b.libraryId === library.id);
    const remoteRows = await this.sheets.readTab(token, spreadsheetId, SHEET_TAB_BOOKS);
    const { books, repoint } = reconcileBooks(localBooks, rowsToBooks(remoteRows, library.id));

    await this.database.transaction('rw', [this.database.books, this.database.loans], async () => {
      for (const [oldId, newId] of Object.entries(repoint)) {
        await this.database.loans.where('bookId').equals(oldId).modify((l) => {
          l.bookId = newId;
        });
      }
      for (const b of books) await this.database.books.put(b);
    });

    const booksHeader = this.sheets.headerRows().booksHeader;
    await this.sheets.writeTab(
      token,
      spreadsheetId,
      SHEET_TAB_BOOKS,
      [booksHeader, ...books.map((b) => bookToRow(b))]
    );

    let loansCount = 0;
    const settings = await this.database.getSettings(library.id);
    if (settings.includeWhoCheckedOut) {
      const localLoans = (await this.database.loans.toArray()).filter((l) => l.libraryId === library.id);
      const remoteLoanRows = await this.sheets.readTab(token, spreadsheetId, SHEET_TAB_LOANS);
      const mergedLoans = reconcileLoans(localLoans, rowsToLoans(remoteLoanRows, library.id));

      await this.database.transaction('rw', [this.database.loans], async () => {
        for (const l of mergedLoans) await this.database.loans.put(l);
      });

      const loansHeader = this.sheets.headerRows().loansHeader;
      await this.sheets.writeTab(
        token,
        spreadsheetId,
        SHEET_TAB_LOANS,
        [loansHeader, ...mergedLoans.map((l) => loanToRow(l))]
      );
      loansCount = mergedLoans.length;
    }

    return { spreadsheetId, booksCount: books.length, loansCount };
  }
}

export const googleSyncService = new GoogleSyncService(db, new GoogleAuthService(async () => {
  throw new Error('NOT_SIGNED_IN');
}), new GoogleSheetsService());
