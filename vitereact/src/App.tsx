import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import GV_HeaderPublic from '@/components/views/GV_HeaderPublic';
import GV_HeaderAuth from '@/components/views/GV_HeaderAuth';
import GV_Footer from '@/components/views/GV_Footer';
import UV_PUB_Landing from '@/components/views/UV_PUB_Landing';
import UV_Login from '@/components/views/UV_Login';
import UV_Dashboard from '@/components/views/UV_Dashboard';

const App: React.FC = () => {
  const { 
    authentication_state: { authentication_status },
    check_auth_status 
  } = useAppStore();

  useEffect(() => {
    check_auth_status();
  }, [check_auth_status]);

  if (authentication_status.is_loading) {
     return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        {authentication_status.is_authenticated ? <GV_HeaderAuth /> : <GV_HeaderPublic />}
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<UV_PUB_Landing />} />
            <Route path="/login" element={
              authentication_status.is_authenticated ? <Navigate to="/dashboard" /> : <UV_Login />
            } />
            <Route path="/dashboard" element={
              authentication_status.is_authenticated ? <UV_Dashboard /> : <Navigate to="/login" />
            } />
            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <GV_Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
