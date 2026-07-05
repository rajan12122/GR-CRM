import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, Typography } from '@mui/material';
import theme from './theme/theme';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import GlobalSearch from './components/GlobalSearch';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ModuleManager from './pages/ModuleManager';
import PipelineView from './pages/PipelineView';
import EntityDetail from './pages/EntityDetail';
import Attendance from './pages/Attendance';
import Settings from './pages/Settings';

const MainLayout = () => {
  const { token, loadingMetadata } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut listener for Global Search (⌘K / Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // If no auth token, redirect to login screen
  if (!token) {
    return <Auth />;
  }

  if (loadingMetadata) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        backgroundColor: '#0F172A',
        color: '#E2E8F0'
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: 'Poppins' }}>
          Configuring Gagan Realtech Terminal...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <CssBaseline />
      
      {/* Sidebar Panel */}
      <Sidebar />

      {/* Main Panel Content */}
      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minWidth: 0 // Prevent flex items from overflowing
      }}>
        <Header onSearchClick={() => setSearchOpen(true)} />
        
        <Box component="main" sx={{ flexGrow: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            
            {/* Custom module view redirects */}
            <Route path="/module/attendance" element={<Attendance />} />
            
            {/* Dynamic CRUD routing */}
            <Route path="/module/:moduleName" element={<ModuleManager />} />
            <Route path="/module/:moduleName/:id" element={<EntityDetail />} />
            
            {/* Kanban pipelines */}
            <Route path="/pipeline/:pipelineType" element={<PipelineView />} />
            
            {/* Admin panel settings */}
            <Route path="/settings" element={<Settings />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </Box>

      {/* Global 360 Search dialog overlay */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <AppProvider>
        <Router>
          <MainLayout />
        </Router>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
