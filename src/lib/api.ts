import { supabase, isSupabaseConfigured } from './supabase';

const API_URL = '/api';

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${res.status} ${res.statusText}`);
  }
  return res.json();
};

// Supabase API helpers
const supabaseApi = {
  workOrders: {
    list: async () => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    create: async (workOrder: any) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('work_orders')
        .insert(workOrder)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, workOrder: any) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('work_orders')
        .update(workOrder)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  },
  grants: {
    list: async () => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('grants')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    create: async (grant: any) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('grants')
        .insert(grant)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, grant: any) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('grants')
        .update(grant)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase
        .from('grants')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  },
};

// Express API (fallback for local development)
const expressApi = {
  get: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`);
    return handleResponse(res);
  },

  post: async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  put: async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  delete: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
};

// Unified API - uses Supabase when configured, else Express
export const api = {
  get: async (endpoint: string) => {
    if (isSupabaseConfigured()) {
      if (endpoint === '/work-orders') return supabaseApi.workOrders.list();
      if (endpoint === '/grants') return supabaseApi.grants.list();
    }
    return expressApi.get(endpoint);
  },

  post: async (endpoint: string, data: any) => {
    if (isSupabaseConfigured()) {
      if (endpoint === '/work-orders') return supabaseApi.workOrders.create(data);
      if (endpoint === '/grants') return supabaseApi.grants.create(data);
    }
    return expressApi.post(endpoint, data);
  },

  put: async (endpoint: string, data: any) => {
    if (isSupabaseConfigured()) {
      const match = endpoint.match(/\/(work-orders|grants)\/(.+)/);
      if (match) {
        const [, resource, id] = match;
        if (resource === 'work-orders') return supabaseApi.workOrders.update(id, data);
        if (resource === 'grants') return supabaseApi.grants.update(id, data);
      }
    }
    return expressApi.put(endpoint, data);
  },

  delete: async (endpoint: string) => {
    if (isSupabaseConfigured()) {
      const match = endpoint.match(/\/(work-orders|grants)\/(.+)/);
      if (match) {
        const [, resource, id] = match;
        if (resource === 'work-orders') return supabaseApi.workOrders.delete(id);
        if (resource === 'grants') return supabaseApi.grants.delete(id);
      }
    }
    return expressApi.delete(endpoint);
  },
};
