import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { StenographerPage } from './pages/StenographerPage';
import { ViewerPage } from './pages/ViewerPage';

// 앱 버전 (캐시 버스팅용)
const APP_VERSION = '1.0.0';

const App: React.FC = () => {
  useEffect(() => {
    // 앱 버전을 콘솔에 표시 (디버깅용)
    console.log(`LiveSteno Translate v${APP_VERSION} loaded`);
    
    // 강제 새로고침 안내 (개발 중)
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion && lastVersion !== APP_VERSION) {
      console.log('New version detected. Consider hard refresh (Ctrl+Shift+R)');
    }
    localStorage.setItem('app_version', APP_VERSION);
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Redirect legacy routes to home or handle gracefully */}
        <Route path="/stenographer" element={<Navigate to="/" replace />} />
        <Route path="/viewer" element={<Navigate to="/" replace />} />
        
        {/* Room-based routes */}
        <Route path="/room/:roomId/stenographer" element={<StenographerPage />} />
        <Route path="/room/:roomId/viewer" element={<ViewerPage />} />
      </Routes>
    </HashRouter>
  );
};

export default App;