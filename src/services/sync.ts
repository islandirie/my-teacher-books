import { Book, Loan } from '../domain/types';

/**
 * Latest-edit-wins reconciliation. Books are matched by ISBN when present,
 * otherwise by id. A remote (sheet) row with a blank `updatedAt` is treated as
 * newest, so hand-edited rows win the next pull. A blank remote cover never
 * overwrites a local cover.
 */
export interface ReconcileResult {
  books: Book[];
  /** losing local book id -> winning id (callers re-point loans to it) */
  repoint: Record<string, string>;
}

function bookKey(book: Book): string {
  const isbn = book.isbn.replace(/-/g, '').trim();
  return isbn ? `isbn:${isbn}` : `id:${book.id}`;
}

function effectiveUpdatedAt(book: Book, isRemote: boolean): number {
  if (isRemote && !book.updatedAt) return Infinity;
  return book.updatedAt || 0;
}

export function reconcileBooks(local: Book[], remote: Book[]): ReconcileResult {
  const groups = new Map<string, { book: Book; isRemote: boolean }[]>();

  for (const b of local) {
    const key = bookKey(b);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ book: b, isRemote: false });
  }
  for (const b of remote) {
    const key = bookKey(b);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ book: b, isRemote: true });
  }

  const books: Book[] = [];
  const repoint: Record<string, string> = {};

  for (const members of groups.values()) {
    let winner = members[0];
    for (const m of members) {
      if (effectiveUpdatedAt(m.book, m.isRemote) > effectiveUpdatedAt(winner.book, winner.isRemote)) {
        winner = m;
      }
    }

    // Adopt the winner's id; record re-points for any local book that lost.
    const merged = { ...winner.book };
    for (const m of members) {
      if (!m.isRemote && m.book.id !== winner.book.id) {
        repoint[m.book.id] = winner.book.id;
      }
    }

    // A blank remote cover must not erase a local (possibly data-URL) cover.
    if (!merged.coverUrl) {
      const withCover = members.find((m) => !m.isRemote && m.book.coverUrl);
      if (withCover) merged.coverUrl = withCover.book.coverUrl;
    }

    books.push(merged);
  }

  return { books, repoint };
}

export function reconcileLoans(local: Loan[], remote: Loan[]): Loan[] {
  const map = new Map<string, Loan>();
  for (const l of local) map.set(l.id, l);
  for (const r of remote) {
    const existing = map.get(r.id);
    if (!existing || r.updatedAt >= existing.updatedAt) map.set(r.id, r);
  }
  return Array.from(map.values());
}
