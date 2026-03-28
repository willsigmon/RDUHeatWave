(function () {
  'use strict';

  const ALL_TABS = [
    {
      section: 'People',
      tabs: [
        { sheet: 'Membership Directory', label: 'Members', summary: 'Primary member roster, contact details, and internal directory notes.' },
        { sheet: 'Applications', label: 'Applications', summary: 'Prospects moving toward membership, with status and follow-up context.' },
        { sheet: 'Guest Check In', label: 'Check-Ins', summary: 'Front-door guest attendance and visit history.' }
      ]
    },
    {
      section: 'Performance',
      tabs: [
        { sheet: 'Guest Incentive Report', label: 'Guest Incentive', summary: 'Guest activity and incentive momentum across the current reporting window.', readOnlyCols: ['weekly total points', 'total'], hasTotalsRow: true },
        { sheet: 'BizChats Report', label: 'BizChats', summary: 'BizChat pace, participation, and totals for the team.', readOnlyCols: ['weekly total'], hasTotalsRow: true },
        { sheet: 'Referral Pipeline', label: 'Referrals', summary: 'Active referrals, pipeline status, and handoff visibility.', hasTotalsRow: false },
        { sheet: 'Revenue Report', label: 'Revenue', summary: 'Closed business and recorded value coming through the network.', readOnlyCols: ['weekly total given', 'rcvd'], hasTotalsRow: true },
        { sheet: 'Attendance Report', label: 'Attendance', summary: 'Weekly attendance health and consistency across the team.', hasTotalsRow: true }
      ]
    },
    {
      section: 'Feedback',
      tabs: [
        { sheet: 'Survey Responses', label: 'Surveys', summary: 'Member and visitor feedback captured through team surveys.' }
      ]
    },
    {
      section: 'Archive',
      tabs: [
        { sheet: 'Team Stats', label: 'Team Stats (Legacy)', summary: 'Historical totals and legacy reporting snapshots.' },
        { sheet: 'Team Stats 2026', label: 'Team Stats 2026', summary: 'Current-year stats workbook for the active team cycle.' },
        { sheet: 'BKP Member Directory', label: 'Backup Directory', summary: 'Protected backup of member directory records.' }
      ]
    }
  ];

  const SHEET_ID = '1WWSxfqJ1UdMqJxKLaiIzb06n3rSQj5-AVN3m07wAkSA';
  const APPS_SCRIPT_URL = '/api/crm';
  const SEARCH_DEBOUNCE_MS = 180;

  const state = {
    userPin: '',
    currentUser: null,
    activeTab: null,
    currentData: null,
    sortCol: -1,
    sortAsc: true,
    searchQuery: '',
    editingCell: null
  };

  const refs = {
    loginGate: document.getElementById('login-gate'),
    loginForm: document.getElementById('login-form'),
    loginButton: document.querySelector('#login-form button[type="submit"]'),
    pinInput: document.getElementById('pin-input'),
    loginError: document.getElementById('login-error'),
    app: document.getElementById('app'),
    sidebar: document.getElementById('sidebar'),
    tableArea: document.getElementById('table-area'),
    tabName: document.getElementById('topbar-tab-name'),
    modeChip: document.getElementById('topbar-mode-chip'),
    searchInput: document.getElementById('search-input'),
    status: document.getElementById('topbar-status'),
    user: document.getElementById('topbar-user'),
    toast: document.getElementById('toast'),
    hamburger: document.getElementById('hamburger-btn'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    main: document.getElementById('crm-main')
  };

  const formatInteger = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const formatCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  let toastTimer = 0;
  let searchTimer = 0;

  setShellMode('login');
  bindEvents();
  maybeFocusPin();

  function bindEvents() {
    refs.loginForm.addEventListener('submit', handleLoginSubmit);

    refs.hamburger.addEventListener('click', function () {
      refs.sidebar.classList.toggle('open');
      refs.sidebarBackdrop.classList.toggle('open');
    });

    refs.sidebarBackdrop.addEventListener('click', closeMobileMenu);

    refs.sidebar.addEventListener('click', function (event) {
      const homeButton = event.target.closest('[data-dashboard-home]');
      if (homeButton) {
        closeMobileMenu();
        showDashboard();
        return;
      }

      const tabButton = event.target.closest('[data-sheet]');
      if (!tabButton) return;
      closeMobileMenu();
      loadTab(tabButton.dataset.sheet);
    });

    refs.tableArea.addEventListener('click', function (event) {
      const quickLink = event.target.closest('[data-sheet-jump]');
      if (quickLink) {
        loadTab(quickLink.dataset.sheetJump);
        return;
      }

      const sortableHeader = event.target.closest('th[data-col]');
      if (!sortableHeader || !state.currentData) return;
      const col = Number(sortableHeader.dataset.col);
      if (!Number.isInteger(col)) return;
      if (state.sortCol === col) state.sortAsc = !state.sortAsc;
      else {
        state.sortCol = col;
        state.sortAsc = true;
      }
      renderTable();
    });

    refs.tableArea.addEventListener('dblclick', function (event) {
      const cell = event.target.closest('td.editable');
      if (!cell || state.editingCell) return;
      startEditing(cell);
    });

    var lastTapCell = null;
    var lastTapTime = 0;
    refs.tableArea.addEventListener('touchend', function (event) {
      const cell = event.target.closest('td.editable');
      if (!cell || state.editingCell) return;
      var now = Date.now();
      if (lastTapCell === cell && (now - lastTapTime) < 400) {
        event.preventDefault();
        startEditing(cell);
        lastTapCell = null;
        lastTapTime = 0;
      } else {
        lastTapCell = cell;
        lastTapTime = now;
      }
    });

    refs.tableArea.addEventListener('keydown', function (event) {
      const cell = event.target.closest('td.editable');
      if (!cell || state.editingCell) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      startEditing(cell);
    });

    refs.searchInput.addEventListener('input', function () {
      if (refs.searchInput.disabled) return;
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        state.searchQuery = refs.searchInput.value.trim().toLowerCase();
        syncUrlState();
        renderTable();
      }, SEARCH_DEBOUNCE_MS);
    });
  }

  function maybeFocusPin() {
    const prefersFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (!prefersFinePointer) return;
    window.setTimeout(function () {
      refs.pinInput.focus();
    }, 80);
  }

  function setShellMode(mode) {
    const isApp = mode === 'app';
    document.documentElement.classList.toggle('crm-app-open', isApp);
    document.body.classList.toggle('crm-app-open', isApp);
    document.documentElement.classList.toggle('crm-login-open', !isApp);
    document.body.classList.toggle('crm-login-open', !isApp);
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const pin = refs.pinInput.value.trim();
    if (!pin) {
      refs.loginError.textContent = 'Enter your PIN to continue.';
      return;
    }

    refs.loginError.textContent = '';
    refs.pinInput.disabled = true;
    refs.loginButton.disabled = true;
    setStatus('Checking…', 'saving');

    try {
      const body = new URLSearchParams({ source: 'crm-login', pin: pin });
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
        body: body.toString(),
        redirect: 'follow'
      });

      const payload = parseResponseText(await response.text());
      if (payload.status !== 'ok' || !payload.user) {
        throw new Error(payload.message || 'Invalid PIN.');
      }

      state.userPin = pin;
      state.currentUser = payload.user;
      setShellMode('app');
      refs.loginGate.style.display = 'none';
      refs.app.classList.add('active');
      refs.main.focus();

      showUserBadge();
      buildSidebar();
      restoreRouteAfterLogin();
      showToast('CRM unlocked', 'success');
    } catch (error) {
      refs.loginError.textContent = error.message || 'Login failed.';
      setStatus('Access denied', 'error');
    } finally {
      refs.pinInput.disabled = false;
      refs.loginButton.disabled = false;
    }
  }

  function restoreRouteAfterLogin() {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get('tab');
    const requestedQuery = params.get('q') || '';

    if (requestedTab && requestedTab !== 'dashboard' && isTabVisible(requestedTab)) {
      state.searchQuery = requestedQuery.toLowerCase();
      refs.searchInput.value = requestedQuery;
      loadTab(requestedTab, { skipHistory: true });
      return;
    }

    showDashboard({ skipHistory: requestedTab === 'dashboard' });
  }

  function showUserBadge() {
    if (!state.currentUser) return;
    const role = state.currentUser.role || 'member';
    const roleClass = role === 'regional' ? 'regional' : role === 'area' ? 'area' : 'member';
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    refs.user.innerHTML = escapeHtml(state.currentUser.name || 'Member') + ' <span class="role-badge ' + roleClass + '">' + escapeHtml(roleLabel) + '</span>';
  }

  function buildSidebar() {
    const visibleTabs = getVisibleTabs();
    const writableTabs = getWritableTabs();

    let html = '';
    html += '<section class="sidebar-home">';
    html += '  <div class="sidebar-home-title"><strong>Overview</strong><span class="sidebar-home-badge">Live</span></div>';
    html += '  <p class="sidebar-home-copy">Start in the ops cockpit, then jump into any visible workbook.</p>';
    html += '  <button class="sidebar-home-button" data-dashboard-home="true">';
    html += '    <span>Open dashboard</span>';
    html += '    <span class="quick-link-badge">Home</span>';
    html += '  </button>';
    html += '</section>';

    ALL_TABS.forEach(function (section) {
      const sectionTabs = section.tabs.filter(function (tab) {
        return isTabVisible(tab.sheet);
      });
      if (!sectionTabs.length) return;

      html += '<section class="sidebar-group">';
      html += '  <div class="sidebar-section">';
      html += '    <span class="sidebar-section-label">' + escapeHtml(section.section) + '</span>';
      html += '    <span class="sidebar-section-count">' + sectionTabs.length + '</span>';
      html += '  </div>';
      html += '  <div class="sidebar-items">';

      sectionTabs.forEach(function (tab) {
        const writable = isTabWritable(tab.sheet);
        html += '    <button class="sidebar-item" data-sheet="' + escapeHtml(tab.sheet) + '">';
        html += '      <span class="sidebar-item-main">';
        html += '        <span class="sidebar-item-label">' + escapeHtml(tab.label) + '</span>';
        html += '        <span class="sidebar-item-meta">' + escapeHtml(tab.summary) + '</span>';
        html += '      </span>';
        html += '      <span class="sidebar-badge ' + (writable ? 'rw' : 'ro') + '">' + (writable ? 'R/W' : 'Read') + '</span>';
        html += '    </button>';
      });

      html += '  </div>';
      html += '</section>';
    });

    html += '<section class="sidebar-footer">';
    html += '  <strong>Access Scope</strong>';
    html += '  <p>' + escapeHtml((state.currentUser.teams || []).join(' • ') || 'RDU HeatWave') + '</p>';
    html += '  <p>' + visibleTabs.length + ' visible tabs • ' + writableTabs.length + ' writable tabs</p>';
    html += '</section>';

    refs.sidebar.innerHTML = html;
    setActiveNav(null);
  }

  function showDashboard(options) {
    const settings = options || {};
    const visibleTabs = getVisibleTabs();
    const writableTabs = getWritableTabs();
    const quickLinks = visibleTabs.slice().sort(function (left, right) {
      const leftWritable = isTabWritable(left.sheet) ? 1 : 0;
      const rightWritable = isTabWritable(right.sheet) ? 1 : 0;
      return rightWritable - leftWritable;
    }).slice(0, 5);

    state.activeTab = null;
    state.currentData = null;
    state.sortCol = -1;
    state.sortAsc = true;
    state.searchQuery = '';
    state.editingCell = null;

    refs.searchInput.value = '';
    refs.searchInput.disabled = true;
    refs.searchInput.placeholder = 'Open a sheet to filter rows…';

    setActiveNav(null);
    setWorkspaceContext('Overview', 'Ops Cockpit');
    setStatus('Dashboard', '');

    let html = '';
    html += '<section class="dashboard">';
    html += '  <div class="dashboard-hero">';
    html += '    <div class="dashboard-hero-copy">';
    html += '      <p class="dashboard-kicker">Internal Ops Cockpit</p>';
    html += '      <h1 class="dashboard-title">Good to see you, ' + escapeHtml(getFirstName(state.currentUser.name)) + '.</h1>';
    html += '      <p class="dashboard-copy">Track member activity, keep referrals moving, and work the right sheet without losing the HeatWave rhythm.</p>';
    html += '      <div class="dashboard-pills">';
    html += '        <span class="dashboard-pill">' + visibleTabs.length + ' workspaces visible</span>';
    html += '        <span class="dashboard-pill">' + writableTabs.length + ' editable today</span>';
    html += '        <span class="dashboard-pill">Google Sheets live sync</span>';
    html += '      </div>';
    html += '    </div>';
    html += '    <aside class="dashboard-summary">';
    html += '      <p class="panel-kicker">Rhythm Check</p>';
    html += '      <div class="summary-list">';
    html += renderSummaryItem(1, 'Work from the right sheet.', 'People tabs help with roster and applications; performance tabs handle momentum.');
    html += renderSummaryItem(2, 'Read badges mean safe browsing.', 'R/W badges are the only places that allow inline edits back to the source sheet.');
    html += renderSummaryItem(3, 'Use filter fast.', 'Open any tab and search names, notes, or totals without touching the underlying workbook.');
    html += '      </div>';
    html += '    </aside>';
    html += '  </div>';
    html += '  <section class="metric-strip">';
    html += renderMetricCard('Guests Hosted', 'Rolling 12 months', 'metric-guests', 'Loading…');
    html += renderMetricCard('BizChats', 'Rolling 12 months', 'metric-bizchats', 'Loading…');
    html += renderMetricCard('Referrals', 'Open pipeline count', 'metric-referrals', 'Loading…');
    html += renderMetricCard('Revenue', 'Closed business', 'metric-revenue', 'Loading…');
    html += '  </section>';
    html += '  <section class="dashboard-grid">';
    html += '    <article class="panel">';
    html += '      <div class="panel-head">';
    html += '        <div>';
    html += '          <p class="panel-kicker">Quick Access</p>';
    html += '          <h2 class="panel-title">Jump Into Live Work</h2>';
    html += '        </div>';
    html += '        <span class="metric-badge">Prioritizing writable tabs</span>';
    html += '      </div>';

    if (quickLinks.length) {
      html += '      <div class="quick-link-list">';
      quickLinks.forEach(function (tab) {
        const writable = isTabWritable(tab.sheet);
        html += '        <button class="quick-link" data-sheet-jump="' + escapeHtml(tab.sheet) + '">';
        html += '          <span class="quick-link-main">';
        html += '            <strong>' + escapeHtml(tab.label) + '</strong>';
        html += '            <span>' + escapeHtml(tab.summary) + '</span>';
        html += '          </span>';
        html += '          <span class="quick-link-badge ' + (writable ? 'rw' : 'ro') + '">' + (writable ? 'Open R/W' : 'Open Read') + '</span>';
        html += '        </button>';
      });
      html += '      </div>';
    } else {
      html += '      <p class="dashboard-empty">No visible tabs are assigned to this PIN yet.</p>';
    }

    html += '    </article>';
    html += '    <article class="panel">';
    html += '      <div class="panel-head">';
    html += '        <div>';
    html += '          <p class="panel-kicker">Operating Notes</p>';
    html += '          <h2 class="panel-title">Keep the Data Clean</h2>';
    html += '        </div>';
    html += '      </div>';
    html += '      <ul class="workspace-rules">';
    html += renderRuleItem('Double-click any writable cell to edit. Saves go straight back to the workbook.');
    html += renderRuleItem('Totals rows stay protected so formulas are not clobbered mid-meeting.');
    html += renderRuleItem('If you only see read badges, your PIN is scoped for visibility, not direct edits.');
    html += '      </ul>';
    html += '    </article>';
    html += '  </section>';
    html += '</section>';

    refs.tableArea.innerHTML = html;
    if (!settings.skipHistory) syncUrlState();
    loadDashboardMetrics();
  }

  function renderSummaryItem(index, title, copy) {
    return '<div class="summary-item">' +
      '<span class="summary-index">' + index + '</span>' +
      '<div><strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(copy) + '</p></div>' +
      '</div>';
  }

  function renderMetricCard(label, copy, id, initial) {
    return '<article class="metric-card">' +
      '<p class="metric-label">' + escapeHtml(label) + '</p>' +
      '<strong class="metric-value" id="' + escapeHtml(id) + '">' + escapeHtml(initial) + '</strong>' +
      '<p class="metric-copy">' + escapeHtml(copy) + '</p>' +
      '</article>';
  }

  function renderRuleItem(copy) {
    return '<li><span class="workspace-rule-bullet" aria-hidden="true"></span><span>' + escapeHtml(copy) + '</span></li>';
  }

  async function loadDashboardMetrics() {
    const loaders = [
      {
        id: 'metric-guests',
        promise: fetchTab('Guest Incentive Report').then(function (data) {
          const value = parseNumericValue(extractTotalsValue(data, 'weekly total points'));
          return value == null ? '—' : formatInteger.format(value);
        })
      },
      {
        id: 'metric-bizchats',
        promise: fetchTab('BizChats Report').then(function (data) {
          const value = parseNumericValue(extractTotalsValue(data, 'weekly total'));
          return value == null ? '—' : formatInteger.format(value);
        })
      },
      {
        id: 'metric-referrals',
        promise: fetchTab('Referral Pipeline').then(function (data) {
          const count = data.rows.filter(function (row) {
            return row[0] && row[0].trim();
          }).length;
          return formatInteger.format(count);
        })
      },
      {
        id: 'metric-revenue',
        promise: fetchTab('Revenue Report').then(function (data) {
          const value = parseNumericValue(extractTotalsValue(data, 'rcvd'));
          return value == null ? '—' : formatCurrency.format(value);
        })
      }
    ];

    const results = await Promise.allSettled(loaders.map(function (loader) { return loader.promise; }));
    results.forEach(function (result, index) {
      const node = document.getElementById(loaders[index].id);
      if (!node) return;
      node.textContent = result.status === 'fulfilled' ? result.value : '—';
    });
  }

  async function loadTab(sheetName, options) {
    const settings = options || {};
    const tabConfig = findTabConfig(sheetName);
    if (!tabConfig) return;

    state.activeTab = tabConfig;
    state.currentData = null;
    state.sortCol = -1;
    state.sortAsc = true;
    state.editingCell = null;

    refs.searchInput.disabled = false;
    refs.searchInput.placeholder = 'Filter ' + tabConfig.label.toLowerCase() + '…';
    refs.searchInput.value = state.searchQuery;

    setActiveNav(sheetName);
    setWorkspaceContext(tabConfig.label, tabConfig.rw ? 'Editable Sheet' : 'Read-Only Sheet');
    refs.tableArea.innerHTML = '<div class="table-loading">Loading ' + escapeHtml(tabConfig.label) + '…</div>';
    setStatus('Loading…', 'saving');

    if (!settings.skipHistory) syncUrlState();

    try {
      const data = await fetchTab(sheetName);
      state.currentData = data;
      renderTable();
      refs.main.focus();
    } catch (error) {
      refs.tableArea.innerHTML = '<div class="table-loading" style="color: var(--color-error)">Could not load ' + escapeHtml(tabConfig.label) + ': ' + escapeHtml(error.message || 'Unknown error') + '</div>';
      setStatus('Load failed', 'error');
    }
  }

  async function fetchTab(sheetName) {
    const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(sheetName);
    const response = await fetch(url);
    const text = await response.text();
    const match = text.match(/setResponse\(([\s\S]+)\);?\s*$/);
    if (!match) throw new Error('Invalid sheet response.');

    const payload = JSON.parse(match[1]);
    const cols = (payload.table.cols || []).map(function (col) {
      return (col.label || '').replace(/\s+/g, ' ').trim();
    });
    const rows = (payload.table.rows || []).map(function (row) {
      return (row.c || []).map(function (cell) {
        if (!cell) return '';
        if (cell.f != null) return String(cell.f);
        if (cell.v != null) return String(cell.v);
        return '';
      });
    });

    return { cols: cols, rows: rows };
  }

  function renderTable() {
    if (!state.activeTab || !state.currentData) return;
    if (!state.currentData.cols.length) {
      refs.tableArea.innerHTML = '<div class="table-loading">No data in this tab.</div>';
      setStatus('No data', '');
      return;
    }

    const visibleCols = state.currentData.cols.reduce(function (accumulator, _label, index) {
      const hasData = state.currentData.cols[index] || state.currentData.rows.some(function (row) {
        return row[index] && row[index].trim();
      });
      if (hasData) accumulator.push(index);
      return accumulator;
    }, []);

    const rowIndices = state.currentData.rows.reduce(function (accumulator, _row, index) {
      if (state.searchQuery) {
        const rowText = state.currentData.rows[index].join(' ').toLowerCase();
        if (rowText.indexOf(state.searchQuery) === -1) return accumulator;
      }
      accumulator.push(index);
      return accumulator;
    }, []);

    if (state.sortCol >= 0) {
      rowIndices.sort(function (leftIndex, rightIndex) {
        const left = sanitizeDisplayValue(state.currentData.rows[leftIndex][state.sortCol] || '');
        const right = sanitizeDisplayValue(state.currentData.rows[rightIndex][state.sortCol] || '');
        const leftNumber = parseNumericValue(left);
        const rightNumber = parseNumericValue(right);

        if (leftNumber != null && rightNumber != null) {
          return state.sortAsc ? leftNumber - rightNumber : rightNumber - leftNumber;
        }

        return state.sortAsc ? left.localeCompare(right) : right.localeCompare(left);
      });
    }

    const rowCount = rowIndices.length;
    const totalRows = state.currentData.rows.length;
    const writable = state.activeTab.rw;
    const permissionLabel = writable ? 'Read / Write' : 'Read Only';
    const sectionName = findSectionName(state.activeTab.sheet);

    let html = '';
    html += '<section class="sheet-workspace">';
    html += '  <div class="sheet-head">';
    html += '    <div class="sheet-title-wrap">';
    html += '      <p class="sheet-kicker">' + escapeHtml(sectionName) + ' Workspace</p>';
    html += '      <h1 class="sheet-title">' + escapeHtml(state.activeTab.label) + '</h1>';
    html += '      <p class="sheet-description">' + escapeHtml(state.activeTab.summary || 'Live sheet data for the HeatWave team.') + '</p>';
    html += '    </div>';
    html += '    <div class="sheet-meta">';
    html += '      <span class="permission-pill ' + (writable ? 'rw' : 'ro') + '">' + permissionLabel + '</span>';
    html += '      <span class="meta-pill">' + formatInteger.format(visibleCols.length) + ' visible columns</span>';
    html += '      <span class="meta-pill">' + formatInteger.format(rowCount) + ' showing of ' + formatInteger.format(totalRows) + ' rows</span>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="sheet-toolbar">';
    html += '    <p class="table-hint">' + escapeHtml(writable ? 'Double-click or press Enter on a highlighted cell to edit it inline.' : 'This sheet is view-only for your access level.') + '</p>';
    html += '    <div class="sheet-jump-list">';
    html += '      <button class="sheet-jump" data-sheet-jump="' + escapeHtml(findNeighborSheet(state.activeTab.sheet) || 'Membership Directory') + '">';
    html += '        <span class="sheet-jump-copy"><strong class="sheet-jump-label">Next Suggested View</strong><span>' + escapeHtml(findNeighborLabel(state.activeTab.sheet)) + '</span></span>';
    html += '        <span class="quick-link-badge">Jump</span>';
    html += '      </button>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="table-wrap">';
    html += '    <table class="data-table">';
    html += '      <thead><tr><th>#</th>';

    visibleCols.forEach(function (colIndex) {
      const label = state.currentData.cols[colIndex] || ('Column ' + (colIndex + 1));
      const arrow = state.sortCol === colIndex ? '<span class="sort-arrow">' + (state.sortAsc ? '▲' : '▼') + '</span>' : '';
      const dimmed = isReadOnlyCol(colIndex) ? ' style="opacity:0.72"' : '';
      html += '<th data-col="' + colIndex + '"' + dimmed + '>' + escapeHtml(label) + arrow + '</th>';
    });

    html += '      </tr></thead><tbody>';

    rowIndices.forEach(function (rowIndex) {
      const totalsRow = isTotalsRow(rowIndex);
      html += '<tr' + (totalsRow ? ' class="totals-row"' : '') + '>';
      html += '<td class="row-num">' + formatInteger.format(rowIndex + 1) + '</td>';

      visibleCols.forEach(function (colIndex) {
        const rawValue = state.currentData.rows[rowIndex][colIndex] || '';
        const value = sanitizeDisplayValue(rawValue);
        const readOnly = !state.activeTab.rw || isReadOnlyCol(colIndex) || totalsRow;
        const classes = readOnly ? 'readonly' : 'editable';
        const attributes = readOnly
          ? ''
          : ' data-row="' + rowIndex + '" data-col="' + colIndex + '" tabindex="0" aria-label="Edit ' + escapeHtml(state.currentData.cols[colIndex] || 'cell') + ', row ' + escapeHtml(String(rowIndex + 1)) + '"';
        html += '<td class="' + classes + '" title="' + escapeHtml(value) + '"' + attributes + '>' + escapeHtml(value) + '</td>';
      });

      html += '</tr>';
    });

    html += '      </tbody></table>';
    html += '  </div>';
    html += '</section>';

    refs.tableArea.innerHTML = html;
    setStatus(formatInteger.format(rowCount) + ' rows', '');
  }

  function startEditing(cell) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;

    const original = state.currentData.rows[row][col] || '';
    state.editingCell = { row: row, col: col, original: original, cell: cell };

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-editor';
    input.value = original;
    input.setAttribute('aria-label', 'Edit cell value');

    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitEdit(input.value);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        commitEdit(input.value).then(function () {
          const nextCell = event.shiftKey ? cell.previousElementSibling : cell.nextElementSibling;
          if (nextCell && nextCell.classList.contains('editable')) {
            window.setTimeout(function () {
              startEditing(nextCell);
            }, 40);
          }
        });
      }
    });

    input.addEventListener('blur', function () {
      if (!state.editingCell) return;
      commitEdit(input.value);
    });
  }

  function cancelEdit() {
    if (!state.editingCell) return;
    const current = state.editingCell;
    current.cell.textContent = current.original;
    current.cell.title = current.original;
    current.cell.focus();
    state.editingCell = null;
  }

  async function commitEdit(nextValue) {
    if (!state.editingCell) return;
    const current = state.editingCell;
    const previousValue = current.original;
    const trimmedNext = nextValue;

    current.cell.textContent = trimmedNext;
    current.cell.title = trimmedNext;
    current.cell.focus();
    state.editingCell = null;

    if (trimmedNext === previousValue) return;

    const previousRows = state.currentData.rows.map(function (row) {
      return row.slice();
    });
    const updatedRows = state.currentData.rows.map(function (row, rowIndex) {
      if (rowIndex !== current.row) return row.slice();
      return row.map(function (value, colIndex) {
        return colIndex === current.col ? trimmedNext : value;
      });
    });
    state.currentData = { cols: state.currentData.cols.slice(), rows: updatedRows };

    const cellReference = colIndexToLetter(current.col) + String(current.row + 2);
    setStatus('Saving…', 'saving');

    try {
      await writeCell(state.activeTab.sheet, cellReference, trimmedNext);
      setStatus('Saved', 'saved');
      showToast('Cell updated', 'success');
      window.setTimeout(function () {
        const visibleCount = refs.tableArea.querySelectorAll('tbody tr').length;
        setStatus(formatInteger.format(visibleCount) + ' rows', '');
      }, 1600);
    } catch (error) {
      state.currentData = { cols: state.currentData.cols.slice(), rows: previousRows };
      renderTable();
      setStatus('Save failed', 'error');
      showToast(error.message || 'Could not save that change.', 'error');
    }
  }

  async function writeCell(sheetName, cellReference, value) {
    const body = new URLSearchParams({
      source: 'crm-update',
      pin: state.userPin,
      sheet: sheetName,
      cell: cellReference,
      value: value
    });

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: body.toString(),
      redirect: 'follow'
    });

    const text = await response.text();
    const payload = parseResponseText(text);
    if (payload.status === 'ok') return;
    throw new Error(payload.message || 'Sheet write failed.');
  }

  function parseResponseText(text) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Unexpected server response.');
      return JSON.parse(match[0]);
    }
  }

  function setWorkspaceContext(title, mode) {
    refs.tabName.textContent = title;
    refs.modeChip.textContent = mode;
  }

  function setActiveNav(sheetName) {
    refs.sidebar.querySelectorAll('.sidebar-item').forEach(function (button) {
      button.classList.toggle('active', button.dataset.sheet === sheetName);
    });
    const homeButton = refs.sidebar.querySelector('[data-dashboard-home]');
    if (homeButton) homeButton.classList.toggle('active', !sheetName);
  }

  function setStatus(text, statusClass) {
    refs.status.textContent = text;
    refs.status.className = 'topbar-status' + (statusClass ? ' ' + statusClass : '');
  }

  function showToast(message, type) {
    window.clearTimeout(toastTimer);
    refs.toast.textContent = message;
    refs.toast.className = 'toast visible' + (type ? ' ' + type : '');
    toastTimer = window.setTimeout(function () {
      refs.toast.className = 'toast';
    }, 2600);
  }

  function syncUrlState() {
    const params = new URLSearchParams(window.location.search);
    if (state.activeTab) params.set('tab', state.activeTab.sheet);
    else params.set('tab', 'dashboard');

    if (state.searchQuery && state.activeTab) params.set('q', state.searchQuery);
    else params.delete('q');

    const nextUrl = window.location.pathname + '?' + params.toString();
    window.history.replaceState({}, '', nextUrl);
  }

  function closeMobileMenu() {
    refs.sidebar.classList.remove('open');
    refs.sidebarBackdrop.classList.remove('open');
  }

  function getVisibleTabs() {
    return ALL_TABS.flatMap(function (section) {
      return section.tabs.filter(function (tab) {
        return isTabVisible(tab.sheet);
      }).map(function (tab) {
        return Object.assign({ section: section.section, rw: isTabWritable(tab.sheet) }, tab);
      });
    });
  }

  function getWritableTabs() {
    return getVisibleTabs().filter(function (tab) {
      return tab.rw;
    });
  }

  function isTabVisible(sheetName) {
    return !!state.currentUser && Array.isArray(state.currentUser.visibleTabs) && state.currentUser.visibleTabs.indexOf(sheetName) !== -1;
  }

  function isTabWritable(sheetName) {
    return !!state.currentUser && Array.isArray(state.currentUser.writableTabs) && state.currentUser.writableTabs.indexOf(sheetName) !== -1;
  }

  function findTabConfig(sheetName) {
    const tab = getVisibleTabs().find(function (candidate) {
      return candidate.sheet === sheetName;
    });
    return tab || null;
  }

  function findSectionName(sheetName) {
    const match = ALL_TABS.find(function (section) {
      return section.tabs.some(function (tab) {
        return tab.sheet === sheetName;
      });
    });
    return match ? match.section : 'Team';
  }

  function findNeighborSheet(sheetName) {
    const tabs = getVisibleTabs();
    const index = tabs.findIndex(function (tab) {
      return tab.sheet === sheetName;
    });
    if (index === -1 || tabs.length < 2) return tabs[0] ? tabs[0].sheet : '';
    return tabs[(index + 1) % tabs.length].sheet;
  }

  function findNeighborLabel(sheetName) {
    const neighbor = findNeighborSheet(sheetName);
    const config = findTabConfig(neighbor);
    return config ? config.label : 'Open another workspace';
  }

  function isReadOnlyCol(colIndex) {
    if (!state.activeTab || !state.activeTab.rw) return true;
    if (!state.activeTab.readOnlyCols || !state.activeTab.readOnlyCols.length) return false;
    const label = (state.currentData.cols[colIndex] || '').toLowerCase();
    return state.activeTab.readOnlyCols.some(function (readOnlyLabel) {
      return label === readOnlyLabel || label.indexOf(readOnlyLabel) !== -1;
    });
  }

  function isTotalsRow(rowIndex) {
    if (!state.activeTab || !state.activeTab.hasTotalsRow) return false;
    const row = state.currentData.rows[rowIndex] || [];
    const firstCell = row[0] || '';
    if (firstCell.trim()) return false;
    return row.some(function (cell, index) {
      return index > 0 && cell && cell.trim();
    });
  }

  function extractTotalsValue(data, labelFragment) {
    const colIndex = data.cols.findIndex(function (label) {
      return label.toLowerCase().indexOf(labelFragment.toLowerCase()) !== -1;
    });
    if (colIndex === -1) return null;

    for (let rowIndex = data.rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const row = data.rows[rowIndex];
      const candidate = sanitizeDisplayValue(row[colIndex] || '');
      const firstCell = sanitizeDisplayValue(row[0] || '');
      if (!firstCell && candidate) return candidate;
    }

    return null;
  }

  function parseNumericValue(value) {
    if (value == null) return null;
    const match = String(value).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function sanitizeDisplayValue(value) {
    const text = String(value || '').trim();
    return /^#(REF|N\/A|VALUE|DIV\/0|NAME\?|NULL)!?$/i.test(text) ? '' : text;
  }

  function getFirstName(name) {
    if (!name) return 'there';
    return String(name).trim().split(/\s+/)[0] || 'there';
  }

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value == null ? '' : value);
    return element.innerHTML;
  }

  function colIndexToLetter(index) {
    let letter = '';
    let current = index;
    while (current >= 0) {
      letter = String.fromCharCode(65 + (current % 26)) + letter;
      current = Math.floor(current / 26) - 1;
    }
    return letter;
  }
})();
