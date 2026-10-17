/*!
* Ruian settings storage bridge (ruianstorage.js)  v1.2
* ---------------------------------------------
* v1.2 major reversal fix (the real root cause, confirmed in browser):
*   Game settings actually live in localStorage["_eaglercraft_1.12.g"],
*   value = base64(UTF-8 "key:value" plain text lines)!
*   [Test evidence]
*   - Changing FOV by one step in the game settings screen made the game itself
*     write back localStorage["_eaglercraft_1.12.g"] (100+ full lines including
*     hasSeenFirstLoad:true);
*   - After manually writing fov:0.5 to localStorage and restarting, the settings
*     screen showed FOV: 90 -> the game really reads and applies settings from
*     localStorage;
*   - Keys the game writes use the "key_key.attack" etc. key_key. prefix (writes
*     and reads are symmetric);
*   - The IndexedDB database _net_lax1dude_eaglercraft_v1_8_internal_
*     PlatformFilesystem_1_12_2_ is only used for other files (world saves etc.);
*     game settings do not read IndexedDB /options.
*   v1.0/v1.1 wrote IndexedDB /options which was "dead data" the game never read
*   -> this was the real root cause of the preset/filter never working.
*
* Key name note (confirmed by testing):
*   The in-game key names use the "key_key.xxx" prefix (e.g. key_key.hotbar.9 /
*   key_key.modmenu). preset/modfilter must write with the key_key. prefix.
*
* This module provides a unified read/write interface for game settings, used by
* perfmod/preset/modfilter.
* ---------------------------------------------
*/
(function () {
"use strict";
var OPTIONS_PATH = "/options"; // kept for old naming, actually stored in localStorage
var STORAGE_NAMESPACE = "_eaglercraft_1.12";
var SETTINGS_KEY = "g";
var FULL_KEY = STORAGE_NAMESPACE + "." + SETTINGS_KEY;
function getStorage() {
try {
if (window.localStorage) return window.localStorage;
} catch (ex) {}
return null;
}
function b64ToText(b64) {
var bin = atob(b64);
var bytes = new Uint8Array(bin.length);
for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
return new TextDecoder("utf-8").decode(bytes);
}
function textToB64(text) {
var bytes = new TextEncoder().encode(text);
var bin = "";
var CHUNK = 0x8000;
for (var i = 0; i < bytes.length; i += CHUNK) {
bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
}
return btoa(bin);
}
// Read the settings text (base64-decoded); returns null if missing or corrupted
window.__ruianStorageReadOptions = function () {
return new Promise(function (resolve) {
try {
var ls = getStorage();
if (!ls) { resolve(null); return; }
var raw = null;
try { raw = ls.getItem(FULL_KEY); } catch (ex) {}
if (!raw) { resolve(null); return; }
try {
resolve(b64ToText(raw));
} catch (ex) {
console.warn("[RuianStorage] settings decode failed (will be rebuilt): " + ex);
resolve(null);
}
} catch (ex) {
console.warn("[RuianStorage] read failed: " + ex);
resolve(null);
}
});
};
// Write the settings text (base64-encoded); returns true on success
window.__ruianStorageWriteOptions = function (text) {
return new Promise(function (resolve) {
try {
var ls = getStorage();
if (!ls) { resolve(false); return; }
try {
ls.setItem(FULL_KEY, textToB64(text));
console.log("[RuianStorage] /options written to localStorage (" + (text.split("\n").length) + " lines)");
resolve(true);
} catch (ex) {
console.warn("[RuianStorage] write failed: " + ex);
resolve(false);
}
} catch (ex) {
console.warn("[RuianStorage] write failed: " + ex);
resolve(false);
}
});
};
// settings text -> map
window.__ruianStorageParse = function (text) {
var map = {};
var lines = (text || "").split("\n");
for (var i = 0; i < lines.length; i++) {
var idx = lines[i].indexOf(":");
if (idx > 0) map[lines[i].slice(0, idx)] = lines[i].slice(idx + 1);
}
return map;
};
// map -> settings text
window.__ruianStorageSerialize = function (map) {
var keys = Object.keys(map);
var out = [];
for (var i = 0; i < keys.length; i++) out.push(keys[i] + ":" + map[keys[i]]);
return out.join("\n");
};
// base64(UTF-8) -> text
window.__ruianStorageB64ToText = function (b64) {
return b64ToText(b64);
};
// Console tools
window.__ruianStorage = {
read: function () { return window.__ruianStorageReadOptions(); },
write: function (t) { return window.__ruianStorageWriteOptions(t); },
dump: function () {
return window.__ruianStorageReadOptions().then(function (t) {
return t === null ? "(settings do not exist)" : t;
});
}
};
})();
