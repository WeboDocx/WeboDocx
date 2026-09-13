import React, { useState, useEffect } from 'react';
import { ProcessedFileRecord, NavView } from '../types';
import {
  getRecentActivities,
  clearRecentActivities,
  downloadFileRecord,
} from '../utils/recentActivityStore';

interface RecentActivityPanelProps {
  onNavigate: (view: NavView) => void;
  onSelectPreset?: (presetId: string) => void;
}

export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = ({
  onNavigate,
}) => {
  const [activities, setActivities] = useState<ProcessedFileRecord[]>([]);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  const loadActivities = () => {
    const list = getRecentActivities();
    setActivities(list);
  };

  useEffect(() => {
    loadActivities();

    const handleUpdate = () => {
      loadActivities();
    };

    window.addEventListener('webodocx:activity_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('webodocx:activity_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleClear = () => {
    clearRecentActivities();
    setActivities([]);
  };

  const handleReDownload = (item: ProcessedFileRecord) => {
    const success = downloadFileRecord(item);
    if (success) {
      setDownloadSuccessId(item.id);
      setTimeout(() => {
        setDownloadSuccessId(null);
      }, 2000);
    }
  };

  const getCategoryIcon = (category: ProcessedFileRecord['category']) => {
    switch (category) {
      case 'photo-resizer':
        return 'photo_camera';
      case 'signature-resizer':
        return 'draw';
      case 'passport-maker':
        return 'grid_on';
      case 'camera-scanner':
        return 'scanner';
      case 'pdf-compress':
        return 'compress';
      case 'pdf-merge':
        return 'call_merge';
      case 'pdf-split':
        return 'call_split';
      case 'digital-sign':
        return 'ink_pen';
      case 'ocr':
        return 'document_scanner';
      case 'docx-pdf':
      case 'pdf-docx':
        return 'article';
      case 'img-pdf':
      case 'pdf-img':
        return 'photo_size_select_actual';
      default:
        return 'description';
    }
  };

  const getCategoryLabel = (category: ProcessedFileRecord['category']) => {
    switch (category) {
      case 'photo-resizer':
        return 'Photo Resizer';
      case 'signature-resizer':
        return 'Signature Resizer';
      case 'passport-maker':
        return 'Passport Sheet';
      case 'camera-scanner':
        return 'Camera Scanner';
      case 'pdf-compress':
        return 'PDF Compressor';
      case 'pdf-merge':
        return 'PDF Merge';
      case 'pdf-split':
        return 'PDF Split';
      case 'digital-sign':
        return 'Digital Attestation';
      case 'ocr':
        return 'OCR Extractor';
      case 'docx-pdf':
        return 'Word to PDF';
      case 'pdf-docx':
        return 'PDF to Word';
      case 'img-pdf':
        return 'Image to PDF';
      case 'pdf-img':
        return 'PDF to Image';
      default:
        return 'Document Processed';
    }
  };

  const formatTimestamp = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleToolJump = (category: ProcessedFileRecord['category']) => {
    switch (category) {
      case 'photo-resizer':
      case 'signature-resizer':
        onNavigate('exam-photo-sign-resizer');
        break;
      case 'passport-maker':
        onNavigate('passport-sheet-maker');
        break;
      case 'camera-scanner':
        onNavigate('camera-scanner');
        break;
      case 'pdf-compress':
      case 'pdf-merge':
      case 'pdf-split':
      case 'digital-sign':
      case 'ocr':
      case 'docx-pdf':
      case 'pdf-docx':
      case 'img-pdf':
      case 'pdf-img':
        onNavigate('pdf-tools');
        break;
      default:
        break;
    }
  };

  return (
    <div
      id="recent-activity-panel"
      className="w-full bg-white rounded-xl p-5 shadow-sm mb-6 border border-[#eaedff]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#00236f]">
            <span className="material-symbols-outlined text-[20px]">history</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-bold text-[#131b2e]">Recent Activity</h3>
              <span className="px-2 py-0.5 rounded-full bg-[#f2f3ff] text-[#00236f] text-[11px] font-mono font-semibold border border-[#dae2fd]">
                Last {activities.length}/5 Files
              </span>
            </div>
            <p className="text-[12px] text-[#444651]">
              Quickly re-download your recently generated photos, scanned documents, and PDFs
            </p>
          </div>
        </div>

        {activities.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#ba1a1a] hover:bg-[#ffdad6] hover:text-[#410002] transition-colors cursor-pointer border border-[#ffdad6]"
            title="Clear recently processed files list"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            <span>Clear List</span>
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="bg-[#f8fafc] rounded-xl p-6 text-center border border-dashed border-[#dae2fd] flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#eaedff] flex items-center justify-center text-[#00236f] mb-2">
            <span className="material-symbols-outlined text-[24px]">folder_open</span>
          </div>
          <h4 className="text-[14px] font-bold text-[#131b2e] mb-1">
            No processed files yet in this session
          </h4>
          <p className="text-[12px] text-[#757682] max-w-md mb-4">
            Resize a photo or signature, scan a multi-page document with your camera, or compress a PDF. Your last 5 processed files will appear here for instant 1-click re-download.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => onNavigate('exam-photo-sign-resizer')}
              className="px-3 py-1.5 rounded-lg bg-[#00236f] text-white text-[12px] font-semibold hover:bg-[#1e3a8a] transition-all cursor-pointer shadow-2xs"
            >
              Resize Photo / Sign
            </button>
            <button
              type="button"
              onClick={() => onNavigate('camera-scanner')}
              className="px-3 py-1.5 rounded-lg bg-[#eaedff] text-[#00236f] text-[12px] font-semibold hover:bg-[#d5deff] transition-all cursor-pointer border border-[#dae2fd]"
            >
              Scan Document
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pdf-tools')}
              className="px-3 py-1.5 rounded-lg bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#eaedff] transition-all cursor-pointer border border-[#dae2fd]"
            >
              Compress PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[#eaedff]">
          {activities.map((item) => (
            <div
              key={item.id}
              className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#f8f9ff] rounded-lg transition-colors"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div
                  onClick={() => handleToolJump(item.category)}
                  className="w-10 h-10 rounded-lg bg-[#e2e7ff] text-[#00236f] flex items-center justify-center shrink-0 cursor-pointer hover:bg-[#00236f] hover:text-white transition-colors"
                  title={`Open ${getCategoryLabel(item.category)}`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {getCategoryIcon(item.category)}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#131b2e] truncate max-w-[260px] sm:max-w-[340px] md:max-w-[420px]">
                      {item.fileName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#eaedff] text-[#00236f] shrink-0">
                      {getCategoryLabel(item.category)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#444651] mt-0.5 flex-wrap">
                    <span className="font-mono font-bold text-[#003120] bg-[#85f8c4]/30 px-1.5 py-0.2 rounded">
                      {item.sizeKb} KB
                    </span>
                    {item.originalSizeKb && item.originalSizeKb > item.sizeKb && (
                      <span className="line-through text-[#757682]">
                        {item.originalSizeKb} KB
                      </span>
                    )}
                    <span>•</span>
                    <span className="text-[#555770]">{item.details}</span>
                    <span>•</span>
                    <span className="text-[#757682]">{formatTimestamp(item.timestamp)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleToolJump(item.category)}
                  className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-[#444651] bg-[#f2f3ff] hover:bg-[#eaedff] hover:text-[#00236f] transition-all cursor-pointer border border-[#dae2fd]"
                  title="Open Tool"
                >
                  Open Tool
                </button>

                <button
                  type="button"
                  onClick={() => handleReDownload(item)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all shadow-xs cursor-pointer ${
                    downloadSuccessId === item.id
                      ? 'bg-[#003120] text-white'
                      : 'bg-[#00236f] text-white hover:bg-[#1e3a8a] active:scale-[0.98]'
                  }`}
                  title="Re-download this file"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {downloadSuccessId === item.id ? 'check' : 'download'}
                  </span>
                  <span>{downloadSuccessId === item.id ? 'Downloaded' : 'Re-Download'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
