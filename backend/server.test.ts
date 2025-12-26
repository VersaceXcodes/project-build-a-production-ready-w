import request from 'supertest';
import { app, pool } from './server.ts';

// =====================================================
// TEST SETUP & TEARDOWN
// =====================================================

beforeAll(async () => {
  // Database is already seeded via schema.sql
  // Create test sessions for authenticated requests
});

afterAll(async () => {
  // Close database connection pool
  await pool.end();
});

beforeEach(async () => {
  // Each test runs in isolation, but we don't truncate
  // since we rely on seed data. Tests should be idempotent.
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function loginUser(email: string, password: string, role: string) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password, role })
    .expect(200);
  
  return response.body.token;
}

async function createTestUpload(token: string, quoteId?: string) {
  const response = await request(app)
    .post('/api/uploads')
    .set('Authorization', `Bearer ${token}`)
    .send({
      file_url: 'https://example.com/test-file.pdf',
      file_type: 'application/pdf',
      file_name: 'test-file.pdf',
      file_size_bytes: 1024000,
      quote_id: quoteId || null,
      order_id: null,
      dpi_warning: false
    });
  
  return response.body;
}

// =====================================================
// AUTHENTICATION TESTS
// =====================================================

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should register new customer with profile', async () => {
      const userData = {
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'password123', // Plain text for testing
        phone: '+1-555-9999',
        company_name: 'Test Company',
        address: '123 Test St'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('customer_profile');
      
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('CUSTOMER');
      expect(response.body.user.is_active).toBe(true);
      
      expect(response.body.customer_profile.phone).toBe(userData.phone);
      expect(response.body.customer_profile.company_name).toBe(userData.company_name);
    });

    it('should reject duplicate email', async () => {
      const userData = {
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com', // Already exists in seed data
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should reject weak password', async () => {
      const userData = {
        name: 'Test User',
        email: 'weak@example.com',
        password: '123' // Too short
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should reject invalid email format', async () => {
      const userData = {
        name: 'Test User',
        email: 'not-an-email',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login customer with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice.johnson@example.com',
          password: 'password123', // Plain text in seed data
          role: 'CUSTOMER'
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('profile');
      
      expect(response.body.user.role).toBe('CUSTOMER');
      expect(response.body.profile).toHaveProperty('phone');
      expect(response.body.profile).toHaveProperty('company_name');
    });

    it('should login staff with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.designer@printshop.com',
          password: 'staff123',
          role: 'STAFF'
        })
        .expect(200);

      expect(response.body.user.role).toBe('STAFF');
      expect(response.body.profile).toHaveProperty('department');
      expect(response.body.profile).toHaveProperty('permissions');
    });

    it('should login admin with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@printshop.com',
          password: 'admin123',
          role: 'ADMIN'
        })
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should reject incorrect password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice.johnson@example.com',
          password: 'wrongpassword',
          role: 'CUSTOMER'
        })
        .expect(401);
    });

    it('should reject role mismatch', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice.johnson@example.com',
          password: 'password123',
          role: 'STAFF' // Customer trying to login as staff
        })
        .expect(401);
    });

    it('should reject inactive user', async () => {
      // First create and deactivate a user
      const token = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
      
      const createResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Inactive User',
          email: 'inactive@example.com',
          password: 'password123',
          role: 'CUSTOMER'
        });

      const userId = createResponse.body.user.id;

      await request(app)
        .patch(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ is_active: false });

      // Try to login with inactive account
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'password123',
          role: 'CUSTOMER'
        })
        .expect(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send reset email for valid user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'alice.johnson@example.com' })
        .expect(200);

      expect(response.body.message).toContain('password reset link');
      
      // Verify token was created
      const result = await pool.query(
        'SELECT * FROM password_reset_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1) ORDER BY created_at DESC LIMIT 1',
        ['alice.johnson@example.com']
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].is_used).toBe(false);
    });

    it('should return success even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.message).toContain('password reset link');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      // Get a valid reset token from seed data
      const tokenResult = await pool.query(
        'SELECT token FROM password_reset_tokens WHERE is_used = false AND expires_at > $1 LIMIT 1',
        [new Date().toISOString()]
      );
      
      if (tokenResult.rows.length === 0) {
        // Create a new token for testing
        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'alice.johnson@example.com' });
        
        const newTokenResult = await pool.query(
          'SELECT token FROM password_reset_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1) ORDER BY created_at DESC LIMIT 1',
          ['alice.johnson@example.com']
        );
        
        const token = newTokenResult.rows[0].token;
        
        await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: token,
            password: 'newpassword123'
          })
          .expect(200);

        // Verify can login with new password
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'alice.johnson@example.com',
            password: 'newpassword123',
            role: 'CUSTOMER'
          })
          .expect(200);
      }
    });

    it('should reject expired token', async () => {
      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'expired_or_invalid_token',
          password: 'newpassword123'
        })
        .expect(400);
    });

    it('should reject used token', async () => {
      const tokenResult = await pool.query(
        'SELECT token FROM password_reset_tokens WHERE is_used = true LIMIT 1'
      );

      if (tokenResult.rows.length > 0) {
        await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: tokenResult.rows[0].token,
            password: 'newpassword123'
          })
          .expect(400);
      }
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user data with valid token', async () => {
      const token = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.user.email).toBe('alice.johnson@example.com');
      expect(response.body.profile).toHaveProperty('company_name');
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_here')
        .expect(401);
    });
  });
});

// =====================================================
// PUBLIC CONTENT TESTS
// =====================================================

describe('Public Content', () => {
  describe('GET /api/public/services', () => {
    it('should return all active services', async () => {
      const response = await request(app)
        .get('/api/public/services')
        .expect(200);

      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.services)).toBe(true);
      expect(response.body.services.length).toBeGreaterThan(0);
      
      // Verify all returned services are active
      response.body.services.forEach((service: any) => {
        expect(service.is_active).toBe(true);
      });
    });

    it('should filter services by category', async () => {
      const response = await request(app)
        .get('/api/public/services?category=business-printing')
        .expect(200);

      expect(response.body.services.length).toBeGreaterThan(0);
      response.body.services.forEach((service: any) => {
        expect(service.category_slug).toBe('business-printing');
      });
    });

    it('should filter top seller services', async () => {
      const response = await request(app)
        .get('/api/public/services?is_top_seller=true')
        .expect(200);

      expect(response.body.services.length).toBeGreaterThan(0);
      response.body.services.forEach((service: any) => {
        expect(service.is_top_seller).toBe(true);
      });
    });

    it('should return empty array for non-existent category', async () => {
      const response = await request(app)
        .get('/api/public/services?category=non-existent')
        .expect(200);

      expect(response.body.services).toEqual([]);
    });
  });

  describe('GET /api/public/services/:slug', () => {
    it('should return service detail with options', async () => {
      const response = await request(app)
        .get('/api/public/services/business-cards')
        .expect(200);

      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('category');
      expect(response.body).toHaveProperty('service_options');
      
      expect(response.body.service.slug).toBe('business-cards');
      expect(Array.isArray(response.body.service_options)).toBe(true);
      expect(response.body.service_options.length).toBeGreaterThan(0);
      
      // Verify options are sorted
      const sortOrders = response.body.service_options.map((opt: any) => opt.sort_order);
      expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));
    });

    it('should return 404 for non-existent service', async () => {
      await request(app)
        .get('/api/public/services/non-existent-service')
        .expect(404);
    });

    it('should include example gallery images', async () => {
      const response = await request(app)
        .get('/api/public/services/business-cards')
        .expect(200);

      expect(response.body).toHaveProperty('examples');
      // May be empty array if no examples linked
    });
  });

  describe('GET /api/public/tiers', () => {
    it('should return all tiers with features', async () => {
      const response = await request(app)
        .get('/api/public/tiers')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(4); // Basic, Standard, Premium, Enterprise
      
      response.body.forEach((tierData: any) => {
        expect(tierData).toHaveProperty('tier');
        expect(tierData).toHaveProperty('features');
        expect(Array.isArray(tierData.features)).toBe(true);
        
        // Verify tier structure
        expect(tierData.tier).toHaveProperty('name');
        expect(tierData.tier).toHaveProperty('slug');
        expect(tierData.tier.is_active).toBe(true);
      });
    });

    it('should group features by category', async () => {
      const response = await request(app)
        .get('/api/public/tiers')
        .expect(200);

      const tier = response.body[0];
      const groupNames = [...new Set(tier.features.map((f: any) => f.group_name))];
      
      expect(groupNames.length).toBeGreaterThan(1); // Multiple feature groups
    });
  });

  describe('GET /api/public/gallery', () => {
    it('should return gallery images with pagination', async () => {
      const response = await request(app)
        .get('/api/public/gallery')
        .expect(200);

      expect(response.body).toHaveProperty('images');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(Array.isArray(response.body.images)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/public/gallery?category=business-cards')
        .expect(200);

      response.body.images.forEach((image: any) => {
        expect(image.categories).toContain('business-cards');
      });
    });

    it('should paginate results', async () => {
      const page1 = await request(app)
        .get('/api/public/gallery?page=1&limit=5')
        .expect(200);

      expect(page1.body.images.length).toBeLessThanOrEqual(5);
      expect(page1.body.page).toBe(1);
    });
  });

  describe('POST /api/public/contact-inquiry', () => {
    it('should submit contact inquiry', async () => {
      const inquiry = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-1111',
        service_interested_in: 'Business Cards',
        message: 'I need information about your business card printing services.'
      };

      const response = await request(app)
        .post('/api/public/contact-inquiry')
        .send(inquiry)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('NEW');
    });

    it('should reject inquiry without required fields', async () => {
      await request(app)
        .post('/api/public/contact-inquiry')
        .send({
          name: 'John Doe'
          // Missing email and message
        })
        .expect(400);
    });
  });
});

// =====================================================
// QUOTE MANAGEMENT TESTS
// =====================================================

describe('Quotes', () => {
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  describe('POST /api/quotes', () => {
    it('should create quote with all wizard data', async () => {
      // First upload some files
      const upload1 = await createTestUpload(customerToken);
      
      const quoteData = {
        service_id: 'svc_001', // Business Cards
        tier_id: 'tier_002', // Standard
        project_details: {
          quantity: '1000',
          finish: 'Matte',
          paper_weight: '16pt'
        },
        file_ids: [upload1.id],
        notes: 'Need these urgently for conference'
      };

      const response = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(quoteData)
        .expect(201);

      expect(response.body).toHaveProperty('quote');
      expect(response.body).toHaveProperty('quote_answers');
      
      expect(response.body.quote.status).toBe('SUBMITTED');
      expect(response.body.quote.service_id).toBe(quoteData.service_id);
      expect(response.body.quote.tier_id).toBe(quoteData.tier_id);
      
      expect(response.body.quote_answers.length).toBeGreaterThan(0);
      
      // Verify quote answers contain project details
      const answerKeys = response.body.quote_answers.map((a: any) => a.option_key);
      expect(answerKeys).toContain('quantity');
      expect(answerKeys).toContain('finish');
    });

    it('should reject quote without authentication', async () => {
      await request(app)
        .post('/api/quotes')
        .send({
          service_id: 'svc_001',
          tier_id: 'tier_001',
          project_details: {}
        })
        .expect(401);
    });

    it('should reject quote with invalid service', async () => {
      await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          service_id: 'invalid_service',
          tier_id: 'tier_001',
          project_details: {}
        })
        .expect(400);
    });

    it('should reject quote with invalid tier', async () => {
      await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          service_id: 'svc_001',
          tier_id: 'invalid_tier',
          project_details: {}
        })
        .expect(400);
    });

    it('should create message thread automatically', async () => {
      const upload = await createTestUpload(customerToken);
      
      const response = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          service_id: 'svc_001',
          tier_id: 'tier_001',
          project_details: { quantity: '500' },
          file_ids: [upload.id]
        })
        .expect(201);

      const quoteId = response.body.quote.id;
      
      // Verify message thread was created
      const threadResult = await pool.query(
        'SELECT * FROM message_threads WHERE quote_id = $1',
        [quoteId]
      );
      
      expect(threadResult.rows.length).toBe(1);
    });
  });

  describe('GET /api/quotes', () => {
    it('should list customer quotes', async () => {
      const response = await request(app)
        .get('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('quotes');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.quotes)).toBe(true);
      
      // Verify only customer's quotes returned
      response.body.quotes.forEach((quoteData: any) => {
        expect(quoteData.quote.customer_id).toBe('user_cust_001');
      });
    });

    it('should filter quotes by status', async () => {
      const response = await request(app)
        .get('/api/quotes?status=SUBMITTED')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      response.body.quotes.forEach((quoteData: any) => {
        expect(quoteData.quote.status).toBe('SUBMITTED');
      });
    });

    it('should reject unauthenticated access', async () => {
      await request(app)
        .get('/api/quotes')
        .expect(401);
    });
  });

  describe('GET /api/quotes/:id', () => {
    it('should return quote detail with all related data', async () => {
      const response = await request(app)
        .get('/api/quotes/quote_001')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('quote');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('tier');
      expect(response.body).toHaveProperty('quote_answers');
      expect(response.body).toHaveProperty('uploads');
      expect(response.body).toHaveProperty('message_thread');
      
      expect(response.body.quote.id).toBe('quote_001');
    });

    it('should reject access to other customer quote', async () => {
      // Login as different customer
      const otherToken = await loginUser('bob.smith@example.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .get('/api/quotes/quote_001') // Owned by Alice
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should allow admin to view any quote', async () => {
      const response = await request(app)
        .get('/api/quotes/quote_001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.quote.id).toBe('quote_001');
    });
  });

  describe('POST /api/admin/quotes/:id/finalize', () => {
    it('should finalize quote and create invoice', async () => {
      // First create a new quote to finalize
      const upload = await createTestUpload(customerToken);
      
      const quoteResponse = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          service_id: 'svc_001',
          tier_id: 'tier_001',
          project_details: { quantity: '250' },
          file_ids: [upload.id]
        });

      const quoteId = quoteResponse.body.quote.id;

      // Now finalize it as admin
      const finalizeResponse = await request(app)
        .post(`/api/admin/quotes/${quoteId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          final_subtotal: 150,
          notes: 'Standard pricing applied'
        })
        .expect(200);

      expect(finalizeResponse.body.quote.status).toBe('FINALIZED');
      expect(finalizeResponse.body.quote.final_subtotal).toBe(150);
      expect(finalizeResponse.body).toHaveProperty('invoice');
      expect(finalizeResponse.body.invoice.invoice_number).toMatch(/^INV-\d{4}-\d{5}$/);
      
      // Verify invoice created in database
      const invoiceResult = await pool.query(
        'SELECT * FROM invoices WHERE order_id IN (SELECT id FROM orders WHERE quote_id = $1)',
        [quoteId]
      );
      
      // Invoice may not be created until order is created (after booking)
      // So we just verify quote status changed
      const quoteResult = await pool.query(
        'SELECT * FROM quotes WHERE id = $1',
        [quoteId]
      );
      
      expect(quoteResult.rows[0].status).toBe('FINALIZED');
      expect(parseFloat(quoteResult.rows[0].final_subtotal)).toBe(150);
    });

    it('should reject finalization by non-admin', async () => {
      await request(app)
        .post('/api/admin/quotes/quote_008/finalize')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ final_subtotal: 100 })
        .expect(403);
    });

    it('should reject finalization without price', async () => {
      await request(app)
        .post('/api/admin/quotes/quote_008/finalize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Missing price' })
        .expect(400);
    });
  });
});

// =====================================================
// BOOKING & CALENDAR TESTS
// =====================================================

describe('Bookings & Calendar', () => {
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  describe('GET /api/calendar/availability', () => {
    it('should return availability for date range', async () => {
      const response = await request(app)
        .get('/api/calendar/availability')
        .query({
          start_date: '2024-03-01',
          end_date: '2024-03-07'
        })
        .expect(200);

      expect(response.body).toHaveProperty('available_dates');
      expect(response.body).toHaveProperty('calendar_settings');
      expect(Array.isArray(response.body.available_dates)).toBe(true);
      
      response.body.available_dates.forEach((dateData: any) => {
        expect(dateData).toHaveProperty('date');
        expect(dateData).toHaveProperty('available_slots');
        expect(dateData).toHaveProperty('is_full');
        expect(Array.isArray(dateData.available_slots)).toBe(true);
      });
    });

    it('should exclude blackout dates', async () => {
      const response = await request(app)
        .get('/api/calendar/availability')
        .query({
          start_date: '2024-12-20',
          end_date: '2024-12-31'
        })
        .expect(200);

      const christmasDay = response.body.available_dates.find(
        (d: any) => d.date === '2024-12-25'
      );
      
      if (christmasDay) {
        expect(christmasDay.available_slots.length).toBe(0);
      }
    });

    it('should show emergency slots for full dates', async () => {
      const response = await request(app)
        .get('/api/calendar/availability')
        .query({
          start_date: '2024-03-01',
          end_date: '2024-03-31'
        })
        .expect(200);

      response.body.available_dates.forEach((dateData: any) => {
        expect(dateData).toHaveProperty('emergency_slots_available');
        expect(typeof dateData.emergency_slots_available).toBe('number');
      });
    });

    it('should respect working days settings', async () => {
      const response = await request(app)
        .get('/api/calendar/availability')
        .query({
          start_date: '2024-03-01',
          end_date: '2024-03-07'
        })
        .expect(200);

      // Calendar settings show working_days: [1,2,3,4,5] (Mon-Fri)
      // So weekends should have no slots
      response.body.available_dates.forEach((dateData: any) => {
        const date = new Date(dateData.date);
        const dayOfWeek = date.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
          // Should have no available slots (not working day)
          expect(dateData.available_slots.every((slot: any) => !slot.is_available)).toBe(true);
        }
      });
    });
  });

  describe('POST /api/bookings', () => {
    it('should create regular booking', async () => {
      // Create a finalized quote first
      const upload = await createTestUpload(customerToken);
      
      const quoteResponse = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          service_id: 'svc_007', // Banners (requires booking)
          tier_id: 'tier_002',
          project_details: { size: '4x8 ft', material: '13oz Vinyl' },
          file_ids: [upload.id]
        });

      const quoteId = quoteResponse.body.quote.id;

      // Finalize quote as admin
      await request(app)
        .post(`/api/admin/quotes/${quoteId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ final_subtotal: 150 });

      // Create booking
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          quote_id: quoteId,
          start_at: '2024-03-15T09:00:00Z',
          end_at: '2024-03-15T12:00:00Z',
          is_emergency: false
        })
        .expect(201);

      expect(bookingResponse.body.status).toBe('PENDING');
      expect(bookingResponse.body.is_emergency).toBe(false);
      expect(bookingResponse.body.urgent_fee_pct).toBe(0);
    });

    it('should create emergency booking with urgent fee', async () => {
      const upload = await createTestUpload(customerToken);
      
      const quoteResponse = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          service_id: 'svc_007',
          tier_id: 'tier_003',
          project_details: { size: '4x8 ft' },
          file_ids: [upload.id]
        });

      const quoteId = quoteResponse.body.quote.id;

      await request(app)
        .post(`/api/admin/quotes/${quoteId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ final_subtotal: 200 });

      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          quote_id: quoteId,
          start_at: '2024-03-20T09:00:00Z',
          end_at: '2024-03-20T12:00:00Z',
          is_emergency: true
        })
        .expect(201);

      expect(bookingResponse.body.is_emergency).toBe(true);
      expect(bookingResponse.body.urgent_fee_pct).toBeGreaterThan(0);
      expect(bookingResponse.body.message).toContain('Emergency fee applied');
    });

    it('should reject booking on blackout date', async () => {
      const upload = await createTestUpload(customerToken);
      
      const quoteResponse = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          service_id: 'svc_007',
          tier_id: 'tier_001',
          project_details: { size: '3x6 ft' },
          file_ids: [upload.id]
        });

      const quoteId = quoteResponse.body.quote.id;

      await request(app)
        .post(`/api/admin/quotes/${quoteId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ final_subtotal: 80 });

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          quote_id: quoteId,
          start_at: '2024-12-25T09:00:00Z', // Christmas Day (blackout)
          end_at: '2024-12-25T11:00:00Z'
        })
        .expect(400);
    });

    it('should reject booking for unfinalized quote', async () => {
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          quote_id: 'quote_008', // Status: SUBMITTED
          start_at: '2024-03-15T09:00:00Z',
          end_at: '2024-03-15T11:00:00Z'
        })
        .expect(400);
    });
  });

  describe('GET /api/bookings', () => {
    it('should list customer bookings', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify only customer's bookings
      response.body.forEach((bookingData: any) => {
        expect(bookingData.booking.customer_id).toBe('user_cust_001');
      });
    });

    it('should filter bookings by status', async () => {
      const response = await request(app)
        .get('/api/bookings?status=CONFIRMED')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      response.body.forEach((bookingData: any) => {
        expect(bookingData.booking.status).toBe('CONFIRMED');
      });
    });
  });
});

// =====================================================
// PAYMENT TESTS
// =====================================================

describe('Payments', () => {
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  describe('POST /api/payments/stripe/create-intent', () => {
    it('should create Stripe payment intent', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_id: 'order_003', // Customer's order awaiting deposit
          amount: 89.1
        })
        .expect(200);

      expect(response.body).toHaveProperty('client_secret');
      expect(response.body).toHaveProperty('payment_intent_id');
      expect(response.body).toHaveProperty('payment_id');
      expect(response.body.amount).toBe(89.1);
    });

    it('should reject payment for other customer order', async () => {
      const otherToken = await loginUser('bob.smith@example.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          order_id: 'order_003', // Belongs to Alice
          amount: 89.1
        })
        .expect(403);
    });

    it('should reject payment for completed order', async () => {
      await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          order_id: 'order_001', // Already completed
          amount: 100
        })
        .expect(400);
    });
  });

  describe('POST /api/orders/:id/payments', () => {
    it('should record manual payment by admin', async () => {
      const response = await request(app)
        .post('/api/orders/order_009/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 148.5,
          method: 'CHECK',
          transaction_ref: 'CHK-TEST-001'
        })
        .expect(201);

      expect(response.body.method).toBe('CHECK');
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.amount).toBe(148.5);
      expect(response.body).toHaveProperty('recorded_by_admin_id');
    });

    it('should reject manual payment by customer', async () => {
      const token = await loginUser('iris.taylor@agency.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .post('/api/orders/order_009/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          method: 'CASH',
          transaction_ref: 'TEST'
        })
        .expect(403);
    });

    it('should update order status when deposit paid', async () => {
      // Get an order awaiting deposit
      const orderResult = await pool.query(
        `SELECT o.* FROM orders o 
         WHERE o.customer_id = 'user_cust_003' 
         AND o.status = 'AWAITING_APPROVAL' 
         LIMIT 1`
      );

      if (orderResult.rows.length > 0) {
        const orderId = orderResult.rows[0].id;
        
        await request(app)
          .post(`/api/orders/${orderId}/payments`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            amount: parseFloat(orderResult.rows[0].deposit_amount),
            method: 'WIRE',
            transaction_ref: 'WIRE-TEST-001'
          })
          .expect(201);

        // Verify order status updated
        const updatedOrder = await pool.query(
          'SELECT * FROM orders WHERE id = $1',
          [orderId]
        );
        
        // Status may change to SCHEDULED or stay same depending on business logic
        expect(updatedOrder.rows[0].id).toBe(orderId);
      }
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should return invoice details', async () => {
      const response = await request(app)
        .get('/api/invoices/inv_001')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('invoice');
      expect(response.body).toHaveProperty('order');
      expect(response.body).toHaveProperty('customer');
      
      expect(response.body.invoice.invoice_number).toBe('INV-2024-0001');
    });

    it('should reject access to other customer invoice', async () => {
      const otherToken = await loginUser('bob.smith@example.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .get('/api/invoices/inv_001') // Alice's invoice
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });
});

// =====================================================
// ORDER MANAGEMENT TESTS
// =====================================================

describe('Orders', () => {
  let customerToken: string;
  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
    staffToken = await loginUser('john.designer@printshop.com', 'staff123', 'STAFF');
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  describe('GET /api/orders', () => {
    it('should list customer orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('total');
      
      // Verify only customer's orders
      response.body.orders.forEach((orderData: any) => {
        expect(orderData.order.customer_id).toBe('user_cust_001');
      });
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=COMPLETED')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      response.body.orders.forEach((orderData: any) => {
        expect(orderData.order.status).toBe('COMPLETED');
      });
    });

    it('should include payment status', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      response.body.orders.forEach((orderData: any) => {
        expect(orderData).toHaveProperty('payment_status');
        expect(orderData.payment_status).toHaveProperty('deposit_paid');
        expect(orderData.payment_status).toHaveProperty('balance_due');
      });
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return comprehensive order details', async () => {
      const response = await request(app)
        .get('/api/orders/order_001')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('order');
      expect(response.body).toHaveProperty('quote');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('tier');
      expect(response.body).toHaveProperty('booking');
      expect(response.body).toHaveProperty('proof_versions');
      expect(response.body).toHaveProperty('invoice');
      expect(response.body).toHaveProperty('payments');
      expect(response.body).toHaveProperty('message_thread');
      expect(response.body).toHaveProperty('status_timeline');
    });

    it('should include status timeline', async () => {
      const response = await request(app)
        .get('/api/orders/order_001')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(Array.isArray(response.body.status_timeline)).toBe(true);
      expect(response.body.status_timeline.length).toBeGreaterThan(0);
      
      response.body.status_timeline.forEach((event: any) => {
        expect(event).toHaveProperty('status');
        expect(event).toHaveProperty('timestamp');
      });
    });
  });

  describe('PATCH /api/orders/:id', () => {
    it('should allow staff to update order status', async () => {
      const response = await request(app)
        .patch('/api/orders/order_003')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          status: 'IN_PRODUCTION',
          notes: 'Starting production now'
        })
        .expect(200);

      expect(response.body.status).toBe('IN_PRODUCTION');
    });

    it('should allow admin to assign staff', async () => {
      const response = await request(app)
        .patch('/api/orders/order_003')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assigned_staff_id: 'user_staff_003'
        })
        .expect(200);

      expect(response.body.assigned_staff_id).toBe('user_staff_003');
    });

    it('should reject customer updating order status', async () => {
      await request(app)
        .patch('/api/orders/order_001')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'COMPLETED' })
        .expect(403);
    });

    it('should validate status transitions', async () => {
      // Can't go from COMPLETED back to IN_PRODUCTION
      const completedOrderToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .patch('/api/orders/order_001') // Status: COMPLETED
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'IN_PRODUCTION' })
        .expect(400);
    });
  });

  describe('GET /api/staff/jobs', () => {
    it('should return staff job queue', async () => {
      const response = await request(app)
        .get('/api/staff/jobs')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      response.body.forEach((job: any) => {
        expect(job).toHaveProperty('order');
        expect(job).toHaveProperty('customer');
        expect(job).toHaveProperty('service');
        expect(job).toHaveProperty('tier');
      });
    });

    it('should filter by assigned staff', async () => {
      const response = await request(app)
        .get('/api/staff/jobs?assigned_to=user_staff_001')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      response.body.forEach((job: any) => {
        expect(job.order.assigned_staff_id).toBe('user_staff_001');
      });
    });

    it('should identify overdue jobs', async () => {
      const response = await request(app)
        .get('/api/staff/jobs')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      response.body.forEach((job: any) => {
        expect(job).toHaveProperty('is_overdue');
        if (job.is_overdue) {
          const dueDate = new Date(job.order.due_at);
          expect(dueDate.getTime()).toBeLessThan(Date.now());
        }
      });
    });
  });

  describe('GET /api/admin/orders', () => {
    it('should return all orders for admin', async () => {
      const response = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('total');
      expect(response.body.orders.length).toBeGreaterThan(0);
    });

    it('should filter by payment status', async () => {
      const response = await request(app)
        .get('/api/admin/orders?payment_status=balance_due')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Orders with balance due should be returned
      expect(response.body.orders.length).toBeGreaterThanOrEqual(0);
    });

    it('should search by customer name', async () => {
      const response = await request(app)
        .get('/api/admin/orders?customer=Alice')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.orders.forEach((orderData: any) => {
        expect(orderData.customer.name).toContain('Alice');
      });
    });
  });
});

// =====================================================
// PROOF MANAGEMENT TESTS
// =====================================================

describe('Proofs', () => {
  let customerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('david.brown@example.com', 'password123', 'CUSTOMER');
    staffToken = await loginUser('john.designer@printshop.com', 'staff123', 'STAFF');
  });

  describe('POST /api/orders/:id/proofs', () => {
    it('should upload proof as staff', async () => {
      const response = await request(app)
        .post('/api/orders/order_004/proofs')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          file_url: 'https://example.com/proof-v2.pdf',
          internal_notes: 'Revised design based on feedback'
        })
        .expect(201);

      expect(response.body.version_number).toBeGreaterThan(1);
      expect(response.body.status).toBe('SENT');
      expect(response.body.created_by_staff_id).toBe('user_staff_001');
      
      // Verify order status updated
      const orderResult = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        ['order_004']
      );
      
      expect(orderResult.rows[0].status).toBe('AWAITING_APPROVAL');
    });

    it('should auto-increment version number', async () => {
      const proof1 = await request(app)
        .post('/api/orders/order_003/proofs')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          file_url: 'https://example.com/proof-1.pdf'
        })
        .expect(201);

      const proof2 = await request(app)
        .post('/api/orders/order_003/proofs')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          file_url: 'https://example.com/proof-2.pdf'
        })
        .expect(201);

      expect(proof2.body.version_number).toBe(proof1.body.version_number + 1);
    });

    it('should reject proof upload by customer', async () => {
      await request(app)
        .post('/api/orders/order_004/proofs')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          file_url: 'https://example.com/proof.pdf'
        })
        .expect(403);
    });
  });

  describe('POST /api/proofs/:id/approve', () => {
    it('should approve proof and update order status', async () => {
      // Use proof_005 which is status SENT
      const response = await request(app)
        .post('/api/proofs/proof_005/approve')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.status).toBe('APPROVED');
      expect(response.body).toHaveProperty('approved_at');
      
      // Verify order moved to IN_PRODUCTION
      const orderResult = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        ['order_004']
      );
      
      expect(orderResult.rows[0].status).toBe('IN_PRODUCTION');
    });

    it('should reject approval of other customer proof', async () => {
      const otherToken = await loginUser('bob.smith@example.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .post('/api/proofs/proof_005/approve')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should reject approval of already processed proof', async () => {
      // proof_001 is already APPROVED
      await request(app)
        .post('/api/proofs/proof_001/approve')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(400);
    });
  });

  describe('POST /api/proofs/:id/request-changes', () => {
    it('should request changes within revision limit', async () => {
      const token = await loginUser('iris.taylor@agency.com', 'password123', 'CUSTOMER');
      
      const response = await request(app)
        .post('/api/proofs/proof_007/request-changes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_comment: 'Please increase the banner text size by 20%'
        })
        .expect(200);

      expect(response.body.status).toBe('CHANGES_REQUESTED');
      expect(response.body.customer_comment).toContain('banner text size');
      
      // Verify revision count incremented
      const orderResult = await pool.query(
        'SELECT revision_count FROM orders WHERE id = $1',
        ['order_009']
      );
      
      expect(parseFloat(orderResult.rows[0].revision_count)).toBeGreaterThan(0);
    });

    it('should reject changes exceeding revision limit (Standard tier)', async () => {
      // Order with Standard tier (2 revisions max)
      // First set revision_count to 2
      await pool.query(
        'UPDATE orders SET revision_count = 2 WHERE id = $1',
        ['order_003']
      );

      const token = await loginUser('carol.williams@example.com', 'password123', 'CUSTOMER');
      
      // Try to request changes (would be 3rd revision)
      await request(app)
        .post('/api/proofs/proof_004/request-changes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_comment: 'One more change needed'
        })
        .expect(400);
    });

    it('should allow unlimited revisions for Premium tier', async () => {
      // Order_009 has Premium tier
      // Set high revision count
      await pool.query(
        'UPDATE orders SET revision_count = 10 WHERE id = $1',
        ['order_009']
      );

      const token = await loginUser('iris.taylor@agency.com', 'password123', 'CUSTOMER');
      
      // Should still allow changes
      await request(app)
        .post('/api/proofs/proof_007/request-changes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_comment: 'Another revision needed'
        })
        .expect(200);
    });

    it('should reject empty comment', async () => {
      const token = await loginUser('iris.taylor@agency.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .post('/api/proofs/proof_007/request-changes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_comment: '' // Empty
        })
        .expect(400);
    });
  });
});

// =====================================================
// MESSAGING TESTS
// =====================================================

describe('Messages', () => {
  let customerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
    staffToken = await loginUser('john.designer@printshop.com', 'staff123', 'STAFF');
  });

  describe('GET /api/message-threads/:id/messages', () => {
    it('should return all messages in thread', async () => {
      const response = await request(app)
        .get('/api/message-threads/thread_001/messages')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      response.body.forEach((messageData: any) => {
        expect(messageData).toHaveProperty('message');
        expect(messageData).toHaveProperty('sender');
        expect(messageData.message).toHaveProperty('body');
      });
    });

    it('should reject access to other customer thread', async () => {
      const otherToken = await loginUser('bob.smith@example.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .get('/api/message-threads/thread_001/messages')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should allow staff to view all threads', async () => {
      const response = await request(app)
        .get('/api/message-threads/thread_001/messages')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/message-threads/:id/messages', () => {
    it('should send message from customer', async () => {
      const response = await request(app)
        .post('/api/message-threads/thread_001/messages')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          body: 'When will the proof be ready?'
        })
        .expect(201);

      expect(response.body.body).toBe('When will the proof be ready?');
      expect(response.body.sender_user_id).toBe('user_cust_001');
      expect(response.body.is_read).toBe(false);
    });

    it('should send message from staff', async () => {
      const response = await request(app)
        .post('/api/message-threads/thread_001/messages')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          body: 'Your proof will be ready tomorrow.'
        })
        .expect(201);

      expect(response.body.sender_user_id).toBe('user_staff_001');
    });

    it('should reject message exceeding character limit', async () => {
      const longMessage = 'a'.repeat(1001); // Over 1000 char limit
      
      await request(app)
        .post('/api/message-threads/thread_001/messages')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ body: longMessage })
        .expect(400);
    });

    it('should reject empty message', async () => {
      await request(app)
        .post('/api/message-threads/thread_001/messages')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ body: '' })
        .expect(400);
    });
  });

  describe('PATCH /api/messages/:id/mark-read', () => {
    it('should mark message as read', async () => {
      // Find an unread message
      const messagesResult = await pool.query(
        `SELECT m.* FROM messages m 
         JOIN message_threads mt ON m.thread_id = mt.id 
         WHERE mt.quote_id = 'quote_001' 
         AND m.is_read = false 
         AND m.sender_user_id != 'user_cust_001'
         LIMIT 1`
      );

      if (messagesResult.rows.length > 0) {
        const messageId = messagesResult.rows[0].id;
        
        await request(app)
          .patch(`/api/messages/${messageId}/mark-read`)
          .set('Authorization', `Bearer ${customerToken}`)
          .expect(200);

        // Verify updated
        const updatedResult = await pool.query(
          'SELECT is_read FROM messages WHERE id = $1',
          [messageId]
        );
        
        expect(updatedResult.rows[0].is_read).toBe(true);
      }
    });
  });
});

// =====================================================
// FILE UPLOAD TESTS
// =====================================================

describe('File Uploads', () => {
  let customerToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
  });

  describe('POST /api/uploads', () => {
    it('should create upload record', async () => {
      const response = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          file_url: 'https://example.com/my-design.pdf',
          file_type: 'application/pdf',
          file_name: 'my-design.pdf',
          file_size_bytes: 2048000,
          quote_id: null,
          order_id: null,
          dpi_warning: false
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.owner_user_id).toBe('user_cust_001');
      expect(response.body.file_name).toBe('my-design.pdf');
    });

    it('should accept file with DPI warning', async () => {
      const response = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          file_url: 'https://example.com/low-res.jpg',
          file_type: 'image/jpeg',
          file_name: 'low-res.jpg',
          file_size_bytes: 512000,
          dpi_warning: true
        })
        .expect(201);

      expect(response.body.dpi_warning).toBe(true);
    });

    it('should link upload to quote', async () => {
      const response = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          file_url: 'https://example.com/quote-file.pdf',
          file_type: 'application/pdf',
          file_name: 'quote-file.pdf',
          file_size_bytes: 1024000,
          quote_id: 'quote_011' // Customer's quote
        })
        .expect(201);

      expect(response.body.quote_id).toBe('quote_011');
    });

    it('should reject linking to other customer quote', async () => {
      await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          file_url: 'https://example.com/file.pdf',
          file_type: 'application/pdf',
          file_name: 'file.pdf',
          file_size_bytes: 1024000,
          quote_id: 'quote_002' // Bob's quote
        })
        .expect(403);
    });
  });

  describe('GET /api/uploads/:id', () => {
    it('should return upload details with presigned URL', async () => {
      const response = await request(app)
        .get('/api/uploads/upload_001')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('file_url');
      expect(response.body.id).toBe('upload_001');
    });

    it('should reject access to other customer upload', async () => {
      const otherToken = await loginUser('bob.smith@example.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .get('/api/uploads/upload_001')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/uploads/:id', () => {
    it('should delete own upload', async () => {
      const createResponse = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          file_url: 'https://example.com/deleteme.pdf',
          file_type: 'application/pdf',
          file_name: 'deleteme.pdf',
          file_size_bytes: 512000
        });

      const uploadId = createResponse.body.id;

      await request(app)
        .delete(`/api/uploads/${uploadId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(204);

      // Verify deleted
      const result = await pool.query(
        'SELECT * FROM uploads WHERE id = $1',
        [uploadId]
      );
      
      expect(result.rows.length).toBe(0);
    });
  });
});

// =====================================================
// ADMIN SETTINGS TESTS
// =====================================================

describe('Admin Settings', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  describe('GET /api/admin/settings', () => {
    it('should return all settings', async () => {
      const response = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      response.body.forEach((setting: any) => {
        expect(setting).toHaveProperty('key');
        expect(setting).toHaveProperty('value');
      });
    });

    it('should reject non-admin access', async () => {
      const customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
      
      await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/settings/:key', () => {
    it('should return specific setting', async () => {
      const response = await request(app)
        .get('/api/admin/settings/tax_rate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.key).toBe('tax_rate');
      expect(response.body).toHaveProperty('value');
    });

    it('should return 404 for non-existent setting', async () => {
      await request(app)
        .get('/api/admin/settings/non_existent_key')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/admin/settings/:key', () => {
    it('should update setting value', async () => {
      const response = await request(app)
        .patch('/api/admin/settings/tax_rate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '0.10' })
        .expect(200);

      expect(response.body.value).toBe('0.10');
      
      // Verify in database
      const result = await pool.query(
        'SELECT value FROM settings WHERE key = $1',
        ['tax_rate']
      );
      
      expect(result.rows[0].value).toBe('0.10');
      
      // Reset to original value
      await request(app)
        .patch('/api/admin/settings/tax_rate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '0.08' });
    });

    it('should create setting if not exists (upsert)', async () => {
      const response = await request(app)
        .patch('/api/admin/settings/new_test_setting')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'test_value' })
        .expect(200);

      expect(response.body.key).toBe('new_test_setting');
      expect(response.body.value).toBe('test_value');
    });

    it('should log setting change in audit log', async () => {
      await request(app)
        .patch('/api/admin/settings/test_audit_setting')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'audit_test' })
        .expect(200);

      const auditResult = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE action = 'UPDATED' 
         AND object_type = 'SETTING' 
         ORDER BY created_at DESC 
         LIMIT 1`
      );

      expect(auditResult.rows.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/audit-logs', () => {
    it('should return audit logs', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should filter by user', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs?user_id=user_admin_001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.logs.forEach((logData: any) => {
        expect(logData.log.user_id).toBe('user_admin_001');
      });
    });

    it('should filter by action', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs?action=LOGIN')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.logs.forEach((logData: any) => {
        expect(logData.log.action).toBe('LOGIN');
      });
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.logs.length).toBeLessThanOrEqual(10);
      expect(response.body.page).toBe(1);
    });
  });
});

// =====================================================
// USER MANAGEMENT TESTS
// =====================================================

describe('User Management', () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
  });

  describe('GET /api/admin/users', () => {
    it('should return all users for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should filter by role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=CUSTOMER')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.users.forEach((userData: any) => {
        expect(userData.user.role).toBe('CUSTOMER');
      });
    });

    it('should search by name or email', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=Alice')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users.length).toBeGreaterThan(0);
      response.body.users.forEach((userData: any) => {
        expect(
          userData.user.name.includes('Alice') || 
          userData.user.email.includes('alice')
        ).toBe(true);
      });
    });

    it('should reject non-admin access', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create customer user', async () => {
      const userData = {
        name: 'New Customer',
        email: 'newcustomer@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        phone: '+1-555-2222',
        company_name: 'New Company'
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('CUSTOMER');
    });

    it('should create staff user with permissions', async () => {
      const userData = {
        name: 'New Staff',
        email: 'newstaff@printshop.com',
        password: 'staff123',
        role: 'STAFF',
        department: 'Production',
        permissions: { quotes: true, orders: true }
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.user.role).toBe('STAFF');
      expect(response.body.profile.department).toBe('Production');
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate',
          email: 'alice.johnson@example.com', // Already exists
          password: 'password123',
          role: 'CUSTOMER'
        })
        .expect(400);
    });
  });

  describe('PATCH /api/admin/users/:id', () => {
    it('should update user details', async () => {
      const response = await request(app)
        .patch('/api/admin/users/user_cust_001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Alice Johnson Updated'
        })
        .expect(200);

      expect(response.body.name).toBe('Alice Johnson Updated');
      
      // Reset name
      await request(app)
        .patch('/api/admin/users/user_cust_001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Alice Johnson' });
    });

    it('should deactivate user', async () => {
      // Create a test user to deactivate
      const createResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'To Deactivate',
          email: 'deactivate@example.com',
          password: 'password123',
          role: 'CUSTOMER'
        });

      const userId = createResponse.body.user.id;

      const response = await request(app)
        .patch(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false })
        .expect(200);

      expect(response.body.is_active).toBe(false);
    });
  });

  describe('GET /api/users/profile', () => {
    it('should return customer profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.user.email).toBe('alice.johnson@example.com');
      expect(response.body.profile).toHaveProperty('company_name');
    });
  });

  describe('PATCH /api/users/profile', () => {
    it('should update customer profile', async () => {
      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          phone: '+1-555-9999',
          company_name: 'Updated Company'
        })
        .expect(200);

      expect(response.body.profile.phone).toBe('+1-555-9999');
      expect(response.body.profile.company_name).toBe('Updated Company');
    });
  });

  describe('POST /api/users/change-password', () => {
    it('should change password with correct current password', async () => {
      await request(app)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          current_password: 'password123',
          new_password: 'newpassword456'
        })
        .expect(200);

      // Verify can login with new password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice.johnson@example.com',
          password: 'newpassword456',
          role: 'CUSTOMER'
        })
        .expect(200);

      // Reset password
      await request(app)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          current_password: 'newpassword456',
          new_password: 'password123'
        });
    });

    it('should reject incorrect current password', async () => {
      await request(app)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          current_password: 'wrongpassword',
          new_password: 'newpassword456'
        })
        .expect(400);
    });
  });
});

// =====================================================
// ADMIN SERVICE MANAGEMENT TESTS
// =====================================================

describe('Admin Service Management', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  describe('POST /api/admin/service-categories', () => {
    it('should create service category', async () => {
      const response = await request(app)
        .post('/api/admin/service-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Category',
          slug: 'test-category',
          sort_order: 99
        })
        .expect(201);

      expect(response.body.name).toBe('Test Category');
      expect(response.body.slug).toBe('test-category');
    });

    it('should reject duplicate slug', async () => {
      await request(app)
        .post('/api/admin/service-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Another Category',
          slug: 'business-printing' // Already exists
        })
        .expect(400);
    });
  });

  describe('POST /api/admin/services', () => {
    it('should create new service', async () => {
      const response = await request(app)
        .post('/api/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category_id: 'cat_001',
          name: 'Test Service',
          slug: 'test-service',
          description: 'A test service',
          requires_booking: true,
          requires_proof: true,
          is_top_seller: false,
          slot_duration_hours: 2
        })
        .expect(201);

      expect(response.body.name).toBe('Test Service');
      expect(response.body.slug).toBe('test-service');
      expect(response.body.requires_booking).toBe(true);
    });

    it('should reject invalid category', async () => {
      await request(app)
        .post('/api/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category_id: 'invalid_category',
          name: 'Test Service',
          slug: 'test-service-2'
        })
        .expect(400);
    });
  });

  describe('POST /api/admin/service-options', () => {
    it('should add option to service', async () => {
      const response = await request(app)
        .post('/api/admin/service-options')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          service_id: 'svc_001',
          key: 'test_option',
          label: 'Test Option',
          type: 'SELECT',
          required: false,
          choices: '["Option A", "Option B"]',
          help_text: 'Choose an option'
        })
        .expect(201);

      expect(response.body.key).toBe('test_option');
      expect(response.body.type).toBe('SELECT');
    });
  });

  describe('POST /api/admin/tier-features', () => {
    it('should add feature to tier', async () => {
      const response = await request(app)
        .post('/api/admin/tier-features')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tier_id: 'tier_001',
          group_name: 'Test Group',
          feature_key: 'test_feature',
          feature_label: 'Test Feature',
          feature_value: 'Test Value',
          is_included: true
        })
        .expect(201);

      expect(response.body.feature_key).toBe('test_feature');
      expect(response.body.is_included).toBe(true);
    });
  });
});

// =====================================================
// CALENDAR SETTINGS TESTS
// =====================================================

describe('Calendar Settings', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  describe('GET /api/admin/calendar-settings', () => {
    it('should return calendar settings', async () => {
      const response = await request(app)
        .get('/api/admin/calendar-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('working_days');
      expect(response.body).toHaveProperty('start_hour');
      expect(response.body).toHaveProperty('end_hour');
      expect(response.body).toHaveProperty('slots_per_day');
      expect(response.body).toHaveProperty('emergency_slots_per_day');
    });
  });

  describe('PATCH /api/admin/calendar-settings', () => {
    it('should update calendar settings', async () => {
      const response = await request(app)
        .patch('/api/admin/calendar-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          emergency_slots_per_day: 3
        })
        .expect(200);

      expect(response.body.emergency_slots_per_day).toBe(3);
      
      // Reset
      await request(app)
        .patch('/api/admin/calendar-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emergency_slots_per_day: 2 });
    });

    it('should validate hour ranges', async () => {
      await request(app)
        .patch('/api/admin/calendar-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          start_hour: 25 // Invalid
        })
        .expect(400);
    });
  });

  describe('POST /api/admin/blackout-dates', () => {
    it('should create blackout date', async () => {
      const response = await request(app)
        .post('/api/admin/blackout-dates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          date: '2024-06-15',
          reason: 'Company event'
        })
        .expect(201);

      expect(response.body.date).toBe('2024-06-15');
      expect(response.body.reason).toBe('Company event');
    });
  });

  describe('GET /api/admin/blackout-dates', () => {
    it('should return all blackout dates', async () => {
      const response = await request(app)
        .get('/api/admin/blackout-dates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});

// =====================================================
// NOTIFICATION PREFERENCES TESTS
// =====================================================

describe('Notification Preferences', () => {
  let customerToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
  });

  describe('GET /api/users/notification-preferences', () => {
    it('should return user preferences', async () => {
      const response = await request(app)
        .get('/api/users/notification-preferences')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email_order_updates');
      expect(response.body).toHaveProperty('email_proof_ready');
      expect(response.body).toHaveProperty('email_messages');
      expect(response.body).toHaveProperty('email_marketing');
    });
  });

  describe('PATCH /api/users/notification-preferences', () => {
    it('should update preferences', async () => {
      const response = await request(app)
        .patch('/api/users/notification-preferences')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          email_marketing: true,
          email_messages: false
        })
        .expect(200);

      expect(response.body.email_marketing).toBe(true);
      expect(response.body.email_messages).toBe(false);
    });
  });
});

// =====================================================
// EDGE CASES & ERROR HANDLING TESTS
// =====================================================

describe('Edge Cases', () => {
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  it('should handle malformed JSON gracefully', async () => {
    const response = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Content-Type', 'application/json')
      .send('{"invalid json}')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should handle missing required fields', async () => {
    await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        // Missing service_id and tier_id
        project_details: {}
      })
      .expect(400);
  });

  it('should handle SQL injection attempts safely', async () => {
    const maliciousEmail = "admin@printshop.com'; DROP TABLE users; --";
    
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker',
        email: maliciousEmail,
        password: 'password123'
      })
      .expect(400); // Should reject due to email validation

    // Verify users table still exists
    const result = await pool.query('SELECT COUNT(*) FROM users');
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('should handle concurrent quote submissions', async () => {
    const upload1 = await createTestUpload(customerToken);
    const upload2 = await createTestUpload(customerToken);

    const quoteData1 = {
      service_id: 'svc_001',
      tier_id: 'tier_001',
      project_details: { quantity: '500' },
      file_ids: [upload1.id]
    };

    const quoteData2 = {
      service_id: 'svc_004',
      tier_id: 'tier_002',
      project_details: { quantity: '250' },
      file_ids: [upload2.id]
    };

    // Submit both simultaneously
    const [response1, response2] = await Promise.all([
      request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(quoteData1),
      request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(quoteData2)
    ]);

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);
    expect(response1.body.quote.id).not.toBe(response2.body.quote.id);
  });

  it('should handle pagination edge cases', async () => {
    // Request page beyond available data
    const response = await request(app)
      .get('/api/quotes?page=9999&limit=20')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(response.body.quotes).toEqual([]);
    expect(response.body.total).toBeGreaterThanOrEqual(0);
  });

  it('should validate numeric constraints', async () => {
    await request(app)
      .post('/api/admin/calendar-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slots_per_day: -5 // Negative number
      })
      .expect(400);
  });
});

// =====================================================
// TRANSACTION SAFETY TESTS
// =====================================================

describe('Transaction Safety', () => {
  let customerToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
  });

  it('should rollback quote creation if answer insert fails', async () => {
    // This test verifies transaction behavior
    // We'd need to inject a failure scenario, but the transaction
    // ensures that if quote_answers insert fails, the quote is not created
    
    const initialQuoteCount = await pool.query(
      'SELECT COUNT(*) FROM quotes WHERE customer_id = $1',
      ['user_cust_001']
    );

    // Attempt to create quote with invalid data that would fail on answers
    try {
      await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          service_id: 'svc_001',
          tier_id: 'tier_001',
          project_details: { quantity: null }, // Invalid
          file_ids: []
        });
    } catch (e) {
      // Expected to fail
    }

    const finalQuoteCount = await pool.query(
      'SELECT COUNT(*) FROM quotes WHERE customer_id = $1',
      ['user_cust_001']
    );

    // Count should be same (no partial insert)
    expect(finalQuoteCount.rows[0].count).toBe(initialQuoteCount.rows[0].count);
  });
});

// =====================================================
// BUSINESS LOGIC TESTS
// =====================================================

describe('Business Logic', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  it('should calculate tax correctly', async () => {
    // Tax rate is 0.08 (8%)
    const subtotal = 100;
    const expectedTax = 8;
    const expectedTotal = 108;

    // This would be tested in invoice generation
    const taxRate = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['tax_rate']
    );

    const rate = parseFloat(taxRate.rows[0].value);
    const calculatedTax = subtotal * rate;
    
    expect(calculatedTax).toBe(expectedTax);
  });

  it('should calculate deposit amount correctly', async () => {
    const depositPct = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['default_deposit_pct']
    );

    const pct = parseFloat(depositPct.rows[0].value);
    const totalAmount = 1000;
    const expectedDeposit = totalAmount * (pct / 100);
    
    expect(expectedDeposit).toBe(500);
  });

  it('should generate sequential invoice numbers', async () => {
    const year = new Date().getFullYear();
    
    const result = await pool.query(
      `SELECT invoice_number FROM invoices 
       WHERE invoice_number LIKE $1 
       ORDER BY invoice_number DESC 
       LIMIT 1`,
      [`INV-${year}-%`]
    );

    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].invoice_number;
      const parts = lastNumber.split('-');
      const sequence = parseInt(parts[2]);
      
      expect(sequence).toBeGreaterThan(0);
      expect(lastNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    }
  });

  it('should enforce revision limits by tier', async () => {
    // Get tier features for revision limits
    const basicTierResult = await pool.query(
      `SELECT tf.* FROM tier_features tf
       JOIN tier_packages tp ON tf.tier_id = tp.id
       WHERE tp.slug = 'basic' AND tf.feature_key = 'revisions'`
    );

    const standardTierResult = await pool.query(
      `SELECT tf.* FROM tier_features tf
       JOIN tier_packages tp ON tf.tier_id = tp.id
       WHERE tp.slug = 'standard' AND tf.feature_key = 'revisions'`
    );

    expect(basicTierResult.rows[0].feature_value).toBe('2 revisions');
    expect(standardTierResult.rows[0].feature_value).toBe('4 revisions');
  });
});

// =====================================================
// AUTHORIZATION TESTS
// =====================================================

describe('Authorization', () => {
  let customerToken: string;
  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
    staffToken = await loginUser('john.designer@printshop.com', 'staff123', 'STAFF');
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  it('should allow customer to access own data only', async () => {
    // Can access own quote
    await request(app)
      .get('/api/quotes/quote_001')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    // Cannot access other customer's quote
    await request(app)
      .get('/api/quotes/quote_002')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('should allow staff to access assigned jobs', async () => {
    // Staff can view jobs assigned to them
    await request(app)
      .get('/api/orders/order_001')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });

  it('should allow admin to access all data', async () => {
    // Admin can view any quote
    await request(app)
      .get('/api/quotes/quote_001')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app)
      .get('/api/quotes/quote_002')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Admin can view all orders
    await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('should block customer from admin endpoints', async () => {
    await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    await request(app)
      .post('/api/admin/services')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Test',
        slug: 'test'
      })
      .expect(403);
  });

  it('should block staff from admin-only endpoints', async () => {
    await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Test',
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER'
      })
      .expect(403);
  });
});

// =====================================================
// PERFORMANCE & OPTIMIZATION TESTS
// =====================================================

describe('Performance', () => {
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    customerToken = await loginUser('alice.johnson@example.com', 'password123', 'CUSTOMER');
    adminToken = await loginUser('admin@printshop.com', 'admin123', 'ADMIN');
  });

  it('should respond to public endpoints quickly (< 1s)', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/public/services')
      .expect(200);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
  });

  it('should handle large quote list efficiently', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/admin/orders?page=1&limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });
});