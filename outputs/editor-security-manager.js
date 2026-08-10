(function () {
  "use strict";

  const allowedImageTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/bmp"
  ]);
  const defaultMaxImageBytes = 15 * 1024 * 1024;
  const safeImageDataUrlPattern = /^data:image\/(?:png|jpe?g|webp|gif|avif|bmp);base64,[a-z0-9+/=\s]+$/i;
  const safeSiteAssetUrlPattern = /^\/api\/site-assets\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|gif)$/i;

  function isSafeImageDataUrl(value) {
    return typeof value === "string" && safeImageDataUrlPattern.test(value);
  }

  function isSafeImageSource(value) {
    return isSafeImageDataUrl(value)
      || (typeof value === "string" && safeSiteAssetUrlPattern.test(value));
  }

  function validateImageFile(file, options = {}) {
    if (!file) return { ok: false, error: "이미지 파일을 선택해 주세요" };
    if (!allowedImageTypes.has(String(file.type ?? "").toLowerCase())) {
      return { ok: false, error: "PNG, JPG, WebP, GIF, AVIF, BMP 이미지만 사용할 수 있습니다" };
    }
    const maxBytes = Number(options.maxBytes) || defaultMaxImageBytes;
    if (Number(file.size) > maxBytes) {
      const maxMegabytes = Math.round(maxBytes / 1024 / 1024);
      return { ok: false, error: `${maxMegabytes}MB 이하 이미지를 사용해 주세요` };
    }
    return { ok: true, error: "" };
  }

  function validateImageDimensions(width, height, options = {}) {
    const imageWidth = Number(width) || 0;
    const imageHeight = Number(height) || 0;
    const maxSide = Number(options.maxSide) || 12_000;
    const maxPixels = Number(options.maxPixels) || 40_000_000;
    if (imageWidth < 1 || imageHeight < 1) {
      return { ok: false, error: "이미지 크기를 확인할 수 없습니다" };
    }
    if (imageWidth > maxSide || imageHeight > maxSide || imageWidth * imageHeight > maxPixels) {
      return { ok: false, error: "이미지 해상도가 너무 큽니다. 4천만 화소 이하 이미지를 사용해 주세요" };
    }
    return { ok: true, error: "" };
  }

  function sanitizeImageAsset(asset, fields = ["dataUrl", "removedDataUrl", "strongRemovedDataUrl", "manualDataUrl"]) {
    if (!asset || typeof asset !== "object") return asset ?? null;
    const next = { ...asset };
    fields.forEach((field) => {
      if (field in next && next[field] != null && !isSafeImageSource(next[field])) next[field] = null;
    });
    return next;
  }

  function decodeEntity(entity) {
    const named = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: "\"",
      apos: "'",
      "#39": "'",
      nbsp: " "
    };
    if (entity in named) return named[entity];
    if (/^#\d+$/.test(entity)) return String.fromCodePoint(Number(entity.slice(1)));
    if (/^#x[\da-f]+$/i.test(entity)) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    return `&${entity};`;
  }

  function getAttribute(markup, name) {
    const quoted = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(markup);
    if (quoted) return quoted[2];
    const unquoted = new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i").exec(markup);
    return unquoted?.[1] ?? "";
  }

  function sanitizeSealMarkup(markup, fallbackLines = ["재단", "인"]) {
    const source = String(markup ?? "").slice(0, 20_000);
    const imageMarkup = source.match(/<img\b[^>]*>/i)?.[0] ?? "";
    const imageSource = getAttribute(imageMarkup, "src");
    if (isSafeImageSource(imageSource)) {
      return { type: "image", src: imageSource, lines: [] };
    }

    const text = source
      .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&([#\w]+);/g, (_, entity) => decodeEntity(entity))
      .replace(/\r/g, "")
      .trim();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4);
    return {
      type: "text",
      src: "",
      lines: lines.length ? lines : fallbackLines.map(String)
    };
  }

  window.EditorSecurityManager = Object.freeze({
    allowedImageTypes: Object.freeze([...allowedImageTypes]),
    defaultMaxImageBytes,
    isSafeImageDataUrl,
    isSafeImageSource,
    validateImageFile,
    validateImageDimensions,
    sanitizeImageAsset,
    sanitizeSealMarkup
  });
})();
