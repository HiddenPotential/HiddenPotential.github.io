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
    let clickCount = 0;
    
    header.addEventListener('click', function() {
        clickCount++;
        const colors = ['#4abed9', '#20b2aa', '#48d1cc', '#7dd8e8', '#a0e1e0'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        this.style.backgroundColor = randomColor;
        this.style.transition = 'background-color 0.5s ease';
        
        // Easter egg: After 5 clicks, trigger confetti
        if (clickCount === 5) {
            launchConfetti();
            playSound('tada');
            showMessage("You found a secret! 🎉");
        }
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
            
            // Play sound effect based on correct/incorrect
            if (isCorrect) {
                playSound('correct');
            } else {
                playSound('incorrect');
            }
            
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
                    setTimeout(launchConfetti, 500);
                } else if (score >= totalQuestions / 2) {
                    message = '<p>Good job! You know me pretty well!</p>';
                } else {
                    message = '<p>Thanks for trying! Come back again to learn more about me!</p>';
                }
                
                resultElement.innerHTML += message;
            }
        });
    });
    
    // Add interactive effects to music notes
    const notes = document.querySelectorAll('.note');
    const notesSounds = ['note1', 'note2', 'note3', 'note4', 'note5'];
    
    notes.forEach((note, index) => {
        // Give each note a slightly different position
        note.style.transform = `translateY(${index * 2}px)`;
        
        // Add click event for playing sound
        note.addEventListener('click', function() {
            playSound(notesSounds[index % notesSounds.length]);
            // Make the note 'jump'
            this.style.animation = 'bounce 1s';
            setTimeout(() => {
                this.style.animation = 'float 1.5s ease-in-out infinite';
                if (index > 0) {
                    this.style.animationDelay = `${index * 0.3}s`;
                }
            }, 1000);
        });
    });
    
    // Helper function to enable smooth scrolling while animations are happening
    function smoothScrollTo(target, duration) {
        const targetPosition = target.getBoundingClientRect().top;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        let startTime = null;
        
        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const run = ease(timeElapsed, startPosition, distance, duration);
            window.scrollTo(0, run);
            if (timeElapsed < duration) requestAnimationFrame(animation);
        }
        
        function ease(t, b, c, d) {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
        }
        
        requestAnimationFrame(animation);
    }
    
    // Activate typing animations only when they're in the viewport
    function handleTypingAnimations() {
        const typingElements = document.querySelectorAll('.typing-text');
        
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = 1;
                    observer.unobserve(entry.target);
                }
            });
        }, options);
        
        typingElements.forEach(el => {
            el.style.opacity = 0;  // Hide initially
            observer.observe(el);
        });
    }
    
    // Function to show temporary messages
    function showMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'popup-message';
        messageEl.textContent = message;
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(messageEl);
            }, 500);
        }, 3000);
    }
    
    // Function to launch confetti
    function launchConfetti() {
        const canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        document.body.appendChild(canvas);
        
        const confetti = {
            canvas: canvas,
            ctx: canvas.getContext('2d'),
            particles: [],
            colors: ['#4abed9', '#20b2aa', '#48d1cc', '#7dd8e8', '#a0e1e0', '#ffb6c1', '#ffd700'],
            running: true,
            
            init: function() {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
                this.canvas.style.position = 'fixed';
                this.canvas.style.top = '0';
                this.canvas.style.left = '0';
                this.canvas.style.pointerEvents = 'none';
                this.canvas.style.zIndex = '1000';
                
                window.addEventListener('resize', () => {
                    this.canvas.width = window.innerWidth;
                    this.canvas.height = window.innerHeight;
                });
                
                this.createParticles();
                this.loop();
            },
            
            createParticles: function() {
                for (let i = 0; i < 100; i++) {
                    this.particles.push({
                        x: Math.random() * this.canvas.width,
                        y: -Math.random() * this.canvas.height,
                        size: Math.random() * 10 + 5,
                        color: this.colors[Math.floor(Math.random() * this.colors.length)],
                        speed: Math.random() * 3 + 2,
                        rotation: Math.random() * 360,
                        rotationSpeed: (Math.random() - 0.5) * 2
                    });
                }
            },
            
            loop: function() {
                if (!this.running) return;
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                let stillActive = false;
                for (let i = 0; i < this.particles.length; i++) {
                    const p = this.particles[i];
                    this.ctx.save();
                    this.ctx.translate(p.x, p.y);
                    this.ctx.rotate(p.rotation * Math.PI / 180);
                    this.ctx.fillStyle = p.color;
                    this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    this.ctx.restore();
                    
                    p.y += p.speed;
                    p.rotation += p.rotationSpeed;
                    
                    if (p.y < this.canvas.height) {
                        stillActive = true;
                    }
                }
                
                if (stillActive) {
                    requestAnimationFrame(() => this.loop());
                } else {
                    this.running = false;
                    document.body.removeChild(this.canvas);
                }
            }
        };
        
        confetti.init();
    }
    
    // Function to play sound effects
    function playSound(sound) {
        const audio = new Audio();
        
        switch(sound) {
            case 'correct':
                audio.src = 'https://www.soundjay.com/buttons/sounds/button-10.mp3';
                break;
            case 'incorrect':
                audio.src = 'https://www.soundjay.com/buttons/sounds/button-24.mp3';
                break;
            case 'tada':
                audio.src = 'https://www.soundjay.com/human/sounds/applause-8.mp3';
                break;
            case 'note1':
                audio.src = 'https://www.soundjay.com/musical/sounds/musical-bell-01.mp3';
                break;
            case 'note2':
                audio.src = 'https://www.soundjay.com/musical/sounds/musical-bell-02.mp3';
                break;
            case 'note3':
                audio.src = 'https://www.soundjay.com/musical/sounds/musical-bell-03.mp3';
                break;
            case 'note4':
                audio.src = 'https://www.soundjay.com/musical/sounds/musical-bell-04.mp3';
                break;
            case 'note5':
                audio.src = 'https://www.soundjay.com/musical/sounds/musical-bell-05.mp3';
                break;
            default:
                return;
        }
        
        audio.volume = 0.5;
        audio.play().catch(e => {
            // Silently fail - browsers may block autoplay
            console.log('Audio playback failed', e);
        });
    }
    
    // Enable a secret Konami code Easter egg (up, up, down, down, left, right, left, right, b, a)
    let konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiPosition = 0;
    
    document.addEventListener('keydown', function(e) {
        // Check if the key matches the next key in the konami code
        if (e.key === konamiCode[konamiPosition] || 
            (e.key.toLowerCase() === konamiCode[konamiPosition].toLowerCase())) {
            konamiPosition++;
            
            // If the full code has been entered
            if (konamiPosition === konamiCode.length) {
                activateKonamiCode();
                konamiPosition = 0;
            }
        } else {
            konamiPosition = 0;
        }
    });
    
    function activateKonamiCode() {
        // Rainbow mode animation for the whole page
        document.body.classList.add('rainbow-mode');
        showMessage("🌈 Rainbow Mode Activated! 🌈");
        playSound('tada');
        launchConfetti();
        
        // Reset after 10 seconds
        setTimeout(() => {
            document.body.classList.remove('rainbow-mode');
        }, 10000);
    }
    
    // Initialize animations
    handleTypingAnimations();
}); 