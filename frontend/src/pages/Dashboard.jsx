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
  MenuItem
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
    user 
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
    navigate(`/module/${moduleKey}?add=true`);
  };

  // Load modules on dashboard boot
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchModuleData('employees'),
        fetchModuleData('customers'),
        fetchModuleData('leads'),
        fetchModuleData('properties'),
        fetchModuleData('sales'),
        fetchModuleData('site_visits'),
        fetchModuleData('follow_ups'),
        fetchModuleData('attendance')
      ]);
      setLoading(false);
    };
    loadAllData();
  }, []);

  // Calculate Metrics (Declared at top level so Hooks execute unconditionally)
  const employees = moduleData.employees || [];
  const customers = moduleData.customers || [];
  const leads = moduleData.leads || [];
  const properties = moduleData.properties || [];
  const sales = moduleData.sales || [];
  const followUps = moduleData.follow_ups || [];
  const siteVisits = moduleData.site_visits || [];
  const attendance = moduleData.attendance || [];

  const totalSalesVal = sales.reduce((sum, s) => sum + (Number(s.salePrice) || 0), 0);
  
  const revenueToday = sales.filter(s => s.date === '2026-07-08').reduce((sum, s) => sum + (Number(s.salePrice) || 0), 0);
  const revenue7Days = sales.filter(s => {
    const sDate = new Date(s.date);
    const limitDate = new Date('2026-07-08');
    limitDate.setDate(limitDate.getDate() - 7);
    return sDate >= limitDate;
  }).reduce((sum, s) => sum + (Number(s.salePrice) || 0), 0);
  const revenue30Days = sales.filter(s => {
    const sDate = new Date(s.date);
    const limitDate = new Date('2026-07-08');
    limitDate.setDate(limitDate.getDate() - 30);
    return sDate >= limitDate;
  }).reduce((sum, s) => sum + (Number(s.salePrice) || 0), 0);
  const revenueQuarter = sales.reduce((sum, s) => sum + (Number(s.salePrice) || 0), 0);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const presentToday = attendance.filter(a => a.date === '2026-07-03' && (a.status === 'Present' || a.status === 'Late')).length;
  const availableProperties = properties.filter(p => !p.status || p.status === 'Available').length;
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
    <Box sx={{ p: 3 }}>
      {/* Welcome Greetings Banner */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 800, fontSize: '28px', color: '#0F172A', fontFamily: 'Poppins' }}>
            Welcome back, {user?.name || 'Manager'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Here is your sales performance and operational overview for Gagan Realtech today.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
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
            <MenuItem onClick={() => handleAddOption('properties')}>
              <Icons.Home size={16} style={{ marginRight: 8, color: '#64748B' }} />
              Property
            </MenuItem>
            <MenuItem onClick={() => handleAddOption('customers')}>
              <Icons.Users size={16} style={{ marginRight: 8, color: '#64748B' }} />
              Customer
            </MenuItem>
            <MenuItem onClick={() => handleAddOption('leads')}>
              <Icons.Compass size={16} style={{ marginRight: 8, color: '#64748B' }} />
              Lead
            </MenuItem>
            <MenuItem onClick={() => handleAddOption('employees')}>
              <Icons.UserSquare2 size={16} style={{ marginRight: 8, color: '#64748B' }} />
              Employee
            </MenuItem>
            <MenuItem onClick={() => handleAddOption('projects')}>
              <Icons.Layers size={16} style={{ marginRight: 8, color: '#64748B' }} />
              Project
            </MenuItem>
            <MenuItem onClick={() => handleAddOption('daily_prices')}>
              <Icons.BadgePercent size={16} style={{ marginRight: 8, color: '#64748B' }} />
              Daily Price List
            </MenuItem>
            <MenuItem onClick={() => handleAddOption('dealers')}>
              <Icons.Building size={16} style={{ marginRight: 8, color: '#64748B' }} />
              Property Dealer
            </MenuItem>
          </Menu>
        </Box>
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

      </Grid>
    </Box>
  );
};

export default Dashboard;
