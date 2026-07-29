(function () {
  "use strict";

  function normalizeViewportKey(viewport, profiles = {}) {
    if (viewport === "mobile") return "phone";
    return profiles[viewport] ? viewport : "desktop";
  }

  function isResponsiveViewport(viewport, profiles = {}) {
    return normalizeViewportKey(viewport, profiles) !== "desktop";
  }

  function cloneValue(value) {
    return structuredClone(value ?? {});
  }

  function cloneDefined(value) {
    return value === undefined || value === null ? null : structuredClone(value);
  }

  function getResponsiveFallback(source, base, viewport, mobileFallbackKey) {
    return source?.[viewport]
      ?? source?.mobile
      ?? source?.[mobileFallbackKey]
      ?? base?.[viewport]
      ?? base?.[mobileFallbackKey]
      ?? base?.mobile;
  }

  function createViewportMap(source, base, viewportKeys = [], mobileFallbackKey = "phone") {
    const result = {};
    viewportKeys.forEach((viewport) => {
      const fallback = viewport === "desktop"
        ? source?.desktop ?? base?.desktop
        : getResponsiveFallback(source, base, viewport, mobileFallbackKey);
      result[viewport] = cloneValue(fallback);
    });
    if (result.phone) result.mobile = result.phone;
    return result;
  }

  function ensureViewportMap(target, base, viewportKeys = [], mobileFallbackKey = "phone") {
    const map = target ?? {};
    viewportKeys.forEach((viewport) => {
      if (map[viewport]) return;
      const fallback = viewport === "desktop"
        ? map.desktop ?? base?.desktop
        : getResponsiveFallback(map, base, viewport, mobileFallbackKey);
      map[viewport] = cloneValue(fallback);
    });
    if (map.phone) map.mobile = map.phone;
    return map;
  }

  function getViewportLayerMap(map, viewport, profiles = {}) {
    const key = normalizeViewportKey(viewport, profiles);
    return map?.[key] ?? (key === "phone" ? map?.mobile : null) ?? null;
  }

  function getViewportLayerValue(map, viewport, layerId, profiles = {}) {
    return getViewportLayerMap(map, viewport, profiles)?.[layerId] ?? null;
  }

  function ensureViewportLayerValue(map, viewport, layerId, fallbackMap, profiles = {}) {
    if (!map || !layerId) return null;
    const key = normalizeViewportKey(viewport, profiles);
    map[key] = map[key] ?? {};
    if (map[key][layerId]) return map[key][layerId];

    const fallback = fallbackMap?.[key]?.[layerId]
      ?? (key === "phone" ? fallbackMap?.mobile?.[layerId] : null)
      ?? fallbackMap?.desktop?.[layerId]
      ?? getViewportLayerValue(map, "desktop", layerId, profiles);
    const nextValue = cloneDefined(fallback);
    if (!nextValue) return null;
    map[key][layerId] = nextValue;
    if (key === "phone") map.mobile = map.phone;
    return map[key][layerId];
  }

  window.EditorViewportManager = Object.freeze({
    createViewportMap,
    ensureViewportLayerValue,
    ensureViewportMap,
    getViewportLayerMap,
    getViewportLayerValue,
    isResponsiveViewport,
    normalizeViewportKey
  });
})();
