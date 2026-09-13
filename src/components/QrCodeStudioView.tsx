import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { ToastMessage, TaskManager, Language } from '../types';

interface QrCodeStudioViewProps {
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  taskManager?: TaskManager;
  language?: Language;
}

type QrInputType = 'url' | 'contact' | 'text' | 'upi' | 'whatsapp' | 'wifi' | 'email';

interface VCardData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  org: string;
  title: string;
  address: string;
  website: string;
}

interface UpiData {
  payeeName: string;
  upiId: string;
  amount: string;
  note: string;
}

interface WhatsAppData {
  phone: string;
  message: string;
}

interface WifiData {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

const PRESET_PORTAL_LINKS = [
  { name: 'SSC Official Portal', url: 'https://ssc.gov.in', category: 'Exam' },
  { name: 'UPSC Online Applications', url: 'https://upsconline.nic.in', category: 'Exam' },
  { name: 'NTA Exam Registration', url: 'https://nta.ac.in', category: 'Exam' },
  { name: 'DigiLocker Verification', url: 'https://www.digilocker.gov.in', category: 'Citizen' },
  { name: 'PM-Kisan Samman Nidhi', url: 'https://pmkisan.gov.in', category: 'Scheme' },
  { name: 'National Scholarship Portal', url: 'https://scholarships.gov.in', category: 'Scheme' },
  { name: 'Ayushman Bharat PM-JAY', url: 'https://pmjay.gov.in', category: 'Health' },
  { name: 'e-Shram Portal', url: 'https://eshram.gov.in', category: 'Citizen' },
];

const COLOR_PALETTES = [
  { name: 'Classic Black', fg: '#000000', bg: '#ffffff' },
  { name: 'WeboDocx Navy', fg: '#00236f', bg: '#ffffff' },
  { name: 'Deep Indigo', fg: '#1e3a8a', bg: '#ffffff' },
  { name: 'Govt Forest Green', fg: '#004d26', bg: '#ffffff' },
  { name: 'Crimson Red', fg: '#8b0000', bg: '#ffffff' },
  { name: 'Dark Slate', fg: '#131b2e', bg: '#ffffff' },
  { name: 'Navy on Soft Blue', fg: '#00236f', bg: '#f2f5ff' },
];

export const QrCodeStudioView: React.FC<QrCodeStudioViewProps> = ({
  onAddToast,
  taskManager,
  language = 'EN',
}) => {
  const [inputType, setInputType] = useState<QrInputType>('url');
  
  // Input fields
  const [urlInput, setUrlInput] = useState<string>('https://ssc.gov.in');
  const [rawTextInput, setRawTextInput] = useState<string>('WeboDocx - Fast-track Document & Exam Portal');
  
  const [vcard, setVcard] = useState<VCardData>({
    firstName: 'Shahid',
    lastName: 'Online Cafe',
    phone: '+919876543210',
    email: 'shahidonlinecafe@gmail.com',
    org: 'CSC Cyber Cafe & Citizen Services',
    title: 'VLE Operator',
    address: 'Main Market, Uttar Pradesh',
    website: 'https://webodocx.portal',
  });

  const [upi, setUpi] = useState<UpiData>({
    payeeName: 'WeboDocx Cyber Cafe',
    upiId: 'shahidonlinecafe@okhdfcbank',
    amount: '50.00',
    note: 'Exam Form Processing Fee',
  });

  const [whatsapp, setWhatsapp] = useState<WhatsAppData>({
    phone: '919876543210',
    message: 'Hello! I need assistance with my online exam form / document submission.',
  });

  const [wifi, setWifi] = useState<WifiData>({
    ssid: 'CyberCafe_Citizen_WiFi',
    password: 'Connect@2026',
    encryption: 'WPA',
    hidden: false,
  });

  // QR Customization
  const [fgColor, setFgColor] = useState<string>('#00236f');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [resolution, setResolution] = useState<number>(1024);
  const [margin, setMargin] = useState<number>(2);
  const [centerBadge, setCenterBadge] = useState<'none' | 'link' | 'phone' | 'upi' | 'seal' | 'text'>('none');
  const [centerTextBadge, setCenterTextBadge] = useState<string>('GOV');
  const [frameTitle, setFrameTitle] = useState<string>('Scan to Open Portal');
  const [frameSubtitle, setFrameSubtitle] = useState<string>('Official Verification & Form Link');
  const [includeFrame, setIncludeFrame] = useState<boolean>(true);

  // Output states
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [computedPayload, setComputedPayload] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Compute Raw String Payload based on Input Type
  useEffect(() => {
    let payload = '';

    if (inputType === 'url') {
      let trimmed = urlInput.trim();
      if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('mailto:') && !trimmed.startsWith('tel:')) {
        trimmed = 'https://' + trimmed;
      }
      payload = trimmed || 'https://webodocx.portal';
    } else if (inputType === 'contact') {
      const formattedVCard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${vcard.lastName};${vcard.firstName};;;`,
        `FN:${vcard.firstName} ${vcard.lastName}`.trim(),
        vcard.org ? `ORG:${vcard.org}` : '',
        vcard.title ? `TITLE:${vcard.title}` : '',
        vcard.phone ? `TEL;TYPE=CELL,VOICE:${vcard.phone}` : '',
        vcard.email ? `EMAIL;TYPE=INTERNET,WORK:${vcard.email}` : '',
        vcard.website ? `URL:${vcard.website}` : '',
        vcard.address ? `ADR;TYPE=WORK:;;${vcard.address};;;;` : '',
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\n');
      payload = formattedVCard;
    } else if (inputType === 'upi') {
      const cleanUpi = upi.upiId.trim();
      const cleanName = encodeURIComponent(upi.payeeName.trim());
      const cleanNote = encodeURIComponent(upi.note.trim());
      const cleanAmount = upi.amount ? `&am=${encodeURIComponent(upi.amount.trim())}` : '';
      payload = `upi://pay?pa=${cleanUpi}&pn=${cleanName}${cleanAmount}&tn=${cleanNote}&cu=INR`;
    } else if (inputType === 'whatsapp') {
      const cleanPhone = whatsapp.phone.replace(/[^0-9]/g, '');
      const cleanMsg = encodeURIComponent(whatsapp.message);
      payload = `https://wa.me/${cleanPhone}?text=${cleanMsg}`;
    } else if (inputType === 'wifi') {
      payload = `WIFI:S:${wifi.ssid};T:${wifi.encryption};P:${wifi.password};H:${wifi.hidden ? 'true' : 'false'};;`;
    } else {
      payload = rawTextInput || 'WeboDocx';
    }

    setComputedPayload(payload);
  }, [inputType, urlInput, rawTextInput, vcard, upi, whatsapp, wifi]);

  // Generate QR Code on Canvas whenever payload or style changes
  useEffect(() => {
    generateQrCode();
  }, [computedPayload, fgColor, bgColor, errorCorrection, resolution, margin, centerBadge, centerTextBadge]);

  const generateQrCode = async () => {
    if (!computedPayload) return;
    setIsGenerating(true);

    try {
      // Step 1: Generate base QR Code matrix onto an off-screen canvas
      const size = resolution;
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = size;
      offscreenCanvas.height = size;

      await QRCode.toCanvas(offscreenCanvas, computedPayload, {
        width: size,
        margin: margin,
        errorCorrectionLevel: errorCorrection,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      });

      // Step 2: Overlay Center Badge / Icon if selected
      const ctx = offscreenCanvas.getContext('2d');
      if (ctx && centerBadge !== 'none') {
        const centerSize = Math.round(size * 0.22);
        const centerPos = (size - centerSize) / 2;

        // Draw clean white rounded container for the badge
        ctx.save();
        ctx.fillStyle = bgColor;
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = Math.round(size * 0.02);
        const radius = Math.round(centerSize * 0.22);

        ctx.beginPath();
        ctx.roundRect(centerPos, centerPos, centerSize, centerSize, radius);
        ctx.fill();

        // Border around center badge
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = Math.max(2, Math.round(size * 0.005));
        ctx.stroke();
        ctx.restore();

        // Center Content Drawing
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = fgColor;

        if (centerBadge === 'link') {
          ctx.font = `bold ${Math.round(centerSize * 0.45)}px sans-serif`;
          ctx.fillText('🔗', size / 2, size / 2);
        } else if (centerBadge === 'phone') {
          ctx.font = `bold ${Math.round(centerSize * 0.45)}px sans-serif`;
          ctx.fillText('📞', size / 2, size / 2);
        } else if (centerBadge === 'upi') {
          ctx.font = `bold ${Math.round(centerSize * 0.32)}px sans-serif`;
          ctx.fillText('UPI', size / 2, size / 2);
        } else if (centerBadge === 'seal') {
          ctx.font = `bold ${Math.round(centerSize * 0.45)}px sans-serif`;
          ctx.fillText('🏛️', size / 2, size / 2);
        } else if (centerBadge === 'text') {
          ctx.font = `bold ${Math.round(centerSize * 0.3)}px sans-serif`;
          ctx.fillText(centerTextBadge.slice(0, 4), size / 2, size / 2);
        }
        ctx.restore();
      }

      // Draw onto visible canvas
      const mainCanvas = canvasRef.current;
      if (mainCanvas) {
        mainCanvas.width = offscreenCanvas.width;
        mainCanvas.height = offscreenCanvas.height;
        const mainCtx = mainCanvas.getContext('2d');
        mainCtx?.drawImage(offscreenCanvas, 0, 0);
      }

      const dataUrl = offscreenCanvas.toDataURL('image/png');
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('QR Generation failed', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to build a styled framed image (with title/subtitle) for PNG download
  const generateFramedCanvas = (): HTMLCanvasElement => {
    const qrCanvas = canvasRef.current;
    if (!qrCanvas) throw new Error('Canvas not found');

    if (!includeFrame) {
      return qrCanvas;
    }

    const cardWidth = 1080;
    const cardHeight = 1420;
    const canvas = document.createElement('canvas');
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return qrCanvas;

    // 1. Background Fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // 2. Top Header Banner
    ctx.fillStyle = '#00236f';
    ctx.fillRect(0, 0, cardWidth, 130);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WeboDocx • Official QR Access', cardWidth / 2, 80);

    // 3. Card Title & Subtitle
    ctx.fillStyle = '#131b2e';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(frameTitle || 'Scan to Open Portal', cardWidth / 2, 230);

    ctx.fillStyle = '#757682';
    ctx.font = '500 28px sans-serif';
    ctx.fillText(frameSubtitle || 'Point phone camera or Google Lens to scan', cardWidth / 2, 280);

    // 4. Subtle Border Container around QR
    const qrSize = 780;
    const qrX = (cardWidth - qrSize) / 2;
    const qrY = 330;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24);
    ctx.fill();
    ctx.strokeStyle = '#dae2fd';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 5. Draw QR Canvas
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // 6. Footer Information
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(inputType.toUpperCase() + ' QR CODE', cardWidth / 2, 1200);

    ctx.fillStyle = '#757682';
    ctx.font = '22px sans-serif';
    ctx.fillText('100% In-Browser Privacy • Verified Citizen Utility', cardWidth / 2, 1250);

    // Bottom brand line
    ctx.fillStyle = '#00236f';
    ctx.fillRect(40, 1320, cardWidth - 80, 4);

    return canvas;
  };

  // 1-Click PNG Download
  const handleDownloadPng = (withFrame: boolean = includeFrame) => {
    try {
      const canvas = withFrame ? generateFramedCanvas() : canvasRef.current;
      if (!canvas) return;

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      const safeName = (frameTitle || inputType).replace(/[^a-z0-9_-]/gi, '_');
      a.href = url;
      a.download = `WeboDocx_QR_${safeName}_${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onAddToast({
        title: 'QR Code PNG Downloaded',
        description: `Downloaded high-resolution QR PNG (${canvas.width}x${canvas.height} px).`,
        type: 'success',
      });
    } catch (err: any) {
      console.error(err);
      onAddToast({
        title: 'Download Failed',
        description: err?.message || 'Failed to export QR PNG',
        type: 'error',
      });
    }
  };

  // Download SVG
  const handleDownloadSvg = async () => {
    try {
      const svgString = await QRCode.toString(computedPayload, {
        type: 'svg',
        margin: margin,
        errorCorrectionLevel: errorCorrection,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      });

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WeboDocx_QR_${inputType}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onAddToast({
        title: 'Vector SVG Downloaded',
        description: 'Scalable vector QR graphic downloaded for high-grade printing.',
        type: 'success',
      });
    } catch (err: any) {
      onAddToast({
        title: 'SVG Export Failed',
        description: err?.message || 'Could not export SVG',
        type: 'error',
      });
    }
  };

  // Copy Image to System Clipboard
  const handleCopyImageToClipboard = async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
          onAddToast({
            title: 'QR Image Copied to Clipboard',
            description: 'Ready to paste into Word documents, WhatsApp, or email.',
            type: 'success',
          });
        } catch (copyErr) {
          // Fallback copy payload string
          navigator.clipboard.writeText(computedPayload);
          onAddToast({
            title: 'Payload Text Copied',
            description: 'Image clipboard restricted in this environment. Copied QR payload text.',
            type: 'info',
          });
        }
      }, 'image/png');
    } catch (err) {
      navigator.clipboard.writeText(computedPayload);
      onAddToast({
        title: 'Text Copied',
        description: 'Copied raw QR text to clipboard.',
        type: 'info',
      });
    }
  };

  // 1-Click Print QR Card
  const handlePrint = () => {
    const canvas = includeFrame ? generateFramedCanvas() : canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onAddToast({
        title: 'Pop-up Blocked',
        description: 'Please allow pop-ups to print the QR label.',
        type: 'warning',
      });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WeboDocx QR Code Print</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-family: sans-serif;
            }
            img {
              max-width: 90vw;
              max-height: 85vh;
              object-contain: fit;
              border: 1px solid #ccc;
              border-radius: 8px;
            }
            @media print {
              body { padding: 0; }
              img { border: none; max-width: 100%; height: auto; }
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div id="qr-code-studio-container" className="flex flex-col gap-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#eaedff] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00236f] text-white flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[28px]">
              qr_code_2
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-['Outfit'] text-[22px] font-bold text-[#131b2e] tracking-tight">
                Quick QR Code Generator &amp; Form Sharer
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#85f8c4]/20 border border-[#85f8c4]/50 text-[#003120] text-[11px] font-bold">
                High-Res PNG
              </span>
            </div>
            <p className="text-[13px] text-[#757682] mt-0.5">
              Convert URLs, contact vCards, UPI payment receipts, and form acknowledgment links into high-definition downloadable PNGs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownloadPng(true)}
            className="px-3.5 py-2 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[12.5px] font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              download
            </span>
            <span>Download PNG Card</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl bg-[#f2f3ff] text-[#00236f] hover:bg-[#e2e7ff] text-[12.5px] font-bold border border-[#dae2fd] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              print
            </span>
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: INPUT CONTROLS & CONTENT BUILDER (7 Cols) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Category Tabs */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#eaedff] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#eaedff] pb-3">
              <span className="text-[12px] font-bold text-[#131b2e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                  tune
                </span>
                <span>Select QR Content Type</span>
              </span>
              <span className="text-[11.5px] text-[#757682]">
                Payload length: <strong className="text-[#00236f] font-mono">{computedPayload.length}</strong> chars
              </span>
            </div>

            {/* Input Mode Pill Selector */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { id: 'url', label: 'Website / URL', icon: 'link' },
                { id: 'contact', label: 'Contact vCard', icon: 'contact_page' },
                { id: 'upi', label: 'UPI / Payment', icon: 'currency_rupee' },
                { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
                { id: 'text', label: 'Plain Text', icon: 'text_snippet' },
                { id: 'wifi', label: 'Wi-Fi Hotspot', icon: 'wifi' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInputType(tab.id as QrInputType)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-center transition-all cursor-pointer border ${
                    inputType === tab.id
                      ? 'bg-[#00236f] text-white border-[#00236f] shadow-sm'
                      : 'bg-[#f8f9ff] text-[#444651] border-[#dae2fd] hover:bg-[#eaedff]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] mb-1">
                    {tab.icon}
                  </span>
                  <span className="text-[11px] font-bold leading-tight line-clamp-1">
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>

            {/* ======================= 1. URL INPUT MODE ======================= */}
            {inputType === 'url' && (
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-bold text-[#131b2e]">
                    Destination Website / Form Link / Document URL
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#757682] text-[18px]">
                      link
                    </span>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://ssc.gov.in/apply"
                      className="w-full h-11 pl-10 pr-24 bg-[#f8f9ff] text-[13.5px] font-medium text-[#131b2e] rounded-xl border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                    />
                    <a
                      href={urlInput}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#e2e7ff] text-[#00236f] text-[11px] font-bold hover:bg-[#d5deff] transition-colors"
                    >
                      Test Link
                    </a>
                  </div>
                </div>

                {/* Quick Presets for Official Portals */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#757682]">
                    Quick Government Exam &amp; Scheme Portal Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_PORTAL_LINKS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setUrlInput(preset.url);
                          setFrameTitle(preset.name);
                          setFrameSubtitle('Official Government Online Portal');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#00236f] text-[11.5px] font-semibold border border-[#dae2fd] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          open_in_new
                        </span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ======================= 2. CONTACT / VCARD MODE ======================= */}
            {inputType === 'contact' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">First Name / Center Name</label>
                  <input
                    type="text"
                    value={vcard.firstName}
                    onChange={(e) => setVcard({ ...vcard, firstName: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Last Name / Suffix</label>
                  <input
                    type="text"
                    value={vcard.lastName}
                    onChange={(e) => setVcard({ ...vcard, lastName: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Mobile / Phone Number</label>
                  <input
                    type="tel"
                    value={vcard.phone}
                    onChange={(e) => setVcard({ ...vcard, phone: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Email Address</label>
                  <input
                    type="email"
                    value={vcard.email}
                    onChange={(e) => setVcard({ ...vcard, email: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Organization / CSC Cyber Cafe</label>
                  <input
                    type="text"
                    value={vcard.org}
                    onChange={(e) => setVcard({ ...vcard, org: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Website / Digital Card</label>
                  <input
                    type="url"
                    value={vcard.website}
                    onChange={(e) => setVcard({ ...vcard, website: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Physical Address / Center Location</label>
                  <input
                    type="text"
                    value={vcard.address}
                    onChange={(e) => setVcard({ ...vcard, address: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>
              </div>
            )}

            {/* ======================= 3. UPI PAYMENT MODE ======================= */}
            {inputType === 'upi' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Payee / Merchant Name</label>
                  <input
                    type="text"
                    value={upi.payeeName}
                    onChange={(e) => setUpi({ ...upi, payeeName: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">UPI ID (VPA)</label>
                  <input
                    type="text"
                    value={upi.upiId}
                    onChange={(e) => setUpi({ ...upi, upiId: e.target.value })}
                    placeholder="name@okaxis / 9876543210@paytm"
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] font-mono rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Amount (₹ INR - Optional)</label>
                  <input
                    type="number"
                    value={upi.amount}
                    onChange={(e) => setUpi({ ...upi, amount: e.target.value })}
                    placeholder="50.00"
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] font-mono rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Transaction Note / Form Ref</label>
                  <input
                    type="text"
                    value={upi.note}
                    onChange={(e) => setUpi({ ...upi, note: e.target.value })}
                    placeholder="Exam Form Fee / Photo Print"
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>
              </div>
            )}

            {/* ======================= 4. WHATSAPP MODE ======================= */}
            {inputType === 'whatsapp' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">WhatsApp Phone Number (With Country Code)</label>
                  <input
                    type="tel"
                    value={whatsapp.phone}
                    onChange={(e) => setWhatsapp({ ...whatsapp, phone: e.target.value })}
                    placeholder="919876543210"
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] font-mono rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Pre-filled Message</label>
                  <textarea
                    rows={3}
                    value={whatsapp.message}
                    onChange={(e) => setWhatsapp({ ...whatsapp, message: e.target.value })}
                    className="p-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>
              </div>
            )}

            {/* ======================= 5. PLAIN TEXT MODE ======================= */}
            {inputType === 'text' && (
              <div className="flex flex-col gap-1 pt-2">
                <label className="text-[11.5px] font-bold text-[#131b2e]">Any Custom Text / Acknowledgment Number / Notes</label>
                <textarea
                  rows={4}
                  value={rawTextInput}
                  onChange={(e) => setRawTextInput(e.target.value)}
                  placeholder="Paste candidate registration details, admit card roll numbers, or custom message..."
                  className="p-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f] font-mono"
                />
              </div>
            )}

            {/* ======================= 6. WI-FI HOTSPOT MODE ======================= */}
            {inputType === 'wifi' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Wi-Fi Network Name (SSID)</label>
                  <input
                    type="text"
                    value={wifi.ssid}
                    onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-[#131b2e]">Password</label>
                  <input
                    type="text"
                    value={wifi.password}
                    onChange={(e) => setWifi({ ...wifi, password: e.target.value })}
                    className="h-9 px-3 bg-[#f8f9ff] text-[12.5px] font-mono rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* QR Code Appearance & Customization */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#eaedff] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#eaedff] pb-3">
              <span className="text-[12px] font-bold text-[#131b2e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                  palette
                </span>
                <span>Visual Styling &amp; Colors</span>
              </span>
              <span className="text-[11px] text-[#757682]">
                High-Contrast Presets
              </span>
            </div>

            {/* Color Swatches */}
            <div className="flex flex-col gap-2">
              <label className="text-[11.5px] font-bold text-[#131b2e]">Color Presets</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTES.map((pal, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFgColor(pal.fg);
                      setBgColor(pal.bg);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all cursor-pointer ${
                      fgColor === pal.fg && bgColor === pal.bg
                        ? 'border-[#00236f] bg-[#e2e7ff] text-[#00236f] ring-2 ring-[#00236f]/20'
                        : 'border-[#dae2fd] bg-white text-[#444651] hover:bg-[#f8f9ff]'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-black/20"
                      style={{ backgroundColor: pal.fg }}
                    />
                    <span>{pal.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Precision Color Pickers & Error Correction */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f8f9ff] p-3 rounded-xl border border-[#dae2fd]">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#131b2e]">Foreground</label>
                <div className="flex items-center gap-2 h-9 px-2 bg-white rounded-lg border border-[#dae2fd]">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                  />
                  <span className="text-[11px] font-mono text-[#444651]">{fgColor}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#131b2e]">Background</label>
                <div className="flex items-center gap-2 h-9 px-2 bg-white rounded-lg border border-[#dae2fd]">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                  />
                  <span className="text-[11px] font-mono text-[#444651]">{bgColor}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#131b2e]">Error Correction</label>
                <select
                  value={errorCorrection}
                  onChange={(e) => setErrorCorrection(e.target.value as any)}
                  className="h-9 px-2 bg-white text-[11.5px] font-semibold rounded-lg border border-[#dae2fd]"
                >
                  <option value="L">L (7% Recovery)</option>
                  <option value="M">M (15% Recovery)</option>
                  <option value="Q">Q (25% Recovery)</option>
                  <option value="H">H (30% - Best for Print)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#131b2e]">Resolution</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(parseInt(e.target.value, 10))}
                  className="h-9 px-2 bg-white text-[11.5px] font-semibold rounded-lg border border-[#dae2fd]"
                >
                  <option value={512}>512px (Standard)</option>
                  <option value={1024}>1024px (High-Res)</option>
                  <option value={2048}>2048px (Ultra Print)</option>
                </select>
              </div>
            </div>

            {/* Center Logo Badge Options */}
            <div className="flex flex-col gap-2">
              <label className="text-[11.5px] font-bold text-[#131b2e]">Center Logo / Icon Overlay</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: 'none', label: 'None', icon: 'block' },
                  { id: 'link', label: 'URL Link', icon: 'link' },
                  { id: 'phone', label: 'Phone', icon: 'call' },
                  { id: 'upi', label: 'UPI Pay', icon: 'payments' },
                  { id: 'seal', label: 'Govt Seal', icon: 'account_balance' },
                  { id: 'text', label: 'Custom Text', icon: 'text_fields' },
                ].map((badge) => (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => setCenterBadge(badge.id as any)}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11.5px] font-semibold border transition-all cursor-pointer ${
                      centerBadge === badge.id
                        ? 'bg-[#00236f] text-white border-[#00236f]'
                        : 'bg-white text-[#444651] border-[#dae2fd] hover:bg-[#f2f3ff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {badge.icon}
                    </span>
                    <span>{badge.label}</span>
                  </button>
                ))}
              </div>

              {centerBadge === 'text' && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-bold text-[#757682]">Center Text (Max 4 chars):</span>
                  <input
                    type="text"
                    maxLength={4}
                    value={centerTextBadge}
                    onChange={(e) => setCenterTextBadge(e.target.value.toUpperCase())}
                    className="w-24 h-8 px-2 bg-[#f8f9ff] text-[12px] font-mono font-bold rounded-lg border border-[#dae2fd]"
                  />
                </div>
              )}
            </div>

            {/* Form Print Card Framing Options */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#eaedff]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFrame}
                  onChange={(e) => setIncludeFrame(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00236f]"
                />
                <span className="text-[12px] font-bold text-[#131b2e]">
                  Generate with Professional Printable Frame &amp; Labels
                </span>
              </label>

              {includeFrame && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <input
                    type="text"
                    value={frameTitle}
                    onChange={(e) => setFrameTitle(e.target.value)}
                    placeholder="Card Title (e.g. Scan for Application Form)"
                    className="h-9 px-3 bg-[#f8f9ff] text-[12px] rounded-lg border border-[#dae2fd]"
                  />
                  <input
                    type="text"
                    value={frameSubtitle}
                    onChange={(e) => setFrameSubtitle(e.target.value)}
                    placeholder="Card Subtitle (e.g. Official Link / Helpdesk)"
                    className="h-9 px-3 bg-[#f8f9ff] text-[12px] rounded-lg border border-[#dae2fd]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: LIVE INTERACTIVE PREVIEW & DOWNLOAD ACTIONS (5 Cols) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col gap-5 sticky top-20">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#eaedff] flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between border-b border-[#eaedff] pb-3">
              <span className="text-[12px] font-bold text-[#131b2e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                  visibility
                </span>
                <span>Live QR Code Preview</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#85f8c4]/20 text-[#003120] text-[10px] font-bold">
                {resolution} × {resolution} px
              </span>
            </div>

            {/* QR Card Container */}
            <div
              id="qr-preview-card"
              className="w-full max-w-[340px] bg-[#ffffff] p-5 rounded-2xl border border-[#dae2fd] shadow-sm flex flex-col items-center gap-3 relative transition-all"
            >
              {includeFrame && (
                <div className="w-full text-center flex flex-col gap-0.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00236f]">
                    WeboDocx • Citizen Utility
                  </span>
                  <h4 className="font-['Outfit'] text-[15px] font-bold text-[#131b2e] line-clamp-1">
                    {frameTitle || 'Scan to Open Portal'}
                  </h4>
                  <p className="text-[11px] text-[#757682] line-clamp-1">
                    {frameSubtitle || 'Scan with Camera / Google Lens'}
                  </p>
                </div>
              )}

              {/* QR Canvas Display */}
              <div className="p-3 bg-white rounded-xl shadow-xs border border-[#eaedff] flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  className="w-[220px] h-[220px] object-contain rounded-lg"
                />
              </div>

              {includeFrame && (
                <div className="w-full pt-1 border-t border-[#eaedff] text-center">
                  <span className="text-[10px] font-mono text-[#757682]">
                    {inputType.toUpperCase()} • 100% PRIVATE
                  </span>
                </div>
              )}
            </div>

            {/* Quick Payload Snippet */}
            <div className="w-full bg-[#f8f9ff] p-3 rounded-xl border border-[#dae2fd] flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#757682]">
                <span>Encoded Content String</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(computedPayload);
                    onAddToast({
                      title: 'Payload Copied',
                      description: 'Raw text copied to clipboard.',
                      type: 'success',
                    });
                  }}
                  className="text-[#00236f] hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    content_copy
                  </span>
                  <span>Copy Text</span>
                </button>
              </div>
              <p className="font-mono text-[11px] text-[#131b2e] break-all max-h-16 overflow-y-auto leading-tight bg-white p-2 rounded border border-[#dae2fd]">
                {computedPayload}
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleDownloadPng(includeFrame)}
                className="w-full py-3 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[13px] font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  download
                </span>
                <span>Download High-Res PNG</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPng(false)}
                  className="py-2 px-2 rounded-xl bg-white text-[#00236f] hover:bg-[#f2f3ff] text-[12px] font-bold border border-[#dae2fd] transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="Download transparent / standalone QR without framed card"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    crop_free
                  </span>
                  <span>Pure QR Only</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="py-2 px-2 rounded-xl bg-white text-[#00236f] hover:bg-[#f2f3ff] text-[12px] font-bold border border-[#dae2fd] transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="Download vector SVG"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    vector_draw
                  </span>
                  <span>Vector SVG</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyImageToClipboard}
                  className="py-2 px-2 rounded-xl bg-[#f2f3ff] text-[#444651] hover:text-[#131b2e] hover:bg-[#eaedff] text-[12px] font-semibold border border-[#dae2fd] transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    content_copy
                  </span>
                  <span>Copy Image</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-2 px-2 rounded-xl bg-[#f2f3ff] text-[#444651] hover:text-[#131b2e] hover:bg-[#eaedff] text-[12px] font-semibold border border-[#dae2fd] transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    print
                  </span>
                  <span>Print Card</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
