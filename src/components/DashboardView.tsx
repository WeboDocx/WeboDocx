import React, { useState } from 'react';
import { NavView, Language } from '../types';
import { RecentActivityPanel } from './RecentActivityPanel';

interface DashboardViewProps {
  onNavigate: (view: NavView) => void;
  onSelectPreset: (presetId: string) => void;
  onOpenSearch: () => void;
  onOpenQuickQr?: () => void;
  language: Language;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectPreset,
  onOpenSearch,
  onOpenQuickQr,
  language,
}) => {
  const [searchInput, setSearchInput] = useState('');

  const trendingTags = [
    { label: 'SSC CGL 2025', presetId: 'ssc-cgl' },
    { label: 'UPSC CSE', presetId: 'upsc-cse' },
    { label: 'IBPS PO', presetId: 'ibps-po' },
    { label: 'UPSSSC PET', presetId: 'upsssc-pet' },
    { label: 'PM Kisan', presetId: 'pm-kisan' },
    { label: 'NSP Scholarship', presetId: 'nsp-scholarship' },
    { label: 'Railway RRB', presetId: 'rrb-ntpc' },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onOpenSearch();
    }
  };

  return (
    <div id="dashboard-view-root" className="flex flex-col w-full">
      {/* Top Hero Banner */}
      <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#e2e7ff] via-[#eaedff] to-[#dae2fd] p-6 sm:p-8 mb-6 shadow-sm border border-[#dae2fd]/60">
        <div className="absolute -right-16 -bottom-16 w-96 h-96 rounded-full bg-[#00236f]/5 blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/4 -top-24 w-72 h-72 rounded-full bg-[#fe932c]/10 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          {/* Tag Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white shadow-sm mb-3 border border-[#dce1ff]">
            <span className="material-symbols-outlined text-[#003120] text-[18px]">
              verified_user
            </span>
            <span className="text-[11px] uppercase tracking-wider text-[#00236f] font-bold">
              2025 Central &amp; State Portal Guidelines Updated
            </span>
          </div>

          <h1 className="font-['Outfit'] text-[28px] sm:text-[36px] lg:text-[40px] font-bold text-[#00236f] tracking-tight mb-2 leading-tight">
            Fast-Track Exam Forms &amp; Scheme Applications
          </h1>

          <p className="text-[15px] sm:text-[16px] text-[#444651] max-w-2xl mb-6 leading-relaxed">
            Instant 100% compliant photo resizing, signature cropping, passport
            sheet generation, and government welfare scheme matching.
          </p>

          {/* Large Search Input */}
          <div className="w-full max-w-2xl">
            <form
              onSubmit={handleSearchSubmit}
              className="relative flex items-center bg-white rounded-xl shadow-md p-1.5 focus-within:shadow-lg focus-within:ring-2 focus-within:ring-[#b6c4ff] transition-all border border-[#cbd5e1]"
            >
              <span className="material-symbols-outlined text-[#757682] ml-3 mr-2 text-[22px]">
                search
              </span>
              <input
                id="preset-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search exam presets (e.g. SSC 20-50KB, UPSC Sign 10-20KB, State schemes)..."
                className="w-full bg-transparent text-[14px] text-[#131b2e] placeholder:text-[#757682] focus:outline-none py-2"
              />
              <kbd className="hidden sm:inline-flex items-center px-2 py-1 rounded bg-[#eaedff] text-[11px] font-mono text-[#444651] mr-2">
                Ctrl + K
              </kbd>
              <button
                type="button"
                onClick={onOpenSearch}
                className="bg-[#00236f] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#1e3a8a] transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>Find Specs</span>
              </button>
            </form>

            {/* Trending Quick Links */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 text-center">
              <span className="text-[11px] text-[#757682] uppercase tracking-wider font-semibold mr-1">
                Trending:
              </span>
              {trendingTags.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => {
                    if (tag.presetId === 'pm-kisan' || tag.presetId === 'nsp-scholarship') {
                      onNavigate('scheme-finder');
                    } else {
                      onSelectPreset(tag.presetId);
                      onNavigate('exam-photo-sign-resizer');
                    }
                  }}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-[#00236f] hover:text-white text-[11px] font-medium text-[#444651] transition-all shadow-xs border border-[#dae2fd] cursor-pointer"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Panel (Last 5 Processed Files) */}
      <RecentActivityPanel
        onNavigate={onNavigate}
        onSelectPreset={onSelectPreset}
      />

      {/* 6 Feature Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        {/* Card 1: Exam Photo/Sign Resizer */}
        <div
          id="card-photo-resizer"
          className="group relative flex flex-col justify-between bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-[#eaedff]"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f]">
                <span className="material-symbols-outlined text-[22px]">
                  crop_free
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#85f8c4] text-[#002114] text-[11px] font-bold tracking-wide uppercase">
                Auto Size &amp; DPI
              </span>
            </div>
            <h3 className="font-['Outfit'] text-[19px] font-bold text-[#131b2e] tracking-tight mb-1 group-hover:text-[#00236f] transition-colors">
              Exam Photo/Sign Resizer
            </h3>
            <p className="text-[13px] text-[#444651] mb-3 leading-snug">
              Format photos &amp; signatures matching exact portal KB limits,
              dimensions, and DPI without pixelation.
            </p>

            <div className="bg-[#f2f3ff] rounded-lg p-2.5 mb-4 border border-[#dae2fd]/50">
              <div className="text-[11px] uppercase tracking-wider text-[#757682] font-semibold mb-1.5">
                One-Click Presets:
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="px-2 py-0.5 rounded bg-white text-[#00236f] text-[11px] font-mono font-medium shadow-2xs">
                  SSC (20-50KB)
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-[#00236f] text-[11px] font-mono font-medium shadow-2xs">
                  UPSC (20-300KB)
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-[#00236f] text-[11px] font-mono font-medium shadow-2xs">
                  NEET (10-200KB)
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[#444651] text-[11px] font-medium mb-3 px-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  check_circle
                </span>{' '}
                White BG Check
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  aspect_ratio
                </span>{' '}
                3.5 × 4.5 cm
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('exam-photo-sign-resizer')}
              className="w-full flex items-center justify-center gap-2 bg-[#00236f] text-white font-semibold text-[13px] py-2.5 px-4 rounded-lg hover:bg-[#1e3a8a] active:scale-[0.99] transition-all shadow-sm cursor-pointer"
            >
              <span>Open Resizer Tool</span>
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </button>
          </div>
        </div>

        {/* Card 2: Mobile Camera Scanner (New!) */}
        <div
          id="card-camera-scanner"
          className="group relative flex flex-col justify-between bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-[#eaedff] ring-1 ring-[#00236f]/10"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#00236f] flex items-center justify-center text-white shadow-xs">
                <span className="material-symbols-outlined text-[22px]">
                  document_scanner
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#e2e7ff] text-[#00236f] text-[11px] font-extrabold tracking-wide uppercase border border-[#b4c5ff]">
                Live Camera + Crop
              </span>
            </div>
            <h3 className="font-['Outfit'] text-[19px] font-bold text-[#131b2e] tracking-tight mb-1 group-hover:text-[#00236f] transition-colors">
              Mobile Camera Scanner
            </h3>
            <p className="text-[13px] text-[#444651] mb-3 leading-snug">
              Capture physical certificates, marksheets &amp; forms using your device camera with 4-corner perspective warping, auto-filters &amp; instant PDF export.
            </p>

            <div className="bg-[#f2f3ff] rounded-lg p-2.5 mb-4 border border-[#dae2fd]/50">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-[#757682] uppercase tracking-wider font-semibold">
                  Scanner Features:
                </span>
                <span className="text-[11px] font-semibold text-[#003120] font-mono">
                  Multi-Page
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div className="bg-white py-1 px-1.5 rounded text-[#00236f] font-semibold shadow-2xs truncate">
                  • 4-Corner Crop &amp; Warp
                </div>
                <div className="bg-white py-1 px-1.5 rounded text-[#00236f] font-semibold shadow-2xs truncate">
                  • Magic Clean &amp; B&amp;W
                </div>
                <div className="bg-white py-1 px-1.5 rounded text-[#131b2e] font-medium shadow-2xs truncate">
                  • Send to OCR Engine
                </div>
                <div className="bg-white py-1 px-1.5 rounded text-[#131b2e] font-medium shadow-2xs truncate">
                  • Send to Digital Sign
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[#444651] text-[11px] font-medium mb-3 px-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  photo_camera
                </span>{' '}
                Flash &amp; Flip
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  picture_as_pdf
                </span>{' '}
                Direct A4 PDF
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('camera-scanner')}
              className="w-full flex items-center justify-center gap-2 bg-[#00236f] text-white font-semibold text-[13px] py-2.5 px-4 rounded-lg hover:bg-[#1e3a8a] active:scale-[0.99] transition-all shadow-sm cursor-pointer"
            >
              <span>Launch Camera Scanner</span>
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </button>
          </div>
        </div>

        {/* Card 2: Passport Photo Sheet Generator */}
        <div
          id="card-passport-maker"
          className="group relative flex flex-col justify-between bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-[#eaedff]"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f]">
                <span className="material-symbols-outlined text-[22px]">
                  grid_on
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ffdcc3] text-[#2f1500] text-[11px] font-bold tracking-wide uppercase">
                Save ₹50 at Cafe
              </span>
            </div>
            <h3 className="font-['Outfit'] text-[19px] font-bold text-[#131b2e] tracking-tight mb-1 group-hover:text-[#00236f] transition-colors">
              Passport Photo Sheet Generator
            </h3>
            <p className="text-[13px] text-[#444651] mb-3 leading-snug">
              Create printable 8, 16, or 32 grid passport photo sheets with
              cutting borders, name label, and date stamp.
            </p>

            <div className="bg-[#f2f3ff] rounded-lg p-2.5 mb-4 border border-[#dae2fd]/50">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-[#757682] uppercase tracking-wider font-semibold">
                  Sheet Formats:
                </span>
                <span className="text-[11px] font-semibold text-[#00236f] font-mono">
                  4×6 &amp; A4 Ready
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
                <div className="bg-white py-1 rounded text-[#131b2e] font-medium shadow-2xs">
                  8 Copies
                </div>
                <div className="bg-white py-1 rounded text-[#131b2e] font-medium shadow-2xs">
                  16 Copies
                </div>
                <div className="bg-white py-1 rounded text-[#131b2e] font-medium shadow-2xs">
                  32 Copies
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[#444651] text-[11px] font-medium mb-3 px-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  tune
                </span>{' '}
                Custom Margins
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  print
                </span>{' '}
                High-Res 300 DPI
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('passport-sheet-maker')}
              className="w-full flex items-center justify-center gap-2 bg-[#00236f] text-white font-semibold text-[13px] py-2.5 px-4 rounded-lg hover:bg-[#1e3a8a] active:scale-[0.99] transition-all shadow-sm cursor-pointer"
            >
              <span>Create Print Sheet</span>
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </button>
          </div>
        </div>

        {/* Card 3: PDF & Document Conversion Studio */}
        <div
          id="card-pdf-compressor"
          className="group relative flex flex-col justify-between bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-[#eaedff]"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f]">
                <span className="material-symbols-outlined text-[22px]">
                  picture_as_pdf
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#dae2fd] text-[#00236f] text-[11px] font-bold tracking-wide uppercase">
                9-in-1 Suite + Split &amp; Sign
              </span>
            </div>
            <h3 className="font-['Outfit'] text-[19px] font-bold text-[#131b2e] tracking-tight mb-1 group-hover:text-[#00236f] transition-colors">
              PDF &amp; Document Conversion Studio
            </h3>
            <p className="text-[13px] text-[#444651] mb-3 leading-snug">
              Extract page ranges &amp; split PDFs, digital signature stamping, OCR extractor &amp; searchable PDF generator, merge PDFs, &lt;200KB compressor, PDF to Word.
            </p>

            <div className="bg-[#f2f3ff] rounded-lg p-2.5 mb-4 border border-[#dae2fd]/50">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-[#757682] uppercase tracking-wider font-semibold">
                  Tools Included:
                </span>
                <span className="text-[11px] font-semibold text-[#003120] font-mono">
                  100% In-Browser
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="bg-white px-2 py-1 rounded text-[#00236f] font-bold shadow-2xs truncate flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-[#00236f]">ink_pen</span>
                  <span>Digital Sign &amp; Stamp</span>
                </div>
                <div className="bg-white px-2 py-1 rounded text-[#00236f] font-bold shadow-2xs truncate flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-[#00236f]">document_scanner</span>
                  <span>OCR Extractor</span>
                </div>
                <div className="bg-white px-2 py-1 rounded text-[#131b2e] font-medium shadow-2xs truncate flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-[#00236f]">call_merge</span>
                  <span>Merge PDFs</span>
                </div>
                <div className="bg-white px-2 py-1 rounded text-[#131b2e] font-medium shadow-2xs truncate">
                  • PDF to Word / Img
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[#444651] text-[11px] font-medium mb-3 px-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  lock
                </span>{' '}
                Safe In-Memory
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  folder_zip
                </span>{' '}
                Batch &amp; ZIP Export
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('pdf-tools-compress')}
              className="w-full flex items-center justify-center gap-2 bg-[#00236f] text-white font-semibold text-[13px] py-2.5 px-4 rounded-lg hover:bg-[#1e3a8a] active:scale-[0.99] transition-all shadow-sm cursor-pointer"
            >
              <span>Open PDF Converter Studio</span>
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </button>
          </div>
        </div>

        {/* Card 4: Check Scheme Eligibility */}
        <div
          id="card-scheme-finder"
          className="group relative flex flex-col justify-between bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-[#eaedff]"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f]">
                <span className="material-symbols-outlined text-[22px]">
                  diversity_3
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#dce1ff] text-[#00164e] text-[11px] font-bold tracking-wide uppercase">
                Instant Match
              </span>
            </div>
            <h3 className="font-['Outfit'] text-[19px] font-bold text-[#131b2e] tracking-tight mb-1 group-hover:text-[#904d00] transition-colors">
              Check Scheme Eligibility
            </h3>
            <p className="text-[13px] text-[#444651] mb-3 leading-snug">
              Filter 450+ central &amp; state welfare schemes based on social
              category, domicile, education, and family income.
            </p>

            <div className="bg-[#f2f3ff] rounded-lg p-2.5 mb-4 border border-[#dae2fd]/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#757682] uppercase tracking-wider font-semibold">
                  Eligible Payouts
                </span>
                <span className="text-[11px] font-semibold text-[#904d00]">
                  Active DB 2025
                </span>
              </div>
              <div className="font-['Outfit'] text-[24px] text-[#00236f] font-bold tracking-tight">
                ₹35,000+
                <span className="text-[13px] font-normal text-[#444651] ml-1 font-['Inter']">
                  avg. benefit pool
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[#444651] text-[11px] font-medium mb-3 px-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  check
                </span>{' '}
                Zero Login Req.
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  bolt
                </span>{' '}
                Direct Links
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('scheme-finder')}
              className="w-full flex items-center justify-center gap-2 bg-[#904d00] text-white font-semibold text-[13px] py-2.5 px-4 rounded-lg hover:bg-[#fe932c] hover:text-[#663500] active:scale-[0.99] transition-all shadow-sm cursor-pointer"
            >
              <span>Check Schemes</span>
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </button>
          </div>
        </div>

        {/* Card 5: Quick QR Code & Form Sharer */}
        <div
          id="card-qr-generator"
          className="group relative flex flex-col justify-between bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-[#eaedff]"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f]">
                <span className="material-symbols-outlined text-[22px]">
                  qr_code_2
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#85f8c4]/20 text-[#003120] text-[11px] font-bold tracking-wide uppercase">
                High-Res PNG
              </span>
            </div>
            <h3 className="font-['Outfit'] text-[19px] font-bold text-[#131b2e] tracking-tight mb-1 group-hover:text-[#00236f] transition-colors">
              Quick QR Code &amp; Form Sharer
            </h3>
            <p className="text-[13px] text-[#444651] mb-3 leading-snug">
              Convert portal URLs, candidate contact vCards, UPI fee receipts &amp; acknowledgment numbers into crisp downloadable PNGs.
            </p>

            <div className="bg-[#f2f3ff] rounded-lg p-2.5 mb-4 border border-[#dae2fd]/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#757682] uppercase tracking-wider font-semibold">
                  Supported Formats
                </span>
                <span className="text-[11px] font-semibold text-[#00236f]">
                  1-Click PNG / SVG
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div className="bg-white py-0.5 px-1.5 rounded text-[#131b2e] font-medium shadow-2xs truncate">
                  • Portal Links
                </div>
                <div className="bg-white py-0.5 px-1.5 rounded text-[#131b2e] font-medium shadow-2xs truncate">
                  • Contact vCard
                </div>
                <div className="bg-white py-0.5 px-1.5 rounded text-[#131b2e] font-medium shadow-2xs truncate">
                  • UPI Payment
                </div>
                <div className="bg-white py-0.5 px-1.5 rounded text-[#131b2e] font-medium shadow-2xs truncate">
                  • WhatsApp / WiFi
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[#444651] text-[11px] font-medium mb-3 px-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  download
                </span>{' '}
                PNG + Frame
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#003120]">
                  print
                </span>{' '}
                Printable
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('qr-code-generator')}
              className="w-full flex items-center justify-center gap-2 bg-[#00236f] text-white font-semibold text-[13px] py-2.5 px-4 rounded-lg hover:bg-[#1e3a8a] active:scale-[0.99] transition-all shadow-sm cursor-pointer"
            >
              <span>Generate QR Code</span>
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Popular Portal Presets Horizontal Bar */}
      <div className="w-full bg-white rounded-xl p-4 shadow-sm mb-6 border border-[#eaedff]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-[240px]">
            <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f]">
              <span className="material-symbols-outlined text-[20px]">bolt</span>
            </div>
            <div>
              <h4 className="text-[15px] font-bold text-[#131b2e]">
                Popular Portal Presets
              </h4>
              <p className="text-[12px] text-[#444651]">
                Click to load official photo, sign &amp; document specifications
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => {
                onSelectPreset('ssc-cgl');
                onNavigate('exam-photo-sign-resizer');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-medium transition-colors cursor-pointer border border-[#dae2fd]/60"
            >
              <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                assignment
              </span>
              <span>SSC Portal (All Exams)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectPreset('upsc-cse');
                onNavigate('exam-photo-sign-resizer');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-medium transition-colors cursor-pointer border border-[#dae2fd]/60"
            >
              <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                school
              </span>
              <span>UPSC Civil Services</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectPreset('ibps-po');
                onNavigate('exam-photo-sign-resizer');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-medium transition-colors cursor-pointer border border-[#dae2fd]/60"
            >
              <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                account_balance
              </span>
              <span>IBPS / SBI Banking</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectPreset('neet-ug');
                onNavigate('exam-photo-sign-resizer');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-medium transition-colors cursor-pointer border border-[#dae2fd]/60"
            >
              <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                health_and_safety
              </span>
              <span>NTA NEET / JEE Main</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectPreset('rrb-ntpc');
                onNavigate('exam-photo-sign-resizer');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-medium transition-colors cursor-pointer border border-[#dae2fd]/60"
            >
              <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                train
              </span>
              <span>Railway Recruitment (RRB)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectPreset('state-psc');
                onNavigate('exam-photo-sign-resizer');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-medium transition-colors cursor-pointer border border-[#dae2fd]/60"
            >
              <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                local_police
              </span>
              <span>State Police / PSC</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trust Guarantee & CSC Center Operator Mode Banner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Left 2 Cols: 100% Client-Side Engine Guarantee */}
        <div className="lg:col-span-2 bg-gradient-to-r from-[#003120] to-[#004a32] rounded-xl p-5 text-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none"></div>
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px] text-[#85f8c4]">
                security
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-['Outfit'] text-[20px] font-bold tracking-tight">
                  100% Client-Side Engine Guarantee
                </span>
                <span className="px-2 py-0.5 rounded bg-[#85f8c4] text-[#002114] text-[10px] font-bold uppercase">
                  Privacy First
                </span>
              </div>
              <p className="text-[13px] text-white/90 max-w-xl leading-relaxed">
                Your marksheets, Aadhaar scans, live photos, and signatures are
                processed entirely in your device RAM using WebAssembly and
                HTML5 Canvas. No files are ever sent to an external server.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex sm:flex-col items-center gap-2 relative z-10 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white font-mono text-[12px]">
              <span className="w-2 h-2 rounded-full bg-[#85f8c4] animate-ping"></span>
              <span>Zero Server Storage</span>
            </div>
            <span className="text-[11px] text-[#85f8c4] font-medium text-center">
              Safe for Public CSC Terminals
            </span>
          </div>
        </div>

        {/* Right 1 Col: CSC Center Mode Batch Utility */}
        <div className="bg-white rounded-xl p-5 shadow-sm flex flex-col justify-between border border-[#eaedff]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-[#757682] font-semibold">
                CSC Center Mode
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#e2e7ff] text-[#00236f] text-[11px] font-bold">
                Fast Operator
              </span>
            </div>
            <h4 className="text-[16px] font-bold text-[#131b2e] mb-1">
              High-Volume Batch Utility
            </h4>
            <p className="text-[13px] text-[#444651] leading-snug">
              Enable kiosk shortcuts, batch export photo sheets, and quick-print
              applicant tokens with zero watermarks.
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[#eaedff] mt-3">
            <span className="font-mono text-[12px] text-[#444651]">
              Current Session: <strong className="text-[#00236f]">12 Formats Cached</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('passport-sheet-maker')}
              className="text-[12px] text-[#00236f] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Batch Studio</span>
              <span className="material-symbols-outlined text-[14px]">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Pillars Footer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-3 border border-[#eaedff]">
          <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f] shrink-0">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <div>
            <h5 className="text-[15px] font-bold text-[#131b2e] mb-0.5">
              Automated DPI Conversion
            </h5>
            <p className="text-[12px] text-[#444651] leading-relaxed">
              Inbuilt JFIF metadata injector fixes the strict 200 DPI or 300 DPI
              upload rejection rule on UPSC and SSC servers.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-3 border border-[#eaedff]">
          <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f] shrink-0">
            <span className="material-symbols-outlined text-[18px]">badge</span>
          </div>
          <div>
            <h5 className="text-[15px] font-bold text-[#131b2e] mb-0.5">
              DOPO &amp; Name Overlays
            </h5>
            <p className="text-[12px] text-[#444651] leading-relaxed">
              Add Date of Photo (DOPO) and candidate name banners automatically
              at the bottom without distorting facial ratios.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-3 border border-[#eaedff]">
          <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f] shrink-0">
            <span className="material-symbols-outlined text-[18px]">
              description
            </span>
          </div>
          <div>
            <h5 className="text-[15px] font-bold text-[#131b2e] mb-0.5">
              Certified Format Outputs
            </h5>
            <p className="text-[12px] text-[#444651] leading-relaxed">
              Guaranteed standard JPG/JPEG or PDF MIME types compliant with NIC
              (National Informatics Centre) firewalls.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
