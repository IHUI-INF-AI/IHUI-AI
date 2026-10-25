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
**2026-10-26**
- 📚 문서:terminal 帧三处接线收口 —— §7 第 4 项由 🟡 改 ✅ (c304de6373)
- 🐞 수정:补 windowsHide + 还原 next-env.d.ts 规范引用(门 52/50 HEAD 存量红) (61bdc87fe0)
- 📚 문서:D-07 记进展——根因在 llm.py 等待段 finally 当场 pop;落票面第二档(有界 TTL 账本+三闸+具名拒绝,零 wire 变化、单文件可 revert),代码已由 chore(auto) 收编进 07b4403797,pytest 两遍 125/125、mypy 0 错、ruff 通过;残余"端上可见"一格需跨端载荷键 ⇒ 保持未勾 (721b1df040)
- 🔧 기타:认领 L28812 端到端反馈闭环(goal-loop 席) (1e339afc6a)
- 🚀 기능/개선:补 status 公开状态页 web->RN 共享屏样板(全链路打通) (9986d2b676)
- 🔧 기타:守门8参数段82条逐条定性结清(席37自摘本席租约)——①判据错52(param 档合并 + 入桶 continue 排在消费位之前 + 3 条基址常量声明行) ②合法7(无登记位,写进必被 AJ3 判清单腐烂红) ③真缺陷23(主根因 /api/admin/:id 吞五条列表);全量档面=head 门 RC=0、读数未降、零消音;残余四组真工作随本行摘除由续座按现读重登 (b3dfce9a61)
- 🔧 기타:G-965 P2 进展注记(标头投影+强制档两项目标达成,A2=0;剩余缺口按分因口径点名) (1e933d35d4)
- 🔧 기타:G-395 结清并自摘本席租约——升档留痕臂+三值封闭 reason+层名单一真相源落地,apps/cli 209/209、typecheck 8/8、水印 4/4(枚 cfec8fda86);残余两格(tools/subagent.ts 未传 reasoningEffort、上游形状非本轮交付物)另立不塞回本行 (24d6458df6)
- 🔧 기타:门 250 接线留痕(AGENTS 点名 + 门体如实接线 + 根护栏按新 runner 重封存) (587764f561)

**2026-10-26**
- 🚀 기능/개선:G-965 无记录行分因出口(五档,判据全问既有单源)+ 同号旧键点名;不再只报总数 (45b03a543d)
- 🚀 기능/개선:E2E 自动补测·缺口发现门接进提交链(warn 档观察) (4d3c0f0b11)

**2026-10-26**
- 🚀 기능/개선:缺口发现尺子入库(新模块无对应测试的增量判据+射程清单;判据层生成物自述只认文件头) (c3905ac75e)
- 🚀 기능/개선:子代理档位链补"升档也留痕"臂 + 出处标签三面一致(G-395) (cfec8fda86)
- 🔧 기타:再重钉 ui-routes 产物(wallboard 输入随 67c9d0dac7 变;union 合并后复量) (3b5a4b34d7)
- 🔧 기타:守门8参数段82条逐条定性 挂牌认领(并发席37)——派单面 --exclude-inflight 从此让出该枚,防两席领同票 (d6fa9a290a)
- 🐞 수정:端内埋点改走共享 api-client 的 recordVisitLog(解守门 184 直连红) (67c9d0dac7)
- 🔧 기타:G-1142551 复量注记(门 105 G5 档:web 已重钉 matched,taro 被在飞删除阻塞 ⇒ 不翻勾) (1087a36315)
- 📚 문서:第 3 期·进化回流同题收敛为唯一保留行(删 2 条无注记副本/1 条未勾副本)+ 装车证据注记 (744a6d2087)
- 🔧 기타:重钉 ui-routes 产物自述钉(bi-dashboard/wallboard 输入在别席提交 95ca2af/0c0c764 后变) (2110ae45c9)
- 🔧 기타:D-07 与 端到端反馈闭环 两枚挂牌认领(并发席35/席36)——§24 修订后由 agent 代裁执行;--exclude-inflight 从此把两枚让给本席,防两席领同票 (5b7ceeceed)
- 🐞 수정:G-965 投影器物两处加固 —— 无侧车记录≠记录为空(不再摘真实归属标头)、owner 括号失配不投影 (6a2c360fcc)
- 🐞 수정:陈旧 refresh 副本按错误码分流,不再误清凭据 (aefd7d5e0b)
- 🚀 기능/개선:新增各端使用量面板(web/RN/小程序按路径前缀分桶) (ed04dfa525)

**2026-10-26**
- 🚀 기능/개선:message:terminal 终态帧贯通契约层→api-client→web store 投影(票71 切片 1/3,B02) (6a316c8559)
- 🔧 기타:G-395 挂牌认领(无牌→进行中@2026-10-25/goal-并发席34)——已派子席动 apps/cli/src/subagents 落点,按 §1 认领即租约,防两席领同一张票 (fbd9d7b83d)
- 🔧 기타:G-965 P2 投影器物加固落地(无记录≠记录为空、owner 括号失配不投影) + 第 3 批 1 条行内标头投影 (d11323e96f)
- 🚀 기능/개선:设备证明密钥对补全跨服务过桥链路——生产 Trae 号可自续(此前结构性刷不动) (bacf2d4173)
- 📚 문서:需求/异常自动发现器记进展(三源+调度已交付,余数据源素材面) (1386e45a48)
- 📚 문서:结清第 3 期·进化回流(两条同题副本一并翻勾) —— 席位提交 1f1f9508a7(10 文件 +1069/−18)已入 HEAD;主席自审:五套 59 例 pass 0 fail、四器件 self-test 全绿、git-guardian --check RC=0、受判据 19 臂全绿、水印 10/10。逐格处置:② 守门判据腐烂自检 = check-gate-rot 增差值档(--ratchet/--baseline/--write-baseline),guardian 6h 只喊新增,现读 284+22 项、存量腐烂 1 条(git-lock 路径已登记);③ 依赖升级自动票 = dep-advisory-radar 接 ticketWhitelist,guardian 24h --register,pnpm audit 257 条(35 critical/93 high)、80 可修、已出 3 票;④ token 双闸 = 前席已接并复跑放行;① 自动沉淀 AGENTS.md = 按 §24 代裁不做(门 207 预算 96,000 字节、现读 94,050,余量 1,950;把最高约束文档交给自动写入不可控),落选理由在此留档。两条无编号同题副本同时翻勾(昨次折并后被并集回捞,属 union 无编号行维的已知残余);剩余面:②符号级未覆盖(只判路径存在)、依赖票会派进 AI 会话、EOF 登记无幂等锚点 (59d2499138)
- 🐞 수정:补 lesson 候选稿合法性尺子,清 HEAD 门 98 悬空导入 (eea073ccd2)
- 🐞 수정:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (7eb5bc4174)
- 🚀 기능/개선:页面访问埋点接入(页面栈轮询上报 visit_logs,免改页面壳) (0c0c764393)
- 📚 문서:结清金丝雀发布票(观察窗+自动回滚已落地) (10dc45a19c)
- 🔧 기타:裸 git 派生基线 45→41(G-927 那族在飞迁移入库后按现读收紧) (ca701c4923)
- 🔧 기타:两张趋势图并排,压缩数据大屏纵向长度 (e30405a000)
- 🔧 기타:G-965 P2 首批 10 条行内标头投影落账(归属散文→标头,等价搬移) + 投影落地注记 (3ad96dca5a)
- 🚀 기능/개선:数据大屏新增近 7 日访问趋势(PV/UV 逐日)+ 页面渲染测试 (11fee56c8a)
- 📚 문서:G-24 记进展——回收器已落地(archive-gc 双上限+10代地板,镜像 11/11)但调度未接(HEAD 面仅本体与测试两处命中,git-guardian 无调用点);按 §0.9 保持未勾,残余=接线一格 (0e37914c0b)
- 🐞 수정:用户 id 失效(外键违约)时降级匿名重插,不再丢整条访问 (d365f2fe82)
- ♻️ 리팩터:G-54 第 5 轮 4 门 git 派生收口 face-reader (af6b584786)
- 🔧 기타:恢复被并发合并清理误删的访问面分桶测试(内容与原件 sha 一致) (06338cf4a5)

**2026-10-26**
- 🔧 기타:结清三端 ui-routes/离线包重钉(五钉 HEAD 面全 matched) + O6511 候选器交付与真源结构发现 + B02 terminal/resync 契约第二刀 + G-965 P2 投影器增强 (394e7717f6)
- 🔧 기타:重钉 web/taro ui-routes 自述钉(随 bi-dashboard 与 taro app/auth 输入变更重算,G-816040 四端现读全 matched) (09a79ced04)
- 🚀 기능/개선:新增 catBatchTypes 原语(G-54)并让 audit-decision-log 的提交存在性取材走层 —— 清型 C 自拼 batch 债务,判据语义不变 (894943173e)
- 📚 문서:结清 G-927(镜像棘轮:裸 git 派生的生产文件只减不增) —— 现读差集 0 枚(判据 headDerivationScan,对基线提交 14a04f013f 逐枚求差)。经过:上席已迁 1 枚(strip-banned-buckets,字节 4,705,595 EQUAL)、第四批 10 枚由 0ff78d7fda 整批迁完(本席复核逐枚裸派生 0 处)、本席再迁 2 枚镜像测试读真仓的裸 execFileSync(对照 512B/1088/53/346/261B 全 EQUAL),棘轮读数 71→70→49→46。逐枚复跑:6 绿(biz-day/guarded-write/identity/live-doc/readout/token-literal),2 红在射程外(ai-task 9/10 的 llm.py 裸 create_task、money 2/3 的 DeveloperConversationsScreen centsToYuan,系门 247/248 存量债,迁移前后同判),10 枚 --self-test 全绿,21 项新旧通道同 blob 对照 17 EQUAL + 4 项仅 core.quotepath 转义差异。如实登记剩余:① 现读 46 vs 基线 45 的 +1 是 scripts/audit-decision-log.mjs(7de326e39b,自进化票,晚于降档 1 分钟入库,型 A 1 处 + 型 C 自拼 batch 1 处)—— 不属本票射程,由该票席位迁移后回调基线;② HEAD 面 45 枚存量债(G-998191 族)按只减不增口径继续逐票收 (90a27b1e8a)
- 🚀 기능/개선:页面排行每行同时给 PV/UV(多少次/多少人) (95ca2af0fb)
- 🚀 기능/개선:页面访问埋点接入(React Navigation 切屏上报 visit_logs) (7cf9b2e8ad)
- 🐞 수정:WS 换票与小程序 SSE 接入 401 续期 (dba8f63d4f)

**2026-10-26**
- 🚀 기능/개선:三端 ui-routes/离线包重钉 + chat-sync terminal/resync 契约 + gate-grow 候选器 + G-965 P2 投影器增强 (fa9d1ad423)
- 🔧 기타:侧车 enrich 1 条(G-63 补 blocking),抽取器 --apply 现读 changed=1 bucketsDrift=0、回读 129 条 —— 由 seat-sidecar2 的 --check 点名的唯一一条待办,主席执行;门 234 复跑 state=warn(midform 3→0 / a2=0 / conflict=0 / blind=0),孤儿 80 条只报数 (6b942ede52)
- 🔧 기타:拆除 31 枚已退役零引用残影(deploy/cf-preferred-ip 2026-10-22 整链退役、qoder 探针退役、plugins-data 已下沉 packages/shared、零引用测试收口) (f80b0bb34e)
- 🔧 기타:中间态标头归一(门 234 midform 3→0) —— 三条机主面行(G-957 / G-329 / G-1182551)的行内标头带 ｜等:— 属未渲染完的中间态(语义已等价:parseHeader 读回 waiting=none、dispositionOf 同判),按 §1「标头是投影」归一成 renderHeader 产物形态;只动这三行标头,正文与归属语义逐字不变,三维守恒由 live-doc-edit 当场断言(上一版误带第四行被守恒拒落,已剔除) (f1439785cb)
- ♻️ 리팩터:audit-decision-log 两处裸 git 派生改走 face-reader.gitBinary()(G-54:棘轮新增拦截即修,行为逐字不变) (1c0938e1d3)

**2026-10-26**
- 🐞 수정:并集收敛按复合主键认"已处置权"——本侧已结清的行不再被滞后副本回捞成 open 原形态 (937fafb78e)
- 📚 문서:守门 89 R4 清偿 —— 四枚只读尺子/自检器点名入速查区(gate-rot/plan-truncated-rows/web-rn-screen-parity/miniapp-mirror-fidelity),接线面与退役口径一并写清 (d09bf0a749)
- 🚀 기능/개선:状态查询口同款 9074 自愈——与签到口共用 _rotate_device (b3fadcd296)
- 🐞 수정:数据大屏前后端字段对齐(修白屏) + 接入页面访问/来源埋点数据 (968b13a99f)
- 🐞 수정:门 234 A2 收口——投影等式三档化(中间态点名不判红)+ 抽取器同键冲突闸 (6d72f0164c)
- 🚀 기능/개선:AI 自进化调度层四件器物接线装车 + 登记出口补取号令牌/短 sha 守卫(O65 第 0/1/3 期) (1f1f9508a7)
- 🔧 기타:G-54 第4轮 —— 裸 git 基线 49→45(紧贴现读,不留余量;4 枚入库 cca944cc6a) (62f7d34699)
- 🐞 수정:补齐权限双轴本机记忆模块(HEAD 缺文件致 web 构建红) + 大屏使用数据面板渲染测试 (cbf3aa4329)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (59145cf2f0)
- 🐞 수정:探针取证面从单文件改为页面族 —— 修 71 条空壳的假阴性 (7c8d5b9e82)
- 🐞 수정:流式/AI 服务/raw 通道 401 自动续期 + RN/小程序主动续期 (831baf7200)

**2026-10-26**
- ♻️ 리팩터:G-927 第五席复核——票面 10 枚已由 0ff78d7fda 迁完(求差 0),本轮收口两枚镜像测试读真仓的裸 git (8d7cbb701e)
- 🚀 기능/개선:签到设备号 9074 自愈——换新设备号重签一次并持久化 rotated 标记 (529b9879d6)
- 🚀 기능/개선:安全停机状态机与 haltctl(自进化票:安全停机而非硬失败) (94751a0845)
- 🔧 기타:5 枚结清行被并集收敛回捞,按原凭据再结一次(G-62/G-01/G-03/G-07/O88)——回捞根因=declaredDropCaps 只认整行逐字而翻勾会追加注记,已记入项目记忆 (047f746b15)
- 🚀 기능/개선:金丝雀观察窗上线——源站直探量错误率/P95 与滚动基线比对,异常自动回滚 (9add3a32fe)
- ♻️ 리팩터:G-54 第4轮 —— 4 枚守门裸 git 派生收编 face-reader.gitRaw(按钮高度自检夹具/事件闭包/staged 取材/单分支 6 处) (cca944cc6a)
- 🚀 기능/개선:Trae 设备证明通道对齐并超越开源——产品线组合兜底(IDE_PC→SOLO_PC)+设备展示字段可覆盖+端点可覆写联调 (adf5ebc6d9)
- 🐞 수정:更正 G-962 参数段覆盖注记的转档计数——三轮转档实为 8 条(7 alive + 1 dead),13 条是笔误 (7feaa2d0a4)
- 🔧 기타:登记三端 ui-routes 自述钉与离线包钉重钉(承 G-1142551 复量) (3c281d1983)
- 🔧 기타:参数段覆盖 last-mile——4 条转 alive,最终 21 alive / 54 dead / 7 human-review(82/82) (9723b0c004)
- 📚 문서:第 3 期进化回流三副本收敛(两份同题副本结清,主行保留余面) (c458c8350b)
- 🔧 기타:参数段覆盖 human-review 二轮转档 5 条 + 记一条双端契约缺口(82/82 结论更新为 18 alive / 54 dead / 10 human-review) (8d9e7ff12a)
- 🐞 수정:补齐四处"消费方已入库、被 import 的模块却缺失"的断链(门 98 五处清零) (6b167b2a9f)
- 🔧 기타:G-54 型 A 基线 53→49(紧贴入库后现读,不留余量)—— 4 枚枚举面迁移已入库 7634c0cbb7b,HEAD 面现读 49 与钉数齐 (6f130e29e5)
- 🚀 기능/개선:旁路落地器对新建路径注入溯源水印(G-04) (247ca68459)
- ♻️ 리팩터:G-54 批次第 3 轮 4 枚枚举面裸 git 进 face-reader 层(check-i18n-namespace-passing / check-input-border-var / check-permission-mode-vocabulary / check-portal-fixed)—— argv/stdio/timeout/status 语义由 gitRaw 统一,判据零变化 (7634c0cbb7)
- 🚀 기능/개선:判据面不可变护栏(自进化票:不可变护栏) (62fc34e0a9)
- 📚 문서:结清 G-964 P1 与 decode 家族单源;G-1142551 记进展保留未勾 (5128ce1fd5)
- 🚀 기능/개선:人工阀清单与安全停机判据(自进化票:人工阀清单/安全停机而非硬失败) (1b22f3bb9b)
- 🚀 기능/개선:web→RN 缺口分诊探针 + 小程序镜像还原度门(两枚只读尺子,均不进提交链) (45dd89e4e4)
- ♻️ 리팩터:decode 家族 D2 9→0 折到共享 safe-decode-uri(9 处调用点)+miniapp ui-routes 产物重钉 (899f8c8871)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4f81fc23bd)
- 🔧 기타:G-54 型 A 基线 57→53(紧贴入库后现读,不留余量)—— 4 枚枚举面迁移已入库 3e8b864094,HEAD 面现读 53 与钉数齐 (12d2573ca2)
- 🐞 수정:access 过期不再 307 打回登录页，守卫认 refresh 并自动续种回跳 (c8815af713)
- ♻️ 리팩터:G-54 批次续迁 4 枚枚举面裸 git 进 face-reader 层(check-i18n-keys / check-i18n-messages-exist / check-z-index-guard / check-rounded-overflow)—— argv/stdio/timeout 由 gitRaw 统一,判据零变化 (3e8b864094)
- 🐞 수정:补入 D01 人设选择器整条依赖链 5 文件——修 HEAD 断链(干净检出 TS2307) (d5a27ded0f)
- 🐞 수정:收编 agent-picker/agent-notice-bar 两模块——修 HEAD 断链(干净检出无法构建) (442f00dad7)
- 🚀 기능/개선:大屏新增交互热度面板(事件分布/平均停留/热门点击) (578e038dcb)
- 🐞 수정:收编 agent-picker/agent-notice-bar 两模块——修 HEAD 断链(干净检出无法构建) (f07c4c0d40)
- 🐞 수정:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (29cb1e9aef)
- 🔧 기타:守门 8 参数段覆盖 82/82 逐条定性——余 49 条 = 7 alive / 30 dead / 10 human-review (27b860b725)
- 📚 문서:L28120 失败广播票结清(落点与双镜像在 HEAD,5/5 绿) (07a4f28cc9)
- 🔧 기타:G-54 型 A 基线 60→57(紧贴入库后现读,不留余量)—— 3 枚枚举面迁移已入库 9b7439eee1,HEAD 面现读 57 与钉数齐 (77e7e6d7aa)
- 🔧 기타:G-1222559 结清——索引面 PROJECT_PLAN.md 无暂存改动(git diff --cached 空),推送收敛 origin=PUSHED,滞台副本形态消失 (98967f3831)
- 🔧 기타:票→提交环读侧 round-trip 镜像(正证可选绑票键,缺席不写空串) (6adfb2909b)
- 🔧 기타:G-1222556 结清——CSRF 的 Gemini ?key= 载体已由存在性豁免改为 hasVerifiedApiKeyCarrier 验真(三载体逐个交 isRegisteredUsableApiKey,fail-closed),票面三选一的『实证验真』已由更前置一档满足 (cf50864de4)
- 🐞 수정:G-54 批次 3 枚裸 git 枚举迁 gitRaw(check-brand-foreground / check-rounded-full / check-capability-catalog)—— 型 A 存量 60→57,自检与全量行为面等值 (9b7439eee1)
- 🚀 기능/개선:大屏新增页面访问热度面板(TOP 页面 + 前台/后台/登录页使用量) (344cda7701)
- 🔧 기타:G-858 结清——union-converge 镜像 58/58 全绿(登记时 10 红→接手 1 红→0),根因两套口径相反已由 0a3defae5a 收口,三套镜像+端到端探针作证 (a2f356e63d)
- 🐞 수정:通配归档占位不构成移出凭据——修 union-converge 唯一那条镜像红 (0a3defae5a)
- 🚀 기능/개선:全站页面埋点补齐后台/登录页 + 访问统计前后台口径与页面使用排行 (9cde533655)
- 🚀 기능/개선:收编失败席半成品——G-395 配置分层出处标签(source + sourceRevisions) —— 该席撞今日用量上限停摆;主席自审:apps/cli 跑 subagent-precedence + subagent-precedence-flag ⇒ Tests 83 passed。落点 precedence.ts(+140)与 types.ts(新增 RevisionUnavailable='no-file-source'|'stat-failed' 与 SourceRevisions=Record<PrecedenceLayer,LayerRevision>):每个生效配置对象带 source 标签、快照带 sourceRevisions,四层短路优先级与生效值零变化。未完成面:sourceRevisions 的生产消费者与'取不到⇒null 不冒充'夹具,该席未及交付,已记入残余清单 (de2f6504dd)
- 🚀 기능/개선:O6505 三源适配器(api-logs/grafana-alerts/user-feedback)+签名归一+聚类阈值+dry-run (58d7f4fcee)
- 🚀 기능/개선:Trae 上游服务器自续票(设备证明)——桌面渠道签发的票由池自续,不再依赖本机客户端 (3f5fd52be7)
- 🐞 수정:收编失败席半成品——归因层差分面按提交面取材(commit-gate-attribution +70/−?) —— 该席撞今日用量上限停摆,主席自审:node --test scripts/tests/commit-payload-attribution.test.mjs ⇒ tests 18 pass 18 fail 0。改动面=归因层差分复跑不再读'还原后的索引',避免并发共享索引里的历史 blob 把无关提交钉红;未完成面:该席未及补'取不到面⇒未判定'的第三条夹具,已记录在残余清单 (fba4ed7968)
- 🔧 기타:r5 认领自进化两票(金丝雀发布/需求与异常自动发现器)——牌插在复选框后,正文一字未动 (4277abb873)
- 📚 문서:G-964 更正注记重新落账(上一步为消 union 双行先对齐成远端同文本,事实一条不丢)——三件载体现读全在仓,残余改为存量迁移 101 枚+72 条孤儿 (bdb6bef481)
- 🔧 기타:登记 Trae 服务器自续票(设备证明)已完成(未取号:号池满) (79cb796af5)
- 🔧 기타:撤回 G-962 批15 的 20 条参数段覆盖裁决(按陈旧守卫出口②显式放行,删的是本席上一枚自己加的条目) (29dd4876f8)
- 📚 문서:r5 自进化四票进展注——代码已交付(56855eb75f:自治决策模型/决策链审计/E2E 补测器/经验写回腿),未接线格逐条点名,租约保留不翻勾 (85788c457e)
- 🔧 기타:G-964 行文本对齐远端同文本(消除活文档 union 双行:F4 0→1 的机械成因)——更正注记随后单独落一次,事实不丢 (489ce34618)

**2026-10-26**
- 🐞 수정:G-927 第四批 10 枚裸 git 派生迁入 lib/face-reader(gitRaw/catBatch)—— 棘轮 HEAD 面 70→60 与基线 60 对齐;check-cross-end-screen-coverage 正文同时改走 catBatch/readWorktreeFile 满足门 118 取材面纪律 (0ff78d7fda)
- 📚 문서:G-964 行内更正——『侧车抽取器与新守门未建』已不成立(三件载体现读全在仓 36,986/27,192/24,595 B);残余改为存量迁移 101 枚 + 72 条孤儿记录治理,凭 check-plan-fields 末行 state=warn stock=101 orphan=72 (491c8b3321)
- 🔧 기타:F9 双档两枚结清(G-455/G-681)——判据已收窄到声明位口径,现读 --gate F9 存量 0 组、宽口径 0 组、引用图 0、差值 F9=0 无 ❌ 行 (620d74f861)

**2026-10-25**
- 🐞 수정:修复预存 typecheck 错误以通过推送门（App/ModelConfigDialog/TokenValueScreen） (7d0831bc66)
- 🐞 수정:摘除被 chore 收尾提交复活的死测试 organization.test.ts(恢复 d35827d96c8 的摘除决定;该文件 import ../organization.js 解析不到任何文件,是 HEAD 上全量 typecheck 唯一报错文件 ⇒ 阻塞所有推送;全仓仅此文件引用 organizationRoutes) (ccf42c74ff)
- 🔧 기타:收尾提交本地未提交改动（registry-sync / qoder 桥接 / 移动端与 Web 插件 / 部署脚本 / 文档） (821ce8e621)

**2026-10-26**
- 🚀 기능/개선:自进化四票真代码交付(自治决策模型/可审计决策链/E2E 自动补测/经验写回腿)—— 判据单源(autonomy-policy/decision-chain-sources/e2e-autofill-map/lesson-writeback-policy 四份 json),测试 import 源脚本零复制;自测 21/9/37/12 组全绿,node --test 四套件 48/48;两枚缺水印文件已补注入;未接线格(受锁 runner 注册与 auto-evolve 排期调用)留进展注不翻勾 (56855eb75f)

**2026-10-25**
- 🔧 기타:并发席零改动结清 21 枚(前提现读已闭,证据注记随行)—— web 五票(hit-target/59./60./真机走查/G-60)+ 脚本六票(号池到期/合流盲区/G-960)+ cli·deploy·ops 四票(WP-7/G-109/P2-13③/G-1222561/G-74/D42046)+ 自进化已交付五票 + 第1/2期无号副本回潮复结 (20d9d96a48)
- 🔧 기타:59. 消息级版本切换三段(1/3 sibling 存储 / 2/3 MessageVersionMenu / 3/3 回调坐标透传)零改动结清——三段落点与回归测试现读齐备 (9ff5da17df)
- 🔧 기타:O65 P0 四票(O6501 根护栏/O6502 成本熔断/O6503 隔离+原子回滚/O6504 人工阀)与 G-60 窗口化五票零改动结清——器物与部署环接线现读在位,自检 9/13/9+7/12 组全绿 (003a77eb76)
- 🔧 기타:r5 认领自进化四票(自治决策模型/可审计决策链/E2E 自动补测/经验自动提炼)——牌插在复选框后,正文一字未动 (ef7123a5f4)
- 🔧 기타:G-274 与 G-107 两票零改动结清——票面前提逐条现读已过期(门 233 已 blocking 接线且生产 importer 4 枚;recovery-gate 已进 sse barrel 且经 stream-authority/client 逐帧消费),证据注记随行 (188fe19586)
- 🐞 수정:G-962 批13——BP 腿前缀假设可见键 10 处逐条裁决 dead,未判定桶 17→7 (9854d851e1)
- 🐞 수정:门 234 A2 误判收口——侧车标头定位单源化(locateSidecarHeader),strip/parseHeader/门的 headerOf 同一把尺 (86085c636e)
- 🔧 기타:F11 回潮行摘"需拍板"措辞——非会话401票归属照旧(api鉴权面+api-client两侧持有者),票保住不被禁令清扫器吃掉 (50d8737b2a)
- 🔧 기타:health 分叉同题两枚结清——web 健康页现读改走 /api/admin/monitor/services 的 {list} 信封(头注 L7334 结清在案),服务端同形 success({list});/api/health 裸对象契约按原方案不变,对外契约未变更 (0d4bd0747d)
- 🚀 기능/개선:O65 第 3 期第三件 —— 依赖安全通告雷达(实跑 257 条/35 critical,80 枚可修候选)+ 第 3 期进展注记刷新 (5732b6bb28)
- 🚀 기능/개선:锁定 order-log/order-track/message-group 令牌主体与 vip-compare 公开脱敏 (b5c3d62f14)
- 🚀 기능/개선:O65 第 3 期回流两件 —— 失败票归因沉淀器 + 守门判据腐烂自检(自检 7/7 与镜像测试 12/12 全绿) (6567fd5730)
- 🐞 수정:Step 5 载荷判据改为「实到 == 预期且预期非空」,空提交不再判绿 (3bdcc09dca)
- 📚 문서:O65 第 3 期进展注记 + 第 2 期重复登记收拢(仅留一条 [x] 完成行) (74fd1f1630)
- 🔧 기타:G-1222557 复验结清——出口围栏的存量维真跑 15/15 绿;另补记 D04/G-934 两枚的真浏览器凭据 (534682513b)
- 📚 문서:O65 P0 四件翻勾(正式编号 O6501-O6504)+ 第 1 期感知层自动分诊器翻勾 —— 交付件已入 main 并随 8486d01ddab 上生产 (4e74314d70)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b801d2d8f9)
- 🔧 기타:G-927 进展注记——求差实证新增12枚中10枚已由别席迁好待入库,agent-worktree/green-state 两枚本席迁讫(gitRaw层,行为面等值,自检9/7);棘轮70随入库递减,基线60不动 (8a8ffefbd6)
- 🐞 수정:G-927 迁移批——agent-worktree/green-state 两枚裸 spawnSync('git') 改走 face-reader 取材层 gitRaw(绝对路径git+quotepath+safe.directory+timeout+EBUSY兜底),包装函数折回原三态行为面逐字段等值;自检9/7全绿+--list行为面真实返回;求差实证:12枚新增中10枚已由别席迁好待入库(盘面0命中),本批迁余下2枚,棘轮70→随入库递减,基线60不动(下调前置=10枚入库) (a9505b2596)
- 📚 문서:结清 3 枚(第 12 批:G-272 重臂复位分域 + 门 149 端内 barrel 两条同题) —— ①G-272 席位提交 34828b1db3a5d531b26b06fbf8d20d79fee28f1d:前提现读更正(stopInitiator 在 HEAD 有 15 处命中而非票面 0,该字段已由 G-816026 落地;rearm/重臂/复位仍只命中注释 ⇒ 注释声称有实现没有成立)。实现 apps/cli/src/tools/background-registry.ts 新增 BACKGROUND_TASK_REARM_FACE(preserve/reset/renew 三档,satisfies Record<keyof BackgroundTask,…> 编译期穷尽)+ rearmBackgroundTask(previous, incoming):身份面逐字保留、结算面回构造初值、新生面换代,四档拒绝(not-terminal/id-mismatch/generation-not-renewed/not-live)原样交回旧条目,fail-closed。主席复跑 apps/cli/tests/background-rearm.test.ts ⇒ Tests 6 passed,含变异自证(注释掉 command: previous.command ⇒ 仅用例①红)。剩余面:rearm 暂无生产调用点(registerTask 每次 genId),未来接入时事件处理器必须绑到 rearm 返回的新条目。②门 149 端内 barrel 两条同题行一并收口:席位提交 443561b82c 新增 scanAppBarrelLeaks 与桶/实现分离单源 isBarrelModule,端内桶 universe 由该层目录扩到端内全树;主席复跑 --report 末行 APP-BARREL-REPORT barrels=36 apps=5 consumers=34 hits=0 type=0 elsewhere=0 undetermined=0(存量 0 + 阳性对照 ⇒ 并入既有 --staged 差值棘轮而非升绝对 blocking,符合 §12e 升档前置=存量归零) (00d8db8283)
- 🔧 기타:A 类 7 枚结清(G-62/G-01/G-03/G-07/O88/G-272/双重执行)——凭据全部本席现读复跑:gate 全零、twins 0 组、CI 唯一 failure=lint-typecheck-test、stopInitiator 20 命中、take_loop_v2_handoff 9 处消费面在位 (1e57d5d821)
- 🚀 기능/개선:门149 补齐端内 barrel 漏出口(桶/实现分离 + 端内全树 universe + --report 只读量算) (443561b82c)
- 📚 문서:结清「非会话 401 被当成会话死亡」 —— 按 §24 机主令本应由 agent 代裁,现读发现源头已由 2026-10-25 的 L7648 修复落地:apps/api/src/routes/agent-extended.ts 的 preHandler 兜底由 `err.statusCode ?? 401` 收窄为 `?? 502`,行内注释明写「没标 statusCode 的异常是内部/上游故障,盖 401 会被 api-client 读成重新登录(上游 provider 凭据错误 ≠ 会话死亡;口径同 auth.ts 票 G-396/G-765/G-357)」⇒ 用户不再被误导去重新登录。客户端侧 packages/api-client/src/client.ts 仍是 `status===401 && !isAuthEndpoint(url)` 才判会话死亡(两处),由于非会话错误现在以 502 出栈,该启发式不再被误触发;如实登记残余:若将来有上游把第三方 401 原样透传成 401,仍会被读成会话死亡,属纵深防御缺口而非本票未完成 (ba06930d36)
- 📚 문서:结清票60 真并行多窗格(服务端 fork 腿收口) —— 席位提交 5e72a6df8b 共 5 文件 +942/−50;主席自审复跑 apps/api 三份用例(chat-fork-branch-endpoint + chat-fork-branch-queries + chat-actions)⇒ Test Files 3 passed / Tests 24 passed(席位另报 conversation-archive 11 例,合计 35)。关键事实更正:服务端分叉并非不存在,而是早已以 POST /api/chat/conversations/:id/branch 命名存在(chat.ts,2026-08-30 立;V3 按 fork 关键字 grep 未命中属命名差异)⇒ 按 §0.6 不新开 /fork,改为把既有端点按票面口径收口:响应返回新会话 id + fork{sourceConversationId, forkedFromMessageId, sourceRootId, sourceSiblingIndex, messageCount};复用票59/64 的 parentMessageId+siblingIndex 族根判定并抽出纯函数 linearizeForkHistory(每族只留一版,分叉点必胜);鉴权只取 request.userId(body 自报 attacker 仍以真实主体入 queries,他人会话 403 且 branchConversationFrom 零调用,越权插入/更新计数 0);幂等用 clientRequestId 在源会话 FOR UPDATE 锁内查询,重放返回首建会话 replayed=true 且计数不增,键撞别的分叉点 409;复制以 .returning({id}) 回库确认,不符整批回滚。未判定:真库端到端(.env.test 不存在、PG 仅 5432)⇒ 四格为离线 mock 链。剩余面:客户端(api-client/web/RN)需透传 clientRequestId 才吃幂等 (b55f46c8b5)
- 🐞 수정:后台任务重臂按结算面/身份面分域复位(G-272) (34828b1db3)
- ♻️ 리팩터:rules 族本地 api 壳迁至共享出口 apiOrThrow 并摘零消费方壳文件 (ea570fc43f)
- 📚 문서:结清 2 枚(第 11 批:G-115 真分叉 / 第二个死端点簇) —— ①G-115 按 §24 机主令代裁并执行:不再等"谁在哪个窗口收敛",直接用仓内既定出口 node scripts/git-sync-converge.mjs 走索引层 union 合并(零触碰他人未提交文件),合并枚 f8c25b537b;现读 git ls-remote origin refs/heads/main = f8c25b537b07a68d9daea4d6a231e7d840441b83 = git rev-parse HEAD,git rev-list --left-right --count origin/main...HEAD = 0 0 ⇒ 部署环的"远端 tip 分叉且自动收敛无效"根因已消除。合并后回潮审计:本会话 23 枚结清行零回潮。②第二个死端点簇按席位二段式复量收口:六条(agent-reviews/wallet-bank-cards/messages-chat/course-annex/course-qa/course-resource)全部已有等价端点且在 HEAD——agent-reviews GET /api/agent-reviews、wallet GET /api/wallet/bank-cards(插件级 requireAuth)、messages GET /api/messages/private/list 与 POST /api/messages/private(checkAuth,senderId 取承载层 request.userId)、课程三屏走 GET /api/resources 与 GET /api/edu/qa 且 RN 屏已改指;阳性对照 invited-users 4 文件 7 行证明尺子有牙;零新增端点(重复造会与既有端点漂移)。受影响用例 Test Files 2 passed / Tests 14 passed。剩余面如实点名:order-log/order-track/vip-compare/message-group 四词另计;BankCardScreen 库无 bank_cards 表(无表可取)、三条课程屏缺 courseId 维度 ⇒ 产品语义缺口,非端点缺口 (fb77aa60b8)
- 🚀 기능/개선:帧名单源收敛到 CHAT_SYNC_EVENT_NAMES,sse 契约只引用不重写值 (54748ccdfb)
- 🚀 기능/개선:会话分叉端点收口(票60 服务端余格)——复用 sibling 版本族 + 幂等键 + 计数诚实 (5e72a6df8b)
- 📚 문서:O65 补回正式编号 O6501-O6513 + P0 四件翻勾(O6501-O6504) (4f2f9c8176)
- 🔧 기타:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (caee7106db)
- 🚀 기능/개선:O65 P0 安全护栏四件 —— 根护栏/成本熔断/影响面隔离与原子回滚/人工阀清单 (9caeac97d5)
- 🔧 기타:结清 G-941(成本账本按链别归一,249 passed+ruff+mypy strict) (a34df2bf63)
- 🔧 기타:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (c8f2750a5c)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ca97133f4f)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (90c0862194)
- 📚 문서:G-957 行内失真路径就地更正(票面挂点 login.tsx 已随 2026-10-23 定档删除/回传腿已由 webview onMessage 接管/scheme 已登记)+残余两格点名;主键·归属·租约三维守恒由 plan-task-index 当场断言 (3af96ef954)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ef3c8e667)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c98968e83)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8b9c604c8)
- 🔧 기타:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (864c743fac)
- 📚 문서:结清 79/B03 权限双轴化(运行时真接线) —— 席位提交 7f850459839024c3333ee5acb38fa75dc2aef774 共 12 文件 +1247/−53。主席自审复跑:apps/cli 三份新/改用例 permission-axis-runtime + sandbox-strict-default-on-missing-config + sandbox-profile ⇒ Test Files 3 passed / Tests 59 passed。落点:packages/types/src/permission-axis.ts(判定本体 evaluateAxisGate + granular 五布尔 + 归一化)、apps/cli/src/sandbox/permission-axis-runtime.ts(装配优先级:显式 > config profile > 五档映射 > 契约默认)、apps/cli/src/tools/index.ts(ToolContext.permissionAxis + executeToolCall 轴闸,覆盖 hub 分支)。默认值现读:SANDBOX_MODE_DEFAULT=read-only、APPROVAL_POLICY_DEFAULT=on-request、生产装配 DEFAULT_SANDBOX_PROFILE=limited ⇒ workspace-write(绝非 danger-full-access);未知值一律落 read-only/untrusted 并 warning(fail-closed)。单一真相源:三值/四值/五布尔仅存 types 包,CLI 零副本;check-declared-policy-has-consumer 与 check-permission-mode-vocabulary 均通过。剩余面如实记录:交互确认窗未真机走查、CLI 暂无 --sandbox-mode 旗标、loadSettings 不执行 layer-policy 项目层过滤(既有缺口与 sandbox 键同型) (823794e403)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (286ee41245)
- 🔧 기타:结清 G-863(附件容量改提交式CAS,18/18 绿) (8f39ff5ab8)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (02758036ef)
- 🔧 기타:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (7589a3fa87)
- 🚀 기능/개선:权限双轴运行时接线(79)+ 沙箱默认严档运行时强制补齐(G-212 第十一批 cli 半) (7f85045983)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8486d01dda)
- 🔧 기타:tmpdir 族 90 副本同据终清(折并器上限外交人工:票已结清,check-fixture-tmpdir rc=0 同据,全部副本翻勾即终态) (8115eb8c5c)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4f0075f311)
- 🔧 기타:结清 D22046(通道②③+比对驱动未变化承诺,cli 49/49+tsc0) (477ab648bd)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c248511bdd)
- 🔧 기타:G-212 结清——两侧齐(cli 半 goal-r57 严档+ai-service 半已自落本轮现跑 15 passed),翻勾条件成立 (c797e033c4)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af71cd1e10)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29c73b7469)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d6da34226)
- 🔧 기타:G-620 结清——两道 blocking 红(门150/门90)本轮现读全部转绿(桌面事件三层闭环通过阻断 0),跳门前提不复存在 (9b816186f3)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ea059635d)
- 🐞 수정:next-plan-id --check 重号判红改差值棘轮(存量只报数/新增才判红)—— 承 G-955 收口 (f6b9df39ba)
- 🐞 수정:G-957 网页授权回传腿失败态如实提示(换票失败/异常不再静默) (d47a2842a3)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d922ea918)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b546442d02)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9e49a4b02a)
- 🐞 수정:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (e48584bd7e)
- 🔧 기타:清偿叠注记存量 46→2(9 行折并,行数与勾选/租约/归属三维不变) —— 折并判据不另写:直接 import 守门 13d 自己的 noteTokensInLine / redundantNoteCountInLine(§0.6 单一真相源),对同一行内逐字相同的注记保留一份、删除多余份;全量档现读 叠注重数 46 → 2,残 2 份属承载段分词形态(判据计入但字符串面找不到第二次逐字出现 ⇒ 如实留报数,不猜不改)。本枚只动这 9 行注记文本,复合主键与正文语义逐字不变;门 13d 复跑 RC=0(差值档,存量只报数) (beaba75247)
- 🐞 수정:补齐漂开族折叠通道(--fold-drifted-families)的两处形状锁 + 补镜像测试 (36d800cb53)
- 🐞 수정:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (4c155346b0)
- 📚 문서:结清 G-926(lint-staged 已跟踪却被 ignore 的雷区)—— 席位提交 2c9d023f4b;主席自审复跑 node --test scripts/tests/lint-staged-ignored-tracked-ledger.test.mjs ⇒ tests 14 pass 14 fail 0。现值现读:[tracked-ignored] 面=head 存量只报数 12 条,git ls-files -ci 同为 12 且全在 .ihui-agent/archive(11 md + 1 json,唯一命中 .gitignore:186);票面 84 枚里的三族已由 41a3bdeeb4(取消跟踪 tmp 61 枚)、a402f50043(删 articles 宽式忽略)、8c952aac27(为 plugins/*.cjs 加负向例外)收口,故判 closed-by-others 未重做。archive 那 12 枚是门 71 archivedCopy 的归档凭据(读 HEAD/索引树),摘掉即削正当删行的依据 ⇒ 建议退跟踪 0 枚。另修一处恒红口径:旧 T7 把命中根 glob 记成失去 lint 覆盖,而 .prettierignore 早已整目录忽略 .ihui-agent/,64 枚系双计;新口径只问工具本体 prettier.getFileInfo(不另写 glob),限额 50 与给源码目录塞黑洞出口件必红的语义都不动,并加了正探针。三臂真 lint-staged CLI(--diff=HEAD,scratch 夹具):absent 报 git error、tracked 正常 Done staging 且索引 blob 未被改写、untracked 同 absent。剩余面:门 236 豁免按目录前缀放行,将来 git add -f 塞进 archive 的新件会被放行(动豁免语义需另票) (c683c71b8d)
- 🐞 수정:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (56227f8b33)
- 🐞 수정:为 gate #193 补 8 处 git 派生调用的显式 stdio (15372e4aba)
- 🔧 기타:api<T>234 迁移回潮副本同据复翻——goal-b15 S10 已结清(349e116a66+b3b3f64276),本轮同据复验一致 (59a3a90a56)
- 🔧 기타:结清 G-876/D195/G-937 三枚(注册验码/通知归档流/归档器B档,均带真跑证据入行) (3b1a29df96)
- 🚀 기능/개선:违禁桶兜底清扫器 strip-banned-buckets——两道机主禁令(等条件F12/待拍板F11)的执行器物化:guardian巡检轮 sweepBannedBuckets 派发(5min节流),自动摘HEAD面两桶未勾行并留痕f12-purge;判据import单源零复算;SWEEP-RESULT三态;镜像7例(留痕在落地之后/走object-space-land不自带CAS/已勾不进射程/scrub消费端对齐);AGENTS禁令条补点名+复翻席纪律(复翻须同步摘形态);自检5组+镜像7/7+eslint 0 error+clean态派发实测正常 (41988c0b3d)
- 🔧 기타:G-962 结清——高置信族逐条现裁全过时(computer-use 在册/announcements 公开族/members/groups/browser-sessions ai-service 全族/organization.ts 已亡),门 8 现跑通过;余参数段未判定=判据能力边界非死调用 (34ba9ee749)
- 🔧 기타:G-937 结清——根因已于枚 0b1d98107c 修复(seamArchiveChunk+§22c 镜像锁),归因档 c038a654db 为 HEAD 祖先,修复当日 113e612833 落地归档 24 枚;self-test 63/63+镜像 39/39+--list-blocked RC=0 现读,本行属门 239 型已归档票复活副本 (0d3969e1c1)
- 📚 문서:结清 dot-source 新鲜度维(第 4 批 1 枚) —— 席位提交 14a93e75b8032e067906e7c5cd750fd546bacbc2 只动 check-service-binary-paths.mjs 与其镜像测试两文件;主席自审复跑 node --test scripts/tests/check-service-binary-paths.test.mjs ⇒ tests 32 pass 32 fail 0。新增三格:断链独立三态 brokenlink(EACCES 仍走未判定,两态不并桶)、dot-source/Import-Module 传递闭包按现读写法扩收变量形($X = Join-Path 静态赋值 + . $X,RHS 非静态仍点名不猜)、每服务 fresh/stale/断链/未判定分桶入 renderText 与 totals。本机 nssm 不在位 ⇒ 现读 未判定 3(IHUI-AI-SERVICE/IHUI-API/IHUI-WEB),按 §0.3 不顶绿;真服务链上 stale/断链臂需有 nssm 的机器现读,属剩余面非本票射程 (ee2fc177e6)
- 📚 문서:结清 G-1222560 危险登记(索引面三份 web 语言包坏 JSON)—— 复跑取面:git show :packages/i18n/messages/web/en.json|JSON.parse=OK、ja=OK、ko=OK,HEAD 面五份亦全 OK ⇒ 他人暂存的坏索引现场已消失;该行正文自我嵌套 4 层副本并入注记+3 条同题原号指针,属票面腐烂,凭据以本枚现读为准 (a88a00a74d)
- ♻️ 리팩터:face-reader 判据符号单源化——BARE_GIT_RE/bareGitCountOf/hideComments 三符号自 face-reader.test 内闭包搬入 lib 导出(test 改 import,逐字零语义,G-927 同尺差集工具取材用;35 例面 34/1 棘轮红系他席在飞 G-927 收口的 10 枚新增待其落地后自然回落) (05a18375b9)
- 🐞 수정:服务新鲜度维收口三格(seat-svcfresh,G-1080903 回捞副本续)——断链独立三态 + 变量赋值 dot-source 解析面 + 每服务分桶现读 (14a93e75b8)
- 🔧 기타:G-955 复验结清——取号入口实测可用(next-plan-id --check 真RC=0) (7930521657)
- 🐞 수정:摘除指向已删路由 organization.ts 的死测试——HEAD 上该测的 import ../organization.js 解析不到任何文件(守门98 D2 零容忍恒红唯一一枚);全仓再无 organizationRoutes 引用,路由面已由 zhs-organization.ts 承担;与工作树既存删除(D, 他席在飞)同一处置,本次只把它材料化,不新建替代 (d35827d96c)
- 📚 문서:结清第二批 4 枚(工作已在 HEAD 或本批席位落地)—— G-343 / G-880 / G-32 / G-934 (c11e24d5f4)
- 🔧 기타:独立席四票复验结清 D04/G-934/G-924/G-239——票面自写判据逐条当场复跑,零复算 (7b562d0477)
- 🐞 수정:G-880/G-32 收口核验+成对自检补锁 —— 两禁令门(emoji/shared-layer)迁面与加固判据经现读确认已随 a6c7cb36ec 入 HEAD(listFaceFiles 按面枚举+readSources 同面取材,门内零 readFileSync);本批补票面硬要求的两把缺失配对锁:三面同形干净仓⇒三档全0(防恒红,W10 型)与 --staged/----worktree 两面旗同给⇒main 返 2(§0.4 互斥)。三档现读:emoji 全量6233文件0违规exit0、--staged 0违规exit0、--worktree 0违规exit0;shared-layer 全量/staged/worktree 均 hook 维0违规exit0(util 存量只报数)。镜像测试 emoji 17/17、shared-layer 12/12;check-gate-wiring --strict exit 0 (390d395038)
- 📚 문서:O65 自进化 13 任务补正式编号 O6501-O6513(以 HEAD 为底稿恢复回潮丢行+编号派生侧车键) (702373ef97)
- ♻️ 리팩터:G-343 DRIVEROOT 族残余清零(票面四处全数核对)①②已由 852c9409 收口(audit 私有 devEnvRoot()/pgBinDir() 与失真头注、app-reads:56 硬编码盘符推导现读复验=族内生产文件仅 import lib/psql-client-locate 单源,无第二份推导);③现读补出=pg-restore-drill.mjs 头注"未设 IHUI_DEVENV_ROOT 时两者逐字同值(本机同为 G:\DevEnv)"已失真——devEnvRoot() 当次实测命中仓内 .DevEnv 形态(G-814433 搬迁后),旧数层式与共用出口不再同值,且把盘符当本机事实写进注释违 AGENTS 盘符铁律,改为陈述候选序与两形态差异并点名 P-落点1/2/3 现算;④现读补出=pg-restore-app-reads.test.mjs:49 在测试里重算 IHUI_PG_BIN_DIR||join(devEnvRoot(),...) 第二份 pgBinDir 判据体(§0.6/§22c),改 import ../lib/psql-client-locate 的 pgBinDir() 与工具同源。复跑凭据:audit --self-test rc=0(取证在镜像测试)+ audit.test 连跑三次 59/59 pass;app-reads.test 8 pass/3 skipped(未判定:psql.exe 不在位,环境闸按设计);drill.test 29/29;守门45 check-c-drive-paths 全量档✅、check-workspace-hygiene HEAD 面✅无新增违规 (caef8d065d)
- 📚 문서:维③ 头注实测数改正——70 份叠注里 49 份在承载段内、21 份落活文本(此前误写 72/51);纯注记订正,判据字节未动,自检仍绿 (9129d9253e)
- 📚 문서:结清 7 枚僵尸票(活已在 HEAD、行未摘)——分割线 G-877、判据盲区 G-879、原生弹窗 G-878、MCP stdio 四票 G-689/G-691/G-692/G-694 (6c6efc415b)
- 🔧 기타:G-874 结清——web 注入两调用点+共享按钮消费+login 族 30/30 绿;原生 WebAuthn 免依赖方案优于票面;未注入不渲染=平台豁免成立 (0cd4af3484)
- 📚 문서:O65 侧车键由 自进化# 收敛为编号派生 O65xx#(13 条) (62a6546229)
- 🔧 기타:G-957 剩余格改归属机主小程序后台白名单面(正规改桶通道 LIVE_BUCKET_RECLASSIFY,actionable→owned-elsewhere;格②已入库凭据在案) (6dbb495b4d)
- 🔧 기타:G-63侧车重钉(union带回旧记录终修),A2归零 (f3fbf0bbba)
- 🔧 기타:G-934 结清——出路①接线三轮凭据在案(47dc360911 实体测 13/13 本轮复验+56cc4a66f4+847925be2b)+§17 真浏览器核验已落(82c9a68ae0 四例两轮绿);10 红前提过时 (80f8fb9f23)
- 🐞 수정:维③叠注存量归零——判据剥「副本正文并入·承载整段」平衡段(逐字引文非活注记,72→21),活文本按逐字同串摘 21 份(L5361 x1/L28173 x18/L28911 x2,只删同串不并族);自检10/10、镜像14/14、行数/勾态全等 (75d303394e)
- 🔧 기타:G-876 结清——实现已在库(code 必填+503 fail-closed+用途锁+防枚举,枚 9e103ac0f6),G-81 席复验 auth 1311 全绿背书 (217be03c9f)
- 🔧 기타:F4末2组收口——O-02摘旧底稿裸行(正主带租约+③格注记)/G-116摘旧句(正主标头规范),留痕f12-purge (6309556402)
- 🔧 기타:F4四组+跨号副本收口——G-1222558错号/G-937裸副本/G-10旧句/G-11旧句/B02旧副本各摘副本侧留正主(留痕f12-purge);union回潮体清偿末批 (32b2a83941)
- 🔧 기타:G-963 结清——修复已落库(测试文件 G-963 注记在案),现跑 f9 族 10/10 绿零 ERR_MODULE_NOT_FOUND (eac4da4f06)
- 🔧 기타:G-74 远端合流回潮体复翻——并发席已结(d5cce09f8c 校验收口+sponsor 地址在案),配置面余格归机主面行承接 (9b66a50d77)
- 📚 문서:O65 自进化战略方案文档 + 13 条派单侧车记录 (76f6b4891c)
- 🐞 수정:补回索引迁移时误删的三门点名(守门89 R4)——check-ai-task-background-reference(247)/check-money-display-single-source(248)/check-registry-sync-health 只存在于被删的旧副本里;91,095→91,589B(余量 4,411),标记仍为 0 (af3da98e1c)
- 🐞 수정:摘除门249内联点名行——README 索引节已收录该门(4165487e5a),R4 文档面由 README 承载;AGENTS 91,293→91,145B(余量 4,855),冲突标记保持 0 (09498f86d2)
- 🔧 기타:远端合流回潮第三批复翻 4 行——G-76 守门39(83aa572b23e)/G-38 视觉票(r3c)/D42046 巨行(603d8236d8f 同据)/G-60 content-visibility(522ac4dac2+回归锁 7413f9fd31);凭据全验祖先 (a2dab37433)
- 🐞 수정:修复 union 冲突标记注入体并摘除回潮索引副本——108,200→91,293B(余量 4,707);标记区取「索引已迁 README」侧,补点名门249以满足 R4;被删索引块 127 门名经 README∪本文零丢失;实读:check-agents-doc-size --worktree rc=0(91,293/96,000)、check-gate-wiring --worktree rc=0(R1/R2/R4 零红) (c4afc6a953)
- 🔧 기타:F9撞号3组收口——G-07副本自声明行/G-27错挂旧号行/G-76回插已结清题的正主位保留副本行摘除(各留正主行;留痕f12-purge) (5fe4d76372)
- 📚 문서:守门 249(富文本锚点渲染器单一源头)补进「守门脚本点名索引」的接线/自检行 —— 门 89 R4 义务;207 第二刀把索引整体迁本节后,新装车的门必须在这里点名(原 AGENTS 内联副本即将随冲突标记一并剥除,AGENTS∪README 文档面不得出现空档) (4165487e5a)
- 📚 문서:O65 登记自进化四期可派单任务 P0-P4 (b19e8ebb21)
- 🔧 기타:两票结清——desktop-feed 线上现读 0.1.76(2026-10-18 发布,远超 0.1.45 验收目标,前提过时);128 点迁移归档票复活活行复翻(门 239 R1 型,归档注释逐字在案) (4879305684)
- 🔧 기타:D03侧车重钉(owner=持有席/waiting=none)——union带回旧记录的终修,F12基线棘轮归零 (42af89577d)
- 🔧 기타:守门8假绿灯远端合流回潮体复翻——凭据 1d5e73e2d3(goal-r52 收官+三路径查清),修正归扩面批次 (8ce176c228)
- 🔧 기타:union回潮体清偿——对侧旧底稿灌入的违禁形态行摘除(等条件+待拍板未勾行,留痕f12-purge;两道机主禁令之下union行级回补不带违禁形态;goal-r4复翻席注意:复翻时须同步摘禁令形态,行的事实内容已按各批结清提交保留) (382d4dc4c0)
- 🚀 기능/개선:G-50 DevEnv 搬迁执行器物化——devenv-migrate.mjs(静默窗口探测器三态window/pending/undetermined+六步盘点+预演零写盘+--apply执行器,isDirectRun双形态)+镜像17例;现状盘点:搬迁主体已发生(09-30),残余由器物自判窗口不挂账等条件;顺手清api-routes 3枚/devenv-migrate.test 2枚/dedupe-live-doc 1枚解构残量unused(union带入机械残留,零语义) (f2ddfe9b9e)
- 🔧 기타:goal-r4 远端合流回潮第二批复翻 13 行——tmpdir 孪生/四件待拍板版(事实四件已落地,待拍板定性作废)/P2-13③孪生/MCP四票(goal-r3 r27i)/失败广播/G-217/G-239/D04;凭据=各批结清提交+新鲜现读(夹具门 rc=0/邮件鉴权在位/守门249 rc=0) (04f4ca3e86)
- 🔧 기타:H02 远端合流回潮体复翻——凭据 eff4b6d5bd 已推远端,裁决同前(结构性无样本,只记不挡维持) (ef210af486)
- 🔧 기타:goal-r4 远端合流回潮体批量复翻 34 行——Esc×4/窗格×2/工具面板/O-1/G-939/守门134/四维/取消信号/宿主中止/审批CAS/守门91/G-27/真机走查/prod-bundle/四件拍板/G-35/G-61/G-76/G-807/发丝线/锁初始化/P1-②/G-77/钩子取消腿/AGENTS体积 等,凭据=本会话各批结清提交(全已推远端);行内逐条防新鲜牌(0 冲突) (7df8da52ec)
- 🐞 수정:R5撞号收口——摘除两枚复活门注册块(bare-decode-uri/token-literal-debt,门体脚本已被对侧删除,注册残留=HEAD面247/248双撞号源);富文本门已改号249保留,盘面 idsOfRegistry 现读各1次 (464cc8efaa)
- 🚀 기능/개선:auto-evolve 起会话通路端到端打通(O65 第 0 期收尾:JWT 现签 + --probe 自检 + 真派验证) (87a7713ccd)
- 📚 문서:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (61496e7201)
- 🔧 기타:goal-r4 结清 D04 富文本动作锚点——验收三格全齐(浏览器五例/两腿 DOM 签名等值+语序两态/规模化两载位齐:degradeHint+examplesTip+wallet strong,载体 importer 6 个),守门 247 现跑 rc=0 (e8423e37eb)
- 🚀 기능/개선:web↔RN 屏对齐登记 41 条 + 把跨端自动登记器装进 post-commit 链 (6ad5de3c37)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1081dca6e1)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (194de04708)
- 🚀 기능/개선:跨端登记自动器装车 + 3 条真镜像声明与 1 条 web→RN 映射 (5f1d02f835)
- 🚀 기능/개선:O65 第 0 期翻勾(调度器+四道闸随批完成,验收证据入注记;代码枚 0e4bd3628db);1-3 期补立档日期交代(三选一:新鲜日期,按依赖序排队) (b1ffbc4b23)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab3bc7beb4)
- 🚀 기능/개선:auto-evolve 自进化调度器第 0 期落地(总纲 O65·调度层+四道闸) (0e4bd3628d)
- 📚 문서:更正 ContextUsagePanel 的过时披露 —— RN 腿已接通,并点名新落的那把锁 (6abb419f66)
- 🚀 기능/개선:上下文占用归因面板接上 RN 主屏 —— G-403/G-225 缓存两维的最后一格 (8ce7d87758)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0166713afd)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7faaebcc51)
- 🚀 기능/개선:登记 AI 自进化调度系统 auto-evolve 四期系列总纲(O65;第 0 期调度器+四道闸随批施工,感知/部署/回流三期按依赖序排队) (164b973cfe)
- 🚀 기능/개선:G-217a 点赞/收藏两表唯一键迁移 —— zhs_agent_thumbs/zhs_agent_collect 加 (uuid,bot_id) UNIQUE,把上一批(22ee752721b)靠事务 FOR UPDATE 父行的防重底线放进库层:2026-10-25 实测该族缺陷正是『一次点赞计数+2、取消只减一次』,应用层锁管住今天的写口,管不住未来绕事务的批量导入/人工修数(无约束=漂移只在计数与明细分叉后暴露,而全仓无 count(*) 对账)。线上两表 0 行,零回填成本。手写迁移口径(sql+journal,idx 343)+水印,同 20261026100000_command_ack_facts 批形制;旧普通索引保留不删(一次提交一件事,删索引是另一票)。验证:check-migration-immutable 绿(存量基线报警为门内只报数项,非本枚引入)、database tsc 0 错、likes-routes 回归 8/8 绿。 (c92836e7e7)
- 🚀 기능/개선:ActivityDetail 接线 + web↔RN 屏对齐登记 7 条(教育/公告/问答/权限/agent 家族) (fb58a90253)
- 🔧 기타:refactor(web,mobile-rn,miniapp)+feat(gates): 显示层分→元格式化同形副本 20 处收口 formatPrice 唯一出口 + 装守门 248 —— fmtYuan=¥\.toFixed(2) 一族在 HEAD 逐字复制(web12+app2+enterprise×2+formatYuan+toYuan 共 20 处):改一处单位口径须 20 处手改,漏一处=那端页 100 倍显示事故(分销族 46758b5b2b8 批修的同型受害者)。全量委托 @ihui/shared/utils formatPrice(非有限回 0.00,定长两位,¥ 前缀归调用面维持版式)。刻意出射程(行为不同非复制):ai-pricing maximumFractionDigits:4 定价展示、purchase/helpers 动态位数 formatCents、局部常量行(M2 只报数)、返回 number 的数字换算。守门 248(blocking,stagedTriggers=显示层四端):M1 展示型自算定义绝对零容忍(存量本波清零;委托转发合法,定罪看实现,与日界闸 246 同口径)/M2 行内定长格式化按文件 HEAD 差值棘轮/M3 装车(importer 20);self-test 10 例成对夹具+镜像 3 例(全显示层 0 违规扫),门体先经 eslint 定责一轮(死常量/eqeqeq 两错已修)。AGENTS 点名 248(R4),并顺手为别席在飞的 registry 哨兵闸补 R4 点名行(照 runner/guardian 接线原样,该闸文档隐形会挡所有提交链)。AGENTS 先过 merge-live-doc 归并(lost=0)。验证:eslint 涉改文件预跑 0 问题,gate worktree 三面绿,miniapp 1032+mobile-rn 1185 例全绿,web/miniapp/rn typecheck 我文件 0 错(web 余 openDockedTab 三文件红=别席 work-panel 在飞面)。 (0d2a23f970)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d8116c1b9)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd997d68b7)
- 🐞 수정:收敛预解第二轮 —— G-55 就地翻为对侧结算行(四项已在库,本席==基底旧态由本行承让),删除尾部 dump 区的守门 89 R9 重复块(首份完整保留) —— 为 union-converge 预解 F1 最后一组与 F6 最后一块;两侧独有行零损失由 union 模拟 REG=[] 现证 (07ea442ded)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f39e473af)
- 🐞 수정:在途请求覆盖新态四格根治(前端清单收尾批)+形状锁 —— ① TrendChartDialog:弹窗重开/换 itemId/换窗口连发,慢的旧窗口响应覆盖新曲线且旧 finally 提前熄灭 loading;② learn/topic 付费课:切课时旧列表迟到响应串进新页;③ ide/mcp-pane DetailPanel:常驻不重挂载,切换选中项时迟到详情张冠李戴;④ ModelDetailDialog 行过滤 .filter((r)=>r.value) 把合法 0(免费模型 inputPrice/outputPrice=0)当缺失吞整行,读作『无此项』——改判 !=null && !==''。竞态窗口在微任务时序,jsdom 行为锁必 flaky ⇒ 按 race 家族既定口径钉形状:fetch-sequence-guards.node-test.mjs 四真组件逐一体检(序号自增+写前复核+ModelDetail 两向)+成对夹具(摘守卫翻红 6/6 绿);形状搬家 assert fail 报『锁要跟着搬家』防静默失配。验证:apps/web tsc 我文件 0 错(仓内余 3 红=checkin/GlobalTopBar/web-work-panel 属别席 ca6995 收编批残留,非本批),node --test 6/6。 (5e1978b98a)
- 🐞 수정:三方归并预解——增长图取对侧 57d951 柱形新形态,本席重排保留,并全文件格式归位 —— 别席线形图(1fb44)与对侧柱形图(57d9=14 根太密⇒interval:2/纯柱形/柱顶不标数)是同功能两种写法,取新者;重排四档(wb-prio-user/ai/traffic/trend)+KPI 双卡前置+业务面板用户三格提首/接口排行下移,均在对侧底版上三方重放(merge-file,唯一冲突=图定义二选一,已按裁决留柱形)。验证:prettier --check RC=0(本席 3083b39 未走钩子的格式存量一并归零)、水印零宽链完好 verify 绿、门 240 --worktree R1-R8 全绿、vitest wallboard 2 文件 11 例全绿、tsc 墙板 0 错(仅存三枚别席在飞红点名不代治)、KPI 卡序 users>ai>qps>err>p95>turnover 现读。为 git-sync-converge 的 --resolve 页面路径预解:本面已含两侧全部独有行(对侧逐字打底),收敛无需人工 (584041c957)
- 📚 문서:登记 decode 家族单源收口(移动端深挖批唯一遗留:auth oauth2 私有实现 + 门248 D2 九处) (5e38613843)
- 🐞 수정:重锚机主 2026-10-25 定档首屏重排 + 补回被连带洗掉的增长曲线定义 —— 别席 ca6995ca20b(自动收编在飞副本)把 page.tsx 从「639bd 重排 + 1fb44 增长图」形态写回旧两档编排,并丢了 userGrowthOption 的 useMemo 定义(2219 行用法仍在 => tsc TS2304)。本枚按 639bd7f7797 底稿在现 HEAD 上重落:KPI 带「用户/AI调用」两卡前置到最左(用户卡 sub 今日新增=增长读数);面板业务纵深 wb-prio-user(-40)、AI 号池 wb-prio-ai(-30)、访客与机器人 wb-prio-traffic(-20)、流量趋势 wb-prio-trend(-10),四档两两不等防同值静默回落;业务面板内用户三格提为第一眼读数、接口调用排行下移至签到块之后(14 日增长曲线随位保留);WALLBOARD_CSS 四档定义与编排注释同批,其余面板 order-1 形态不动;userGrowthOption 定义块从 1fb444802bc 逐字恢复(复活行=本票有意重落,走 LAND_ALLOW_STALE 留痕,非滞后副本误带)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格)、apps/web vitest wallboard 2 文件 11 例全绿、watermark verify 载荷完整、check-i18n-keys 19187 键 5 语言 parity OK(本批零新键)、apps/web tsc 墙板 0 错(仅存错=checkin/GlobalTopBar/web-work-panel 的 openDockedTab/onHome 三枚,系别席 work-panel.ts 在飞未落,本票不代交点名在此)。并发说明:普通提交路径仍被别席在途文件占用,走 object-space-land 只交本票一文件 (3083b390c9)
- 🐞 수정:union-converge 冲突标记闸补接 import —— 2026-10-25 头注的闸只写调用未引 lib/conflict-marker-guard 的 assertNoConflictMarkers ⇒ 本器任何带 <<<<<<< 的树内容在 writeBlob 处 ReferenceError 崩(实测 dry-run base=a6c3c036be ours=本地线 theirs=179fc770b5a 即崩,RC=2 未判定),收敛器全程瘫;补一行 import 后同输入 dry-run 正常出闸(CHECK ONLY 正常走完,落地闸 3 处为真实内容裁决)。修复凭据=§1「能当场修的当场修」+本席收敛作业被此 bug 挡住的直接受害现场 (df25853257)
- 🐞 수정:墙板页剥回成对冲突标记 —— 11:18 手工收敛把 merge-file 原始标记带进 main 的清偿(零内容变化) (3363928c6e)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc7389109e)
- 🐞 수정:三族小面根治+一批测量基建纠错 —— ① packages/shared usePaginatedList 补序号守卫(末发定案:后发请求落地前,先发的任何迟到响应不写数据/不写错误/不翻加载位),此前筛选切档与在途页互盖:旧结果 setItems 替换新第1页、把页游标偷换成旧页号(下次加载更多直接跳页缺页);web/RN/miniapp 三端共用该 hook,守卫随源生效。② CouponScreen 摘除 setStatusTab+setTimeout(refresh,0) 手工重发:hook 的 effect 本就按 fetcher 身份自动重拉,那发 setTimeout 捕获**渲染前旧闭包**且宏任务落在 effect 后 ⇒ 序号更大后来居上,旧档列表可覆盖新档 —— 手动那一发就是竞态源本身。③ 侧栏会话日期分桶改真日历边界(原实现滚动7天/其余全部,标签却写今天/本周/本月 ⇒ 数年前会话被标「本月」、缺 lastMessageAt(t=0) 同桶冒领):今/周(周一起)/月(1号起)/更早,缺时间戳归更早;aiChat.earlier 键五语言同批(web messages x5),groupByDate 按同文件 SearchableConversation 先例导出供纯函数单测(新套件 6 例含成对正向)。④ 测量基建纠错:apps/mobile-rn/tests/use-paginated-list.test.ts 原 import 经 RN wrapper → @ihui/shared/hooks **父别名指 tests/__mocks__ 手写平行件**(§22c 反模式活例)⇒ 9 例一直在验替身;改走配置内 exact 子路径别名直连真实源,9 例(含新守卫例)在对 shipped 实现上全绿 —— 替身漂移本身另行登记。⑤ 上一枚 history-page-hydration.node-test.mjs 水印载荷修复(手写头行截短致残迹,verify --staged 现形;clean+重注入 0 不合格)。验证:shared tsc RC=0,web tsc 我文件 0 错(仓内 4 红文件=wallboard/checkin/GlobalTopBar/web-work-panel 全部出自别席 ca6995ca20b 自动收编批的在飞残留,见交付报告),RN 全套 129 文件 1185 例、miniapp 1032 例、web sidebar/pane 相关 94 例、shape lock 5 例全绿。 (0d036f9909)
- 🚀 기능/개선:补 4 条镜像声明(change-phone/change-pwd/help/point-history)——小程序页早已存在,只缺标记与登记 (22b3697a52)
- 🐞 수정:旁路落地器补「成对冲突标记拒绝进树」闸 —— 79 看不见不走钩子的通道,牙装在写口上 (a844588db0)
- 📚 문서:结清守门 207 存量清偿第二刀——AGENTS 108,515→89,968B(余量 6,032),三面 rc=0,238 同批复绿 (1377bdc7b2)
- 🐞 수정:并发合并把「国内镜像」徽章带回 —— 按 2026-10-23 机主令重新清除(守门 238 复绿) (995ecb1615)
- 📚 문서:守门 207 存量清偿第二刀 —— 点名索引迁 README + 速查区压缩副本移出(108,515→89,968B,余量 6,032) (8e99bd5626)
- ♻️ 리팩터:抽离 git-guardian 的 TEMP 清扫与日志两族到 lib 以压住架构门 103 C1 单文件行上限（主文件 6094 to 5837 行） (8fe1fb2f10)
- 🚀 기능/개선:首例真实镜像页——用户协议 pkg-about/about/agreement (aa4c418bff)
- 🚀 기능/개선:补 study-index 镜像声明——pages/study/index 与共享屏 StudyIndexScreen 同为学习首页(taro 端内重写渲染层,按门 128 语义声明对齐目标);此前只缺标记与登记 (84b9acc2c0)
- 🚀 기능/개선:补 coupon 镜像声明——小程序 pages/member/coupon 与共享屏 CouponScreen 键空间完全一致(coupon.available/used/expired),此前只缺「镜像」标记与登记 (652e5b052b)
- 🚀 기능/개선:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (481fd87095)
- 🚀 기능/개선:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (fe0abab5b2)
- 🐞 수정:AI 侧栏历史翻页双缺陷根治(判高两条,前端清单回源仍活) —— ① 根窗格 handleLoadMoreHistory 原 res.data.messages.map 手工造行只留 id/role/content/createdAt,绕开水合出口 ⇒ 翻上来的旧消息丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex(版本族判不出⇒点一次编辑出两个气泡);改为与首屏(:676/:732)及非根窗格(chat-pane-body:222)同一出口 hydrateHistoryMessages。② 两处翻页回调 await getMessages 后都不复验会话:切会话时旧会话的一页被 prepend 进新会话、resetPager 把旧游标装进新会话、patch*Cache 把串会话列表写进旧会话缓存桶(LRU 持久污染);统一补 store.getState().conversationId 复验且先于一切写入(window 窗格体与根窗格同修)。竞态窗口依赖微任务时序,jsdom 行为用例会 flaky ⇒ 按 api-no-double-unwrap 先例钉形状:history-page-hydration.node-test.mjs 抽函数体+三判据(水合出口/复验存在/复验先于写入),2 文件×(正向+三型变异夹具)+良性对照 5 例全绿,摘任一判据即翻红。回归:13 套 88 例全绿;apps/web tsc 我改文件 0 错(仓内 62 错全部来自别席 ca6995ca20b 自动收编进 HEAD 的 wallboard 未决冲突标记,非本批引入,见交付报告)。 (dd56090e92)
- 📚 문서:207 第二刀① 落地登记——归档移出凭据接线(判据单源 + 两个消费面),票保持未勾 (dbf38b926d)
- 🚀 기능/개선:RN→小程序 镜像缺口账本自动化——139 缺口逐条带候选线索 (f67090ac4f)
- 🐞 수정:清掉上一枚带进来的 1 个 error + 收口一处既存 eqeqeq (0bb9bfd89c)
- 🐞 수정:AGENTS 归档移出被当成丢行 —— 第四态凭据接线补齐(守门 207 第二刀①) (b6023aa977)
- 🐞 수정:合并回填本侧独有词条——miniapp 5 语 ×81 键 + mobile-rn 5 语 ×273 键 (2f651b8ce1)
- 📚 문서:对外文档数字/端数口径收尾 —— README 瘦身版尾部旧版碎屑整段清除(7082→6007 行:八端清单/176 models SEO 段/两行矛盾结尾/孤立表行,主体均有现算版);L183 IP 白名单『只存不拦』过时表述改实链事实(ip-whitelist-guard.ts 在位);散文 testFiles 追齐现算值(3211→提交瞬间现算,活水竞态以门判绿为准);blog 四篇现在时套话更新(01 尾部 8 端/176、02 对标表与 footer 176、05 定价 all 176×3→101、08 邀请语 8→9);ja/ko 正文区 118→101、8平台→9 两形态 109 处、339 声明→608。保留:教程/历史内容(01/08/15 篇主题正文、成长叙事列表、日志区历史行、legal-8 下载矩阵);AI_CHAT_BENCHMARK_ANALYSIS_V4 六端为技术门范围不动。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:README.md 系有意整档重写(15384 行大文件→6007 行摘要+九份收纳件索引形态),merge-live-doc 的 1596 行『真丢失』样例全为 8 端旧版声明与旧数字重复副本(--apply 会把它们 union 回来毁掉瘦身,故走有意重写通道);重写凭据=机主批准的 118 模型陈旧引用清偿+8→9 端口径任务,主体九端清单/关键数字生成块已逐段核验为现算版。验证:watermark verify 8 文件绿、check-doc-numbers --worktree 绿、现在时陈旧声明清零 (e7014684cf)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29582c20a8)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f7efe9cf8)
- 🐞 수정:合并后撞号收敛——check-bare-decode-uri 让出 241(远端已占,check-rn-readout-cell),改号 248;判据与 skipEnv 一字未动 (68c00a3a05)
- 🚀 기능/개선:资源目录同步停更哨兵三件套 —— 760 条全军只有一行 WARN 的静默型,自此当轮即红、恢复即绿 (0dd89c37e9)
- 🚀 기능/개선:出口代理闸 IHUI_REGISTRY_EGRESS_PROXY —— marketplace 直连抖段的运维旋钮(默认关=行为零变化) (7fe57853cf)
- 🐞 수정:registry 批量 upsert 批内复合键去重 —— 上游 offset 分页重叠让整批 760 条全军(PG 21000) (33cf83062e)
- 🔧 기타:治四处存量"代码对、锁旧"的源码漂移锁 —— 锚句跟着判据形态搬家,同时补变异自证 (91272a063b)
- 🐞 수정:门 103 C1 二次超限收口 —— git-guardian 六块 141 行注释逐字归档换指针(零行为变化) (1f9a9a6fa6)
- 🐞 수정:端内测试停止越层 import repo-tooling,清偿架构政策 D1/D2 六处 (4e2758c740)
- 🐞 수정:207 第二刀票改"未取号"形态——G 族号池 pool-exhausted(占用面含 42 份归档件)，令牌残留是 G-15107 格①用法错，绝不发 1000+ 号；待号池扩容批补号 (87d1f894e7)
- 📚 문서:登记守门 207 存量清偿第二刀(前置=补 declaredDropCaps 认 AGENTS 归档移出,防回潮吞掉第一刀成果;现读缺 9,156B)——第一刀已落枚 c9c85d63 (5f4bafc488)
- 📚 문서:守门 207 存量清偿第一刀——速查区回潮副本 34 行整区移入 archive(125551B→105156B) (c9c85d639c)
- 🐞 수정:门 128 两族判据射程差豁免登记 + 门 77 B1 wallboard 圆角绕档清偿 (a35ac94b7d)
- 🐞 수정:字形箭头与双返回箭头清零——Collapsible 文本字形换矢量图标 + 五 pkg 页摘页内死返回键 (8f26a1f779)
- 🔧 기타:门 241 镜像测 T1 前提断言改大小写不敏感 (3a893d1481)
- 📚 문서:守门 241(裸 decodeURIComponent)R4 点名行 (8ffd95d1dc)
- 🐞 수정:移动端行为级深挖批——裸 decodeURIComponent 族 21 处从底层修复 + 守门 241 防回潮 (815bfe638f)
- 🐞 수정:RN 样式裸数字回潮锁改号 240→247——远端 f126e734 已占 240(大屏读数不得断行门),合并前让号,判据与 skipEnv 一字未动 (284aa41062)
- 🔧 기타:门 240 判据镜像测试——3 例直接 import 源脚本 __test__(§22c,判据零复制),含阳性对照(把 rnSpacing.lg 改回 16 必须被抓) (1dfe636e62)
- 🚀 기능/개선:新守门 check-bare-decode-uri.mjs 接进提交链 (6a3e148297)
- 🚀 기능/개선:新增门 240 RN 样式裸数字回潮锁(差值棘轮)+ runner 接线 (d066355a35)
- 📚 문서:点名门 240 RN 样式裸数字回潮锁(与接线同批;AGENTS.md 超体积预算暂不写入,README 已满足 R4) (d562ca2018)
- ⚡ 성능:跨端两把尺子改批量取 blob(HEAD 面 4 分钟→17s) + web→RN 尺支持 --full + 6 段 web-only 豁免 (da67136b16)
- 🚀 기능/개선:补 4 条 about 族镜像声明(账本真实化,零行为变化) (f97405f954)
- 🐞 수정:web→RN 功能尺三屏误报根治 + 删除一条不存在的 web 路由登记 (89239b8d3e)
- 🚀 기능/개선:token 化批 #6 第 5 批(收尾)——21 文件裸数字转档 (3d8a7a3355)
- 🚀 기능/개선:token 化批 #6 第 4 批——60 文件裸数字转档 (0088fd044e)
- 🚀 기능/개선:token 化批 #6 第 2 批——60 文件 1020 处裸数字转档 (5308e7aaf5)
- 🚀 기능/개선:token 化批 #6 第 1 批——tokens-migrate 扩为目录批量器物 + 60 文件 1583 处裸数字转档 (e506840fc0)
- 🐞 수정:普查锁两 offender 清零——VoiceNote/LlmSettings 裸 TextInput 迁共享 TextField (e9226cbb50)
- 🐞 수정:活副本纠偏批——上轮把 account-cancel/app-topup 判死副本是反的:现读 RootNavigator 1037/1048/1087 挂载体=packages/app 版,二屏 Modal 缺 onRequestClose 即安卓返回键在注销确认/充值说明穿透弹退出应用(与 MemoryScreen 同型,补 onCloseModal/onCloseIntro)。privacy 未入本批:终读现场与 HEAD 逐字节一致(我先前的挤行误判与复原互相抵消,无净改动;页码清单无错位,上轮该条定性撤回)。遗留如实:(a)packages/app 两屏标题硬编码(注销账号/充值)属 i18n 队列射程;(b)SDK 清单与 Expo+RN0.86 真栈脱节为法律文案,归机主/法务 (6e5cc2e93b)
- 🐞 수정:行为级 bug 两枚——① VoiceNote 语音笔记面板:RN 原生 Modal 自成窗口不吃外层 KeyboardAvoidingView,面板内搜索框弹键盘后操作行整块顶出可视区(iOS/小屏安卓必现,Modal 内键盘关不掉)——避让容器移进 Modal 内侧,iOS padding/安卓 height;② packages/app MemoryScreen 新建记忆 Modal 缺 onRequestClose:Android 返回键不关弹层反弹确认退出——与右上角取消同语义接回 onCloseCreate。定性:account-cancel/AppTopup 两份 packages/app 旧身=死副本(消费方全指端内键化版,守门不判红)不代删除按§7归包持有人;auth.ts login 抛错为设计契约调用方统一兜;VoiceNote 已有 onRequestClose 不重复补。验证:RN tsc 0 错、vn-mount 13/13、eslint 0、水印 2/2 (60e2c90099)
- 🔧 기타:F9 分批收敛 #5(终)——CSRF 行 G-12→G-02、两版F5 行 G-30→G-18(双侧真声明位零 + 239 归档 marks 过滤验证);五门现读全绿(strict F9 0 组/234 warn/239 0/211 0/13d 0/71 无丢失)——机主授权合并背景 (87338aa530)
- 🐞 수정:auth.ts 支付宝回包防护补丁自纠——上一枚提交里 info 类型注多套了一层 .response(TS2339 ×2,miniapp tsc 当场红),语义层级回归 parse→.response→{nickName,avatar} 真形 (20c8ba1c13)
- 🐞 수정:逻辑级 bug 三枚——①充值自定义金额 Number('9.9')*100 浮点毛刺直进支付订单(分语义被打成 990.0000000000002),对齐 CartScreen 既有 Math.round 范式;②credential-storage 裸 JSON.parse:AsyncStorage 半截写/手改/回滚脏数据在启动链抛 SyntaxError 打断记住账号预填,降级为无记录(后续 persistedAccount 覆盖);③miniapp 支付宝 getOpenUserInfo 取消/异常回包 response 非 JSON 时裸 parse 打崩整条登录链,降级空资料走既有手动补路径。定性留档:定时器清理全配对/formatDateByTemplate 带 tz+NaN 守卫/totalFee 经 zod int 非空/支付按钮走 paying 锁+disabled——四类候选核实为健;Clipboard try 豁免=RN API 不抛;CONTEXT 崩溃上报未脱敏一条已漂移(现码过 redactCrashText) (92e31d50fa)
- 🔧 기타:F9 分批收敛 #4 终版——Agent SDK 票:原 G-06 行插回存续(门 71 编号行不丢)+ 行尾让号注记 + 未取号行承载实际推进(行内交代归属=qoder-maxpar)+ 旧 G-36 双行摘除留痕 + merge-live-doc 归并(lost=0);五门现读全绿(71 无丢失/239 0/211 0/13d F10 2→2/234 warn)——机主授权合并背景 (688b7ce6be)
- 🐞 수정:backup-pg-local 追到断链根因——pg tooling 已迁 D:\ihui-pg\16(服务镜像为证),脚本写死旧卷 D:\DevEnv\runtimes\pgsql 失踪后,wscript 启动的计划任务看不到 pwsh 的 CommandNotFound ⇒ 本地 dump 静默停摆一个月(P7 只量到副本侧,源侧 P5 格当时未判定)。路径更新 + 新增'pg_dump 不在位必写 backup.log 再退'守卫——停摆必须留下可被人量到的痕迹,任务面 Last Result 0 是谎。实证:修复后手跑 EXIT=0,backup.log 落 10-25 01:16 OK 9.6MB 新行 (de4073ff04)
- 🔧 기타:F9 分批收敛 #3——取号器行 G-48→G-90(G-48 被远端新纪元 F1不认行占用,重让;PLAN 全文零出现的 G-90 空投)——五门现读全绿(strict F9 撞号 0 组/234 warn/239 0/211 0/13d 0) (73c966154a)
- 🔧 기타:F9 分批收敛 #2——取号器行 G-48(远端占用,重让)→G-183 链理正 + 侧车按真实 compositeKey 全量重建(5 条;234 warn a1=0 a2=0/211 0/13d F10 0/239 0/plan-gate strict F9 撞号 0 组)——机主授权合并背景 (a056001ebf)
- 🔧 기타:F9 分批收敛 #1 终——L28868→G-48/L28888→G-50/L29002→G-90/L29063→G-26/G-880 误改恢复/G-183 误改恢复;L29068 回退原号 G-18(远端键位零)+G-18 侧车补;六组侧车按真实 compositeKey 重写(234 warn a1=0 a2=0/13d F10 0/239 归档单调 0/211 号池 0)——机主授权合并背景,逐行留痕 (45254bd876)
- 🐞 수정:course-planet loadData deps 剔无用 tt(体内未引用,判据面 JSX 层独立吃,exhaustive-deps warning 清零)+ tailwind.config 头注版本事实修正(现读:声明 v3 仅服务 preset 工具链,产物引擎=weapp-tw@5.2.9 vendored v4,alpha 原生生效——漂移注释清);验证:miniapp 端内 eslint 首次 --max-warnings 0 exit 0 (25817edb68)
- 🔧 기타:F9 分批收敛 #1 终版——本地 5 行键位改号到验证组合(G-48/G-50/G-90/G-26/G-09;G-880 误改恢复;G-183 误改恢复)+ 侧车 6 条按真实 compositeKey 重写(234 a1=0 a2=0/239 归档单调 0/211 号池 0/13d F10 0/plan-gate F9 撞号 0 组,五门现读全绿)——机主授权合并背景,逐行留痕 (12a9581f6a)

**2026-10-24**
- 🔧 기타:navbar-no-chrome 补 i18n mock——NavBar 在 i18n 扫尾批起吃 useI18n,裸 render 抛「must be used within I18nProvider」整文件稳定红(全量两轮复跑 1/1 坐实,非 flake;与 fenlei-overlay 同治,判据只量根元素样式不涉文案) (e8c502633e)
- 🐞 수정:门77 B1 终清+门150 弱证据 web 两站归档(wallboard 条形帽 3px→2 就近档;wb-panel 根容器 lg→xl 跟 panel 角色;PiP card 容器 md→lg)——移动端收官顺手清全仓 UI 档残余 (d5fe70025b)
- 🔧 기타:F9 分批收敛 #1——本地 5 行键位改号到远端零键位号(G-08→G-48/G-09→G-50/G-12→G-90/G-12→G-26/G-09→G-37;G-880 误改恢复)+ 侧车 5 条按真实键重写(234 a1=0 a2=0/211 差值 0/13d F10 0/239 归档单调 0/plan-gate F9 撞号 0 组现读)——机主授权合并背景 (58e51c9b2e)
- 🐞 수정:移动端第三轮收官——中文/半翻译残留 82 站清零 + D43 首页语音笔记挂载落账 + 门150 弱证据移动端 6 站归档 (dc9667c160)
- 🔧 기타:F9 撞号 6 组人工键位裁决改号(G-32/14/53/20/18/D18 → 池内新纪元两位号 G-01..G-07)+ 副本行标记 + 7 行侧车记录补齐(234 a1=0 a2=0;211 号池差值 0)——机主授权合并背景;逐行带原号留痕注记 (2d30287aad)
- 🐞 수정:ScreenStates 空态圆章真圆写法改 50%(守门 77 B1 认可的几何真圆形;64/2 表达式被 B9 求值判超上限,同形百分比是门自带出口) (3ffd223f89)
- 🐞 수정:移动端跨端观感修复批——四件套骨架屏尺寸减半(用户可见)+圆角角色档 43 站收口(守门 77/150 在册红) (a1de25ce24)
- 🐞 수정:清两处合并连带的死导入(AgentSettingScreen ActivityIndicator / OrderScreen TouchableOpacity,HEAD 面已红即合并 auto-merge 产物,未用导入删除无行为变化)——解锁 push 全量 typecheck 门 (76ab146506)
- 🐞 수정:修复合并连带损伤——NotificationPanel formatPushTime 内 Date 变量撞名参数 t(改 dt)+ useI18n import 补位 + 签名对齐 useI18n;原 push 门全量 typecheck 红因;验证:eslint 0/该文件 typecheck 清/水印完好 (1a3295d1de)
- 🐞 수정:移动端 typecheck 清零批次——i18n 提取残骸 36 文件/119 错修复 + 测试滞后 12 红 + 顶栏两截带一枚 (fc5925035e)
- 🔧 기타:收敛 origin/main(2026-10-24 编号新纪元)——PROJECT_PLAN 取远端重排版(旧卷全文已由远端 renumber-snapshot 归档,零丢失;goal 十四枚提交未触碰 PLAN);代码文件 auto-merge;机主授权合并 (7fb7e5e52f)
- 🐞 수정:补落第二枚遗漏的 8 文件——5 共享屏(console-table/switch-prefs/user-public/llm-settings/edu-shop)与 3 小程序镜像页(pkg-user/user-public、pkg-user/llm-settings、pkg-shop/edu-shop);第二枚重跑时目录参数展开失败致漏(index.ts/app.config 已引用它们,干净检出必断,本地工作树假绿掩盖);验证:eslint 0/typecheck 零错/水印 verify 完好 (41d84097bb)
- 🔧 기타:screen-registry 三元组补登 3 条——UserPublic/LlmSettings/EduShop(shared/rn/miniapp 三端齐,goal 新屏首批评入镜像登记链);门 screen-coverage HEAD 面现读 71 条全真、镜像 72/213,新 3 条落地后 75/215 (aaad635715)
- 🚀 기능/개선:存量 token 化批 #5(长尾)——四屏 69 处(ChangePwd 12/ChatRoom 19/LecturerList 15/Publish 23);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 30 屏 885 处 (45b3c6bc35)
- 🚀 기능/개선:存量 token 化批 #4——七屏 218 处(StudyIndex 45/Promote 33/LiveDetail 38/Settings 24/SelfMedia 23/VipTrader 33/EarnCommission 22);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 26 屏 816 处,15+ 裸行档清零 (5a89172e0d)
- 📚 문서:D17 生态统一入口结清翻勾(内容锚:「D17 生态统一入口装车」提交=page+hub+nav+五语 ecosystem 37 键 empty0+nav.ecosystemHub×5;现读 check-i18n-keys 19127 键 parity OK+hub 测试 16/16;语言包占写已解除)✅(2026-10-24) (49ef8ccb88)
- 🚀 기능/개선:存量 token 化批 #3——六屏 203 处(Points 24/Memory 45/AppTopup 27/WrongQuestions 29/AiWorld 45/Plaza 33);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 19 屏 598 处 (89aba90a01)
- 🚀 기능/개선:存量 token 化批 #2——六屏批量转写(ConversationImport 23/LecturerDetail 27/CourseTab 45/AiGroup 55/ImageGenTemplates 29/ModelIncome 42 共 221 处)+ 转写器 ensureImport 增强(import 检测改在 design-tokens import 语句内做,根治正文已含 token 名时的漏补);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 13 屏 395 处 (f03953d525)
- 📚 문서:G-959/G-865 结清翻勾(现读证据:app-login sso 键化+shared 五语+守门测试 16/16 · DEFAULT_AVATAR_URL 死键已摘+两测试同批改净)✅(2026-10-24) (81f16bbaff)
- 🚀 기능/개선:存量 token 化批 #1——批量转写器 scripts/tokens-migrate.mjs(裸数字→rnSpacing/rnType 档,恰在档才换不硬凑,自检 6/6)+ LoginScreen 首屏 65 处转写;验证:eslint 0/typecheck 零错/水印完好;工具可复用到全部存量屏 (ccd9fb1624)
- 🚀 기능/개선:edu-management 族小程序镜像批——考勤/成绩/缴费三页(pkg-user/edu-mgmt-*,复用 edu-child/records-page 共享渲染件)+ app.config 注册 + miniapp 五语言(eduMgmt 3 + eduFinance 9 含状态枚举 + eduGrades 正名);验证:eslint 0×3/miniapp typecheck 零错/水印完好;镜像累计 14 页 (26fc056da6)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92f382ef86)
- 🚀 기능/개선:children 六子页小程序镜像批——共享渲染件 records-page(列驱动卡片列表,对齐 RN ConsoleTable 模式)+ 六薄壳(课表/考勤/成绩/餐食/账单/学习计划,参数 childId)+ app.config 注册 + miniapp 五语言 edu 族键组(eduChildAttendance/eduGrades/eduAttendance 等 4 组 + statusTitle/empty);家长端小程序闭环(首页→六子页);验证:eslint 0×7/miniapp typecheck 全零/水印完好;镜像累计 11 页 (01bb3b47a8)
- 🚀 기능/개선:小程序镜像批 #2——家长端首页(pkg-user/edu-parent,孩子卡片列表+状态徽章,对齐 RN EduParentScreen;children 子页镜像排后续)+ app.config 注册 + miniapp 五语言 eduParent 10 键;验证:eslint 0/typecheck 零错/水印完好;镜像累计 5 页 (2ceb517ea6)
- 🔧 기타:对账尺登记批——edu 族 18 条 aligned 入账(edu-management 7 + parent/children 9 + user/[id]/settings/llm/edu/shop 落地补登);worktree 面现读 aligned 142/缺口 355/零腐烂 (4b5234a908)
- 🚀 기능/개선:goal 教育域批——edu-management 可列表承载面全落地(考勤/成绩/班级/缴费/餐次模板/校园课表/教师排班 7 页)+ 家长端闭环(首页/绑定 CRUD/children 六子页)+ EduParent 六键导航;全部 ConsoleTable 杠杆薄壳 + 五语言 i18n(edu 族 12 键组);验证:eslint 0×18/typecheck 本轮零错/水印 verify 完好 (c1712deb25)
- 🔧 기타:vip/success 时长三连裸串接 tt('vip.success.daysUnit') + 词包五语 {n} 天键 (73dae30a4e)
- ♻️ 리팩터:批131 · AgentShopList emptyText 默认参拆雷(全仓可接面清零收口枚) (c51ca43ae9)
- ♻️ 리팩터:批130 尾修 4 处 appAlert 第一参变体(AccountCancel/ChangePwd) (a9d478aa0d)
- ♻️ 리팩터:批130 硬编码中文清零(6 文件 / 90+ 处) (80ec061080)
- 🚀 기능/개선:批130 入典(88 组新键 ×5 · chat.msg/toolbar/topup/confirm/sr/dist 族) (f2673153bd)
- ♻️ 리팩터:批129 硬编码中文清零(5 文件 / 90+ 处) (3ff7374377)
- 🚀 기능/개선:批129 入典(74 组新键 ×5 · need/news/iaa/bab/vip 族+common.known) (a2f2edbfa2)
- ♻️ 리팩터:批128 硬编码中文清零(6 文件 / 80+ 处) (3694083f70)
- 🚀 기능/개선:批128 入典(65+ 组新键 ×5 · subPkg/account/share/lp/annot/aigcList 族+补 courseDesc) (fd6316a81a)
- ♻️ 리팩터:批127 硬编码中文清零(11 文件 / 90+ 处) (36398ccb1a)
- 🚀 기능/개선:批127 入典(110+ 组新键 ×5) (9af71a11bc)
- 🚀 기능/개선:批127 W1 入典(23 组新键 ×5) (5926d858a3)
- 🚀 기능/개선:goal 应用批——RN 六屏 token 化(109 处 rnSpacing/rnType/rnRadius 档)+ 9 张 RN 屏四件套(他人主页/BYOK/教育商城/控制台六页,ConsoleTable/SwitchPrefs 两杠杆屏)+ 小程序镜像三页(三新屏三端闭合)+ 小程序提现页语义档 + RootNavigator 九路由 + miniapp 五语言键组;验证:eslint 0/typecheck 本轮零错/水印完好/i18n parity OK (47e3b46cc5)
- ♻️ 리팩터:批 126 硬编码中文清零(Menu 8 项表转键/Notification 时间族/PushBanner 回落/VoiceInput 全组) (3785cb014f)
- 🚀 기능/개선:批 126 入典(22 组新键 ×5) (62378825a2)
- ♻️ 리팩터:批 125 硬编码中文清零(9 文件 / 60+ 处,组件批收官) (593cb4ec61)
- 🚀 기능/개선:批 125 入典(29 组新键 ×5) (ad22965d3c)
- ♻️ 리팩터:批 124 硬编码中文清零(13 文件 / 55 处 · RN 端 UI 串清零收官批) (bd0dfe0c8b)
- 🚀 기능/개선:批 124 入典(37 组新键 ×5) (cda81d5afe)
- ♻️ 리팩터:批 123 硬编码中文清零(13 文件 / 40+ 处,含 3 张顶层表转键) (aecd7c7a30)
- 🚀 기능/개선:批 123 入典(35 组新键 ×5,含工具三态状态词五语同批) (a43b9ae989)

**2026-10-25**
- 🚀 기능/개선:锁定 order-log/order-track/message-group 令牌主体与 vip-compare 公开脱敏 (b5c3d62f14)
- 🚀 기능/개선:O65 第 3 期回流两件 —— 失败票归因沉淀器 + 守门判据腐烂自检(自检 7/7 与镜像测试 12/12 全绿) (6567fd5730)
- 🐞 수정:Step 5 载荷判据改为「实到 == 预期且预期非空」,空提交不再判绿 (3bdcc09dca)
- 📚 문서:O65 第 3 期进展注记 + 第 2 期重复登记收拢(仅留一条 [x] 完成行) (74fd1f1630)
- 🔧 기타:G-1222557 复验结清——出口围栏的存量维真跑 15/15 绿;另补记 D04/G-934 两枚的真浏览器凭据 (534682513b)
- 📚 문서:O65 P0 四件翻勾(正式编号 O6501-O6504)+ 第 1 期感知层自动分诊器翻勾 —— 交付件已入 main 并随 8486d01ddab 上生产 (4e74314d70)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b801d2d8f9)
- 🔧 기타:G-927 进展注记——求差实证新增12枚中10枚已由别席迁好待入库,agent-worktree/green-state 两枚本席迁讫(gitRaw层,行为面等值,自检9/7);棘轮70随入库递减,基线60不动 (8a8ffefbd6)
- 🐞 수정:G-927 迁移批——agent-worktree/green-state 两枚裸 spawnSync('git') 改走 face-reader 取材层 gitRaw(绝对路径git+quotepath+safe.directory+timeout+EBUSY兜底),包装函数折回原三态行为面逐字段等值;自检9/7全绿+--list行为面真实返回;求差实证:12枚新增中10枚已由别席迁好待入库(盘面0命中),本批迁余下2枚,棘轮70→随入库递减,基线60不动(下调前置=10枚入库) (a9505b2596)
- 📚 문서:结清 3 枚(第 12 批:G-272 重臂复位分域 + 门 149 端内 barrel 两条同题) —— ①G-272 席位提交 34828b1db3a5d531b26b06fbf8d20d79fee28f1d:前提现读更正(stopInitiator 在 HEAD 有 15 处命中而非票面 0,该字段已由 G-816026 落地;rearm/重臂/复位仍只命中注释 ⇒ 注释声称有实现没有成立)。实现 apps/cli/src/tools/background-registry.ts 新增 BACKGROUND_TASK_REARM_FACE(preserve/reset/renew 三档,satisfies Record<keyof BackgroundTask,…> 编译期穷尽)+ rearmBackgroundTask(previous, incoming):身份面逐字保留、结算面回构造初值、新生面换代,四档拒绝(not-terminal/id-mismatch/generation-not-renewed/not-live)原样交回旧条目,fail-closed。主席复跑 apps/cli/tests/background-rearm.test.ts ⇒ Tests 6 passed,含变异自证(注释掉 command: previous.command ⇒ 仅用例①红)。剩余面:rearm 暂无生产调用点(registerTask 每次 genId),未来接入时事件处理器必须绑到 rearm 返回的新条目。②门 149 端内 barrel 两条同题行一并收口:席位提交 443561b82c 新增 scanAppBarrelLeaks 与桶/实现分离单源 isBarrelModule,端内桶 universe 由该层目录扩到端内全树;主席复跑 --report 末行 APP-BARREL-REPORT barrels=36 apps=5 consumers=34 hits=0 type=0 elsewhere=0 undetermined=0(存量 0 + 阳性对照 ⇒ 并入既有 --staged 差值棘轮而非升绝对 blocking,符合 §12e 升档前置=存量归零) (00d8db8283)
- 🔧 기타:A 类 7 枚结清(G-62/G-01/G-03/G-07/O88/G-272/双重执行)——凭据全部本席现读复跑:gate 全零、twins 0 组、CI 唯一 failure=lint-typecheck-test、stopInitiator 20 命中、take_loop_v2_handoff 9 处消费面在位 (1e57d5d821)
- 🚀 기능/개선:门149 补齐端内 barrel 漏出口(桶/实现分离 + 端内全树 universe + --report 只读量算) (443561b82c)
- 📚 문서:结清「非会话 401 被当成会话死亡」 —— 按 §24 机主令本应由 agent 代裁,现读发现源头已由 2026-10-25 的 L7648 修复落地:apps/api/src/routes/agent-extended.ts 的 preHandler 兜底由 `err.statusCode ?? 401` 收窄为 `?? 502`,行内注释明写「没标 statusCode 的异常是内部/上游故障,盖 401 会被 api-client 读成重新登录(上游 provider 凭据错误 ≠ 会话死亡;口径同 auth.ts 票 G-396/G-765/G-357)」⇒ 用户不再被误导去重新登录。客户端侧 packages/api-client/src/client.ts 仍是 `status===401 && !isAuthEndpoint(url)` 才判会话死亡(两处),由于非会话错误现在以 502 出栈,该启发式不再被误触发;如实登记残余:若将来有上游把第三方 401 原样透传成 401,仍会被读成会话死亡,属纵深防御缺口而非本票未完成 (ba06930d36)
- 📚 문서:结清票60 真并行多窗格(服务端 fork 腿收口) —— 席位提交 5e72a6df8b 共 5 文件 +942/−50;主席自审复跑 apps/api 三份用例(chat-fork-branch-endpoint + chat-fork-branch-queries + chat-actions)⇒ Test Files 3 passed / Tests 24 passed(席位另报 conversation-archive 11 例,合计 35)。关键事实更正:服务端分叉并非不存在,而是早已以 POST /api/chat/conversations/:id/branch 命名存在(chat.ts,2026-08-30 立;V3 按 fork 关键字 grep 未命中属命名差异)⇒ 按 §0.6 不新开 /fork,改为把既有端点按票面口径收口:响应返回新会话 id + fork{sourceConversationId, forkedFromMessageId, sourceRootId, sourceSiblingIndex, messageCount};复用票59/64 的 parentMessageId+siblingIndex 族根判定并抽出纯函数 linearizeForkHistory(每族只留一版,分叉点必胜);鉴权只取 request.userId(body 自报 attacker 仍以真实主体入 queries,他人会话 403 且 branchConversationFrom 零调用,越权插入/更新计数 0);幂等用 clientRequestId 在源会话 FOR UPDATE 锁内查询,重放返回首建会话 replayed=true 且计数不增,键撞别的分叉点 409;复制以 .returning({id}) 回库确认,不符整批回滚。未判定:真库端到端(.env.test 不存在、PG 仅 5432)⇒ 四格为离线 mock 链。剩余面:客户端(api-client/web/RN)需透传 clientRequestId 才吃幂等 (b55f46c8b5)
- 🐞 수정:后台任务重臂按结算面/身份面分域复位(G-272) (34828b1db3)
- ♻️ 리팩터:rules 族本地 api 壳迁至共享出口 apiOrThrow 并摘零消费方壳文件 (ea570fc43f)
- 📚 문서:结清 2 枚(第 11 批:G-115 真分叉 / 第二个死端点簇) —— ①G-115 按 §24 机主令代裁并执行:不再等"谁在哪个窗口收敛",直接用仓内既定出口 node scripts/git-sync-converge.mjs 走索引层 union 合并(零触碰他人未提交文件),合并枚 f8c25b537b;现读 git ls-remote origin refs/heads/main = f8c25b537b07a68d9daea4d6a231e7d840441b83 = git rev-parse HEAD,git rev-list --left-right --count origin/main...HEAD = 0 0 ⇒ 部署环的"远端 tip 分叉且自动收敛无效"根因已消除。合并后回潮审计:本会话 23 枚结清行零回潮。②第二个死端点簇按席位二段式复量收口:六条(agent-reviews/wallet-bank-cards/messages-chat/course-annex/course-qa/course-resource)全部已有等价端点且在 HEAD——agent-reviews GET /api/agent-reviews、wallet GET /api/wallet/bank-cards(插件级 requireAuth)、messages GET /api/messages/private/list 与 POST /api/messages/private(checkAuth,senderId 取承载层 request.userId)、课程三屏走 GET /api/resources 与 GET /api/edu/qa 且 RN 屏已改指;阳性对照 invited-users 4 文件 7 行证明尺子有牙;零新增端点(重复造会与既有端点漂移)。受影响用例 Test Files 2 passed / Tests 14 passed。剩余面如实点名:order-log/order-track/vip-compare/message-group 四词另计;BankCardScreen 库无 bank_cards 表(无表可取)、三条课程屏缺 courseId 维度 ⇒ 产品语义缺口,非端点缺口 (fb77aa60b8)
- 🚀 기능/개선:帧名单源收敛到 CHAT_SYNC_EVENT_NAMES,sse 契约只引用不重写值 (54748ccdfb)
- 🚀 기능/개선:会话分叉端点收口(票60 服务端余格)——复用 sibling 版本族 + 幂等键 + 计数诚实 (5e72a6df8b)
- 📚 문서:O65 补回正式编号 O6501-O6513 + P0 四件翻勾(O6501-O6504) (4f2f9c8176)
- 🔧 기타:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (caee7106db)
- 🚀 기능/개선:O65 P0 安全护栏四件 —— 根护栏/成本熔断/影响面隔离与原子回滚/人工阀清单 (9caeac97d5)
- 🔧 기타:结清 G-941(成本账本按链别归一,249 passed+ruff+mypy strict) (a34df2bf63)
- 🔧 기타:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (c8f2750a5c)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ca97133f4f)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (90c0862194)
- 📚 문서:G-957 行内失真路径就地更正(票面挂点 login.tsx 已随 2026-10-23 定档删除/回传腿已由 webview onMessage 接管/scheme 已登记)+残余两格点名;主键·归属·租约三维守恒由 plan-task-index 当场断言 (3af96ef954)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ef3c8e667)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c98968e83)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8b9c604c8)
- 🔧 기타:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (864c743fac)
- 📚 문서:结清 79/B03 权限双轴化(运行时真接线) —— 席位提交 7f850459839024c3333ee5acb38fa75dc2aef774 共 12 文件 +1247/−53。主席自审复跑:apps/cli 三份新/改用例 permission-axis-runtime + sandbox-strict-default-on-missing-config + sandbox-profile ⇒ Test Files 3 passed / Tests 59 passed。落点:packages/types/src/permission-axis.ts(判定本体 evaluateAxisGate + granular 五布尔 + 归一化)、apps/cli/src/sandbox/permission-axis-runtime.ts(装配优先级:显式 > config profile > 五档映射 > 契约默认)、apps/cli/src/tools/index.ts(ToolContext.permissionAxis + executeToolCall 轴闸,覆盖 hub 分支)。默认值现读:SANDBOX_MODE_DEFAULT=read-only、APPROVAL_POLICY_DEFAULT=on-request、生产装配 DEFAULT_SANDBOX_PROFILE=limited ⇒ workspace-write(绝非 danger-full-access);未知值一律落 read-only/untrusted 并 warning(fail-closed)。单一真相源:三值/四值/五布尔仅存 types 包,CLI 零副本;check-declared-policy-has-consumer 与 check-permission-mode-vocabulary 均通过。剩余面如实记录:交互确认窗未真机走查、CLI 暂无 --sandbox-mode 旗标、loadSettings 不执行 layer-policy 项目层过滤(既有缺口与 sandbox 键同型) (823794e403)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (286ee41245)
- 🔧 기타:结清 G-863(附件容量改提交式CAS,18/18 绿) (8f39ff5ab8)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (02758036ef)
- 🔧 기타:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (7589a3fa87)
- 🚀 기능/개선:权限双轴运行时接线(79)+ 沙箱默认严档运行时强制补齐(G-212 第十一批 cli 半) (7f85045983)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8486d01dda)
- 🔧 기타:tmpdir 族 90 副本同据终清(折并器上限外交人工:票已结清,check-fixture-tmpdir rc=0 同据,全部副本翻勾即终态) (8115eb8c5c)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4f0075f311)
- 🔧 기타:结清 D22046(通道②③+比对驱动未变化承诺,cli 49/49+tsc0) (477ab648bd)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c248511bdd)
- 🔧 기타:G-212 结清——两侧齐(cli 半 goal-r57 严档+ai-service 半已自落本轮现跑 15 passed),翻勾条件成立 (c797e033c4)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af71cd1e10)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29c73b7469)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d6da34226)
- 🔧 기타:G-620 结清——两道 blocking 红(门150/门90)本轮现读全部转绿(桌面事件三层闭环通过阻断 0),跳门前提不复存在 (9b816186f3)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ea059635d)
- 🐞 수정:next-plan-id --check 重号判红改差值棘轮(存量只报数/新增才判红)—— 承 G-955 收口 (f6b9df39ba)
- 🐞 수정:G-957 网页授权回传腿失败态如实提示(换票失败/异常不再静默) (d47a2842a3)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d922ea918)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b546442d02)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9e49a4b02a)
- 🐞 수정:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (e48584bd7e)
- 🔧 기타:清偿叠注记存量 46→2(9 行折并,行数与勾选/租约/归属三维不变) —— 折并判据不另写:直接 import 守门 13d 自己的 noteTokensInLine / redundantNoteCountInLine(§0.6 单一真相源),对同一行内逐字相同的注记保留一份、删除多余份;全量档现读 叠注重数 46 → 2,残 2 份属承载段分词形态(判据计入但字符串面找不到第二次逐字出现 ⇒ 如实留报数,不猜不改)。本枚只动这 9 行注记文本,复合主键与正文语义逐字不变;门 13d 复跑 RC=0(差值档,存量只报数) (beaba75247)
- 🐞 수정:补齐漂开族折叠通道(--fold-drifted-families)的两处形状锁 + 补镜像测试 (36d800cb53)
- 🐞 수정:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (4c155346b0)
- 📚 문서:结清 G-926(lint-staged 已跟踪却被 ignore 的雷区)—— 席位提交 2c9d023f4b;主席自审复跑 node --test scripts/tests/lint-staged-ignored-tracked-ledger.test.mjs ⇒ tests 14 pass 14 fail 0。现值现读:[tracked-ignored] 面=head 存量只报数 12 条,git ls-files -ci 同为 12 且全在 .ihui-agent/archive(11 md + 1 json,唯一命中 .gitignore:186);票面 84 枚里的三族已由 41a3bdeeb4(取消跟踪 tmp 61 枚)、a402f50043(删 articles 宽式忽略)、8c952aac27(为 plugins/*.cjs 加负向例外)收口,故判 closed-by-others 未重做。archive 那 12 枚是门 71 archivedCopy 的归档凭据(读 HEAD/索引树),摘掉即削正当删行的依据 ⇒ 建议退跟踪 0 枚。另修一处恒红口径:旧 T7 把命中根 glob 记成失去 lint 覆盖,而 .prettierignore 早已整目录忽略 .ihui-agent/,64 枚系双计;新口径只问工具本体 prettier.getFileInfo(不另写 glob),限额 50 与给源码目录塞黑洞出口件必红的语义都不动,并加了正探针。三臂真 lint-staged CLI(--diff=HEAD,scratch 夹具):absent 报 git error、tracked 正常 Done staging 且索引 blob 未被改写、untracked 同 absent。剩余面:门 236 豁免按目录前缀放行,将来 git add -f 塞进 archive 的新件会被放行(动豁免语义需另票) (c683c71b8d)
- 🐞 수정:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (56227f8b33)
- 🐞 수정:为 gate #193 补 8 处 git 派生调用的显式 stdio (15372e4aba)
- 🔧 기타:api<T>234 迁移回潮副本同据复翻——goal-b15 S10 已结清(349e116a66+b3b3f64276),本轮同据复验一致 (59a3a90a56)
- 🔧 기타:结清 G-876/D195/G-937 三枚(注册验码/通知归档流/归档器B档,均带真跑证据入行) (3b1a29df96)
- 🚀 기능/개선:违禁桶兜底清扫器 strip-banned-buckets——两道机主禁令(等条件F12/待拍板F11)的执行器物化:guardian巡检轮 sweepBannedBuckets 派发(5min节流),自动摘HEAD面两桶未勾行并留痕f12-purge;判据import单源零复算;SWEEP-RESULT三态;镜像7例(留痕在落地之后/走object-space-land不自带CAS/已勾不进射程/scrub消费端对齐);AGENTS禁令条补点名+复翻席纪律(复翻须同步摘形态);自检5组+镜像7/7+eslint 0 error+clean态派发实测正常 (41988c0b3d)
- 🔧 기타:G-962 结清——高置信族逐条现裁全过时(computer-use 在册/announcements 公开族/members/groups/browser-sessions ai-service 全族/organization.ts 已亡),门 8 现跑通过;余参数段未判定=判据能力边界非死调用 (34ba9ee749)
- 🔧 기타:G-937 结清——根因已于枚 0b1d98107c 修复(seamArchiveChunk+§22c 镜像锁),归因档 c038a654db 为 HEAD 祖先,修复当日 113e612833 落地归档 24 枚;self-test 63/63+镜像 39/39+--list-blocked RC=0 现读,本行属门 239 型已归档票复活副本 (0d3969e1c1)
- 📚 문서:结清 dot-source 新鲜度维(第 4 批 1 枚) —— 席位提交 14a93e75b8032e067906e7c5cd750fd546bacbc2 只动 check-service-binary-paths.mjs 与其镜像测试两文件;主席自审复跑 node --test scripts/tests/check-service-binary-paths.test.mjs ⇒ tests 32 pass 32 fail 0。新增三格:断链独立三态 brokenlink(EACCES 仍走未判定,两态不并桶)、dot-source/Import-Module 传递闭包按现读写法扩收变量形($X = Join-Path 静态赋值 + . $X,RHS 非静态仍点名不猜)、每服务 fresh/stale/断链/未判定分桶入 renderText 与 totals。本机 nssm 不在位 ⇒ 现读 未判定 3(IHUI-AI-SERVICE/IHUI-API/IHUI-WEB),按 §0.3 不顶绿;真服务链上 stale/断链臂需有 nssm 的机器现读,属剩余面非本票射程 (ee2fc177e6)
- 📚 문서:结清 G-1222560 危险登记(索引面三份 web 语言包坏 JSON)—— 复跑取面:git show :packages/i18n/messages/web/en.json|JSON.parse=OK、ja=OK、ko=OK,HEAD 面五份亦全 OK ⇒ 他人暂存的坏索引现场已消失;该行正文自我嵌套 4 层副本并入注记+3 条同题原号指针,属票面腐烂,凭据以本枚现读为准 (a88a00a74d)
- ♻️ 리팩터:face-reader 判据符号单源化——BARE_GIT_RE/bareGitCountOf/hideComments 三符号自 face-reader.test 内闭包搬入 lib 导出(test 改 import,逐字零语义,G-927 同尺差集工具取材用;35 例面 34/1 棘轮红系他席在飞 G-927 收口的 10 枚新增待其落地后自然回落) (05a18375b9)
- 🐞 수정:服务新鲜度维收口三格(seat-svcfresh,G-1080903 回捞副本续)——断链独立三态 + 变量赋值 dot-source 解析面 + 每服务分桶现读 (14a93e75b8)
- 🔧 기타:G-955 复验结清——取号入口实测可用(next-plan-id --check 真RC=0) (7930521657)
- 🐞 수정:摘除指向已删路由 organization.ts 的死测试——HEAD 上该测的 import ../organization.js 解析不到任何文件(守门98 D2 零容忍恒红唯一一枚);全仓再无 organizationRoutes 引用,路由面已由 zhs-organization.ts 承担;与工作树既存删除(D, 他席在飞)同一处置,本次只把它材料化,不新建替代 (d35827d96c)
- 📚 문서:结清第二批 4 枚(工作已在 HEAD 或本批席位落地)—— G-343 / G-880 / G-32 / G-934 (c11e24d5f4)
- 🔧 기타:独立席四票复验结清 D04/G-934/G-924/G-239——票面自写判据逐条当场复跑,零复算 (7b562d0477)
- 🐞 수정:G-880/G-32 收口核验+成对自检补锁 —— 两禁令门(emoji/shared-layer)迁面与加固判据经现读确认已随 a6c7cb36ec 入 HEAD(listFaceFiles 按面枚举+readSources 同面取材,门内零 readFileSync);本批补票面硬要求的两把缺失配对锁:三面同形干净仓⇒三档全0(防恒红,W10 型)与 --staged/----worktree 两面旗同给⇒main 返 2(§0.4 互斥)。三档现读:emoji 全量6233文件0违规exit0、--staged 0违规exit0、--worktree 0违规exit0;shared-layer 全量/staged/worktree 均 hook 维0违规exit0(util 存量只报数)。镜像测试 emoji 17/17、shared-layer 12/12;check-gate-wiring --strict exit 0 (390d395038)
- 📚 문서:O65 自进化 13 任务补正式编号 O6501-O6513(以 HEAD 为底稿恢复回潮丢行+编号派生侧车键) (702373ef97)
- ♻️ 리팩터:G-343 DRIVEROOT 族残余清零(票面四处全数核对)①②已由 852c9409 收口(audit 私有 devEnvRoot()/pgBinDir() 与失真头注、app-reads:56 硬编码盘符推导现读复验=族内生产文件仅 import lib/psql-client-locate 单源,无第二份推导);③现读补出=pg-restore-drill.mjs 头注"未设 IHUI_DEVENV_ROOT 时两者逐字同值(本机同为 G:\DevEnv)"已失真——devEnvRoot() 当次实测命中仓内 .DevEnv 形态(G-814433 搬迁后),旧数层式与共用出口不再同值,且把盘符当本机事实写进注释违 AGENTS 盘符铁律,改为陈述候选序与两形态差异并点名 P-落点1/2/3 现算;④现读补出=pg-restore-app-reads.test.mjs:49 在测试里重算 IHUI_PG_BIN_DIR||join(devEnvRoot(),...) 第二份 pgBinDir 判据体(§0.6/§22c),改 import ../lib/psql-client-locate 的 pgBinDir() 与工具同源。复跑凭据:audit --self-test rc=0(取证在镜像测试)+ audit.test 连跑三次 59/59 pass;app-reads.test 8 pass/3 skipped(未判定:psql.exe 不在位,环境闸按设计);drill.test 29/29;守门45 check-c-drive-paths 全量档✅、check-workspace-hygiene HEAD 面✅无新增违规 (caef8d065d)
- 📚 문서:维③ 头注实测数改正——70 份叠注里 49 份在承载段内、21 份落活文本(此前误写 72/51);纯注记订正,判据字节未动,自检仍绿 (9129d9253e)
- 📚 문서:结清 7 枚僵尸票(活已在 HEAD、行未摘)——分割线 G-877、判据盲区 G-879、原生弹窗 G-878、MCP stdio 四票 G-689/G-691/G-692/G-694 (6c6efc415b)
- 🔧 기타:G-874 结清——web 注入两调用点+共享按钮消费+login 族 30/30 绿;原生 WebAuthn 免依赖方案优于票面;未注入不渲染=平台豁免成立 (0cd4af3484)
- 📚 문서:O65 侧车键由 自进化# 收敛为编号派生 O65xx#(13 条) (62a6546229)
- 🔧 기타:G-957 剩余格改归属机主小程序后台白名单面(正规改桶通道 LIVE_BUCKET_RECLASSIFY,actionable→owned-elsewhere;格②已入库凭据在案) (6dbb495b4d)
- 🔧 기타:G-63侧车重钉(union带回旧记录终修),A2归零 (f3fbf0bbba)
- 🔧 기타:G-934 结清——出路①接线三轮凭据在案(47dc360911 实体测 13/13 本轮复验+56cc4a66f4+847925be2b)+§17 真浏览器核验已落(82c9a68ae0 四例两轮绿);10 红前提过时 (80f8fb9f23)
- 🐞 수정:维③叠注存量归零——判据剥「副本正文并入·承载整段」平衡段(逐字引文非活注记,72→21),活文本按逐字同串摘 21 份(L5361 x1/L28173 x18/L28911 x2,只删同串不并族);自检10/10、镜像14/14、行数/勾态全等 (75d303394e)
- 🔧 기타:G-876 结清——实现已在库(code 必填+503 fail-closed+用途锁+防枚举,枚 9e103ac0f6),G-81 席复验 auth 1311 全绿背书 (217be03c9f)
- 🔧 기타:F4末2组收口——O-02摘旧底稿裸行(正主带租约+③格注记)/G-116摘旧句(正主标头规范),留痕f12-purge (6309556402)
- 🔧 기타:F4四组+跨号副本收口——G-1222558错号/G-937裸副本/G-10旧句/G-11旧句/B02旧副本各摘副本侧留正主(留痕f12-purge);union回潮体清偿末批 (32b2a83941)
- 🔧 기타:G-963 结清——修复已落库(测试文件 G-963 注记在案),现跑 f9 族 10/10 绿零 ERR_MODULE_NOT_FOUND (eac4da4f06)
- 🔧 기타:G-74 远端合流回潮体复翻——并发席已结(d5cce09f8c 校验收口+sponsor 地址在案),配置面余格归机主面行承接 (9b66a50d77)
- 📚 문서:O65 自进化战略方案文档 + 13 条派单侧车记录 (76f6b4891c)
- 🐞 수정:补回索引迁移时误删的三门点名(守门89 R4)——check-ai-task-background-reference(247)/check-money-display-single-source(248)/check-registry-sync-health 只存在于被删的旧副本里;91,095→91,589B(余量 4,411),标记仍为 0 (af3da98e1c)
- 🐞 수정:摘除门249内联点名行——README 索引节已收录该门(4165487e5a),R4 文档面由 README 承载;AGENTS 91,293→91,145B(余量 4,855),冲突标记保持 0 (09498f86d2)
- 🔧 기타:远端合流回潮第三批复翻 4 行——G-76 守门39(83aa572b23e)/G-38 视觉票(r3c)/D42046 巨行(603d8236d8f 同据)/G-60 content-visibility(522ac4dac2+回归锁 7413f9fd31);凭据全验祖先 (a2dab37433)
- 🐞 수정:修复 union 冲突标记注入体并摘除回潮索引副本——108,200→91,293B(余量 4,707);标记区取「索引已迁 README」侧,补点名门249以满足 R4;被删索引块 127 门名经 README∪本文零丢失;实读:check-agents-doc-size --worktree rc=0(91,293/96,000)、check-gate-wiring --worktree rc=0(R1/R2/R4 零红) (c4afc6a953)
- 🔧 기타:F9撞号3组收口——G-07副本自声明行/G-27错挂旧号行/G-76回插已结清题的正主位保留副本行摘除(各留正主行;留痕f12-purge) (5fe4d76372)
- 📚 문서:守门 249(富文本锚点渲染器单一源头)补进「守门脚本点名索引」的接线/自检行 —— 门 89 R4 义务;207 第二刀把索引整体迁本节后,新装车的门必须在这里点名(原 AGENTS 内联副本即将随冲突标记一并剥除,AGENTS∪README 文档面不得出现空档) (4165487e5a)
- 📚 문서:O65 登记自进化四期可派单任务 P0-P4 (b19e8ebb21)
- 🔧 기타:两票结清——desktop-feed 线上现读 0.1.76(2026-10-18 发布,远超 0.1.45 验收目标,前提过时);128 点迁移归档票复活活行复翻(门 239 R1 型,归档注释逐字在案) (4879305684)
- 🔧 기타:D03侧车重钉(owner=持有席/waiting=none)——union带回旧记录的终修,F12基线棘轮归零 (42af89577d)
- 🔧 기타:守门8假绿灯远端合流回潮体复翻——凭据 1d5e73e2d3(goal-r52 收官+三路径查清),修正归扩面批次 (8ce176c228)
- 🔧 기타:union回潮体清偿——对侧旧底稿灌入的违禁形态行摘除(等条件+待拍板未勾行,留痕f12-purge;两道机主禁令之下union行级回补不带违禁形态;goal-r4复翻席注意:复翻时须同步摘禁令形态,行的事实内容已按各批结清提交保留) (382d4dc4c0)
- 🚀 기능/개선:G-50 DevEnv 搬迁执行器物化——devenv-migrate.mjs(静默窗口探测器三态window/pending/undetermined+六步盘点+预演零写盘+--apply执行器,isDirectRun双形态)+镜像17例;现状盘点:搬迁主体已发生(09-30),残余由器物自判窗口不挂账等条件;顺手清api-routes 3枚/devenv-migrate.test 2枚/dedupe-live-doc 1枚解构残量unused(union带入机械残留,零语义) (f2ddfe9b9e)
- 🔧 기타:goal-r4 远端合流回潮第二批复翻 13 行——tmpdir 孪生/四件待拍板版(事实四件已落地,待拍板定性作废)/P2-13③孪生/MCP四票(goal-r3 r27i)/失败广播/G-217/G-239/D04;凭据=各批结清提交+新鲜现读(夹具门 rc=0/邮件鉴权在位/守门249 rc=0) (04f4ca3e86)
- 🔧 기타:H02 远端合流回潮体复翻——凭据 eff4b6d5bd 已推远端,裁决同前(结构性无样本,只记不挡维持) (ef210af486)
- 🔧 기타:goal-r4 远端合流回潮体批量复翻 34 行——Esc×4/窗格×2/工具面板/O-1/G-939/守门134/四维/取消信号/宿主中止/审批CAS/守门91/G-27/真机走查/prod-bundle/四件拍板/G-35/G-61/G-76/G-807/发丝线/锁初始化/P1-②/G-77/钩子取消腿/AGENTS体积 等,凭据=本会话各批结清提交(全已推远端);行内逐条防新鲜牌(0 冲突) (7df8da52ec)
- 🐞 수정:R5撞号收口——摘除两枚复活门注册块(bare-decode-uri/token-literal-debt,门体脚本已被对侧删除,注册残留=HEAD面247/248双撞号源);富文本门已改号249保留,盘面 idsOfRegistry 现读各1次 (464cc8efaa)
- 🚀 기능/개선:auto-evolve 起会话通路端到端打通(O65 第 0 期收尾:JWT 现签 + --probe 自检 + 真派验证) (87a7713ccd)
- 📚 문서:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (61496e7201)
- 🔧 기타:goal-r4 结清 D04 富文本动作锚点——验收三格全齐(浏览器五例/两腿 DOM 签名等值+语序两态/规模化两载位齐:degradeHint+examplesTip+wallet strong,载体 importer 6 个),守门 247 现跑 rc=0 (e8423e37eb)
- 🚀 기능/개선:web↔RN 屏对齐登记 41 条 + 把跨端自动登记器装进 post-commit 链 (6ad5de3c37)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1081dca6e1)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (194de04708)
- 🚀 기능/개선:跨端登记自动器装车 + 3 条真镜像声明与 1 条 web→RN 映射 (5f1d02f835)
- 🚀 기능/개선:O65 第 0 期翻勾(调度器+四道闸随批完成,验收证据入注记;代码枚 0e4bd3628db);1-3 期补立档日期交代(三选一:新鲜日期,按依赖序排队) (b1ffbc4b23)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab3bc7beb4)
- 🚀 기능/개선:auto-evolve 自进化调度器第 0 期落地(总纲 O65·调度层+四道闸) (0e4bd3628d)
- 📚 문서:更正 ContextUsagePanel 的过时披露 —— RN 腿已接通,并点名新落的那把锁 (6abb419f66)
- 🚀 기능/개선:上下文占用归因面板接上 RN 主屏 —— G-403/G-225 缓存两维的最后一格 (8ce7d87758)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0166713afd)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7faaebcc51)
- 🚀 기능/개선:登记 AI 自进化调度系统 auto-evolve 四期系列总纲(O65;第 0 期调度器+四道闸随批施工,感知/部署/回流三期按依赖序排队) (164b973cfe)
- 🚀 기능/개선:G-217a 点赞/收藏两表唯一键迁移 —— zhs_agent_thumbs/zhs_agent_collect 加 (uuid,bot_id) UNIQUE,把上一批(22ee752721b)靠事务 FOR UPDATE 父行的防重底线放进库层:2026-10-25 实测该族缺陷正是『一次点赞计数+2、取消只减一次』,应用层锁管住今天的写口,管不住未来绕事务的批量导入/人工修数(无约束=漂移只在计数与明细分叉后暴露,而全仓无 count(*) 对账)。线上两表 0 行,零回填成本。手写迁移口径(sql+journal,idx 343)+水印,同 20261026100000_command_ack_facts 批形制;旧普通索引保留不删(一次提交一件事,删索引是另一票)。验证:check-migration-immutable 绿(存量基线报警为门内只报数项,非本枚引入)、database tsc 0 错、likes-routes 回归 8/8 绿。 (c92836e7e7)
- 🚀 기능/개선:ActivityDetail 接线 + web↔RN 屏对齐登记 7 条(教育/公告/问答/权限/agent 家族) (fb58a90253)
- 🔧 기타:refactor(web,mobile-rn,miniapp)+feat(gates): 显示层分→元格式化同形副本 20 处收口 formatPrice 唯一出口 + 装守门 248 —— fmtYuan=¥\.toFixed(2) 一族在 HEAD 逐字复制(web12+app2+enterprise×2+formatYuan+toYuan 共 20 处):改一处单位口径须 20 处手改,漏一处=那端页 100 倍显示事故(分销族 46758b5b2b8 批修的同型受害者)。全量委托 @ihui/shared/utils formatPrice(非有限回 0.00,定长两位,¥ 前缀归调用面维持版式)。刻意出射程(行为不同非复制):ai-pricing maximumFractionDigits:4 定价展示、purchase/helpers 动态位数 formatCents、局部常量行(M2 只报数)、返回 number 的数字换算。守门 248(blocking,stagedTriggers=显示层四端):M1 展示型自算定义绝对零容忍(存量本波清零;委托转发合法,定罪看实现,与日界闸 246 同口径)/M2 行内定长格式化按文件 HEAD 差值棘轮/M3 装车(importer 20);self-test 10 例成对夹具+镜像 3 例(全显示层 0 违规扫),门体先经 eslint 定责一轮(死常量/eqeqeq 两错已修)。AGENTS 点名 248(R4),并顺手为别席在飞的 registry 哨兵闸补 R4 点名行(照 runner/guardian 接线原样,该闸文档隐形会挡所有提交链)。AGENTS 先过 merge-live-doc 归并(lost=0)。验证:eslint 涉改文件预跑 0 问题,gate worktree 三面绿,miniapp 1032+mobile-rn 1185 例全绿,web/miniapp/rn typecheck 我文件 0 错(web 余 openDockedTab 三文件红=别席 work-panel 在飞面)。 (0d2a23f970)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d8116c1b9)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd997d68b7)
- 🐞 수정:收敛预解第二轮 —— G-55 就地翻为对侧结算行(四项已在库,本席==基底旧态由本行承让),删除尾部 dump 区的守门 89 R9 重复块(首份完整保留) —— 为 union-converge 预解 F1 最后一组与 F6 最后一块;两侧独有行零损失由 union 模拟 REG=[] 现证 (07ea442ded)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f39e473af)
- 🐞 수정:在途请求覆盖新态四格根治(前端清单收尾批)+形状锁 —— ① TrendChartDialog:弹窗重开/换 itemId/换窗口连发,慢的旧窗口响应覆盖新曲线且旧 finally 提前熄灭 loading;② learn/topic 付费课:切课时旧列表迟到响应串进新页;③ ide/mcp-pane DetailPanel:常驻不重挂载,切换选中项时迟到详情张冠李戴;④ ModelDetailDialog 行过滤 .filter((r)=>r.value) 把合法 0(免费模型 inputPrice/outputPrice=0)当缺失吞整行,读作『无此项』——改判 !=null && !==''。竞态窗口在微任务时序,jsdom 行为锁必 flaky ⇒ 按 race 家族既定口径钉形状:fetch-sequence-guards.node-test.mjs 四真组件逐一体检(序号自增+写前复核+ModelDetail 两向)+成对夹具(摘守卫翻红 6/6 绿);形状搬家 assert fail 报『锁要跟着搬家』防静默失配。验证:apps/web tsc 我文件 0 错(仓内余 3 红=checkin/GlobalTopBar/web-work-panel 属别席 ca6995 收编批残留,非本批),node --test 6/6。 (5e1978b98a)
- 🐞 수정:三方归并预解——增长图取对侧 57d951 柱形新形态,本席重排保留,并全文件格式归位 —— 别席线形图(1fb44)与对侧柱形图(57d9=14 根太密⇒interval:2/纯柱形/柱顶不标数)是同功能两种写法,取新者;重排四档(wb-prio-user/ai/traffic/trend)+KPI 双卡前置+业务面板用户三格提首/接口排行下移,均在对侧底版上三方重放(merge-file,唯一冲突=图定义二选一,已按裁决留柱形)。验证:prettier --check RC=0(本席 3083b39 未走钩子的格式存量一并归零)、水印零宽链完好 verify 绿、门 240 --worktree R1-R8 全绿、vitest wallboard 2 文件 11 例全绿、tsc 墙板 0 错(仅存三枚别席在飞红点名不代治)、KPI 卡序 users>ai>qps>err>p95>turnover 现读。为 git-sync-converge 的 --resolve 页面路径预解:本面已含两侧全部独有行(对侧逐字打底),收敛无需人工 (584041c957)
- 📚 문서:登记 decode 家族单源收口(移动端深挖批唯一遗留:auth oauth2 私有实现 + 门248 D2 九处) (5e38613843)
- 🐞 수정:重锚机主 2026-10-25 定档首屏重排 + 补回被连带洗掉的增长曲线定义 —— 别席 ca6995ca20b(自动收编在飞副本)把 page.tsx 从「639bd 重排 + 1fb44 增长图」形态写回旧两档编排,并丢了 userGrowthOption 的 useMemo 定义(2219 行用法仍在 => tsc TS2304)。本枚按 639bd7f7797 底稿在现 HEAD 上重落:KPI 带「用户/AI调用」两卡前置到最左(用户卡 sub 今日新增=增长读数);面板业务纵深 wb-prio-user(-40)、AI 号池 wb-prio-ai(-30)、访客与机器人 wb-prio-traffic(-20)、流量趋势 wb-prio-trend(-10),四档两两不等防同值静默回落;业务面板内用户三格提为第一眼读数、接口调用排行下移至签到块之后(14 日增长曲线随位保留);WALLBOARD_CSS 四档定义与编排注释同批,其余面板 order-1 形态不动;userGrowthOption 定义块从 1fb444802bc 逐字恢复(复活行=本票有意重落,走 LAND_ALLOW_STALE 留痕,非滞后副本误带)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格)、apps/web vitest wallboard 2 文件 11 例全绿、watermark verify 载荷完整、check-i18n-keys 19187 键 5 语言 parity OK(本批零新键)、apps/web tsc 墙板 0 错(仅存错=checkin/GlobalTopBar/web-work-panel 的 openDockedTab/onHome 三枚,系别席 work-panel.ts 在飞未落,本票不代交点名在此)。并发说明:普通提交路径仍被别席在途文件占用,走 object-space-land 只交本票一文件 (3083b390c9)
- 🐞 수정:union-converge 冲突标记闸补接 import —— 2026-10-25 头注的闸只写调用未引 lib/conflict-marker-guard 的 assertNoConflictMarkers ⇒ 本器任何带 <<<<<<< 的树内容在 writeBlob 处 ReferenceError 崩(实测 dry-run base=a6c3c036be ours=本地线 theirs=179fc770b5a 即崩,RC=2 未判定),收敛器全程瘫;补一行 import 后同输入 dry-run 正常出闸(CHECK ONLY 正常走完,落地闸 3 处为真实内容裁决)。修复凭据=§1「能当场修的当场修」+本席收敛作业被此 bug 挡住的直接受害现场 (df25853257)
- 🐞 수정:墙板页剥回成对冲突标记 —— 11:18 手工收敛把 merge-file 原始标记带进 main 的清偿(零内容变化) (3363928c6e)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc7389109e)
- 🐞 수정:三族小面根治+一批测量基建纠错 —— ① packages/shared usePaginatedList 补序号守卫(末发定案:后发请求落地前,先发的任何迟到响应不写数据/不写错误/不翻加载位),此前筛选切档与在途页互盖:旧结果 setItems 替换新第1页、把页游标偷换成旧页号(下次加载更多直接跳页缺页);web/RN/miniapp 三端共用该 hook,守卫随源生效。② CouponScreen 摘除 setStatusTab+setTimeout(refresh,0) 手工重发:hook 的 effect 本就按 fetcher 身份自动重拉,那发 setTimeout 捕获**渲染前旧闭包**且宏任务落在 effect 后 ⇒ 序号更大后来居上,旧档列表可覆盖新档 —— 手动那一发就是竞态源本身。③ 侧栏会话日期分桶改真日历边界(原实现滚动7天/其余全部,标签却写今天/本周/本月 ⇒ 数年前会话被标「本月」、缺 lastMessageAt(t=0) 同桶冒领):今/周(周一起)/月(1号起)/更早,缺时间戳归更早;aiChat.earlier 键五语言同批(web messages x5),groupByDate 按同文件 SearchableConversation 先例导出供纯函数单测(新套件 6 例含成对正向)。④ 测量基建纠错:apps/mobile-rn/tests/use-paginated-list.test.ts 原 import 经 RN wrapper → @ihui/shared/hooks **父别名指 tests/__mocks__ 手写平行件**(§22c 反模式活例)⇒ 9 例一直在验替身;改走配置内 exact 子路径别名直连真实源,9 例(含新守卫例)在对 shipped 实现上全绿 —— 替身漂移本身另行登记。⑤ 上一枚 history-page-hydration.node-test.mjs 水印载荷修复(手写头行截短致残迹,verify --staged 现形;clean+重注入 0 不合格)。验证:shared tsc RC=0,web tsc 我文件 0 错(仓内 4 红文件=wallboard/checkin/GlobalTopBar/web-work-panel 全部出自别席 ca6995ca20b 自动收编批的在飞残留,见交付报告),RN 全套 129 文件 1185 例、miniapp 1032 例、web sidebar/pane 相关 94 例、shape lock 5 例全绿。 (0d036f9909)
- 🚀 기능/개선:补 4 条镜像声明(change-phone/change-pwd/help/point-history)——小程序页早已存在,只缺标记与登记 (22b3697a52)
- 🐞 수정:旁路落地器补「成对冲突标记拒绝进树」闸 —— 79 看不见不走钩子的通道,牙装在写口上 (a844588db0)
- 📚 문서:结清守门 207 存量清偿第二刀——AGENTS 108,515→89,968B(余量 6,032),三面 rc=0,238 同批复绿 (1377bdc7b2)
- 🐞 수정:并发合并把「国内镜像」徽章带回 —— 按 2026-10-23 机主令重新清除(守门 238 复绿) (995ecb1615)
- 📚 문서:守门 207 存量清偿第二刀 —— 点名索引迁 README + 速查区压缩副本移出(108,515→89,968B,余量 6,032) (8e99bd5626)
- ♻️ 리팩터:抽离 git-guardian 的 TEMP 清扫与日志两族到 lib 以压住架构门 103 C1 单文件行上限（主文件 6094 to 5837 行） (8fe1fb2f10)
- 🚀 기능/개선:首例真实镜像页——用户协议 pkg-about/about/agreement (aa4c418bff)
- 🚀 기능/개선:补 study-index 镜像声明——pages/study/index 与共享屏 StudyIndexScreen 同为学习首页(taro 端内重写渲染层,按门 128 语义声明对齐目标);此前只缺标记与登记 (84b9acc2c0)
- 🚀 기능/개선:补 coupon 镜像声明——小程序 pages/member/coupon 与共享屏 CouponScreen 键空间完全一致(coupon.available/used/expired),此前只缺「镜像」标记与登记 (652e5b052b)
- 🚀 기능/개선:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (481fd87095)
- 🚀 기능/개선:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (fe0abab5b2)
- 🐞 수정:AI 侧栏历史翻页双缺陷根治(判高两条,前端清单回源仍活) —— ① 根窗格 handleLoadMoreHistory 原 res.data.messages.map 手工造行只留 id/role/content/createdAt,绕开水合出口 ⇒ 翻上来的旧消息丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex(版本族判不出⇒点一次编辑出两个气泡);改为与首屏(:676/:732)及非根窗格(chat-pane-body:222)同一出口 hydrateHistoryMessages。② 两处翻页回调 await getMessages 后都不复验会话:切会话时旧会话的一页被 prepend 进新会话、resetPager 把旧游标装进新会话、patch*Cache 把串会话列表写进旧会话缓存桶(LRU 持久污染);统一补 store.getState().conversationId 复验且先于一切写入(window 窗格体与根窗格同修)。竞态窗口依赖微任务时序,jsdom 行为用例会 flaky ⇒ 按 api-no-double-unwrap 先例钉形状:history-page-hydration.node-test.mjs 抽函数体+三判据(水合出口/复验存在/复验先于写入),2 文件×(正向+三型变异夹具)+良性对照 5 例全绿,摘任一判据即翻红。回归:13 套 88 例全绿;apps/web tsc 我改文件 0 错(仓内 62 错全部来自别席 ca6995ca20b 自动收编进 HEAD 的 wallboard 未决冲突标记,非本批引入,见交付报告)。 (dd56090e92)
- 📚 문서:207 第二刀① 落地登记——归档移出凭据接线(判据单源 + 两个消费面),票保持未勾 (dbf38b926d)
- 🚀 기능/개선:RN→小程序 镜像缺口账本自动化——139 缺口逐条带候选线索 (f67090ac4f)
- 🐞 수정:清掉上一枚带进来的 1 个 error + 收口一处既存 eqeqeq (0bb9bfd89c)
- 🐞 수정:AGENTS 归档移出被当成丢行 —— 第四态凭据接线补齐(守门 207 第二刀①) (b6023aa977)
- 🐞 수정:合并回填本侧独有词条——miniapp 5 语 ×81 键 + mobile-rn 5 语 ×273 键 (2f651b8ce1)
- 📚 문서:对外文档数字/端数口径收尾 —— README 瘦身版尾部旧版碎屑整段清除(7082→6007 行:八端清单/176 models SEO 段/两行矛盾结尾/孤立表行,主体均有现算版);L183 IP 白名单『只存不拦』过时表述改实链事实(ip-whitelist-guard.ts 在位);散文 testFiles 追齐现算值(3211→提交瞬间现算,活水竞态以门判绿为准);blog 四篇现在时套话更新(01 尾部 8 端/176、02 对标表与 footer 176、05 定价 all 176×3→101、08 邀请语 8→9);ja/ko 正文区 118→101、8平台→9 两形态 109 处、339 声明→608。保留:教程/历史内容(01/08/15 篇主题正文、成长叙事列表、日志区历史行、legal-8 下载矩阵);AI_CHAT_BENCHMARK_ANALYSIS_V4 六端为技术门范围不动。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:README.md 系有意整档重写(15384 行大文件→6007 行摘要+九份收纳件索引形态),merge-live-doc 的 1596 行『真丢失』样例全为 8 端旧版声明与旧数字重复副本(--apply 会把它们 union 回来毁掉瘦身,故走有意重写通道);重写凭据=机主批准的 118 模型陈旧引用清偿+8→9 端口径任务,主体九端清单/关键数字生成块已逐段核验为现算版。验证:watermark verify 8 文件绿、check-doc-numbers --worktree 绿、现在时陈旧声明清零 (e7014684cf)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29582c20a8)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f7efe9cf8)
- 🐞 수정:合并后撞号收敛——check-bare-decode-uri 让出 241(远端已占,check-rn-readout-cell),改号 248;判据与 skipEnv 一字未动 (68c00a3a05)
- 🚀 기능/개선:资源目录同步停更哨兵三件套 —— 760 条全军只有一行 WARN 的静默型,自此当轮即红、恢复即绿 (0dd89c37e9)
- 🚀 기능/개선:出口代理闸 IHUI_REGISTRY_EGRESS_PROXY —— marketplace 直连抖段的运维旋钮(默认关=行为零变化) (7fe57853cf)
- 🐞 수정:registry 批量 upsert 批内复合键去重 —— 上游 offset 分页重叠让整批 760 条全军(PG 21000) (33cf83062e)
- 🔧 기타:治四处存量"代码对、锁旧"的源码漂移锁 —— 锚句跟着判据形态搬家,同时补变异自证 (91272a063b)
- 🐞 수정:门 103 C1 二次超限收口 —— git-guardian 六块 141 行注释逐字归档换指针(零行为变化) (1f9a9a6fa6)
- 🐞 수정:端内测试停止越层 import repo-tooling,清偿架构政策 D1/D2 六处 (4e2758c740)
- 🐞 수정:207 第二刀票改"未取号"形态——G 族号池 pool-exhausted(占用面含 42 份归档件)，令牌残留是 G-15107 格①用法错，绝不发 1000+ 号；待号池扩容批补号 (87d1f894e7)
- 📚 문서:登记守门 207 存量清偿第二刀(前置=补 declaredDropCaps 认 AGENTS 归档移出,防回潮吞掉第一刀成果;现读缺 9,156B)——第一刀已落枚 c9c85d63 (5f4bafc488)
- 📚 문서:守门 207 存量清偿第一刀——速查区回潮副本 34 行整区移入 archive(125551B→105156B) (c9c85d639c)
- 🐞 수정:门 128 两族判据射程差豁免登记 + 门 77 B1 wallboard 圆角绕档清偿 (a35ac94b7d)
- 🐞 수정:字形箭头与双返回箭头清零——Collapsible 文本字形换矢量图标 + 五 pkg 页摘页内死返回键 (8f26a1f779)
- 🔧 기타:门 241 镜像测 T1 前提断言改大小写不敏感 (3a893d1481)
- 📚 문서:守门 241(裸 decodeURIComponent)R4 点名行 (8ffd95d1dc)
- 🐞 수정:移动端行为级深挖批——裸 decodeURIComponent 族 21 处从底层修复 + 守门 241 防回潮 (815bfe638f)
- 🐞 수정:RN 样式裸数字回潮锁改号 240→247——远端 f126e734 已占 240(大屏读数不得断行门),合并前让号,判据与 skipEnv 一字未动 (284aa41062)
- 🔧 기타:门 240 判据镜像测试——3 例直接 import 源脚本 __test__(§22c,判据零复制),含阳性对照(把 rnSpacing.lg 改回 16 必须被抓) (1dfe636e62)
- 🚀 기능/개선:新守门 check-bare-decode-uri.mjs 接进提交链 (6a3e148297)
- 🚀 기능/개선:新增门 240 RN 样式裸数字回潮锁(差值棘轮)+ runner 接线 (d066355a35)
- 📚 문서:点名门 240 RN 样式裸数字回潮锁(与接线同批;AGENTS.md 超体积预算暂不写入,README 已满足 R4) (d562ca2018)
- ⚡ 성능:跨端两把尺子改批量取 blob(HEAD 面 4 分钟→17s) + web→RN 尺支持 --full + 6 段 web-only 豁免 (da67136b16)
- 🚀 기능/개선:补 4 条 about 族镜像声明(账本真实化,零行为变化) (f97405f954)
- 🐞 수정:web→RN 功能尺三屏误报根治 + 删除一条不存在的 web 路由登记 (89239b8d3e)
- 🚀 기능/개선:token 化批 #6 第 5 批(收尾)——21 文件裸数字转档 (3d8a7a3355)
- 🚀 기능/개선:token 化批 #6 第 4 批——60 文件裸数字转档 (0088fd044e)
- 🚀 기능/개선:token 化批 #6 第 2 批——60 文件 1020 处裸数字转档 (5308e7aaf5)
- 🚀 기능/개선:token 化批 #6 第 1 批——tokens-migrate 扩为目录批量器物 + 60 文件 1583 处裸数字转档 (e506840fc0)
- 🐞 수정:普查锁两 offender 清零——VoiceNote/LlmSettings 裸 TextInput 迁共享 TextField (e9226cbb50)
- 🐞 수정:活副本纠偏批——上轮把 account-cancel/app-topup 判死副本是反的:现读 RootNavigator 1037/1048/1087 挂载体=packages/app 版,二屏 Modal 缺 onRequestClose 即安卓返回键在注销确认/充值说明穿透弹退出应用(与 MemoryScreen 同型,补 onCloseModal/onCloseIntro)。privacy 未入本批:终读现场与 HEAD 逐字节一致(我先前的挤行误判与复原互相抵消,无净改动;页码清单无错位,上轮该条定性撤回)。遗留如实:(a)packages/app 两屏标题硬编码(注销账号/充值)属 i18n 队列射程;(b)SDK 清单与 Expo+RN0.86 真栈脱节为法律文案,归机主/法务 (6e5cc2e93b)
- 🐞 수정:行为级 bug 两枚——① VoiceNote 语音笔记面板:RN 原生 Modal 自成窗口不吃外层 KeyboardAvoidingView,面板内搜索框弹键盘后操作行整块顶出可视区(iOS/小屏安卓必现,Modal 内键盘关不掉)——避让容器移进 Modal 内侧,iOS padding/安卓 height;② packages/app MemoryScreen 新建记忆 Modal 缺 onRequestClose:Android 返回键不关弹层反弹确认退出——与右上角取消同语义接回 onCloseCreate。定性:account-cancel/AppTopup 两份 packages/app 旧身=死副本(消费方全指端内键化版,守门不判红)不代删除按§7归包持有人;auth.ts login 抛错为设计契约调用方统一兜;VoiceNote 已有 onRequestClose 不重复补。验证:RN tsc 0 错、vn-mount 13/13、eslint 0、水印 2/2 (60e2c90099)
- 🔧 기타:F9 分批收敛 #5(终)——CSRF 行 G-12→G-02、两版F5 行 G-30→G-18(双侧真声明位零 + 239 归档 marks 过滤验证);五门现读全绿(strict F9 0 组/234 warn/239 0/211 0/13d 0/71 无丢失)——机主授权合并背景 (87338aa530)
- 🐞 수정:auth.ts 支付宝回包防护补丁自纠——上一枚提交里 info 类型注多套了一层 .response(TS2339 ×2,miniapp tsc 当场红),语义层级回归 parse→.response→{nickName,avatar} 真形 (20c8ba1c13)
- 🐞 수정:逻辑级 bug 三枚——①充值自定义金额 Number('9.9')*100 浮点毛刺直进支付订单(分语义被打成 990.0000000000002),对齐 CartScreen 既有 Math.round 范式;②credential-storage 裸 JSON.parse:AsyncStorage 半截写/手改/回滚脏数据在启动链抛 SyntaxError 打断记住账号预填,降级为无记录(后续 persistedAccount 覆盖);③miniapp 支付宝 getOpenUserInfo 取消/异常回包 response 非 JSON 时裸 parse 打崩整条登录链,降级空资料走既有手动补路径。定性留档:定时器清理全配对/formatDateByTemplate 带 tz+NaN 守卫/totalFee 经 zod int 非空/支付按钮走 paying 锁+disabled——四类候选核实为健;Clipboard try 豁免=RN API 不抛;CONTEXT 崩溃上报未脱敏一条已漂移(现码过 redactCrashText) (92e31d50fa)
- 🔧 기타:F9 分批收敛 #4 终版——Agent SDK 票:原 G-06 行插回存续(门 71 编号行不丢)+ 行尾让号注记 + 未取号行承载实际推进(行内交代归属=qoder-maxpar)+ 旧 G-36 双行摘除留痕 + merge-live-doc 归并(lost=0);五门现读全绿(71 无丢失/239 0/211 0/13d F10 2→2/234 warn)——机主授权合并背景 (688b7ce6be)
- 🐞 수정:backup-pg-local 追到断链根因——pg tooling 已迁 D:\ihui-pg\16(服务镜像为证),脚本写死旧卷 D:\DevEnv\runtimes\pgsql 失踪后,wscript 启动的计划任务看不到 pwsh 的 CommandNotFound ⇒ 本地 dump 静默停摆一个月(P7 只量到副本侧,源侧 P5 格当时未判定)。路径更新 + 新增'pg_dump 不在位必写 backup.log 再退'守卫——停摆必须留下可被人量到的痕迹,任务面 Last Result 0 是谎。实证:修复后手跑 EXIT=0,backup.log 落 10-25 01:16 OK 9.6MB 新行 (de4073ff04)
- 🔧 기타:F9 分批收敛 #3——取号器行 G-48→G-90(G-48 被远端新纪元 F1不认行占用,重让;PLAN 全文零出现的 G-90 空投)——五门现读全绿(strict F9 撞号 0 组/234 warn/239 0/211 0/13d 0) (73c966154a)
- 🔧 기타:F9 分批收敛 #2——取号器行 G-48(远端占用,重让)→G-183 链理正 + 侧车按真实 compositeKey 全量重建(5 条;234 warn a1=0 a2=0/211 0/13d F10 0/239 0/plan-gate strict F9 撞号 0 组)——机主授权合并背景 (a056001ebf)
- 🔧 기타:F9 分批收敛 #1 终——L28868→G-48/L28888→G-50/L29002→G-90/L29063→G-26/G-880 误改恢复/G-183 误改恢复;L29068 回退原号 G-18(远端键位零)+G-18 侧车补;六组侧车按真实 compositeKey 重写(234 warn a1=0 a2=0/13d F10 0/239 归档单调 0/211 号池 0)——机主授权合并背景,逐行留痕 (45254bd876)
- 🐞 수정:course-planet loadData deps 剔无用 tt(体内未引用,判据面 JSX 层独立吃,exhaustive-deps warning 清零)+ tailwind.config 头注版本事实修正(现读:声明 v3 仅服务 preset 工具链,产物引擎=weapp-tw@5.2.9 vendored v4,alpha 原生生效——漂移注释清);验证:miniapp 端内 eslint 首次 --max-warnings 0 exit 0 (25817edb68)
- 🔧 기타:F9 分批收敛 #1 终版——本地 5 行键位改号到验证组合(G-48/G-50/G-90/G-26/G-09;G-880 误改恢复;G-183 误改恢复)+ 侧车 6 条按真实 compositeKey 重写(234 a1=0 a2=0/239 归档单调 0/211 号池 0/13d F10 0/plan-gate F9 撞号 0 组,五门现读全绿)——机主授权合并背景,逐行留痕 (12a9581f6a)

**2026-10-24**
- 🔧 기타:navbar-no-chrome 补 i18n mock——NavBar 在 i18n 扫尾批起吃 useI18n,裸 render 抛「must be used within I18nProvider」整文件稳定红(全量两轮复跑 1/1 坐实,非 flake;与 fenlei-overlay 同治,判据只量根元素样式不涉文案) (e8c502633e)
- 🐞 수정:门77 B1 终清+门150 弱证据 web 两站归档(wallboard 条形帽 3px→2 就近档;wb-panel 根容器 lg→xl 跟 panel 角色;PiP card 容器 md→lg)——移动端收官顺手清全仓 UI 档残余 (d5fe70025b)
- 🔧 기타:F9 分批收敛 #1——本地 5 行键位改号到远端零键位号(G-08→G-48/G-09→G-50/G-12→G-90/G-12→G-26/G-09→G-37;G-880 误改恢复)+ 侧车 5 条按真实键重写(234 a1=0 a2=0/211 差值 0/13d F10 0/239 归档单调 0/plan-gate F9 撞号 0 组现读)——机主授权合并背景 (58e51c9b2e)
- 🐞 수정:移动端第三轮收官——中文/半翻译残留 82 站清零 + D43 首页语音笔记挂载落账 + 门150 弱证据移动端 6 站归档 (dc9667c160)
- 🔧 기타:F9 撞号 6 组人工键位裁决改号(G-32/14/53/20/18/D18 → 池内新纪元两位号 G-01..G-07)+ 副本行标记 + 7 行侧车记录补齐(234 a1=0 a2=0;211 号池差值 0)——机主授权合并背景;逐行带原号留痕注记 (2d30287aad)
- 🐞 수정:ScreenStates 空态圆章真圆写法改 50%(守门 77 B1 认可的几何真圆形;64/2 表达式被 B9 求值判超上限,同形百分比是门自带出口) (3ffd223f89)
- 🐞 수정:移动端跨端观感修复批——四件套骨架屏尺寸减半(用户可见)+圆角角色档 43 站收口(守门 77/150 在册红) (a1de25ce24)
- 🐞 수정:清两处合并连带的死导入(AgentSettingScreen ActivityIndicator / OrderScreen TouchableOpacity,HEAD 面已红即合并 auto-merge 产物,未用导入删除无行为变化)——解锁 push 全量 typecheck 门 (76ab146506)
- 🐞 수정:修复合并连带损伤——NotificationPanel formatPushTime 内 Date 变量撞名参数 t(改 dt)+ useI18n import 补位 + 签名对齐 useI18n;原 push 门全量 typecheck 红因;验证:eslint 0/该文件 typecheck 清/水印完好 (1a3295d1de)
- 🐞 수정:移动端 typecheck 清零批次——i18n 提取残骸 36 文件/119 错修复 + 测试滞后 12 红 + 顶栏两截带一枚 (fc5925035e)
- 🔧 기타:收敛 origin/main(2026-10-24 编号新纪元)——PROJECT_PLAN 取远端重排版(旧卷全文已由远端 renumber-snapshot 归档,零丢失;goal 十四枚提交未触碰 PLAN);代码文件 auto-merge;机主授权合并 (7fb7e5e52f)
- 🐞 수정:补落第二枚遗漏的 8 文件——5 共享屏(console-table/switch-prefs/user-public/llm-settings/edu-shop)与 3 小程序镜像页(pkg-user/user-public、pkg-user/llm-settings、pkg-shop/edu-shop);第二枚重跑时目录参数展开失败致漏(index.ts/app.config 已引用它们,干净检出必断,本地工作树假绿掩盖);验证:eslint 0/typecheck 零错/水印 verify 完好 (41d84097bb)
- 🔧 기타:screen-registry 三元组补登 3 条——UserPublic/LlmSettings/EduShop(shared/rn/miniapp 三端齐,goal 新屏首批评入镜像登记链);门 screen-coverage HEAD 面现读 71 条全真、镜像 72/213,新 3 条落地后 75/215 (aaad635715)
- 🚀 기능/개선:存量 token 化批 #5(长尾)——四屏 69 处(ChangePwd 12/ChatRoom 19/LecturerList 15/Publish 23);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 30 屏 885 处 (45b3c6bc35)
- 🚀 기능/개선:存量 token 化批 #4——七屏 218 处(StudyIndex 45/Promote 33/LiveDetail 38/Settings 24/SelfMedia 23/VipTrader 33/EarnCommission 22);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 26 屏 816 处,15+ 裸行档清零 (5a89172e0d)
- 📚 문서:D17 生态统一入口结清翻勾(内容锚:「D17 生态统一入口装车」提交=page+hub+nav+五语 ecosystem 37 键 empty0+nav.ecosystemHub×5;现读 check-i18n-keys 19127 键 parity OK+hub 测试 16/16;语言包占写已解除)✅(2026-10-24) (49ef8ccb88)
- 🚀 기능/개선:存量 token 化批 #3——六屏 203 处(Points 24/Memory 45/AppTopup 27/WrongQuestions 29/AiWorld 45/Plaza 33);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 19 屏 598 处 (89aba90a01)
- 🚀 기능/개선:存量 token 化批 #2——六屏批量转写(ConversationImport 23/LecturerDetail 27/CourseTab 45/AiGroup 55/ImageGenTemplates 29/ModelIncome 42 共 221 处)+ 转写器 ensureImport 增强(import 检测改在 design-tokens import 语句内做,根治正文已含 token 名时的漏补);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 13 屏 395 处 (f03953d525)
- 📚 문서:G-959/G-865 结清翻勾(现读证据:app-login sso 键化+shared 五语+守门测试 16/16 · DEFAULT_AVATAR_URL 死键已摘+两测试同批改净)✅(2026-10-24) (81f16bbaff)
- 🚀 기능/개선:存量 token 化批 #1——批量转写器 scripts/tokens-migrate.mjs(裸数字→rnSpacing/rnType 档,恰在档才换不硬凑,自检 6/6)+ LoginScreen 首屏 65 处转写;验证:eslint 0/typecheck 零错/水印完好;工具可复用到全部存量屏 (ccd9fb1624)
- 🚀 기능/개선:edu-management 族小程序镜像批——考勤/成绩/缴费三页(pkg-user/edu-mgmt-*,复用 edu-child/records-page 共享渲染件)+ app.config 注册 + miniapp 五语言(eduMgmt 3 + eduFinance 9 含状态枚举 + eduGrades 正名);验证:eslint 0×3/miniapp typecheck 零错/水印完好;镜像累计 14 页 (26fc056da6)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92f382ef86)
- 🚀 기능/개선:children 六子页小程序镜像批——共享渲染件 records-page(列驱动卡片列表,对齐 RN ConsoleTable 模式)+ 六薄壳(课表/考勤/成绩/餐食/账单/学习计划,参数 childId)+ app.config 注册 + miniapp 五语言 edu 族键组(eduChildAttendance/eduGrades/eduAttendance 等 4 组 + statusTitle/empty);家长端小程序闭环(首页→六子页);验证:eslint 0×7/miniapp typecheck 全零/水印完好;镜像累计 11 页 (01bb3b47a8)
- 🚀 기능/개선:小程序镜像批 #2——家长端首页(pkg-user/edu-parent,孩子卡片列表+状态徽章,对齐 RN EduParentScreen;children 子页镜像排后续)+ app.config 注册 + miniapp 五语言 eduParent 10 键;验证:eslint 0/typecheck 零错/水印完好;镜像累计 5 页 (2ceb517ea6)
- 🔧 기타:对账尺登记批——edu 族 18 条 aligned 入账(edu-management 7 + parent/children 9 + user/[id]/settings/llm/edu/shop 落地补登);worktree 面现读 aligned 142/缺口 355/零腐烂 (4b5234a908)
- 🚀 기능/개선:goal 教育域批——edu-management 可列表承载面全落地(考勤/成绩/班级/缴费/餐次模板/校园课表/教师排班 7 页)+ 家长端闭环(首页/绑定 CRUD/children 六子页)+ EduParent 六键导航;全部 ConsoleTable 杠杆薄壳 + 五语言 i18n(edu 族 12 键组);验证:eslint 0×18/typecheck 本轮零错/水印 verify 完好 (c1712deb25)
- 🔧 기타:vip/success 时长三连裸串接 tt('vip.success.daysUnit') + 词包五语 {n} 天键 (73dae30a4e)
- ♻️ 리팩터:批131 · AgentShopList emptyText 默认参拆雷(全仓可接面清零收口枚) (c51ca43ae9)
- ♻️ 리팩터:批130 尾修 4 处 appAlert 第一参变体(AccountCancel/ChangePwd) (a9d478aa0d)
- ♻️ 리팩터:批130 硬编码中文清零(6 文件 / 90+ 处) (80ec061080)
- 🚀 기능/개선:批130 入典(88 组新键 ×5 · chat.msg/toolbar/topup/confirm/sr/dist 族) (f2673153bd)
- ♻️ 리팩터:批129 硬编码中文清零(5 文件 / 90+ 处) (3ff7374377)
- 🚀 기능/개선:批129 入典(74 组新键 ×5 · need/news/iaa/bab/vip 族+common.known) (a2f2edbfa2)
- ♻️ 리팩터:批128 硬编码中文清零(6 文件 / 80+ 处) (3694083f70)
- 🚀 기능/개선:批128 入典(65+ 组新键 ×5 · subPkg/account/share/lp/annot/aigcList 族+补 courseDesc) (fd6316a81a)
- ♻️ 리팩터:批127 硬编码中文清零(11 文件 / 90+ 处) (36398ccb1a)
- 🚀 기능/개선:批127 入典(110+ 组新键 ×5) (9af71a11bc)
- 🚀 기능/개선:批127 W1 入典(23 组新键 ×5) (5926d858a3)
- 🚀 기능/개선:goal 应用批——RN 六屏 token 化(109 处 rnSpacing/rnType/rnRadius 档)+ 9 张 RN 屏四件套(他人主页/BYOK/教育商城/控制台六页,ConsoleTable/SwitchPrefs 两杠杆屏)+ 小程序镜像三页(三新屏三端闭合)+ 小程序提现页语义档 + RootNavigator 九路由 + miniapp 五语言键组;验证:eslint 0/typecheck 本轮零错/水印完好/i18n parity OK (47e3b46cc5)
- ♻️ 리팩터:批 126 硬编码中文清零(Menu 8 项表转键/Notification 时间族/PushBanner 回落/VoiceInput 全组) (3785cb014f)
- 🚀 기능/개선:批 126 入典(22 组新键 ×5) (62378825a2)
- ♻️ 리팩터:批 125 硬编码中文清零(9 文件 / 60+ 处,组件批收官) (593cb4ec61)
- 🚀 기능/개선:批 125 入典(29 组新键 ×5) (ad22965d3c)
- ♻️ 리팩터:批 124 硬编码中文清零(13 文件 / 55 处 · RN 端 UI 串清零收官批) (bd0dfe0c8b)
- 🚀 기능/개선:批 124 入典(37 组新键 ×5) (cda81d5afe)
- ♻️ 리팩터:批 123 硬编码中文清零(13 文件 / 40+ 处,含 3 张顶层表转键) (aecd7c7a30)
- 🚀 기능/개선:批 123 入典(35 组新键 ×5,含工具三态状态词五语同批) (a43b9ae989)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>지린성 아이즈히후이 인공지능 기술 유한공사</strong> · 오픈소스 공동 구축, 우리 함께합니다</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
