// Import fetch dynamically since we're using ESM
import('node-fetch').then(({ default: fetch }) => {
    // Test user data
    const testUser = {
        name: "Test User",
        email: `test_${Date.now()}@example.com`, // Unique email to avoid conflicts
        password: "TestPassword123",
        age: 30
    };

    console.log('Testing signup with user:', testUser);

    // Make signup request
    fetch('http://localhost:8080/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(testUser)
    })
    .then(response => {
        console.log('Signup response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Signup response data:', data);
        
        if (data.token) {
            console.log('Signup successful, testing login...');
            
            // Now test login with the same credentials
            return fetch('http://localhost:8080/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: testUser.email,
                    password: testUser.password
                })
            });
        } else {
            throw new Error('Signup failed: ' + (data.error || 'Unknown error'));
        }
    })
    .then(response => {
        console.log('Login response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Login response data:', data);
        
        if (data.token) {
            console.log('Login successful, testing profile retrieval...');
            
            // Now test profile retrieval
            return fetch('http://localhost:8080/profile', {
                headers: {
                    'Authorization': `Bearer ${data.token}`
                }
            });
        } else {
            throw new Error('Login failed: ' + (data.error || 'Unknown error'));
        }
    })
    .then(response => {
        console.log('Profile response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Profile response data:', data);
        console.log('Test completed successfully!');
    })
    .catch(error => {
        console.error('Test error:', error);
    });
}); 