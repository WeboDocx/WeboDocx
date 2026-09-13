import { ProcessedFileRecord } from '../types';

const STORAGE_KEY = 'WEBODOCX_RECENT_PROCESSED_ACTIVITIES_V1';
const MAX_RECENT_FILES = 5;

// In-memory cache for fast access and fallback if storage is restricted
let inMemoryRecentFiles: ProcessedFileRecord[] = [];

// Helper to check if string is a valid Data URL or Blob URL
export const downloadFileRecord = (item: ProcessedFileRecord): boolean => {
  if (!item.downloadUrl && !item.dataUrl) {
    return false;
  }

  try {
    const href = item.downloadUrl || item.dataUrl!;
    const a = document.createElement('a');
    a.href = href;
    a.download = item.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    console.error('Failed to trigger download for recent file:', err);
    return false;
  }
};

export const getRecentActivities = (): ProcessedFileRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: ProcessedFileRecord[] = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        inMemoryRecentFiles = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read recent activity from localStorage, using memory store:', err);
  }

  // If no items in storage, provide clean sample seed records so the user sees immediate value if empty
  return inMemoryRecentFiles;
};

export const recordRecentActivity = (
  record: Omit<ProcessedFileRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): ProcessedFileRecord[] => {
  try {
    const current = getRecentActivities();

    // Prepare new item
    const newItem: ProcessedFileRecord = {
      id: record.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: record.timestamp || Date.now(),
      fileName: record.fileName,
      category: record.category,
      fileType: record.fileType,
      sizeKb: record.sizeKb,
      originalSizeKb: record.originalSizeKb,
      details: record.details,
      downloadUrl: record.downloadUrl,
      dataUrl: record.dataUrl,
    };

    // Filter out identical file name if re-processed within short timeframe
    const filtered = current.filter(
      (item) => item.fileName !== newItem.fileName || Math.abs(item.timestamp - newItem.timestamp) > 5000
    );

    // Add to top and cap at MAX_RECENT_FILES (last 5 files)
    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_FILES);

    inMemoryRecentFiles = updated;

    // Persist to localStorage (handling quota gracefully if big dataUrl)
    try {
      // Create lightweight serializable version (omit oversized raw dataUrls if > 1MB to prevent QuotaExceededError)
      const serializableList = updated.map((item) => {
        if (item.dataUrl && item.dataUrl.length > 500000) {
          // If large, omit dataUrl from localStorage but keep in active session
          const { dataUrl, ...rest } = item;
          return rest;
        }
        return item;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableList));
    } catch (storageErr) {
      console.warn('localStorage save warning (likely quota exceeded), storing in memory:', storageErr);
      // Fallback: save without dataUrls
      try {
        const minimalList = updated.map(({ dataUrl, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalList));
      } catch (e) {
        // storage disabled/blocked
      }
    }

    // Dispatch a custom window event so open panels or tabs instantly re-render
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('webodocx:activity_updated', { detail: updated }));
    }

    return updated;
  } catch (err) {
    console.error('Error recording recent activity:', err);
    return inMemoryRecentFiles;
  }
};

export const clearRecentActivities = (): void => {
  inMemoryRecentFiles = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Could not clear localStorage recent activities:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('webodocx:activity_updated', { detail: [] }));
  }
};
