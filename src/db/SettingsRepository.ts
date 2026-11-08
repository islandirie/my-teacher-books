import { LibraryDatabase, db } from './database';
import { ClassSettings, AppSettings } from '../domain/types';

export class SettingsRepository {
  private database: LibraryDatabase;

  constructor(database: LibraryDatabase = db) {
    this.database = database;
  }

  private async resolveLibraryId(): Promise<string> {
    if (this.database.currentLibraryId) return this.database.currentLibraryId;
    return (await this.database.ensureDefaultLibrary()).id;
  }

  async getSettings(): Promise<ClassSettings> {
    return await this.database.getSettings(await this.resolveLibraryId());
  }

  async updateSettings(updates: Partial<Omit<ClassSettings, 'id'>>): Promise<ClassSettings> {
    return await this.database.updateSettings(await this.resolveLibraryId(), updates);
  }

  async getAppSettings(): Promise<AppSettings> {
    return await this.database.getAppSettings();
  }

  async updateAppSettings(updates: Partial<Omit<AppSettings, 'id'>>): Promise<AppSettings> {
    return await this.database.updateAppSettings(updates);
  }

  async verifyTeacherPin(pin: string): Promise<boolean> {
    const settings = await this.getAppSettings();
    return settings.teacherPin.trim() === pin.trim();
  }

  async verifyClassPin(pin: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (settings.kioskAuthMode === 'open') return true;
    return settings.classPin.trim() === pin.trim();
  }
}
