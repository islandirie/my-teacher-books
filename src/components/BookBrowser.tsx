import React, { useMemo, useState } from 'react';
import { Search, BookOpen, Edit2, Trash2 } from 'lucide-react';
import { Book } from '../domain/types';

interface BookBrowserProps {
  books: Book[];
  genres: string[];
  onBookTap: (book: Book) => void;
  kidMode?: boolean;
  borrowersByBook?: Record<string, string[]>;
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  onEditBook?: (book: Book) => void;
  onDeleteBook?: (book: Book) => void;
}

export const BookBrowser: React.FC<BookBrowserProps> = ({
  books,
  genres,
  onBookTap,
  kidMode = false,
  borrowersByBook = {},
  actions,
  emptyTitle = 'No books found',
  emptyMessage = 'Try modifying your search or genre filter.',
  onEditBook,
  onDeleteBook
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((b) => {
      const matchesGenre = selectedGenre === 'All' || b.genres.includes(selectedGenre);
      if (!matchesGenre) return false;
      if (!q) return true;

      const titleMatch = b.title.toLowerCase().includes(q);
      const isbnMatch = b.isbn.toLowerCase().includes(q);
      const authorMatch = b.authors.some((a) => a.toLowerCase().includes(q));
      const illustratorMatch = b.illustrators.some((i) => i.toLowerCase().includes(q));
      const binMatch = b.binLocation.toLowerCase().includes(q);
      const genreMatch = b.genres.some((g) => g.toLowerCase().includes(q));

      return titleMatch || isbnMatch || authorMatch || illustratorMatch || binMatch || genreMatch;
    });
  }, [books, searchQuery, selectedGenre]);

  const handleCardKeyDown = (e: React.KeyboardEvent, book: Book) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onBookTap(book);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              id={kidMode ? 'kioskBookSearch' : 'catalogBookSearch'}
              name="bookSearch"
              placeholder={kidMode ? 'Find a book...' : 'Search title, author, illustrator, bin...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 bg-slate-50 dark:bg-[#0c0e1e] border border-slate-200 dark:border-[#2a2f5a] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:bg-white dark:focus:bg-[#181b34] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                kidMode ? 'py-3 text-base font-semibold' : 'py-2 text-sm'
              }`}
            />
          </div>

          <select
            aria-label="Filter by genre"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className={`bg-slate-50 dark:bg-[#0c0e1e] border border-slate-200 dark:border-[#2a2f5a] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 ${
              kidMode ? 'px-4 py-3 text-base font-semibold' : 'px-3 py-2 text-sm'
            }`}
          >
            <option value="All">All Genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {actions && <div className="flex items-center space-x-2">{actions}</div>}
      </div>

      {filteredBooks.length === 0 ? (
        <div className="bg-white dark:bg-[#181b34] rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-[#2a2f5a] space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">{emptyTitle}</h3>
          <p className={`text-slate-400 max-w-sm mx-auto ${kidMode ? 'text-sm' : 'text-xs'}`}>{emptyMessage}</p>
        </div>
      ) : (
        <div
          className={
            kidMode
              ? 'grid grid-cols-2 sm:grid-cols-3 gap-4'
              : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
          }
        >
          {filteredBooks.map((book) => {
            const borrowers = borrowersByBook[book.id] ?? [];
            const allOut = book.availableCopies <= 0;
            return (
              <div
                key={book.id}
                role="button"
                tabIndex={0}
                onClick={() => onBookTap(book)}
                onKeyDown={(e) => handleCardKeyDown(e, book)}
                className={`bg-white dark:bg-[#181b34] border border-slate-200 dark:border-[#2a2f5a] shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3 cursor-pointer active:scale-[0.98] ${
                  kidMode ? 'rounded-3xl p-4' : 'rounded-2xl p-4'
                }`}
              >
                <div className={`flex ${kidMode ? 'space-x-3' : 'space-x-3'}`}>
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      loading="lazy"
                      className={`object-cover rounded-xl border border-slate-100 dark:border-[#2a2f5a] shadow-xs shrink-0 bg-slate-50 dark:bg-[#0c0e1e] ${
                        kidMode ? 'w-24 h-36' : 'w-16 h-22'
                      }`}
                    />
                  ) : (
                    <div
                      className={`rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 text-indigo-400 flex items-center justify-center shrink-0 ${
                        kidMode ? 'w-24 h-36' : 'w-16 h-22'
                      }`}
                    >
                      <BookOpen className={kidMode ? 'w-9 h-9' : 'w-6 h-6'} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`font-bold text-slate-900 dark:text-white leading-snug ${
                        kidMode ? 'text-base line-clamp-3' : 'text-sm line-clamp-2'
                      }`}
                    >
                      {book.title}
                    </h4>
                    {!kidMode && book.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1">{book.subtitle}</p>
                    )}
                    <p
                      className={`text-slate-600 dark:text-slate-300 mt-1 line-clamp-1 font-medium ${
                        kidMode ? 'text-xs' : 'text-xs'
                      }`}
                    >
                      {book.authors.join(', ')}
                    </p>
                    {!kidMode && book.illustrators.length > 0 && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-400 line-clamp-1">
                        Illus: {book.illustrators.join(', ')}
                      </p>
                    )}
                    {!kidMode && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {!book.genres.includes(book.binLocation) && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#222649] text-slate-600 dark:text-slate-300 text-[10px] font-medium rounded-md">
                            {book.binLocation}
                          </span>
                        )}
                        {book.genres.slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium rounded-md"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {kidMode ? (
                  <span
                    className={`self-start px-3 py-1.5 rounded-full text-xs font-bold ${
                      allOut
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {allOut
                      ? borrowers.length > 0
                        ? `With ${borrowers.join(', ')}`
                        : 'All copies out'
                      : `${book.availableCopies} on shelf`}
                  </span>
                ) : (
                  <div className="pt-2 border-t border-slate-100 dark:border-[#2a2f5a] flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`font-semibold ${
                          book.availableCopies > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {book.availableCopies} of {book.totalCopies} on shelf
                      </span>
                      <span className="text-slate-400 dark:text-slate-400 text-[11px]">Read {book.borrowCount}x</span>
                    </div>

                    {(onEditBook || onDeleteBook) && (
                      <div className="flex items-center space-x-1">
                        {onEditBook && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditBook(book);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-[#222649] rounded-lg transition cursor-pointer"
                            title="Edit book details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteBook && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBook(book);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title="Delete book"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
