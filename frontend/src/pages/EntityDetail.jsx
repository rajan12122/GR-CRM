import React, { useEffect, useState } from 'react';
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
  Tooltip
} from '@mui/material';
import * as Icons from 'lucide-react';
import { useApp, API_BASE_URL } from '../context/AppContext';
import EntityTooltip from '../components/EntityTooltip';

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
    loadingData 
  } = useApp();

  const [record, setRecord] = useState(null);
  const [connections, setConnections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

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

      {/* Main content Split */}
      <Grid container spacing={3}>
        
        {/* Left Side: General Profile Card details */}
        <Grid item xs={12} md={4}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', mb: 3, fontFamily: 'Poppins' }}>
                Profile Fields
              </Typography>
              
              <List disablePadding>
                {moduleConfig.fields.map(f => {
                  const val = record[f.name];
                  return (
                    <Box key={f.name} sx={{ mb: 2.5 }}>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700, fontSize: '10px' }}>
                        {f.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mt: 0.5 }}>
                        {val === undefined || val === null ? (
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
                    </Box>
                  );
                })}
              </List>
             </CardContent>
          </Card>

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
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px', minHeight: '500px' }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, val) => setActiveTab(val)}
              variant="scrollable"
              sx={{ borderBottom: '1px solid #E2E8F0', px: 2, pt: 1 }}
            >
              <Tab label="Salesforce 360° Connections" sx={{ fontWeight: 600 }} />
              <Tab label={`Remarks History (${connections?.remarks?.length || 0})`} sx={{ fontWeight: 600 }} />
              <Tab label={`Documents/Files (${connections?.documents?.length || 0})`} sx={{ fontWeight: 600 }} />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {/* TAB 1: 360° Connected lists */}
              {activeTab === 0 && (
                <Box>
                  {connections ? (
                    <Box>
                      {/* CUSTOMER 360 VIEW */}
                      {moduleName === 'customers' && (
                        <Grid container spacing={3}>
                          <Grid item xs={12}>
                            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, fontFamily: 'Poppins' }}>
                              Sales Representative / RM Details
                            </Typography>
                            {connections.employee ? (
                              <Paper sx={{ p: 2, border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#F8FAFC' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{connections.employee.name}</Typography>
                                <Typography variant="caption" sx={{ color: '#64748B' }}>Email: {connections.employee.email} • Phone: {connections.employee.phone}</Typography>
                              </Paper>
                            ) : (
                              <Typography variant="body2" sx={{ color: '#94A3B8' }}>No RM Assigned.</Typography>
                            )}
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, fontFamily: 'Poppins' }}>
                              Site Visits History ({connections.site_visits?.length || 0})
                            </Typography>
                            {connections.site_visits?.length === 0 ? (
                              <Typography variant="body2" sx={{ color: '#94A3B8' }}>No site visits logged for this customer.</Typography>
                            ) : (
                              connections.site_visits.map(sv => (
                                <Paper key={sv.id} sx={{ p: 2, mb: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Property: {sv.property?.name || sv.propertyId}</Typography>
                                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Date: {sv.date} • Result Outcome: <strong>{sv.result}</strong></Typography>
                                </Paper>
                              ))
                            )}
                          </Grid>
                        </Grid>
                      )}

                      {/* PROPERTY 360 VIEW */}
                      {moduleName === 'properties' && (
                        <Grid container spacing={3}>
                          <Grid item xs={12}>
                            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, fontFamily: 'Poppins' }}>
                              Listing Property View Counter
                            </Typography>
                            <Paper sx={{ p: 2.5, backgroundColor: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.2)', boxShadow: 'none', mb: 3 }}>
                              <Typography variant="h3" sx={{ fontWeight: 800, color: '#2563EB', fontFamily: 'Poppins' }}>
                                {connections.viewsCount} Customer Showings
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748B' }}>
                                Auto-generated view count tracking site-visit logs.
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '16px', mb: 2, fontFamily: 'Poppins' }}>
                              Showing Customers History
                            </Typography>
                            {connections.viewsCount === 0 ? (
                              <Typography variant="body2" sx={{ color: '#94A3B8' }}>No showings registered.</Typography>
                            ) : (
                              connections.site_visits.map((sv, index) => (
                                <Paper key={index} sx={{ p: 2, mb: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Client: {sv.customer?.name || sv.customerId}</Typography>
                                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                                    Visit Date: {sv.date} • RM Showed: <EntityTooltip moduleName="employees" id={sv.employeeId}><strong style={{ borderBottom: '1px dotted #94A3B8', cursor: 'help' }}>{sv.employeeId}</strong></EntityTooltip> • Outcome: <strong>{sv.result}</strong>
                                  </Typography>
                                </Paper>
                              ))
                            )}
                          </Grid>
                        </Grid>
                      )}

                      {/* EMPLOYEE 360 VIEW */}
                      {moduleName === 'employees' && (
                        <Grid container spacing={3}>
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
                              <Icons.MapPin size={18} style={{ color: '#EF4444' }} />
                              Location Tracking Shift History
                            </Typography>
                            {!record.locationHistory || record.locationHistory.length === 0 ? (
                              <Typography variant="body2" sx={{ color: '#94A3B8' }}>No completed location tracking shifts found.</Typography>
                            ) : (
                              <Grid container spacing={2}>
                                {record.locationHistory.map((hist, idx) => (
                                  <Grid item xs={12} sm={6} key={idx}>
                                    <Paper sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none', backgroundColor: '#F8FAFC' }}>
                                      <Box display="flex" justifyContent="space-between" mb={1}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                                          Shift Date: {hist.date}
                                        </Typography>
                                        <Chip label={`${hist.totalKilometers || 0} km`} color="primary" size="small" sx={{ fontWeight: 700, fontSize: '10px' }} />
                                      </Box>
                                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
                                        Registered coordinates: {hist.path?.length || 0} points
                                      </Typography>
                                      {hist.path && hist.path.length > 0 && (
                                        <Box>
                                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F172A', display: 'block', mb: 0.5 }}>
                                            Route Points (Chronological):
                                          </Typography>
                                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 80, overflowY: 'auto' }}>
                                            {hist.path.map((p, pIdx) => (
                                              <Chip 
                                                key={pIdx} 
                                                label={`${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`} 
                                                size="small" 
                                                variant="outlined"
                                                sx={{ fontSize: '8px', height: 16 }} 
                                              />
                                            ))}
                                          </Box>
                                        </Box>
                                      )}
                                    </Paper>
                                  </Grid>
                                ))}
                              </Grid>
                            )}
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>This module does not support complex 360 relationship resolution.</Typography>
                  )}
                </Box>
              )}

              {/* TAB 2: Remarks System */}
              {activeTab === 1 && (
                <Box>
                  {/* Create Remark Form */}
                  <Box component="form" onSubmit={handlePostRemark} sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Write Remark Comment</Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={10}>
                        <TextField 
                          placeholder="Type customer call updates, meeting feedback, builder registry issues, etc. (Remarks cannot be modified after posting)"
                          fullWidth
                          size="small"
                          value={remarkInput}
                          onChange={(e) => setRemarkInput(e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Button type="submit" variant="contained" fullWidth sx={{ py: 1, backgroundColor: '#2563EB' }}>
                          Post
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Remarks History */}
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Remarks History Log</Typography>
                  {connections?.remarks?.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>No remarks posted yet.</Typography>
                  ) : (
                    <List disablePadding>
                      {connections?.remarks?.map((rem, index) => (
                        <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#F8FAFC' }}>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>{rem.employeeName}</Typography>
                            <Typography variant="caption" sx={{ color: '#94A3B8' }}>{rem.dateTime}</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ color: '#4B5563', fontStyle: 'italic' }}>
                            "{rem.comment}"
                          </Typography>
                        </Paper>
                      ))}
                    </List>
                  )}
                </Box>
              )}

              {/* TAB 3: Documents and Files */}
              {activeTab === 2 && (
                <Box>
                  {/* Upload Simulator */}
                  <Box component="form" onSubmit={handleUploadDoc} sx={{ mb: 4, p: 2, border: '1px dashed #CBD5E1', borderRadius: '12px' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Attach PDF / Document Details</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={5}>
                        <TextField 
                          placeholder="Document Title (e.g. NOC Certificate)"
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

                  {/* Documents List */}
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Linked Documents Database</Typography>
                  {connections?.documents?.length === 0 ? (
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
                        <Button variant="outlined" size="small" component="a" href={doc.fileUrl} download sx={{ textTransform: 'none' }}>
                          Download
                        </Button>
                      </Paper>
                    ))
                  )}
                </Box>
              )}

            </Box>
          </Card>
        </Grid>

      </Grid>
    </Box>
  );
};

export default EntityDetail;
