import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Users, Clock, Settings, Sparkles, Moon, Sun, Download, Library as LibraryIcon, Plus, Pencil } from 'lucide-react';
import { BookRepository } from '../db/BookRepository';
import { StudentRepository } from '../db/StudentRepository';
import { LoanRepository } from '../db/LoanRepository';
import { SettingsRepository } from '../db/SettingsRepository';
import { ClassSettings, Library } from '../domain/types';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { BookCatalogView } from './BookCatalogView';
import { StudentRosterView } from './StudentRosterView';
import { CirculationView } from './CirculationView';
import { SettingsView } from './SettingsView';

interface TeacherDashboardProps {
  settings: ClassSettings;
  libraries: Library[];
  activeLibrary: Library;
  googleAuth: GoogleAuthService | null;
  bookRepo: BookRepository;
  studentRepo: StudentRepository;
  loanRepo: LoanRepository;
  settingsRepo: SettingsRepository;
  onSwitchLibrary: (libraryId: string) => void;
  onCreateLibrary: (name: string) => void;
  onRenameLibrary: (name: string, libraryId?: string) => void;
  onLaunchKiosk: () => void;
  onRefreshSettings: () => void;
  onToggleTheme?: () => void;
  canInstall: boolean;
  onInstall: () => void;
}

type TabType = 'catalog' | 'roster' | 'loans' | 'settings';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  settings,
  libraries,
  activeLibrary,
  googleAuth,
  bookRepo,
  studentRepo,
  loanRepo,
  settingsRepo,
  onSwitchLibrary,
  onCreateLibrary,
  onRenameLibrary,
  onLaunchKiosk,
  onRefreshSettings,
  onToggleTheme,
  canInstall,
  onInstall
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('catalog');
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [libraryNameInput, setLibraryNameInput] = useState('');
  const [isLibraryPopoverOpen, setIsLibraryPopoverOpen] = useState(false);
  const [renamingLibraryId, setRenamingLibraryId] = useState<string | null>(null);
  const tabRefs = useRef<Record<TabType, HTMLButtonElement | null>>({ catalog: null, roster: null, loans: null, settings: null });
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    if (!isLibraryPopoverOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsLibraryPopoverOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [isLibraryPopoverOpen]);

  const openCreate = () => {
    setIsRenaming(false);
    setLibraryNameInput('');
    setIsLibraryModalOpen(true);
  };

  const openRename = () => {
    setIsRenaming(true);
    setLibraryNameInput(activeLibrary.name);
    setRenamingLibraryId(activeLibrary.id);
    setIsLibraryModalOpen(true);
  };

  const openRenameFor = (lib: Library) => {
    setIsRenaming(true);
    setLibraryNameInput(lib.name);
    setRenamingLibraryId(lib.id);
    setIsLibraryModalOpen(true);
    setIsLibraryPopoverOpen(false);
  };

  const submitLibrary = (e: React.FormEvent) => {
    e.preventDefault();
    const name = libraryNameInput.trim();
    if (!name) return;
    if (isRenaming) onRenameLibrary(name, renamingLibraryId ?? undefined);
    else onCreateLibrary(name);
    setIsLibraryModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0e1e] text-slate-800 dark:text-slate-100 flex flex-col transition-colors">
      <header className="bg-white dark:bg-[#181b34] border-b border-slate-200 dark:border-[#2a2f5a] sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
              📚
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                {activeLibrary.name}
              </h1>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Teacher Admin
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {canInstall && (
              <button
                type="button"
                onClick={onInstall}
                className="px-3 py-2 bg-slate-50 dark:bg-[#1f2347] hover:bg-slate-100 dark:hover:bg-[#2b3060] border border-slate-200 dark:border-[#2a2f5a] text-indigo-600 dark:text-indigo-400 rounded-2xl text-sm font-bold flex items-center space-x-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                title={settings.theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                aria-label="Toggle theme"
                className="p-2.5 rounded-2xl border border-slate-200 dark:border-[#2a2f5a] bg-slate-50 dark:bg-[#1f2347] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2b3060] transition cursor-pointer"
              >
                {settings.theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-600" />
                )}
              </button>
            )}

            <button
              onClick={onLaunchKiosk}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold flex items-center space-x-2 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Launch Student Kiosk</span>
              <span className="sm:hidden">Kiosk</span>
            </button>
          </div>
        </div>

        {/* Desktop: Library switcher + tab strip */}
        <div className="hidden sm:flex max-w-6xl mx-auto px-4 pb-2 items-center justify-between gap-2 border-t border-slate-100 dark:border-[#2a2f5a]">
          <div className="flex items-center space-x-1">
            <LibraryIcon className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              aria-label="Switch library"
              value={activeLibrary.id}
              onChange={(e) => onSwitchLibrary(e.target.value)}
              className="px-2 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-[#0c0e1e] border border-slate-200 dark:border-[#2a2f5a] text-slate-700 dark:text-slate-200 rounded-lg focus:outline-none cursor-pointer"
            >
              {libraries.map((lib) => (
                <option key={lib.id} value={lib.id}>
                  {lib.name}
                </option>
              ))}
            </select>
            <button
              onClick={openRename}
              title="Rename library"
              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1f2347] transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={openCreate}
              className="px-2 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-[#1f2347] rounded-lg flex items-center space-x-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Library</span>
            </button>
          </div>

          <div className="flex space-x-1 overflow-x-auto">
            {(['catalog', 'roster', 'loans', 'settings'] as TabType[]).map((tab) => {
              const icons: Record<TabType, React.ReactNode> = {
                catalog: <BookOpen className="w-4 h-4" />,
                roster: <Users className="w-4 h-4" />,
                loans: <Clock className="w-4 h-4" />,
                settings: <Settings className="w-4 h-4" />
              };
              const labels: Record<TabType, string> = {
                catalog: 'Books',
                roster: 'Roster',
                loans: 'Loans',
                settings: 'Settings'
              };
              return (
                <button
                  key={tab}
                  ref={(el) => { tabRefs.current[tab] = el; }}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {icons[tab]}
                  <span>{labels[tab]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile: icon row + add library button */}
        <div className="sm:hidden max-w-6xl mx-auto px-2 pb-2 border-t border-slate-100 dark:border-[#2a2f5a]">
          <div className="relative">
            <div className="flex justify-around items-center py-2">
              <button
                onClick={() => setIsLibraryPopoverOpen(!isLibraryPopoverOpen)}
                className={`p-2 border-b-2 transition cursor-pointer ${isLibraryPopoverOpen ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
                aria-label="Switch library"
              >
                <LibraryIcon className="w-5 h-5" />
              </button>
              {(['catalog', 'roster', 'loans', 'settings'] as TabType[]).map((tab) => {
                const icons: Record<TabType, React.ReactNode> = {
                  catalog: <BookOpen className="w-5 h-5" />,
                  roster: <Users className="w-5 h-5" />,
                  loans: <Clock className="w-5 h-5" />,
                  settings: <Settings className="w-5 h-5" />
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    aria-label={tab}
                    className={`p-2 border-b-2 transition cursor-pointer ${
                      activeTab === tab
                        ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {icons[tab]}
                  </button>
                );
              })}
            </div>

            {isLibraryPopoverOpen && (
                <div
                  ref={popoverRef}
                  className="absolute top-full left-2 right-2 z-50 mt-1 bg-white dark:bg-[#181b34] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2a2f5a] py-1"
                >
                  {libraries.map((lib) => (
                    <div
                      key={lib.id}
                      className="flex items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#1f2347] transition"
                    >
                      <button
                        onClick={() => { onSwitchLibrary(lib.id); setIsLibraryPopoverOpen(false); }}
                        className="flex-1 text-left text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        {lib.name}
                      </button>
                      <button
                        onClick={() => openRenameFor(lib)}
                        aria-label={`Rename ${lib.name}`}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <span className={`w-2 h-2 rounded-full ml-1.5 shrink-0 ${lib.id === activeLibrary.id ? 'bg-emerald-500' : 'bg-transparent'}`} />
                    </div>
                  ))}
              </div>
            )}
          </div>

          <button
            onClick={openCreate}
            className="w-full mt-2 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-[#1f2347] hover:bg-indigo-100 dark:hover:bg-[#2b3060] rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Library</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto p-4 md:p-6 flex-1">
        {activeTab === 'catalog' && (
          <BookCatalogView key={activeLibrary.id} bookRepo={bookRepo} loanRepo={loanRepo} maxCopiesPerBook={settings.maxCopiesPerBook} />
        )}
        {activeTab === 'roster' && <StudentRosterView key={activeLibrary.id} studentRepo={studentRepo} loanRepo={loanRepo} />}
        {activeTab === 'loans' && <CirculationView key={activeLibrary.id} loanRepo={loanRepo} bookRepo={bookRepo} />}
        {activeTab === 'settings' && (
          <SettingsView
            key={activeLibrary.id}
            settingsRepo={settingsRepo}
            bookRepo={bookRepo}
            loanRepo={loanRepo}
            library={activeLibrary}
            googleAuth={googleAuth}
            onSettingsSaved={onRefreshSettings}
          />
        )}
      </main>

      {/* Create / rename library modal */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181b34] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-[#2a2f5a] space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isRenaming ? 'Rename Library' : 'New Library'}
            </h3>
            <form onSubmit={submitLibrary} className="space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Home Shelf"
                value={libraryNameInput}
                onChange={(e) => setLibraryNameInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLibraryModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-[#2a2f5a] text-slate-600 dark:text-slate-300 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-[#1f2347] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition cursor-pointer"
                >
                  {isRenaming ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
