/**
 * KREIT · GENY NETWORK
 * Animated Frosted Particles & Dark-Blue Atmosphere Background
 */

(function () {
    const canvas = document.createElement("canvas");
    canvas.id = "ambient-canvas";
    document.body.prepend(canvas);

    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouse = { x: width / 2, y: height / 2, targetX: width / 2, targetY: height / 2 };

    window.addEventListener("resize", () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initParticles();
    });

    window.addEventListener("mousemove", (e) => {
        mouse.targetX = e.clientX;
        mouse.targetY = e.clientY;
    });

    // Ambient floating light orbs (silky soft gradients in background)
    const orbs = [
        { x: width * 0.2, y: height * 0.3, vx: 0.15, vy: 0.2, r: 420, color: "rgba(20, 60, 130, 0.45)" },
        { x: width * 0.8, y: height * 0.2, vx: -0.2, vy: 0.18, r: 480, color: "rgba(25, 80, 165, 0.4)" },
        { x: width * 0.5, y: height * 0.7, vx: 0.18, vy: -0.15, r: 520, color: "rgba(15, 45, 110, 0.5)" },
        { x: width * 0.85, y: height * 0.85, vx: -0.12, vy: -0.22, r: 400, color: "rgba(30, 95, 185, 0.35)" },
    ];

    // Multi-layer frosted glowing particles
    let particles = [];

    function initParticles() {
        particles = [];
        const count = Math.min(110, Math.floor((width * height) / 12000));

        for (let i = 0; i < count; i++) {
            const layer = Math.random();
            let size, alpha, blur, speedY, speedX, floatRange;

            if (layer < 0.25) {
                // Layer 1: Large out-of-focus frosted bokeh orbs (far background)
                size = Math.random() * 26 + 18;
                alpha = Math.random() * 0.08 + 0.03;
                blur = 18;
                speedY = -(Math.random() * 0.25 + 0.1);
                speedX = (Math.random() - 0.5) * 0.2;
                floatRange = 40;
            } else if (layer < 0.65) {
                // Layer 2: Medium glowing frosted particles (midground)
                size = Math.random() * 8 + 6;
                alpha = Math.random() * 0.35 + 0.15;
                blur = 8;
                speedY = -(Math.random() * 0.5 + 0.25);
                speedX = (Math.random() - 0.5) * 0.35;
                floatRange = 25;
            } else {
                // Layer 3: Sharp glowing floating white motes (foreground)
                size = Math.random() * 3 + 1.5;
                alpha = Math.random() * 0.6 + 0.35;
                blur = 2;
                speedY = -(Math.random() * 0.8 + 0.4);
                speedX = (Math.random() - 0.5) * 0.5;
                floatRange = 15;
            }

            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                baseX: 0,
                size: size,
                alpha: alpha,
                baseAlpha: alpha,
                blur: blur,
                speedY: speedY,
                speedX: speedX,
                pulseSpeed: Math.random() * 0.03 + 0.01,
                pulseOffset: Math.random() * Math.PI * 2,
                floatOffset: Math.random() * Math.PI * 2,
                floatSpeed: Math.random() * 0.02 + 0.005,
                floatRange: floatRange,
            });
        }
    }

    initParticles();

    function drawBackground() {
        // 1. Ultra Dark Pitch-Black Base Gradient
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, "#000000");
        grad.addColorStop(0.5, "#030712");
        grad.addColorStop(1, "#050b18");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. Soft moving ambient light orbs (ultra-subtle)
        for (const orb of orbs) {
            orb.x += orb.vx;
            orb.y += orb.vy;

            if (orb.x < -100 || orb.x > width + 100) orb.vx *= -1;
            if (orb.y < -100 || orb.y > height + 100) orb.vy *= -1;

            const radial = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
            radial.addColorStop(0, orb.color);
            radial.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = radial;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Subtle interactive mouse glow
        mouse.x += (mouse.targetX - mouse.x) * 0.05;
        mouse.y += (mouse.targetY - mouse.y) * 0.05;
        const mouseGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 350);
        mouseGlow.addColorStop(0, "rgba(25, 75, 160, 0.12)");
        mouseGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = mouseGlow;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 350, 0, Math.PI * 2);
        ctx.fill();
    }

    function renderParticles() {
        const time = Date.now() * 0.001;

        for (const p of particles) {
            // Natural drifting movement
            p.y += p.speedY;
            p.x += p.speedX + Math.sin(time * p.floatSpeed * 50 + p.floatOffset) * 0.35;

            // Pulsing light
            p.alpha = p.baseAlpha * (0.8 + 0.3 * Math.sin(time * p.pulseSpeed * 80 + p.pulseOffset));

            // Wrap around edges
            if (p.y < -p.size * 2) {
                p.y = height + p.size * 2;
                p.x = Math.random() * width;
            }
            if (p.x < -p.size * 2) p.x = width + p.size * 2;
            if (p.x > width + p.size * 2) p.x = -p.size * 2;

            // Render frosted particle
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

            if (p.blur > 4) {
                // Frosted bokeh orb
                const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                radGrad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha * 1.4})`);
                radGrad.addColorStop(0.4, `rgba(220, 240, 255, ${p.alpha * 0.8})`);
                radGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.fillStyle = radGrad;
            } else {
                // Crisp floating core
                ctx.shadowColor = "rgba(220, 245, 255, 0.9)";
                ctx.shadowBlur = 10;
                ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
            }

            ctx.fill();
            ctx.restore();
        }

        // 4. Cinematic frosted glass vignette overlay
        const vignette = ctx.createRadialGradient(
            width / 2,
            height / 2,
            Math.min(width, height) * 0.45,
            width / 2,
            height / 2,
            Math.max(width, height) * 0.85
        );
        vignette.addColorStop(0, "rgba(4, 10, 24, 0)");
        vignette.addColorStop(1, "rgba(2, 6, 16, 0.65)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);
    }

    function animate() {
        drawBackground();
        renderParticles();
        requestAnimationFrame(animate);
    }

    animate();
})();
