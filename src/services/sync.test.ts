import { describe, it, expect } from 'vitest';
import { Book, Loan } from '../domain/types';
import { reconcileBooks, reconcileLoans } from './sync';

function makeBook(overrides: Partial<Book> & { id: string }): Book {
  return {
    libraryId: 'lib1',
    isbn: '',
    title: 'A Book',
    subtitle: undefined,
    authors: [],
    illustrators: [],
    pageCount: 0,
    genres: [],
    summary: '',
    coverUrl: '',
    binLocation: 'General',
    totalCopies: 1,
    availableCopies: 1,
    borrowCount: 0,
    lastBorrowedAt: null,
    deleted: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

function makeLoan(overrides: Partial<Loan> & { id: string }): Loan {
  return {
    libraryId: 'lib1',
    bookId: 'b1',
    bookTitle: 'A Book',
    studentId: 's1',
    studentName: 'Mia K.',
    borrowedAt: 1,
    dueDate: null,
    returnedAt: null,
    daysKept: null,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

describe('reconcileBooks', () => {
  it('keeps the newer edit across devices', () => {
    const local = [makeBook({ id: 'x', isbn: '123', title: 'Old', updatedAt: 100 })];
    const remote = [makeBook({ id: 'y', isbn: '123', title: 'New', updatedAt: 200 })];
    const { books, repoint } = reconcileBooks(local, remote);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('New');
    expect(repoint).toEqual({ x: 'y' });
  });

  it('does not resurrect a deleted book from an older device', () => {
    const local = [makeBook({ id: 'x', isbn: '123', deleted: true, updatedAt: 300 })];
    const remote = [makeBook({ id: 'x', isbn: '123', deleted: false, updatedAt: 200 })];
    const { books } = reconcileBooks(local, remote);
    expect(books).toHaveLength(1);
    expect(books[0].deleted).toBe(true);
  });

  it('merges the same ISBN and re-points local loans', () => {
    const local = [makeBook({ id: 'x', isbn: '123', updatedAt: 100 })];
    const remote = [makeBook({ id: 'y', isbn: '123', updatedAt: 200 })];
    const { books, repoint } = reconcileBooks(local, remote);
    expect(books[0].id).toBe('y');
    expect(repoint).toEqual({ x: 'y' });
  });

  it('keeps a local cover when the remote cover is blank', () => {
    const local = [makeBook({ id: 'x', isbn: '123', coverUrl: 'data:image/png;base64,AAA', updatedAt: 100 })];
    const remote = [makeBook({ id: 'x', isbn: '123', coverUrl: '', updatedAt: 200 })];
    const { books } = reconcileBooks(local, remote);
    expect(books[0].coverUrl).toBe('data:image/png;base64,AAA');
  });

  it('treats a blank remote updatedAt as newest', () => {
    const local = [makeBook({ id: 'x', isbn: '123', title: 'Local', updatedAt: 100 })];
    const remote = [makeBook({ id: 'x', isbn: '123', title: 'Hand-edited', updatedAt: 0 })];
    const { books } = reconcileBooks(local, remote);
    expect(books[0].title).toBe('Hand-edited');
  });
});

describe('reconcileLoans', () => {
  it('keeps the later edit per loan id and preserves local-only loans', () => {
    const local = [
      makeLoan({ id: 'l1', status: 'active', updatedAt: 100 }),
      makeLoan({ id: 'l2', status: 'active', updatedAt: 100 })
    ];
    const remote = [makeLoan({ id: 'l1', status: 'returned', updatedAt: 200 })];
    const merged = reconcileLoans(local, remote);
    expect(merged).toHaveLength(2);
    const l1 = merged.find((l) => l.id === 'l1')!;
    expect(l1.status).toBe('returned');
  });
});
