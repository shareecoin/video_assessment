const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '/mnt/volume_fra1_01/assessment-app/config/.env' });
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const multer = require('multer');
const https = require('https');
const nodemailer = require('nodemailer'); // Add nodemailer 

const upload = multer();

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Sh@reeCoin_345a', 
  database: 'assessments',
};

// Create a MySQL connection pool
const pool = mysql.createPool(dbConfig);

async function retryFailedEmails() {
  try {
    const [failedAttempts] = await pool.query(
      'SELECT * FROM failed_email_attempts WHERE attempt_count < 3'
    );

    for (const attempt of failedAttempts) {
      try {
        // Reconstruct the assessment link
        const assessmentLink = `${req.protocol}://${req.get('host')}/start-assessment?linkId=${attempt.assessment_link_id}`;

        await sendAssessmentEmail(attempt.email, assessmentLink, attempt.candidate_id, attempt.job_id, attempt.assessment_link_id);
        // If successful, delete the failed attempt record
        await pool.query('DELETE FROM failed_email_attempts WHERE id = ?', [attempt.id]);
      } catch (error) {
        // Update the failed attempt record
        await pool.query(
          'UPDATE failed_email_attempts SET attempt_count = ?, last_attempt_time = NOW(), error_message = ? WHERE id = ?',
          [attempt.attempt_count + 1, error.message, attempt.id]
        );
      }
    }
  } catch (error) {
    console.error('Error retrying failed emails:', error);
  }
}

retryFailedEmails(); 