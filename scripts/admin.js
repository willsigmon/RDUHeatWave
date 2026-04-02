(function() {
  var STORAGE_KEY = 'rdu-admin-passcode';
  var loginShell = document.getElementById('login-shell');
  var reportShell = document.getElementById('report-shell');
  var loginForm = document.getElementById('login-form');
  var passcodeInput = document.getElementById('passcode');
  var loginError = document.getElementById('login-error');
  var reportContent = document.getElementById('report-content');
  var refreshBtn = document.getElementById('refresh-btn');
  var printBtn = document.getElementById('print-btn');
  var lockBtn = document.getElementById('lock-btn');
  var fullscreenBtn = document.getElementById('fullscreen-btn');
  var refreshIndicator = document.getElementById('refresh-indicator');
  var viewButtons = Array.prototype.slice.call(document.querySelectorAll('.view-toggle'));
  var currentView = sessionStorage.getItem('rdu-admin-view') || 'dashboard';
  var lastRefreshedAt = null;
  var refreshIndicatorTimer = null;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setLockedState(isLocked) {
    loginShell.style.display = isLocked ? 'grid' : 'none';
    reportShell.classList.toggle('visible', !isLocked);
  }

  function renderList(items, formatter) {
    if (!items || !items.length) {
      return '<div class="empty">Nothing to show right now.</div>';
    }

    return '<div class="list">' + items.map(formatter).join('') + '</div>';
  }

  function parseNumeric(val) {
    if (val === null || val === undefined) return 0;
    return parseFloat(String(val).replace(/[^0-9.\-]/g, '')) || 0;
  }

  function barCell(value, maxValue) {
    var pct = maxValue > 0 ? Math.round((parseNumeric(value) / maxValue) * 100) : 0;
    pct = Math.min(100, Math.max(0, pct));
    return '<td class="bar-cell" style="--bar-pct:' + pct + '%"><span>' + escapeHtml(value) + '</span></td>';
  }

  function renderSparkline(values, color) {
    if (!values || values.length < 2) return '';
    var w = 80, h = 24, pad = 2;
    var max = Math.max.apply(null, values) || 1;
    var min = Math.min.apply(null, values);
    var range = max - min || 1;
    var points = values.map(function(v, i) {
      var x = pad + (i / (values.length - 1)) * (w - pad * 2);
      var y = h - pad - ((v - min) / range) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var lastPoint = points.split(' ').pop();
    var lastX = lastPoint.split(',')[0];
    var lastY = lastPoint.split(',')[1];
    return '<svg width="' + w + '" height="' + h + '" class="sparkline">' +
      '<polyline points="' + points + '" fill="none" stroke="' + (color || 'rgba(232,88,12,0.7)') + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + lastX + '" cy="' + lastY + '" r="2" fill="' + (color || '#E8580C') + '"/>' +
    '</svg>';
  }

  function renderTable(rows) {
    if (!rows || !rows.length) {
      return '<div class="empty">No weekly data available yet.</div>';
    }

    var maxGuests = Math.max.apply(null, rows.map(function(r) { return parseNumeric(r.guests); }));
    var maxBizChats = Math.max.apply(null, rows.map(function(r) { return parseNumeric(r.bizChats); }));
    var maxReferrals = Math.max.apply(null, rows.map(function(r) { return parseNumeric(r.referrals); }));
    var maxRevenue = Math.max.apply(null, rows.map(function(r) { return parseNumeric(r.revenue); }));

    return '<div class="table-wrap"><table><thead><tr>' +
      '<th>Week</th><th>Guests</th><th>BizChats</th><th>Referrals</th><th>Revenue</th>' +
      '</tr></thead><tbody>' +
      rows.map(function(row) {
        return '<tr>' +
          '<td>' + escapeHtml(row.week) + '</td>' +
          barCell(row.guests, maxGuests) +
          barCell(row.bizChats, maxBizChats) +
          barCell(row.referrals, maxReferrals) +
          barCell(row.revenue, maxRevenue) +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function renderDelta(current, previous) {
    var curr = parseNumeric(current);
    var prev = parseNumeric(previous);
    if (!prev || isNaN(curr) || isNaN(prev)) return '';
    var pct = Math.round(((curr - prev) / Math.abs(prev)) * 100);
    if (pct === 0) return '';
    var up = pct > 0;
    return '<span class="delta ' + (up ? 'delta-up' : 'delta-down') + '">' +
      (up ? '↑' : '↓') + ' ' + Math.abs(pct) + '%' +
    '</span>';
  }

  function renderPresenterStatGrid(items) {
    return '<div class="presenter-stat-grid">' + items.map(function(item) {
      return '<div class="presenter-stat">' +
        '<div class="mini-label">' + escapeHtml(item.label) + '</div>' +
        '<div class="presenter-stat-value">' + escapeHtml(item.value) + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function setView(view) {
    currentView = view === 'presenter' ? 'presenter' : 'dashboard';
    sessionStorage.setItem('rdu-admin-view', currentView);

    Array.prototype.forEach.call(document.querySelectorAll('.report-view'), function(node) {
      node.classList.toggle('active', node.getAttribute('data-view') === currentView);
    });

    viewButtons.forEach(function(button) {
      button.classList.toggle('is-active', button.getAttribute('data-view') === currentView);
    });
  }

  function renderReport(report) {
    reportContent.className = '';
    reportContent.innerHTML =
      '<div class="report-view" data-view="dashboard">' +
        '<div class="card hero-stat-card" style="margin-bottom:16px; background: linear-gradient(135deg, rgba(232,88,12,0.12) 0%, rgba(232,88,12,0.04) 100%); border-left:3px solid var(--color-primary);">' +
          '<div class="section-label" style="color:var(--color-primary);font-weight:700;">Last Week — ' + escapeHtml(report.lastWeek.label) + '</div>' +
          '<div class="snapshot-grid" style="margin-top:8px">' +
            '<div class="snapshot-item"><div class="mini-label">Guests</div><div class="snapshot-value">' + escapeHtml(report.lastWeek.guests) + '</div></div>' +
            '<div class="snapshot-item"><div class="mini-label">BizChats</div><div class="snapshot-value">' + escapeHtml(report.lastWeek.bizChats) + '</div></div>' +
            '<div class="snapshot-item"><div class="mini-label">Referrals</div><div class="snapshot-value">' + escapeHtml(report.lastWeek.referrals) + '</div></div>' +
            '<div class="snapshot-item"><div class="mini-label">Revenue</div><div class="snapshot-value">' + escapeHtml(report.lastWeek.closedRevenue) + '</div></div>' +
          '</div>' +
        '</div>' +

        '<div class="card hero-stat-card" style="margin-bottom:16px; background: linear-gradient(135deg, rgba(255,215,0,0.10) 0%, rgba(255,215,0,0.03) 100%); border-left:3px solid rgba(255,215,0,0.7);">' +
          '<div class="section-label" style="color:rgba(255,215,0,0.85);font-weight:700;">Rolling 12 Months</div>' +
          '<div class="snapshot-grid" style="margin-top:8px">' +
            '<div class="snapshot-item"><div class="mini-label">Guests</div><div class="snapshot-value">' + escapeHtml(report.kpis.guestsHosted) + '</div></div>' +
            '<div class="snapshot-item"><div class="mini-label">BizChats</div><div class="snapshot-value">' + escapeHtml(report.kpis.bizChats) + '</div></div>' +
            '<div class="snapshot-item"><div class="mini-label">Referrals</div><div class="snapshot-value">' + escapeHtml(report.kpis.referrals) + '</div></div>' +
            '<div class="snapshot-item"><div class="mini-label">Revenue</div><div class="snapshot-value">' + escapeHtml(report.kpis.closedRevenue) + '</div></div>' +
          '</div>' +
        '</div>' +

        '<div class="card" style="margin-bottom:16px;">' +
          '<div class="section-label">Recent weeks</div>' +
          '<h2>Trend line</h2>' +
          (function() {
            var weeks = report.recentWeeks;
            if (weeks && weeks.length >= 2) {
              var ordered = weeks.slice().reverse();
              var guests   = ordered.map(function(r) { return parseNumeric(r.guests); });
              var bizChats = ordered.map(function(r) { return parseNumeric(r.bizChats); });
              var refs     = ordered.map(function(r) { return parseNumeric(r.referrals); });
              var rev      = ordered.map(function(r) { return parseNumeric(r.revenue); });
              return '<div class="sparkline-row">' +
                '<div class="sparkline-item">' + renderSparkline(guests,   'rgba(232,88,12,0.8)')  + '<span class="sparkline-item-label">Guests</span></div>' +
                '<div class="sparkline-item">' + renderSparkline(bizChats, 'rgba(107,204,244,0.8)') + '<span class="sparkline-item-label">BizChats</span></div>' +
                '<div class="sparkline-item">' + renderSparkline(refs,     'rgba(91,168,71,0.8)')   + '<span class="sparkline-item-label">Referrals</span></div>' +
                '<div class="sparkline-item">' + renderSparkline(rev,      'rgba(255,215,0,0.8)')   + '<span class="sparkline-item-label">Revenue</span></div>' +
              '</div>';
            }
            return '';
          })() +
          renderTable(report.recentWeeks) +
        '</div>' +

        '<div class="two-col">' +
          '<div class="card">' +
            '<div class="section-label">Leaderboard</div>' +
            '<h2>Top guest hosts</h2>' +
            renderList(report.leaders.guestHosts, function(item, index) {
              return '<div class="list-item">' +
                '<div class="list-main"><div class="rank">' + (index + 1) + '</div><div class="list-text"><strong>' + escapeHtml(item.name) + '</strong><span>Guest points / hosted guests</span></div></div>' +
                '<div class="list-value">' + escapeHtml(item.value) + '</div>' +
              '</div>';
            }) +
          '</div>' +

          '<div class="card">' +
            '<div class="section-label">Leaderboard</div>' +
            '<h2>Top BizChat activity</h2>' +
            renderList(report.leaders.bizChats, function(item, index) {
              return '<div class="list-item">' +
                '<div class="list-main"><div class="rank">' + (index + 1) + '</div><div class="list-text"><strong>' + escapeHtml(item.name) + '</strong><span>Total BizChats logged</span></div></div>' +
                '<div class="list-value">' + escapeHtml(item.value) + '</div>' +
              '</div>';
            }) +
          '</div>' +
        '</div>' +

        '<div class="two-col" style="margin-top:16px;">' +
          '<div class="card">' +
            '<div class="section-label">Attendance</div>' +
            '<h2>Watchlist</h2>' +
            renderList(report.attendanceWatchlist, function(item) {
              return '<div class="list-item">' +
                '<div class="list-text"><strong>' + escapeHtml(item.name) + '</strong><span>' +
                'Unexcused: ' + escapeHtml(item.unexcused) + ' • Excused: ' + escapeHtml(item.excused) + ' • Subs: ' + escapeHtml(item.sub) +
                '</span></div>' +
                '<div class="list-value">' + escapeHtml(item.totalFlags) + '</div>' +
              '</div>';
            }) +
          '</div>' +

          '<div class="card">' +
            '<div class="section-label">Revenue</div>' +
            '<h2>Recent closed business</h2>' +
            renderList(report.recentClosedDeals, function(item) {
              return '<div class="list-item">' +
                '<div class="list-text"><strong>' + escapeHtml(item.prospect || 'Closed deal') + '</strong><span>' +
                escapeHtml(item.dateLabel) + ' • ' + escapeHtml(item.from) + ' → ' + escapeHtml(item.to) +
                '</span></div>' +
                '<div class="list-value">' + escapeHtml(item.revenue) + '</div>' +
              '</div>';
            }) +
          '</div>' +
        '</div>' +

        (report.referralSpotlight && report.referralSpotlight.length ?
          '<div class="card" style="margin-top:16px; border-left: 3px solid var(--color-primary);">' +
            '<div class="section-label">Referral Spotlight</div>' +
            '<h2>This week\'s highlights</h2>' +
            '<p class="muted" style="margin:-4px 0 12px;font-size:0.85rem;">3 random closed referrals — refreshes each load. Great for shout-outs.</p>' +
            renderList(report.referralSpotlight, function(item) {
              return '<div class="list-item">' +
                '<div class="list-text"><strong>' + escapeHtml(item.from) + ' → ' + escapeHtml(item.to) + '</strong><span>' +
                escapeHtml(item.dateLabel) + ' • ' + escapeHtml(item.prospect) +
                '</span></div>' +
                '<div class="list-value">' + escapeHtml(item.revenue) + '</div>' +
              '</div>';
            }) +
          '</div>'
        : '') +

        '<div class="footer-note">Generated from the live published reports and referral pipeline. Good for quick reads; still not a replacement for deep spreadsheet surgery.</div>' +
      '</div>' +

      '<div class="report-view presenter-view" data-view="presenter">' +
        '<div class="teleprompter-card">' +
          '<div class="section-label">Presenter mode</div>' +
          '<h2>Read this like a team-selling report</h2>' +
          '<p>' + escapeHtml(report.presenter.guidance) + '</p>' +
        '</div>' +

        '<div class="teleprompter-card">' +
          '<div class="section-label">Last week</div>' +
          '<h2>' + escapeHtml(report.lastWeek.label) + '</h2>' +
          renderPresenterStatGrid(report.presenter.lastWeekStats) +
        '</div>' +

        '<div class="teleprompter-card">' +
          '<div class="section-label">Rolling 12 months</div>' +
          '<h2>Big picture</h2>' +
          renderPresenterStatGrid(report.presenter.rollingStats) +
        '</div>' +

        '<div class="teleprompter-card">' +
          '<div class="section-label">Teleprompter</div>' +
          '<h2>Readout copy</h2>' +
          '<div class="teleprompter-lines">' +
            report.presenter.scriptLines.map(function(line) {
              return '<div class="teleprompter-line">' + escapeHtml(line) + '</div>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>';

    setView(currentView);
    startRefreshIndicator();
  }

  async function loadReport(passcode) {
    reportContent.className = 'loading';
    reportContent.textContent = 'Loading report…';
    loginError.textContent = '';

    var response = await fetch('/api/admin-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Passcode': passcode
      },
      body: JSON.stringify({ passcode: passcode })
    });

    var payload = await response.json().catch(function() {
      return null;
    });

    if (!response.ok || !payload || payload.status !== 'ok') {
      throw new Error((payload && payload.message) || 'Could not unlock admin report');
    }

    sessionStorage.setItem(STORAGE_KEY, passcode);
    setLockedState(false);
    renderReport(payload.report);
  }

  loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    var passcode = passcodeInput.value.trim();
    if (!passcode) {
      loginError.textContent = 'Enter the passcode first.';
      return;
    }

    try {
      await loadReport(passcode);
    } catch (error) {
      loginError.textContent = error.message || 'Could not unlock admin report.';
    }
  });

  refreshBtn.addEventListener('click', function() {
    var passcode = sessionStorage.getItem(STORAGE_KEY) || '';
    if (!passcode) {
      setLockedState(true);
      return;
    }

    loadReport(passcode).catch(function(error) {
      reportContent.className = 'error';
      reportContent.textContent = error.message || 'Could not refresh admin report.';
    });
  });

  lockBtn.addEventListener('click', function() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('rdu-admin-view');
    passcodeInput.value = '';
    reportContent.innerHTML = '';
    if (refreshIndicatorTimer) { clearInterval(refreshIndicatorTimer); refreshIndicatorTimer = null; }
    lastRefreshedAt = null;
    refreshIndicator.textContent = '';
    setLockedState(true);
  });

  viewButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      setView(button.getAttribute('data-view'));
    });
  });

  fullscreenBtn.addEventListener('click', function() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function() {});
      return;
    }

    document.exitFullscreen().catch(function() {});
  });

  printBtn.addEventListener('click', function() {
    window.print();
  });

  function updateRefreshIndicator() {
    if (!lastRefreshedAt) {
      refreshIndicator.textContent = '';
      return;
    }

    var elapsed = Math.floor((Date.now() - lastRefreshedAt) / 1000);
    var mins = Math.floor(elapsed / 60);
    var label = mins === 0
      ? 'Last refreshed: just now'
      : 'Last refreshed: ' + mins + ' min ago';

    refreshIndicator.textContent = label;
    refreshIndicator.classList.toggle('stale', mins >= 10);
  }

  function startRefreshIndicator() {
    lastRefreshedAt = Date.now();
    updateRefreshIndicator();

    if (refreshIndicatorTimer) clearInterval(refreshIndicatorTimer);
    refreshIndicatorTimer = setInterval(updateRefreshIndicator, 60000);
  }

  var savedPasscode = sessionStorage.getItem(STORAGE_KEY);
  if (savedPasscode) {
    setLockedState(false);
    loadReport(savedPasscode).catch(function() {
      sessionStorage.removeItem(STORAGE_KEY);
      setLockedState(true);
    });
  } else {
    setLockedState(true);
  }
})();
