const sqlite3 = require('sqlite3').verbose();
const config = require('./config');
const bcrypt = require('bcryptjs');

console.log('Starting user database repair script...');
console.log('Database path:', config.DB_PATH);

// Open the database
const db = new sqlite3.Database(config.DB_PATH);

// Get all table information
db.serialize(() => {
    // Get database schema info
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Error getting tables:', err);
            return;
        }
        
        console.log('Tables in database:', tables.map(t => t.name));
        
        // Check users table schema
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) {
                console.error('Error getting users table schema:', err);
                return;
            }
            
            console.log('Users table columns:', columns.map(c => `${c.name} (${c.type})`));
            
            // Check if age column exists
            const hasAgeColumn = columns.some(col => col.name === 'age');
            
            if (!hasAgeColumn) {
                console.log('Adding missing age column to users table...');
                db.run("ALTER TABLE users ADD COLUMN age INTEGER", (err) => {
                    if (err) {
                        console.error('Error adding age column:', err);
                    } else {
                        console.log('Age column added successfully');
                    }
                    checkUsers();
                });
            } else {
                console.log('Age column already exists, proceeding to check users');
                checkUsers();
            }
        });
    });
});

function checkUsers() {
    // Get all users
    db.all("SELECT * FROM users", (err, users) => {
        if (err) {
            console.error('Error querying users:', err);
            db.close();
            return;
        }
        
        console.log(`Found ${users.length} users in database`);
        
        // Check if any users need fixing
        const usersNeedingFix = users.filter(user => !user.age || user.age === 0);
        
        if (usersNeedingFix.length > 0) {
            console.log(`Found ${usersNeedingFix.length} users without an age`);
            
            // Fix users with missing ages
            let updated = 0;
            const defaultAge = 28;
            
            db.run("UPDATE users SET age = ? WHERE age IS NULL OR age = 0", [defaultAge], function(err) {
                if (err) {
                    console.error('Error updating users with default age:', err);
                } else {
                    console.log(`Updated ${this.changes} users with default age ${defaultAge}`);
                }
                
                // Check olivia user exists
                checkOliviaUser();
            });
        } else {
            console.log('All users have valid age values');
            checkOliviaUser();
        }
    });
}

function checkOliviaUser() {
    // Check if demo user exists
    db.get("SELECT * FROM users WHERE email = 'olivia@gmail.com'", (err, user) => {
        if (err) {
            console.error('Error checking for demo user:', err);
            db.close();
            return;
        }
        
        if (!user) {
            console.log('Demo user not found, creating...');
            createDemoUser();
        } else {
            console.log('Demo user exists with id:', user.id);
            console.log('User details:', user);
            
            // Check if the user has period data
            db.all("SELECT * FROM period_data WHERE user_id = ?", [user.id], (err, periods) => {
                if (err) {
                    console.error('Error checking period data:', err);
                    db.close();
                    return;
                }
                
                console.log(`Demo user has ${periods.length} period entries`);
                if (periods.length === 0) {
                    console.log('Adding sample period data for demo user');
                    addDemoData(user.id);
                } else {
                    console.log('Demo user has existing period data');
                    db.close();
                    console.log('Database repair completed successfully');
                }
            });
        }
    });
}

function createDemoUser() {
    bcrypt.hash('password123', 10)
        .then(hashedPassword => {
            db.run(
                'INSERT INTO users (name, email, password, age) VALUES (?, ?, ?, ?)',
                ['Olivia', 'olivia@gmail.com', hashedPassword, 28],
                function(err) {
                    if (err) {
                        console.error('Error creating demo user:', err);
                        db.close();
                        return;
                    }
                    
                    const userId = this.lastID;
                    console.log('Created demo user with ID:', userId);
                    addDemoData(userId);
                }
            );
        })
        .catch(error => {
            console.error('Error hashing password:', error);
            db.close();
        });
}

function addDemoData(userId) {
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
    stmt.finalize(() => {
        console.log('Added demo period data for user ID:', userId);
        db.close();
        console.log('Database repair completed successfully');
    });
} 