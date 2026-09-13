import React, { useState, useRef } from 'react';
import { SheetFormat, ToastMessage, TaskManager } from '../types';
import { generatePassportSheetPdf } from '../utils/pdfGenerator';
import { PrintPreviewModal } from './PrintPreviewModal';
import { recordRecentActivity } from '../utils/recentActivityStore';

interface PassportStudioViewProps {
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  taskManager?: TaskManager;
}

export const PassportStudioView: React.FC<PassportStudioViewProps> = ({
  onAddToast,
  taskManager,
}) => {
  const [format, setFormat] = useState<SheetFormat>('4x6');
  const [photoSrc, setPhotoSrc] = useState<string>(
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC62OryWGWtTWnslvRvZV9IyqusAEUqDWauLkiwfUiDKAVyK1x-v_v06mWMU0jNlYHGG7ouH0icsGcCZrvvTAmEjJN0wCvkFgPye0Pd4uaMzw3zRudvdeOQFVoU5b3YE_vcq76n5ckrynb0tU_kDwErr17wVaT66gTWc4CkN4uvhKOFXmQbFV77Vj5Uny6Xu2hQ7eQerkrd6TtWpkDk3fOH4JR7OtujD3JaW1gcV9WXU0DLqtMKXKDE'
  );

  const [candidateName, setCandidateName] = useState<string>('');
  const [dateOfPhoto, setDateOfPhoto] = useState<string>(
    `DOP: ${new Date().toLocaleDateString('en-GB')}`
  );
  const [addDop, setAddDop] = useState<boolean>(false);
  const [addCutLines, setAddCutLines] = useState<boolean>(true);
  const [whiteBorder, setWhiteBorder] = useState<boolean>(true);
  const [marginType, setMarginType] = useState<'lab' | 'home'>('lab');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [inlineSimulateProof, setInlineSimulateProof] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const count = format === '4x6' ? 8 : format === 'a4-16' ? 16 : 32;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      taskManager?.startTask(`Importing Photo for Passport Sheet`, 30, 'Calculating photo paper DPI scale...');
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoSrc(event.target.result as string);
          taskManager?.updateProgress(80, `Rendering ${count} copies on ${format} sheet grid...`);
          setTimeout(() => {
            taskManager?.completeTask(`Grid populated with ${count} copies`, 400);
          }, 250);
          onAddToast({
            title: 'Photo Imported to Sheet',
            description: `Ready to generate ${count} passport copies on ${format} sheet.`,
            type: 'info',
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    taskManager?.startTask(
      `Generating 300 DPI Passport Sheet (${format.toUpperCase()})`,
      20,
      `Arranging ${count} photo units with scissor guide marks...`
    );

    try {
      taskManager?.updateProgress(55, 'Embedding 300 DPI high-resolution bitmap assets...');
      const pdfBlob = await generatePassportSheetPdf(photoSrc, format, {
        addCutLines,
        whiteBorder,
        marginType,
      });

      taskManager?.updateProgress(85, 'Packaging PDF container and calibrating margins...');

      const url = URL.createObjectURL(pdfBlob);
      const downloadName = `Passport_Photo_Sheet_${format}_${count}_Copies.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Record recent activity with persistent dataUrl
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        recordRecentActivity({
          fileName: downloadName,
          category: 'passport-maker',
          fileType: 'pdf',
          sizeKb: Math.round(pdfBlob.size / 1024),
          details: `${count} Photos (${format.toUpperCase()}) • 300 DPI Lab Print Sheet`,
          dataUrl: base64data,
        });
      };
      reader.readAsDataURL(pdfBlob);

      taskManager?.completeTask(`300 DPI Printable PDF ready (${count} copies)`, 500);

      onAddToast({
        title: '300 DPI PDF Ready',
        description: `Downloaded ${count}-photo sheet for ${format} photo paper.`,
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      taskManager?.cancelTask();
      onAddToast({
        title: 'PDF Generation Complete',
        description: 'Check your downloads folder.',
        type: 'success',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDirectPrint = () => {
    window.print();
  };

  return (
    <div id="passport-studio-root" className="flex flex-col w-full">
      {/* Top Banner with Sheet Selector */}
      <section className="bg-white p-4 rounded-xl shadow-sm mb-4 border border-[#eaedff]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f]">
                <span className="material-symbols-outlined text-[20px]">
                  grid_on
                </span>
              </div>
              <h2 className="font-['Outfit'] text-[20px] font-bold text-[#131b2e]">
                Passport Photo Sheet Studio (300 DPI)
              </h2>
            </div>
            <p className="text-[12px] text-[#444651] mt-0.5">
              Print multiple 3.5 × 4.5 cm passport photos on standard 4&quot;×6&quot; or A4 photo paper.
            </p>
          </div>

          {/* Format Selector Pills */}
          <div className="flex items-center p-1 bg-[#eaedff] rounded-lg border border-[#dae2fd]">
            <button
              type="button"
              onClick={() => setFormat('4x6')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                format === '4x6'
                  ? 'bg-white text-[#00236f] shadow-sm'
                  : 'text-[#444651] hover:text-[#131b2e]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">
                photo_size_select_actual
              </span>
              <span>4×6&quot; Card (8 Copies)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('a4-16')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                format === 'a4-16'
                  ? 'bg-white text-[#00236f] shadow-sm'
                  : 'text-[#444651] hover:text-[#131b2e]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">
                description
              </span>
              <span>A4 Sheet (16 Copies)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('a4-32')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                format === 'a4-32'
                  ? 'bg-white text-[#00236f] shadow-sm'
                  : 'text-[#444651] hover:text-[#131b2e]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">
                density_medium
              </span>
              <span>A4 Dense (32 Copies)</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Workspace Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT CONTROLS: 5 Cols */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Source Photo Card */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[#eaedff] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#131b2e] uppercase tracking-wider">
                Photo Source
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[12px] text-[#00236f] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  upload
                </span>
                <span>Change Photo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-3 p-2 bg-[#f2f3ff] rounded-lg border border-[#dae2fd]">
              <img
                src={photoSrc}
                alt="Source"
                className="w-12 h-16 object-cover rounded shadow-xs"
              />
              <div className="flex flex-col">
                <span className="text-[13px] font-bold text-[#131b2e]">
                  {candidateName || 'Candidate Photo'}
                </span>
                <span className="text-[11px] text-[#757682]">
                  Standard 3.5 × 4.5 cm Frame
                </span>
                <span className="text-[10px] text-[#003120] font-semibold">
                  300 DPI Print Ready
                </span>
              </div>
            </div>

            {/* DOP Stamp Overlay */}
            <div className="bg-[#f2f3ff] p-3 rounded-lg flex flex-col gap-2 border border-[#dae2fd]">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-[13px] text-[#131b2e] font-bold">
                  Print Candidate Name &amp; Date
                </span>
                <input
                  type="checkbox"
                  checked={addDop}
                  onChange={(e) => setAddDop(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00236f] focus:ring-0 cursor-pointer"
                />
              </label>
              {addDop && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-[10px] text-[#757682] uppercase font-semibold">
                      Name
                    </span>
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value.toUpperCase())}
                      className="w-full h-8 px-2 mt-0.5 bg-white text-[#131b2e] font-mono text-[12px] rounded border border-[#dae2fd] focus:outline-none focus:border-[#00236f] uppercase font-medium"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#757682] uppercase font-semibold">
                      DOP Stamp Text
                    </span>
                    <input
                      type="text"
                      value={dateOfPhoto}
                      onChange={(e) => setDateOfPhoto(e.target.value)}
                      className="w-full h-8 px-2 mt-0.5 bg-white text-[#131b2e] font-mono text-[12px] rounded border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sheet Options */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[#eaedff] flex flex-col gap-3">
            <h3 className="text-[14px] font-bold text-[#131b2e]">
              Sheet Layout &amp; Printer Settings
            </h3>

            <label className="flex items-center justify-between p-2 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] cursor-pointer select-none border border-[#dae2fd]/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00236f] text-[20px]">
                  content_cut
                </span>
                <div>
                  <span className="text-[13px] font-semibold text-[#131b2e] block">
                    Scissor Cutting Guidelines
                  </span>
                  <span className="text-[11px] text-[#444651]">
                    Thin corner crosshairs for quick cutting
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={addCutLines}
                onChange={(e) => setAddCutLines(e.target.checked)}
                className="w-4 h-4 rounded text-[#00236f] focus:ring-0 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] cursor-pointer select-none border border-[#dae2fd]/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00236f] text-[20px]">
                  border_style
                </span>
                <div>
                  <span className="text-[13px] font-semibold text-[#131b2e] block">
                    1.5mm White Photo Border
                  </span>
                  <span className="text-[11px] text-[#444651]">
                    Prevents photo sticking &amp; clean trimming
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={whiteBorder}
                onChange={(e) => setWhiteBorder(e.target.checked)}
                className="w-4 h-4 rounded text-[#00236f] focus:ring-0 cursor-pointer"
              />
            </label>

            <div className="p-2.5 rounded-lg bg-[#f2f3ff] flex flex-col gap-1.5 border border-[#dae2fd]/50">
              <span className="text-[11px] uppercase tracking-wider text-[#757682] font-semibold">
                Paper Margin Mode
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMarginType('lab')}
                  className={`py-1.5 px-2 rounded text-[12px] font-semibold transition-all cursor-pointer ${
                    marginType === 'lab'
                      ? 'bg-white text-[#00236f] shadow-xs'
                      : 'text-[#444651]'
                  }`}
                >
                  Lab Print (2mm Margin)
                </button>
                <button
                  type="button"
                  onClick={() => setMarginType('home')}
                  className={`py-1.5 px-2 rounded text-[12px] font-semibold transition-all cursor-pointer ${
                    marginType === 'home'
                      ? 'bg-white text-[#00236f] shadow-xs'
                      : 'text-[#444651]'
                  }`}
                >
                  Home Inkjet (5mm Safe)
                </button>
              </div>
            </div>
          </div>

          {/* Print Cost & Savings Calculator */}
          <div className="bg-[#ffdcc3]/40 p-4 rounded-xl border border-[#ffdcc3] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#904d00] font-bold">
                Print Cost Calculator
              </span>
              <span className="px-2 py-0.5 rounded bg-[#85f8c4] text-[#002114] text-[10px] font-bold uppercase">
                Save ₹52 per print
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mt-1">
              <div className="bg-white p-2 rounded-lg shadow-2xs">
                <span className="text-[10px] text-[#757682] block">Local Studio</span>
                <span className="font-['Outfit'] text-[16px] font-bold text-[#ba1a1a]">
                  ₹60.00
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-2xs">
                <span className="text-[10px] text-[#757682] block">Lab 4x6 Sheet</span>
                <span className="font-['Outfit'] text-[16px] font-bold text-[#003120]">
                  ₹8.00
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-2xs border border-[#85f8c4]">
                <span className="text-[10px] text-[#003120] font-bold block">Your Savings</span>
                <span className="font-['Outfit'] text-[16px] font-bold text-[#003120]">
                  ₹52.00
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#663500] leading-tight mt-1">
              Take this 4x6 PDF to any digital photo studio or print directly at home.
            </p>
          </div>
        </div>

        {/* RIGHT PREVIEW CANVAS: 7 Cols */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[#eaedff] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00236f] text-[20px]">
                  preview
                </span>
                <h3 className="text-[15px] font-bold text-[#131b2e]">
                  Sheet Layout Preview ({count} Copies)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInlineSimulateProof((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                    inlineSimulateProof
                      ? 'bg-[#00236f] text-white border-[#00236f]'
                      : 'bg-[#f2f3ff] text-[#444651] border-[#dae2fd] hover:bg-[#eaedff]'
                  }`}
                  title="Toggle CMYK Inkjet Proof Simulation"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    palette
                  </span>
                  <span>CMYK Proof</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(true)}
                  className="px-3 py-1 rounded-lg bg-[#00236f] text-white text-[11px] font-bold flex items-center gap-1.5 transition-all hover:bg-[#1e3a8a] shadow-xs cursor-pointer"
                  title="Open Full 1:1 Print Preview Simulator with Rulers"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    visibility
                  </span>
                  <span>Print Preview (1:1)</span>
                </button>
              </div>
            </div>

            {/* Interactive Sheet Preview Area */}
            <div
              id="passport-print-sheet"
              className={`w-full bg-[#f8fafc] rounded-xl p-4 sm:p-6 flex items-center justify-center border border-[#dae2fd] overflow-x-auto shadow-inner min-h-[420px] ${
                inlineSimulateProof ? 'print-proof-cmyk' : ''
              }`}
            >
              {/* Paper Canvas */}
              <div
                className={`bg-white shadow-xl rounded-sm p-4 relative transition-all printable-target ${
                  inlineSimulateProof ? 'print-paper-texture' : ''
                } ${
                  format === '4x6'
                    ? 'w-full max-w-[500px] aspect-[6/4]'
                    : 'w-full max-w-[440px] aspect-[1/1.414]'
                }`}
              >
                {/* Calibration Banner on Sheet */}
                <div className="absolute top-1 left-2 right-2 flex items-center justify-between text-[8px] text-[#94a3b8] font-mono border-b border-[#f1f5f9] pb-0.5 pointer-events-none">
                  <span>WEBODOCX STUDIO PRINT ENGINE • 300 DPI</span>
                  <span>SCALE 100% (DO NOT FIT TO PAGE)</span>
                </div>

                {/* Grid of Photos */}
                <div
                  className={`w-full h-full pt-4 grid gap-2.5 items-center justify-items-center ${
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
                      className={`relative bg-[#f8fafc] overflow-hidden flex flex-col items-center justify-between shadow-xs ${
                        whiteBorder ? 'border border-[#e2e8f0]' : ''
                      } ${
                        format === 'a4-32'
                          ? 'w-[42px] h-[54px]'
                          : 'w-[64px] sm:w-[72px] h-[82px] sm:h-[92px]'
                      }`}
                    >
                      {/* Corner Guide Ticks */}
                      {addCutLines && (
                        <>
                          <span className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-[#cbd5e1]"></span>
                          <span className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-[#cbd5e1]"></span>
                          <span className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-[#cbd5e1]"></span>
                          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-[#cbd5e1]"></span>
                        </>
                      )}

                      <img
                        src={photoSrc}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Name & DOP Stamp on Photo */}
                      {addDop && (
                        <div className="absolute bottom-0 inset-x-0 bg-white/95 text-center py-0.5 px-0.5 border-t border-[#eaedff]">
                          <div className="text-[6.5px] sm:text-[7.5px] font-bold text-[#131b2e] truncate uppercase leading-none">
                            {candidateName || 'CANDIDATE'}
                          </div>
                          <div className="text-[5.5px] sm:text-[6px] text-[#444651] font-mono leading-none mt-0.5 truncate">
                            {dateOfPhoto}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(true)}
                  className="px-3.5 py-2.5 rounded-lg bg-[#ffdcc3] hover:bg-[#fe932c] text-[#2f1500] text-[13px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    visibility
                  </span>
                  <span>Print Preview (Proof)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="px-4 py-2.5 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#00236f] text-[13px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-[#dae2fd]"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    print
                  </span>
                  <span>Direct Print (Ctrl + P)</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadPdf}
                className="px-6 py-2.5 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[13px] font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-75"
              >
                <span className="material-symbols-outlined text-[20px]">
                  download
                </span>
                <span>
                  {isGeneratingPdf
                    ? 'Creating 300 DPI PDF...'
                    : `Download Printable PDF (${count} Copies)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full 1:1 Scale Print Preview Simulation Modal */}
      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        title={`Passport Photo Sheet (${format.toUpperCase()})`}
        format={format}
        photoSrc={photoSrc}
        candidateName={candidateName}
        dateOfPhoto={dateOfPhoto}
        addDop={addDop}
        addCutLines={addCutLines}
        whiteBorder={whiteBorder}
        marginType={marginType}
      />
    </div>
  );
};
