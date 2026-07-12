import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Button, 
  Box, 
  Paper,
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormHelperText,
  Grid,
  Chip,
  Switch,
  FormControlLabel,
  Typography
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

  // Inline creation states for property / project pitches
  const [nestedDealerData, setNestedDealerData] = useState({});
  const [nestedPropertyData, setNestedPropertyData] = useState({});
  const [nestedProjectData, setNestedProjectData] = useState({});
  const [pitchedItemType, setPitchedItemType] = useState('Property');

  // Dynamic field filtering based on leadType or queryType and dealer conditional checks
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
    if (moduleKey === 'properties') {
      if (f.name === 'dealerId' || f.name === 'dealer_deal_type') {
        return formData.dealer_owner_booked === 'Dealer';
      }
      if (f.name === 'booked_by_customer_id') {
        return formData.dealer_owner_booked === 'Booked By Us';
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

      if (moduleKey === 'leads' || moduleKey === 'follow_ups' || moduleKey === 'queries') {
        fetchModuleData('projects');
      }

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
        
        const pitchedVal = initialData.pitchedPropertyId || '';
        if (pitchedVal.startsWith('PROJ-')) {
          setPitchedItemType('Project');
        } else {
          setPitchedItemType('Property');
        }
      } else {
        const defaultForm = {};
        fields.forEach(f => {
          defaultForm[f.name] = '';
        });
        setFormData(defaultForm);
        setCustomValues({});
        setPitchedItemType('Property');
      }
      
      setNestedDealerData({
        firm_name: '',
        address: '',
        sector_block: '',
        person_name: '',
        contact_num: '',
        contacted_num: '',
        remarks: '',
        callOutcome: 'Call Done'
      });

      setNestedPropertyData({
        contact_person_name: '',
        contact_number: '',
        dealer_owner_booked: 'Direct',
        dealerId: '',
        dealer_deal_type: '',
        booked_by_customer_id: '',
        locality: '',
        sector_block: '',
        size: '',
        demand: '',
        propertyType: 'Plot',
        r_c_i: 'Residential',
        status: 'Available'
      });
      setNestedProjectData({
        name: '',
        builder: 'DLF Group',
        locality: '',
        sector_block: '',
        type: 'Residential',
        property_category: 'Plot',
        pricing_details: '',
        plc_percent: '',
        status: 'Under Construction'
      });
      
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

   const resolvePitchedProperty = async (payload) => {
    if (payload.pitchedPropertyId === 'Other_Property') {
      let finalDealerId = nestedPropertyData.dealerId;
      if (nestedPropertyData.dealer_owner_booked === 'Dealer' && nestedPropertyData.dealerId === 'Other_Dealer') {
        const dealerRes = await createRecord('dealers', {
          ...nestedDealerData
        });
        if (dealerRes.success) {
          finalDealerId = dealerRes.data.id;
          fetchModuleData('dealers');
        } else {
          throw new Error(dealerRes.message || "Failed to auto-create associated dealer");
        }
      }
      const propRes = await createRecord('properties', {
        ...nestedPropertyData,
        dealerId: finalDealerId,
        date: new Date().toLocaleDateString('en-IN')
      });
      if (propRes.success) {
        payload.pitchedPropertyId = propRes.data.id;
        fetchModuleData('properties');
      } else {
        throw new Error(propRes.message || "Failed to auto-create pitched property");
      }
    } else if (payload.pitchedPropertyId === 'Other_Project') {
      const projRes = await createRecord('projects', {
        ...nestedProjectData
      });
      if (projRes.success) {
        payload.pitchedPropertyId = projRes.data.id;
        fetchModuleData('projects');
      } else {
        throw new Error(projRes.message || "Failed to auto-create pitched project");
      }
    }
    return payload;
  };

  const resolveDealerId = async (payload) => {
    if (moduleKey === 'properties' && payload.dealerId === 'Other_Dealer') {
      const dealerRes = await createRecord('dealers', {
        ...nestedDealerData
      });
      if (dealerRes.success) {
        payload.dealerId = dealerRes.data.id;
        fetchModuleData('dealers');
      } else {
        throw new Error(dealerRes.message || "Failed to auto-create associated dealer");
      }
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validate()) {
      try {
        let payload = { ...formData };
        fields.forEach(f => {
          if ((f.type === 'select' || f.type === 'ref') && formData[f.name] === 'Other') {
            payload[f.name] = customValues[f.name] || '';
          }
        });
        payload = await resolveDealerId(payload);
        payload = await resolvePitchedProperty(payload);
        onSubmit(payload);
      } catch (err) {
        setErrors({ submit: err.message });
      }
    }
  };

  const handleSaveAndAddAnother = async (e) => {
    e.preventDefault();
    if (validate()) {
      try {
        let payload = { ...formData };
        fields.forEach(f => {
          if ((f.type === 'select' || f.type === 'ref') && formData[f.name] === 'Other') {
            payload[f.name] = customValues[f.name] || '';
          }
        });
        payload = await resolveDealerId(payload);
        payload = await resolvePitchedProperty(payload);
        
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
      } catch (err) {
        setErrors({ submit: err.message });
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
                if (f.name === 'pitchedPropertyId') {
                  const propertiesList = moduleData.properties || [];
                  const projectsList = moduleData.projects || [];
                  
                  return (
                    <Grid item xs={12} key={f.name}>
                      <Box sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '12px', mb: 1, backgroundColor: '#F8FAFC' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: '#1E293B' }}>
                          Outreach Property/Project Pitch
                        </Typography>
                        
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Pitch Item Type</InputLabel>
                              <Select
                                value={pitchedItemType}
                                onChange={(e) => {
                                  setPitchedItemType(e.target.value);
                                  handleChange('pitchedPropertyId', '');
                                }}
                                label="Pitch Item Type"
                              >
                                <MenuItem value="Property">Property Listing</MenuItem>
                                <MenuItem value="Project">Builder Project</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>{pitchedItemType === 'Property' ? 'Select Property' : 'Select Project'}</InputLabel>
                              <Select
                                value={formData.pitchedPropertyId || ''}
                                onChange={(e) => handleChange('pitchedPropertyId', e.target.value)}
                                label={pitchedItemType === 'Property' ? 'Select Property' : 'Select Project'}
                              >
                                <MenuItem value="">-- None --</MenuItem>
                                {pitchedItemType === 'Property' ? (
                                  propertiesList.map(p => (
                                    <MenuItem key={p.id} value={p.id}>
                                      {p.locality} {p.sector_block ? `(Sector ${p.sector_block})` : ''} - ₹{p.demand} ({p.id})
                                    </MenuItem>
                                  ))
                                ) : (
                                  projectsList.map(p => (
                                    <MenuItem key={p.id} value={p.id}>
                                      {p.name} - {p.locality} ({p.id})
                                    </MenuItem>
                                  ))
                                )}
                                <MenuItem value={pitchedItemType === 'Property' ? 'Other_Property' : 'Other_Project'} sx={{ fontStyle: 'italic', fontWeight: 600, color: '#2563EB' }}>
                                  + Create New {pitchedItemType === 'Property' ? 'Property' : 'Project'}...
                                </MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>

                          {/* Inline Nested Property Form */}
                          {formData.pitchedPropertyId === 'Other_Property' && (
                            <Grid item xs={12}>
                              <Box sx={{ mt: 1, p: 2, border: '1px solid #E2E8F0', borderRadius: '12px', backgroundColor: '#FFFFFF' }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, mb: 1.5, display: 'block', color: '#64748B', textTransform: 'uppercase' }}>
                                  Create New Property Detail
                                </Typography>
                                <Grid container spacing={1.5}>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Contact Person Name" size="small" fullWidth value={nestedPropertyData.contact_person_name || ''} onChange={(e) => setNestedPropertyData(prev => ({ ...prev, contact_person_name: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Contact Number" size="small" fullWidth value={nestedPropertyData.contact_number || ''} onChange={(e) => setNestedPropertyData(prev => ({ ...prev, contact_number: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>Dealer/Owner/Booked</InputLabel>
                                      <Select
                                        value={nestedPropertyData.dealer_owner_booked || 'Direct'}
                                        onChange={(e) => setNestedPropertyData(prev => ({ ...prev, dealer_owner_booked: e.target.value }))}
                                        label="Dealer/Owner/Booked"
                                      >
                                        <MenuItem value="Dealer">Dealer</MenuItem>
                                        <MenuItem value="Direct">Direct</MenuItem>
                                        <MenuItem value="Booked By Us">Booked By Us</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>

                                  {nestedPropertyData.dealer_owner_booked === 'Dealer' && (
                                    <>
                                      <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth size="small">
                                          <InputLabel>Associated Dealer</InputLabel>
                                          <Select
                                            value={nestedPropertyData.dealerId || ''}
                                            onChange={(e) => setNestedPropertyData(prev => ({ ...prev, dealerId: e.target.value }))}
                                            label="Associated Dealer"
                                          >
                                            <MenuItem value="">-- Select --</MenuItem>
                                            {(moduleData.dealers || []).map(d => (
                                              <MenuItem key={d.id} value={d.id}>{d.firm_name} ({d.person_name})</MenuItem>
                                            ))}
                                            <MenuItem value="Other_Dealer" sx={{ fontStyle: 'italic', fontWeight: 600, color: '#2563EB' }}>
                                              + Add New Property Dealer
                                            </MenuItem>
                                          </Select>
                                        </FormControl>
                                      </Grid>
                                      <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth size="small">
                                          <InputLabel>Dealer Deal Type</InputLabel>
                                          <Select
                                            value={nestedPropertyData.dealer_deal_type || ''}
                                            onChange={(e) => setNestedPropertyData(prev => ({ ...prev, dealer_deal_type: e.target.value }))}
                                            label="Dealer Deal Type"
                                          >
                                            <MenuItem value="Dealer To Dealer">Dealer To Dealer</MenuItem>
                                            <MenuItem value="Direct">Direct</MenuItem>
                                            <MenuItem value="Booked">Booked</MenuItem>
                                          </Select>
                                        </FormControl>
                                      </Grid>

                                      {nestedPropertyData.dealerId === 'Other_Dealer' && (
                                        <Grid item xs={12}>
                                          <Paper sx={{ p: 2, border: '1px solid #3B82F6', borderRadius: '12px', backgroundColor: '#EFF6FF', boxShadow: 'none' }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: '#1E3A8A' }}>
                                              Create New Property Dealer
                                            </Typography>
                                            <Grid container spacing={1.5}>
                                              <Grid item xs={12} sm={6}>
                                                <TextField label="Firm Name" size="small" fullWidth required value={nestedDealerData.firm_name || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, firm_name: e.target.value }))} />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField label="Person Name" size="small" fullWidth required value={nestedDealerData.person_name || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, person_name: e.target.value }))} />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField label="Contact Number" size="small" fullWidth required value={nestedDealerData.contact_num || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, contact_num: e.target.value }))} />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField label="Contacted Number" size="small" fullWidth value={nestedDealerData.contacted_num || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, contacted_num: e.target.value }))} />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField label="Area/Sector/Block" size="small" fullWidth required value={nestedDealerData.sector_block || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, sector_block: e.target.value }))} />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField label="Address" size="small" fullWidth value={nestedDealerData.address || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, address: e.target.value }))} />
                                              </Grid>
                                              <Grid item xs={12}>
                                                <TextField label="Call Notes/Remarks" size="small" fullWidth multiline rows={2} value={nestedDealerData.remarks || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, remarks: e.target.value }))} />
                                              </Grid>
                                            </Grid>
                                          </Paper>
                                        </Grid>
                                      )}
                                    </>
                                  )}

                                  {nestedPropertyData.dealer_owner_booked === 'Booked By Us' && (
                                    <Grid item xs={12} sm={6}>
                                      <FormControl fullWidth size="small">
                                        <InputLabel>Booked By (Customer)</InputLabel>
                                        <Select
                                          value={nestedPropertyData.booked_by_customer_id || ''}
                                          onChange={(e) => setNestedPropertyData(prev => ({ ...prev, booked_by_customer_id: e.target.value }))}
                                          label="Booked By (Customer)"
                                        >
                                          <MenuItem value="">-- Select --</MenuItem>
                                          {(moduleData.customers || []).map(c => (
                                            <MenuItem key={c.id} value={c.id}>{c.name} ({c.id})</MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    </Grid>
                                  )}

                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Locality" size="small" fullWidth value={nestedPropertyData.locality || ''} onChange={(e) => setNestedPropertyData(prev => ({ ...prev, locality: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Sector/Block" size="small" fullWidth value={nestedPropertyData.sector_block || ''} onChange={(e) => setNestedPropertyData(prev => ({ ...prev, sector_block: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Size of Property" size="small" fullWidth value={nestedPropertyData.size || ''} onChange={(e) => setNestedPropertyData(prev => ({ ...prev, size: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Demand (Price)" size="small" fullWidth value={nestedPropertyData.demand || ''} onChange={(e) => setNestedPropertyData(prev => ({ ...prev, demand: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>Property Type</InputLabel>
                                      <Select
                                        value={nestedPropertyData.propertyType || 'Plot'}
                                        onChange={(e) => setNestedPropertyData(prev => ({ ...prev, propertyType: e.target.value }))}
                                        label="Property Type"
                                      >
                                        <MenuItem value="Villa">Luxury Villa</MenuItem>
                                        <MenuItem value="Plot">Residential Land Plot</MenuItem>
                                        <MenuItem value="Apartment">Multistory Apartment</MenuItem>
                                        <MenuItem value="Commercial">Retail/Office Space</MenuItem>
                                        <MenuItem value="LOI">LOI</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>R/C/I</InputLabel>
                                      <Select
                                        value={nestedPropertyData.r_c_i || 'Residential'}
                                        onChange={(e) => setNestedPropertyData(prev => ({ ...prev, r_c_i: e.target.value }))}
                                        label="R/C/I"
                                      >
                                        <MenuItem value="Residential">Residential</MenuItem>
                                        <MenuItem value="Commercial">Commercial</MenuItem>
                                        <MenuItem value="Industrial">Industrial</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                </Grid>
                              </Box>
                            </Grid>
                          )}

                          {/* Inline Nested Project Form */}
                          {formData.pitchedPropertyId === 'Other_Project' && (
                            <Grid item xs={12}>
                              <Box sx={{ mt: 1, p: 2, border: '1px solid #E2E8F0', borderRadius: '12px', backgroundColor: '#FFFFFF' }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, mb: 1.5, display: 'block', color: '#64748B', textTransform: 'uppercase' }}>
                                  Create New Project Detail
                                </Typography>
                                <Grid container spacing={1.5}>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Project Name" size="small" fullWidth value={nestedProjectData.name || ''} onChange={(e) => setNestedProjectData(prev => ({ ...prev, name: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>Developer</InputLabel>
                                      <Select
                                        value={nestedProjectData.builder || 'DLF Group'}
                                        onChange={(e) => setNestedProjectData(prev => ({ ...prev, builder: e.target.value }))}
                                        label="Developer"
                                      >
                                        <MenuItem value="Gagan Developers">Gagan Developers & Infra</MenuItem>
                                        <MenuItem value="DLF Group">DLF Group India</MenuItem>
                                        <MenuItem value="Omaxe">Omaxe Construction</MenuItem>
                                        <MenuItem value="Hero Homes">Hero Realty Homes</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Locality" size="small" fullWidth value={nestedProjectData.locality || ''} onChange={(e) => setNestedProjectData(prev => ({ ...prev, locality: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Sector/Block" size="small" fullWidth value={nestedProjectData.sector_block || ''} onChange={(e) => setNestedProjectData(prev => ({ ...prev, sector_block: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>Type (R/C/I)</InputLabel>
                                      <Select
                                        value={nestedProjectData.type || 'Residential'}
                                        onChange={(e) => setNestedProjectData(prev => ({ ...prev, type: e.target.value }))}
                                        label="Type (R/C/I)"
                                      >
                                        <MenuItem value="Residential">Residential</MenuItem>
                                        <MenuItem value="Commercial">Commercial</MenuItem>
                                        <MenuItem value="Industrial">Industrial</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>Category</InputLabel>
                                      <Select
                                        value={nestedProjectData.property_category || 'Plot'}
                                        onChange={(e) => setNestedProjectData(prev => ({ ...prev, property_category: e.target.value }))}
                                        label="Category"
                                      >
                                        <MenuItem value="Villa">Luxury Villa</MenuItem>
                                        <MenuItem value="Plot">Residential Land Plot</MenuItem>
                                        <MenuItem value="Apartment">Multistory Apartment</MenuItem>
                                        <MenuItem value="Commercial">Retail/Office Space</MenuItem>
                                        <MenuItem value="LOI">LOI</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="Pricing Details" size="small" fullWidth value={nestedProjectData.pricing_details || ''} onChange={(e) => setNestedProjectData(prev => ({ ...prev, pricing_details: e.target.value }))} />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField label="PLC %" size="small" fullWidth value={nestedProjectData.plc_percent || ''} onChange={(e) => setNestedProjectData(prev => ({ ...prev, plc_percent: e.target.value }))} />
                                  </Grid>
                                </Grid>
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    </Grid>
                  );
                }

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
                        {f.refModule === 'dealers' && (
                          <MenuItem value="Other_Dealer" sx={{ fontStyle: 'italic', fontWeight: 600, color: '#2563EB' }}>
                            + Add New Property Dealer
                          </MenuItem>
                        )}
                        <MenuItem value="Other" sx={{ fontStyle: 'italic', fontWeight: 600, color: '#2563EB' }}>
                          Other (Specify...)
                        </MenuItem>
                      </Select>
                      {errors[f.name] && <FormHelperText>{errors[f.name]}</FormHelperText>}
                    </FormControl>

                    {formData[f.name] === 'Other_Dealer' && (
                      <Paper sx={{ p: 2.5, mt: 1.5, border: '1px solid #3B82F6', borderRadius: '12px', backgroundColor: '#EFF6FF', boxShadow: 'none' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: '#1E3A8A', fontFamily: 'Poppins' }}>
                          Create New Property Dealer
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <TextField label="Firm Name" size="small" fullWidth required value={nestedDealerData.firm_name || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, firm_name: e.target.value }))} />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField label="Person Name" size="small" fullWidth required value={nestedDealerData.person_name || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, person_name: e.target.value }))} />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField label="Contact Number" size="small" fullWidth required value={nestedDealerData.contact_num || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, contact_num: e.target.value }))} />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField label="Contacted Number" size="small" fullWidth value={nestedDealerData.contacted_num || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, contacted_num: e.target.value }))} />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField label="Area/Sector/Block" size="small" fullWidth required value={nestedDealerData.sector_block || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, sector_block: e.target.value }))} />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField label="Address" size="small" fullWidth value={nestedDealerData.address || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, address: e.target.value }))} />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField label="Call Notes/Remarks" size="small" fullWidth multiline rows={2} value={nestedDealerData.remarks || ''} onChange={(e) => setNestedDealerData(prev => ({ ...prev, remarks: e.target.value }))} />
                          </Grid>
                        </Grid>
                      </Paper>
                    )}

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
