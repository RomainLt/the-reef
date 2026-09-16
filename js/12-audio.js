/* The Reef — Sound, synthesised on the fly
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* SOUND (all synthesised, no audio files)                            */
/* ================================================================== */
var SND = {
  ctx: null, master: null, muted: false, noiseBuf: null, ready: false,
  init: function () {
    if (this.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    // brown noise for the ambience
    var len = this.ctx.sampleRate * 2;
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;
    this.ready = true;
    this.ambient();
    this.currentVoice();
  },
  ambient: function () {
    if (!this.ready) return;
    var c = this.ctx;
    var src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.7;
    var g = c.createGain(); g.gain.value = 0.32;
    var lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 0.14;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(); lfo.start();
    this.amb = { filt: lp };      // the current opens this filter a little
    // very low pad
    var o = c.createOscillator(), og = c.createGain();
    o.type = 'sine'; o.frequency.value = 58; og.gain.value = 0.05;
    o.connect(og); og.connect(this.master); o.start();
  },
  /* The voice of the current: brown noise through a band-pass whose level,
         brightness and stereo position follow the current in the game. No LFO
         here, unlike the ambience — and that is exactly the point: if the sound
         breathed on its own, you would hear one thing and see another. The
         band-pass is wide (Q 0.55) to make a rush rather than a whistle, and it
         lives above the 320 Hz of the ambient bed, so the two do not tread on
         each other. */
  currentVoice: function () {
    if (!this.ready) return;
    var c = this.ctx;
    var src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.55;
    var g = c.createGain(); g.gain.value = 0.04;
    src.connect(bp); bp.connect(g);
    var pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { g.connect(pan); pan.connect(this.master); } else { g.connect(this.master); }
    src.start();
    this.cur = { gain: g, filt: bp, pan: pan, next: 0 };
  },

  /**
       * Follows the current. `force` ∈ ~[0,1] (gust included), `side` ∈ [-1,1]
       * is its direction relative to where you are looking.
       * `setTargetAtTime` rather than ramps: it is an exponential approach, so
       * no click even when called mid-glide, and the time constant does all the
       * smoothing. Limited to ~8 times a second, which is plenty for half-second
       * constants and avoids piling up 60 automation events per second per
       * parameter.
       */
  setCurrent: function (force, side) {
    var C = this.cur;
    if (!C) return;
    var t = this.ctx.currentTime;
    if (t < C.next) return;
    C.next = t + 0.12;
    var f = clamp(force, 0, 1.25);
    C.gain.gain.setTargetAtTime(0.035 + f * 0.145, t, 0.5);
    C.filt.frequency.setTargetAtTime(330 + f * 560, t, 0.7);
    if (C.pan) C.pan.pan.setTargetAtTime(clamp(side, -1, 1) * 0.7, t, 0.6);
    // the ambient bed opens a little during gusts: that is what makes you hear
    // "the water is moving" rather than "a rush laid over the water"
    if (this.amb) this.amb.filt.frequency.setTargetAtTime(300 + f * 150, t, 1.1);
  },

  /** Two soft descending notes: "he has lost you". */
  safe: function () {
    if (!this.ready || this.muted) return;
    var c = this.ctx, t = c.currentTime;
    var notes = [[392, 0], [294, 0.13]];
    for (var i = 0; i < notes.length; i++) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(notes[i][0], t + notes[i][1]);
      this.env(g, t + notes[i][1], 0.02, 0.34, 0.13 - i * 0.02);
      o.connect(g); g.connect(this.master);
      o.start(t + notes[i][1]); o.stop(t + notes[i][1] + 0.45);
    }
  },

  env: function (node, t0, a, d, peak) {
    var g = node.gain;
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(peak, t0 + a);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  },
  blip: function (freq, dur, type, vol, detune) {
    if (!this.ready || this.muted) return;
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.frequency.exponentialRampToValueAtTime(Math.max(freq * detune, 20), t + dur);
    this.env(g, t, 0.012, dur, vol === undefined ? 0.22 : vol);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.08);
  },
  noiseHit: function (f0, f1, dur, vol) {
    if (!this.ready || this.muted) return;
    var c = this.ctx, t = c.currentTime;
    var s = c.createBufferSource(); s.buffer = this.noiseBuf;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = c.createGain();
    this.env(g, t, 0.02, dur, vol === undefined ? 0.18 : vol);
    s.connect(bp); bp.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.1);
  },
  pickup: function (n) {
    var scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5];
    var f = scale[Math.min(n, scale.length - 1)];
    this.blip(f, 0.30, 'triangle', 0.20);
    this.blip(f * 2, 0.22, 'sine', 0.10);
    var self = this;
    setTimeout(function () { self.blip(f * 1.5, 0.26, 'triangle', 0.12); }, 90);
  },
  sting: function () { this.blip(210, 0.4, 'sawtooth', 0.16, 0.22); this.noiseHit(1800, 300, 0.35, 0.14); },
  bubble: function () { this.blip(rr(500, 1100), 0.12, 'sine', 0.05, 2.6); },
  whoosh: function () { this.noiseHit(350, 1500, 0.35, 0.09); },
  talk: function () { this.blip(rr(620, 780), 0.07, 'square', 0.045, 1.25); },
  quest: function () {
    var self = this;
    [523.25, 659.25, 880].forEach(function (f, i) {
      setTimeout(function () { self.blip(f, 0.24, 'triangle', 0.16); }, i * 90);
    });
  },
  growl: function () {
    if (!this.ready || this.muted) return;
    this.blip(90, 0.7, 'sawtooth', 0.20, 0.45);
    this.noiseHit(400, 90, 0.6, 0.16);
  },
  whale: function () {
    if (!this.ready || this.muted) return;
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 1.4);
    o.frequency.exponentialRampToValueAtTime(58, t + 3.4);
    f.type = 'lowpass'; f.frequency.value = 500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.6);
    g.gain.linearRampToValueAtTime(0.10, t + 2.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 3.7);
  },
  win: function () {
    var self = this, s = [523.25, 659.25, 783.99, 1046.5];
    s.forEach(function (f, i) { setTimeout(function () { self.blip(f, 0.5, 'triangle', 0.2); self.blip(f * 2, 0.4, 'sine', 0.08); }, i * 150); });
  }
};
