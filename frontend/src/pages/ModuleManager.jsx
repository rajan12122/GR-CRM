import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Alert,
  IconButton
} from '@mui/material';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';
import DynamicTable from '../components/DynamicTable';
import DynamicForm from '../components/DynamicForm';

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

  // Fetch data records on module active state changes
  useEffect(() => {
    if (metadata && metadata.modules[moduleName]) {
      fetchModuleData(moduleName);
      setErrorMsg('');
    }
  }, [moduleName, metadata]);

  if (!metadata) return null;

  const moduleConfig = metadata.modules[moduleName];
  if (!moduleConfig) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Module '{moduleName}' does not exist in schema metadata.</Alert>
      </Box>
    );
  }

  const fields = moduleConfig.fields || [];
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
    if (window.confirm(`Are you sure you want to delete record ${id}?`)) {
      const res = await deleteRecord(moduleName, id);
      if (!res.success) {
        setErrorMsg(res.message);
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
    } else {
      setErrorMsg(res.message);
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
        <Button 
          variant="contained" 
          startIcon={<Icons.Plus size={18} />}
          onClick={handleCreateClick}
          sx={{ backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' } }}
        >
          Add {moduleConfig.label.slice(0, -1)}
        </Button>
      </Box>

      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ mb: 3, borderRadius: '8px' }}>
          {errorMsg}
        </Alert>
      )}

      {/* Grid container */}
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
