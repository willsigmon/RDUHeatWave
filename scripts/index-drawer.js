(function() {
  var drawer = document.getElementById('info-drawer');
  var tab = document.getElementById('info-drawer-tab');
  var canvas = document.getElementById('thermo-canvas');
  var animId = null;

  if (drawer && tab) {
    tab.addEventListener('click', function() {
      var isOpen = drawer.classList.toggle('open');
      document.body.classList.toggle('drawer-open', isOpen);
      tab.setAttribute('aria-expanded', isOpen);
      if (isOpen) {
        startThermo();
        /* Steam blast + sound + haptics */
        if (typeof HeatFX !== 'undefined') {
          HeatFX.haptics.steamBlast();
          HeatFX.sounds.steamHiss();
        }
        fireSteamBlast();
      } else {
        stopThermo();
      }
    });
  }

  /* ── Steam blast animation ── */
  function fireSteamBlast() {
    var sc = document.getElementById('steam-blast-canvas');
    if (!sc) return;
    sc.style.display = 'block';
    var sctx = sc.getContext('2d');
    var sdpr = Math.min(window.devicePixelRatio || 1, 2);
    var sW = window.innerWidth, sH = window.innerHeight;
    sc.width = sW * sdpr; sc.height = sH * sdpr;
    sctx.scale(sdpr, sdpr);

    var particles = [];
    var lastSteamFrame = performance.now();
    var duration = 2200;
    var startTime = lastSteamFrame;

    /* Staggered spawn — not all at once for smoother burst */
    var spawnQueue = 100;
    var spawnRate = 8; /* per frame */

    function spawnParticle() {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      var speed = 2 + Math.random() * 6;
      var drift = (Math.random() - 0.5) * 2;
      particles.push({
        x: sW / 2 + (Math.random() - 0.5) * sW * 0.35,
        y: sH + 5 + Math.random() * 20,
        vx: Math.cos(angle) * speed + drift,
        vy: Math.sin(angle) * speed * 1.3 - 1,
        r: 6 + Math.random() * 30,
        life: 0.7 + Math.random() * 0.3,
        decay: 0.005 + Math.random() * 0.008,
        growth: 1.006 + Math.random() * 0.012,
        drag: 0.985 + Math.random() * 0.01,
        warmth: Math.random() /* 0=white, 1=orange tinted */
      });
    }

    function drawSteam(now) {
      var elapsed = now - startTime;
      var dt = Math.min((now - lastSteamFrame) / 16.667, 3);
      lastSteamFrame = now;

      if (elapsed > duration && particles.length === 0) {
        sc.style.display = 'none';
        return;
      }

      sctx.clearRect(0, 0, sW, sH);

      /* Staggered spawn */
      if (spawnQueue > 0 && elapsed < 600) {
        var count = Math.min(spawnQueue, Math.ceil(spawnRate * dt));
        for (var s = 0; s < count; s++) spawnParticle();
        spawnQueue -= count;
      }

      for (var pi = particles.length - 1; pi >= 0; pi--) {
        var p = particles[pi];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 0.04 * dt; /* gentle buoyancy */
        p.vx *= Math.pow(p.drag, dt);
        p.vy *= Math.pow(p.drag, dt);
        p.r *= Math.pow(p.growth, dt);
        p.life -= p.decay * dt;
        if (p.life <= 0) { particles.splice(pi, 1); continue; }

        /* Smooth opacity curve — ease out */
        var alpha = p.life * p.life * 0.14;
        var r = Math.round(255 - p.warmth * 30);
        var g = Math.round(255 - p.warmth * 60);
        var b = Math.round(255 - p.warmth * 80);

        /* Radial gradient for soft edges */
        var rg = sctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        rg.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 1.2) + ')');
        rg.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.7) + ')');
        rg.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');

        sctx.beginPath();
        sctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        sctx.fillStyle = rg;
        sctx.fill();
      }

      requestAnimationFrame(drawSteam);
    }
    requestAnimationFrame(drawSteam);
  }

  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  /* roundRect polyfill for older browsers */
  if (!ctx.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
      if (!Array.isArray(radii)) radii = [radii, radii, radii, radii];
      while (radii.length < 4) radii.push(radii[radii.length - 1] || 0);
      var tl = radii[0], tr = radii[1], br = radii[2], bl = radii[3];
      this.moveTo(x + tl, y);
      this.lineTo(x + w - tr, y); this.arcTo(x + w, y, x + w, y + tr, tr);
      this.lineTo(x + w, y + h - br); this.arcTo(x + w, y + h, x + w - br, y + h, br);
      this.lineTo(x + bl, y + h); this.arcTo(x, y + h, x, y + h - bl, bl);
      this.lineTo(x, y + tl); this.arcTo(x, y, x + tl, y, tl);
      this.closePath();
    };
  }

  /* ── Physics state ── */
  var fillLevel = 0;
  var bubbles = [];
  var steamParticles = [];
  var foamBubbles = [];
  var sparks = [];
  var pressureRings = [];
  var shockwaves = [];
  var heatBolts = [];
  var time = 0;
  var foamStarted = false;
  var boilFired = false;
  var foamHeight = 0;
  /* W=160, H=440 logical coords (CSS shows at 80x220) */

  function rng(a, b) { return a + Math.random() * (b - a); }

  /* Thermometer geometry — centered in 160px wide canvas */
  var tubeW = 36, tubeX = (W - tubeW) / 2;
  var tubeTop = 50, tubeBot = H - 80;
  var tubeH = tubeBot - tubeTop;
  var bulbCx = tubeX + tubeW / 2, bulbCy = tubeBot + 28, bulbR = 32;

  function spawnBubble() {
    var x = tubeX + 6 + Math.random() * (tubeW - 12);
    var r = rng(1.8, 5);
    var big = Math.random() < 0.15;
    if (big) r = rng(5, 8);
    bubbles.push({
      x: x, y: tubeBot - 4,
      r: r, origR: r,
      vx: rng(-0.5, 0.5),
      vy: -rng(0.8, 2.2) * (big ? 1.4 : 1),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: rng(0.4, 1.2),
      life: 1, decay: rng(0.004, 0.012),
      big: big
    });
  }

  function spawnSteam() {
    var surfaceY = tubeTop + tubeH * (1 - Math.min(1, fillLevel));
    steamParticles.push({
      x: tubeX + rng(6, tubeW - 6),
      y: surfaceY - foamHeight - 4,
      vx: rng(-0.75, 0.75),
      vy: -rng(0.7, 1.5),
      r: rng(5, 12),
      life: 1, decay: rng(0.008, 0.018),
      drift: rng(-0.15, 0.15),
      curl: rng(0.8, 2.4),
      warmth: rng(0, 1)
    });
  }

  function spawnSpark(originX, originY, pressure) {
    sparks.push({
      x: originX,
      y: originY,
      vx: rng(-0.8, 0.8) + (Math.random() < 0.5 ? -1 : 1) * pressure * 0.35,
      vy: -rng(1.2, 2.8) - pressure * 0.6,
      len: rng(6, 16),
      life: 1,
      decay: rng(0.028, 0.055),
      warmth: rng(0.4, 1)
    });
  }

  function spawnPressureRing(surfaceY, pressure) {
    pressureRings.push({
      x: bulbCx,
      y: surfaceY + rng(-6, 10),
      r: rng(12, 24),
      life: 1,
      decay: rng(0.03, 0.06),
      growth: 1.08 + pressure * 0.05
    });
  }

  function spawnShockwave(originY, pressure) {
    shockwaves.push({
      x: bulbCx,
      y: originY,
      rx: rng(18, 34) + pressure * 14,
      ry: rng(5, 10) + pressure * 4,
      growth: 1.075 + pressure * 0.04,
      life: 1,
      decay: rng(0.026, 0.045),
      warmth: rng(0.55, 1)
    });
  }

  function spawnHeatBolt(originX, originY, pressure) {
    heatBolts.push({
      x: originX,
      y: originY,
      len: rng(22, 46) + pressure * 14,
      angle: -Math.PI / 2 + rng(-0.95, 0.95),
      life: 1,
      decay: rng(0.045, 0.08),
      kink: rng(-12, 12),
      warmth: rng(0.55, 1)
    });
  }

  function spawnFoamBubble(baseY) {
    var cx = tubeX + tubeW / 2;
    /* Bubbles start right at the liquid surface, clustered near tube center */
    var xOff = rng(-tubeW * 0.6, tubeW * 0.6);
    var r = rng(2, 6);
    foamBubbles.push({
      x: cx + xOff,
      y: baseY,
      vy: -rng(0.08, 0.35), /* slow upward drift */
      vx: rng(-0.1, 0.1),
      r: r,
      opacity: 0,        /* starts invisible, fades in */
      fadeIn: rng(0.01, 0.03), /* gradual fade-in rate */
      maxOpacity: rng(0.5, 0.9),
      life: 1, decay: rng(0.0008, 0.002),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: rng(0.2, 0.6)
    });
  }

  function drawThermo() {
    ctx.clearRect(0, 0, W, H);
    time += 0.016;

    /* Fill rises — slow down near top for tension buildup */
    var overflowing = fillLevel >= 1.0;
    if (fillLevel < 1.3) {
      var rate = fillLevel < 0.85 ? 0.008 : (fillLevel < 0.95 ? 0.004 : 0.0015);
      fillLevel = Math.min(1.3, fillLevel + rate);
    }
    var clampedFill = Math.min(1, fillLevel);
    var surfaceY = tubeTop + tubeH * (1 - clampedFill);
    var pressure = Math.min(1.6, Math.max(0, (fillLevel - 0.85) / 0.15));

    /* ── Stage glow / heat shimmer backdrop ── */
    ctx.save();
    var stageGrad = ctx.createLinearGradient(0, 0, 0, H);
    stageGrad.addColorStop(0, 'rgba(255, 110, 40, 0.045)');
    stageGrad.addColorStop(0.45, 'rgba(232, 88, 12, 0.02)');
    stageGrad.addColorStop(1, 'rgba(10, 8, 7, 0)');
    ctx.fillStyle = stageGrad;
    ctx.fillRect(0, 0, W, H);

    var bulbHalo = ctx.createRadialGradient(bulbCx, bulbCy, 0, bulbCx, bulbCy, 108);
    bulbHalo.addColorStop(0, 'rgba(255, 150, 60, 0.22)');
    bulbHalo.addColorStop(0.32, 'rgba(232, 88, 12, 0.14)');
    bulbHalo.addColorStop(1, 'rgba(232, 88, 12, 0)');
    ctx.fillStyle = bulbHalo;
    ctx.fillRect(0, 0, W, H);

    for (var band = 0; band < 3; band++) {
      var bandY = 60 + band * 80 + Math.sin(time * (1.3 + band * 0.25) + band) * 8;
      var bandGrad = ctx.createLinearGradient(0, bandY, W, bandY + 30);
      bandGrad.addColorStop(0, 'rgba(255,255,255,0)');
      bandGrad.addColorStop(0.5, 'rgba(255,205,155,' + (0.035 + band * 0.01) + ')');
      bandGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, bandY, W, 24);
    }

    /* Reactor-style scale: the extra degree gets a real visual target. */
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (var mark = 0; mark <= 12; mark++) {
      var markY = tubeBot - (tubeH * mark / 12);
      var major = mark % 3 === 0;
      var hotBand = mark >= 9;
      ctx.beginPath();
      ctx.moveTo(tubeX + tubeW + 8, markY);
      ctx.lineTo(tubeX + tubeW + (major ? 24 : 16), markY);
      ctx.strokeStyle = hotBand
        ? 'rgba(255, 165, 82, ' + (0.2 + pressure * 0.25) + ')'
        : 'rgba(255, 238, 214, 0.13)';
      ctx.lineWidth = major ? 1.6 : 1;
      ctx.stroke();
    }
    var thresholdY = tubeTop + tubeH * 0.055;
    ctx.beginPath();
    ctx.moveTo(tubeX - 34, thresholdY);
    ctx.lineTo(tubeX + tubeW + 34, thresholdY);
    ctx.strokeStyle = 'rgba(255, 106, 30, ' + (0.24 + pressure * 0.28 + Math.sin(time * 7) * 0.04) + ')';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.font = '18px Bebas Neue, Impact, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillStyle = 'rgba(255, 232, 204, ' + (0.28 + pressure * 0.32) + ')';
    ctx.fillText('212°', tubeX - 33, thresholdY - 6);
    ctx.font = '12px Bebas Neue, Impact, sans-serif';
    ctx.fillStyle = 'rgba(255, 185, 120, 0.24)';
    ctx.fillText('BOILING POINT', tubeX + tubeW + 13, thresholdY - 6);
    ctx.restore();
    ctx.restore();

    /* Gentle pressure wobble when near full (no violent shake) */
    if (pressure > 0 && !overflowing) {
      var wobbleAmt = pressure * 1.5;
      ctx.save();
      ctx.translate(
        Math.sin(time * 12) * wobbleAmt * 0.4,
        Math.cos(time * 10) * wobbleAmt * 0.2
      );
    }

    /* ── FOAM OVERFLOW STATE ── */
    if (fillLevel >= 0.98 && !foamStarted) {
      foamStarted = true;
      if (typeof HeatFX !== 'undefined') {
        HeatFX.haptics.steamBlast();
        HeatFX.sounds.steamHiss();
      }
    }

    if (fillLevel >= 1 && !boilFired) {
      boilFired = true;
      for (var boom = 0; boom < 8; boom++) {
        spawnShockwave(surfaceY + boom * 4, 1 + boom * 0.08);
      }
      for (var bolt = 0; bolt < 14; bolt++) {
        spawnHeatBolt(bulbCx + rng(-18, 18), surfaceY + rng(-8, 18), 1.2);
      }
    }

    /* Gradually build foam — spawn bubbles one by one */
    if (foamStarted) {
      var foamAge = fillLevel - 0.98;
      foamHeight = Math.min(116, foamHeight + 0.42 + foamAge * 1.9);
      /* Start slow, ramp up: 1 bubble/few frames → many bubbles/frame */
      var spawnChance = Math.min(0.8, foamAge * 2);
      if (Math.random() < spawnChance) {
        spawnFoamBubble(surfaceY);
      }
      /* Occasional second bubble once foam is established */
      if (foamAge > 0.08 && Math.random() < spawnChance * 0.5) {
        spawnFoamBubble(surfaceY);
      }
      /* Gentle steam wisps */
      if (foamAge > 0.05 && Math.random() < 0.08 + foamAge * 0.3) {
        spawnSteam();
      }
    }

    if (pressure > 0.16 && Math.random() < pressure * 0.12) {
      spawnPressureRing(surfaceY, pressure);
    }
    if (pressure > 0.2 && Math.random() < pressure * 0.18) {
      spawnSpark(bulbCx + rng(-10, 10), bulbCy - rng(6, 18), pressure);
    }
    if (foamStarted && Math.random() < 0.18) {
      spawnSpark(tubeX + tubeW / 2 + rng(-8, 8), surfaceY - rng(4, 14), 0.6);
    }

    /* ── Glass tube outline ── */
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tubeX, tubeTop, tubeW, tubeH, 22);
    ctx.strokeStyle = 'rgba(232, 88, 12, 0.3)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    /* ── Glass tube background ── */
    ctx.beginPath();
    ctx.roundRect(tubeX + 2, tubeTop + 2, tubeW - 4, tubeH - 4, 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(tubeX - 4, tubeTop - 10, tubeW + 8, tubeH + 50, 26);
    ctx.strokeStyle = 'rgba(255, 175, 90, ' + (0.04 + pressure * 0.12) + ')';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* ── Liquid fill ── */
    ctx.beginPath();
    ctx.roundRect(tubeX + 3, surfaceY, tubeW - 6, tubeBot - surfaceY, [0, 0, 18, 18]);
    var grad = ctx.createLinearGradient(0, surfaceY, 0, tubeBot);
    grad.addColorStop(0, '#FF6A1E');
    grad.addColorStop(0.5, '#E8580C');
    grad.addColorStop(1, '#C44A0A');
    ctx.fillStyle = grad;
    ctx.fill();

    /* ── Liquid glow ── */
    var glowIntensity = 0.12 + 0.06 * Math.sin(time * 1.5);
    ctx.shadowColor = '#E8580C';
    ctx.shadowBlur = 16 * glowIntensity * 3;
    ctx.fill();
    ctx.shadowBlur = 0;

    /* Animated molten core: makes the rise feel like pressure, not a flat bar. */
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tubeX + 4, surfaceY + 1, tubeW - 8, tubeBot - surfaceY, [0, 0, 16, 16]);
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    for (var core = 0; core < 4; core++) {
      var coreX = tubeX + 8 + core * 7 + Math.sin(time * (1.4 + core * 0.28) + core) * 2.5;
      var coreGrad = ctx.createLinearGradient(coreX, surfaceY, coreX + 5, tubeBot);
      coreGrad.addColorStop(0, 'rgba(255, 245, 185, ' + (0.16 + pressure * 0.07) + ')');
      coreGrad.addColorStop(0.5, 'rgba(255, 155, 48, ' + (0.09 + pressure * 0.05) + ')');
      coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = coreGrad;
      ctx.fillRect(coreX, surfaceY - 12, 5, tubeBot - surfaceY + 24);
    }
    for (var coil = 0; coil < 5; coil++) {
      var coilY = tubeBot - ((time * (18 + coil * 5) + coil * 44) % Math.max(20, tubeBot - surfaceY + 36));
      ctx.beginPath();
      ctx.ellipse(bulbCx, coilY, tubeW * 0.36, 3.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 238, 178, ' + (0.12 + pressure * 0.08) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    /* ── Bulb at bottom ── */
    ctx.beginPath();
    ctx.arc(bulbCx, bulbCy, bulbR, 0, Math.PI * 2);
    var bulbGrad = ctx.createRadialGradient(bulbCx - 4, bulbCy - 4, 0, bulbCx, bulbCy, bulbR);
    bulbGrad.addColorStop(0, '#FF8833');
    bulbGrad.addColorStop(0.6, '#E8580C');
    bulbGrad.addColorStop(1, '#A03808');
    ctx.fillStyle = bulbGrad;
    ctx.shadowColor = '#E8580C';
    ctx.shadowBlur = 24 + 8 * Math.sin(time * 2) + pressure * 40;
    ctx.fill();
    ctx.shadowBlur = 0;

    /* Bulb glass highlight */
    ctx.beginPath();
    ctx.arc(bulbCx - 5, bulbCy - 5, bulbR * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fill();

    /* ── Surface turbulence ── */
    if (fillLevel > 0.3) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(tubeX + 3, surfaceY - 5, tubeW - 6, 10);
      ctx.clip();
      for (var w = 0; w < 3; w++) {
        ctx.beginPath();
        var waveY = surfaceY;
        ctx.moveTo(tubeX + 3, waveY);
        for (var px = tubeX + 3; px <= tubeX + tubeW - 3; px++) {
          var offset = Math.sin((px * 0.2) + time * (3 + w) + w * 2) * (1.8 + fillLevel * 2);
          ctx.lineTo(px, waveY + offset);
        }
        ctx.lineTo(tubeX + tubeW - 3, waveY + 10);
        ctx.lineTo(tubeX + 3, waveY + 10);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 200, 150, ' + (0.18 - w * 0.05) + ')';
        ctx.fill();
      }
      ctx.restore();
    }

    /* ── Bubbles ── */
    if (fillLevel > 0.4 && Math.random() < 0.3 + fillLevel * 0.5) spawnBubble();

    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i];
      b.wobblePhase += 0.08;
      b.x += b.vx + Math.sin(b.wobblePhase) * b.wobbleAmp * 0.3;
      b.y += b.vy;
      b.life -= b.decay;
      b.r = b.origR * (0.5 + b.life * 0.5);

      /* Clip to liquid region */
      if (b.y < surfaceY + 4 || b.life <= 0) {
        /* Pop effect for big bubbles */
        if (b.big && b.y < surfaceY + 10) {
          for (var s = 0; s < 3; s++) spawnSteam();
        }
        bubbles.splice(i, 1);
        continue;
      }

      /* Clamp x inside tube */
      if (b.x < tubeX + 6) b.x = tubeX + 6;
      if (b.x > tubeX + tubeW - 6) b.x = tubeX + tubeW - 6;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      var bGrad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 0, b.x, b.y, b.r);
      bGrad.addColorStop(0, 'rgba(255, 255, 255, ' + (b.life * 0.85) + ')');
      bGrad.addColorStop(0.5, 'rgba(255, 220, 180, ' + (b.life * 0.4) + ')');
      bGrad.addColorStop(1, 'rgba(255, 160, 100, ' + (b.life * 0.1) + ')');
      ctx.fillStyle = bGrad;
      ctx.fill();
    }

    /* ── Steam particles ── */
    if (fillLevel > 0.7 && Math.random() < 0.15 + (fillLevel - 0.7) * 1.5) spawnSteam();

    for (var j = steamParticles.length - 1; j >= 0; j--) {
      var sp = steamParticles[j];
      sp.x += sp.vx + sp.drift * Math.sin(time * sp.curl + j);
      sp.y += sp.vy;
      sp.r *= 1.008;
      sp.life -= sp.decay;

      if (sp.life <= 0) { steamParticles.splice(j, 1); continue; }

      var steamR = sp.r * (0.82 + (1 - sp.life) * 0.5);
      var steamGrad = ctx.createRadialGradient(sp.x - steamR * 0.2, sp.y - steamR * 0.2, 0, sp.x, sp.y, steamR);
      steamGrad.addColorStop(0, 'rgba(255, 255, 255, ' + (sp.life * 0.18) + ')');
      steamGrad.addColorStop(0.5, 'rgba(255, 220, 180, ' + (sp.life * (0.07 + sp.warmth * 0.04)) + ')');
      steamGrad.addColorStop(1, 'rgba(255, 220, 180, 0)');
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, steamR, 0, Math.PI * 2);
      ctx.fillStyle = steamGrad;
      ctx.shadowColor = 'rgba(255, 255, 255, ' + (sp.life * 0.1) + ')';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    /* ── Pressure rings ── */
    for (var ri = pressureRings.length - 1; ri >= 0; ri--) {
      var ring = pressureRings[ri];
      ring.r *= ring.growth;
      ring.life -= ring.decay;
      if (ring.life <= 0) { pressureRings.splice(ri, 1); continue; }
      ctx.beginPath();
      ctx.ellipse(ring.x, ring.y, ring.r, ring.r * 0.22, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 202, 140, ' + (ring.life * 0.18) + ')';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    /* ── 212° shockwaves ── */
    for (var wi = shockwaves.length - 1; wi >= 0; wi--) {
      var wave = shockwaves[wi];
      wave.rx *= wave.growth;
      wave.ry *= wave.growth;
      wave.life -= wave.decay;
      if (wave.life <= 0) { shockwaves.splice(wi, 1); continue; }
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.beginPath();
      ctx.ellipse(wave.x, wave.y, wave.rx, wave.ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, ' + Math.round(160 + wave.warmth * 62) + ', 78, ' + (wave.life * 0.34) + ')';
      ctx.lineWidth = 1.3 + wave.life * 2.2;
      ctx.stroke();
      ctx.restore();
    }

    /* ── Heat bolts at the extra degree ── */
    for (var hi = heatBolts.length - 1; hi >= 0; hi--) {
      var bolt = heatBolts[hi];
      bolt.life -= bolt.decay;
      if (bolt.life <= 0) { heatBolts.splice(hi, 1); continue; }
      var bx2 = bolt.x + Math.cos(bolt.angle) * bolt.len;
      var by2 = bolt.y + Math.sin(bolt.angle) * bolt.len;
      var midX = (bolt.x + bx2) / 2 + bolt.kink * bolt.life;
      var midY = (bolt.y + by2) / 2 - Math.abs(bolt.kink) * 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.beginPath();
      ctx.moveTo(bolt.x, bolt.y);
      ctx.lineTo(midX, midY);
      ctx.lineTo(bx2, by2);
      ctx.strokeStyle = 'rgba(255, ' + Math.round(185 + bolt.warmth * 50) + ', 88, ' + (bolt.life * 0.7) + ')';
      ctx.lineWidth = 1.2 + bolt.life * 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    /* ── Sparks / boiling embers ── */
    for (var si = sparks.length - 1; si >= 0; si--) {
      var spark = sparks[si];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.vy += 0.025;
      spark.life -= spark.decay;
      if (spark.life <= 0) { sparks.splice(si, 1); continue; }

      var sx2 = spark.x - spark.vx * spark.len * 0.25;
      var sy2 = spark.y - spark.vy * spark.len * 0.25;
      ctx.beginPath();
      ctx.moveTo(spark.x, spark.y);
      ctx.lineTo(sx2, sy2);
      ctx.strokeStyle = 'rgba(255, ' + Math.round(170 + spark.warmth * 50) + ', ' + Math.round(70 + spark.warmth * 40) + ', ' + (spark.life * 0.7) + ')';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    /* ── Foam bubbles — individual packed bubbles, no blob ── */
    for (var fi = foamBubbles.length - 1; fi >= 0; fi--) {
      var fb = foamBubbles[fi];
      /* Gradual fade-in — each bubble appears smoothly */
      fb.opacity = Math.min(fb.maxOpacity, fb.opacity + fb.fadeIn);
      /* Slow upward drift with gentle wobble */
      fb.wobblePhase += 0.04;
      fb.x += fb.vx + Math.sin(fb.wobblePhase) * fb.wobbleAmp * 0.15;
      fb.y += fb.vy;
      fb.life -= fb.decay;

      /* Fade out as life drains */
      if (fb.life < 0.3) fb.opacity *= 0.97;
      if (fb.life <= 0) { foamBubbles.splice(fi, 1); continue; }

      var alpha = fb.opacity * fb.life;
      if (alpha < 0.02) continue;

      /* Each bubble: soft circle with highlight */
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, fb.r, 0, Math.PI * 2);
      var fbg = ctx.createRadialGradient(
        fb.x - fb.r * 0.25, fb.y - fb.r * 0.25, 0,
        fb.x, fb.y, fb.r
      );
      fbg.addColorStop(0, 'rgba(255, 248, 235, ' + alpha + ')');
      fbg.addColorStop(0.6, 'rgba(255, 225, 190, ' + (alpha * 0.6) + ')');
      fbg.addColorStop(1, 'rgba(255, 190, 140, ' + (alpha * 0.15) + ')');
      ctx.fillStyle = fbg;
      ctx.fill();

      /* Tiny specular highlight */
      if (fb.r > 2.5 && alpha > 0.2) {
        ctx.beginPath();
        ctx.arc(fb.x - fb.r * 0.3, fb.y - fb.r * 0.3, fb.r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (alpha * 0.4) + ')';
        ctx.fill();
      }
    }

    /* ── Glass highlight (specular) ── */
    ctx.beginPath();
    ctx.roundRect(tubeX + 6, tubeTop + 8, 8, tubeH * 0.55, 4);
    var specGrad = ctx.createLinearGradient(tubeX + 6, tubeTop, tubeX + 14, tubeTop);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specGrad;
    ctx.fill();

    /* ── Tick marks ── */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (var t = 0; t <= 4; t++) {
      var ty = tubeTop + (tubeH * t / 4);
      ctx.fillRect(tubeX + tubeW + 4, ty, 8, 1.5);
    }

    /* ── Subtle warmth glow near full ── */
    if (pressure > 0.5) {
      var warnAlpha = (pressure - 0.5) * 0.15 * (0.5 + 0.5 * Math.sin(time * 3));
      ctx.fillStyle = 'rgba(255, 120, 40, ' + warnAlpha + ')';
      ctx.fillRect(0, 0, W, H);
    }

    /* Close pressure wobble transform */
    if (pressure > 0 && !overflowing) ctx.restore();

    ctx.restore();
    animId = requestAnimationFrame(drawThermo);
  }

  function startThermo() {
    fillLevel = 0;
    bubbles = [];
    steamParticles = [];
    foamBubbles = [];
    sparks = [];
    pressureRings = [];
    shockwaves = [];
    heatBolts = [];
    foamStarted = false;
    boilFired = false;
    foamHeight = 0;
    time = 0;
    if (animId) cancelAnimationFrame(animId);
    drawThermo();
  }

  function stopThermo() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }
})();
