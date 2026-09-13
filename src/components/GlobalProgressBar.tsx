import React from 'react';
import { GlobalLoadingTask } from '../types';

interface GlobalProgressBarProps {
  task: GlobalLoadingTask;
  onCancel?: () => void;
}

export const GlobalProgressBar: React.FC<GlobalProgressBarProps> = ({
  task,
  onCancel,
}) => {
  if (!task.active) return null;

  const clampedProgress = Math.min(100, Math.max(0, Math.round(task.progress)));

  return (
    <div
      id="global-progress-indicator"
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={task.label}
      className="sticky top-0 z-40 w-full mb-4 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-[#dae2fd] overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-2"
    >
      {/* Top Thin Linear Progress Track */}
      <div className="w-full h-1.5 bg-[#e2e7ff] relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#00236f] via-[#1e3a8a] to-[#004a32] transition-all duration-200 ease-out relative"
          style={{ width: `${clampedProgress}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
        </div>
      </div>

      {/* Task Information & Progress Detail Row */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-[#131b2e]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Animated Spinner / Processing Icon */}
          <div className="w-7 h-7 rounded-lg bg-[#e2e7ff] text-[#00236f] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px] animate-spin">
              autorenew
            </span>
          </div>

          {/* Task Labels */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#131b2e] truncate">
                {task.label}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#85f8c4]/30 text-[#003120] text-[10px] font-bold uppercase tracking-wider shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#004a32] animate-ping"></span>
                In-Memory Client Engine
              </span>
            </div>
            {task.statusText && (
              <span className="text-[11px] text-[#444651] truncate mt-0.5">
                {task.statusText}
              </span>
            )}
          </div>
        </div>

        {/* Progress Percentage Badge & Dismiss Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-baseline gap-1 bg-[#f2f3ff] px-2.5 py-1 rounded-lg border border-[#dae2fd]">
            <span className="font-['Outfit'] font-bold text-[14px] text-[#00236f]">
              {clampedProgress}%
            </span>
            <span className="text-[10px] text-[#757682] font-mono">DONE</span>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              title="Cancel background operation"
              className="p-1 hover:bg-[#eaedff] rounded-lg text-[#757682] hover:text-[#131b2e] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
