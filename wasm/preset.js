/*!
* Ruian first-launch settings preset (preset.js)  v3.0
* ---------------------------------------------
* Writes user-specified settings into the game settings storage before the game
* starts:
*   localStorage["_eaglercraft_1.12.g"] = base64("key:value" lines of UTF-8 plain text)
*
* v3.0 major reversal (actually works, confirmed in browser):
*   Game settings live in localStorage["_eaglercraft_1.12.g"], not IndexedDB!
*   [Tested] After changing FOV in game, the game itself wrote back to this
*   localStorage; writing fov:0.5 and restarting showed FOV 90°. The game does
*   not read IndexedDB /options (v2.x wrote dead data there).
*   Also confirmed the in-game key names use the "key_key.xxx" prefix (e.g.
*   key_key.hotbar.9), not "key.xxx"! The v1.6 key. prefix conclusion was wrong.
*   Key code fix: mouse Button4 = -97 (hotbar 8), Button5 = -96 (hotbar 7).
*
* v2.2 changes (kept):
*   - Version bump to force refresh: changing preset.js requires syncing the ?v=
*     version in index.html
* v2.1 fix (kept):
*   - key.saveToolbarActivator: 47 (V key)
* v1.5 changes (kept): render distance 6 -> 7 (compromise)
*
* Settings (verified against the real options the game writes back):
*   - FOV: Pro(90°)            -> fov:0.5      (stored value = (angle-70)/40, 0.5 -> 90°)
*   - Render distance: 7 chunks -> renderDistance:7
*   - Brightness: max (Bright) -> gamma:1.0
*   - Fullbright: on           -> modern_fullbright:true
*   - GUI scale: Large         -> guiScale:3   (0=auto 1=small 2=normal 3=large)
*   - Clouds: off              -> renderClouds:false
*   - Hotbar 9 -> Left Alt      -> key_key.hotbar.9:56      (LWJGL KEY_LMENU=56)
*   - Hotbar 8 -> mouse side 4  -> key_key.hotbar.8:-97     (mouse keys: -100 LMB/-99 RMB/-98 MMB/-97 B4/-96 B5)
*   - Hotbar 7 -> mouse side 5  -> key_key.hotbar.7:-96
*   - Save toolbar activator -> V -> key_key.saveToolbarActivator:47 (KEY_V=47)
*   - Freelook -> Left Ctrl     -> key_key.freelook:29    (KEY_LCONTROL=29)
*
* Why it runs on every startup:
*   EaglerBoost(perfmod) overwrites the whole settings keys on every startup, so
*   writing only on the first launch would get these items wiped on restart. This
*   script runs after boost and merges with the existing settings each time, so
*   the settings above always take effect; other settings the player changed in
*   game are kept (merge mode).
* Console: __ruianPreset.apply() to replay manually; __ruianPreset.dump() to
* print the current settings text
* ---------------------------------------------
*/
(function () {
"use strict";
// Preset items forced on every startup (merge/overwrite; keys use the real in-game key_key. format)
var PRESET_KEYS = {
"fov": "0.5",
"renderDistance": "7",
"gamma": "1.0",
"guiScale": "3",
"renderClouds": "false",
"modern_fullbright": "true",
"key_key.hotbar.9": "56",
"key_key.hotbar.8": "-97",
"key_key.hotbar.7": "-96",
"key_key.saveToolbarActivator": "47",
"key_key.freelook": "29"
};
// Keys written with the wrong format by old versions (key. prefix / old key codes);
// the game does not recognize them, clear them to avoid leftovers
var CLEAN_KEYS = ["key.hotbar.9", "key.hotbar.8", "key.hotbar.7", "key.saveToolbarActivator", "key.freelook",
"key_key.hotbar.8:-96", "key_key.hotbar.7:-95"];
// Full fallback preset: version:1343 + boost items + the 11 items above (plain text base64, no gzip).
// Used only when the existing settings are empty or corrupted, so the game is
// clean and usable after a single launch.
var FULL_PRESET_B64 =
"dmVyc2lvbjoxMzQzCm1vZGVybl9sb2RSZW5kZXJpbmc6dHJ1ZQptb2Rlcm5fbG9kVmlld0Rpc3RhbmNlOjMyCm1vZGVybl9sb2RTdGFydERpc3RhbmNlOjcKcmVuZGVyRGlzdGFuY2U6NwpvZkNodW5rVXBkYXRlczoxCmNodW5rRml4OnRydWUKZm9nOnRydWUKbW9kZXJuX2VudGl0eUN1bGxpbmc6dHJ1ZQplbnRpdHlTaGFkb3dzOmZhbHNlCm1vZGVybl9zaG93T3duTmFtZXRhZzp0cnVlCm1heEZwczoyNjAKZW5hYmxlVnN5bmM6dHJ1ZQpwYXJ0aWNsZXM6MgphbzowCm1pcG1hcExldmVsczowCmZhbmN5R3JhcGhpY3M6ZmFsc2UKcmVuZGVyQ2xvdWRzOmZhbHNlCm1vZGVybl9ub1JhaW46dHJ1ZQptb2Rlcm5fbm9QYXJ0aWNsZXM6dHJ1ZQptb2Rlcm5fbm9HbGludDpmYWxzZQptb2Rlcm5fYmxvY2tGYWNlQ3VsbGluZzp0cnVlCm1vZGVybl9jaHVua01lc2hPcHRpbWl6YXRpb246dHJ1ZQptb2Rlcm5fY3J5c3RhbE9wdGltaXplcjp0cnVlCm1vZGVybl9lYXRpbmdPcHRpbWl6ZXI6dHJ1ZQptb2Rlcm5fbW90aW9uQmx1cjpmYWxzZQptb2Rlcm5fZnVsbGJyaWdodDp0cnVlCm1vZGVybl90b3RlbUNvdW50ZXI6ZmFsc2UKbW9kZXJuX2NsaXBwaW5nOmZhbHNlCmZvdjowLjUKcmVuZGVyRGlzdGFuY2U6NwpnYW1tYToxLjAKZ3VpU2NhbGU6MwpyZW5kZXJDbG91ZHM6ZmFsc2UKbW9kZXJuX2Z1bGxicmlnaHQ6dHJ1ZQprZXlfa2V5LmhvdGJhci45OjU2CmtleV9rZXkuaG90YmFyLjg6LTk3CmtleV9rZXkuaG90YmFyLjc6LTk2CmtleV9rZXkuc2F2ZVRvb2xiYXJBY3RpdmF0b3I6NDcKa2V5X2tleS5mcmVlbG9vazoyOQ==";
async function applyPreset() {
try {
if (typeof window.__ruianStorageReadOptions !== "function") {
console.warn("[RuianPreset] ruianstorage not loaded, skipped.");
return false;
}
var text = await window.__ruianStorageReadOptions();
var map = {};
var source = "empty";
if (text !== null && text.length > 0) {
map = window.__ruianStorageParse(text);
source = "existing";
}
var pKeys = Object.keys(PRESET_KEYS);
for (var i = 0; i < pKeys.length; i++) {
map[pKeys[i]] = PRESET_KEYS[pKeys[i]];
}
for (var c = 0; c < CLEAN_KEYS.length; c++) {
if (CLEAN_KEYS[c] in map) delete map[CLEAN_KEYS[c]];
}
var newText;
if (source === "existing" && Object.keys(map).length >= 2) {
// Merge with the existing settings (keep other items the player changed in game)
newText = window.__ruianStorageSerialize(map);
} else {
// Empty: write the full preset directly
newText = window.__ruianStorageB64ToText(FULL_PRESET_B64);
}
var ok = await window.__ruianStorageWriteOptions(newText);
if (ok) {
console.log("[RuianPreset] v3.0 written (source: " + source + ", " + Object.keys(map).length + " settings total, renderDistance:7, FOV:90).");
} else {
console.error("[RuianPreset] write failed! Check the [RuianStorage] log above (incognito mode / disabled localStorage cannot write).");
}
return ok;
} catch (ex) {
console.error("[RuianPreset] apply failed (game startup is not affected): " + ex);
return false;
}
}
// Called by wasm/index.html after EaglerBoost writes its settings (so it is not overwritten)
window.__eaglerPresetApply = function () {
return applyPreset();
};
// Console tools
window.__ruianPreset = {
apply: function () { return applyPreset(); },
dump: function () {
return window.__ruianStorageReadOptions().then(function (t) {
return t === null ? "(settings do not exist)" : t;
}).catch(function (e) { return "decode failed: " + e; });
}
};
})();
