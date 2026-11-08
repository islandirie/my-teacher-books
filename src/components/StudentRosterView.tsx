import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, BookOpen, Key } from 'lucide-react';
import { Student } from '../domain/types';
import { StudentRepository } from '../db/StudentRepository';
import { LoanRepository } from '../db/LoanRepository';
import { useAlertDialog } from './AlertDialog';

interface StudentRosterViewProps {
  studentRepo: StudentRepository;
  loanRepo: LoanRepository;
}

const AVAILABLE_AVATARS = ['🐶', '🐱', '🚀', '🦖', '⭐', '🦄', '🦁', '🐼', '🦊', '🐬', '🦉', '🐢'];
const AVAILABLE_COLORS = [
  { name: 'blue', bg: 'bg-blue-100 dark:bg-blue-950/40', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300' },
  { name: 'green', bg: 'bg-emerald-100 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300' },
  { name: 'purple', bg: 'bg-purple-100 dark:bg-purple-950/40', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300' },
  { name: 'amber', bg: 'bg-amber-100 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300' },
  { name: 'rose', bg: 'bg-rose-100 dark:bg-rose-950/40', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300' },
  { name: 'teal', bg: 'bg-teal-100 dark:bg-teal-950/40', border: 'border-teal-300 dark:border-teal-700', text: 'text-teal-700 dark:text-teal-300' },
  { name: 'indigo', bg: 'bg-indigo-100 dark:bg-indigo-950/40', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-300' }
];

export const StudentRosterView: React.FC<StudentRosterViewProps> = ({ studentRepo, loanRepo }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [activeLoanCounts, setActiveLoanCounts] = useState<Record<string, number>>({});
  const { dialog, showAlert } = useAlertDialog();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [avatar, setAvatar] = useState(AVAILABLE_AVATARS[0]);
  const [color, setColor] = useState(AVAILABLE_COLORS[0].name);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    const list = await studentRepo.getAll();
    setStudents(list);
    setActiveLoanCounts(await loanRepo.getActiveLoanCounts());
  };

  useEffect(() => {
    loadData();
  }, [studentRepo, loanRepo]);

  const openAddModal = () => {
    setEditingStudent(null);
    setFirstName('');
    setAvatar(AVAILABLE_AVATARS[Math.floor(Math.random() * AVAILABLE_AVATARS.length)]);
    setColor(AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)].name);
    setPin('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFirstName(student.firstName);
    setAvatar(student.avatar);
    setColor(student.color);
    setPin(student.pin || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }

    try {
      if (editingStudent) {
        await studentRepo.update(editingStudent.id, {
          firstName: firstName.trim(),
          avatar,
          color,
          pin: pin.trim() || undefined
        });
      } else {
        await studentRepo.create({
          firstName: firstName.trim(),
          avatar,
          color,
          pin: pin.trim() || undefined
        });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving student');
    }
  };

  const handleDelete = (student: Student) => {
    if ((activeLoanCounts[student.id] ?? 0) > 0) {
      showAlert(`Cannot delete ${student.firstName} because they currently have ${activeLoanCounts[student.id]} book(s) checked out.`);
      return;
    }

    showAlert(`Delete ${student.firstName} from the class roster?`, async () => {
      await studentRepo.delete(student.id);
      await loadData();
    }, 'Delete');
  };

  const getColorClasses = (colorName: string) => {
    const found = AVAILABLE_COLORS.find((c) => c.name === colorName);
    return found || AVAILABLE_COLORS[0];
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-[#181b34] rounded-2xl p-4 border border-slate-200 dark:border-[#2a2f5a] shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Classroom Roster</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {students.length} student{students.length === 1 ? '' : 's'} enrolled
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      {/* Student Grid */}
      {students.length === 0 ? (
        <div className="bg-white dark:bg-[#181b34] rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-[#2a2f5a] space-y-3">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No students yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click "Add Student" to create avatar tiles for your class.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {students.map((student) => {
            const colorClass = getColorClasses(student.color);
            return (
              <div
                key={student.id}
                className={`rounded-2xl border ${colorClass.border} ${colorClass.bg} p-4 flex flex-col items-center text-center justify-between shadow-xs hover:shadow-md transition`}
              >
                <div className="text-4xl mb-2">{student.avatar}</div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate w-full">
                  {student.firstName}
                </h4>

                <div className="mt-2 flex items-center space-x-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{activeLoanCounts[student.id] ?? 0} out</span>
                  {student.pin && (
                    <span title="PIN Protected">
                      <Key className="w-3 h-3 text-amber-500 ml-1" />
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-center space-x-2 w-full">
                  <button
                    onClick={() => openEditModal(student)}
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-white/60 dark:hover:bg-white/10 transition cursor-pointer"
                    title="Edit student"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(student)}
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-white/60 dark:hover:bg-white/10 transition cursor-pointer"
                    title="Delete student"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181b34] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-[#2a2f5a] space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingStudent ? 'Edit Student' : 'Add New Student'}
            </h3>

            {error && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  First Name & Last Initial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mia K."
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Choose Avatar Icon
                </label>
                <div className="grid grid-cols-6 gap-2 p-2 bg-slate-50 dark:bg-[#0c0e1e] rounded-2xl border border-slate-200 dark:border-[#2a2f5a]">
                  {AVAILABLE_AVATARS.map((av) => (
                    <button
                      key={av}
                      type="button"
                      aria-label={`Choose avatar ${av}`}
                      onClick={() => setAvatar(av)}
                      className={`text-2xl p-1.5 rounded-xl transition cursor-pointer ${
                        avatar === av ? 'bg-indigo-600 shadow-md scale-110' : 'hover:bg-slate-200 dark:hover:bg-[#1f2347]'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Badge Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Badge Color
                </label>
                <div className="flex space-x-2">
                  {AVAILABLE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      aria-label={`Choose badge color ${c.name}`}
                      onClick={() => setColor(c.name)}
                      className={`flex-1 h-8 rounded-xl border-2 ${c.bg} transition cursor-pointer ${
                        color === c.name ? 'border-indigo-600 dark:border-indigo-400 scale-105' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Optional PIN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Optional PIN (Leave blank if none)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1234 or red-blue-green"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-[#2a2f5a]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-[#2a2f5a] text-slate-600 dark:text-slate-300 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-[#1f2347] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dialog}
    </div>
  );
};
