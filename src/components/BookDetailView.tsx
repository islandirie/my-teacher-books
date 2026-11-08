import React from 'react';
import { ArrowLeft, BookOpen, Edit2, User } from 'lucide-react';
import { Book } from '../domain/types';

interface BookDetailViewProps {
  book: Book;
  borrowerNames: string[];
  onBack: () => void;
  onEdit?: () => void;
  onCheckout?: () => void;
  checkoutDisabledReason?: string | null;
}

export const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  borrowerNames,
  onBack,
  onEdit,
  onCheckout,
  checkoutDisabledReason
}) => {
  const kidMode = Boolean(onCheckout);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          aria-label="Back"
          className={`text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#1f2347] transition cursor-pointer ${
            kidMode ? 'p-3 min-w-[44px] min-h-[44px] flex items-center' : 'p-2'
          }`}
        >
          <ArrowLeft className={kidMode ? 'w-7 h-7' : 'w-5 h-5'} />
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
        )}
      </div>

      <div
        className={`bg-white dark:bg-[#181b34] border border-slate-200 dark:border-[#2a2f5a] shadow-xl space-y-5 ${
          kidMode ? 'rounded-3xl p-6 max-w-md w-full mx-auto' : 'rounded-2xl p-6'
        }`}
      >
        <div className={kidMode ? 'flex flex-col items-center text-center space-y-3' : 'flex space-x-5'}>
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className={`object-cover rounded-2xl border border-slate-100 dark:border-[#2a2f5a] shadow-md bg-slate-50 dark:bg-[#0c0e1e] shrink-0 ${
                kidMode ? 'w-40 h-56' : 'w-32 h-44'
              }`}
            />
          ) : (
            <div
              className={`rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 text-indigo-400 flex items-center justify-center shrink-0 ${
                kidMode ? 'w-40 h-56' : 'w-32 h-44'
              }`}
            >
              <BookOpen className="w-10 h-10" />
            </div>
          )}

          <div className={kidMode ? 'space-y-1' : 'flex-1 min-w-0 space-y-2'}>
            <h2
              className={`font-black text-slate-900 dark:text-white leading-snug ${
                kidMode ? 'text-2xl' : 'text-xl'
              }`}
            >
              {book.title}
            </h2>
            {book.subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">{book.subtitle}</p>
            )}
            <p className={`text-slate-700 dark:text-slate-200 font-semibold ${kidMode ? 'text-base' : 'text-sm'}`}>
              {book.authors.join(', ') || 'Author unknown'}
            </p>
            {book.illustrators.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Illustrated by {book.illustrators.join(', ')}
              </p>
            )}
            <div className={`flex flex-wrap gap-1.5 ${kidMode ? 'justify-center' : ''}`}>
              {book.pageCount > 0 && (
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-[#222649] text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg">
                  {book.pageCount} pages
                </span>
              )}
              {!book.genres.includes(book.binLocation) && book.binLocation && (
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-[#222649] text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg">
                  Bin: {book.binLocation}
                </span>
              )}
              {book.genres.map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-[#2a2f5a] pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span
              className={`font-bold ${
                book.availableCopies > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              } ${kidMode ? 'text-base' : 'text-sm'}`}
            >
              {book.availableCopies} of {book.totalCopies} on the shelf
            </span>
            {!kidMode && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Borrowed {book.borrowCount}x all time
                {book.lastBorrowedAt ? ` • last ${new Date(book.lastBorrowedAt).toLocaleDateString()}` : ''}
              </span>
            )}
          </div>

          {borrowerNames.length > 0 && (
            <div className="flex items-start space-x-2 text-sm">
              <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className={kidMode ? 'text-sm font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}>
                Currently with: <span className="font-bold">{borrowerNames.join(', ')}</span>
              </p>
            </div>
          )}

          {book.summary ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">About this book</h3>
              <p
                className={`text-slate-600 dark:text-slate-300 leading-relaxed ${
                  kidMode ? 'text-base' : 'text-sm line-clamp-6'
                }`}
              >
                {book.summary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">
              {kidMode ? 'Ask your teacher to tell you about this one!' : 'No summary recorded for this book.'}
            </p>
          )}
        </div>

        {onCheckout && (
          <button
            onClick={onCheckout}
            disabled={Boolean(checkoutDisabledReason)}
            className={`w-full py-5 rounded-3xl font-black text-xl flex items-center justify-center space-x-2 shadow-lg transition ${
              checkoutDisabledReason
                ? 'bg-slate-200 dark:bg-[#222649] text-slate-500 dark:text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white shadow-indigo-200 dark:shadow-none cursor-pointer'
            }`}
          >
            <BookOpen className="w-6 h-6" />
            <span>{checkoutDisabledReason ?? 'Check Out This Book'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
