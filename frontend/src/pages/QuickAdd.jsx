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
  Grid
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../context/AppContext';
import * as Icons from 'lucide-react';

const QuickAdd = () => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState('');
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/metadata`)
      .then(res => {
        setMetadata(res.data);
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

  const modulesList = metadata ? Object.values(metadata.modules).filter(m => m.id !== 'activity_logs' && m.id !== 'remarks' && m.id !== 'documents') : [];

  const fields = selectedModule && metadata?.modules[selectedModule]
    ? metadata.modules[selectedModule].fields.filter(f => f.name !== 'id' && f.editable !== false)
    : [];

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({
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
      const response = await axios.post(`${API_BASE_URL}/public/quick-add`, {
        module: selectedModule,
        payload: formData,
        key: 'gagan_employee_intake_2026'
      });

      if (response.data.success) {
        setSubmitSuccess(true);
        setFormData({});
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
              <form onSubmit={handleSubmit}>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {fields.map(f => {
                    const value = formData[f.name] || '';
                    const isSelect = f.type === 'select' && f.chipGroup && metadata?.chips[f.chipGroup];
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
                                '.MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B82F6' }
                              }}
                            >
                              {metadata.chips[f.chipGroup].map(choice => (
                                <MenuItem key={choice} value={choice}>{choice}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
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
                              input: { color: '#FFFFFF' },
                              backgroundColor: '#0F172A',
                              borderRadius: '8px',
                              '.MuiInputLabel-root': { color: '#94A3B8' },
                              '.MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B82F6' }
                            }}
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
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default QuickAdd;
