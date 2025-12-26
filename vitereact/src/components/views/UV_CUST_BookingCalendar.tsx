import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Calendar, Clock, AlertCircle, CheckCircle, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Quote {
  id: string;
  customer_id: string;
  service_id: string;
  tier_id: string;
  status: string;
  estimate_subtotal: number | null;
  final_subtotal: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Service {
  id: string;
  name: string;
  slug: string;
}

interface TierPackage {
  id: string;
  name: string;
  slug: string;
}

interface QuoteDetailResponse {
  quote: Quote;
  service: Service;
  tier: TierPackage;
}

interface TimeSlot {
  start_at: string;
  end_at: string;
  is_available: boolean;
  emergency_available: boolean;
}

interface AvailableDate {
  date: string;
  available_slots: TimeSlot[];
  is_full: boolean;
  emergency_slots_available: number;
}

interface CalendarSettings {
  id: string;
  working_days: string;
  start_hour: number;
  end_hour: number;
  slot_duration_minutes: number;
  slots_per_day: number;
  emergency_slots_per_day: number;
}

interface CalendarAvailabilityResponse {
  available_dates: AvailableDate[];
  calendar_settings: CalendarSettings;
}

interface CreateBookingRequest {
  quote_id: string;
  start_at: string;
  end_at: string;
  is_emergency: boolean;
}

interface CreateBookingResponse {
  id: string;
  quote_id: string;
  customer_id: string;
  start_at: string;
  end_at: string;
  status: string;
  is_emergency: boolean;
  urgent_fee_pct: number;
  created_at: string;
  updated_at: string;
}

interface EmergencyFeeInfo {
  fee_percentage: number;
  original_total: number;
  fee_amount: number;
  new_total: number;
}

// ===========================
// API FUNCTIONS
// ===========================

const fetchQuoteForBooking = async (quote_id: string, auth_token: string): Promise<QuoteDetailResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.get(
    `${API_BASE_URL}/api/quotes/${quote_id}`,
    {
      headers: {
        'Authorization': `Bearer ${auth_token}`,
      },
    }
  );
  return response.data;
};

const fetchCalendarAvailability = async (
  start_date: string,
  end_date: string,
  service_id?: string
): Promise<CalendarAvailabilityResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    start_date,
    end_date,
  });
  if (service_id) {
    params.append('service_id', service_id);
  }
  const response = await axios.get(
    `${API_BASE_URL}/api/calendar/availability?${params.toString()}`
  );
  return response.data;
};

const createBooking = async (
  booking_data: CreateBookingRequest,
  auth_token: string
): Promise<CreateBookingResponse> => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await axios.post(
    `${API_BASE_URL}/api/bookings`,
    booking_data,
    {
      headers: {
        'Authorization': `Bearer ${auth_token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

// ===========================
// COMPONENT
// ===========================

const UV_CUST_BookingCalendar: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Parse URL parameters
  const quote_id = searchParams.get('quote_id') || '';
  const initial_date = searchParams.get('date') || null;
  
  // Global state access - CRITICAL: Individual selectors only
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const show_toast = useAppStore(state => state.show_toast);
  
  // Local state
  const [current_month, set_current_month] = useState<Date>(
    initial_date ? new Date(initial_date) : new Date()
  );
  const [selected_date, set_selected_date] = useState<string | null>(initial_date);
  const [selected_time_slot, set_selected_time_slot] = useState<TimeSlot | null>(null);
  const [is_emergency_requested, set_is_emergency_requested] = useState(false);
  const [emergency_fee_info, set_emergency_fee_info] = useState<EmergencyFeeInfo | null>(null);
  const [show_emergency_modal, set_show_emergency_modal] = useState(false);
  const [emergency_accepted, set_emergency_accepted] = useState(false);
  const [success_message, set_success_message] = useState<string | null>(null);

  // Validate auth and quote_id
  useEffect(() => {
    if (!auth_token || !current_user) {
      navigate(`/login?returnTo=/app/bookings/new?quote_id=${quote_id}`);
      return;
    }
    
    if (!quote_id) {
      show_toast({
        type: 'error',
        message: 'Quote ID is required to book an appointment',
        duration: 5000,
      });
      navigate('/app/quotes');
    }
  }, [auth_token, current_user, quote_id, navigate, show_toast]);

  // Fetch quote details
  const {
    data: quote_response,
    isLoading: is_loading_quote,
    error: quote_error,
  } = useQuery({
    queryKey: ['quote', quote_id],
    queryFn: () => fetchQuoteForBooking(quote_id, auth_token!),
    enabled: !!quote_id && !!auth_token,
    retry: 1,
  });

  // Calculate month date range
  const month_start = useMemo(() => {
    const date = new Date(current_month.getFullYear(), current_month.getMonth(), 1);
    return date.toISOString().split('T')[0];
  }, [current_month]);

  const month_end = useMemo(() => {
    const date = new Date(current_month.getFullYear(), current_month.getMonth() + 1, 0);
    return date.toISOString().split('T')[0];
  }, [current_month]);

  // Fetch calendar availability
  const {
    data: availability_response,
    isLoading: is_loading_availability,
    error: availability_error,
  } = useQuery({
    queryKey: ['calendar-availability', month_start, month_end, quote_response?.service.id],
    queryFn: () => fetchCalendarAvailability(month_start, month_end, quote_response?.service.id),
    enabled: !!quote_response?.service.id,
    staleTime: 60000, // 1 minute
    retry: 1,
  });

  // Create booking mutation
  const create_booking_mutation = useMutation({
    mutationFn: (booking_data: CreateBookingRequest) => createBooking(booking_data, auth_token!),
    onSuccess: (response) => {
      show_toast({
        type: 'success',
        message: 'Booking confirmed! Proceeding to payment...',
        duration: 3000,
      });
      
      // Navigate to deposit payment page
      // Note: Need to get order_id from booking or create order flow
      // For now, show success message and navigate to orders
      set_success_message('Booking confirmed! Please complete your deposit payment.');
      
      setTimeout(() => {
        navigate('/app/orders');
      }, 2000);
    },
    onError: (error: any) => {
      const error_message = error.response?.data?.message || error.message || 'Failed to create booking';
      show_toast({
        type: 'error',
        message: error_message,
        duration: 5000,
      });
    },
  });

  // Handle month navigation
  const navigate_to_previous_month = () => {
    set_current_month(new Date(current_month.getFullYear(), current_month.getMonth() - 1, 1));
    set_selected_date(null);
    set_selected_time_slot(null);
  };

  const navigate_to_next_month = () => {
    set_current_month(new Date(current_month.getFullYear(), current_month.getMonth() + 1, 1));
    set_selected_date(null);
    set_selected_time_slot(null);
  };

  // Handle date selection
  const select_date = (date_string: string, date_info: AvailableDate) => {
    set_selected_date(date_string);
    set_selected_time_slot(null);
    set_is_emergency_requested(false);
    set_emergency_fee_info(null);
    set_show_emergency_modal(false);
    set_emergency_accepted(false);
  };

  // Handle emergency booking request
  const request_emergency_booking = (date_string: string) => {
    if (!quote_response?.quote.final_subtotal) return;
    
    const fee_percentage = 20;
    const original_total = Number(quote_response.quote.final_subtotal || 0);
    const fee_amount = original_total * (fee_percentage / 100);
    const new_total = original_total + fee_amount;
    
    set_emergency_fee_info({
      fee_percentage,
      original_total,
      fee_amount,
      new_total,
    });
    
    set_is_emergency_requested(true);
    set_selected_date(date_string);
    set_show_emergency_modal(true);
  };

  // Generate time slots for selected date
  const generate_time_slots = (date_string: string): TimeSlot[] => {
    if (!availability_response?.calendar_settings) return [];
    
    const settings = availability_response.calendar_settings;
    const start_hour = settings.start_hour;
    const end_hour = settings.end_hour;
    const duration = settings.slot_duration_minutes;
    
    const slots: TimeSlot[] = [];
    let current_hour = start_hour;
    
    while (current_hour < end_hour) {
      const start_at = `${date_string}T${String(current_hour).padStart(2, '0')}:00:00Z`;
      const end_minutes = (current_hour * 60) + duration;
      const end_hour_calc = Math.floor(end_minutes / 60);
      const end_minute_calc = end_minutes % 60;
      const end_at = `${date_string}T${String(end_hour_calc).padStart(2, '0')}:${String(end_minute_calc).padStart(2, '0')}:00Z`;
      
      slots.push({
        start_at,
        end_at,
        is_available: true, // Simplified - would check against existing bookings
        emergency_available: true,
      });
      
      current_hour += duration / 60;
    }
    
    return slots;
  };

  // Handle booking confirmation
  const confirm_booking = () => {
    if (!selected_time_slot || !quote_id) return;
    
    create_booking_mutation.mutate({
      quote_id,
      start_at: selected_time_slot.start_at,
      end_at: selected_time_slot.end_at,
      is_emergency: is_emergency_requested,
    });
  };

  // Confirm emergency booking
  const confirm_emergency_booking = () => {
    if (!emergency_accepted) return;
    
    set_show_emergency_modal(false);
    // Generate time slot for emergency
    const slots = generate_time_slots(selected_date!);
    if (slots.length > 0) {
      set_selected_time_slot(slots[0]);
    }
  };

  // Build calendar grid
  const calendar_days = useMemo(() => {
    const year = current_month.getFullYear();
    const month = current_month.getMonth();
    const first_day = new Date(year, month, 1);
    const last_day = new Date(year, month + 1, 0);
    
    const days: (string | null)[] = [];
    
    // Add empty cells for days before month start
    const start_day_of_week = first_day.getDay();
    for (let i = 0; i < start_day_of_week; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let day = 1; day <= last_day.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(date.toISOString().split('T')[0]);
    }
    
    return days;
  }, [current_month]);

  // Get availability for date
  const get_date_availability = (date_string: string): AvailableDate | null => {
    if (!availability_response) return null;
    return availability_response.available_dates.find(d => d.date === date_string) || null;
  };

  // Format time for display
  const format_time = (date_string: string): string => {
    const date = new Date(date_string);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const format_date_long = (date_string: string): string => {
    const date = new Date(date_string);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Loading state
  if (is_loading_quote || is_loading_availability) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (quote_error || availability_error || !quote_response) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900">Unable to Load Booking Calendar</h3>
                  <p className="text-red-700 mt-1">
                    {quote_error ? 'Quote not found or access denied' : 'Failed to load calendar availability'}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  to="/app/quotes"
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Quotes
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Validate quote status
  if (quote_response.quote.status !== 'APPROVED') {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <div>
                  <h3 className="text-lg font-semibold text-yellow-900">Quote Not Finalized</h3>
                  <p className="text-yellow-700 mt-1">
                    This quote must be finalized by our team before you can book an appointment.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  to={`/app/quotes/${quote_id}`}
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  View Quote
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const selected_date_info = selected_date ? get_date_availability(selected_date) : null;
  const available_time_slots = selected_date && !selected_date_info?.is_full 
    ? generate_time_slots(selected_date) 
    : [];

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Success Message */}
          {success_message && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <p className="text-green-900 font-medium">{success_message}</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <Link
              to={`/app/quotes/${quote_id}`}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Quote
            </Link>
            
            <h1 className="text-3xl font-bold text-gray-900">Book Your Appointment</h1>
            
            <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">Service</p>
                  <p className="text-lg font-semibold text-gray-900">{quote_response.service.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Tier</p>
                  <p className="text-lg font-semibold text-gray-900">{quote_response.tier.name}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar Section */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={navigate_to_previous_month}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                
                <h2 className="text-xl font-semibold text-gray-900">
                  {current_month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                
                <button
                  onClick={navigate_to_next_month}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Calendar Grid - Desktop */}
              <div className="hidden md:block">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2">
                  {calendar_days.map((date_string, index) => {
                    if (!date_string) {
                      return <div key={`empty-${index}`} className="aspect-square"></div>;
                    }
                    
                    const date_info = get_date_availability(date_string);
                    const is_today = date_string === new Date().toISOString().split('T')[0];
                    const is_selected = date_string === selected_date;
                    const is_past = new Date(date_string) < new Date();
                    const is_available = date_info && !date_info.is_full && !is_past;
                    const is_full = date_info?.is_full;
                    
                    return (
                      <button
                        key={date_string}
                        onClick={() => {
                          if (is_available) {
                            select_date(date_string, date_info);
                          } else if (is_full && !is_past) {
                            request_emergency_booking(date_string);
                          }
                        }}
                        disabled={is_past || (!is_available && !is_full)}
                        className={`
                          aspect-square p-2 rounded-lg border-2 transition-all
                          ${is_selected ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'}
                          ${is_today && !is_selected ? 'border-blue-500' : ''}
                          ${is_available && !is_selected ? 'hover:bg-gray-50 cursor-pointer' : ''}
                          ${is_full && !is_past ? 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100' : ''}
                          ${is_past || (!is_available && !is_full) ? 'opacity-40 cursor-not-allowed' : ''}
                        `}
                      >
                        <div className="text-center">
                          <div className={`text-sm font-medium ${is_selected ? 'text-yellow-900' : 'text-gray-900'}`}>
                            {new Date(date_string).getDate()}
                          </div>
                          {is_available && (
                            <div className="mt-1 flex justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            </div>
                          )}
                          {is_full && !is_past && (
                            <div className="mt-1 text-xs text-red-600 font-medium">Full</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calendar List - Mobile */}
              <div className="md:hidden space-y-2">
                {availability_response?.available_dates
                  .filter(date_info => {
                    const date = new Date(date_info.date);
                    return date.getMonth() === current_month.getMonth() && 
                           date.getFullYear() === current_month.getFullYear();
                  })
                  .map(date_info => {
                    const is_selected = date_info.date === selected_date;
                    const is_past = new Date(date_info.date) < new Date();
                    
                    if (is_past) return null;
                    
                    return (
                      <div key={date_info.date} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-gray-900">
                            {format_date_long(date_info.date)}
                          </div>
                          {!date_info.is_full ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Full
                            </span>
                          )}
                        </div>
                        
                        {!date_info.is_full ? (
                          <button
                            onClick={() => select_date(date_info.date, date_info)}
                            className={`
                              w-full mt-2 px-4 py-2 rounded-lg font-medium transition-colors
                              ${is_selected 
                                ? 'bg-yellow-500 text-black' 
                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}
                            `}
                          >
                            {is_selected ? 'Selected' : 'Select Date'}
                          </button>
                        ) : (
                          <button
                            onClick={() => request_emergency_booking(date_info.date)}
                            className="w-full mt-2 px-4 py-2 rounded-lg font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                          >
                            Request Emergency Booking
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Legend */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-600">Available</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-gray-600">Fully Booked</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600">Today</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Details Section */}
            <div className="space-y-6">
              {/* Time Slot Selection */}
              {selected_date && !is_emergency_requested && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Time Slot</h3>
                  
                  <div className="space-y-2">
                    {available_time_slots.map((slot, index) => (
                      <button
                        key={index}
                        onClick={() => set_selected_time_slot(slot)}
                        className={`
                          w-full px-4 py-3 rounded-lg border-2 text-left transition-all
                          ${selected_time_slot?.start_at === slot.start_at
                            ? 'border-yellow-500 bg-yellow-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <Clock className="w-5 h-5 text-gray-600" />
                          <span className="font-medium text-gray-900">
                            {format_time(slot.start_at)} - {format_time(slot.end_at)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking Summary */}
              {selected_date && selected_time_slot && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service</span>
                      <span className="font-medium text-gray-900">{quote_response.service.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date</span>
                      <span className="font-medium text-gray-900">{format_date_long(selected_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time</span>
                      <span className="font-medium text-gray-900">
                        {format_time(selected_time_slot.start_at)} - {format_time(selected_time_slot.end_at)}
                      </span>
                    </div>
                    {is_emergency_requested && emergency_fee_info && (
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600">Original Total</span>
                          <span className="text-gray-900">€{Number(emergency_fee_info.original_total || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-red-600">Emergency Fee (+{emergency_fee_info.fee_percentage}%)</span>
                          <span className="text-red-600">€{Number(emergency_fee_info.fee_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-lg">
                          <span className="text-gray-900">New Total</span>
                          <span className="text-gray-900">€{Number(emergency_fee_info.new_total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={confirm_booking}
                    disabled={create_booking_mutation.isPending}
                    className="w-full mt-6 px-6 py-3 bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {create_booking_mutation.isPending ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Confirming Booking...
                      </span>
                    ) : (
                      'Confirm Booking'
                    )}
                  </button>
                </div>
              )}

              {/* Help Text */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-900 font-medium">How to Book</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Select a date from the calendar, then choose your preferred time slot. 
                      If your preferred date is full, you can request an emergency booking with an additional fee.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Booking Modal */}
      {show_emergency_modal && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-60 z-40" onClick={() => set_show_emergency_modal(false)}></div>
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Request Emergency Booking</h3>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-900 text-sm">
                  This date is fully booked. Emergency bookings are available for urgent needs and incur an additional urgent fee of +{emergency_fee_info?.fee_percentage}%.
                </p>
              </div>

              {emergency_fee_info && (
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Original Quote Total</span>
                    <span className="text-gray-900">€{Number(emergency_fee_info.original_total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">Urgent Fee (+{emergency_fee_info.fee_percentage}%)</span>
                    <span className="text-red-600">€{Number(emergency_fee_info.fee_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between">
                    <span className="font-semibold text-gray-900">New Total</span>
                    <span className="font-semibold text-gray-900">€{Number(emergency_fee_info.new_total || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emergency_accepted}
                    onChange={(e) => set_emergency_accepted(e.target.checked)}
                    className="mt-1 w-5 h-5 text-yellow-500 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <span className="text-sm text-gray-700">
                    I understand and accept the urgent fee of +{emergency_fee_info?.fee_percentage}%.
                  </span>
                </label>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    set_show_emergency_modal(false);
                    set_emergency_accepted(false);
                    set_is_emergency_requested(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirm_emergency_booking}
                  disabled={!emergency_accepted}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-black rounded-lg font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Emergency Booking
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default UV_CUST_BookingCalendar;