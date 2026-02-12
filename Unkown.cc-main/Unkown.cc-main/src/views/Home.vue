
<template>
  <section class="home-hero">
    <div class="hero-bg" :style="{ backgroundImage: `url(${logoPng})` }"></div>
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <h1>
        enhance your<br />
        gameplay with<br />
        <span class="hero-accent">UNKNOWN</span>
      </h1>
      <p>
        Powerful tools, clean performance, and a focused community built for speed.
      </p>
      <div class="hero-cta">
        <a href="/" class="hero-btn primary">Forum</a>
        <a href="/store" class="hero-btn ghost">Products</a>
      </div>
    </div>
  </section>
</template>

<script setup>
import logoPng from '../assets/logo.png'
</script>

<style>
.home-hero {
  position: relative;
  min-height: calc(100vh - 70px);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 60px clamp(20px, 6vw, 80px);
}
.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: saturate(1.1) contrast(1.05);
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1200px 600px at 65% 20%, rgba(0, 255, 160, 0.08), transparent 60%),
    linear-gradient(90deg, rgba(3, 12, 16, 0.92) 0%, rgba(3, 12, 16, 0.7) 45%, rgba(3, 12, 16, 0.35) 100%);
}
.hero-content {
  position: relative;
  z-index: 1;
  max-width: 560px;
  color: #e7f8ff;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.6);
}
.hero-content h1 {
  margin: 0 0 16px;
  font-size: clamp(28px, 4.2vw, 52px);
  line-height: 1.08;
  font-weight: 800;
  text-transform: lowercase;
}
.hero-accent {
  color: #ff6b6b;
  letter-spacing: 2px;
}
.hero-content p {
  margin: 0 0 26px;
  color: rgba(217, 238, 245, 0.8);
  font-size: 15px;
  line-height: 1.6;
}
.hero-cta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.hero-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
  letter-spacing: 0.4px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}
.hero-btn.primary {
  background: #ff6b6b;
  color: #fff;
  box-shadow: 0 10px 30px rgba(255, 107, 107, 0.35);
}
.hero-btn.ghost {
  color: #d9eef5;
  border: 1px solid rgba(217, 238, 245, 0.2);
  background: rgba(5, 20, 25, 0.45);
}
.hero-btn:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}

@media (max-width: 800px) {
  .home-hero {
    min-height: calc(100vh - 60px);
    padding: 50px 22px;
  }
  .hero-content {
    max-width: 100%;
  }
}
</style>
