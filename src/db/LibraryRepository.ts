import { LibraryDatabase, db } from './database';
import { Library, DEFAULT_LIBRARY_SETTINGS } from '../domain/types';

export class LibraryRepository {
  private database: LibraryDatabase;

  constructor(database: LibraryDatabase = db) {
    this.database = database;
  }

  async getAll(): Promise<Library[]> {
    return await this.database.libraries.orderBy('createdAt').toArray();
  }

  async getById(id: string): Promise<Library | undefined> {
    return await this.database.libraries.get(id);
  }

  async create(name: string): Promise<Library> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Library name cannot be empty');
    const lib: Library = {
      id: 'library_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      name: trimmed,
      createdAt: Date.now()
    };
    await this.database.libraries.add(lib);
    await this.database.settings.put({ ...DEFAULT_LIBRARY_SETTINGS, id: lib.id });
    return lib;
  }

  async rename(id: string, name: string): Promise<Library> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Library name cannot be empty');
    const lib = await this.getById(id);
    if (!lib) throw new Error('Library not found');
    const updated: Library = { ...lib, name: trimmed };
    await this.database.libraries.put(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.database.transaction(
      'rw',
      [this.database.libraries, this.database.books, this.database.students, this.database.loans, this.database.settings],
      async () => {
        await this.database.books.where('libraryId').equals(id).delete();
        await this.database.students.where('libraryId').equals(id).delete();
        await this.database.loans.where('libraryId').equals(id).delete();
        await this.database.settings.delete(id);
        await this.database.libraries.delete(id);
      }
    );
  }
}

export const DEFAULT_LIBRARY_ID_KEY = 'littleLibrary.activeLibraryId';
