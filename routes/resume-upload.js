const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/resumes');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, 'resume-' + uniqueSuffix + extension);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'));
        }
    }
});

// Resume upload endpoint
router.post('/upload-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No resume file uploaded' });
        }

        const { fullName, email, phone, position, experience, notes } = req.body;

        // Validate required fields
        if (!fullName || !email) {
            return res.status(400).json({ error: 'Full name and email are required' });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Please provide a valid email address' });
        }

        // Create resume record
        const resumeData = {
            id: Date.now().toString(),
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone ? phone.trim() : '',
            position: position ? position.trim() : '',
            experience: experience || '',
            notes: notes ? notes.trim() : '',
            fileName: req.file.filename,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            uploadDate: new Date().toISOString(),
            status: 'pending_review',
            matchedJobs: []
        };

        // Load existing resumes
        const resumesPath = path.join(__dirname, '../data/resumes.json');
        let resumes = [];
        
        try {
            if (fs.existsSync(resumesPath)) {
                const resumesContent = fs.readFileSync(resumesPath, 'utf8');
                resumes = JSON.parse(resumesContent);
            }
        } catch (error) {
            console.log('Creating new resumes file...');
            resumes = [];
        }

        // Check for duplicate email
        const existingResume = resumes.find(r => r.email === resumeData.email);
        if (existingResume) {
            // Update existing resume instead of creating duplicate
            const index = resumes.findIndex(r => r.email === resumeData.email);
            
            // Delete old file if it exists
            try {
                const oldFilePath = path.join(__dirname, '../uploads/resumes', existingResume.fileName);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            } catch (error) {
                console.log('Could not delete old resume file:', error.message);
            }
            
            // Update with new data
            resumes[index] = { ...resumeData, id: existingResume.id };
        } else {
            // Add new resume
            resumes.push(resumeData);
        }

        // Save resumes data
        fs.writeFileSync(resumesPath, JSON.stringify(resumes, null, 2));

        // Log the upload for admin tracking
        console.log(`📄 New resume uploaded: ${fullName} (${email}) - ${req.file.originalname}`);

        // Send confirmation email (if email system is available)
        try {
            await sendResumeConfirmationEmail(resumeData);
        } catch (emailError) {
            console.log('Could not send confirmation email:', emailError.message);
            // Don't fail the upload if email fails
        }

        res.json({
            success: true,
            message: 'Resume uploaded successfully! We\'ll review your profile and match you with relevant opportunities.',
            resumeId: resumeData.id
        });

    } catch (error) {
        console.error('Resume upload error:', error);
        
        // Clean up uploaded file if there was an error
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.log('Could not cleanup uploaded file:', cleanupError.message);
            }
        }

        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ error: 'File upload error: ' + error.message });
        }

        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get all resumes (admin only)
router.get('/admin/resumes', (req, res) => {
    try {
        const resumesPath = path.join(__dirname, '../data/resumes.json');
        
        if (!fs.existsSync(resumesPath)) {
            return res.json([]);
        }

        const resumesContent = fs.readFileSync(resumesPath, 'utf8');
        const resumes = JSON.parse(resumesContent);
        
        // Sort by upload date (newest first)
        resumes.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        
        res.json(resumes);
    } catch (error) {
        console.error('Error fetching resumes:', error);
        res.status(500).json({ error: 'Could not fetch resumes' });
    }
});

// Download resume file (admin only)
router.get('/admin/resume/:id/download', (req, res) => {
    try {
        const resumeId = req.params.id;
        const resumesPath = path.join(__dirname, '../data/resumes.json');
        
        if (!fs.existsSync(resumesPath)) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const resumesContent = fs.readFileSync(resumesPath, 'utf8');
        const resumes = JSON.parse(resumesContent);
        const resume = resumes.find(r => r.id === resumeId);
        
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const filePath = path.join(__dirname, '../uploads/resumes', resume.fileName);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Resume file not found' });
        }

        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${resume.originalName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Error downloading resume:', error);
        res.status(500).json({ error: 'Could not download resume' });
    }
});

// Update resume status (admin only)
router.put('/admin/resume/:id/status', (req, res) => {
    try {
        const resumeId = req.params.id;
        const { status } = req.body;
        
        const validStatuses = ['pending_review', 'approved', 'rejected', 'matched'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const resumesPath = path.join(__dirname, '../data/resumes.json');
        
        if (!fs.existsSync(resumesPath)) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const resumesContent = fs.readFileSync(resumesPath, 'utf8');
        const resumes = JSON.parse(resumesContent);
        const resumeIndex = resumes.findIndex(r => r.id === resumeId);
        
        if (resumeIndex === -1) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        resumes[resumeIndex].status = status;
        resumes[resumeIndex].lastUpdated = new Date().toISOString();
        
        fs.writeFileSync(resumesPath, JSON.stringify(resumes, null, 2));
        
        res.json({ success: true, message: 'Resume status updated' });
        
    } catch (error) {
        console.error('Error updating resume status:', error);
        res.status(500).json({ error: 'Could not update resume status' });
    }
});

// Resume confirmation email function
async function sendResumeConfirmationEmail(resumeData) {
    const nodemailer = require('nodemailer');
    
    // Gmail SMTP configuration
    const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: 'jamesen9@gmail.com',
            pass: 'ojcp qrvj kcgz hvzq' // App password
        }
    });

    const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Resume Received - TalentSync</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 20px 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">📄 Resume Received!</h1>
                <p style="color: #dbeafe; margin: 8px 0 0 0; font-size: 16px;">Thank you for uploading your resume</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
                <h2 style="color: #1e40af; margin: 0 0 20px 0; font-size: 20px;">Hi ${resumeData.fullName}!</h2>
                
                <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                    We've successfully received your resume and it's now in our system! Our team will review your profile and match you with relevant job opportunities.
                </p>
                
                <!-- Resume Details -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #2563eb;">
                    <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">📋 Your Submission Details</h3>
                    <div style="color: #374151; line-height: 1.6;">
                        <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${resumeData.fullName}</p>
                        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${resumeData.email}</p>
                        ${resumeData.position ? `<p style="margin: 0 0 8px 0;"><strong>Desired Position:</strong> ${resumeData.position}</p>` : ''}
                        ${resumeData.experience ? `<p style="margin: 0 0 8px 0;"><strong>Experience Level:</strong> ${resumeData.experience}</p>` : ''}
                        <p style="margin: 0 0 8px 0;"><strong>Resume File:</strong> ${resumeData.originalName}</p>
                        <p style="margin: 0;"><strong>Upload Date:</strong> ${new Date(resumeData.uploadDate).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <!-- What's Next -->
                <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">🎯 What Happens Next?</h3>
                    <ul style="color: #374151; line-height: 1.6; margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 8px;">Our team will review your resume within 24-48 hours</li>
                        <li style="margin-bottom: 8px;">We'll match your profile with relevant job opportunities</li>
                        <li style="margin-bottom: 8px;">You'll receive email notifications when we find suitable matches</li>
                        <li>Employers may contact you directly for interview opportunities</li>
                    </ul>
                </div>
                
                <!-- Call to Action -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://talentsync.shop" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                        🔍 Browse Current Job Openings
                    </a>
                </div>
                
                <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                    <strong>Questions?</strong> Reply to this email or contact our support team. We're here to help you find your next opportunity!
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f1f5f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; margin: 0; font-size: 14px;">
                    © 2024 TalentSync | Connecting Talent with Opportunities
                </p>
                <p style="color: #64748b; margin: 5px 0 0 0; font-size: 12px;">
                    🌐 <a href="https://talentsync.shop" style="color: #2563eb; text-decoration: none;">talentsync.shop</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    const mailOptions = {
        from: {
            name: 'TalentSync Jobs',
            address: 'jamesen9@gmail.com'
        },
        to: resumeData.email,
        subject: '📄 Resume Received - TalentSync',
        html: emailTemplate
    };

    await transporter.sendMail(mailOptions);
}

module.exports = router;
