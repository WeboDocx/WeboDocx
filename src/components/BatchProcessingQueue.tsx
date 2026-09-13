import React from 'react';
import JSZip from 'jszip';
import { BatchItem } from '../types';

interface BatchProcessingQueueProps {
  items: BatchItem[];
  isProcessing: boolean;
  onStartProcessing: () => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onAddFiles: (files: FileList | File[]) => void;
  title?: string;
  targetDescription?: string;
  zipFilename?: string;
  onDownloadSingle?: (item: BatchItem) => void;
}

export const BatchProcessingQueue: React.FC<BatchProcessingQueueProps> = ({
  items,
  isProcessing,
  onStartProcessing,
  onRemoveItem,
  onClearQueue,
  onAddFiles,
  title = 'Batch Queue',
  targetDescription = 'Processing against current target specifications',
  zipFilename = 'WeboDocx_Batch_Compliant.zip',
  onDownloadSingle,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const totalOriginalKb = items.reduce((acc, curr) => acc + curr.originalSizeKb, 0);
  const totalResultKb = items.reduce((acc, curr) => acc + (curr.resultSizeKb || curr.originalSizeKb), 0);
  const savedKb = completedCount > 0 ? Math.max(0, totalOriginalKb - totalResultKb) : 0;
  const savedPercent = totalOriginalKb > 0 && completedCount > 0 ? Math.round((savedKb / totalOriginalKb) * 100) : 0;

  const handleDownloadZip = async () => {
    const completedItems = items.filter((i) => i.status === 'completed' && i.resultBlob);
    if (completedItems.length === 0) return;

    const zip = new JSZip();
    completedItems.forEach((item) => {
      if (item.resultBlob) {
        // preserve original filename or attach appropriate extension
        const ext = item.resultBlob.type === 'application/pdf' ? '.pdf' : '.jpg';
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        zip.file(`${baseName}_compliant${ext}`, item.resultBlob);
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div
      id="batch-processing-queue-root"
      className="bg-white rounded-2xl shadow-sm border border-[#eaedff] overflow-hidden flex flex-col w-full"
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-[#f8fafc] border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00236f] text-white flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[20px]">
              dynamic_feed
            </span>
          </div>
          <div>
            <h3 className="font-['Outfit'] text-[16px] font-bold text-[#131b2e] flex items-center gap-2">
              <span>{title}</span>
              <span className="px-2 py-0.5 rounded-full bg-[#e2e7ff] text-[#00236f] text-[11px] font-mono font-bold">
                {items.length} Files
              </span>
            </h3>
            <p className="text-[12px] text-[#444651] mt-0.5">
              {targetDescription}
            </p>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-[#00236f] text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-[#dae2fd] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              add_circle
            </span>
            <span>Add More</span>
          </button>

          {items.length > 0 && (
            <button
              type="button"
              onClick={onClearQueue}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#ffebee] text-[#ba1a1a] text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-[#ffdad6] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                delete_sweep
              </span>
              <span>Clear</span>
            </button>
          )}

          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleDownloadZip}
              className="px-3.5 py-1.5 rounded-xl bg-[#003120] hover:bg-[#004a32] text-white text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">
                folder_zip
              </span>
              <span>Download ZIP ({completedCount})</span>
            </button>
          )}

          <button
            type="button"
            disabled={items.length === 0 || isProcessing}
            onClick={onStartProcessing}
            className="px-4 py-1.5 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isProcessing ? 'autorenew' : 'play_arrow'}
            </span>
            <span>{isProcessing ? 'Processing Queue...' : 'Run Batch Process'}</span>
          </button>
        </div>
      </div>

      {/* Progress & Compression Metrics Banner (if items exist) */}
      {items.length > 0 && (
        <div className="px-5 py-3 bg-[#f2f3ff]/60 border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-[#444651]">
                Queue Progress: {completedCount} / {items.length} Completed
              </span>
              <span className="font-mono text-[#00236f]">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-[#dae2fd] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00236f] to-[#004a32] transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[12px]">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#757682] uppercase font-semibold">Total Input</span>
              <span className="font-bold text-[#131b2e]">{(totalOriginalKb / 1024).toFixed(2)} MB</span>
            </div>
            {completedCount > 0 && (
              <>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#757682] uppercase font-semibold">Total Output</span>
                  <span className="font-bold text-[#003120]">{(totalResultKb / 1024).toFixed(2)} MB</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#004a32] uppercase font-bold">Space Saved</span>
                  <span className="font-bold text-[#004a32]">-{savedPercent}%</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Queue Items List */}
      <div className="divide-y divide-[#eaedff] max-h-[440px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-[#757682]">
            <div className="w-12 h-12 rounded-2xl bg-[#f2f3ff] text-[#00236f] flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[24px]">
                file_upload
              </span>
            </div>
            <p className="text-[14px] font-bold text-[#131b2e]">Batch Queue Empty</p>
            <p className="text-[12px] text-[#757682] mt-0.5 max-w-sm">
              Drag &amp; drop multiple photos, signatures, or documents here to process up to 50 files simultaneously.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 px-4 py-2 rounded-xl bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-all cursor-pointer shadow-xs"
            >
              Select Multiple Files
            </button>
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id}
              className={`p-3.5 sm:px-5 flex items-center justify-between gap-3 transition-colors ${
                item.status === 'processing'
                  ? 'bg-[#e2e7ff]/30'
                  : item.status === 'completed'
                  ? 'bg-white hover:bg-[#f8fafc]'
                  : 'bg-white hover:bg-[#f8fafc]'
              }`}
            >
              {/* Left: Thumbnail and Name */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-[11px] font-mono text-[#757682] w-5 text-right shrink-0">
                  {idx + 1}.
                </span>

                <div className="w-10 h-10 rounded-lg bg-[#f2f3ff] border border-[#dae2fd] overflow-hidden flex items-center justify-center shrink-0">
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[#757682] text-[18px]">
                      description
                    </span>
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[13px] font-bold text-[#131b2e] truncate">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-[#757682]">
                    <span>Input: {item.originalSizeKb} KB</span>
                    {item.resultSizeKb && (
                      <>
                        <span>•</span>
                        <span className="text-[#003120] font-semibold">
                          Output: {item.resultSizeKb} KB
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-[#85f8c4]/30 text-[#003120] font-mono text-[10px] font-bold">
                          -{Math.max(0, Math.round(((item.originalSizeKb - item.resultSizeKb) / item.originalSizeKb) * 100))}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Status Indicator & Item Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {item.status === 'queued' && (
                  <span className="px-2.5 py-1 rounded-full bg-[#f2f3ff] text-[#444651] text-[11px] font-medium border border-[#dae2fd]">
                    In Queue
                  </span>
                )}

                {item.status === 'processing' && (
                  <span className="px-2.5 py-1 rounded-full bg-[#e2e7ff] text-[#00236f] text-[11px] font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] animate-spin">
                      autorenew
                    </span>
                    <span>Processing...</span>
                  </span>
                )}

                {item.status === 'completed' && (
                  <span className="px-2.5 py-1 rounded-full bg-[#85f8c4]/30 text-[#003120] text-[11px] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      check_circle
                    </span>
                    <span>Ready</span>
                  </span>
                )}

                {item.status === 'error' && (
                  <span className="px-2.5 py-1 rounded-full bg-[#ffebee] text-[#ba1a1a] text-[11px] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      error
                    </span>
                    <span>Failed</span>
                  </span>
                )}

                {/* Individual Download */}
                {item.status === 'completed' && item.resultUrl && (
                  <a
                    href={item.resultUrl}
                    download={item.name.replace(/\.[^/.]+$/, '') + '_compliant' + (item.resultBlob?.type === 'application/pdf' ? '.pdf' : '.jpg')}
                    className="p-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#00236f] text-[#00236f] hover:text-white transition-colors cursor-pointer"
                    title="Download this file"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      download
                    </span>
                  </a>
                )}

                {/* Remove from queue */}
                {!isProcessing && (
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1.5 rounded-lg hover:bg-[#fee2e2] text-[#757682] hover:text-[#ba1a1a] transition-colors cursor-pointer"
                    title="Remove from batch"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      close
                    </span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
