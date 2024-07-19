/* 
1. first call the URL : https://assessments.shareecoin.com/job-listing to list all available jobs
                https://assessments.shareecoin.com/generate-link?email=ahmed.abdulazzim@gmail.com

2. Responce is : {
    "link": "http://164.92.224.89:9876/exam?id=2"
}
3. when you press above link it will redirect to the exam page

* Video Assessment Application Server
 * 
 * This Node.js application serves as the backend for a video assessment tool.
 * 
 * Key Functionality:
 * - Generates unique exam links for candidates.
 * - Serves the assessment pages (HTML, CSS, JavaScript).
 * - Handles candidate submissions, including:
 *     - Storing candidate data in a MySQL database.
 *     - Saving uploaded CVs.
 *     - Saving recorded video responses.
 * 
 * Application Structure:
 * - server.js: Main server file (this file).
 * - views/exam.ejs: EJS template for the assessment pages.
 * - public/script.js: Client-side JavaScript for assessment logic.
 * - public/style.css: Styles for the assessment pages.
 * - .env: Environment variables (e.g., database credentials, storage paths).
 * 
 * Dependencies:
 * - express: Web framework for routing and serving content.
 * - mysql2/promise: MySQL database driver with Promise support.
 * - cors: Enables Cross-Origin Resource Sharing.
 * - express-fileupload: Handles file uploads.
 * - dotenv: Loads environment variables from .env file.
 * - fs: File system module for file operations.
 * - path: Provides utilities for working with file paths.
 * 
*/
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '/mnt/volume_fra1_01/assessment-app/config/.env' });
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const multer = require('multer');
const https = require('https');
const nodemailer = require('nodemailer'); // Add nodemailer 

const upload = multer();

const app = express();
const PORT = 9876;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

// Create a MySQL connection pool
const pool = mysql.createPool(dbConfig);

// email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
  }
});


app.use(cors({
  origin: 'https://assessments.shareecoin.com' 
}));
app.use(express.static('public'));
app.use(express.json());
app.use(fileUpload()); 

app.use(express.urlencoded({ extended: true })); // Add body-parser middleware

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database!');
    connection.release();
  } catch (error) {
    console.error('Error connecting to MySQL database:', error);
  }
})();

app.get('/', (req, res) => {
    res.send('Welcome to the assessment application!'); // Or serve an index.html
  });

// fetch job listings from the database
app.get('/job-listing', (req, res) => {
pool.query('SELECT * FROM job_postings')
    .then(([rows]) => {
    res.render('job-listings', { jobs: rows });
    })
    .catch(error => {
    console.error('Error fetching job postings:', error);
    res.status(500).send('An error occurred.');
    });
});

app.get('/apply', (req, res) => {
    const jobId = req.query.jobId;
  
    if (!jobId) {
      return res.status(400).send('Job ID is missing.'); 
    }
  
    pool.query('SELECT * FROM job_postings WHERE id = ?', [jobId])
      .then(([rows]) => {
        if (rows.length === 0) {
          return res.status(404).send('Job not found.'); 
        }
        res.render('apply', { job: rows[0] });
      })
      .catch(error => {
        console.error('Error fetching job details:', error);
        res.status(500).send('An error occurred.');
      });
  });

// when candidate applies for a job by submitting their email  
app.post('/submit-application', async (req, res) => {
    const { email, jobId } = req.body;

    try {
        // print to console both the email and jobId
        console.log(`Email: ${email}, Job ID: ${jobId}`);
        
        // 1. Check for existing application
        const [existingApplication] = await pool.query(
        'SELECT * FROM applications WHERE job_id = ? AND email = ?',
        [jobId, email]
        );

        if (existingApplication.length > 0) {
            //return res.status(400).json({ error: 'You have already applied for this job.' });
            // Render the "already-applied" page
            return res.render('already-applied');
        }

        // 2. Generate assessment link 
        const assessmentLink = await generateAssessmentLink(req, email, jobId); 
        const assessmentLinkId = new URL(assessmentLink).searchParams.get('linkId');

        // 3. Create new application entry 
        const [applicationResult] = await pool.query(
            'INSERT INTO applications (job_id, email, assessment_link_id) VALUES (?, ?, ?)',
            [jobId, email, assessmentLinkId] // Use the ID from generateAssessmentLink
        );
        const candidateId = applicationResult.insertId;

        // 4. Send email with the assessment link
        await sendAssessmentEmail(email, assessmentLink, candidateId, jobId, assessmentLinkId); // Pass the required data  

        //res.json({ message: 'Application received. Check your email for the assessment link.' }); 
        res.render('application-submitted');
    } catch (error) {
        console.log('Error processing application:', error);
        //res.status(500).json({ error: 'Failed to process application.' });
        res.status(500).render('error');
    }
});
  

// function to generate assessment link
async function generateAssessmentLink(req, email, jobId) { // Add req as a parameter
  try {
    // 1. Check if the candidate has already applied for this job 
    const [existingApplication] = await pool.query(
      'SELECT * FROM applications WHERE job_id = ? AND email = ?',
      [jobId, email]
    );

    if (existingApplication.length > 0) {
      // Render the "already-applied" page when the candidate has already attempted the assessment in the last 24 hours
      res.render('exam-expired');
    }

    // 2. If no existing application, check for recent attempts for ANY job
    const [recentAttempts] = await pool.query(
      'SELECT * FROM assessments.exam_attempts ea ' +
      'JOIN assessments.candidates c ON ea.candidate_id = c.id ' +
      'WHERE c.email = ? AND ea.start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
      [email]
    );

    if (recentAttempts.length > 0) {
      // when candidate has already attempted an exam in the last 24 hours
      return '/exam-expired'; 
    }

    // 3. If no recent attempts, proceed with creating the candidate and link
    let candidateId;
    const [candidateRows] = await pool.query('SELECT * FROM assessments.candidates WHERE email = ?', [email]);
    if (candidateRows.length === 0) {
      const [result] = await pool.query('INSERT INTO assessments.candidates (email) VALUES (?)', [email]);
      candidateId = result.insertId;
    } else {
      candidateId = candidateRows[0].id;
    }

    // 4. Generate uniqueId and examLink using req.protocol and req.get('host')
    const uniqueId = Date.now(); 
    const examLink = `${req.protocol}://${req.get('host')}/exam?id=${uniqueId}`;

    // 5. Insert the new assessment link
    const [attemptResult] = await pool.query(
      'INSERT INTO assessment_links (candidate_id, job_id, link, expiry_time) VALUES (?, ?, ?, NOW() + INTERVAL 1 DAY)',
      [candidateId, jobId, examLink]
    );

    const linkId = attemptResult.insertId;
    return `${req.protocol}://${req.get('host')}/start-assessment?linkId=${linkId}`;

  } catch (error) {
    console.error('Error generating assessment link:', error);
    throw error;
  }
}

// function to send assessment email
async function sendAssessmentEmail(email, assessmentLink) {
const mailOptions = {
    from: process.env.SMTP_USER, // 'jobs@monjeztech.com' 
    to: email,
    subject: 'Your Assessment Link',
    html: `
    <p>Thank you for your application!</p>
    <p>Please click the link below to start your assessment:</p>
    <a href="${assessmentLink}">${assessmentLink}</a>
    `
};

try {
    await transporter.sendMail(mailOptions); 
    console.log('Assessment email sent successfully to:', email);
} catch (error) {
    console.error('Error sending assessment email:', error);
    // Handle the error appropriately (log it, retry, etc.)
    //throw error; // Re-throw to be handled at the application level 

    // if email sending fails, store the failed attempt in the database
    await storeFailedEmailAttempt(candidateId, jobId, assessmentLinkId, email, error.message);
}
}

// function to store failed email attempt
async function storeFailedEmailAttempt(candidateId, jobId, assessmentLinkId, email, errorMessage) {
  try {
    const [existingAttempt] = await pool.query(
      'SELECT * FROM failed_email_attempts WHERE candidate_id = ? AND job_id = ? AND assessment_link_id = ?',
      [candidateId, jobId, assessmentLinkId]
    );

    if (existingAttempt.length > 0) {
      // Update existing attempt
      const attemptId = existingAttempt[0].id;
      const newAttemptCount = existingAttempt[0].attempt_count + 1;
      await pool.query(
        'UPDATE failed_email_attempts SET attempt_count = ?, last_attempt_time = NOW(), error_message = ? WHERE id = ?',
        [newAttemptCount, errorMessage, attemptId]
      );
    } else {
      // Create new attempt record
      await pool.query(
        'INSERT INTO failed_email_attempts (candidate_id, job_id, assessment_link_id, email, error_message) VALUES (?, ?, ?, ?, ?)',
        [candidateId, jobId, assessmentLinkId, email, errorMessage]
      );
    }
  } catch (error) {
    console.error('Error storing failed email attempt:', error);
    // Consider additional error handling (e.g., logging to a separate file)
  }
}


// start assessment
app.get('/start-assessment', async (req, res) => {
const linkId = req.query.linkId;

try {
    const [rows] = await pool.query(
    'SELECT al.*, c.email AS candidate_email ' +
    'FROM assessment_links al ' +
    'JOIN candidates c ON al.candidate_id = c.id ' +
    'WHERE al.id = ? AND al.expiry_time > NOW() AND al.used = 0',
    [linkId]
    );

    if (rows.length === 0) {
    return res.status(400).sendFile(__dirname + '/public/link-expired.html'); 
    }

    const assessmentLinkData = rows[0];

    await pool.query('UPDATE assessment_links SET used = 1 WHERE id = ?', [linkId]);

    // Redirect to the exam page with the original ID
    const examId = new URL(assessmentLinkData.link).searchParams.get('id'); 
    res.redirect(`/exam?id=${examId}`); 
} catch (error) {
    console.error('Error fetching/updating assessment link:', error);
    res.status(500).send('An error occurred.');
}
});

// generate exam link 
app.get('/generate-link', async (req, res) => {
  const candidateEmail = req.query.email;

  try {
    const [recentAttempts] = await pool.query(
      'SELECT * FROM assessments.exam_attempts ea ' +
      'JOIN assessments.candidates c ON ea.candidate_id = c.id ' +
      'WHERE c.email = ? AND ea.start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
      [candidateEmail]
    );

    if (recentAttempts.length > 0) {
      return res.status(400).sendFile(__dirname + '/public/exam-expired.html');
    }

    let candidateId;
    const [candidateRows] = await pool.query('SELECT * FROM assessments.candidates WHERE email = ?', [candidateEmail]);
    if (candidateRows.length === 0) {
      const [result] = await pool.query('INSERT INTO assessments.candidates (email) VALUES (?)', [candidateEmail]);
      candidateId = result.insertId;
    } else {
      candidateId = candidateRows[0].id;
    }

    const [attemptResult] = await pool.query('INSERT INTO assessments.exam_attempts (candidate_id, start_time) VALUES (?, NOW())', [candidateId]);
    const uniqueId = attemptResult.insertId;
    const examLink = `${req.protocol}://${req.get('host')}/exam?id=${uniqueId}`;

    res.json({ link: examLink });
  } catch (error) {
    console.error('Error generating exam link:', error);
    res.status(500).json({ error: 'Failed to generate exam link' });
  }
});

app.get('', async (req, res) => {
  const linkId = req.query.id;

  try {
    const [rows] = await pool.query(
      'SELECT ea.*, c.email AS candidate_email, ' +
      'TIMESTAMPDIFF(MINUTE, ea.start_time, NOW()) AS time_elapsed ' +
      'FROM assessments.exam_attempts ea ' +
      'JOIN assessments.candidates c ON ea.candidate_id = c.id ' +
      'WHERE ea.id = ?',
      [linkId]
    );

    if (rows.length === 0) {
      return res.status(400).sendFile(__dirname + '/public/exam-expired.html');
    }

    const examAttempt = rows[0];

    if (examAttempt.completed || examAttempt.time_elapsed >= 60) {
      return res.sendFile(__dirname + '/public/exam-expired.html');
    }

    res.render('exam', {
      userEmail: examAttempt.candidate_email,
      examLinkId: linkId,
      currentPart: examAttempt.current_part,
      examStartTime: examAttempt.start_time
    });
  } catch (error) {
    console.error('Error fetching exam data:', error);
    res.status(500).send('An error occurred.');
  }
});

app.post('/submit-exam', upload.any(), async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Request files:", req.files);

    const linkId = req.body.linkId;
    const fullName = req.body.fullName;
    const email = req.body.email;
    const timingData = JSON.stringify(req.body.timingData);

    // ... your database query to update exam_attempts...

    const formattedName = fullName.replace(/\s+/g, '_');
    const jobTitle = process.env.JOB_TITLE || 'businessDevelopmentExecutive';
    const directoryPath = path.join('/mnt/volume_fra1_01/assessment-app/jobs', jobTitle, formattedName);

    fs.mkdirSync(directoryPath, { recursive: true });

    if (req.files && req.files.cv) {
      const cv = req.files.cv;
      const cvPath = path.join(directoryPath, 'cv.pdf');
      cv.mv(cvPath, err => {
        if (err) {
          console.error('Error saving CV:', err);
        } else {
          console.log('CV saved successfully!');
        }
      });
    }

    for (let i = 1; i <= 2; i++) {
      const videoChunks = Object.keys(req.files).filter(key => key.startsWith(`video_question${i}_chunk`));

      if (videoChunks.length > 0) {
        try {
          const videoData = videoChunks.map(chunkKey => req.files[chunkKey].data);
          const videoBlob = new Blob(videoData, { type: 'video/webm' });
          const fileName = `recorded_video_question${i}.webm`;
          const videoPath = path.join(directoryPath, fileName);

          const reader = new FileReader();
          reader.readAsArrayBuffer(videoBlob);
          reader.onloadend = function() {
            const buffer = Buffer.from(reader.result);
            fs.writeFile(videoPath, buffer, err => {
              if (err) {
                console.error(`Error saving video for question ${i}:`, err);
              } else {
                console.log(`Video for question ${i} saved successfully!`);
              }
            });
          };
        } catch (videoError) {
          console.error(`Error processing video for question ${i}:`, videoError);
        }
      } else {
        console.log(`No video recorded for question ${i}. Skipping...`);
      }
    }

    res.send('Exam submitted successfully!');
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).send('An error occurred while submitting the exam.');
  }
});

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static('public'));
app.use(express.json());

const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/assessments.shareecoin.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/assessments.shareecoin.com/fullchain.pem')
};

const server = https.createServer(sslOptions, app); 
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

server.timeout = 120000;