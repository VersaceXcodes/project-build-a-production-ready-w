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
import * as schemas from './schema.js';

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

const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432, JWT_SECRET = 'your-secret-key', PORT = 3000 } = process.env;

const pool = new Pool(
  (DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl: { require: true } }
    : { host: PGHOST, database: PGDATABASE, user: PGUSER, password: PGPASSWORD, port: Number(PGPORT), ssl: { require: true } }) as any
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

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, company_name, address } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email already exists' });
    const userId = uuidv4();
    const userResult = await pool.query(
      'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [userId, name.trim(), email.toLowerCase().trim(), password, 'CUSTOMER', true, new Date().toISOString(), new Date().toISOString()]
    );
    const profileId = uuidv4();
    const profileResult = await pool.query(
      'INSERT INTO customer_profiles (id, user_id, phone, company_name, address, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [profileId, userId, phone || null, company_name || null, address || null, new Date().toISOString(), new Date().toISOString()]
    );
    await pool.query(
      'INSERT INTO notification_preferences (id, user_id, email_order_updates, email_proof_ready, email_messages, email_marketing, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [uuidv4(), userId, true, true, true, false, new Date().toISOString()]
    );
    const token = jwt.sign({ user_id: userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });
    await createAuditLog(userId, 'REGISTER', 'USER', userId, null, req.ip);
    res.status(201).json({ user: userResult.rows[0], customer_profile: profileResult.rows[0], token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    const params = [];
    if (category) {
      params.push(`%${category}%`);
      query += ` AND categories LIKE $${params.length}`;
    }
    query += ' ORDER BY sort_order, created_at DESC';
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ images: result.rows, total: parseInt(totalRes.rows[0].count), page: page, total_pages: Math.ceil(parseInt(totalRes.rows[0].count) / limit) });
  } catch (error) {
    console.error('List gallery error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    let query = 'SELECT q.*, s.name as service_name, t.name as tier_name FROM quotes q JOIN services s ON q.service_id = s.id JOIN tier_packages t ON q.tier_id = t.id WHERE q.customer_id = $1';
    const params = [req.user.id];
    if (status) {
      params.push(status);
      query += ` AND q.status = $${params.length}`;
    }
    query += ' ORDER BY q.created_at DESC';
    const countQuery = query.replace('SELECT q.*, s.name as service_name, t.name as tier_name', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ quotes: result.rows, total: parseInt(totalRes.rows[0].count) });
  } catch (error) {
    console.error('List quotes error:', error);
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
    let query = 'SELECT q.*, u.name as customer_name, u.email as customer_email, s.name as service_name, t.name as tier_name FROM quotes q JOIN users u ON q.customer_id = u.id JOIN services s ON q.service_id = s.id JOIN tier_packages t ON q.tier_id = t.id WHERE 1=1';
    const params = [];
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
    query += ' ORDER BY q.created_at DESC';
    const countQuery = query.replace('SELECT q.*, u.name as customer_name, u.email as customer_email, s.name as service_name, t.name as tier_name', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ quotes: result.rows, total: parseInt(totalRes.rows[0].count) });
  } catch (error) {
    console.error('List admin quotes error:', error);
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
    await pool.query(
      'UPDATE quotes SET status = $1, final_subtotal = $2, notes = $3, updated_at = $4 WHERE id = $5',
      ['APPROVED', final_subtotal, notes || quote.notes, new Date().toISOString(), quote_id]
    );
    const invoiceId = uuidv4();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    await pool.query(
      'INSERT INTO invoices (id, order_id, invoice_number, amount_due, issued_at, paid_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [invoiceId, quote_id, invoiceNumber, totalAmount, new Date().toISOString(), null]
    );
    const updatedQuote = await pool.query('SELECT * FROM quotes WHERE id = $1', [quote_id]);
    const invoice = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    await createAuditLog(req.user.id, 'FINALIZE', 'QUOTE', quote_id, { final_subtotal, total_amount: totalAmount }, req.ip);
    emitEvent('quote/finalized', { event_type: 'quote_finalized', timestamp: new Date().toISOString(), quote_id, customer_id: quote.customer_id, final_subtotal: parseFloat(final_subtotal), tax_amount: taxAmount, total_amount: totalAmount, finalized_by_admin_id: req.user.id, invoice_number: invoiceNumber });
    res.json({ quote: updatedQuote.rows[0], invoice: invoice.rows[0] });
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

app.get('/api/bookings', authenticateToken, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT b.*, q.service_id, s.name as service_name FROM bookings b JOIN quotes q ON b.quote_id = q.id JOIN services s ON q.service_id = s.id WHERE b.customer_id = $1';
    const params = [req.user.id];
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
    const limit = 20;
    const offset = (page - 1) * limit;
    let query = 'SELECT o.*, s.name as service_name, t.name as tier_name FROM orders o JOIN quotes q ON o.quote_id = q.id JOIN services s ON q.service_id = s.id JOIN tier_packages t ON o.tier_id = t.id WHERE o.customer_id = $1';
    const params = [req.user.id];
    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    query += ' ORDER BY o.created_at DESC';
    const countQuery = query.replace('SELECT o.*, s.name as service_name, t.name as tier_name', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    const ordersWithPaymentStatus = [];
    for (const order of result.rows) {
      const paymentsRes = await pool.query('SELECT SUM(amount) as total_paid FROM payments WHERE order_id = $1 AND status = $2', [order.id, 'COMPLETED']);
      const totalPaid = parseFloat(paymentsRes.rows[0]?.total_paid || 0);
      const balanceDue = order.total_amount - totalPaid;
      ordersWithPaymentStatus.push({ order, payment_status: { deposit_paid: totalPaid >= order.deposit_amount, balance_due: balanceDue } });
    }
    res.json({ orders: ordersWithPaymentStatus, total: parseInt(totalRes.rows[0].count) });
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    let query = 'SELECT o.*, u.name as customer_name, s.name as service_name, t.name as tier_name FROM orders o JOIN users u ON o.customer_id = u.id JOIN quotes q ON o.quote_id = q.id JOIN services s ON q.service_id = s.id JOIN tier_packages t ON o.tier_id = t.id WHERE 1=1';
    const params = [];
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
    const jobs = result.rows.map(job => {
      const isOverdue = job.due_at && new Date(job.due_at) < new Date();
      const isPriority = job.tier_id === 'tier_004' || isOverdue;
      return { ...job, is_overdue: isOverdue, priority_level: isPriority ? 'HIGH' : 'NORMAL' };
    });
    res.json(jobs);
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
    let query = 'SELECT o.*, u.name as customer_name, s.name as service_name, t.name as tier_name, staff.name as assigned_staff_name FROM orders o JOIN users u ON o.customer_id = u.id JOIN quotes q ON o.quote_id = q.id JOIN services s ON q.service_id = s.id JOIN tier_packages t ON o.tier_id = t.id LEFT JOIN users staff ON o.assigned_staff_id = staff.id WHERE 1=1';
    const params = [];
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
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    query += ' ORDER BY o.created_at DESC';
    const countQuery = query.replace('SELECT o.*, u.name as customer_name, s.name as service_name, t.name as tier_name, staff.name as assigned_staff_name', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ orders: result.rows, total: parseInt(totalRes.rows[0].count) });
  } catch (error) {
    console.error('List admin orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    await pool.query(
      'INSERT INTO payments (id, order_id, amount, method, status, transaction_ref, recorded_by_admin_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [paymentId, order_id, amount, method, 'COMPLETED', transaction_ref || null, req.user.role === 'ADMIN' ? req.user.id : null, new Date().toISOString(), new Date().toISOString()]
    );
    const result = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    emitEvent('payment/completed', { event_type: 'payment_completed', timestamp: new Date().toISOString(), payment_id: paymentId, order_id, amount: parseFloat(amount), method, completed_at: new Date().toISOString() });
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
    const page = parseInt((req.query.page as string) || '1');
    const limit = 20;
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    query += ' ORDER BY created_at DESC';
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ users: result.rows, total: parseInt(totalRes.rows[0].count) });
  } catch (error) {
    console.error('List users error:', error);
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
    const result = await pool.query('SELECT s.*, c.name as category_name FROM services s JOIN service_categories c ON s.category_id = c.id ORDER BY s.name');
    res.json(result.rows);
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

app.get('/api/admin/calendar-settings', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
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
    query += ' ORDER BY al.created_at DESC';
    const countQuery = query.replace('SELECT al.*, u.name as user_name', 'SELECT COUNT(*)');
    const totalRes = await pool.query(countQuery, params);
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ logs: result.rows, total: parseInt(totalRes.rows[0].count) });
  } catch (error) {
    console.error('List audit logs error:', error);
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