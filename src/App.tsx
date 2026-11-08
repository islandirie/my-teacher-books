import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from './db/database';
import { BookRepository } from './db/BookRepository';
import { StudentRepository } from './db/StudentRepository';
import { LoanRepository } from './db/LoanRepository';
import { SettingsRepository } from './db/SettingsRepository';
import { LibraryRepository, DEFAULT_LIBRARY_ID_KEY } from './db/LibraryRepository';
import { ClassSettings, AppSettings, Library, DEFAULT_APP_SETTINGS } from './domain/types';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentKiosk } from './components/StudentKiosk';
import { TeacherPinGate } from './components/TeacherPinGate';
import { createGoogleAuthService, GoogleAuthService } from './services/GoogleAuthService';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export function App() {
  const [mode, setMode] = useState<'admin' | 'kiosk'>('admin');
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [activeLibrary, setActiveLibrary] = useState<Library | null>(null);
  const [settings, setSettings] = useState<ClassSettings | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('teacherUnlocked') === 'true');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthService | null>(null);

  const bookRepo = useMemo(() => new BookRepository(db), []);
  const studentRepo = useMemo(() => new StudentRepository(db), []);
  const loanRepo = useMemo(() => new LoanRepository(db, bookRepo, studentRepo), [bookRepo, studentRepo]);
  const settingsRepo = useMemo(() => new SettingsRepository(db), []);
  const libraryRepo = useMemo(() => new LibraryRepository(db), []);

  const refreshSettings = useCallback(async () => {
    if (!db.currentLibraryId) return;
    const [s, a] = await Promise.all([settingsRepo.getSettings(), settingsRepo.getAppSettings()]);
    setSettings(s);
    setAppSettings(a);
  }, [settingsRepo]);

  const loadActiveLibrary = useCallback(
    async (preferredId?: string | null) => {
      const libs = await libraryRepo.getAll();
      setLibraries(libs);
      let lib = preferredId ? libs.find((l) => l.id === preferredId) : undefined;
      if (!lib) lib = libs[0] ?? (await libraryRepo.create('Library 1'));
      db.currentLibraryId = lib.id;
      setActiveLibrary(lib);
      await refreshSettings();
    },
    [libraryRepo, refreshSettings]
  );

  const switchLibrary = useCallback(
    async (libraryId: string) => {
      localStorage.setItem(DEFAULT_LIBRARY_ID_KEY, libraryId);
      await loadActiveLibrary(libraryId);
    },
    [loadActiveLibrary]
  );

  const createLibrary = useCallback(
    async (name: string) => {
      const lib = await libraryRepo.create(name);
      await loadActiveLibrary(lib.id);
      return lib;
    },
    [libraryRepo, loadActiveLibrary]
  );

  const renameLibrary = useCallback(
    async (name: string) => {
      if (!activeLibrary) return;
      const lib = await libraryRepo.rename(activeLibrary.id, name);
      setActiveLibrary(lib);
      setLibraries(await libraryRepo.getAll());
    },
    [activeLibrary, libraryRepo]
  );

  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme]);

  useEffect(() => {
    createGoogleAuthService().then(setGoogleAuth);
  }, []);

  const handleToggleTheme = async () => {
    if (!settings) return;
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = await settingsRepo.updateSettings({ theme: nextTheme });
    setSettings(updated);
  };

  const handleUnlock = () => {
    sessionStorage.setItem('teacherUnlocked', 'true');
    setUnlocked(true);
  };

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  useEffect(() => {
    const storedId = localStorage.getItem(DEFAULT_LIBRARY_ID_KEY);
    loadActiveLibrary(storedId).then(() => setIsLoaded(true));
  }, [loadActiveLibrary]);

  if (!isLoaded || !activeLibrary || !settings) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c0e1e] flex items-center justify-center p-6 text-slate-500 dark:text-slate-400 font-medium text-sm">
        Loading classroom library...
      </div>
    );
  }

  if (mode === 'kiosk') {
    return (
      <StudentKiosk
        settings={settings}
        libraryName={activeLibrary.name}
        teacherPin={appSettings.teacherPin}
        bookRepo={bookRepo}
        studentRepo={studentRepo}
        loanRepo={loanRepo}
        onExitKiosk={() => setMode('admin')}
      />
    );
  }

  if (!unlocked) {
    return <TeacherPinGate teacherPin={appSettings.teacherPin} onUnlock={handleUnlock} />;
  }

  return (
    <TeacherDashboard
      settings={settings}
      libraries={libraries}
      activeLibrary={activeLibrary}
      googleAuth={googleAuth}
      bookRepo={bookRepo}
      studentRepo={studentRepo}
      loanRepo={loanRepo}
      settingsRepo={settingsRepo}
      onSwitchLibrary={switchLibrary}
      onCreateLibrary={createLibrary}
      onRenameLibrary={renameLibrary}
      onLaunchKiosk={() => setMode('kiosk')}
      onRefreshSettings={refreshSettings}
      onToggleTheme={handleToggleTheme}
      canInstall={installPrompt !== null}
      onInstall={handleInstall}
    />
  );
}

export default App;
