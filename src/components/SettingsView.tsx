import React, { useState, useEffect } from 'react';
import { Save, Download, Upload, Shield, RefreshCw, FileText, CheckCircle, Palette, Cloud, LogOut } from 'lucide-react';
import { ClassSettings, CelebrationGraphic, KioskAuthMode, AppTheme, AppSettings, Library } from '../domain/types';
import { SettingsRepository } from '../db/SettingsRepository';
import { BookRepository } from '../db/BookRepository';
import { LoanRepository } from '../db/LoanRepository';
import { dataSyncService } from '../services/DataSyncService';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { GoogleSyncService } from '../services/GoogleSyncService';
import { db } from '../db/database';
import { audioService } from '../services/AudioService';
import { useAlertDialog } from './AlertDialog';

interface SettingsViewProps {
  settingsRepo: SettingsRepository;
  bookRepo: BookRepository;
  loanRepo: LoanRepository;
  library: Library;
  googleAuth: GoogleAuthService | null;
  onSettingsSaved?: () => void;
}

const CELEBRATION_OPTIONS: { id: CelebrationGraphic; label: string; icon: string }[] = [
  { id: 'rocket', label: 'Rocket', icon: '🚀' },
  { id: 'dinosaur', label: 'Dinosaur', icon: '🦕' },
  { id: 'star', label: 'Star', icon: '⭐' },
  { id: 'bookworm', label: 'Bookworm', icon: '📚' },
  { id: 'unicorn', label: 'Unicorn', icon: '🦄' }
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settingsRepo,
  bookRepo,
  loanRepo,
  library,
  googleAuth,
  onSettingsSaved
}) => {
  const [settings, setSettings] = useState<ClassSettings | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { dialog, showAlert } = useAlertDialog();

  useEffect(() => {
    Promise.all([settingsRepo.getSettings(), settingsRepo.getAppSettings()]).then(([s, a]) => {
      setSettings(s);
      setAppSettings(a);
      audioService.setEnabled(s.celebrationSound);
    });
  }, [settingsRepo, library.id]);

  useEffect(() => {
    setSignedIn(googleAuth?.isSignedIn() ?? false);
  }, [googleAuth]);

  if (!settings || !appSettings) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await settingsRepo.updateSettings(settings);
      await settingsRepo.updateAppSettings({ teacherPin: appSettings.teacherPin });
      setSettings(updated);
      audioService.setEnabled(updated.celebrationSound);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onSettingsSaved) onSettingsSaved();
    } catch (err) {
      console.error(err);
      showAlert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectTheme = async (theme: AppTheme) => {
    if (!settings) return;
    const updated: ClassSettings = { ...settings, theme };
    setSettings(updated);
    try {
      await settingsRepo.updateSettings({ theme });
      if (onSettingsSaved) onSettingsSaved();
    } catch (err) {
      console.error('Failed to update theme:', err);
    }
  };

  const handleExportBooksCsv = async () => {
    const books = await bookRepo.getAll();
    const csv = dataSyncService.exportBooksToCsv(books);
    dataSyncService.downloadFile(csv, `library_books_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const handleExportLoansCsv = async () => {
    const loans = await loanRepo.getAllLoans();
    const csv = dataSyncService.exportLoansToCsv(loans);
    dataSyncService.downloadFile(csv, `library_loans_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const handleExportJsonBackup = async () => {
    const json = await dataSyncService.exportFullJsonBackup();
    dataSyncService.downloadFile(json, `my_teacher_books_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const handleImportBooksCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const parsed = dataSyncService.parseBooksFromCsv(text);
        if (parsed.length === 0) {
          showAlert('No valid book rows found in CSV');
          return;
        }

        let addedCount = 0;
        let updatedCount = 0;
        for (const item of parsed) {
          const existing = item.isbn ? await bookRepo.getByIsbn(item.isbn) : undefined;
          if (existing) {
            await bookRepo.update(existing.id, item);
            updatedCount++;
          } else {
            await bookRepo.create(item);
            addedCount++;
          }
        }
        showAlert(`Imported ${addedCount} new book(s), updated ${updatedCount} existing.`);
      } catch (err) {
        console.error(err);
        showAlert('Error parsing CSV file');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result as string;
      showAlert('Restoring will replace current classroom data with the backup file. Proceed?', async () => {
        try {
          const stats = await dataSyncService.restoreFullJsonBackup(text);
          showAlert(`Restore complete: ${stats.booksCount} books, ${stats.studentsCount} students, ${stats.loansCount} loans.`, () => window.location.reload(), 'Reload');
        } catch (err) {
          console.error(err);
          showAlert('Failed to restore backup file');
        }
      }, 'Restore');
    };
    reader.readAsText(file);
  };

  const handleGoogleSync = async () => {
    if (!settings.googleSheetWebhookUrl) {
      showAlert('Please enter a valid Google Apps Script Webhook URL first.');
      return;
    }

    setSyncStatus('Syncing with Google Sheets...');
    try {
      const [books, loans] = await Promise.all([bookRepo.getAll(), loanRepo.getAllLoans()]);
      const res = await dataSyncService.syncToGoogleSheetsWebhook(
        settings.googleSheetWebhookUrl,
        books,
        loans,
        settings.includeWhoCheckedOut
      );
      setSyncStatus(res.message);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      setSyncStatus(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleAuth) return;
    setGoogleStatus('Signing in...');
    try {
      const { email } = await googleAuth.signIn();
      setSignedIn(true);
      setGoogleStatus(`Signed in${email ? ` as ${email}` : ''}.`);
    } catch (err) {
      setGoogleStatus(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  const handleGoogleSignOut = () => {
    googleAuth?.signOut();
    setSignedIn(false);
    setGoogleStatus(null);
  };

  const handleTwoWaySync = async () => {
    if (!googleAuth) return;
    if (!googleAuth.isSignedIn()) {
      setGoogleStatus('Sign in with Google to sync this library across devices.');
      await handleGoogleSignIn();
      return;
    }
    setIsSyncing(true);
    setGoogleStatus('Syncing...');
    try {
      const sync = new GoogleSyncService(db, googleAuth, new GoogleSheetsService());
      const summary = await sync.syncNow(library);
      setGoogleStatus(`Synced ${summary.booksCount} book(s)${summary.loansCount ? ` and ${summary.loansCount} loan(s)` : ''}.`);
      if (onSettingsSaved) onSettingsSaved();
    } catch (err) {
      setGoogleStatus(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Appearance & Theme */}
        <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 border border-slate-200 dark:border-[#2a2f5a] shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 pb-2 border-b border-slate-100 dark:border-[#2a2f5a] font-bold">
            <Palette className="w-5 h-5" />
            <h3 className="text-base text-slate-900 dark:text-white">Appearance & Theme</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Visual Theme Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
              <button
                type="button"
                onClick={() => handleSelectTheme('light')}
                className={`p-4 rounded-2xl border text-left transition flex items-center space-x-3 cursor-pointer ${
                  settings.theme !== 'dark'
                    ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/40 text-indigo-950 dark:text-white shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-[#2a2f5a] hover:bg-slate-50 dark:hover:bg-[#1f2347] text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-xs shrink-0">☀️</div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Light Theme</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Crisp daylight classroom palette</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTheme('dark')}
                className={`p-4 rounded-2xl border text-left transition flex items-center space-x-3 cursor-pointer ${
                  settings.theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-900/40 text-white shadow-xs ring-2 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-[#2a2f5a] hover:bg-slate-50 dark:hover:bg-[#1f2347] text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#0c0e1e] border border-[#2a2f5a] flex items-center justify-center text-xl shadow-xs shrink-0">🌙</div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Midnight Dark</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Eye-friendly bluish/purple tint</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 border border-slate-200 dark:border-[#2a2f5a] shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 pb-2 border-b border-slate-100 dark:border-[#2a2f5a] font-bold">
            <Shield className="w-5 h-5" />
            <h3 className="text-base text-slate-900 dark:text-white">Security Settings</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Teacher Admin PIN (to exit Kiosk)
              </label>
              <input
                type="password"
                maxLength={6}
                value={appSettings.teacherPin}
                onChange={(e) => setAppSettings({ ...appSettings, teacherPin: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Kiosk Student Entry Mode
              </label>
              <select
                value={settings.kioskAuthMode}
                onChange={(e) => setSettings({ ...settings, kioskAuthMode: e.target.value as KioskAuthMode })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="class_pin">Class-Wide Gate PIN</option>
                <option value="student_pin">Individual Student PIN</option>
                <option value="open">Open (Tap Name Directly)</option>
              </select>
            </div>
          </div>

          {settings.kioskAuthMode === 'class_pin' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Class Gate PIN (Code or colors)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1234 or blue-yellow"
                  value={settings.classPin}
                  onChange={(e) => setSettings({ ...settings, classPin: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Loan Rules & Limits */}
        <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 border border-slate-200 dark:border-[#2a2f5a] shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2f5a]">
            Loan Policies
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Default Loan Period
              </label>
              <select
                value={settings.loanPeriodDays}
                onChange={(e) => setSettings({ ...settings, loanPeriodDays: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={7}>7 Days (1 Week)</option>
                <option value={14}>14 Days (2 Weeks)</option>
                <option value={21}>21 Days (3 Weeks)</option>
                <option value={0}>No Due Date (Keep until returned)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Max Books Borrowed Per Student
              </label>
              <select
                value={settings.maxBooksPerStudent}
                onChange={(e) => setSettings({ ...settings, maxBooksPerStudent: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={1}>1 Book at a time</option>
                <option value={2}>2 Books at a time</option>
                <option value={3}>3 Books at a time</option>
                <option value={5}>5 Books at a time</option>
                <option value={0}>Unlimited</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Max Copies Per Book
              </label>
              <input
                id="maxCopiesPerBook"
                name="maxCopiesPerBook"
                type="number"
                value={settings.maxCopiesPerBook}
                onChange={(e) => setSettings({ ...settings, maxCopiesPerBook: parseInt(e.target.value, 10) || 10 })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Upper limit for copy counts when adding or editing books.</p>
            </div>
          </div>

          <div className="flex items-start space-x-3 pt-2">
            <input
              type="checkbox"
              id="includeWhoCheckedOut"
              checked={settings.includeWhoCheckedOut}
              onChange={(e) => setSettings({ ...settings, includeWhoCheckedOut: e.target.checked })}
              className="w-4 h-4 mt-0.5 text-indigo-600 rounded-sm focus:ring-indigo-500"
            />
            <div>
              <label htmlFor="includeWhoCheckedOut" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Include who checked out each book (shares first name + last initial with your Google Sheet)
              </label>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Off by default. When on, a school Google account is recommended.
              </p>
            </div>
          </div>
        </div>

        {/* Student Kiosk Celebration Theme */}
        <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 border border-slate-200 dark:border-[#2a2f5a] shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-[#2a2f5a]">
            Kiosk Celebration & Feedback
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Celebration Graphic
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CELEBRATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, celebrationGraphic: opt.id })}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center space-y-1 cursor-pointer ${
                    settings.celebrationGraphic === opt.id
                      ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/40 shadow-xs scale-105'
                      : 'border-slate-200 dark:border-[#2a2f5a] hover:bg-slate-50 dark:hover:bg-[#1f2347]'
                  }`}
                >
                  <span className="text-3xl">{opt.icon}</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <input
              type="checkbox"
              id="soundToggle"
              checked={settings.celebrationSound}
              onChange={(e) => setSettings({ ...settings, celebrationSound: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500"
            />
            <label htmlFor="soundToggle" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Play cheerful synthesizer audio chime on checkout and return
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Celebration Message Template
            </label>
            <input
              type="text"
              value={settings.celebrationMessage}
              onChange={(e) => setSettings({ ...settings, celebrationMessage: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Use {'{student}'} and {'{title}'} placeholders to personalize.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          {saveSuccess ? (
            <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Settings saved successfully!</span>
            </div>
          ) : <div />}

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-sm transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Google Account Sync (two-way, opt-in) */}
      {googleAuth && (
        <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 border border-slate-200 dark:border-[#2a2f5a] shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 pb-2 border-b border-slate-100 dark:border-[#2a2f5a] font-bold">
            <Cloud className="w-5 h-5" />
            <h3 className="text-base text-slate-900 dark:text-white">Google Account Sync</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in with Google to keep this library's books (and, if enabled, loans) in sync across your devices through your own Google Sheet. Sync runs only when you tap "Sync Now".
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {signedIn ? (
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="px-4 py-2 border border-slate-200 dark:border-[#2a2f5a] text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold flex items-center space-x-1.5 transition hover:bg-slate-50 dark:hover:bg-[#1f2347] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="px-4 py-2 bg-white dark:bg-[#1f2347] border border-slate-200 dark:border-[#2a2f5a] text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition hover:bg-slate-50 dark:hover:bg-[#2b3060] cursor-pointer"
              >
                Sign in with Google
              </button>
            )}
            <button
              type="button"
              onClick={handleTwoWaySync}
              disabled={isSyncing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
          {googleStatus && (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-100 dark:border-emerald-800">
              {googleStatus}
            </p>
          )}
        </div>
      )}

      {/* Optional Google Sheets Webhook */}
      <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 border border-slate-200 dark:border-[#2a2f5a] shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 pb-2 border-b border-slate-100 dark:border-[#2a2f5a] font-bold">
          <RefreshCw className="w-5 h-5" />
          <h3 className="text-base text-slate-900 dark:text-white">Optional Google Sheets Webhook (one-way, no sign-in)</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Paste your Google Apps Script Web App URL to push this library's catalog and circulation rows to your Google Sheet without any sign-in.
        </p>

        <div className="flex space-x-2">
          <input
            type="url"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={settings.googleSheetWebhookUrl}
            onChange={(e) => setSettings({ ...settings, googleSheetWebhookUrl: e.target.value })}
            className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleGoogleSync}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Now</span>
          </button>
        </div>
        {syncStatus && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-100 dark:border-emerald-800">
            {syncStatus}
          </p>
        )}
      </div>

      {/* Backup, Restore & Data Portability */}
      <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 border border-slate-200 dark:border-[#2a2f5a] shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-[#2a2f5a] font-bold">
          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-base text-slate-900 dark:text-white">Data Backup & Migration</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Export your library anytime. All data stays local to your device and can be backed up or transferred to any other phone or tablet.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBooksCsv}
            className="p-3 bg-slate-50 dark:bg-[#1f2347] hover:bg-slate-100 dark:hover:bg-[#2b3060] border border-slate-200 dark:border-[#2a2f5a] rounded-2xl text-left flex items-center space-x-3 transition cursor-pointer"
          >
            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">Export Books (CSV)</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Spreadsheet of your catalog</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleExportLoansCsv}
            className="p-3 bg-slate-50 dark:bg-[#1f2347] hover:bg-slate-100 dark:hover:bg-[#2b3060] border border-slate-200 dark:border-[#2a2f5a] rounded-2xl text-left flex items-center space-x-3 transition cursor-pointer"
          >
            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">Export Loan History (CSV)</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">All checkout activity</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleExportJsonBackup}
            className="p-3 bg-slate-50 dark:bg-[#1f2347] hover:bg-slate-100 dark:hover:bg-[#2b3060] border border-slate-200 dark:border-[#2a2f5a] rounded-2xl text-left flex items-center space-x-3 transition cursor-pointer"
          >
            <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">Download Full Backup (JSON)</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Complete database snapshot</p>
            </div>
          </button>

          <label className="p-3 bg-slate-50 dark:bg-[#1f2347] hover:bg-slate-100 dark:hover:bg-[#2b3060] border border-slate-200 dark:border-[#2a2f5a] rounded-2xl text-left flex items-center space-x-3 cursor-pointer transition">
            <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">Import Books (CSV)</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Add or bulk-import titles</p>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleImportBooksCsv}
              className="hidden"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-[#2a2f5a]">
          <label className="inline-flex items-center space-x-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Restore Entire Database from JSON Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreJsonBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {dialog}
    </div>
  );
};
