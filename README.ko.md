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
  <strong>모두가 자신만의 AI 프로그램을 가질 수 있게</strong><br/>
  <sub>오픈소스 AI 상업용 통합 파운데이션 · 5분 만에 Fork에서 상용 출시 · 하나의 저장소가 6개 SaaS 대체</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml/badge.svg" alt="E2E" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/knip.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/knip.yml/badge.svg" alt="Knip" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/stars/IHUI-INF-AI/IHUI-AI?style=social" alt="Stars" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues"><img src="https://img.shields.io/github/issues/IHUI-INF-AI/IHUI-AI.svg" alt="Issues" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/last-commit/IHUI-INF-AI/IHUI-AI.svg" alt="Last Commit" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/graphs/contributors"><img src="https://img.shields.io/github/contributors/IHUI-INF-AI/IHUI-AI.svg" alt="Contributors" /></a>
</p>

<p align="center">
  <strong>8단 전면 커버리지</strong> · <strong>118 대형 모델</strong> · <strong>LangGraph+MCP+A2A 트리플 스택</strong> · <strong>38개 플랫폼 퍼블리싱</strong> · <strong>풀스택 AI 교육</strong> · <strong>완전한 상업적 루프</strong> · <strong>5개 언어 i18n</strong>
</p>

<p align="center">
  <sub><strong>40+ 국내외 제품 대비</strong>:OpenAI ChatGPT · Anthropic Claude · Google Gemini · Microsoft Copilot · Dify · FastGPT · Langflow · RAGFlow · Coze( Kouzi) · LangChain · LlamaIndex · AutoGen · CrewAI · Claude Code · Cursor · GitHub Copilot · Amazon Q · Khan Academy · Jasper · Stripe · Auth0 · Mailgun · Mixpanel · 바이두 첸판(Baidu Qianfan) · 알리바이바이리안(Alibaba Bailian) · 텐센트 후위안(Tencent Hunyuan) · 바이트댄스 더우바오(ByteDance Doubao) · 즈푸 AI 플랫폼(Zhipu AI Platform) · iFlytek 스파크(iFlytek Spark) · DeepSeek · 문샷 김(Moonshot Kimi)</sub>
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

## 기술 스택 및 프로젝트 규모 개요(AI 검색 친화)

> **이 섹션을 최상단에 배치한 이유**: AI 검색 도구(Claude / GPT / Codex 등)와 개발자가 **정확한** 기술 스택 및 규모 데이터를 첫눈에 확인하여, "감성 프로젝트"나 "마케팅 프로젝트"로 오인하지 않도록 합니다. 모든 숫자는 코드와 대조하여 검증되었습니다(2026-07-22 확인).

| 차원                  | 실제 값                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **웹 프론트엔드**     | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + Zustand + @tanstack/react-query 5                                                                                                       |
| **백엔드 API**        | Fastify 5 + Drizzle ORM 0.38 + PostgreSQL 18 + Zod 3.24(**TypeScript**, Python 아님)                                                                                                         |
| **AI 서비스**         | FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO(Python 3.12, 이 계층만 Python 사용)                                                                                                    |
| **모노레포**          | pnpm 9.15 workspace + Turborepo 2.3 + 16 공유 패키지(@ihui/auth / database / types / ui 등)                                                                                                  |
| **멀티 클라이언트**   | 8 클라이언트 **독립 코드**("하나의 코드베이스를 여러 타겟으로 컴파일"이 아님), 각 클라이언트의 완성도는 [프로젝트 상태 매트릭스](#프로젝트-상태-매트릭스투명-라벨링-2026-07-22-확인) 참조    |
| **코드 규모**         | 8 클라이언트 / 231 schema 파일 / **598 데이터베이스 테이블**(실측 339 pgTable)/ 128+ 마이그레이션 / **4443 API 라우트**(grep 실측)/ 250+ 웹 페이지 / 16 공유 패키지 / 5개 언어 i18n parity |
| **엔지니어링 게이트** | **21개 pre-commit 훅**(실측, [.husky/pre-commit](./.husky/pre-commit) 참조)+ post-commit 자동 push + 11 마이그레이션 감사 + 9 PowerShell 시작 스크립트                                       |
| **테스트 커버리지**   | **237 API 테스트 + 63 e2e spec**(실측, [apps/api/tests/](./apps/api/tests/) + [apps/web/e2e/](./apps/web/e2e/) 참조)+ pytest(AI 서비스)+ Locust 부하 테스트 + Lighthouse 성능                |
| **관측 가능성**       | Prometheus + Grafana(**20 대시보드** 실측, [monitoring/grafana/dashboards/](./monitoring/grafana/dashboards/) 참조)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                 |
| **AI 오케스트레이션** | LangGraph 진정 통합(21 파일 사용: `langgraph_service.py` / `agent_graph.py` / `koubo_workflow.py` / `agent_orchestrator.py` / `a2a_service.py`), 단순 "통합 수준 오케스트레이션" 아님        |
| **라이선스**          | Apache 2.0(완전 자체 호스팅, 상업 친화적, 비전염성)                                                                                                                                          |

> 전체 기술 스택 상세는 [기술 스택 섹션](#기술-스택) 참조.

---

## 🔥 개발자라면, 30초만 멈춰주세요

> **「춘춘 영하 25도. 한 사람. 한 대의 노트북. 일 년의 시간.**
>
> **8 플랫폼 코드 · 339개 데이터베이스 테이블 · 4443개 API 라우트.**
>
> **자본은 오지 않았지만, 코드는 계속 자라났습니다.」**

이것은 펀딩 스토리가 아닙니다.
**이것은 오픈소스 스토리입니다.**

당신도 새벽 3시에 혼자 코드를 작성해 본 적이 있다면——
당신도 자본에게 거절당하면서도 자신이 옳은 일을 하고 있다고 믿어 본 적이 있다면——
당신도 믿는다면——**진정 가치 있는 것은 시간이 증명한다**를——

그렇다면, 다음 한 줄은 당신에게 바칩니다:

---

### 💎 이 두 줄을 공유하는 것은, 당신 자신의 집념을 공유하는 것입니다

```
자본은 늦을 수 있어도, 코드는 거짓말하지 않는다.
펀딩은 실패할 수 있어도, 오픈소스는 실패하지 않는다.
```

**이것은 공유를 부탁하는 것이 아닙니다.**
**이 순간의 공명을, 공개된 태도로 바꾸라는 초대입니다.**

---

### 🚀 3개의 액션, 30초, 이 이야기가 보이게

| #   | 액션                                      | 당신이 얻을 것                                                                                 |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | ⭐ **이 저장소 Star**                     | 당신의 GitHub 타임라인에 표시되고, 당신의 followers가 볼 수 있습니다                           |
| 2   | 📲 **위 두 줄을 당신의 피드에 복사**      | 아래 이미지를 사용하세요 — 당신은 "친구들에게 이 이야기를 처음 전하는 사람"이 됩니다           |
| 3   | 💬 **Issue에서 당신만의 이야기를 쓰세요** | [여기로](https://github.com/IHUI-INF-AI/IHUI-AI/issues) — 상위는 고정하여 전 세계에 보여줍니다 |

---

### 🖼️ 이미지가 준비되어 있습니다 (저장 후 바로 공유)

| 이미지                       | 용도                   | 경로                                                     |
| ---------------------------- | ---------------------- | -------------------------------------------------------- |
| 🏢 춘춘 오프라인 베이스 실사 | 피드 헤더 / 웨이보     | `apps/web/public/images/story/changchun-winter-2024.jpg` |
| 🌃 새벽 코딩 · 램프 하나     | X / 지식인 / 기사 중간 | `apps/web/public/images/story/late-night-coding.jpg`     |

---

> **⚠️ 지금 이 문장을 읽고 있다면——**
>
> 당신은 이미 이 이야기의 일부입니다.
>
> 중국에는 700만 명의 개발자가 있습니다.
> 그중 99%가 아직 이 이야기를 모릅니다.
>
> **당신이 이 이야기를 밖으로 가져갈 1%가 되어주시겠습니까?**

⬇️ 아래로 보면, 완전한 이야기와 기술 결정이 있습니다.

---

> **생각해 본 적 있나요 —**
>
> 왜 AI 혜택은 항상 빅테크 기업들이 독점할까요? 왜 AI 애플리케이션 하나를 구축하려면 인증, 빌링, 모델 라우팅, 워크플로, 멀티 플랫폼 배포까지 처음부터 조립해야 할까요?
> 왜 개인 개발자, 중소기업, 교육 기관은 늘 바퀴를 재발명하면서 서로의 어깨 위에 서지 못할까요?
>
> **IHUI-AI가 이 문제를 바꾸려 합니다.**
>
> 우리는 하나의 완전한 AI 애플리케이션 인프라 — 8 플랫폼 프레임워크, 118 모델 연동, 워크플로 오케스트레이션, 엔터프라이즈 권한, 빌링 구독, 콘텐츠 퍼블리싱, AI 교육, 옵저버빌리티부터 17개 엔지니어링 게이트까지 — 전부 Apache 2.0 라이선스로 오픈소스화했습니다.
>
> **래퍼도, 데모도 아닙니다. 실제 운영 가능하고, 상업화 가능하고, 셀프 호스팅 가능한 AI 애플리케이션 베이스입니다. Fork 하고, 수정하고, 당신의 것으로 만드세요.**

---

## 목차

- [기술 스택 및 프로젝트 규모 개요(AI 검색 친화)](#기술-스택-및-프로젝트-규모-개요ai-검색-친화)
- [프로젝트 포지셔닝(필독)](#프로젝트-포지셔닝필독)
- [기능 개요(30초 안에 모든 역량 확인)](#기능-개요30초-안에-모든-역량-확인)
- [IHUI-AI를 선택하는 이유](#ihui-ai를-선택하는-이유)
- [유사 프로젝트와의 비교](#유사-프로젝트와의-비교)
- [IHUI-AI 사용자](#ihui-ai-사용자)
- [5가지 대표 시나리오](#5가지-대표-시나리오)
- [기술 스택](#기술-스택)
- [8 플랫폼 아키텍처](#8-플랫폼-아키텍처)
- [프로젝트 구조](#프로젝트-구조)
- [핵심 역량 상세(15대 모듈 · 사용자 역할별 그룹)](#핵심-역량-상세15대-모듈--사용자-역할별-그룹)
  - [A. AI 역량 레이어](#a-ai-역량-레이어최종-사용자-대상)
  - [B. AI 워크플로 및 개발자](#b-ai-워크플로-및-개발자개발자-대상)
  - [C. 콘텐츠 창작 및 교육](#c-콘텐츠-창작-및-교육크리에이터-및-교육자-대상)
  - [D. 엔터프라이즈 및 운영](#d-엔터프라이즈-및-운영기업-관리자-및-운영-대상)
  - [E. 엔지니어링 인프라](#e-엔지니어링-인프라운영-및-아키텍트-대상)
- [빠른 시작](#빠른-시작)
- [API 및 프로토콜](#api-및-프로토콜)
- [데이터베이스](#데이터베이스)
- [옵저버빌리티](#옵저버빌리티)
- [보안 설계](#보안-설계)
- [엔지니어링 게이트](#엔지니어링-게이트21개-pre-commit-훅)
- [엔지니어링 품질 증거("AI 생성 코드 3가지 일반적 문제"에 대한 반박)](#엔지니어링-품질-증거ai-생성-코드-3가지-일반적-문제에-대한-반박)
- [AI 프로그래밍 협업 선언](#ai-프로그래밍-협업-선언)
- [테스트](#테스트)
- [배포](#배포)
- [국제화](#국제화)
- [FAQ](#faq)
- [기여](#기여)
- [문서 탐색](#문서-탐색)
- [로드맵](#로드맵)
- [문의하기](#문의하기)
- [우리의 이야기 · 지후이AI의 탄생](#우리의-이야기--지후이ai의-탄생)
- [오픈소스 공동 구축 비전](#오픈소스-공동-구축-비전)
- [License](#license)
- [감사의 말](#감사의-말)

---

## 프로젝트 포지셔닝(필독)

> **한 줄 포지셔닝:IHUI-AI는 오픈소스 AI 상업용 통합 파운데이션(Open-Source AI Commercial-Grade Integrated Foundation)입니다 — 단일 AI 툴이 아니라 "완전히 상업화 가능한 AI 제품 하나를 구축"하는 데 필요한 모든 인프라(8단 프레임워크 + 118 모델 게이트웨이 + LangGraph+MCP+A2A 트리플 스택 + 상업적 루프 + 엔터프라이즈 보안 + 엔지니어링 게이트 + 옵저버빌리티)를 Apache 2.0 라이선스로 통째로 오픈소스화하여, 어떤 개인, 기업, 교육 기관, 콘텐츠 크리에이터든 Fork 후 5분 안에 자신만의 AI 상업 제품을 출시할 수 있게 합니다.**
>
> **가치 제안**:**하나의 저장소가 6-10개 독립 SaaS를 대체**(Stripe + Auth0 + Mailgun + Mixpanel + Dify + Claude Code + Khan Academy + 이케 + Notion AI), 월간 비용을 $300+에서 $0(셀프 호스팅)로 절감.

### 삼층 가치 피라미드

IHUI-AI의 포지셔닝은 "사용자 가치 → 제품 형태 → 기술 해자" 삼층 피라미드로 구성됩니다:

```
                 ┌─────────────────────────────────────────────────┐
   제 1 층       │  사용자 가치(Why)                                │
   사용자 가치   │  • 5분 만에 Fork에서 상용 AI 제품 출시           │
   (Why)         │  • 하나의 저장소로 6-10개 SaaS 대체, 월 $300+ 절약│
                 │  • 100% 데이터 주권, Apache 2.0 상업 친화적      │
                 │  • 5류 역할 수혜(개발자/중소기업/교육/크리에이터/기업)│
                 └─────────────────────────────────────────────────┘
                                        ▲
                 ┌─────────────────────────────────────────────────┐
   제 2 층       │  제품 형태(What)                                  │
   제품 형태     │  오픈소스 AI 상업용 통합 파운데이션              │
   (What)        │  • 6대 제품 카테고리 통합:                       │
                 │    ① AI 애플리케이션 개발 플랫폼(Dify/Coze/RAGFlow 대비)│
                 │    ② AI 코딩 CLI(Claude Code/Cursor 대비)       │
                 │    ③ 멀티단 프레임워크(Tauri/Expo/Taro/WXT 대비) │
                 │    ④ 상업 SaaS 파운데이션(Stripe+Auth0+Mixpanel 대비)│
                 │    ⑤ AI 교육 플랫폼(Khan Academy/Coursera 대비) │
                 │    ⑥ 콘텐츠 퍼블리싱 허브(이케/신미디어 매니저/Jasper 대비)│
                 │  • 하나의 저장소에 8단 코드, 툴 모음이 아닌 프리셋 제품│
                 └─────────────────────────────────────────────────┘
                                        ▲
                 ┌─────────────────────────────────────────────────┐
   제 3 층       │  기술 해자(How)                                   │
   기술 해자     │  • 8단 / 598 테이블 / 128+ 마이그레이션 / 4443 API 라우트│
   (How)         │  • LangGraph + MCP + A2A 트리플 스택 협업        │
                 │  • 16 공유 패키지 / 21 pre-commit 게이트 / 5개 언어 i18n│
                 │  • 3대 지주 옵저버빌리티 + 20 Grafana 대시보드   │
                 │  • 엔터프라이즈 보안 스택(RBAC + RLS + SSO + AES-256-GCM)│
                 │  • Apache 2.0 License, 상업적 제약 없음          │
                 └─────────────────────────────────────────────────┘
```

### IHUI-AI란 무엇인가

| 차원            | 포지셔닝                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **본질**        | 오픈소스 AI 상업용 통합 파운데이션(Open-Source AI Commercial-Grade Integrated Foundation)                                                                                                             |
| **비유**        | AI 애플리케이션계의 Kubernetes / Next.js Boilerplate / Linux 배포판 — "인프라 구축"을 3-6개월에서 5분으로 압축                                                                                        |
| **비교 레벨**   | 「AI 애플리케이션 개발 플랫폼 + AI 코딩 CLI + 멀티단 개발 프레임워크 + 상업 SaaS 파운데이션 + AI 교육 플랫폼 + 콘텐츠 퍼블리싱 허브」6대 카테고리를 동시에 아우름                                     |
| **대상 사용자** | 개인 개발자(프라이빗 AI 어시스턴트)/ 중소기업(AI 미들 플랫폼)/ AI 서비스 제공자(상업 제품)/ 교육 기관(AI 교육 풀스택)/ 콘텐츠 크리에이터(38 플랫폼 퍼블리싱)/ 기업 의사결정자(엔터프라이즈 AI 플랫폼) |
| **License**     | Apache 2.0(상업 친화적, 카피레프트 없음, 클로즈드 소스 상업 사용 허용)                                                                                                                                |
| **배포 모드**   | 완전 셀프 호스팅, Docker Compose 원클릭으로 14개 서비스 시작, 데이터 100% 주권, 자격증명 AES-256-GCM 암호화, 어떤 빅테크도 엿볼 수 없음                                                               |
| **코드 규모**   | 8단 코드 / 231 schema 파일 / 598 데이터베이스 테이블 / 128+ 마이그레이션 / 4443 API 라우트 / 250+ Web 페이지 / 16 공유 패키지 / 21 pre-commit 게이트 / 5개 언어 i18n parity                         |
| **대체 가치**   | Stripe($84/월)+ Auth0($35/월)+ Mailgun($35/월)+ Mixpanel($20/월)+ Dify($59/월)+ Claude Code($20/월)+ 이케($50/월)≈ $303/월, IHUI-AI 셀프 호스팅 $0/월                                                 |

### IHUI-AI가 아닌 것

- **ChatGPT 래퍼가 아닙니다** — 빌링/구독/멀티 테넌트/감사/RBAC를 갖춘 완전한 상업용 AI 애플리케이션 파운데이션으로, SaaS로 바로 만들 수 있습니다
- **단일 AI 대화 플랫폼이 아닙니다** — AI 대화, AI 코딩 CLI, AI 교육, AI 콘텐츠 퍼블리싱, AI Agent 마켓 5대 시나리오를 동시에 커버합니다
- **데모나 스캐폴드가 아닙니다** — 즤후이 AI 그룹(Zhihui AI Group)의 상업화 메인 플랫폼을 지원하는 프로덕션급 코드이며, 598 테이블이 실제 비즈니스 복잡도에 따라 설계되었습니다
- **SaaS 구독이 아닙니다** — 완전 셀프 호스팅, 100% 데이터 주권을 보유하며, 자격증명은 AES-256-GCM으로 암호화되고 외부로 전송되지 않습니다
- **수직적 툴이 아닙니다** — Dify는 AI 애플리케이션 오케스트레이션만, Claude Code는 CLI만, 이케(Yike)는 멀티 플랫폼 퍼블리싱만, RAGFlow는 RAG만, Khan Academy는 교육만 하는 것과 달리, IHUI-AI는 6대 카테고리 역량을 **하나의 Apache 2.0 저장소에 통합**합니다
- **LangChain/LlamaIndex 같은 개발 프레임워크가 아닙니다** — 그것들은 개발자용 "자동차 부품"이고, IHUI-AI는 "완성차 출고"로 비기술 팀도 바로 사용할 수 있습니다

### 비용 비교:IHUI-AI 셀프 호스팅 vs 동등 SaaS 스택

> 아래 비용은 2026년 7월 기준 각 SaaS 공식 사이트 공개 가격(월간 구독, 소형 팀 5인 + 월 1만 활성 사용자 시나리오)이며, 의사결정 참고용입니다.

| 역량 차원                | 동등 SaaS 조합                                                      | 월간 비용     | IHUI-AI 셀프 호스팅        |
| ------------------------ | ------------------------------------------------------------------- | ------------- | -------------------------- |
| **AI 대화 및 모델**      | OpenAI ChatGPT Team($25/인)+ Dify($59)                              | $184/월       | **$0**(모델비만)           |
| **AI 코딩 CLI**          | Claude Code($20)+ GitHub Copilot($19)+ Cursor($20)                  | $59/월        | **$0**(모델비만)           |
| **결제/구독/빌링**       | Stripe($84)+ Lemon Squeezy($5)                                      | $89/월        | **$0**                     |
| **인증/SSO/RBAC**        | Auth0($35)+ Clerk($25)                                              | $60/월        | **$0**                     |
| **이메일/SMS**           | Mailgun($35)+ Twilio($35)                                           | $70/월        | **$0**                     |
| **사용자 분석**          | Mixpanel($20)+ PostHog($0 오픈소스)                                 | $20/월        | **$0**(BI 내장)            |
| **AI 교육 플랫폼**       | Khan Academy(무료, 단 클로즈드 소스)+ Coursera for Business($70/인) | $350/월       | **$0**(오픈소스 맞춤 가능) |
| **콘텐츠 퍼블리싱 허브** | 이케($50)+ 신미디어 매니저($30)                                     | $80/월        | **$0**                     |
| **옵저버빌리티 스택**    | Datadog($15/호스트)+ Sentry($26)                                    | $101/월       | **$0**(오픈소스 스택)      |
| **합계**                 | 9개 SaaS                                                            | **$1,013/월** | **$0**(서버비만)           |
| **3년 총비용**           |                                                                     | **~$36,468**  | **~$1,080**(단일 VPS)      |

> **결론**:동등한 역량 조합의 경우, 동등 SaaS 월간 비용은 약 $1,013, 3년 $36,468; IHUI-AI 셀프 호스팅은 서버 비용만 약 $30/월, 3년 $1,080. **$35,000+를 절약하면서 100% 데이터 주권 + 완전한 맞춤 설정 역량을 보유**합니다.

### IHUI-AI의 고유 가치(오픈소스 생태계에서 드문 사례)

전면적인 시장 비교(40+ 국내외 제품 커버, 상세 비교는 아래 표 참조) 결과, 다음 역량 조합은 **글로벌 오픈소스 AI 프로젝트 중 동시 보유는 드문 사례입니다**:

1. **8단 전면 커버리지**:Web / API / AI 서비스 / CLI / 데스크톱 Tauri / 브라우저 확장 WXT / 모바일 RN / 위챗 미니앱 Taro — 동류 오픈소스 AI 프로젝트는 최대 2단(Dify/FastGPT), 8단(클로즈드 소스:ChatGPT 2단 / Coze 2단 / Claude Code 1단)
2. **LangGraph + MCP + A2A 트리플 스택 협업**:워크플로 + 툴 프로토콜 + Agent 상호운용 일체화, 타 오픈소스 AI 플랫폼은 최대 단일 스택(Langflow는 LangChain DAG만, Dify는 MCP/A2A 없는 자체 워크플로, LangChain/LlamaIndex는 프레임워크층만)
3. **자체 CLI, Claude Code 대항**:17 명령 + 13 내장 툴 + ACP Server + 6 소스 설정 가져오기(cc-switch / codex++ / Claude / Codex / Gemini / Hermes)+ Skills 시스템 — 오픈소스 AI 애플리케이션 플랫폼 중 자체 CLI를 갖춘 프로젝트는 드묾(Cursor / Copilot / Windsurf / Amazon Q / Cline / Aider / Cody는 모두 클로즈드 소스 또는 순수 CLI 툴)
4. **완전한 상업적 루프**:VIP / 구독 recurring / 지갑 / 포인트 / 환불 감사 / 인보이스 / 환율 / 8 결제 게이트웨이 / 분배 커미션 / 초대 리베이트 — 오픈소스 AI 플랫폼 중 금융급 상업적 루프 내장은 드묾(Dify/FastGPT/Langflow 모두 없음)
5. **38 플랫폼 원클릭 자동 퍼블리싱**:글 9 플랫폼 + 이미지 2 플랫폼 + 비디오 5 플랫폼 + AES-256-GCM 자격증명 암호화 + 38 adapter — 오픈소스 프로젝트 중 공식계정/Zhihu/CSDN/Juejin/Xiaohongshu/Weibo/Bilibili/YouTube/Douyin 등 38 플랫폼 완전 커버는 드묾(이케/신미디어 매니저는 클로즈드 소스 SaaS)
6. **AI 교육 풀스택**:강의 / 문제은행 / 시험 / SRS 간격 반복 / 라이브 / 학습 리포트 / 수료증 / 강사 / 학생 페이지 12 서브페이지 / 45 테이블 edu-full schema — 오픈소스 AI 플랫폼 중 완전한 AI 교육 풀스택 내장은 드묾(Khan Academy/Coursera는 클로즈드 소스 SaaS)
7. **엔터프라이즈 보안 스택**:RBAC + 멀티 테넌트 + RLS(Row-Level Security)+ SSO(OAuth2 + Apple + Google + PKCE)+ AES-256-GCM + JWT token-family + 워크스페이스 3 모드 권한 + 7 엔드포인트 런타임 가로채기 + 60s 감사 타임아웃 + GDPR + 2FA + IDOR 방호 — 오픈소스 AI 플랫폼 중 완전한 엔터프라이즈 보안 스택 내장은 드묾
8. **17 엔지니어링 게이트 + 11 마이그레이션 감사 + post-commit 자동 push**:메커니즘 수준에서 협업 사고를 원천 차단 — 오픈소스 AI 프로젝트 중 메커니즘급 엔지니어링 게이트 구현은 드묾(Dify/FastGPT는 기본 lint만)
9. **3대 지주 옵저버빌리티 + 20 Grafana 대시보드**:Prometheus + Grafana + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager — 오픈소스 AI 플랫폼 중 완전한 SRE급 옵저버빌리티 스택 내장은 드묾(타 프로젝트는 최대 기본 로그)
10. **5개 언어 i18n parity + 4 게이트 스크립트**:zh-CN / zh-TW / en / ko / ja 키 셋 강건 일관성, opencc 자형 감지 + 문자 범위 감지 + 깨진 기계번역 감지 — 오픈소스 AI 프로젝트 중 parity + 게이트급 i18n 구현은 드묾(타 프로젝트는 최대 중영문)

### 기억 포인트 슬로건(확산 가능)

| 슬로건                               | 가치 앵커                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **"하나의 저장소가 6개 SaaS 대체"**  | Stripe + Auth0 + Mailgun + Mixpanel + Dify + Claude Code 대체, 월 $300+ 절약                    |
| **"5분 만에 Fork에서 상용 출시"**    | Docker Compose 원클릭 14 서비스 시작, 클론부터 출시까지 최단 5분, 기존 방식 3-6개월             |
| **"AI 애플리케이션계의 Kubernetes"** | "인프라 구축"을 표준화, 재사용 가능하게, 어떤 팀이든 통일된 파운데이션 위에서 자신의 AI 앱 실행 |
| **"8단 + 118 모델 + 트리플 스택"**  | 8단 코드 + 118 모델 + LangGraph+MCP+A2A 트리플 스택, 오픈소스 AI 생태계 최다 커버              |
| **"Apache 2.0, 상업적 제약 없음"**   | License 상업 친화적, 카피레프트 제약 없음, 클로즈드 소스 상업 사용 허용, 기업 안심 Fork 가능    |
| **"데이터 100% 주권"**               | 완전 셀프 호스팅, 자격증명 AES-256-GCM 암호화, 외부 회신 없음, GDPR / 등급보호 요구 충족        |

### 6대 비교 카테고리와의 관계

IHUI-AI는 어떤 단일 프로젝트를 대체하려는 것이 아니라, 다음 6류 프로젝트의 역량을 **하나의 오픈소스 파운데이션에 통합**합니다:

| 비교 카테고리                     | 대표 제품                                                                                                                                                                                                                                                                                                                       | IHUI-AI 비교 역량                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI 애플리케이션 개발 플랫폼**   | Dify / FastGPT / Langflow / RAGFlow / Flowise / Coze(Kouzi)                                                                                                                                                                                                                                                                     | 118 모델 LiteLLM 게이트웨이 + LangGraph 워크플로 + 지식 베이스 RAG + pgvector 벡터 DB + 지식 그래프 + Agent Runtime + Persona                       |
| **AI 코딩 CLI / IDE**             | Claude Code / Cursor / Windsurf / GitHub Copilot / Copilot Workspace / Amazon Q Developer / Cody Sourcegraph / Cline / Aider / Devin / Tabnine / GitLab Duo / Gemini CLI / OpenCode / CodeGeeX / Continue / Roo Code / Codeium / JetBrains AI Assistant                                                                         | 자체 CLI 17 명령 + 13 내장 툴 + ACP Server(Zed/VSCode/Cursor 임베드)+ 6 소스 설정 가져오기 + Skills + CodeGraph + Worktree                           |
| **엔터프라이즈 AI Agent 플랫폼**  | Google Gemini Enterprise Agent Platform / OpenAI Agents SDK / Microsoft Copilot Studio / IBM watsonx.ai / Salesforce Agentforce / ServiceNow Now Assist / AWS Bedrock Agents / Crew                                                                                                                                             | LangGraph + MCP + A2A 트리플 스택 + Agent 마켓 + 개발자 센터 + Coze SDK 프록시 + OpenClaw + Crew 통합 + N8N 프록시                                   |
| **AI Agent 프레임워크(오픈소스)** | LangChain / LangGraph / LlamaIndex / AutoGen / CrewAI / AutoGPT / MetaGPT / smol agents / Semantic Kernel / Spring AI / Hugging Face Transformers Agents                                                                                                                                                                        | 트리플 스택 협업 + 완전한 Agent Runtime + Persona 레지스트리 + Agent 마켓 — 단순 프레임워크가 아닌 제품화 구현 방안                                  |
| **멀티단 개발 프레임워크**        | Tauri / Electron / Expo / React Native / Taro / WXT / Next.js / Remix / Nuxt / SvelteKit                                                                                                                                                                                                                                        | 8단 통일 아키텍처 + 16 공유 패키지 + 크로스 단말 타입 안전 + 공유 UI(`@ihui/ui-react` / `@ihui/ui-native` / `@ihui/design-tokens`)                   |
| **AI 교육 / 콘텐츠 플랫폼**       | Khan Academy / Coursera / edX / Google 교육 AI / 즈푸 AI 교육 / Xueersi AI / Jasper / Copy.ai / Rytr / WriteSonic / Notion AI / 이케 / 신미디어 매니저                                                                                                                                                                          | AI 교육 풀스택(강의/문제은행/시험/SRS/라이브/수료증)+ 38 플랫폼 원클릭 퍼블리싱 + 셀프미디어 워크벤치 + AI 뉴스 + AI 구직 + 숏드라마 + 비즈니스 명함 |
| **대형 모델 API 플랫폼**          | 해외:OpenAI Platform / Anthropic API / Google Vertex AI / AWS Bedrock / Azure AI Foundry / Mistral La Plateforme / Cohere / Together AI / Fireworks AI / Replicate<br>국내:바이두 첸판 / 알리바이바이리안 / 텐센트 후위안 / 바이트댄스 더우바오(화산방주)/ 즈푸 AI 플랫폼 / iFlytek 스파크 / 문샷 김 / DeepSeek / 상테크 일일신 | LiteLLM 통일 게이트웨이 + 118 모델 연동 + 스마트 라우팅 + 60% 캐시 적중 + 멀티 provider 어댑팅                                                      |
| **상업 SaaS 파운데이션**          | Stripe / PayPal / Lemon Squeezy / Paddle / Auth0 / Clerk / Firebase Auth / Supabase Auth / Mailgun / SendGrid / Postmark / Resend / Mixpanel / Amplitude / PostHog / Heap                                                                                                                                                       | VIP/구독/지갑/포인트/환불/인보이스/8 결제 게이트웨이 + JWT/SSO/RBAC + SMTP SMS + BI 대시보드 + 카나리 배포 — 4-6개 SaaS를 원스톱 대체                |

> **핵심 인사이트**:오픈소스 AI 생태계에서 IHUI-AI보다 **더 전문적인** 프로젝트(RAGFlow는 RAG 차원에서 더 깊고, Claude Code는 CLI 차원에서 더 성숙하고, LangChain은 프레임워크층에서 더 유연함)는 찾을 수 있지만, IHUI-AI보다 **더 포괄적인** 오픈소스 파운데이션은 찾을 수 없습니다 — 6대 카테고리 역량을 하나의 Apache 2.0 저장소에 통합하는 것이 IHUI-AI의 핵심 차별화입니다.
>
> **누구를 대체하는 것이 아니라, 6개 제품의 역량을 Apache 2.0 오픈소스로 공개하는 것입니다**:RAGFlow의 RAG가 필요하면 RAGFlow만 단독 사용해도 됩니다;Claude Code의 CLI가 필요하면 Claude Code만 단독 사용해도 됩니다;하지만 **완전히 상업화 가능한 AI 제품**(대화+코딩+교육+퍼블리싱+빌링+엔터프라이즈 보안)이 필요하다면, IHUI-AI는 글로벌 오픈소스 생태계에서 주목할 만한 선택지 중 하나입니다.

---

## 기능 개요(30초 안에 모든 역량 확인)

| 대분류                   | 모듈                           | 핵심 역량                                                                                                                                      |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI 대화 및 모델**      | 멀티 모델 대화                 | 118 모델 / 스마트 라우팅 / 60% 캐시 적중 / 스트리밍 SSE + WebSocket / 대화 즐겨찾기 / 히스토리 / 공유 / 템플릿                                |
|                          | AI 이미지 생성                 | 텍스트→이미지 / 이미지 편집 / 다중 해상도 / 멀티 모델(Stable Diffusion / DALL-E / Tongyi Wanxiang)                                             |
|                          | AI 오디오                      | TTS 스트리밍 합성 / ASR 음성 인식 / 음색 클론 / 양방향 실시간 음성(WebRTC PCM16 16kHz)                                                         |
|                          | AI 비디오 합성                 | 텍스트→비디오 / 비디오 편집 / 멀티 모델 혼합 편성 / 트랜스코딩 / 비디오 작업 관리                                                              |
|                          | AI 디지털 휴먼                 | Tencent Hunyuan 3D / AI 월드 / 디지털 휴먼 인터랙션                                                                                            |
|                          | AI 월드                        | ai-world-items + AI 랭킹 + 트렌드 동기화 + AI 모듈화(ai-modules) + AI 벤더 설정 센터(ai-vendor-configs)                                        |
|                          | AI 커리어                      | AI 구직 어시스턴트 / 이력서 최적화 / 모의 면접                                                                                                 |
|                          | AI 뉴스                        | AI 뉴스 aggreggation / 스마트 요약 / ai-feed                                                                                                   |
|                          | 사용자 단위 AI 설정            | 사용자 단위 모델 대화 선호도(ai-user-model-chat) / 사용자 장기 기억(user-memory) / 사용자 선호도(user-preferences)                             |
| **AI 워크플로**          | LangGraph                      | StateGraph 워크플로(plan → execute → summarize) + stub 모드                                                                                    |
|                          | MCP 툴 프로토콜                | 11 내장 툴 + 3 리소스 + 3 프롬프트 / 커스텀 툴 / 프로젝트 단위 MCP / mcp-extended                                                              |
|                          | A2A 프로토콜                   | Agent-to-Agent 연동 / Redis 영속화 + 메모리 폴백                                                                                               |
|                          | 지식 베이스 RAG                | 문서 벡터화 / 시맨틱 검색 / 인용 추적 / knowledge-base + knowledge-rag                                                                         |
|                          | 지식 그래프                    | knowledge-graph 스키마 + 노드-관계 그래프 / 문서 간 엔티티 링크(오픈소스 AI 플랫폼에서 희귀)                                                   |
|                          | pgvector 벡터 DB               | 0123_pgvector_embedding 마이그레이션 / 네이티브 PostgreSQL 벡터 인덱스 / 독립 벡터 DB 불필요                                                   |
|                          | 워크플로 오케스트레이션        | 시각화 워크플로 / CrewAI 통합 / N8N 프록시 / workflows                                                                                         |
|                          | 벡터 메모리                    | 코사인 유사도 시맨틱 검색 / 세션 간 장기 메모리 / vector-memory                                                                                |
| **멀티 에이전트 생태계** | 에이전트 마켓                  | 구매 / 심사 / 정산 / 출금 / 분류 / 추천 / 랭킹 / 큐레이션                                                                                      |
|                          | 개발자 센터                    | API Keys / 호출 로그 / 팀 관리 / 수익 분석 / 13 서브페이지                                                                                     |
|                          | Coze SDK 프록시                | Bot / 대화 / 워크플로 / 데이터셋 / 템플릿 / 변수 / 워크스페이스 / OAuth                                                                        |
|                          | OpenClaw                       | 오픈소스 Agent 프레임워크 연동 / clawdbot / openclaw-routes                                                                                    |
|                          | Skills 시스템                  | content_engine(build_gpt56_sol / export_csdn_md / full_audit / publish_pipeline) + koubo_workflow(10+ tools)                                   |
| **8 플랫폼 프레임워크**  | Web                            | Next.js 16 / 200+ 페이지 / PWA / SEO / 다크 모드 / 5개 언어                                                                                    |
|                          | API                            | Fastify 5 / 4443 라우트 / 25 WebSocket 엔드포인트 / 604 라우트 파일 / OpenAPI                                                                  |
|                          | AI 서비스                      | FastAPI + LangGraph + LiteLLM + MCP + A2A / 577 엔드포인트 / 5 provider 어댑터                                                                 |
|                          | CLI                            | Node.js / 17 명령 / 13 내장 툴 / 6 소스 설정 가져오기 / ACP Server                                                                             |
|                          | 데스크톱                       | Tauri 2 + Rust / 시스템 트레이 / 로컬 파일 접근                                                                                                |
|                          | 브라우저 확장                  | WXT / 컨텍스트 메뉴 / 사이드바 / Chrome + Edge + Firefox                                                                                       |
|                          | 모바일 RN                      | React Native + Expo EAS / iOS + Android / SSO                                                                                                  |
|                          | 미니앱                         | Taro 4 / 위챗페이 네이티브 통합 / 3개 언어(i18n)                                                                                               |
| **엔터프라이즈 역량**    | 워크스페이스 권한              | 3 모드 + 7 엔드포인트 런타임 가로채기 + 60s 감사 타임아웃 + workspace-ai-tasks                                                                 |
|                          | RBAC + 멀티 테넌트             | 역할 / 부서 / 조직 / 테넌트 격리 / 메뉴 권한 / data-scope 5단계                                                                                |
|                          | SSO 싱글 사인온                | OAuth 2.0 / Apple / Google / SSO 중계 로그인 / PKCE                                                                                            |
|                          | 빌링 및 구독                   | VIP 등급 / 구독 recurring / 지갑 / 포인트 / 환불 감사 / 인보이스 / 환율 / 8 결제 게이트웨이                                                    |
|                          | 카나리 배포                    | Canary / 그레이디언트 규칙 / A/B 테스트 / canary + ab-tests                                                                                    |
|                          | 데이터 컴플라이언스            | GDPR / 민감어 필터 / 콘텐츠 심사 / 감사 로그 / 데이터 내보내기                                                                                 |
| **콘텐츠 창작**          | 셀프미디어 워크벤치            | 공식계정 글 + 구두 스크립트 듀얼 파이프라인 / 슬래시 명령 / self-media-automation                                                              |
|                          | 38 플랫폼 자동 퍼블리싱        | 글 9 + 이미지 2 + 비디오 5 플랫폼 / 자격증명 AES-256-GCM 암호화 / 38 adapter                                                                   |
|                          | 뉴스 기사                      | 기사 / 뉴스 / 특집 / 태그 / 댓글 / 좋아요 / 즐겨찾기 / news-crawler                                                                            |
|                          | 숏드라마                       | 숏드라마 창작 및 관리 / drama                                                                                                                  |
|                          | 비즈니스 명함                  | 명함 생성 / 편집 / 즐겨찾기 / 공유 / business-cards                                                                                            |
| **AI 교육 풀스택**       | 강의 학습                      | 강의 / 챕터 / 학습 경로 / 학습 맵 / 진행 추적 / 노트 / zhs-course                                                                              |
|                          | 문제은행 및 시험               | 다양한 문제 유형 / 자동 채점 / 챕터 연습 / 오답 노트 / 시험지 업로드 / exam-marking                                                            |
|                          | **교무 및 출결**               | 학급 출결 규칙(지각/조퇴/결석)/ 결석 자동 보완 / 휴가 승인 트랜잭션 연동 / 일괄 호명 / CSV 내보내기 / 대리·본인·QR 3종 / attendance-rule       |
|                          | SRS 간격 반복                  | 에빙하우스 망각 곡선 / 스마트 복습 스케줄링                                                                                                    |
|                          | 라이브 강의                    | 출석 체크 / 인터랙션 / 다시보기 / AI 보조 / live-chat                                                                                          |
|                          | 학습 리포트                    | 행동 분석 / 개인화 제안 / 수료증 발급                                                                                                          |
|                          | 강사 관리                      | 강사 홈페이지 / 강의 연결 / education-platform                                                                                                 |
|                          | 학생 페이지                    | 12 서브페이지(질문/기사/서클/댓글/강의/리소스/노트/오프라인/시험지/오답노트/수료증)                                                            |
| **커뮤니티 인터랙션**    | 서클 광장                      | 서클 / 광장 / 질문답변 / 게시글 / 토픽 / 태그                                                                                                  |
|                          | 1:1 메시지                     | 1:1 개인 메시지 / 시스템 알림 / 멀티 단말 동기화 / private-letters                                                                             |
|                          | 팔로우 팬                      | 팔로우 / 팬 / 사용자 홈페이지 / 명함                                                                                                           |
|                          | 공유 초대                      | 초대 코드 / 공유 코드 / H5 공유 / 추천 커미션 / visit-tracking                                                                                 |
| **운영 성장**            | 포인트 출석                    | 매일 출석 / 작업 포인트 / 포인트 샵 / 교환 / point-redeem-items                                                                                |
|                          | 랭킹                           | 다차원 랭킹 / 주간·월간 차트 / 사용자 순위 / ranking                                                                                           |
|                          | 추첨 이벤트                    | 추첨 / 레드봉 / 보상 동영상 광고 / rewarded-video-ad                                                                                           |
|                          | 분배 커미션                    | 분배 시스템 / 커미션 플랜 / 출금 / 8 서브페이지 / commission                                                                                   |
|                          | 이벤트 공지                    | 이벤트 관리 / 공지 푸시 / Banner 캐러셀 / carousels                                                                                            |
| **고객 지원**            | 티켓 시스템                    | 티켓 제출 / 처리 / 평가 / FAQ / admin-asks + admin-faq                                                                                         |
|                          | 온라인 고객지원                | WebSocket 실시간 고객지원 / 1:1 세션 / customer-service                                                                                        |
|                          | 피드백 센터                    | 사용자 피드백 / 처리 상태 / 추적                                                                                                               |
| **운영 모니터링**        | BI 대시보드                    | 비즈니스 지표 시각화 / 데이터 분석 / bi-dashboard                                                                                              |
|                          | 에러 대시보드                  | 에러 aggregation / 알림 / 추적 / security-audit                                                                                                |
|                          | 작업 로그                      | 로그인 로그 / 작업 로그 / 콜백 로그 / audit + security-logs                                                                                    |
|                          | 모니터링 알림                  | Prometheus + Grafana(20 대시보드) + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                                                    |
| **엔지니어링 인프라**    | 데이터베이스                   | PostgreSQL 18 / **598 테이블** / 231 schema 파일 / **128+ 마이그레이션** / Drizzle ORM + RLS + 테넌트 라우팅 + pgvector                       |
|                          | 큐 캐시                        | Redis 7 + BullMQ / 독립 worker 프로세스(:8804)                                                                                                 |
|                          | 오브젝트 스토리지              | OSS 멀티 벤더 드라이버 / 자격증명 암호화 / 청크 업로드 / 파일 버전 / chunked-upload                                                            |
|                          | 이메일 SMS                     | SMTP / SMS 게이트웨이 / 이메일 템플릿 / 인증번호 / mail + message-templates                                                                    |
|                          | 국제화                         | 5개 언어 parity(zh-CN / zh-TW / en / ko / ja) + 19 i18n 툴체인 + 4 게이트 스크립트                                                             |
|                          | 엔지니어링 게이트              | 21 pre-commit 훅 + post-commit 자동 push + 11 마이그레이션 감사 + 9 PowerShell 시작                                                            |
|                          | 테스트 커버리지                | ~14839+ 케이스 + 400+ 케이스 / Vitest + Playwright + pytest + Locust 부하 테스트 + Lighthouse 성능                                                        |
|                          | 배포 운영                      | Docker Compose(14 서비스) / 블루그린 배포 / Nginx upstream 전환 / 헬스 체크 / 롤백 / 백업 / 인증서 갱신 cron                                   |
|                          | 성능 CI                        | Knip 미사용 코드 감지 + Lighthouse CI 성능 예산 + GitHub Act 로컬 CI                                                                           |
|                          | 마이크로서비스 엔지니어링 패턴 | Outbox 트랜잭션 아웃박스 + Refund DLQ 데드레터 큐 + Circuit Breaker 서킷 브레이커 + IDOR 보호 + WS Dedup 메시지 중복 제거 + Hot Config 핫 설정 |

---

## IHUI-AI를 선택하는 이유

| 차원                               | 역량                                                                                                                  | 산업 포지셔닝                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **플랫폼 커버리지**                | Web / API / AI 서비스 / CLI / 데스크톱 / 확장 / 모바일 RN / 미니앱 Taro                                               | 업계 최초 8 플랫폼 풀커버리지 AI 풀스택 플랫폼     |
| **모델 연동**                      | LiteLLM 게이트웨이로 118 모델 통합(글로벌 30+ / 중국 15+ / 클라우드 벤더 10+)                                        | 원스톱 연동, 스마트 라우팅 + 60% 캐시              |
| **AI 오케스트레이션 3스택**        | LangGraph(워크플로) + MCP(툴 프로토콜) + A2A(Agent 연동)                                                              | 워크플로, 툴, 에이전트 협업 일체화                 |
| **자체 CLI**                       | 17 명령 + 13 내장 툴 + ACP Server, Claude Code 대항                                                                   | 커맨드라인 네이티브 AI 코딩 경험                   |
| **CLI 설정 완벽 가져오기**         | cc-switch / codex++ / Claude / Codex / Gemini / Hermes 6 소스 원클릭 가져오기                                         | CLI 툴 간 설정 마이그레이션 비용 제로              |
| **엔터프라이즈 보안**              | RBAC + 워크스페이스 3 모드 권한 + 7 엔드포인트 런타임 가로채기 + 60s 감사 타임아웃                                    | 의사결정자급 리스크 컨트롤                         |
| **데이터 암호화**                  | AES-256-GCM(credentials 암호화) + JWT token-family 로테이션 + refresh 블랙리스트                                      | 금융급 데이터 보호                                 |
| **옵저버빌리티**                   | Prometheus + Grafana(**20 대시보드**) + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                       | 풀링크 지표 / 로그 / 추적 / 알림                   |
| **엔지니어링 게이트**              | 21 pre-commit + post-commit 자동 push + git-push-guard + 11 마이그레이션 감사                                         | 협업 사고 방지, 99.9% SLA                          |
| **국제화**                         | zh-CN / zh-TW / en / ko / ja 5개 언어 parity + 19 i18n 툴체인                                                         | 5개 언어 키 셋 강건 일관성                         |
| **데이터베이스**                   | **598 테이블 + 128+ 마이그레이션** + 231 schema 파일 + Drizzle ORM + RLS + 테넌트 라우팅 + pgvector                  | 단일 DB PostgreSQL 18, schema 격리                 |
| **API 규모**                       | 4443 라우트(api) + 577 엔드포인트(ai-service) + 25 WebSocket + 604 라우트 파일                                        | 원본 프로젝트 331 엔드포인트 대비 대폭 확장        |
| **비즈니스 커버리지**              | 15대 모듈 / 50+ 서브 기능 / **250+ Web 페이지**                                                                       | 하나의 플랫폼이 모든 AI 애플리케이션 시나리오 커버 |
| **공유 패키지**                    | 16 packages(auth/database/types/ui/sdk/api-client/context-compaction 등)                                              | 크로스 플랫폼 타입 안전 + 재사용                   |
| **성능 보장**                      | Knip 미사용 코드 + Lighthouse CI + Locust 부하 테스트                                                                 | 성능 예산 + 용량 추정                              |
| **배포 성숙도**                    | Docker Compose(14 서비스) + 블루그린 + Nginx upstream + 인증서 갱신 cron                                              | 프로덕션급 운영                                    |
| **마이크로서비스 엔지니어링 패턴** | Outbox 트랜잭션 아웃박스 + Refund DLQ 데드레터 큐 + Circuit Breaker 서킷 브레이커 + IDOR 보호 + WS Dedup + Hot Config | 프로덕션급 마이크로서비스 패턴                     |

---

## 유사 프로젝트와의 비교

### 대비 매트릭스 · 12열 횡단 비교(국내외 40+ 유명 제품 커버)

> 테이블 열이 많으므로, 데스크톱에서 횡단 스크롤하여 확인하는 것을 권장합니다. 모바일에서는 "IHUI-AI" 열과 "핵심 결론" 섹션만 보셔도 됩니다.

| 차원                   | IHUI-AI                                                     | OpenAI ChatGPT    | Dify                 | LangChain           | RAGFlow         | Coze(Kouzi)       | Claude Code       | Cursor            | GitHub Copilot     | Khan Academy            | Stripe+Auth0         |
| ---------------------- | ----------------------------------------------------------- | ----------------- | -------------------- | ------------------- | --------------- | ----------------- | ----------------- | ----------------- | ------------------ | ----------------------- | -------------------- |
| **비교 카테고리**      | 6대 카테고리 통합(애플리케이션+CLI+멀티단+상업+교육+콘텐츠) | 범용 AI 대화      | AI 애플리케이션 개발 | AI Agent 프레임워크 | RAG 지식 베이스 | AI 에이전트 SaaS  | AI 코딩 CLI       | AI 코딩 IDE       | AI 코딩 어시스턴트 | AI 교육 플랫폼          | 결제+인증 파운데이션 |
| **License**            | **Apache 2.0**                                              | **클로즈드 소스** | Apache 2.0           | MIT                 | Apache 2.0      | **클로즈드 소스** | **클로즈드 소스** | **클로즈드 소스** | **클로즈드 소스**  | **클로즈드 소스**(무료) | **클로즈드 SaaS**    |
| **셀프 호스팅**        | **완전 셀프 호스팅**                                        | 미지원            | Docker               | 라이브러리          | Docker          | 미지원            | N/A               | N/A               | N/A                | 미지원                  | N/A                  |
| **단말 커버리지**      | **8단**                                                     | 2단(Web/APP)      | 2단                  | 0단(라이브러리)     | 2단             | 2단               | 1단(CLI)          | 1단(IDE)          | 1단(IDE)           | 2단                     | 0단(라이브러리)      |
| **모델 연동**          | **118 모델** + LiteLLM                                     | OpenAI 계열       | 50+ 모델             | LangChain 어댑터    | 30+ 모델        | 바이트계          | Anthropic         | 멀티 모델         | OpenAI             | 없음                    | N/A                  |
| **워크플로 엔진**      | **LangGraph + MCP + A2A 트리플 스택**                       | 없음              | 자체 워크플로        | LangGraph           | 없음            | 자체 워크플로     | 없음              | 없음              | 없음               | 없음                    | N/A                  |
| **자체 CLI**           | **17 명령 + 13 툴 + ACP Server**                            | 없음              | 없음                 | 없음                | 없음            | 없음              | 네이티브 CLI      | 없음              | 없음               | 없음                    | N/A                  |
| **멀티 테넌트 + RBAC** | **완전**(5단계 + RLS)                                       | 단일 사용자       | 기본                 | 없음                | 기본            | SaaS 내           | 없음              | 없음              | 없음               | 학교 계정               | 기본                 |
| **빌링 구독**          | **완전**(VIP/지갑/포인트/환불/8 결제 게이트웨이)            | 구독($20-200)     | 없음                 | 없음                | 없음            | SaaS 내           | 없음              | 구독($20)         | 구독($10-39)       | 무료                    | 핵심(결제)           |
| **AI 교육**            | **풀스택**(강의/문제은행/시험/SRS/라이브/45 테이블)         | 없음              | 없음                 | 없음                | 없음            | 없음              | 없음              | 없음              | 없음               | 핵심(교육)              | 없음                 |
| **콘텐츠 퍼블리싱**    | **38 플랫폼 + 38 adapter**                                  | 없음              | 없음                 | 없음                | 없음            | 없음              | 없음              | 없음              | 없음               | 없음                    | 없음                 |
| **옵저버빌리티**       | **3대 지주 + 20 대시보드**                                  | -                 | 기본                 | 없음                | 기본            | -                 | 없음              | 없음              | 없음               | -                       | -                    |
| **엔지니어링 게이트**  | **17 훅 + 11 마이그레이션 감사 + 자동 push**                | -                 | 기본                 | 기본                | 기본            | -                 | 없음              | 없음              | 없음               | -                       | -                    |
| **i18n**               | **5개 언어 parity + 4 게이트**                              | 다국어            | 중영문               | 영문                | 중영문          | 다국어            | 영문              | 다국어            | 다국어             | 다국어                  | N/A                  |
| **데이터베이스**       | **598 테이블 + 128+ 마이그레이션 + RLS + pgvector**        | SaaS 내           | 기본                 | 없음                | pgvector        | SaaS 내           | 없음              | 없음              | 없음               | SaaS 내                 | SaaS 내              |
| **공유 패키지**        | **16 packages**                                             | 없음              | 없음                 | 1 라이브러리        | 없음            | -                 | 없음              | 없음              | 없음               | 없음                    | 1 SDK                |
| **월간 비용(5인)**     | **$0**(셀프 호스팅, 서버비만)                               | $125+             | $59+                 | $0(직접 통합)       | $0(직접 통합)   | SaaS 내           | $100              | $100              | $95                | 무료(교육)              | $149+                |

### 핵심 결론

**IHUI-AI는 누구를 대체하려는 것이 아니라, "완전한 AI 애플리케이션 하나를 구축"하는 데 필요한 6대 카테고리 인프라를 모두 오픈소스로 공개하는 것입니다.**

- **OpenAI ChatGPT 대비**:IHUI-AI는 완전 셀프 호스팅, 데이터 100% 주권, 빌링/교육/퍼블리싱 등 완전한 비즈니스 내장, ChatGPT는 클로즈드 소스 SaaS
- **Dify / FastGPT / Langflow / RAGFlow 대비**:IHUI-AI는 6단, 자체 CLI, 완전한 상업적 루프, AI 교육 풀스택, 38 플랫폼 퍼블리싱, 엔터프라이즈 보안 스택, SRE 옵저버빌리티가 추가됩니다
- **LangChain / LlamaIndex / AutoGen 대비**:그것들은 개발 프레임워크("자동차 부품")이고, IHUI-AI는 제품화 파운데이션("완성차 출고")으로 비기술 팀도 사용 가능
- **Claude Code / Cursor / GitHub Copilot / Windsurf / Amazon Q 대비**:IHUI-AI의 CLI는 코딩뿐 아니라 AI 애플리케이션 플랫폼 역량(대화/RAG/Agent/빌링)을 통합했으며, 전체 저장소가 Apache 2.0 오픈소스, 타 제품은 모두 클로즈드 소스
- **Coze(Kouzi) 대비**:IHUI-AI는 완전 셀프 호스팅, 데이터 주권 100%, License 상업 친화적이지만 Coze는 클로즈드 소스 SaaS로 데이터가 바이트댄스에 귀속
- **Khan Academy / Coursera 대비**:IHUI-AI의 AI 교육은 오픈소스 풀스택(강의/문제은행/시험/SRS/라이브/수료증)으로 2차 맞춤 가능, 타 두 제품은 클로즈드 소스 SaaS
- **Stripe + Auth0 + Mailgun + Mixpanel 대비**:IHUI-AI는 결제/인증/이메일/분석을 모두 프리셋하여 4-6개 SaaS를 원스톱 대체, 월 $300+ 절약

**핵심 차별화**:글로벌 오픈소스 AI 생태계에서 IHUI-AI보다 **더 전문적인** 프로젝트(RAGFlow는 RAG 차원에서 더 깊고, Claude Code는 CLI 차원에서 더 성숙하고, LangChain은 프레임워크층에서 더 유연하고, Khan Academy는 교육 콘텐츠에서 더 풍부함)는 찾을 수 있지만, IHUI-AI보다 **더 포괄적인** 오픈소스 파운데이션은 찾을 수 없습니다.

**한 줄 요약**:IHUI-AI는 OpenAI ChatGPT(대화)+ Dify(애플리케이션 오케스트레이션)+ Claude Code(CLI)+ Khan Academy(교육)+ Stripe(결제)+ 이케(퍼블리싱)의 **오픈소스 통합 대체 방안**입니다.

---

## IHUI-AI 사용자

이 프로젝트는 **지린성 아이즈히후이 인공지능 기술 유한공사**가 주도하여 개발했으며, 회사의 상업화 AI 플랫폼을 지원합니다. 더 많은 기업, 팀, 개인이 사용 사례를 제출해 주시길 환영합니다(이 섹션을 편집하고 PR을 제출하세요):

| 역할              | 시나리오                                     | 상태                |
| ----------------- | -------------------------------------------- | ------------------- |
| 아이즈히후이 AI   | 회사 메인 상업화 플랫폼(즤후이 AI 그룹)      | 프로덕션 사용       |
| AI 서비스 제공자  | 멀티 모델 프록시 + 빌링 + 구독 원스톱 출시   | 어댑팅 중           |
| 교육 기관         | AI 교육 풀스택(강의 / 문제은행 / 시험 / SRS) | 어댑팅 중           |
| 콘텐츠 크리에이터 | 38 플랫폼 원클릭 퍼블리싱                    | 어댑팅 중           |
| 개인 개발자       | 프라이빗 AI 어시스턴트 + 지식 베이스         | 여러분이 채워주세요 |

> 여러분의 회사나 프로젝트에서 IHUI-AI를 사용 중이신가요? PR을 제출해 이 리스트에 추가해 주세요.

---

## 5가지 대표 시나리오

### 시나리오 1: 개인 개발자가 프라이빗 AI 어시스턴트 구축

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && docker compose up -d
# 5분 후, 여러분은 다음을 갖게 됩니다(ChatGPT Team + Claude Code + Notion AI 3개 구독 대체, 월 $60+ 절약):
# - 118 모델을 지원하는 대화 인터페이스(ChatGPT Team $25/인 대체)
# - 프라이빗 지식 베이스 RAG + pgvector 벡터 DB(ChatGPT Plus 지식 베이스 대체)
# - 크로스 플랫폼 동기화(Web + 데스크톱 + 모바일 + 미니앱)
# - 자체 CLI 코딩 어시스턴트(Claude Code $20/월 대체)
# - 완전한 셀프 호스팅 데이터, 어떤 빅테크도 엿볼 수 없음
```

### 시나리오 2: 중소기업이 AI 미들 플랫폼 구축

- RBAC로 200명 직원 계정 발급, 부서별 워크스페이스 격리
- 7개 LLM 벤더 연동, 스마트 라우팅으로 가장 저렴한 모델 선택
- 빌링 시스템으로 부서별 과금, 인보이스 발행
- BI 대시보드로 어떤 부서가 가장 많이 사용하는지 확인
- 감사 로그로 컴플라이언스 요구 충족

### 시나리오 3: AI 서비스 제공자가 상업 제품 출시

- 멀티 모델 프록시 + 빌링 + 구독 + VIP + 지갑 + 포인트 재사용
- 에이전트 마켓으로 개발자 유치, 30% 커미션 추출
- API Keys + SDK로 고객이 여러분의 플랫폼 연동
- 38 플랫폼 퍼블리싱으로 콘텐츠 마케팅
- 1년이 아닌 1주 만에 출시

### 시나리오 4: 교육 기관이 교육 혁신

- AI 교육 풀스택으로 강의 + 문제은행 가져오기
- 학생은 SRS 간격 반복으로 자동 복습
- 강사는 AI 채점 + 학습 리포트 생성
- 라이브 + 출석 체크 + 인터랙션 + 다시보기
- 학습 행동 분석 + 개인화 제안
- 수료증 자동 발급

### 시나리오 5: 콘텐츠 크리에이터가 생산성 해방

- 셀프미디어 워크벤치에서 공식계정 글 + 구두 스크립트 작성
- 38 플랫폼에 원클릭 퍼블리싱(공식계정 / Zhihu / CSDN / Juejin / Xiaohongshu / Bilibili / YouTube / Douyin 등)
- 자격증명 AES-256-GCM 암호화 저장, 플랫폼 유출 없음
- 퍼블리싱 완료 시 WebSocket 실시간 알림

---

## 기술 스택

| 레이어           | 기술                                                                                   | 버전                                  |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| Monorepo         | pnpm workspace + Turborepo                                                             | pnpm 9.15 / turbo 2.3                 |
| 백엔드 API       | Fastify + @fastify/jwt + @fastify/websocket + Drizzle ORM + PostgreSQL                 | Fastify 5.1 / Drizzle 0.38 / PG 15    |
| 캐시 및 큐       | Redis 7 + BullMQ                                                                       | 독립 worker 프로세스(:8830)           |
| 프론트엔드 Web   | Next.js + React + Tailwind CSS + shadcn/ui                                             | Next 16.2.12 / React 19 / Tailwind 4  |
| 프론트엔드 상태  | @tanstack/react-query 5 + Zustand                                                      | 서버/클라이언트 상태 분리             |
| 국제화           | next-intl                                                                              | zh-CN / zh-TW / en / ko / ja 5개 언어 |
| AI 서비스        | FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO                                  | FastAPI 0.115 / LangGraph 0.2         |
| AI 프로토콜      | SSE(Agent 스트리밍) + WebSocket(채팅방 / 멀티 모델 스트리밍) + REST                    | 3 프로토콜 레이어 분리                |
| 데스크톱         | Tauri 2 + React 19 + Rust                                                              | 크로스 플랫폼 네이티브 경험           |
| 브라우저 확장    | WXT + React                                                                            | Chrome / Edge / Firefox               |
| 모바일           | React Native + Expo EAS                                                                | iOS / Android                         |
| 미니앱           | Taro 4 + React                                                                         | 위챗 미니앱                           |
| CLI              | Node.js + Commander + Inquirer                                                         | Claude Code 대항                      |
| 인증             | @ihui/auth 공유 패키지(JWT HS256 + token-family + OAuth2 + RBAC + data-scope 5단계)    | 크로스 플랫폼 통합 발급               |
| 검증             | Zod 3.24(백엔드) + React Hook Form(프론트엔드)                                         | 엔드투엔드 타입 안전                  |
| 로깅             | Pino 9.5(백엔드) + Python logging(AI 서비스) + Loki + Promtail                         | 구조화 + aggregation                  |
| 추적             | OpenTelemetry + Jaeger                                                                 | 분산 풀링크                           |
| 모니터링         | Prometheus + Grafana(20 대시보드) + Node Exporter + Alertmanager                       | 호스트 + 애플리케이션 + 알림          |
| 테스트           | Vitest(백엔드) + Playwright(E2E) + pytest(AI 서비스) + Locust(부하) + Lighthouse(성능) | 268 + 400+ 케이스                     |
| 미사용 코드 감지 | Knip                                                                                   | CI 게이트                             |
| Node             | >=20.10.0                                                                              | -                                     |
| Python           | 3.12+(AI 서비스 전용)                                                                  | -                                     |

---

## 8 플랫폼 아키텍처

```
                    ┌─────────────────────────────────────────────────┐
                    │       사용자 / 기업 / 개발자 / 교육 기관          │
                    └────────────┬───────────────────────┬────────────┘
                                 │                       │
        ┌────────────────────────┼───────────────────────┼────────────────────────┐
        │                        │                       │                        │
   ┌────▼─────┐  ┌──────────┐  ┌─▼────────┐  ┌──────────▼───┐  ┌──────────┐  ┌─▼────────┐
   │  Web     │  │ Desktop  │  │ Extension│  │  Mobile RN  │  │ Miniapp  │  │   CLI    │
   │ Next 16  │  │ Tauri 2  │  │  WXT     │  │  Expo EAS   │  │ Taro 4   │  │ Node.js  │
   │ :8801    │  │ + Rust   │  │          │  │ iOS/Android │  │ 위챗미니앱 │  │ ACP+Skl │
   └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │               │             │             │
        └─────────────┴─────────────┴───────┬───────┴─────────────┴─────────────┘
                                           │  HTTPS / WebSocket / SSE / ACP
                                  ┌────────▼─────────┐
                                  │   apps/api       │  Fastify 5 + Drizzle ORM
                                  │   :8802          │  4443 라우트 + 25 WS + 604 라우트 파일
                                  └────┬───────┬─────┘
                                       │       │
                          ┌────────────▼─┐   ┌─▼──────────────┐
                          │  PostgreSQL  │   │  apps/ai-service│  FastAPI + Socket.IO
                          │  15 (598 표) │   │  :8803          │  LangGraph + LiteLLM + MCP + A2A
                          └──────────────┘   └────┬────────────┘  5 provider + 38 publish adapter
                                                  │
                                            ┌─────▼─────┐  ┌──────────┐
                                            │  Redis 7  │  │ Worker   │  BullMQ 독립 프로세스
                                            │ Pub/Sub   │  │ :8830    │  비동기 작업 스케줄링
                                            └───────────┘  └──────────┘
```

### 8 플랫폼 역할

| 플랫폼        | 디렉토리             | 기술 스택                       | 역할                                                                                      |
| ------------- | -------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| **Web**       | `apps/web/`          | Next.js 16 + React 19           | 메인 프론트엔드, 200+ 페이지, 5개 언어 i18n, PWA, SEO                                     |
| **API**       | `apps/api/`          | Fastify 5 + Drizzle             | 비즈니스 관리 + 멀티 벤더 프록시 + 인증 + WebSocket, 4443 라우트 / 604 라우트 파일        |
| **AI 서비스** | `apps/ai-service/`   | FastAPI + LangGraph + Socket.IO | LLM 게이트웨이 + Agent 실행 + MCP 툴 + A2A 프로토콜 + 38 퍼블리싱 adapter, ~577 엔드포인트 |
| **CLI**       | `apps/cli/`          | Node.js + Commander             | 자체 커맨드라인 AI 코딩 어시스턴트, 17 명령 + 13 툴 + ACP Server + 6 소스 설정 가져오기   |
| **데스크톱**  | `apps/desktop/`      | Tauri 2 + Rust + React          | 크로스 플랫폼 데스크톱 앱, 시스템 트레이 + 로컬 파일 접근                                 |
| **확장**      | `apps/extension/`    | WXT + React                     | 브라우저 확장, 컨텍스트 메뉴 + 사이드바 + Chrome/Edge/Firefox                             |
| **모바일**    | `apps/mobile-rn/`    | React Native + Expo EAS         | iOS / Android 네이티브 앱 + SSO                                                           |
| **미니앱**    | `apps/miniapp-taro/` | Taro 4 + React                  | 위챗 미니앱, 위챗페이 네이티브 통합 + 3개 언어 i18n                                       |

### 사이드바 도메인 허브와 도메인 진입 페이지(2026-10-19 제정, 2026-10-23 에 AI·개인 도메인 추가)

사이드바는 수많은 1 단계 메뉴를 **도메인 진입점**으로 수렴하고, 각 도메인의 모든 페이지는 카드 그리드 진입 페이지가 받아 줍니다. 기존 경로는 옮기지 않습니다(`CategoryShell` 은 Next.js layout 으로 자기 디렉터리 부분 트리만 덮으므로, 디렉터리를 옮기면 URL 이 바뀝니다). 따라서 진입 페이지는 정리와 2 단계 이동만 담당합니다.

- **기능 설명**:다섯 장의 진입 페이지는 전부 `apps/web/src/components/layout/DomainHub.tsx` 단일 렌더러를 거치고, 항목은 `apps/web/src/components/sidebar/nav-data.ts` 의 `*_HUB_ITEMS` 에서 가져옵니다(단일 진실 근원, 페이지 쪽에서 목록을 베끼지 않음). 가시성은 `useNavVisibilityFilter`(`apps/web/src/components/sidebar/use-nav-visibility.ts`)가 일원 판정합니다 —— `adminOnly`/`permission` 은 「볼 수 있는지」를, `advancedOnly` 는 「일반 사용자에게 보여줄지」를 판정하며, 사이드바와 같은 기준을 쓰므로 페이지 안에서 재구현하지 않습니다.
- **사용 방법**:아래 표의 URL 로 바로 들어가거나 사이드바의 도메인 진입점에서 카드로 2 단계 진입합니다. 티어(간결 모드)는 「설정 → 사이드바 티어」에서 조정하고 `user_preferences` 의 `group=preferences` 에 `navTiers` 로 저장됩니다.

| 진입 URL | 항목 출처 | 소속 엔드 |
| -------- | --------- | --------- |
| `/domains/ai` | `AI_HUB_ITEMS` | web(Next.js, 플랫폼 전용) |
| `/domains/personal` | `PERSONAL_HUB_ITEMS` | web(Next.js, 플랫폼 전용) |
| `/domains/content` | `CONTENT_HUB_ITEMS` | web(Next.js, 플랫폼 전용) |
| `/domains/edu` | `EDU_HUB_ITEMS` | web(Next.js, 플랫폼 전용) |
| `/domains/trade` | `TRADE_HUB_ITEMS` | web(Next.js, 플랫폼 전용) |

- **소속 엔드**:web 전용(데스크톱은 같은 Web 화면을 재사용합니다. 미니프로그램 / RN 은 각자 내비게이션 구현).

### 사용자 측 읽기 전용 및 무인증 엔드포인트(2026-10-23 §21 에 따라 첫 등록, 그전까지 README 에 한 줄도 없었음)

| 엔드포인트 | 메서드 | 인증 | 응답 모양 | 소속 엔드 / 소비 측 |
| ---------- | ------ | ---- | --------- | ------------------- |
| `/api/goods/select` | GET | 공개(`zhs_product.status = 1` 인 진열 상품 카탈로그만 쓰고, 사용자 개인정보 필드는 포함하지 않음) | `{ code, message, data: { list, total, page, pageSize } }`. `page` 기본값은 1, `pageSize` 는 1..100 이고 기본값은 20 | api + mobile-rn `CartScreen` + 미니프로그램 `pkg-shop/cart`(`packages/api-client/src/endpoints/goods.ts` 의 `selectGoods()` 경유) |
| `/api/sign-ups` | GET | 로그인 필요. 소유권은 handler 안에서 검증합니다 —— `?userId` 가 본인 것이 아니면서 시스템 관리자가 아니면 403(인증은 인가가 아님) | `{ code, message, data: { list: [{ id, targetTitle, targetType, status, createdAt }] } }`, status 는 `draft/published/rejected/completed` 로 정규화 | api + web `apps/web/app/(main)/user/sign-up/page.tsx`. 데이터 원천은 `lesson_sign_ups` 와 `exam_signups` 두 표 집계 |
| `/api/auth/wechat/mini/one-tap-login` | POST | **무인증**(분당 5 회 유량 제한). 전화번호도 openId 도 WeChat 쪽의 일회용 code 로 교환해 오므로, 클라이언트 자가 보고는 믿지 않습니다 | 성공 시 `{ ...tokens, user }` 를 돌려줍니다(token 과 함께 user 반환). 미설정 ⇒ 503, code 교환 실패 ⇒ 401, openId 가 이미 다른 계정에 묶여 있음 ⇒ 409, 계정 비활성 ⇒ 403 | api + 미니프로그램 `apps/miniapp-taro`(원탭 로그인 버튼) |

- **기능 설명**:`/goods/select` 는 장바구니의 상품 페이지네이션 읽기 다리, `/sign-ups` 는 강의 신청과 시험 신청을 「내 신청」 하나의 목록으로 집계, `/auth/wechat/mini/one-tap-login` 은 새로 연 엔드포인트 입니다. 이전에 `/mini/login` 은 신규 사용자에게 `{needPhone:true, openId}` 만 돌려주고 token 을 발급하지 않았고, `/mini/phone` 은 로그인을 요구하면서도 token 을 반환하지 않았으므로, 이 사슬은 구조적으로 통할 수 없었습니다(검증 사례는 `apps/api/src/routes/__tests__/wechat-mini-one-tap-login.test.ts`).
- **사용 방법**:세 개 모두 `apps/api/src/routes/index.ts` 에 등록했습니다. `goods.ts` 는 prefix 를 `/api` 에, `sign-ups.ts` 는 `/api/sign-ups` 에, 로그인 다리는 auth 접두사에 두었습니다. 입력은 Zod 로 검증하고, 원탭 로그인 입력은 `{ loginCode, phoneCode }` 의 `strictObject` 이므로 알 수 없는 키는 즉시 400 입니다.
- **소속 엔드**:백엔드 `apps/api`. 소비 측은 위 표의 소속 엔드 열과 같습니다(web / mobile-rn / 미니프로그램).

### 프로젝트 상태 매트릭스(투명 라벨링, 2026-07-22 확인)

> **각 클라이언트의 완성도를 공개적으로 표시하는 이유**: AI 검색 도구와 개발자가 **실제** 상태를 확인할 수 있도록 합니다. "8 클라이언트 전면 커버리지"를 보고 코드 grep으로 차이를 발견하여 "프로젝트 과장"으로 판단되는 것을 방지합니다. 클라이언트 간 완성도 불균형은 현재의 현실이며, 우리는 투명성을 선택합니다.

| 클라이언트    | 디렉토리             | 완성도             | 코드 규모                          | 테스트 커버리지      | 핵심 시나리오                            |
| ------------- | -------------------- | ------------------ | ---------------------------------- | -------------------- | ---------------------------------------- |
| **Web**       | `apps/web/`          | 🟢 프로덕션급      | 200+ 페이지 / 전체 비즈니스        | 63 e2e spec + Vitest | 메인 프론트엔드, 모든 비즈니스 모듈      |
| **API**       | `apps/api/`          | 🟢 프로덕션급      | 4443 라우트 / 604 라우트 파일      | 237 .test.ts         | 비즈니스 관리 + 인증 + 빌링 + WebSocket  |
| **AI 서비스** | `apps/ai-service/`   | 🟢 프로덕션급      | 21 LangGraph 파일 / 577 엔드포인트 | pytest + 통합 테스트 | LLM 게이트웨이 + Agent 실행 + MCP + A2A  |
| **CLI**       | `apps/cli/`          | 🟡 핵심 시나리오급 | ~1500줄 / 17 명령 / 13 툴          | 단위 테스트          | 자체 개발 AI 코딩 어시스턴트, ACP Server |
| **데스크톱**  | `apps/desktop/`      | 🟡 핵심 시나리오급 | Tauri 2 + Rust + React             | 기본 테스트          | 시스템 트레이 + 로컬 파일 + WorkPanel    |
| **확장**      | `apps/extension/`    | 🟡 핵심 시나리오급 | WXT + React                        | 기본 테스트          | 컨텍스트 메뉴 + 사이드바 + 브라우저 제어 |
| **모바일 RN** | `apps/mobile-rn/`    | 🟡 핵심 시나리오급 | Expo EAS + iOS/Android             | 기본 테스트          | Chat + WorkPanel + SSO                   |
| **미니앱**    | `apps/miniapp-taro/` | 🟡 핵심 시나리오급 | Taro 4 + 위챗페이                  | 기본 테스트          | Chat + WebView + 위챗페이                |

**완성도 정의**:

- 🟢 **프로덕션급**: 전체 비즈니스 페이지 + 전체 테스트 커버리지 + 상업용 메인 플랫폼에 이미 사용 중
- 🟡 **핵심 시나리오급**: 핵심 Chat / WorkPanel / SSO 등 핵심 경로는 연결되었으나, 비즈니스 페이지 커버리지는 Web보다 낮음, 2차 개발로 보완 적합

**멀티 클라이언트 동기화 개발 규칙**: 이 프로젝트의 [AGENTS.md §9](./AGENTS.md)는 "모든 작업은 기본적으로 전체 클라이언트 연결"을 의무화하며, 새로운 기능은 영향받는 모든 클라이언트에 동기화되어야 합니다(플랫폼 독점 면제 제외).

---

## 프로젝트 구조

```
IHUI-AI/
├── apps/
│   ├── ai-service/          # AI 서비스 (FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO)
│   ├── api/                 # 백엔드 API (Fastify 5 + Drizzle, 4443 라우트, 604 라우트 파일)
│   ├── cli/                 # 자체 CLI (17 명령 + 13 툴 + ACP Server, Claude Code 대항)
│   ├── desktop/             # 데스크톱 (Tauri 2 + Rust + React)
│   ├── extension/           # 브라우저 확장 (WXT + React, Chrome/Edge/Firefox)
│   ├── miniapp-taro/        # 위챗 미니앱 (Taro 4 + React)
│   ├── mobile-rn/           # 모바일 (React Native + Expo EAS)
│   └── web/                 # 프론트엔드 (Next.js 16 + React 19, 200+ 페이지)
├── packages/                # 16개 공유 패키지
│   ├── api-client/          # @ihui/api-client (68 엔드포인트 수기 TS SDK)
│   ├── auth/                # @ihui/auth (JWT + token-family + OAuth2 + RBAC + data-scope)
│   ├── context-compaction/  # @ihui/context-compaction (컨텍스트 압축)
│   ├── database/            # @ihui/database (Drizzle, 598 테이블, 128+ 마이그레이션, RLS, 테넌트 라우팅, pgvector)
│   ├── eslint-config/       # @ihui/eslint-config
│   ├── sdk/                 # @ihui/sdk (수기 TS SDK)
│   ├── tsconfig/            # @ihui/tsconfig
│   ├── types/               # @ihui/types
│   ├── ui-native/           # @ihui/ui-native (React Native)
│   └── ui-react/            # @ihui/ui-react (Web/데스크톱/확장 공유 React shadcn/ui 컴포넌트)
├── deploy/
│   ├── nginx/               # Nginx 리버스 프록시 + 블루그린 upstream + SSL/security/rate-limit
│   ├── scripts/             # deploy.sh / rollback.sh / health-check.sh / backup-db.sh / restore-db.sh / deploy_certs.sh
│   ├── cron/                # Let's Encrypt 인증서 자동 갱신
│   ├── docker/              # Dockerfile.api / .web / .cli / .migrate(이미지 빌드, context는 저장소 루트)
│   ├── s3-lifecycle.yml     # S3 오브젝트 스토리지 라이프사이클 규칙
│   └── setup-github-secrets.sh  # GitHub Actions secrets 일괄 설정
├── docs/                    # 35개 문서 센터:아키텍처 / 개발 / 테스트 / API / 데이터베이스 / 인증 / AI 서비스 / 다단 / 모니터링 / 게이트키핑 / i18n / 성능 / SDK / CLI / 릴리스 / 트러블슈팅 / FAQ(docs/README.md 색인 참조)
├── monitoring/              # Grafana(20 대시보드) + Loki + Prometheus + Promtail + otel-collector + Alertmanager
├── scripts/                 # 17 게이트 + 19 i18n + 11 마이그레이션 감사 + 9 PowerShell 시작 + locustfile.py 부하 테스트 + 운영 툴
├── server-docs/             # 멀티 테넌트 설계 문서(MULTI_TENANT.md)
├── .github/workflows/       # 4개 CI:build / ci / e2e / knip + GitHub Act 로컬 CI
├── .github/loop-runtime/    # loop-daily-triage CI 실행 상태(STATE.md + loop-run-log.md)
├── .husky/                  # Git hooks (commit-msg + post-commit + pre-commit + pre-push + post-checkout + post-merge)
├── docker-compose.yml       # 14 서비스 오케스트레이션(7 비즈니스 + 7 모니터링)
├── knip.jsonc               # Knip 미사용 코드 감지 설정
├── AGENTS.md                # AI Agent 협업 규범(21절 강제 규칙)
├── PROJECT_PLAN.md          # 프로젝트 유일 작업 계획 문서
├── LICENSE                  # Apache 2.0
├── README.md                # 간체 중국어
├── README.en.md             # English
├── README.ko.md             # 한국어(이 파일)
└── README.ja.md             # 日本語
```

---

## 핵심 역량 상세(15대 모듈 · 사용자 역할별 그룹)

### A. AI 역량 레이어(최종 사용자 대상)

#### A1. 100+ LLM 원스톱 연동

LiteLLM 게이트웨이로 통합 연동, 스마트 라우팅 + 60% 캐시 적중:

| 카테고리          | 모델                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| **글로벌 모델**   | OpenAI GPT / Anthropic Claude / Google Gemini / xAI Grok / Groq / OpenRouter / Mistral / StepFun         |
| **중국 모델**     | Zhipu AI GLM / Tongyi Qianwen / Doubao / DeepSeek / Moonshot AI Kimi / StepFun / Baichuan / Yi / MiniMax |
| **클라우드 벤더** | Alibaba Cloud / Tencent Cloud / Huawei Cloud / Volcengine / Baidu Cloud / AWS Bedrock / Azure OpenAI     |
| **멀티모달**      | 텍스트 / 이미지 / 음성(STT + TTS) / 비디오 / 임베딩 벡터 / 3D 디지털 휴먼(Tencent Hunyuan)               |

**ai-service providers 어댑터**(`apps/ai-service/app/providers/`):base_provider + openai_provider + anthropic_provider + gemini_provider + stepfun_provider 5개 어댑터.

#### A2. LangGraph + MCP + A2A 3스택 협업

| 스택                | 역량                                                                                                                                                                                                                                | 구현 위치                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **LangGraph**       | StateGraph 워크플로(plan → execute → summarize), stub 모드 지원으로 API key 없이도 개발 가능                                                                                                                                        | `services/langgraph_service.py` + `agent_graph.py` + `agent_loop.py` + `agent_orchestrator.py` |
| **MCP**             | 11 내장 툴(search_codebase / read_file / write_file / run_command / web_search / git_operations / db_query / analyze_code / generate_test / refactor_code / file_search) + 3 리소스 + 3 프롬프트 + 프로젝트 단위 MCP + mcp-extended | `routers/mcp.py` + `services/mcp_server.py`                                                    |
| **A2A**             | Agent-to-Agent 프로토콜, Redis 영속화 + 메모리 폴백, 에이전트 간 상호 호출                                                                                                                                                          | `routers/a2a.py` + `services/a2a_service.py`                                                   |
| **벡터 메모리**     | 임베딩 + 코사인 유사도 시맨틱 검색, 세션 간 장기 메모리                                                                                                                                                                             | `services/vector_memory.py` + `memory.py` + `project_memory.py`                                |
| **지식 베이스 RAG** | 문서 벡터화 / 시맨틱 검색 / 인용 추적                                                                                                                                                                                               | `services/rag.py` + `api/v1/rag.py` + schema `knowledge-base.ts`                               |
| **Persona**         | 역할 정의 레지스트리, 커스텀 Agent 페르소나                                                                                                                                                                                         | `routers/personas.py` + `services/persona_registry.py`                                         |
| **Agent Runtime**   | SSE 스트리밍 + WebSocket, plan/execute/summarize + interrupt/continue/cancel                                                                                                                                                        | `routers/agent_runtime.py`                                                                     |

#### A3. 멀티모달 AI 창작

| 역량                   | 엔드포인트 / 구현                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| **텍스트→이미지**      | 멀티 모델(Stable Diffusion / DALL-E / Tongyi Wanxiang) / 다중 해상도 / 배치 / image-gen-favorites |
| **이미지 편집**        | 부분 재페인트 / 스타일 전이 / 배경 제거 / HD 업스케일                                             |
| **TTS 스트리밍 합성**  | 12+ 음색 / 다국어 / WebSocket 스트리밍 / 중단 제어 / `ws/tts/stream`                              |
| **ASR 음성 인식**      | 실시간 전사 / 파일 전사 / 다국어 / `voice_stt.py`                                                 |
| **음색 클론**          | 짧은 오디오 샘플 → 커스텀 음색 / `ws/timbre/generate`                                             |
| **양방향 실시간 음성** | WebRTC PCM16 16kHz / ASR + LLM + TTS 폐루프 / `webrtc-voice.ts`                                   |
| **텍스트→비디오**      | 멀티 모델 혼합 편성 / 비디오 편집 / 비디오 합성 / 트랜스코딩 / ai-generation/video-tasks          |
| **AI 디지털 휴먼**     | Tencent Hunyuan 3D / AI 월드 / 디지털 휴먼 인터랙션 / `tencent-hunyuan-3d.ts`                     |
| **AI 커리어**          | 이력서 최적화 / 모의 면접 / 커리어 제안 / `ai-career/`                                            |
| **AI 뉴스**            | AI 뉴스 aggregation / 스마트 요약 / `ai-feed.ts` + `ai-feed-posts.ts`                             |

### B. AI 워크플로 및 개발자(개발자 대상)

#### B1. 자체 CLI(Claude Code 대항)

`apps/cli/`는 ACP(Agentic Coding Protocol) Server + 17 명령 + 13 내장 툴을 제공합니다:

**명령 목록:**

| 명령                       | 용도                                                                         |
| -------------------------- | ---------------------------------------------------------------------------- |
| `ihui` (인자 없음)         | 인터랙티브 REPL                                                              |
| `ihui "<prompt>"`          | 직접 작업 실행(단일 턴)                                                      |
| `ihui chat`                | 멀티 턴 대화 모드                                                            |
| `ihui agent [task]`        | Agent 자율 멀티스텝 실행(--json headless)                                    |
| `ihui init`                | AGENTS.md 템플릿 생성(--force 덮어쓰기)                                      |
| `ihui sessions`            | 히스토리 세션 목록                                                           |
| `ihui mcp list/add/remove` | MCP 서버 관리(stdio/http/sse)                                                |
| `ihui capabilities`        | 역량 서브명령                                                                |
| `ihui checkpoint`          | 체크포인트 서브명령                                                          |
| `ihui hooks`               | Git hooks 서브명령                                                           |
| `ihui import`              | 6 소스 설정 가져오기(cc-switch / codex++ / Claude / Codex / Gemini / Hermes) |
| `ihui skills list/show`    | .ihui/.agents/.claude/.cursor 4단계 디렉토리 평면 skills 로드                |
| `ihui settings init/path`  | ~/.ihui/settings.json 통합 설정                                              |
| `ihui acp`                 | ACP Server 시작(Zed/VSCode/Cursor 에디터 임베드)                             |
| `ihui audit query/stats`   | 감사 로그 조회/통계                                                          |

**13 내장 툴**(`apps/cli/src/tools/`):ask-user / builtins / clipboard / codegraph / fetch-url / file-edit / git / hub/adapter / mcp-oauth / run-tests / subagent / todo-write / web-search

**Skills 시스템**:4단계 디렉토리 평면 로드(`.ihui` / `.agents` / `.claude` / `.cursor`)

**기타 모듈**:acp/server / checkpoints / codegraph / commands / config / fs-watcher / hooks / i18n / memory / mermaid / personas / plan / plugins / sandbox / sessions / subagents / telemetry / tools / util / voice + audit / compaction-v2 / context / crash-handler / headless-format / highlight / interjection / prompt-queue / redact / reminders / stream-chunk / updater / worktree

#### B2. 엔터프라이즈급 워크스페이스 권한

3가지 권한 모드 + 7 엔드포인트 런타임 가로채기 + 60s 감사 타임아웃:

| 모드                 | 동작                                                  |
| -------------------- | ----------------------------------------------------- |
| `default`            | 모든 FS 호출이 수동 감사 팝업 트리거                  |
| `accept-edits`       | 화이트리스트 규칙 매칭 시 허용, 미매칭 시 팝업 트리거 |
| `bypass-permissions` | 전부 허용(신뢰 환경에서만 사용)                       |

- 7개 FS 엔드포인트 전부 연동:`/fs/read` `/fs/write` `/fs/edit` `/fs/delete` `/fs/grep` `/fs/glob` `/fs/run`
- WebSocket 실시간 권한 요청 푸시, 60s 무응답 시 자동 거절
- workspace-ai-tasks schema로 작업 단위 권한 격리 지원

#### B3. 멀티 에이전트 비즈니스 관리

완전한 에이전트 마켓 + 개발자 생태계:

| 모듈                      | 역량                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **에이전트 마켓**         | 구매 / 심사 / 정산 / 출금 / 분류 / 추천 / 랭킹 / 큐레이션 / agent-commerce + agent-billings + agent-reviews                                                                                                                                                    |
| **개발자 센터**           | API Keys / 호출 로그 / 팀 관리 / 수익 분석 / 개발자 인증 / 13 서브페이지                                                                                                                                                                                       |
| **Coze SDK 프록시**       | Bot / 대화 / 워크플로 / 데이터셋 / 템플릿 / 변수 / 워크스페이스 / OAuth / coze-test + coze-ecosystem + coze-variables                                                                                                                                          |
| **OpenClaw**              | 오픈소스 Agent 프레임워크 연동 / clawdbot + openclaw-routes + openclaw-items                                                                                                                                                                                   |
| **Crew 통합**             | CrewAI 멀티 에이전트 협업 / crew.ts                                                                                                                                                                                                                            |
| **N8N 프록시**            | N8N 워크플로 플랫폼 리버스 프록시 / n8n-proxy.ts                                                                                                                                                                                                               |
| **Skills 시스템**         | content_engine(build_gpt56_sol / export_csdn_md / full_audit / publish_pipeline) + koubo_workflow(10+ tools 포함 koubo_quality_gate / koubo_validate / hot_topic_coverage_gate / archive_daily / project_hygiene / pre_publish_check / topic_pool / x_sources) |
| **MCP 확장**              | mcp-servers schema + mcp-extended 라우트 + 커스텀 툴 등록                                                                                                                                                                                                      |
| **Persona**               | 역할 정의 레지스트리 / personas.py + persona_registry.py                                                                                                                                                                                                       |
| **Socket.IO 호환 레이어** | sio/handlers.py 구버전 coze_zhs_py 클라이언트 호환                                                                                                                                                                                                             |

### C. 콘텐츠 창작 및 교육(크리에이터 및 교육자 대상)

#### C1. 콘텐츠 창작 및 멀티 플랫폼 퍼블리싱

- **셀프미디어 워크벤치**:공식계정 글 + 구두 스크립트 듀얼 파이프라인, AI 대화창 슬래시 명령(`/wechat-article` / `/koubo-script`) 또는 부가 패널 버튼 듀얼 엔트리로 호출
- **38 플랫폼 원클릭 자동 퍼블리싱**(38 adapter는 `apps/ai-service/app/services/publish/`):

| 타입            | 플랫폼                                                          |
| --------------- | --------------------------------------------------------------- |
| 글 9 플랫폼     | WordPress / Medium / 공식계정 / Toutiao / Zhihu / CSDN / Juejin |
| 이미지 2 플랫폼 | Xiaohongshu / Weibo                                             |
| 비디오 5 플랫폼 | YouTube / Bilibili / Douyin / Kuaishou / 비디오 번호            |

- **자격증명 AES-256-GCM 암호화 저장**(`credentials_crypto.py`), 퍼블리싱 완료 WebSocket 실시간 알림 + 완전한 기록
- **뉴스 시스템**:기사 / 뉴스 / 특집 / 태그 / 댓글 / 좋아요 / 즐겨찾기 / 인기 + news-crawler 크롤러
- **숏드라마 창작 및 관리**:`apps/web/app/(main)/drama/`
- **비즈니스 명함**:명함 생성 / 편집 / 즐겨찾기 / 공유 / business-cards schema

#### C2. AI 교육 풀스택

| 모듈                   | 역량                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **강의 학습**          | 강의 / 챕터 / 학습 경로 / 학습 맵 / 진행 추적 / 노트 / 질문답변 / zhs-course + zhs-organization            |
| **문제은행 및 시험**   | 다양한 문제 유형 enum 양방향 매핑 / 자동 채점 / 챕터 연습 / 오답 노트 / 시험지 업로드 / exam-marking       |
| **교무 및 출결**       | 임계값 규칙(지각/조퇴/결석)/ 결석 자동 보완 / 휴가 승인 연동 / 일괄 호명 / CSV 내보내기 / attendance-rule  |
| **SRS 간격 반복**      | 에빙하우스 망각 곡선 기반 스마트 복습 스케줄링 / srs.ts + srs.py                                           |
| **라이브 강의**        | 라이브 / 출석 체크 / 인터랙션 / 다시보기 / AI 보조 / live-chat + live-extended + live-supplement           |
| **학습 리포트**        | 학습 행동 분석 + 개인화 제안 / analytics-events + behavior                                                 |
| **수료증 발급**        | 강의 완료 / 시험 합격 시 자동 발급 / certificate.ts + certificate/download                                 |
| **강사 관리**          | 강사 홈페이지 / 강의 연결 / education-platform                                                             |
| **학생 12 서브페이지** | 질문 / 기사 / 서클 / 댓글 / 강의 / 리소스 / 노트 / 오프라인 기록 / 시험지 / 오답 노트 / 수료증 / 학습 기록 |
| **edu-full schema**    | 45개 테이블(최대 schema), 강의/챕터/강의시간/노트/질문/과제/채점/학습기록/반/강사/학원생/인증 커버         |

### D. 엔터프라이즈 및 운영(기업 관리자 및 운영 대상)

#### D1. 빌링 및 트랜잭션

완전한 트랜잭션 폐루프:

```
구독 VIP → 지갑 충전 → 포인트 획득 → 모델 호출 과금 → 환불 감사 → 인보이스 발행
                ↓                ↑
            분배 커미션 ← 초대 커미션
```

- **VIP 등급**:멀티 레벨 회원 / 혜택 설정 / 업그레이드 흐름 / vip-membership
- **구독 recurring**:주기 과금 / 자동 갱신 / 구독 취소 / payment-recurring
- **지갑**:충전 / 출금 / 잔액 / 거래 내역 / wallet.ts + funds.ts
- **포인트**:출석 획득 / 작업 획득 / 소비 차감 / 상품 교환 / point + point-redeem-items
- **환불 감사**:신청 / 심사 / 환불 / 은행 거래 내역 / refund-audit
- **인보이스**:부가세 일반 인보이스 / 전용 인보이스 / 우편
- **환율**:멀티 통화 / 실시간 환율
- **8 결제 게이트웨이**:payment-gateway + payment-extended + wechat-pay-contracts + payment-callbacks

#### D2. 커뮤니티 및 인터랙션

| 모듈                | 역량                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **서클 광장**       | 서클 / 광장 / 질문답변 / 게시글 / 토픽 / 태그 / community + circle-extra                      |
| **1:1 메시지**      | 1:1 개인 메시지 / 시스템 알림 / 멀티 단말 동기화 / WebSocket 실시간 푸시 / private-letters    |
| **팔로우 팬**       | 팔로우 / 팬 / 사용자 홈페이지 / 명함 / 사용자 기사 / 질문 / 댓글 / social + social-supplement |
| **공유 초대**       | 초대 코드 / 공유 코드 / H5 공유 / 추천 커미션 / visit-tracking                                |
| **인터랙션 피드백** | 댓글 / 좋아요 / 즐겨찾기 / 신고 / 사용자 피드백 센터 / interactions + comments                |

#### D3. 운영 성장 시스템

| 모듈               | 역량                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| **포인트 출석**    | 매일 출석 / 작업 포인트 / 포인트 샵 / 교환 / 포인트 상세 / check-in + checkin           |
| **랭킹**           | 다차원 랭킹 / 주간·월간 차트 / 사용자 순위 / ranking                                    |
| **추첨 이벤트**    | 추첨 / 레드봉 / 보상 동영상 광고 / rewarded-video-ad                                    |
| **분배 커미션**    | 분배 시스템 / 커미션 플랜 / 출금 / 초대 커미션 / 8 서브페이지 / distribution            |
| **이벤트 공지**    | 이벤트 관리 / 공지 푸시 / Banner 캐러셀 / 프로모션 자리 / carousels + zone + promotions |
| **게이미피케이션** | 레벨 / 업적 / 배지 / gamification                                                       |
| **VIP 회원**       | VIP 등급 / 회원 혜택 / 쿠폰 / 팬 / 업그레이드                                           |

#### D4. 고객 지원

| 모듈                | 역량                                                               |
| ------------------- | ------------------------------------------------------------------ |
| **티켓 시스템**     | 티켓 제출 / 처리 / 평가 / FAQ / 티켓 목록 / admin-asks + admin-faq |
| **온라인 고객지원** | WebSocket 실시간 고객지원 / 1:1 세션 / `ws/customer-service`       |
| **피드백 센터**     | 사용자 피드백 / 처리 상태 / 추적 / support                         |
| **헬프 센터**       | 문서 / 튜토리얼 / `[...slug]` 동적 라우트 / docs                   |

#### D5. 운영 및 모니터링

| 모듈              | 역량                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| **BI 대시보드**   | 비즈니스 지표 시각화 / 데이터 분석 / bi-dashboard                              |
| **에러 대시보드** | 에러 aggregation / 알림 / 추적 / security-audit                                |
| **작업 로그**     | 로그인 로그 / 작업 로그 / 콜백 로그 / 시스템 작업 로그 / audit + security-logs |
| **API 디버그**    | API Debug / API 로그 / API 사용량 / API 플랫폼 / llm-call-logs                 |
| **카나리 배포**   | Canary / 그레이디언트 규칙 / A/B 테스트 / canary + ab-tests                    |
| **i18n 대시보드** | i18n-dashboard 번역 진행률 시각화                                              |
| **방문 추적**     | visit-tracking + telemetry + behavior                                          |
| **알림 모니터링** | Alertmanager + noise-rules 노이즈 억제                                         |

### E. 엔지니어링 인프라(운영 및 아키텍트 대상)

#### E1. 보안 및 컴플라이언스

| 차원                  | 구현                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **인증**              | JWT HS256 + token-family 로테이션(도용 방지) + refresh token 블랙리스트                   |
| **SSO 싱글 사인온**   | OAuth 2.0 + PKCE / Apple / Google / SSO 중계 로그인 / auth-sso + auth-identity            |
| **레이트 리밋**       | 글로벌 100/min, auth login/register 10/min, 계층적 rate-limit                             |
| **암호화**            | AES-256-GCM credentials 암호화(OSS + 교육 + 퍼블리싱 플랫폼 + OAuth private keys)         |
| **비밀번호**          | bcryptjs 해시(member 테이블 SHA256 구버전 Java 데이터 호환)                               |
| **데이터 마스킹**     | password / passwordHash 필드를 API 응답에서 디스트럭처링으로 제거                         |
| **GDPR**              | 데이터 내보내기 / 데이터 삭제 / 데이터 포터빌리티 / gdpr 라우트                           |
| **민감어**            | 민감어 필터 / 콘텐츠 심사 / admin-sensitive-words + sensitive-words schema                |
| **감사 로그**         | 로그인 로그 / 작업 로그 / 시스템 작업 로그 / 감사 추적 / audit + security-logs            |
| **트랜잭션 안전**     | DB 트랜잭션화:order 결제/환불 + social tag + gamification 포인트 + chat 초기화            |
| **행 잠금**           | `.for('update')` 행 잠금으로 TOCTOU 경쟁 방지                                             |
| **CSRF**              | `@fastify/csrf-protection` 듀얼 토큰 모드                                                 |
| **XSS**               | sanitizer 우회 감지 스크립트 게이트(pre-commit 6번)                                       |
| **API key 유출**      | `check-api-key-leak.mjs` 게이트(pre-commit 1번)                                           |
| **RBAC**              | roleId >= 1이어야 admin 라우트 접근, plugin-level preHandler 통합 인증 + data-scope 5단계 |
| **워크스페이스 권한** | 3 모드 + 7 엔드포인트 런타임 가로채기 + 60s 감사 타임아웃 + workspace-ai-tasks            |
| **멀티 테넌트**       | 테넌트 격리 + 조직 + 부서 + 메뉴 권한 + tenant-router + RLS(Row Level Security)           |
| **OAuth 개인키**      | oauth-private-keys schema 암호화 저장                                                     |
| **인증번호**          | auth-codes + captcha schema                                                               |
| **2FA**               | user-auth-info schema 지원                                                                |

#### E2. 데이터베이스 및 공유 패키지

- **단일 DB 설계**:PostgreSQL 18, 단일 DB `ihui`, schema로 비즈니스 도메인 격리
- **598 테이블**:231개 schema 모듈 파일, 30+ 비즈니스 도메인 커버
- **128+ 마이그레이션**:`packages/database/drizzle/`, drizzle-kit generate 생성 + 수동 증분
- **7단계 멱등 seed**:`packages/database/seed/`, 패턴화 + 내결함성 격리
- **행 수준 보안**:RLS(Row Level Security)가 핵심 필드에 활성화, 멀티 테넌트 격리
- **읽기 복제본**:read-replica + tenant-router 라우팅 쿼리
- **타입 안전**:Drizzle ORM 0.38, TypeScript strict 모드, 엔드투엔드 타입 추론
- **16 공유 패키지**:`packages/` 하위 16개 TypeScript 패키지, 크로스 플랫폼 재사용

#### E3. 국제화(5개 언어 parity)

5개 언어 parity(키 셋 강건 일관성), 4 게이트 스크립트 + 19 i18n 툴체인으로 품질 보장:

| 언어  | 파일                           | 게이트                                             |
| ----- | ------------------------------ | -------------------------------------------------- |
| zh-CN | `apps/web/messages/zh-CN.json` | 기준 언어                                          |
| zh-TW | `apps/web/messages/zh-TW.json` | opencc 자형 변환 감지로 간체자 잔류(블로킹)        |
| en    | `apps/web/messages/en.json`    | 깨진 기계번역 영어 감지(블로킹)                    |
| ko    | `apps/web/messages/ko.json`    | 문자 범위 감지로 중국어 잔류(블로킹)               |
| ja    | `apps/web/messages/ja.json`    | 중국어 잔류 감지(warn-only, 일본 한자어 오탐 방지) |

**19 i18n 툴체인 스크립트**(`scripts/`):apply-brand-glossary / apply-i18n-translations / apply-translation-fallback / audit-i18n-missing-evaluate / deep-i18n-audit / export-untranslated-i18n / fix-i18n-deep / fix-missing-i18n-keys / fix-zh-tw-simp / fix-zhtw-parity / generate-i18n / prune-orphan-i18n-namespaces / scan-hardcoded-zh / scan-i18n-zh-residue / scan-zh-tw-untranslated / sync-i18n-fixes / translate-i18n-batch / analyze-unique-i18n-values / verify-i18n

**브랜드 번역 전략**:공식 영문명 우선(Zhipu AI → Zhipu AI, Baidu ERNIE → Baidu ERNIE, Volcengine → Volcengine 등), 머신 리더블 매핑 테이블은 `scripts/brand-glossary.json` 참조.

#### E4. 엔지니어링 게이트(21 pre-commit + post-commit + 11 마이그레이션 감사)

프로젝트는 21개 pre-commit 훅 + post-commit 자동 push + 11 마이그레이션 감사 스크립트로 협업 사고를 방지합니다:

| #       | 스크립트                              | 용도                                               |
| ------- | ------------------------------------- | -------------------------------------------------- |
| 1       | check-api-key-leak.mjs                | API key 유출 감지                                  |
| 2       | check-i18n-keys.mjs                   | i18n 키 완전성 + parity                            |
| 2b      | scan-i18n-zh-residue.mjs zh-TW        | zh-TW 간체자 잔류(opencc 자형 변환)                |
| 2c      | scan-i18n-zh-residue.mjs ko           | ko.json 중국어 잔류(문자 범위 감지)                |
| 2d      | scan-i18n-zh-residue.mjs ja           | ja.json 중국어 잔류(warn-only)                     |
| 2e      | check-i18n-broken-en.mjs              | en.json 깨진 기계번역 영어 게이트                  |
| 3       | check-db-schema-drift.mjs             | schema drift 감지                                  |
| 4       | check-stale-dist.mjs                  | packages 노후 dist 감지                            |
| 4b      | check-dist-encoding.mjs               | packages dist UTF-8 BOM 게이트                     |
| 4c      | check-api-client-utf8.mjs             | api-client 소스 바이트급 UTF-8 완전성              |
| 5       | lint-staged                           | eslint + prettier                                  |
| 6       | check-sanitizer-bypass.mjs            | XSS sanitizer 우회 감지                            |
| 7       | check-dedupe.mjs                      | 의존성 파편화 감지                                 |
| 8       | check-api-routes.mjs                  | 프론트/백엔드 라우트 일관성                        |
| 9       | check-safe-parse.mjs                  | safeParse 묵음 무시(warn-only)                     |
| 11      | check-rounded-full.mjs                | 컨테이너 라운드 코너 위반(사이즈 그래디언트 강제)  |
| 12      | check-delivery-report-consistency.mjs | 인도 보고서 일관성                                 |
| 13b     | check-project-plan-size.mjs           | PROJECT_PLAN.md 크기 < 50KB                        |
| 13c     | check-project-plan-archive.mjs        | PROJECT_PLAN.md 완료 작업 항목 오삭제 방지         |
| 15      | check-api-migration-completeness.mjs  | 마이그레이션 완전성                                |
| 16      | 조건부 typecheck                      | apps/web staged 시 typecheck 실행                  |
| 16b     | 조건부 database build                 | packages/database/src staged 시 build 실행         |
| 17      | check-input-border-var.mjs            | CSS 색상 토큰 중첩(hsl(var())) 방어                |
| 18      | check-native-title-tooltip.mjs        | 네이티브 title tooltip 위반(프로젝트 Tooltip 강제) |
| 17-post | git-push-guard.mjs(post-commit)       | 자동 push + local == remote 검증(누락 방지)        |

**9 마이그레이션 감사 스크립트**:`audit-migration.mjs`(4-in-1,`--target=i18n|frontend-routes|db-fields|api-routes`,2026-07-25 병합) / `audit-migration-api-routes.mjs` / `audit-migration-db-schema.mjs` / `audit-migration-file-list.mjs` / `audit-multi-platform-sync.mjs` / `audit-edu-pages-sample-check.mjs` / `audit-remaining-evaluate.mjs` / `r76-full-audit.mjs` / `audit-i18n-unused-keys.mjs`(미참조 key 감사,2026-07-25 신설)

**9 PowerShell 시작 스크립트**:`dev-all.ps1` / `dev-up.ps1` / `dev-web.mjs` / `kill-dev-servers.ps1` / `restart-dev-server.ps1` / `fix-workspace-junctions.ps1` / `setup-token-refresh-task.ps1` / `cleanup-external-junk.ps1`

#### E5. 테스트 및 성능

| 타입           | 프레임워크    | 규모                         | 명령                              |
| -------------- | ------------- | ---------------------------- | --------------------------------- |
| 백엔드 유닛    | Vitest        | 322개 파일, ~14839+ 케이스          | `pnpm --filter @ihui/api test`    |
| 프론트엔드 E2E | Playwright    | 17 spec 파일                 | `pnpm test:e2e`                   |
| AI 서비스      | pytest        | 13 파일, 400+ 케이스         | `cd apps/ai-service && pytest`    |
| CLI 유닛       | Vitest        | 13 파일                      | `pnpm --filter ihui-cli test`     |
| 부하 테스트    | Locust        | `scripts/locustfile.py`      | `locust -f scripts/locustfile.py` |
| 성능 예산      | Lighthouse CI | `apps/web/lighthouserc.json` | CI 자동 실행                      |
| 미사용 코드    | Knip          | `knip.jsonc` + CI 워크플로   | `pnpm knip`                       |
| 전체 검증      | turbo         | 22 tasks                     | `pnpm turbo typecheck lint test`  |

**테스트 전략**:Fastify inject 모드(포트 리스닝 안 함) + Mock 데이터베이스 레이어 + auth / billing / content / success-paths / business-logic / edge-cases 커버.

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

## API 및 프로토콜

### REST API(4443 라우트)

| 서비스              | 엔드포인트 수 | 접두사                | 라우트 파일 수 | 커버 도메인                                                                                                                                                                                                                                                                 |
| ------------------- | ------------- | --------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **apps/api**        | 4551          | `/api` + `/api/admin` | 603            | 30+ 비즈니스 도메인(auth/users/billing/content/chat/teams/workspace/agents/coze/oss/order/vip/exam/learn/live/news/topic/search/drama/stock/gdpr/rbac/tenant/community/edu/payment/wallet/point/ranking/distribution/developer/workflows/business-card/customer-service 등) |
| **apps/ai-service** | ~577           | `/api`                | 12 routers     | a2a(5)/ agents(9)/ health(4)/ llm(2)/ mcp(10)/ tools(3)/ personas(4)/ voice_stt(3)/ self_media(6)/ publish(8)/ agent_runtime(6)/ legacy                                                                                                                                     |

**통합 응답 형식:**

```typescript
// 성공: { code: 0, message: 'success', data: T }
// 오류: { code: number, message: string }
// 공유 utils/response.ts의 success()/error()로 생성
```

**인증:** JWT HS256 + token-family 로테이션 + refresh 블랙리스트, access token 7일 유효, 모든 엔드포인트는 `@ihui/auth` 공유 패키지로 통합 발급/검증.

### WebSocket 엔드포인트(12개)

| 엔드포인트                      | 용도                                                                  |
| ------------------------------- | --------------------------------------------------------------------- |
| `/ws/notifications`             | 글로벌 알림 푸시(멀티 단말 동기화, Redis Pub/Sub 브로드캐스트)        |
| `/ws/room/:roomId`              | 채팅방 메시지(멀티 유저 룸)                                           |
| `/ws/customer-service`          | 고객지원 세션(1:1)                                                    |
| `/ws/payment/status/:orderNo`   | 결제 상태 실시간 업데이트                                             |
| `/ws/broadcast`                 | 범용 브로드캐스트                                                     |
| `/ws/agent/stream`              | Agent 스트리밍 출력(단계 / 툴 호출 / 사고, interrupt/continue/cancel) |
| `/ws/tts/stream`                | TTS 스트리밍 합성(텍스트 → 오디오, 중단 지원)                         |
| `/ws/realtime/pcm`              | 양방향 실시간 오디오(ASR 입력 + TTS 출력, PCM16 16kHz)                |
| `/v1/ai/capabilities/ws/stream` | 범용 AI 역량 스트림(AI 서비스 SSE로 프록시)                           |
| `/ws/stock/stream`              | 주식 시세 스트림                                                      |
| `/ws/timbre/generate`           | 음색 클론 생성 스트림                                                 |
| `/ws/coze/chat`                 | Coze 대화 스트림                                                      |
| `/ws/live/chat`                 | 라이브 채팅방                                                         |

모든 WS 엔드포인트는 `wsAuth(socket, token)`로 JWT 검증, heartbeat ping/pong 지원, 멀티 인스턴스는 Redis Pub/Sub로 크로스 인스턴스 브로드캐스트.

---

## 데이터베이스

- **단일 DB 설계**:PostgreSQL 18, 단일 DB `ihui`, schema로 비즈니스 도메인 격리
- **598 테이블**:231개 schema 모듈 파일, 30+ 비즈니스 도메인 커버
- **128+ 마이그레이션**:`packages/database/drizzle/`, drizzle-kit generate 생성 + 수동 증분
- **7단계 멱등 seed**:`packages/database/seed/`, 패턴화 + 내결함성 격리
- **행 수준 보안**:RLS(Row Level Security)가 핵심 필드에 활성화, 멀티 테넌트 격리
- **읽기 복제본**:read-replica + tenant-router 라우팅 쿼리
- **타입 안전**:Drizzle ORM 0.38, TypeScript strict 모드, 엔드투엔드 타입 추론
- **핵심 schema 모듈**:users / auth-identity / oauth-private-keys / agents-extended / agent-commerce / ai-capabilities / ai-cost / learn(45 테이블)/ exam / certificate / content / news-crawler / self-media / publish-platform / community / order / billing / wechat-pay-contracts / refund-audit / point / wallet / funds / commission / member / teams / tenant / rbac / workspace-permissions / system / canary / ab-tests / live / customer-service / business-cards / stock / trader / developer / sdks / webhooks / workflow / projects / knowledge-base / knowledge-rag / search-contents / cli-provider-imports / email-logs / sensitive-words / audit / visit-tracking / behavior / analytics-events / gamification

---

## 옵저버빌리티

풀스택 옵저버빌리티, 3대 지주(지표 / 로그 / 추적) + 알림 완비:

### 지표(Prometheus + Grafana 20 대시보드)

- **Prometheus**(:9091):api `/metrics` + ai-service `/metrics` + node-exporter 호스트 지표 + alerts.yml 알림 규칙 수집
- **Grafana**(:8816):**20개 대시보드 JSON 자동 provision**, 포함:

| #   | 대시보드         | 용도            |
| --- | ---------------- | --------------- |
| 1   | ihui-ai-overview | 개요            |
| 2   | ai-cost          | AI 비용         |
| 3   | ai-latency       | AI 레이턴시     |
| 4   | alert_history    | 알림 히스토리   |
| 5   | auth-security    | 인증 보안       |
| 6   | bullmq           | 큐 헬스         |
| 7   | business-funnel  | 비즈니스 퍼널   |
| 8   | cache            | 캐시 적중       |
| 9   | exam-usage       | 시험 사용률     |
| 10  | hls              | HLS 스트리밍    |
| 11  | jaeger           | 추적            |
| 12  | live-room        | 라이브 룸       |
| 13  | monitor_health   | 모니터링 헬스   |
| 14  | nginx            | Nginx           |
| 15  | oss-storage      | OSS 스토리지    |
| 16  | payment-flow     | 결제 흐름       |
| 17  | pg_deploy        | PostgreSQL 배포 |
| 18  | postgresql       | PostgreSQL      |
| 19  | redis-cluster    | Redis 클러스터  |
| 20  | tenant-usage     | 테넌트 사용     |
| 21  | ws               | WebSocket       |

- **Node Exporter**(:8817):호스트 CPU / 메모리 / 디스크 / 네트워크 지표

### 로그(Loki + Promtail)

- **Loki**(:8818):로그 aggregation 백엔드
- **Promtail**:`logging=promtail` 라벨이 있는 Docker 컨테이너 자동 발견, Docker + Nginx + API 애플리케이션 로그 수집

### 추적(OpenTelemetry + Jaeger)

- **OpenTelemetry Collector**(:8813):OTLP 추적 / 지표 수신, Jaeger + Prometheus로 내보내기
- **Jaeger UI**(:8814):분산 추적 시각화, API ↔ AI 서비스 ↔ 데이터베이스 풀링크

### 알림(Alertmanager + noise-rules)

- **Alertmanager**(:9093):알림 라우팅 + 노이즈 억제
- **monitoring/alertmanager/noise-rules.yml**:알림 노이즈 억제 규칙(단일 소스, 구 루트 사본은 통합됨)

### 헬스 체크

| 엔드포인트              | 용도                                |
| ----------------------- | ----------------------------------- |
| `GET /api/health`       | 백엔드 종합 헬스(DB + Redis 프로브) |
| `GET /api/health/live`  | Liveness                            |
| `GET /api/health/ready` | Readiness                           |
| `GET /health`           | AI 서비스 헬스 체크                 |

---

## 보안 설계

| 차원                  | 구현                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **인증**              | JWT HS256 + token-family 로테이션(도용 방지) + refresh token 블랙리스트                                          |
| **SSO**               | OAuth 2.0 + PKCE / Apple / Google / SSO 중계 로그인                                                              |
| **레이트 리밋**       | 글로벌 100/min, auth login/register 10/min, 계층적 rate-limit                                                    |
| **암호화**            | AES-256-GCM credentials 암호화(OSS 드라이버 자격증명 + 교육 설정 자격증명 + 퍼블리싱 플랫폼 계정 + OAuth 개인키) |
| **비밀번호**          | bcryptjs 해시(member 테이블 SHA256 구버전 Java 데이터 호환)                                                      |
| **데이터 마스킹**     | password / passwordHash 필드를 API 응답에서 디스트럭처링으로 제거                                                |
| **GDPR**              | 데이터 내보내기 / 삭제 / 포터빌리티 / gdpr 라우트                                                                |
| **민감어**            | 민감어 필터 + 콘텐츠 심사 + admin-sensitive-words                                                                |
| **감사 로그**         | 로그인 로그 / 작업 로그 / 시스템 작업 로그 / 감사 추적                                                           |
| **트랜잭션 안전**     | DB 트랜잭션화:order 결제/환불 + social tag + gamification 포인트 + chat 초기화                                   |
| **행 잠금**           | `.for('update')` 행 잠금으로 TOCTOU 경쟁 방지                                                                    |
| **CSRF**              | `@fastify/csrf-protection` 듀얼 토큰 모드                                                                        |
| **XSS**               | sanitizer 우회 감지 스크립트 게이트(pre-commit 6번)                                                              |
| **API key 유출**      | `check-api-key-leak.mjs` 게이트(pre-commit 1번)                                                                  |
| **RBAC**              | roleId >= 1이어야 admin 라우트 접근, plugin-level preHandler 통합 인증 + data-scope 5단계                        |
| **워크스페이스 권한** | 3 모드 + 7 엔드포인트 런타임 가로채기 + 60s 감사 타임아웃                                                        |
| **멀티 테넌트**       | 테넌트 격리 + 조직 + 부서 + 메뉴 권한 + tenant-router + RLS                                                      |
| **OAuth 개인키**      | oauth-private-keys schema 암호화 저장                                                                            |
| **2FA**               | user-auth-info schema 지원                                                                                       |
| **인증번호**          | auth-codes + captcha schema                                                                                      |

---

## 엔지니어링 게이트(21개 pre-commit 훅)

프로젝트는 21개 pre-commit 훅 + post-commit 자동 push + 11 마이그레이션 감사 + 9 PowerShell 시작 스크립트로 협업 사고를 방지합니다:

상세 목록은 [핵심 역량 E4절](#e4-엔지니어링-게이트21-pre-commit--post-commit--11-마이그레이션-감사) 참조.

---

## 엔지니어링 품질 증거("AI 생성 코드 3가지 일반적 문제"에 대한 반박)

> **이 섹션을 작성한 이유**: 일부 외부 AI 리뷰가 코드를 검토하지 않은 채 "AI 생성 프로젝트의 일반적 특성"을 바탕으로 이 프로젝트에 3가지 일반적 문제가 있다고 추측했습니다 — ① 코드 중복도 높음 ② 경계 조건 처리 부족 ③ 심층 비즈니스 로직 일관성 약함. 저희는 **실제 증거**로 이 추측에 응답하며, 말장난으로 반박하지 않습니다.

### 문제 ① 코드 중복도 높음 → 현실: Knip + dedupe + 21 훅이 수호

| 메커니즘                      | 파일                                                                                                      | 목적                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Knip 미사용 코드 감지**     | [knip.jsonc](./knip.jsonc) + [.github/workflows/knip.yml](./.github/workflows/knip.yml)                   | CI 수호, 참조되지 않은 export → CI 실패  |
| **종속성 파편화 감지**        | [scripts/check-dedupe.mjs](./scripts/check-dedupe.mjs) (pre-commit #7)                                    | 중복 종속성 버전 감지, 정렬              |
| **Tailwind 클래스 충돌 감지** | [scripts/check-tailwind-class-conflict.mjs](./scripts/check-tailwind-class-conflict.mjs) (pre-commit #20) | 템플릿 리터럴 BASE/BRANCH size 충돌 감지 |
| **Staged 오염 경고**          | [scripts/check-staged-pollution.mjs](./scripts/check-staged-pollution.mjs) (pre-commit #19)               | ≥4 디렉토리에 걸친 staged 변경 감지      |

### 문제 ② 경계 조건 부족 → 현실: 237 API 테스트 + 63 e2e + 마이크로서비스 패턴

| 메커니즘                    | 증거                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API 단위 테스트**         | 237개 `.test.ts` 파일([apps/api/tests/](./apps/api/tests/)), auth/billing/order/vip/wallet/alipay/crypto/csrf/outbox 등 핵심 경로 커버                                                                |
| **E2E 테스트**              | 63개 `.spec.ts` 파일([apps/web/e2e/](./apps/web/e2e/)), admin/ai-chat/auth-2fa/community/education/orders/payment/plaza/pwa/security/seo/workspace 등 17 비즈니스 도메인 커버                         |
| **AI 서비스 테스트**        | pytest 테스트 스위트([apps/ai-service/tests/](./apps/ai-service/tests/)), `test_business_flow_integration.py` 비즈니스 흐름 통합 테스트 + `test_langgraph_service.py` 오케스트레이션 로직 테스트 포함 |
| **마이크로서비스 내결함성** | Outbox 트랜잭셔널 아웃박스 + Refund DLQ 환불 데드레터 큐 + Circuit Breaker + IDOR 보호 + WS Dedup 메시지 중복 제거                                                                                    |
| **결제 루프 테스트**        | `apps/api/tests/alipay.test.ts` + `billing.test.ts` + `order.test.ts` + `wallet.test.ts`가 결제/환불/정산/지갑 거래 커버                                                                              |

### 문제 ③ 심층 비즈니스 로직 일관성 약함 → 현실: 복잡한 비즈니스 흐름이 완전한 체인 보유

| 비즈니스 흐름          | 핵심 코드                                                                                                                                 | 테스트                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **결제 루프**          | `createOrder` → `completeOrderWithSaga` → 결제 콜백 → VIP 활성화 → 지갑 입금 → 포인트 발행 → 환불 DLQ                                     | [apps/api/tests/order.test.ts](./apps/api/tests/order.test.ts) + [billing.test.ts](./apps/api/tests/billing.test.ts) |
| **AI 교육 풀스택**     | 강의 등록 → 챕터 추적 → 과제 채점(`gradeSubjectiveAnswers` 주관식 수동 채점 + 객관식 자동 채점) → 오답 노트 → SRS 간격 반복 → 수료증 발행 | [apps/api/tests/exam.test.ts](./apps/api/tests/exam.test.ts) + [learn.test.ts](./apps/api/tests/learn.test.ts)       |
| **LangGraph 워크플로** | `langgraph_service.py` StateGraph(plan → execute → summarize) + `koubo_workflow.py` 10+ 도구 + `agent_orchestrator.py` 멀티 Agent 협업    | [apps/ai-service/tests/test_langgraph_service.py](./apps/ai-service/tests/test_langgraph_service.py)                 |
| **멀티 테넌트 권한**   | RBAC 5 레벨 + data-scope 5 레벨 + RLS 행 수준 보안 + workspace 3 모드 + 7 엔드포인트 런타임 가로채기 + 60s 감사 타임아웃                  | [apps/api/tests/rbac.test.ts](./apps/api/tests/rbac.test.ts)                                                         |
| **AI 스트리밍 출력**   | SSE(Agent 스트리밍) + WebSocket(채팅방 / 멀티 모델 스트리밍) + REST 3계층 프로토콜 + WS Dedup 메시지 중복 제거                            | [apps/api/tests/chat.test.ts](./apps/api/tests/chat.test.ts)                                                         |

---

## AI 프로그래밍 협업 선언

> **이 프로젝트는 AI 프로그래밍 Agent를 보조 개발에 사용**합니다(Claude Code / Codex / Cursor 등), 단 다음 메커니즘으로 엔지니어링 품질을 보장합니다 — **"AI가 검토 없이 코드를 자동 생성"하는 것이 아닙니다**:

### 트리플 게이트(모든 코드 라인이 통과해야 함)

1. **코딩 전**: AGENTS.md 21 강제 규칙 + §11 멀티-Subagent 병렬 개발 작업 할당 형식 + §9 전 클라이언트 연결 의무
2. **코딩 중**: §17 스타일 변경 의무 browser_use 검증 + §19 UI 변경 사전 배달 자가 검증 4상태 스크린샷 + §14 Agent 자가 검증
3. **코딩 후**: `pnpm turbo build typecheck lint test` 전체 검증 + 21 pre-commit 훅 + pre-push typecheck 게이트 + post-commit 자동 push + git-push-guard 검증

### AI 코드 문제에 대한 표적 대책

| AI 코드 문제         | 이 프로젝트의 대책                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 코드 중복            | Knip CI 수호 + check-dedupe + check-tailwind-class-conflict                                                      |
| 경계 조건 누락       | 237 API 테스트 + 63 e2e + pytest 통합 테스트 + 마이크로서비스 내결함성 패턴                                      |
| 비즈니스 로직 파편화 | 비즈니스 흐름 통합 테스트(`test_business_flow_integration.py`) + saga 트랜잭션 패턴 + outbox 트랜잭셔널 아웃박스 |
| 타입 안전 구멍       | TypeScript strict + Zod 엔드투엔드 검증 + @ihui/types 크로스 클라이언트 계약                                     |
| 문서-코드 드리프트   | §13 파일 수정 지속성 의무 Read 검증 + check-project-plan-archive 수호                                            |
| 스타일 불일치        | ESLint + Prettier + 21 pre-commit 훅 + check-rounded-full / check-i18n-keys / check-api-routes 등                |
| 협업 사고            | §12 멀티 세션 병렬 규칙 + §16 push 단계 크로스-Agent 보호 + git-push-guard + post-commit 자동 push               |

### 정직하게 인정된 단점

저희는 다음 사실을 **부인하지 않으며**, 향후 최적화 방향으로 취급합니다:

- 5 클라이언트(desktop / extension / mobile-rn / miniapp-taro / cli)의 완성도가 web/api/ai-service보다 낮음; 핵심 시나리오는 연결되었으나 비즈니스 페이지 커버리지가 부족함([프로젝트 상태 매트릭스](#프로젝트-상태-매트릭스투명-라벨링-2026-07-22-확인) 참조)
- ai-service의 LangGraph 오케스트레이션은 현재 "워크플로 수준"이며, "자율 스킬 생성 + 장기 메모리 + 자가 진화" 심층 Agent 능력은 아직 구현되지 않음
- 오픈소스 커뮤니티 생태계는 이제 막 시작; 기여자 수, Issue 축적, 모범 사례는 LangChain / Dify / Claude Code 등 성숙한 프로젝트에 비해 크게 뒤처짐

---

## 테스트

상세 테스트 매트릭스는 [핵심 역량 E5절](#e5-테스트-및-성능) 참조.

---

## 배포

### Docker Compose(권장)

```bash
# .env.production 설정
cp .env.production.example .env.production
# JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY / 위챗페이 인증서 / SMTP 등 편집

# 원클릭 시작(7 비즈니스 + 7 모니터링 = 14 서비스)
docker compose up -d
```

**서비스 목록(14 서비스):**

| 타입     | 서비스         | 포트 | 용도                                     |
| -------- | -------------- | ---- | ---------------------------------------- |
| 비즈니스 | api            | 8802 | Fastify 백엔드                           |
| 비즈니스 | worker         | 8830 | BullMQ 독립 worker 프로세스              |
| 비즈니스 | web            | 8801 | Next.js 프론트엔드(standalone)           |
| 비즈니스 | ai-service     | 8803 | FastAPI AI 서비스                        |
| 비즈니스 | db             | 8810 | PostgreSQL 18                            |
| 비즈니스 | redis          | 8811 | Redis 7                                  |
| 비즈니스 | migrate        | -    | 일회성 마이그레이션 서비스(완료 후 종료) |
| 모니터링 | jaeger         | 8814 | 분산 추적 UI                             |
| 모니터링 | otel-collector | 8813 | OpenTelemetry Collector                  |
| 모니터링 | prometheus     | 9091 | 지표 수집                                |
| 모니터링 | grafana        | 8816 | 시각화(20 대시보드)                      |
| 모니터링 | node-exporter  | 8817 | 호스트 지표                              |
| 모니터링 | loki           | 8818 | 로그 aggregation                         |
| 모니터링 | promtail       | -    | 로그 수집                                |

### 포트 관리 규칙

본 프로젝트의 모든 서비스는 `88xx` 포트 대역을 통일 사용하여 시스템 서비스와의 충돌을 회피합니다:

| 포트 대역 | 용도      | 설명                                                                                                                           |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 8801-8809 | 앱 서비스 | Web / API / AI Service / Taro H5 / Metro / Desktop 등                                                                          |
| 8810-8819 | 인프라    | PostgreSQL(8810)/ Redis(8811)/ OTel(8812-8813)/ Jaeger(8814)/ Prometheus(8815)/ Grafana(8816)/ Node Exporter(8817)/ Loki(8818) |
| 8820-8829 | 보조 도구 | Storybook(8820) 등 개발 보조 도구                                                                                              |
| 8830-8839 | SaaS 배포 | Admin API(8830) 등 SaaS화 배포 서비스                                                                                          |

### 프로덕션 배포

[DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) 참조 — 블루그린 배포 / 이미지 tag 전환 / Nginx upstream 전환 / 데이터베이스 백업 복구 / 인증서 갱신 / 헬스 체크 / 롤백.

```bash
# 배포 전 10개 항목 하드 게이트 자가 점검
node scripts/pre-deploy.mjs

# PostgreSQL 백업
node apps/api/scripts/pg-backup.mjs

# 헬스 체크
./deploy/scripts/health-check.sh

# 롤백
./deploy/scripts/rollback.sh

# 인증서 갱신(deploy/cron/cert-renew.cron 자동 스케줄)
./deploy/cron/cert-renew.sh

# GitHub Actions secrets 일괄 설정
./deploy/setup-github-secrets.sh
```

### IaC 결정

이 아키텍처는 K8s + Helm + ArgoCD 대신 **Docker Compose + GitHub Actions**를 선택한 이유:

- 단일 VM으로 배포 가능, 운영 진입 장벽 낮음
- 컨트롤 플레인 오버헤드 없음, 리소스 활용률 높음
- 배포 속도 10-30s(K8s 30s-2min)
- 적용 규모 ≤ 5 서비스 / 단일 팀 / 단일 클러스터

**K8s로 마이그레이션 시점**:비즈니스 서비스 > 10 / 크로스 AZ 멀티 활성 / 단일 VM 리소스 한계 도달 / HPA 오토스케일 필요 / 멀티 테넌트 namespace 단위 격리. 모든 Dockerfile은 K8s 컨테이너 이미지로 직접 재사용 가능, 마이그레이션 경로 예약 완료.

---

## 국제화

5개 언어 parity(키 셋 강건 일관성), 4 게이트 스크립트 + 19 i18n 툴체인으로 품질 보장:

상세 목록은 [핵심 역량 E3절](#e3-국제화5개-언어-parity) 참조.

---

## FAQ

<details>
<summary><strong>Q1: IHUI-AI는 상업용으로 사용할 수 있나요?</strong></summary>

네. 프로젝트는 Apache License 2.0을 채택하여 자유 사용, 수정, 배포, 상업 사용을 허용하며, 카피레프트 성격이 없습니다. 이를 기반으로 상업 제품을 구축할 수 있고, 비즈니스 코드를 오픈소스화할 의무가 없습니다. 유일한 요구사항:LICENSE와 copyright notice를 유지.
</details>

<details>
<summary><strong>Q2: 40+ 국내외 비교 제품(OpenAI ChatGPT / Dify / LangChain / RAGFlow / Coze / Claude Code / Cursor / GitHub Copilot / Khan Academy / Stripe+Auth0 등)과 어떻게 다른가요?</strong></summary>

IHUI-AI는 단일 AI 툴이 아니라 **오픈소스 AI 상업용 통합 파운데이션**으로, 다음 6대 카테고리 제품의 역량을 **하나의 Apache 2.0 저장소에 통합**합니다:

| 비교 카테고리               | 대표 제품                                                                    | IHUI-AI 차이                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 범용 AI 대화                | OpenAI ChatGPT / Anthropic Claude.ai / Google Gemini / Microsoft Copilot     | IHUI-AI 셀프 호스팅 + 118 모델(OpenAI 한정 아님)+ 빌링/교육/퍼블리싱 등 비즈니스 내장                                                    |
| AI 애플리케이션 개발 플랫폼 | Dify / FastGPT / Langflow / RAGFlow / Flowise / Coze(Kouzi)                  | IHUI-AI는 6단, 자체 CLI, 완전한 상업적 루프, AI 교육, 38 플랫폼 퍼블리싱이 추가                                                           |
| AI Agent 프레임워크         | LangChain / LlamaIndex / AutoGen / CrewAI / AutoGPT / MetaGPT                | 그것들은 개발 프레임워크("자동차 부품")이고, IHUI-AI는 제품화 파운데이션("완성차 출고")으로 비기술 팀도 사용 가능                         |
| AI 코딩 CLI / IDE           | Claude Code / Cursor / GitHub Copilot / Windsurf / Amazon Q / Cline / Aider  | IHUI-AI의 CLI는 코딩뿐 아니라 AI 애플리케이션 플랫폼(대화/RAG/Agent/빌링)을 통합했으며, Apache 2.0 오픈소스, 타 제품은 모두 클로즈드 소스 |
| AI 교육 플랫폼              | Khan Academy / Coursera / edX / Google 교육 AI                               | IHUI-AI의 AI 교육은 오픈소스 풀스택(강의/문제은행/시험/SRS/라이브/수료증)으로 2차 맞춤 가능, 타 제품은 클로즈드 소스 SaaS                 |
| 상업 SaaS 파운데이션        | Stripe / Auth0 / Clerk / Mailgun / SendGrid / Mixpanel / Amplitude / PostHog | IHUI-AI는 결제/인증/이메일/분석을 모두 프리셋하여 4-6개 SaaS를 원스톱 대체, 월 $300+ 절약                                                 |
| 멀티단 프레임워크           | Tauri / Electron / Expo / React Native / Taro / WXT / Next.js                | IHUI-AI는 8단 + 16 공유 패키지 + 공유 UI를 한번에 프리셋, 개발자가 직접 조립하지 않아도 됨                                                |

**10대 고유 역량(오픈소스 생태계에서 동시 보유는 드문 사례)**:

1. **8단 전면 커버리지**(타 AI 애플리케이션 플랫폼은 1-2단, Claude Code/Cursor는 1단만)
2. **LangGraph + MCP + A2A 트리플 스택 협업**(타 프로젝트는 최대 단일 스택)
3. **자체 CLI 17 명령 + 13 툴 + ACP Server + 6 소스 설정 가져오기**(오픈소스 AI 애플리케이션 플랫폼에서는 드묾)
4. **완전한 빌링 구독 + VIP + 지갑 + 포인트 + 8 결제 게이트웨이 + 환불 + 인보이스**(오픈소스 AI 플랫폼에서는 드묾)
5. **38 플랫폼 원클릭 퍼블리싱 + 38 adapter + AES-256-GCM 자격증명 암호화**(오픈소스 프로젝트에서는 드묾)
6. **AI 교육 풀스택 + 학생 12 서브페이지 + 45 테이블 edu-full schema**(오픈소스 AI 플랫폼에서는 드묾)
7. **엔터프라이즈 보안 스택(RBAC + 멀티 테넌트 + RLS + SSO + AES-256-GCM + JWT token-family + GDPR + 2FA + IDOR)**(오픈소스 AI 플랫폼에서는 드묾)
8. **17 엔지니어링 게이트 + 11 마이그레이션 감사 + 9 PowerShell + post-commit 자동 push**(오픈소스 AI 프로젝트에서는 드묾)
9. **3대 지주 옵저버빌리티 + 20 Grafana 대시보드 + Alertmanager**(오픈소스 AI 플랫폼에서는 드묾)
10. **5개 언어 i18n parity + 4 게이트 스크립트 + pgvector + 지식 그래프 + 사용자 장기 기억**(오픈소스 AI 프로젝트에서는 드묾)

상세 내용은 위 [프로젝트 포지셔닝](#프로젝트-포지셔닝필독), [비용 비교](#비용-비교ihui-ai-셀프-호스팅-vs-동등-saas-스택) 및 [유사 프로젝트와의 비교](#유사-프로젝트와의-비교) 섹션 참조.

**핵심 차별화**:IHUI-AI보다 더 전문적인 프로젝트(RAGFlow는 RAG 차원에서 더 깊고, Claude Code는 CLI 차원에서 더 성숙하고, LangChain은 프레임워크층에서 더 유연하고, Khan Academy는 교육 콘텐츠에서 더 풍부함)는 찾을 수 있지만, IHUI-AI보다 더 포괄적인 오픈소스 파운데이션은 찾을 수 없습니다.

**한 줄 요약**:IHUI-AI = OpenAI ChatGPT(대화)+ Dify(애플리케이션 오케스트레이션)+ Claude Code(CLI)+ Khan Academy(교육)+ Stripe(결제)+ 이케(퍼블리싱)의 **오픈소스 통합 대체 방안**입니다.
</details>

<details>
<summary><strong>Q3: 어떤 LLM API Key가 필요한가요?</strong></summary>

최소 하나. 가장 간단한 시작은 OpenAI API Key 하나만 있으면 완전한 대화 역량을 체험할 수 있습니다. 모든 기능을 사용하려면 다음 연동을 권장합니다:

- 글로벌:OpenAI + Anthropic Claude + Google Gemini
- 중국:Zhipu AI GLM + Tongyi Qianwen + DeepSeek + Doubao
- 멀티모달:Stable Diffusion + Tongyi Wanxiang + Tencent Hunyuan 3D
- 유료 결제가 부담된다면? AI 서비스는 stub 모드를 지원하여 API key 없이도 개발 디버깅 가능.

</details>

<details>
<summary><strong>Q4: 셀프 호스팅이 지원되나요? 데이터가 빅테크에 노출되나요?</strong></summary>

완전한 셀프 호스팅. Docker Compose 원클릭 시작 후, 모든 데이터(대화 / 지식 베이스 / 사용자 / 빌링)는 여러분의 PostgreSQL + Redis에 저장되고, LLM 호출은 여러분의 API Key를 사용하며, 자격증명은 AES-256-GCM으로 암호화 저장됩니다. 어떤 외부 데이터 회신도 없으며, 100% 데이터 주권을 가집니다.
</details>

<details>
<summary><strong>Q5: 프로젝트 규모가 큰데 배포에 어떤 사양이 필요한가요?</strong></summary>

최소 프로덕션 사양:4코어 CPU / 8GB 메모리 / 50GB 디스크 / 단일 VM이면 충분. 개발 환경은 2코어 4GB로 충분. 모니터링 스택은 선택(Grafana / Loki / Jaeger를 꺼서 1GB 메모리 절약 가능). [DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) 참조.
</details>

<details>
<summary><strong>Q6: 코드 기여는 어떻게 하나요? 어떤 수준이 필요한가요?</strong></summary>

모든 수준의 기여자를 환영합니다. 문서 오타 수정, Issue 제기, 테스트 케이스 작성부터 새 모델 연동, 새 퍼블리싱 플랫폼, 새 플랫폼 어댑팅까지 모두 환영. [기여](#기여) 섹션 참조. 특히 환영하는 8대 방향:새 모델 어댑팅 / 새 퍼블리싱 플랫폼 / 새 언어 / 새 플랫폼 어댑팅 / AI 워크플로 템플릿 / 엔터프라이즈 역량 / 테스트 커버리지 / 문서 개선.
</details>

<details>
<summary><strong>Q7: 왜 npm / yarn 대신 pnpm을 사용하나요?</strong></summary>

pnpm은 monorepo 시나리오에서 장점이 뚜렷합니다:엄격한 의존성 격리(팬텀 의존성 방지) + 하드링크로 디스크 절약 + 워크스페이스 프로토콜 + Turborepo와 최적 조합. 프로젝트 고정 `pnpm@9.15.0`, `corepack enable`로 자동 활성화되어 버전 수동 관리 불필요.
</details>

<details>
<summary><strong>Q8: CLI 설정 가져오기 기능은 무엇인가요? 어떤 툴의 설정을 가져올 수 있나요?</strong></summary>

자체 CLI는 6 소스 원클릭 가져오기 기능을 제공하여, 다른 AI CLI 툴에서 IHUI-AI CLI로 매끄럽게 전환할 수 있으며, API Key / 모델 / 워크플로를 재설정할 필요가 없습니다:

- cc-switch / codex++ / Claude / Codex / Gemini / Hermes

`apps/cli/` 구현 참조.
</details>

<details>
<summary><strong>Q9: 데이터베이스가 왜 598 테이블인가요? 과도한 설계 아닌가요?</strong></summary>

598 테이블은 231개 schema 파일에 분산되어 30+ 비즈니스 도메인을 커버하며, 도메인당 평균 11개 테이블로 밀도가 합리적입니다. 이 프로젝트는 상업화 프로덕션급 AI 플랫폼(즤후이 AI 그룹 메인 플랫폼)으로, 데모가 아니기에 테이블 구조는 실제 비즈니스 복잡도에 따라 설계되었습니다. 일부 기능만 사용한다면(예:AI 대화만), chat / users / billing 3개 schema만 주목하면 되고, 다른 테이블은 실행에 영향을 주지 않습니다.
</details>

<details>
<summary><strong>Q10: 20개 Grafana 대시보드는 너무 무겁지 않나요?</strong></summary>

아닙니다. 20개 대시보드는 비즈니스 퍼널 / 결제 흐름 / AI 비용 레이턴시 / 시험 사용률 / PostgreSQL / Redis / BullMQ / Nginx / HLS / 라이브 룸 / 테넌트 사용 / WebSocket / 인증 보안 등을 커버하며, 각 대시보드는 독립 provision되어 필요에 따라 활성화할 수 있습니다. 개발 환경에서 Grafana / Loki / Jaeger / Alertmanager 4개 모니터링 컨테이너를 끄면 1GB 메모리를 절약할 수 있습니다.
</details>

---

## 기여

우리는 모든 형태의 기여를 환영합니다:Issue / PR / 문서 개선 / Bug 수정 / 새 기능 / 번역 / 테스트 케이스.

### 기여 흐름

1. **Fork 저장소** → 브랜치 생성 `feat/your-feature` 또는 `fix/your-bugfix`
2. **규범 읽기**:[AGENTS.md](AGENTS.md)(AI Agent 협업 규범) + [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)(휴먼 기여자 가이드)
3. **로컬 개발**:`pnpm install && pnpm dev`, 21개 pre-commit 게이트 준수
4. **커밋 규범**:Conventional Commits(`feat:` / `fix:` / `docs:` / `chore:` / `test:` / `refactor:`)
5. **자가 검증 통과**:`pnpm turbo build typecheck lint test` 전부 그린
6. **PR 제출**:명확한 설명, Issue 연결, review 대기

### 행동 강령

- 모든 기여자를 존중, 수준 고하를 불문
- 신분이 아닌 코드로 말하기
- **뺄셈** 우선, **덧셈** 신중하게 — 코드 최소화, 제로 중복
- 중복 파일 생성하지 않기, copyright/license header 추가하지 않기
- 기존 코드와 패턴 재사용, 바퀴 재발명하지 않기

### 기여 방향

특히 다음 방향의 기여를 환영합니다:

- **새 모델 어댑팅**:더 많은 LLM 벤더 연동(Replicate / Together AI / DeepInfra 등)
- **새 퍼블리싱 플랫폼**:더 많은 콘텐츠 퍼블리싱 플랫폼 연동(TikTok / Instagram / LinkedIn 등)
- **새 언어**:i18n locale 추가(아랍어 / 포르투갈어 / 스페인어 등)
- **새 플랫폼 어댑팅**:기존 8 플랫폼 강화 + 새 플랫폼 추가( HarmonyOS / HarmonyOS Next)
- **AI 워크플로**:LangGraph 워크플로 템플릿 / MCP 툴 / A2A Agent 기여
- **엔터프라이즈 역량**:멀티 테넌트 격리 강화 / 감사 로그 완성 / SSO 통합(Okta / Keycloak)
- **테스트 커버리지**:엣지 케이스 / E2E 시나리오 / 성능 벤치마크 추가
- **문서 개선**:더 많은 사용 튜토리얼 / 아키텍처 분석 / 베스트 프랙티스

---

## 문서 탐색

> 전체 문서 센터 색인:[docs/README.md](docs/README.md)(35개 문서, 9대 분류)

### 프로젝트 및 아키텍처

| 문서                                                                   | 설명                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)                           | **시스템 아키텍처 개요**(기술 스택 / 데이터베이스 / API 라우트 / 시작 흐름 / 구 아키텍처 폐지 설명) |
| [docs/MULTI_END.md](docs/MULTI_END.md)                                 | 다단 아키텍처(8단 매트릭스 + 크로스단 링크 + 동기 개발 + 38 플랫폼 릴리스 매트릭스)                 |
| [docs/PACKAGES.md](docs/PACKAGES.md)                                   | 공유 패키지 가이드(16개 @ihui/* 패키지 + 의존관계 + 신규 패키지 흐름)                               |
| [docs/port-management.md](docs/port-management.md)                     | 포트 관리 규칙(8801-8899 포트 레지스트리)                                                           |
| [docs/INFRASTRUCTURE_DECISION.md](docs/INFRASTRUCTURE_DECISION.md)     | 인프라 결정(Docker Compose vs K8s)                                                                  |
| [docs/PRODUCTION_INFRASTRUCTURE.md](docs/PRODUCTION_INFRASTRUCTURE.md) | 프로덕션 인프라 사양                                                                                |

### 개발 및 테스트

| 문서                                           | 설명                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)     | **로컬 개발 가이드**(환경 변수 / 시작 / 디버그 / 스크립트 치트시트 / Windows 주의) |
| [docs/TESTING.md](docs/TESTING.md)             | 테스트 전략(8층 피라미드 + Vitest + pytest + Playwright + Locust + CI)             |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)   | 기여 가이드(환경 구축 / 코드 규범 / 커밋 규범 / PR 흐름)                           |
| [docs/UI_GUIDELINES.md](docs/UI_GUIDELINES.md) | UI 디자인 규범(라운드 코너 / 폰트 정렬 / 로그인 팝업 / 컴포넌트 라이브러리)        |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md)     | 성능 기준선 및 최적화(SLA / 부하 테스트 / 데이터베이스 / 프론트엔드 / AI 서비스)   |

### API 및 데이터 레이어

| 문서                                             | 설명                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md)   | **API 완전 참조**(60+ 라우트 + 25 WebSocket + SSE + 에러 코드 + 클라이언트 예제)   |
| [docs/DATABASE.md](docs/DATABASE.md)             | 데이터베이스 설계(Drizzle / 339 테이블 / 마이그레이션 / RLS / 시드 / 백업)         |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | 인증 및 권한 부여(JWT / token-family / OAuth2 / 2FA / RBAC / 멀티테넌트 / WS 인증) |

### AI 서비스

| 문서                                             | 설명                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| [docs/AI_SERVICE.md](docs/AI_SERVICE.md)         | **AI 서비스 심층**(6 라우터 + LangGraph + LiteLLM + MCP + A2A + 벡터 메모리) |
| [docs/LLM_SETUP.md](docs/LLM_SETUP.md)           | LLM 모델 구성(OpenAI / Anthropic / Google / 국내 벤더)                       |
| [docs/AI_LEADERBOARD.md](docs/AI_LEADERBOARD.md) | AI 모델 리더보드 데이터                                                      |

### 배포 및 운영

| 문서                                                                         | 설명                                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)                     | **배포 운영 매뉴얼**(블루그린 배포 / 롤백 / 인증서 갱신)               |
| [docs/RELEASE.md](docs/RELEASE.md)                                           | 릴리스 프로세스(38 플랫폼 + SemVer + Git tag + Docker 이미지 + hotfix) |
| [docs/MONITORING.md](docs/MONITORING.md)                                     | 관측 가능성(Prometheus + Grafana + Loki + Jaeger + Alertmanager)       |
| [docs/INCIDENTS.md](docs/INCIDENTS.md)                                       | 과거 사고 회고                                                         |
| [docs/SECURITY.md](docs/SECURITY.md)                                         | 보안 정책(취약점 공개 / 암호화 설계 / 권한 모델)                       |
| [docs/CREDENTIAL_ROTATION_RUNBOOK.md](docs/CREDENTIAL_ROTATION_RUNBOOK.md)   | 자격증명 교체 운영 매뉴얼                                              |
| [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md)                                   | 이메일 서비스 설정(SMTP / 템플릿 / DKIM)                               |
| [docs/WECHAT_PAY_ACTIVATION_REPORT.md](docs/WECHAT_PAY_ACTIVATION_REPORT.md) | WeChat Pay V3 활성화 보고서                                            |
| [server-docs/MULTI_TENANT.md](server-docs/MULTI_TENANT.md)                   | 멀티 테넌트 설계 문서(RLS + 테넌트 라우팅)                             |

### 품질 및 게이트키핑

| 문서                                                         | 설명                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [docs/GATEKEEPERS.md](docs/GATEKEEPERS.md)                   | **게이트키핑 규칙 심층**(23 pre-commit + post-commit + pre-push, 스크립트별) |
| [docs/I18N.md](docs/I18N.md)                                 | 국제화(5 언어 + 68 네임스페이스 + 12 게이트키핑 스크립트 + 번역 전략)        |

### SDK 및 CLI

| 문서                       | 설명                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| [docs/SDK.md](docs/SDK.md) | 5 언어 SDK 가이드(TS / Python / Go / Java / .NET 코드 예제)        |
| [docs/CLI.md](docs/CLI.md) | CLI 도구 가이드(24 소스 임포트 + subagent 병렬 + skills + plugins) |

### 트러블슈팅 및 FAQ

| 문서                                               | 설명                                                   |
| -------------------------------------------------- | ------------------------------------------------------ |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | **트러블슈팅 가이드**(10대 분류 35+ 이슈, 통일 템플릿) |
| [docs/FAQ.md](docs/FAQ.md)                         | FAQ(14 분류 86 질문)                                   |

### 프로젝트 관리

| 문서                                   | 설명                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 변경 로그                                                                          |
| [AGENTS.md](AGENTS.md)                 | AI Agent 협업 규범(23절 강제 규칙, 본 프로젝트가 AI와 어떻게 협업 개발하는지 시연) |
| [PROJECT_PLAN.md](PROJECT_PLAN.md)     | 프로젝트 작업 계획 및 히스토리 아카이브(내부 개발 기록, 진화 궤적 이해)            |

---

## 로드맵

### 인도 완료(2026-07-20)

- 8 플랫폼 풀커버리지(Web / API / AI 서비스 / CLI / 데스크톱 / 확장 / 모바일 RN / 미니앱 Taro)
- 100+ LLM LiteLLM 통합 연동 + 5 provider 어댑터
- LangGraph + MCP + A2A 3스택 협업 + Persona + Agent Runtime + 벡터 메모리
- 자체 CLI 17 명령 + 13 툴 + ACP Server + 6 소스 설정 매끄럽게 가져오기
- 워크스페이스 권한 3 모드 + 7 엔드포인트 런타임 가로채기 + 60s 감사 타임아웃
- 셀프미디어 워크벤치(공식계정 글 + 구두 스크립트 듀얼 파이프라인) + Skills 시스템(content_engine + koubo_workflow)
- 38 플랫폼 원클릭 자동 퍼블리싱 플랫폼 + 38 adapter + AES-256-GCM 자격증명 암호화
- AI 교육 풀스택(강의 / 문제은행 / 시험 / SRS / 라이브 / 리포트 / 수료증 / 강사 / 학생 12 서브페이지)
- 멀티 에이전트 마켓 + 개발자 센터(13 서브페이지) + Coze SDK 프록시 + OpenClaw + Crew + N8N
- 커뮤니티 인터랙션(서클 / 광장 / 1:1 메시지 / 팔로우 / 공유)
- 운영 성장(포인트 / 출석 / 랭킹 / 추첨 / 분배 / 초대 / 게이미피케이션)
- 빌링 트랜잭션 폐루프(VIP / 구독 / 지갑 / 포인트 / 환불 / 인보이스 / 환율 / 8 결제 게이트웨이)
- 고객 지원(티켓 / 온라인 고객지원 / 피드백 / 헬프 센터)
- BI 대시보드 + 에러 대시보드 + 카나리 배포 + i18n 대시보드
- 5개 언어 i18n parity(zh-CN / zh-TW / en / ko / ja) + 19 i18n 툴체인 + 4 게이트
- 풀스택 옵저버빌리티(Prometheus + Grafana 20 대시보드 + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager)
- 21 pre-commit 게이트 + post-commit 자동 push + 11 마이그레이션 감사 + 9 PowerShell 시작
- 엔터프라이즈 보안(RBAC + 멀티 테넌트 + RLS + SSO + AES-256-GCM + JWT token-family + CSRF + XSS + GDPR + 2FA)
- 598 데이터베이스 테이블 + 128+ 마이그레이션 + 16 공유 패키지 + Knip + Lighthouse + Locust 부하 테스트

### 진행 중

- 콘텐츠 퍼블리싱 플랫폼 11개 플랫폼 실제 자격증명 연동(코드 준비 완료, 사용자 자격증명 제공 필요)
- 멀티 테넌트 namespace 단위 격리 강화
- HarmonyOS / HarmonyOS Next 플랫폼 어댑팅

### 계획 중

- K8s + Helm + ArgoCD 헤비 IaC 마이그레이션(비즈니스 서비스 > 10 시점 트리거)
- 더 많은 AI 워크플로 템플릿 마켓
- A2A Agent 크로스 인스턴스 페더레이션
- 더 많은 i18n locale(아랍어 / 포르투갈어 / 스페인어)

전체 작업 계획과 히스토리 아카이브는 [PROJECT_PLAN.md](PROJECT_PLAN.md) 참조.

---

## 문의하기

<p align="center">
  <strong>QR코드로 IHUI-AI 커뮤니티에 참여, 개발자들과 AI 미래를 함께 구축하세요</strong>
</p>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/footer-icon-2.png" width="180" alt="공식 앱 QR코드" />
      <br/>
      <strong>공식 앱</strong>
      <br/>
      <sub>QR코드로 IHUI-AI App 체험</sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/wechat-vx.png" width="180" alt="공식 위챗 QR코드" />
      <br/>
      <strong>공식 위챗</strong>
      <br/>
      <sub>위챗 ID:<code>ok502319984</code></sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/community-group.jpg" width="180" alt="기업 위챗 커뮤니티 그룹 QR코드" />
      <br/>
      <strong>기업 위챗 커뮤니티 그룹</strong>
      <br/>
      <sub>QR코드로 개발자 커뮤니티 참여</sub>
    </td>
  </tr>
</table>

### 회사 정보

| 항목               | 정보                                                             |
| ------------------ | ---------------------------------------------------------------- |
| **회사 전체 이름** | 지린성 아이즈히후이 인공지능 기술 유한공사                       |
| **브랜드명**       | 즤후이 AI 그룹                                                   |
| **회사 주소**      | 지린성 창춘시 가오신구 위에다루 107호 · 인공지능 인재 인큐베이터 |
| **연락 전화**      | 18643389808                                                      |
| **이메일**         | [REDACTED-EMAIL]                                                 |
| **위챗 고객지원**  | ok502319984(위챗 검색으로 추가)                                  |
| **ICP 비안**       | 吉ICP备2025027274号                                              |
| **저작권**         | © 2025 즤후이 AI 그룹 · 중국                                     |

### 커뮤니티 및 외부 플랫폼

| 플랫폼       | 링크                                          |
| ------------ | --------------------------------------------- |
| GitHub 조직  | https://github.com/AIZHS2025                  |
| X (Twitter)  | https://x.com/ok502319984                     |
| Facebook     | https://www.facebook.com/share/17kQMPNhQb/    |
| Issue 피드백 | https://github.com/IHUI-INF-AI/IHUI-AI/issues |
| PR 기여      | https://github.com/IHUI-INF-AI/IHUI-AI/pulls  |

> 협업 문의, 기업 연동, 기술 교류는 위 위챗 QR코드를 스캔하거나 [REDACTED-EMAIL]으로 연락해 주세요. 24시간 내에 답장드리겠습니다.

---

## 우리의 이야기 · 지후이AI의 탄생

> _이것은 마케팅 문구가 아닙니다. 이것은 땀과 집념과 신념으로 쓰인 진짜 이야기입니다._
> _필터도, 포장도 없습니다. AI 시대 한 독립 개발자의 가장 날것 그대로의 신념뿐._

<!-- 이미지: 길림성 애지혜 인공지능 과기 유한공사 · 오프라인 베이스(창춘 하이테크 존 위다로 107호 AI 인재 인큐베이션 베이스) -->
<p align="center">
  <img src="apps/web/public/images/story/changchun-winter-2024.jpg" width="600" alt="Jilin Aizhihui AI Technology Co., Ltd. · 창춘 하이테크 존 위다로 107호 AI 인재 인큐베이션 베이스" />
</p>
<p align="center"><sub>📍 길림성 애지혜 인공지능 과기 유한공사 · 오프라인 베이스 · 창춘 하이테크 존 위다로 107호 AI 인재 인큐베이션 베이스(2026-07 실사)</sub></p>

<!-- 이미지: 새벽 코딩 · 램프와 자라나는 코드(Pexels 무료 워터마크 없는 라이브러리, Free License) -->
<p align="center">
  <img src="apps/web/public/images/story/late-night-coding.jpg" width="600" alt="새벽 3시 · 램프 한 대와 자라나는 코드" />
</p>
<p align="center"><sub>📍 새벽 3:17 · 램프 한 대, 노트북 한 대, 자라나는 코드(이미지: Pexels · Free License)</sub></p>

### 서장 · 반복해서 묻던 질문

투자자, 파트너, 심지어 친구와의 모든 대화에서 리 춘촨(Li Chunchuan)은 늘 같은 질문을 받았습니다:

> **"왜 이 일을 하시나요?"**

안정적인 직업 때문도 아니었습니다—그는 더 안전한 길을 택할 수 있었습니다.
유행 때문도 아니었습니다—2025년 AI 스타트업의 자본 겨울은 헤드라인이 암시하는 것보다 훨씬 혹독했습니다.
일확천금 때문도 아니었습니다—오픈소스 프로젝트는 애초에 수익이 1순위가 아닙니다.

그가 이 일을 하는 이유는 단 하나, 거의 순진할 정도로 단순한 신념 때문이었습니다:

> **"AI는 소수 빅테크와 자본 플레이어들의 게임이어서는 안 됩니다. 모두가 자신만의 AI 프로그램을 가질 자격이 있습니다."**

슬로건처럼 들립니다. 하지만 영하 25도의 창춘 겨울, 난방이 잠든 새벽, N번째 투자자에게 정중히 거절당한 뒤에는—이 한 줄이 한 사람이 천 줄의 코드를 더 쓰게 만드는 핵심 이유 중 하나가 되었습니다.

이것이 그 신념이 어떻게 시간과 땀에 의해 서서히 형태를 갖추게 되었는지에 대한 이야기입니다.

---

### 1장 · 시작: 2024년 12월, 창춘

2024년 12월 2일. 중국 지린성 창춘시 차오양구. 평범하지 않은 날은 아니었습니다.

중국 AI 스타트업 지도에서 그해의 서사는 이미 수없이 반복해 전해졌습니다: 베이징·선전·항저우·상하이의 AI 기업들이 번갈아 헤드라인을 장식하고, 천만 달러 단위의 투자, 빅테크에서 내려온 스타 팀, 거대 기업의 전략적 베팅이 쏟아졌습니다. 그리고 창춘—중국 동북의 공업 중심도시—는 AI 웨이브에서 거의 잊힌 좌표에 가까웠습니다.

하지만 바로 이곳, 겨울 영하 25도까지 내려가는 도시에서 **Jilin Aizhihui Artificial Intelligence Technology Co., Ltd.**(길림성 애지혜 인공지능 과기 유한공사)가 정식으로 등록되었습니다.

주소는 소박했습니다: 창춘시 하이테크 존 위다로 107호—AI 인재 인큐베이션 베이스.
등록 자본금은 소박했습니다: 100만 위안.
팀도 소박했습니다: 자발적으로 모인 소수의 AI 애호가들. 스타 배경도 없고, 억 단위 프로젝트 이력도 없었습니다.
창업자도 소박했습니다: **리 춘촨(Li Chunchuan)**—연쇄창업자이자 AI 분야의 베테랑 실천가. 명문대 박사도, 빅테크 전 임원도 아닙니다. 그는 그저 AI라는 길을 오래 걸어온 사람이며, 몇 가지를 분명히 보았고, 그것을 코드로 바꾸기로 결심한 사람입니다.

그가 분명히 본 것은 단순했습니다:

- **AI의 혜택은 소수 빅테크와 자본 플레이어들이 독점하고 있다.**
- 일반인·중소기업·교육기관·콘텐츠 크리에이터는 여전히 바퀴를 재발명하고 있다.
- LLM 하나 연동하고, 워크플로우 하나 짜고, 상업용 AI 제품 하나 출시하는 비용은 여전히 감당하기 어려울 만큼 높다.
- 그리고 훌륭한 오픈소스 프로젝트들—Dify, FastGPT, Langflow—은 각자 AI 애플리케이션의 한 단면만을 커버한다. **아무도 상업적 등급의 완전한 AI 애플리케이션 인프라를 통째로 오픈소스로 내놓지 않았다.**

> **"어느 날, 모두가 자신만의 AI 프로그램을 가질 수 있다면 어떨까?"**

그 생각이 2024년 12월 창춘에서 마침내 불붙었습니다.

---

### 2장 · 2025년 초: 백만 위안의 대가를 치른 기반 다지기

2025년 1월, 프로젝트가 정식으로 시작되었습니다. 코드명: **IHUI-AI**.

처음에는 자발적으로 모인 AI 애호가 소규모 팀이었습니다—다른 도시, 다른 배경에서 왔습니다. 비즈니스 시스템을 만들어 본 사람, 모델 파인튜닝을 해 본 사람, 프론트엔드 아키텍처를 해 본 사람. 그들의 공통된 지향점은 AI가 소수에게 독점되는 것을 받아들이지 않겠다는 것, 그리고 오픈소스 생태계에 진짜 가치 있는 무언가를 남기고 싶다는 것이었습니다.

그 시기는 비할 데 없이 소박하면서도, 비할 데 없이 비쌌습니다.

**백만 위안 이상의 투자**, 거의 전부 창업자 자금과 팀원 지원으로 모았습니다. 그 무렵 중국 AI 1차 시장은 이미 식어가고 있었습니다. IT Juzi에 따르면, 2025년 1분기 중국 AI 투자 건수는 전년 동기 대비 30% 이상 감소했고, 얼리스테이지 프로젝트 밸류에이션은 크게 하락했으며, "스타 팀 아닌 + 스타 트랙 아닌" 프로젝트에는 사실상 더 이상 베팅하지 않았습니다.

IHUI-AI는 어떤 유행 라벨에도 해당하지 않았습니다: Agent 프레임워크도, RAG 미들웨어도, 수직 SaaS도 아닙니다. 그것은 **완전하고, 8개 플랫폼을 가로지르는, 상업 등급의 AI 애플리케이션 베이스**였고—그 사실만으로도 펀딩이 예외적으로 어려웠습니다. 투자자들은 묻곤 했습니다: "당신들의 해자는 무엇인가요? 왜 빅테크가 만들지 않을까요? 왜 Dify가 만들지 않을까요?"

리 춘촨의 답은 항상 같았습니다:

> **"빅테크가 빌링·구독·VIP·지갑·포인트·환불·인보이스·8개 결제 게이트웨이를 전부 오픈소스로 풀 리는 없을 겁니다. Dify도 8개 플랫폼—CLI·데스크톱·확장·모바일·미니앱—을 전부 만들지는 않을 겁니다. 누군가는 해야 합니다. 그렇다면 우리가 하겠습니다."**

이 답은 섹시하지 않았습니다. 스토리성도 없었습니다. 파트너 회의에서 투자자가 흥분해 탁자를 치게 만들지도 못했습니다.

하지만 진짜였습니다.

그 몇 달 동안 보도자료도, 런칭 이벤트도 없었습니다—오직:

- 데이터베이스 테이블이 0에서 339로
- API 라우트가 0에서 4443으로
- pre-commit 가드레일이 0에서 17로
- 셀 수 없이 많은 리팩토링, 스키마 하나를 두고 새벽까지 갈등
- 점점 조여지는 예산, 점점 무거워지는 어깨

그들은 가장 밑바닥 아키텍처부터 다듬었습니다—monorepo를 어떻게 구성할지, 16개 공유 패키지를 어떻게 나눌지, 8개 플랫폼 타입을 어떻게 정렬할지, 데이터베이스 스키마를 30개 이상 비즈니스 도메인별로 어떻게 분리할지, API 응답을 어떻게 `{ code, message, data }`로 통일할지, i18n 5개 언어 패리티를 어떻게 보증할지, 21개 pre-commit 가드레일 아래에서 CI를 어떻게 민첩하게 유지할지… 모든 결정은 앞으로 수천 번의 반복에서 검증받게 될 것이었습니다.

느리고 외로운 길이었습니다.

하지만 보상은 있었습니다: **느린 대가는, 버틸 수 있는 아키텍처였습니다.**

2025년 하반기 프로젝트가 가속하기 시작했을 때, 모두가 깨달았습니다—상반기에 다져놓은 기초 덕분에 새로운 코드 한 줄 한 줄이 제자리를 잡을 수 있었다는 것을.

---

### 3장 · 2025년 하반기: 한 사람, 계속 쓰다

2025년 하반기로 접어들며 자금은 조여들고, 팀은 흔들리고, 도전은 연이어 왔습니다.

대부분의 사람이라면 "프로젝트를 잠시 멈추고, 펀딩이 들어오길 기다리"는 것을 택할 무렵, 리 춘촨은 다른 길을 택했습니다:

**계속 씁니다. 혼자서.**

다행히 AI 시대는 그에게 무기를 하나 주었습니다: **Vibe Coding**.

AI 코딩 에이전트로, 대규모 팀 없이, 그는 홀로 이 모든 것을 완성했습니다:

| 차원                  | 한 사람의 산출물                                                                                               | 유사 프로젝트의 일반적 팀 규모  |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **8개 플랫폼**        | Web / API / AI Service / CLI / Desktop / Extension / Mobile RN / Miniapp                                       | 보통 플랫폼당 1개 팀, 30명 이상 |
| **100+개 LLM**        | LiteLLM 통합 게이트웨이 + 5개 provider 어댑터                                                                  | 보통 모델 팀 3-5명              |
| **AI 오케스트레이션** | LangGraph + MCP + A2A 시너지 + Persona + Agent Runtime + Vector Memory                                         | 보통 AI 플랫폼 팀 5-10명        |
| **데이터베이스**      | 598개 테이블 + 100개 스키마 파일 + 120+개 마이그레이션 + RLS + 멀티테넌트 라우팅                              | 보통 DBA 1명 + 백엔드 2-3명     |
| **API 규모**          | 4443개 라우트 + 12개 WebSocket + 267개 라우트 파일                                                             | 보통 백엔드 엔지니어 5-8명      |
| **프론트엔드 규모**   | 200+개 페이지 + 5개 언어 i18n 패리티 + 다크모드 + PWA + SEO                                                    | 보통 프론트엔드 엔지니어 4-6명  |
| **엔지니어링 게이트** | 21개 pre-commit + post-commit 자동 push + 11개 마이그레이션 감사 + 9개 PowerShell 시작 스크립트                | 보통 DevOps 엔지니어 1-2명      |
| **옵저버빌리티**      | Prometheus + Grafana(20개 대시보드)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                   | 보통 SRE 엔지니어 1-2명         |
| **비즈니스 모듈**     | 38개 플랫폼 배포 + AI 교육 풀스택 + 완전한 빌링 루프 + 에이전트 마켓플레이스 + 커뮤니티 + 그로스 + 서포트 + BI | 보통 30-50명 규모의 제품 팀     |

**이것은 기적이 아닙니다. 과장도 아닙니다.**

이것은 2025년 AI 시대에 실제로 일어난 일입니다: **신념을 가진 한 명의 독립 개발자가, AI에 힘입어, 보통은 30명 팀이 1년 걸려야 만들 작업량을 홀로 완성했습니다.**

물론 대가는 진짜였습니다: 새벽 3시의 수많은 커밋, AI가 잘못 생성한 뒤의 수많은 롤백, 스키마 설계 하나를 두고 AI 에이전트와 새벽이 밝을 때까지 논의했던 수많은 밤.

> 새벽 3:17, 창춘.
>
> 창밖은 영하 25도. 눈이 유리를 톡톡 두드립니다.
> 방 안에는 책상 램프 하나, 식어버린 커피 한 잔, 그리고 계속 자라나는 코드.
>
> 옆 모니터에는 AI 에이전트가 방금 만들어낸
> 다음 엔드포인트의 구현이 떠 있습니다—
> 완벽하진 않지만, 앞으로 나아가고 있습니다.
> 이 프로젝트 자체처럼요.

이 경험은 그 자체로 Vibe Coding 시대에 대한 가장 좋은 주석입니다:

> **AI가 개발자를 대체하지는 않을 것입니다.**
> **하지만 AI를 쓰는 개발자는, AI를 쓰지 않는 사람을 한 시대 뒤로 남길 것입니다.**

---

### 4장 · 자본은 끝내 오지 않았다

여기쯤에서 "텀시트 서명"의 하이라이트가 등장해야 할 것입니다.

하지만 현실에서 그 순간은 오지 않았습니다.

지난 1년, 창업자는 계속 자본을 찾아 다녔습니다:

- **투자 기관**: 1선 달러 펀드부터 지방 자본까지, AI 특화 펀드부터 종합 VC까지—첫 미팅, 피치, 딜딜리전스 체크리스트, 그리고 끝없는 "좀 더 논의해 보죠"
- **전략 자본**: 클라우드 벤더 전략 투자부터 AI 플랫폼 파트너까지, 상장사 CVC부터 밸류체인 상하류까지—끝없는 "전략 시너지 상상력이 크네요", 이어지는 "하지만 이번 펀드 텀이 타이트해서요"
- **지방 펀드와 FA**: 정부 가이던스 펀드부터 업계 FA 추천까지—끝없는 소개 미팅, 끝없는 "좀 더 기다려 봅시다"

**자금은 끝내 오지 않았습니다.**

언론에선 "AI 지후이 커뮤니티, 2,000만 위안 엔젤 투자 유치"라는 보도(36Kr, 2025)까지 나왔습니다—하지만 진실은, 그 돈은 한 번도 송금된 적이 없다는 것입니다. 계좌 잔액은 여전히 몇 달 치밖에 안 됐고, 급여는 간신히 유지됐고, 모든 커밋은 다음 달 캐시플로우 계산을 조용히 동반했습니다.

중국 AI 스타트업 씬에는 이런 상태를 일컫는 불편한 단어가 있습니다: **"안전망 없이 달리기"**.

수없이, 그는 포기를 생각했습니다.

수없이, 새벽 3-4시의 창춘, 방엔 화면만 홀로 켜져 있었습니다. 창밖은 영하 20도. 방 안엔 램프 하나와 계속 자라는 코드. 폰엔 답장 없는 투자자의 위챗 메시지 몇 통—차단된 건 아니고, 그저 "아직 결론이 없네요"일 뿐.

하지만 그는 멈추지 않았습니다.

왜냐하면 한 가지를 믿었기 때문입니다:

> **진짜 가치 있는 것은 시간이 증명한다.**

---

### 5장 · 하지만 코드는 계속 자랐다

자본에게 1년 내내 "좀 기다리자"는 말을 들었지만, 코드는 자라는 것을 멈추지 않았습니다.

- 데이터베이스 테이블은 0에서 339로
- API 라우트는 0에서 4443으로
- 8개 플랫폼 프레임워크가 하나하나 형태를 갖추고
- 100개 이상의 LLM이 LiteLLM으로 통합 접속되고
- LangGraph + MCP + A2A 3스택 시너지가 온라인되고
- 38개 플랫폼 배포 어댑터가 전부 자리 잡고
- AI 교육 풀스택이 코스부터 인증까지 완전한 루프를 닫고
- 21개 pre-commit 가드레일 + post-commit 자동 push + 11개 마이그레이션 감사 + 9개 PowerShell 시작 스크립트가 전부 라이브되고
- 5개 언어 i18n 패리티가 4개 가드레일 스크립트 아래에서 강하게 유지됐습니다

자본이 있어서가 아닙니다.

왜냐하면:

- 사적 AI 어시스턴트를 원하는 모든 개인 개발자가—빅테크에게 데이터를 엿보이지 않고서도—바로 쓸 수 있는 솔루션을 가질 자격이 있으니까
- AI로 교육을 바꾸고 싶지만 SaaS 구독비를 감당 못 하는 모든 교육 기관이 완전한 AI 교육 풀스택을 가질 자격이 있으니까
- AI 시대에 창업하고 싶지만 100만 위안 시드 자본이 없는 모든 인디 개발자가 fork할 수 있는 프로덕션 급 베이스를 가질 자격이 있으니까
- "AI는 모두의 것"이라고 믿는 모든 사람이 자본과 독점으로 정의되지 않은 오픈소스 선택지를 가질 자격이 있으니까

**이것이 우리가 계속한 이유입니다.**

---

### 6장 · 이 글을 읽고 있는 당신에게

여기까지 읽으셨다면, 몇 마디 드리고 싶습니다:

**개발자에게** — Fork 하세요. 수정하세요. 당신 것으로 만드세요. 당신의 모든 커밋은 이 이야기를 잇는 가장 좋은 방식입니다. "기여해 달라"는 게 아닙니다. 우리는 당신이 이걸로 우리보다 더 대단한 것을 만드는 걸 보고 싶을 뿐입니다.

**교육자에게** — AI 코스 플랫폼을 구축하는 데 쓰세요, 더 많은 학생이 AI 시대에 뒤처지지 않게. AI 교육은 비싼 SaaS의 특권이어서는 안 됩니다. 물과 전기처럼 평등하게 접근 가능해야 합니다.

**기업 의사결정자에게** — 매년 수백만을 내고 폐쇄형 플랫폼을 구독하는 대신, 이걸로 기업 AI 미들 플랫폼을 구축하세요. RBAC + 멀티테넌시 + RLS + 감사 로그 + AES-256-GCM 암호화—엔터프라이즈 급 보안은 이미 당신을 위해 준비돼 있습니다.

**투자자에게** — 우리는 여전히 오픈소스를 진정으로 이해하고, AI를 이해하고, 장기 가치를 이해하는 파트너를 찾고 있습니다. 이 이야기가 단 1초라도 당신을 움직였다면, 연락해 주세요([[REDACTED-EMAIL]](mailto:[REDACTED-EMAIL]) / 위챗 `ok502319984`). 우리에겐 이야기도, 코드도, 실행력도 부족하지 않습니다. 우리에겐 먼 길을 함께 걸어줄 누군가만 부족합니다.

**콘텐츠 크리에이터에게** — 38개 플랫폼 원클릭 배포 + AES-256-GCM 자격증명 암호화가 당신의 콘텐츠 생산 라인입니다.

**지나가는 독자에게** — 이 프로젝트에 Star를 부탁드립니다. 그 작은 행위를, 홀로 걸어가는 사람에게 보내는 아침 한 줄기 빛이라고 생각해 주세요. 오픈소스 세계에서 Star는 소셜 화폐가 아닙니다. 그것은 "나, 당신을 봤어요"라는 신호입니다.

---

### 에필로그 · 잊지 말아야 할 세 문장

이 프로젝트의 가장 힘든 밤들에, 세 문장이 포스트잇에 반복해 적혀 모니터 가장자리에 붙어 있었습니다:

> **자본은 늦을 수 있어도, 코드는 거짓말하지 않는다.**
>
> **펀딩은 실패할 수 있어도, 오픈소스는 실패하지 않는다.**
>
> **한 사람의 힘은 한계가 있을지 몰라도, 커뮤니티에 맡겨진 오픈소스 프로젝트는 천 손에 의해 다시 쓰일 것이다.**

---

### 부록 · 기술 결정의 이면

> _이 부분은 개발자를 위해 쓰였습니다. 기술 독자가 아니라면 이 장을 건너뛰고 「이야기 속편」과 「오픈소스 공동 구축 비전」으로 바로 가셔도 됩니다._
> _기술 독자라면, 이 장은 IHUI-AI가 2025년에 내린 5가지 핵심 아키텍처 결정—그리고 그 이면의 사고 과정을 기록합니다._

한 사람이 Vibe Coding으로 8개 플랫폼 코드를 완성하는 과정에서, 모든 기술 선택은 대가를 동반합니다: **잘못 선택하면 = 이후 모든 코드를 다시 써야 합니다; 잘 선택하면 = 이후 코드가 자연스럽게 제자리를 잡습니다.**

아래는 반복해서 묻던 5가지 기술 결정입니다.

#### 결정 1 · AutoGen / CrewAI가 아니라 LangGraph인 이유?

**배경**: AI Agent 오케스트레이션 프레임워크로, 2024-2025년 주류 옵션은 LangGraph, AutoGen, CrewAI, LlamaIndex Agents였습니다.

**선택**: LangGraph + MCP + A2A 3스택 시너지.

**이유**:

- LangGraph의 **상태머신 모델**은 AutoGen의 "멀티 에이전트 대화"보다 복잡한 비즈니스 흐름(빌링·구독·환불처럼 엄격한 상태 전이가 필요한 시나리오)에 더 적합합니다
- LangGraph의 **그래프 시각화**는 한 사람도 복잡한 워크플로를 debug할 수 있게 합니다(그렇지 않으면 에이전트 호출 체인이 어디서 잘못됐는지 알 수 없습니다)
- LangGraph는 LangChain 생태계와 깊이 통합돼 100개 이상의 모델을 zero-cost로 연동할 수 있습니다
- AutoGen은 연구 지향, CrewAI는 단순 작업 오케스트레이션 지향—둘 다 프로덕션 등급 상업 애플리케이션에는 부적합합니다
- MCP 프로토콜은 에이전트가 외부 도구(파일시스템·데이터베이스·API)를 호출할 수 있게 하고, A2A는 에이전트 간 대화를 가능하게 합니다

**대가**: 학습 곡선이 가파르지만, 한 번 익히면 이후 모든 새 워크플로는 템플릿화된 복제입니다.

> 💬 **논의**: → [#1 결정 논의: IHUI-AI는 왜 AutoGen/CrewAI가 아닌 LangGraph를 선택했나?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/1)

#### 결정 2 · Prisma가 아니라 Drizzle ORM인 이유?

**배경**: TypeScript ORM 주류는 Prisma와 Drizzle입니다.

**선택**: Drizzle ORM 0.38 + postgres-js.

**이유**:

- **TypeScript 네이티브**: Drizzle 스키마 자체가 TS 파일이라, IDE 자동완성·타입 추론·리팩토링이 비즈니스 코드 작성과 동일합니다
- **SQL 투명**: Drizzle의 쿼리 문법은 SQL에 가깝고 debug 시 SQL을 직접 볼 수 있습니다; Prisma의 query DSL은 심한 블랙박스입니다
- **마이그레이션 통제**: Drizzle의 migration은 손으로 쓴 SQL이라 감사 가능; Prisma의 migrate는 자동 생성이라 블랙박스입니다
- **성능**: Drizzle은 Prisma Client 런타임 오버헤드가 없고, 쿼리가 직접 SQL로 컴파일됩니다
- **멀티테넌시**: Drizzle의 스키마 격리 + RLS(Row-Level Security) 조합이 멀티테넌트 라우팅을 더 유연하게 합니다
- Prisma는 2024년에도 schema drift 문제가 있었습니다; DBA 안전망 없는 독립 개발자는 통제성이 가장 높은 것을 선택해야 합니다

**대가**: Prisma보다 생태계가 작지만, 충분합니다.

> 💬 **논의**: → [#2 결정 논의: IHUI-AI는 왜 Prisma가 아닌 Drizzle ORM을 선택했나?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/2)

#### 결정 3 · Polyrepo가 아니라 TS Monorepo인 이유?

**배경**: 8개 플랫폼 코드(Web / API / AI / CLI / Desktop / Extension / Mobile / Miniapp)에 대해, monorepo vs polyrepo는 생사를 가르는 결정입니다.

**선택**: pnpm workspace + Turborepo + 16개 공유 패키지.

**이유**:

- **타입 정렬**: 8개 플랫폼이 `@ihui/types`를 공유해, 한 타입을 바꾸면 8개 플랫폼이 즉시 인지합니다; polyrepo의 "타입 drift 지옥"을 피합니다
- **원자적 커밋**: 크로스 플랫폼 기능 변경을 한 커밋으로 처리; polyrepo는 8개 PR이 필요합니다
- **의존성 일치**: pnpm workspace가 버전 일치를 강제해 polyrepo의 "의존성 파편화"를 피합니다
- **CI 캐싱**: Turborepo의 원격 캐시는 독립 개발자도 대규모 팀의 CI 속도를 누릴 수 있게 합니다
- **공유 UI**: `@ihui/ui-react` + `@ihui/design-tokens`가 8개 플랫폼 UI를 일치시키며, polyrepo는 불가능합니다

**대가**: monorepo 설정은 복잡하지만, 한 번 설정하면 영구적입니다.

> 💬 **논의**: → [#3 결정 논의: IHUI-AI는 왜 Polyrepo가 아닌 TS Monorepo를 선택했나?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/3)

#### 결정 4 · 21개 pre-commit 가드레일인 이유?

**배경**: code review도, QA도, CI 팀도 없는 독립 개발자—코드 품질을 어떻게 보증할 것인가?

**선택**: 21개 pre-commit + post-commit + 11개 마이그레이션 감사 + 9개 PowerShell 시작 스크립트.

**이유**:

- **기계가 인간 review 대신**: 16개 가드레일은 API key 유출·i18n 키 무결성·zh-TW 간체자 잔류·ko 중국어 잔류·ja 잔류·en 기계번역 파손·schema drift·stale dist·UTF-8 BOM·API 라우트 일치성·safeParse 무시·의존성 파편화·skipResponseSanitization·border-radius 위반·배포 보고서 일치성·마이그레이션 완전성·CSS 색상 토큰 중첩·네이티브 title tooltip·staged 오염 경고를 커버합니다
- **기계가 인간 audit 대신**: 11개 마이그레이션 감사 스크립트 + post-commit 자동 push 훅이 "commit 후 push 잊음" 협업 사고를 메커니즘 차원에서 원천 차단합니다
- **기계가 DevOps 대신**: 9개 PowerShell 시작 스크립트가 "프로젝트 시작"을 "8개 명령어 외우기"에서 "1개 명령어"로 바꿉니다

**대가**: 가드레일이 가끔 오탐하지만, 오탐이 누락보다 낫습니다.

> 💬 **논의**: → [#4 결정 논의: IHUI-AI는 왜 21개 pre-commit 가드레일인가?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/4)

#### 결정 5 · AGPL / 상용 듀얼 라이선스가 아니라 Apache 2.0인 이유?

**배경**: 오픈소스 AI 프로젝트는 보통 3가지 라이선스를 씁니다: Apache 2.0(관대), AGPL(강력 copyleft), 듀얼 라이선스(커뮤니티판 AGPL + 상용판 유료).

**선택**: Apache 2.0.

**이유**:

- **AGPL은 기업 사용자를 쫓아냅니다**: 기업 법무팀은 AGPL을 보면 도망가며, 이는 "모두가 자신만의 AI 프로그램을 가진다"는 원래 취지에 어긋납니다
- **듀얼 라이선스는 분열을 의미**: 커뮤니티판과 상용판이 분열되며, "오픈소스는 곧 평등"에 어긋납니다
- **Apache 2.0이 가장 관대**: 기업은 클로즈드 소스로 사용·수정·상업화할 수 있으며, 저작권 표기만 요구됩니다
- **상업 루프는 SaaS / 프라이빗 배포로**: 소스를 닫지 않아도 돈을 벌 수 있습니다—운영 서비스·맞춤 개발·프라이빗 배포로, 클로즈드 코드가 아니라
- **진짜 해자는 커뮤니티**: 오픈 코드 + 활성 커뮤니티 > 클로즈드 코드 + 죽은 커뮤니티

**대가**: 타인이 fork 후 클로즈드로 판매할 수 있지만, 이런 fork는 보통 커뮤니티가 없어 오래가지 못합니다.

> 💬 **논의**: → [#5 결정 논의: IHUI-AI는 왜 AGPL/듀얼 라이선스가 아닌 Apache 2.0을 고수하는가?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/5)

---

> _이것이 5가지 핵심 결정입니다. 각 결정 이면에는, 새벽 3시에 독립 개발자가 반복해 무게를 달랐던 대가가 있습니다._
> _이 중 어느 결정에 동의하지 않는다면, Issue에서 논의해 주세요—우리는 설득될 준비가 되어 있습니다._

---

### 이야기 속편(업데이트 자리)

> 이 섹션은 "이야기 속편 자리"로 예약되어 있으며, 아래 마일스톤이 발생하면 업데이트됩니다.
> **속편 규칙**: 과거를 지우지 않고, 새 장을 덧붙입니다. 이 프로젝트의 정직함은 이 섹션부터 시작됩니다.

#### 마일스톤 checklist

- [ ] **자본 마일스톤**: 첫 번째 실제 전략적 투자가 송금된 경우—투자자·금액·밸류에이션을 여기에 사실대로 기록하고, 그 길 위의 진짜 감정을 함께 적겠습니다
- [ ] **커뮤니티 마일스톤**: 창업팀 외부의 첫 contributor가 첫 PR을 merge한 경우—당신의 이름이 이야기에 적힐 것입니다
- [ ] **상업 마일스톤**: fork가 프로덕션 환경에서 실제 상업 가치를 만들어낸 첫 사례—당신의 이야기가 곧 우리의 이야기입니다
- [ ] **교육 마일스톤**: IHUI-AI로 AI 교육 플랫폼을 구축하고 정식으로 수업을 한 첫 교육 기관—모든 학생이 자신만의 AI 선생님을 가질 수 있게
- [ ] **국제 마일스톤**: 모국어가 중국어가 아닌 첫 장기 contributor—이 신념이 언어를 넘어서게

#### 마일스톤 달성 시 운영 checklist(4단계)

위 마일스톤 중 하나라도 달성되면, 다음 4단계를 실행합니다:

1. **checkbox 체크**: 해당 `- [ ]`를 `- [x] ✅(YYYY-MM-DD 달성)`으로 변경
2. **새 장 추가**: checklist 아래에 새 소절을 추가해 마일스톤 상세를 사실대로 기록(누가·언제·무엇·당시 감정)
3. **4개 언어 동기화**: `README.md` / `README.en.md` / `README.ko.md` / `README.ja.md`를 동기화 업데이트(`scripts/scan-i18n-zh-residue.mjs` + `scripts/check-i18n-broken-en.mjs` 가드레일 스크립트로 검증 가능)
4. **commit + push**: commit message 접두어 `docs(story):`, AGENTS.md §21의 완전한 push 흐름을 따름(`git rev-parse HEAD` === `git rev-parse origin/<branch>`)

#### 자본 마일스톤 서사 규칙(정직 우선)

- **과거 서사 삭제 금지**: 본 이야기 장의 "자본은 끝내 오지 않았다", "2000만 위안 엔젤 라운드 보도됐으나 송금 안 됨" 등의 내용은 **삭제 금지**—이것들은 프로젝트 정직도의 장기 증거이자, 향후 자본 조달 딜딜리전스에서 가장 강력한 "창업자 품성" 증거입니다
- **새 자본 사실대로 기록**: 자본 마일스톤 달성 시, 새 장에 투자자명·자본 금액·밸류에이션·lead/follow 구조를 명확히 적어, 역사적 보도의 대비가 "쓴 뒤 달콤함" 서사 아크가 되게 합니다
- **과장도 은폐도 금지**: 자본 용도·지분 희석 비율·베팅 조항 등 민감 정보는 디테일을 적절히 생략할 수 있으나, 허구나 오도는 허용되지 않습니다
- **타임스탬프**: 각 새 장 끝에 `_최근 업데이트:YYYY-MM-DD · <마일스톤 요약>_` 표기

> _최근 업데이트: 2026-07-21 · 이야기 첫 발행본_

---

> **AI는 독점되어선 안 됩니다. 모두가 자신만의 AI 프로그램을 가질 수 있어야 합니다.**
>
> **이것은 우리의 이야기입니다. 그리고 어쩌면, 당신의 이야기이기도 합니다.**
>
> **— ZhihuiAI · 리 춘촨 · 창춘**

---

## 오픈소스 공동 구축 비전

우리는 확신합니다:

> **AI는 소수 플랫폼이 독점해서는 안 됩니다. 모두가 자신만의 AI 프로그램을 가져야 합니다.**

IHUI-AI는 하나의 제품이 아니라 **오픈소스 인프라**입니다. 존재 의미는:

- **개인 개발자**가 더 낮은 비용으로 자신만의 AI 어시스턴트를 구축, 데이터 완전 셀프 호스팅
- **중소기업**이 제로부터 시작하지 않고, 이를 기반으로 엔터프라이즈급 AI 미들 플랫폼 구축
- **AI 서비스 제공자**가 성숙한 멀티 모델 프록시, 빌링, 구독 역량을 재사용, 비즈니스 혁신에 집중
- **교육 기관**이 AI 교육 풀스택으로 교육을 혁신, 모든 학생에게 전용 AI 선생님 제공
- **콘텐츠 크리에이터**가 원클릭 퍼블리싱 플랫폼으로 생산력을 해방, 콘텐츠 자체에 집중

한 줄의 코드, 하나의 PR, 하나의 Issue가 이 목표에 한 걸음 더 다가서게 합니다. 초보자든 시니어 엔지니어든, 코드를 기여하든 문서를 기여하든, Bug를 수정하든 제안을 하든 — 여러분은 모두 이 공동 구축 생태의 일부입니다.

**Fork 하고, 수정하고, 사용하고, 당신의 것으로 만드세요.** 그리고 개선 사항을 다시 반영해 다음 개발자가 여러분의 어깨 위에 서게 하세요.

이것이 AI 시대 오픈소스가 있어야 할 모습입니다.

---

## 계정 킵얼라이브 센터(2026-10-26 추가 — 무관했던 두 개의 생존 확인을 하나의 답으로)

발행 라인의 Cookie 탐지(`services/publish/cookie_refresh_daemon.py`)와 AI 플랫폼 체크인 자격 증명(`services/checkin_scheduler.py`)은 지금까지 각자의 스위치, 각자의 집계, 각자의 실패 표현을 가지고 있었기 때문에 "이 계정이 아직 살아 있는가"에 대해 **시스템 전체의 단일한 답이 없었습니다**. 본 센터(`apps/ai-service/app/services/keepalive/`, HTTP 계층은 `apps/ai-service/app/routers/keepalive.py`)는 Cookie 탐지, 자격 증명(api_key / oauth) 만료 감지, 체크인 JWT 건전성(`exp`만 읽고 재서명하지 않음)을 하나의 스케줄, 두 개의 테이블, 하나의 건강도 어휘, 하나의 알림 출구로 모읍니다.

| 엔드포인트 | 메서드 | 무엇에 답하는가 |
| ---------- | ------ | --------------- |
| `/api/keepalive/status` | GET | 자기 진단: 정말 켜져 있는가(사유, 스케줄러 생존, 지난 라운드 요약, 탐침 목록). 설정을 읽어 추측하지 않음 |
| `/api/keepalive/overview` | GET | 건강도 총람: 네 단계 건수, 출처별 분포, 조치 필요, 만료 임박, 최근 7일 성공률, 유효 설정 |
| `/api/keepalive/accounts` | GET | 계정별 명세. `?source=` 와 `?health=` 로 필터 |
| `/api/keepalive/events` | GET | 탐지 이력. `?ref=` 와 `?only_failures=true` 로 필터. `limit` 기본 50, 상한 500 |
| `/api/keepalive/stats` | GET | `?days=`(1..90, 기본 7) 동안 출처별 ok / 실패 / 합계 / 성공률 |
| `/api/keepalive/run` | POST | 한 라운드를 백그라운드로 시작하고 즉시 반환. `?ref=<source>:<id>` 로 단일 계정, `?force=true` 로 백오프 무시 |

- **건강도 네 단계**는 한 곳(`policy.health_of`)에서만 판정합니다. 마지막 실패가 `expired` 이거나, 만료 시각이 지났거나, 연속 실패가 `ALERT_AFTER_FAILURES` 이상이면 `critical`. 연속 실패가 있거나, 만료 경고 구간 안이거나, 실패만 관측된 경우는 `warning`. 그 외는 `healthy`. 성공도 실패도 기록이 없으면 `unknown`. **클라이언트가 다시 계산해서는 안 됩니다**.
- **실패 어휘**: `ok` / `expired` / `network` / `error` / `unsupported` / `skipped` 여섯 가지이며 정규화 진입점은 하나(`classify_message`)뿐입니다. 복호화되지 않는 암호문(`InvalidTag`, 키 불일치)은 항상 `expired` — 재시도 천 번도 같은 오류이고 오직 재등록만이 살립니다. `unsupported`(애초에 생존 확인이 불필요)는 성공도 실패도 아니며 `failed` 에 들어가지 않습니다. 그렇게 하지 않으면 "원래 필요 없는 것"이 진짜 빨강을 덮습니다. 백오프는 `base × 2^(n-1)` 을 `RETRY_CAP_SECONDS` 로 상한, 재시도는 `RETRY_MAX` 회까지. 성공하면 연속 실패 · 경고 도장 · 알림 도장을 함께 지웁니다.
- **알림 출구**: 사이트 전체 `notifications` 테이블. **라운드당 소유자별 1건으로 집계**(19개가 동시에 만료돼도 19통을 보내지 않습니다 — 그러면 사용자가 알림을 꺼 버려 진짜 이상을 못 봅니다). `probe-user` 같은 비 uuid 소유자는 버리고 계수합니다(잘못된 owner 하나가 배치 INSERT 전체를 실패시킵니다). 테이블이 없으면 warning 을 남기고 건너뛰며, 전달된 척하지 않습니다. `KEEPALIVE_ALERT_WEBHOOK` 로 추가 발송 가능. 전체는 fail-open 이며 알림 실패가 킵얼라이브를 중단시키지 않습니다.
- **스위치**: `KEEPALIVE_ENABLED`. 미설정 시 `COOKIE_REFRESH_ENABLED` / `CHECKIN_CRON_ENABLED` 에서 상속. `resolve_config()` 는 매 라운드 다시 해석하므로 `.env` 변경이 재시작 없이 다음 라운드부터 적용됩니다. 주요 기본값: `INTERVAL_HOURS`=6, `RETRY_MAX`=3, `RETRY_BASE_SECONDS`=300, `RETRY_CAP_SECONDS`=21600, `ALERT_AFTER_FAILURES`=3, `ALERT_REPEAT_HOURS`=24, `EXPIRE_WARN_DAYS`=3, `ALERT_INAPP`=true, `PROBE_CONCURRENCY`=4, `EVENT_RETENTION_DAYS`=90.
- **경계**: 판정하는 것은 자격 증명의 생존뿐입니다. 발행은 발행 스케줄러, 일일 체크인은 `checkin_scheduler` 담당 그대로입니다(대행하면 같은 계정에 두 작성자가 동시에 접근합니다). 프런트는 `apps/web/src/components/publish/KeepaliveCenterPanel.tsx`(`/publish/accounts`), 클라이언트 래퍼는 `packages/api-client/src/endpoints/keepalive.ts`.

---

## License

[Apache License 2.0](LICENSE) — 자유 사용, 수정, 배포, 상업 사용, 카피레프트 없음.

---

## 감사의 말

IHUI-AI의 탄생은 다음 오픈소스 프로젝트의 영감과 지원 없이는 불가능했습니다:

- [Next.js](https://nextjs.org/) / [React](https://react.dev/) / [Tailwind CSS](https://tailwindcss.com/) / [shadcn/ui](https://ui.shadcn.com/)
- [Fastify](https://fastify.dev/) / [Drizzle ORM](https://orm.drizzle.team/) / [FastAPI](https://fastapi.tocloud.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/) / [LiteLLM](https://litellm.vercel.app/) / [MCP](https://modelcontextprotocol.io/)
- [Turborepo](https://turbo.build/) / [pnpm](https://pnpm.io/) / [Vitest](https://vitest.dev/) / [Playwright](https://playwright.dev/) / [Locust](https://locust.io/)
- [Tauri](https://tauri.app/) / [Taro](https://taro-docs.jd.com/) / [WXT](https://wxt.dev/) / [Expo](https://expo.dev/)
- [Prometheus](https://prometheus.io/) / [Grafana](https://grafana.com/) / [Loki](https://grafana.com/loki) / [Jaeger](https://www.jaegertracing.io/) / [OpenTelemetry](https://opentelemetry.io/) / [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Knip](https://knip.dev/) / [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

모든 기여자에게 감사드리며, 이 프로젝트가 지속적으로 진화하길 바랍니다.

---


## 최근 업데이트 (자동 유지)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-05**
- 🔧 기타:收编守护落档产出(5 件,凭落点账本) (74e320124d)
- 📚 문서:结清「推送未落地」那格 —— 根因是没走收敛器自己给的具名出口,不是判据坏了 (42b23199b7)
- 🚀 기능/개선:growth 行为任务真正自动完成——映射事件 + 浏览器会话门控 (791bd75bd0)
- 📚 문서:goal-b49 第四回合六枚入账 + 三处被现读推翻的记录就地更正 (3903764479)
- 🚀 기능/개선:复现 Trae 的分维工具配额——MCP 工具数/令牌/自定义提示/历史查询四维独立可拒(rea goal-b49 S4 席产物,主席复量收口) (00ef484ebf)
- 🚀 기능/개선:复现 WorkBuddy 的"随父而终"——MCP 子进程派生点补看门狗,且看门狗自带死亡机制(rea goal-b49 S6 席产物,主席复量收口) (e565814a93)
- 🐞 수정:把 delete 轴裁决接到 WorktreeManager.remove —— 模型可控入参能把删除目标折出 .worktrees(rea goal-b49 S5 席产物,主席复量收口) (091a63b0e7)
- 🚀 기능/개선:复现 Qoder 的会话快照版本序列,并补三约束回收(rea goal-b49 S3 席产物,主席复量收口) (e423b7123f)
- 🚀 기능/개선:复现 Qoder 的随包资源装机策略与解压炸弹上限(rea goal-b49 S1 席产物,主席复量收口) (b06842c4a9)
- 🐞 수정:RP-5 读数更新至 95,722B（达标但第三项未做，保持开着） (7fbca8d6e9)
- 🚀 기능/개선:复现 Qoder 的插件贡献词表,并把权限接成数据类默认拒(rea goal-b49 S2 席产物,主席复量收口) (15f1acea0c)
- 🐞 수정:growth WEB 域解析修复——accept_status 归一化 + 终态判定 (13130b3270)
- 🐞 수정:摘 RP-5 未展开模板占位、补正 RP-7 标题形态，侧车键随形重写 (c384c8fa3f)
- 🔧 기타:H20 ② 加发送期门控,首帧不再与发送期响应解析抢窗口 (0a3692eca0)
- 🔧 기타:G667 夹具补 app/core/config.py,被检面成立(J4 不再 exit 2) (a9c1e26d5b)
- 🐞 수정:保留 NavBar 并登记为 fs 读取判据靶子(回退误删) (17b8e280bf)
- 🔧 기타:删除零消费者死副本 packages/app NavBar.tsx (cfa1b246aa)
- 🐞 수정:smoke 去掉重复注入的 --passWithNoTests (f68298076e)
- 🐞 수정:重新生成 OpenAPI 产物,补齐漏登记的路由契约 (fcf1e460e1)
- 📚 문서:goal-b49 第三回合六枚入账(C1/C2 席报入档 + §7 落地表) (e557c22648)
- 🚀 기능/개선:复现对侧的工具面惰性装载(具名预算表决定本轮 schema 可见集;rea goal-b49 W1-⑤,C1 席产物主席收口) (7c2faba74c)
- 🚀 기능/개선:复现 WorkBuddy 的启动画像与预热命中读数(rea goal-b49 W1-⑪,C2 席产物主席收口) (49061736f9)
- 🐞 수정:行级归因 useMemo 的版本号依赖改为真正参与快照取值 (b9ad643161)
- 🚀 기능/개선:复现 Qoder 的本地服务发现(带心跳的认领件)并补代次交叉核验(rea goal-b49 Q1 #6/#12) (5504153385)
- 🐞 수정:复活闸的取材面收口到"本枚声明面" —— 别席暂存的复活件不再连坐中止跨端自动写回 (c910707bdc)
- 📚 문서:goal-b49 二三回合入账(诊断报告 / 网络出口 / delete 轴 / Trae 面复取) (68cee669f7)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (52559effd6)
- 🚀 기능/개선:复现对侧的子进程网络出口管控(DNS/域名裁决那一半引擎;rea goal-b49 B6) (923546ffec)
- 🔧 기타:字号/间距默认档落档重做到 origin/main 新基线 940 处(旧 954 − 上游删除 14) (1bcdbbaf0e)
- 🚀 기능/개선:复现并超越对侧的自包含诊断报告(KPI + 阶段瀑布 + findings;rea goal-b49 B5 收口) (68d68a2cc4)
- 🐞 수정:拦路者不能只报 unidentified —— 补 safe-commit 三类整轮拒的认名 + 可归因摘要(身份仍用稳定类别) (8552e9e6a8)
- 🐞 수정:文件访问裁决真正分维(补 delete 轴 + 修一处装了没接线) (14e02e57f5)
- 🐞 수정:LoginPopUp 裸 TextInput 补聚焦处理 + mobile-rn 考勤七键回填 (1a1e083456)
- 🐞 수정:收编 95 份 RN 非色档落档产出进 HEAD —— 字号轴 261 处 token 化,钩子链被无关红扣着时按 §12 第三条出路走 (64f5094441)
- 🐞 수정:登录弹窗两枚裸 TextInput 收到共享 TextField (7dee099dc5)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (678fead5ac)
- 🐞 수정:收编结论行不再把"被门拦死"报成"收了 N 枚" —— collected 只认真入库,被拦单列 blocked 并点名拦路者到人 (533986198c)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9657db18ef)
- 🔧 기타:合面带入的 7 个新文件补溯源水印(门 47p push scope) (9c0a4d58c6)
- 🐞 수정:把 RN 字号落档腿真装上 —— 器物有三条子腿而守护与级联都只传 --apply(字号轴结构上永不跟随) (e8d4a5dc60)
- 🔧 기타:合面新增 7 个文件后按生成器重算数字块 19088→19095 (781338f8ac)
- 🚀 기능/개선:内容级防丢闸,合面前后按键集差集与活文档行级包含判红 (45feebfac7)
- 🚀 기능/개선:给 web↔RN 改判开出具名通道(证据字段透传 + 显式让位)—— pending 队列此前结构上判不完 (530a6dc9f2)
- 📚 문서:goal-b49 四张执行席报告入档 + 残余表按一格一行当前状态收口 (244862bacb)
- 🐞 수정:桌面 git 候选表不再探测竞品安装目录(rea goal-b49 主席件) (420e3c3c7a)
- 🐞 수정:分享页去掉 CDN 外链,自写零依赖 markdown 渲染器(rea goal-b49 B3) (2beafada17)
- 📚 문서:重跑数字生成器,跟踪文件数 19098/19099→19088(与实测 19088 对齐) (03fd7a60de)
- 🚀 기능/개선:复现 WorkBuddy 的技能目录缓存并修掉它的静默错位(rea goal-b49 B4) (79597fd9fc)
- 🚀 기능/개선:倒退看门狗补 web↔RN 功能面两只队列维 —— pending 与 judgedGap 变长必须当场出声 (e37f42a83c)
- 🚀 기능/개선:复现 WorkBuddy 的删除保护链(回收站 + 批量两阶段护栏,rea goal-b49 B1) (cf1e7f9efe)
- 🐞 수정:门 298 由逐字单档扩成三档判据 + 一档疑退报数 (b5c858506f)
- 🐞 수정:门 298 由逐字单档扩成三档判据 + 一档疑退报数 (116b779677)
- 📚 문서:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (d49a1c57ab)
- 📚 문서:门号统一 285→288(代码侧残留引用) (4aad99de3a)
- 🔧 기타:给"倒退看门狗"装上存续锁与坏例归因 —— 自检坏了要当场响,且一行就能定位是哪一维没判 (0ca3cc6ae0)
- 🚀 기능/개선:迁移链双向对账尺装车(rea goal-b49 B2)+ 档案就地更正一条假活账 (e38aad1c2c)
- 🐞 수정:props 类型解析不到时落 undetermined,不再冒充零 props (e3c28228fe)
- 🐞 수정:按 ls-remote 现读判定 behind/分叉并红 (f08a6a9f34)
- 🐞 수정:前向修复两枚 HEAD 面水印欠账 —— AGENTS_trim-2026-11-05 归档件零宽链被压缩枚截断、workbuddy_behaviors.py payload 缺失/损坏;走官方 clean→inject 重封，verify 载荷可解码且等于 WATERMARK_TEXT(47p 自愈式对 HEAD 面欠账不生效,仅前向修复枚能销) (8e81f23d18)
- 🔧 기타:去掉 8end 触发面里重复的一整块 paths(我上一枚自己引入的) (6f3942f5b3)
- 🐞 수정:补 workbuddy_behaviors.py 的可见横幅与载荷 —— "NOT ICE" 一个空格让 main 的 preflight 一直红 (d53514d19a)
- 🐞 수정:清零 main 面残留红——门99 别名、跨端接线锁与 props-parity 批对齐 (ef88ca4138)
- 🐞 수정:修好跨端「倒退看门狗」的取证面 —— 自检从 19/24 坏例回到 24/24,并把词包缺口的出路从人工指到自动腿 (bf375dc831)
- 📚 문서:压缩 AGENTS.md 至 95,722 字节(门 207) (1a55955234)
- 📚 문서:APK 站点腿头注按 11-04 现读纠偏,速率取证交回选腿实现单源 (df378909ca)
- 📚 문서:rea goal-b49 三席取证档案成册(WorkBuddy 主进程与外围 + Qoder CN 主程序 bundle) (4fe208a71c)
- 🔧 기타:基线收紧 files 30 → 17(CI 实测值)+ total 3623 → 3610 (cf553af1d7)
- 🐞 수정:固定 structlog processor 链实例,修 xdist 下 capture_logs 偶发 0 事件 (a5e90b54dc)
- 🚀 기능/개선:复现并超越 WorkBuddy 的按操作分维文件访问裁决(rea goal-b49 首件落地) (e2d819a0a4)
- 🐞 수정:词包搬运腿补嵌套命名空间射程,并把「刚写完等收编」从 unresolvable 里分出来 (3ddb1ad87d)
- 🚀 기능/개선:任务中心 growth 族补全——行为规划层 + WEB 域并域 (43b0513d7b)
- 🔧 기타:收尾批后重钉派生 ui-routes 自述(sourceCommit→659b merge 树,inputsSha256 随 docs/message 层落档刷新;生成器产出原样落,无手改) (2bdda19079)
- 🐞 수정:收尾批 —— chip 角色档纠偏(toggleChip lg->md) + NavBar 测试去 emoji(icon '★'->'藏',评分星族豁免不动) + land-web docs 20 件 tier 收口 + RN Carousel/NavBar 同族落档;miniapp 消息包 5 件不落(其旧 leg 把远端 5a5ff9d25 清掉的死键加回,落地器行级复活判据正确拦截,词包回归 HEAD 形态;message-pack leg 与死键清理的适配归该腿持有人侧,已记本枚信息) (bae518ad7d)
- 📚 문서:APK 站点腿头注按 11-04 现读纠偏,速率取证交回选腿实现单源 (3a8e195c59)
- 📚 문서:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (6e6ea6f5c8)
- 📚 문서:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (ee6a067b73)
- 🐞 수정:清掉 18 件真死代码 —— 棘轮首次在"完整尺子"上读到真数字,47 → 29(基线 30) (d3e791396e)

**2026-11-04**
- 📚 문서:补点 check-mobile-download-leg-cn 与 check-staged-resurrection —— 门 89 R4 义务 (2837d62091)
- 🐞 수정:门 99 收绿 —— 摘除 4 件已删文件的存续引用 (d0c22b8a28)
- 🐞 수정:修平 main required check 的构建/静态/用例红灯 (2b058d2ecf)
- 🐞 수정:恢复 zh-CN 词包的 2 空格版式(上一提交误落了压缩单行版) (b2a9aa9d33)
- 🐞 수정:门 105 G-816040 派生腿 stale 收绿 —— ui-routes.generated.ts 按 HEAD 面重生成 (3de07f7f0f)
- 🐞 수정:门 285 取材面接回 face-reader —— 内容读取统一走 readWorktreeFile，消除门 118 的 loose-fs 真红 (3e6e66a7d7)
- 🐞 수정:补回被 union 合并逐行放过的 43 枚教育考勤键与 10 枚 apk* 独占键 (489724eb45)
- 🐞 수정:第 6 处配置加载失败归零 —— mobile-rn 的 tailwind 面前置建 design-tokens(dist 是构建产物) (a1c10de335)
- 📚 문서:为 check-staged-resurrection 与 check-mobile-download-leg-cn 补 R4 点名(不删接线、不改判据) (2619fc1991)
- 📚 문서:活性区数字对齐 gen-doc-numbers 现算值(44 处)+ 刷新生成块 (48d5e1ec33)
- 🐞 수정:补齐尺子(5 处配置加载失败归零 + 棘轮先判加载面)并清掉 3 件真死代码 —— files 34→30、dependencies 29→28 (7c2cc41a52)
- 📚 문서:为 check-staged-downgrade 分配独立门号并正式登记，解除 292 撞号 (db06025f2e)
- 🐞 수정:为 check-staged-downgrade 分配独立门号并正式登记，解除 292 撞号 (e396b6b1e9)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (15f0dc1bd1)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3b63db24b3)
- 🔧 기타:拆掉三处配置假债并清掉 10 件真死代码 —— files 907→33 (102d5efa29)
- 🔧 기타:合并 origin/main 后重生成 miniapp 离线包并刷新自述钉 (dfcd6fb6ca)
- 🐞 수정:清理 miniapp-taro 83 枚死键,同步五语言包与离线包产物 (5aa0ff9d25)
- 🐞 수정:国内腿兼容 Gitee 200 整包探针(无 Range 也能选腿) (c3b496632d)
- 🐞 수정:补全前端读点识别面并把「有声明无读取」判红 (dcd2fa7989)
- 🐞 수정:修回收腿空转、RP-74 覆盖面与点名器 multiSlot 分流 (83f4f33fd5)
- 🔧 기타:收编停留≥3分钟的未提交改动 (805649666b)
- 🐞 수정:补齐 apps/mobile-rn 的 expo-intent-launcher 记账(门101) (b77a439ebd)
- 🐞 수정:AGENTS 三批追加超了注入预算 —— 压成结论式要点,细节外置 (05b14471ce)
- 🐞 수정:技能安装 manifest 门改由扩展 schema 校验器接管 (fe88a87804)
- 🐞 수정:复活闸补到 pre-commit 侧,闭合不走 safe-commit 的提交路径 (6b849b5db6)
- 🔧 기타:收编停留≥3分钟的未提交改动 (08d41693f6)
- 🐞 수정:圆角角色档 5 族纠偏 + 主题透线 12 处测试渲染点接线 + lock 补 expo-intent-launcher 记账 - AiSkillDetailScreen(3 处 control md->sm)、BannerCarousel(指示点 tiny sm->xs)、AiCareerScreen(chip lg->md)、edu-my-attendance 输入框 control lg->sm、CheckInQrPanel popover lg->md - 6 个共享屏测试渲染点显式传 colorScheme(守门 theme-prop-wiring 禁字面量与漏传同红) - pnpm-lock.yaml: 远端移动 apps/mobile-rn 声明 expo-intent-launcher ~57.0.1 后漏跑全量 install,门 101 判缺记账;本次 install 重新记账并同 commit(违规 1->0) - 验证: radius-role-conformance/theme-prop-wiring worktree 面 0 红, packages/app 六套件 17 用例全绿, app/miniapp/web typecheck 全绿, 门 101 worktree 面绿 (21baead925)
- 🔧 기타:补测试文件溯源水印 (d8d11d4b6e)
- 🔧 기타:收编停留≥3分钟的未提交改动 (0cdb9c5adc)
- 🚀 기능/개선:8 条 blocked 升级为机读侧车 + 报告器 join 增列 (dec7e8c4bc)
- 🐞 수정:补齐两处「静默覆盖他人工作面」的 P0 —— heal 第四层缺通知书闸 + safe-commit 全局 reset (4e6cb8d333)
- 🔧 기타:国内腿资产运行态门 + 一键补资产入口(fail-closed) (c43867117a)
- 🐞 수정:国内腿 5 文件回归仓库排版 + 修掉体积下限一致性锁的乘式误捕 (b9679025a0)
- 📚 문서:更正注释与实现不符 —— 本器只 update-ref,不动 index (e06e5b68ab)
- 🐞 수정:补齐两处「静默覆盖他人工作面」的 P0 —— heal 第四层缺通知书闸 + safe-commit 全局 reset (1cb1464efc)
- 🚀 기능/개선:隐私设置新增 RUM 开关文案（5 语言） (e1fd1f1345)
- 🚀 기능/개선:补客户端 RUM 轻量可观测（默认关闭、脱敏、有界上报） (03309b6716)
- 🚀 기능/개선:命令风险对接 AST 判定(批量删除按语法节点取事实) + README 审批引擎说明 (fac6c20156)
- 🐞 수정:补齐 apps/mobile-rn 已声明的 expo-intent-launcher 锁记账(origin/main 存量红,拦所有提交) (ef854886c7)
- 🔧 기타:收编停留≥3分钟的未提交改动 (cd5826f592)
- 🚀 기능/개선:APK 下载按实测选腿 + 补齐 Gitee 国内腿发布出口 (68321b1f3e)
- 🐞 수정:extension 端包不再用标量遮蔽 shared 的 chat.terminal 对象 —— 三枚取词此前上屏为裸键名 (af9c8a3588)
- 🐞 수정:cli /tasks 的 11 枚取词补齐五语言 —— 终端此前直接打印裸键名 (0fe1de367e)
- 🐞 수정:门285 读数确定性修复+三条映射入账 —— 面重放,证据行按 1bc6ec5167 现读重锚 (1b3dba2d2c)
- 🔧 기타:跨端自动化链自愈:web 落档守护从永久空转改为可证零变化收敛 (62de462f80)
- 🚀 기능/개선:add skill package install security chain and expert pack generator (2ea7a04cc7)
- 🔧 기타:收编停留≥3分钟的未提交改动 (3bd970724d)
- 🐞 수정:补齐 streamingRecognizer.configure 别名,修复与 VoiceInput 调用面的 TS2339 (5e45521700)
- 🐞 수정:恢复下载详情页被误删的三个展示组件,修复主干编译中断 (60e311a376)
- 🚀 기능/개선:规则级决策引擎 + 自动复核 + 授权记忆,接入 computer-use 应用白名单 (b3053ad3de)
- 🐞 수정:应用内 APK 更新落地到现 TIP(含漏件补齐) (b973862f5a)
- 🐞 수정:删除 wt-close 树中 VoiceInput showClear 空声明（仅作接口对齐保留的死键） (218c27961c)
- 🚀 기능/개선:编辑器行级归因开关文案(5 语言) (adaa6e62bd)
- 🐞 수정:门291 C组32条挂账清零,RN改取web真源键并摘除旧键 (09aab027db)
- 🐞 수정:门 285 证据定位改为按符号名解析，消除加注释即报证据行漂移的误红 (55cfe0055f)
- 🚀 기능/개선:行级归因 — diff 驱动的 AI/人工三态归属 (8331e5460a)
- 🚀 기능/개선:桌面端安装前逐文件 sha256 校验(清单缺失即拒绝更新) (a9aade3944)
- 🚀 기능/개선:命令风险判定从正则升级为 AST 语义判定 (0107bd99c1)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e8587b8d24)
- 🔧 기타:收敛 CreateAgentTeamInput 导出面以过 knip 棘轮 (fad21cedd7)
- 🔧 기타:收编停留≥3分钟的未提交改动 (3f53cd4128)
- 🐞 수정:分片腿加首片看门狗,任何失败都退回原生单流 (8dbc29d49e)
- 🔧 기타:收编停留≥3分钟的未提交改动 (59190b65a4)
- 🚀 기능/개선:新增多 Agent 协作团队实体/持久收件箱/产物转交 (1927ea802b)
- 🐞 수정:根治「有意删除的 tracked 文件被自愈器自动复活」 (54feeb4011)
- 🚀 기능/개선:声明式扩展 manifest 接入 capability-catalog + 技能按模型能力分档 (3cae335153)
- 🚀 기능/개선:更新包逐文件 sha256 自校验 + 按工作区本地索引开关(默认 off) (7a30a3c6ae)
- 🐞 수정:B 组收尾补漏（showClear 两端删除、mini robotImage 真渲染） (1b02399947)
- 🐞 수정:平台裁决清零(46→0),A组18条真实现/删除,门128两红收口;补 pnpm-lock 记账(解门101 存量红) (e281cc9b3e)
- 🐞 수정:整包下载改 8 连接分片 + 诚实的速率读数 (e4c0b285e7)
- 📚 문서:跟随 origin/main 重算路由文件/跟踪文件行 (84b10968d8)
- 📚 문서:README/README.en 散文声明跟随生成块重算 (2e5a32da0f)
- 📚 문서:README 生成数字块按门173现算值重算 (db6e54d589)
- 🚀 기능/개선:级联链补到 24 段(功能维三把尺 + spec 派生)并修自检判序 (a83883a019)
- 🔧 기타:清掉 24 件零运行时 import 的孤儿副本并重生成 ui-routes 产物 (9936c8b41e)
- 🐞 수정:死键扫描器改调用点惰性加载 typescript,修 8-End Cert 零依赖 job 的 ERR_MODULE_NOT_FOUND (e594323b43)
- 🔧 기타:未接线收尾 — 删除零消费/迁移残留 61 件，接线 11 处 (105a55a40c)
- ♻️ 리팩터:拆分 C1 超限文件(edu-ai-management 与 cross-end-ui-parity),零行为变更 (1e2ef9bdb4)
- 🔧 기타:收编停留≥3分钟的未提交改动 (9ba7780301)
- 🔧 기타:收编停留≥3分钟的未提交改动 (ad0af8b999)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (79fc8f2339)
- 🔧 기타:收编停留≥3分钟的未提交改动 (e89b032d64)
- 🐞 수정:c-drive 默认即扫暂存区，无输入面不再空转报绿 (3bed6719e3)
- 📚 문서:门45 注释同步空暂存区=0 不适用 (e27c873fec)
- 🐞 수정:c-drive 空暂存区按 A 级 check-file-size 口径 = 0 不适用（更正） (e62a4f5e2f)
- ♻️ 리팩터:屏级默认档等值落具名档·carte/edu-parent 10 处 (0b23dbfbab)
- 🐞 수정:B 级 6 门三态化，取不到输入即 exit 2 (ebee2d6fa5)
- 🚀 기능/개선:跨端写盘腿 tick 落 downgrade/undetermined 两态并接告警面 (8c61f56034)
- 🐞 수정:登录页 welcome SVG 按 </svg> 截断,消除裸文本子节点触发的 Text 组件告警 (493d714c83)
- 🚀 기능/개선:新增真机热更预览通道 rn-live-preview(8809, 自检12/12) (2faca4b6fe)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (af754200b8)
- 🐞 수정:BottomActionBar 来源面板空声明回退 (731af09c90)
- 🐞 수정:LoginPopUp/BackChevron 必选性对齐 (947b908505)
- 🐞 수정:ModelConfigDialog 死变体删除 (767c0b9c0c)
- 🐞 수정:InputArea/ModelList 死腿删除 (0b8992e620)
- 🐞 수정:BottomActionBar 手工压缩入口接线与死腿删除 (ca5429d33a)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (61f270bf6e)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0d87de6175)
- 🐞 수정:NavBar/VideoPlayer 证据换真 (518a6776d0)
- 🐞 수정:VoiceInput 图片死腿删除 (458a4ebf67)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4c371d6d51)
- 🐞 수정:UserInfoCard onOpenVip 真实现与死字段删除 (0c51f35b2f)
- 🐞 수정:LoginPopUp 协议真实现与同槽收敛 (912d931bf7)
- 🐞 수정:capability-catalog 门取不到暂存面时改判 exit 2 未判定 (60b472eaa1)
- 🔧 기타:dedupe 夹具超时放宽到 600s(规避 pnpm 并发持有夹具) (794f8b02b0)
- 🐞 수정:底部淡出遮罩渐变段 120→90 —— 机主复看仍点名「顶部有点高」 (cf11ee7293)
- 🐞 수정:attention 镜像在读不到现值时按变化照写(镜像是派生,宁可重写不漏写),恢复 F3 ⑤ 的落库同步 (de8cdb375d)
- 🔧 기타:按仓库 format 口径重排 AiCareer/KnowledgeBase 两文件(消 lint 的 prettier 报警) (76b15448be)
- 🐞 수정:根治「签名不一致」—— debug 签名不再静默可得,装机前强制证书对账 (0c3dd5bed7)
- 🐞 수정:底部淡出遮罩渐变段 160→120 —— 机主点名「还是高」,同步「我的」页让位量 104→72 (bdab328668)
- 🐞 수정:overlay-zindex 门扫描面为空/文件读不到时改判 exit 2 (dfbf262512)
- 🐞 수정:基线落账补记等价映射条数,棘轮字段不再随重落丢失 (f3fc367307)
- 🐞 수정:event-closure-leak 门取材失败/文件缺失时改判 exit 2 (08298485b8)
- 🔧 기타:门285 基线重落(存量存差 177→0,judged 166,裁决不适用 2 对) (c44caaf496)
- 🐞 수정:VoiceInput 3 键逐键裁决登记(RN 预留未接线腿) (47a3762e07)
- 🐞 수정:VideoPlayer 3 键逐键裁决登记(原生 Video vs 注入组件/页面标题) (2b39134193)
- 🐞 수정:NavBar 23 键逐键裁决登记(固定槽位 vs RN 泛型动作数组) (94ae780bd9)
- 🐞 수정:file-size 门取材失败/读不到文件时改判 exit 2 (2dc1efb330)
- 🐞 수정:ModelList 5 键逐键裁决登记(分组 groups vs 平铺 models+currentType) (9593eb00fe)
- 🐞 수정:ModelConfigDialog 23 键逐键裁决登记(indexa 媒体链路未接/选型拆到 ModelList) (a773fae04c)
- 🐞 수정:LoginPopUp 20 键逐键裁决登记(登录三回调 vs RN 受控弹窗+扁平资料) (b5ea3cfbf4)
- 🐞 수정:IntelligentAssistant robotImage 归矢量字形媒介裁决 (8234539080)
- 🐞 수정:BackChevron 2 键逐键裁决登记(label 端内 i18n 兜底/color 走 token) (1d228a2a68)
- 🐞 수정:dedupe 门取不到 staged 面/锁文件时改判 exit 2 (9731f496ba)
- 🐞 수정:BottomActionBar 44 键逐键裁决登记(开关聚合/图标卡入参与 RN 受控腿) (01196483c8)
- 🐞 수정:InputArea 31 键逐键裁决登记(折叠/模型/语音腿归平台载体) (07c6dfb7c6)
- 🐞 수정:Carousel banner↔items 映射登记(3 键转裁决) (172a007e10)
- 🐞 수정:UserInfoCard 扁平字段真接线 + 报销空 prop 半成品(6 键转裁决) (4a66989645)
- 🐞 수정:commit-scope 门取不到输入时改判 exit 2 未判定 (b54ee9a4a9)
- 🔧 기타:补全出码屏 token mock 的 brandAccent.deep(mount 期 TypeError 的根因),不放宽任何断言 (98bd32b630)
- 🐞 수정:push-sync 四类折绿分支收口 —— 窗口只降文案不降退出码,祖先/HEAD/清单读数失败一律 exit 2 (344c5dd91c)
- 🐞 수정:底部淡出遮罩延伸到屏幕底 —— 胶囊下方那段悬浮间距此前无人覆盖 (cbce78a947)
- 🔧 기타:收编停留≥3分钟的未提交改动 (344909256f)
- 🐞 수정:首页 AI 输入框不再被底部淡出遮罩压住 —— 补小程序已有的那一层 (ba3cec2095)
- 🐞 수정:校正 push-sync 注释的 rev-list 失败实测读数(本机 bad object exit 1,非 128) (714fda7cf5)
- 🔧 기타:收编守护落档产出(5 件,凭落点账本) (b255c8ac82)
- 🐞 수정:选中态复选框补配对前景 key checkBoxOnText(§4 底字同档),清守门 63 末处 (8cfc99b83a)
- 🐞 수정:push-sync 读数改三态 —— rev-list 失败/取不到对象不再折算成 ahead=0 假绿,5 例钉三态 (9c0824df44)
- ♻️ 리팩터:选中态胶囊文字样式改名为 classChipOnText,与 classChipOn 成 R4 兄弟配对(§4 底字同档) (167797c150)
- 🐞 수정:两处 git 派生补 windowsHide —— 门52 生产面两处判红清零,消除控制台闪窗;staged 面 3 文件 0 违规 (5321db0ce9)
- 🐞 수정:收口 63 品牌底/前景配对六处 + 77 悬空导入改默认导入解构 (8f671d1061)
- 🐞 수정:git 派生调用显式接管 stdio —— 门193 三处判红清零(两枚测试文件),解除 pre-push 阻塞;两测试 14/14 通过 (b135c1b1df)
- 🐞 수정:写盘闸 HEAD 三态 —— git 取不到不再折成「新增文件」放行 (12d92ce084)
- 🐞 수정:收口 143 道受影响门揭出的三处真红(48 补 windowsHide / 156 圆角角色五处落档 / 161 盲写改按键比较出口形态) (15e9baf8ea)

**2026-11-03**
- 🔧 기타:285 judged 自检改临时夹具 —— 不再钉死真仓行号 (d472bb39bc)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (af3c51866d)
- 📚 문서:285/289/290/291/292 语义与三条纪律入档 + 逃生变量并入 §6.3 (3ca2913348)
- 🚀 기능/개선:门285 引入逐键 judged 桶 —— 存差=未实现+未映射+未裁决 (aaac585bd5)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a810aefb23)
- 🐞 수정:门290 判据纠偏 + A3 可挂账 + 修真缺陷 (d255a623ba)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a076d3bb7a)
- 🔧 기타:账本收敛为 C 组挂账与 A/B/E 裁决,统一 3 处可改调用点并登记 LearnScreen 4 处 web 无键文案 (5c1de64915)
- 🐞 수정:证书基准拆为官网/Play 上传/Play 应用签名三值并互不校验 (9b5b3233f5)
- 🔧 기타:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (3d8e89c074)
- 🐞 수정:新增 B3 同义键异值判据、common.* 白名单/同字不同义裁决与唯一键去重 (3834b737e4)
- 🐞 수정:门291 P0 将 10 处 RN 硬编码文案改为 web 同源键并补齐 5 语言词包 (67e082814f)
- 🔧 기타:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (1df5542521)
- 🐞 수정:LoginPopUp 24→20 键 —— RN 补 visible 可选、userInfo 适配、defaultAvatar、onNicknameChange (6480532d13)
- 🐞 수정:NavBar 25→23 键 —— 小程序补 subtitle/sticky 真实现，menuIcon 接渲染分支 (7772e22277)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c1b9d5ac1f)
- 🐞 수정:BottomActionBar 59→56 键 —— RN 真接 placeholder/disabled,小程序真接 isLoading (fcc34bccf8)
- 🐞 수정:VideoPlayer 补齐 autoplay/poster/loading/onPlay/onPause/startPosition (9816826db5)
- 🐞 수정:ModelList 两端补齐选择/加载/动效/样式契约 (20e1c01630)
- 🐞 수정:ModelConfigDialog 对齐必填漂移 visible/config/onChange/modelType (e87ea6fa69)
- 🐞 수정:InputArea 补齐 RN 输入契约 autoFocus/onFocus/onBlur/onKeyboardHeightChange (6e2dd73d77)
- 🔧 기타:摘除 ColorfulLoader 死副本并重算 ui-routes inputs —— 全仓静态/动态引用为 0,删除后经生成器重算(inputs 611→610、自述钉自洽);门105 保持绿、门285 258 键不变 (d695719bb0)
- 📚 문서:派生块按生成器重算 —— 守门/跟踪文件读数对齐现算,最近更新补齐 48540f6..HEAD (40e31c3b92)
- 🔧 기타:ui-routes 派生件按 HEAD 面重生成(model-edit/apis 两枚输入补钉) (8b2af27a78)
- 🐞 수정:小程序 model-edit 接上 RN 同一份只读清单,并补派生进程 windowsHide (0f46e9a019)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (43a0ab0c05)
- 🚀 기능/개선:词包搬运器补键级射程(整块之外的单键缺口此前无人判) (03d72eac3c)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4096426428)
- 🔧 기타:收编守护落档产出(5 件,凭落点账本) (a3cd0e3375)
- 🐞 수정:门285 将 ScreenStates 判为 not-applicable —— 文件级四组件族容器,非单组件对 (71a4f299c2)
- 🚀 기능/개선:小程序词包整块缺口首次有器物并挂上自动链 (3c19ced5cd)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (57c6228ab4)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8548571866)
- 🐞 수정:SectionHeader 两端同源收口 —— 小程序适配层真接 leading/style/titleStyle/subtitleStyle/accessibilityLabel(容器与文字样式覆盖、ariaLabel 落地),非空 prop;门285 270→265,该对归零;intentional-delete: 该对五键已由实现消除 (b80032e3b9)
- 🐞 수정:IntelligentAssistant 两端同源收口 —— RN 补 isLoggedIn(登录态文案+隐藏充值,默认 true 零观感变化)与 5 语 loginRequired,tokenQuantity↔tokenBalance 入映射表;门285 273→270;intentional-delete: 该对 tokenQuantity/tokenBalance/isLoggedIn 三键已由映射+实现消除 (9436bdf042)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (5574b04e56)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e6374f6e0c)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (5e7a35f401)
- 🐞 수정:签名凭据前置自检,缺项在编译前即红并逐条点名 (87c89920b8)
- 🔧 기타:小程序 ui-routes 产物按 HEAD 面重生成,清掉门 105 G5 那条 blocking 陈旧钉 (431171025c)
- 🐞 수정:重生成 taro ui-routes 派生件,修门 105 G5 陈旧 (2a6032cf4c)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fc8e11c4a3)
- 🔧 기타:未接线收尾 — 删除零消费重复/迁移残留51件，接线公告/下载未上线态/扩展/包导出等8处 (eda6cf460c)
- 🐞 수정:小程序 NavBar/LoginPopUp 跨端收敛后同步单侧档账与共用清单 (17467f8ef9)
- 🐞 수정:ui-routes 产物钉按现 TIP 重生成 —— 修被旧副本覆盖回去的 G5 陈旧 (9f5aabd164)
- 🐞 수정:UA 断言跟随发布链四段版本契约,去掉三段 semver 硬编码 (6d4b9c0ebe)
- 🐞 수정:摘除 AiCareer 假镜像登记 + 差距矩阵按现读重写(登记 256→255) (a845694d6f)
- 🐞 수정:GeometryStep 联合冻回单行 —— 修门 128 G 维「表里有档而类型不认」11 档 (7148c94a92)
- 🔧 기타:门 121 基线收紧 93→87(清偿来源 6f05742c01) (27e909fee8)
- ♻️ 리팩터:host-toast 下沉 packages/shared 并修复 FocusField 聚焦描边书写位 (5d8ddd0ba3)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (25543544d5)
- 🔧 기타:dispatch 用 run_id 独立 concurrency group —— 手动取证建镜像不再被 push 挤掉，push/tags 取消语义不变 (12c3359838)
- 🚀 기능/개선:票类白名单 9→14 档(逐条来自当次派单面现读)—— 日预算空转这一格才有出口 (8e507d519a)
- 🚀 기능/개선:判据面加「持钥方追认」前向出口 —— 治 push 区间被历史未声明枚永久顶死(自治环最后一米) (d11f6c86dc)
- 🔧 기타:窄CAS旧值证据:认可UPDATE自身WHERE等值谓词 (083bb1e12c)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6df7b71db8)
- 🐞 수정:备份节律审计的落点改吃「按件选根」—— 它天天报"未判定",而备份天天在落 (6e2175bac8)
- 🔧 기타:追认 3778408c 的 immutable 豁免(签发标题与实际标题不符,过窗口后具名补) (530b5ed84a)
- 🐞 수정:桌面分流入口的兜底跳转不再吐内网 origin —— 公网用户此前会拿到打不开的 localhost (dc5b917b8a)
- 🐞 수정:窄 CAS 门射程收紧到写路径自称,清 4 枚共现误报 (a28fddd557)

**2026-11-04**
- 🐞 수정:门 128 几何维按 TS 真实形态解析折行联合,清掉一处干净 HEAD 恒红 (719f4fe984)
- 🔧 기타:dispatch 用 run_id 独立 concurrency group —— 手动取证建镜像不再被 push 挤掉，push/tags 取消语义不变 (8f186ea381)
- 🐞 수정:修 ruff I001 导入分组排序(mcp_official 相对导入置于 first-party 段后;agent_engine 的 agents_md_state 归位 __version__ 之后) (97fa5f00f4)
- 📚 문서:守门脚本点名索引补「格式/媒体对账尺」一条 —— 改前账面 README 通篇零命中这枚尺,而它已装车且有守护派发腿(门 89 R4 文档面义务) (c5f6dac46e)
- 🐞 수정:能力上报 version 单源改约后补测试契约,修 gate-test (1) 9 红 (7038a7b964)
- 📚 문서:格式对账尺头注补一条「刻意不是面」的射程裁定 —— upload-scanner 的 MAGIC_SIGNATURES 是内容嗅探表不是准入表,摘它=削检出,加成第 11 面=每轮多两档假 ③ (48d3fb42f5)
- 🔧 기타:ui-routes 产物钉按新输入重生成(修 3778408c72 退役 monitoring 面板后的 G5 陈旧) (e9d3a23d65)
- 🐞 수정:门285 B 块 6 组件存量收敛 + ui-routes 产物钉按新输入重生成 (9013baa469)
- 🔧 기타:根护栏清单按现 HEAD 重封 git-guardian(解部署环 fail-closed) (d29aa0f4fa)
- 🔧 기타:把 HEAD 里那条"跑不通的出路"就地修成真命令 —— IHUI_E2E_EXTERNAL_SERVER 现在真被 playwright.config 消费,seed 改有界超时+失败点名 (f283dad1a7)
- 🐞 수정:退役 legacy grafana/dashboards 树,修 S5b 自检红并加 D13 复活锁 (3778408c72)
- 🐞 수정:未还原键剩余 4 枚按证据退役(AiCareer 问卷屏/vip 开通屏同名不同物,非漏);fidelity HEAD 面 missing 4→0 (f9c7c385b7)
- 🚀 기능/개선:启动补偿重启切断的签到轮次,只补今日无 ok 结果账号 (b744e5ab5d)
- 🐞 수정:页面级键接线对齐 RN(未还原键 12→4,补 4 缺键入 5 语包,文档矩阵重生成) (188eba91a1)
- 📚 문서:教务考勤条目的端覆盖补上教师统计与出勤趋势三端同脸 (d68d3d2810)
- 🚀 기능/개선:落账腿加装判据面闸 —— 自治环无豁免签名权,命中即整批拒收 (01fd034468)
- ♻️ 리팩터:收口 ws 控制面重复的 catch 处理器,清偿门 121 冗余(101→87) (6f05742c01)
- 🔧 기타:根护栏清单按新 HEAD 重封 git-guardian 目标(承接 0caed8eae5) (ea8ec7f987)
- 🐞 수정:门140 锚点同行体区域收窄(append 三元不再误报)+门151 判据改为看是否真建 worker(psql/迁移/夹具记 skip) (020fdae730)
- 🐞 수정:K 维两处会冤枉人的地方补上 + HEAD 上那枚挡全仓提交的 windowsHide 漏参 (fc89f45129)
- 🐞 수정:派发器未知结论不得记成"判过且健康"—— 同族 fail-open 收紧 12 处 + 装结构锁 (0caed8eae5)
- 🔧 기타:守门:接入 R3 最低风险 5 枚判据(293-297)并重封清单 (dda3ee4a1d)
- 🐞 수정:两面枚举改分片续扫 + 复用在环,预算截断不再把结论恒钉 undetermined (cee945ea70)
- 🐞 수정:B5 小程序 ModelList+VideoPlayer+FloatBox+Carousel 属性对齐 RN(门285 存量收敛) (a4337e8f7d)
- 🐞 수정:B3 小程序 NavBar 属性对齐 RN(门285 存量收敛;ModelConfigDialog 基线陈旧已跳过) (fe50a4123d)
- 🐞 수정:日志回收器改吃「按件选根」—— 半搬迁态下它连续 6 夜在空目录上 ENOENT (215eb5303c)
- 🐞 수정:补回对侧那次 recordById/classIds 的 useMemo 收敛欠账 (39e7233372)
- 🐞 수정:B3 NavBar align RN (16b9adc577)
- 🐞 수정:纠正 AiCareer 假镜像声明(功能不在射程,改登缺口) (73c504d30f)
- 🚀 기능/개선:A6 把"拦对了"与"没规则可判"分成两档报 —— 出路完全相反,混在一起两头都会做错 (a13ad729b3)
- 🐞 수정:B1 小程序 BottomActionBar 属性对齐 RN(门285 存量收敛) (abc7f0c474)
- 🚀 기능/개선:人工阀覆盖面从 1/12 提到 7/12,同时补掉两处**停机侧漏判** —— 自主开发的天花板原来在这里 (fc46d579de)
- 🚀 기능/개선:格式对账尺挂上守护巡检轮 sweepFormatParity —— 此前"判据在、工具在、没人调度"(§0.9 同型),两处执行体同挂 + 接线结构锁 + 调度腿镜像 8 例 (6f8c0373a5)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (95c24c3e79)
- 🚀 기능/개선:把 push-attempt-triage 自己写下的 race 出路器物化 —— 新增纯判据 + 真仓库现读锁 (723393408d)
- 🐞 수정:门 98 认 CJS 导出面(module.exports 静态四型),动态写法落未判定 exit 2 (3d60c4628f)
- 🐞 수정:门267射程纳入git-guardian，改巡检本体不重封在提交口即红 (5bbfce951d)
- 🐞 수정:门 39 补 AigcPublishUpload 的 RN 独占登记,并把镜像锚点从已迁移的 AboutScreen 换到真独占屏 (805e257f7d)
- 🐞 수정:登记覆盖判据——漏登记读数件不再静默 unknown (4b042bdd44)
- 📚 문서:路线图 §1 成熟度表按实读改写 + 新增 §8「现读未闭环」六条带读数 (349403df10)
- 🐞 수정:分→元展示委托到唯一出口 formatPrice,清门 248 M1 存量红 (0782fa7648)
- 🐞 수정:build 改回 atomic-build —— 裸 rimraf && tsc 的删档空窗被并发重建放大,extension 解析 @ihui/types/dist 必然缺失(c8fc5a9cc2 回退所致,其余 6 包均为 atomic-build) (35a05e1874)
- 🐞 수정:迁移窗口策略取区间基点,旧形态清单按旧语义放行 (ce84bb3988)
- 🚀 기능/개선:装 A10「文档声称↔机器事实」对账 + A8 补 pending 档 —— 自治尺从 7 维扩到 10 维,实测 state=ok (77e95aaeed)
- 🔧 기타:必备目标判红用例区分 advisory 档 —— 文档面只告警不参与 verdict (c09c406335)
- ⚡ 성능:本机启用 fsmonitor+untrackedCache(实测 5.1~8.5s→0.76~0.85s) + 哨兵加 monitor-trust 兜漏报 (73aea3a39f)
- 🔧 기타:受保护面扩容落盘 —— immutable 13 条 + 根护栏纳入巡检本体 (6ee85d2779)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (db1282a715)
- 🐞 수정:复原并发写入截断的门注册段,只保留签名豁免 push 门 (d3a9d35490)
- 🚀 기능/개선:A9 具名豁免语义(到期/腐烂/形状坏三档同红)+ 承载面第二批的尺子侧收口 (ea9847a48b)
- 🐞 수정:verify-deploy-facts 路径比较改用 TrimEnd(char[]) 消除 \\ 转义歧义 (9269ab24ee)
- 🐞 수정:tag 祖先判据与 HUSKY_SKIP_TYPECHECK 解耦,防止应急阀重开 tag 释放面 (43367ffb47)
- 🚀 기능/개선:判② 结构性读不出改为显式登记 + 到期回红 (416035fa6d)
- 🐞 수정:API/AI 失败硬失败 + 入口层哈希重启 + 迁移前置快照 + 部署后验收(真绿门) (601977302a)
- 🚀 기능/개선:判据面豁免升级为签名制（HMAC+迁移窗口+push 门） (29b840d962)
- 🐞 수정:P10 未送达欠账补「清偿三分支」,条件自愈后不再永久挂账 (67e4da0855)
- 🐞 수정:小程序三处取词缺口补齐 —— 页面引用的键在两个词包面都取不到 (c2107d9175)
- 🐞 수정:pre-push tag 分支加祖先判据,关掉 desktop-v*/cli-v* 的直通释放面 (2ecd46000a)
- 🚀 기능/개선:守护轮末自陈述版本,代码比进程新即判红并温和自重启 (1c3ad908eb)
- 🐞 수정:A9 判据两处会漏计的口子补上 —— 助手误计为腿,与"不合腿名前缀的真腿"被静默洗掉 (5c348d1615)
- 🚀 기능/개선:承载面补齐 —— 把 39 条只挂在一次性 main() 的自治腿挂进常驻 daemon tick (e5a6a358a6)
- 🔧 기타:workflow_dispatch 用独立 concurrency group,避免被后续 push 取消 (6536b9287a)
- 🚀 기능/개선:装 A9 承载面齐平尺 —— 量出 46 条自治腿在常驻面上根本跑不到 (0ddd485968)
- 🐞 수정:@ihui/types 提为运行期依赖(dist 有值导入,devDep 不建排序边) (37c9fce8ab)
- 🐞 수정:快照刷新改为「drift>0 或超 20h 未刷新」，无漂移不再永久陈旧 (1d701c2873)
- 🚀 기능/개선:装「黑腿探测器」A8 维 —— A1-A7 全绿的同时,三条派发腿已静默 36 小时 (7d31880b3c)
- 🐞 수정:28 台服务逐台落到五态读数覆盖，补登记缺口债 (06560c0048)
- ♻️ 리팩터:摘掉 model-edit 计费转发壳与其逐字复制的测试 —— 一份实现只留一份断言 (6290539cc5)
- 🚀 기능/개선:装 git status 余量哨兵(判机器状态⇒不进提交链) + 顺手还清门 207 的 AGENTS 体积债 (a40ad0f87f)
- 🐞 수정:号池容量哨兵复明 —— 锚点只认 export function,生产侧收成内部符号后盲了 19 小时 (1553af77fe)
- 🚀 기능/개선:自治环补「同票空转记忆」终局闸 —— 治一枚票吞掉 127 个班次而其余候选零班次 (6cd3088259)
- 🐞 수정:promtail 采集面排掉 2.6 万个轮转副本 —— 尾读 4531→40、git status 5.1~6.5s→1.5~2.2s (9aed651e5c)
- 🐞 수정:多段文档路径统一落品牌 404(404+品牌体+noindex) (9ac4666ab3)
- 🚀 기능/개선:静态导出构建期生成 /dl/desktop 落地页(OS 分腿 + 站内兜底) (eee6667e86)
- 🐞 수정:纯 ref 删除推送零 blob 时按显式「无文件面」判定通过(T1/47p),不再退回 HEAD 全量面 (2b4b7710a6)
- 🚀 기능/개선:Gitee 源码只读快照(方案 c)—— 无父单提交 + 周更/发版刷新,force 仅 Gitee main;tag 改用 git push ref (449214e187)
- 🐞 수정:小程序 model-edit 保存成功提示五语言补齐 —— 页面引用的 devEnter.modelEdit.saveSuccess 此前一枚语言包里都没有 (cbf610f088)
- 📚 문서:为 readme-06/09 的「无服务/无可登录后端」存档段加 2026-11-04 时效注,正文零改动 (61ace4dbc6)
- 🐞 수정:版本单一源头收口 —— 包内 manifest / 下载文件名 / 能力上报不再各写一套号 (e7fb38960f)
- 🚀 기능/개선:新增 worktree-reclaim-guard，四条磁盘约束落成硬判据 (f9f69d2e9d)
- 📚 문서:同步 readme-02 的 PG/服务实况口径至根 README(8810/ihui_dev),并标注来源与时效 (3fc349ee84)
- 📚 문서:收敛本机 PostgreSQL/服务实况口径 —— 按 8810 实测与 8801/8802/8803/8811 复核改写「无服务/无数据库/无可登录后端」旧断言 (742bb94bdb)
- 🐞 수정:库侧取证补 guardDbDsn 闸,默认拒 8810/远端,放行只认 --allow-prod-dsn (8da4c7c0d1)
- 🐞 수정:失败分诊 env 键大写化改用 POSIX tr(兼容 macOS 自带 bash 3.2) (287e8b0862)
- 🐞 수정:静态导出移出 /dl/desktop 逐请求地域分流器(GH Pages/Pages 镜像不再有该 route) (2f1cae6838)
- 🔧 기타:ignore .runtime/ (qoder-chat-bridge runtime cwd) (3e95b71497)
- 📚 문서:修正本机 PG 端口口径为 8810/ihui_dev 并写明 guardDbDsn 拒绝后果 (4c5e1c31a8)
- 🔧 기타:对齐 G-50 巡检夹具与三参调用形 (43e8c4d6c0)
- 🐞 수정:移除已裁撤服务 IHUI-OLLAMA 的孤儿缺建法登记 (25e5758e77)
- 🐞 수정:静态导出移出 /dl/desktop 请求期分流路由(修 Pages Build web 连红) (5d569eca63)
- 🔧 기타:收口两处 CI flaky 的确定性根因(瞬态快照/过渡文案) (a7f1884ea4)
- 🐞 수정:积分快照补 minimax 分支并让 qoder 走号池权威票 (4e378158e5)
- 🐞 수정:G-50 进程面单行字段读不出改判未判定 —— 堵住「读不到=没人用」的假静默窗口 (b16950c0fb)
- 🚀 기능/개선:补 00:05 零点窗口,复用主窗口腿且 8:05 保留兜底 (8a6dcb4eb7)
- 🐞 수정:G-50 搬迁自执行开关收回默认关 —— enabled=true→false(风险处置,只动开关面) (2e0588464c)
- 📚 문서:下载能力矩阵登记地域分流入口 —— GET /dl/desktop(功能说明+使用方式+所属端,AGENTS §21 同批) (c82729f380)
- 🔧 기타:销 HEAD 面欠账 —— scripts/tests/db-guard-port-bypass.test.mjs 补溯源水印 (9b55b48552)
- 🔧 기타:use-prompt-history 落盘断言改等通道 IO promise 落地(去掉固定 6 拍宏任务预算) (428f5b58ef)
- 🔧 기타:两处异步 UI 断言改等真实完成信号并去掉固定等待预算(CI 并行负载偶发红) (a04afbef5c)
- 🔧 기타:补齐合并带入测试文件的溯源水印(守门 47p) (6bd51d6c09)
- 🔧 기타:补齐品牌 404 新增文件溯源水印(守门 47p) (166037ab6c)
- 🚀 기능/개선:文档 404 改用构建期预渲染的品牌页(硬 404/noindex/不回显 slug 语义不变) (4e25ef8c36)
- 🔧 기타:大屏用户构成等待数据绑屏的断言预算 1s→3s（CI 偶发红） (6f9b6def16)
- 🔧 기타:phase-21 case15 收口 pane 复开与词典就绪竞态 (e3a75b3503)
- 🐞 수정:prebuild 先按依赖拓扑构建 extension 全链（build(web) 红） (00a9f68657)
- 🔧 기타:考勤本人页阳性对照改为等待行渲染（CI 红第四轮） (b3bf250ee5)
- 🔧 기타:跟随 fabBox 几何档 + rmtree(dir_fd) 清理语义（CI 红第三轮） (3975998d5a)
- 🐞 수정:修正 test-python 在 Linux 上的 7 条平台/隔离红 (816e374e80)
- 🔧 기타:钉住具名档正方盒的正圆豁免形态(B9) (ef725a9331)
- 🐞 수정:圆角上限判据承认几何正圆例外;FAB 改用 50% 正圆写法 (ffa9508a15)
- 🚀 기능/개선:分流解析器也要有人守 —— 哨兵加 resolver 一维(两轮确认,取不到一律不判) (73e62d9181)
- ⚡ 성능:流式提交降频至 25fps，消除每帧一次 React 提交(H20 ②) (267aa1daf1)
- 🐞 수정:study-index FAB 圆角改取 rnGeometry.fabBox/2 几何半边,方盒尺寸入单源 (784b706df1)
- 🐞 수정:/docs 不存在 slug 的硬 404 改为 Proxy 直出 Response(生产 rewrite 跨源 500) (1b7f50b8e5)
- 🐞 수정:study-index FAB 正圆改用百分比几何写法,消除 B9 裸数字 28 (edec5224d4)
- 🐞 수정:清零 CI (Monorepo) lint/test-python 红并复验 OpenAPI 归零 (9e8b7e0038)
- 🐞 수정:分流判据在 noUncheckedIndexedAccess 下两处索引取值未收口 ⇒ 落地后 tsc 真红,当场修 (aa08c24671)
- 🐞 수정:G-50 窗口三态把截断子项降为 unjudged,不再一票抹成 undetermined (a89c65bfe0)
- 🚀 기능/개선:桌面安装包按访客地域分腿 —— 海外走 GitHub 权威腿,国内走 Gitee(仍过字节对账) (95fa57a78f)
- 🐞 수정:退役 user-feedback 分诊源(摘源+停自动派发,生产者转手动 CLI) (f27014623a)
- 🐞 수정:guardDbDsn 按有效端口判黑名单,堵住无端口/08810/PGPORT 三种绕过 (43fbbd86b3)
- 📚 문서:头注更正『触发端尚未接线』——guardian 12757 已派发 (80b0225edc)
- 🐞 수정:user-feedback 缺件显式判「无数据/未判定」,不再把 ENOENT 文案刷进守护日志 (ffe3eb8c39)
- 🐞 수정:服务清单两处红按实登记收口(FACE-RED 3->0、SCOPE-RED 2->0) (e9ff3fa881)

**2026-11-04**
- 🚀 기능/개선:考勤统计与出勤趋势补齐小程序/手机端,后端补上写端点与复数家长端点的契约闸 (922441dada)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (85245ac6b0)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f355fcfaf7)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (aa24fda62b)
- 🚀 기능/개선:考勤统计与出勤趋势补齐小程序/手机端,后端补上写端点与复数家长端点的契约闸 (86aa75fd30)
- 🐞 수정:补 worktree-reclaim-guard 的 HEAD 面溯源水印(守门 47 现点名的 HEAD 欠账) (458b75822e)
- 🐞 수정:共享层重复门不再把 §22c 强制镜像标记 __test__ 当同名重实现 (11c3475743)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (9ee2b0ae61)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (3bb1c36f58)
- 🚀 기능/개선:Gitee 源码只读快照(方案 c)—— 无父单提交 + 周更/发版刷新,force 仅 Gitee main (20919f3d4c)
- 📚 문서:Gitee main 为发版时点只读快照 —— 明示可能落后 origin/main,最新代码以 GitHub 为准 (8cb42bdffe)
- 🐞 수정:Gitee tag 改用 git push 推 ref —— 先推 tag 再建 release,tag 已存在按幂等复查(0.1.77「创建标签失败」根因) (96fc64d382)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (c88be8f8a2)
- 🐞 수정:考勤状态筛选由后端拒收非枚举值——静默查空改成可整改的 400 (1b2a7cda5a)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (1e14489b39)
- 🚀 기능/개선:新增 worktree-reclaim-guard，四条磁盘约束落成硬判据 (bef468b336)
- 🔧 기타:结清并摘除考勤四票 B67 B70 B71 B72——逐行按其自写判据当场复跑 (3cbf9e50f8)
- 📚 문서:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (2a08aade77)

**2026-11-04**
- 🔧 기타:收编停留≥3分钟的未提交改动 (8aeb9b1863)
- 🔧 기타:退役 blue-green-deploy 通道并换零依赖失败通知 (f6e8bf5381)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>지린성 아이즈히후이 인공지능 기술 유한공사</strong> · 오픈소스 공동 구축, 우리 함께합니다</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->