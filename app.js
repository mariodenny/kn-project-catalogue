require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const methodOverride = require('method-override');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session); // ✅ IMPORTANT: Perhatikan kurungnya!
const db = require('./database/database');
const adminRoutes = require('./admin/admin');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ SQLite session store dengan connect-sqlite3
const sessionStore = new SQLiteStore({
  db: process.env.VERCEL ? '/tmp/projects.db' : 'database/projects.db',
  table: 'sessions',
  concurrentDB: true
});

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = '/tmp/uploads';
    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use('/uploads', express.static('/tmp/uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// ✅ Session configuration dengan connect-sqlite3
app.use(session({
  name: 'knmedan.sid',
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Debug middleware
app.use((req, res, next) => {
  console.log('=== SESSION DEBUG ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session admin:', req.session?.admin);
  console.log('=====================');
  next();
});

// Routes (tetap sama)
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/upload', (req, res) => {
  res.render('upload', { 
    error: null,
    formData: null 
  });
});

app.post('/upload', upload.array('screenshots', 3), async (req, res) => {
  try {
    const { projectName, projectLink, studentName, teacherName, moduleName } = req.body;
    const screenshots = req.files ? req.files.map(file => file.filename) : [];

    if (!screenshots || screenshots.length !== 3) {
      return res.render('upload', { 
        error: 'Please upload exactly 3 screenshots',
        formData: req.body 
      });
    }

    await db.addProject({
      projectName,
      projectLink,
      studentName,
      teacherName,
      moduleName,
      screenshots: JSON.stringify(screenshots)
    });

    res.render('success', { 
      message: 'Project submitted successfully! It will be visible after admin approval.' 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.render('upload', { 
      error: 'Error uploading project. Please try again.',
      formData: req.body 
    });
  }
});

app.get('/projects', async (req, res) => {
  try {
    const { search, category } = req.query;
    const projects = await db.getProjects(search, category, true);
    res.render('projects', { projects, search, category });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching projects');
  }
});

// Admin routes
app.use('/admin', adminRoutes);

// Debug routes
app.get('/debug/session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    session: req.session,
    environment: process.env.NODE_ENV,
    vercel: process.env.VERCEL
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    sessionWorking: !!req.sessionID,
    sessionAdmin: !!req.session?.admin,
    sessionStore: 'connect-sqlite3'
  });
});

// Initialize database and start server
db.init().then(async () => {
  await db.testConnection();
  
  // Create uploads directory
  const uploadPath = '/tmp/uploads';
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  
  if (process.env.VERCEL) {
    console.log('🚀 Running on Vercel');
    console.log('🔐 Session store: connect-sqlite3');
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔐 Admin login: http://localhost:${PORT}/admin/login`);
      console.log(`💾 Session store: connect-sqlite3`);
    });
  }
}).catch(error => {
  console.error('Failed to start server:', error);
});

module.exports = app;