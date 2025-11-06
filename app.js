require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const methodOverride = require('method-override');
const session = require('express-session');
const db = require('./database/database');
const adminRoutes = require('./admin/admin');

const app = express();
const PORT = process.env.PORT || 3000;

let sessionStore = null;
if (process.env.VERCEL) {
  const MemoryStore = require('memorystore')(session);
  sessionStore = new MemoryStore({
    checkPeriod: 86400000 
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = '/tmp/uploads';
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
if (process.env.VERCEL) {
  app.use('/uploads', express.static('/tmp/uploads'));
} else {
  app.use('/uploads', express.static('public/uploads'));
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session configuration untuk Vercel
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { 
    secure: false, 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  next();
});

// Routes
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

    console.log('Uploaded files:', req.files);
    console.log('Screenshots array:', screenshots);

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
    cookies: req.headers.cookie,
    environment: process.env.NODE_ENV,
    vercel: process.env.VERCEL
  });
});

app.get('/debug/clear-session', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.json({ error: err.message });
    } else {
      res.json({ message: 'Session cleared' });
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    sessionWorking: !!req.sessionID 
  });
});

// Initialize database and start server
db.init().then(async () => {
  await db.testConnection();
  
  if (process.env.VERCEL) {
    console.log('🚀 Running on Vercel');
    console.log('🔐 Session store: MemoryStore');
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔐 Admin login: http://localhost:${PORT}/admin/login`);
    });
  }
}).catch(error => {
  console.error('Failed to start server:', error);
});

module.exports = app;