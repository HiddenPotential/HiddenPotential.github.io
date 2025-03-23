// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effects to the boxes
    const boxes = document.querySelectorAll('.box');
    
    boxes.forEach(box => {
        box.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.03)';
            this.style.transition = 'transform 0.3s ease';
        });
        
        box.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
    
    // Add a little surprise when clicking on the header
    const header = document.querySelector('header');
    
    header.addEventListener('click', function() {
        const colors = ['#4287f5', '#ff6b6b', '#4adede', '#ff9a3c', '#9b59b6'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        this.style.backgroundColor = randomColor;
        this.style.transition = 'background-color 0.5s ease';
    });
    
    // Fun Facts Box Hover Effect
    const factBoxes = document.querySelectorAll('.fact-box');
    
    factBoxes.forEach(box => {
        box.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 10px 15px rgba(0,0,0,0.1)';
            this.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        });
        
        box.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        });
    });
    
    // Handle Quiz Logic
    const quizOptions = document.querySelectorAll('.quiz-option');
    let score = 0;
    let questionsAnswered = 0;
    const totalQuestions = document.querySelectorAll('.quiz-question').length;
    
    quizOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Only allow answering once per question
            const parent = this.parentElement;
            if (parent.classList.contains('answered')) {
                return;
            }
            
            parent.classList.add('answered');
            
            // Check if correct
            const isCorrect = this.getAttribute('data-correct') === 'true';
            
            // Mark all options in this question
            const options = parent.querySelectorAll('.quiz-option');
            options.forEach(opt => {
                if (opt.getAttribute('data-correct') === 'true') {
                    opt.classList.add('correct');
                } else if (opt === this && !isCorrect) {
                    opt.classList.add('incorrect');
                }
                // Disable further clicks
                opt.disabled = true;
            });
            
            // Update score
            if (isCorrect) {
                score++;
            }
            
            questionsAnswered++;
            document.getElementById('quiz-score').textContent = score;
            
            // Show a message if all questions are answered
            if (questionsAnswered === totalQuestions) {
                const resultElement = document.querySelector('.quiz-result');
                let message = '';
                
                if (score === totalQuestions) {
                    message = '<p>Wow! Perfect score! You know me so well! 🎉</p>';
                } else if (score >= totalQuestions / 2) {
                    message = '<p>Good job! You know me pretty well!</p>';
                } else {
                    message = '<p>Thanks for trying! Come back again to learn more about me!</p>';
                }
                
                resultElement.innerHTML += message;
            }
        });
    });
    
    // Add typing effect to intro
    const introText = document.querySelector('.intro-text p');
    if (introText) {
        const originalText = introText.textContent;
        introText.textContent = '';
        
        let i = 0;
        const typingEffect = setInterval(() => {
            if (i < originalText.length) {
                introText.textContent += originalText.charAt(i);
                i++;
            } else {
                clearInterval(typingEffect);
            }
        }, 25);
    }
}); 