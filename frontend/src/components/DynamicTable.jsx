import React, { useState, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  TextField, 
  InputAdornment, 
  IconButton, 
  Button, 
  Menu, 
  MenuItem, 
  Checkbox, 
  FormControlLabel,
  TablePagination,
  Box,
  Typography,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';

const DynamicTable = ({ 
  moduleKey, 
  records, 
  fields, 
  onEditClick, 
  onDeleteClick, 
  onInspectClick 
}) => {
  const { metadata } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Sorting State
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Column Visibility State (reads initial values from fields config)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const initial = {};
    fields.forEach(f => {
      initial[f.name] = f.showInTable !== false;
    });
    return initial;
  });

  // Advanced Stacked Filters State
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [stackedFilters, setStackedFilters] = useState({}); // e.g. { city: 'Mohali', stage: 'Negotiation' }

  // Column Visibility Dialog
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);

  // Handle Sort
  const handleSortRequest = (fieldName) => {
    const isAsc = sortField === fieldName && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortField(fieldName);
  };

  // Filter out records based on SearchTerm AND StackedFilters
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // 1. Check Global Search Match
      const matchesSearch = Object.keys(rec).some(key => {
        const val = rec[key];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(searchTerm.toLowerCase());
      });

      // 2. Check Stacked Filter Matches
      const matchesFilters = Object.keys(stackedFilters).every(key => {
        const filterVal = stackedFilters[key];
        if (!filterVal || filterVal === 'ALL') return true;
        
        const recordVal = rec[key];
        return String(recordVal) === String(filterVal);
      });

      return matchesSearch && matchesFilters;
    });
  }, [records, searchTerm, stackedFilters]);

  // Sort filtered records
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    sorted.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDirection === 'asc' 
          ? valA - valB 
          : valB - valA;
      }
    });
    return sorted;
  }, [filteredRecords, sortField, sortDirection]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedRecords.slice(start, start + rowsPerPage);
  }, [sortedRecords, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(paginatedRecords.map(r => r.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(prev => prev.filter(r => r !== id));
    } else {
      setSelectedRows(prev => [...prev, id]);
    }
  };

  // Render chip for status or ref value
  const renderCellContent = (rec, field) => {
    const val = rec[field.name];
    if (val === undefined || val === null) return '';

    // If it's a chip dropdown option, look up color in metadata
    if (field.type === 'select' && field.chipGroup && metadata?.chips[field.chipGroup]) {
      const chipConfig = metadata.chips[field.chipGroup].find(c => c.value === val);
      return (
        <Chip 
          label={chipConfig?.label || val} 
          size="small"
          sx={{ 
            backgroundColor: chipConfig?.color ? `${chipConfig.color}15` : '#F1F5F9',
            color: chipConfig?.color || '#475569',
            border: `1px solid ${chipConfig?.color ? `${chipConfig.color}30` : '#E2E8F0'}`,
            fontWeight: 600,
            fontSize: '11px',
            borderRadius: '6px'
          }}
        />
      );
    }

    if (field.type === 'ref') {
      return (
        <Chip 
          label={val} 
          size="small"
          onClick={() => onInspectClick(field.refModule, val)}
          sx={{ cursor: 'pointer', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}
        />
      );
    }

    if (field.name === 'price' || field.name === 'budget' || field.name === 'salary' || field.name === 'salePrice') {
      return `₹${Number(val).toLocaleString('en-IN')}`;
    }

    return String(val);
  };

  // Stacked Filters generation helper
  // Extract all distinct options for select-type fields dynamically to display in the filter sheet!
  const filterOptions = useMemo(() => {
    const options = {};
    fields.forEach(f => {
      if (f.type === 'select' && f.chipGroup && metadata?.chips[f.chipGroup]) {
        options[f.name] = metadata.chips[f.chipGroup];
      }
    });
    return options;
  }, [fields, metadata]);

  const handleFilterChange = (fieldName, val) => {
    setStackedFilters(prev => ({
      ...prev,
      [fieldName]: val === 'ALL' ? undefined : val
    }));
    setPage(0);
  };

  // Excel / CSV Export
  const handleExportCSV = () => {
    const headers = fields.filter(f => visibleColumns[f.name]).map(f => f.label);
    const keys = fields.filter(f => visibleColumns[f.name]).map(f => f.name);
    
    // Check if exporting selected rows or all
    const targets = selectedRows.length > 0 
      ? records.filter(r => selectedRows.includes(r.id))
      : sortedRecords;

    let csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(",")].concat(
          targets.map(rec => keys.map(k => {
            const val = rec[k] || '';
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(","))
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gagan_realtech_${moduleKey}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ width: '100%' }}>
      
      {/* Table toolbar utilities */}
      <Box sx={{ p: 2.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        {/* Search */}
        <TextField
          size="small"
          placeholder="Filter table content..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Icons.Search size={16} color="#64748B" />
              </InputAdornment>
            )
          }}
          sx={{ width: 280 }}
        />

        {/* Action Controls */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {/* Stacked Filters Dropdown trigger */}
          {Object.keys(filterOptions).length > 0 && (
            <>
              <Button 
                variant="outlined" 
                startIcon={<Icons.SlidersHorizontal size={16} />}
                onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                sx={{ borderColor: '#E2E8F0', color: '#0F172A' }}
              >
                Filters
                {Object.keys(stackedFilters).filter(k => stackedFilters[k]).length > 0 && (
                  <Chip 
                    label={Object.keys(stackedFilters).filter(k => stackedFilters[k]).length} 
                    size="small" 
                    color="primary" 
                    sx={{ ml: 1, height: 18, fontSize: '10px', fontWeight: 800 }} 
                  />
                )}
              </Button>
              <Menu
                anchorEl={filterAnchorEl}
                open={Boolean(filterAnchorEl)}
                onClose={() => setFilterAnchorEl(null)}
                PaperProps={{ style: { padding: '16px', minWidth: 250 } }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Stack Filters</Typography>
                {Object.keys(filterOptions).map(fieldName => {
                  const fieldLabel = fields.find(f => f.name === fieldName)?.label || fieldName;
                  return (
                    <FormControl key={fieldName} size="small" fullWidth sx={{ mb: 2 }}>
                      <InputLabel>{fieldLabel}</InputLabel>
                      <Select
                        label={fieldLabel}
                        value={stackedFilters[fieldName] || 'ALL'}
                        onChange={(e) => handleFilterChange(fieldName, e.target.value)}
                      >
                        <MenuItem value="ALL"><em>All options</em></MenuItem>
                        {filterOptions[fieldName].map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                })}
                <Box display="flex" justifyContent="flex-end" gap={1}>
                  <Button size="small" onClick={() => { setStackedFilters({}); setFilterAnchorEl(null); }}>Reset</Button>
                  <Button size="small" variant="contained" onClick={() => setFilterAnchorEl(null)}>Apply</Button>
                </Box>
              </Menu>
            </>
          )}

          {/* Column toggler */}
          <Button 
            variant="outlined" 
            startIcon={<Icons.EyeOff size={16} />}
            onClick={() => setColMenuOpen(true)}
            sx={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            Columns
          </Button>

          {/* Export */}
          <Button 
            variant="outlined" 
            startIcon={<Icons.Download size={16} />}
            onClick={handleExportCSV}
            sx={{ borderColor: '#E2E8F0', color: '#0F172A' }}
          >
            CSV Export
          </Button>

          {selectedRows.length > 0 && onDeleteClick && (
            <Button
              variant="contained"
              color="error"
              startIcon={<Icons.Trash2 size={16} />}
              onClick={() => {
                selectedRows.forEach(id => onDeleteClick(id));
                setSelectedRows([]);
              }}
            >
              Bulk Delete ({selectedRows.length})
            </Button>
          )}
        </Box>
      </Box>

      {/* Grid Table Container */}
      <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #E2E8F0', borderRadius: 0 }}>
        <Table stickyHeader size="medium">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox 
                  indeterminate={selectedRows.length > 0 && selectedRows.length < paginatedRecords.length}
                  checked={paginatedRecords.length > 0 && selectedRows.length === paginatedRecords.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              
              {fields.map(f => {
                if (!visibleColumns[f.name]) return null;
                return (
                  <TableCell 
                    key={f.name}
                    onClick={() => handleSortRequest(f.name)}
                    sx={{ cursor: 'pointer', select: 'none', whiteSpace: 'nowrap' }}
                  >
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {f.label}
                      {sortField === f.name ? (
                        sortDirection === 'asc' ? <Icons.ArrowUp size={14} /> : <Icons.ArrowDown size={14} />
                      ) : (
                        <Icons.ArrowUpDown size={12} color="#94A3B8" />
                      )}
                    </Box>
                  </TableCell>
                );
              })}
              
              <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={fields.length + 2} align="center" sx={{ py: 6, color: '#64748B' }}>
                  <Icons.FolderOpen size={36} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <Typography variant="body2">No matching records found in database.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRecords.map((rec) => (
                <TableRow 
                  key={rec.id}
                  hover
                  selected={selectedRows.includes(rec.id)}
                >
                  <TableCell padding="checkbox">
                    <Checkbox 
                      checked={selectedRows.includes(rec.id)}
                      onChange={() => handleSelectRow(rec.id)}
                    />
                  </TableCell>

                  {fields.map(f => {
                    if (!visibleColumns[f.name]) return null;
                    return (
                      <TableCell key={f.name} sx={{ whiteSpace: 'nowrap' }}>
                        {renderCellContent(rec, f)}
                      </TableCell>
                    );
                  })}

                  <TableCell align="right">
                    <Box display="flex" justifyContent="flex-end" gap={0.5}>
                      {onInspectClick && (
                        <Tooltip title="Inspect 360 View">
                          <IconButton size="small" onClick={() => onInspectClick(moduleKey, rec.id)} sx={{ color: '#2563EB' }}>
                            <Icons.SearchCode size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onEditClick && (
                        <Tooltip title="Edit Record">
                          <IconButton size="small" onClick={() => onEditClick(rec)} sx={{ color: '#F59E0B' }}>
                            <Icons.Edit2 size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onDeleteClick && (
                        <Tooltip title="Delete Record">
                          <IconButton size="small" onClick={() => onDeleteClick(rec.id)} sx={{ color: '#EF4444' }}>
                            <Icons.Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Footer */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={sortedRecords.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
      />

      {/* Dynamic Columns Configuration Dialog */}
      <Dialog open={colMenuOpen} onClose={() => setColMenuOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: 'Poppins' }}>Configure Display Columns</DialogTitle>
        <DialogContent>
          <FormGroup sx={{ mt: 1 }}>
            {fields.map(f => (
              <FormControlLabel
                key={f.name}
                control={
                  <Checkbox 
                    checked={visibleColumns[f.name] !== false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setVisibleColumns(prev => ({ ...prev, [f.name]: checked }));
                    }}
                  />
                }
                label={f.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setColMenuOpen(false)} variant="contained">Apply Columns</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default DynamicTable;
