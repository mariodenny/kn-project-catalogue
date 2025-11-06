const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/database');
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Admin Login
router.get('/login', isNotAuthenticated, (req, res) => {
  console.log('GET /admin/login - Session:', req.sessionID);
  res.render('admin/login', { 
    error: null
  });
});

router.post('/login', isNotAuthenticated, async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('POST /admin/login - Attempting login for:', username);
    console.log('Session before login:', req.sessionID, req.session);

    const admin = await db.getAdminByUsername(username);
    if (!admin) {
      console.log('Admin not found:', username);
      return res.render('admin/login', { 
        error: 'Invalid credentials'
      });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      console.log('Invalid password for:', username);
      return res.render('admin/login', { 
        error: 'Invalid credentials'
      });
    }

    // Set session data
    req.session.admin = {
      id: admin.id,
      username: admin.username,
      loggedInAt: new Date().toISOString()
    };

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('admin/login', { 
          error: 'Login failed - session error'
        });
      }

      console.log('Login successful:', username);
      console.log('Session after login:', req.sessionID, req.session);
      res.redirect('/admin/dashboard');
    });

  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { 
      error: 'Login failed: ' + error.message
    });
  }
});

// Admin Dashboard dengan session check
router.get('/dashboard', isAuthenticated, async (req, res) => {
  console.log('GET /admin/dashboard - Session:', req.sessionID, req.session);
  
  try {
    const pendingCount = (await db.getPendingProjects()).length;
    const totalProjects = (await db.getAllProjects()).length;
    
    res.render('admin/dashboard', {
      admin: req.session.admin,
      pendingCount,
      totalProjects
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading dashboard');
  }
});

// Logout
router.post('/logout', isAuthenticated, (req, res) => {
  console.log('POST /admin/logout - Session:', req.sessionID);
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/admin/dashboard');
    }
    
    res.redirect('/admin/login');
  });
});

// Debug admin session
router.get('/debug', isAuthenticated, (req, res) => {
  res.json({
    sessionID: req.sessionID,
    admin: req.session.admin,
    environment: process.env.NODE_ENV
  });
});

// Admin Dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const pendingCount = (await db.getPendingProjects()).length;
    const totalProjects = (await db.getAllProjects()).length;
    
    res.render('admin/dashboard', {
      admin: req.session.admin,
      pendingCount,
      totalProjects
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading dashboard');
  }
});

// Manage Projects - Pending Approval
router.get('/projects/pending', isAuthenticated, async (req, res) => {
  try {
    const projects = await db.getPendingProjects();
    res.render('admin/projects', {
      admin: req.session.admin,
      projects,
      title: 'Pending Projects',
      type: 'pending'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading projects');
  }
});

// Manage Projects - All Projects
router.get('/projects/all', isAuthenticated, async (req, res) => {
  try {
    const projects = await db.getAllProjects();
    res.render('admin/projects', {
      admin: req.session.admin,
      projects,
      title: 'All Projects',
      type: 'all'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading projects');
  }
});

// Approve Project
router.post('/projects/:id/approve', isAuthenticated, async (req, res) => {
  try {
    await db.updateProjectStatus(req.params.id, 'approved');
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: 'Failed to approve project' });
  }
});

// Reject Project
router.post('/projects/:id/reject', isAuthenticated, async (req, res) => {
  try {
    await db.updateProjectStatus(req.params.id, 'rejected');
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: 'Failed to reject project' });
  }
});

// Delete Project
router.delete('/projects/:id', isAuthenticated, async (req, res) => {
  try {
    await db.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: 'Failed to delete project' });
  }
});

module.exports = router;