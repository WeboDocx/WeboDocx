import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { ToastMessage, TaskManager } from '../types';
import {
  getPdfInfo,
  renderPdfPageToImage,
  parsePageRangeString,
  extractPdfPagesRange,
  splitPdfToIndividualPages,
} from '../utils/pdfConverter';
import { recordRecentActivity } from '../utils/recentActivityStore';

interface SplitPdfToolSectionProps {
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  taskManager?: TaskManager;
}

interface PageThumbnail {
  pageNumber: number;
  dataUrl?: string;
  selected: boolean;
}

export const SplitPdfToolSection: React.FC<SplitPdfToolSectionProps> = ({
  onAddToast,
  taskManager,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  // Split Mode: 'range' | 'all-single'
  const [splitMode, setSplitMode] = useState<'range' | 'all-single'>('range');
  const [rangeInput, setRangeInput] = useState<string>('1');
  const [customExtractTitle, setCustomExtractTitle] = useState<string>('');

  // Page thumbnails and visual checkbox selection
  const [pageThumbs, setPageThumbs] = useState<PageThumbnail[]>([]);
  const [isLoadingThumbs, setIsLoadingThumbs] = useState<boolean>(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [downloadResults, setDownloadResults] = useState<{
    type: 'single-pdf' | 'zip';
    fileName: string;
    url: string;
    sizeKb: number;
    details: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load PDF file handler
  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile || !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      onAddToast({
        title: 'Invalid File',
        description: 'Please select a valid .pdf document.',
        type: 'error',
      });
      return;
    }

    setIsLoadingFile(true);
    setDownloadResults(null);
    taskManager?.startTask(`Loading ${selectedFile.name}`, 20, 'Reading PDF structure...');

    try {
      const buffer = await selectedFile.arrayBuffer();
      const info = await getPdfInfo(buffer);

      if (info.numPages <= 0) {
        throw new Error('PDF has 0 pages or is unreadable.');
      }

      setFile(selectedFile);
      setPdfBuffer(buffer);
      setTotalPages(info.numPages);
      setFileSizeKb(Math.round(selectedFile.size / 1024));
      setCustomExtractTitle(`${selectedFile.name.replace(/\.pdf$/i, '')}_Extracted`);

      // Initialize default range & thumbnails
      const initialThumbs: PageThumbnail[] = [];
      for (let i = 1; i <= info.numPages; i++) {
        initialThumbs.push({
          pageNumber: i,
          selected: i === 1,
        });
      }
      setPageThumbs(initialThumbs);
      setRangeInput(info.numPages > 1 ? `1-${Math.min(2, info.numPages)}` : '1');

      taskManager?.completeTask(`Loaded PDF (${info.numPages} Pages)`, 400);

      onAddToast({
        title: 'PDF Loaded',
        description: `${selectedFile.name} (${info.numPages} pages, ${Math.round(selectedFile.size / 1024)} KB) ready to split.`,
        type: 'info',
      });

      // Load thumbnail previews asynchronously
      loadThumbnails(buffer, info.numPages);
    } catch (err: any) {
      console.error('PDF load error:', err);
      taskManager?.failTask('Failed to load PDF');
      onAddToast({
        title: 'Failed to Open PDF',
        description: err?.message || 'File might be password-protected or corrupt.',
        type: 'error',
      });
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Asynchronous thumbnail rendering for visual page selector
  const loadThumbnails = async (buffer: ArrayBuffer, total: number) => {
    setIsLoadingThumbs(true);
    try {
      const maxToRender = Math.min(total, 24); // load up to first 24 pages quickly
      for (let p = 1; p <= maxToRender; p++) {
        try {
          const thumb = await renderPdfPageToImage(buffer, p, 'image/jpeg', 0.6);
          setPageThumbs((prev) =>
            prev.map((item) =>
              item.pageNumber === p ? { ...item, dataUrl: thumb.dataUrl } : item
            )
          );
        } catch {
          // Ignore individual thumbnail fail
        }
      }
    } finally {
      setIsLoadingThumbs(false);
    }
  };

  // Sync selected page checkboxes with range string
  const handleTogglePageSelect = (pageNum: number) => {
    setPageThumbs((prev) => {
      const updated = prev.map((item) =>
        item.pageNumber === pageNum ? { ...item, selected: !item.selected } : item
      );
      const selectedNums = updated.filter((i) => i.selected).map((i) => i.pageNumber);
      
      // Convert list of numbers to compact range string
      if (selectedNums.length === 0) {
        setRangeInput('');
      } else {
        setRangeInput(selectedNums.join(', '));
      }
      return updated;
    });
  };

  // Sync range input typing with page thumbnails
  const handleRangeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRangeInput(val);
    const parsed = parsePageRangeString(val, totalPages);
    const parsedSet = new Set(parsed);

    setPageThumbs((prev) =>
      prev.map((item) => ({
        ...item,
        selected: parsedSet.has(item.pageNumber),
      }))
    );
  };

  // Quick Range Presets
  const applyQuickPreset = (type: 'all' | 'first' | 'last' | 'odd' | 'even') => {
    if (!totalPages) return;
    let selectedNums: number[] = [];

    if (type === 'all') {
      selectedNums = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else if (type === 'first') {
      selectedNums = [1];
    } else if (type === 'last') {
      selectedNums = [totalPages];
    } else if (type === 'odd') {
      selectedNums = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
    } else if (type === 'even') {
      selectedNums = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
    }

    const setNums = new Set(selectedNums);
    setPageThumbs((prev) =>
      prev.map((item) => ({
        ...item,
        selected: setNums.has(item.pageNumber),
      }))
    );

    if (type === 'all') {
      setRangeInput(`1-${totalPages}`);
    } else {
      setRangeInput(selectedNums.join(', '));
    }
  };

  // Execute Split / Extract
  const handleExecuteSplit = async () => {
    if (!file || !pdfBuffer) return;
    setIsProcessing(true);

    try {
      if (splitMode === 'range') {
        const pagesToExtract = parsePageRangeString(rangeInput, totalPages);
        if (pagesToExtract.length === 0) {
          throw new Error('Please select at least 1 valid page number or enter a valid page range.');
        }

        taskManager?.startTask(
          `Extracting ${pagesToExtract.length} Pages...`,
          30,
          `Copying vector streams for pages: ${pagesToExtract.join(', ')}...`
        );

        const cleanTitle = (customExtractTitle.trim() || 'Extracted_Pages').replace(/\.pdf$/i, '');
        const { pdfBlob, sizeKb, totalPages: extractedCount } = await extractPdfPagesRange(
          pdfBuffer,
          pagesToExtract,
          { title: cleanTitle }
        );

        const downloadName = `${cleanTitle}.pdf`;
        const url = URL.createObjectURL(pdfBlob);

        // Auto trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Record recent activity
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          recordRecentActivity({
            fileName: downloadName,
            category: 'pdf-split',
            fileType: 'pdf',
            sizeKb,
            originalSizeKb: fileSizeKb,
            details: `Extracted ${extractedCount} Page(s) [Pages: ${pagesToExtract.join(', ')}]`,
            dataUrl: base64data,
          });
        };
        reader.readAsDataURL(pdfBlob);

        setDownloadResults({
          type: 'single-pdf',
          fileName: downloadName,
          url,
          sizeKb,
          details: `Extracted ${extractedCount} Pages (Pages: ${pagesToExtract.join(', ')})`,
        });

        taskManager?.completeTask(`Extracted ${extractedCount} pages (${sizeKb} KB)`, 500);

        onAddToast({
          title: 'PDF Extracted Successfully!',
          description: `Generated ${downloadName} with ${extractedCount} pages (${sizeKb} KB). Download initiated.`,
          type: 'success',
        });
      } else {
        // All pages split into individual single page PDF files packaged in a ZIP
        taskManager?.startTask(
          `Splitting ${totalPages} Pages into Individual PDFs...`,
          20,
          'Generating standalone single-page PDFs...'
        );

        const baseName = file.name.replace(/\.pdf$/i, '');
        const pagesList = await splitPdfToIndividualPages(
          pdfBuffer,
          baseName,
          (curr, total) => {
            taskManager?.updateProgress(
              Math.round((curr / total) * 70) + 15,
              `Splitting page ${curr} of ${total}...`
            );
          }
        );

        taskManager?.updateProgress(85, 'Packaging single-page PDFs into ZIP bundle...');

        const zip = new JSZip();
        const zipFolder = zip.folder(`${baseName}_Individual_Pages`);

        pagesList.forEach((p) => {
          zipFolder?.file(p.fileName, p.blob);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const zipSizeKb = Math.round(zipBlob.size / 1024);
        const zipName = `${baseName}_All_${totalPages}_Pages_Split.zip`;
        const zipUrl = URL.createObjectURL(zipBlob);

        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Record in recent activities
        recordRecentActivity({
          fileName: zipName,
          category: 'pdf-split',
          fileType: 'zip',
          sizeKb: zipSizeKb,
          originalSizeKb: fileSizeKb,
          details: `Split into ${totalPages} Individual Single-Page PDFs`,
        });

        setDownloadResults({
          type: 'zip',
          fileName: zipName,
          url: zipUrl,
          sizeKb: zipSizeKb,
          details: `Contains ${totalPages} standalone single-page PDF files`,
        });

        taskManager?.completeTask(`Split into ${totalPages} standalone PDFs (${zipSizeKb} KB ZIP)`, 500);

        onAddToast({
          title: 'PDF Split Completed!',
          description: `All ${totalPages} pages split into individual PDFs and bundled into ${zipName}.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      console.error('PDF Split error:', err);
      taskManager?.failTask(`Split error: ${err?.message}`);
      onAddToast({
        title: 'Split Failed',
        description: err?.message || 'Could not split PDF. File might be protected.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPdfBuffer(null);
    setTotalPages(0);
    setFileSizeKb(0);
    setPageThumbs([]);
    setDownloadResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const selectedCount = pageThumbs.filter((p) => p.selected).length;

  return (
    <div id="split-pdf-section" className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-[#f2f3ff] rounded-xl p-4 border border-[#dae2fd] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00236f] text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[22px]">call_split</span>
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-[#131b2e]">
              Split PDF &amp; Page Range Extractor
            </h3>
            <p className="text-[12.5px] text-[#444651]">
              Extract specific page ranges (e.g. 1st page marksheet, ID page) or split every page into separate individual PDF files.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="px-2.5 py-1 rounded-full bg-white text-[#00236f] text-[11px] font-bold border border-[#dae2fd] shadow-2xs">
            100% Lossless Vector Streams
          </span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileChange(e.target.files[0]);
          }
        }}
      />

      {/* Main Workspace */}
      {!file ? (
        /* Empty State Upload Dropzone */
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) {
              handleFileChange(e.dataTransfer.files[0]);
            }
          }}
          className="bg-white border-2 border-dashed border-[#b6c4ff] hover:border-[#00236f] rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-[#f8faff] flex flex-col items-center justify-center group shadow-xs"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#eaedff] group-hover:bg-[#00236f] group-hover:text-white text-[#00236f] flex items-center justify-center mb-3 transition-colors">
            <span className="material-symbols-outlined text-[32px]">upload_file</span>
          </div>
          <h4 className="text-[17px] font-bold text-[#131b2e] mb-1">
            Click or Drag &amp; Drop Multi-Page PDF Here
          </h4>
          <p className="text-[13px] text-[#555770] max-w-md mb-4 leading-relaxed">
            Upload any multi-page PDF document (Certificates, Form Acknowledgments, Marksheets, Gazette, etc.) to extract or split pages.
          </p>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-[#00236f] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs">
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              <span>Select PDF File</span>
            </span>
          </div>
        </div>
      ) : (
        /* Loaded PDF Split Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Split Controls & Range Settings */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-[#eaedff] flex flex-col gap-4">
              {/* Document Summary */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#eaedff]">
                <div className="min-w-0">
                  <span className="text-[11px] text-[#757682] uppercase font-bold tracking-wider">
                    Current Document
                  </span>
                  <h4 className="text-[14px] font-bold text-[#131b2e] truncate" title={file.name}>
                    {file.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded bg-[#eaedff] text-[#00236f] text-[11px] font-bold">
                      {totalPages} Pages
                    </span>
                    <span className="text-[11px] text-[#444651] font-mono">
                      {fileSizeKb > 1024 ? `${(fileSizeKb / 1024).toFixed(1)} MB` : `${fileSizeKb} KB`}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors cursor-pointer"
                  title="Change PDF Document"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="text-[12px] font-bold text-[#131b2e] mb-2 block">
                  Select Split Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSplitMode('range')}
                    className={`py-2.5 px-3 rounded-xl text-[12px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                      splitMode === 'range'
                        ? 'bg-[#00236f] text-white border-[#00236f] shadow-sm'
                        : 'bg-[#f2f3ff] text-[#444651] border-[#dae2fd] hover:bg-[#eaedff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">filter_frames</span>
                    <span>Extract Pages</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSplitMode('all-single')}
                    className={`py-2.5 px-3 rounded-xl text-[12px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                      splitMode === 'all-single'
                        ? 'bg-[#00236f] text-white border-[#00236f] shadow-sm'
                        : 'bg-[#f2f3ff] text-[#444651] border-[#dae2fd] hover:bg-[#eaedff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">splitscreen</span>
                    <span>Split All Pages</span>
                  </button>
                </div>
              </div>

              {/* Range Mode Configuration */}
              {splitMode === 'range' ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[12px] font-bold text-[#131b2e]">
                        Page Range Expression
                      </label>
                      <span className="text-[11px] text-[#00236f] font-mono font-semibold">
                        {selectedCount} of {totalPages} Selected
                      </span>
                    </div>

                    <input
                      type="text"
                      value={rangeInput}
                      onChange={handleRangeInputChange}
                      placeholder="e.g. 1, 3, 5-8, 10"
                      className="w-full px-3 py-2 rounded-lg bg-[#f8fafc] border border-[#cbd5e1] text-[13px] font-mono text-[#131b2e] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00236f]"
                    />
                    <span className="text-[10.5px] text-[#757682] mt-1 block">
                      Use comma for multiple pages (e.g. <strong>1, 3</strong>) and hyphen for ranges (e.g. <strong>2-5</strong>).
                    </span>
                  </div>

                  {/* Quick Range Selection Chips */}
                  <div>
                    <label className="text-[11px] text-[#757682] uppercase font-bold tracking-wider mb-1.5 block">
                      Quick Selection:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyQuickPreset('all')}
                        className="px-2.5 py-1 rounded-md bg-[#eaedff] hover:bg-[#00236f] hover:text-white text-[#00236f] text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        All Pages
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPreset('first')}
                        className="px-2.5 py-1 rounded-md bg-[#f2f3ff] hover:bg-[#00236f] hover:text-white text-[#444651] text-[11px] font-semibold transition-colors cursor-pointer border border-[#dae2fd]"
                      >
                        Page 1 Only
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPreset('last')}
                        className="px-2.5 py-1 rounded-md bg-[#f2f3ff] hover:bg-[#00236f] hover:text-white text-[#444651] text-[11px] font-semibold transition-colors cursor-pointer border border-[#dae2fd]"
                      >
                        Last Page
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPreset('odd')}
                        className="px-2.5 py-1 rounded-md bg-[#f2f3ff] hover:bg-[#00236f] hover:text-white text-[#444651] text-[11px] font-semibold transition-colors cursor-pointer border border-[#dae2fd]"
                      >
                        Odd Pages
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPreset('even')}
                        className="px-2.5 py-1 rounded-md bg-[#f2f3ff] hover:bg-[#00236f] hover:text-white text-[#444651] text-[11px] font-semibold transition-colors cursor-pointer border border-[#dae2fd]"
                      >
                        Even Pages
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-bold text-[#131b2e] mb-1.5 block">
                      Extracted PDF File Title
                    </label>
                    <input
                      type="text"
                      value={customExtractTitle}
                      onChange={(e) => setCustomExtractTitle(e.target.value)}
                      placeholder="Extracted_Document_Name"
                      className="w-full px-3 py-2 rounded-lg bg-[#f8fafc] border border-[#cbd5e1] text-[13px] text-[#131b2e] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00236f]"
                    />
                  </div>
                </div>
              ) : (
                /* All Pages Mode Info */
                <div className="bg-[#f8fafc] p-3.5 rounded-xl border border-[#dae2fd] flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#00236f] font-bold text-[13px]">
                    <span className="material-symbols-outlined text-[18px]">folder_zip</span>
                    <span>1-Click ZIP Packaging</span>
                  </div>
                  <p className="text-[12px] text-[#444651] leading-relaxed">
                    Will generate <strong>{totalPages} separate standalone PDF files</strong> (e.g. Page_1.pdf, Page_2.pdf ... Page_{totalPages}.pdf) and bundle them in a single downloadable ZIP archive.
                  </p>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                disabled={isProcessing || (splitMode === 'range' && selectedCount === 0)}
                onClick={handleExecuteSplit}
                className="w-full py-3 px-4 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition-all active:scale-[0.99]"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                    <span>Processing Document...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      {splitMode === 'range' ? 'file_download' : 'folder_zip'}
                    </span>
                    <span>
                      {splitMode === 'range'
                        ? `Extract ${selectedCount} Page(s) to PDF`
                        : `Split All ${totalPages} Pages (Download ZIP)`}
                    </span>
                  </>
                )}
              </button>

              {/* Download Result Box if already generated */}
              {downloadResults && (
                <div className="p-3.5 rounded-xl bg-[#85f8c4]/20 border border-[#85f8c4] flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#003120] text-[18px]">
                      check_circle
                    </span>
                    <span className="text-[13px] font-bold text-[#003120]">
                      Ready for Download!
                    </span>
                  </div>
                  <p className="text-[12px] text-[#004a32] truncate font-medium">
                    {downloadResults.fileName} ({downloadResults.sizeKb} KB)
                  </p>
                  <p className="text-[11px] text-[#555770]">
                    {downloadResults.details}
                  </p>
                  <a
                    href={downloadResults.url}
                    download={downloadResults.fileName}
                    className="py-1.5 px-3 bg-[#003120] hover:bg-[#004a32] text-white text-[12px] font-bold rounded-lg text-center cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Download Again</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Visual Page Grid Selector */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-[#eaedff] flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#eaedff]">
                <div>
                  <h3 className="text-[15px] font-bold text-[#131b2e]">
                    Visual Page Grid ({totalPages} Total Pages)
                  </h3>
                  <p className="text-[12px] text-[#444651]">
                    Click individual pages to toggle extraction or use the range input on the left.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickPreset('all')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#eaedff] text-[#00236f] hover:bg-[#00236f] hover:text-white transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPageThumbs((prev) => prev.map((item) => ({ ...item, selected: false })));
                      setRangeInput('');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#f2f3ff] text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors cursor-pointer border border-[#dae2fd]"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Grid of Pages */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto p-1">
                {pageThumbs.map((page) => (
                  <div
                    key={page.pageNumber}
                    onClick={() => handleTogglePageSelect(page.pageNumber)}
                    className={`relative rounded-xl p-2 flex flex-col items-center justify-between transition-all cursor-pointer border-2 ${
                      page.selected
                        ? 'border-[#00236f] bg-[#f0f4ff] shadow-sm'
                        : 'border-[#eaedff] bg-[#f8fafc] hover:border-[#b6c4ff]'
                    }`}
                  >
                    {/* Top Page Header */}
                    <div className="w-full flex items-center justify-between gap-1 mb-1.5 px-0.5">
                      <span className="text-[11px] font-bold font-mono text-[#131b2e]">
                        Page {page.pageNumber}
                      </span>
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center text-white transition-colors ${
                          page.selected ? 'bg-[#00236f]' : 'border border-[#cbd5e1] bg-white'
                        }`}
                      >
                        {page.selected && (
                          <span className="material-symbols-outlined text-[13px] font-bold">
                            check
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thumbnail Render Area */}
                    <div className="w-full aspect-[1/1.3] bg-white rounded-lg border border-[#dae2fd] flex items-center justify-center overflow-hidden shadow-2xs">
                      {page.dataUrl ? (
                        <img
                          src={page.dataUrl}
                          alt={`Page ${page.pageNumber}`}
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[#757682] gap-1 p-2 text-center">
                          <span className="material-symbols-outlined text-[20px]">
                            description
                          </span>
                          <span className="text-[10px] font-mono">
                            {isLoadingThumbs ? 'Loading...' : `Page ${page.pageNumber}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
