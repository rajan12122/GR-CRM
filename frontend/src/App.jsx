import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, Typography, useMediaQuery, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import * as Icons from 'lucide-react';
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
import LocationTracker from './pages/LocationTracker';
import PullToRefresh from './components/PullToRefresh';
import PublicIntake from './pages/PublicIntake';
import QuickAdd from './pages/QuickAdd';
import { Routes as DomRoutes, Route as DomRoute } from 'react-router-dom';

import { useParams } from 'react-router-dom';

const ModuleManagerWrapper = () => {
  const { moduleName } = useParams();
  return <ModuleManager key={moduleName} />;
};

const EntityDetailWrapper = () => {
  const { moduleName, id } = useParams();
  return <EntityDetail key={`${moduleName}-${id}`} />;
};

const PipelineViewWrapper = () => {
  const { pipelineType } = useParams();
  return <PipelineView key={pipelineType} />;
};

const MainLayout = () => {
  const { token, loadingMetadata, reloadKey, triggerAppReload } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:900px)');
  const navigate = useNavigate();
  const location = useLocation();

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
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', flexDirection: 'row' }}>
      <CssBaseline />
      
      {/* Sidebar Panel - passes mobile toggle states */}
      <Sidebar mobileOpen={mobileOpen} handleDrawerToggle={() => setMobileOpen(!mobileOpen)} />

      {/* Main Panel Content */}
      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minWidth: 0
      }}>
        <Header onSearchClick={() => setSearchOpen(true)} onMenuClick={() => setMobileOpen(true)} onReload={triggerAppReload} />
        
        <Box key={reloadKey} component="main" sx={{ flexGrow: 1, overflowY: 'hidden', pb: isMobile ? '80px' : '24px', display: 'flex', flexDirection: 'column' }}>
          <PullToRefresh>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/module/attendance" element={<Attendance />} />
              <Route path="/module/location_tracker" element={<LocationTracker />} />
              <Route path="/module/:moduleName" element={<ModuleManagerWrapper />} />
              <Route path="/module/:moduleName/:id" element={<EntityDetailWrapper />} />
              <Route path="/pipeline/:pipelineType" element={<PipelineViewWrapper />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PullToRefresh>
        </Box>
      </Box>

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100, borderTop: '1px solid #E2E8F0' }} elevation={3}>
          <BottomNavigation
            value={location.pathname.startsWith('/module/customers') ? '/module/customers' : location.pathname.startsWith('/module/properties') ? '/module/properties' : location.pathname}
            onChange={(event, newValue) => {
              navigate(newValue);
            }}
            showLabels
            sx={{ height: 65 }}
          >
            <BottomNavigationAction 
              label="Home" 
              value="/" 
              icon={<Icons.LayoutDashboard size={20} />} 
            />
            <BottomNavigationAction 
              label="Clients" 
              value="/module/customers" 
              icon={<Icons.Users size={20} />} 
            />
            <BottomNavigationAction 
              label="Property" 
              value="/module/properties" 
              icon={<Icons.Home size={20} />} 
            />
            <BottomNavigationAction 
              label="CheckIn" 
              value="/module/attendance" 
              icon={<Icons.Clock size={20} />} 
            />
            <BottomNavigationAction 
              label="Menu" 
              value="menu_trigger"
              onClick={() => setMobileOpen(true)}
              icon={<Icons.Menu size={20} />} 
            />
          </BottomNavigation>
        </Paper>
      )}

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
            <DomRoutes>
              <DomRoute path="/intake" element={<PublicIntake />} />
              <DomRoute path="/quick-add" element={<QuickAdd />} />
              <DomRoute path="/*" element={<MainLayout />} />
            </DomRoutes>
        </Router>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
