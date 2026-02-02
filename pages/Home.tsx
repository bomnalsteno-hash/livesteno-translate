import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Keyboard, Monitor, Plus, LogIn, Trash2, RefreshCw, Hash, 
  Sparkles, Zap, ArrowRight, Activity, Command
} from 'lucide-react';
import { roomRegistry } from '../services/roomRegistry';
import { RoomMetadata } from '../types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  
  // Create Room State
  const [createName, setCreateName] = useState('');
  const [createId, setCreateId] = useState('');

  // Room List State
  const [rooms, setRooms] = useState<RoomMetadata[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomMetadata | null>(null);
  const [inputAuthId, setInputAuthId] = useState(''); // ID entered to auth/join

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadRooms = () => {
    setRooms(roomRegistry.getRooms());
  };

  const generateRoomId = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCreateId(randomId);
  };

  const handleCreate = () => {
    if (!createName.trim()) {
      alert('방 이름을 입력해주세요.');
      return;
    }
    const finalId = createId.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase();
    roomRegistry.registerRoom(finalId, createName);
    navigate(`/room/${finalId}/stenographer`);
  };

  const handleRoomClick = (room: RoomMetadata) => {
    setSelectedRoom(room);
    setInputAuthId('');
  };

  const handleJoinAttempt = (role: 'stenographer' | 'viewer') => {
    if (!selectedRoom) return;
    if (inputAuthId.trim().toUpperCase() !== selectedRoom.id) {
      alert('방 ID가 올바르지 않습니다.');
      return;
    }
    roomRegistry.touchRoom(selectedRoom.id);
    navigate(`/room/${selectedRoom.id}/${role}`);
  };

  const handleDeleteRoom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('이 방을 목록에서 삭제하시겠습니까? 데이터는 로컬 저장소에 남아있을 수 있습니다.')) {
      roomRegistry.deleteRoom(id);
      loadRooms();
      if (selectedRoom?.id === id) setSelectedRoom(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex items-center justify-center p-4 relative overflow-hidden selection:bg-blue-500/30">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl w-full z-10 flex flex-col gap-10">
        
        {/* Header */}
        <header className="text-center space-y-4 animate-in fade-in slide-in-from-top-8 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-gray-300 mb-2 backdrop-blur-md">
            <Sparkles size={12} className="text-yellow-400" />
            <span>AI Real-time Translation System</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-gray-500 pb-2">
            LiveSteno
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
            속기사의 타이핑을 실시간으로 감지하여 <span className="text-blue-400 font-medium">다국어 자막</span>으로 송출합니다.<br className="hidden md:block"/>
            현장 스크린과 온라인 중계를 위한 최고의 솔루션입니다.
          </p>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          
          {/* LEFT: Create Room (5 columns) */}
          <div className="lg:col-span-5 bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                   <Plus size={24} />
                 </div>
                 <div>
                   <h2 className="text-2xl font-bold text-white">세션 생성</h2>
                   <p className="text-sm text-gray-400">새로운 이벤트를 시작합니다.</p>
                 </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">이벤트 이름</label>
                   <div className="relative group/input">
                     <Command className="absolute left-4 top-3.5 text-gray-500 group-focus-within/input:text-blue-400 transition-colors" size={18} />
                     <input 
                       type="text" 
                       value={createName}
                       onChange={(e) => setCreateName(e.target.value)}
                       placeholder="예: 기조연설, 오전 세션"
                       className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                     />
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">접속 코드 (ID)</label>
                   <div className="flex gap-2">
                     <div className="relative flex-1 group/input">
                       <Hash className="absolute left-4 top-3.5 text-gray-500 group-focus-within/input:text-blue-400 transition-colors" size={18} />
                       <input 
                         type="text" 
                         value={createId}
                         onChange={(e) => setCreateId(e.target.value.toUpperCase())}
                         placeholder="자동 생성"
                         className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 font-mono uppercase tracking-widest text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                       />
                     </div>
                     <button 
                       onClick={generateRoomId} 
                       className="px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all flex items-center justify-center"
                       title="랜덤 ID 생성"
                     >
                       <RefreshCw size={20} />
                     </button>
                   </div>
                </div>

                <button
                  onClick={handleCreate}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group/btn"
                >
                  <Zap size={20} className="fill-white" />
                  <span>방 만들기 및 시작</span>
                  <ArrowRight size={18} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Room List (7 columns) */}
          <div className="lg:col-span-7 h-[500px] flex flex-col bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-teal-500/20 rounded-2xl text-teal-400">
                   <Activity size={24} />
                 </div>
                 <div>
                   <h2 className="text-2xl font-bold text-white">진행 중인 세션</h2>
                   <p className="text-sm text-gray-400">입장할 방을 선택하세요.</p>
                 </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
                {rooms.length}개의 세션
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
               {rooms.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4 border-2 border-dashed border-white/5 rounded-2xl">
                   <Monitor size={48} className="opacity-20" />
                   <p className="text-sm">현재 활성화된 방이 없습니다.</p>
                 </div>
               ) : (
                 rooms.map(room => (
                   <div 
                     key={room.id}
                     onClick={() => handleRoomClick(room)}
                     className={`group relative p-5 rounded-2xl border transition-all cursor-pointer overflow-hidden
                       ${selectedRoom?.id === room.id 
                         ? 'bg-teal-900/20 border-teal-500/50 shadow-[0_0_30px_-10px_rgba(20,184,166,0.3)]' 
                         : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}
                   >
                     {/* Hover Gradient */}
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />

                     <div className="flex justify-between items-center relative z-10">
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                           <h3 className={`font-bold text-lg truncate ${selectedRoom?.id === room.id ? 'text-teal-400' : 'text-gray-200 group-hover:text-white'}`}>
                             {room.name}
                           </h3>
                           {selectedRoom?.id === room.id && <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />}
                         </div>
                         <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                           <span className="bg-black/30 px-1.5 py-0.5 rounded border border-white/5">ID: {room.id}</span>
                           <span>{new Date(room.lastActive).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 활동</span>
                         </div>
                       </div>
                       
                       <button 
                          onClick={(e) => handleDeleteRoom(e, room.id)}
                          className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                          title="삭제"
                        >
                          <Trash2 size={18} />
                        </button>
                     </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-600 py-4 animate-in fade-in duration-1000 delay-500">
           © 2024 LiveSteno Translate. All rights reserved.
        </footer>
      </div>

      {/* Access Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-[#111] border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full relative overflow-hidden">
              {/* Modal Glow */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-teal-500 to-purple-500" />
              
              <button 
                onClick={() => setSelectedRoom(null)}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
              >
                <ArrowRight size={20} className="rotate-180" /> {/* Close icon using arrow for style */}
              </button>
              
              <div className="text-center mb-8 mt-2">
                <div className="w-16 h-16 bg-gradient-to-tr from-gray-800 to-gray-700 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg">
                   <LogIn size={32} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{selectedRoom.name}</h3>
                <p className="text-gray-400 text-sm">세션에 입장하려면 코드를 확인하세요.</p>
              </div>

              <div className="space-y-6">
                <div className="relative group/auth">
                   <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl opacity-30 blur group-focus-within/auth:opacity-70 transition duration-500"></div>
                   <input 
                     type="text" 
                     value={inputAuthId}
                     onChange={(e) => setInputAuthId(e.target.value.toUpperCase())}
                     placeholder="ROOM ID"
                     className="relative w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-4 text-2xl font-mono text-center tracking-[0.5em] focus:outline-none text-white placeholder-gray-700 uppercase"
                     autoFocus
                   />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleJoinAttempt('stenographer')}
                    className="flex flex-col items-center justify-center p-4 bg-gray-800/50 border border-white/5 hover:border-blue-500/50 hover:bg-blue-900/20 rounded-2xl transition-all group"
                  >
                    <Keyboard size={28} className="mb-2 text-gray-400 group-hover:text-blue-400 transition-colors" />
                    <span className="text-sm font-bold text-gray-300 group-hover:text-white">속기사 모드</span>
                    <span className="text-[10px] text-gray-600 mt-1">입력 및 제어</span>
                  </button>

                  <button
                    onClick={() => handleJoinAttempt('viewer')}
                    className="flex flex-col items-center justify-center p-4 bg-gray-800/50 border border-white/5 hover:border-teal-500/50 hover:bg-teal-900/20 rounded-2xl transition-all group"
                  >
                     <Monitor size={28} className="mb-2 text-gray-400 group-hover:text-teal-400 transition-colors" />
                     <span className="text-sm font-bold text-gray-300 group-hover:text-white">뷰어 모드</span>
                     <span className="text-[10px] text-gray-600 mt-1">송출 화면</span>
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};