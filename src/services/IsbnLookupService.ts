export interface BookMetadata {
  isbn: string;
  title: string;
  subtitle?: string;
  authors: string[];
  illustrators: string[];
  pageCount: number;
  genres: string[];
  summary: string;
  coverUrl: string;
}

export class IsbnLookupService {
  async lookup(isbn: string): Promise<BookMetadata | null> {
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '').trim();
    if (!cleanIsbn) return null;

    // 1. Try Open Library
    try {
      const olData = await this.fetchOpenLibrary(cleanIsbn);
      if (olData) {
        return olData;
      }
    } catch (err) {
      console.warn(`[IsbnLookup] Open Library lookup failed for ${cleanIsbn}:`, err);
    }

    // 2. Try Google Books fallback
    try {
      const gbData = await this.fetchGoogleBooks(cleanIsbn);
      if (gbData) {
        return gbData;
      }
    } catch (err) {
      console.warn(`[IsbnLookup] Google Books lookup failed for ${cleanIsbn}:`, err);
    }

    return null;
  }

  async fetchOpenLibrary(cleanIsbn: string): Promise<BookMetadata | null> {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const entry = json[`ISBN:${cleanIsbn}`];
    if (!entry || !entry.title) return null;

    const authors: string[] = (entry.authors || []).map((a: { name: string }) => a.name).filter(Boolean);
    const illustrators: string[] = [];

    // Check contributors if available
    if (Array.isArray(entry.contributors)) {
      for (const c of entry.contributors) {
        const role = (c.role || '').toLowerCase();
        if (role.includes('illustrat') || role.includes('artist') || role.includes('drawing')) {
          if (c.name && !illustrators.includes(c.name)) {
            illustrators.push(c.name);
          }
        }
      }
    }

    // Fallback parsing of by_statement (e.g. "Written by E.B. White, illustrated by Garth Williams")
    if (illustrators.length === 0 && entry.by_statement) {
      const match = entry.by_statement.match(/illustrated by\s+([^,;.]+)/i);
      if (match && match[1]) {
        illustrators.push(match[1].trim());
      }
    }

    const genres: string[] = (entry.subjects || [])
      .slice(0, 5)
      .map((s: { name: string }) => s.name)
      .filter((n: string) => Boolean(n) && !n.includes(':'));

    const coverUrl = entry.cover?.large || entry.cover?.medium || entry.cover?.small || '';

    return {
      isbn: cleanIsbn,
      title: entry.title,
      subtitle: entry.subtitle,
      authors: authors.length > 0 ? authors : ['Unknown Author'],
      illustrators,
      pageCount: entry.number_of_pages || 0,
      genres: genres.length > 0 ? genres : ['General'],
      summary: typeof entry.notes === 'string' ? entry.notes : '',
      coverUrl
    };
  }

  async fetchGoogleBooks(cleanIsbn: string): Promise<BookMetadata | null> {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    if (!json.items || json.items.length === 0) return null;

    const info = json.items[0].volumeInfo;
    if (!info || !info.title) return null;

    const authors = Array.isArray(info.authors) ? info.authors : ['Unknown Author'];
    const illustrators: string[] = [];

    // In Google books descriptions or subtitle, sometimes illustrator is mentioned
    if (info.description) {
      const match = info.description.match(/illustrated by\s+([^,;.\n]+)/i);
      if (match && match[1]) {
        illustrators.push(match[1].trim());
      }
    }

    let coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
    if (coverUrl.startsWith('http://')) {
      coverUrl = coverUrl.replace('http://', 'https://');
    }

    return {
      isbn: cleanIsbn,
      title: info.title,
      subtitle: info.subtitle,
      authors,
      illustrators,
      pageCount: info.pageCount || 0,
      genres: Array.isArray(info.categories) && info.categories.some((c: string) => !c.includes(':'))
        ? info.categories.filter((c: string) => !c.includes(':'))
        : ['General'],
      summary: info.description || '',
      coverUrl
    };
  }
}

export const isbnLookupService = new IsbnLookupService();
