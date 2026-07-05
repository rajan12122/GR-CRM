import React, { useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Button, 
  Divider, 
  Checkbox, 
  FormControlLabel, 
  Switch,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  List,
  ListItem,
  Chip
} from '@mui/material';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';

const Settings = () => {
  const { 
    metadata, 
    saveMetadata, 
    testSheetsSync, 
    triggerFullSheetsSync 
  } = useApp();

  const [activeTab, setActiveTab] = useState('fields'); // 'fields', 'chips', 'permissions', 'sheets'
  const [selectedModule, setSelectedModule] = useState('customers');
  const [selectedChipGroup, setSelectedChipGroup] = useState('customerStages');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [syncLoading, setSyncLoading] = useState(false);

  // Field Add Form state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldShowTable, setNewFieldShowTable] = useState(true);
  const [newFieldChipGroup, setNewFieldChipGroup] = useState('');
  const [newFieldRefModule, setNewFieldRefModule] = useState('');

  // Chip Add Form state
  const [newChipVal, setNewChipVal] = useState('');
  const [newChipLabel, setNewChipLabel] = useState('');
  const [newChipColor, setNewChipColor] = useState('#2563EB');

  if (!metadata) return null;

  const showStatus = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  // --- FIELDS SCHEMA SCHEMA MANAGEMENT ---

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!newFieldName.trim() || !newFieldLabel.trim()) {
      showStatus('error', 'Field Name and Label are required.');
      return;
    }

    const updated = { ...metadata };
    const fields = updated.modules[selectedModule].fields;
    
    // Check duplicate
    if (fields.some(f => f.name === newFieldName)) {
      showStatus('error', `Field name '${newFieldName}' already exists in this module.`);
      return;
    }

    const newField = {
      name: newFieldName.trim(),
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      showInTable: newFieldShowTable,
      editable: true
    };

    if (newFieldType === 'select' && newFieldChipGroup) {
      newField.chipGroup = newFieldChipGroup;
    }
    if (newFieldType === 'ref' && newFieldRefModule) {
      newField.refModule = newFieldRefModule;
    }

    fields.push(newField);
    const res = await saveMetadata(updated);
    if (res.success) {
      showStatus('success', `Added field '${newFieldLabel}' successfully.`);
      setNewFieldName('');
      setNewFieldLabel('');
      setNewFieldType('text');
      setNewFieldRequired(false);
    } else {
      showStatus('error', res.message);
    }
  };

  const handleDeleteField = async (fieldName) => {
    if (fieldName === 'id') {
      showStatus('error', 'Cannot delete primary identifier field "id".');
      return;
    }
    if (window.confirm(`Delete field '${fieldName}' from module schema?`)) {
      const updated = { ...metadata };
      updated.modules[selectedModule].fields = updated.modules[selectedModule].fields.filter(f => f.name !== fieldName);
      const res = await saveMetadata(updated);
      if (res.success) {
        showStatus('success', `Field '${fieldName}' removed from schema.`);
      } else {
        showStatus('error', res.message);
      }
    }
  };

  // --- CHIPS OPTIONS MANAGEMENT ---

  const handleAddChip = async (e) => {
    e.preventDefault();
    if (!newChipVal.trim() || !newChipLabel.trim()) {
      showStatus('error', 'Option Value and Label are required.');
      return;
    }

    const updated = { ...metadata };
    if (!updated.chips[selectedChipGroup]) {
      updated.chips[selectedChipGroup] = [];
    }

    // Check duplicate
    if (updated.chips[selectedChipGroup].some(c => c.value === newChipVal)) {
      showStatus('error', 'Option value already exists.');
      return;
    }

    updated.chips[selectedChipGroup].push({
      value: newChipVal.trim(),
      label: newChipLabel.trim(),
      color: newChipColor
    });

    const res = await saveMetadata(updated);
    if (res.success) {
      showStatus('success', `Added dropdown option '${newChipLabel}' successfully.`);
      setNewChipVal('');
      setNewChipLabel('');
      setNewChipColor('#2563EB');
    } else {
      showStatus('error', res.message);
    }
  };

  const handleDeleteChip = async (val) => {
    if (window.confirm(`Delete dropdown option '${val}'?`)) {
      const updated = { ...metadata };
      updated.chips[selectedChipGroup] = updated.chips[selectedChipGroup].filter(c => c.value !== val);
      const res = await saveMetadata(updated);
      if (res.success) {
        showStatus('success', 'Dropdown option removed.');
      } else {
        showStatus('error', res.message);
      }
    }
  };

  // --- PERMISSIONS MANAGEMENT ---

  const handlePermissionToggle = async (roleName, moduleKey, action) => {
    const updated = { ...metadata };
    if (!updated.rolesPermissions[roleName]) {
      updated.rolesPermissions[roleName] = {};
    }
    if (!updated.rolesPermissions[roleName][moduleKey]) {
      updated.rolesPermissions[roleName][moduleKey] = [];
    }

    const perms = updated.rolesPermissions[roleName][moduleKey];
    if (perms.includes(action)) {
      updated.rolesPermissions[roleName][moduleKey] = perms.filter(a => a !== action);
    } else {
      updated.rolesPermissions[roleName][moduleKey].push(action);
    }

    const res = await saveMetadata(updated);
    if (!res.success) {
      showStatus('error', res.message);
    }
  };

  // --- GOOGLE SHEETS SETTINGS MANAGEMENT ---

  const handleSheetsConfigChange = (field, val) => {
    const updated = { ...metadata };
    updated.sheetsConfig[field] = val;
    saveMetadata(updated);
  };

  const handleTestSheets = async () => {
    setSyncLoading(true);
    const res = await testSheetsSync();
    setSyncLoading(false);
    if (res.success) {
      showStatus('success', res.message);
    } else {
      showStatus('error', res.message);
    }
  };

  const handleSyncNow = async () => {
    setSyncLoading(true);
    const res = await triggerFullSheetsSync();
    setSyncLoading(false);
    if (res.success) {
      showStatus('success', res.message);
    } else {
      showStatus('error', res.message);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Title */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h2" sx={{ fontWeight: 800, fontSize: '26px', color: '#0F172A', fontFamily: 'Poppins' }}>
          Admin Settings & Metadata Editor
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B' }}>
          Fully customize tables, columns, dropdown chips, roles, permissions, and Google Sheets integration without writing code.
        </Typography>
      </Box>

      {/* Settings Menu Tabs */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
            <CardContent sx={{ p: 1.5 }}>
              <List disablePadding>
                <ListItem button onClick={() => setActiveTab('fields')} selected={activeTab === 'fields'} sx={{ borderRadius: '8px', mb: 0.5, py: 1.5, backgroundColor: activeTab === 'fields' ? 'rgba(37,99,235,0.08) !important' : 'transparent', color: activeTab === 'fields' ? '#2563EB' : '#4B5563' }}>
                  <Icons.Columns size={18} style={{ marginRight: 10 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Custom Columns & Fields</Typography>
                </ListItem>
                <ListItem button onClick={() => setActiveTab('chips')} selected={activeTab === 'chips'} sx={{ borderRadius: '8px', mb: 0.5, py: 1.5, backgroundColor: activeTab === 'chips' ? 'rgba(37,99,235,0.08) !important' : 'transparent', color: activeTab === 'chips' ? '#2563EB' : '#4B5563' }}>
                  <Icons.Tag size={18} style={{ marginRight: 10 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Chips & Dropdowns</Typography>
                </ListItem>
                <ListItem button onClick={() => setActiveTab('permissions')} selected={activeTab === 'permissions'} sx={{ borderRadius: '8px', mb: 0.5, py: 1.5, backgroundColor: activeTab === 'permissions' ? 'rgba(37,99,235,0.08) !important' : 'transparent', color: activeTab === 'permissions' ? '#2563EB' : '#4B5563' }}>
                  <Icons.ShieldCheck size={18} style={{ marginRight: 10 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Role Permissions Matrix</Typography>
                </ListItem>
                <ListItem button onClick={() => setActiveTab('sheets')} selected={activeTab === 'sheets'} sx={{ borderRadius: '8px', py: 1.5, backgroundColor: activeTab === 'sheets' ? 'rgba(37,99,235,0.08) !important' : 'transparent', color: activeTab === 'sheets' ? '#2563EB' : '#4B5563' }}>
                  <Icons.FileSpreadsheet size={18} style={{ marginRight: 10 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Google Sheets Config</Typography>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Settings Tab Contents */}
        <Grid item xs={12} md={9}>
          {statusMsg.text && (
            <Alert severity={statusMsg.type} onClose={() => setStatusMsg({ type: '', text: '' })} sx={{ mb: 3, borderRadius: '8px' }}>
              {statusMsg.text}
            </Alert>
          )}

          {/* TAB 1: FIELDS SCHEMA EDITOR */}
          {activeTab === 'fields' && (
            <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3.5}>
                  <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', fontFamily: 'Poppins' }}>
                    Configure Fields for Modules
                  </Typography>
                  <FormControl size="small" sx={{ width: 200 }}>
                    <InputLabel>Select Module</InputLabel>
                    <Select
                      label="Select Module"
                      value={selectedModule}
                      onChange={(e) => setSelectedModule(e.target.value)}
                    >
                      {Object.keys(metadata.modules).map(key => (
                        <MenuItem key={key} value={key}>{metadata.modules[key].label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* List Current Fields */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Active Fields in '{metadata.modules[selectedModule].label}' Schema</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: '8px', boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Field Name (key)</TableCell>
                        <TableCell>Display Label</TableCell>
                        <TableCell>Data Type</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell>Show in Grid</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metadata.modules[selectedModule].fields.map(f => (
                        <TableRow key={f.name}>
                          <TableCell sx={{ fontWeight: 600 }}>{f.name}</TableCell>
                          <TableCell>{f.label}</TableCell>
                          <TableCell><Chip label={f.type} size="small" sx={{ height: 18, fontSize: '10px', textTransform: 'uppercase' }} /></TableCell>
                          <TableCell>{f.required ? 'Yes 🔴' : 'No'}</TableCell>
                          <TableCell>{f.showInTable !== false ? 'Yes' : 'Hidden'}</TableCell>
                          <TableCell align="right">
                            <IconButton size="small" color="error" onClick={() => handleDeleteField(f.name)}>
                              <Icons.Trash2 size={14} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Divider sx={{ mb: 3 }} />

                {/* Add new field form */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Register Custom Field</Typography>
                <Box component="form" onSubmit={handleAddField}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField 
                        label="Field API Name (lowercase, no spaces, e.g. landmark)" 
                        fullWidth
                        size="small"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField 
                        label="Display Title (e.g. Near Landmark)" 
                        fullWidth
                        size="small"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Type</InputLabel>
                        <Select
                          label="Type"
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value)}
                        >
                          <MenuItem value="text">Text (short string)</MenuItem>
                          <MenuItem value="number">Number (float/int)</MenuItem>
                          <MenuItem value="date">Calendar Date</MenuItem>
                          <MenuItem value="select">Dropdown Chip (Select)</MenuItem>
                          <MenuItem value="textarea">Paragraph Box (textarea)</MenuItem>
                          <MenuItem value="ref">Relationship Lookup (Ref)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    {newFieldType === 'select' && (
                      <Grid item xs={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Chips Dropdown Group</InputLabel>
                          <Select
                            label="Chips Dropdown Group"
                            value={newFieldChipGroup}
                            onChange={(e) => setNewFieldChipGroup(e.target.value)}
                          >
                            {Object.keys(metadata.chips).map(group => (
                              <MenuItem key={group} value={group}>{group}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}

                    {newFieldType === 'ref' && (
                      <Grid item xs={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Reference Table Module</InputLabel>
                          <Select
                            label="Reference Table Module"
                            value={newFieldRefModule}
                            onChange={(e) => setNewFieldRefModule(e.target.value)}
                          >
                            {Object.keys(metadata.modules).map(mod => (
                              <MenuItem key={mod} value={mod}>{metadata.modules[mod].label}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}

                    <Grid item xs={6} display="flex" gap={2} alignItems="center">
                      <FormControlLabel
                        control={<Checkbox checked={newFieldRequired} onChange={(e)=>setNewFieldRequired(e.target.checked)} />}
                        label="Required validation"
                      />
                      <FormControlLabel
                        control={<Checkbox checked={newFieldShowTable} onChange={(e)=>setNewFieldShowTable(e.target.checked)} />}
                        label="Show in Table Grid"
                      />
                    </Grid>
                    <Grid item xs={12} display="flex" justifyContent="flex-end">
                      <Button type="submit" variant="contained" startIcon={<Icons.Plus size={16} />}>
                        Add Field Schema
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: CHIPS EDITOR */}
          {activeTab === 'chips' && (
            <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3.5}>
                  <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', fontFamily: 'Poppins' }}>
                    Configure Chip Dropdowns
                  </Typography>
                  <FormControl size="small" sx={{ width: 220 }}>
                    <InputLabel>Select Chip Category</InputLabel>
                    <Select
                      label="Select Chip Category"
                      value={selectedChipGroup}
                      onChange={(e) => setSelectedChipGroup(e.target.value)}
                    >
                      {Object.keys(metadata.chips).map(group => (
                        <MenuItem key={group} value={group}>{group}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* List Current Chip Choices */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Available Chip values</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 4, p: 2, border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
                  {metadata.chips[selectedChipGroup]?.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>No options listed.</Typography>
                  ) : (
                    metadata.chips[selectedChipGroup]?.map(chip => (
                      <Chip 
                        key={chip.value}
                        label={chip.label}
                        onDelete={() => handleDeleteChip(chip.value)}
                        sx={{ 
                          backgroundColor: `${chip.color}15`, 
                          color: chip.color, 
                          border: `1px solid ${chip.color}30`, 
                          fontWeight: 700 
                        }}
                      />
                    ))
                  )}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Form to add choice */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Add Dropdown Choice</Typography>
                <Box component="form" onSubmit={handleAddChip}>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <TextField 
                        label="API value (e.g. Walk-in)" 
                        fullWidth
                        size="small"
                        value={newChipVal}
                        onChange={(e)=>setNewChipVal(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField 
                        label="Display Title (e.g. Office Walk-in)" 
                        fullWidth
                        size="small"
                        value={newChipLabel}
                        onChange={(e)=>setNewChipLabel(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <TextField 
                        type="color"
                        label="Chip Hex Color" 
                        fullWidth
                        size="small"
                        value={newChipColor}
                        onChange={(e)=>setNewChipColor(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={1} display="flex" alignItems="flex-end">
                      <Button type="submit" variant="contained" fullWidth sx={{ height: 40, p: 0 }}>
                        <Icons.Plus size={18} />
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: ROLE PERMISSIONS MATRIX */}
          {activeTab === 'permissions' && (
            <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', mb: 1, fontFamily: 'Poppins' }}>
                  Role Permission matrix
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
                  Configure module access permissions (View, Create, Edit, Delete, Export) per security role.
                </Typography>

                <Divider sx={{ mb: 3 }} />

                <TableContainer component={Paper} sx={{ border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Module Target</TableCell>
                        {Object.keys(metadata.rolesPermissions).map(role => (
                          <TableCell key={role} align="center" sx={{ fontWeight: 600 }}>{role}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.keys(metadata.modules).map(moduleKey => (
                        <TableRow key={moduleKey}>
                          <TableCell sx={{ fontWeight: 600 }}>{metadata.modules[moduleKey].label}</TableCell>
                          
                          {Object.keys(metadata.rolesPermissions).map(role => {
                            const hasView = (metadata.rolesPermissions[role][moduleKey] || []).includes('view');
                            const hasCreate = (metadata.rolesPermissions[role][moduleKey] || []).includes('create');
                            const hasEdit = (metadata.rolesPermissions[role][moduleKey] || []).includes('edit');
                            const hasDelete = (metadata.rolesPermissions[role][moduleKey] || []).includes('delete');
                            const hasExport = (metadata.rolesPermissions[role][moduleKey] || []).includes('export');

                            return (
                              <TableCell key={role} align="center">
                                <Box display="flex" flexDirection="column" gap={0.5} alignItems="center">
                                  <FormControlLabel
                                    control={
                                      <Checkbox 
                                        size="small" 
                                        checked={hasView} 
                                        onChange={() => handlePermissionToggle(role, moduleKey, 'view')} 
                                      />
                                    }
                                    label={<span style={{ fontSize: '10px', fontWeight: 600 }}>View</span>}
                                    sx={{ m: 0 }}
                                  />
                                  <FormControlLabel
                                    control={
                                      <Checkbox 
                                        size="small" 
                                        checked={hasCreate} 
                                        onChange={() => handlePermissionToggle(role, moduleKey, 'create')} 
                                      />
                                    }
                                    label={<span style={{ fontSize: '10px', fontWeight: 600 }}>Create</span>}
                                    sx={{ m: 0 }}
                                  />
                                  <FormControlLabel
                                    control={
                                      <Checkbox 
                                        size="small" 
                                        checked={hasEdit} 
                                        onChange={() => handlePermissionToggle(role, moduleKey, 'edit')} 
                                      />
                                    }
                                    label={<span style={{ fontSize: '10px', fontWeight: 600 }}>Edit</span>}
                                    sx={{ m: 0 }}
                                  />
                                  <FormControlLabel
                                    control={
                                      <Checkbox 
                                        size="small" 
                                        checked={hasDelete} 
                                        onChange={() => handlePermissionToggle(role, moduleKey, 'delete')} 
                                      />
                                    }
                                    label={<span style={{ fontSize: '10px', fontWeight: 600 }}>Delete</span>}
                                    sx={{ m: 0 }}
                                  />
                                </Box>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: GOOGLE SHEETS SYNC CONTROL */}
          {activeTab === 'sheets' && (
            <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '18px', mb: 1, fontFamily: 'Poppins' }}>
                  Google Sheets Synchronization Panel
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
                  Configure your Google Sheets database syncing settings using a Google Cloud Service Account credentials.
                </Typography>

                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={3}>
                  <Grid item xs={12} display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Google Sheets Active Synchronization</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>When active, writes auto-push and reads auto-cache from spreadsheets.</Typography>
                    </Box>
                    <Switch 
                      checked={metadata.sheetsConfig.syncActive || false}
                      onChange={(e) => handleSheetsConfigChange('syncActive', e.target.checked)}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Spreadsheet ID (URL String identifier)"
                      fullWidth
                      value={metadata.sheetsConfig.spreadsheetId || ''}
                      onChange={(e) => handleSheetsConfigChange('spreadsheetId', e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Google Developer Service Account Client Email"
                      fullWidth
                      value={metadata.sheetsConfig.clientEmail || ''}
                      onChange={(e) => handleSheetsConfigChange('clientEmail', e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Private Key PEM string (including certificate blocks)"
                      fullWidth
                      multiline
                      rows={4}
                      value={metadata.sheetsConfig.privateKey || ''}
                      onChange={(e) => handleSheetsConfigChange('privateKey', e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12} display="flex" gap={2}>
                    <Button 
                      variant="outlined" 
                      onClick={handleTestSheets}
                      disabled={syncLoading}
                      startIcon={<Icons.Activity size={18} />}
                      sx={{ borderColor: '#CBD5E1', color: '#0F172A' }}
                    >
                      Verify Credentials Connection
                    </Button>
                    <Button 
                      variant="contained" 
                      onClick={handleSyncNow}
                      disabled={syncLoading}
                      startIcon={<Icons.RefreshCcw size={18} />}
                      sx={{ backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' } }}
                    >
                      Force Bidirectional Sync Now
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
