/* NAM Capture Player
 * Seamless, beat-locked A/B looper for auditioning one guitar performance through
 * several NAM (Neural Amp Modeler) captures.
 *
 * The performance is one take, recorded to a click, sliced into equal sections
 * (default 8 sections x 4 bars at 120 BPM = 8s/section, 64s total). Every track is
 * the same DI reamped through a different model, so all buffers are sample-aligned.
 *
 * Why Web Audio (not <audio>): only the AudioContext clock gives gapless looping and
 * sample-accurate section skipping. We schedule ONE section at a time with a lookahead
 * scheduler (the "Tale of Two Clocks" pattern) and read the selected track + enabled
 * sections at schedule time, so every change lands on the next downbeat with no gap.
 */
(function () {
  'use strict';

  var LOOKAHEAD = 0.1;        // seconds the scheduler reaches ahead of the clock
  var TICK = 25;              // ms between scheduler wakeups
  var FADE = 0.004;           // s micro-fade applied only at discontinuous splices
  var START_DELAY = 0.12;     // s lead time before the first scheduled section
  var SILENCE_THRESH = 0.003; // amplitude floor for AAC lead-in (priming) detection

  var AC = window.AudioContext || window.webkitAudioContext;
  var sharedCtx = null;
  var uid = 0;

  function getCtx() {
    if (!sharedCtx && AC) { sharedCtx = new AC(); }
    return sharedCtx;
  }

  // decodeAudioData with both promise- and callback-style browser support.
  function decode(ctx, arrayBuffer) {
    return new Promise(function (resolve, reject) {
      var ret = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (ret && typeof ret.then === 'function') { ret.then(resolve, reject); }
    });
  }

  function NamPlayer(root) {
    this.root = root;
    this.id = 'nam-' + (++uid);

    var cfg = {};
    var cfgEl = root.querySelector('script.nam-player-config');
    if (cfgEl) { try { cfg = JSON.parse(cfgEl.textContent) || {}; } catch (e) { cfg = {}; } }

    this.bpm = cfg.bpm || 120;
    this.sectionsCount = cfg.sections || 8;
    this.barsPerSection = cfg.bars_per_section || 4;
    this.tracks = Array.isArray(cfg.tracks) ? cfg.tracks : [];
    this.leadInCfg = (typeof cfg.leadIn === 'number') ? cfg.leadIn : null; // null => auto-detect
    this.leadIn = this.leadInCfg || 0;

    var beat = 60 / this.bpm;
    this.sectionDur = beat * 4 * this.barsPerSection; // 4 beats/bar

    this.enabled = [];
    for (var i = 0; i < this.sectionsCount; i++) { this.enabled.push(true); }

    this.currentTrackIndex = 0;
    this.buffers = [];
    this.loaded = false;
    this.loading = false;
    this._loadPromise = null;

    this.masterGain = null;
    this.volume = 1;

    this.intendedPlaying = false; // user intent
    this.isPlaying = false;       // scheduler actually running
    this.timerId = null;
    this.rafId = null;
    this.nextSectionTime = 0;
    this.pendingSection = null;
    this.lastScheduled = null;    // { section, trackIndex } for discontinuity detection
    this.queue = [];              // { section, startTime, endTime, trackIndex, source, gain }

    this.buildDOM();
  }

  NamPlayer.prototype.ensureAudio = function () {
    var ctx = getCtx();
    if (!ctx) { return null; }
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(ctx.destination);
    }
    return ctx;
  };

  NamPlayer.prototype.load = function () {
    if (this._loadPromise) { return this._loadPromise; }
    var self = this;
    var ctx = this.ensureAudio();
    if (!ctx) { return Promise.reject(new Error('Web Audio is not supported in this browser.')); }
    this.loading = true;
    this._loadPromise = Promise.all(this.tracks.map(function (t, i) {
      return fetch(t.src)
        .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status + ' for ' + t.src); } return r.arrayBuffer(); })
        .then(function (ab) { return decode(ctx, ab); })
        .then(function (buf) { self.buffers[i] = buf; });
    })).then(function () {
      self.loaded = true;
      self.loading = false;
      if (self.leadInCfg == null) { self.leadIn = self.detectLeadIn(self.buffers[0]); }
    }, function (err) {
      self.loading = false;
      self._loadPromise = null; // allow retry
      throw err;
    });
    return this._loadPromise;
  };

  // AAC prepends constant encoder priming (silence). The musical onset is recorded at
  // sample 0, so the first sample above the floor marks the priming length; offset all
  // section reads by it to keep the loop wrap gapless and downbeats evenly spaced.
  NamPlayer.prototype.detectLeadIn = function (buf) {
    if (!buf) { return 0; }
    var data = buf.getChannelData(0);
    var limit = Math.min(data.length, Math.floor(buf.sampleRate * 0.5));
    for (var i = 0; i < limit; i++) {
      if (Math.abs(data[i]) > SILENCE_THRESH) {
        return Math.max(0, (i / buf.sampleRate) - 0.003); // small guard so the attack isn't clipped
      }
    }
    return 0;
  };

  NamPlayer.prototype.nextEnabled = function (from) {
    for (var i = 0; i < this.sectionsCount; i++) {
      var idx = (from + i) % this.sectionsCount;
      if (this.enabled[idx]) { return idx; }
    }
    return null;
  };

  NamPlayer.prototype.scheduleSection = function (section, when) {
    var ctx = getCtx();
    var trackIndex = this.currentTrackIndex;
    var buf = this.buffers[trackIndex];
    if (!buf) { return; }

    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    src.connect(gain);
    gain.connect(this.masterGain);

    var dur = this.sectionDur;
    var discont = !this.lastScheduled ||
      section !== ((this.lastScheduled.section + 1) % this.sectionsCount) ||
      trackIndex !== this.lastScheduled.trackIndex;

    if (discont) {
      // Fade the incoming section in, and fade the previous section out at the same
      // boundary. Contiguous same-track sections get flat gain => truly seamless.
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(1, when + FADE);
      var prev = this.queue.length ? this.queue[this.queue.length - 1] : null;
      if (prev) {
        prev.gain.gain.setValueAtTime(1, prev.endTime - FADE);
        prev.gain.gain.linearRampToValueAtTime(0, prev.endTime);
      }
    } else {
      gain.gain.setValueAtTime(1, when);
    }

    var offset = this.leadIn + section * this.sectionDur;
    src.start(when, offset, dur);
    this.queue.push({ section: section, startTime: when, endTime: when + dur, trackIndex: trackIndex, source: src, gain: gain });
    this.lastScheduled = { section: section, trackIndex: trackIndex };
  };

  NamPlayer.prototype.scheduler = function () {
    var ctx = getCtx();
    while (this.isPlaying && this.pendingSection != null &&
           this.nextSectionTime < ctx.currentTime + LOOKAHEAD) {
      this.scheduleSection(this.pendingSection, this.nextSectionTime);
      var prev = this.pendingSection;
      this.nextSectionTime += this.sectionDur;
      this.pendingSection = this.nextEnabled(prev + 1);
    }
    var now = ctx.currentTime;
    while (this.queue.length && this.queue[0].endTime < now - 0.05) { this.queue.shift(); }
    // Nothing enabled and everything queued has finished => idle (keeps user intent).
    if (this.pendingSection == null && this.queue.length === 0) { this.idle(); }
  };

  NamPlayer.prototype.play = function () {
    var self = this;
    var ctx = this.ensureAudio();
    if (!ctx) { this.setStatus('Web Audio is not supported in this browser.'); return; }
    this.intendedPlaying = true;
    this.updateTransport();
    if (ctx.state === 'suspended') { ctx.resume(); }
    if (!this.loaded) {
      this.setStatus('Loading audio…');
      this.load().then(function () {
        self.setStatus('');
        if (self.intendedPlaying) { self.startPlayback(); }
      }, function (err) {
        self.intendedPlaying = false;
        self.updateTransport();
        self.setStatus('Could not load audio: ' + err.message);
      });
      return;
    }
    this.startPlayback();
  };

  NamPlayer.prototype.startPlayback = function () {
    if (this.isPlaying) { return; }
    var first = this.nextEnabled(0);
    if (first == null) { return; } // nothing enabled yet
    this.isPlaying = true;
    this.lastScheduled = null;
    this.queue = [];
    this.pendingSection = first;
    this.nextSectionTime = getCtx().currentTime + START_DELAY;
    var self = this;
    this.timerId = setInterval(function () { self.scheduler(); }, TICK);
    this.scheduler();
    this.startRaf();
    this.updateTransport();
  };

  // Stop the scheduler and silence queued sources. `keepIntent` true => auto-idle
  // (e.g. all sections unchecked) so re-checking resumes; false => explicit user pause.
  NamPlayer.prototype.stopPlayback = function (keepIntent) {
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    for (var i = 0; i < this.queue.length; i++) {
      try { this.queue[i].source.stop(); } catch (e) {}
    }
    this.queue = [];
    this.lastScheduled = null;
    this.pendingSection = null;
    this.isPlaying = false;
    if (!keepIntent) { this.intendedPlaying = false; }
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.clearPlayhead();
    this.updateTransport();
  };

  NamPlayer.prototype.pause = function () { this.stopPlayback(false); };
  NamPlayer.prototype.idle = function () { this.stopPlayback(true); };

  NamPlayer.prototype.toggle = function () {
    if (this.intendedPlaying) { this.pause(); } else { this.play(); }
  };

  /* ---- UI ---- */

  NamPlayer.prototype.buildDOM = function () {
    var self = this;
    this.root.innerHTML = '';

    if (!this.tracks.length) {
      this.root.appendChild(el('div', 'nam-status', 'No tracks configured for this player.'));
      return;
    }

    // Transport
    var transport = el('div', 'nam-transport');
    this.playBtn = el('button', 'nam-play');
    this.playBtn.type = 'button';
    this.playBtn.addEventListener('click', function () { self.toggle(); });
    transport.appendChild(this.playBtn);

    this.readout = el('span', 'nam-readout');
    transport.appendChild(this.readout);

    var volWrap = el('label', 'nam-vol');
    volWrap.appendChild(document.createTextNode('Vol'));
    var vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.01'; vol.value = '1';
    vol.addEventListener('input', function () {
      self.volume = parseFloat(vol.value);
      if (self.masterGain) { self.masterGain.gain.value = self.volume; }
    });
    volWrap.appendChild(vol);
    transport.appendChild(volWrap);
    this.root.appendChild(transport);

    // Table
    var scroll = el('div', 'nam-table-scroll');
    var table = el('table', 'nam-table');

    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    hr.appendChild(el('th', 'nam-corner', 'Track'));
    this.secInputs = [];
    for (var s = 0; s < this.sectionsCount; s++) {
      var th = el('th', 'nam-sec-head');
      var lbl = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.setAttribute('data-sec', String(s));
      cb.setAttribute('aria-label', 'Enable section ' + (s + 1));
      cb.addEventListener('change', (function (idx, input) {
        return function () { self.onSectionToggle(idx, input.checked); };
      })(s, cb));
      lbl.appendChild(cb);
      lbl.appendChild(el('span', 'nam-sec-num', String(s + 1)));
      th.appendChild(lbl);
      hr.appendChild(th);
      this.secInputs.push(cb);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    this.rowEls = [];
    this.cellEls = []; // [row][section]
    for (var t = 0; t < this.tracks.length; t++) {
      var tr = el('tr', 'nam-row');
      if (t === 0) { tr.className += ' is-selected'; }
      var head = el('th', 'nam-track-head');
      var rl = document.createElement('label');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = this.id + '-track';
      if (t === 0) { radio.checked = true; }
      radio.addEventListener('change', (function (idx) {
        return function () { self.onTrackSelect(idx); };
      })(t));
      rl.appendChild(radio);
      rl.appendChild(el('span', 'nam-track-name', this.tracks[t].name || ('Track ' + (t + 1))));
      head.appendChild(rl);
      tr.appendChild(head);

      var rowCells = [];
      for (var c = 0; c < this.sectionsCount; c++) {
        var td = el('td', 'nam-cell');
        td.setAttribute('data-sec', String(c));
        var fill = el('span', 'nam-cell-fill');
        td.appendChild(fill);
        td._fill = fill;
        tr.appendChild(td);
        rowCells.push(td);
      }
      tbody.appendChild(tr);
      this.rowEls.push(tr);
      this.cellEls.push(rowCells);
    }
    table.appendChild(tbody);
    scroll.appendChild(table);
    this.root.appendChild(scroll);

    this.status = el('div', 'nam-status');
    this.root.appendChild(this.status);

    if (!AC) { this.setStatus('Web Audio is not supported in this browser.'); }
    this.updateTransport();
  };

  NamPlayer.prototype.onSectionToggle = function (idx, checked) {
    this.enabled[idx] = checked;
    this.applyColumnState(idx);
    // If the about-to-be-scheduled section was just disabled, advance past it.
    if (this.pendingSection != null && !this.enabled[this.pendingSection]) {
      this.pendingSection = this.nextEnabled(this.pendingSection);
    }
    // Resume from auto-idle once something is enabled again.
    if (this.intendedPlaying && !this.isPlaying && this.loaded && this.nextEnabled(0) != null) {
      this.startPlayback();
    }
  };

  NamPlayer.prototype.onTrackSelect = function (idx) {
    this.currentTrackIndex = idx;
    for (var i = 0; i < this.rowEls.length; i++) {
      toggleClass(this.rowEls[i], 'is-selected', i === idx);
    }
    // Takes effect at the next section boundary (scheduler reads currentTrackIndex).
  };

  NamPlayer.prototype.applyColumnState = function (idx) {
    var on = this.enabled[idx];
    if (this.secInputs[idx]) { this.secInputs[idx].checked = on; }
    for (var r = 0; r < this.cellEls.length; r++) {
      toggleClass(this.cellEls[r][idx], 'is-off', !on);
    }
  };

  NamPlayer.prototype.startRaf = function () {
    var self = this;
    function frame() {
      if (!self.isPlaying) { self.rafId = null; return; }
      self.renderPlayhead();
      self.rafId = requestAnimationFrame(frame);
    }
    if (!this.rafId) { this.rafId = requestAnimationFrame(frame); }
  };

  NamPlayer.prototype.renderPlayhead = function () {
    var ctx = getCtx();
    var now = ctx.currentTime;
    var active = null;
    for (var i = 0; i < this.queue.length; i++) {
      var q = this.queue[i];
      if (now >= q.startTime && now < q.endTime) { active = q; break; }
    }
    this.clearPlayhead();
    if (!active) { return; }
    var cell = this.cellEls[active.trackIndex] && this.cellEls[active.trackIndex][active.section];
    if (cell) {
      toggleClass(cell, 'is-active', true);
      var p = (now - active.startTime) / this.sectionDur;
      cell._fill.style.width = Math.max(0, Math.min(1, p)) * 100 + '%';
    }
    this.readout.textContent = this.bpm + ' BPM · Section ' + (active.section + 1);
  };

  NamPlayer.prototype.clearPlayhead = function () {
    if (!this.cellEls) { return; }
    for (var r = 0; r < this.cellEls.length; r++) {
      for (var c = 0; c < this.cellEls[r].length; c++) {
        var cell = this.cellEls[r][c];
        toggleClass(cell, 'is-active', false);
        cell._fill.style.width = '0%';
      }
    }
  };

  NamPlayer.prototype.updateTransport = function () {
    if (!this.playBtn) { return; }
    var playing = this.intendedPlaying;
    this.playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    toggleClass(this.playBtn, 'is-playing', playing);
    if (!this.isPlaying) {
      this.readout.textContent = this.bpm + ' BPM' + (playing ? ' · …' : '');
    }
  };

  NamPlayer.prototype.setStatus = function (msg) {
    if (this.status) { this.status.textContent = msg || ''; }
  };

  /* ---- helpers ---- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function toggleClass(node, cls, on) {
    if (!node) { return; }
    if (node.classList) { node.classList.toggle(cls, !!on); return; }
    var has = (' ' + node.className + ' ').indexOf(' ' + cls + ' ') !== -1;
    if (on && !has) { node.className += ' ' + cls; }
    else if (!on && has) { node.className = (' ' + node.className + ' ').replace(' ' + cls + ' ', ' ').trim(); }
  }

  function init() {
    var players = document.querySelectorAll('.nam-player');
    for (var i = 0; i < players.length; i++) {
      if (!players[i].getAttribute('data-nam-init')) {
        players[i].setAttribute('data-nam-init', '1');
        new NamPlayer(players[i]);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
