import { useEffect, useRef } from "react";

/**
 * Full-page ambient particle field, matching the homepage's background.
 * Pure canvas2D, no external dependency. Mounted once at the app root.
 */
export default function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w, h, particles;
    let mouseX = 0, mouseY = 0;
    let animationFrameId;
    const PARTICLE_COUNT = 90;
    const LINK_DIST = 120;
    const palette = ["139,92,246", "236,72,153", "34,211,238"];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function rand(min, max) {
      return Math.random() * (max - min) + min;
    }

    function makeParticles() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: rand(0, w),
          y: rand(0, h),
          vx: rand(-0.1, 0.1),
          vy: rand(-0.07, 0.07),
          r: rand(0.6, 2),
          color: palette[i % palette.length],
          twinklePhase: rand(0, Math.PI * 2),
          twinkleSpeed: rand(0.008, 0.02),
        });
      }
    }
    makeParticles();

    function handleMouseMove(e) {
      mouseX = (e.clientX / w - 0.5) * 2;
      mouseY = (e.clientY / h - 0.5) * 2;
    }
    window.addEventListener("mousemove", handleMouseMove);

    let frame = 0;
    function tick() {
      frame++;
      ctx.clearRect(0, 0, w, h);
      const parallaxX = mouseX * 6;
      const parallaxY = mouseY * 6;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }

      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.1;
            ctx.strokeStyle = `rgba(150,140,200,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x + parallaxX, a.y + parallaxY);
            ctx.lineTo(b.x + parallaxX, b.y + parallaxY);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const twinkle = 0.5 + 0.5 * Math.sin(p.twinklePhase + frame * p.twinkleSpeed);
        const alpha = 0.2 + twinkle * 0.45;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        ctx.arc(p.x + parallaxX, p.y + parallaxY, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas id="app-particle-canvas" ref={canvasRef} />;
}
