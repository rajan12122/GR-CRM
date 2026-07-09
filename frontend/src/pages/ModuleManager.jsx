import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';
import DynamicTable from '../components/DynamicTable';
import DynamicForm from '../components/DynamicForm';
const RecordCard = ({ rec, fields, handleInspectClick, handleEditClick, handleDeleteClick, moduleName }) => {
  const [expanded, setExpanded] = useState(false);
  const primaryFields = fields.filter(f => f.showInTable && f.name !== 'id' && f.name !== 'status');
  
  // Filter only fields that have actual, non-empty values in the current record
  const filledFields = primaryFields.filter(f => {
    const val = rec[f.name];
    return val !== undefined && val !== null && val !== '';
  });

  // Display first 4 filled fields initially; expand to show all filled fields on toggle click
  const visibleFields = expanded ? filledFields : filledFields.slice(0, 4);
  const hasMoreFields = filledFields.length > 4;

  return (
    <Card sx={{ border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'none', mb: 2.5, '&:hover': { boxShadow: '0 6px 15px rgba(15,23,42,0.03)', borderColor: '#CBD5E1' }, transition: 'all 0.2s' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2.5 }}>
          
          {/* Left section: Folder tab and ID */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: '140px' }}>
            <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: 'rgba(37,99,235,0.06)', color: '#2563EB', display: 'flex', alignItems: 'center' }}>
              <Icons.Folder size={20} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', fontSize: '13px' }}>
                {rec.id}
              </Typography>
              {rec.status && (
                <Chip 
                  label={rec.status} 
                  size="small" 
                  sx={{ fontWeight: 700, fontSize: '9px', borderRadius: '4px', height: 16, mt: 0.5 }}
                />
              )}
            </Box>
          </Box>

          {/* Middle section: Horizontal view of fields */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexWrap: 'wrap', gap: { xs: 2, md: 4 } }}>
            {visibleFields.map(f => {
              const val = rec[f.name];
              let displayVal = String(val);
              if (f.name === 'price' || f.name === 'budget' || f.name === 'salary') {
                displayVal = `₹${Number(val).toLocaleString('en-IN')}`;
              }

              return (
                <Box key={f.name} sx={{ minWidth: '130px' }}>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontWeight: 600, fontSize: '11px', mb: 0.2 }}>
                    {f.label}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 700, fontSize: '13px' }}>
                    {f.type === 'ref' || f.type === 'multiref' ? (
                      <span style={{ color: '#2563EB', cursor: 'pointer', fontWeight: 700 }} onClick={() => handleInspectClick(f.refModule, val)}>
                        {val}
                      </span>
                    ) : (
                      displayVal
                    )}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Right section: Action tray */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, borderLeft: { xs: 'none', md: '1px solid #E2E8F0' }, pl: { xs: 0, md: 1.5 }, pt: { xs: 1.5, md: 0 }, width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            {(moduleName === 'leads' || moduleName === 'customers') && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {rec.phone && (
                  <IconButton 
                    size="small" 
                    href={`https://wa.me/91${rec.phone}?text=${encodeURIComponent(`Hi ${rec.name || ''}, this is Gagan Realtech following up.`)}`}
                    target="_blank"
                    sx={{ color: '#22C55E', '&:hover': { backgroundColor: 'rgba(34,197,94,0.05)' } }}
                  >
                    <Icons.MessageCircle size={16} />
                  </IconButton>
                )}
                {rec.email && (
                  <IconButton 
                    size="small" 
                    href={`mailto:${rec.email}?subject=${encodeURIComponent("Gagan Realtech Follow-up")}&body=${encodeURIComponent(`Hi ${rec.name || ''},\n\nThis is Gagan Realtech following up on your requirements.\n\nBest regards,\nGagan Realtech Team`)}`}
                    sx={{ color: '#3B82F6', '&:hover': { backgroundColor: 'rgba(59,130,246,0.05)' } }}
                  >
                    <Icons.Mail size={16} />
                  </IconButton>
                )}
                {rec.phone && (
                  <IconButton 
                    size="small" 
                    href={`sms:91${rec.phone}?body=${encodeURIComponent(`Hi ${rec.name || ''}, this is Gagan Realtech following up.`)}`}
                    sx={{ color: '#F59E0B', '&:hover': { backgroundColor: 'rgba(245,158,11,0.05)' } }}
                  >
                    <Icons.Smartphone size={16} />
                  </IconButton>
                )}
              </Box>
            )}
            <IconButton size="small" onClick={() => handleInspectClick(moduleName, rec.id)} sx={{ color: '#2563EB', '&:hover': { backgroundColor: 'rgba(37,99,235,0.05)' } }}>
              <Icons.SearchCode size={16} />
            </IconButton>
            <IconButton size="small" onClick={() => handleEditClick(rec)} sx={{ color: '#F59E0B', '&:hover': { backgroundColor: 'rgba(245,158,11,0.05)' } }}>
              <Icons.Edit2 size={16} />
            </IconButton>
            <IconButton size="small" onClick={() => handleDeleteClick(rec.id)} sx={{ color: '#EF4444', '&:hover': { backgroundColor: 'rgba(239,68,68,0.05)' } }}>
              <Icons.Trash2 size={16} />
            </IconButton>
          </Box>

        </Box>

        {hasMoreFields && (
          <Button 
            size="small" 
            onClick={() => setExpanded(!expanded)} 
            sx={{ mt: 1.5, p: 0, textTransform: 'none', fontWeight: 700, fontSize: '11px', color: '#2563EB', '&:hover': { background: 'none', textDecoration: 'underline' } }}
          >
            {expanded ? 'Show Less ▲' : `Show More (${filledFields.length - 4} more) ▼`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const ModuleManager = () => {
  const { moduleName } = useParams();
  const navigate = useNavigate();
  const { 
    metadata, 
    moduleData, 
    fetchModuleData, 
    createRecord, 
    updateRecord, 
    deleteRecord,
    loadingData 
  } = useApp();

  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [stackedFilters, setStackedFilters] = useState({});
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState({});
  const [selectedRows, setSelectedRows] = useState([]);

  // Menu Anchors
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // Fetch data records on module active state changes
  useEffect(() => {
    if (metadata && metadata.modules[moduleName]) {
      fetchModuleData(moduleName);
      setErrorMsg('');

      // Check if we need to auto-open creation form dialog
      const params = new URLSearchParams(window.location.search);
      if (params.get('new') === 'true') {
        setSelectedRecord(null);
        setFormOpen(true);
      }
    }
  }, [moduleName, metadata]);

  if (!metadata) return null;

  const moduleConfig = metadata.modules[moduleName];
  if (!moduleConfig) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Module "{moduleName}" does not exist in metadata.</Alert>
      </Box>
    );
  }

  const fields = moduleConfig.fields;
  const records = moduleData[moduleName] || [];

  // Reset states and initialize columns / filters when module changes
  useEffect(() => {
    if (fields) {
      const initialCol = {};
      fields.forEach(f => {
        initialCol[f.name] = f.showInTable !== false;
      });
      setVisibleColumns(initialCol);

      const defaults = fields
        .filter(f => f.type === 'select' || f.type === 'ref')
        .slice(0, 3)
        .map(f => f.name);
      setActiveFilterFields(defaults);

      setStackedFilters({});
      setSearchTerm('');
      setSelectedRows([]);
      setSortField('id');
      setSortDirection('asc');
    }
  }, [moduleName, fields]);

  // Extract distinct values dynamically for filtering
  const filterOptions = useMemo(() => {
    const options = {};
    if (!fields) return options;
    fields.forEach(f => {
      if (f.name === 'id' || f.name === 'last_updated') return;
      
      const distinctValues = Array.from(new Set(
        records
          .map(r => r[f.name])
          .filter(val => val !== undefined && val !== null && val !== '')
      ));
      
      if (distinctValues.length > 0) {
        options[f.name] = distinctValues.map(val => ({
          value: String(val),
          label: String(val)
        }));
      }
    });
    return options;
  }, [fields, records]);

  const [activeFilterFields, setActiveFilterFields] = useState([]);

  // Filter logic
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // Global Search
      const keywords = searchTerm.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
      const matchesSearch = keywords.length === 0 || keywords.every(word => {
        return Object.keys(rec).some(key => {
          const val = rec[key];
          if (val === undefined || val === null) return false;
          return String(val).toLowerCase().includes(word);
        });
      });

      // Stacked Filters
      const matchesFilters = Object.keys(stackedFilters).every(key => {
        const filterVal = stackedFilters[key];
        if (!filterVal || filterVal === 'ALL') return true;
        
        const recordVal = rec[key];
        if (recordVal === undefined || recordVal === null) return false;

        const fieldObj = fields.find(f => f.name === key);
        const isDateType = fieldObj?.type === 'date' || key.toLowerCase().includes('date');
        
        if (isDateType) {
          const rDateStr = String(recordVal).toLowerCase();
          const fDateStr = String(filterVal).toLowerCase();
          const fParts = fDateStr.split('-');
          if (fParts.length === 3) {
            const yyyy = fParts[0];
            const mm = fParts[1];
            const dd = fParts[2];
            const match1 = `${dd}/${mm}/${yyyy}`;
            const match2 = `${yyyy}-${mm}-${dd}`;
            const match3 = `${dd}-${mm}-${yyyy}`;
            const match4 = `${parseInt(dd, 10)}/${parseInt(mm, 10)}/${yyyy}`;
            const match5 = `${yyyy}/${mm}/${dd}`;
            const match6 = `${parseInt(dd, 10)}-${parseInt(mm, 10)}-${yyyy}`;
            return rDateStr.includes(match1) || 
                   rDateStr.includes(match2) || 
                   rDateStr.includes(match3) || 
                   rDateStr.includes(match4) ||
                   rDateStr.includes(match5) ||
                   rDateStr.includes(match6) ||
                   rDateStr.includes(fDateStr);
          }
        }
        
        return String(recordVal).toLowerCase() === String(filterVal).toLowerCase();
      });

      return matchesSearch && matchesFilters;
    });
  }, [records, searchTerm, stackedFilters, fields]);

  // Sort logic
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    sorted.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDirection === 'asc' 
          ? valA - valB 
          : valB - valA;
      }
    });
    return sorted;
  }, [filteredRecords, sortField, sortDirection]);

  const handleSortRequest = (fieldName) => {
    const isAsc = sortField === fieldName && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortField(fieldName);
  };

  const handleCreateClick = () => {
    setSelectedRecord(null);
    setFormOpen(true);
  };

  const handleEditClick = (record) => {
    setSelectedRecord(record);
    setFormOpen(true);
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      const res = await deleteRecord(moduleName, id);
      if (!res.success) {
        setErrorMsg(res.message || 'Delete operation failed.');
      } else {
        fetchModuleData(moduleName);
      }
    }
  };

  const handleFormSubmit = async (formData) => {
    let res;
    if (selectedRecord) {
      res = await updateRecord(moduleName, selectedRecord.id, formData);
    } else {
      res = await createRecord(moduleName, formData);
    }

    if (res.success) {
      setFormOpen(false);
      setSelectedRecord(null);
      fetchModuleData(moduleName);
    } else {
      setErrorMsg(res.message || 'Failed to save record.');
    }
  };

  const handleInspectClick = (type, id) => {
    navigate(`/module/${type}/${id}`);
  };

  const handleExportCSV = () => {
    const headers = fields.filter(f => visibleColumns[f.name]).map(f => f.label);
    const keys = fields.filter(f => visibleColumns[f.name]).map(f => f.name);
    
    const targets = selectedRows.length > 0 
      ? records.filter(r => selectedRows.includes(r.id))
      : sortedRecords;

    let csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(",")].concat(
          targets.map(rec => keys.map(k => {
            const val = rec[k] || '';
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(","))
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gagan_realtech_${moduleName}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete these ${selectedRows.length} records?`)) {
      setErrorMsg('');
      for (const id of selectedRows) {
        const res = await deleteRecord(moduleName, id);
        if (!res.success) {
          setErrorMsg(res.message || 'Bulk delete operation failed.');
        }
      }
      setSelectedRows([]);
      fetchModuleData(moduleName);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header controls */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 800, fontSize: '26px', color: '#0F172A', fontFamily: 'Poppins' }}>
            {moduleConfig.label} Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Browse, inspect relationships, configure columns, and export data records.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, nextView) => { if (nextView) setViewMode(nextView); }}
            size="small"
            sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}
          >
            <ToggleButton value="table" sx={{ px: 1.5, py: 1 }}>
              <Icons.Table size={16} style={{ marginRight: 6 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'none' }}>Table</Typography>
            </ToggleButton>
            <ToggleButton value="card" sx={{ px: 1.5, py: 1 }}>
              <Icons.Folder size={16} style={{ marginRight: 6 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'none' }}>Folders</Typography>
            </ToggleButton>
          </ToggleButtonGroup>

          <Button 
            variant="contained" 
            startIcon={<Icons.Plus size={18} />}
            onClick={handleCreateClick}
            sx={{ backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' }, textTransform: 'none', borderRadius: '8px', fontWeight: 700 }}
          >
            Add {moduleConfig.label.slice(0, -1)}
          </Button>
        </Box>
      </Box>

      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ mb: 3, borderRadius: '8px' }}>
          {errorMsg}
        </Alert>
      )}

      {/* Shared Responsive Toolbar */}
      <Box sx={{ 
        p: 2, 
        mb: 2.5,
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' }, 
        gap: 2, 
        border: '1px solid #E2E8F0', 
        borderRadius: '12px',
        backgroundColor: '#FFFFFF' 
      }}>
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search records..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Icons.Search size={16} color="#64748B" />
              </InputAdornment>
            )
          }}
          sx={{ width: { xs: '100%', sm: 280 } }}
        />

        {/* Action Controls */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1.5, 
          overflowX: 'auto', 
          flexWrap: 'nowrap',
          maxWidth: '100%',
          pb: 0.5,
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { display: 'none' }
        }}>
          {/* Filters Dropdown */}
          <Button 
            variant="outlined" 
            size="small"
            startIcon={<Icons.SlidersHorizontal size={15} />}
            onClick={(e) => setFilterAnchorEl(e.currentTarget)}
            sx={{ borderColor: '#E2E8F0', color: '#0F172A', textTransform: 'none', fontWeight: 600, minWidth: '90px' }}
          >
            Filters
            {Object.keys(stackedFilters).filter(k => stackedFilters[k]).length > 0 && (
              <Chip 
                label={Object.keys(stackedFilters).filter(k => stackedFilters[k]).length} 
                size="small" 
                color="primary" 
                sx={{ ml: 1, height: 18, fontSize: '10px', fontWeight: 800 }} 
              />
            )}
          </Button>

          {/* Sort Dropdown */}
          <Button 
            variant="outlined" 
            size="small"
            startIcon={<Icons.ArrowUpDown size={15} />}
            onClick={(e) => setSortAnchorEl(e.currentTarget)}
            sx={{ borderColor: '#E2E8F0', color: '#0F172A', textTransform: 'none', fontWeight: 600, minWidth: '95px' }}
          >
            Sort By
          </Button>

          {/* Column toggler (Table View only) */}
          {viewMode === 'table' && (
            <Button 
              variant="outlined" 
              size="small"
              startIcon={<Icons.EyeOff size={15} />}
              onClick={() => setColMenuOpen(true)}
              sx={{ borderColor: '#E2E8F0', color: '#0F172A', textTransform: 'none', fontWeight: 600, minWidth: '100px' }}
            >
              Columns
            </Button>
          )}

          {/* Export */}
          <Button 
            variant="outlined" 
            size="small"
            startIcon={<Icons.Download size={15} />}
            onClick={handleExportCSV}
            sx={{ borderColor: '#E2E8F0', color: '#0F172A', textTransform: 'none', fontWeight: 600, minWidth: '90px' }}
          >
            Export
          </Button>

          {/* Bulk Delete */}
          {selectedRows.length > 0 && (
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<Icons.Trash2 size={15} />}
              onClick={handleBulkDelete}
              sx={{ textTransform: 'none', fontWeight: 700, minWidth: '130px' }}
            >
              Delete ({selectedRows.length})
            </Button>
          )}
        </Box>
      </Box>

      {/* Filters Dropdown Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
        PaperProps={{ style: { padding: '16px', minWidth: 260, borderRadius: '12px' } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, fontFamily: 'Poppins' }}>Filter Sheets</Typography>
        
        {activeFilterFields.map(fieldName => {
          const fieldLabel = fields.find(f => f.name === fieldName)?.label || fieldName;
          const fieldObj = fields.find(f => f.name === fieldName);
          const isDateType = fieldObj?.type === 'date' || fieldName.toLowerCase().includes('date');
          const opts = filterOptions[fieldName] || [];
          return (
            <Box key={fieldName} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              {isDateType ? (
                <TextField
                  type="date"
                  label={fieldLabel}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={stackedFilters[fieldName] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStackedFilters(prev => ({
                      ...prev,
                      [fieldName]: val || undefined
                    }));
                  }}
                  sx={{ flexGrow: 1 }}
                />
              ) : (
                <FormControl size="small" sx={{ flexGrow: 1 }}>
                  <InputLabel>{fieldLabel}</InputLabel>
                  <Select
                    label={fieldLabel}
                    value={stackedFilters[fieldName] || 'ALL'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStackedFilters(prev => ({
                        ...prev,
                        [fieldName]: val === 'ALL' ? undefined : val
                      }));
                    }}
                  >
                    <MenuItem value="ALL"><em>All options</em></MenuItem>
                    {opts.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <IconButton 
                size="small" 
                color="error" 
                onClick={() => {
                  setActiveFilterFields(prev => prev.filter(f => f !== fieldName));
                  setStackedFilters(prev => {
                    const copy = { ...prev };
                    delete copy[fieldName];
                    return copy;
                  });
                }}
              >
                <Icons.X size={16} />
              </IconButton>
            </Box>
          );
        })}

        <FormControl size="small" fullWidth sx={{ mt: 1, mb: 1.5 }}>
          <InputLabel>Add Filter Column...</InputLabel>
          <Select
            label="Add Filter Column..."
            value=""
            onChange={(e) => {
              const newField = e.target.value;
              if (newField && !activeFilterFields.includes(newField)) {
                setActiveFilterFields(prev => [...prev, newField]);
              }
            }}
          >
            {fields
              .filter(f => f.name !== 'id' && f.name !== 'last_updated' && !activeFilterFields.includes(f.name))
              .map(f => (
                <MenuItem key={f.name} value={f.name}>{f.label}</MenuItem>
              ))
            }
          </Select>
        </FormControl>

        <Box display="flex" justifyContent="space-between" gap={1} sx={{ mt: 1 }}>
          <Button size="small" onClick={() => { setStackedFilters({}); setFilterAnchorEl(null); }}>Reset</Button>
          <Button size="small" variant="contained" onClick={() => setFilterAnchorEl(null)}>Apply</Button>
        </Box>
      </Menu>

      {/* Sort Dropdown Menu */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={() => setSortAnchorEl(null)}
        PaperProps={{ style: { padding: '16px', minWidth: 220, borderRadius: '12px' } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, fontFamily: 'Poppins' }}>Sort Records By</Typography>
        
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel>Sort Column</InputLabel>
          <Select
            label="Sort Column"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
          >
            {fields.map(f => (
              <MenuItem key={f.name} value={f.name}>{f.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel>Direction</InputLabel>
          <Select
            label="Direction"
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value)}
          >
            <MenuItem value="asc">Ascending (A-Z / 1-9)</MenuItem>
            <MenuItem value="desc">Descending (Z-A / 9-1)</MenuItem>
          </Select>
        </FormControl>

        <Box display="flex" justifyContent="flex-end">
          <Button size="small" variant="contained" onClick={() => setSortAnchorEl(null)}>Done</Button>
        </Box>
      </Menu>

      {/* Column Config Dialog */}
      <Dialog open={colMenuOpen} onClose={() => setColMenuOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: 'Poppins' }}>Configure Display Columns</DialogTitle>
        <DialogContent>
          <FormGroup sx={{ mt: 1 }}>
            {fields.map(f => (
              <FormControlLabel
                key={f.name}
                control={
                  <Checkbox 
                    checked={visibleColumns[f.name] !== false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setVisibleColumns(prev => ({ ...prev, [f.name]: checked }));
                    }}
                  />
                }
                label={f.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setColMenuOpen(false)} variant="contained">Apply Columns</Button>
        </DialogActions>
      </Dialog>

      {/* Tabular vs Folder/Card view */}
      {viewMode === 'table' ? (
        <Card sx={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {loadingData && sortedRecords.length === 0 ? (
              <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#64748B' }}>Loading data records...</Typography>
              </Box>
            ) : (
              <DynamicTable 
                moduleKey={moduleName}
                records={sortedRecords}
                fields={fields}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                sortField={sortField}
                sortDirection={sortDirection}
                handleSortRequest={handleSortRequest}
                colMenuOpen={colMenuOpen}
                setColMenuOpen={setColMenuOpen}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                onInspectClick={handleInspectClick}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Box>
          {loadingData && sortedRecords.length === 0 ? (
            <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#64748B' }}>Loading data records...</Typography>
            </Box>
          ) : sortedRecords.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: '#64748B' }}>
              <Typography variant="body2">No matching records found.</Typography>
            </Box>
          ) : (
            <Box>
              {sortedRecords.map(rec => (
                <RecordCard 
                  key={rec.id}
                  rec={rec}
                  fields={fields}
                  handleInspectClick={handleInspectClick}
                  handleEditClick={handleEditClick}
                  handleDeleteClick={handleDeleteClick}
                  moduleName={moduleName}
                />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Create / Edit Dialog Form */}
      <DynamicForm 
        open={formOpen}
        onClose={() => setFormOpen(false)}
        moduleKey={moduleName}
        fields={fields}
        initialData={selectedRecord}
        onSubmit={handleFormSubmit}
      />
    </Box>
  );
};

export default ModuleManager;
