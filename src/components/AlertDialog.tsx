import React, { useState } from 'react';

interface AlertDialogProps {
  message: string;
  requireConfirm: boolean;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ message, requireConfirm, confirmLabel = 'Confirm', onClose, onConfirm }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={requireConfirm ? 'Confirm action' : 'Notice'}
        className="bg-white dark:bg-[#181b34] rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-[#2a2f5a] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-pre-line">{message}</p>
        <div className="flex justify-end space-x-3">
          {requireConfirm && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 dark:border-[#2a2f5a] text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-[#1f2347] transition cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => { onConfirm?.(); onClose(); }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition cursor-pointer"
          >
            {requireConfirm ? confirmLabel : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DialogState {
  message: string;
  onConfirm?: () => void;
  confirmLabel?: string;
}

export function useAlertDialog() {
  const [state, setState] = useState<DialogState | null>(null);
  const showAlert = (message: string, onConfirm?: () => void, confirmLabel?: string) =>
    setState({ message, onConfirm, confirmLabel });
  const dialog = state ? (
    <AlertDialog
      message={state.message}
      requireConfirm={!!state.onConfirm}
      confirmLabel={state.confirmLabel}
      onClose={() => setState(null)}
      onConfirm={state.onConfirm}
    />
  ) : null;
  return { dialog, showAlert };
}
