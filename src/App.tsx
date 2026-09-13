import React, { useState, useEffect, useRef } from 'react';
import { NavView, Language, ThemeMode, ToastMessage, GlobalLoadingTask, TaskManager } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ResizerView } from './components/ResizerView';
import { PassportStudioView } from './components/PassportStudioView';
import { SchemeFinderView } from './components/SchemeFinderView';
import { PdfToolsView } from './components/PdfToolsView';
import { QrCodeStudioView } from './components/QrCodeStudioView';
import { CameraScannerView } from './components/CameraScannerView';
import { QuickQrModal } from './components/QuickQrModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { RulesSpecsModal } from './components/RulesSpecsModal';
import { ToastContainer } from './components/Toast';
import { GlobalProgressBar } from './components/GlobalProgressBar';

export function App() {
  const [currentView, setCurrentView] = useState<NavView>('utility-dashboard');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('ssc-cgl');
  const [cyberMode, setCyberMode] = useState<boolean>(false);
  const [language, setLanguage] = useState<Language>('EN');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const savedTheme = localStorage.getItem('webodocx_theme') as ThemeMode;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('webodocx_sidebar_open');
      if (saved !== null) {
        return saved === 'true';
      }
      return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
    } catch {
      return true;
    }
  });
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isQuickQrOpen, setIsQuickQrOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Synchronize Dark Theme class on Document Element
  useEffect(() => {
    try {
      localStorage.setItem('webodocx_theme', theme);
    } catch (e) {
      console.warn('Unable to persist theme to localStorage', e);
    }

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  // Synchronize Sidebar Open State
  useEffect(() => {
    try {
      localStorage.setItem('webodocx_sidebar_open', String(isSidebarOpen));
    } catch (e) {
      console.warn('Unable to persist sidebar state to localStorage', e);
    }
  }, [isSidebarOpen]);

  // Global Loading State
  const [loadingTask, setLoadingTask] = useState<GlobalLoadingTask>({
    active: false,
    label: '',
    progress: 0,
    statusText: '',
  });

  const completeTimeoutRef = useRef<any>(null);

  const taskManager: TaskManager = {
    startTask: (label: string, initialProgress = 10, statusText = 'Initializing task...') => {
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      setLoadingTask({
        active: true,
        label,
        progress: initialProgress,
        statusText,
      });
    },
    updateProgress: (progress: number, statusText?: string) => {
      setLoadingTask((prev) => ({
        ...prev,
        active: true,
        progress,
        statusText: statusText !== undefined ? statusText : prev.statusText,
      }));
    },
    completeTask: (finalStatus = 'Task completed successfully', delayMs = 600) => {
      setLoadingTask((prev) => ({
        ...prev,
        progress: 100,
        statusText: finalStatus,
      }));
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = setTimeout(() => {
        setLoadingTask((prev) => ({ ...prev, active: false, progress: 0, statusText: '' }));
      }, delayMs);
    },
    cancelTask: () => {
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      setLoadingTask({ active: false, label: '', progress: 0, statusText: '' });
    },
    isLoading: loadingTask.active,
  };

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newToast: ToastMessage = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Keyboard shortcut listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#131b2e] flex flex-col font-['Inter'] antialiased selection:bg-[#00236f] selection:text-white">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Application Header */}
      <Header
        currentView={currentView}
        onNavigate={setCurrentView}
        cyberMode={cyberMode}
        onToggleCyberMode={(val) => {
          setCyberMode(val);
          addToast({
            title: val ? 'CSC Cyber Mode Enabled' : 'Standard Mode',
            description: val
              ? 'Optimized for high-volume cyber cafe and kiosk operators.'
              : 'Switched to citizen standard mode.',
            type: 'info',
          });
        }}
        language={language}
        onChangeLanguage={setLanguage}
        theme={theme}
        onToggleTheme={(newTheme) => {
          setTheme(newTheme);
          addToast({
            title: newTheme === 'dark' ? 'Night Dark Mode Enabled' : 'Citizen Light Mode Enabled',
            description: newTheme === 'dark'
              ? 'High-contrast dark palette activated to reduce eye strain during night-time editing.'
              : 'Citizen daylight theme restored.',
            type: 'info',
          });
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenQuickQr={() => setIsQuickQrOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex pt-16 relative">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          language={language}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Dynamic Main Workspace Canvas (with responsive left-margin offset for 64-width sidebar) */}
        <main
          id="main-content-canvas"
          className={`flex-1 transition-all duration-300 ease-in-out p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] w-full relative ${
            isSidebarOpen ? 'lg:ml-64 max-w-[1600px]' : 'ml-0 max-w-[1750px]'
          }`}
        >
          {/* Quick Floating Show Sidebar Button when Sidebar is Closed */}
          {!isSidebarOpen && (
            <button
              id="sidebar-quick-reveal-btn"
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              title={language === 'EN' ? 'Show Workspace Sidebar' : 'कार्यक्षेत्र साइडबार दिखाएं'}
              aria-label="Show Workspace Sidebar"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white shadow-md hover:shadow-lg border border-[#dae2fd] text-[#00236f] hover:bg-[#eaedff] text-[12px] font-bold transition-all cursor-pointer mb-4 sticky top-20 z-20 group"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">
                menu
              </span>
              <span>{language === 'EN' ? 'Show Tools Sidebar' : 'टूल्स साइडबार दिखाएं'}</span>
            </button>
          )}
          {/* Global Task Linear Progress Bar (Tracks background operations across all tools) */}
          <GlobalProgressBar
            task={loadingTask}
            onCancel={taskManager.cancelTask}
          />

          {currentView === 'utility-dashboard' && (
            <DashboardView
              onNavigate={setCurrentView}
              onSelectPreset={setSelectedPresetId}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenQuickQr={() => setIsQuickQrOpen(true)}
              language={language}
            />
          )}

          {currentView === 'exam-photo-sign-resizer' && (
            <ResizerView
              selectedPresetId={selectedPresetId}
              onSelectPreset={setSelectedPresetId}
              onNavigate={setCurrentView}
              onAddToast={addToast}
              taskManager={taskManager}
            />
          )}

          {currentView === 'passport-sheet-maker' && (
            <PassportStudioView
              onAddToast={addToast}
              taskManager={taskManager}
            />
          )}

          {currentView === 'scheme-finder' && (
            <SchemeFinderView
              onAddToast={addToast}
              taskManager={taskManager}
            />
          )}

          {currentView === 'pdf-tools-compress' && (
            <PdfToolsView
              onAddToast={addToast}
              taskManager={taskManager}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'camera-scanner' && (
            <CameraScannerView
              onAddToast={addToast}
              taskManager={taskManager}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'qr-code-generator' && (
            <QrCodeStudioView
              onAddToast={addToast}
              taskManager={taskManager}
              language={language}
            />
          )}
        </main>
      </div>

      {/* Quick QR Code Modal */}
      <QuickQrModal
        isOpen={isQuickQrOpen}
        onClose={() => setIsQuickQrOpen(false)}
        onAddToast={addToast}
      />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPreset={setSelectedPresetId}
        onNavigate={setCurrentView}
      />

      {/* Official Government Specs & Gazette Modal */}
      <RulesSpecsModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
}

export default App;
