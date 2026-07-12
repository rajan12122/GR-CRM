import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Card, 
  CardContent, 
  Typography, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Button, 
  Alert, 
  CircularProgress,
  Grid,
  FormControlLabel,
  Switch,
  Chip
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../context/AppContext';
import * as Icons from 'lucide-react';

const QuickAdd = () => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState('');
  const [formData, setFormData] = useState({});
  const [customValues, setCustomValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [lookups, setLookups] = useState({});

  useEffect(() => {
    axios.get(`${API_BASE_URL}/public/metadata`)
      .then(async (res) => {
        setMetadata(res.data);
        
        // Find all referenced modules dynamically
        const refModules = new Set();
        Object.values(res.data.modules).forEach(mod => {
          mod.fields.forEach(f => {
            if (f.type === 'ref' && f.refModule) {
              refModules.add(f.refModule);
            }
          });
        });

        // Fetch lookups for those referenced modules
        const promises = Array.from(refModules).map(mModule => {
          return axios.get(`${API_BASE_URL}/public/lookup/${mModule}`)
            .then(lRes => ({ module: mModule, data: lRes.data }))
            .catch(() => ({ module: mModule, data: [] }));
        });

        const results = await Promise.all(promises);
        const lookupMap = {};
        results.forEach(r => {
          lookupMap[r.module] = r.data;
        });

        setLookups(lookupMap);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching metadata for quick-add:', err);
        setSubmitError('Failed to load system metadata configurations.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0F172A' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const allowedModuleIds = ['customers', 'leads', 'properties', 'projects', 'daily_prices', 'dealers', 'queries'];
  const modulesList = metadata 
    ? Object.values(metadata.modules).filter(m => allowedModuleIds.includes(m.id)) 
    : [];

  const fields = selectedModule && metadata?.modules[selectedModule]
    ? metadata.modules[selectedModule].fields.filter(f => f.name !== 'id' && f.editable !== false)
    : [];

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleCustomInputChange = (fieldName, value) => {
    setCustomValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess(false);
    setSubmitting(true);

    try {
      // Map custom "Other" fields into the submitted payload
      const payload = { ...formData };
      fields.forEach(f => {
        if ((f.type === 'select' || f.type === 'ref') && formData[f.name] === 'Other') {
          payload[f.name] = customValues[f.name] || '';
        }
      });

      const response = await axios.post(`${API_BASE_URL}/public/quick-add`, {
        module: selectedModule,
        payload: payload,
        key: 'gagan_employee_intake_2026'
      });

      if (response.data.success) {
        setSubmitSuccess(true);
        setFormData({});
        setCustomValues({});
      } else {
        setSubmitError(response.data.error || 'Failed to submit data.');
      }
    } catch (err) {
      console.error(err);
      setSubmitError(err.response?.data?.error || 'A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', py: 4, backgroundColor: '#0F172A', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#1E293B', color: '#F8FAFC' }}>
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '16px', backgroundColor: 'rgba(37,99,235,0.1)', mb: 2 }}>
                <Icons.Layers size={32} style={{ color: '#3B82F6' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'Poppins', color: '#FFFFFF', mb: 1 }}>
                Quick-Add Intake Portal
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                Select a tab sheet to quickly inject a new record directly into Gagan Realtech CRM.
              </Typography>
            </Box>

            {submitError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setSubmitError('')}>
                {submitError}
              </Alert>
            )}

            {submitSuccess && (
              <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setSubmitSuccess(false)}>
                Record created successfully!
              </Alert>
            )}

            {/* Dropdown module selector */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="module-select-label" sx={{ color: '#94A3B8' }}>Select Module Sheet</InputLabel>
              <Select
                labelId="module-select-label"
                value={selectedModule}
                label="Select Module Sheet"
                onChange={(e) => {
                  setSelectedModule(e.target.value);
                  setFormData({});
                  setSubmitError('');
                  setSubmitSuccess(false);
                }}
                sx={{ 
                  color: '#FFFFFF',
                  backgroundColor: '#0F172A',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B82F6' }
                }}
              >
                {modulesList.map(mod => (
                  <MenuItem key={mod.id} value={mod.id}>{mod.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Dynamic Form fields */}
            {selectedModule && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2.5 }}>
                  <Button 
                    startIcon={<Icons.ArrowLeft size={16} />}
                    onClick={() => {
                      setSelectedModule('');
                      setFormData({});
                      setCustomValues({});
                      setSubmitError('');
                      setSubmitSuccess(false);
                    }}
                    sx={{ color: '#3B82F6', textTransform: 'none', fontWeight: 700 }}
                    size="small"
                  >
                    Change Sheet / Go Back
                  </Button>
                </Box>
                <form onSubmit={handleSubmit}>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                  {fields.map(f => {
                    const value = formData[f.name] || '';
                    const isSelect = f.type === 'select' && f.chipGroup && metadata?.chips[f.chipGroup];
                    const isRef = f.type === 'ref' && f.refModule && lookups[f.refModule];
                    const isMultiRef = f.type === 'multiref' && f.refModule && lookups[f.refModule];
                    const isBoolean = f.type === 'boolean';
                    const isDate = f.type === 'date';

                    return (
                      <Grid item xs={12} key={f.name}>
                        {isSelect ? (
                          <FormControl fullWidth>
                            <InputLabel id={`label-${f.name}`} sx={{ color: '#94A3B8' }}>{f.label} {f.required && '*'}</InputLabel>
                            <Select
                              labelId={`label-${f.name}`}
                              value={value}
                              label={`${f.label} ${f.required ? '*' : ''}`}
                              required={f.required}
                              onChange={(e) => handleInputChange(f.name, e.target.value)}
                              sx={{ 
                                color: '#FFFFFF',
                                backgroundColor: '#0F172A',
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#0F172A',
                                  color: '#FFFFFF'
                                },
                                '.MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B82F6' }
                              }}
                            >
                              {metadata.chips[f.chipGroup].map(choice => {
                                const choiceVal = typeof choice === 'object' ? choice.value : choice;
                                const choiceLabel = typeof choice === 'object' ? choice.label : choice;
                                return (
                                  <MenuItem key={choiceVal} value={choiceVal}>{choiceLabel}</MenuItem>
                                );
                              })}
                              <MenuItem value="Other" sx={{ fontStyle: 'italic', fontWeight: 600, color: '#3B82F6' }}>
                                Other (Specify...)
                              </MenuItem>
                            </Select>
                          </FormControl>
                        ) : isRef ? (
                          <FormControl fullWidth>
                            <InputLabel id={`label-${f.name}`} sx={{ color: '#94A3B8' }}>{f.label} {f.required && '*'}</InputLabel>
                            <Select
                              labelId={`label-${f.name}`}
                              value={value}
                              label={`${f.label} ${f.required ? '*' : ''}`}
                              required={f.required}
                              onChange={(e) => handleInputChange(f.name, e.target.value)}
                              sx={{ 
                                color: '#FFFFFF',
                                backgroundColor: '#0F172A',
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#0F172A',
                                  color: '#FFFFFF'
                                },
                                '.MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B82F6' }
                              }}
                            >
                              {lookups[f.refModule].map(opt => (
                                <MenuItem key={opt.id} value={opt.id}>{opt.name} ({opt.id})</MenuItem>
                              ))}
                              <MenuItem value="Other" sx={{ fontStyle: 'italic', fontWeight: 600, color: '#3B82F6' }}>
                                Other (Specify...)
                              </MenuItem>
                            </Select>
                          </FormControl>
                        ) : isMultiRef ? (
                          <FormControl fullWidth>
                            <InputLabel id={`label-${f.name}`} sx={{ color: '#94A3B8' }}>{f.label} {f.required && '*'}</InputLabel>
                            <Select
                              labelId={`label-${f.name}`}
                              multiple
                              value={Array.isArray(value) ? value : value ? String(value).split(',').filter(Boolean) : []}
                              label={`${f.label} ${f.required ? '*' : ''}`}
                              required={f.required}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleInputChange(f.name, Array.isArray(val) ? val.join(',') : val);
                              }}
                              renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {selected.map((itemVal) => {
                                    const opt = lookups[f.refModule].find(o => String(o.id) === String(itemVal));
                                    return (
                                      <Chip 
                                        key={itemVal} 
                                        label={opt ? opt.name : itemVal} 
                                        size="small" 
                                        sx={{ 
                                          borderRadius: '4px',
                                          backgroundColor: '#2563EB',
                                          color: '#FFFFFF',
                                          height: 20,
                                          fontSize: '11px',
                                          fontWeight: 600
                                        }}
                                      />
                                    );
                                  })}
                                </Box>
                              )}
                              sx={{ 
                                color: '#FFFFFF',
                                backgroundColor: '#0F172A',
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#0F172A',
                                  color: '#FFFFFF'
                                },
                                '.MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B82F6' }
                              }}
                            >
                              {lookups[f.refModule].map(opt => (
                                <MenuItem key={opt.id} value={opt.id}>{opt.name} ({opt.id})</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : isBoolean ? (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={!!value}
                                onChange={(e) => handleInputChange(f.name, e.target.checked)}
                                color="primary"
                              />
                            }
                            label={
                              <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
                                {f.label}
                              </Typography>
                            }
                            sx={{ color: '#F8FAFC', ml: 0.5 }}
                          />
                        ) : (
                          <TextField
                            fullWidth
                            label={f.label}
                            required={f.required}
                            type={isDate ? 'date' : 'text'}
                            value={value}
                            InputLabelProps={isDate ? { shrink: true } : {}}
                            placeholder={f.label}
                            onChange={(e) => handleInputChange(f.name, e.target.value)}
                            sx={{ 
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: '#0F172A',
                                color: '#FFFFFF',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B82F6' }
                              },
                              input: { 
                                color: '#FFFFFF',
                                '&:-webkit-autofill': {
                                  WebkitBoxShadow: '0 0 0 1000px #0f172a inset !important',
                                  WebkitTextFillColor: '#ffffff !important'
                                }
                              },
                              '.MuiInputLabel-root': { color: '#94A3B8' }
                            }}
                          />
                        )}

                        {/* Custom 'Other' specification text field overlay */}
                        {(isSelect || isRef) && value === 'Other' && (
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label={`Specify Custom ${f.label}`}
                            value={customValues[f.name] || ''}
                            onChange={(e) => handleCustomInputChange(f.name, e.target.value)}
                            placeholder="Type custom details here..."
                            sx={{ 
                              mt: 1.5,
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: '#0F172A',
                                color: '#FFFFFF',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B82F6' }
                              },
                              input: { color: '#FFFFFF' },
                              '.MuiInputLabel-root': { color: '#94A3B8' }
                            }}
                            required
                          />
                        )}
                      </Grid>
                    );
                  })}
                </Grid>

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={submitting || fields.length === 0}
                  sx={{ 
                    py: 1.5, 
                    fontWeight: 700, 
                    borderRadius: '12px', 
                    backgroundColor: '#3B82F6', 
                    '&:hover': { backgroundColor: '#2563EB' },
                    textTransform: 'none',
                    fontFamily: 'Poppins'
                  }}
                >
                  {submitting ? 'Submitting Record...' : 'Submit Entry'}
                </Button>
              </form>
            </Box>
          )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default QuickAdd;
