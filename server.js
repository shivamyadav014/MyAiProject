const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { OAuth2Client } = require('google-auth-library');
const config = require('./config');

const app = express();
const port = process.env.PORT || 8080;
const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory

// Database setup
const db = new sqlite3.Database(config.DB_PATH);

db.serialize(() => {
    // Check if the users table exists and if it has the age column
    db.get("PRAGMA table_info(users)", (err, row) => {
        if (err) {
            console.error('Error checking table schema:', err);
            return;
        }

        // Create users table with age column if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            age INTEGER,
            google_id TEXT
        )`);

        // Check if we need to add the age column to an existing table
        db.get("SELECT * FROM pragma_table_info('users') WHERE name = 'age'", (err, row) => {
            if (err) {
                console.error('Error checking for age column:', err);
                return;
            }

            if (!row) {
                console.log('Adding age column to users table...');
                db.run("ALTER TABLE users ADD COLUMN age INTEGER", (err) => {
                    if (err) {
                        console.error('Error adding age column:', err);
                    } else {
                        console.log('Age column added successfully');
                    }
                });
            } else {
                console.log('Age column already exists in users table');
            }
        });
    });

    // Create period_data table
    db.run(`CREATE TABLE IF NOT EXISTS period_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        start_date TEXT,
        end_date TEXT,
        symptoms TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Insert demo user if it doesn't exist - with more error handling
    db.get('SELECT * FROM users WHERE email = ?', ['olivia@gmail.com'], async (err, user) => {
        if (err) {
            console.error('Error checking for demo user:', err);
            return;
        }

        if (!user) {
            try {
                const hashedPassword = await bcrypt.hash('password123', 10);
                db.run(
                    'INSERT INTO users (name, email, password, age) VALUES (?, ?, ?, ?)',
                    ['Olivia', 'olivia@gmail.com', hashedPassword, 28],
                    function(err) {
                        if (err) {
                            console.error('Error creating demo user:', err);
                            return;
                        }

                        const userId = this.lastID;
                        console.log('Created demo user with ID:', userId);
                        
                        // Insert demo period data
                        const demoData = [
                            {
                                start_date: '2023-12-17',
                                end_date: '2023-12-22',
                                symptoms: '{"cramps":true,"headache":false,"bloating":true}'
                            },
                            {
                                start_date: '2024-01-15',
                                end_date: '2024-01-20',
                                symptoms: '{"cramps":true,"headache":true,"bloating":true}'
                            },
                            {
                                start_date: '2024-02-11',
                                end_date: '2024-02-16',
                                symptoms: '{"cramps":false,"headache":true,"bloating":true}'
                            },
                            {
                                start_date: '2024-03-13',
                                end_date: '2024-03-18',
                                symptoms: '{"cramps":true,"headache":false,"bloating":false}'
                            }
                        ];
                        
                        const stmt = db.prepare('INSERT INTO period_data (user_id, start_date, end_date, symptoms) VALUES (?, ?, ?, ?)');
                        demoData.forEach(period => {
                            stmt.run(userId, period.start_date, period.end_date, period.symptoms);
                        });
                        stmt.finalize();
                        
                        console.log('Demo user and data created successfully');
                    }
                );
            } catch (error) {
                console.error('Error hashing password for demo user:', error);
            }
        } else {
            console.log('Demo user already exists:', user.email);
        }
    });
});

// JWT secret
const JWT_SECRET = config.JWT_SECRET;

// Google Sign-In verification
async function verifyGoogleToken(token) {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: config.GOOGLE_CLIENT_ID
        });
        return ticket.getPayload();
    } catch (error) {
        console.error('Error verifying Google token:', error);
        return null;
    }
}

// Google authentication route
app.post('/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        const payload = await verifyGoogleToken(token);

        if (!payload) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check if user exists
        db.get('SELECT * FROM users WHERE google_id = ?', [payload.sub], async (err, user) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            if (!user) {
                // Create new user
                db.run(
                    'INSERT INTO users (name, email, google_id) VALUES (?, ?, ?)',
                    [payload.name, payload.email, payload.sub],
                    function(err) {
                        if (err) return res.status(500).json({ error: 'Error creating user' });
                        const token = jwt.sign({ id: this.lastID }, JWT_SECRET);
                        res.status(201).json({ token });
                    }
                );
            } else {
                // User exists, create token
                const token = jwt.sign({ id: user.id }, JWT_SECRET);
                res.json({ token });
            }
        });
    } catch (error) {
        console.error('Error in Google authentication:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Config route
app.get('/config', (req, res) => {
    res.json({
        GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID,
        GOOGLE_API_KEY: config.GOOGLE_API_KEY
    });
});

// Password reset tokens storage (in memory for demo purposes)
// In a production environment, these should be stored in the database
const passwordResetTokens = {};

// Request password reset endpoint
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        // Always return success even if email doesn't exist (for security)
        if (!user) {
            return res.json({ message: 'If your email exists, you will receive password reset instructions.' });
        }
        
        // Generate a reset token (in a real app, use a more secure method)
        const resetToken = Math.random().toString(36).substring(2, 15) + 
                          Math.random().toString(36).substring(2, 15);
        
        // Store the token with the user ID and an expiration time (1 hour)
        passwordResetTokens[resetToken] = {
            userId: user.id,
            expiry: Date.now() + 3600000 // 1 hour from now
        };
        
        // In a real app, send an email with a link like:
        // http://yourapp.com/reset-password.html?token=resetToken
        console.log(`Password reset requested for ${email}. Token: ${resetToken}`);
        console.log(`Reset link: http://localhost:${port}/reset-password.html?token=${resetToken}`);
        
        res.json({ message: 'If your email exists, you will receive password reset instructions.' });
    });
});

// Reset password endpoint
app.post('/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    // Validate token
    const tokenData = passwordResetTokens[token];
    if (!tokenData || tokenData.expiry < Date.now()) {
        return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    // Hash the new password
    bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        // Update user's password
        db.run(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, tokenData.userId],
            (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Server error' });
                }
                
                // Remove the used token
                delete passwordResetTokens[token];
                
                res.json({ message: 'Password has been reset successfully' });
            }
        );
    });
});

// Auth routes
app.post('/signup', async (req, res) => {
    try {
        const { name, email, password, age } = req.body;
        
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        // Validate age if provided
        const ageValue = age ? parseInt(age) : null;
        if (age && (isNaN(ageValue) || ageValue < 13 || ageValue > 100)) {
            return res.status(400).json({ error: 'Age must be between 13 and 100' });
        }
        
        console.log('Creating new user:', { name, email, age: ageValue });
        
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            'INSERT INTO users (name, email, password, age) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, ageValue],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        console.error('Signup failed: Email already exists -', email);
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    console.error('Error creating user:', err);
                    return res.status(500).json({ error: 'Error creating user: ' + err.message });
                }

                const userId = this.lastID;
                console.log('New user created successfully with ID:', userId);
                
                // Create token with user ID
                const token = jwt.sign({ id: userId }, JWT_SECRET);
                
                // Send back the user info for immediate display
                res.status(201).json({ 
                    token,
                    message: 'User created successfully',
                    user: {
                        id: userId,
                        name,
                        email,
                        age: ageValue || 25 // Default age if not provided
                    }
                });
            }
        );
    } catch (error) {
        console.error('Server error in signup:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    if (!email || !password) {
        console.error('Login failed: Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Log query for debugging
    console.log(`Querying for user with email: ${email}`);
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Database error in login:', err);
            return res.status(500).json({ error: 'Server error: ' + err.message });
        }
        
        console.log('User query result:', user ? 'User found' : 'User not found');
        
        if (!user) {
            console.error('Login failed: User not found for email:', email);
            
            // Debug: Check if we can find any users at all (helps identify schema issues)
            db.all('SELECT email FROM users LIMIT 5', [], (dbErr, users) => {
                if (dbErr) {
                    console.error('Error checking existing users:', dbErr);
                } else {
                    console.log('Available users in database:', users.length ? users.map(u => u.email) : 'No users found');
                }
            });
            
            return res.status(400).json({ error: 'User not found' });
        }

        try {
            console.log('Comparing passwords for user:', user.email);
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.error('Login failed: Invalid password for user:', email);
                return res.status(400).json({ error: 'Invalid password' });
            }

            const token = jwt.sign({ id: user.id }, JWT_SECRET);
            console.log('Login successful for user:', email);
            
            // Send back comprehensive user information
            res.json({ 
                token,
                user: {
                    id: user.id,
                    name: user.name || 'User',
                    email: user.email,
                    age: user.age || 25 // Default age if not set
                } 
            });
        } catch (error) {
            console.error('Error comparing passwords:', error);
            res.status(500).json({ error: 'Authentication error: ' + error.message });
        }
    });
});

// Profile endpoint
app.get('/profile', authenticateToken, (req, res) => {
    console.log('Profile request for user ID:', req.user.id);
    
    db.get('SELECT id, name, email, age FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Database error in profile:', err);
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        
        if (!user) {
            console.error('User not found for ID:', req.user.id);
            return res.status(404).json({ error: 'User not found' });
        }

        // For logging purposes only
        console.log('User profile found:', {
            id: user.id,
            name: user.name,
            email: user.email,
            age: user.age
        });
        
        // Default age value for backwards compatibility
        const defaultAge = 25;
        
        res.json({
            id: user.id,
            name: user.name || 'User',
            email: user.email || 'No email provided',
            age: user.age || defaultAge // Default age if not set
        });
    });
});

// Period tracking routes - simplified for reliability
app.post('/period', authenticateToken, (req, res) => {
    console.log('Received period data:', req.body);
    
    const { start_date, end_date, symptoms } = req.body;
    
    if (!start_date) {
        console.log('Missing start date');
        return res.status(400).json({ error: 'Start date is required' });
    }
    
    // Convert symptoms to string if necessary
    let symptomsStr = symptoms;
    if (typeof symptoms === 'object') {
        symptomsStr = JSON.stringify(symptoms);
    }
    
    console.log('User ID:', req.user.id);
    console.log('Start date:', start_date);
    console.log('End date:', end_date);
    console.log('Symptoms:', symptomsStr);
    
    // Insert the new period data
    db.run(
        'INSERT INTO period_data (user_id, start_date, end_date, symptoms) VALUES (?, ?, ?, ?)',
        [req.user.id, start_date, end_date, symptomsStr],
        function(err) {
            if (err) {
                console.error('Error saving period data:', err);
                return res.status(500).json({ error: 'Error saving period data' });
            }
            
            console.log('Period data saved, ID:', this.lastID);
            res.status(201).json({ id: this.lastID });
        }
    );
});

app.get('/period', authenticateToken, (req, res) => {
    db.all(
        `SELECT 
            id,
            start_date,
            end_date,
            symptoms,
            (julianday(COALESCE(end_date, date('now'))) - julianday(start_date)) as duration
        FROM period_data 
        WHERE user_id = ? 
        ORDER BY start_date DESC`,
        [req.user.id],
        (err, rows) => {
            if (err) {
                console.error('Error fetching period data:', err);
                return res.status(500).json({ error: 'Error fetching period data' });
            }
            res.json(rows);
        }
    );
});

app.post('/period/end', authenticateToken, (req, res) => {
    const { cycle_id, end_date } = req.body;
    
    if (!cycle_id || !end_date) {
        return res.status(400).json({ error: 'Cycle ID and end date are required' });
    }

    db.run(
        'UPDATE period_data SET end_date = ? WHERE id = ? AND user_id = ?',
        [end_date, cycle_id, req.user.id],
        function(err) {
            if (err) {
                console.error('Error updating period data:', err);
                return res.status(500).json({ error: 'Error updating period data' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Period record not found or not authorized' });
            }
            
            res.json({ success: true });
        }
    );
});

// Start period endpoint
app.post('/period/start', authenticateToken, (req, res) => {
    const { start_date, symptoms } = req.body;
    
    if (!start_date) {
        return res.status(400).json({ error: 'Start date is required' });
    }
    
    const symptomsJson = symptoms ? JSON.stringify(symptoms) : null;
    
    db.run(
        'INSERT INTO period_data (user_id, start_date, symptoms) VALUES (?, ?, ?)',
        [req.user.id, start_date, symptomsJson],
        function(err) {
            if (err) {
                console.error('Error starting period:', err);
                return res.status(500).json({ error: 'Error starting period' });
            }
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Update period endpoint
app.put('/period/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { start_date, end_date, symptoms } = req.body;
    
    if (!start_date) {
        return res.status(400).json({ error: 'Start date is required' });
    }
    
    const symptomsJson = symptoms ? JSON.stringify(symptoms) : null;
    
    // First check if the record exists and belongs to the user
    db.get(
        'SELECT * FROM period_data WHERE id = ? AND user_id = ?',
        [id, req.user.id],
        (err, row) => {
            if (err) {
                console.error('Error checking period data:', err);
                return res.status(500).json({ error: 'Error updating period data' });
            }
            
            if (!row) {
                return res.status(404).json({ error: 'Period record not found or not authorized' });
            }
            
            // Update the record
            db.run(
                'UPDATE period_data SET start_date = ?, end_date = ?, symptoms = ? WHERE id = ? AND user_id = ?',
                [start_date, end_date, symptomsJson, id, req.user.id],
                function(err) {
                    if (err) {
                        console.error('Error updating period data:', err);
                        return res.status(500).json({ error: 'Error updating period data' });
                    }
                    
                    res.json({ success: true, id: id });
                }
            );
        }
    );
});

// Add a reset-demo endpoint for troubleshooting
app.post('/admin/reset-demo', (req, res) => {
    console.log('Attempting to reset demo user');
    
    // First check if the demo user exists
    db.get('SELECT * FROM users WHERE email = ?', ['olivia@gmail.com'], async (err, existingUser) => {
        if (err) {
            console.error('Error checking for existing demo user:', err);
            return res.status(500).json({ error: 'Database error checking for demo user' });
        }
        
        // If user exists, delete it and its period data
        if (existingUser) {
            console.log('Found existing demo user, deleting associated data');
            
            // Delete period data first (foreign key constraint)
            db.run('DELETE FROM period_data WHERE user_id = ?', [existingUser.id], (err) => {
                if (err) {
                    console.error('Error deleting demo user period data:', err);
                    return res.status(500).json({ error: 'Error deleting demo user data' });
                }
                
                // Then delete the user
                db.run('DELETE FROM users WHERE id = ?', [existingUser.id], (err) => {
                    if (err) {
                        console.error('Error deleting demo user:', err);
                        return res.status(500).json({ error: 'Error deleting demo user' });
                    }
                    
                    createDemoUser(res);
                });
            });
        } else {
            console.log('Demo user not found, creating new one');
            createDemoUser(res);
        }
    });
});

// Helper function to create demo user
function createDemoUser(res) {
    bcrypt.hash('password123', 10)
        .then(hashedPassword => {
            db.run(
                'INSERT INTO users (name, email, password, age) VALUES (?, ?, ?, ?)',
                ['Olivia', 'olivia@gmail.com', hashedPassword, 28],
                function(err) {
                    if (err) {
                        console.error('Error creating demo user:', err);
                        return res.status(500).json({ error: 'Error creating demo user' });
                    }

                    const userId = this.lastID;
                    console.log('Created new demo user with ID:', userId);
                    
                    // Insert demo period data
                    const demoData = [
                        {
                            start_date: '2023-12-17',
                            end_date: '2023-12-22',
                            symptoms: '{"cramps":true,"headache":false,"bloating":true}'
                        },
                        {
                            start_date: '2024-01-15',
                            end_date: '2024-01-20',
                            symptoms: '{"cramps":true,"headache":true,"bloating":true}'
                        },
                        {
                            start_date: '2024-02-11',
                            end_date: '2024-02-16',
                            symptoms: '{"cramps":false,"headache":true,"bloating":true}'
                        },
                        {
                            start_date: '2024-03-13',
                            end_date: '2024-03-18',
                            symptoms: '{"cramps":true,"headache":false,"bloating":false}'
                        }
                    ];
                    
                    const stmt = db.prepare('INSERT INTO period_data (user_id, start_date, end_date, symptoms) VALUES (?, ?, ?, ?)');
                    demoData.forEach(period => {
                        stmt.run(userId, period.start_date, period.end_date, period.symptoms);
                    });
                    stmt.finalize();
                    
                    res.json({ success: true, message: 'Demo user created successfully' });
                }
            );
        })
        .catch(error => {
            console.error('Error hashing password for demo user:', error);
            res.status(500).json({ error: 'Error creating demo user' });
        });
}

// Routes
// Root route - redirect to landing page
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// Serve static files
app.use(express.static(__dirname));

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 