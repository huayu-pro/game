/**
 * Hands Cat's Cradle (双手翻绳) Simulation - Enhanced Edition (V2.0)
 * Core Application Logic with Advanced Physics, Challenge Modes, and Audio Synthesizer
 */

// --- Helper Functions ---
function distToSegment(p, v, w) {
    const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function lerpColor(color, factor) {
    if (factor <= 0) return color;
    if (factor >= 1) factor = 1;
    if (typeof color !== 'string' || !color.startsWith('#')) return color;
    
    let r1 = parseInt(color.slice(1, 3), 16);
    let g1 = parseInt(color.slice(3, 5), 16);
    let b1 = parseInt(color.slice(5, 7), 16);
    
    // Target warm color: glowing hot orange (#ff5b00)
    let r2 = 255;
    let g2 = 91 + Math.floor(130 * factor); // fades from orange to yellow-white
    let b2 = Math.floor(60 * factor);
    
    let r = Math.round(r1 + (r2 - r1) * factor);
    let g = Math.round(g1 + (g2 - g1) * factor);
    let b = Math.round(b1 + (b2 - b1) * factor);
    
    return `rgb(${r}, ${g}, ${b})`;
}

function drawPathWithGlow(ctx, drawFn, color, width, glowStrength) {
    if (glowStrength <= 0) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        drawFn();
        ctx.stroke();
        ctx.restore();
        return;
    }
    
    // Task C: reduced from 4 stroked layers to 2 (outer glow + core) — ~half the overdraw.
    // Compensated removed middle layers with a slightly wider, higher-alpha outer glow.
    
    // Layer 1: Wide low-alpha outer glow
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * 0.18;
    ctx.strokeStyle = color;
    ctx.lineWidth = width + glowStrength * 1.2;
    drawFn();
    ctx.stroke();
    ctx.restore();
    
    // Layer 2: Core line
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    drawFn();
    ctx.stroke();
    ctx.restore();
}

function drawCircleWithGlow(ctx, x, y, r, fillColor, strokeColor, strokeWidth, glowStrength) {
    if (glowStrength <= 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        if (strokeColor) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
        }
        ctx.restore();
        return;
    }
    
    const glowColor = strokeColor || fillColor || '#00ffff';
    
    // Task C: reduced from 3 filled layers to 2 (outer glow + core) — ~half the overdraw.
    // Compensated removed inner glow with a slightly higher-alpha outer ring.
    
    // Outer glow ring/disk
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * 0.18;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(x, y, r + glowStrength * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Core
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
    }
    ctx.restore();
}


// --- Logger System ---
const logger = {
    el: null,
    init() {
        this.el = document.getElementById('terminal-body');
        this.log('Holographic Core diagnostics online.', 'success');
        this.log('Systems ready. Awaiting hand tracking calibration...', 'info');
    },
    log(message, type = 'light') {
        if (!this.el) return;
        const time = new Date().toTimeString().split(' ')[0];
        const line = document.createElement('span');
        line.className = `log-line text-${type}`;
        line.innerText = `[${time}] ${message}`;
        this.el.appendChild(line);
        
        // Horizontal auto-scroll for ticker
        if (this.el.parentElement) {
            this.el.parentElement.scrollTo({
                left: this.el.parentElement.scrollWidth,
                behavior: 'smooth'
            });
        }
        
        while (this.el.childNodes.length > 25) { // Keep fewer elements for performance
            this.el.removeChild(this.el.firstChild);
        }
    }
};

// --- Web Audio Synthesizer (Space Harp, Traditional Guzheng/Flute, Western Bells/Violin, and Nature) ---
// --- Main App Logic ---
const app = {
    video: null,
    canvas: null,
    ctx: null,
    loader: null,
    guide: null,
    sidebar: null,
    bgm: null, // Audio node for local background music uploads
    styles: {}, // Holds loaded JSON style configs

    // App State Config
    state: {
        pattern: 'star', // star, starry, cradle, flower, well
        showWebcam: true,
        showSkeleton: true,
        mirror: true,
        enableAudio: true,
        enablePad: true,
        enablePluck: true,
        enableCut: true,
        drawMode: false,
        toughness: 5,
        colorTheme: 'cyan-pink',
        glowStrength: 15,
        stringWidth: 3,
        physics: true,
        gravityEngine: 'down',
        gravityStrength: 0.5,
        pluckSensitivity: 5,
        bgMode: 'webcam',
        customBgImage: null,
        stringStyle: 'solid',
        absoluteStraight: false,
        fillLoops: true,
        fillColor: '#00ffff',
        fillOpacity: 0.3,
        convexPolygonMode: false,
        pureMode: false,
        artStyle: 'cyberpunk',
        brushStyle: 'xing',
        poetryMode: 'jiangjinjiu',
        customPoetry: '',
        signature: '墨客',
        convexPolygonColor: '#ff00ff',
        particleStyle: 'auto',
        neverBreak: false,
        particlesEnabled: true,
        particleSize: 3.0,
        enabledFingers: {
            thumb: true,
            index: true,
            middle: true,
            ring: true,
            pinky: true
        },
        tension: 6,
        damping: 0.95,
        timbre: 'guzheng',
        particleCount: 3,
        particleSpeed: 1.0,
        particleLifespan: 3.0,
        particleTrajectory: 'explode',
        canvasBgColor: '#050608',
        dropOnLost: true,
        particleShape: 'circle',
        particleColorType: 'theme',
        particleCustomColor: '#00ffff',
        particleGlow: 0,
        particleCircleSpread: false,
        enableFingerRipple: false,
        fingerRippleSize: 30,
        fingerRippleColor: '#00ffff'
    },

    // Hand-drawn straight lines array
    drawings: [],
    // Left & Right hand active drawing temporary states
    activeDrawings: { Left: null, Right: null },
    cutFlashes: [],
    handLostTimer: null,

    // Task 18: drawClosedLoops incremental cache (avoid re-running DFS every frame)
    _drawingsDirty: true,
    _cachedVertices: null,
    _cachedAdj: null,
    _cachedCycles: null,

    // Recording variables
    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false,
    recordTimer: null,
    recordStartTime: 0,

    // Tracking info
    handsData: {},
    prevFingertips: {}, // Store previous frames to compute velocity
    activeStrings: {}, // Persistent VerletString store
    lastLogsState: { Left: false, Right: false },
    _sideLostAt: {},  // 记录每侧手部丢失的开始时间（防抖宽限期）

    // Task B: RAF render loop state
    rafId: null,
    latestResults: null,
    hasResults: false,

    async init() {
        logger.init();
        
        this.video = document.getElementById('webcam');
        this.canvas = document.getElementById('output-canvas');
        this.ctx = this.canvas.getContext('2d');
        // Mouse tracking for cyber particle mouse-follow (Task 1)
        this.mouseX = undefined;
        this.mouseY = undefined;
        this._onMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        };
        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('pointermove', this._onMouseMove);
        this.loader = document.getElementById('loader-overlay');
        this.guide = document.getElementById('guide-overlay');
        this.sidebar = document.getElementById('settings-sidebar');

        // BGM initialization
        this.bgm = new Audio();
        this.bgm.loop = true;

        await this.loadStyles();
        
        // Load Global State Persistence
        this.loadGlobalState();
        
        // Task D: mousemove optimization — cache rect on mouseenter, rAF-throttle CSS var updates.
        // Keeps the radial-gradient cursor-follow effect but eliminates per-event getBoundingClientRect.
        this._actionBtns = Array.from(document.querySelectorAll('.action-btn'));
        this._btnMousePending = false;
        this._btnMouseLast = null;
        this._btnMouseEnterHandler = (e) => {
            e.currentTarget._rect = e.currentTarget.getBoundingClientRect();
        };
        this._btnMouseMoveHandler = (e) => {
            const btn = e.currentTarget;
            if (!btn._rect) btn._rect = btn.getBoundingClientRect();
            this._btnMouseLast = { btn, x: e.clientX - btn._rect.left, y: e.clientY - btn._rect.top };
            if (!this._btnMousePending) {
                this._btnMousePending = true;
                this._btnRafId = requestAnimationFrame(() => {
                    this._btnMousePending = false;
                    if (this._btnMouseLast) {
                        const d = this._btnMouseLast;
                        d.btn.style.setProperty('--mx', `${d.x}px`);
                        d.btn.style.setProperty('--my', `${d.y}px`);
                    }
                });
            }
        };
        this._actionBtns.forEach(btn => {
            btn.addEventListener('mouseenter', this._btnMouseEnterHandler);
            btn.addEventListener('mousemove', this._btnMouseMoveHandler);
        });
        
        // Keydown global (Task A: named bound handler for teardown)
        this.keydownHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const key = e.key.toLowerCase();
            
            // Adjust line thickness via shortcuts (even in pure mode)
            if (key === '[' || key === ']') {
                let currentW = parseFloat(this.state.stringWidth || 3);
                currentW += (key === ']' ? 0.5 : -0.5);
                currentW = Math.max(1, Math.min(8, currentW));
                this.state.stringWidth = currentW;
                const slider = document.getElementById('slider-string-width');
                if (slider) {
                    slider.value = currentW;
                    if (slider.nextElementSibling) slider.nextElementSibling.innerText = currentW.toFixed(1);
                }
                logger.log(`Line thickness changed to ${currentW}`, 'info');
                return;
            }

            if (key === 'p') {
                const pureToggle = document.getElementById('toggle-pure-mode');
                if (pureToggle) {
                    pureToggle.checked = !pureToggle.checked;
                    pureToggle.dispatchEvent(new Event('change'));
                }
            } else if (key === ' ') {
                e.preventDefault(); // Prevent scrolling
                this.sidebar.classList.toggle('hidden');
            } else if (key === 'r') {
                this.toggleRecording();
            } else if (key === 's') {
                this.takeScreenshot();
            } else if (key === 'c') {
                const btnClear = document.getElementById('btn-clear-drawings');
                if (btnClear) btnClear.click();
            } else if (key === 'm') {
                const mirrorToggle = document.getElementById('toggle-mirror');
                if (mirrorToggle) {
                    mirrorToggle.checked = !mirrorToggle.checked;
                    mirrorToggle.dispatchEvent(new Event('change'));
                }
            } else if (key >= '1' && key <= '6') {
                const tabs = document.querySelectorAll('.pattern-tab');
                const idx = parseInt(key) - 1;
                if (tabs[idx]) tabs[idx].click();
            }
        };
        window.addEventListener('keydown', this.keydownHandler);
        
        // Tip Carousel Initialization
        this.tips = [
            "基础：划动手指即可在三维空间内拨动弦发出声音。",
            "进阶：开启“手势绘制”后，捏合双指（食指与拇指）可绘制发光曲线。",
            "破坏：伸出食指与中指（剪刀手），即可剪断悬浮的物理弦！",
            "录影：点击系统面板的“开始录制”，可捕捉带声音的 10 秒全息影像。",
            "艺术：在控制台尝试切换“赛博”与“水墨”两种截然不同的渲染风格。"
        ];
        this.currentTipIndex = 0;
        this.tipsTimer = setInterval(() => {
            const tipEl = document.getElementById('quick-tips-text');
            if (tipEl) {
                this.currentTipIndex = (this.currentTipIndex + 1) % this.tips.length;
                tipEl.style.transition = 'opacity 0.4s ease-in-out';
                tipEl.style.opacity = '0';
                setTimeout(() => {
                    tipEl.innerText = this.tips[this.currentTipIndex];
                    tipEl.style.opacity = '1';
                }, 400);
            }
        }, 8000);

        this.bindEvents();
        this.applyStyle(this.state.artStyle || 'cyberpunk'); // initial style

        // Permanent ink stain offscreen canvas (水墨永久墨渍画布)
        this.inkStainCanvas = document.createElement('canvas');
        this.inkStainCtx = this.inkStainCanvas.getContext('2d');

        // Task 14: Pre-generate 3 organic ink mask canvases for transition overlay
        this._inkMaskCanvases = [];
        for (let m = 0; m < 3; m++) {
            const maskC = document.createElement('canvas');
            maskC.width = 256;
            maskC.height = 256;
            const maskCtx = maskC.getContext('2d');
            maskCtx.fillStyle = 'rgba(0,0,0,1)';
            maskCtx.beginPath();
            const mcx = 128, mcy = 128, baseR = 100;
            // Base circle via arc
            maskCtx.arc(mcx, mcy, baseR, 0, Math.PI * 2);
            // Random bumps along edge using additional arcs for irregular outline
            for (let b = 0; b < 14; b++) {
                const ba = Math.random() * Math.PI * 2;
                const br = baseR * (0.75 + Math.random() * 0.35);
                const bumpR = 10 + Math.random() * 22;
                const bx = mcx + Math.cos(ba) * br;
                const by = mcy + Math.sin(ba) * br;
                maskCtx.moveTo(bx + bumpR, by);
                maskCtx.arc(bx, by, bumpR, 0, Math.PI * 2);
            }
            maskCtx.fill();
            this._inkMaskCanvases.push(maskC);
        }

        this.resizeCanvas();
        this.setupMediaPipe();
        this._boundRenderFrame = this.renderFrame.bind(this);
        this.startRenderLoop();

        this.resizeHandler = () => {
            this.resizeCanvas();
            if (challenge.active) {
                challenge.loadLevel(this.canvas.width, this.canvas.height);
            }
            // Task D: refresh cached button rects after layout changes
            this._refreshActionBtnRects?.();
        };
        window.addEventListener('resize', this.resizeHandler);

        // Gesture to unlock AudioContext (Task A+E: named handler with try-catch)
        this.audioUnlockHandler = () => {
            try { synth.init(); } catch (e) { logger.log('Audio init failed: ' + (e && e.message ? e.message : e), 'error'); }
        };
        document.body.addEventListener('click', this.audioUnlockHandler, { once: true });

        // Task A: suspend/resume audio & video on tab visibility change
        this.visibilityHandler = () => {
            if (document.hidden) {
                try { synth.suspend?.(); } catch (e) {}
                if (this.video) { try { this.video.pause(); } catch (e) {} }
            } else {
                try { synth.resume?.(); } catch (e) {}
                if (this.video) { try { this.video.play().catch(() => {}); } catch (e) {} }
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);

        // Task A: cleanup on page unload
        this.beforeUnloadHandler = () => { this.destroy(); };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
    },

    async loadStyles() {
        try {
            const cyberRes = await fetch('styles/cyberpunk.json');
            this.styles.cyberpunk = await cyberRes.json();
            
            const inkRes = await fetch('styles/ink.json');
            this.styles.ink = await inkRes.json();
            logger.log('Art styles (Cyberpunk & Ink) loaded successfully', 'success');
        } catch (e) {
            logger.log('Failed to load style configurations. Check JSON formatting.', 'error');
            console.error(e);
        }
    },

    applyStyle(styleId) {
        if (!this.styles[styleId]) {
            const fallbackStyles = {
                cyberpunk: { canvas: { bgMode: 'webcam', stringStyle: 'neon', particleStyle: 'dust' }, audio: { timbre: 'synth' } },
                ink: { canvas: { bgMode: 'xuan-paper', stringStyle: 'ink', particleStyle: 'ink_drop' }, audio: { timbre: 'guzheng' } }
            };
            this.styles[styleId] = fallbackStyles[styleId] || {};
            logger.log(`Style config not loaded, using fallback for: ${styleId}`, 'warning');
        }
        const config = this.styles[styleId];
        const previousStyle = this.state.artStyle;
        this.state.artStyle = styleId;
        
        // Add style transition class for smooth animation
        document.body.classList.add('ink-mode-transitioning');
        setTimeout(() => document.body.classList.remove('ink-mode-transitioning'), 600);
        
        // --- Mode transition effects ---
        const canvas = document.getElementById('output-canvas');
        const transitioning = (previousStyle !== styleId) && (previousStyle === 'ink' || styleId === 'ink');
        if (transitioning) {
            document.body.style.pointerEvents = 'none';
        }
        
        if (styleId === 'ink' && previousStyle !== 'ink') {
            // Entering ink mode: paper unfold with clip-path expanding from center vertical line
            if (this.ctx && canvas) {
                this.ctx.save();
                this.ctx.fillStyle = '#f5ecd7';
                this.ctx.fillRect(0, 0, canvas.width, canvas.height);
                this.ctx.restore();
            }
            // Task 13: Dimension rift effect (0-600ms) — overlay canvas with diagonal light rays
            if (canvas) {
                const riftCanvas = document.createElement('canvas');
                riftCanvas.width = canvas.width;
                riftCanvas.height = canvas.height;
                riftCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1000;object-fit:contain;';
                const wrapper = canvas.parentElement;
                if (wrapper) {
                    wrapper.appendChild(riftCanvas);
                    this._drawRiftEffect(riftCanvas.getContext('2d'), riftCanvas);
                    setTimeout(() => { if (riftCanvas.parentNode) riftCanvas.parentNode.removeChild(riftCanvas); }, 600);
                    // Task 14: Organic ink mask diffusion (200-600ms) — after rift starts
                    this._animateInkMask(canvas, true);
                }
            }
            const container = document.getElementById('app-container');
            if (container) {
                container.style.clipPath = 'inset(0 50% 0 50%)';
                container.style.transition = 'clip-path 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
                requestAnimationFrame(() => {
                    container.style.clipPath = 'inset(0 0% 0 0%)';
                });
                setTimeout(() => {
                    container.style.clipPath = '';
                    container.style.transition = '';
                    document.body.style.pointerEvents = '';
                }, 700);
            } else {
                document.body.style.pointerEvents = '';
            }
            if (typeof synth !== 'undefined' && synth.playTransitionSound) {
                try { synth.playTransitionSound('rift'); } catch(e) {}
            }
        } else if (styleId !== 'ink' && previousStyle === 'ink') {
            // Exiting ink mode: clip-path collapse + scatter particles
            // Task 13: Dimension rift effect for exiting ink
            if (canvas) {
                const riftCanvas = document.createElement('canvas');
                riftCanvas.width = canvas.width;
                riftCanvas.height = canvas.height;
                riftCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1000;object-fit:contain;';
                const wrapper = canvas.parentElement;
                if (wrapper) {
                    wrapper.appendChild(riftCanvas);
                    this._drawRiftEffect(riftCanvas.getContext('2d'), riftCanvas);
                    setTimeout(() => { if (riftCanvas.parentNode) riftCanvas.parentNode.removeChild(riftCanvas); }, 600);
                    // Task 14: Organic ink mask diffusion (reverse) - animate paper color on exit
                    this._animateInkMask(canvas, false);
                }
            }
            const container = document.getElementById('app-container');
            if (container) {
                container.style.clipPath = 'inset(0 0 0 0)';
                container.style.opacity = '1';
                container.style.transition = 'clip-path 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s ease';
                requestAnimationFrame(() => {
                    container.style.clipPath = 'inset(50% 50% 50% 50%)';
                    container.style.opacity = '0.3';
                });
                setTimeout(() => {
                    container.style.clipPath = '';
                    container.style.opacity = '';
                    container.style.transition = '';
                    document.body.style.pointerEvents = '';
                }, 700);
            } else {
                document.body.style.pointerEvents = '';
            }
            if (canvas) {
                for (let i = 0; i < 80; i++) {
                    const x = Math.random() * canvas.width;
                    const y = Math.random() * canvas.height;
                    particles.spawn(x, y, 'rgba(26,26,26,0.6)', 2, 'ink-collision');
                }
            }
            // Clear permanent ink stain canvas when leaving ink mode
            if (this.inkStainCtx && this.inkStainCanvas) {
                this.inkStainCtx.clearRect(0, 0, this.inkStainCanvas.width, this.inkStainCanvas.height);
            }
            if (typeof synth !== 'undefined' && synth.playTransitionSound) {
                try { synth.playTransitionSound('rift'); } catch(e) {}
            }
        } else if (!transitioning) {
            // No transition needed
        }
        
        // Update DOM body class for CSS variables
        if (styleId === 'ink') {
            document.body.classList.add('ink-mode');
            const inkSig = document.getElementById('ink-signature');
            if (inkSig) inkSig.classList.add('show');
            
            const styleInk = document.getElementById('style-ink');
            if (styleInk) styleInk.classList.add('active');
            const styleCyber = document.getElementById('style-cyber');
            if (styleCyber) styleCyber.classList.remove('active');
            
            // Ink Default Audio: Bianzhong (编钟)
            const audioSelect = document.getElementById('synth-waveform');
            if (audioSelect) audioSelect.value = 'bianzhong';
        } else {
            document.body.classList.remove('ink-mode');
            const inkSig = document.getElementById('ink-signature');
            if (inkSig) inkSig.classList.remove('show');
            
            const styleCyber = document.getElementById('style-cyber');
            if (styleCyber) styleCyber.classList.add('active');
            const styleInk = document.getElementById('style-ink');
            if (styleInk) styleInk.classList.remove('active');
            
            // Cyber Default Audio: Glockenspiel (风铃/钟琴)
            const audioSelect = document.getElementById('synth-waveform');
            if (audioSelect) audioSelect.value = 'glockenspiel';
        }
        
        // UI
        // Panel title is controlled by index.html span structure and CSS, no JS setting needed
        
        // Canvas mappings
        this.state.bgMode = config.canvas.backgroundMode;
        this.state.canvasBgColor = config.canvas.backgroundColor;
        this.state.stringStyle = config.canvas.stringStyle;
        this.state.particleStyle = config.canvas.particleStyle;
        this.state.particleShape = config.canvas.particleShape;
        this.state.colorTheme = config.canvas.defaultColorTheme;
        this.state.glowStrength = config.canvas.glowStrength;
        this.state.stringWidth = config.canvas.stringWidth;
        if (config.canvas.inkDensity !== undefined) {
            this.state.inkDensity = config.canvas.inkDensity;
        }
        
        // Audio mappings
        this.state.timbre = config.audio.defaultSynth;
        synth.waveform = config.audio.defaultSynth;
        this.state.enablePad = config.audio.enablePad;
        synth.padEnabled = config.audio.enablePad;
        
        // Sync UI inputs with programmatic state updates
        this.syncUIWithState();
        this.processFrame();
        logger.log(`Switched to art style: ${config.name}`, 'info');
    },

    syncUIWithState() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.syncUIWithState());
            return;
        }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        const setChecked = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val;
        };
        
        setVal('bg-mode', this.state.bgMode);
        setVal('color-canvas-bg', this.state.canvasBgColor);
        setVal('select-string-style', this.state.stringStyle);
        setVal('select-particle-style', this.state.particleStyle);
        setVal('select-particle-shape', this.state.particleShape);
        setVal('string-color-theme', this.state.colorTheme);
        setVal('slider-glow-strength', this.state.glowStrength);
        const glowDisplay = document.getElementById('slider-glow-strength')?.nextElementSibling;
        if (glowDisplay) glowDisplay.innerText = this.state.glowStrength;
        setVal('synth-waveform', this.state.timbre);
        setChecked('toggle-pad', this.state.enablePad);
        setChecked('toggle-webcam', this.state.showWebcam);
        const brushStyleEl = document.getElementById('select-brush-style');
        if (brushStyleEl) brushStyleEl.value = this.state.brushStyle || 'xing';
        
        // Physics Sliders
        const setValAndText = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                if (el.nextElementSibling) el.nextElementSibling.innerText = val;
            }
        };
        setValAndText('slider-gravity-strength', this.state.gravityStrength);
        setValAndText('slider-tension', this.state.tension);
        setValAndText('slider-damping', this.state.damping);
        setValAndText('slider-toughness', this.state.toughness);
        
        // Active Preset Button State
        const presetBtns = document.querySelectorAll('.preset-slots .icon-btn');
        presetBtns.forEach(btn => {
            // Find current preset button matching our state
            // If none match exactly, we leave them all unactive
            // For now, loadPreset triggers this, we could map a preset id in state
        });
        
        // Trigger visibility changes for background uploads if needed
        const bgUploadRow = document.getElementById('bg-upload-row');
        const bgColorRow = document.getElementById('bg-color-row');
        if (this.state.bgMode === 'color' && bgColorRow) {
            bgColorRow.classList.remove('hidden');
            if (bgUploadRow) bgUploadRow.classList.add('hidden');
        } else if (bgUploadRow && bgColorRow) {
            bgColorRow.classList.add('hidden');
            bgUploadRow.classList.add('hidden');
        }

        const caliGroup = document.getElementById('ink-calligraphy-settings');
        if (caliGroup) {
            caliGroup.style.display = this.state.artStyle === 'ink' ? 'flex' : 'none';
        }
    },

    resizeCanvas() {
        this.canvas.style.opacity = '0';
        setTimeout(() => {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
            this.canvas.style.opacity = '';
            // Sync ink stain canvas dimensions
            if (this.inkStainCanvas && (this.inkStainCanvas.width !== this.canvas.width || this.inkStainCanvas.height !== this.canvas.height)) {
                this.inkStainCanvas.width = this.canvas.width;
                this.inkStainCanvas.height = this.canvas.height;
            }
        }, 150);
        logger.log(`Workspace canvas calibrated: ${this.canvas.clientWidth}x${this.canvas.clientHeight}`, 'info');
    },

    // Expose permanent ink stain context to particles.js / physics.js
    getInkStainCtx() {
        return this.inkStainCtx || null;
    },
    
    xuanNoisePattern: null,
    
    generateXuanNoise() {
        if (!this.xuanNoisePattern) {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const noiseCtx = canvas.getContext('2d');

            // Warm radial gradient base: center white-ish, edges yellow-ish
            const radGrad = noiseCtx.createRadialGradient(size/2, size/2, 20, size/2, size/2, size*0.7);
            radGrad.addColorStop(0, '#f8f2e6');
            radGrad.addColorStop(1, '#f0e4c8');
            noiseCtx.fillStyle = radGrad;
            noiseCtx.fillRect(0, 0, size, size);

            // Pixel noise base
            const imgData = noiseCtx.getImageData(0, 0, size, size);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (Math.random() < 0.18) {
                    const noise = Math.random() * 25;
                    data[i] = 245 - noise;
                    data[i+1] = 236 - noise;
                    data[i+2] = 215 - noise;
                }
            }
            noiseCtx.putImageData(imgData, 0, 0);

            // --- Layer 1: Paper fibers (纤维层) with curtain-line directionality ---
            // 70% near-horizontal (±15°), 30% random direction
            for (let f = 0; f < 25; f++) {
                noiseCtx.save();
                const alpha = 0.05 + Math.random() * 0.03;
                noiseCtx.strokeStyle = `rgba(${170 + Math.random()*20}, ${150 + Math.random()*20}, ${120 + Math.random()*20}, ${alpha})`;
                noiseCtx.lineWidth = 0.5 + Math.random() * 0.8;
                noiseCtx.beginPath();
                const sx = Math.random() * size;
                const sy = Math.random() * size;
                let angle;
                if (Math.random() < 0.7) {
                    // Near-horizontal: ±15° around 0 or π
                    angle = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * (Math.PI / 6);
                } else {
                    angle = Math.random() * Math.PI;
                }
                const len = 30 + Math.random() * 60;
                noiseCtx.moveTo(sx, sy);
                noiseCtx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
                noiseCtx.stroke();
                noiseCtx.restore();
            }

            // --- Layer 2: Water stains (水渍层) - 5-8 feathered radial gradients ---
            const waterCount = 5 + Math.floor(Math.random() * 4);
            for (let w = 0; w < waterCount; w++) {
                noiseCtx.save();
                const wx = Math.random() * size;
                const wy = Math.random() * size;
                const wr = 20 + Math.random() * 40;
                const wAlpha = 0.06 + Math.random() * 0.04;
                const wg = noiseCtx.createRadialGradient(wx, wy, 0, wx, wy, wr);
                wg.addColorStop(0, `rgba(220,210,190,${wAlpha})`);
                wg.addColorStop(1, 'rgba(220,210,190,0)');
                noiseCtx.fillStyle = wg;
                noiseCtx.beginPath();
                noiseCtx.arc(wx, wy, wr, 0, Math.PI * 2);
                noiseCtx.fill();
                noiseCtx.restore();
            }

            // --- Layer 3: Dried ink ring stains (墨渍层) - 3-5 thin ring strokes ---
            const inkRingCount = 3 + Math.floor(Math.random() * 3);
            for (let m = 0; m < inkRingCount; m++) {
                noiseCtx.save();
                const mx = Math.random() * size;
                const my = Math.random() * size;
                const mr = 5 + Math.random() * 10;
                const mAlpha = 0.04 + Math.random() * 0.03;
                noiseCtx.strokeStyle = `rgba(100,80,60,${mAlpha})`;
                noiseCtx.lineWidth = 1 + Math.random();
                noiseCtx.beginPath();
                noiseCtx.arc(mx, my, mr, 0, Math.PI * 2);
                noiseCtx.stroke();
                noiseCtx.restore();
            }

            // Edge roughness: noisy strips along all 4 edges
            const edgeW = 6;
            for (let edge = 0; edge < 4; edge++) {
                for (let i = 0; i < 40; i++) {
                    const alpha = Math.random() * 0.06;
                    noiseCtx.fillStyle = `rgba(180,160,130,${alpha})`;
                    let ex, ey, ew, eh;
                    if (edge === 0) { ex = Math.random()*size; ey = 0; ew = 2+Math.random()*3; eh = edgeW; }
                    else if (edge === 1) { ex = Math.random()*size; ey = size-edgeW; ew = 2+Math.random()*3; eh = edgeW; }
                    else if (edge === 2) { ex = 0; ey = Math.random()*size; ew = edgeW; eh = 2+Math.random()*3; }
                    else { ex = size-edgeW; ey = Math.random()*size; ew = edgeW; eh = 2+Math.random()*3; }
                    noiseCtx.fillRect(ex, ey, ew, eh);
                }
            }

            this.xuanNoisePattern = this.ctx.createPattern(canvas, 'repeat');
        }
        return this.xuanNoisePattern;
    },

    // --- Global State Persistence ---
    saveGlobalState: debounce(function() {
        // Exclude image object which cannot be stringified
        const { customBgImage, ...serializableState } = this.state;
        localStorage.setItem('cats_cradle_global_state', JSON.stringify(serializableState));
    }, 300),
    
    loadGlobalState() {
        const data = localStorage.getItem('cats_cradle_global_state');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.state = Object.assign({}, this.state, parsed);
                this.state.showWebcam = true;
                logger.log('Global configuration restored from local storage.', 'success');
            } catch (e) {
                logger.log('Failed to parse saved global state.', 'warning');
            }
        }
    },

    // --- Presets & LocalStorage ---
    updatePresetUI() {
        for (let i = 1; i <= 3; i++) {
            const slot = document.querySelector(`.preset-slot[data-slot="${i}"]`);
            if (!slot) continue;
            const loadBtn = slot.querySelector('.load-preset-btn');
            const data = localStorage.getItem(`cats_cradle_preset_${i}`);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    loadBtn.innerText = `槽位 ${i}: [${parsed.artStyle === 'ink' ? '水墨' : '赛博'}] 已存`;
                    loadBtn.style.color = '#00ffff';
                } catch (e) {
                    loadBtn.innerText = `槽位 ${i}: 空`;
                    loadBtn.style.color = '';
                }
            } else {
                loadBtn.innerText = `槽位 ${i}: 空`;
                loadBtn.style.color = '';
            }
        }
    },

    savePreset(slotNum) {
        const data = JSON.stringify(this.state);
        localStorage.setItem(`cats_cradle_preset_${slotNum}`, data);
        
        // UI Feedback: Checkmark
        const slotEl = document.querySelector(`.preset-slot[data-slot="${slotNum}"]`);
        if (slotEl) {
            const saveBtn = slotEl.querySelector('.save-preset-btn');
            const originalIcon = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { saveBtn.innerHTML = originalIcon; }, 500);
        }
        
        this.updatePresetUI();
        logger.log(`成功保存预设到槽位 ${slotNum}`, 'success');
        if (typeof synth !== 'undefined' && synth.playPluck) synth.playPluck(110);
    },

    loadPreset(slotNum) {
        const data = localStorage.getItem(`cats_cradle_preset_${slotNum}`);
        if (!data) return;
        try {
            const parsed = JSON.parse(data);
            this.state = Object.assign({}, this.state, parsed);
            // Sync UI state
            if (this.state.artStyle === 'ink' || this.state.artStyle === 'cyberpunk') {
                this.applyStyle(this.state.artStyle);
            }
            logger.log(`成功读取槽位 ${slotNum} 的预设`, 'success');
            if (typeof synth !== 'undefined' && synth.playPluck) synth.playPluck(100);
        } catch (e) {
            logger.log(`读取预设失败`, 'error');
        }
    },

    deletePreset(slotNum) {
        localStorage.removeItem(`cats_cradle_preset_${slotNum}`);
        
        // UI Feedback: "已删除..."
        const slotEl = document.querySelector(`.preset-slot[data-slot="${slotNum}"]`);
        if (slotEl) {
            const loadBtn = slotEl.querySelector('.load-preset-btn');
            loadBtn.innerText = "已删除...";
            setTimeout(() => { this.updatePresetUI(); }, 400);
        } else {
            this.updatePresetUI();
        }
        
        logger.log(`已清空槽位 ${slotNum}`, 'info');
    },

    bindEvents() {
        // Toggle Sidebar
        document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
            this.sidebar.classList.toggle('hidden');
        });
        document.getElementById('close-sidebar-btn').addEventListener('click', () => {
            this.sidebar.classList.add('hidden');
        });

        // Sidebar Details State Memory
        document.querySelectorAll('.sidebar details').forEach((details, idx) => {
            const key = `cats_cradle_drawer_${idx}`;
            const state = localStorage.getItem(key);
            if (state !== null) details.open = state === 'true';
            details.addEventListener('toggle', () => {
                localStorage.setItem(key, details.open);
            });
        });

        // Preset Bindings
        document.querySelectorAll('.preset-slot').forEach(slot => {
            const num = slot.dataset.slot;
            slot.querySelector('.save-preset-btn').addEventListener('click', () => this.savePreset(num));
            slot.querySelector('.load-preset-btn').addEventListener('click', () => this.loadPreset(num));
            slot.querySelector('.delete-preset-btn').addEventListener('click', () => this.deletePreset(num));
        });
        this.updatePresetUI();

        // Art Style Toggle
        const btnCyber = document.getElementById('style-cyber');
        const btnInk = document.getElementById('style-ink');
        if (btnCyber) {
            btnCyber.addEventListener('click', () => { this.applyStyle('cyberpunk'); });
        }
        if (btnInk) {
            btnInk.addEventListener('click', () => { this.applyStyle('ink'); });
        }

        // Calligraphy inputs
        document.getElementById('select-poetry')?.addEventListener('change', (e) => {
            this.state.poetryMode = e.target.value;
            const customRow = document.getElementById('custom-poetry-row');
            if (customRow) customRow.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });
        document.getElementById('input-custom-poetry')?.addEventListener('input', (e) => {
            this.state.customPoetry = e.target.value;
        });
        document.getElementById('input-signature')?.addEventListener('input', (e) => {
            this.state.signature = e.target.value;
        });
        
        // Tabs Switching logic removed for Drawer UI
        
        // Background Mode
        const bgModeSelect = document.getElementById('bg-mode');
        const bgUploadRow = document.getElementById('bg-upload-row');
        const bgColorRow = document.getElementById('bg-color-row');
        const customBgUpload = document.getElementById('custom-bg-upload');
        const customBgFilename = document.getElementById('custom-bg-filename');
        
        bgModeSelect.addEventListener('change', (e) => {
            this.state.bgMode = e.target.value;
            if (e.target.value === 'custom') {
                bgUploadRow.classList.remove('hidden');
                bgColorRow.classList.add('hidden');
                logger.log('Custom background active. Awaiting image upload...', 'info');
            } else if (e.target.value === 'color') {
                bgUploadRow.classList.add('hidden');
                bgColorRow.classList.remove('hidden');
                logger.log('Custom background color active.', 'info');
                this.processFrame();
            } else {
                bgUploadRow.classList.add('hidden');
                bgColorRow.classList.add('hidden');
                logger.log(`Background mode set to: ${e.target.value}`, 'info');
            }
        });

        document.getElementById('color-canvas-bg').addEventListener('input', (e) => {
            this.state.canvasBgColor = e.target.value;
            this.processFrame();
        });

        customBgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                customBgFilename.innerText = file.name;
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.src = url;
                img.onload = () => {
                    this.state.customBgImage = img;
                    logger.log(`Custom background image loaded: ${file.name}`, 'success');
                };
            }
        });

        // Mode Switch (Free play vs Challenge)
        const modeFree = document.getElementById('mode-freeplay');
        const modeChall = document.getElementById('mode-challenge');
        const challHud = document.getElementById('challenge-hud');
        const tipsText = document.getElementById('quick-tips-text');

        modeFree.addEventListener('click', () => {
            if(modeFree.classList.contains('active')) return;
            modeFree.classList.add('active');
            modeChall.classList.remove('active');
            challenge.active = false;
            challHud.classList.add('hidden');
            document.getElementById('success-banner').classList.add('hidden');
            tipsText.innerText = '划动手指穿过绳子可拨动发声；开启“剪刀手”模式后，特定手势（如食指中指夹合）可剪断绳子。';
            logger.log('Operation mode set to: Free Play', 'info');
            this.triggerModeSwitchFlash();
        });

        modeChall.addEventListener('click', () => {
            if(modeChall.classList.contains('active')) return;
            modeChall.classList.add('active');
            modeFree.classList.remove('active');
            challenge.active = true;
            challenge.loadLevel(this.canvas.width, this.canvas.height);
            challHud.classList.remove('hidden');
            tipsText.innerText = '根据屏幕虚线引导，张开双手，移动五指至金色发光环圈重合！进度条满即可通关！';
            logger.log('Operation mode set to: Shape Challenge', 'info');
            this.triggerModeSwitchFlash();
        });

        // Pattern Selection Tabs
        const tabs = document.querySelectorAll('.pattern-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                const targetTab = e.currentTarget;
                targetTab.classList.add('active');
                this.state.pattern = targetTab.dataset.pattern;
                logger.log(`Visual pattern changed to: ${targetTab.querySelector('.label').innerText}`, 'success');
            });
        });

        // Config Sliders & Inputs
        const bindSlider = (id, stateKey, parser = parseFloat) => {
            const input = document.getElementById(id);
            if (!input) return;
            const display = input.nextElementSibling;
            input.addEventListener('input', (e) => {
                const val = parser(e.target.value);
                this.state[stateKey] = val;
                if (display && display.classList.contains('val-display')) {
                    display.innerText = val;
                    display.style.transition = 'transform 0.1s ease-out';
                    display.style.transform = 'scale(1.3)';
                    clearTimeout(display.bumpTimeout);
                    display.bumpTimeout = setTimeout(() => {
                        display.style.transform = 'scale(1)';
                    }, 150);
                }
                this.updateSliderFill?.(input);
                this.saveGlobalState();
            });
        };

        bindSlider('slider-glow-strength', 'glowStrength', parseInt);
        bindSlider('slider-string-width', 'stringWidth', parseFloat);
        bindSlider('slider-ink-density', 'inkDensity', parseFloat);
        bindSlider('slider-gravity-strength', 'gravityStrength', parseFloat);
        bindSlider('slider-pluck-sensitivity', 'pluckSensitivity', parseInt);
        bindSlider('slider-tension', 'tension', parseInt);
        bindSlider('slider-toughness', 'toughness', parseInt);
        bindSlider('slider-particle-count', 'particleCount', parseInt);
        bindSlider('slider-particle-speed', 'particleSpeed', parseFloat);
        bindSlider('slider-particle-size', 'particleSize', parseFloat);
        bindSlider('slider-fill-opacity', 'fillOpacity', parseFloat);
        bindSlider('slider-particle-glow', 'particleGlow', parseInt);
        bindSlider('slider-particle-lifespan', 'particleLifespan', parseFloat);
        bindSlider('slider-ripple-size', 'fingerRippleSize', parseInt);
        
        // Gravity Engine select
        document.getElementById('gravity-engine').addEventListener('change', (e) => {
            this.state.gravityEngine = e.target.value;
            logger.log(`Gravity Engine switched to: ${e.target.options[e.target.selectedIndex].text}`, 'warning');
        });

        // Particle Trajectory select
        document.getElementById('select-particle-trajectory').addEventListener('change', (e) => {
            this.state.particleTrajectory = e.target.value;
            logger.log(`Particle trajectory path set to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Timbre wave select
        document.getElementById('synth-waveform').addEventListener('change', (e) => {
            this.state.timbre = e.target.value;
            synth.waveform = e.target.value;
            logger.log(`Synthesizer sound timbre set to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Line Style select
        document.getElementById('select-string-style').addEventListener('change', (e) => {
            this.state.stringStyle = e.target.value;
            logger.log(`String style set to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Brush Style select
        const brushStyleSelect = document.getElementById('select-brush-style');
        if (brushStyleSelect) {
            brushStyleSelect.addEventListener('change', (e) => {
                this.state.brushStyle = e.target.value;
            });
        }

        // Particle Style select
        document.getElementById('select-particle-style').addEventListener('change', (e) => {
            this.state.particleStyle = e.target.value;
            logger.log(`Particle style set to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Particle Shape select
        document.getElementById('select-particle-shape').addEventListener('change', (e) => {
            this.state.particleShape = e.target.value;
            logger.log(`Particle shape set to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Particle Color Type select
        document.getElementById('select-particle-color').addEventListener('change', (e) => {
            this.state.particleColorType = e.target.value;
            const customRow = document.getElementById('particle-custom-color-row');
            if (e.target.value === 'custom') {
                customRow.classList.remove('hidden');
            } else {
                customRow.classList.add('hidden');
            }
            logger.log(`Particle color mode set to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Custom Particle Color input
        document.getElementById('color-particle').addEventListener('input', (e) => {
            this.state.particleCustomColor = e.target.value;
        });

        // Fill Color pickers binding
        document.getElementById('color-fill').addEventListener('input', (e) => {
            this.state.fillColor = e.target.value;
        });

        // Dropdowns & Checkboxes
        document.getElementById('string-color-theme').addEventListener('change', (e) => {
            const theme = e.target.value;
            this.state.colorTheme = theme;
            
            const pickers = document.getElementById('custom-color-pickers');
            if (theme === 'custom') {
                pickers.classList.remove('hidden');
            } else {
                pickers.classList.add('hidden');
            }
            logger.log(`Visual color theme set to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });

        // Custom Color pickers binding
        document.getElementById('color-string').addEventListener('input', (e) => {
            this.state.customStringColor = e.target.value;
            if (this.state.colorTheme === 'custom') {
                logger.log(`Custom string color: ${e.target.value}`, 'info');
            }
        });
        document.getElementById('color-joints').addEventListener('input', (e) => {
            this.state.customJointColor = e.target.value;
            if (this.state.colorTheme === 'custom') {
                logger.log(`Custom hand joints color: ${e.target.value}`, 'info');
            }
        });

        const bindCheckbox = (id, stateKey, callback) => {
            const cb = document.getElementById(id);
            if (!cb) return;
            cb.addEventListener('change', (e) => {
                this.state[stateKey] = e.target.checked;
                if (callback) callback(e.target.checked);
                this.saveGlobalState();
            });
        };

        bindCheckbox('toggle-webcam', 'showWebcam', (checked) => {
            logger.log(`Camera video display ${checked ? 'enabled' : 'hidden'}`, 'info');
        });
        bindCheckbox('toggle-mirror', 'mirror', (checked) => {
            logger.log(`Horizontal mirror projection ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-audio', 'enableAudio', (checked) => {
            synth.enabled = checked;
            logger.log(`Synth pluck audio feedback ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-pad', 'enablePad', (checked) => {
            synth.padEnabled = checked;
            logger.log(`Ambient continuous pad chord drone ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-pluck', 'enablePluck', (checked) => {
            logger.log(`Fingertip plucking collision physics ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-cut', 'enableCut', (checked) => {
            logger.log(`Double finger scissor/pinch cutting physics ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-draw-mode', 'drawMode', (checked) => {
            logger.log(`Gesture straight line drawing mode ${checked ? 'enabled (pinch thumb & index to draw)' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-skeleton', 'showSkeleton', (checked) => {
            logger.log(`Holographic hand skeleton display ${checked ? 'enabled' : 'hidden'}`, 'info');
        });
        bindCheckbox('toggle-absolute-straight', 'absoluteStraight', (checked) => {
            logger.log(`Absolute straight mode ${checked ? 'enabled (overriding physics)' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-fill-loops', 'fillLoops', (checked) => {
            const settings = document.getElementById('loop-fill-settings');
            if (checked) settings.classList.remove('hidden');
            else settings.classList.add('hidden');
            logger.log(`Closed shape auto-fill ${checked ? 'enabled' : 'disabled'}`, 'info');
            this.processFrame();
        });
        bindCheckbox('toggle-convex-polygon', 'convexPolygonMode', (checked) => {
            const settings = document.getElementById('convex-polygon-settings');
            if (checked) settings.style.display = 'flex';
            else settings.style.display = 'none';
            logger.log(`Convex polygon mode ${checked ? 'enabled' : 'disabled'}`, 'info');
            this.processFrame();
        });
        bindCheckbox('toggle-pure-mode', 'pureMode', (checked) => {
            logger.log(`Pure mode ${checked ? 'enabled' : 'disabled'}`, 'info');
            this.processFrame();
        });
        document.getElementById('color-convex-fill').addEventListener('input', (e) => {
            this.state.convexPolygonColor = e.target.value;
        });
        bindCheckbox('toggle-particles', 'particlesEnabled', (checked) => {
            logger.log(`Particle effects ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-never-break', 'neverBreak', (checked) => {
            logger.log(`Never-Break mode ${checked ? 'enabled (connections locked)' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-drop-on-lost', 'dropOnLost', (checked) => {
            logger.log(`String drop on tracking loss ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-particle-circle-spread', 'particleCircleSpread', (checked) => {
            logger.log(`Particle circular dispersion ${checked ? 'enabled' : 'disabled'}`, 'info');
        });
        bindCheckbox('toggle-finger-ripple', 'enableFingerRipple', (checked) => {
            const settings = document.getElementById('finger-ripple-settings');
            if (settings) {
                settings.style.display = checked ? 'flex' : 'none';
            }
            logger.log(`Finger joint ripple animation ${checked ? 'enabled' : 'disabled'}`, 'info');
            this.processFrame();
        });

        document.getElementById('color-finger-ripple')?.addEventListener('input', (e) => {
            this.state.fingerRippleColor = e.target.value;
            this.processFrame();
        });

        // Finger recognition bindings
        const bindFingerCheckbox = (id, fingerKey) => {
            document.getElementById(id).addEventListener('change', (e) => {
                this.state.enabledFingers[fingerKey] = e.target.checked;
                logger.log(`Finger recognition for ${fingerKey} ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
                this.processFrame();
            });
        };
        bindFingerCheckbox('finger-thumb', 'thumb');
        bindFingerCheckbox('finger-index', 'index');
        bindFingerCheckbox('finger-middle', 'middle');
        bindFingerCheckbox('finger-ring', 'ring');
        bindFingerCheckbox('finger-pinky', 'pinky');

        // Clear Drawings button
        document.getElementById('btn-clear-drawings').addEventListener('click', () => {
            // Drawing state
            this.drawings = [];
            this._drawingsDirty = true; // Task 18: invalidate closed-loop cache
            this.activeDrawings = { Left: null, Right: null };
            this.cutFlashes = [];
            this.handLostTimer = null;
            logger.log('Hand-drawn canvas cleared.', 'warning');
            this.processFrame();
        });

        // Playlist and Crossfade State
        this.playlist = [];
        this.currentTrackIndex = -1;
        this.bgmAudio1 = new Audio();
        this.bgmAudio2 = new Audio();
        this.activeBgm = this.bgmAudio1;
        
        const fileInput = document.getElementById('bgm-upload');
        const playlistUI = document.getElementById('bgm-playlist');
        const btnPlayBgm = document.getElementById('btn-play-bgm');
        const btnPauseBgm = document.getElementById('btn-pause-bgm');
        const bgmVolume = document.getElementById('slider-bgm-volume');
        
        const renderPlaylist = () => {
            if (!playlistUI) return;
            if (this.playlist.length === 0) {
                playlistUI.innerHTML = '<li style="padding: 6px; color: var(--text-secondary); text-align: center; font-size: 12px;">暂无文件，请导入</li>';
                return;
            }
            playlistUI.innerHTML = '';
            this.playlist.forEach((file, index) => {
                const li = document.createElement('li');
                li.draggable = true;
                li.style.padding = '6px';
                li.style.borderBottom = '1px solid rgba(160,82,45,0.1)';
                li.style.cursor = 'grab';
                li.style.fontSize = '12px';
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                if (index === this.currentTrackIndex) {
                    li.style.color = '#c8483c'; // 朱砂红 active state
                    li.style.fontWeight = 'bold';
                    
                    const icon = document.createElement('div');
                    icon.className = 'bgm-playing-icon';
                    icon.innerHTML = '<span></span><span></span><span></span>';
                    li.prepend(icon);
                }
                
                const nameSpan = document.createElement('span');
                nameSpan.innerText = file.name;
                nameSpan.style.flex = '1';
                nameSpan.style.overflow = 'hidden';
                nameSpan.style.textOverflow = 'ellipsis';
                nameSpan.style.whiteSpace = 'nowrap';
                
                const delBtn = document.createElement('i');
                delBtn.className = 'fa-solid fa-times';
                delBtn.style.cursor = 'pointer';
                delBtn.style.padding = '0 8px';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.playlist.splice(index, 1);
                    if (index === this.currentTrackIndex) {
                        this.activeBgm.pause();
                        this.currentTrackIndex = -1;
                        if (this.playlist.length > 0) playTrack(0);
                    } else if (index < this.currentTrackIndex) {
                        this.currentTrackIndex--;
                    }
                    renderPlaylist();
                };
                
                li.appendChild(nameSpan);
                li.appendChild(delBtn);
                
                li.ondblclick = () => playTrack(index);
                
                // Drag and drop sorting
                li.ondragstart = (e) => { e.dataTransfer.setData('text/plain', index); li.style.opacity = '0.5'; };
                li.ondragend = () => { li.style.opacity = '1'; };
                li.ondragover = (e) => e.preventDefault();
                li.ondrop = (e) => {
                    e.preventDefault();
                    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIdx = index;
                    if (fromIdx !== toIdx) {
                        const [movedItem] = this.playlist.splice(fromIdx, 1);
                        this.playlist.splice(toIdx, 0, movedItem);
                        if (this.currentTrackIndex === fromIdx) this.currentTrackIndex = toIdx;
                        else if (this.currentTrackIndex > fromIdx && this.currentTrackIndex <= toIdx) this.currentTrackIndex--;
                        else if (this.currentTrackIndex < fromIdx && this.currentTrackIndex >= toIdx) this.currentTrackIndex++;
                        renderPlaylist();
                    }
                };
                
                playlistUI.appendChild(li);
            });
        };

        const playTrack = (index) => {
            if (this.playlist.length === 0) return;
            this.currentTrackIndex = index % this.playlist.length;
            const file = this.playlist[this.currentTrackIndex];
            const url = URL.createObjectURL(file);
            
            const nextBgm = this.activeBgm === this.bgmAudio1 ? this.bgmAudio2 : this.bgmAudio1;
            nextBgm.src = url;
            nextBgm.volume = 0;
            nextBgm.play().catch(e => logger.log('BGM playback prevented by browser auto-play policy.', 'warning'));
            
            // Crossfade 1.5 seconds
            const targetVol = this.state.bgmVolume || 0.5;
            let step = 0;
            const fadeInterval = setInterval(() => {
                step += 0.05;
                if (step >= 1) {
                    clearInterval(fadeInterval);
                    this.activeBgm.pause();
                    this.activeBgm = nextBgm;
                    this.activeBgm.volume = targetVol;
                    this.bgm = this.activeBgm; // Update legacy reference
                } else {
                    nextBgm.volume = step * targetVol;
                    if (!this.activeBgm.paused) this.activeBgm.volume = (1 - step) * targetVol;
                }
            }, 75);
            
            renderPlaylist();
            logger.log(`Playing: ${file.name}`, 'info');
            
            nextBgm.onended = () => {
                playTrack(this.currentTrackIndex + 1);
            };
        };

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    for(let file of e.target.files) {
                        this.playlist.push(file);
                    }
                    if (btnPlayBgm) btnPlayBgm.disabled = false;
                    if (btnPauseBgm) btnPauseBgm.disabled = false;
                    renderPlaylist();
                    if (this.currentTrackIndex === -1) {
                        playTrack(0);
                    }
                }
            });
        }

        if (btnPlayBgm) {
            btnPlayBgm.addEventListener('click', () => {
                if (this.playlist.length > 0) {
                    if (this.activeBgm.paused && this.activeBgm.src) {
                        this.activeBgm.play();
                    } else {
                        playTrack(this.currentTrackIndex + 1); // Skip to next
                    }
                }
            });
        }

        if (btnPauseBgm) {
            btnPauseBgm.addEventListener('click', () => {
                this.activeBgm.pause();
                logger.log('BGM paused.', 'info');
            });
        }

        if (bgmVolume) {
            bgmVolume.addEventListener('input', (e) => {
                const vol = parseFloat(e.target.value);
                this.activeBgm.volume = vol;
                this.state.bgmVolume = vol;
                if(e.target.nextElementSibling) e.target.nextElementSibling.innerText = vol;
            });
        }

        renderPlaylist();

        // Presets buttons selector
        const presetBtns = document.querySelectorAll('.preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.loadPreset(btn.dataset.preset);
            });
        });

        // Actions buttons
        document.getElementById('btn-record').addEventListener('click', () => this.toggleRecording());
        document.getElementById('btn-screenshot').addEventListener('click', () => this.takeScreenshot());
        document.getElementById('btn-reset').addEventListener('click', () => this.resetSettings());

        // Setup magnetic hover and micro-glow effects for all buttons and sliders
        const setupMagneticUI = () => {
            const buttons = document.querySelectorAll('.action-btn, .secondary-btn, .tab-btn, .preset-btn, .file-upload-btn, .pattern-tab, #toggle-sidebar-btn');
            buttons.forEach(el => {
                el.addEventListener('mousemove', (e) => {
                    if (e.buttons > 0) return; // Disable during click/drag
                    const rect = el.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    el.style.setProperty('--mx', `${x}px`);
                    el.style.setProperty('--my', `${y}px`);
                    
                    const dx = x - rect.width / 2;
                    const dy = y - rect.height / 2;
                    el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.22}px)`;
                });
                el.addEventListener('mouseleave', () => {
                    el.style.transform = '';
                    el.style.removeProperty('--mx');
                    el.style.removeProperty('--my');
                });
            });

            const sliders = document.querySelectorAll('input[type="range"]');
            sliders.forEach(el => {
                el.addEventListener('mousemove', (e) => {
                    if (e.buttons > 0) return; // Disable during drag
                    const rect = el.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const dx = x - rect.width / 2;
                    const dy = y - rect.height / 2;
                    el.style.transform = `translate(${dx * 0.1}px, ${dy * 0.15}px)`;
                });
                el.addEventListener('mouseleave', () => {
                    el.style.transform = '';
                });
            });
        };
        setupMagneticUI();
    },

    loadPreset(presetName) {
        let gravity = 0.5, tension = 6, damping = 0.95, toughness = 5;
        let msg = '';

        if (presetName === 'space') {
            gravity = 0.04;
            tension = 3;
            damping = 0.98;
            toughness = 3;
            msg = 'Loaded Preset: Zero-G Float (太空飘浮)';
        } else if (presetName === 'water') {
            gravity = 0.08;
            tension = 4;
            damping = 0.84;
            toughness = 4;
            msg = 'Loaded Preset: Deep-Water Slow Mo (深海缓动)';
        } else if (presetName === 'elastic') {
            gravity = 0.15;
            tension = 13;
            damping = 0.96;
            toughness = 9;
            msg = 'Loaded Preset: Cyber Elastic Web (高张力绳)';
        } else {
            // earth (normal)
            gravity = 0.5;
            tension = 6;
            damping = 0.95;
            toughness = 5;
            msg = 'Loaded Preset: Earth Normal (地球常规)';
        }

        this.state.gravityStrength = gravity;
        this.state.tension = tension;
        this.state.damping = damping;
        this.state.toughness = toughness;

        this.state.toughness = toughness;

        // Sync to DOM Sliders via global UI sync
        this.syncUIWithState();

        logger.log(msg, 'warning');
    },

    resetSettings() {
        const DEFAULT_STATE = {
            pattern: 'star', showWebcam: true, showSkeleton: true, mirror: true,
            enableAudio: true, enablePad: true, enablePluck: true, enableCut: true,
            drawMode: false, toughness: 5, colorTheme: 'cyan-pink', glowStrength: 15,
            stringWidth: 3, physics: true, gravityEngine: 'down', gravityStrength: 0.5,
            pluckSensitivity: 5, bgMode: 'webcam', customBgImage: null,
            stringStyle: 'solid', absoluteStraight: false, fillLoops: true,
            fillColor: '#00ffff', fillOpacity: 0.3, convexPolygonMode: false, pureMode: false,
            artStyle: 'cyberpunk', inkDensity: 0.8, brushStyle: 'xing',
            poetryMode: 'auto', customPoetry: '', signature: '',
            enableFingerRipple: false, fingerRippleSize: 15, fingerRippleColor: '#00ffff',
            convexPolygonColor: '#ff00ff', particleStyle: 'auto', neverBreak: false,
            particlesEnabled: true, particleSize: 3.0,
            enabledFingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
            tension: 6, damping: 0.95, timbre: 'guzheng', particleCount: 3,
            particleSpeed: 1.0, particleLifespan: 3.0, particleTrajectory: 'explode',
            canvasBgColor: '#050608', dropOnLost: true, particleShape: 'circle',
            particleColorType: 'theme', particleCustomColor: '#00ffff', particleGlow: 0,
            particleCircleSpread: false, bgmVolume: 50
        };
        
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));

        // Sync Sliders
        const sliders = [
            { id: 'slider-glow-strength', val: this.state.glowStrength },
            { id: 'slider-gravity-strength', val: this.state.gravityStrength },
            { id: 'slider-pluck-sensitivity', val: this.state.pluckSensitivity },
            { id: 'slider-tension', val: this.state.tension },
            { id: 'slider-toughness', val: this.state.toughness },
            { id: 'slider-particle-count', val: this.state.particleCount },
            { id: 'slider-particle-speed', val: this.state.particleSpeed },
            { id: 'slider-string-width', val: this.state.stringWidth },
            { id: 'slider-particle-size', val: this.state.particleSize },
            { id: 'slider-bgm-volume', val: this.state.bgmVolume }
        ];

        sliders.forEach(r => {
            const el = document.getElementById(r.id);
            if (el) {
                el.value = r.val;
                if (el.nextElementSibling) el.nextElementSibling.innerText = r.val;
            }
        });
        
        // Sync Selects
        const selects = {
            'gravity-engine': this.state.gravityEngine,
            'select-particle-trajectory': this.state.particleTrajectory,
            'synth-waveform': this.state.timbre,
            'select-string-style': this.state.stringStyle,
            'string-color-theme': this.state.colorTheme,
            'bg-mode': this.state.bgMode
        };
        for (const [id, val] of Object.entries(selects)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }

        // Sync Checkboxes
        const checkboxes = {
            'toggle-absolute-straight': this.state.absoluteStraight,
            'toggle-never-break': this.state.neverBreak,
            'toggle-fill-loops': this.state.fillLoops,
            'toggle-convex-polygon': this.state.convexPolygonMode,
            'toggle-pure-mode': this.state.pureMode,
            'toggle-particles': this.state.particlesEnabled,
            'toggle-audio': this.state.enableAudio,
            'toggle-bgm': this.state.enablePad,
            'toggle-draw-mode': this.state.drawMode
        };
        for (const [id, val] of Object.entries(checkboxes)) {
            const el = document.getElementById(id);
            if (el) {
                el.checked = val;
                // Dispatch event to trigger side-effects like showing/hiding sections
                el.dispatchEvent(new Event('change'));
            }
        }
        
        // Sync Colors
        const colors = {
            'color-loop-fill': this.state.fillColor,
            'color-convex-fill': this.state.convexPolygonColor
        };
        for (const [id, val] of Object.entries(colors)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }

        synth.waveform = this.state.timbre;
        if (this.bgm) this.bgm.volume = this.state.bgmVolume / 100;
        
        logger.log('Reset simulator parameters to defaults.', 'warning');
    },

    takeScreenshot() {
        logger.log('Saving screen snap...', 'info');
        try {
            // Trigger clip-path scroll animation in ink mode
            if (this.state.artStyle === 'ink') {
                const layer = document.querySelector('.canvas-layer');
                if (layer) {
                    layer.classList.remove('scroll-unroll');
                    void layer.offsetWidth; // Reflow
                    layer.classList.add('scroll-unroll');
                }
            }

            let exportCanvas = this.canvas;
            
            // Dynamic Seal Stamping
            if (this.state.artStyle === 'ink') {
                const sigInput = document.getElementById('input-signature');
                const sigText = sigInput ? sigInput.value || '墨客' : '墨客';
                
                exportCanvas = document.createElement('canvas');
                exportCanvas.width = this.canvas.width;
                exportCanvas.height = this.canvas.height;
                const eCtx = exportCanvas.getContext('2d');
                eCtx.drawImage(this.canvas, 0, 0);
                
                eCtx.save();
                const sealW = 32;
                const sealH = 32;
                const rightMargin = 40;
                const bottomMargin = 40;
                const x = exportCanvas.width - rightMargin - sealW;
                const y = exportCanvas.height - bottomMargin - sealH;
                
                // Draw seal
                eCtx.strokeStyle = '#A0522D';
                eCtx.lineWidth = 2;
                eCtx.strokeRect(x, y, sealW, sealH);
                eCtx.fillStyle = 'rgba(160, 82, 45, 0.1)';
                eCtx.fillRect(x, y, sealW, sealH);
                
                eCtx.fillStyle = '#A0522D';
                eCtx.font = 'bold 20px "LXGW WenKai Lite", serif';
                eCtx.textBaseline = 'top';
                eCtx.fillText('印', x + 6, y + 6);
                
                // Draw vertical text
                eCtx.fillStyle = '#1a1a1a';
                eCtx.font = 'bold 28px "LXGW WenKai Lite", serif';
                for (let i = 0; i < sigText.length; i++) {
                    eCtx.fillText(sigText[i], x - 40, y - (sigText.length - 1 - i) * 32);
                }
                eCtx.restore();
            }

            const dataUrl = exportCanvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `cats_cradle_v4_${this.state.pattern}_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            logger.log('Snapshot successfully saved.', 'success');
            
            // Add to UI Gallery
            const gallery = document.getElementById('screenshot-gallery');
            if (gallery) {
                // Clear placeholder
                const emptyPlaceholder = gallery.querySelector('.gallery-empty');
                if (emptyPlaceholder) {
                    emptyPlaceholder.remove();
                }
                
                // Compress to thumbnail
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = 160;
                thumbCanvas.height = 90;
                const thumbCtx = thumbCanvas.getContext('2d');
                thumbCtx.drawImage(exportCanvas, 0, 0, 160, 90);
                const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);
                
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                wrapper.style.minWidth = '160px';
                wrapper.style.transition = 'all 0.3s ease';
                
                const img = document.createElement('img');
                img.src = thumbUrl;
                img.style.width = '160px';
                img.style.height = '90px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '6px';
                img.style.border = '1px solid var(--border-color)';
                img.style.cursor = 'pointer';
                img.onclick = () => { window.open(dataUrl, '_blank'); }; // Open original on click
                
                const delBtn = document.createElement('button');
                delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                delBtn.className = 'icon-btn';
                delBtn.style.position = 'absolute';
                delBtn.style.top = '4px';
                delBtn.style.right = '4px';
                delBtn.style.background = 'rgba(0,0,0,0.8)';
                delBtn.style.width = '24px';
                delBtn.style.height = '24px';
                delBtn.style.minWidth = '24px';
                delBtn.style.fontSize = '12px';
                delBtn.onclick = () => {
                    wrapper.style.opacity = '0';
                    setTimeout(() => {
                        if(gallery.contains(wrapper)) gallery.removeChild(wrapper);
                        if (gallery.children.length === 0) {
                            gallery.innerHTML = '<div style="color:var(--text-color); font-size:12px; opacity:0.6;">暂无快照，点击上方“截取全息快照”</div>';
                        }
                    }, 300);
                };
                
                wrapper.appendChild(img);
                wrapper.appendChild(delBtn);
                
                // Insert at front
                gallery.insertBefore(wrapper, gallery.firstChild);
                
                // Limit to 5
                if (gallery.children.length > 5) {
                    gallery.removeChild(gallery.lastChild);
                }
            }
        } catch (e) {
            logger.log('Failed to capture snapshot.', 'error');
        }
    },

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    },

    startRecording() {
        if (this.isPreparingRecord) return;
        this.isPreparingRecord = true;
        
        // Show countdown overlay
        const overlay = document.getElementById('countdown-overlay');
        const text = document.getElementById('countdown-text');
        if (overlay && text) {
            overlay.style.display = 'flex';
            let count = 3;
            text.innerText = count;
            if (typeof synth !== 'undefined' && synth.playPluck) synth.playPluck(100);
            
            const countInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    text.innerText = count;
                    if (typeof synth !== 'undefined' && synth.playPluck) synth.playPluck(100);
                } else {
                    clearInterval(countInterval);
                    overlay.style.display = 'none';
                    if (typeof synth !== 'undefined' && synth.playPluck) synth.playPluck(120);
                    this.executeStartRecording();
                }
            }, 1000);
        } else {
            this.executeStartRecording();
        }
    },

    executeStartRecording() {
        this.recordedChunks = [];
        const stream = this.canvas.captureStream(30); // Capture canvas at 30 fps
        
        let finalStream = stream;
        if (synth.ctx && synth.masterDest && synth.masterDest.stream) {
            const audioTracks = synth.masterDest.stream.getAudioTracks();
            if (audioTracks.length > 0) {
                finalStream = new MediaStream([ ...stream.getVideoTracks(), ...audioTracks ]);
            }
        }
        
        try {
            this.mediaRecorder = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp9' });
        } catch (e) {
            try {
                this.mediaRecorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
            } catch (e2) {
                logger.log('Web MediaRecorder is not supported in this browser.', 'error');
                this.isPreparingRecord = false;
                return;
            }
        }

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cats_cradle_v4_${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
            
            logger.log('Canvas recording exported successfully!', 'success');
        };

        // Start recording
        this.mediaRecorder.start();
        this.isRecording = true;
        this.isPreparingRecord = false;
        this.recordStartTime = Date.now();
        
        // Update recording button UI
        const btn = document.getElementById('btn-record');
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-square"></i> 停止录制并保存`;
            btn.classList.add('recording');
        }
        
        // Show recording HUD overlay
        const hud = document.getElementById('recording-hud');
        if (hud) hud.classList.remove('hidden');
        
        // Start duration counter
        const timeDisplay = document.getElementById('recording-time');
        const indicator = hud ? hud.querySelector('.recording-indicator') : null;
        
        this.recordTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordStartTime;
            const remaining = Math.max(0, 10000 - elapsed);
            
            if (timeDisplay) timeDisplay.innerText = (remaining / 1000).toFixed(1) + 's';
            
            if (remaining <= 3000 && indicator) {
                indicator.style.color = '#ff3333';
                indicator.style.textShadow = '0 0 15px #ff0000';
            }
            
            // Auto stop at 10 seconds to limit memory
            if (remaining <= 0) {
                this.stopRecording();
            }
        }, 100);

        logger.log('Canvas capture recording started (max 10s)...', 'info');
    },

    stopRecording() {
        if (!this.isRecording) return;
        
        clearInterval(this.recordTimer);
        this.mediaRecorder.stop();
        this.isRecording = false;
        
        // Reset recording HUD
        const hud = document.getElementById('recording-hud');
        const indicator = hud ? hud.querySelector('.recording-indicator') : null;
        if (hud) hud.classList.add('hidden');
        if (indicator) {
            indicator.style.color = '';
            indicator.style.textShadow = '';
        }
        
        // Reset recording button UI
        const btn = document.getElementById('btn-record');
        btn.innerHTML = `<i class="fa-solid fa-circle-dot"></i> 开始录制视频`;
        btn.classList.remove('recording');
        logger.log('Recording stopped. Compiling data stream...', 'info');
    },

    setupMediaPipe() {
        logger.log('Loading MediaPipe AI Hands tracker...', 'info');
        
        try {
            const hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            // Task E: granular try-catch around option configuration
            try {
                hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.62, minTrackingConfidence: 0.62 });
            } catch (e) {
                logger.log('MediaPipe hands.setOptions failed: ' + (e && e.message ? e.message : e), 'error');
                throw e; // re-throw to outer handler for user prompt
            }
            hands.onResults((results) => this.onTrackingResults(results));

            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    await hands.send({ image: this.video });
                },
                width: 1280,
                height: 720
            });

            // Task A: stored as this.camera for teardown; Task E: start failure handled
            this.camera.start()
                .then(() => {
                    // Ink loading splash animation
                    if (this.state.artStyle === 'ink') {
                        this.drawInkLoadingSplash();
                        // Wait for drop + ripple + 300ms fade transition to complete
                        if (this.loader) {
                            this.loader.style.transition = 'opacity 0.5s ease';
                        }
                        setTimeout(() => {
                            if (this.loader) this.loader.style.opacity = '0';
                            setTimeout(() => { if (this.loader) this.loader.style.display = 'none'; }, 500);
                        }, 1700);
                    } else {
                        // Cyber mode: fade out loader, then reveal poetic-hint if present
                        if (this.loader) {
                            this.loader.style.transition = 'opacity 0.5s ease';
                        }
                        setTimeout(() => {
                            if (this.loader) this.loader.style.opacity = '0';
                            setTimeout(() => {
                                if (this.loader) this.loader.style.display = 'none';
                                const poeticHint = document.querySelector('.cyber-loader .poetic-hint');
                                if (poeticHint) {
                                    setTimeout(() => { poeticHint.style.opacity = '1'; }, 500);
                                }
                            }, 500);
                        }, 1800);
                    }
                    logger.log('WebCam capture feed loaded.', 'success');
                    logger.log('Holographic tracking engine started.', 'success');
                })
                .catch(err => {
                    logger.log(`Webcam permission failed: ${err && err.message ? err.message : err}`, 'error');
                    this.loader.style.opacity = '0';
                    setTimeout(() => this.loader.style.display = 'none', 500);
                    alert('无法开启摄像头，请在浏览器权限中授权后刷新页面！');
                });
        } catch (err) {
            logger.log(`AI Engine initialization failed: ${err.message}`, 'error');
            this.loader.style.opacity = '0';
            setTimeout(() => this.loader.style.display = 'none', 500);
            alert('AI 引擎加载失败，可能是由于网络连接 CDN 缓慢，请检查网络或刷新重试！');
        }
    },

    triggerModeSwitchFlash() {
        this.canvas.style.transition = 'filter 0.1s ease-out';
        this.canvas.style.filter = 'brightness(1.1)';
        setTimeout(() => {
            this.canvas.style.filter = '';
            this.canvas.style.transition = '';
        }, 120);
    },

    // Task B: onTrackingResults now only caches results; rendering is driven by RAF.
    // The camera onFrame/onResults callbacks still feed data, but no longer render.
    onTrackingResults(results) {
        this.latestResults = results;
        this.hasResults = true;
    },

    // Task B: RAF-driven render loop. Consumes the newest tracking data and renders
    // every frame so particles/decay never freeze between camera callbacks. When no
    // new results have arrived it reuses the last known hand positions (or empty).
    renderFrame() {
        // Consume newest tracking results when a MediaPipe frame has arrived
        if (this.hasResults && this.latestResults) {
            const results = this.latestResults;
            this.handsData = {};
            
            if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
                if (!this.handLostTimer) {
                    this.handLostTimer = performance.now();
                    this.canvas.classList.add('signal-lost');
                } else if (performance.now() - this.handLostTimer > 500) {
                    this.guide.classList.add('active');
                }
                
                if (this.lastLogsState.Left || this.lastLogsState.Right) {
                    logger.log('Hands tracking lost.', 'warning');
                    this.lastLogsState = { Left: false, Right: false };
                }
            } else {
                this.handLostTimer = null;
                this.canvas.classList.remove('signal-lost');
                this.guide.classList.remove('active');

                results.multiHandLandmarks.forEach((landmarks, index) => {
                    // 计算手部质心 x（归一化 0-1）
                    let avgX = 0;
                    for (const lm of landmarks) avgX += lm.x;
                    avgX /= landmarks.length;

                    // 镜像模式下，画面左侧（x < 0.5）对应用户的右手，画面右侧（x >= 0.5）对应左手
                    // 但 MediaPipe 的标签在镜像后不可靠，改用位置判定
                    let screenSide;
                    if (this.state.mirror) {
                        screenSide = avgX < 0.5 ? 'Right' : 'Left';
                    } else {
                        screenSide = avgX < 0.5 ? 'Left' : 'Right';
                    }

                    // 双手同侧碰撞检查：该侧已被占用时分配到另一侧
                    if (this.handsData[screenSide]) {
                        screenSide = screenSide === 'Left' ? 'Right' : 'Left';
                    }
                    this.handsData[screenSide] = landmarks.map(lm => {
                        let screenX = lm.x;
                        if (this.state.mirror) {
                            screenX = 1 - screenX;
                        }
                        return {
                            x: screenX * this.canvas.width,
                            y: lm.y * this.canvas.height,
                            z: lm.z
                        };
                    });

                    if (!this.lastLogsState[screenSide]) {
                        logger.log(`${screenSide} hand mesh locked.`, 'info');
                        this.lastLogsState[screenSide] = true;
                    }
                });
            }

            const trackedSides = Object.keys(this.handsData);
            ['Left', 'Right'].forEach(side => {
                if (this.lastLogsState[side] && !trackedSides.includes(side)) {
                    // 记录丢失开始时间
                    if (!this._sideLostAt[side]) {
                        this._sideLostAt[side] = performance.now();
                    }
                    // 连续丢失超过 250ms 才判定 disconnect
                    if (performance.now() - this._sideLostAt[side] > 250) {
                        logger.log(`${side} hand mesh disconnected.`, 'warning');
                        this.lastLogsState[side] = false;
                        this._sideLostAt[side] = 0;
                    }
                } else if (this._sideLostAt[side]) {
                    // 该侧恢复，清除丢失计时
                    this._sideLostAt[side] = 0;
                }
            });
            
            this.hasResults = false;
        }

        // Expose hand landmarks to particle system for force-field calculation
        this.activeHandLandmarks = [];
        if (this.handsData) {
            for (const key in this.handsData) {
                const hand = this.handsData[key];
                if (hand && hand.length) {
                    this.activeHandLandmarks.push(hand);
                }
            }
        }

        // Always render so particles/decay keep animating even without new tracking
        this.processFrame();

        // Schedule next frame (bound to preserve `this`)
        this.rafId = requestAnimationFrame(this._boundRenderFrame);
    },

    // Task B: kick off the RAF render loop after initialization
    startRenderLoop() {
        this.rafId = requestAnimationFrame(this._boundRenderFrame);
    },

    getPatternConnections() {
        const hasLeft = !!this.handsData.Left;
        const hasRight = !!this.handsData.Right;
        const connections = [];

        // Global fallback for single hand
        if (hasLeft !== hasRight) {
            const side = hasLeft ? 'Left' : 'Right';
            connections.push({ from: { hand: side, joint: 4 }, to: { hand: side, joint: 8 } });
            connections.push({ from: { hand: side, joint: 8 }, to: { hand: side, joint: 12 } });
            connections.push({ from: { hand: side, joint: 12 }, to: { hand: side, joint: 16 } });
            connections.push({ from: { hand: side, joint: 16 }, to: { hand: side, joint: 20 } });
            connections.push({ from: { hand: side, joint: 20 }, to: { hand: side, joint: 4 } });
        }
        else if (this.state.pattern === 'star') {
            if (hasLeft && hasRight) {
                connections.push({ from: { hand: 'Left', joint: 4 }, to: { hand: 'Right', joint: 12 } });
                connections.push({ from: { hand: 'Left', joint: 12 }, to: { hand: 'Right', joint: 4 } });
                connections.push({ from: { hand: 'Left', joint: 4 }, to: { hand: 'Right', joint: 16 } });
                connections.push({ from: { hand: 'Left', joint: 16 }, to: { hand: 'Right', joint: 4 } });
                
                connections.push({ from: { hand: 'Left', joint: 8 }, to: { hand: 'Right', joint: 20 } });
                connections.push({ from: { hand: 'Left', joint: 20 }, to: { hand: 'Right', joint: 8 } });
                connections.push({ from: { hand: 'Left', joint: 8 }, to: { hand: 'Right', joint: 16 } });
                connections.push({ from: { hand: 'Left', joint: 16 }, to: { hand: 'Right', joint: 8 } });
                
                connections.push({ from: { hand: 'Left', joint: 20 }, to: { hand: 'Right', joint: 12 } });
                connections.push({ from: { hand: 'Left', joint: 12 }, to: { hand: 'Right', joint: 20 } });
            } else {
                const side = hasLeft ? 'Left' : 'Right';
                connections.push({ from: { hand: side, joint: 4 }, to: { hand: side, joint: 12 } });
                connections.push({ from: { hand: side, joint: 12 }, to: { hand: side, joint: 20 } });
                connections.push({ from: { hand: side, joint: 20 }, to: { hand: side, joint: 8 } });
                connections.push({ from: { hand: side, joint: 8 }, to: { hand: side, joint: 16 } });
                connections.push({ from: { hand: side, joint: 16 }, to: { hand: side, joint: 4 } });
            }
        } 
        else if (this.state.pattern === 'starry') {
            ['Left', 'Right'].forEach(side => {
                if (this.handsData[side]) {
                    connections.push({ from: { hand: side, joint: 4 }, to: { hand: side, joint: 8 } });
                    connections.push({ from: { hand: side, joint: 8 }, to: { hand: side, joint: 12 } });
                    connections.push({ from: { hand: side, joint: 12 }, to: { hand: side, joint: 16 } });
                    connections.push({ from: { hand: side, joint: 16 }, to: { hand: side, joint: 20 } });
                    connections.push({ from: { hand: side, joint: 20 }, to: { hand: side, joint: 4 } });
                }
            });

            if (hasLeft && hasRight) {
                connections.push({ from: { hand: 'Left', joint: 4 }, to: { hand: 'Right', joint: 20 } });
                connections.push({ from: { hand: 'Left', joint: 8 }, to: { hand: 'Right', joint: 16 } });
                connections.push({ from: { hand: 'Left', joint: 12 }, to: { hand: 'Right', joint: 12 } });
                connections.push({ from: { hand: 'Left', joint: 16 }, to: { hand: 'Right', joint: 8 } });
                connections.push({ from: { hand: 'Left', joint: 20 }, to: { hand: 'Right', joint: 4 } });
            }
        } 
        else if (this.state.pattern === 'cradle') {
            if (hasLeft && hasRight) {
                connections.push({ from: { hand: 'Left', joint: 4 }, to: { hand: 'Right', joint: 4 } });
                connections.push({ from: { hand: 'Left', joint: 20 }, to: { hand: 'Right', joint: 20 } });
                connections.push({ from: { hand: 'Left', joint: 8 }, to: { hand: 'Right', joint: 12 } });
                connections.push({ from: { hand: 'Right', joint: 8 }, to: { hand: 'Left', joint: 12 } });
                connections.push({ from: { hand: 'Left', joint: 0 }, to: { hand: 'Right', joint: 0 } });
            } else {
                const side = hasLeft ? 'Left' : 'Right';
                connections.push({ from: { hand: side, joint: 4 }, to: { hand: side, joint: 20 } });
                connections.push({ from: { hand: side, joint: 0 }, to: { hand: side, joint: 8 } });
                connections.push({ from: { hand: side, joint: 8 }, to: { hand: side, joint: 16 } });
            }
        } 
        else if (this.state.pattern === 'flower') {
            ['Left', 'Right'].forEach(side => {
                if (this.handsData[side]) {
                    connections.push({ from: { hand: side, joint: 4 }, to: { hand: side, joint: 8 } });
                    connections.push({ from: { hand: side, joint: 8 }, to: { hand: side, joint: 12 } });
                    connections.push({ from: { hand: side, joint: 12 }, to: { hand: side, joint: 16 } });
                    connections.push({ from: { hand: side, joint: 16 }, to: { hand: side, joint: 20 } });
                    connections.push({ from: { hand: side, joint: 20 }, to: { hand: side, joint: 0 } });
                    connections.push({ from: { hand: side, joint: 0 }, to: { hand: side, joint: 4 } });
                }
            });

            if (hasLeft && hasRight) {
                connections.push({ from: { hand: 'Left', joint: 8 }, to: { hand: 'Right', joint: 8 } });
                connections.push({ from: { hand: 'Left', joint: 12 }, to: { hand: 'Right', joint: 12 } });
                connections.push({ from: { hand: 'Left', joint: 16 }, to: { hand: 'Right', joint: 16 } });
            }
        } 
        else if (this.state.pattern === 'well') {
            if (hasLeft && hasRight) {
                connections.push({ from: { hand: 'Left', joint: 8 }, to: { hand: 'Right', joint: 8 } });
                connections.push({ from: { hand: 'Left', joint: 16 }, to: { hand: 'Right', joint: 16 } });
                connections.push({ from: { hand: 'Left', joint: 4 }, to: { hand: 'Left', joint: 20 } });
                connections.push({ from: { hand: 'Right', joint: 4 }, to: { hand: 'Right', joint: 20 } });
                connections.push({ from: { hand: 'Left', joint: 4 }, to: { hand: 'Right', joint: 20 } });
                connections.push({ from: { hand: 'Right', joint: 4 }, to: { hand: 'Left', joint: 20 } });
            } else {
                const side = hasLeft ? 'Left' : 'Right';
                connections.push({ from: { hand: side, joint: 4 }, to: { hand: side, joint: 12 } });
                connections.push({ from: { hand: side, joint: 8 }, to: { hand: side, joint: 16 } });
                connections.push({ from: { hand: side, joint: 12 }, to: { hand: side, joint: 20 } });
                connections.push({ from: { hand: side, joint: 0 }, to: { hand: side, joint: 8 } });
            }
        }
        else if (this.state.pattern === 'constellation') {
            const fingertips = [4, 8, 12, 16, 20];
            // Connect all fingertips on the same hand
            ['Left', 'Right'].forEach(side => {
                if (this.handsData[side]) {
                    for (let i = 0; i < fingertips.length; i++) {
                        for (let j = i + 1; j < fingertips.length; j++) {
                            connections.push({ from: { hand: side, joint: fingertips[i] }, to: { hand: side, joint: fingertips[j] } });
                        }
                    }
                }
            });
            // Connect every fingertip of Left hand to every fingertip of Right hand
            if (hasLeft && hasRight) {
                fingertips.forEach(jL => {
                    fingertips.forEach(jR => {
                        connections.push({ from: { hand: 'Left', joint: jL }, to: { hand: 'Right', joint: jR } });
                    });
                });
            }
        }


        return connections.filter(conn => isJointEnabled(conn.from.joint, this.state.enabledFingers) && isJointEnabled(conn.to.joint, this.state.enabledFingers));
    },

    getThemeColors() {
        const theme = this.state.colorTheme;
        if (theme === 'cyan-pink') {
            return { string: '#ff007f', joints: '#00ffff', primary: '#ff007f', secondary: '#00ffff' };
        } else if (theme === 'aurora') {
            return { string: '#aa00ff', joints: '#00ff66', primary: '#aa00ff', secondary: '#00ff66' };
        } else if (theme === 'lava') {
            return { string: '#ff3300', joints: '#ffaa00', primary: '#ff3300', secondary: '#ffaa00' };
        } else if (theme === 'ocean') {
            return { string: '#0055ff', joints: '#00ffff', primary: '#0055ff', secondary: '#00ffff' };
        } else if (theme === 'ink') {
            return { string: '#1a1a1a', joints: '#3a3a3a', primary: '#1a1a1a', secondary: '#5a5a5a' };
        } else if (theme === 'custom') {
            const strColEl = document.getElementById('color-string');
            const jointColEl = document.getElementById('color-joints');
            const strCol = strColEl ? strColEl.value : '#ff007f';
            const jointCol = jointColEl ? jointColEl.value : '#00ffff';
            return { string: strCol, joints: jointCol, primary: strCol, secondary: jointCol };
        } else {
            // rainbow
            const hue = (Date.now() / 15) % 360;
            const dynColor = `hsl(${hue}, 100%, 50%)`;
            return { string: 'rainbow', joints: dynColor, primary: dynColor, secondary: `hsl(${(hue + 180) % 360}, 100%, 50%)` };
        }
    },

    lastFpsTime: performance.now(),
    frameCount: 0,

    processFrame() {
        // If ink loading animation is active, skip regular frame rendering
        if (this._inkLoadingActive) {
            return;
        }
        // --- FPS Monitoring ---
        const now = performance.now();
        this.frameCount++;
        if (now - this.lastFpsTime >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
            this.frameCount = 0;
            this.lastFpsTime = now;
            
            const fpsEl = document.getElementById('fps-display');
            if (fpsEl) {
                fpsEl.innerText = `FPS: ${fps}`;
                if (fps < 20) {
                    fpsEl.style.color = '#ff4444'; // Red warning
                    fpsEl.title = 'Severe frame drop. Consider Pure Mode.';
                } else if (fps < 30) {
                    fpsEl.style.color = '#ffaa00'; // Orange warning
                    fpsEl.title = 'Low frame rate.';
                } else {
                    fpsEl.style.color = 'var(--text-color)';
                    fpsEl.title = '';
                }
            }
        }
        
        const _cachedFFT = (typeof synth !== 'undefined' && synth.getAnalyserData) ? synth.getAnalyserData() : null;
        // 计算音频低频能量并传递给粒子系统
        if (_cachedFFT && particles) {
            let energy = 0;
            for (let i = 0; i < Math.min(_cachedFFT.length, 8); i++) {
                energy += _cachedFFT[i];
            }
            energy /= Math.min(_cachedFFT.length, 8);
            particles.setAudioEnergy(energy / 255);
        }
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Safety sync: ensure ink stain canvas matches main canvas dimensions
        if (this.inkStainCanvas && (this.inkStainCanvas.width !== w || this.inkStainCanvas.height !== h)) {
            this.inkStainCanvas.width = w;
            this.inkStainCanvas.height = h;
        }
        
        
        // 1. Draw Background based on mode
        this.ctx.globalCompositeOperation = 'source-over';
        if (this.state.bgMode === 'black') {
            this.ctx.fillStyle = '#050608';
            this.ctx.fillRect(0, 0, w, h);
        } else if (this.state.bgMode === 'webcam' && this.state.showWebcam) {
            if (this.state.mirror) {
                this.ctx.save();
                this.ctx.scale(-1, 1);
                this.ctx.translate(-w, 0);
                this.ctx.drawImage(this.video, 0, 0, w, h);
                this.ctx.restore();
            } else {
                this.ctx.drawImage(this.video, 0, 0, w, h);
            }
        } else if (this.state.bgMode === 'webcam' && !this.state.showWebcam) {
            // 摄像头背景关闭时显示纯黑背景
            this.ctx.fillStyle = '#050608';
            this.ctx.fillRect(0, 0, w, h);
        } else if (this.state.bgMode === 'custom') {
            if (this.state.customBgImage) {
                this.ctx.drawImage(this.state.customBgImage, 0, 0, w, h);
            } else {
                this.ctx.fillStyle = '#050608';
                this.ctx.fillRect(0, 0, w, h);
            }
        } else if (this.state.bgMode === 'xuan-paper') {
            const pattern = this.generateXuanNoise();
            this.ctx.fillStyle = pattern;
            this.ctx.fillRect(0, 0, w, h);
        } else if (this.state.bgMode === 'color') {
            this.ctx.fillStyle = this.state.canvasBgColor || '#050608';
            this.ctx.fillRect(0, 0, w, h);
        }

        // Draw HUDs and Grid
        this.ctx.globalAlpha = 1.0;
        this.ctx.globalCompositeOperation = 'source-over';
        if (this.state.bgMode === 'black' || this.state.bgMode === 'custom' || this.state.bgMode === 'color') {
            this.drawGridOverlay();
        }

        // Draw permanent ink stain canvas (ink mode only) - between background and strings
        if (this.state.artStyle === 'ink' && this.inkStainCanvas) {
            this.ctx.drawImage(this.inkStainCanvas, 0, 0);
        }



        const colors = this.getThemeColors();
        const connections = this.getPatternConnections();
        const palmCenters = {
            Left: this.handsData.Left ? this.handsData.Left[9] : null,
            Right: this.handsData.Right ? this.handsData.Right[9] : null
        };

        // --- Continuous Pad chord volume controller ---
        const activeHands = !!this.handsData.Left + !!this.handsData.Right;
        let maxTension = 0;
        Object.values(this.activeStrings).forEach(str => {
            if (str.tension && str.tension > maxTension) {
                maxTension = str.tension;
            }
        });

        if (activeHands > 0) {
            let dist = 350;
            if (this.handsData.Left && this.handsData.Right) {
                dist = Math.hypot(this.handsData.Right[9].x - this.handsData.Left[9].x, this.handsData.Right[9].y - this.handsData.Left[9].y);
            }
            synth.updatePadFilter(dist, true, maxTension);
        } else {
            synth.updatePadFilter(0, false, 0);
        }

        // --- Audio Visualizer Wave (Bottom Center) ---
        if (maxTension > 0 || (synth.padEnabled && activeHands > 0)) {
            const analyserData = _cachedFFT;
            if (analyserData && this.state.artStyle === 'ink') {
                // Ink mode: FFT curve with dynamic line width per segment
                const density = this.state.inkDensity || 0.85;
                this.ctx.save();
                this.ctx.lineCap = 'round';
                const step = Math.ceil(analyserData.length / 80);
                const sliceW = this.canvas.width / (analyserData.length / step);
                let prevX = 0, prevY = 0;
                for (let i = 0; i < analyserData.length; i += step) {
                    const value = analyserData[i] || 0;
                    const v = value / 255.0;
                    const yPos = this.canvas.height - v * 60;
                    const xPos = (i / step) * sliceW;
                    const dynamicWidth = 0.5 + v * (1 + density * 4);
                    const alpha = 0.2 + v * 0.4;
                    this.ctx.lineWidth = dynamicWidth;
                    this.ctx.strokeStyle = `rgba(26,26,26,${alpha.toFixed(2)})`;
                    this.ctx.beginPath();
                    if (i === 0) {
                        this.ctx.moveTo(xPos, yPos);
                    } else {
                        this.ctx.moveTo(prevX, prevY);
                        this.ctx.lineTo(xPos, yPos);
                    }
                    this.ctx.stroke();
                    prevX = xPos;
                    prevY = yPos;
                }
                this.ctx.restore();
            }
        }

        // --- Interactive Scissor Cutting Gesture detection ---
        let isScissorActive = false;
        let scissorPos = null;

        if (this.state.enableCut) {
            ['Left', 'Right'].forEach(side => {
                const hand = this.handsData[side];
                if (hand) {
                    const idxLm = hand[8]; // Index tip
                    const midLm = hand[12]; // Middle tip
                    const d = Math.hypot(idxLm.x - midLm.x, idxLm.y - midLm.y);
                    
                    const wristLm = hand[0]; // Wrist
                    const palmBaseLm = hand[9]; // Middle finger base / palm center approx
                    let palmWidth = 100;
                    if (wristLm && palmBaseLm) {
                        palmWidth = Math.hypot(wristLm.x - palmBaseLm.x, wristLm.y - palmBaseLm.y);
                    }
                    if (palmWidth < 10) palmWidth = 100; // fallback safety
                    const scissorThreshold = palmWidth * 0.25; // relatively ~25px per 100px palm width
                    
                    // If Index and Middle tip get very close (scissor swipe)
                    if (d < scissorThreshold) {
                        isScissorActive = true;
                        scissorPos = { x: (idxLm.x + midLm.x) / 2, y: (idxLm.y + midLm.y) / 2 };
                        
                        // Spawn red cutting sparks
                        particles.spawn(scissorPos.x, scissorPos.y, '#ff3b30', 2, 'spark');
                    }
                }
            });
        }

        // --- Hand Gestures for Drawing Mode ---
        if (this.state.drawMode) {
            // Collect all unique existing vertices for snapping
            const snapDist = 35;
            const uniqueVertices = [];
            this.drawings.forEach(line => {
                const addUnique = (pt) => {
                    if (!uniqueVertices.some(v => Math.hypot(v.x - pt.x, v.y - pt.y) < 2)) {
                        uniqueVertices.push(pt);
                    }
                };
                addUnique({ x: line.startX, y: line.startY });
                addUnique({ x: line.endX, y: line.endY });
            });

            ['Left', 'Right'].forEach(side => {
                const hand = this.handsData[side];
                if (hand) {
                    const thumb = hand[4];
                    const index = hand[8];
                    const dist = Math.hypot(index.x - thumb.x, index.y - thumb.y);
                    const pinchPos = { x: (thumb.x + index.x)/2, y: (thumb.y + index.y)/2 };

                    // Hysteresis: start drawing if pinched, commit if they release pinch
                    if (dist < 22) {
                        if (!this.activeDrawings[side]) {
                            // Find closest starting vertex
                            let closestStart = null;
                            let minDistStart = Infinity;
                            uniqueVertices.forEach(v => {
                                const d = Math.hypot(v.x - pinchPos.x, v.y - pinchPos.y);
                                if (d < snapDist && d < minDistStart) {
                                    minDistStart = d;
                                    closestStart = v;
                                }
                            });

                            const startX = closestStart ? closestStart.x : pinchPos.x;
                            const startY = closestStart ? closestStart.y : pinchPos.y;

                            this.activeDrawings[side] = {
                                startX: startX,
                                startY: startY,
                                currentX: startX,
                                currentY: startY,
                                path: [{x: startX, y: startY}],
                                snappedEnd: null
                            };
                            logger.log(`${side} hand began drawing a straight line.`, 'info');
                        } else {
                            // Find closest current vertex (avoid snapping back to start point if too close)
                            let closestCurrent = null;
                            let minDistCurrent = Infinity;
                            uniqueVertices.forEach(v => {
                                if (Math.hypot(v.x - this.activeDrawings[side].startX, v.y - this.activeDrawings[side].startY) < 8) {
                                    return;
                                }
                                const d = Math.hypot(v.x - pinchPos.x, v.y - pinchPos.y);
                                if (d < snapDist && d < minDistCurrent) {
                                    minDistCurrent = d;
                                    closestCurrent = v;
                                }
                            });

                            if (closestCurrent) {
                                this.activeDrawings[side].currentX = closestCurrent.x;
                                this.activeDrawings[side].currentY = closestCurrent.y;
                                this.activeDrawings[side].path.push({x: closestCurrent.x, y: closestCurrent.y});
                                this.activeDrawings[side].snappedEnd = closestCurrent;
                            } else {
                                this.activeDrawings[side].currentX = pinchPos.x;
                                this.activeDrawings[side].currentY = pinchPos.y;
                                // Sample path points
                                const lastP = this.activeDrawings[side].path[this.activeDrawings[side].path.length - 1];
                                if (Math.hypot(pinchPos.x - lastP.x, pinchPos.y - lastP.y) > 4) {
                                    this.activeDrawings[side].path.push({x: pinchPos.x, y: pinchPos.y});
                                }
                                this.activeDrawings[side].snappedEnd = null;
                            }
                        }
                    } else if (dist > 32) {
                        if (this.activeDrawings[side]) {
                            const drawing = this.activeDrawings[side];
                            const lineLen = Math.hypot(drawing.currentX - drawing.startX, drawing.currentY - drawing.startY);
                            if (lineLen > 15) {
                                // Post-commit snapping to ensure exact vertex coordinate matching
                                let finalStartX = drawing.startX;
                                let finalStartY = drawing.startY;
                                let finalEndX = drawing.currentX;
                                let finalEndY = drawing.currentY;

                                uniqueVertices.forEach(v => {
                                    if (Math.hypot(v.x - finalStartX, v.y - finalStartY) < 45) {
                                        finalStartX = v.x;
                                        finalStartY = v.y;
                                    }
                                    if (Math.hypot(v.x - finalEndX, v.y - finalEndY) < 45) {
                                        finalEndX = v.x;
                                        finalEndY = v.y;
                                    }
                                });

                                // Task 20: Upper limit protection to prevent DFS explosion
                                if (this.drawings.length > 100) {
                                    this.drawings.shift();
                                }
                                this.drawings.push({
                                    startX: finalStartX,
                                    startY: finalStartY,
                                    endX: finalEndX,
                                    endY: finalEndY,
                                    path: drawing.path,
                                    color: colors.string === 'rainbow' ? '#00ffff' : colors.string,
                                    thickness: this.state.stringWidth
                                });
                                this._drawingsDirty = true; // Task 18: invalidate closed-loop cache
                                logger.log(`Straight line committed to canvas.`, 'success');
                                synth.playPluck(90); // Play pluck sound as completion feedback!
                            }
                            this.activeDrawings[side] = null;
                        }
                    }
                }
            });
        }

        // --- Update and Draw Verlet Strings ---
        const activeIds = [];

        connections.forEach(conn => {
            const id = `${conn.from.hand}_${conn.from.joint}-${conn.to.hand}_${conn.to.joint}`;
            activeIds.push(id);

            const posA = this.handsData[conn.from.hand] ? this.handsData[conn.from.hand][conn.from.joint] : null;
            const posB = this.handsData[conn.to.hand] ? this.handsData[conn.to.hand][conn.to.joint] : null;

            if (!this.activeStrings[id] && posA && posB) {
                const initialDist = Math.hypot(posB.x - posA.x, posB.y - posA.y);
                this.activeStrings[id] = new VerletString(id, conn.from, conn.to, initialDist * 1.1);
            }

            if (this.activeStrings[id]) {
                const str = this.activeStrings[id];
                
                // Tension mapping rest-length
                const tensionFactor = 1.6 - (this.state.tension / 15);
                str.targetLength = Math.hypot(posB.x - posA.x, posB.y - posA.y) * tensionFactor;

                str.update(posA, posB, this.state, palmCenters);
                
                // Collision Detection: String Plucking & Scissor Slicing
                if (str.cutIndex === -1 && str.points.length > 2) {
                    
                    // 1. Scissor Cut collision
                    if (isScissorActive && scissorPos && !this.state.neverBreak) {
                        for (let i = 0; i < str.points.length - 1; i++) {
                            const d = distToSegment(scissorPos, str.points[i], str.points[i+1]);
                            if (d < 16) {
                                str.cutIndex = i; // Split segment here!
                                str.isFading = true;
                                synth.playCutSound();
                                ripples.trigger(scissorPos.x, scissorPos.y, '#ff3b30');
                                const modeColor = document.body.classList.contains('ink-mode') ? '#1a1a1a' : '#ff3b30';
                                particles.spawn(scissorPos.x, scissorPos.y, modeColor, 12, 'fireworks');
                                if (str.points[i]) particles.spawn(str.points[i].x, str.points[i].y, '#ffffff', 4, 'spark');
                                if (str.points[i+1]) particles.spawn(str.points[i+1].x, str.points[i+1].y, '#ffffff', 4, 'spark');
                                // Ink mode: spawn ink collision particles at cut point
                                if (this.state.artStyle === 'ink') {
                                    const inkDensity = this.state.inkDensity || 0.85;
                                    const cutInkColor = `rgba(26,26,26,${(0.3 + inkDensity * 0.5).toFixed(2)})`;
                                    particles.spawn(scissorPos.x, scissorPos.y, cutInkColor, 3 + Math.floor(Math.random()*3), 'ink-collision');
                                }
                                this.cutFlashes.push({ x: scissorPos.x, y: scissorPos.y, life: 1, maxLife: 8, angle: Math.random() * Math.PI });
                                logger.log(`String sliced by scissor cut: ${str.id}`, 'warning');
                                break;
                            }
                        }
                    }
                    
                    // 2. Plucking collision
                    if (this.state.enablePluck && str.cutIndex === -1 && !str.isFading) {
                        ['Left', 'Right'].forEach(side => {
                            const landmarks = this.handsData[side];
                            if (landmarks) {
                                const fingers = [4, 8, 12, 16, 20];
                                fingers.forEach(joint => {
                                    if (!isJointEnabled(joint, this.state.enabledFingers)) return;
                                    // Skip if this joint is actually anchoring this string end
                                    if ((str.anchorA.hand === side && str.anchorA.joint === joint) ||
                                        (str.anchorB.hand === side && str.anchorB.joint === joint)) {
                                        return;
                                    }

                                    const p = landmarks[joint];
                                    const prevKey = `${side}_${joint}`;
                                    const prevP = this.prevFingertips[prevKey];

                                    if (prevP) {
                                        const speed = Math.hypot(p.x - prevP.x, p.y - prevP.y);
                                        
                                        if (speed > 5) {
                                            // Scan segments
                                            for (let i = 1; i < str.points.length - 2; i++) {
                                                const d = distToSegment(p, str.points[i], str.points[i+1]);
                                                if (d < 18) {
                                                    // Push points with finger speed vector
                                                    const pushX = (p.x - prevP.x) * 0.45;
                                                    const pushY = (p.y - prevP.y) * 0.45;
                                                    str.points[i].x += pushX;
                                                    str.points[i].y += pushY;
                                                    str.points[i+1].x += pushX;
                                                    str.points[i+1].y += pushY;
                                                    
                                                    // Play Audio pluck note
                                                    synth.playPluck(speed * 3.8);
                                                    
                                                    // Spawn particles
                                                    particles.spawn(p.x, p.y, colors.joints, 3, 'spark');
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }
                }
            }
        });

        // Update disconnected falling strings
        Object.keys(this.activeStrings).forEach(id => {
            const str = this.activeStrings[id];
            
            // Instantly delete string if either anchor finger is disabled
            if (!isJointEnabled(str.anchorA.joint, this.state.enabledFingers) || !isJointEnabled(str.anchorB.joint, this.state.enabledFingers)) {
                delete this.activeStrings[id];
                return;
            }
            
            // Instantly delete old topology strings when transitioning to single hand
            const bothHandsPresent = !!this.handsData.Left && !!this.handsData.Right;
            if (!activeIds.includes(id) && !bothHandsPresent) {
                delete this.activeStrings[id];
                return;
            }
            
            if (!activeIds.includes(id) || !this.handsData[str.anchorA.hand] || !this.handsData[str.anchorB.hand]) {
                str.update(null, null, this.state, palmCenters);
            }

            // Draw current string path
            let strColor = colors.string;
            if (strColor === 'rainbow') {
                if (str.points.length > 1) {
                    const startP = str.points[0];
                    const endP = str.points[str.points.length - 1];
                    const grad = this.ctx.createLinearGradient(startP.x, startP.y, endP.x, endP.y);
                    
                    const tFactor = Math.min(1, (str.tension || 0) / 150);
                    if (tFactor > 0) {
                        grad.addColorStop(0, lerpColorHex('#00ffff', '#ff5500', tFactor));
                        grad.addColorStop(0.3, lerpColorHex('#00ff66', '#ffaa00', tFactor));
                        grad.addColorStop(0.6, lerpColorHex('#aa00ff', '#ff3300', tFactor));
                        grad.addColorStop(1, lerpColorHex('#ff007f', '#ffff00', tFactor));
                    } else {
                        grad.addColorStop(0, '#00ffff');
                        grad.addColorStop(0.3, '#00ff66');
                        grad.addColorStop(0.6, '#aa00ff');
                        grad.addColorStop(1, '#ff007f');
                    }
                    strColor = grad;
                } else {
                    strColor = '#ff007f';
                }
            }

            if (!this.state.pureMode) {
                str.draw(this.ctx, strColor, this.state.stringWidth, this.state.glowStrength, this.state.stringStyle);
            }

            // Clean up faded strings
            if (str.opacity <= 0) {
                delete this.activeStrings[id];
            }
        });

        // --- Update and Draw Hand-Drawn straight lines ---
        if (isScissorActive && scissorPos && !this.state.neverBreak) {
            // Check if user cuts any drawn lines to erase them
            for (let i = this.drawings.length - 1; i >= 0; i--) {
                const line = this.drawings[i];
                const p1 = { x: line.startX, y: line.startY };
                const p2 = { x: line.endX, y: line.endY };
                const d = distToSegment(scissorPos, p1, p2);
                if (d < 16) {
                    this.drawings.splice(i, 1);
                    this._drawingsDirty = true; // Task 18: invalidate closed-loop cache
                    synth.playCutSound();
                    ripples.trigger(scissorPos.x, scissorPos.y, '#ff3b30');
                    const modeColor = document.body.classList.contains('ink-mode') ? '#1a1a1a' : '#ff3b30';
                    particles.spawn(scissorPos.x, scissorPos.y, modeColor, 10, 'fireworks');
                    this.cutFlashes.push({ x: scissorPos.x, y: scissorPos.y, life: 1, maxLife: 8, angle: Math.random() * Math.PI });
                    logger.log('Drawn straight line erased by scissor cut.', 'warning');
                    break;
                }
            }
        }

        // Draw Closed Shape Polygon Fill (Drawn under lines)
        this.drawClosedLoops();
        this.drawActiveStringLoops();
        this.drawConvexPolygon();

        // Draw Drawings
        if (!this.state.pureMode) {
            this.ctx.save();
            this.ctx.lineCap = 'round';

            this.drawings.forEach(line => {
                const drawLine = () => {
                    // Apply line style to drawings
                    if (this.state.stringStyle === 'dashed') {
                        this.ctx.setLineDash([12, 6]);
                    } else if (this.state.stringStyle === 'dotted') {
                        this.ctx.setLineDash([3, 8]);
                    } else {
                        this.ctx.setLineDash([]);
                    }
                    this.ctx.beginPath();
                    if (line.path && line.path.length > 2) {
                        this.ctx.moveTo(line.path[0].x, line.path[0].y);
                        for (let i = 1; i < line.path.length - 1; i++) {
                            const p1 = line.path[i];
                            const p2 = line.path[i + 1];
                            const midX = (p1.x + p2.x) / 2;
                            const midY = (p1.y + p2.y) / 2;
                            this.ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
                        }
                        this.ctx.lineTo(line.endX, line.endY);
                    } else {
                        this.ctx.moveTo(line.startX, line.startY);
                        this.ctx.lineTo(line.endX, line.endY);
                    }
                };
                let drawColor = line.color;
                if (this.state.artStyle === 'ink') {
                    // Ink strings fade from dark grey to transparent (dry brush)
                    const grad = this.ctx.createLinearGradient(
                        line.startX || (line.path && line.path[0] ? line.path[0].x : 0),
                        line.startY || (line.path && line.path[0] ? line.path[0].y : 0),
                        line.endX || (line.path && line.path[line.path.length-1] ? line.path[line.path.length-1].x : 0),
                        line.endY || (line.path && line.path[line.path.length-1] ? line.path[line.path.length-1].y : 0)
                    );
                    grad.addColorStop(0, 'rgba(50, 50, 50, 0.85)');
                    grad.addColorStop(1, 'rgba(50, 50, 50, 0)');
                    drawColor = grad;
                }
                drawPathWithGlow(this.ctx, drawLine, drawColor, this.state.stringWidth, this.state.glowStrength);
            });
            this.ctx.restore();
        }

        // Draw drawing preview lines
        ['Left', 'Right'].forEach(side => {
            const drawing = this.activeDrawings[side];
            if (drawing) {
                this.ctx.save();
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.shadowColor = '#ffffff';
                this.ctx.lineWidth = Math.max(1.5, this.state.stringWidth * 0.7);
                this.ctx.setLineDash([5, 5]);
                this.ctx.lineJoin = 'round';
                
                this.ctx.beginPath();
                if (drawing.path && drawing.path.length > 2) {
                    this.ctx.moveTo(drawing.path[0].x, drawing.path[0].y);
                    for (let i = 1; i < drawing.path.length - 1; i++) {
                        const p1 = drawing.path[i];
                        const p2 = drawing.path[i + 1];
                        const midX = (p1.x + p2.x) / 2;
                        const midY = (p1.y + p2.y) / 2;
                        this.ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
                    }
                    this.ctx.lineTo(drawing.currentX, drawing.currentY);
                } else {
                    this.ctx.moveTo(drawing.startX, drawing.startY);
                    this.ctx.lineTo(drawing.currentX, drawing.currentY);
                }
                this.ctx.stroke();

                // Draw snapping halo indicator
                if (drawing.snappedEnd) {
                    drawCircleWithGlow(this.ctx, drawing.currentX, drawing.currentY, 12, 'rgba(0, 255, 255, 0.35)', '#00ffff', 2, 12);
                }
                this.ctx.restore();
            }
        });

        // Draw existing vertices as snap points when in drawMode
        if (this.state.drawMode) {
            const uniqueVertices = [];
            this.drawings.forEach(line => {
                const addUnique = (pt) => {
                    if (!uniqueVertices.some(v => Math.hypot(v.x - pt.x, v.y - pt.y) < 2)) {
                        uniqueVertices.push(pt);
                    }
                };
                addUnique({ x: line.startX, y: line.startY });
                addUnique({ x: line.endX, y: line.endY });
            });
            
            uniqueVertices.forEach(v => {
                drawCircleWithGlow(this.ctx, v.x, v.y, 4, 'rgba(0, 255, 255, 0.4)', '#00ffff', 1, 8);
            });
        }
        this.ctx.restore();

        // --- Process Hand Skeletal Landmarks & Audio plucks ---
        ['Left', 'Right'].forEach(side => {
            const landmarks = this.handsData[side];
            if (!landmarks) return;

            // Draw holographic hand skeleton conditionally
            if (this.state.showSkeleton && !this.state.pureMode) {
                this.drawHandSkeleton(landmarks, colors.joints);
            }

            const fingertips = [4, 8, 12, 16, 20];
            let maxSpeed = 0;
            let fastestTip = null;

            fingertips.forEach(joint => {
                const p = landmarks[joint];
                const prevKey = `${side}_${joint}`;
                const prevP = this.prevFingertips[prevKey];

                if (prevP) {
                    const speed = Math.hypot(p.x - prevP.x, p.y - prevP.y);
                    
                    // Spawn flow particles
                    if (speed > 4) {
                        const col = joint === 4 ? colors.primary : colors.secondary;
                        let pType = this.state.particleStyle;
                        if (pType === 'auto') {
                            pType = 'spark';
                            if (this.state.pattern === 'flower') pType = 'petal';
                            else if (this.state.pattern === 'well') pType = 'code';
                            else if (this.state.pattern === 'constellation') pType = 'galaxy';
                        }
                        
                        particles.spawn(p.x, p.y, col, Math.floor(speed / 4.5) + 1, pType, side, joint);
                    }

                    if (speed > maxSpeed) {
                        maxSpeed = speed;
                        fastestTip = p;
                    }
                }

                this.prevFingertips[prevKey] = { x: p.x, y: p.y };
            });

            // Fast finger plucks
            if (maxSpeed > 18) {
                let pluckY = fastestTip ? fastestTip.y / this.canvas.height : 0.5;
                synth.playPluck(maxSpeed * 3, pluckY);
                if (fastestTip) {
                    ripples.trigger(fastestTip.x, fastestTip.y, colors.joints);
                }
            }

            // Pattern specific ambient particles spawning on tips
            if (this.state.particleStyle === 'galaxy' || this.state.particleStyle === 'vortex' || this.state.pattern === 'constellation') {
                const pType = (this.state.particleStyle === 'galaxy' || this.state.particleStyle === 'vortex')
                    ? this.state.particleStyle
                    : 'galaxy';
                
                fingertips.forEach(joint => {
                    const p = landmarks[joint];
                    if (Math.random() < 0.22) {
                        particles.spawn(p.x, p.y, colors.joints, 1, pType, side, joint);
                    }
                });
            } else if (this.state.pattern === 'starry') {
                fingertips.forEach(joint => {
                    const p = landmarks[joint];
                    if (Math.random() < 0.12) {
                        particles.spawn(p.x, p.y, '#ffffff', 1, 'starry');
                    }
                });
            } else if (this.state.pattern === 'flower') {
                fingertips.forEach(joint => {
                    const p = landmarks[joint];
                    if (Math.random() < 0.08) {
                        particles.spawn(p.x, p.y, '#ff80af', 1, 'petal');
                    }
                });
            } else if (this.state.pattern === 'well') {
                fingertips.forEach(joint => {
                    const p = landmarks[joint];
                    if (Math.random() < 0.08) {
                        particles.spawn(p.x, p.y, '#00ff66', 1, 'code');
                    }
                });
            }
        });

        // --- Hands Touch Intersections ---
        if (this.handsData.Left && this.handsData.Right) {
            const lIndex = this.handsData.Left[8];
            const rIndex = this.handsData.Right[8];
            const d = Math.hypot(rIndex.x - lIndex.x, rIndex.y - lIndex.y);
            
            if (d < 30 && Math.random() < 0.08) {
                ripples.trigger((lIndex.x + rIndex.x)/2, (lIndex.y + rIndex.y)/2, '#ffff00');
                particles.spawn((lIndex.x + rIndex.x)/2, (lIndex.y + rIndex.y)/2, '#ffff00', 8, 'spark');
                synth.playPluck(110); // play high bell note
            }
        }

        // --- Challenge Matching Logic ---
        if (challenge.active) {
            challenge.update(this.handsData);
            challenge.draw(this.ctx);
        }

        // --- Render Cut Flashes ---
        this.ctx.save();
        this.cutFlashes = this.cutFlashes.filter(flash => {
            flash.life++;
            if (flash.life > flash.maxLife) return false;
            const progress = flash.life / flash.maxLife; // 0 to 1
            const inv = 1 - progress; // 1 to 0
            
            this.ctx.beginPath();
            this.ctx.arc(flash.x, flash.y, 10 + 30 * progress, flash.angle, flash.angle + Math.PI, false);
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${inv})`;
            this.ctx.lineWidth = 3 * inv + 1;
            this.ctx.stroke();
            return true;
        });
        this.ctx.restore();

        // --- Ink Mode: Hand-motion ink droplets ---
        if (this.state.artStyle === 'ink') {
            const inkDensity = this.state.inkDensity || 0.85;
            const inkColor = `rgba(26,26,26,${(0.3 + inkDensity * 0.5).toFixed(2)})`;
            ['Left', 'Right'].forEach(side => {
                const hand = this.handsData[side];
                if (!hand) return;
                [4, 8, 12, 16, 20].forEach(joint => {
                    const p = hand[joint];
                    const prevKey = `${side}_${joint}`;
                    const prevP = this._inkPrevPositions ? this._inkPrevPositions[prevKey] : null;
                    if (prevP) {
                        const speed = Math.hypot(p.x - prevP.x, p.y - prevP.y);
                        if (speed > 5) {
                            const count = Math.floor(Math.random() * 2 + 1);
                            particles.spawn(p.x, p.y, inkColor, count, 'ink-splash', side, joint);
                            // 30% chance to additionally spawn ink_drop
                            if (Math.random() < 0.3) {
                                const dropColor = `rgba(26,26,26,${(0.3 + inkDensity * 0.5).toFixed(2)})`;
                                particles.spawn(p.x, p.y, dropColor, 1, 'ink_drop', side, joint);
                            }
                        }
                    }
                    if (!this._inkPrevPositions) this._inkPrevPositions = {};
                    this._inkPrevPositions[prevKey] = { x: p.x, y: p.y };
                });
            });

            // Audio-synced ink drop spawning based on low-frequency energy
            if (!this._inkDropAudioCooldown) this._inkDropAudioCooldown = 0;
            if (typeof synth !== 'undefined' && synth.getAnalyserData) {
                const fftData = _cachedFFT;
                if (fftData) {
                    let lowEnergy = 0;
                    for (let i = 0; i < 10; i++) lowEnergy += fftData[i];
                    lowEnergy /= 10;
                    if (lowEnergy > 120 && Date.now() - this._inkDropAudioCooldown > 200) {
                        this._inkDropAudioCooldown = Date.now();
                        const audioInkColor = `rgba(26,26,26,${(0.4 + inkDensity * 0.4).toFixed(2)})`;
                        const cx = this.canvas.width / 2 + (Math.random() - 0.5) * 200;
                        const cy = this.canvas.height / 2 + (Math.random() - 0.5) * 100;
                        particles.spawn(cx, cy, audioInkColor, 1 + Math.floor(Math.random() * 2), 'ink_drop');
                        if (synth.playInkDropSound) {
                            try { synth.playInkDropSound(); } catch(e) {}
                        }
                    }
                }
            }
        }

        // --- Update & Draw Particles & Ripples ---
        particles.update();
        if (!this.state.pureMode) particles.draw(this.ctx);

        ripples.update();
        if (!this.state.pureMode) ripples.draw(this.ctx);

        this.drawCalligraphy();
        this.drawPatternGallery();
    },

    _POETRY_MAP: {
        'star': '迢迢牵牛星，皎皎河汉女。纤纤擢素手，札札弄机杼。',
        'flower': '花间一壶酒，独酌无相亲。举杯邀明月，对影成三人。',
        'well': '井底引银瓶，银瓶欲上丝绳绝。',
        'cradle': '星罗棋布映苍穹，纤指翻飞弄影踪。',
        'starry': '天阶夜色凉如水，坐看牵牛织女星。',
        'constellation': '云想衣裳花想容，春风拂槛露华浓。'
    },

    drawCalligraphy() {
        if (this.state.artStyle !== 'ink') return;
        
        const ctx = this.ctx;
        ctx.save();
        
        // Determine poetry text
        let text = '';
        if (this.state.poetryMode === 'jiangjinjiu') {
            text = '君不见黄河之水天上来\n奔流到海不复回\n君不见高堂明镜悲白发\n朝如青丝暮成雪';
        } else if (this.state.poetryMode === 'jingyesi') {
            text = '床前明月光\n疑是地上霜\n举头望明月\n低头思故乡';
        } else if (this.state.poetryMode === 'custom') {
            text = this.state.customPoetry;
        } else {
            // Use pattern-based poetry from POETRY_MAP
            const patternPoetry = this._POETRY_MAP[this.state.pattern];
            if (patternPoetry) text = patternPoetry;
        }

        // Poetry animation state
        if (!this._poetryProgress) {
            this._poetryProgress = { text: '', startTime: 0, phase: 'idle' };
        }
        const pp = this._poetryProgress;

        // Reset if text changed
        if (pp.text !== text) {
            pp.text = text;
            pp.startTime = performance.now();
            pp.phase = 'typing';
        }

        if (text && pp.phase !== 'done') {
            const elapsed = performance.now() - pp.startTime;
            const allChars = text.replace(/\n/g, '');
            const totalChars = allChars.length;
            const charInterval = 200; // ms per char
            const typingDuration = totalChars * charInterval;
            const dissolveDelay = 5000;
            const dissolveDuration = 2000;

            ctx.font = "20px 'LXGW WenKai Mono', 'Noto Sans SC', serif";
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const lines = text.split('\n');
            const startX = this.canvas.width - 50;
            const startY = 60;

            let charIdx = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (let j = 0; j < line.length; j++) {
                    const charTime = charIdx * charInterval;
                    if (elapsed < charTime) {
                        charIdx++;
                        continue; // Not yet visible
                    }
                    const charAge = elapsed - charTime;

                    // Progress-based concentration (浓→淡): first char darkest, last lightest
                    const progress = totalChars > 0 ? charIdx / totalChars : 0;
                    const progressAlpha = 1.0 - progress * 0.85;       // 1.0 -> 0.15
                    const progressBlur  = Math.max(0, 8 - progress * 7); // 8 -> 1
                    const r = Math.round(progress * 80);                 // 0 -> 80
                    const g = Math.round(progress * 70);                 // 0 -> 70
                    const b = Math.round(progress * 60);                 // 0 -> 60
                    const baseA = 0.85 - progress * 0.55;                // 0.85 -> 0.30

                    // Fade in over 200ms
                    let charAlpha = Math.min(1, charAge / 200) * progressAlpha;

                    // Ink-dry effect: extra shadowBlur at birth, decays over 500ms
                    const dryFactor = Math.min(1, charAge / 500);
                    const currentBlur = progressBlur + (1 - dryFactor) * 6;

                    // Dissolve phase
                    if (pp.phase === 'typing' && elapsed > typingDuration + dissolveDelay) {
                        pp.phase = 'dissolving';
                    }
                    if (pp.phase === 'dissolving') {
                        const dissolveElapsed = elapsed - typingDuration - dissolveDelay;
                        const dissolveAlpha = Math.max(0, 1 - dissolveElapsed / dissolveDuration);
                        charAlpha *= dissolveAlpha;
                        if (dissolveElapsed > dissolveDuration) {
                            pp.phase = 'done';
                        }
                    }

                    ctx.save();
                    ctx.font = "20px 'LXGW WenKai Mono', 'Noto Sans SC', serif";
                    ctx.globalAlpha = charAlpha;
                    ctx.fillStyle = `rgba(${r},${g},${b},${baseA.toFixed(2)})`;
                    ctx.shadowColor = `rgba(26,26,26,${(0.3 * (1 - progress)).toFixed(2)})`;
                    ctx.shadowBlur = currentBlur;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(line[j], startX - (i * 35), startY + (j * 28));
                    ctx.restore();

                    charIdx++;
                }
            }
        }

        // Reset state if done, so next pattern change re-triggers
        if (pp.phase === 'done') {
            pp.text = '';
            pp.startTime = 0;
            pp.phase = 'idle';
        }
        
        // Draw Red Signature Stamp (Bottom right corner)
        if (this.state.signature) {
            const stampSize = 44;
            const stampX = this.canvas.width - 80; 
            const stampY = this.canvas.height - 80;
            
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#C8483C';
            ctx.beginPath();
            ctx.roundRect(stampX, stampY, stampSize, stampSize, 4);
            ctx.fill();
            
            ctx.font = "bold 17px 'LXGW WenKai Mono', 'Noto Sans SC', serif";
            ctx.fillStyle = '#f5ecd7';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const sig = this.state.signature.padEnd(4, ' ');
            ctx.fillText(sig[0], stampX + stampSize*0.7, stampY + stampSize*0.3);
            ctx.fillText(sig[1], stampX + stampSize*0.7, stampY + stampSize*0.7);
            ctx.fillText(sig[2], stampX + stampSize*0.3, stampY + stampSize*0.3);
            ctx.fillText(sig[3], stampX + stampSize*0.3, stampY + stampSize*0.7);
        }
        ctx.restore();
    },

    drawClosedLoops() {
        if (!this.state.fillLoops || this.drawings.length < 3) return;
        
        // Task 18: Incremental cache — recompute graph/DFS only when drawings change
        if (this._drawingsDirty) {
        const mergeTolerance = 35;
        const vertices = [];
        const adj = {};
        
        function getVertex(p) {
            for (let i = 0; i < vertices.length; i++) {
                if (Math.hypot(vertices[i].x - p.x, vertices[i].y - p.y) < mergeTolerance) {
                    return i;
                }
            }
            vertices.push({ x: p.x, y: p.y });
            return vertices.length - 1;
        }
        
        this.drawings.forEach((line, idx) => {
            const u = getVertex({ x: line.startX, y: line.startY });
            const v = getVertex({ x: line.endX, y: line.endY });
            if (u !== v) {
                if (!adj[u]) adj[u] = [];
                if (!adj[v]) adj[v] = [];
                adj[u].push({ to: v, lineIdx: idx });
                adj[v].push({ to: u, lineIdx: idx });
            }
        });
        
        const visited = {};
        const cycles = [];
        const visitedLines = {};
        
        const dfs = (node, parent, path) => {
            visited[node] = true;
            path.push(node);
            
            const neighbors = adj[node] || [];
            for (const edge of neighbors) {
                if (visitedLines[edge.lineIdx]) continue;
                
                const nextNode = edge.to;
                visitedLines[edge.lineIdx] = true;
                
                if (visited[nextNode]) {
                    const cycleStartIdx = path.indexOf(nextNode);
                    if (cycleStartIdx !== -1) {
                        const cycle = path.slice(cycleStartIdx);
                        if (cycle.length >= 3) {
                            const cycleKey = [...cycle].sort().join(',');
                            if (!cycles.some(c => c.key === cycleKey)) {
                                cycles.push({ path: cycle, key: cycleKey });
                            }
                        }
                    }
                } else {
                    dfs(nextNode, node, path);
                }
                visitedLines[edge.lineIdx] = false;
            }
            
            path.pop();
            visited[node] = false;
        };
        
        for (let i = 0; i < vertices.length; i++) {
            dfs(i, -1, []);
        }
        
        
        this._cachedVertices = vertices;
        this._cachedAdj = adj;
        this._cachedCycles = cycles;
        this._drawingsDirty = false;
        } // end if (this._drawingsDirty)

        // Use cached results for drawing (executed every frame)
        const vertices = this._cachedVertices;
        const cycles = this._cachedCycles;
        const fillColor = hexToRgba(this.state.fillColor || '#00ffff', this.state.fillOpacity !== undefined ? this.state.fillOpacity : 0.3);
        
        this.ctx.save();
        this.ctx.fillStyle = fillColor;
        cycles.forEach(c => {
            this.ctx.beginPath();
            this.ctx.moveTo(vertices[c.path[0]].x, vertices[c.path[0]].y);
            for (let i = 1; i < c.path.length; i++) {
                this.ctx.lineTo(vertices[c.path[i]].x, vertices[c.path[i]].y);
            }
            this.ctx.closePath();
            this.ctx.fill();
        });
        this.ctx.restore();
    },

    drawActiveStringLoops() {
        if (!this.state.fillLoops) return;
        
        const vertices = [];
        const adj = {};
        const jointToIdx = {};
        
        const getVertexIdx = (hand, joint) => {
            const key = `${hand}_${joint}`;
            if (key in jointToIdx) return jointToIdx[key];
            const pos = this.handsData[hand] ? this.handsData[hand][joint] : null;
            if (!pos) return -1;
            vertices.push({ x: pos.x, y: pos.y, key });
            const idx = vertices.length - 1;
            jointToIdx[key] = idx;
            return idx;
        };

        // Construct graph from active strings
        Object.values(this.activeStrings).forEach(str => {
            if (str.cutIndex !== -1 || str.isFading || str.opacity <= 0) return;
            
            const u = getVertexIdx(str.anchorA.hand, str.anchorA.joint);
            const v = getVertexIdx(str.anchorB.hand, str.anchorB.joint);
            if (u !== -1 && v !== -1 && u !== v) {
                if (!adj[u]) adj[u] = [];
                if (!adj[v]) adj[v] = [];
                if (!adj[u].includes(v)) adj[u].push(v);
                if (!adj[v].includes(u)) adj[v].push(u);
            }
        });

        // Find cycles using DFS
        const visited = {};
        const cycles = [];
        
        const dfs = (node, parent, path) => {
            visited[node] = true;
            path.push(node);
            
            const neighbors = adj[node] || [];
            for (const neighbor of neighbors) {
                if (neighbor === parent) continue;
                
                if (visited[neighbor]) {
                    const startIdx = path.indexOf(neighbor);
                    if (startIdx !== -1) {
                        const cycle = path.slice(startIdx);
                        if (cycle.length >= 3) {
                            const key = [...cycle].sort().join(',');
                            if (!cycles.some(c => c.key === key)) {
                                cycles.push({ path: cycle, key });
                            }
                        }
                    }
                } else {
                    dfs(neighbor, node, path);
                }
            }
            
            path.pop();
            visited[node] = false;
        };

        for (let i = 0; i < vertices.length; i++) {
            dfs(i, -1, []);
        }

        // Fill loops with semi-transparent theme primary color
        const colors = this.getThemeColors();
        

        const fillAlpha = this.state.fillOpacity !== undefined ? this.state.fillOpacity : 0.3;
        const fillColor = hexToRgba(colors.primary, fillAlpha);

        this.ctx.save();
        this.ctx.fillStyle = fillColor;
        cycles.forEach(c => {
            this.ctx.beginPath();
            this.ctx.moveTo(vertices[c.path[0]].x, vertices[c.path[0]].y);
            for (let i = 1; i < c.path.length; i++) {
                this.ctx.lineTo(vertices[c.path[i]].x, vertices[c.path[i]].y);
            }
            this.ctx.closePath();
            this.ctx.fill();
        });
        this.ctx.restore();
    },

    getConvexHull(points) {
        if (points.length < 3) return points;
        
        points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
        
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        
        const lower = [];
        for (let i = 0; i < points.length; i++) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
                lower.pop();
            }
            lower.push(points[i]);
        }
        
        const upper = [];
        for (let i = points.length - 1; i >= 0; i--) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
                upper.pop();
            }
            upper.push(points[i]);
        }
        
        upper.pop();
        lower.pop();
        return lower.concat(upper);
    },

    drawConvexPolygon() {
        if (!this.state.convexPolygonMode) return;
        
        const points = [];
        const fingertips = [4, 8, 12, 16, 20];
        ['Left', 'Right'].forEach(side => {
            if (this.handsData[side]) {
                fingertips.forEach(joint => {
                    if (isJointEnabled(joint, this.state.enabledFingers)) {
                        points.push({ x: this.handsData[side][joint].x, y: this.handsData[side][joint].y });
                    }
                });
            }
        });
        
        if (points.length < 3) return;
        
        const hull = this.getConvexHull(points);
        if (hull.length < 3) return;
        
        
        const fillAlpha = this.state.fillOpacity !== undefined ? this.state.fillOpacity : 0.3;
        const fillColor = hexToRgba(this.state.convexPolygonColor, fillAlpha);
        
        this.ctx.save();
        this.ctx.fillStyle = fillColor;
        
        this.ctx.beginPath();
        this.ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) {
            this.ctx.lineTo(hull[i].x, hull[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        
        // Multi-layered glow instead of expensive shadowBlur
        const strokeColor = this.state.convexPolygonColor || '#ff00ff';
        const drawFn = () => {
            this.ctx.beginPath();
            this.ctx.moveTo(hull[0].x, hull[0].y);
            for (let i = 1; i < hull.length; i++) {
                this.ctx.lineTo(hull[i].x, hull[i].y);
            }
            this.ctx.closePath();
        };
        
        drawPathWithGlow(this.ctx, drawFn, strokeColor, 2.5, this.state.glowStrength);
        
        this.ctx.restore();
    },

    drawGridOverlay() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
        this.ctx.lineWidth = 1;
        const size = 65;
        
        for (let x = 0; x < this.canvas.width; x += size) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += size) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        this.ctx.restore();
    },

    drawHandSkeleton(landmarks, jointColor) {
        this.ctx.save();
        
        const isInk = this.state.artStyle === 'ink';
        // Draw semi-transparent skeleton bones
        this.ctx.strokeStyle = isInk ? 'rgba(26, 26, 26, 0.20)' : 'rgba(255, 255, 255, 0.35)';
        this.ctx.lineWidth = 2.5;

        const fingers = [
            [0, 1, 2, 3, 4],     // Thumb
            [0, 5, 6, 7, 8],     // Index
            [5, 9, 13, 17],      // Knuckles
            [0, 17, 18, 19, 20], // Pinky
            [9, 10, 11, 12],     // Middle
            [13, 14, 15, 16]     // Ring
        ];

        fingers.forEach(chain => {
            this.ctx.beginPath();
            this.ctx.moveTo(landmarks[chain[0]].x, landmarks[chain[0]].y);
            for (let i = 1; i < chain.length; i++) {
                this.ctx.lineTo(landmarks[chain[i]].x, landmarks[chain[i]].y);
            }
            this.ctx.stroke();
        });

        // Translucent palm polygon fill
        const ctx = this.ctx;
        ctx.fillStyle = isInk ? 'rgba(26, 26, 26, 0.02)' : 'rgba(255, 255, 255, 0.015)';
        ctx.beginPath();
        ctx.moveTo(landmarks[0].x, landmarks[0].y);
        ctx.lineTo(landmarks[5].x, landmarks[5].y);
        ctx.lineTo(landmarks[9].x, landmarks[9].y);
        ctx.lineTo(landmarks[13].x, landmarks[13].y);
        ctx.lineTo(landmarks[17].x, landmarks[17].y);
        ctx.closePath();
        ctx.fill();

        // Draw glowing nodes at joints with outer rings
        const time = performance.now() / 1000;
        const ripplePhase = (time % 1.5) / 1.5; // Loop 0->1 over 1.5 seconds
        const ripplePhase2 = ((time + 0.75) % 1.5) / 1.5; // Second delayed ripple
        
        const _nodeFill = isInk ? 'rgba(26,26,26,0.1)' : null;
        landmarks.forEach((lm, idx) => {
            // Draw outer circle rings for fingertips
            const fingertips = [4, 8, 12, 16, 20];
            if (fingertips.includes(idx)) {
                // Static outer ring
                drawCircleWithGlow(ctx, lm.x, lm.y, 8, _nodeFill || null, jointColor, 1, 0);
                
                // Animated Expanding Ripple
                if (this.state.enableFingerRipple && !isInk) {
                    const r1 = this.state.fingerRippleSize * ripplePhase;
                    const alpha1 = 1.0 - ripplePhase;
                    
                    const r2 = this.state.fingerRippleSize * ripplePhase2;
                    const alpha2 = 1.0 - ripplePhase2;
                    
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    
                    // Ripple 1
                    ctx.beginPath();
                    ctx.arc(lm.x, lm.y, r1, 0, 2 * Math.PI);
                    ctx.globalAlpha = alpha1;
                    ctx.strokeStyle = this.state.fingerRippleColor;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    
                    // Ripple 2
                    ctx.beginPath();
                    ctx.arc(lm.x, lm.y, r2, 0, 2 * Math.PI);
                    ctx.globalAlpha = alpha2;
                    ctx.stroke();
                    
                    ctx.restore();
                }
            }

            drawCircleWithGlow(ctx, lm.x, lm.y, 4, _nodeFill || jointColor, isInk ? null : jointColor, 0, 8);
        });

        this.ctx.restore();
    },

    // Task D: refresh cached action-btn rects after window layout changes
    _refreshActionBtnRects() {
        if (this._actionBtns) {
            this._actionBtns.forEach(btn => { btn._rect = btn.getBoundingClientRect(); });
        }
    },

    // Task 13: Draw dimension rift effect — 2-3 diagonal light rays from canvas center
    _drawRiftEffect(ctx, canvas) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxLen = Math.hypot(canvas.width, canvas.height) / 2;
        const angles = [-Math.PI / 6, 0, Math.PI / 6]; // -30°, 0°, +30°
        const startTime = performance.now();
        const duration = 600; // 0.6s total

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const t = elapsed / duration;
            if (t >= 1) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.globalCompositeOperation = 'screen';

            // Alpha envelope: quick rise then linear fade
            const alpha = Math.max(0, 1 - t);

            angles.forEach((angle, idx) => {
                const dx = Math.cos(angle) * maxLen;
                const dy = Math.sin(angle) * maxLen;

                const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(0.45, `rgba(255,255,255,${(0.5 * alpha).toFixed(2)})`);
                grad.addColorStop(0.5, `rgba(255,255,255,${(0.8 * alpha).toFixed(2)})`);
                grad.addColorStop(0.55, `rgba(255,255,255,${(0.5 * alpha).toFixed(2)})`);
                grad.addColorStop(1, 'rgba(255,255,255,0)');

                ctx.beginPath();
                ctx.moveTo(cx - dx, cy - dy);
                ctx.lineTo(cx + dx, cy + dy);
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2 + idx; // 2, 3, 4
                ctx.stroke();
            });

            ctx.restore();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    },

    // Task 14: Animate organic ink mask diffusion (200-600ms) over the canvas
    _animateInkMask(mainCanvas, isEntering) {
        if (!this._inkMaskCanvases || this._inkMaskCanvases.length === 0) return;

        const maskCanvas = this._inkMaskCanvases[Math.floor(Math.random() * this._inkMaskCanvases.length)];
        const wrapper = mainCanvas.parentElement;
        if (!wrapper) return;

        const overlay = document.createElement('canvas');
        overlay.width = mainCanvas.width;
        overlay.height = mainCanvas.height;
        overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:999;object-fit:contain;';
        wrapper.appendChild(overlay);

        const ctx = overlay.getContext('2d');
        const startTime = performance.now();
        const delay = 200; // Start at 200ms (after rift 0-200ms)
        const duration = 400; // 200-600ms

        const animate = () => {
            const now = performance.now();
            const elapsed = now - startTime;
            if (elapsed < delay) {
                requestAnimationFrame(animate);
                return;
            }
            const t = Math.min(1, (elapsed - delay) / duration);
            if (t >= 1) {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                return;
            }

            ctx.clearRect(0, 0, overlay.width, overlay.height);
            ctx.save();
            // Fill with ink (entering) or paper (exiting) color
            ctx.fillStyle = isEntering ? 'rgba(26,26,26,0.2)' : 'rgba(245,236,215,0.2)';
            ctx.fillRect(0, 0, overlay.width, overlay.height);
            // Keep only where mask overlaps via destination-in
            ctx.globalCompositeOperation = 'destination-in';
            const scale = 0.3 + t * 0.7; // 0.3 → 1.0
            const drawW = overlay.width * scale;
            const drawH = overlay.height * scale;
            ctx.drawImage(maskCanvas,
                overlay.width / 2 - drawW / 2,
                overlay.height / 2 - drawH / 2,
                drawW, drawH);
            ctx.restore();

            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    },

    drawInkLoadingSplash() {
        this._inkLoadingActive = true;
        const canvas = this.canvas;
        const ctx = this.ctx;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const startTime = performance.now();
        const totalTime = 1700; // ~1700ms total duration

        // Logarithmic spiral parameters: r = a * e^(b*θ), b=0.2
        const a = 2;
        const b = 0.2;
        const maxTheta = 4 * Math.PI;

        // Helper: draw spiral up to currentMaxTheta with given alpha/lineWidth/scale
        const drawSpiral = (currentMaxTheta, alpha, lineWidth, scale = 1) => {
            ctx.beginPath();
            for (let theta = 0; theta <= currentMaxTheta; theta += 0.1) {
                const r = a * Math.exp(b * theta) * scale;
                const x = cx + r * Math.cos(theta);
                const y = cy + r * Math.sin(theta);
                if (theta === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(26,26,26,${alpha.toFixed(2)})`;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        };

        const animate = () => {
            const now = performance.now();
            const elapsed = now - startTime;

            ctx.save();
            ctx.fillStyle = '#f5ecd7';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (elapsed < 400) {
                // Phase 1 (0-400ms, progress 0-0.235): spiral gradually unfolds
                const t = elapsed / 400;
                const currentMaxTheta = maxTheta * t;
                drawSpiral(currentMaxTheta, 0.6, 2);
            } else if (elapsed < 1200) {
                // Phase 2 (400-1200ms, progress 0.235-0.706): ripples + spiral thickens
                const t = (elapsed - 400) / 800;
                const lineWidth = 2 + t * 3; // thickens from 2 to 5
                drawSpiral(maxTheta, 0.6, lineWidth);

                // Ink ripple diffusion (3-5 concentric arcs, alpha decreasing)
                const outerR = a * Math.exp(b * maxTheta);
                const rippleCount = 5;
                for (let r = 0; r < rippleCount; r++) {
                    const rProgress = Math.min(1, t * 1.5 - r * 0.15);
                    if (rProgress <= 0 || rProgress > 1) continue;
                    const rRadius = outerR * (0.4 + rProgress * 0.9);
                    const rAlpha = 0.4 * (1 - rProgress);
                    ctx.beginPath();
                    ctx.arc(cx, cy, rRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(26,26,26,${rAlpha.toFixed(2)})`;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            } else {
                // Phase 3 (1200-1700ms, progress 0.706-1.0): spiral contracts inward, alpha to 0
                const t = (elapsed - 1200) / 500;
                const alpha = 0.6 * (1 - t);
                const scale = 1 - t * 0.7;
                drawSpiral(maxTheta, alpha, 2, scale);
            }
            ctx.restore();

            if (elapsed < totalTime) {
                requestAnimationFrame(animate);
            } else {
                this._inkLoadingActive = false;
            }
        };
        requestAnimationFrame(animate);
    },

    _PATTERN_LORE: {
        'star': { name: '星', poem: '迢迢牵牛星', lore: '源于古代天文观测，五角星象征星辰运行轨迹，是翻绳游戏中最基础的图案。' },
        'starry': { name: '云', poem: '天阶夜色凉如水', lore: '星空图案映射银河繁星，手指间的线条如同星图上的连线。' },
        'cradle': { name: '桥', poem: '星罗棋布映苍穹', lore: '猫的摇篮象征生命循环，翻绳游戏在世界各地有超过两千年的历史。' },
        'flower': { name: '花', poem: '花间一壶酒', lore: '花朵图案展现自然之美，翻绳中的花卉造型在各文化中均有传承。' },
        'well': { name: '井', poem: '井底引银瓶', lore: '井字形如古井辘轳，银瓶丝绳，寓意生活中的牵引与期盼。' },
        'constellation': { name: '网', poem: '云想衣裳花想容', lore: '网状图案象征天地经纬，指尖编织间暗合宇宙秩序。' }
    },

    drawPatternGallery() {
        if (this.state.artStyle !== 'ink') return;
        const ctx = this.ctx;
        const pattern = this.state.pattern || '';

        // Track pattern changes for flip animation
        if (!this._galleryState) {
            this._galleryState = { pattern: '', flipProgress: 1, flipStart: 0 };
        }
        const gs = this._galleryState;
        if (gs.pattern !== pattern) {
            gs.pattern = pattern;
            gs.flipProgress = 0;
            gs.flipStart = performance.now();
        }
        // Update flip progress
        if (gs.flipProgress < 1) {
            gs.flipProgress = Math.min(1, (performance.now() - gs.flipStart) / 200);
        }

        // Pattern display names
        const names = {
            'star': '星', 'flower': '花', 'well': '井',
            'cradle': '摇篮', 'starry': '星夜', 'constellation': '星座',
            'default': '绳结'
        };
        const displayName = names[pattern] || names['default'];

        const bookX = 15;
        const bookY = 15;
        const bookW = 120;
        const bookH = 160;

        ctx.save();

        // Flip animation: scale X to simulate page turn
        const flipScale = gs.flipProgress < 0.5
            ? (1 - gs.flipProgress * 2) // shrink from 1 to 0
            : ((gs.flipProgress - 0.5) * 2); // grow from 0 to 1
        const centerX = bookX + bookW / 2;
        const centerY = bookY + bookH / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(Math.max(0.05, flipScale), 1);
        ctx.translate(-centerX, -centerY);

        // Book page background
        ctx.fillStyle = 'rgba(245,236,215,0.9)';
        ctx.fillRect(bookX, bookY, bookW, bookH);

        // Brown border
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bookX, bookY, bookW, bookH);

        // Binding lines on left side
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        const bindX = bookX + 12;
        for (let i = 0; i < 3; i++) {
            const by = bookY + 30 + i * 50;
            ctx.beginPath();
            ctx.moveTo(bindX, by - 8);
            ctx.lineTo(bindX, by + 8);
            ctx.stroke();
            // Small dot for binding knot
            ctx.beginPath();
            ctx.arc(bindX, by, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#8B4513';
            ctx.fill();
        }

        // Vertical pattern name
        ctx.font = "bold 28px 'LXGW WenKai Mono', 'Noto Sans SC', serif";
        ctx.fillStyle = 'rgba(26,26,26,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = bookX + bookW * 0.6;
        const textStartY = bookY + 35;
        for (let i = 0; i < displayName.length; i++) {
            ctx.fillText(displayName[i], textX, textStartY + i * 35);
        }

        // Cultural lore (vertical small text, ink mode)
        const lore = this._PATTERN_LORE[pattern];
        if (lore) {
            ctx.font = "12px 'LXGW WenKai Mono', 'Noto Sans SC', serif";
            ctx.fillStyle = 'rgba(80,70,60,0.5)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const loreX = bookX + bookW * 0.28;
            const loreStartY = bookY + 25;
            const loreChars = lore.lore.replace(/[\s\n，。、；：]/g, '').slice(0, 18);
            for (let i = 0; i < loreChars.length; i++) {
                ctx.fillText(loreChars[i], loreX, loreStartY + i * 13);
            }
            // Update DOM lore elements if present
            const loreTitleEl = document.getElementById('lore-title');
            const lorePoemEl = document.getElementById('lore-poem');
            const loreDescEl = document.getElementById('lore-desc');
            if (loreTitleEl) loreTitleEl.innerText = lore.name;
            if (lorePoemEl) lorePoemEl.innerText = lore.poem;
            if (loreDescEl) loreDescEl.innerText = lore.lore;
        }

        ctx.restore();
    },

    // Task A: Idempotent resource teardown — safe to call multiple times
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        // Stop RAF render loop
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this._btnRafId) {
            cancelAnimationFrame(this._btnRafId);
            this._btnRafId = null;
        }

        // Clear all named timers
        if (this.tipsTimer) { clearInterval(this.tipsTimer); this.tipsTimer = null; }
        if (this.recordTimer) { clearInterval(this.recordTimer); this.recordTimer = null; }

        // Stop camera stream tracks (MediaPipe Camera has no stop() method)
        if (this.video && this.video.srcObject) {
            try {
                this.video.srcObject.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
            } catch (e) {}
            this.video.srcObject = null;
        }

        // Remove key window/document listeners
        if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
        if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
        if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
        if (this.beforeUnloadHandler) window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        if (this.audioUnlockHandler) document.body.removeEventListener('click', this.audioUnlockHandler);

        // Remove action-btn mousemove/mouseenter listeners (Task D)
        if (this._btnMouseMoveHandler && this._actionBtns) {
            this._actionBtns.forEach(btn => {
                try {
                    btn.removeEventListener('mouseenter', this._btnMouseEnterHandler);
                    btn.removeEventListener('mousemove', this._btnMouseMoveHandler);
                } catch (e) {}
            });
        }

        // Remove canvas mouse tracking listeners (Task 1)
        if (this._onMouseMove && this.canvas) {
            try {
                this.canvas.removeEventListener('mousemove', this._onMouseMove);
                this.canvas.removeEventListener('pointermove', this._onMouseMove);
            } catch (e) {}
        }

        // Dispose audio synthesizer
        try { if (window.synth && typeof synth.dispose === 'function') synth.dispose(); } catch (e) {}

        try { logger.log('Application resources released (destroy).', 'info'); } catch (e) {}
    }
};

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => app.init().catch(e => {
    console.error('App initialization failed:', e);
}));
