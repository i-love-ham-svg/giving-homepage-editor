(function () {
  "use strict";

  function isMainIntroSection(sectionId) {
    return sectionId === "mainIntro" || /^mainIntro\d+$/.test(String(sectionId));
  }

  function isGreetingSection(sectionId) {
    return sectionId === "greeting" || /^greeting\d+$/.test(String(sectionId));
  }

  function isProgramSection(sectionId) {
    return sectionId === "program" || /^program\d+$/.test(String(sectionId));
  }

  function isProcessSection(sectionId) {
    return sectionId === "process" || /^process\d+$/.test(String(sectionId));
  }

  function isHistorySection(sectionId) {
    return sectionId === "history" || /^history\d+$/.test(String(sectionId));
  }

  function isDonationSection(sectionId) {
    return sectionId === "donation" || /^donation\d+$/.test(String(sectionId));
  }

  function isGallerySection(sectionId) {
    return sectionId === "gallery" || /^gallery\d+$/.test(String(sectionId));
  }

  function isEssentialSection(sectionId) {
    return ["facility", "organization", "location", "volunteer", "notice", "schedule", "footer"].includes(String(sectionId))
      || /^essential\d+$/.test(String(sectionId));
  }

  function normalizeSectionId(sectionId, labels = {}) {
    return labels?.[sectionId] ? sectionId : "greeting";
  }

  function normalizeSectionOrder(order, labels = {}) {
    const nextOrder = Array.isArray(order) && order.length ? [...order] : ["mainIntro", "greeting"];
    const filtered = nextOrder.filter((sectionId) => labels[sectionId]);
    Object.keys(labels).forEach((sectionId) => {
      if (filtered.includes(sectionId)) return;
      if (isMainIntroSection(sectionId)) {
        const firstNonIntro = filtered.findIndex((id) => !isMainIntroSection(id));
        filtered.splice(firstNonIntro >= 0 ? firstNonIntro : filtered.length, 0, sectionId);
      } else if ((isProgramSection(sectionId) || isProcessSection(sectionId) || isHistorySection(sectionId) || isDonationSection(sectionId) || isGallerySection(sectionId) || isEssentialSection(sectionId)) && filtered.some(isGreetingSection)) {
        filtered.splice(filtered.findIndex(isGreetingSection), 0, sectionId);
      } else {
        filtered.push(sectionId);
      }
    });
    const normalized = filtered.length ? filtered : ["mainIntro", "greeting"].filter((sectionId) => labels[sectionId]);
    if (labels.footer && normalized.includes("footer")) {
      return [...normalized.filter((sectionId) => sectionId !== "footer"), "footer"];
    }
    return normalized;
  }

  function getIntroIndex(sectionId, order) {
    const sourceOrder = Array.isArray(order) ? order : [];
    const introIds = normalizeSectionOrder(sourceOrder, Object.fromEntries(sourceOrder.map((id) => [id, true]))).filter(isMainIntroSection);
    return Math.max(1, introIds.indexOf(sectionId) + 1);
  }

  function getGreetingIndex(sectionId, order) {
    const sourceOrder = Array.isArray(order) ? order : [];
    const greetingIds = normalizeSectionOrder(sourceOrder, Object.fromEntries(sourceOrder.map((id) => [id, true]))).filter(isGreetingSection);
    return Math.max(1, greetingIds.indexOf(sectionId) + 1);
  }

  function getDisplayLabel(sectionId, options = {}) {
    const labels = options.labels ?? {};
    const order = options.order ?? Object.keys(labels);
    if (isMainIntroSection(sectionId)) {
      const index = getIntroIndex(sectionId, order);
      return index <= 1 ? "메인 소개" : `메인 소개 ${index}`;
    }
    if (isGreetingSection(sectionId)) {
      const index = getGreetingIndex(sectionId, order);
      return index <= 1 ? "대표자 인사말" : `대표자 인사말 ${index}`;
    }
    if (isProgramSection(sectionId)) {
      const programIds = order.filter(isProgramSection);
      const index = Math.max(1, programIds.indexOf(sectionId) + 1);
      return index <= 1 ? "프로그램 소개" : `프로그램 소개 ${index}`;
    }
    if (isProcessSection(sectionId)) {
      const processIds = order.filter(isProcessSection);
      const index = Math.max(1, processIds.indexOf(sectionId) + 1);
      return index <= 1 ? "프로세스" : `프로세스 ${index}`;
    }
    if (isHistorySection(sectionId)) {
      const historyIds = order.filter(isHistorySection);
      const index = Math.max(1, historyIds.indexOf(sectionId) + 1);
      return index <= 1 ? "연혁" : `연혁 ${index}`;
    }
    if (isDonationSection(sectionId)) {
      const donationIds = order.filter(isDonationSection);
      const index = Math.max(1, donationIds.indexOf(sectionId) + 1);
      return index <= 1 ? "후원 안내" : `후원 안내 ${index}`;
    }
    if (isGallerySection(sectionId)) {
      const galleryIds = order.filter(isGallerySection);
      const index = Math.max(1, galleryIds.indexOf(sectionId) + 1);
      return index <= 1 ? "갤러리" : `갤러리 ${index}`;
    }
    if (isEssentialSection(sectionId)) {
      return labels[sectionId] ?? "필수 정보";
    }
    return labels[sectionId] ?? "섹션";
  }

  function clampIndex(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getInsertIndexForSlot(slot, explicitIndex, order, visibleIds) {
    const sectionOrder = Array.isArray(order) ? order : [];
    if (Number.isFinite(explicitIndex)) return clampIndex(Math.round(explicitIndex), 0, sectionOrder.length);
    const visible = Array.isArray(visibleIds) ? visibleIds : sectionOrder;
    if (slot === "top") return 0;
    if (slot === "between" && visible.length >= 2) {
      const index = sectionOrder.indexOf(visible[1]);
      return index >= 0 ? index : sectionOrder.length;
    }
    return sectionOrder.length;
  }

  function placeSectionInOrder(sectionId, slot, explicitIndex, order, visibleIds) {
    const nextOrder = Array.isArray(order) ? [...order] : [];
    const currentIndex = nextOrder.indexOf(sectionId);
    if (currentIndex >= 0) nextOrder.splice(currentIndex, 1);
    const insertIndex = getInsertIndexForSlot(slot, explicitIndex, nextOrder, visibleIds);
    nextOrder.splice(clampIndex(insertIndex, 0, nextOrder.length), 0, sectionId);
    if (sectionId === "footer" || nextOrder.includes("footer")) {
      return [...nextOrder.filter((id) => id !== "footer"), "footer"];
    }
    return nextOrder;
  }

  function canPasteSectionSnapshot(targetSectionId, snapshot, labels = {}) {
    if (!snapshot) return false;
    const target = normalizeSectionId(targetSectionId, labels);
    return snapshot.sectionId === target
      || (isMainIntroSection(snapshot.sectionId) && isMainIntroSection(target))
      || (isGreetingSection(snapshot.sectionId) && isGreetingSection(target))
      || (isProgramSection(snapshot.sectionId) && isProgramSection(target))
      || (isProcessSection(snapshot.sectionId) && isProcessSection(target))
      || (isHistorySection(snapshot.sectionId) && isHistorySection(target))
      || (isDonationSection(snapshot.sectionId) && isDonationSection(target))
      || (isGallerySection(snapshot.sectionId) && isGallerySection(target))
      || (isEssentialSection(snapshot.sectionId) && isEssentialSection(target));
  }

  function getClipboardPasteLabel(clipboard) {
    if (!clipboard) return "붙여넣기";
    const clipboardLabel = clipboard.label ?? "복사한 섹션";
    return isMainIntroSection(clipboard.sectionId)
      ? `${clipboardLabel} 붙여넣기`
      : `${clipboardLabel} 새 섹션으로 붙여넣기`;
  }

  window.EditorSectionManager = Object.freeze({
    canPasteSectionSnapshot,
    getClipboardPasteLabel,
    getDisplayLabel,
    getInsertIndexForSlot,
    getGreetingIndex,
    getIntroIndex,
    isGreetingSection,
    isDonationSection,
    isEssentialSection,
    isHistorySection,
    isGallerySection,
    isMainIntroSection,
    isProgramSection,
    isProcessSection,
    normalizeSectionId,
    normalizeSectionOrder,
    placeSectionInOrder
  });
})();
