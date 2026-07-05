import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Button, 
  Box, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormHelperText,
  Grid
} from '@mui/material';
import { useApp } from '../context/AppContext';

const DynamicForm = ({ 
  open, 
  onClose, 
  moduleKey, 
  fields, 
  initialData, 
  onSubmit 
}) => {
  const { moduleData, fetchModuleData, metadata } = useApp();
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Trigger references fetches on form open
  useEffect(() => {
    if (open) {
      // Find all ref fields and load their databases
      fields.forEach(f => {
        if (f.type === 'ref' && f.refModule) {
          fetchModuleData(f.refModule);
        }
      });

      // Populate form data
      if (initialData) {
        setFormData({ ...initialData });
      } else {
        const defaultForm = {};
        fields.forEach(f => {
          defaultForm[f.name] = f.type === 'number' ? '' : '';
        });
        setFormData(defaultForm);
      }
      setErrors({});
    }
  }, [open, initialData, fields]);

  const handleChange = (name, val, type) => {
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' && val !== '' ? Number(val) : val
    }));
    
    // Clear validation error on type
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach(f => {
      if (f.required) {
        const val = formData[f.name];
        if (val === undefined || val === null || String(val).trim() === '') {
          newErrors[f.name] = `${f.label} is required.`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  // Helper to extract reference items
  const getReferenceOptions = (refModule) => {
    return moduleData[refModule] || [];
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        style: {
          borderRadius: 16,
          padding: '8px'
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: '20px', fontFamily: 'Poppins', pb: 1 }}>
        {initialData ? `Edit Record: ${initialData.id}` : `Register New ${metadata?.modules[moduleKey]?.label.slice(0, -1) || 'Record'}`}
      </DialogTitle>
      
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ py: 2 }}>
          <Grid container spacing={2}>
            {fields.map(f => {
              // Primary keys or non-editable fields (like ID on edit) should be read-only
              const isReadOnly = f.editable === false && initialData;

              // 1. SELECT TYPE FIELD
              if (f.type === 'select' && f.chipGroup && metadata?.chips[f.chipGroup]) {
                const options = metadata.chips[f.chipGroup];
                return (
                  <Grid item xs={12} key={f.name}>
                    <FormControl 
                      fullWidth 
                      error={!!errors[f.name]}
                      size="medium"
                    >
                      <InputLabel>{f.label}</InputLabel>
                      <Select
                        label={f.label}
                        value={formData[f.name] || ''}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                        disabled={isReadOnly}
                      >
                        {options.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors[f.name] && <FormHelperText>{errors[f.name]}</FormHelperText>}
                    </FormControl>
                  </Grid>
                );
              }

              // 2. REFERENCE TYPE FIELD (Lookups)
              if (f.type === 'ref' && f.refModule) {
                const options = getReferenceOptions(f.refModule);
                return (
                  <Grid item xs={12} key={f.name}>
                    <FormControl 
                      fullWidth 
                      error={!!errors[f.name]}
                      size="medium"
                    >
                      <InputLabel>{f.label}</InputLabel>
                      <Select
                        label={f.label}
                        value={formData[f.name] || ''}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                        disabled={isReadOnly}
                      >
                        {options.map(opt => (
                          <MenuItem key={opt.id} value={opt.id}>
                            {opt.name ? `${opt.name} (${opt.id})` : opt.id}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors[f.name] && <FormHelperText>{errors[f.name]}</FormHelperText>}
                    </FormControl>
                  </Grid>
                );
              }

              // 3. TEXT AREA FIELD
              if (f.type === 'textarea') {
                return (
                  <Grid item xs={12} key={f.name}>
                    <TextField
                      label={f.label}
                      multiline
                      rows={3}
                      fullWidth
                      value={formData[f.name] || ''}
                      onChange={(e) => handleChange(f.name, e.target.value)}
                      error={!!errors[f.name]}
                      helperText={errors[f.name]}
                      disabled={isReadOnly}
                    />
                  </Grid>
                );
              }

              // 4. STANDARD TEXT/NUMBER/DATE FIELD
              return (
                <Grid item xs={f.name === 'id' ? 12 : 6} key={f.name}>
                  <TextField
                    label={f.label}
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    fullWidth
                    InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
                    value={formData[f.name] === undefined ? '' : formData[f.name]}
                    onChange={(e) => handleChange(f.name, e.target.value, f.type)}
                    error={!!errors[f.name]}
                    helperText={errors[f.name]}
                    disabled={isReadOnly}
                  />
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderColor: '#E2E8F0', color: '#64748B' }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" sx={{ backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' } }}>
            Save Record
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DynamicForm;
