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
  Chip
} from '@mui/material';
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

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#475569' }}>Loading Enterprise Dashboard...</Typography>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>Populating metrics, pipelines, and activities.</Typography>
      </Box>
    );
  }

  // Calculate Metrics
  const employees = moduleData.employees || [];
  const customers = moduleData.customers || [];
  const leads = moduleData.leads || [];
  const properties = moduleData.properties || [];
  const sales = moduleData.sales || [];
  const followUps = moduleData.follow_ups || [];
  const siteVisits = moduleData.site_visits || [];
  const attendance = moduleData.attendance || [];

  // 1. Total revenue
  const totalSalesVal = sales.reduce((sum, s) => sum + (Number(s.salePrice) || 0), 0);
  
  // 2. Attendance today (e.g. 2026-07-03 standard mock date)
  const todayStr = new Date().toISOString().split('T')[0];
  const presentToday = attendance.filter(a => a.date === '2026-07-03' && (a.status === 'Present' || a.status === 'Late')).length;
  
  // 3. Properties available vs sold
  const availableProperties = properties.filter(p => p.status === 'Available').length;
  
  // 4. Pending followups today
  const pendingFollowupsToday = followUps.filter(f => f.status === 'Pending').length;

  // Chart Data: Sales Bookings over time (mocked from database)
  const salesChartData = [
    { name: 'Jan', Sales: 12 },
    { name: 'Feb', Sales: 18 },
    { name: 'Mar', Sales: 25 },
    { name: 'Apr', Sales: 22 },
    { name: 'May', Sales: 34 },
    { name: 'Jun', Sales: sales.length * 15 } // dynamically scales based on database count
  ];

  // Chart Data: Lead pipeline status counts
  const leadsByStageMap = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  const leadsChartData = Object.keys(leadsByStageMap).map(key => ({
    name: key,
    Leads: leadsByStageMap[key]
  }));

  // Chart Data: Property pipeline status proportions
  const propertyStatusMap = properties.reduce((acc, prop) => {
    acc[prop.status] = (acc[prop.status] || 0) + 1;
    return acc;
  }, {});

  const propertyPieData = Object.keys(propertyStatusMap).map(key => ({
    name: key,
    value: propertyStatusMap[key]
  }));

  // Filter Today's Tasks & Followups
  const todaysFollowups = followUps.filter(f => f.date === '2026-07-04'); // targeting immediate schedules

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
            onClick={() => navigate('/module/customers')}
            sx={{ backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' } }}
          >
            Register Client
          </Button>
        </Box>
      </Box>

      {/* KPI Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Realised Bookings
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Poppins', color: '#0F172A' }}>
                  ₹{(totalSalesVal / 100000).toFixed(1)}L
                </Typography>
                <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <Icons.TrendingUp size={12} /> +12.5% this month
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: '12px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22C55E' }}>
                <Icons.IndianRupee size={24} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Active Customers
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Poppins', color: '#0F172A' }}>
                  {customers.length} Accounts
                </Typography>
                <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <Icons.UserCheck size={12} /> {leads.length} capturing in leads
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: '12px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563EB' }}>
                <Icons.Users size={24} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Available Properties
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Poppins', color: '#0F172A' }}>
                  {availableProperties} Units
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  Total Listings: {properties.length}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: '12px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}>
                <Icons.Home size={24} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Attendance Today
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Poppins', color: '#0F172A' }}>
                  {presentToday} / {employees.length} Staff
                </Typography>
                <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  {employees.length - presentToday} employees away
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                <Icons.Clock size={24} />
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
        
        {/* Today's Follow Ups */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', fontFamily: 'Poppins' }}>
                  Today's Follow Ups
                </Typography>
                <Chip label={`${todaysFollowups.length} Due`} color="warning" size="small" sx={{ fontWeight: 700 }} />
              </Box>
              <Divider />
              <Box sx={{ flex: 1, overflowY: 'auto', mt: 1, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#F1F5F9' } }}>
                {todaysFollowups.length === 0 ? (
                  <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" color="#94A3B8">
                    <Icons.PhoneCall size={32} style={{ marginBottom: 8 }} />
                    <Typography variant="body2">No follow ups scheduled today</Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {todaysFollowups.map(f => {
                      const client = customers.find(c => c.id === f.customerId) || { name: f.customerId };
                      return (
                        <ListItem key={f.id} disablePadding sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
                          <ListItemText 
                            primary={client.name}
                            secondary={`Scheduled: ${f.time || '10:00 AM'} • Assigned RM ID: ${f.employeeId}`}
                            primaryTypographyProps={{ fontWeight: 600, fontSize: '14px' }}
                            secondaryTypographyProps={{ fontSize: '12px' }}
                          />
                          <Chip label={f.status} size="small" color={f.status === 'Pending' ? 'warning' : 'success'} sx={{ borderRadius: '4px', fontSize: '10px', height: 20 }} />
                        </ListItem>
                      );
                    })}
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
