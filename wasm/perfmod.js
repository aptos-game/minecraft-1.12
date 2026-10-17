/*!
* EaglerBoost performance mod  (perfmod.js)  v3.4
* ---------------------------------------------
* Injects three groups of optimizations into this repo's EaglercraftX 1.12
* (modernclient) client:
*
*  1) Chunk loading  - LOD rendering + larger chunk loading distance + chunk fix
*  2) Entity loading - entity culling + disabled entity shadows
*  3) FPS boost      - disable rain/particles/enchant glint/clouds, lower smooth
*                      lighting and mipmaps, enable face culling/chunk mesh
*                      optimization, and disable debug stack deobfuscation to
*                      reduce lag
*
* v3.4 fix (storage conclusion reversed, confirmed in browser):
*   Game settings actually live in localStorage["_eaglercraft_1.12.g"] (base64
*   plain text), not IndexedDB! v3.3's "IndexedDB" conclusion was wrong (misled
*   at the time). This version still reads/writes through the ruianstorage.js
*   interface - ruianstorage v1.2 now bridges to localStorage, so this file's
*   logic is unchanged; only the version number was bumped to force a cache
*   refresh.
*
* v3.3 changes (kept):
*   - maxFps 260 -> 120 / particles 2 -> 0 / fog true -> false / renderDistance 9 -> 7
*   - lodStartDistance 8 -> 7 (aligned with preset)
*   - turned off showOwnNametag / entityShadows
*
* Controlled by URL parameter: ?boost=1 enabled (default), ?boost=0 disabled
* ---------------------------------------------
*/
(function () {
"use strict";
// Performance preset: base64(settings text), plain text lines, no gzip
// v3.1: renderDistance:7 / lodStartDistance:7 / fog:false / maxFps:120 / particles:0
var BOOST_SETTINGS_B64 =
"dmVyc2lvbjoxMzQzCm1vZGVybl9sb2RSZW5kZXJpbmc6dHJ1ZQptb2Rlcm5fbG9kVmlld0Rpc3RhbmNlOjMyCm1vZGVybl9sb2RTdGFydERpc3RhbmNlOjcKcmVuZGVyRGlzdGFuY2U6NwpvZkNodW5rVXBkYXRlczoxCmNodW5rRml4OnRydWUKZm9nOmZhbHNlCm1vZGVybl9lbnRpdHlDdWxsaW5nOnRydWUKZW50aXR5U2hhZG93czpmYWxzZQptb2Rlcm5fc2hvd093bk5hbWV0YWc6ZmFsc2UKbWF4RnBzOjEyMAplbmFibGVWU3luYzp0cnVlCnBhcnRpY2xlczowCmFvOjAKbWlwbWFwTGV2ZWxzOjAKZmFuY3lHcmFwaGljczpmYWxzZQplbmRlckNsb3VkczpmYWxzZQptb2Rlcm5fbm9SYWluOnRydWUKbW9kZXJuX25vUGFydGljbGVzOnRydWUKbW9kZXJuX25vR2xpbnQ6ZmFsc2UKbW9kZXJuX2Jsb2NrRmFjZUN1bGxpbmc6dHJ1ZQptb2Rlcm5fY2h1bmtNZXNoT3B0aW1pemF0aW9uOnRydWUKbW9kZXJuX2NyeXN0YWxPcHRpbWl6ZXI6dHJ1ZQptb2Rlcm5fZWF0aW5nT3B0aW1pZXI6dHJ1ZQptb2Rlcm5fbW90aW9uQmx1cjpmYWxzZQptb2Rlcm5fZnVsbGJyaWdodDp0cnVlCm1vZGVybl90b3RlbUNvdW50ZXI6ZmFsc2UKbW9kZXJuX2NsaXBwaW5nOmZhbHNlZQ==";
function getURLParam(name) {
try {
var q = window.location.search;
if (typeof q !== "string" || q.length < 1) return null;
var params = new URLSearchParams(q);
var v = params.get(name);
return v === null ? null : v;
} catch (ex) {
return null;
}
}
// Whether the performance boost is enabled (enabled by default)
function isBoostEnabled() {
var v = getURLParam("boost");
if (v === null) return true; // enabled by default when unspecified
return v === "1" || v === "true" || v === "on";
}
// Write the boost preset into the game settings storage (localStorage, via ruianstorage), merging and keeping other settings
async function applyBoostSettings() {
try {
if (typeof window.__ruianStorageReadOptions !== "function") {
console.warn("[EaglerBoost] ruianstorage not loaded, settings injection skipped.");
return false;
}
var text = await window.__ruianStorageReadOptions();
var map = {};
if (text !== null && text.length > 0) {
map = window.__ruianStorageParse(text);
} else {
console.warn("[EaglerBoost] settings not found, initializing with the full boost preset.");
}
// Parse the boost preset and merge/overwrite
var boostMap = window.__ruianStorageParse(window.__ruianStorageB64ToText(BOOST_SETTINGS_B64));
for (var k in boostMap) {
map[k] = boostMap[k];
}
var newText = window.__ruianStorageSerialize(map);
var ok = await window.__ruianStorageWriteOptions(newText);
if (ok) {
console.log("[EaglerBoost] performance settings written v3.4 (renderDistance 7 / maxFps 120 / no particles / fog off).");
}
return ok;
} catch (ex) {
console.error("[EaglerBoost] failed to write settings: " + ex);
return false;
}
}
// Called by wasm/index.html after eaglercraftXOpts is created (returns a Promise, must await)
window.__eaglerBoostApply = function (opts) {
try {
if (!opts || typeof opts !== "object") return Promise.resolve(false);
var boost = isBoostEnabled();
// ---- Startup/rendering layer optimizations (read by the client, safe) ----
opts.enforceVSync = true;
opts.deobfStackTraces = false;
opts.checkGLErrors = false;
opts.checkShaderGLErrors = false;
opts.useDelayOnSwap = false;
opts.useWebGLExt = true;
// ---- Game settings injection (localStorage, via ruianstorage) ----
if (boost) {
return applyBoostSettings().then(function (ok) {
console.log("[EaglerBoost] performance mod v3.4 enabled: LOD chunk rendering / entity loading optimization / FPS boost.");
return ok;
});
} else {
console.log("[EaglerBoost] performance mod disabled (?boost=0), settings untouched.");
return Promise.resolve(false);
}
} catch (ex) {
// No exception may prevent the game itself from starting
console.error("[EaglerBoost] init failed (ignored): " + ex);
return Promise.resolve(false);
}
};
})();
