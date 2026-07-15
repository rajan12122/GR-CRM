import React from 'react';
import { Tooltip } from '@mui/material';
import { useApp } from '../context/AppContext';

const EntityTooltip = ({ moduleName, id, children }) => {
  const { moduleData } = useApp();
  if (!id) return children;
  
  const list = moduleData[moduleName] || [];
  const record = list.find(r => String(r.id) === String(id));
  const resolvedName = record 
    ? (record.name || record.title || record.firm_name || record.person_name || record.id || 'Unnamed') 
    : `ID: ${id}`;
  
  return (
    <Tooltip title={`${moduleName.slice(0, -1).toUpperCase()}: ${resolvedName}`} arrow placement="top">
      <span style={{ cursor: 'help' }}>{children}</span>
    </Tooltip>
  );
};

export default EntityTooltip;
