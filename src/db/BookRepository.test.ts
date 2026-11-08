import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LibraryDatabase } from './database';
import { BookRepository } from './BookRepository';

describe('BookRepository', () => {
  let db: LibraryDatabase;
  let repo: BookRepository;

  beforeEach(() => {
    db = new LibraryDatabase('TestBookDB_' + Math.random().toString(36).substring(7));
    repo = new BookRepository(db);
  });

  it('creates, reads, and updates a book', async () => {
    const book = await repo.create({
      isbn: '9780064400558',
      title: "Charlotte's Web",
      authors: ['E.B. White'],
      illustrators: ['Garth Williams'],
      pageCount: 192,
      genres: ['Classics', 'Animals'],
      summary: 'Some Pig. Humble. Radiant.',
      binLocation: 'Bin 4',
      totalCopies: 3
    });

    expect(book.id).toBeDefined();
    expect(book.title).toBe("Charlotte's Web");
    expect(book.availableCopies).toBe(3);
    expect(book.libraryId).toBeDefined();
    expect(book.deleted).toBe(false);

    const fetched = await repo.getById(book.id);
    expect(fetched?.title).toBe("Charlotte's Web");

    const byIsbn = await repo.getByIsbn('978-0-06-440055-8');
    expect(byIsbn?.id).toBe(book.id);

    const updated = await repo.update(book.id, { binLocation: 'Bin 5' });
    expect(updated.binLocation).toBe('Bin 5');
  });

  it('soft-deletes a book, hiding it from reads, and re-adding the ISBN makes a fresh book', async () => {
    const book = await repo.create({ isbn: '9780064400558', title: "Charlotte's Web" });

    await repo.delete(book.id);
    expect((await repo.getAll()).length).toBe(0);
    expect(await repo.getByIsbn('9780064400558')).toBeUndefined();
    expect((await repo.getAllIncludingDeleted()).length).toBe(1);
    expect((await repo.getAllGenres()).length).toBe(0);

    const reAdded = await repo.create({ isbn: '9780064400558', title: "Charlotte's Web" });
    expect(reAdded.id).not.toBe(book.id);
    expect((await repo.getAll()).length).toBe(1);
  });

  it('searches by title, author, illustrator, or bin and filters by genre', async () => {
    await repo.create({
      title: 'Dog Man: Lord of the Fleas',
      authors: ['Dav Pilkey'],
      illustrators: ['Dav Pilkey'],
      genres: ['Graphic Novel', 'Humor'],
      binLocation: 'Bin 1 - Comics'
    });

    await repo.create({
      title: 'The Giving Tree',
      authors: ['Shel Silverstein'],
      illustrators: ['Shel Silverstein'],
      genres: ['Classics', 'Poetry'],
      binLocation: 'Bin 2 - Poetry'
    });

    const byIllustrator = await repo.search('Shel Silverstein');
    expect(byIllustrator.length).toBe(1);
    expect(byIllustrator[0].title).toBe('The Giving Tree');

    const byBin = await repo.search('Comics');
    expect(byBin.length).toBe(1);
    expect(byBin[0].title).toBe('Dog Man: Lord of the Fleas');

    const byGenre = await repo.search('', 'Graphic Novel');
    expect(byGenre.length).toBe(1);
    expect(byGenre[0].title).toBe('Dog Man: Lord of the Fleas');
  });

  it('enforces copy availability and tracks borrow count', async () => {
    const book = await repo.create({
      title: 'Green Eggs and Ham',
      authors: ['Dr. Seuss'],
      totalCopies: 2,
      availableCopies: 2
    });

    await repo.decrementAvailableCopies(book.id);
    let current = await repo.getById(book.id);
    expect(current?.availableCopies).toBe(1);
    expect(current?.borrowCount).toBe(1);

    await repo.decrementAvailableCopies(book.id);
    current = await repo.getById(book.id);
    expect(current?.availableCopies).toBe(0);
    expect(current?.borrowCount).toBe(2);

    await expect(repo.decrementAvailableCopies(book.id)).rejects.toThrow();

    await repo.incrementAvailableCopies(book.id);
    current = await repo.getById(book.id);
    expect(current?.availableCopies).toBe(1);

    await repo.incrementAvailableCopies(book.id);
    await repo.incrementAvailableCopies(book.id);
    current = await repo.getById(book.id);
    expect(current?.availableCopies).toBe(2);
  });
});
