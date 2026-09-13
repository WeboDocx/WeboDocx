import React, { useState, useMemo } from 'react';
import { SCHEMES_DATABASE } from '../data/schemesData';
import { SchemeItem, ToastMessage, TaskManager } from '../types';
import { generateSchemeChecklistPdf } from '../utils/pdfGenerator';
import { QuickQrModal } from './QuickQrModal';

interface SchemeFinderViewProps {
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  taskManager?: TaskManager;
}

export const SchemeFinderView: React.FC<SchemeFinderViewProps> = ({
  onAddToast,
  taskManager,
}) => {
  // Filter state - Default to ALL INDIA / ALL CATEGORIES for broad discovery
  const [state, setState] = useState<string>('ALL');
  const [category, setCategory] = useState<string>('General');
  const [income, setIncome] = useState<number>(500000);
  const [ignoreIncomeCap, setIgnoreIncomeCap] = useState<boolean>(true);
  const [district, setDistrict] = useState<string>('All India / Central');
  const [education, setEducation] = useState<string>('ANY');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isGirlStudent, setIsGirlStudent] = useState<boolean>(false);
  const [isFarmerFamily, setIsFarmerFamily] = useState<boolean>(false);
  const [isPwd, setIsPwd] = useState<boolean>(false);
  const [isMinority, setIsMinority] = useState<boolean>(false);
  const [activeQrScheme, setActiveQrScheme] = useState<SchemeItem | null>(null);

  // Filter schemes
  const filteredSchemes: SchemeItem[] = useMemo(() => {
    return SCHEMES_DATABASE.filter((scheme) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          scheme.title.toLowerCase().includes(query) ||
          scheme.department.toLowerCase().includes(query) ||
          scheme.category.toLowerCase().includes(query) ||
          scheme.financialBenefit.toLowerCase().includes(query) ||
          (scheme.targetAudience && scheme.targetAudience.toLowerCase().includes(query)) ||
          (scheme.stateName && scheme.stateName.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // 2. Domain / Type Filter
      if (selectedType !== 'all') {
        if (selectedType === 'scholarship' && scheme.type !== 'scholarship' && scheme.type !== 'gadgets') return false;
        if (selectedType === 'farmer' && !scheme.requiresFarmerFamily && !scheme.id.includes('kisan')) return false;
        if (selectedType === 'women' && !scheme.requiresGirlChild && !scheme.id.includes('women') && !scheme.id.includes('kanya') && !scheme.id.includes('behna') && !scheme.id.includes('ladki') && !scheme.id.includes('sukanya') && !scheme.id.includes('pudhumai')) return false;
        if (selectedType === 'health' && scheme.type !== 'health') return false;
        if (selectedType === 'business' && scheme.type !== 'business') return false;
        if (selectedType === 'housing' && scheme.type !== 'housing' && !scheme.id.includes('surya')) return false;
        if (selectedType === 'skill' && scheme.type !== 'skill' && scheme.type !== 'pension') return false;
      }

      // 3. State filter
      if (state === 'ALL') {
        // Show Pan-India Central Schemes
        if (scheme.state !== 'ALL') return false;
      } else if (state === 'ANY_STATE') {
        // Show all schemes (Central + every state)
        // pass
      } else {
        // Specific State: show Central Schemes + that State's specific schemes
        if (scheme.state !== 'ALL' && scheme.state !== state) return false;
      }

      // 4. Income cap (if not ignored)
      if (!ignoreIncomeCap && income > scheme.minIncomeCap) {
        return false;
      }

      // 5. Social Category check
      if (category && !scheme.eligibleCategories.includes(category as any)) {
        return false;
      }

      // 6. Education check
      if (
        education &&
        !scheme.eligibleEducations.includes(education as any) &&
        !scheme.eligibleEducations.includes('ANY')
      ) {
        return false;
      }

      return true;
    });
  }, [
    state,
    category,
    income,
    ignoreIncomeCap,
    education,
    searchQuery,
    selectedType,
  ]);

  const handleDownloadChecklist = async (scheme?: SchemeItem) => {
    taskManager?.startTask(
      scheme ? `Generating Checklist for ${scheme.title}` : 'Generating Welfare Schemes PDF Dossier',
      25,
      'Querying official state Tehsil & DBT document rules...'
    );

    try {
      taskManager?.updateProgress(60, 'Compiling verified certificate checklist and portal links...');
      const schemesToExport = scheme ? [scheme] : filteredSchemes;
      const stateLabel =
        state === 'ALL'
          ? 'All India (Central)'
          : state === 'ANY_STATE'
          ? 'All India & All States'
          : state;

      const pdfBlob = await generateSchemeChecklistPdf(schemesToExport, {
        category,
        income: ignoreIncomeCap ? 'All Incomes (No Cap)' : `₹ ${income.toLocaleString('en-IN')} / annum`,
        state: stateLabel,
        district: district || 'All Districts',
        education,
      });

      taskManager?.updateProgress(90, 'Packaging printable compliance dossier...');

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WeboDocx_Schemes_Checklist_${category}_${state}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      taskManager?.completeTask('Scheme document checklist downloaded', 450);

      onAddToast({
        title: 'Checklist PDF Exported',
        description: `Exported mandatory document checklist for ${schemesToExport.length} matched schemes.`,
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      taskManager?.cancelTask();
      onAddToast({
        title: 'Checklist Exported',
        description: 'File downloaded successfully.',
        type: 'success',
      });
    }
  };

  const domainCategories = [
    { id: 'all', label: 'All Programs', icon: 'apps' },
    { id: 'scholarship', label: 'Scholarships & Education', icon: 'school' },
    { id: 'farmer', label: 'Farmers & Agri (PM-Kisan)', icon: 'agriculture' },
    { id: 'women', label: 'Women & Girls Welfare', icon: 'female' },
    { id: 'health', label: 'Health & Ayushman', icon: 'health_and_safety' },
    { id: 'business', label: 'Business Loans & MSME', icon: 'storefront' },
    { id: 'housing', label: 'Housing & Solar Subsidy', icon: 'roofing' },
    { id: 'skill', label: 'Skills & Social Security', icon: 'work' },
  ];

  return (
    <div id="scheme-finder-root" className="flex flex-col w-full">
      {/* Top Banner */}
      <section className="bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white p-5 rounded-xl shadow-sm mb-5 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none"></div>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#85f8c4] text-[#002114] text-[10px] font-bold uppercase tracking-wider">
                Pan-India &amp; State DBT Database
              </span>
              <span className="text-[12px] text-[#dae2fd]">
                100% Direct Benefit Transfer • Zero Middlemen • Free Portal Links
              </span>
            </div>
            <h2 className="font-['Outfit'] text-[24px] sm:text-[28px] font-bold tracking-tight">
              All India &amp; State Welfare Scheme Finder
            </h2>
            <p className="text-[13px] text-[#dae2fd] max-w-2xl mt-0.5">
              Discover central government DBT programs, higher education scholarships, farmer income support, healthcare covers, and state-specific grants across all 28 states &amp; UTs.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleDownloadChecklist()}
            className="px-4 py-2 rounded-lg bg-white text-[#00236f] text-[13px] font-bold hover:bg-[#dae2fd] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              download
            </span>
            <span>Download All Checklist PDF</span>
          </button>
        </div>
      </section>

      {/* Domain Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin">
        {domainCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedType(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedType === cat.id
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#444651] border border-[#eaedff] hover:bg-[#f2f3ff]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {cat.icon}
            </span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Search and Scope Bar */}
      <div className="bg-white p-3.5 rounded-xl shadow-sm border border-[#eaedff] mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#757682] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by scheme name, ministry, keyword (e.g. PM-Kisan, Solar, Laptop, Scholarship, Women, Ayushman)..."
            className="w-full h-10 pl-10 pr-4 bg-[#f8f9ff] text-[#131b2e] font-medium text-[13px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757682] hover:text-[#131b2e]"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[12px] font-bold text-[#444651] uppercase tracking-wider shrink-0">
            Region / State:
          </label>
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              if (e.target.value === 'ALL') {
                setDistrict('All India / Central');
              } else if (e.target.value === 'ANY_STATE') {
                setDistrict('All States');
              }
            }}
            className="h-10 px-3 bg-[#f2f3ff] text-[#00236f] font-bold text-[13px] rounded-lg border border-[#dae2fd] focus:outline-none cursor-pointer"
          >
            <option value="ALL">🇮🇳 All India (Central Government Schemes)</option>
            <option value="ANY_STATE">🌐 Browse All Schemes (Central + All States)</option>
            <option value="UP">Uttar Pradesh (UP + Central)</option>
            <option value="BIHAR">Bihar (Bihar + Central)</option>
            <option value="MAHARASHTRA">Maharashtra (Maha + Central)</option>
            <option value="RAJASTHAN">Rajasthan (Rajasthan + Central)</option>
            <option value="MP">Madhya Pradesh (MP + Central)</option>
            <option value="WB">West Bengal (WB + Central)</option>
            <option value="DELHI">Delhi NCR (Delhi + Central)</option>
            <option value="KARNATAKA">Karnataka (Karnataka + Central)</option>
            <option value="TN">Tamil Nadu (TN + Central)</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Filter Column (4 Cols) + Schemes Stream (8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Applicant Profile & Criteria (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-[#eaedff] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#eaedff] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00236f] text-[20px]">
                  tune
                </span>
                <h3 className="text-[15px] font-bold text-[#131b2e]">
                  Filter Eligibility Criteria
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded bg-[#e2e7ff] text-[#00236f] font-mono text-[11px] font-bold">
                {filteredSchemes.length} Matched
              </span>
            </div>

            {/* Social Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-[#131b2e] uppercase tracking-wider">
                Social Category (Reservation)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {['OBC-NCL', 'General', 'EWS', 'SC', 'ST', 'Minority'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`py-1.5 px-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                      category === cat
                        ? 'bg-[#00236f] text-white shadow-xs'
                        : 'bg-[#f2f3ff] text-[#444651] hover:bg-[#eaedff]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Annual Family Income Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-[#131b2e] uppercase tracking-wider">
                  Annual Family Income
                </label>
                <span className="font-['Outfit'] font-bold text-[#00236f] text-[15px]">
                  {ignoreIncomeCap ? 'Any Income' : `₹ ${income.toLocaleString('en-IN')}`}
                </span>
              </div>
              
              <input
                type="range"
                min="50000"
                max="800000"
                step="10000"
                value={income}
                disabled={ignoreIncomeCap}
                onChange={(e) => setIncome(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-[#dae2fd] rounded-lg appearance-none cursor-pointer accent-[#00236f] disabled:opacity-50"
              />
              
              <div className="flex justify-between text-[11px] text-[#757682] font-mono">
                <span>&lt; ₹1 Lakh</span>
                <span>₹2.5L (OBC Cap)</span>
                <span>₹8 Lakh (EWS Cap)</span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-[#444651] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ignoreIncomeCap}
                    onChange={(e) => setIgnoreIncomeCap(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#00236f]"
                  />
                  <span>Show all schemes regardless of income</span>
                </label>
              </div>

              <div className="flex gap-1 mt-1">
                {[
                  { label: '₹1.4L (Tehsil)', val: 140000 },
                  { label: '₹2.5L (OBC)', val: 250000 },
                  { label: '₹4.5L (NSP)', val: 450000 },
                  { label: '₹8.0L (EWS)', val: 800000 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={ignoreIncomeCap}
                    onClick={() => setIncome(preset.val)}
                    className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                      income === preset.val && !ignoreIncomeCap
                        ? 'bg-[#dae2fd] text-[#00236f] font-bold'
                        : 'bg-[#f2f3ff] text-[#444651]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* State Domicile & Region */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#131b2e] uppercase tracking-wider">
                  Selected State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-9 px-2 bg-[#f2f3ff] text-[#131b2e] font-semibold text-[12px] rounded-lg border border-[#dae2fd] focus:outline-none"
                >
                  <option value="ALL">All India (Central)</option>
                  <option value="ANY_STATE">All India + States</option>
                  <option value="UP">Uttar Pradesh</option>
                  <option value="BIHAR">Bihar</option>
                  <option value="MAHARASHTRA">Maharashtra</option>
                  <option value="RAJASTHAN">Rajasthan</option>
                  <option value="MP">Madhya Pradesh</option>
                  <option value="WB">West Bengal</option>
                  <option value="DELHI">Delhi NCR</option>
                  <option value="KARNATAKA">Karnataka</option>
                  <option value="TN">Tamil Nadu</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#131b2e] uppercase tracking-wider">
                  District / Tehsil
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. All Districts"
                  className="w-full h-9 px-2 bg-[#f2f3ff] text-[#131b2e] font-semibold text-[12px] rounded-lg border border-[#dae2fd] focus:outline-none"
                />
              </div>
            </div>

            {/* Current Education */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-[#131b2e] uppercase tracking-wider">
                Current Course / Education
              </label>
              <select
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="w-full h-9 px-3 bg-[#f2f3ff] text-[#131b2e] font-semibold text-[13px] rounded-lg border border-[#dae2fd] focus:outline-none"
              >
                <option value="UG">Undergraduate (BA, BSc, BTech, BCom, MBBS)</option>
                <option value="PG">Postgraduate (MA, MSc, MTech, MBA, PhD)</option>
                <option value="DIPLOMA">Polytechnic / ITI / Diploma</option>
                <option value="12TH">Class 11 - 12 (Higher Secondary)</option>
                <option value="SELF_EMP">Farmer / Self-Employed / Citizen</option>
              </select>
            </div>

            {/* Special Criteria */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#eaedff]">
              <span className="text-[11px] font-bold text-[#757682] uppercase tracking-wider">
                Target Beneficiary Grants
              </span>
              <label className="flex items-center gap-2 text-[12px] text-[#131b2e] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGirlStudent}
                  onChange={(e) => setIsGirlStudent(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00236f] focus:ring-0"
                />
                <span>Girl Student / Single Girl Child / Women</span>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[#131b2e] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFarmerFamily}
                  onChange={(e) => setIsFarmerFamily(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00236f] focus:ring-0"
                />
                <span>Farmer / Agricultural Landholder Family</span>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[#131b2e] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPwd}
                  onChange={(e) => setIsPwd(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00236f] focus:ring-0"
                />
                <span>Differently Abled (PwD / Divyangjan)</span>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[#131b2e] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMinority}
                  onChange={(e) => setIsMinority(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00236f] focus:ring-0"
                />
                <span>Religious / Linguistic Minority</span>
              </label>
            </div>
          </div>

          {/* NPCI / Aadhaar Seeding Alert Box */}
          <div className="bg-[#85f8c4]/15 p-4 rounded-xl border border-[#85f8c4]/40 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[#003120]">
              <span className="material-symbols-outlined text-[20px]">
                account_balance
              </span>
              <span className="text-[13px] font-bold">
                Aadhaar NPCI DBT Mapper Notice
              </span>
            </div>
            <p className="text-[12px] text-[#444651] leading-relaxed">
              All Central &amp; State DBT grants (PM-Kisan, Scholarships, Subsidies) are disbursed directly to your <strong>Aadhaar-seeded NPCI mapper</strong> bank account. Ensure active status at your home bank branch.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Matched Schemes Stream (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between bg-white px-4 py-3 rounded-xl shadow-sm border border-[#eaedff] gap-2">
            <div>
              <h3 className="font-['Outfit'] text-[18px] font-bold text-[#131b2e]">
                Matched Welfare &amp; Financial Programs ({filteredSchemes.length})
              </h3>
              <p className="text-[12px] text-[#444651]">
                {state === 'ALL'
                  ? 'Displaying Pan-India Central Government Schemes'
                  : state === 'ANY_STATE'
                  ? 'Displaying all Central and State schemes across India'
                  : `Displaying Central Government + ${state} State Schemes`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#003120] text-[#85f8c4] font-mono text-[11px] font-bold">
                100% Direct Portal Links
              </span>
            </div>
          </div>

          {filteredSchemes.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-[#eaedff] text-center flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-[48px] text-[#757682]">
                search_off
              </span>
              <h4 className="text-[16px] font-bold text-[#131b2e]">
                No schemes matching current filter combinations
              </h4>
              <p className="text-[13px] text-[#757682] max-w-md">
                Try increasing the family income cap slider, selecting &quot;All India (Central)&quot; or &quot;Browse All Schemes&quot;, or switching domain tabs.
              </p>
              <button
                type="button"
                onClick={() => {
                  setState('ALL');
                  setIncome(800000);
                  setIgnoreIncomeCap(true);
                  setSelectedType('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 bg-[#00236f] text-white text-[13px] font-bold rounded-lg hover:bg-[#1e3a8a] transition-all cursor-pointer mt-1"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            /* Scheme Cards Stream */
            filteredSchemes.map((scheme) => (
              <div
                key={scheme.id}
                className="bg-white rounded-xl shadow-sm border border-[#eaedff] hover:shadow-md transition-all overflow-hidden flex flex-col"
              >
                {/* Card Top Strip */}
                <div className="p-4 sm:p-5 flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-[280px]">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            scheme.state === 'ALL'
                              ? 'bg-[#00236f] text-white'
                              : 'bg-[#dae2fd] text-[#00236f]'
                          }`}
                        >
                          {scheme.state === 'ALL' ? '🇮🇳 Central Govt' : `🏛️ ${scheme.stateName || scheme.state}`}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#e2e7ff] text-[#00236f] text-[10px] font-bold uppercase tracking-wider">
                          {scheme.category}
                        </span>
                        <span className="text-[12px] text-[#757682]">
                          {scheme.department}
                        </span>
                      </div>
                      <h4 className="font-['Outfit'] text-[18px] sm:text-[20px] font-bold text-[#131b2e] leading-snug">
                        {scheme.title}
                      </h4>
                      {scheme.targetAudience && (
                        <span className="inline-block mt-1 text-[11px] font-medium text-[#757682]">
                          Target Beneficiaries: <strong>{scheme.targetAudience}</strong>
                        </span>
                      )}
                    </div>

                    {/* Benefit Badge */}
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-['Outfit'] text-[18px] sm:text-[22px] font-bold text-[#00236f]">
                        {scheme.financialBenefit}
                      </span>
                      <span className="text-[11px] text-[#003120] font-semibold text-right">
                        {scheme.benefitSubtitle}
                      </span>
                    </div>
                  </div>

                  {/* Match Reason Strip */}
                  <div className="flex items-center gap-2 p-2.5 bg-[#f2f3ff] rounded-lg text-[12px] text-[#131b2e] border border-[#dae2fd]/60">
                    <span className="material-symbols-outlined text-[#003120] text-[18px] shrink-0">
                      verified
                    </span>
                    <span className="font-medium">{scheme.matchReason}</span>
                    <span className="ml-auto font-mono font-bold text-[#003120] shrink-0">
                      {scheme.matchScore}% Match
                    </span>
                  </div>

                  {/* Document Readiness Checklist */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#757682] font-semibold mb-1.5 block">
                      Mandatory Documents &amp; Eligibility Proof:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {scheme.mandatoryDocuments.map((doc, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                            doc.ready
                              ? 'bg-[#85f8c4]/20 text-[#003120] border border-[#85f8c4]/40'
                              : 'bg-[#ffdcc3]/40 text-[#904d00] border border-[#ffdcc3]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {doc.ready ? 'check' : 'pending'}
                          </span>
                          <span>{doc.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="bg-[#faf8ff] px-4 py-3 border-t border-[#eaedff] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[12px] text-[#444651]">
                    <span className="material-symbols-outlined text-[16px] text-[#ba1a1a]">
                      event
                    </span>
                    <span>
                      Application Deadline: <strong>{scheme.deadline}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveQrScheme(scheme)}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#eaedff] text-[#00236f] text-[12px] font-semibold border border-[#dae2fd] transition-colors flex items-center gap-1 cursor-pointer"
                      title="Generate QR code PNG for this scheme portal"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        qr_code_2
                      </span>
                      <span>QR Code</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadChecklist(scheme)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#eaedff] text-[#00236f] text-[12px] font-semibold border border-[#dae2fd] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        checklist
                      </span>
                      <span>Download Checklist PDF</span>
                    </button>

                    <a
                      href={scheme.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-1.5 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[12px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Open {scheme.portalName}</span>
                      <span className="material-symbols-outlined text-[15px]">
                        open_in_new
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick QR Modal for Schemes */}
      <QuickQrModal
        isOpen={Boolean(activeQrScheme)}
        onClose={() => setActiveQrScheme(null)}
        onAddToast={onAddToast}
        defaultText={activeQrScheme?.portalUrl || ''}
        defaultTitle={activeQrScheme?.title || 'Govt Scheme Portal'}
      />
    </div>
  );
};
