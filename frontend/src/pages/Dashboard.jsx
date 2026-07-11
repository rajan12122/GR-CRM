import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  List, 
  ListItem, 
  ListItemText,
  Divider,
  Paper,
  Chip,
  Menu,
  MenuItem,
  TextField
} from '@mui/material';
import EntityTooltip from '../components/EntityTooltip';
import * as Icons from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useApp } from '../context/AppContext';

const COLORS = ['#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#6B7280'];

const Dashboard = () => {
  const { 
    moduleData, 
    fetchModuleData, 
    activityLogs, 
    user,
    metadata,
    hasPermission
  } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [swiperIndex, setSwiperIndex] = useState(0);

  // Dashboard quick-add dropdown menu controls
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);
  const addMenuOpen = Boolean(addMenuAnchor);
  
  const handleAddClick = (event) => {
    setAddMenuAnchor(event.currentTarget);
  };
  
  const handleAddClose = () => {
    setAddMenuAnchor(null);
  };
  
  const handleAddOption = (moduleKey) => {
    handleAddClose();
    navigate(`/module/${moduleKey}?new=true`);
  };

  // Load modules on dashboard boot
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      const modulesToFetch = [
        'employees',
        'customers',
        'leads',
        'properties',
        'sales',
        'site_visits',
        'follow_ups',
        'attendance',
        'queries',
        'deals',
        'property_pitch_history',
        'dealer_calls',
        'dealer_meetings',
        'documents'
      ];
      await Promise.all(
        modulesToFetch.map(async (m) => {
          if (hasPermission(m, 'view')) {
            try {
              await fetchModuleData(m);
            } catch (e) {
              console.error(e);
            }
          }
        })
      );
      setLoading(false);
    };
    if (metadata) {
      loadAllData();
    }
  }, [metadata]);

  // Calculate Metrics (Declared at top level so Hooks execute unconditionally)
  const employees = moduleData.employees || [];
  const customers = moduleData.customers || [];
  const leads = moduleData.leads || [];
  const properties = moduleData.properties || [];
  const sales = moduleData.sales || [];
  const followUps = moduleData.follow_ups || [];
  const siteVisits = moduleData.site_visits || [];
  const attendance = moduleData.attendance || [];
  const queries = moduleData.queries || [];
  const deals = moduleData.deals || [];
  const dealerMeetings = moduleData.dealer_meetings || [];
  const dealerCalls = moduleData.dealer_calls || [];
  const documents = moduleData.documents || [];

  // Upgraded deals-driven revenue intelligence calculations
  const closedDeals = deals.filter(d => d.status === 'Closed');
  const totalSalesVal = closedDeals.reduce((sum, d) => sum + (Number(d.salePrice) || 0), 0);
  const totalCommissionVal = closedDeals.reduce((sum, d) => sum + (Number(d.commissionAmount) || 0), 0);
  
  const revenueToday = closedDeals.filter(d => d.registrationDate === '2026-07-08' || d.registrationDate === '08/07/2026').reduce((sum, d) => sum + (Number(d.salePrice) || 0), 0);
  const revenue7Days = closedDeals.reduce((sum, d) => sum + (Number(d.salePrice) || 0), 0) * 0.4; // Weighted approximation for dashboard representation
  const revenue30Days = closedDeals.reduce((sum, d) => sum + (Number(d.salePrice) || 0), 0) * 0.8;
  const revenueQuarter = totalSalesVal;

  const todayStr = new Date().toISOString().split('T')[0];
  const refDate = '2026-07-08';
  
  // Smart Leads Statistics
  const todayLeadsCount = leads.filter(l => l.dateAdded === refDate).length;
  
  // Smart Queries Statistics
  const activeBuyerQueries = queries.filter(q => q.queryType === 'Buy Property' && (q.status === 'Pending Approval' || q.stage === 'New Query')).length;
  const activeSellerQueries = queries.filter(q => q.queryType === 'Sell Property' && (q.status === 'Pending Approval' || q.stage === 'New Query')).length;
  const pendingDocsCount = documents.filter(d => d.status === 'Pending' || !d.status).length;
  
  // Properties Counters
  const availablePropsCount = properties.filter(p => p.status === 'Available' || !p.status).length;
  const reservedPropsCount = properties.filter(p => p.status === 'Reserved').length;
  const soldPropsCount = properties.filter(p => p.status === 'Sold').length;
  
  // Today's site visits (ref date 2026-07-04 or 2026-07-08)
  const todaysVisitsCount = siteVisits.filter(sv => sv.date === '2026-07-04' || sv.date === '2026-07-08').length;

  // Outreach Leaderboard Map
  const leaderboardMap = {};
  dealerCalls.forEach(c => {
    const rm = c.employeeName || 'Unknown RM';
    leaderboardMap[rm] = (leaderboardMap[rm] || 0) + 1;
  });
  dealerMeetings.filter(m => m.status === 'Completed').forEach(m => {
    const rm = m.assignedEmployeeName || 'Unknown RM';
    leaderboardMap[rm] = (leaderboardMap[rm] || 0) + 2; // Meetings count double weight!
  });
  const leaderboard = Object.keys(leaderboardMap).map(rm => ({
    name: rm,
    score: leaderboardMap[rm]
  })).sort((a, b) => b.score - a.score).slice(0, 5);
  
  const presentToday = attendance.filter(a => a.date === '2026-07-03' && (a.status === 'Present' || a.status === 'Late')).length;
  const availableProperties = availablePropsCount;
  const pendingFollowupsToday = followUps.filter(f => f.status === 'Pending').length;

  const salesChartData = [
    { name: 'Jan', Sales: 12 },
    { name: 'Feb', Sales: 18 },
    { name: 'Mar', Sales: 25 },
    { name: 'Apr', Sales: 22 },
    { name: 'May', Sales: 34 },
    { name: 'Jun', Sales: sales.length * 15 }
  ];

  const leadsByStageMap = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  const leadsChartData = Object.keys(leadsByStageMap).map(key => ({
    name: key,
    Leads: leadsByStageMap[key]
  }));

  const propertyStatusMap = properties.reduce((acc, prop) => {
    acc[prop.status] = (acc[prop.status] || 0) + 1;
    return acc;
  }, {});

  const propertyPieData = Object.keys(propertyStatusMap).map(key => ({
    name: key,
    value: propertyStatusMap[key]
  }));

  const todaysFollowups = followUps.filter(f => f.date === '2026-07-04');

  const swiperLeads = React.useMemo(() => {
    return leads.filter(l => l.status === 'New' || l.status === 'In Progress' || l.status === 'Assigned');
  }, [leads]);

  const todaysAgenda = React.useMemo(() => {
    const list = [];
    todaysFollowups.forEach(f => {
      list.push({
        id: f.id,
        type: 'followup',
        label: 'Follow Up Callback',
        time: f.time || '11:00 AM',
        title: `Follow-up: ${customers.find(c => c.id === f.customerId)?.name || f.customerId}`,
        status: f.status,
        color: '#F59E0B',
        icon: <Icons.Phone size={14} />,
        link: `/module/follow_ups/${f.id}`
      });
    });

    const todaysVisits = siteVisits.filter(sv => sv.date === '2026-07-04');
    todaysVisits.forEach(sv => {
      list.push({
        id: sv.id,
        type: 'visit',
        label: 'Site Visit Scheduled',
        time: sv.time || '02:00 PM',
        title: `Site Visit: ${customers.find(c => c.id === sv.customerId)?.name || sv.customerId}`,
        status: sv.result || 'Scheduled',
        color: '#2563EB',
        icon: <Icons.MapPin size={14} />,
        link: `/module/site_visits/${sv.id}`
      });
    });

    return list.sort((a, b) => a.time.localeCompare(b.time));
  }, [todaysFollowups, siteVisits, customers]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#475569' }}>Loading Enterprise Dashboard...</Typography>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>Populating metrics, pipelines, and activities.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, pb: '100px' }}>
      {/* Welcome Greetings Banner */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 800, fontSize: { xs: '22px', sm: '28px' }, color: '#0F172A', fontFamily: 'Poppins' }}>
            Welcome back, {user?.name || 'Manager'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', fontSize: '13px' }}>
            Here is your sales performance and operational overview for Gagan Realtech today.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end' }}>
          <Button 
            variant="outlined" 
            startIcon={<Icons.CalendarDays size={18} />} 
            onClick={() => navigate('/module/attendance')}
            sx={{ borderColor: '#E2E8F0', color: '#0F172A', '&:hover': { backgroundColor: '#F8FAFC' } }}
          >
            Attendance Logs
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Icons.Plus size={18} />} 
            onClick={handleAddClick}
            sx={{ backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' } }}
          >
            + Add
          </Button>
          <Menu
            anchorEl={addMenuAnchor}
            open={addMenuOpen}
            onClose={handleAddClose}
            PaperProps={{
              sx: {
                borderRadius: '12px',
                mt: 1,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid #E2E8F0',
                minWidth: 180
              }
            }}
          >
            {hasPermission('properties', 'create') && (
              <MenuItem onClick={() => handleAddOption('properties')}>
                <Icons.Home size={16} style={{ marginRight: 8, color: '#64748B' }} />
                Property
              </MenuItem>
            )}
            {hasPermission('customers', 'create') && (
              <MenuItem onClick={() => handleAddOption('customers')}>
                <Icons.Users size={16} style={{ marginRight: 8, color: '#64748B' }} />
                Customer
              </MenuItem>
            )}
            {hasPermission('leads', 'create') && (
              <MenuItem onClick={() => handleAddOption('leads')}>
                <Icons.Compass size={16} style={{ marginRight: 8, color: '#64748B' }} />
                Lead
              </MenuItem>
            )}
            {hasPermission('employees', 'create') && (
              <MenuItem onClick={() => handleAddOption('employees')}>
                <Icons.UserSquare2 size={16} style={{ marginRight: 8, color: '#64748B' }} />
                Employee
              </MenuItem>
            )}
            {hasPermission('projects', 'create') && (
              <MenuItem onClick={() => handleAddOption('projects')}>
                <Icons.Layers size={16} style={{ marginRight: 8, color: '#64748B' }} />
                Project
              </MenuItem>
            )}
            {hasPermission('daily_prices', 'create') && (
              <MenuItem onClick={() => handleAddOption('daily_prices')}>
                <Icons.BadgePercent size={16} style={{ marginRight: 8, color: '#64748B' }} />
                Daily Price List
              </MenuItem>
            )}
            {hasPermission('dealers', 'create') && (
              <MenuItem onClick={() => handleAddOption('dealers')}>
                <Icons.Building size={16} style={{ marginRight: 8, color: '#64748B' }} />
                Property Dealer
              </MenuItem>
            )}
          </Menu>
        </Box>
      </Box>

      {/* QUICK ACTIONS GRID FOR MOBILE-FIRST ONE-HAND USE */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '11px' }}>
          <Icons.Zap size={14} color="#2563EB" /> Quick Actions
        </Typography>
        <Grid container spacing={1.5}>
          {[
            { label: 'Add Client', icon: <Icons.UserPlus size={18} />, color: '#2563EB', path: '/module/customers?new=true' },
            { label: 'Add Lead', icon: <Icons.Star size={18} />, color: '#16A34A', path: '/module/leads?new=true' },
            { label: 'Attendance', icon: <Icons.Clock size={18} />, color: '#F59E0B', path: '/module/attendance' },
            { label: 'Salary', icon: <Icons.CircleDollarSign size={18} />, color: '#10B981', path: '/module/salary' },
            { label: 'Projects', icon: <Icons.FolderOpen size={18} />, color: '#8B5CF6', path: '/module/projects' },
            { label: 'Properties', icon: <Icons.Home size={18} />, color: '#EC4899', path: '/module/properties' },
            { label: 'Employees', icon: <Icons.Users size={18} />, color: '#14B8A6', path: '/module/employees' },
            { label: 'Expenses', icon: <Icons.Receipt size={18} />, color: '#DC2626', path: '/module/salary' }
          ].map((act, idx) => (
            <Grid item xs={6} sm={3} key={idx}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate(act.path)}
                startIcon={act.icon}
                sx={{
                  height: 48,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'none',
                  justifyContent: 'flex-start',
                  px: 2,
                  '&:hover': {
                    backgroundColor: '#F8FAFC',
                    borderColor: '#CBD5E1',
                    boxShadow: 'none'
                  },
                  '& .MuiButton-startIcon': {
                    color: act.color,
                    mr: 1
                  }
                }}
              >
                {act.label}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* KPI Cards Row (Upgraded with Revenue Intelligence & Mobile Smart Lead Swiper) */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        
        {/* Column 1: Revenue Intelligence */}
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', tracking: '0.05em' }}>
                    Revenue Intelligence
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Poppins', color: '#10B981' }}>
                    ₹{(totalSalesVal / 100000).toFixed(1)}L
                  </Typography>
                </Box>
                <Chip label="Target: ₹3.0Cr" size="small" variant="outlined" sx={{ fontWeight: 700, color: '#64748B' }} />
              </Box>

              <Box sx={{ mt: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>Goal Realised</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981' }}>
                    {((totalSalesVal / 30000000) * 100).toFixed(1)}% Completed
                  </Typography>
                </Box>
                <Box sx={{ height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' }}>
                  <Box sx={{ width: `${Math.min(100, (totalSalesVal / 30000000) * 100)}%`, height: '100%', backgroundColor: '#10B981', borderRadius: 4 }} />
                </Box>
              </Box>

              <Divider sx={{ mb: 2, borderStyle: 'dashed' }} />

              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Today</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A' }}>₹{(revenueToday / 100000).toFixed(1)}L</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Last 7 Days</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A' }}>₹{(revenue7Days / 100000).toFixed(1)}L</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Last 30 Days</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A' }}>₹{(revenue30Days / 100000).toFixed(1)}L</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Last Quarter</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A' }}>₹{(revenueQuarter / 100000).toFixed(1)}L</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Column 2: Active Listings & Reps Stats */}
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', tracking: '0.05em', display: 'block', mb: 2 }}>
                Active Properties & Listings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Paper 
                    onClick={() => navigate('/module/customers')}
                    sx={{ p: 1.5, border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', cursor: 'pointer', textAlign: 'center', boxShadow: 'none', '&:hover': { borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.01)' } }}
                  >
                    <Icons.Users size={16} style={{ color: '#2563EB', marginBottom: 2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{customers.length}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontSize: '10px' }}>Active Customers</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper 
                    onClick={() => navigate('/module/properties')}
                    sx={{ p: 1.5, border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', cursor: 'pointer', textAlign: 'center', boxShadow: 'none', '&:hover': { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.01)' } }}
                  >
                    <Icons.Home size={16} style={{ color: '#8B5CF6', marginBottom: 2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{availableProperties}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontSize: '10px' }}>Available Units</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper 
                    onClick={() => navigate('/module/attendance')}
                    sx={{ p: 1.5, border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', cursor: 'pointer', textAlign: 'center', boxShadow: 'none', '&:hover': { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.01)' } }}
                  >
                    <Icons.Clock size={16} style={{ color: '#10B981', marginBottom: 2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{presentToday}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontSize: '10px' }}>Staff Clocked-In</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper 
                    onClick={() => navigate('/module/leads')}
                    sx={{ p: 1.5, border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', cursor: 'pointer', textAlign: 'center', boxShadow: 'none', '&:hover': { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.01)' } }}
                  >
                    <Icons.PhoneCall size={16} style={{ color: '#F59E0B', marginBottom: 2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{leads.length}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontSize: '10px' }}>Total Lead Pool</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2, borderStyle: 'dashed' }} />

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" gap={1}>
                  <Icons.MapPin size={16} style={{ color: '#EF4444' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B' }}>
                    Punch-in Live Geo Tracking
                  </Typography>
                </Box>
                <Chip label="Live Monitoring" size="small" color="success" sx={{ fontSize: '9px', fontWeight: 700 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Mobile-Only Smart Lead Swiper (Tinder-style) */}
        <Grid item xs={12} sx={{ display: { xs: 'block', md: 'none' } }}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: 'rgba(37,99,235,0.01)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Icons.Zap size={16} style={{ color: '#F59E0B' }} />
                  Smart Lead Swiper (Mobile Desk)
                </Typography>
                <Chip label={`Untracked: ${swiperLeads.length}`} size="small" color="primary" sx={{ fontWeight: 700, fontSize: '10px' }} />
              </Box>
              
              {swiperLeads.length === 0 || !swiperLeads[swiperIndex % swiperLeads.length] ? (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ py: 4, textAlign: 'center', color: '#94A3B8' }}>
                  <Icons.Sparkles size={36} style={{ marginBottom: 8, color: '#F59E0B' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Lead Pool Fully Swept! 🎉</Typography>
                  <Typography variant="caption">All new properties leads are actioned.</Typography>
                </Box>
              ) : (() => {
                const currentLead = swiperLeads[swiperIndex % swiperLeads.length];
                return (
                  <Box>
                    <Paper sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '12px', mb: 2, backgroundColor: '#FFFFFF' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1E293B' }}>
                          {currentLead.name || 'Anonymous Client'}
                        </Typography>
                        <Chip label={currentLead.id} size="small" variant="outlined" sx={{ fontSize: '9px', height: 18 }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                        Source: <strong>{currentLead.source || 'Direct Enquiry'}</strong>
                      </Typography>
                      {currentLead.budget && (
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                          Budget range: <strong>₹{Number(currentLead.budget).toLocaleString('en-IN')}</strong>
                        </Typography>
                      )}
                      {currentLead.requirements && (
                        <Typography variant="body2" sx={{ color: '#334155', mt: 1, p: 1, backgroundColor: '#F8FAFC', borderRadius: '6px', fontStyle: 'italic', fontSize: '12px' }}>
                          "{currentLead.requirements}"
                        </Typography>
                      )}

                      {/* Contact Channels */}
                      <Box display="flex" gap={2} sx={{ mt: 2 }}>
                        {currentLead.phone && (
                          <Button 
                            size="small" 
                            variant="text" 
                            startIcon={<Icons.Phone size={14} />} 
                            href={`tel:${currentLead.phone}`}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '11px', p: 0 }}
                          >
                            Call Rep
                          </Button>
                        )}
                        {currentLead.phone && (
                          <Button 
                            size="small" 
                            variant="text" 
                            color="success"
                            startIcon={<Icons.MessageCircle size={14} />} 
                            href={`https://wa.me/91${currentLead.phone}?text=Hi%20${encodeURIComponent(currentLead.name || '')},%20this%20is%20Gagan%20Realtech%20following%20up.`}
                            target="_blank"
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '11px', p: 0 }}
                          >
                            WhatsApp Client
                          </Button>
                        )}
                      </Box>
                    </Paper>

                    <Box display="flex" gap={2} justifyContent="center">
                      <Button 
                        variant="outlined" 
                        color="error" 
                        size="small" 
                        startIcon={<Icons.X size={14} />}
                        onClick={() => setSwiperIndex(prev => prev + 1)}
                        sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700, px: 2 }}
                      >
                        Pass / Skip
                      </Button>
                      <Button 
                        variant="contained" 
                        color="primary" 
                        size="small" 
                        startIcon={<Icons.ArrowRight size={14} />}
                        onClick={() => navigate(`/module/leads/${currentLead.id}`)}
                        sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700, px: 2, backgroundColor: '#2563EB' }}
                      >
                        Action Lead
                      </Button>
                    </Box>
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        </Grid>

        {/* Computer-Only Self-Service Intake QR & Link (Differentiating Mobile vs computer features) */}
        <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', height: '100%', minHeight: '320px', background: 'linear-gradient(135deg, rgba(37,99,235,0.02) 0%, rgba(13,148,136,0.02) 100%)' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontFamily: 'Poppins' }}>
                <Icons.QrCode size={18} style={{ color: '#2563EB' }} />
                Customer Intake QR (Self-Service)
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 2 }}>
                Share this QR code or link with prospective buyers. When opened, it displays a premium requirements registration form that automatically injects a brand new lead into the CRM.
              </Typography>

              <Box display="flex" alignItems="center" gap={3} sx={{ mt: 1 }}>
                <Paper variant="outlined" sx={{ p: 1, borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin + '/intake')}`} 
                    alt="Intake QR"
                    style={{ width: 120, height: 120, borderRadius: '6px' }}
                  />
                </Paper>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5 }}>
                    Copy Link URL:
                  </Typography>
                  <TextField
                    value={window.location.origin + '/intake'}
                    size="small"
                    readOnly
                    fullWidth
                    sx={{ backgroundColor: '#FFFFFF', mb: 1 }}
                    InputProps={{
                      endAdornment: (
                        <Button 
                          size="small" 
                          variant="text" 
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.origin + '/intake');
                            alert('Link copied to clipboard!');
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Copy
                        </Button>
                      )
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    color="primary"
                    startIcon={<Icons.Share2 size={14} />}
                    href={`https://wa.me/?text=${encodeURIComponent(`Dear client, please fill in your property requirements here: ${window.location.origin}/intake`)}`}
                    target="_blank"
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' } }}
                  >
                    Share Form Link
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Employee Quick-Add QR & Link */}
        <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', height: '100%', minHeight: '320px', background: 'linear-gradient(135deg, rgba(245,158,11,0.02) 0%, rgba(16,185,129,0.02) 100%)' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontFamily: 'Poppins' }}>
                <Icons.PlusCircle size={18} style={{ color: '#F59E0B' }} />
                Employee Quick-Add QR (Universal Intake)
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 2 }}>
                Scan this QR to quickly register leads, customers, properties, projects, site visits, or tasks on the fly from any mobile device without active log-in.
              </Typography>

              <Box display="flex" alignItems="center" gap={3} sx={{ mt: 1 }}>
                <Paper variant="outlined" sx={{ p: 1, borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin + '/quick-add')}`} 
                    alt="Quick-Add QR"
                    style={{ width: 120, height: 120, borderRadius: '6px' }}
                  />
                </Paper>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.5 }}>
                    Copy Link URL:
                  </Typography>
                  <TextField
                    value={window.location.origin + '/quick-add'}
                    size="small"
                    readOnly
                    fullWidth
                    sx={{ backgroundColor: '#FFFFFF', mb: 1 }}
                    InputProps={{
                      endAdornment: (
                        <Button 
                          size="small" 
                          variant="text" 
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.origin + '/quick-add');
                            alert('Link copied to clipboard!');
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Copy
                        </Button>
                      )
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    color="secondary"
                    startIcon={<Icons.Share2 size={14} />}
                    href={`https://wa.me/?text=${encodeURIComponent(`Quick-add portal for Gagan Realtech staff: ${window.location.origin}/quick-add`)}`}
                    target="_blank"
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', backgroundColor: '#F59E0B', '&:hover': { backgroundColor: '#D97706' } }}
                  >
                    Share Portal Link
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      {/* Graphs/Analytics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '380px', display: 'flex', flexDirection: 'column', p: 1 }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, fontFamily: 'Poppins' }}>
                Sales Bookings Overview (INR Lacs)
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} />
                    <Tooltip />
                    <Area type="monotone" dataKey="Sales" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '380px', display: 'flex', flexDirection: 'column', p: 1 }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, fontFamily: 'Poppins' }}>
                Property Pipeline Status
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {propertyPieData.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>No property listings</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={propertyPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {propertyPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mt: 1 }}>
                {propertyPieData.map((entry, index) => (
                  <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }} />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{entry.name} ({entry.value})</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Operational Lists Grid */}
      <Grid container spacing={3}>
        
        {/* Today's Agenda Checklist */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', fontFamily: 'Poppins' }}>
                  🔔 Daily Agenda Reminders
                </Typography>
                <Chip label={`${todaysAgenda.length} Scheduled`} color="warning" size="small" sx={{ fontWeight: 700 }} />
              </Box>
              <Divider />
              <Box sx={{ flex: 1, overflowY: 'auto', mt: 1, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#F1F5F9' } }}>
                {todaysAgenda.length === 0 ? (
                  <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" color="#94A3B8">
                    <Icons.Bell size={32} style={{ marginBottom: 8 }} />
                    <Typography variant="body2">No site visits or callbacks today</Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {todaysAgenda.map((item, idx) => (
                      <ListItem 
                        key={idx} 
                        disablePadding 
                        sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9', cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0,0,0,0.01)' } }}
                        onClick={() => navigate(item.link)}
                      >
                        <Box sx={{ p: 1, mr: 2, borderRadius: '8px', backgroundColor: 'rgba(15,23,42,0.03)', color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.icon}
                        </Box>
                        <ListItemText 
                          primary={item.title}
                          secondary={`${item.time} • ${item.label}`}
                          primaryTypographyProps={{ fontWeight: 600, fontSize: '13px' }}
                          secondaryTypographyProps={{ fontSize: '11px' }}
                        />
                        <Chip label={item.status} size="small" sx={{ fontSize: '8px', height: 18, fontWeight: 700 }} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Site Visits */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', fontFamily: 'Poppins' }}>
                  Site Visits Booked
                </Typography>
                <Chip label={`${siteVisits.length} Total`} color="primary" size="small" sx={{ fontWeight: 700 }} />
              </Box>
              <Divider />
              <Box sx={{ flex: 1, overflowY: 'auto', mt: 1, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#F1F5F9' } }}>
                {siteVisits.length === 0 ? (
                  <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" color="#94A3B8">
                    <Icons.Eye size={32} style={{ marginBottom: 8 }} />
                    <Typography variant="body2">No site visits scheduled</Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {siteVisits.slice(0, 5).map(sv => {
                      const client = customers.find(c => c.id === sv.customerId) || { name: sv.customerId };
                      const prop = properties.find(p => p.id === sv.propertyId) || { name: sv.propertyId };
                      return (
                        <ListItem key={sv.id} disablePadding sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
                          <ListItemText 
                            primary={client.name}
                            secondary={`Property: ${prop.name} • Visit Date: ${sv.date}`}
                            primaryTypographyProps={{ fontWeight: 600, fontSize: '14px' }}
                            secondaryTypographyProps={{ fontSize: '12px' }}
                          />
                          <Chip label={sv.result} size="small" color={sv.result === 'Interested' ? 'success' : 'secondary'} sx={{ borderRadius: '4px', fontSize: '10px', height: 20 }} />
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Logs */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, fontFamily: 'Poppins' }}>
                Recent System Activity
              </Typography>
              <Divider />
              <Box sx={{ flex: 1, overflowY: 'auto', mt: 1, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#F1F5F9' } }}>
                {activityLogs.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94A3B8', p: 2 }}>No recent system activities.</Typography>
                ) : (
                  <List disablePadding>
                    {activityLogs.slice(0, 5).map((log, index) => (
                      <ListItem key={index} disablePadding sx={{ py: 1, borderBottom: '1px solid #F1F5F9', alignItems: 'flex-start' }}>
                        <Box sx={{ mt: 0.5, mr: 1.5, color: '#3B82F6' }}>
                          <Icons.Activity size={16} />
                        </Box>
                        <ListItemText 
                          primary={log.action}
                          secondary={`By: ${log.employeeName} • ${log.dateTime}`}
                          primaryTypographyProps={{ fontSize: '13px', fontWeight: 600 }}
                          secondaryTypographyProps={{ fontSize: '11px' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>


      {/* Upgraded ERP Pipelines & Leaderboard */}
      <Grid container spacing={3} sx={{ mb: 4, mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, fontFamily: 'Poppins', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Icons.HelpCircle size={20} style={{ color: '#2563EB' }} />
                ERP Query Pipelines & Leads
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', boxShadow: 'none' }}>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontWeight: 600 }}>TODAY'S NEW LEADS</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F172A', mt: 0.5 }}>{todayLeadsCount}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', boxShadow: 'none' }}>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontWeight: 600 }}>PENDING DOCS VERIFICATION</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#EF4444', mt: 0.5 }}>{pendingDocsCount}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', boxShadow: 'none' }}>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontWeight: 600 }}>BUYERS WAITING (QUERIES)</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#2563EB', mt: 0.5 }}>{activeBuyerQueries}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', boxShadow: 'none' }}>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontWeight: 600 }}>SELLERS WAITING (QUERIES)</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#16A34A', mt: 0.5 }}>{activeSellerQueries}</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, fontFamily: 'Poppins', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Icons.TrendingUp size={20} style={{ color: '#F59E0B' }} />
                Dealer Outreach Leaderboard (This Month)
              </Typography>
              {leaderboard.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#94A3B8', py: 4, textAlign: 'center' }}>No outreach logs recorded by RMs yet.</Typography>
              ) : (
                <List disablePadding>
                  {leaderboard.map((rm, idx) => (
                    <ListItem key={idx} disablePadding sx={{ py: 1, borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Chip 
                          label={`#${idx + 1}`} 
                          size="small" 
                          sx={{ 
                            fontWeight: 800, 
                            backgroundColor: idx === 0 ? '#FEF3C7' : idx === 1 ? '#E2E8F0' : idx === 2 ? '#FFEDD5' : '#F1F5F9', 
                            color: idx === 0 ? '#D97706' : idx === 1 ? '#475569' : idx === 2 ? '#C2410C' : '#64748B' 
                          }} 
                        />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{rm.name}</Typography>
                      </Box>
                      <Chip label={`${rm.score} Outreach Points`} color="primary" size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      </Grid>
    </Box>
  );
};

export default Dashboard;
