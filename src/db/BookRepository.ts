import { LibraryDatabase, db } from './database';
import { Book } from '../domain/types';

export class BookRepository {
  private database: LibraryDatabase;

  constructor(database: LibraryDatabase = db) {
    this.database = database;
  }

  private inLibrary(book: Book): boolean {
    const id = this.database.currentLibraryId;
    return id === null || book.libraryId === id;
  }

  async getAll(): Promise<Book[]> {
    return (await this.database.books.toArray()).filter((b) => !b.deleted && this.inLibrary(b));
  }

  /** Includes soft-deleted tombstones; used by sync. */
  async getAllIncludingDeleted(): Promise<Book[]> {
    return (await this.database.books.toArray()).filter((b) => this.inLibrary(b));
  }

  async getById(id: string): Promise<Book | undefined> {
    return await this.database.books.get(id);
  }

  async getByIsbn(isbn: string): Promise<Book | undefined> {
    const clean = isbn.trim().replace(/-/g, '');
    const books = await this.database.books.toArray();
    return books.find((b) => !b.deleted && this.inLibrary(b) && b.isbn.replace(/-/g, '') === clean);
  }

  async create(data: {
    isbn?: string;
    title: string;
    subtitle?: string;
    authors?: string[];
    illustrators?: string[];
    pageCount?: number;
    genres?: string[];
    summary?: string;
    coverUrl?: string;
    binLocation?: string;
    totalCopies?: number;
    availableCopies?: number;
  }): Promise<Book> {
    const totalCopies = Math.max(1, data.totalCopies ?? 1);
    const availableCopies = data.availableCopies !== undefined
      ? Math.min(totalCopies, Math.max(0, data.availableCopies))
      : totalCopies;

    const libraryId = this.database.currentLibraryId ?? (await this.database.ensureDefaultLibrary()).id;
    const now = Date.now();
    const book: Book = {
      id: 'book_' + now + '_' + Math.random().toString(36).substring(2, 8),
      libraryId,
      isbn: data.isbn ? data.isbn.trim().replace(/-/g, '') : '',
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || undefined,
      authors: (data.authors || []).map((a) => a.trim()).filter(Boolean),
      illustrators: (data.illustrators || []).map((i) => i.trim()).filter(Boolean),
      pageCount: Math.max(0, data.pageCount ?? 0),
      genres: (data.genres || []).map((g) => g.trim()).filter(Boolean),
      summary: data.summary?.trim() || '',
      coverUrl: data.coverUrl || '',
      binLocation: data.binLocation?.trim() || 'General',
      totalCopies,
      availableCopies,
      borrowCount: 0,
      lastBorrowedAt: null,
      deleted: false,
      createdAt: now,
      updatedAt: now
    };

    await this.database.books.add(book);
    return book;
  }

  async update(id: string, updates: Partial<Book>): Promise<Book> {
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Book with id ${id} not found`);
    }

    const updated: Book = {
      ...current,
      ...updates,
      id: current.id,
      libraryId: current.libraryId,
      updatedAt: Date.now()
    };

    if (updated.availableCopies < 0) updated.availableCopies = 0;
    if (updated.availableCopies > updated.totalCopies) updated.availableCopies = updated.totalCopies;

    await this.database.books.put(updated);
    return updated;
  }

  /** Soft delete: marks the book deleted (a tombstone) so the deletion can sync. */
  async delete(id: string): Promise<void> {
    const current = await this.getById(id);
    if (!current) return;
    await this.database.books.put({ ...current, deleted: true, updatedAt: Date.now() });
  }

  async search(query: string, genreFilter?: string): Promise<Book[]> {
    let books = await this.getAll();

    if (genreFilter && genreFilter !== 'All') {
      const lowerGenre = genreFilter.toLowerCase();
      books = books.filter((b) => b.genres.some((g) => g.toLowerCase() === lowerGenre));
    }

    if (!query || !query.trim()) {
      return books;
    }

    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      const titleMatch = b.title.toLowerCase().includes(q);
      const isbnMatch = b.isbn.toLowerCase().includes(q);
      const authorMatch = b.authors.some((a) => a.toLowerCase().includes(q));
      const illustratorMatch = b.illustrators.some((i) => i.toLowerCase().includes(q));
      const binMatch = b.binLocation.toLowerCase().includes(q);
      const genreMatch = b.genres.some((g) => g.toLowerCase().includes(q));
      return titleMatch || isbnMatch || authorMatch || illustratorMatch || binMatch || genreMatch;
    });
  }

  async incrementBorrowCount(id: string): Promise<void> {
    const book = await this.getById(id);
    if (!book) return;

    await this.update(id, {
      borrowCount: book.borrowCount + 1,
      lastBorrowedAt: Date.now()
    });
  }

  async decrementAvailableCopies(id: string): Promise<void> {
    const book = await this.getById(id);
    if (!book) return;
    if (book.deleted) throw new Error('This book has been removed from the library');

    if (book.availableCopies <= 0) {
      throw new Error(`No available copies left for ${book.title}`);
    }

    await this.update(id, {
      availableCopies: book.availableCopies - 1,
      borrowCount: book.borrowCount + 1,
      lastBorrowedAt: Date.now()
    });
  }

  async incrementAvailableCopies(id: string): Promise<void> {
    const book = await this.getById(id);
    if (!book) return;

    const newAvailable = Math.min(book.totalCopies, book.availableCopies + 1);
    await this.update(id, {
      availableCopies: newAvailable
    });
  }

  async getAllGenres(): Promise<string[]> {
    const books = await this.getAll();
    const set = new Set<string>();
    for (const b of books) {
      for (const g of b.genres) {
        if (g) set.add(g);
      }
    }
    return Array.from(set).sort();
  }

  async getAllBins(): Promise<string[]> {
    const books = await this.getAll();
    const set = new Set<string>();
    for (const b of books) {
      if (b.binLocation) set.add(b.binLocation);
    }
    return Array.from(set).sort();
  }
}
