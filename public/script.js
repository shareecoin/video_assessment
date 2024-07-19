/*
 * Video Assessment Application - Client-Side Logic
 *
 * This script handles the client-side functionality for the video assessment.
 *
 * Key Features:
 * - Loads assessment parts dynamically.
 * - Collects candidate details (name, email, CV).
 * - Manages video recording for each question.
 * - Submits assessment data (answers, CV, videos) to the server.
 *
 * Structure:
 * - assessmentParts: Array defining the structure and content of the assessment.
 * - loadPart(): Function to load and display each part of the assessment.
 * - startRecording(), stopRecording(): Functions to control video recording.
 * - collectAnswers(): Gathers candidate responses and prepares data for submission.
 * - endAssessment(): Submits the assessment data to the server.
 *
 * Dependencies:
 * - This script relies on elements in the exam.ejs template and the server.js file.
 */



document.addEventListener('DOMContentLoaded', () => {
    const examLinkIdElement = document.getElementById('exam-link-id');
    const candidateEmailElement = document.getElementById('candidate-email');

    if (!examLinkIdElement || !candidateEmailElement) {
        console.error('Required elements are missing from the DOM.');
        return;
    }

    const examLinkId = examLinkIdElement.value;
    const userEmail = candidateEmailElement.value;
    //console.log(`userEmail: ${userEmail}`); // this print the email of the user used to get the exam link at web console
    const partContainer = document.getElementById("part-container");
    const nextButton = document.getElementById("next-button");
    const submitButton = document.getElementById('submit-button');
    const examStartTimeData = JSON.parse(document.getElementById('exam-start-time-json').textContent);
    const examStartTime = new Date(examStartTimeData.startTime).getTime();

    const assessmentParts = [
        {
            title: "Collect candidate details",
            fields: ["fullName", "email"],
            cvRequired: true
        },
        {
            title: "Business Development Executive Video Interview", // Update with actual title
            question: "Get 15% off your next order...", // Update with actual question
            videoRequired: true
        },
        {
            title: "Business Development Executive Video Interview", // Update with actual title
            question: "Get 15% off your next order...", // Update with actual question
            videoRequired: true
        }
    ];

    let currentPart = 0;
    let startTime = Date.now();
    let allAnswers = [];
    let allTimingData = [];
    let examSubmitted = false;
    let mediaRecorder; // For recording video
    let recordedBlobs = []; // Store video chunks
    

    function loadPart() {
            const part = assessmentParts[currentPart];
            startTime = Date.now();
        
            partContainer.innerHTML = ''; 
        
            if (currentPart === 0) {
                partContainer.innerHTML = `
                    <div class="background-image">
                        <img src="/imgs/LOGO-transparent.png" alt="Company Logo" id="company-logo">
                        <h2>${part.title}</h2>
                        <div class="form-field">
                            <label for="fullName">Enter your name:</label>
                            <input type="text" id="fullName" name="fullName" placeholder="Provide only your first and last name.">
                        </div>
                        <div class="form-field">
                            <label for="email">Enter your email:</label>
                            <input type="email" id="email" name="email" placeholder="Enter the email address you used for registration.">
                            <div id="email-error" style="color: red;"></div> 
                        </div>
                        <div class="form-field">
                            <label for="cv">Upload your CV:</label>
                            <input type="file" id="cv" name="cv" accept=".pdf">
                        </div>
                    </div>
                `;
            } else if (part.question) {
                partContainer.innerHTML = `
                    <div class="user-info">
                        <img src="/imgs/LOGO-transparent.png" alt="Company Logo" id="company-logo">
                        <div>
                            <div id="user-email">${userEmail}</div>
                        </div>
                    </div>
                    <h2>${part.title}</h2>
                    <div class="question-box">
                        <p>${part.question}</p>
                        <video id="video-preview" width="640" height="480" autoplay muted></video>
                        <div>
                            <button id="start-recording">Start Recording</button>
                            <button id="stop-recording" disabled>Stop Recording</button>
                            <span id="timer">00:30</span>
                        </div>
                    </div>
                `;
                // *** Define videoPreview and timerDisplay here, after partContainer.innerHTML is set ***
                const videoPreview = document.getElementById('video-preview');
        
                let timeRemaining = 30; 
                const timerDisplay = document.getElementById('timer');
                let countdownInterval; 

                const startRecordingButton = document.getElementById('start-recording');
                const stopRecordingButton = document.getElementById('stop-recording');

                function handleCountdownEnd() {
                    clearInterval(countdownInterval);
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        stopRecording(); 
                    }

                    setTimeout(() => { 
                        if (currentPart < assessmentParts.length - 1) {
                            nextButton.click(); 
                        } else {
                            endAssessment(); 
                        }
                    }, 100); 
                }

                countdownInterval = setInterval(() => {
                    timeRemaining--;
                    timerDisplay.textContent = `${pad(Math.floor(timeRemaining / 60))}:${pad(timeRemaining % 60)}`;

                    if (timeRemaining <= 0) {
                        handleCountdownEnd(); 
                    }
                }, 1000);

                startRecordingButton.addEventListener('click', () => {
                    startRecording(videoPreview, timerDisplay);
                });

                stopRecordingButton.addEventListener('click', () => {
                    stopRecording();
                });
            }
    
        if (currentPart === 0) {
            nextButton.textContent = "Start Interview";
        } else {
            nextButton.textContent = "Next";
        }
    
        if (currentPart > 0) {
            nextButton.style.display = "block";
        } else {
            nextButton.style.display = "none";
        }
    
        if (currentPart === assessmentParts.length - 1 && !examSubmitted) {
            submitButton.style.display = "block";
        } else {
            submitButton.style.display = "none";
        }
    
        if (currentPart < assessmentParts.length - 1 && !examSubmitted) {
            nextButton.style.display = "block";
        } else {
            nextButton.style.display = "none";
        }
    }
    
    function initializeRecording() {
        // Get references to the video and timer elements:
        const videoPreview = document.getElementById('video-preview');
        const timerDisplay = document.getElementById('timer');
        const startRecordingButton = document.getElementById('start-recording');
      
        startRecordingButton.addEventListener('click', () => {
          startRecording(videoPreview, timerDisplay);
        });
      }

    function startRecording(videoElement, timerDisplay) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('getUserMedia is not supported in this browser.');
            alert('Your browser does not support video recording.');
            return;
        }
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                videoElement.srcObject = stream;
                mediaRecorder = new MediaRecorder(stream);

                mediaRecorder.ondataavailable = event => {
                    if (event.data && event.data.size > 0) {
                        recordedBlobs.push(event.data);
                    }
                };

                mediaRecorder.start(1000); // Chunk recording every 1 second

                let secondsRecorded = 0;
                const timerInterval = setInterval(() => {
                    secondsRecorded++;
                    const minutes = Math.floor(secondsRecorded / 60);
                    const seconds = secondsRecorded % 60;
                    timerDisplay.textContent = `${pad(minutes)}:${pad(seconds)}`;
                }, 1000);

                // ... (Add logic to stop recording after 30 seconds) ...
            })
            .catch(err => {
                console.error(`Error accessing media devices: ${err}`);
            });
    }

    function stopRecording() {
        mediaRecorder.stop();
        // ... (Add logic to handle the recorded video blobs) ...
    }

    function pad(number) {
        return (number < 10 ? '0' : '') + number;
    }

    function recordTimeTaken() {
        const endTime = Date.now();
        const timeSpent = Math.round((endTime - startTime) / 1000);
        allTimingData.push({ part: currentPart + 1, timeTaken: timeSpent });
    }

    // Validate email format
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate PDF file format
    function isValidPDF(file) {
        return file && file.type === "application/pdf";
    }

    // Collect answers for each part of the assessment
    function collectAnswers() {
        const part = assessmentParts[currentPart];
        let partAnswers = {};
        
         // *** Email Validation (ONLY on the first part) ***
        if (currentPart === 0) { 

            const fullName = document.getElementById('fullName').value.trim();
            // Full Name Validation
            if (!fullName || fullName.split(' ').length < 2) { 
                alert('Please enter your full name (first and last name).');
                return false; // Prevent moving to the next part
            }

            const enteredEmail = document.getElementById('email').value.trim().toLowerCase();
            const registeredEmail = window.registeredEmail.trim().toLowerCase();

            if (enteredEmail !== registeredEmail) {
                document.getElementById('email-error').textContent = "Please enter the same email used to get the assessment link.";
                return false; // Prevent moving to the next part
            } else {
                document.getElementById('email-error').textContent = ""; 
            }
        }
        // *** End of Email Validation ***

        if (part.fields) {
            for (const field of part.fields) {
                const fieldValue = document.getElementById(field).value;
                // Check if the field is 'email' and validate
                if (field === 'email' && !isValidEmail(fieldValue)) {
                    alert('Please enter a valid email address.');
                    return false; // Return false if email is invalid
                }
                partAnswers[field] = fieldValue;
            }

            // Handle CV upload
            if (part.cvRequired) {
                const cvFile = document.getElementById('cv').files[0];
                if (!isValidPDF(cvFile)) {
                    alert('Please upload a valid PDF file for your CV.');
                    return false; // Return false if CV is not a valid PDF
                }
                partAnswers.cv = cvFile;
            }
        } else if (part.question) {
            // For parts with questions, store the recorded video blobs
            partAnswers.video = recordedBlobs;
            recordedBlobs = []; // Reset for the next question
        }
        allAnswers.push(partAnswers);
        return true; // Return true if all answers are collected successfully
    }

    nextButton.addEventListener("click", () => {
        recordTimeTaken();
        const answersCollectedSuccessfully = collectAnswers();
        
        // Get entered email, trim whitespace, and convert to lowercase
        /* const enteredEmail = document.getElementById('email').value.trim().toLowerCase(); 
        const registeredEmail = window.registeredEmail.trim().toLowerCase(); // Access the global variable

        // Check if the entered email matches the registered email
        if (enteredEmail !== registeredEmail) { 
            document.getElementById('email-error').textContent = "Please enter the same email used to get the assessment link.";
            return; // Prevent moving to the next part
        } else {
            document.getElementById('email-error').textContent = ""; // Clear any previous error
        } */

        if (answersCollectedSuccessfully) {
            currentPart++;
            if (currentPart < assessmentParts.length) {
                loadPart();
            } else {
                endAssessment();
            }
        }
        // If answersCollectedSuccessfully is false, do nothing (stay on the current page)
    });

    async function endAssessment() {
        partContainer.innerHTML = "<h2>Assessment Complete! Thank you!</h2>";
        submitButton.style.display = "none";
        nextButton.style.display = "none";

        try {
            const formData = new FormData();
            formData.append('linkId', examLinkId);

             // Send candidate details separately
            formData.append('fullName', allAnswers[0].fullName);
            formData.append('email', allAnswers[0].email); 
            
            //formData.append('answers', JSON.stringify(allAnswers));
            // Append timing data to the form data
            formData.append('timingData', JSON.stringify(allTimingData));

            // Append CV file if it exists
            if (allAnswers[0].cv) {
                formData.append('cv', allAnswers[0].cv);
            }

            // Append video blobs to formData
            for (let i = 1; i <= allAnswers.length - 1; i++) {
                const videoBlobs = allAnswers[i].video; // Get the array of blobs for each question

                if (videoBlobs && videoBlobs.length > 0) {
                    for (let j = 0; j < videoBlobs.length; j++) {
                        formData.append(`video_question${i}_chunk${j}`, videoBlobs[j], `video_question${i}_chunk${j}.webm`);
                    }
                }
            }
            
            // Log the FormData entries
            console.log("FormData before sending:");
            for (var pair of formData.entries()) {
                console.log(pair[0]+ ', ' + pair[1]); 
            }
            const response = await fetch('/submit-exam', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                console.log('Exam data submitted successfully!');
            } else {
                console.error('Error submitting exam data:', response.status);
            }
        } catch (error) {
            console.error('Error submitting exam data:', error);
        }
        examSubmitted = true;
    }

    submitButton.addEventListener('click', endAssessment);
    loadPart();
});

