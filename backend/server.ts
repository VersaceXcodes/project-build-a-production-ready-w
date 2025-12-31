import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { createServer } from 'http';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      file?: Express.Multer.File;
    }
  }
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432 } = process.env;
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

console.log('DB Config:', { 
  host: PGHOST, 
  database: PGDATABASE, 
  user: PGUSER, 
  port: PGPORT,
  ssl: true
});

const pool = new Pool(
  (DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: { require: true },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      }
    : {
        host: PGHOST || "ep-ancient-dream-abbsot9k-pooler.eu-west-2.aws.neon.tech",
        database: PGDATABASE || "neondb",
        user: PGUSER || "neondb_owner",
        password: PGPASSWORD || "npg_jAS3aITLC5DX",
        port: Number(PGPORT),
        ssl: { require: true },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      }) as any
);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const isDist = path.basename(__dirname) === 'dist';
const publicDir = isDist ? path.resolve(__dirname, '..', 'public') : path.resolve(__dirname, 'public');
const storageDir = path.resolve(__dirname, 'storage');

if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));
app.use(express.static(publicDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const result = await pool.query('SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = $1', [decoded.user_id]);
    if (result.rows.length === 0 || !result.rows[0].is_active) return res.status(401).json({ message: 'Invalid token' });
    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Insufficient permissions' });
  next();
};

const createAuditLog = async (userId, action, objectType, objectId, metadata = null, ipAddress = null) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, action, object_type, object_id, metadata, ip_address, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [uuidv4(), userId, action, objectType, objectId, metadata ? JSON.stringify(metadata) : null, ipAddress, new Date().toISOString()]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

const emitEvent = (channel, data) => {
  io.emit(channel, data);
};

// Check if email is available for registration
app.post('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const available = result.rows.length === 0;

    res.json({ available });
  } catch (error: any) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, password, phone, company_name, address } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Email already exists' });
    }

    const userId = uuidv4();
    const userResult = await client.query(
      'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [userId, name.trim(), email.toLowerCase().trim(), password, 'CUSTOMER', true, new Date().toISOString(), new Date().toISOString()]
    );
    
    const profileId = uuidv4();
    const profileResult = await client.query(
      'INSERT INTO customer_profiles (id, user_id, phone, company_name, address, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [profileId, userId, phone || null, company_name || null, address || null, new Date().toISOString(), new Date().toISOString()]
    );
    
    await client.query(
      'INSERT INTO notification_preferences (id, user_id, email_order_updates, email_proof_ready, email_messages, email_marketing, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [uuidv4(), userId, true, true, true, false, new Date().toISOString()]
    );
    
    await client.query('COMMIT');
    
    // Create audit log after commit to ensure user exists for foreign key constraint
    await createAuditLog(userId, 'REGISTER', 'USER', userId, null, req.ip);

    const token = jwt.sign({ user_id: userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: userResult.rows[0], customer_profile: profileResult.rows[0], token });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Register error:', error);
    res.status(500).json({ message: `Internal server error: ${error.message}` });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) return res.status(400).json({ message: 'Email, password, and role required' });
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email.toLowerCase().trim(), role]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const user = result.rows[0];
    if (password !== user.password_hash) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.is_active) return res.status(401).json({ message: 'Account inactive' });
    let profile = null;
    if (role === 'CUSTOMER') {
      const profileRes = await pool.query('SELECT * FROM customer_profiles WHERE user_id = $1', [user.id]);
      profile = profileRes.rows[0] || null;
    } else if (role === 'STAFF' || role === 'ADMIN') {
      const profileRes = await pool.query('SELECT * FROM staff_profiles WHERE user_id = $1', [user.id]);
      profile = profileRes.rows[0] || null;
    }
    const token = jwt.sign({ user_id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    await createAuditLog(user.id, 'LOGIN', 'USER', user.id, { role }, req.ip);
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, profile, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length > 0) {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      await pool.query(
        'INSERT INTO password_reset_tokens (id, user_id, token, expires_at, is_used, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), result.rows[0].id, token, expiresAt, false, new Date().toISOString()]
      );
      console.log(`Password reset token for ${email}: ${token}`);
    }
    res.json({ message: 'If email exists, reset link sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and password required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    const result = await pool.query('SELECT * FROM password_reset_tokens WHERE token = $1 AND is_used = false', [token]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'Invalid or expired token' });
    const resetToken = result.rows[0];
    if (new Date(resetToken.expires_at) < new Date()) return res.status(400).json({ message: 'Token expired' });
    await pool.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [password, new Date().toISOString(), resetToken.user_id]);
    await pool.query('UPDATE password_reset_tokens SET is_used = true WHERE id = $1', [resetToken.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    let profile = null;
    if (req.user.role === 'CUSTOMER') {
      const profileRes = await pool.query('SELECT * FROM customer_profiles WHERE user_id = $1', [req.user.id]);
      profile = profileRes.rows[0] || null;
    } else if (req.user.role === 'STAFF' || req.user.role === 'ADMIN') {
      const profileRes = await pool.query('SELECT * FROM staff_profiles WHERE user_id = $1', [req.user.id]);
      profile = profileRes.rows[0] || null;
    }
    res.json({ user: req.user, profile });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/public/services', async (req, res) => {
  try {
    const { category, search, is_top_seller } = req.query;
    let query = 'SELECT s.*, c.name as category_name FROM services s JOIN service_categories c ON s.category_id = c.id WHERE s.is_active = true';
    const params = [];
    if (category) {
      params.push(category);
      query += ` AND c.slug = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (s.name ILIKE $${params.length} OR s.description ILIKE $${params.length})`;
    }
    if (is_top_seller !== undefined) {
      params.push(is_top_seller === 'true');
      query += ` AND s.is_top_seller = $${params.length}`;
    }
    query += ' ORDER BY s.name';
    const result = await pool.query(query, params);
    const categories = await pool.query('SELECT * FROM service_categories WHERE is_active = true ORDER BY sort_order');
    res.json({ services: result.rows, categories: categories.rows });
  } catch (error) {
    console.error('List services error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/public/services/:service_slug', async (req, res) => {
  try {
    const { service_slug } = req.params;
    const serviceRes = await pool.query('SELECT * FROM services WHERE slug = $1 AND is_active = true', [service_slug]);
    if (serviceRes.rows.length === 0) return res.status(404).json({ message: 'Service not found' });
    const service = serviceRes.rows[0];
    const categoryRes = await pool.query('SELECT * FROM service_categories WHERE id = $1', [service.category_id]);
    const optionsRes = await pool.query('SELECT * FROM service_options WHERE service_id = $1 AND is_active = true ORDER BY sort_order', [service.id]);
    const examplesRes = await pool.query("SELECT * FROM gallery_images WHERE is_active = true AND categories LIKE $1 LIMIT 10", [`%${service.slug}%`]);
    res.json({ service, category: categoryRes.rows[0], service_options: optionsRes.rows, examples: examplesRes.rows });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/public/service-categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM service_categories WHERE is_active = true ORDER BY sort_order');
    res.json(result.rows);
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/public/tiers', async (req, res) => {
  try {
    const tiers = await pool.query('SELECT * FROM tier_packages WHERE is_active = true ORDER BY sort_order');
    const result = [];
    for (const tier of tiers.rows) {
      const features = await pool.query('SELECT * FROM tier_features WHERE tier_id = $1 ORDER BY group_name, sort_order', [tier.id]);
      result.push({ tier, features: features.rows });
    }
    res.json(result);
  } catch (error) {
    console.error('List tiers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/public/gallery', async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '20');
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM gallery_images WHERE is_active = true';
    const params: (string | number)[] = [];

    if (category) {
      // First, get the category ID from the slug
      const categoryResult = await pool.query(
        'SELECT id FROM service_categories WHERE slug = $1',
        [category]
      );

      if (categoryResult.rows.length > 0) {
        const categoryId = categoryResult.rows[0].id;

        // Get all service slugs in this category
        const servicesResult = await pool.query(
          'SELECT slug FROM services WHERE category_id = $1 AND is_active = true',
          [categoryId]
        );

        if (servicesResult.rows.length > 0) {
          // Build OR conditions for each service slug
          const serviceSlugs = servicesResult.rows.map((r: { slug: string }) => r.slug);
          const conditions = serviceSlugs.map((slug: string, idx: number) => {
            params.push(`%${slug}%`);
            return `categories LIKE $${params.length}`;
          });
          query += ` AND (${conditions.join(' OR ')})`;
        } else {
          // No services in this category, return empty
          return res.json({ images: [], total: 0, page: page, total_pages: 0 });
        }
      } else {
        // Category not found, try direct match on the category slug itself
        params.push(`%${category}%`);
        query += ` AND categories LIKE $${params.length}`;
      }
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    query += ' ORDER BY sort_order, created_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ images: result.rows, total: parseInt(totalRes.rows[0].count), page: page, total_pages: Math.ceil(parseInt(totalRes.rows[0].count) / limit) });
  } catch (error: any) {
    const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    console.error('List gallery error:', errMsg, error?.stack);
    res.status(500).json({ message: `Internal server error: ${errMsg}` });
  }
});

app.get('/api/public/case-studies/:case_study_slug', async (req, res) => {
  try {
    const { case_study_slug } = req.params;
    const result = await pool.query('SELECT cs.*, s.name as service_name, t.name as tier_name, g.image_url FROM case_studies cs JOIN services s ON cs.service_id = s.id JOIN tier_packages t ON cs.tier_id = t.id JOIN gallery_images g ON cs.gallery_image_id = g.id WHERE cs.slug = $1 AND cs.is_published = true', [case_study_slug]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Case study not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get case study error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/public/marketing-content', async (req, res) => {
  try {
    const { page_key } = req.query;
    if (!page_key) return res.status(400).json({ message: 'page_key required' });
    const result = await pool.query('SELECT * FROM marketing_content WHERE page_key = $1', [page_key]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get marketing content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/public/contact-inquiry', async (req, res) => {
  try {
    const { name, email, phone, service_interested_in, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ message: 'Name, email, and message required' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO contact_inquiries (id, name, email, phone, service_interested_in, message, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, email, phone || null, service_interested_in || null, message, 'NEW', new Date().toISOString()]
    );
    res.status(201).json({ message: 'Inquiry submitted successfully' });
  } catch (error) {
    console.error('Submit inquiry error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/quotes', authenticateToken, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = 20;
    const offset = (page - 1) * limit;
    let query = `SELECT q.*,
      s.id as service_id_ref, s.name as service_name, s.slug as service_slug, s.description as service_description,
      t.id as tier_id_ref, t.name as tier_name, t.description as tier_description
      FROM quotes q
      JOIN services s ON q.service_id = s.id
      JOIN tier_packages t ON q.tier_id = t.id
      WHERE q.customer_id = $1`;
    const params: any[] = [req.user.id];
    if (status) {
      params.push(status);
      query += ` AND q.status = $${params.length}`;
    }
    const countQuery = query.replace(/SELECT q\.\*[\s\S]*?FROM quotes q/, 'SELECT COUNT(*) FROM quotes q');
    const totalRes = await pool.query(countQuery, params);
    query += ' ORDER BY q.created_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    // Transform flat rows into nested structure for frontend
    const quotes = result.rows.map((row: any) => ({
      quote: {
        id: row.id,
        customer_id: row.customer_id,
        service_id: row.service_id,
        tier_id: row.tier_id,
        status: row.status,
        estimate_subtotal: row.estimate_subtotal,
        final_subtotal: row.final_subtotal,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      service: {
        id: row.service_id_ref,
        name: row.service_name,
        slug: row.service_slug,
        description: row.service_description
      },
      tier: {
        id: row.tier_id_ref,
        name: row.tier_name,
        description: row.tier_description
      }
    }));
    res.json({ quotes, total: parseInt(totalRes.rows[0].count) });
  } catch (error: any) {
    console.error('List quotes error:', error?.message, error?.stack);
    res.status(500).json({ message: `Internal server error: ${error?.message || 'Unknown error'}` });
  }
});

// =====================================================
// GUEST QUOTE ENDPOINTS (No Auth Required)
// =====================================================

// Create guest quote (no authentication required)
app.post('/api/guest/quotes', async (req, res) => {
  try {
    const { service_id, tier_id, project_details, notes, guest_name, guest_email, guest_phone, guest_company_name } = req.body;
    
    // Validation
    if (!service_id || !tier_id) {
      return res.status(400).json({ message: 'service_id and tier_id required' });
    }
    if (!guest_name || !guest_email) {
      return res.status(400).json({ message: 'guest_name and guest_email required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    const quoteId = uuidv4();
    const threadId = uuidv4();
    
    // Create guest quote
    await pool.query(
      'INSERT INTO quotes (id, customer_id, service_id, tier_id, status, estimate_subtotal, final_subtotal, notes, is_guest, guest_name, guest_email, guest_phone, guest_company_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
      [quoteId, null, service_id, tier_id, 'SUBMITTED', null, null, notes || null, true, guest_name, guest_email, guest_phone || null, guest_company_name || null, new Date().toISOString(), new Date().toISOString()]
    );
    
    // Create message thread
    await pool.query(
      'INSERT INTO message_threads (id, quote_id, order_id, created_at) VALUES ($1, $2, $3, $4)', 
      [threadId, quoteId, null, new Date().toISOString()]
    );
    
    // Save project details as quote answers
    if (project_details && typeof project_details === 'object') {
      for (const [key, value] of Object.entries(project_details)) {
        await pool.query(
          'INSERT INTO quote_answers (id, quote_id, option_key, value, created_at) VALUES ($1, $2, $3, $4, $5)',
          [uuidv4(), quoteId, key, String(value), new Date().toISOString()]
        );
      }
    }
    
    // Generate magic link token (expires in 7 days)
    const token = uuidv4() + '-' + Date.now();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    await pool.query(
      'INSERT INTO guest_quote_tokens (id, quote_id, token, expires_at, is_used, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), quoteId, token, expiresAt, false, new Date().toISOString()]
    );
    
    // Fetch complete quote data
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [quoteId]);
    const answersRes = await pool.query('SELECT * FROM quote_answers WHERE quote_id = $1', [quoteId]);
    
    // Emit event for admin notifications
    emitEvent('quote/status_updated', {
      event_type: 'guest_quote_submitted',
      timestamp: new Date().toISOString(),
      quote_id: quoteId,
      is_guest: true,
      guest_email,
      old_status: null,
      new_status: 'SUBMITTED'
    });
    
    res.status(201).json({
      quote: quoteRes.rows[0],
      quote_answers: answersRes.rows,
      magic_link_token: token,
      message: 'Quote submitted successfully. Check your email for the magic link.'
    });
  } catch (error: any) {
    console.error('Create guest quote error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get guest quote by magic link token
app.get('/api/guest/quotes/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find and validate token
    const tokenRes = await pool.query(
      'SELECT * FROM guest_quote_tokens WHERE token = $1',
      [token]
    );
    
    if (tokenRes.rows.length === 0) {
      return res.status(404).json({ message: 'Invalid or expired link' });
    }
    
    const tokenData = tokenRes.rows[0];
    
    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(410).json({ message: 'This link has expired' });
    }
    
    // Fetch quote data
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [tokenData.quote_id]);
    
    if (quoteRes.rows.length === 0) {
      return res.status(404).json({ message: 'Quote not found' });
    }
    
    const quote = quoteRes.rows[0];
    
    // Only allow access to guest quotes via this endpoint
    if (!quote.is_guest) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Fetch related data
    const serviceRes = await pool.query('SELECT * FROM services WHERE id = $1', [quote.service_id]);
    const tierRes = await pool.query('SELECT * FROM tier_packages WHERE id = $1', [quote.tier_id]);
    const answersRes = await pool.query('SELECT * FROM quote_answers WHERE quote_id = $1', [tokenData.quote_id]);
    
    res.json({
      quote,
      service: serviceRes.rows[0],
      tier: tierRes.rows[0],
      quote_answers: answersRes.rows,
      token_valid: true
    });
  } catch (error: any) {
    console.error('Get guest quote error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update guest quote status (approve/reject via magic link)
app.patch('/api/guest/quotes/:token/status', async (req, res) => {
  try {
    const { token } = req.params;
    const { status } = req.body;
    
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Status must be APPROVED or REJECTED' });
    }
    
    // Validate token
    const tokenRes = await pool.query(
      'SELECT * FROM guest_quote_tokens WHERE token = $1',
      [token]
    );
    
    if (tokenRes.rows.length === 0) {
      return res.status(404).json({ message: 'Invalid or expired link' });
    }
    
    const tokenData = tokenRes.rows[0];
    
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(410).json({ message: 'This link has expired' });
    }
    
    // Update quote status
    await pool.query(
      'UPDATE quotes SET status = $1, updated_at = $2 WHERE id = $3 AND is_guest = true',
      [status, new Date().toISOString(), tokenData.quote_id]
    );
    
    const updatedQuote = await pool.query('SELECT * FROM quotes WHERE id = $1', [tokenData.quote_id]);
    
    emitEvent('quote/status_updated', {
      event_type: 'guest_quote_status_updated',
      timestamp: new Date().toISOString(),
      quote_id: tokenData.quote_id,
      new_status: status,
      is_guest: true
    });
    
    res.json({
      quote: updatedQuote.rows[0],
      message: `Quote ${status.toLowerCase()} successfully`
    });
  } catch (error: any) {
    console.error('Update guest quote status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/quotes', authenticateToken, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    const { service_id, tier_id, project_details, file_ids, notes } = req.body;
    if (!service_id || !tier_id) return res.status(400).json({ message: 'service_id and tier_id required' });
    const quoteId = uuidv4();
    const threadId = uuidv4();
    await pool.query(
      'INSERT INTO quotes (id, customer_id, service_id, tier_id, status, estimate_subtotal, final_subtotal, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [quoteId, req.user.id, service_id, tier_id, 'SUBMITTED', null, null, notes || null, new Date().toISOString(), new Date().toISOString()]
    );
    await pool.query('INSERT INTO message_threads (id, quote_id, order_id, created_at) VALUES ($1, $2, $3, $4)', [threadId, quoteId, null, new Date().toISOString()]);
    if (project_details && typeof project_details === 'object') {
      for (const [key, value] of Object.entries(project_details)) {
        await pool.query(
          'INSERT INTO quote_answers (id, quote_id, option_key, value, created_at) VALUES ($1, $2, $3, $4, $5)',
          [uuidv4(), quoteId, key, String(value), new Date().toISOString()]
        );
      }
    }
    if (file_ids && Array.isArray(file_ids)) {
      for (const fileId of file_ids) {
        await pool.query('UPDATE uploads SET quote_id = $1 WHERE id = $2 AND owner_user_id = $3', [quoteId, fileId, req.user.id]);
      }
    }
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [quoteId]);
    const answersRes = await pool.query('SELECT * FROM quote_answers WHERE quote_id = $1', [quoteId]);
    await createAuditLog(req.user.id, 'CREATE', 'QUOTE', quoteId, { service_id, tier_id }, req.ip);
    emitEvent('quote/status_updated', { event_type: 'quote_status_updated', timestamp: new Date().toISOString(), quote_id: quoteId, customer_id: req.user.id, old_status: null, new_status: 'SUBMITTED' });
    res.status(201).json({ quote: quoteRes.rows[0], quote_answers: answersRes.rows });
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/quotes/:quote_id', authenticateToken, async (req, res) => {
  try {
    const { quote_id } = req.params;
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [quote_id]);
    if (quoteRes.rows.length === 0) return res.status(404).json({ message: 'Quote not found' });
    const quote = quoteRes.rows[0];
    if (req.user.role === 'CUSTOMER' && quote.customer_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    const serviceRes = await pool.query('SELECT * FROM services WHERE id = $1', [quote.service_id]);
    const tierRes = await pool.query('SELECT * FROM tier_packages WHERE id = $1', [quote.tier_id]);
    const answersRes = await pool.query('SELECT * FROM quote_answers WHERE quote_id = $1', [quote_id]);
    const uploadsRes = await pool.query('SELECT * FROM uploads WHERE quote_id = $1', [quote_id]);
    const threadRes = await pool.query('SELECT * FROM message_threads WHERE quote_id = $1', [quote_id]);
    res.json({ quote, service: serviceRes.rows[0], tier: tierRes.rows[0], quote_answers: answersRes.rows, uploads: uploadsRes.rows, message_thread: threadRes.rows[0] || null });
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/quotes/:quote_id', authenticateToken, async (req, res) => {
  try {
    const { quote_id } = req.params;
    const { status, final_subtotal, notes } = req.body;
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [quote_id]);
    if (quoteRes.rows.length === 0) return res.status(404).json({ message: 'Quote not found' });
    const quote = quoteRes.rows[0];
    if (req.user.role === 'CUSTOMER' && quote.customer_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    const updates = [];
    const params = [];
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (final_subtotal !== undefined) {
      params.push(final_subtotal);
      updates.push(`final_subtotal = $${params.length}`);
    }
    if (notes !== undefined) {
      params.push(notes);
      updates.push(`notes = $${params.length}`);
    }
    params.push(new Date().toISOString());
    updates.push(`updated_at = $${params.length}`);
    params.push(quote_id);
    await pool.query(`UPDATE quotes SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    const updatedRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [quote_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'QUOTE', quote_id, { status, final_subtotal }, req.ip);
    if (status && status !== quote.status) {
      emitEvent('quote/status_updated', { event_type: 'quote_status_updated', timestamp: new Date().toISOString(), quote_id, customer_id: quote.customer_id, old_status: quote.status, new_status: status, updated_by_user_id: req.user.id });
    }
    res.json(updatedRes.rows[0]);
  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/quotes', authenticateToken, requireRole(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const customer = req.query.customer as string | undefined;
    const service_id = req.query.service_id as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = 20;
    const offset = (page - 1) * limit;
    let query = `SELECT q.*,
      u.id as customer_id_ref, u.name as customer_name, u.email as customer_email,
      s.id as service_id_ref, s.name as service_name, s.slug as service_slug,
      t.id as tier_id_ref, t.name as tier_name, t.description as tier_description
      FROM quotes q
      LEFT JOIN users u ON q.customer_id = u.id
      JOIN services s ON q.service_id = s.id
      JOIN tier_packages t ON q.tier_id = t.id
      WHERE 1=1`;
    const params: any[] = [];
    if (status) {
      params.push(status);
      query += ` AND q.status = $${params.length}`;
    }
    if (customer) {
      params.push(`%${customer}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    if (service_id) {
      params.push(service_id);
      query += ` AND q.service_id = $${params.length}`;
    }
    const countQuery = query.replace(/SELECT q\.\*[\s\S]*?FROM quotes q/, 'SELECT COUNT(*) FROM quotes q');
    const totalRes = await pool.query(countQuery, params);
    query += ' ORDER BY q.created_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    // Transform flat rows into nested structure for frontend
    const quotes = result.rows.map((row: any) => ({
      quote: {
        id: row.id,
        customer_id: row.customer_id,
        service_id: row.service_id,
        tier_id: row.tier_id,
        status: row.status,
        estimate_subtotal: row.estimate_subtotal,
        final_subtotal: row.final_subtotal,
        notes: row.notes,
        is_guest: row.is_guest,
        guest_name: row.guest_name,
        guest_email: row.guest_email,
        guest_phone: row.guest_phone,
        guest_company_name: row.guest_company_name,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      customer: row.is_guest ? {
        id: null,
        name: row.guest_name,
        email: row.guest_email,
        is_guest: true
      } : {
        id: row.customer_id_ref,
        name: row.customer_name,
        email: row.customer_email,
        is_guest: false
      },
      service: {
        id: row.service_id_ref,
        name: row.service_name,
        slug: row.service_slug
      },
      tier: {
        id: row.tier_id_ref,
        name: row.tier_name,
        description: row.tier_description
      }
    }));
    res.json({ quotes, total: parseInt(totalRes.rows[0].count) });
  } catch (error: any) {
    console.error('List admin quotes error:', error?.message, error?.stack);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/quotes/:quote_id/finalize', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { quote_id } = req.params;
    const { final_subtotal, notes } = req.body;
    if (!final_subtotal) return res.status(400).json({ message: 'final_subtotal required' });
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [quote_id]);
    if (quoteRes.rows.length === 0) return res.status(404).json({ message: 'Quote not found' });
    const quote = quoteRes.rows[0];
    const taxRate = 0.23;
    const taxAmount = parseFloat(final_subtotal) * taxRate;
    const totalAmount = parseFloat(final_subtotal) + taxAmount;
    const now = new Date().toISOString();
    await pool.query(
      'UPDATE quotes SET status = $1, final_subtotal = $2, notes = $3, updated_at = $4 WHERE id = $5',
      ['APPROVED', final_subtotal, notes || quote.notes, now, quote_id]
    );
    // Create ORDER first (required for invoice FK constraint)
    const orderId = uuidv4();
    const depositPct = 50;
    const depositAmount = totalAmount * (depositPct / 100);
    await pool.query(
      `INSERT INTO orders (id, quote_id, customer_id, tier_id, status, total_subtotal, tax_amount, total_amount, deposit_pct, deposit_amount, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [orderId, quote_id, quote.customer_id, quote.tier_id, 'PENDING_DEPOSIT', parseFloat(final_subtotal), taxAmount, totalAmount, depositPct, depositAmount, now, now]
    );
    // Create invoice with correct order_id (not quote_id!)
    const invoiceId = uuidv4();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    await pool.query(
      'INSERT INTO invoices (id, order_id, invoice_number, amount_due, issued_at, paid_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [invoiceId, orderId, invoiceNumber, totalAmount, now, null]
    );
    const updatedQuote = await pool.query('SELECT * FROM quotes WHERE id = $1', [quote_id]);
    const order = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const invoice = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    await createAuditLog(req.user.id, 'FINALIZE', 'QUOTE', quote_id, { final_subtotal, total_amount: totalAmount, order_id: orderId }, req.ip);
    emitEvent('quote/finalized', { event_type: 'quote_finalized', timestamp: now, quote_id, order_id: orderId, customer_id: quote.customer_id, final_subtotal: parseFloat(final_subtotal), tax_amount: taxAmount, total_amount: totalAmount, finalized_by_admin_id: req.user.id, invoice_number: invoiceNumber });
    res.json({ quote: updatedQuote.rows[0], order: order.rows[0], invoice: invoice.rows[0] });
  } catch (error) {
    console.error('Finalize quote error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/uploads', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File required' });
    const { quote_id, order_id } = req.body;
    const uploadId = uuidv4();
    const fileUrl = `/storage/${req.file.filename}`;
    await pool.query(
      'INSERT INTO uploads (id, owner_user_id, quote_id, order_id, file_url, file_type, file_name, file_size_bytes, dpi_warning, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [uploadId, req.user.id, quote_id || null, order_id || null, fileUrl, req.file.mimetype, req.file.originalname, req.file.size, false, new Date().toISOString()]
    );
    const result = await pool.query('SELECT * FROM uploads WHERE id = $1', [uploadId]);
    emitEvent('upload/completed', { event_type: 'upload_completed', timestamp: new Date().toISOString(), upload_id: uploadId, file_url: fileUrl, file_name: req.file.originalname, file_type: req.file.mimetype, file_size_bytes: req.file.size, owner_user_id: req.user.id, quote_id: quote_id || null, order_id: order_id || null });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/uploads/:upload_id', authenticateToken, async (req, res) => {
  try {
    const { upload_id } = req.params;
    const result = await pool.query('SELECT * FROM uploads WHERE id = $1', [upload_id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Upload not found' });
    const upload = result.rows[0];
    if (req.user.role === 'CUSTOMER' && upload.owner_user_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    res.json(upload);
  } catch (error) {
    console.error('Get upload error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/uploads/:upload_id', authenticateToken, async (req, res) => {
  try {
    const { upload_id } = req.params;
    const result = await pool.query('SELECT * FROM uploads WHERE id = $1', [upload_id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Upload not found' });
    const upload = result.rows[0];
    if (req.user.role === 'CUSTOMER' && upload.owner_user_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    const filePath = path.join(storageDir, path.basename(upload.file_url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM uploads WHERE id = $1', [upload_id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete upload error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/calendar/availability', async (req, res) => {
  try {
    const start_date = req.query.start_date as string;
    const end_date = req.query.end_date as string;
    const service_id = req.query.service_id as string;
    if (!start_date || !end_date) return res.status(400).json({ message: 'start_date and end_date required' });
    const settingsRes = await pool.query('SELECT * FROM calendar_settings LIMIT 1');
    const settings = settingsRes.rows[0] || { working_days: '[1,2,3,4,5]', start_hour: 9, end_hour: 18, slot_duration_minutes: 120, slots_per_day: 4, emergency_slots_per_day: 2 };
    const workingDays = JSON.parse(settings.working_days);
    const blackoutRes = await pool.query('SELECT date FROM blackout_dates WHERE date >= $1 AND date <= $2', [start_date, end_date]);
    const blackoutDates = blackoutRes.rows.map(r => r.date);
    const bookingsRes = await pool.query(
      "SELECT DATE(start_at) as date, COUNT(*) as count FROM bookings WHERE start_at >= $1 AND start_at <= $2 AND status IN ('PENDING', 'CONFIRMED') GROUP BY DATE(start_at)",
      [start_date, end_date]
    );
    const bookingCounts = {};
    bookingsRes.rows.forEach(r => { bookingCounts[r.date] = parseInt(r.count); });
    const availableDates = [];
    let current = new Date(start_date);
    const endDateObj = new Date(end_date);
    while (current <= endDateObj) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      if (workingDays.includes(dayOfWeek) && !blackoutDates.includes(dateStr)) {
        const booked = bookingCounts[dateStr] || 0;
        const available = Math.max(0, settings.slots_per_day - booked);
        const emergencyAvailable = Math.max(0, settings.emergency_slots_per_day);
        availableDates.push({ date: dateStr, available_slots: [], is_full: available === 0, emergency_slots_available: emergencyAvailable });
      }
      current.setDate(current.getDate() + 1);
    }
    res.json({ available_dates: availableDates, calendar_settings: settings });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/bookings', authenticateToken, requireRole(['CUSTOMER', 'STAFF', 'ADMIN']), async (req, res) => {
  try {
    const { status, start_date, end_date } = req.query;
    const userRole = req.user.role;

    // Staff and Admin see all bookings; Customers see only their own
    let query = `SELECT b.*, q.service_id, s.name as service_name, u.name as customer_name
                 FROM bookings b
                 JOIN quotes q ON b.quote_id = q.id
                 JOIN services s ON q.service_id = s.id
                 JOIN users u ON b.customer_id = u.id
                 WHERE 1=1`;
    const params: any[] = [];

    // For customers, filter by their own bookings
    if (userRole === 'CUSTOMER') {
      params.push(req.user.id);
      query += ` AND b.customer_id = $${params.length}`;
    }

    // Date range filter (for calendar views)
    if (start_date && end_date) {
      params.push(start_date, end_date);
      query += ` AND DATE(b.start_at) >= $${params.length - 1} AND DATE(b.start_at) <= $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }
    query += ' ORDER BY b.start_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List bookings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/bookings', authenticateToken, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    const { quote_id, start_at, end_at, is_emergency = false } = req.body;
    if (!quote_id || !start_at || !end_at) return res.status(400).json({ message: 'quote_id, start_at, and end_at required' });
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1 AND customer_id = $2', [quote_id, req.user.id]);
    if (quoteRes.rows.length === 0) return res.status(404).json({ message: 'Quote not found' });
    const bookingId = uuidv4();
    const urgentFeePct = is_emergency ? 20 : 0;
    await pool.query(
      'INSERT INTO bookings (id, quote_id, customer_id, start_at, end_at, status, is_emergency, urgent_fee_pct, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [bookingId, quote_id, req.user.id, start_at, end_at, 'PENDING', is_emergency, urgentFeePct, new Date().toISOString(), new Date().toISOString()]
    );
    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    emitEvent('booking/created', { event_type: 'booking_created', timestamp: new Date().toISOString(), booking_id: bookingId, quote_id, customer_id: req.user.id, start_at, end_at, is_emergency, urgent_fee_pct: urgentFeePct, status: 'PENDING' });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/bookings/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;
    const result = await pool.query('SELECT b.*, q.service_id, s.name as service_name FROM bookings b JOIN quotes q ON b.quote_id = q.id JOIN services s ON q.service_id = s.id WHERE b.id = $1', [booking_id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Booking not found' });
    const booking = result.rows[0];
    if (req.user.role === 'CUSTOMER' && booking.customer_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/bookings/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { start_at, end_at, status } = req.body;
    const bookingRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking_id]);
    if (bookingRes.rows.length === 0) return res.status(404).json({ message: 'Booking not found' });
    const booking = bookingRes.rows[0];
    if (req.user.role === 'CUSTOMER' && booking.customer_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    const updates = [];
    const params = [];
    if (start_at) {
      params.push(start_at);
      updates.push(`start_at = $${params.length}`);
    }
    if (end_at) {
      params.push(end_at);
      updates.push(`end_at = $${params.length}`);
    }
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    params.push(new Date().toISOString());
    updates.push(`updated_at = $${params.length}`);
    params.push(booking_id);
    await pool.query(`UPDATE bookings SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    const updatedRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking_id]);
    if (status === 'CONFIRMED') {
      emitEvent('booking/confirmed', { event_type: 'booking_confirmed', timestamp: new Date().toISOString(), booking_id, customer_id: booking.customer_id, confirmed_at: new Date().toISOString() });
    }
    res.json(updatedRes.rows[0]);
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/orders', authenticateToken, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '20');
    const offset = (page - 1) * limit;
    let query = `SELECT o.*,
      s.id as service_id, s.name as service_name, s.slug as service_slug, s.description as service_description,
      t.id as tier_id_ref, t.name as tier_name, t.description as tier_description
      FROM orders o
      JOIN quotes q ON o.quote_id = q.id
      JOIN services s ON q.service_id = s.id
      JOIN tier_packages t ON o.tier_id = t.id
      WHERE o.customer_id = $1`;
    const params: any[] = [req.user.id];
    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    const countQuery = query.replace(/SELECT o\.\*[\s\S]*?FROM orders o/, 'SELECT COUNT(*) FROM orders o');
    const totalRes = await pool.query(countQuery, params);
    query += ' ORDER BY o.created_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    const ordersWithDetails = [];
    for (const row of result.rows) {
      const paymentsRes = await pool.query('SELECT SUM(amount) as total_paid FROM payments WHERE order_id = $1 AND status = $2', [row.id, 'COMPLETED']);
      const totalPaid = parseFloat(paymentsRes.rows[0]?.total_paid || 0);
      const balanceDue = row.total_amount - totalPaid;
      // Transform flat row into nested structure for frontend
      ordersWithDetails.push({
        order: {
          id: row.id,
          quote_id: row.quote_id,
          customer_id: row.customer_id,
          tier_id: row.tier_id,
          status: row.status,
          deposit_amount: row.deposit_amount,
          total_amount: row.total_amount,
          due_at: row.due_at,
          created_at: row.created_at,
          updated_at: row.updated_at
        },
        service: {
          id: row.service_id,
          name: row.service_name,
          slug: row.service_slug,
          description: row.service_description
        },
        tier: {
          id: row.tier_id_ref,
          name: row.tier_name,
          description: row.tier_description
        },
        payment_status: { deposit_paid: totalPaid >= row.deposit_amount, balance_due: balanceDue }
      });
    }
    res.json({ orders: ordersWithDetails, total: parseInt(totalRes.rows[0].count) });
  } catch (error: any) {
    console.error('List orders error:', error?.message, error?.stack);
    res.status(500).json({ message: `Internal server error: ${error?.message || 'Unknown error'}` });
  }
});

app.get('/api/orders/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = orderRes.rows[0];
    if (req.user.role === 'CUSTOMER' && order.customer_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    const quoteRes = await pool.query('SELECT * FROM quotes WHERE id = $1', [order.quote_id]);
    const serviceRes = await pool.query('SELECT s.* FROM services s JOIN quotes q ON s.id = q.service_id WHERE q.id = $1', [order.quote_id]);
    const tierRes = await pool.query('SELECT * FROM tier_packages WHERE id = $1', [order.tier_id]);
    const bookingRes = await pool.query('SELECT * FROM bookings WHERE quote_id = $1', [order.quote_id]);
    const proofsRes = await pool.query('SELECT * FROM proof_versions WHERE order_id = $1 ORDER BY version_number', [order_id]);
    const invoiceRes = await pool.query('SELECT * FROM invoices WHERE order_id = $1', [order_id]);
    const paymentsRes = await pool.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at', [order_id]);
    const threadRes = await pool.query('SELECT * FROM message_threads WHERE order_id = $1', [order_id]);
    res.json({ order, quote: quoteRes.rows[0], service: serviceRes.rows[0], tier: tierRes.rows[0], booking: bookingRes.rows[0] || null, proof_versions: proofsRes.rows, invoice: invoiceRes.rows[0] || null, payments: paymentsRes.rows, message_thread: threadRes.rows[0] || null });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/orders/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status, assigned_staff_id, notes } = req.body;
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = orderRes.rows[0];
    const updates = [];
    const params = [];
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (assigned_staff_id !== undefined) {
      params.push(assigned_staff_id);
      updates.push(`assigned_staff_id = $${params.length}`);
    }
    params.push(new Date().toISOString());
    updates.push(`updated_at = $${params.length}`);
    params.push(order_id);
    await pool.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    const updatedRes = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'ORDER', order_id, { status, assigned_staff_id }, req.ip);
    if (status && status !== order.status) {
      emitEvent('order/status_updated', { event_type: 'order_status_updated', timestamp: new Date().toISOString(), order_id, customer_id: order.customer_id, old_status: order.status, new_status: status, updated_by_user_id: req.user.id, updated_by_role: req.user.role });
    }
    if (assigned_staff_id && assigned_staff_id !== order.assigned_staff_id) {
      emitEvent('order/assigned', { event_type: 'order_assigned', timestamp: new Date().toISOString(), order_id, customer_id: order.customer_id, assigned_staff_id, assigned_by_admin_id: req.user.id });
    }
    res.json(updatedRes.rows[0]);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/staff/jobs', authenticateToken, requireRole(['STAFF', 'ADMIN']), async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const assigned_to = req.query.assigned_to as string | undefined;
    let query = `SELECT o.*,
      u.name as customer_name, u.email as customer_email,
      s.name as service_name, s.slug as service_slug,
      t.name as tier_name
      FROM orders o
      JOIN users u ON o.customer_id = u.id
      JOIN quotes q ON o.quote_id = q.id
      JOIN services s ON q.service_id = s.id
      JOIN tier_packages t ON o.tier_id = t.id
      WHERE 1=1`;
    const params: any[] = [];
    if (req.user.role === 'STAFF' && !assigned_to) {
      params.push(req.user.id);
      query += ` AND o.assigned_staff_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    if (assigned_to) {
      params.push(assigned_to);
      query += ` AND o.assigned_staff_id = $${params.length}`;
    }
    query += ' ORDER BY o.due_at ASC NULLS LAST, o.created_at DESC';
    const result = await pool.query(query, params);
    // Return flat rows - frontend transforms to nested structure
    res.json(result.rows);
  } catch (error) {
    console.error('List staff jobs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/orders', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const assigned_to = req.query.assigned_to as string | undefined;
    const payment_status = req.query.payment_status as string | undefined;
    const customer = req.query.customer as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = 20;
    const offset = (page - 1) * limit;
    // LEFT JOINs to handle both service orders (with quote/user) and product orders (with guest info)
    let query = `SELECT o.*, 
      u.name as customer_name, u.email as customer_email,
      s.name as service_name, 
      t.name as tier_name, 
      staff.name as assigned_staff_name, 
      q.status as quote_status 
      FROM orders o 
      LEFT JOIN users u ON o.customer_id = u.id 
      LEFT JOIN quotes q ON o.quote_id = q.id 
      LEFT JOIN services s ON q.service_id = s.id 
      LEFT JOIN tier_packages t ON o.tier_id = t.id 
      LEFT JOIN users staff ON o.assigned_staff_id = staff.id 
      WHERE 1=1`;
    const params: any[] = [];
    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    if (assigned_to) {
      params.push(assigned_to);
      query += ` AND o.assigned_staff_id = $${params.length}`;
    }
    if (customer) {
      params.push(`%${customer}%`);
      // Search in both customer name/email AND guest name/email
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR o.guest_name ILIKE $${params.length} OR o.guest_email ILIKE $${params.length})`;
    }
    const countQuery = query.replace(/SELECT o\.\*[\s\S]*?FROM orders o/, 'SELECT COUNT(*) FROM orders o');
    const totalRes = await pool.query(countQuery, params);
    query += ' ORDER BY o.created_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    // Transform flat rows into nested structure for frontend
    const orders = result.rows.map((row: any) => {
      const isGuestOrder = !row.customer_id && row.guest_email;
      const isProductOrder = row.order_type === 'PRODUCT' || row.quote_status === 'PRODUCT_ORDER' || (!row.quote_id && !row.customer_id);
      
      return {
        order: {
          id: row.id,
          quote_id: row.quote_id,
          customer_id: row.customer_id,
          tier_id: row.tier_id,
          order_type: row.order_type || (isProductOrder ? 'PRODUCT' : 'SERVICE'),
          status: row.status,
          due_at: row.due_at,
          total_subtotal: row.total_subtotal,
          tax_amount: row.tax_amount,
          total_amount: row.total_amount,
          deposit_pct: row.deposit_pct,
          deposit_amount: row.deposit_amount,
          revision_count: row.revision_count || 0,
          assigned_staff_id: row.assigned_staff_id,
          location_id: row.location_id,
          guest_name: row.guest_name,
          guest_email: row.guest_email,
          guest_phone: row.guest_phone,
          guest_address: row.guest_address,
          created_at: row.created_at,
          updated_at: row.updated_at
        },
        customer: isGuestOrder ? {
          id: null,
          name: row.guest_name || 'Guest',
          email: row.guest_email || '',
          is_guest: true
        } : {
          id: row.customer_id,
          name: row.customer_name || 'Unknown',
          email: row.customer_email || '',
          is_guest: false
        },
        service: {
          id: '',
          name: isProductOrder ? 'Product Order' : (row.service_name || 'N/A'),
          slug: ''
        },
        tier: {
          id: row.tier_id,
          name: isProductOrder ? '-' : (row.tier_name || 'N/A'),
          slug: ''
        },
        assigned_staff: row.assigned_staff_id ? {
          id: row.assigned_staff_id,
          name: row.assigned_staff_name,
          email: ''
        } : null
      };
    });
    res.json({ orders, total: parseInt(totalRes.rows[0].count) });
  } catch (error: any) {
    const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    console.error('List admin orders error:', errMsg, error?.stack);
    res.status(500).json({ message: `Internal server error: ${errMsg}` });
  }
});

app.get('/api/orders/:order_id/proofs', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const result = await pool.query('SELECT pv.*, u.name as created_by_staff_name FROM proof_versions pv LEFT JOIN users u ON pv.created_by_staff_id = u.id WHERE pv.order_id = $1 ORDER BY pv.version_number', [order_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('List proofs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/orders/:order_id/proofs', authenticateToken, requireRole(['STAFF', 'ADMIN']), async (req, res) => {
  try {
    const { order_id } = req.params;
    const { file_url, internal_notes } = req.body;
    if (!file_url) return res.status(400).json({ message: 'file_url required' });
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = orderRes.rows[0];
    const maxVersionRes = await pool.query('SELECT MAX(version_number) as max_version FROM proof_versions WHERE order_id = $1', [order_id]);
    const versionNumber = (parseInt(maxVersionRes.rows[0]?.max_version) || 0) + 1;
    const proofId = uuidv4();
    await pool.query(
      'INSERT INTO proof_versions (id, order_id, version_number, file_url, created_by_staff_id, status, customer_comment, internal_notes, approved_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [proofId, order_id, versionNumber, file_url, req.user.id, 'SENT', null, internal_notes || null, null, new Date().toISOString(), new Date().toISOString()]
    );
    await pool.query('UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3', ['PROOF_SENT', new Date().toISOString(), order_id]);
    const result = await pool.query('SELECT * FROM proof_versions WHERE id = $1', [proofId]);
    emitEvent('proof/uploaded', { event_type: 'proof_uploaded', timestamp: new Date().toISOString(), proof_id: proofId, order_id, customer_id: order.customer_id, version_number: versionNumber, file_url, created_by_staff_id: req.user.id, created_by_staff_name: req.user.name });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload proof error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/proofs/:proof_id/approve', authenticateToken, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    const { proof_id } = req.params;
    const proofRes = await pool.query('SELECT pv.*, o.customer_id, o.id as order_id FROM proof_versions pv JOIN orders o ON pv.order_id = o.id WHERE pv.id = $1', [proof_id]);
    if (proofRes.rows.length === 0) return res.status(404).json({ message: 'Proof not found' });
    const proof = proofRes.rows[0];
    if (proof.customer_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    const approvedAt = new Date().toISOString();
    await pool.query('UPDATE proof_versions SET status = $1, approved_at = $2, updated_at = $3 WHERE id = $4', ['APPROVED', approvedAt, new Date().toISOString(), proof_id]);
    await pool.query('UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3', ['IN_PRODUCTION', new Date().toISOString(), proof.order_id]);
    const updatedRes = await pool.query('SELECT * FROM proof_versions WHERE id = $1', [proof_id]);
    emitEvent('proof/approved', { event_type: 'proof_approved', timestamp: new Date().toISOString(), proof_id, order_id: proof.order_id, customer_id: proof.customer_id, version_number: proof.version_number, approved_at: approvedAt });
    res.json(updatedRes.rows[0]);
  } catch (error) {
    console.error('Approve proof error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/proofs/:proof_id/request-changes', authenticateToken, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    const { proof_id } = req.params;
    const { customer_comment, reference_file_ids } = req.body;
    if (!customer_comment) return res.status(400).json({ message: 'customer_comment required' });
    const proofRes = await pool.query('SELECT pv.*, o.customer_id, o.id as order_id, o.revision_count, t.slug as tier_slug FROM proof_versions pv JOIN orders o ON pv.order_id = o.id JOIN tier_packages t ON o.tier_id = t.id WHERE pv.id = $1', [proof_id]);
    if (proofRes.rows.length === 0) return res.status(404).json({ message: 'Proof not found' });
    const proof = proofRes.rows[0];
    if (proof.customer_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    const tierLimits = { basic: 0, standard: 2, premium: Infinity, enterprise: Infinity };
    const revisionLimit = tierLimits[proof.tier_slug] || 0;
    if (proof.revision_count >= revisionLimit) {
      return res.status(400).json({ message: 'Revision limit reached for your tier' });
    }
    await pool.query('UPDATE proof_versions SET status = $1, customer_comment = $2, updated_at = $3 WHERE id = $4', ['REVISION_REQUESTED', customer_comment, new Date().toISOString(), proof_id]);
    await pool.query('UPDATE orders SET status = $1, revision_count = revision_count + 1, updated_at = $2 WHERE id = $3', ['IN_PRODUCTION', new Date().toISOString(), proof.order_id]);
    const updatedRes = await pool.query('SELECT * FROM proof_versions WHERE id = $1', [proof_id]);
    emitEvent('proof/revision_requested', { event_type: 'proof_revision_requested', timestamp: new Date().toISOString(), proof_id, order_id: proof.order_id, customer_id: proof.customer_id, version_number: proof.version_number, customer_comment, revision_count: proof.revision_count + 1, tier_revision_limit: revisionLimit, revisions_remaining: revisionLimit - (proof.revision_count + 1) });
    res.json(updatedRes.rows[0]);
  } catch (error) {
    console.error('Request changes error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/orders/:order_id/payments', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const result = await pool.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at', [order_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/orders/:order_id/payments', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const { amount, method, transaction_ref } = req.body;
    if (!amount || !method) return res.status(400).json({ message: 'amount and method required' });
    const paymentId = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO payments (id, order_id, amount, method, status, transaction_ref, recorded_by_admin_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [paymentId, order_id, amount, method, 'PENDING', transaction_ref || null, req.user.role === 'ADMIN' ? req.user.id : null, now, now]
    );
    const result = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    emitEvent('payment/created', { event_type: 'payment_created', timestamp: now, payment_id: paymentId, order_id, amount: parseFloat(amount), method, status: 'PENDING' });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/payments/stripe/create-intent', authenticateToken, async (req, res) => {
  try {
    const { order_id, amount } = req.body;
    if (!order_id || !amount) return res.status(400).json({ message: 'order_id and amount required' });
    const clientSecret = `pi_mock_${uuidv4()}_secret_${uuidv4()}`;
    const paymentIntentId = `pi_mock_${uuidv4()}`;
    res.json({ client_secret: clientSecret, payment_intent_id: paymentIntentId });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/invoices/:invoice_id', authenticateToken, async (req, res) => {
  try {
    const { invoice_id } = req.params;
    const invoiceRes = await pool.query('SELECT i.*, o.customer_id FROM invoices i JOIN orders o ON i.order_id = o.id WHERE i.id = $1', [invoice_id]);
    if (invoiceRes.rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
    const invoice = invoiceRes.rows[0];
    if (req.user.role === 'CUSTOMER' && invoice.customer_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [invoice.order_id]);
    const customerRes = await pool.query('SELECT * FROM users WHERE id = $1', [invoice.customer_id]);
    res.json({ invoice, order: orderRes.rows[0], customer: customerRes.rows[0] });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/invoices/:invoice_id/download', authenticateToken, async (req, res) => {
  try {
    const { invoice_id } = req.params;
    res.json({ message: 'PDF generation not implemented', pdf_url: `/invoices/${invoice_id}.pdf` });
  } catch (error) {
    console.error('Download invoice error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/message-threads/:thread_id/messages', authenticateToken, async (req, res) => {
  try {
    const { thread_id } = req.params;
    const result = await pool.query('SELECT m.*, u.name as sender_name, u.role as sender_role FROM messages m JOIN users u ON m.sender_user_id = u.id WHERE m.thread_id = $1 ORDER BY m.created_at', [thread_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('List messages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/message-threads/:thread_id/messages', authenticateToken, async (req, res) => {
  try {
    const { thread_id } = req.params;
    const { body } = req.body;
    if (!body || body.length > 1000) return res.status(400).json({ message: 'Body required and must be <= 1000 characters' });
    const messageId = uuidv4();
    await pool.query(
      'INSERT INTO messages (id, thread_id, sender_user_id, body, is_read, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [messageId, thread_id, req.user.id, body, false, new Date().toISOString()]
    );
    const result = await pool.query('SELECT * FROM messages WHERE id = $1', [messageId]);
    emitEvent('message/received', { event_type: 'message_received', timestamp: new Date().toISOString(), message_id: messageId, thread_id, sender_user_id: req.user.id, sender_name: req.user.name, sender_role: req.user.role, body, is_read: false });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/messages/:message_id/mark-read', authenticateToken, async (req, res) => {
  try {
    const { message_id } = req.params;
    await pool.query('UPDATE messages SET is_read = true WHERE id = $1', [message_id]);
    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    let profile = null;
    if (req.user.role === 'CUSTOMER') {
      const profileRes = await pool.query('SELECT * FROM customer_profiles WHERE user_id = $1', [req.user.id]);
      profile = profileRes.rows[0] || null;
    } else if (req.user.role === 'STAFF' || req.user.role === 'ADMIN') {
      const profileRes = await pool.query('SELECT * FROM staff_profiles WHERE user_id = $1', [req.user.id]);
      profile = profileRes.rows[0] || null;
    }
    res.json({ user: req.user, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, company_name, address } = req.body;
    if (name) {
      await pool.query('UPDATE users SET name = $1, updated_at = $2 WHERE id = $3', [name, new Date().toISOString(), req.user.id]);
    }
    if (req.user.role === 'CUSTOMER') {
      const updates = [];
      const params = [];
      if (phone !== undefined) {
        params.push(phone);
        updates.push(`phone = $${params.length}`);
      }
      if (company_name !== undefined) {
        params.push(company_name);
        updates.push(`company_name = $${params.length}`);
      }
      if (address !== undefined) {
        params.push(address);
        updates.push(`address = $${params.length}`);
      }
      if (updates.length > 0) {
        params.push(new Date().toISOString());
        updates.push(`updated_at = $${params.length}`);
        params.push(req.user.id);
        await pool.query(`UPDATE customer_profiles SET ${updates.join(', ')} WHERE user_id = $${params.length}`, params);
      }
    }
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/users/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ message: 'current_password and new_password required' });
    if (new_password.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
    const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (current_password !== userRes.rows[0].password_hash) return res.status(400).json({ message: 'Current password incorrect' });
    await pool.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [new_password, new Date().toISOString(), req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/users/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notification_preferences WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      const id = uuidv4();
      await pool.query(
        'INSERT INTO notification_preferences (id, user_id, email_order_updates, email_proof_ready, email_messages, email_marketing, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, req.user.id, true, true, true, false, new Date().toISOString()]
      );
      const newRes = await pool.query('SELECT * FROM notification_preferences WHERE id = $1', [id]);
      return res.json(newRes.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/users/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const { email_order_updates, email_proof_ready, email_messages, email_marketing } = req.body;
    const updates = [];
    const params = [];
    if (email_order_updates !== undefined) {
      params.push(email_order_updates);
      updates.push(`email_order_updates = $${params.length}`);
    }
    if (email_proof_ready !== undefined) {
      params.push(email_proof_ready);
      updates.push(`email_proof_ready = $${params.length}`);
    }
    if (email_messages !== undefined) {
      params.push(email_messages);
      updates.push(`email_messages = $${params.length}`);
    }
    if (email_marketing !== undefined) {
      params.push(email_marketing);
      updates.push(`email_marketing = $${params.length}`);
    }
    params.push(new Date().toISOString());
    updates.push(`updated_at = $${params.length}`);
    params.push(req.user.id);
    await pool.query(`UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = $${params.length}`, params);
    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];

    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }
    if (status === 'active') {
      query += ' AND is_active = true';
    } else if (status === 'inactive') {
      query += ' AND is_active = false';
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    query += ' ORDER BY created_at DESC';

    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const usersResult = await pool.query(query, params);

    // Fetch profiles for each user
    const usersWithProfiles = await Promise.all(usersResult.rows.map(async (user: any) => {
      let profile = null;
      if (user.role === 'CUSTOMER') {
        const profileRes = await pool.query('SELECT * FROM customer_profiles WHERE user_id = $1', [user.id]);
        profile = profileRes.rows[0] || null;
      } else if (user.role === 'STAFF' || user.role === 'ADMIN') {
        const profileRes = await pool.query('SELECT * FROM staff_profiles WHERE user_id = $1', [user.id]);
        profile = profileRes.rows[0] || null;
      }
      return { user, profile };
    }));

    res.json({ users: usersWithProfiles, total: parseInt(totalRes.rows[0].count) });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/users/:user_id', authenticateToken, requireRole(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { user_id } = req.params;
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = userRes.rows[0];
    let profile = null;

    if (user.role === 'CUSTOMER') {
      const profileRes = await pool.query('SELECT * FROM customer_profiles WHERE user_id = $1', [user.id]);
      profile = profileRes.rows[0] || null;
    } else if (user.role === 'STAFF' || user.role === 'ADMIN') {
      const profileRes = await pool.query('SELECT * FROM staff_profiles WHERE user_id = $1', [user.id]);
      profile = profileRes.rows[0] || null;
    }

    res.json({ user, profile });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, email, password, role, phone, company_name, department, permissions } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ message: 'name, email, password, and role required' });
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [userId, name, email.toLowerCase(), password, role, true, new Date().toISOString(), new Date().toISOString()]
    );
    if (role === 'CUSTOMER') {
      await pool.query(
        'INSERT INTO customer_profiles (id, user_id, phone, company_name, address, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [uuidv4(), userId, phone || null, company_name || null, null, new Date().toISOString(), new Date().toISOString()]
      );
    } else if (role === 'STAFF' || role === 'ADMIN') {
      await pool.query(
        'INSERT INTO staff_profiles (id, user_id, department, permissions, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), userId, department || null, permissions ? JSON.stringify(permissions) : '{}', new Date().toISOString(), new Date().toISOString()]
      );
    }
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/users/:user_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { user_id } = req.params;
    const { name, email, role, is_active } = req.body;
    const updates = [];
    const params = [];
    if (name) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }
    if (email) {
      params.push(email.toLowerCase());
      updates.push(`email = $${params.length}`);
    }
    if (role) {
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }
    if (updates.length > 0) {
      params.push(new Date().toISOString());
      updates.push(`updated_at = $${params.length}`);
      params.push(user_id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/users/:user_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { user_id } = req.params;
    await pool.query('UPDATE users SET is_active = false, updated_at = $1 WHERE id = $2', [new Date().toISOString(), user_id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/services', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const is_active = req.query.is_active as string | undefined;

    let query = `
      SELECT s.*,
             c.id as cat_id, c.name as cat_name, c.slug as cat_slug,
             c.sort_order as cat_sort_order, c.is_active as cat_is_active
      FROM services s
      JOIN service_categories c ON s.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` AND c.slug = $${params.length}`;
    }
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND s.is_active = $${params.length}`;
    }

    query += ' ORDER BY s.name';
    const servicesResult = await pool.query(query, params);

    const servicesWithDetails = await Promise.all(servicesResult.rows.map(async (row: any) => {
      const optionsRes = await pool.query(
        'SELECT * FROM service_options WHERE service_id = $1 AND is_active = true ORDER BY sort_order',
        [row.id]
      );

      return {
        service: {
          id: row.id, category_id: row.category_id, name: row.name, slug: row.slug,
          description: row.description, requires_booking: row.requires_booking,
          requires_proof: row.requires_proof, is_top_seller: row.is_top_seller,
          is_active: row.is_active, slot_duration_hours: row.slot_duration_hours,
          created_at: row.created_at, updated_at: row.updated_at
        },
        category: {
          id: row.cat_id, name: row.cat_name, slug: row.cat_slug,
          sort_order: row.cat_sort_order, is_active: row.cat_is_active
        },
        options: optionsRes.rows
      };
    }));

    res.json(servicesWithDetails);
  } catch (error) {
    console.error('List admin services error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/services', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { category_id, name, slug, description, requires_booking, requires_proof, is_top_seller, slot_duration_hours } = req.body;
    if (!category_id || !name || !slug) return res.status(400).json({ message: 'category_id, name, and slug required' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO services (id, category_id, name, slug, description, requires_booking, requires_proof, is_top_seller, is_active, slot_duration_hours, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [id, category_id, name, slug, description || null, !!requires_booking, !!requires_proof, !!is_top_seller, true, slot_duration_hours || 2, new Date().toISOString(), new Date().toISOString()]
    );
    res.status(201).json({ message: 'Service created successfully' });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/services/:service_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { service_id } = req.params;
    const { name, description, is_top_seller, is_active } = req.body;
    const updates = [];
    const params = [];
    if (name) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description);
      updates.push(`description = $${params.length}`);
    }
    if (is_top_seller !== undefined) {
      params.push(is_top_seller);
      updates.push(`is_top_seller = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }
    if (updates.length > 0) {
      params.push(new Date().toISOString());
      updates.push(`updated_at = $${params.length}`);
      params.push(service_id);
      await pool.query(`UPDATE services SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/services/:service_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { service_id } = req.params;
    await pool.query('UPDATE services SET is_active = false, updated_at = $1 WHERE id = $2', [new Date().toISOString(), service_id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/calendar-settings', authenticateToken, requireRole(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calendar_settings LIMIT 1');
    if (result.rows.length === 0) {
      const id = uuidv4();
      await pool.query(
        'INSERT INTO calendar_settings (id, working_days, start_hour, end_hour, slot_duration_minutes, slots_per_day, emergency_slots_per_day, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, '[1,2,3,4,5]', 9, 18, 120, 4, 2, new Date().toISOString()]
      );
      const newRes = await pool.query('SELECT * FROM calendar_settings WHERE id = $1', [id]);
      return res.json(newRes.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get calendar settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/calendar-settings', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { working_days, start_hour, end_hour, slot_duration_minutes, emergency_slots_per_day } = req.body;
    const settingsRes = await pool.query('SELECT id FROM calendar_settings LIMIT 1');
    let settingsId;
    if (settingsRes.rows.length === 0) {
      settingsId = uuidv4();
      await pool.query(
        'INSERT INTO calendar_settings (id, working_days, start_hour, end_hour, slot_duration_minutes, slots_per_day, emergency_slots_per_day, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [settingsId, '[1,2,3,4,5]', 9, 18, 120, 4, 2, new Date().toISOString()]
      );
    } else {
      settingsId = settingsRes.rows[0].id;
    }
    const updates = [];
    const params = [];
    if (working_days) {
      params.push(working_days);
      updates.push(`working_days = $${params.length}`);
    }
    if (start_hour !== undefined) {
      params.push(start_hour);
      updates.push(`start_hour = $${params.length}`);
    }
    if (end_hour !== undefined) {
      params.push(end_hour);
      updates.push(`end_hour = $${params.length}`);
    }
    if (slot_duration_minutes !== undefined) {
      params.push(slot_duration_minutes);
      updates.push(`slot_duration_minutes = $${params.length}`);
      const newSlots = Math.floor((end_hour - start_hour) * 60 / slot_duration_minutes);
      params.push(newSlots);
      updates.push(`slots_per_day = $${params.length}`);
    }
    if (emergency_slots_per_day !== undefined) {
      params.push(emergency_slots_per_day);
      updates.push(`emergency_slots_per_day = $${params.length}`);
    }
    if (updates.length > 0) {
      params.push(new Date().toISOString());
      updates.push(`updated_at = $${params.length}`);
      params.push(settingsId);
      await pool.query(`UPDATE calendar_settings SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update calendar settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/blackout-dates', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blackout_dates ORDER BY date');
    res.json(result.rows);
  } catch (error) {
    console.error('List blackout dates error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/blackout-dates', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ message: 'date required' });
    const id = uuidv4();
    await pool.query('INSERT INTO blackout_dates (id, date, reason, created_at) VALUES ($1, $2, $3, $4)', [id, date, reason || null, new Date().toISOString()]);
    res.status(201).json({ message: 'Blackout date created successfully' });
  } catch (error) {
    console.error('Create blackout date error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/blackout-dates/:blackout_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { blackout_id } = req.params;
    await pool.query('DELETE FROM blackout_dates WHERE id = $1', [blackout_id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete blackout date error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/settings', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY key');
    res.json(result.rows);
  } catch (error) {
    console.error('List settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/settings/:key', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query('SELECT * FROM settings WHERE key = $1', [key]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Setting not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/settings/:key', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ message: 'value required' });
    const existing = await pool.query('SELECT id FROM settings WHERE key = $1', [key]);
    if (existing.rows.length === 0) {
      const id = uuidv4();
      await pool.query('INSERT INTO settings (id, key, value, updated_at) VALUES ($1, $2, $3, $4)', [id, key, value, new Date().toISOString()]);
    } else {
      await pool.query('UPDATE settings SET value = $1, updated_at = $2 WHERE key = $3', [value, new Date().toISOString(), key]);
    }
    res.json({ message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/audit-logs', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const user_id = req.query.user_id as string | undefined;
    const action = req.query.action as string | undefined;
    const object_type = req.query.object_type as string | undefined;
    const start_date = req.query.start_date as string | undefined;
    const end_date = req.query.end_date as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = 100;
    const offset = (page - 1) * limit;
    let query = 'SELECT al.*, u.name as user_name FROM audit_logs al JOIN users u ON al.user_id = u.id WHERE 1=1';
    const params = [];
    if (user_id) {
      params.push(user_id);
      query += ` AND al.user_id = $${params.length}`;
    }
    if (action) {
      params.push(action);
      query += ` AND al.action = $${params.length}`;
    }
    if (object_type) {
      params.push(object_type);
      query += ` AND al.object_type = $${params.length}`;
    }
    if (start_date) {
      params.push(start_date);
      query += ` AND al.created_at >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      query += ` AND al.created_at <= $${params.length}`;
    }
    const countQuery = query.replace('SELECT al.*, u.name as user_name', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    query += ' ORDER BY al.created_at DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    // Transform flat rows into nested structure for frontend
    const logs = result.rows.map((row: any) => ({
      log: {
        id: row.id,
        user_id: row.user_id,
        action: row.action,
        object_type: row.object_type,
        object_id: row.object_id,
        metadata: row.metadata,
        ip_address: row.ip_address,
        created_at: row.created_at
      },
      user: {
        id: row.user_id,
        name: row.user_name,
        email: '',
        role: ''
      }
    }));
    res.json({ logs, total: parseInt(totalRes.rows[0].count) });
  } catch (error: any) {
    console.error('List audit logs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// BATCH 1: Service Categories & Options CRUD
// =====================================================

app.get('/api/admin/service-categories', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM service_categories ORDER BY sort_order, name');
    res.json(result.rows);
  } catch (error) {
    console.error('List service categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/service-categories', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, slug, sort_order } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'name and slug required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO service_categories (id, name, slug, sort_order, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name, slug, sort_order || 0, true, now, now]
    );
    const result = await pool.query('SELECT * FROM service_categories WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'SERVICE_CATEGORY', id, { name, slug }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create service category error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/service-options', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { service_id, key, label, type, required, choices, help_text, sort_order } = req.body;
    if (!service_id || !key || !label || !type) return res.status(400).json({ message: 'service_id, key, label, and type required' });
    const validTypes = ['TEXT', 'SELECT', 'CHECKBOX', 'NUMBER'];
    if (!validTypes.includes(type)) return res.status(400).json({ message: 'type must be TEXT, SELECT, CHECKBOX, or NUMBER' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO service_options (id, service_id, key, label, type, required, choices, pricing_impact, help_text, sort_order, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
      [id, service_id, key, label, type, !!required, choices || null, null, help_text || null, sort_order || 0, true, now, now]
    );
    const result = await pool.query('SELECT * FROM service_options WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'SERVICE_OPTION', id, { service_id, key, label, type }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create service option error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/service-options/:option_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { option_id } = req.params;
    const { label, required, choices, sort_order, help_text, is_active } = req.body;
    const existing = await pool.query('SELECT * FROM service_options WHERE id = $1', [option_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Service option not found' });
    const updates = [];
    const params = [];
    if (label !== undefined) { params.push(label); updates.push(`label = $${params.length}`); }
    if (required !== undefined) { params.push(required); updates.push(`required = $${params.length}`); }
    if (choices !== undefined) { params.push(choices); updates.push(`choices = $${params.length}`); }
    if (sort_order !== undefined) { params.push(sort_order); updates.push(`sort_order = $${params.length}`); }
    if (help_text !== undefined) { params.push(help_text); updates.push(`help_text = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    if (updates.length > 0) {
      params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`);
      params.push(option_id);
      await pool.query(`UPDATE service_options SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    const result = await pool.query('SELECT * FROM service_options WHERE id = $1', [option_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'SERVICE_OPTION', option_id, req.body, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update service option error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/service-options/:option_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { option_id } = req.params;
    const existing = await pool.query('SELECT * FROM service_options WHERE id = $1', [option_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Service option not found' });
    await pool.query('UPDATE service_options SET is_active = false, updated_at = $1 WHERE id = $2', [new Date().toISOString(), option_id]);
    await createAuditLog(req.user.id, 'DELETE', 'SERVICE_OPTION', option_id, null, req.ip);
    res.status(204).send();
  } catch (error) {
    console.error('Delete service option error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// BATCH 2: Tier Management CRUD
// =====================================================

app.get('/api/admin/tiers', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const tiers = await pool.query('SELECT * FROM tier_packages ORDER BY sort_order');
    const result = [];
    for (const tier of tiers.rows) {
      const features = await pool.query('SELECT * FROM tier_features WHERE tier_id = $1 ORDER BY group_name, sort_order', [tier.id]);
      const ordersCount = await pool.query('SELECT COUNT(*) FROM orders WHERE tier_id = $1', [tier.id]);
      const featureGroups = {};
      for (const f of features.rows) {
        if (!featureGroups[f.group_name]) featureGroups[f.group_name] = [];
        featureGroups[f.group_name].push(f);
      }
      result.push({
        tier,
        features: features.rows,
        features_count: features.rows.length,
        orders_count: parseInt(ordersCount.rows[0].count),
        feature_groups: Object.entries(featureGroups).map(([group_name, features]) => ({ group_name, features }))
      });
    }
    res.json(result);
  } catch (error) {
    console.error('List admin tiers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/tiers', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, slug, description, sort_order } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'name and slug required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO tier_packages (id, name, slug, description, is_active, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, slug, description || null, true, sort_order || 0, now, now]
    );
    const result = await pool.query('SELECT * FROM tier_packages WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'TIER_PACKAGE', id, { name, slug }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create tier error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/tiers/:tier_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { tier_id } = req.params;
    const { name, description, is_active, sort_order } = req.body;
    const existing = await pool.query('SELECT * FROM tier_packages WHERE id = $1', [tier_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Tier not found' });
    const updates = [];
    const params = [];
    if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
    if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    if (sort_order !== undefined) { params.push(sort_order); updates.push(`sort_order = $${params.length}`); }
    if (updates.length > 0) {
      params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`);
      params.push(tier_id);
      await pool.query(`UPDATE tier_packages SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    const result = await pool.query('SELECT * FROM tier_packages WHERE id = $1', [tier_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'TIER_PACKAGE', tier_id, req.body, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update tier error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/tier-features', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { tier_id, group_name, feature_key, feature_label, feature_value, is_included } = req.body;
    if (!tier_id || !group_name || !feature_key || !feature_label) {
      return res.status(400).json({ message: 'tier_id, group_name, feature_key, and feature_label required' });
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO tier_features (id, tier_id, group_name, feature_key, feature_label, feature_value, is_included, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, tier_id, group_name, feature_key, feature_label, feature_value || null, is_included !== false, 0, now, now]
    );
    const result = await pool.query('SELECT * FROM tier_features WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'TIER_FEATURE', id, { tier_id, group_name, feature_key }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create tier feature error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/tier-features/:feature_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { feature_id } = req.params;
    const { feature_label, feature_value, is_included, sort_order } = req.body;
    const existing = await pool.query('SELECT * FROM tier_features WHERE id = $1', [feature_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Tier feature not found' });
    const updates = [];
    const params = [];
    if (feature_label !== undefined) { params.push(feature_label); updates.push(`feature_label = $${params.length}`); }
    if (feature_value !== undefined) { params.push(feature_value); updates.push(`feature_value = $${params.length}`); }
    if (is_included !== undefined) { params.push(is_included); updates.push(`is_included = $${params.length}`); }
    if (sort_order !== undefined) { params.push(sort_order); updates.push(`sort_order = $${params.length}`); }
    if (updates.length > 0) {
      params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`);
      params.push(feature_id);
      await pool.query(`UPDATE tier_features SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    const result = await pool.query('SELECT * FROM tier_features WHERE id = $1', [feature_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'TIER_FEATURE', feature_id, req.body, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update tier feature error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/tier-features/:feature_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { feature_id } = req.params;
    const existing = await pool.query('SELECT * FROM tier_features WHERE id = $1', [feature_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Tier feature not found' });
    await pool.query('DELETE FROM tier_features WHERE id = $1', [feature_id]);
    await createAuditLog(req.user.id, 'DELETE', 'TIER_FEATURE', feature_id, null, req.ip);
    res.status(204).send();
  } catch (error) {
    console.error('Delete tier feature error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// BATCH 3: Content Management (Gallery, Case Studies, Marketing)
// =====================================================

app.get('/api/admin/gallery-images', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    let query = 'SELECT * FROM gallery_images';
    const params = [];
    if (category) {
      params.push(`%${category}%`);
      query += ` WHERE categories LIKE $${params.length}`;
    }
    query += ' ORDER BY sort_order, created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List admin gallery images error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/gallery-images', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { title, image_url, thumbnail_url, description, alt_text, categories } = req.body;
    if (!title || !image_url) return res.status(400).json({ message: 'title and image_url required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO gallery_images (id, title, image_url, thumbnail_url, description, alt_text, categories, is_active, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [id, title, image_url, thumbnail_url || null, description || null, alt_text || null, categories || null, true, 0, now, now]
    );
    const result = await pool.query('SELECT * FROM gallery_images WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'GALLERY_IMAGE', id, { title }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create gallery image error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/gallery-images/:image_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { image_id } = req.params;
    const { title, description, alt_text, categories, is_active, sort_order } = req.body;
    const existing = await pool.query('SELECT * FROM gallery_images WHERE id = $1', [image_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Gallery image not found' });
    const updates = [];
    const params = [];
    if (title !== undefined) { params.push(title); updates.push(`title = $${params.length}`); }
    if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
    if (alt_text !== undefined) { params.push(alt_text); updates.push(`alt_text = $${params.length}`); }
    if (categories !== undefined) { params.push(categories); updates.push(`categories = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    if (sort_order !== undefined) { params.push(sort_order); updates.push(`sort_order = $${params.length}`); }
    if (updates.length > 0) {
      params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`);
      params.push(image_id);
      await pool.query(`UPDATE gallery_images SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    const result = await pool.query('SELECT * FROM gallery_images WHERE id = $1', [image_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'GALLERY_IMAGE', image_id, req.body, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update gallery image error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/gallery-images/:image_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { image_id } = req.params;
    const existing = await pool.query('SELECT * FROM gallery_images WHERE id = $1', [image_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Gallery image not found' });
    await pool.query('UPDATE gallery_images SET is_active = false, updated_at = $1 WHERE id = $2', [new Date().toISOString(), image_id]);
    await createAuditLog(req.user.id, 'DELETE', 'GALLERY_IMAGE', image_id, null, req.ip);
    res.status(204).send();
  } catch (error) {
    console.error('Delete gallery image error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/case-studies', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT cs.*, s.name as service_name, t.name as tier_name, g.image_url FROM case_studies cs LEFT JOIN services s ON cs.service_id = s.id LEFT JOIN tier_packages t ON cs.tier_id = t.id LEFT JOIN gallery_images g ON cs.gallery_image_id = g.id ORDER BY cs.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List admin case studies error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/case-studies', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { slug, title, service_id, tier_id, gallery_image_id, description, client_testimonial, is_published } = req.body;
    if (!slug || !title || !service_id || !tier_id || !gallery_image_id) {
      return res.status(400).json({ message: 'slug, title, service_id, tier_id, and gallery_image_id required' });
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO case_studies (id, slug, title, service_id, tier_id, gallery_image_id, description, client_testimonial, additional_images, is_published, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [id, slug, title, service_id, tier_id, gallery_image_id, description || null, client_testimonial || null, null, is_published !== false, now, now]
    );
    const result = await pool.query('SELECT * FROM case_studies WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'CASE_STUDY', id, { slug, title }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create case study error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/marketing-content', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const page_key = req.query.page_key as string | undefined;
    let query = 'SELECT * FROM marketing_content';
    const params = [];
    if (page_key) {
      params.push(page_key);
      query += ` WHERE page_key = $${params.length}`;
    }
    query += ' ORDER BY page_key, section_key';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List marketing content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/marketing-content', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { page_key, section_key, content } = req.body;
    if (!page_key || !section_key) return res.status(400).json({ message: 'page_key and section_key required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO marketing_content (id, page_key, section_key, content, updated_at) VALUES ($1, $2, $3, $4, $5)',
      [id, page_key, section_key, content || '', now]
    );
    const result = await pool.query('SELECT * FROM marketing_content WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'MARKETING_CONTENT', id, { page_key, section_key }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create marketing content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/marketing-content/:content_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { content_id } = req.params;
    const { content } = req.body;
    const existing = await pool.query('SELECT * FROM marketing_content WHERE id = $1', [content_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Marketing content not found' });
    await pool.query('UPDATE marketing_content SET content = $1, updated_at = $2 WHERE id = $3', [content, new Date().toISOString(), content_id]);
    const result = await pool.query('SELECT * FROM marketing_content WHERE id = $1', [content_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'MARKETING_CONTENT', content_id, { content }, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update marketing content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// BATCH 4: Contact Inquiries Management
// =====================================================

app.get('/api/admin/contact-inquiries', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    let query = 'SELECT * FROM contact_inquiries';
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE status = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List contact inquiries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/contact-inquiries/:inquiry_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { inquiry_id } = req.params;
    const { status } = req.body;
    const existing = await pool.query('SELECT * FROM contact_inquiries WHERE id = $1', [inquiry_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Contact inquiry not found' });
    const validStatuses = ['NEW', 'CONTACTED', 'CONVERTED'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    if (status) {
      await pool.query('UPDATE contact_inquiries SET status = $1 WHERE id = $2', [status, inquiry_id]);
    }
    const result = await pool.query('SELECT * FROM contact_inquiries WHERE id = $1', [inquiry_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'CONTACT_INQUIRY', inquiry_id, { status }, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update contact inquiry error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// BATCH 5: Phase 2 - B2B Accounts Management
// =====================================================

app.get('/api/admin/b2b-accounts', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    let query = `SELECT a.*, u.name as main_contact_name, u.email as main_contact_email,
      (SELECT COUNT(*) FROM b2b_locations l WHERE l.account_id = a.id) as locations_count
      FROM b2b_accounts a LEFT JOIN users u ON a.main_contact_user_id = u.id`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE a.company_name ILIKE $${params.length}`;
    }
    query += ' ORDER BY a.created_at DESC';
    const result = await pool.query(query, params);
    const formatted = result.rows.map(row => ({
      account: { id: row.id, company_name: row.company_name, main_contact_user_id: row.main_contact_user_id, contract_start: row.contract_start, contract_end: row.contract_end, terms: row.terms, payment_terms: row.payment_terms, is_active: row.is_active, created_at: row.created_at, updated_at: row.updated_at },
      main_contact: { id: row.main_contact_user_id, name: row.main_contact_name, email: row.main_contact_email },
      locations_count: parseInt(row.locations_count)
    }));
    res.json(formatted);
  } catch (error) {
    console.error('List B2B accounts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/b2b-accounts', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { company_name, main_contact_user_id, contract_start, contract_end, terms, payment_terms } = req.body;
    if (!company_name || !main_contact_user_id) return res.status(400).json({ message: 'company_name and main_contact_user_id required' });
    const validPaymentTerms = ['NET_15', 'NET_30', 'NET_45', 'NET_60'];
    if (payment_terms && !validPaymentTerms.includes(payment_terms)) return res.status(400).json({ message: 'Invalid payment_terms' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO b2b_accounts (id, company_name, main_contact_user_id, contract_start, contract_end, terms, payment_terms, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, company_name, main_contact_user_id, contract_start || null, contract_end || null, terms || null, payment_terms || 'NET_30', true, now, now]
    );
    const result = await pool.query('SELECT * FROM b2b_accounts WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'B2B_ACCOUNT', id, { company_name }, req.ip);
    emitEvent('b2b/account_created', { event_type: 'b2b_account_created', timestamp: now, account_id: id, company_name, main_contact_user_id });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create B2B account error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/b2b-accounts/:account_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { account_id } = req.params;
    const accountRes = await pool.query('SELECT * FROM b2b_accounts WHERE id = $1', [account_id]);
    if (accountRes.rows.length === 0) return res.status(404).json({ message: 'B2B account not found' });
    const account = accountRes.rows[0];
    const contactRes = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [account.main_contact_user_id]);
    const locationsRes = await pool.query('SELECT * FROM b2b_locations WHERE account_id = $1 ORDER BY label', [account_id]);
    const pricingRes = await pool.query('SELECT * FROM contract_pricing WHERE account_id = $1', [account_id]);
    res.json({
      account,
      main_contact: contactRes.rows[0] || null,
      locations: locationsRes.rows,
      contract_pricing: pricingRes.rows
    });
  } catch (error) {
    console.error('Get B2B account error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/b2b-accounts/:account_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { account_id } = req.params;
    const { company_name, contract_end, terms, is_active, payment_terms } = req.body;
    const existing = await pool.query('SELECT * FROM b2b_accounts WHERE id = $1', [account_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'B2B account not found' });
    const updates = [];
    const params = [];
    if (company_name !== undefined) { params.push(company_name); updates.push(`company_name = $${params.length}`); }
    if (contract_end !== undefined) { params.push(contract_end); updates.push(`contract_end = $${params.length}`); }
    if (terms !== undefined) { params.push(terms); updates.push(`terms = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    if (payment_terms !== undefined) { params.push(payment_terms); updates.push(`payment_terms = $${params.length}`); }
    if (updates.length > 0) {
      params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`);
      params.push(account_id);
      await pool.query(`UPDATE b2b_accounts SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    const result = await pool.query('SELECT * FROM b2b_accounts WHERE id = $1', [account_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'B2B_ACCOUNT', account_id, req.body, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update B2B account error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/b2b-locations', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { account_id, label, address, contact_name, contact_phone } = req.body;
    if (!account_id || !label || !address) return res.status(400).json({ message: 'account_id, label, and address required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO b2b_locations (id, account_id, label, address, contact_name, contact_phone, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, account_id, label, address, contact_name || null, contact_phone || null, true, now, now]
    );
    const result = await pool.query('SELECT * FROM b2b_locations WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'B2B_LOCATION', id, { account_id, label }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create B2B location error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/b2b-locations/:location_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { location_id } = req.params;
    const { label, address, contact_name, contact_phone, is_active } = req.body;
    const existing = await pool.query('SELECT * FROM b2b_locations WHERE id = $1', [location_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'B2B location not found' });
    const updates = [];
    const params = [];
    if (label !== undefined) { params.push(label); updates.push(`label = $${params.length}`); }
    if (address !== undefined) { params.push(address); updates.push(`address = $${params.length}`); }
    if (contact_name !== undefined) { params.push(contact_name); updates.push(`contact_name = $${params.length}`); }
    if (contact_phone !== undefined) { params.push(contact_phone); updates.push(`contact_phone = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    if (updates.length > 0) {
      params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`);
      params.push(location_id);
      await pool.query(`UPDATE b2b_locations SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    const result = await pool.query('SELECT * FROM b2b_locations WHERE id = $1', [location_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'B2B_LOCATION', location_id, req.body, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update B2B location error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/b2b-locations/:location_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { location_id } = req.params;
    const existing = await pool.query('SELECT * FROM b2b_locations WHERE id = $1', [location_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'B2B location not found' });
    await pool.query('DELETE FROM b2b_locations WHERE id = $1', [location_id]);
    await createAuditLog(req.user.id, 'DELETE', 'B2B_LOCATION', location_id, null, req.ip);
    res.status(204).send();
  } catch (error) {
    console.error('Delete B2B location error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/contract-pricing', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { account_id, service_id, pricing_json } = req.body;
    if (!account_id || !service_id || !pricing_json) return res.status(400).json({ message: 'account_id, service_id, and pricing_json required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO contract_pricing (id, account_id, service_id, pricing_json, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, account_id, service_id, pricing_json, now, now]
    );
    const result = await pool.query('SELECT * FROM contract_pricing WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'CONTRACT_PRICING', id, { account_id, service_id }, req.ip);
    emitEvent('b2b/contract_pricing_updated', { event_type: 'b2b_contract_pricing_updated', timestamp: now, account_id, service_id, pricing_json });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create contract pricing error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/contract-pricing/:pricing_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { pricing_id } = req.params;
    const { pricing_json } = req.body;
    const existing = await pool.query('SELECT * FROM contract_pricing WHERE id = $1', [pricing_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Contract pricing not found' });
    if (pricing_json) {
      await pool.query('UPDATE contract_pricing SET pricing_json = $1, updated_at = $2 WHERE id = $3', [pricing_json, new Date().toISOString(), pricing_id]);
    }
    const result = await pool.query('SELECT * FROM contract_pricing WHERE id = $1', [pricing_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'CONTRACT_PRICING', pricing_id, { pricing_json }, req.ip);
    emitEvent('b2b/contract_pricing_updated', { event_type: 'b2b_contract_pricing_updated', timestamp: new Date().toISOString(), account_id: existing.rows[0].account_id, service_id: existing.rows[0].service_id, pricing_json });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update contract pricing error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// BATCH 6: Phase 2 - Inventory Management
// =====================================================

app.get('/api/admin/inventory-items', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const low_stock = req.query.low_stock as string | undefined;
    const is_active = req.query.is_active as string | undefined;
    let query = 'SELECT * FROM inventory_items';
    const conditions = [];
    const params = [];
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      conditions.push(`is_active = $${params.length}`);
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    const formatted = result.rows.map(item => {
      let stock_status = 'in_stock';
      if (parseFloat(item.qty_on_hand) <= 0) stock_status = 'out_of_stock';
      else if (parseFloat(item.qty_on_hand) <= parseFloat(item.reorder_point)) stock_status = 'low_stock';
      return { item, stock_status };
    });
    if (low_stock === 'true') {
      res.json(formatted.filter(f => f.stock_status === 'low_stock' || f.stock_status === 'out_of_stock'));
    } else {
      res.json(formatted);
    }
  } catch (error) {
    console.error('List inventory items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/inventory-items', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { sku, name, unit, qty_on_hand, reorder_point, reorder_qty, supplier_name, cost_per_unit } = req.body;
    if (!sku || !name || !unit) return res.status(400).json({ message: 'sku, name, and unit required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO inventory_items (id, sku, name, unit, qty_on_hand, reorder_point, reorder_qty, supplier_name, cost_per_unit, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [id, sku, name, unit, qty_on_hand || 0, reorder_point || 0, reorder_qty || 0, supplier_name || null, cost_per_unit || 0, true, now, now]
    );
    const result = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'INVENTORY_ITEM', id, { sku, name }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/inventory-items/:item_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { item_id } = req.params;
    const { qty_on_hand, reorder_point, reorder_qty, cost_per_unit, is_active, supplier_name } = req.body;
    const existing = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [item_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Inventory item not found' });
    const updates = [];
    const params = [];
    if (qty_on_hand !== undefined) { params.push(qty_on_hand); updates.push(`qty_on_hand = $${params.length}`); }
    if (reorder_point !== undefined) { params.push(reorder_point); updates.push(`reorder_point = $${params.length}`); }
    if (reorder_qty !== undefined) { params.push(reorder_qty); updates.push(`reorder_qty = $${params.length}`); }
    if (cost_per_unit !== undefined) { params.push(cost_per_unit); updates.push(`cost_per_unit = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    if (supplier_name !== undefined) { params.push(supplier_name); updates.push(`supplier_name = $${params.length}`); }
    if (updates.length > 0) {
      params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`);
      params.push(item_id);
      await pool.query(`UPDATE inventory_items SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    const result = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [item_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'INVENTORY_ITEM', item_id, req.body, req.ip);
    // Check low stock alert
    const item = result.rows[0];
    if (parseFloat(item.qty_on_hand) <= parseFloat(item.reorder_point) && parseFloat(item.qty_on_hand) > 0) {
      emitEvent('inventory/low_stock_alert', { event_type: 'inventory_low_stock_alert', timestamp: new Date().toISOString(), inventory_item_id: item_id, sku: item.sku, name: item.name, qty_on_hand: item.qty_on_hand, reorder_point: item.reorder_point });
    } else if (parseFloat(item.qty_on_hand) <= 0) {
      emitEvent('inventory/out_of_stock', { event_type: 'inventory_out_of_stock', timestamp: new Date().toISOString(), inventory_item_id: item_id, sku: item.sku, name: item.name });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/inventory-transactions', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const inventory_item_id = req.query.inventory_item_id as string | undefined;
    let query = 'SELECT * FROM inventory_transactions';
    const params = [];
    if (inventory_item_id) {
      params.push(inventory_item_id);
      query += ` WHERE inventory_item_id = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List inventory transactions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/material-consumption-rules', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const service_id = req.query.service_id as string | undefined;
    let query = `SELECT r.*, s.name as service_name, s.slug as service_slug, i.sku, i.name as item_name, i.unit, i.qty_on_hand
      FROM material_consumption_rules r
      LEFT JOIN services s ON r.service_id = s.id
      LEFT JOIN inventory_items i ON r.inventory_item_id = i.id`;
    const params = [];
    if (service_id) {
      params.push(service_id);
      query += ` WHERE r.service_id = $${params.length}`;
    }
    query += ' ORDER BY s.name, i.name';
    const result = await pool.query(query, params);
    const formatted = result.rows.map(row => ({
      rule: { id: row.id, service_id: row.service_id, inventory_item_id: row.inventory_item_id, rule_json: row.rule_json, created_at: row.created_at, updated_at: row.updated_at },
      service: { id: row.service_id, name: row.service_name, slug: row.service_slug },
      inventory_item: { id: row.inventory_item_id, sku: row.sku, name: row.item_name, unit: row.unit, qty_on_hand: row.qty_on_hand }
    }));
    res.json(formatted);
  } catch (error) {
    console.error('List consumption rules error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/material-consumption-rules', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { service_id, inventory_item_id, rule_json } = req.body;
    if (!service_id || !inventory_item_id || !rule_json) return res.status(400).json({ message: 'service_id, inventory_item_id, and rule_json required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO material_consumption_rules (id, service_id, inventory_item_id, rule_json, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, service_id, inventory_item_id, rule_json, now, now]
    );
    const result = await pool.query('SELECT * FROM material_consumption_rules WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'CONSUMPTION_RULE', id, { service_id, inventory_item_id }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create consumption rule error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/purchase-orders', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    let query = 'SELECT * FROM purchase_orders';
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE status = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    const formatted = [];
    for (const po of result.rows) {
      const items = await pool.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [po.id]);
      formatted.push({ purchase_order: po, items: items.rows });
    }
    res.json(formatted);
  } catch (error) {
    console.error('List purchase orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/purchase-orders', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { supplier_name, notes } = req.body;
    if (!supplier_name) return res.status(400).json({ message: 'supplier_name required' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO purchase_orders (id, supplier_name, status, ordered_at, received_at, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, supplier_name, 'DRAFT', null, null, notes || null, now, now]
    );
    const result = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'PURCHASE_ORDER', id, { supplier_name }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/purchase-orders/:po_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { po_id } = req.params;
    const { status, ordered_at, received_at, notes } = req.body;
    const existing = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [po_id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Purchase order not found' });
    const oldStatus = existing.rows[0].status;
    const updates = [];
    const params = [];
    if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
    if (ordered_at !== undefined) { params.push(ordered_at); updates.push(`ordered_at = $${params.length}`); }
    if (received_at !== undefined) { params.push(received_at); updates.push(`received_at = $${params.length}`); }
    if (notes !== undefined) { params.push(notes); updates.push(`notes = $${params.length}`); }
    if (updates.length > 0) {
      params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`);
      params.push(po_id);
      await pool.query(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    const result = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [po_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'PURCHASE_ORDER', po_id, req.body, req.ip);
    if (status && status !== oldStatus) {
      emitEvent('purchase_order/status_updated', { event_type: 'purchase_order_status_updated', timestamp: new Date().toISOString(), purchase_order_id: po_id, old_status: oldStatus, new_status: status });
    }
    // If received, update inventory
    if (status === 'RECEIVED' && oldStatus !== 'RECEIVED') {
      const items = await pool.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [po_id]);
      for (const item of items.rows) {
        await pool.query('UPDATE inventory_items SET qty_on_hand = qty_on_hand + $1, updated_at = $2 WHERE id = $3', [item.qty, new Date().toISOString(), item.inventory_item_id]);
        const txId = uuidv4();
        await pool.query(
          'INSERT INTO inventory_transactions (id, inventory_item_id, transaction_type, qty, reference_type, reference_id, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [txId, item.inventory_item_id, 'ADDITION', item.qty, 'PURCHASE_ORDER', po_id, 'Restocked from PO', new Date().toISOString()]
        );
      }
      emitEvent('inventory/restock_completed', { event_type: 'inventory_restock_completed', timestamp: new Date().toISOString(), purchase_order_id: po_id });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update purchase order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// BATCH 7: Phase 2 - Analytics Dashboards
// =====================================================

app.get('/api/admin/analytics/dashboard', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const period = req.query.period as string || 'last_30_days';
    let dateFilter = '';
    const now = new Date();
    if (period === 'last_7_days') dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    else if (period === 'last_30_days') dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    else if (period === 'last_90_days') dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    else if (period === 'this_year') dateFilter = new Date(now.getFullYear(), 0, 1).toISOString();
    else dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Revenue metrics
    const revenueRes = await pool.query(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM orders WHERE created_at >= $1 AND status = 'COMPLETED'`, [dateFilter]);
    const totalRevenue = parseFloat(revenueRes.rows[0].total) || 0;
    const orderCount = parseInt(revenueRes.rows[0].count) || 0;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Revenue by service
    const revByServiceRes = await pool.query(`SELECT s.name, COALESCE(SUM(o.total_amount), 0) as revenue FROM orders o JOIN quotes q ON o.quote_id = q.id JOIN services s ON q.service_id = s.id WHERE o.created_at >= $1 AND o.status = 'COMPLETED' GROUP BY s.name ORDER BY revenue DESC LIMIT 10`, [dateFilter]);
    const revenueByService = revByServiceRes.rows.map(r => ({ service_name: r.name, revenue: parseFloat(r.revenue) }));

    // Revenue by tier
    const revByTierRes = await pool.query(`SELECT t.name, COALESCE(SUM(o.total_amount), 0) as revenue FROM orders o JOIN tier_packages t ON o.tier_id = t.id WHERE o.created_at >= $1 AND o.status = 'COMPLETED' GROUP BY t.name ORDER BY revenue DESC`, [dateFilter]);
    const revenueByTier = revByTierRes.rows.map(r => ({ tier_name: r.name, revenue: parseFloat(r.revenue) }));

    // Conversion funnel (simplified)
    const quotesSubmitted = await pool.query(`SELECT COUNT(*) FROM quotes WHERE created_at >= $1`, [dateFilter]);
    const quotesFinalized = await pool.query(`SELECT COUNT(*) FROM quotes WHERE created_at >= $1 AND status = 'APPROVED'`, [dateFilter]);
    const ordersCreated = await pool.query(`SELECT COUNT(*) FROM orders WHERE created_at >= $1`, [dateFilter]);
    const ordersCompleted = await pool.query(`SELECT COUNT(*) FROM orders WHERE created_at >= $1 AND status = 'COMPLETED'`, [dateFilter]);
    const depositsRes = await pool.query(`SELECT COUNT(*) FROM payments WHERE created_at >= $1 AND status = 'COMPLETED'`, [dateFilter]);

    // Turnaround performance
    const completedOrders = await pool.query(`SELECT o.*, t.name as tier_name FROM orders o JOIN tier_packages t ON o.tier_id = t.id WHERE o.created_at >= $1 AND o.status = 'COMPLETED'`, [dateFilter]);
    const turnaroundByTier = {};
    let onTime = 0, delayed = 0;
    for (const order of completedOrders.rows) {
      const tierName = order.tier_name;
      const created = new Date(order.created_at);
      const updated = new Date(order.updated_at);
      const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
      if (!turnaroundByTier[tierName]) turnaroundByTier[tierName] = [];
      turnaroundByTier[tierName].push(hours);
      if (order.due_at) {
        const due = new Date(order.due_at);
        if (updated <= due) onTime++; else delayed++;
      }
    }
    const avgTurnaroundByTier = {};
    for (const [tier, hours] of Object.entries(turnaroundByTier)) {
      avgTurnaroundByTier[tier] = (hours as number[]).reduce((a, b) => a + b, 0) / (hours as number[]).length;
    }
    const totalForPercentage = onTime + delayed;
    const onTimePercentage = totalForPercentage > 0 ? (onTime / totalForPercentage) * 100 : 100;
    const delayedPercentage = totalForPercentage > 0 ? (delayed / totalForPercentage) * 100 : 0;

    // Emergency bookings
    const emergencyRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(o.total_amount), 0) as revenue FROM bookings b JOIN orders o ON o.quote_id = b.quote_id WHERE b.is_emergency = true AND b.created_at >= $1`, [dateFilter]);
    const emergencyCount = parseInt(emergencyRes.rows[0].count) || 0;
    const emergencyRevenue = parseFloat(emergencyRes.rows[0].revenue) || 0;
    const emergencyPercentage = orderCount > 0 ? (emergencyCount / orderCount) * 100 : 0;

    // Outstanding payments
    const pendingDeposits = await pool.query(`SELECT COALESCE(SUM(deposit_amount), 0) as total FROM orders WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND created_at >= $1`, [dateFilter]);
    const pendingBalance = await pool.query(`SELECT COALESCE(SUM(total_amount - deposit_amount), 0) as total FROM orders WHERE status IN ('IN_PRODUCTION', 'PROOF_SENT', 'AWAITING_APPROVAL', 'READY_FOR_PICKUP') AND created_at >= $1`, [dateFilter]);

    // Top customers
    const topCustomersRes = await pool.query(`SELECT u.name, COALESCE(SUM(o.total_amount), 0) as revenue, COUNT(*) as order_count, MAX(o.created_at) as last_order FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.created_at >= $1 AND o.status = 'COMPLETED' GROUP BY u.id, u.name ORDER BY revenue DESC LIMIT 10`, [dateFilter]);
    const topCustomers = topCustomersRes.rows.map(r => ({ customer_name: r.name, total_revenue: parseFloat(r.revenue), order_count: parseInt(r.order_count), last_order_date: r.last_order }));

    res.json({
      conversion_funnel: {
        visited_site: 0, // Would need analytics integration
        started_quote: 0,
        submitted_quote: parseInt(quotesSubmitted.rows[0].count),
        quote_finalized: parseInt(quotesFinalized.rows[0].count),
        deposit_paid: parseInt(depositsRes.rows[0].count),
        order_completed: parseInt(ordersCompleted.rows[0].count)
      },
      revenue_metrics: {
        total_revenue: totalRevenue,
        average_order_value: avgOrderValue,
        revenue_by_service: revenueByService,
        revenue_by_tier: revenueByTier
      },
      turnaround_performance: {
        avg_turnaround_by_tier: avgTurnaroundByTier,
        on_time_percentage: onTimePercentage,
        delayed_percentage: delayedPercentage
      },
      emergency_bookings: {
        total_count: emergencyCount,
        total_revenue: emergencyRevenue,
        percentage_of_total: emergencyPercentage
      },
      outstanding_payments: {
        total_deposits_pending: parseFloat(pendingDeposits.rows[0].total) || 0,
        total_balance_due: parseFloat(pendingBalance.rows[0].total) || 0,
        aging_report: { '0-7': 0, '8-14': 0, '15-30': 0, '30+': 0 } // Simplified
      },
      top_customers: topCustomers
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/analytics/sla', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    // Get all active orders
    const ordersRes = await pool.query(`
      SELECT o.*, u.name as customer_name, s.name as service_name, t.name as tier_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN quotes q ON o.quote_id = q.id
      LEFT JOIN services s ON q.service_id = s.id
      LEFT JOIN tier_packages t ON o.tier_id = t.id
      WHERE o.status NOT IN ('COMPLETED', 'CANCELLED')
      ORDER BY o.due_at ASC
    `);

    const now = new Date();
    const atRiskJobs = [];
    const breachedJobs = [];
    let meetingSLA = 0;
    let breachedSLA = 0;

    for (const order of ordersRes.rows) {
      if (!order.due_at) continue;
      const dueDate = new Date(order.due_at);
      const hoursRemaining = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursRemaining < 0) {
        const daysOverdue = Math.abs(hoursRemaining) / 24;
        breachedJobs.push({ order, customer_name: order.customer_name, service_name: order.service_name, tier_name: order.tier_name, days_overdue: Math.round(daysOverdue * 10) / 10 });
        breachedSLA++;
      } else if (hoursRemaining <= 4) {
        atRiskJobs.push({ order, customer_name: order.customer_name, service_name: order.service_name, tier_name: order.tier_name, hours_remaining: Math.round(hoursRemaining * 10) / 10 });
      } else {
        meetingSLA++;
      }
    }

    const total = meetingSLA + breachedSLA + atRiskJobs.length;
    const meetingPercentage = total > 0 ? ((meetingSLA + atRiskJobs.length) / total) * 100 : 100;
    const breachedPercentage = total > 0 ? (breachedSLA / total) * 100 : 0;

    // Avg completion time by tier
    const completedRes = await pool.query(`
      SELECT t.name as tier_name, o.created_at, o.updated_at
      FROM orders o
      JOIN tier_packages t ON o.tier_id = t.id
      WHERE o.status = 'COMPLETED'
      ORDER BY o.updated_at DESC LIMIT 100
    `);
    const completionByTier = {};
    for (const order of completedRes.rows) {
      const created = new Date(order.created_at);
      const updated = new Date(order.updated_at);
      const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
      if (!completionByTier[order.tier_name]) completionByTier[order.tier_name] = [];
      completionByTier[order.tier_name].push(hours);
    }
    const avgCompletionTime = {};
    for (const [tier, hours] of Object.entries(completionByTier)) {
      avgCompletionTime[tier] = (hours as number[]).reduce((a, b) => a + b, 0) / (hours as number[]).length;
    }

    res.json({
      sla_performance: {
        meeting_sla_percentage: Math.round(meetingPercentage * 10) / 10,
        breached_sla_percentage: Math.round(breachedPercentage * 10) / 10,
        avg_completion_time: avgCompletionTime
      },
      at_risk_jobs: atRiskJobs,
      breached_jobs: breachedJobs
    });
  } catch (error) {
    console.error('SLA dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// PRODUCTS & E-COMMERCE ENDPOINTS
// =====================================================

// Public: Get all products
app.get('/api/public/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `SELECT p.*, pc.name as category_name, pc.slug as category_slug
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.is_active = true`;
    const params: any[] = [];
    
    if (category) {
      params.push(category);
      query += ` AND pc.slug = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }
    query += ' ORDER BY p.name';
    
    const productsRes = await pool.query(query, params);
    const categoriesRes = await pool.query('SELECT * FROM product_categories WHERE is_active = true ORDER BY sort_order');
    
    // Get min price for each product
    const products = [];
    for (const product of productsRes.rows) {
      const variantRes = await pool.query(
        'SELECT MIN(total_price) as min_price FROM product_variants WHERE product_id = $1 AND is_active = true',
        [product.id]
      );
      products.push({
        ...product,
        from_price: variantRes.rows[0]?.min_price || product.base_price
      });
    }
    
    res.json({ products, categories: categoriesRes.rows });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Public: Get product categories
app.get('/api/public/product-categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM product_categories WHERE is_active = true ORDER BY sort_order');
    res.json(result.rows);
  } catch (error) {
    console.error('List product categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Public: Get single product with variants
app.get('/api/public/products/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const productRes = await pool.query(
      `SELECT p.*, pc.name as category_name, pc.slug as category_slug
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.slug = $1 AND p.is_active = true`,
      [slug]
    );
    
    if (productRes.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const product = productRes.rows[0];
    const variantsRes = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = $1 AND is_active = true ORDER BY sort_order',
      [product.id]
    );
    const imagesRes = await pool.query(
      'SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order',
      [product.id]
    );
    
    // Parse config_schema if it exists
    let configSchema = null;
    if (product.config_schema) {
      try {
        configSchema = JSON.parse(product.config_schema);
      } catch (e) {
        configSchema = null;
      }
    }
    
    res.json({
      product: { ...product, config_schema: configSchema },
      variants: variantsRes.rows,
      images: imagesRes.rows
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get or create cart (works for both guests and logged-in users)
app.get('/api/cart', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = null;
    let guestId = req.headers['x-guest-id'] as string || null;
    
    // Try to authenticate if token provided
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        const userRes = await pool.query('SELECT id FROM users WHERE id = $1 AND is_active = true', [decoded.user_id]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
        }
      } catch (e) {
        // Token invalid, continue as guest
      }
    }
    
    // Find existing cart
    let cartRes;
    if (userId) {
      cartRes = await pool.query('SELECT * FROM carts WHERE user_id = $1', [userId]);
    } else if (guestId) {
      cartRes = await pool.query('SELECT * FROM carts WHERE guest_id = $1', [guestId]);
    }
    
    let cart;
    if (!cartRes || cartRes.rows.length === 0) {
      // Create new cart
      const cartId = uuidv4();
      const newGuestId = guestId || uuidv4();
      const now = new Date().toISOString();
      await pool.query(
        'INSERT INTO carts (id, user_id, guest_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [cartId, userId, userId ? null : newGuestId, now, now]
      );
      cart = { id: cartId, user_id: userId, guest_id: userId ? null : newGuestId, created_at: now, updated_at: now };
      guestId = newGuestId;
    } else {
      cart = cartRes.rows[0];
    }
    
    // Get cart items with product info
    const itemsRes = await pool.query(`
      SELECT ci.*, p.name as product_name, p.slug as product_slug, p.thumbnail_url,
             pv.label as variant_label, pv.quantity as variant_quantity
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_variants pv ON ci.product_variant_id = pv.id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at
    `, [cart.id]);
    
    // Calculate totals
    let subtotal = 0;
    const items = itemsRes.rows.map(item => {
      subtotal += parseFloat(item.total_price);
      return {
        ...item,
        config: item.config_snapshot ? JSON.parse(item.config_snapshot) : null
      };
    });
    
    res.json({
      cart,
      items,
      subtotal,
      guest_id: cart.guest_id
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add item to cart
app.post('/api/cart/items', async (req, res) => {
  try {
    const { product_id, product_variant_id, quantity, config } = req.body;
    
    if (!product_id || !quantity) {
      return res.status(400).json({ message: 'product_id and quantity required' });
    }
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = null;
    let guestId = req.headers['x-guest-id'] as string || null;
    
    // Authenticate if token provided
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        const userRes = await pool.query('SELECT id FROM users WHERE id = $1 AND is_active = true', [decoded.user_id]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
        }
      } catch (e) {}
    }
    
    // Find or create cart
    let cartRes;
    if (userId) {
      cartRes = await pool.query('SELECT * FROM carts WHERE user_id = $1', [userId]);
    } else if (guestId) {
      cartRes = await pool.query('SELECT * FROM carts WHERE guest_id = $1', [guestId]);
    }
    
    let cart;
    if (!cartRes || cartRes.rows.length === 0) {
      const cartId = uuidv4();
      const newGuestId = guestId || uuidv4();
      const now = new Date().toISOString();
      await pool.query(
        'INSERT INTO carts (id, user_id, guest_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [cartId, userId, userId ? null : newGuestId, now, now]
      );
      cart = { id: cartId, guest_id: userId ? null : newGuestId };
      guestId = newGuestId;
    } else {
      cart = cartRes.rows[0];
    }
    
    // Get pricing from variant or product
    let unitPrice = 0;
    let totalPrice = 0;
    
    if (product_variant_id) {
      const variantRes = await pool.query('SELECT * FROM product_variants WHERE id = $1', [product_variant_id]);
      if (variantRes.rows.length > 0) {
        unitPrice = parseFloat(variantRes.rows[0].unit_price);
        totalPrice = parseFloat(variantRes.rows[0].total_price);
      }
    } else {
      const productRes = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
      if (productRes.rows.length > 0) {
        unitPrice = parseFloat(productRes.rows[0].base_price);
        totalPrice = unitPrice * quantity;
      }
    }
    
    // Add cart item
    const itemId = uuidv4();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO cart_items (id, cart_id, product_id, product_variant_id, quantity, unit_price, total_price, config_snapshot, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [itemId, cart.id, product_id, product_variant_id || null, quantity, unitPrice, totalPrice, config ? JSON.stringify(config) : null, now, now]
    );
    
    // Update cart timestamp
    await pool.query('UPDATE carts SET updated_at = $1 WHERE id = $2', [now, cart.id]);
    
    const itemRes = await pool.query('SELECT * FROM cart_items WHERE id = $1', [itemId]);
    
    res.status(201).json({
      item: itemRes.rows[0],
      guest_id: cart.guest_id
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update cart item
app.patch('/api/cart/items/:item_id', async (req, res) => {
  try {
    const { item_id } = req.params;
    const { product_variant_id, quantity, config } = req.body;
    
    const existingRes = await pool.query('SELECT * FROM cart_items WHERE id = $1', [item_id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    
    const item = existingRes.rows[0];
    const updates: string[] = [];
    const params: any[] = [];
    
    if (product_variant_id !== undefined) {
      params.push(product_variant_id);
      updates.push(`product_variant_id = $${params.length}`);
      
      // Update pricing
      const variantRes = await pool.query('SELECT * FROM product_variants WHERE id = $1', [product_variant_id]);
      if (variantRes.rows.length > 0) {
        params.push(variantRes.rows[0].unit_price);
        updates.push(`unit_price = $${params.length}`);
        params.push(variantRes.rows[0].total_price);
        updates.push(`total_price = $${params.length}`);
      }
    }
    
    if (quantity !== undefined) {
      params.push(quantity);
      updates.push(`quantity = $${params.length}`);
    }
    
    if (config !== undefined) {
      params.push(JSON.stringify(config));
      updates.push(`config_snapshot = $${params.length}`);
    }
    
    if (updates.length > 0) {
      params.push(new Date().toISOString());
      updates.push(`updated_at = $${params.length}`);
      params.push(item_id);
      await pool.query(`UPDATE cart_items SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    
    const updatedRes = await pool.query('SELECT * FROM cart_items WHERE id = $1', [item_id]);
    res.json(updatedRes.rows[0]);
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove cart item
app.delete('/api/cart/items/:item_id', async (req, res) => {
  try {
    const { item_id } = req.params;
    await pool.query('DELETE FROM cart_items WHERE id = $1', [item_id]);
    res.status(204).send();
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Product checkout (create order from cart)
app.post('/api/checkout/product', async (req, res) => {
  try {
    const { cart_id, guest_name, guest_email, guest_phone, shipping_address, payment_method } = req.body;
    
    if (!cart_id) {
      return res.status(400).json({ message: 'cart_id required' });
    }
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = null;
    
    // Authenticate if token provided
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        const userRes = await pool.query('SELECT id FROM users WHERE id = $1 AND is_active = true', [decoded.user_id]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
        }
      } catch (e) {}
    }
    
    const isLoggedIn = !!userId;
    
    // Guest checkout validation - require name, email, and address for guests
    if (!isLoggedIn) {
      if (!guest_name || !guest_email) {
        return res.status(400).json({ message: 'Guest checkout requires guest_name and guest_email' });
      }
      if (!shipping_address) {
        return res.status(400).json({ message: 'Guest checkout requires shipping_address' });
      }
    }
    
    // Get cart and items
    const cartRes = await pool.query('SELECT * FROM carts WHERE id = $1', [cart_id]);
    if (cartRes.rows.length === 0) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    const itemsRes = await pool.query('SELECT * FROM cart_items WHERE cart_id = $1', [cart_id]);
    if (itemsRes.rows.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    
    // Calculate totals
    let subtotal = 0;
    for (const item of itemsRes.rows) {
      subtotal += parseFloat(item.total_price);
    }
    const taxRate = 0.23;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;
    
    const orderId = uuidv4();
    const now = new Date().toISOString();
    
    // Create product order - customer_id is nullable, guest fields store guest info
    // For logged-in users: customer_id is set, guest_* fields are null
    // For guests: customer_id is null, guest_* fields are filled
    await pool.query(
      `INSERT INTO orders (id, quote_id, customer_id, tier_id, order_type, status, total_subtotal, tax_amount, total_amount, deposit_pct, deposit_amount, guest_name, guest_email, guest_phone, guest_address, created_at, updated_at)
       VALUES ($1, NULL, $2, NULL, 'PRODUCT', 'PAID', $3, $4, $5, 100, $5, $6, $7, $8, $9, $10, $11)`,
      [
        orderId,
        isLoggedIn ? userId : null,
        subtotal,
        taxAmount,
        totalAmount,
        isLoggedIn ? null : guest_name,
        isLoggedIn ? null : guest_email,
        isLoggedIn ? null : (guest_phone || null),
        isLoggedIn ? null : shipping_address,
        now,
        now
      ]
    );
    
    // Create order items
    for (const item of itemsRes.rows) {
      const orderItemId = uuidv4();
      const productRes = await pool.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
      const productName = productRes.rows[0]?.name || 'Product';
      
      await pool.query(
        `INSERT INTO order_items (id, order_id, product_id, product_variant_id, description, quantity, unit_price, total_price, config_snapshot, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [orderItemId, orderId, item.product_id, item.product_variant_id, productName, item.quantity, item.unit_price, item.total_price, item.config_snapshot, now]
      );
    }
    
    // Create payment record
    const paymentId = uuidv4();
    await pool.query(
      `INSERT INTO payments (id, order_id, amount, method, status, transaction_ref, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6, $7)`,
      [paymentId, orderId, totalAmount, payment_method || 'STRIPE', `pi_product_${orderId}`, now, now]
    );
    
    // Create invoice
    const invoiceId = uuidv4();
    const invoiceNumber = `INV-PROD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    await pool.query(
      `INSERT INTO invoices (id, order_id, invoice_number, amount_due, issued_at, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [invoiceId, orderId, invoiceNumber, totalAmount, now, now]
    );
    
    // Clear cart
    await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cart_id]);
    
    // Emit event
    emitEvent('order/product_order_created', {
      event_type: 'product_order_created',
      timestamp: now,
      order_id: orderId,
      total_amount: totalAmount,
      items_count: itemsRes.rows.length,
      is_guest: !isLoggedIn
    });
    
    res.status(201).json({
      order_id: orderId,
      invoice_number: invoiceNumber,
      total_amount: totalAmount,
      status: 'PAID'
    });
  } catch (error: any) {
    console.error('Product checkout error:', error);
    res.status(500).json({ message: `Internal server error: ${error.message}` });
  }
});

// Get product order details
app.get('/api/orders/product/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const order = orderRes.rows[0];
    const itemsRes = await pool.query(`
      SELECT oi.*, p.name as product_name, p.slug as product_slug, p.thumbnail_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [order_id]);
    
    const invoiceRes = await pool.query('SELECT * FROM invoices WHERE order_id = $1', [order_id]);
    const paymentsRes = await pool.query('SELECT * FROM payments WHERE order_id = $1', [order_id]);
    
    res.json({
      order,
      items: itemsRes.rows.map(item => ({
        ...item,
        config: item.config_snapshot ? JSON.parse(item.config_snapshot) : null
      })),
      invoice: invoiceRes.rows[0] || null,
      payments: paymentsRes.rows
    });
  } catch (error) {
    console.error('Get product order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create Stripe payment intent for products
app.post('/api/payments/stripe/create-product-intent', async (req, res) => {
  try {
    const { cart_id, amount } = req.body;
    if (!cart_id || !amount) {
      return res.status(400).json({ message: 'cart_id and amount required' });
    }
    
    // Mock Stripe payment intent
    const clientSecret = `pi_product_${uuidv4()}_secret_${uuidv4()}`;
    const paymentIntentId = `pi_product_${uuidv4()}`;
    
    res.json({
      client_secret: clientSecret,
      payment_intent_id: paymentIntentId
    });
  } catch (error) {
    console.error('Create product payment intent error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// ADMIN: Products Management
// =====================================================

app.get('/api/admin/products', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { category, is_active } = req.query;
    let query = `SELECT p.*, pc.name as category_name, pc.slug as category_slug
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE 1=1`;
    const params: any[] = [];
    
    if (category) {
      params.push(category);
      query += ` AND pc.slug = $${params.length}`;
    }
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND p.is_active = $${params.length}`;
    }
    query += ' ORDER BY p.name';
    
    const productsRes = await pool.query(query, params);
    
    // Get variants count for each product
    const products = [];
    for (const product of productsRes.rows) {
      const variantsRes = await pool.query(
        'SELECT COUNT(*) as count FROM product_variants WHERE product_id = $1',
        [product.id]
      );
      products.push({
        ...product,
        variants_count: parseInt(variantsRes.rows[0].count)
      });
    }
    
    res.json(products);
  } catch (error) {
    console.error('List admin products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/products', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { slug, name, description, base_price, thumbnail_url, category_id, config_schema } = req.body;
    
    if (!slug || !name) {
      return res.status(400).json({ message: 'slug and name required' });
    }
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await pool.query(
      `INSERT INTO products (id, slug, name, description, base_price, thumbnail_url, category_id, is_active, purchase_mode, config_schema, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'DIRECT_ONLY', $8, $9, $10)`,
      [id, slug, name, description || null, base_price || 0, thumbnail_url || null, category_id || null, config_schema ? JSON.stringify(config_schema) : null, now, now]
    );
    
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    await createAuditLog(req.user.id, 'CREATE', 'PRODUCT', id, { slug, name }, req.ip);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/products/:product_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { product_id } = req.params;
    const { name, description, base_price, thumbnail_url, category_id, is_active, config_schema } = req.body;
    
    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
    if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
    if (base_price !== undefined) { params.push(base_price); updates.push(`base_price = $${params.length}`); }
    if (thumbnail_url !== undefined) { params.push(thumbnail_url); updates.push(`thumbnail_url = $${params.length}`); }
    if (category_id !== undefined) { params.push(category_id); updates.push(`category_id = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    if (config_schema !== undefined) { params.push(JSON.stringify(config_schema)); updates.push(`config_schema = $${params.length}`); }
    
    if (updates.length > 0) {
      params.push(new Date().toISOString());
      updates.push(`updated_at = $${params.length}`);
      params.push(product_id);
      await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
    await createAuditLog(req.user.id, 'UPDATE', 'PRODUCT', product_id, req.body, req.ip);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/products/:product_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { product_id } = req.params;
    await pool.query('UPDATE products SET is_active = false, updated_at = $1 WHERE id = $2', [new Date().toISOString(), product_id]);
    await createAuditLog(req.user.id, 'DELETE', 'PRODUCT', product_id, null, req.ip);
    res.status(204).send();
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Product categories admin
app.get('/api/admin/product-categories', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM product_categories ORDER BY sort_order');
    res.json(result.rows);
  } catch (error) {
    console.error('List product categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/product-categories', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, slug, sort_order } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ message: 'name and slug required' });
    }
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await pool.query(
      'INSERT INTO product_categories (id, name, slug, sort_order, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, true, $5, $6)',
      [id, name, slug, sort_order || 0, now, now]
    );
    
    const result = await pool.query('SELECT * FROM product_categories WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product category error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Product variants admin
app.get('/api/admin/products/:product_id/variants', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { product_id } = req.params;
    const result = await pool.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sort_order', [product_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('List product variants error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/products/:product_id/variants', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { product_id } = req.params;
    const { label, quantity, unit_price, total_price, compare_at_price, discount_label, sort_order } = req.body;
    
    if (!label || !quantity) {
      return res.status(400).json({ message: 'label and quantity required' });
    }
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await pool.query(
      `INSERT INTO product_variants (id, product_id, label, quantity, unit_price, total_price, compare_at_price, discount_label, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)`,
      [id, product_id, label, quantity, unit_price || 0, total_price || 0, compare_at_price || null, discount_label || null, sort_order || 0, now, now]
    );
    
    const result = await pool.query('SELECT * FROM product_variants WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product variant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/admin/product-variants/:variant_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { variant_id } = req.params;
    const { label, quantity, unit_price, total_price, compare_at_price, discount_label, sort_order, is_active } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (label !== undefined) { params.push(label); updates.push(`label = $${params.length}`); }
    if (quantity !== undefined) { params.push(quantity); updates.push(`quantity = $${params.length}`); }
    if (unit_price !== undefined) { params.push(unit_price); updates.push(`unit_price = $${params.length}`); }
    if (total_price !== undefined) { params.push(total_price); updates.push(`total_price = $${params.length}`); }
    if (compare_at_price !== undefined) { params.push(compare_at_price); updates.push(`compare_at_price = $${params.length}`); }
    if (discount_label !== undefined) { params.push(discount_label); updates.push(`discount_label = $${params.length}`); }
    if (sort_order !== undefined) { params.push(sort_order); updates.push(`sort_order = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); updates.push(`is_active = $${params.length}`); }
    
    if (updates.length > 0) {
      params.push(new Date().toISOString());
      updates.push(`updated_at = $${params.length}`);
      params.push(variant_id);
      await pool.query(`UPDATE product_variants SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    
    const result = await pool.query('SELECT * FROM product_variants WHERE id = $1', [variant_id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product variant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/product-variants/:variant_id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { variant_id } = req.params;
    await pool.query('DELETE FROM product_variants WHERE id = $1', [variant_id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete product variant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('WebSocket client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('WebSocket client disconnected:', socket.id);
  });
  socket.on('message/typing_indicator', (data) => {
    socket.broadcast.emit('message/typing_indicator_received', { event_type: 'typing_indicator_received', timestamp: new Date().toISOString(), ...data });
  });
});

export { app, pool };

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and listening on 0.0.0.0`);
});