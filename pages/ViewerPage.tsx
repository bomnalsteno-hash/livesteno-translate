import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { broadcastService } from '../services/broadcastService';
import { roomSyncService, type RoomStatePayload } from '../services/roomSyncService';
import { StenoMessage, AppSettings, DEFAULT_VIEWER_STYLE, DEFAULT_LANGUAGE_STYLE } from '../types';
import { SettingsPanel } from '../components/SettingsPanel';
import { Settings } from 'lucide-react';

interface ViewerPageProps {
  isEmbedded?: boolean;
}

export const ViewerPage: React.FC<ViewerPageProps> = ({ isEmbedded = false }) => {
  const { roomId } = useParams<{ roomId: string }>();
  
  // Storage Keys scoped by Room ID
  const logsKey = `livesteno_logs_${roomId}`;
  const settingsKey = `livesteno_settings_${roomId}`;

  const [messages, setMessages] = useState<StenoMessage[]>([]);
  const [liveInput, setLiveInput] = useState<string>('');
  
  const [settings, setSettings] = useState<AppSettings>({
      targetLanguages: [], 
      translationEnabled: true,
      autoOnPunctuation: false,
      enterKeyBehavior: 'send', 
      triggerKeys: [],
      viewerStyle: DEFAULT_VIEWER_STYLE
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Ref for the main scrolling container
  const containerRef = useRef<HTMLDivElement>(null);

  // 모바일/좁은 화면 감지 → 글씨 크기 추가 축소
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobileView(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Connect to Room (같은 기기 탭 간 BroadcastChannel)
  useEffect(() => {
    if (roomId) {
      broadcastService.connect(roomId);
    }
  }, [roomId]);

  // 다른 기기(스마트폰 등) 뷰어: 서버에 올라간 방 상태 폴링 (QR로 들어온 경우 여기서만 데이터 수신)
  const POLL_INTERVAL_MS = 500;
  useEffect(() => {
    if (!roomId) return;
    const apply = (data: RoomStatePayload | null) => {
      if (!data) return;
      if (Array.isArray(data.messages)) {
        setMessages(prev => {
          if (data.messages!.length >= prev.length || data.messages!.length === 0) return data.messages!;
          return prev;
        });
      }
      // 서버에서는 메시지·대상 언어만 반영. 배치 모드 등 viewerStyle은 뷰어 로컬 설정 유지(자꾸 바뀌는 현상 방지).
      if (data.settings != null) {
        setSettings(prev => ({
          ...prev,
          targetLanguages: Array.isArray(data.settings!.targetLanguages) ? data.settings!.targetLanguages : prev.targetLanguages,
        }));
      }
      if (typeof data.liveInput === 'string') {
        setLiveInput(data.liveInput);
      }
    };
    const poll = () => roomSyncService.getRoomState(roomId!).then(apply);
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [roomId]);

  // Initial Load & Persistence (With Safety Checks)
  useEffect(() => {
    const savedLogs = localStorage.getItem(logsKey);
    if (savedLogs) {
      try { 
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed)) {
            setMessages(parsed); 
        } else {
            setMessages([]);
        }
      } catch (e) {
        setMessages([]);
      }
    }
    
    const savedSettings = localStorage.getItem(settingsKey);
    if (savedSettings) {
      try { 
        const parsed = JSON.parse(savedSettings);
        
        // Validate critical fields to prevent blank screen
        const validModes = ['combined', 'rows', 'columns'];
        let loadedLayout = parsed.viewerStyle?.layoutMode;
        if (!validModes.includes(loadedLayout)) loadedLayout = 'combined';

        setSettings(prev => ({
            ...prev,
            ...parsed,
            targetLanguages: Array.isArray(parsed.targetLanguages) ? parsed.targetLanguages : [],
            viewerStyle: {
                ...DEFAULT_VIEWER_STYLE,
                ...parsed.viewerStyle,
                layoutMode: loadedLayout,
                languageStyles: {
                    ...DEFAULT_VIEWER_STYLE.languageStyles,
                    ...(parsed.viewerStyle?.languageStyles || {})
                },
                autoScroll: parsed.viewerStyle?.autoScroll ?? DEFAULT_VIEWER_STYLE.autoScroll,
                paragraphSpacing: parsed.viewerStyle?.paragraphSpacing ?? DEFAULT_VIEWER_STYLE.paragraphSpacing,
                liveInputMode: parsed.viewerStyle?.liveInputMode ?? DEFAULT_VIEWER_STYLE.liveInputMode,
                detectSpeakerChanges: parsed.viewerStyle?.detectSpeakerChanges ?? DEFAULT_VIEWER_STYLE.detectSpeakerChanges,
                speakerChangeColor: parsed.viewerStyle?.speakerChangeColor ?? DEFAULT_VIEWER_STYLE.speakerChangeColor,
                textAlign: parsed.viewerStyle?.textAlign ?? DEFAULT_VIEWER_STYLE.textAlign,
            },
            enterKeyBehavior: parsed.enterKeyBehavior ?? 'send',
        }));
      } catch (e) {
        console.error("Settings load error", e);
      }
    }
  }, [logsKey, settingsKey]);

  // Save changes locally
  const handleSettingsChange = (newSettings: AppSettings) => {
      setSettings(newSettings);
      localStorage.setItem(settingsKey, JSON.stringify(newSettings));
  };

  // Listen to Broadcasts
  useEffect(() => {
    const unsubscribe = broadcastService.subscribe((event) => {
      switch (event.type) {
        case 'NEW_MESSAGE':
          setMessages(prev => [...(Array.isArray(prev) ? prev : []), event.payload]);
          break;
        case 'UPDATE_MESSAGE':
          setMessages(prev => (Array.isArray(prev) ? prev : []).map(m => m.id === event.payload.id ? event.payload : m));
          break;
        case 'LIVE_INPUT':
          setLiveInput(event.payload || '');
          break;
        case 'SYNC_SETTINGS':
          if (event.payload) {
             setSettings(event.payload);
          }
          break;
        case 'CLEAR_SCREEN':
          setMessages([]);
          setLiveInput('');
          break;
      }
    });
    return unsubscribe;
  }, []);

  // Auto-scroll Logic (Instant & Robust)
  useEffect(() => {
    if (!settings.viewerStyle.autoScroll) return;

    const performScroll = (el: Element) => {
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    };

    // 1. Scroll main container
    if (containerRef.current) {
       performScroll(containerRef.current);
    }
    
    // 2. Scroll individual rows (if in row mode)
    // Using setTimeout to ensure DOM is updated
    const timer = setTimeout(() => {
        if (containerRef.current) performScroll(containerRef.current);
        const rowContainers = document.querySelectorAll('.auto-scroll-row');
        rowContainers.forEach(el => performScroll(el));
    }, 10);

    return () => clearTimeout(timer);
  }, [messages, liveInput, settings.viewerStyle.layoutMode, settings.viewerStyle.autoScroll]);

  // Process Messages for Speaker State (Toggle Logic)
  const { processedMessages, liveInputHighlight } = useMemo(() => {
    let isHighlightActive = false;
    
    // Safety check for messages array
    const msgs = Array.isArray(messages) ? messages : [];

    const processed = msgs.map(msg => {
      const text = msg.originalText || '';
      if (settings.viewerStyle.detectSpeakerChanges && text.trim().startsWith('-')) {
        isHighlightActive = !isHighlightActive;
      }
      return { ...msg, originalText: text, isHighlight: isHighlightActive };
    });

    let liveHighlight = isHighlightActive;
    if (settings.viewerStyle.detectSpeakerChanges && (liveInput || '').trim().startsWith('-')) {
      liveHighlight = !liveHighlight;
    }

    return { processedMessages: processed, liveInputHighlight: liveHighlight };
  }, [messages, liveInput, settings.viewerStyle.detectSpeakerChanges]);

  // Styles
  const style = settings.viewerStyle || DEFAULT_VIEWER_STYLE;
  const targetLangs = Array.isArray(settings.targetLanguages) ? settings.targetLanguages : [];
  const paragraphMargin = style.paragraphSpacing > 0 ? `${style.paragraphSpacing}em` : '0px';

  const getLangStyle = (lang: string, isHighlight: boolean = false): React.CSSProperties => {
    const langStyles = style.languageStyles || {};
    const langStyle = langStyles[lang] || langStyles['ko'] || DEFAULT_LANGUAGE_STYLE;
    const koColor = (langStyles['ko'] || DEFAULT_LANGUAGE_STYLE).color || '#ffffff';

    let baseSize = isEmbedded ? style.baseFontSize * 0.6 : style.baseFontSize;
    if (isMobileView) baseSize *= 0.55;

    let displayColor = langStyle.color || '#ffffff';
    if (settings.viewerStyle.detectSpeakerChanges) {
      if (isHighlight) {
        displayColor = settings.viewerStyle.speakerChangeColor || '#FFBB00';
      } else if (lang !== 'ko') {
        displayColor = koColor;
      }
    }

    return {
      fontFamily: langStyle.fontFamily || 'Noto Sans KR',
      color: displayColor,
      fontSize: `${baseSize * (langStyle.fontSizeScale || 1)}px`,
      lineHeight: style.lineHeight || 1.5,
      fontWeight: langStyle.fontWeight || 400,
      letterSpacing: `${langStyle.letterSpacing || 0}px`,
      marginBottom: '0', 
    };
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: style.backgroundColor || '#000000',
    width: isEmbedded ? '100%' : '100vw',
    height: isEmbedded ? '100%' : '100vh',
    textAlign: style.textAlign || 'left',
  };

  const activeRowLangs = ['ko', ...targetLangs];

  // 방금 보낸 문장과 liveInput이 같을 때 중복 라인으로 보이지 않도록 숨김 (불안정/깜빡임 완화)
  const lastMsg = processedMessages[processedMessages.length - 1];
  const showLiveInput = liveInput && (!lastMsg || (lastMsg.originalText || '').trim() !== liveInput.trim());

  const renderLiveInputText = () => {
    if (!liveInput) return null;
    
    const lastSpaceIndex = liveInput.lastIndexOf(' ');
    let stablePart = '';
    let activePart = liveInput;

    if (lastSpaceIndex !== -1) {
      stablePart = liveInput.substring(0, lastSpaceIndex + 1);
      activePart = liveInput.substring(lastSpaceIndex + 1);
    }

    const colorStyle = (settings.viewerStyle.detectSpeakerChanges && liveInputHighlight) 
        ? { color: settings.viewerStyle.speakerChangeColor } 
        : {};

    if (settings.viewerStyle.liveInputMode === 'word') {
       return <span className="opacity-100" style={colorStyle}>{stablePart}</span>;
    } else {
       return (
        <>
           {stablePart && <span className="opacity-100" style={colorStyle}>{stablePart}</span>}
           {activePart && <span className="opacity-60" style={colorStyle}>{activePart}</span>}
        </>
      );
    }
  };

  // Safe layout mode
  const currentLayout = (style.layoutMode === 'columns' || style.layoutMode === 'rows') 
                        ? style.layoutMode 
                        : 'combined';

  return (
    <div className="overflow-hidden relative flex flex-col" style={containerStyle}>
      
      {!isEmbedded && showSettings && (
         <div className="absolute right-0 top-0 bottom-0 w-96 z-50 shadow-2xl text-left">
             <SettingsPanel 
                settings={settings} 
                onSettingsChange={handleSettingsChange} 
                onClose={() => setShowSettings(false)}
                isViewerMode={true}
             />
         </div>
      )}

      {/* Combined / Columns Layout */}
      {(currentLayout === 'combined' || currentLayout === 'columns') && (
        <div 
          ref={containerRef}
          className={`flex-1 overflow-y-auto flex flex-col justify-start ${isMobileView ? 'p-3 pb-6' : isEmbedded ? 'p-6 pb-12' : 'p-12 pb-12'}`}
        >
          <div className="flex flex-col items-stretch">
            {currentLayout === 'combined' && (
              <>
                {processedMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    style={{ marginBottom: paragraphMargin }}
                  >
                    <div style={getLangStyle('ko', msg.isHighlight)} className="whitespace-pre-wrap">{msg.originalText}</div>
                    {targetLangs.map(lang => msg.translations && msg.translations[lang] ? (
                      <div key={lang} style={getLangStyle(lang, msg.isHighlight)} className="opacity-90 whitespace-pre-wrap">
                        {msg.translations[lang]}
                      </div>
                    ) : null)}
                  </div>
                ))}
                {showLiveInput && (
                   <div style={{ marginBottom: paragraphMargin }}>
                      <div style={getLangStyle('ko', liveInputHighlight)} className="whitespace-pre-wrap inline-block pr-1">
                          {renderLiveInputText()}
                      </div>
                   </div>
                )}
              </>
            )}

            {currentLayout === 'columns' && (
               <div className="flex flex-col">
                  {processedMessages.map((msg) => (
                    <div key={msg.id} 
                         className="grid gap-8 items-start" 
                         style={{ 
                            gridTemplateColumns: `repeat(${1 + targetLangs.length}, 1fr)`,
                            marginBottom: paragraphMargin
                         }}
                    >
                      <div style={getLangStyle('ko', msg.isHighlight)} className="whitespace-pre-wrap break-words">{msg.originalText}</div>
                      {targetLangs.map(lang => (
                         <div key={lang} style={getLangStyle(lang, msg.isHighlight)} className="whitespace-pre-wrap break-words">
                            {(msg.translations && msg.translations[lang]) || (msg.isFinal ? '' : '...')}
                         </div>
                      ))}
                    </div>
                  ))}
                  {showLiveInput && (
                     <div 
                       className="grid gap-8 items-start" 
                       style={{ 
                          gridTemplateColumns: `repeat(${1 + targetLangs.length}, 1fr)`,
                          marginBottom: paragraphMargin 
                        }}
                     >
                        <div style={getLangStyle('ko', liveInputHighlight)} className="whitespace-pre-wrap break-words inline-block pr-1">
                           {renderLiveInputText()}
                        </div>
                        {targetLangs.map(lang => <div key={lang}></div>)}
                     </div>
                  )}
               </div>
            )}
            
            {/* Spacer to prevent cut-off */}
            <div style={{ height: '1px' }} />
          </div>
        </div>
      )}

      {/* Rows Layout */}
      {currentLayout === 'rows' && (
        <div className="flex flex-col h-full">
           {activeRowLangs.map((lang, index) => (
              <div 
                key={lang} 
                className={`flex-1 overflow-y-auto auto-scroll-row flex flex-col ${isMobileView ? 'p-3' : isEmbedded ? 'p-4' : 'p-8'} ${index < activeRowLangs.length - 1 ? 'border-b border-white/10' : ''}`}
              >
                 <div className="flex flex-col items-stretch">
                    {processedMessages.map(msg => (
                       <div 
                          key={msg.id} 
                          style={{ marginBottom: paragraphMargin }}
                        >
                          <div style={getLangStyle(lang, msg.isHighlight)} className="whitespace-pre-wrap">
                             {(msg.translations && msg.translations[lang]) || (lang === 'ko' ? msg.originalText : (msg.isFinal ? '' : '...'))}
                          </div>
                       </div>
                    ))}
                    {lang === 'ko' && showLiveInput && (
                       <div style={{ marginBottom: paragraphMargin }}>
                          <div style={getLangStyle('ko', liveInputHighlight)} className="whitespace-pre-wrap inline-block pr-1">
                              {renderLiveInputText()}
                          </div>
                       </div>
                    )}
                    <div style={{ height: '1px' }} />
                 </div>
              </div>
           ))}
        </div>
      )}

      {!isEmbedded && (
        <div className={`fixed flex gap-2 z-50 ${isMobileView ? 'top-2 right-2' : 'top-4 right-4'}`}>
          <button 
             className="bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-all"
             onClick={() => setShowSettings(!showSettings)}
             title="설정"
          >
             <Settings size={20} />
          </button>
        </div>
      )}
    </div>
  );
};