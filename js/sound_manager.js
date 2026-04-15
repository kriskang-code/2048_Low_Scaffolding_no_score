



















var SoundManager = (function () {
    "use strict";

    
    var _ctx = null;
    var _muted = false;
    var _masterGain = null;

    function _getCtx() {
        if (!_ctx) {
            _ctx = new (window.AudioContext || window.webkitAudioContext)();
            _masterGain = _ctx.createGain();
            _masterGain.gain.value = 0.55;
            _masterGain.connect(_ctx.destination);
        }
        if (_ctx.state === "suspended") _ctx.resume();
        return _ctx;
    }

    
    
    
    
    function _unlockAudio() {
        _getCtx();
        ["pointerdown", "touchstart", "keydown"].forEach(function (ev) {
            document.removeEventListener(ev, _unlockAudio, true);
        });
    }
    ["pointerdown", "touchstart", "keydown"].forEach(function (ev) {
        document.addEventListener(ev, _unlockAudio, { capture: true, once: true, passive: true });
    });

    
    function _makeClipCurve(amount) {
        var n = 256;
        var curve = new Float32Array(n);
        var k = amount;
        for (var i = 0; i < n; i++) {
            var x = (i * 2) / n - 1;
            curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    
    
    
    
    
    
    
    
    function _osc(freq, type, attack, sustain, decay, delay, dest) {
        var ctx = _getCtx();
        var osc = ctx.createOscillator();
        var env = ctx.createGain();
        osc.type = type;
        osc.frequency.value = Array.isArray(freq) ? freq[0] : freq;
        osc.connect(env);
        env.connect(dest || _masterGain);

        var now = ctx.currentTime + (delay || 0);
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(sustain, now + attack);
        env.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

        osc.start(now);
        osc.stop(now + attack + decay + 0.05);

        
        if (Array.isArray(freq)) {
            for (var i = 1; i < freq.length; i += 2) {
                osc.frequency.setValueAtTime(freq[i], now + freq[i + 1]);
            }
        }
        return osc;
    }

    
    
    
    
    
    
    
    function _noise(duration, filterStart, filterEnd, gainVal, delay, dest) {
        var ctx = _getCtx();
        var sr = ctx.sampleRate;
        var len = Math.ceil(sr * (duration + 0.05));
        var buf = ctx.createBuffer(1, len, sr);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

        var src = ctx.createBufferSource();
        src.buffer = buf;

        var filt = ctx.createBiquadFilter();
        filt.type = "bandpass";
        filt.Q.value = 0.85;
        filt.frequency.value = filterStart;

        var env = ctx.createGain();
        src.connect(filt);
        filt.connect(env);
        env.connect(dest || _masterGain);

        var now = ctx.currentTime + (delay || 0);
        filt.frequency.setValueAtTime(filterStart, now);
        filt.frequency.exponentialRampToValueAtTime(filterEnd || filterStart, now + duration);
        env.gain.setValueAtTime(gainVal, now);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        src.start(now);
        src.stop(now + duration + 0.05);
    }

    
    
    var _puOsc1 = null;  
    var _puOsc2 = null;  
    var _puNoiseSrc = null;  
    var _puGain = null;  
    var _puNoiseFilt = null;  
    var _puStartTime = null;  

    
    function _stopPowerUp() {
        if (!_puGain) return;
        var ctx = _getCtx();
        var now = ctx.currentTime;
        var fade = 0.025;
        _puGain.gain.cancelScheduledValues(now);
        _puGain.gain.setValueAtTime(_puGain.gain.value, now);
        _puGain.gain.linearRampToValueAtTime(0, now + fade);
        var stopAt = now + fade + 0.01;
        try { _puOsc1.stop(stopAt); } catch (e) { }
        try { _puOsc2.stop(stopAt); } catch (e) { }
        try { _puNoiseSrc.stop(stopAt); } catch (e) { }
        _puOsc1 = _puOsc2 = _puNoiseSrc = _puGain = _puNoiseFilt = _puStartTime = null;
    }

    

    
    function _playMove() {
        _noise(0.10, 600, 120, 0.25, 0);
        _osc(55, "sine", 0.005, 0.18, 0.09, 0);
    }

    
    function _playMerge() {
        _osc(65, "sine", 0.002, 0.80, 0.22, 0.00);
        _osc(130, "sine", 0.002, 0.40, 0.14, 0.00);
        _osc(210, "sawtooth", 0.002, 0.12, 0.08, 0.00);
        _osc(1320, "sine", 0.002, 0.22, 0.28, 0.02);
        _osc(1760, "sine", 0.002, 0.16, 0.35, 0.04);
        _osc(2640, "sine", 0.002, 0.10, 0.40, 0.07);
        _noise(0.06, 800, 3200, 0.18, 0);
    }

    
    function _playSpawn() {
        _osc(1046, "sine", 0.003, 0.28, 0.30, 0.00);
        _osc(1568, "sine", 0.003, 0.12, 0.25, 0.01);
        _osc(2093, "sine", 0.003, 0.06, 0.20, 0.02);
    }

    
    
    
    
    function _playUndo() {
        
        var notes = [1568, 1318, 1046];
        var delays = [0.00, 0.06, 0.12];
        for (var i = 0; i < notes.length; i++) {
            _osc(notes[i], "sine", 0.002, 0.32, 0.14, delays[i]);     
            _osc(notes[i] * 2, "triangle", 0.001, 0.09, 0.10, delays[i]);     
        }
        
        _noise(0.18, 200, 5000, 0.10, 0.00);
        
        _osc(2093, "sine", 0.001, 0.16, 0.10, 0.14);   
    }

    
    
    
    function _playSwapSelect() {
        _stopPowerUp(); 

        var ctx = _getCtx();
        var now = ctx.currentTime;
        _puStartTime = now;

        
        _puGain = ctx.createGain();
        _puGain.gain.setValueAtTime(0, now);
        _puGain.gain.linearRampToValueAtTime(0.20, now + 0.12); 
        _puGain.gain.linearRampToValueAtTime(0.24, now + 4.0);  
        _puGain.connect(_masterGain);

        
        _puOsc1 = ctx.createOscillator();
        _puOsc1.type = "sine";
        _puOsc1.frequency.setValueAtTime(1046, now);          
        _puOsc1.frequency.linearRampToValueAtTime(1318, now + 4.0); 
        var g1 = ctx.createGain();
        g1.gain.value = 0.55;
        _puOsc1.connect(g1);
        g1.connect(_puGain);
        _puOsc1.start(now);

        
        _puOsc2 = ctx.createOscillator();
        _puOsc2.type = "triangle";
        _puOsc2.frequency.setValueAtTime(1568, now);          
        _puOsc2.frequency.linearRampToValueAtTime(1760, now + 4.0); 
        var g2 = ctx.createGain();
        g2.gain.value = 0.35;
        _puOsc2.connect(g2);
        g2.connect(_puGain);
        _puOsc2.start(now);

        
        var sr = ctx.sampleRate;
        var bufLen = Math.round(sr * 0.5);
        var buf = ctx.createBuffer(1, bufLen, sr);
        var data = buf.getChannelData(0);
        for (var i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        _puNoiseSrc = ctx.createBufferSource();
        _puNoiseSrc.buffer = buf;
        _puNoiseSrc.loop = true;
        _puNoiseFilt = ctx.createBiquadFilter();
        _puNoiseFilt.type = "highpass";
        _puNoiseFilt.Q.value = 0.5;
        _puNoiseFilt.frequency.setValueAtTime(6000, now); 
        var gn = ctx.createGain();
        gn.gain.value = 0.08; 
        _puNoiseSrc.connect(_puNoiseFilt);
        _puNoiseFilt.connect(gn);
        gn.connect(_puGain);
        _puNoiseSrc.start(now);

        
        _osc(1046, "sine", 0.002, 0.28, 0.30, 0.00); 
        _osc(1568, "sine", 0.002, 0.14, 0.24, 0.02); 
        _osc(2093, "triangle", 0.001, 0.08, 0.20, 0.04); 
        _noise(0.05, 5000, 8000, 0.08, 0.00);             
    }




    
    function _playSwapConfirm() {
        if (!_puOsc1 || !_puGain) return; 
        var ctx = _getCtx();
        var now = ctx.currentTime;

        
        _puOsc1.frequency.cancelScheduledValues(now);
        _puOsc1.frequency.setValueAtTime(_puOsc1.frequency.value, now);
        _puOsc1.frequency.linearRampToValueAtTime(1568, now + 0.55); 

        _puOsc2.frequency.cancelScheduledValues(now);
        _puOsc2.frequency.setValueAtTime(_puOsc2.frequency.value, now);
        _puOsc2.frequency.linearRampToValueAtTime(2093, now + 0.55); 

        
        _puGain.gain.cancelScheduledValues(now);
        _puGain.gain.setValueAtTime(_puGain.gain.value, now);
        _puGain.gain.linearRampToValueAtTime(0.32, now + 0.45);

        
        
        var notes = [1046, 1318, 1568, 2093];
        var delays = [0.00, 0.12, 0.24, 0.38];
        for (var i = 0; i < notes.length; i++) {
            _osc(notes[i], "sine", 0.002, 0.22, 0.20, delays[i]);
            _osc(notes[i] * 2, "triangle", 0.001, 0.07, 0.14, delays[i] + 0.01);
        }
        
        _noise(0.04, 4000, 7000, 0.07, 0.00);
        _noise(0.04, 5000, 8000, 0.07, 0.24);
    }

    
    
    
    function _playSwap() {
        _stopPowerUp(); 

        var ctx = _getCtx();
        var now = ctx.currentTime;

        
        var subOsc = ctx.createOscillator();
        var subEnv = ctx.createGain();
        var shaper = ctx.createWaveShaper();
        shaper.curve = _makeClipCurve(180);
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(42, now);
        subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.35);
        subOsc.connect(shaper);
        shaper.connect(subEnv);
        subEnv.connect(_masterGain);
        subEnv.gain.setValueAtTime(0, now);
        subEnv.gain.linearRampToValueAtTime(0.92, now + 0.001);
        subEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.90);
        subOsc.start(now);
        subOsc.stop(now + 0.95);

        _osc(58, "sine", 0.001, 0.78, 0.65, 0.00);
        _osc(82, "triangle", 0.001, 0.54, 0.48, 0.00);

        
        _osc(120, "sawtooth", 0.001, 0.52, 0.22, 0.00);
        _osc(190, "sawtooth", 0.001, 0.34, 0.16, 0.00);
        _osc(260, "square", 0.001, 0.22, 0.11, 0.01);

        
        _noise(0.06, 7000, 500, 0.65, 0.000);
        _noise(0.15, 3000, 200, 0.42, 0.022);
        _noise(0.60, 600, 50, 0.30, 0.055);
        _noise(0.45, 1200, 120, 0.20, 0.085);

        
        _osc(1760, "sine", 0.001, 0.24, 0.72, 0.04);
        _osc(2640, "sine", 0.001, 0.19, 0.82, 0.06);
        _osc(3520, "sine", 0.001, 0.14, 0.78, 0.08);
        _osc(4400, "sine", 0.001, 0.10, 0.68, 0.10);
        _osc(5280, "sine", 0.001, 0.07, 0.58, 0.12);
        _osc(6160, "sine", 0.001, 0.04, 0.52, 0.14);

        
        _osc(44, "sine", 0.04, 0.40, 1.35, 0.08);
        _osc(88, "sine", 0.04, 0.24, 1.05, 0.10);
    }

    
    function _playWin() {
        var notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5];
        var delay = 0;
        for (var i = 0; i < notes.length; i++) {
            _osc(notes[i], "sine", 0.008, 0.50, 0.55, delay);
            _osc(notes[i], "triangle", 0.008, 0.20, 0.55, delay);
            delay += 0.10;
        }
        var chord = [523.25, 659.25, 783.99];
        for (var j = 0; j < chord.length; j++) {
            _osc(chord[j], "sine", 0.02, 0.35, 0.80, delay);
        }
        _noise(0.60, 400, 6000, 0.12, delay);
    }

    
    function _playGameover() {
        var notes = [440, 392, 349.23, 329.63, 261.63];
        var delay = 0;
        for (var i = 0; i < notes.length; i++) {
            _osc(notes[i], "sine", 0.02, 0.45, 0.50, delay);
            _osc(notes[i] * 0.5, "triangle", 0.02, 0.20, 0.50, delay);
            delay += 0.14;
        }
        _osc(40, "sine", 0.05, 0.55, 1.00, delay - 0.10);
        _noise(0.70, 180, 60, 0.22, 0.30);
    }

    
    
    

    function _playBlackHole() {
        var ctx = _getCtx();
        var now = ctx.currentTime;

        var master = ctx.createGain();
        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(0.45, now + 0.04);
        master.gain.linearRampToValueAtTime(0.35, now + 0.25);
        master.gain.exponentialRampToValueAtTime(0.001, now + 0.50);
        master.connect(_masterGain);

        
        var sr = ctx.sampleRate;
        var len = Math.ceil(sr * 0.55);
        var buf = ctx.createBuffer(1, len, sr);
        var d = buf.getChannelData(0);
        for (var j = 0; j < len; j++) d[j] = Math.random() * 2 - 1;
        var nSrc = ctx.createBufferSource();
        nSrc.buffer = buf;
        var lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.Q.value = 1.2;
        lp.frequency.setValueAtTime(4000, now);
        lp.frequency.exponentialRampToValueAtTime(200, now + 0.45);
        var nEnv = ctx.createGain();
        nEnv.gain.setValueAtTime(0.30, now);
        nEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        nSrc.connect(lp);
        lp.connect(nEnv);
        nEnv.connect(master);
        nSrc.start(now);
        nSrc.stop(now + 0.55);

        
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.40);
        var oEnv = ctx.createGain();
        oEnv.gain.setValueAtTime(0.15, now);
        oEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.connect(oEnv);
        oEnv.connect(master);
        osc.start(now);
        osc.stop(now + 0.50);

        
        var pop = ctx.createOscillator();
        pop.type = "sine";
        pop.frequency.setValueAtTime(800, now);
        pop.frequency.exponentialRampToValueAtTime(300, now + 0.08);
        var popEnv = ctx.createGain();
        popEnv.gain.setValueAtTime(0.12, now);
        popEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
        pop.connect(popEnv);
        popEnv.connect(master);
        pop.start(now);
        pop.stop(now + 0.15);
    }


    

    var _sounds = {
        move: _playMove,
        merge: _playMerge,
        spawn: _playSpawn,
        undo: _playUndo,
        swapSelect: _playSwapSelect,
        swapConfirm: _playSwapConfirm,
        swap: _playSwap,
        blackHole: _playBlackHole,
        win: _playWin,
        gameover: _playGameover
    };

    
    var _terminalPlayed = false;

    function play(name) {
        if (_muted) return;
        var fn = _sounds[name];
        if (!fn) return;
        if ((name === "win" || name === "gameover")) {
            if (_terminalPlayed) return;
            _terminalPlayed = true;
        }
        try { fn(); } catch (e) {  }
    }

    function resetTerminal() {
        _terminalPlayed = false;
    }

    function toggleMute() {
        _muted = !_muted;
        if (_masterGain) {
            _masterGain.gain.cancelScheduledValues(_getCtx().currentTime);
            _masterGain.gain.setValueAtTime(_muted ? 0 : 0.55, _getCtx().currentTime);
        }
        return _muted;
    }

    function isMuted() { return _muted; }

    return { play: play, stopPowerUp: _stopPowerUp, toggleMute: toggleMute, isMuted: isMuted, resetTerminal: resetTerminal };
}());

