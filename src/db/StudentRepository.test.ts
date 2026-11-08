import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LibraryDatabase } from './database';
import { StudentRepository } from './StudentRepository';

describe('StudentRepository', () => {
  let db: LibraryDatabase;
  let repo: StudentRepository;

  beforeEach(() => {
    db = new LibraryDatabase('TestStudentDB_' + Math.random().toString(36).substring(7));
    repo = new StudentRepository(db);
  });

  it('creates, updates, and deletes a student profile', async () => {
    const student = await repo.create({
      firstName: 'Mia K.',
      avatar: '🦄',
      color: 'purple',
      pin: '1234'
    });

    expect(student.id).toBeDefined();
    expect(student.firstName).toBe('Mia K.');
    expect(student.avatar).toBe('🦄');
    expect(student.libraryId).toBeDefined();

    const verified = await repo.verifyPin(student.id, '1234');
    expect(verified).toBe(true);

    const failed = await repo.verifyPin(student.id, '9999');
    expect(failed).toBe(false);

    await repo.update(student.id, { firstName: 'Mia L.' });
    const current = await repo.getById(student.id);
    expect(current?.firstName).toBe('Mia L.');

    await repo.delete(student.id);
    const deleted = await repo.getById(student.id);
    expect(deleted).toBeUndefined();
  });

  it('scopes students to the active library', async () => {
    await repo.create({ firstName: 'Alex M.' });

    const second = await db.libraries.add({ id: 'lib2', name: 'Home Shelf', createdAt: 2 });
    db.currentLibraryId = second;
    await repo.create({ firstName: 'Sam T.' });

    expect((await repo.getAll()).map((s) => s.firstName)).toEqual(['Sam T.']);

    db.currentLibraryId = null;
    expect((await repo.getAll()).length).toBe(2);
  });
});
