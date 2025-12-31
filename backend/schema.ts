import { z } from 'zod';

// =====================================================
// USERS SCHEMAS
// =====================================================

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  password_hash: z.string(),
  role: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createUserInputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).default('CUSTOMER'),
  is_active: z.boolean().default(true)
});

export const updateUserInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(),
  is_active: z.boolean().optional()
});

export const searchUserInputSchema = z.object({
  query: z.string().optional(),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'email', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;

// =====================================================
// CUSTOMER PROFILES SCHEMAS
// =====================================================

export const customerProfileSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  phone: z.string().nullable(),
  company_name: z.string().nullable(),
  address: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createCustomerProfileInputSchema = z.object({
  user_id: z.string(),
  phone: z.string().nullable(),
  company_name: z.string().max(255).nullable(),
  address: z.string().nullable()
});

export const updateCustomerProfileInputSchema = z.object({
  id: z.string(),
  phone: z.string().nullable().optional(),
  company_name: z.string().max(255).nullable().optional(),
  address: z.string().nullable().optional()
});

export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type CreateCustomerProfileInput = z.infer<typeof createCustomerProfileInputSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileInputSchema>;

// =====================================================
// STAFF PROFILES SCHEMAS
// =====================================================

export const staffProfileSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  department: z.string().nullable(),
  permissions: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createStaffProfileInputSchema = z.object({
  user_id: z.string(),
  department: z.string().max(255).nullable(),
  permissions: z.string().default('{}')
});

export const updateStaffProfileInputSchema = z.object({
  id: z.string(),
  department: z.string().max(255).nullable().optional(),
  permissions: z.string().optional()
});

export type StaffProfile = z.infer<typeof staffProfileSchema>;
export type CreateStaffProfileInput = z.infer<typeof createStaffProfileInputSchema>;
export type UpdateStaffProfileInput = z.infer<typeof updateStaffProfileInputSchema>;

// =====================================================
// SERVICE CATEGORIES SCHEMAS
// =====================================================

export const serviceCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  sort_order: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createServiceCategoryInputSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  sort_order: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true)
});

export const updateServiceCategoryInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  sort_order: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional()
});

export const searchServiceCategoryInputSchema = z.object({
  query: z.string().optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'sort_order', 'created_at']).default('sort_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type ServiceCategory = z.infer<typeof serviceCategorySchema>;
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategoryInputSchema>;
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategoryInputSchema>;
export type SearchServiceCategoryInput = z.infer<typeof searchServiceCategoryInputSchema>;

// =====================================================
// SERVICES SCHEMAS
// =====================================================

export const serviceSchema = z.object({
  id: z.string(),
  category_id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  requires_booking: z.boolean(),
  requires_proof: z.boolean(),
  is_top_seller: z.boolean(),
  is_active: z.boolean(),
  slot_duration_hours: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createServiceInputSchema = z.object({
  category_id: z.string(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().nullable(),
  requires_booking: z.boolean().default(false),
  requires_proof: z.boolean().default(false),
  is_top_seller: z.boolean().default(false),
  is_active: z.boolean().default(true),
  slot_duration_hours: z.number().positive().default(2)
});

export const updateServiceInputSchema = z.object({
  id: z.string(),
  category_id: z.string().optional(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().nullable().optional(),
  requires_booking: z.boolean().optional(),
  requires_proof: z.boolean().optional(),
  is_top_seller: z.boolean().optional(),
  is_active: z.boolean().optional(),
  slot_duration_hours: z.number().positive().optional()
});

export const searchServiceInputSchema = z.object({
  query: z.string().optional(),
  category_id: z.string().optional(),
  requires_booking: z.boolean().optional(),
  is_top_seller: z.boolean().optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'created_at']).default('name'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type Service = z.infer<typeof serviceSchema>;
export type CreateServiceInput = z.infer<typeof createServiceInputSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceInputSchema>;
export type SearchServiceInput = z.infer<typeof searchServiceInputSchema>;

// =====================================================
// SERVICE OPTIONS SCHEMAS
// =====================================================

export const serviceOptionSchema = z.object({
  id: z.string(),
  service_id: z.string(),
  key: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean(),
  choices: z.string().nullable(),
  pricing_impact: z.string().nullable(),
  help_text: z.string().nullable(),
  sort_order: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createServiceOptionInputSchema = z.object({
  service_id: z.string(),
  key: z.string().min(1).max(100).regex(/^[a-z_]+$/),
  label: z.string().min(1).max(255),
  type: z.enum(['TEXT', 'SELECT', 'CHECKBOX', 'NUMBER']).default('TEXT'),
  required: z.boolean().default(false),
  choices: z.string().nullable(),
  pricing_impact: z.string().nullable(),
  help_text: z.string().nullable(),
  sort_order: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true)
});

export const updateServiceOptionInputSchema = z.object({
  id: z.string(),
  service_id: z.string().optional(),
  key: z.string().min(1).max(100).regex(/^[a-z_]+$/).optional(),
  label: z.string().min(1).max(255).optional(),
  type: z.enum(['TEXT', 'SELECT', 'CHECKBOX', 'NUMBER']).optional(),
  required: z.boolean().optional(),
  choices: z.string().nullable().optional(),
  pricing_impact: z.string().nullable().optional(),
  help_text: z.string().nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional()
});

export type ServiceOption = z.infer<typeof serviceOptionSchema>;
export type CreateServiceOptionInput = z.infer<typeof createServiceOptionInputSchema>;
export type UpdateServiceOptionInput = z.infer<typeof updateServiceOptionInputSchema>;

// =====================================================
// TIER PACKAGES SCHEMAS
// =====================================================

export const tierPackageSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  sort_order: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createTierPackageInputSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().nullable(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().nonnegative().default(0)
});

export const updateTierPackageInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional()
});

export const searchTierPackageInputSchema = z.object({
  query: z.string().optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'sort_order']).default('sort_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type TierPackage = z.infer<typeof tierPackageSchema>;
export type CreateTierPackageInput = z.infer<typeof createTierPackageInputSchema>;
export type UpdateTierPackageInput = z.infer<typeof updateTierPackageInputSchema>;
export type SearchTierPackageInput = z.infer<typeof searchTierPackageInputSchema>;

// =====================================================
// TIER FEATURES SCHEMAS
// =====================================================

export const tierFeatureSchema = z.object({
  id: z.string(),
  tier_id: z.string(),
  group_name: z.string(),
  feature_key: z.string(),
  feature_label: z.string(),
  feature_value: z.string().nullable(),
  is_included: z.boolean(),
  sort_order: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createTierFeatureInputSchema = z.object({
  tier_id: z.string(),
  group_name: z.string().min(1).max(255),
  feature_key: z.string().min(1).max(100).regex(/^[a-z_]+$/),
  feature_label: z.string().min(1).max(255),
  feature_value: z.string().nullable(),
  is_included: z.boolean().default(true),
  sort_order: z.number().int().nonnegative().default(0)
});

export const updateTierFeatureInputSchema = z.object({
  id: z.string(),
  tier_id: z.string().optional(),
  group_name: z.string().min(1).max(255).optional(),
  feature_key: z.string().min(1).max(100).regex(/^[a-z_]+$/).optional(),
  feature_label: z.string().min(1).max(255).optional(),
  feature_value: z.string().nullable().optional(),
  is_included: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional()
});

export type TierFeature = z.infer<typeof tierFeatureSchema>;
export type CreateTierFeatureInput = z.infer<typeof createTierFeatureInputSchema>;
export type UpdateTierFeatureInput = z.infer<typeof updateTierFeatureInputSchema>;

// =====================================================
// QUOTES SCHEMAS
// =====================================================

export const quoteSchema = z.object({
  id: z.string(),
  customer_id: z.string().nullable(),
  service_id: z.string(),
  tier_id: z.string(),
  status: z.string(),
  estimate_subtotal: z.number().nullable(),
  final_subtotal: z.number().nullable(),
  notes: z.string().nullable(),
  is_guest: z.boolean(),
  guest_name: z.string().nullable(),
  guest_email: z.string().nullable(),
  guest_phone: z.string().nullable(),
  guest_company_name: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createQuoteInputSchema = z.object({
  customer_id: z.string().optional(),
  service_id: z.string(),
  tier_id: z.string(),
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED']).default('SUBMITTED'),
  estimate_subtotal: z.number().nonnegative().nullable(),
  notes: z.string().nullable(),
  is_guest: z.boolean().default(false),
  guest_name: z.string().optional(),
  guest_email: z.string().email().optional(),
  guest_phone: z.string().optional(),
  guest_company_name: z.string().optional()
});

export const updateQuoteInputSchema = z.object({
  id: z.string(),
  service_id: z.string().optional(),
  tier_id: z.string().optional(),
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  estimate_subtotal: z.number().nonnegative().nullable().optional(),
  final_subtotal: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional()
});

export const searchQuoteInputSchema = z.object({
  customer_id: z.string().optional(),
  service_id: z.string().optional(),
  tier_id: z.string().optional(),
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'updated_at', 'final_subtotal']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Quote = z.infer<typeof quoteSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteInputSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteInputSchema>;
export type SearchQuoteInput = z.infer<typeof searchQuoteInputSchema>;

// =====================================================
// QUOTE ANSWERS SCHEMAS
// =====================================================

export const quoteAnswerSchema = z.object({
  id: z.string(),
  quote_id: z.string(),
  option_key: z.string(),
  value: z.string(),
  created_at: z.coerce.date()
});

export const createQuoteAnswerInputSchema = z.object({
  quote_id: z.string(),
  option_key: z.string().min(1).max(100),
  value: z.string().min(1)
});

export type QuoteAnswer = z.infer<typeof quoteAnswerSchema>;
export type CreateQuoteAnswerInput = z.infer<typeof createQuoteAnswerInputSchema>;

// =====================================================
// ORDERS SCHEMAS
// =====================================================

export const orderSchema = z.object({
  id: z.string(),
  quote_id: z.string().nullable(),
  customer_id: z.string().nullable(),
  tier_id: z.string().nullable(),
  order_type: z.string().default('SERVICE'),
  status: z.string(),
  due_at: z.string().nullable(),
  total_subtotal: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  deposit_pct: z.number(),
  deposit_amount: z.number(),
  revision_count: z.number(),
  assigned_staff_id: z.string().nullable(),
  location_id: z.string().nullable(),
  guest_name: z.string().nullable(),
  guest_email: z.string().nullable(),
  guest_phone: z.string().nullable(),
  guest_address: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createOrderInputSchema = z.object({
  quote_id: z.string().nullable().optional(),
  customer_id: z.string().nullable().optional(),
  tier_id: z.string().nullable().optional(),
  order_type: z.enum(['SERVICE', 'PRODUCT']).default('SERVICE'),
  status: z.enum(['QUOTE_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'PAID', 'PENDING_PAYMENT']).default('QUOTE_REQUESTED'),
  due_at: z.string().nullable(),
  total_subtotal: z.number().nonnegative().default(0),
  tax_amount: z.number().nonnegative().default(0),
  total_amount: z.number().nonnegative().default(0),
  deposit_pct: z.number().min(0).max(100).default(50),
  deposit_amount: z.number().nonnegative().default(0),
  assigned_staff_id: z.string().nullable(),
  location_id: z.string().nullable(),
  guest_name: z.string().nullable().optional(),
  guest_email: z.string().email().nullable().optional(),
  guest_phone: z.string().nullable().optional(),
  guest_address: z.string().nullable().optional()
});

export const updateOrderInputSchema = z.object({
  id: z.string(),
  status: z.enum(['QUOTE_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED']).optional(),
  due_at: z.string().nullable().optional(),
  total_subtotal: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  total_amount: z.number().nonnegative().optional(),
  deposit_pct: z.number().min(0).max(100).optional(),
  deposit_amount: z.number().nonnegative().optional(),
  revision_count: z.number().int().nonnegative().optional(),
  assigned_staff_id: z.string().nullable().optional(),
  location_id: z.string().nullable().optional()
});

export const searchOrderInputSchema = z.object({
  customer_id: z.string().optional(),
  tier_id: z.string().optional(),
  status: z.enum(['QUOTE_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED']).optional(),
  assigned_staff_id: z.string().optional(),
  location_id: z.string().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'due_at', 'total_amount']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Order = z.infer<typeof orderSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;
export type SearchOrderInput = z.infer<typeof searchOrderInputSchema>;

// =====================================================
// UPLOADS SCHEMAS
// =====================================================

export const uploadSchema = z.object({
  id: z.string(),
  owner_user_id: z.string(),
  quote_id: z.string().nullable(),
  order_id: z.string().nullable(),
  file_url: z.string(),
  file_type: z.string(),
  file_name: z.string(),
  file_size_bytes: z.number(),
  dpi_warning: z.boolean(),
  created_at: z.coerce.date()
});

export const createUploadInputSchema = z.object({
  owner_user_id: z.string(),
  quote_id: z.string().nullable(),
  order_id: z.string().nullable(),
  file_url: z.string().url(),
  file_type: z.string().min(1),
  file_name: z.string().min(1).max(255),
  file_size_bytes: z.number().int().nonnegative().default(0),
  dpi_warning: z.boolean().default(false)
});

export const searchUploadInputSchema = z.object({
  owner_user_id: z.string().optional(),
  quote_id: z.string().optional(),
  order_id: z.string().optional(),
  file_type: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'file_name']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Upload = z.infer<typeof uploadSchema>;
export type CreateUploadInput = z.infer<typeof createUploadInputSchema>;
export type SearchUploadInput = z.infer<typeof searchUploadInputSchema>;

// =====================================================
// BOOKINGS SCHEMAS
// =====================================================

export const bookingSchema = z.object({
  id: z.string(),
  quote_id: z.string(),
  customer_id: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  status: z.string(),
  is_emergency: z.boolean(),
  urgent_fee_pct: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createBookingInputSchema = z.object({
  quote_id: z.string(),
  customer_id: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).default('PENDING'),
  is_emergency: z.boolean().default(false),
  urgent_fee_pct: z.number().min(0).max(100).default(0)
});

export const updateBookingInputSchema = z.object({
  id: z.string(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
  is_emergency: z.boolean().optional(),
  urgent_fee_pct: z.number().min(0).max(100).optional()
});

export const searchBookingInputSchema = z.object({
  customer_id: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
  is_emergency: z.boolean().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['start_at', 'created_at']).default('start_at'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type Booking = z.infer<typeof bookingSchema>;
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;
export type SearchBookingInput = z.infer<typeof searchBookingInputSchema>;

// =====================================================
// PROOF VERSIONS SCHEMAS
// =====================================================

export const proofVersionSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  version_number: z.number(),
  file_url: z.string(),
  created_by_staff_id: z.string(),
  status: z.string(),
  customer_comment: z.string().nullable(),
  internal_notes: z.string().nullable(),
  approved_at: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createProofVersionInputSchema = z.object({
  order_id: z.string(),
  version_number: z.number().int().positive().default(1),
  file_url: z.string().url(),
  created_by_staff_id: z.string(),
  status: z.enum(['SENT', 'APPROVED', 'REVISION_REQUESTED']).default('SENT'),
  internal_notes: z.string().nullable()
});

export const updateProofVersionInputSchema = z.object({
  id: z.string(),
  status: z.enum(['SENT', 'APPROVED', 'REVISION_REQUESTED']).optional(),
  customer_comment: z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  approved_at: z.string().nullable().optional()
});

export type ProofVersion = z.infer<typeof proofVersionSchema>;
export type CreateProofVersionInput = z.infer<typeof createProofVersionInputSchema>;
export type UpdateProofVersionInput = z.infer<typeof updateProofVersionInputSchema>;

// =====================================================
// INVOICES SCHEMAS
// =====================================================

export const invoiceSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  invoice_number: z.string(),
  amount_due: z.number(),
  issued_at: z.string(),
  paid_at: z.string().nullable()
});

export const createInvoiceInputSchema = z.object({
  order_id: z.string(),
  invoice_number: z.string().min(1).max(100),
  amount_due: z.number().nonnegative().default(0),
  issued_at: z.string()
});

export const updateInvoiceInputSchema = z.object({
  id: z.string(),
  amount_due: z.number().nonnegative().optional(),
  paid_at: z.string().nullable().optional()
});

export const searchInvoiceInputSchema = z.object({
  order_id: z.string().optional(),
  invoice_number: z.string().optional(),
  paid: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['issued_at', 'amount_due']).default('issued_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Invoice = z.infer<typeof invoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceInputSchema>;
export type SearchInvoiceInput = z.infer<typeof searchInvoiceInputSchema>;

// =====================================================
// PAYMENTS SCHEMAS
// =====================================================

export const paymentSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number(),
  method: z.string(),
  status: z.string(),
  transaction_ref: z.string().nullable(),
  recorded_by_admin_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createPaymentInputSchema = z.object({
  order_id: z.string(),
  amount: z.number().positive(),
  method: z.enum(['STRIPE', 'CHECK', 'WIRE', 'CASH']).default('STRIPE'),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).default('PENDING'),
  transaction_ref: z.string().nullable(),
  recorded_by_admin_id: z.string().nullable()
});

export const updatePaymentInputSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  transaction_ref: z.string().nullable().optional()
});

export const searchPaymentInputSchema = z.object({
  order_id: z.string().optional(),
  method: z.enum(['STRIPE', 'CHECK', 'WIRE', 'CASH']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'amount']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Payment = z.infer<typeof paymentSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentInputSchema>;
export type SearchPaymentInput = z.infer<typeof searchPaymentInputSchema>;

// =====================================================
// MESSAGE THREADS SCHEMAS
// =====================================================

export const messageThreadSchema = z.object({
  id: z.string(),
  quote_id: z.string().nullable(),
  order_id: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createMessageThreadInputSchema = z.object({
  quote_id: z.string().nullable(),
  order_id: z.string().nullable()
});

export type MessageThread = z.infer<typeof messageThreadSchema>;
export type CreateMessageThreadInput = z.infer<typeof createMessageThreadInputSchema>;

// =====================================================
// MESSAGES SCHEMAS
// =====================================================

export const messageSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  sender_user_id: z.string(),
  body: z.string(),
  is_read: z.boolean(),
  created_at: z.coerce.date()
});

export const createMessageInputSchema = z.object({
  thread_id: z.string(),
  sender_user_id: z.string(),
  body: z.string().min(1),
  is_read: z.boolean().default(false)
});

export const updateMessageInputSchema = z.object({
  id: z.string(),
  is_read: z.boolean()
});

export type Message = z.infer<typeof messageSchema>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>;

// =====================================================
// SETTINGS SCHEMAS
// =====================================================

export const settingSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  updated_at: z.coerce.date()
});

export const createSettingInputSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string()
});

export const updateSettingInputSchema = z.object({
  id: z.string(),
  value: z.string()
});

export type Setting = z.infer<typeof settingSchema>;
export type CreateSettingInput = z.infer<typeof createSettingInputSchema>;
export type UpdateSettingInput = z.infer<typeof updateSettingInputSchema>;

// =====================================================
// AUDIT LOGS SCHEMAS
// =====================================================

export const auditLogSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  action: z.string(),
  object_type: z.string(),
  object_id: z.string(),
  metadata: z.string().nullable(),
  ip_address: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createAuditLogInputSchema = z.object({
  user_id: z.string(),
  action: z.string().min(1),
  object_type: z.string().min(1),
  object_id: z.string(),
  metadata: z.string().nullable(),
  ip_address: z.string().nullable()
});

export const searchAuditLogInputSchema = z.object({
  user_id: z.string().optional(),
  action: z.string().optional(),
  object_type: z.string().optional(),
  object_id: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type AuditLog = z.infer<typeof auditLogSchema>;
export type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;
export type SearchAuditLogInput = z.infer<typeof searchAuditLogInputSchema>;

// =====================================================
// GALLERY IMAGES SCHEMAS
// =====================================================

export const galleryImageSchema = z.object({
  id: z.string(),
  title: z.string(),
  image_url: z.string(),
  thumbnail_url: z.string().nullable(),
  description: z.string().nullable(),
  alt_text: z.string().nullable(),
  categories: z.string().nullable(),
  is_active: z.boolean(),
  sort_order: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createGalleryImageInputSchema = z.object({
  title: z.string().min(1).max(255),
  image_url: z.string().url(),
  thumbnail_url: z.string().url().nullable(),
  description: z.string().nullable(),
  alt_text: z.string().max(255).nullable(),
  categories: z.string().nullable(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().nonnegative().default(0)
});

export const updateGalleryImageInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255).optional(),
  image_url: z.string().url().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  alt_text: z.string().max(255).nullable().optional(),
  categories: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional()
});

export const searchGalleryImageInputSchema = z.object({
  query: z.string().optional(),
  categories: z.string().optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['title', 'sort_order', 'created_at']).default('sort_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type GalleryImage = z.infer<typeof galleryImageSchema>;
export type CreateGalleryImageInput = z.infer<typeof createGalleryImageInputSchema>;
export type UpdateGalleryImageInput = z.infer<typeof updateGalleryImageInputSchema>;
export type SearchGalleryImageInput = z.infer<typeof searchGalleryImageInputSchema>;

// =====================================================
// CASE STUDIES SCHEMAS
// =====================================================

export const caseStudySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  service_id: z.string(),
  tier_id: z.string(),
  gallery_image_id: z.string(),
  description: z.string().nullable(),
  client_testimonial: z.string().nullable(),
  additional_images: z.string().nullable(),
  is_published: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createCaseStudyInputSchema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(255),
  service_id: z.string(),
  tier_id: z.string(),
  gallery_image_id: z.string(),
  description: z.string().nullable(),
  client_testimonial: z.string().nullable(),
  additional_images: z.string().nullable(),
  is_published: z.boolean().default(true)
});

export const updateCaseStudyInputSchema = z.object({
  id: z.string(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(1).max(255).optional(),
  service_id: z.string().optional(),
  tier_id: z.string().optional(),
  gallery_image_id: z.string().optional(),
  description: z.string().nullable().optional(),
  client_testimonial: z.string().nullable().optional(),
  additional_images: z.string().nullable().optional(),
  is_published: z.boolean().optional()
});

export const searchCaseStudyInputSchema = z.object({
  query: z.string().optional(),
  service_id: z.string().optional(),
  tier_id: z.string().optional(),
  is_published: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['title', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type CaseStudy = z.infer<typeof caseStudySchema>;
export type CreateCaseStudyInput = z.infer<typeof createCaseStudyInputSchema>;
export type UpdateCaseStudyInput = z.infer<typeof updateCaseStudyInputSchema>;
export type SearchCaseStudyInput = z.infer<typeof searchCaseStudyInputSchema>;

// =====================================================
// MARKETING CONTENT SCHEMAS
// =====================================================

export const marketingContentSchema = z.object({
  id: z.string(),
  page_key: z.string(),
  section_key: z.string(),
  content: z.string(),
  updated_at: z.coerce.date()
});

export const createMarketingContentInputSchema = z.object({
  page_key: z.string().min(1).max(100),
  section_key: z.string().min(1).max(100),
  content: z.string()
});

export const updateMarketingContentInputSchema = z.object({
  id: z.string(),
  content: z.string()
});

export type MarketingContent = z.infer<typeof marketingContentSchema>;
export type CreateMarketingContentInput = z.infer<typeof createMarketingContentInputSchema>;
export type UpdateMarketingContentInput = z.infer<typeof updateMarketingContentInputSchema>;

// =====================================================
// TIER CHECKLIST ITEMS SCHEMAS
// =====================================================

export const tierChecklistItemSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  feature_id: z.string(),
  is_completed: z.boolean(),
  completed_at: z.string().nullable(),
  completed_by_staff_id: z.string().nullable()
});

export const createTierChecklistItemInputSchema = z.object({
  order_id: z.string(),
  feature_id: z.string(),
  is_completed: z.boolean().default(false)
});

export const updateTierChecklistItemInputSchema = z.object({
  id: z.string(),
  is_completed: z.boolean(),
  completed_at: z.string().nullable().optional(),
  completed_by_staff_id: z.string().nullable().optional()
});

export type TierChecklistItem = z.infer<typeof tierChecklistItemSchema>;
export type CreateTierChecklistItemInput = z.infer<typeof createTierChecklistItemInputSchema>;
export type UpdateTierChecklistItemInput = z.infer<typeof updateTierChecklistItemInputSchema>;

// =====================================================
// CONTACT INQUIRIES SCHEMAS
// =====================================================

export const contactInquirySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  service_interested_in: z.string().nullable(),
  message: z.string(),
  status: z.string(),
  created_at: z.coerce.date()
});

export const createContactInquiryInputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().nullable(),
  service_interested_in: z.string().max(255).nullable(),
  message: z.string().min(1),
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).default('NEW')
});

export const updateContactInquiryInputSchema = z.object({
  id: z.string(),
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'])
});

export const searchContactInquiryInputSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).optional(),
  service_interested_in: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'name']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type ContactInquiry = z.infer<typeof contactInquirySchema>;
export type CreateContactInquiryInput = z.infer<typeof createContactInquiryInputSchema>;
export type UpdateContactInquiryInput = z.infer<typeof updateContactInquiryInputSchema>;
export type SearchContactInquiryInput = z.infer<typeof searchContactInquiryInputSchema>;

// =====================================================
// B2B ACCOUNTS SCHEMAS
// =====================================================

export const b2bAccountSchema = z.object({
  id: z.string(),
  company_name: z.string(),
  main_contact_user_id: z.string(),
  contract_start: z.string().nullable(),
  contract_end: z.string().nullable(),
  terms: z.string().nullable(),
  payment_terms: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createB2bAccountInputSchema = z.object({
  company_name: z.string().min(1).max(255),
  main_contact_user_id: z.string(),
  contract_start: z.string().nullable(),
  contract_end: z.string().nullable(),
  terms: z.string().nullable(),
  payment_terms: z.enum(['NET_15', 'NET_30', 'NET_45', 'NET_60']).default('NET_30'),
  is_active: z.boolean().default(true)
});

export const updateB2bAccountInputSchema = z.object({
  id: z.string(),
  company_name: z.string().min(1).max(255).optional(),
  main_contact_user_id: z.string().optional(),
  contract_start: z.string().nullable().optional(),
  contract_end: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  payment_terms: z.enum(['NET_15', 'NET_30', 'NET_45', 'NET_60']).optional(),
  is_active: z.boolean().optional()
});

export const searchB2bAccountInputSchema = z.object({
  query: z.string().optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['company_name', 'created_at']).default('company_name'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type B2bAccount = z.infer<typeof b2bAccountSchema>;
export type CreateB2bAccountInput = z.infer<typeof createB2bAccountInputSchema>;
export type UpdateB2bAccountInput = z.infer<typeof updateB2bAccountInputSchema>;
export type SearchB2bAccountInput = z.infer<typeof searchB2bAccountInputSchema>;

// =====================================================
// B2B LOCATIONS SCHEMAS
// =====================================================

export const b2bLocationSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  label: z.string(),
  address: z.string(),
  contact_name: z.string().nullable(),
  contact_phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createB2bLocationInputSchema = z.object({
  account_id: z.string(),
  label: z.string().min(1).max(255),
  address: z.string().min(1),
  contact_name: z.string().max(255).nullable(),
  contact_phone: z.string().nullable(),
  is_active: z.boolean().default(true)
});

export const updateB2bLocationInputSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(255).optional(),
  address: z.string().min(1).optional(),
  contact_name: z.string().max(255).nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type B2bLocation = z.infer<typeof b2bLocationSchema>;
export type CreateB2bLocationInput = z.infer<typeof createB2bLocationInputSchema>;
export type UpdateB2bLocationInput = z.infer<typeof updateB2bLocationInputSchema>;

// =====================================================
// CONTRACT PRICING SCHEMAS
// =====================================================

export const contractPricingSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  service_id: z.string(),
  pricing_json: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createContractPricingInputSchema = z.object({
  account_id: z.string(),
  service_id: z.string(),
  pricing_json: z.string().default('{}')
});

export const updateContractPricingInputSchema = z.object({
  id: z.string(),
  pricing_json: z.string()
});

export type ContractPricing = z.infer<typeof contractPricingSchema>;
export type CreateContractPricingInput = z.infer<typeof createContractPricingInputSchema>;
export type UpdateContractPricingInput = z.infer<typeof updateContractPricingInputSchema>;

// =====================================================
// INVENTORY ITEMS SCHEMAS
// =====================================================

export const inventoryItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  unit: z.string(),
  qty_on_hand: z.number(),
  reorder_point: z.number(),
  reorder_qty: z.number(),
  supplier_name: z.string().nullable(),
  cost_per_unit: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createInventoryItemInputSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  unit: z.string().min(1).max(50),
  qty_on_hand: z.number().nonnegative().default(0),
  reorder_point: z.number().nonnegative().default(0),
  reorder_qty: z.number().nonnegative().default(0),
  supplier_name: z.string().max(255).nullable(),
  cost_per_unit: z.number().nonnegative().default(0),
  is_active: z.boolean().default(true)
});

export const updateInventoryItemInputSchema = z.object({
  id: z.string(),
  sku: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(255).optional(),
  unit: z.string().min(1).max(50).optional(),
  qty_on_hand: z.number().nonnegative().optional(),
  reorder_point: z.number().nonnegative().optional(),
  reorder_qty: z.number().nonnegative().optional(),
  supplier_name: z.string().max(255).nullable().optional(),
  cost_per_unit: z.number().nonnegative().optional(),
  is_active: z.boolean().optional()
});

export const searchInventoryItemInputSchema = z.object({
  query: z.string().optional(),
  sku: z.string().optional(),
  is_active: z.boolean().optional(),
  low_stock: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'sku', 'qty_on_hand']).default('name'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemInputSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemInputSchema>;
export type SearchInventoryItemInput = z.infer<typeof searchInventoryItemInputSchema>;

// =====================================================
// MATERIAL CONSUMPTION RULES SCHEMAS
// =====================================================

export const materialConsumptionRuleSchema = z.object({
  id: z.string(),
  service_id: z.string(),
  inventory_item_id: z.string(),
  rule_json: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createMaterialConsumptionRuleInputSchema = z.object({
  service_id: z.string(),
  inventory_item_id: z.string(),
  rule_json: z.string().default('{}')
});

export const updateMaterialConsumptionRuleInputSchema = z.object({
  id: z.string(),
  rule_json: z.string()
});

export type MaterialConsumptionRule = z.infer<typeof materialConsumptionRuleSchema>;
export type CreateMaterialConsumptionRuleInput = z.infer<typeof createMaterialConsumptionRuleInputSchema>;
export type UpdateMaterialConsumptionRuleInput = z.infer<typeof updateMaterialConsumptionRuleInputSchema>;

// =====================================================
// PURCHASE ORDERS SCHEMAS
// =====================================================

export const purchaseOrderSchema = z.object({
  id: z.string(),
  supplier_name: z.string(),
  status: z.string(),
  ordered_at: z.string().nullable(),
  received_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createPurchaseOrderInputSchema = z.object({
  supplier_name: z.string().min(1).max(255),
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED']).default('DRAFT'),
  ordered_at: z.string().nullable(),
  notes: z.string().nullable()
});

export const updatePurchaseOrderInputSchema = z.object({
  id: z.string(),
  supplier_name: z.string().min(1).max(255).optional(),
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED']).optional(),
  ordered_at: z.string().nullable().optional(),
  received_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export const searchPurchaseOrderInputSchema = z.object({
  supplier_name: z.string().optional(),
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED']).optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'ordered_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderInputSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderInputSchema>;
export type SearchPurchaseOrderInput = z.infer<typeof searchPurchaseOrderInputSchema>;

// =====================================================
// PURCHASE ORDER ITEMS SCHEMAS
// =====================================================

export const purchaseOrderItemSchema = z.object({
  id: z.string(),
  purchase_order_id: z.string(),
  inventory_item_id: z.string(),
  qty: z.number(),
  unit_cost: z.number(),
  created_at: z.coerce.date()
});

export const createPurchaseOrderItemInputSchema = z.object({
  purchase_order_id: z.string(),
  inventory_item_id: z.string(),
  qty: z.number().positive(),
  unit_cost: z.number().nonnegative().default(0)
});

export type PurchaseOrderItem = z.infer<typeof purchaseOrderItemSchema>;
export type CreatePurchaseOrderItemInput = z.infer<typeof createPurchaseOrderItemInputSchema>;

// =====================================================
// INVENTORY TRANSACTIONS SCHEMAS
// =====================================================

export const inventoryTransactionSchema = z.object({
  id: z.string(),
  inventory_item_id: z.string(),
  transaction_type: z.string(),
  qty: z.number(),
  reference_type: z.string().nullable(),
  reference_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createInventoryTransactionInputSchema = z.object({
  inventory_item_id: z.string(),
  transaction_type: z.enum(['ADDITION', 'CONSUMPTION', 'ADJUSTMENT']).default('ADDITION'),
  qty: z.number(),
  reference_type: z.string().max(50).nullable(),
  reference_id: z.string().nullable(),
  notes: z.string().nullable()
});

export const searchInventoryTransactionInputSchema = z.object({
  inventory_item_id: z.string().optional(),
  transaction_type: z.enum(['ADDITION', 'CONSUMPTION', 'ADJUSTMENT']).optional(),
  reference_type: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>;
export type CreateInventoryTransactionInput = z.infer<typeof createInventoryTransactionInputSchema>;
export type SearchInventoryTransactionInput = z.infer<typeof searchInventoryTransactionInputSchema>;

// =====================================================
// CALENDAR SETTINGS SCHEMAS
// =====================================================

export const calendarSettingsSchema = z.object({
  id: z.string(),
  working_days: z.string(),
  start_hour: z.number(),
  end_hour: z.number(),
  slot_duration_minutes: z.number(),
  slots_per_day: z.number(),
  emergency_slots_per_day: z.number(),
  updated_at: z.coerce.date()
});

export const updateCalendarSettingsInputSchema = z.object({
  id: z.string(),
  working_days: z.string().optional(),
  start_hour: z.number().int().min(0).max(23).optional(),
  end_hour: z.number().int().min(0).max(23).optional(),
  slot_duration_minutes: z.number().int().positive().optional(),
  slots_per_day: z.number().int().positive().optional(),
  emergency_slots_per_day: z.number().int().nonnegative().optional()
});

export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;
export type UpdateCalendarSettingsInput = z.infer<typeof updateCalendarSettingsInputSchema>;

// =====================================================
// BLACKOUT DATES SCHEMAS
// =====================================================

export const blackoutDateSchema = z.object({
  id: z.string(),
  date: z.string(),
  reason: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createBlackoutDateInputSchema = z.object({
  date: z.string(),
  reason: z.string().max(255).nullable()
});

export type BlackoutDate = z.infer<typeof blackoutDateSchema>;
export type CreateBlackoutDateInput = z.infer<typeof createBlackoutDateInputSchema>;

// =====================================================
// NOTIFICATION PREFERENCES SCHEMAS
// =====================================================

export const notificationPreferencesSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  email_order_updates: z.boolean(),
  email_proof_ready: z.boolean(),
  email_messages: z.boolean(),
  email_marketing: z.boolean(),
  updated_at: z.coerce.date()
});

export const createNotificationPreferencesInputSchema = z.object({
  user_id: z.string(),
  email_order_updates: z.boolean().default(true),
  email_proof_ready: z.boolean().default(true),
  email_messages: z.boolean().default(true),
  email_marketing: z.boolean().default(false)
});

export const updateNotificationPreferencesInputSchema = z.object({
  id: z.string(),
  email_order_updates: z.boolean().optional(),
  email_proof_ready: z.boolean().optional(),
  email_messages: z.boolean().optional(),
  email_marketing: z.boolean().optional()
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type CreateNotificationPreferencesInput = z.infer<typeof createNotificationPreferencesInputSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesInputSchema>;

// =====================================================
// PASSWORD RESET TOKENS SCHEMAS
// =====================================================

export const passwordResetTokenSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  token: z.string(),
  expires_at: z.string(),
  is_used: z.boolean(),
  created_at: z.coerce.date()
});

export const createPasswordResetTokenInputSchema = z.object({
  user_id: z.string(),
  token: z.string().min(32),
  expires_at: z.string(),
  is_used: z.boolean().default(false)
});

export const updatePasswordResetTokenInputSchema = z.object({
  id: z.string(),
  is_used: z.boolean()
});

export type PasswordResetToken = z.infer<typeof passwordResetTokenSchema>;
export type CreatePasswordResetTokenInput = z.infer<typeof createPasswordResetTokenInputSchema>;
export type UpdatePasswordResetTokenInput = z.infer<typeof updatePasswordResetTokenInputSchema>;

// =====================================================
// SESSIONS SCHEMAS
// =====================================================

export const sessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  token: z.string(),
  expires_at: z.string(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createSessionInputSchema = z.object({
  user_id: z.string(),
  token: z.string().min(32),
  expires_at: z.string(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable()
});

export type Session = z.infer<typeof sessionSchema>;
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

// =====================================================
// GUEST QUOTE TOKENS SCHEMAS
// =====================================================

export const guestQuoteTokenSchema = z.object({
  id: z.string(),
  quote_id: z.string(),
  token: z.string(),
  expires_at: z.string(),
  is_used: z.boolean(),
  created_at: z.coerce.date()
});

export const createGuestQuoteTokenInputSchema = z.object({
  quote_id: z.string(),
  token: z.string().min(32),
  expires_at: z.string(),
  is_used: z.boolean().default(false)
});

export type GuestQuoteToken = z.infer<typeof guestQuoteTokenSchema>;
export type CreateGuestQuoteTokenInput = z.infer<typeof createGuestQuoteTokenInputSchema>;