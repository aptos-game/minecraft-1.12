/*!
* Ruian Mod Filter (modfilter.js)  v3.2
* ---------------------------------------------
* Lock-style filtering: before game startup AND while the game runs, force the
* following Modern features to stay disabled:
*   - Motion Blur              -> modern_motionBlur:false     (always off)
*   - Boss bar feature         -> modern_disableBossBar:false (this mod feature stays off)
*   - Totem Counter            -> modern_totemCounter:false   (always off)
*
* v3.2 changes (lock filtering, "turning it on still does nothing"):
*   - Restored all three to forced false (user-confirmed semantics: these three
*     mod features are off; v3.1's disableBossBar:true was a mistake, reverted).
*   - Added a Runtime Guard:
*     ① Intercept localStorage.setItem: when the game writes settings back, the
*        filtered keys are force-written back to false;
*     ② Every 5 seconds force-write again: even if the game bypasses the
*        interception and writes storage directly, it gets corrected;
*     -> if the player enables these three switches in game, they are instantly
*        reverted / forced off on next read: "turning it on still does nothing".
*
* v3.1 changes (reverted):
*   - modern_disableBossBar:true (mistake, restored to false)
*
* v3.0 changes (kept):
*   - Storage fix: v2.x wrote IndexedDB /options which was dead data (game does
*     not read it). This version writes localStorage["_eaglercraft_1.12.g"] via
*     ruianstorage v1.2, matching where the game really reads -> filters actually
*     work (tested: setting modern_noRain:false really turned the No Rain switch
*     off in the Mods menu; keys <-> switches map one to one).
*   - Mod menu stays open (kept from v2.1): removed key.modmenu / key_key.modmenu
*     leftovers.
*
* Order (in wasm/index.html, all awaited serially):
*   ruianstorage -> perfmod(Boost writes full config) -> preset(merges 11 items) ->
*   modfilter(this script, runs last and merges/overwrites so it is not overwritten)
*   -> eagruntime.js
* ---------------------------------------------
*/
(function () {
"use strict";
// Filtered keys forced on every startup (overwrite if present, add if missing; locked to false)
var FORCE_KEYS = {
"modern_motionBlur": "false",
"modern_disableBossBar": "false",
"modern_totemCounter": "false"
};
// Open the Mod menu: force-delete these keys before writing so the game uses the
// default Mod menu hotkey (v2.0 wrote key.modmenu:-1; without deleting it the menu stays locked)
var REMOVE_KEYS = ["key.modmenu", "key_key.modmenu"];
var STORAGE_KEY = "_eaglercraft_1.12.g";
function b64ToText(b64) {
var bin = atob(b64);
var bytes = new Uint8Array(bin.length);
for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
return new TextDecoder("utf-8").decode(bytes);
}
function textToB64(text) {
var bytes = new TextEncoder().encode(text);
var s = "";
for (var j = 0; j < bytes.length; j += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000));
return btoa(s);
}
// Force the filtered keys in the text to their FORCE_KEYS values and delete REMOVE_KEYS; returns the new text
function forceKeysInText(txt) {
var lines = txt.split("\n");
var map = {};
var order = [];
for (var i = 0; i < lines.length; i++) {
var idx = lines[i].indexOf(":");
if (idx > 0) {
var k = lines[i].slice(0, idx);
var v = lines[i].slice(idx + 1);
if (REMOVE_KEYS.indexOf(k) >= 0) continue;
if (FORCE_KEYS.hasOwnProperty(k)) v = FORCE_KEYS[k];
if (!(k in map)) order.push(k);
map[k] = v;
}
}
for (var fk in FORCE_KEYS) {
if (!(fk in map)) { map[fk] = FORCE_KEYS[fk]; order.push(fk); }
}
var out = [];
for (var j = 0; j < order.length; j++) out.push(order[j] + ":" + map[order[j]]);
return out.join("\n");
}
// Runtime guard: intercept writes + periodic fallback, so switches opened by the
// player are force-closed too
function installRuntimeGuard() {
try {
var ls = window.localStorage;
if (!ls) return;
var origSet = ls.setItem.bind(ls);
var origGet = ls.getItem.bind(ls);
ls.setItem = function(k, v) {
if (k === STORAGE_KEY && typeof v === "string") {
try {
var txt = b64ToText(v);
var ntxt = forceKeysInText(txt);
if (ntxt !== txt) v = textToB64(ntxt);
} catch (ex) {}
}
return origSet(k, v);
};
// Fallback force-write every 5 seconds (in case the game bypasses interception)
setInterval(function() {
try {
var raw = origGet(STORAGE_KEY);
if (!raw) return;
var txt = b64ToText(raw);
var ntxt = forceKeysInText(txt);
if (ntxt !== txt) origSet(STORAGE_KEY, textToB64(ntxt));
} catch (ex) {}
}, 5000);
console.log("[RuianModFilter] v3.2 runtime guard installed: the three filtered switches are locked off (enabling does nothing)");
} catch (ex) {
console.warn("[RuianModFilter] failed to install runtime guard: " + ex);
}
}
// Write the filter before startup (merge and keep the other settings)
async function applyModFilter() {
try {
if (typeof window.__ruianStorageReadOptions !== "function") {
console.warn("[RuianModFilter] ruianstorage not loaded, skipped.");
return false;
}
var text = await window.__ruianStorageReadOptions();
var map = {};
if (text !== null && text.length > 0) {
map = window.__ruianStorageParse(text);
} else {
console.warn("[RuianModFilter] settings not found, using minimal fallback (Boost writes the full config first).");
map = window.__ruianStorageParse(minimalBase());
}
var fKeys = Object.keys(FORCE_KEYS);
for (var i = 0; i < fKeys.length; i++) {
map[fKeys[i]] = FORCE_KEYS[fKeys[i]];
}
var rKeys = REMOVE_KEYS;
for (var k = 0; k < rKeys.length; k++) {
if (rKeys[k] in map) delete map[rKeys[k]];
}
var newText = window.__ruianStorageSerialize(map);
var ok = await window.__ruianStorageWriteOptions(newText);
if (ok) {
console.log("[RuianModFilter] v3.2 applied: MotionBlur/BossBar/TotemCounter locked off (enabling does nothing), Mod menu open");
}
return ok;
} catch (ex) {
console.error("[RuianModFilter] apply failed (game startup is not affected): " + ex);
return false;
}
}
// Called by wasm/index.html after the preset is written (so it is not overwritten)
window.__eaglerModFilterApply = function () {
return applyModFilter();
};
// Console tools
window.__ruianModFilter = {
apply: function () { return applyModFilter(); },
dump: function () {
return window.__ruianStorageReadOptions().then(function (text) {
if (text === null) return "(settings do not exist)";
var lines = text.split("\n");
var out = [];
for (var i = 0; i < lines.length; i++) {
if (lines[i].indexOf("modern_motionBlur") === 0 ||
lines[i].indexOf("modern_disableBossBar") === 0 ||
lines[i].indexOf("modern_totemCounter") === 0) {
out.push(lines[i]);
}
}
return out.length ? out.join("\n") : "(no filtered keys found)";
}).catch(function (e) { return "decode failed: " + e; });
}
};
// Install the runtime guard immediately (works when modfilter loads, independent of game startup order)
installRuntimeGuard();
})();
