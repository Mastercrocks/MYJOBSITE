const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const mongoose = require('mongoose');
const Employer = require('../models/Employer');

// File-based storage for demo purposes
const EMPLOYERS_FILE = path.join(__dirname, '..', 'data', 'employers.json');

// Helper function to read employers
function readEmployers() {
    try {
        if (fs.existsSync(EMPLOYERS_FILE)) {
            const data = fs.readFileSync(EMPLOYERS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error reading employers file:', error);
        return [];
    }
}

// Helper function to write employers
function writeEmployers(employers) {
    try {
        fs.writeFileSync(EMPLOYERS_FILE, JSON.stringify(employers, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing employers file:', error);
        return false;
    }
}

// Mock login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const employers = readEmployers();
        const user = employers.find(emp => 
            emp.username === username || emp.email === username
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // For demo purposes, accept "demo123" as password for demo-employer
        // In a real app, you'd use bcrypt.compare(password, user.password)
        let passwordValid = false;
        if (username === 'demo-employer' && password === 'demo123') {
            passwordValid = true;
        } else {
            // Try bcrypt compare for other users
            try {
                passwordValid = await bcrypt.compare(password, user.password);
            } catch (e) {
                passwordValid = false;
            }
        }

        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                userType: user.userType 
            },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                userType: user.userType,
                companyName: user.companyName,
                jobTitle: user.jobTitle
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Mock register route
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, userType, companyName, jobTitle } = req.body;

        if (!username || !email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        // Check if employer already exists in MongoDB
        const existingUser = await Employer.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new employer in MongoDB
        const newEmployer = new Employer({
            name: firstName + ' ' + lastName,
            email,
            password: hashedPassword,
            company: companyName,
            created_at: new Date()
        });
        await newEmployer.save();

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newEmployer._id, 
                username: username,
                userType: userType || 'employer' 
            },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: newEmployer._id,
                username: username,
                email: newEmployer.email,
                firstName,
                lastName,
                userType: userType || 'employer',
                companyName,
                jobTitle
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

module.exports = router;
