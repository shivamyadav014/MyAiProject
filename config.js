// Configuration file for CycleTrack app
// IMPORTANT: In a production environment, these should be stored as environment variables

module.exports = {
    // Google Credentials
    GOOGLE_CLIENT_ID: '1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com',
    GOOGLE_API_KEY: 'YOUR_GOOGLE_API_KEY',
    
    // JWT Secret for token signing
    JWT_SECRET: 'your-super-secret-jwt-token-key', 
    
    // Database configuration
    DB_PATH: './period_tracker.db'
}; 