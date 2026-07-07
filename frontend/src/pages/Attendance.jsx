import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Grid, 
  Typography, 
  TextField, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Chip,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';

const Attendance = () => {
  const { 
    moduleData, 
    fetchModuleData, 
    createRecord, 
    updateRecord,
    deleteRecord,
    user,
    logEmployeeLocation 
  } = useApp();

  const [sharingLocation, setSharingLocation] = useState(
    localStorage.getItem('gr_sharing_location') === 'true'
  );
  const [sharingError, setSharingError] = useState('');
  const watchIdRef = useRef(null);
  const intervalIdRef = useRef(null);

  // Self-service Punch Card states
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayRecord = useMemo(() => {
    return (moduleData.attendance || []).find(a => String(a.employeeId) === String(user?.id) && a.date === todayStr);
  }, [moduleData.attendance, user, todayStr]);

  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueDate, setIssueDate] = useState(todayStr);
  const [issueDesc, setIssueDesc] = useState('');
  const [issueError, setIssueError] = useState('');
  const [issueSuccess, setIssueSuccess] = useState('');

  const handlePunchIn = async () => {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
      const statusStr = isLate ? 'Late' : 'Present';
      
      const payload = {
        employeeId: user?.id || 'EMP-001',
        date: todayStr,
        inTime: timeStr,
        outTime: '--',
        status: statusStr
      };
      await createRecord('attendance', payload);
      fetchModuleData('attendance');

      // Automatically start location sharing upon punching in
      startLocationSharing();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePunchOut = async () => {
    if (!todayRecord) return;
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      await updateRecord('attendance', todayRecord.id, {
        ...todayRecord,
        outTime: timeStr
      });
      fetchModuleData('attendance');

      // Automatically stop location sharing upon punching out
      await endLocationSharing();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRaiseIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueDesc.trim()) {
      setIssueError('Please specify the correction details.');
      return;
    }
    try {
      setIssueError('');
      setIssueSuccess('');
      await createRecord('notices', {
        employeeId: user?.id || 'EMP-001',
        category: 'Attendance Dispute',
        note_content: `Dispute Date: ${issueDate} | Issue details: ${issueDesc}`
      });
      setIssueSuccess('Attendance correction dispute raised successfully. Admin notified!');
      setIssueDesc('');
      setTimeout(() => {
        setIssueDialogOpen(false);
        setIssueSuccess('');
      }, 2000);
    } catch (err) {
      setIssueError('Failed to raise dispute request. Please try again.');
    }
  };

  const startLocationSharing = () => {
    if (!navigator.geolocation) {
      setSharingError("Geolocation is not supported by your browser/device.");
      return;
    }

    setSharingError("");
    setSharingLocation(true);
    localStorage.setItem('gr_sharing_location', 'true');

    // Run initial capture
    const captureLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await logEmployeeLocation(pos.coords.latitude, pos.coords.longitude, 'sharing');
        },
        (err) => {
          console.error("Error logging position", err);
        },
        { enableHighAccuracy: true }
      );
    };

    captureLocation();

    // Watch position updates for instant movement updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await logEmployeeLocation(pos.coords.latitude, pos.coords.longitude, 'sharing');
      },
      (err) => {
        setSharingError("Failed to lock location. Please enable GPS permissions.");
        console.error(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Setup 10-second interval timer for stationary updates
    intervalIdRef.current = setInterval(captureLocation, 10000);
  };

  const endLocationSharing = async () => {
    setSharingLocation(false);
    localStorage.removeItem('gr_sharing_location');
    setSharingError("");

    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    await logEmployeeLocation(0, 0, 'ended');
  };

  useEffect(() => {
    if (sharingLocation) {
      startLocationSharing();
    }
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Log Entry Form state
  const [empId, setEmpId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [inTime, setInTime] = useState('09:00 AM');
  const [outTime, setOutTime] = useState('06:00 PM');
  const [status, setStatus] = useState('Present');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchModuleData('attendance'),
        fetchModuleData('employees')
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  const employees = moduleData.employees || [];
  const attendanceList = moduleData.attendance || [];

  // Filter attendance for the logged-in user to compute metrics
  const myAttendance = useMemo(() => {
    return attendanceList.filter(a => a.employeeId === user?.id);
  }, [attendanceList, user]);

  // Compute Metrics
  const stats = useMemo(() => {
    const totalDays = myAttendance.length;
    const presentDays = myAttendance.filter(a => a.status === 'Present').length;
    const lateDays = myAttendance.filter(a => a.status === 'Late').length;
    const absentDays = myAttendance.filter(a => a.status === 'Absent').length;

    // Prorated Salary Calculation:
    // Base salary from user profile
    const baseSalary = user?.salary || 45000;
    // Assuming 26 standard working days in a month
    const workDays = 26;
    const activeDays = presentDays + lateDays;
    
    // Penalize late arrivals slightly (e.g. 3 late arrivals = 1 absent day penalty)
    const latePenaltyDays = Math.floor(lateDays / 3);
    const payableDays = Math.max(0, activeDays - latePenaltyDays);
    
    const estimatedSalary = Math.round((payableDays / workDays) * baseSalary);

    return {
      totalDays,
      presentDays,
      lateDays,
      absentDays,
      estimatedSalary,
      payableDays
    };
  }, [myAttendance, user]);

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!empId || !date || !inTime) {
      setErrorMsg('Please specify Employee ID, Date and Punch In details.');
      return;
    }

    const payload = {
      employeeId: empId,
      date,
      inTime,
      outTime,
      status
    };

    const res = await createRecord('attendance', payload);
    if (res.success) {
      setErrorMsg('');
      setEmpId('');
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this attendance entry?')) {
      await deleteRecord('attendance', id);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Title & Self-Service Attendance Dashboard Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }} alignItems="stretch">
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h2" sx={{ fontWeight: 800, fontSize: '26px', color: '#0F172A', fontFamily: 'Poppins' }}>
            Attendance Log station
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 1 }}>
            Log employee timings manually, inspect monthly payouts, and calculate salary estimations.
          </Typography>
        </Grid>
        
        {/* Combined Punch In / Punch Out & Geolocation Tracking Card */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '12px', height: '100%', boxShadow: 'none', backgroundColor: sharingLocation ? 'rgba(34,197,94,0.03)' : '#FFFFFF' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 2, height: '100%', boxSizing: 'border-box' }}>
              <Box sx={{ 
                backgroundColor: sharingLocation ? '#22C55E' : '#94A3B8', 
                borderRadius: '50%', 
                width: 10, 
                height: 10, 
                animation: sharingLocation ? 'pulse 1.8s infinite' : 'none' 
              }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                  Duty Punch Terminal
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                  {todayRecord ? `Checked In: ${todayRecord.inTime}` : 'Not Punched In Today'}
                </Typography>
                {todayRecord && todayRecord.outTime !== '--' && (
                  <Typography variant="caption" sx={{ color: '#16A34A', display: 'block', fontWeight: 600 }}>
                    Checked Out: {todayRecord.outTime} ✅
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: sharingLocation ? '#16A34A' : '#64748B', display: 'block', fontWeight: 600, mt: 0.5 }}>
                  {sharingLocation ? '📡 GPS Tracking Active' : '🛑 GPS Tracking Paused'}
                </Typography>
                {sharingError && (
                  <Typography variant="caption" sx={{ color: '#EF4444', display: 'block', fontSize: '10px' }}>
                    {sharingError}
                  </Typography>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {!todayRecord ? (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    onClick={handlePunchIn}
                    sx={{ borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'none', backgroundColor: '#22C55E' }}
                  >
                    Punch In
                  </Button>
                ) : todayRecord.outTime === '--' ? (
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={handlePunchOut}
                    sx={{ borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'none' }}
                  >
                    Punch Out
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    disabled
                    sx={{ borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'none' }}
                  >
                    Completed
                  </Button>
                )}
                
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setIssueDialogOpen(true)}
                  sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'none', color: '#64748B', p: 0 }}
                >
                  Raise Issue ⚠️
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* CSS Pulse Animation rule */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}</style>

      {/* Stats Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>Days Present</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: '#0F172A', fontFamily: 'Poppins' }}>
                {stats.presentDays} Days
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>Total logged days: {stats.totalDays}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>Late arrivals</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: '#F59E0B', fontFamily: 'Poppins' }}>
                {stats.lateDays} Days
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>Deductions apply on 3+ late days</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>Payable Days</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: '#22C55E', fontFamily: 'Poppins' }}>
                {stats.payableDays} Days
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>Out of 26 working days</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <CardContent>
              <Typography variant="caption" sx={{ color: '#16A34A', fontWeight: 600 }}>Estimated Salary (Prorated)</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: '#16A34A', fontFamily: 'Poppins' }}>
                ₹{stats.estimatedSalary.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>Base: ₹{user?.salary?.toLocaleString()}/mo</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Manual Log Entry Form */}
        <Grid item xs={12} md={4}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, fontFamily: 'Poppins' }}>
                Add Timings Entry
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

              <form onSubmit={handleLogSubmit}>
                <Box mb={2.5}>
                  <FormControl fullWidth size="medium">
                    <InputLabel>Select Employee</InputLabel>
                    <Select
                      label="Select Employee"
                      value={empId}
                      onChange={(e) => setEmpId(e.target.value)}
                    >
                      {employees.map(emp => (
                        <MenuItem key={emp.id} value={emp.id}>{emp.name} ({emp.id})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box mb={2.5}>
                  <TextField 
                    type="date"
                    label="Logging Date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Box>

                <Grid container spacing={1.5} mb={2.5}>
                  <Grid item xs={6}>
                    <TextField 
                      label="Punch In (e.g. 09:15 AM)"
                      fullWidth
                      value={inTime}
                      onChange={(e) => setInTime(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField 
                      label="Punch Out"
                      fullWidth
                      value={outTime}
                      onChange={(e) => setOutTime(e.target.value)}
                    />
                  </Grid>
                </Grid>

                <Box mb={3.5}>
                  <FormControl fullWidth>
                    <InputLabel>Duty Status</InputLabel>
                    <Select
                      label="Duty Status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <MenuItem value="Present">Present On-Duty</MenuItem>
                      <MenuItem value="Late">Late Punch-In</MenuItem>
                      <MenuItem value="Absent">Absent</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Button 
                  type="submit" 
                  variant="contained" 
                  fullWidth 
                  startIcon={<Icons.CheckSquare size={18} />}
                  sx={{ py: 1.2, backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' } }}
                >
                  Confirm Log details
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Attendance Listing Table */}
        <Grid item xs={12} md={8}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
            <CardContent sx={{ p: 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', p: 3, pb: 2, fontFamily: 'Poppins' }}>
                All Timing Records
              </Typography>
              <Divider />
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Punch In</TableCell>
                      <TableCell>Punch Out</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendanceList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94A3B8' }}>
                          No timing records registered.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendanceList.map(a => {
                        const empName = employees.find(e => e.id === a.employeeId)?.name || a.employeeId;
                        return (
                          <TableRow key={a.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{empName}</TableCell>
                            <TableCell>{a.date}</TableCell>
                            <TableCell>{a.inTime}</TableCell>
                            <TableCell>{a.outTime || '---'}</TableCell>
                            <TableCell>
                              <Chip 
                                label={a.status} 
                                size="small" 
                                sx={{ 
                                  backgroundColor: a.status === 'Present' ? 'rgba(34,197,94,0.1)' : a.status === 'Late' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                  color: a.status === 'Present' ? '#22C55E' : a.status === 'Late' ? '#F59E0B' : '#EF4444',
                                  fontWeight: 700,
                                  fontSize: '10px'
                                }} 
                              />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" color="error" onClick={() => handleDelete(a.id)}>
                                <Icons.Trash2 size={14} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

    {/* Raise Attendance Issue Correction Dialog */}
      <Dialog 
        open={issueDialogOpen} 
        onClose={() => setIssueDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: '12px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '18px', fontFamily: 'Poppins' }}>
          Raise Attendance Issue
        </DialogTitle>
        <form onSubmit={handleRaiseIssueSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
            {issueError && <Alert severity="error" sx={{ fontSize: '12px' }}>{issueError}</Alert>}
            {issueSuccess && <Alert severity="success" sx={{ fontSize: '12px' }}>{issueSuccess}</Alert>}
            
            <TextField
              type="date"
              label="Disputed Date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
            
            <TextField
              multiline
              rows={3}
              label="Reason / Details"
              placeholder="Explain the correction request (e.g. forgot to check out, client meeting from home)..."
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              fullWidth
              required
            />
          </DialogContent>
          
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button 
              size="small"
              onClick={() => setIssueDialogOpen(false)} 
              sx={{ textTransform: 'none', fontWeight: 700, color: '#64748B' }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              size="small"
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px' }}
            >
              Submit Issue
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Attendance;
