// ==========================================================================
// RISO Presets & Procedural Art Generators
// ==========================================================================

const RISO_PALETTES = [
  {
    id: 'classic-pink-blue',
    name: 'Fluo Pink & Federal Blue',
    desc: 'Культовое сочетание 80-х (как в видео)',
    ink1: '#FF2A85', // Fluo Pink
    ink2: '#0055B8', // Federal Blue
    ink3: '#FFE800', // Sunflower Yellow
    paper: '#FAF6EE',
    use3: false
  },
  {
    id: 'neon-sunset',
    name: 'Neon Sunset (Pink & Yellow)',
    desc: 'Яркий тропический неон и солнце',
    ink1: '#FF2A85',
    ink2: '#FF8800',
    ink3: '#FFE800',
    paper: '#FFFDF5',
    use3: true
  },
  {
    id: 'tokyo-zine',
    name: 'Tokyo Zine (Teal & Scarlet)',
    desc: 'Японский самиздат и урбан-арт',
    ink1: '#F15060', // Scarlet Red
    ink2: '#00838F', // Deep Teal
    ink3: '#FFE800', // Accent Yellow
    paper: '#F4EFE6',
    use3: false
  },
  {
    id: 'cyber-acid',
    name: 'Cyber Acid (Lime & Violet)',
    desc: 'Киберпанк, рейв-постеры 90-х',
    ink1: '#00E676', // Acid Lime
    ink2: '#6200EA', // Deep Violet
    ink3: '#FF2A85', // Hot Pink
    paper: '#F9F8F6',
    use3: true
  },
  {
    id: 'vintage-press',
    name: 'Vintage Press (Black & Ochre)',
    desc: 'Газетная печать 1970-х, архивы',
    ink1: '#1F2229', // Riso Black
    ink2: '#8D6E63', // Sepia
    ink3: '#D4AF37', // Ochre
    paper: '#F3ECD8',
    use3: false
  },
  {
    id: 'mint-coral',
    name: 'Mint & Coral Glow',
    desc: 'Свежая пастельная эстетика',
    ink1: '#FF6F59', // Coral
    ink2: '#257985', // Mint Marine
    ink3: '#F3C98B', // Soft Sand
    paper: '#FAF8F5',
    use3: false
  }
];

// Procedural sample artworks generated in memory
const DEMO_GENERATORS = {
  // 1. Sunflower Poster (Exact recreation of the video's Sunflower art!)
  sunflower: function(width = 1000, height = 1400) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Clean white canvas background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const m = width * 0.07;
    const innerW = width - m * 2;

    // Outer double border
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 3;
    ctx.strokeRect(m, m, innerW, height - m * 2);
    ctx.lineWidth = 1;
    ctx.strokeRect(m + 6, m + 6, innerW - 12, height - m * 2 - 12);

    // Giant Header: "SUNFLOWER"
    ctx.fillStyle = '#151515';
    ctx.font = '900 ' + (width * 0.145) + 'px "Cabinet Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUNFLOWER', width * 0.5, m + width * 0.15);

    // Subtitle banner: GLOWING * BOLD * RADIANT
    ctx.font = '700 ' + (width * 0.026) + 'px "Space Grotesk", sans-serif';
    ctx.fillText('GLOWING   ★   BOLD   ★   RADIANT', width * 0.5, m + width * 0.205);

    // Pill badge: HIMARI
    const badgeW = width * 0.44;
    const badgeH = width * 0.065;
    const badgeY = m + width * 0.23;
    ctx.fillStyle = '#151515';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - badgeW * 0.5, badgeY, badgeW, badgeH, badgeH * 0.5);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 ' + (width * 0.034) + 'px "Space Grotesk", sans-serif';
    ctx.fillText('•  H I M A R I  •', width * 0.5, badgeY + badgeH * 0.7);

    // Wave pattern
    ctx.fillStyle = '#151515';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(m + 16, badgeY + badgeH + 16 + i * 7, innerW - 32, 2.5);
    }

    // Realistic Botanical Sunflower Renderer
    const drawBotanicalSunflower = (cx, cy, radius, angleTilt) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angleTilt);

      // Leaves / Stem
      ctx.strokeStyle = '#151515';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-15, radius * 0.8);
      ctx.quadraticCurveTo(-40, radius * 1.5, -60, radius * 2.2);
      ctx.stroke();

      // Leaf shape
      ctx.fillStyle = '#333333';
      ctx.beginPath();
      ctx.ellipse(-50, radius * 1.5, 35, 18, -0.6, 0, Math.PI * 2);
      ctx.fill();

      // Individual Sunflower Petals (with shading lines)
      const numPetals = 22;
      for (let i = 0; i < numPetals; i++) {
        const theta = (i / numPetals) * Math.PI * 2;
        ctx.save();
        ctx.rotate(theta);

        // Petal shape
        ctx.beginPath();
        ctx.moveTo(0, radius * 0.35);
        ctx.quadraticCurveTo(radius * 0.14, radius * 0.65, 0, radius);
        ctx.quadraticCurveTo(-radius * 0.14, radius * 0.65, 0, radius * 0.35);
        ctx.closePath();

        // Alternating tones for realistic halftone depth
        ctx.fillStyle = (i % 2 === 0) ? '#444444' : '#666666';
        ctx.fill();
        ctx.strokeStyle = '#151515';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Shading lines inside petal
        ctx.beginPath();
        ctx.moveTo(0, radius * 0.45);
        ctx.lineTo(0, radius * 0.85);
        ctx.stroke();

        ctx.restore();
      }

      // Center Seed Head (Concentric Fibonacci Stipple)
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.36, 0, Math.PI * 2);
      ctx.fill();

      // Inner stipple spiral
      ctx.fillStyle = '#FFFFFF';
      for (let s = 1; s < 110; s++) {
        const r = Math.sqrt(s) * (radius * 0.034);
        const a = s * 2.39996; // Golden angle
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    // Draw two flowers in perspective (matching the video's composition!)
    drawBotanicalSunflower(width * 0.62, height * 0.44, width * 0.21, 0.25);
    drawBotanicalSunflower(width * 0.42, height * 0.58, width * 0.25, -0.15);

    // Newspaper text block on left
    ctx.fillStyle = '#151515';
    ctx.font = '400 11px "Inter", sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      'The sunflower is a living annual plant',
      'in the family Asteraceae, cultivated for',
      'its edible oil and golden seeds.',
      'Printed with soy ink stencil drum on',
      'unbleached Japanese cream stock.',
      'Tokyo Design Research Study Archive.',
      'Edition 2026 // Dual Plate Stencil.'
    ];
    for (let l = 0; l < lines.length; l++) {
      ctx.fillText(lines[l], m + 22, height * 0.48 + l * 17);
    }

    // Kanji Box: 向日葵 (Himawari)
    const boxY = height - m - width * 0.21;
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 4;
    ctx.strokeRect(m + 22, boxY, width * 0.46, width * 0.17);
    ctx.fillStyle = '#151515';
    ctx.font = '900 ' + (width * 0.115) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('向日葵', m + 22 + (width * 0.23), boxY + width * 0.125);

    // Dot grid decoration on bottom right
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.beginPath();
        ctx.arc(width - m - 35 - c * 17, boxY + 18 + r * 17, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return canvas;
  },

  // 2. 80-e Retro Riso Art (recreating the bold title card from the video!)
  retro80: function(width = 1000, height = 1400) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const m = width * 0.08;

    // Header badge
    ctx.fillStyle = '#151515';
    ctx.font = '700 13px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STENCIL DUPLICATOR // ARCHIVE NO. 84', m, m + 20);

    // Giant 80-e text in center
    ctx.font = '900 ' + (width * 0.36) + 'px "Cabinet Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('80-e', width * 0.5, height * 0.38);

    // Decorative barcode stripes
    ctx.fillRect(width * 0.14, height * 0.44, width * 0.72, 6);
    ctx.fillRect(width * 0.14, height * 0.46, width * 0.72, 3);

    // Subtitle blocks: "ПРИДУМАЛА АППАРАТ"
    ctx.font = '900 ' + (width * 0.085) + 'px "Space Grotesk", sans-serif';
    ctx.fillText('ПРИДУМАЛА', width * 0.5, height * 0.55);
    ctx.fillText('АППАРАТ', width * 0.5, height * 0.65);

    // Riso Drum graphic silhouette
    const cx = width * 0.5;
    const cy = height * 0.78;
    ctx.beginPath();
    ctx.roundRect(cx - 180, cy - 35, 360, 70, 18);
    ctx.fill();

    // Drum inner lines
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - 160, cy - 8, 320, 16);

    // Label: RISOGRAPH COLOR DRUM
    ctx.fillStyle = '#151515';
    ctx.font = '800 12px "Space Grotesk", sans-serif';
    ctx.fillText('• RISO COLOR DRUM // DUAL PASS •', cx, cy + 65);

    return canvas;
  },

  // 3. Tokyo Zine / Mount Fuji (from intro of video)
  fuji: function(width = 1000, height = 1400) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const m = width * 0.08;

    // Header: RISO AESTHETIC
    ctx.fillStyle = '#151515';
    ctx.font = '900 ' + (width * 0.16) + 'px "Cabinet Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RISO', width * 0.5, m + width * 0.15);
    ctx.fillText('AESTHETIC', width * 0.5, m + width * 0.30);

    // Fuji Frame
    const fujiBoxY = m + width * 0.36;
    const fujiBoxH = height * 0.30;
    ctx.fillStyle = '#EAEAEA';
    ctx.fillRect(m, fujiBoxY, width - m * 2, fujiBoxH);

    // Rising Sun Circle
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(width * 0.74, fujiBoxY + fujiBoxH * 0.34, width * 0.13, 0, Math.PI * 2);
    ctx.fill();

    // Mount Fuji
    ctx.beginPath();
    ctx.moveTo(m + 30, fujiBoxY + fujiBoxH);
    ctx.lineTo(width * 0.5, fujiBoxY + 25);
    ctx.lineTo(width - m - 30, fujiBoxY + fujiBoxH);
    ctx.closePath();
    ctx.fill();

    // Snow Cap
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(width * 0.5, fujiBoxY + 25);
    ctx.lineTo(width * 0.42, fujiBoxY + 95);
    ctx.lineTo(width * 0.46, fujiBoxY + 85);
    ctx.lineTo(width * 0.50, fujiBoxY + 100);
    ctx.lineTo(width * 0.54, fujiBoxY + 85);
    ctx.lineTo(width * 0.58, fujiBoxY + 95);
    ctx.closePath();
    ctx.fill();

    // Japanese Subtitle
    ctx.fillStyle = '#151515';
    ctx.font = '700 ' + (width * 0.05) + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('リソグラフ アート', m, fujiBoxY + fujiBoxH + 45);

    // Botanical Branch on bottom
    const bx = width * 0.32;
    const by = height - m - 120;
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bx - 60, by + 80);
    ctx.quadraticCurveTo(bx, by, bx + 100, by - 100);
    ctx.stroke();

    // Leaves
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      const lx = bx - 30 + k * 26;
      const ly = by + 50 - k * 32;
      ctx.ellipse(lx, ly, 30, 16, (k % 2 === 0 ? 0.6 : -0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    // Grid Stamp on bottom right
    const gx = width * 0.64;
    const gy = height - m - 180;
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(gx, gy + i * 18);
      ctx.lineTo(gx + 140, gy + i * 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx + i * 28, gy);
      ctx.lineTo(gx + i * 28, gy + 90);
      ctx.stroke();
    }

    return canvas;
  },

  // 4. Vintage Portrait (Halftone Face)
  portrait: function(width = 1000, height = 1400) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.44;

    // Face oval with subtle gradient
    const grad = ctx.createRadialGradient(cx - 30, cy - 20, 20, cx, cy, 300);
    grad.addColorStop(0, '#EEEEEE');
    grad.addColorStop(0.7, '#CCCCCC');
    grad.addColorStop(1, '#888888');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 220, 310, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dramatic vintage hair
    ctx.fillStyle = '#151515';
    ctx.beginPath();
    ctx.moveTo(cx - 230, cy - 80);
    ctx.bezierCurveTo(cx - 240, cy - 320, cx, cy - 360, cx + 240, cy - 300);
    ctx.bezierCurveTo(cx + 260, cy - 80, cx + 190, cy + 90, cx + 150, cy + 190);
    ctx.bezierCurveTo(cx + 100, cy + 100, cx + 150, cy - 140, cx + 70, cy - 190);
    ctx.bezierCurveTo(cx - 50, cy - 190, cx - 150, cy - 70, cx - 230, cy - 80);
    ctx.closePath();
    ctx.fill();

    // Dark vintage sunglasses
    ctx.beginPath();
    ctx.roundRect(cx - 180, cy - 80, 150, 72, 16);
    ctx.roundRect(cx + 30, cy - 80, 150, 72, 16);
    ctx.fill();
    ctx.fillRect(cx - 30, cy - 60, 60, 12);

    // Lips
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 140, 55, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pure clean portrait illustration (no extra text/numbers)
    return canvas;
  }
};
