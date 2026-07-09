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
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../context/AppContext';

const parseTimeStr = (timeStr) => {
  if (!timeStr || timeStr === '--' || timeStr === '') return null;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const amp_pm = match[3];

  if (amp_pm) {
    if (amp_pm.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (amp_pm.toUpperCase() === 'AM' && hours === 12) hours = 0;
  }
  return hours + minutes / 60;
};

const getShiftHours = (inTime, outTime) => {
  const inVal = parseTimeStr(inTime);
  const outVal = parseTimeStr(outTime);
  if (inVal === null || outVal === null) return 0;
  const diff = outVal - inVal;
  return diff > 0 ? diff : 0;
};

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
  const hasAutoStartedRef = useRef(false);

  // Payroll / Salary Settlement states
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [payYear, setPayYear] = useState(new Date().getFullYear());
  const [extraDaysOverride, setExtraDaysOverride] = useState('');
  
  // Custom manual settlements / adjustments
  const [adjustments, setAdjustments] = useState([]);
  const [newAdjDesc, setNewAdjDesc] = useState('');
  const [newAdjAmt, setNewAdjAmt] = useState('');
  const [geoPermissionDialogOpen, setGeoPermissionDialogOpen] = useState(false);

  // Default selectedEmpId once employees load
  useEffect(() => {
    if (moduleData.employees && moduleData.employees.length > 0) {
      if (user?.role === 'Admin') {
        setSelectedEmpId(moduleData.employees[0].id);
      } else {
        setSelectedEmpId(user?.id || '');
      }
    }
  }, [moduleData.employees, user]);

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

  const startLocationSharing = async () => {
    setSharingError("");
    setSharingLocation(true);
    localStorage.setItem('gr_sharing_location', 'true');

    // Run initial capture
    const captureLocation = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 });
          if (pos) {
            setSharingError("");
            await logEmployeeLocation(pos.coords.latitude, pos.coords.longitude, 'sharing');
          }
        } catch (err) {
          console.warn("GPS initial lock weak/delay:", err);
          const isPerm = err.code === 1 || (err.message && err.message.toLowerCase().includes('permission'));
          if (isPerm) {
            setSharingError("Failed to lock location. Please enable GPS permissions.");
          }
        }
      } else {
        if (!navigator.geolocation) {
          setSharingError("Geolocation is not supported by your browser/device.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (pos) {
              setSharingError("");
              await logEmployeeLocation(pos.coords.latitude, pos.coords.longitude, 'sharing');
            }
          },
          (err) => {
            console.warn("GPS initial lock weak/delay:", err);
            if (err.code === 1) {
              setSharingError("Failed to lock location. Please enable GPS permissions.");
            }
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
        );
      }
    };

    if (Capacitor.isNativePlatform()) {
      try {
        let status = await Geolocation.checkPermissions();
        if (status.location !== 'granted') {
          status = await Geolocation.requestPermissions();
        }
        if (status.location !== 'granted') {
          setSharingError("Failed to lock location. Please enable GPS permissions.");
          setSharingLocation(false);
          localStorage.removeItem('gr_sharing_location');
          return;
        }

        await captureLocation();

        // Watch position updates for instant movement updates
        const watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 },
          async (pos, err) => {
            if (err) {
              const isPerm = err.code === 1 || (err.message && err.message.toLowerCase().includes('permission'));
              if (isPerm) {
                setSharingError("Failed to lock location. Please enable GPS permissions.");
              } else {
                console.warn("GPS temporary lock delay:", err);
              }
              return;
            }
            if (pos) {
              setSharingError(""); // Clear error on success!
              await logEmployeeLocation(pos.coords.latitude, pos.coords.longitude, 'sharing');
            }
          }
        );

        if (localStorage.getItem('gr_sharing_location') !== 'true') {
          await Geolocation.clearWatch({ id: watchId });
        } else {
          watchIdRef.current = watchId;
        }
      } catch (err) {
        console.error("Error starting location sharing on native platform:", err);
        const isPerm = err.code === 1 || (err.message && err.message.toLowerCase().includes('permission'));
        if (isPerm) {
          setSharingError("Failed to lock location. Please enable GPS permissions.");
        }
        setSharingLocation(false);
        localStorage.removeItem('gr_sharing_location');
        return;
      }
    } else {
      // Web fallback
      if (!navigator.geolocation) {
        setSharingError("Geolocation is not supported by your browser/device.");
        return;
      }

      await captureLocation();

      // Watch position updates for instant movement updates
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          if (pos) {
            setSharingError(""); // Clear error on success!
            await logEmployeeLocation(pos.coords.latitude, pos.coords.longitude, 'sharing');
          }
        },
        (err) => {
          if (err.code === 1) {
            setSharingError("Failed to lock location. Please enable GPS permissions.");
          } else {
            console.warn("GPS temporary lock delay:", err);
          }
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
      );
    }

    // Setup 10-second interval timer for stationary updates
    intervalIdRef.current = setInterval(captureLocation, 10000);
  };

  const endLocationSharing = async () => {
    setSharingLocation(false);
    localStorage.removeItem('gr_sharing_location');
    setSharingError("");

    if (watchIdRef.current) {
      if (Capacitor.isNativePlatform()) {
        try {
          await Geolocation.clearWatch({ id: watchIdRef.current });
        } catch (e) {
          console.error("Error clearing watch", e);
        }
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
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
        const id = watchIdRef.current;
        if (Capacitor.isNativePlatform()) {
          Geolocation.clearWatch({ id }).catch(e => console.error(e));
        } else {
          navigator.geolocation.clearWatch(id);
        }
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (todayRecord && todayRecord.outTime === '--') {
      if (!hasAutoStartedRef.current) {
        hasAutoStartedRef.current = true;
        setSharingLocation(true);
        localStorage.setItem('gr_sharing_location', 'true');
        startLocationSharing();
      }
    } else {
      hasAutoStartedRef.current = false;
    }
  }, [todayRecord]);

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
    return attendanceList.filter(a => String(a.employeeId) === String(user?.id));
  }, [attendanceList, user]);

  const stats = useMemo(() => {
    const totalDays = myAttendance.length;
    let presentDays = 0;
    let halfDays = 0;
    const lateDays = myAttendance.filter(a => a.status === 'Late').length;
    const absentDays = myAttendance.filter(a => a.status === 'Absent').length;

    const empObj = employees.find(e => String(e.id) === String(user?.id));
    const dutyHours = Number(empObj?.dutyHours) || 8;

    myAttendance.forEach(a => {
      if (a.status === 'Absent') return;
      const hrs = getShiftHours(a.inTime, a.outTime);
      if (hrs > 0 && hrs < dutyHours) {
        halfDays++;
      } else if (hrs >= dutyHours) {
        presentDays++;
      }
    });

    const workedDays = presentDays + (0.5 * halfDays);
    const latePenaltyDays = Math.floor(lateDays / 3);
    const payableDays = Math.max(0, workedDays - latePenaltyDays);

    return {
      totalDays,
      presentDays,
      halfDays,
      lateDays,
      absentDays,
      payableDays
    };
  }, [myAttendance, employees, user]);

  // Selected Employee object for payroll
  const selectedEmployeeObj = useMemo(() => {
    return employees.find(e => String(e.id) === String(selectedEmpId));
  }, [employees, selectedEmpId]);

  // Filter attendance for the selected employee in selected month & year
  const monthlyAttendance = useMemo(() => {
    if (!selectedEmployeeObj) return [];
    return attendanceList.filter(a => {
      if (String(a.employeeId) !== String(selectedEmployeeObj.id)) return false;
      const parts = a.date.split('-');
      if (parts.length < 2) return false;
      const yr = Number(parts[0]);
      const mo = Number(parts[1]);
      return yr === payYear && mo === payMonth;
    });
  }, [attendanceList, selectedEmployeeObj, payMonth, payYear]);

  const monthlyStats = useMemo(() => {
    if (!selectedEmployeeObj) return null;

    const dutyHours = Number(selectedEmployeeObj.dutyHours) || 8;
    const baseSalary = Number(selectedEmployeeObj.salary) || 0;
    const holidaysAllotted = Number(selectedEmployeeObj.holidaysAllotted) || 4;

    let presentDays = 0;
    let halfDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    let sundaysWorked = 0;

    monthlyAttendance.forEach(a => {
      if (a.status === 'Absent') {
        return;
      }
      if (a.status === 'Late') {
        lateDays++;
      }

      // Calculate shift duration
      const hrs = getShiftHours(a.inTime, a.outTime);
      if (hrs > 0 && hrs < dutyHours) {
        halfDays++;
      } else if (hrs >= dutyHours) {
        presentDays++;
      }

      // Sunday tracking
      const d = new Date(a.date);
      if (d.getDay() === 0) {
        sundaysWorked += (hrs >= dutyHours ? 1.0 : (hrs > 0 ? 0.5 : 0));
      }
    });

    const workedDays = presentDays + (0.5 * halfDays);
    const latePenaltyDays = Math.floor(lateDays / 3);
    const calendarDays = new Date(payYear, payMonth, 0).getDate();
    
    // Calculate absent days (days in selected month without any attendance entry, excluding Sundays)
    const today = new Date();
    const isCurrentMonth = payYear === today.getFullYear() && payMonth === today.getMonth() + 1;
    const endDay = isCurrentMonth ? today.getDate() : calendarDays;
    
    for (let d = 1; d <= endDay; d++) {
      const dateStr = `${payYear}-${String(payMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasRecord = monthlyAttendance.find(a => a.date === dateStr);
      const isSunday = new Date(payYear, payMonth - 1, d).getDay() === 0;
      
      if (!hasRecord && !isSunday) {
        absentDays++;
      }
    }
    // Also add explicit 'Absent' status logs if any
    absentDays += monthlyAttendance.filter(a => a.status === 'Absent').length;

    const calculatedExtraDays = sundaysWorked;
    const extraDays = extraDaysOverride !== '' ? Number(extraDaysOverride) : calculatedExtraDays;

    const standardWorkingDays = Math.max(1, calendarDays - holidaysAllotted);
    const dailyRate = Math.round(baseSalary / standardWorkingDays);

    const finalPayableDays = Math.max(0, workedDays - latePenaltyDays + extraDays);
    const totalEarnings = Math.round(finalPayableDays * dailyRate);

    const adjustmentsSum = adjustments.reduce((acc, curr) => acc + curr.amount, 0);
    const netPayableEarnings = totalEarnings + adjustmentsSum;

    return {
      calendarDays,
      standardWorkingDays,
      presentDays,
      halfDays,
      lateDays,
      absentDays,
      workedDays,
      latePenaltyDays,
      calculatedExtraDays,
      extraDays,
      dailyRate,
      finalPayableDays,
      totalEarnings,
      adjustmentsSum,
      netPayableEarnings,
      baseSalary,
      dutyHours,
      holidaysAllotted
    };
  }, [monthlyAttendance, selectedEmployeeObj, payMonth, payYear, extraDaysOverride, adjustments]);

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
                    onClick={() => setGeoPermissionDialogOpen(true)}
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
        <Grid item xs={12} sm={4} md={4}>
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
        <Grid item xs={12} sm={4} md={4}>
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
        <Grid item xs={12} sm={4} md={4}>
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
                Today's Timing Records
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
                    {attendanceList.filter(a => a.date === todayStr).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94A3B8' }}>
                          No timing records registered for today.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendanceList.filter(a => a.date === todayStr).map(a => {
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

      {/* Salary Settlement & Printable Receipt Section */}
      {selectedEmployeeObj && monthlyStats && (
        <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', mt: 4, mb: 4 }} className="no-print-card">
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, fontSize: '20px', mb: 3, fontFamily: 'Poppins', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Icons.Coins size={22} style={{ color: '#F59E0B' }} />
              Employee Payroll Settlement & Receipt
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={4}>
              {/* Inputs & Parameters Panel */}
              <Grid item xs={12} md={4} className="no-print">
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: '#475569' }}>
                  Settlement Parameters
                </Typography>
                
                {user?.role === 'Admin' && (
                  <Box mb={2.5}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Employee</InputLabel>
                      <Select
                        label="Select Employee"
                        value={selectedEmpId}
                        onChange={(e) => {
                          setSelectedEmpId(e.target.value);
                          setExtraDaysOverride('');
                        }}
                      >
                        {employees.map(emp => (
                          <MenuItem key={emp.id} value={emp.id}>{emp.name} ({emp.id})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}

                <Grid container spacing={2} mb={2.5}>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Month</InputLabel>
                      <Select
                        label="Month"
                        value={payMonth}
                        onChange={(e) => {
                          setPayMonth(e.target.value);
                          setExtraDaysOverride('');
                        }}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <MenuItem key={m} value={m}>
                            {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Year</InputLabel>
                      <Select
                        label="Year"
                        value={payYear}
                        onChange={(e) => {
                          setPayYear(e.target.value);
                          setExtraDaysOverride('');
                        }}
                      >
                        {[2025, 2026, 2027].map(y => (
                          <MenuItem key={y} value={y}>{y}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Box mb={3.5}>
                  <TextField
                    label="Extra Days Worked (Override)"
                    size="small"
                    type="number"
                    fullWidth
                    placeholder={`Calculated: ${monthlyStats.calculatedExtraDays} days`}
                    value={extraDaysOverride}
                    onChange={(e) => setExtraDaysOverride(e.target.value)}
                    helperText="Sunday shifts are auto-calculated as extra days"
                  />
                </Box>

                {/* Manual Adjustments / Expenses / Settlements Form */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#475569', fontSize: '13px' }}>
                  Manual Settlements / Expenses
                </Typography>
                <Grid container spacing={1} mb={1}>
                  <Grid item xs={7}>
                    <TextField
                      label="Adjustment Description"
                      size="small"
                      fullWidth
                      value={newAdjDesc}
                      onChange={(e) => setNewAdjDesc(e.target.value)}
                      placeholder="e.g. Travel Allowance"
                      inputProps={{ style: { fontSize: '12px' } }}
                      InputLabelProps={{ style: { fontSize: '12px' } }}
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      label="Amount (INR)"
                      size="small"
                      type="number"
                      fullWidth
                      value={newAdjAmt}
                      onChange={(e) => setNewAdjAmt(e.target.value)}
                      placeholder="e.g. 500"
                      inputProps={{ style: { fontSize: '12px' } }}
                      InputLabelProps={{ style: { fontSize: '12px' } }}
                    />
                  </Grid>
                </Grid>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={() => {
                    if (!newAdjDesc.trim() || !newAdjAmt) return;
                    setAdjustments(prev => [...prev, { description: newAdjDesc, amount: Number(newAdjAmt) }]);
                    setNewAdjDesc('');
                    setNewAdjAmt('');
                  }}
                  sx={{ mb: 2, textTransform: 'none', fontWeight: 600, fontSize: '12px', py: 0.5 }}
                  startIcon={<Icons.Plus size={14} />}
                >
                  Add Settlement/Expense
                </Button>

                {adjustments.length > 0 && (
                  <Box mb={2} sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', p: 1.5, backgroundColor: '#F8FAFC' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1, color: '#64748B' }}>
                      Added Adjustments ({adjustments.length})
                    </Typography>
                    {adjustments.map((adj, idx) => (
                      <Box key={idx} display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="caption" sx={{ color: '#334155', fontSize: '11px' }}>
                          {adj.description}: <strong>{adj.amount >= 0 ? '+' : ''}₹{adj.amount}</strong>
                        </Typography>
                        <IconButton size="small" onClick={() => setAdjustments(prev => prev.filter((_, i) => i !== idx))} sx={{ p: 0.2 }}>
                          <Icons.X size={12} color="#EF4444" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
                
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Icons.Printer size={18} />}
                  onClick={() => window.print()}
                  sx={{ py: 1, backgroundColor: '#10B981', '&:hover': { backgroundColor: '#059669' }, fontWeight: 700 }}
                >
                  Print Salary Slip
                </Button>
              </Grid>

              {/* Printable Receipt Slip Card */}
              <Grid item xs={12} md={8}>
                <Paper 
                  id="printable-salary-slip"
                  sx={{ 
                    p: 4, 
                    border: '1px dashed #CBD5E1', 
                    borderRadius: '12px', 
                    backgroundColor: '#FFFFFF',
                    position: 'relative'
                  }}
                >
                  {/* Watermark logo */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '20px', color: '#1E3A8A', letterSpacing: '0.05em' }}>
                        GAGAN REALTECH CRM
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                        Office No. 12, Level 3, Mohali Plaza, Punjab
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#10B981' }}>
                        SALARY RECEIPT SLIP
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        Period: {new Date(payYear, payMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </Typography>
                    </Box>
                  </Box>
                  <Divider sx={{ mb: 3 }} />

                  {/* Employee Details block */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>EMPLOYEE NAME</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedEmployeeObj.name}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>EMPLOYEE ID / ROLE</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedEmployeeObj.id} / {selectedEmployeeObj.role || 'Staff'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>DAILY DUTY HOURS REQUIRED</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{monthlyStats.dutyHours} Hours/Day</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>ALLOTTED MONTHLY HOLIDAYS</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{monthlyStats.holidaysAllotted} Days</Typography>
                    </Grid>
                  </Grid>
                  <Divider sx={{ mb: 3 }} />

                  {/* Calculations breakdown list */}
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#475569' }}>
                    Earnings & Attendance breakdown
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3.5 }}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748B' }}>Monthly Base Salary</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{monthlyStats.baseSalary.toLocaleString('en-IN')}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748B' }}>Calculated Daily Pay Rate</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{monthlyStats.dailyRate.toLocaleString('en-IN')} / Day</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748B' }}>Days Worked (Full Present / Half Days)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {monthlyStats.presentDays} Full / {monthlyStats.halfDays} Half (Total: {monthlyStats.workedDays} Days)
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748B' }}>Late Arrivals Penalty Deductions (3 lates = 1 day deduct)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#EF4444' }}>
                        -{monthlyStats.latePenaltyDays} Days ({monthlyStats.lateDays} Late Days)
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748B' }}>Extra Days Allowed (Sunday Shifts worked)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#10B981' }}>
                        +{monthlyStats.extraDays} Days
                      </Typography>
                    </Box>
                    <Divider />
                    <Box display="flex" justifyContent="space-between" sx={{ mt: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Net Payable Days</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#2563EB' }}>
                        {monthlyStats.finalPayableDays} Days
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: '#64748B' }}>Attendance Earned Salary</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{monthlyStats.totalEarnings.toLocaleString('en-IN')}</Typography>
                    </Box>
                    {adjustments.length > 0 && (
                      <>
                        <Divider />
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', mt: 1, display: 'block' }}>
                          Manual Settlements & Expenses
                        </Typography>
                        {adjustments.map((adj, idx) => (
                          <Box key={idx} display="flex" justifyContent="space-between">
                            <Typography variant="body2" sx={{ color: '#64748B' }}>{adj.description}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: adj.amount >= 0 ? '#10B981' : '#EF4444' }}>
                              {adj.amount >= 0 ? '+' : ''}₹{adj.amount.toLocaleString('en-IN')}
                            </Typography>
                          </Box>
                        ))}
                      </>
                    )}
                  </Box>
                  <Divider sx={{ mb: 3 }} />

                  {/* Net earnings display */}
                  <Box 
                    sx={{ 
                      p: 2.5, 
                      backgroundColor: '#F8FAFC', 
                      border: '1px solid #E2E8F0', 
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontWeight: 600 }}>TOTAL PAYABLE SALARY (NET SETTLEMENT)</Typography>
                      <Typography variant="caption" sx={{ color: '#94A3B8' }}>Tax & TDS applicable as per laws</Typography>
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#16A34A', fontSize: '28px', fontFamily: 'Poppins' }}>
                      ₹{monthlyStats.netPayableEarnings.toLocaleString('en-IN')}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 5, display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ width: 150, textAlign: 'center' }}>
                      <Divider />
                      <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#64748B' }}>Employee Signature</Typography>
                    </Box>
                    <Box sx={{ width: 150, textAlign: 'center' }}>
                      <Divider />
                      <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#64748B' }}>Authorized Signatory</Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Printing style overlay */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-salary-slip, #printable-salary-slip * {
            visibility: visible;
          }
          #printable-salary-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print, .no-print-card, header, nav, aside {
            display: none !important;
          }
        }
      `}</style>

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

      {/* Background Geolocation Consent Explanation Dialog */}
      <Dialog 
        open={geoPermissionDialogOpen} 
        onClose={() => setGeoPermissionDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '18px', fontFamily: 'Poppins', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icons.MapPin size={22} style={{ color: '#EF4444' }} />
          Location Consent
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
            Gagan Realtech CRM tracks your coordinates during active shifts to verify client meetings, draw your path routes, and calculate shift kilometers.
            <br/><br/>
            <strong>Background Tracking:</strong> To calculate your route accurately, this app reads your location even when the app is minimized, closed, or your screen is locked.
            <br/><br/>
            Tracking will run continuously in the background <strong>until you explicitly click "Punch Out"</strong> on this page.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setGeoPermissionDialogOpen(false)} 
            sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}
          >
            Don't Allow
          </Button>
          <Button 
            onClick={() => {
              setGeoPermissionDialogOpen(false);
              handlePunchIn();
            }} 
            variant="contained" 
            color="success"
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px', backgroundColor: '#22C55E' }}
          >
            Allow & Punch In
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Attendance;
