const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.VERCEL ?
    '/tmp/projects.db' :
    path.join(__dirname, 'projects.db');

// Buat folder uploads di /tmp jika di Vercel
if (process.env.VERCEL) {
    const tmpUploads = '/tmp/uploads';
    if (!fs.existsSync(tmpUploads)) {
        fs.mkdirSync(tmpUploads, {
            recursive: true
        });
    }
}

const db = new sqlite3.Database(dbPath);

const init = () => {
    return new Promise((resolve, reject) => {
        console.log('Initializing DB at:', dbPath);

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
            if (err) {
                console.error('Error creating projects table:', err);
                reject(err);
            } else {
                console.log('Projects table created/verified');

                db.run(`
          CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, async (err) => {
                    if (err) {
                        console.error('Error creating admins table:', err);
                        reject(err);
                    } else {
                        console.log('Admins table created/verified');
                        try {
                            await createDefaultAdmin();
                            console.log('Default admin setup completed');
                            resolve();
                        } catch (adminError) {
                            console.error('Error creating default admin:', adminError);
                            reject(adminError);
                        }
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

        console.log('Creating default admin:', defaultUsername);

        if (!defaultUsername || !defaultPassword) {
            const error = 'ADMIN_USERNAME or ADMIN_PASSWORD environment variables are not set';
            console.error(error);
            reject(new Error(error));
            return;
        }

        const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

        db.run(`
      INSERT OR IGNORE INTO admins (username, password) 
      VALUES (?, ?)
    `, [defaultUsername, hashedPassword], function (err) {
            if (err) {
                console.error('Error inserting admin:', err);
                reject(err);
            } else {
                if (this.changes > 0) {
                    console.log('✅ Default admin account created');
                    console.log('📝 Username:', defaultUsername);
                    console.log('🔑 Password:', defaultPassword);
                } else {
                    console.log('ℹ️ Admin account already exists');
                }
                resolve();
            }
        });
    });
};

const addProject = (project) => {
    return new Promise((resolve, reject) => {
        const {
            projectName,
            projectLink,
            studentName,
            teacherName,
            moduleName,
            screenshots
        } = project;

        console.log('Adding project:', projectName);

        db.run(`
      INSERT INTO projects (projectName, projectLink, studentName, teacherName, moduleName, screenshots, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [projectName, projectLink, studentName, teacherName, moduleName, screenshots], function (err) {
            if (err) {
                console.error('Error adding project:', err);
                reject(err);
            } else {
                console.log('Project added with ID:', this.lastID);
                resolve(this.lastID);
            }
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
            query += ` AND (projectName LIKE ? OR teacherName LIKE ? OR studentName LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category) {
            query += ` AND moduleName = ?`;
            params.push(category);
        }

        query += ` ORDER BY createdAt DESC`;

        console.log('Getting projects with query:', query, params);

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Error getting projects:', err);
                reject(err);
            } else {
                const projects = rows.map(row => ({
                    ...row,
                    screenshots: JSON.parse(row.screenshots || '[]')
                }));
                console.log(`Found ${projects.length} projects`);
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
            if (err) {
                console.error('Error getting pending projects:', err);
                reject(err);
            } else {
                const projects = rows.map(row => ({
                    ...row,
                    screenshots: JSON.parse(row.screenshots || '[]')
                }));
                console.log(`Found ${projects.length} pending projects`);
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
            if (err) {
                console.error('Error getting all projects:', err);
                reject(err);
            } else {
                const projects = rows.map(row => ({
                    ...row,
                    screenshots: JSON.parse(row.screenshots || '[]')
                }));
                console.log(`Found ${projects.length} total projects`);
                resolve(projects);
            }
        });
    });
};

const updateProjectStatus = (projectId, status) => {
    return new Promise((resolve, reject) => {
        console.log(`Updating project ${projectId} status to: ${status}`);

        db.run(`
      UPDATE projects 
      SET status = ? 
      WHERE id = ?
    `, [status, projectId], function (err) {
            if (err) {
                console.error('Error updating project status:', err);
                reject(err);
            } else {
                console.log(`Project ${projectId} updated, changes: ${this.changes}`);
                resolve(this.changes);
            }
        });
    });
};

const deleteProject = (projectId) => {
    return new Promise((resolve, reject) => {
        console.log(`Deleting project: ${projectId}`);

        db.run(`DELETE FROM projects WHERE id = ?`, [projectId], function (err) {
            if (err) {
                console.error('Error deleting project:', err);
                reject(err);
            } else {
                console.log(`Project ${projectId} deleted, changes: ${this.changes}`);
                resolve(this.changes);
            }
        });
    });
};

// Admin authentication
const getAdminByUsername = (username) => {
    return new Promise((resolve, reject) => {
        console.log('Looking for admin:', username);

        db.get(`SELECT * FROM admins WHERE username = ?`, [username], (err, row) => {
            if (err) {
                console.error('Error finding admin:', err);
                reject(err);
            } else {
                if (row) {
                    console.log('Admin found:', row.username);
                } else {
                    console.log('Admin not found:', username);
                }
                resolve(row);
            }
        });
    });
};

const testConnection = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT 1 as test", (err, row) => {
            if (err) {
                console.error('Database connection test failed:', err);
                reject(err);
            } else {
                console.log('Database connection test passed');
                resolve(row);
            }
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
    getAdminByUsername,
    testConnection
};