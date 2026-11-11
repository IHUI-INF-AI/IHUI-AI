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
| **AI 서비스** | `apps/ai-service/`   | FastAPI + LangGraph + Socket.IO | LLM 게이트웨이 + Agent 실행 + MCP 툴 + A2A 프로토콜 + 38 퍼블리싱 adapter, ~577 엔드포인트. 샌드박스 수명 주기는 /api/sandbox/instances. 에이전트 도구 sandbox_session 은 일시정지, 재개, 파일 스냅샷, 복제, 제자리 롤백. 네트워크와 비밀은 호출자가 넣지 못함 |
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
### GitHub App webhook 비동기 디스패치(2026-11-06 §21 에 따라 등록, RP-69)
`POST /api/github-app/webhook` 의 `pull_request` / `issue_comment` 두 디스패치 경로가 「먼저 200 을 돌려주고, 처리는 뒤에」 방식으로 바뀌었습니다(Y-91).
- **환경 변수**:`GITHUB_WEBHOOK_RESPONSE_BUDGET_MS` —— 응답 예산(ms). 「GitHub 를 얼마나 기다리게 할지」의 상한이며, **타임아웃에 의한 취소가 아닙니다**. 예산이 다 되어도 200 을 돌려주고, 작업은 중단이나 재시도 없이 끝까지 돌아가며 전달 기록도 씁니다.
- **기본값**:500ms(소스에서 확인한 `DEFAULT_RESPONSE_BUDGET_MS = 500`). 값이 없거나, 유한수가 아니거나, 음수이면 추측하지 않고 이 기본값으로 되돌아갑니다. `0` 은 순수 비동기 모드로, 항상 먼저 200 을 돌려줍니다.
- **응답에 추가된 필드 `dispatch`**:`'inline'` 또는 `'async'`. 예산 안에 끝나면 200 에 `dispatch:'inline'` 과 기존 `outcome` 을 싣고(기존 응답 모양은 후퇴하지 않습니다), 예산 초과 또는 `0` 모드(`deferred`)에서는 `dispatch:'async'` 를 싣고 `outcome` 은 붙이지 않으며, 무거운 작업은 백그라운드 큐에서 끝까지 돕니다.
- **알려진 갭(deferred 가 디스크에 남지 않음)**:디스패치 큐는 프로세스 안의 일회성 메모리 큐로, 상주 서비스도 폴링도 영속화도 없고, 전달 기록은 작업이 끝난 뒤에야 씁니다. 따라서 `dispatch:'async'` 로 200 을 돌려준 뒤 백그라운드 작업이 끝나기 전에 API 프로세스가 죽거나 재시작하면, 메모리 속 작업과 아직 쓰지 않은 전달 기록이 함께 사라집니다. GitHub 쪽은 이미 배송 성공으로 기록해 재전송하지 않고, 1차 메모리 중복 제거 LRU 도 프로세스와 함께 사라지므로, 그 배송의 리뷰 / 댓글 반영은 조용히 유실되어 리플레이도 대조도 할 수 없습니다. 현재 구현은 이 구간을 막지 않았습니다(백로그가 꽉 찼을 때의 「그 자리에서 실행」 폴백은 적체만 막고, 프로세스 종료는 막지 못합니다).

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
| **이메일**         | IHUI-AI@aizhs.top                                                 |
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

> 협업 문의, 기업 연동, 기술 교류는 위 위챗 QR코드를 스캔하거나 IHUI-AI@aizhs.top으로 연락해 주세요. 24시간 내에 답장드리겠습니다.

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

**투자자에게** — 우리는 여전히 오픈소스를 진정으로 이해하고, AI를 이해하고, 장기 가치를 이해하는 파트너를 찾고 있습니다. 이 이야기가 단 1초라도 당신을 움직였다면, 연락해 주세요([IHUI-AI@aizhs.top](mailto:IHUI-AI@aizhs.top) / 위챗 `ok502319984`). 우리에겐 이야기도, 코드도, 실행력도 부족하지 않습니다. 우리에겐 먼 길을 함께 걸어줄 누군가만 부족합니다.

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
**2026-11-11**
- 🐞 수정:推送分叉自动收敛 + 落地复跑按落地面收窄 + 声明持久化(根治每次推送卡 5-20 分钟) (7265f95f404)
- 🚀 기능/개선:豆包接入签到体系——第五平台全链路接线 (b4cca8b95bb)
- 🚀 기능/개선:签到 API 定稿——detail+checkin 双接口,web 指纹实测定稿 (2ef06ac58be)
- 🐞 수정:回放文本安全阀——非文本消息占位 + 总长截断 (40cb7783939)
- 🐞 수정:回放文本安全阀——非文本消息占位 + 总长截断 (d692451deaa)
- 🔧 기타:给「喂 stdin」修复加装车锁(防回退 inherit 静默复发) (e3273d5391c)
- 🐞 수정:worker 推送显式喂 pre-push 的 ref 行,水印门不再恒「未判定」 (d9f528d9236)
- 🐞 수정:远端协议白名单放宽为 https+ssh(本机唯一通道;窗口闸与危险协议拒绝不动) (d33cd67cbbc)
- 🔧 기타:登记远端删除的 20261111000000 迁移件(删除随合并传播) (987d6e3e8ea)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f446a0ffc30)
- 🔧 기타:钉住 renderStablePin 的五个收敛条件(防自激链静默复活) (db32cc91be6)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a4cbcba5bdd)
- 🐞 수정:生成物自述钉改为稳定钉,掐断「重生成→收编」自激链 (4ab41d4292b)
- 🐞 수정:readDoubaoCookie 补 .bytedance.com 域的 msToken 风控票 (2541964724c)
- 🔧 기타:彻底移除系统 Administrator 凭据轮换违规迁移 (8955918c3bb)
- 🔧 기타:补 relay 号池批量推送脚本的溯源水印(远端新增文件漏注) (0f70833b764)
- 🔧 기타:文档自动更新游标推进(last-sha) (cc432ddf82b)
- 📚 문서:自动刷新最近更新块 + 游标推进 (415e137dd6a)
- 🔧 기타:nav-styles 箭头常量按 prettier 折行(仅格式) (bf36876c96b)
- 🐞 수정:侧栏交互项统一 —— 选中态反色、暗色 hover 纯黑、登录与导航同构 (8b37e3972ee)
- 📚 문서:补本地开发开关说明,并纠正租户严格模式默认值口径 (ca35093984f)
- 🔧 기타:收编守护落档产出(2 件,凭落点账本) (702e0df09c4)
- 🔧 기타:重算四端 ui-routes 与 rn-route-map + knip/README 数字同步 (68c0e32d3a2)
- 🐞 수정:同平台重复治理 —— zcode 键源补链 + 签到归属迁移收养 (2c72a450ece)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f40d9ae05fb)
- 🐞 수정:系统管理员凭据轮换例外 —— 仅放行 password_hash 变更 (727f76a0c5d)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (2696dd5c875)
- 🐞 수정:导出/回放腿按 2026-11-11 真机实证修正三处假绿 (d959839357b)
- 🔧 기타:壳声明件跟随新落承载页(260 条说明符) (b0edc59ca86)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (df38ca133d7)
- 🔧 기타:自动落 2 枚小程序壳承载页(共 2 枚待产) (f8075c6c40e)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (82fdd009e19)
- 🐞 수정:补齐 UpstreamSocketOpenOptions.heartbeatMs 契约并收口两脚本类型错(清 T1) (6756238fb01)
- 🚀 기능/개선:登录锁定支持账号豁免名单,默认关闭 (ab97a2a5fca)
- 🐞 수정:清掉测试面 typecheck 里长连接 lane 的 6 个存量错误 (9573af5378f)
- 🔧 기타:壳声明件跟随新落承载页(258 条说明符) (155a5b4d4be)
- 🔧 기타:自动落 2 枚小程序壳承载页(共 4 枚待产) (7eb6b47f007)
- 📚 문서:自动刷新最近更新块 (9f1dafe915f)
- 📚 문서:自动刷新最近更新块(收敛循环) (deda1ac0ffe)
- 🐞 수정:扫码面板取消自动弹协议窗,改为内联同意并继续 (23e6125fd96)
- 🚀 기능/개선:上游会话续写缓存 —— 同会话多轮透传 conversation_id,不再每次重建对话 (ec105c40232)
- 📚 문서:自动刷新最近更新块(收敛循环) (d5e9ecf561b)
- 🚀 기능/개선:回放迁移腿 —— 旧号对话以新会话进新号,豆包切号后可接着聊 (1af0dce1f43)
- 📚 문서:刷新生成块数字(trackedFiles 20934→20936,并入 relay 长连接收口 2 个新文件) (52848a9f7e5)
- 📚 문서:自动刷新最近更新块 + 游标跟进 cb64a7fd1c (86abb395e5b)
- 🐞 수정:启动门只等必需后端三件套,/health 免租户(修 240s 假死) (3460206c423)

**2026-11-10**
- ⚡ 성능:全池推生产合并为单次 SSH 握手，能力探针与导出并行 (e4008a1a7a7)
- 📚 문서:刷新生成块数字(trackedFiles 20930→20934,并入远端 4 个新脚本路径) (cb64a7fd1c4)
- 🔧 기타:同步小程序 entry 清单(新增 2 枚壳承载页后页面数 331→333) (13e9ad2c965)
- 🐞 수정:长连接收口——代理隧道 agent、会话级亲和键、看门狗补全 (14dcbd290d5)
- 🐞 수정:侧边栏选中态降对比 —— 统一 sidebar-active 弱底(明暗主题) (104ed9e8f95)
- 🐞 수정:豆包跨号会话云端归档腿 + 一键入口文案据实测更新 (8068aa017c8)
- 🚀 기능/개선:号池导入支持批量与生产推送，全池迁生产收敛为一条命令 (da8d7b06061)
- 📚 문서:刷新生成块数字(relay 长连接 4 文件并入致 trackedFiles+4/testFiles+2/wsEndpoints+1/apiRoutes+1) (993f458ebf0)
- 🔧 기타:壳声明件跟随新落承载页(258 条说明符) (a83db3919eb)
- 🔧 기타:自动落 2 枚小程序壳承载页(共 4 枚待产) (7ce25c7a45a)
- 🐞 수정:会话对账器补字节级兜底 —— 库被清空也不再是盲区 (df6082c173f)
- 🐞 수정:base.css 第二份源纳入小程序 token 同步触发面 并补全 T1 配套断言 (36d956d285f)
- 🔧 기타:补 relay 长连接 4 个新增文件的溯源水印 (45e114f364a)
- 🚀 기능/개선:号池 relay 全链路长连接贯通(契约+传输层+选路+WS 入口) (87e9aad2af0)
- 🚀 기능/개선:对话随行落到实处 + WorkBuddy/OpenCode 写回真打通 (250ec2e0e34)
- 🐞 수정:补 miniapp-taro 词包 eduAi 命名空间 20 键 清门 302p (9ea36e90cb7)
- 🐞 수정:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (54148716627)
- 🔧 기타:补两枚判据面收敛提交的具名追认行 (636bde65293)
- 🐞 수정:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (44404bb5e28)
- 🔧 기타:ui-routes 四端重算 + knip 受管块同步 (External-Red-Audit / Push-Channel: direct-merge) (94dcbdd310f)
- 🔧 기타:生成器重算收口 — sync-readme-numbers / gen-ui-routes / gen-i18n-compressed / gen-knip (External-Red-Audit / Push-Channel: direct-merge) (3cc4c48fdbb)
- 🐞 수정:收尾修复 — 门 128 platform 非法 + docs 同步 + RN 残留清理 (55b19ffe086)
- 🐞 수정:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (57f105e3f0c)
- 🐞 수정:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (00a62e9b2e6)
- 🔧 기타:收编停留≥3分钟的未提交改动 (0ba0746bb83)
- 🐞 수정:修掉「写了但客户端不认」的两型 —— MiniMax 记录形状污染 + OpenCode v2 落点失效 (0c17085f7da)
- 🐞 수정:余额端点二次实证纠正(改 points/records + 100001 非失效,避免误杀有效号) (68c93885b46)
- 🐞 수정:余额端点实证落地(域名+路径+token 头三重纠错,缺票不判死) (ffcff7a443d)
- 🐞 수정:一键切号写回腿根治 + 缺模板拒写 + 会话模板回填器物 (136b39adffc)
- 🚀 기능/개선:小程序/RN 中文回退链同源 + RN 端自托管方案根因收口 (9fb83e175b5)
- 🚀 기능/개선:web 正文 400 档分段 unicode-range 按需面 + 门 313 跨端触发面补齐 (57d84775b4d)
- 🚀 기능/개선:一键切号窗口实时显示各平台余额(未支持如实标注,不编 0) (c1aebcd0acc)
- 🔧 기타:裸 git 派生迁 gitRaw 层 收口棘轮例19 (450f4531184)
- 🐞 수정:收口 gate-test(6) 两枚 Linux 专属红(abort 漏判 + 原子写夹具漂移) (3e662520bcf)
- 🐞 수정:修复永久保活号静默饿死(server 档未判定放行 + minimax 探针接线 + 1h 节拍) (6a6c3cfcd4a)
- 🚀 기능/개선:门 313 登记维断判据根治 + 属主登记补漏 + token 档位同源 (9dd458b22bc)
- ♻️ 리팩터:门体自检的 cat-file 取材收敛到 face-reader 取材层 (a8ad54d2111)
- 🔧 기타:收编停留≥3分钟的未提交改动 (aef27ba3d9a)
- 📚 문서:数字块按 HEAD 面重算（与推门 check-doc-numbers 同面） (7c9999939f0)
- 🐞 수정:补迁 check-hook-chain-refs 的跨行裸 git 派生 (46dd3e0b864)
- 🐞 수정:五处裸 git 派生迁到统一承载层 gitRaw（清门193与测试面两条欠账） (264c676468c)
- 🐞 수정:门313 补 T4 书写面臂——品牌/子集/display 族所在栈一律配中文现代黑体兜底 (d786ae8aef7)
- ⚡ 성능:接线对账门多模式 grep 分片,真仓全量 43.8s→8.7s (a381e3a33fa)
- 🐞 수정:恢复 /llm/models 路由挂载并消除 build_model_catalog 自递归 (3e8fdd3d4d4)
- 🚀 기능/개선:三端滚动边缘淡出 ScrollEdgeFades + 抽屉/底部遮罩细化 (acdd5f169e0)
- ⚡ 성능:祖先取材改逐路径并发,18 条 M 路径 44.8s→19.4s (c6bb81e5844)
- ⚡ 성능:祖先取材按 HEAD+路径记忆,同轮不再为同一路径走两遍全历史 (d0b4aad6715)
- ⚡ 성능:3b 对账延后到后台 + 逐路径覆盖结论缓存,提交链 116.7s→28s (7ab84a93144)
- ⚡ 성능:水印提交档分母收窄到本次携带,单门 24.5s→1.0s (0cf426141b0)
- ⚡ 성능:30a 悬空集合单列缓存,提交链守门实测 309s→69s (775ca7e7837)
- 🐞 수정:合并后按 token 档归一 inline-question-card 字号与字重 (10e5b33bb52)

**2026-11-08**
- 🚀 기능/개선:补齐 AI 生成显式/隐式标识 (8d972f386c6)
- 🚀 기능/개선:补齐 AI 生成显式/隐式标识 (f4535c338e9)
- 🚀 기능/개선:Groups 屏薄壳承载落地(RN 壳同源渲染,词条取 web 原文) (e7d27e3e994)

**2026-11-07**
- 🐞 수정:补 web 端 apiKeys en/ko 译文(24 键,清门 4 pending) (5e1c14de23a)
- 🐞 수정:四屏壳改桶导入,补门173共享屏直接 import 覆盖 (e71cd19a5d6)
- 🚀 기능/개선:TeamKnowledge 屏下沉共享屏,RN/Web 同源渲染零降级 (c0ca814f166)
- 🔧 기타:重算 rn-shells.generated.d.ts（补 VipTraderScreen，修门 251 C9 不同步） (fa6c08282d1)
- 🐞 수정:RepoWiki 生成禁用提示回到宿主(详情内重复入口去重后补齐可发现性;删 web 失用键 refresh/regenerate) (a3dc7d1bc5f)
- 🚀 기능/개선:RepoWiki 共享屏下沉(RN/Web 同源渲染,零降级) (b37e84d18cd)
- 🐞 수정:Groups 三列断点卡片基宽 (97cb9752de7)
- 🚀 기능/개선:Groups 屏下沉共享屏,两端宿主注入 (39fcfc991bb)
- 🚀 기능/개선:Patrol 屏下沉共享屏,两端宿主注入 (cd9a85fea20)
- 🚀 기능/개선:ApiKeys 屏下沉共享屏,web/mobile-rn 五语言词表补齐 (10f86bc743f)
- ♻️ 리팩터:EarnCommission 壳删冗余 View 层(共享屏根已等价提供 flex+背景) (62cb2eaa1f9)
- 🚀 기능/개선:TokenValue 记录时间范围条下沉共享屏(数据型注入点,RN/小程序同源) (e7c52e45ba2)
- 🚀 기능/개선:8 条单端槽位裁决落锁,2 条真下沉 (72a500c1156)
- 🔧 기타:再 rebase 后生成器取胜, 刷新 ui-routes 钉值与 README 数字 (5c833a7bbc5)

**2026-11-06**
- 🚀 기능/개선:补齐 Team/MessageCenter/ArticleList/Coupon 行为型 prop 跨端缺口并清理死契约 (a872076ccc9)

**2026-11-10**
- 🔧 기타:合并收口补 AGENTS 点名 scan-api-routes 并按新 HEAD 重封根护栏清单 (f2261133d5)

**2026-11-09**
- 🚀 기능/개선:autopilot 公网远程 MCP 端点 —— 对外曝光,任何 AI 一行 URL 接入 (225bbcec27)

**2026-11-09**
- 📚 문서:按对照实验钉死第 ② 组根因并补线上复验读数 (e3ab29982f)
- 🐞 수정:第 ② 组改用不可变 sha 做 compare 并补 Dependabot 排除 (fb3283c6f2)
- 📚 문서:生成块对齐合并树 HEAD 面现算 testFiles 4776 与 trackedFiles 20631 (ff820cf667)
- 🐞 수정:MCP server 定位更正 —— 仓库内标准导出形态,不注册任何 AI 宿主配置 (d2327e58d2)
- 🐞 수정:修复两份 README 生成块数字被写成空值 (fa7b946c7f)
- 🐞 수정:按当前 HEAD 重生成 7 份离线派生包并销账 3 条陈旧豁免 (8d311c1679)
- 🚀 기능/개선:autopilot MCP Server 化 —— 任何 MCP 客户端可即插即用接走 (3ef4eb8a95)
- 📚 문서:生成块对齐合并树 HEAD 面现算 第 1 轮 (77c81a1887)
- 🚀 기능/개선:autopilot HTTP 端点 —— AI 会话可编程自主调用入口 (d47c93b5c0)
- 📚 문서:生成块对齐合并树 HEAD 面 testFiles 4774 与 trackedFiles 20626 (1952f3f8af)
- 🚀 기능/개선:WorkBuddy 全量自动驾驶闭环 —— Sequential族直连链放行 + 服务层选路引擎 + 调度器无人值守接线 (735c9e20c4)
- 🔧 기타:为他席 dfec4a76 补具名追认行以解 push 区间未声明 (0c19738ebf)
- 🐞 수정:补 git 派生 stdio 显式接管并按 HEAD 面刷新两份 README 生成块 (209c6a9219)
- 🚀 기능/개선:desktop 计分链闭环 + 号池对账腿 + 产物自检 + 执行留痕 + 一键自动驾驶 (6a5966c184)
- 📚 문서:trackedFiles 生成块 20613→20615 对齐新增判定器件与镜像测试 (ed0d522fb4)
- 🚀 기능/개선:远端分支三态判定器件化并补齐收尾闭环 (cdacbb2152)
- 🐞 수정:门未判定分支引用未定义常量致旁路落地器崩溃 (e1a10dfe29)
- 🐞 수정:剥掉 v4 参考层不执行的 classic 插件,恢复 C1/C8 判定面 (dfec4a7641)
- 🔧 기타:收编守护落档产出(2 件,凭落点账本) (9a73536db8)
- 🐞 수정:补齐模型列表刷新文案键并清理 shared 重复键 (4f9fb284e9)
- 🐞 수정:V1 工具闭环 + 非流式审批投递 + 退出码/状态诚实化 + 默认执行器纠正 (#217) (e6b7227099)
- 📚 문서:trackedFiles 生成块 20612→20613 对齐新增三态判定票 (a533cb36e7)
- 🐞 수정:跨端同步不再污染 bot PR 源分支并补远端分支逐支三态判定票 (fdcad5b70d)
- 🐞 수정:清理工作流补 GH_REPO 使无 checkout 的 job 能跑 gh 命令 (55c417f202)
- 🐞 수정:补 sag2_lexical 顶层 Chunk 导出并修 CLI 测试 lint 两处 (6be381a784)
- 🔧 기타:结构锁改用 TypeScript AST，并让门 89 夹具取材面对齐 DOC_FILES (4b08fae461)
- 📚 문서:落自动腿 2026-11-09 维护区刷新与关键数字块空行,同步 last-sha 指针 (571e21be66)
- 📚 문서:合并面 0d503a4 数字按唯一写入口现算刷新(trackedFiles 20612/testFiles 4768) (1c27bda99a)
- 🐞 수정:C6 结构锁改为判函数体层级,并合流远端 tip 重算 README 生成块 (08d6cd408b)
- 🔧 기타:perf(sag2)+feat(sag2): 扫描件 OCR 四级链落地；多跳检索等价提速 4.4×（召回结果逐条不变） (abd73298e4)
- 🔧 기타:入库11-08远端分支只读清点工单+防火墙禁用滚动留痕(README数字块DN5同源刷新) (0646e1d290)
- 📚 문서:trackedFiles 20577->20578 / testFiles 4753->4754(上一枚新增 tests/test_agent_loop_tools_wire.py) (fd62c925ce)
- 🐞 수정:派工 tools 从未进入模型请求 —— 接上转发并把参数面改成分层瘦身 (fd5f2a1243)
- 🚀 기능/개선:真文件监听 + 音视频转写 + 图片OCR，并修掉建库平方级开销（229×） (7d2e787bcf)
- 🚀 기능/개선:本地文件夹登记/增量扫描 + 7 类格式抽取 + 接入 RAG 第三路与 Agent 门面 (8ed115c505)
- 🚀 기능/개선:批次3-2 钩子链引用完整性门落地(4fbf 归档移植,号 312→305/305p) (0b74581c6b)
- 🚀 기능/개선:融合增益/真实判定质量/真实pgvector A/B 实测落地 + 对外宣称口径文档 (de424b3c06)
- 🚀 기능/개선:批次3-1 看门狗阶段协议落地(1d885 归档移植,只取分段+BLOCKED_BY_CONCURRENCY) (d01f415176)
- 📚 문서:trackedFiles/testFiles 按 81288dac 合并面刷新(ai-service 腿 2 新路径入数) (16d0abcf2c)
- 🚀 기능/개선:刷新模型列表/每5h自动探测联动上游模型同步 (47bc9a182b)
- 📚 문서:批次2/4经合并枚5189b047入wave-1108去向补记 + README按合并面刷新(trackedFiles 20575) (ce0419d708)
- 📚 문서:门数漂移 332→344 定性为夹具过时(12 增 0 删含引入提交)+ 收尾账快照(F-274/275、F-191、pytest 22 例新立账、Kling1500 裁决保留) (a6221b70d8)
- 🐞 수정:多线并行期显式暂停跨端收编腿(开关文件+日志,不靠改时间戳) (b920768a68)
- 🚀 기능/개선:P0-2 先验后落+目标ref参数化(A/B/C/D+④/F) (57bac66a17)
- 🐞 수정:收编归档线 DBG-43..49 写盘守卫与 8 个用例(批次2 单提交) (a01cb2722b)
- 📚 문서:区分 06:25/06:30 两笔 update-ref，补硬编码 main 的落地器与封口第④条 (91d705cc70)
- 📚 문서:记门47 三组存量红与 2bb7c39959 通道归因 (a3dea0ff9e)
- 🐞 수정:水印门 47 拿不到范围一律 exit 2，自愈写盘严格限制在判定面内 (ce22583703)
- 📚 문서:补录 CI continue-on-error 清单与 immutable guard 读真实索引两篇，并登记主工作区瘦身波不采纳票 (f8d0cd42c9)
- 🔧 기타:忽略 worktree 归档、e2e 截图与轮转日志 (438f3e1fb4)
- 📚 문서:交接账补收尾链 51749a7075 与门47 75/190 读数 (876f81a986)
- 📚 문서:交接账补最终 tip(38c8148278) (51749a7075)
- 📚 문서:UI 缺陷合入交接账(17 笔映射/4 笔门账/45→0 复算/14 笔审计) (38c8148278)
- 📚 문서:T1 收官票补数字口径与直推 main 绕过留痕 (4ac7febf4a)
- 📚 문서:T1 存量红基线票收官为已清 (cfe4d6f731)
- 🐞 수정:夹具对齐共享类型面(分销传参/plan constraints) (d5c0dd8731)
- 🐞 수정:移除 money-unit 测试中未使用的 REPO_ROOT (e4c0a435a3)
- 🐞 수정:tt 调用补 fallback 并给路由夹具加空表守卫 (e81cf6e796)
- 🐞 수정:account-deletion 页补 useAuthGate 导入 (e643edd9e4)
- 🐞 수정:收敛重复的 measuredCompactRatio 并移除未用导入 (e7b1139c57)
- 🐞 수정:清 T1 存量红 25 处(合并重复/缺列/响应码声明/泛型约束/夹具) (1e0d1c1b19)
- 🐞 수정:deadline-ticker 环境探针改为 globalThis 能力判定 (4fb05b74bd)
- 🐞 수정:对齐小程序端 common.gotIt 与 RN 端,清 303p 跨端文案存量未裁项 (c0ee26ecf3)
- 🐞 수정:RN 收藏页接后端真分页与加载更多(票 C),补齐 bookmark 分页五语键 (5bc619bdd4)
- 🐞 수정:手机号页发码/绑定同 tick 互斥与定时器托管(票 E),补齐 9 个延迟返回页卸载清理 (99467300f8)
- 🐞 수정:接入顶层键大小写冲突门禁 (3c3831db44)
- 🐞 수정:miniapp-taro 顶层大小写重复键归位 camelCase (b603657f60)
- 🐞 수정:mobile-rn 顶层大小写重复键归位 camelCase (564d350917)
- 🐞 수정:绑定邮箱发码/提交加同 tick 互斥,延迟返回定时器托管卸载清理 (1378c54ddd)
- 🐞 수정:补 302r 的 R4 文档点名,门 89 在 main 面转绿 (fb01cbda03)
- 🐞 수정:吸收 main BUG-NEW-01——ActivityDetailScreen 错误/空态恢复页头返回入口，清 3 例既有红 (f7454026c9)
- 🔧 기타:吸收 main 红面扫描批次4 的三份夹具，清 avatar/chip 行距/pump 慢路径 4 例既有红 (6befb78f7a)
- 📚 문서:校正 XUI-084 消费点行号（回填 :71 / 提交 :39 / 单元格 :70） (c4f74df783)
- 🔧 기타:opType 七键文案与压缩载荷重生成 (6d2ee32b72)
- 🐞 수정:三腿钱包流水接入唯一表，opType 6 按非金额渲染 (2f0ac5f2c4)
- ♻️ 리팩터:opType 展示语义收成全仓唯一表 (26122d8cfa)
- 🐞 수정:API 套餐价格量纲收成唯一换算点并补首尾相等夹具 (97e1d135dc)
- 🐞 수정:收口全部如实登记遗留项——真实PG/HTTP端到端、UI真测试、判定状态形状锁、工具链与门红根治 (29489c1165)

**2026-11-08**
- 📚 문서:收口 web/RN ui-routes 补生成——终态钉、输入条数与已变来源；定论为源码改了未重生成，非生成器缺陷 (09ddb6c586)
- 🐞 수정:重生成 ui-routes 白名单（2 输入，1 条已变：RootNavigator.tsx ← XUI-004 0ba309d2f7 + XUI-068 d6306a65b3；终态钉 fd754397…；349 条路由未变，仅 skipped 7→8） (23bfb6ca86)
- 📚 문서:记录 web/RN ui-routes 补生成——web 已提交 ea1555d0cc，RN 因输入来自 XUI-004/XUI-068 停下待裁决 (c445ae3725)
- 🐞 수정:重生成 ui-routes 白名单（923 输入未变，4 条已变输入均来自本线：wallet 页/XUI-086、agents 精选+我的/XUI-075、admin 套餐/XUI-082；终态钉 d413f735…） (ea1555d0cc)
- 🐞 수정:193 第二处 stdio + T1 预算校准(405s 实测) + 并集口径票 (43b74a5a10)
- 🐞 수정:门 193 判红面补显式 stdio(check-hand-migration-snapshot 派生 git) (2bd0011ef1)
- 📚 문서:散文声明数字对齐现算(testFiles 4372→4404 / 守门 351→352) (0f8c684ffa)
- 📚 문서:B 票 + 存量红清单 + commit-tree 一次性例外留痕 (84d9ca21d6)
- 🐞 수정:F-89 流式中断按实际 token 结算；F-181 缓存命中 token 归零、请求次数照计 (e59db57adb)
- 📚 문서:更正对照组复核——web/RN ui-routes 本次 0 diff 但自身钉早已陈旧 (a9f02c26d6)
- 🐞 수정:F-203 Coze 扣费按定价折算成分,token 估算取 chars/4;Kling 1500 保持不动 (dcd98ca604)
- 📚 문서:记录 XUI-076 重生成完成（9fc8e895cb，8 文件）与终态钉/对照组 0 差异证据 (5d173a7dcb)
- 🐞 수정:XUI-076 重生成 i18n 四语载荷与 ui-routes 白名单（单一写入者一次完成，8 文件） (9fc8e895cb)
- 🐞 수정:F-203 stock-service 预扣/退还改按定价成本(分),不再拿 token 估算数当钱扣 (3cefb12800)
- 🐞 수정:F-203 Crew 路由删掉按 run 的二次扣费,避免与 adapter 逐次成本结算双扣 (5e608a3792)
- 📚 문서:记录 XUI-076 执行前闸门——API 线 F-203 未合 main 且四个同型扣费点未全部收口，暂不重生成 (7532cae8e6)
- 🐞 수정:F-203 异步回调 worker 改为按定价成本(分)结算,堵住 token 数当分的错扣 (2492296e86)
- 📚 문서:刷新 XUI-076 重生成前置清单（含 4 个 b64 载荷）并将 XUI-087 处置改为 B、由 API 线统一修 (5104a2ef05)
- 🐞 수정:F-203 口径 B,钱包扣减与 ai_cost_records 同源按真实成本(分)结算 (cea6f4565e)
- 📚 문서:XUI-086 opType 方向修正落地 + XUI-087 AI 计费腿判定（污染资金账，待费率口径） (60ab2b569e)
- 🐞 수정:opType 文案/正负号/颜色按服务端权威枚举（3=退款扣回 4=Relay 转账），未知值中性兜底 (0b3724817a)
- 📚 문서:同步文档数字（ciWorkflows 56→57、trackedFiles 20187→20188，新增 cleanup 工作流） (3aac6c7a2f)
- 🔧 기타:落地通道改为固定分支 cross-end-auto+复用单 PR+自批 CI+auto-merge；新增 3 天快照清理（默认 dry-run，删前导出 sha 清单） (669b753484)
- 🔧 기타:补两个钱腿端到端量纲断言（199 元 ⇒ 请求体 199 ⇒ 落库 19900 分；提现反向） (79eac0bbcf)
- 🐞 수정:写清 token_flows 同列两义（分/配额），钱流水端点默认排除 op_type=6 (ec179dfd99)
- 🐞 수정:API 套餐 price 分→元（表格/回填/提交三腿同源） (f219b27053)
- 🐞 수정:知识卡片读不到时抛 KnowledgeCardsUnread,不再覆盖旧卡库 (9295896f4f)
- 🔧 기타:worktree-state 注释收敛回 §3 <250 行(结构调整,非缺陷) (6b22eca35c)
- 🔧 기타:夹具对齐 wc-l 行数口径与技能扫描 fail-closed 语义 (2becdb0a36)
- 🔧 기타:对齐额度一位小数、V2 mock 与压缩锚点后的 parity 期望 (28d07ff516)
- 🐞 수정:会话发现区分读不到与没有,补齐跨产品迁移预演判定 (3ee8c4cde4)
- 🐞 수정:removeWorktree 恢复必填 withinRoot 根内断言 (1a9add9abb)
- 🔧 기타:require-permission mock 补 isSystemAdmin 同步导出，修 agents-market-public 4 例存量红（夹具缺口，无实现改动） (0648ffbd3a)
- 🐞 수정:金额单位 支付弹窗元值直用 + 订单详情映射 payAmount 并修正退款字符串 (a6413ea859)
- 🐞 수정:恢复检查点/hunk 目录的根内断言与路径穿越拒绝 (b1f3c6a6e7)
- 🐞 수정:金额单位 智能体详情/精选/分类价格按分转元 (8f7b3b3036)
- 🐞 수정:金额单位 支付宝下单分转元 + 提现分/元对齐 (2cd995ca5d)
- 🐞 수정:配置存在但读不到时抛错,不再静默当空层 (e0bd5f2aaf)
- 📚 문서:README 数字同步(F-26/F-31/F-49 新增 2 个测试文件:4449 / 20187) (8343b1f606)
- 🐞 수정:F-26 页码上界(1e308→Infinity)、F-31 agents 分页边界、F-49 MCP 转发 deadline 与超时/不可用分流 (17b4c9c4f6)
- 📚 문서:README 正文测试文件现算数同步(4446→4447) (7026d2d0bc)
- 📚 문서:README 数字同步(F-255 新增 1 个测试文件:4447 测试文件 / 20185 跟踪文件) (c79daf93d0)
- 🔧 기타:F-255 归属闸改异步后同步夹具(mock 补 findByIdOrRestore、结构断言容忍 await) (a7624e9799)
- 🐞 수정:F-255 终态派单运行时无界增长收口(200 条 LRU + 30 分钟 + Redis 回退/TTL) (2e4ab7e3ca)
- 🐞 수정:XUI-068 忘记密码复用 web 找回页断开死环 + XUI-071 分片下载有界 + XUI-054 FS 显式 not-supported (d6306a65b3)
- 🐞 수정:XUI-063 广场/充值文案 key 对齐源并补齐缺失键(含 common.gotIt) (af15ecdcb5)
- 🐞 수정:相对时间兜底补 ja/ko(Hermes 无 RelativeTimeFormat 时不再回落英文) (c38ec4c9b4)
- 🐞 수정:智能体价格分转元 + mobile-rn 订单/登录/产物 i18n key 补齐 (ffa7594775)
- 📚 문서:同步 RECENT UPDATES 生成块与 doc-autoupdate 基线 (2485323c91)
- 🔧 기타:补齐门 47 自愈注入留下的隐形载荷缺口，无业务改动 (f3ae170b31)
- 📚 문서:同步 RECENT UPDATES 生成块与 doc-autoupdate 基线 (8063d609f5)
- 🐞 수정:宿主壳对账补扫孤儿生成物(按 --screen 溯源行反查契约) (1229f26b8b)
- 📚 문서:抽走核心数字段残留派生字面量 + 补 Monorepo 分隔符 (0994e3a989)
- 🐞 수정:RN 宿主壳生成器按腿声明 hook + 把不可复现的旧壳判为陈旧 (54f841b4f7)
- 🐞 수정:倒计时统一收敛到 shared useCountdown(截止戳派生+回前台对表) (83f61d85eb)
- 🐞 수정:F-306 契约面去掉误导性 200,只声明 501 (0d8db01064)
- 🔧 기타:host-git/agent-control/考勤规则面板夹具跟上共享出口与 Tooltip(批次24) (9c374b6e6f)
- 🔧 기타:徽章/自定义侧栏/nav 计数夹具跟上 2026-11 实现(红面扫描批次23) (a870c411ce)
- 🐞 수정:修 knowledge-base i18n 泄漏并让争议夹具跟上实现语义(红面扫描批次22) (6edf5a1764)
- 📚 문서:同步 README 正文的测试文件现算数(4446) (eb11488487)
- 📚 문서:同步 F-38 夹具后的 README 现算数字(testFiles 4446 / trackedFiles 20184) (82bd61611f)
- 🐞 수정:F-38 aiServiceFetch 补默认 deadline 并抛可识别超时错误,与上游 5xx 区分 (0ef93c94b6)
- 🐞 수정:恢复学生考勤 B72 整月视图与自签退,并对齐 api-client 出口(红面扫描批次21) (495ca3e36c)
- 📚 문서:同步 README 正文的测试文件现算数(4445) (bf72910261)
- 📚 문서:同步 F-08 夹具后的 README 现算数字(testFiles 4445 / trackedFiles 20183) (f130b15a5e)
- 🐞 수정:F-08 agent-control 待处理指令绑定属主,/result 与 /execute 双端校验归属 (92339429b8)
- 🔧 기타:勾选 AIS-053（已修@2026-11-08/mcp-media-p1-1108@fdf457bd9a） (da95fbbd17)
- 🐞 수정:AIS-053 外部 MCP 落点默认 fail-closed + 注册权收归 admin + DNS 后按真实 IP 判定 (fdf457bd9a)
- ♻️ 리팩터:倒计时收敛进 useDeadlineCountdown(行为不变,非缺陷修复) (1d08865528)
- 🔧 기타:use-chat 三夹具补 onDone 回执对齐 G-816008 真变更(红面扫描批次20) (42937822c7)
- 📚 문서:同步 README 正文的测试文件现算数(4444) (0d24bd2a0b)
- 📚 문서:同步 F-07 夹具后的 README 现算数字(testFiles 4444 / trackedFiles 20182) (b292f991f5)
- 🐞 수정:F-07 后台 Agent 的 list/get/cancel 按登录归属过滤，创建归属不再接受 body userUuid (831f9fd268)
- 🐞 수정:ActivityDetailScreen 错误/空态恢复页头返回入口(BUG-NEW-01) (6814636558)
- 🔧 기타:tbox 分页腿 list 与课程小节批量取数桩(红面扫描批次19) (b37bb6ea5a)
- 🔧 기타:paginatedSuccess 返回 list 的三处断言对齐(红面扫描批次18) (ef3d9f89ff)
- 🔧 기타:家长账单批量取账/agent 首屏 50/消息可见投影对齐(红面扫描批次17) (9cacf3ed42)
- 🔧 기타:journal idx 0-based 与 MCP 纯代理腿计数对齐(红面扫描批次16) (adf18d872a)
- 🔧 기타:keepalive/sweep/微信判定对齐心跳与代理改造(红面扫描批次15) (6ec261bc82)
- 🔧 기타:池导入/告警/钱包对齐新契约(红面扫描批次14) (75e1de43c8)
- 🔧 기타:内容/内部中继/代管导入对齐 requireAdmin 与 HMAC 新契约(红面扫描批次13) (83f6dcecf0)
- 🔧 기타:补 require-permission isSystemAdmin 与 messages users 表桩(红面扫描批次12) (6620f18100)
- 🔧 기타:桥层上报转接 api-client 端点出口,消除模块级 fetchApi 盲区(红面扫描批次11) (f1bdb2ac81)
- 🔧 기타:fetchApi 改 text()+JSON.parse、插件改 api-client 端点、401 按 BUG-69 先清会话(红面扫描批次10) (bbe313a17a)
- 🔧 기타:补 Taro 运行时常量 define;崩溃上报 mock 补 reportCrash;community 壳页断言对齐(红面扫描批次9) (51592d32de)
- 🐞 수정:n8n 创建表单补回 3 个 useUiField 登记;采纳锁随壳承载退场(红面扫描批次8) (08274c0295)
- 🔧 기타:桥层上报改 mock api-client 端点出口;搜索文案走 sharedT(红面扫描批次7) (1eaf457e97)
- 🔧 기타:SSO 断言对齐生产域名回退(BUG-41/68),不再钉 localhost:8802(红面扫描批次6) (428ef237f2)
- 🔧 기타:会话历史排序结构锁下沉到 shared/chat/conversation-org(红面扫描批次5) (3d77870667)
- 🔧 기타:pump 慢路径计数/Avatar 接锁/chip 行距死腿与 token 化对齐(红面扫描批次4) (456d1777e3)
- 🔧 기타:ENGINE_METHODS 补两法 + 空响应体按 null 新契约(红面扫描批次3) (8d5f5272db)
- 🐞 수정:VipScreen 接回 host port;linuxdo 排序夹具对齐(红面扫描批次2) (cf2bffa4a1)
- 🚀 기능/개선:P1-P5 全量收口(二级聚合挂载图/PG持久化/真实判定网关/预算留痕/基准/测试增强) (6ea56fc0d2)
- 🔧 기타:对齐 journal 0-based 与已删除的孤儿安装迁移(红面扫描批次1) (ff17c13163)
- 🐞 수정:清偿全量 typecheck 存量红（14 处，含 F-270/F-252 遗留的类型回归） (e009f22742)
- 🔧 기타:勾选 AIS-008（已修@2026-11-08/mcp-media-p1-1108@bcf50b3280） (b06174d971)
- 🐞 수정:命令流/子代理进度流改为有界队列(AIS-008) (bcf50b3280)
- 📚 문서:同步 F-223 夹具后的 README 现算数字(testFiles 4443 / trackedFiles 20181) (3bbf54cc3c)
- 🐞 수정:F-223 未匹配路由的 apiCallTotal 统一落 __unmatched__，消除无界标签基数 (c6730d06bc)
- 🔧 기타:勾选 AIS-049/057（已修@2026-11-08/mcp-media-p1-1108@2b1f28b3d2） (28c8b748ea)
- 🐞 수정:self_media 历史查询不再吞 DB 故障 + 工具兜底回执补 errorCode 并脱敏(AIS-049/057) (2b1f28b3d2)
- 📚 문서:同步新增夹具后的 README 现算数字(testFiles 4442 / trackedFiles 20180) (6414ce5494)
- 🐞 수정:F-291 SSE 重放缓冲容量满时重注册不再误淘汰其他活跃流 (461bbae68a)
- 🔧 기타:勾选 AIS-035/083（已修@2026-11-08/mcp-media-p1-1108@bc025ddb42） (4621a5eeab)
- 🐞 수정:computer-use 导航 SSRF 双闸 + file_edit 读改写整体持锁(AIS-035/083) (bc025ddb42)
- 📚 문서:同步 README 文档数字与最近提交面（testFiles/apiRoutes/trackedFiles 与现算对齐） (e179987387)
- 🔧 기타:补齐本次新增 11 个文件的 47p 溯源水印 (87e35b6132)
- 🔧 기타:勾选 AIS-054/056/085（已修@2026-11-08/mcp-media-p1-1108@c2e723bf2d） (9351e9a823)
- 🐞 수정:web_search 失败透传 + Windows 进程树回收 + db_query 主机文件函数黑名单(AIS-054/056/085) (c2e723bf2d)
- 🔧 기타:补门 193 存量违规 —— check-hand-migration-snapshot 的 git diff 派生显式接管 stdio (3eba6c71fd)
- 🐞 수정:F-324 不可采样时不再输出 NaN,usage 序列直接省略 + available 状态位 (836cd95169)
- 🐞 수정:F-306 Workspace agent/run 停伪成功,LLM 端点补 /api 前缀,失败落 failed (78226aa578)
- 🔧 기타:勾选 84E/93E/94E（AIS-084/093/094 已修@781905ece0） (49c0fac00e)
- 🐞 수정:F-290 WS 限流删除 BURST 死分支，30 条/秒为硬上限 (5828640196)
- 🐞 수정:F-449 金额列 real→numeric(12,2),支付换算改十进制精确 (cfb0b7b2da)
- 🐞 수정:抓取族补网络审批门 + 媒体代理流式限流 + Chrome 导入端口属主绑定（AIS-084/093/094） (781905ece0)
- 🐞 수정:F-188 统一 skills:<uid> 为 JSON 数组，识别并救回历史 Hash，install 不再吞掉写入失败 (6a087b84c9)
- 🐞 수정:F-165 调用趋势改用 llm_call_logs.cost_cents，消除恒 500 的空面板 (4609d003c7)
- 🐞 수정:F-30 workspace git/status、git/review-diff、github/status 接入 workspace 权限闸 (6d9f31cdb2)
- 🐞 수정:F-432 Workspace ACP 会话真落库 + begin/end 归属校验 (744822836d)
- 🐞 수정:F-29 pipeline-rollback 的 backupDir 限制在工作区内，拒绝绝对/.. 越界读取 (be36fcbc95)
- 🐞 수정:F-85 Batch 单对象端点校验 _apiKeyId 归属，跨租户读写/取消按 404 (71ec16d9d9)
- 🐞 수정:F-424 用户任务列表改为分页扫描后按归属过滤 (f26fc249de)
- 🐞 수정:导出正文缓存写入前清扫过期项 (F-41) (aa6d931b0b)
- 🔧 기타:勾选 29E/30E/55E（AIS-029/030/055 已修@680ccf0fd7） (9fbc1c5b1c)
- 🐞 수정:F-334 积分兑换改为 referenceId 精确判重 + 唯一索引并发兜底 (7279e93b01)
- 🐞 수정:浏览器会话上限/降级回收 + 自媒体调度关停 + 后台任务终态保留（AIS-029/030/055） (680ccf0fd7)
- 🐞 수정:Redis publish 失败时回落本机直推,不再静默丢通知 (F-113) (6face3f2c2)
- 🐞 수정:F-180 响应缓存键改用 upstreamMessages 并纳入 top_p/penalties/seed/response_format (d458f4dd64)
- 🐞 수정:F-56 OAuth authorize/userinfo 叠加 token 黑名单检查，登出后不能再换新令牌 (4699e0f2bc)
- 🐞 수정:F-228 单条结算同步补 pending 状态闸,堵住残留的先记账路径 (ee5909ebf8)
- 🐞 수정:F-203 收紧为两段判定,禁止零余额先跑后账 (620437d2b2)
- 🐞 수정:文件搜索强制上限 50/硬顶 100 并接受 limit 参数 (F-19) (2a7a74a671)
- 🐞 수정:F-324 连接池指标不可采样时显式报不可用,不再假绿 0 (cc10014367)
- 📚 문서:p0p1 交接与复核结果 + README 数字块刷新 (591fd05b48)
- 🐞 수정:F-288 CSV 注入过滤覆盖前导控制字符/空白，导出器 TAB 也加引号 (a6efaa3015)
- 🐞 수정:F-252/F-253 自动化 SSE 增加总/空闲超时，断流与流内错误帧按失败结算 (2a68bd67a0)
- 🐞 수정:文件搜索/最近/全局搜索排除回收站记录 (F-18) (5d2cf741c9)
- 🐞 수정:F-346 webhook 投递先持久认领再回 200 (5dedc68989)
- 🔧 기타:勾选 24E/82E/95E（AIS-024/082/095 已修@389dc8a096） (a4b759f91d)
- 🔧 기타:F-203 夹具补溯源水印头(推送门 47p 覆盖) (f208ff1c94)
- 🐞 수정:F-259 超长幂等键不再静默截断（三处读键统一按没带处理）；F-270 Coze token 缓存按 clientId|userUuid|scope 分槽 (87677474fb)
- 🐞 수정:F-238 洞察成本维度改查 cost_cents 并暴露降级维度；F-246 审计链查询区分缺表与失败，失败不再静默成空 (46a214d33b)
- 🐞 수정:AIS-024/082/095 定时发布抢占 CAS、read_file 读侧上限、run_id 归属 (389dc8a096)
- 🐞 수정:P89 租约行收成一条 + 门13d 立维⑤「整行逐字重复」差值棘轮 (e727680394)
- 🐞 수정:F-203 Crew 子 LLM 按真实 usage 扣钱包并写 token_flows (c5d442294e)
- 🔧 기타:修复: ai-service 合并波次 hybrid 收口(AIS-100/050/051/081) (92f67fe33d)
- 🔧 기타:勾选 23E/40E/42E（AIS-023/040/042 已修@134b439d76） (ab8f2c53cd)
- 🐞 수정:F-472 ai-service 直连代理补齐超时；F-473 OAuth 回调补齐超时；F-474 Coze SSE 空闲超时与客户端断连取消 (abb452a946)
- 🐞 수정:F-347 自定义 registry 识别 IPv6 方括号与 302 逐跳复检；F-348 fetchWithTimeout 覆盖正文读取 (f3ffa5377a)
- 🐞 수정:AIS-023/040/042 发布并发门、定时任务管理门、运行态归属 (134b439d76)
- 🐞 수정:F-68 礼物扣款统一到 user_margins 主账本并补 token_flows (fe3feafaaf)
- 🐞 수정:F-420 生成队列去重不再把 completed/failed 旧作业当命中；F-421 TaskExecutor 支持取消/超时/wait 上限与任务表上限 (16ab6c051f)
- 🐞 수정:F-428 batch 保存失败也断开 Redis 连接；F-423 配对过期请求与超量会话回收 (8ed9eb7cfb)
- 🐞 수정:AIS-102 self-healing 端点补管理员门 (a115b9775f)
- 🐞 수정:F-418 anydoc 加载失败不再被进程级永久缓存，失败后下次请求重试（文档解析与 Markdown 转换两处） (efd68fc2d5)
- 🐞 수정:F-340 上一面登记表解析失败透传为未判定；F-411 定时任务 errors 非空记 failed (33b686a754)
- 🐞 수정:AIS-102 self-healing 端点补管理员门 (d68423ddd6)
- 🐞 수정:F-147/F-689 支付重放加状态守卫与订单号唯一约束,endTime 锚定支付时刻 (ff276504d8)
- 🐞 수정:F-228 结算补账期唯一键与主库条件插入,客户端传价显式 400 (ede422e8e5)
- 🐞 수정:F-616/617/670 relay 渠道腿上游头超时、4xx 不计熔断、客户端断开不记失败账(并顺带 cancel 非 2xx body) (80e36e330f)
- 🐞 수정:同面封装不再误报 no-content,补 19 道门方向锁 (abe25479d0)
- 🔧 기타:勾选 101E/104E/105E（AIS-101/104/105 已修@77230b153b） (88d1787c42)
- 🐞 수정:AIS-101/104/105 录制属主、全局记忆 reset 权限与重载、沉淀计数有界 (77230b153b)
- 🐞 수정:F-377/F-378 登录风控上下文补齐 ip 信誉与异地判断，注册风控数据源不可用时 fail-closed 503 (41b82ed961)
- 🐞 수정:F-605 风控体检测点不再先于 authenticate 执行，改挂路由级 preHandler 末尾 (df1037b42b)
- 🐞 수정:P0 Apple id_token 按 JWKS 验签,堵自签 JWT 冒充任意 Apple 账号 (88c599252f)
- 🐞 수정:审计密钥登记解析失败改未判定,不再默认放行 (F-340/340G) (ddeb90c49c)
- 🐞 수정:团队收件箱绑定 actor,禁冒名/跨人已读 (F-350/350G) (45478c80a7)
- 🐞 수정:移出团队成员同事务回收知识空间授权 (F-384/384G) (ec3e0ec3f1)
- 🐞 수정:spec 读写/提交按工作区权限做用户级 ACL,非属主 404 (F-390/390G) (09194288ee)
- 🐞 수정:小程序消息房间端点按 roomId 对端过滤 (F-211) (a6e89dab58)
- 🐞 수정:Agent 任务按发起人归属并诚实落 failed (F-39/F-306) (6cd8bc5e1a)
- 🔧 기타:对齐协议方法清单与空响应体期望(仅测试侧) (92149f6ee8)
- 🐞 수정:tools.result/approval.respond 回传失败不再静默吞掉(PKG-01) (b457a2e5db)
- 🐞 수정:XUI-074 审批卡片与标注输入行补 maxHeight/ScrollView/KAV (eb74643e55)
- 🐞 수정:F-269 注销 PII 擦除事务化并补齐五类残留表 (16d4484e2c)
- 🐞 수정:F-206 浏览量 onResponse 单点计数 + F-284 err 日志打码 (9352cdf254)
- 🐞 수정:分类器补认 git grep 的正文面并清 T19(no-content 是口径盲区不是脚本缺口);T6 文档面改 AGENTS∪README 同 R4 口径 (3935c3140c)
- 🐞 수정:postMessage 来源闸 + runtime 切会话残留重置(S-08/S-09) (54f6465567)
- 🔧 기타:勾销 582G/583G/688G 并落档 F-583/F-584/F-689 修复结论 (c1190f8059)
- 🐞 수정:开发者订阅按 orderId 唯一幂等，回调重放不再重复插订阅(F-689) (ec2f95556f)
- 🐞 수정:F-03 replaceMessages 增加会话属主校验,堵跨用户清空/覆写 (3d259432f4)
- 🐞 수정:结账页档位改由服务端解析,plan id 不再当 vipLevelId(P1) (2aaefa1ea5)
- 📚 문서:缺陷① 提交期登记门接线落地并关闭票 (30372adf74)
- 🐞 수정:302 提为 blocking 且只拦承载面,新接 302r 登记同步只报数 (b13a7fd3dc)
- 🐞 수정:提交面按索引取材并只让承载削减面阻断 (8d9a257219)
- 🐞 수정:催费微信按渠道开关，留痕先 pending 后按送达落 sent/failed(F-583/F-584) (0bcf77a3a7)
- 🐞 수정:F-191 系统 token AI 端点按 usage 归账到调用者 (cbb20b06f8)
- 🔧 기타:勾选 103E/108E/109E（AIS-108/109/103 已修@df01268091） (fb56f29d3f)
- 🐞 수정:F-260/F-261/F-671 表格与 diff 资源预算、上游断连取消 (7bd0bbd134)
- 🐞 수정:F-139/F-140/F-236 知识库入库事务化与终端会话回收 (1f051a19df)
- 🐞 수정:AIS-108/109/103 会话与主体归属、probe 逐跳 SSRF 收口 (df01268091)
- 🐞 수정:F-190 微调任务按调用者隔离,F-216 owner 谓词改同位绑定 (a7023b7835)
- 🐞 수정:圈子帖 visibility 落库过滤 + 评论 UGC 过滤/原子计数/回复归属 (F-332/F-335) (93d1747085)
- 📚 문서:locale 残留共用的扫描器按 lint-staged 语义自述取材面 (fd4adb0891)
- 🐞 수정:F-54/F-155/F-134 跨租户读写面收紧为管理员,普通用户 403 且下游零触达 (b0c86ac64a)
- 🐞 수정:第三批——旧扫描根/死维度(17/91/105) (226b420ce7)
- 🐞 수정:剧本改/删/批量删按 createdBy 属主或管理员收口 (F-159/159G) (32a4fdd648)
- 🐞 수정:工单评级仅属主可读 (F-160/160G) (ab33ed4bd3)
- 🐞 수정:chat/stream 与 chat/resume 身份只认认证主体,堵 metadata.userId 跨用户读知识库/错置预算 (F-02) (271f7ccbba)
- 🐞 수정:第二批——取材面与级别对齐(11b/20/27/34/38/2g-web) (4e058c545f)
- 🐞 수정:完成率 count 转 int、账本 user_id 放宽可空并补迁移（F-699/F-433） (2c34c4fd6f)
- 📚 문서:四条证据缺口标未判定(不计入已修) + CLI/AIS 标否条目复核结论回填 (252fa5ea15)
- 🔧 기타:勾选 98E/99E/110E（AIS-098/099/110 已修@d6bffcd978） (cc7ca8b008)
- 🐞 수정:AIS-098/099/110 外链图片下载与 edu 退款 id 收口 (d6bffcd978)
- 🐞 수정:agent-control/execute 投递目标只认 JWT 主体,堵 body.userId 跨用户派发 (F-07 同族) (071278fc58)
- 🐞 수정:退费校验归属与额度并锁流水，全额退满推离 paid，汇总冲减退费(F-315/F-322) (b9cac6fdf2)
- 🐞 수정:AIS-046 审计成功码统一为 0 + AIS-047 审计中间件落主体 user_id (21bd5a2df1)
- 🐞 수정:三个 by-ids 批量端点只返回 status=1 (F-331/331G) (55094ac14a)
- 🐞 수정:隐藏圈子详情/帖子/发帖可见性闸 + 成员校验 (F-330/330G) (0aced0d0e0)
- 🐞 수정:官方知识库写面收口管理员,读面按发布态过滤 (F-329/329G) (649aeaf899)
- 🐞 수정:U-7 提现金额剥离千分位并如实提示失败 (1a24120be2)
- 🐞 수정:IME 提交守卫 + token 作用域与 storage 访问级收窄 (bacfc1dd4d)
- 🐞 수정:缴费落库与账目重算收进同一事务，重算先 FOR UPDATE 锁行再读(F-316/F-582) (a4ff3e50f1)
- 🐞 수정:AIS-019 语义召回把属主下推到检索层,勿让他人条目占满全局 top_k (e12f8a9550)
- 🐞 수정:XUI-055 选图垫片尊重多选声明 (81b3fc2771)
- 🐞 수정:圈子分类关系全局配置写面收口管理员 (F-158/158G) (78beb8b7bc)
- 🐞 수정:审批应答按认证主体复核，堵住"他人代答批准高危工具" (78e0957509)
- 🐞 수정:170 fail-closed + 260 依赖触发面/暂存面真判 (32bc4c4451)
- 🐞 수정:消息来源闸 — bridge/ext-ui/content 的 sender 校验与零副作用夹具 (7eb29354c4)
- 🐞 수정:XUI-061 时间格式按调用时创建不再冻结时区 (0831c5f8a0)
- 🔧 기타:勾销 691G/692G 并落档 F-692/F-693 修复结论 (63d288d2b3)
- 🐞 수정:XUI-051 补 MediaTypeOptions 别名 (bcbd00572c)
- 🐞 수정:浏览时长收敛为单条原子 upsert + 考试状态机统一 submitted→graded(F-692/F-693) (becc864f28)
- 🐞 수정:XUI-056 导航垫片兼容对象形 navigate (c6fc25f996)
- 🐞 수정:禁用/删除同步吊销 refresh token,member-users 写响应白名单投影 (F-127/F-131) (7b36965af8)
- 🐞 수정:XUI-052/053 rn-compat 补齐相册与去设置垫片 (6db56b4765)
- 🔧 기타:勾选 100E/117E/118E（AIS-100/117/118 已修@9479704a7f） (61417e2efe)
- 🐞 수정:F-03e /chat/steer/reorder 归属校验 —— 越权重排他人 steer 队列一律 404 且零副作用 (852d803a24)
- 🐞 수정:AIS-100/117/118 身份与落盘失败语义收口 (9479704a7f)
- 🐞 수정:XUI-065 智汇值格式收敛到共享函数 (a3021e99e5)
- 🐞 수정:开发者链接写归属强制取令牌主体 (F-138/138G) (f3cfedb521)
- 🐞 수정:Coze 全局变量面收口系统管理员 (F-137/137G) (e0975b7170)
- 🐞 수정:XUI-066 组3b 通知设置不再吞掉加载失败 (67f95aa05b)
- 🔧 기타:更正 F-04/F-06 证据为 fix/api-p0-1108 并记录移交 (a0b99e8317)
- 📚 문서:174 道 pending 门只读体检清单与 222 枚 lost-commit 命名缺陷 GC 判据 (a4c176283e)
- 🐞 수정:F-03b/c/d 流控制端点归属校验 —— abort/steer/steer-withdraw 越权一律 404 且零副作用 (0ff34b851f)
- 🐞 수정:XUI-066 组3a 消息中心/推广排行/隐私设置不再吞掉加载失败 (d8e7efae39)
- 🐞 수정:原子回滚 checkpointId/快照路径越界校验（F-27） (0b36ae1723)
- 🐞 수정:n8n webhookPath 同源校验与 SSRF 危险地址族补齐（F-117/F-215） (9b5cf6dc89)
- 🐞 수정:后台 Agent 与执行回执按登录属主收敛,堵跨用户 list/get/cancel 与 result 伪结算 (F-07/F-08) (ff80abe77a)
- 🔧 기타:移交：F-04/F-06 由 fix/api-p0-1108 修复，此处回退避免双实现 (138bd5120a)
- 🐞 수정:XUI-066 组2b 资讯/VIP/直播订阅不再吞掉加载失败 (27140b31c8)
- 🔧 기타:勾选 106E/107E/116E（AIS-106/107/116 已修@b19be35552） (78c4e35052)
- 🐞 수정:智能体人设归属闸 + 规则参数写面收口 admin (F-133/F-363) (702337d515)
- 🐞 수정:XUI-066 组2 发布与讲师详情不再吞掉失败 (6c49f40763)
- 🐞 수정:单条审核仅允许 status=0 放行,uuid 形状闸+审计 (F-129/129G) (e0ddc1ef11)
- 🐞 수정:AIS-106/107/116 补 file_search/investigate/image_edit 调用前闸 (b19be35552)
- 🐞 수정:查询数组双向可还原 + 顶层数组形状收口 (a5082d93c6)
- 🚀 기능/개선:新增提交期屏/路由登记同步只读门(未接 .husky) + 临时仓库三态夹具 (1c1bce0b2b)
- 🐞 수정:问答/分销统计/创作列表按登录身份收敛,堵 query.userId 与 body.userId 越权读 (F-04/F-05/F-06) (e18899419a)
- 🐞 수정:XUI-066 组1 五个壳把加载失败如实上抛 (5fd91c5f27)
- 📚 문서:教育域「否」条目逐条复核落档——F-690/691/694 坐实已修，F-692/693 坐实待修，F-449/689 转资金线 (0744c48551)
- 🐞 수정:支付凭据只收标量 + Enter 提交防回潮守卫 (8b3e7c0b5f)
- 🐞 수정:公开试卷列表/详情/取题/开考补 status=1 判据，禁用试卷不可达(F-690) (3163dccb52)
- 🐞 수정:XUI-073 + 同型B死路由 充值失败不跳空单号、/pagesA 迁在册页 (b342856a45)
- 🐞 수정:根治门禁基础设施三缺陷 (f2314ea16d)
- 🐞 수정:三条存量红真修——钩子/安全提交只读探针迁 gitRaw,夹具增长按新证据记账 (bc814f64be)
- 🐞 수정:私密名片详情仅属主可见,浏览量原子自增 (F-156/156G) (f6d3ff19fd)
- 🐞 수정:分类创建/付费开关/缓存运维收口到管理员 (F-359/361/362) (3beb864b81)
- 🐞 수정:审计日志按 key 递归脱敏凭据字段 (F-128/128G) (b944de83f8)
- 🐞 수정:倒计时改截止戳派生(use-countdown/use-register-form) (b02dbe204e)
- 🐞 수정:XUI-069/070 请求竞态丢旧响应、下单与选图入口上锁 (981c44915b)
- 🔧 기타:补 F-069/F-047/F-062/F-087/F-003/F-097 夹具(4 条行为级 + 4 条结构锁,均实测旧码红) (7ce2de83ee)
- 🐞 수정:XUI-050/072 + 假思考进度 权限如实上报、签到 toast 互斥、去掉伪造百分比 (95e1a0892e)
- 🐞 수정:学生自助签退只接受服务端当日，历史补签由教师代签承担(F-210) (74a49610b2)
- 🐞 수정:远端位置只问服务器(收编腿改 resolveRemoteHead),棘轮 3 条存量红收口 (1e4810338e)
- 🐞 수정:成绩指标按记录终态只计一次，人工阅卷/复核走增量平移(F-694) (d40957f377)
- ♻️ 리팩터:门脚本裸 git 迁入 gitRaw/catBatch,删除自拼 batch 与 spawnSync (327598e096)
- 🐞 수정:公开专题详情过滤未发布课时，管理员预览显式 includeUnpublished 放行(F-691) (2de550fd3c)
- ♻️ 리팩터:lib 层派生 git 迁入取材层(含 push-receipt 远端/批查改走 ls-remote+catBatchOids) (1c0403149f)
- 🐞 수정:content-extended 内容管理端点逐路由 requireAdmin，AIGC 自助面恢复登录可用(d050d90d10 起管理端为 admin-only，夹具补管理员身份) (9d72a23d13)
- 🔧 기타:勾选消息/聊天域身份采信三条(F-03/F-04/F-06)并追加 sidecar 证据 (a837c5f963)
- 🐞 수정:消息/聊天域身份采信点 F-03/F-04/F-06 —— 会话归属与主体一律以服务端认证态为准 (3183046cf8)
- 🐞 수정:审计链查询失败不再吞成空结果 (F-246/246G) (a1ed380dbb)
- 🐞 수정:结算缓存/收入概览运维面收口到管理员 (F-365/365G) (0d396d392a)
- 🐞 수정:全站打赏流水仅管理员可读 (F-199/199G) (ba48392ca8)
- 🔧 기타:收口钩子格式化与溯源水印残留(纯格式,无逻辑变更) (6515de9ec6)
- 🔧 기타:F-002 旧断言 toBeUndefined 本身就是错的 —— 补齐理由并实测旧源码红 (a799cf700a)
- 🐞 수정:W-03/W-06 收口 + 同型根因自查 S-01/02/03 (682034b1fd)
- 🐞 수정:终端会话自然退出即回收,注销擦除补齐五张 PII 表 (F-236/F-269) (f34d9ad906)
- 🔧 기타:F-103 补旧码必红夹具(runtime 跨 chunk 残帧 + 行内坏字节不吃下一帧) (93130904d2)
- 🐞 수정:AIS-081 元字符机制改为按 shell 形态判 + AIS-050 声纹克隆归属/计费闸 (4af2f5490f)
- 🐞 수정:XUI-017/018/046 关于入口逐条路由、社区入口迁 pkg-ai、直播结束与人数 (b776154139)
- 🐞 수정:删角色同事务清理用户-角色/部门/菜单绑定 (F-403/403G) (1661b376a3)
- 🐞 수정:封堵打赏流水匿名读,并给 Kling 轮询加归属校验与幂等扣费 (F-199/F-119) (a16b82c1bd)
- 🐞 수정:DG-06 预算单一来源(defaultTimeoutMs),30a 按 2026-11-08 复测收敛(600s),超时不洗绿 (5583f50cfc)
- 🐞 수정:XUI-023/024/031/045 运行时代次、分页依赖环、溢出作用域、分享图片 URI (beb86a377f)
- 🔧 기타:收口 post-commit 钩子格式化残留(无逻辑变更);payment.test.ts 固化「processing 当成功」的旧断言此前已纠正 (80d9341826)
- ⚡ 성능:门 30a 缓存跨 worktree 共享 + reflog 面提速,存量悬空债清理 (5657fea9e3)
- 🐞 수정:judgedGapWeb 拆登记面与承载拆解面，诚实登记不再判红 (c3d819dd6a)
- 🐞 수정:平台 Key 图像/音频/视频编排补计费闸与资源回收 (F-103/F-104/F-105) (879a8df5a6)
- 🐞 수정:XUI-026/027/030/033 通知 type 兜底、408 归瞬时、小时除数、续读保留对侧游标 (f2df1e6ca3)
- 🔧 기타:勾选第三批 5 条 P1(F-02/F-285/F-381/F-549/F-568)并追加 sidecar 证据 (847e1740a9)
- 🐞 수정:修复考试倒计时/IME误提交/充值钓鱼三组缺陷 (W-01/02/04/05/07) (434a93e097)
- 🐞 수정:Persona 写端点整组收为管理员,内置人格不可改 (F-364/364G) (de18e75902)
- 🐞 수정:分类更新收口到管理员并加字段白名单 (F-360/360G) (3571c9757f)
- 🐞 수정:DG-11 gate-scope 头注以实现为准,改注释不改行为 (4075db4e2b)
- 🐞 수정:DG-10 format 显式基线不可解析改为未判定,全零 sha 回落显式告警 (d33fb0412d)
- 🐞 수정:DG-09 HUSKY_SKIP_TYPECHECK 只跳过 T1,其余 12 道 push 门照跑 (25d5944603)
- 🐞 수정:DG-08 拆 built/healthy 两态标记,被杀轮次下一轮必重跑门禁 (a989580bb3)
- 🐞 수정:DG-07 守护锁增记 pidStartTime,pid 复用不再永久死锁 (3a1951dba9)
- 🐞 수정:消息/上传域第三批 P1(F-02/F-285/F-381/F-549/F-568) 以服务端身份为准并收口资源与清理边界 (2fc4299c8a)
- 🐞 수정:XUI-015/037/044/048 注销路由、相册 loading、webview timer、录音卸载清理 (b5f1627643)
- 🐞 수정:已撤销证书禁止下载 PDF，与验证接口同口径 404(F-570) (6355eb628f)
- 🐞 수정:公告详情校验发布时间/过期，CLI 列表与版本查询下推到 SQL(F-488/F-489) (8d02465cc1)
- 🐞 수정:legacy-learn 统计接口按登录身份定归属，专题/课时过滤发布状态(F-515/F-517) (f0fe4740ed)
- 🐞 수정:XUI-020/034/036/042 改密失败复位、脱敏容错、手机号/金额边界、订单列表归一 (3bf0fc4dcb)
- 🚀 기능/개선:直跑面 ratchet + --only 单门入口(A+C 裁决落地) (ba514fec82)
- 🐞 수정:n8n webhookPath 锁同源防密钥外泄、SRS 服务器密钥仅管理员可读、推流列表/详情按属主收敛(F-117/F-195/F-196) (dee4e559cc)
- 🐞 수정:MCP servers 全局表收口到管理员,封死跨用户读/删/注入 (F-101/101G) (1d0f00caf4)
- 🐞 수정:注销 PII 擦除补齐 5 表并改 fail-closed 事务 (F-269/269G) (28d9e65b65)
- 🐞 수정:XUI-022/025/032 通知订阅引用稳定、loadMore 失败解锁、分页同 tick 去重 (b400751172)
- 📚 문서:记录跨根 tsbuildinfo 实测/共享 buildinfo 重写说明与 stale-dist 夹具漂移归因 (3d3b5580fc)
- 📚 문서:登记 ai-service 沙箱实现缺失与 30a 缓存分片/备份命名空间事实 (a8e5f11ca7)
- 🔧 기타:陈旧 dist 夹具补齐 js+d.ts 成对产物,新增产物缺失仍判红对照 (e5ab1c0f42)
- 🐞 수정:self-media 记录列表按作者收口,跨用户 payload 不再泄露 (F-170/170G) (23751e8e7a)
- 🐞 수정:平台 Key 媒体代理补余额闸与结算、OpenRouter 代理计费/超时/错误体收敛、多厂商编排去重限流(F-87/F-93/F-192) (19d6df7c02)
- 🐞 수정:XUI-038/039/043 会员支付走真实链路、成功页只认服务端 paid、换绑提交旧号验证码 (dd880eef4b)
- 🐞 수정:dist 内容缓存键纳入构建根/outDir/tsbuildinfo,禁止跨根复用 (62836eb12d)
- 🐞 수정:重建前隔离跨根 tsbuildinfo,产物缺失点名到具体路径 (0bfbc66476)
- 🔧 기타:登记 DB-34/38/39 两条迁移到 journal（idx 375/376） (f3d60f9569)
- 🐞 수정:大表索引部署前 CONCURRENTLY、租户池预算、副本选举、批量价格/配额与旧表白名单（DB-11/41/42/43/44/45/46） (1537567c09)
- 📚 문서:收口门 173 文档数字结构性修复,写入运维一句话 (0e52466c44)
- 🐞 수정:统一连接池护栏、池可关闭、max 可配、校验脚本去明文口令（DB-29/30/31/32/33/36） (459b820415)
- 🐞 수정:全新库守卫接线、迁移 workflow 复位、读写分离健康与读己之写（DB-08/10/26/27/28） (4b83d3e3ca)
- 🔧 기타:补勾 52E(AIS-052,与 AIS-031 同源分派闸同笔修复) (24b0b27c3a)
- 🐞 수정:批量取账本/小节、订单按时间序、统计总览缓存（DB-20/21/22/23/24/25） (1b014454f3)
- 🐞 수정:XUI-028/029/035/047 权限 fail-closed、水合失败不落盘、重试上限、提现入口锁 (c126e0892a)
- 📚 문서:登记 T1 tsbuildinfo 假红(每并行分支复发,根治归专项) (cabec4abb5)
- 🐞 수정:heat-stats 按小时水位增量同步,消除 usage_count 重复累加 (F-262/262G) (df6f7947f5)
- 🐞 수정:watch-aspect 计数钩子移到鉴权之后,杜绝匿名/越权计数 (F-206/206G) (12d8fed34e)
- 🐞 수정:SRS 服务器列表收口到管理员,apiSecret 不再外泄 (F-195/195G) (2c900395ab)
- 🔧 기타:导出 resolveLedgerPath 供 F-075 ⑦b 夹具断言(EACCES⇒null) (f134e3e82f)
- 🐞 수정:logger 对 err(含 Error) 递归凭据打码 (F-284/284G) (f96d96298d)
- 🐞 수정:后台长跑命令分派按角色收口(AIS-031) (acc6d80cbf)
- 📚 문서:校正数字块注释,如实描述 push 档全判 (9aa8248aa7)
- 🐞 수정:备份加密、管理员口令重放守卫、RLS 旁路收窄（DB-34/38/39） (ce81516076)
- 🐞 수정:refresh 重放拒绝 stale-sibling、OAuth 码原子消费、usercenter 脱敏 2FA 凭据(F-268/F-244/F-245) (045402b2ff)
- 🐞 수정:增量索引写/删失败不再推进快照(AIS-027) (61369af5cc)
- 🐞 수정:computer-use 宿主机键鼠/截屏整族收紧到管理员 (F-400/400G) (1d8f9b5ab9)
- 📚 문서:清掉中英头条残留的派生数字字面量 (51f66de013)
- 🐞 수정:team memory 越权写、隐私预热误判、DAG 跳过与配额重试、符号检索归属（SDB-31/34/37/38/39） (0323111b74)
- 🐞 수정:封堵内置管理员改密/第三方绑定接管与私信通知越权读(F-125/F-126/F-154) (9eb017a220)
- 🐞 수정:课程评价补报名闸与服务端 signId，判重插入原子化(F-503) (2503dce969)
- 🐞 수정:SRS 流列表/详情/状态按属主收口,保留属主与管理员路径 (F-196/196G) (b03181c969)
- 🐞 수정:修掉 mcp 与安全组 9 条存量红 (764221fff7)
- 📚 문서:抽走 README 正文派生数字,数字块收口为唯一写入口 (91ca025370)
- 🐞 수정:教育公告按 sort/发布时间稳定排序，并按 publishTime 控制对外可见(F-637) (239830bbdb)
- 🐞 수정:withTenant 的 SET LOCAL 必须在事务内并对租户标识 fail-closed（DB-40） (5b705b64ec)
- 📚 문서:测试文件数 4378→4379 与现算值对账 (a772cb88ff)
- 🐞 수정:派发器如实传入 env,判面冲突当场 exit 2 (edd6a71fd6)
- 🚀 기능/개선:门体同代自检 + 判面显式声明 + 重试变绿判未判定 (9a3f2a4561)
- 🐞 수정:学生自助签到只允许当日，拒绝客户端任意 date(F-210) (1e0d9d1a9d)
- 🐞 수정:relay 凭据刷新不再丢字段/丢更新，并修 alipay 时区、cli-import 后缀、告警任务状态（SDB-32/33/42/43） (f6bee8ba44)
- 🐞 수정:对齐 schema 与迁移链的漂移并修 NOT NULL/唯一约束（DB-16/17/18/19/37） (27cff4fa99)
- 📚 문서:余下正文 4383→4385 全部对齐 (74bcbef7d4)
- 🐞 수정:TTS 链路改走服务间凭证并显式告警降级(AIS-092 连带) (1d4207f4af)
- 🐞 수정:批次/考试/证书/自媒体读接口按属主收敛(F-85/F-168/F-169/F-170) (d47f12ba47)
- 🐞 수정:OAuth web token 授权码改为原子消费 (F-244/244G) (14f113ad09)
- 🐞 수정:迁移账本一致性与手工修复通道收口（DB-07/09/12/13/14/15） (8a7c642ed4)
- 📚 문서:正文测试文件数对齐现算 4385 (ae9b9c7f11)
- 🐞 수정:课程/视频 8 个管理写端点升级为管理员闸(F-166 P0) (dbd9b80acd)
- 🐞 수정:客服/ws-ai 会话与出站身份归属校验(F-109/F-112) (ce6b59caf3)
- 🐞 수정:OAuth authorize/userinfo 先校验 token 黑名单 (F-56/56G) (025974f194)
- 🐞 수정:手工迁移执行器改用共享 SQL 分割器与事务化执行（DB-04/05/06） (476da42973)
- 🐞 수정:收紧 OAuth/MCP/LLM 转发面的管理员与身份归属校验(F-55/F-56/F-101/F-102) (e7ba41ad70)
- 🐞 수정:XUI-016/019/021 退款金额归一、注销闸门复位、分销字段映射 (7708c2c548)
- 🔧 기타:去掉 test_api_v1 夹具重复导入(ruff F811) (26a8a6afc6)
- 🔧 기타:登账(数字对账): README 正文 testFiles 4367→4373(本轮新增 6 个测试文件) (2d22798621)
- 🐞 수정:学习计划完成率按整数汇总，修正 int8 字符串拼接导致的 442%(F-699) (b1d34a9341)
- 🐞 수정:资金链路 P1 第二批 B 组(F-135/136/167/228) (edf15947cd)
- 🔧 기타:登账(缺陷普查批次): mcp_server 工具族+语音/媒体/发布 9 条 P1 收口(AIS-021/050/051/073/080/081/092/096/097) (f3e69fad00)
- 🐞 수정:审计证据导出改 ASC 键集游标并生成链锚 (F-646/645G) (841c74661d)
- 🐞 수정:访问明细响应白名单投影，封死跨用户 PII 泄漏 (F-592/591G) (1937e6d8f1)
- 🐞 수정:schedule 写端点补管理员闸 (F-636/635G) (99aa6d9e21)
- 🐞 수정:P1 连接关闭/续跑并发/索引提交语义(AIS-021/022/027) (e49b792b1f)
- 🔧 기타:修(AIS-021/073/096/097): 发布域连接泄漏与账号越权 + 媒体 sidecar/在途强失败 (56dbb657ab)
- 🐞 수정:P1 流式终态/原生计量/取消收敛/压缩引用/媒体清扫(AIS-001/002/005/009/058/065/096/097/111/112) (cdc5a9547c)
- 🐞 수정:Batch 单对象端点补 API Key 归属校验 (F-85/85G) (492b3b3287)
- 🔧 기타:修(AIS-050/051/080/081/092): mcp_server 工具族路径/SSRF/命令注入收口 + 付费 TTS 鉴权 (1417646ce1)
- 🐞 수정:XUI-003 会员页对 /vip/my 空记录落空态并消除 TS2345 (03eaf32af9)
- 📚 문서:修正 code 标签内测试文件数 4367→4372 (0a8fe453f4)
- 🐞 수정:OAuth 密钥管理端点改为管理员闸 (F-55/55G) (7a320a0e06)
- 📚 문서:测试文件计数 4367 → 4372（合入 db-p1 新增的 5 个测试文件） (1513c11c13)
- 📚 문서:同步新增 5 个夹具后的测试文件数 4367→4372 (826dc1c3a9)
- 🐞 수정:scoped-guard 归属判据绑定主体参数并拒绝 or 绕过 (F-216/216G) (9a88a3c6e0)
- 🐞 수정:修正 gate-failure-kind C7/F5 判据锚点(存量红真修,不删断言) (6040fed71a)
- 🔧 기타:登账(msg-p1): 消息/推送/社交/文件上传 13 条 P1 已修并勾选 (1fe3efb480)
- 🐞 수정:用户中心显式投影剔除 2FA/密码类敏感列 (F-245/245G) (ec12ec1c62)
- 🔧 기타:USDT 到账夹具的有效期改为相对当前时刻，消除固定 T0 过期时间炸弹 (5cd4b33ebd)
- 🐞 수정:资金链路 P1 第二批 A 组(F-229/230/220/62/63) (bba5be1be0)
- 🐞 수정:消息/聊天 6 条 P1 根因修复（F-54/109/112/154/170/192） (12be6889fa)
- 📚 문서:P0 落成后对齐测试文件计数 4378 (d728c5a24f)
- 🐞 수정:考勤墙钟固定 Asia/Shanghai，修复 UTC 主机迟到误判(F-263) (688ba35066)
- 🐞 수정:阻断第三方账号绑定/改绑内置管理员接管路径 (F-126/126G) (7f0441c2dc)
- 📚 문서:正文 testFiles 4367→4368(W-01 新增 1 个测试文件) (eefd9ee63d)
- 🐞 수정:上传/推送/社交评论 7 条 P1 根因修复（F-28/69/680/155/332/479/698） (f4651bf29d)
- 🐞 수정:考试记录归属校验与判分去重，证书详情补属主闸(F-168/F-169/F-172) (f7450e25a3)
- 🐞 수정:禁止管理员重置系统内置管理员密码 (F-125/125G) (f2e2e8bd2b)
- 🐞 수정:XUI-014 提现余额按分转元展示、提交金额按元转分 (cfa074991d)
- 🐞 수정:付费课程以已支付订单为准，封死零支付解锁(F-153) (10d0de57c8)
- 🐞 수정:倒计时改按截止时间戳重算(后台节流/锁屏不再无声延长考试) (7974a14834)
- 🐞 수정:XUI-009/010/013 充值签名与 orderType、Easing.sin、Clipboard 默认导出 (eb3bff76f7)
- 📚 문서:正文两处工程守门数同步为 352(生成块已同步,正文补漏) (88053d3c24)
- 🐞 수정:子代理回放终态纳入 stub，复用 backgroundTask 状态词 (1d27adcba4)
- 🐞 수정:时间线计数补 stub 键；空状态模板开关回落到 onTemplateSelect 契约 (0a1db8503c)
- 📚 문서:同步守门门数 351→352(新增全量腿 IGf) (7972a763e4)
- 🐞 수정:重派生 rn-shell 声明，补上 VipTraderScreen 契约 (f5c6cb0783)
- 🐞 수정:evil merge 按逐父交集判 + 判据库执行器入根护栏 + 全量腿注册 IGf (8182bd1234)
- 🐞 수정:清掉误回盘的死 list-view 并收敛重复 configure；重跑 ui-routes 派生钉 (5ee8200673)
- 🐞 수정:XUI-007/008 支付订单详情拆包络且 DEV mock 不再直通成功 (c024572376)
- 🐞 수정:XUI-005/006 登录态改用 getUserInfo 并让清缓存保留登出标记 (bf3d1e2bda)
- 🐞 수정:共享第三方平台类型补齐 linuxdo（与 web 端既有能力对齐） (fdb05b274f)
- 🔧 기타:会话导入用例按 noUncheckedIndexedAccess 收窄空值 (5876707f98)
- 🔧 기타:补 F-075/103 夹具(unjudged 出口 fail-closed、NDJSON 中文跨 chunk) (37bc6d6f19)
- 🐞 수정:接上超级智能体泵启停导入 + 修正快照持久/恢复类型窄化 (039bc57a68)
- 🐞 수정:required 聚合器 needs 补齐两个 preflight 并逐项断言结果 (90fed2988c)
- 🐞 수정:P1 代码工具/命令策略/取消/付费TTS/索引主体收口(AIS-080/081/086/092/100/106/107/116) (8adaf979c3)
- 🔧 기타:补 F-002/006/007/008 双断言夹具(旧红/新绿:exitCode、键名脱敏、argv 脱敏) (6c33f037af)
- 🐞 수정:XUI-004 未登录分支补齐 Privacy/Agreement/ChangePhone/ChangePwd 四路由 (0ba309d2f7)
- 🐞 수정:P1 资金组一批 F-09/10/16/17/32/33 堵资金双出与回调丢单 (8ee5b47dcf)
- 🐞 수정:跳门证据绑定失败门集合(T1 之外一律 deny) (acc0f53f69)
- 🔧 기타:补 F-073/074/095/069 双断言夹具(旧绕过路径被拒 + 正常路径照放行) (400c6dfc7d)
- 📚 문서:登记 T1 在纯净 origin/main(00fa9e977f) 即红的基线存量 18 条 (bbcd663951)
- 🐞 수정:补齐进程树回收、POSIX 沙箱超时杀组、出口 fail-closed、LSP 回收、记忆原子写去重、钩子中央派发与子代理基线 (F-003/004/075/087/088/097/098/103; F-080 已在上一笔) (e7c9754681)
- 🐞 수정:XUI-003 会员 /vip/my 拆 {vip} 包络并归一 user_vips 行 (1576fe79aa)
- 🐞 수정:修复异常退出码、审计/argv 脱敏、状态文件权限、WS 过载、签到回跳与深链/托盘授权 (F-002/005/006/007/008/046/047/062/100; 含 F-080 原子落盘) (b107b1cd3e)
- 🐞 수정:窗口 -1(不限)不再被 Math.max 归一为 0，订阅配额正确落 -1(SDB-04) (3ce91de9d1)
- 🐞 수정:修复插件名/落点逃逸、沙箱白名单与 ACL 越界、回收站与隔离区恢复越界 (F-069/070/073/074/101/102/095/053/099) (c6e262ba6e)
- 🐞 수정:F-205 关注幂等语义修正,堵住重复刷积分 (99a7e1e7f2)
- 🐞 수정:push 门缓存指纹纳入全仓脏状态(含 scripts/ 与根配置),超限 fail-closed (1adb9a7bbc)
- 🐞 수정:P1 越权面收口(会话/检索/图谱/Hook/预算/媒体/发布/recap) (2ec168289f)
- 🐞 수정:XUI-002 订单详情拆 {order} 包络并修正 RN 字段映射 (5d668e9d2a)
- 🐞 수정:Crew 计费改为按单次 runId 幂等并结算失败/取消分支的实耗(SDB-30) (3eb4787c1d)
- 🔧 기타:登账(缺陷普查批次23/23): services/DB 56 条(含 5 条按复核修正晚级)；索引同步 (00fa9e977f)
- 📚 문서:对齐 XUI-001 新增测试文件后的文档计数 (edd666cd1b)
- 🐞 수정:鉴权 join users.status 并补注销吊销 developer_api_keys/分享 token(SDB-29) (2e172868ad)
- 🐞 수정:worktree 面跳过依赖/产物目录,非普通文件不判取不到 (e272f4246e)
- 🔧 기타:登账(缺陷普查批次22/23): API 收尾 F-721~F-728 共 8 条 (f314bb7067)
- 🔧 기타:登账(缺陷普查批次21/23): API F-661~F-720 共 60 条 (679c7fd871)
- 🐞 수정:修 miniapp 历史重试假重载并在 staged 面正取候选清单 (fa06091fec)
- 🐞 수정:F-166 课程/视频管理写端点升级为 requireAdmin (5f0adc5e76)
- 🐞 수정:USDT 到账改为唯一金额尾差+精确匹配+未占用 txHash,并翻页覆盖下单至今(SDB-27/28) (23edfeecbf)
- 📚 문서:记重放前置依赖表(291 只报数不拦提交/typecheck 判据/生成物 pin/README 写入口) 与 push 档独占门 193 的错觉教训 (0d07c3edae)
- 🐞 수정:XUI-001 订单状态视图补全 7 值并对未知状态兜底 (81c4ff1ffe)
- 🐞 수정:F-133 personality 读写加属主/管理员闸门 (84d4c21002)
- 🐞 수정:共享屏 diff 取档的 execFileSync 补显式 stdio 三槽, 过门 193 的 stdio 显式属性名判据 (a9e2ec90b7)
- 🐞 수정:补齐 Web 订单状态 refunding/completed/failed 三值文案 (67dc23846b)
- 🔧 기타:登账(缺陷普查批次19/23): API F-541~F-600 共 59 条(F-580 与 DBG-4 重复) (59f8e3168c)
- 🔧 기타:登账(缺陷普查批次18/23): API F-481~F-540 共 60 条 (1840336239)
- 🐞 수정:F-61 分销提现改走 applyWithdrawal 原子冻结 (14d4b67ffa)
- 📚 문서:registry 保持登记现值并列入保留清单(不改承载面),补正门读数与 21 行口径 (fc4bc77051)
- 🐞 수정:删除 VipScreen 未被消费的必填端口 onNavigate(门290 两处空端口确证为空) (e85a3b0753)
- 🔧 기타:登账(缺陷普查批次17/23): API F-421~F-480 共 60 条 (059017cad3)
- 🐞 수정:余额入账改为单条原子自增/行锁读，消除 USDT 充值与应用订阅并发丢账(DB-03) (8b47174190)
- 📚 문서:记安装完整性检查的判据、两条读数(exit 0 / 缺 node_modules exit 2)与不扩边界 (d46c983294)
- 🐞 수정:修复 CLI/桌面 3 条 P0(run_tests EINVAL、store 越权、钩子自证绕过) (35bc40522f)
- 📚 문서:22 条缺 RN 行逐条核验;login/mcp-store 改指壳、registry 改判 portal、19 行补渲染点证据 (2190b793a6)
- 🐞 수정:全量腿共用 gate-prep 取材面 + 按门看门狗预算(30a 不再被 300s 恒杀) (5e1997f6ae)
- 🔧 기타:登账(缺陷普查批次16/23): API F-361~F-420 共 60 条 (24379a5a0d)
- 🐞 수정:F-53 /auth/profile 禁止仅凭会话改绑邮箱 (adab73935a)
- 🐞 수정:staged typecheck 加安装完整性前置检查, 缺 node_modules 判 exit 2 (2c0ac6e502)
- 📚 문서:staged typecheck 缺依赖产物改为 exit 2 已落地, 记三组脱链复验与残存缺口 (4cef479d0c)
- 📚 문서:补记门读数前提与并发假红重试留痕(30a 一次,附现场物证) (c0db81dc03)
- 🐞 수정:staged typecheck 依赖产物缺失判 exit 2, 不再把取不到记成改动文件的假红 (7f4f5b01c9)
- 📚 문서:cherry-pick 生成物通则、staged typecheck 缺 dist 票、icp-record 第 4 条口径 (ab032a7368)
- 🔧 기타:登账(缺陷普查批次15/23): API F-301~F-360 共 60 条 (f22d7a5719)
- 📚 문서:icp-record onQuery 改为行模型 href,撤销丢外链让步 (c720fe9d37)
- 🐞 수정:自动续费回调的建单/完成并入外层事务，消除半提交与重复发权益(DB-02) (55efcffe13)
- 🐞 수정:合一 /member/favorites 复用 /favorites,门 301 按票作废落档 (cbb5759b19)
- 🐞 수정:封死 AIS-031/AIS-052 任意 argv 越权面(P0) (0d542813ed)
- 🔧 기타:登账(缺陷普查批次14/23): API F-241~F-300 共 60 条 (16df61ba1e)
- 🐞 수정:手工迁移账本改用 drizzle sha256 + journal.when 且同事务写入(DB-01) (4ff6d1ff57)
- 🔧 기타:登账(缺陷普查批次13/23): API F-181~F-240 共 60 条 (b6b1ebe470)
- 🚀 기능/개선:icp-record 行模型加可选 href,备案链接两端渲染 (a611c577d1)
- 🔧 기타:登账(缺陷普查批次12/23): API F-121~F-180 共 60 条 (c182c809fb)
- 🔧 기타:登账(缺陷普查批次11/23): API F-61~F-120 共 60 条；行题面加来源前缀消除跨源同号误判 (65e022cb30)
- 📚 문서:colorScheme 全量改后读数与逐处改前改后值 (7a146402b1)
- 🐞 수정:colorScheme 跟随 resolvedTheme,消除暗色下亮色页 (52ff17b485)
- 🐞 수정:F-01 public-socket 运维端点补 await 管理员判定 (edbdc7126d)
- 📚 문서:62→71 定性为读数口径修正;分列 9 条误判与 22 条缺 RN 行;colorScheme 扫描;icp-record 判定/修后渲染与内容待定草案;同步 README 生成块 (55de37b336)
- 🔧 기타:登账(缺陷普查批次10/23): API F-01~F-60 共 60 条 (82c138ff8d)
- 🚀 기능/개선:新增 web 唯一键 settings.icpRecordFooter,供 icp-record 接屏草案的 footer 映射(内容待定) (81306cba0a)
- 🔧 기타:登账(缺陷普查批次9/23): 跨端 UI 收尾 12 条 (f9aa837257)
- 🐞 수정:钱包提现页 colorScheme 跟随 resolvedTheme,修暗色用户看到亮色页的已上线退化;同步 ui-routes 输入指纹 (ab50d8d70b)
- 🔧 기타:登账(缺陷普查批次8/23): 跨端 UI XUI-001~XUI-060 共 60 条 (2405af4f0c)
- 🔧 기타:登账(缺陷普查批次7/23): AI 服务 AIS-061~AIS-118 共 58 条 (05559cc4d5)
- 🐞 수정:共享屏 icp-record 标签显式成对,修正 label1-label5 错位;公网安备号/备案时间保留,无 onCopy 时不渲染复制卡;同步重生成小程序离线语言包 (8947e198c8)
- 🔧 기타:登账(缺陷普查批次6/23): AI 服务 AIS-001~AIS-060 共 60 条 (1332600c7a)
- 🔧 기타:登账(缺陷普查批次5/23): DB 45 条(DB-40 与 DBG-3 重复不入册) (9453ad492c)
- 🐞 수정:宿主改读跨端登记表,读不到即未判定(exit 2) (75c8e01d93)
- 🔧 기타:登账(缺陷普查批次4/23): CLI/桌面收尾 16 条 (d64ddfec88)
- 🔧 기타:登账(缺陷普查批次3/23): CLI/桌面 F-061~F-120 共 60 条 (963ee4ebf2)
- 🐞 수정:去重映射表 3 组重复并清 5 条失效映射;基线吸收 ModelList 平台专属 onContentSizeChange (0c74ece9f1)
- 🔧 기타:登账(缺陷普查批次2/23): CLI/桌面 F-001~F-060 共 60 条 (714866c37e)
- 🔧 기타:登账(缺陷普查批次1/23): DG/W 21 条入册并归档 8 份报告 (78d0ee9b5a)
- 🐞 수정:删除 06927f16fa 并集归并引入的重复 catBatch import,恢复门可解析与真实读数 (221c85c80a)
- 🚀 기능/개선:新增 web 接屏脚手架与登记表层别漂移 advisory 门 (a047c571ab)
- 🚀 기능/개선:新增跨端生产线总账与共享屏平台限制判据 (751f33ec8b)
- 📚 문서:记 cut9 两文件测试的 3 条存量红(与 main 同红,非本笔引入) (67721b7bcc)
- 🐞 수정:refs 面快进不算重指(避免 push 后 41 假红) + 票补 cut9 重提读数 (833071424e)
- ⚡ 성능:302p 漂移回归门提速 —— 全树 ls-tree 轮内快照 + 判据面收窄 (256be1a65c)
- 📚 문서:回填 cut9 四道存量红处置结论与 41 分支清点 (3785f8e299)
- 🐞 수정:explicitFull 只认 GITHUB_ACTIONS,避免宿主 CI=true 关掉 stock 降级 (78c3a05c47)
- 🐞 수정:两处哨兵身份判断去掉 message 文本匹配,行为等价 (7616c81f18)
- 🐞 수정:门57 锚点改指共享屏重构后的真实渲染宿主 (92a6e3ee6a)
- 🚀 기능/개선:门判据面 delta/stock + 存量红只报数(路线2) (d1c270d694)
- 📚 문서:登记 cut9 四道存量门红项(41/57/204/70b) + gate-302 门票落库 sha 89a5938f0c;README 生成块经 sync-readme-numbers --face=staged 重算 (d4e1621806)
- ⚡ 성능:T1 逐包并发 + dist 内容寻址,判据不降 (07f89f627c)
- 📚 문서:新增 302p 两处结构缺陷门票(登记盲区 + judgedGapWeb 方向混维) (89a5938f0c)
- 🔧 기타:302 基线定向刷新 judgedGapWeb 0->1 —— /sag2 如实登记缺屏 (1b984a2246)
- 🐞 수정:30a 结论缓存按判据输入面四指纹复用(修复 3b 有缺口时永不落缓存导致每次全量重算) (dfc2d369ab)
- 🚀 기능/개선:SAG2 词法多跳检索通道前后端落地（rea 取证 + 本仓自有实现） (c20e4a5797)
- 📚 문서:补充后台 worker 被杀的 fail-closed 语义(残留标记最多等 240s,否则立即回落真跑) (e1086e3467)
- 📚 문서:补齐推送路径实测墙钟(改造前 105.22s 中位 / 改造后 2.74s 中位 / 回落 115.57s 真跑 13 门证据) (e33313ad3c)
- 🐞 수정:CLI 根推导退一级修正(scripts/ 入口不能复用 scripts/lib/ 的 ../..) (d365b725b3)
- 🐞 수정:钥配置按 KeyPath 语义读取文件内容(不得把路径当密钥) (bab82b2299)
- 🚀 기능/개선:提交侧求值 + 推送侧凭据校验(13 门/文档数字/i18n 后台真跑, fail-closed 回落) (a78bee7f3d)
- 📚 문서:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (616fb59a5a)
- 📚 문서:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (aec3023ba2)
- 📚 문서:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (d400a0e35b)

**2026-11-07**
- 🐞 수정:签到按钮同 tick 互斥与失败复位(票 F),并发两次只发一次请求 (125d3b1f3f)
- 🐞 수정:签到助手回屏只刷新一次(票 D),复用 screen-reappear-adapter (29085fdd48)
- 🐞 수정:web checkin 改名 checkinAssistant,与 checkIn 区分 (4623179dfc)
- 🐞 수정:重发倒计时秒数上屏,补全 5 locale 占位符并清掉全量静默丢参 (ef4478996d)
- 🐞 수정:签到助手写操作加同 tick 互斥与 finally 复位,消除连点重复签到/重复启停 (077ee973a8)
- 🚀 기능/개선:验证码复制按钮改为右侧细描边胶囊并上线落地页 (578c4caf4e)
- 🚀 기능/개선:门结果缓存 + 后台预跑(新增 gate-cache/gate-worker/夹具/注册表) (a49fd06f05)
- 🔧 기타:D15 对照的 git show 显式接管 stdio(门193) (2ae1a6f90f)
- 📚 문서:push 面现算对齐 testFiles 4359→4363 与 apiRoutes 4722→4725 (4e82155935)
- 🔧 기타:收编守护落档产出(3 件,凭落点账本) (98b102011c)
- 📚 문서:对齐 push 面 apiRoutes 散文 4722→4725(README.en) (2ff1ed9a34)
- 📚 문서:校正合并后 apiRoutes 散文数字 4722→4725(官方 scrub 重算) (d62645a507)
- 📚 문서:归档 2026-11 票与事故记录 (2616002dbb)
- 🚀 기능/개선:邮箱验证码邮件增加一键复制按钮与站点落地页 (aea6081e61)
- 📚 문서:合并后 push 面现算对齐 testFiles 4349→4353(13 处散文) (d3fed962d3)
- 📚 문서:README.en 口径行 workflows 数对齐现算 56 (c2b71ce79e)
- 🔧 기타:收编停留≥3分钟的未提交改动 (f7141dee38)
- 🐞 수정:修 main 既有 T1 红 —— 超工快照类型面收口(来源 88e2e0b578,该修复此前只在本地 main 未推) (0bcf621eda)
- 🔧 기타:收敛推送落地后清回清单腐烂正确终态 (8329cc7ee7)
- 🔧 기타:33 条追认行按独立追认钥重签 (3b8531d83d)
- 📚 문서:口径自述行 testFiles 对齐现算 4352 (46ad973c01)
- 📚 문서:收敛落地后按门173 push 面现算值对齐 trackedFiles (d59b265444)
- 📚 문서:数字对齐现算值(合入 codebase-index 后活性区+口径自述行) (fa9cbdfcb2)
- 📚 문서:注释对齐唯一写入口(不再指向 gen-doc-numbers --markdown) (cceabb5246)
- 📚 문서:按门173 push 面现算值对齐活性区数字与生成块 (4bff615e76)
- 🐞 수정:陈旧 dist 前置改逐产物判据并复核重建产物 (89ddd4c08b)
- 📚 문서:数字对齐现算值(活性区存量清偿,合并入队前基线校正) (9b719475b7)
- 🐞 수정:README 生成块收口为唯一写入口 + 写盘 CAS 并发判定 (23f2dddbc0)
- 🔧 기타:README 生成块随 RP-42 刷新(3 个指标,HEAD 面重跑) (d93460fc66)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (13c9ab1bc8)
- 🚀 기능/개선:超工慢路径判定环落地(RP-42 结清)。shared slow-path:三值 verdict+noteSlowDecisions 注记随快照活+judgeRecorded(record 档只注记不开工/auto∧act∧非机器人走与人工同一条 acceptRecorded 语义、inferred 强度、判定 reason 不渗授权范围/人点名仍在建议之上/通道抛错=未判定积压原地可重试);ai-service POST /api/super-agent/slow-path/judge(批量≤20 恰等长 JSON 硬校验、逐条 requesters 不含承载层主体 403、形状不符 502 不记绿,身份只从 require_request_user_id);api createSlowJudgeCall 注入式适配器(动态 import 测试零 config 拉起);泵 slowJudge 阶段 env 门控 IHUI_SUPER_AGENT_SLOW_PATH 未开=零模型动作。行为对照 dsh-superagent 两级过滤第二级,自写实现。vitest 46+3 例/pytest 12 例/mypy strict 全过 (61ed8adf90)
- 📚 문서:结清 RP-42——慢路径判定环:shared slow-path 三值注记+judgeRecorded(auto∧act∧非bot 走 acceptRecorded 同一条语义、人点名仍在建议之上、通道抛错=未判定积压原地);ai-service POST /api/super-agent/slow-path/judge 批量恰等长 JSON 硬校验+主体资格 403;api 注入式适配器;泵 env 门控 IHUI_SUPER_AGENT_SLOW_PATH。46+12+12 例全绿+mypy strict (668e95e5e4)
- 🐞 수정:账本族残渣闸补 root 注入 —— 治 T5/T26 稳定红 (b7a5beae9f)
- 🐞 수정:清偿迁移链孤儿与 B5 类型畸形,重生成 miniapp-taro ui-routes 钉 (be99b07cfe)
- 🐞 수정:派生腿整族改 spawn+await,并给长腿装 30s 周期心跳 —— 治 A11 轮内停摆的根因 (b7047ecda5)
- 📚 문서:用法注释与默认面同步(人读表=索引面) (8bb6257091)
- 📚 문서:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (9241a26d3b)
- 🐞 수정:取数面收敛为唯一权威面(写手默认=索引面),并重封 root-guard 清单 (05242dae38)
- 🚀 기능/개선:超级智能体存算分离落地（RP-41 结清）。host snapshot/restore：版本/形状/归属三重 fail-closed、重放触发幂等、pendingStart 未派队列随账本活、按主体切片计数分账；api 泵每轮去抖落 user_preferences super_agent 组（同 permission 套路零迁移零新路由）、启动先恢复再开节拍；保留账号 IHUI_SUPER_AGENT_STATE_ACCOUNT 未供=unconfigured 如实降级、写失败=degraded 点名（§0.3 不冒充）。行为对照 dsh-superagent 状态持久化+重启恢复设计。shared 38 例+api 9 例全绿。README 功能面债:该文件正被别席大改(索引面 18k/37k 行),持久腿说明待其落地后同批补登 (b9b9181d60)
- 📚 문서:结清 RP-41——超工账本入库:复用 user_preferences super_agent 组(同 permission 套路,零迁移零新路由);host snapshot/restore 版本与形状 fail-closed、重放触发幂等、pendingStart 随账本活;泵每轮去抖落库,启动先恢复;保留账号 IHUI_SUPER_AGENT_STATE_ACCOUNT 未供=如实 unconfigured。shared 38 例+api 9 例全绿 (4602c57e1d)
- 🐞 수정:A1「新增行」在合并态对全部父提交求并集排除(单亲逐字节不变) (e26e18f69f)
- 🐞 수정:长腿改异步 + 心跳点双侧齐平 —— 治 A9 载体分叉与 A11 轮内停摆;A6 分代 + 装车锁认得新形态 (d0028c046f)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c2d342eb67)
- 🔧 기타:活性区数字随仓态清账(apiRoutes 4719→4721,11 行)+ 重跑生成块 (06a974db27)
- ⚡ 성능:只 blame 未勾选行,把取票口从 >300s 拉回 16s(治 A3 恒未判定 + 派发腿零派发) (44443b7661)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4abe3a269c)
- 🔧 기타:补齐 README 活性区 27 处旧数(DN2 head 面) (46a27cb5a5)
- 📚 문서:按 gen-doc-numbers 现算值刷新生成块 (73b0fdff97)
- 🐞 수정:收窄 file-tree-memo 的 unread 入参到 unjudged 分支 reason (2587b33380)
- 🔧 기타:README 散文 28 处旧数对齐 head 面现算值(DN2) (f5a4ce8f5b)
- 🚀 기능/개선:超级智能体装上 Watchdog 泵与租约心跳。事件源端口+巡检泵（回收即重派不隔拍、单端口故障隔离计数）、report/heartbeat 双通道续租、策略档 workerLeaseMs 默认关保持既有行为；派发经单一出口下传隔离身份与归属，泵循环 env 门控零定时器噪音。行为对照 DeepSeek dsh-superagent（MIT）设计，自写实现并超越（登录主体隔离槽位/租约记账）。shared 32 例+api 5 例全绿三遍稳定。README 功能表债:本票 README 行因 b96828411f 回归远端旧版失去锚点,未随本提交落地,待 README 功能面恢复后由后手同型补登 (61ac4819a2)
- 🔧 기타:重跑 README 生成块(3 个数随仓态漂移) (9118d99675)
- 🐞 수정:两笔失效门的治(无 TS 输入面档 + 逐腿心跳),并把 README 回归远端版本 (b96828411f)
- 📚 문서:超级智能体缺口四票入账（事件源适配器/工单入库/慢路径/工作台面板） (865ca1ea07)
- 🔧 기타:根护栏清单按收敛后 HEAD 现面重封 (f51957a86a)
- 🔧 기타:XSS 回归测试重钉到受控子集渲染器四道安全闸 (f2bf0b8c2b)
- 🔧 기타:按生成器刷新 tool_name_sets.json (f935d7646b)
- 🐞 수정:心跳从「10 个段界」加密到「逐腿 24 个点」,把 A11 的假红收敛成真信号 (30f1f8f360)
- 🐞 수정:密钥映射按服务面判定,12 枚媒体键不再读成 ai-service 缺行 (1fad91bb0e)
- 🔧 기타:清偿 README 活性区存量数字债(296 行),恢复「文档数字门」的可推性 (5a6051794e)
- 🔧 기타:重跑 README 生成块(6 个数随仓态漂移) (f9787f1d6b)
- 🐞 수정:typecheck 门在「改动不含 TS 输入」时给可自证结论,并把等锁空烧变成可读诊断 (56051474b4)
- 🔧 기타:补 22 文件溯源水印 + 6 文件版权头(HEAD 面欠账,由 47p inject 生成,非内容改动;标点改动已剔除) (f7969f149f)
- 🐞 수정:blame 档位没量到时不挑整文件也不挑行 (95797ca265)
- 🐞 수정:宿主工单账写入会话库,重启后按同一 trigger 不再派工 (5087422beb)
- 🐞 수정:按提交读 notes 时把引用不在和没记过分开 (991bac4981)
- 🔧 기타:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (b400fe5189)
- 🚀 기능/개선:作业嵌套失败不按错误码脱离父作业 (e3fc2b1ac4)
- 🐞 수정:元运维巡检改 spawn+Promise,长腿不再冻结轮级锁心跳 (968f22d4f7)
- 🐞 수정:提示词只按宿主编号另存，不写进 git notes (78046b6c54)
- 🚀 기능/개선:接线 6 个未派发钩子并补齐 5 个控制帧(CLI / API / 引擎 / SDK) (d6d494fc42)
- 🚀 기능/개선:研究检索只按量到的并发和抓取名额发外呼 (24de8f5b14)
- 🐞 수정:检查点按去重键写入 git notes，缺引用不补空 ref (a4523173f8)
- 🐞 수정:重生成 tool_name_sets.json 补 sandbox_session（307p 转绿） (2a0a228342)
- 🚀 기능/개선:启动打点只认接口真正收下的名字 (312392020c)
- 🐞 수정:量到工具面之外的改动才记 known_human (e09e49acf7)
- 🐞 수정:写盘前先记 before_edit，写失败不补 after_edit (c22aa69118)
- 🐞 수정:收窄 FileTreeVerdict 的 unjudged 原因集 —— 修复冷构建 tsc 失败(主线既有类型缺陷,纯类型不动运行语义) (eda8919a31)
- 🚀 기능/개선:流结束时暂停或暂停态没量到就不自动补发 (848ec43bca)
- 🔧 기타:tool-name 集合补齐 codebase_index —— 新增 /tools/codebase-index 路由后按生成器同步 (80e67c7f8b)
- 🚀 기능/개선:代码库索引能力增强 —— 符号目录 + 新鲜度三态 + 本地检索腿优先读目录 (6eb4b244d5)
- 🐞 수정:段界检查点顺带续心跳,把 block-enter→post-feedback-loop 的 22 条腿切成 4 段 (7978ca2773)
- 🐞 수정:编辑检查点按去重键追加，缺测字段不填默认值 (8ff125ddc5)
- 🚀 기능/개선:网页构建模式把多步任务派给既有同进程 worker (1dee4efc82)
- 📚 문서:对外宣称的 CI workflows 数同步为 55 (d3b5f3219c)
- 🚀 기능/개선:新增能力评测基线并接入 CI 回归门 (26ad3cf05a)
- ⚡ 성능:削减单文件 lint 固定开销并给 lint-staged 加缓存 (728fdcccf6)
- 📚 문서:铁律点名 e2e skip 由门 311 判 + 同题跨号更正 300→311 + root-guard 重封 (1291b6989a)
- 🚀 기능/개선:agent_loop 高危判定接入动态注册表 write tier(最小接线) (ff8eb7bd55)
- 🚀 기능/개선:受信动态注册表,收紧目录/商店安装入口 (d85803931a)
- 🐞 수정:续跑处置参数改用 Mapping，兼容 Literal 声明且不丢失只读语义 (ffc85720eb)
- 🐞 수정:T1 超时预算畸形改硬失败 + 棘轮改跨提交史比对 (3444b0ae67)
- 🔧 기타:真子进程硬中断用例证明跨进程续跑四分档 (792bf31f41)
- 🔧 기타:三处让号与合成落本地(main 未推侧) (b7ec515d92)
- 🐞 수정:T1 预算棘轮补 margin 证据链,自包含复核判据入库 (6013b5e151)
- 🚀 기능/개선:续跑需要确认时返回 409 + 处置清单（两条 resume 出口同形） (6f1836bd6f)
- 🚀 기능/개선:续跑分支按单 tool_call 判定重放/续跑/拦确认 (121af18d60)
- 🐞 수정:DBG-83 run-cdn.bat node 发现机制替代死盘符硬编码 (186f7ab616)
- 🐞 수정:DBG-33/34/35/36/37 相对时间与日期随应用语言 + 令牌轮换写入顺序对齐 (03fffbe9ce)
- 🐞 수정:T1 改并发4+LPT 派发(300s 让位于实测基线),门251 修 staged 参数序+批量取面并补夹具,worktree 自有 node_modules (a8ff738ce2)
- 🐞 수정:DBG-25 canAccess FAMILY 分支真隔离判定 + DBG-23/28 判定留档 (7305671657)
- 📚 문서:消息 parts 数据模型设计稿(1106) (de1baf69d9)
- 🐞 수정:DBG-61/62/67/68/72 会话存储访问级+侧栏通道+缓存键+弹层定时器+API基址白名单 (4a4fdb12a6)
- 🚀 기능/개선:工具轮写前 checkpoint + attempting/settle 回执（fail-closed） (07e7baaa9d)
- 🐞 수정:DBG-73 数据源指向原生端口 + DBG-74 级联抑制恒不命中 (a345c6bf08)
- 🐞 수정:DBG-64 dom action 失败补 .catch 避免 background 等满超时 (b4a4484b01)
- 🐞 수정:DBG-71 移除未使用的 scripting 权限 (c886971722)
- 🐞 수정:DBG-98 私有索引提交脚本共享临时文件路径并发碰撞 (48049e6ced)
- 🐞 수정:收口 DBG-38 P0 RCE 面 + DBG-75 P1 告警盲区 + DBG-80 P1 部署失效 (4a17d64779)
- 📚 문서:登记缺陷深挖批次 DBG-1..99（2026-11-07 两轮并行代理审查） (19ccd61bdd)
- 🔧 기타:接管 memory/soul.ts（原工作树未提交，静默 4h34m，来源：工作树；DBG-44 画像落盘改原子写；无独占测试接入，无覆盖变更） (021f349f31)
- 🔧 기타:接管 runs/manifest.ts（原工作树未提交，静默 4h31m，来源：工作树；DBG-42 manifest.json 改原子写） (e6fdea1dfb)
- 🔧 기타:补过期 running 自愈夹具(07:48 现场复盘) (5e258b5118)
- 🔧 기타:接管 doom-loop-detector.ts（原工作树未提交，静默 3h38m，来源：工作树；窗口参数透传 DoomLoopWindowOptions） (512513ffa4)
- 🔧 기타:接管 commands/repl.ts（原工作树未提交，静默 5h，来源：工作树；BUG-0015 formatContextStats 入参收敛为 role+content） (c7bdb83d57)
- 🐞 수정:running 状态校验 pid 存活与启动时刻,死 worker 判中止并留死因 (15fa0e297f)
- 🔧 기타:补 tools/index.ts 契约最小夹具：ToolResult.data 透传（src 已于 ff669e19e5 接管） (cedb5e221e)
- 🔧 기타:接管 util/spawn-isolated.ts（原工作树未提交，静默 4h31m，来源：工作树；附 plugin-git-url-shape 异步化适配） (46f2250611)
- 🔧 기타:接管 commands/session.ts + commands/hooks-auto.ts（原工作树未提交，静默 4h44m/3h09m，来源：工作树） (44ffbcbfea)
- 🐞 수정:微信支付未确认状态被当成功，直接给充值/VIP 额度（DBG-30 P0 资金安全） (42d0f4c3c8)
- 🔧 기타:接管 tools/index.ts（原工作树未提交，静默 2h55m，来源：工作树） (ff669e19e5)
- 🐞 수정:git 重建脚本写锁判据语义写反致有锁时仍继续删 .git（DBG-85） (17c39485b3)
- 🐞 수정:公告缓存与已读集合改原子写，并把 announcements 纳入写盘安全门射程（DBG-41） (de54122619)
- 📚 문서:64 条缺陷按 HEAD 实况判完 — 已修 60 / 仍开 2 / 未判定 1 / 部分修复 1 (c99f600be8)
- 🐞 수정:小程序 permission 按已有口径如实登记为缺口，消除端能力门假红（BUG-0028） (d673f0ddc3)
- 🔧 기타:接管 telemetry/index.ts（原工作树未提交，静默 2h42m，来源：工作树） (8f5b4e837c)
- 🐞 수정:git 命令加可取消异步版并根治并行测试冷启动竞态（BUG-0040/0037） (1f87eb0048)
- 🐞 수정:67 例确定性失败按四个根因归并修复（BUG-0035） (cf391b0855)
- 🐞 수정:命令白名单剥 Windows 可执行后缀，运行测试超时竞态根治（BUG-0032/0033/0034） (e9c3c785ed)
- 🔧 기타:0015 接手 provider-request-admission.test.ts（原在飞无提交，来源：工作树） (c40e470228)
- 🔧 기타:0015 接手 hooks-trust-atomic-write.test.ts（原在飞无提交，来源：工作树） (7d9a1bede9)
- 🔧 기타:0015 接手 inflight-ledger.test.ts（原在飞无提交，来源：工作树） (1add3ed5dd)
- 🔧 기타:0015 接手 plan-machine-integration.test.ts（原在飞无提交，来源：工作树） (1c88e2bf4d)
- 🔧 기타:0015 接手 mermaid-grammar.test.ts（原在飞无提交，来源：工作树） (c00b60be08)
- 🔧 기타:0015 接手 checkpoints-corrupt-manifest.test.ts（原在飞无提交，来源：工作树） (d6a70cb68c)
- 🔧 기타:0015 接手 crash-handler-boundary.test.ts（原在飞无提交，来源：工作树） (5e4261412f)
- 📚 문서:标明 tsconfig.tests.batch.json 仅用于单批读数可复现(BUG-0015) (4f185fae52)
- 🔧 기타:0015 B1 —— 7 文件 B 组 15 条真修,批次配置钉 true(BUG-0015) (06513dcfa3)
- 🔧 기타:0015 A2 —— 13 个 tests 文件的索引访问在 noUncheckedIndexedAccess 下真修到 0(BUG-0015) (1824bedc7a)
- 🔧 기타:保留 BUG-0015 单批读数配置 tsconfig.tests.batch.json(仅批次复现,非全仓配置) (ff7eaebb9d)
- 🐞 수정:BUG-NEW-02 新增 skills 同步出海口静态门,并删掉 imgchr 自相矛盾的 disable_warnings (ebf856d8f9)
- 🔧 기타:0015 A1 —— 15 个 tests 夹具索引访问在 noUncheckedIndexedAccess 下真修到 0(BUG-0015) (9276758f22)
- 🐞 수정:提现状态五语言包补齐 processing(web 管理端映射同步) (7b95c067b2)
- 🔧 기타:0042 未知键断言改经 Record 视图取值(BUG-0015 顺手) (d053fc1031)
- 🔧 기타:摘取 ff2e942864 仍有效的三条 hunk(BUG-0015) (2d0b61ad1b)
- 🐞 수정:门基线与镜像 tag 变量化、pnpm action pin SHA（BUG-0056/0058/0061） (1ddd4a6bb3)
- 🐞 수정:文件写盘安全门覆盖面补 sessions/checkpoints/subagents 状态面(BUG-0044) (879c5cf418)
- 🐞 수정:全局配置层运行时类型校验,非法值回落默认并逐键点名(BUG-0042) (a2b3b7f60b)
- 🔧 기타:修 BUG-0030 红臂的豁免剥离写法 (75890067f5)
- 🐞 수정:10 处字符图标换真图标(BUG-0030) (609787c0f2)
- 🚀 기능/개선:新增 dispatchDialog.dagRemoveNode / dagRemoveEdge(5 语言) (ea038ceb6c)
- 🐞 수정:invocationId 改确定性键 agent:{session}:{tool_call}:{attempt} (cbe74d6801)
- 🚀 기능/개선:checkpoint 管理器新增工具回执 CAS 写入（耐久后端才算落地） (2e442cb9a2)
- 🐞 수정:错误/空态补回页头返回入口,修复 GA7 既有红(BUG-NEW-01) (00367fddf9)
- 🚀 기능/개선:新增模型化 Fast Apply 编辑服务(三档锚定 + 写后校验回滚 + 一次纠错) (3e7de76e27)
- 🚀 기능/개선:跨进程续跑纯判据模块（回执优先于历史，不确定即拦确认） (ca6fe5a465)
- 🐞 수정:BUG-0029 7 处原生 title 当 Tooltip 换成真组件——5 个站点改 Tooltip/TruncatedText；配 24 项夹具（绿臂真实文件 0 处、红臂旧写法 7 处必红） (a22549c134)
- 🚀 기능/개선:B72 学生考勤补自签退入口与业务日修正 (48816d450d)
- 🐞 수정:BUG-0038 跨端锁目标跟真实文件——web voice-input 改 components/chat，Taro Avatar 走具名缺席豁免 (a2c709819c)
- 🐞 수정:BUG-0022 五端 SSE dispatch 覆盖收口（派生回调登记为非帧 + 基线现算 + 改前必红夹具） (b7264840df)
- 🚀 기능/개선:注册门 300 —— e2e skip 制度化 + 固定等待条件化 (03dce41561)
- 🚀 기능/개선:B72 学生考勤补自签退入口 (a3082dc7f8)
- 🔧 기타:SSE 事件成员数按现读抬到 37 并补 name 成员断言(BUG-0025) (6f7073dac8)
- 🔧 기타:判据镜像测试 12 例（合规/无理由/无编号/孤儿/过期/TIMING/自证等） (978c4af8d3)
- 🚀 기능/개선:新增守门 CLI（head/worktree/staged 三面 + --self-test 三态自证） (fbc5314849)
- 🚀 기능/개선:新增 e2e skip/固定等待判据纯函数库（skip 理由/编号、TIMING 注解、孤儿与过期登记） (2bf2381318)
- 📚 문서:新增 SKIP-WAIT-POLICY 制度正文（skip 登记 + 固定等待条件化） (c3cb576f25)
- 🐞 수정:清理 remote-icons 4 个零消费死键(BUG-0026) (ba9da25b6a)
- 🚀 기능/개선:B72 学生考勤签退文案五语同步 (347f5aeb31)
- 🔧 기타:ruff 23 条清零(21 条机械修复 + 1 条 F401)(BUG-0036) (8f841fdb7c)
- 🐞 수정:清理 4 个脚本的本机硬编码安装路径(BUG-0055) (0ca198e5e1)
- 🔧 기타:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (0d28aa5f2a)
- 🐞 수정:Defender 排除基址改由脚本位置推导(BUG-0054) (9025f48f74)
- 🐞 수정:recovery source 仓根改由脚本位置推导(BUG-0053) (49ea7c4133)
- 🚀 기능/개선:B72 学生考勤补齐自签退入口与签退时刻列 (32ad38645c)
- 🐞 수정:摘除 packages/app barrel 的死副本 NavBar 导出(BUG-0014) (3154d9567c)
- 🐞 수정:service-binary-paths 修复 PAUSED 分档不可达并打印失败用例名(BUG-0049) (b5ee950d59)
- 🐞 수정:disk-root-write 只读 gitdir 纳入收窄并补阳性对照(BUG-0045) (306728ef7c)
- 🚀 기능/개선:压缩保留锚点 —— 任务锚与 pinned 消息原文跨压缩保留 (12a6530e5a)
- 🐞 수정:retrieval-quality 现场用例对齐双路融合判据(BUG-0048) (65c6dec9db)
- 🐞 수정:model-capacity 自检样本对齐 6 档源码(BUG-0047) (3b6103645d)
- 🐞 수정:prod-checkout 门补 --self-test 并同步契约锁(BUG-0050) (3bfae56f87)
- 🔧 기타:登记缺陷审计残余五项合并票(BUG-0015/0042/0044/0058/0061) —— 只登记本轮实证仍开着的项 (f3f91d257f)
- 🐞 수정:承载面心跳改读锁文件 mtime,纠正 at= 当心跳的误判 (1cc3312fed)
- 🐞 수정:plan-id-pool 自检语料同步池上限 99 并补边界样本(BUG-0046) (7b9e012e64)
- 🔧 기타:每周审计 typecheck 去掉 echo 兜底转为阻断(BUG-0062) (b1b25bb813)
- 🔧 기타:构建/发布 workflow 补 timeout-minutes 与 release concurrency(BUG-0060) (588dbdefa4)
- 🐞 수정:根栈 web 服务补 healthcheck(BUG-0057) (cb5dc7669c)
- 🐞 수정:移除 SaaS Prometheus 未鉴权的 web.enable-lifecycle(BUG-0019) (1c768da043)
- 🐞 수정:修复 observability compose 端口行尾多余单引号致整栈无法启动(BUG-0011) (915a152c82)
- 🐞 수정:预测式编辑总开关接入编辑器链路(V3 #82) (b208c0f33b)
- 🐞 수정:预测式编辑总开关接入聊天输入区(V3 #82) (f3600c90e7)
- 🐞 수정:RP-74 第二批 —— 28 条未判定按「有戳位就接、无戳位就具名」收口 (b1d05ba2c7)
- 🔧 기타:为 overlay 水位重用例显式放宽超时预算(BUG-0024) (3a91faa1a6)
- 🐞 수정:语音完成回调收敛为 final 单通道避免重复上屏(BUG-0023) (d2bd277c7f)
- 🐞 수정:语音条播放收敛为单音频上下文并在切条/停播/卸载时销毁(BUG-0013) (5df7f06505)
- 🐞 수정:site-apk 增判 downloadUrl 指向自有站点腿,行在位不再当端内更新卡可用 (bddf6e5a59)
- 🐞 수정:渠道登记面改为实读 0364+schema+路由,store 维度已落地不再长期报缺 (c53ddd7dbe)
- 🔧 기타:补 GitHub App CI 三类事件忽略应答与零 IO 判据 (7fab2d4079)

**2026-11-06**
- 🐞 수정:收口 push 门 typecheck 基线 —— 补齐测得出的契约缺口 (16d9e7721a)
- 🔧 기타:根目录整洁守门 ALLOWED_HIDDEN_DIRS 补 .worktrees-archive(worktree 分支指针归档) (44365cbaf0)
- 🐞 수정:skill_list 注入登记与生产出口对齐,补齐 frontmatter 三字段契约 (01f9dc5075)
- 🔧 기타:补近同改名两条边界——新侧单独超限降级、文档无指纹只能删+增 (0c62ff76d6)
- 🐞 수정:修正 staged 面 git grep 选项顺序,让提交链能真正取到候选清单 (587d320556)
- 🐞 수정:签名路径判据只拒未成对单反斜杠,不再误杀正确的双写形态 (c29dc64295)
- 🔧 기타:补近同改名(basis=simhash)差集接线用例——删+增照旧、三字段形态、两条降级回执 (6b562e3a7c)
- 🚀 기능/개선:RP-74 派发面双链对等第三族 —— 键表现解析源码、99 面分批搬进常驻 tick、B 档就地具名豁免 (83fece8938)
- 🐞 수정:同步 Maximize2 生成图标(11h 图标替换的派生产物) (80d8b059dd)
- 🔧 기타:删除 miniapp dispatch 已实际注册帧的过期 missing 登记 (5382b67330)
- 🐞 수정:补对话流锚点、圆角档位与真重试,重跑 ui-routes 生成物 (f34b4130c3)
- 🐞 수정:补 read_tool_output 工具名映射与五语言 taskStatus 键 (8fcbd2354b)
- 🐞 수정:跨端共享屏与 RN 深色前景/圆角角色档收敛到基线内 (3828fdd41b)
- 🐞 수정:图标位 emoji 换 lucide 组件,同笔收敛品牌前景与圆角角色档 (dc4c471aa2)
- 📚 문서:同步生成块计数到当前 HEAD (d4094d7efd)
- 🐞 수정:门 260 升级 joi 17.13.9 修二次时间 DoS (26d5a88216)
- 🐞 수정:门 94 补录 4 个未登记 errorCode (571fde5fbd)
- 🐞 수정:修复 21:05 批改写引入的语法与默认值缺陷，保证空库可从零跑到 370 (523405c8c0)
- 🐞 수정:清 5 道门红点(173 文档数字 / 207 AGENTS 体积 / 265 ps1 BOM / 267 根护栏重封 / 47 溯源水印) (7c6aff5993)
- 🐞 수정:门 52 补 windowsHide 防桌面黑窗 (014e9d62fa)
- 📚 문서:登记 RP-71 覆盖面缺口专项票 —— 旁路落地器自愈补跑 2 台折算 / 9 处裸调 / 5 台零自愈 (3b01a9b24f)
- 🐞 수정:门 197 截断声明块补计数/总量兄弟键 (56da828293)
- 📚 문서:迁移 journal 重排的源码级裁决(记账只看 when 高水位,idx 不参与) (9fe3961b30)
- 📚 문서:登记脚本套件里两条常红(C5 与判据互不认账 / RP-71 收口后 H1 红) (fba4e4c148)
- 🐞 수정:门 263 清零 ruff 欠账 (365722208f)
- 📚 문서:登记病行补号的正确出口(单笔被三维守恒拒,须走让号重登两步) (e33049a38b)
- 📚 문서:RP-94 行按当次现读改写(旧值 359/175 已被并发推进甩开) (017207dc86)
- 🐞 수정:隔离必失败的 20261106150000 迁移件并补齐 369/370,解除生产部署阻塞 (93bdb57389)
- 🐞 수정:绝对 P95 维不再由单枚离群样本判死 —— 治 B37 那类"好构建被自动回滚" (4b11f02045)
- 📚 문서:登记 canary/迁移/守门四张真缺口(B37 取证链跑出来的,含本枚未做的那一半) (0da73fa5ac)
- 🐞 수정:取号令牌"族名不合法"这一型不再静默入库(实测病行已带空编号进 HEAD 12 天) (3d244eac7f)
- 📚 문서:登记 DB-DRIFT-2(孤儿列 3 + 孤儿表 9,只登记不动)\n\n只读比对 ihui_dev 与 368 份迁移件:3 个 publish_accounts 孤儿列的 pg_attribute.xmin\n是连续单语句事务(手工 ALTER / drizzle-kit push),TS schema 无定义且全仓无读取点;\n9 张孤儿表无 CREATE TABLE、无 schema 定义、无 SQL 引用。本笔只登记待办,\n明确「删列删表需单独授权」,不动任何列/表。\n\n本次提交用私有 GIT_INDEX_FILE 隔离,避免把同树其他会话的在飞改动混入本笔。 (2987fd8e01)
- 🐞 수정:修 post-merge-ledger-sync 判据取材恒 null —— 存量恒红 16/25 转 25/25 全绿 (43562bf24d)
- 🐞 수정:RP-71 收口 —— 形状锁去恒真、软退出码不回落、夹具真绿、测试面补齐 (cb70dc5af0)
- 🐞 수정:journal 改号避让 prod 的 369/15:00 + 删去重复索引迁移件 (213ce88545)
- 🐞 수정:补幂等迁移补建 3 个缺失索引 (45a29c5943)
- 🐞 수정:补幂等迁移修复 chat_conversations.share_token_expires_at 漂移 (e6ee921163)
- 📚 문서:登记 RP-73/74/75 三张收敛期实测票(RP-94 只读档跑出来的三格真缺口) (138ba9dcab)
- 📚 문서:自动同步缺口账本到现读口径(镜像 256 · 缺口 16) (322794332a)
- 🔧 기타:sync-readme-numbers 覆盖活性区散文(同门 173 判据)+ 双夹具;README 跟踪数 19496→19498 (8322e79960)
- 📚 문서:散文数字同步(apiRoutes 4699→4700,scrub --scope=active 共 11 行) (dcd9eaf10c)
- 📚 문서:用 sync-readme-numbers 刷新 README 生成块(apiRoutes 4700 / testFiles 4226 / trackedFiles 19496) (9a8e6fb3e7)
- 🔧 기타:chat 页(BUG-67 浮层)按复制页重新在册,门 299 判绿 (5130247253)
- 🐞 수정:rn-shell-types 派生件接入提交链,251 触发面补 types/ (5cc02e6c39)
- 📚 문서:结清 Y-13(webhook 对 CI 事件返 400/500)—— 按「完成即删」摘行 (194251a755)
- 🐞 수정:悬空 commit 批量备份器修好一处"import 阶段就崩"的真缺陷 —— 账面点名 109 枚待处置,而唯一出口一跑就死 (49f03ff8ce)
- 🚀 기능/개선:落地通道被"活着但不动"的持有者独占时,现在有读数也有账面 —— 停摆第三型不再只有被挡住那枚自己知道 (bf5560612a)
- 📚 문서:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (e7d89b74b1)
- 🐞 수정:门 30a 的 fsck 预算加一个"只抬预算不改判据"的出口 —— 今天它只有两条路:跳门或改文件 (72e47a67df)
- 📚 문서:登记 root-guard 同枚重封声明闸(b 方案) (b26167cce3)
- 🐞 수정:落地后置复跑改为按臂预算(登记表 + 实测出处)—— 永远取不到的"未判定"不是保守,是坏了 (1f039bb328)
- 🐞 수정:被上限掐死的一班归 cancelled —— 该档历史上 0 行,趁它还没咬人先把归类钉对 (3a7ddf3890)
- 🔧 기타:取号器镜像测试的 8 支反向锁改判代码面 —— 反向锁读自己的解释文字就是恒红,遮罩是加强不是放宽 (5680d4ea29)
- 📚 문서:结清 5 张已闭环票(RP-65/RP-67/RP-69/RP-70/L31441) —— 按完成即删整行摘除 (b66f0d861b)
- 📚 문서:RP-69 补登 GitHub App webhook 异步派发面(ko,§21 同批义务) (a2da1a6240)
- 📚 문서:RP-69 补登 GitHub App webhook 异步派发面(ja,§21 同批义务) (eae95c1e9b)
- 📚 문서:RP-69 补登 GitHub App webhook 异步派发面(en,§21 同批义务) (e428f0765b)
- 📚 문서:RP-69 补登 GitHub App webhook 异步派发面(zh,§21 同批义务) (2c3ff6ae54)
- ♻️ 리팩터:RP-70 B25/B32 重复 API 面收敛为单一出口 (85a76988b0)
- 🐞 수정:L31441 灰度实例不在位单独出声，三档终态钉镜像锁 (569ad72883)
- 📚 문서:补登 1 枚送还腿静默成功的缺陷票(实测五枚日志同句) (ee49bb8de9)
- 🐞 수정:RP-67 消费 import-graph 的 ok:false 并产出 [IHUI-SCOPE-DEGRADE] 签名行 (9f42c71f18)
- 🔧 기타:接线锁正则容忍 import 折行,避免格式化造成假红 (9a8361e992)
- 🐞 수정:db-probe 的 8810 只放行隔离库白名单,ihui_dev/ihui_prod 等仍拒 (2aa4690f99)
- 🔧 기타:ai-service 出站改签短期票并绑定真实主体(回调/写卡/号池桥接) (481f156b66)
- 🔧 기타:api 发送侧统一走内部票据出口,旧密钥仅作兼容同发 (1e61274522)
- 🐞 수정:取号面并入「近期已结清号」避让 —— 完成即删留下的洞不再被当空闲复发 (b0fcdb8adb)
- 🔧 기타:ai-service 入站验票器接入 /internal/checkin 与免扫描标记 (0a317f4559)
- 🔧 기타:5 个 X-Internal-Secret 端点改走票据统一出口 (da4daf00a4)
- 🔧 기타:X-Internal-Secret 统一票据鉴权出口与档位守卫 (5c2b547007)
- 🐞 수정:db_sync_scheduler 镜像日键断言注入固定时钟,消掉跨零点假红 (3169934af1)
- 🐞 수정:checkin_scheduler 补跑日界断言注入固定时钟,消掉北京零点假红 (0878a71169)
- 🐞 수정:保活腿心跳写入口改传主键 id —— 曾把 uid 当 id 用导致 heartbeated 恒 0 (52673665b7)
- 🐞 수정:checkin_api 的探针/快照/额度日序列注入固定时钟,消掉跨零点假红 (bf7811cb5f)
- 🐞 수정:archive_daily 的 today_mmdd 注入固定时钟,消掉跨零点假红 (d207c15303)
- 🐞 수정:测试侧共享固定时钟 seam —— 时钟注入收口到 conftest 一处 (1f88b304a8)
- 📚 문서:并行批认领 6 张可闭环票(wb-parallel) (ed5a85b2a6)
- 🐞 수정:探活 Client 构建失败改为可返回错误,根治 auto_refresh 启动期 panic 面 (BUG-0041) (d181c23b97)
- 🐞 수정:会话/检查点状态裸写改原子写 —— 中断/并发读曾留下截断 JSON (37f788cbe1)
- 🚀 기능/개선:供给断档拆两型 —— "政策面比票窄"与"票真的见底"从此不写成同一句话 (a8cdd5e190)
- 📚 문서:结清 RP-68 —— 未知旗标闸已落地(920e2de),按完成即删整行摘除 (123cf35b66)
- 🐞 수정:RP-68 未知旗标改 exit 2 并钉零副作用镜像(发射侧逐枚清点;四套测试全绿 + 变异自证) (920e2de4c3)
- 🐞 수정:消掉落地器复跑每轮点名的 4 条 TS2532(RP-65) (582ae3d8d1)
- 📚 문서:认领 RP-68 —— 收敛器未知旗标静默档收口 (a3108aee72)
- 📚 문서:补登 5 枚低风险单会话票,全部来自本会话实测缺口(票面供给) (a2f9ddccb8)
- 🔧 기타:落地器夹具的缺省正文过形状档 —— 那 10 枚从 11-04 起就红的用例回到绿 (866efb1d2b)
- 🚀 기능/개선:object-space-land 单实例闸 —— 并发落地从"照落"改成"顶住并说清等谁" (b101a98285)
- 🐞 수정:悬空导入门两格 —— tree 档取材集合对齐 commit 档;自测子档预算从"等于耗时"抬到落地器同一条 (392bbf70e8)
- 🔧 기타:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7f4fa2ec65)
- 🔧 기타:收编停留≥3分钟的未提交改动 (bc5505294c)
- 🚀 기능/개선:RP-66 轮级终局档 —— 连续 N 轮撞自我面闸必须有名字、响一次、按串去重 (3398e6817e)
- 🔧 기타:候选层的占位行用例与文件同枚入库 —— 上一枚只落了判据没落锁 (b4e057da4b)
- 🐞 수정:隐私政策删两条被三面证伪的过度声明(Y-70 随手格) — 三面对账:①merged/packaged manifest 里 SYSTEM_ALERT_WINDOW 6 处命中全来自 prebuild 生成的 android/app/src/main/AndroidManifest.xml:10(本仓声明面 0);②pnpm-lock 与全部 package.json 及 app/build.gradle 对 getui/DCloud 零命中;③apps/mobile-rn/src 与 packages/app/src 零引用(推送走 expo-notifications);R.txt 9317 行符号对 getui|gexin|dcloud|uniapp|Gtc 零命中。⇒ 删个推公共库SDK(Gtc)与 DCloud开发通用工具库两条目(60→58 段)并摘正文 9 处归属。dex 面未判定(无 APK/AAB 且本机禁建)⇒ IMEI/IMSI/MAC/应用列表的收集披露保留(政策少写比多写严重)。prepare-store-bundle 改前 过度声明2 → 改后 unjudged 过度声明0;prepare-store-bundle.test 7/7 pass;scan-hardcoded-zh rc=0;水印完整。withPermissionPruning.cjs 只读复算证明它在真 manifest 上 removed=1 并追加 tools:node=remove ⇒ 未改。未闭环:需主控席择窗跑一次 clean prebuild 复验 manifest,docs/RELEASE.md:448 那句已摘除要等 prebuild 才成立。 (49fd8ab057)
- 📚 문서:结清 D54(手册五章真实截图,枚 b5505f0844 已入库) (e2e902026b)
- 🔧 기타:手册五章补真实界面截图与共享图注组件(D54) — 素材全部为无头浏览器打本机在线站点(8851 生产腿)实拍,共 11 张 PNG(1440x900),落 apps/web/public/images/docs/manual/;渲染走单一共享组件(src/alt/caption 三 props),既有三章(前席)未重做,本枚补 ai-chat 与 knowledge-base 各 2 张。不该有图的判定按"不为消数字塞图":ai-chat 2.6 分享、kb 4.4/4.5/4.6 公开态只有登录门或 Authentication required 空壳,无真实业务内容,故不凑数。caption 如实标注会话失效态(apps/web/e2e/.env.e2e.local 不存在 ⇒ 无口令供给、token 不能刷新,已用 auth.setup.ts 产物 .auth/user.json)。渲染复验:仓内真实 TS/React SSR 两章 + file:// 真解码,4 图 naturalWidth=1440 naturalHeight=900 complete=true(证据 .ihui-agent/tmp/d54b/rendered-*.png);eslint rc=0;水印 verify 2/2 完整(PNG 不在水印覆盖面)。未判定:线上 HTML 里 images/docs/manual 命中数为 0(含前席三章)⇒ 线上仍是 D54 之前的构建,本票交付要等一轮部署才可见,不是"改完就上线";tsc rc=2 的 4 条错全在他席 edu/attendance 文件,docs/manual 0 错;prettier warn 落在既有 kbd 行(HEAD 版与未动的 agent 章同 warn);离线夹具不解析 Tailwind 工具类,圆角合规凭据是同组件同 props。 (b5505f0844)
- 🚀 기능/개선:学生本人考勤整月视图与五语言同步(B72 web 腿,票未完保持未勾) — 三端读路径原只传 date=当日,学生看不到自己的历史考勤;本枚把 web 腿改为整月区间(端点 :2034 既有能力,零后端改动),历史月视图不摆自签按钮以免形成签的是今天的假 affordance;五语言同批补 prevMonth/nextMonth/thisMonth(check-i18n-keys 19887 键 5 语 parity OK)。仍缺:移动端入口断链与 POST /attendance/self-check-out ⇒ 票面不结清。 (75f8522c09)
- 🐞 수정:未取号占位行退出判期打分 —— 谓词单源复用到候选层 (daf63345c5)
- 🚀 기능/개선:学生本人签退端点 + 两端入口接通(B72 剩余两格) — 后端 POST /attendance/self-check-out 注册于 edu-ai-management.ts:2053,鉴权先于判据走既有 checkAuthOrInternalService、主体恒取 request.userId,selfCheckOutSchema 只收 date(无 studentId/classId/checkOutMethod/checkOutTime/status/remark ⇒ 客户端自报结构上进不了库),班级由 resolveSelfCheckInClassId 现取,status 重判单源复用 statusPreservedOnCheckOut + loadEnabledAttendanceRule + judgeStatus(零内联),响应统一 {code,message,data}。幂等偏离已登记:本端点无插入路径,onConflictDoNothing 无处可用 ⇒ 改 CAS(UPDATE 谓词带 id ∧ studentId ∧ isNull(checkOutTime) + .returning(),空集判 409,不覆盖首笔、不凭空造在场记录、不抹 remark/operatedBy 留痕)。入口:RN domain-hub.ts 教育域新增 EduParent 条目(屏内既有 navigate(EduMyAttendance) 由此可达),小程序 pages/user/index.tsx menus 新增 /pkg-user/edu-parent/index;零新文案(复用五语言已有 eduParent.title)、零新图标。越权用例断言副作用未发生:甲硬塞乙全套键后 ①写入 classId 为服务端现取 ②set 里无 operatedBy/remark ③乙行 JSON.stringify 前后逐字节相同、全局行数不变、insertValues 恒空 ④每个 where 绑定字面量含甲 uuid 而不含乙 uuid;匿名 401 另断言 reads=0 且 writes=[]。实跑:新件 13 passed,同族 7 件合跑 156 passed(两次独立跑行数不变);typecheck @ihui/api 8/8、@ihui/mobile-rn 与 @ihui/miniapp-taro 7/7 全 exit 0;门 128、nav-dead-links、openapi-check(committed 档)rc=0;prettier 与水印 verify 绿。派生态同批:generate-ui-routes 已重生成(页面 329 条,pin 随本枚更新),openapi:export 已把新路径写进 apps/api/openapi.json ⇒ 不产生 CI drift。未闭环:四端尚无签退 UI(web PageClient 是教师侧,RN/小程序自签页只有签到)⇒ 本端点当前无客户端调用方,补按钮需动前席在途文件;README 待同批(§21,本枚按令未动 README*)。 (2c421dba82)
- 🔧 기타:文档中心未知 slug 真 HTTP 404 的成对状态码用例(补三层深度盲区) (d720db2924)
- 🐞 수정:GitHub CI 事件不再被拒且先应答后处理(Y-13 Y-91) — 400 成因:events.ts 的 ciCheckObjectSchema 把官方允许为 null 的 check_suite.status 与 workflow_run 双写 sha 当必填拒收(github-app.ts:403);500(dur 10s)成因:resolveStore+hasDelivery 幂等表查询排在 CI 分支之前,一次本不处理的投递被拖到上游超时(:415/:419)⇒ CI 分支前移到零外部 IO。Y-91 长尾(p95 2217ms/max 19720ms)按票面正解:验签与 schema 校验仍先于应答,重活整段落进一次性内存队列(并发 1、积压 256、awaitWithin 到点即 deferred 不取消任务、积压满就地执行、close/drain 有终态),响应新增 dispatch:inline|async,预算 env GITHUB_WEBHOOK_RESPONSE_BUDGET_MS 缺省 500ms、0=纯异步。实跑 4 files 95 passed(注入队列+手动泵,零真实等待;401/503/400/unsupported_event 拒绝面正控未回退);eslint/prettier 绿;水印 5/5。未闭环:真实投递需上线后按 /app/hook/deliveries 重放核对;deferred 不落盘为已知持久性缺口;生效待部署。 (38542c0d15)
- 🐞 수정:未取号占位行不再当票用 —— 显式跳过并计数(主危害在判期层,已另立一手) (d9f089effc)
- 🔧 기타:考勤八枚越权与行为契约用例(B19 B21 B22 B25 B32 B34 B35 B71 B70) — 权限链走 require-permission 真身(既有 rule-crud-contract 把它整桩成恒过,权限面从未真判);拒绝臂一律断言零读零写且规则表与密钥逐字节未变并带正控;parent-child 两路径实测各自独立处理器(重复 API 面待并票)补五态归属;B70 同事务幂等落 leave 17 例。席位实跑 rule17 qrcode15 rotate8 parent25 export8 checkin6 status7 leave契约17;主控席同入口复跑 4 files 38 passed;全仓 tsc 仅 4 错且均在存量他席文件。 (8d270eb3de)
- 🐞 수정:落地悬空副本里的两枚判据 fail-closed 与跳门降级证据(RP-67) (b7aa56e7f6)
- 🐞 수정:派发前闸的"瞬时不在位"先复核再停派 —— 别席 install 重挂 tsx 不该烧掉一班 (0be42c4124)
- 🐞 수정:取票腿被击穿时的可证复用 —— 三条安全条件缺一即拒绝,且必须说出是哪一条 (43bdd603e5)
- 📚 문서:22 枚在飞票挂完整租约(HEAD 面⊕挂牌,不代他席落地) (1c4f42c0c6)
- 🐞 수정:RP-91 旁路器物未知旗标守卫收口 + 修三枚烂牙测试 (09eeb36dcb)
- 🐞 수정:健康尺 A15 同批认 cost-breaker-stop —— 新字面量不能变成"没人认领的动作" (c3076a1a36)
- 🐞 수정:清理 15+ 未用导出,exports 1755→1730 回到基线内 (a990d81aff)
- 🐞 수정:成本熔断不再冒充"日预算耗尽" —— 两种真因曾共用一个字面量 (f8213f5a4f)
- 🐞 수정:日上限计数拿本地日键去比 UTC 时间戳 —— 本地 00:00-08:00 这段窗口日上限根本不生效 (b3cb1ec26b)
- 🚀 기능/개선:出站体序列化那一刻的自查仪器 —— 把 400 的射程推到 CLI 之外 (3540974b85)
- 🐞 수정:出站清洗补上射程第三格 —— 零宽藏在工具调用参数里时仪器全程报绿 (1b62d16ce2)
- 🐞 수정:逃生邮件从来没发出去过 —— resolveMailTo 的正则少一个 m 档,还反指控"缺键" (fdc0253f83)

**2026-11-05**
- 🐞 수정:相对路径逃逸用例切盘根执行,消除 DevEnv 下假红 (2a333988c7)
- 🐞 수정:内部票优先收尾 —— 清掉最后一处旧密钥开关并加配置矩阵 (3b14d759f9)
- 🐞 수정:消灭内部调用无凭据退化成裸 x-user-id,并加静态判据门 (3cfb981dc8)
- 🐞 수정:内部服务鉴权默认收口到 ticket,老通道身份头强制签名 (32cf59c6f4)
- 🐞 수정:重发 tenant RLS batch1 为幂等装车迁移 + 回滚脚本(F-01) (2725de663d)
- 🐞 수정:请求出口复位 app.* 会话变量,闭合池化连接串租户(F-02) (ad4828bf26)
- 🔧 기타:落地 pre-commit 自动格式化(仅折行/合并,无逻辑变化) (a9a727aada)
- 🐞 수정:内部票补齐 CSRF 非消耗式验签与 codebase 路由入口 (fc0e93c32f)
- 🐞 수정:判据 3 收严为声明锚定 + 全集相等,补反例 (b84737901b)
- 🔧 기타:修正白名单切片定位到常量声明处 (9a302a22fb)
- 🔧 기타:对齐 generate_handler 新增行缩进 (f3c5e6ce68)
- 🐞 수정:收紧 store 权限并以白名单命令守卫 AppData 路径(P0) (ebf13da07b)
- 🔧 기타:复现 plugin-store 绝对路径与 .. 可越出 AppData (9eeef21360)
- 📚 문서:更正三枚提交的 BUG 编号错标(历史不改) (1e764cfaa7)
- 🐞 수정:注册路径改由仓库推导,找不到启动器即失败 (30c2909c1f)
- 🐞 수정:pre-commit 捕获输出设 64MB maxBuffer,大输出不再假红 (b2024d7c9b)
- 🐞 수정:check-dedupe 取材失败改为 exit 2 未判定 (2e73c1d252)
- 🐞 수정:密钥扫描失败不再被吞成假绿 (5a01a9d31d)
- 🐞 수정:cleanupWorktree fallback 删除前补 realpath 二次断言 (7e42c045b2)
- 🐞 수정:低层 worktree 显式 withinRoot + 只读侧根内断言收口 (3a4c395a72)
- 🐞 수정:A 组 11 处同族路径入口统一收口到 path-guard (8856de986d)
- 🐞 수정:插件安装侧对 manifest.name 过同名白名单与安装根目录断言，与卸载侧同解 (32f83468e8)
- 🐞 수정:计划文件路径对会话 id 收敛并断言落在 .ihui 内，堵住 plan-<id>.json 穿越 (96a3fcabca)
- 🐞 수정:检查点/hunk 目录段收敛与根内断言收敛到唯一实现 util/path-guard (8c0b9bc075)
- 🔧 기타:回归测试夹具导入补 arch-exempt 注解，清掉新增架构门判红 (26d11f8e86)
- 🐞 수정:会话/检查点 id 收敛单段并断言根目录归属，堵住 --resume/--session/delete 路径穿越 (4afe993f70)
- 🐞 수정:/share 先转义原文原始 HTML 再净化 marked 产物，堵住 BUG-0003 存储型 XSS (38168ba109)
- 🐞 수정:插件卸载前校验名称白名单与根目录/符号链接归属，堵住 BUG-0002 任意目录递归删除 (363db07fcc)
- 🐞 수정:非原子写改原子写 + 文件句柄收进单线程闭环 (560fce1e3f)
- 🐞 수정:线程安全收口——git/.gitignore 串行锁、原子写、行为用例自隔离 (b68ed3b522)
- ⚡ 성능:治理 async 链路同步阻塞调用(文件IO/子进程/DB 边界清单) (8909847004)
- 🐞 수정:修复工具循环第二轮 NameError 与语雀连接器事件循环阻塞 (cf2f0b3ff0)
- 🐞 수정:语音取消后不再上传回填，并补齐 StreamingRecognizer.configure (8101105f0c)
- 🐞 수정:恢复下载详情页组件引用，解除 TS2307 构建阻断 (16ad92b709)
- 🐞 수정:无派发收尾的措辞与真实原因同形 —— 已落地跳过不得记成白名单问题 (bd10cbee66)
- 🐞 수정:已落地的票不再重派 —— 落账成功后票行还开着,重派的产物是第二份近似测试 (e30f32ce85)
- 🔧 기타:给「新增未跟踪文件能否落地」补端到端锁 —— A13 此前只是假设 (d3dd6e13c3)
- 🐞 수정:工具失败原因进转录与事件面 —— 自主班次此前只能看见"✗ + 空正文" (8c1cf02cc9)
- 🐞 수정:glob 的 **/ 编译被自替换毁成恒不匹配 —— 自主派班会话整班零写盘的真凶 (df789c297d)
- 🐞 수정:票面指纹改量被审面 HEAD —— 工作树滞后副本让 8 枚新登记的票进不了候选面 (3aff8c62b1)
- 📚 문서:补齐 B71 拆票余下 3 条考勤端点为独立票(池量不足即如实拒发,不留散文里的丢工作) (8152fd5aa3)
- 📚 문서:把 B71 收窄后剩下的考勤端点逐条登记为独立票(先落 5 枚,B 池余量已到两位数硬上限) (87b2bf5211)
- 🐞 수정:上游间歇性拒绝不得记到票的连败上 —— 中转的"请求包含不合法字符"归 transport (f2cb429991)
- 🐞 수정:keepZwj 档不再免死孤零 ZWJ,自查加 zwj 格 —— 仪器与判据同盲一格的那次假绿 (e68cd53ba0)
- 🔧 기타:收编停留≥3分钟的未提交改动 (e29acfbd2f)
- 🐞 수정:生成器只再导出不 import ⇒ planFaceDigest is not defined(自我修复这一维时把它砸了) (f4975f2dc7)
- 🐞 수정:缺票面指纹的旧候选档也必须重刷一次 —— 让这一维自愈,不等 6h 钟表 (1c6b257f1a)
- 📚 문서:B71 收成单会话可完成的一张票(只做 /attendance/export 的成对与越权用例)—— 真票面连班 20 次调用零写盘的量法修正 (8ab3a2ef82)
- 🐞 수정:候选新鲜度按票面指纹判,不再只按钟表 —— 改写过的票 227 分钟对环不可见 (bf1a16e903)
- 🚀 기능/개선:apiRoutes 按语法证据识别 Fastify 接收者 —— 4685 → 4813(+128) (6328514264)
- ♻️ 리팩터:回调页转义收敛到 shared escapeHtml(产出字节不变) (20ee1255de)
- 🔧 기타:派发档换成实测会动笔的模型 —— 20 次调用零写盘 vs 一次成功 write_file (c73e9ccd06)
- 🔧 기타:收编停留≥3分钟的未提交改动 (dc131ab382)
- 🔧 기타:补收两处并行会话探针残留落点(miniapp probe-tmp 目录 / e2e tagsview 调试脚本) (8aa7240c52)
- 📚 문서:数字改动收窄到门明确报的行 —— 回退门盲区批量改写，未判定行登记保留原文 (4e9e144633)
- 📚 문서:四语 README 数字按现算收口 —— 618 表 / 4685 路由 / 4057 测试文件 / 53 CI workflows / 334 道守门 (2be4008892)
- 🚀 기능/개선:出站自查再加一格 extra= —— 把"带毒段在 messages 之外"变成可读数而非猜测 (ce4cf44fde)
- 🚀 기능/개선:出站载荷自查仪器(IHUI_TRANSPORT_AUDIT)+ 更正上一枚的过度归因 (92e61ba98d)
- 🐞 수정:结清凭据按主键条数差算,不按逐字消失算 —— 治"合法改写被记成正当摘除,5 分钟后活票被真删" (1db0b5037d)
- 🐞 수정:出站清洗覆盖全部角色(非 tool 档留 ZWJ)—— 第 14 轮的 400 证明载荷不只住在工具结果里 (4ef8089d5a)
- 🐞 수정:让位无处可让即扣住该票 —— 治"同一枚空转票吞光整天的派发预算" (b481a027eb)
- 📚 문서:B71 票面就地改写为现读剩余射程 —— 归属成对用例已落地,9 条路由仍无行为用例 (7ad03584a9)
- 🔧 기타:收编停留≥3分钟的未提交改动 (2b5f58a4b8)
- 🔧 기타:日预算 9→10 —— 机主那条授权要的是"验一次端到端真产出",而 9 枚全烧在未修成因上 (a85b530efd)
- 🐞 수정:派单工序补第 0 步"第 1 轮就发出工具调用" —— 同权限档对照量出来的 (a41476316b)
- 🐞 수정:派发模型改由闸门声明并写进命令行 —— 不再靠子进程继承哪个 HOME (6ab3ab37c4)
- 🐞 수정:出站消息表剥 tool 档零宽载荷 —— 治"自治会话读了水印第枚文件就自毒" (efff5023bb)
- 🐞 수정:流期间工具卡渐进渲染可见性根因修复与 E2E 转绿 (bd3ea05c78)
- 🐞 수정:推送类器物补用法档,并修 sync-tags 既存死器(一跑即 ReferenceError) (9926b5d4fe)
- 📚 문서:B71 的释放注记移到行尾 —— 让票类词回到匹配窗口,机主授权的"按票类登记"那一半 (65173065c3)
- 🔧 기타:日预算 6→9 与「测试/质量」两档 —— 机主授权面落地并写明边界与回落 (52e885f1d0)
- 🐞 수정:范围预解析认点号成员引用与裸点文件 —— 补 P84 暴露的仪器盲点 (21b60c5792)
- 📚 문서:P84 结清即删 —— 五条判据实跑绿,并收口我此前两次的错归因 (50cfd20ab2)
- 🔧 기타:二分定位渐进渲染浏览器缺口到消息投影层并显式登记 (b271803ad4)
- 📚 문서:P85 结清即删 —— 五条判据逐条实验通过,不是"看起来像做了" (301f820942)
- 🐞 수정:补用法档 —— 这枚的默认档是真推 origin,手滑不该动共享状态 (d016326e7c)
- 🐞 수정:自愈器的手滑档降到只读 —— 敲错旗标不得按"真恢复"写他人现场 (3a9ebdf90f)
- 🚀 기능/개선:停派时把"池里还剩几张打得赢的票"记进账面 (1425f4e83f)
- 🔧 기타:补交成本熔断改桶的写盘腿夹具 —— 两枚测试件此前悬在工作树未入库 (e5b1185b72)
- 📚 문서:RP-66 按现读证伪结清 + RP-94 分叉数字第三次现读更正 (e6e10f22a7)
- 🔧 기타:tool-call-args-delta 浏览器真跑改造并显式登记渐进渲染缺口 (a0d5602215)
- 🐞 수정:无头会话的 tools 广告面按同一个权限判据过滤 —— 不再摆结构上执行不了的墙 (b3229add9d)
- 📚 문서:作用域行不再写死盘符 —— G:/IHUI-AI 是另一台机的现状,代价已被量到 (f8142e97c2)
- 🐞 수정:空转阶梯改按行分档 —— 毒票不再被"零推进的结算"每轮归零 (cdb8b1780a)
- 🔧 기타:推进文档自动更新水位（生成器写入） (5101d61871)
- 🔧 기타:按 --snapshot 重生成本机服务快照并更新仓内引用面 (f0b4a9df44)
- 📚 문서:§8 逐条二次复核补 CLOSED/OPEN 标注并保留旧读数 (34ec998472)
- 🔧 기타:重生成中文压缩包（zh-cn-pack.gen.ts） (9a1bdb6905)
- 🔧 기타:重生成远端语言包压缩体（remote-locales.gen.ts） (69aba4e4f5)
- 🔧 기타:重生成远端语言包清单（remote-locale-manifest.gen.ts） (1c7f85e8b9)
- 🔧 기타:重生成小程序远端语言包压缩件（zh-TW.b64） (15341d2537)
- 🔧 기타:重生成小程序远端语言包压缩件（ko.b64） (07375a618d)
- 🔧 기타:重生成小程序远端语言包压缩件（ja.b64） (28597ceb9b)
- 🔧 기타:重生成小程序远端语言包压缩件（en.b64） (f7c9a81139)
- 🐞 수정:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（zh-TW） (8421f44509)
- 🐞 수정:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（zh-CN） (c3313db9e0)
- 🚀 기능/개선:工具入参逐分片渐进渲染全链路收口（埋点/断流兜底/E2E） (105315ff86)
- 🐞 수정:执行器补 --help 档与未知旗标拒绝 —— 并收下生产真传的 --once (d911f93957)
- 🐞 수정:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（ko） (1f3e6254c0)
- 🐞 수정:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（ja） (8b11b6351a)
- 🐞 수정:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（en） (82745a6358)
- 🔧 기타:暂存删意图形状锁改锚 scoped reset 后的读缓存 (438eea21ba)
- 🔧 기타:SC9 锁 scoped reset 且不得退回全局 reset (3455f0b2f0)
- 🔧 기타:载荷等值锁改用 expectedForPayload 与文件数文案 (b7db67d784)
- 🔧 기타:no-auto-skip 的 scrub 增加 scoped reset 归一 (b4dce7598a)
- 🔧 기타:dry-run 期望改为 scoped reset 与 fail-closed 文案 (f980b01865)
- 🔧 기타:载荷归属断言改锚 launchCommitWithHooks/commitArgv 真实调用点 (1dfbfc8400)
- 🔧 기타:把 push 档点名的 6 处裸奔派生补上显式 stdio —— 清 blocking 存量 (6ada741b41)
- 📚 문서:追加 3.5.2 激活收口记录(agent 工具循环逐分片直推实际打通) (874b074ad5)
- 🚀 기능/개선:agent 工具循环开启逐分片直推,tool-call-args-delta 端到端透传 (89af54537b)
- 🚀 기능/개선:派发那一刻把查得到的事实交给会话 —— 范围预解析 + 仓根现读 (157a5fffc3)
- 🐞 수정:接上盘上真存在的 ripgrep —— 派发会话检索假阴性的病根 (ab554f1a36)
- 🔧 기타:全量档未判定四点实证入库 —— 实测不是缺口,classifyWorktree 不构成第二个失败点 (2e949dc67a)
- 📚 문서:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (1efb7656fe)
- 🔧 기타:补齐 12 处 watermark 注入,纯水印对齐无逻辑变更 (7d8e8f97fb)
- 📚 문서:登记取票口 79-170 秒为环第一瓶颈(超时已止血,优化须先出剖面) (653c3f78ea)
- 🐞 수정:取票口超时按实测抬到 300s —— 120s 在忙时段必然击穿,环整天拿不到票池 (eed6765dd4)
- 🐞 수정:深档取材失败改为逐路径「未判定」+ exit 2 —— 未判定不再整轮上抛,也不折绿/折红 (5fe681420a)
- 🚀 기능/개선:两项可选增强端到端贯通 —— 工具入参逐分片直推与 ToolCallCard 渐进渲染 (0d064fdc5f)
- 🔧 기타:补 ⑯d 锚点表接线锁 —— 读错文件即翻红,夹具不再绕过接线 (10c65b235b)
- 🐞 수정:自我面闸读错表导致环长期停派 —— 锚点表改回 autonomy-invariants(与门 299 同一份) (507043ad17)
- 🐞 수정:私有 commondir 直指最终公共目录 —— 修复 linked worktree 下 commondir 叠层致 non-repo (15c0db977e)
- 🚀 기능/개선:把环自身(执行体/熔断判据/上限闭集)列入受保护面 —— 派出的会话改坏环自己从此被拦 (ce5d42877c)
- 🐞 수정:窗口截断文案拆成 R1 深档/R1r 浅窗两侧(判据零改动) (42d4d8f79f)
- 🐞 수정:改桶写盘腿两处自伤补修 —— writeFileSync 未 import 与 Date.now() 当字符串用 (217f134f25)
- 🐞 수정:R2 文档面扩到 docs/GATEKEEPERS.md,补回速查迁移后的接线声明射程 (3e14a876c2)
- 🐞 수정:腿断班次改记 session-blocked 桶 —— 环境故障不再吃光生产额度(历史可证行按同一判据改桶) (1ade2dcfb6)
- 🚀 기능/개선:新增 --list-covered <file> 落盘 pathCovered 全量(默认关闭,供人工对账) (f95050275d)
- 📚 문서:RP-93/RP-65 结清摘行(执行体残骸已保活复原 A14 转 OK;A15 覆盖面维已装) (049ac701ea)
- 📚 문서:登记两枚 lib 在飞判据唯一副本须归属席处置 (bf93b94f7d)
- 📚 문서:RP-93/RP-94 改为本席实测值(blob 号按内容锚点书写,不占指针位) (31dc10d352)
- 📚 문서:登记 A14 轮级死亡机制工单(前置写明被 RP-93 挡住) (3263c31bd7)
- 📚 문서:RP-94 分叉读数改当次现读(359/175 非 ff,引用锁异常已自愈) (f7f4d4c14c)
- 🔧 기타:停用 lost-commit 自动增长产线，开放清单摘除开关 (ecd93149b9)
- 📚 문서:RP-94 挂分叉逐块裁决交接件(含 ref 存续前置) (17a85b34f3)
- 🐞 수정:健康尺子的四类盲区改为到人 + A7 提交证据补配对 —— 瞎掉比报红更危险那一格 (11245ffa14)
- 📚 문서:RP-64 补批次件指针与当次读数(追认与重签两档分列) (da51c0bd17)
- 🐞 수정:A7 闭环合格线补"绑票键的提交"一档 —— 已落账未推进不再算成会话没干成 (459d373dd0)
- 📚 문서:RP-65 结清摘行(巡检 breach 行已逐枚带判别码) (3799dfcece)
- 🐞 수정:判据面巡检 breach 行改逐枚带判别码(RP-65)—— 不可复现的指控事后无从定位 (a4924791a3)
- 📚 문서:登记巡检日志缺逐枚判别码(不可复现指控事后无从定位) (81afd0ea30)
- 🐞 수정:发起腿断裂改按结构分型 —— 乱码不再把无辜票烧进连败 (d13019ecb8)
- 📚 문서:登记判据面追认积压挡住推送门(出口=持钥方逐枚 --ack) (c8c898c2bc)
- 📚 문서:更正批量档立因里的预算口径 —— 300 秒是自检档,推送腿预算是 900 秒 (9006e06821)
- ⚡ 성능:判据面审计三张批表 —— 323 枚区间 400.6 秒→21.4 秒(判定逐字等值) (049c49cc43)
- 📚 문서:RP-92 结清摘行(判据面审计三张批表落地,区间 159 枚 26 秒,等值锁 ST57a-h) (ca85efbdc9)
- 🐞 수정:受保护面申报预检提到提交通道这一层 —— 不再让"只报不拦"的预警被 || true 与 tail 截尾吞掉 (08180f598f)
- 📚 문서:给上一枚三行补上取号器实号(RP-92/93/94)—— 整行唯一差异就是在声明位插入编号+一个空白,主键/租约/归属三维其余逐字不变 (ae2f92b54d)
- 📚 문서:摘掉本席上一枚未展开的取号令牌字面量(取号族我写成了 RP-,工具只认 RP ⇒ 令牌原样入库);本轮只做纯删除令牌,主键/租约/归属三维逐字不变 (8bc1dbd4a9)
- 📚 문서:登记自主环三条未闭环项为可派单工单(审计批取剩余三处 / 盘上旧基线执行体收口 / 真分叉 10 块逐块并集) (08b0a07885)
- 🔧 기타:落账腿第一次端到端装车证明 —— 真清单 + 真 isolated-git ⇒ 产物字节进 HEAD(3/3,含两格反向) (368cd1faac)
- 🐞 수정:自陈述版本只看**本进程 import 闭包**——判定面从 1054 枚收到 48 枚,不再为无关字节重启常驻守护 (36537b1ee8)
- 🚀 기능/개선:立 A14-executor-face-stall —— 自我面闸"一直停派"从此是响的,不是安静的 (e667f74331)
- ⚡ 성능:批档一次读齐父辈/标题/正文 —— --range 30 枚 86.6s→72.2s,判定逐字未变 (dbfbd6a67a)
- 🐞 수정:同秒 D/D 并列收窄为可判定,3b 未判定项不再被悬空档整体赋值抹掉 (2a546f0a49)
- 🔧 기타:分型改向后给冤封尺补成对锁 —— 同一句诊断文本,终态不同判果必须不同 (7f6a66869a)
- 🐞 수정:会话终态分型不再被一行诊断劫持 —— rc=0 的成功会话曾被记成"发起腿故障"(41 条) (9527854274)
- 🚀 기능/개선:立 A13-artifact-landing —— 自治环"跑了十天、一枚没落"从此在账面可见 (ddc189399f)
- 🔧 기타:正文形状闸带出的 8 格假红收口 —— 夹具正文改 conventional,真话提前说的那一层如实记 (b256cc2abf)
- 🐞 수정:补回 safe-commit-dry-run 测试的零宽载荷 —— HEAD 面欠账清掉一枚(新档的第一个生产用例) (ff610fb729)
- 🐞 수정:载荷复核不再恒真(scratch 探针 verify 覆盖 0/0 也报绿)+ 给"基线整条载荷缺失"补一条落地出口 (9b2f1246ac)
- 🐞 수정:3b 分档拆开「有未覆盖路径」与「merge/空提交」—— 缺口读数不再被无改动路径的合并提交灌水 (595bdd1a6d)
- 🚀 기능/개선:lost-commit tag 直接指向的提交纳入逐路径覆盖 —— 让『已备份但缺口仍在』不再失明 (eba3125860)
- 🚀 기능/개선:派发前核验"我跑的这份是不是今天的"—— 自我面闸(不拿半成品当执行体) (abc1a72b90)
- 🐞 수정:门299 的面名从 selectFace 的 .face 取 —— 读数里那个 [object Object] 其实是 --staged 失效 (95a7653212)
- 🐞 수정:密钥句柄不再可枚举 —— 一次整对象打印就会把签发钥送进记录 (85d1d00dd9)
- 🐞 수정:事后核验与索引推进挪到放锁之后,并输出锁排队读数 (5c3465f85c)

**2026-11-04**
- 🔧 기타:补齐 8 枚 HEAD 面缺载荷的溯源水印(门47 push scope 欠账) (86958e1b20)
- 🐞 수정:同秒并列的删除判定改为未判定——git log 先到者不是拓扑结论 (ad8bf319a0)
- 🐞 수정:拒绝建「静默零钩子」树 + 建后复核 + list 标红 (92b9a21635)
- 🐞 수정:v2 签名钉住签发 base 与路径内容号，HEAD 前移不再把合法提交判成 sig-invalid (f1724e53dc)
- 🐞 수정:R3 更正 —— 健康尺补 A12 头注并补发判据面声明 (3c898b3c1f)
- 🐞 수정:停用隐式 COMMIT_EDITMSG 消息通道,防止把别席在途标题读成本次理由 (9f85df84cf)
- 🐞 수정:其余落地器补本席消息上下文与 subject 回读自证 (5bc180e29a)
- 🐞 수정:isolated-git 改用本席私有 GIT_DIR 与消息文件,根治共享 COMMIT_EDITMSG 并发串号 (9ceae5b21a)
- 📚 문서:§8.4 磁盘读数改为两次测量差值 [+59,669 B / 0.004%,对象库共享] (6676566e3d)
- 📚 문서:校正挟带口径并补通道可靠性/混态/磁盘实测 (bee478bedf)
- 🐞 수정:R3 全腿产出对账尺 A12 + 修 dep-radar 采集输入面 —— 12 腿按 always/conditional/none 分类对账(防恒红门)、pnpm audit 显式净化代理 env、空 stdout fail-closed、修 liveness ruler 笔误 (ca665ca6ed)
- 📚 문서:§7 失败分型补 lock/other 的实测含义 [已核对本次 40 笔读数] (397d6cf705)
- 📚 문서:§0.1 补 22:49 复核基线,§7 换成两次运行的漂移读数 (24545835cb)
- 🚀 기능/개선:land(ff-only) 回主线 + 共享树/隔离树并发压测 (6994aadf9f)
- 🐞 수정:LAND_MSG 支持 @<文件> 并拒「路径当正文」,落地后自检判据面声明 (b9f5cbbf61)
- 🐞 수정:D 类判据收紧——只认「同 old blob 且是该路径最新状态」的删除记录 (09f2d95b10)
- 🐞 수정:追认改用独立 a2 追认钥,关闭作者自认 (478dc9e9e4)
- 🔧 기타:新夹具文件补齐投递水印(水印腿在首次提交后落的尾注) (9ef8d9ce2d)
- 📚 문서:校正回灌门头注的实测口径 —— 两段在位区间按实测写准 (1c3d44d4bc)
- 🐞 수정:门52 补「options 收进变量」那一维 —— 拆掉正在咬全仓的恒红门 (b677b5b30d)
- 🐞 수정:私有索引提交统一后置推进共享索引(治 MM 回灌) (4e38ff0dbe)
- 📚 문서:速查表迁入后修正两处指向 —— 新增门流程与相关文档改指本文 §10 (8898e9c0e6)
- 📚 문서:守门速查正文按迁移档摘除(全文已在 docs/GATEKEEPERS.md §10) (9b987c50d9)
- 📚 문서:守门速查迁出后留指针 + 三条不迁硬约束 + R4 门名点名 (25104681e2)
- 📚 문서:守门脚本速查全文自 AGENTS.md 逐字迁入 GATEKEEPERS —— 腾体积不改条文 (2f3471c297)
- 🐞 수정:回灌门改判'本次新增行' —— 整份快照对照面的结构性假阳 (fb2ed7ca5d)
- 🐞 수정:门 30a 远程 tag 档显式发起但取不到时改判未判定(exit 2),补必失败夹具 (d248166a20)
- 📚 문서:新增判据 19 归属三态与禁令 19,修正红线 C 举例 (ebb357b4e8)
- 🐞 수정:R2 治「我量不动」被读成「没推进」—— git 派生预算解耦 + 未判定失败分型 (b5e8db1ef1)
- 🐞 수정:i18n 输入一变,离线包产物提交时强制重生成 — 补齐钩子腿缺失的执行体 (4dd65789da)
- 🐞 수정:hook-markers.jsonl 按大小轮转且并发写不写坏,读侧跨代拼接不丢行 (9d94bc556c)
- 🐞 수정:门 30a 判据改造落账后的具名追认(67ed343d2c) —— 并发 COMMIT_EDITMSG 覆盖致消息缺失 (c230cb4781)
- 🐞 수정:开工期 guard 失败留痕 + 轮次记录提前填 (eb9446a768)
- 🐞 수정:pre-commit 失败回显从末 40 行改为末 200 行,避免真因被截 (bfa77e93d9)
- 🐞 수정:pre-commit 失败回显从末 40 行改为末 200 行,避免真因被截 (67ed343d2c)
- 📚 문서:补录 live-doc 旁路落地的后置核验留痕 (ee4cbe42af)
- 🐞 수정:开工期 guard 失败留痕 + 轮次记录提前填 (26bc403762)
- 📚 문서:禁令 16–18 并入 §7 单一名单位置(1–18) (b77c66959e)
- ⚡ 성능:三处 for-each-ref 改用 %(refname) 并本地剥前缀，消除短名 O(n²) 消歧 (71d37ea29c)
- 🐞 수정:健康尺与候选仪都认识 session-no-write,并把取样器的赋值形态盲区补上 (d836c65189)
- 📚 문서:同步计数为 18 判据/18 禁令并接入收口核验 (5af5c3daa0)
- 📚 문서:补录私有索引提交残差与定版边界(判据 17–18/红线 C) (5599fd8a30)
- 🔧 기타:离线包按 HEAD 面重生成落地(私有索引档)—— 清偿 miniapp-taro/ko.json 与 shared/zh-TW.json 两枚输入漂移,G5 自述钉回归 455aaebe (ed583dec29)
- 🐞 수정:git-private-index-commit.sh 失败臂补 lost-commit 备份（只备份末枚） (5d9580e74e)
- 🐞 수정:恢复档 CAS 输家臂补孤儿备份（只备份末枚） (4348769fe0)
- 🐞 수정:收回逐轮 lost-commit 打点，只在最终失败出口备份孤儿 (cc3bb7999c)
- 🐞 수정:定版索引上界改为按索引推导并走未判定 exit 2 (f78993c8d6)
- 📚 문서:补齐 AD/MM 三值清理判据与 R/T/U 越界识别 (a000fe08cf)
- 🚀 기능/개선:新增 app-probe-stall 维 —— 宿主 git 探测一次超时后反复重放同一条卡死记录且不自愈 (11049999a3)
- 🐞 수정:封住私有索引定版回灌与 sh 层误挡 (2781111c26)
- 🔧 기타:补私有索引空派生集/漂移复原的 ENOBUFS 回归用例 (c26906358b)
- 📚 문서:新增共享索引残留处置 playbook(四型识别/三条清理判据/私有索引通道) (e4acfb21de)
- ⚡ 성능:纯 oid 直达分支,恢复迁移带来的 2× 回退 (4716206cd0)
- 🐞 수정:封住私有索引上下文丢失与派生腿申报缺口 (ffda30adcf)
- 🐞 수정:门198 盲写棘轮清偿 —— qrSecret 轮换与 attention 镜像改为先取现值、真变化才写 (f5a6531081)
- 🐞 수정:删 miniapp-taro ko 独有 2 枚野键(零引用,曾被 8e030/c0f64 清偿) (4dc42b0307)
- 🔧 기타:门 30a 补 --self-test 端到端自检(13 例,正反成对) (b83bdf0652)
- 🔧 기타:补齐 isolated-git 的派生申报依赖文件 (dd18e2c2c2)
- 🐞 수정:清门83/218 — 品牌底配对前景 + 移除硬编码 hex(6 文件) (25fc0f8e04)
- 🐞 수정:门281 主树解析不得用调用目录顶替 (3e122f1dd6)
- 🐞 수정:isolated-git 撤回上一枚夹带的他人半成改动 (dc2a11c693)
- 🔧 기타:修复门7依赖碎片检查:锁文件去重并识别 pnpm 干净收尾 (37c026f9fc)
- 🐞 수정:补回 swap-fail 闭环并立 A11 产出型量尺 — 部署决策 action 收口单一真源、摄入器逐行剔除+固定桶幂等、量出腿在跑却零产出 (13ea7501bf)
- 🔧 기타:\IHUI-AI\.ihui-agent\tmp\goal-autonomy\commit-msg-no-write.txt (0bb7078119)
- 🔧 기타:补齐新增同步工具与文档的溯源水印 (b510b8f612)
- 🐞 수정:check-i18n-parity 实装 --target 并真判红 (969b8ecb67)
- 🚀 기능/개선:prod-bundle 运行副本同步工具与门 104 修复通道 (ebc8d8c832)
- 🐞 수정:checkin-batch-gate 两枚 .ps1 补齐 UTF-8 BOM(门 265 HEAD 面销账) (2f3c02d6ee)
- 🔧 기타:补 4 道 pre-commit 元门的 --self-test 自检档(95/236/292/16c) (6f80aba3b5)
- 📚 문서:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (f4ae37374e)
- 📚 문서:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (1d17fa01d0)
- 🐞 수정:取材面改走 git 索引,收紧 9 条失效基线 (b36c307eee)
- 🔧 기타:仓根补齐 .next[.-]* 变体忽略规则（与收编器 EXCLUDE 语义等价） (f39a65a34b)
- ♻️ 리팩터:git 派生收口到取材层,face-reader 棘轮去红 (47d9f43fe1)
- ⚡ 성능:门242/243 逐文件 git show 改整面批取,242 736s→5-6s、243 458s→9-11s (801e5aa4ef)
- 🐞 수정:shared/zh-TW distribution.plan.rule1 用繁体「傭」 —— 门 2j-shared 简体残留结清 (9093adf849)
- 🐞 수정:verify-deploy-facts.ps1 补齐 UTF-8 BOM(门 265 HEAD 面销账) (1db60d99fb)
- 🐞 수정:--self-test 严格识别并只跑门自检档,未知参数 exit 2 (0b5ec52e1f)
- 🐞 수정:dry-run 关闭 git 可选锁,杜绝索引 stat 刷新落盘 (a8ae241426)
- 📚 문서:门50 镜像测试 X7 标题跟随面改造 (d1138b817c)
- 🐞 수정:safe-commit --dry-run 改为全路径只读预演 (ec34967546)
- 📚 문서:AGENTS 等体积压缩并补登「工作流/部署脚本死引用」点名行 (5adf825916)
- 🐞 수정:门50 射程扩到全部 tracked 文件(HEAD 面),收编器排除 .next 全变体 (7552ed92ba)
- 🐞 수정:修正生成器溯源路径常量，使产物标签与横幅一致 (522d2dfb36)
- 🐞 수정:monitor-trust 出路改成「先 token 重建再谈关档」—— 本机实测关 fsmonitor 把 status 顶到 5.7~6.2s(超消费者预算) (f43a81aa1d)
- 🚀 기능/개선:新增「工作流/部署脚本死引用」只读门(298),补 working-directory 与回滚态判据 (8f8adbfa78)
- 🐞 수정:门 91 补齐 12 处缺失 colorScheme 并显式接线 2 处收藏壳 (3e159cc5cc)
- 🔧 기타:next-env.d.ts 停止引用已死 .next-e2e-perf 变体，回到 ./next/dev 规范引用 (c30b6e44dc)
- 🐞 수정:web/taro 派生钉按 HEAD 面重生成 —— 修 inputsSha256 滞后(门105 G5 stale→matched) (8781bbaad8)
- 📚 문서:accel-live 两路读数与「例数一律现读」—— 消掉会腐烂的自检计数 (91c6820b87)
- 🚀 기능/개선:签到批次执行中推迟重启 ai-service(上限 900s,fail-closed) (da7506747c)
- 🐞 수정:两处「体积/窗口护栏把没扫写成扫过」的漏报 —— 桌面端明文门 400 字符窗口、trae 审计 12MB 静默跳过 (9fb0b6d11a)
- 📚 문서:补回一键级联入口硬性条款并压缩AGENTS归档注释,门207回预算内 (adc3e8766a)
- 🔧 기타:棘轮判红时逐命中教改(附可复用批取入口) (72df2cf539)
- 🐞 수정:串行门补硬超时,卡死门以未判定收口 (f71043eb7c)
- 📚 문서:校正实测读数并记录主树共享索引 AD 残留 (74357b4d7e)
- 🐞 수정:日预算闸是死的(它在数一枚再没人发射的 action)+ 把"发射集 ⊆ 分档集"上锁 (3bdb7bc65a)
- 🚀 기능/개선:新增隔离工作树一键开关收工具与切换文档 (b621533999)
- 📚 문서:收口门89点名与门207体积,迁移grafana旧脚本名 (5bb3c7de28)
- 🐞 수정:--staged 面 git grep 的 --cached 归位,该面不再恒未判定 (a3a24e40f2)
- 🐞 수정:accel-live 改按索引扩展块倒剥 + git 自测第二路读数 —— 旧 64KB 尾窗把生效读成假 drift (dcea7b738b)
- ⚡ 성능:251/244 两道门由逐文件派生改为整面批取(251 >15min→4s,244 >17min→31s) (087f976e6f)
- 🚀 기능/개선:逐门进度日志追加 scope/stderr/runId 三字段（旧行兼容为未标注） (d40b90fdf4)
- 🔧 기타:grafana 旧族最后两枚退役,head→HEAD 归一迁入 check-panel 接线门 (dcf2b8168b)
- 🔧 기타:摘净回潮件 assistant-release-upload.yml (dd399bff94)
- 🐞 수정:门 288 两处新增漂移收口 —— UserInfoCard 载体形态差异/VideoPlayer 回调命名对入语义等价表 (6ca6b82706)
- 🚀 기능/개선:A6 改为按当前规则表复算覆盖率 —— 历史 25 条 unknown 里真盲区只有 2 枚,现已具名归人 (e16299f137)
- 🐞 수정:摘净 desktop 商店图标与 share-intent 死副本 11 枚并登记退役锁 (f33872b568)
- 📚 문서:§12i 补② 钩子格式化会被私有索引快照复原，提交前须自跑格式化 (d7c81497ad)
- 🔧 기타:新增 gates-full.yml 全量门交 CI(PR/main push 自动跑 331 门) (ff4496fe49)
- 🐞 수정:isolated-git 私有索引加内容级护栏,lint-staged 灌回内容即按快照复原 (95c87e0437)
- 🚀 기능/개선:git 探测余量哨兵补 accel-live 维(账面启用≠真生效)+ AGENTS 门207 体积债第七批清偿 (98d7637b4b)
- 🐞 수정:grafana-* 旧族退役 6 枚并登记退役锁,门 220/222 改指 panel 真值面 (ed0bf2fedc)
- 📚 문서:§12i 补受保护面签名纪律——标题定稿先于签发，改标题即签名作废 (9d854bd237)
- 📚 문서:staging-snapshot 注释两处 §20 漂移改指 §12i 私有索引通道 (8bc0584d83)
- 🐞 수정:sig-invalid 不再被说成"窗口到期",并加签发留痕回查 —— 把"重签一次"与"补理由"两条出路分开 (a083f0a74a)
- 🐞 수정:isolated-git 提交后 CAS 收敛共享索引并加固并发测试 (02928bf7a4)
- 🚀 기능/개선:新增私有索引提交通道 isolated-git (f887b2dde6)
- 🚀 기능/개선:自动臂按需加密(环开 4 分钟/轮,环合即回落) (0061164cdb)
- 🐞 수정:判据面护栏在 commit-msg 加只报不拦的预警档 —— 未声明要在"还改得动"那一刻报出来 (facba1ab6a)
- 🔧 기타:再摘 plugins-data 死副本 14 枚并登记退役锁(逐字节同 @ihui/shared;9fdbc207ba 带回) (180c244014)

**2026-11-09**
- 🚀 기능/개선:API 端点桥 5 枚通用工具 + HR 工具族契约化,并清偿门 204 两处 (7cc2a3c29a)
- 📚 문서:登记人事考勤自动化四期 HR-1..HR-4(机主 2026-11-09 定「放到计划任务里,现在先不做」) (e21c471fe6)
- 🚀 기능/개선:收口 CLI 路由→工具通用工厂(route-tools.ts)与 i18n 压缩产物重生成(sourceCommit 对齐 HR 提交) (6ad9467976)
- 🚀 기능/개선:补齐 CLI 工具族——HR_TOOLS 暴露 AI 对话框考勤操作 + hr_ 审批语义(agent.ts/permission/rules.ts 接入) (162d9a3d0d)
- 🚀 기능/개선:人事考勤模块隔离收口——attendance-core 共享内核/5表/幂等迁移/api路由服务/三端骨架(web·RN·小程序注册)/15文件i18n(41键) (fc2f61da6f)
- 🐞 수정:读准防线族 5 处 git 派生补显式 stdio(门 193 存量清零) (df08126dc7)
- 📚 문서:自动同步缺口账本到现读口径(镜像 256 · 缺口 19) (c098a539b8)
- 🚀 기능/개선:协议/考试结果/运行时面板等多屏共享化收编——RN/小程序/web 三腿同批 (fda837a1b4)

**2026-11-08**
- 📚 문서:记两枚悬空提交的归宿与门30a/写口判面不一致票 (2a7524687a)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>지린성 아이즈히후이 인공지능 기술 유한공사</strong> · 오픈소스 공동 구축, 우리 함께합니다</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->