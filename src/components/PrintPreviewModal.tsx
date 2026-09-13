import React, { useState } from 'react';
import { SheetFormat } from '../types';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  format?: SheetFormat | 'document';
  photoSrc?: string;
  candidateName?: string;
  dateOfPhoto?: string;
  addDop?: boolean;
  addCutLines?: boolean;
  whiteBorder?: boolean;
  marginType?: 'lab' | 'home';
  customContent?: React.ReactNode;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  format = '4x6',
  photoSrc,
  candidateName = '',
  dateOfPhoto = '',
  addDop = false,
  addCutLines = true,
  whiteBorder = true,
  marginType = 'lab',
  customContent,
}) => {
  const [proofMode, setProofMode] = useState<'rgb' | 'cmyk' | 'greyscale'>('rgb');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [showMargins, setShowMargins] = useState<boolean>(true);
  const [paperTexture, setPaperTexture] = useState<boolean>(true);

  if (!isOpen) return null;

  const count = format === '4x6' ? 8 : format === 'a4-16' ? 16 : format === 'a4-32' ? 32 : 1;

  const handlePrint = () => {
    window.print();
  };

  const getProofClass = () => {
    if (proofMode === 'cmyk') return 'print-proof-cmyk';
    if (proofMode === 'greyscale') return 'print-proof-greyscale';
    return '';
  };

  return (
    <div
      id="print-preview-modal-root"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in"
    >
      {/* Modal Dialog Card */}
      <div className="bg-white rounded-2xl shadow-2xl border border-[#dae2fd] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header Bar with Controls */}
        <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] text-[#00236f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">
                local_printshop
              </span>
            </div>
            <div>
              <h3 className="font-['Outfit'] text-[16px] font-bold text-[#131b2e] leading-tight">
                Print Preview Simulator
              </h3>
              <p className="text-[11px] text-[#444651]">
                {title} • {format === '4x6' ? '4" × 6" Photo Paper (10×15 cm)' : 'A4 Sheet (21×29.7 cm)'} • 300 DPI
              </p>
            </div>
          </div>

          {/* Controls Bar: Proof Mode, Rulers, Zoom */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Color Proofing Mode */}
            <div className="flex items-center bg-[#eaedff] p-0.5 rounded-lg border border-[#dae2fd]">
              <button
                type="button"
                onClick={() => setProofMode('rgb')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  proofMode === 'rgb'
                    ? 'bg-white text-[#00236f] shadow-xs'
                    : 'text-[#444651]'
                }`}
                title="Full Color (sRGB)"
              >
                Full Color
              </button>
              <button
                type="button"
                onClick={() => setProofMode('cmyk')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  proofMode === 'cmyk'
                    ? 'bg-white text-[#00236f] shadow-xs'
                    : 'text-[#444651]'
                }`}
                title="Simulate 4-Color Inkjet CMYK Pigment"
              >
                CMYK Proof
              </button>
              <button
                type="button"
                onClick={() => setProofMode('greyscale')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  proofMode === 'greyscale'
                    ? 'bg-white text-[#00236f] shadow-xs'
                    : 'text-[#444651]'
                }`}
                title="Monochrome / B&W Printing"
              >
                B&amp;W
              </button>
            </div>

            {/* Toggle Overlays */}
            <button
              type="button"
              onClick={() => setShowRuler((prev) => !prev)}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                showRuler
                  ? 'bg-[#00236f] text-white border-[#00236f]'
                  : 'bg-white text-[#444651] border-[#dae2fd]'
              }`}
              title="Toggle Millimeter Rulers"
            >
              <span className="material-symbols-outlined text-[14px]">
                straighten
              </span>
              <span>mm Ruler</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMargins((prev) => !prev)}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                showMargins
                  ? 'bg-[#00236f] text-white border-[#00236f]'
                  : 'bg-white text-[#444651] border-[#dae2fd]'
              }`}
              title="Toggle Safe Margins Line"
            >
              <span className="material-symbols-outlined text-[14px]">
                crop_free
              </span>
              <span>Margins</span>
            </button>

            <button
              type="button"
              onClick={() => setPaperTexture((prev) => !prev)}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                paperTexture
                  ? 'bg-[#e2e7ff] text-[#00236f] border-[#00236f]/30'
                  : 'bg-white text-[#757682] border-[#dae2fd]'
              }`}
              title="Toggle Paper Texture"
            >
              <span className="material-symbols-outlined text-[14px]">
                texture
              </span>
              <span>Gloss</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-[#eaedff] px-1.5 py-0.5 rounded-lg border border-[#dae2fd]">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(60, z - 15))}
                className="w-5 h-5 flex items-center justify-center text-[#00236f] hover:bg-white rounded cursor-pointer"
                title="Zoom Out"
              >
                <span className="material-symbols-outlined text-[14px]">remove</span>
              </button>
              <span className="text-[11px] font-mono font-bold text-[#131b2e] w-9 text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
                className="w-5 h-5 flex items-center justify-center text-[#00236f] hover:bg-white rounded cursor-pointer"
                title="Zoom In"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#eaedff] text-[#444651] hover:text-[#131b2e] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Middle Stage: Simulated Physical Paper with Rulers */}
        <div className="flex-1 bg-[#1e293b] p-6 overflow-auto flex items-center justify-center relative min-h-[440px]">
          {/* Top Millimeter Ruler Bar */}
          {showRuler && (
            <div className="absolute top-0 inset-x-0 h-4 bg-[#0f172a] border-b border-[#334155] flex items-end justify-between px-6 text-[8px] font-mono text-[#94a3b8] pointer-events-none ruler-ticks-h z-20">
              <span>0mm</span>
              <span>25mm</span>
              <span>50mm</span>
              <span>75mm</span>
              <span>100mm</span>
              <span>125mm</span>
              <span>150mm</span>
            </div>
          )}

          {/* Left Millimeter Ruler Bar */}
          {showRuler && (
            <div className="absolute left-0 inset-y-0 w-4 bg-[#0f172a] border-r border-[#334155] flex flex-col justify-between py-6 text-[8px] font-mono text-[#94a3b8] pointer-events-none ruler-ticks-v z-20 items-center">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          )}

          {/* Physical Sheet Canvas Container with Scale */}
          <div
            id="simulated-print-sheet-wrapper"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
            className={`transition-transform duration-200 printable-target ${getProofClass()}`}
          >
            {customContent ? (
              <div className="bg-white p-6 rounded-xs shadow-2xl border border-[#e2e8f0] relative">
                {customContent}
              </div>
            ) : (
              /* Passport Studio Sheet Simulator */
              <div
                className={`bg-white text-[#131b2e] rounded-xs shadow-2xl relative transition-all ${
                  paperTexture ? 'print-paper-texture' : ''
                } ${
                  format === '4x6'
                    ? 'w-[560px] h-[373px] p-4' // 4:6 ratio
                    : 'w-[480px] h-[678px] p-5' // 1:1.414 ratio (A4)
                }`}
              >
                {/* Paper Safe Margin Overlay Guide */}
                {showMargins && (
                  <div
                    className={`absolute inset-2 border border-dashed pointer-events-none ${
                      marginType === 'lab'
                        ? 'border-emerald-400/80 m-[2px]'
                        : 'border-blue-400/80 m-[6px]'
                    }`}
                  >
                    <span className="absolute bottom-1 right-1.5 text-[8px] font-mono text-emerald-700 bg-emerald-50/90 px-1 rounded">
                      {marginType === 'lab' ? 'Lab Margin (2mm Safe)' : 'Home Inkjet Margin (5mm Safe)'}
                    </span>
                  </div>
                )}

                {/* Calibration Top Text */}
                <div className="flex items-center justify-between text-[7px] text-[#94a3b8] font-mono border-b border-[#f1f5f9] pb-0.5 mb-2 pointer-events-none">
                  <span>WEBODOCX HIGH-PRECISION PRINT PROOF • 300 DPI OPTICAL</span>
                  <span>100% SCALE (DO NOT FIT TO PAGE)</span>
                </div>

                {/* Photo Grid */}
                <div
                  className={`w-full h-[calc(100%-20px)] grid gap-2.5 items-center justify-items-center ${
                    format === '4x6'
                      ? 'grid-cols-4 grid-rows-2'
                      : format === 'a4-16'
                      ? 'grid-cols-4 grid-rows-4'
                      : 'grid-cols-4 grid-rows-8 gap-1'
                  }`}
                >
                  {Array.from({ length: count }).map((_, i) => (
                    <div
                      key={i}
                      className={`relative bg-[#f8fafc] overflow-hidden flex flex-col items-center justify-between shadow-2xs ${
                        whiteBorder ? 'border border-[#cbd5e1]' : ''
                      } ${
                        format === 'a4-32'
                          ? 'w-[44px] h-[56px]'
                          : 'w-[80px] h-[102px]'
                      }`}
                    >
                      {/* Scissor Corner Guides */}
                      {addCutLines && (
                        <>
                          <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#64748b] pointer-events-none z-10"></span>
                          <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#64748b] pointer-events-none z-10"></span>
                          <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#64748b] pointer-events-none z-10"></span>
                          <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#64748b] pointer-events-none z-10"></span>
                        </>
                      )}

                      {photoSrc ? (
                        <img
                          src={photoSrc}
                          alt={`Passport Print ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#f1f5f9] flex items-center justify-center text-[10px] text-[#94a3b8]">
                          Photo {i + 1}
                        </div>
                      )}

                      {/* Name & DOP Stamp on Photo */}
                      {addDop && (
                        <div className="absolute bottom-0 inset-x-0 bg-white/95 text-center py-0.5 px-0.5 border-t border-[#cbd5e1]">
                          <div className="text-[7.5px] font-bold text-[#131b2e] truncate uppercase leading-none">
                            {candidateName || 'CANDIDATE'}
                          </div>
                          <div className="text-[6px] text-[#444651] font-mono leading-none mt-0.5 truncate">
                            {dateOfPhoto}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Footer Info & Print Action */}
        <div className="px-5 py-3.5 bg-white border-t border-[#eaedff] flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3 text-[12px] text-[#444651]">
            <div className="flex items-center gap-1 text-[#003120] font-semibold">
              <span className="material-symbols-outlined text-[#004a32] text-[18px]">
                verified
              </span>
              <span>100% Physical 1:1 Scale Match</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">
              Set printer settings to <strong>"Actual Size" / "100% Scale"</strong> (Disable "Fit to page")
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-[#444651] text-[13px] font-bold transition-colors cursor-pointer"
            >
              Back to Editor
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[13px] font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                print
              </span>
              <span>Send to Printer (Ctrl+P)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
