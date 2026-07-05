import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  TextField, 
  InputAdornment, 
  IconButton, 
  Badge,
  Chip
} from '@mui/material';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';

const Header = ({ onSearchClick, onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, metadata } = useApp();

  // Helper to determine title from path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard Overview';
    if (path.startsWith('/module/')) {
      const mod = path.split('/')[2];
      return metadata?.modules[mod]?.label || 'Module Viewer';
    }
    if (path === '/pipeline/properties') return 'Property Kanban Pipeline';
    if (path === '/pipeline/customers') return 'Customer Kanban Pipeline';
    if (path === '/settings') return 'Admin Control Center';
    return 'System Portal';
  };

  const handlePageReload = () => {
    // Forces a clean hard reload by replacing the current URL in both mobile WebView and browsers
    window.location.replace(window.location.href);
  };

  return (
    <AppBar position="sticky" sx={{ zIndex: 1100 }}>
      <Toolbar sx={{ px: 3, display: 'flex', justifyContent: 'space-between', minHeight: 70 }}>
        {/* Title / Breadcrumb / Hamburger */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMenuClick}
            sx={{ display: { md: 'none' }, color: '#475569', p: 0.5, mr: 0.5 }}
          >
            <Icons.Menu size={20} />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', sm: { fontSize: '20px' }, letterSpacing: '-0.02em', color: '#0F172A', fontFamily: 'Poppins' }}>
            {getPageTitle()}
          </Typography>
        </Box>

        {/* Global Search Bar Trigger */}
        <Box sx={{ width: '40%', maxWidth: 500 }} onClick={onSearchClick}>
          <TextField
            size="small"
            placeholder="Global 360° Search... (Customer ID, Phone, Location, Employee, Remarks...)"
            fullWidth
            InputProps={{
              readOnly: true,
              startAdornment: (
                <InputAdornment position="start">
                  <Icons.Search size={18} color="#64748B" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Chip 
                    label="⌘K" 
                    size="small" 
                    sx={{ 
                      borderRadius: '4px', 
                      height: 20, 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      color: '#64748B' 
                    }} 
                  />
                </InputAdornment>
              ),
              style: {
                borderRadius: '99px',
                cursor: 'pointer',
                backgroundColor: '#F8FAFC',
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#E2E8F0' },
                '&:hover fieldset': { borderColor: '#CBD5E1' }
              }
            }}
          />
        </Box>

        {/* Icons / Profile */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            sx={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }} 
            onClick={handlePageReload}
            title="Refresh Page"
          >
            <Icons.RotateCw size={18} color="#64748B" />
          </IconButton>

          <IconButton sx={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }} onClick={() => navigate('/settings')}>
            <Icons.Settings size={18} color="#64748B" />
          </IconButton>
          
          <IconButton sx={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Badge color="error" variant="dot">
              <Icons.Bell size={18} color="#64748B" />
            </Badge>
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 1, borderLeft: '1px solid #E2E8F0' }}>
            <Chip 
              label={user?.role || 'Staff'} 
              color="primary" 
              size="small"
              sx={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', borderRadius: '6px' }}
            />
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
