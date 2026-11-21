// ==========================================================================
// Riso & Pixelator Web Application Logic
// ==========================================================================

class RisoApp {
  constructor() {
    // Elements
    this.glCanvas = document.getElementById('glCanvas');
    this.exportCanvas = document.getElementById('exportCanvas');
    this.paperWrapper = document.getElementById('paperWrapper');
    this.canvasStage = document.getElementById('canvasStage');
    this.fileInput = document.getElementById('fileInput');
    this.scannerBar = document.getElementById('scannerBar');
    this.splitSlider = document.getElementById('splitSliderContainer');
    this.splitHandle = document.getElementById('splitHandle');
    this.toastMsg = document.getElementById('toastMsg');

    // Web Camera Elements
    this.cameraModal = document.getElementById('cameraModal');
    this.cameraVideo = document.getElementById('cameraVideo');
    this.liveCameraPill = document.getElementById('liveCameraPill');
    this.cameraStream = null;
    this.isLiveCamera = false;
    this.cameraFacingMode = 'user';
    this.liveAnimId = null;

    // WebGL Context & Program
    this.gl = null;
    this.program = null;
    this.sourceTexture = null;
    this.sourceImage = null; // Current Image or Canvas
    this.isWebGLSupported = false;

    // Viewport & Zoom (Auto-fit by default)
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDrawerCollapsed = false;
    this.isCameraMirrored = false;

    // Interactive Modes
    this.isComparing = false;
    this.splitPosition = -1.0; // -1 = disabled
    this.isDraggingSplit = false;

    this.isScanning = false;
    this.scanProgress = -1.0; // -1 = disabled
    this.scanSpeed = 0.007;
    this.scanAnimId = null;

    // State & Settings
    this.state = {
      effectMode: 0, // 0 = Riso, 1 = Newspaper, 2 = Halftone, 3 = Engraving, 4 = Dither, 5 = CMYK
      ink1: '#FF2A85',
      ink2: '#0055B8',
      ink3: '#FFE800',
      paper: '#FAF6EE',
      useThreeColors: false,
      separationMode: 0, // 0 = Duotone, 1 = CMYK Color Separation
      inkDensity: 0.95,
      blendMode: 0, // 0 = Multiply, 1 = Subtractive, 2 = Screen, 3 = Overlay

      // Halftone Screening
      dotFrequency: 28.0,
      screenAngle: 45.0, // degrees
      dotShape: 0, // 0 = Round, 1 = Line, 2 = Diamond, 3 = Dither, 4 = Cross
      dotSoftness: 0.6,

      // Misregistration / Layer Shift
      shiftX: 5.0,
      shiftY: -3.5,
      shiftRotation: 0.5, // degrees

      // Paper & Ink Texture
      paperGrain: 0.25,
      inkBleed: 0.15,
      vignette: 0.12,

      // Tone Adjustments
      contrast: 0.25,
      brightness: 0.0,
      threshold: 0.50,
      gamma: 1.05,
      invert: false,

      // Extra Glitch & Effects
      glitchAmount: 0.0,
      vhsScanlines: 0.0,

      // Drum Layer Isolation (0 = All, 1 = Drum 1, 2 = Drum 2, 3 = Drum 3, 4 = Stencil B&W)
      drumIsolation: 0,

      // Authentic Japanese Hanko & Studio Stamps
      enableHanko: true,
      hankoText: '理想',
      hankoShape: 'square',
      hankoPos: 'bottom-right',

      enableLimitedStamp: true,
      stampStyle: 'limited',
      stampNumber: '№ 07/50',

      enableRegMarks: true,
      enableDensityScale: true,

      // Typography Overlay (DISABLED BY DEFAULT - User requested clean photos with no unwanted text/numbers!)
      enableText: false,
      title: '',
      subtitle: '',
      tag: '',
      position: 'bottom',
      fontSize: 72,
      chromaticText: true
    };

    this.audioCtx = null;

    this.init();
  }

  init() {
    this.initWebGL();
    this.renderPalettesList();
    this.bindEvents();
    this.initTelegramWebApp();
    this.updateStampsUI();

    // Check hash or load default preset
    const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
    if (hash && DEMO_GENERATORS[hash]) {
      this.loadPreset(hash);
    } else {
      this.loadPreset('sunflower');
    }

    this.resetZoomAuto();
  }

  // --------------------------------------------------------------------------
  // Telegram Mini App (TMA / WebApp) Integration
  // --------------------------------------------------------------------------
  initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      try {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#16171c');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0f1013');

        // MainButton at bottom inside Telegram
        if (tg.MainButton) {
          tg.MainButton.setText('В ЧАТ // СОХРАНИТЬ ОТТИСК');
          tg.MainButton.color = '#ff2a85';
          tg.MainButton.textColor = '#ffffff';
          tg.MainButton.show();
          tg.MainButton.onClick(() => {
            this.triggerHaptic('notification');
            this.exportImage('png');
          });
        }
      } catch (e) {
        console.warn('Telegram WebApp init note:', e);
      }
    }
  }

  triggerHaptic(type = 'light') {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        const haptic = window.Telegram.WebApp.HapticFeedback;
        if (type === 'impact') {
          haptic.impactOccurred('medium');
        } else if (type === 'heavy') {
          haptic.impactOccurred('heavy');
        } else if (type === 'selection') {
          haptic.selectionChanged();
        } else if (type === 'notification') {
          haptic.notificationOccurred('success');
        } else {
          haptic.impactOccurred('light');
        }
      }
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // WebGL Setup
  // --------------------------------------------------------------------------
  initWebGL() {
    this.gl = this.glCanvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true }) ||
              this.glCanvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });

    if (!this.gl) {
      console.warn('WebGL not supported, falling back to 2D context.');
      this.isWebGLSupported = false;
      return;
    }

    this.isWebGLSupported = true;
    const gl = this.gl;

    // Compile shaders
    const vs = this.compileShader(gl.VERTEX_SHADER, RISO_SHADERS.vertexShader);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, RISO_SHADERS.fragmentShader);

    if (!vs || !fs) {
      this.isWebGLSupported = false;
      return;
    }

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(this.program));
      this.isWebGLSupported = false;
      return;
    }

    gl.useProgram(this.program);

    // Quad geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      0, 0,
      1, 1,
      1, 0
    ]), gl.STATIC_DRAW);

    const aTexCoord = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

    // Create texture
    this.sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  // --------------------------------------------------------------------------
  // Image Loading & Texture Upload
  // --------------------------------------------------------------------------
  setSourceImage(imgOrCanvas) {
    this.sourceImage = imgOrCanvas;
    const w = imgOrCanvas.width || imgOrCanvas.naturalWidth || 1000;
    const h = imgOrCanvas.height || imgOrCanvas.naturalHeight || 1400;

    // Set canvas dimensions
    this.glCanvas.width = w;
    this.glCanvas.height = h;

    if (this.isWebGLSupported) {
      const gl = this.gl;
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);

      // Compose source (clean, no text unless user explicitly enabled it)
      const composedCanvas = this.composeSourceWithText(imgOrCanvas, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, composedCanvas);
    }

    this.resetZoomAuto();
    this.render();
  }

  composeSourceWithText(baseImage, w, h) {
    // If text overlay is disabled or empty, return clean image without any text/numbers
    if (!this.state.enableText || (!this.state.title && !this.state.subtitle && !this.state.tag)) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(baseImage, 0, 0, w, h);
      return c;
    }

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(baseImage, 0, 0, w, h);
    this.drawTextOverlay(ctx, w, h);
    return c;
  }

  drawTextOverlay(ctx, w, h) {
    ctx.save();

    const title = this.state.title;
    const subtitle = this.state.subtitle;
    const tag = this.state.tag;
    const pos = this.state.position;
    const baseSize = this.state.fontSize * (w / 1000);

    ctx.textAlign = 'center';

    let titleY = h * 0.85;
    let subY = h * 0.93;
    let tagY = h * 0.77;

    if (pos === 'top') {
      titleY = h * 0.18;
      subY = h * 0.26;
      tagY = h * 0.10;
    } else if (pos === 'center') {
      titleY = h * 0.48;
      subY = h * 0.58;
      tagY = h * 0.38;
    } else if (pos === 'split') {
      titleY = h * 0.18;
      subY = h * 0.90;
      tagY = h * 0.10;
    }

    // Helper for 3D chromatic drop shadow
    const drawShadowText = (text, font, x, y, strokeW = 0) => {
      ctx.font = font;
      if (this.state.chromaticText) {
        ctx.fillStyle = '#FFE800';
        ctx.fillText(text, x + 6, y + 6);
        ctx.fillStyle = '#FF2A85';
        ctx.fillText(text, x + 3, y + 3);
      }

      ctx.fillStyle = '#1A1A1A';
      if (strokeW > 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = strokeW;
        ctx.strokeText(text, x, y);
      }
      ctx.fillText(text, x, y);
    };

    if (tag) {
      ctx.font = '700 ' + Math.max(12, baseSize * 0.22) + 'px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#333';
      ctx.fillText(tag, w * 0.5, tagY);
    }

    if (title) {
      drawShadowText(title, '900 ' + baseSize + 'px "Cabinet Grotesk", sans-serif', w * 0.5, titleY, 4);
    }

    if (subtitle) {
      drawShadowText(subtitle, '800 ' + (baseSize * 0.55) + 'px "Space Grotesk", sans-serif', w * 0.5, subY, 2);
    }

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Main Render Loop
  // --------------------------------------------------------------------------
  render() {
    if (!this.isWebGLSupported || !this.program || !this.sourceImage) return;

    const gl = this.gl;
    gl.useProgram(this.program);

    const w = this.glCanvas.width;
    const h = this.glCanvas.height;

    // Viewport
    gl.viewport(0, 0, w, h);

    // Uniforms
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_resolution'), w, h);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), performance.now() * 0.001);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_effectMode'), this.state.effectMode);

    // Colors
    const rgb1 = this.hexToRgb(this.state.ink1);
    const rgb2 = this.hexToRgb(this.state.ink2);
    const rgb3 = this.hexToRgb(this.state.ink3);
    const rgbPaper = this.hexToRgb(this.state.paper);

    gl.uniform3f(gl.getUniformLocation(this.program, 'u_inkColor1'), rgb1[0], rgb1[1], rgb1[2]);
    gl.uniform3f(gl.getUniformLocation(this.program, 'u_inkColor2'), rgb2[0], rgb2[1], rgb2[2]);
    gl.uniform3f(gl.getUniformLocation(this.program, 'u_inkColor3'), rgb3[0], rgb3[1], rgb3[2]);
    gl.uniform3f(gl.getUniformLocation(this.program, 'u_paperColor'), rgbPaper[0], rgbPaper[1], rgbPaper[2]);

    gl.uniform1i(gl.getUniformLocation(this.program, 'u_useThreeColors'), this.state.useThreeColors ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_separationMode'), this.state.separationMode);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_inkDensity'), this.state.inkDensity);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_blendMode'), this.state.blendMode);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_drumIsolation'), this.state.drumIsolation);

    // Halftone
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_dotFrequency'), this.state.dotFrequency * 2.0);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_screenAngle'), (this.state.screenAngle * Math.PI) / 180.0);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_dotShape'), this.state.dotShape);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_dotSoftness'), this.state.dotSoftness);

    // Misregistration
    const shiftScaleX = 1.0 / w;
    const shiftScaleY = 1.0 / h;
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_shiftLayer1'), this.state.shiftX * shiftScaleX, this.state.shiftY * shiftScaleY);
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_shiftLayer2'), -this.state.shiftX * 0.4 * shiftScaleX, -this.state.shiftY * 0.4 * shiftScaleY);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_shiftRotation'), (this.state.shiftRotation * Math.PI) / 180.0);

    // Paper & Ink Texture
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_paperGrain'), this.state.paperGrain);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_inkBleed'), this.state.inkBleed);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_vignette'), this.state.vignette);

    // Tone
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_contrast'), this.state.contrast);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_brightness'), this.state.brightness);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_threshold'), this.state.threshold);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_gamma'), this.state.gamma);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_invert'), this.state.invert ? 1 : 0);

    // Glitch & VHS
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_glitchAmount'), this.state.glitchAmount);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_vhsScanlines'), this.state.vhsScanlines);

    // Compare & Scan
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_splitPosition'), this.isComparing ? this.splitPosition : -1.0);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_scanProgress'), this.isScanning ? this.scanProgress : -1.0);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return [
      ((num >> 16) & 255) / 255.0,
      ((num >> 8) & 255) / 255.0,
      (num & 255) / 255.0
    ];
  }

  // --------------------------------------------------------------------------
  // Presets & Demos
  // --------------------------------------------------------------------------
  loadPreset(name) {
    if (DEMO_GENERATORS[name]) {
      const canvas = DEMO_GENERATORS[name](1000, 1400);
      this.setSourceImage(canvas);
      this.showToast(`Пресет: ${name.toUpperCase()}`);
    }
  }

  renderPalettesList() {
    const list = document.getElementById('palettePresetsList');
    list.innerHTML = '';

    RISO_PALETTES.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'palette-item' + (idx === 0 ? ' active' : '');
      item.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span class="palette-name">${p.name}</span>
          <span style="font-size:10px; color:var(--text-dim);">${p.desc}</span>
        </div>
        <div class="palette-swatches">
          <span class="swatch-circle" style="background:${p.ink1};" title="Барабан 1"></span>
          <span class="swatch-circle" style="background:${p.ink2};" title="Барабан 2"></span>
          ${p.use3 ? `<span class="swatch-circle" style="background:${p.ink3};" title="Барабан 3"></span>` : ''}
          <span class="swatch-circle" style="background:${p.paper}; border-color:#ccc;" title="Бумага"></span>
        </div>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        this.state.ink1 = p.ink1;
        this.state.ink2 = p.ink2;
        this.state.ink3 = p.ink3;
        this.state.paper = p.paper;
        this.state.useThreeColors = p.use3;

        this.syncColorInputs();
        this.render();
      });

      list.appendChild(item);
    });
  }

  syncColorInputs() {
    document.getElementById('inkColor1').value = this.state.ink1;
    document.getElementById('inkDot1').style.background = this.state.ink1;
    document.getElementById('inkCode1').textContent = `Слой 1 (${this.state.ink1.toUpperCase()})`;

    document.getElementById('inkColor2').value = this.state.ink2;
    document.getElementById('inkDot2').style.background = this.state.ink2;
    document.getElementById('inkCode2').textContent = `Слой 2 (${this.state.ink2.toUpperCase()})`;

    document.getElementById('inkColor3').value = this.state.ink3;
    document.getElementById('inkDot3').style.background = this.state.ink3;
    document.getElementById('inkCode3').textContent = `Слой 3 (${this.state.ink3.toUpperCase()})`;

    document.getElementById('inkColorPaper').value = this.state.paper;
    document.getElementById('inkDotPaper').style.background = this.state.paper;
    document.getElementById('inkCodePaper').textContent = `Бумага (${this.state.paper.toUpperCase()})`;

    document.getElementById('threeColorToggle').checked = this.state.useThreeColors;
    document.getElementById('inkRow3').style.display = this.state.useThreeColors ? 'flex' : 'none';
    document.getElementById('separationToggle').checked = this.state.separationMode === 1;

    const pill3 = document.getElementById('drumPill3');
    if (pill3) {
      pill3.style.display = this.state.useThreeColors ? 'inline-block' : 'none';
    }
  }

  // --------------------------------------------------------------------------
  // Drum Layer Isolation & Stencil Master Film
  // --------------------------------------------------------------------------
  setDrumIsolation(mode) {
    this.state.drumIsolation = parseInt(mode, 10) || 0;

    // Update Drum Pills in Tab 3
    document.querySelectorAll('.drum-pill').forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.drum, 10) === this.state.drumIsolation);
    });

    // Update Quick Floating Bar Button
    const quickBtn = document.getElementById('btnQuickDrum');
    if (quickBtn) {
      const names = {
        0: '● ВСЕ СЛОИ',
        1: '① БАРАБАН 1',
        2: '② БАРАБАН 2',
        3: '③ БАРАБАН 3',
        4: '◐ СТЕНСИЛ (Ч/Б)'
      };
      quickBtn.textContent = names[this.state.drumIsolation] || '● ВСЕ СЛОИ';
      quickBtn.classList.toggle('active', this.state.drumIsolation !== 0);
    }

    this.triggerHaptic('selection');
    this.render();

    const toastMsgs = {
      0: 'Все слои печати (Master Composite) 🖨️',
      1: 'Изоляция: Барабан 1 (Основной цвет) 🟣',
      2: 'Изоляция: Барабан 2 (Теневой цвет) 🔵',
      3: 'Изоляция: Барабан 3 (Акцентный цвет) 🟡',
      4: 'Мастер-плёнка: Ч/Б Трафарет для шелкографии ◐'
    };
    this.showToast(toastMsgs[this.state.drumIsolation] || 'Слой переключен');
  }

  cycleDrumIsolation() {
    let next = this.state.drumIsolation + 1;
    if (next === 3 && !this.state.useThreeColors) next = 4;
    if (next > 4) next = 0;
    this.setDrumIsolation(next);
  }

  // --------------------------------------------------------------------------
  // Japanese Hanko Seal, Studio Stamps & Registration Marks
  // --------------------------------------------------------------------------
  updateStampsUI() {
    // 1. Japanese Hanko Master Seal (印)
    const hankoBadge = document.getElementById('hankoBadge');
    const hankoChar = document.getElementById('hankoCharText');
    if (hankoBadge) {
      hankoBadge.style.display = this.state.enableHanko ? 'flex' : 'none';
      hankoBadge.classList.remove('pos-bottom-right', 'pos-bottom-left', 'pos-top-right', 'round-seal');
      hankoBadge.classList.add(`pos-${this.state.hankoPos}`);
      if (this.state.hankoShape === 'circle') {
        hankoBadge.classList.add('round-seal');
      }
    }
    if (hankoChar) {
      hankoChar.textContent = this.state.hankoText || '理想';
    }

    // 2. Studio Edition Stamp
    const stampEl = document.getElementById('studioEditionStamp');
    const stampLabel = document.getElementById('stampLabelText');
    const stampNum = document.getElementById('stampNumText');
    if (stampEl) {
      stampEl.style.display = this.state.enableLimitedStamp ? 'inline-flex' : 'none';
    }
    if (stampLabel) {
      const labels = {
        limited: 'LIMITED EDITION',
        tokyo: 'TOKYO PRINT LAB 1984',
        sample: 'SAMPLE // NOT FOR SALE',
        qc: 'PASSED INSPECTION 済'
      };
      stampLabel.textContent = labels[this.state.stampStyle] || 'LIMITED EDITION';
    }
    if (stampNum) {
      stampNum.textContent = this.state.stampNumber || '№ 07/50';
    }

    // 3. 4 Corner Registration Crosshairs
    const regMarks = ['markTL', 'markTR', 'markBL', 'markBR'];
    regMarks.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = this.state.enableRegMarks ? 'block' : 'none';
    });

    // 4. Density Calibration Wedge Bar
    const densityBar = document.getElementById('densityBar');
    if (densityBar) {
      densityBar.style.display = this.state.enableDensityScale ? 'flex' : 'none';
    }
  }

  // --------------------------------------------------------------------------
  // 2D Composite Canvas Rendering for Export (PNG, JPG, Telegram)
  // --------------------------------------------------------------------------
  renderCompositeExportCanvas() {
    const w = this.glCanvas.width;
    const h = this.glCanvas.height;
    this.exportCanvas.width = w;
    this.exportCanvas.height = h;
    const ctx = this.exportCanvas.getContext('2d');

    // 1. Draw WebGL Riso output
    ctx.drawImage(this.glCanvas, 0, 0, w, h);

    const s = Math.max(1, w / 800); // Scale factor for resolution independence

    // 2. Draw Corner Registration Crosshairs
    if (this.state.enableRegMarks) {
      this.drawRegistrationMarksToCanvas(ctx, w, h, s);
    }

    // 3. Draw Density Calibration Wedges
    if (this.state.enableDensityScale) {
      this.drawDensityScaleToCanvas(ctx, w, h, s);
    }

    // 4. Draw Studio Edition Stamp
    if (this.state.enableLimitedStamp) {
      this.drawStudioStampToCanvas(ctx, w, h, s);
    }

    // 5. Draw Authentic Japanese Hanko Seal
    if (this.state.enableHanko) {
      this.drawHankoToCanvas(ctx, w, h, s);
    }

    return this.exportCanvas;
  }

  drawRegistrationMarksToCanvas(ctx, w, h, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = '#0055b8';
    ctx.lineWidth = 1.2 * s;

    const pad = 18 * s;
    const r = 6 * s;
    const len = 18 * s;
    const corners = [
      [pad, pad],
      [w - pad, pad],
      [pad, h - pad],
      [w - pad, h - pad]
    ];

    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - len, cy);
      ctx.lineTo(cx + len, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy - len);
      ctx.lineTo(cx, cy + len);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawDensityScaleToCanvas(ctx, w, h, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const bw = 8 * s;
    const bh = 18 * s;
    const x = w - 16 * s;
    let y = h / 2 - (bh * 2);

    const steps = [
      'rgba(0, 85, 184, 1.0)',
      'rgba(0, 85, 184, 0.75)',
      'rgba(0, 85, 184, 0.50)',
      'rgba(0, 85, 184, 0.25)'
    ];

    steps.forEach(color => {
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 0.8 * s;
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeRect(x, y, bw, bh);
      y += bh + (3 * s);
    });
    ctx.restore();
  }

  drawStudioStampToCanvas(ctx, w, h, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.translate(24 * s, h - 30 * s);
    ctx.rotate(0.02);

    const labels = {
      limited: 'LIMITED EDITION',
      tokyo: 'TOKYO PRINT LAB 1984',
      sample: 'SAMPLE // NOT FOR SALE',
      qc: 'PASSED INSPECTION 済'
    };
    const title = labels[this.state.stampStyle] || 'LIMITED EDITION';
    const num = this.state.stampNumber || '№ 07/50';

    ctx.font = `bold ${10 * s}px "Courier New", monospace`;
    const tw1 = ctx.measureText(title).width;
    ctx.font = `900 ${12 * s}px "Courier New", monospace`;
    const tw2 = ctx.measureText(num).width;
    const boxW = Math.max(tw1, tw2) + 20 * s;
    const boxH = 34 * s;

    // Stamp box
    ctx.strokeStyle = 'rgba(26, 28, 35, 0.85)';
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([4 * s, 3 * s]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(0, -boxH + 6 * s, boxW, boxH);
    ctx.strokeRect(0, -boxH + 6 * s, boxW, boxH);

    // Text
    ctx.setLineDash([]);
    ctx.fillStyle = '#1a1c23';
    ctx.font = `bold ${9 * s}px "Courier New", monospace`;
    ctx.fillText(title, 8 * s, -boxH + 18 * s);

    ctx.fillStyle = '#d32f2f';
    ctx.font = `900 ${12 * s}px "Courier New", monospace`;
    ctx.fillText(num, 8 * s, -boxH + 31 * s);

    ctx.restore();
  }

  drawHankoToCanvas(ctx, w, h, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';

    const size = 52 * s;
    let x = w - size - 24 * s;
    let y = h - size - 24 * s;

    if (this.state.hankoPos === 'bottom-left') {
      x = 24 * s;
      y = h - size - 60 * s;
    } else if (this.state.hankoPos === 'top-right') {
      x = w - size - 24 * s;
      y = 24 * s;
    }

    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(-0.06);

    const half = size / 2;
    const red = '#d32f2f';

    ctx.strokeStyle = red;
    ctx.lineWidth = 2.8 * s;
    ctx.fillStyle = 'rgba(211, 47, 47, 0.08)';

    if (this.state.hankoShape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, half - 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.setLineDash([3 * s, 2 * s]);
      ctx.lineWidth = 1.2 * s;
      ctx.arc(0, 0, half - 6 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const r = 4 * s;
      ctx.beginPath();
      ctx.moveTo(-half + r, -half);
      ctx.arcTo(half, -half, half, half, r);
      ctx.arcTo(half, half, -half, half, r);
      ctx.arcTo(-half, half, -half, -half, r);
      ctx.arcTo(-half, -half, half, -half, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = red;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${22 * s}px "Yu Mincho", "Hiragino Mincho ProN", serif`;
    ctx.fillText(this.state.hankoText || '理想', 0, 1 * s);

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Auto-Fit Zoom & Multi-Touch Gestures
  // --------------------------------------------------------------------------
  resetZoomAuto() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  applyManualZoom(factor) {
    this.zoom *= factor;
    this.zoom = Math.max(0.4, Math.min(4.0, this.zoom));
    if (this.zoom <= 1.02) {
      this.panX = 0;
      this.panY = 0;
    }
    this.applyTransform();
  }

  applyTransform() {
    if (this.zoom <= 1.02 && Math.abs(this.panX) < 1 && Math.abs(this.panY) < 1) {
      this.paperWrapper.style.transform = 'none';
      const zt = document.getElementById('zoomText');
      if (zt) zt.textContent = 'Fit';
    } else {
      this.paperWrapper.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.zoom})`;
      const zt = document.getElementById('zoomText');
      if (zt) zt.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  // --------------------------------------------------------------------------
  // Collapsible Bottom Sheet Drawer ("вниз можно ли его скрыть / свайпнуть")
  // --------------------------------------------------------------------------
  toggleDrawer(forceState) {
    if (typeof forceState === 'boolean') {
      this.isDrawerCollapsed = forceState;
    } else {
      this.isDrawerCollapsed = !this.isDrawerCollapsed;
    }

    const sidebar = document.getElementById('controlSidebar');
    const workspace = document.querySelector('.app-workspace');
    const toggleIcon = document.getElementById('sheetToggleIcon');
    const toggleText = document.getElementById('sheetToggleText');
    const floatToggleBtn = document.getElementById('btnToggleDrawer');

    if (sidebar) {
      sidebar.classList.toggle('collapsed', this.isDrawerCollapsed);
    }
    if (workspace) {
      workspace.classList.toggle('drawer-collapsed', this.isDrawerCollapsed);
    }

    if (this.isDrawerCollapsed) {
      if (toggleIcon) toggleIcon.textContent = '▲';
      if (toggleText) toggleText.textContent = 'ОТКРЫТЬ НАСТРОЙКИ';
      if (floatToggleBtn) {
        floatToggleBtn.textContent = '▲ НАСТРОЙКИ';
        floatToggleBtn.classList.add('active');
      }
      this.showToast('Панель скрыта — полный просмотр артворка 🖼️');
    } else {
      if (toggleIcon) toggleIcon.textContent = '▼';
      if (toggleText) toggleText.textContent = 'СВЕРНУТЬ ПАНЕЛЬ НАСТРОЕК';
      if (floatToggleBtn) {
        floatToggleBtn.textContent = '▼ СВЕРНУТЬ';
        floatToggleBtn.classList.remove('active');
      }
    }
    this.triggerHaptic('impact');
  }

  initDrawerEvents() {
    const drawerHandle = document.getElementById('sheetDrawerHandle');
    const floatToggleBtn = document.getElementById('btnToggleDrawer');
    const sidebarTabs = document.querySelector('.sidebar-tabs');

    if (floatToggleBtn) {
      floatToggleBtn.addEventListener('click', () => {
        this.toggleDrawer();
      });
    }

    if (drawerHandle) {
      drawerHandle.addEventListener('click', () => {
        this.toggleDrawer();
      });

      // Touch swipe gesture on handle (swipe down to collapse, swipe up to expand)
      let startY = 0;
      let startX = 0;
      drawerHandle.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          startY = e.touches[0].clientY;
          startX = e.touches[0].clientX;
        }
      }, { passive: true });

      drawerHandle.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const diffY = e.changedTouches[0].clientY - startY;
          const diffX = Math.abs(e.changedTouches[0].clientX - startX);
          if (Math.abs(diffY) > 25 && Math.abs(diffY) > diffX) {
            if (diffY > 0 && !this.isDrawerCollapsed) {
              this.toggleDrawer(true);
            } else if (diffY < 0 && this.isDrawerCollapsed) {
              this.toggleDrawer(false);
            }
          }
        }
      }, { passive: true });
    }

    if (sidebarTabs) {
      let tabStartY = 0;
      sidebarTabs.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          tabStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      sidebarTabs.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const diffY = e.changedTouches[0].clientY - tabStartY;
          if (diffY > 45 && !this.isDrawerCollapsed) {
            this.toggleDrawer(true);
          }
        }
      }, { passive: true });
    }
  }

  initStageGestures() {
    const stage = this.canvasStage;
    if (!stage) return;

    let touchStartDist = 0;
    let initialZoom = 1.0;
    let touchStartX = 0;
    let touchStartY = 0;
    let initialPanX = 0;
    let initialPanY = 0;
    let isPinching = false;
    let isPanning = false;
    let lastTapTime = 0;

    // Multi-touch gestures (Pinch-to-zoom + Pan + Double tap)
    stage.addEventListener('touchstart', (e) => {
      if (this.isComparing || this.isDraggingSplit) return;

      if (e.touches.length === 2) {
        isPinching = true;
        isPanning = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = this.zoom;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime < 300) {
          // Double-tap
          if (this.zoom > 1.15) {
            this.resetZoomAuto();
            this.showToast('Масштаб: 100% (Fit)');
          } else {
            this.zoom = 2.0;
            this.panX = 0;
            this.panY = 0;
            this.applyTransform();
            this.showToast('Масштаб: 200%');
          }
          this.triggerHaptic('impact');
          lastTapTime = 0;
          return;
        }
        lastTapTime = now;

        if (this.zoom > 1.05) {
          isPanning = true;
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          initialPanX = this.panX;
          initialPanY = this.panY;
        }
      }
    }, { passive: false });

    stage.addEventListener('touchmove', (e) => {
      if (this.isComparing || this.isDraggingSplit) return;

      if (e.touches.length === 2 && isPinching && touchStartDist > 0) {
        if (e.cancelable) e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = currentDist / touchStartDist;
        this.zoom = Math.max(0.4, Math.min(4.0, initialZoom * scaleFactor));
        this.applyTransform();
      } else if (e.touches.length === 1 && isPanning && this.zoom > 1.05) {
        if (e.cancelable) e.preventDefault();
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        this.panX = initialPanX + dx;
        this.panY = initialPanY + dy;
        this.applyTransform();
      }
    }, { passive: false });

    const endTouch = (e) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }
      if (e.touches.length === 0) {
        isPanning = false;
        if (this.zoom < 0.95) {
          this.resetZoomAuto();
        }
      }
    };

    stage.addEventListener('touchend', endTouch);
    stage.addEventListener('touchcancel', endTouch);

    // Mouse Wheel Zoom
    stage.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey || stage.matches(':hover')) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.15 : 0.88;
        this.applyManualZoom(delta);
      }
    }, { passive: false });
  }

  // --------------------------------------------------------------------------
  // Scanner Animation & Sound FX
  // --------------------------------------------------------------------------
  triggerScannerAnimation() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.scanProgress = 0.0;
    this.scannerBar.classList.add('active');

    this.playScannerSound();

    const anim = () => {
      this.scanProgress += this.scanSpeed;

      const barY = this.scanProgress * this.glCanvas.clientHeight;
      this.scannerBar.style.transform = `translateY(${barY}px)`;

      if (this.scanProgress >= 1.0) {
        this.isScanning = false;
        this.scanProgress = -1.0;
        this.scannerBar.classList.remove('active');
        this.render();
        this.showToast('Сканирование завершено ✨');
        return;
      }

      this.render();
      this.scanAnimId = requestAnimationFrame(anim);
    };

    anim();
  }

  playScannerSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 1.2);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 2.5);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.3);
      gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 2.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 2.6);
    } catch (e) {
      // Audio optional
    }
  }

  // --------------------------------------------------------------------------
  // Split Comparison Slider
  // --------------------------------------------------------------------------
  toggleCompareMode() {
    this.isComparing = !this.isComparing;
    const btn = document.getElementById('btnCompare');

    if (this.isComparing) {
      btn.classList.add('active');
      this.splitSlider.classList.add('active');
      this.splitPosition = 0.5;
      this.updateSplitHandleUI(0.5);
    } else {
      btn.classList.remove('active');
      this.splitSlider.classList.remove('active');
      this.splitPosition = -1.0;
    }
    this.render();
  }

  updateSplitHandleUI(pos) {
    this.splitHandle.style.left = `${pos * 100}%`;
  }

  // --------------------------------------------------------------------------
  // Event Binding
  // --------------------------------------------------------------------------
  bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.triggerHaptic('selection');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(`tab-${btn.dataset.tab}`);
        if (target) target.classList.add('active');
      });
    });

    // Effect Cards Selection
    document.querySelectorAll('.effect-card').forEach(card => {
      card.addEventListener('click', () => {
        this.triggerHaptic('selection');
        document.querySelectorAll('.effect-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const mode = card.dataset.mode;
        if (mode === 'riso') {
          // Reset completely back to authentic dual-drum Risograph
          this.state.effectMode = 0;
          this.state.dotShape = 0;
          this.state.dotFrequency = 28;
          this.state.useThreeColors = false;
          this.state.separationMode = 0;
          this.state.blendMode = 0; // Multiply
          this.state.contrast = 0.25;
          this.state.brightness = 0.0;
          this.state.ink1 = '#FF2A85';
          this.state.ink2 = '#0055B8';
          this.state.paper = '#FAF6EE';
        } else if (mode === 'newspaper') {
          this.state.effectMode = 1;
          this.state.dotShape = 0;
          this.state.dotFrequency = 45;
          this.state.useThreeColors = false;
          this.state.separationMode = 0;
          this.state.blendMode = 0;
          this.state.contrast = 0.45;
          this.state.ink1 = '#1A1B1F';
          this.state.ink2 = '#1A1B1F';
          this.state.paper = '#F4EFE6';
        } else if (mode === 'halftone') {
          this.state.effectMode = 2;
          this.state.dotShape = 0;
          this.state.dotFrequency = 22;
          this.state.useThreeColors = false;
          this.state.separationMode = 0;
          this.state.blendMode = 0;
        } else if (mode === 'engraving') {
          this.state.effectMode = 3;
          this.state.dotShape = 1; // line screen
          this.state.dotFrequency = 32;
          this.state.useThreeColors = false;
          this.state.separationMode = 0;
          this.state.blendMode = 0;
        } else if (mode === 'dither') {
          this.state.effectMode = 4;
          this.state.dotShape = 3; // 8-bit dither
          this.state.dotFrequency = 60;
          this.state.useThreeColors = false;
          this.state.separationMode = 0;
          this.state.blendMode = 0;
        } else if (mode === 'cmyk') {
          this.state.effectMode = 5;
          this.state.dotShape = 0;
          this.state.dotFrequency = 30;
          this.state.useThreeColors = true;
          this.state.separationMode = 1;
          this.state.blendMode = 1;
          this.state.ink1 = '#FF2A85'; // Magenta
          this.state.ink2 = '#0055B8'; // Cyan
          this.state.ink3 = '#FFE800'; // Yellow
          this.state.paper = '#FAF6EE';
        }

        this.syncColorInputs();
        this.syncInputsWithState();
        this.render();
      });
    });

    // Quick presets top bar
    document.querySelectorAll('#quickDemos .preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.triggerHaptic('selection');
        document.querySelectorAll('#quickDemos .preset-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.loadPreset(pill.dataset.preset);
      });
    });

    // Style presets tags
    document.querySelectorAll('.style-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        document.querySelectorAll('.style-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        const s = tag.dataset.stylePreset;
        if (s === 'classic-riso') {
          this.state.ink1 = '#FF2A85';
          this.state.ink2 = '#0055B8';
          this.state.shiftX = 6;
          this.state.shiftY = -4;
          this.state.dotFrequency = 26;
        } else if (s === 'tokyo-zine') {
          this.state.ink1 = '#F15060';
          this.state.ink2 = '#00838F';
          this.state.shiftX = -5;
          this.state.shiftY = 5;
          this.state.dotFrequency = 32;
        } else if (s === 'cyber-punk') {
          this.state.ink1 = '#00E676';
          this.state.ink2 = '#6200EA';
          this.state.ink3 = '#FF2A85';
          this.state.useThreeColors = true;
          this.state.blendMode = 2;
        } else if (s === 'vintage-press') {
          this.state.ink1 = '#1F2229';
          this.state.ink2 = '#8D6E63';
          this.state.paper = '#F3ECD8';
          this.state.dotShape = 1;
        } else if (s === 'dark-ink') {
          this.state.ink1 = '#FF2A85';
          this.state.ink2 = '#111111';
          this.state.contrast = 0.55;
        }
        this.syncColorInputs();
        this.syncInputsWithState();
        this.render();
      });
    });

    // Main Shift Slider
    const shiftMain = document.getElementById('shiftAmountMain');
    shiftMain.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('shiftValMain').textContent = `${Math.round(v)}%`;
      this.state.shiftX = (v / 100) * 16;
      this.state.shiftY = -(v / 100) * 12;
      document.getElementById('shiftX').value = this.state.shiftX;
      document.getElementById('shiftY').value = this.state.shiftY;
      document.getElementById('shiftXVal').textContent = `${Math.round(this.state.shiftX)}px`;
      document.getElementById('shiftYVal').textContent = `${Math.round(this.state.shiftY)}px`;
      this.render();
    });

    // Color Pickers
    document.getElementById('inkColor1').addEventListener('input', (e) => {
      this.state.ink1 = e.target.value;
      this.syncColorInputs();
      this.render();
    });
    document.getElementById('inkColor2').addEventListener('input', (e) => {
      this.state.ink2 = e.target.value;
      this.syncColorInputs();
      this.render();
    });
    document.getElementById('inkColor3').addEventListener('input', (e) => {
      this.state.ink3 = e.target.value;
      this.syncColorInputs();
      this.render();
    });
    document.getElementById('inkColorPaper').addEventListener('input', (e) => {
      this.state.paper = e.target.value;
      this.syncColorInputs();
      this.render();
    });

    document.getElementById('threeColorToggle').addEventListener('change', (e) => {
      this.state.useThreeColors = e.target.checked;
      this.syncColorInputs();
      this.render();
    });

    document.getElementById('separationToggle').addEventListener('change', (e) => {
      this.state.separationMode = e.target.checked ? 1 : 0;
      this.render();
    });

    document.getElementById('inkDensity').addEventListener('input', (e) => {
      this.state.inkDensity = parseFloat(e.target.value) / 100;
      document.getElementById('inkDensityVal').textContent = `${e.target.value}%`;
      this.render();
    });

    document.getElementById('blendMode').addEventListener('change', (e) => {
      const map = { multiply: 0, subtractive: 1, screen: 2, overlay: 3 };
      this.state.blendMode = map[e.target.value] || 0;
      this.render();
    });

    // Detailed Riso Sliders
    this.bindRange('dotFrequency', 'dotFreqVal', ' lpi', (v) => { this.state.dotFrequency = v; });
    this.bindRange('screenAngle', 'screenAngleVal', '°', (v) => { this.state.screenAngle = v; });
    this.bindRange('dotSoftness', 'dotSoftVal', '%', (v) => { this.state.dotSoftness = v / 100; });
    this.bindRange('shiftX', 'shiftXVal', 'px', (v) => { this.state.shiftX = v; });
    this.bindRange('shiftY', 'shiftYVal', 'px', (v) => { this.state.shiftY = v; });
    this.bindRange('shiftRotation', 'shiftRotVal', '°', (v) => { this.state.shiftRotation = v; });

    document.getElementById('dotShape').addEventListener('change', (e) => {
      const map = { round: 0, line: 1, diamond: 2, dither: 3, cross: 4 };
      this.state.dotShape = map[e.target.value] || 0;
      this.render();
    });

    this.bindRange('paperGrain', 'paperGrainVal', '%', (v) => { this.state.paperGrain = v / 100; });
    this.bindRange('inkBleed', 'inkBleedVal', '%', (v) => { this.state.inkBleed = v / 100; });
    this.bindRange('vignette', 'vignetteVal', '%', (v) => { this.state.vignette = v / 100; });

    // Tone Sliders
    this.bindRange('contrast', 'contrastVal', '%', (v) => { this.state.contrast = v / 100; });
    this.bindRange('brightness', 'brightnessVal', '%', (v) => { this.state.brightness = v / 100; });
    this.bindRange('threshold', 'threshVal', '%', (v) => { this.state.threshold = v / 100; });
    this.bindRange('gamma', 'gammaVal', '', (v) => { this.state.gamma = v; });

    document.getElementById('invertToggle').addEventListener('change', (e) => {
      this.state.invert = e.target.checked;
      this.render();
    });

    // Glitch & VHS Sliders
    this.bindRange('glitchAmount', 'glitchVal', '%', (v) => { this.state.glitchAmount = v / 100; });
    this.bindRange('vhsScanlines', 'scanlinesVal', '%', (v) => { this.state.vhsScanlines = v / 100; });

    // Typography (Only applied when user explicitly checks "Включить типографику")
    const reuploadWithText = () => {
      if (this.sourceImage) {
        this.setSourceImage(this.sourceImage);
      }
    };

    document.getElementById('enableTextOverlay').addEventListener('change', (e) => {
      this.state.enableText = e.target.checked;
      reuploadWithText();
    });
    document.getElementById('posterTitle').addEventListener('input', (e) => {
      this.state.title = e.target.value;
      if (this.state.enableText) reuploadWithText();
    });
    document.getElementById('posterSubtitle').addEventListener('input', (e) => {
      this.state.subtitle = e.target.value;
      if (this.state.enableText) reuploadWithText();
    });
    document.getElementById('posterTag').addEventListener('input', (e) => {
      this.state.tag = e.target.value;
      if (this.state.enableText) reuploadWithText();
    });
    document.getElementById('posterPosition').addEventListener('change', (e) => {
      this.state.position = e.target.value;
      if (this.state.enableText) reuploadWithText();
    });
    this.bindRange('fontSize', 'fontSizeVal', 'px', (v) => {
      this.state.fontSize = v;
      if (this.state.enableText) reuploadWithText();
    });
    document.getElementById('textChromatic').addEventListener('change', (e) => {
      this.state.chromaticText = e.target.checked;
      if (this.state.enableText) reuploadWithText();
    });

    // Drum Layer Isolation
    const btnQuickDrum = document.getElementById('btnQuickDrum');
    if (btnQuickDrum) {
      btnQuickDrum.addEventListener('click', () => {
        this.cycleDrumIsolation();
      });
    }

    document.querySelectorAll('.drum-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.setDrumIsolation(pill.dataset.drum);
      });
    });

    // Hanko Seal Controls
    const enableHankoToggle = document.getElementById('enableHankoToggle');
    if (enableHankoToggle) {
      enableHankoToggle.addEventListener('change', (e) => {
        this.state.enableHanko = e.target.checked;
        this.triggerHaptic('selection');
        this.updateStampsUI();
      });
    }

    document.querySelectorAll('#hankoKanjiChips .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#hankoKanjiChips .chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.hankoText = btn.dataset.kanji;
        this.triggerHaptic('selection');
        this.updateStampsUI();
      });
    });

    const hankoShape = document.getElementById('hankoShape');
    if (hankoShape) {
      hankoShape.addEventListener('change', (e) => {
        this.state.hankoShape = e.target.value;
        this.updateStampsUI();
      });
    }

    const hankoPosition = document.getElementById('hankoPosition');
    if (hankoPosition) {
      hankoPosition.addEventListener('change', (e) => {
        this.state.hankoPos = e.target.value;
        this.updateStampsUI();
      });
    }

    // Studio Edition Stamp Controls
    const enableStampToggle = document.getElementById('enableStampToggle');
    if (enableStampToggle) {
      enableStampToggle.addEventListener('change', (e) => {
        this.state.enableLimitedStamp = e.target.checked;
        this.triggerHaptic('selection');
        this.updateStampsUI();
      });
    }

    document.querySelectorAll('#stampTypeChips .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#stampTypeChips .chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.stampStyle = btn.dataset.stamp;
        this.triggerHaptic('selection');
        this.updateStampsUI();
      });
    });

    const stampNumInput = document.getElementById('stampNumberInput');
    if (stampNumInput) {
      stampNumInput.addEventListener('input', (e) => {
        this.state.stampNumber = e.target.value;
        this.updateStampsUI();
      });
    }

    const btnRandomStamp = document.getElementById('btnRandomStampNum');
    if (btnRandomStamp) {
      btnRandomStamp.addEventListener('click', () => {
        const n = String(Math.floor(Math.random() * 50) + 1).padStart(2, '0');
        const max = 50;
        this.state.stampNumber = `№ ${n}/${max}`;
        if (stampNumInput) stampNumInput.value = this.state.stampNumber;
        this.triggerHaptic('impact');
        this.updateStampsUI();
      });
    }

    // Registration Marks & Density Scale Controls
    const regMarksToggle = document.getElementById('enableRegMarksToggle');
    if (regMarksToggle) {
      regMarksToggle.addEventListener('change', (e) => {
        this.state.enableRegMarks = e.target.checked;
        this.triggerHaptic('selection');
        this.updateStampsUI();
      });
    }

    const densityToggle = document.getElementById('enableDensityToggle');
    if (densityToggle) {
      densityToggle.addEventListener('change', (e) => {
        this.state.enableDensityScale = e.target.checked;
        this.triggerHaptic('selection');
        this.updateStampsUI();
      });
    }

    // Scanner & Compare buttons (Desktop & Mobile)
    const scanHandler = () => {
      this.triggerHaptic('impact');
      this.triggerScannerAnimation();
    };
    const compareHandler = () => {
      this.triggerHaptic('impact');
      this.toggleCompareMode();
    };

    const btnScan = document.getElementById('btnScanAnim');
    if (btnScan) btnScan.addEventListener('click', scanHandler);

    const btnCompare = document.getElementById('btnCompare');
    if (btnCompare) btnCompare.addEventListener('click', compareHandler);

    const btnScanMob = document.getElementById('btnScanMobile');
    if (btnScanMob) btnScanMob.addEventListener('click', scanHandler);

    const btnCompareMob = document.getElementById('btnCompareMobile');
    if (btnCompareMob) btnCompareMob.addEventListener('click', compareHandler);

    // Split Handle Mouse & Touch Drag
    const onSplitMove = (clientX) => {
      const rect = this.glCanvas.getBoundingClientRect();
      const pos = Math.max(0.0, Math.min(1.0, (clientX - rect.left) / rect.width));
      this.splitPosition = pos;
      this.updateSplitHandleUI(pos);
      this.render();
    };

    this.splitSlider.addEventListener('mousedown', (e) => {
      this.isDraggingSplit = true;
      onSplitMove(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingSplit) {
        onSplitMove(e.clientX);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingSplit = false;
    });

    // Touch support for Split Slider
    this.splitSlider.addEventListener('touchstart', (e) => {
      this.isDraggingSplit = true;
      if (e.touches && e.touches[0]) onSplitMove(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isDraggingSplit && e.touches && e.touches[0]) {
        onSplitMove(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isDraggingSplit = false;
    });

    // Zoom Buttons
    document.getElementById('btnZoomIn').addEventListener('click', () => {
      this.applyManualZoom(1.25);
    });
    document.getElementById('btnZoomOut').addEventListener('click', () => {
      this.applyManualZoom(0.8);
    });
    document.getElementById('btnZoomFit').addEventListener('click', () => {
      this.resetZoomAuto();
    });

    // Randomize Button
    document.getElementById('btnRandomize').addEventListener('click', () => {
      this.triggerHaptic('impact');
      const p = RISO_PALETTES[Math.floor(Math.random() * RISO_PALETTES.length)];
      this.state.ink1 = p.ink1;
      this.state.ink2 = p.ink2;
      this.state.ink3 = p.ink3;
      this.state.paper = p.paper;
      this.state.useThreeColors = p.use3;
      this.state.shiftX = (Math.random() - 0.5) * 16;
      this.state.shiftY = (Math.random() - 0.5) * 14;
      this.state.dotFrequency = 18 + Math.random() * 24;

      this.syncColorInputs();
      this.syncInputsWithState();
      this.render();
      this.showToast('🎲 Случайный микс применён!');
    });

    // File Upload
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.loadFile(file);
    });

    // Camera Event Listeners
    const btnCamera = document.getElementById('btnCamera');
    if (btnCamera) {
      btnCamera.addEventListener('click', () => {
        this.openCameraModal();
      });
    }

    const btnCloseCamera = document.getElementById('btnCloseCamera');
    if (btnCloseCamera) {
      btnCloseCamera.addEventListener('click', () => {
        this.closeCameraModal();
      });
    }

    const btnSwitchCamera = document.getElementById('btnSwitchCamera');
    if (btnSwitchCamera) {
      btnSwitchCamera.addEventListener('click', () => {
        this.switchCamera();
      });
    }

    const btnMirrorCamera = document.getElementById('btnMirrorCamera');
    if (btnMirrorCamera) {
      btnMirrorCamera.addEventListener('click', () => {
        this.isCameraMirrored = !this.isCameraMirrored;
        if (this.cameraVideo) {
          this.cameraVideo.classList.toggle('mirrored', this.isCameraMirrored);
        }
        const mirrorText = document.getElementById('mirrorBtnText');
        if (mirrorText) {
          mirrorText.textContent = this.isCameraMirrored ? 'Зеркало: Вкл' : 'Зеркало: Выкл';
        }
        this.triggerHaptic('selection');
        this.showToast(this.isCameraMirrored ? 'Зеркало включено' : 'Естественное направление (без зеркала)');
      });
    }

    const btnCapturePhoto = document.getElementById('btnCapturePhoto');
    if (btnCapturePhoto) {
      btnCapturePhoto.addEventListener('click', () => {
        this.capturePhotoFromCamera();
      });
    }

    const btnLiveStream = document.getElementById('btnLiveStream');
    if (btnLiveStream) {
      btnLiveStream.addEventListener('click', () => {
        this.startLiveCamera();
      });
    }

    const btnStopLive = document.getElementById('btnStopLive');
    if (btnStopLive) {
      btnStopLive.addEventListener('click', () => {
        this.stopLiveCamera();
      });
    }

    // Close camera on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.cameraModal && this.cameraModal.classList.contains('active')) {
          this.closeCameraModal();
        }
        if (this.isLiveCamera) {
          this.stopLiveCamera();
        }
      }
    });

    // Drag & Drop
    const stage = this.canvasStage;
    ['dragenter', 'dragover'].forEach(name => {
      stage.addEventListener(name, (e) => {
        e.preventDefault();
        stage.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      stage.addEventListener(name, (e) => {
        e.preventDefault();
        stage.classList.remove('drag-over');
      });
    });

    stage.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) this.loadFile(files[0]);
    });

    // Clipboard Paste (Ctrl+V)
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          this.loadFile(blob);
          this.showToast('Изображение вставлено из буфера!');
          break;
        }
      }
    });

    // Export Dropdown
    const exportBtn = document.getElementById('btnExportMenu');
    const exportDropdown = document.getElementById('exportDropdown');
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.parentElement.classList.toggle('open');
    });

    window.addEventListener('click', () => {
      exportDropdown.parentElement.classList.remove('open');
    });

    // Export Actions
    document.getElementById('btnDownloadPNG').addEventListener('click', () => {
      this.exportImage('png');
    });
    document.getElementById('btnDownloadJPG').addEventListener('click', () => {
      this.exportImage('jpeg');
    });
    document.getElementById('btnCopyClipboard').addEventListener('click', () => {
      this.copyToClipboard();
    });
    document.getElementById('btnRecordScanVideo').addEventListener('click', () => {
      this.recordScannerVideo();
    });

    // Window Resize
    window.addEventListener('resize', () => {
      this.resetZoomAuto();
    });

    // Mobile Drawer & Stage Gestures
    this.initDrawerEvents();
    this.initStageGestures();
  }

  bindRange(id, valId, suffix, callback) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (!el || !valEl) return;

    el.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      valEl.textContent = `${e.target.value}${suffix}`;
      callback(val);
      this.render();
    });
    // Reset Button
    const resetBtn = document.getElementById('btnResetApp');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.triggerHaptic('heavy');
        this.resetToDefaults();
      });
    }
  }

  resetToDefaults() {
    this.state.effectMode = 0;
    this.state.ink1 = '#FF2A85';
    this.state.ink2 = '#0055B8';
    this.state.ink3 = '#FFE800';
    this.state.paper = '#FAF6EE';
    this.state.useThreeColors = false;
    this.state.separationMode = 0;
    this.state.inkDensity = 0.95;
    this.state.blendMode = 0; // Multiply

    this.state.dotFrequency = 28.0;
    this.state.screenAngle = 45.0;
    this.state.dotShape = 0;
    this.state.dotSoftness = 0.6;

    this.state.shiftX = 5.0;
    this.state.shiftY = -3.5;
    this.state.shiftRotation = 0.5;

    this.state.paperGrain = 0.25;
    this.state.inkBleed = 0.15;
    this.state.vignette = 0.12;

    this.state.contrast = 0.25;
    this.state.brightness = 0.0;
    this.state.threshold = 0.50;
    this.state.gamma = 1.05;
    this.state.invert = false;

    this.state.glitchAmount = 0.0;
    this.state.vhsScanlines = 0.0;

    // Reset UI active cards
    document.querySelectorAll('.effect-card').forEach(c => c.classList.remove('active'));
    const risoCard = document.querySelector('.effect-card[data-mode="riso"]');
    if (risoCard) risoCard.classList.add('active');

    // Reset style tags
    document.querySelectorAll('.style-tag').forEach(t => t.classList.remove('active'));
    const classicStyle = document.querySelector('.style-tag[data-style-preset="classic-riso"]');
    if (classicStyle) classicStyle.classList.add('active');

    this.syncColorInputs();
    this.syncInputsWithState();
    this.resetZoomAuto();
    this.render();
    this.showToast('Параметры сброшены в исходные (Ризограф) ↺');
  }

  syncInputsWithState() {
    // Halftone
    const dotFreq = document.getElementById('dotFrequency');
    if (dotFreq) {
      dotFreq.value = this.state.dotFrequency;
      document.getElementById('dotFreqVal').textContent = `${Math.round(this.state.dotFrequency)} lpi`;
    }

    const angle = document.getElementById('screenAngle');
    if (angle) {
      angle.value = this.state.screenAngle;
      document.getElementById('screenAngleVal').textContent = `${Math.round(this.state.screenAngle)}°`;
    }

    const shape = document.getElementById('dotShape');
    if (shape) {
      const shapeMapRev = ['round', 'line', 'diamond', 'dither', 'cross'];
      shape.value = shapeMapRev[this.state.dotShape] || 'round';
    }

    const soft = document.getElementById('dotSoftness');
    if (soft) {
      soft.value = Math.round(this.state.dotSoftness * 100);
      document.getElementById('dotSoftVal').textContent = `${Math.round(this.state.dotSoftness * 100)}%`;
    }

    // Shift
    const shiftX = document.getElementById('shiftX');
    if (shiftX) {
      shiftX.value = this.state.shiftX;
      document.getElementById('shiftXVal').textContent = `${Math.round(this.state.shiftX)}px`;
    }

    const shiftY = document.getElementById('shiftY');
    if (shiftY) {
      shiftY.value = this.state.shiftY;
      document.getElementById('shiftYVal').textContent = `${Math.round(this.state.shiftY)}px`;
    }

    const shiftMain = document.getElementById('shiftAmountMain');
    if (shiftMain) {
      const approxPercent = Math.min(100, Math.max(0, Math.round((Math.abs(this.state.shiftX) / 16) * 100)));
      shiftMain.value = approxPercent;
      document.getElementById('shiftValMain').textContent = `${approxPercent}%`;
    }

    // Tone
    const contrast = document.getElementById('contrast');
    if (contrast) {
      contrast.value = Math.round(this.state.contrast * 100);
      document.getElementById('contrastVal').textContent = `${Math.round(this.state.contrast * 100)}%`;
    }

    const brightness = document.getElementById('brightness');
    if (brightness) {
      brightness.value = Math.round(this.state.brightness * 100);
      document.getElementById('brightnessVal').textContent = `${Math.round(this.state.brightness * 100)}%`;
    }

    // Blend mode
    const blend = document.getElementById('blendMode');
    if (blend) {
      const blendMapRev = ['multiply', 'subtractive', 'screen', 'overlay'];
      blend.value = blendMapRev[this.state.blendMode] || 'multiply';
    }

    // Toggles
    const threeToggle = document.getElementById('threeColorToggle');
    if (threeToggle) threeToggle.checked = this.state.useThreeColors;

    const sepToggle = document.getElementById('separationToggle');
    if (sepToggle) sepToggle.checked = this.state.separationMode === 1;

    const row3 = document.getElementById('inkRow3');
    if (row3) row3.style.display = this.state.useThreeColors ? 'flex' : 'none';
  }

  loadFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Deselect quick presets pills
        document.querySelectorAll('#quickDemos .preset-pill').forEach(p => p.classList.remove('active'));
        // Load clean image without text overlay
        this.setSourceImage(img);
        this.showToast('Ваше фото загружено! 📸');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // --------------------------------------------------------------------------
  // Web Camera Features
  // --------------------------------------------------------------------------
  async openCameraModal() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Веб-камера не поддерживается в этом браузере или доступ заблокирован.');
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.cameraFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.cameraVideo.srcObject = this.cameraStream;
      if (this.cameraVideo) {
        this.cameraVideo.classList.toggle('mirrored', this.isCameraMirrored);
      }
      await this.cameraVideo.play();
      this.cameraModal.classList.add('active');
    } catch (err) {
      console.error('Camera error:', err);
      alert('Не удалось получить доступ к камере: ' + (err.message || 'Разрешите доступ к камере в браузере.'));
    }
  }

  closeCameraModal() {
    if (this.cameraStream && !this.isLiveCamera) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    if (this.cameraVideo) {
      this.cameraVideo.srcObject = null;
    }
    if (this.cameraModal) {
      this.cameraModal.classList.remove('active');
    }
  }

  async switchCamera() {
    this.cameraFacingMode = (this.cameraFacingMode === 'user') ? 'environment' : 'user';
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
    }
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.cameraFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      this.cameraVideo.srcObject = this.cameraStream;
      if (this.cameraVideo) {
        this.cameraVideo.classList.toggle('mirrored', this.isCameraMirrored);
      }
      await this.cameraVideo.play();
    } catch (err) {
      console.warn('Switch camera error:', err);
    }
  }

  capturePhotoFromCamera() {
    if (!this.cameraVideo || this.cameraVideo.videoWidth === 0) return;

    const vw = this.cameraVideo.videoWidth;
    const vh = this.cameraVideo.videoHeight;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = vw;
    snapCanvas.height = vh;
    const ctx = snapCanvas.getContext('2d');

    // Зеркалирование только если пользователь явно включил режим зеркала
    if (this.isCameraMirrored) {
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.cameraVideo, 0, 0, vw, vh);

    this.closeCameraModal();
    document.querySelectorAll('#quickDemos .preset-pill').forEach(p => p.classList.remove('active'));
    this.setSourceImage(snapCanvas);
    this.showToast('Снимок с камеры загружен в Ризограф! 📸');
  }

  startLiveCamera() {
    if (!this.cameraStream) return;

    this.isLiveCamera = true;
    this.cameraModal.classList.remove('active');
    this.liveCameraPill.classList.add('active');

    const vw = this.cameraVideo.videoWidth || 1280;
    const vh = this.cameraVideo.videoHeight || 720;

    this.glCanvas.width = vw;
    this.glCanvas.height = vh;
    this.resetZoomAuto();

    const loop = () => {
      if (!this.isLiveCamera) return;

      if (this.cameraVideo.readyState >= this.cameraVideo.HAVE_CURRENT_DATA) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.cameraVideo);
        this.render();
      }

      this.liveAnimId = requestAnimationFrame(loop);
    };

    loop();
    this.showToast('🔴 Живой режим камеры активирован!');
  }

  stopLiveCamera() {
    this.isLiveCamera = false;
    if (this.liveAnimId) {
      cancelAnimationFrame(this.liveAnimId);
    }
    this.liveCameraPill.classList.remove('active');

    if (this.cameraVideo && this.cameraVideo.videoWidth > 0) {
      const vw = this.cameraVideo.videoWidth;
      const vh = this.cameraVideo.videoHeight;
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = vw;
      snapCanvas.height = vh;
      const ctx = snapCanvas.getContext('2d');
      ctx.drawImage(this.cameraVideo, 0, 0, vw, vh);

      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach(t => t.stop());
        this.cameraStream = null;
      }

      this.setSourceImage(snapCanvas);
      this.showToast('Кадр зафиксирован и сохранён! 📸');
    }
  }

  // --------------------------------------------------------------------------
  // Exporting
  // --------------------------------------------------------------------------
  exportImage(format = 'png') {
    const wasComparing = this.isComparing;
    if (wasComparing) {
      this.splitPosition = -1.0;
      this.render();
    }

    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const filename = `riso_art_${Date.now()}.${format === 'png' ? 'png' : 'jpg'}`;

    const exportTarget = (this.state.enableHanko || this.state.enableLimitedStamp || this.state.enableRegMarks || this.state.enableDensityScale)
      ? this.renderCompositeExportCanvas()
      : this.glCanvas;

    exportTarget.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast(`Сохранено: ${filename}`);

      if (wasComparing) {
        this.splitPosition = 0.5;
        this.render();
      }
    }, mime, 0.95);
  }

  copyToClipboard() {
    const exportTarget = (this.state.enableHanko || this.state.enableLimitedStamp || this.state.enableRegMarks || this.state.enableDensityScale)
      ? this.renderCompositeExportCanvas()
      : this.glCanvas;

    exportTarget.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        this.showToast('Скопировано в буфер обмена! 📋');
      } catch (err) {
        this.showToast('Не удалось скопировать (требуется разрешение)');
      }
    });
  }

  recordScannerVideo() {
    if (!window.MediaRecorder) {
      alert('MediaRecorder не поддерживается в этом браузере.');
      return;
    }

    const stream = this.glCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `riso_scan_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('Видео сканера сохранено! 🎬');
    };

    recorder.start();
    this.triggerScannerAnimation();

    const checkDone = setInterval(() => {
      if (!this.isScanning) {
        clearInterval(checkDone);
        recorder.stop();
      }
    }, 100);
  }

  showToast(msg) {
    this.toastMsg.textContent = msg;
    this.toastMsg.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastMsg.classList.remove('show');
    }, 2500);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new RisoApp();
});
