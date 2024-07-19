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
    const examLinkId = document.getElementById('exam-link-id').value;
    const userEmail = document.getElementById('candidate-email').value;
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
            question: "Get 15% off you next order...", // Update with actual question
            videoRequired: true
        },
        {
            title: "Business Development Executive Video Interview", // Update with actual title
            question: "Get 15% off you next order...", // Update with actual question
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

        partContainer.innerHTML = ''; // Clear previous content

        if (currentPart === 0) {
            // Home Screen
            partContainer.innerHTML = `
            <div class="background-image">
                <h2>${part.title}</h2>
                <div class="form-field">
                    <label for="fullName">Enter your full name:</label>
                    <input type="text" id="fullName" name="fullName" placeholder="Full Name">
                </div>
                <div class="form-field">
                    <label for="email">Enter your email:</label>
                    <input type="email" id="email" name="email" placeholder="Email">
                </div>
                <div class="form-field">
                    <label for="cv">Upload your CV:</label>
                    <input type="file" id="cv" name="cv">
                </div>
            </div>
        `;
        } else if (part.question) {
            // Video Interview Pages
            partContainer.innerHTML = `
                <div class="user-info">
                    <img src="profile-placeholder.jpg" alt="Profile Picture" id="profile-picture">
                    <div>
                        <div id="user-name">John Doe</div>
                        <div id="user-email">j.doe@videoassess.com</div>
                    </div>
                </div>
                <h2>${part.title}</h2>
                <div class="question-box">
                    <p>${part.question}</p>
                    <video id="video-preview" width="640" height="480" autoplay muted></video>
                    <div>
                        <button id="start-recording">Start Recording</button>
                        <button id="stop-recording" disabled>Stop Recording</button>
                        <span id="timer">00:00</span>
                    </div>
                </div>
            `;

            const videoPreview = document.getElementById('video-preview');
            const startRecordingButton = document.getElementById('start-recording');
            const stopRecordingButton = document.getElementById('stop-recording');
            const timerDisplay = document.getElementById('timer');

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

    function startRecording(videoElement, timerDisplay) {
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

    function collectAnswers() {
        let partAnswers = {};

        if (assessmentParts[currentPart].fields) {
            assessmentParts[currentPart].fields.forEach(field => {
                partAnswers[field] = document.getElementById(field).value;
            });

            // Handle CV upload
            partAnswers.cv = document.getElementById('cv').files[0];
        } else if (assessmentParts[currentPart].question) {
            partAnswers.video = recordedBlobs; // Store recorded video blobs
            recordedBlobs = []; // Reset for the next question
        }
        allAnswers.push(partAnswers);
    }

    async function endAssessment() {
        partContainer.innerHTML = "<h2>Assessment Complete! Thank you!</h2>";
        submitButton.style.display = "none";
        nextButton.style.display = "none";

        try {
            const formData = new FormData();
            formData.append('linkId', examLinkId);
            formData.append('answers', JSON.stringify(allAnswers));
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

    nextButton.addEventListener("click", () => {
        recordTimeTaken();
        collectAnswers();
        currentPart++;
        if (currentPart < assessmentParts.length) {
            loadPart();
        } else {
            endAssessment();
        }
    });

    submitButton.addEventListener('click', endAssessment);
    loadPart();
});
