/* ============================================================
 * Eaglercraft X AutoClicker  v1.11  (Ruian Client)
 * Keys:  V = toggle auto-clicker (no popup)  |  or click the AC round button = settings panel
 *       Hold left/right mouse button to auto-click, CPS 1~100, jitter supported
 * v1.11: fixed the old panel showing two "jitter amount" sliders + NaN values;
 *        the panel keeps only one jitter slider, CPS is adjusted with [-] [+] buttons;
 *        logs [RuianAC] v1.11 on load so the version can be confirmed
 * v1.10: fixed panel buttons not clickable (opening the panel exits pointer lock);
 *        clicks inside the panel no longer trigger auto-clicks
 * v1.9: CPS +/- buttons moved into the | panel ([-] [CPS] [+] button group + slider),
 *       no longer always on screen; press | or click the AC round button to adjust
 * v1.8: added [-] [CPS] [+] buttons next to the AC round button
 * v1.7: clicking the AC round button now opens the settings panel (CPS slider etc.),
 *       not just toggling
 * v1.6 fix: fixed disconnection while holding during in-game pointer lock
 *   - mousedown/mouseup are only state entries; mousemove.buttons re-checks the
 *     physical button state in real time, so lost mouseup events no longer stop wrongly
 *   - stops only on pointer lock loss / page blur; stays armed after re-lock
 * ============================================================ */
(function () {
  'use strict';
  var LS_KEY = 'eagler_autoclicker_settings';
  var DEFAULTS = { enabled: false, cps: 12, left: true, right: false, jitter: true, jitterPct: 10 };
  var settings = loadSettings();
  var held = { 0: false, 2: false };   // physical button state (0 = left, 2 = right)
  var timer = null;                    // setTimeout handle (self-scheduled, no setInterval)
  var panelEl = null;
  var btnEl = null;
  var panelCpsValEl = null;            // CPS value display inside the panel
  var cpsHoldTimer = null;
  var canvas = null;

  /* ---------- basics ---------- */
  function loadSettings() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          // filter out undefined/null fields left by old versions to prevent NaN
          Object.keys(o).forEach(function (k) { if (o[k] === undefined || o[k] === null) delete o[k]; });
          return Object.assign({}, DEFAULTS, o);
        }
      }
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }
  function saveSettings() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch (e) {}
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function getCanvas() {
    if (canvas && canvas.isConnected) return canvas;
    canvas = document.querySelector('._eaglercraftX_canvas_element') || document.querySelector('canvas');
    return canvas;
  }
  function toast(msg) {
    try {
      var t = document.getElementById('ruian_ac_toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'ruian_ac_toast';
        t.style.cssText = 'position:fixed;top:56px;right:12px;z-index:2147483647;background:rgba(0,0,0,.78);color:#fff;font:12px/1.6 sans-serif;padding:6px 12px;border-radius:6px;pointer-events:none;transition:opacity .3s;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._t);
      t._t = setTimeout(function () { t.style.opacity = '0'; }, 1600);
    } catch (e) {}
  }

  /* ---------- synthetic clicks (sent to the game canvas) ---------- */
  function fireClick(btn) {
    var c = getCanvas();
    if (!c) return;
    var opts = { bubbles: true, cancelable: true, button: btn, buttons: btn === 0 ? 1 : 2, detail: 1, view: window };
    try {
      var down = new MouseEvent('mousedown', opts); down.isAutoClick = true; c.dispatchEvent(down);
      var up = new MouseEvent('mouseup', opts); up.isAutoClick = true; c.dispatchEvent(up);
      var clk = new MouseEvent('click', opts); clk.isAutoClick = true; c.dispatchEvent(clk);
    } catch (e) {}
  }

  /* ---------- click rhythm (CPS jitter) ---------- */
  function nextInterval() {
    var base = 1000 / clamp(settings.cps, 1, 100);
    if (settings.jitter) {
      var pct = clamp(settings.jitterPct, 0, 50) / 100;
      return base * (1 + (Math.random() * 2 - 1) * pct); // e.g. 20cps ± 10% => 18~22
    }
    return base;
  }
  function anyHeld() {
    return (settings.left && held[0]) || (settings.right && held[2]);
  }
  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
  }
  function tick() {
    timer = null;
    if (!settings.enabled || !anyHeld()) { stop(); return; }
    if (settings.left && held[0]) fireClick(0);
    if (settings.right && held[2]) fireClick(2);
    timer = setTimeout(tick, nextInterval());
  }
  function ensureRunning() {
    if (settings.enabled && anyHeld() && !timer) { timer = setTimeout(tick, 30); }
  }

  /* ---------- real mouse events ---------- */
  function inPanel(t) {
    return panelEl && panelEl.isConnected && panelEl.contains(t);
  }
  function onMouseDown(e) {
    if (e.isAutoClick) return;
    if (inPanel(e.target)) return;   // clicking panel buttons does not trigger auto-click
    var b = e.button;
    if (b === 0 || b === 2) held[b] = true;
    ensureRunning();
  }
  function onMouseUp(e) {
    if (e.isAutoClick) return;
    if (inPanel(e.target)) return;
    var b = e.button;
    if (b === 0 || b === 2) held[b] = false;
    if (!anyHeld()) stop();
  }
  function onMouseMove(e) {
    if (e.isAutoClick) return; // ignore synthetic events such as aim assist
    // v1.6 core: cross-check with buttons, a lost mouseup no longer stops wrongly
    if (held[0] && !(e.buttons & 1)) held[0] = false;
    if (held[2] && !(e.buttons & 2)) held[2] = false;
    if (!anyHeld()) stop();
  }
  function onPointerLockChange() {
    if (!document.pointerLockElement) {
      // pointer lock lost (Esc/window switch) -> stop safely, keep settings, auto-resume on next press
      held[0] = held[2] = false;
      stop();
    }
  }
  function onBlur() { held[0] = held[2] = false; stop(); }
  function onKey(e) {
    if (e.isAutoClick) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var k = e.key, kc = e.keyCode, code = e.code;
    // V = direct toggle (no popup)
    if (kc === 86 || k === 'v' || k === 'V' || code === 'KeyV') {
      e.preventDefault();
      settings.enabled = !settings.enabled;
      saveSettings();
      updateBtn();
      if (!settings.enabled) stop();
      toast('AutoClicker ' + (settings.enabled ? 'ON' : 'OFF'));
      if (settings.enabled) ensureRunning();
      return;
    }
    // | or \ = open the settings panel
    if (kc === 220 || kc === 226 || k === '|' || k === '\\' || k === '｜' || k === '、' || code === 'Backslash' || code === 'IntlBackslash') {
      e.preventDefault();
      togglePanel();
      return;
    }
  }

  /* ---------- floating round button ---------- */
  function makeBtn() {
    if (btnEl && btnEl.isConnected) return;
    btnEl = document.createElement('div');
    btnEl.textContent = 'AC';
    btnEl.title = 'AutoClicker: click to open settings (V toggle / | panel)';
    btnEl.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483646;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:bold 12px/1 sans-serif;color:#fff;cursor:pointer;user-select:none;box-shadow:0 2px 8px rgba(0,0,0,.4);background:' + (settings.enabled ? '#2ecc71' : '#555') + ';';
    btnEl.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePanel();
    });
    document.body.appendChild(btnEl);
  }
  function updateBtn() {
    if (btnEl && btnEl.isConnected) btnEl.style.background = settings.enabled ? '#2ecc71' : '#555';
  }

  /* ---------- CPS adjustment (inside the panel) ---------- */
  function adjustCps(delta) {
    settings.cps = clamp(settings.cps + delta, 1, 100);
    saveSettings();
    toast('CPS ' + settings.cps);
    if (panelCpsValEl && panelCpsValEl.isConnected) panelCpsValEl.textContent = settings.cps;
  }
  function stopCpsHold() {
    if (cpsHoldTimer) { clearInterval(cpsHoldTimer); cpsHoldTimer = null; }
  }
  function holdCps(delta) {
    stopCpsHold();
    adjustCps(delta);
    cpsHoldTimer = setInterval(function () { adjustCps(delta); }, 160);
  }
  function makeCpsBtn(label, delta) {
    var b = document.createElement('div');
    b.textContent = label;
    b.style.cssText = 'width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font:bold 16px/1 sans-serif;color:#fff;cursor:pointer;user-select:none;background:#444;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    b.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      holdCps(delta);
    });
    b.addEventListener('mouseup', stopCpsHold);
    b.addEventListener('mouseleave', stopCpsHold);
    return b;
  }
  function cpsRow() {
    var r = document.createElement('div');
    r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:8px 0;';
    var l = document.createElement('span'); l.textContent = 'CPS Speed'; l.style.color = '#ccc';
    var grp = document.createElement('div');
    grp.style.cssText = 'display:flex;align-items:center;gap:6px;';
    var v = document.createElement('span');
    v.style.cssText = 'min-width:30px;text-align:center;color:#fff;font-weight:bold;font-size:14px;';
    panelCpsValEl = v;
    v.textContent = settings.cps;
    grp.appendChild(makeCpsBtn('−', -1));
    grp.appendChild(v);
    grp.appendChild(makeCpsBtn('+', 1));
    r.appendChild(l); r.appendChild(grp);
    return r;
  }

  /* ---------- settings panel ---------- */
  function togglePanel() {
    if (panelEl && panelEl.isConnected) { panelEl.remove(); panelEl = null; return; }
    // exit pointer lock when opening the panel: locked mouse cannot click panel buttons in game
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    panelEl = document.createElement('div');
    panelEl.style.cssText = 'position:fixed;top:12px;right:54px;z-index:2147483647;width:260px;background:rgba(18,18,24,.94);color:#eee;border:1px solid #333;border-radius:10px;padding:14px;font:13px/1.5 sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);';
    var h = document.createElement('div');
    h.style.cssText = 'font-weight:bold;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;';
    h.innerHTML = '<span>AutoClicker Settings</span><span style="color:#888;font-weight:normal;font-size:11px">| Close</span>';
    panelEl.appendChild(h);
    panelEl.appendChild(row('Enable AutoClicker', toggle('enabled', function (v) {
      if (!v) stop();
      updateBtn();
      toast('AutoClicker ' + (v ? 'ON' : 'OFF'));
    })));
    panelEl.appendChild(cpsRow());
    panelEl.appendChild(row('Left-Click', toggle('left')));
    panelEl.appendChild(row('Right-Click', toggle('right')));
    panelEl.appendChild(row('CPS Jitter', toggle('jitter')));
    panelEl.appendChild(slider('jitterPct', 0, 50, 1, 'Jitter Amount', '%'));
    var tip = document.createElement('div');
    tip.style.cssText = 'margin-top:8px;color:#999;font-size:11px;line-height:1.8;';
    tip.innerHTML = 'V toggles auto-click · | opens this panel<br>Hold left/right button to auto-click';
    panelEl.appendChild(tip);
    document.body.appendChild(panelEl);
  }
  function row(label, ctrl) {
    var r = document.createElement('div');
    r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:6px 0;';
    var l = document.createElement('span'); l.textContent = label; l.style.color = '#ccc';
    r.appendChild(l); r.appendChild(ctrl);
    return r;
  }
  function toggle(key, onChange) {
    var b = document.createElement('div');
    b.style.cssText = 'width:40px;height:22px;border-radius:11px;background:' + (settings[key] ? '#2ecc71' : '#444') + ';position:relative;cursor:pointer;transition:background .2s;flex:none;';
    var k = document.createElement('div');
    k.style.cssText = 'position:absolute;top:2px;left:' + (settings[key] ? '20px' : '2px') + ';width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s;';
    b.appendChild(k);
    b.addEventListener('click', function () {
      settings[key] = !settings[key];
      b.style.background = settings[key] ? '#2ecc71' : '#444';
      k.style.left = settings[key] ? '20px' : '2px';
      saveSettings();
      if (onChange) onChange(settings[key]);
    });
    return b;
  }
  function slider(key, min, max, step, label, unit) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin:8px 0;';
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;color:#ccc;';
    var lab = document.createElement('span'); lab.textContent = label;
    // NaN fallback: old local settings may keep invalid values
    var safe = (typeof settings[key] === 'number' && isFinite(settings[key])) ? clamp(settings[key], min, max) : min;
    var val = document.createElement('span'); val.textContent = safe + (unit || '');
    val.style.color = '#fff'; val.style.fontWeight = 'bold';
    head.appendChild(lab); head.appendChild(val);
    var inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = safe;
    inp.style.cssText = 'width:100%;margin:4px 0 0;accent-color:#2ecc71;';
    inp.addEventListener('input', function () {
      settings[key] = parseInt(inp.value, 10);
      val.textContent = settings[key] + (unit || '');
      saveSettings();
      if (key === 'cps' && panelCpsValEl && panelCpsValEl.isConnected) panelCpsValEl.textContent = settings.cps;
    });
    wrap.appendChild(head); wrap.appendChild(inp);
    return wrap;
  }

  /* ---------- init ---------- */
  function init() {
    makeBtn();
    updateBtn();
    console.log('[RuianAC] v1.11 loaded OK, enabled=' + settings.enabled + ' cps=' + settings.cps + ' jitter=' + settings.jitterPct + '%');
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', function () { if (document.hidden) onBlur(); });
    if (!window.__ruianAutoClicker) {
      window.__ruianAutoClicker = {
        getSettings: function () { return JSON.parse(JSON.stringify(settings)); },
        setSettings: function (o) { Object.assign(settings, o); saveSettings(); updateBtn(); return settings; },
        toggle: function () { settings.enabled = !settings.enabled; saveSettings(); updateBtn(); if (!settings.enabled) stop(); return settings.enabled; },
        setEnabled: function (v) { settings.enabled = !!v; saveSettings(); updateBtn(); if (!settings.enabled) stop(); return settings.enabled; },
        setCps: function (v) { settings.cps = clamp(+v || 12, 1, 100); saveSettings(); if (panelCpsValEl && panelCpsValEl.isConnected) panelCpsValEl.textContent = settings.cps; return settings.cps; },
        click: fireClick,
        isRunning: function () { return !!timer; },
        openPanel: togglePanel
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
