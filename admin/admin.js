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

router.post('/projects/:id/approve', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    console.log('Approving project:', projectId);
    
    const result = await db.updateProjectStatus(projectId, 'approved');
    
    if (result > 0) {
      console.log('Project approved successfully:', projectId);
      res.json({ 
        success: true, 
        message: 'Project approved successfully' 
      });
    } else {
      console.log('Project not found for approval:', projectId);
      res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
  } catch (error) {
    console.error('Error approving project:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to approve project: ' + error.message 
    });
  }
});

router.post('/projects/:id/reject', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    console.log('Rejecting project:', projectId);
    
    const result = await db.updateProjectStatus(projectId, 'rejected');
    
    if (result > 0) {
      console.log('Project rejected successfully:', projectId);
      res.json({ 
        success: true, 
        message: 'Project rejected successfully' 
      });
    } else {
      console.log('Project not found for rejection:', projectId);
      res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
  } catch (error) {
    console.error('Error rejecting project:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reject project: ' + error.message 
    });
  }
});

router.delete('/projects/:id', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    console.log('Deleting project:', projectId);
    
    const result = await db.deleteProject(projectId);
    
    if (result > 0) {
      console.log('Project deleted successfully:', projectId);
      res.json({ 
        success: true, 
        message: 'Project deleted successfully' 
      });
    } else {
      console.log('Project not found for deletion:', projectId);
      res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete project: ' + error.message 
    });
  }
});

router.get('/projects/:id', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    console.log('Getting project details:', projectId);
    
    const allProjects = await db.getAllProjects();
    const project = allProjects.find(p => p.id == projectId);
    
    if (project) {
      res.json({ 
        success: true, 
        project 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get project: ' + error.message 
    });
  }
});

module.exports = router;