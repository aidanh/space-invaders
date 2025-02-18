class Game {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.soundsInitialized = false;
        this.setupSounds();
        // Add click handler to initialize sounds (browser requirement)
        document.addEventListener('click', () => {
            if (!this.soundsInitialized) {
                this.sounds.shoot.play().then(() => {
                    this.sounds.shoot.pause();
                    this.sounds.shoot.currentTime = 0;
                });
                this.sounds.explosion.play().then(() => {
                    this.sounds.explosion.pause();
                    this.sounds.explosion.currentTime = 0;
                });
                this.soundsInitialized = true;
            }
        }, { once: true });
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size based on device
        if (this.isMobile) {
            const aspectRatio = 4/3;
            this.canvas.width = Math.min(window.innerWidth, window.innerHeight * aspectRatio);
            this.canvas.height = this.canvas.width / aspectRatio;
        } else {
            this.canvas.width = 800;
            this.canvas.height = 600;
        }
        
        this.player = new Player(this.canvas.width / 2, this.canvas.height - 30);
        this.bullets = [];
        this.barriers = this.createBarriers();
        this.aliens = this.createAliens();
        this.alienDirection = 1;
        this.alienStepDown = false;
        this.score = 0;
        this.lives = 3;
        this.gameOver = false;
        this.lastTime = 0;
        this.alienMoveTimer = 0;
        this.alienMoveInterval = 1000; // Time between alien movements
        this.alienShootTimer = 0;
        this.alienShootInterval = 2500; // Time between alien shots
        this.alienBullets = [];
        this.ufo = null;
        this.ufoTimer = 0;
        this.ufoInterval = 20000; // UFO appears every 20 seconds
        this.ufoSound = null;
        
        this.keys = {
            left: false,
            right: false,
            space: false
        };
        
        this.setupInputs();
        this.updateScore();
        this.updateLives();
        this.gameLoop();
    }
    
    createBarriers() {
        const barriers = [];
        const barrierCount = 4;
        const spacing = this.canvas.width / (barrierCount + 1);
        
        for (let i = 0; i < barrierCount; i++) {
            barriers.push(new Barrier(spacing * (i + 1) - 40, this.canvas.height - 150));
        }
        return barriers;
    }

    createAliens() {
        const aliens = [];
        const rows = 5;
        const cols = 11;
        const spacing = 50;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                aliens.push(new Alien(
                    col * spacing + 100,
                    row * spacing + 50,
                    row
                ));
            }
        }
        return aliens;
    }
    
    setupSounds() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        this.sounds = {
            shoot: () => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
            },
            explosion: () => {
                const noise = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                const filter = audioContext.createBiquadFilter();
                
                noise.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                noise.type = 'sawtooth';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, audioContext.currentTime);
                filter.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                noise.start();
                noise.stop(audioContext.currentTime + 0.2);
            },
            ufo: () => {
                if (this.ufoSound) {
                    this.ufoSound.stop();
                }
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'square';
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                
                // UFO sound pattern
                const frequencies = [480, 640, 480, 320];
                let time = audioContext.currentTime;
                frequencies.forEach(freq => {
                    oscillator.frequency.setValueAtTime(freq, time);
                    time += 0.15;
                });
                
                oscillator.start();
                this.ufoSound = oscillator;
            },
            ufoExplosion: () => {
                if (this.ufoSound) {
                    try {
                        this.ufoSound.stop();
                    } catch (e) {
                        console.log('UFO sound already stopped');
                    }
                    this.ufoSound = null;
                }
                const noise = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                noise.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                noise.type = 'square';
                noise.frequency.setValueAtTime(880, audioContext.currentTime);
                noise.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.5);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                noise.start();
                noise.stop(audioContext.currentTime + 0.5);
            }
        };
    }

    setupInputs() {
        // Touch controls
        const leftButton = document.getElementById('leftButton');
        const rightButton = document.getElementById('rightButton');
        const shootButton = document.getElementById('shootButton');
        
        // Handle touch events
        if (this.isMobile) {
            const handleTouchStart = (e) => {
                e.preventDefault(); // Prevent scrolling
            };
            
            leftButton.addEventListener('touchstart', () => this.keys.left = true);
            leftButton.addEventListener('touchend', () => this.keys.left = false);
            rightButton.addEventListener('touchstart', () => this.keys.right = true);
            rightButton.addEventListener('touchend', () => this.keys.right = false);
            shootButton.addEventListener('touchstart', () => {
                if (!this.keys.space && !this.gameOver) {
                    this.bullets.push(new Bullet(
                        this.player.x + this.player.width / 2,
                        this.player.y,
                        -1
                    ));
                    this.sounds.shoot();
                }
                this.keys.space = true;
            });
            shootButton.addEventListener('touchend', () => this.keys.space = false);
            
            // Prevent default touch behaviors
            document.addEventListener('touchstart', handleTouchStart, { passive: false });
            document.addEventListener('touchmove', handleTouchStart, { passive: false });
        }
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.keys.left = true;
            if (e.key === 'ArrowRight') this.keys.right = true;
            if (e.key === ' ') {
                if (!this.keys.space && !this.gameOver) {
                    this.bullets.push(new Bullet(
                        this.player.x + this.player.width / 2,
                        this.player.y,
                        -1 // Moving up
                    ));
                    this.sounds.shoot();
                }
                this.keys.space = true;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft') this.keys.left = false;
            if (e.key === 'ArrowRight') this.keys.right = false;
            if (e.key === ' ') this.keys.space = false;
        });
    }
    
    update(deltaTime) {
        if (this.gameOver) return;

        // UFO update
        this.ufoTimer += deltaTime;
        if (this.ufoTimer >= this.ufoInterval) {
            this.ufoTimer = 0;
            if (!this.ufo) {
                this.ufo = new UFO(-50); // Start off screen
                this.sounds.ufo();
            }
        }
        
        if (this.ufo) {
            this.ufo.update();
            if (this.ufo.x > this.canvas.width) {
                this.ufo = null;
                if (this.ufoSound) {
                    try {
                        this.ufoSound.stop();
                    } catch (e) {
                        console.log('UFO sound already stopped');
                    }
                    this.ufoSound = null;
                }
            } else {
                // Check for bullet collision with UFO
                this.bullets.forEach(bullet => {
                    if (this.checkCollision(bullet, this.ufo)) {
                        this.score += 500;
                        this.updateScore();
                        this.sounds.ufoExplosion();
                        this.ufo = null;
                    }
                });
            }
        }
        
        // Alien shooting
        this.alienShootTimer += deltaTime;
        if (this.alienShootTimer >= this.alienShootInterval) {
            this.alienShootTimer = 0;
            if (this.aliens.length > 0) {
                const shootingAliens = this.aliens.filter(alien => 
                    !this.aliens.some(a => 
                        a.x === alien.x && a.y > alien.y
                    )
                );
                const shooter = shootingAliens[Math.floor(Math.random() * shootingAliens.length)];
                this.alienBullets.push(new Bullet(
                    shooter.x + shooter.width / 2,
                    shooter.y + shooter.height,
                    1 // Moving down
                ));
            }
        }
        
        // Update alien bullets
        this.alienBullets = this.alienBullets.filter(bullet => {
            bullet.update();
            
            // Check collision with player
            if (this.checkCollision(bullet, this.player)) {
                this.lives--;
                this.updateLives();
                this.sounds.explosion();
                if (this.lives <= 0) {
                    this.gameOver = true;
                }
                return false;
            }
            
            // Check collision with barriers
            let hitBarrier = false;
            this.barriers.forEach(barrier => {
                if (!hitBarrier && barrier.checkCollision(bullet)) {
                    hitBarrier = true;
                }
            });
            if (hitBarrier) return false;
            
            return bullet.y < this.canvas.height;
        });
        
        // Update player
        if (this.keys.left) this.player.moveLeft();
        if (this.keys.right) this.player.moveRight(this.canvas.width);
        
        // Update bullets
        this.bullets = this.bullets.filter(bullet => {
            bullet.update();
            return bullet.y > 0;
        });
        
        // Update aliens
        this.alienMoveTimer += deltaTime;
        if (this.alienMoveTimer >= this.alienMoveInterval) {
            this.alienMoveTimer = 0;
            
            let touchedEdge = false;
            this.aliens.forEach(alien => {
                if (this.alienStepDown) {
                    alien.y += 30;
                } else {
                    alien.x += 30 * this.alienDirection;
                    if (alien.x <= 0 || alien.x + alien.width >= this.canvas.width) {
                        touchedEdge = true;
                    }
                }
            });
            
            if (this.alienStepDown) {
                this.alienStepDown = false;
            } else if (touchedEdge) {
                this.alienDirection *= -1;
                this.alienStepDown = true;
            }
            
            // Speed up aliens as they get fewer
            this.alienMoveInterval = Math.max(100, 1000 * (this.aliens.length / 55));
        }
        
        // Check collisions with aliens and UFO
        this.bullets = this.bullets.filter(bullet => {
            let bulletHit = false;
            
            // Check collision with aliens
            this.aliens = this.aliens.filter(alien => {
                if (!bulletHit && this.checkCollision(bullet, alien)) {
                    this.score += (3 - alien.type) * 100;
                    this.updateScore();
                    bulletHit = true;
                    this.sounds.explosion();
                    return false;
                }
                return true;
            });
            
            // Check collision with UFO
            if (!bulletHit && this.ufo && this.checkCollision(bullet, this.ufo)) {
                this.score += 500;
                this.updateScore();
                this.sounds.ufoExplosion();
                if (this.ufoSound) {
                    try {
                        this.ufoSound.stop();
                    } catch (e) {
                        console.log('UFO sound already stopped');
                    }
                    this.ufoSound = null;
                }
                this.ufo = null;
                bulletHit = true;
            }
            
            // Check collision with barriers
            this.barriers.forEach(barrier => {
                if (!bulletHit && barrier.checkCollision(bullet)) {
                    bulletHit = true;
                }
            });
            
            return !bulletHit;
        });
        
        // Check if aliens reached bottom
        if (this.aliens.some(alien => alien.y + alien.height >= this.player.y)) {
            this.lives = 0;
            this.updateLives();
            this.gameOver = true;
        }
        
        // Check if all aliens are destroyed
        if (this.aliens.length === 0) {
            this.aliens = this.createAliens();
            this.alienMoveInterval = 1000;
        }
    }
    
    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.barriers.forEach(barrier => barrier.draw(this.ctx));
        this.player.draw(this.ctx);
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.alienBullets.forEach(bullet => bullet.draw(this.ctx));
        this.aliens.forEach(alien => alien.draw(this.ctx));
        if (this.ufo) {
            this.ufo.draw(this.ctx);
        }
        
        if (this.gameOver) {
            this.ctx.fillStyle = '#33ff33';
            this.ctx.font = '48px "Courier New"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = '24px "Courier New"';
            this.ctx.fillText('Press F5 to restart', this.canvas.width / 2, this.canvas.height / 2 + 40);
        }
    }
    
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    updateScore() {
        document.getElementById('scoreValue').textContent = this.score;
    }
    
    updateLives() {
        document.getElementById('livesValue').textContent = this.lives;
    }
    
    gameLoop(timestamp = 0) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 30;
        this.speed = 5;
    }
    
    moveLeft() {
        this.x = Math.max(0, this.x - this.speed);
    }
    
    moveRight(canvasWidth) {
        this.x = Math.min(canvasWidth - this.width, this.x + this.speed);
    }
    
    draw(ctx) {
        ctx.fillStyle = '#33ff33';
        
        // Draw ship body
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        
        // Draw cannon
        ctx.fillRect(this.x + this.width / 2 - 3, this.y - 8, 6, 8);
        
        // Draw engine glow
        const gradient = ctx.createLinearGradient(
            this.x, this.y + this.height,
            this.x, this.y + this.height + 10
        );
        gradient.addColorStop(0, '#33ff33');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.moveTo(this.x + 10, this.y + this.height);
        ctx.lineTo(this.x + 20, this.y + this.height + 10);
        ctx.lineTo(this.x + 30, this.y + this.height);
        ctx.fill();
    }
}

class Alien {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type % 3; // 0, 1, or 2 for different types
        this.width = 40;
        this.height = 40;
    }
    
    draw(ctx) {
        ctx.fillStyle = '#33ff33';
        
        if (this.type === 0) {
            // Squid-like alien
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height/2);
            ctx.lineTo(this.x + this.width - 10, this.y + this.height);
            ctx.lineTo(this.x + 10, this.y + this.height);
            ctx.lineTo(this.x, this.y + this.height/2);
            ctx.closePath();
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.x + 12, this.y + 15, 5, 0, Math.PI * 2);
            ctx.arc(this.x + 28, this.y + 15, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 1) {
            // Crab-like alien
            ctx.beginPath();
            // Body
            ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/3, 0, 0, Math.PI * 2);
            // Claws
            ctx.moveTo(this.x, this.y + 15);
            ctx.lineTo(this.x - 5, this.y + 5);
            ctx.moveTo(this.x + this.width, this.y + 15);
            ctx.lineTo(this.x + this.width + 5, this.y + 5);
            ctx.stroke();
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.x + 15, this.y + 20, 4, 0, Math.PI * 2);
            ctx.arc(this.x + 25, this.y + 20, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Octopus-like alien
            ctx.beginPath();
            // Head
            ctx.arc(this.x + this.width/2, this.y + 15, 15, 0, Math.PI * 2);
            // Tentacles
            for(let i = 0; i < 4; i++) {
                ctx.moveTo(this.x + 10 + i * 10, this.y + 25);
                ctx.quadraticCurveTo(
                    this.x + 10 + i * 10,
                    this.y + 40,
                    this.x + 5 + i * 10,
                    this.y + 35
                );
            }
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.x + 15, this.y + 15, 3, 0, Math.PI * 2);
            ctx.arc(this.x + 25, this.y + 15, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Bullet {
    constructor(x, y, direction) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 15;
        this.speed = 7;
        this.direction = direction; // -1 for up, 1 for down
    }
    
    update() {
        this.y += this.speed * this.direction;
    }
    
    draw(ctx) {
        // Glowing effect
        const gradient = ctx.createLinearGradient(
            this.x - this.width / 2, this.y,
            this.x - this.width / 2, this.y + this.height
        );
        gradient.addColorStop(0, '#33ff33');
        gradient.addColorStop(0.5, '#88ff88');
        gradient.addColorStop(1, '#33ff33');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        
        // Add glow effect
        ctx.shadowColor = '#33ff33';
        ctx.shadowBlur = 10;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Barrier {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 60;
        this.blocks = this.createBlocks();
    }

    createBlocks() {
        const blocks = [];
        const blockSize = 10;
        const shape = [
            '  XXXXXX  ',
            ' XXXXXXXX ',
            'XXXXXXXXXX',
            'XXXXXXXXXX',
            'XXXXXXXXXX',
            'XXX    XXX'
        ];

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col] === 'X') {
                    blocks.push({
                        x: this.x + col * blockSize,
                        y: this.y + row * blockSize,
                        width: blockSize,
                        height: blockSize,
                        health: 1
                    });
                }
            }
        }
        return blocks;
    }

    checkCollision(bullet) {
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            if (bullet.x < block.x + block.width &&
                bullet.x + bullet.width > block.x &&
                bullet.y < block.y + block.height &&
                bullet.y + bullet.height > block.y) {
                block.health--;
                if (block.health <= 0) {
                    this.blocks.splice(i, 1);
                }
                return true;
            }
        }
        return false;
    }

    draw(ctx) {
        this.blocks.forEach(block => {
            const alpha = block.health;
            ctx.fillStyle = `rgba(51, 255, 51, ${alpha})`;
            ctx.fillRect(block.x, block.y, block.width, block.height);
        });
    }
}

class UFO {
    constructor(x) {
        this.x = x;
        this.y = 50;
        this.width = 60;
        this.height = 25;
        this.speed = 3;
    }

    update() {
        this.x += this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = '#33ff33';
        
        // Draw saucer body
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw dome
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height/3, this.width/4, this.height/3, 0, Math.PI, 0);
        ctx.fill();
        
        // Draw lights
        ctx.fillStyle = '#000';
        for(let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(this.x + (i + 1) * (this.width/5), this.y + this.height/2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    
    // Handle orientation changes
    window.addEventListener('resize', () => {
        const game = window.gameInstance;
        if (game && game.isMobile) {
            const aspectRatio = 4/3;
            game.canvas.width = Math.min(window.innerWidth, window.innerHeight * aspectRatio);
            game.canvas.height = game.canvas.width / aspectRatio;
        }
    });
    
    // Store game instance globally for resize handler
    window.gameInstance = 
    new Game();
});
