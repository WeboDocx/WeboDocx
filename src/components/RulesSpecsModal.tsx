import React from 'react';

interface RulesSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesSpecsModal: React.FC<RulesSpecsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const rules = [
    {
      title: 'SSC Mandatory Clause 9.3: Date of Photo (DOP) & Name',
      desc: 'Staff Selection Commission mandates that candidate photographs must not be more than 3 months old from the date of notification. The candidate’s full name and date on which the photograph was taken must be clearly printed at the bottom of the photograph. Uploading photos without DOP or with unclear dates leads to immediate rejection of the application.',
      badge: 'SSC CGL / CHSL / MTS / GD',
      color: 'bg-[#ffdad6] text-[#ba1a1a]',
    },
    {
      title: 'UPSC 200/300 DPI Resolution & Aspect Ratio Rules',
      desc: 'Union Public Service Commission recruitment portals enforce server-side validation rejecting photos with non-standard DPI metadata or improper aspect ratios. WeboDocx automatically injects standard JFIF headers into the JPEG binary stream to guarantee 100% server acceptance.',
      badge: 'UPSC CSE / NDA / CDS / CMS',
      color: 'bg-[#dce1ff] text-[#00236f]',
    },
    {
      title: 'IBPS Signature Capital Letters Ban',
      desc: 'Institute of Banking Personnel Selection explicitly specifies that signatures written in CAPITAL (BLOCK) LETTERS will not be accepted. The signature must be on plain white paper with a black ink pen and cropped within 10 KB - 20 KB.',
      badge: 'IBPS PO / Clerk / SO / RRB',
      color: 'bg-[#ffdcc3] text-[#904d00]',
    },
    {
      title: 'Aadhaar NPCI DBT Account Linking Mandate',
      desc: 'For all Central and State government scholarships and DBT grants (UP Post Matric, NSP, PM Kisan), benefits are disbursed strictly through Aadhaar-based NPCI mapper. Beneficiaries must have their bank account seeded with Aadhaar and active for DBT transactions.',
      badge: 'All Central & State DBT Schemes',
      color: 'bg-[#85f8c4]/30 text-[#003120]',
    },
  ];

  return (
    <div
      id="rules-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="rules-modal-dialog"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#dae2fd] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#eaedff] bg-[#faf8ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ffdcc3] flex items-center justify-center text-[#904d00]">
              <span className="material-symbols-outlined text-[20px]">
                gavel
              </span>
            </div>
            <div>
              <h3 className="font-['Outfit'] text-[18px] font-bold text-[#131b2e]">
                Official Exam &amp; Portal Compliance Guidelines
              </h3>
              <p className="text-[12px] text-[#444651]">
                Extracted from 2024-2025 Gazette Notifications &amp; NIC Rules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#eaedff] flex items-center justify-center text-[#444651] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-4">
          {rules.map((rule, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[14px] font-bold text-[#00236f]">
                  {rule.title}
                </h4>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${rule.color}`}
                >
                  {rule.badge}
                </span>
              </div>
              <p className="text-[13px] text-[#444651] leading-relaxed">
                {rule.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-[#eaedff] bg-[#faf8ff] flex items-center justify-between">
          <span className="text-[12px] text-[#757682]">
            Certified for all NIC &amp; State Public Service Commission servers
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#00236f] text-white text-[13px] font-semibold rounded-lg hover:bg-[#1e3a8a] transition-colors cursor-pointer"
          >
            Understood &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
