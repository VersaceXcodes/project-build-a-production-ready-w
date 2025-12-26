import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// =====================
// TYPE DEFINITIONS
// =====================

interface Booking {
  id: string;
  quote_id: string;
  customer_id: string;
  start_at: string;
  end_at: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  is_emergency: boolean;
  urgent_fee_pct: number;
  created_at: string;
  updated_at: string;
  service_name?: string;
}

interface CalendarSettings {
  id: string;
  working_days: string;
  start_hour: number;
  end_hour: number;
  slot_duration_minutes: number;
  slots_per_day: number;
  emergency_slots_per_day: number;
  updated_at: string;
}

interface BookingWithDetails {
  booking: Booking;
  customer: {
    id: string;
    name: string;
  };
  service: {
    id: string;
    name: string;
  };
}

// =====================
// HELPER FUNCTIONS
// =====================

const getMonthDateRange = (date: Date): { start_date: string; end_date: string } => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  };
};

const getWeekDateRange = (date: Date): { start_date: string; end_date: string } => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(date.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return {
    start_date: monday.toISOString().split('T')[0],
    end_date: sunday.toISOString().split('T')[0],
  };
};

const getDayDateRange = (date: Date): { start_date: string; end_date: string } => {
  const dateStr = date.toISOString().split('T')[0];
  return {
    start_date: dateStr,
    end_date: dateStr,
  };
};

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const getBookingStatusColor = (status: string): string => {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    case 'COMPLETED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// =====================
// MAIN COMPONENT
// =====================

const UV_STAFF_Calendar: React.FC = () => {
  // URL params management
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Extract URL params
  const viewParam = searchParams.get('view') as 'month' | 'week' | 'day' | null;
  const dateParam = searchParams.get('date');
  
  // Local state
  const [calendar_view, set_calendar_view] = useState<'month' | 'week' | 'day'>(viewParam || 'month');
  const [focused_date, set_focused_date] = useState<string>(dateParam || new Date().toISOString().split('T')[0]);
  const [selected_booking, set_selected_booking] = useState<BookingWithDetails | null>(null);

  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const is_mobile = useAppStore(state => state.ui_state.is_mobile);
  const show_toast = useAppStore(state => state.show_toast);

  // Sync URL params with state
  useEffect(() => {
    if (viewParam !== calendar_view || dateParam !== focused_date) {
      const newParams = new URLSearchParams();
      newParams.set('view', calendar_view);
      newParams.set('date', focused_date);
      setSearchParams(newParams);
    }
  }, [calendar_view, focused_date, viewParam, dateParam, setSearchParams]);

  // Calculate date range based on view mode
  const date_range = useMemo(() => {
    const date = new Date(focused_date);
    
    if (calendar_view === 'month') {
      return getMonthDateRange(date);
    } else if (calendar_view === 'week') {
      return getWeekDateRange(date);
    } else {
      return getDayDateRange(date);
    }
  }, [calendar_view, focused_date]);

  // Fetch calendar settings
  const { data: calendar_settings } = useQuery<CalendarSettings>({
    queryKey: ['calendar-settings'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/calendar-settings`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return response.data;
    },
    staleTime: 300000, // 5 minutes
    enabled: !!auth_token,
  });

  // Fetch bookings for current date range
  const { 
    data: bookings_data = [], 
    isLoading: is_loading,
    error,
    refetch: refetch_bookings 
  } = useQuery<Booking[]>({
    queryKey: ['staff-calendar-bookings', date_range.start_date, date_range.end_date],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings`,
        {
          params: {
            start_date: date_range.start_date,
            end_date: date_range.end_date,
          },
          headers: { Authorization: `Bearer ${auth_token}` }
        }
      );
      return response.data;
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
    enabled: !!auth_token && !!date_range.start_date,
  });

  // =====================
  // EVENT HANDLERS
  // =====================

  const change_calendar_view = (new_view: 'month' | 'week' | 'day') => {
    set_calendar_view(new_view);
  };

  const navigate_to_date = (new_date: string) => {
    set_focused_date(new_date);
  };

  const navigate_to_today = () => {
    const today = new Date().toISOString().split('T')[0];
    set_focused_date(today);
  };

  const navigate_previous = () => {
    const date = new Date(focused_date);
    
    if (calendar_view === 'month') {
      date.setMonth(date.getMonth() - 1);
    } else if (calendar_view === 'week') {
      date.setDate(date.getDate() - 7);
    } else {
      date.setDate(date.getDate() - 1);
    }
    
    set_focused_date(date.toISOString().split('T')[0]);
  };

  const navigate_next = () => {
    const date = new Date(focused_date);
    
    if (calendar_view === 'month') {
      date.setMonth(date.getMonth() + 1);
    } else if (calendar_view === 'week') {
      date.setDate(date.getDate() + 7);
    } else {
      date.setDate(date.getDate() + 1);
    }
    
    set_focused_date(date.toISOString().split('T')[0]);
  };

  const select_booking = (booking: Booking) => {
    // Transform booking data to match expected structure
    set_selected_booking({
      booking,
      customer: {
        id: booking.customer_id,
        name: 'Customer', // Backend doesn't return customer name in bookings endpoint
      },
      service: {
        id: booking.quote_id,
        name: booking.service_name || 'Service',
      },
    });
  };

  const close_booking_modal = () => {
    set_selected_booking(null);
  };

  // =====================
  // RENDER HELPERS
  // =====================

  const renderViewToggle = () => (
    <div className="flex space-x-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => change_calendar_view('month')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          calendar_view === 'month'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Month
      </button>
      <button
        onClick={() => change_calendar_view('week')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          calendar_view === 'week'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Week
      </button>
      <button
        onClick={() => change_calendar_view('day')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          calendar_view === 'day'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Day
      </button>
    </div>
  );

  const renderDateNavigation = () => {
    const date = new Date(focused_date);
    let displayText = '';
    
    if (calendar_view === 'month') {
      displayText = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (calendar_view === 'week') {
      const range = getWeekDateRange(new Date(focused_date));
      displayText = `${formatDate(range.start_date)} - ${formatDate(range.end_date)}`;
    } else {
      displayText = formatDate(focused_date);
    }
    
    return (
      <div className="flex items-center space-x-4">
        <button
          onClick={navigate_previous}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Previous"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
          {displayText}
        </h2>
        
        <button
          onClick={navigate_next}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Next"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        <button
          onClick={navigate_to_today}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Today
        </button>
      </div>
    );
  };

  const renderMonthView = () => {
    const date = new Date(focused_date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days: (number | null)[] = [];
    
    // Add empty cells for days before month start
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {weekDays.map((day) => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-gray-600 uppercase">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="min-h-[120px] border-r border-b border-gray-100" />;
            }
            
            const dateStr = new Date(year, month, day).toISOString().split('T')[0];
            const dayBookings = bookings_data.filter((b: Booking) => {
              const bookingDate = new Date(b.start_at).toISOString().split('T')[0];
              return bookingDate === dateStr;
            });
            
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            
            return (
              <div
                key={dateStr}
                className={`min-h-[120px] border-r border-b border-gray-100 p-2 ${
                  isToday ? 'bg-blue-50' : ''
                }`}
              >
                <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {day}
                </div>
                
                <div className="space-y-1">
                  {dayBookings.slice(0, 3).map((booking: Booking) => (
                    <button
                      key={booking.id}
                      onClick={() => select_booking(booking)}
                      className={`w-full text-left px-2 py-1 rounded text-xs truncate transition-all ${
                        booking.is_emergency
                          ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {formatTime(booking.start_at)} - {booking.service_name || 'Service'}
                    </button>
                  ))}
                  
                  {dayBookings.length > 3 && (
                    <div className="text-xs text-gray-500 px-2">
                      +{dayBookings.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const range = getWeekDateRange(new Date(focused_date));
    const startDate = new Date(range.start_date);
    const dates: string[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    const hours = calendar_settings ? 
      Array.from({ length: calendar_settings.end_hour - calendar_settings.start_hour }, (_, i) => calendar_settings.start_hour + i) :
      Array.from({ length: 9 }, (_, i) => 9 + i); // Default 9-18
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Date headers */}
          <div className="grid grid-cols-8 border-b border-gray-200">
            <div className="py-3 px-2 text-xs font-semibold text-gray-600"></div>
            {dates.map((dateStr) => {
              const date = new Date(dateStr);
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              return (
                <div
                  key={dateStr}
                  className={`py-3 px-2 text-center border-l border-gray-200 ${
                    isToday ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-sm ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Time slots grid */}
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
              <div className="py-2 px-2 text-xs text-gray-500 text-right">
                {hour % 12 || 12}:00 {hour < 12 ? 'AM' : 'PM'}
              </div>
              
              {dates.map((dateStr) => {
                const dateBookings = bookings_data.filter((b: Booking) => {
                  const bookingDate = new Date(b.start_at).toISOString().split('T')[0];
                  const bookingHour = new Date(b.start_at).getHours();
                  return bookingDate === dateStr && bookingHour === hour;
                });
                
                return (
                  <div key={`${dateStr}-${hour}`} className="border-l border-gray-100 p-1 min-h-[60px]">
                    {dateBookings.map((booking: Booking) => (
                      <button
                        key={booking.id}
                        onClick={() => select_booking(booking)}
                        className={`w-full text-left px-2 py-1 rounded text-xs mb-1 transition-all ${
                          booking.is_emergency
                            ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        <div className="font-medium truncate">{booking.service_name || 'Service'}</div>
                        <div className="text-xs opacity-90">{formatTime(booking.start_at)}</div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = calendar_settings ? 
      Array.from({ length: calendar_settings.end_hour - calendar_settings.start_hour }, (_, i) => calendar_settings.start_hour + i) :
      Array.from({ length: 9 }, (_, i) => 9 + i);
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {hours.map((hour) => {
          const hourBookings = bookings_data.filter((b: Booking) => {
            const bookingHour = new Date(b.start_at).getHours();
            return bookingHour === hour;
          });
          
          return (
            <div key={hour} className="flex border-b border-gray-100">
              <div className="w-24 py-4 px-4 text-sm text-gray-500 text-right border-r border-gray-100">
                {hour % 12 || 12}:00 {hour < 12 ? 'AM' : 'PM'}
              </div>
              
              <div className="flex-1 p-2 min-h-[80px]">
                {hourBookings.map((booking: Booking) => (
                  <button
                    key={booking.id}
                    onClick={() => select_booking(booking)}
                    className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition-all ${
                      booking.is_emergency
                        ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{booking.service_name || 'Service'}</div>
                        <div className="text-sm opacity-90">
                          {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                        </div>
                      </div>
                      
                      {booking.is_emergency && (
                        <span className="flex items-center text-xs font-semibold">
                          ⚡ Emergency
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAgendaList = () => {
    // Group bookings by date
    const bookingsByDate: Record<string, Booking[]> = {};
    
    bookings_data.forEach((booking: Booking) => {
      const dateStr = new Date(booking.start_at).toISOString().split('T')[0];
      if (!bookingsByDate[dateStr]) {
        bookingsByDate[dateStr] = [];
      }
      bookingsByDate[dateStr].push(booking);
    });
    
    const sortedDates = Object.keys(bookingsByDate).sort();
    
    if (sortedDates.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm text-gray-600">No bookings scheduled for this period</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        {sortedDates.map((dateStr) => {
          const dayBookings = bookingsByDate[dateStr];
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          
          return (
            <div key={dateStr} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className={`px-4 py-3 border-b border-gray-200 ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <h3 className={`text-sm font-semibold ${isToday ? 'text-blue-900' : 'text-gray-900'}`}>
                  {formatDate(dateStr)}
                  {isToday && <span className="ml-2 text-blue-600">• Today</span>}
                </h3>
              </div>
              
              <div className="divide-y divide-gray-100">
                {dayBookings.map((booking: Booking) => (
                  <button
                    key={booking.id}
                    onClick={() => select_booking(booking)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getBookingStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                          
                          {booking.is_emergency && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-500 text-black text-xs font-semibold">
                              ⚡ Emergency
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm font-medium text-gray-900">
                          {booking.service_name || 'Service'}
                        </div>
                        
                        <div className="text-xs text-gray-600 mt-1">
                          {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                        </div>
                      </div>
                      
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBookingModal = () => {
    if (!selected_booking) return null;
    
    const { booking } = selected_booking;
    
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" onClick={close_booking_modal}>
        {/* Overlay */}
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
        
        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Booking Details</h3>
                <button
                  onClick={close_booking_modal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {/* Service */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Service</label>
                <p className="text-sm text-gray-900">{booking.service_name || 'Service'}</p>
              </div>
              
              {/* Date & Time */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date & Time</label>
                <p className="text-sm text-gray-900">
                  {formatDate(new Date(booking.start_at).toISOString().split('T')[0])}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                </p>
              </div>
              
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getBookingStatusColor(booking.status)}`}>
                  {booking.status}
                </span>
              </div>
              
              {/* Emergency indicator */}
              {booking.is_emergency && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex items-start">
                    <span className="text-yellow-500 text-lg mr-2">⚡</span>
                    <div>
                      <p className="text-sm font-semibold text-yellow-900">Emergency Booking</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Urgent fee: {booking.urgent_fee_pct}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Booking ID */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Booking ID</label>
                <p className="text-xs font-mono text-gray-600">{booking.id}</p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
              <div className="flex space-x-3">
                <Link
                  to={`/staff/jobs/${booking.quote_id}`}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium text-center hover:bg-blue-700 transition-colors"
                >
                  View Full Job
                </Link>
                <button
                  onClick={close_booking_modal}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =====================
  // MAIN RENDER
  // =====================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
                  <p className="mt-1 text-sm text-gray-600">View and manage scheduled bookings</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Legend */}
                  <div className="flex items-center space-x-4 text-xs">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded bg-blue-500"></div>
                      <span className="text-gray-600">Regular</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded bg-yellow-500"></div>
                      <span className="text-gray-600">Emergency</span>
                    </div>
                  </div>
                  
                  {/* Back to Jobs link */}
                  <Link
                    to="/staff/jobs"
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Jobs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              {/* Date navigation */}
              {renderDateNavigation()}
              
              {/* View toggle (hide on mobile) */}
              {!is_mobile && renderViewToggle()}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Loading state */}
          {is_loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2 text-gray-600">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Loading calendar...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">Failed to load calendar</p>
                  <p className="text-xs text-red-700 mt-1">{error instanceof Error ? error.message : 'An error occurred'}</p>
                  <button
                    onClick={() => refetch_bookings()}
                    className="mt-2 text-xs text-red-600 hover:text-red-500 font-medium"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Calendar views */}
          {!is_loading && !error && (
            <>
              {is_mobile ? (
                // Mobile: Always show agenda list
                renderAgendaList()
              ) : (
                // Desktop: Show selected view
                <>
                  {calendar_view === 'month' && renderMonthView()}
                  {calendar_view === 'week' && renderWeekView()}
                  {calendar_view === 'day' && renderDayView()}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Booking detail modal */}
      {selected_booking && renderBookingModal()}
    </>
  );
};

export default UV_STAFF_Calendar;