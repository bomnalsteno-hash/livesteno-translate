import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Settings, CheckCircle, RefreshCw, Play, Pause, ExternalLink, Eye, EyeOff, Monitor, ArrowLeft, QrCode
} from 'lucide-react';
import { Button } from '../components/Button';
import { 
  StenoMessage, 
  AppSettings, 
  DEFAULT_VIEWER_STYLE
} from '../types';
import { geminiService } from '../services/geminiService';
import { broadcastService } from '../services/broadcastService';
import { roomSyncService } from '../services/roomSyncService';
import { roomRegistry } from '../services/roomRegistry'; // Import registry
import { ViewerPage } from './ViewerPage';
import { SettingsPanel } from '../components/SettingsPanel';
import { QRCodeModal } from '../components/QRCodeModal';

export const StenographerPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  // Storage Keys scoped by Room ID
  const logsKey = `livesteno_logs_${roomId}`;
  const settingsKey = `livesteno_settings_${roomId}`;

  // Input State
  const [inputText, setInputText] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [logs, setLogs] = useState<StenoMessage[]>([]);
  const [roomName, setRoomName] = useState(roomId || 'Unknown Room');
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    targetLanguages: [], // Default to no translation (Korean only)
    translationEnabled: true,
    autoOnPunctuation: false, // Default: Enter only
    enterKeyBehavior: 'send', // Default: Enter sends
    triggerKeys: ['.', '?', '!', 'Enter'],
    viewerStyle: DEFAULT_VIEWER_STYLE,
    enableWordDeleteShortcut: true,
  });

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  // Enter 키 반복/이중 트리거로 동일 문장이 2번 확정되는 것을 방지
  const lastSentRef = useRef<{ text: string; at: number } | null>(null);

  // Connect to Room & Registry
  useEffect(() => {
    if (roomId) {
      broadcastService.connect(roomId);
      
      // Update registry metadata (touch activity)
      const registered = roomRegistry.getRoom(roomId);
      if (registered) {
         setRoomName(registered.name);
         roomRegistry.touchRoom(roomId);
      } else {
         // If accessed directly without creation, register it minimally
         roomRegistry.registerRoom(roomId, `Room ${roomId}`);
      }
    }
  }, [roomId]);

  // Persistence (Load)
  useEffect(() => {
    const savedLogs = localStorage.getItem(logsKey);
    if (savedLogs) {
      try { 
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed)) {
            setLogs(parsed); 
        } else {
            setLogs([]);
        }
      } catch (e) { 
        console.error("Failed to load logs", e);
        setLogs([]);
      }
    }
    const savedSettings = localStorage.getItem(settingsKey);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsed,
          enableWordDeleteShortcut: parsed.enableWordDeleteShortcut ?? true,
          viewerStyle: {
             ...DEFAULT_VIEWER_STYLE,
             ...parsed.viewerStyle,
             languageStyles: {
               ...DEFAULT_VIEWER_STYLE.languageStyles,
               ...(parsed.viewerStyle?.languageStyles || {})
             },
             // Ensure new props exist if loading old settings
             autoScroll: parsed.viewerStyle?.autoScroll ?? DEFAULT_VIEWER_STYLE.autoScroll,
             paragraphSpacing: parsed.viewerStyle?.paragraphSpacing ?? DEFAULT_VIEWER_STYLE.paragraphSpacing,
             textAlign: parsed.viewerStyle?.textAlign ?? DEFAULT_VIEWER_STYLE.textAlign,
          },
          enterKeyBehavior: parsed.enterKeyBehavior ?? 'send',
        }));
      } catch (e) { console.error("Failed to load settings", e); }
    }
  }, [logsKey, settingsKey]);

  // Persistence (Save)
  useEffect(() => { localStorage.setItem(logsKey, JSON.stringify(logs)); }, [logs, logsKey]);

  useEffect(() => {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
    broadcastService.syncSettings(settings);
  }, [settings, settingsKey]);

  // 서버에 방 상태 푸시 (QR로 스마트폰 뷰어가 같은 방 상태를 받을 수 있도록)
  useEffect(() => {
    if (!roomId) return;
    roomSyncService.setRoomState(roomId, { messages: logs, settings, liveInput: inputText });
  }, [roomId, logs, settings, inputText]);

  // Smart Auto-scroll (Local History)
  useEffect(() => {
    if (historyRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = historyRef.current;
      if (scrollHeight - scrollTop - clientHeight < 150) {
         historyRef.current.scrollTop = scrollHeight;
      }
    }
  }, [logs]);

  const processSentence = useCallback(async (textToProcess: string) => {
    const normalized = (textToProcess || '').trim();
    if (!normalized) return;

    const now = Date.now();
    const last = lastSentRef.current;
    if (last && last.text === normalized && now - last.at < 800) {
      return;
    }
    lastSentRef.current = { text: normalized, at: now };

    const messageId = now.toString();
    const timestamp = now;
    
    // 1. Create initial message
    const initialMessage: StenoMessage = {
      id: messageId,
      originalText: normalized,
      translations: {},
      timestamp,
      isFinal: !settings.translationEnabled
    };

    // 2. Broadcast & Update State
    broadcastService.sendNewMessage(initialMessage);
    broadcastService.sendLiveInput(''); 
    
    setLogs(prev => [...prev, initialMessage]);

    // 3. Translate (비동기로 처리하여 UI 블로킹 방지)
    // 번역 ON이면 시도. 대상 언어가 비어 있으면 기본으로 영어 사용(설정에서 미선택 시에도 번역 시도)
    if (settings.translationEnabled) {
      const langsToUse = settings.targetLanguages?.length ? settings.targetLanguages : ['en'];
      const translationStartTime = Date.now();

      geminiService.translateText(
        normalized,
        langsToUse
      ).then((translations) => {
        const elapsed = Date.now() - translationStartTime;
        
        if (Object.keys(translations).length > 0) {
          const updatedMessage: StenoMessage = {
            ...initialMessage,
            translations,
            isFinal: true
          };
          
          broadcastService.sendUpdateMessage(updatedMessage);
          setLogs(prev => prev.map(msg => msg.id === messageId ? updatedMessage : msg));
          
          // 느린 번역 경고 (5초 이상)
          if (elapsed > 5000) {
            console.warn(`Slow translation: ${elapsed}ms for "${normalized.substring(0, 20)}..."`);
          }
        } else {
          // 번역이 실패했지만 에러 없이 빈 결과가 반환된 경우
          console.warn(`Translation returned empty result after ${elapsed}ms for: "${normalized.substring(0, 30)}..."`);
          console.warn("Possible causes: API key issue, network error, or API rate limit");
          
          // 실패한 번역도 최종 상태로 표시 (번역 없이)
          const failedMessage: StenoMessage = {
            ...initialMessage,
            isFinal: true
          };
          broadcastService.sendUpdateMessage(failedMessage);
          setLogs(prev => prev.map(msg => msg.id === messageId ? failedMessage : msg));
        }
      }).catch((err) => {
        const elapsed = Date.now() - translationStartTime;
        console.error(`Translation failed after ${elapsed}ms:`, err);
        
        // 에러 상세 정보 출력
        if (err instanceof Error) {
          console.error("Error type:", err.constructor.name);
          console.error("Error message:", err.message);
          if (err.message.includes("timeout")) {
            console.error("⚠️ Translation timed out. Check your internet connection and API status.");
          } else if (err.message.includes("API") || err.message.includes("key")) {
            console.error("⚠️ API key issue. Check VITE_API_KEY in Vercel environment variables.");
          } else {
            console.error("⚠️ Translation API error. Check browser console for details.");
          }
        }
        
        // 에러 발생 시에도 최종 상태로 표시 (번역 없이)
        const errorMessage: StenoMessage = {
          ...initialMessage,
          isFinal: true
        };
        broadcastService.sendUpdateMessage(errorMessage);
        setLogs(prev => prev.map(msg => msg.id === messageId ? errorMessage : msg));
      });
    }
  }, [settings.translationEnabled, settings.targetLanguages]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const lastChar = val.slice(-1);
    const isPunctuation = ['.', '?', '!'].includes(lastChar);
    
    broadcastService.sendLiveInput(val);

    // Process on punctuation only if enabled
    if (settings.autoOnPunctuation && isPunctuation && settings.triggerKeys.includes(lastChar)) {
        processSentence(val);
        setInputText('');
        return;
    }
    
    setInputText(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isShift = e.shiftKey;
    const isCtrl = e.ctrlKey || e.metaKey;

    // Ctrl+Backspace: 커서 기준 바로 앞 한 단어 삭제 (이전 띄어쓰기/줄바꿈 전까지)
    if (settings.enableWordDeleteShortcut !== false && e.key === 'Backspace' && isCtrl) {
      e.preventDefault();
      const el = e.currentTarget;
      const value = el.value ?? '';
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? start;

      const before = value.slice(0, start);
      const after = value.slice(end);

      const lastSpace = before.lastIndexOf(' ');
      const lastNewline = before.lastIndexOf('\n');
      const lastSeparatorIdx = Math.max(lastSpace, lastNewline);
      const cutIndex = lastSeparatorIdx === -1 ? 0 : lastSeparatorIdx + 1;

      if (cutIndex === before.length) {
        return;
      }

      const newBefore = before.slice(0, cutIndex);
      const newValue = newBefore + after;
      const newCursor = newBefore.length;

      el.value = newValue;
      el.selectionStart = el.selectionEnd = newCursor;

      setInputText(newValue);
      broadcastService.sendLiveInput(newValue);
      return;
    }

    // F4: 커서 기준 바로 앞 한 단어 삭제 (이전 띄어쓰기/줄바꿈 전까지)
    if (e.key === 'F4') {
      e.preventDefault();
      const el = e.currentTarget;
      const value = el.value ?? '';
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? start;

      const before = value.slice(0, start);
      const after = value.slice(end);

      // 직전 공백/줄바꿈 위치 찾기 (없으면 문장 맨 앞까지 지움)
      const lastSpace = before.lastIndexOf(' ');
      const lastNewline = before.lastIndexOf('\n');
      const lastSeparatorIdx = Math.max(lastSpace, lastNewline);
      const cutIndex = lastSeparatorIdx === -1 ? 0 : lastSeparatorIdx + 1; // 구분 문자까지는 남기고 단어만 지우기

      // 더 지울 단어가 없으면 아무것도 하지 않음
      if (cutIndex === before.length) {
        return;
      }

      const newBefore = before.slice(0, cutIndex);
      const newValue = newBefore + after;
      const newCursor = newBefore.length;

      el.value = newValue;
      el.selectionStart = el.selectionEnd = newCursor;

      setInputText(newValue);
      broadcastService.sendLiveInput(newValue);
      return;
    }

    // INSERT Key Logic (Always sends if behavior is newline, or just acts as alternative send)
    if (e.key === 'Insert') {
        e.preventDefault();
        processSentence(e.currentTarget.value.trim());
        setInputText('');
        return;
    }

    if (e.key === 'Enter') {
      // Case 1: Send on Enter (Default behavior)
      if (settings.enterKeyBehavior === 'send') {
        if (!isShift) {
          e.preventDefault();
          processSentence(e.currentTarget.value.trim());
          setInputText('');
          return;
        }
        // Shift+Enter allows default newline
      }
      
      // Case 2: Newline on Enter
      if (settings.enterKeyBehavior === 'newline') {
        if (isCtrl) {
          // Ctrl+Enter forces send
          e.preventDefault();
          processSentence(e.currentTarget.value.trim());
          setInputText('');
          return;
        }
        // Normal Enter allows default newline
      }
    }
  };

  const handleClear = () => {
    if(confirm('이 방의 모든 기록을 지우시겠습니까?')) {
      setLogs([]);
      broadcastService.clearScreen();
    }
  };

  const openViewer = () => {
    const baseUrl = window.location.href.split('#')[0];
    window.open(`${baseUrl}#/room/${roomId}/viewer`, '_blank', 'width=1280,height=720');
  };

  const downloadLogs = () => {
    const content = logs.map(l => 
      `[${new Date(l.timestamp).toLocaleTimeString()}] KO: ${l.originalText}\n${Object.entries(l.translations).map(([k, v]) => `   ${k.toUpperCase()}: ${v}`).join('\n')}`
    ).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steno-session-${roomId}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans">
      
      {/* Main Content */}
      <div className="flex-1 flex min-w-0">
        
        {/* Left: Input & Controls */}
        <div className={`flex flex-col h-full border-r border-gray-200 transition-all duration-300 ${showPreview ? 'w-1/2' : 'w-full'}`}>
          <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mr-2">
                <ArrowLeft size={16} />
              </Button>
              <div className={`w-3 h-3 rounded-full ${sessionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <div>
                <h1 className="font-bold text-lg text-gray-800 leading-tight">{roomName}</h1>
                <p className="text-xs text-blue-600 font-mono">ID: {roomId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant={sessionActive ? 'danger' : 'primary'}
                size="sm"
                icon={sessionActive ? <Pause size={16}/> : <Play size={16}/>}
                onClick={() => setSessionActive(!sessionActive)}
              >
                {sessionActive ? '종료' : '시작'}
              </Button>
              
              <div className="h-6 w-px bg-gray-300 mx-1"></div>

              <Button 
                 variant="secondary" 
                 size="sm" 
                 onClick={() => setShowQR(true)} 
                 title="송출 화면 QR 코드"
                 className="px-2"
              >
                 <QrCode size={18} />
              </Button>

              <Button 
                variant={showPreview ? 'primary' : 'secondary'} 
                size="sm" 
                icon={showPreview ? <EyeOff size={16}/> : <Eye size={16}/>}
                onClick={() => setShowPreview(!showPreview)}
                title="분할 화면 미리보기 토글"
              >
                미리보기
              </Button>
              <Button variant="secondary" size="sm" icon={<ExternalLink size={16}/>} onClick={openViewer}>
                새 창 띄우기
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
                <Settings size={20} />
              </Button>
            </div>
          </header>

          <div className="flex-1 p-6 flex flex-col gap-4 bg-gray-50 relative min-h-0">
            {!sessionActive && (
              <div className="absolute inset-0 bg-gray-100/60 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="text-center">
                  <Button onClick={() => setSessionActive(true)} size="lg">세션 시작</Button>
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center text-sm text-gray-500">
               <span>실시간 입력 버퍼</span>
               <div className="flex gap-2">
                  <label className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider px-2 py-1 rounded ${
                    settings.translationEnabled && settings.targetLanguages.length > 0
                      ? 'bg-blue-50 text-blue-700'
                      : settings.translationEnabled
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-gray-50 text-gray-500'
                  }`}>
                     <CheckCircle size={12} />
                     자동 번역: {settings.translationEnabled ? 'ON' : 'OFF'}
                     {settings.translationEnabled && settings.targetLanguages.length === 0 && ' (언어 미선택)'}
                     {settings.translationEnabled && settings.targetLanguages.length > 0 && ` (${settings.targetLanguages.length}개 언어)`}
                  </label>
               </div>
            </div>
            {settings.translationEnabled && settings.targetLanguages.length > 0 && !geminiService.isReady() && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2">
                번역이 동작하지 않습니다. Vercel 환경변수 <code className="bg-amber-100 px-1 rounded">VITE_API_KEY</code>를 설정한 뒤 재배포해 주세요.
              </div>
            )}
            
            <textarea
              ref={textareaRef}
              className="w-full h-32 min-h-[8rem] p-6 text-2xl bg-white border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y outline-none leading-relaxed transition-all shrink-0"
              placeholder={sessionActive ? "내용을 입력하세요..." : ""}
              value={inputText}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={!sessionActive}
              autoFocus
            />
            <div className="text-xs text-right text-gray-400 -mt-2 font-mono">
              {settings.enterKeyBehavior === 'newline' 
                ? '전송: [Insert]' 
                : '줄바꿈: [Shift+Enter]'}
            </div>

            <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm min-h-0">
               <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
                 <h3 className="font-semibold text-gray-700 text-sm">기록</h3>
                 <div className="flex gap-2">
                   <Button variant="ghost" size="sm" onClick={handleClear}>
                      <Monitor size={14} className="mr-1"/> 전체 지우기
                   </Button>
                   <Button variant="ghost" size="sm" onClick={downloadLogs}>
                      TXT
                   </Button>
                 </div>
               </div>
               
               <div ref={historyRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                 {logs.map((log) => (
                   <div key={log.id} className="border-b border-gray-100 last:border-0 pb-3">
                     <div className="flex items-start gap-3">
                       <span className="text-xs text-gray-400 font-mono mt-1 w-16 shrink-0">
                         {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                       </span>
                       <div className="flex-1 min-w-0">
                         <p className="text-gray-900 font-medium text-lg truncate">{log.originalText}</p>
                         <div className="grid grid-cols-1 gap-1 mt-1">
                           {Object.entries(log.translations).map(([lang, text]) => (
                             <div key={lang} className="text-sm text-gray-600 flex gap-2">
                               <span className="uppercase text-xs font-bold text-gray-400 mt-0.5 w-6">{lang}</span>
                               <span className="truncate">{text}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                       {!log.isFinal && <RefreshCw size={14} className="animate-spin text-blue-500 shrink-0"/>}
                     </div>
                   </div>
                 ))}
                 <div className="h-1"></div>
               </div>
            </div>
          </div>
        </div>

        {/* Right: Embedded Preview */}
        {showPreview && (
          <div className="w-1/2 h-full border-r border-gray-200 bg-black flex flex-col relative animate-in slide-in-from-right duration-300">
             <div className="absolute top-4 left-4 z-10 bg-gray-900/80 text-white text-xs px-2 py-1 rounded pointer-events-none border border-gray-700">
                Live Preview (Room: {roomId})
             </div>
             <ViewerPage isEmbedded={true} />
          </div>
        )}
      </div>

      {/* Settings Panel */}
      <div className={`bg-white border-l border-gray-200 transition-all duration-300 shadow-2xl z-20 absolute right-0 top-0 bottom-0 ${showSettings ? 'w-96 translate-x-0' : 'w-96 translate-x-full pointer-events-none'}`}>
         {showSettings && (
            <SettingsPanel 
              settings={settings} 
              onSettingsChange={setSettings} 
              onClose={() => setShowSettings(false)}
            />
         )}
      </div>

      {/* QR Code Modal */}
      {showQR && roomId && (
         <QRCodeModal 
            url={`${window.location.href.split('#')[0]}#/room/${roomId}/viewer`}
            roomName={roomName}
            onClose={() => setShowQR(false)}
         />
      )}
    </div>
  );
};