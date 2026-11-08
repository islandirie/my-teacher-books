import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IsbnLookupService } from './IsbnLookupService';

describe('IsbnLookupService', () => {
  let service: IsbnLookupService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new IsbnLookupService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('queries Open Library and extracts title, authors, and illustrators', async () => {
    const mockOpenLibraryResponse = {
      'ISBN:9780064400558': {
        title: "Charlotte's Web",
        authors: [{ name: 'E.B. White' }],
        contributors: [{ name: 'Garth Williams', role: 'Illustrator' }],
        number_of_pages: 192,
        subjects: [{ name: 'Children Fiction' }, { name: 'Pigs' }],
        cover: { large: 'https://covers.openlibrary.org/b/id/123-L.jpg' }
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOpenLibraryResponse
    } as Response);

    const result = await service.lookup('978-0-06-440055-8');
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Charlotte's Web");
    expect(result?.authors).toContain('E.B. White');
    expect(result?.illustrators).toContain('Garth Williams');
    expect(result?.pageCount).toBe(192);
    expect(result?.coverUrl).toBe('https://covers.openlibrary.org/b/id/123-L.jpg');
  });

  it('falls back to Google Books when Open Library returns no match', async () => {
    const mockGoogleBooksResponse = {
      items: [
        {
          volumeInfo: {
            title: 'Dog Man: Lord of the Fleas',
            authors: ['Dav Pilkey'],
            description: 'A great graphic novel illustrated by Dav Pilkey.',
            pageCount: 256,
            categories: ['Juvenile Fiction'],
            imageLinks: { thumbnail: 'http://books.google.com/thumbnail.jpg' }
          }
        }
      ]
    };

    global.fetch = vi
      .fn()
      // First call (Open Library) returns empty
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      } as Response)
      // Second call (Google Books) returns match
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockGoogleBooksResponse
      } as Response);

    const result = await service.lookup('9781338236590');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Dog Man: Lord of the Fleas');
    expect(result?.authors).toContain('Dav Pilkey');
    expect(result?.illustrators).toContain('Dav Pilkey');
    expect(result?.coverUrl).toBe('https://books.google.com/thumbnail.jpg');
  });

  it('returns null when both APIs fail or find nothing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    } as Response);

    const result = await service.lookup('0000000000');
    expect(result).toBeNull();
  });

  it('filters internal category codes out of genres from both sources', async () => {
    const mockGoogleWithJunkCategories = {
      items: [
        {
          volumeInfo: {
            title: 'Pop Star Book',
            categories: ['Juvenile Fiction', 'New York Times bestseller', 'nyt:series_books=2011-07-23']
          }
        }
      ]
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mockGoogleWithJunkCategories } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'ISBN:9780000000098': {
            title: 'Shelf Book',
            subjects: [{ name: 'School Stories' }, { name: 'nyt:junk:value' }]
          }
        })
      } as Response);

    const googleResult = await service.lookup('9780000000099');
    expect(googleResult?.genres).toEqual(['Juvenile Fiction', 'New York Times bestseller']);

    const openLibraryResult = await service.lookup('9780000000098');
    expect(openLibraryResult?.genres).toEqual(['School Stories']);
  });
});
