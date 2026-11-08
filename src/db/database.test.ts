import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LibraryDatabase } from './database';
import { DEFAULT_APP_SETTINGS, DEFAULT_LIBRARY_SETTINGS } from '../domain/types';

describe('LibraryDatabase', () => {
  let testDb: LibraryDatabase;

  beforeEach(() => {
    testDb = new LibraryDatabase('TestLibraryDB_' + Math.random().toString(36).substring(7));
  });

  it('instantiates all tables and seeds a default library and app settings', async () => {
    expect(testDb.books).toBeDefined();
    expect(testDb.students).toBeDefined();
    expect(testDb.loans).toBeDefined();
    expect(testDb.libraries).toBeDefined();
    expect(testDb.settings).toBeDefined();
    expect(testDb.appSettings).toBeDefined();

    const libraries = await testDb.libraries.toArray();
    expect(libraries.length).toBe(1);
    expect(libraries[0].name).toBe('Library 1');

    const app = await testDb.getAppSettings();
    expect(app.teacherPin).toBe(DEFAULT_APP_SETTINGS.teacherPin);

    const settings = await testDb.getSettings(libraries[0].id);
    expect(settings.kioskAuthMode).toBe(DEFAULT_LIBRARY_SETTINGS.kioskAuthMode);
    expect(settings.maxBooksPerStudent).toBe(2);
  });

  it('keeps settings isolated per library', async () => {
    const lib = await testDb.ensureDefaultLibrary();
    await testDb.updateSettings(lib.id, { celebrationGraphic: 'dinosaur' });

    const second = await testDb.libraries.add({ id: 'lib2', name: 'Home Shelf', createdAt: 2 });
    const secondSettings = await testDb.getSettings(second);
    expect(secondSettings.celebrationGraphic).toBe('rocket');

    const firstSettings = await testDb.getSettings(lib.id);
    expect(firstSettings.celebrationGraphic).toBe('dinosaur');
  });
});
