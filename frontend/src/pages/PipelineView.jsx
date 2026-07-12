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
      const moduleToFetch = (pipelineType === 'buyer_query' || pipelineType === 'seller_query') ? 'queries' : pipelineType;
      fetchModuleData(moduleToFetch);
    }
  }, [pipelineType, metadata]);

  if (!metadata) return null;

  // Determine configuration based on pipelineType
  let targetModule = '';
  let stageField = '';
  let chipGroup = '';
  let title = '';
  let subtitle = '';
  let filterFn = (rec) => true;

  if (pipelineType === 'properties') {
    targetModule = 'properties';
    stageField = 'status';
    chipGroup = 'propertyStatus';
    title = 'Property Pipeline (Kanban)';
    subtitle = 'Track inventory status updates (Available, Booked, Agreement, Sold) in real time.';
  } else if (pipelineType === 'property_pitches') {
    targetModule = 'property_pitch_history';
    stageField = 'status';
    chipGroup = 'pitchStatus';
    title = 'Property Interest Pipeline';
    subtitle = 'Track prospective client interest stages for pitched property listings.';
  } else if (pipelineType === 'customers') {
    targetModule = 'customers';
    stageField = 'stage';
    chipGroup = 'customerStages';
    title = 'Client Deal Nurturing Pipeline';
    subtitle = 'Track customer pathways from fresh leads to negotiation and booking closeouts.';
  } else if (pipelineType === 'buyer_query') {
    targetModule = 'queries';
    stageField = 'stage';
    chipGroup = 'buyerQueryStages';
    title = 'Buyer Query Pipeline';
    subtitle = 'Track prospective buyer query progression from Verified to Closed.';
    filterFn = (rec) => rec.queryType === 'Buy Property' || !rec.queryType;
  } else if (pipelineType === 'seller_query') {
    targetModule = 'queries';
    stageField = 'stage';
    chipGroup = 'sellerQueryStages';
    title = 'Seller Query Pipeline';
    subtitle = 'Track seller property listings from inspection to sale readiness.';
    filterFn = (rec) => rec.queryType === 'Sell Property';
  } else {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Invalid pipeline parameter '{pipelineType}'.</Alert>
      </Box>
    );
  }

  const stages = metadata.chips[chipGroup] || [];
  
  let records = [];
  if (pipelineType === 'customers') {
    const mapLeadStatusToStage = (status) => {
      if (status === 'Open' || status === 'New Lead') return 'New Lead';
      if (status === 'Contacted') return 'Contacted';
      if (status === 'Visit Scheduled' || status === 'Site Visit Scheduled') return 'Site Visit';
      if (status === 'Negotiation') return 'Negotiation';
      if (status === 'Junk') return 'Lost';
      if (status === 'Converted') return 'Closed';
      return 'New Lead';
    };

    const activeLeads = (moduleData.leads || [])
      .filter(l => l.status !== 'Converted' && l.status !== 'Junk')
      .map(l => ({
        ...l,
        stage: mapLeadStatusToStage(l.status)
      }));

    const customers = (moduleData.customers || []);
    records = [...activeLeads, ...customers];
  } else {
    records = (moduleData[targetModule] || []).filter(filterFn);
  }

  const handleCardMove = async (cardId, targetStageValue) => {
    if (pipelineType === 'customers') {
      if (String(cardId).startsWith('LEAD-')) {
        const lead = (moduleData.leads || []).find(l => l.id === cardId);
        if (!lead) return;
        
        const mapStageToLeadStatus = (stage) => {
          if (stage === 'New Lead') return 'Open';
          if (stage === 'Contacted') return 'Contacted';
          if (stage === 'Site Visit') return 'Visit Scheduled';
          if (stage === 'Negotiation') return 'Negotiation';
          if (stage === 'Lost') return 'Junk';
          if (stage === 'Closed') return 'Converted';
          return 'In-Progress';
        };

        const payload = { ...lead, status: mapStageToLeadStatus(targetStageValue) };
        await updateRecord('leads', cardId, payload);
      } else {
        const customer = (moduleData.customers || []).find(c => c.id === cardId);
        if (!customer) return;
        const payload = { ...customer, stage: targetStageValue };
        await updateRecord('customers', cardId, payload);
      }
    } else {
      const allRecords = moduleData[targetModule] || [];
      const record = allRecords.find(r => r.id === cardId);
      if (!record) return;

      const payload = { ...record, [stageField]: targetStageValue };
      await updateRecord(targetModule, cardId, payload);
    }
  };

  const handleInspectClick = (id) => {
    if (pipelineType === 'customers') {
      if (String(id).startsWith('LEAD-')) {
        navigate(`/module/leads/${id}`);
      } else {
        navigate(`/module/customers/${id}`);
      }
    } else {
      navigate(`/module/${targetModule}/${id}`);
    }
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
