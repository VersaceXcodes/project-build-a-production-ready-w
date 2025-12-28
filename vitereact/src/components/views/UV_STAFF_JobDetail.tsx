import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  ClipboardList, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Package, 
  Upload, 
  Send, 
  CheckCircle, 
  AlertCircle,
  Clock,
  MessageSquare,
  FileText,
  X,
  Check
} from 'lucide-react';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface Order {
  id: string;
  quote_id: string;
  customer_id: string;
  tier_id: string;
  status: 'QUOTE_REQUESTED' | 'APPROVED' | 'IN_PRODUCTION' | 'PROOF_SENT' | 'AWAITING_APPROVAL' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED';
  due_at: string | null;
  total_subtotal: number;
  tax_amount: number;
  total_amount: number;
  deposit_pct: number;
  deposit_amount: number;
  revision_count: number;
  assigned_staff_id: string | null;
  location_id: string | null;
  created_at: string;
  updated_at: string;
}

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
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  requires_booking: boolean;
  requires_proof: boolean;
  is_top_seller: boolean;
  is_active: boolean;
  slot_duration_hours: number;
  created_at: string;
  updated_at: string;
}

interface TierPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TierFeature {
  id: string;
  tier_id: string;
  group_name: string;
  feature_key: string;
  feature_label: string;
  feature_value: string | null;
  is_included: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ProofVersion {
  id: string;
  order_id: string;
  version_number: number;
  file_url: string;
  created_by_staff_id: string;
  status: 'SENT' | 'APPROVED' | 'REVISION_REQUESTED';
  customer_comment: string | null;
  internal_notes: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageThread {
  id: string;
  quote_id: string | null;
  order_id: string | null;
  created_at: string;
}

interface Message {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_role?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomerProfile {
  id: string;
  user_id: string;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

interface Booking {
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

interface OrderDetailResponse {
  order: Order;
  quote: Quote;
  service: Service;
  tier: TierPackage;
  booking: Booking | null;
  proof_versions: ProofVersion[];
  invoice: any;
  payments: any[];
  message_thread: MessageThread | null;
}

// ===========================
// API FUNCTIONS
// ===========================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const fetchJobDetail = async (orderId: string, authToken: string): Promise<OrderDetailResponse> => {
  const response = await axios.get(`${API_BASE_URL}/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return response.data;
};

const fetchCustomerInfo = async (customerId: string, authToken: string): Promise<{ user: User; profile: CustomerProfile | null }> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/users/${customerId}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return response.data;
};

const fetchTierFeatures = async (tierId: string, authToken: string): Promise<TierFeature[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/public/tiers`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  
  const tierData = response.data.find((t: any) => t.tier.id === tierId);
  return tierData?.features || [];
};

const fetchThreadMessages = async (threadId: string, authToken: string): Promise<Message[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/message-threads/${threadId}/messages`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return response.data;
};

const sendMessage = async (threadId: string, body: string, authToken: string): Promise<Message> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/message-threads/${threadId}/messages`,
    { body },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

const uploadFile = async (file: File, authToken: string): Promise<{ id: string; file_url: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await axios.post(
    `${API_BASE_URL}/api/uploads`,
    formData,
    { 
      headers: { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'multipart/form-data'
      } 
    }
  );
  return response.data;
};

const uploadProof = async (orderId: string, fileUrl: string, internalNotes: string, authToken: string): Promise<ProofVersion> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/orders/${orderId}/proofs`,
    { file_url: fileUrl, internal_notes: internalNotes },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

const updateOrderStatus = async (orderId: string, status: string, notes: string, authToken: string): Promise<Order> => {
  const response = await axios.patch(
    `${API_BASE_URL}/api/orders/${orderId}`,
    { status, notes },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
};

// ===========================
// MAIN COMPONENT
// ===========================

const UV_STAFF_JobDetail: React.FC = () => {
  const { order_id } = useParams<{ order_id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // CRITICAL: Individual Zustand selectors (no object destructuring)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);
  
  // Local UI state
  const [newMessageBody, setNewMessageBody] = useState('');
  const [showProofUploadModal, setShowProofUploadModal] = useState(false);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [proofInternalNotes, setProofInternalNotes] = useState('');
  const [statusUpdateForm, setStatusUpdateForm] = useState({ new_status: '', notes: '' });
  const [tierChecklistLocal, setTierChecklistLocal] = useState<Record<string, boolean>>({});
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!authToken || !currentUser) {
      navigate('/login?returnTo=/staff/jobs/' + order_id);
    }
  }, [authToken, currentUser, navigate, order_id]);
  
  // Fetch job detail
  const { 
    data: jobData, 
    isLoading: isLoadingJob, 
    error: jobError,
    refetch: refetchJob 
  } = useQuery({
    queryKey: ['staff-job', order_id],
    queryFn: () => fetchJobDetail(order_id!, authToken!),
    enabled: !!authToken && !!order_id,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });
  
  // Fetch customer info
  const { data: customerData } = useQuery({
    queryKey: ['customer', jobData?.order.customer_id],
    queryFn: () => fetchCustomerInfo(jobData!.order.customer_id, authToken!),
    enabled: !!authToken && !!jobData?.order.customer_id,
    staleTime: 60000
  });
  
  // Fetch tier features
  const { data: tierFeatures = [] } = useQuery({
    queryKey: ['tier-features', jobData?.tier.id],
    queryFn: () => fetchTierFeatures(jobData!.tier.id, authToken!),
    enabled: !!authToken && !!jobData?.tier.id,
    staleTime: 60000
  });
  
  // Fetch messages
  const { data: threadMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['thread-messages', jobData?.message_thread?.id],
    queryFn: () => fetchThreadMessages(jobData!.message_thread!.id, authToken!),
    enabled: !!authToken && !!jobData?.message_thread?.id,
    staleTime: 10000
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (body: string) => sendMessage(jobData!.message_thread!.id, body, authToken!),
    onSuccess: () => {
      setNewMessageBody('');
      refetchMessages();
      showToast({ type: 'success', message: 'Message sent successfully', duration: 3000 });
    },
    onError: (error: any) => {
      showToast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to send message', 
        duration: 5000 
      });
    }
  });
  
  // Upload proof mutation
  const uploadProofMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      
      // First upload file
      const uploadResult = await uploadFile(selectedFile, authToken!);
      
      // Then create proof version
      return uploadProof(order_id!, uploadResult.file_url, proofInternalNotes, authToken!);
    },
    onSuccess: () => {
      setShowProofUploadModal(false);
      setSelectedFile(null);
      setProofInternalNotes('');
      refetchJob();
      showToast({ type: 'success', message: 'Proof uploaded and customer notified', duration: 5000 });
    },
    onError: (error: any) => {
      showToast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to upload proof', 
        duration: 5000 
      });
    }
  });
  
  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: () => updateOrderStatus(
      order_id!, 
      statusUpdateForm.new_status, 
      statusUpdateForm.notes, 
      authToken!
    ),
    onSuccess: () => {
      setShowStatusUpdateModal(false);
      setStatusUpdateForm({ new_status: '', notes: '' });
      refetchJob();
      showToast({ type: 'success', message: 'Order status updated successfully', duration: 3000 });
    },
    onError: (error: any) => {
      showToast({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to update status', 
        duration: 5000 
      });
    }
  });
  
  // Handle send message
  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessageBody.trim()) {
      showToast({ type: 'warning', message: 'Message cannot be empty', duration: 3000 });
      return;
    }
    
    if (newMessageBody.length > 1000) {
      showToast({ type: 'warning', message: 'Message must be 1000 characters or less', duration: 3000 });
      return;
    }
    
    sendMessageMutation.mutate(newMessageBody);
  }, [newMessageBody, sendMessageMutation, showToast]);
  
  // Handle proof upload
  const handleProofUpload = useCallback(() => {
    if (!selectedFile) {
      showToast({ type: 'warning', message: 'Please select a file', duration: 3000 });
      return;
    }
    
    uploadProofMutation.mutate();
  }, [selectedFile, uploadProofMutation, showToast]);
  
  // Handle status update
  const handleStatusUpdate = useCallback(() => {
    if (!statusUpdateForm.new_status) {
      showToast({ type: 'warning', message: 'Please select a status', duration: 3000 });
      return;
    }
    
    updateStatusMutation.mutate();
  }, [statusUpdateForm, updateStatusMutation, showToast]);
  
  // Calculate days until due
  const getDaysUntilDue = (dueAt: string | null): number | null => {
    if (!dueAt) return null;
    const due = new Date(dueAt);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'QUOTE_REQUESTED': return 'bg-gray-100 text-gray-800';
      case 'APPROVED': return 'bg-blue-100 text-blue-800';
      case 'IN_PRODUCTION': return 'bg-purple-100 text-purple-800';
      case 'PROOF_SENT': return 'bg-yellow-100 text-yellow-800';
      case 'AWAITING_APPROVAL': return 'bg-orange-100 text-orange-800';
      case 'READY_FOR_PICKUP': return 'bg-green-100 text-green-800';
      case 'COMPLETED': return 'bg-green-600 text-white';
      case 'CANCELLED': return 'bg-red-600 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        showToast({ type: 'error', message: 'File size must be less than 50MB', duration: 5000 });
        return;
      }
      setSelectedFile(file);
    }
  };
  
  // Toggle checklist item (client-side only)
  const toggleChecklistItem = (featureId: string) => {
    setTierChecklistLocal(prev => ({
      ...prev,
      [featureId]: !prev[featureId]
    }));
  };
  
  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get allowed status transitions
  const getAllowedStatuses = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case 'QUOTE_REQUESTED':
        return ['APPROVED', 'IN_PRODUCTION'];
      case 'APPROVED':
        return ['IN_PRODUCTION'];
      case 'IN_PRODUCTION':
        return ['PROOF_SENT', 'AWAITING_APPROVAL'];
      case 'PROOF_SENT':
        return ['AWAITING_APPROVAL', 'IN_PRODUCTION'];
      case 'AWAITING_APPROVAL':
        return ['IN_PRODUCTION', 'READY_FOR_PICKUP'];
      case 'READY_FOR_PICKUP':
        return ['COMPLETED'];
      default:
        return [];
    }
  };
  
  // Loading state
  if (isLoadingJob) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (jobError || !jobData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h2>
          <p className="text-gray-600 mb-6">The job you're looking for doesn't exist or you don't have access to it.</p>
          <Link 
            to="/staff/jobs"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Job Queue
          </Link>
        </div>
      </div>
    );
  }
  
  const { order, quote, service, tier, booking, proof_versions, message_thread } = jobData;
  const customer = customerData?.user;
  const customerProfile = customerData?.profile;
  
  const daysUntilDue = getDaysUntilDue(order.due_at);
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
  const allowedStatuses = getAllowedStatuses(order.status);
  
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link 
                  to="/staff/jobs"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    Job #{order.id.slice(0, 8).toUpperCase()}
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">{service.name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${getStatusColor(order.status)}`}>
                  {order.status.replace(/_/g, ' ')}
                </span>
                
                {daysUntilDue !== null && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    isOverdue 
                      ? 'bg-red-100 text-red-800' 
                      : daysUntilDue <= 2 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {isOverdue 
                        ? `${Math.abs(daysUntilDue)} days overdue`
                        : `Due in ${daysUntilDue} days`
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Info Panel */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Customer Information
                  </h2>
                </div>
                
                <div className="p-6">
                  {customer ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="text-base font-medium text-gray-900">{customer.name}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Email</p>
                          <a 
                            href={`mailto:${customer.email}`}
                            className="text-base text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                            {customer.email}
                          </a>
                        </div>
                        
                        {customerProfile?.phone && (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Phone</p>
                            <a 
                              href={`tel:${customerProfile.phone}`}
                              className="text-base text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 transition-colors"
                            >
                              <Phone className="w-4 h-4" />
                              {customerProfile.phone}
                            </a>
                          </div>
                        )}
                      </div>
                      
                      {customerProfile?.company_name && (
                        <div>
                          <p className="text-sm text-gray-600">Company</p>
                          <p className="text-base font-medium text-gray-900">{customerProfile.company_name}</p>
                        </div>
                      )}
                      
                      {customerProfile?.address && (
                        <div>
                          <p className="text-sm text-gray-600">Address</p>
                          <p className="text-base text-gray-700">{customerProfile.address}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">Loading customer information...</p>
                  )}
                </div>
              </div>
              
              {/* Job Details Panel */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Job Details
                  </h2>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Service</p>
                      <p className="text-base font-medium text-gray-900">{service.name}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Tier</p>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {tier.name}
                      </span>
                    </div>
                    
                    {booking && (
                      <div>
                        <p className="text-sm text-gray-600">Booking Date</p>
                        <p className="text-base font-medium text-gray-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-600" />
                          {formatDate(booking.start_at)}
                        </p>
                      </div>
                    )}
                    
                    {order.due_at && (
                      <div>
                        <p className="text-sm text-gray-600">Due Date</p>
                        <p className={`text-base font-medium flex items-center gap-2 ${
                          isOverdue ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          <Clock className="w-4 h-4" />
                          {formatDate(order.due_at)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Revision Count</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min((order.revision_count / 3) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {order.revision_count} / 3
                      </span>
                    </div>
                  </div>
                  
                  {quote?.notes && (
                    <div>
                      <p className="text-sm text-gray-600">Quote Notes</p>
                      <p className="text-base text-gray-700 mt-1 bg-gray-50 p-3 rounded-md">{quote.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Tier Deliverables Checklist */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    Tier Requirements - {tier.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Track deliverable completion for this tier
                  </p>
                </div>
                
                <div className="p-6">
                  {tierFeatures.length > 0 ? (
                    <div className="space-y-3">
                      {tierFeatures
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((feature) => (
                          <div 
                            key={feature.id}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              id={`checklist-${feature.id}`}
                              checked={tierChecklistLocal[feature.id] || false}
                              onChange={() => toggleChecklistItem(feature.id)}
                              className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                            />
                            <label 
                              htmlFor={`checklist-${feature.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              <p className={`text-sm font-medium transition-colors ${
                                tierChecklistLocal[feature.id] ? 'text-gray-500 line-through' : 'text-gray-900'
                              }`}>
                                {feature.feature_label}
                              </p>
                              {feature.feature_value && (
                                <p className="text-sm text-gray-600 mt-1">{feature.feature_value}</p>
                              )}
                            </label>
                          </div>
                        ))}
                      
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Completion Progress</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {Object.values(tierChecklistLocal).filter(Boolean).length} / {tierFeatures.length}
                          </span>
                        </div>
                        <div className="mt-2 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${tierFeatures.length > 0 
                                ? (Object.values(tierChecklistLocal).filter(Boolean).length / tierFeatures.length) * 100 
                                : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Note:</strong> Checklist progress is tracked locally. Backend persistence coming soon.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No tier requirements defined</p>
                  )}
                </div>
              </div>
              
              {/* Proof Management Section */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Design Proofs
                  </h2>
                  <button
                    onClick={() => setShowProofUploadModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Upload className="w-4 h-4" />
                    Upload New Proof
                  </button>
                </div>
                
                <div className="p-6">
                  {proof_versions.length > 0 ? (
                    <div className="space-y-4">
                      {proof_versions
                        .sort((a, b) => b.version_number - a.version_number)
                        .map((proof) => (
                          <div 
                            key={proof.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-base font-semibold text-gray-900">
                                  Version {proof.version_number}
                                </h3>
                                <p className="text-sm text-gray-600">{formatDate(proof.created_at)}</p>
                              </div>
                              
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                proof.status === 'APPROVED' 
                                  ? 'bg-green-100 text-green-800'
                                  : proof.status === 'REVISION_REQUESTED'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-blue-100 text-blue-800'
                              }`}>
                                {proof.status === 'SENT' && '⏳ Awaiting customer review'}
                                {proof.status === 'APPROVED' && '✓ Approved'}
                                {proof.status === 'REVISION_REQUESTED' && '🔄 Changes requested'}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-3">
                              <a
                                href={proof.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                              >
                                <FileText className="w-4 h-4" />
                                View Full Size
                              </a>
                            </div>
                            
                            {proof.customer_comment && (
                              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-sm font-medium text-orange-900 mb-2 flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4" />
                                  Customer Feedback:
                                </p>
                                <p className="text-sm text-orange-800">{proof.customer_comment}</p>
                              </div>
                            )}
                            
                            {proof.internal_notes && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                <p className="text-xs text-gray-600 mb-1">Internal Notes:</p>
                                <p className="text-sm text-gray-700">{proof.internal_notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No proofs uploaded yet</p>
                      <button
                        onClick={() => setShowProofUploadModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Upload className="w-5 h-5" />
                        Upload First Proof
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right Column - Actions & Messages */}
            <div className="space-y-6">
              {/* Status Update Panel */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Update Status</h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Status
                      </label>
                      <span className={`inline-block px-4 py-2 rounded-lg text-sm font-semibold ${getStatusColor(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    
                    {allowedStatuses.length > 0 ? (
                      <button
                        onClick={() => setShowStatusUpdateModal(true)}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        Update Status
                      </button>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-2">
                        No status updates available
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Messages Section */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden sticky top-24">
                <div className="px-6 py-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    Messages
                  </h2>
                </div>
                
                <div className="h-96 flex flex-col">
                  {/* Messages List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {threadMessages.length > 0 ? (
                      threadMessages.map((message) => {
                        const isStaffMessage = message.sender_user_id === currentUser?.id;
                        
                        return (
                          <div 
                            key={message.id}
                            className={`flex ${isStaffMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                              isStaffMessage
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              {!isStaffMessage && (
                                <p className="text-xs font-medium mb-1 opacity-80">
                                  {message.sender_name || 'Customer'}
                                </p>
                              )}
                              <p className="text-sm leading-relaxed">{message.body}</p>
                              <p className={`text-xs mt-2 ${
                                isStaffMessage ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {formatDate(message.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No messages yet</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Message Input */}
                  {message_thread && (
                    <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4">
                      <div className="flex gap-2">
                        <textarea
                          value={newMessageBody}
                          onChange={(e) => setNewMessageBody(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                            }
                          }}
                          placeholder="Type your message..."
                          maxLength={1000}
                          rows={2}
                          className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none text-sm"
                        />
                        <button
                          type="submit"
                          disabled={!newMessageBody.trim() || sendMessageMutation.isPending}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendMessageMutation.isPending ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {newMessageBody.length} / 1000 characters
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Proof Upload Modal */}
      {showProofUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Upload New Proof</h3>
              <button
                onClick={() => {
                  setShowProofUploadModal(false);
                  setSelectedFile(null);
                  setProofInternalNotes('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proof File <span className="text-red-600">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 p-2"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Internal Notes (Optional)
                </label>
                <textarea
                  value={proofInternalNotes}
                  onChange={(e) => setProofInternalNotes(e.target.value)}
                  placeholder="Add notes for your team (not visible to customer)..."
                  rows={3}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none text-sm"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowProofUploadModal(false);
                    setSelectedFile(null);
                    setProofInternalNotes('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProofUpload}
                  disabled={!selectedFile || uploadProofMutation.isPending}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadProofMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </span>
                  ) : (
                    'Upload & Notify Customer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Status Update Modal */}
      {showStatusUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Update Order Status</h3>
              <button
                onClick={() => {
                  setShowStatusUpdateModal(false);
                  setStatusUpdateForm({ new_status: '', notes: '' });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status <span className="text-red-600">*</span>
                </label>
                <select
                  value={statusUpdateForm.new_status}
                  onChange={(e) => setStatusUpdateForm(prev => ({ ...prev, new_status: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-sm"
                >
                  <option value="">Select new status...</option>
                  {allowedStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={statusUpdateForm.notes}
                  onChange={(e) => setStatusUpdateForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes about this status change..."
                  rows={3}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none text-sm"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowStatusUpdateModal(false);
                    setStatusUpdateForm({ new_status: '', notes: '' });
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusUpdate}
                  disabled={!statusUpdateForm.new_status || updateStatusMutation.isPending}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateStatusMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </span>
                  ) : (
                    'Update Status'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_STAFF_JobDetail;