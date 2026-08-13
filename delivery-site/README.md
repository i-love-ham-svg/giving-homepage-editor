# 송악사회복지관 소통게시판

PC와 모바일에서 주민과 복지관 담당자가 사진·영상을 포함한 소식을 작성하고 공유할 수 있는 납품용 게시판입니다. 주민 글은 관리자 승인 후 공개되며, 복지관 공식 글은 즉시 공개할 수 있습니다.

## 제공 기능

- 카드형·목록형 게시글 보기, 검색, 분류, 페이지 이동
- 모바일 작성 화면, 임시 저장, 썸네일 선택
- 이미지(JPEG, PNG, WEBP, GIF) 및 영상(MP4, WEBM) 업로드
- 공유, 신고, 조회 수, 작성자 비밀번호 기반 수정·삭제
- 관리자 로그인, 승인·반려·숨김, 내부 메모, 감사 기록
- D1 영구 데이터 저장과 R2 미디어 저장
- 동일 출처 검사, 요청 횟수 제한, 파일 형식·시그니처 검사

## 로컬 실행

Node.js 22.13 이상과 pnpm 11.9가 필요합니다.

```powershell
Copy-Item .dev.vars.example .dev.vars
pnpm install
pnpm dev
```

`.dev.vars`의 값은 실제 운영 값으로 교체해야 합니다.

- `TEMP_EDITOR_ID`: 임시 담당자 로그인 아이디
- `TEMP_EDITOR_PASSWORD`: 임시 담당자 로그인 비밀번호
- `BOARD_SESSION_SECRET`: 32자 이상의 무작위 세션 서명 키
- `BOARD_HASH_PEPPER`: 작성자·요청자 식별 정보 보호용 무작위 키
- `APPLICATION_HASH_PEPPER`: 온라인 신청 식별 정보 보호용 무작위 키
- `BOARD_EDITOR_EMAILS`: 소셜 로그인 사용 시 허용할 담당자 이메일 목록

`.dev.vars`와 실제 비밀값은 Git에 커밋하지 않습니다.

## 검증

```powershell
pnpm exec tsc --noEmit
pnpm build
pnpm test
```

데이터 구조를 변경한 경우 `pnpm db:generate`로 D1 마이그레이션을 다시 생성합니다. 운영 환경에는 `drizzle/meta/_journal.json` 순서대로 `0000_nifty_photon.sql`, `0001_site_content_versions.sql`, `0002_applications.sql`을 적용합니다.

## 운영 점검표

1. 담당자 로그인 값과 세 개의 무작위 비밀키를 배포 환경에 등록합니다.
2. D1 `DB`, R2 `MEDIA` 바인딩이 연결되었는지 확인합니다.
3. 주민 글 작성 → 관리자 승인 → 공개 조회 → 공유 → 신고 흐름을 확인합니다.
4. 사진과 영상 업로드, 모바일 작성, 비밀번호 수정·삭제를 확인합니다.
5. 개인정보 보유 기간, 신고 처리 담당자, 게시물 운영 정책을 복지관 기준으로 확정합니다.
6. D1 백업과 R2 보존 정책을 운영 계정에서 설정합니다.

## 주요 경로

- `/`: 공개 게시판
- `/api/board/posts`: 게시글 조회·작성
- `/api/board/media`: 미디어 업로드
- `/api/board/admin/login`: 관리자 로그인
- `/api/board/health`: 저장소 연결 상태 확인

## 여러 복지관으로 재사용

기관별 이름, 연락처, 색상과 담당 정보는 저장소 루트의
`config/institutions/institution.example.json`을 복사해 관리합니다. 공동 작업 절차,
환경변수, 개인정보 및 인수인계 기준은 `docs/MULTI_WELFARE_WORKFLOW.md`를 따릅니다.

기관 설정 파일에는 비밀번호나 주민 데이터를 넣지 않습니다. 현재 기관 설정은
협업 기준 문서이며, 화면 변경 후에는 편집기와 공개 화면을 반드시 함께 검수합니다.
