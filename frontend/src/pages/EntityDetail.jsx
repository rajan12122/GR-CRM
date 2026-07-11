import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  TextField, 
  Divider, 
  Paper, 
  Tabs, 
  Tab, 
  Chip, 
  List, 
  ListItem, 
  ListItemText,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import * as Icons from 'lucide-react';
import { useApp, API_BASE_URL } from '../context/AppContext';
import EntityTooltip from '../components/EntityTooltip';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const EntityDetail = () => {
  const { moduleName, id } = useParams();
  const navigate = useNavigate();
  const { 
    metadata, 
    moduleData,
    fetchModuleData,
    fetchEntity360, 
    createRemark, 
    uploadDocument,
    deleteRecord,
    loadingData 
  } = useApp();

  const [record, setRecord] = useState(null);
  const [connections, setConnections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  
  // Custom dialogs & form states for ERP features
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [pitchDialogOpen, setPitchDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [meetingReportDialogOpen, setMeetingReportDialogOpen] = useState(false);
  
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [meetingOutcome, setMeetingOutcome] = useState('');
  const [meetingDocCollected, setMeetingDocCollected] = useState('');
  
  const [pitchPropertyId, setPitchPropertyId] = useState('');
  const [pitchEmployeeId, setPitchEmployeeId] = useState('');
  const [pitchMethod, setPitchMethod] = useState('Call');
  const [pitchInterest, setPitchInterest] = useState('Interested');
  const [pitchPrice, setPitchPrice] = useState('');
  const [pitchFollowUp, setPitchFollowUp] = useState('');
  const [pitchRemarks, setPitchRemarks] = useState('');
  const [pitchWarning, setPitchWarning] = useState('');

  const [queryEmployeeId, setQueryEmployeeId] = useState('');
  const [queryType, setQueryType] = useState('Buy Property');
  const [queryBudget, setQueryBudget] = useState('');
  const [queryDemand, setQueryDemand] = useState('');
  const [queryRCI, setQueryRCI] = useState('Residential');
  const [queryPropType, setQueryPropType] = useState('Villa');
  const [queryLocality, setQueryLocality] = useState('');
  const [querySector, setQuerySector] = useState('');
  const [querySize, setQuerySize] = useState('');
  const [queryRemarks, setQueryRemarks] = useState('');

  const [callDuration, setCallDuration] = useState('');
  const [callBudget, setCallBudget] = useState('');
  const [callAreas, setCallAreas] = useState('');
  const [callFollowUp, setCallFollowUp] = useState('');
  const [callRemarks, setCallRemarks] = useState('');

  // Map dialog state
  const [mapOpen, setMapOpen] = useState(false);
  const [activeMapShift, setActiveMapShift] = useState(null);
  const [activeSalarySlip, setActiveSalarySlip] = useState(null);

  const tabs = useMemo(() => {
    const list = [];
    if (!connections) return list;
    
    if (moduleName === 'customers') {
      list.push({ label: 'Overview', icon: 'User' });
      list.push({ label: `Queries (${connections.queries?.length || 0})`, icon: 'HelpCircle' });
      list.push({ label: `Deals (${connections.deals?.length || 0})`, icon: 'Handshake' });
      list.push({ label: `Pitches (${connections.pitches?.length || 0})`, icon: 'Send' });
      list.push({ label: 'Activity Timeline', icon: 'Clock' });
      list.push({ label: `Docs & Files (${connections.documents?.length || 0})`, icon: 'FileText' });
    } else if (moduleName === 'properties') {
      list.push({ label: 'Overview', icon: 'Home' });
      list.push({ label: `Pitches & Showings (${connections.pitches?.length || 0})`, icon: 'Eye' });
      list.push({ label: 'Owner History', icon: 'UserCheck' });
      list.push({ label: `Docs Vault (${connections.documents?.length || 0})`, icon: 'FolderOpen' });
      list.push({ label: `Deals History (${connections.deals?.length || 0})`, icon: 'TrendingUp' });
      list.push({ label: 'Activity Timeline', icon: 'Clock' });
    } else if (moduleName === 'dealers') {
      list.push({ label: 'Overview', icon: 'Building' });
      list.push({ label: `Outreach Prep & Logs (${connections.meetings?.length || 0})`, icon: 'Briefcase' });
      list.push({ label: `Outreach Calls (${connections.calls?.length || 0})`, icon: 'PhoneCall' });
      list.push({ label: 'Activity Timeline', icon: 'Clock' });
    } else {
      list.push({ label: 'Salesforce 360° Connections', icon: 'Layers' });
      list.push({ label: `Remarks History (${connections.remarks?.length || 0})`, icon: 'MessageSquare' });
      list.push({ label: `Documents/Files (${connections.documents?.length || 0})`, icon: 'FileText' });
      if (moduleName === 'employees') {
        list.push({ label: `Odometer & Travel Logs (${travelLogs.length})`, icon: 'Compass' });
      }
    }
    return list;
  }, [moduleName, connections, travelLogs]);

  const travelLogs = useMemo(() => {
    return (connections?.attendance || [])
      .filter(a => a.odometerStart !== undefined || a.odometerEnd !== undefined)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [connections]);

  const locationHistoryPastMonth = useMemo(() => {
    if (!record || !record.locationHistory) return [];
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    return record.locationHistory.filter(hist => {
      const parts = hist.date.split(/[-/]/);
      let histDate;
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        histDate = new Date(year, month, day);
      } else {
        histDate = new Date(hist.date);
      }
      return isNaN(histDate.getTime()) || histDate >= oneMonthAgo;
    });
  }, [record]);

  // Load Leaflet resources dynamically
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (mapOpen && activeMapShift && activeMapShift.path && activeMapShift.path.length > 0) {
      const timer = setTimeout(() => {
        const L = window.L;
        if (!L) return;

        const container = document.getElementById('route-map-container');
        if (!container) return;

        if (container._leaflet_map) {
          container._leaflet_map.remove();
        }

        const pathPoints = activeMapShift.path.map(p => [p.lat, p.lng]);
        const startPoint = pathPoints[0];
        const endPoint = pathPoints[pathPoints.length - 1];

        const map = L.map('route-map-container').setView(startPoint, 15);
        container._leaflet_map = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        const polyline = L.polyline(pathPoints, {
          color: '#3B82F6',
          weight: 4,
          opacity: 0.8
        }).addTo(map);

        L.marker(startPoint).addTo(map).bindPopup('<b>Starting Point</b>').openPopup();
        if (pathPoints.length > 1) {
          L.marker(endPoint).addTo(map).bindPopup('<b>Ending Point</b>');
        }

        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [mapOpen, activeMapShift]);

  // File upload state and permission handlers
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Remarks Form State
  const [remarkInput, setRemarkInput] = useState('');
  // Document Upload State
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState('');

  // Message templates state
  const [templates, setTemplates] = useState({
    whatsapp: "Hi [Client Name], based on your requirements, here is a matching listing: [Property Name] (Price: ₹[Price]). Let me know when you'd like to visit!",
    email_subject: "Matching Property Listing - Gagan Realtech",
    email_body: "Hi [Client Name],\n\nBased on your requirements, here is a property listing you might like:\n\nProperty Name: [Property Name]\nPrice: ₹[Price]\nLocality: [Locality]\nSector: [Sector]\n\nBest regards,\nGagan Realtech Team",
    sms: "Hi [Client Name], matching listing found: [Property Name] (Price: ₹[Price]) in [Locality]. Contact us!"
  });

  useEffect(() => {
    const token = localStorage.getItem('gr_crm_token');
    axios.get(`${API_BASE_URL}/templates`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data) setTemplates(res.data);
    }).catch(err => console.error(err));
  }, []);

  const compileTemplate = (text, clientName, propName, price, locality, sector) => {
    if (!text) return "";
    return text
      .replaceAll('[Client Name]', clientName || '')
      .replaceAll('[Property Name]', propName || '')
      .replaceAll('[Price]', price ? Number(price).toLocaleString('en-IN') : '')
      .replaceAll('[Locality]', locality || '')
      .replaceAll('[Sector]', sector || '');
  };

  const loadData = async () => {
    setLoading(true);
    // Fetch master modules list to match details
    const moduleRecords = await fetchModuleData(moduleName);
    const item = moduleRecords.find(r => String(r.id) === String(id));
    setRecord(item);

    if (item) {
      const rels = await fetchEntity360(moduleName, id);
      setConnections(rels);
      if (moduleName === 'leads') {
        await fetchModuleData('properties');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (metadata) {
      loadData();
    }
  }, [moduleName, id, metadata]);

  // Reset tab to 0 on route change
  useEffect(() => {
    setActiveTab(0);
  }, [moduleName, id]);

  useEffect(() => {
    if (pitchPropertyId && connections?.pitches) {
      const alreadyPitched = connections.pitches.find(p => String(p.propertyId) === String(pitchPropertyId));
      if (alreadyPitched) {
        setPitchWarning(`Warning: This property was already pitched to this client on ${alreadyPitched.pitchDate} by ${alreadyPitched.employeeName || 'another RM'}!`);
      } else {
        setPitchWarning('');
      }
    } else {
      setPitchWarning('');
    }
  }, [pitchPropertyId, connections]);


  if (!metadata) return null;

  const moduleConfig = metadata.modules[moduleName];
  if (loading) {
    return (
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!record) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Record '{id}' not found in module '{moduleName}'.</Alert>
      </Box>
    );
  }


  const handlePostRemark = async (e) => {
    e.preventDefault();
    if (!remarkInput.trim()) return;

    const res = await createRemark(moduleName, id, remarkInput);
    if (res.success) {
      setRemarkInput('');
      // Reload connections
      const rels = await fetchEntity360(moduleName, id);
      setConnections(rels);
    }
  };


  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPermissionDialogOpen(true);
  };

  const handleGrantPermissionAndUpload = async () => {
    setPermissionDialogOpen(false);
    if (!selectedFile) return;

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target.result;
        const token = localStorage.getItem('gr_crm_token');
        
        const res = await axios.post(`${API_BASE_URL}/upload`, {
          fileName: selectedFile.name,
          base64Data
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data && res.data.fileUrl) {
          setDocUrl(res.data.fileUrl);
          if (!docName) {
            setDocName(selectedFile.name);
          }
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      console.error(err);
      alert('Upload failed. Please check backend.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!docName.trim()) return;

    const res = await uploadDocument(moduleName, id, docName, docUrl);
    if (res.success) {
      setDocName('');
      setDocUrl('');
      // Reload connections
      const rels = await fetchEntity360(moduleName, id);
      setConnections(rels);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      const res = await deleteRecord('documents', docId);
      if (res.success) {
        const rels = await fetchEntity360(moduleName, id);
        setConnections(rels);
      } else {
        alert(res.message || "Failed to delete document.");
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header and Go Back */}
      <Button 
        startIcon={<Icons.ArrowLeft size={16} />}
        onClick={() => navigate(`/module/${moduleName}`)}
        sx={{ mb: 3, borderColor: '#E2E8F0', color: '#64748B' }}
        variant="outlined"
      >
        Back to List
      </Button>

      {/* Title block */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', color: '#2563EB', fontWeight: 800 }}>
            {moduleConfig.label.slice(0, -1)} 360° Profile View
          </Typography>
          <Typography variant="h2" sx={{ fontWeight: 800, fontSize: '28px', color: '#0F172A', fontFamily: 'Poppins' }}>
            {record.name || record.title || record.id}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            System ID Reference: <strong>{record.id}</strong>
          </Typography>
        </Box>
      </Box>

      {/* 1. Horizontal Profile Fields Card at the very top */}
      <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', mb: 2.5, fontFamily: 'Poppins' }}>
            Profile Details
          </Typography>
          <Grid container spacing={2.5}>
            {moduleConfig.fields.map(f => {
              const val = record[f.name];
              return (
                <Grid item xs={6} sm={4} md={3} lg={2.4} key={f.name}>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700, fontSize: '9px', letterSpacing: '0.05em' }}>
                    {f.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mt: 0.5 }}>
                    {val === undefined || val === null || val === '' ? (
                      <span style={{ color: '#94A3B8', fontWeight: 400 }}>Not Specified</span>
                    ) : f.type === 'select' ? (
                      <Chip 
                        label={val} 
                        size="small" 
                        sx={{ height: 20, fontSize: '10px', fontWeight: 700 }} 
                      />
                    ) : f.type === 'ref' ? (
                      <EntityTooltip moduleName={f.refModule} id={val}>
                        <Chip 
                          label={val} 
                          size="small" 
                          onClick={() => navigate(`/module/${f.refModule}/${val}`)}
                          sx={{ height: 20, fontSize: '10px', fontWeight: 700, cursor: 'pointer' }} 
                        />
                      </EntityTooltip>
                    ) : f.type === 'multiref' ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {String(val).split(',').filter(Boolean).map(itemId => (
                          <EntityTooltip key={itemId} moduleName={f.refModule} id={itemId}>
                            <Chip 
                              label={itemId} 
                              size="small" 
                              onClick={() => navigate(`/module/${f.refModule}/${itemId}`)}
                              sx={{ height: 20, fontSize: '10px', fontWeight: 700, cursor: 'pointer' }} 
                            />
                          </EntityTooltip>
                        ))}
                      </Box>
                    ) : f.name === 'price' || f.name === 'budget' || f.name === 'salary' ? (
                      `₹${Number(val).toLocaleString('en-IN')}`
                    ) : (
                      String(val)
                    )}
                  </Typography>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* 2. Main content Split */}
      <Grid container spacing={3}>
        
        {/* Left Side: Quick Outreach & Matcher */}
        <Grid item xs={12} md={4}>
          {/* Quick Outreach Card */}
          {(moduleName === 'leads' || moduleName === 'customers') && (
            <Card sx={{ mt: 3, border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: 'rgba(37, 99, 235, 0.01)' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, fontFamily: 'Poppins', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Icons.MessageSquare size={18} style={{ color: '#2563EB' }} />
                  One-Click Outreach
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box display="flex" flexDirection="column" gap={1.5}>
                  <Button
                    variant="outlined"
                    color="success"
                    startIcon={<Icons.MessageCircle size={16} />}
                    href={`https://wa.me/91${record.phone || ''}?text=${encodeURIComponent(compileTemplate(templates.whatsapp, record.name, 'our portfolio properties', '', '', ''))}`}
                    target="_blank"
                    fullWidth
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', justifyContent: 'flex-start', py: 1 }}
                  >
                    WhatsApp Chat
                  </Button>
                  
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<Icons.Mail size={16} />}
                    href={`mailto:${record.email || ''}?subject=${encodeURIComponent(compileTemplate(templates.email_subject, record.name, 'our portfolio properties', '', '', ''))}&body=${encodeURIComponent(compileTemplate(templates.email_body, record.name, 'our portfolio properties', '', '', ''))}`}
                    fullWidth
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', justifyContent: 'flex-start', py: 1 }}
                  >
                    Send Email Message
                  </Button>
                  
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<Icons.Smartphone size={16} />}
                    href={`sms:91${record.phone || ''}?body=${encodeURIComponent(compileTemplate(templates.sms, record.name, 'our portfolio properties', '', '', ''))}`}
                    fullWidth
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', justifyContent: 'flex-start', py: 1 }}
                  >
                    Send Mobile SMS
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Intelligent Property Matcher Engine */}
          {moduleName === 'leads' && (() => {
            const propertiesList = moduleData.properties || [];
            
            // Get lead demands
            const leadRCI = record.r_c_i;
            const leadType = record.propertyType;
            const leadLocality = record.locality;
            const leadSector = record.sector_block;

            // Score properties based on keyword matching
            const matchedProps = propertiesList
              .map(p => {
                let matchCount = 0;
                const matches = [];

                // Compare fields
                if (leadRCI && p.r_c_i && String(leadRCI).toLowerCase() === String(p.r_c_i).toLowerCase()) {
                  matchCount++;
                  matches.push(p.r_c_i);
                }
                if (leadType && p.propertyType && String(leadType).toLowerCase() === String(p.propertyType).toLowerCase()) {
                  matchCount++;
                  matches.push(p.propertyType);
                }
                if (leadLocality && p.locality && String(p.locality).toLowerCase().includes(String(leadLocality).toLowerCase())) {
                  matchCount++;
                  matches.push(p.locality);
                }
                if (leadSector && p.sector_block && String(p.sector_block).toLowerCase().includes(String(leadSector).toLowerCase())) {
                  matchCount++;
                  matches.push(p.sector_block);
                }

                // Check text description / requirements matching
                if (record.requirements) {
                  const reqWords = record.requirements.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                  const searchString = `${p.propertyType || ''} ${p.locality || ''} ${p.sector_block || ''} ${p.facing || ''} ${p.location_type || ''}`.toLowerCase();
                  reqWords.forEach(w => {
                    if (searchString.includes(w)) {
                      matchCount++;
                      matches.push(w);
                    }
                  });
                }

                const score = Math.min(100, matchCount * 25);
                return { ...p, score, matchCount, matches: [...new Set(matches)] };
              })
              .filter(p => p.matchCount > 1) // Only show if more than one keyword matches!
              .sort((a, b) => b.matchCount - a.matchCount)
              .slice(0, 5); // Show top 5 matches

            return (
              <Card sx={{ mt: 3, border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: 'rgba(34, 197, 94, 0.01)' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                    <Icons.Target size={16} />
                    Property Matcher
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {/* Lead Demand Summary Rows */}
                  <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '9px' }}>
                      Client Demand Profile:
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: '10px' }}>R/C/I:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12px' }}>{leadRCI || 'Any'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Property Type:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12px' }}>{leadType || 'Any'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Locality:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12px' }}>{leadLocality || 'Any'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Sector/ Block:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12px' }}>{leadSector || 'Any'}</Typography>
                      </Grid>
                    </Grid>
                  </Box>
                  
                  {matchedProps.length === 0 ? (
                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', textAlign: 'center', py: 2 }}>
                      No matching properties found in database with more than 1 matching keyword.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {matchedProps.map(p => {
                        const propName = p.name || `${p.propertyType || 'Property'} - ${p.locality || ''} ${p.sector_block || ''} (${p.size || ''})`;
                        const propPrice = p.demand || 'Price on Ask';
                        return (
                          <Paper key={p.id} sx={{ p: 1.5, border: '1px solid #E2E8F0', borderRadius: '10px', boxShadow: 'none', '&:hover': { borderColor: '#16A34A' } }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563EB', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => navigate(`/module/properties/${p.id}`)}>
                                {propName}
                              </Typography>
                              <Chip label={`${p.matchCount} Matches`} size="small" color="success" sx={{ fontSize: '9px', height: 18, fontWeight: 700 }} />
                            </Box>
                            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
                              Price: {propPrice} • {p.city || 'Local'}
                            </Typography>
                            
                            {p.matches && p.matches.length > 0 && (
                              <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {p.matches.map((m, mIdx) => (
                                  <Chip key={mIdx} label={m} size="small" variant="outlined" sx={{ fontSize: '8px', height: 14 }} />
                                ))}
                              </Box>
                            )}

                            <Button 
                              size="small" 
                              variant="outlined" 
                              color="success" 
                              startIcon={<Icons.Share2 size={12} />}
                              href={`https://wa.me/91${record.phone || ''}?text=${encodeURIComponent(compileTemplate(templates.whatsapp, record.name, propName, propPrice, p.locality, p.sector_block))}`}
                              target="_blank"
                              sx={{ textTransform: 'none', py: 0.2, fontSize: '10px', fontWeight: 700, borderRadius: '6px' }}
                            >
                              Share on WhatsApp
                            </Button>
                          </Paper>
                        );
                      })}
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </Grid>

        {/* Right Side: Tabbed Salesforce 360 Linked Lists */}
        <Grid item xs={12} md={8}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', minHeight: '560px', display: 'flex', flexDirection: 'column' }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, val) => setActiveTab(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: '1px solid #E2E8F0', px: 2, pt: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}
            >
              {tabs.map((t, idx) => (
                <Tab 
                  key={idx} 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DynamicIcon name={t.icon} size={16} />
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px', textTransform: 'none' }}>
                        {t.label}
                      </Typography>
                    </Box>
                  } 
                />
              ))}
            </Tabs>

            <Box sx={{ p: 3, flexGrow: 1 }}>
              {/* 1. CUSTOMER TABS */}
              {moduleName === 'customers' && (
                <Box>
                  {/* Tab 0: Customer Overview & Remarks */}
                  {activeTab === 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Client Remarks & Feedback Logs</Typography>
                      {/* Remark Post Form */}
                      <Box component="form" onSubmit={handlePostRemark} sx={{ mb: 3 }}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} sm={10}>
                            <TextField 
                              placeholder="Enter call updates, meeting reports, or comments..."
                              fullWidth
                              size="small"
                              value={remarkInput}
                              onChange={(e) => setRemarkInput(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Button type="submit" variant="contained" fullWidth sx={{ py: 1, backgroundColor: '#2563EB' }}>
                              Post Log
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {/* Remarks List */}
                      {connections?.remarks?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No remarks posted yet.</Typography>
                      ) : (
                        connections.remarks.map((rem, idx) => (
                          <Paper key={idx} sx={{ p: 2, mb: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#F8FAFC' }}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{rem.employeeName}</Typography>
                              <Typography variant="caption" sx={{ color: '#94A3B8' }}>{rem.dateTime}</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: '#4B5563', fontStyle: 'italic' }}>"{rem.comment}"</Typography>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 1: Queries */}
                  {activeTab === 1 && (
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'Poppins' }}>Active Property Queries</Typography>
                        <Button 
                          variant="contained" 
                          size="small" 
                          startIcon={<Icons.Plus size={16} />}
                          onClick={() => {
                            setQueryEmployeeId(record.assignedEmployeeId || '');
                            setQueryDialogOpen(true);
                          }}
                        >
                          Quick Log Query
                        </Button>
                      </Box>
                      {connections.queries?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No property queries registered for this client.</Typography>
                      ) : (
                        connections.queries.map(q => (
                          <Paper key={q.id} sx={{ p: 2.5, mb: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip 
                                  label={q.queryType} 
                                  color={q.queryType === 'Sell Property' ? 'success' : 'primary'} 
                                  size="small"
                                  sx={{ fontWeight: 700 }}
                                />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Query ID: {q.id}</Typography>
                              </Box>
                              <Box display="flex" gap={1}>
                                <Chip 
                                  label={q.status} 
                                  color={q.status === 'Approved' ? 'success' : q.status === 'Rejected' ? 'error' : 'warning'}
                                  size="small"
                                  sx={{ fontWeight: 700 }}
                                />
                                <Chip 
                                  label={q.stage} 
                                  variant="outlined"
                                  color="secondary"
                                  size="small"
                                  sx={{ fontWeight: 700 }}
                                />
                              </Box>
                            </Box>
                            <Grid container spacing={2}>
                              <Grid item xs={6} sm={4}>
                                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>R/C/I:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{q.r_c_i || 'Any'}</Typography>
                              </Grid>
                              <Grid item xs={6} sm={4}>
                                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Property Type:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{q.propertyType || 'Any'}</Typography>
                              </Grid>
                              {q.budget && q.budget > 0 ? (
                                <Grid item xs={6} sm={4}>
                                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Budget limit:</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563EB' }}>₹{formatCurrency(q.budget)}</Typography>
                                </Grid>
                              ) : null}
                              {q.demand && q.demand > 0 ? (
                                <Grid item xs={6} sm={4}>
                                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Expected Price:</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#16A34A' }}>₹{formatCurrency(q.demand)}</Typography>
                                </Grid>
                              ) : null}
                              <Grid item xs={12}>
                                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Requirements & Locality:</Typography>
                                <Typography variant="body2">{q.locality} {q.sector_block ? `(Block ${q.sector_block})` : ''} • Size: {q.size || 'Any'} • Remarks: {q.remarks}</Typography>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 2: Deals */}
                  {activeTab === 2 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Deals & Transaction History</Typography>
                      {connections.deals?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No real estate bookings/deals recorded for this client.</Typography>
                      ) : (
                        connections.deals.map(d => {
                          const isBuyer = String(d.customerId) === String(id);
                          return (
                            <Paper key={d.id} sx={{ p: 2.5, mb: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none' }}>
                              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Deal: {d.id}</Typography>
                                <Box display="flex" gap={1}>
                                  <Chip 
                                    label={isBuyer ? 'Buyer Client' : 'Seller Client'} 
                                    color={isBuyer ? 'primary' : 'success'} 
                                    size="small"
                                    sx={{ fontWeight: 700 }}
                                  />
                                  <Chip 
                                    label={d.status} 
                                    color={d.status === 'Closed' ? 'success' : d.status === 'Cancelled' ? 'error' : 'warning'}
                                    size="small"
                                    sx={{ fontWeight: 700 }}
                                  />
                                </Box>
                              </Box>
                              <Grid container spacing={2}>
                                <Grid item xs={6} sm={4}>
                                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Property ID:</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563EB', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/module/properties/${d.propertyId}`)}>
                                    {d.propertyId}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6} sm={4}>
                                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Sale Value:</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{formatCurrency(d.salePrice)}</Typography>
                                </Grid>
                                <Grid item xs={6} sm={4}>
                                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Commission/Brokerage:</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#16A34A' }}>₹{formatCurrency(d.commissionAmount)} ({d.brokeragePercent || 0}%)</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Registry Details:</Typography>
                                  <Typography variant="body2">Date Registered: {d.registrationDate || 'Pending'} • Executed By: {d.employeeId} • Docs Attached: {d.documents || 'None'}</Typography>
                                </Grid>
                              </Grid>
                            </Paper>
                          );
                        })
                      )}
                    </Box>
                  )}

                  {/* Tab 3: Pitches */}
                  {activeTab === 3 && (
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'Poppins' }}>Pitched Properties Logs</Typography>
                        <Button 
                          variant="contained" 
                          size="small" 
                          startIcon={<Icons.Plus size={16} />}
                          onClick={() => {
                            setPitchPropertyId('');
                            setPitchEmployeeId(record.assignedEmployeeId || '');
                            setPitchPrice('');
                            setPitchRemarks('');
                            setPitchWarning('');
                            setPitchDialogOpen(true);
                          }}
                        >
                          Log New Pitch
                        </Button>
                      </Box>
                      {connections.pitches?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No property pitches logged for this client yet.</Typography>
                      ) : (
                        connections.pitches.map(p => (
                          <Paper key={p.id} sx={{ p: 2.5, mb: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563EB', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/module/properties/${p.propertyId}`)}>
                                  Property: {p.propertyId}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748B' }}>({p.id})</Typography>
                              </Box>
                              <Chip 
                                label={p.interestLevel} 
                                color={p.interestLevel === 'Interested' ? 'success' : p.interestLevel === 'Not Interested' ? 'error' : 'warning'} 
                                size="small"
                                sx={{ fontWeight: 700 }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
                              Pitched on: {p.pitchDate} • Method: <strong>{p.pitchMethod}</strong> • Pitched by: {p.employeeName}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Quoted Offer Price: ₹{formatCurrency(p.quotedPrice)}</Typography>
                            <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>Remarks: {p.remarks}</Typography>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 4: Consolidated Timeline */}
                  {activeTab === 4 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Consolidated Activity Timeline</Typography>
                      {connections.timeline?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No activity timeline logs recorded.</Typography>
                      ) : (
                        <Box sx={{ borderLeft: '2px solid #E2E8F0', pl: 3, ml: 1, position: 'relative' }}>
                          {connections.timeline.map((evt, idx) => (
                            <Box key={idx} sx={{ mb: 3, position: 'relative' }}>
                              <Box sx={{ 
                                position: 'absolute', 
                                left: '-35px', 
                                top: '0px', 
                                width: '22px', 
                                height: '22px', 
                                borderRadius: '50%', 
                                backgroundColor: '#FFFFFF', 
                                border: '2px solid #2563EB', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                color: '#2563EB'
                              }}>
                                <DynamicIcon name={evt.icon || 'Circle'} size={12} />
                              </Box>
                              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>{evt.date}</Typography>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', mt: 0.2 }}>{evt.event}</Typography>
                              <Typography variant="body2" sx={{ color: '#475569', fontSize: '13px' }}>{evt.details}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Tab 5: Docs & Files */}
                  {activeTab === 5 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Documents Vault</Typography>
                      {/* Upload Simulator */}
                      <Box component="form" onSubmit={handleUploadDoc} sx={{ mb: 4, p: 2.5, border: '1px dashed #CBD5E1', borderRadius: '12px' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Upload/Attach Document to Client Profile</Typography>
                        
                        <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                          <input type="file" id="direct-file-input" style={{ display: 'none' }} onChange={handleFileChange} />
                          <label htmlFor="direct-file-input">
                            <Button variant="outlined" component="span" startIcon={<Icons.Upload size={16} />} sx={{ textTransform: 'none', fontWeight: 600 }}>
                              Choose Local Document / PDF
                            </Button>
                          </label>
                          {selectedFile && (
                            <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 500 }}>
                              Selected: {selectedFile.name}
                            </Typography>
                          )}
                          {uploadingFile && <CircularProgress size={20} />}
                        </Box>

                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={5}>
                            <TextField 
                              placeholder="Document Title (e.g. Identity Proof, PAN Card)"
                              size="small"
                              fullWidth
                              value={docName}
                              onChange={(e) => setDocName(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={5}>
                            <TextField 
                              placeholder="Direct File URL link"
                              size="small"
                              fullWidth
                              value={docUrl}
                              onChange={(e) => setDocUrl(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Button type="submit" variant="contained" fullWidth sx={{ py: 1, backgroundColor: '#2563EB' }}>
                              Link File
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* Linked Docs List */}
                      {connections.documents?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No files attached yet.</Typography>
                      ) : (
                        connections.documents.map((doc, index) => (
                          <Paper key={index} sx={{ p: 2, mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Icons.FileText size={24} color="#2563EB" />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{doc.name}</Typography>
                                <Typography variant="caption" sx={{ color: '#64748B' }}>Uploaded: {doc.dateAdded} • By: {doc.uploadedBy}</Typography>
                              </Box>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Button variant="outlined" size="small" component="a" href={doc.fileUrl} download sx={{ textTransform: 'none' }}>
                                Download
                              </Button>
                              <IconButton size="small" color="error" onClick={() => handleDeleteDoc(doc.id)}>
                                <Icons.Trash2 size={16} />
                              </IconButton>
                            </Box>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* 2. PROPERTY TABS */}
              {moduleName === 'properties' && (
                <Box>
                  {/* Tab 0: Overview */}
                  {activeTab === 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Property Summary & Remarks</Typography>
                      {/* Remarks Log Section */}
                      <Box component="form" onSubmit={handlePostRemark} sx={{ mb: 3 }}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} sm={10}>
                            <TextField 
                              placeholder="Type property comments or showing updates here..."
                              fullWidth
                              size="small"
                              value={remarkInput}
                              onChange={(e) => setRemarkInput(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Button type="submit" variant="contained" fullWidth sx={{ py: 1, backgroundColor: '#2563EB' }}>
                              Post Log
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {connections?.remarks?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No remarks posted yet.</Typography>
                      ) : (
                        connections.remarks.map((rem, idx) => (
                          <Paper key={idx} sx={{ p: 2, mb: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#F8FAFC' }}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{rem.employeeName}</Typography>
                              <Typography variant="caption" sx={{ color: '#94A3B8' }}>{rem.dateTime}</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: '#4B5563', fontStyle: 'italic' }}>"{rem.comment}"</Typography>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 1: Pitches & Showings */}
                  {activeTab === 1 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Customer Showing Visits & Pitch Logs</Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Showings / Site Visits ({connections.site_visits?.length || 0})</Typography>
                          {connections.site_visits?.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#94A3B8' }}>No site visits registered for this property listing.</Typography>
                          ) : (
                            connections.site_visits.map((sv, idx) => (
                              <Paper key={idx} sx={{ p: 2, mb: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>Client: {sv.customer?.name || sv.customerId}</Typography>
                                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                                  Showed on: {sv.date} • Showed by: {sv.employeeId} • Outcome: <strong>{sv.result}</strong>
                                </Typography>
                              </Paper>
                            ))
                          )}
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Agent Pitches Log ({connections.pitches?.length || 0})</Typography>
                          {connections.pitches?.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#94A3B8' }}>No pitch logs registered for this property listing.</Typography>
                          ) : (
                            connections.pitches.map(p => (
                              <Paper key={p.id} sx={{ p: 2, mb: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>Client: {p.customerName || p.customerId}</Typography>
                                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                                  Pitched on: {p.pitchDate} • Method: {p.pitchMethod} • Offered: <strong>₹{formatCurrency(p.quotedPrice)}</strong>
                                </Typography>
                              </Paper>
                            ))
                          )}
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Tab 2: Owner History */}
                  {activeTab === 2 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Permanent Ownership Registry History</Typography>
                      {connections.ownerHistory?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No previous owners registered in registry logs. This listing is under its first owner.</Typography>
                      ) : (
                        <Box sx={{ borderLeft: '2px solid #E2E8F0', pl: 3, ml: 1 }}>
                          {connections.ownerHistory.map((h, idx) => (
                            <Box key={idx} sx={{ mb: 3, position: 'relative' }}>
                              <Box sx={{ position: 'absolute', left: '-35px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Owner: {h.ownerName} ({h.ownerId})</Typography>
                              <Typography variant="body2" sx={{ color: '#475569' }}>
                                Purchase Date: {h.purchaseDate || 'N/A'} • Bought for: ₹{formatCurrency(h.purchasePrice || 0)}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#EF4444', fontWeight: 600 }}>
                                Sold on: {h.saleDate} for: ₹{formatCurrency(h.salePrice)}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Tab 3: Docs Vault */}
                  {activeTab === 3 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Docs Vault (Property Deeds & NOCs)</Typography>
                      <Box component="form" onSubmit={handleUploadDoc} sx={{ mb: 4, p: 2.5, border: '1px dashed #CBD5E1', borderRadius: '12px' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Upload/Attach Documents to Property Vault</Typography>
                        
                        <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                          <input type="file" id="direct-file-input" style={{ display: 'none' }} onChange={handleFileChange} />
                          <label htmlFor="direct-file-input">
                            <Button variant="outlined" component="span" startIcon={<Icons.Upload size={16} />} sx={{ textTransform: 'none', fontWeight: 600 }}>
                              Choose Local Registry / Layout PDF
                            </Button>
                          </label>
                          {selectedFile && (
                            <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 500 }}>
                              Selected: {selectedFile.name}
                            </Typography>
                          )}
                          {uploadingFile && <CircularProgress size={20} />}
                        </Box>

                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={5}>
                            <TextField 
                              placeholder="Title (e.g. NOC Certificate, Registry Deed)"
                              size="small"
                              fullWidth
                              value={docName}
                              onChange={(e) => setDocName(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={5}>
                            <TextField 
                              placeholder="Direct File URL link"
                              size="small"
                              fullWidth
                              value={docUrl}
                              onChange={(e) => setDocUrl(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Button type="submit" variant="contained" fullWidth sx={{ py: 1, backgroundColor: '#2563EB' }}>
                              Link File
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>

                      <Grid container spacing={2.5}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#10B981' }}>Active Owner Documents</Typography>
                          {connections.documents?.filter(d => !d.id.startsWith('DOC-OLD-'))?.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#94A3B8' }}>No active files attached.</Typography>
                          ) : (
                            connections.documents.filter(d => !d.id.startsWith('DOC-OLD-')).map((doc, index) => (
                              <Paper key={index} sx={{ p: 2, mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{doc.name}</Typography>
                                  <Typography variant="caption" sx={{ color: '#64748B' }}>Uploaded: {doc.dateAdded} • By: {doc.uploadedBy}</Typography>
                                </Box>
                                <Button variant="outlined" size="small" component="a" href={doc.fileUrl} download sx={{ textTransform: 'none' }}>Get</Button>
                              </Paper>
                            ))
                          )}
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#EF4444' }}>Previous Owners Document Archives</Typography>
                          {connections.documents?.filter(d => d.id.startsWith('DOC-OLD-'))?.length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#94A3B8' }}>No archived files found.</Typography>
                          ) : (
                            connections.documents.filter(d => d.id.startsWith('DOC-OLD-')).map((doc, index) => (
                              <Paper key={index} sx={{ p: 2, mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#F8FAFC' }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#64748B' }}>{doc.name}</Typography>
                                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>Deed File Archive (Transferred)</Typography>
                                </Box>
                                <Button variant="outlined" size="small" component="a" href={doc.fileUrl} download sx={{ textTransform: 'none' }}>Get</Button>
                              </Paper>
                            ))
                          )}
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Tab 4: Deals History */}
                  {activeTab === 4 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Deals & Transaction History</Typography>
                      {connections.deals?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No closed/pending deals found for this property.</Typography>
                      ) : (
                        connections.deals.map(d => (
                          <Paper key={d.id} sx={{ p: 2.5, mb: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none' }}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Deal: {d.id}</Typography>
                              <Chip label={d.status} color={d.status === 'Closed' ? 'success' : 'warning'} size="small" sx={{ fontWeight: 700 }} />
                            </Box>
                            <Typography variant="body2">Seller Customer: <strong style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate(`/module/customers/${d.sellerCustomerId}`)}>{d.sellerCustomerId}</strong></Typography>
                            <Typography variant="body2">Buyer Customer: <strong style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate(`/module/customers/${d.customerId}`)}>{d.customerId}</strong></Typography>
                            <Typography variant="body2" sx={{ mt: 1, fontWeight: 700 }}>Price Sold: ₹{formatCurrency(d.salePrice)}</Typography>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 5: Property Activity Timeline */}
                  {activeTab === 5 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Consolidated Property Activity Timeline</Typography>
                      {connections.timeline?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No activity timeline logs recorded.</Typography>
                      ) : (
                        <Box sx={{ borderLeft: '2px solid #E2E8F0', pl: 3, ml: 1, position: 'relative' }}>
                          {connections.timeline.map((evt, idx) => (
                            <Box key={idx} sx={{ mb: 3, position: 'relative' }}>
                              <Box sx={{ position: 'absolute', left: '-35px', top: '0px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '2px solid #2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                                <DynamicIcon name={evt.icon || 'Circle'} size={12} />
                              </Box>
                              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>{evt.date}</Typography>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', mt: 0.2 }}>{evt.event}</Typography>
                              <Typography variant="body2" sx={{ color: '#475569', fontSize: '13px' }}>{evt.details}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* 3. DEALER TABS */}
              {moduleName === 'dealers' && (
                <Box>
                  {/* Tab 0: Overview */}
                  {activeTab === 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Dealer Summary & Comments</Typography>
                      {/* Remarks log */}
                      <Box component="form" onSubmit={handlePostRemark} sx={{ mb: 3 }}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} sm={10}>
                            <TextField 
                              placeholder="Type dealer remarks or brokerage disputes..."
                              fullWidth
                              size="small"
                              value={remarkInput}
                              onChange={(e) => setRemarkInput(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Button type="submit" variant="contained" fullWidth sx={{ py: 1, backgroundColor: '#2563EB' }}>
                              Post Log
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {connections?.remarks?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No remarks posted yet.</Typography>
                      ) : (
                        connections.remarks.map((rem, idx) => (
                          <Paper key={idx} sx={{ p: 2, mb: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#F8FAFC' }}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{rem.employeeName}</Typography>
                              <Typography variant="caption" sx={{ color: '#94A3B8' }}>{rem.dateTime}</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: '#4B5563', fontStyle: 'italic' }}>"{rem.comment}"</Typography>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 1: Outreach Prep & Logs */}
                  {activeTab === 1 && (
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'Poppins' }}>Dealer Meetings & Prepared Prep Sheets</Typography>
                        <Button 
                          variant="contained" 
                          size="small"
                          color="primary"
                          startIcon={<Icons.Plus size={16} />}
                          onClick={() => {
                            if (connections.meetings?.some(m => m.status === 'Assigned')) {
                              const assigned = connections.meetings.find(m => m.status === 'Assigned');
                              setSelectedMeetingId(assigned.id);
                              setMeetingOutcome('');
                              setMeetingDocCollected('');
                              setMeetingReportDialogOpen(true);
                            } else {
                              alert("No pending 'Assigned' meetings found. Admin must assign a meeting to this employee first.");
                            }
                          }}
                        >
                          Submit Meeting Report
                        </Button>
                      </Box>

                      {/* Display meeting prep briefing checklist */}
                      <Alert severity="info" sx={{ mb: 3, borderRadius: '8px' }}>
                        <strong>Employee Prep Briefing:</strong> Review the dealer calls checklist, duration patterns, and budget caps before conducting a physical visit.
                      </Alert>

                      {connections.meetings?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No meetings assigned or completed for this dealer.</Typography>
                      ) : (
                        connections.meetings.map(m => (
                          <Paper key={m.id} sx={{ p: 2.5, mb: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none' }}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Meeting: {m.purpose || 'Dealer Intro'} ({m.id})</Typography>
                              <Chip 
                                label={m.status} 
                                color={m.status === 'Completed' ? 'success' : m.status === 'Cancelled' ? 'error' : 'warning'} 
                                size="small"
                                sx={{ fontWeight: 700 }}
                              />
                            </Box>
                            <Typography variant="body2">RM Assigned: <strong>{m.assignedEmployeeName}</strong></Typography>
                            <Typography variant="body2">Date Scheduled: <strong>{m.meetingDate}</strong> • Priority: {m.priority}</Typography>
                            {m.outcome && (
                              <Box sx={{ mt: 1.5, p: 1.5, backgroundColor: '#F8FAFC', borderRadius: '8px', borderLeft: '3px solid #10B981' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block' }}>VISIT OUTCOME REPORT:</Typography>
                                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>"{m.outcome}"</Typography>
                                {m.documents_collected && (
                                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>Documents Collected: {m.documents_collected}</Typography>
                                )}
                              </Box>
                            )}
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 2: Outreach Calls */}
                  {activeTab === 2 && (
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'Poppins' }}>Dealer Outreach Call Logs</Typography>
                        <Button 
                          variant="contained" 
                          size="small"
                          startIcon={<Icons.Phone size={16} />}
                          onClick={() => {
                            setCallDuration('');
                            setCallBudget('');
                            setCallAreas('');
                            setCallRemarks('');
                            setCallDialogOpen(true);
                          }}
                        >
                          Log Outreach Call
                        </Button>
                      </Box>
                      {connections.calls?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No call logs registered for this dealer.</Typography>
                      ) : (
                        connections.calls.map(c => (
                          <Paper key={c.id} sx={{ p: 2.5, mb: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none' }}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Call Log: {c.id}</Typography>
                              <Typography variant="caption" sx={{ color: '#64748B' }}>Called on: {c.date} • By: {c.employeeName}</Typography>
                            </Box>
                            <Grid container spacing={2}>
                              <Grid item xs={6} sm={4}>
                                <Typography variant="caption" sx={{ display: 'block', color: '#64748B' }}>Call Duration:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.duration || 'N/A'} mins</Typography>
                              </Grid>
                              <Grid item xs={6} sm={4}>
                                <Typography variant="caption" sx={{ display: 'block', color: '#64748B' }}>Budget Cap:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{formatCurrency(c.budget)}</Typography>
                              </Grid>
                              <Grid item xs={12}>
                                <Typography variant="caption" sx={{ display: 'block', color: '#64748B' }}>Areas Discussed:</Typography>
                                <Typography variant="body2">{c.areas || 'All Mohali Sector Block Zones'}</Typography>
                              </Grid>
                              <Grid item xs={12}>
                                <Typography variant="caption" sx={{ display: 'block', color: '#64748B' }}>Remarks/Follow-Up:</Typography>
                                <Typography variant="body2">{c.remarks} {c.followUpDate ? `• Next Call: ${c.followUpDate}` : ''}</Typography>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 3: Dealer activity timeline */}
                  {activeTab === 3 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Poppins' }}>Consolidated Dealer Activity Timeline</Typography>
                      {connections.timeline?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No activity timeline logs recorded.</Typography>
                      ) : (
                        <Box sx={{ borderLeft: '2px solid #E2E8F0', pl: 3, ml: 1, position: 'relative' }}>
                          {connections.timeline.map((evt, idx) => (
                            <Box key={idx} sx={{ mb: 3, position: 'relative' }}>
                              <Box sx={{ position: 'absolute', left: '-35px', top: '0px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '2px solid #2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                                <DynamicIcon name={evt.icon || 'Circle'} size={12} />
                              </Box>
                              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>{evt.date}</Typography>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', mt: 0.2 }}>{evt.event}</Typography>
                              <Typography variant="body2" sx={{ color: '#475569', fontSize: '13px' }}>{evt.details}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* 4. OTHER GENERIC BACKWARD COMPATIBLE TABS */}
              {!(moduleName === 'customers' || moduleName === 'properties' || moduleName === 'dealers') && (
                <Box>
                  {/* Tab 0: 360 Connections */}
                  {activeTab === 0 && (
                    <Box>
                      {connections ? (
                        <Grid container spacing={3}>
                          {moduleName === 'employees' && (
                            <>
                              <Grid item xs={12} sm={6}>
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, fontFamily: 'Poppins' }}>
                                  Assigned Customers ({connections.customers?.length || 0})
                                </Typography>
                                {connections.customers?.length === 0 ? (
                                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>No customers handled.</Typography>
                                ) : (
                                  connections.customers.map(c => (
                                    <Paper key={c.id} sx={{ p: 1.5, mb: 1, border: '1px solid #E2E8F0', boxShadow: 'none', cursor: 'pointer' }} onClick={() => navigate(`/module/customers/${c.id}`)}>
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.name}</Typography>
                                      <Typography variant="caption" sx={{ color: '#64748B' }}>Stage: {c.stage} • Phone: {c.phone}</Typography>
                                    </Paper>
                                  ))
                                )}
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, fontFamily: 'Poppins' }}>
                                  Outstanding Tasks ({connections.tasks?.length || 0})
                                </Typography>
                                {connections.tasks?.length === 0 ? (
                                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>No pending tasks assigned.</Typography>
                                ) : (
                                  connections.tasks.map(t => (
                                    <Paper key={t.id} sx={{ p: 1.5, mb: 1, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{t.title}</Typography>
                                      <Typography variant="caption" sx={{ color: '#64748B' }}>Due: {t.dueDate} • Priority: {t.priority} • Status: {t.status}</Typography>
                                    </Paper>
                                  ))
                                )}
                              </Grid>
                              <Grid item xs={12}>
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, mt: 2, fontFamily: 'Poppins', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Icons.Clock size={18} style={{ color: '#2563EB' }} />
                                  Attendance timing logs ({connections.attendance?.length || 0})
                                </Typography>
                                {!connections.attendance || connections.attendance.length === 0 ? (
                                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>No attendance timing logs found.</Typography>
                                ) : (
                                  <Grid container spacing={2}>
                                    {connections.attendance.map((att, idx) => (
                                      <Grid item xs={12} sm={4} key={idx}>
                                        <Paper sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none' }}>
                                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>{att.date}</Typography>
                                            <Chip label={att.status} size="small" sx={{ backgroundColor: att.status === 'Present' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: att.status === 'Present' ? '#22C55E' : '#EF4444', fontWeight: 700, fontSize: '10px' }} />
                                          </Box>
                                          <Typography variant="body2">In: <strong>{att.inTime}</strong></Typography>
                                          <Typography variant="body2">Out: <strong>{att.outTime || '---'}</strong></Typography>
                                        </Paper>
                                      </Grid>
                                    ))}
                                  </Grid>
                                )}
                              </Grid>
                              <Grid item xs={12}>
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, mt: 2, fontFamily: 'Poppins', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Icons.DollarSign size={18} style={{ color: '#16A34A' }} />
                                  Salary Settlement Slips ({connections.salaries?.length || 0})
                                </Typography>
                                {!connections.salaries || connections.salaries.length === 0 ? (
                                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>No salaries settled.</Typography>
                                ) : (
                                  <Grid container spacing={2}>
                                    {connections.salaries.map((sal, idx) => (
                                      <Grid item xs={12} sm={4} key={idx}>
                                        <Paper sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none' }}>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{sal.month}/{sal.year}</Typography>
                                          <Typography variant="body2" sx={{ mb: 1 }}>Net Pay: ₹{formatCurrency(sal.netPay)}</Typography>
                                          <Button variant="outlined" size="small" fullWidth onClick={() => setActiveSalarySlip(sal)}>View Slip</Button>
                                        </Paper>
                                      </Grid>
                                    ))}
                                  </Grid>
                                )}
                              </Grid>
                            </>
                          )}
                        </Grid>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>Loading...</Typography>
                      )}
                    </Box>
                  )}

                  {/* Tab 1: Remarks */}
                  {activeTab === 1 && (
                    <Box>
                      <Box component="form" onSubmit={handlePostRemark} sx={{ mb: 4 }}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} sm={10}>
                            <TextField 
                              placeholder="Type comment remarks here..."
                              fullWidth
                              size="small"
                              value={remarkInput}
                              onChange={(e) => setRemarkInput(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Button type="submit" variant="contained" fullWidth sx={{ py: 1, backgroundColor: '#2563EB' }}>
                              Post Log
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {connections?.remarks?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No remarks posted yet.</Typography>
                      ) : (
                        connections.remarks.map((rem, idx) => (
                          <Paper key={idx} sx={{ p: 2, mb: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#F8FAFC' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{rem.employeeName}</Typography>
                            <Typography variant="body2" sx={{ color: '#4B5563', fontStyle: 'italic' }}>"{rem.comment}"</Typography>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 2: Docs */}
                  {activeTab === 2 && (
                    <Box>
                      <Box component="form" onSubmit={handleUploadDoc} sx={{ mb: 4, p: 2, border: '1px dashed #CBD5E1', borderRadius: '12px' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Attach PDF / Document Details</Typography>
                        
                        <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                          <input type="file" id="direct-file-input" style={{ display: 'none' }} onChange={handleFileChange} />
                          <label htmlFor="direct-file-input">
                            <Button variant="outlined" component="span" startIcon={<Icons.Upload size={16} />} sx={{ textTransform: 'none', fontWeight: 600 }}>
                              Choose Local File
                            </Button>
                          </label>
                          {selectedFile && (
                            <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 500 }}>
                              Selected: {selectedFile.name}
                            </Typography>
                          )}
                          {uploadingFile && <CircularProgress size={20} />}
                        </Box>

                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={5}>
                            <TextField 
                              placeholder="Document Title"
                              size="small"
                              fullWidth
                              value={docName}
                              onChange={(e) => setDocName(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={5}>
                            <TextField 
                              placeholder="File URL or Link"
                              size="small"
                              fullWidth
                              value={docUrl}
                              onChange={(e) => setDocUrl(e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Button type="submit" variant="contained" fullWidth sx={{ py: 1, backgroundColor: '#2563EB' }}>
                              Link File
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>

                      {connections.documents?.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No files attached yet.</Typography>
                      ) : (
                        connections.documents.map((doc, index) => (
                          <Paper key={index} sx={{ p: 2, mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Icons.FileText size={24} color="#2563EB" />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{doc.name}</Typography>
                                <Typography variant="caption" sx={{ color: '#64748B' }}>Uploaded: {doc.dateAdded} • By: {doc.uploadedBy}</Typography>
                              </Box>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Button variant="outlined" size="small" component="a" href={doc.fileUrl} download sx={{ textTransform: 'none' }}>Download</Button>
                              <IconButton size="small" color="error" onClick={() => handleDeleteDoc(doc.id)}>
                                <Icons.Trash2 size={16} />
                              </IconButton>
                            </Box>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {/* Tab 3: Odometer */}
                  {activeTab === 3 && moduleName === 'employees' && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Bike Odometer & Travel History Log</Typography>
                      {travelLogs.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>No odometer readings captured.</Typography>
                      ) : (
                        <Box display="flex" flexDirection="column" gap={2}>
                          {travelLogs.map((log, index) => {
                            const netKm = Math.max(0, (Number(log.odometerEnd) || 0) - (Number(log.odometerStart) || 0) - (Number(log.personalUseKm) || 0));
                            const dailyAllowance = netKm * 3;
                            return (
                              <Paper key={index} sx={{ p: 3, border: '1px solid #E2E8F0', boxShadow: 'none', borderRadius: '12px' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{log.date} ({netKm} KM Driven)</Typography>
                                <Typography variant="body2">Punch In: <strong>{log.inTime}</strong> (Start: {log.odometerStart} KM)</Typography>
                                <Typography variant="body2">Punch Out: <strong>{log.outTime || '---'}</strong> (End: {log.odometerEnd || '---'} KM)</Typography>
                                <Typography variant="body2" sx={{ color: '#16A34A', mt: 1 }}>Daily Travel Allowance: ₹{dailyAllowance.toLocaleString('en-IN')} (at ₹3/KM)</Typography>
                              </Paper>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Route Map Modal Dialog */}
      <Dialog 
        open={mapOpen} 
        onClose={() => setMapOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontFamily: 'Poppins' }}>
          Shift Route Map - {activeMapShift?.date}
          <IconButton size="small" onClick={() => setMapOpen(false)}>
            <Icons.X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box 
            id="route-map-container" 
            sx={{ 
              width: '100%', 
              height: '500px', 
              backgroundColor: '#F1F5F9' 
            }} 
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMapOpen(false)} variant="contained">
            Close Map
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Photo/File upload permission dialog */}
      <Dialog 
        open={permissionDialogOpen} 
        onClose={() => setPermissionDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '18px', fontFamily: 'Poppins' }}>
          File Upload Permission
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Gagan Realtech CRM wishes to access files and photos from your device to directly upload documents and screenshots to this record. Do you allow access?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPermissionDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>
            Don't Allow
          </Button>
          <Button onClick={handleGrantPermissionAndUpload} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '6px' }}>
            Allow & Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Salary Slip Detail View Dialog */}
      <Dialog 
        open={Boolean(activeSalarySlip)} 
        onClose={() => setActiveSalarySlip(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontFamily: 'Poppins' }}>
          Salary payslip slip detail view
          <IconButton size="small" onClick={() => setActiveSalarySlip(null)}>
            <Icons.X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {activeSalarySlip && (
            <Box>
              {/* Print View Wrapper */}
              <Box id="printable-salary-slip-view" sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} borderBottom="2px solid #0F172A" pb={2}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>GAGAN REALTECH</Typography>
                    <Typography variant="caption" color="textSecondary">Corporate Real Estate & CRM Solutions Hub</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748B' }}>SALARY PAYSLIP SLIP</Typography>
                    <Typography variant="body2">Month: {activeSalarySlip.month}/{activeSalarySlip.year}</Typography>
                  </Box>
                </Box>

                <Grid container spacing={2} sx={{ mb: 3, backgroundColor: '#F8FAFC', p: 2, borderRadius: '8px' }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary">Employee Details</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{record?.name}</Typography>
                    <Typography variant="body2">ID: {record?.id}</Typography>
                    <Typography variant="body2">Designation: {record?.designation || 'Real Estate Officer'}</Typography>
                  </Grid>
                  <Grid item xs={6} style={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="textSecondary">Settlement Details</Typography>
                    <Typography variant="body2">Date Issued: {activeSalarySlip.generatedDate || '---'}</Typography>
                    <Typography variant="body2">Status: <strong>{activeSalarySlip.status || 'Draft'}</strong></Typography>
                    <Typography variant="body2">ID: {activeSalarySlip.id}</Typography>
                  </Grid>
                </Grid>

                <Grid container spacing={4} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block', borderBottom: '1px solid #E2E8F0', pb: 0.5 }}>EARNINGS</Typography>
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Daily Payout Rate (Salary/30)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{formatCurrency(activeSalarySlip.dailyRate || (activeSalarySlip.baseSalary / 30))}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Paid Days: Full Work</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{activeSalarySlip.presentDays} Days</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Paid Days: Half Work (0.5x)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{activeSalarySlip.halfDays * 0.5} Days</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Paid Days: Paid Leaves</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{activeSalarySlip.paidLeavesUsed || 0} Days</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Paid Days: Weekly Offs (Sundays)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{activeSalarySlip.earnedDays === 0 ? 0 : 4} Days</Typography>
                    </Box>
                    {activeSalarySlip.extraDays > 0 && (
                      <Box display="flex" justifyContent="space-between" py={0.5}>
                        <Typography variant="body2">Paid Days: Extra Work</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{activeSalarySlip.extraDays} Days</Typography>
                      </Box>
                    )}
                    {(() => {
                      const earnedDaysVal = activeSalarySlip.earnedDays !== undefined ? activeSalarySlip.earnedDays : (
                        (activeSalarySlip.presentDays === 0 && activeSalarySlip.halfDays === 0 && (activeSalarySlip.paidLeavesUsed || 0) === 0 && (activeSalarySlip.extraDays || 0) === 0)
                          ? 0
                          : (activeSalarySlip.presentDays + activeSalarySlip.halfDays*0.5 + (activeSalarySlip.paidLeavesUsed || 0) + (activeSalarySlip.extraDays || 0) + 4)
                      );
                      const earnedSalaryVal = activeSalarySlip.earnedSalary !== undefined ? activeSalarySlip.earnedSalary : (
                        earnedDaysVal * (activeSalarySlip.dailyRate || (activeSalarySlip.baseSalary / 30))
                      );
                      return (
                        <Box display="flex" justifyContent="space-between" py={0.5} sx={{ borderTop: '1px dashed #CBD5E1', mt: 0.5, pt: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>Total Earned Salary ({earnedDaysVal} days)</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>₹{formatCurrency(earnedSalaryVal)}</Typography>
                        </Box>
                      );
                    })()}
                    
                    {activeSalarySlip.allowancesJson && (
                      (() => {
                        try {
                          const allows = JSON.parse(activeSalarySlip.allowancesJson);
                          return allows.map((a, i) => (
                            <Box display="flex" justifyContent="space-between" py={0.5} key={i}>
                              <Typography variant="body2">{a.name} (Allowance)</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{formatCurrency(a.amount)}</Typography>
                            </Box>
                          ));
                        } catch (e) { return null; }
                      })()
                    )}
                    {activeSalarySlip.expensesJson && (
                      (() => {
                        try {
                          const exps = JSON.parse(activeSalarySlip.expensesJson);
                          return exps.map((e, i) => (
                            <Box display="flex" justifyContent="space-between" py={0.5} key={i}>
                              <Typography variant="body2">{e.name} (Reimbursement)</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{formatCurrency(e.amount)}</Typography>
                            </Box>
                          ));
                        } catch (e) { return null; }
                      })()
                    )}
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Travel Allowance ({activeSalarySlip.totalKmDriven || 0} KM @ ₹{activeSalarySlip.payPerKm || 3}/KM)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>+ ₹{formatCurrency(activeSalarySlip.travelAllowance || 0)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block', borderBottom: '1px solid #E2E8F0', pb: 0.5 }}>DEDUCTIONS</Typography>
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Unpaid Leaves ({Math.max(0, (activeSalarySlip.leaveDays || 0) - 4)} days)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#EF4444' }}>Deducted from Earned Days</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Absent Days ({activeSalarySlip.absentDays || 0} days)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#EF4444' }}>Deducted from Earned Days</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" py={0.5}>
                      <Typography variant="body2">Advance Recovery</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{formatCurrency(activeSalarySlip.advanceRecovery)}</Typography>
                    </Box>

                    {activeSalarySlip.deductionsJson && (
                      (() => {
                        try {
                          const deds = JSON.parse(activeSalarySlip.deductionsJson);
                          return deds.map((d, i) => (
                            <Box display="flex" justifyContent="space-between" py={0.5} key={i}>
                              <Typography variant="body2">{d.name}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{formatCurrency(d.amount)}</Typography>
                            </Box>
                          ));
                        } catch (e) { return null; }
                      })()
                    )}
                  </Grid>
                </Grid>

                <Box sx={{ p: 2, border: '2px solid #0F172A', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>NET PAYABLE SETTLEMENT</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 850 }}>₹{formatCurrency(activeSalarySlip.netPay)}</Typography>
                </Box>

                {activeSalarySlip.attendanceJson && (() => {
                  try {
                    const parsedLogs = JSON.parse(activeSalarySlip.attendanceJson);
                    return (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, borderBottom: '1px solid #E2E8F0', pb: 0.5, textTransform: 'uppercase', fontSize: '11px' }}>
                          DAILY ATTENDANCE & IN-OUT DETAILS
                        </Typography>
                        <TableContainer component={Box} sx={{ mb: 4, border: '1px solid #E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                          <Table size="small">
                            <TableHead sx={{ backgroundColor: '#F8FAFC' }}>
                              <TableRow>
                                <TableCell sx={{ py: 0.5, fontSize: '9px', fontWeight: 700 }}>Date</TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: '9px', fontWeight: 700 }}>In Time</TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: '9px', fontWeight: 700 }}>Out Time</TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: '9px', fontWeight: 700 }}>Hours</TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: '9px', fontWeight: 700 }}>Status</TableCell>
                                <TableCell sx={{ py: 0.5, fontSize: '9px', fontWeight: 700 }}>Remarks</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {parsedLogs.map((log, idx) => (
                                <React.Fragment key={idx}>
                                  <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#F8FAFC' } }}>
                                    <TableCell sx={{ py: 0.2, fontSize: '9px' }}>{log.date} ({log.day})</TableCell>
                                    <TableCell sx={{ py: 0.2, fontSize: '9px' }}>{log.checkIn}</TableCell>
                                    <TableCell sx={{ py: 0.2, fontSize: '9px' }}>{log.checkOut}</TableCell>
                                    <TableCell sx={{ py: 0.2, fontSize: '9px' }}>{log.hours}</TableCell>
                                    <TableCell sx={{ py: 0.2, fontSize: '9px', fontWeight: log.status === 'Half Day' || log.status === 'Absent' ? 700 : 400, color: log.status === 'Half Day' ? '#F59E0B' : log.status === 'Absent' ? '#EF4444' : '#0F172A' }}>
                                      {log.status}
                                    </TableCell>
                                    <TableCell sx={{ py: 0.2, fontSize: '9px', color: '#64748B' }}>{log.remarks}</TableCell>
                                  </TableRow>
                                  {(log.odometerStart !== undefined || log.odometerEnd !== undefined) && (
                                    <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                                      <TableCell colSpan={6} sx={{ py: 0.3, pl: 2, fontSize: '9px', color: '#475569' }}>
                                        🏍️ Bike Odometer: Start: <strong>{log.odometerStart || 0} KM</strong>
                                        {log.odometerEnd ? ` | End: ${log.odometerEnd} KM` : ''}
                                        {log.personalUseKm ? ` | Personal Use: ${log.personalUseKm} KM` : ''}
                                        {log.netKm !== undefined ? ` | Final Reading: ${log.netKm} KM` : ''}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    );
                  } catch (e) { return null; }
                })()}

                {/* Signatures placeholders inside printable slip view */}
                <Box display="flex" justifyContent="space-between" mt={8} pt={4} borderTop="1px dashed #64748B">
                  <Box textAlign="center" width="25%">
                    <Box sx={{ height: 40 }} />
                    <Divider sx={{ mb: 1, borderColor: '#0F172A' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Employee Signature</Typography>
                  </Box>
                  <Box textAlign="center" width="25%">
                    <Box sx={{ height: 40 }} />
                    <Divider sx={{ mb: 1, borderColor: '#0F172A' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>HR Manager Signature</Typography>
                  </Box>
                  <Box textAlign="center" width="25%">
                    <Box sx={{ height: 40 }} />
                    <Divider sx={{ mb: 1, borderColor: '#0F172A' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Authorised Signature</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setActiveSalarySlip(null)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Icons.Printer size={16} />}
            onClick={() => {
              const originalContent = document.body.innerHTML;
              const printContent = document.getElementById("printable-salary-slip-view").innerHTML;
              document.body.innerHTML = printContent;
              window.print();
              document.body.innerHTML = originalContent;
              window.location.reload();
            }}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Print Payslip
          </Button>
        </DialogActions>
      </Dialog>

      {/* 5. ERP POPUP DIALOGS */}

      {/* Quick Log Query Dialog */}
      <Dialog open={queryDialogOpen} onClose={() => setQueryDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Poppins' }}>Quick Log Property Query</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
            <FormControl fullWidth>
              <InputLabel>RM Assigned</InputLabel>
              <Select value={queryEmployeeId} onChange={(e) => setQueryEmployeeId(e.target.value)} label="RM Assigned">
                {(moduleData.employees || []).map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>{emp.name} ({emp.id})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Query Action Type</InputLabel>
              <Select value={queryType} onChange={(e) => setQueryType(e.target.value)} label="Query Action Type">
                <MenuItem value="Buy Property">Buy Property (Demand Request)</MenuItem>
                <MenuItem value="Sell Property">Sell Property (Inventory Supply)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>R/C/I Segment</InputLabel>
              <Select value={queryRCI} onChange={(e) => setQueryRCI(e.target.value)} label="R/C/I Segment">
                <MenuItem value="Residential">Residential</MenuItem>
                <MenuItem value="Commercial">Commercial</MenuItem>
                <MenuItem value="Industrial">Industrial</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Property Type Category</InputLabel>
              <Select value={queryPropType} onChange={(e) => setQueryPropType(e.target.value)} label="Property Type Category">
                <MenuItem value="Villa">Villa Listing</MenuItem>
                <MenuItem value="Plot">Residential Plot</MenuItem>
                <MenuItem value="Apartment">Apartment Flat</MenuItem>
                <MenuItem value="Commercial">Retail Office Space</MenuItem>
              </Select>
            </FormControl>
            {queryType === 'Buy Property' ? (
              <TextField label="Client Budget Cap (INR)" type="number" fullWidth value={queryBudget} onChange={(e) => setQueryBudget(e.target.value)} />
            ) : (
              <TextField label="Seller Demanded Price (INR)" type="number" fullWidth value={queryDemand} onChange={(e) => setQueryDemand(e.target.value)} />
            )}
            <TextField label="Target Size/Dimensions (e.g. 250 Sq.Yds)" fullWidth value={querySize} onChange={(e) => setQuerySize(e.target.value)} />
            <TextField label="Preferred Localities" fullWidth value={queryLocality} onChange={(e) => setQueryLocality(e.target.value)} />
            <TextField label="Sector/Block Details" fullWidth value={querySector} onChange={(e) => setQuerySector(e.target.value)} />
            <TextField label="Requirements Remarks" multiline rows={3} fullWidth value={queryRemarks} onChange={(e) => setQueryRemarks(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setQueryDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }} onClick={async () => {
            const payload = {
              customerId: id,
              assignedEmployeeId: queryEmployeeId || 'EMP-001',
              date: new Date().toLocaleDateString('en-IN'),
              status: 'Pending Approval',
              queryType,
              stage: 'New Query',
              budget: queryType === 'Buy Property' ? Number(queryBudget) : 0,
              demand: queryType === 'Sell Property' ? Number(queryDemand) : 0,
              r_c_i: queryRCI,
              propertyType: queryPropType,
              locality: queryLocality,
              sector_block: querySector,
              size: querySize,
              remarks: queryRemarks
            };
            const res = await createRecord('queries', payload);
            if (res.success) {
              setQueryDialogOpen(false);
              loadData();
            } else {
              alert(res.message || "Failed to create query");
            }
          }}>Submit Query</Button>
        </DialogActions>
      </Dialog>

      {/* Log Pitch Dialog */}
      <Dialog open={pitchDialogOpen} onClose={() => setPitchDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Poppins' }}>Log Agent Pitch Presentation</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
            {pitchWarning && (
              <Alert severity="warning" sx={{ borderRadius: '8px', fontWeight: 600 }}>
                {pitchWarning}
              </Alert>
            )}
            <FormControl fullWidth>
              <InputLabel>Select Property</InputLabel>
              <Select value={pitchPropertyId} onChange={(e) => setPitchPropertyId(e.target.value)} label="Select Property">
                {(moduleData.properties || []).map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.propertyType} - {p.locality} Sector {p.sector_block} ({p.id})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Pitching Employee/RM</InputLabel>
              <Select value={pitchEmployeeId} onChange={(e) => setPitchEmployeeId(e.target.value)} label="Pitching Employee/RM">
                {(moduleData.employees || []).map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>{emp.name} ({emp.id})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Outreach Pitch Method</InputLabel>
              <Select value={pitchMethod} onChange={(e) => setPitchMethod(e.target.value)} label="Outreach Pitch Method">
                <MenuItem value="Call">Phone Call</MenuItem>
                <MenuItem value="WhatsApp">WhatsApp Message</MenuItem>
                <MenuItem value="Office Visit">Office Meeting</MenuItem>
                <MenuItem value="Site Visit">Physical Site Visit</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Interest Level Outcome</InputLabel>
              <Select value={pitchInterest} onChange={(e) => setPitchInterest(e.target.value)} label="Interest Level Outcome">
                <MenuItem value="Interested">Highly Interested</MenuItem>
                <MenuItem value="Follow-up Required">Follow-up Needed</MenuItem>
                <MenuItem value="Hold">On Hold</MenuItem>
                <MenuItem value="Not Interested">Not Interested</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Quoted Pitch Price Offer" type="number" fullWidth value={pitchPrice} onChange={(e) => setPitchPrice(e.target.value)} />
            <TextField label="Next Followup Date" type="date" InputLabelProps={{ shrink: true }} fullWidth value={pitchFollowUp} onChange={(e) => setPitchFollowUp(e.target.value)} />
            <TextField label="Meeting Remarks" multiline rows={3} fullWidth value={pitchRemarks} onChange={(e) => setPitchRemarks(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setPitchDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }} onClick={async () => {
            const payload = {
              customerId: id,
              customerName: record.name,
              propertyId: pitchPropertyId,
              employeeId: pitchEmployeeId,
              employeeName: (moduleData.employees || []).find(e => e.id === pitchEmployeeId)?.name || pitchEmployeeId,
              pitchMethod,
              interestLevel: pitchInterest,
              quotedPrice: Number(pitchPrice || 0),
              followUpDate: pitchFollowUp,
              remarks: pitchRemarks,
              pitchDate: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN')
            };
            const res = await createRecord('property_pitch_history', payload);
            if (res.success) {
              setPitchDialogOpen(false);
              loadData();
            } else {
              alert(res.message || "Failed to log pitch");
            }
          }}>Log Pitch</Button>
        </DialogActions>
      </Dialog>

      {/* Log Outreach Call Dialog */}
      <Dialog open={callDialogOpen} onClose={() => setCallDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Poppins' }}>Log Outreach Phone Call</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
            <TextField label="Call Duration (minutes)" type="number" fullWidth value={callDuration} onChange={(e) => setCallDuration(e.target.value)} />
            <TextField label="Discussed Budget expectation" type="number" fullWidth value={callBudget} onChange={(e) => setCallBudget(e.target.value)} />
            <TextField label="Discussed Sectors/Areas" fullWidth value={callAreas} onChange={(e) => setCallAreas(e.target.value)} />
            <TextField label="Next Followup Date" type="date" InputLabelProps={{ shrink: true }} fullWidth value={callFollowUp} onChange={(e) => setCallFollowUp(e.target.value)} />
            <TextField label="Call Notes/Remarks" multiline rows={3} fullWidth value={callRemarks} onChange={(e) => setCallRemarks(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setCallDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }} onClick={async () => {
            const payload = {
              dealerId: id,
              employeeName: localStorage.getItem('gr_crm_user_name') || 'Sales Representative',
              date: new Date().toLocaleDateString('en-IN'),
              duration: callDuration,
              budget: Number(callBudget || 0),
              areas: callAreas,
              followUpDate: callFollowUp,
              remarks: callRemarks
            };
            const res = await createRecord('dealer_calls', payload);
            if (res.success) {
              setCallDialogOpen(false);
              loadData();
            } else {
              alert(res.message || "Failed to log outreach call");
            }
          }}>Log Call</Button>
        </DialogActions>
      </Dialog>

      {/* Submit Meeting Report Dialog */}
      <Dialog open={meetingReportDialogOpen} onClose={() => setMeetingReportDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Poppins' }}>Log Meeting Visit Report</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
            <FormControl fullWidth>
              <InputLabel>Select Meeting</InputLabel>
              <Select value={selectedMeetingId} onChange={(e) => setSelectedMeetingId(e.target.value)} label="Select Meeting">
                {(connections?.meetings || []).filter(m => m.status === 'Assigned').map(m => (
                  <MenuItem key={m.id} value={m.id}>{m.purpose || 'Intro Meeting'} ({m.id})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Visit Outcomes & Notes" multiline rows={3} fullWidth value={meetingOutcome} onChange={(e) => setMeetingOutcome(e.target.value)} />
            <TextField label="Documents Collected from Dealer" fullWidth value={meetingDocCollected} onChange={(e) => setMeetingDocCollected(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setMeetingReportDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }} onClick={async () => {
            if (!selectedMeetingId) {
              alert("Please select a meeting to report on");
              return;
            }
            const meetingRec = connections.meetings.find(m => m.id === selectedMeetingId);
            if (!meetingRec) return;

            const payload = {
              ...meetingRec,
              status: 'Completed',
              outcome: meetingOutcome,
              documents_collected: meetingDocCollected,
              last_updated: new Date().toLocaleString('en-IN')
            };
            
            const res = await axios.put(`${API_BASE_URL}/data/dealer_meetings/${selectedMeetingId}`, payload, {
              headers: { Authorization: `Bearer ${localStorage.getItem('gr_crm_token')}` }
            });
            if (res.data) {
              setMeetingReportDialogOpen(false);
              loadData();
            } else {
              alert("Failed to submit meeting report");
            }
          }}>Submit Visit Report</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default EntityDetail;
