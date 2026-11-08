import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LibraryDatabase } from './database';
import { BookRepository } from './BookRepository';
import { StudentRepository } from './StudentRepository';
import { LoanRepository } from './LoanRepository';

describe('LoanRepository', () => {
  let db: LibraryDatabase;
  let bookRepo: BookRepository;
  let studentRepo: StudentRepository;
  let loanRepo: LoanRepository;

  beforeEach(() => {
    db = new LibraryDatabase('TestLoanDB_' + Math.random().toString(36).substring(7));
    bookRepo = new BookRepository(db);
    studentRepo = new StudentRepository(db);
    loanRepo = new LoanRepository(db, bookRepo, studentRepo);
  });

  it('checks out a book, decrements copies, and counts the active loan', async () => {
    const book = await bookRepo.create({ title: 'Winnie the Pooh', totalCopies: 2, availableCopies: 2 });
    const student = await studentRepo.create({ firstName: 'Leo G.' });

    const loan = await loanRepo.checkout(book.id, student.id, 7, 2);
    expect(loan.id).toBeDefined();
    expect(loan.status).toBe('active');
    expect(loan.bookTitle).toBe('Winnie the Pooh');
    expect(loan.studentName).toBe('Leo G.');

    const updatedBook = await bookRepo.getById(book.id);
    expect(updatedBook?.availableCopies).toBe(1);

    expect(await loanRepo.countActiveLoansForStudent(student)).toBe(1);
  });

  it('enforces maximum book limit per student using the computed count', async () => {
    const book1 = await bookRepo.create({ title: 'Book 1', totalCopies: 1 });
    const book2 = await bookRepo.create({ title: 'Book 2', totalCopies: 1 });

    const student = await studentRepo.create({ firstName: 'Sam T.' });

    await loanRepo.checkout(book1.id, student.id, 7, 1);
    await expect(loanRepo.checkout(book2.id, student.id, 7, 1)).rejects.toThrow(/limit/);
  });

  it('returns a loan idempotently and restores available copies', async () => {
    const book = await bookRepo.create({ title: 'Curious George', totalCopies: 1 });
    const student = await studentRepo.create({ firstName: 'Emma S.' });

    const loan = await loanRepo.checkout(book.id, student.id, 7);
    let currentBook = await bookRepo.getById(book.id);
    expect(currentBook?.availableCopies).toBe(0);

    const returned = await loanRepo.returnLoan(loan.id);
    expect(returned.status).toBe('returned');
    expect(returned.returnedAt).toBeDefined();
    expect(returned.updatedAt).toBeDefined();

    currentBook = await bookRepo.getById(book.id);
    expect(currentBook?.availableCopies).toBe(1);

    expect(await loanRepo.countActiveLoansForStudent(student)).toBe(0);

    await loanRepo.returnLoan(loan.id);
    currentBook = await bookRepo.getById(book.id);
    expect(currentBook?.availableCopies).toBe(1);
  });

  it('counts a synced loan with an unknown studentId toward the student with the same name', async () => {
    const student = await studentRepo.create({ firstName: 'Mia K.' });
    const book = await bookRepo.create({ title: 'Synced Book', totalCopies: 1 });

    // A loan that arrived from another device: unknown studentId, matching display name.
    await db.loans.add({
      id: 'loan_synced', libraryId: book.libraryId, bookId: book.id, bookTitle: 'Synced Book',
      studentId: 'unknown_device_id', studentName: 'Mia K.', borrowedAt: 1, dueDate: null,
      returnedAt: null, daysKept: null, status: 'active', createdAt: 1, updatedAt: 1
    });

    expect(await loanRepo.countActiveLoansForStudent(student)).toBe(1);
    expect((await loanRepo.getActiveLoanCounts())[student.id]).toBe(1);
  });
});
