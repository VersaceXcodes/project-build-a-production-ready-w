import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { User, UserPlus, Search, Filter, Edit2, Trash2, RefreshCw, X, Check, AlertCircle, Users, Briefcase, Shield } from 'lucide-react';

// =====================================================
// TYPE DEFINITIONS (from Zod schemas)
// =====================================================

interface User {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
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

interface StaffProfile {
  id: string;
  user_id: string;
  department: string | null;
  permissions: string; // JSON string
  created_at: string;
  updated_at: string;
}

interface UserWithProfile {
  user: User;
  profile: CustomerProfile | StaffProfile | null;
}

interface UsersListResponse {
  users: UserWithProfile[];
  total: number;
}

interface CreateUserFormData {
  name: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  phone: string;
  company_name: string;
  department: string;
  permissions: {
    can_view_all_jobs?: boolean;
    can_edit_pricing?: boolean;
    can_manage_users?: boolean;
  };
}

interface EditUserFormData {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  is_active: boolean;
  permissions: {
    can_view_all_jobs?: boolean;
    can_edit_pricing?: boolean;
    can_manage_users?: boolean;
  } | null;
}

// =====================================================
// API FUNCTIONS
// =====================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function fetchUsersList(
  authToken: string,
  role: string | null,
  status: string | null,
  searchQuery: string | null,
  page: number
): Promise<UsersListResponse> {
  const params = new URLSearchParams();
  if (role) params.append('role', role);
  if (status) params.append('status', status);
  if (searchQuery) params.append('search', searchQuery);
  params.append('page', page.toString());

  const response = await axios.get(`${API_BASE_URL}/api/admin/users?${params.toString()}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return response.data;
}

async function createUser(
  authToken: string,
  formData: CreateUserFormData
): Promise<void> {
  await axios.post(`${API_BASE_URL}/api/admin/users`, {
    name: formData.name,
    email: formData.email,
    password: formData.password,
    role: formData.role,
    phone: formData.role === 'CUSTOMER' ? formData.phone : null,
    company_name: formData.role === 'CUSTOMER' ? formData.company_name : null,
    department: formData.role === 'STAFF' || formData.role === 'ADMIN' ? formData.department : null,
    permissions: formData.role === 'STAFF' || formData.role === 'ADMIN' ? formData.permissions : null
  }, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
}

async function updateUser(
  authToken: string,
  userId: string,
  formData: Partial<EditUserFormData>
): Promise<void> {
  await axios.patch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    name: formData.name,
    email: formData.email,
    role: formData.role,
    is_active: formData.is_active,
    permissions: formData.permissions
  }, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
}

async function deleteUser(
  authToken: string,
  userId: string
): Promise<void> {
  await axios.delete(`${API_BASE_URL}/api/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
}

// =====================================================
// MAIN COMPONENT
// =====================================================

const UV_ADMIN_UsersManager: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Global state access - CRITICAL: Individual selectors
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // URL params to state
  const roleParam = searchParams.get('role');
  const statusParam = searchParams.get('status');
  const searchParam = searchParams.get('search');
  const pageParam = searchParams.get('page');

  // Local state variables
  const [filters, setFilters] = useState({
    role: roleParam as 'CUSTOMER' | 'STAFF' | 'ADMIN' | null,
    status: statusParam as 'active' | 'inactive' | null,
    search_query: searchParam || ''
  });

  const [pagination, setPagination] = useState({
    current_page: parseInt(pageParam || '1'),
    total_pages: 1,
    total_count: 0,
    limit: 20
  });

  const [createUserForm, setCreateUserForm] = useState<CreateUserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'CUSTOMER',
    phone: '',
    company_name: '',
    department: '',
    permissions: {}
  });

  const [editUserForm, setEditUserForm] = useState<EditUserFormData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirmationUser, setDeleteConfirmationUser] = useState<User | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.role) params.set('role', filters.role);
    if (filters.status) params.set('status', filters.status);
    if (filters.search_query) params.set('search', filters.search_query);
    if (pagination.current_page > 1) params.set('page', pagination.current_page.toString());
    
    const newSearch = params.toString();
    const currentSearch = searchParams.toString();
    if (newSearch !== currentSearch) {
      navigate(`/admin/users${newSearch ? '?' + newSearch : ''}`, { replace: true });
    }
  }, [filters, pagination.current_page]);

  // Fetch users list with React Query
  const { data: usersData, isLoading: isLoadingUsers, error: fetchError } = useQuery({
    queryKey: ['admin-users', filters.role, filters.status, filters.search_query, pagination.current_page],
    queryFn: () => fetchUsersList(
      authToken!,
      filters.role,
      filters.status === 'active' ? 'true' : filters.status === 'inactive' ? 'false' : null,
      filters.search_query || null,
      pagination.current_page
    ),
    enabled: !!authToken,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false
  });

  // Update pagination when data changes
  useEffect(() => {
    if (usersData) {
      setPagination(prev => ({
        ...prev,
        total_count: usersData.total,
        total_pages: Math.ceil(usersData.total / prev.limit)
      }));
    }
  }, [usersData]);

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (formData: CreateUserFormData) => createUser(authToken!, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreateModal(false);
      setCreateUserForm({
        name: '',
        email: '',
        password: '',
        role: 'CUSTOMER',
        phone: '',
        company_name: '',
        department: '',
        permissions: {}
      });
      showToast({
        type: 'success',
        message: 'User created successfully. Welcome email sent.',
        duration: 5000
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to create user',
        duration: 5000
      });
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, formData }: { userId: string; formData: Partial<EditUserFormData> }) =>
      updateUser(authToken!, userId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowEditModal(false);
      setEditUserForm(null);
      showToast({
        type: 'success',
        message: 'User updated successfully',
        duration: 5000
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update user',
        duration: 5000
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(authToken!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteConfirmationUser(null);
      setDeleteConfirmChecked(false);
      showToast({
        type: 'success',
        message: 'User account deactivated',
        duration: 5000
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to delete user',
        duration: 5000
      });
    }
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUser(authToken!, userId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showToast({
        type: 'success',
        message: 'User status updated',
        duration: 3000
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update status',
        duration: 5000
      });
    }
  });

  // Handler functions
  const handleRoleFilterChange = (role: 'CUSTOMER' | 'STAFF' | 'ADMIN' | null) => {
    setFilters(prev => ({ ...prev, role }));
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const handleStatusFilterChange = (status: 'active' | 'inactive' | null) => {
    setFilters(prev => ({ ...prev, status }));
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const handleSearchChange = (query: string) => {
    setFilters(prev => ({ ...prev, search_query: query }));
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };

  const handleOpenCreateModal = () => {
    setCreateUserForm({
      name: '',
      email: '',
      password: '',
      role: 'CUSTOMER',
      phone: '',
      company_name: '',
      department: '',
      permissions: {}
    });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (userWithProfile: UserWithProfile) => {
    let permissions: any = null;
    if (userWithProfile.user.role === 'STAFF' || userWithProfile.user.role === 'ADMIN') {
      const staffProfile = userWithProfile.profile as StaffProfile;
      if (staffProfile?.permissions) {
        try {
          permissions = JSON.parse(staffProfile.permissions);
        } catch (e) {
          permissions = {};
        }
      }
    }

    setEditUserForm({
      id: userWithProfile.user.id,
      name: userWithProfile.user.name,
      email: userWithProfile.user.email,
      role: userWithProfile.user.role,
      is_active: userWithProfile.user.is_active,
      permissions
    });
    setShowEditModal(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!createUserForm.name || !createUserForm.email || !createUserForm.password) {
      showToast({
        type: 'error',
        message: 'Name, email, and password are required',
        duration: 5000
      });
      return;
    }

    if (createUserForm.password.length < 8) {
      showToast({
        type: 'error',
        message: 'Password must be at least 8 characters',
        duration: 5000
      });
      return;
    }

    createUserMutation.mutate(createUserForm);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editUserForm) return;

    updateUserMutation.mutate({
      userId: editUserForm.id,
      formData: {
        name: editUserForm.name,
        email: editUserForm.email,
        role: editUserForm.role,
        is_active: editUserForm.is_active,
        permissions: editUserForm.permissions
      }
    });
  };

  const handleDeleteUser = () => {
    if (!deleteConfirmationUser || !deleteConfirmChecked) return;
    deleteUserMutation.mutate(deleteConfirmationUser.id);
  };

  const handleToggleStatus = (userId: string, currentStatus: boolean) => {
    toggleStatusMutation.mutate({ userId, isActive: !currentStatus });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'STAFF': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CUSTOMER': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return Shield;
      case 'STAFF': return Briefcase;
      case 'CUSTOMER': return Users;
      default: return User;
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Manage customer, staff, and admin accounts
                </p>
              </div>
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Add User
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filters Section */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
            {/* Role Tabs */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleRoleFilterChange(null)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    filters.role === null
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Users
                </button>
                <button
                  onClick={() => handleRoleFilterChange('CUSTOMER')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 inline-flex items-center ${
                    filters.role === 'CUSTOMER'
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Customers
                </button>
                <button
                  onClick={() => handleRoleFilterChange('STAFF')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 inline-flex items-center ${
                    filters.role === 'STAFF'
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  Staff
                </button>
                <button
                  onClick={() => handleRoleFilterChange('ADMIN')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 inline-flex items-center ${
                    filters.role === 'ADMIN'
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admins
                </button>
              </div>
            </div>

            {/* Search and Status Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={filters.search_query}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusFilterChange(null)}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filters.status === null
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => handleStatusFilterChange('active')}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filters.status === 'active'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => handleStatusFilterChange('inactive')}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filters.status === 'inactive'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {pagination.total_count}
                  </p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {usersData?.users.filter(u => u.user.is_active).length || 0}
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Staff Members</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {usersData?.users.filter(u => u.user.role === 'STAFF' || u.user.role === 'ADMIN').length || 0}
                  </p>
                </div>
                <div className="bg-purple-100 rounded-full p-3">
                  <Briefcase className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Users Table/List */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            {isLoadingUsers ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-yellow-400"></div>
                <p className="mt-4 text-gray-600">Loading users...</p>
              </div>
            ) : fetchError ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-600">Failed to load users</p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
                  className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : !usersData?.users || usersData.users.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No users found</p>
                <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Joined
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usersData.users.map((userWithProfile) => {
                        const { user, profile } = userWithProfile;
                        const RoleIcon = getRoleIcon(user.role);
                        
                        return (
                          <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-gray-600" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                                  {profile && 'company_name' in profile && profile.company_name && (
                                    <div className="text-xs text-gray-500">{profile.company_name}</div>
                                  )}
                                  {profile && 'department' in profile && profile.department && (
                                    <div className="text-xs text-gray-500">{profile.department}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{user.email}</div>
                              {profile && 'phone' in profile && profile.phone && (
                                <div className="text-xs text-gray-500">{profile.phone}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(user.role)}`}>
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleToggleStatus(user.id, user.is_active)}
                                disabled={toggleStatusMutation.isPending}
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                                  user.is_active
                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {user.is_active ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <X className="w-3 h-3 mr-1" />
                                    Inactive
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditModal(userWithProfile)}
                                  className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit user"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteConfirmationUser(user);
                                    setDeleteConfirmChecked(false);
                                  }}
                                  className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete user"
                                  disabled={user.id === currentUser?.id}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="md:hidden divide-y divide-gray-200">
                  {usersData.users.map((userWithProfile) => {
                    const { user, profile } = userWithProfile;
                    const RoleIcon = getRoleIcon(user.role);
                    
                    return (
                      <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-gray-600" />
                            </div>
                            <div className="ml-3">
                              <div className="text-base font-semibold text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(user.role)}`}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {user.role}
                          </span>
                        </div>

                        {profile && (
                          <div className="mb-3 pl-15">
                            {'company_name' in profile && profile.company_name && (
                              <div className="text-xs text-gray-500 mb-1">
                                Company: {profile.company_name}
                              </div>
                            )}
                            {'department' in profile && profile.department && (
                              <div className="text-xs text-gray-500 mb-1">
                                Department: {profile.department}
                              </div>
                            )}
                            {'phone' in profile && profile.phone && (
                              <div className="text-xs text-gray-500">
                                Phone: {profile.phone}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pl-15">
                          <button
                            onClick={() => handleToggleStatus(user.id, user.is_active)}
                            disabled={toggleStatusMutation.isPending}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                              user.is_active
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            } disabled:opacity-50`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditModal(userWithProfile)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirmationUser(user);
                                setDeleteConfirmChecked(false);
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 pl-15 text-xs text-gray-500">
                          Joined {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {((pagination.current_page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.current_page * pagination.limit, pagination.total_count)} of{' '}
                        {pagination.total_count} users
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePageChange(pagination.current_page - 1)}
                          disabled={pagination.current_page === 1}
                          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => handlePageChange(pagination.current_page + 1)}
                          disabled={pagination.current_page >= pagination.total_pages}
                          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Create New User</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    User Role *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setCreateUserForm(prev => ({ ...prev, role: 'CUSTOMER' }))}
                      className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                        createUserForm.role === 'CUSTOMER'
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateUserForm(prev => ({ ...prev, role: 'STAFF' }))}
                      className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                        createUserForm.role === 'STAFF'
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Briefcase className="w-4 h-4 mr-2" />
                      Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateUserForm(prev => ({ ...prev, role: 'ADMIN' }))}
                      className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                        createUserForm.role === 'ADMIN'
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Admin
                    </button>
                  </div>
                </div>

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="create-name" className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      id="create-name"
                      type="text"
                      required
                      value={createUserForm.name}
                      onChange={(e) => setCreateUserForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      id="create-email"
                      type="email"
                      required
                      value={createUserForm.email}
                      onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="create-password" className="block text-sm font-semibold text-gray-700 mb-2">
                    Temporary Password * <span className="text-xs text-gray-500">(min 8 characters)</span>
                  </label>
                  <input
                    id="create-password"
                    type="text"
                    required
                    minLength={8}
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                    placeholder="Temporary password (will be emailed to user)"
                  />
                  <p className="mt-1 text-xs text-gray-500">User will receive this password via email and can change it later</p>
                </div>

                {/* Customer-specific fields */}
                {createUserForm.role === 'CUSTOMER' && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Customer Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="create-phone" className="block text-sm font-medium text-gray-700 mb-2">
                          Phone
                        </label>
                        <input
                          id="create-phone"
                          type="tel"
                          value={createUserForm.phone}
                          onChange={(e) => setCreateUserForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                          placeholder="+1-555-0000"
                        />
                      </div>

                      <div>
                        <label htmlFor="create-company" className="block text-sm font-medium text-gray-700 mb-2">
                          Company Name
                        </label>
                        <input
                          id="create-company"
                          type="text"
                          value={createUserForm.company_name}
                          onChange={(e) => setCreateUserForm(prev => ({ ...prev, company_name: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                          placeholder="Acme Corp"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Staff/Admin-specific fields */}
                {(createUserForm.role === 'STAFF' || createUserForm.role === 'ADMIN') && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Staff Information</h3>
                    <div className="mb-4">
                      <label htmlFor="create-department" className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                      </label>
                      <input
                        id="create-department"
                        type="text"
                        value={createUserForm.department}
                        onChange={(e) => setCreateUserForm(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                        placeholder="Production"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Permissions
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={createUserForm.permissions.can_view_all_jobs || false}
                            onChange={(e) => setCreateUserForm(prev => ({
                              ...prev,
                              permissions: { ...prev.permissions, can_view_all_jobs: e.target.checked }
                            }))}
                            className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                          />
                          <span className="ml-3 text-sm text-gray-700">Can view all jobs</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={createUserForm.permissions.can_edit_pricing || false}
                            onChange={(e) => setCreateUserForm(prev => ({
                              ...prev,
                              permissions: { ...prev.permissions, can_edit_pricing: e.target.checked }
                            }))}
                            className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                          />
                          <span className="ml-3 text-sm text-gray-700">Can edit pricing</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={createUserForm.permissions.can_manage_users || false}
                            onChange={(e) => setCreateUserForm(prev => ({
                              ...prev,
                              permissions: { ...prev.permissions, can_manage_users: e.target.checked }
                            }))}
                            className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                          />
                          <span className="ml-3 text-sm text-gray-700">Can manage users</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    {createUserMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create User
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editUserForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Edit User</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditUserForm(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-name" className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      id="edit-name"
                      type="text"
                      required
                      value={editUserForm.name}
                      onChange={(e) => setEditUserForm(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      id="edit-email"
                      type="email"
                      required
                      value={editUserForm.email}
                      onChange={(e) => setEditUserForm(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all"
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    User Role *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditUserForm(prev => prev ? ({ ...prev, role: 'CUSTOMER' }) : null)}
                      className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                        editUserForm.role === 'CUSTOMER'
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditUserForm(prev => prev ? ({ ...prev, role: 'STAFF' }) : null)}
                      className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                        editUserForm.role === 'STAFF'
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Briefcase className="w-4 h-4 mr-2" />
                      Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditUserForm(prev => prev ? ({ ...prev, role: 'ADMIN' }) : null)}
                      className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                        editUserForm.role === 'ADMIN'
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Admin
                    </button>
                  </div>
                </div>

                {/* Status Toggle */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editUserForm.is_active}
                      onChange={(e) => setEditUserForm(prev => prev ? ({ ...prev, is_active: e.target.checked }) : null)}
                      className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                    />
                    <span className="ml-3 text-sm font-semibold text-gray-700">Account Active</span>
                  </label>
                  <p className="ml-8 mt-1 text-xs text-gray-500">
                    Inactive users cannot log in
                  </p>
                </div>

                {/* Staff/Admin Permissions */}
                {(editUserForm.role === 'STAFF' || editUserForm.role === 'ADMIN') && (
                  <div className="border-t border-gray-200 pt-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Permissions
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editUserForm.permissions?.can_view_all_jobs || false}
                          onChange={(e) => setEditUserForm(prev => prev ? ({
                            ...prev,
                            permissions: { ...prev.permissions, can_view_all_jobs: e.target.checked }
                          }) : null)}
                          className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                        />
                        <span className="ml-3 text-sm text-gray-700">Can view all jobs</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editUserForm.permissions?.can_edit_pricing || false}
                          onChange={(e) => setEditUserForm(prev => prev ? ({
                            ...prev,
                            permissions: { ...prev.permissions, can_edit_pricing: e.target.checked }
                          }) : null)}
                          className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                        />
                        <span className="ml-3 text-sm text-gray-700">Can edit pricing</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editUserForm.permissions?.can_manage_users || false}
                          onChange={(e) => setEditUserForm(prev => prev ? ({
                            ...prev,
                            permissions: { ...prev.permissions, can_manage_users: e.target.checked }
                          }) : null)}
                          className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2"
                        />
                        <span className="ml-3 text-sm text-gray-700">Can manage users</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditUserForm(null);
                    }}
                    className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    {updateUserMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmationUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                
                <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                  Delete User Account?
                </h2>
                
                <p className="text-gray-600 text-center mb-6">
                  Are you sure you want to delete <strong>{deleteConfirmationUser.name}</strong>? 
                  This will deactivate their account and they will no longer be able to log in.
                </p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={deleteConfirmChecked}
                      onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                      className="w-5 h-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400 focus:ring-2 mt-0.5"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      I understand this will deactivate the user account and cannot be easily undone
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmationUser(null);
                      setDeleteConfirmChecked(false);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={!deleteConfirmChecked || deleteUserMutation.isPending}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  >
                    {deleteUserMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete User
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ADMIN_UsersManager;