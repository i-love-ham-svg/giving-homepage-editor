(function () {
  "use strict";

  const PIPETTE_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m2 22 1-1h3l9-9"/>
      <path d="M3 21v-3l9-9"/>
      <path d="m18.37 3.63.4-.4a2.1 2.1 0 1 1 3 3l-.4.4"/>
      <path d="m17.66 2.93 3.41 3.41"/>
      <path d="M17.66 2.93 8.3 12.29a2.426 2.426 0 1 0 3.42 3.42l9.35-9.37"/>
    </svg>`;

  const PALETTE_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7" cy="7" r="2" fill="currentColor" stroke="none"/>
      <circle cx="17" cy="7" r="2" fill="currentColor" stroke="none"/>
      <circle cx="7" cy="17" r="2" fill="currentColor" stroke="none"/>
      <circle cx="17" cy="17" r="2" fill="currentColor" stroke="none"/>
    </svg>`;

  const THEME_COLOR_TOKENS = [
    ["--ink", "기본 글자"],
    ["--muted", "보조 글자"],
    ["--accent", "강조"],
    ["--accent-strong", "진한 강조"],
    ["--paper", "본문 배경"],
    ["--soft", "연한 배경"]
  ];

  function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
  }

  function byteToHex(value) {
    return clampByte(value).toString(16).padStart(2, "0");
  }

  function parseCssColor(value) {
    const source = String(value || "").trim().toLowerCase();
    if (!source || source === "transparent" || source === "none") return null;
    const shortHex = source.match(/^#([0-9a-f]{3,4})$/i);
    if (shortHex) {
      const parts = shortHex[1].split("").map((part) => parseInt(part + part, 16));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length === 4 ? parts[3] / 255 : 1 };
    }
    const longHex = source.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (longHex) {
      return {
        r: parseInt(longHex[1].slice(0, 2), 16),
        g: parseInt(longHex[1].slice(2, 4), 16),
        b: parseInt(longHex[1].slice(4, 6), 16),
        a: longHex[2] ? parseInt(longHex[2], 16) / 255 : 1
      };
    }
    const rgb = source.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/i);
    if (!rgb) return null;
    const alpha = rgb[4] == null ? 1 : Math.max(0, Math.min(1, Number(rgb[4]) / (source.includes("%") ? 100 : 1)));
    return { r: clampByte(rgb[1]), g: clampByte(rgb[2]), b: clampByte(rgb[3]), a: alpha };
  }

  function composite(foreground, background) {
    const fg = foreground || { r: 0, g: 0, b: 0, a: 0 };
    const bg = background || { r: 255, g: 255, b: 255, a: 1 };
    const alpha = fg.a + bg.a * (1 - fg.a);
    if (alpha <= 0) return { r: 255, g: 255, b: 255, a: 1 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / alpha,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / alpha,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / alpha,
      a: alpha
    };
  }

  function colorToHex(color) {
    if (!color) return null;
    const flattened = color.a < 1 ? composite(color, { r: 255, g: 255, b: 255, a: 1 }) : color;
    return `#${byteToHex(flattened.r)}${byteToHex(flattened.g)}${byteToHex(flattened.b)}`;
  }

  function cssColorToHex(value) {
    return colorToHex(parseCssColor(value));
  }

  function getBackgroundColor(element, stopElement, view) {
    let current = element;
    let result = null;
    while (current && current.nodeType === 1) {
      const color = parseCssColor(view.getComputedStyle(current).backgroundColor);
      if (color && color.a > 0) {
        result = result ? composite(result, color) : color;
        if (result.a >= 0.999) return colorToHex(result);
      }
      if (current === stopElement) break;
      current = current.parentElement;
    }
    return colorToHex(result);
  }

  function sampleCanvasPixel(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !canvas.width || !canvas.height) return null;
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((clientX - rect.left) * canvas.width / rect.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((clientY - rect.top) * canvas.height / rect.height)));
    try {
      const data = canvas.getContext("2d", { willReadFrequently: true })?.getImageData(x, y, 1, 1).data;
      return data ? colorToHex({ r: data[0], g: data[1], b: data[2], a: data[3] / 255 }) : null;
    } catch {
      return null;
    }
  }

  function sampleImagePixel(image, clientX, clientY, doc, view) {
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) return null;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const styles = view.getComputedStyle(image);
    const fit = styles.objectFit || "fill";
    const scale = fit === "cover"
      ? Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
      : fit === "contain"
        ? Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
        : null;
    let sourceX;
    let sourceY;
    if (scale) {
      const renderedWidth = image.naturalWidth * scale;
      const renderedHeight = image.naturalHeight * scale;
      const offsetX = (rect.width - renderedWidth) / 2;
      const offsetY = (rect.height - renderedHeight) / 2;
      sourceX = (clientX - rect.left - offsetX) / scale;
      sourceY = (clientY - rect.top - offsetY) / scale;
    } else {
      sourceX = (clientX - rect.left) * image.naturalWidth / rect.width;
      sourceY = (clientY - rect.top) * image.naturalHeight / rect.height;
    }
    if (sourceX < 0 || sourceY < 0 || sourceX >= image.naturalWidth || sourceY >= image.naturalHeight) return null;
    const canvas = doc.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    try {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, Math.floor(sourceX), Math.floor(sourceY), 1, 1, 0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      return colorToHex({ r: data[0], g: data[1], b: data[2], a: data[3] / 255 });
    } catch {
      return null;
    }
  }

  function sampleElementColor(element, clientX, clientY, target, doc, view) {
    if (!element || !target.contains(element)) return null;
    const canvas = element.closest?.("canvas");
    if (canvas && target.contains(canvas)) {
      const sampled = sampleCanvasPixel(canvas, clientX, clientY);
      if (sampled) return sampled;
    }
    const image = element.closest?.("img");
    if (image && target.contains(image)) {
      const sampled = sampleImagePixel(image, clientX, clientY, doc, view);
      if (sampled) return sampled;
    }
    const svgElement = element.closest?.("svg *");
    if (svgElement) {
      const svgStyles = view.getComputedStyle(svgElement);
      const stroke = cssColorToHex(svgStyles.stroke);
      const fill = cssColorToHex(svgStyles.fill);
      if (stroke) return stroke;
      if (fill) return fill;
    }
    const ownStyles = view.getComputedStyle(element);
    const ownBackground = parseCssColor(ownStyles.backgroundColor);
    if (ownBackground && ownBackground.a > 0) return getBackgroundColor(element, target, view);
    const text = String(element.textContent || "").trim();
    if (text && element.children.length === 0) {
      const textColor = cssColorToHex(ownStyles.color);
      if (textColor) return textColor;
    }
    return getBackgroundColor(element, target, view) || cssColorToHex(ownStyles.color);
  }

  function create(options = {}) {
    const doc = options.document || window.document;
    const view = options.window || doc.defaultView || window;
    const target = options.target || doc.documentElement;
    const notify = typeof options.notify === "function" ? options.notify : () => {};
    const registered = new WeakMap();
    let active = null;
    let activePalette = null;

    function closePalette() {
      if (!activePalette) return;
      doc.removeEventListener("pointerdown", handlePaletteOutside, true);
      activePalette.button.classList.remove("active");
      activePalette.panel.remove();
      activePalette = null;
    }

    function handlePaletteOutside(event) {
      if (!activePalette || activePalette.panel.contains(event.target) || activePalette.button.contains(event.target)) return;
      closePalette();
    }

    function getThemeColors() {
      const styles = view.getComputedStyle(doc.documentElement);
      const seen = new Set();
      return THEME_COLOR_TOKENS.map(([token, label]) => {
        const color = cssColorToHex(styles.getPropertyValue(token));
        return { token, label, color };
      }).filter((item) => item.color && !seen.has(item.color) && seen.add(item.color));
    }

    function openPalette(input, button) {
      if (activePalette?.button === button) {
        closePalette();
        return;
      }
      closePalette();
      finish();
      const panel = doc.createElement("div");
      panel.className = "editor-theme-color-palette";
      panel.setAttribute("role", "group");
      panel.setAttribute("aria-label", "전체 스타일 색상");
      getThemeColors().forEach(({ label, color }) => {
        const swatch = doc.createElement("button");
        swatch.type = "button";
        swatch.className = "editor-theme-color-swatch";
        swatch.style.setProperty("--editor-theme-color", color);
        swatch.title = `${label} ${color}`;
        swatch.setAttribute("aria-label", `${label} 색상 ${color} 적용`);
        swatch.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          applyColor(input, color);
          closePalette();
        });
        panel.appendChild(swatch);
      });
      doc.body.appendChild(panel);
      const rect = button.getBoundingClientRect();
      const width = panel.offsetWidth || 188;
      const height = panel.offsetHeight || 48;
      const left = Math.max(8, Math.min(view.innerWidth - width - 8, rect.left));
      const below = rect.bottom + 6;
      const top = below + height <= view.innerHeight - 8 ? below : Math.max(8, rect.top - height - 6);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      activePalette = { input, button, panel };
      button.classList.add("active");
      doc.addEventListener("pointerdown", handlePaletteOutside, true);
    }

    function finish(message = "") {
      if (!active) return false;
      doc.removeEventListener("pointerdown", handlePointerDown, true);
      doc.removeEventListener("keydown", handleKeyDown, true);
      doc.body.classList.remove("editor-color-sampling");
      active.button?.classList.remove("active");
      active = null;
      if (message) notify(message);
      return true;
    }

    function applyColor(input, color) {
      if (!/^#[0-9a-f]{6}$/i.test(color || "")) return false;
      input.value = color.toLowerCase();
      input.dispatchEvent(new view.Event("input", { bubbles: true }));
      input.dispatchEvent(new view.Event("change", { bubbles: true }));
      return true;
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish("색상 선택을 취소했습니다");
    }

    function handlePointerDown(event) {
      if (!active || event.button > 0) return;
      const element = doc.elementFromPoint(event.clientX, event.clientY);
      if (!element || !target.contains(element)) {
        notify("편집 화면 안에서 색상을 선택해 주세요");
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const color = sampleElementColor(element, event.clientX, event.clientY, target, doc, view);
      if (!color) {
        notify("이 위치의 색상을 읽지 못했습니다. 다른 지점을 선택해 주세요");
        return;
      }
      const input = active.input;
      applyColor(input, color);
      finish(`선택한 색상 ${color}을 적용했습니다`);
    }

    function start(input, button) {
      if (!input || input.disabled) return false;
      closePalette();
      finish();
      active = { input, button };
      button?.classList.add("active");
      doc.body.classList.add("editor-color-sampling");
      doc.addEventListener("pointerdown", handlePointerDown, true);
      doc.addEventListener("keydown", handleKeyDown, true);
      notify("편집 화면에서 가져올 색상을 선택해 주세요");
      return true;
    }

    function register(input) {
      if (!input || input.type !== "color") return null;
      const existing = registered.get(input);
      if (existing) return existing;
      const wrapper = doc.createElement("span");
      wrapper.className = "editor-color-control";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "editor-color-eyedropper";
      button.innerHTML = PIPETTE_ICON;
      const inputLabel = input.getAttribute("aria-label") || "색상";
      button.title = `${inputLabel} 스포이드`;
      button.setAttribute("aria-label", `${inputLabel} 화면에서 선택`);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        start(input, button);
      });
      wrapper.appendChild(button);
      const paletteButton = doc.createElement("button");
      paletteButton.type = "button";
      paletteButton.className = "editor-theme-color-button";
      paletteButton.innerHTML = PALETTE_ICON;
      paletteButton.title = "전체 스타일 색상에서 선택";
      paletteButton.setAttribute("aria-label", `${inputLabel} 전체 스타일 색상에서 선택`);
      paletteButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPalette(input, paletteButton);
      });
      wrapper.appendChild(paletteButton);
      registered.set(input, button);
      return button;
    }

    function registerAll(inputs = doc.querySelectorAll('input[type="color"]')) {
      return Array.from(inputs, register).filter(Boolean);
    }

    return Object.freeze({
      register,
      registerAll,
      start,
      cancel: () => finish("색상 선택을 취소했습니다"),
      applyColor,
      get active() {
        return Boolean(active);
      }
    });
  }

  window.EditorColorPickerManager = Object.freeze({
    create,
    cssColorToHex,
    sampleElementColor
  });
})();
