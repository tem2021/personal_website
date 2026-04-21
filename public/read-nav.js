/**
 * Vi-like keyboard navigation for reading pages (articles, profile, projects).
 * Expects <body data-home-href="..."> for `q` to return to the terminal index.
 *
 * z-prefix (press z, then within ~500ms): zz = center block, zt = block top, zb = block bottom
 *
 * Keep shortcut table in sync with README.md (Reading pages).
 */
(function () {
  'use strict';

  var ACTIVE_CLASS = 'read-nav-line--active';
  var GG_MS = 400;
  var Z_LEADER_MS = 500;

  var blocks = [];
  var currentIndex = -1;
  var lastGAt = 0;
  var zLeaderAt = 0;
  var zLeaderTimer = 0;

  var helpOpen = false;
  var helpRoot = null;

  /** Digits before j/k/h (e.g. 12j); cleared when other keys run */
  var countPrefix = '';

  function clearCountPrefix() {
    countPrefix = '';
  }

  function isTypingContext() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function getBlocks() {
    var prose = document.querySelector('.prose-body');
    if (prose && prose.children.length) {
      return Array.prototype.slice.call(prose.children);
    }
    var article = document.querySelector('article.prose-page');
    if (!article) return [];
    return Array.prototype.filter.call(article.children, function (el) {
      return el.nodeType === 1 && el.tagName !== 'HEADER';
    });
  }

  function refreshBlocks() {
    blocks = getBlocks();
    if (currentIndex >= blocks.length) currentIndex = blocks.length - 1;
    if (currentIndex < 0 && blocks.length) currentIndex = 0;
  }

  function clearHighlight() {
    blocks.forEach(function (el) {
      el.classList.remove(ACTIVE_CLASS);
    });
  }

  /**
   * @param {{ scroll?: boolean }} [opts] - scroll=false: only update class (e.g. after d/u page scroll)
   */
  function applyHighlight(opts) {
    opts = opts || {};
    var doScroll = opts.scroll !== false;
    clearHighlight();
    if (currentIndex >= 0 && currentIndex < blocks.length) {
      var el = blocks[currentIndex];
      el.classList.add(ACTIVE_CLASS);
      if (doScroll) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  /** After Ctrl-D / Ctrl-U style scroll: move focus to the block spanning the viewport center (vim-like). */
  function syncFocusToViewportAfterHalfScroll() {
    refreshBlocks();
    if (!blocks.length) return;
    var cy = window.innerHeight / 2;
    var i;
    for (i = 0; i < blocks.length; i++) {
      var r = blocks[i].getBoundingClientRect();
      if (r.height <= 0) continue;
      if (r.top <= cy && r.bottom >= cy) {
        currentIndex = i;
        applyHighlight({ scroll: false });
        return;
      }
    }
    var bestIdx = 0;
    var bestDist = Infinity;
    for (i = 0; i < blocks.length; i++) {
      var r2 = blocks[i].getBoundingClientRect();
      var mid = (r2.top + r2.bottom) / 2;
      var dist = Math.abs(mid - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    currentIndex = bestIdx;
    applyHighlight({ scroll: false });
  }

  function moveBy(delta) {
    refreshBlocks();
    if (!blocks.length) return;
    if (currentIndex < 0) currentIndex = 0;
    currentIndex = Math.min(Math.max(0, currentIndex + delta), blocks.length - 1);
    applyHighlight();
  }

  /** First block that intersects the viewport (from top). */
  function snapToFirstVisibleBlock() {
    refreshBlocks();
    if (!blocks.length) return;
    var vh = window.innerHeight;
    var i;
    for (i = 0; i < blocks.length; i++) {
      var br = blocks[i].getBoundingClientRect();
      if (br.height <= 0) continue;
      if (br.bottom > 0 && br.top < vh) {
        currentIndex = i;
        applyHighlight({ scroll: false });
        return;
      }
    }
  }

  /** Last block that intersects the viewport (from bottom). */
  function snapToLastVisibleBlock() {
    refreshBlocks();
    if (!blocks.length) return;
    var vh = window.innerHeight;
    var i;
    for (i = blocks.length - 1; i >= 0; i--) {
      var br = blocks[i].getBoundingClientRect();
      if (br.height <= 0) continue;
      if (br.bottom > 0 && br.top < vh) {
        currentIndex = i;
        applyHighlight({ scroll: false });
        return;
      }
    }
  }

  /**
   * After mouse wheel: if the highlighted block is fully outside the viewport,
   * snap to the first visible block (wheel down) or last visible (wheel up).
   */
  function syncHighlightAfterWheel(deltaY) {
    if (helpOpen) return;
    refreshBlocks();
    if (!blocks.length || currentIndex < 0) return;
    var el = blocks[currentIndex];
    if (!el) return;
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var intersects = r.bottom > 0 && r.top < vh;
    if (intersects) return;
    if (deltaY > 0) {
      snapToFirstVisibleBlock();
    } else if (deltaY < 0) {
      snapToLastVisibleBlock();
    }
  }

  function scrollHalf(dir) {
    var h = Math.max(200, Math.floor(window.innerHeight / 2));
    // Use instant scroll so focus can sync immediately (like vim Ctrl-D / Ctrl-U).
    window.scrollBy({ top: dir * h, left: 0, behavior: 'auto' });
    syncFocusToViewportAfterHalfScroll();
  }

  function goTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refreshBlocks();
    currentIndex = blocks.length ? 0 : -1;
    applyHighlight();
  }

  function goBottom() {
    refreshBlocks();
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    currentIndex = blocks.length ? blocks.length - 1 : -1;
    applyHighlight();
  }

  function goHome() {
    var body = document.body;
    var href =
      (body && body.getAttribute('data-home-href')) || '../../index.html';
    window.location.href = href;
  }

  function closeHelp() {
    if (!helpOpen || !helpRoot) return;
    helpOpen = false;
    helpRoot.style.display = 'none';
    helpRoot.setAttribute('aria-hidden', 'true');
  }

  function openHelp() {
    if (!helpRoot || helpOpen) return;
    helpOpen = true;
    helpRoot.style.display = 'flex';
    helpRoot.setAttribute('aria-hidden', 'false');
  }

  function createHelpOverlay() {
    var backdrop = document.createElement('div');
    backdrop.className = 'read-nav-help-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.style.display = 'none';

    var panel = document.createElement('div');
    panel.className = 'read-nav-help-panel';

    var back = document.createElement('a');
    back.className = 'read-nav-help-back';
    back.href = '#';
    back.textContent = '\u2190 close help';
    back.addEventListener('click', function (e) {
      e.preventDefault();
      closeHelp();
    });

    var title = document.createElement('h2');
    title.className = 'read-nav-help-title';
    title.textContent = 'Reading shortcuts';

    var table = document.createElement('table');
    table.className = 'read-nav-help-table';
    var tbody = document.createElement('tbody');
    var rows = [
      ['j / k / h', 'Move highlight down / up (h same as k). Prefix count: e.g. 12j, 3k'],
      ['d / u', 'Scroll down / up half a page (focus follows)'],
      ['Mouse wheel', 'If highlight leaves viewport, jump to top/bottom visible block'],
      ['g then g', 'Go to top of page; highlight first block'],
      ['G', 'Go to bottom; highlight last block'],
      ['z then z', 'Center current block in the viewport (zz)'],
      ['z then t', 'Put current block near top of viewport (zt)'],
      ['z then b', 'Put current block near bottom of viewport (zb)'],
      ['?', 'Open this help (Shift + /)'],
      ['q', 'When help is closed: return to terminal home. When help is open: close help only.'],
    ];
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      var tdK = document.createElement('td');
      tdK.textContent = row[0];
      var tdD = document.createElement('td');
      tdD.textContent = row[1];
      tr.appendChild(tdK);
      tr.appendChild(tdD);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var note = document.createElement('p');
    note.className = 'read-nav-help-note';
    note.textContent =
      'In vim, ? usually starts backward search; here ? opens this panel.';

    panel.appendChild(back);
    panel.appendChild(title);
    panel.appendChild(table);
    panel.appendChild(note);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    helpRoot = backdrop;
  }

  function clearZLeader() {
    zLeaderAt = 0;
    if (zLeaderTimer) {
      clearTimeout(zLeaderTimer);
      zLeaderTimer = 0;
    }
  }

  function startZLeader() {
    clearZLeader();
    zLeaderAt = Date.now();
    zLeaderTimer = setTimeout(function () {
      zLeaderAt = 0;
      zLeaderTimer = 0;
    }, Z_LEADER_MS);
  }

  /** zz — center current block in viewport */
  function scrollBlockCenter() {
    refreshBlocks();
    if (currentIndex < 0 || currentIndex >= blocks.length) return;
    var el = blocks[currentIndex];
    var r = el.getBoundingClientRect();
    var elCenterY = r.top + r.height / 2;
    var vh = window.innerHeight;
    var targetY = window.scrollY + elCenterY - vh / 2;
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    window.scrollTo({
      top: Math.min(Math.max(0, targetY), maxScroll),
      behavior: 'smooth',
    });
    applyHighlight({ scroll: false });
  }

  /** zt — current block top near viewport top */
  function scrollBlockTop() {
    refreshBlocks();
    if (currentIndex < 0 || currentIndex >= blocks.length) return;
    var el = blocks[currentIndex];
    var r = el.getBoundingClientRect();
    var pad = 8;
    var targetY = window.scrollY + r.top - pad;
    window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    applyHighlight({ scroll: false });
  }

  /** zb — current block bottom near viewport bottom */
  function scrollBlockBottom() {
    refreshBlocks();
    if (currentIndex < 0 || currentIndex >= blocks.length) return;
    var el = blocks[currentIndex];
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var pad = 8;
    var targetY = window.scrollY + r.bottom - vh + pad;
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    window.scrollTo({
      top: Math.min(Math.max(0, targetY), maxScroll),
      behavior: 'smooth',
    });
    applyHighlight({ scroll: false });
  }

  function onKeyDown(e) {
    if (isTypingContext()) return;

    var key = e.key;
    var lower = key.length === 1 ? key.toLowerCase() : key;
    var now = Date.now();

    if (helpOpen) {
      if (lower === 'q') {
        e.preventDefault();
        closeHelp();
        return;
      }
      if (key === '?') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab') return;
      e.preventDefault();
      return;
    }

    if (key === '?') {
      e.preventDefault();
      clearCountPrefix();
      openHelp();
      return;
    }

    if (key >= '0' && key <= '9') {
      if (key === '0' && countPrefix === '') {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      countPrefix += key;
      return;
    }

    if (zLeaderAt && now - zLeaderAt < Z_LEADER_MS) {
      if (lower === 'z') {
        e.preventDefault();
        clearZLeader();
        scrollBlockCenter();
        return;
      }
      if (lower === 't') {
        e.preventDefault();
        clearZLeader();
        scrollBlockTop();
        return;
      }
      if (lower === 'b') {
        e.preventDefault();
        clearZLeader();
        scrollBlockBottom();
        return;
      }
      clearZLeader();
    }

    if (lower === 'j') {
      e.preventDefault();
      var nj = parseInt(countPrefix || '1', 10);
      clearCountPrefix();
      if (isNaN(nj) || nj < 1) nj = 1;
      moveBy(nj);
      return;
    }
    if (lower === 'k' || lower === 'h') {
      e.preventDefault();
      var nk = parseInt(countPrefix || '1', 10);
      clearCountPrefix();
      if (isNaN(nk) || nk < 1) nk = 1;
      moveBy(-nk);
      return;
    }
    if (lower === 'd') {
      e.preventDefault();
      clearCountPrefix();
      scrollHalf(1);
      return;
    }
    if (lower === 'u') {
      e.preventDefault();
      clearCountPrefix();
      scrollHalf(-1);
      return;
    }
    if (key === 'G') {
      e.preventDefault();
      clearCountPrefix();
      goBottom();
      return;
    }
    if (lower === 'g') {
      e.preventDefault();
      clearCountPrefix();
      if (now - lastGAt < GG_MS) {
        lastGAt = 0;
        goTop();
      } else {
        lastGAt = now;
      }
      return;
    }
    if (lower === 'z') {
      e.preventDefault();
      clearCountPrefix();
      startZLeader();
      return;
    }
    if (lower === 'q') {
      e.preventDefault();
      clearCountPrefix();
      goHome();
      return;
    }

    clearCountPrefix();
  }

  function onWheel(e) {
    if (helpOpen) return;
    if (isTypingContext()) return;
    var dy = e.deltaY;
    if (dy === 0) return;
    requestAnimationFrame(function () {
      syncHighlightAfterWheel(dy);
    });
  }

  function init() {
    createHelpOverlay();
    refreshBlocks();
    if (blocks.length) {
      currentIndex = 0;
      applyHighlight();
    }
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('wheel', onWheel, { passive: true });

    var prose = document.querySelector('.prose-body');
    if (prose) {
      var obs = new MutationObserver(function () {
        refreshBlocks();
        if (currentIndex < 0 && blocks.length) currentIndex = 0;
        if (currentIndex >= blocks.length) currentIndex = blocks.length - 1;
        applyHighlight();
      });
      obs.observe(prose, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
