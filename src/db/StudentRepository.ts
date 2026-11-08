import { LibraryDatabase, db } from './database';
import { Student } from '../domain/types';

export class StudentRepository {
  private database: LibraryDatabase;

  constructor(database: LibraryDatabase = db) {
    this.database = database;
  }

  private inLibrary(student: Student): boolean {
    const id = this.database.currentLibraryId;
    return id === null || student.libraryId === id;
  }

  async getAll(): Promise<Student[]> {
    return (await this.database.students.orderBy('firstName').toArray()).filter((s) => this.inLibrary(s));
  }

  async getById(id: string): Promise<Student | undefined> {
    return await this.database.students.get(id);
  }

  async create(data: {
    firstName: string;
    avatar?: string;
    color?: string;
    pin?: string;
  }): Promise<Student> {
    const trimmedName = data.firstName.trim();
    if (!trimmedName) {
      throw new Error('Student name cannot be empty');
    }

    const defaultAvatars = ['🐶', '🐱', '🚀', '🦖', '⭐', '🦄', '🦁', '🐼'];
    const defaultColors = ['blue', 'green', 'purple', 'amber', 'rose', 'teal'];

    const libraryId = this.database.currentLibraryId ?? (await this.database.ensureDefaultLibrary()).id;

    const student: Student = {
      id: 'student_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      libraryId,
      firstName: trimmedName,
      avatar: data.avatar || defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)],
      color: data.color || defaultColors[Math.floor(Math.random() * defaultColors.length)],
      pin: data.pin?.trim() || undefined,
      createdAt: Date.now()
    };

    await this.database.students.add(student);
    return student;
  }

  async update(id: string, updates: Partial<Student>): Promise<Student> {
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Student with id ${id} not found`);
    }

    const updated: Student = {
      ...current,
      ...updates,
      id: current.id,
      libraryId: current.libraryId
    };

    await this.database.students.put(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.database.students.delete(id);
  }

  async verifyPin(id: string, enteredPin: string): Promise<boolean> {
    const student = await this.getById(id);
    if (!student || !student.pin) return true;
    return student.pin.trim() === enteredPin.trim();
  }
}
