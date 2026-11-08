import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LibraryDatabase } from './database';
import { SettingsRepository } from './SettingsRepository';

describe('SettingsRepository', () => {
  let db: LibraryDatabase;
  let repo: SettingsRepository;

  beforeEach(() => {
    db = new LibraryDatabase('TestSettingsDB_' + Math.random().toString(36).substring(7));
    repo = new SettingsRepository(db);
  });

  it('retrieves defaults, keeps the teacher PIN app-level, and verifies it', async () => {
    const settings = await repo.getSettings();
    expect(settings.celebrationGraphic).toBe('rocket');
    expect(settings.theme).toBe('dark');

    const app = await repo.getAppSettings();
    expect(app.teacherPin).toBe('1234');

    expect(await repo.verifyTeacherPin('1234')).toBe(true);
    expect(await repo.verifyTeacherPin('0000')).toBe(false);

    await repo.updateSettings({ celebrationGraphic: 'dinosaur', loanPeriodDays: 14 });
    const updated = await repo.getSettings();
    expect(updated.celebrationGraphic).toBe('dinosaur');
    expect(updated.loanPeriodDays).toBe(14);

    await repo.updateAppSettings({ teacherPin: '5678' });
    expect(await repo.verifyTeacherPin('5678')).toBe(true);
    expect(await repo.verifyTeacherPin('1234')).toBe(false);
  });
});
