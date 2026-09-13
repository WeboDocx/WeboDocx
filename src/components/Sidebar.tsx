import React from 'react';
import { NavView, Language } from '../types';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  language: Language;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  language,
  isOpen,
  onToggle,
}) => {
  const navItems: {
    id: NavView;
    icon: string;
    labelEn: string;
    labelHi: string;
  }[] = [
    {
      id: 'utility-dashboard',
      icon: 'grid_view',
      labelEn: 'Utility Dashboard',
      labelHi: 'मुख्य डैशबोर्ड',
    },
    {
      id: 'exam-photo-sign-resizer',
      icon: 'crop_free',
      labelEn: 'Photo & Sign Resizer',
      labelHi: 'फोटो व हस्ताक्षर रीसाइज़र',
    },
    {
      id: 'passport-sheet-maker',
      icon: 'photo_library',
      labelEn: 'Passport Sheet Maker',
      labelHi: 'पासपोर्ट शीट मेकर',
    },
    {
      id: 'camera-scanner',
      icon: 'document_scanner',
      labelEn: 'Mobile Camera Scanner',
      labelHi: 'मोबाइल कैमरा स्कैनर',
    },
    {
      id: 'scheme-finder',
      icon: 'policy',
      labelEn: 'Scheme Finder',
      labelHi: 'सरकारी योजनाएं खोजें',
    },
    {
      id: 'pdf-tools-compress',
      icon: 'picture_as_pdf',
      labelEn: 'PDF Tools & Compress',
      labelHi: 'PDF कंप्रेस व टूल्स',
    },
    {
      id: 'qr-code-generator',
      icon: 'qr_code_2',
      labelEn: 'QR Code Generator',
      labelHi: 'QR कोड जनरेटर',
    },
  ];

  const handleNavClick = (view: NavView) => {
    onNavigate(view);
    // On small screens, close sidebar automatically after clicking a nav item
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay (only on screens < lg when open) */}
      {isOpen && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onToggle}
          className="fixed inset-0 bg-[#00174d]/30 backdrop-blur-xs z-35 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed left-0 top-16 bottom-0 w-64 bg-white z-40 flex flex-col justify-between py-3.5 px-3 shadow-[2px_0_12px_rgba(0,0,0,0.04)] border-r border-[#eaedff] transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-1">
          {/* Sidebar Top Title & Collapse Button */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#eaedff] mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#00236f] text-white flex items-center justify-center font-extrabold text-[11px] font-['Outfit'] shadow-2xs">
                WD
              </div>
              <span className="text-[11px] uppercase tracking-wider text-[#00236f] font-bold">
                {language === 'EN' ? 'Workspace Tools' : 'कार्यक्षेत्र टूल्स'}
              </span>
            </div>

            <button
              id="sidebar-collapse-inside-btn"
              type="button"
              onClick={onToggle}
              title={language === 'EN' ? 'Hide Sidebar' : 'साइडबार छुपाएं'}
              aria-label="Hide Sidebar"
              className="p-1 rounded-lg text-[#757682] hover:bg-[#eaedff] hover:text-[#00236f] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                dock_to_left
              </span>
            </button>
          </div>

          <nav id="sidebar-nav" className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-all text-left w-full cursor-pointer ${
                    isActive
                      ? 'bg-[#1e3a8a] text-white font-semibold shadow-sm'
                      : 'text-[#444651] hover:bg-[#e2e7ff] hover:text-[#131b2e] font-medium'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? 'text-white' : 'text-[#444651]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{language === 'EN' ? item.labelEn : item.labelHi}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 100% Client-Side Engine Guarantee Badge */}
        <div
          id="client-engine-sidebar-box"
          className="p-3 rounded-lg bg-[#f2f3ff] border border-[#dae2fd] flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#003120] text-[18px]">
              offline_bolt
            </span>
            <span className="text-[12px] font-semibold text-[#131b2e]">
              100% Client-Side Engine
            </span>
          </div>
          <p className="text-[11px] leading-tight text-[#444651]">
            {language === 'EN'
              ? 'Zero server uploads. Your personal data & photos never leave your device.'
              : 'ज़ीरो सर्वर अपलोड। आपकी निजी फोटो व दस्तावेज़ डिवाइस से बाहर नहीं जाते।'}
          </p>
        </div>
      </aside>
    </>
  );
};

