export interface Library {
  id: string;
  name: string;
  spreadsheetId?: string;
  createdAt: number;
}

export interface Book {
  id: string;
  libraryId: string;
  isbn: string;
  title: string;
  subtitle?: string;
  authors: string[];
  illustrators: string[];
  pageCount: number;
  genres: string[];
  summary: string;
  coverUrl: string;
  binLocation: string;
  totalCopies: number;
  availableCopies: number;
  borrowCount: number;
  lastBorrowedAt: number | null;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Student {
  id: string;
  libraryId: string;
  firstName: string;
  avatar: string;
  color: string;
  pin?: string;
  createdAt: number;
}

export type LoanStatus = 'active' | 'returned' | 'overdue';

export interface Loan {
  id: string;
  libraryId: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  borrowedAt: number;
  dueDate: number | null;
  returnedAt: number | null;
  daysKept: number | null;
  status: LoanStatus;
  createdAt: number;
  updatedAt: number;
}

export type KioskAuthMode = 'class_pin' | 'student_pin' | 'open';
export type CelebrationGraphic = 'rocket' | 'dinosaur' | 'star' | 'bookworm' | 'unicorn';
export type AppTheme = 'light' | 'dark';

/** One PIN for the whole app, independent of any library. */
export interface AppSettings {
  id: 'app';
  teacherPin: string;
}

/** Per-library settings, keyed by the library's id. */
export interface ClassSettings {
  id: string;
  kioskAuthMode: KioskAuthMode;
  classPin: string;
  loanPeriodDays: number;
  maxBooksPerStudent: number;
  maxCopiesPerBook: number;
  celebrationGraphic: CelebrationGraphic;
  celebrationSound: boolean;
  celebrationMessage: string;
  googleSheetWebhookUrl: string;
  includeWhoCheckedOut: boolean;
  theme: AppTheme;
}

export const DEFAULT_LIBRARY_NAME = 'Library 1';

export const DEFAULT_LIBRARY_SETTINGS: Omit<ClassSettings, 'id'> = {
  kioskAuthMode: 'class_pin',
  classPin: '1234',
  loanPeriodDays: 7,
  maxBooksPerStudent: 2,
  maxCopiesPerBook: 10,
  celebrationGraphic: 'rocket',
  celebrationSound: true,
  celebrationMessage: 'Great choice, {student}! Enjoy reading {title}!',
  googleSheetWebhookUrl: '',
  includeWhoCheckedOut: false,
  theme: 'dark'
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app',
  teacherPin: '1234'
};
