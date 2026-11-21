// ==========================================================================
// WebGL Shaders for Authentic Risograph, Halftone & Retro Print
// ==========================================================================

const RISO_SHADERS = {
  vertexShader: `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `,

  fragmentShader: `
    precision highp float;

    varying vec2 v_texCoord;

    // Uniforms
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform float u_time;

    // Effect mode:
    // 0 = Riso (Classic multi-drum overprint)
    // 1 = Newspaper (Vintage newsprint halftone)
    // 2 = Halftone Dots (Geometric sharp raster)
    // 3 = Engraving (Line screen / woodcut)
    // 4 = Dither (8-bit Bayer pixelator)
    // 5 = CMYK Screenprint (4-color rosettes)
    uniform int u_effectMode;

    // Color Drums
    uniform vec3 u_inkColor1;      // Drum 1 (Fluo Pink / Primary)
    uniform vec3 u_inkColor2;      // Drum 2 (Federal Blue / Shadow)
    uniform vec3 u_inkColor3;      // Drum 3 (Sunflower Yellow / Accent)
    uniform vec3 u_paperColor;     // Paper stock
    uniform bool u_useThreeColors;
    uniform float u_inkDensity;    // 0.3 - 1.0
    uniform int u_separationMode;  // 0 = Duotone (Luma split), 1 = CMYK Color Separation
    uniform int u_drumIsolation;   // 0 = All drums, 1 = Drum 1 only, 2 = Drum 2 only, 3 = Drum 3 only, 4 = B&W Stencil Film

    // Halftone Screening
    uniform float u_dotFrequency;  // Dot scale / LPI
    uniform float u_screenAngle;   // Base screen angle in radians
    uniform int u_dotShape;        // 0 = Round, 1 = Line, 2 = Diamond, 3 = Bayer Dither, 4 = Cross-hatch
    uniform float u_dotSoftness;   // Edge softness

    // Misregistration / Layer Shift
    uniform vec2 u_shiftLayer1;    // Layer 1 UV offset
    uniform vec2 u_shiftLayer2;    // Layer 2 UV offset
    uniform float u_shiftRotation;  // Layer 1 rotation jitter

    // Paper & Ink Texture
    uniform float u_paperGrain;
    uniform float u_inkBleed;
    uniform float u_vignette;

    // Tone & Adjustments
    uniform float u_contrast;      // -0.5 to 1.0
    uniform float u_brightness;    // -0.5 to 0.5
    uniform float u_threshold;     // 0.1 to 0.9
    uniform float u_gamma;         // 0.5 to 2.2
    uniform bool u_invert;

    // Extra Glitch & Effects
    uniform float u_glitchAmount;  // 0.0 - 1.0
    uniform float u_vhsScanlines;  // 0.0 - 1.0

    // Scanner & Comparison
    uniform float u_scanProgress;  // 0.0 - 1.0 (< 0 if disabled)
    uniform float u_splitPosition; // 0.0 - 1.0 (< 0 if disabled)
    uniform int u_blendMode;       // 0 = Multiply, 1 = Subtractive, 2 = Screen, 3 = Overlay

    // Pseudo-random noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // 2D Rotation
    vec2 rotate(vec2 p, float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    }

    // Bayer 8x8 Dithering Matrix
    float bayer8x8(vec2 uv) {
      int x = int(mod(uv.x, 8.0));
      int y = int(mod(uv.y, 8.0));
      
      int dither[64];
      dither[0] = 0;   dither[1] = 32;  dither[2] = 8;   dither[3] = 40;  dither[4] = 2;   dither[5] = 34;  dither[6] = 10;  dither[7] = 42;
      dither[8] = 48;  dither[9] = 16;  dither[10] = 56; dither[11] = 24; dither[12] = 50; dither[13] = 18; dither[14] = 58; dither[15] = 26;
      dither[16] = 12; dither[17] = 44; dither[18] = 4;  dither[19] = 36; dither[20] = 14; dither[21] = 46; dither[22] = 6;  dither[23] = 38;
      dither[24] = 60; dither[25] = 28; dither[26] = 52; dither[27] = 20; dither[28] = 62; dither[29] = 30; dither[30] = 54; dither[31] = 22;
      dither[32] = 3;  dither[33] = 35; dither[34] = 11; dither[35] = 43; dither[36] = 1;  dither[37] = 33; dither[38] = 9;  dither[39] = 41;
      dither[40] = 51; dither[41] = 19; dither[42] = 59; dither[43] = 27; dither[44] = 49; dither[45] = 17; dither[46] = 57; dither[47] = 25;
      dither[48] = 15; dither[49] = 47; dither[50] = 7;  dither[51] = 39; dither[52] = 13; dither[53] = 45; dither[54] = 5;  dither[55] = 37;
      dither[56] = 63; dither[57] = 31; dither[58] = 55; dither[59] = 23; dither[60] = 61; dither[61] = 29; dither[62] = 53; dither[63] = 21;

      int idx = y * 8 + x;
      for (int i = 0; i < 64; i++) {
        if (i == idx) return float(dither[i]) / 64.0;
      }
      return 0.5;
    }

    // Tone correction
    float adjustTone(float val) {
      if (val <= 0.01) return 0.0;
      if (u_invert) val = 1.0 - val;
      val = pow(clamp(val, 0.0, 1.0), u_gamma);
      val = (val - 0.5) * (1.0 + u_contrast) + 0.5 + u_brightness;
      return clamp(val, 0.0, 1.0);
    }

    // Halftone screen calculation
    float getScreenDot(vec2 coord, float angle, float freq, float density, int shape) {
      // Highlights cutoff (pure paper clean area)
      if (density <= 0.02) return 0.0;
      if (density >= 0.98) return 1.0;

      vec2 rotCoord = rotate(coord, angle);
      vec2 grid = rotCoord * freq;
      vec2 cell = fract(grid) - 0.5;

      float dist = 0.0;
      if (shape == 0) {
        // Round dot
        dist = length(cell);
      } else if (shape == 1) {
        // Line screen (Engraving lines)
        dist = abs(cell.y);
      } else if (shape == 2) {
        // Diamond
        dist = abs(cell.x) + abs(cell.y);
      } else if (shape == 3) {
        // Bayer Dither
        float threshold = bayer8x8(gl_FragCoord.xy);
        return density > threshold ? 1.0 : 0.0;
      } else {
        // Cross-hatch
        dist = min(abs(cell.x), abs(cell.y));
      }

      // Radius is proportional to ink coverage
      float radius = sqrt(density) * 0.7071;
      float softness = mix(0.02, 0.20, u_dotSoftness);

      // Micro ink bleed
      radius += (hash(floor(grid)) - 0.5) * u_inkBleed * 0.08;

      return 1.0 - smoothstep(radius - softness, radius + softness, dist);
    }

    void main() {
      vec2 uv = v_texCoord;

      // Optional Glitch / Tape distortion
      if (u_glitchAmount > 0.01) {
        float lineNoise = step(0.97, sin(uv.y * 120.0 + u_time * 15.0));
        uv.x += lineNoise * (hash(vec2(u_time, uv.y)) - 0.5) * 0.04 * u_glitchAmount;
      }

      // Split comparison mode (Left = Original, Right = Effect)
      if (u_splitPosition >= 0.0 && uv.x < u_splitPosition) {
        vec4 orig = texture2D(u_image, uv);
        if (abs(uv.x - u_splitPosition) < (2.0 / u_resolution.x)) {
          gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        } else {
          gl_FragColor = orig;
        }
        return;
      }

      // Scanner bar animation
      if (u_scanProgress >= 0.0) {
        float scanY = 1.0 - u_scanProgress;
        float diffY = uv.y - scanY;

        // Laser beam at scanner front
        if (abs(diffY) < 0.008) {
          float glow = 1.0 - abs(diffY) / 0.008;
          vec3 laser = mix(vec3(1.0, 0.16, 0.52), vec3(0.0, 0.82, 1.0), 0.5 + 0.5 * sin(uv.x * 30.0));
          gl_FragColor = vec4(laser * (1.2 + glow * 2.0), 1.0);
          return;
        }

        // Below scan line: unprinted paper or original
        if (uv.y > scanY) {
          vec4 pre = texture2D(u_image, uv);
          pre.rgb = mix(pre.rgb * 0.6, u_paperColor, 0.5);
          gl_FragColor = pre;
          return;
        }
      }

      // Misregistration Layer UVs
      vec2 uvShift1 = uv + u_shiftLayer1;
      vec2 uvShift2 = uv + u_shiftLayer2;
      vec2 uvShift3 = uv + rotate(u_shiftLayer1, 1.57) * 0.6;

      // Micro-rotation for Layer 1
      vec2 center = vec2(0.5, 0.5);
      uvShift1 = center + rotate(uvShift1 - center, u_shiftRotation);

      // Sample source textures
      vec4 col1 = texture2D(u_image, clamp(uvShift1, 0.0, 1.0));
      vec4 col2 = texture2D(u_image, clamp(uvShift2, 0.0, 1.0));
      vec4 col3 = texture2D(u_image, clamp(uvShift3, 0.0, 1.0));

      // Color plate separation
      float ink1Density = 0.0;
      float ink2Density = 0.0;
      float ink3Density = 0.0;

      if (u_separationMode == 1) {
        // True CMYK Color Decomposition
        float c = 1.0 - col2.r;
        float m = 1.0 - col1.g;
        float y = 1.0 - col3.b;
        float k = min(c, min(m, y));

        ink1Density = adjustTone(clamp(m, 0.0, 1.0));
        ink2Density = adjustTone(clamp(c + k * 0.5, 0.0, 1.0));
        ink3Density = adjustTone(clamp(y, 0.0, 1.0));
      } else {
        // Authentic Riso Duotone Separation
        float lum1 = dot(col1.rgb, vec3(0.299, 0.587, 0.114));
        float lum2 = dot(col2.rgb, vec3(0.299, 0.587, 0.114));
        float lum3 = dot(col3.rgb, vec3(0.299, 0.587, 0.114));

        float raw1 = 1.0 - lum1;
        float raw2 = 1.0 - lum2;
        float raw3 = 1.0 - lum3;

        // Ink 1 (Pink / Warm drum): midtones and warm details, clean highlights
        ink1Density = smoothstep(0.08, 0.65, raw1) * (1.0 - smoothstep(0.70, 0.98, raw1) * 0.4);
        ink1Density = adjustTone(ink1Density);

        // Ink 2 (Blue / Shadow drum): deep shadows and line work
        ink2Density = smoothstep(0.25, 0.95, raw2);
        ink2Density = adjustTone(pow(ink2Density, 1.15));

        // Ink 3 (Yellow / Accent): soft highlights
        ink3Density = smoothstep(0.05, 0.55, raw3);
        ink3Density = adjustTone(ink3Density);
      }

      // Screen angles for classic rosettes
      float angle1 = u_screenAngle;                 // Drum 1 angle (e.g. 15° or 45°)
      float angle2 = u_screenAngle + 1.0472;        // +60° (75°)
      float angle3 = u_screenAngle + 0.5236;        // +30° (45°)

      vec2 aspectCoord = uv * vec2(u_resolution.x / u_resolution.y, 1.0);

      // Render halftone dots for each drum
      float dot1 = getScreenDot(aspectCoord, angle1, u_dotFrequency, ink1Density, u_dotShape);
      float dot2 = getScreenDot(aspectCoord, angle2, u_dotFrequency * 1.03, ink2Density, u_dotShape);
      float dot3 = u_useThreeColors ? getScreenDot(aspectCoord, angle3, u_dotFrequency * 0.97, ink3Density, u_dotShape) : 0.0;

      // Base paper texture with organic grain & fibers
      vec3 paper = u_paperColor;
      if (u_paperGrain > 0.01) {
        float pNoise = (hash(gl_FragCoord.xy) - 0.5) * (u_paperGrain * 0.08);
        float pFiber = (sin(uv.x * 400.0 + hash(vec2(uv.y * 150.0, 2.0)) * 6.28) * 0.010) * u_paperGrain;
        paper = clamp(paper + pNoise + pFiber, 0.0, 1.0);
      }

      vec3 result = paper;

      // Ink Drum Layer Calculations
      float alpha1 = dot1 * u_inkDensity;
      float alpha2 = dot2 * u_inkDensity;
      float alpha3 = dot3 * u_inkDensity;

      if (u_drumIsolation == 1) {
        // Isolated Drum 1 Only
        if (u_blendMode == 0) {
          result = result * mix(vec3(1.0), u_inkColor1, alpha1);
        } else if (u_blendMode == 1) {
          result = max(vec3(0.0), result - (vec3(1.0) - u_inkColor1) * alpha1);
        } else if (u_blendMode == 2) {
          result = 1.0 - (1.0 - result) * (1.0 - u_inkColor1 * alpha1);
        } else {
          result = mix(result, u_inkColor1, alpha1 * 0.85);
        }
      } else if (u_drumIsolation == 2) {
        // Isolated Drum 2 Only
        if (u_blendMode == 0) {
          result = result * mix(vec3(1.0), u_inkColor2, alpha2);
        } else if (u_blendMode == 1) {
          result = max(vec3(0.0), result - (vec3(1.0) - u_inkColor2) * alpha2);
        } else if (u_blendMode == 2) {
          result = 1.0 - (1.0 - result) * (1.0 - u_inkColor2 * alpha2);
        } else {
          result = mix(result, u_inkColor2, alpha2 * 0.85);
        }
      } else if (u_drumIsolation == 3) {
        // Isolated Drum 3 Only
        if (u_blendMode == 0) {
          result = result * mix(vec3(1.0), u_inkColor3, alpha3);
        } else if (u_blendMode == 1) {
          result = max(vec3(0.0), result - (vec3(1.0) - u_inkColor3) * alpha3);
        } else {
          result = 1.0 - (1.0 - result) * (1.0 - u_inkColor3 * alpha3);
        }
      } else if (u_drumIsolation == 4) {
        // B&W Stencil Master Plate (Silk-screen burn & Risograph thermal stencil)
        float stencilInk = clamp(alpha1 + alpha2 + (u_useThreeColors ? alpha3 : 0.0), 0.0, 1.0);
        result = vec3(1.0 - stencilInk);
      } else {
        // Composite: All Drums (Normal Print)
        if (u_blendMode == 0) {
          result = result * mix(vec3(1.0), u_inkColor1, alpha1);
        } else if (u_blendMode == 1) {
          result = max(vec3(0.0), result - (vec3(1.0) - u_inkColor1) * alpha1);
        } else if (u_blendMode == 2) {
          result = 1.0 - (1.0 - result) * (1.0 - u_inkColor1 * alpha1);
        } else {
          result = mix(result, u_inkColor1, alpha1 * 0.85);
        }

        if (u_blendMode == 0) {
          result = result * mix(vec3(1.0), u_inkColor2, alpha2);
        } else if (u_blendMode == 1) {
          result = max(vec3(0.0), result - (vec3(1.0) - u_inkColor2) * alpha2);
        } else if (u_blendMode == 2) {
          result = 1.0 - (1.0 - result) * (1.0 - u_inkColor2 * alpha2);
        } else {
          result = mix(result, u_inkColor2, alpha2 * 0.85);
        }

        if (u_useThreeColors) {
          if (u_blendMode == 0) {
            result = result * mix(vec3(1.0), u_inkColor3, alpha3);
          } else if (u_blendMode == 1) {
            result = max(vec3(0.0), result - (vec3(1.0) - u_inkColor3) * alpha3);
          } else {
            result = 1.0 - (1.0 - result) * (1.0 - u_inkColor3 * alpha3);
          }
        }
      }

      // Micro ink grain on printed dots
      float inkStipple = (hash(gl_FragCoord.xy * 2.0 + 17.8) - 0.5) * 0.03 * (dot1 + dot2);
      result = clamp(result + inkStipple, 0.0, 1.0);

      // CRT Scanlines
      if (u_vhsScanlines > 0.01) {
        float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.5 + 0.5;
        result *= 1.0 - scanline * (u_vhsScanlines * 0.25);
      }

      // Vignette
      if (u_vignette > 0.01) {
        vec2 vigUV = uv - 0.5;
        float vig = 1.0 - dot(vigUV, vigUV) * (u_vignette * 1.5);
        result *= clamp(vig, 0.0, 1.0);
      }

      gl_FragColor = vec4(result, 1.0);
    }
  `
};
