import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "outputs");
const baseUrl = "https://songak-welfare-editor.hamsungryong.chatgpt.site";

const navGroups = [
  { label: "복지관 소개", href: "/about", items: [
    ["복지관 소개 전체", "/about"], ["대표자 인사말", "/about/greeting"], ["미션·비전·슬로건", "/about/mission"], ["운영법인 소개", "/about/corporate"], ["연혁", "/about/history"], ["시설현황", "/about/facility"], ["조직도·직원 안내", "/about/organization"], ["찾아오시는 길", "/directions"]
  ]},
  { label: "사업 안내", href: "/programs", items: [
    ["사업 안내 전체", "/programs"], ["프로그램 안내", "/programs/list"], ["프로그램 일정표", "/programs/schedule"], ["인쇄용 시간표 원본", "/programs/schedule-original"], ["사례관리 이용 절차", "/programs/case-management"], ["온라인 신청·문의", "/programs/application"]
  ]},
  { label: "참여마당", href: "/participation", items: [
    ["참여마당 전체", "/participation"], ["자원봉사 안내", "/participation/volunteer"], ["후원 안내", "/participation/donation"]
  ]},
  { label: "알림마당", href: "/news", items: [
    ["알림마당 전체", "/news"], ["공지·소식", "/news/notices"], ["언론보도", "/news/press"], ["영상 아카이브", "/news/videos"], ["갤러리", "/news/gallery"], ["방문자 자유게시판", "/news/visitor-board"], ["소통게시판", "/community"]
  ]}
];

const PAGES = [
  page("/about", "public-about.html", "복지관 소개", "ABOUT SONGAK", "주민과 함께 만드는 복지공동체", "송악사회복지관의 역할과 가치, 시설과 조직을 한곳에서 확인하세요.", [
    linkCard("소개", "대표자 인사말", "지역주민과 함께 성장하는 복지관의 약속을 전합니다.", "/about/greeting"), linkCard("가치", "미션·비전·슬로건", "실천·공존·공감의 운영 가치를 소개합니다.", "/about/mission"), linkCard("법인", "운영법인 소개", "복지관 운영법인과 역할을 안내합니다.", "/about/corporate"), linkCard("기록", "연혁", "복지관이 지역과 함께 걸어온 흐름을 확인하세요.", "/about/history"), linkCard("공간", "시설현황", "층별 주요 공간과 이용 정보를 확인하세요.", "/about/facility"), linkCard("사람", "조직도·직원 안내", "담당 조직과 업무를 확인하세요.", "/about/organization")
  ]),
  page("/about/greeting", "public-about-greeting.html", "복지관 소개", "GREETING", "지역주민과 함께 성장하겠습니다", "송악사회복지관은 주민의 목소리에 귀 기울이고 필요한 복지서비스를 함께 만들어가겠습니다.", [
    card("관장", "김형철", "복지관 운영 전반을 총괄하며 지역주민과 함께하는 복지공동체를 만들어갑니다."), card("주민 중심", "이용자 중심의 복지서비스", "주민의 삶과 필요를 중심으로 프로그램과 서비스를 연결합니다."), card("소통과 협력", "지역과 함께 만드는 변화", "주민과 지역기관의 참여와 협력으로 함께 성장하는 복지관을 지향합니다.")
  ]),
  page("/about/mission", "public-about-mission.html", "복지관 소개", "MISSION · VISION", "지역주민과 함께하는 행복나눔터", "지역주민과 함께 소통하고 실천하여 동반 성장하는 송악사회복지관입니다.", [
    card("실천", "실천이 기본이 되는 공동체", "지역사회 참여를 통해 전문사회복지를 실천합니다."), card("공존", "함께 만드는 공존 공동체", "주민의 참여와 협력으로 모두가 함께 성장하는 지역공동체를 지향합니다."), card("공감", "소통으로 이루어지는 공감", "지역사회 문제 변화에 소통으로 공감합니다."), card("성장", "지역주민과 함께 성장", "주민 중심의 지역공동체를 함께 실현합니다.")
  ]),
  page("/about/corporate", "public-about-corporate.html", "복지관 소개", "OPERATING FOUNDATION", "재단법인 송악읍개발위원회", "당진시로부터 송악사회복지관을 수탁 운영하며 지역 기반 복지와 공익 활동을 지원합니다.", [
    card("수탁운영", "지역 밀착형 복지관 운영", "지역주민의 생활과 가까운 복지서비스가 안정적으로 이어지도록 지원합니다."), card("지역공동체", "주민 참여와 문화복지", "주민이 직접 참여하고 연결되는 문화·복지 활동을 뒷받침합니다."), card("공익지원", "지역 비영리 활동 지원", "지역의 지속가능한 공익·환경·복지 활동을 지원합니다."), card("복지연결", "복지사각지대 지원", "지역기관과 협력해 복지 공백을 살피고 필요한 자원을 연결합니다.")
  ]),
  page("/about/history", "public-about-history.html", "복지관 소개", "HISTORY", "지역과 함께 걸어온 송악의 기록", "복지관의 주요 사업과 지역사회 활동의 흐름을 확인할 수 있습니다.", [
    externalCard("공식 기록", "연혁 전체보기", "공식 홈페이지에 공개된 연혁과 주요 활동을 확인하세요.", "https://www.sacwc.kr/"), card("지역 연결", "주민과 함께한 성장", "복지서비스와 주민 참여 사업을 통해 지역사회와 함께 성장해 왔습니다."), card("현재", "행복나눔터를 향한 실천", "지역주민의 삶의 질 향상과 복지공동체 형성을 위해 노력하고 있습니다.")
  ]),
  page("/about/facility", "public-about-facility.html", "복지관 소개", "FACILITIES", "시설을 한눈에 확인하세요", "층별 공간과 주요 편의시설, 이용 문의 정보를 방문 전에 확인할 수 있습니다.", [
    card("외부", "야외 시설", "주차장(장애인 주차 포함) · 농구장"), card("3층", "옥상", "게이트볼장 · 야외 테라스"), card("2층", "문화·교육 공간", "프로그램실 4·5·6 · 강당 · 청소년문화공간 · 심리치료실 · 부모상담실 · 노래방"), card("1층", "상담·생활 공간", "프로그램실 · 사무실 · 관장실 · 식당 · 체력단련실 · 탁구장 · 육아나눔터"), card("지하", "시설 관리 공간", "보일러실 · 전기실 · 창고 · 비상발전기실"), externalCard("공식 자료", "시설현황 원문", "공개된 시설 수와 면적을 공식 페이지에서 확인하세요.", "https://www.sacwc.kr/main/sub.html?pageCode=6")
  ]),
  page("/about/organization", "public-about-organization.html", "복지관 소개", "ORGANIZATION", "주민의 곁에서 함께하는 조직", "관장·부장과 실무팀이 전문성과 협력을 바탕으로 지역주민의 일상을 지원합니다.", [
    card("관장", "김형철 관장", "복지관 운영 총괄"), card("사례관리팀", "상담과 자원 연계", "사례관리와 지역사회보호 업무를 담당합니다."), card("서비스제공팀", "생활·여가·건강 지원", "실버학당, 취미·여가, 건강증진과 지역사회보호 사업을 담당합니다."), card("지역조직팀", "주민과 지역을 연결", "홍보·후원·자원봉사·대관과 주민조직화 업무를 담당합니다."), card("운영지원팀", "안정적인 운영 지원", "회계·공문서·서무와 복지관 운영을 지원합니다."), phoneCard("연결", "담당자 문의", "문의 분야를 알려주시면 해당 팀에 연결해 드립니다.")
  ]),
  page("/programs", "public-programs.html", "사업 안내", "WELFARE PROGRAMS", "필요한 복지서비스를 안내합니다", "프로그램, 일정표, 사례관리와 온라인 문의를 메뉴별로 확인하세요.", [
    linkCard("프로그램", "프로그램 안내", "지역주민을 위한 주요 프로그램을 안내합니다.", "/programs/list"), linkCard("일정", "프로그램 일정표", "요일과 시간대별 참고 일정을 확인하세요.", "/programs/schedule"), linkCard("원본", "인쇄용 시간표", "게시된 시간표 원본을 필요할 때만 불러옵니다.", "/programs/schedule-original"), linkCard("사례관리", "사례관리 이용 절차", "상담부터 사후관리까지의 과정을 안내합니다.", "/programs/case-management"), linkCard("신청", "온라인 신청·문의", "프로그램과 상담 문의 방법을 확인하세요.", "/programs/application")
  ]),
  page("/programs/list", "public-programs-list.html", "사업 안내", "PROGRAM GUIDE", "프로그램 안내", "프로그램 운영일과 모집 여부는 최신 공지 또는 대표전화로 확인해 주세요.", [
    card("교육", "배움 프로그램", "한글·문인화·통기타 등 주민의 배움과 여가를 지원합니다."), card("건강", "건강증진 프로그램", "요가·기체조·라인댄스 등 건강한 일상을 돕습니다."), card("문화", "문화·여가 프로그램", "노래교실·송악상영관·원데이클래스 등 다양한 활동을 운영합니다."), card("동아리", "주민 동아리", "탁구·장기·봉사 등 주민 주도의 활동을 지원합니다."), externalCard("최신 정보", "공식 프로그램 확인", "모집 여부와 상세 일정은 공식 홈페이지에서 확인하세요.", "https://www.sacwc.kr/")
  ]),
  page("/programs/schedule", "public-programs-schedule.html", "사업 안내", "PROGRAM SCHEDULE", "요일·시간별 프로그램", "3월 게시 시간표 참고자료이며 현재 운영 여부는 공지 또는 대표전화로 확인해 주세요.", [
    card("월", "요가 · 장구난타 · 탁구 동아리", "오전과 오후 프로그램"), card("화", "통기타 · 문인화 · 노래교실", "오전과 오후 프로그램"), card("수", "라인댄스", "13:00~15:00 · 강당"), card("목", "한글 · 봉사 동아리 · 장기 동아리", "오후 프로그램"), card("금", "기체조 · 송악상영관", "둘째·넷째 주 영화 상영 포함"), card("토", "원데이클래스", "매월 셋째 주 참고")
  ]),
  page("/programs/schedule-original", "public-programs-schedule-original.html", "사업 안내", "ORIGINAL SCHEDULE", "인쇄용 프로그램 시간표", "원본 이미지는 선택할 때만 열리므로 다른 페이지의 로딩 속도에 영향을 주지 않습니다.", [
    assetCard("공식 원본", "프로그램 시간표 이미지 열기", "3월 기준 게시 시간표입니다. 최신 운영 여부는 대표전화로 확인해 주세요.", "/songak/assets/official-sacwc/program-schedule-original.jpg"), phoneCard("확인", "현재 일정 문의", "모집과 휴강 일정은 담당자에게 확인해 주세요.")
  ]),
  page("/programs/case-management", "public-programs-case-management.html", "사업 안내", "CASE MANAGEMENT", "혼자 고민하지 않도록 함께 찾겠습니다", "복합적인 어려움을 겪는 지역주민과 상담하고 필요한 서비스와 지역 자원을 연결합니다.", [
    card("01", "접수 및 초기상담", "도움이 필요한 상황과 욕구를 함께 이야기합니다."), card("02", "사례회의", "복합적인 상황을 검토하고 지원 방향을 논의합니다."), card("03", "맞춤형 서비스 제공", "복지서비스와 지역 자원을 연결합니다."), card("04", "점검 및 평가", "지원 과정과 변화를 살피고 계획을 조정합니다."), card("05", "종결 및 사후관리", "지원 종료 후에도 필요한 변화와 추가 욕구를 확인합니다."), phoneCard("상담", "초기상담 문의", "상담 내용은 동의 범위 안에서 보호됩니다.")
  ]),
  page("/programs/application", "public-programs-application.html", "사업 안내", "APPLICATION", "온라인 신청·문의 안내", "프로그램 참여, 사례관리, 자원봉사, 후원, 시설 이용과 일반 문의 방법을 안내합니다.", [
    phoneCard("전화", "대표전화로 문의", "운영시간과 담당자를 빠르게 확인할 수 있습니다."), mailCard("이메일", "이메일로 문의", "신청 분야와 연락 가능한 정보를 남겨주세요."), linkCard("자원봉사", "자원봉사 안내 먼저 보기", "참여 방법과 문의처를 확인하세요.", "/participation/volunteer"), linkCard("후원", "후원 안내 먼저 보기", "후원 문의 방법을 확인하세요.", "/participation/donation")
  ]),
  page("/participation", "public-participation.html", "참여마당", "PARTICIPATION", "함께할수록 더 따뜻해집니다", "자원봉사와 후원 참여 방법을 선택해 확인하세요.", [
    linkCard("자원봉사", "시간과 재능을 나눠주세요", "참여 분야와 문의 방법을 확인하세요.", "/participation/volunteer"), linkCard("후원", "따뜻한 마음을 전해주세요", "후원 상담과 문의 방법을 확인하세요.", "/participation/donation")
  ]),
  page("/participation/volunteer", "public-participation-volunteer.html", "참여마당", "VOLUNTEER", "자원봉사 안내", "시간과 재능을 나누며 지역주민의 일상에 힘을 보탤 수 있습니다.", [
    card("상담", "참여 가능 분야 확인", "관심 분야와 가능한 시간을 담당자와 상담합니다."), card("연결", "활동 배치", "복지관 프로그램과 지역사회 활동 중 적합한 분야를 안내받습니다."), card("활동", "안전하게 참여", "활동 내용과 유의사항을 확인한 뒤 봉사에 참여합니다."), phoneCard("문의", "자원봉사 담당자 연결", "대표전화로 자원봉사 문의라고 말씀해 주세요.")
  ]),
  page("/participation/donation", "public-participation-donation.html", "참여마당", "DONATION", "후원 안내", "보내주신 관심과 나눔은 지역주민을 위한 복지사업에 소중히 사용됩니다.", [
    card("상담", "후원 방법 확인", "후원 분야와 방법은 담당자 상담을 통해 안내받을 수 있습니다."), card("연결", "지역 복지사업 지원", "후원은 지역주민의 삶과 가까운 복지사업을 지원합니다."), card("소통", "후원 관련 문의", "후원 절차와 필요한 확인 사항을 안내받을 수 있습니다."), phoneCard("문의", "후원 담당자 연결", "대표전화로 후원 문의라고 말씀해 주세요.")
  ]),
  page("/news", "public-news.html", "알림마당", "COMMUNITY NEWS", "복지관 소식을 확인하세요", "공지, 언론보도, 영상, 갤러리와 게시판을 메뉴별로 확인하세요.", [
    linkCard("공지", "공지·소식", "프로그램과 복지관 운영 소식을 확인하세요.", "/news/notices"), linkCard("보도", "언론보도", "언론에 소개된 복지관 활동을 확인하세요.", "/news/press"), linkCard("영상", "영상 아카이브", "공식 유튜브 활동 영상을 확인하세요.", "/news/videos"), linkCard("사진", "갤러리", "복지관 활동 기록을 확인하세요.", "/news/gallery"), linkCard("의견", "방문자 자유게시판", "공개된 주민 의견 목록을 확인하세요.", "/news/visitor-board"), linkCard("소통", "소통게시판", "주민과 복지관이 함께 전하는 이야기를 확인하세요.", "/community")
  ]),
  page("/news/notices", "public-news-notices.html", "알림마당", "NOTICE", "공지·소식", "프로그램 모집, 일정 변경과 복지관 운영에 관한 최신 공지를 확인하세요.", [
    externalCard("공식 공지", "최신 공지 확인", "가장 최근에 게시된 공지는 공식 홈페이지에서 확인할 수 있습니다.", "https://www.sacwc.kr/"), linkCard("소통게시판", "복지관과 주민의 소식", "공개된 게시글을 로그인 없이 둘러보세요.", "/community"), phoneCard("문의", "공지 내용 문의", "프로그램 모집과 운영 일정은 대표전화로 확인해 주세요.")
  ]),
  page("/news/press", "public-news-press.html", "알림마당", "PRESS", "언론에 소개된 송악사회복지관", "주요 활동과 복지관 소식을 언론보도로 확인하세요.", [
    externalCard("2026.06.29", "GS EPS 환경사랑미술대회 성황", "충청투데이 보도", "https://www.sacwc.kr/board/board.php?boardID=www17&mode=view&idx=1541"), externalCard("2026.06.29", "충남노인스포츠클럽 대회 선전", "충청타임즈 보도", "https://www.sacwc.kr/board/board.php?boardID=www17&mode=view&idx=1540"), externalCard("2026.05.29", "지역돌봄 아동 발전소 견학", "충청타임즈 보도", "https://www.sacwc.kr/board/board.php?boardID=www17&mode=view&idx=1526"), externalCard("전체보기", "언론보도 전체 목록", "기사 전문은 공식 원문에서 확인하세요.", "https://www.sacwc.kr/")
  ]),
  page("/news/videos", "public-news-videos.html", "알림마당", "SONGAK VIDEO", "영상으로 만나는 송악의 사람과 이야기", "영상 파일을 복제하지 않고 공식 유튜브 원본으로 연결해 페이지를 가볍게 유지합니다.", [
    externalCard("YouTube", "25년 송악실버학당 4기 활동영상", "송악실버학당 활동 기록", "https://www.youtube.com/watch?v=nUWMRojXmVI"), externalCard("YouTube", "함께 만든 변화, 함께 나눈 하루들의 기록", "2025년 복지관 활동 기록", "https://www.youtube.com/watch?v=kyQhkc6hG9M"), externalCard("YouTube", "2025년 사회복지현장실습 이야기", "사회복지현장실습 과정", "https://www.youtube.com/watch?v=1vok5vBLvEE"), externalCard("YouTube", "송악사회복지관 프로그램 소개", "주요 프로그램 안내", "https://www.youtube.com/watch?v=_dyB7jHw7XU")
  ]),
  page("/news/gallery", "public-news-gallery.html", "알림마당", "GALLERY", "사진으로 보는 복지관 활동", "큰 이미지는 목록에서 불러오지 않고 선택한 공식 게시물에서 확인하도록 구성했습니다.", [
    externalCard("활동 사진", "복지관 갤러리 확인", "공식 홈페이지에 공개된 사진과 활동 기록을 확인하세요.", "https://www.sacwc.kr/"), linkCard("영상", "영상 아카이브 함께 보기", "공식 유튜브 활동 영상을 확인하세요.", "/news/videos"), linkCard("소식", "공지·소식 확인", "최근 프로그램과 운영 소식을 확인하세요.", "/news/notices")
  ]),
  page("/news/visitor-board", "public-news-visitor-board.html", "알림마당", "VISITOR BOARD", "주민의 의견을 듣고 함께 답합니다", "공개 목록의 제목과 등록일만 제공하며 개인정보와 상세 원문은 공식 정책에 따라 보호합니다.", [
    externalCard("2026.07.17", "건의드립니다.", "방문자 의견", "https://www.sacwc.kr/main/sub.html?pageCode=20"), externalCard("2025.11.11", "원데이 클레이 추천드려요", "방문자 의견", "https://www.sacwc.kr/main/sub.html?pageCode=20"), externalCard("2025.08.20", "야간 프로그램 운영 건의", "방문자 의견", "https://www.sacwc.kr/main/sub.html?pageCode=20"), externalCard("전체보기", "공식 자유게시판 목록", "상세 내용은 공식 사이트의 공개 범위에 따라 확인하세요.", "https://www.sacwc.kr/main/sub.html?pageCode=20"), linkCard("소통", "송악 소통게시판", "현재 사이트의 공개 게시글을 둘러보고 의견을 남길 수 있습니다.", "/community")
  ]),
  documentPage("/privacy-policy", "public-privacy.html", "개인정보처리방침", "PRIVACY POLICY", "송악사회복지관은 관련 법령을 준수하며 이용자의 개인정보를 보호합니다.", `<dl class="document-meta"><div><dt>시행일</dt><dd>2021-06-22</dd></div><div><dt>담당부서</dt><dd>송악사회복지관 개인정보 보호 담당부서</dd></div><div><dt>연락처</dt><dd>041-353-5077</dd></div><div><dt>이메일</dt><dd>sacwc2021@hanmail.net</dd></div></dl><h2>개인정보의 처리</h2><p>상담, 프로그램 신청, 자원봉사와 후원 문의 등 서비스 제공에 필요한 범위에서 개인정보를 처리하며, 목적이 달성된 뒤에는 관련 법령에 따라 안전하게 파기합니다.</p><h2>이용자의 권리</h2><p>이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.</p><h2>보호조치</h2><p>개인정보의 분실, 도난, 유출, 변조 또는 훼손을 방지하기 위해 필요한 기술적·관리적 보호조치를 시행합니다.</p><p><a href="https://www.sacwc.kr/core/public/privacy_2025.html" target="_blank" rel="noopener">공식 원문 보기</a></p>`),
  documentPage("/email-refusal", "public-email-refusal.html", "이메일무단수집거부", "EMAIL POLICY", "웹사이트에 게시된 이메일 주소의 무단 수집을 거부합니다.", `<dl class="document-meta"><div><dt>시행일</dt><dd>2021-06-22</dd></div><div><dt>담당부서</dt><dd>송악사회복지관</dd></div><div><dt>담당자</dt><dd>홈페이지 운영 담당자</dd></div><div><dt>연락처</dt><dd>041-353-5077</dd></div></dl><p>송악사회복지관 웹사이트에 게시된 이메일 주소가 전자우편 수집 프로그램이나 그 밖의 기술적 장치를 이용해 무단으로 수집되는 것을 거부합니다.</p><p>수집한 주소를 판매·유통하거나 정보 전송에 이용해서는 안 됩니다.</p><p><a href="https://www.sacwc.kr/core/public/emailRefusal_2025.html" target="_blank" rel="noopener">공식 원문 보기</a></p>`),
  documentPage("/directions", "public-directions.html", "찾아오시는 길", "LOCATION", "(31728) 충남 당진시 송악읍 송악로 656", `<dl class="document-meta"><div><dt>주소</dt><dd>(31728) 충남 당진시 송악읍 송악로 656 (중흥리 367)</dd></div><div><dt>전화</dt><dd>041-353-5077</dd></div></dl><h2>대중교통</h2><ul><li>송악초등학교: 201·210·270번 하차 후 도보 약 4분</li><li>중흥사거리: 202·220·274번 하차 후 도보 약 8분</li><li>석포리 정류장: 215·223·231번 하차 후 도보 약 12분</li></ul><h2>자가용</h2><p>내비게이션에서 ‘송악사회복지관’ 또는 주소를 검색해 주세요.</p><p><a href="https://www.sacwc.kr/main/sub.html?pageCode=8" target="_blank" rel="noopener">공식 안내 보기</a></p>`)
];

function page(route, file, group, eyebrow, title, description, cards) { return { route, file, group, eyebrow, title, description, cards }; }
function documentPage(route, file, title, eyebrow, description, documentHtml) { return { route, file, group: "", eyebrow, title, description, documentHtml }; }
function card(badge, title, description) { return { badge, title, description }; }
function linkCard(badge, title, description, href) { return { badge, title, description, href, linkLabel: "페이지 보기" }; }
function externalCard(badge, title, description, href) { return { badge, title, description, href, linkLabel: "공식 원문 보기", external: true }; }
function assetCard(badge, title, description, href) { return { badge, title, description, href, linkLabel: "원본 열기", external: true }; }
function phoneCard(badge, title, description) { return { badge, title, description, href: "tel:0413535077", linkLabel: "041-353-5077 연결" }; }
function mailCard(badge, title, description) { return { badge, title, description, href: "mailto:sacwc2021@hanmail.net", linkLabel: "이메일 작성" }; }

function esc(value) { return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function header(currentRoute) {
  const desktop = navGroups.map((group) => `<li><details class="nav-group"${group.items.some(([,href]) => href === currentRoute) ? " open" : ""}><summary>${esc(group.label)}</summary><ul class="nav-menu">${group.items.map(([label,href]) => `<li><a href="${href}"${href === currentRoute ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`).join("")}</ul></details></li>`).join("");
  const mobile = navGroups.map((group) => `<li><strong>${esc(group.label)}</strong></li>${group.items.map(([label,href]) => `<li><a href="${href}"${href === currentRoute ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`).join("")}`).join("");
  return `<header class="site-header"><a class="brand" href="/">송악사회복지관</a><nav class="primary-nav" aria-label="전체 메뉴"><ul class="menu-root">${desktop}</ul></nav><a class="staff-link" href="/staff-login">담당자 로그인</a><details class="mobile-nav"><summary aria-label="전체 메뉴 열기">☰</summary><ul class="mobile-nav-links"><li><a href="/">홈</a></li>${mobile}<li><a href="/staff-login">담당자 로그인</a></li></ul></details></header>`;
}
function footer() { return `<footer class="site-footer"><section class="footer-brand"><small>SONGAK COMMUNITY WELFARE CENTER</small><h2>송악사회복지관</h2><p>주민과 함께 행복한 지역공동체를 만들어갑니다.</p></section><dl class="contact-grid"><div><dt>주소</dt><dd>(31728) 충남 당진시 송악읍 송악로 656</dd></div><div><dt>전화</dt><dd>041-353-5077</dd></div><div><dt>팩스</dt><dd>041-353-6077</dd></div><div><dt>이메일</dt><dd>sacwc2021@hanmail.net</dd></div></dl><div class="footer-links"><nav aria-label="하단 정책 메뉴"><a href="/privacy-policy">개인정보처리방침</a><a href="/email-refusal">이메일무단수집거부</a><a href="/directions">찾아오시는 길</a></nav><p>Copyright © 송악사회복지관. All rights reserved.</p></div></footer>`; }
function cardHtml(item) { const link = item.href ? `<a href="${esc(item.href)}"${item.external ? ' target="_blank" rel="noopener"' : ""}>${esc(item.linkLabel)}</a>` : ""; return `<article class="info-card"><span class="badge">${esc(item.badge)}</span><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p>${link}</article>`; }
function shell({ route, title, description, main }) { const pageTitle = `${title} | 송악사회복지관`; const pageUrl = `${baseUrl}${route}`; const socialImage = `${baseUrl}/songak/assets/generated/songak-sns-thumbnail-v2.png`; return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:locale" content="ko_KR"><meta property="og:title" content="${esc(pageTitle)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${pageUrl}"><meta property="og:image" content="${socialImage}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(pageTitle)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${socialImage}"><link rel="canonical" href="${pageUrl}"><link rel="stylesheet" href="/songak/public-site.css"><title>${esc(pageTitle)}</title></head><body><a class="skip-link" href="#main-content">본문으로 이동</a>${header(route)}<main id="main-content">${main}</main>${footer()}</body></html>`; }
function renderPage(item) { const hero = `<section class="page-hero"><small>${esc(item.eyebrow)}</small><h1>${esc(item.title)}</h1><p>${esc(item.description)}</p></section>`; const body = item.documentHtml ? `<section class="content-section"><article class="document">${item.documentHtml}</article></section>` : `<section class="content-section"><div class="card-grid">${item.cards.map(cardHtml).join("")}</div></section>`; return shell({ route: item.route, title: item.title, description: item.description, main: hero + body }); }
function renderHome() { const main = `<section class="hero" aria-label="송악사회복지관 대표 이미지와 담당자 로그인"><picture class="hero-picture"><source media="(max-width:760px)" srcset="/songak/assets/generated/account-sns-photoreal-mobile-v2.webp"><img src="/songak/assets/generated/account-sns-photoreal-v1.webp" alt="송악사회복지관 앞에서 함께 웃는 어르신과 복지관 직원" width="1536" height="1024" fetchpriority="high" decoding="async"></picture><div class="login-panel" id="login" aria-label="SNS 로그인 선택"><a class="sns-button kakao" href="/staff-login?provider=kakao"><span class="provider-mark">K</span><span class="sns-label">카카오로 시작하기</span><span></span></a><a class="sns-button naver" href="/staff-login?provider=naver"><span class="provider-mark">N</span><span class="sns-label">네이버로 시작하기</span><span></span></a><a class="sns-button" href="/staff-login?provider=google"><span class="provider-mark">G</span><span class="sns-label">구글(Google)로 시작하기</span><span></span></a></div></section>`; return shell({ route: "/", title: "송악사회복지관 함께마당", description: "주민과 함께 행복한 지역공동체를 만들어가는 송악사회복지관입니다.", main }); }

const legacyPages = [
  ["facility-detail.html", "facility", "/about/facility"],
  ["program-schedule.html", "schedule", "/programs/schedule"],
  ["case-management-detail.html", "case", "/programs/case-management"],
  ["organization-staff.html", "organization", "/about/organization"],
  ["video-archive.html", "video", "/news/videos"],
  ["online-application.html", "application", "/programs/application"],
];
function legacyRedirect(pageKind, target) { return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="${baseUrl}${target}"><title>송악사회복지관 공개 페이지로 이동</title></head><body data-page="${pageKind}"><p><a href="${target}">공개 페이지로 이동</a></p><script>location.replace(${JSON.stringify(target)});</script></body></html>`; }

await writeFile(path.join(outputDir, "representative-greeting-public.html"), renderHome(), "utf8");
await Promise.all(PAGES.map((item) => writeFile(path.join(outputDir, item.file), renderPage(item), "utf8")));
await Promise.all(legacyPages.map(([file, pageKind, target]) => writeFile(path.join(outputDir, file), legacyRedirect(pageKind, target), "utf8")));
console.log(`Built ${PAGES.length + 1} public Songak pages.`);
