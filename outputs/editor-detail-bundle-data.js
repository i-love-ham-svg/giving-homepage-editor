(function () {
  "use strict";

  const list = (prefix, rows) => rows.map((row, index) => ({
    id: `${prefix}-${index + 1}`,
    badge: row[0], title: row[1], meta: row[2], description: row[3],
    ...(row[4] || {})
  }));

  const BUNDLES = {
    facility: {
      label: "시설현황", originalIds: ["facility", "essential5"], kinds: ["hero", "facts", "selector", "callout"],
      models: {
        hero: { template: "facility", label: "시설현황 · 메인 소개", eyebrow: "FACILITIES", headline: "시설을 한눈에 확인하세요", description: "층별 공간과 주요 편의시설, 이용 문의 정보를 실제 방문 전에 확인할 수 있습니다.", ctaLabel: "층별 안내 보기", detailSecondaryCta: "시설 이용 문의" },
        facts: { template: "facility", label: "시설현황 · 기본 안내", headline: "기본 이용 안내", description: "시설별 운영시간은 프로그램과 대관 일정에 따라 달라질 수 있습니다.", details: [
          { id: "facility-address", label: "주소", value: "충남 당진시 송악읍 송악로 656" }, { id: "facility-phone", label: "대표전화", value: "041-353-5077" }, { id: "facility-hours", label: "운영", value: "평일 중심 · 프로그램별 상이" }
        ] },
        selector: { template: "facility", label: "시설현황 · 층별 배치", headline: "층별 배치", description: "층 버튼을 선택하면 해당 층의 주요 공간을 확인할 수 있습니다.", items: list("facility-floor", [
          ["외부", "야외 시설", "주차장(장애인 주차 포함) | 농구장", "주민 방문과 야외 활동을 지원하는 공간입니다.", { floorId: "outside" }],
          ["3F", "옥상", "게이트볼장 | 야외 테라스", "체육과 휴식을 함께 즐길 수 있는 옥상 공간입니다.", { floorId: "3f" }],
          ["2F", "문화·교육 공간", "프로그램실 4·5·6 | 강당 | 청소년문화공간 | 심리치료실 | 노인회 사무실 | 부모상담실 | 노래방 1·2·3", "교육, 문화, 상담 프로그램이 운영되는 주요 활동 공간입니다.", { floorId: "2f" }],
          ["1F", "상담·생활 공간", "프로그램실 1·3 | 사무실·관장실 | 식당 | 당구장 | 체력단련실 | 탁구장 | 통신실 | 육아나눔터", "방문 상담부터 식사, 운동, 가족 이용까지 이어지는 생활 밀착 공간입니다.", { floorId: "1f" }],
          ["B1", "시설 관리 공간", "보일러실 | 전기실 | 창고 1·2 | 비상발전기실", "복지관의 안전하고 안정적인 운영을 위한 관리 공간입니다.", { floorId: "b1" }]
        ]) },
        callout: { template: "facility", label: "시설현황 · 방문 전 확인", headline: "방문 전 확인", description: "엘리베이터, 장애인 편의시설 또는 특정 공간 이용 가능 여부는 방문 전에 확인해 주세요.", note: "대표전화 041-353-5077로 방문 목적과 이용 공간을 알려주시면 담당자가 안내합니다.", ctaLabel: "전화 연결", detailSecondaryCta: "온라인 문의" }
      }
    },
    schedule: {
      label: "프로그램 시간표", originalIds: ["schedule", "essential6"], kinds: ["hero", "facts", "table", "source"],
      models: {
        hero: { template: "schedule", label: "프로그램 시간표 · 메인 소개", eyebrow: "PROGRAM SCHEDULE", headline: "3월 게시 시간표 참고자료", description: "기준 연도와 현재 모집·운영 여부는 공지사항 또는 대표전화로 확인해 주세요.", ctaLabel: "시간표 확인", detailSecondaryCta: "프로그램 신청" },
        facts: { template: "schedule", label: "프로그램 시간표 · 운영 기준", headline: "운영 기준", description: "모집 상황과 휴강 일정은 공지사항을 우선 확인해 주세요.", details: [
          { id: "schedule-fact-period", label: "기준", value: "3월 게시본 · 현재 운영 여부 확인 필요" }, { id: "schedule-fact-open", label: "자율이용", value: "월·목 오전 / 시설 정비 별도" }, { id: "schedule-fact-contact", label: "문의", value: "041-353-5077" }
        ] },
        table: { template: "schedule", label: "프로그램 시간표 · 요일별 일정", headline: "요일·시간별 프로그램", description: "요일을 선택하거나 프로그램명을 검색할 수 있습니다.", items: list("schedule-item", [
          ["월","요가","09:00~10:00 · 청소년문화공간","월요일 오전 정기 프로그램"], ["월","장구난타","10:00~12:00 · 강당","월요일 오전 정기 프로그램"], ["월","탁구 동아리","13:00~16:00 · 강당","월요일 오후 동아리 활동"],
          ["화","통기타","10:00~12:00 · 3실","화요일 오전 정기 프로그램"], ["화","문인화","10:00~12:00 · 5실","화요일 오전 정기 프로그램"], ["화","노래교실","13:00~15:00 · 강당","화요일 오후 정기 프로그램"],
          ["수","라인댄스","13:00~15:00 · 강당","수요일 오후 정기 프로그램"], ["목","한글","13:00~15:00 · 3실","목요일 오후 정기 프로그램"], ["목","봉사 동아리","13:00~15:00 · 5실/강당","목요일 오후 동아리 활동"], ["목","장기 동아리","13:00~16:00 · 1실","목요일 오후 동아리 활동"],
          ["금","기체조","13:00~14:00 · 강당","금요일 오후 정기 프로그램"], ["금","송악상영관","14:00~16:00 · 강당 · 둘째·넷째 주","금요일 무료 영화 상영"], ["토","원데이클래스","13:00~15:00 · 실시간 · 매월 셋째 주","토요일 월별 체험 프로그램"]
        ]), ctaLabel: "인쇄" },
        source: { template: "schedule", label: "프로그램 시간표 · 공식 원본", headline: "인쇄용 시간표 원본", description: "참고용 게시본입니다. 기준 연도와 현재 운영 여부는 담당자에게 확인해 주세요.", detailAssetUrl: "assets/official-sacwc/program-schedule-original.jpg", detailAssetAlt: "송악사회복지관 공식 프로그램 시간표", ctaLabel: "원본 이미지 열기" }
      }
    },
    case: {
      label: "사례관리", originalIds: ["process"], kinds: ["hero", "steps", "support", "consult"],
      models: {
        hero: { template: "volunteer", label: "사례관리 · 메인 소개", eyebrow: "CASE MANAGEMENT", headline: "혼자 고민하지 않도록 함께 찾겠습니다", description: "복합적인 어려움을 겪는 지역주민과 상담하고, 필요한 복지서비스와 지역 자원을 연결합니다.", ctaLabel: "초기상담 신청", detailSecondaryCta: "전화 상담" },
        steps: { template: "volunteer", label: "사례관리 · 5단계 절차", headline: "사례관리 과정", description: "상담 내용과 동의 범위에 따라 단계별로 진행합니다.", items: list("case-step", [
          ["01","접수 및 초기상담","상황·욕구 확인","도움이 필요한 상황과 욕구를 함께 이야기합니다."], ["02","사례회의","지원 방향 논의","복합적인 상황을 검토하고 지원 방향을 논의합니다."], ["03","맞춤형 서비스 제공","서비스·자원 연결","개별 계획에 따라 복지서비스와 지역 자원을 연결합니다."], ["04","점검 및 평가","계획 조정","지원 과정과 변화를 살피고 계획을 조정합니다."], ["05","종결 및 사후관리","변화·추가 욕구 확인","지원 종료 후에도 필요한 변화와 추가 욕구를 확인합니다."]
        ]) },
        support: { template: "volunteer", label: "사례관리 · 지원 내용", headline: "지원 내용", description: "상황에 따라 내부 서비스와 공공·민간 자원을 함께 검토합니다.", items: list("case-support", [
          ["상담","상담과 계획","초기상담 · 욕구 파악","현재 어려움과 강점을 함께 확인하고 개별 지원계획을 세웁니다."], ["연계","서비스 연계","복지서비스 · 지역 자원","필요한 복지서비스와 공공·민간 자원을 연결합니다."], ["점검","변화 점검","진행 확인 · 계획 조정","지원 과정과 변화를 살피며 계획을 함께 조정합니다."]
        ]) },
        consult: { template: "volunteer", label: "사례관리 · 이용 신청", eyebrow: "상담 내용은 동의 범위 안에서 보호됩니다", headline: "이용 대상과 신청", description: "송악읍 및 인근 지역 주민 중 복합적인 어려움으로 상담과 자원 연계가 필요한 분이 이용할 수 있습니다.", note: "긴급한 생명·안전 문제가 있는 경우에는 112 또는 119 등 긴급기관을 먼저 이용해 주세요.", ctaLabel: "온라인 초기상담", detailSecondaryCta: "041-353-5077" }
      }
    },
    organization: {
      label: "조직도·직원", originalIds: ["organization"], kinds: ["hero", "structure", "staff", "contact"],
      models: {
        hero: { template: "organization", label: "조직도·직원 · 메인 소개", eyebrow: "ORGANIZATION", headline: "주민의 곁에서 함께하는 조직", description: "관장·부장과 4개 실무팀이 전문성과 협력을 바탕으로 지역주민의 일상을 지원합니다.", ctaLabel: "직원 업무 찾기", detailSecondaryCta: "담당자 연결" },
        structure: { template: "organization", label: "조직도·직원 · 운영 체계", eyebrow: "관장", headline: "운영 체계", description: "공식 조직도에 공개된 직책과 담당 업무를 기준으로 구성했습니다.", ctaLabel: "김형철 관장", note: "복지관 운영 총괄", details: [
          { id: "org-fact-support", label: "운영지원", value: "부장" }, { id: "org-fact-teams", label: "실무조직", value: "4개 팀" }, { id: "org-fact-phone", label: "대표전화", value: "041-353-5077" }
        ] },
        staff: { template: "organization", label: "조직도·직원 · 부서별 안내", headline: "직원·담당 업무", description: "개인정보 보호를 위해 공식 페이지에서 확인 가능한 실명만 표시하며, 그 외에는 직책과 업무로 안내합니다.", items: list("org-staff", [
          ["관장","김형철 관장","복지관 운영 총괄","복지관 운영 전반을 총괄합니다."], ["운영지원","부장","사업·조직 운영","부서 간 협업과 안정적인 사업 수행을 지원합니다."],
          ["사례관리팀","팀장","팀 총괄","현재 공식 조직도에는 육아휴직 상태로 안내되어 있습니다."], ["사례관리팀","사회복지사","사례관리·지역사회보호","복합적인 어려움이 있는 주민의 상담과 자원 연계를 담당합니다."], ["사례관리팀","사회복지사","사례관리사업","지역주민 사례관리 업무를 담당합니다."],
          ["서비스제공팀","팀장","생활도움서비스 애니맘","서비스제공팀과 생활도움서비스를 총괄합니다."], ["서비스제공팀","사회복지사","실버학당·부모자녀·자율이용","송악실버학당, 송악상영관, 원데이클래스를 담당합니다."], ["서비스제공팀","사회복지사","취미·여가·건강증진","취미·여가 및 어르신 건강증진 사업을 담당합니다."], ["서비스제공팀","사회복지사","지역사회보호","지역사회보호사업을 담당합니다."], ["서비스제공팀","조리원","복지관 식당","복지관 식당 조리 업무를 담당합니다."],
          ["지역조직팀","팀장","주민조직화·복지네트워크","직원교육과 사회복지현장실습을 포함한 팀 업무를 총괄합니다."], ["지역조직팀","사회복지사","홍보·후원·자원봉사·대관","주민조직화와 지역 자원 연계를 담당합니다."], ["지역조직팀","노인일자리 전담인력","노인일자리지원사업","노인일자리지원사업을 전담합니다."], ["운영지원팀","사무원","회계·공문서·서무","회계와 공문서 및 서무 업무를 담당합니다."]
        ]) },
        contact: { template: "organization", label: "조직도·직원 · 담당자 연결", eyebrow: "대표전화 041-353-5077", headline: "담당자 연결", description: "문의 내용을 대표전화로 알려주시면 해당 팀에 연결해 드립니다.", note: "프로그램, 사례관리, 후원·자원봉사, 시설 이용 등 문의 분야를 말씀해 주세요.", ctaLabel: "전화 연결", detailSecondaryCta: "온라인 문의" }
      }
    },
    video: {
      label: "영상 아카이브", originalIds: [], kinds: ["hero", "archive", "guide"],
      models: {
        hero: { template: "facility", label: "영상 아카이브 · 메인 소개", eyebrow: "SONGAK VIDEO", headline: "영상으로 만나는 송악의 사람과 이야기", description: "공식 유튜브에 공개된 복지관 활동 영상을 한곳에서 확인할 수 있습니다.", ctaLabel: "영상 둘러보기", detailSecondaryCta: "YouTube 검색" },
        archive: { template: "facility", label: "영상 아카이브 · 공식 영상", headline: "영상 아카이브", description: "제목이나 활동명을 검색해 보세요.", items: list("video", [
          ["공식 영상 · YouTube","25년 송악실버학당 4기 활동영상","nUWMRojXmVI","송악실버학당 4기의 활동 기록입니다."], ["공식 영상 · YouTube","[2025년] 함께 만든 변화, 함께 나눈 하루들의 기록","kyQhkc6hG9M","2025년 주민과 함께 만든 복지관 활동을 영상으로 소개합니다."], ["공식 영상 · YouTube","2025년 송악사회복지관 사회복지현장실습 이야기","1vok5vBLvEE","사회복지현장실습 과정과 참여 이야기를 담았습니다."], ["공식 영상 · YouTube","[2025년 상반기] 함께여서 더 빛났던, 송악사회복지관 이야기","xS3G8glmf5U","2025년 상반기 복지관 활동을 돌아보는 영상입니다."], ["공식 영상 · YouTube","25년 송악사회복지관의 어버이날 이야기","beD90-10L80","지역 어르신과 함께한 어버이날 활동 기록입니다."], ["공식 영상 · YouTube","송악사회복지관 프로그램 소개","_dyB7jHw7XU","복지관에서 운영하는 주요 프로그램을 영상으로 안내합니다."]
        ].map(row => [row[0], row[1], row[2], row[3], { imageUrl: `https://img.youtube.com/vi/${row[2]}/hqdefault.jpg`, linkUrl: `https://www.youtube.com/watch?v=${row[2]}` }])) },
        guide: { template: "facility", label: "영상 아카이브 · 이용 안내", eyebrow: "공식 채널에서 안전하게 시청하세요", headline: "영상 이용 안내", description: "영상은 송악사회복지관이 공개한 YouTube 원본 링크에서 재생됩니다.", note: "재생 기록과 저작권 보호를 위해 영상 파일을 복제하지 않고 원본 페이지로 연결합니다.", ctaLabel: "" }
      }
    },
    application: {
      label: "온라인 신청", originalIds: [], kinds: ["hero", "form"],
      models: {
        hero: { template: "volunteer", label: "온라인 신청 · 메인 소개", eyebrow: "ONLINE APPLICATION", headline: "온라인 신청서 작성 안내", description: "운영 접수 서버 연결 여부를 확인한 뒤 신청서를 전송합니다. 서버 미연결 시 임시 작성만 가능하며 실제 접수는 전화로 확인해 주세요.", ctaLabel: "신청서 작성", detailSecondaryCta: "전화 문의" },
        form: { template: "volunteer", label: "온라인 신청 · 신청서", headline: "온라인 신청", description: "필수 항목만 입력하며, 담당자가 확인 후 연락드립니다.", items: list("application-field", [
          ["필수","신청 분야","프로그램 참여|사례관리 초기상담|자원봉사|후원 문의|시설 이용·대관|일반 문의","원하는 신청 분야를 선택하세요.",{ fieldType: "select", fieldOptions: "program|case|volunteer|donation|facility|general", required: true }],
          ["필수","신청자 구분","개인|가족|단체·기관","신청자 구분을 선택하세요.",{ fieldType: "select", fieldOptions: "individual|family|group", required: true }],
          ["필수","이름 또는 단체명","신청자 이름을 입력하세요.","접수 확인에 사용됩니다.",{ fieldType: "text", required: true }], ["필수","연락처","010-0000-0000","담당자가 연락드릴 번호입니다.",{ fieldType: "tel", required: true }],
          ["선택","연락 희망 시간","예: 평일 오후 2시 이후","가능한 연락 시간을 입력하세요.",{ fieldType: "text" }], ["선택","참여 인원","1","예상 참여 인원을 입력하세요.",{ fieldType: "number" }], ["필수","신청·상담 내용","희망 프로그램, 상담이 필요한 내용, 이용 희망일 등을 입력해 주세요.","구체적으로 작성하면 빠른 안내에 도움이 됩니다.",{ fieldType: "textarea", required: true }]
        ]), ctaLabel: "신청 접수", note: "긴급한 도움이 필요한 경우 112·119 또는 지역 긴급복지 창구를 먼저 이용해 주세요." }
      }
    },
    account: {
      label: "로그인·회원가입", originalIds: [], kinds: ["social", "guide"],
      models: {
        hero: { template: "volunteer", label: "SNS 회원 · 메인 소개", eyebrow: "SOCIAL ACCOUNT", headline: "한 번의 인증으로 송악과 연결", description: "별도의 아이디와 비밀번호 없이 사용 중인 SNS 계정으로 안전하게 시작합니다.", ctaLabel: "SNS로 시작하기", detailSecondaryCta: "이용 안내" },
        social: { template: "volunteer", label: "SNS 회원 · 인증 선택", headline: "로그인·회원가입", description: "", note: "", socialLayout: "drive-split", detailAssetUrl: "./assets/generated/account-sns-photoreal-v1.webp", detailAssetAlt: "송악사회복지관 앞에서 함께 웃는 어르신과 복지관 직원의 실사 이미지", detailMobileAssetUrl: "./assets/generated/account-sns-photoreal-mobile-v2.webp", detailMobileAssetAlt: "모바일 화면용 송악사회복지관 어르신과 복지관 직원의 실사 이미지", detailAssetFit: "cover", details: [
          { id: "account-kakao-client", label: "카카오 REST API 키", value: "" },
          { id: "account-naver-client", label: "네이버 Client ID", value: "" },
          { id: "account-google-client", label: "Google Client ID", value: "" },
          { id: "account-redirect-uri", label: "공통 Redirect URI", value: "" }
        ] },
        guide: { template: "volunteer", label: "SNS 회원 · 이용 안내", eyebrow: "최소 정보만 확인합니다", headline: "가입 전 확인", description: "최초 인증 뒤 이용약관과 개인정보 처리 동의, 이름·연락처 등 서비스에 필요한 최소 정보만 확인합니다.", note: "SNS 제공자의 비밀번호는 송악사회복지관에 저장되지 않습니다. 연동 해제와 회원 탈퇴 경로를 함께 제공합니다.", ctaLabel: "개인정보처리방침", detailSecondaryCta: "대표전화 041-353-5077" }
      }
    }
  };

  function createModel(pageKind, sectionKind) {
    const source = BUNDLES[pageKind]?.models?.[sectionKind];
    if (!source) return null;
    return { ...structuredClone(source), detailPageKind: pageKind, detailSectionKind: sectionKind, detailDesignVersion: 5, detailSelectedFilter: "all", items: structuredClone(source.items || []), details: structuredClone(source.details || []), note: source.note || "", ctaLabel: source.ctaLabel || "" };
  }

  window.SongakDetailBundles = Object.freeze({ BUNDLES, PAGE_ORDER: Object.keys(BUNDLES), createModel });
}());
