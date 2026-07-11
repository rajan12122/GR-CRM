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
  Grid,
  Chip,
  Switch,
  FormControlLabel
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
  const { moduleData, fetchModuleData, metadata, createRecord } = useApp();
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [customValues, setCustomValues] = useState({});

  // Dynamic field filtering based on leadType or queryType
  const filteredFields = fields.filter(f => {
    if (moduleKey === 'leads') {
      const type = formData.leadType;
      if (type === 'Buyer') {
        if (f.name === 'demand') return false;
      }
      if (type === 'Seller') {
        if (f.name === 'budget') return false;
      }
    }
    if (moduleKey === 'queries') {
      const type = formData.queryType;
      if (type === 'Buy Property') {
        if (f.name === 'demand') return false;
      }
      if (type === 'Sell Property') {
        if (f.name === 'budget') return false;
      }
    }
    return true;
  });

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
        const initialForm = {};
        const initialCustom = {};
        fields.forEach(f => {
          const val = initialData[f.name];
          if (f.type === 'select' && f.chipGroup && metadata?.chips[f.chipGroup]) {
            const options = metadata.chips[f.chipGroup];
            const hasOption = options.some(opt => opt.value === val);
            if (val && !hasOption) {
              initialForm[f.name] = 'Other';
              initialCustom[f.name] = val;
            } else {
              initialForm[f.name] = val || '';
            }
          } else if (f.type === 'ref' && f.refModule) {
            const options = moduleData[f.refModule] || [];
            const hasOption = options.some(opt => opt.id === val);
            if (val && !hasOption) {
              initialForm[f.name] = 'Other';
              initialCustom[f.name] = val;
            } else {
              initialForm[f.name] = val || '';
            }
          } else {
            initialForm[f.name] = val || '';
          }
        });
        setFormData(initialForm);
        setCustomValues(initialCustom);
      } else {
        const defaultForm = {};
        fields.forEach(f => {
          defaultForm[f.name] = '';
        });
        setFormData(defaultForm);
        setCustomValues({});
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

  const handleCustomChange = (name, val) => {
    setCustomValues(prev => ({
      ...prev,
      [name]: val
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    filteredFields.forEach(f => {
      if (f.name === 'id' && !initialData) return; // Skip validation for auto-assigned ID
      
      if (f.required) {
        const val = formData[f.name];
        if (val === 'Other') {
          const custVal = customValues[f.name];
          if (!custVal || String(custVal).trim() === '') {
            newErrors[f.name] = `Please specify the custom ${f.label}.`;
          }
        } else if (val === undefined || val === null || String(val).trim() === '') {
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
      const payload = { ...formData };
      fields.forEach(f => {
        if ((f.type === 'select' || f.type === 'ref') && formData[f.name] === 'Other') {
          payload[f.name] = customValues[f.name] || '';
        }
      });
      onSubmit(payload);
    }
  };

  const handleSaveAndAddAnother = async (e) => {
    e.preventDefault();
    if (validate()) {
      const payload = { ...formData };
      fields.forEach(f => {
        if ((f.type === 'select' || f.type === 'ref') && formData[f.name] === 'Other') {
          payload[f.name] = customValues[f.name] || '';
        }
      });
      
      const res = await createRecord(moduleKey, payload);
      if (res.success) {
        // Clear all fields to let user enter next property
        const defaultForm = {};
        fields.forEach(f => {
          defaultForm[f.name] = '';
        });
        setFormData(defaultForm);
        setCustomValues({});
        setErrors({});
        fetchModuleData(moduleKey);
      } else {
        setErrors({ submit: res.message || 'Failed to save record.' });
      }
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
          {errors.submit && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {errors.submit}
            </Alert>
          )}
          <Grid container spacing={2}>
            {filteredFields.map(f => {
              if (f.name === 'id' && !initialData) return null; // Hide auto-generated ID field on create
              
              // Primary keys or non-editable fields (like ID on edit) should be read-only
              const isReadOnly = f.editable === false && initialData;

              // 1. SELECT TYPE FIELD
              if (f.type === 'select' && f.chipGroup && metadata?.chips[f.chipGroup]) {
                const options = metadata.chips[f.chipGroup];
                const isOther = formData[f.name] === 'Other';
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
                        <MenuItem value="Other" sx={{ fontStyle: 'italic', fontWeight: 600, color: '#2563EB' }}>
                          Other (Specify...)
                        </MenuItem>
                      </Select>
                      {errors[f.name] && <FormHelperText>{errors[f.name]}</FormHelperText>}
                    </FormControl>

                    {isOther && (
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label={`Specify Custom ${f.label}`}
                        value={customValues[f.name] || ''}
                        onChange={(e) => handleCustomChange(f.name, e.target.value)}
                        placeholder="Type custom details here..."
                        sx={{ mt: 1.5 }}
                        required
                      />
                    )}
                  </Grid>
                );
              }

              // 2. REFERENCE TYPE FIELD (Lookups)
              if (f.type === 'ref' && f.refModule) {
                const options = getReferenceOptions(f.refModule);
                const isOther = formData[f.name] === 'Other';
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
                        <MenuItem value="Other" sx={{ fontStyle: 'italic', fontWeight: 600, color: '#2563EB' }}>
                          Other (Specify...)
                        </MenuItem>
                      </Select>
                      {errors[f.name] && <FormHelperText>{errors[f.name]}</FormHelperText>}
                    </FormControl>

                    {isOther && (
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label={`Specify Custom ${f.label}`}
                        value={customValues[f.name] || ''}
                        onChange={(e) => handleCustomChange(f.name, e.target.value)}
                        placeholder="Type custom reference here..."
                        sx={{ mt: 1.5 }}
                        required
                      />
                    )}
                  </Grid>
                );
              }

              // 2.5 MULTI-REFERENCE TYPE FIELD (Multi-Select Lookups)
              if (f.type === 'multiref' && f.refModule) {
                const options = getReferenceOptions(f.refModule);
                const valArray = Array.isArray(formData[f.name]) 
                  ? formData[f.name] 
                  : formData[f.name] 
                    ? String(formData[f.name]).split(',').filter(Boolean) 
                    : [];
                
                return (
                  <Grid item xs={12} key={f.name}>
                    <FormControl 
                      fullWidth 
                      error={!!errors[f.name]}
                      size="medium"
                    >
                      <InputLabel>{f.label}</InputLabel>
                      <Select
                        multiple
                        label={f.label}
                        value={valArray}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleChange(f.name, Array.isArray(val) ? val.join(',') : val);
                        }}
                        disabled={isReadOnly}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const emp = options.find(o => String(o.id) === String(value));
                              return (
                                <Chip 
                                  key={value} 
                                  label={emp ? emp.name : value} 
                                  size="small" 
                                  sx={{ borderRadius: '4px' }}
                                />
                              );
                            })}
                          </Box>
                        )}
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

              // 2.7 BOOLEAN / SWITCH FIELD
              if (f.type === 'boolean') {
                return (
                  <Grid item xs={12} key={f.name}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!formData[f.name]}
                          onChange={(e) => handleChange(f.name, e.target.checked)}
                          disabled={isReadOnly}
                          color="primary"
                        />
                      }
                      label={f.label}
                    />
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
                    type={f.name === 'password' ? 'password' : (f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text')}
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
        
        <DialogActions sx={{ px: 3, pb: 2.5, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderColor: '#E2E8F0', color: '#64748B', textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          {!initialData && moduleKey === 'properties' && (
            <Button onClick={handleSaveAndAddAnother} variant="outlined" color="primary" sx={{ textTransform: 'none', fontWeight: 700 }}>
              Save & Add Another Property
            </Button>
          )}
          <Button type="submit" variant="contained" sx={{ backgroundColor: '#2563EB', '&:hover': { backgroundColor: '#1D4ED8' }, textTransform: 'none', fontWeight: 700 }}>
            Save Record
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DynamicForm;
