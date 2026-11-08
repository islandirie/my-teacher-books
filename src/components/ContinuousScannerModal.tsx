import React, { useState } from 'react';
import { X, CheckCircle, RefreshCw, BookOpen } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { isbnLookupService } from '../services/IsbnLookupService';
import { BookRepository } from '../db/BookRepository';
import { Book } from '../domain/types';

interface ContinuousScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookAdded: (book: Book) => void;
  bookRepo: BookRepository;
}

export const ContinuousScannerModal: React.FC<ContinuousScannerModalProps> = ({
  isOpen,
  onClose,
  onBookAdded,
  bookRepo
}) => {
  const [recentAdded, setRecentAdded] = useState<Book[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleScan = async (scannedIsbn: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStatusMessage(`Looking up ISBN ${scannedIsbn}...`);

    try {
      // Check if book with this ISBN already exists
      const existing = await bookRepo.getByIsbn(scannedIsbn);
      if (existing) {
        setStatusMessage(`Already in library: "${existing.title}"`);
        return;
      }

      // Lookup online
      const meta = await isbnLookupService.lookup(scannedIsbn);
      if (meta) {
        const newBook = await bookRepo.create({
          isbn: meta.isbn,
          title: meta.title,
          subtitle: meta.subtitle,
          authors: meta.authors,
          illustrators: meta.illustrators,
          pageCount: meta.pageCount,
          genres: meta.genres,
          summary: meta.summary,
          coverUrl: meta.coverUrl,
          binLocation: 'General',
          totalCopies: 1,
          availableCopies: 1
        });
        setRecentAdded((prev) => [newBook, ...prev.slice(0, 4)]);
        setStatusMessage(`Added "${newBook.title}" to library!`);
        onBookAdded(newBook);
      } else {
        // Create skeleton for manual completion later
        const fallbackBook = await bookRepo.create({
          isbn: scannedIsbn,
          title: `Book (ISBN ${scannedIsbn})`,
          authors: ['Unknown Author'],
          totalCopies: 1,
          availableCopies: 1,
          binLocation: 'To Be Categorized'
        });
        setRecentAdded((prev) => [fallbackBook, ...prev.slice(0, 4)]);
        setStatusMessage(`Added ISBN ${scannedIsbn} (Details can be edited later)`);
        onBookAdded(fallbackBook);
      }
    } catch (err: unknown) {
      console.error(err);
      setStatusMessage('Error processing scan. Try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#181b34] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-[#2a2f5a] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2a2f5a]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Continuous Shelf Scanner</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Scan barcodes one after another</p>
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

        {/* Scanner Component with Continuous flag */}
        <BarcodeScanner
          continuous={true}
          onScan={handleScan}
          instructionText="Scan book barcode to auto-add"
        />

        {/* Status Toast */}
        <div className="min-h-10 flex items-center justify-center">
          {isProcessing ? (
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{statusMessage}</span>
            </div>
          ) : statusMessage ? (
            <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{statusMessage}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-400">Ready to scan shelf books</p>
          )}
        </div>

        {/* Recent Additions List */}
        {recentAdded.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-[#2a2f5a] space-y-2">
            <h3 className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-400 tracking-wider">
              Recently Scanned
            </h3>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {recentAdded.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 bg-slate-50 dark:bg-[#0c0e1e] rounded-xl text-xs"
                >
                  <div className="truncate mr-2">
                    <p className="font-semibold text-slate-800 dark:text-white truncate">{b.title}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                      {b.authors.join(', ')} • {b.binLocation}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium rounded-full text-[10px] shrink-0">
                    {b.totalCopies} {b.totalCopies === 1 ? 'copy' : 'copies'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
