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
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (sound === 'correct') {
                // Create a pleasant success sound
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                // Pleasant ascending notes
                oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
                oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
                oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
                
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
                
            } else if (sound === 'incorrect') {
                // Create a gentle incorrect sound
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                oscillator.type = 'sawtooth';
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                
            } else if (sound === 'tada') {
                // Create celebration sound
                for (let i = 0; i < 3; i++) {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    const frequencies = [523.25, 659.25, 783.99]; // C, E, G
                    oscillator.frequency.setValueAtTime(frequencies[i], audioContext.currentTime + i * 0.1);
                    oscillator.type = 'sine';
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.1);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.3);
                    
                    oscillator.start(audioContext.currentTime + i * 0.1);
                    oscillator.stop(audioContext.currentTime + i * 0.1 + 0.3);
                }
            } else if (sound.startsWith('note')) {
                // Create musical notes
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                const noteFreqs = [261.63, 293.66, 329.63, 349.23, 392.00]; // C, D, E, F, G
                const noteIndex = parseInt(sound.replace('note', '')) - 1;
                oscillator.frequency.setValueAtTime(noteFreqs[noteIndex] || 261.63, audioContext.currentTime);
                
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            }
        } catch (e) {
            console.log('Audio playback failed', e);
        }
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
    
    // Add interactive functionality to coding icons
    const codingIcons = document.querySelectorAll('.coding-icons .icon');
    const codeSnippets = [
        'print("Hello World!")\n# This is Python code!',
        'function movePlayer() {\n  player.x += 5;\n  if(hitEnemy()) {\n    gameOver();\n  }\n}',
        'let sum = 0;\nfor (let i = 1; i <= 10; i++) {\n  sum += i;\n}\nprint("Sum is: " + sum);',
        'when green flag clicked\nmove 10 steps\nif touching edge then\n  bounce\nend',
        'robot.forward(100)\nrobot.turn(90)\nrobot.sense()\nif robot.obstacle() then\n  robot.stop()',
        'blocks.create("stone")\nblocks.move(3, 4, 5)\nblocks.build("house")'
    ];
    
    codingIcons.forEach((icon, index) => {
        // Add data attribute with code snippet
        icon.setAttribute('data-code', codeSnippets[index % codeSnippets.length]);
        
        icon.addEventListener('click', function() {
            // Create a code popup
            const codePopup = document.createElement('div');
            codePopup.className = 'code-popup';
            codePopup.textContent = '';
            
            // Position near the icon
            const rect = this.getBoundingClientRect();
            codePopup.style.left = rect.left + 'px';
            codePopup.style.top = (rect.bottom + 10) + 'px';
            
            document.body.appendChild(codePopup);
            
            // Simulate typing animation
            const codeText = this.getAttribute('data-code');
            let charIndex = 0;
            
            const typingInterval = setInterval(() => {
                if (charIndex < codeText.length) {
                    codePopup.textContent += codeText.charAt(charIndex);
                    charIndex++;
                    
                    // Create typing sound effect
                    const typingSound = new Audio();
                    typingSound.volume = 0.1;
                    typingSound.src = 'https://www.soundjay.com/button/sounds/button-tick.mp3';
                    typingSound.play().catch(e => {
                        // Silently fail - browsers may block autoplay
                        console.log('Audio playback failed', e);
                    });
                } else {
                    clearInterval(typingInterval);
                    
                    // Run effect
                    setTimeout(() => {
                        codePopup.classList.add('run');
                        
                        // Run sound
                        const runSound = new Audio();
                        runSound.volume = 0.2;
                        runSound.src = 'https://www.soundjay.com/button/sounds/button-14.mp3';
                        runSound.play().catch(e => console.log('Audio playback failed', e));
                        
                        setTimeout(() => {
                            codePopup.classList.add('fade-out');
                            setTimeout(() => {
                                document.body.removeChild(codePopup);
                            }, 1000);
                        }, 1500);
                    }, 500);
                }
            }, 100);
            
            // Visual feedback on the icon itself
            this.classList.add('typing');
            setTimeout(() => {
                this.classList.remove('typing');
            }, codeText.length * 100 + 2000);
        });
    });
    
    // Make profile picture draggable
    const profilePic = document.querySelector('.profile-image');
    makeElementDraggable(profilePic);
    
    function makeElementDraggable(element) {
        let isDragging = false;
        let offsetX, offsetY;
        let originalPosition = null;
        let hasBeenDragged = false;
        
        // Store original styles for reset
        const originalStyles = {
            position: element.style.position,
            left: element.style.left,
            top: element.style.top,
            zIndex: element.style.zIndex,
            transform: element.style.transform,
            transition: element.style.transition,
            cursor: element.style.cursor
        };
        
        element.style.cursor = 'grab';
        
        element.addEventListener('mousedown', startDrag);
        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        
        function startDrag(e) {
            isDragging = true;
            
            // Save original position if this is first drag
            if (!hasBeenDragged) {
                originalPosition = element.getBoundingClientRect();
                element.style.position = 'relative';
                hasBeenDragged = true;
            }
            
            const rect = element.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            element.style.zIndex = '1000';
            element.style.cursor = 'grabbing';
            
            document.addEventListener('mousemove', dragElement);
            document.addEventListener('mouseup', stopDrag);
            
            // Show fun message the first time
            if (!element.hasAttribute('data-dragged')) {
                showMessage("You can drag me around! 😄");
                element.setAttribute('data-dragged', 'true');
            }
        }
        
        function handleTouchStart(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            startDrag(mouseEvent);
            
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        }
        
        function handleTouchMove(e) {
            e.preventDefault();
            if (!isDragging) return;
            
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            dragElement(mouseEvent);
        }
        
        function handleTouchEnd() {
            const mouseEvent = new MouseEvent('mouseup');
            stopDrag(mouseEvent);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        }
        
        function dragElement(e) {
            if (!isDragging) return;
            
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            
            const parent = element.parentElement;
            const parentRect = parent.getBoundingClientRect();
            
            // Keep within parent bounds
            const maxX = parentRect.width - element.offsetWidth;
            const maxY = parentRect.height - element.offsetHeight;
            
            const newX = Math.min(Math.max(0, x - parentRect.left), maxX);
            const newY = Math.min(Math.max(0, y - parentRect.top), maxY);
            
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
            element.style.transform = 'none'; // Remove any transforms
        }
        
        function stopDrag() {
            isDragging = false;
            element.style.cursor = 'grab';
            document.removeEventListener('mousemove', dragElement);
            document.removeEventListener('mouseup', stopDrag);
            
            // Add double-click reset
            element.addEventListener('dblclick', resetPosition);
        }
        
        function resetPosition() {
            // Animate back to original position
            element.style.transition = 'all 0.5s ease';
            element.style.left = '0';
            element.style.top = '0';
            element.style.transform = originalStyles.transform;
            
            // Play fun animation
            element.style.animation = 'spin 0.5s ease-in-out';
            setTimeout(() => {
                element.style.animation = '';
            }, 500);
            
            showMessage("Back to my spot! 🏠");
        }
    }
    
    // Add interactive water ripple effect on click anywhere
    document.addEventListener('click', createRipple);
    
    function createRipple(e) {
        // Skip if clicked on an interactive element
        if (e.target.closest('.quiz-option, button, .icon, .note')) return;
        
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        document.body.appendChild(ripple);
        
        const size = Math.max(100, Math.random() * 150);
        
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (e.pageX - size/2) + 'px';
        ripple.style.top = (e.pageY - size/2) + 'px';
        
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.pointerEvents = 'none';
        ripple.style.background = 'radial-gradient(circle, rgba(74, 190, 217, 0.4) 0%, rgba(255, 255, 255, 0) 70%)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple-effect 1s ease-out forwards';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ripple-effect {
                0% { transform: scale(0); opacity: 1; }
                100% { transform: scale(1); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            document.body.removeChild(ripple);
        }, 1000);
    }
    
    // Add interactive parallax backgrounds
    const skillsSections = document.querySelectorAll('.flute-section, .coding-section');
    
    window.addEventListener('mousemove', function(e) {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        skillsSections.forEach(section => {
            if (isElementInViewport(section)) {
                // Create parallax effect
                section.style.backgroundPositionX = `${x * 20}px`;
                section.style.backgroundPositionY = `${y * 20}px`;
            }
        });
    });
    
    // Floating bubbles in the background
    createFloatingBubbles();
    
    function createFloatingBubbles() {
        const bubbleContainer = document.createElement('div');
        bubbleContainer.className = 'bubble-container';
        bubbleContainer.style.position = 'fixed';
        bubbleContainer.style.width = '100%';
        bubbleContainer.style.height = '100%';
        bubbleContainer.style.top = '0';
        bubbleContainer.style.left = '0';
        bubbleContainer.style.pointerEvents = 'none';
        bubbleContainer.style.zIndex = '-1';
        bubbleContainer.style.overflow = 'hidden';
        document.body.prepend(bubbleContainer);
        
        // Create bubbles periodically
        setInterval(() => {
            if (document.visibilityState === 'visible' && Math.random() > 0.7) {
                createBubble(bubbleContainer);
            }
        }, 3000);
        
        // Create initial bubbles
        for (let i = 0; i < 5; i++) {
            createBubble(bubbleContainer);
        }
    }
    
    function createBubble(container) {
        const bubble = document.createElement('div');
        
        // Random properties
        const size = Math.random() * 60 + 20;
        const left = Math.random() * 100;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        
        // Style the bubble
        bubble.style.position = 'absolute';
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = left + '%';
        bubble.style.bottom = '-100px';
        bubble.style.borderRadius = '50%';
        bubble.style.animation = `float-up ${duration}s linear ${delay}s forwards`;
        bubble.style.opacity = '0';
        
        // Randomize bubble appearance
        const bubbleType = Math.floor(Math.random() * 3);
        switch (bubbleType) {
            case 0:
                // Transparent blue bubble
                bubble.style.border = '2px solid rgba(74, 190, 217, 0.3)';
                bubble.style.boxShadow = 'inset 0 0 10px rgba(74, 190, 217, 0.1)';
                break;
            case 1:
                // Emoji bubble - Anna's interests
                const emojis = ['🎮', '🏌️‍♀️', '🎵', '💻', '🎺', '🎹', '✨', '📚'];
                bubble.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                bubble.style.display = 'flex';
                bubble.style.justifyContent = 'center';
                bubble.style.alignItems = 'center';
                bubble.style.fontSize = (size/2) + 'px';
                break;
            case 2:
                // Gradient bubble
                const colors = ['#4abed9', '#20b2aa', '#48d1cc', '#a0e1e0'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                bubble.style.background = `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.5), ${color}33)`;
                bubble.style.border = `1px solid ${color}55`;
                break;
        }
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes float-up {
                0% { transform: translateY(0) rotate(0deg); opacity: 0; }
                10% { opacity: 0.7; }
                90% { opacity: 0.7; }
                100% { transform: translateY(-${window.innerHeight + size}px) rotate(360deg); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // Add bubble to container and remove after animation
        container.appendChild(bubble);
        setTimeout(() => {
            container.removeChild(bubble);
        }, (duration + delay) * 1000);
    }
    
    // Interactive section transitions
    const sections = document.querySelectorAll('section');
    
    // Create observer for fancy section transitions
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.transform = 'translateY(0)';
                entry.target.style.opacity = '1';
            }
        });
    }, { threshold: 0.1 });
    
    // Set initial styles and observe sections
    sections.forEach(section => {
        section.style.transform = 'translateY(50px)';
        section.style.opacity = '0';
        section.style.transition = 'transform 0.8s ease-out, opacity 0.8s ease-out';
        observer.observe(section);
    });
    
    // Helper function to check if element is in viewport
    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.bottom >= 0 &&
            rect.left <= (window.innerWidth || document.documentElement.clientWidth) &&
            rect.right >= 0
        );
    }
    
    // Add a day/night mode toggle
    createDayNightToggle();
    
    function createDayNightToggle() {
        const toggle = document.createElement('div');
        toggle.className = 'day-night-toggle';
        toggle.innerHTML = '☀️';
        toggle.title = 'Toggle Day/Night Mode';
        
        // Style the toggle
        toggle.style.position = 'fixed';
        toggle.style.bottom = '20px';
        toggle.style.right = '20px';
        toggle.style.width = '50px';
        toggle.style.height = '50px';
        toggle.style.borderRadius = '50%';
        toggle.style.backgroundColor = 'white';
        toggle.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        toggle.style.display = 'flex';
        toggle.style.justifyContent = 'center';
        toggle.style.alignItems = 'center';
        toggle.style.fontSize = '24px';
        toggle.style.cursor = 'pointer';
        toggle.style.zIndex = '100';
        toggle.style.transition = 'all 0.3s ease';
        
        // Add hover effect
        toggle.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
        });
        
        toggle.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
        
        // Add click handler
        let isDayMode = true;
        toggle.addEventListener('click', function() {
            isDayMode = !isDayMode;
            
            if (isDayMode) {
                // Switch to day mode
                document.body.classList.remove('night-mode');
                this.innerHTML = '☀️';
                showMessage("Bright and sunny! ☀️");
            } else {
                // Switch to night mode
                document.body.classList.add('night-mode');
                this.innerHTML = '🌙';
                showMessage("Night mode activated! 🌙");
                
                // Add stars if first time switching to night
                if (!document.querySelector('.stars-container')) {
                    createStars();
                }
            }
            
            // Create CSS for night mode
            if (!document.getElementById('night-mode-css')) {
                const nightModeStyle = document.createElement('style');
                nightModeStyle.id = 'night-mode-css';
                nightModeStyle.textContent = `
                    .night-mode {
                        background-color: #1a2a3a !important;
                        color: #e0e0e0 !important;
                    }
                    
                    .night-mode .container {
                        background-color: rgba(12, 24, 36, 0.8);
                        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                        border-radius: 15px;
                    }
                    
                    .night-mode .intro-section {
                        background-color: #2c3e50 !important;
                    }
                    
                    .night-mode p, .night-mode h2, .night-mode h3 {
                        color: #e0e0e0 !important;
                    }
                    
                    .night-mode .fact-box {
                        background-color: #2c3e50 !important;
                        color: #e0e0e0 !important;
                    }
                    
                    .night-mode .profile-image {
                        border-color: #4abed9 !important;
                        box-shadow: 0 0 20px rgba(74, 190, 217, 0.5) !important;
                    }
                `;
                document.head.appendChild(nightModeStyle);
            }
        });
        
        document.body.appendChild(toggle);
    }
    
    function createStars() {
        const starsContainer = document.createElement('div');
        starsContainer.className = 'stars-container';
        starsContainer.style.position = 'fixed';
        starsContainer.style.top = '0';
        starsContainer.style.left = '0';
        starsContainer.style.width = '100%';
        starsContainer.style.height = '100%';
        starsContainer.style.pointerEvents = 'none';
        starsContainer.style.zIndex = '-1';
        document.body.appendChild(starsContainer);
        
        // Create stars
        for (let i = 0; i < 100; i++) {
            const star = document.createElement('div');
            const size = Math.random() * 3 + 1;
            
            star.style.position = 'absolute';
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.background = 'white';
            star.style.borderRadius = '50%';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.opacity = Math.random() * 0.5 + 0.3;
            star.style.animation = `twinkle ${Math.random() * 4 + 2}s infinite alternate`;
            
            starsContainer.appendChild(star);
        }
        
        // Add twinkling animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes twinkle {
                0% { opacity: 0.3; transform: scale(1); }
                100% { opacity: 0.8; transform: scale(1.2); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Initialize animations
    handleTypingAnimations();
});