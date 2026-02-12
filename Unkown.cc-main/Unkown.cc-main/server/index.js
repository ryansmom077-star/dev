import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { nanoid } from 'nanoid'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import Stripe from 'stripe'
import nodemailer from 'nodemailer'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { fileTypeFromBuffer } from 'file-type'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbFile = path.join(__dirname, 'db.json')
const configFile = path.join(__dirname, 'config.json')

const defaultData = {
  uidCounter: 1,
  forumStatus: { isOpen: true },
  ranks: [],
  roles: [
    { id: 'role_member', name: 'Member', color: '#9bb0bd', permissions: {}, position: 0 }
  ],
  forumCategories: [
    { id: 'cat_cs2', name: 'CS2', color: '#00ff88' }
  ],
  forums: [
    { id: 'forum_cs2_general', name: 'General Discussion', description: 'General CS2 discussions', categoryId: 'cat_cs2' },
    { id: 'forum_cs2_trading', name: 'Trading', description: 'Buy and sell skins', categoryId: 'cat_cs2' }
  ],
  users: [],
  threads: [],
  posts: [],
  keys: [],
  accountLogs: []
}

const adapter = new JSONFile(dbFile)
const db = new Low(adapter, defaultData)
await db.read()

let config = { adminIps: [] }
try {
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'))
} catch (err) {
  console.warn('Config file not found, using defaults')
}

const smtpConfig = config?.email?.smtp || {}
let mailer = null
if (smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
  mailer = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port || 587,
    secure: !!smtpConfig.secure,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass }
  })
} else {
  console.warn('SMTP is not configured. Email features will log codes to console.')
}

const supportLink = 'https://mail.google.com/mail/?view=cm&fs=1&to=support@unknown.cc'
let logoDataUrl = null
try {
  const logoPath = path.join(__dirname, 'uploads', 'pfp_oclYehFSwuwkUlIPcUw6f.png')
  if (fs.existsSync(logoPath)) {
    const buf = fs.readFileSync(logoPath)
    logoDataUrl = `data:image/png;base64,${buf.toString('base64')}`
  }
} catch (err) {
  console.warn('Could not load email logo:', err && err.message)
}

async function sendEmail(to, subject, text, html) {
  if (!mailer) {
    console.log(`[email fallback] To: ${to} | Subject: ${subject} | Text: ${text}`)
    return false
  }
  await mailer.sendMail({
    from: smtpConfig.from || smtpConfig.user,
    to,
    subject,
    text,
    html
  })
  return true
}

function getClientInfo(req) {
  return {
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown'
  }
}

function formatEmail(title, username, lines, meta) {
  const header = `${title}\n\nHello ${username},\n\n`
  const body = lines.join('\n') + '\n\n'
  const metaLines = meta && meta.length ? meta.join('\n') + '\n\n' : ''
  return `${header}${body}${metaLines}Best regards,\nForum Support\n`
}

function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function parseUserAgent(ua) {
  const lower = (ua || '').toLowerCase()
  const browser = lower.includes('edg') ? 'Edge'
    : lower.includes('opr') || lower.includes('opera') ? 'Opera'
    : lower.includes('chrome') ? 'Chrome'
    : lower.includes('firefox') ? 'Firefox'
    : lower.includes('safari') ? 'Safari'
    : 'Unknown'

  const os = lower.includes('windows') ? 'Windows'
    : lower.includes('mac os') || lower.includes('macintosh') ? 'macOS'
    : lower.includes('android') ? 'Android'
    : lower.includes('iphone') || lower.includes('ipad') ? 'iOS'
    : lower.includes('linux') ? 'Linux'
    : 'Unknown'

  const device = lower.includes('mobile') || lower.includes('android') || lower.includes('iphone') || lower.includes('ipad')
    ? 'Mobile'
    : 'Desktop'

  return { browser, os, device }
}

function renderOtpEmail({ title, username, message, code, ip, browser, os, device, expires }) {
  const logoHtml = logoDataUrl ? `<img src="${logoDataUrl}" alt="Unknown.cc" style="width:44px;height:44px;border-radius:50%" />` : '<div style="font-weight:700;color:#00ff88">Unknown.cc</div>'
  return `
  <div style="background:#0c1318;color:#d9eef5;font-family:Arial,Helvetica,sans-serif;padding:32px">
    <div style="max-width:620px;margin:0 auto;background:#0f1b22;border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:28px;text-align:center">
      <div style="display:flex;justify-content:center;margin-bottom:16px">${logoHtml}</div>
      <h2 style="margin:0 0 8px;color:#e6f7ff">${title}</h2>
      <p style="margin:0 0 18px;color:#9bb0bd">Hello ${username || 'there'},</p>
      <p style="margin:0 0 18px;color:#d9eef5">${message}</p>
      <div style="font-size:32px;letter-spacing:6px;font-weight:700;color:#00ff88;margin:16px 0">${code}</div>
      <p style="margin:0 0 18px;color:#9bb0bd;font-size:12px">This code will expire in ${expires} minutes.</p>
      <div style="display:inline-block;margin:6px 0 18px">
        <a href="${supportLink}" style="background:#00ff88;color:#061218;text-decoration:none;padding:8px 16px;border-radius:8px;font-weight:600">Support</a>
      </div>
      <div style="color:#9bb0bd;font-size:12px;line-height:1.6">
        IP-Address: ${ip}<br />
        Browser: ${browser}<br />
        Operating System: ${os}<br />
        Device: ${device}
      </div>
      <p style="margin:18px 0 0;color:#9bb0bd;font-size:12px">Best regards,<br />Unknown.cc</p>
    </div>
  </div>
  `.trim()
}

function renderPasswordChangedEmail({ username, ip, browser, os, device }) {
  const logoHtml = logoDataUrl ? `<img src="${logoDataUrl}" alt="Unknown.cc" style="width:44px;height:44px;border-radius:50%" />` : '<div style="font-weight:700;color:#00ff88">Unknown.cc</div>'
  return `
  <div style="background:#0c1318;color:#d9eef5;font-family:Arial,Helvetica,sans-serif;padding:32px">
    <div style="max-width:620px;margin:0 auto;background:#0f1b22;border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:28px;text-align:center">
      <div style="display:flex;justify-content:center;margin-bottom:16px">${logoHtml}</div>
      <h2 style="margin:0 0 8px;color:#e6f7ff">Updated Password</h2>
      <p style="margin:0 0 18px;color:#9bb0bd">Hello ${username || 'there'},</p>
      <p style="margin:0 0 18px;color:#d9eef5">Your password has been successfully updated. If you did not initiate this change, please contact support immediately.</p>
      <div style="display:inline-block;margin:6px 0 18px">
        <a href="${supportLink}" style="background:#00ff88;color:#061218;text-decoration:none;padding:8px 16px;border-radius:8px;font-weight:600">Support</a>
      </div>
      <div style="color:#9bb0bd;font-size:12px;line-height:1.6">
        IP-Address: ${ip}<br />
        Browser: ${browser}<br />
        Operating System: ${os}<br />
        Device: ${device}
      </div>
      <p style="margin:18px 0 0;color:#9bb0bd;font-size:12px">Best regards,<br />Unknown.cc</p>
    </div>
  </div>
  `.trim()
}

const app = express()
// SECURITY: Add Helmet.js for security headers
app.use(helmet())
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"]
  }
}))
// CORS: Restrict to allowed origins in production
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map(o => o.trim())
app.use(cors({ 
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) {
      cb(null, true)
    } else {
      cb(new Error('CORS not allowed'))
    }
  },
  credentials: true 
}))
app.use(cookieParser())
// Increase JSON body size limit to allow base64 image uploads
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.set('trust proxy', 1)

// Ensure uploads directory exists and serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'

// (No static frontend serving here — frontend runs separately with Vite)

// SECURITY: Token blacklist for logout/revocation
const tokenBlacklist = new Set()
function blacklistToken(token) {
  tokenBlacklist.add(token)
  // Clean old tokens every hour
  setTimeout(() => tokenBlacklist.delete(token), 3600000)
}

function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token)
}

// SECURITY: Account lockout tracking (after 5 failed login attempts)
const loginAttempts = new Map()
function recordFailedLogin(username, ip) {
  const key = `${username}_${ip}`
  const data = loginAttempts.get(key) || { attempts: 0, lockedUntil: null }
  data.attempts++
  if (data.attempts >= 5) {
    data.lockedUntil = Date.now() + 900000 // 15 min lockout
  }
  loginAttempts.set(key, data)
  return data
}

function isAccountLocked(username, ip) {
  const key = `${username}_${ip}`
  const data = loginAttempts.get(key)
  if (!data || !data.lockedUntil) return false
  if (Date.now() > data.lockedUntil) {
    loginAttempts.delete(key)
    return false
  }
  return true
}

function clearLoginAttempts(username, ip) {
  const key = `${username}_${ip}`
  loginAttempts.delete(key)
}

function getClientIp(req) {
  return req.ip || req.connection.remoteAddress || '0.0.0.0'
}

function isAdminIp(ip) {
  return config.adminIps && config.adminIps.includes(ip)
}

function generateInviteKey() {
  return Math.floor(Math.random() * 10000000000000000).toString().padStart(16, '0')
}

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role, staffRole: user.staffRole, roles: user.roles || [] }, JWT_SECRET, { expiresIn: '7d' })
}

// SECURITY: Input validation helpers
function validateUsername(username) {
  if (typeof username !== 'string') return false
  if (username.length < 3 || username.length > 32) return false
  return /^[a-zA-Z0-9_-]+$/.test(username)
}

function validatePassword(password) {
  if (typeof password !== 'string') return false
  return password.length >= 8  // Require 8+ characters
}

function validateEmail(email) {
  if (typeof email !== 'string') return false
  // Basic email validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// SECURITY: Simple in-memory rate limiting (use Redis in production)
const rateLimitStore = new Map()
function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now()
  const data = rateLimitStore.get(key) || { attempts: 0, resetAt: now + windowMs }
  
  if (now > data.resetAt) {
    data.attempts = 0
    data.resetAt = now + windowMs
  }
  
  data.attempts++
  rateLimitStore.set(key, data)
  return data.attempts <= maxAttempts
}

function getRateLimitRetryAfter(key) {
  const data = rateLimitStore.get(key)
  return data ? Math.ceil((data.resetAt - Date.now()) / 1000) : 0
}

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, inviteKey } = req.body
  const clientIp = getClientIp(req)
  const isAdmin = isAdminIp(clientIp)

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'username, email, and password required' })
  }

  // Validate input format
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'username must be 3-32 characters, alphanumeric with _ and -' })
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'invalid email format' })
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }

  if (!inviteKey || !/^[a-zA-Z0-9]{4,}$/.test(inviteKey)) {
    return res.status(400).json({ error: 'invitation key must be alphanumeric and at least 4 characters' })
  }

  // Rate limit: 3 registrations per hour per IP
  if (!checkRateLimit(`register_${clientIp}`, 3, 3600000)) {
    const retryAfter = getRateLimitRetryAfter(`register_${clientIp}`)
    return res.status(429).json({ error: 'too many registration attempts', retryAfter })
  }

  await db.read()

  const keyExists = db.data.keys.find(k => k.key === inviteKey && !k.usedBy && !k.revoked)
  if (!keyExists) {
    return res.status(400).json({ error: 'invitation key not found or already used' })
  }

  const exists = db.data.users.find(u => u.username === username)
  if (exists) return res.status(400).json({ error: 'username taken' })

  const emailTaken = db.data.users.find(u => u.email === email)
  if (emailTaken) return res.status(400).json({ error: 'email already registered' })

  const hash = await bcrypt.hash(password, 10)
  const uid = db.data.uidCounter || 1
  db.data.uidCounter = uid + 1

  const user = {
    id: nanoid(),
    uid,
    username,
    email,
    passwordHash: hash,
    role: isAdmin ? 'staff' : 'user',
    staffRole: isAdmin ? 'admin' : null,
    banned: false,
    banReason: null,
    banIssuedAt: null,
    banExpiresAt: null,
    banDurationLabel: null,
    accessRevoked: false,
    inviteKeyId: keyExists.id,
    twoFa: { enabled: false, codeHash: null, codeExpiry: null, requestedAt: null },
    reset: { codeHash: null, codeExpiry: null, requestedAt: null },
    registeredIp: clientIp,
    lastIp: clientIp,
    ips: [{ ip: clientIp, timestamp: Date.now() }],
    profile: {
      pfp: null,
      banner: null,
      background: null,
      signature: null,
      customRank: null
    },
    roles: isAdmin ? ['role_admin'] : ['role_member'],
    createdAt: Date.now()
  }

  keyExists.usedBy = user.id
  keyExists.usedAt = Date.now()

  db.data.users.push(user)

  if (!db.data.accountLogs) db.data.accountLogs = []
  db.data.accountLogs.push({
    id: nanoid(),
    username: user.username,
    uid: user.uid,
    ip: clientIp,
    staffStatus: user.staffRole || 'user',
    banned: false,
    timestamp: Date.now()
  })

  await db.write()

  const token = generateToken(user)
  res.cookie('token', token, { maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', path: '/' })
  res.json({ token, user: { id: user.id, uid: user.uid, username: user.username, email: user.email, role: user.role, staffRole: user.staffRole || null, roles: user.roles || [], accessRevoked: user.accessRevoked || false } })
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password, remember } = req.body
  const clientIp = getClientIp(req)
  const isAdmin = isAdminIp(clientIp)

  if (!username || !password) return res.status(400).json({ error: 'username and password required' })
  
  // Rate limit: 5 attempts per 15 minutes per user per IP
  if (!checkRateLimit(`login_${username}_${clientIp}`, 5, 900000)) {
    const retryAfter = getRateLimitRetryAfter(`login_${username}_${clientIp}`)
    return res.status(429).json({ error: 'too many login attempts', retryAfter })
  }
  
  // SECURITY: Check account lockout (after 5 failed attempts)
  if (isAccountLocked(username, clientIp)) {
    return res.status(429).json({ error: 'account temporarily locked due to failed login attempts. try again in 15 minutes' })
  }

  await db.read()
  const user = db.data.users.find(u => u.username.toLowerCase() === username.toLowerCase())
  if (!user) {
    recordFailedLogin(username, clientIp)
    return res.status(400).json({ error: 'invalid credentials' })
  }

  if (user.banned) {
    if (user.banExpiresAt && Date.now() > user.banExpiresAt) {
      user.banned = false
      user.banReason = null
      user.banIssuedAt = null
      user.banExpiresAt = null
      user.banDurationLabel = null
    } else {
      return res.status(403).json({ error: 'this account has been banned' })
    }
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    recordFailedLogin(username, clientIp)
    return res.status(400).json({ error: 'invalid credentials' })
  }

  // SECURITY: Clear login attempts on successful login
  clearLoginAttempts(username, clientIp)

  if (user.twoFa?.enabled) {
    const code = generateSixDigitCode()
    const codeHash = await bcrypt.hash(code, 10)
    user.twoFa.codeHash = codeHash
    user.twoFa.codeExpiry = Date.now() + 10 * 60 * 1000
    user.twoFa.requestedAt = Date.now()
    user.twoFa.mode = 'login'

    const ua = parseUserAgent(req.headers['user-agent'])
    const html = renderOtpEmail({
      title: 'Login Code',
      username: user.username,
      message: 'Use this code to finish logging in to your account.',
      code,
      ip: clientIp,
      browser: ua.browser,
      os: ua.os,
      device: ua.device,
      expires: 10
    })

    await sendEmail(user.email, 'Login Verification Code', `Your login code is ${code}`, html)
    await db.write()
    const tempToken = jwt.sign({ id: user.id, purpose: '2fa-login' }, JWT_SECRET, { expiresIn: '10m' })
    return res.json({ requiresTwoFa: true, tempToken })
  }

  user.lastIp = clientIp
  if (!user.ips) user.ips = []
  user.ips.push({ ip: clientIp, timestamp: Date.now() })

  if (isAdmin) {
    user.role = 'staff'
    user.staffRole = 'admin'
    if (!user.roles) user.roles = []
    if (!user.roles.includes('role_admin')) user.roles.push('role_admin')
  }

  await db.write()

  const token = generateToken(user)
  if (remember) {
    res.cookie('token', token, { maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', path: '/' })
  }
  res.json({
    token,
    user: {
      id: user.id,
      uid: user.uid,
      username: user.username,
      email: user.email,
      role: user.role,
      staffRole: user.staffRole || null,
      roles: user.roles || [],
      accessRevoked: user.accessRevoked || false,
      twoFaEnabled: !!user.twoFa?.enabled
    }
  })
})


function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' })
  const token = auth.split(' ')[1]
  
  // Check if token is blacklisted
  if (isTokenBlacklisted(token)) {
    return res.status(401).json({ error: 'token revoked' })
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    req.token = token
    next()
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
}

function staffMiddleware(req, res, next) {
  // Fix: Check staffRole field, not role field
  const isStaff = req.user?.staffRole === 'admin' || req.user?.staffRole === 'manager'
  if (!isStaff) {
    return res.status(403).json({ error: 'staff access required' })
  }
  next()
}

function hasPermission(user, rank, perm) {
  if (user?.staffRole === 'admin' || user?.staffRole === 'manager') return true
  return !!rank?.permissions?.[perm]
}

async function forumAccessMiddleware(req, res, next) {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  if (user.banned) {
    if (user.banExpiresAt && Date.now() > user.banExpiresAt) {
      user.banned = false
      user.banReason = null
      user.banIssuedAt = null
      user.banExpiresAt = null
      user.banDurationLabel = null
      await db.write()
    } else {
      return res.status(403).json({ error: 'account banned' })
    }
  }
  if (user.accessRevoked) {
    return res.status(403).json({ error: 'forum access revoked. redeem a new key to continue' })
  }
  next()
}

// Forum endpoints
app.get('/api/threads', authMiddleware, forumAccessMiddleware, async (req, res) => {
  await db.read()
  const threads = db.data.threads.map(t => ({ ...t, postCount: db.data.posts.filter(p => p.threadId === t.id).length }))
  res.json(threads)
})

app.post('/api/threads', authMiddleware, forumAccessMiddleware, async (req, res) => {
  const { title, content } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })
  const thread = { id: nanoid(), title, content: content || '', authorId: req.user.id, createdAt: Date.now() }
  await db.read()
  db.data.threads.push(thread)
  await db.write()
  res.json(thread)
})

app.get('/api/threads/:id', authMiddleware, forumAccessMiddleware, async (req, res) => {
  const id = req.params.id
  await db.read()
  const thread = db.data.threads.find(t => t.id === id)
  if (!thread) return res.status(404).json({ error: 'not found' })
  const posts = db.data.posts.filter(p => p.threadId === id)
  res.json({ thread, posts })
})

app.post('/api/threads/:id/posts', authMiddleware, forumAccessMiddleware, async (req, res) => {
  const id = req.params.id
  const { content } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })
  await db.read()
  const thread = db.data.threads.find(t => t.id === id)
  if (!thread) return res.status(404).json({ error: 'thread not found' })
  // enforce forum readOnly on backend
  const parentForum = thread.forumId ? db.data.forums.find(f => f.id === thread.forumId) : null
  if (parentForum && parentForum.readOnly && !(req.user && (req.user.staffRole === 'admin' || req.user.staffRole === 'manager' || req.user.role === 'staff'))) {
    return res.status(403).json({ error: 'forum is read-only' })
  }

  const post = { id: nanoid(), threadId: id, content, authorId: req.user.id, createdAt: Date.now() }
  db.data.posts.push(post)
  await db.write()
  res.json(post)
})

// Staff/Admin key management endpoints
app.get('/api/admin/keys', authMiddleware, staffMiddleware, async (req, res) => {
  await db.read()
  const keys = db.data.keys.map(k => ({
    ...k,
    usedByUsername: k.usedBy ? db.data.users.find(u => u.id === k.usedBy)?.username : null
  }))
  res.json(keys)
})

app.post('/api/admin/keys/generate', authMiddleware, staffMiddleware, async (req, res) => {
  const { count = 1 } = req.body
  if (count < 1 || count > 100) return res.status(400).json({ error: 'count must be 1-100' })
  
  await db.read()
  const newKeys = []
  for (let i = 0; i < count; i++) {
    const key = {
      id: nanoid(),
      key: generateInviteKey(),
      generatedBy: req.user.id,
      generatedAt: Date.now(),
      usedBy: null,
      usedAt: null,
      revoked: false,
      revokedAt: null
    }
    newKeys.push(key)
    db.data.keys.push(key)
  }
  await db.write()
  res.json(newKeys)
})

app.delete('/api/admin/keys/:keyId', authMiddleware, staffMiddleware, async (req, res) => {
  await db.read()
  const idx = db.data.keys.findIndex(k => k.id === req.params.keyId)
  if (idx === -1) return res.status(404).json({ error: 'key not found' })
  const key = db.data.keys[idx]
  if (key.usedBy) return res.status(400).json({ error: 'cannot delete used key' })
  db.data.keys.splice(idx, 1)
  await db.write()
  res.json({ deleted: true })
})

// User invite management (permission-based)
app.get('/api/invites/mine', authMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  const rank = db.data.ranks.find(r => r.id === user.profile?.customRank)
  if (!hasPermission(user, rank, 'generate_invites')) {
    return res.status(403).json({ error: 'no permission to view invites' })
  }

  const invites = (db.data.keys || [])
    .filter(k => k.generatedBy === user.id)
    .map(k => ({
      id: k.id,
      key: k.key,
      generatedAt: k.generatedAt,
      usedBy: k.usedBy,
      usedAt: k.usedAt,
      revoked: !!k.revoked,
      usedByUsername: k.usedBy ? db.data.users.find(u => u.id === k.usedBy)?.username : null
    }))
    .sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0))

  res.json(invites)
})

app.post('/api/invites/generate', authMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  const rank = db.data.ranks.find(r => r.id === user.profile?.customRank)
  if (!hasPermission(user, rank, 'generate_invites')) {
    return res.status(403).json({ error: 'no permission to generate invites' })
  }

  const key = {
    id: nanoid(),
    key: generateInviteKey(),
    generatedBy: user.id,
    generatedAt: Date.now(),
    usedBy: null,
    usedAt: null,
    revoked: false,
    revokedAt: null
  }
  if (!db.data.keys) db.data.keys = []
  db.data.keys.push(key)
  await db.write()
  res.json(key)
})

app.get('/api/admin/ip-ranking', authMiddleware, staffMiddleware, async (req, res) => {
  await db.read()
  
  // Build IP rankings
  const ipStats = {}
  db.data.users.forEach(user => {
    if (user.ips && Array.isArray(user.ips)) {
      user.ips.forEach(log => {
        if (!ipStats[log.ip]) {
          ipStats[log.ip] = { ip: log.ip, users: [], count: 0 }
        }

        if (!ipStats[log.ip].users.includes(user.username)) {
          ipStats[log.ip].users.push(user.username)
        }
        ipStats[log.ip].count++
      })
    }
  })
  
  const ranking = Object.values(ipStats)
    .sort((a, b) => b.users.length - a.users.length)
    .map((item, idx) => ({ ...item, rank: idx + 1 }))
  
  res.json(ranking)
})

// Account creation logs endpoint
app.get('/api/admin/account-logs', authMiddleware, staffMiddleware, async (req, res) => {
  await db.read()
  const logs = (db.data.accountLogs || []).sort((a, b) => b.timestamp - a.timestamp)
  res.json(logs)
})

// Update account log staff status and ban status when user is modified
app.post('/api/admin/users/:userId/ban', authMiddleware, staffMiddleware, async (req, res) => {
  const { duration, reason } = req.body || {}
  const allowed = new Map([
    ['1d', 24 * 60 * 60 * 1000],
    ['1w', 7 * 24 * 60 * 60 * 1000],
    ['1mo', 30 * 24 * 60 * 60 * 1000],
    ['1y', 365 * 24 * 60 * 60 * 1000],
    ['0', 0]
  ])

  if (!allowed.has(String(duration))) {
    return res.status(400).json({ error: 'invalid ban duration' })
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'ban reason required' })
  }

  await db.read()
  const user = db.data.users.find(u => u.id === req.params.userId)
  if (!user) return res.status(404).json({ error: 'user not found' })

  const durationMs = allowed.get(String(duration))
  const now = Date.now()

  user.banned = true
  user.banReason = String(reason).trim()
  user.banIssuedAt = now
  user.banExpiresAt = durationMs ? now + durationMs : null
  user.banDurationLabel = durationMs ? String(duration) : 'perm'

  // Update account log
  const log = db.data.accountLogs.find(l => l.uid === user.uid)
  if (log) log.banned = true

  await db.write()
  res.json({ message: 'user banned', banExpiresAt: user.banExpiresAt })
})

app.post('/api/admin/users/:userId/unban', authMiddleware, staffMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.params.userId)
  if (!user) return res.status(404).json({ error: 'user not found' })
  
  user.banned = false
  user.banReason = null
  user.banIssuedAt = null
  user.banExpiresAt = null
  user.banDurationLabel = null
  
  // Update account log
  const log = db.data.accountLogs.find(l => l.uid === user.uid)
  if (log) log.banned = false
  
  await db.write()
  res.json({ message: 'user unbanned' })
})

// Get all users list
app.get('/api/admin/users', authMiddleware, async (req, res) => {
  if (!req.user.staffRole) return res.status(403).json({ error: 'staff only' })
  await db.read()
  const q = (req.query.search || '').toLowerCase().trim()
  const users = db.data.users || []
  let filtered = users
  if (q) {
    filtered = users.filter(u => u.username.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || String(u.uid) === q)
  }
  const userList = filtered.map(u => ({
    id: u.id,
    uid: u.uid,
    username: u.username,
    email: u.email,
    staffRole: u.staffRole,
    roles: u.roles || [],
    banned: u.banned,
    banReason: u.banReason || null,
    banIssuedAt: u.banIssuedAt || null,
    banExpiresAt: u.banExpiresAt || null,
    banDurationLabel: u.banDurationLabel || null,
    createdAt: u.createdAt,
    ipsCount: u.ips?.length || 0
  }))
  res.json(userList)
})

// Create user from admin panel (no invite key required)
app.post('/api/admin/users/create', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  const { username, email, password, staffRole } = req.body
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email, and password required' })

  await db.read()
  const usernameExists = db.data.users.find(u => u.username.toLowerCase() === String(username).toLowerCase())
  if (usernameExists) return res.status(400).json({ error: 'username taken' })
  const emailExists = db.data.users.find(u => u.email.toLowerCase() === String(email).toLowerCase())
  if (emailExists) return res.status(400).json({ error: 'email already registered' })

  const hash = await bcrypt.hash(password, 10)
  const uid = db.data.uidCounter || 1
  db.data.uidCounter = uid + 1

  const isStaff = staffRole === 'admin' || staffRole === 'manager'
  const roles = isStaff ? [`role_${staffRole}`] : ['role_member']
  const clientIp = getClientIp(req)

  const newUser = {
    id: nanoid(),
    uid,
    username,
    email,
    passwordHash: hash,
    role: isStaff ? 'staff' : 'user',
    staffRole: isStaff ? staffRole : null,
    banned: false,
    banReason: null,
    banIssuedAt: null,
    banExpiresAt: null,
    banDurationLabel: null,
    accessRevoked: false,
    inviteKeyId: null,
    twoFa: { enabled: false, codeHash: null, codeExpiry: null, requestedAt: null },
    reset: { codeHash: null, codeExpiry: null, requestedAt: null },
    registeredIp: clientIp,
    lastIp: clientIp,
    ips: [{ ip: clientIp, timestamp: Date.now() }],
    profile: { pfp: null, banner: null, background: null, signature: null, customRank: null },
    roles,
    createdAt: Date.now()
  }

  if (!db.data.accountLogs) db.data.accountLogs = []
  db.data.accountLogs.push({
    id: nanoid(),
    username: newUser.username,
    uid: newUser.uid,
    ip: clientIp,
    staffStatus: newUser.staffRole || 'user',
    banned: false,
    timestamp: Date.now()
  })

  db.data.users.push(newUser)
  await db.write()

  res.json({ id: newUser.id, uid: newUser.uid, username: newUser.username, email: newUser.email, role: newUser.role, staffRole: newUser.staffRole || null, roles: newUser.roles || [] })
})

// Change user UID (with swap if taken)
app.post('/api/admin/users/:userId/change-uid', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  const { newUid } = req.body
  if (!newUid || typeof newUid !== 'number') return res.status(400).json({ error: 'valid newUid required' })

  await db.read()
  const user = db.data.users.find(u => u.id === req.params.userId)
  if (!user) return res.status(404).json({ error: 'user not found' })

  const otherUser = db.data.users.find(u => u.uid === newUid)
  
  if (otherUser) {
    // Swap UIDs
    const tempUid = user.uid
    user.uid = newUid
    otherUser.uid = tempUid
  } else {
    // Just assign the UID
    user.uid = newUid
  }

  await db.write()
  res.json({ 
    userId: user.id, 
    newUid: user.uid, 
    swapped: !!otherUser, 
    otherUserId: otherUser?.id || null, 
    otherUserOldUid: otherUser ? newUid : null 
  })
})

// Set staff role for a user
app.post('/api/admin/users/:userId/staff', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  const { staffRole } = req.body
  const normalized = staffRole === 'admin' || staffRole === 'manager' ? staffRole : null

  await db.read()
  const user = db.data.users.find(u => u.id === req.params.userId)
  if (!user) return res.status(404).json({ error: 'user not found' })

  user.staffRole = normalized
  user.role = normalized ? 'staff' : 'user'
  if (!user.roles) user.roles = []
  user.roles = user.roles.filter(r => r !== 'role_admin' && r !== 'role_manager')
  if (normalized) user.roles.push(`role_${normalized}`)

  const log = db.data.accountLogs?.find(l => l.uid === user.uid)
  if (log) log.staffStatus = user.staffRole || 'user'

  await db.write()
  res.json({ id: user.id, staffRole: user.staffRole, role: user.role, roles: user.roles })
})

// Role management endpoints
app.get('/api/admin/roles', authMiddleware, staffMiddleware, async (req, res) => {
  await db.read()
  res.json(db.data.roles || [])
})

app.post('/api/admin/roles', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  const { name, color, permissions = {}, position = 0 } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  await db.read()
  if (!db.data.roles) db.data.roles = []
  const role = { id: `role_${nanoid()}`, name, color: color || '#9bb0bd', permissions, position }
  db.data.roles.push(role)
  await db.write()
  res.json(role)
})

app.put('/api/admin/roles/:roleId', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  const { name, color, permissions, position } = req.body
  await db.read()
  const role = db.data.roles.find(r => r.id === req.params.roleId)
  if (!role) return res.status(404).json({ error: 'role not found' })
  if (name) role.name = name
  if (color) role.color = color
  if (permissions) role.permissions = permissions
  if (position !== undefined) role.position = position
  await db.write()
  res.json(role)
})

app.delete('/api/admin/roles/:roleId', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  await db.read()
  db.data.roles = (db.data.roles || []).filter(r => r.id !== req.params.roleId)
  // remove role from users
  db.data.users.forEach(u => { if (u.roles) u.roles = u.roles.filter(rr => rr !== req.params.roleId) })
  await db.write()
  res.json({ deleted: true })
})

// Assign or update roles for a user
app.post('/api/admin/users/:userId/roles', authMiddleware, async (req, res) => {
  // allow admin & manager to assign roles
  if (req.user.staffRole !== 'admin' && req.user.staffRole !== 'manager') return res.status(403).json({ error: 'admin/manager only' })
  const { action, roleId, roles } = req.body
  await db.read()
  const user = db.data.users.find(u => u.id === req.params.userId)
  if (!user) return res.status(404).json({ error: 'user not found' })

  if (action === 'add') {
    if (!user.roles) user.roles = []
    if (!user.roles.includes(roleId)) user.roles.push(roleId)
  } else if (action === 'remove') {
    user.roles = (user.roles || []).filter(r => r !== roleId)
  } else if (action === 'set' && Array.isArray(roles)) {
    user.roles = roles
  } else {
    return res.status(400).json({ error: 'invalid action' })
  }

  await db.write()
  res.json({ id: user.id, roles: user.roles })
})

app.post('/api/admin/keys/:keyId/revoke', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  await db.read()
  const key = db.data.keys.find(k => k.id === req.params.keyId)
  if (!key) return res.status(404).json({ error: 'key not found' })
  if (key.usedBy) {
    const user = db.data.users.find(u => u.id === key.usedBy)
    if (user) {
      user.accessRevoked = true
      user.accessRevokedAt = Date.now()
    }
  }
  key.revoked = true
  key.revokedAt = Date.now()
  await db.write()
  res.json({ revoked: true })
})

app.post('/api/admin/forum/toggle', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  await db.read()
  db.data.forumStatus.isOpen = !db.data.forumStatus.isOpen
  await db.write()
  res.json({ isOpen: db.data.forumStatus.isOpen })
})

app.delete('/api/admin/threads/:threadId', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin' && req.user.staffRole !== 'manager') {
    return res.status(403).json({ error: 'staff only' })
  }
  await db.read()
  const idx = db.data.threads.findIndex(t => t.id === req.params.threadId)
  if (idx === -1) return res.status(404).json({ error: 'thread not found' })
  db.data.threads.splice(idx, 1)
  db.data.posts = db.data.posts.filter(p => p.threadId !== req.params.threadId)
  await db.write()
  res.json({ deleted: true })
})

app.delete('/api/admin/posts/:postId', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin' && req.user.staffRole !== 'manager') {
    return res.status(403).json({ error: 'staff only' })
  }
  await db.read()
  const idx = db.data.posts.findIndex(p => p.id === req.params.postId)
  if (idx === -1) return res.status(404).json({ error: 'post not found' })
  db.data.posts.splice(idx, 1)
  await db.write()
  res.json({ deleted: true })
})

// Rank Management (admin only)
app.get('/api/admin/ranks', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  await db.read()
  res.json(db.data.ranks || [])
})

app.post('/api/admin/ranks', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  const { name, color, permissions } = req.body
  if (!name || !color) return res.status(400).json({ error: 'name and color required' })
  await db.read()
  if (!db.data.ranks) db.data.ranks = []
  const rank = {
    id: `rank_${nanoid()}`,
    name,
    color,
    permissions: permissions || [],
    createdAt: Date.now()
  }
  db.data.ranks.push(rank)
  await db.write()
  res.json(rank)
})

app.put('/api/admin/ranks/:rankId', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  const { name, color, permissions } = req.body
  await db.read()
  const rank = db.data.ranks?.find(r => r.id === req.params.rankId)
  if (!rank) return res.status(404).json({ error: 'rank not found' })
  if (name) rank.name = name
  if (color) rank.color = color
  if (permissions) rank.permissions = permissions
  await db.write()
  res.json(rank)
})

app.delete('/api/admin/ranks/:rankId', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  await db.read()
  db.data.ranks = db.data.ranks?.filter(r => r.id !== req.params.rankId) || []
  await db.write()
  res.json({ deleted: true })
})

// Assign rank to user (admin & manager)
app.post('/api/admin/users/:userId/rank', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin' && req.user.staffRole !== 'manager') {
    return res.status(403).json({ error: 'staff only' })
  }
  const { rankId } = req.body
  await db.read()
  const user = db.data.users.find(u => u.id === req.params.userId)
  if (!user) return res.status(404).json({ error: 'user not found' })
  if (!user.profile) user.profile = {}
  user.profile.customRank = rankId || null
  await db.write()
  res.json({ customRank: user.profile.customRank })
})

// User Profile Update
app.put('/api/users/profile', authMiddleware, async (req, res) => {
  const { pfp, banner, background, signature } = req.body
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  if (!user.profile) user.profile = {}
  if (pfp) user.profile.pfp = pfp
  if (banner) user.profile.banner = banner
  if (background) user.profile.background = background
  if (signature) user.profile.signature = signature
  await db.write()
  res.json(user.profile)
})

app.get('/api/users/:userId/profile', async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.params.userId)
  if (!user) return res.status(404).json({ error: 'user not found' })
  res.json({
    uid: user.uid,
    username: user.username,
    profile: user.profile || {},
    customRank: user.profile?.customRank,
    createdAt: user.createdAt,
    accessRevoked: user.accessRevoked || false
  })
})

app.get('/api/users/security', authMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  res.json({ email: user.email, twoFaEnabled: !!user.twoFa?.enabled })
})

app.get('/api/users/me', authMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  res.json({
    id: user.id,
    uid: user.uid,
    username: user.username,
    email: user.email,
    staffRole: user.staffRole || null,
    roles: user.roles || [],
    twoFaEnabled: !!user.twoFa?.enabled,
    accessRevoked: !!user.accessRevoked
  })
})

// Forum endpoints
app.get('/api/forums/categories', authMiddleware, forumAccessMiddleware, async (req, res) => {
  await db.read()
  const categories = db.data.forumCategories || []
  const forumsByCategory = {}
  
  categories.forEach(cat => {
    forumsByCategory[cat.id] = db.data.forums.filter(f => f.categoryId === cat.id)
  })
  
  res.json({ categories, forumsByCategory })
})

// Admin: create a forum category
app.post('/api/admin/forums/categories', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin' && req.user.staffRole !== 'manager') return res.status(403).json({ error: 'admin only' })
  const { id, name, description, color, order } = req.body
  if (!id || !name) return res.status(400).json({ error: 'id and name required' })
  await db.read()
  if (!db.data.forumCategories) db.data.forumCategories = []
  if (db.data.forumCategories.find(c => c.id === id)) return res.status(400).json({ error: 'category id exists' })
  const cat = { id, name, description: description || '', color: color || '#00ff88', order: order || (db.data.forumCategories.length+1) }
  db.data.forumCategories.push(cat)
  await db.write()
  res.json(cat)
})

// Admin: create forum
app.post('/api/admin/forums', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin' && req.user.staffRole !== 'manager') return res.status(403).json({ error: 'admin only' })
  const { id, categoryId, name, description, readOnly } = req.body
  if (!id || !categoryId || !name) return res.status(400).json({ error: 'id, categoryId and name required' })
  await db.read()
  if (!db.data.forums) db.data.forums = []
  if (db.data.forums.find(f => f.id === id)) return res.status(400).json({ error: 'forum id exists' })
  const forum = { id, categoryId, name, description: description || '', createdBy: req.user.id, createdAt: Date.now(), readOnly: !!readOnly }
  db.data.forums.push(forum)
  await db.write()
  res.json(forum)
})

// Admin: update forum (including readOnly flag)
app.put('/api/admin/forums/:forumId', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin' && req.user.staffRole !== 'manager') return res.status(403).json({ error: 'admin only' })
  const { name, description, readOnly } = req.body
  await db.read()
  const forum = db.data.forums.find(f => f.id === req.params.forumId)
  if (!forum) return res.status(404).json({ error: 'forum not found' })
  if (name) forum.name = name
  if (description) forum.description = description
  if (readOnly !== undefined) forum.readOnly = !!readOnly
  await db.write()
  res.json(forum)
})

// Admin: delete forum
app.delete('/api/admin/forums/:forumId', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin' && req.user.staffRole !== 'manager') return res.status(403).json({ error: 'admin only' })
  await db.read()
  const idx = db.data.forums.findIndex(f => f.id === req.params.forumId)
  if (idx === -1) return res.status(404).json({ error: 'forum not found' })
  db.data.forums.splice(idx,1)
  // also remove threads/posts under it
  db.data.threads = (db.data.threads || []).filter(t => t.forumId !== req.params.forumId)
  db.data.posts = (db.data.posts || []).filter(p => p.threadId && !db.data.threads.find(t=>t.id===p.threadId))
  await db.write()
  res.json({ deleted: true })
})

app.get('/api/forums/:forumId/threads', authMiddleware, forumAccessMiddleware, async (req, res) => {
  await db.read()
  const threads = db.data.threads.filter(t => t.forumId === req.params.forumId)
  const recentThreads = threads.sort((a, b) => b.createdAt - a.createdAt)
  res.json(recentThreads)
})

app.post('/api/forums/:forumId/threads', authMiddleware, forumAccessMiddleware, async (req, res) => {
  const { title, content } = req.body
  if (!title || !content) return res.status(400).json({ error: 'title and content required' })
  
  await db.read()
  const forum = db.data.forums.find(f => f.id === req.params.forumId)
  if (!forum) return res.status(404).json({ error: 'forum not found' })
  // backend enforcement for read-only forums
  if (forum.readOnly && !(req.user && (req.user.staffRole === 'admin' || req.user.staffRole === 'manager' || req.user.role === 'staff'))) {
    return res.status(403).json({ error: 'forum is read-only' })
  }

  const thread = {
    id: nanoid(),
    forumId: req.params.forumId,
    title,
    content,
    createdBy: req.user.id,
    createdAt: Date.now(),
    postCount: 0
  }
  
  db.data.threads.push(thread)
  await db.write()
  res.json(thread)
})

// Ticket endpoints
// Get all tickets (staff see all, users see their own)
app.get('/api/tickets', authMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  const userRank = db.data.ranks.find(r => r.id === user.profile?.customRank)
  // Check if user can view tickets
  if (!req.user.staffRole && (!userRank || !userRank.permissions.view_tickets)) {
    return res.status(403).json({ error: 'no permission to view tickets' })
  }
  const tickets = (db.data.tickets || []).map(t => {
    // Attach username for staff search
    const ticketUser = db.data.users.find(u => u.id === t.createdBy)
    return {
      ...t,
      username: ticketUser ? ticketUser.username : undefined,
      createdByUsername: ticketUser ? ticketUser.username : undefined
    }
  })
  // Staff see all, users see their own
  if (req.user.staffRole === 'admin' || req.user.staffRole === 'manager' || req.user.role === 'staff') {
    return res.json(tickets)
  }
  res.json(tickets.filter(t => t.createdBy === req.user.id))
})

// Create a new ticket
app.post('/api/tickets', authMiddleware, async (req, res) => {
  const { subject, description, category } = req.body
  if (!subject || !description) return res.status(400).json({ error: 'subject and description required' })
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  const userRank = db.data.ranks.find(r => r.id === user.profile?.customRank)
  // Check if user can create tickets
  if (!req.user.staffRole && (!userRank || !userRank.permissions.create_tickets)) {
    return res.status(403).json({ error: 'no permission to create tickets' })
  }
  const ticket = {
    id: nanoid(),
    subject,
    description,
    category: category || 'general',
    status: 'open',
    createdBy: req.user.id,
    createdAt: Date.now(),
    responses: []
  }
  if (!db.data.tickets) db.data.tickets = []
  db.data.tickets.push(ticket)
  await db.write()
  res.json(ticket)
})

// Staff: respond to a ticket
app.post('/api/tickets/:ticketId/respond', authMiddleware, async (req, res) => {
  // Only staff can respond
  if (!(req.user.staffRole === 'admin' || req.user.staffRole === 'manager' || req.user.role === 'staff')) {
    return res.status(403).json({ error: 'staff only' })
  }
  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })
  await db.read()
  const ticket = (db.data.tickets || []).find(t => t.id === req.params.ticketId)
  if (!ticket) return res.status(404).json({ error: 'ticket not found' })
  if (!ticket.responses) ticket.responses = []
  ticket.responses.push({
    id: nanoid(),
    staff: true,
    message,
    staffId: req.user.id,
    createdAt: Date.now()
  })
  ticket.status = 'assigned'
  await db.write()
  res.json(ticket)
})

// Staff: close a ticket
app.post('/api/tickets/:ticketId/close', authMiddleware, async (req, res) => {
  if (!(req.user.staffRole === 'admin' || req.user.staffRole === 'manager' || req.user.role === 'staff')) {
    return res.status(403).json({ error: 'staff only' })
  }
  await db.read()
  const ticket = (db.data.tickets || []).find(t => t.id === req.params.ticketId)
  if (!ticket) return res.status(404).json({ error: 'ticket not found' })
  ticket.status = 'closed'
  await db.write()
  res.json(ticket)
})

// 2FA endpoints
app.post('/api/auth/2fa/request-enable', authMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  if (user.twoFa?.enabled) return res.status(400).json({ error: '2fa already enabled' })

  const code = generateSixDigitCode()
  const codeHash = await bcrypt.hash(code, 10)
  user.twoFa = { enabled: false, codeHash, codeExpiry: Date.now() + 10 * 60 * 1000, requestedAt: Date.now(), mode: 'enable' }

  const ip = getClientIp(req)
  const ua = parseUserAgent(req.headers['user-agent'])
  const html = renderOtpEmail({
    title: 'One-Time Password',
    username: user.username,
    message: 'Use this code to enable two-factor authentication on your account.',
    code,
    ip,
    browser: ua.browser,
    os: ua.os,
    device: ua.device,
    expires: 10
  })

  await sendEmail(user.email, 'Unknown.cc 2FA Code', `Your 2FA code is ${code}`, html)
  await db.write()
  res.json({ message: 'Code sent to email' })
})

app.post('/api/auth/2fa/enable', authMiddleware, async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'code required' })

  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })

  const twoFa = user.twoFa || {}
  if (twoFa.mode !== 'enable' || !twoFa.codeHash || Date.now() > twoFa.codeExpiry) {
    return res.status(400).json({ error: 'invalid or expired code' })
  }
  const ok = await bcrypt.compare(String(code), twoFa.codeHash)
  if (!ok) return res.status(400).json({ error: 'invalid or expired code' })

  user.twoFa.enabled = true
  user.twoFa.codeHash = null
  user.twoFa.codeExpiry = null
  user.twoFa.mode = null
  user.twoFa.requestedAt = null

  await db.write()
  res.json({ message: '2FA enabled' })
})

app.post('/api/auth/2fa/request-disable', authMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  if (!user.twoFa?.enabled) return res.status(400).json({ error: '2fa not enabled' })

  const code = generateSixDigitCode()
  const codeHash = await bcrypt.hash(code, 10)
  user.twoFa = { enabled: true, codeHash, codeExpiry: Date.now() + 10 * 60 * 1000, requestedAt: Date.now(), mode: 'disable' }

  const ip = getClientIp(req)
  const ua = parseUserAgent(req.headers['user-agent'])
  const html = renderOtpEmail({
    title: 'One-Time Password',
    username: user.username,
    message: 'Use this code to disable two-factor authentication on your account.',
    code,
    ip,
    browser: ua.browser,
    os: ua.os,
    device: ua.device,
    expires: 10
  })

  await sendEmail(user.email, 'Unknown.cc 2FA Code', `Your 2FA code is ${code}`, html)
  await db.write()
  res.json({ message: 'Code sent to email' })
})

app.post('/api/auth/2fa/disable', authMiddleware, async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'code required' })

  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })

  const twoFa = user.twoFa || {}
  if (twoFa.mode !== 'disable' || !twoFa.codeHash || Date.now() > twoFa.codeExpiry) {
    return res.status(400).json({ error: 'invalid or expired code' })
  }
  const ok = await bcrypt.compare(String(code), twoFa.codeHash)
  if (!ok) return res.status(400).json({ error: 'invalid or expired code' })

  user.twoFa.enabled = false
  user.twoFa.codeHash = null
  user.twoFa.codeExpiry = null
  user.twoFa.mode = null
  user.twoFa.requestedAt = null

  await db.write()
  res.json({ message: '2FA disabled' })
})

// SECURITY: Logout endpoint - revoke token
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  if (req.token) {
    blacklistToken(req.token)
  }
  res.json({ message: 'logged out' })
})

app.post('/api/auth/2fa/confirm-login', async (req, res) => {
  const { code, tempToken } = req.body
  if (!code || !tempToken) return res.status(400).json({ error: 'code and token required' })

  let payload
  try {
    payload = jwt.verify(tempToken, JWT_SECRET)
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
  if (payload?.purpose !== '2fa-login') return res.status(401).json({ error: 'invalid token' })

  await db.read()
  const user = db.data.users.find(u => u.id === payload.id)
  if (!user) return res.status(404).json({ error: 'user not found' })

  const twoFa = user.twoFa || {}
  if (twoFa.mode !== 'login' || !twoFa.codeHash || Date.now() > twoFa.codeExpiry) {
    return res.status(400).json({ error: 'invalid or expired code' })
  }
  const ok = await bcrypt.compare(String(code), twoFa.codeHash)
  if (!ok) return res.status(400).json({ error: 'invalid or expired code' })

  user.twoFa.codeHash = null
  user.twoFa.codeExpiry = null
  user.twoFa.mode = null
  user.twoFa.requestedAt = null

  await db.write()
  const token = generateToken(user)
  res.json({
    token,
    user: {
      id: user.id,
      uid: user.uid,
      username: user.username,
      email: user.email,
      role: user.role,
      staffRole: user.staffRole || null,
      roles: user.roles || [],
      accessRevoked: user.accessRevoked || false,
      twoFaEnabled: !!user.twoFa?.enabled
    }
  })
})

// Password reset endpoints
app.post('/api/auth/reset/request', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  await db.read()
  const user = db.data.users.find(u => u.email && u.email.toLowerCase() === String(email).toLowerCase())
  if (!user) return res.json({ message: 'If the email exists, a code has been sent.' })

  const now = Date.now()
  if (user.reset?.requestedAt && now - user.reset.requestedAt < 60 * 1000) {
    return res.status(429).json({ error: 'please wait before requesting another code' })
  }

  const code = generateSixDigitCode()
  const codeHash = await bcrypt.hash(code, 10)
  user.reset = { codeHash, codeExpiry: now + 30 * 60 * 1000, requestedAt: now }

  const ip = getClientIp(req)
  const ua = parseUserAgent(req.headers['user-agent'])
  const html = renderOtpEmail({
    title: 'Password Reset Code',
    username: user.username,
    message: 'Use this code to reset your password. If you did not request this, ignore this email.',
    code,
    ip,
    browser: ua.browser,
    os: ua.os,
    device: ua.device,
    expires: 30
  })

  await sendEmail(user.email, 'Unknown.cc Password Reset', `Your password reset code is ${code}`, html)
  await db.write()
  res.json({ message: 'If the email exists, a code has been sent.' })
})

app.post('/api/auth/reset/confirm', async (req, res) => {
  const { email, code, newPassword } = req.body
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'email, code, and new password required' })
  if (!validatePassword(newPassword)) return res.status(400).json({ error: 'password must be at least 8 characters' })

  await db.read()
  const user = db.data.users.find(u => u.email && u.email.toLowerCase() === String(email).toLowerCase())
  if (!user || !user.reset?.codeHash || Date.now() > user.reset.codeExpiry) {
    return res.status(400).json({ error: 'invalid or expired code' })
  }

  const ok = await bcrypt.compare(String(code), user.reset.codeHash)
  if (!ok) return res.status(400).json({ error: 'invalid or expired code' })

  user.passwordHash = await bcrypt.hash(String(newPassword), 10)
  user.reset = { codeHash: null, codeExpiry: null, requestedAt: null }

  const ip = getClientIp(req)
  const ua = parseUserAgent(req.headers['user-agent'])
  const html = renderPasswordChangedEmail({ username: user.username, ip, browser: ua.browser, os: ua.os, device: ua.device })
  await sendEmail(user.email, 'Unknown.cc Password Updated', 'Your password has been updated.', html)

  await db.write()
  res.json({ message: 'password updated' })
})

// Password change endpoint
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'all fields required' })
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'passwords do not match' })
  }
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }
  
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  
  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) return res.status(400).json({ error: 'current password is incorrect' })
  
  user.passwordHash = await bcrypt.hash(newPassword, 10)
  await db.write()
  res.json({ message: 'password changed' })
})

app.post('/api/auth/password-reset/request', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  await db.read()
  const user = db.data.users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase())
  if (!user) return res.json({ message: 'If the email exists, a code was sent.' })

  const now = Date.now()
  if (user.reset?.requestedAt && now - user.reset.requestedAt < 60 * 1000) {
    return res.status(429).json({ error: 'please wait before requesting another code' })
  }

  const code = generateSixDigitCode()
  const codeHash = await bcrypt.hash(code, 10)
  user.reset = user.reset || { codeHash: null, codeExpiry: null, requestedAt: null }
  user.reset.codeHash = codeHash
  user.reset.codeExpiry = now + 15 * 60 * 1000
  user.reset.requestedAt = now

  const text = formatEmail(
    'Password Reset Code',
    user.username,
    [
      `Your password reset code is: ${code}`,
      'This code expires in 15 minutes.'
    ]
  )
  await sendEmail(user.email, 'Password Reset Code', text)

  await db.write()
  res.json({ message: 'If the email exists, a code was sent.' })
})

app.post('/api/auth/password-reset/verify', async (req, res) => {
  const { email, code, newPassword } = req.body
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'email, code, and newPassword required' })
  }
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }

  await db.read()
  const user = db.data.users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase())
  if (!user?.reset?.codeHash || !user.reset.codeExpiry) {
    return res.status(400).json({ error: 'invalid or expired code' })
  }
  if (Date.now() > user.reset.codeExpiry) {
    return res.status(400).json({ error: 'invalid or expired code' })
  }

  const ok = await bcrypt.compare(String(code), user.reset.codeHash)
  if (!ok) return res.status(400).json({ error: 'invalid or expired code' })

  user.passwordHash = await bcrypt.hash(newPassword, 10)
  user.reset.codeHash = null
  user.reset.codeExpiry = null
  user.reset.requestedAt = null

  const client = getClientInfo(req)
  const text = formatEmail(
    'Updated Password',
    user.username,
    [
      'Your password has been successfully updated.',
      'If you did not initiate this change, contact support immediately.'
    ],
    [
      `IP Address: ${client.ip}`,
      `User Agent: ${client.userAgent}`
    ]
  )
  await sendEmail(user.email, 'Updated Password', text)

  await db.write()
  res.json({ message: 'password updated' })
})

// Profile update endpoint
app.post('/api/users/profile', authMiddleware, async (req, res) => {
  const { bio, signature, pfp, banner } = req.body

  try {
    await db.read()
    const user = db.data.users.find(u => u.id === req.user.id)
    if (!user) return res.status(404).json({ error: 'user not found' })

    if (!user.profile) user.profile = {}
    if (bio !== undefined) user.profile.bio = bio
    if (signature !== undefined) user.profile.signature = signature

    // SECURITY: Helper to save a data URL to disk with file-type validation (magic bytes)
    const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    async function saveDataUrl(dataUrl, prefix) {
      try {
        const m = typeof dataUrl === 'string' && dataUrl.match(/^data:(.+);base64,(.+)$/)
        if (!m) return null
        const statedMime = m[1]
        const b64 = m[2]
        const buffer = Buffer.from(b64, 'base64')
        
        // SECURITY: Validate actual file type using magic bytes, not just stated MIME
        const detectedType = await fileTypeFromBuffer(buffer)
        if (!detectedType || !allowedMimes.has(detectedType.mime)) {
          console.warn(`File upload rejected: stated ${statedMime}, detected ${detectedType?.mime}`)
          return null
        }
        
        const ext = detectedType.ext
        const filename = `${prefix}_${nanoid()}.${ext}`
        const filepath = path.join(uploadsDir, filename)
        fs.writeFileSync(filepath, buffer)
        return `/uploads/${filename}`
      } catch (e) {
        console.error('Failed to save data URL:', e && e.message)
        return null
      }
    }

    if (pfp) {
      // if already a URL/path, keep it; otherwise, try to save data URL
      if (typeof pfp === 'string' && pfp.startsWith('/uploads/')) {
        user.profile.pfp = pfp
      } else {
        const saved = await saveDataUrl(pfp, 'pfp')
        if (saved) user.profile.pfp = saved
        else return res.status(400).json({ error: 'invalid pfp data' })
      }
    }

    if (banner) {
      if (typeof banner === 'string' && banner.startsWith('/uploads/')) {
        user.profile.banner = banner
      } else {
        const saved = await saveDataUrl(banner, 'banner')
        if (saved) user.profile.banner = saved
        else return res.status(400).json({ error: 'invalid banner data' })
      }
    }

    await db.write()
    res.json({ message: 'profile updated', profile: user.profile })
  } catch (err) {
    console.error('Profile update error:', err && err.message)
    res.status(500).json({ error: err.message || 'profile update failed' })
  }
})

app.post('/api/users/redeem-key', authMiddleware, async (req, res) => {
  const { key } = req.body
  if (!key) return res.status(400).json({ error: 'key required' })

  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })

  const found = db.data.keys.find(k => k.key === key && !k.usedBy && !k.revoked)
  if (!found) return res.status(400).json({ error: 'invalid or used key' })

  found.usedBy = user.id
  found.usedAt = Date.now()
  user.accessRevoked = false
  user.accessRevokedAt = null
  user.inviteKeyId = found.id

  await db.write()
  res.json({ accessRevoked: false })
})

app.get('/api/users/invites', authMiddleware, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  const userRank = db.data.ranks.find(r => r.id === user.profile?.customRank)
  const canGenerate = hasPermission(user, userRank, 'generate_invites')

  const keys = (db.data.keys || []).filter(k => k.generatedBy === user.id)
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime()

  const invitationsSentToday = keys.filter(k => k.generatedAt >= startOfDay).length
  const invitationsSentThisMonth = keys.filter(k => k.generatedAt >= startOfMonth).length

  const payload = keys.map(k => ({
    id: k.id,
    key: k.key,
    generatedAt: k.generatedAt,
    usedBy: k.usedBy || null,
    usedAt: k.usedAt || null,
    usedByUsername: k.usedBy ? db.data.users.find(u => u.id === k.usedBy)?.username : null,
    revoked: !!k.revoked
  }))

  res.json({
    canGenerate,
    stats: {
      invitationsSentToday,
      invitationsSentThisMonth,
      totalInvitationsSent: keys.length
    },
    invites: payload
  })
})

app.post('/api/users/invites/generate', authMiddleware, async (req, res) => {
  const { count = 1 } = req.body || {}
  if (count < 1 || count > 25) return res.status(400).json({ error: 'count must be 1-25' })

  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  const userRank = db.data.ranks.find(r => r.id === user.profile?.customRank)
  if (!hasPermission(user, userRank, 'generate_invites')) {
    return res.status(403).json({ error: 'no permission to generate invites' })
  }

  const newKeys = []
  for (let i = 0; i < count; i++) {
    const key = {
      id: nanoid(),
      key: generateInviteKey(),
      generatedBy: user.id,
      generatedAt: Date.now(),
      usedBy: null,
      usedAt: null,
      revoked: false,
      revokedAt: null
    }
    newKeys.push(key)
    db.data.keys.push(key)
  }
  await db.write()
  res.json({ invites: newKeys })
})

// Role permission management (admin only)
app.post('/api/admin/ranks/:rankId/permissions', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  
  const { permissions } = req.body
  await db.read()
  
  const rank = db.data.ranks.find(r => r.id === req.params.rankId)
  if (!rank) return res.status(404).json({ error: 'rank not found' })
  
  rank.permissions = { ...rank.permissions, ...permissions }
  await db.write()
  res.json(rank)
})

// TOS endpoints
app.get('/api/tos', async (req, res) => {
  await db.read()
  res.json(db.data.tos || { title: 'Terms of Service', content: '' })
})

app.post('/api/admin/tos', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  
  const { title, content } = req.body
  if (!title || !content) return res.status(400).json({ error: 'title and content required' })
  
  await db.read()
  db.data.tos = { title, content, lastUpdated: Date.now() }
  await db.write()
  res.json(db.data.tos)
})

// Store/Products endpoints
app.get('/api/store/products', async (req, res) => {
  await db.read()
  res.json(db.data.products || [])
})

app.post('/api/admin/products', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  
  const { name, description, price, currency } = req.body
  if (!name || !price) return res.status(400).json({ error: 'name and price required' })
  
  await db.read()
  if (!db.data.products) db.data.products = []
  
  const product = {
    id: `prod_${nanoid()}`,
    name,
    description: description || '',
    price: parseInt(price),
    currency: currency || 'USD',
    createdAt: Date.now()
  }
  
  db.data.products.push(product)
  await db.write()
  res.json(product)
})

app.delete('/api/admin/products/:id', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  
  await db.read()
  const idx = db.data.products.findIndex(p => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'product not found' })
  
  db.data.products.splice(idx, 1)
  await db.write()
  res.json({ message: 'product deleted' })
})

// Stripe config endpoints
app.get('/api/admin/stripe-config', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  
  await db.read()
  res.json({
    configured: !!db.data.stripeConfig?.apiKey,
    publishableKey: db.data.stripeConfig?.publishableKey || ''
  })
})

app.post('/api/admin/stripe-config', authMiddleware, async (req, res) => {
  if (req.user.staffRole !== 'admin') return res.status(403).json({ error: 'admin only' })
  
  const { apiKey, publishableKey } = req.body
  if (!apiKey || !publishableKey) return res.status(400).json({ error: 'apiKey and publishableKey required' })
  
  await db.read()
  db.data.stripeConfig = { apiKey, publishableKey }
  await db.write()
  res.json({ message: 'Stripe configured' })
})

// Stripe payment endpoints
app.post('/api/store/create-payment-intent', authMiddleware, async (req, res) => {
  const { productId } = req.body
  if (!productId) return res.status(400).json({ error: 'productId required' })
  
  await db.read()
  const product = db.data.products.find(p => p.id === productId)
  if (!product) return res.status(404).json({ error: 'product not found' })
  
  if (!db.data.stripeConfig?.apiKey) {
    return res.status(500).json({ error: 'Stripe not configured' })
  }
  
  try {
    const stripe = new Stripe(db.data.stripeConfig.apiKey)
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: product.price,
      currency: product.currency.toLowerCase(),
      metadata: {
        productId: product.id,
        productName: product.name,
        userId: req.user.id
      }
    })
    
    res.json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/store/checkout', authMiddleware, async (req, res) => {
  const { productId, paymentIntentId } = req.body
  const { tosAccepted, tosSignature } = req.body
  if (!productId || !paymentIntentId) {
    return res.status(400).json({ error: 'productId and paymentIntentId required' })
  }
  await db.read()
  if (!db.data.tos) return res.status(400).json({ error: 'TOS not configured' })
  if (!tosAccepted || !tosSignature) return res.status(400).json({ error: 'You must accept the TOS and provide a signature before purchase' })
  const product = db.data.products.find(p => p.id === productId)
  if (!product) return res.status(404).json({ error: 'product not found' })
  
  if (!db.data.orders) db.data.orders = []
  
  const order = {
    id: nanoid(),
    productId,
    productName: product.name,
    price: product.price,
    currency: product.currency,
    userId: req.user.id,
    paymentIntentId,
    status: 'completed',
    tosAccepted: !!tosAccepted,
    tosSignature: (tosSignature || '').toString(),
    createdAt: Date.now()
  }
  
  db.data.orders.push(order)
  await db.write()
  res.json(order)
})

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`)
})

