(function() {
  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var MEETING_CONFIG = SITE_CONFIG.meeting || {};

  // ===== BEER MENU DATA =====
  var BEER_MENU = {
    lastChecked: '2026-04-30',
    featured: [
      { name: 'Tailwind - Margarita', style: '7mg Delta 9 THC Seltzer', abv: 'N/A'  },
      { name: 'Mean Girl',            style: 'Kettle Sour',               abv: '5.5%' },
      { name: 'Wolkenbrau',           style: 'Hybrid German-American Lager', abv: '4.5%' }
    ],
    categories: [
      {
        name: 'Current Draft List',
        beers: [
          { name: 'Hop Jam IPA',         style: 'American IPA',             abv: '6.3%'  },
          { name: 'Blood Orange Hop Jam', style: 'Blood Orange Infused IPA', abv: '6.3%'  },
          { name: 'Hazy Hop Jam',        style: 'Hazy IPA',                abv: '6.3%'  },
          { name: 'Double hop jam',      style: 'Imperial IPA',            abv: '10.3%' },
          { name: 'Clouds 9',            style: 'Belgian Golden Strong',    abv: '9%'    },
          { name: 'Wolkenbrau',         style: 'Hybrid German-American Lager', abv: '4.5%' },
          { name: 'Precipitation',      style: 'German Style Pilsner',    abv: '5.2%'  },
          { name: 'Mean Girl',        style: 'Kettle Sour',               abv: '5.5%'  },
          { name: 'Crimea River',     style: 'Baltic Porter',             abv: '8%'    },
          { name: 'El Hefe',                style: 'Bavarian Wheat',            abv: '4.9%'  },
          { name: 'Accumulation',       style: 'Amber Lager',               abv: '5.8%'  },
          { name: 'Bock to the Future', style: 'Maibock',                   abv: '7.2%'  },
          { name: 'Midnight Delight',   style: 'Dark Chocolate Milk Stout',  abv: '6.8%'  },
          { name: 'Root Beer',          style: 'NON ALCOHOLIC',             abv: 'N/A'   }
        ]
      }
    ]
  };

  function getBeerMenuNote() {
    var fallback = 'Tap list rotates fast — the board at Clouds is the final word for same-day pours.';
    if (!BEER_MENU.lastChecked) return fallback;

    var checkedDate = new Date(BEER_MENU.lastChecked + 'T00:00:00');
    if (isNaN(checkedDate.getTime())) return fallback;

    var ageDays = Math.floor((Date.now() - checkedDate.getTime()) / (24 * 60 * 60 * 1000));
    if (ageDays > 10) return fallback;

    return 'Menu snapshot checked ' + checkedDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }) + '.';
  }

  // Creates a DOM element with an optional CSS class.
  function makeEl(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  // Clears all children from a node.
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function renderBeerMenu() {
    var heroCopy    = document.getElementById('clouds-hero-copy');
    var pourRow     = document.getElementById('clouds-pour-row');
    var beerColumns = document.getElementById('beer-columns');
    var cloudsNote  = document.getElementById('clouds-note');

    if (!heroCopy || !pourRow || !beerColumns || !cloudsNote) return;

    // Featured hero copy
    var names = BEER_MENU.featured.map(function(f) { return f.name; });
    var last  = names.pop();
    heroCopy.textContent = names.join(', ') + ', and ' + last + ' are currently featured on the live menu.';

    // Featured pour chips
    clearNode(pourRow);
    BEER_MENU.featured.forEach(function(f) {
      var chip  = makeEl('div',  'clouds-pour-chip');
      var pname = makeEl('span', 'clouds-pour-name');
      var pmeta = makeEl('span', 'clouds-pour-meta');
      pname.textContent = f.name;
      pmeta.textContent = f.style + ' \u2022 ' + f.abv;
      chip.appendChild(pname);
      chip.appendChild(pmeta);
      pourRow.appendChild(chip);
    });

    // Beer columns: first half of categories left, second half right
    var cats   = BEER_MENU.categories;
    var mid    = Math.ceil(cats.length / 2);
    var halves = [cats.slice(0, mid), cats.slice(mid)];

    clearNode(beerColumns);
    halves.forEach(function(group) {
      var col = makeEl('div', 'beer-column');
      group.forEach(function(cat) {
        var title = makeEl('div', 'beer-section-title');
        title.textContent = cat.name;
        col.appendChild(title);

        var ul = makeEl('ul', 'beer-list');
        cat.beers.forEach(function(beer) {
          var li      = makeEl('li',   'beer-item');
          var wrapper = makeEl('span');
          var bname   = makeEl('span', 'beer-name');
          var bstyle  = makeEl('span', 'beer-style');
          var babv    = makeEl('span', 'beer-abv');
          bname.textContent  = beer.name;
          bstyle.textContent = beer.style;
          babv.textContent   = beer.abv;
          wrapper.appendChild(bname);
          wrapper.appendChild(document.createTextNode(' '));
          wrapper.appendChild(bstyle);
          li.appendChild(wrapper);
          li.appendChild(document.createTextNode(' '));
          li.appendChild(babv);
          ul.appendChild(li);
        });
        col.appendChild(ul);
      });
      beerColumns.appendChild(col);
    });

    cloudsNote.textContent = getBeerMenuNote();
  }

  renderBeerMenu();
  // ===== FULL-PANEL BEER POUR (gyro + haptics + sound) =====
  var pourEngine = (function() {
    var c = document.getElementById('beer-pour-canvas');
    if (!c) return { start: function(){}, stop: function(){} };
    var ctx = c.getContext('2d');
    var animId = null, running = false;
    var W, H, dpr;
    var beerLevel = 0, time = 0, pourActive = true;
    var drops = [], carbonation = [], glints = [], condensation = [], foamPuffs = [], shockRings = [], mist = [];
    var pourHapticTimer = null;
    var lastFrame = 0;
    var smoothTilt = 0;
    var celebrationFlash = 0;
    var completionHold = 0;

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

    function resize() {
      var rect = c.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      c.width = W * dpr; c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function rng(a, b) { return a + Math.random() * (b - a); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function makeGlass() {
      var top = H * 0.16;
      var bottom = H * 0.92;
      var halfTop = Math.min(W * 0.16, 112);
      /*
        Keep the hero pour visible. The menu card sits centered above this canvas,
        so the pint lives off the right shoulder on desktop and tucks closer in on phones.
      */
      var targetX = W < 740 ? W * 0.68 : W * 0.82;
      var midX = clamp(targetX, halfTop + 18, W - halfTop - 18);
      return {
        midX: midX,
        top: top,
        bottom: bottom,
        halfTop: halfTop,
        halfBottom: halfTop * 0.68,
        lipH: 12
      };
    }

    function glassHalfAtY(g, y) {
      var t = clamp((y - g.top) / Math.max(1, g.bottom - g.top), 0, 1);
      return lerp(g.halfTop, g.halfBottom, t);
    }

    function glassRandomX(g, y, pad) {
      var half = Math.max(10, glassHalfAtY(g, y) - (pad || 0));
      return g.midX + rng(-half, half);
    }

    function beginGlassPath(g) {
      ctx.beginPath();
      ctx.moveTo(g.midX - g.halfTop, g.top);
      ctx.lineTo(g.midX + g.halfTop, g.top);
      ctx.lineTo(g.midX + g.halfBottom, g.bottom);
      ctx.quadraticCurveTo(g.midX + g.halfBottom * 0.56, g.bottom + 20, g.midX, g.bottom + 24);
      ctx.quadraticCurveTo(g.midX - g.halfBottom * 0.56, g.bottom + 20, g.midX - g.halfBottom, g.bottom);
      ctx.closePath();
    }

    function spawnGlint(x, y, size, warmth) {
      glints.push({
        x: x,
        y: y,
        size: size || rng(8, 16),
        life: 1,
        decay: rng(0.022, 0.055),
        warmth: typeof warmth === 'number' ? warmth : Math.random(),
        spin: rng(-0.035, 0.035)
      });
      if (glints.length > 70) glints.shift();
    }

    function spawnDrop(x, y, power, tilt) {
      drops.push({
        x: x + rng(-15, 15),
        y: y + rng(-3, 3),
        vx: rng(-1.8, 1.8) + (tilt || 0) * 1.6,
        vy: -rng(1.2, 4.5) * power,
        r: rng(1.2, 4.8) * power,
        life: 1,
        decay: rng(0.014, 0.032),
        foam: Math.random() < 0.42
      });
      if (drops.length > 90) drops.shift();
    }

    function spawnFoamPuff(x, y, power) {
      foamPuffs.push({
        x: x + rng(-18, 18),
        y: y + rng(-8, 6),
        vx: rng(-0.22, 0.22),
        vy: -rng(0.08, 0.42) * power,
        r: rng(5, 17) * power,
        life: 1,
        decay: rng(0.006, 0.014),
        wobble: rng(0.5, 1.8),
        phase: rng(0, Math.PI * 2)
      });
      if (foamPuffs.length > 85) foamPuffs.shift();
    }

    function spawnMist(x, y, power) {
      mist.push({
        x: x + rng(-24, 24),
        y: y + rng(-22, 4),
        vx: rng(-0.18, 0.18),
        vy: -rng(0.22, 0.75) * power,
        r: rng(10, 34) * power,
        life: 1,
        decay: rng(0.006, 0.014),
        warmth: rng(0, 1)
      });
      if (mist.length > 45) mist.shift();
    }

    function spawnShockRing(x, y, power) {
      shockRings.push({
        x: x,
        y: y,
        rx: rng(18, 36) * power,
        ry: rng(6, 12) * power,
        grow: rng(1.045, 1.075) + power * 0.01,
        life: 1,
        decay: rng(0.018, 0.032),
        warmth: rng(0.45, 1)
      });
      if (shockRings.length > 24) shockRings.shift();
    }

    function spawnCondensation(g) {
      var side = Math.random() < 0.5 ? -1 : 1;
      var y = rng(g.top + 22, g.bottom - 22);
      var half = glassHalfAtY(g, y);
      condensation.push({
        x: g.midX + side * (half - rng(8, 18)) + rng(-2, 2),
        y: y,
        vy: rng(0.18, 0.52),
        width: rng(1.4, 3.6),
        length: rng(10, 30),
        life: 1,
        drift: rng(-0.08, 0.08),
        decay: rng(0.004, 0.01)
      });
      if (condensation.length > 55) condensation.shift();
    }

    function drawStar(x, y, size, alpha, warmth, spin) {
      var tintR = Math.round(255 - warmth * 14);
      var tintG = Math.round(245 - warmth * 44);
      var tintB = Math.round(214 - warmth * 104);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin || 0);
      ctx.strokeStyle = 'rgba(' + tintR + ',' + tintG + ',' + tintB + ',' + alpha + ')';
      ctx.lineWidth = 1.25;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-size, 0); ctx.lineTo(size, 0);
      ctx.moveTo(0, -size); ctx.lineTo(0, size);
      ctx.moveTo(-size * 0.55, -size * 0.55); ctx.lineTo(size * 0.55, size * 0.55);
      ctx.moveTo(size * 0.55, -size * 0.55); ctx.lineTo(-size * 0.55, size * 0.55);
      ctx.stroke();
      ctx.restore();
    }

    function drawBackground(g) {
      var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, 'rgba(9, 7, 6, 0.98)');
      bgGrad.addColorStop(0.42, 'rgba(26, 18, 12, 0.96)');
      bgGrad.addColorStop(1, 'rgba(6, 5, 4, 0.99)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      var amberGlow = ctx.createRadialGradient(g.midX, H * 0.78, 0, g.midX, H * 0.78, Math.max(W, H) * 0.72);
      amberGlow.addColorStop(0, 'rgba(255, 188, 72, 0.28)');
      amberGlow.addColorStop(0.26, 'rgba(232, 88, 12, 0.18)');
      amberGlow.addColorStop(0.58, 'rgba(138, 55, 12, 0.08)');
      amberGlow.addColorStop(1, 'rgba(232, 88, 12, 0)');
      ctx.fillStyle = amberGlow;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (var beam = 0; beam < 4; beam++) {
        var beamX = ((time * (18 + beam * 7)) + beam * W * 0.29) % (W + 180) - 90;
        var beamGrad = ctx.createLinearGradient(beamX, 0, beamX + 150, 0);
        beamGrad.addColorStop(0, 'rgba(255,255,255,0)');
        beamGrad.addColorStop(0.42, 'rgba(255,222,150,' + (0.035 + beam * 0.012) + ')');
        beamGrad.addColorStop(0.58, 'rgba(255,132,50,' + (0.025 + beam * 0.006) + ')');
        beamGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(beamX, 0, 150, H);
      }
      for (var swirl = 0; swirl < 4; swirl++) {
        var sy = H * (0.2 + swirl * 0.18) + Math.sin(time * 0.9 + swirl) * 9;
        ctx.beginPath();
        ctx.ellipse(g.midX - W * 0.04, sy, W * (0.32 + swirl * 0.04), 16 + swirl * 2, Math.sin(time * 0.25 + swirl) * 0.14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 170, 76, ' + (0.035 - swirl * 0.004) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.03;
      for (var ci2 = 0; ci2 < 3; ci2++) {
        var cx = (ci2 * W * 0.48 + time * (4 + ci2)) % (W + 340) - 170;
        var cy = 42 + ci2 * 74;
        var cr = 34 + ci2 * 10;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx - cr * 0.72, cy + cr * 0.2, cr * 0.76, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cr * 0.82, cy + cr * 0.15, cr * 0.84, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cr * 0.18, cy - cr * 0.42, cr * 0.62, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function drawGlassShell(g, surfaceY, pressure) {
      ctx.save();
      beginGlassPath(g);
      ctx.fillStyle = 'rgba(255,255,255,0.028)';
      ctx.shadowColor = 'rgba(232, 88, 12, ' + (0.18 + pressure * 0.16) + ')';
      ctx.shadowBlur = 28 + pressure * 22;
      ctx.fill();
      ctx.shadowBlur = 0;

      beginGlassPath(g);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();

      beginGlassPath(g);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 178, 92, ' + (0.18 + pressure * 0.28) + ')';
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(g.midX, g.top, g.halfTop + 2, g.lipH, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(g.midX - g.halfTop + 18, g.top + 12);
      ctx.lineTo(g.midX - g.halfBottom + 10, g.bottom - 18);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 3.2;
      ctx.stroke();

      var edgePulse = 0.05 + 0.035 * Math.sin(time * 3.5);
      ctx.beginPath();
      ctx.moveTo(g.midX + g.halfTop - 16, g.top + 16);
      ctx.lineTo(g.midX + g.halfBottom - 8, g.bottom - 24);
      ctx.strokeStyle = 'rgba(255,206,145,' + (0.08 + edgePulse) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (surfaceY < g.top + 44) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.ellipse(g.midX, g.top + 5, g.halfTop * 0.9, 18, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 224, 172, ' + (0.1 + pressure * 0.22) + ')';
        ctx.lineWidth = 2.8;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    function drawTap(pourX, nozzleY, pressure) {
      var tapY = 0;
      var tapW = 34;
      var tapH = 48;
      ctx.save();

      var railGrad = ctx.createLinearGradient(0, 0, W, 0);
      railGrad.addColorStop(0, 'rgba(60,46,33,0)');
      railGrad.addColorStop(0.34, 'rgba(120,92,62,0.85)');
      railGrad.addColorStop(0.5, 'rgba(220,174,104,0.92)');
      railGrad.addColorStop(0.66, 'rgba(120,92,62,0.85)');
      railGrad.addColorStop(1, 'rgba(60,46,33,0)');
      ctx.fillStyle = railGrad;
      ctx.beginPath();
      ctx.roundRect(pourX - 96, 0, 192, 13, [0, 0, 7, 7]);
      ctx.fill();

      var tapGrad = ctx.createLinearGradient(pourX - tapW / 2, 0, pourX + tapW / 2, 0);
      tapGrad.addColorStop(0, 'rgba(42, 34, 27, 0.94)');
      tapGrad.addColorStop(0.22, 'rgba(116, 95, 70, 0.98)');
      tapGrad.addColorStop(0.5, 'rgba(238, 196, 126, 0.98)');
      tapGrad.addColorStop(0.73, 'rgba(104, 83, 61, 0.96)');
      tapGrad.addColorStop(1, 'rgba(36, 29, 24, 0.94)');
      ctx.fillStyle = tapGrad;
      ctx.beginPath();
      ctx.roundRect(pourX - tapW / 2, tapY + 6, tapW, tapH, [6, 6, 9, 9]);
      ctx.fill();

      ctx.save();
      ctx.translate(pourX + 2, tapY + 17);
      ctx.rotate(-0.34 + Math.sin(time * 0.72) * 0.055 - pressure * 0.045);
      var handleGrad = ctx.createLinearGradient(-8, 0, 8, 0);
      handleGrad.addColorStop(0, 'rgba(54, 36, 24, 0.98)');
      handleGrad.addColorStop(0.5, 'rgba(255, 133, 44, 0.88)');
      handleGrad.addColorStop(1, 'rgba(64, 40, 26, 0.98)');
      ctx.fillStyle = handleGrad;
      ctx.beginPath();
      ctx.roundRect(-6, -45, 12, 46, 6);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -48, 12, 0, Math.PI * 2);
      var knob = ctx.createRadialGradient(-3, -51, 0, 0, -48, 13);
      knob.addColorStop(0, 'rgba(255, 202, 122, 0.95)');
      knob.addColorStop(0.52, 'rgba(232, 88, 12, 0.88)');
      knob.addColorStop(1, 'rgba(116, 38, 8, 0.92)');
      ctx.fillStyle = knob;
      ctx.shadowColor = 'rgba(232, 88, 12, 0.55)';
      ctx.shadowBlur = 10 + pressure * 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.fillStyle = 'rgba(54, 42, 32, 0.96)';
      ctx.beginPath();
      ctx.roundRect(pourX - 11, nozzleY - 7, 22, 12, [2, 2, 7, 7]);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(pourX, nozzleY + 4, 12, 3.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 191, 92, ' + (0.17 + pressure * 0.12) + ')';
      ctx.fill();

      ctx.restore();
    }

    function draw(now) {
      if (!now) now = performance.now();
      var dt = lastFrame ? Math.min((now - lastFrame) / 16.667, 3) : 1;
      lastFrame = now;
      if (!W || !H) { if (running) animId = requestAnimationFrame(draw); return; }

      time += 0.016 * dt;
      var rawTilt = 0;
      if (typeof HeatFX !== 'undefined' && HeatFX.gyro.enabled) {
        rawTilt = Math.max(-1, Math.min(1, HeatFX.gyro.gamma / 90));
      }
      smoothTilt = lerp(smoothTilt, rawTilt, 0.075 * dt);

      var g = makeGlass();
      var level = clamp(beerLevel, 0, 1);
      var levelEase = Math.pow(level, 0.86);
      var surfaceY = lerp(g.bottom - 10, g.top + 26, levelEase);
      var pressure = clamp((beerLevel - 0.72) / 0.28, 0, 1);
      var pourX = clamp(g.midX - g.halfTop * 0.34 + smoothTilt * g.halfTop * 0.78, g.midX - g.halfTop + 26, g.midX + g.halfTop - 26);
      var nozzleY = 58;
      var foamHead = beerLevel > 0.08 ? 13 + beerLevel * 28 + Math.sin(time * 2.4) * 1.8 : 0;

      if (pourActive) {
        beerLevel = Math.min(1, beerLevel + (0.00105 + pressure * 0.0002) * dt);
      } else {
        completionHold += dt;
        if (completionHold > 260) {
          beerLevel = 0;
          pourActive = true;
          completionHold = 0;
          drops = []; carbonation = []; glints = []; condensation = []; foamPuffs = []; shockRings = []; mist = [];
        }
      }
      celebrationFlash = Math.max(0, celebrationFlash - (0.03 * dt));

      ctx.clearRect(0, 0, W, H);
      drawBackground(g);

      for (var ri = shockRings.length - 1; ri >= 0; ri--) {
        var ring = shockRings[ri];
        ring.rx *= Math.pow(ring.grow, dt);
        ring.ry *= Math.pow(ring.grow, dt);
        ring.life -= ring.decay * dt;
        if (ring.life <= 0) { shockRings.splice(ri, 1); continue; }
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.ellipse(ring.x, ring.y, ring.rx, ring.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, ' + Math.round(176 + ring.warmth * 34) + ', 92, ' + (ring.life * 0.36) + ')';
        ctx.lineWidth = 1.4 + ring.life * 1.8;
        ctx.stroke();
        ctx.restore();
      }

      drawGlassShell(g, surfaceY, pressure);

      if (beerLevel > 0) {
        ctx.save();
        beginGlassPath(g);
        ctx.clip();

        ctx.beginPath();
        var startX = g.midX - g.halfTop - 10;
        var endX = g.midX + g.halfTop + 10;
        for (var px = startX; px <= endX; px += 1.5) {
          var wave = Math.sin(px * 0.018 + time * 2.8) * (2.2 + pressure * 1.2) +
                     Math.sin(px * 0.049 + time * 4.4 + smoothTilt * 3) * 1.7 +
                     Math.cos(px * 0.105 + time * 6.1) * 0.7;
          if (px === startX) ctx.moveTo(px, surfaceY + wave);
          else ctx.lineTo(px, surfaceY + wave);
        }
        ctx.lineTo(endX, g.bottom + 38);
        ctx.lineTo(startX, g.bottom + 38);
        ctx.closePath();

        var beerGrad = ctx.createLinearGradient(0, surfaceY, 0, g.bottom + 24);
        beerGrad.addColorStop(0, 'rgba(255, 195, 78, 0.86)');
        beerGrad.addColorStop(0.25, 'rgba(232, 138, 24, 0.82)');
        beerGrad.addColorStop(0.68, 'rgba(184, 102, 16, 0.78)');
        beerGrad.addColorStop(1, 'rgba(108, 54, 8, 0.86)');
        ctx.fillStyle = beerGrad;
        ctx.fill();

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (var ribbon = 0; ribbon < 5; ribbon++) {
          ctx.beginPath();
          var ribbonY = lerp(surfaceY + 20, g.bottom - 22, ribbon / 5) + Math.sin(time * 1.4 + ribbon) * 5;
          ctx.moveTo(g.midX - glassHalfAtY(g, ribbonY) + 6, ribbonY);
          ctx.bezierCurveTo(g.midX - 24, ribbonY - 10, g.midX + 32, ribbonY + 12, g.midX + glassHalfAtY(g, ribbonY) - 6, ribbonY - 3);
          ctx.strokeStyle = 'rgba(255, 226, 126, ' + (0.065 + ribbon * 0.006) + ')';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
        ctx.restore();

        if (beerLevel > 0.05 && Math.random() < (0.45 + pressure * 0.28) * dt) {
          carbonation.push({
            x: glassRandomX(g, g.bottom - 16, 10),
            y: g.bottom + rng(2, 16),
            vy: -rng(0.42, 1.15) * (1 + pressure * 0.25),
            r: rng(1, 3.9),
            wobble: rng(-0.32, 0.32),
            phase: rng(0, Math.PI * 2),
            life: 1
          });
          if (carbonation.length > 120) carbonation.shift();
        }

        for (var ci = carbonation.length - 1; ci >= 0; ci--) {
          var cb = carbonation[ci];
          cb.y += cb.vy * dt;
          cb.x += Math.sin(cb.phase + time * 2.4) * cb.wobble * dt;
          var halfAtBubble = glassHalfAtY(g, cb.y) - 7;
          cb.x = clamp(cb.x, g.midX - halfAtBubble, g.midX + halfAtBubble);
          if (cb.y < surfaceY - 7 || cb.life <= 0) { carbonation.splice(ci, 1); continue; }
          cb.life -= 0.002 * dt;
          var cbAlpha = 0.18 * Math.min(1, (g.bottom - cb.y + 44) / Math.max(1, g.bottom - surfaceY + 44));
          ctx.beginPath();
          ctx.arc(cb.x, cb.y, cb.r, 0, Math.PI * 2);
          var cg = ctx.createRadialGradient(cb.x - cb.r * 0.3, cb.y - cb.r * 0.3, 0, cb.x, cb.y, cb.r);
          cg.addColorStop(0, 'rgba(255, 255, 230, ' + (cbAlpha * 1.8) + ')');
          cg.addColorStop(0.55, 'rgba(255, 228, 170, ' + (cbAlpha * 0.72) + ')');
          cg.addColorStop(1, 'rgba(255, 198, 96, 0)');
          ctx.fillStyle = cg;
          ctx.fill();
        }

        ctx.restore();

        ctx.save();
        beginGlassPath(g);
        ctx.clip();
        var foamTop = surfaceY - foamHead;
        ctx.beginPath();
        for (var fx = startX; fx <= endX; fx += 2) {
          var fy = foamTop +
                   Math.sin(fx * 0.018 + time * 1.1) * 4.6 +
                   Math.sin(fx * 0.052 + time * 1.8) * 2.6 +
                   Math.cos(fx * 0.083 + time * 0.72) * 1.8;
          if (fx === startX) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
        }
        ctx.lineTo(endX, surfaceY + 8);
        ctx.lineTo(startX, surfaceY + 8);
        ctx.closePath();
        var foamGrad = ctx.createLinearGradient(0, foamTop, 0, surfaceY + 10);
        foamGrad.addColorStop(0, 'rgba(255, 252, 238, 0.92)');
        foamGrad.addColorStop(0.34, 'rgba(255, 240, 204, 0.88)');
        foamGrad.addColorStop(0.78, 'rgba(236, 204, 142, 0.6)');
        foamGrad.addColorStop(1, 'rgba(210, 164, 84, 0.08)');
        ctx.fillStyle = foamGrad;
        ctx.fill();

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (var cell = 0; cell < 40; cell++) {
          var cellY = foamTop + rng(4, Math.max(8, foamHead));
          var cellX = glassRandomX(g, cellY, 8);
          var br = rng(1.3, 3.6);
          ctx.beginPath();
          ctx.arc(cellX, cellY, br, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
      }

      if (pourActive && beerLevel < 0.98) {
        var sw = 6 + Math.sin(time * 6.5) * 1.4 + Math.sin(time * 13) * 0.7;
        var tOff = smoothTilt * 22;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pourX - sw * 0.55, nozzleY);
        ctx.bezierCurveTo(
          pourX - sw + tOff * 0.18, lerp(nozzleY, surfaceY, 0.26),
          pourX + tOff * 0.68, lerp(nozzleY, surfaceY, 0.62),
          pourX - sw * 0.32, surfaceY + 3
        );
        ctx.lineTo(pourX + sw * 0.32, surfaceY + 3);
        ctx.bezierCurveTo(
          pourX + tOff * 0.74 + sw * 0.2, lerp(nozzleY, surfaceY, 0.62),
          pourX + sw + tOff * 0.18, lerp(nozzleY, surfaceY, 0.26),
          pourX + sw * 0.55, nozzleY
        );
        ctx.closePath();
        var sg = ctx.createLinearGradient(0, nozzleY, 0, surfaceY + 8);
        sg.addColorStop(0, 'rgba(255, 207, 90, 0.82)');
        sg.addColorStop(0.45, 'rgba(232, 150, 38, 0.65)');
        sg.addColorStop(1, 'rgba(255, 240, 185, 0.38)');
        ctx.fillStyle = sg;
        ctx.shadowColor = 'rgba(255, 178, 70, 0.42)';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.moveTo(pourX, nozzleY + 3);
        ctx.bezierCurveTo(pourX + tOff * 0.18, lerp(nozzleY, surfaceY, 0.34), pourX + tOff * 0.34, lerp(nozzleY, surfaceY, 0.72), pourX, surfaceY - 2);
        ctx.strokeStyle = 'rgba(255,255,232,0.38)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.ellipse(pourX, surfaceY + 3, 24 + pressure * 18, 6 + pressure * 5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 248, 216, ' + (0.22 + pressure * 0.18) + ')';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();

        if (Math.random() < (0.54 + pressure * 0.36) * dt) spawnDrop(pourX, surfaceY, 0.75 + pressure * 0.7, smoothTilt);
        if (Math.random() < (0.38 + pressure * 0.26) * dt) spawnFoamPuff(pourX, surfaceY, 0.72 + pressure * 0.62);
        if (Math.random() < (0.13 + pressure * 0.14) * dt) spawnMist(pourX, surfaceY - 8, 0.7 + pressure * 0.5);
        if (Math.random() < (0.11 + pressure * 0.12) * dt) spawnGlint(pourX + rng(-16, 16), surfaceY - rng(8, 30), rng(9, 20), 0.86);
      } else if (!pourActive && Math.random() < 0.14 * dt) {
        spawnMist(g.midX, g.top + 8, 0.85);
      }

      for (var mi = mist.length - 1; mi >= 0; mi--) {
        var m = mist[mi];
        m.x += m.vx * dt + Math.sin(time * 1.8 + mi) * 0.08;
        m.y += m.vy * dt;
        m.r *= Math.pow(1.01, dt);
        m.life -= m.decay * dt;
        if (m.life <= 0) { mist.splice(mi, 1); continue; }
        var mr = Math.max(0.5, m.r * (0.6 + m.life * 0.4));
        var mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, mr);
        mg.addColorStop(0, 'rgba(255, 250, 236, ' + (m.life * 0.13) + ')');
        mg.addColorStop(0.45, 'rgba(255, 206, 158, ' + (m.life * 0.07) + ')');
        mg.addColorStop(1, 'rgba(255, 206, 158, 0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(m.x, m.y, mr, 0, Math.PI * 2);
        ctx.fill();
      }

      for (var fpi = foamPuffs.length - 1; fpi >= 0; fpi--) {
        var puff = foamPuffs[fpi];
        puff.phase += 0.045 * dt;
        puff.x += (puff.vx + Math.sin(puff.phase) * 0.08 * puff.wobble) * dt;
        puff.y += puff.vy * dt;
        puff.life -= puff.decay * dt;
        if (puff.life <= 0) { foamPuffs.splice(fpi, 1); continue; }
        var pr = puff.r * (0.78 + ease(puff.life) * 0.24);
        var pg = ctx.createRadialGradient(puff.x - pr * 0.28, puff.y - pr * 0.3, 0, puff.x, puff.y, pr);
        pg.addColorStop(0, 'rgba(255, 255, 246, ' + (puff.life * 0.74) + ')');
        pg.addColorStop(0.55, 'rgba(255, 233, 190, ' + (puff.life * 0.42) + ')');
        pg.addColorStop(1, 'rgba(255, 198, 122, 0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(puff.x, puff.y, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      if (beerLevel > 0.1 && Math.random() < 0.09 * dt) spawnCondensation(g);
      for (var co = condensation.length - 1; co >= 0; co--) {
        var drip = condensation[co];
        drip.y += drip.vy * dt;
        drip.x += drip.drift * dt;
        drip.life -= drip.decay * dt;
        if (drip.life <= 0 || drip.y > H + 16) { condensation.splice(co, 1); continue; }
        var alpha = drip.life * 0.32;
        var trailGrad = ctx.createLinearGradient(drip.x, drip.y - drip.length, drip.x, drip.y + 2);
        trailGrad.addColorStop(0, 'rgba(255,255,255,0)');
        trailGrad.addColorStop(0.72, 'rgba(255,255,255,' + alpha + ')');
        trailGrad.addColorStop(1, 'rgba(255,235,200,' + (alpha * 0.88) + ')');
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = drip.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(drip.x, drip.y - drip.length);
        ctx.lineTo(drip.x, drip.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(drip.x, drip.y + 1, drip.width * 0.95, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 1.35) + ')';
        ctx.fill();
      }

      for (var di = drops.length - 1; di >= 0; di--) {
        var d = drops[di];
        d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 0.16 * dt;
        d.life -= d.decay * dt;
        if (d.life <= 0 || d.y > H + 10) { drops.splice(di, 1); continue; }
        var dr = d.r * ease(d.life);
        if (dr < 0.3) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, dr, 0, Math.PI * 2);
        var dg = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, dr);
        if (d.foam) {
          dg.addColorStop(0, 'rgba(255, 252, 232, ' + (d.life * 0.66) + ')');
          dg.addColorStop(1, 'rgba(255, 210, 128, 0)');
        } else {
          dg.addColorStop(0, 'rgba(255, 186, 54, ' + (d.life * 0.62) + ')');
          dg.addColorStop(1, 'rgba(218, 165, 32, 0)');
        }
        ctx.fillStyle = dg;
        ctx.fill();
        if (d.life > 0.7 && Math.random() < 0.15 * dt) spawnGlint(d.x, d.y, rng(6, 12), 0.68);
      }

      drawGlassShell(g, surfaceY, pressure);
      drawTap(pourX, nozzleY, pressure);

      for (var gi = glints.length - 1; gi >= 0; gi--) {
        var glint = glints[gi];
        glint.life -= glint.decay * dt;
        glint.spin += glint.spin * dt;
        if (glint.life <= 0) { glints.splice(gi, 1); continue; }
        var glintAlpha = glint.life * 0.52;
        var size = glint.size * ease(Math.max(0.12, glint.life));
        drawStar(glint.x, glint.y, size, glintAlpha, glint.warmth, time * 0.6 + glint.spin);
      }

      if (celebrationFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255, 198, 92, ' + (celebrationFlash * 0.16) + ')';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      if (beerLevel >= 1 && pourActive) {
        pourActive = false;
        completionHold = 0;
        celebrationFlash = 1;
        for (var burst = 0; burst < 18; burst++) {
          spawnGlint(g.midX + rng(-g.halfTop * 0.78, g.halfTop * 0.78), lerp(g.top, g.bottom, rng(0.04, 0.58)), rng(10, 24), 0.92);
        }
        for (var crown = 0; crown < 28; crown++) {
          spawnFoamPuff(g.midX + rng(-g.halfTop * 0.75, g.halfTop * 0.75), g.top + rng(0, 34), 0.9 + Math.random() * 0.7);
        }
        for (var ringBurst = 0; ringBurst < 6; ringBurst++) {
          spawnShockRing(g.midX, g.top + 12 + ringBurst * 10, 1 + ringBurst * 0.24);
        }
        if (typeof HeatFX !== 'undefined') HeatFX.haptics.success();
      }

      if (running) animId = requestAnimationFrame(draw);
    }

    function startPourHaptics() {
      if (pourHapticTimer) return;
      pourHapticTimer = setInterval(function() {
        if (typeof HeatFX !== 'undefined' && pourActive && beerLevel < 0.98) {
          HeatFX.haptics.pourPulse();
        }
      }, 1100);
    }

    function stopPourHaptics() {
      if (pourHapticTimer) { clearInterval(pourHapticTimer); pourHapticTimer = null; }
    }

    return {
      start: function() {
        if (running) return;
        running = true;
        resize();
        if (typeof HeatFX !== 'undefined') {
          HeatFX.gyro.start();
          HeatFX.sounds.startPour();
          HeatFX.haptics.medium();
        }
        startPourHaptics();
        draw();
      },
      stop: function() {
        running = false;
        if (animId) { cancelAnimationFrame(animId); animId = null; }
        stopPourHaptics();
        if (typeof HeatFX !== 'undefined') {
          HeatFX.sounds.stopPour();
        }
      }
    };
  })();

  // ===== SWIPE SLIDER =====
  var slider = document.getElementById('slider');
  var dots = document.querySelectorAll('.nav-dot');
  var swipeHintCenter = null;
  var swipePeekLeft = document.getElementById('swipe-peek-left');
  var swipePeekRight = document.getElementById('swipe-peek-right');
  var swipePeekLeftLabel = document.getElementById('swipe-peek-left-label');
  var swipePeekRightLabel = document.getElementById('swipe-peek-right-label');
  var panelArrowLeft = document.getElementById('panel-arrow-left');
  var panelArrowRight = document.getElementById('panel-arrow-right');
  var infoDrawer = document.getElementById('info-drawer');
  var infoDrawerTab = document.getElementById('info-drawer-tab');
  var panelCount = slider ? slider.querySelectorAll('.panel').length : 0;
  var maxPanelIndex = Math.max(0, panelCount - 1);
  var currentPanel = 1; // Form is default (center)
  var touchStartX = 0;
  var touchStartY = 0;
  var touchDeltaX = 0;
  var isSwiping = false;
  var gestureAxis = '';
  var swipeLocked = false;
  var peekTimers = [];
  var peekHasRun = false;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  var panelPeekLabels = ['Team', 'Check In', 'Clouds'];

  function getPanelWidth() {
    if (!slider || !panelCount) return window.innerWidth || document.documentElement.clientWidth || 0;
    return slider.getBoundingClientRect().width / panelCount;
  }

  function setSliderOffset(offsetPx) {
    slider.style.transform = 'translate3d(' + offsetPx + 'px, 0, 0)';
  }

  function clearPeekTimers() {
    peekTimers.forEach(function(timerId) {
      window.clearTimeout(timerId);
    });
    peekTimers = [];
  }

  function cancelPeek() {
    clearPeekTimers();
    slider.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    goToPanel(currentPanel);
  }

  function updateSwipePeek() {
    var leftLabel = currentPanel > 0 ? panelPeekLabels[currentPanel - 1] : '';
    var rightLabel = currentPanel < 2 ? panelPeekLabels[currentPanel + 1] : '';

    if (swipePeekLeftLabel) swipePeekLeftLabel.textContent = leftLabel;
    if (swipePeekRightLabel) swipePeekRightLabel.textContent = rightLabel;

    if (swipePeekLeft) swipePeekLeft.classList.toggle('visible', !!leftLabel && touchCapable);
    if (swipePeekRight) swipePeekRight.classList.toggle('visible', !!rightLabel && touchCapable);
  }

  function pulseSwipePeekLabels() {
    [swipePeekLeft, swipePeekRight].forEach(function(element) {
      if (!element || !element.classList.contains('visible')) return;
      element.classList.remove('peek-pop');
      void element.offsetWidth;
      element.classList.add('peek-pop');
    });
  }

  function schedulePeek(delay) {
    if (!touchCapable || peekHasRun || reduceMotion) return;
    clearPeekTimers();
    peekTimers.push(window.setTimeout(function() {
      if (currentPanel !== 1 || swipeLocked) return;
      var panelWidth = getPanelWidth();
      peekHasRun = true;
      pulseSwipePeekLabels();
      slider.style.transition = 'transform 0.3s ease';
      setSliderOffset((-panelWidth) + 18);
      peekTimers.push(window.setTimeout(function() {
        setSliderOffset((-panelWidth) - 18);
      }, 320));
      peekTimers.push(window.setTimeout(function() {
        slider.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        goToPanel(1);
      }, 640));
    }, delay || 900));
  }

  function updatePanelArrows() {
    if (panelArrowLeft) {
      if (currentPanel > 0) {
        panelArrowLeft.disabled = false;
        panelArrowLeft.textContent = '← ' + panelPeekLabels[currentPanel - 1];
        panelArrowLeft.setAttribute('aria-label', 'Go to the ' + panelPeekLabels[currentPanel - 1] + ' panel');
      } else {
        panelArrowLeft.disabled = true;
      }
    }

    if (panelArrowRight) {
      if (currentPanel < maxPanelIndex) {
        panelArrowRight.disabled = false;
        panelArrowRight.textContent = panelPeekLabels[currentPanel + 1] + ' →';
        panelArrowRight.setAttribute('aria-label', 'Go to the ' + panelPeekLabels[currentPanel + 1] + ' panel');
      } else {
        panelArrowRight.disabled = true;
      }
    }
  }

  function goToPanel(index) {
    if (index < 0 || index > maxPanelIndex) return;
    currentPanel = index;
    document.body.classList.toggle('about-panel-active', index === 0);
    setSliderOffset(-index * getPanelWidth());
    dots.forEach(function(d, i) {
      var isActive = i === index;
      d.classList.toggle('active', isActive);
      d.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    if (index === 0 && infoDrawer && infoDrawer.classList.contains('open')) {
      infoDrawer.classList.remove('open');
      document.body.classList.remove('drawer-open');
      if (infoDrawerTab) infoDrawerTab.setAttribute('aria-expanded', 'false');
    }

    /* Haptic feedback on panel change */
    if (typeof HeatFX !== 'undefined') HeatFX.haptics.swipe();

    /* Start/stop beer pour when on Clouds panel (index 2) */
    if (typeof pourEngine !== 'undefined') {
      if (index === 2) pourEngine.start(); else pourEngine.stop();
    }

    updateSwipePeek();
    updatePanelArrows();
  }

  // Touch swipe handling
  slider.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    cancelPeek();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDeltaX = 0;
    isSwiping = false;
    gestureAxis = '';
    swipeLocked = !e.target.closest('.panel') || !!e.target.closest('input:not([type="hidden"]), textarea, select, [contenteditable="true"]');
    slider.style.transition = 'none';
  }, { passive: true });

  slider.addEventListener('touchmove', function(e) {
    if (swipeLocked || !e.touches.length) return;
    var dx = e.touches[0].clientX - touchStartX;
    var dy = e.touches[0].clientY - touchStartY;

    if (!gestureAxis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      gestureAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      isSwiping = gestureAxis === 'x';
    }

    if (gestureAxis !== 'x') return;

    e.preventDefault();
    touchDeltaX = dx;

    var resistance = 1;
    if ((currentPanel === 0 && dx > 0) || (currentPanel === maxPanelIndex && dx < 0)) {
      resistance = 0.35;
    }
    var offset = (-currentPanel * getPanelWidth()) + (dx * resistance);
    setSliderOffset(offset);
  }, { passive: false });

  function finishSwipe() {
    slider.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    if (isSwiping) {
      var threshold = getPanelWidth() * 0.16;
      if (touchDeltaX < -threshold && currentPanel < maxPanelIndex) {
        goToPanel(currentPanel + 1);
      } else if (touchDeltaX > threshold && currentPanel > 0) {
        goToPanel(currentPanel - 1);
      } else {
        goToPanel(currentPanel);
      }
    }
    isSwiping = false;
    swipeLocked = false;
    gestureAxis = '';
    touchDeltaX = 0;
  }

  slider.addEventListener('touchend', finishSwipe);
  slider.addEventListener('touchcancel', finishSwipe);

  // Mouse drag for desktop swipe
  var mouseDown = false;
  slider.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    if (e.target.closest('input, textarea, select, button, a, label, [contenteditable]')) return;
    mouseDown = true;
    cancelPeek();
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    touchDeltaX = 0;
    slider.style.transition = 'none';
    e.preventDefault();
  });
  slider.addEventListener('mousemove', function(e) {
    if (!mouseDown || swipeLocked) return;
    var dx = e.clientX - touchStartX;
    var dy = e.clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dx) < 15) return;
    touchDeltaX = dx;
    var resistance = 1;
    if ((currentPanel === 0 && dx > 0) || (currentPanel === maxPanelIndex && dx < 0)) {
      resistance = 0.35;
    }
    setSliderOffset((-currentPanel * getPanelWidth()) + (dx * resistance));
  });
  window.addEventListener('mouseup', function() {
    if (!mouseDown) return;
    mouseDown = false;
    finishSwipe();
  });

  // Dot clicks
  dots.forEach(function(dot) {
    dot.addEventListener('click', function() {
      cancelPeek();
      goToPanel(parseInt(this.getAttribute('data-index')));
    });
  });

  if (panelArrowLeft) {
    panelArrowLeft.addEventListener('click', function() {
      cancelPeek();
      goToPanel(currentPanel - 1);
    });
  }

  if (panelArrowRight) {
    panelArrowRight.addEventListener('click', function() {
      cancelPeek();
      goToPanel(currentPanel + 1);
    });
  }

  window.addEventListener('keydown', function(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && e.target.closest('input, textarea, select, button, [contenteditable]')) return;
    if (e.key === 'ArrowLeft' && currentPanel > 0) {
      cancelPeek();
      goToPanel(currentPanel - 1);
    } else if (e.key === 'ArrowRight' && currentPanel < maxPanelIndex) {
      cancelPeek();
      goToPanel(currentPanel + 1);
    }
  });

  function realignPanels() {
    if (mouseDown || isSwiping) return;
    goToPanel(currentPanel);
  }

  window.addEventListener('resize', realignPanels);
  if (window.visualViewport && window.visualViewport.addEventListener) {
    window.visualViewport.addEventListener('resize', realignPanels);
  }

  goToPanel(currentPanel);
  updateSwipePeek();
  schedulePeek(900);

  // ===== COUNTDOWN TIMER =====
  var MEETING_DAY = Number.isFinite(MEETING_CONFIG.day) ? MEETING_CONFIG.day : 4;
  var MEETING_HOUR = Number.isFinite(MEETING_CONFIG.hour) ? MEETING_CONFIG.hour : 16;
  var MEETING_MIN = Number.isFinite(MEETING_CONFIG.minute) ? MEETING_CONFIG.minute : 0;
  var MEETING_TIME_LABEL = MEETING_CONFIG.publicTimeLabel || '4:00 PM ET';
  var MEETING_TIME_ZONE = MEETING_CONFIG.timezone || 'America/New_York';
  var MEETING_DURATION = 2 * 60 * 60 * 1000;
  var meetingDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MEETING_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  var meetingPartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MEETING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  function getMeetingParts(date) {
    var parts = {};
    meetingPartsFormatter.formatToParts(date).forEach(function(part) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    });
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second)
    };
  }

  function getMeetingOffsetMs(date) {
    var parts = getMeetingParts(date);
    var zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return zonedAsUtc - date.getTime();
  }

  function getMeetingTimestamp(year, month, day, hour, minute) {
    var utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
    var offset = getMeetingOffsetMs(new Date(utcGuess));
    var timestamp = utcGuess - offset;
    var refinedOffset = getMeetingOffsetMs(new Date(timestamp));

    if (refinedOffset !== offset) {
      timestamp = utcGuess - refinedOffset;
    }

    return timestamp;
  }

  function getNextMeeting() {
    var eastNow = getMeetingParts(new Date());
    var todayUtc = new Date(Date.UTC(eastNow.year, eastNow.month - 1, eastNow.day));
    var dow = todayUtc.getUTCDay();
    var daysUntil = (MEETING_DAY - dow + 7) % 7;
    var meetingEndMinutes = (MEETING_HOUR * 60) + MEETING_MIN + (MEETING_DURATION / 60000);
    var currentMinutes = (eastNow.hour * 60) + eastNow.minute + (eastNow.second / 60);

    if (daysUntil === 0 && currentMinutes >= meetingEndMinutes) {
      daysUntil = 7;
    }

    todayUtc.setUTCDate(todayUtc.getUTCDate() + daysUntil);

    var year = todayUtc.getUTCFullYear();
    var month = todayUtc.getUTCMonth() + 1;
    var day = todayUtc.getUTCDate();
    var timestamp = getMeetingTimestamp(year, month, day, MEETING_HOUR, MEETING_MIN);

    return {
      timestamp: timestamp,
      dateStr: meetingDateFormatter.format(new Date(timestamp))
    };
  }

  var meeting = getNextMeeting();
  var datetimeEl = document.getElementById('meeting-datetime');
  var countdownGrid = document.getElementById('countdown-grid');
  var statusEl = document.getElementById('meeting-status');
  var meetingLocationEl = document.getElementById('meeting-location');

  if (meetingLocationEl && MEETING_CONFIG.venueLineShort) {
    meetingLocationEl.textContent = MEETING_CONFIG.venueLineShort;
  }

  datetimeEl.textContent = meeting.dateStr + ' \u2022 ' + MEETING_TIME_LABEL;

  function updateCountdown() {
    var now = Date.now();
    var diff = meeting.timestamp - now;

    if (diff <= 0) {
      countdownGrid.style.display = 'none';
      statusEl.style.display = 'block';
      if (diff > -2 * 60 * 60 * 1000) {
        statusEl.textContent = 'MEETING IN PROGRESS';
      } else {
        meeting = getNextMeeting();
        datetimeEl.textContent = meeting.dateStr + ' \u2022 ' + MEETING_TIME_LABEL;
        countdownGrid.style.display = 'grid';
        statusEl.style.display = 'none';
      }
      return;
    }

    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var secs = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('cd-days').textContent = String(days).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cd-mins').textContent = String(mins).padStart(2, '0');
    document.getElementById('cd-secs').textContent = String(secs).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // ===== TEAM GRID (index-specific) =====
  // TEAM_MEMBERS is kept here for renderTeamGrid; shared-form.js manages its own copy.
  var TEAM_MEMBERS = [
    { name: 'Carter Helms', title: 'Team Chair', profession: 'Community Insurance Agent', company: 'Highstreet Ins & Financial Svcs', website: 'https://carterhelms.com', leader: true, chair: true, photo: '/member-photos/carter-helms.jpg', photoObjectPosition: 'center 18%' },
    { name: 'Craig Morrill', title: 'Vice Chair', profession: 'Financial Advisor', company: 'Summit Global Investments', website: 'https://sgiam.com', leader: true, chair: false, photo: '/member-photos/craig-morrill.jpg', photoObjectPosition: 'center 18%' },
    { name: 'Will Sigmon', title: 'Team Admin', profession: 'Software & Creative', company: 'Will Sigmon Media Co.', website: 'https://willsigmon.media', leader: true, chair: false, photo: '/member-photos/will-sigmon.jpg', photoObjectPosition: 'center 18%' },
    { name: 'Rusty Sutton', title: 'Team Marketing Specialist', profession: 'Digital Marketing', company: 'MonkeyFans Creative', website: 'https://monkeyfansraleigh.com/about', leader: false, specialTitle: true, photo: '/member-photos/rusty-sutton.jpg', photoObjectPosition: 'center 20%' },
    { name: 'Robert Courts', title: 'Mortgage Lending', company: 'Advantage Lending', website: 'https://advantagelending.com/mortgage-loan-services', leader: false, photo: '/member-photos/robert-courts.png', photoObjectPosition: 'center 20%' },
    { name: 'Dana Walsh', title: 'Magazine Publisher', company: 'Stroll Magazine', website: 'https://strollmag.com/locations/hayes-barton-nc', leader: false, photo: '/member-photos/dana-walsh.jpg', photoObjectPosition: 'center 25%' },
    { name: 'Nathan Senn', title: 'Property Restoration', company: 'Franco Restorations', website: 'https://francorestorations.com', leader: false },
    { name: 'Roni Payne', title: 'Accounting / Tax', company: 'R. Payne Financial & Tax Solutions', website: 'https://rpayne.org/about', leader: false },
    { name: 'Shannida Ramsey', title: 'Property Maintenance', company: 'Ram-Z Services LLC', website: 'https://ramzservices.com', leader: false },
    { name: 'David Mercado', title: 'HOA Management', company: 'William Douglas Management', website: 'https://wmdouglas.com/raleigh-hoa-management', leader: false },
    { name: 'Sue Kerata', title: 'Realtor', company: 'Century 21 Triangle Group', website: 'https://suekhomes.com', leader: false, photo: '/member-photos/sue-kerata.jpg', photoObjectPosition: 'center 20%' }
  ];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderTeamGrid() {
    var teamGrid = document.getElementById('team-grid');
    if (!teamGrid) return;
    var governanceMembers = TEAM_MEMBERS.filter(function(member) { return member.leader; });
    var memberRoster = TEAM_MEMBERS.filter(function(member) { return !member.leader; });

    // Place the Team Chair first in the governance list so the full-width
    // chair card renders at the top regardless of sheet row order. Stable for
    // the rest of the governance members.
    governanceMembers.sort(function(a, b) {
      return (b.chair === true) - (a.chair === true);
    });

    function renderMemberCards(members, options) {
      var isGovernance = options && options.governance;
      return members.map(function(member) {
        var isChair = isGovernance && member.chair === true;
        var roleText = member.leader ? member.title : (member.specialTitle ? member.title : '');
        var roleBadge = roleText ? '<div class="team-member-role">' + escapeHtml(roleText) + '</div>' : '';
        var classes = 'team-member' + (member.leader ? ' leader' : '') + (isChair ? ' chair' : '');
        var photoHtml = '';
        if (member.photo) {
          var objPos = member.photoObjectPosition ? ' style="object-position:' + escapeHtml(member.photoObjectPosition) + '"' : '';
          photoHtml = '<img class="team-member-photo" src="' + escapeHtml(member.photo) + '" alt="' + escapeHtml(member.name) + '"' + objPos + ' loading="lazy" decoding="async" width="64" height="64">';
        } else {
          var initials = member.name.split(' ').map(function(w) { return w.charAt(0); }).join('').toUpperCase();
          photoHtml = '<div class="team-member-photo team-member-initials">' + escapeHtml(initials) + '</div>';
        }
        var specialty = member.profession || member.title || '';
        var companyLine = member.company || '';
        return '<div class="' + classes + '">' +
          photoHtml +
          '<div class="team-member-body">' +
            '<div class="team-member-name">' + escapeHtml(member.name) + '</div>' +
            (specialty ? '<div class="team-member-specialty">' + escapeHtml(specialty) + '</div>' : '') +
            (companyLine ? '<div class="team-member-company">' + escapeHtml(companyLine) + '</div>' : '') +
            roleBadge +
          '</div>' +
        '</div>';
      }).join('');
    }

    teamGrid.innerHTML =
      '<div class="team-grid-group team-grid-group--governance">' +
        '<div class="team-grid-label">Governance Committee</div>' +
        '<div class="team-grid-cards team-grid-cards--governance">' + renderMemberCards(governanceMembers, { governance: true }) + '</div>' +
      '</div>' +
      '<div class="team-grid-group team-grid-group--members">' +
        '<div class="team-grid-label">Members</div>' +
        '<div class="team-grid-cards team-grid-cards--members">' + renderMemberCards(memberRoster) + '</div>' +
      '</div>';
  }

  renderTeamGrid();

  // Wire up check-in form (initCheckinForm is defined in shared-form.js,
  // which must be loaded before this script).
  if (typeof initCheckinForm === 'function') {
    initCheckinForm({
      formId: 'checkin-form',
      isKiosk: false,
      onReset: function() {
        var countdown = document.getElementById('countdown-section');
        if (countdown) countdown.style.display = 'block';
      },
      onSuccess: function() {
        var countdown = document.getElementById('countdown-section');
        if (countdown) countdown.style.display = 'none';
      },
      onMembersLoaded: function(members) {
        // Merge API members with hardcoded list so rich fields
        // (profession, specialTitle, photo) aren't lost and members
        // missing from the sheet still appear.
        var byName = {};
        TEAM_MEMBERS.forEach(function(m) { byName[m.name.toLowerCase()] = Object.assign({}, m); });
        members.forEach(function(m) {
          var key = m.name.toLowerCase();
          if (byName[key]) {
            byName[key] = Object.assign(byName[key], m);
          } else {
            byName[key] = m;
          }
        });
        TEAM_MEMBERS = Object.keys(byName).map(function(k) { return byName[k]; });
        renderTeamGrid();
      }
    });
  }

})();
