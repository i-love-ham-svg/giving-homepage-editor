(function () {
  "use strict";

  const referenceKey = "__editorImageAssetRef";
  const imageDataUrlPrefix = /^data:image\/(?:png|jpe?g|webp|gif|avif|bmp);base64,/i;

  function createAssetStore() {
    const sourceToId = new Map();
    const idToSource = new Map();
    let sequence = 1;

    function getReference(source) {
      let id = sourceToId.get(source);
      if (!id) {
        id = `image-${sequence}`;
        sequence += 1;
        sourceToId.set(source, id);
        idToSource.set(id, source);
      }
      return { [referenceKey]: id };
    }

    function dehydrate(value) {
      if (typeof value === "string") {
        return imageDataUrlPrefix.test(value) ? getReference(value) : value;
      }
      if (Array.isArray(value)) return value.map(dehydrate);
      if (!value || typeof value !== "object") return value;
      const next = {};
      Object.entries(value).forEach(([key, child]) => {
        next[key] = dehydrate(child);
      });
      return next;
    }

    function rehydrate(value) {
      if (Array.isArray(value)) return value.map(rehydrate);
      if (!value || typeof value !== "object") return value;
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0] === referenceKey) {
        return idToSource.get(value[referenceKey]) ?? null;
      }
      const next = {};
      Object.entries(value).forEach(([key, child]) => {
        next[key] = rehydrate(child);
      });
      return next;
    }

    function serialize(value) {
      return JSON.stringify(dehydrate(value));
    }

    function parse(serialized) {
      return rehydrate(JSON.parse(serialized));
    }

    function clear() {
      sourceToId.clear();
      idToSource.clear();
      sequence = 1;
    }

    return Object.freeze({
      clear,
      dehydrate,
      parse,
      rehydrate,
      serialize,
      get size() {
        return idToSource.size;
      }
    });
  }

  window.EditorHistoryManager = Object.freeze({ createAssetStore });
})();
