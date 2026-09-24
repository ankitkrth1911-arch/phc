/**
 * Animated Circular Risk Gauge
 * Renders smooth high-DPI arc with hospitality risk tones and eased value transitions.
 */

export class RiskGauge {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.currentScore = 0;
    this.targetScore = 0;
    this.animId = null;

    // Retina / high DPI scaling
    this.size = 240;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.size * this.dpr;
    this.canvas.height = this.size * this.dpr;
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.ctx.scale(this.dpr, this.dpr);

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  getRiskColor(score) {
    if (score >= 70) return '#C53030'; // Critical Red
    if (score >= 35) return '#D97706'; // Caution Amber
    return '#2A7E48';                 // Secure Green
  }

  setScore(target) {
    const clamped = Math.max(0, Math.min(100, target));
    this.targetScore = clamped;

    if (this.prefersReducedMotion) {
      this.currentScore = this.targetScore;
      this.draw();
      return;
    }

    if (this.animId) cancelAnimationFrame(this.animId);

    const animate = () => {
      const diff = this.targetScore - this.currentScore;
      if (Math.abs(diff) < 0.2) {
        this.currentScore = this.targetScore;
        this.draw();
        this.animId = null;
        return;
      }
      this.currentScore += diff * 0.12;
      this.draw();
      this.animId = requestAnimationFrame(animate);
    };

    animate();
  }

  draw() {
    const ctx = this.ctx;
    const center = this.size / 2;
    const radius = center - 22;
    const startAngle = 0.75 * Math.PI;
    const totalSweep = 1.5 * Math.PI;
    const strokeWidth = 14;

    ctx.clearRect(0, 0, this.size, this.size);

    // 1. Background Track
    ctx.beginPath();
    ctx.arc(center, center, radius, startAngle, startAngle + totalSweep);
    ctx.strokeStyle = '#EBE4D8';
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Active Animated Arc
    const progress = this.currentScore / 100;
    const currentSweep = totalSweep * progress;

    if (progress > 0) {
      ctx.beginPath();
      ctx.arc(center, center, radius, startAngle, startAngle + currentSweep);
      ctx.strokeStyle = this.getRiskColor(this.currentScore);
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 3. Subtle tick indicator at tip
    if (progress > 0.02) {
      const tipAngle = startAngle + currentSweep;
      const tipX = center + radius * Math.cos(tipAngle);
      const tipY = center + radius * Math.sin(tipAngle);

      ctx.beginPath();
      ctx.arc(tipX, tipY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  }
}
