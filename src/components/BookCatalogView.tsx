import React, { useState, useEffect } from 'react';
import { Plus, Camera, BookOpen, Layers, Flame } from 'lucide-react';
import { Book } from '../domain/types';
import { BookRepository } from '../db/BookRepository';
import { LoanRepository } from '../db/LoanRepository';
import { BookEditModal } from './BookEditModal';
import { ContinuousScannerModal } from './ContinuousScannerModal';
import { BookBrowser } from './BookBrowser';
import { BookDetailView } from './BookDetailView';
import { useAlertDialog } from './AlertDialog';

interface BookCatalogViewProps {
  bookRepo: BookRepository;
  loanRepo: LoanRepository;
  maxCopiesPerBook?: number;
}

export const BookCatalogView: React.FC<BookCatalogViewProps> = ({ bookRepo, loanRepo, maxCopiesPerBook }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [detailBorrowerNames, setDetailBorrowerNames] = useState<string[]>([]);

  useEffect(() => {
    if (!detailBook) {
      setDetailBorrowerNames([]);
      return;
    }
    loanRepo.findActiveLoansByBook(detailBook.id).then((loans) => {
      setDetailBorrowerNames(loans.map((l) => l.studentName));
    });
  }, [detailBook, loanRepo]);
  const [isContinuousScannerOpen, setIsContinuousScannerOpen] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const { dialog, showAlert } = useAlertDialog();

  const loadData = async () => {
    const allBooks = await bookRepo.getAll();
    setBooks(allBooks);
    const allGenres = await bookRepo.getAllGenres();
    setGenres(allGenres);
    setDetailBook((current) => (current ? allBooks.find((b) => b.id === current.id) ?? null : null));
  };

  useEffect(() => {
    loadData();
  }, [bookRepo]);

  const totalCopiesCount = books.reduce((acc, b) => acc + b.totalCopies, 0);
  const availableCopiesCount = books.reduce((acc, b) => acc + b.availableCopies, 0);
  const checkedOutCount = totalCopiesCount - availableCopiesCount;

  const handleDelete = (book: Book) => {
    showAlert(`Are you sure you want to delete "${book.title}" from the catalog?`, async () => {
      await bookRepo.delete(book.id);
      await loadData();
    }, 'Delete');
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Unique Titles</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{books.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">On Shelf</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{availableCopiesCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Checked Out</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{checkedOutCount}</p>
          </div>
        </div>
      </div>

      {/* Browse & Grid */}
      {detailBook ? (
        <BookDetailView
          book={detailBook}
          borrowerNames={detailBorrowerNames}
          onBack={() => setDetailBook(null)}
          onEdit={() => {
            setEditingBook(detailBook);
            setIsEditModalOpen(true);
          }}
        />
      ) : (
      <BookBrowser
        books={books}
        genres={genres}
        onBookTap={setDetailBook}
        onEditBook={(book) => {
          setEditingBook(book);
          setIsEditModalOpen(true);
        }}
        onDeleteBook={handleDelete}
        emptyMessage={
          books.length === 0
            ? 'Your classroom library is empty. Click "Add Book" or "Scan Shelf" to start cataloging!'
            : 'Try modifying your search or genre filter.'
        }
        actions={
          <>
            <button
              onClick={() => setIsContinuousScannerOpen(true)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Scan Shelf</span>
            </button>
            <button
              onClick={() => {
                setEditingBook(null);
                setIsEditModalOpen(true);
              }}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Book</span>
            </button>
          </>
        }
      />
      )}

      {/* Modals */}
      <BookEditModal
        book={editingBook}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={loadData}
        bookRepo={bookRepo}
        maxCopiesPerBook={maxCopiesPerBook}
      />

      <ContinuousScannerModal
        isOpen={isContinuousScannerOpen}
        onClose={() => setIsContinuousScannerOpen(false)}
        onBookAdded={loadData}
        bookRepo={bookRepo}
      />

      {dialog}
    </div>
  );
};
