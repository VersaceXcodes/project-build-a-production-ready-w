import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Link, useSearchParams } from 'react-router-dom';

// ===========================
// TYPE DEFINITIONS
// ===========================

interface GalleryImage {
  id: string;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  description: string | null;
  alt_text: string | null;
  categories: string | null; // JSON string array
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Service {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

interface TierPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

interface UploadImagePayload {
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  description: string | null;
  alt_text: string | null;
  categories: string | null; // JSON string
}

interface UpdateImagePayload {
  title?: string;
  description?: string | null;
  categories?: string | null;
  is_active?: boolean;
}

interface CaseStudyPayload {
  slug: string;
  title: string;
  service_id: string;
  tier_id: string;
  gallery_image_id: string;
  description: string | null;
  client_testimonial: string | null;
  is_published: boolean;
}

// ===========================
// MAIN COMPONENT
// ===========================

const UV_ADMIN_GalleryManager: React.FC = () => {
  // ===========================
  // GLOBAL STATE (Zustand)
  // ===========================
  
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const showToast = useAppStore(state => state.show_toast);

  // ===========================
  // URL PARAMS
  // ===========================
  
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilterParam = searchParams.get('category');

  // ===========================
  // LOCAL STATE
  // ===========================
  
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(categoryFilterParam);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [caseStudyModalOpen, setCaseStudyModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    image_url: '',
    thumbnail_url: '',
    description: '',
    alt_text: '',
    categories: [] as string[],
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    categories: [] as string[],
    is_active: true,
  });

  // Case study form state
  const [caseStudyForm, setCaseStudyForm] = useState({
    slug: '',
    title: '',
    service_id: '',
    tier_id: '',
    description: '',
    client_testimonial: '',
    is_published: false,
  });

  // ===========================
  // REACT QUERY CLIENT
  // ===========================
  
  const queryClient = useQueryClient();

  // ===========================
  // API FUNCTIONS
  // ===========================

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const fetchGalleryImages = async (): Promise<GalleryImage[]> => {
    const params: any = {};
    if (selectedCategoryFilter) {
      params.categories = selectedCategoryFilter;
    }
    
    const response = await axios.get(`${API_BASE_URL}/api/admin/gallery-images`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params,
    });
    
    return response.data;
  };

  const fetchServiceCategories = async (): Promise<ServiceCategory[]> => {
    const response = await axios.get(`${API_BASE_URL}/api/public/service-categories`);
    return response.data;
  };

  const fetchServices = async (): Promise<Service[]> => {
    const response = await axios.get(`${API_BASE_URL}/api/admin/services`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  };

  const fetchTiers = async (): Promise<{ tier: TierPackage }[]> => {
    const response = await axios.get(`${API_BASE_URL}/api/public/tiers`);
    return response.data;
  };

  const uploadImageApi = async (payload: UploadImagePayload): Promise<void> => {
    await axios.post(
      `${API_BASE_URL}/api/admin/gallery-images`,
      payload,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  };

  const updateImageApi = async (params: { image_id: string; payload: UpdateImagePayload }): Promise<void> => {
    await axios.patch(
      `${API_BASE_URL}/api/admin/gallery-images/${params.image_id}`,
      params.payload,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  };

  const deleteImageApi = async (image_id: string): Promise<void> => {
    await axios.delete(
      `${API_BASE_URL}/api/admin/gallery-images/${image_id}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  };

  const createCaseStudyApi = async (payload: CaseStudyPayload): Promise<void> => {
    await axios.post(
      `${API_BASE_URL}/api/admin/case-studies`,
      payload,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  };

  // ===========================
  // REACT QUERY HOOKS
  // ===========================

  const { data: galleryImages = [], isLoading: isLoadingImages } = useQuery({
    queryKey: ['admin-gallery-images', selectedCategoryFilter],
    queryFn: fetchGalleryImages,
    enabled: !!authToken,
    staleTime: 60000,
  });

  const { data: serviceCategories = [] } = useQuery({
    queryKey: ['service-categories'],
    queryFn: fetchServiceCategories,
    staleTime: 300000, // 5 minutes
  });

  const { data: services = [] } = useQuery({
    queryKey: ['admin-services'],
    queryFn: fetchServices,
    enabled: !!authToken && caseStudyModalOpen,
    staleTime: 300000,
  });

  const { data: tiersData = [] } = useQuery({
    queryKey: ['tiers'],
    queryFn: fetchTiers,
    enabled: caseStudyModalOpen,
    staleTime: 300000,
  });

  const uploadImageMutation = useMutation({
    mutationFn: uploadImageApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery-images'] });
      showToast({
        type: 'success',
        message: 'Image uploaded successfully',
        duration: 5000,
      });
      setUploadModalOpen(false);
      setUploadForm({
        title: '',
        image_url: '',
        thumbnail_url: '',
        description: '',
        alt_text: '',
        categories: [],
      });
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to upload image',
        duration: 5000,
      });
    },
  });

  const updateImageMutation = useMutation({
    mutationFn: updateImageApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery-images'] });
      showToast({
        type: 'success',
        message: 'Image updated successfully',
        duration: 5000,
      });
      setEditModalOpen(false);
      setSelectedImage(null);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update image',
        duration: 5000,
      });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: deleteImageApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery-images'] });
      showToast({
        type: 'success',
        message: 'Image deleted successfully',
        duration: 5000,
      });
      setDeleteConfirmOpen(false);
      setSelectedImage(null);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to delete image',
        duration: 5000,
      });
    },
  });

  const createCaseStudyMutation = useMutation({
    mutationFn: createCaseStudyApi,
    onSuccess: () => {
      showToast({
        type: 'success',
        message: 'Case study created successfully',
        duration: 5000,
      });
      setCaseStudyModalOpen(false);
      setCaseStudyForm({
        slug: '',
        title: '',
        service_id: '',
        tier_id: '',
        description: '',
        client_testimonial: '',
        is_published: false,
      });
      setSelectedImage(null);
    },
    onError: (error: any) => {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to create case study',
        duration: 5000,
      });
    },
  });

  // ===========================
  // HANDLERS
  // ===========================

  const handleFilterChange = (category: string | null) => {
    setSelectedCategoryFilter(category);
    if (category) {
      setSearchParams({ category });
    } else {
      setSearchParams({});
    }
  };

  const handleOpenUploadModal = () => {
    setUploadForm({
      title: '',
      image_url: '',
      thumbnail_url: '',
      description: '',
      alt_text: '',
      categories: [],
    });
    setUploadModalOpen(true);
  };

  const handleOpenEditModal = (image: GalleryImage) => {
    setSelectedImage(image);
    let parsedCategories: string[] = [];
    if (image.categories) {
      try {
        const parsed = JSON.parse(image.categories);
        parsedCategories = Array.isArray(parsed) ? parsed : [];
      } catch {
        parsedCategories = [];
      }
    }
    setEditForm({
      title: image.title,
      description: image.description || '',
      categories: parsedCategories,
      is_active: image.is_active,
    });
    setEditModalOpen(true);
  };

  const handleOpenCaseStudyModal = (image: GalleryImage) => {
    setSelectedImage(image);
    setCaseStudyForm({
      slug: '',
      title: '',
      service_id: '',
      tier_id: '',
      description: '',
      client_testimonial: '',
      is_published: false,
    });
    setCaseStudyModalOpen(true);
  };

  const handleOpenDeleteConfirm = (image: GalleryImage) => {
    setSelectedImage(image);
    setDeleteConfirmOpen(true);
  };

  const handleToggleStatus = async (image: GalleryImage) => {
    await updateImageMutation.mutateAsync({
      image_id: image.id,
      payload: { is_active: !image.is_active },
    });
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: UploadImagePayload = {
      title: uploadForm.title,
      image_url: uploadForm.image_url,
      thumbnail_url: uploadForm.thumbnail_url || null,
      description: uploadForm.description || null,
      alt_text: uploadForm.alt_text || null,
      categories: JSON.stringify(uploadForm.categories),
    };

    uploadImageMutation.mutate(payload);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedImage) return;

    const payload: UpdateImagePayload = {
      title: editForm.title,
      description: editForm.description || null,
      categories: JSON.stringify(editForm.categories),
      is_active: editForm.is_active,
    };

    updateImageMutation.mutate({
      image_id: selectedImage.id,
      payload,
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedImage) return;
    deleteImageMutation.mutate(selectedImage.id);
  };

  const handleCaseStudySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedImage) return;

    const payload: CaseStudyPayload = {
      slug: caseStudyForm.slug,
      title: caseStudyForm.title,
      service_id: caseStudyForm.service_id,
      tier_id: caseStudyForm.tier_id,
      gallery_image_id: selectedImage.id,
      description: caseStudyForm.description || null,
      client_testimonial: caseStudyForm.client_testimonial || null,
      is_published: caseStudyForm.is_published,
    };

    createCaseStudyMutation.mutate(payload);
  };

  const handleCategoryToggle = (categorySlug: string) => {
    const currentCategories = [...uploadForm.categories];
    const index = currentCategories.indexOf(categorySlug);
    
    if (index > -1) {
      currentCategories.splice(index, 1);
    } else {
      currentCategories.push(categorySlug);
    }
    
    setUploadForm(prev => ({ ...prev, categories: currentCategories }));
  };

  const handleEditCategoryToggle = (categorySlug: string) => {
    const currentCategories = [...editForm.categories];
    const index = currentCategories.indexOf(categorySlug);
    
    if (index > -1) {
      currentCategories.splice(index, 1);
    } else {
      currentCategories.push(categorySlug);
    }
    
    setEditForm(prev => ({ ...prev, categories: currentCategories }));
  };

  // ===========================
  // HELPERS
  // ===========================

  const parseCategories = (categoriesJson: string | null): string[] => {
    if (!categoriesJson) return [];
    try {
      const parsed = JSON.parse(categoriesJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getCategoryNames = (categorySlugs: string[]): string => {
    return categorySlugs
      .map(slug => serviceCategories.find(cat => cat.slug === slug)?.name || slug)
      .join(', ');
  };

  // ===========================
  // RENDER
  // ===========================

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <nav className="text-sm text-gray-500 mb-2">
                  <Link to="/admin" className="hover:text-gray-700">Admin</Link>
                  <span className="mx-2">/</span>
                  <Link to="/admin/content" className="hover:text-gray-700">Content</Link>
                  <span className="mx-2">/</span>
                  <span className="text-gray-900 font-medium">Gallery</span>
                </nav>
                <h1 className="text-3xl font-bold text-gray-900">Portfolio Gallery Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage gallery images, categorization, and case studies
                </p>
              </div>
              <div className="mt-4 sm:mt-0">
                <button
                  onClick={handleOpenUploadModal}
                  className="inline-flex items-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload New Image
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filter by category:</span>
              
              <button
                onClick={() => handleFilterChange(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategoryFilter === null
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>

              {serviceCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleFilterChange(category.slug)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCategoryFilter === category.slug
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          {isLoadingImages ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center">
                <svg className="animate-spin h-12 w-12 text-yellow-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-gray-600">Loading gallery images...</p>
              </div>
            </div>
          ) : galleryImages.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No images found</h3>
              <p className="mt-2 text-sm text-gray-600">
                {selectedCategoryFilter 
                  ? 'No images in this category. Try a different filter or upload new images.'
                  : 'Get started by uploading your first gallery image.'}
              </p>
              <button
                onClick={handleOpenUploadModal}
                className="mt-6 inline-flex items-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-all"
              >
                Upload First Image
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {galleryImages.map((image) => {
                const imageCategorySlugs = parseCategories(image.categories);
                
                return (
                  <div
                    key={image.id}
                    className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-200"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-gray-100">
                      <img
                        src={image.thumbnail_url || image.image_url}
                        alt={image.alt_text || image.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* Status Badge */}
                      <div className="absolute top-2 right-2">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          image.is_active
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-400 text-white'
                        }`}>
                          {image.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
                        {image.title}
                      </h3>
                      
                      {image.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {image.description}
                        </p>
                      )}

                      {imageCategorySlugs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {imageCategorySlugs.slice(0, 2).map((slug) => (
                            <span
                              key={slug}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                            >
                              {serviceCategories.find(cat => cat.slug === slug)?.name || slug}
                            </span>
                          ))}
                          {imageCategorySlugs.length > 2 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                              +{imageCategorySlugs.length - 2} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenEditModal(image)}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          Edit
                        </button>
                        
                        <button
                          onClick={() => handleToggleStatus(image)}
                          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                            image.is_active
                              ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {image.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        
                        <button
                          onClick={() => handleOpenCaseStudyModal(image)}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          Create Case Study
                        </button>
                        
                        <button
                          onClick={() => handleOpenDeleteConfirm(image)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-black bg-opacity-60 transition-opacity" onClick={() => setUploadModalOpen(false)}></div>

              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <form onSubmit={handleUploadSubmit}>
                  <div className="bg-white px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Upload New Image</h3>
                      <button
                        type="button"
                        onClick={() => setUploadModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="upload-title" className="block text-sm font-medium text-gray-700 mb-1">
                          Title <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="upload-title"
                          type="text"
                          required
                          value={uploadForm.title}
                          onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="E.g., Premium Business Cards with Spot UV"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      <div>
                        <label htmlFor="upload-image-url" className="block text-sm font-medium text-gray-700 mb-1">
                          Image URL <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="upload-image-url"
                          type="url"
                          required
                          value={uploadForm.image_url}
                          onChange={(e) => setUploadForm(prev => ({ ...prev, image_url: e.target.value }))}
                          placeholder="https://images.unsplash.com/..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                        <p className="mt-1 text-xs text-gray-500">Full URL to the image file (PNG/JPEG/WebP)</p>
                      </div>

                      <div>
                        <label htmlFor="upload-thumbnail-url" className="block text-sm font-medium text-gray-700 mb-1">
                          Thumbnail URL (Optional)
                        </label>
                        <input
                          id="upload-thumbnail-url"
                          type="url"
                          value={uploadForm.thumbnail_url}
                          onChange={(e) => setUploadForm(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                          placeholder="https://images.unsplash.com/...?w=400"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                        <p className="mt-1 text-xs text-gray-500">Optional optimized thumbnail (will use main image if blank)</p>
                      </div>

                      <div>
                        <label htmlFor="upload-alt-text" className="block text-sm font-medium text-gray-700 mb-1">
                          Alt Text (SEO) <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="upload-alt-text"
                          type="text"
                          required
                          value={uploadForm.alt_text}
                          onChange={(e) => setUploadForm(prev => ({ ...prev, alt_text: e.target.value }))}
                          placeholder="Descriptive alt text for accessibility and SEO"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      <div>
                        <label htmlFor="upload-description" className="block text-sm font-medium text-gray-700 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          id="upload-description"
                          rows={3}
                          value={uploadForm.description}
                          onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief description of the project..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-vertical"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Categories (Select multiple)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {serviceCategories.map((category) => (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => handleCategoryToggle(category.slug)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                uploadForm.categories.includes(category.slug)
                                  ? 'bg-yellow-400 text-black'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {uploadForm.categories.includes(category.slug) && (
                                <svg className="inline h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {category.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setUploadModalOpen(false)}
                      className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploadImageMutation.isPending}
                      className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadImageMutation.isPending ? 'Uploading...' : 'Upload Image'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editModalOpen && selectedImage && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-black bg-opacity-60 transition-opacity" onClick={() => setEditModalOpen(false)}></div>

              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <form onSubmit={handleEditSubmit}>
                  <div className="bg-white px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Edit Image</h3>
                      <button
                        type="button"
                        onClick={() => setEditModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">
                          Title <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="edit-title"
                          type="text"
                          required
                          value={editForm.title}
                          onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      <div>
                        <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          id="edit-description"
                          rows={3}
                          value={editForm.description}
                          onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-vertical"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Categories
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {serviceCategories.map((category) => (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => handleEditCategoryToggle(category.slug)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                editForm.categories.includes(category.slug)
                                  ? 'bg-yellow-400 text-black'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {editForm.categories.includes(category.slug) && (
                                <svg className="inline h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {category.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center">
                        <input
                          id="edit-is-active"
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
                          className="h-5 w-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400"
                        />
                        <label htmlFor="edit-is-active" className="ml-3 text-sm font-medium text-gray-700">
                          Active (visible in public gallery)
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateImageMutation.isPending}
                      className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updateImageMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Case Study Modal */}
        {caseStudyModalOpen && selectedImage && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-black bg-opacity-60 transition-opacity" onClick={() => setCaseStudyModalOpen(false)}></div>

              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                <form onSubmit={handleCaseStudySubmit}>
                  <div className="bg-white px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Create Case Study</h3>
                      <button
                        type="button"
                        onClick={() => setCaseStudyModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Selected Image:</strong> {selectedImage.title}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="cs-title" className="block text-sm font-medium text-gray-700 mb-1">
                            Case Study Title <span className="text-red-600">*</span>
                          </label>
                          <input
                            id="cs-title"
                            type="text"
                            required
                            value={caseStudyForm.title}
                            onChange={(e) => setCaseStudyForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="E.g., Corporate Rebranding Package"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          />
                        </div>

                        <div>
                          <label htmlFor="cs-slug" className="block text-sm font-medium text-gray-700 mb-1">
                            URL Slug <span className="text-red-600">*</span>
                          </label>
                          <input
                            id="cs-slug"
                            type="text"
                            required
                            value={caseStudyForm.slug}
                            onChange={(e) => setCaseStudyForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                            placeholder="corporate-rebranding-package"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          />
                          <p className="mt-1 text-xs text-gray-500">URL-friendly identifier (lowercase, hyphens only)</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="cs-service" className="block text-sm font-medium text-gray-700 mb-1">
                            Service Used <span className="text-red-600">*</span>
                          </label>
                          <select
                            id="cs-service"
                            required
                            value={caseStudyForm.service_id}
                            onChange={(e) => setCaseStudyForm(prev => ({ ...prev, service_id: e.target.value }))}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          >
                            <option value="">Select service...</option>
                            {services.map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="cs-tier" className="block text-sm font-medium text-gray-700 mb-1">
                            Tier Delivered <span className="text-red-600">*</span>
                          </label>
                          <select
                            id="cs-tier"
                            required
                            value={caseStudyForm.tier_id}
                            onChange={(e) => setCaseStudyForm(prev => ({ ...prev, tier_id: e.target.value }))}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                          >
                            <option value="">Select tier...</option>
                            {tiersData.map((tierData) => (
                              <option key={tierData.tier.id} value={tierData.tier.id}>
                                {tierData.tier.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="cs-description" className="block text-sm font-medium text-gray-700 mb-1">
                          Project Description
                        </label>
                        <textarea
                          id="cs-description"
                          rows={4}
                          value={caseStudyForm.description}
                          onChange={(e) => setCaseStudyForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Detailed description of the project, challenges, and outcomes..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-vertical"
                        />
                      </div>

                      <div>
                        <label htmlFor="cs-testimonial" className="block text-sm font-medium text-gray-700 mb-1">
                          Client Testimonial (Optional)
                        </label>
                        <textarea
                          id="cs-testimonial"
                          rows={3}
                          value={caseStudyForm.client_testimonial}
                          onChange={(e) => setCaseStudyForm(prev => ({ ...prev, client_testimonial: e.target.value }))}
                          placeholder="Client feedback or testimonial..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-vertical"
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          id="cs-published"
                          type="checkbox"
                          checked={caseStudyForm.is_published}
                          onChange={(e) => setCaseStudyForm(prev => ({ ...prev, is_published: e.target.checked }))}
                          className="h-5 w-5 text-yellow-400 border-gray-300 rounded focus:ring-yellow-400"
                        />
                        <label htmlFor="cs-published" className="ml-3 text-sm font-medium text-gray-700">
                          Publish immediately (make visible on public site)
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setCaseStudyModalOpen(false)}
                      className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createCaseStudyMutation.isPending}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createCaseStudyMutation.isPending ? 'Creating...' : 'Create Case Study'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmOpen && selectedImage && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-black bg-opacity-60 transition-opacity" onClick={() => setDeleteConfirmOpen(false)}></div>

              <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
                <div className="bg-white px-6 py-6">
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0">
                      <svg className="h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Gallery Image</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Are you sure you want to delete <strong>{selectedImage.title}</strong>?
                      </p>
                      <p className="text-sm text-red-600 font-medium">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={deleteImageMutation.isPending}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteImageMutation.isPending ? 'Deleting...' : 'Delete Image'}
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

export default UV_ADMIN_GalleryManager;