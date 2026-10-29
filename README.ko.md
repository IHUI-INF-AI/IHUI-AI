<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> ⚠️ **저작권 및 상업적 라이선스 고지**
>
> © 2026 **IHUI AI (智汇AI)** · 저작권자: **리춘촨 (李春川, Li Chunchuan)** · https://aizhs.top
>
> - 듀얼 라이선스: 오픈소스 사용은 **Apache-2.0** (저작권 표시 및 NOTICE 유지 필수). **폐쇄형 상업적 사용·브랜드 제거·SaaS 재판매**에는 별도의 상업 라이선스가 필요합니다.
> - 이 저장소의 모든 소스 파일에는 출처 추적 워터마크(가시 선언 + 불가시 폭 없는 문자 스테가노그래피, `node scripts/watermark.mjs decode <file>`로 검증 가능)가 삽입되어 있습니다. 워터마크 제거는 저작권 귀속을 변경하지 않으며, 무단 상업적 사용은 기술적으로 추적 가능하고 법적 책임을 집니다.
> - CI는 워터마크 검증(`pnpm watermark:check`)을 강제하며, 워터마크를 제거하는 변경은 빌드 실패를 유발합니다.

# IHUI-AI

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>자체 호스팅 풀스택 AI 플랫폼</strong>: 멀티모델 대화 · OpenAI 호환 API 릴레이 · 멀티플랫폼 계정 풀 · 체크인·키프얼라이브 · Agent/MCP · 지식·멀티 발행 · 8클라이언트 + CLI
</p>

<p align="center">
  <strong>온라인 Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star</a>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
</p>

<p align="center">
  <sub>
    <a href="README.md">간체 중국어</a> ·
    <a href="README.en.md">영어</a> ·
    <strong>한국어</strong> ·
    <a href="README.ja.md">일본어</a>
  </sub>
</p>

---

> **색인 레이어.** 기능 개요·실시간 집계 숫자·빠른 시작은 [`README.md`](./README.md) / [`README.en.md`](./README.en.md) 및 [`docs/engineering/`](./docs/engineering) 참고. 규율은 [`AGENTS.md`](./AGENTS.md).

## 이 README로 할 수 있는 것

**IHUI-AI**는 자체 호스팅 가능한 풀스택 AI 플랫폼입니다. 대화·**OpenAI 호환 API 릴레이**·**계정 풀·자동 체크인**·Agent/MCP·지식/발행·교육/커뮤니티를 한 백엔드로 제공합니다. 규모 숫자는 집계 키(`llmModels` / `publishPlatforms` / `apiRoutes` 등)만—[`README.md` 생성 블록](./README.md#关键数字现算) 참고.

### 대화와 모델

- 멀티모델 대화(`llmModels`), 스트리밍, 매개변수/즐겨찾기/기록. BYOK·Prompt·Plan-Act·작업 진행·큐·멀티창.
- 음성 STT/TTS(WebRTC), 이미지/영상 작업, 세션 가져오기.

### API 릴레이

- 개발자 Key로 `/v1/chat/completions` 등. **종량 과금**·피크 가격·화이트리스트/할당량·failover·Key 풀 서킷 브레이커.
- Trae / WorkBuddy / CodeArts / Qoder 등 IDE 계정을 동일 `/v1`에 연결.

### 계정 풀

- **운영 풀**: 최대 **12** provider(`RELAY_PROVIDERS`). **풀 가입 ≠ 체크인**.
- **개인 풀**: Web/RN/미니프로그램. 선택 정책·CAS 동기화·refresh 지원 플랫폼 자동 갱신.
- `scripts/relay-account-pool.mjs` 등 로컬 가져오기.

### 체크인·키프얼라이브

- **화이트리스트 4곳만**: Trae / WorkBuddy / Qoder / MiniMax. WB 작업군. **키프얼라이브는 대신 체크인하지 않음**.
- **Cursor / Claude 제품 계정 자동 체크인 없음**.

### 게이트웨이·출구

- **제품 의미**: 멀티테넌트 OpenAI 형 API 게이트웨이(임의 HTTP 리버스 프록시 콘솔 아님).
- 출구 프록시 풀; `/api/checkin/*` → ai-service.

### Agent / MCP / 지식 / 상업 / 멀티클라이언트

- 에이전트 마켓·워크벤치·MCP·워크플로. RAG·`publishPlatforms` 규모 멀티 발행. VIP/지갑/팀. 8단 + CLI(`cliCommandFiles`).

---

## 분명히 「아닌」 것

| 오해 | 사실 |
| --- | --- |
| 「12플랫폼 전부 체크인」 | 풀 12; **체크인은 4플랫폼만** |
| Cursor / Claude 체크인 | 엔진 없음 |
| 「무료 무제한 릴레이」 | 과금·할당량·서킷 브레이커 있음 |
| 임의 HTTP 리버스 프록시 패널 | OpenAI 형 GW + 풀 + 출구 프록시 |

상세 목차·빠른 시작·8단 목록은 아래에서 계속(기존 장문 문서 유지).


---

## 목차

- [빠른 시작](#빠른-시작) · [배포](#배포) · [FAQ](#faq) · [문의하기](#문의하기)

---

## 상세 문서（장문은 engineering 收纳件만）

포지셔닝·대标·선언·브랜드 스토리 등 **마케팅 장문**은 본 파일에 중복하지 않습니다:

| 주제 | 문서 |
| --- | --- |
| 포지셔닝·선언·GEO | [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md) |
| 선택 이유·비교·시나리오 | [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md) |
| 기술 스택·8단·모듈 | [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md) |
| 스토리·SEO·Keywords | [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md) |

규모 숫자는 [`README.md` 생성 블록](./README.md#关键数字现算) 과 `pnpm doc:numbers` 만 사용(118 모델 등 수기 숫자 금지).

---

## 빠른 시작

### 환경 요구사항

| 툴         | 버전               | 설명                                                         |
| ---------- | ------------------ | ------------------------------------------------------------ |
| Node.js    | `>=20.10.0`        | LTS 20.x, `nvm use` 권장                                     |
| pnpm       | `>=9.0.0`          | 프로젝트 고정 `pnpm@9.15.0`, `corepack enable`로 자동 활성화 |
| Python     | `3.12+`            | `apps/ai-service` 전용                                       |
| PostgreSQL | `18+`              | compose는 `pgvector/pgvector:pg18` 사용                      |
| Redis      | `7+`               | compose는 `redis:7-alpine` 사용                              |
| Docker     | `24+` + Compose v2 | 선택, 원클릭 시작에 권장                                     |
| Git        | `2.40+`            | `core.autocrlf=false`(프로젝트 LF 강제)                      |

### 원클릭 시작(Docker)

```bash
# 1. 클론
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git IHUI-AI && cd IHUI-AI

# 2. 환경 변수 설정
cp .env.example .env
# .env 편집, JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY 등 입력

# 3. 원클릭 풀스택 시작(7 비즈니스 + 7 모니터링 = 14 서비스)
docker compose up -d
```

**서비스 접속 주소:**

| 서비스       | URL                              | 설명                                                        |
| ------------ | -------------------------------- | ----------------------------------------------------------- |
| Web          | http://localhost:8801            | Next.js 프론트엔드                                          |
| API          | http://localhost:8802/api/health | Fastify 백엔드 헬스 체크                                    |
| Worker       | http://localhost:8830            | BullMQ 비동기 작업 프로세스                                 |
| AI 서비스    | http://localhost:8803/health     | FastAPI AI 서비스 헬스 체크                                 |
| Grafana      | http://localhost:8816            | 기본 계정 admin / 비밀번호 변경(20 대시보드 자동 provision) |
| Prometheus   | http://localhost:9091            | 지표 수집                                                   |
| Jaeger UI    | http://localhost:8814            | 분산 추적                                                   |
| Loki         | http://localhost:8818            | 로그 aggregation                                            |
| Alertmanager | http://localhost:9093            | 알림 라우팅                                                 |

### 개발 모드(로컬)

```bash
# 1. 설치
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install

# 2. 데이터베이스 + Redis 시작
docker compose up -d db redis

# 3. 마이그레이션 + 검증 + seed
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:check
pnpm --filter @ihui/database seed          # 7단계 멱등 seed

# 4. 모든 apps 원클릭 시작(turbo 병렬)
pnpm dev
# 또는 개별 시작:
# pnpm --filter @ihui/api run dev          # 백엔드 :8802
# pnpm --filter @ihui/web run dev          # 프론트엔드 :8801
# cd apps/ai-service && uv sync && uvicorn app.main:app --reload --port 8803

# 5. 전체 검증(typecheck + lint + test)
pnpm turbo build typecheck lint test
```

### Windows 원클릭 시작(9 PowerShell 스크립트)

```powershell
.\scripts\dev-up.ps1                    # web + api + ai-service + 데이터베이스 + Redis 시작
.\scripts\dev-all.ps1                   # dev server만 시작(데이터베이스 이미 실행 중)
.\scripts\dev-web.mjs                   # web만 시작
.\scripts\kill-dev-servers.ps1          # 모든 dev server 중지
.\scripts\restart-dev-server.ps1        # dev server 재시작
.\scripts\setup-token-refresh-task.ps1  # token 갱신 정기 작업 설정
.\scripts\cleanup-external-junk.ps1     # 외부 정크 파일 정리
```

### G:\ 루트 외부 도구 오염 방지 (2026-07-24 제정)

`G:\` 루트 디렉터리는 세 가지 이유로 프로젝트 외부 정크가 누적됩니다:

1. **외부 Qt 도구 오염**: `WeChat Pay Merchant API Certificate Tool V1.4.exe` 등 Qt 응용 프로그램을 `G:\` 루트에서 두 번 클릭하여 실행하면, Qt 프레임워크가 플러그인 디렉터리(`platforms/` / `iconengines/` / `imageformats/` / `styles/` / `bearer/` / `translations/`) + `Qt5*.dll` + `CA/cert/WXCertUtil` 인증서 작업 디렉터리를 현재 작업 디렉터리에 자동으로 해제합니다.
2. **다른 IDE 구성 이상**: QoderCN 등 IDE의 venv 명령이 `C:\`를 `g:\c\`로 잘못 입력하여, Python이 `G:\` 아래에 전체 경로 체인 `c\Users\Administrator\.workbuddy\...`를 생성할 수 있습니다;경로 해석 실패 시 `nonexistent-root/` 폴백 디렉터리도 생성되며, JDK 감지 캐시는 `.appdata/`에 기록됩니다.
3. **초기 agent 임시 파일 위반**: 2026-07-23 v2 위생 가드 제정 이전, agent가 hover 스크린샷 / sidebar `.vue` / `.diff` / `.log` 등 임시 파일을 `G:\tmp\`에 무단으로 기록했습니다.

**근본 해결 방안**:

- **정리**: `powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\cleanup-external-junk.ps1 -Force`(agent 자동 모드, 16 디렉터리 + 31 파일 목록, 와일드카드 없음, 다른 응용 프로그램 디렉터리를 건드리지 않음)
- **예방**:
  - 외부 Qt 클래스 도구(WeChat Pay 인증서 도구 / `.exe` 설치 패키지 / 압축 해제 즉시 실행 도구)는 `G:\` 루트에서 실행이 금지되며, `G:\tools\` 또는 프로젝트 하위 디렉터리에 배치해야 합니다
  - pnpm 명령은 `G:\` 루트에서 실행이 금지됩니다(`.pnpm-store` v11을 생성하여 프로젝트 내 v3와 충돌)
  - QoderCN 등 IDE를 사용할 때 `G:\c\Users\Administrator\.workbuddy\`가 생성되면, IDE Python venv 경로 구성을 확인해야 합니다
  - agent는 임시 파일을 위해 `.ihui-agent/tmp/`를 사용해야 합니다(`scripts/check-workspace-hygiene.mjs` v2 blocking 가드, pre-commit 25항으로 강제)

자세한 내용은 [AGENTS.md §15 G:\ 루트 외부 도구 오염 방지](AGENTS.md)를 참조하세요.

---
## FAQ

비교표·비용·40+ 제품 대标 장문은 [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md) 와 [`readme-07-faq-roadmap-commerce`](./docs/engineering/readme-07-faq-roadmap-commerce.md) 에만 둡니다(본 README에 두 번째 마케팅 세트 금지).

## 문의하기

- 사이트 / 문서: <https://aizhs.top>
- Issue: <https://github.com/IHUI-INF-AI/IHUI-AI/issues>
- 보안: [`SECURITY.md`](./SECURITY.md)
- 연락처 전문: [`readme-03`](./docs/engineering/readme-03-why-comparison-scenarios.md) · [`readme-07`](./docs/engineering/readme-07-faq-roadmap-commerce.md)

---

## 브랜드 스토리·공동 구축 비전（归档）

스토리·선언·SEO 장문 전문은 [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md) 및 [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md) 참고. 본 README에 마케팅 두 번째 초반을 쌓지 않습니다.

---

## License

[Apache License 2.0](LICENSE)

---

<div align="center">

도움이 되었다면 ⭐ 부탁드립니다.

</div>
