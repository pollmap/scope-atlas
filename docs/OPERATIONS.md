# 실행·검증·운영

## 첫 실행과 검사 순서

Node.js 22와 Python 3.13을 CI 기준으로 사용합니다. 잠금 파일에 고정된 JavaScript 의존성은 `npm ci`로 설치합니다.

1. `npm ci`
2. `npm run build`
3. `npm test`
4. `python -m unittest discover -s tests -p "test_*.py"`
5. `npm run audit:release`

`npm test`의 Sites 패키징 검사는 빌드 산출물을 읽으므로 반드시 빌드 후 실행합니다. Python 단위검사는 표준 라이브러리만 사용하며 내부 원자료가 필요하지 않습니다.

GitHub Actions는 인증정보 없이 깨끗한 체크아웃에서 같은 순서로 실행합니다. 로컬 QA 디렉터리가 없어도 릴리스 감사는 결과 경로를 생성합니다. 배포용 토큰은 CI에 등록하지 않습니다.

## 현재 배포

- 서비스: https://scope-atlas.pages.dev
- 프로젝트: Cloudflare Pages `scope-atlas`
- 프로덕션 브랜치: `main`
- 업로드 대상: `dist/client`만
- 명령: `npm run deploy`
- 설정: `wrangler.jsonc`, `package.json`

Cloudflare에서 Pages 배포 권한이 있는 계정으로 로그인하고 빌드·감사를 통과한 결과만 업로드합니다. 이전 Workers 주소는 사용자 저장자료 백업을 위해 유지 중이며 기본 배포 대상이 아닙니다. 계정 공통 주소를 바꾸거나 강제 리디렉션하지 않습니다.

## 배포 후 확인

`python -m pip install -r requirements-dev.txt` 후 `python scripts/verify-live.py`를 실행하면 HTML, 직접 접속 경로, JSON, JS, CSS를 읽어 로컬 빌드와 SHA-256을 대조합니다. 결과는 `qa/scope/pages-live-http.json`에 기록됩니다. 코드가 바뀐 로컬 빌드와 이전 배포를 비교하면 실패하는 것이 정상입니다.

브라우저에서는 다음 흐름을 확인합니다.

- 산업 선택 → 세부 업종 → 상세 → 같은 법인 모아보기
- 서로 다른 출처의 동일 법인 비교 안내, 최대 3개 비교 제한
- 차트의 분류 수와 연결된 목록의 수 일치
- 관심 저장 → 메모 → 새로고침 → 백업·복원
- 작은 화면의 필터·상세 닫기, 문서 가로 넘침, 키보드 접근
- CSV·PNG 파일 링크 생성, 공유 URL에서 메모 제외

## 비공개 자료 경계

`.gitignore`는 `node_modules`, `dist`, `.wrangler`, 환경변수 파일, `qa`, 내부 감사자료, 개인용 작업 지침을 제외합니다. 배포 파일은 별도의 허용 목록으로 검사합니다. 저장소와 배포 범위는 서로 다릅니다.

운영자가 추가로 막을 문구가 있으면 추적되지 않는 `.release-private-patterns.json`에 정규식 문자열 배열을 넣을 수 있습니다. 예: `["DO_NOT_PUBLISH_MARKER"]`. 이 파일 자체에 개인정보가 들어갈 수 있으므로 커밋하지 않습니다. CI는 이 로컬 파일 없이 일반 패턴·파일 범위 검사를 수행하며, 검사 결과에 적용 여부를 표시합니다.

## 변경·병합·배포의 구분

변경 브랜치에서 작업하고 PR 검사가 통과한 뒤 `main`에 병합합니다. **GitHub 병합은 Cloudflare 배포와 별개**입니다. 화면 코드·공개 데이터가 달라졌다면 검수 후 별도로 배포하고 새 주소의 응답을 대조합니다. README나 내부 검사 코드만 변경했다면 같은 화면을 재배포할 필요는 없습니다.

## 알려진 제한

- ECharts 지연 청크는 약 506KB로 Vite 크기 경고가 있습니다. 첫 탐색 화면에서는 로드하지 않습니다.
- 저장은 브라우저·주소 단위입니다. 주소 변경 시 이전 사이트에서 JSON 백업 후 새 사이트에서 복원합니다.
- 정적 스냅샷의 데이터 조회일은 실시간 갱신 시각이나 각 기업의 마지막 신고일이 아닙니다.
- 데이터 재생성은 외부 원본 확보가 필요합니다. 누락 원본을 빈 배열로 대체하지 마세요.
