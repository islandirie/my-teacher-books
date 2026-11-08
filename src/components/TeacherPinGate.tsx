import React, { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface TeacherPinGateProps {
  teacherPin: string;
  onUnlock: () => void;
}

export const TeacherPinGate: React.FC<TeacherPinGateProps> = ({ teacherPin, onUnlock }) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pinError) pinInputRef.current?.focus();
  }, [pinError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === teacherPin.trim()) {
      onUnlock();
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0e1e] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#181b34] rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-slate-200 dark:border-[#2a2f5a] text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#1f2347] text-slate-700 dark:text-slate-300 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Teacher Dashboard</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Enter Teacher PIN</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={pinInputRef}
            id="teacherPinInput"
            name="teacherPin"
            autoComplete="new-password"
            type="password"
            maxLength={6}
            autoFocus
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              setPinError(false);
            }}
            placeholder="****"
            className={`w-full text-center text-2xl font-bold py-2 rounded-xl border-2 focus:outline-none transition ${
              pinError
                ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                : 'border-slate-200 dark:border-[#2a2f5a] bg-white dark:bg-[#0c0e1e] text-slate-900 dark:text-white focus:border-indigo-600 dark:focus:border-indigo-400'
            }`}
          />
          {pinError && <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">Incorrect PIN</p>}
          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
};
