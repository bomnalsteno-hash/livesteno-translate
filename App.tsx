import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { StenographerPage } from './pages/StenographerPage';
import { ViewerPage } from './pages/ViewerPage';

const App: React.FC = () => {
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