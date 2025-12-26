import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface CalendarSettings {
  id: string;
  working_days: string; // JSON string
  start_hour: number;
  end_hour: number;
  slot_duration_minutes: number;
  slots_per_day: number;
  emergency_slots_per_day: number;
  updated_at: string;
}

interface BlackoutDate {
  id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
  created_at: string;
}

interface SettingsFormData {
  working_days: number[];
  start_hour: number;
  end_hour: number;
  slot_duration_minutes: number;
  emergency_slots_per_day: number;
}

interface NewBlackoutFormData {
  date: string;
  reason: string;
}

interface SettingResponse {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

// ===========================
// API CLIENT
// ===========================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api_client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===========================
// API FUNCTIONS
// ===========================

async function fetch_calendar_settings(auth_token: string): Promise<CalendarSettings> {
  const response = await api_client.get('/api/admin/calendar-settings', {
    headers: { Authorization: `Bearer ${auth_token}` },
  });
  return response.data;
}

async function fetch_blackout_dates(auth_token: string): Promise<BlackoutDate[]> {
  const response = await api_client.get('/api/admin/blackout-dates', {
    headers: { Authorization: `Bearer ${auth_token}` },
  });
  return response.data;
}

async function fetch_urgent_fee_setting(auth_token: string): Promise<number> {
  const response = await api_client.get('/api/admin/settings/urgent_fee_pct', {
    headers: { Authorization: `Bearer ${auth_token}` },
  });
  return parseFloat(response.data.value || '20');
}

async function update_calendar_settings(
  auth_token: string,
  data: {
    working_days: string;
    start_hour: number;
    end_hour: number;
    slot_duration_minutes: number;
    emergency_slots_per_day: number;
  }
): Promise<void> {
  await api_client.patch('/api/admin/calendar-settings', data, {
    headers: { Authorization: `Bearer ${auth_token}` },
  });
}

async function update_urgent_fee(auth_token: string, value: string): Promise<void> {
  await api_client.patch(
    '/api/admin/settings/urgent_fee_pct',
    { value },
    { headers: { Authorization: `Bearer ${auth_token}` } }
  );
}

async function create_blackout_date(
  auth_token: string,
  data: { date: string; reason: string | null }
): Promise<void> {
  await api_client.post('/api/admin/blackout-dates', data, {
    headers: { Authorization: `Bearer ${auth_token}` },
  });
}

async function delete_blackout_date(auth_token: string, blackout_id: string): Promise<void> {
  await api_client.delete(`/api/admin/blackout-dates/${blackout_id}`, {
    headers: { Authorization: `Bearer ${auth_token}` },
  });
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_CalendarSettings: React.FC = () => {
  // ===========================
  // GLOBAL STATE ACCESS
  // ===========================
  
  // CRITICAL: Individual selectors, no object destructuring
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const show_toast = useAppStore(state => state.show_toast);

  // ===========================
  // REACT QUERY SETUP
  // ===========================
  
  const query_client = useQueryClient();

  // Fetch calendar settings
  const {
    data: calendar_settings,
    isLoading: is_loading_settings,
    error: settings_error,
  } = useQuery({
    queryKey: ['calendar_settings'],
    queryFn: () => fetch_calendar_settings(auth_token!),
    enabled: !!auth_token,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch blackout dates
  const {
    data: blackout_dates = [],
    isLoading: is_loading_blackouts,
    error: blackouts_error,
  } = useQuery({
    queryKey: ['blackout_dates'],
    queryFn: () => fetch_blackout_dates(auth_token!),
    enabled: !!auth_token,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch urgent fee setting
  const {
    data: urgent_fee_percentage = 20,
    isLoading: is_loading_fee,
  } = useQuery({
    queryKey: ['urgent_fee_pct'],
    queryFn: () => fetch_urgent_fee_setting(auth_token!),
    enabled: !!auth_token,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // ===========================
  // LOCAL STATE
  // ===========================

  const [settings_form, set_settings_form] = useState<SettingsFormData>({
    working_days: [1, 2, 3, 4, 5],
    start_hour: 9,
    end_hour: 18,
    slot_duration_minutes: 120,
    emergency_slots_per_day: 2,
  });

  const [new_blackout_form, set_new_blackout_form] = useState<NewBlackoutFormData>({
    date: '',
    reason: '',
  });

  const [local_urgent_fee, set_local_urgent_fee] = useState<number>(20);

  // ===========================
  // CALCULATED VALUES
  // ===========================

  const calculated_slots_per_day = Math.floor(
    ((settings_form.end_hour - settings_form.start_hour) * 60) / settings_form.slot_duration_minutes
  );

  // ===========================
  // SYNC FORM STATE WITH FETCHED DATA
  // ===========================

  useEffect(() => {
    if (calendar_settings) {
      const working_days_array = JSON.parse(calendar_settings.working_days || '[1,2,3,4,5]');
      set_settings_form({
        working_days: working_days_array,
        start_hour: calendar_settings.start_hour,
        end_hour: calendar_settings.end_hour,
        slot_duration_minutes: calendar_settings.slot_duration_minutes,
        emergency_slots_per_day: calendar_settings.emergency_slots_per_day,
      });
    }
  }, [calendar_settings]);

  useEffect(() => {
    if (urgent_fee_percentage !== undefined) {
      set_local_urgent_fee(urgent_fee_percentage);
    }
  }, [urgent_fee_percentage]);

  // ===========================
  // MUTATIONS
  // ===========================

  const save_settings_mutation = useMutation({
    mutationFn: async () => {
      if (!auth_token) throw new Error('Not authenticated');

      await update_calendar_settings(auth_token, {
        working_days: JSON.stringify(settings_form.working_days),
        start_hour: settings_form.start_hour,
        end_hour: settings_form.end_hour,
        slot_duration_minutes: settings_form.slot_duration_minutes,
        emergency_slots_per_day: settings_form.emergency_slots_per_day,
      });
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: ['calendar_settings'] });
      show_toast({
        type: 'success',
        message: 'Calendar settings saved successfully',
        duration: 5000,
      });
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to save settings',
        duration: 5000,
      });
    },
  });

  const update_urgent_fee_mutation = useMutation({
    mutationFn: async (fee_value: number) => {
      if (!auth_token) throw new Error('Not authenticated');
      await update_urgent_fee(auth_token, fee_value.toString());
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: ['urgent_fee_pct'] });
      show_toast({
        type: 'success',
        message: 'Emergency booking fee updated',
        duration: 5000,
      });
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update fee',
        duration: 5000,
      });
    },
  });

  const add_blackout_mutation = useMutation({
    mutationFn: async (data: { date: string; reason: string | null }) => {
      if (!auth_token) throw new Error('Not authenticated');
      await create_blackout_date(auth_token, data);
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: ['blackout_dates'] });
      set_new_blackout_form({ date: '', reason: '' });
      show_toast({
        type: 'success',
        message: 'Blackout date added successfully',
        duration: 5000,
      });
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to add blackout date',
        duration: 5000,
      });
    },
  });

  const remove_blackout_mutation = useMutation({
    mutationFn: async (blackout_id: string) => {
      if (!auth_token) throw new Error('Not authenticated');
      await delete_blackout_date(auth_token, blackout_id);
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: ['blackout_dates'] });
      show_toast({
        type: 'success',
        message: 'Blackout date removed successfully',
        duration: 5000,
      });
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to remove blackout date',
        duration: 5000,
      });
    },
  });

  // ===========================
  // EVENT HANDLERS
  // ===========================

  const toggle_working_day = (day: number) => {
    set_settings_form(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  };

  const handle_save_settings = () => {
    // Validation
    if (settings_form.working_days.length === 0) {
      show_toast({
        type: 'error',
        message: 'Please select at least one working day',
        duration: 5000,
      });
      return;
    }

    if (settings_form.start_hour >= settings_form.end_hour) {
      show_toast({
        type: 'error',
        message: 'End hour must be after start hour',
        duration: 5000,
      });
      return;
    }

    if (settings_form.slot_duration_minutes <= 0) {
      show_toast({
        type: 'error',
        message: 'Slot duration must be positive',
        duration: 5000,
      });
      return;
    }

    save_settings_mutation.mutate();
  };

  const handle_update_urgent_fee = () => {
    if (local_urgent_fee < 0 || local_urgent_fee > 100) {
      show_toast({
        type: 'error',
        message: 'Urgent fee must be between 0 and 100',
        duration: 5000,
      });
      return;
    }

    update_urgent_fee_mutation.mutate(local_urgent_fee);
  };

  const handle_add_blackout = (e: React.FormEvent) => {
    e.preventDefault();

    if (!new_blackout_form.date) {
      show_toast({
        type: 'error',
        message: 'Please select a date',
        duration: 5000,
      });
      return;
    }

    add_blackout_mutation.mutate({
      date: new_blackout_form.date,
      reason: new_blackout_form.reason || null,
    });
  };

  const handle_remove_blackout = (blackout_id: string) => {
    if (confirm('Are you sure you want to remove this blackout date?')) {
      remove_blackout_mutation.mutate(blackout_id);
    }
  };

  // ===========================
  // DAY LABELS
  // ===========================

  const day_labels = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' },
  ];

  // ===========================
  // LOADING STATE
  // ===========================

  const is_loading = is_loading_settings || is_loading_blackouts || is_loading_fee;
  const is_saving = save_settings_mutation.isPending || update_urgent_fee_mutation.isPending;

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Calendar & Capacity Configuration</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Configure working hours, booking slots, blackout dates, and emergency booking parameters
                </p>
              </div>
              <button
                onClick={handle_save_settings}
                disabled={is_saving || is_loading}
                className="bg-yellow-400 text-black font-semibold px-6 py-3 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {is_saving ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {is_loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-3 text-gray-600">Loading settings...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Working Days & Hours Section */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Working Days & Hours</h2>

                {/* Working Days Checkboxes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Working Days</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {day_labels.map((day) => (
                      <label
                        key={day.value}
                        className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={settings_form.working_days.includes(day.value)}
                          onChange={() => toggle_working_day(day.value)}
                          className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400"
                        />
                        <span className="text-sm font-medium text-gray-900">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Working Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="start_hour" className="block text-sm font-medium text-gray-700 mb-2">
                      Start Hour
                    </label>
                    <select
                      id="start_hour"
                      value={settings_form.start_hour}
                      onChange={(e) =>
                        set_settings_form(prev => ({ ...prev, start_hour: parseInt(e.target.value) }))
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="end_hour" className="block text-sm font-medium text-gray-700 mb-2">
                      End Hour
                    </label>
                    <select
                      id="end_hour"
                      value={settings_form.end_hour}
                      onChange={(e) =>
                        set_settings_form(prev => ({ ...prev, end_hour: parseInt(e.target.value) }))
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Slot Duration */}
                <div className="mb-6">
                  <label htmlFor="slot_duration" className="block text-sm font-medium text-gray-700 mb-2">
                    Slot Duration (minutes)
                  </label>
                  <input
                    type="number"
                    id="slot_duration"
                    min="15"
                    step="15"
                    value={settings_form.slot_duration_minutes}
                    onChange={(e) =>
                      set_settings_form(prev => ({ ...prev, slot_duration_minutes: parseInt(e.target.value) || 0 }))
                    }
                    className="w-full sm:w-64 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Recommended: 60, 90, 120, or 180 minutes
                  </p>
                </div>

                {/* Calculated Slots Preview */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-900 font-medium">
                    📊 Calculated Slots Per Day: <span className="text-2xl ml-2">{calculated_slots_per_day}</span>
                  </p>
                  <p className="text-blue-700 text-sm mt-2">
                    Based on {settings_form.end_hour - settings_form.start_hour} working hours and {settings_form.slot_duration_minutes} minute slots
                  </p>
                </div>
              </div>

              {/* Emergency Booking Settings */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Emergency Booking Settings</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Emergency Slots Per Day */}
                  <div>
                    <label htmlFor="emergency_slots" className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Slots Per Day
                    </label>
                    <input
                      type="number"
                      id="emergency_slots"
                      min="0"
                      max={calculated_slots_per_day}
                      value={settings_form.emergency_slots_per_day}
                      onChange={(e) =>
                        set_settings_form(prev => ({ ...prev, emergency_slots_per_day: parseInt(e.target.value) || 0 }))
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      Available when regular slots are full (max: {calculated_slots_per_day})
                    </p>
                  </div>

                  {/* Urgent Fee Percentage */}
                  <div>
                    <label htmlFor="urgent_fee" className="block text-sm font-medium text-gray-700 mb-2">
                      Urgent Fee Percentage (%)
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        id="urgent_fee"
                        min="0"
                        max="100"
                        step="5"
                        value={local_urgent_fee}
                        onChange={(e) => set_local_urgent_fee(parseFloat(e.target.value) || 0)}
                        onBlur={handle_update_urgent_fee}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                      <button
                        onClick={handle_update_urgent_fee}
                        disabled={update_urgent_fee_mutation.isPending}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        Update
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Additional fee applied to emergency bookings (default: 20%)
                    </p>
                  </div>
                </div>

                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-900 text-sm">
                    <strong>ℹ️ Emergency Booking Rules:</strong> Customers can request emergency bookings on fully booked dates. 
                    An additional {local_urgent_fee}% fee will be applied to the total order amount.
                  </p>
                </div>
              </div>

              {/* Blackout Dates Section */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Blackout Dates</h2>

                {/* Add Blackout Date Form */}
                <form onSubmit={handle_add_blackout} className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Add New Blackout Date</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="blackout_date" className="block text-sm font-medium text-gray-700 mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        id="blackout_date"
                        value={new_blackout_form.date}
                        onChange={(e) =>
                          set_new_blackout_form(prev => ({ ...prev, date: e.target.value }))
                        }
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="blackout_reason" className="block text-sm font-medium text-gray-700 mb-2">
                        Reason (optional)
                      </label>
                      <input
                        type="text"
                        id="blackout_reason"
                        placeholder="e.g., Public Holiday"
                        value={new_blackout_form.reason}
                        onChange={(e) =>
                          set_new_blackout_form(prev => ({ ...prev, reason: e.target.value }))
                        }
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={add_blackout_mutation.isPending || !new_blackout_form.date}
                        className="w-full bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {add_blackout_mutation.isPending ? 'Adding...' : 'Add Blackout Date'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Blackout Dates List */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Configured Blackout Dates</h3>
                  
                  {blackout_dates.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-2 text-gray-600">No blackout dates configured</p>
                      <p className="text-sm text-gray-500">Add dates when booking should not be allowed</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Reason
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {blackout_dates.map((blackout) => (
                            <tr key={blackout.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(blackout.date).toLocaleDateString('en-IE', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-600">
                                  {blackout.reason || 'No reason specified'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <button
                                  onClick={() => handle_remove_blackout(blackout.id)}
                                  disabled={remove_blackout_mutation.isPending}
                                  className="text-red-600 hover:text-red-800 font-medium text-sm transition-colors disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Info Panel */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-sm font-medium text-gray-600 mb-1">Total Working Days</div>
                    <div className="text-3xl font-bold text-gray-900">{settings_form.working_days.length}</div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-sm font-medium text-gray-600 mb-1">Slots Per Day</div>
                    <div className="text-3xl font-bold text-blue-600">{calculated_slots_per_day}</div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-sm font-medium text-gray-600 mb-1">Emergency Slots/Day</div>
                    <div className="text-3xl font-bold text-yellow-600">{settings_form.emergency_slots_per_day}</div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-blue-900">
                  <strong>💡 Capacity Calculation:</strong> With {settings_form.working_days.length} working days per week 
                  and {calculated_slots_per_day} slots per day, you can accommodate approximately{' '}
                  <strong>{settings_form.working_days.length * calculated_slots_per_day}</strong> bookings per week.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_ADMIN_CalendarSettings;