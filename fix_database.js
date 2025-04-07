const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

console.log('Starting database fix script...');
console.log('Database path:', config.DB_PATH);

// Open the database
const db = new sqlite3.Database(config.DB_PATH);

db.serialize(() => {
    // Check if the age column exists
    db.get("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
            console.error('Error checking table schema:', err);
            return;
        }

        console.log('Current schema:', rows);
        
        // Add age column if it doesn't exist
        db.run("ALTER TABLE users ADD COLUMN age INTEGER", (err) => {
            if (err) {
                // If error contains "duplicate column name", it means column already exists
                if (err.message.includes('duplicate column name')) {
                    console.log('Age column already exists');
                } else {
                    console.error('Error adding age column:', err);
                }
            } else {
                console.log('Age column added successfully');
            }
            
            // Check the users table
            db.all("SELECT * FROM users", (err, users) => {
                if (err) {
                    console.error('Error querying users:', err);
                } else {
                    console.log('Users in database:', users);
                    
                    // Update Olivia's age if it's not set
                    db.run("UPDATE users SET age = 28 WHERE email = 'olivia@gmail.com' AND (age IS NULL OR age = 0)", function(err) {
                        if (err) {
                            console.error('Error updating Olivia\'s age:', err);
                        } else {
                            console.log(`Updated ${this.changes} user(s) with age 28`);
                        }
                        
                        // Close the database
                        db.close();
                    });
                }
            });
        });
    });
});

console.log('Database fix script completed'); 