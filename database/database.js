const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs')
require('dotenv').config();

const dbPath = process.env.VERCEL 
  ? '/tmp/projects.db' 
  : path.join(__dirname, 'projects.db');

// Buat folder uploads di /tmp jika di Vercel
if (process.env.VERCEL) {
  const tmpUploads = '/tmp/uploads';
  if (!fs.existsSync(tmpUploads)) {
    fs.mkdirSync(tmpUploads, { recursive: true });
  }
}
const db = new sqlite3.Database(dbPath);

const init = () => {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectName TEXT NOT NULL,
        projectLink TEXT,
        studentName TEXT,
        teacherName TEXT,
        moduleName TEXT NOT NULL,
        screenshots TEXT,
        status TEXT DEFAULT 'pending',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else {
        db.run(`
          CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, async (err) => {
          if (err) reject(err);
          else {
            await createDefaultAdmin();
            resolve();
          }
        });
      }
    });
  });
};

const createDefaultAdmin = () => {
  return new Promise((resolve, reject) => {
    const defaultUsername = process.env.ADMIN_USERNAME
    const defaultPassword = process.env.ADMIN_PASSWORD
    
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
    
    db.run(`
      INSERT OR IGNORE INTO admins (username, password) 
      VALUES (?, ?)
    `, [defaultUsername, hashedPassword], function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
};

const addProject = (project) => {
  return new Promise((resolve, reject) => {
    const { projectName, projectLink, studentName, teacherName, moduleName, screenshots } = project;
    
    db.run(`
      INSERT INTO projects (projectName, projectLink, studentName, teacherName, moduleName, screenshots, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [projectName, projectLink, studentName, teacherName, moduleName, screenshots], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const getProjects = (search = '', category = '', approvedOnly = true) => {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM projects WHERE 1=1`;
    const params = [];

    if (approvedOnly) {
      query += ` AND status = 'approved'`;
    }

    if (search) {
      query += ` AND (projectName LIKE ? OR teacherName LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      query += ` AND moduleName = ?`;
      params.push(category);
    }

    query += ` ORDER BY createdAt DESC`;

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else {
        const projects = rows.map(row => ({
          ...row,
          screenshots: JSON.parse(row.screenshots || '[]')
        }));
        resolve(projects);
      }
    });
  });
};

// Admin functions
const getPendingProjects = () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM projects 
      WHERE status = 'pending' 
      ORDER BY createdAt DESC
    `, (err, rows) => {
      if (err) reject(err);
      else {
        const projects = rows.map(row => ({
          ...row,
          screenshots: JSON.parse(row.screenshots || '[]')
        }));
        resolve(projects);
      }
    });
  });
};

const getAllProjects = () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM projects 
      ORDER BY 
        CASE status 
          WHEN 'pending' THEN 1 
          WHEN 'approved' THEN 2 
          ELSE 3 
        END,
        createdAt DESC
    `, (err, rows) => {
      if (err) reject(err);
      else {
        const projects = rows.map(row => ({
          ...row,
          screenshots: JSON.parse(row.screenshots || '[]')
        }));
        resolve(projects);
      }
    });
  });
};

const updateProjectStatus = (projectId, status) => {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE projects 
      SET status = ? 
      WHERE id = ?
    `, [status, projectId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const deleteProject = (projectId) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM projects WHERE id = ?`, [projectId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// Admin authentication
const getAdminByUsername = (username) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM admins WHERE username = ?`, [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = {
  init,
  addProject,
  getProjects,
  getPendingProjects,
  getAllProjects,
  updateProjectStatus,
  deleteProject,
  getAdminByUsername
};