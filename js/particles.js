const CYBER_PALETTE = {
    bg: '#080a0d',
    primary: '#7B9EB8',    // 莫兰迪蓝灰
    secondary: '#9B8EA3',  // 烟紫
    highlight: '#B8A89A',  // 暖灰金
    maxAlpha: 0.35
};

// 安全的颜色 alpha 替换 - 仅对 rgba 格式生效
function safeReplaceAlpha(color, newAlpha) {
    if (color && color.startsWith('rgba')) {
        return color.replace(/[\d.]+\)$/, newAlpha + ')');
    }
    return color; // 非 rgba 格式直接返回原色
}

class ParticleSystem {
    constructor() {
        this.maxParticles = 1500;
        this.pool = [];
        this.freeList = [];
        this.activeIndices = [];
        this.audioEnergy = 0;
        for (let i = 0; i < this.maxParticles; i++) {
            this.pool.push({
                active: false,
                x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '', type: '',
                startX: 0, startY: 0, decay: 0, alpha: 1, angle: 0,
                vAngle: 0, wObble: 0, radius: 0, char: '0', trajectory: '',
                speed: 0, path: null, leafBuds: null, shape: 'circle', glowStrength: 0,
                anchorHand: null, anchorJoint: null,
                prevX: 0, prevY: 0, landed: false, landTime: 0, initialSpeed: 0, age: 0
            });
            this.freeList.push(i);
        }
    }

    spawn(x, y, color, count = 2, type = 'spark', hand = null, joint = null) {
        if (app.state.particlesEnabled === false) return;

        const speedMultiplier = app.state.particleSpeed !== undefined ? app.state.particleSpeed : 1.0;
        const countOverride = app.state.particleCount !== undefined ? app.state.particleCount : count;
        
        // Lifespan maps to decay rate (assuming 30fps average decay)
        const lifespanVal = app.state.particleLifespan !== undefined ? app.state.particleLifespan : 3.0;
        const decayRate = 1.0 / (lifespanVal * 30.0);

        const trajectory = app.state.particleTrajectory || 'explode';
        const sizeBase = app.state.particleSize !== undefined ? app.state.particleSize : 3.0;
        const sizeMult = sizeBase / 3.0;

        // Resolve Color overrides
        let spawnColor = color;
        const colorOpt = app.state.particleColorType || 'theme';
        if (colorOpt === 'white') spawnColor = '#ffffff';
        else if (colorOpt === 'rainbow') {
            const hues = ['#ff007f', '#00ffff', '#00ff66', '#aa00ff', '#ffff00', '#ff9500'];
            spawnColor = hues[Math.floor(Math.random() * hues.length)];
        } else if (colorOpt === 'custom') {
            spawnColor = app.state.particleCustomColor || '#00ffff';
        }

        let spawned = 0;
        while (spawned < countOverride && this.freeList.length > 0) {
            const index = this.freeList.pop();
            this.activeIndices.push(index);
            const p = this.pool[index];
            p.active = true;
                p.x = x;
                p.y = y;
                p.startX = x;
                p.startY = y;
                p.anchorHand = hand;
                p.anchorJoint = joint;
                
                const angle = app.state.particleCircleSpread 
                    ? (spawned / countOverride) * Math.PI * 2 
                    : Math.random() * Math.PI * 2;
                const speed = (Math.random() * 2.2 + 0.5) * speedMultiplier;
                
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
                p.speed = speed;
                
                let size = (Math.random() * 3 + 1.5) * sizeMult;
                if (type === 'petal') {
                    size = (Math.random() * 4 + 4) * sizeMult;
                } else if (type === 'code') {
                    size = (Math.random() * 3 + 3) * sizeMult;
                } else if (type === 'leaf') {
                    size = (Math.random() * 5 + 4) * sizeMult;
                } else if (type === 'vine') {
                    size = (Math.random() * 2 + 1.5) * sizeMult;
                } else if (type === 'ink') {
                    size = (Math.random() * 4 + 4) * sizeMult;
                } else if (type === 'galaxy' || type === 'vortex') {
                    size = (Math.random() * 1.8 + 1.2) * sizeMult;
                } else if (type === 'ink-splash') {
                    size = (Math.random() * 6 + 2) * (app.state.inkDensity || 0.85);
                } else if (type === 'ink-collision') {
                    size = Math.random() * 4 + 3;
                } else if (type === 'ink-dust') {
                    size = 1.5;
                }
                p.size = size;
                p.color = spawnColor;
                p.type = type;
                p.decay = decayRate;
                p.alpha = 1;
                p.angle = Math.random() * Math.PI * 2;
                p.vAngle = (Math.random() - 0.5) * 0.06;
                p.wObble = Math.random() * 100;
                p.radius = (type === 'galaxy' || type === 'vortex') ? (Math.random() * 35 + 8) : (Math.random() * 5 + 2);
                p.char = Math.random() < 0.5 ? '0' : '1';
                p.trajectory = type === 'fireworks' ? 'explode' : trajectory;
                p.shape = app.state.particleShape || 'circle';
                p.glowStrength = app.state.particleGlow || 0;
                p.age = 0;
                p.prevX = 0; p.prevY = 0;
                p.landed = false; p.landTime = 0; p.initialSpeed = 0;
                
                // 重置赛博氛围粒子专属属性
                p.depthLayer = undefined;
                p.homeX = undefined;
                p.homeY = undefined;
                p.trail = null;
                p.age = 0;
                p.audioReactive = false;
                
                if (type === 'vine') {
                    p.path = [{ x, y }];
                    p.leafBuds = [];
                } else {
                    p.path = null;
                    p.leafBuds = null;
                }

                if (type === 'ink-splash') {
                    p.vx = (Math.random() - 0.5) * 4;
                    p.vy = (Math.random() - 0.5) * 4 - 1;
                    p.decay = 0.005 + Math.random() * 0.003;
                    p.prevX = p.x;
                    p.prevY = p.y;
                    p.landed = false;
                    p.landTime = 0;
                } else if (type === 'ink-collision') {
                    const cAngle = Math.random() * Math.PI * 2;
                    const cSpeed = Math.random() * 6 + 3;
                    p.vx = Math.cos(cAngle) * cSpeed;
                    p.vy = Math.sin(cAngle) * cSpeed;
                    p.decay = 0.015 + Math.random() * 0.01;
                    p.prevX = p.x;
                    p.prevY = p.y;
                    p.angle = cAngle;
                    p.initialSpeed = cSpeed;
                } else if (type === 'ink_drop') {
                    const inkDensity = (typeof app !== 'undefined' && app.state) ? (app.state.inkDensity || 0.8) : 0.8;
                    p.size = (Math.random() * 4 + 3) * inkDensity;
                    p.vy = 1 + Math.random() * 2;
                    p.vx = (Math.random() - 0.5) * 2;
                    p.decay = 0.003;
                    p.landed = false;
                    p.landTime = 0;
                } else if (type === 'ink-dust') {
                    p.gravity = 0.08;
                    p.friction = 0.96;
                    p.alpha = 0.4;
                    p.decay = 0.008;
                    p.size = 1.5;
                }

                // 赛博氛围粒子 particleStyle 初始化
                const pStyle = (typeof app !== 'undefined' && app.state) ? app.state.particleStyle : 'auto';
                switch (pStyle) {
                    case 'dust':
                        p.vx *= 0.33;
                        p.vy *= 0.33;
                        p.depthLayer = Math.random() < 0.5 ? 0 : 1;
                        p.age = 0;
                        p.decay = 0.001;
                        break;
                    case 'grid': {
                        const gridSize = 30;
                        p.homeX = Math.round(x / gridSize) * gridSize;
                        p.homeY = Math.round(y / gridSize) * gridSize;
                        p.x = p.homeX;
                        p.y = p.homeY;
                        p.vx = 0;
                        p.vy = 0;
                        p.decay = 0.0005;
                        break;
                    }
                    case 'proximity':
                        p.size = 80 + Math.random() * 120;
                        p.vx = (Math.random() - 0.5) * 0.5;
                        p.vy = (Math.random() - 0.5) * 0.5;
                        p.decay = 0.0003;
                        break;
                    case 'datastream':
                        p.vx = (Math.random() - 0.5) * 0.5;
                        p.vy = (Math.random() - 0.5) * 0.5;
                        p.decay = 0.001;
                        break;
                    case 'parallax': {
                        p.depthLayer = Math.random() < 0.5 ? 0 : (Math.random() < 0.7 ? 1 : 2);
                        const speeds = [0.15, 0.4, 0.8];
                        const sp = speeds[p.depthLayer];
                        const ang = Math.random() * Math.PI * 2;
                        p.vx = Math.cos(ang) * sp;
                        p.vy = Math.sin(ang) * sp;
                        p.decay = 0.0008;
                        break;
                    }
                    case 'bokeh':
                        p.size = 8 + Math.random() * 12;
                        p.vx = (Math.random() - 0.5) * 0.3;
                        p.vy = (Math.random() - 0.5) * 0.3;
                        p.depthLayer = Math.floor(Math.random() * 3);
                        p.colorIdx = Math.floor(Math.random() * 3);
                        p.decay = 0.003 + Math.random() * 0.002;
                        p.audioReactive = true;
                        break;
                    case 'cursorSand':
                        if (typeof app !== 'undefined' && app.mouseX !== undefined) {
                            p.x = app.mouseX + (Math.random() - 0.5) * 10;
                            p.y = app.mouseY + (Math.random() - 0.5) * 10;
                            p.vx = (Math.random() - 0.5) * 2;
                            p.vy = -Math.random() * 2;
                        } else {
                            p.vx = (Math.random() - 0.5) * 2;
                            p.vy = -Math.random() * 2;
                        }
                        p.gravity = 0.15;
                        p.friction = 0.97;
                        p.size = 1 + Math.random() * 2;
                        p.decay = 0.012;
                        p.audioReactive = true;
                        break;
                    case 'trail':
                        p.trail = [];
                        p.decay = 0.003;
                        break;
                }
                
                spawned++;
        }
    }

    update() {
        for (let i = this.activeIndices.length - 1; i >= 0; i--) {
            const index = this.activeIndices[i];
            const p = this.pool[index];
            if (!p.active) continue;
            p.age = (p.age || 0) + 1;
            
            if ((p.type === 'galaxy' || p.type === 'vortex') && p.anchorHand && app.handsData[p.anchorHand]) {
                const finger = app.handsData[p.anchorHand][p.anchorJoint];
                if (finger) {
                    p.startX = finger.x;
                    p.startY = finger.y;
                }
                
                if (p.type === 'vortex') {
                    p.angle += p.speed * 0.05 + 0.04;
                    p.radius = Math.max(2, p.radius - 0.2);
                    p.x = p.startX + Math.cos(p.angle) * p.radius;
                    p.y = p.startY + Math.sin(p.angle) * p.radius;
                } else {
                    p.angle += 0.06;
                    p.radius += p.speed * 0.4;
                    p.x = p.startX + Math.cos(p.angle) * p.radius;
                    p.y = p.startY + Math.sin(p.angle) * p.radius;
                }
            } else if (p.type === 'fireworks') {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05; // Gravity pull
            } else {
                // Apply custom trajectories
                if (p.trajectory === 'none') {
                    // Zero movement
                } else if (p.trajectory === 'spiral') {
                    p.radius += p.speed;
                    p.angle += 0.06;
                    p.x = p.startX + Math.cos(p.angle) * p.radius;
                    p.y = p.startY + Math.sin(p.angle) * p.radius;
                } else if (p.trajectory === 'fountain') {
                    if (p.radius > 0) {
                        p.vy = -Math.abs(p.vy) * 1.35;
                        p.radius = 0;
                    }
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.09;
                } else if (p.trajectory === 'drift') {
                    p.x += Math.abs(p.vx) * 0.8 + 0.6;
                    p.y += p.vy + Math.sin(p.wObble) * 0.4;
                    p.wObble += 0.08;
                } else {
                    // Standard 'explode'
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.type === 'petal') {
                        p.x += Math.sin(p.wObble) * 0.4;
                        p.y += p.vy * 0.4 + 0.6;
                        p.wObble += 0.04;
                        p.angle += p.vAngle * 0.5;
                    } else if (p.type === 'leaf') {
                        p.x += Math.sin(p.wObble) * 1.6;
                        p.y += p.vy * 0.4 + 0.7;
                        p.wObble += 0.05;
                        p.angle += p.vAngle;
                    } else if (p.type === 'vine') {
                        p.x += p.vx + Math.sin(p.wObble) * 1.5;
                        p.y += p.vy + Math.cos(p.wObble) * 1.5;
                        p.wObble += 0.08;
                        p.vx *= 0.95;
                        p.vy *= 0.95;

                        if (p.path) {
                            p.path.push({ x: p.x, y: p.y });
                            if (p.path.length > 20) p.path.shift();
                        }
                        
                        if (Math.random() < 0.22 && p.leafBuds) {
                            p.leafBuds.push({
                                x: p.x,
                                y: p.y,
                                size: p.size * (Math.random() * 0.6 + 0.8),
                                angle: Math.random() * Math.PI * 2,
                                side: Math.random() < 0.5 ? -1 : 1
                            });
                        }
                    } else if (p.type === 'ink') {
                        p.x += p.vx * 0.90;
                        p.y += p.vy * 0.90;
                        p.size += 0.28;
                    } else if (p.type === 'ink-splash') {
                        p.prevX = p.x;
                        p.prevY = p.y;
                        p.vy += 0.15;
                        p.vx *= 0.96;
                        p.vy *= 0.96;
                        p.size += 0.15;
                        if (app.state.artStyle === 'ink') {
                            p.decay *= 0.997;
                        }
                        if (!p.landed && p.age > 30 && Math.abs(p.vy) < 0.5) {
                            p.landed = true;
                            p.landTime = p.age;
                            p.vx = 0;
                            p.vy = 0;
                        }
                        if (p.landed) {
                            p.size += 0.05;
                            p.alpha *= 0.995;
                        }
                    } else if (p.type === 'ink-collision') {
                        p.prevX = p.x;
                        p.prevY = p.y;
                        p.vx *= 0.92;
                        p.vy *= 0.92;
                        p.vy += 0.08;
                        p.size *= 0.995;
                        if (app.state.artStyle === 'ink') {
                            p.decay *= 0.998;
                        }
                    } else if (p.type === 'ink_drop') {
                        if (!p.landed) {
                            p.vy += 0.12;
                            p.vx *= 0.98;
                            p.vy *= 0.98;
                            if (p.alpha < 0.5 || (p.age || 0) > 120) {
                                p.landed = true;
                                p.landTime = Date.now();
                                const stainCtx = (typeof app !== 'undefined' && typeof app.getInkStainCtx === 'function') ? app.getInkStainCtx() : null;
                                if (stainCtx) {
                                    stainCtx.save();
                                    const r = p.size * 1.5;
                                    const grad = stainCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                                    grad.addColorStop(0, 'rgba(26,26,26,0.12)');
                                    grad.addColorStop(0.6, 'rgba(26,26,26,0.06)');
                                    grad.addColorStop(1, 'rgba(26,26,26,0.01)');
                                    stainCtx.fillStyle = grad;
                                    stainCtx.shadowBlur = 3 + Math.random() * 3;
                                    stainCtx.shadowColor = 'rgba(26,26,26,0.1)';
                                    stainCtx.beginPath();
                                    stainCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
                                    stainCtx.fill();
                                    stainCtx.restore();
                                }
                                if (typeof particles !== 'undefined') {
                                    const splashCount = 2 + Math.floor(Math.random() * 2);
                                    particles.spawn(p.x, p.y, 'rgba(26,26,26,0.2)', splashCount, 'ink-splash');
                                }
                            }
                        } else {
                            p.alpha *= 0.9;
                            if (p.alpha < 0.05) p.alpha = 0;
                        }
                        p.age = (p.age || 0) + 1;
                    }
                }
            }

            // ink-dust 重力摩擦物理
            if (p.type === 'ink-dust') {
                p.vy += p.gravity || 0.08;
                p.vx *= p.friction || 0.96;
                p.vy *= p.friction || 0.96;
                if (p.y > (typeof app !== 'undefined' && app.canvas ? app.canvas.height : 600) - 5) {
                    p.vy = 0;
                    p.vx *= 0.8;
                    p.decay *= 3;
                }
            }

            // 赛博氛围粒子 particleStyle 物理更新
            const pStyle = (typeof app !== 'undefined' && app.state) ? app.state.particleStyle : 'auto';
            switch (pStyle) {
                case 'dust':
                    p.x += Math.sin((p.age || 0) * 0.02) * 0.3;
                    p.age = (p.age || 0) + 1;
                    break;
                case 'grid':
                    if (typeof app !== 'undefined' && app.mouseX !== undefined) {
                        const dx = p.x - app.mouseX;
                        const dy = p.y - app.mouseY;
                        const dist = Math.hypot(dx, dy);
                        if (dist < 80 && dist > 0) {
                            const force = (80 - dist) * 0.3;
                            p.vx += (dx / dist) * force * 0.05;
                            p.vy += (dy / dist) * force * 0.05;
                        }
                    }
                    if (p.homeX !== undefined) {
                        p.vx += (p.homeX - p.x) * 0.05;
                        p.vy += (p.homeY - p.y) * 0.05;
                    }
                    p.vx *= 0.92;
                    p.vy *= 0.92;
                    break;
                case 'proximity':
                    if (p.x < -100 || p.x > (typeof app !== 'undefined' && app.canvas ? app.canvas.width + 100 : 2000)) p.vx *= -1;
                    if (p.y < -100 || p.y > (typeof app !== 'undefined' && app.canvas ? app.canvas.height + 100 : 2000)) p.vy *= -1;
                    break;
                case 'datastream':
                    if (typeof app !== 'undefined' && app.mouseX !== undefined) {
                        const dx = app.mouseX - p.x;
                        const dy = app.mouseY - p.y;
                        const dist = Math.max(Math.hypot(dx, dy), 50);
                        const force = 0.02 / dist;
                        p.vx += dx * force;
                        p.vy += dy * force;
                    }
                    p.vx *= 0.7;
                    p.vy *= 0.7;
                    break;
                case 'parallax':
                    if (typeof app !== 'undefined' && app.mouseX !== undefined) {
                        const responses = [0.02, 0.05, 0.1];
                        const mr = responses[p.depthLayer || 0];
                        const dx = (app.mouseX - p.x) * mr * 0.01;
                        const dy = (app.mouseY - p.y) * mr * 0.01;
                        p.vx += dx;
                        p.vy += dy;
                    }
                    break;
                case 'cursorSand':
                    p.vy += p.gravity || 0.15;
                    p.vx *= p.friction || 0.97;
                    p.vy *= p.friction || 0.97;
                    break;
                case 'trail':
                    if (!p.trail) p.trail = [];
                    p.trail.push({ x: p.x, y: p.y });
                    if (p.trail.length > 8) p.trail.shift();
                    break;
                case 'bokeh':
                    // bokeh 使用默认漂移 + 音频反应，无需特殊物理
                    break;
            }
            if (['dust', 'grid', 'proximity', 'datastream', 'parallax', 'trail', 'bokeh', 'cursorSand'].includes(pStyle)) {
                p.alpha = Math.min(p.alpha, CYBER_PALETTE.maxAlpha);
            }

            // Hand joint force field
            if (typeof app !== 'undefined' && app.activeHandLandmarks) {
                for (const hand of app.activeHandLandmarks) {
                    if (!hand || !hand.length) continue;
                    for (let j = 0; j < hand.length; j++) {
                        const jx = hand[j].x;
                        const jy = hand[j].y;
                        const fdx = p.x - jx;
                        const fdy = p.y - jy;
                        const fdist = Math.hypot(fdx, fdy);
                        if (fdist < 100 && fdist > 0.1) {
                            const force = Math.min((100 - fdist) / 100 * 0.5, 0.5);
                            p.vx += (fdx / fdist) * force;
                            p.vy += (fdy / fdist) * force;
                        }
                    }
                }
            }

            // Audio reactive pulse
            if (p.audioReactive && this.audioEnergy > 0) {
                p.size *= 1 + this.audioEnergy * 0.3;
                p.alpha = Math.min(p.alpha * (1 + this.audioEnergy * 0.15), CYBER_PALETTE.maxAlpha);
            }

            let currentDecay = p.decay;
            if (app.state.artStyle === 'ink') {
                currentDecay *= 1.20; // 20% faster decay
            }
            p.alpha -= currentDecay;
            if (p.alpha <= 0) {
                p.active = false;
                this.freeList.push(index);
                // swap-remove: O(1) 替代 splice 的 O(n)
                // 循环从后往前遍历，被 swap 上来的元素已处理过，无需 i--
                this.activeIndices[i] = this.activeIndices[this.activeIndices.length - 1];
                this.activeIndices.pop();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        for (let i = 0; i < this.activeIndices.length; i++) {
            const index = this.activeIndices[i];
            const p = this.pool[index];
            if (!p.active) continue;
            
            ctx.save();
            ctx.globalAlpha = p.alpha;
            
            // Outer glow if enabled
            const glow = p.glowStrength || 0;
            if (glow > 0) {
                ctx.save();
                ctx.globalAlpha = p.alpha * 0.15;
                ctx.fillStyle = p.color;
                ctx.strokeStyle = p.color;
                this.drawParticleShape(ctx, p, glow * 2.0);
                ctx.restore();
            }
            
            // Main shape draw
            ctx.fillStyle = p.color;
            ctx.strokeStyle = p.color;
            this.drawParticleShape(ctx, p, 0);
            ctx.restore();
        }
        ctx.restore();
    }

    drawParticleShape(ctx, p, sizeOffset = 0) {
        const pStyle = (typeof app !== 'undefined' && app.state) ? app.state.particleStyle : 'auto';
        switch (pStyle) {
            case 'dust': this.drawDust(ctx, p, sizeOffset); return;
            case 'trail': this.drawTrail(ctx, p, sizeOffset); return;
            case 'proximity': this.drawProximity(ctx, p, sizeOffset); return;
            case 'grid': this.drawGrid(ctx, p, sizeOffset); return;
            case 'datastream': this.drawDatastream(ctx, p, sizeOffset); return;
            case 'parallax': this.drawParallax(ctx, p, sizeOffset); return;
            case 'bokeh': this.drawBokeh(ctx, p, sizeOffset); return;
            case 'cursorSand': this.drawCursorSand(ctx, p, sizeOffset); return;
        }
        // 以下现有逻辑保持不变（作为 default/legacy 路径）
        if (p.type === 'galaxy' || p.type === 'vortex') {
            ctx.save();
            const rad = p.size + sizeOffset * 0.5;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 2.2);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, p.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad * 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (p.type === 'starry') {
            const outer = (p.size + sizeOffset * 0.5) * 2.2;
            const inner = (p.size + sizeOffset * 0.2) * 0.6;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2;
                ctx.lineTo(p.x + Math.cos(angle) * outer, p.y + Math.sin(angle) * outer);
                ctx.lineTo(p.x + Math.cos(angle + Math.PI/4) * inner, p.y + Math.sin(angle + Math.PI/4) * inner);
            }
            ctx.closePath();
            ctx.fill();
        } else if (p.type === 'petal') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size + sizeOffset * 0.5, (p.size + sizeOffset * 0.3) * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (p.type === 'leaf') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.beginPath();
            ctx.moveTo(-(p.size + sizeOffset), 0);
            ctx.quadraticCurveTo(0, -(p.size + sizeOffset * 0.5) * 0.55, p.size + sizeOffset, 0);
            ctx.quadraticCurveTo(0, (p.size + sizeOffset * 0.5) * 0.55, -(p.size + sizeOffset), 0);
            ctx.closePath();
            ctx.fill();
            
            if (sizeOffset === 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-p.size, 0);
                ctx.lineTo(p.size, 0);
                ctx.stroke();
            }
            ctx.restore();
        } else if (p.type === 'vine') {
            if (p.path && p.path.length > 1) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let j = 0; j < p.path.length - 1; j++) {
                    const pt1 = p.path[j];
                    const pt2 = p.path[j + 1];
                    const ratio = j / (p.path.length - 1);
                    ctx.lineWidth = (p.size + sizeOffset * 0.3) * ratio * 1.5;
                    ctx.globalAlpha = p.alpha * ratio * (sizeOffset > 0 ? 0.25 : 1);
                    ctx.beginPath();
                    ctx.moveTo(pt1.x, pt1.y);
                    ctx.lineTo(pt2.x, pt2.y);
                    ctx.stroke();
                }
                ctx.restore();
            }
            if (p.leafBuds) {
                p.leafBuds.forEach(bud => {
                    ctx.save();
                    ctx.globalAlpha = p.alpha * 0.8 * (sizeOffset > 0 ? 0.25 : 1);
                    ctx.translate(bud.x, bud.y);
                    ctx.rotate(bud.angle);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.quadraticCurveTo(bud.side * (bud.size + sizeOffset * 0.5), -(bud.size + sizeOffset * 0.2) * 0.4, bud.side * (bud.size + sizeOffset * 0.5) * 1.6, 0);
                    ctx.quadraticCurveTo(bud.side * (bud.size + sizeOffset * 0.5), (bud.size + sizeOffset * 0.2) * 0.4, 0, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                });
            }
        } else if (p.type === 'ink') {
            ctx.save();
            ctx.globalAlpha = p.alpha * 0.8 * (sizeOffset > 0 ? 0.25 : 1);
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size + sizeOffset);
            grad.addColorStop(0, p.color);
            grad.addColorStop(0.35, p.color);
            grad.addColorStop(0.7, 'rgba(0,0,0,0.3)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size + sizeOffset, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (p.type === 'ink-splash') {
            if (!p.landed) {
                ctx.beginPath();
                ctx.moveTo(p.prevX, p.prevY);
                ctx.lineTo(p.x, p.y);
                ctx.strokeStyle = safeReplaceAlpha(p.color, p.alpha * 0.3);
                ctx.lineWidth = p.size * 0.5;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            ctx.save();
            ctx.globalAlpha = p.alpha;
            if (p.landed) {
                ctx.shadowBlur = 5 + p.size * 0.5;
                ctx.shadowColor = p.color;
            }
            const gradS = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size + sizeOffset);
            gradS.addColorStop(0, p.color);
            gradS.addColorStop(0.6, safeReplaceAlpha(p.color, p.alpha * 0.5));
            gradS.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradS;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size + sizeOffset, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (p.type === 'ink-collision') {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            if (p.initialSpeed > 3) {
                const lineLen = p.initialSpeed * 1.5;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(
                    p.x + Math.cos(p.angle) * lineLen,
                    p.y + Math.sin(p.angle) * lineLen
                );
                ctx.strokeStyle = safeReplaceAlpha(p.color, p.alpha * 0.3);
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            const gradC = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size + sizeOffset);
            gradC.addColorStop(0, p.color);
            gradC.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradC;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size + sizeOffset, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (p.type === 'ink_drop') {
            ctx.save();
            if (!p.landed) {
                // 飞行中：椭圆拖尾墨滴
                const angle = Math.atan2(p.vy, p.vx);
                ctx.translate(p.x, p.y);
                ctx.rotate(angle);
                ctx.scale(1.5, 1);
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
                grad.addColorStop(0, `rgba(26,26,26,${p.alpha})`);
                grad.addColorStop(1, 'rgba(26,26,26,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.scale(1/1.5, 1);
                ctx.rotate(-angle);
                ctx.strokeStyle = `rgba(26,26,26,${p.alpha * 0.3})`;
                ctx.lineWidth = p.size * 0.3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-p.vx * 3, -p.vy * 3);
                ctx.stroke();
            } else {
                // 着纸瞬间：扩散墨晕
                const elapsed = Date.now() - p.landTime;
                const spread = 1 + elapsed * 0.002;
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * spread);
                grad.addColorStop(0, `rgba(26,26,26,${p.alpha * 0.5})`);
                grad.addColorStop(1, 'rgba(26,26,26,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * spread, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        } else if (p.type === 'code') {
            if (sizeOffset === 0) {
                ctx.font = `bold ${Math.floor(p.size * 2 + 6)}px monospace`;
                ctx.fillText(p.char, p.x, p.y);
            } else {
                ctx.save();
                ctx.globalAlpha = p.alpha * 0.2;
                ctx.font = `bold ${Math.floor((p.size + sizeOffset * 0.4) * 2 + 6)}px monospace`;
                ctx.fillText(p.char, p.x, p.y);
                ctx.restore();
            }
        } else if (p.type === 'ink-dust') {
            ctx.fillStyle = `rgba(26,26,26,${Math.min(p.alpha, 0.5)})`;
            ctx.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
        } else {
            const shape = p.shape || 'circle';
            if (shape === 'star') {
                const outer = (p.size + sizeOffset * 0.5) * 2.0;
                const inner = (p.size + sizeOffset * 0.2) * 0.5;
                ctx.beginPath();
                for (let j = 0; j < 4; j++) {
                    const angle = (j * Math.PI) / 2;
                    ctx.lineTo(p.x + Math.cos(angle) * outer, p.y + Math.sin(angle) * outer);
                    ctx.lineTo(p.x + Math.cos(angle + Math.PI/4) * inner, p.y + Math.sin(angle + Math.PI/4) * inner);
                }
                ctx.closePath();
                ctx.fill();
            } else if (shape === 'leaf') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.beginPath();
                ctx.moveTo(-(p.size + sizeOffset), 0);
                ctx.quadraticCurveTo(0, -(p.size + sizeOffset * 0.5) * 0.55, p.size + sizeOffset, 0);
                ctx.quadraticCurveTo(0, (p.size + sizeOffset * 0.5) * 0.55, -(p.size + sizeOffset), 0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else if (shape === 'square') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                const sz = p.size + sizeOffset * 0.5;
                ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
                ctx.restore();
            } else if (shape === 'ring') {
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size + sizeOffset, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size + sizeOffset * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawDust(ctx, p, sizeOffset) {
        ctx.save();
        const len = 8 + Math.random() * 12;
        const angle = Math.atan2(p.vy || 0.1, p.vx || 0.1);
        const alpha = Math.min(p.alpha, CYBER_PALETTE.maxAlpha);
        if (p.depthLayer === 0) {
            // 用 shadowBlur 模拟模糊效果，比 ctx.filter 快约 10 倍
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(180,200,220,0.3)';
        }
        ctx.strokeStyle = `rgba(180,200,220,${alpha * 0.15 / 0.35})`;
        ctx.lineWidth = 0.5 + (sizeOffset > 0 ? 0.3 : 0);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(angle) * len, p.y + Math.sin(angle) * len);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawGrid(ctx, p, sizeOffset) {
        ctx.save();
        const alpha = Math.min(p.alpha, CYBER_PALETTE.maxAlpha);
        const distFromHome = Math.hypot(p.x - (p.homeX || p.x), p.y - (p.homeY || p.y));
        const activityAlpha = Math.min(1, distFromHome / 10);
        ctx.fillStyle = `rgba(0,255,255,${0.03 + activityAlpha * 0.05})`;
        const s = 1.5 + (sizeOffset > 0 ? 1 : 0);
        ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
        ctx.restore();
    }

    drawProximity(ctx, p, sizeOffset) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const radius = p.size || 100;
        const alpha = 0.03 + Math.random() * 0.03;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, `rgba(123,158,184,${alpha})`);
        grad.addColorStop(1, 'rgba(123,158,184,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    drawDatastream(ctx, p, sizeOffset) {
        ctx.save();
        const alpha = Math.min(p.alpha, CYBER_PALETTE.maxAlpha);
        ctx.fillStyle = `rgba(123,158,184,${alpha * 0.12 / 0.35})`;
        const r = (p.size || 1.5) + sizeOffset * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawParallax(ctx, p, sizeOffset) {
        ctx.save();
        const layer = p.depthLayer || 0;
        const configs = [
            { color: '200,210,220', alpha: 0.08, sizeRange: [0.5, 1.2] },
            { color: '180,195,210', alpha: 0.15, sizeRange: [1.5, 2.5] },
            { color: '160,180,200', alpha: 0.25, sizeRange: [2.5, 4.0] }
        ];
        const cfg = configs[layer] || configs[1];
        const r = (p.size || cfg.sizeRange[1]) + sizeOffset * 0.3;
        ctx.fillStyle = `rgba(${cfg.color},${Math.min(cfg.alpha, CYBER_PALETTE.maxAlpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawTrail(ctx, p, sizeOffset) {
        ctx.save();
        if (!p.trail || p.trail.length < 2) {
            ctx.fillStyle = `rgba(123,158,184,${Math.min(p.alpha, CYBER_PALETTE.maxAlpha)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }
        const trail = p.trail;
        for (let i = 1; i < trail.length; i++) {
            const t = i / trail.length;
            const alpha = t * Math.min(p.alpha, CYBER_PALETTE.maxAlpha);
            ctx.strokeStyle = `rgba(123,158,184,${alpha})`;
            ctx.lineWidth = t * (p.size || 2);
            ctx.beginPath();
            ctx.moveTo(trail[i-1].x, trail[i-1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
        }
        ctx.fillStyle = `rgba(184,168,154,${Math.min(p.alpha, CYBER_PALETTE.maxAlpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.size || 2) * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawBokeh(ctx, p, sizeOffset) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const radius = Math.max(2, p.size * 3 + sizeOffset);
        const alpha = Math.min(p.alpha, CYBER_PALETTE.maxAlpha);
        const colors = [CYBER_PALETTE.primary, CYBER_PALETTE.secondary, CYBER_PALETTE.highlight];
        const color = colors[p.colorIdx || 0];
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    drawCursorSand(ctx, p, sizeOffset) {
        ctx.save();
        const alpha = Math.min(p.alpha, CYBER_PALETTE.maxAlpha);
        const len = 3 + Math.random() * 5;
        const angle = Math.atan2(p.vy || 0.1, p.vx || 0.1);
        ctx.strokeStyle = `rgba(184,168,154,${alpha})`;
        ctx.lineWidth = 1 + (sizeOffset > 0 ? 0.5 : 0);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(angle) * len, p.y + Math.sin(angle) * len);
        ctx.stroke();
        ctx.restore();
    }

    setAudioEnergy(val) { this.audioEnergy = val || 0; }
}

const particles = new ParticleSystem();

// --- Ripple expansion trigger ---
class RippleSystem {
    constructor() {
        this.ripples = [];
    }

    trigger(x, y, color) {
        this.ripples.push({
            x: x,
            y: y,
            radius: 5,
            maxRadius: 90,
            color: color,
            alpha: 1,
            speed: 4.5,
            rotation: Math.random() * Math.PI * 2,
            isInk: app && app.state.artStyle === 'ink'
        });
    }

    update() {
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += r.speed;
            r.alpha = 1 - (r.radius / r.maxRadius);
            if (r.radius >= r.maxRadius) {
                this.ripples.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        this.ripples.forEach(r => {
            ctx.globalAlpha = r.alpha;
            if (r.isInk) {
                const drawInkRipple = () => {
                    ctx.save();
                    ctx.translate(r.x, r.y);
                    ctx.rotate(r.rotation);
                    ctx.beginPath();
                    // irregular ellipse
                    ctx.ellipse(0, 0, r.radius, r.radius * 0.75, 0, 0, Math.PI * 2);
                    ctx.restore();
                };
                drawPathWithGlow(ctx, drawInkRipple, 'rgba(160, 82, 45, 0.15)', 2.5, 0);
            } else {
                const drawRipple = () => {
                    ctx.beginPath();
                    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
                };
                drawPathWithGlow(ctx, drawRipple, r.color, 2.5, 12);
            }
        });
        ctx.restore();
    }
}

const ripples = new RippleSystem();
