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

// Untuk Vercel, gunakan /tmp folder untuk uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.VERCEL ? '/tmp/uploads' : 'public/uploads';
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

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session config untuk production
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

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
    console.error(error);
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

// Health check untuk Vercel
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize database and start server
db.init().then(() => {
  if (process.env.VERCEL) {
    console.log('🚀 Running on Vercel');
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔐 Admin login: http://localhost:${PORT}/admin/login`);
    });
  }
}).catch(error => {
  console.error('Failed to start server:', error);
});

// Export untuk Vercel
module.exports = app;