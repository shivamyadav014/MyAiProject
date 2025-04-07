// Add API base URL
const API_BASE_URL = 'http://localhost:8080';

// DOM Elements
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const calendarGrid = document.getElementById('calendarGrid');
const currentMonthElement = document.getElementById('currentMonth');
const cyclesList = document.getElementById('cyclesList');
const avgCycleSpan = document.getElementById('avgCycle');
const avgPeriodSpan = document.getElementById('avgPeriod');
const nextPredictedSpan = document.getElementById('nextPredicted');
const cycleStatus = document.getElementById('cycleStatus');

// Global Variables
let currentDate = new Date();
let userData = {
    name: 'Loading...',
    age: '--',
    email: 'Loading...',
    id: 'Loading...',
    currentCycle: null,
    cycles: []
};

// Set to false to use real backend
const TEST_MODE = false;

// Google API Configuration will be loaded from the server
let GOOGLE_CLIENT_ID;
let GOOGLE_API_KEY;

// Conditionally fetch configuration from server
if (!TEST_MODE) {
    fetch(`${API_BASE_URL}/config`)
        .then(response => response.json())
        .then(config => {
            GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
            GOOGLE_API_KEY = config.GOOGLE_API_KEY;
        })
        .catch(error => console.error('Error loading configuration:', error));
}

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar";

let googleUser = null;

// Authentication Functions
function showLoginForm() {
    loginModal.style.display = 'block';
}

function showSignupForm() {
    signupModal.style.display = 'block';
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target === loginModal || event.target === signupModal) {
        loginModal.style.display = 'none';
        signupModal.style.display = 'none';
    }
}

// Close buttons
document.querySelectorAll('.close').forEach(button => {
    button.onclick = function() {
        loginModal.style.display = 'none';
        signupModal.style.display = 'none';
    }
});

// Form submissions
document.getElementById('loginForm').onsubmit = function(e) {
    e.preventDefault();
    // Add login logic here
    loginModal.style.display = 'none';
};

document.getElementById('signupForm').onsubmit = function(e) {
    e.preventDefault();
    // Add signup logic here
    signupModal.style.display = 'none';
};

// Calendar Functions
function generateCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    currentMonthElement.textContent = `${firstDay.toLocaleString('default', { month: 'long' })} ${year}`;
    
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
    }
    
    // Add days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;
        
        // Add period prediction styling
        if (userData.lastPeriodStart) {
            const currentDay = new Date(year, month, day);
            const daysSinceLastPeriod = Math.floor((currentDay - userData.lastPeriodStart) / (1000 * 60 * 60 * 24));
            const cycleDay = daysSinceLastPeriod % userData.cycleLength;
            
            if (cycleDay < 5) {
                dayCell.classList.add('period-day');
            } else if (cycleDay >= 12 && cycleDay <= 16) {
                dayCell.classList.add('fertile-day');
            }
        }
        
        calendarGrid.appendChild(dayCell);
    }
}

// Navigation buttons
document.getElementById('prevMonth').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    generateCalendar(currentDate);
};

document.getElementById('nextMonth').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    generateCalendar(currentDate);
};

// Chatbot Functions
const chatbotResponses = {
    greetings: [
        "Hello! How can I help you today?",
        "Hi there! What would you like to know about your cycle?",
        "Welcome! I'm here to help you track and understand your menstrual health."
    ],
    period: [
        "Your next period is predicted to start on: ",
        "Based on your cycle length of 28 days, you might experience these symptoms: ",
        "Would you like to log your period start date?"
    ],
    recommendations: [
        "During your period, try to: \n- Stay hydrated\n- Exercise gently\n- Get enough rest",
        "Consider taking iron-rich foods during your period",
        "Track your symptoms daily for better predictions"
    ]
};

function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message
    addMessageToChat('user', message);
    userInput.value = '';

    // Process message and respond
    processMessage(message.toLowerCase());
}

function addMessageToChat(sender, message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function processMessage(message) {
    // Simple keyword-based responses
    if (message.includes('hello') || message.includes('hi')) {
        const response = chatbotResponses.greetings[Math.floor(Math.random() * chatbotResponses.greetings.length)];
        addMessageToChat('bot', response);
    } else if (message.includes('period') || message.includes('cycle')) {
        const response = chatbotResponses.period[Math.floor(Math.random() * chatbotResponses.period.length)];
        addMessageToChat('bot', response);
    } else if (message.includes('help') || message.includes('recommend')) {
        const response = chatbotResponses.recommendations[Math.floor(Math.random() * chatbotResponses.recommendations.length)];
        addMessageToChat('bot', response);
    } else {
        addMessageToChat('bot', "I'm not sure how to help with that. Try asking about your period, cycle, or recommendations!");
    }
}

// Enter key for chat
userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initialize Google API
function initializeGoogleAPI() {
    gapi.load('client:auth2', () => {
        gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            clientId: GOOGLE_CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
        }).then(() => {
            // Listen for sign-in state changes
            gapi.auth2.getAuthInstance().isSignedIn.listen(updateSignInStatus);
            // Handle initial sign-in state
            updateSignInStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        });
    });
}

// Update UI based on sign-in status
function updateSignInStatus(isSignedIn) {
    if (isSignedIn) {
        document.querySelectorAll('.g-signin2').forEach(btn => btn.style.display = 'none');
        document.getElementById('syncGoogleCalendar').style.display = 'flex';
    } else {
        document.querySelectorAll('.g-signin2').forEach(btn => btn.style.display = 'block');
        document.getElementById('syncGoogleCalendar').style.display = 'none';
    }
}

// Handle Google Sign-In
function onGoogleSignIn(googleUser) {
    const profile = googleUser.getBasicProfile();
    const id_token = googleUser.getAuthResponse().id_token;

    // Send token to backend for verification
    fetch('/auth/google', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: id_token })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            localStorage.setItem('token', data.token);
            updateUIAfterLogin(profile.getName());
        }
    })
    .catch(error => console.error('Error:', error));
}

// Sync with Google Calendar
async function syncWithGoogleCalendar() {
    if (!gapi.auth2.getAuthInstance().isSignedIn.get()) {
        alert('Please sign in with Google first');
        return;
    }

    try {
        // Get period data from our database
        const response = await fetch('/period', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const periodData = await response.json();

        // Create calendar events for each period
        for (const period of periodData) {
            const event = {
                summary: 'Menstrual Period',
                description: `Period cycle with symptoms: ${period.symptoms}`,
                start: {
                    date: period.start_date,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                end: {
                    date: period.end_date,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 24 * 60 } // 1 day before
                    ]
                }
            };

            await gapi.client.calendar.events.insert({
                calendarId: 'primary',
                resource: event
            });
        }

        alert('Successfully synced with Google Calendar!');
        markSyncedDays(periodData);
    } catch (error) {
        console.error('Error syncing with Google Calendar:', error);
        alert('Error syncing with Google Calendar. Please try again.');
    }
}

// Mark synced days in the calendar
function markSyncedDays(periodData) {
    const calendarDays = document.querySelectorAll('.calendar-day');
    periodData.forEach(period => {
        const startDate = new Date(period.start_date);
        const endDate = new Date(period.end_date);
        
        calendarDays.forEach(day => {
            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), parseInt(day.textContent));
            if (dayDate >= startDate && dayDate <= endDate) {
                day.classList.add('synced');
            }
        });
    });
}

// Update UI after login
function updateUIAfterLogin(userName) {
    document.querySelectorAll('.auth-buttons button').forEach(btn => btn.style.display = 'none');
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
        <span>Welcome, ${userName}</span>
        <button onclick="signOut()">Sign Out</button>
    `;
    document.querySelector('.auth-buttons').appendChild(userInfo);
}

// Sign out function
function signOut() {
    const auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(() => {
        localStorage.removeItem('token');
        location.reload();
    });
}

// Add event listener for Google Calendar sync button
document.getElementById('syncGoogleCalendar').addEventListener('click', syncWithGoogleCalendar);

// Initialize Google API when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    generateCalendar(currentDate);
    addMessageToChat('bot', chatbotResponses.greetings[0]);
    initializeGoogleAPI();
});

// Initialize the application
function initializeApp() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        showLoginModal();
        return;
    }

    loadUserData();
}

// Show login modal
function showLoginModal() {
    loginModal.style.display = 'flex';
}

// Show signup modal
function showSignupModal() {
    // Implementation for signup modal
    alert('Sign up functionality can be implemented here');
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.elements[0].value;
    const password = e.target.elements[1].value;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        if (data.token) {
            localStorage.setItem('token', data.token);
            loginModal.style.display = 'none';
            loadUserData();
        }
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Login failed. Please try again.');
    }
});

// Load user data with better error handling and promise chaining
async function loadUserData() {
    console.log('Loading user data...');
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, showing login modal');
        showLoginModal();
        return Promise.reject('No token found');
    }

    try {
        // Show loading indicators
        avgCycleSpan.textContent = '...';
        avgPeriodSpan.textContent = '...';
        nextPredictedSpan.textContent = '...';
        
        // Fetch user profile
        console.log('Fetching profile...');
        const profileResponse = await fetch(`${API_BASE_URL}/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!profileResponse.ok) {
            if (profileResponse.status === 401 || profileResponse.status === 403) {
                console.log('Authentication failed, showing login modal');
                localStorage.removeItem('token');
                showLoginModal();
                return Promise.reject('Authentication failed');
            }
            const error = await profileResponse.json();
            throw new Error(error.error || 'Failed to load profile');
        }

        const profile = await profileResponse.json();
        console.log('Profile loaded:', profile);
        updateUserProfile(profile);

        // Fetch cycle data
        console.log('Fetching cycle data...');
        const cyclesResponse = await fetch(`${API_BASE_URL}/period`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!cyclesResponse.ok) {
            const error = await cyclesResponse.json();
            throw new Error(error.error || 'Failed to load cycle data');
        }

        const cycles = await cyclesResponse.json();
        console.log('Cycle data loaded:', cycles);
        updateCycleData(cycles);
        console.log('Data refresh complete');
        
        // Return success for promise chaining
        return Promise.resolve();
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Error loading your data. Please try again: ' + error.message);
        return Promise.reject(error);
    }
}

// Update user profile in UI
function updateUserProfile(profile) {
    userData = { ...userData, ...profile };
    document.getElementById('userName').textContent = profile.name;
    document.getElementById('userAge').textContent = `${profile.age} years`;
    document.getElementById('userId').textContent = `User ID: ${profile.id}`;
}

// Update cycle data in UI with improved calculations
function updateCycleData(cycles) {
    console.log('Updating cycle data with:', cycles);
    userData.cycles = cycles;
    
    if (cycles.length === 0) {
        console.log('No cycles found');
        avgCycleSpan.textContent = '--';
        avgPeriodSpan.textContent = '--';
        nextPredictedSpan.textContent = 'Not enough data';
        cycleStatus.textContent = 'No data available';
        return;
    }

    // Sort cycles by start date (newest first)
    const sortedCycles = [...cycles].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    
    console.log('Sorted cycles:', sortedCycles);

    // Calculate average cycle length (time between period starts)
    let totalCycleLength = 0;
    let cycleCount = 0;
    
    for (let i = 0; i < sortedCycles.length - 1; i++) {
        const currentStart = new Date(sortedCycles[i].start_date);
        const nextStart = new Date(sortedCycles[i + 1].start_date);
        const daysBetween = Math.round((currentStart - nextStart) / (1000 * 60 * 60 * 24));
        
        if (daysBetween > 0 && daysBetween < 90) { // Ignore outliers
            totalCycleLength += daysBetween;
            cycleCount++;
            console.log(`Days between ${sortedCycles[i].start_date} and ${sortedCycles[i + 1].start_date}: ${daysBetween}`);
        }
    }
    
    const avgCycle = cycleCount > 0 ? Math.round(totalCycleLength / cycleCount) : 28; // Default to 28 if no data
    console.log(`Average cycle length: ${avgCycle} days (from ${cycleCount} cycles)`);

    // Calculate average period duration
    let totalPeriodDuration = 0;
    let periodCount = 0;
    
    for (const cycle of sortedCycles) {
        if (cycle.start_date && cycle.end_date) {
            const start = new Date(cycle.start_date);
            const end = new Date(cycle.end_date);
            const duration = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1; // Include start and end day
            
            if (duration > 0 && duration < 15) { // Ignore outliers
                totalPeriodDuration += duration;
                periodCount++;
                console.log(`Period duration for ${cycle.start_date}: ${duration} days`);
            }
        }
    }
    
    const avgPeriod = periodCount > 0 ? Math.round(totalPeriodDuration / periodCount) : 5; // Default to 5 if no data
    console.log(`Average period duration: ${avgPeriod} days (from ${periodCount} periods)`);

    // Calculate next period prediction based on the most recent period start date
    const lastPeriodStart = new Date(sortedCycles[0].start_date);
    const nextPeriodDate = new Date(lastPeriodStart);
    nextPeriodDate.setDate(nextPeriodDate.getDate() + avgCycle);
    
    console.log(`Last period started: ${lastPeriodStart.toDateString()}`);
    console.log(`Next period predicted: ${nextPeriodDate.toDateString()}`);

    // Update UI
    avgCycleSpan.textContent = avgCycle;
    avgPeriodSpan.textContent = avgPeriod;
    nextPredictedSpan.textContent = nextPeriodDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });

    // Update current cycle status
    const activePeriod = sortedCycles.find(c => !c.end_date);
    if (activePeriod) {
        console.log('Active period found:', activePeriod);
        
        const startDate = new Date(activePeriod.start_date);
        const today = new Date();
        const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        cycleStatus.textContent = `Day ${daysSinceStart} of current period`;
    } else {
        console.log('No active period found');
        cycleStatus.textContent = 'Not currently in period';
    }

    // Update recent cycles list
    updateRecentCyclesList(sortedCycles);
}

// Update recent cycles list
function updateRecentCyclesList(cycles) {
    if (!cyclesList) return;
    cyclesList.innerHTML = '';
    
    if (cycles.length === 0) {
        const noCyclesMsg = document.createElement('div');
        noCyclesMsg.className = 'no-data-message';
        noCyclesMsg.textContent = 'No cycle data available';
        cyclesList.appendChild(noCyclesMsg);
        return;
    }
    
    cycles.slice(0, 5).forEach(cycle => {
        const cycleItem = document.createElement('div');
        cycleItem.className = 'cycle-item';
        
        const startDate = new Date(cycle.start_date);
        const endDate = cycle.end_date ? new Date(cycle.end_date) : null;
        const duration = cycle.end_date ? calculatePeriodDuration(cycle) : 'Active';
        
        cycleItem.innerHTML = `
            <div class="cycle-info">
                <div class="cycle-date">${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div class="cycle-end-date">${endDate ? '→ ' + endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
            </div>
            <div class="cycle-duration">${typeof duration === 'number' ? duration + ' days' : duration}</div>
        `;
        
        cyclesList.appendChild(cycleItem);
    });
}

// Handle logout
const logoutBtn = document.querySelector('.logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        showLoginModal();
    });
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', initializeApp);

// Add a demo login function
function loginWithDemo() {
    const email = 'olivia@gmail.com';
    const password = 'password123';
    
    console.log('Attempting demo login...');
    
    fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Login failed');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.token) {
            console.log('Demo login successful');
            localStorage.setItem('token', data.token);
            loginModal.style.display = 'none';
            loadUserData();
        }
    })
    .catch(error => {
        console.error('Demo login error:', error);
        alert('Demo login failed: ' + error.message);
    });
}

// Add this after the document ready event listener
document.addEventListener('DOMContentLoaded', function() {
    // Add demo login button to the login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const demoButton = document.createElement('button');
        demoButton.type = 'button';
        demoButton.textContent = 'Use Demo Account';
        demoButton.className = 'demo-login-btn';
        demoButton.addEventListener('click', loginWithDemo);
        
        // Add to form
        const actionDiv = document.querySelector('.form-actions') || loginForm;
        actionDiv.appendChild(demoButton);
    }
    
    // Initialize app
    initializeApp();
});

// Period Input Modal handling - simplified for reliability
document.addEventListener('DOMContentLoaded', function() {
    // Add event listener for Period Date button (as a backup to the onclick)
    const addPeriodDateBtn = document.getElementById('addPeriodDateBtn');
    if (addPeriodDateBtn) {
        console.log('Found Period Date button');
        
        // Set default date when opening modal
        addPeriodDateBtn.addEventListener('click', function() {
            console.log('Period Date button clicked via listener');
            
            // Set today's date as default
            const today = new Date().toISOString().split('T')[0];
            const startDateInput = document.getElementById('periodStartDate');
            if (startDateInput) {
                startDateInput.value = today;
                console.log('Set start date to today:', today);
            }
            
            const endDateInput = document.getElementById('periodEndDate');
            if (endDateInput) {
                endDateInput.value = '';
                console.log('Cleared end date input');
            }
        });
    }
    
    // Don't handle form submission here - using inline script instead
}); 