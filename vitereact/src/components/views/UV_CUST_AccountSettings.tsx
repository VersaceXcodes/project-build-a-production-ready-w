import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/main';
import { User, Mail, Phone, Building, Lock, Save, AlertCircle, Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

const UV_CUST_AccountSettings: React.FC = () => {
  const current_user = useAppStore(state => state.authentication_state.current_user);
  const user_profile = useAppStore(state => state.authentication_state.user_profile);
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const update_user_profile = useAppStore(state => state.update_user_profile);
  const show_toast = useAppStore(state => state.show_toast);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    address: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [form_errors, set_form_errors] = useState<{
    profile: Record<string, string>;
    password: Record<string, string>;
  }>({
    profile: {},
    password: {}
  });

  useEffect(() => {
    if (current_user && user_profile) {
      setProfileForm({
        name: current_user.name,
        email: current_user.email,
        phone: 'phone' in user_profile && user_profile.phone ? user_profile.phone : '',
        company_name: 'company_name' in user_profile && user_profile.company_name ? user_profile.company_name : '',
        address: 'address' in user_profile && user_profile.address ? user_profile.address : ''
      });
    }
  }, [current_user, user_profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const response = await axios.patch(
        `${API_BASE_URL}/api/auth/profile`,
        data,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      update_user_profile(data.profile);
      show_toast({
        type: 'success',
        message: 'Profile updated successfully',
        duration: 3000
      });
      set_form_errors(prev => ({ ...prev, profile: {} }));
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update profile',
        duration: 5000
      });
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordForm) => {
      await axios.post(
        `${API_BASE_URL}/api/auth/change-password`,
        {
          current_password: data.current_password,
          new_password: data.new_password
        },
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
    },
    onSuccess: () => {
      show_toast({
        type: 'success',
        message: 'Password changed successfully',
        duration: 3000
      });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      set_form_errors(prev => ({ ...prev, password: {} }));
    },
    onError: (error: any) => {
      show_toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to change password',
        duration: 5000
      });
    }
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const errors: Record<string, string> = {};
    if (!profileForm.name) errors.name = 'Name is required';
    if (!profileForm.email) errors.email = 'Email is required';
    
    if (Object.keys(errors).length > 0) {
      set_form_errors(prev => ({ ...prev, profile: errors }));
      return;
    }

    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: Record<string, string> = {};
    if (!passwordForm.current_password) errors.current_password = 'Current password is required';
    if (!passwordForm.new_password) errors.new_password = 'New password is required';
    if (passwordForm.new_password.length < 8) errors.new_password = 'Password must be at least 8 characters';
    if (passwordForm.new_password !== passwordForm.confirm_password) errors.confirm_password = 'Passwords do not match';
    
    if (Object.keys(errors).length > 0) {
      set_form_errors(prev => ({ ...prev, password: errors }));
      return;
    }

    changePasswordMutation.mutate(passwordForm);
  };

  if (!current_user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Account Settings</h1>

        <div className="grid grid-cols-1 gap-8">
          {/* Profile Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Profile Information
              </h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {form_errors.profile.name && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.profile.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {form_errors.profile.email && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.profile.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={profileForm.company_name}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, company_name: e.target.value }))}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    rows={3}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? (
                      <span className="flex items-center">
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Password Change */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Change Password
              </h2>
            </div>
            <div className="p-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form_errors.password.current_password && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.password.current_password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form_errors.password.new_password && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.password.new_password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form_errors.password.confirm_password && (
                      <p className="mt-1 text-sm text-red-600">{form_errors.password.confirm_password}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {changePasswordMutation.isPending ? (
                      <span className="flex items-center">
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-gray-700 border-t-transparent rounded-full"></div>
                        Updating...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        Update Password
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UV_CUST_AccountSettings;
