const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

console.log('Starting database fix script...');

// Define both possible database paths
const dbPaths = ['./period_tracker.db', './cycletrack.db'];

// Delete existing database files if they exist
dbPaths.forEach(dbPath => {
    try {
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            console.log(`Deleted existing database: ${dbPath}`);
        }
    } catch (err) {
        console.error(`Error deleting database ${dbPath}:`, err);
    }
});

// Create a new database
const db = new sqlite3.Database('./period_tracker.db');

console.log('Created new database: period_tracker.db');

// Set up the database with correct schema
db.serialize(() => {
    // Create users table with proper schema
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        age INTEGER,
        google_id TEXT
    )`, err => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('Created users table with correct schema');
        }
    });

    // Create period_data table
    db.run(`CREATE TABLE IF NOT EXISTS period_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        start_date TEXT,
        end_date TEXT,
        symptoms TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`, err => {
        if (err) {
            console.error('Error creating period_data table:', err);
        } else {
            console.log('Created period_data table');
        }
    });

    // Create demo user
    bcrypt.hash('password123', 10)
        .then(hashedPassword => {
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
                    
                    console.log('Demo user and period data created successfully');
                    console.log('Database fix completed. Run "node server.js" to start the server.');
                    
                    // Close the database connection
                    db.close();
                }
            );
        })
        .catch(error => {
            console.error('Error hashing password:', error);
            db.close();
        });
}); 