import React, { useState } from 'react';
import { 
  Settings, Globe, Monitor, LayoutTemplate, Columns, Rows, X, 
  ArrowDownCircle, AlignVerticalSpaceAround, Pilcrow, Mic2, 
  WholeWord, Type, AlignLeft, AlignCenter, AlignRight, Keyboard,
  Layers, Sliders, Palette
} from 'lucide-react';
import { 
  SUPPORTED_LANGUAGES, 
  LanguageCode, 
  AppSettings, 
  DEFAULT_VIEWER_STYLE, 
  ViewerStyle, 
  FONT_OPTIONS 
} from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  onClose?: () => void;
  isViewerMode?: boolean;
}

type TabType = 'display' | 'language' | 'advanced';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  onSettingsChange,
  onClose,
  isViewerMode = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('display');

  const handleLanguageToggle = (langCode: LanguageCode) => {
    const exists = settings.targetLanguages.includes(langCode);
    const newLangs = exists 
      ? settings.targetLanguages.filter(l => l !== langCode)
      : [...settings.targetLanguages, langCode];
    onSettingsChange({ ...settings, targetLanguages: newLangs });
  };

  const updateViewerStyle = (updates: Partial<ViewerStyle>) => {
    onSettingsChange({
      ...settings,
      viewerStyle: { ...settings.viewerStyle, ...updates }
    });
  };

  const updateLanguageStyle = (lang: string, field: string, value: any) => {
    onSettingsChange({
      ...settings,
      viewerStyle: {
        ...settings.viewerStyle,
        languageStyles: {
          ...settings.viewerStyle.languageStyles,
          [lang]: {
            ...settings.viewerStyle.languageStyles[lang],
            [field]: value
          }
        }
      }
    });
  };

  // --- Sub-components for cleaner render ---

  const renderTabButton = (id: TabType, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 pb-3 pt-2 text-sm font-medium border-b-2 flex items-center justify-center gap-2 transition-colors
        ${activeTab === id 
          ? 'border-blue-600 text-blue-600' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 text-gray-900 font-sans">
      
      {/* Header */}
      <div className="px-5 py-4 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
          <Settings size={20} className="text-gray-500" /> 환경 설정
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex px-2 bg-white border-b border-gray-200 shrink-0">
        {renderTabButton('display', '화면', <Monitor size={16} />)}
        {renderTabButton('language', '언어/서체', <Type size={16} />)}
        {renderTabButton('advanced', '고급', <Sliders size={16} />)}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="max-w-md mx-auto space-y-6">

          {/* === DISPLAY TAB === */}
          {activeTab === 'display' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Layout & Align */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <LayoutTemplate size={14} /> 레이아웃
                 </h3>
                 
                 <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-2">배치 모드</label>
                      <div className="flex rounded-lg shadow-sm bg-gray-100 p-1">
                          {[
                            { id: 'combined', icon: LayoutTemplate, label: '통합' },
                            { id: 'rows', icon: Rows, label: '행 분리' },
                            { id: 'columns', icon: Columns, label: '열 분리' }
                          ].map(item => (
                            <button
                              key={item.id}
                              onClick={() => updateViewerStyle({ layoutMode: item.id as any })}
                              className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all
                                ${settings.viewerStyle.layoutMode === item.id 
                                  ? 'bg-white text-blue-600 shadow-sm' 
                                  : 'text-gray-500 hover:text-gray-700'}`}
                            >
                              <item.icon size={14} /> {item.label}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-2">텍스트 정렬</label>
                      <div className="flex rounded-lg shadow-sm bg-gray-100 p-1">
                          {[
                            { id: 'left', icon: AlignLeft },
                            { id: 'center', icon: AlignCenter },
                            { id: 'right', icon: AlignRight }
                          ].map(item => (
                            <button
                              key={item.id}
                              onClick={() => updateViewerStyle({ textAlign: item.id as any })}
                              className={`flex-1 py-2 rounded-md flex items-center justify-center transition-all
                                ${settings.viewerStyle.textAlign === item.id 
                                  ? 'bg-white text-blue-600 shadow-sm' 
                                  : 'text-gray-500 hover:text-gray-700'}`}
                            >
                              <item.icon size={16} />
                            </button>
                          ))}
                      </div>
                    </div>
                 </div>
              </div>

              {/* Global Appearance */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Palette size={14} /> 디자인 요소
                 </h3>

                 <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">배경 색상</label>
                    <div className="flex gap-2 items-center">
                      <div className="w-8 h-8 rounded-full border border-gray-200 shadow-sm shrink-0" style={{ backgroundColor: settings.viewerStyle.backgroundColor }} />
                      <input 
                        type="color" 
                        value={settings.viewerStyle.backgroundColor}
                        onChange={(e) => updateViewerStyle({ backgroundColor: e.target.value })}
                        className="flex-1 h-9 p-1 border border-gray-200 rounded-lg bg-gray-50 cursor-pointer"
                      />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">기본 크기 ({settings.viewerStyle.baseFontSize}px)</label>
                      <input 
                        type="range" min="24" max="120" step="4"
                        value={settings.viewerStyle.baseFontSize}
                        onChange={(e) => updateViewerStyle({ baseFontSize: Number(e.target.value) })}
                        className="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">줄 간격 ({settings.viewerStyle.lineHeight})</label>
                      <input 
                        type="range" min="1.0" max="3.0" step="0.1"
                        value={settings.viewerStyle.lineHeight}
                        onChange={(e) => updateViewerStyle({ lineHeight: parseFloat(e.target.value) })}
                        className="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                 </div>
              </div>

              {/* View Options */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Monitor size={14} /> 보기 옵션
                 </h3>
                 
                 <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ArrowDownCircle size={16} /></div>
                       <span className="text-sm font-medium text-gray-700">자동 스크롤</span>
                    </div>
                    <button 
                       onClick={() => updateViewerStyle({ autoScroll: !settings.viewerStyle.autoScroll })}
                       className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.viewerStyle.autoScroll ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                       <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.viewerStyle.autoScroll ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                 </div>

                 <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><AlignVerticalSpaceAround size={16} /></div>
                       <span className="text-sm font-medium text-gray-700">문단 간격 넓게</span>
                    </div>
                    <button 
                       onClick={() => updateViewerStyle({ paragraphSpacing: settings.viewerStyle.paragraphSpacing > 0 ? 0 : 1.0 })}
                       className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.viewerStyle.paragraphSpacing > 0 ? 'bg-purple-600' : 'bg-gray-300'}`}
                    >
                       <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.viewerStyle.paragraphSpacing > 0 ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                 </div>
              </div>
            </div>
          )}

          {/* === LANGUAGE TAB === */}
          {activeTab === 'language' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               
               {!isViewerMode && (
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                       <Globe size={14} /> 번역 언어 선택
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <button
                          key={lang.code}
                          onClick={() => handleLanguageToggle(lang.code)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all
                            ${settings.targetLanguages.includes(lang.code) 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                 </div>
               )}

               <div className="space-y-4">
                  {['ko', ...settings.targetLanguages].map(code => {
                    const langLabel = code === 'ko' ? '한국어 (원본)' : SUPPORTED_LANGUAGES.find(l=>l.code===code)?.label;
                    const style = settings.viewerStyle.languageStyles[code] || DEFAULT_VIEWER_STYLE.languageStyles[code];

                    return (
                      <div key={code} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-sm text-gray-800 flex items-center gap-2">
                            <span className="bg-white border border-gray-200 text-gray-500 text-[10px] px-1.5 py-0.5 rounded uppercase font-mono">{code}</span>
                            {langLabel}
                          </span>
                        </div>
                        
                        <div className="p-4 space-y-4">
                           {/* Font Selection */}
                           <div>
                             <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">글꼴 (Font Family)</label>
                             <div className="relative">
                               <select 
                                  className="w-full text-sm p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                  value={style.fontFamily}
                                  onChange={(e) => updateLanguageStyle(code, 'fontFamily', e.target.value)}
                               >
                                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                               </select>
                               <div className="absolute right-3 top-2.5 pointer-events-none text-gray-500"><Type size={14}/></div>
                             </div>
                           </div>

                           {/* Color & Scale Row */}
                           <div className="flex gap-4">
                             <div className="w-1/3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">색상</label>
                                <div className="flex items-center gap-2">
                                   <input type="color" 
                                      value={style.color} 
                                      onChange={(e) => updateLanguageStyle(code, 'color', e.target.value)}
                                      className="w-full h-9 p-0.5 rounded border border-gray-300 cursor-pointer" />
                                </div>
                             </div>
                             <div className="flex-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">크기 비율 ({style.fontSizeScale}x)</label>
                                <input type="range" min="0.5" max="2" step="0.1" 
                                   value={style.fontSizeScale} 
                                   onChange={(e) => updateLanguageStyle(code, 'fontSizeScale', parseFloat(e.target.value))}
                                   className="w-full h-1.5 accent-gray-600 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2" />
                             </div>
                           </div>
                           
                           {/* Advanced Type Specs */}
                           <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                              <div>
                                 <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">굵기 ({style.fontWeight})</label>
                                 <input type="range" min="100" max="900" step="100"
                                    value={style.fontWeight}
                                    onChange={(e) => updateLanguageStyle(code, 'fontWeight', Number(e.target.value))}
                                    className="w-full h-1.5 accent-gray-400 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">자간 ({style.letterSpacing}px)</label>
                                 <input type="range" min="-2" max="10" step="0.5"
                                    value={style.letterSpacing}
                                    onChange={(e) => updateLanguageStyle(code, 'letterSpacing', parseFloat(e.target.value))}
                                    className="w-full h-1.5 accent-gray-400 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                              </div>
                           </div>
                        </div>
                     </div>
                    );
                  })}
               </div>
             </div>
          )}

          {/* === ADVANCED TAB === */}
          {activeTab === 'advanced' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
               
               {/* Input Logic (Hidden in Viewer) */}
               {!isViewerMode && (
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                       <Keyboard size={14} /> 입력 및 전송 설정
                    </h3>

                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg"><Pilcrow size={16} /></div>
                         <div>
                            <span className="text-sm font-medium text-gray-700 block">문장부호 자동 전송</span>
                            <span className="text-[10px] text-gray-400">(. ? !) 입력 시 즉시 문장 완료</span>
                         </div>
                      </div>
                      <button 
                        onClick={() => onSettingsChange({ ...settings, autoOnPunctuation: !settings.autoOnPunctuation })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoOnPunctuation ? 'bg-yellow-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.autoOnPunctuation ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    
                    <div className="pt-3 border-t border-gray-100">
                       <label className="text-xs font-medium text-gray-600 block mb-2">Enter 키 동작</label>
                       <div className="grid grid-cols-2 gap-2">
                          <button
                             onClick={() => onSettingsChange({ ...settings, enterKeyBehavior: 'send' })}
                             className={`px-3 py-2 text-xs rounded-lg border transition-all text-left
                                ${settings.enterKeyBehavior === 'send' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}
                          >
                             <span className="font-bold block">즉시 전송</span>
                             <span className="text-[10px] opacity-70">Shift+Enter로 줄바꿈</span>
                          </button>
                          <button
                             onClick={() => onSettingsChange({ ...settings, enterKeyBehavior: 'newline' })}
                             className={`px-3 py-2 text-xs rounded-lg border transition-all text-left
                                ${settings.enterKeyBehavior === 'newline' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}
                          >
                             <span className="font-bold block">줄바꿈</span>
                             <span className="text-[10px] opacity-70">Insert 키로 전송</span>
                          </button>
                       </div>
                    </div>
                 </div>
               )}

               {/* Advanced Display Logic */}
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                     <Layers size={14} /> 고급 표시 설정
                  </h3>

                  {/* Live Input Mode */}
                  <div>
                     <label className="text-xs font-medium text-gray-600 block mb-2">실시간 입력 표시 단위</label>
                     <div className="flex bg-gray-100 rounded-lg p-1">
                       <button
                          onClick={() => updateViewerStyle({ liveInputMode: 'char' })}
                          className={`flex-1 py-1.5 text-xs rounded-md transition-all flex items-center justify-center gap-2
                             ${settings.viewerStyle.liveInputMode === 'char' ? 'bg-white shadow text-gray-800 font-bold' : 'text-gray-500'}`}
                       ><Type size={14}/> 글자 단위</button>
                       <button
                          onClick={() => updateViewerStyle({ liveInputMode: 'word' })}
                          className={`flex-1 py-1.5 text-xs rounded-md transition-all flex items-center justify-center gap-2
                             ${settings.viewerStyle.liveInputMode === 'word' ? 'bg-white shadow text-gray-800 font-bold' : 'text-gray-500'}`}
                       ><WholeWord size={14}/> 단어 단위</button>
                     </div>
                  </div>

                  {/* Speaker Detection */}
                  <div className="pt-2 border-t border-gray-100">
                     <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><Mic2 size={16} /></div>
                           <div>
                              <span className="text-sm font-medium text-gray-700 block">화자 변경 감지</span>
                              <span className="text-[10px] text-gray-400">문장이 (-)로 시작하면 색상 변경</span>
                           </div>
                        </div>
                        <button 
                          onClick={() => updateViewerStyle({ detectSpeakerChanges: !settings.viewerStyle.detectSpeakerChanges })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.viewerStyle.detectSpeakerChanges ? 'bg-teal-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.viewerStyle.detectSpeakerChanges ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                     </div>

                     {settings.viewerStyle.detectSpeakerChanges && (
                        <div className="bg-gray-50 rounded-lg p-3 animate-in fade-in slide-in-from-top-1">
                           <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-600">화자 변경 강조 색상</span>
                              <div className="flex items-center gap-2">
                                 <input 
                                    type="color" 
                                    value={settings.viewerStyle.speakerChangeColor}
                                    onChange={(e) => updateViewerStyle({ speakerChangeColor: e.target.value })}
                                    className="h-8 w-12 p-1 border border-gray-200 rounded bg-white cursor-pointer"
                                 />
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};