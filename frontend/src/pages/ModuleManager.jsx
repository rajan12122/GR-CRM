import React, { useEffect, useState } from 'react';
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
  Chip
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
      // Edit mode
      res = await updateRecord(moduleName, selectedRecord.id, formData);
    } else {
      // Create mode
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

      {/* Tabular vs Folder/Card view */}
      {viewMode === 'table' ? (
        <Card sx={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {loadingData && records.length === 0 ? (
              <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#64748B' }}>Loading data records...</Typography>
              </Box>
            ) : (
              <DynamicTable 
                moduleKey={moduleName}
                records={records}
                fields={fields}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                onInspectClick={handleInspectClick}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Box>
          {loadingData && records.length === 0 ? (
            <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#64748B' }}>Loading data records...</Typography>
            </Box>
          ) : records.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: '#64748B' }}>
              <Typography variant="body2">No records found for this module.</Typography>
            </Box>
          ) : (
            <Box>
              {records.map(rec => (
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
