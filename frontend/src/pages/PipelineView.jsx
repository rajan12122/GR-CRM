import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Alert
} from '@mui/material';
import { useApp } from '../context/AppContext';
import KanbanBoard from '../components/KanbanBoard';

const PipelineView = () => {
  const { pipelineType } = useParams(); // 'properties' or 'customers'
  const navigate = useNavigate();
  const { 
    metadata, 
    moduleData, 
    fetchModuleData, 
    updateRecord, 
    loadingData 
  } = useApp();

  useEffect(() => {
    if (metadata) {
      fetchModuleData(pipelineType);
    }
  }, [pipelineType, metadata]);

  if (!metadata) return null;

  // Determine configuration based on pipelineType
  let targetModule = '';
  let stageField = '';
  let chipGroup = '';
  let title = '';
  let subtitle = '';

  if (pipelineType === 'properties') {
    targetModule = 'properties';
    stageField = 'status';
    chipGroup = 'propertyStatus';
    title = 'Property Pipeline (Kanban)';
    subtitle = 'Track inventory status updates (Available, Booked, Agreement, Sold) in real time.';
  } else if (pipelineType === 'customers') {
    targetModule = 'customers';
    stageField = 'stage';
    chipGroup = 'customerStages';
    title = 'Client Deal Nurturing Pipeline';
    subtitle = 'Track customer pathways from fresh leads to negotiation and booking closeouts.';
  } else {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Invalid pipeline parameter '{pipelineType}'.</Alert>
      </Box>
    );
  }

  const stages = metadata.chips[chipGroup] || [];
  const records = moduleData[targetModule] || [];

  const handleCardMove = async (cardId, targetStageValue) => {
    // Optimistically update
    const record = records.find(r => r.id === cardId);
    if (!record) return;

    const payload = { ...record, [stageField]: targetStageValue };
    await updateRecord(targetModule, cardId, payload);
  };

  const handleInspectClick = (id) => {
    navigate(`/module/${targetModule}/${id}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Title Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h2" sx={{ fontWeight: 800, fontSize: '26px', color: '#0F172A', fontFamily: 'Poppins' }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B' }}>
          {subtitle} Drag cards left/right to modify stages instantly.
        </Typography>
      </Box>

      {/* Kanban Board mounting */}
      {loadingData && records.length === 0 ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <KanbanBoard 
          records={records}
          stages={stages}
          stageField={stageField}
          onCardMove={handleCardMove}
          onInspectClick={handleInspectClick}
        />
      )}
    </Box>
  );
};

export default PipelineView;
