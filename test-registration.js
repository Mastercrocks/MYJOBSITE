// Test Registration with Duplicate Email Prevention
console.log('🧪 Testing Registration System...\n');

async function testRegistration() {
    const baseURL = 'http://localhost:3000/api/auth';
    
    // Test 1: Register first user
    console.log('1. Testing first user registration...');
    try {
        const response1 = await fetch(`${baseURL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'testuser1',
                email: 'test@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User'
            })
        });
        
        const result1 = await response1.json();
        
        if (response1.ok) {
            console.log('   ✅ First registration successful');
            console.log(`   📧 Email: test@example.com`);
            console.log(`   👤 Username: testuser1`);
        } else {
            console.log('   ❌ First registration failed:', result1.error);
        }
    } catch (error) {
        console.log('   ❌ Network error:', error.message);
    }
    
    // Test 2: Try to register with same email
    console.log('\n2. Testing duplicate email registration...');
    try {
        const response2 = await fetch(`${baseURL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'testuser2',
                email: 'test@example.com', // Same email
                password: 'password123',
                firstName: 'Test',
                lastName: 'User2'
            })
        });
        
        const result2 = await response2.json();
        
        if (!response2.ok && result2.error) {
            console.log('   ✅ Duplicate email correctly rejected');
            console.log(`   📝 Error message: ${result2.error}`);
        } else {
            console.log('   ❌ Duplicate email was allowed (BUG!)');
        }
    } catch (error) {
        console.log('   ❌ Network error:', error.message);
    }
    
    // Test 3: Try to register with same username
    console.log('\n3. Testing duplicate username registration...');
    try {
        const response3 = await fetch(`${baseURL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'testuser1', // Same username
                email: 'different@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User3'
            })
        });
        
        const result3 = await response3.json();
        
        if (!response3.ok && result3.error) {
            console.log('   ✅ Duplicate username correctly rejected');
            console.log(`   📝 Error message: ${result3.error}`);
        } else {
            console.log('   ❌ Duplicate username was allowed (BUG!)');
        }
    } catch (error) {
        console.log('   ❌ Network error:', error.message);
    }
    
    // Test 4: Test case insensitive email check
    console.log('\n4. Testing case insensitive email check...');
    try {
        const response4 = await fetch(`${baseURL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'testuser4',
                email: 'TEST@EXAMPLE.COM', // Same email in uppercase
                password: 'password123',
                firstName: 'Test',
                lastName: 'User4'
            })
        });
        
        const result4 = await response4.json();
        
        if (!response4.ok && result4.error) {
            console.log('   ✅ Case insensitive email check working');
            console.log(`   📝 Error message: ${result4.error}`);
        } else {
            console.log('   ❌ Case insensitive email check failed (BUG!)');
        }
    } catch (error) {
        console.log('   ❌ Network error:', error.message);
    }
    
    console.log('\n🏁 Registration test complete!');
}

// Test server connectivity first
fetch('http://localhost:3000')
    .then(response => {
        if (response.ok) {
            console.log('✅ Server is responding');
            return testRegistration();
        } else {
            console.log('❌ Server returned error:', response.status);
        }
    })
    .catch(error => {
        console.log('❌ Cannot connect to server:', error.message);
        console.log('💡 Make sure the server is running with: npm start');
    })
    .finally(() => {
        process.exit(0);
    });
