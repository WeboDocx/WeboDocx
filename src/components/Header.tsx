import React from 'react';
import { NavView, Language, ThemeMode } from '../types';

interface HeaderProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  cyberMode: boolean;
  onToggleCyberMode: (val: boolean) => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  theme: ThemeMode;
  onToggleTheme: (theme: ThemeMode) => void;
  onOpenSearch: () => void;
  onOpenRules: () => void;
  onOpenQuickQr?: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  cyberMode,
  onToggleCyberMode,
  language,
  onChangeLanguage,
  theme,
  onToggleTheme,
  onOpenSearch,
  onOpenRules,
  onOpenQuickQr,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const isDark = theme === 'dark';
  return (
    <header
      id="app-header"
      className="fixed top-0 left-0 right-0 z-50 bg-[#ffffff]/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-[#eaedff]"
    >
      <div className="h-16 w-full px-3 sm:px-5 lg:px-7 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand Logo & Sidebar Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Sidebar Hide/Show Toggle Button */}
          <button
            id="sidebar-toggle-header-btn"
            type="button"
            onClick={onToggleSidebar}
            title={
              isSidebarOpen
                ? language === 'EN'
                  ? 'Hide Sidebar (साइकिल/मेनू छुपाएं)'
                  : 'साइडबार छुपाएं'
                : language === 'EN'
                  ? 'Show Sidebar (मेनू दिखाएं)'
                  : 'साइडबार दिखाएं'
            }
            aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            className="p-2 rounded-xl text-[#00236f] bg-[#f2f3ff] hover:bg-[#eaedff] active:scale-95 transition-all cursor-pointer border border-[#dae2fd] flex items-center justify-center shadow-2xs group"
          >
            <span className="material-symbols-outlined text-[21px] group-hover:text-[#00174d] transition-colors">
              {isSidebarOpen ? 'menu_open' : 'menu'}
            </span>
          </button>

          {/* WeboDocx Brand Logo with "WD" Monogram */}
          <button
            id="brand-logo-btn"
            onClick={() => onNavigate('utility-dashboard')}
            className="flex items-center gap-2.5 focus:outline-none group text-left cursor-pointer select-none"
            type="button"
          >
            {/* Crisp WD Badge Logo */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00236f] via-[#083088] to-[#1e3a8a] flex items-center justify-center text-white font-extrabold text-[15px] font-['Outfit'] shadow-[0_2px_8px_rgba(0,35,111,0.22)] tracking-wider border border-[#8ea8ff]/30 transition-transform group-hover:scale-105">
              WD
            </div>
            <div className="flex flex-col">
              <span className="font-['Outfit'] text-[20px] sm:text-[22px] font-bold text-[#00236f] tracking-tight leading-none group-hover:text-[#0b328a] transition-colors">
                WeboDocx
              </span>
              <span className="text-[10px] text-[#757682] font-semibold tracking-wide uppercase hidden sm:block">
                Citizen Portal
              </span>
            </div>
          </button>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-[#e2e7ff] rounded-full text-[#00236f]">
            <span className="material-symbols-outlined text-[15px] text-[#003120]">
              verified
            </span>
            <span className="text-[11px] uppercase tracking-wider text-[#00236f] font-semibold">
              {language === 'EN' ? 'Govt Standards Compliant' : 'सरकारी मानकों के अनुरूप'}
            </span>
          </div>
        </div>

        {/* Global Search Bar (Ctrl+K trigger) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div
            onClick={onOpenSearch}
            className="relative w-full flex items-center bg-[#f2f3ff] hover:bg-[#eaedff] rounded-lg px-3 py-1.5 cursor-pointer border border-transparent focus-within:border-[#b6c4ff] transition-all group"
          >
            <span className="material-symbols-outlined text-[#757682] text-[18px] mr-2">
              search
            </span>
            <span className="w-full font-['Inter'] text-[13px] text-[#757682] select-none">
              {language === 'EN'
                ? 'Search exam specs, UPSC, SSC, state portals (Ctrl+K)...'
                : 'परीक्षा नियम, UPSC, SSC खोजें (Ctrl+K)...'}
            </span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-[#eaedff] text-[10px] font-mono text-[#444651]">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Global Light / Dark Mode Toggle */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={() => onToggleTheme(isDark ? 'light' : 'dark')}
            title={
              isDark
                ? language === 'EN'
                  ? 'Switch to Citizen Light Mode'
                  : 'नागरिक लाइट मोड पर स्विच करें'
                : language === 'EN'
                  ? 'Switch to High-Contrast Night Dark Mode (Eye-Strain Protection)'
                  : 'हाई-कंट्रास्ट डार्क मोड (आंखों की सुरक्षा)'
            }
            aria-label={isDark ? 'Switch to Citizen Light Mode' : 'Switch to High-Contrast Dark Mode'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer border ${
              isDark
                ? 'bg-[#1e293b] text-[#f8fafc] border-[#334155] hover:bg-[#334155] shadow-xs'
                : 'bg-[#eaedff] text-[#00236f] border-[#dae2fd] hover:bg-[#dce1ff]'
            }`}
          >
            <span className={`material-symbols-outlined text-[17px] ${isDark ? 'text-[#facc15]' : 'text-[#f59e0b]'}`}>
              {isDark ? 'dark_mode' : 'light_mode'}
            </span>
            <span className="hidden sm:inline">
              {isDark
                ? language === 'EN'
                  ? 'Night Dark'
                  : 'डार्क मोड'
                : language === 'EN'
                  ? 'Citizen Light'
                  : 'लाइट मोड'}
            </span>
          </button>

          {/* CSC / Cyber Mode Toggle */}
          <label
            id="csc-mode-label"
            className={`flex items-center gap-2 cursor-pointer py-1 px-2.5 rounded-lg transition-colors select-none ${
              cyberMode
                ? 'bg-[#1e3a8a] text-white'
                : 'bg-[#eaedff] hover:bg-[#e2e7ff] text-[#131b2e]'
            }`}
          >
            <span className={`material-symbols-outlined text-[16px] ${cyberMode ? 'text-[#85f8c4]' : 'text-[#444651]'}`}>
              storefront
            </span>
            <span className="text-[12px] font-medium hidden sm:inline">
              CSC / Cyber Mode
            </span>
            <input
              id="csc-mode-checkbox"
              type="checkbox"
              checked={cyberMode}
              onChange={(e) => onToggleCyberMode(e.target.checked)}
              className="rounded border-[#757682] text-[#00236f] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
          </label>

          {/* Language Switcher */}
          <div className="flex items-center bg-[#f2f3ff] p-0.5 rounded-lg border border-[#dae2fd]">
            <button
              id="lang-en-btn"
              type="button"
              onClick={() => onChangeLanguage('EN')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                language === 'EN'
                  ? 'bg-white text-[#00236f] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-[#444651] hover:text-[#131b2e]'
              }`}
            >
              EN
            </button>
            <button
              id="lang-hi-btn"
              type="button"
              onClick={() => onChangeLanguage('HI')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                language === 'HI'
                  ? 'bg-white text-[#00236f] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-[#444651] hover:text-[#131b2e]'
              }`}
            >
              HI
            </button>
          </div>

          {/* Quick QR Generator Trigger */}
          <button
            id="quick-qr-header-btn"
            type="button"
            onClick={onOpenQuickQr || (() => onNavigate('qr-code-generator'))}
            title={language === 'EN' ? 'Quick QR Code Generator for Forms & Links' : 'फॉर्म व लिंक हेतु क्विक QR जनरेटर'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#eaedff] hover:bg-[#dce1ff] text-[#00236f] text-[12px] font-semibold transition-colors cursor-pointer border border-[#dae2fd]"
          >
            <span className="material-symbols-outlined text-[17px] text-[#00236f]">
              qr_code_2
            </span>
            <span className="hidden md:inline">
              {language === 'EN' ? 'QR Generator' : 'QR जनरेटर'}
            </span>
          </button>

          {/* Rules & Specs Modal Trigger */}
          <button
            id="rules-specs-header-btn"
            type="button"
            onClick={onOpenRules}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#131b2e] text-[12px] font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-[#904d00]">
              help
            </span>
            <span>{language === 'EN' ? 'Rules & Specs' : 'नियम व निर्देश'}</span>
          </button>

          {/* User Profile Avatar */}
          <div
            id="user-profile-avatar"
            title="Citizen Portal Session"
            className="w-8 h-8 rounded-full bg-[#00236f] flex items-center justify-center cursor-pointer shadow-sm ring-2 ring-[#dce1ff]"
          >
            <span className="material-symbols-outlined text-white text-[18px]">
              person
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
