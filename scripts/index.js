(function() {
  var SITE_CONFIG = window.HEATWAVE_SITE_CONFIG || {};
  var MEETING_CONFIG = SITE_CONFIG.meeting || {};

  // ===== BEER MENU DATA =====
  var BEER_MENU = {
    lastChecked: null,
    featured: [
      { name: 'Tailwind Margarita', style: 'THC Seltzer', abv: 'N/A'   },
      { name: 'Mean Girl',          style: 'Kettle Sour',  abv: '5.5%' },
      { name: 'Sky Lime',           style: 'Lime Lager',   abv: '4.6%' }
    ],
    categories: [
      {
        name: 'Lagers & Pilsners',
        beers: [
          { name: 'Sky Lime',       style: 'Lime Lager',                   abv: '4.6%'  },
          { name: 'Wolkenbrau',     style: 'Hybrid German-American Lager', abv: '4.5%'  },
          { name: 'Precipitation',  style: 'German Pilsner',               abv: '5.2%'  },
          { name: 'Czech Mate',     style: 'Czech Style Pilsner',          abv: '5.6%'  },
          { name: 'Accumulation',   style: 'Amber Lager',                  abv: '5.8%'  }
        ]
      },
      {
        name: 'IPAs & Strong Ales',
        beers: [
          { name: 'Hop Jam IPA',         style: 'American IPA',         abv: '6.3%'  },
          { name: 'Hazy Hop Jam',        style: 'Hazy IPA',             abv: '6.3%'  },
          { name: 'Double Hop Jam',      style: 'Imperial IPA',         abv: '10.3%' },
          { name: 'Clouds 9',            style: 'Belgian Golden Strong', abv: '9%'   },
          { name: 'Donner & Blitzen 25', style: 'Spiced Belgian Quad',  abv: '10.5%' }
        ]
      },
      {
        name: 'Sours, Stouts & Porters',
        beers: [
          { name: 'Mean Girl',          style: 'Blackberry Dragon Fruit Kettle Sour', abv: '5.5%'  },
          { name: 'Crimea River',       style: 'Baltic Porter',                       abv: '8%'    },
          { name: 'Midnight Delight',   style: 'Dark Chocolate Milk Stout',           abv: '6.8%'  },
          { name: 'Coffee at Midnight', style: 'Coffee Stout',                        abv: '7%'    },
          { name: 'Kentucky Moonlight', style: 'BBA Imperial Stout',                  abv: '10.5%' }
        ]
      },
      {
        name: 'Wheat, THC & N/A',
        beers: [
          { name: 'El Hefe',            style: 'Bavarian Wheat',          abv: '4.9%' },
          { name: 'Tailwind Margarita', style: '7mg Delta 9 THC Seltzer', abv: 'N/A'  },
          { name: 'Root Beer',          style: 'Non-Alcoholic',           abv: 'N/A'  }
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
    var drops = [], carbonation = [], glints = [], condensation = [];
    var pourHapticTimer = null;
    var lastFrame = 0;
    var smoothTilt = 0; /* interpolated gyro for buttery motion */
    var celebrationFlash = 0;

    function resize() {
      var rect = c.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      c.width = W * dpr; c.height = H * dpr;
      ctx.scale(dpr, dpr);
    }

    function rng(a, b) { return a + Math.random() * (b - a); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function spawnGlint(x, y, size, warmth) {
      glints.push({
        x: x,
        y: y,
        size: size || rng(8, 16),
        life: 1,
        decay: rng(0.025, 0.06),
        warmth: typeof warmth === 'number' ? warmth : Math.random()
      });
    }

    function spawnCondensation() {
      var glassMidX = W * 0.54;
      var glassHalfTop = Math.min(W * 0.17, 110);
      var side = Math.random() < 0.5 ? -1 : 1;
      condensation.push({
        x: glassMidX + side * (glassHalfTop - rng(8, 20)) + rng(-6, 6),
        y: rng(H * 0.22, H * 0.72),
        vy: rng(0.18, 0.5),
        width: rng(1.5, 3.8),
        length: rng(10, 28),
        life: 1,
        drift: rng(-0.08, 0.08),
        decay: rng(0.004, 0.01)
      });
    }

    function draw(now) {
      /* Delta-time for frame-rate independent animation */
      if (!now) now = performance.now();
      var dt = lastFrame ? Math.min((now - lastFrame) / 16.667, 3) : 1;
      lastFrame = now;
      if (!W || !H) { if (running) animId = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, W, H);
      time += 0.016 * dt;

      /* Smooth gyro interpolation — no jitter */
      var rawTilt = 0;
      if (typeof HeatFX !== 'undefined' && HeatFX.gyro.enabled) {
        rawTilt = Math.max(-1, Math.min(1, HeatFX.gyro.gamma / 90));
      }
      smoothTilt = lerp(smoothTilt, rawTilt, 0.08 * dt);

      var pourX = W * 0.4 + smoothTilt * W * 0.25;
      var surfaceY = H - (H * beerLevel);
      var tapY = 0; /* tap sits at top of canvas */
      var glassMidX = W * 0.54;
      var glassTop = H * 0.16;
      var glassBottom = H * 0.94;
      var glassHalfTop = Math.min(W * 0.17, 112);
      var glassHalfBottom = glassHalfTop * 0.72;

      if (pourActive) beerLevel = Math.min(1, beerLevel + 0.0006 * dt);
      celebrationFlash = Math.max(0, celebrationFlash - (0.035 * dt));

      /* ── Brew hall glow + moving caustics ── */
      ctx.save();
      var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, 'rgba(14, 11, 9, 0.96)');
      bgGrad.addColorStop(0.48, 'rgba(22, 17, 13, 0.88)');
      bgGrad.addColorStop(1, 'rgba(9, 7, 6, 0.98)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      var amberGlow = ctx.createRadialGradient(glassMidX, H * 0.82, 0, glassMidX, H * 0.82, Math.max(W, H) * 0.65);
      amberGlow.addColorStop(0, 'rgba(255, 187, 72, 0.22)');
      amberGlow.addColorStop(0.35, 'rgba(232, 88, 12, 0.13)');
      amberGlow.addColorStop(1, 'rgba(232, 88, 12, 0)');
      ctx.fillStyle = amberGlow;
      ctx.fillRect(0, 0, W, H);

      for (var beam = 0; beam < 3; beam++) {
        var beamX = ((time * (16 + beam * 9)) + beam * W * 0.34) % (W + 180) - 90;
        var beamGrad = ctx.createLinearGradient(beamX, 0, beamX + 120, 0);
        beamGrad.addColorStop(0, 'rgba(255,255,255,0)');
        beamGrad.addColorStop(0.5, 'rgba(255,216,150,' + (0.04 + beam * 0.012) + ')');
        beamGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(beamX, 0, 120, H);
      }
      ctx.restore();

      /* ── Background Clouds Brewing clouds (subtle, slow drift) ── */
      ctx.save();
      ctx.globalAlpha = 0.022;
      for (var ci2 = 0; ci2 < 2; ci2++) {
        var cx = (ci2 * W * 0.6 + time * 2) % (W + 400) - 200;
        var cy = 50 + ci2 * 100;
        var cr = 40 + ci2 * 12;
        /* Solid puffy cloud shape — overlapping white circles */
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx - cr * 0.7, cy + cr * 0.2, cr * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cr * 0.8, cy + cr * 0.15, cr * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cr * 0.2, cy - cr * 0.4, cr * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx - cr * 0.3, cy - cr * 0.3, cr * 0.55, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      /* ── Pint silhouette + glass highlights ── */
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(glassMidX - glassHalfTop, glassTop);
      ctx.lineTo(glassMidX + glassHalfTop, glassTop);
      ctx.lineTo(glassMidX + glassHalfBottom, glassBottom);
      ctx.quadraticCurveTo(glassMidX, glassBottom + 24, glassMidX - glassHalfBottom, glassBottom);
      ctx.closePath();

      ctx.fillStyle = 'rgba(255,255,255,0.028)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.17)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(glassMidX - glassHalfTop + 18, glassTop + 12);
      ctx.lineTo(glassMidX - glassHalfBottom + 10, glassBottom - 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.11)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(glassMidX + glassHalfTop - 16, glassTop + 16);
      ctx.lineTo(glassMidX + glassHalfBottom - 8, glassBottom - 20);
      ctx.strokeStyle = 'rgba(255,220,170,0.06)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(glassMidX, glassTop, glassHalfTop, 10, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      /* ── Beer tap / faucet ── */
      ctx.save();
      var tapCx = pourX;
      var tapW = 20, tapH = 38;
      var handleW = 10, handleH = 32;
      var nozzleY = tapY + tapH;

      /* Tap body — dark chrome rectangle */
      var tapGrad = ctx.createLinearGradient(tapCx - tapW / 2, tapY, tapCx + tapW / 2, tapY);
      tapGrad.addColorStop(0, 'rgba(60, 50, 40, 0.9)');
      tapGrad.addColorStop(0.3, 'rgba(100, 85, 65, 0.95)');
      tapGrad.addColorStop(0.5, 'rgba(120, 100, 75, 0.95)');
      tapGrad.addColorStop(0.7, 'rgba(100, 85, 65, 0.95)');
      tapGrad.addColorStop(1, 'rgba(55, 45, 35, 0.9)');
      ctx.fillStyle = tapGrad;
      ctx.beginPath();
      ctx.roundRect(tapCx - tapW / 2, tapY, tapW, tapH, [0, 0, 4, 4]);
      ctx.fill();

      /* Mounting plate */
      ctx.fillStyle = 'rgba(80, 65, 50, 0.8)';
      ctx.beginPath();
      ctx.roundRect(tapCx - tapW * 0.7, tapY, tapW * 1.4, 8, [0, 0, 3, 3]);
      ctx.fill();

      /* Handle — angled lever */
      ctx.save();
      ctx.translate(tapCx, tapY + 10);
      ctx.rotate(-0.25 + Math.sin(time * 0.5) * 0.03); /* subtle sway */
      var hGrad = ctx.createLinearGradient(-handleW / 2, 0, handleW / 2, 0);
      hGrad.addColorStop(0, 'rgba(50, 40, 30, 0.9)');
      hGrad.addColorStop(0.4, 'rgba(90, 75, 55, 0.95)');
      hGrad.addColorStop(1, 'rgba(50, 40, 30, 0.9)');
      ctx.fillStyle = hGrad;
      ctx.beginPath();
      ctx.roundRect(-handleW / 2, -handleH, handleW, handleH, 4);
      ctx.fill();
      /* Handle knob */
      ctx.fillStyle = 'rgba(232, 88, 12, 0.7)';
      ctx.beginPath();
      ctx.arc(0, -handleH, handleW * 0.65, 0, Math.PI * 2);
      ctx.fill();
      /* Knob highlight */
      ctx.fillStyle = 'rgba(255, 160, 60, 0.3)';
      ctx.beginPath();
      ctx.arc(-2, -handleH - 2, handleW * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* Nozzle tip */
      ctx.fillStyle = 'rgba(90, 75, 55, 0.9)';
      ctx.beginPath();
      ctx.roundRect(tapCx - 7, nozzleY - 2, 14, 8, [0, 0, 4, 4]);
      ctx.fill();
      /* Drip ring */
      ctx.fillStyle = 'rgba(218, 165, 32, 0.2)';
      ctx.beginPath();
      ctx.ellipse(tapCx, nozzleY + 6, 8, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      /* ── Amber beer body — fine wave resolution ── */
      if (beerLevel > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-1, surfaceY);
        /* Sub-pixel wave stepping for smooth surface */
        for (var px = 0; px <= W + 1; px += 1.5) {
          var wave = Math.sin(px * 0.012 + time * 2.2) * 2.5 +
                     Math.sin(px * 0.035 + time * 3.2 + smoothTilt * 2) * 1.8 +
                     Math.sin(px * 0.08 + time * 4.5) * 0.6;
          ctx.lineTo(px, surfaceY + wave);
        }
        ctx.lineTo(W + 1, H + 1); ctx.lineTo(-1, H + 1); ctx.closePath();

        var bg = ctx.createLinearGradient(0, surfaceY, 0, H);
        bg.addColorStop(0, 'rgba(218, 165, 32, 0.32)');
        bg.addColorStop(0.25, 'rgba(200, 145, 25, 0.28)');
        bg.addColorStop(0.6, 'rgba(170, 115, 18, 0.24)');
        bg.addColorStop(1, 'rgba(140, 90, 10, 0.18)');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.restore();
      }

      /* ── Pour stream — from nozzle tip ── */
      if (pourActive && beerLevel < 0.92) {
        var sw = 4 + Math.sin(time * 6) * 1.2 + Math.sin(time * 11) * 0.4;
        var tOff = smoothTilt * 18;
        var nzY = tapY + tapH + 8; /* nozzle bottom */
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pourX - 3, nzY);
        ctx.bezierCurveTo(
          pourX - sw * 0.5 + tOff * 0.3, lerp(nzY, surfaceY, 0.3),
          pourX + tOff * 0.7, lerp(nzY, surfaceY, 0.6),
          pourX - 2.5, surfaceY
        );
        ctx.lineTo(pourX + 2.5, surfaceY);
        ctx.bezierCurveTo(
          pourX + tOff * 0.7 + sw * 0.2, lerp(nzY, surfaceY, 0.6),
          pourX + sw * 0.5 + tOff * 0.3, lerp(nzY, surfaceY, 0.3),
          pourX + 3, nzY
        );
        ctx.closePath();
        var sg = ctx.createLinearGradient(0, 0, 0, surfaceY);
        sg.addColorStop(0, 'rgba(218, 165, 32, 0.65)');
        sg.addColorStop(0.7, 'rgba(200, 140, 20, 0.45)');
        sg.addColorStop(1, 'rgba(200, 140, 20, 0.25)');
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.restore();

        /* Splash — radial gradient drops for softness */
        if (Math.random() < 0.3 * dt) {
          drops.push({
            x: pourX + rng(-16, 16), y: surfaceY,
            vx: rng(-1.5, 1.5) + smoothTilt * 1.5, vy: rng(-3.5, -0.8),
            r: rng(1.5, 4), life: 1, decay: rng(0.015, 0.03)
          });
        }
        if (Math.random() < 0.1 * dt) {
          spawnGlint(pourX + rng(-14, 14), surfaceY - rng(8, 26), rng(9, 18), 0.85);
        }
      }

      /* ── Carbonation — radial gradient bubbles ── */
      if (beerLevel > 0.05 && Math.random() < 0.35 * dt) {
        carbonation.push({
          x: rng(0, W), y: H + 4,
          vy: -rng(0.3, 0.9), r: rng(1, 3.5),
          wobble: rng(-0.25, 0.25), phase: Math.random() * 6.28,
          life: 1
        });
      }
      for (var ci = carbonation.length - 1; ci >= 0; ci--) {
        var cb = carbonation[ci];
        cb.y += cb.vy * dt;
        cb.x += Math.sin(cb.phase + time * 1.8) * cb.wobble;
        if (cb.y < surfaceY - 2) { carbonation.splice(ci, 1); continue; }
        var cbAlpha = 0.12 * Math.min(1, (H - cb.y) / (H * 0.3));
        ctx.beginPath();
        ctx.arc(cb.x, cb.y, cb.r, 0, Math.PI * 2);
        var cg = ctx.createRadialGradient(cb.x - cb.r * 0.3, cb.y - cb.r * 0.3, 0, cb.x, cb.y, cb.r);
        cg.addColorStop(0, 'rgba(255, 255, 220, ' + (cbAlpha * 1.5) + ')');
        cg.addColorStop(1, 'rgba(255, 255, 200, ' + (cbAlpha * 0.3) + ')');
        ctx.fillStyle = cg;
        ctx.fill();
      }

      /* ── Cold-glass condensation trails ── */
      if (beerLevel > 0.1 && Math.random() < 0.08 * dt) spawnCondensation();
      for (var co = condensation.length - 1; co >= 0; co--) {
        var drip = condensation[co];
        drip.y += drip.vy * dt;
        drip.x += drip.drift * dt;
        drip.life -= drip.decay * dt;
        if (drip.life <= 0 || drip.y > H + 16) { condensation.splice(co, 1); continue; }

        var alpha = drip.life * 0.28;
        var trailGrad = ctx.createLinearGradient(drip.x, drip.y - drip.length, drip.x, drip.y + 2);
        trailGrad.addColorStop(0, 'rgba(255,255,255,0)');
        trailGrad.addColorStop(0.8, 'rgba(255,255,255,' + alpha + ')');
        trailGrad.addColorStop(1, 'rgba(255,235,200,' + (alpha * 0.9) + ')');
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = drip.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(drip.x, drip.y - drip.length);
        ctx.lineTo(drip.x, drip.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(drip.x, drip.y + 1, drip.width * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 1.4) + ')';
        ctx.fill();
      }

      /* ── Splash drops — soft radial ── */
      for (var di = drops.length - 1; di >= 0; di--) {
        var d = drops[di];
        d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 0.15 * dt;
        d.life -= d.decay * dt;
        if (d.life <= 0 || d.y > H + 10) { drops.splice(di, 1); continue; }
        var dr = d.r * ease(d.life);
        if (dr < 0.3) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, dr, 0, Math.PI * 2);
        var dg = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, dr);
        dg.addColorStop(0, 'rgba(218, 165, 32, ' + (d.life * 0.5) + ')');
        dg.addColorStop(1, 'rgba(218, 165, 32, 0)');
        ctx.fillStyle = dg;
        ctx.fill();
        if (d.life > 0.72 && Math.random() < 0.16 * dt) {
          spawnGlint(d.x, d.y, rng(6, 12), 0.65);
        }
      }

      /* ── Beer foam head — thick creamy white ── */
      if (beerLevel > 0.08) {
        var fh = 14 + beerLevel * 24;
        ctx.save();

        var foamTop = surfaceY - fh;

        /* 1) Solid opaque cream base — this IS the foam */
        ctx.beginPath();
        for (var fx = -1; fx <= W + 1; fx += 2) {
          var fy = foamTop +
                   Math.sin(fx * 0.014 + time * 0.7) * 4 +
                   Math.sin(fx * 0.04 + time * 1.2) * 2.5 +
                   Math.cos(fx * 0.07 + time * 0.5) * 1.5;
          if (fx <= 0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
        }
        ctx.lineTo(W + 1, surfaceY + 4); ctx.lineTo(-1, surfaceY + 4); ctx.closePath();

        var baseGrad = ctx.createLinearGradient(0, foamTop, 0, surfaceY + 4);
        baseGrad.addColorStop(0, 'rgba(255, 250, 235, 0.85)');
        baseGrad.addColorStop(0.2, 'rgba(252, 245, 225, 0.9)');
        baseGrad.addColorStop(0.6, 'rgba(248, 238, 210, 0.8)');
        baseGrad.addColorStop(0.85, 'rgba(240, 225, 185, 0.6)');
        baseGrad.addColorStop(1, 'rgba(225, 200, 150, 0.15)');
        ctx.fillStyle = baseGrad;
        ctx.fill();

        /* 2) Bubble cell pattern — darker outlines give depth */
        var seed = 42;
        for (var row = 0; row < Math.ceil(fh / 5); row++) {
          var by = foamTop + 4 + row * 5;
          if (by > surfaceY) break;
          var rowShift = (row % 2) * 3.5;
          for (var bx = rowShift; bx < W; bx += 7) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            var br = 2.2 + (seed % 100) / 100 * 1.5;
            /* Dark ring = cell wall */
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(200, 180, 140, 0.2)';
            ctx.lineWidth = 0.6;
            ctx.stroke();
            /* Highlight dot = light catching the bubble */
            ctx.beginPath();
            ctx.arc(bx - br * 0.25, by - br * 0.3, br * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fill();
          }
        }

        ctx.restore();
      }

      /* ── Sparkle glints on stream, foam, and glass ── */
      for (var gi = glints.length - 1; gi >= 0; gi--) {
        var glint = glints[gi];
        glint.life -= glint.decay * dt;
        if (glint.life <= 0) { glints.splice(gi, 1); continue; }
        var glintAlpha = glint.life * 0.45;
        var size = glint.size * ease(Math.max(0.12, glint.life));
        var tintR = Math.round(255 - glint.warmth * 16);
        var tintG = Math.round(240 - glint.warmth * 50);
        var tintB = Math.round(205 - glint.warmth * 95);
        ctx.save();
        ctx.translate(glint.x, glint.y);
        ctx.strokeStyle = 'rgba(' + tintR + ',' + tintG + ',' + tintB + ',' + glintAlpha + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.moveTo(-size * 0.65, -size * 0.65);
        ctx.lineTo(size * 0.65, size * 0.65);
        ctx.moveTo(size * 0.65, -size * 0.65);
        ctx.lineTo(-size * 0.65, size * 0.65);
        ctx.stroke();
        ctx.restore();
      }

      if (celebrationFlash > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 198, 92, ' + (celebrationFlash * 0.12) + ')';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      /* Loop */
      if (beerLevel >= 1 && pourActive) {
        pourActive = false;
        celebrationFlash = 1;
        for (var burst = 0; burst < 10; burst++) {
          spawnGlint(glassMidX + rng(-glassHalfTop * 0.7, glassHalfTop * 0.7), H * 0.45 + rng(-70, 70), rng(10, 22), 0.9);
        }
        if (typeof HeatFX !== 'undefined') HeatFX.haptics.success();
        setTimeout(function() {
          beerLevel = 0; pourActive = true;
          drops = []; carbonation = []; glints = []; condensation = [];
        }, 5000);
      }

      if (running) animId = requestAnimationFrame(draw);
    }

    function startPourHaptics() {
      if (pourHapticTimer) return;
      pourHapticTimer = setInterval(function() {
        if (typeof HeatFX !== 'undefined' && pourActive && beerLevel < 0.92) {
          HeatFX.haptics.pourPulse();
        }
      }, 1200);
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
