(function () {
  "use strict";

  const NATURE_STICKER_MOTIFS = Object.freeze([
    ["leaf", "잎사귀"],
    ["sprout", "새싹"],
    ["sprout-soil", "흙 속 새싹"],
    ["branch", "풀잎 가지"],
    ["daisy", "데이지"],
    ["tulip", "튤립"],
    ["round-tree", "둥근 나무"],
    ["pine", "소나무"],
    ["forest", "숲"],
    ["mountain", "산"],
    ["sun-mountain", "햇살 산"],
    ["river", "강"],
    ["sun", "해"],
    ["cloud", "구름"],
    ["drop", "물방울"],
    ["butterfly", "나비"],
    ["bird", "새"],
    ["curl-plant", "덩굴 식물"],
    ["grass", "풀"],
    ["cactus", "선인장"]
  ]);

  const NATURE_STICKERS = Object.freeze(Object.fromEntries([
    ...NATURE_STICKER_MOTIFS.map(([key, label]) => (
      [`sticker-nature-friend-${key}`, {
        label: `${label} 친구`,
        category: "sticker",
        stickerCategory: "nature",
        mask: `assets/nature-stickers/nature-friend-${key}.png`
      }]
    )),
    ...NATURE_STICKER_MOTIFS.map(([key, label]) => (
      [`sticker-nature-outline-${key}`, {
        label: `${label} 선화`,
        category: "sticker",
        stickerCategory: "nature",
        mask: `assets/nature-stickers/nature-outline-${key}.png`
      }]
    ))
  ]));

  const EARTH_OUTLINE_MOTIFS = Object.freeze([
    ["globe", "지구"],
    ["world-map", "세계 지도 지구"],
    ["heart", "마음 지구"],
    ["sprout", "새싹 지구"],
    ["leaves", "잎사귀 지구"],
    ["hand", "손 위의 지구"],
    ["hands", "돌보는 지구"],
    ["orbit", "궤도 지구"],
    ["sparkle", "반짝이는 지구"],
    ["smile", "웃는 지구"],
    ["route", "여정 지구"],
    ["plane", "여행 지구"],
    ["half-nature", "자연 지구"],
    ["heart-base", "사랑받는 지구"],
    ["map", "세계 지구"],
    ["planet", "행성 지구"],
    ["recycle", "순환 지구"],
    ["sun", "햇살 지구"],
    ["water", "물 위의 지구"],
    ["people", "함께하는 지구"]
  ]);

  const EARTH_FRIEND_MOTIFS = Object.freeze([
    ["heart-hug", "마음을 안은 지구"],
    ["wave", "인사하는 지구"],
    ["sprout", "새싹 지구 친구"],
    ["paper-plane", "비행기 지구 친구"],
    ["leaf", "잎사귀 지구 친구"],
    ["nurture", "새싹을 품은 지구"],
    ["plant", "새싹을 심는 지구"],
    ["water", "물을 주는 지구"],
    ["cheer", "기뻐하는 지구"],
    ["music", "노래하는 지구"],
    ["sparkle", "반짝이는 지구 친구"],
    ["recycle", "순환 지구 친구"],
    ["shine", "빛나는 지구"],
    ["meditate", "명상하는 지구"],
    ["orbit", "궤도 지구 친구"],
    ["star", "별을 든 지구"],
    ["message", "소식을 보내는 지구"],
    ["love", "사랑을 전하는 지구"],
    ["leaf-hug", "잎을 안은 지구"],
    ["heart-hands", "마음을 모은 지구"]
  ]);

  const EARTH_STICKERS = Object.freeze(Object.fromEntries([
    ...EARTH_OUTLINE_MOTIFS.map(([key, label]) => (
      [`sticker-earth-outline-${key}`, {
        label,
        category: "sticker",
        stickerCategory: "earth",
        mask: `assets/earth-stickers/earth-outline-${key}.png`
      }]
    )),
    ...EARTH_FRIEND_MOTIFS.map(([key, label]) => (
      [`sticker-earth-friend-${key}`, {
        label,
        category: "sticker",
        stickerCategory: "earth",
        mask: `assets/earth-stickers/earth-friend-${key}.png`
      }]
    ))
  ]));


  const DAILY_COLOR_MOTIFS = Object.freeze([
    ["heart-wave", "인사하는 하트"],
    ["heart-pair", "함께하는 하트"],
    ["heart-sparkle", "반짝이는 하트"],
    ["sprout-wave", "인사하는 새싹"],
    ["drop-wave", "인사하는 물방울"],
    ["branch-cheer", "응원하는 풀잎"],
    ["sprout-cheer", "응원하는 새싹"],
    ["plane-wave", "인사하는 비행기"],
    ["plane-flight", "날아가는 비행기"],
    ["arrow-rise", "올라가는 화살표"],
    ["sparkle-cheer", "응원하는 반짝이"],
    ["shooting-star", "달리는 별"],
    ["cloud-cheer", "응원하는 구름"],
    ["drop-cheer", "응원하는 물방울"],
    ["flower-cheer", "응원하는 꽃"],
    ["gift-cheer", "응원하는 선물"],
    ["earth-cheer", "응원하는 지구"],
    ["message-wave", "인사하는 말풍선"],
    ["camera-cheer", "응원하는 카메라"],
    ["moon-cheer", "응원하는 달"]
  ]);

  const DAILY_MOTION_MOTIFS = Object.freeze([
    ["heart", "하트 선화"],
    ["heart-underline", "밑줄 하트"],
    ["heart-double", "겹친 하트"],
    ["heart-sparkle", "반짝이는 하트 선화"],
    ["sprout-soil", "흙 속 새싹 선화"],
    ["leaf", "잎사귀 선화"],
    ["branch", "풀잎 가지 선화"],
    ["sprout-line", "새싹 선화"],
    ["plane", "종이비행기 선화"],
    ["plane-loop", "회전하는 비행기"],
    ["plane-rise", "날아오르는 비행기"],
    ["arrow-up", "올라가는 화살표 선화"],
    ["shooting-star", "달리는 별 선화"],
    ["star-rise", "날아오르는 별"],
    ["sparkle", "반짝이 선화"],
    ["burst", "빛살 선화"],
    ["wave", "물결 선화"],
    ["swoosh", "휘어진 선"],
    ["dotted-loop", "점선 궤적"],
    ["loop", "둥근 궤적"]
  ]);

  const DAILY_STICKERS = Object.freeze(Object.fromEntries([
    ...DAILY_COLOR_MOTIFS.map(([key, label]) => (
      [`sticker-daily-color-${key}`, {
        label,
        category: "sticker",
        stickerCategory: "daily",
        mask: `assets/daily-stickers/daily-color-${key}.png`
      }]
    )),
    ...DAILY_MOTION_MOTIFS.map(([key, label]) => (
      [`sticker-daily-motion-${key}`, {
        label,
        category: "sticker",
        stickerCategory: "daily",
        mask: `assets/daily-stickers/daily-motion-${key}.png`
      }]
    ))
  ]));

  // Google Drive 원본 40장을 웹용 투명 자산으로 분리한 색상 보존 스티커.
  // 생성 파일과 분류 정보는 build-sticker-library.py가 단일 원본으로 관리한다.
  const IMPORTED_STICKERS = Object.freeze(Object.fromEntries(
    (window.EditorImportedStickerManifest?.items || []).map((item) => [
      item.id,
      {
        label: item.label,
        category: "sticker",
        stickerCategory: item.category,
        image: item.asset,
        preserveColor: true,
        stickerStyle: item.style,
        taxonomyId: item.taxonomyId
      }
    ])
  ));

  const ICONS = Object.freeze({
    "clipboard-edit": { label: "상담 신청", body: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h6M8 13h4M14.5 17.5l4-4 2 2-4 4-3 .8z"/>' },
    "users-chat": { label: "초기 상담", body: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M12.5 20c.3-3.2 1.8-5 4.5-5s4.2 1.8 4.5 5M10 3h7l3 3-3 3h-2"/>' },
    "user-search": { label: "욕구 파악", body: '<circle cx="10" cy="9" r="4"/><path d="M3 20c.5-4.3 2.8-6.5 7-6.5 2 0 3.6.5 4.8 1.5M16 16l5 5M17.5 17.5a4 4 0 1 0-5.7-5.7"/>' },
    "clipboard-check": { label: "계획 수립", body: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9l1.5 1.5L12 8M8 14l1.5 1.5L12 13M14 9h2M14 14h2"/>' },
    handshake: { label: "자원 연계", body: '<path d="M3 12l4-4 4 2 2-2 4 2 4 4-4 5-3-1-2 2-2-2-2 1-5-5zM7 8l2-3 4 2 2-2 4 3-2 2M9 13l4 4M12 11l4 4"/>' },
    "report-check": { label: "사후관리", body: '<rect x="4" y="3" width="14" height="18" rx="2"/><path d="M8 3V1h6v2M8 16v-3M11 16V9M14 16v-5M16 19l2 2 4-5"/>' },
    message: { label: "상담", body: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>' },
    clipboard: { label: "계획", body: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/>' },
    network: { label: "연계", body: '<circle cx="12" cy="5" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M10 7.5L6.5 15M14 7.5l3.5 7.5M8 18h8"/>' },
    home: { label: "지원", body: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/><path d="M9 11h6"/>' },
    calendar: { label: "일정", body: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>' },
    clock: { label: "시간", body: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
    heart: { label: "하트", body: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8z"/>' },
    gift: { label: "후원", body: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 0-5C10.5 3 12 8 12 8zm0 0h4.5a2.5 2.5 0 1 0 0-5C13.5 3 12 8 12 8z"/>' },
    megaphone: { label: "홍보", body: '<path d="M3 11v4h4l9 4V7l-9 4H3zM7 15l2 6h3l-2-5M19 9l2-2M19 17l2 2M20 13h3"/>' },
    "book-open": { label: "교육", body: '<path d="M3 5.5A5.5 5.5 0 0 1 8.5 5H12v15H8.5A5.5 5.5 0 0 0 3 20.5zM21 5.5A5.5 5.5 0 0 0 15.5 5H12v15h3.5a5.5 5.5 0 0 1 5.5.5z"/>' },
    medical: { label: "건강", body: '<circle cx="12" cy="12" r="9"/><path d="M9 7h6v3h3v5h-3v3H9v-3H6v-5h3z"/>' },
    phone: { label: "전화", body: '<path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 1.1-.9 2-2 2C10.2 21 3 13.8 3 5a2 2 0 0 1 2-2z"/>' },
    mail: { label: "안내", body: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>' },
    "map-pin": { label: "방문", body: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>' },
    "file-text": { label: "서류", body: '<path d="M6 2h8l4 4v16H6zM14 2v5h5M9 12h6M9 16h6"/>' },
    "check-circle": { label: "완료", body: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 6-7"/>' },
    lightbulb: { label: "아이디어", body: '<path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.5 1.4-1.5 2.5h-4c0-1.1-.6-1.8-1.5-2.5z"/>' },
    shield: { label: "보호", body: '<path d="M12 2l8 3v6c0 5.2-3.4 9-8 11-4.6-2-8-5.8-8-11V5z"/><path d="M9 12l2 2 4-5"/>' },
    users: { label: "사람들", body: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.4-4.2 2.4-6.3 6-6.3s5.6 2.1 6 6.3M14 15c3.8-.5 6 1.2 7 5"/>' },
    building: { label: "기관", body: '<path d="M4 22V4h11v18M15 9h5v13M8 8h3M8 12h3M8 16h3M18 13h.01M18 17h.01M2 22h20"/>' },
    recurring: { label: "정기후원", body: '<path d="M7 3v3M17 3v3M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M12 18s-4-2.3-4-5a2.2 2.2 0 0 1 4-1.3A2.2 2.2 0 0 1 16 13c0 2.7-4 5-4 5z"/>' },
    handHeart: { label: "일시후원", body: '<path d="M12 9.5s-4.8-2.7-4.8-5.8A2.7 2.7 0 0 1 12 2a2.7 2.7 0 0 1 4.8 1.7C16.8 6.8 12 9.5 12 9.5z"/><path d="M3 14h4l3 2h4.5a1.5 1.5 0 0 1 0 3H9"/><path d="M3 13v7h4l4 2 9-5a1.6 1.6 0 0 0-1.6-2.8L14 16"/>' },
    boxHeart: { label: "물품후원", body: '<path d="M3 8l9-5 9 5-9 5zM3 8v9l9 5 9-5V8M12 13v9"/><path d="M12 10s-3-1.7-3-3.6A1.7 1.7 0 0 1 12 5.3a1.7 1.7 0 0 1 3 1.1C15 8.3 12 10 12 10z"/>' },
    bank: { label: "계좌", body: '<path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M2 21h20M12 3l9 5H3z"/>' },
    award: { label: "수상", body: '<circle cx="12" cy="8" r="5"/><path d="M8.5 12L7 22l5-3 5 3-1.5-10M10 8l1.3 1.3L14 6.5"/>' },
    sprout: { label: "성장", body: '<path d="M12 21V10M12 13c-5 0-8-3-8-8 5 0 8 3 8 8zm0-3c0-4 3-7 8-7 0 5-3 8-8 8"/>' },
    "leaf-branch": { label: "풀잎", body: '<path d="M4 21C8 15 12 10 20 4M8 16c-3 .2-5-1.4-5-4.4 3-.2 5 1.4 5 4.4zm3.8-4.2c-2.6-1.2-3.5-3.7-2.1-6.2 2.7 1.2 3.5 3.7 2.1 6.2zm3.5-3.6c.2-3 2-4.8 5-4.8-.2 3-2 4.8-5 4.8zm-6 9.1c2.8-.8 5.1.4 5.9 3.2-2.8.8-5.1-.4-5.9-3.2z"/>' },
    "paper-plane": { label: "종이비행기", body: '<path d="M2.5 11.2 21.5 3l-7.2 18-3.7-7-8.1-2.8zM10.6 14 21.5 3"/>' },
    flower: { label: "안개꽃", body: '<path d="M12 21V10M12 15 7 10M12 13l5-5M8 11l-3 3M16 9l3 3"/><circle cx="12" cy="7" r="2.2"/><circle cx="6.5" cy="8.5" r="1.8"/><circle cx="18" cy="6.5" r="1.8"/><circle cx="4" cy="15" r="1.5"/><circle cx="20" cy="13" r="1.5"/>' },
    forsythia: { label: "개나리", body: '<path d="M3 21c5-6 9-10 18-17M8 16l-3-5M11 13l4 1M14 10l-1-5M17 7l4 1"/><path d="m4 10 2-1 2 1-2 2zm10 3 2-1 2 1-2 2zM12 4l2-1 2 1-2 2zm8 3 2-1 1 2-2 1z"/>' },
    book: { label: "기록", body: '<path d="M3 5.5A5.5 5.5 0 0 1 8.5 5H12v15H8.5A5.5 5.5 0 0 0 3 20.5zM21 5.5A5.5 5.5 0 0 0 15.5 5H12v15h3.5a5.5 5.5 0 0 1 5.5.5z"/>' },
    star: { label: "별", body: '<path d="m12 2.7 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 2.7z"/>' },
    "sticker-heart-smile": { label: "웃는 하트", category: "sticker", body: '<path d="M12 20.5 4.3 13A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 7.7 7z"/><circle cx="9.4" cy="11.2" r=".55" fill="currentColor" stroke="none"/><circle cx="14.6" cy="11.2" r=".55" fill="currentColor" stroke="none"/><path d="M9.8 14c1.3 1 3.1 1 4.4 0M5.2 13.5 2.8 15M18.8 13.5l2.4 1.5M8.2 18.3 7.5 22M15.8 18.3l.7 3.7"/>' },
    "sticker-heart-pair": { label: "함께 하트", category: "sticker", body: '<path d="M8.5 17.5 3.8 13a3.7 3.7 0 0 1 4.7-5.7A3.7 3.7 0 0 1 13.2 13zM16 19.5l-4.2-4a3.3 3.3 0 0 1 4.2-5 3.3 3.3 0 0 1 4.2 5z"/><path d="M6.5 11.5h.01M10 11.5h.01M7 13.5c.8.6 1.7.6 2.5 0M14.2 14.5h.01M17.3 14.5h.01M14.8 16.3c.7.5 1.3.5 2 0"/>' },
    "sticker-sprout-smile": { label: "새싹 친구", category: "sticker", body: '<path d="M12 10V6M12 7C8 7 6 5 6 2c3.8 0 6 1.8 6 5zm0-1c0-3.5 2.2-5.5 6-5.5 0 3.5-2.2 5.5-6 5.5z"/><path d="M7 12c1.3-1.4 8.7-1.4 10 0l1 7c-2.7 2-9.3 2-12 0z"/><circle cx="10" cy="15" r=".5" fill="currentColor" stroke="none"/><circle cx="14" cy="15" r=".5" fill="currentColor" stroke="none"/><path d="M10 17c1.2.8 2.8.8 4 0M6.5 15.5 3 17M17.5 15.5 21 17"/>' },
    "sticker-leaf-smile": { label: "잎사귀 친구", category: "sticker", body: '<path d="M4 15C4 7 9 3 20 3c0 11-5 16-13 16zM7 18 19 5"/><circle cx="9" cy="12" r=".5" fill="currentColor" stroke="none"/><circle cx="12" cy="10" r=".5" fill="currentColor" stroke="none"/><path d="M9.3 14c1 .6 2 .4 2.7-.4M6 16l-3 1M8 19l-1 3M13 16l2 3"/>' },
    "sticker-branch-smile": { label: "풀잎 친구", category: "sticker", body: '<path d="M5 21C8 16 12 10 19 4M9 15c-3 0-4.5-1.5-4.5-4.5 3 0 4.5 1.5 4.5 4.5zm4-5c-2.5-1-3.2-3.4-2-5.5 2.6 1.1 3.3 3.4 2 5.5zm1 5c.5-3 2.5-4.5 5.5-4-.5 3-2.5 4.5-5.5 4z"/><circle cx="7.1" cy="12.1" r=".35" fill="currentColor" stroke="none"/><path d="M6.4 13.2c.5.4 1 .4 1.5 0M4.5 13l-2 1.5"/>' },
    "sticker-plane-smile": { label: "비행기 친구", category: "sticker", body: '<path d="M2.5 10.5 21.5 3l-7.2 18-3.8-7-8-3.5zM10.5 14 21.5 3"/><circle cx="9" cy="10.5" r=".45" fill="currentColor" stroke="none"/><circle cx="11.5" cy="9.5" r=".45" fill="currentColor" stroke="none"/><path d="M9.5 12c.8.4 1.5.2 2-.5M5 15c-2 1-2.5 3-1 5" stroke-dasharray="1.5 2"/>' },
    "sticker-sparkle-smile": { label: "반짝이 친구", category: "sticker", body: '<path d="M12 2c1.2 5.2 3.8 8 9 9-5.2 1.2-7.8 4-9 9-1.2-5-3.8-7.8-9-9 5.2-1 7.8-3.8 9-9z"/><circle cx="10" cy="10.8" r=".45" fill="currentColor" stroke="none"/><circle cx="14" cy="10.8" r=".45" fill="currentColor" stroke="none"/><path d="M10.5 13c1 .7 2 .7 3 0M5 5 3.5 3.5M19 5l1.5-1.5M5 17l-1.5 1.5M19 17l1.5 1.5"/>' },
    "sticker-cloud-smile": { label: "구름 친구", category: "sticker", body: '<path d="M5.5 18.5h12a4 4 0 0 0 .5-8 6 6 0 0 0-11.5-1A4.6 4.6 0 0 0 5.5 18.5z"/><circle cx="10" cy="14" r=".5" fill="currentColor" stroke="none"/><circle cx="14" cy="14" r=".5" fill="currentColor" stroke="none"/><path d="M10.5 16c1 .7 2 .7 3 0M5 16l-2 1M19 16l2 1M8 19l-1 2M16 19l1 2"/>' },
    "sticker-drop-smile": { label: "물방울 친구", category: "sticker", body: '<path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z"/><circle cx="9.5" cy="14" r=".5" fill="currentColor" stroke="none"/><circle cx="14.5" cy="14" r=".5" fill="currentColor" stroke="none"/><path d="M10 16.5c1.2.8 2.8.8 4 0M6 14l-3 1M18 14l3 1M9 21l-1 2M15 21l1 2"/>' },
    "sticker-flower-smile": { label: "꽃 친구", category: "sticker", body: '<circle cx="12" cy="10" r="3"/><path d="M12 7c-1-5 4-6 4-2 4-2 6 3 2 4 4 2 1 6-2 4 0 4-5 4-4 0-3 4-7 1-4-1-4-5 0-5-3-2 0-6 3-4zM12 13v8M12 18l-4-2M12 18l4-2"/><circle cx="11" cy="10" r=".35" fill="currentColor" stroke="none"/><circle cx="13" cy="10" r=".35" fill="currentColor" stroke="none"/><path d="M11.2 11.5c.5.4 1.1.4 1.6 0"/>' },
    "sticker-gift-smile": { label: "선물 친구", category: "sticker", body: '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M12 9v12M4 13h16M12 9H8a2 2 0 1 1 0-4c2.5 0 4 4 4 4zm0 0h4a2 2 0 1 0 0-4c-2.5 0-4 4-4 4z"/><circle cx="9.5" cy="16.5" r=".4" fill="currentColor" stroke="none"/><circle cx="14.5" cy="16.5" r=".4" fill="currentColor" stroke="none"/><path d="M10.2 18c1 .6 2.6.6 3.6 0"/>' },
    "sticker-earth-smile": { label: "지구 친구", category: "sticker", body: '<circle cx="12" cy="11" r="8"/><path d="M6 6c2 0 3 2 5 2 1.5 0 2-2 4-2M5 13c2-1 3 0 4 2 1 2 3 2 4 4M17 10c2 1 3 2 3 4"/><circle cx="9.5" cy="11" r=".45" fill="currentColor" stroke="none"/><circle cx="14.5" cy="11" r=".45" fill="currentColor" stroke="none"/><path d="M10 13.5c1.2.8 2.8.8 4 0M7 18l-2 3M17 18l2 3M4.5 11 2 9M19.5 11 22 9"/>' },
    "sticker-earth-heart": { label: "마음 지구", category: "sticker", body: '<circle cx="12" cy="11" r="8"/><path d="M6 6c2 0 3 2 5 2 1.5 0 2-2 4-2M5 13c2-1 3 0 4 2 1 2 3 2 4 4M17 10c2 1 3 2 3 4M12 17s-4-2.2-4-5a2.2 2.2 0 0 1 4-1.3A2.2 2.2 0 0 1 16 12c0 2.8-4 5-4 5z"/>' },
    "sticker-earth-sprout": { label: "새싹 지구", category: "sticker", body: '<circle cx="12" cy="13" r="7"/><path d="M7 9c2 0 3 2 5 2 2 0 2-2 4-2M7 15c2-1 3 0 4 2 1 1 2 2 3 2M12 6V3M12 4C9 4 8 2.5 8 1c2.5 0 4 1 4 3zm0 0c0-2 1.5-3 4-3 0 2-1.5 3-4 3z"/><circle cx="10" cy="14" r=".4" fill="currentColor" stroke="none"/><circle cx="14" cy="14" r=".4" fill="currentColor" stroke="none"/><path d="M10.5 16c1 .6 2 .6 3 0"/>' },
    "sticker-camera-smile": { label: "카메라 친구", category: "sticker", body: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 7 1.5-3h5L16 7"/><circle cx="12" cy="13" r="4"/><circle cx="10.5" cy="12.5" r=".35" fill="currentColor" stroke="none"/><circle cx="13.5" cy="12.5" r=".35" fill="currentColor" stroke="none"/><path d="M10.8 14.5c.8.5 1.6.5 2.4 0M5.5 10h.01M6 20l-1 2M18 20l1 2"/>' },
    "sticker-moon-smile": { label: "달 친구", category: "sticker", body: '<path d="M18.5 17.5A8.5 8.5 0 0 1 7 5.5 8.6 8.6 0 1 0 18.5 17.5z"/><circle cx="10.5" cy="13" r=".4" fill="currentColor" stroke="none"/><circle cx="13.5" cy="13" r=".4" fill="currentColor" stroke="none"/><path d="M11 15c.8.5 1.5.5 2.2 0M18 5l.7 1.8 1.8.7-1.8.7L18 10l-.7-1.8-1.8-.7 1.8-.7z"/>' },
    "sticker-butterfly-smile": { label: "나비 친구", category: "sticker", body: '<path d="M11 11C8 4 2 4 3 10c.5 3 4 4 8 3m2-2c3-7 9-7 8-1-.5 3-4 4-8 3M12 8v10M10 20l2-2 2 2M11 8 9 5M13 8l2-3"/><circle cx="11.2" cy="12" r=".35" fill="currentColor" stroke="none"/><circle cx="12.8" cy="12" r=".35" fill="currentColor" stroke="none"/><path d="M11.3 13.5c.5.3.9.3 1.4 0"/>' },
    "sticker-tree-smile": { label: "나무 친구", category: "sticker", body: '<path d="M8 18H5l3-4H6l3-4H7l5-7 5 7h-2l3 4h-2l3 4h-6v4h-2v-4z"/><circle cx="10.5" cy="13" r=".4" fill="currentColor" stroke="none"/><circle cx="13.5" cy="13" r=".4" fill="currentColor" stroke="none"/><path d="M11 15c.8.5 1.4.5 2.2 0M7 17l-3 2M17 17l3 2"/>' },
    "sticker-mountain-sun": { label: "햇살 산", category: "sticker", body: '<path d="m2 20 6-9 3 4 4-7 7 12zM7 20l4-5 3 5M16 5a3 3 0 1 1 4 3M18 1v2M22 3l-1.5 1M22 8h-2"/><circle cx="14" cy="15.5" r=".4" fill="currentColor" stroke="none"/><circle cx="17" cy="15.5" r=".4" fill="currentColor" stroke="none"/><path d="M14.5 17c.7.5 1.4.5 2.1 0"/>' },
    "sticker-dove": { label: "평화 새", category: "sticker", body: '<path d="M3 14c4-1 5-5 8-8 0 4 2 5 5 4l5-2c-1 5-5 9-11 9l-4 3 1-4c-2 0-3-1-4-2zM10 10c-3-1-5-3-6-6 4 0 7 2 8 5"/><circle cx="16.5" cy="11.5" r=".45" fill="currentColor" stroke="none"/>' },
    "sticker-speech-smile": { label: "이야기 친구", category: "sticker", body: '<path d="M3 4h18v13H9l-6 4z"/><circle cx="8.5" cy="10" r=".5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r=".5" fill="currentColor" stroke="none"/><path d="M9.5 13c1.5 1 3.5 1 5 0"/>' },
    ...NATURE_STICKERS,
    ...EARTH_STICKERS,
    ...DAILY_STICKERS,
    ...IMPORTED_STICKERS
  });

  const STICKER_KEYS = Object.freeze(
    Object.keys(ICONS).filter((key) => ICONS[key].category === "sticker")
  );

  const STICKER_CATEGORIES = Object.freeze({
    nature: Object.freeze({
      label: "자연·계절",
      keys: Object.freeze(STICKER_KEYS.filter((key) => ICONS[key].stickerCategory === "nature"))
    }),
    animal: Object.freeze({
      label: "동물",
      keys: Object.freeze(STICKER_KEYS.filter((key) => ICONS[key].stickerCategory === "animal"))
    }),
    botanical: Object.freeze({
      label: "보태니컬",
      keys: Object.freeze(STICKER_KEYS.filter((key) => ICONS[key].stickerCategory === "botanical"))
    }),
    neon: Object.freeze({
      label: "형광·네온",
      keys: Object.freeze(STICKER_KEYS.filter((key) => ICONS[key].stickerCategory === "neon"))
    }),
    earth: Object.freeze({
      label: "지구",
      keys: Object.freeze(STICKER_KEYS.filter((key) => ICONS[key].stickerCategory === "earth"))
    }),
    daily: Object.freeze({
      label: "사람·일상",
      keys: Object.freeze(STICKER_KEYS.filter((key) => ICONS[key].stickerCategory === "daily"))
    }),
    basic: Object.freeze({
      label: "기본",
      keys: Object.freeze(STICKER_KEYS.filter((key) => !ICONS[key].stickerCategory || ICONS[key].stickerCategory === "basic"))
    })
  });

  const DECORATION_STYLES = Object.freeze({
    plain: { label: "투명" },
    "soft-circle": { label: "은은한 원" },
    "solid-circle": { label: "채운 원" },
    ring: { label: "원형 테두리" },
    "double-ring": { label: "이중 원" },
    "soft-square": { label: "은은한 사각" },
    "solid-square": { label: "채운 사각" },
    diamond: { label: "마름모" },
    capsule: { label: "캡슐" },
    spotlight: { label: "빛 번짐" },
    underline: { label: "밑줄" },
    badge: { label: "배지" }
  });

  function normalizeIcon(value, fallback = "heart", allowEmpty = false) {
    if (allowEmpty && (value === null || value === "" || value === "none")) return null;
    return ICONS[value] ? value : fallback;
  }

  function normalizeDecoration(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return {
      icon: normalizeIcon(source.icon, "heart", true),
      style: DECORATION_STYLES[source.style] ? source.style : "plain"
    };
  }

  function renderIcon(iconKey, attributes = "") {
    const icon = ICONS[iconKey] || ICONS.heart;
    if (icon.image) {
      return `<svg class="editor-raster-sticker" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${attributes}><image href="${icon.image}" x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet"/></svg>`;
    }
    if (icon.mask) {
      const maskId = `editor-sticker-mask-${iconKey.replace(/[^a-z0-9_-]/gi, "-")}`;
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${attributes}><mask id="${maskId}"><image href="${icon.mask}" x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet"/></mask><rect x="0" y="0" width="24" height="24" fill="currentColor" stroke="none" mask="url(#${maskId})"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${attributes}>${icon.body}</svg>`;
  }

  window.EditorVisualAssetManager = Object.freeze({
    DECORATION_STYLES,
    ICONS,
    STICKER_CATEGORIES,
    STICKER_KEYS,
    IMPORTED_STICKER_KEYS: Object.freeze(Object.keys(IMPORTED_STICKERS)),
    normalizeDecoration,
    normalizeIcon,
    renderIcon
  });
})();
