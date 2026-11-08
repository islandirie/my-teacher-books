import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Lock, ArrowLeft, BookOpen, CheckCircle, RotateCcw, AlertCircle, Sparkles } from 'lucide-react';
import { Student, Book, Loan, ClassSettings } from '../domain/types';
import { BookRepository } from '../db/BookRepository';
import { StudentRepository } from '../db/StudentRepository';
import { LoanRepository } from '../db/LoanRepository';
import { BarcodeScanner } from './BarcodeScanner';
import { BookBrowser } from './BookBrowser';
import { BookDetailView } from './BookDetailView';
import { audioService } from '../services/AudioService';

interface StudentKioskProps {
  settings: ClassSettings;
  libraryName: string;
  teacherPin: string;
  bookRepo: BookRepository;
  studentRepo: StudentRepository;
  loanRepo: LoanRepository;
  onExitKiosk: () => void;
}

type KioskStep =
  | 'class_gate'
  | 'roster'
  | 'student_pin'
  | 'student_actions'
  | 'browse'
  | 'browse_detail'
  | 'checkout_scan'
  | 'return_scan'
  | 'multi_return_select'
  | 'celebration';

export const StudentKiosk: React.FC<StudentKioskProps> = ({
  settings,
  libraryName,
  teacherPin,
  bookRepo,
  studentRepo,
  loanRepo,
  onExitKiosk
}) => {
  const [step, setStep] = useState<KioskStep>(
    settings.kioskAuthMode === 'class_pin' ? 'class_gate' : 'roster'
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentLoans, setStudentLoans] = useState<Loan[]>([]);
  const [browseLoans, setBrowseLoans] = useState<Loan[]>([]); // session loans
  const [browseDetailBook, setBrowseDetailBook] = useState<Book | null>(null);
  const [browseDetailBorrowerNames, setBrowseDetailBorrowerNames] = useState<string[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [browseBorrowersByBook, setBrowseBorrowersByBook] = useState<Record<string, string[]>>({});
  const [activeLoanCounts, setActiveLoanCounts] = useState<Record<string, number>>({});

  // Security & PIN states
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [teacherPinInput, setTeacherPinInput] = useState('');
  const [exitPinError, setExitPinError] = useState(false);
  const exitPinInputRef = useRef<HTMLInputElement>(null);

  const [classGatePin, setClassGatePin] = useState('');
  const [classGateError, setClassGateError] = useState(false);

  const [studentPinInput, setStudentPinInput] = useState('');
  const [studentPinError, setStudentPinError] = useState(false);

  // Flow & error states
  const [kioskError, setKioskError] = useState<string | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [countdown, setCountdown] = useState(4);
  const autoResetTimerRef = useRef<number | null>(null);

  // Multi-borrower return state
  const [pendingReturnBook, setPendingReturnBook] = useState<Book | null>(null);
  const [candidateBorrowers, setCandidateBorrowers] = useState<Loan[]>([]);

  const loadData = async () => {
    const list = await studentRepo.getAll();
    setStudents(list);
    const allBooks = await bookRepo.getAll();
    setBooks(allBooks);
    const allGenres = await bookRepo.getAllGenres();
    setGenres(allGenres);
    setActiveLoanCounts(await loanRepo.getActiveLoanCounts());
  };

  useEffect(() => {
    loadData();
    audioService.setEnabled(settings.celebrationSound);
  }, [studentRepo, settings]);

  // Clean auto-reset timer on unmount
  useEffect(() => {
    return () => {
      if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const borrowersByBook: Record<string, string[]> = {};
    studentLoans.forEach((loan) => {
      if (!borrowersByBook[loan.bookId]) {
        borrowersByBook[loan.bookId] = [];
      }
      borrowersByBook[loan.bookId].push(loan.studentName);
    });
    setBrowseBorrowersByBook(borrowersByBook);
  }, [studentLoans]);

  // Return focus to the exit-dialog PIN input after a failed attempt
  useEffect(() => {
    if (exitPinError) exitPinInputRef.current?.focus();
  }, [exitPinError]);

  // Trigger celebration effects
  const triggerCelebration = (message: string) => {
    setCelebrationMessage(message);
    setStep('celebration');
    setCountdown(3);

    audioService.playSuccessChime();

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Confetti fallback
    }

    if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);

    autoResetTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);
          resetToRoster();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetToRoster = () => {
    if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);
    setSelectedStudent(null);
    setStudentLoans([]);
    setPendingReturnBook(null);
    setCandidateBorrowers([]);
    setKioskError(null);
    setStudentPinInput('');
    setStudentPinError(false);
    setStep('roster');
    setBrowseLoans([]);
    setBrowseDetailBook(null);
    setBrowseDetailBorrowerNames([]);
    setBrowseBorrowersByBook({});
  };

  // Exit Teacher PIN Handler
  const handleVerifyTeacherPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherPinInput.trim() === teacherPin.trim()) {
      setIsExitDialogOpen(false);
      onExitKiosk();
    } else {
      setExitPinError(true);
      audioService.playErrorBuzz();
      setTeacherPinInput('');
    }
  };

  // Class Gate Unlock Handler
  const handleVerifyClassGate = (e: React.FormEvent) => {
    e.preventDefault();
    if (classGatePin.trim() === settings.classPin.trim()) {
      setClassGateError(false);
      setStep('roster');
    } else {
      setClassGateError(true);
      audioService.playErrorBuzz();
      setClassGatePin('');
    }
  };

  // Student Selection Handler
  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setKioskError(null);

    if (settings.kioskAuthMode === 'student_pin' && student.pin) {
      setStudentPinInput('');
      setStudentPinError(false);
      setStep('student_pin');
      return;
    }

    await advanceToStudentActions(student);
  };

  const handleVerifyStudentPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    if (selectedStudent.pin && selectedStudent.pin.trim() === studentPinInput.trim()) {
      setStudentPinError(false);
      await advanceToStudentActions(selectedStudent);
    } else {
      setStudentPinError(true);
      audioService.playErrorBuzz();
      setStudentPinInput('');
    }
  };

  const advanceToStudentActions = async (student: Student) => {
    const loans = await loanRepo.findActiveLoansByStudent(student.id);
    setStudentLoans(loans);
    setStep('student_actions');
  };

  // Student Checkout Handler (shared by scan and browse)
  const performCheckout = async (book: Book): Promise<boolean> => {
    if (!selectedStudent) return false;
    setKioskError(null);
    try {
      if (book.availableCopies <= 0) {
        audioService.playErrorBuzz();
        setKioskError(`All copies of "${book.title}" are currently checked out.`);
        return false;
      }
      await loanRepo.checkout(
        book.id,
        selectedStudent.id,
        settings.loanPeriodDays,
        settings.maxBooksPerStudent
      );
      return true;
    } catch (err: unknown) {
      audioService.playErrorBuzz();
      setKioskError(err instanceof Error ? err.message : 'Error checking out book');
      return false;
    }
  };

  // Student Checkout Barcode Scan Handler
  const handleCheckoutScan = async (scannedBarcode: string) => {
    if (!selectedStudent) return;
    setKioskError(null);

    try {
      const book = await bookRepo.getByIsbn(scannedBarcode);
      if (!book) {
        audioService.playErrorBuzz();
        setKioskError(`Barcode "${scannedBarcode}" not recognized in library. Ask your teacher!`);
        return;
      }

      const success = await performCheckout(book);
      if (success) {
        const msg = settings.celebrationMessage
          .replace('{student}', selectedStudent.firstName)
          .replace('{title}', book.title);

        triggerCelebration(msg);
        await loadData();
      }
    } catch (err: unknown) {
      audioService.playErrorBuzz();
      setKioskError(err instanceof Error ? err.message : 'Error checking out book');
    }
  };

  // Return from student actions screen
  const handleReturnFromProfile = async (loan: Loan) => {
    try {
      await loanRepo.returnLoan(loan.id);
      triggerCelebration(`Thank you for returning "${loan.bookTitle}"!`);
      await loadData();
    } catch (err) {
      console.error(err);
      setKioskError('Error returning book');
    }
  };

  // Browse handlers
  const handleBrowseDetail = (book: Book) => {
    setBrowseDetailBook(book);
    setStep('browse_detail');
    const borrowerNames = browseBorrowersByBook[book.id] ?? [];
    setBrowseDetailBorrowerNames(borrowerNames);
  };

  const browseMaxBooks = settings.maxBooksPerStudent;
  const browseCheckoutDisabledReason = (book: Book): string | null => {
    if (book.availableCopies <= 0) {
      const borrowers = browseBorrowersByBook[book.id] ?? [];
      if (borrowers.length > 0) {
        return `All copies with ${borrowers.join(', ')}`;
      }
      return 'All copies out';
    }
    if (browseLoans.length >= browseMaxBooks) {
      return `You can't check out more than ${browseMaxBooks} books`;
    }
    return null;
  };

  const handleBrowseCheckout = async () => {
    if (!browseDetailBook || !selectedStudent) return;
    const success = await performCheckout(browseDetailBook);
    if (success) {
      // Record session loan locally for swap tray
      const sessionLoan: Loan = {
        id: `session-${browseLoans.length}`,
        libraryId: browseDetailBook!.libraryId,
        bookId: browseDetailBook!.id,
        studentId: selectedStudent!.id,
        studentName: selectedStudent!.firstName,
        bookTitle: browseDetailBook!.title,
        borrowedAt: Date.now(),
        dueDate: null,
        returnedAt: null,
        daysKept: null,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setBrowseLoans([...browseLoans, sessionLoan]);
      await loadData();
      setStep('browse');
    }
  };

  const handleBrowseDone = () => {
    if (browseLoans.length > 0) {
      const msg = settings.celebrationMessage
        .replace('{student}', selectedStudent!.firstName)
        .replace('{title}', 'your books');
      triggerCelebration(msg);
    } else {
      resetToRoster();
    }
  };

  // Scan-First Return Handler
  const handleScanFirstReturn = async (scannedBarcode: string) => {
    setKioskError(null);
    try {
      const book = await bookRepo.getByIsbn(scannedBarcode);
      if (!book) {
        audioService.playErrorBuzz();
        setKioskError(`Barcode "${scannedBarcode}" was not recognized in library.`);
        return;
      }

      const activeLoans = await loanRepo.findActiveLoansByBook(book.id);
      if (activeLoans.length === 0) {
        audioService.playErrorBuzz();
        setKioskError(`"${book.title}" is already marked on the shelf!`);
        return;
      }

      if (activeLoans.length === 1) {
        await loanRepo.returnLoan(activeLoans[0].id);
        triggerCelebration(
          `Thank you for returning "${book.title}", ${activeLoans[0].studentName}!`
        );
        await loadData();
      } else {
        // Multiple borrowers have copies of this book checked out
        setPendingReturnBook(book);
        setCandidateBorrowers(activeLoans);
        setStep('multi_return_select');
      }
    } catch (err) {
      console.error(err);
      setKioskError('Error returning book');
    }
  };

  const handleSelectMultiBorrower = async (loan: Loan) => {
    try {
      await loanRepo.returnLoan(loan.id);
      triggerCelebration(
        `Thank you for returning "${pendingReturnBook?.title}", ${loan.studentName}!`
      );
      await loadData();
    } catch (err) {
      console.error(err);
      setKioskError('Error completing return');
    }
  };

  const getCelebrationEmoji = () => {
    switch (settings.celebrationGraphic) {
      case 'dinosaur':
        return '🦕';
      case 'star':
        return '⭐';
      case 'bookworm':
        return '🐛';
      case 'unicorn':
        return '🦄';
      case 'rocket':
      default:
        return '🚀';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0c0e1e] text-slate-800 dark:text-slate-100 flex flex-col justify-between select-none transition-colors">
      {/* Top Kiosk Header */}
      <header className="bg-white/90 dark:bg-[#181b34]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-[#2a2f5a]">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">📚</span>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {libraryName}
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Student Reading Kiosk</p>
          </div>
        </div>

        {/* Teacher Exit Padlock */}
        <button
          onClick={() => {
            setExitPinError(false);
            setTeacherPinInput('');
            setIsExitDialogOpen(true);
          }}
          className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-[#1f2347] hover:bg-slate-200 dark:hover:bg-[#2b3060] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2a2f5a] flex items-center justify-center transition active:scale-90 cursor-pointer"
          title="Teacher Settings Lock"
        >
          <Lock className="w-5 h-5" />
        </button>
      </header>

      {/* Main Kiosk Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col justify-center items-center">
        {/* Error Alert Box */}
        {kioskError && (
          <div className="mb-6 p-4 bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-3xl max-w-md w-full flex items-center space-x-3 shadow-sm animate-shake">
            <AlertCircle className="w-6 h-6 shrink-0 text-amber-700 dark:text-amber-400" />
            <p className="text-sm font-bold flex-1">{kioskError}</p>
          </div>
        )}

        {/* STEP: CLASS GATE */}
        {step === 'class_gate' && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-8 max-w-sm w-full shadow-xl border border-slate-200 dark:border-[#2a2f5a] text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl mx-auto">
              🔑
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Class Secret Code</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter code to unlock reading kiosk</p>
            </div>

            <form onSubmit={handleVerifyClassGate} className="space-y-4">
              <input
                id="classGatePinInput"
                name="classPin"
                autoComplete="new-password"
                type="password"
                autoFocus
                placeholder="Class Code..."
                value={classGatePin}
                onChange={(e) => setClassGatePin(e.target.value)}
                className={`w-full text-center text-2xl font-black py-3 rounded-2xl border-2 focus:outline-none transition ${
                  classGateError
                    ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    : 'border-slate-200 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white focus:border-indigo-600 dark:focus:border-indigo-400'
                }`}
              />
              {classGateError && (
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Incorrect code. Try again!</p>
              )}
              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-base shadow-md transition active:scale-95 cursor-pointer"
              >
                Unlock Kiosk
              </button>
            </form>
          </div>
        )}

        {/* STEP: STUDENT ROSTER (WHO ARE YOU?) */}
        {step === 'roster' && (
          <div className="w-full space-y-6 text-center">
            <div className="space-y-1">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                👋 Who is checking out?
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-300 font-medium">
                Tap your picture or name to begin!
              </p>
            </div>

            {/* Oversized Student Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-2">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleSelectStudent(student)}
                  className="bg-white dark:bg-[#181b34] hover:bg-indigo-50/50 dark:hover:bg-[#222649] active:scale-95 border-3 border-slate-200 dark:border-[#2a2f5a] hover:border-indigo-500 rounded-3xl p-5 flex flex-col items-center justify-center space-y-3 shadow-md hover:shadow-lg transition cursor-pointer"
                >
                  <span className="text-5xl">{student.avatar}</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate w-full">
                    {student.firstName}
                  </span>
                  {(activeLoanCounts[student.id] ?? 0) > 0 && (
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full">
                      {activeLoanCounts[student.id] ?? 0} checked out
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Return Book Quick Action */}
            <div className="pt-4">
              <button
                onClick={() => {
                  setKioskError(null);
                  setStep('return_scan');
                }}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-base shadow-lg transition inline-flex items-center space-x-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Returning a Book? Tap Here!</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP: STUDENT INDIVIDUAL PIN */}
        {step === 'student_pin' && selectedStudent && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-8 max-w-sm w-full shadow-xl border border-slate-200 dark:border-[#2a2f5a] text-center space-y-6">
            <div className="text-5xl">{selectedStudent.avatar}</div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedStudent.firstName}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter your secret PIN</p>
            </div>

            <form onSubmit={handleVerifyStudentPin} className="space-y-4">
              <input
                id="studentPinInput"
                name="studentPin"
                autoComplete="new-password"
                type="password"
                autoFocus
                placeholder="****"
                value={studentPinInput}
                onChange={(e) => setStudentPinInput(e.target.value)}
                className={`w-full text-center text-3xl font-black py-3 rounded-2xl border-2 focus:outline-none transition ${
                  studentPinError
                    ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    : 'border-slate-200 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white focus:border-indigo-600 dark:focus:border-indigo-400'
                }`}
              />
              {studentPinError && (
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Incorrect PIN. Try again!</p>
              )}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={resetToRoster}
                  className="flex-1 py-3 border border-slate-200 dark:border-[#2a2f5a] rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1f2347] transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-md hover:bg-indigo-700 transition cursor-pointer"
                >
                  Enter
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP: STUDENT ACTIONS / PROFILE */}
        {step === 'student_actions' && selectedStudent && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-8 max-w-xl w-full shadow-xl border border-slate-200 dark:border-[#2a2f5a] space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#2a2f5a]">
              <div className="flex items-center space-x-3">
                <span className="text-4xl">{selectedStudent.avatar}</span>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    Hi, {selectedStudent.firstName}!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ready to read</p>
                </div>
              </div>

              <button
                onClick={resetToRoster}
                aria-label="Back"
                className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-[#1f2347] transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Big Actions: Scan Book or Browse */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  setKioskError(null);
                  setStep('checkout_scan');
                }}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-3xl font-black text-xl flex items-center justify-center space-x-3 shadow-lg shadow-indigo-200 dark:shadow-none transition cursor-pointer"
              >
                <Sparkles className="w-6 h-6 text-amber-300" />
                <span>Scan Book to Check Out</span>
              </button>
              <button
                onClick={() => {
                  setKioskError(null);
                  setStep('browse');
                }}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-semibold text-lg flex items-center justify-center space-x-2 shadow-lg shadow-emerald-200 dark:shadow-none transition cursor-pointer"
              >
                <BookOpen className="w-5 h-5" />
                <span>Find a Book</span>
              </button>
            </div>

            {/* Currently Borrowed Books by this child */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Books Currently With You ({studentLoans.length})
              </h4>
              {studentLoans.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-400 italic">No books checked out right now.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {studentLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="p-3 bg-slate-50 dark:bg-[#0c0e1e] rounded-2xl border border-slate-200 dark:border-[#2a2f5a] flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-800 dark:text-white truncate">
                          {loan.bookTitle}
                        </span>
                      </div>
                      <button
                        onClick={() => handleReturnFromProfile(loan)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 shadow-xs cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Return</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP: CHECKOUT SCANNER */}
        {step === 'checkout_scan' && selectedStudent && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-[#2a2f5a] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2a2f5a]">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{selectedStudent.avatar}</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Scan for {selectedStudent.firstName}
                </h3>
              </div>
              <button
                onClick={() => setStep('student_actions')}
                aria-label="Back"
                className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <BarcodeScanner
              onScan={handleCheckoutScan}
              instructionText="Point camera at barcode on the back of book"
            />
          </div>
        )}

        {/* STEP: BROWSE SHELF */}
        {step === 'browse' && selectedStudent && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-[#2a2f5a] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2a2f5a]">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{selectedStudent.avatar}</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Find a Book for {selectedStudent.firstName}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {browseLoans.length} of {settings.maxBooksPerStudent} books
                </span>
                <button
                  onClick={() => setStep('student_actions')}
                  aria-label="Back"
                  className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Session swap tray */}
            {browseLoans.length > 0 && (
              <div className="bg-slate-50 dark:bg-[#0c0e1e] rounded-2xl p-3 border border-slate-200 dark:border-[#2a2f5a] space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  My Stack — tap a book to swap it out
                </p>
                <div className="flex flex-wrap gap-2">
                  {browseLoans.map((loan) => (
                    <button
                      key={loan.id}
                      onClick={() => {
                        setBrowseDetailBook(null);
                        setBrowseDetailBorrowerNames([]);
                        handleReturnFromProfile(loan);
                      }}
                      className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{loan.bookTitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <BookBrowser
              books={books}
              genres={genres}
              onBookTap={handleBrowseDetail}
              kidMode
              borrowersByBook={browseBorrowersByBook}
              actions={
                <>
                  <button
                    onClick={() => handleBrowseDone()}
                    className="flex-1 sm:flex-none px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-lg font-semibold text-base flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Done</span>
                  </button>
                  <button
                    onClick={() => setStep('student_actions')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 dark:bg-[#1f2347] hover:bg-slate-200 dark:hover:bg-[#2b3060] text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition cursor-pointer"
                  >
                    Back
                  </button>
                </>
              }
              emptyTitle="No books found"
              emptyMessage="Try modifying your search or genre filter."
            />
          </div>
        )}

        {/* STEP: BROWSE DETAIL */}
        {step === 'browse_detail' && selectedStudent && browseDetailBook && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-[#2a2f5a] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2a2f5a]">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{selectedStudent.avatar}</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {browseDetailBook.title}
                </h3>
              </div>
              <button
                onClick={() => setStep('browse')}
                aria-label="Back"
                className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <BookDetailView
              book={browseDetailBook}
              borrowerNames={browseDetailBorrowerNames}
              onBack={() => setStep('browse')}
              onCheckout={handleBrowseCheckout}
              checkoutDisabledReason={browseDetailBook ? browseCheckoutDisabledReason(browseDetailBook) : 'No book selected'}
            />
          </div>
        )}

        {/* STEP: CHECKOUT SCANNER */}
        {step === 'return_scan' && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-[#2a2f5a] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2a2f5a]">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Scan Book to Return</h3>
              <button
                onClick={resetToRoster}
                aria-label="Back"
                className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <BarcodeScanner
              onScan={handleScanFirstReturn}
              instructionText="Point camera at book barcode to return it"
            />
          </div>
        )}

        {/* STEP: MULTI-BORROWER RETURN SELECTION */}
        {step === 'multi_return_select' && pendingReturnBook && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-[#2a2f5a] text-center space-y-4">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Who is returning "{pendingReturnBook.title}"?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multiple students currently hold a copy of this book. Tap your name:
            </p>

            <div className="space-y-2 pt-2">
              {candidateBorrowers.map((loan) => (
                <button
                  key={loan.id}
                  onClick={() => handleSelectMultiBorrower(loan)}
                  className="w-full p-4 bg-slate-50 dark:bg-[#0c0e1e] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-[#2a2f5a] hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl text-left font-bold text-slate-900 dark:text-white flex items-center justify-between transition cursor-pointer"
                >
                  <span>{loan.studentName}</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Confirm Return</span>
                </button>
              ))}
            </div>

            <button
              onClick={resetToRoster}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 pt-2 block mx-auto cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* STEP: CELEBRATION SCREEN */}
        {step === 'celebration' && (
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-10 max-w-md w-full shadow-2xl border-4 border-indigo-200 dark:border-indigo-600/60 text-center space-y-6 animate-bounce-subtle">
            <div className="text-7xl animate-pulse">{getCelebrationEmoji()}</div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Awesome!</h3>
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 leading-snug px-2">
                {celebrationMessage}
              </p>
            </div>

            {/* Countdown Auto-reset progress */}
            <div className="pt-4 flex flex-col items-center space-y-2">
              <div className="w-full bg-slate-100 dark:bg-[#0c0e1e] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-400 h-2 transition-all duration-1000"
                  style={{ width: `${(countdown / 3) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-400 font-semibold">
                Next student in {countdown}s...
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="text-center py-4 text-xs font-semibold text-slate-400 dark:text-slate-500">
        Classroom Library • Reading Kiosk
      </footer>

      {/* Teacher Exit PIN Modal */}
      {isExitDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-slate-200 dark:border-[#2a2f5a] text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#1f2347] text-slate-700 dark:text-slate-300 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Exit Kiosk</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enter Teacher PIN</p>
            </div>

            <form onSubmit={handleVerifyTeacherPin} className="space-y-3">
              <input
                ref={exitPinInputRef}
                id="exitTeacherPinInput"
                name="teacherPin"
                autoComplete="new-password"
                type="password"
                maxLength={6}
                autoFocus
                value={teacherPinInput}
                onChange={(e) => setTeacherPinInput(e.target.value)}
                placeholder="****"
                className={`w-full text-center text-2xl font-bold py-2 rounded-xl border-2 focus:outline-none transition ${
                  exitPinError
                    ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    : 'border-slate-200 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white focus:border-indigo-600 dark:focus:border-indigo-400'
                }`}
              />
              {exitPinError && <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">Incorrect PIN</p>}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExitDialogOpen(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-[#2a2f5a] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1f2347] rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
