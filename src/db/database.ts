import Dexie, { type Table } from 'dexie';
import {
  Book,
  Student,
  Loan,
  ClassSettings,
  Library,
  AppSettings,
  DEFAULT_LIBRARY_SETTINGS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_LIBRARY_NAME
} from '../domain/types';

export class LibraryDatabase extends Dexie {
  books!: Table<Book, string>;
  students!: Table<Student, string>;
  loans!: Table<Loan, string>;
  libraries!: Table<Library, string>;
  settings!: Table<ClassSettings, string>;
  appSettings!: Table<AppSettings, string>;

  /** The library currently active for this device. Set by the app before any repository is used. */
  currentLibraryId: string | null = null;

  constructor(dbName = 'LittleLibraryDB') {
    super(dbName);

    this.version(1).stores({
      books: 'id, isbn, title, *authors, *illustrators, *genres, binLocation, borrowCount, lastBorrowedAt',
      students: 'id, firstName, activeLoansCount, createdAt',
      loans: 'id, bookId, studentId, borrowedAt, dueDate, returnedAt, status',
      settings: 'id'
    });

    this.version(2)
      .stores({
        books: 'id, isbn, title, *authors, *illustrators, *genres, binLocation, borrowCount, lastBorrowedAt, libraryId, deleted',
        students: 'id, firstName, createdAt, libraryId',
        loans: 'id, bookId, studentId, borrowedAt, dueDate, returnedAt, status, libraryId',
        settings: 'id',
        libraries: 'id, name, createdAt',
        appSettings: 'id'
      })
      .upgrade(async (tx) => {
        const oldSettings = (await tx.table('settings').get('default')) as Partial<ClassSettings> & {
          className?: string;
          teacherPin?: string;
          activeLoansCount?: number;
        } | undefined;

        const libId = 'library_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        const name = oldSettings?.className?.trim() || DEFAULT_LIBRARY_NAME;
        await tx.table('libraries').add({ id: libId, name, createdAt: Date.now() });

        await tx.table('books').toCollection().modify((b) => {
          b.libraryId = libId;
          if (b.deleted === undefined) b.deleted = false;
        });
        await tx.table('students').toCollection().modify((s) => {
          s.libraryId = libId;
          delete s.activeLoansCount;
        });
        await tx.table('loans').toCollection().modify((l) => {
          l.libraryId = libId;
        });

        await tx
          .table('appSettings')
          .add({ id: 'app', teacherPin: oldSettings?.teacherPin?.trim() || DEFAULT_APP_SETTINGS.teacherPin });

        const libSettings: ClassSettings = { ...DEFAULT_LIBRARY_SETTINGS, id: libId };
        if (oldSettings) {
          const { className: _c, teacherPin: _t, id: _id, ...rest } = oldSettings as Record<string, unknown>;
          Object.assign(libSettings, rest);
        }
        await tx.table('settings').put(libSettings);
        await tx.table('settings').delete('default');
      });

    this.version(3)
      .stores({
        books: 'id, isbn, title, *authors, *illustrators, *genres, binLocation, borrowCount, lastBorrowedAt, libraryId, deleted',
        students: 'id, firstName, createdAt, libraryId',
        loans: 'id, bookId, studentId, borrowedAt, dueDate, returnedAt, status, libraryId, updatedAt',
        settings: 'id',
        libraries: 'id, name, createdAt',
        appSettings: 'id'
      })
      .upgrade(async (tx) => {
        await tx.table('loans').toCollection().modify((l) => {
          if (l.updatedAt === undefined) l.updatedAt = l.returnedAt ?? l.borrowedAt ?? Date.now();
        });
      });

    this.on('populate', async () => {
      const libId = 'library_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      await this.libraries.add({ id: libId, name: DEFAULT_LIBRARY_NAME, createdAt: Date.now() });
      await this.appSettings.add({ ...DEFAULT_APP_SETTINGS });
      await this.settings.add({ ...DEFAULT_LIBRARY_SETTINGS, id: libId });
    });
  }

  async ensureDefaultLibrary(): Promise<Library> {
    const existing = await this.libraries.orderBy('createdAt').first();
    if (existing) return existing;
    const lib: Library = {
      id: 'library_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      name: DEFAULT_LIBRARY_NAME,
      createdAt: Date.now()
    };
    await this.libraries.add(lib);
    await this.settings.put({ ...DEFAULT_LIBRARY_SETTINGS, id: lib.id });
    return lib;
  }

  async getAppSettings(): Promise<AppSettings> {
    const existing = await this.appSettings.get('app');
    if (existing) return { ...DEFAULT_APP_SETTINGS, ...existing };
    await this.appSettings.put({ ...DEFAULT_APP_SETTINGS });
    return { ...DEFAULT_APP_SETTINGS };
  }

  async updateAppSettings(updates: Partial<Omit<AppSettings, 'id'>>): Promise<AppSettings> {
    const current = await this.getAppSettings();
    const updated: AppSettings = { ...current, ...updates, id: 'app' };
    await this.appSettings.put(updated);
    return updated;
  }

  async getSettings(libraryId: string): Promise<ClassSettings> {
    const existing = await this.settings.get(libraryId);
    if (existing) return { ...DEFAULT_LIBRARY_SETTINGS, ...existing, id: libraryId };
    const created: ClassSettings = { ...DEFAULT_LIBRARY_SETTINGS, id: libraryId };
    await this.settings.put(created);
    return created;
  }

  async updateSettings(libraryId: string, updates: Partial<Omit<ClassSettings, 'id'>>): Promise<ClassSettings> {
    const current = await this.getSettings(libraryId);
    const updated: ClassSettings = { ...current, ...updates, id: libraryId };
    await this.settings.put(updated);
    return updated;
  }
}

export const db = new LibraryDatabase();
