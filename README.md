# CycleTrack - Period Tracking App

A modern web application for tracking menstrual cycles with customizable averages.

## Features

- Track period start and end dates
- Automatically calculate average cycle length and period duration
- Predict next period dates based on your history
- Set custom average values to match your personal cycle
- Beautiful dark theme UI
- Secure JWT authentication

## Custom Averages Feature

The app now supports manual input of custom average values:

1. When adding a new period, you can specify custom average cycle length (20-45 days)
2. You can also set custom average period duration (1-10 days)
3. These custom values will override automatic calculations
4. The next period prediction will be based on your custom averages

## Getting Started

1. Start the server: `node server.js`
2. Access the application: Open `new_index.html` in your browser
3. Log in with the demo account (email: olivia@gmail.com, password: password123)
4. Use the "Period Date" button to add new period data
5. Set custom averages if needed

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: SQLite
- Authentication: JWT

## Setup Instructions

1. Install Node.js and npm if you haven't already (https://nodejs.org/)

2. Clone the repository and install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Technology Stack

- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js, Express.js
- Database: SQLite3
- Authentication: JWT, bcrypt
- API: RESTful architecture

## API Endpoints

- POST `/signup` - Create a new user account
- POST `/login` - Authenticate user and get JWT token
- POST `/period` - Add new period data (requires authentication)
- GET `/period` - Get user's period history (requires authentication)

## Security Features

- Passwords are hashed using bcrypt
- JWT authentication for protected routes
- CORS enabled
- Input validation and sanitization

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License 