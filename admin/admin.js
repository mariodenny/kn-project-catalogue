const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/database');
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Admin Login
router.get('/login', isNotAuthenticated, (req, res) => {
  res.render('admin/login', { error: null });
});

router.post('/login', isNotAuthenticated, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = await db.getAdminByUsername(username);
    if (!admin) {
      return res.render('admin/login', { error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.render('admin/login', { error: 'Invalid credentials' });
    }

    req.session.admin = {
      id: admin.id,
      username: admin.username
    };

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error(error);
    res.render('admin/login', { error: 'Login failed' });
  }
});

// Admin Logout
router.post('/logout', isAuthenticated, (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
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