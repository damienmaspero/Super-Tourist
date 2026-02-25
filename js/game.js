// ═══════════════════════════════════════════════════════════════
//  Super Tourist  –  js/game.js
// ═══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
// 1. CONSTANTS & CONFIG
// ──────────────────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 500;

const GRAVITY       = 0.45;
const JUMP_FORCE    = -11;
const PLAYER_SPEED  = 3.8;
const ENEMY_SPEED   = 1.4;

const GROUND_Y      = CANVAS_H - 40;   // top of ground platform

const PLAYER_W = 28;
const PLAYER_H = 40;

const ENEMY_W  = 28;
const ENEMY_H  = 36;

const COLLECTABLE_R = 12;             // radius for drawing

// ──────────────────────────────────────────────────────────────
// 2. GAME STATE
// ──────────────────────────────────────────────────────────────
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');

// Possible screens: 'start' | 'playing' | 'levelComplete' | 'gameOver' | 'win'
let screen       = 'start';
let score        = 0;
let lives        = 3;
let currentLevel = 1;

let player       = null;
let enemies      = [];
let collectibles = [];
let platforms    = [];

// ──────────────────────────────────────────────────────────────
// 3. INPUT HANDLING
// ──────────────────────────────────────────────────────────────
const keys = {};

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (e.code === 'Enter') {
    if (screen === 'start')         startGame();
    else if (screen === 'gameOver') startGame();
    else if (screen === 'win')      startGame();
    else if (screen === 'levelComplete') loadLevel(currentLevel);
  }

  // Prevent page scroll on arrow / space
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ──────────────────────────────────────────────────────────────
// 4. PHYSICS / COLLISION UTILITIES
// ──────────────────────────────────────────────────────────────

/** Axis-aligned bounding-box overlap test */
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx &&
         ay < by + bh && ay + ah > by;
}

/**
 * Resolve player vs platform collision.
 * Returns 'top' | 'side' | null depending on which face was hit.
 */
function resolvePlatformCollision(obj, plat) {
  if (!rectsOverlap(obj.x, obj.y, obj.w, obj.h, plat.x, plat.y, plat.w, plat.h)) {
    return null;
  }

  const overlapLeft  = (obj.x + obj.w) - plat.x;
  const overlapRight = (plat.x + plat.w) - obj.x;
  const overlapTop   = (obj.y + obj.h) - plat.y;
  const overlapBot   = (plat.y + plat.h) - obj.y;

  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBot);

  if (minOverlap === overlapTop && obj.vy >= 0) {
    obj.y  = plat.y - obj.h;
    obj.vy = 0;
    obj.onGround = true;
    return 'top';
  }
  if (minOverlap === overlapBot && obj.vy < 0) {
    obj.y  = plat.y + plat.h;
    obj.vy = 0;
    return 'bottom';
  }
  if (minOverlap === overlapLeft) {
    obj.x  = plat.x - obj.w;
    obj.vx = 0;
    return 'side';
  }
  if (minOverlap === overlapRight) {
    obj.x  = plat.x + plat.w;
    obj.vx = 0;
    return 'side';
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// 5. PLAYER CLASS
// ──────────────────────────────────────────────────────────────
class Player {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    this.w  = PLAYER_W;
    this.h  = PLAYER_H;
    this.vx = 0;
    this.vy = 0;
    this.onGround  = false;
    this.facingRight = true;
    this.invincible  = 0;       // invincibility frames after hit
    this.dead        = false;
  }

  update() {
    if (this.dead) return;

    // Horizontal input
    this.vx = 0;
    if (keys['ArrowLeft']  || keys['KeyA']) { this.vx = -PLAYER_SPEED; this.facingRight = false; }
    if (keys['ArrowRight'] || keys['KeyD']) { this.vx =  PLAYER_SPEED; this.facingRight = true;  }

    // Jump input
    if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && this.onGround) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
    }

    // Apply gravity
    this.vy += GRAVITY;

    // Move
    this.x += this.vx;
    this.y += this.vy;

    // Wall clamp
    if (this.x < 0)              this.x = 0;
    if (this.x + this.w > CANVAS_W) this.x = CANVAS_W - this.w;

    // Reset ground flag – platforms will re-set it if standing
    this.onGround = false;

    // Platform collisions
    for (const p of platforms) {
      resolvePlatformCollision(this, p);
    }

    // Fell off bottom
    if (this.y > CANVAS_H + 20) {
      this.dead = true;
    }

    // Countdown invincibility
    if (this.invincible > 0) this.invincible--;
  }

  draw() {
    if (this.dead) return;

    // Blink when invincible
    if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) return;

    const x = this.x, y = this.y;
    const dir = this.facingRight ? 1 : -1;

    // Body (blue shirt)
    ctx.fillStyle = '#2255cc';
    ctx.fillRect(x, y + 14, this.w, this.h - 14);

    // Shorts (darker blue)
    ctx.fillStyle = '#113388';
    ctx.fillRect(x, y + 28, this.w, 12);

    // Head (skin)
    ctx.fillStyle = '#f5c589';
    ctx.fillRect(x + 4, y, this.w - 8, 16);

    // Eyes
    ctx.fillStyle = '#333';
    const eyeX = this.facingRight ? x + 16 : x + 8;
    ctx.fillRect(eyeX, y + 5, 3, 3);

    // Tourist hat (wide brim)
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(x, y - 7, this.w, 4);          // brim
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(x + 5, y - 13, this.w - 10, 8); // crown

    // Camera strap (thin diagonal line)
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + (this.facingRight ? 20 : 8),  y + 15);
    ctx.lineTo(x + (this.facingRight ? 6  : 22), y + 26);
    ctx.stroke();

    // Camera body
    ctx.fillStyle = '#555';
    ctx.fillRect(x + (this.facingRight ? 2 : 18), y + 24, 8, 6);
    ctx.fillStyle = '#89cff0';
    ctx.fillRect(x + (this.facingRight ? 4 : 20), y + 26, 4, 4);

    // Legs
    ctx.fillStyle = '#f5c589';
    ctx.fillRect(x + 3,          y + 38, 9, 6);
    ctx.fillRect(x + this.w - 12, y + 38, 9, 6);
  }

  takeDamage() {
    if (this.invincible > 0) return;
    lives--;
    this.invincible = 90;
    if (lives <= 0) {
      screen = 'gameOver';
    }
  }
}

// ──────────────────────────────────────────────────────────────
// 6. ENEMY CLASS
// ──────────────────────────────────────────────────────────────
class Enemy {
  constructor(x, y, platIndex) {
    this.x  = x;
    this.y  = y;
    this.w  = ENEMY_W;
    this.h  = ENEMY_H;
    this.vx = ENEMY_SPEED;
    this.vy = 0;
    this.alive = true;
    this.platIndex = platIndex;   // index into platforms[] – used for edge detection
    this.deathTimer = 0;
  }

  update() {
    if (!this.alive) return;

    this.vy += GRAVITY;
    this.x  += this.vx;
    this.y  += this.vy;

    // Platform collisions
    this.onGround = false;
    for (const p of platforms) {
      resolvePlatformCollision(this, p);
    }

    // Turn at platform edges (only if on the assigned platform)
    const plat = platforms[this.platIndex];
    if (plat) {
      if (this.x <= plat.x) {
        this.x  = plat.x;
        this.vx = Math.abs(this.vx);
      }
      if (this.x + this.w >= plat.x + plat.w) {
        this.x  = plat.x + plat.w - this.w;
        this.vx = -Math.abs(this.vx);
      }
    }

    // Canvas bounds fallback
    if (this.x < 0)              { this.x = 0;              this.vx =  Math.abs(this.vx); }
    if (this.x + this.w > CANVAS_W) { this.x = CANVAS_W - this.w; this.vx = -Math.abs(this.vx); }
  }

  die() {
    this.alive = false;
  }

  draw() {
    if (!this.alive) return;
    const x = this.x, y = this.y;

    // Body (orange tourist shirt)
    ctx.fillStyle = '#e06b20';
    ctx.fillRect(x, y + 12, this.w, this.h - 12);

    // Shorts
    ctx.fillStyle = '#a04010';
    ctx.fillRect(x, y + 26, this.w, 10);

    // Head
    ctx.fillStyle = '#f5c589';
    ctx.fillRect(x + 4, y, this.w - 8, 14);

    // Angry eyes
    ctx.fillStyle = '#800000';
    ctx.fillRect(x + 8,  y + 4, 3, 3);
    ctx.fillRect(x + 17, y + 4, 3, 3);

    // Red tourist hat
    ctx.fillStyle = '#cc2200';
    ctx.fillRect(x,      y - 6,  this.w,      4);
    ctx.fillStyle = '#990000';
    ctx.fillRect(x + 5,  y - 12, this.w - 10, 8);

    // Legs
    ctx.fillStyle = '#f5c589';
    ctx.fillRect(x + 3,           y + 34, 8, 5);
    ctx.fillRect(x + this.w - 11, y + 34, 8, 5);
  }
}

// ──────────────────────────────────────────────────────────────
// 7. COLLECTIBLE CLASS
// ──────────────────────────────────────────────────────────────
class Collectible {
  constructor(x, y, type) {
    this.x       = x;
    this.y       = y;
    this.type    = type;   // 'pizza' | 'icecream'
    this.r       = COLLECTABLE_R;
    this.collected = false;
    this.bobOffset = Math.random() * Math.PI * 2;  // for floating animation
    this.age = 0;
  }

  get points() { return this.type === 'pizza' ? 100 : 200; }

  update() {
    this.age++;
  }

  draw() {
    if (this.collected) return;
    const bobY = this.y + Math.sin((this.age + this.bobOffset) * 0.06) * 3;

    if (this.type === 'pizza') {
      drawPizza(this.x, bobY, this.r);
    } else {
      drawIceCream(this.x, bobY, this.r);
    }
  }
}

// ── Drawing helpers for collectibles ──
function drawPizza(cx, cy, r) {
  // Outer crust circle
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Tomato sauce
  ctx.fillStyle = '#cc2200';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.fill();

  // Cheese
  ctx.fillStyle = '#f5e642';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fill();

  // Pepperoni dots
  ctx.fillStyle = '#aa1100';
  const pepPos = [
    [cx - 4, cy - 3], [cx + 4, cy - 2], [cx, cy + 4]
  ];
  for (const [px, py] of pepPos) {
    ctx.beginPath();
    ctx.arc(px, py, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Slice lines
  ctx.strokeStyle = '#c8a010';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.stroke();
  }
}

function drawIceCream(cx, cy, r) {
  // Cone (triangle)
  ctx.fillStyle = '#d4903a';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.8, cy);
  ctx.lineTo(cx + r * 0.8, cy);
  ctx.lineTo(cx, cy + r * 1.6);
  ctx.closePath();
  ctx.fill();

  // Waffle lines on cone
  ctx.strokeStyle = '#b8741e';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 1.6);
  ctx.lineTo(cx - r * 0.4, cy + r * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 1.6);
  ctx.lineTo(cx + r * 0.4, cy + r * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy + r * 0.3);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.3);
  ctx.stroke();

  // Scoop (circle)
  ctx.fillStyle = '#ff91a4';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.7, r * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.95, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // Sprinkles
  const sprinkleColors = ['#ff0', '#0f0', '#f0f', '#0ff'];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const sx = cx + Math.cos(ang) * r * 0.45;
    const sy = (cy - r * 0.7) + Math.sin(ang) * r * 0.45;
    ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
    ctx.fillRect(sx - 1.5, sy - 0.5, 4, 1.5);
  }
}

// ──────────────────────────────────────────────────────────────
// 8. PLATFORM / LEVEL DEFINITIONS
// ──────────────────────────────────────────────────────────────

/**
 * Each platform: { x, y, w, h }
 * Index 0 is always the full-width ground platform.
 */
function buildLevel1() {
  platforms = [
    // Ground
    { x: 0,   y: GROUND_Y, w: CANVAS_W, h: 40 },
    // Floating platforms
    { x: 80,  y: 380, w: 130, h: 18 },
    { x: 290, y: 320, w: 140, h: 18 },
    { x: 500, y: 260, w: 130, h: 18 },
    { x: 620, y: 380, w: 130, h: 18 },
    { x: 160, y: 240, w: 120, h: 18 },
    { x: 380, y: 180, w: 160, h: 18 },
  ];

  enemies = [
    new Enemy(100,  GROUND_Y - ENEMY_H,       0),
    new Enemy(580,  GROUND_Y - ENEMY_H,       0),
    new Enemy(90,   380       - ENEMY_H,       1),
    new Enemy(310,  320       - ENEMY_H,       2),
    new Enemy(520,  260       - ENEMY_H,       3),
  ];

  collectibles = [
    // Ground level
    new Collectible(200, GROUND_Y - COLLECTABLE_R * 2,  'pizza'),
    new Collectible(400, GROUND_Y - COLLECTABLE_R * 2,  'icecream'),
    new Collectible(680, GROUND_Y - COLLECTABLE_R * 2,  'pizza'),
    // Platform 1
    new Collectible(145, 380 - COLLECTABLE_R * 2,       'pizza'),
    // Platform 2
    new Collectible(355, 320 - COLLECTABLE_R * 2,       'icecream'),
    // Platform 3
    new Collectible(560, 260 - COLLECTABLE_R * 2,       'pizza'),
    // Platform 4
    new Collectible(680, 380 - COLLECTABLE_R * 2,       'icecream'),
    // Platform 5
    new Collectible(220, 240 - COLLECTABLE_R * 2,       'pizza'),
    // Platform 6
    new Collectible(460, 180 - COLLECTABLE_R * 2,       'icecream'),
  ];
}

function buildLevel2() {
  platforms = [
    // Ground
    { x: 0,   y: GROUND_Y, w: CANVAS_W, h: 40 },
    // Floating platforms (slightly different layout)
    { x: 50,  y: 370, w: 120, h: 18 },
    { x: 240, y: 300, w: 120, h: 18 },
    { x: 430, y: 240, w: 120, h: 18 },
    { x: 620, y: 340, w: 130, h: 18 },
    { x: 140, y: 220, w: 110, h: 18 },
    { x: 330, y: 160, w: 130, h: 18 },
    { x: 580, y: 190, w: 110, h: 18 },
  ];

  enemies = [
    new Enemy(100,  GROUND_Y - ENEMY_H,  0),
    new Enemy(380,  GROUND_Y - ENEMY_H,  0),
    new Enemy(620,  GROUND_Y - ENEMY_H,  0),
    new Enemy(55,   370       - ENEMY_H,  1),
    new Enemy(250,  300       - ENEMY_H,  2),
    new Enemy(440,  240       - ENEMY_H,  3),
    new Enemy(630,  340       - ENEMY_H,  4),
    new Enemy(390,  160       - ENEMY_H,  6),
  ];

  collectibles = [
    new Collectible(160, GROUND_Y - COLLECTABLE_R * 2,  'pizza'),
    new Collectible(320, GROUND_Y - COLLECTABLE_R * 2,  'icecream'),
    new Collectible(520, GROUND_Y - COLLECTABLE_R * 2,  'pizza'),
    new Collectible(750, GROUND_Y - COLLECTABLE_R * 2,  'icecream'),
    new Collectible(110, 370 - COLLECTABLE_R * 2,       'icecream'),
    new Collectible(300, 300 - COLLECTABLE_R * 2,       'pizza'),
    new Collectible(490, 240 - COLLECTABLE_R * 2,       'icecream'),
    new Collectible(680, 340 - COLLECTABLE_R * 2,       'pizza'),
    new Collectible(195, 220 - COLLECTABLE_R * 2,       'icecream'),
    new Collectible(390, 160 - COLLECTABLE_R * 2,       'pizza'),
    new Collectible(630, 190 - COLLECTABLE_R * 2,       'icecream'),
  ];
}

// ──────────────────────────────────────────────────────────────
// 9. GAME INIT / LEVEL LOADING
// ──────────────────────────────────────────────────────────────
function startGame() {
  score        = 0;
  lives        = 3;
  currentLevel = 1;
  loadLevel(1);
}

function loadLevel(level) {
  currentLevel = level;
  screen = 'playing';
  if (level === 1) buildLevel1();
  else             buildLevel2();
  spawnPlayer();
}

function spawnPlayer() {
  player = new Player(60, GROUND_Y - PLAYER_H);
}

// ──────────────────────────────────────────────────────────────
// 10. GAME LOOP  (update + render)
// ──────────────────────────────────────────────────────────────
function update() {
  if (screen !== 'playing') return;

  // Update collectibles (animation)
  for (const c of collectibles) c.update();

  // Update enemies
  for (const e of enemies) e.update();

  // Update player
  player.update();

  if (player.dead) {
    if (lives > 0) {
      // Respawn after a moment (handled immediately here for simplicity)
      player.dead = false;
      spawnPlayer();
    }
    return;
  }

  // ── Player vs Collectibles ──
  for (const c of collectibles) {
    if (c.collected) continue;
    const dist = Math.hypot(
      (player.x + player.w / 2) - c.x,
      (player.y + player.h / 2) - c.y
    );
    if (dist < c.r + Math.min(player.w, player.h) / 2) {
      c.collected = true;
      score += c.points;
    }
  }

  // ── Player vs Enemies ──
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!rectsOverlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) continue;

    // Stomp: player's bottom is near the enemy's top AND player is moving down
    const playerBottom = player.y + player.h;
    const stompZone    = e.y + 10;

    if (playerBottom <= stompZone + 12 && player.vy > 0) {
      e.die();
      score += 100;
      player.vy = JUMP_FORCE * 0.7;   // little bounce
    } else {
      player.takeDamage();
    }
  }

  // ── Level complete? ──
  if (collectibles.every(c => c.collected)) {
    if (currentLevel === 2) {
      screen = 'win';
    } else {
      screen = 'levelComplete';
    }
  }
}

// ── Background cloud helper ──
const clouds = [
  { x: 80,  y: 60,  r: 28 },
  { x: 260, y: 45,  r: 22 },
  { x: 460, y: 70,  r: 32 },
  { x: 650, y: 50,  r: 24 },
  { x: 740, y: 90,  r: 18 },
];

function drawBackground() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0,   '#4db8ff');
  grad.addColorStop(0.6, '#87ceeb');
  grad.addColorStop(1,   '#b0e0ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  for (const c of clouds) {
    ctx.beginPath();
    ctx.arc(c.x,           c.y,           c.r,      0, Math.PI * 2);
    ctx.arc(c.x + c.r,     c.y - c.r * 0.4, c.r * 0.7, 0, Math.PI * 2);
    ctx.arc(c.x - c.r * 0.6, c.y + c.r * 0.1, c.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant hills
  ctx.fillStyle = '#6abf69';
  ctx.beginPath();
  ctx.arc(150, CANVAS_H, 130, 0, Math.PI, true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(400, CANVAS_H, 110, 0, Math.PI, true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(650, CANVAS_H, 140, 0, Math.PI, true);
  ctx.fill();
}

function drawPlatforms() {
  for (const p of platforms) {
    // Main fill
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Top grass stripe
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(p.x, p.y, p.w, 5);
    // Dark border
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }
}

function drawHUD() {
  ctx.save();
  ctx.font = 'bold 18px sans-serif';
  ctx.textBaseline = 'top';

  // Score
  ctx.fillStyle = '#000';
  ctx.fillText(`Score: ${score}`, 12, 10);
  ctx.fillStyle = '#fff';
  ctx.fillText(`Score: ${score}`, 11, 9);

  // Level (center)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText(`Level ${currentLevel}`, CANVAS_W / 2, 10);
  ctx.fillStyle = '#fff';
  ctx.fillText(`Level ${currentLevel}`, CANVAS_W / 2 - 1, 9);

  // Lives (right)
  ctx.textAlign = 'right';
  const heartsStr = '♥'.repeat(Math.max(0, lives));
  ctx.fillStyle = '#000';
  ctx.fillText(heartsStr, CANVAS_W - 10, 10);
  ctx.fillStyle = '#ff4444';
  ctx.fillText(heartsStr, CANVAS_W - 11, 9);

  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (screen === 'start')         { drawStartScreen();         return; }
  if (screen === 'gameOver')      { drawGameOverScreen();       return; }
  if (screen === 'levelComplete') { drawLevelCompleteScreen();  return; }
  if (screen === 'win')           { drawWinScreen();            return; }

  drawBackground();
  drawPlatforms();
  for (const c of collectibles) c.draw();
  for (const e of enemies)      e.draw();
  player.draw();
  drawHUD();
}

// ──────────────────────────────────────────────────────────────
// 11. SCREEN RENDERERS
// ──────────────────────────────────────────────────────────────

function overlayBox(title, subtitle, extra) {
  // Draw a frozen game frame underneath
  drawBackground();
  if (platforms.length) drawPlatforms();
  for (const c of collectibles) c.draw();
  for (const e of enemies) e.draw();
  if (player) player.draw();

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#000';
  ctx.shadowBlur  = 12;
  ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 50);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 6;
  ctx.fillText(subtitle, CANVAS_W / 2, CANVAS_H / 2 + 10);

  if (extra) {
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText(extra, CANVAS_W / 2, CANVAS_H / 2 + 48);
  }

  ctx.restore();
}

function drawStartScreen() {
  // Full background for start
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0,   '#4db8ff');
  grad.addColorStop(1,   '#b0e0ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of clouds) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.arc(c.x + c.r, c.y - c.r * 0.4, c.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Game title
  ctx.font = 'bold 64px sans-serif';
  ctx.fillStyle = '#1a1a2e';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur  = 20;
  ctx.fillText('🌍 SUPER TOURIST', CANVAS_W / 2, 160);

  ctx.shadowBlur = 0;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText('Collect 🍕 pizzas and 🍦 ice-creams!', CANVAS_W / 2, 230);
  ctx.fillText('Stomp the tourist enemies!', CANVAS_W / 2, 265);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#333';
  ctx.fillText('Arrow Keys / WASD to move  •  Up / W / Space to jump', CANVAS_W / 2, 320);
  ctx.fillText('On mobile: use on-screen buttons below', CANVAS_W / 2, 350);

  // Blink effect for Enter / tap prompt
  const blink = Math.floor(Date.now() / 500) % 2 === 0;
  if (blink) {
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#cc2200';
    ctx.fillText('Press ENTER or tap to start', CANVAS_W / 2, 410);
  }

  ctx.restore();
}

function drawGameOverScreen() {
  overlayBox(
    'GAME OVER',
    `Final Score: ${score}`,
    'Press ENTER to restart'
  );
}

function drawLevelCompleteScreen() {
  overlayBox(
    '✓ Level Complete!',
    `Score: ${score}`,
    'Press ENTER for next level'
  );
}

function drawWinScreen() {
  overlayBox(
    '🏆 You Win!',
    `Final Score: ${score}`,
    'Press ENTER to play again'
  );
}

// ──────────────────────────────────────────────────────────────
// 12. MAIN LOOP
// ──────────────────────────────────────────────────────────────
function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// ──────────────────────────────────────────────────────────────
// 13. TOUCH / POINTER CONTROLS
// ──────────────────────────────────────────────────────────────
function setupTouchControls() {
  function press(code)   { keys[code] = true;  }
  function release(code) { keys[code] = false; }

  const btnLeft  = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnJump  = document.getElementById('btn-jump');

  [
    [btnLeft,  'ArrowLeft'],
    [btnRight, 'ArrowRight'],
    [btnJump,  'Space'],
  ].forEach(([btn, code]) => {
    btn.addEventListener('pointerdown',  (e) => { e.preventDefault(); press(code);   });
    btn.addEventListener('pointerup',    (e) => { e.preventDefault(); release(code); });
    btn.addEventListener('pointerleave', ()  => { release(code); });
    btn.addEventListener('pointercancel',()  => { release(code); });
  });

  // Tap canvas to advance overlay screens
  canvas.addEventListener('click', () => {
    if (screen === 'start')              startGame();
    else if (screen === 'gameOver')      startGame();
    else if (screen === 'win')           startGame();
    else if (screen === 'levelComplete') loadLevel(currentLevel);
  });
}

setupTouchControls();

// Bootstrap – show start screen immediately
requestAnimationFrame(loop);
