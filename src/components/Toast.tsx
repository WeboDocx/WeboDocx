import React from 'react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-[#131b2e] text-white px-4 py-3 rounded-xl shadow-xl flex items-start gap-3 border border-[#444651] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="material-symbols-outlined text-[#85f8c4] text-[20px] shrink-0 mt-0.5">
            {toast.type === 'success'
              ? 'check_circle'
              : toast.type === 'warning'
              ? 'warning'
              : toast.type === 'error'
              ? 'error'
              : 'info'}
          </span>
          <div className="flex-1">
            <h4 className="text-[13px] font-semibold">{toast.title}</h4>
            {toast.description && (
              <p className="text-[12px] text-[#dae2fd] mt-0.5 leading-snug">
                {toast.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-[#dae2fd] hover:text-white text-[16px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
