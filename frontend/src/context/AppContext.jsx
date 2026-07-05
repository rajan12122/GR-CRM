import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AppContext = createContext();

const API_BASE_URL = 'https://gr-crm-backend.onrender.com/api';

// Set default auth token header if cached
const cachedToken = localStorage.getItem('gr_crm_token');
if (cachedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${cachedToken}`;
}

export const AppProvider = ({ children }) => {
  const [token, setToken] = useState(cachedToken);
  const [user, setUser] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [moduleData, setModuleData] = useState({});
  const [loadingData, setLoadingData] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);

  // Load user profile and metadata if token exists
  useEffect(() => {
    if (token) {
      loadProfileAndMetadata();
    } else {
      setLoadingMetadata(false);
    }
  }, [token]);

  const loadProfileAndMetadata = async () => {
    try {
      setLoadingMetadata(true);
      // Set Axios auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Fetch user profile
      const userRes = await axios.get(`${API_BASE_URL}/auth/me`);
      setUser(userRes.data);

      // Fetch metadata config
      const metaRes = await axios.get(`${API_BASE_URL}/metadata`);
      setMetadata(metaRes.data);

      // Fetch activity logs
      const logsRes = await axios.get(`${API_BASE_URL}/data/activity_logs`).catch(() => ({ data: [] }));
      setActivityLogs(logsRes.data || []);

    } catch (err) {
      console.error('Failed to load profile/metadata:', err);
      logout();
    } finally {
      setLoadingMetadata(false);
    }
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      const { token: userToken, user: userData } = res.data;
      
      localStorage.setItem('gr_crm_token', userToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
      
      setToken(userToken);
      setUser(userData);
      return { success: true };
    } catch (err) {
      console.error('Login failed:', err);
      return { 
        success: false, 
        message: err.response?.data?.message || 'Login failed. Please try again.' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('gr_crm_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setMetadata(null);
    setModuleData({});
  };

  // Fetch data records for a specific module
  const fetchModuleData = async (moduleName) => {
    setLoadingData(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/data/${moduleName}`);
      setModuleData(prev => ({ ...prev, [moduleName]: res.data }));
      return res.data;
    } catch (err) {
      console.error(`Error fetching ${moduleName}:`, err);
      return [];
    } finally {
      setLoadingData(false);
    }
  };

  // Create a record dynamically
  const createRecord = async (moduleName, payload) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/data/${moduleName}`, payload);
      // Optimistic cache update
      setModuleData(prev => ({
        ...prev,
        [moduleName]: [...(prev[moduleName] || []), res.data]
      }));
      // Refresh logs
      axios.get(`${API_BASE_URL}/data/activity_logs`).then(r => setActivityLogs(r.data)).catch(() => {});
      return { success: true, data: res.data };
    } catch (err) {
      console.error(`Error creating ${moduleName}:`, err);
      return { success: false, message: err.response?.data?.message || 'Create failed.' };
    }
  };

  // Update a record dynamically
  const updateRecord = async (moduleName, id, payload) => {
    try {
      const res = await axios.put(`${API_BASE_URL}/data/${moduleName}/${id}`, payload);
      // Update cache
      setModuleData(prev => ({
        ...prev,
        [moduleName]: (prev[moduleName] || []).map(rec => rec.id === id ? res.data : rec)
      }));
      axios.get(`${API_BASE_URL}/data/activity_logs`).then(r => setActivityLogs(r.data)).catch(() => {});
      return { success: true, data: res.data };
    } catch (err) {
      console.error(`Error updating ${moduleName}:`, err);
      return { success: false, message: err.response?.data?.message || 'Update failed.' };
    }
  };

  // Delete a record dynamically
  const deleteRecord = async (moduleName, id) => {
    try {
      await axios.delete(`${API_BASE_URL}/data/${moduleName}/${id}`);
      // Remove from cache
      setModuleData(prev => ({
        ...prev,
        [moduleName]: (prev[moduleName] || []).filter(rec => rec.id !== id)
      }));
      axios.get(`${API_BASE_URL}/data/activity_logs`).then(r => setActivityLogs(r.data)).catch(() => {});
      return { success: true };
    } catch (err) {
      console.error(`Error deleting ${moduleName}:`, err);
      return { success: false, message: err.response?.data?.message || 'Delete failed.' };
    }
  };

  // Remarks Timeline Operations
  const createRemark = async (targetModule, targetId, comment) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/remarks`, { targetModule, targetId, comment });
      return { success: true, data: res.data };
    } catch (err) {
      console.error('Failed to post remark:', err);
      return { success: false };
    }
  };

  // Document Upload operations
  const uploadDocument = async (targetModule, targetId, name, fileUrl) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/documents`, { targetModule, targetId, name, fileUrl });
      return { success: true, data: res.data };
    } catch (err) {
      console.error('Failed to save document:', err);
      return { success: false };
    }
  };

  // 360 Entity Details Resolver
  const fetchEntity360 = async (moduleName, id) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/360/${moduleName}/${id}`);
      return res.data;
    } catch (err) {
      console.error(`Failed to fetch 360 detail for ${moduleName}:${id}`, err);
      return null;
    }
  };

  // Global Search across entire database
  const searchAll = async (query) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
      return res.data;
    } catch (err) {
      console.error('Search failed:', err);
      return { results: {}, connections: {} };
    }
  };

  // Admin: Update metadata schemas (reorder, add column, chip configurations)
  const saveMetadata = async (newMetadata) => {
    try {
      await axios.post(`${API_BASE_URL}/metadata`, newMetadata);
      setMetadata(newMetadata);
      return { success: true };
    } catch (err) {
      console.error('Save metadata failed:', err);
      return { success: false, message: err.response?.data?.message || 'Failed to update configuration.' };
    }
  };

  // Google Sheets Management
  const testSheetsSync = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/settings/test-sheets`);
      return { success: true, message: res.data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Sheets connection failed.' };
    }
  };

  const triggerFullSheetsSync = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/settings/sync-now`);
      return { success: true, message: res.data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Sync failed.' };
    }
  };

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        metadata,
        loadingMetadata,
        moduleData,
        loadingData,
        activityLogs,
        login,
        logout,
        fetchModuleData,
        createRecord,
        updateRecord,
        deleteRecord,
        createRemark,
        uploadDocument,
        fetchEntity360,
        searchAll,
        saveMetadata,
        testSheetsSync,
        triggerFullSheetsSync
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
