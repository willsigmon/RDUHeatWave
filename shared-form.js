// shared-form.js — shared check-in form logic for index.html and kiosk.html
// Plain vanilla JS, no modules. Exposes window.initCheckinForm.
// All dynamic HTML is built using escapeHtml() on every interpolated value (XSS-safe).
//
// Usage:
//   initCheckinForm({ formId: 'checkin-form', isKiosk: false })
//   initCheckinForm({ formId: 'checkin-form', isKiosk: true, resetTimeoutMs: 15000 })

(function(global) {
  'use strict';

  // ===== CONSTANTS =====
  var FORM_ENDPOINT = '/api/checkin';
  var FORM_TIMEOUT_MS = 12000;
  var MAX_LOCAL_ENTRIES = 250;

  var DEFAULT_TEAM_MEMBERS = [
    { name: 'Carter Helms', title: 'Team Chair', profession: 'Community Insurance Agent', company: 'Highstreet Ins & Financial Svcs', website: 'https://carterhelms.com', leader: true },
    { name: 'Craig Morrill', title: 'Vice Chair', profession: 'Financial Advisor', company: 'Summit Global Investments', website: 'https://sgiam.com', leader: true },
    { name: 'Will Sigmon', title: 'Team Admin', profession: 'Software & Creative', company: 'Will Sigmon Media Co.', website: 'https://willsigmon.media', leader: true },
    { name: 'Rusty Sutton', title: 'Team Marketing Specialist', profession: 'Digital Marketing', company: 'MonkeyFans Creative', website: 'https://monkeyfansraleigh.com/about', leader: false, specialTitle: true },
    { name: 'Robert Courts', title: 'Mortgage Lending', company: 'Advantage Lending', website: 'https://advantagelending.com/mortgage-loan-services', leader: false },
    { name: 'Dana Walsh', title: 'Magazine Publisher', company: 'Stroll Magazine', website: 'https://strollmag.com/locations/hayes-barton-nc', leader: false },
    { name: 'Nathan Senn', title: 'Property Restoration', company: 'Franco Restorations', website: 'https://francorestorations.com', leader: false },
    { name: 'Roni Payne', title: 'Accounting / Tax', company: 'R. Payne LLC', website: 'https://rpayne.org/about', leader: false },
    { name: 'Shannida Ramsey', title: 'Property Maintenance', company: 'Ram-Z Services LLC', website: 'https://ramzservices.com', leader: false },
    { name: 'David Mercado', title: 'HOA Management', company: 'William Douglas Management', website: 'https://wmdouglas.com/raleigh-hoa-management', leader: false },
    { name: 'Sue Kerata', title: 'Realtor', company: 'Century 21 Triangle Group', website: 'https://suekhomes.com', leader: false }
  ];

  var INDUSTRIES = [
    'Accounting', 'Architecture', 'Auto Sales', 'Banking', 'Business Consulting',
    'Chiropractic', 'Commercial Real Estate', 'Construction', 'Copywriting',
    'Cyber Security', 'Dental', 'Education', 'Electrical', 'Event Planning',
    'Financial Planning', 'Fitness & Wellness', 'Graphic Design', 'Healthcare',
    'Home Inspection', 'Home Services', 'HVAC', 'Insurance', 'Interior Design',
    'IT Services', 'Landscaping', 'Legal', 'Lending & Mortgage', 'Marketing',
    'Massage Therapy', 'Media & Video', 'Mental Health', 'Nonprofit',
    'Nutrition', 'Painting', 'Pest Control', 'Pet Services', 'Photography',
    'Physical Therapy', 'Plumbing', 'Printing', 'Property Management',
    'Property Restoration', 'Publishing', 'Real Estate', 'Recruiting',
    'Roofing', 'Solar Energy', 'Staffing', 'Tax Preparation', 'Technology',
    'Travel', 'Veterinary', 'Wealth Management', 'Web Development'
  ];

  // ===== UTILITY =====
  // escapeHtml is applied to every dynamic value before building markup strings.
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function keepLatestLocalEntries(entries) {
    return entries.slice(-MAX_LOCAL_ENTRIES);
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof AbortController === 'undefined') {
      return fetch(url, options);
    }
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);
    var requestOptions = Object.assign({}, options, { signal: controller.signal });
    return fetch(url, requestOptions).finally(function() { clearTimeout(timeoutId); });
  }

  // ===== LOCAL BACKUP =====
  function saveToLocal(data) {
    try {
      var entries = JSON.parse(localStorage.getItem('heatwave_entries') || '[]');
      var savedEntry = Object.assign({}, data, {
        timestamp: new Date().toISOString(),
        synced: false
      });
      entries.push(savedEntry);
      localStorage.setItem('heatwave_entries', JSON.stringify(keepLatestLocalEntries(entries)));
      return savedEntry;
    } catch(e) { return null; }
  }

  function markLocalEntrySynced(timestamp) {
    if (!timestamp) return;
    try {
      var entries = JSON.parse(localStorage.getItem('heatwave_entries') || '[]');
      var updatedEntries = entries.map(function(entry) {
        if (entry.timestamp === timestamp) {
          return Object.assign({}, entry, { synced: true });
        }
        return entry;
      });
      localStorage.setItem('heatwave_entries', JSON.stringify(keepLatestLocalEntries(updatedEntries)));
    } catch(e) { /* storage unavailable */ }
  }

  function getLocalEntries() {
    try { return JSON.parse(localStorage.getItem('heatwave_entries') || '[]'); }
    catch(e) { return []; }
  }

  function exportCSV() {
    var entries = getLocalEntries();
    if (!entries.length) { alert('No local entries saved.'); return; }
    var header = 'Timestamp,First Name,Last Name,Profession,Company Name,Phone,Email,Guest Of,Ideal Referral\n';
    var rows = entries.map(function(e) {
      return [e.timestamp, e.firstName, e.lastName, e.profession, e.companyName, e.phone, e.email, e.guestOf, e.idealReferral]
        .map(function(v) { return '"' + (v || '').replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob([header + rows], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'heatwave-entries-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  }

  global.exportCSV = exportCSV;
  global.getLocalEntries = getLocalEntries;

  // ===== CONFETTI =====
  function launchConfetti(canvas) {
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var particles = [];
    var colors = ['#E8580C', '#FF6A1E', '#f0e6dc', '#C44A0A', '#FFB347', '#F5A623'];

    for (var i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        w: 4 + Math.random() * 6,
        h: 4 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1
      });
    }

    var startTime = Date.now();

    function animate() {
      var elapsed = Date.now() - startTime;
      if (elapsed > 3500) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(function(p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.rot += p.rotSpeed;
        if (elapsed > 2500) {
          p.opacity = Math.max(0, 1 - (elapsed - 2500) / 1000);
        }
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  // ===== INIT =====
  /**
   * Wire up the check-in form.
   * @param {Object}   config
   * @param {string}   config.formId            - id of the <form> element (default: 'checkin-form')
   * @param {boolean}  [config.isKiosk]         - true: auto-reset, welcome toast, personalized success title
   * @param {number}   [config.resetTimeoutMs]  - ms before auto-reset after success (kiosk only, default 15000)
   * @param {Function} [config.onReset]         - called after reset; use for page-specific UI teardown
   * @param {Function} [config.onSuccess]       - called after success shown; receives {localOnly, reason}
   * @param {Function} [config.onMembersLoaded] - called when live roster loads; receives updated TEAM_MEMBERS
   */
  function initCheckinForm(config) {
    var isKiosk = !!(config && config.isKiosk);
    var resetTimeoutMs = (config && config.resetTimeoutMs) || 15000;
    var onReset = (config && typeof config.onReset === 'function') ? config.onReset : null;
    var onSuccess = (config && typeof config.onSuccess === 'function') ? config.onSuccess : null;
    var onMembersLoaded = (config && typeof config.onMembersLoaded === 'function') ? config.onMembersLoaded : null;
    var formId = (config && config.formId) || 'checkin-form';

    var TEAM_MEMBERS = DEFAULT_TEAM_MEMBERS.slice();

    // ===== DOM REFS =====
    var form = document.getElementById(formId);
    if (!form) return;

    var submitBtn = document.getElementById('submit-btn');
    var successScreen = document.getElementById('success-screen');
    var successTitle = document.getElementById('success-title');
    var successSubtitle = document.getElementById('success-subtitle');
    var resetBtn = document.getElementById('reset-btn');
    var confettiCanvas = document.getElementById('confetti-canvas');
    var companyWebsite = document.getElementById('companyWebsite');
    var guestPicker = document.getElementById('guestOf-picker');
    var guestQuickPicks = document.getElementById('guestOf-quick');
    var guestSearchInput = document.getElementById('guestOfSearch');
    var guestResults = document.getElementById('guestOf-results');
    var guestOfHidden = document.getElementById('guestOf');
    var professionInput = document.getElementById('profession');
    var professionResults = document.getElementById('profession-results');
    var kioskToast = document.getElementById('kiosk-toast');
    var toastNameEl = document.getElementById('toast-name');
    var kioskFormHeader = document.querySelector('.kiosk-form-header');

    var defaultSuccessTitle = 'Welcome to the Heatwave!';
    var defaultSuccessSubtitle = 'Your registration has been submitted. We look forward to connecting with you.';
    var localOnlySuccessTitle = 'Saved on this device';
    var localOnlySuccessSubtitle = 'Google Sheets is not connected yet, so this check-in is stored locally on this device only.';
    var syncFailedSuccessSubtitle = 'We saved this check-in on this device, but the Google Sheets sync did not complete.';
    var submitFailedTitle = 'We could not confirm your check-in';
    var submitFailedSubtitle = 'This browser could not save a local backup, and the network sync did not complete. Please try again or ask the host to retry.';

    var fields = ['firstName', 'lastName', 'profession', 'phone', 'email', 'guestOf'];
    var optionalFields = ['companyName', 'idealReferral'];
    var allFields = fields.concat(optionalFields);

    var toastTimer = null;
    var autoResetTimer = null;

    window.addEventListener('resize', function() {
      if (confettiCanvas) {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
      }
    });

    // ===== PROFESSION AUTOCOMPLETE =====
    function getProfessionMatches(query) {
      var q = query.trim().toLowerCase();
      if (!q) return [];
      return INDUSTRIES.filter(function(i) { return i.toLowerCase().indexOf(q) !== -1; }).slice(0, 6);
    }

    function renderProfessionResults() {
      if (!professionInput || !professionResults) return;
      var matches = getProfessionMatches(professionInput.value);
      if (!matches.length || professionInput.value.trim().toLowerCase() === matches[0].toLowerCase()) {
        professionResults.innerHTML = '';
        return;
      }
      professionResults.innerHTML = matches.map(function(industry) {
        var s = escapeHtml(industry);
        return '<button type="button" class="profession-result" data-value="' + s + '">' + s + '</button>';
      }).join('');
    }

    if (professionInput && professionResults) {
      professionInput.addEventListener('input', function() { renderProfessionResults(); });
      professionInput.addEventListener('focus', function() {
        if (professionInput.value.trim()) renderProfessionResults();
      });
      professionInput.addEventListener('blur', function() {
        window.setTimeout(function() { professionResults.innerHTML = ''; }, 120);
      });
      professionResults.addEventListener('click', function(event) {
        var button = event.target.closest('.profession-result');
        if (!button) return;
        professionInput.value = button.getAttribute('data-value');
        professionResults.innerHTML = '';
        professionInput.blur();
        validateField('profession');
      });
    }

    // ===== GUEST OF PICKER =====
    function normalizeGuestValue(value) {
      return String(value || '').trim().toLowerCase();
    }

    function findGuestMember(value) {
      var norm = normalizeGuestValue(value);
      if (!norm) return null;
      return TEAM_MEMBERS.find(function(m) { return normalizeGuestValue(m.name) === norm; }) || null;
    }

    function syncGuestQuickPicks() {
      if (!guestQuickPicks) return;
      var selected = guestQuickPicks.getAttribute('data-selected-option') || '';
      guestQuickPicks.querySelectorAll('.guest-chip').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-value') === selected);
      });
    }

    function renderGuestQuickPicks() {
      if (!guestQuickPicks) return;
      var chips = isKiosk
        ? TEAM_MEMBERS
        : TEAM_MEMBERS.filter(function(m) { return m.leader && !m.specialTitle; });
      guestQuickPicks.innerHTML = chips.map(function(m) {
        var extra = (isKiosk && m.leader) ? ' guest-chip--leader' : '';
        var s = escapeHtml(m.name);
        return '<button type="button" class="guest-chip' + extra + '" data-value="' + s + '">' + s + '</button>';
      }).join('') + '<button type="button" class="guest-chip guest-chip--other" data-value="Other">Someone Else</button>';
      syncGuestQuickPicks();
    }

    function getGuestMatches(query) {
      var norm = normalizeGuestValue(query);
      if (!norm) return [];
      return TEAM_MEMBERS.filter(function(m) {
        return [m.name, m.title, m.company].some(function(p) {
          return normalizeGuestValue(p).indexOf(norm) !== -1;
        });
      }).slice(0, 6);
    }

    function renderGuestResults() {
      if (!guestSearchInput || !guestResults || !guestOfHidden) return;
      var query = guestSearchInput.value.trim();
      if (!query) { guestResults.innerHTML = ''; return; }
      var selected = guestOfHidden.value;
      guestResults.innerHTML = getGuestMatches(query).map(function(m) {
        var cls = m.name === selected ? ' active' : '';
        var sn = escapeHtml(m.name), st = escapeHtml(m.title), sc = escapeHtml(m.company || '');
        return '<button type="button" class="guest-result' + cls + '" data-value="' + sn + '">' +
          '<span class="guest-result-name">' + sn + '</span>' +
          '<span class="guest-result-meta">' + st + ' &bull; ' + sc + '</span>' +
        '</button>';
      }).join('');
    }

    function setGuestSelection(value, options) {
      if (!guestOfHidden || !guestSearchInput || !guestQuickPicks) return;
      var next = String(value || '').trim();
      var match = findGuestMember(next);
      var isCustom = !!(next && !match);
      guestOfHidden.value = match ? match.name : next;
      if (!options || !options.keepTypedValue) guestSearchInput.value = guestOfHidden.value;
      guestQuickPicks.setAttribute('data-selected-option',
        match && match.leader ? match.name : (isCustom ? 'Other' : ''));
      syncGuestQuickPicks();
      renderGuestResults();
      validateField('guestOf');
    }

    renderGuestQuickPicks();

    fetchWithTimeout('/api/members', { method: 'GET' }, 5000)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status !== 'ok' || !Array.isArray(data.members) || !data.members.length) return;
        TEAM_MEMBERS = data.members;
        renderGuestQuickPicks();
        if (onMembersLoaded) onMembersLoaded(TEAM_MEMBERS);
      })
      .catch(function() { /* static fallback already rendered */ });

    if (guestQuickPicks) {
      guestQuickPicks.addEventListener('click', function(event) {
        var btn = event.target.closest('.guest-chip');
        if (!btn) return;
        var val = btn.getAttribute('data-value');
        if (val === 'Other') {
          guestQuickPicks.setAttribute('data-selected-option', 'Other');
          guestOfHidden.value = guestSearchInput.value.trim();
          syncGuestQuickPicks();
          guestSearchInput.focus();
          validateField('guestOf');
          return;
        }
        setGuestSelection(val);
      });
    }

    if (guestSearchInput) {
      guestSearchInput.addEventListener('focus', function() { renderGuestResults(); });
      guestSearchInput.addEventListener('input', function() {
        setGuestSelection(this.value, { keepTypedValue: true });
      });
      guestSearchInput.addEventListener('blur', function() {
        window.setTimeout(function() {
          guestResults.innerHTML = '';
          setGuestSelection(guestSearchInput.value);
        }, 120);
      });
    }

    if (guestResults) {
      guestResults.addEventListener('click', function(event) {
        var btn = event.target.closest('.guest-result');
        if (!btn) return;
        setGuestSelection(btn.getAttribute('data-value'));
        guestResults.innerHTML = '';
        guestSearchInput.blur();
      });
    }

    // ===== VALIDATION =====
    function validateField(name) {
      var input = document.getElementById(name);
      var errorEl = document.getElementById(name + '-error');
      var valid = true;

      if (name === 'guestOf') {
        valid = !!(guestOfHidden && guestOfHidden.value.trim());
        if (guestPicker) guestPicker.classList.toggle('error', !valid);
        if (guestSearchInput) guestSearchInput.classList.toggle('error', !valid);
        if (errorEl) errorEl.classList.toggle('visible', !valid);
        return valid;
      }

      if (!input) return true;

      if (input.type === 'hidden') {
        valid = !!input.value.trim();
        if (errorEl) errorEl.classList.toggle('visible', !valid);
        return valid;
      }

      if (optionalFields.indexOf(name) !== -1 && !input.value.trim()) {
        input.classList.remove('error');
        if (errorEl) errorEl.classList.remove('visible');
        return true;
      }

      if (!input.value.trim()) valid = false;

      if (name === 'email' && input.value.trim()) {
        valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
      }

      if (valid) {
        input.classList.remove('error');
        if (errorEl) errorEl.classList.remove('visible');
      } else {
        input.classList.add('error');
        if (errorEl) errorEl.classList.add('visible');
      }

      return valid;
    }

    function validateAll() {
      var ok = true;
      fields.forEach(function(name) { if (!validateField(name)) ok = false; });
      return ok;
    }

    allFields.forEach(function(name) {
      if (name === 'guestOf') return;
      var input = document.getElementById(name);
      if (!input || input.type === 'hidden') return;
      input.addEventListener('blur', function() {
        if (input.value.trim() || fields.indexOf(name) !== -1) validateField(name);
      });
      input.addEventListener('change', function() { validateField(name); });
      input.addEventListener('input', function() {
        if (input.classList.contains('error')) validateField(name);
      });
    });

    // ===== SUCCESS / ERROR =====
    function hideForm() {
      form.style.display = 'none';
      if (kioskFormHeader) kioskFormHeader.style.display = 'none';
    }

    function showWelcomeToast(firstName) {
      if (!kioskToast || !toastNameEl || !firstName) return;
      toastNameEl.textContent = 'WELCOME, ' + firstName.toUpperCase() + '!';
      kioskToast.classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function() { kioskToast.classList.remove('visible'); }, 8000);
    }

    function showSuccess(options) {
      var localOnly = !!(options && options.localOnly);
      var reason = options && options.reason;
      var firstName = (document.getElementById('firstName').value || '').trim();
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;

      if (isKiosk) {
        successTitle.textContent = localOnly
          ? localOnlySuccessTitle
          : ('Welcome, ' + (firstName || 'Guest') + '!');
        successSubtitle.textContent = localOnly
          ? (reason === 'sync-failed' ? syncFailedSuccessSubtitle : localOnlySuccessSubtitle)
          : 'You\u2019re all set. Grab a seat, introduce yourself to someone new, and get ready \u2014 we kick off at 4:00!';
      } else {
        successTitle.textContent = localOnly ? localOnlySuccessTitle : defaultSuccessTitle;
        successSubtitle.textContent = localOnly
          ? (reason === 'sync-failed' ? syncFailedSuccessSubtitle : localOnlySuccessSubtitle)
          : defaultSuccessSubtitle;
      }

      hideForm();
      successScreen.style.display = 'flex';
      if (confettiCanvas) launchConfetti(confettiCanvas);

      if (isKiosk) {
        showWelcomeToast(firstName);
        clearTimeout(autoResetTimer);
        autoResetTimer = setTimeout(function() {
          if (resetBtn) resetBtn.click();
        }, resetTimeoutMs);
      }

      if (onSuccess) onSuccess({ localOnly: localOnly, reason: reason });
    }

    function showSubmissionIssue() {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      successTitle.textContent = submitFailedTitle;
      successSubtitle.textContent = submitFailedSubtitle;
      hideForm();
      successScreen.style.display = 'flex';
    }

    // ===== SUBMIT =====
    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        try {
          if (!validateAll()) {
            var firstError = form.querySelector('.field-input.error');
            if (firstError) firstError.focus();
            return;
          }

          submitBtn.classList.add('loading');
          submitBtn.disabled = true;

          var entry = {};
          allFields.forEach(function(name) {
            entry[name] = document.getElementById(name).value.trim();
          });

          var savedEntry = saveToLocal(entry);

          fetchWithTimeout(FORM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: new URLSearchParams(Object.assign({}, entry, {
              companyWebsite: companyWebsite ? companyWebsite.value.trim() : ''
            })).toString()
          }, FORM_TIMEOUT_MS).then(function(response) {
            if (!response.ok) throw new Error('submit-failed');
            return response.json();
          }).then(function(result) {
            if (!result || result.status !== 'ok') throw new Error('submit-failed');
            markLocalEntrySynced(savedEntry && savedEntry.timestamp);
            showSuccess();
          }).catch(function() {
            if (savedEntry) {
              showSuccess({ localOnly: true, reason: 'sync-failed' });
              return;
            }
            showSubmissionIssue();
          });
        } catch(err) {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
        }
      });
    }

    // ===== RESET =====
    function doReset() {
      clearTimeout(autoResetTimer);
      if (kioskToast) kioskToast.classList.remove('visible');

      successScreen.style.display = 'none';
      form.style.display = 'flex';
      if (kioskFormHeader) kioskFormHeader.style.display = 'block';

      form.reset();
      if (guestOfHidden) guestOfHidden.value = '';
      if (guestSearchInput) guestSearchInput.value = '';
      if (guestResults) guestResults.innerHTML = '';
      if (guestQuickPicks) guestQuickPicks.setAttribute('data-selected-option', '');
      if (companyWebsite) companyWebsite.value = '';
      successTitle.textContent = defaultSuccessTitle;
      successSubtitle.textContent = defaultSuccessSubtitle;

      allFields.forEach(function(name) {
        var input = document.getElementById(name);
        var errorEl = document.getElementById(name + '-error');
        if (input) { input.value = ''; input.classList.remove('error'); }
        if (errorEl) errorEl.classList.remove('visible');
      });

      syncGuestQuickPicks();
      if (guestPicker) guestPicker.classList.remove('error');
      if (guestSearchInput) guestSearchInput.classList.remove('error');

      var firstEl = document.getElementById('firstName');
      if (firstEl) firstEl.focus();

      if (onReset) onReset();
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', doReset);
    }
  }

  global.initCheckinForm = initCheckinForm;

})(window);
