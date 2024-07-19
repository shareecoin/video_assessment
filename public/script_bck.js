document.addEventListener('DOMContentLoaded', () => {
    // Access the EJS variables passed into the HTML
    const examLinkId = document.getElementById('exam-link-id').value;
    const userEmail = document.getElementById('candidate-email').value;
    const partContainer = document.getElementById("part-container");
    const countdownDisplay = document.getElementById("countdown");
    const nextButton = document.getElementById("next-button");
    const submitButton = document.getElementById('submit-button');
    const backButton = document.getElementById('back-button');
    // Get examStartTime from the hidden script tag
    const examStartTimeData = JSON.parse(document.getElementById('exam-start-time-json').textContent);
    const examStartTime = new Date(examStartTimeData.startTime).getTime(); // Convert to milliseconds

    // Use these variables as needed in your script.js
    console.log(examLinkId, userEmail);

    // Use these variables as needed in your script.js
    console.log(examLinkId, userEmail);

    const assessmentParts = [
        {
            title: "Part 1: Basic React and JavaScript Knowledge",
            timeLimit: 15 * 60,
            questions: [
                "What is the virtual DOM, and how does it differ from the real DOM?",
                "Explain the difference between state and props in React.",
                "Describe the component lifecycle methods in React.",
                "Explain the concept of closures in JavaScript.",
                "What are promises, and how do they differ from callbacks?",
                "Describe the use of the this keyword in JavaScript."
            ]
        },
        {
            title: "Part 2: Practical Coding Task",
            timeLimit: 30 * 60,
            task: "Create a simple React application that fetches data from the provided JSON and displays it as a list. Include a button to mark items as 'completed.' Style completed items differently." 
        },
        {
            title: "Part 3: Problem-Solving and Optimization",
            timeLimit: 20 * 60,
            tasks: [
                {
                    description: "Implement a debouncing function in JavaScript.",
                    instructions: "Write a debounce function that takes a function and a delay as arguments. The debounced function should only be called after it has not been called for the specified delay."
                },
                {
                    description: "Array Flattening",
                    instructions: "Write a function that flattens a nested array of any depth into a single-level array."
                }
            ]
        }
    ];
    
    assessmentParts.totalExamTime = 60 * 60; // Example: 1 hour (60 minutes * 60 seconds)
    
    let currentPart = 0;

    
    //let timeRemaining = assessmentParts[currentPart].timeLimit;
    //let timeRemaining = assessmentParts.totalExamTime; // Use totalExamTime
    
    // Get timeRemaining from localStorage, if available
    let timeRemaining = localStorage.getItem('timeRemaining');
    if (timeRemaining) {
        timeRemaining = parseInt(timeRemaining, 10); // Convert to a number
        updateTimerDisplay(); // Update the timer display with the retrieved value
    } else {
        timeRemaining = assessmentParts.totalExamTime; // Use initial time if not in localStorage
    }

    let timerInterval;
    let startTime = Date.now();
    let allAnswers = []; 
    let allTimingData = [];

    
    

    //const examLinkId = document.getElementById('exam-link-id').value;
    const candidateEmailInput = document.getElementById('candidate-email');
    
   
    //const currentPartFromBackend = <%= currentPart %>; 
    const currentPartFromBackend = 0;
    //const timeRemainingFromBackend = <%= timeRemaining %>;
    const timeRemainingFromBackend = 1200;
    
    let examSubmitted = false; // Add a flag to track exam submission
    
    function loadPart() {
        console.log("loadPart() function called!");
        console.log("currentPart:", currentPart);
        console.log("timeRemaining:", timeRemaining);
        const part = assessmentParts[currentPart];
        startTime = Date.now(); 

        partContainer.innerHTML = ''; 

        const titleElement = document.createElement("h2");
        titleElement.textContent = part.title;
        partContainer.appendChild(titleElement);
        
        if (currentPart > 0) {
            backButton.style.display = "inline-block";
        } else {
            backButton.style.display = "none";
        }

        if (part.questions) { 
            part.questions.forEach((question, index) => {
                const questionContainer = document.createElement("div");
                questionContainer.classList.add("question-container");

                const labelElement = document.createElement("label");
                labelElement.textContent = question;
                labelElement.htmlFor = `question-${currentPart}-${index}`; 

                const textareaElement = document.createElement("textarea");
                textareaElement.id = `question-${currentPart}-${index}`;
                textareaElement.rows = 5; 

                questionContainer.appendChild(labelElement);
                questionContainer.appendChild(textareaElement);
                partContainer.appendChild(questionContainer);
            });
        } else if (part.task) { 
            const taskElement = document.createElement("p");
            taskElement.textContent = part.task;
            partContainer.appendChild(taskElement);

            const codeEditor = document.createElement("textarea");
            codeEditor.id = `code-editor-${currentPart}`;
            codeEditor.rows = 15;
            partContainer.appendChild(codeEditor);
        } else if (part.tasks) { 
            part.tasks.forEach((task, index) => {
                const taskContainer = document.createElement("div");
                taskContainer.classList.add("task-container");

                const taskDescription = document.createElement("p");
                taskDescription.textContent = task.description;
                taskContainer.appendChild(taskDescription);

                const taskInstructions = document.createElement("p");
                taskInstructions.textContent = task.instructions;
                taskContainer.appendChild(taskInstructions);

                const codeEditor = document.createElement("textarea");
                codeEditor.id = `code-editor-${currentPart}-${index}`;
                codeEditor.rows = 10;
                taskContainer.appendChild(codeEditor);

                partContainer.appendChild(taskContainer);
            });
        }

        //clearInterval(timerInterval);
        //timeRemaining = part.timeLimit;
        //updateTimerDisplay();
        startTimer();
        
        // Button Visibility Logic
        if (currentPart > 0) {
            backButton.style.display = "inline-block";
        } else {
            backButton.style.display = "none";
        }
        
        // Always show the Submit button, except when the exam has been submitted
        if (!examSubmitted) { 
            submitButton.style.display = "block"; 
        } else {
            submitButton.style.display = "none"; 
        }

            // Show Next button on all parts except the last one and if the exam has not been submitted
        if (currentPart < assessmentParts.length - 1 && !examSubmitted) {
            nextButton.style.display = "block";
        } else {
            nextButton.style.display = "none"; 
        }
    loadPartAnswers();
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - examStartTime) / 1000); // Calculate elapsed time
            timeRemaining = assessmentParts.totalExamTime - elapsedSeconds; // Update timeRemaining
            updateTimerDisplay();
            
            // Store timeRemaining in localStorage to persist in case of page refresh
            localStorage.setItem('timeRemaining', timeRemaining);

            if (timeRemaining <= 0) {
                //clearInterval(timerInterval);
                nextPart(); 
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        countdownDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    
    // store each part's answers in localStorage with the key part-{partNumber}-answers
    function storePartAnswers() {
        let partAnswers = {}; // Object to store answers with question index
      
        if (assessmentParts[currentPart].questions) {
          assessmentParts[currentPart].questions.forEach((_, index) => {
            const answer = document.getElementById(`question-${currentPart}-${index}`).value;
            partAnswers[index] = answer; // Store answer with question index
          });
        } else if (assessmentParts[currentPart].task || assessmentParts[currentPart].tasks) {
          const codeEditor = document.getElementById(`code-editor-${currentPart}`);
          partAnswers['code'] = codeEditor ? codeEditor.value : ''; 
        }
      
        localStorage.setItem(`part-${currentPart}-answers`, JSON.stringify(partAnswers));
      }
    
    // Load answers for the current part from localStorage
    function loadPartAnswers() {
    const savedAnswers = JSON.parse(localStorage.getItem(`part-${currentPart}-answers`));
    if (savedAnswers) {
        if (assessmentParts[currentPart].questions) {
        assessmentParts[currentPart].questions.forEach((_, index) => {
            const textarea = document.getElementById(`question-${currentPart}-${index}`);
            if (textarea) {
            textarea.value = savedAnswers[index] || ''; // Retrieve answer using index
            }
        });
        } else if (assessmentParts[currentPart].task || assessmentParts[currentPart].tasks) {
        const codeEditor = document.getElementById(`code-editor-${currentPart}`);
        if (codeEditor) {
            codeEditor.value = savedAnswers['code'] || '';
        }
        } 
    }
    }
    
    // Handle the "Back" button click event if the exam is not submitted yet and user hits the back button to go to the previous part and retrieve the answers when retrun last part again
    function handlePartChange() {
        storePartAnswers(); // Store answers for the current part
        loadPart();        // Load the new part
    }
    
    // Function to handle the "Next Part" button click event
    function nextPart() {
        recordTimeTaken(); // Record the time taken for the current part
        collectAnswers();  // Collect answers from the current part
        storePartAnswers(); // Store the collected answers

        currentPart++;
        
        // Check if there are more parts to load
        if (currentPart < assessmentParts.length) {
            loadPart(); // Load the next part 
        } else {
            endAssessment(); 
        }

        // Hide "Next Part" button if it's the last part
        if (currentPart >= assessmentParts.length - 1) {
            nextButton.style.display = "none"; 
        }

    }

    function recordTimeTaken() {
        const endTime = Date.now();
        const timeSpent = Math.round((endTime - startTime) / 1000);

        allTimingData.push({ part: currentPart + 1, timeTaken: timeSpent });
        console.log(`Time spent on Part ${currentPart + 1}: ${timeSpent} seconds`);
    }

    function collectAnswers() {
        let partAnswers = {}; 

        if (assessmentParts[currentPart].questions) {
            assessmentParts[currentPart].questions.forEach((_, index) => {
                const answer = document.getElementById(`question-${currentPart}-${index}`).value;
                partAnswers[`question-${index + 1}`] = answer; 
            });
        } else if (assessmentParts[currentPart].task || assessmentParts[currentPart].tasks) {
            const codeEditor = document.getElementById(`code-editor-${currentPart}`);
            partAnswers.code = codeEditor ? codeEditor.value : '';
        }

        allAnswers.push(partAnswers);
    }

    async function endAssessment() {
        clearInterval(timerInterval);
        // Hide the timer element AND the "Time Remaining" text
        const timerContainer = document.getElementById('timer'); // Get the container element
        timerContainer.style.display = "none";
        
        partContainer.innerHTML = "<h2>Assessment Complete! Thank you!</h2>";

        // Hide the "Back" button
        backButton.style.display = "none"; 
        
        // Hide the "Submit" button
        submitButton.style.display = "none"; 

        // Hide the "Next Part" button
        nextButton.style.display = "none";
        
        // Clear timeRemaining from localStorage
        localStorage.removeItem('timeRemaining'); 

        try {
            const response = await fetch('/submit-exam', { // Relative URL since frontend is on the same server
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    linkId: examLinkId,
                    answers: allAnswers,
                    timingData: allTimingData
                })
            });

            if (response.ok) {
                console.log('Exam data submitted successfully!');
            } else {
                console.error('Error submitting exam data:', response.status);
            }
        } catch (error) {
            console.error('Error submitting exam data:', error);
        }
        examSubmitted = true; // Set the flag to true when the exam is submitte
    }

    //nextButton.addEventListener("click", nextPart);
    nextButton.addEventListener("click", () => {
        recordTimeTaken();
        collectAnswers();
        currentPart++;
        handlePartChange(); // Use handlePartChange instead of directly calling loadPart
    });

    // Check if resume data is available and update variables
    if (currentPartFromBackend !== undefined && timeRemainingFromBackend !== undefined) {
        currentPart = currentPartFromBackend;
        timeRemaining = timeRemainingFromBackend;
    }
    
    //nextButton.addEventListener("click", nextPart);
    nextButton.addEventListener("click", () => {
        recordTimeTaken();
        collectAnswers();
        currentPart++;
        handlePartChange(); // Use handlePartChange instead of directly calling loadPart
    });

    submitButton.addEventListener('click', endAssessment);

    backButton.addEventListener('click', () => {
        storePartAnswers(); // Store answers before going bac
        currentPart--;
        handlePartChange(); // Use handlePartChange instead of directly calling loadPart
    });

    loadPart();
});