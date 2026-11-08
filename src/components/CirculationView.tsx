import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, AlertTriangle, Search, Trophy } from 'lucide-react';
import { Loan, Book } from '../domain/types';
import { LoanRepository } from '../db/LoanRepository';
import { BookRepository } from '../db/BookRepository';
import { audioService } from '../services/AudioService';
import { useAlertDialog } from './AlertDialog';

interface CirculationViewProps {
  loanRepo: LoanRepository;
  bookRepo: BookRepository;
}

export const CirculationView: React.FC<CirculationViewProps> = ({ loanRepo, bookRepo }) => {
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [popularBooks, setPopularBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { dialog, showAlert } = useAlertDialog();

  const loadData = async () => {
    const loans = await loanRepo.getActiveLoans();
    setActiveLoans(loans);

    const allBooks = await bookRepo.getAll();
    const sorted = allBooks
      .filter((b) => b.borrowCount > 0)
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 5);
    setPopularBooks(sorted);
  };

  useEffect(() => {
    loadData();
  }, [loanRepo, bookRepo]);

  const handleReturn = async (loan: Loan) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await loanRepo.returnLoan(loan.id);
      audioService.playSuccessChime();
      await loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error returning book');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredLoans = activeLoans.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return l.bookTitle.toLowerCase().includes(q) || l.studentName.toLowerCase().includes(q);
  });

  const overdueCount = activeLoans.filter((l) => l.status === 'overdue').length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Loans</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{activeLoans.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
            overdueCount > 0 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-[#222649] text-slate-400 dark:text-slate-400'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Overdue Books</p>
            <p className={`text-xl font-bold ${overdueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
              {overdueCount}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Loans List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Currently Borrowed</h3>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search student or book..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#0c0e1e] border border-slate-200 dark:border-[#2a2f5a] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:bg-white dark:focus:bg-[#181b34] focus:outline-none"
              />
            </div>
          </div>

          {filteredLoans.length === 0 ? (
            <div className="bg-white dark:bg-[#181b34] rounded-3xl p-10 text-center border border-dashed border-slate-300 dark:border-[#2a2f5a] space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">All books are in the library!</p>
              <p className="text-xs text-slate-400">No active checkouts currently.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLoans.map((loan) => {
                const isOverdue = loan.status === 'overdue';
                const borrowDateStr = new Date(loan.borrowedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                });
                const dueDateStr = loan.dueDate
                  ? new Date(loan.dueDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    })
                  : 'No due date';

                return (
                  <div
                    key={loan.id}
                    className="bg-white dark:bg-[#181b34] rounded-2xl border border-slate-200 dark:border-[#2a2f5a] p-4 shadow-xs flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{loan.bookTitle}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        Borrowed by <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{loan.studentName}</span>
                      </p>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 dark:text-slate-400 pt-1">
                        <span>Checked out: {borrowDateStr}</span>
                        <span>•</span>
                        <span className={isOverdue ? 'text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1' : ''}>
                          {isOverdue && <AlertTriangle className="w-3 h-3" />}
                          <span>Due: {dueDateStr}</span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleReturn(loan)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-1 transition shadow-2xs cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Return</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Popular Books Leaderboard */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Classroom Favorites</h3>
          </div>

          {popularBooks.length === 0 ? (
            <div className="bg-white dark:bg-[#181b34] rounded-2xl p-6 text-center border border-slate-200 dark:border-[#2a2f5a] text-xs text-slate-400">
              Checkout stats will appear here as students borrow books.
            </div>
          ) : (
            <div className="bg-white dark:bg-[#181b34] rounded-2xl border border-slate-200 dark:border-[#2a2f5a] divide-y divide-slate-100 dark:divide-[#2a2f5a] overflow-hidden shadow-xs">
              {popularBooks.map((book, idx) => (
                <div key={book.id} className="p-3 flex items-center space-x-3 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">
                    #{idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white truncate">{book.title}</p>
                    <p className="text-slate-400 dark:text-slate-400 text-[11px] truncate">{book.authors.join(', ')}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold rounded-md shrink-0">
                    {book.borrowCount} reads
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {dialog}
    </div>
  );
};
