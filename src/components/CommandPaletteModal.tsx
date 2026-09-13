import React, { useState, useEffect } from 'react';
import { EXAM_PRESETS } from '../data/examPresets';
import { SCHEMES_DATABASE } from '../data/schemesData';
import { NavView } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetId: string) => void;
  onNavigate: (view: NavView) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  onNavigate,
}) => {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredPresets = EXAM_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSchemes = SCHEMES_DATABASE.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      id="command-palette-backdrop"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        id="command-palette-dialog"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#dae2fd] overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#eaedff] bg-[#faf8ff]">
          <span className="material-symbols-outlined text-[#757682] text-[22px] mr-3">
            search
          </span>
          <input
            id="palette-search-input"
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exam specs (SSC, UPSC, IBPS, NEET), tools, or schemes..."
            className="w-full bg-transparent text-[15px] font-['Inter'] text-[#131b2e] placeholder:text-[#757682] focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-[#eaedff] text-[11px] font-mono text-[#444651]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 flex flex-col gap-3">
          {/* Quick Tools */}
          <div>
            <span className="px-2 text-[11px] uppercase tracking-wider text-[#757682] font-semibold">
              Workspace Tools
            </span>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  onNavigate('exam-photo-sign-resizer');
                  onClose();
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f2f3ff] text-left text-[13px] font-medium text-[#131b2e] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#00236f] text-[18px]">
                  crop_free
                </span>
                <span>Photo & Sign Resizer</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('passport-sheet-maker');
                  onClose();
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f2f3ff] text-left text-[13px] font-medium text-[#131b2e] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#00236f] text-[18px]">
                  photo_library
                </span>
                <span>Passport Sheet Maker</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('camera-scanner');
                  onClose();
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f2f3ff] text-left text-[13px] font-bold text-[#00236f] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#00236f] text-[18px]">
                  document_scanner
                </span>
                <span>Mobile Camera Scanner (Crop, Warp, PDF &amp; OCR)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('scheme-finder');
                  onClose();
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f2f3ff] text-left text-[13px] font-medium text-[#131b2e] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#904d00] text-[18px]">
                  policy
                </span>
                <span>Welfare Scheme Finder</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('pdf-tools-compress');
                  onClose();
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f2f3ff] text-left text-[13px] font-medium text-[#131b2e] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#00236f] text-[18px]">
                  ink_pen
                </span>
                <span>Digital Sign PDF (Stamp Signature &amp; Self-Attest)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('pdf-tools-compress');
                  onClose();
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f2f3ff] text-left text-[13px] font-medium text-[#131b2e] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#003120] text-[18px]">
                  picture_as_pdf
                </span>
                <span>PDF Suite (Compress, Merge, OCR &amp; Word)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('qr-code-generator');
                  onClose();
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f2f3ff] text-left text-[13px] font-medium text-[#131b2e] transition-colors cursor-pointer col-span-2 sm:col-span-1"
              >
                <span className="material-symbols-outlined text-[#00236f] text-[18px]">
                  qr_code_2
                </span>
                <span>Quick QR Code Generator (PNG / vCard / URL)</span>
              </button>
            </div>
          </div>

          {/* Exam Presets */}
          <div>
            <span className="px-2 text-[11px] uppercase tracking-wider text-[#757682] font-semibold">
              Government Exam Specifications ({filteredPresets.length})
            </span>
            <div className="flex flex-col gap-1 mt-1.5">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => {
                    onSelectPreset(preset.id);
                    onNavigate('exam-photo-sign-resizer');
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#f2f3ff] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#757682] group-hover:text-[#00236f] text-[18px]">
                      tune
                    </span>
                    <div>
                      <h5 className="text-[13px] font-semibold text-[#131b2e] group-hover:text-[#00236f]">
                        {preset.name}
                      </h5>
                      <span className="text-[11px] text-[#757682]">
                        Photo: {preset.photo.minKb}-{preset.photo.maxKb}KB ({preset.photo.widthPx}x{preset.photo.heightPx}px) • Sign: {preset.signature.minKb}-{preset.signature.maxKb}KB
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#00236f] bg-[#e2e7ff] px-2 py-0.5 rounded">
                    Load Spec →
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Schemes */}
          {filteredSchemes.length > 0 && (
            <div>
              <span className="px-2 text-[11px] uppercase tracking-wider text-[#757682] font-semibold">
                Welfare Schemes ({filteredSchemes.length})
              </span>
              <div className="flex flex-col gap-1 mt-1.5">
                {filteredSchemes.slice(0, 3).map((scheme) => (
                  <div
                    key={scheme.id}
                    onClick={() => {
                      onNavigate('scheme-finder');
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#f2f3ff] cursor-pointer transition-colors"
                  >
                    <div>
                      <h5 className="text-[13px] font-semibold text-[#131b2e]">
                        {scheme.title}
                      </h5>
                      <span className="text-[11px] text-[#003120] font-medium">
                        {scheme.financialBenefit}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#904d00] font-semibold">
                      View Eligibility →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
