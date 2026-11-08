import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { LibraryDatabase } from './database';

describe('database migration', () => {
  it('migrates a v1 database into a default library, preserving a custom PIN', async () => {
    const name = 'MigrateDB_' + Math.random().toString(36).substring(7);

    const v1 = new Dexie(name);
    v1.version(1).stores({
      books: 'id, isbn, title, *authors, *illustrators, *genres, binLocation, borrowCount, lastBorrowedAt',
      students: 'id, firstName, activeLoansCount, createdAt',
      loans: 'id, bookId, studentId, borrowedAt, dueDate, returnedAt, status',
      settings: 'id'
    });
    await v1.table('settings').add({
      id: 'default', className: 'Room 14', teacherPin: '4321', kioskAuthMode: 'class_pin', classPin: '1234',
      loanPeriodDays: 7, maxBooksPerStudent: 2, maxCopiesPerBook: 10, celebrationGraphic: 'rocket',
      celebrationSound: true, celebrationMessage: 'msg', googleSheetWebhookUrl: '', theme: 'dark'
    });
    await v1.table('books').add({
      id: 'b1', isbn: '9780064400558', title: "Charlotte's Web", authors: ['E.B. White'], illustrators: [],
      pageCount: 192, genres: ['Classics'], summary: '', coverUrl: '', binLocation: 'Bin 1',
      totalCopies: 2, availableCopies: 1, borrowCount: 1, lastBorrowedAt: null, createdAt: 1, updatedAt: 1
    });
    await v1.table('students').add({
      id: 's1', firstName: 'Mia K.', avatar: '🦄', color: 'purple', pin: '1234', activeLoansCount: 1, createdAt: 1
    });
    await v1.table('loans').add({
      id: 'l1', bookId: 'b1', bookTitle: "Charlotte's Web", studentId: 's1', studentName: 'Mia K.',
      borrowedAt: 1000, dueDate: null, returnedAt: null, daysKept: null, status: 'active', createdAt: 1000
    });
    v1.close();

    const db = new LibraryDatabase(name);
    const libraries = await db.libraries.toArray();
    expect(libraries.length).toBe(1);
    expect(libraries[0].name).toBe('Room 14');

    const app = await db.getAppSettings();
    expect(app.teacherPin).toBe('4321');

    const settings = await db.getSettings(libraries[0].id);
    expect(settings.classPin).toBe('1234');
    expect(settings.celebrationGraphic).toBe('rocket');

    const books = await db.books.toArray();
    expect(books[0].libraryId).toBe(libraries[0].id);
    expect(books[0].deleted).toBe(false);

    const students = await db.students.toArray();
    expect(students[0].libraryId).toBe(libraries[0].id);
    expect((students[0] as unknown as { activeLoansCount?: number }).activeLoansCount).toBeUndefined();

    const loans = await db.loans.toArray();
    expect(loans[0].libraryId).toBe(libraries[0].id);
    expect(loans[0].updatedAt).toBe(1000);
  });
});
