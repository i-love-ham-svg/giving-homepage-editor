(() => {
  "use strict";

  const pageId = document.body.dataset.page || "facility";
  const main = document.getElementById("detailMain");
  const navItems = [
    ["facility", "시설현황", "facility-detail.html"],
    ["schedule", "프로그램 시간표", "program-schedule.html"],
    ["case", "사례관리", "case-management-detail.html"],
    ["organization", "조직도·직원", "organization-staff.html"],
    ["video", "영상 아카이브", "video-archive.html"],
    ["application", "온라인 신청", "online-application.html"]
  ];

  const scheduleItems = [
    ["월", "요가", "09:00~10:00 · 청소년문화공간", "월요일 오전 정기 프로그램"],
    ["월", "장구난타", "10:00~12:00 · 강당", "월요일 오전 정기 프로그램"],
    ["월", "탁구 동아리", "13:00~16:00 · 강당", "월요일 오후 동아리 활동"],
    ["화", "통기타", "10:00~12:00 · 3실", "화요일 오전 정기 프로그램"],
    ["화", "문인화", "10:00~12:00 · 5실", "화요일 오전 정기 프로그램"],
    ["화", "노래교실", "13:00~15:00 · 강당", "화요일 오후 정기 프로그램"],
    ["수", "라인댄스", "13:00~15:00 · 강당", "수요일 오후 정기 프로그램"],
    ["목", "한글", "13:00~15:00 · 3실", "목요일 오후 정기 프로그램"],
    ["목", "봉사 동아리", "13:00~15:00 · 5실/강당", "목요일 오후 동아리 활동"],
    ["목", "장기 동아리", "13:00~16:00 · 1실", "목요일 오후 동아리 활동"],
    ["금", "기체조", "13:00~14:00 · 강당", "금요일 오후 정기 프로그램"],
    ["금", "송악상영관", "14:00~16:00 · 강당 · 둘째·넷째 주", "금요일 무료 영화 상영"],
    ["토", "원데이클래스", "13:00~15:00 · 실시간 · 매월 셋째 주", "토요일 월별 체험 프로그램"]
  ];

  const teams = [
    ["관장", "김형철 관장", "복지관 운영 총괄", "복지관 운영 전반을 총괄합니다."],
    ["운영지원", "부장", "사업·조직 운영", "부서 간 협업과 안정적인 사업 수행을 지원합니다."],
    ["사례관리팀", "팀장", "팀 총괄", "현재 공식 조직도에는 육아휴직 상태로 안내되어 있습니다."],
    ["사례관리팀", "사회복지사", "사례관리·지역사회보호", "복합적인 어려움이 있는 주민의 상담과 자원 연계를 담당합니다."],
    ["사례관리팀", "사회복지사", "사례관리사업", "지역주민 사례관리 업무를 담당합니다."],
    ["서비스제공팀", "팀장", "생활도움서비스 애니맘", "서비스제공팀과 생활도움서비스를 총괄합니다."],
    ["서비스제공팀", "사회복지사", "실버학당·부모자녀·자율이용", "송악실버학당, 송악상영관, 원데이클래스를 담당합니다."],
    ["서비스제공팀", "사회복지사", "취미·여가·건강증진", "취미·여가 및 어르신 건강증진 사업을 담당합니다."],
    ["서비스제공팀", "사회복지사", "지역사회보호", "지역사회보호사업을 담당합니다."],
    ["서비스제공팀", "조리원", "복지관 식당", "복지관 식당 조리 업무를 담당합니다."],
    ["지역조직팀", "팀장", "주민조직화·복지네트워크", "직원교육과 사회복지현장실습을 포함한 팀 업무를 총괄합니다."],
    ["지역조직팀", "사회복지사", "홍보·후원·자원봉사·대관", "주민조직화와 지역 자원 연계를 담당합니다."],
    ["지역조직팀", "노인일자리 전담인력", "노인일자리지원사업", "노인일자리지원사업을 전담합니다."],
    ["운영지원팀", "사무원", "회계·공문서·서무", "회계와 공문서 및 서무 업무를 담당합니다."]
  ];

  const videos = [
    ["nUWMRojXmVI", "25년 송악실버학당 4기 활동영상", "송악실버학당 4기의 활동 기록입니다."],
    ["kyQhkc6hG9M", "[2025년] 함께 만든 변화, 함께 나눈 하루들의 기록", "2025년 주민과 함께 만든 복지관 활동을 영상으로 소개합니다."],
    ["1vok5vBLvEE", "2025년 송악사회복지관 사회복지현장실습 이야기", "사회복지현장실습 과정과 참여 이야기를 담았습니다."],
    ["xS3G8glmf5U", "[2025년 상반기] 함께여서 더 빛났던, 송악사회복지관 이야기", "2025년 상반기 복지관 활동을 돌아보는 영상입니다."],
    ["beD90-10L80", "25년 송악사회복지관의 어버이날 이야기", "지역 어르신과 함께한 어버이날 활동 기록입니다."],
    ["_dyB7jHw7XU", "송악사회복지관 프로그램 소개", "복지관에서 운영하는 주요 프로그램을 영상으로 안내합니다."]
  ];

  function renderHeader() {
    const header = document.getElementById("detailHeader");
    const currentNav = navItems.find(([id]) => id === pageId) || navItems[0];
    const parentLabel = ["schedule", "case", "application"].includes(pageId) ? "사업 안내" : pageId === "video" ? "알림마당" : "복지관 소개";
    const mainViewUrl = "representative-greeting-editor.html?mode=view";
    header.innerHTML = `
      <div class="detail-header-inner">
        <a class="detail-brand" href="${mainViewUrl}" aria-label="송악사회복지관 메인으로 이동">
          <span class="detail-brand-mark" aria-hidden="true">송</span><span>송악사회복지관</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="detailNav">전체 메뉴</button>
        <nav class="detail-nav" id="detailNav" aria-label="상세페이지 메뉴">
          ${navItems.map(([id, label, url]) => `<a href="${url}"${id === pageId ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
        </nav>
      </div>
      <nav class="detail-breadcrumb" aria-label="현재 위치"><a href="${mainViewUrl}">메인</a><span aria-hidden="true">›</span><span>${parentLabel}</span><span aria-hidden="true">›</span><span aria-current="page">${currentNav[1]}</span></nav>`;
    const toggle = header.querySelector(".nav-toggle");
    const nav = header.querySelector(".detail-nav");
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
    nav.addEventListener("click", () => { toggle.setAttribute("aria-expanded", "false"); nav.classList.remove("is-open"); });
  }

  function hero(eyebrow, title, description, actions = "") {
    return `<section class="detail-hero"><div class="detail-hero-inner"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="hero-description">${description}</p>${actions ? `<div class="hero-actions">${actions}</div>` : ""}</div></section>`;
  }

  function section(title, description, content, alt = false) {
    return `<section class="section${alt ? " alt" : ""}"><div class="section-inner"><div class="section-heading"><h2>${title}</h2>${description ? `<p>${description}</p>` : ""}</div>${content}</div></section>`;
  }

  function getPublishedDetailModel(kind) {
    const defaults = window.SongakDetailBundles?.createModel?.(pageId, kind) || null;
    try {
      const payload = JSON.parse(localStorage.getItem("songak-detail-publish-payload") || "null");
      const published = payload?.[pageId]?.[kind];
      return published && typeof published === "object" ? published : defaults;
    } catch {
      return defaults;
    }
  }

  function canonicalRows(kind, fallback) {
    const items = getPublishedDetailModel(kind)?.items;
    return Array.isArray(items) && items.length
      ? items.map((item) => [item.badge, item.title, item.meta, item.description, item])
      : fallback;
  }

  function renderFacility() {
    const fallbackFloors = [
      ["outside", "외부", "야외 시설", ["주차장(장애인 주차 포함)", "농구장"], "주민 방문과 야외 활동을 지원하는 공간입니다."],
      ["3f", "3F", "옥상", ["게이트볼장", "야외 테라스"], "체육과 휴식을 함께 즐길 수 있는 옥상 공간입니다."],
      ["2f", "2F", "문화·교육 공간", ["프로그램실 4·5·6", "강당", "청소년문화공간", "심리치료실", "노인회 사무실", "부모상담실", "노래방 1·2·3"], "교육, 문화, 상담 프로그램이 운영되는 주요 활동 공간입니다."],
      ["1f", "1F", "상담·생활 공간", ["프로그램실 1·3", "사무실·관장실", "식당", "당구장", "체력단련실", "탁구장", "통신실", "육아나눔터"], "방문 상담부터 식사, 운동, 가족 이용까지 이어지는 생활 밀착 공간입니다."],
      ["b1", "B1", "시설 관리 공간", ["보일러실", "전기실", "창고 1·2", "비상발전기실"], "복지관의 안전하고 안정적인 운영을 위한 관리 공간입니다."]
    ];
    const canonicalFloors = getPublishedDetailModel("selector")?.items;
    const floors = Array.isArray(canonicalFloors) && canonicalFloors.length
      ? canonicalFloors.map((item) => [item.floorId || item.id, item.badge, item.title, String(item.meta || "").split(/\s*[·|]\s*/).filter(Boolean), item.description])
      : fallbackFloors;
    main.innerHTML = hero("FACILITIES", "시설을 한눈에 확인하세요", "층별 공간과 주요 편의시설, 이용 문의 정보를 실제 방문 전에 확인할 수 있습니다.", `<a class="btn primary" href="#floorGuide">층별 안내 보기</a><a class="btn" href="online-application.html?type=facility">시설 이용 문의</a>`) +
      section("기본 이용 안내", "시설별 운영시간은 프로그램과 대관 일정에 따라 달라질 수 있습니다.", `<div class="fact-grid"><div class="fact-card"><strong>주소</strong><span>충남 당진시 송악읍 송악로 656</span></div><div class="fact-card"><strong>대표전화</strong><span>041-353-5077</span></div><div class="fact-card"><strong>운영</strong><span>평일 중심 · 프로그램별 상이</span></div></div>`, true) +
      `<div class="filter-bar" id="floorGuide"><div class="filter-inner" role="tablist" aria-label="층 선택">${floors.map((f, i) => `<button class="filter-btn" id="floor-tab-${f[0]}" type="button" role="tab" data-floor="${f[0]}" aria-controls="floor-panel-${f[0]}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${f[1]}</button>`).join("")}</div></div>` +
      section("층별 배치", "층 버튼을 선택하면 해당 층의 주요 공간을 확인할 수 있습니다.", floors.map((f, i) => `<article class="floor-panel${i === 0 ? " is-active" : ""}" id="floor-panel-${f[0]}" data-floor-panel="${f[0]}" role="tabpanel" aria-labelledby="floor-tab-${f[0]}"${i === 0 ? "" : " hidden"}><div class="floor-hero-card"><div class="floor-symbol">${f[1]}</div><div class="floor-copy"><h3>${f[2]}</h3><p>${f[4]}</p><ul class="space-list">${f[3].map(v => `<li>${v}</li>`).join("")}</ul></div></div></article>`).join("")) +
      section("방문 전 확인", "엘리베이터, 장애인 편의시설 또는 특정 공간 이용 가능 여부는 방문 전에 확인해 주세요.", `<div class="callout"><h2>시설 이용 문의</h2><p>대표전화 041-353-5077로 방문 목적과 이용 공간을 알려주시면 담당자가 안내합니다.</p><div class="hero-actions"><a class="btn primary" href="tel:0413535077">전화 연결</a><a class="btn" href="online-application.html?type=facility">온라인 문의</a></div></div>`, true);
    const floorTabs = [...document.querySelectorAll("[data-floor]")];
    const selectFloor = (button, focus = false) => {
      floorTabs.forEach(item => { item.setAttribute("aria-selected", "false"); item.tabIndex = -1; });
      document.querySelectorAll("[data-floor-panel]").forEach(panel => { panel.classList.remove("is-active"); panel.hidden = true; });
      button.setAttribute("aria-selected", "true"); button.tabIndex = 0;
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      if (panel) { panel.classList.add("is-active"); panel.hidden = false; }
      if (focus) button.focus();
    };
    floorTabs.forEach((button, index) => {
      button.addEventListener("click", () => selectFloor(button));
      button.addEventListener("keydown", (event) => {
        const keyMap = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: floorTabs.length - 1 };
        if (!(event.key in keyMap)) return;
        event.preventDefault();
        selectFloor(floorTabs[(keyMap[event.key] + floorTabs.length) % floorTabs.length], true);
      });
    });
  }

  function renderScheduleRows(day = "전체", query = "") {
    const body = document.getElementById("scheduleBody");
    const normalized = query.trim().toLowerCase();
    const filtered = canonicalRows("table", scheduleItems).filter(item => (day === "전체" || item[0] === day) && (!normalized || item.slice(0, 4).join(" ").toLowerCase().includes(normalized)));
    body.innerHTML = filtered.length ? filtered.map(item => `<tr><td><span class="day-chip">${item[0]}</span></td><td><strong>${item[1]}</strong></td><td>${item[2]}</td><td>${item[3]}</td></tr>`).join("") : `<tr><td colspan="4" class="empty-result">조건에 맞는 프로그램이 없습니다.</td></tr>`;
    document.getElementById("resultCount").textContent = `${filtered.length}개 프로그램`;
  }

  function renderSchedule() {
    main.innerHTML = hero("PROGRAM SCHEDULE", "3월 게시 시간표 참고자료", "기준 연도와 현재 모집·운영 여부는 공지사항 또는 대표전화로 확인해 주세요.", `<a class="btn primary" href="#scheduleList">시간표 확인</a><a class="btn" href="online-application.html?type=program">프로그램 신청</a>`) +
      section("운영 기준", "모집 상황과 휴강 일정은 공지사항을 우선 확인해 주세요.", `<div class="fact-grid"><div class="fact-card"><strong>기준</strong><span>3월 게시본 · 현재 운영 여부 확인 필요</span></div><div class="fact-card"><strong>자율이용</strong><span>월·목 오전 / 시설 정비 별도</span></div><div class="fact-card"><strong>문의</strong><span>041-353-5077</span></div></div>`, true) +
      section("요일·시간별 프로그램", "요일을 선택하거나 프로그램명을 검색할 수 있습니다.", `<div id="scheduleList" class="toolbar-row"><div class="field"><label for="dayFilter">요일</label><select id="dayFilter"><option>전체</option>${["월","화","수","목","금","토"].map(v => `<option>${v}</option>`).join("")}</select></div><div class="field grow"><label for="scheduleSearch">프로그램 검색</label><input id="scheduleSearch" type="search" placeholder="예: 요가, 강당, 동아리"></div><button class="btn subtle" type="button" id="printSchedule">인쇄</button><strong id="resultCount" aria-live="polite"></strong></div><p class="mobile-scroll-hint" id="scheduleScrollHint">표를 좌우로 움직여 전체 내용을 확인할 수 있습니다.</p><div class="schedule-table-wrap" tabindex="0" role="region" aria-label="프로그램 시간표, 가로 스크롤 가능" aria-describedby="scheduleScrollHint"><table class="schedule-table"><caption class="sr-only">송악사회복지관 프로그램 시간표</caption><thead><tr><th>요일</th><th>프로그램</th><th>시간·장소</th><th>안내</th></tr></thead><tbody id="scheduleBody"></tbody></table></div>`) +
      section("인쇄용 시간표 원본", "참고용 게시본입니다. 기준 연도와 현재 운영 여부는 담당자에게 확인해 주세요.", `<a href="assets/official-sacwc/program-schedule-original.jpg" target="_blank" rel="noopener"><img class="original-schedule" src="assets/official-sacwc/program-schedule-original.jpg" alt="송악사회복지관 3월 프로그램 시간표 원본"></a>`, true);
    const day = document.getElementById("dayFilter");
    const search = document.getElementById("scheduleSearch");
    const refresh = () => renderScheduleRows(day.value, search.value);
    day.addEventListener("change", refresh); search.addEventListener("input", refresh);
    document.getElementById("printSchedule").addEventListener("click", () => window.print());
    refresh();
  }

  function renderCase() {
    const heroModel = getPublishedDetailModel("hero") || {};
    const stepsModel = getPublishedDetailModel("steps") || {};
    const supportModel = getPublishedDetailModel("support") || {};
    const consultModel = getPublishedDetailModel("consult") || {};
    const fallbackSteps = [
      ["접수 및 초기상담", "도움이 필요한 상황과 욕구를 함께 이야기합니다."],
      ["사례회의", "복합적인 상황을 검토하고 지원 방향을 논의합니다."],
      ["맞춤형 서비스 제공", "개별 계획에 따라 복지서비스와 지역 자원을 연결합니다."],
      ["점검 및 평가", "지원 과정과 변화를 살피고 계획을 조정합니다."],
      ["종결 및 사후관리", "지원 종료 후에도 필요한 변화와 추가 욕구를 확인합니다."]
    ];
    const steps = Array.isArray(stepsModel.items) && stepsModel.items.length ? stepsModel.items.map((item) => [item.title, item.description]) : fallbackSteps;
    const supportItems = canonicalRows("support", [["상담", "상담과 계획", "", "생활 상황과 강점을 함께 살피고 지원 계획을 세웁니다."], ["연계", "서비스 연계", "", "필요한 지역 자원을 연결합니다."], ["점검", "변화 점검", "", "지원 과정의 변화를 확인합니다."]]);
    main.innerHTML = hero(heroModel.eyebrow || "CASE MANAGEMENT", heroModel.headline || "혼자 고민하지 않도록 함께 찾겠습니다", heroModel.description || "복합적인 어려움이 있는 주민과 상담하고 필요한 복지서비스를 연결합니다.", `<a class="btn primary" href="online-application.html?type=case">${heroModel.ctaLabel || "초기상담 신청"}</a><a class="btn" href="tel:0413535077">${heroModel.detailSecondaryCta || "전화 상담"}</a>`) +
      section(stepsModel.headline || "사례관리 과정", stepsModel.description || "상담 내용과 동의 범위에 따라 단계별로 진행합니다.", `<div class="steps">${steps.map(s => `<article class="step-card"><h3>${s[0]}</h3><p>${s[1]}</p></article>`).join("")}</div>`, true) +
      section(supportModel.headline || "지원 내용", supportModel.description || "상황에 따라 내부 서비스와 공공·민간 자원을 함께 검토합니다.", `<div class="card-grid">${supportItems.map((item) => `<article class="info-card"><h3>${item[1]}</h3><p>${item[3]}</p></article>`).join("")}</div>`) +
      section(consultModel.headline || "이용 대상과 신청", consultModel.description || "송악읍 및 인근 지역 주민 중 상담과 자원 연계가 필요한 분이 이용할 수 있습니다.", `<div class="callout"><h2>${consultModel.eyebrow || "상담 내용은 동의 범위 안에서 보호됩니다"}</h2><p>${consultModel.note || "긴급한 생명·안전 문제는 112 또는 119를 먼저 이용해 주세요."}</p><div class="hero-actions"><a class="btn primary" href="online-application.html?type=case">${consultModel.ctaLabel || "온라인 초기상담"}</a><a class="btn" href="tel:0413535077">${consultModel.detailSecondaryCta || "041-353-5077"}</a></div></div>`, true);
  }

  function renderOrganizationCards(filter = "전체") {
    const grid = document.getElementById("teamGrid");
    const canonicalTeams = canonicalRows("staff", teams);
    const items = filter === "전체" ? canonicalTeams : canonicalTeams.filter(team => team[0] === filter);
    grid.innerHTML = items.map(team => `<article class="team-card"><h3>${team[1]}</h3><div class="role">${team[0]} · ${team[2]}</div><p>${team[3]}</p></article>`).join("");
  }

  function renderOrganization() {
    const filters = ["전체", "사례관리팀", "서비스제공팀", "지역조직팀", "운영지원팀"];
    main.innerHTML = hero("ORGANIZATION", "주민의 곁에서 함께하는 조직", "관장·부장과 4개 실무팀이 전문성과 협력을 바탕으로 지역주민의 일상을 지원합니다.", `<a class="btn primary" href="#staffGuide">직원 업무 찾기</a><a class="btn" href="tel:0413535077">담당자 연결</a>`) +
      section("운영 체계", "공식 조직도에 공개된 직책과 담당 업무를 기준으로 구성했습니다.", `<div class="org-root"><small>관장</small><strong>김형철 관장</strong><span>복지관 운영 총괄</span></div><div class="fact-grid"><div class="fact-card"><strong>운영지원</strong><span>부장</span></div><div class="fact-card"><strong>실무조직</strong><span>4개 팀</span></div><div class="fact-card"><strong>대표전화</strong><span>041-353-5077</span></div></div>`, true) +
      `<div class="filter-bar" id="staffGuide"><div class="filter-inner" aria-label="팀 필터">${filters.map((f,i) => `<button class="filter-btn" type="button" data-team-filter="${f}" aria-pressed="${i===0}">${f}</button>`).join("")}</div></div>` +
      section("직원·담당 업무", "개인정보 보호를 위해 공식 페이지에서 확인 가능한 실명만 표시하며, 그 외에는 직책과 업무로 안내합니다.", `<div class="team-grid" id="teamGrid"></div>`) +
      section("담당자 연결", "문의 내용을 대표전화로 알려주시면 해당 팀에 연결해 드립니다.", `<div class="callout"><h2>대표전화 041-353-5077</h2><p>프로그램, 사례관리, 후원·자원봉사, 시설 이용 등 문의 분야를 말씀해 주세요.</p><div class="hero-actions"><a class="btn primary" href="tel:0413535077">전화 연결</a><a class="btn" href="online-application.html?type=general">온라인 문의</a></div></div>`, true);
    document.querySelectorAll("[data-team-filter]").forEach(button => button.addEventListener("click", () => {
      document.querySelectorAll("[data-team-filter]").forEach(item => item.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true"); renderOrganizationCards(button.dataset.teamFilter);
    }));
    renderOrganizationCards();
  }

  function renderVideoCards(query = "") {
    const grid = document.getElementById("videoGrid");
    const normalized = query.trim().toLowerCase();
    const canonicalVideos = canonicalRows("archive", videos).map((row) => row[4]?.linkUrl
      ? [new URL(row[4].linkUrl).searchParams.get("v") || row[2], row[1], row[3]]
      : row);
    const filtered = canonicalVideos.filter(video => !normalized || video.join(" ").toLowerCase().includes(normalized));
    grid.innerHTML = filtered.length ? filtered.map(video => `<article class="video-card"><a class="video-thumb" href="https://www.youtube.com/watch?v=${video[0]}" target="_blank" rel="noopener"><img src="https://img.youtube.com/vi/${video[0]}/hqdefault.jpg" alt="${video[1]} 영상 썸네일" loading="lazy"><span class="video-play" aria-hidden="true">▶</span></a><div class="video-copy"><small>공식 영상 · YouTube</small><h3>${video[1]}</h3><p>${video[2]}</p><a class="btn subtle" href="https://www.youtube.com/watch?v=${video[0]}" target="_blank" rel="noopener">영상 보기</a></div></article>`).join("") : `<p class="empty-result">검색 결과가 없습니다.</p>`;
  }

  function renderVideo() {
    main.innerHTML = hero("SONGAK VIDEO", "영상으로 만나는 송악의 사람과 이야기", "공식 유튜브에 공개된 복지관 활동 영상을 한곳에서 확인할 수 있습니다.", `<a class="btn primary" href="#videoList">영상 둘러보기</a><a class="btn" href="https://www.youtube.com/results?search_query=송악사회복지관" target="_blank" rel="noopener">YouTube 검색</a>`) +
      section("영상 아카이브", "제목이나 활동명을 검색해 보세요.", `<div class="toolbar-row" id="videoList"><div class="field grow"><label for="videoSearch">영상 검색</label><input id="videoSearch" type="search" placeholder="예: 실버학당, 어버이날, 현장실습"></div></div><div class="video-grid" id="videoGrid"></div>`, true) +
      section("영상 이용 안내", "영상은 송악사회복지관이 공개한 YouTube 원본 링크에서 재생됩니다.", `<div class="callout"><h2>공식 채널에서 안전하게 시청하세요</h2><p>재생 기록과 저작권 보호를 위해 영상 파일을 복제하지 않고 원본 페이지로 연결합니다.</p><div class="hero-actions"><a class="btn primary" href="https://www.youtube.com/results?search_query=송악사회복지관" target="_blank" rel="noopener">공식 YouTube 보기</a><a class="btn" href="representative-greeting-editor.html?mode=view">목록으로 돌아가기</a></div></div>`);
    const input = document.getElementById("videoSearch");
    input.addEventListener("input", () => renderVideoCards(input.value)); renderVideoCards();
  }

  let applicationDraftExpiryTimer = null;

  function clearApplicationDraftExpiryTimer() {
    if (applicationDraftExpiryTimer !== null) window.clearTimeout(applicationDraftExpiryTimer);
    applicationDraftExpiryTimer = null;
  }

  function removeApplicationDraft() {
    clearApplicationDraftExpiryTimer();
    sessionStorage.removeItem("songak-application-draft");
  }

  function scheduleApplicationDraftExpiry(expiresAt) {
    clearApplicationDraftExpiryTimer();
    const remaining = Number(expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      removeApplicationDraft();
      return;
    }
    applicationDraftExpiryTimer = window.setTimeout(removeApplicationDraft, remaining);
  }

  function scheduleStoredApplicationDraftExpiry() {
    try {
      const draft = JSON.parse(sessionStorage.getItem("songak-application-draft") || "null");
      if (draft) scheduleApplicationDraftExpiry(draft.expiresAt);
    } catch {
      removeApplicationDraft();
    }
  }

  function createDraftReceipt(data) {
    const localId = `TEMP-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
    const expiresAt = Date.now() + 30 * 60 * 1000;
    sessionStorage.setItem("songak-application-draft", JSON.stringify({ ...data, receipt: localId, savedAt: new Date().toISOString(), expiresAt, status: "session-draft" }));
    scheduleApplicationDraftExpiry(expiresAt);
    return localId;
  }

  function applyApplicationModelFields(form, model) {
    const contracts = [
      { id: "applicationType", name: "type", allowed: "select" },
      { id: "applicantKind", name: "applicantKind", allowed: "select" },
      { id: "applicantName", name: "name", allowed: "text" },
      { id: "applicantPhone", name: "phone", allowed: "tel" },
      { id: "preferredContact", name: "preferredContact", allowed: "text" },
      { id: "participants", name: "participants", allowed: "number" },
      { id: "applicationMessage", name: "message", allowed: "textarea" }
    ];
    contracts.forEach((contract, index) => {
      const item = model?.items?.[index];
      const control = form.elements.namedItem(contract.name);
      if (!item || !control) return;
      const safeType = ["text", "tel", "number", "select", "textarea"].includes(item.fieldType) ? item.fieldType : contract.allowed;
      if (safeType !== contract.allowed) return;
      const label = form.querySelector(`label[for="${contract.id}"]`);
      if (label) label.textContent = `${item.title || label.textContent.replace(/\s*\*$/, "")}${item.required ? " *" : ""}`;
      control.required = Boolean(item.required);
      if ("placeholder" in control && item.meta) control.placeholder = String(item.meta).slice(0, 180);
      if (control instanceof HTMLSelectElement) {
        const labels = String(item.meta || "").split("|");
        const values = String(item.fieldOptions || "").split("|");
        if (labels.length && labels.length === values.length) control.replaceChildren(...values.map((value, optionIndex) => new Option(labels[optionIndex], value)));
      }
    });
  }

  function renderApplication() {
    const params = new URLSearchParams(location.search);
    const preferred = params.get("type") || "program";
    const heroModel = getPublishedDetailModel("hero") || {};
    const formModel = getPublishedDetailModel("form") || {};
    const applicationEndpoint = document.body.dataset.applicationEndpoint || "";
    const deliveryMode = applicationEndpoint ? "live" : "demo";
    const heroHeadline = deliveryMode === "live" ? (heroModel.headline || "상담·프로그램을 신청하세요") : "온라인 신청서 임시 작성";
    const heroDescription = deliveryMode === "live" ? (heroModel.description || "신청서를 보내면 담당자가 확인합니다.") : "운영 접수 서버 연결 전입니다. 이 탭에서 임시 작성하거나 041-353-5077로 실제 접수 여부를 확인해 주세요.";
    const heroCta = deliveryMode === "live" ? (heroModel.ctaLabel || "신청서 작성") : "임시 작성 시작";
    main.innerHTML = hero("ONLINE APPLICATION", heroHeadline, heroDescription, `<a class="btn primary" href="#applicationForm">${heroCta}</a><a class="btn" href="tel:0413535077">전화 문의</a>`) +
      section("온라인 신청", "필수 항목만 입력하며, 담당자가 확인 후 연락드립니다.", `<div class="application-layout"><form class="application-form" id="applicationForm" novalidate><div class="form-grid"><div class="field"><label for="applicationType">신청 분야 *</label><select id="applicationType" name="type" required><option value="program">프로그램 참여</option><option value="case">사례관리 초기상담</option><option value="volunteer">자원봉사</option><option value="donation">후원 문의</option><option value="facility">시설 이용·대관</option><option value="general">일반 문의</option></select></div><div class="field"><label for="applicantKind">신청자 구분 *</label><select id="applicantKind" name="applicantKind" required><option value="individual">개인</option><option value="family">가족</option><option value="group">단체·기관</option></select></div><div class="field"><label for="applicantName">이름 또는 단체명 *</label><input id="applicantName" name="name" maxlength="50" autocomplete="name" required></div><div class="field"><label for="applicantPhone">연락처 *</label><input id="applicantPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" maxlength="20" required></div><div class="field"><label for="preferredContact">연락 희망 시간</label><input id="preferredContact" name="preferredContact" maxlength="50" placeholder="예: 평일 오후 2시 이후"></div><div class="field"><label for="participants">참여 인원</label><input id="participants" name="participants" type="number" min="1" max="100" value="1"></div><div class="field wide"><label for="applicationMessage">신청·상담 내용 *</label><textarea id="applicationMessage" name="message" maxlength="1500" required placeholder="희망 프로그램, 상담이 필요한 내용, 이용 희망일 등을 입력해 주세요."></textarea></div><div class="field wide sr-only" aria-hidden="true"><label for="applicationWebsite">웹사이트</label><input id="applicationWebsite" name="website" tabindex="-1" autocomplete="off"></div></div><div class="consent-box"><label><input type="checkbox" name="consent" required><span>접수와 상담을 위해 이름·연락처·신청 내용을 수집하고 처리하는 것에 동의합니다. 접수 목적 달성 후 기관 보유기간 기준에 따라 파기됩니다. *</span></label></div><div class="form-actions"><button class="btn subtle" type="button" id="saveDraft">임시저장</button><button class="btn primary" type="submit">신청 접수</button></div><p class="status-message" id="applicationStatus" role="status" aria-live="polite"></p><div id="applicationReceipt"></div></form><aside class="application-aside"><h2>접수 절차</h2><ol><li>신청서 작성</li><li>담당자 확인</li><li>전화 또는 문자 안내</li><li>일정·참여 확정</li></ol><p>긴급한 도움이 필요한 경우 112·119 또는 지역 긴급복지 창구를 먼저 이용해 주세요.</p></aside></div>`, true);
    const form = document.getElementById("applicationForm");
    const heroSection = main.querySelector(".detail-hero");
    const formSection = form.closest(".section");
    if (formModel.headline) formSection?.querySelector("h2")?.replaceChildren(formModel.headline);
    if (formModel.description) formSection?.querySelector(".section-heading p")?.replaceChildren(formModel.description);
    applyApplicationModelFields(form, formModel);
    form.dataset.deliveryMode = deliveryMode;
    const submitButton = form.querySelector('button[type="submit"]');
    if (deliveryMode === "demo") {
      submitButton.textContent = "임시 저장";
      form.insertAdjacentHTML("afterbegin", '<p class="delivery-gate" role="note"><strong>데모·임시저장 모드</strong> 운영 서버가 연결되지 않아 신청이 접수되지 않습니다. 동의 후 명시적으로 저장하면 이 브라우저 탭에만 30분간 보관되며 서버로 전송되지 않습니다. 실제 신청은 041-353-5077로 문의해 주세요. <button type="button" id="clearDraft">임시정보 지금 삭제</button></p>');
    }
    const type = document.getElementById("applicationType");
    if ([...type.options].some(option => option.value === preferred)) type.value = preferred;
    const status = document.getElementById("applicationStatus");
    const receipt = document.getElementById("applicationReceipt");
    scheduleStoredApplicationDraftExpiry();
    window.addEventListener("pagehide", clearApplicationDraftExpiryTimer);
    window.addEventListener("pageshow", scheduleStoredApplicationDraftExpiry);
    const collect = () => Object.fromEntries(new FormData(form).entries());
    document.getElementById("saveDraft").addEventListener("click", () => {
      if (!form.reportValidity()) { status.textContent = "필수 항목과 개인정보 처리 동의를 확인해 주세요."; return; }
      const id = createDraftReceipt(collect()); status.textContent = `임시저장 완료: ${id}`;
    });
    document.getElementById("clearDraft")?.addEventListener("click", () => {
      removeApplicationDraft();
      status.textContent = "이 탭에 임시 저장된 신청 정보를 삭제했습니다.";
    });
    form.elements.namedItem("consent")?.addEventListener("change", (event) => {
      if (!event.currentTarget.checked) removeApplicationDraft();
    });
    form.addEventListener("submit", async event => {
      event.preventDefault(); receipt.innerHTML = "";
      if (!form.reportValidity()) return;
      const payload = collect();
      if (payload.website) return;
      if (deliveryMode === "demo") {
        const id = createDraftReceipt(payload);
        status.textContent = `임시 저장되었습니다. 신청 접수 완료가 아니며 운영 서버 연결 후 다시 제출해야 합니다. (${id})`;
        return;
      }
      status.textContent = "신청서를 접수하고 있습니다…";
      try {
        const response = await fetch(applicationEndpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "접수하지 못했습니다.");
        status.textContent = "신청이 정상적으로 접수되었습니다.";
        receipt.innerHTML = `<div class="receipt"><span>접수번호</span><strong>${result.receipt}</strong><p>담당자가 확인 후 입력한 연락처로 안내합니다.</p></div>`;
        removeApplicationDraft();
        form.reset(); type.value = preferred;
      } catch (error) {
        status.textContent = "서버 연결에 실패해 접수되지 않았습니다. 개인정보는 자동 저장하지 않았습니다. 다시 시도하거나 041-353-5077로 문의해 주세요.";
      }
    });
  }

  function renderFooter() {
    const footer = document.getElementById("detailFooter");
    footer.innerHTML = `<div class="detail-footer-inner"><div><strong>송악사회복지관</strong><p>(31728) 충남 당진시 송악읍 송악로 656</p></div><div><a href="tel:0413535077">041-353-5077</a><p>팩스 041-353-6077 · sacwc2021@hanmail.net</p></div></div>`;
  }

  renderHeader();
  if (pageId === "facility") renderFacility();
  else if (pageId === "schedule") renderSchedule();
  else if (pageId === "case") renderCase();
  else if (pageId === "organization") renderOrganization();
  else if (pageId === "video") renderVideo();
  else renderApplication();
  renderFooter();
})();
