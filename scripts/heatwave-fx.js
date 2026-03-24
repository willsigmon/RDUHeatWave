/* ═══════════════════════════════════════════════════════════════════
   RDU Heatwave — Haptics, Sound & Motion FX Engine
   No external dependencies. Uses Vibration API, Web Audio, DeviceOrientation.
   ═══════════════════════════════════════════════════════════════════ */

var HeatFX = (function() {
  'use strict';

  /* ── Feature detection ── */
  var canVibrate = !!navigator.vibrate;
  var audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  /* Unlock audio on first user gesture (iOS requirement) */
  function unlockAudio() {
    var ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('click', unlockAudio, { once: true });

  /* ── Haptics ── */
  var haptics = {
    tap: function()    { if (canVibrate) navigator.vibrate(8); },
    light: function()  { if (canVibrate) navigator.vibrate(4); },
    medium: function() { if (canVibrate) navigator.vibrate(18); },
    heavy: function()  { if (canVibrate) navigator.vibrate(40); },
    double: function() { if (canVibrate) navigator.vibrate([12, 40, 12]); },
    success: function(){ if (canVibrate) navigator.vibrate([8, 30, 8, 30, 15]); },
    swipe: function()  { if (canVibrate) navigator.vibrate(6); },
    rumble: function(ms) { if (canVibrate) navigator.vibrate(ms || 60); },
    pattern: function(arr) { if (canVibrate) navigator.vibrate(arr); },
    /* Steam blast: heavy escalating rumble */
    steamBlast: function() {
      if (canVibrate) navigator.vibrate([30, 20, 50, 15, 80, 10, 120, 8, 160]);
    },
    /* Pour: continuous gentle throb */
    pourPulse: function() {
      if (canVibrate) navigator.vibrate([6, 80, 4, 120, 6, 80, 4, 120, 6, 80]);
    }
  };

  /* ── Sound synthesis ── */
  var sounds = {

    /* Beer pouring — filtered brown noise with liquid gurgle */
    pourLoop: null,
    pourGain: null,
    startPour: function() {
      var ctx = getAudioCtx();
      if (!ctx) return;
      if (sounds.pourLoop) return; /* already playing */

      /* Brown noise via filtered buffer */
      var bufSize = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      var data = buf.getChannelData(0);
      var last = 0;
      for (var i = 0; i < bufSize; i++) {
        var white = Math.random() * 2 - 1;
        data[i] = (last + 0.02 * white) / 1.02;
        last = data[i];
        data[i] *= 3.5;
      }

      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      /* Bandpass to sound liquid-like */
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 320;
      bp.Q.value = 0.8;

      /* LFO for gurgle modulation */
      var lfo = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      lfo.frequency.value = 3.5;
      lfoGain.gain.value = 80;
      lfo.connect(lfoGain);
      lfoGain.connect(bp.frequency);
      lfo.start();

      var gain = ctx.createGain();
      gain.gain.value = 0;

      src.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      src.start();

      /* Fade in */
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.5);

      sounds.pourLoop = src;
      sounds.pourGain = gain;
      sounds._pourLfo = lfo;
    },

    stopPour: function() {
      var ctx = getAudioCtx();
      if (!ctx || !sounds.pourLoop) return;
      sounds.pourGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      var src = sounds.pourLoop;
      var lfo = sounds._pourLfo;
      setTimeout(function() {
        try { src.stop(); } catch(e) {}
        try { lfo.stop(); } catch(e) {}
      }, 500);
      sounds.pourLoop = null;
      sounds.pourGain = null;
      sounds._pourLfo = null;
    },

    /* Steam hiss — white noise burst with high-pass, like a bus kneeling */
    steamHiss: function() {
      var ctx = getAudioCtx();
      if (!ctx) return;

      var dur = 1.8;
      var bufSize = Math.ceil(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      var src = ctx.createBufferSource();
      src.buffer = buf;

      /* High-pass for hiss character */
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2000;
      hp.Q.value = 0.5;

      /* Resonant peak for that "psshhhh" */
      var peak = ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = 4000;
      peak.gain.value = 8;
      peak.Q.value = 2;

      var gain = ctx.createGain();
      var t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      src.connect(hp);
      hp.connect(peak);
      peak.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
      src.stop(t + dur);
    },

    /* Quick UI tick */
    tick: function() {
      var ctx = getAudioCtx();
      if (!ctx) return;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.frequency.value = 1800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  };

  /* ── Gyroscope / device orientation ── */
  var gyro = {
    beta: 0,   /* front-back tilt: -180 to 180 */
    gamma: 0,  /* left-right tilt: -90 to 90 */
    enabled: false,
    _listening: false,

    start: function() {
      if (gyro._listening) return;

      /* iOS 13+ requires permission */
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(function(state) {
          if (state === 'granted') gyro._bind();
        }).catch(function() {});
      } else {
        gyro._bind();
      }
    },

    _bind: function() {
      window.addEventListener('deviceorientation', function(e) {
        if (e.beta !== null) {
          gyro.beta = e.beta;
          gyro.gamma = e.gamma;
          gyro.enabled = true;
        }
      });
      gyro._listening = true;
    }
  };

  /* ── Public API ── */
  return {
    haptics: haptics,
    sounds: sounds,
    gyro: gyro,
    unlockAudio: unlockAudio
  };

})();
