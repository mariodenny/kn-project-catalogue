require('dotenv').config();
import { SpeedInsights } from "@vercel/speed-insights/next"
const express = require('express');
const path = require('path');
const multer = require('multer');
const methodOverride = require('method-override');
const session = require('express-session');
const db = require('./database/database');
const adminRoutes = require('./admin/admin');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set true jika menggunakan HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
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
    const projects = await db.getProjects(search, category, true); // Only approved projects
    res.render('projects', { projects, search, category });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching projects');
  }
});

// Admin routes
app.use('/admin', adminRoutes);

// Initialize database and start server
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔐 Admin login: http://localhost:${PORT}/admin/login`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
});