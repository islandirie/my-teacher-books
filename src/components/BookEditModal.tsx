import React, { useState, useEffect } from 'react';
import { X, Book as BookIcon, Save, Image, Sparkles } from 'lucide-react';
import { Book } from '../domain/types';
import { BookRepository } from '../db/BookRepository';
import { isbnLookupService } from '../services/IsbnLookupService';

interface BookEditModalProps {
  book?: Book | null;
  initialIsbn?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (book: Book) => void;
  bookRepo: BookRepository;
  maxCopiesPerBook?: number;
}

export const BookEditModal: React.FC<BookEditModalProps> = ({
  book,
  initialIsbn,
  isOpen,
  onClose,
  onSaved,
  bookRepo,
  maxCopiesPerBook
}) => {
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [illustrators, setIllustrators] = useState('');
  const [pageCount, setPageCount] = useState<number>(0);
  const [genres, setGenres] = useState('');
  const [summary, setSummary] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [binLocation, setBinLocation] = useState('General');
  const [totalCopies, setTotalCopies] = useState<number>(1);
  const [availableCopies, setAvailableCopies] = useState<number>(1);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (book) {
      setIsbn(book.isbn || '');
      setTitle(book.title || '');
      setSubtitle(book.subtitle || '');
      setAuthors(book.authors.join(', '));
      setIllustrators(book.illustrators.join(', '));
      setPageCount(book.pageCount || 0);
      setGenres(book.genres.join(', '));
      setSummary(book.summary || '');
      setCoverUrl(book.coverUrl || '');
      setBinLocation(book.binLocation || 'General');
      setTotalCopies(book.totalCopies || 1);
      setAvailableCopies(book.availableCopies || 1);
    } else {
      setIsbn(initialIsbn || '');
      setTitle('');
      setSubtitle('');
      setAuthors('');
      setIllustrators('');
      setPageCount(0);
      setGenres('');
      setSummary('');
      setCoverUrl('');
      setBinLocation('General');
      setTotalCopies(1);
      setAvailableCopies(1);

      if (initialIsbn) {
        handleLookup(initialIsbn);
      }
    }
    setError(null);
  }, [book, initialIsbn, isOpen]);

  const handleLookup = async (isbnToLookup: string) => {
    if (!isbnToLookup.trim()) return;
    setIsLookingUp(true);
    setError(null);
    try {
      const meta = await isbnLookupService.lookup(isbnToLookup);
      if (meta) {
        setTitle(meta.title);
        if (meta.subtitle) setSubtitle(meta.subtitle);
        setAuthors(meta.authors.join(', '));
        setIllustrators(meta.illustrators.join(', '));
        setPageCount(meta.pageCount);
        setGenres(meta.genres.join(', '));
        if (meta.summary) setSummary(meta.summary);
        if (meta.coverUrl) setCoverUrl(meta.coverUrl);
      } else {
        setError('No online metadata found for this ISBN. You can enter details manually.');
      }
    } catch {
      setError('Lookup failed. Please fill in details manually.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const authorList = authors.split(',').map((a) => a.trim()).filter(Boolean);
    const illustratorList = illustrators.split(',').map((i) => i.trim()).filter(Boolean);
    const genreList = genres.split(',').map((g) => g.trim()).filter(Boolean);

    const maxCopies = Math.max(1, Math.floor(Number(maxCopiesPerBook) || 10));
    const total = Math.max(1, Math.floor(Number(totalCopies) || 1));
    const available = Math.max(0, Math.floor(Number(availableCopies) || 0));
    if (total > maxCopies || available > maxCopies) {
      setError(`Max copies per book is ${maxCopies}`);
      return;
    }
    const finalTotal = Math.max(total, available);

    try {
      if (book) {
        const updated = await bookRepo.update(book.id, {
          isbn: isbn.trim(),
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          authors: authorList.length > 0 ? authorList : ['Unknown Author'],
          illustrators: illustratorList,
          pageCount: Number(pageCount) || 0,
          genres: genreList.length > 0 ? genreList : ['General'],
          summary: summary.trim(),
          coverUrl,
          binLocation: binLocation.trim() || 'General',
          totalCopies: finalTotal,
          availableCopies: available
        });
        onSaved(updated);
      } else {
        const created = await bookRepo.create({
          isbn: isbn.trim(),
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          authors: authorList.length > 0 ? authorList : ['Unknown Author'],
          illustrators: illustratorList,
          pageCount: Number(pageCount) || 0,
          genres: genreList.length > 0 ? genreList : ['General'],
          summary: summary.trim(),
          coverUrl,
          binLocation: binLocation.trim() || 'General',
          totalCopies: finalTotal,
          availableCopies: available
        });
        onSaved(created);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving book');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#181b34] rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-[#2a2f5a] my-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2a2f5a] pb-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BookIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {book ? 'Edit Book Details' : 'Add New Book'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Classroom inventory and metadata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-[#222649] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* ISBN with Auto-lookup button */}
          <div className="flex space-x-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                ISBN Barcode
              </label>
              <input
                type="text"
                placeholder="e.g. 9780064400558"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => handleLookup(isbn)}
              disabled={isLookingUp || !isbn.trim()}
              className="px-4 py-2 bg-slate-100 dark:bg-[#1f2347] hover:bg-indigo-50 dark:hover:bg-[#2b3060] text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-medium border border-indigo-200 dark:border-indigo-800 flex items-center space-x-1 transition disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLookingUp ? 'Searching...' : 'Lookup'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Charlotte's Web"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Subtitle
              </label>
              <input
                type="text"
                placeholder="Optional subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Author(s)
              </label>
              <input
                type="text"
                placeholder="Comma separated: E.B. White"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Illustrator(s)
              </label>
              <input
                type="text"
                placeholder="Comma separated: Garth Williams"
                value={illustrators}
                onChange={(e) => setIllustrators(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Pages
              </label>
              <input
                type="number"
                value={pageCount || ''}
                onChange={(e) => setPageCount(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Total Copies
              </label>
              <input
                type="number"
                value={totalCopies}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 1;
                  setTotalCopies(val);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Available Copies
              </label>
              <input
                type="number"
                value={availableCopies}
                onChange={(e) => setAvailableCopies(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">If Available is above Total, Total is raised to match on save.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Genres / Tags
              </label>
              <input
                type="text"
                placeholder="Comma separated: Animals, Chapter Book"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Bin / Shelf Location
              </label>
              <input
                type="text"
                placeholder="e.g. Bin 3 - Animals"
                value={binLocation}
                onChange={(e) => setBinLocation(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Summary / Blurb
            </label>
            <textarea
              rows={2}
              placeholder="Short book description..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Cover Image & File snap */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Cover Artwork
            </label>
            <div className="flex items-center space-x-3">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Cover Preview"
                  className="w-12 h-16 object-cover rounded-lg border border-slate-200 dark:border-[#2a2f5a] shadow-xs"
                />
              ) : (
                <div className="w-12 h-16 bg-slate-100 dark:bg-[#0c0e1e] rounded-lg flex items-center justify-center text-slate-400 border border-dashed border-slate-300 dark:border-[#2a2f5a]">
                  <Image className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  placeholder="Image URL or upload below..."
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:outline-none"
                />
                <label className="inline-block px-3 py-1 bg-slate-100 dark:bg-[#1f2347] hover:bg-slate-200 dark:hover:bg-[#2b3060] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg cursor-pointer transition">
                  <span>Upload / Snap Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-[#2a2f5a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-[#2a2f5a] text-slate-600 dark:text-slate-300 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-[#1f2347] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{book ? 'Save Changes' : 'Add to Library'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
