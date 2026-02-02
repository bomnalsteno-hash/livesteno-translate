import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { X, Download, Copy, ExternalLink, Palette, Layout, Type } from 'lucide-react';
import { Button } from './Button';

interface QRCodeModalProps {
  url: string;
  roomName: string;
  onClose: () => void;
}

const BG_PRESETS = [
  '#FFFFFF', // White
  '#F3F4F6', // Gray-100
  '#FEF3C7', // Amber-100
  '#E0F2FE', // Sky-100
  '#000000', // Black
];

const FG_PRESETS = [
  '#000000', // Black
  '#2563EB', // Blue-600
  '#059669', // Emerald-600
  '#DC2626', // Red-600
  '#FFFFFF', // White
];

type FrameStyle = 'basic' | 'rounded' | 'polaroid';

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ url, roomName, onClose }) => {
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [padding, setPadding] = useState(20);
  const [includeName, setIncludeName] = useState(true);
  const [fontSize, setFontSize] = useState(24);
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('rounded');
  
  const qrSize = 256;

  const handleDownload = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    // Calculate dimensions based on frame style
    let canvasWidth = qrSize + (padding * 2);
    let canvasHeight = canvasWidth;
    let qrX = padding;
    let qrY = padding;

    if (frameStyle === 'polaroid') {
       // Polaroid has extra bottom space
       canvasHeight = canvasWidth + (includeName ? fontSize * 3 : 60);
    } else {
       // Basic & Rounded handle text height normally
       if (includeName) canvasHeight += fontSize + 20;
    }
    
    img.onload = () => {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      if (ctx) {
          // Clear
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          
          // Draw Background (Frame)
          ctx.fillStyle = bgColor;
          
          if (frameStyle === 'rounded') {
             // Draw Rounded Rect
             const radius = 32;
             ctx.beginPath();
             ctx.roundRect(0, 0, canvasWidth, canvasHeight, radius);
             ctx.fill();
          } else if (frameStyle === 'polaroid') {
             // Draw Polaroid Rect (usually white/light, but use bgColor)
             ctx.fillRect(0, 0, canvasWidth, canvasHeight);
             
             // Draw Inner Dark Area for QR? No, standard polaroid is just white frame.
             // We just rely on padding.
          } else {
             // Basic Square
             ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          }

          // Draw QR Code
          ctx.drawImage(img, qrX, qrY);
          
          // Draw Room Name Text
          if (includeName) {
            ctx.fillStyle = fgColor;
            ctx.font = `bold ${fontSize}px "Noto Sans KR", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let textY;
            if (frameStyle === 'polaroid') {
                // Centered in the bottom area
                const bottomAreaStart = qrY + qrSize + padding;
                const bottomAreaHeight = canvasHeight - bottomAreaStart;
                textY = bottomAreaStart + (bottomAreaHeight / 2);
            } else {
                // Just below QR
                textY = qrY + qrSize + padding + (fontSize / 2);
            }
            
            ctx.fillText(roomName, canvasWidth / 2, textY);
          }
          
          const pngFile = canvas.toDataURL("image/png");
          
          const downloadLink = document.createElement("a");
          downloadLink.download = `qrcode-${roomName.replace(/\s+/g, '-')}-${frameStyle}.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(url);
    alert('URL이 클립보드에 복사되었습니다.');
  };

  // Dynamic Preview Style
  const getPreviewStyle = () => {
    const base = {
       background: bgColor,
       padding: `${padding}px`,
       boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    };

    if (frameStyle === 'rounded') {
       return { ...base, borderRadius: '24px' };
    }
    if (frameStyle === 'polaroid') {
       return { ...base, paddingBottom: includeName ? `${fontSize * 2}px` : '40px' };
    }
    return base; // basic
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* LEFT: Preview Area */}
        <div className="flex-1 bg-gray-100 p-8 flex flex-col items-center justify-center border-r border-gray-200 relative overflow-y-auto min-h-[400px]">
           <h3 className="absolute top-6 left-6 font-bold text-gray-400 text-sm uppercase tracking-widest">Preview</h3>
           
           <div style={getPreviewStyle()} className="transition-all duration-300">
              <div className="bg-white"> {/* QR Wrapper to ensure contrast if needed, but react-qr-code handles fg/bg */}
                  <QRCode
                      id="qr-code-svg"
                      value={url}
                      size={qrSize}
                      fgColor={fgColor}
                      bgColor={bgColor} 
                      level="H"
                  />
              </div>
              {includeName && (
                <div 
                  className={`text-center font-bold mt-4 leading-tight transition-all`} 
                  style={{ color: fgColor, fontSize: `${fontSize}px` }}
                >
                  {roomName}
                </div>
              )}
           </div>
        </div>

        {/* RIGHT: Controls */}
        <div className="w-full md:w-[400px] bg-white flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-lg text-gray-800">QR 디자인 설정</h3>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
               
               {/* URL & Actions */}
               <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">공유 링크</label>
                  <div className="flex gap-2">
                      <input 
                        readOnly 
                        value={url} 
                        className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-600 font-mono truncate focus:outline-none select-all"
                      />
                      <Button size="sm" variant="secondary" onClick={handleCopyUrl} title="복사">
                        <Copy size={14} />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => window.open(url, '_blank')} title="열기">
                        <ExternalLink size={14} />
                      </Button>
                  </div>
               </div>

               <hr className="border-gray-100" />

               {/* Frame Style */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                     <Layout size={14} /> 프레임 스타일
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <button 
                       onClick={() => setFrameStyle('basic')}
                       className={`p-2 border rounded-lg text-xs font-medium transition-all ${frameStyle === 'basic' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50 border-gray-200'}`}
                     >
                       기본 (Basic)
                     </button>
                     <button 
                       onClick={() => setFrameStyle('rounded')}
                       className={`p-2 border rounded-lg text-xs font-medium transition-all ${frameStyle === 'rounded' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50 border-gray-200'}`}
                     >
                       라운드 (Rounded)
                     </button>
                     <button 
                       onClick={() => setFrameStyle('polaroid')}
                       className={`p-2 border rounded-lg text-xs font-medium transition-all ${frameStyle === 'polaroid' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50 border-gray-200'}`}
                     >
                       폴라로이드
                     </button>
                  </div>
               </div>

               {/* Colors */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                     <Palette size={14} /> 색상 테마
                  </div>
                  
                  <div className="space-y-3">
                      <div>
                         <label className="text-xs text-gray-600 block mb-1">배경 (Background)</label>
                         <div className="flex flex-wrap gap-2">
                           {BG_PRESETS.map(c => (
                             <button key={c} onClick={() => setBgColor(c)} style={{backgroundColor: c}} 
                               className={`w-6 h-6 rounded-full border border-gray-300 ${bgColor === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`} 
                             />
                           ))}
                           <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-6 h-6 p-0 border-0 rounded-full overflow-hidden" />
                         </div>
                      </div>
                      <div>
                         <label className="text-xs text-gray-600 block mb-1">QR 코드 (Foreground)</label>
                         <div className="flex flex-wrap gap-2">
                           {FG_PRESETS.map(c => (
                             <button key={c} onClick={() => setFgColor(c)} style={{backgroundColor: c}} 
                               className={`w-6 h-6 rounded-full border border-gray-300 ${fgColor === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`} 
                             />
                           ))}
                           <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="w-6 h-6 p-0 border-0 rounded-full overflow-hidden" />
                         </div>
                      </div>
                  </div>
               </div>

               {/* Layout Sliders */}
               <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                     <Type size={14} /> 크기 및 텍스트
                  </div>
                  
                  <div className="space-y-4">
                     <div>
                        <div className="flex justify-between text-xs mb-1">
                           <span className="text-gray-600">여백 (Padding)</span>
                           <span className="text-gray-400">{padding}px</span>
                        </div>
                        <input 
                           type="range" min="0" max="60" step="4" 
                           value={padding} onChange={(e) => setPadding(Number(e.target.value))}
                           className="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                     </div>

                     <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" checked={includeName} onChange={(e) => setIncludeName(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">방 이름 표시</span>
                     </div>

                     {includeName && (
                       <div className="animate-in fade-in slide-in-from-top-1">
                          <div className="flex justify-between text-xs mb-1">
                             <span className="text-gray-600">폰트 크기</span>
                             <span className="text-gray-400">{fontSize}px</span>
                          </div>
                          <input 
                             type="range" min="12" max="64" step="2" 
                             value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                             className="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                       </div>
                     )}
                  </div>
               </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
               <Button variant="ghost" onClick={onClose}>닫기</Button>
               <Button icon={<Download size={16} />} onClick={handleDownload} variant="primary">
                 PNG 저장
               </Button>
            </div>
        </div>
      </div>
    </div>
  );
};