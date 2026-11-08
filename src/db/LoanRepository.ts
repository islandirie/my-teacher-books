import { LibraryDatabase, db } from './database';
import { BookRepository } from './BookRepository';
import { StudentRepository } from './StudentRepository';
import { Loan, Student } from '../domain/types';

export class LoanRepository {
  private database: LibraryDatabase;
  private bookRepo: BookRepository;
  private studentRepo: StudentRepository;

  constructor(
    database: LibraryDatabase = db,
    bookRepo?: BookRepository,
    studentRepo?: StudentRepository
  ) {
    this.database = database;
    this.bookRepo = bookRepo || new BookRepository(database);
    this.studentRepo = studentRepo || new StudentRepository(database);
  }

  private inLibrary(loan: Loan): boolean {
    const id = this.database.currentLibraryId;
    return id === null || loan.libraryId === id;
  }

  async getAllLoans(): Promise<Loan[]> {
    return (await this.database.loans.orderBy('borrowedAt').reverse().toArray()).filter((l) => this.inLibrary(l));
  }

  async getActiveLoans(): Promise<Loan[]> {
    const loans = await this.database.loans.where('status').equals('active').toArray();
    const now = Date.now();
    return loans
      .filter((l) => this.inLibrary(l))
      .map((loan) => {
        if (loan.dueDate && loan.dueDate < now) {
          return { ...loan, status: 'overdue' as const };
        }
        return loan;
      });
  }

  async getLoanById(id: string): Promise<Loan | undefined> {
    return await this.database.loans.get(id);
  }

  async findActiveLoansByBook(bookId: string): Promise<Loan[]> {
    return (await this.database.loans.where('bookId').equals(bookId).toArray()).filter(
      (loan) => this.inLibrary(loan) && (loan.status === 'active' || loan.status === 'overdue')
    );
  }

  async findActiveLoansByStudent(studentId: string): Promise<Loan[]> {
    return (await this.database.loans.where('studentId').equals(studentId).toArray()).filter(
      (loan) => this.inLibrary(loan) && (loan.status === 'active' || loan.status === 'overdue')
    );
  }

  /**
   * Active loan count per local student id. Synced loans whose `studentId` is not in
   * the local roster count toward the local student with the same display name.
   */
  async getActiveLoanCounts(): Promise<Record<string, number>> {
    const students = await this.studentRepo.getAll();
    const rosterIds = new Set(students.map((s) => s.id));
    const active = await this.getActiveLoans();
    const counts: Record<string, number> = {};
    for (const s of students) counts[s.id] = 0;
    for (const loan of active) {
      if (rosterIds.has(loan.studentId)) {
        counts[loan.studentId] = (counts[loan.studentId] ?? 0) + 1;
      } else {
        const match = students.find((s) => s.firstName === loan.studentName);
        if (match) counts[match.id] = (counts[match.id] ?? 0) + 1;
      }
    }
    return counts;
  }

  async countActiveLoansForStudent(student: Student): Promise<number> {
    const counts = await this.getActiveLoanCounts();
    return counts[student.id] ?? 0;
  }

  async checkout(
    bookId: string,
    studentId: string,
    loanPeriodDays = 7,
    maxBooksAllowed = 0
  ): Promise<Loan> {
    const book = await this.bookRepo.getById(bookId);
    if (!book) {
      throw new Error('Book not found');
    }
    if (book.deleted) {
      throw new Error('This book has been removed from the library');
    }
    if (book.availableCopies <= 0) {
      throw new Error(`All copies of "${book.title}" are currently checked out`);
    }

    const student = await this.studentRepo.getById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    if (maxBooksAllowed > 0) {
      const activeCount = await this.countActiveLoansForStudent(student);
      if (activeCount >= maxBooksAllowed) {
        throw new Error(
          `${student.firstName} has reached the maximum checkout limit of ${maxBooksAllowed} book(s)`
        );
      }
    }

    const now = Date.now();
    const dueDate = loanPeriodDays > 0 ? now + loanPeriodDays * 24 * 60 * 60 * 1000 : null;

    const loan: Loan = {
      id: 'loan_' + now + '_' + Math.random().toString(36).substring(2, 8),
      libraryId: book.libraryId,
      bookId: book.id,
      bookTitle: book.title,
      studentId: student.id,
      studentName: student.firstName,
      borrowedAt: now,
      dueDate,
      returnedAt: null,
      daysKept: null,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    await this.database.transaction('rw', [this.database.books, this.database.loans], async () => {
      await this.database.loans.add(loan);
      await this.bookRepo.decrementAvailableCopies(book.id);
    });

    return loan;
  }

  async returnLoan(loanId: string): Promise<Loan> {
    const loan = await this.getLoanById(loanId);
    if (!loan) {
      throw new Error('Loan record not found');
    }

    if (loan.status === 'returned') {
      return loan;
    }

    const now = Date.now();
    const daysKept = Math.max(0, Math.round((now - loan.borrowedAt) / (24 * 60 * 60 * 1000)));

    const updatedLoan: Loan = {
      ...loan,
      status: 'returned',
      returnedAt: now,
      daysKept,
      updatedAt: now
    };

    await this.database.transaction('rw', [this.database.books, this.database.loans], async () => {
      await this.database.loans.put(updatedLoan);
      await this.bookRepo.incrementAvailableCopies(loan.bookId);
    });

    return updatedLoan;
  }

  async returnByBookAndStudent(bookId: string, studentId: string): Promise<Loan> {
    const active = await this.database.loans
      .where('bookId')
      .equals(bookId)
      .and((l) => l.studentId === studentId && (l.status === 'active' || l.status === 'overdue'))
      .first();

    if (!active) {
      throw new Error('No active loan found for this book and student');
    }

    return await this.returnLoan(active.id);
  }
}
