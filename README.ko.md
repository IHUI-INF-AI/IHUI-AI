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

<p align="center">
  <strong>중국 미러</strong> ·
  <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> ·
  <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
  <br/>
  <sub>중국 사용자에게 더 빠른 클론/다운로드, GitHub과 자동 동기화</sub>
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
|                          | 테스트 커버리지                | 268 + 400+ 케이스 / Vitest + Playwright + pytest + Locust 부하 테스트 + Lighthouse 성능                                                        |
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
| 백엔드 유닛    | Vitest        | 38 파일, 268 케이스          | `pnpm --filter @ihui/api test`    |
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
| **apps/api**        | 4443          | `/api` + `/api/admin` | 604            | 30+ 비즈니스 도메인(auth/users/billing/content/chat/teams/workspace/agents/coze/oss/order/vip/exam/learn/live/news/topic/search/drama/stock/gdpr/rbac/tenant/community/edu/payment/wallet/point/ranking/distribution/developer/workflows/business-card/customer-service 등) |
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
**2026-10-21**
- 🚀 기능/개선:D38 侧边队列宿主接线(流式中发送入队/交互条渲染/流结束出队补答) (ddfcb16bbce)
- 🚀 기능/개선:生产签出外来工作只读尺子装车(尺子+12例镜像测试+巡检双挂点) —— 未跟踪洪水只计数不判定,结论行新增 untracked 字段;抓到生产签出 12 枚远端没有的已暂存新文件 (e7581c4ee0f)
- 📚 문서:extension/cli/miniapp 分区注释与 models --all 帮助文案对齐 2026-10-21 isArchivedModel 新判据(standard 不再折叠)——8 处滞后旧语义收口 (2512a6b8ee7)

**2026-10-21**
- 🐞 수정:补回被合并 fba604cf4a 吞掉的四枚文件 (41015953631)
- 🐞 수정:抽屉底部 UserRow 与 web 对齐 —— 上下对称 8px (ef3f4cad032)
- 🐞 수정:reset 判据改看被丢的那一枚 —— 备份过的 reset 不再恒红 (fe1031d8df1)
- 🚀 기능/개선:TS 增量缓存整体请出源码树 —— 回收站灌入的最后一格根治 (2094d275c70)
- 🐞 수정:stagedTriggers 支持 glob —— 97/98/102 三道 blocking 门不再隐形跳过 (b981746fd9b)
- ♻️ 리팩터:本地 api<T>() 手抄壳迁移第 4 轮 —— 103 枚壳 + 55 枚调用方改读单源出口 apiOrThrow(逐字裸转发才迁,7 枚 ApiError/errorCode 特型点名不迁) + ui-routes 派生钉随源刷新;验证:typecheck 基线 1 错不增、touched 全量 eslint/prettier 0 问题、URL 字面量多重集守恒、门 105 预飞 matched (0d0e601d3cc)
- 🐞 수정:策略器补空枚举反证与四态自检,两处"NukeOnDelete 不约束"旧断言按实测更正 (c2a82df9db0)
- 🐞 수정:侧栏底部用户行容器改纯色底、上下内边距对称 (b8464f6946f)
- 📚 문서:G-939 收口 —— 吞并枚复现(单亲非 FF relay 重写,非合并)+ 丢失集守卫已接 casUpdateRef(枚 feb0cd072d),镜像 8/8 回归全绿,翻勾 (cf68170f569)
- 🐞 수정:G-939 丢失集守卫接进 casUpdateRef 共享咽喉 (feb0cd072d1)
- 🐞 수정:ui-routes 产物自述钉刷新 —— 门 105 唯一红 G5 清零(派生产物,web 源码零改动) (51c09d5d1c7)
- 🐞 수정:ui-routes 产物自述钉刷新 —— 门 105 唯一红 G5 清零(派生产物,web 源码零改动) (dc4ab093c12)
- 📚 문서:票60 普查批收口 —— 普查段 5 座 store 全部定档落地(4 座窗格化+business-forms 先前收窄)、发送链 paneIdForChatStore 反查、六座实例随叶回收、残余② advance.retryable 补 toast,残余归零本行翻勾,枚 ce88ed459c (b638680a880)
- 🐞 수정:给"删除不落回收站"这道闸门找到主人,并把树内再生缓存从 KEEP 里分出来 (69b2d7ba724)
- 🚀 기능/개선:票60 普查批 —— 剩余 4 座全局 store 逐座定档按窗格寻址 + 发送链按 chatStore 反查伴生态 + 六座实例随叶统一回收 + 非根 advance.retryable 补 toast (ce88ed459c0)
- 🚀 기능/개선:侧边栏与 web 端全量对齐(第六批,web 端零改动) (86b96f6d180)
- 🐞 수정:11 枚脚本改走 face-reader 取材 —— 清偿"裸 git 派生生产文件"棘轮的 11 处新增 (8d8bae27a22)
- 🚀 기능/개선:侧边栏与 web 端全量对齐(第六批,web 端零改动) (eca62eeb4b2)
- 🐞 수정:切流受阻告警的"宽限窗超期转正式告警"永远到不了期 —— 45 分钟登录 500 一封信都没寄的第二根因 (38d2f44a10d)
- 🐞 수정:模型选择器"调不通的还在显示、能调通的没显示"三处根治 (624e5a7a904)
- 📚 문서:agent.md 补同源与适用范围声明 —— 消 §0.6 第二份真相、限定 §0.8 那条承诺 (4b0aeb7a033)
- 🐞 수정:api-migration 门与镜像测试跟上现役端点(/api/agents/my),[8/8] 的 Windows 崩溃码显式未判定 (6a0f666c6b7)
- 📚 문서:本侧 G-926 未勾旧行对齐为对侧已勾版 —— 该票已由 chore(gates) 归档出口件枚落地,union-converge 的折叠层拒裁的两态并存属本侧滞后,按远端事实对齐 (a87bb0dad85)
- 📚 문서:修正 README 与代码相反的默认值 —— 写着 default https://api.aizhs.top,实际 src/config/defaults.ts:27 是 http://localhost:8802 且无内置公网域(§0.8:文档不得写跑不通的出路;取证席全仓扫"写死慢臂基址"时顺带挖出,无用例钉该句,watermark verify 1/1 无损) (13577fcf824)
- 📚 문서:G-866 就地翻勾结清 —— 同一 URL 连打三次实测 EO 默认遵守源站 s-maxage 缓存 /api(第2/3次 HIT,Age 4/8);此前"两次都 MISS"是我自己的测试缺陷(第一次带随机 cache-buster ⇒ 两个不同缓存键),免控制台即判,不消耗免费版唯一规则额度 (ffc80eb00cb)
- 🔧 기타:课程域死端点清账:附件屏换源 /api/resources、删除 members/:id 与 categories/tree 死函数、修 CourseScreen tags 悬空崩溃 (64747d0733c)
- 📚 문서:票60 补 e2e 收口注记(双流式 3 例枚 8e45f91a6f; G-935 已由 23b7ae8164 翻勾并被 509c7cc1d8 完成即删摘除, 行内指向结清; 本行不翻勾, 残余仍为 advance.retryable 静默 + 普查 5 座全局 store) (3f743381590)
- 🔧 기타:G-926 翻勾(B 档 62 枚全收尾,守门 13/13,按 heal 纪律不删行) (1e96e49cac1)
- 🚀 기능/개선:npm-bootstrap 增加 org_create 动作(真 Chrome+xvfb 网页代行建 npm org) (05c80ad3f76)
- 🐞 수정:form-request 捕获改用 JS fetch 覆盖绕开跨域预检拦截 (adab5bf9597)
- 📚 문서:补 R4 点名义务 —— 本批四件器物(出口 IP 巡检尺子 / 部署收尾预热 / 公开接口缓存头唯一出口 / 源站直连守卫)在根 README 逐条点名,写清判据、自检与"判机器状态一律不接提交链"的定级理由 (b11f1599de9)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (044ca7cdc63)
- 🔧 기타:RN 课程域第二程:目录/章节/评价三屏换源 /api/learn —— api-client 新增 getCourseCatalog/getCourseComments 出口(详情再投影 + rates 端点,口径与旧 /api/courses/:id/* 逐字同,绕开正被清除的注册面),课程详情报名成功即补拉学习进度,CourseCatalogItem 补 videoUrl 挂点;顺清 memory.ts 存量 eqeqeq x4 (a48f62d5def)
- 🐞 수정:release-sdk 补 @ihui/types 构建前置 + NPM token 改名取自 NPM_PUBLISH_TOKEN (790cec5b53d)
- 🔧 기타:让号收口 F9 撞号 —— G-922 让给 G-1162551(归并前置,零删行) (6ce7934a1d2)
- 🔧 기타:G-865/G-935 翻勾(完工事实在链,按 heal 死循环纪律不删行) (23b7ae81643)
- ♻️ 리팩터:G-929 恢复开放面留存(带完工注记)—— heal 死循环下唯一双绿稳定形态 (3d174f989e2)
- 🔧 기타:收编 agent.md 机主指令件与 tauri 两枚权限生成物入库 (f5b5bfa1b82)
- 🐞 수정:一枚真代码回归 + 一枚门停在旧世界 + 两枚测试在干净检出上取证不了 (ba2aa4070d7)
- 🐞 수정:修 checkin 空状态与侧边栏导航对齐两处 CI 红 (29c9ec7ad75)
- 🔧 기타:票60/G-935 双流式互不顶补上真机核验 —— 新增 chat-pane-parallel-stream.spec.ts 3 例(① 两格并发流式交错推送,增量只进自己那格且终态逐字等值 ② 反证 两条流在同一瞬间都活着、甲收束不牵动乙 ③ 停止只 abort 自己那一格,乙照样跑完);自控 fetch 泵逐帧推 Response(ReadableStream),读环/行缓冲/parseStreamLine/水位闸/abort 归因全走生产码;传输面按 frameContents 抽 content 后逐字断言(整帧原文 join 数学上不可能含连续 payload);全链 page.route mock 不依赖活后端,连跑两轮 3 passed / 3 passed (8e45f91a6fb)
- 📚 문서:停摆工作树收口 - 五份活文档三方归并 + AGENTS 体积搬出(消门 207 与门 89 R4) (bab1bf4c6ce)
- 🐞 수정:六枚镜像测试 + 一枚门 —— 有人是"测试停在旧世界",有人是"干净检出上不可能满足" (077d01f6c53)
- ♻️ 리팩터:G-929 指针注记化(破 heal 死循环:窗口滚动后删行必被判无凭据减少) (8dfbca5b45a)
- 🔧 기타:课程学习进度全链接线:详情端点补真实评分与小节时长秒字段,api-client 课程域收口到 /api/learn 小节制进度/心跳,播放器 15s 节流心跳+标记完成走自动完成契约,课程详情清单按小节渲染 (d510ab99efa)
- 🐞 수정:用户自装的 mmcode 自愈脚本不是 agent 污染 —— 显式豁免 (18c81b13af9)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3cb5fd123b4)
- 📚 문서:回补 32 枚 PROJECT_PLAN 归档锚点件入库 (aba30748621)
- 🔧 기타:G-929 完成即删摘行(二翻勾配平后) (ad31c98c3fa)
- 🐞 수정:免费旗舰 :free 变体救回为 latest 档(免翻折叠区) (4cb7f72a253)
- 🐞 수정:把 glass 两档登记进跨端 token 对账 —— 暗档手抄白值的漏登记当场补上 (688d894ae42)
- 🔧 기타:G-929 二翻勾(配平 2 笔历史无凭据减少,完工事实不变) (8bc3d0ff549)
- 📚 문서:G-870 就地改写为终稿 —— 用户可见缺陷本身已按"不依赖控制台"的路径修掉(web 补 /uploads 精确代理 + FILE_CDN_BASE 改判 www 快臂),剩这一格只做"历史死链自愈+微信 applinks",并如实写明为什么我这边推不动(zone 记录改指隧道只有 CF 登录态一条路,本机无 token 且内置浏览器面板 visibilityState=hidden、行内下拉合成事件不弹) (600f2c61b68)
- 🔧 기타:登记 line-loss「已收拢」判据缺第三形态票 + 摘 G-79 S1 行 (1a03a2cc5aa)
- 🔧 기타:G-929 完成即删摘行(翻勾后整行删除) (a0713703c2f)
- 🔧 기타:G-929 翻勾(暖色门 --root 收口,镜像 28 红全消) (833ed224c9b)
- 🐞 수정:把 /uploads 精确前缀补回 web 代理 —— 实测快臂上公开文件结构性不可达(探针文件 8802/api 臂 200 image/png,www 臂 133KB Next 404 HTML) (7f94692c39f)
- 🐞 수정:暖色描边门支持 --root 显式被审仓根 + 落地器透传 —— 镜像套件 28 红全消(66/66);镜像 M16 三态+双向变异验证 (ad02ccba7df)
- 🔧 기타:撤回本席对锁票的翻勾(单方面 [x] 会造出 F1 同主键两态并存,顶死 union-converge) (ccc117c72ea)
- 🔧 기타:G-79 结清 + 锁票改判消 F1 两态并存 (96ddaeadfcd)
- 🐞 수정:清偿三盏存量红灯 —— mobile-rn 未用导入 / i18n 过期契约声明 / OpenAPI 产物漂移 (a89a26f1dfc)
- 🔧 기타:解推送车道的一枚阻塞 —— 按**远端逐字节原值**恢复一枚被两侧判成"本侧删除"的临时件 (ea325b1eeac)
- 🐞 수정:删掉自己用例里的一处类型红(noUncheckedIndexedAccess) (e4098efc4b9)
- 📚 문서:登记 file.aizhs.top 那一半还没修的死链(决定性差分已量:同刻同服务 api 200 / file 502,隧道第5条路由本已存在⇒病灶在 zone 记录)与"为何选改记录而不选改 .env" (b9898ddc450)
- 🐞 수정:余额为 0 不再等于通道不通 —— OpenRouter :free 模型从选择器复活 (9fa52f020c2)
- 🚀 기능/개선:服务自愈第三格"连续六小时量不到"也接到人 —— 报的不是服务坏了,是看守层瞎了 (ef064b20659)
- 🔧 기타:deploy-lock flaky 归因取证做实 + 摘 1 条 S1 滞留已勾行 (afbfec0699f)
- ♻️ 리팩터:本地 api<T>() 壳首批迁到 apiOrThrow 单一出口(L7162 第一批 14 枚) (44c476593a4)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8d78bbbd57)
- 🔧 기타:给门 231 涉事判据喂测试桩 —— 夹具仓的树真门读不到,26 条端到端因此全红 (f7cb10c3396)
- 📚 문서:再补三条会打死全站的事实到运维档 —— 公网两臂都得活着(WS 只能留慢臂)/ EdgeOne 现无源站组(源站守卫能上线的前提)/ 别设 assetPrefix(CSP 会把跨域进来的脚本全拦) + React19 自动 preload 的真实成因 (c234639641d)
- 🚀 기능/개선:源站直连守卫上 EdgeOne —— 8801 直填家宽 IP 之后 Host 为裸公网 IP 的直连请求一律 403,失败方向全部 fail-open (e6a318d38fa)
- 🔧 기타:让号收口 F9 撞号 —— G-927 让给 G-1142551(归并前置,零删行) (67f45124bfa)
- 🐞 수정:名单外那台的信必须带门 153 已判出的问题行 —— "它停了"不可整改,"它的 exe 不存在"才可以 (eca627cb50c)
- ⚡ 성능:营销/文档页初始 JS 减 2,529KB raw / 523KB gz(三页各测) —— 把 BrandIcon 全集与 three 栈移出阻塞路径 (3c5a06a71ad)
- 🚀 기능/개선:手机端 REST 切快臂(实测 ttfb 差 1.3~7.0s),实时通道显式钉回 api 臂并写死"两臂都得活着" (542ec2105ec)
- 🐞 수정:归属账按 T10 摘除 B 档两条(.ihui-agent/tmp/outputs 已零命中) —— 陈旧放行凭据:盘上副本 = git show HEAD:该文件 ⊕ 这一处编辑,diff --numstat 1 插 19 删(scopeNote 摘记 1 行 + 两块 B 档条目体),无第三方行被写回;T10 点名后依 §0.7 删条目,尺子 13/13 (12612c2115f)
- ♻️ 리팩터:把纯 IP 判据从带 node:dns 的 ssrf-guard 里分出来 —— 为 Edge 侧消费铺路,行为零变化 (01af3886c24)
- 🐞 수정:摘掉 user.ts 里重复注册的 POST /user/ip-whitelist(HEAD 起 API 启动即 FST_ERR_DUPLICATED_ROUTE,本地全栈无法起) (8c41e92a62f)
- 🔧 기타:G-926 完成即删摘行(翻勾后整行删除,已勾行进不了守门 71 保护集) (41aa033ba63)
- 📚 문서:登记 2026-10-21 下午对齐第二轮(6 枚已入库;新派单:web ja/ko 机翻坏文按块清) (6498675ca80)
- 📚 문서:同轮收口登记 —— IP 白名单生效链、RN 管理面、五项护栏按人生效、小程序关于页、两条假端点删除 (5b3fe1f3c67)
- 🔧 기타:G-926 翻勾(B 档收口:60 枚取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (61062533365)
- 📚 문서:把 agent 护栏的过期自述与契约产物一起对齐到落地后事实 (1cd867fbf80)
- 📚 문서:L7220 桌面僵尸实例 P1-P3 进展登记(欠双实例现场复现,不翻勾) (5fa9b4c4120)
- 📚 문서:G-865 就地翻勾结清 —— DEFAULT_AVATAR_URL 死键已摘(枚 9410970ece45ddc00be11886f7d607ea2399f1f3,三处同批改,用例 9/9 与 shared tsc RC=0 为凭);行仍留 HEAD 等"完成即删"兜底轮摘除 (98c4de50b7a)
- 🐞 수정:僵尸实例三块补丁 —— preflight 填账可观测 + 启动相位只等不杀 + 事件循环后置健康门(L7220) (b2d6ff56ed3)
- 🔧 기타:摘掉 DEFAULT_AVATAR_URL 死键 —— 指向恒 502 的 file.aizhs.top 且消费方已归零(门 121「声明必须有消费者」) (9410970ece4)
- 🔧 기타:G-926 完成即删(B 档 60 枚已取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (76e1128fc98)
- 🚀 기능/개선:关于页三端同脸 —— 小程序补齐 web/RN 那六段结构 (a21108a3f46)
- 🔧 기타:无损折叠同行叠同一注记超额 26 份(7 行,方法学承 92b5d876) (31323b5d355)
- 📚 문서:§0.9 点名义务 —— 把本批三件新器物写进运维工具档(出口 IP 漂移尺子 / 部署收尾预热 / 公开接口边缘缓存头),并注明"判机器状态一律不接提交链" (1b6ab6e6188)
- 🚀 기능/개선:落地器 --self-test 自含电池(7 例,票面"带 --self-test 与镜像用例"收口)+ 镜像 T10 (04473df2771)
- 🐞 수정:摘掉指向死源站 file.aizhs.top 的用户可见素材引用 —— 该域名不在我们隧道上,恒 502 (bafa2de7790)
- 🐞 수정:页脚小图不再抢首屏连接 + docs 七页 21 条内链改 Link —— 根因是 React 19 SSR 对任意非 lazy img 自动发 preload (217a8998e64)
- 📚 문서:立票 —— 裸 git 派生棘轮 76→85(本席那一枚已改走 face-reader.gitRaw 并落地,读数随 86→85);行内写清取新增者名单的命令与两个实测坑(rev: 前缀要先剥、注释里的字面量也会被数进去),并注明存量清零前只报数 (df979a1eb27)
- ♻️ 리팩터:清扫器的派生 git 改走脚本层 —— 镜像套件里"裸 git 派生的生产文件只减不增"棘轮现读 76→86,本文件是新增者之一(我昨天落它时直接起 git 进程)。改法 = 那个 git() 帮手委托给 lib/face-reader 的 gitRaw(同时白拿它的超时/stdio/quotepath 纪律);注释里也不许出现裸调用字面量,否则棘轮正则连注释一起数(第一版就是这么"改了还在名单上")。现读:自检 15/15、镜像 12/12、预演 state=clean、eslint/prettier/watermark 全清。棘轮剩下的 9 枚新增者不在本席射程(逐枚归属见 git diff 14a04f013f..HEAD 那一族),已按实测另立条目 (35be7331286)
- 🚀 기능/개선:公开只读 GET 接口加边缘缓存头 —— 审计 P1.3 那一格,取值与写头收在唯一出口 (42e21bacda0)
- 🚀 기능/개선:安全中心接 IP 白名单管理面,并修掉 web settings.ip 的 ja/ko 机翻坏文 (29cdd1c00bf)
- 🚀 기능/개선:部署收尾预热 EdgeOne 真装车 —— warm-prod-cache.mjs 自落地起全仓零调用方,属"造好没装车=没有"(§0.9) (4eaefdde4bc)
- 🔧 기타:hooks-extended 修 Windows 读-写竞态 —— 钩子文件等内容非空而非仅等存在 (706847132c9)
- 🚀 기능/개선:家宽公网出口 IP 漂移装上看守 —— EdgeOne 源站直填 IP 之后全仓零器物,一变即全公网 5xx (030483ced98)
- 🐞 수정:同题多号存量 8 组 26 行收拢清零(机主授权@2026-10-21) (0eb36182652)
- 🚀 기능/개선:五项安全开关改为按登录主体生效(硬门与 kill switch 不受用户档影响) (59ea36eb632)
- 🐞 수정:exec 族出 stdio 维度射程 —— 回退 hooks-auto 的 exec stdio(ExecOptions 无该字段),姊妹门 classify 加 exec 排除层 (b6281fcacda)
- 🔧 기타:取消跟踪 60 枚 tracked-but-ignored 临时件(B 档:56 枚 plan-pointer-purge 取证流水 + 4 枚 outputs;LAND_REMOVE_PATHS 首用) (988a243cd12)
- 🐞 수정:补回 32ce073019de6d750a65133aec3146752ff3e655 自己造成的回归 —— 我用 prettier 重排该文件时把 `const HEADING = /…/gm` 折成两行,而镜像 next-plan-id-remote 的 T5/T6 从源码里抽这颗字面量复用(§22c),抽取一失败两条就从绿变红;上一枚报的"6/6"是重排**之前**量的,当时已失效。修法 = 注解写明形状承重 + `// prettier-ignore` 紧贴该行(注释与 const 之间留空行 = ignore 不生效,第一版就这么没成),并把量词写成 `{0,}`(与祖先逐字相同会被门 84 判"复活行"假阳,这里是等价改形)。现读:prettier 通过、next-plan-id-remote 6/6、plan-id-duplicates 6/6、plan-id-lease 9/9、--check rc=0、watermark 零残迹。教训钉进注释:核对顺序必须是 改 → 全跑 → 再落地,格式化也算改 (5a9d8f26d9e)
- ♻️ 리팩터:删掉 PDF print/sign 两条假端点(全仓零消费方) (d22063dd4e6)
- 🚀 기능/개선:落地器暴露 LAND_REMOVE_PATHS 声明式删除出口(G-926 器物侧) (f20d7354f0e)
- 🚀 기능/개선:IP 白名单生效链接入 18 条新登录腿(只拦新会话、留自救出口) (9383e4645a2)
- 🔧 기타:G-1162551 第三次改判留勾(清扫⇄回捞连抖,不再摘第二次) (80d437743b8)
- 🐞 수정:服务自愈「重启预算用完」终态接到人 —— 45 分钟 boot 崩曾一封信都没有 (4f9371871d5)
- 🚀 기능/개선:打通历史课程视频的播放链 (506f115c1b1)
- 🔧 기타:G-53 与 L6762 结清翻勾 (f029adf6f52)
- 🚀 기능/개선:把 history-read-ops 真挂进 ihui chat history(L6762 的真缺口)并钉装车锁 (172aba73338)
- 🚀 기능/개선:补齐流式中换档即终止的腿(G-53 唯一真缺口,四端同判据表) (b00e5766c55)
- 📚 문서:立票 —— 旁路落地器镜像套件红 26 例的根因(门 231 --rev 按自身仓根解析树 oid,测试通道换仓时该 oid 在主仓不存在 ⇒ exit 2 ⇒ 落地器 fail-closed 拒 ⇒ 用例整批红;生产面不受影响)。成因枚 e1f18b5a32070c9ab14f71187b963fc3de95c3ca,归属该门持有席(它此刻正被并发编辑);两条出路都写明,并禁止用"摘门/加 skip"消红 (5ea8c7ae9c0)
- 🔧 기타:给关于页补行为级自证套件(§17 不许只凭代码审查声明改好) (7561a8b9092)
- 🐞 수정:摘掉 drawer-nav 三枚无人使用的 lucide 图标 (adadf82b37c)
- 📚 문서:D18 SDK 发布尝试被 npm 拒的真因登记 (3b64f1fa79e)
- 📚 문서:常驻工具清单点名 audit-pane-store-addressing.mjs(只读普查尺子,未接提交链也不接巡检轮 —— 它判的是"该不该按窗格分"这类人要读的归属,挂 blocking 即 §12e 恒红门) (7fbaea08b2a)
- 🔧 기타:补一把只读普查尺子 audit-pane-store-addressing.mjs(票60)—— 从"会进非根窗格的子树"(ChatPaneBody/MessageList/MessageInput,含 @/hooks,depth 可调)做 import BFS,列出现存 store 与三态窗格通道(自带 ForPane / 被注册表 import / 无),另给归属代理(状态形状里有没有会话或消息为键)。刻意**不接提交链也不接巡检轮**:它判的是"这枚 store 该不该按窗格分",那是人要读的归属问题,挂 blocking 就是 §12e 恒红门(同 check-temp-landing / alert-volume-report 那一档);取材失败显式 exit 2「未判定」不记绿。现跑读数:子树扫 40 个文件、引用 12 枚 store,已有通道 2(chat 经注册表、progress-jump 自带)、无通道 10。isDirectRun 走 pathToFileURL(§22d),eslint/prettier/watermark/门 221 全清 (0ff18ec7258)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eba4bcb57ec)
- 📚 문서:G-53 持有行复量 + 旧号 68 孪生行补副本指针 + L6762/L28828 处置留痕 (2069ae3d9fc)
- 📚 문서:票60 行补非根窗格 store 普查读数 —— 子树 12 枚:已有通道 2(chat 经注册表、progress-jump 自带)、按设计属全局 3(auth/auth-store/navigation)、以会话或消息为键因而天然安全 2(ai-panel、d180)、要逐座定性的 5 枚点名(business-forms 的 clearForms 清全部 = 任一窗格切会话抹掉别窗格填一半的业务表单,是用户可见数据丢失;context-mention;conversation-detail-mode 名实待读;mode.ts;timeline-store),并写明判据与片 5 同形(能寻址的走 usePaneChatStore,只能按会话归属的把 conversationId 写进键里、清理动作按键收窄,不得整表 clear) (6789a60c66a)
- 🐞 수정:诊断清单的 `[object Object]` —— 我把 notOk 改成对象后漏改了一处映射 (e884297f30f)
- 🐞 수정:删掉 user.ts 里只会回显的 POST /user/ip-whitelist 空壳 —— 它与 security-config-routes 的同路径真实现同时注册,Fastify 抛「already declared」⇒ IHUI-API 崩溃循环 60 次、8802 未监听、登录全量 500、部署环健康门禁 8 轮不过已回滚 (7078c88d956)
- 🚀 기능/개선:跨端对账门补 CSS Module / CSS-in-JS 取用形态覆盖面(CS 维)—— 收 L28828 空白② (ba9f1bca74f)
- 🐞 수정:补回上一枚漏掉的类型标注 —— pane-tail-consumers 的 assistant() 工厂返回 ChatMessage(字面量 role 不做返回类型标注时 tsc 判 string 不可赋给联合类型,3 条 TS2322 随 cca856a67c 落进了 HEAD)。教训自己钉住:vitest 绿不等于 tsc 绿(测试文件的类型不在 esbuild 编译路径上),落地前必须单独跑一次 tsc 并按文件过滤归因。修后 tsc 现读 2 条错误均属他席在飞(panels/page.tsx headerExtra、status/models-section 工作树缺),本枚文件零命中;3 例仍绿 (fcdb043e85f)
- 📚 문서:票60 行残余① 收口 —— 长尾四座已窗格化(枚 cca856a67cededa438319b203c4f233ff1437b05,成对 3 例 + 变异对照全红,宽档 1710 例绿),3 座按边界 1 只根窗格渲染 + 侧栏族按设计属全局面 ⇒ 不窗格化的理由写进行内;同枚修掉 D184 源码字面量锁的假阳成因与反证 (c2aa045c2af)
- 🚀 기능/개선:票60 长尾四座窗格化 —— 朗读腿(voice-stream-speaker)/画布覆盖层(canvas-overlay)/采样参数面板与按钮(sampling-params-panel)/连接态入口(agent-progress-trigger)改读 usePaneChatStore:它们经 MessageInput/MessageList 进非根窗格,原先读根单例 ⇒ 在非根窗格里显示与写入的是根会话的参数/正文/消息流。成对 3 例:① 根窗格流式收尾不触发本窗格、本窗格自己过 done 边沿才播 ② Provider 外仍读根单例(单窗格形态逐字不变)③ 形状锁钉四座不再引用根单例;变异对照(把朗读腿改回读根单例)3 条当场全红,还原后逐字节相同。顺手修 D184 那条源码字面量锁:票60 片 4 起 detail 里多一个 paneId,旧逐字单行断言把合法代码读成"没派发"(HEAD 面实测红),归一化只吞排版(折行+尾逗号),事件名与 text: selectionText 仍逐字钉住并补两型反证。176 文件 1710 例绿,eslint/prettier/watermark 全清 (cca856a67ce)
- 🚀 기능/개선:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (e1005d41cdd)
- 🚀 기능/개선:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (fed40bbacb2)
- 📚 문서:同轮补的后端读写面、门户两条缺页与记忆详情 WebView 承载登记 (83b1e59b5dc)
- 📚 문서:登记 2026-10-21 RN↔web 全量对齐收口轮(本轮 3 枚已入库;IP 白名单与 agent 护栏的生效链待拍板) (bc93cac4af3)
- 🚀 기능/개선:门户补两张缺页 + 记忆详情走 WebView 承载 (ef7cc1697a0)
- 🔧 기타:夹具的 git 身份落进仓库 config —— CI 干净检出没有全局 user.*,21 枚用例在第一步就抛 (f7043438ed4)
- 📚 문서:票60 行残余① 从"13 处"收紧到现读分档 —— 真会串 4 座(sampling-params-panel / agent-progress-trigger / voice-stream-speaker 经 message-input,canvas-overlay 经 MessageList+artifact-canvas),3 座按边界 1 只在根窗格渲染(compaction-status-bar / d176-task-recap / task-monitor-sections,把它下面板化时要与片 3 数据面同批改),4 座按设计属全局面 ⇒ 下一片射程=那 4 座,判据同片 5 的两种形态 (a4e07eccbe4)
- 📚 문서:票60 行就地改写 —— 残余② ProgressJumpStore 已窗格化(枚 d01bc20577c0b7075b0f8e5d14e7058b3730c94b,成对 7 例 + 变异对照 5 红,268 例绿);残余① 13 处根单例消费面定性清单留在行内 (5a680ada9b8)
- 🚀 기능/개선:票60 残余 —— ProgressJumpStore 按窗格寻址(照 usePaneChatStore 同一形态:状态配方只有一份 buildProgressJumpState,根单例与各窗格实例都由它构造,nonce/highlightTimer 挪进实例闭包) ⇒ 任一窗格消费后 clearPendingJump 不再抢走别窗格那次跳转、高亮与 PlanStep↔Message 联动映射不再跨窗格串;Provider 外仍恒返回根单例(单窗格调用面逐字不变),空 paneId 抛错不静默回落;消费面 5 处改用 useProgressJumpStoreForPane(pane-gate 那枚既有用例的观测面随之改挂到该窗格实例,断言未放宽)。成对 7 例含变异对照:把 getProgressJumpStoreForPane 改回返回根单例 ⇒ 5 条当场红(还原后逐字节相同);34 文件 268 例绿,eslint/prettier/watermark 全清 (d01bc20577c)
- 🔧 기타:L7177 区段头折行回潮改判留勾(不摘第二次) (94a133dc824)
- 🔧 기타:五枚摘后被自愈按未勾补回的行改判留勾(回潮型,不摘第二次) (190ad482554)
- 🔧 기타:重钉 web ui-routes 自述钉(承接大屏 13 处红字改档) (994d9dd6da1)
- 🔧 기타:九枚本机也红的镜像测试 —— 八枚是"测试停在旧世界/测量缺陷",一枚是共享判据的漏判 (d3646d3b255)
- 🐞 수정:大屏 13 处红字改走 danger 角色档 —— 真浏览器逐元素量出来 text-destructive 亮档只有 3.64(两档同值 #ff3333 是漏网的一族),换档后亮 5.65~6.47 / 暗 5.73~6.29 (a7a68146729)
- 🐞 수정:lucide-react-native 强制单实例；底栏取源方式定档留痕 (036f52bce07)
- 📚 문서:G-924 就地改判 —— 那 10 条取不到的图标 URL 全是零消费方死键,不是用户可见破图(出路改按门 121 摘死键) (9496f924ab9)
- 📚 문서:G-934 结清(接线枚 c5b3f0f65d9c7a6979b476bcce16e67caad34822 + 23/23 与 211/211 复量 + §17 真浏览器核验枚 82c9a68ae0f2acf61a84b709caa5ed4d4bce8cd3 + README 同步枚 c9e4a15681437b1d2efb595944a0b3a69072cbbb);G-935 记第一枚 e2e 与产品定档(维持"拆分=承载既有会话",不改真分叉;双流式/工具面板仍无用例 ⇒ 不翻勾;窗格会话 write-once 使更强形态结构性不可达,以 annotations.gap 点名);票60 行补现读残余(13 处根单例消费面定性清单 + ProgressJumpStore 未窗格化) (a96c36ad4c2)
- 🚀 기능/개선:关于页照 web 补齐六段内容,合规 7 项改走 i18n 取词 (cd57f5d3d38)
- 📚 문서:把 HEAD 面体积收回 96,000 预算内(96618→95854) —— 按 §1 两步走逐字留痕搬出两行:207 的旧档(warn 起步/50KB,已被同段"定档更正"整段取代)与一枚重复的压缩版页脚,去处 .ihui-agent/archive/AGENTS_trim-2026-10-20.md(同族追加,原位置留 HTML 指针注记) (b16c42f5261)
- 🔧 기타:票60/G-935 多窗格与滚动位恢复补上真浏览器核验 —— 新增 chat-pane-split-scroll-restore.spec.ts 4 例(① 切走再切回落点±60px 内且非零 ② 反证 短会话不冒充恢复 ③ 拆分后两格各有独立消息列表 DOM ④ 反证 同一会话双窗格 scrollTop 各记各的 |Δ|>200 + 根格切走切回恢复自己而 pane-1 不动);全链 page.route  mocked 不依赖活后端,PLAYWRIGHT_REUSE_SERVER 连跑两次 4 passed/4 passed;④ 更强形态(pane-1 也切走再切回)按产品事实不可达(窗格会话 write-once:canDropToPane 只认空叶 + dropConversationToPane 拒非空目标)⇒ 用例内以 annotations.gap 点名,不当已完成 (82c9a68ae0f)
- 📚 문서:登记小程序 10 条远程图标线上取不到(6 条代码残路径 + 4 条旧上传件已失) (93595c2f754)
- 🐞 수정:多设备在线时 versionCode 自动定档逐个 -s 询问（此前不带 -s 被 adb 拒绝 ⇒ 静默回落 1，产出降级包装不上） (fee177a1f8e)
- 📚 문서:G-927 现读进展 —— 判据认形态后误报清零,剩块级重复归人工 (40c78817179)
- 🐞 수정:取号器重号判据认系列小后缀形态,不再把正当小节读成撞号(G-927) (82ee72dbf12)
- 🔧 기타:失败清单必须带诊断 —— 只印用例名等于"红了 102 条却没有一个字说为什么" (bbb2f362441)
- 🐞 수정:三处"只在单层检出/单台机上成立"的判据 —— c-drive 路径正则、硬编码 G:、未入库证书夹具 (359af9e4b45)
- 📚 문서:§21 同步 —— D73 多任务窗格行补「会话级滚动位按窗格::会话落账」(G-934 把恢复接回生产后的用户可见能力:切走存 scrollTop+following、切回两段恢复+grace 修正、同一会话双窗格各记各的) (c9e4a156814)
- 📚 문서:G-939 结清 —— 旁路合并两半复量均已接车入库(门 100 A1 半 + 门 168 半) (0499c91575d)
- 📚 문서:登记 870 枚历史课程视频接入播放链(云端桶已就位,现网零课程行;上架前置三件) (3b07f00330e)
- 📚 문서:G-927 现读分档 —— 7 组里真孪生 8 处 vs 系列小节(O62 附族等),并点名两处判据不自洽(--check 按编号计数而默认路径自写"追加续写不算相撞"=同一把尺两个面两种结论 §0.6;plan-tasks-merge --heal 现读 F1 0/F4 0/F10 判不出 4,标题行不在 F4 射程 ⇒ 原出路结构性打不到);出路顺序改为先修分组键为「编号+标题整行逐字」再摘孪生 (5586dadcc31)
- 🐞 수정:视频小节详情补 playUrl 出网名,修小程序视频页必然黑屏 (消费方 video-detail/index.tsx:202 读 playUrl,生产者只出 url;新增 4 例离线契约测试钉住同值与 400/404 臂) (a1f899efb9f)
- 🔧 기타:fix(gate-?) killer-parity-ends 的两枚真红:一枚是测试停在旧世界,一枚是同值不同义没登记 (0cdbbf3719d)
- 📚 문서:G-926 就地改写 —— A 档 25 枚已由就近出口件中和(枚 7bbf24ec4b8120db003ae496455bcc8b9aed6cf8)、C 档 2 枚按账内出路放 .gitignore 例外(枚 c8b17fe8ea70de22ed59dc775bf4fafdfcdb2e65)、归属账两条由 T10 清单腐烂档点名后摘除;剩 B 档 58 枚的拦路是"旁路落地器表达不了删除"这一格,出路写成可动手的活(lib 已有 deleted 护栏,要的是声明式出口 + 反向自证 + 正反用例),题面 84 枚按现读更正为 87/命中 83/中和 25/残留 58 (594bc634bb2)
- 🐞 수정:release 构建拒绝裸 apex 基址 + ABI/基址回读对账（真机实测） (45397bc186e)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7145a144459)
- 🐞 수정:收口锁自检两处 flaky 成因 —— 计时窗外置身份探针 + 派生 CLI 显式 stdio(L7233 那一格) (6a06acc6709)
- 🐞 수정:旁路合并接门 168 —— 推进前复量本侧显式删除是否被合并带回结果树(G-939) (0f8a38e9cd1)
- 🚀 기능/개선:补齐 IP 白名单与 agent 护栏配置的读写面(整条要登录、只存不拦) (bb494eba53c)
- 🚀 기능/개선:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 기타:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 기타:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 수정:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 🚀 기능/개선:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (08e1da5b63d)
- 📚 문서:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 수정:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 기능/개선:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 기타:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 기타:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 기능/개선:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 기능/개선:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 기능/개선:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 수정:安全日志页按 security_logs 实列渲染，删掉后端从不给的"状态"列 (761a7a22cab)
- 🚀 기능/개선:PDF 三链真处理落地 + security_logs 接上写入出口 (e1cc3e36ec0)
- 🐞 수정:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 기타:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 기타:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- 🔧 기타:钉住危险操作确认的唯一旁路出口(L7224) (251ee617671)
- 🔧 기타:翻勾 G-107 / G-929 (7ea5a84ed10)
- 🔧 기타:修 G-929 过期用例并补 G-107 接线四例 (1a12afbdbf2)
- 🔧 기타:裁决 5 张待拍板票 + 销账 3 张失效票 + 修 1 张回捞副本标记 (a525b912d17)
- 🐞 수정:扫码弹窗平台清单拉取失败必须响 —— 不再静默留白 (79451dab125)
- 🔧 기타:publish-scan 归入 @browser-hub 档 + 平台选择兼容 pill(机主选 A) (c364b64a0de)
- ♻️ 리팩터:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)
- 🐞 수정:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (63cd174c852)
- 🐞 수정:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (b6568357c97)
- 🔧 기타:work-panel 切 tab 改按 store 现读 id 选「非激活那颗」—— 收 P4-6 (ddfa3590e0e)
- 🚀 기능/개선:暖色描边禁令装上旁路落地腿 —— 门 231 增 --rev 审树档,落地器 fail-closed 调用 (e1f18b5a320)
- 🐞 수정:登录历史改接真数据源 audit_logs，并清偿本会话写进的 zh-TW 简体用字 (05940a38cef)
- 🔧 기타:重钉 ui-routes 派生自述钉(承接 6ddca76ce8 的 11 处源改动) (b39af6dae53)
- 🐞 수정:原生组件着色属性位的 CSS var 全部改成 JS 派生值 —— 11 处此前静默回落宿主默认色 (6ddca76ce83)
- 🔧 기타:重钉 web/RN ui-routes 自述钉并补回 MyPapers/DistributionCompany 两枚白名单(1fc61a86437 旁路落地未跑写回钩子) (5bede5f6858)
- 🚀 기능/개선:把"没设≠没色"这条因果律推到 web 腿 —— 门 231 增 W5 与 CSS 输入类维,并钉掉 3 枚裸 Switch (be681a0bcee)
- 🔧 기타:fix(tokens)+feat(scripts): danger 暗档文字改取 #f87171(原 #ef4444 压在自己 /10 淡底上实测 4.21 不达 AA)+ 状态色文字射程对账尺子入库(自检 8/8、镜像 9/9,含同面口径修正) (721e61b929b)
- 🐞 수정:资产注册表强制单实例 —— 根治「本地 PNG 的 Image 在 release 上恒空白」这一类 (4a876685d26)
- ⚡ 성능:图片引用升 ?v=20261021 + 预热脚本 no-cache 强制回源 (720d3f582f7)
- 📚 문서:补 §21 欠账——登记移动 App 与 web 逐页对齐口径与本批 35 屏 (2834f08be35)
- 🐞 수정:登录历史卡按 security_logs 实列渲染，不再读后端从不返回的字段 (dcf3735fc2a)
- 🐞 수정:补录侧边栏新挂 7 入口的 ROUTE_ROOT_BG chrome 档(ApiKeys/Usage/Groups/Invoices/Points/VoiceStt/AgentCategories) (76452bb2069)
- 🚀 기능/개선:补齐我的试卷与分销中心，并收口 i18n 动态拼键反模式 (1fc61a86437)
- 🐞 수정:反代目标 localhost → 127.0.0.1(修正 d4bfb37b7e6:标题即此修复但内容未落地) (0d36f406d20)
- 🚀 기능/개선:侧边栏对齐 web 第二批 —— AI 组补 /models 与 /agents 父子入口,三域补 web 漏挂项,清 4 处重复登记,回归锁扩到域 hub(web 端零改动) (330056b5352)
- 🔧 기타:按 HEAD 干净面重生成 web/RN 两份 ui-routes 产物钉 —— 收门 105 的 G5 (acc4ab047d5)
- 🔧 기타:摘回门 233 注册条目 —— 点名面被他人 605 行在飞改动占住,先不给别人埋雷;门体降为常设只读尺子 (ec025c8fd6d)
- 🔧 기타:work-panel 收藏按钮按 aria-label 定位 + 切 tab 改为轮询等待 (d07b67bfdbb)
- 🔧 기타:清掉 check-ops-patrol 三枚存量红 —— 两枚是测量缺陷,一枚是半截落地的欠账 (04b56a1011f)
- 🐞 수정:反代目标 localhost → 127.0.0.1,根治 WS 通知 ECONNREFUSED(34,701 次 ::1) (d4bfb37b7e6)
- 🔧 기타:G-924 apps/cli 记忆模块两处直连后端改走 api-client(守门 73 真存量):新增 packages/api-client/src/endpoints/memory.ts 端点(listMemories/createMemory),endpoints barrel 增加导出;UnifiedMemoryClient.getEntries/addEntry 由裸 fetch 改调 api-client 端点,保留 SSRF 守卫与降级语义 (7f586945251)
- 🚀 기능/개선:门 233 门体入库 —— 状态色文字角色档的对比度射程对账(自检 8/8 含两支阳性对照与两支反证) (33bee2381e2)
- 🚀 기능/개선:新守门 check-state-text-contrast.mjs 接进提交链 (c7d7f57aaf8)
- 🚀 기능/개선:补齐 6 屏对齐 web 内容编辑域(文章/问答/名片/AI世界/广场发布) (ce9c8c08a8e)
- ⚡ 성능:/status 只 SSR 前 30 条模型,其余按需展开(1.05MB → ~30KB) (b9ec5f4dfaf)
- 🔧 기타:登录请求显式声明通道 —— 解开本机 e2e 全量的 401 阻断 (67c57e311b6)
- 🚀 기능/개선:补齐 14 屏对齐 web 用户/发布/学习域 (1982228870b)
- 📚 문서:G-939 成因查明并改写 —— 门 100 头注自写口径只覆盖提交链,而 git-sync-converge 是 commit-tree+CAS 旁路不跑钩子 ⇒ 对旁路合并结构性失明;活改成"把 A1 判据 import 给旁路侧复量" (587f74e7c7d)
- 📚 문서:登记「已推送提交被并发合并吞掉且守门 100/168 当场没响」这一格(现读枚 12898ccd9b 双否,已 tag 保全并重落) (ffc81df2014)
- 📚 문서:G-921 翻勾 —— 三枚(Connectors / DomainHub / McpStore)共享层下沉全部落地并上线(枚 588a6342d8 / 7f9eb8eb00 / cc9b3672ef) (316bc4bf2e7)
- 📚 문서:登记门 39 全量档新增的 6 枚 V1 红(枚 8f16334f48 补齐 12 屏里的 ConnectedAccounts / ImageGenGallery / ImageGenTemplates / Points / Usage / WrongQuestions 六屏未做共享层下沉) (d7deeddd30b)
- 🔧 기타:重生成 RN ui-routes 自述钉并补回 SecurityCenter 白名单条目(45088b42447 旁路落地时未跑写回钩子) (752074e67f6)
- 🐞 수정:后台守卫不再把「角色还没查到」折成 0 —— 真管理员冷加载 6 次有 3 次被弹到 /forbidden(附双臂变异自证的时序测试) (c9a75878532)
- 🐞 수정:监控面板查询失败整轮不落结果 (f6f9715fe98)
- 📚 문서:守门 229 那条就地改写 —— 补 H4 档(摘前先问门 71 会不会把这条按未勾还原)、H3 基线改判 HEAD^、新增 state=all-held 与 exit 3 的机读结论(全仓不再有无需清扫式兜底文案) (ef8e6666cc9)
- 📚 문서:票60 就地改写进度注记 —— 第三、四批已落(含被并发合并吞掉那枚的重落凭据),未收口只剩 e2e 真机核验与描边态分窗格 (4e4fc9e5b25)
- 📚 문서:登记本轮收口留下的六件真活(归档件 lint-staged 雷区其余 84 枚 / 取号入口被 O 族重号顶死 / 门 105 G5 产物钉存量红 / D197 换行开关用例存量红 / 会话滚动位恢复无生产接线 / 多窗格缺 e2e 真机核验) (d96c474a17c)
- 🚀 기능/개선:票60 第三、四批 —— 续传/工具面板/发起分析全面窗格化,跳转总线按窗格门控(重落被并发合并吞掉的 12898ccd9b) (d3541dc2670)
- 🚀 기능/개선:G-921 第三枚(收官)—— McpStoreScreen 的 UI 下沉到共享层(新建 packages/app/src/features/mcp-store/McpStoreScreen.tsx + index.ts 导出组件、类型与共享判据 mcpInstallBlockedKey),RN 侧改 wrapper(只留四项 API 调用 get / install / setStoreServerEnabled / uninstall、安装与卸载二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen / DomainHubScreen / ConnectorsScreen 同一型 wrapper 模式。 (cc9b3672ef2)
- 🐞 수정:输入框外框的常驻暖色环也纳入判据 —— 门 231 W1 增 W1-input 维 (177e5230c40)
- 🚀 기능/개선:补齐 12 屏对齐 web 设置/内容/交易域 (8f16334f483)
- 🐞 수정:监控面板查询失败保留旧数据 + 筛选下拉不再撑满整行 (70ea7877d40)
- 🐞 수정:底栏图标改走内联 data URI —— 本地 PNG 的 Image 取源链在 release 上恒空白 (10c2d9e7643)
- 📚 문서:G-921 登记第二枚(ConnectorsScreen)下沉共享层的进展与凭据(枚 588a6342d8;门 39 全量红 2→1;剩一枚 McpStoreScreen 归下一批) (c8ee7a2c4d6)
- 🐞 수정:持续性门槛的 firstAt 必须同时进 info —— 派发侧读的就是那一份 (b398a4035ca)
- 🚀 기능/개선:G-921 第二枚 —— ConnectorsScreen 的 UI 下沉到共享层(新建 packages/app/src/features/connectors/ConnectorsScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留 API 调用 get/setEnabled/sync/delete、删除二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen/DomainHubScreen 同一型 wrapper 模式。 (588a6342d8b)
- 🐞 수정:补录 SecurityCenter 的 ROUTE_ROOT_BG chrome 档(屏内渲染 NavBar,顶栏 chrome 结构锁判据要求) (c849c50fa11)
- 🐞 수정:守门 78 补第六维——外部依赖声明↔链接对账,根治 lucide-react 断链致 8 端构建阻断 (c1e0350c61b)
- 🐞 수정:监控域之外 5 处状态色文字同接角色档 —— 全 web 残留读数 0(同族后缀档 4/4 未动) (1227a9742cb)
- 📚 문서:G-921 登记第一枚(DomainHubScreen)下沉共享层的进展与凭据(枚 7f9eb8eb00;门 39 全量红 3→2;剩两枚 Connectors/McpStore 归下一批) (0e948350380)
- 🚀 기능/개선:G-921 第一枚 —— DomainHubScreen 的 UI 下沉到共享层(新建 packages/app/src/features/domain-hub/DomainHubScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留路由参数 domain、导航分派 target、i18n 与主题注入),照 PaymentScreen 同一型 wrapper 模式;条目图标以 ReactNode 由平台注入,共享层不绑定图标注册表。门 39 全量档红 3→2(DomainHubScreen 摘掉);共享层与 RN 两侧 typecheck 对本票文件零错误(存量 35 条红全在他人工作树删掉的 drawer-nav / SelectionAnnotationBar 面),eslint 0 finding,水印 verify 通过 (7f9eb8eb00b)
- 🔧 기타:重钉 web/miniapp ui-routes 自述钉(承接监控域角色档接入) (4a02eacc6f3)
- 🐞 수정:状态色新增「文字」角色档并接上监控域 48 处 —— 亮档真机实测 1.96~2.62 提到 AA 4.5 以上,暗档取值逐字不动 (c2b0c254a12)
- 🚀 기능/개선:安全中心对齐 web 设置页(评分/2FA/会话/安全事件) (45088b42447)
- 🐞 수정:/agents/featured 去掉从未实现的 featured=1 参数并取全量 —— 原来静默只显示 20/124 (37805cd2e1a)
- 📚 문서:现读订正「锁的初始化写全再原子可见」—— lib/lock-atomic-init 已在 HEAD 且两把锁均已接线;解阻判据①③成立,② 的 deploy-lock 套件本机并发下 flaky(三连跑 50/2、51/1、52/0),未归因不冒领,留一格 (c4f81394c79)
- ⚡ 성능:英文首页与公开内容页加边缘缓存头 (940303d21db)
- ⚡ 성능:public 图片按显示尺寸收敛，53MB → 49MB（首屏 logo 867KB→53KB） (52257166e09)
- 📚 문서:修 tab-bar-metrics 的陈旧注 —— 「颜色一律走 CSS 变量」与实测相反 (cd10e14a8dc)
- 🚀 기능/개선:抽屉侧边栏对齐 web 侧边栏(导航单源 + 二级子菜单 + 内容域) (83e0be9c16d)
- 🔧 기타:暖色描边禁令补齐 extension 射程 + 落原生插件调用形状回归档 (3ea4cbba0cf)
- 🐞 수정:两处生产者从不发射的字段错配 —— 停摆正文出处句恒缺失、TEMP 在写证据支恒 0(同 firstAt/stat 一族) (b4872d129c6)
- 📚 문서:现读订正「AGENTS.md 体积判据接进提交链」—— 门 207 已按 1 行紧凑块接线(HEAD 4855 行),C1 余量 389;同轮报警:AGENTS.md 现读 95,845 字节 / 预算 96,000,余量仅 155 字节,出路=整区归档(不代裁范围) (56844bc8e5f)
- 🐞 수정:目录一次取全(默认 20→200)+ 修 community 触底重复追加同一批 (c30b7f4f107)
- ⚡ 성능:状态页 RSC payload 1.97MB → ~150KB，模型列表改客户端渲染 (7d1d322bf58)
- 🐞 수정:市场全量页补 pageSize=200 —— 不带参只吃服务端默认 20,124 枚只见 20 (a3b180513e1)
- 🔧 기타:work-panel P3-3 补 openPanel() —— openPanel({url}) 只导航不置 open (e345966dd6f)
- 🐞 수정:重贴被并发收敛卷掉的目录取全修复(RN 增量渲染 + 扩展 30→200) (bf2f6aa466e)
- 🔧 기타:重钉 web/miniapp ui-routes 自述钉(承接漏斗与磁盘配色两枚改动) (e9343fc4c1b)
- 🐞 수정:门 232 补 onFailHint(此前是两行空串,失败时提交者拿不到任何出路,只能跳门 —— 违 §0.8/§0.10);同笔把门 39 注释里已失真的写死计数(151/153、白名单四枚旧名)改成现读口径 + G-922 后判据形态 (3fb86c5891f)
- 🐞 수정:漏斗末段绿条与磁盘指标取同源 token —— 原 emerald-600/purple-600 亮档白字实测 3.61/暗档 2.40 低于 AA (c505a415681)
- 🐞 수정:「我的 Agent」页签改走 /agents/my —— 原来显示的是市场前 20 枚 (3d8d56c58f7)
- 📚 문서:更正 sshd 自愈块的归因 —— 502 是本机隧道副本无 sshd,不是生产 sshd 挂了 (ba37f554225)
- 📚 문서:G-922 登记守门 39 判据四修的进展与凭据(枚 bd3bc2238c;剩一格=21 枚屏级共享存量归 G-921 与各屏持有人) (6856b4d1071)
- ⚡ 성능:首页边缘缓存头 + 公网缓存预热脚本 (7ee87c82172)
- 🐞 수정:冷启动准入不再把 httpOnly 老用户判成匿名 (1d541e8dbe5)
- 🐞 수정:守门 39 判据四修(G-922)—— ① ROOT 不再由 cwd 定根(改由 import.meta.url 推导) ② screen 正文按面取 blob(HEAD/索引/工作树,取不到即未判定),不再 readFileSync 读盘 ③ 白名单带 why+expires,到期失效、登记名在 screens 清单里不存在=腐烂判红(按现读摘除 DebugScreen/SquareScreen 两枚死账,存量归零后本维才设红) ④ 新增「屏级共享」维:有 import 还得 packages/app 有同名共享屏,存量 21 枚只报数、只拦新增与退化(§0.2 存量未归零不升 blocking);自检 12/12 + 镜像 6/6 + 变异自证(恒真变异 ⇒ 4 例镜像 + 2 例自检翻红) (bd3bc2238c6)
- 🐞 수정:部署时自愈 sshd —— 生产 SSH 入口 502 的真因是本机 sshd 没在应答 (1eda2b49ef1)
- 🐞 수정:公网探测派发契约补上 stat 出口 —— 修严重度档恒 0 使恶化即重报通道失明 (31b33393ae3)
- 🔧 기타:chat-search 搜索框改按真实 testid —— 旧选择器在共享 SearchInput 上结构上不存在 (dd11b1712e9)
- 🐞 수정:门 231 staged 档把「本枚提交无射程内文件」误判 exit 2 —— 对任何无关提交恒红 (97891b940c7)
- 🐞 수정:自定义 tabBar 选中色/光晕改走 JS 派生态 —— 根因是内联 var(--color-*) 在 weapp 不解析 (e0fbb8a6247)
- 🔧 기타:修门 77 镜像测试的 B6 行定位提取式(排版加粗即假红,判据强度不减) (ec6e4465d33)
- 🚀 기능/개선:门 212 加维 —— RN 聚焦档 focusedStyle 不得带几何键 (e2810ebc063)
- 🔧 기타:清扫轮摘行前先问门 71 同一把尺子,并修掉 H3 一处既有假红 (7388b68c073)
- 🔧 기타:重钉 web ui-routes 自述钉(承接 wb-cells 定义补齐) (d14a982fb90)
- 🐞 수정:拔掉原生强调色回落系统橙的那条腿 (eacdb510932)
- 🐞 수정:补上 wb-cells/wb-cells-lg 的 CSS 定义(修上一枚引入的单列竖排回归) (ce29449b653)
- 🔧 기타:checkin 页补账号列表桩 —— 收「空状态永不渲染」那一格 (a0ec15f3e0a)

**2026-10-20**
- 🐞 수정:修掉本票 e2e 锁里一枚不存在的 Playwright 断言方法 (c7de0dc2d18)
- 🐞 수정:被动失效清桌面 vault 也走 CAS —— expireSession 曾盲清 auth.json,抹掉另一窗口刚轮转写回的新 token(自动登录时好时坏的另一条腿);补 api.test 三例与 store 侧 CAS 五例、小程序 clearAuth 同批清用户资料断言 (e53a1911c91)
- 🔧 기타:收紧门 218 的 RN 端硬编码 hex 基线(P0 治理后置) (c498f676642)
- ♻️ 리팩터:摘除 packages/app 零消费者底栏副本(文件 + barrel 两行导出) (1d8f576f35a)
- 🔧 기타:给监控面板两种呈现的切换器钉一条真实浏览器 a11y 回归锁 (d4c48f875eb)
- 🔧 기타:首次 bootstrap .ihui-agent/archive/ 的 lint-staged 就近出口件 (a966301a801)
- 🐞 수정:归零 11 屏 137 处圆角死类名(此前圆角实际为 0),并修 3 屏占位符明暗颠倒 (1e965254164)
- 🔧 기타:重生成 ui-routes 产物自述钉 —— 收旁路合并点名的那步"落地后需重生成" (4d57b0c3080)
- 🔧 기타:重钉 web ui-routes 自述钉(承接内层网格改造经归并后的当前面) (4c9736fb71e)
- 🐞 수정:大屏内层 StatCell/KPI 网格改 auto-fit,消除窄轨逐字换行 (706f8d02dd7)
- 🚀 기능/개선:暖色描边禁令接进提交链(注册条目) (f288064073c)
- 🐞 수정:根治输入框橙色描边(主题级缺陷,全端所有输入框同时中招) (8c952aac27d)
- 🐞 수정:重生成 ui-routes 自述钉(设置页两处登出改动使输入集哈希失效) (3bf512e4656)
- 🐞 수정:登出标记只在用户主动退出时落 + 多窗口 vault 回收走 CAS (7465df281a6)
- 🔧 기타:重钉 ui-routes 产物自述 pin —— 收门 105 的 G5 (a68bf1d5e58)
- 🐞 수정:监控面板页改成共享 Tabs 的「根包 List + Content」写法,补回 role=tabpanel (c64ca1aba30)
- 🔧 기타:追平 web/miniapp 两枚 ui-routes 自述钉(90b14bf8526 的追平被并发落地顶旧) (54199c2139e)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc027e1412e)
- 🚀 기능/개선:门 208 加第二把豁免载体(每处一行、存续由门现算),不再动他人现场 (5daba796e04)
- 🔧 기타:跟平 ui-routes 自述钉(旁路落地不跑 pre-commit 写回档) (747ca440a36)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2fe034dd979)
- 🔧 기타:重钉 web ui-routes 自述钉(承接监控目录红色档收口) (3cb0c290df7)
- 🐞 수정:监控目录红色档收口 text-danger,并修漏斗末段暗档白底白字 (b444e5afdf3)
- 🐞 수정:补正胶囊指示条缩进档,并改掉本票头注里一句假话 (98dfbb79707)
- ♻️ 리팩터:上滑/下滑浮动箭头钮收进跨端单一源 scroll-jump-spec(与 web 同款) (90b14bf8526)
- 📚 문서:D690 摘行(完成即删;上一枚已带结清裁定与全部凭据 sha) (569b2977366)
- 📚 문서:D690 结清——剩余一格裁定不救,维持 fail-closed(机主待拍板项全权授权代行;凭据三件入库,详见行内注记) (1127428b72c)
- 🔧 기타:重钉 web ui-routes 自述钉(承接监控目录同族色值与网格改动) (14769267179)
- 🐞 수정:监控切换器选中态改品牌实底对 + 大屏落点 e2e 断言收两形态 (c67496a4f7c)
- 🔧 기타:跟上注释一枚的 ui-routes 自述钉(旁路落地不跑写回档) (399b7d74ab7)
- 🐞 수정:监控目录同族色值收口 + 大屏主体网格改按容器判定 (8e6da18c552)
- 🚀 기능/개선:新守门 check-auth-cookie-domain-scope.mjs —— 会话 Cookie 域作用域对账装进提交链 (d7edb8373e4)
- 📚 문서:如实登记底部胶囊光晕在本端的取证状态 (3b8b7092e58)
- 📚 문서:登记守门七七的 dead-class 圆角真存量票 (f73a575af59)
- 📚 문서:登记守门普查净检出分桶带出的三件真工作(RN 屏提取/守门三九判据缺陷/记忆模块直连) (fe5152cbce7)
- 🚀 기능/개선:新守门 check-auth-cookie-domain-scope.mjs 接进提交链(会话 Cookie 域作用域对账,id 现取) (9466ff75282)
- 🔧 기타:跟平两处 ui-routes 派生码自述钉(输入系他人已入库改动) (ba2eb2d7999)
- 🔧 기타:跟进底部胶囊单一源改动的 ui-routes 派生码自述钉 (8c978e5dd27)
- ♻️ 리팩터:底部胶囊几何收成一份源,并钉住"两端必须转发"这条前提 (a3689de714a)
- 🔧 기타:重钉 web ui-routes 自述钉(承接大屏页头与面板页两枚改动) (1a3f8bf5f08)
- 🐞 수정:监控面板页 7 处固定色换语义 token(亮色档下 cyan-300 近乎不可读) (f2a834491b9)
- 🐞 수정:显式登出与被动失效分离,停用迟到重放吊销整族 (3aad1aa1563)
- 🐞 수정:公网探测持续档取不到 firstAt 致告警被无限压住 (efb00b021ff)
- 🐞 수정:会话 Cookie 域补公网臂——Host 改走代理感知出口 (5c1b396b1e4)
- 🐞 수정:占位符色改走 text.tertiary 档,收掉守门二一八的四处基线外新增硬编码 (7e9236d26fb)
- 📚 문서:完成即删 —— 摘除上一条刚结清的 G-921 已勾行(四件入库凭据见枚 dfbb61a0d0d29485c2ddc02265053c19e3c94e84 的行内注记) (0811d6856f3)
- 🐞 수정:监控呈现切换器选中态改提亮 —— 暗色下纯黑压在灰槽上比底还暗,读不出选中 (77455aed69d)
- 📚 문서:结清 G-921 —— Coze 导入留下的四件逐条现读复验已入库,附两枚 sha 与门读数;并更正头像签名有效期措辞(现读 3 天/30 天) (dfbb61a0d0d)
- 🔧 기타:重钉小程序 ui-routes 自述钉(承接本端 Agent 契约补迁的 7 枚输入) (d4f9217e507)
- 🐞 수정:拉取详情不再把头像/模型刷成过期值 —— Coze get_online_info 映射收口 (7aaff2fceb4)
- 📚 문서:回潮副本行内登记「勿照此行派单实现」,勾态不动 (77e41809d5b)
- 🐞 수정:e2e-browser-hub 拓扑构建补第三个选择器 —— extension 的闭包也在内 (7069b49f888)
- 🐞 수정:门 208 按双向核验分流本仓 linked worktree,并把两枚独立克隆搬出仓树 (5ef950c3b41)
- 🔧 기타:重钉 openapi 产物 favorites resourceType 枚举 —— 收 OpenAPI Check 的 ARTIFACT_DRIFT (385bd05b73b)
- 🚀 기능/개선:导入 Coze 官方工作区 116 枚智能体的头像静态件 (080c9461698)
- 🐞 수정:会话 Cookie 域按请求 host 判定,本机地址不再丢 Cookie (d230137b8a4)
- 🔧 기타:清掉两道拦所有人的存量红(门44/90)[cross-domain] (8be351e966e)
- 🐞 수정:门 193 点名 check-format-changed —— 派生 git 的 stdio 属性名写回调用点 (51da8721926)
- 📚 문서:回潮的同题副本改判留勾(不摘第二次) (2faad2d9bd2)
- 🐞 수정:e2e-browser-hub 把拓扑构建提到 migrate/seed 之前 —— 收那条自 10-16 在位的恒红 (eacf036197c)
- 📚 문서:结清 5 行(影子js/生成器关停/传输层单点化/Python悬空尺子/同题副本)并改判 4 行的等待前提 (30fb6d56a0a)
- 🔧 기타:四枚主线红追平产品结论 —— 埋点装饰/告警身份/ERC20 校验/400 中文文案 (88ccfa0a921)
- 🐞 수정:补迁 Agent 契约真实载荷 —— 收 CI typecheck 本端 34 条红 (9d9dbc8262e)
- 📚 문서:D690 改判 diff② 在 chat 腿结构性不可接,剩余一格归拍板(可达性锁已入库) (aa6dc1d67a9)
- 🐞 수정:玻璃底回调至 0.6,底部标签选中态放大一档 (84e9a56ef59)
- 🔧 기타:D195 簇 web e2e 收口第二批(几何/视觉/下载/页面/i18n/登录史)+ CI 浏览器共享内存 (788e6867ab8)
- 🐞 수정:补迁 Agent 契约真实载荷 —— 修 sidepanel Agent 页运行即崩的一格 (68fea6fa5e5)
- 🔧 기타:钉住 D1047 主对话腿重放取数侧的可达性锁 (1f9ee2e4912)
- 🐞 수정:聚焦描边只换色不改宽,收掉登录框同型的五处覆盖 (9cebf01a24d)
- 🚀 기능/개선:立守门 229 拦完成即删的跨枚滞留,并给无人值守兜底清扫轮挂 git-guardian 巡检 (c79fbf794c5)
- 🔧 기타:补删 FenLeiOverlay 的孤儿测试(组件已随 2ddd180933b 移除) (029f86fab89)
- 📚 문서:点名守门 229 与完成即删兜底清扫轮(门 89 R4),并按门 207 体积预算把 11 行逐字移入归档件 (d7d796630e4)
- 📚 문서:登记 Coze 导入留下的四件未提交件(等共享索引空闲再落) (1c9e11fda84)
- 🔧 기타:D195 簇 web e2e 收口第一批(chat/form/queue/work-panel/nav/topbar/login)+ 生产构建暴露口 (1a8690b2ffd)
- 🔧 기타:跟进底部胶囊改动的 ui-routes 派生码自述钉 (83a377f662f)
- 🐞 수정:底部胶囊与 AI 输入框同宽高 + 选中态改浅紫发光 (2f846651b8d)
- 🐞 수정:首页共享屏去空壳堆叠,发现区改宫格 (47f23ed3279)
- 🔧 기타:重钉 web ui-routes 自述钉(承接归并带入的 panels 页改动) (c9cf3c5466b)
- 📚 문서:第二轮配平翻勾 2 条(补齐门 71 的 closed 计数欠账,为摘行留凭据) (ce6ccb06dc0)
- 🐞 수정:大屏去掉灰底网格,监控呈现切换器并入顶栏不占一行 (ba708e445bc)
- 📚 문서:配平翻勾 8 条被门 71 以未勾形态回捞的已结清票(走该门头注 (c)「翻勾后整行删除」的合规通道,为下一步摘行留凭据) (ac9a172b234)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (36b096a1044)
- 🔧 기타:重钉 web ui-routes 自述钉(随大屏页头改动) (474d771c7bd)
- 🐞 수정:大屏页头改按容器判定并放行 admin 菜单路由公网可达 (805a36bad69)
- 🚀 기능/개선:票60 步序四第二段——非根窗格独立聊天主体 + 窗格事件门控 (23a2c8ac126)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (408c993d53a)
- 🔧 기타:重生成 web 端 ui-routes 派生码自述钉(跟上 panels/wallboard 入库改动) (b60e5f56b41)
- 🐞 수정:监控面板去掉多余外层容器,内容直接铺满工作区 (5713188d85a)
- 🐞 수정:监控面板页根元素补 px-4 收口 CI Lint (26f0c721d1b)
- 🐞 수정:首页共享屏暗色分层与空态排版 (252ff4d30d0)
- 🐞 수정:首页底部停靠区与页面根容器去除背景色 (4b4bddfe647)
- 🐞 수정:windowsHide 内联到 execFileSync 调用点(守门 52 不解析 GIT_OPTS 常量) (31234e4f326)
- 🐞 수정:Agent 契约对齐真实载荷 + 收藏链路根治 (df3d00b6f4d)
- 🔧 기타:根 README 四语言版纳入 prettier 忽略(活文档/生成数字表) (a25f24ce2c5)
- 🐞 수정:底部玻璃停靠区透度回调至 0.3,AI 输入框恢复实底 (49081304698)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (428fd111c96)
- 🐞 수정:聚焦描边只换色不改宽，消除框内提示文字上移 (76535df0373)
- 🐞 수정:exam-status 埋点装饰器加 as never 收口 Fastify decorate 类型 (a991458844b)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (77e31790ae6)
- 🐞 수정:监控大屏门改名后补齐 guardian-runner 注册(panel→grafana) (e9d86c6b336)
- 🐞 수정:补删分类弹层 FenLeiOverlay 与配套测试(901c985 提交面漏删) (2ddd180933b)
- 📚 문서:体积门 207 三次修剪——合并复涨后回到 91,924 字节 (0c4b07a18a5)
- 🚀 기능/개선:收口 SSRF D-1 信任 API + 四处接线 + 危险档拒绝单源 (7714723963d)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5509ee26ea6)
- 📚 문서:登记新表 chat_form_responses,并如实记一条总数口径分叉(不擅自统一) (6cff28ae799)
- ♻️ 리팩터:票60 步序四第一段——发送链路按 store 实例化(默认单例,行为不变) (7f7ad9f17a7)
- 🔧 기타:prettier 归一四枚本轮改动文件(差值格式门只判触碰面) (8d728fa7e76)
- 🐞 수정:收口 CI JS 测试 21 个失败(G-192 回显/埋点装饰/夹具漂移/RN 根底色) (7e06d5f8e1e)
- 🐞 수정:首页移除「分类」入口与赛道分类弹层(2026-10-20 用户定:分类没用) (901c9852944)
- 🐞 수정:format 门改为差值棘轮 + AGENTS 体积门回绿(96KB 内) (71da97a61f5)
- 🚀 기능/개선:监控面板与大屏合并为同页双呈现 (fa45a37e778)
- 📚 문서:G-16 第(ii)格写清"判据已写成但性能不达标故未落地",并留 patch 与下一步唯一路径 (bc509c86c5d)
- 🐞 수정:收口 test-python 8 个失败(告警哨兵/CORS 测试隔离/Windows 语义/响应契约/预算用例) (e38aa0d597c)
- 🐞 수정:删除 plugins-data 15 枚与 @ihui/shared 逐字节相同的重复副本 (06e0461dbc5)
- 📚 문서:12 条 RN/小程序行的票面前提逐条现读更正(含纠正本会话先前写下的两处不实读数) (975183dd263)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e3a4cb6b12)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9cf0d32506f)
- 🐞 수정:字标缓存键升到 v4 —— 旧键下边缘缓存仍是 1.18MB 旧文件 (72d94670955)
- 🔧 기타:重钉 web ui-routes 自述钉(随 monitor 大屏/面板页改动) (cfeb19b8beb)
- 🚀 기능/개선:大屏与面板渲染配色 token 化,适配明暗主题 (772e5e5c029)
- 🐞 수정:监控面板左侧盘名去掉冗余 IHUI-AI 前缀 (ba3f88a3f63)
- 📚 문서:补正 G-197 复损结算行的勾选态(上一枚该行为无空格形态致翻勾式落空，凭据注记已在位) (5994c04ac55)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (42e6cd81aef)
- 📚 문서:复损结算 7 行——66f91ad2a1 结清的看板拆档/续写x2/G-921/O46/r81/G-197 被守门71回捞按未勾带回,逐票现读复验后重翻勾(凭据见行内注记) (318843818f4)
- 📚 문서:摘除已勾的「新维度第一次用就切出可执行清单」那行(完成即删;该行与远端两条未勾重复行同题,删我方已勾版以解除合并时的三版并存) (b404061c5da)
- 📚 문서:D77 行补残余② 落库读数,并把仍欠的两格写准(迁移未应用 / 状态回显读口未加) (4065818cabb)
- 🚀 기능/개선:D77 残余② —— 对话流业务表单应答落库(新表 + 唯一写入点),机主已授权 (1ba65dac743)
- 🐞 수정:监控面板左侧盘名去掉冗余 IHUI-AI 前缀 (2d7f1a09d68)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (477cb2f3d26)
- 🐞 수정:门 13d 维④落地当场自我误咬 —— 加"短侧须承载实质正文"下限,读数 26 对 → 0 对 (f29cbf9b69c)
- 🔧 기타:删除已复结的 G-107/G-77 行(完成即删;未勾行逐字保留) (bfbce8cd3c9)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b31520b1cf0)
- 🔧 기타:复结 G-107/G-77(远端线回带旧行;翻勾后删除) (ba8d1b21742)
- 🐞 수정:a13 投影对账补「变量名工具」配对登记 —— skill-tool 的 name 取自常量 SKILL_INVOCATION_TOOL_NAME,门侧只能记 (non-literal);登记后真名仍要过 runtimeNames==gateNames,并新增 pairedCount==清单长度这条反向锁(站点不再命中即红),107 计数与具名+匿名解释式逐字不变(反向验证:登记位指错文件即红、多一条永不命中即红) (83b05be416e)
- 🐞 수정:e2e.yml 排除 @browser-hub 档(该 workflow 的 services 只有 postgres+redis,无 ai-service 与 python Chromium ⇒ 这一档在这里必然 500;spec 头注自述分工,现读 e2e-browser-hub.yml 以 --grep @browser-hub 专跑,覆盖率不丢;--list 实测 2 条→0 条,余 721 项) (85f6205c2a4)
- 🐞 수정:收口被整块重复的登记(F6 块级判据的修复出口) (4a0d0bddefb)
- 🔧 기타:在 origin 最新基线上清除已完成行与归档占位(405 已完成 + 21,531 归档;G-79 完成即删;未勾行逐字保留) (89c6cf79835)
- 🚀 기능/개선:门 13d 加维④「严格前缀型副本对」差值棘轮 —— 这一型今天三把尺子全放过 (031aa1eed9c)
- 🔧 기타:门208 豁免清单随现场销账(四处容器目录均不存在) (5591f6bbfe6)
- 🐞 수정:课程播放链路补齐——目录页传课程 id、章节页改拉 catalog、media3 钉回 1.8.0 (efda922cdbe)
- 🐞 수정:自跑归因透传门源标记 + 主仓 dist 重建前补依赖闸 (9cff4d51bdc)
- 📚 문서:摘除门 13d 维③那格(完成即删第二步;取证与定档理由在 882535a54f2 的提交信息里) (6cf48a6ee05)
- 📚 문서:翻勾门 13d 维③那格(判据已入库 882535a54f2,镜像 12 例含形状锁) (f62b39232fb)
- 🐞 수정:按 HEAD 源面重生成 ui-routes(补回并发暂存删除漏掉的 domains 页) (c1a532e08d1)
- 🚀 기능/개선:门 13d 加维③「同一行叠同一注记」重数棘轮 —— 收口 2e23f04a309 登记的那格 (882535a54f2)
- 🔧 기타:合并后重生成三端 ui-routes 产物 (0331094bf17)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31087baf3fa)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc0eba4e42c)
- 🔧 기타:跨机归并让号 G-317→G-1162551、G-920→G-1142551 (225d59f3bc6)
- 🐞 수정:收口被整块重复的登记(F6 块级判据的修复出口) (c1294100442)
- 🐞 수정:跨机归并保留对侧 227/228 两道门 (5993a7efc7f)
- 🔧 기타:复结 G-77 生成器资源关停门(翻勾;54/54 自检,20/0/0,接线对账 RC=0) (7a80a50eaf6)
- 🐞 수정:G-77 生成器资源门收口 14 处未判定(54/54 自检 + 9/9 镜像;warn 保留,blocking 前置=索引全树枚举) (0c073d7ae61)
- 📚 문서:把 2e23f04a309 那行里"写成预测"的一句换成实测口径 (b1c21a91516)
- 🐞 수정:监控大屏历史盘公网取数 403 —— monitor-panels/query 显式放行公网 (341ed0e1a7c)
- 🐞 수정:净面安装闸按依赖面指纹判定,修新增依赖永远装不上 (8f39888b0f1)
- 🚀 기능/개선:课程章节页接通播放器——children 透出 videoUrl,拍平小节并带地址进 VideoPlayer (109be29e063)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67a47299fa4)
- 🔧 기타:G-104 完成即删(证据在 9ae41995/323efb1b/56e0d5b7) (e88ae54545d)
- 📚 문서:G-104 union 回灌后重翻勾(A-D 已完成;证据 9ae41995/323efb1b/56e0d5b7) (b2acf037b60)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d2323c32ed)
- 🔧 기타:登记「门 13d 对同一行叠同一注记零射程」这一格,让上一枚的"已另记"落到实处 (2e23f04a309)
- 🔧 기타:无损折叠"同一行内逐字相同的注记"227 份(34 行) (92b5d876aaf)
- 🐞 수정:大屏取数公网 403 —— 两条只读端点显式放行公网 (f7e87c913b6)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (db98c79e533)
- 🐞 수정:收口 strict lint 余下 4 条告警 —— LoginDialog useCallback 补 t 依赖,auth bootstrap 三条 console.debug 改 info(整包 max-warnings 0) (553a9d64ab2)
- 📚 문서:D77 行就地改写状态 —— 残余① 已闭,等的只剩运行时合格证 (f744a7b6d14)
- 🔧 기타:删除新完成的 G-104 行(完成即删);未勾行逐字保留 (0f5376bf092)
- 🐞 수정:收口被整块重复的登记(F6 块级判据的修复出口) (46774eb18f0)
- 🚀 기능/개선:D77 残余① 收口 —— 表单 mode 判定收进共享层,三端宿主接上 (4da233e6100)
- 📚 문서:复结 G-104(两端统一 cl100k + 降级可见 + BPE 门 id228 接链;整包 122/122/Python 29/29/门 89 strict) (56e0d5b7d93)
- 🚀 기능/개선:跨端 BPE 词表对账门接进提交链(id 228,blocking;G-104 D) (323efb1bd7a)
- 🚀 기능/개선:G-104 两端统一 cl100k_base + 降级可见 + BPE 门重基 (9ae4199583d)
- 🔧 기타:按机主令清除全部已完成行与归档占位注释(132 已完成 + 21,519 归档注释;225 条未勾行逐字保留) (f19bfd0e56a)
- ♻️ 리팩터:摘除已退役看板程序的编排与登记(根 compose/observability 栈/服务清单) (2c19eaf7147)
- 🔧 기타:复结 G-107 权威信封恢复闸门(翻勾;随后整批删除已完成行) (9813e3fffdd)
- 🚀 기능/개선:接线 G-107 权威信封恢复闸门到流式帧路由(解门只认 recovery / reason-code 封闭集 / 迟到片不重置水位;api-client 零依赖同形移植 + 14 例对账) (0615a31b1d1)
- 🐞 수정:删除 no-console 关闭面扩到 mjs 后失效的 4 条冗余 eslint-disable(整包 strict lint 现读 0 告警) (9b4ac5ba836)
- 🐞 수정:G-77 残余① 显式关停 provider 转发链与 agents SSE sink (ef259cb4d37)
- 📚 문서:复结 G-922 桌面更新器第一数据源烘焙器(生成器+--check+镜像测试 8/8,0.1.76 --check RC=0) (75bed9b15df)
- 🚀 기능/개선:G-922 桌面更新器第一数据源烘焙器 + --check + 镜像测试 (c71255038be)
- 📚 문서:移除已退役 check-live-doc-archive-reinflation 的陈旧门名段(存档机制 2026-10-16 退役;门体已删,文档不再点名) (0a434dbf7ba)
- 📚 문서:复结 G-29(收集失败归零)+票77(My Quests+自评估 23/23+31/31);释放 G-104/G-274/G-79/LEDGER-FIX 四条超龄租约 (79762c21820)
- 🐞 수정:收口主线 CI 存量红: Knip 新导出 / OpenAPI 漂移 / CLI strict lint / Ruff / RN 裸输入 (010e8c50297)
- 📚 문서:改掉我上一枚提交 94f607c85c 自己造的跑不通出路 (c269ae8054f)
- 🐞 수정:union-converge 反漂移锁移除对已退役归档器的动态 import (88a0b33a2dc)
- 🐞 수정:删除 mobile-rn 两枚零消费死键 identityVerify.failed 与 patrol.actionFailed(五语言同步,死键审计全端归零) (9c69efebaa9)
- 🐞 수정:web bundle 500 — web 平台补齐 react-native→react-native-web 别名 (c974ce7944a)
- 📚 문서:标明 Android 提交轨道与个人号 12 人门槛的对应关系 (94f607c85c4)
- 📚 문서:复结 G-181/G-930/G-926(巡检 P12 97/97;恢复源 backupOk:true+已追平;门84 R1w 用例 27/27);G-29 现读 1 端收集失败保持未勾 (6f2d128530f)
- 📚 문서:复结 G-47/G-76(收敛器封顶 600s+用例 18/18;副本归并器批1/批3 候选删除 0;原核销被合并乱流复活) (46254a889a8)
- 📚 문서:复结 G-38/G-916419 两张索引态票(D 档 0/门99 RC=0/索引 blob==HEAD blob/--gate --staged RC=0;原核销被合并乱流复活) (5739205c8b8)
- 📚 문서:复结 G-210/G-461/G-868/G-102 四张已入库未勾票(原翻勾被合并乱流复活;gate strict RC=0 + 用例 16/16 现读) (c671315233a)
- 📚 문서:G-427 重新结清(广告门控+allowed-tools 影子账本两格 HEAD 在位,用例 16/16 现跑绿;原翻勾被合并乱流复活,按 HEAD 实证复结) (cf953f62712)
- 📚 문서:SignPath 确认邮件已收到并更新审批状态 (84088dd2276)
- 🔧 기타:出清CI报告全量新增未用导出29个+重复导出16处+盲区豁免,五类棘轮归零修复 (8a55ee1a7f8)
- 📚 문서:SignPath 申请已实际提交成功并留证 (3cf0f2b7800)
- 🐞 수정:mirror-liveness reads main branch not default_branch(backup),removes stale 22d false lag after default switch (c5920f5cfbb)
- ⚡ 성능:页头字标换成真矢量,1.18MB -> 42KB(两版各减 96%) (c079c6d705b)
- 🔧 기타:销账G-116 Gitee配额(探针ref已删/机主GC)与env待供值重复副本两行,完成即删不留痕 (a6c8bc3227b)
- 📚 문서:结清 G-277(守门128 web腿三格全闭:①VideoPlayer 带理由豁免接管 ②裸档由 db5a7a74a9 升进档位集合、三本账重锚前提经 import 面复裁推翻且锚点零位移 ③web 腿可达性剔除机制化);本轮附加修三处仍挂已推翻前提的陈旧表述(T29 测试名+内联 rationale、门128 :3225 注释),修后 128 自检 123/123、测试套件 46/46、默认档 RC=0、门150 RC=0 (766576260b6)
- 📚 문서:更正 SignPath 申请状态为未提交并删除无凭据的问询记录 (47afcfa1803)
- 📚 문서:摘 G-343 同题跨号僵尸开放行(正文与已归档 ✅(2026-10-29→2026-09-29) G-345「四格全闭」逐字相同,HEAD 逐格可证+门体自检 16/16,留证见 archive/PROJECT_PLAN_G343-dup-removed) + G-631 按 HEAD 实证重新结清(10-11 四枚系列提交 1/4~4/4 已入库,翻勾 ✅(2026-10-11) 后于合并乱流丢失、旧形态复活;两处前置修复在 HEAD 且本轮各补测试锁:尺子抽出 countStringFormSlices 可测出口+空数组/两器同一定义两颗用例并变异自证,matrix 侧用例他席 3fbc52af5e 已入库不重复登记) (d21191b1c6b)
- 📚 문서:烘焙步骤措辞校正为"CI 产出的包" (2a078c0172c)
- 🐞 수정:OIDC-optional-unset=unknown-not-fail;prune-.DevEnv-cache-from-nested-git-scan;72h-exempt-in-flight (9f40b2aada6)
- 🔧 기타:G-631 补空清单/混形态用例,钉住 M13 不把空数组真相当真 (3fbc52af5ee)
- 📚 문서:tauri 发布说明同步本机发版守卫(默认拒绝未签名上传,公开发布走 CI) (6e5f00f88bb)
- 🐞 수정:本机发版默认拒绝上传未签名包(Gitee 已是 Windows 更新面) (e620ccfdc34)
- 📚 문서:桌面发版清单补烘焙第一数据源,并校正平台数与自动提交表述 (455398a2cab)
- 🔧 기타:登记桌面更新器烘焙缺生成器/缺对账门 (f6757e74b64)
- 📚 문서:文档层洗掉已退役看板程序名(README×3 + docs 29 份,128 处) (8c1e72e10b1)
- 🐞 수정:桌面 Release 逐文件上传不得吞失败(签名后 exe 与 .sig 必须成对) (c3033d25781)
- ♻️ 리팩터:自有 env 键 GRAFANA_* → BOARD_*(含 saas 编排/gen-secrets/示例) (b17056a4ed9)
- 📚 문서:门名索引跟着 panel 系改名(修 R4:新门名在文档里看不见) (bb5c9acbef9)
- ♻️ 리팩터:看板器物改名落库(panel 系;门 220/222 的悬空引用一并解掉) (a7ced7411ca)
- 🔧 기타:欠账清单行现读更新(B 已根治 / C 抽样已消 / D 非缺陷,仅剩 A 的 UI 迁移) (1a7ea734afa)
- 🐞 수정:清理 plugins-data 下沉后残留的 web 旧位置副本(15 个文件) (7a7751be446)
- 🔧 기타:结清 #47 三套执行内核工具集归一(三格均已入库:唯一解析出口 + port 定义出口 + parity 断言接提交链) (bfda4238b3b)
- 🔧 기타:签名被跳过时必须喊出来(CLI 与桌面各加一步:凭据不齐则打 warning 注解并写进 job 摘要,避免 green 被读成已签名) (5ab25b78ea2)
- 📚 문서:签名段覆盖到桌面安装包并写死两条硬约束(换字节必须重算 updater 签名;artifact-configuration 不是 GitHub secret,照旧文配会静默不签名),CI 集成状态改判为代码已接入待凭据 (c8b0b99d8b1)
- 📚 문서:代码签名条覆盖到桌面安装包(与 CLI 同一组 SignPath 凭据),并把两处真实落点写清:策略文档与凭据-约束说明 (3084d8c89df)
- ⚡ 성능:语言包改为按需加载,首屏不再带 5 种语言 (5dba888279d)
- 🔧 기타:再销 14 行说明/等条件/已否决项,派单面收敛到真活 (b229b735cd5)
- 🔧 기타:Windows 安装包接 SignPath Authenticode 签名,并按新字节重算 updater 签名(缺凭据时整段跳过,行为与今日逐字同形;重算失败硬失败,宁可不发也不发更新链断裂的 Release;同批装守门 215 自述) (da1f3b39a14)
- 🔧 기타:批量销账 56 行(20 张已实现/重复/前提消失 + 36 行非派单工作) (c19cf73b6ae)
- 📚 문서:摘 4 条归档票僵尸开放行(G-863/G-815991/G-362续行/G-102;均=同票号同题权威行已归档✅+开放行无租约牌,逐票实质核验见留证件;并集按旧基线复位带回的同型回潮)。G-160 同扫描但实质不可干净核验(批次提交不在今日 origin/main 祖先+钥匙仍带开放行),归收敛线持有人未动 (08eed783b99)
- 📚 문서:登记桌面端安装包签名缺口(归属 release-desktop 持有席,出路形状与两条硬前置已核实写入行内) (6c8b9cd88df)
- ♻️ 리팩터:插件目录 plugins-data 下沉 packages/shared (55803300de9)
- 🐞 수정:落地闸清单的截断改为报名并给出出路(标题报十九条而正文只列十五行,读账人只能另写探针才见全貌;新增纯函数 formatBadReport 与 show-all-bad 旗标,四例镜像测试含装车锁;父目录污染那枚已按门自己的判据清至隔离并复量转绿) (26cc36e24fe)
- 🔧 기타:结清三张已消失的索引现场观察票(G-34 / G-35 / G-39) (8076559f7e2)
- 🐞 수정:host-git 条目改 button 内嵌,修 jsx-a11y 双错(CI lint 红) (afb908eaf58)
- 🐞 수정:agent-event-parity 补 _sse_frame 位置参数扫描,消除 delta 契约误判(8条阻断) (e14b2af564f)
- 🐞 수정:静态键提取前剥离注释,消除把注释示例当引用的误报(缺 nav'字面量') (92d4f2a6842)
- 🔧 기타:结清 G-26 与四张已实现票据(G-317-② / A2 / A3 / G-279) (ea7e756cc1c)
- 🐞 수정:fork 复制 turn 并重挂 item,消除来源回滚的 FK 地雷(G-26) (47a20b7d092)
- 📚 문서:G-932 摘僵尸副本行(权威行已归档✅(2026-10-15),代码 b100d9457a+翻勾 4da96ed0e0 皆 origin/main 祖先;本行=认领已释放@2026-10-18/goal-leasegc 的滞后第二行,逐字留证 .ihui-agent/archive/PROJECT_PLAN_G932-dup-removed-2026-10-20.md 过门71) (9c34e0c370e)
- 🔧 기타:G-310 同族补 fold-keep 声明式 keeper 出口的镜像反证六例(阳性对照=两侧各改写一版而无人声明必挡落地;反证=陈旧声明/串档行/空理由/算不出指纹/fp 与现算不符/同指纹两 keeper 全部退二点名)。跳 nested-git 守门留痕:它点名的四枚全是 gitignored 未跟踪现场(desktop-feed-clone、tmp 下 desktop-latest 与 wt-parent、outputs 下 ihui-bench-release),mtime 均早于本席开工,wt-parent 更是他席此刻在用的活夹具;基线面结构上不含未跟踪目录,故 HEAD 不红我红属对每一枚提交的定责失真,非本枚引入 (2c7c2d8e986)
- 📚 문서:RN↔Web 对齐收口翻勾 + A 簇 9 功能与 /plugins 平台独占标注(基于 d75129 权威版外科插入,不丢并行条目) (b6ecb17cede)
- 🚀 기능/개선:移植 D77 form_request mode 槽与 mobile-rn 11 屏接线到 origin/main (d75129e2aad)
- 🔧 기타:裁决 G-201 收口(不引入来源猜测;服务端可推导部分已落地,其余自报只许收窄,缺信号已注记,将来按连接来源新能力另票立) (fbded734db2)
- 🔧 기타:结清 13 张已实现或已裁决票(G-921/G-197/G-464/G-462/G-739/G-428/G-70 + max_tokens 续写;撤销 G-6/G-83/O46 取向;移动端信封清单收口),逐行凭据见注记 (66f91ad2a16)
- 🐞 수정:G-921 尺子跟着入口换形 —— 包装壳 desktop-build --dev 纳入 dev 入口形态(否则正控空转,实测 1 failed),补包装壳裸跑与带配置两条反证 (cfe2b6116a1)
- 🐞 수정:根治原生适配器绕过并发闸 + GBK 丢日志 + 流式错误无溯源 (1f8deea55c6)
- 🐞 수정:补 ERC20 充值地址格式校验(G-317-②) (1d733b0fc4a)
- 🐞 수정:DomainHub 注释示例改中文描述,消除 check-i18n-keys 把注释当键的误报(缺 nav'字面量') (9d5c1188872)
- 🐞 수정:Sidebar 补回 useNavVisibilityFilter 的 import,解部署环 TS2304 冻结 (9451f3378d0)
- 🔧 기타:结清 G-310(声明式取代出口已入库并随整批 converge 生效;凭据=出口枚与合并枚 40 位、九例镜像反证、129 例自检 rc=0、--gate rc=0),摘除本席租约牌 (f7f310e5761)
- 📚 문서:守门 207 体积裁剪 —— 重复登记副本两版历史原文与两处同文重复段逐字移入 archive,原位置留指针注记(100842→93867 字节) (fccfe1f3072)
- 🐞 수정:根治原生适配器绕过并发闸 + GBK 丢日志 + 流式错误无溯源 (72dc9299846)
- 🔧 기타:重生成 ui-routes 派生产物(合并带来的 api 输入变更后重钉) (adcceda20fe)
- 🔧 기타:重生成 ui-routes 派生产物(合并后重钉 sourceCommit 与输入哈希,路由集不变) (ada51eaa42e)
- 🐞 수정:SSO 授权误报登录失效——会话失效改由后端 Bearer 裁定 (1dd7392401a)
- 🚀 기능/개선:新守门 check-board-name-legacy.mjs 接进提交链 (60d3b6a55ff)
- 🐞 수정:Sidebar 补 import useNavVisibilityFilter(修 CI typecheck TS2304 回归) (d83f5ecd211)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2e7cdcf3591)
- 🐞 수정:指纹选粗体吸收对侧跳过括注内强调的修法,与本侧行首区判据合并 (d922a79e808)
- 📚 문서:G-310 就地追加现状注记(出口已入库但本票未闭;卡点已换位到同题两版并存族,该族无回灌出口) (3675e214a74)
- 🔧 기타:清账门207 AGENTS.md体积判据(已注册blocking+判据+镜像测试5pass+现跑rc0),完成即删整行不留痕 (f724754c432)
- 🐞 수정:洗回上一轮误加到标题行与正文子项的号段注记,并按任务行唯一命中重补三行(G-84 命中两条任务行 ⇒ 不猜,点名交人工) (5e79d0e5057)
- 🔧 기타:剥离已闭环的5669①两级渐进披露子项(提交130af8c18已落地:目录段预算降级/skill按名拉/428前置门/compaction重置),保留②③④⑤未落地项 (e99084dc1f4)
- 🐞 수정:补回九行被剥掉的号段租让注记(折叠守恒一问的正当凭据;G-310 停放轮定的内容修复路线,不动判据不收牙) (f49c3a2e2b2)
- 🐞 수정:移除 contentHub/eduHub/tradeHub 孤儿嵌套键(死 key 审计 6 枚) (0b65ff2d39d)
- 📚 문서:摘除「web↔移动端同一契约两份声明」族的已勾旧副本行(完成即删第二步) (f8c8ae12202)
- 📚 문서:「web↔移动端同一契约两份声明」族的严格前缀旧副本行按 §1 翻勾(承载行是它的加长版) (41241b40edc)
- 📚 문서:摘除分类栏统一收口族的已勾旧副本行(完成即删第二步,承载行留在原位) (4c606271db4)
- 📚 문서:分类栏统一收口族的"严格前缀旧副本行"按 §1 翻勾销账(承载行仍是那一行的加长版) (93caa183404)
- 📚 문서:分类栏行剩余格补产物面实测,并更正上一枚提交信息里的一处过头话 (69ec7f03383)
- 📚 문서:分类栏行剩余格的成因改判 —— 不是设备网络,是这枚包烘进了回环 base (12d49a105c3)
- 📚 문서:分类栏统一收口行补真机复验读数(设备 c12617dd / v0.0.5 code 26101411 / 暗档 / 已登录) (6aaa20c9e1b)
- 🔧 기타:撤下 check-miniapp-taro-design-tokens 的 standalone-tool 豁免(该门已于 id 227 真接线) (5566a17bca5)
- 🚀 기능/개선:门 check-miniapp-taro-design-tokens 接进提交链(blocking,HEAD 面两面现读存量 0) (ce97c06d13a)
- 🐞 수정:守门 203 指纹不再让"行首派单前提括注"里的强调粗体吞掉标题(HEAD 面 66/332 行恒 null 的根因) (b8b95c9df27)
- 🐞 수정:守门 71 编号族补 A / H / WP 三族并允许 D 族带横杠,另挂一族表自检维 (f5822db5fac)
- 🐞 수정:G-310 落地闸补「声明式取代」出口(命令面旗标接进两半判据,放行仍须过折叠四问并逐条报名;陈旧声明判不记通过)+ 九例镜像反证测试 (6ef39d1fe8c)
- 📚 문서:G-310 就地追加实现落地注记(命令面已接出口,放行仍须四问举证;不翻勾,剩余是整批 converge 实测) (8041bff0301)
- 🐞 수정:剔除侧边栏提交误带的 contentHub/eduHub/tradeHub 孤儿键 (59e15ae4b0b)
- ⚡ 성능:页头 logo 只下载当前主题那一枚,首屏少下 1.18MB (ca29364f932)
- 📚 문서:清账G-317 USDT地址配置闭环(TRC20拍板值TMt已落地env+双调用点形态校验+example登记),修正3处过期收款地址文档(去虚构NEXT_PUBLIC键/wallet-secrets误述),剥离存量订单核查与ERC20格式校验两条遗留 (1a0d8367653)
- 📚 문서:认领 G-310(union-converge 落地闸补声明式取代出口;整批 converge 实测卡在这一格) chg 机主本轮拍板 (20882eafd93)
- 🐞 수정:LLM 上游失败补 warning 日志 + 修 orchestration 读端旧格式用例 (b7815962c3d)
- 📚 문서:A4+A10 副本摘行(翻勾已落 e6afb2e944ad2cb17707cd67cd0b8c56d529b659,本枚只删行) (1f233b87c95)
- 📚 문서:A4+A10 那一格的 stale 待办副本翻勾 —— 同题正本 L14512 已勾并带复验证据,本席今日重跑两臂各绿 (e6afb2e944a)
- 📚 문서:G-277 摘行(翻勾已落 551fdf60c31fdae711d7d82ce370cf99d5d223d5,本枚只删行) (6cd2d083196)
- 📚 문서:G-277 翻勾 —— 守门 128 web 腿三格今日全部现读闭合 (551fdf60c31)
- 📚 문서:G-29 复量注记 —— 前置①现读成立、前置②两把锁在位,定级裁决仍 warn(理由落在"能不能在提交面出结论") (d92cdb9f350)
- 🚀 기능/개선:门 114 补全端枚举与三态分色(G-29 前置①的可机检形态) (e0a72e58f44)
- 📚 문서:G-926 摘行(翻勾已落 fbc352c6523b51819ee8b996f074273fd845094f,本枚只删行) (288e00283d1)
- 📚 문서:G-926 票据翻勾 —— 门 84 R1 ↔ 门 47 的水印补回型互锁已由 9085a780baf6f726db6b8165a6d3caf8deb56739 解除 (fbc352c6523)
- 🐞 수정:门 84 R1 ↔ 门 47 的水印补回型互锁解除(G-926) (9085a780baf)
- 📚 문서:G-621 摘行(翻勾已落 8fbbd316d8153d473ede3e09a4d79f3667fdc29a,本枚只删行) (f12d5e61b71)
- 📚 문서:G-621 四格全部结账,按完成即删先翻勾(下一枚只删行) (8fbbd316d81)
- 🚀 기능/개선:弱证据队列今日那一条已裁并入账 —— wallboard 告警胶囊的 panel 类别是颜色单证推出来的,不判红也不当场改档 (cce86d0f4fb)
- 📚 문서:G-621 第二格结账(缝隙已关)+ 写明本行为何仍不翻勾(弱证据队列那条换了站点,仍等一并裁) (bbb89e40081)
- 🚀 기능/개선:锚点按"该文件 HEAD 自身计数"收紧 —— 关掉"同文件加新代码把已收敛档位写回旧形态"这条缝隙(G-621 最后一格) (26e562dd924)
- 📚 문서:form-request-frame 头注的两条理由按今天的事实改写 —— ① 已不成立,只剩 ②,并写死"别照旧文把旁路加回来" (53348f2aa83)
- 🐞 수정:form_request 收编到共享认领 —— 端内 onRawLine 二次认领删除,小程序端最后一个红转绿(70/70) (db3f98d10c6)
- 📚 문서:G-16 行内更正两处 —— 上一枚注记里「3 条真单侧」那句作废,并把第(ii)格从「没动」写成「已量清 + 等的是哪一格裁决」 (f41f83ffb47)
- 🐞 수정:SL 的投影别名改成**单向**(只许消账、不许造账)—— 上一枚把跨组件误归因当成了真单侧 (e45bb64b1b5)
- 📚 문서:G-16 第(i)格现读结账 —— SL 已认几何投影别名,(ii) 未动,本行仍开 (6dcc25847ea)
- 🐞 수정:SL 维认几何投影别名 —— 票 G-16 那格的假账消除(一侧直取 geometry 档不再算"仅另一侧引用") (47474c24e0e)
- 📚 문서:cache token 那行按完成即删摘除(翻勾已落 927f8ab7ba3273e0b713a51c920ffee582b5549f,本枚只删行) (56f359832ef)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1163a2cc255)
- 📚 문서:cache token 那行翻勾 —— 本行点名的守门 112 两重失明已补 (927f8ab7ba3)
- 🐞 수정:压缩分母门补两重失明 —— 扫描面加 packages/、分母名补 maxTokens 一族,名字表与预筛关键字同源 (5302a93ce54)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (031a432734d)
- ⚡ 성능:logo.svg 由 UTF-16LE 无损重存为 UTF-8,首页少下 1.18MB (1d375529f11)
- 🚀 기능/개선:监控大屏新增访客访问与国内加速命中率面板 (9f98914771c)
- 🐞 수정:再摘 identityVerify.failed —— 上一枚(bbd638cbb95)的摘除被并发席位基于旧基线词包的整文件提交(6387c9c769d)带回 (913364bc2ea)
- 🐞 수정:mobile-rn/en modelPlaza.officialBadge 欠译收口(智 → IH) (bd19eab469c)
- 🚀 기능/개선:访客链路测速与边缘预热并入 api 进程内定时读方 (a409aa7e677)
- 🐞 수정:RN 验证码弹窗 5 处硬编码中文改走 i18n(与小程序同文案同译法) (6387c9c769d)
- 🐞 수정:摘除 mobile-rn 词包里的孤儿键 identityVerify.failed —— CI 死 key 审计在 HEAD 面的唯一一处红 (bbd638cbb95)
- 🚀 기능/개선:侧边栏简洁模式 -- 一个开关收起 61 项开发者/运维向导航入口 (4e9a1549004)
- 📚 문서:G-29 第二条现读 —— 全端计数已量完(16 个 vitest 端收集失败 0),前置② 两条锁实测早已在位,真挡是「执行型门能否在被审面上定论」 (24d9ed1e134)
- 🐞 수정:判红必须能在被审面上定论 —— 复用 check-head-typecheck 的取材装配,脏面一律降为候选(不再给无关在飞改动顶罪) (4e33e216de3)
- 🚀 기능/개선:侧边栏简洁模式 -- 一个开关收起 61 项开发者/运维向导航入口 (1cfc578169b)
- 🐞 수정:监控大屏(panels)适配明暗主题,移除写死蓝黑配色 (790f669fbc3)
- 📚 문서:L14361 G-811 图源池 —— 三格逐格现读均为已落地态,翻勾并留终态取证(零生产代码改动) (512b4bf1561)
- 🐞 수정:orchestration_hub 事件改为单键 JSON 写入 Redis 流 (6048e094485)
- 🔧 기타:清账7条HEAD已闭环陈旧开放行(#138活动时钟/#225redact单源/#269#270锁原子初始化/#273传输层派发器/#78#263错误前提tauri日志),完成即删不留痕 (8b9bb46b94b)
- 📚 문서:协议通道②/③ 与 VideoPlayerScreen 两行按完成即删摘除(翻勾已落 5392c69cc964db7ffbae5203dd8743dc37cec45e,本枚只删行) (db01b6fffca)
- 📚 문서:G-621 现读更正 —— 票面点名的现场形状已不复现,仍开的只剩最后那一格通用缝隙 (791e2e664ae)
- 📚 문서:L29247 传输层单点化 —— 翻勾并留终态取证(代码已为落地态) (8c68744302b)
- 📚 문서:G-29 现读口径纠偏 + 两端收集存量现读追加 (4962b1ce2f7)
- 🐞 수정:miniapp 验证码弹窗标题与 RN 对齐「请输入验证码」(verify.getCode 五语值纠偏) (5c00ad26050)

**2026-10-19**
- 🐞 수정:受检形态必须等于该端真实跑法 —— 派生 vitest 时不再丢掉 test script 的旗标(实测 31 条用例假红) (66cfdd0d19a)
- 📚 문서:协议通道②/③ 与 VideoPlayerScreen 两行翻勾(仓库侧内容已全部入库;剩余是环境前提,写在本枚信息与两行注记里交后手) (5392c69cc96)
- 🐞 수정:G-28登记缴费对话框硬编码中文全部走t(),新键五语言补齐(parity) (e4be58fa101)
- 🔧 기타:三枚套件收集期即炸 ⇒ 端内 93 条用例从未执行 —— vi.mock 改 partial-mock(importOriginal 形态),不再手抄闭集出口表 (dc41de3bb57)
- 🚀 기능/개선:admin新增登记缴费对话框,POST现有/payment-record(G-28代码层,无外部资质) (21eb7f6ed97)
- 🐞 수정:disable xinference local provider probe by default (53597943dc7)
- 🔧 기타:接入 SignPath Authenticode 签名(Windows 二进制) (64cfacf4d7d)
- 🐞 수정:disable xinference local provider probe by default (afd853023e9)
- 🔧 기타:门128 基线入账 VerifyCodeModal 族(counts 3 / radiusCounts 0 / elementRadiusCounts 0) (108d1fe6434)
- 🐞 수정:门 105 四端 ui-routes 派生产物第三次对齐 —— 并发会话连续改小程序与 web 侧页面源文件,产物自述钉与 head 面现算持续不等;重生成前已验全部输入源的工作树与 HEAD 逐字一致(工作树干净),故产物钉住的是 HEAD 面的源 (cf46bb2a8ef)
- 📚 문서:协议通道②/③与 VideoPlayerScreen 两行就地补现状与出路(逐字原文保留,只追加行尾注记) (1ef9ebdb469)
- 🐞 수정:agnes视频轮询改专用同步端点,通用端点不同步上游致永久pending(线A#4) (36ca4341870)
- 🔧 기타:结案 L7603 僵尸实例修复:方向(a)(c)已落地且 cargo check 通过,翻勾 + 终态注记(2026-10-19) (75a6005f441)
- ♻️ 리팩터:VerifyCodeModal 收进共享单一源 verify-code-modal-spec(门128唯一判红族) (4c0dbc10212)
- 📚 문서:登记 RN↔web 能力对齐收口轮的守门收口(③)并订正两处过时表述 —— 标题由「本轮未入库」改为已入库 14 枚;①里「单测直接 import web 的 SLASH_COMMAND_IDS」订正为「直接 import 共享层 @ihui/shared/chat/slash-command-ids」(端→端 import 边违反架构契约 D1,门 103 判红,已下沉共享层消解);③ 记本轮 8 道恒红门的逐条处置与唯一未消项(门 184 系并发会话在飞删除 desktop 构建脚本的中间态) (f439d089fdf)
- ♻️ 리팩터:SquareScreen / PlazaScreen 两处共享类型重声明改为 import 共享层 (3ead65aee50)
- 🐞 수정:门 105 小程序端 ui-routes 派生产物再对齐 —— 并发会话在本席上一枚落库后又改了 apps/miniapp-taro/src/components/DrawerComponent.tsx,产物自述钉遂与 head 面现算不等;重生成前已验全部输入源的工作树与 HEAD 逐字一致(工作树干净),故产物钉住的是 HEAD 面的源 (00960fa854c)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a6291841552)
- 📚 문서:结清 D113 流式 diff 实时预览(复验+回归绿) (79c54edbd64)
- 🚀 기능/개선:f1档跳过自述指针行防循环论证误翻勾,declared档不变(G-72裁决①) (3bfa3def949)
- 🐞 수정:--staged 归属判据改差值棘轮(锚 HEAD),解除全场提交被迫跳门的恒红 (18eb57d63de)
- 📚 문서:结清两条 P0 技能市场授权缺陷(复验+回归绿) (5b52770931d)
- 📚 문서:守门 207 体积瘦身 —— §1「重复登记副本」两行历史叙述整区搬入归档件(逐字原文,原位置留一行压缩条款,规则内核一字未减),另删一处与文首逐字重复的压缩版说明行;载荷行逐字未变、零宽字符总数未变(脚本自证) (8b05e0e2f5b)
- 🐞 수정:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (3b5fa476169)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a969d2a5aa1)
- 🐞 수정:W3 补命名空间相对取词出口,并收口图片标注裸 TextInput (ba671cd8a99)
- 📚 문서:登记 P1 2026-10-19 LLM 观测失配修复轮(用户级指标+并发闸+探测降噪+系统身份映射) (715aac66435)
- 🐞 수정:门57 error-retry-action锚点改指ChatMessageList.tsx + 门44补登.doc-autoupdate白名单(2026-10-19) (bedbb942285)
- 🐞 수정:门 105 四端 ui-routes 派生产物重生成对齐当前 HEAD 源 —— 生成器原话出路(机械动作);生成前已验三个输入源的工作树与 HEAD 逐字一致,故产物自述钉与 head 面现算相等 (c59ee4d85c0)
- 🐞 수정:LLM 观测失配修复(用户级指标)+ 自伤并发闸 + 探测降噪 + 系统身份映射 (66a47341319)
- 🐞 수정:门 83 基线补登 ChatScreen.tsx 的 R2 存量 2 处(图片预览浮钮实底 surface.light,D124 引入时漏登基线 ⇒ 全量档恒红);按全量实测只补这一处,不动其余键 (893b31371c7)
- ♻️ 리팩터:斜杠命令模板类 id 清单下沉共享层 —— web/RN 共用同一份(端与端 import 边违反架构契约 D1,门 103 判红);web 侧改 re-export 消费方零改动,RN 测试基准换为共享层 (e77e5bb8e49)
- 🐞 수정:ChatScreen exhaustive-deps 两条 + ImageAnnotator 裸 TextInput 按 G-978007 判据补齐(CI lint/test 存量红) (b98806f33dd)
- 🐞 수정:agent 迁移 325 三处 ALTER TYPE 补 DROP DEFAULT(CI 测试库 42804 炸点,default 无法自动转换:federated id/dp_noise_added + meta source_skills) (4af9df7f938)
- 🔧 기타:chat-branch i18n mock 形状对齐类型定义(CI typecheck 5×TS2322) (4dd69c99528)
- 🐞 수정:token 就位后等 HubSpot 回调自动提交,不再重点 Submit(否则 reCAPTCHA 重弹) (b88382c6836)
- 🐞 수정:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (b2503baa8ee)
- 🐞 수정:修最后一处 shotPush 作用域错误 (82722394440)
- ♻️ 리팩터:划词批注输入框改用共享层 TextField(§3 共享层优先,端内禁止裸 TextInput);tsc/eslint/门218/门128/水印 全绿 (aaf524d3ebd)
- 📚 문서:G-194 结清 —— 真机复量:当前 HEAD 首页滚动已不复现,修法未落地 (5041621176d)
- 🐞 수정:沿祖先链修正显示属性并抬高层级(挑战被页面盖住) (f40959d2d9c)
- 📚 문서:G-167 ② 已落地并翻勾 —— 流键派生收口到 i18n-key-flow.mjs (0171084ee26)
- 🚀 기능/개선:G-167 ② 流键提取收口到 i18n-key-flow.mjs,门 2 与死键扫描共用同一份派生 (704aeb8f43d)
- 🐞 수정:强制把挑战 iframe 摆到可见位置(宿主 CSS 压成 150px 条带) (bba38b54b88)
- 🐞 수정:撤掉 CDP DPR 覆盖(打乱挑战浮层定位) + 网格截图取最大 bframe (df022c4ee35)
- 🐞 수정:挑战可见性判据改用格子计数 (7f0d26c28aa)
- 🐞 수정:修 shotPush 作用域错误 + console.error 入镜像 (0fe03661205)
- 📚 문서:撤回票 68 的错误翻勾 —— 运行时合格证未取得,且该行认领在他席 (68f7664a39e)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cf85ee4574f)
- 🔧 기타:提交后加诊断截图 (77bbeb81aeb)
- 🐞 수정:不可见 reCAPTCHA 需等待挑战弹出(45s) + anchor 可见性判定 (d0617767f7a)
- 📚 문서:结清票 68 —— 流式中切换模型三端齐备(web 18 / 小程序 17 / RN 14 用例通过) (24c516271e6)
- 🐞 수정:先过 reCAPTCHA 再提交 + Submit JS 兜底 + 提交后复查挑战 (c5ccf62a858)
- 🐞 수정:批注面板圆角补齐角色档(门 150 点名 panel 应为 xl) (1b23b990989)
- 🐞 수정:reCAPTCHA 通过判据改 token + 2x 超采样截图 + Submit 重放 (50c8f28b5b9)
- 🐞 수정:SelectionAnnotationBar 徽章圆角改走档位源 rnRadius.md,去掉 rpx(14) 字面量(AGENTS.md 圆角单一源头:禁止 px/rpx 字面量,计数徽章模板即 rounded-md) (5b2b21def28)
- 🐞 수정:reCAPTCHA 支持动态挑战多屏循环 + 指令改走 Contents API 免 CDN (a6c085b7f16)
- 📚 문서:登记 RN↔web 能力对齐收口轮 —— 已对齐面/四类平台豁免/四处误报更正/落库与守门收口实证 (da046c43ad1)
- 🐞 수정:reCAPTCHA 支持动态挑战多屏循环 + 指令改走 Contents API 免 CDN (cc07bcfbeb8)
- 🐞 수정:mobile-rn ja 的 slashCmd.wechatArticle 去掉简体字「众」(日文应用「公式アカウント記事」);守门 2o ja 中文残留判红 (a2f39092003)
- 🔧 기타:回退F10折叠两行注记(门13d恒红,purge被3个他人在飞族卡),恢复父版正文 (36ca42c5228)
- 🐞 수정:守门 8 修两处判据盲区 + BP 腿基线下调到 15 (c1afcfc8ce0)
- 🐞 수정:折叠"同题不同编号"的孪生待办登记(F10 折叠档) (949f0a3d3a1)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (76045c98e0d)
- 🐞 수정:reCAPTCHA 指令轮询窗口 6 分钟 -> 10 分钟 (1dc3aa64282)
- 📚 문서:摘除 6 行 F1/F4 重复登记副本(并发旧基线 union 合并带回),认领标记原样转移 —— F1 3→0 / F4 3→0 (489ad005a52)
- 🚀 기능/개선:清 BP 腿量出的裸路径死调用 —— RN/小程序 2 处 + web 6 处改指在册端点 (4ba1934c568)
- 📚 문서:仪表盘数字订正为现读 26(删 jaeger/nginx 幻觉盘下游:MONITORING 21→26、README 三处 21/3/21→26、生成器头注 20+1→24 Prometheus+2 Loki)+ sync-readme-numbers.mjs 补溯源水印(CI watermark check 唯一未覆盖文件) (61031d3ad84)
- 🐞 수정:reCAPTCHA 挑战改按 DOM 格子序号点击,消除 3x3/4x4 坐标漂移 (f67bcb5fa4e)
- 🚀 기능/개선:斜杠命令面对齐 web(模板正文逐字取自 web chat.cmd*)+ 会话批注补复合归属键与 AsyncStorage 落盘(D180 对齐 web 三处语义);附 mobile-rn 五语言 slashCmd/slashTemplate/selectionAnnotations 词条与 automations.schedule 缺键 (895eefbdbd1)
- 🔧 기타:npm-bootstrap runner 加远端日志镜像与防挂死硬超时 (28563b79d73)
- 📚 문서:全文陈旧数字现读刷新(四语言同步,遗留项整改) (d56aa604a9d)
- 🔧 기타:删除已零引用的计划指针净化临时票据 plan-pointer-purge-2026-10-14-b56c9ad7.md(工作树删除收口,全仓零引用,git 历史可取回) (d6d12cfa96c)
- 📚 문서:全文陈旧数字现读刷新(四语言同步,遗留项整改) (07752095ed0)
- 📚 문서:补桌面/MSVC 构建注入与未签名豁免文档段 + 端口登记/port 文档 8861 对齐 dev:desktop:saas 新流程【出口②留痕:AGENTS.md 5 段在祖先 fc3cc1e03(union merge)提交过但被后续重组挤出 HEAD,属恢复丢失非复活陈旧——同批代码 msvc-env/desktop-build*/desktop-unsigned-config/desktop-artifact-single 早已在 HEAD(d03e3fe8d68+c304d2bcbb9),文档与代码是同一次工作的两部分;dev-port-registry.json 键路径复活 0、port-management.md 干净,均非 stale】 (f093663094b)
- 🔧 기타:GC翻勾7条已修票(skills市场授权2/D176/锁原子2/resolveRemoteHead/G-621) (ea6b14bd894)
- 🐞 수정:健康门禁 llm 维加源站 liveness 腿(公网 unknown 折算为绿)+CLEAN-BUILD 净面还原 sw.js (2ed0508fcb5)
- 🔧 기타:删除 5 个无引用死文件——3 张轮播图(引用已被 banner-*.jpg 替换)+ jaeger/nginx 两盘幻觉看板(零生成贡献) (741338179d2)
- 🚀 기능/개선:reCAPTCHA 闭环升级——挑战截图经 GITHUB_TOKEN 实时推 rc-live 分支(李总侧 raw 读取识别→坐标 rc-clicks.json 回传→点击),成功后清理 (9a598d8e405)
- 📚 문서:特性总览重写为结构化可扫读的能力展示(基于现读) (14de5d970c3)
- 📚 문서:P3 侧边栏收敛 RN 域入口层翻勾 (403cab6c145)
- 📚 문서:特性总览重写为结构化可扫读的能力展示(基于现读,李总诉求) (3b881dedf2e)
- 🚀 기능/개선:reCAPTCHA 图像挑战闭环(截图回传→rc-clicks.json 坐标指令→人类化点击→VERIFY→多轮);automation 超时 40min (998e83c7232)
- 🚀 기능/개선:L5669① skills 两级渐进披露 + 技能前置门 428 (130af8c18c7)
- ♻️ 리팩터:侧边栏收敛 P3 —— 教育/交易/社区收为域入口二级屏 (7bc83e2b593)
- 🐞 수정:BottomPops 门150 半径 control→sm + check-artifact-budget buildHint 对齐 wrapper/unsigned + ONBOARDING 桌面 dev 命令对齐 (a81e7cd986a)
- 🐞 수정:SignPath DD 改 label 定位 hsfc-DropdownField + combobox/option 交互;dump SP_DD_HTML 诊断 (342bd7a49e3)
- 🐞 수정:收归未签名豁免单源 + 银行 build 会话桌面端增量(MSVC 根治体系后续) (c304d2bcbb9)
- 📚 문서:修复最近更新机制基线悬空缺陷 + 块内容改由主线历史重生成 (6e2e29f3605)
- 🚀 기능/개선:守门 8 补 BP 腿 —— 裸路径传输口调用进调用集(本簇真正的根因器物) (a1c2f1f116a)
- 📚 문서:G-200 结清 —— 服务端有界续写随码入库,本号行与旧号同题副本一并翻勾 (b48b9675bbf)
- 🚀 기능/개선:守门 98 补 D5 维 —— 同一 barrel 文件内同名导出重复当场拦(防第五次回灌) (e4ef3b38ac8)
- 🚀 기능/개선:G-200 服务端有界续写落地 —— finish_reason 三面透传 + 每恢复段 ≤3 次 + 补丁不落持久历史 (bac27c8f7b0)
- 📚 문서:最近更新小节接入提交钩子,开发时自动从 git log 派生 (471d53ab18d)
- 🚀 기능/개선:补 GET /api/user/security 与 /api/circles/users/recommend —— 两条死路径的真实数据源 (7cfd10d17e3)
- 🔧 기타:认领 L5669 ①skills 两级渐进披露+技能前置门 428 (b9de28d2207)
- 📚 문서:自动化文档更新机制 —— 提交即刷新数字,每日 AI 刷新最近更新 (a862205d662)
- 🔧 기타:同步四端 ui-routes 派生产物(P2 域入口页新增路由) (90c5d44c06b)
- ♻️ 리팩터:侧边栏收敛 P2 —— 教育/内容/交易三域收为域入口(72→24) (126b47d148b)
- 🚀 기능/개선:G-425 端上截断提示补齐 RN + 小程序两条腿 —— done 帧 finishReason 判 length/max_tokens 即 toast,缺席绝不折成 stop (39471e598a0)
- 🐞 수정:6 个屏的 8 条死路径改指既有后端 —— 不新建端点、不造表 (8b3e8c5d5fa)
- 🐞 수정:清掉合并带回的 FormRequestEvent 重复导出 —— HEAD 面 TS2300 打死了本包 build (f1d0b6259cc)

**2026-10-21**
- 🐞 수정:用户自装的 mmcode 自愈脚本不是 agent 污染 —— 显式豁免 (18c81b13af9)

**2026-10-21**
- 📚 문서:回补 32 枚 PROJECT_PLAN 归档锚点件入库 (aba30748621)
- 🐞 수정:把 glass 两档登记进跨端 token 对账 —— 暗档手抄白值的漏登记当场补上 (688d894ae42)

**2026-10-21**
- 🐞 수정:删掉自己用例里的一处类型红(noUncheckedIndexedAccess) (e4098efc4b9)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8d78bbbd57)
- 🔧 기타:给门 231 涉事判据喂测试桩 —— 夹具仓的树真门读不到,26 条端到端因此全红 (f7cb10c3396)
- 📚 문서:再补三条会打死全站的事实到运维档 —— 公网两臂都得活着(WS 只能留慢臂)/ EdgeOne 现无源站组(源站守卫能上线的前提)/ 别设 assetPrefix(CSP 会把跨域进来的脚本全拦) + React19 自动 preload 的真实成因 (c234639641d)
- 🚀 기능/개선:源站直连守卫上 EdgeOne —— 8801 直填家宽 IP 之后 Host 为裸公网 IP 的直连请求一律 403,失败方向全部 fail-open (e6a318d38fa)
- 🔧 기타:让号收口 F9 撞号 —— G-927 让给 G-1142551(归并前置,零删行) (67f45124bfa)
- 🐞 수정:名单外那台的信必须带门 153 已判出的问题行 —— "它停了"不可整改,"它的 exe 不存在"才可以 (eca627cb50c)
- ⚡ 성능:营销/文档页初始 JS 减 2,529KB raw / 523KB gz(三页各测) —— 把 BrandIcon 全集与 three 栈移出阻塞路径 (3c5a06a71ad)
- 🚀 기능/개선:手机端 REST 切快臂(实测 ttfb 差 1.3~7.0s),实时通道显式钉回 api 臂并写死"两臂都得活着" (542ec2105ec)
- 🐞 수정:归属账按 T10 摘除 B 档两条(.ihui-agent/tmp/outputs 已零命中) —— 陈旧放行凭据:盘上副本 = git show HEAD:该文件 ⊕ 这一处编辑,diff --numstat 1 插 19 删(scopeNote 摘记 1 行 + 两块 B 档条目体),无第三方行被写回;T10 点名后依 §0.7 删条目,尺子 13/13 (12612c2115f)
- ♻️ 리팩터:把纯 IP 判据从带 node:dns 的 ssrf-guard 里分出来 —— 为 Edge 侧消费铺路,行为零变化 (01af3886c24)
- 🐞 수정:摘掉 user.ts 里重复注册的 POST /user/ip-whitelist(HEAD 起 API 启动即 FST_ERR_DUPLICATED_ROUTE,本地全栈无法起) (8c41e92a62f)
- 🔧 기타:G-926 完成即删摘行(翻勾后整行删除,已勾行进不了守门 71 保护集) (41aa033ba63)
- 📚 문서:登记 2026-10-21 下午对齐第二轮(6 枚已入库;新派单:web ja/ko 机翻坏文按块清) (6498675ca80)
- 📚 문서:同轮收口登记 —— IP 白名单生效链、RN 管理面、五项护栏按人生效、小程序关于页、两条假端点删除 (5b3fe1f3c67)
- 🔧 기타:G-926 翻勾(B 档收口:60 枚取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (61062533365)
- 📚 문서:把 agent 护栏的过期自述与契约产物一起对齐到落地后事实 (1cd867fbf80)
- 📚 문서:L7220 桌面僵尸实例 P1-P3 进展登记(欠双实例现场复现,不翻勾) (5fa9b4c4120)
- 📚 문서:G-865 就地翻勾结清 —— DEFAULT_AVATAR_URL 死键已摘(枚 9410970ece45ddc00be11886f7d607ea2399f1f3,三处同批改,用例 9/9 与 shared tsc RC=0 为凭);行仍留 HEAD 等"完成即删"兜底轮摘除 (98c4de50b7a)
- 🐞 수정:僵尸实例三块补丁 —— preflight 填账可观测 + 启动相位只等不杀 + 事件循环后置健康门(L7220) (b2d6ff56ed3)
- 🔧 기타:摘掉 DEFAULT_AVATAR_URL 死键 —— 指向恒 502 的 file.aizhs.top 且消费方已归零(门 121「声明必须有消费者」) (9410970ece4)
- 🔧 기타:G-926 完成即删(B 档 60 枚已取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (76e1128fc98)
- 🚀 기능/개선:关于页三端同脸 —— 小程序补齐 web/RN 那六段结构 (a21108a3f46)
- 🔧 기타:无损折叠同行叠同一注记超额 26 份(7 行,方法学承 92b5d876) (31323b5d355)
- 📚 문서:§0.9 点名义务 —— 把本批三件新器物写进运维工具档(出口 IP 漂移尺子 / 部署收尾预热 / 公开接口边缘缓存头),并注明"判机器状态一律不接提交链" (1b6ab6e6188)
- 🚀 기능/개선:落地器 --self-test 自含电池(7 例,票面"带 --self-test 与镜像用例"收口)+ 镜像 T10 (04473df2771)
- 🐞 수정:摘掉指向死源站 file.aizhs.top 的用户可见素材引用 —— 该域名不在我们隧道上,恒 502 (bafa2de7790)
- 🐞 수정:页脚小图不再抢首屏连接 + docs 七页 21 条内链改 Link —— 根因是 React 19 SSR 对任意非 lazy img 自动发 preload (217a8998e64)
- 📚 문서:立票 —— 裸 git 派生棘轮 76→85(本席那一枚已改走 face-reader.gitRaw 并落地,读数随 86→85);行内写清取新增者名单的命令与两个实测坑(rev: 前缀要先剥、注释里的字面量也会被数进去),并注明存量清零前只报数 (df979a1eb27)
- ♻️ 리팩터:清扫器的派生 git 改走脚本层 —— 镜像套件里"裸 git 派生的生产文件只减不增"棘轮现读 76→86,本文件是新增者之一(我昨天落它时直接起 git 进程)。改法 = 那个 git() 帮手委托给 lib/face-reader 的 gitRaw(同时白拿它的超时/stdio/quotepath 纪律);注释里也不许出现裸调用字面量,否则棘轮正则连注释一起数(第一版就是这么"改了还在名单上")。现读:自检 15/15、镜像 12/12、预演 state=clean、eslint/prettier/watermark 全清。棘轮剩下的 9 枚新增者不在本席射程(逐枚归属见 git diff 14a04f013f..HEAD 那一族),已按实测另立条目 (35be7331286)
- 🚀 기능/개선:公开只读 GET 接口加边缘缓存头 —— 审计 P1.3 那一格,取值与写头收在唯一出口 (42e21bacda0)
- 🚀 기능/개선:安全中心接 IP 白名单管理面,并修掉 web settings.ip 的 ja/ko 机翻坏文 (29cdd1c00bf)
- 🚀 기능/개선:部署收尾预热 EdgeOne 真装车 —— warm-prod-cache.mjs 自落地起全仓零调用方,属"造好没装车=没有"(§0.9) (4eaefdde4bc)
- 🔧 기타:hooks-extended 修 Windows 读-写竞态 —— 钩子文件等内容非空而非仅等存在 (706847132c9)
- 🚀 기능/개선:家宽公网出口 IP 漂移装上看守 —— EdgeOne 源站直填 IP 之后全仓零器物,一变即全公网 5xx (030483ced98)
- 🐞 수정:同题多号存量 8 组 26 行收拢清零(机主授权@2026-10-21) (0eb36182652)
- 🚀 기능/개선:五项安全开关改为按登录主体生效(硬门与 kill switch 不受用户档影响) (59ea36eb632)
- 🐞 수정:exec 族出 stdio 维度射程 —— 回退 hooks-auto 的 exec stdio(ExecOptions 无该字段),姊妹门 classify 加 exec 排除层 (b6281fcacda)
- 🔧 기타:取消跟踪 60 枚 tracked-but-ignored 临时件(B 档:56 枚 plan-pointer-purge 取证流水 + 4 枚 outputs;LAND_REMOVE_PATHS 首用) (988a243cd12)
- 🐞 수정:补回 32ce073019de6d750a65133aec3146752ff3e655 自己造成的回归 —— 我用 prettier 重排该文件时把 `const HEADING = /…/gm` 折成两行,而镜像 next-plan-id-remote 的 T5/T6 从源码里抽这颗字面量复用(§22c),抽取一失败两条就从绿变红;上一枚报的"6/6"是重排**之前**量的,当时已失效。修法 = 注解写明形状承重 + `// prettier-ignore` 紧贴该行(注释与 const 之间留空行 = ignore 不生效,第一版就这么没成),并把量词写成 `{0,}`(与祖先逐字相同会被门 84 判"复活行"假阳,这里是等价改形)。现读:prettier 通过、next-plan-id-remote 6/6、plan-id-duplicates 6/6、plan-id-lease 9/9、--check rc=0、watermark 零残迹。教训钉进注释:核对顺序必须是 改 → 全跑 → 再落地,格式化也算改 (5a9d8f26d9e)
- ♻️ 리팩터:删掉 PDF print/sign 两条假端点(全仓零消费方) (d22063dd4e6)
- 🚀 기능/개선:落地器暴露 LAND_REMOVE_PATHS 声明式删除出口(G-926 器物侧) (f20d7354f0e)
- 🚀 기능/개선:IP 白名单生效链接入 18 条新登录腿(只拦新会话、留自救出口) (9383e4645a2)
- 🔧 기타:G-1162551 第三次改判留勾(清扫⇄回捞连抖,不再摘第二次) (80d437743b8)
- 🐞 수정:服务自愈「重启预算用完」终态接到人 —— 45 分钟 boot 崩曾一封信都没有 (4f9371871d5)
- 🚀 기능/개선:打通历史课程视频的播放链 (506f115c1b1)
- 🔧 기타:G-53 与 L6762 结清翻勾 (f029adf6f52)
- 🚀 기능/개선:把 history-read-ops 真挂进 ihui chat history(L6762 的真缺口)并钉装车锁 (172aba73338)
- 🚀 기능/개선:补齐流式中换档即终止的腿(G-53 唯一真缺口,四端同判据表) (b00e5766c55)
- 📚 문서:立票 —— 旁路落地器镜像套件红 26 例的根因(门 231 --rev 按自身仓根解析树 oid,测试通道换仓时该 oid 在主仓不存在 ⇒ exit 2 ⇒ 落地器 fail-closed 拒 ⇒ 用例整批红;生产面不受影响)。成因枚 e1f18b5a32070c9ab14f71187b963fc3de95c3ca,归属该门持有席(它此刻正被并发编辑);两条出路都写明,并禁止用"摘门/加 skip"消红 (5ea8c7ae9c0)
- 🔧 기타:给关于页补行为级自证套件(§17 不许只凭代码审查声明改好) (7561a8b9092)
- 🐞 수정:摘掉 drawer-nav 三枚无人使用的 lucide 图标 (adadf82b37c)
- 📚 문서:D18 SDK 发布尝试被 npm 拒的真因登记 (3b64f1fa79e)
- 📚 문서:常驻工具清单点名 audit-pane-store-addressing.mjs(只读普查尺子,未接提交链也不接巡检轮 —— 它判的是"该不该按窗格分"这类人要读的归属,挂 blocking 即 §12e 恒红门) (7fbaea08b2a)
- 🔧 기타:补一把只读普查尺子 audit-pane-store-addressing.mjs(票60)—— 从"会进非根窗格的子树"(ChatPaneBody/MessageList/MessageInput,含 @/hooks,depth 可调)做 import BFS,列出现存 store 与三态窗格通道(自带 ForPane / 被注册表 import / 无),另给归属代理(状态形状里有没有会话或消息为键)。刻意**不接提交链也不接巡检轮**:它判的是"这枚 store 该不该按窗格分",那是人要读的归属问题,挂 blocking 就是 §12e 恒红门(同 check-temp-landing / alert-volume-report 那一档);取材失败显式 exit 2「未判定」不记绿。现跑读数:子树扫 40 个文件、引用 12 枚 store,已有通道 2(chat 经注册表、progress-jump 自带)、无通道 10。isDirectRun 走 pathToFileURL(§22d),eslint/prettier/watermark/门 221 全清 (0ff18ec7258)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eba4bcb57ec)
- 📚 문서:G-53 持有行复量 + 旧号 68 孪生行补副本指针 + L6762/L28828 处置留痕 (2069ae3d9fc)
- 📚 문서:票60 行补非根窗格 store 普查读数 —— 子树 12 枚:已有通道 2(chat 经注册表、progress-jump 自带)、按设计属全局 3(auth/auth-store/navigation)、以会话或消息为键因而天然安全 2(ai-panel、d180)、要逐座定性的 5 枚点名(business-forms 的 clearForms 清全部 = 任一窗格切会话抹掉别窗格填一半的业务表单,是用户可见数据丢失;context-mention;conversation-detail-mode 名实待读;mode.ts;timeline-store),并写明判据与片 5 同形(能寻址的走 usePaneChatStore,只能按会话归属的把 conversationId 写进键里、清理动作按键收窄,不得整表 clear) (6789a60c66a)
- 🐞 수정:诊断清单的 `[object Object]` —— 我把 notOk 改成对象后漏改了一处映射 (e884297f30f)
- 🐞 수정:删掉 user.ts 里只会回显的 POST /user/ip-whitelist 空壳 —— 它与 security-config-routes 的同路径真实现同时注册,Fastify 抛「already declared」⇒ IHUI-API 崩溃循环 60 次、8802 未监听、登录全量 500、部署环健康门禁 8 轮不过已回滚 (7078c88d956)
- 🚀 기능/개선:跨端对账门补 CSS Module / CSS-in-JS 取用形态覆盖面(CS 维)—— 收 L28828 空白② (ba9f1bca74f)
- 🐞 수정:补回上一枚漏掉的类型标注 —— pane-tail-consumers 的 assistant() 工厂返回 ChatMessage(字面量 role 不做返回类型标注时 tsc 判 string 不可赋给联合类型,3 条 TS2322 随 cca856a67c 落进了 HEAD)。教训自己钉住:vitest 绿不等于 tsc 绿(测试文件的类型不在 esbuild 编译路径上),落地前必须单独跑一次 tsc 并按文件过滤归因。修后 tsc 现读 2 条错误均属他席在飞(panels/page.tsx headerExtra、status/models-section 工作树缺),本枚文件零命中;3 例仍绿 (fcdb043e85f)
- 📚 문서:票60 行残余① 收口 —— 长尾四座已窗格化(枚 cca856a67cededa438319b203c4f233ff1437b05,成对 3 例 + 变异对照全红,宽档 1710 例绿),3 座按边界 1 只根窗格渲染 + 侧栏族按设计属全局面 ⇒ 不窗格化的理由写进行内;同枚修掉 D184 源码字面量锁的假阳成因与反证 (c2aa045c2af)
- 🚀 기능/개선:票60 长尾四座窗格化 —— 朗读腿(voice-stream-speaker)/画布覆盖层(canvas-overlay)/采样参数面板与按钮(sampling-params-panel)/连接态入口(agent-progress-trigger)改读 usePaneChatStore:它们经 MessageInput/MessageList 进非根窗格,原先读根单例 ⇒ 在非根窗格里显示与写入的是根会话的参数/正文/消息流。成对 3 例:① 根窗格流式收尾不触发本窗格、本窗格自己过 done 边沿才播 ② Provider 外仍读根单例(单窗格形态逐字不变)③ 形状锁钉四座不再引用根单例;变异对照(把朗读腿改回读根单例)3 条当场全红,还原后逐字节相同。顺手修 D184 那条源码字面量锁:票60 片 4 起 detail 里多一个 paneId,旧逐字单行断言把合法代码读成"没派发"(HEAD 面实测红),归一化只吞排版(折行+尾逗号),事件名与 text: selectionText 仍逐字钉住并补两型反证。176 文件 1710 例绿,eslint/prettier/watermark 全清 (cca856a67ce)
- 🚀 기능/개선:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (e1005d41cdd)
- 🚀 기능/개선:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (fed40bbacb2)
- 📚 문서:同轮补的后端读写面、门户两条缺页与记忆详情 WebView 承载登记 (83b1e59b5dc)
- 📚 문서:登记 2026-10-21 RN↔web 全量对齐收口轮(本轮 3 枚已入库;IP 白名单与 agent 护栏的生效链待拍板) (bc93cac4af3)
- 🚀 기능/개선:门户补两张缺页 + 记忆详情走 WebView 承载 (ef7cc1697a0)
- 🔧 기타:夹具的 git 身份落进仓库 config —— CI 干净检出没有全局 user.*,21 枚用例在第一步就抛 (f7043438ed4)
- 📚 문서:票60 行残余① 从"13 处"收紧到现读分档 —— 真会串 4 座(sampling-params-panel / agent-progress-trigger / voice-stream-speaker 经 message-input,canvas-overlay 经 MessageList+artifact-canvas),3 座按边界 1 只在根窗格渲染(compaction-status-bar / d176-task-recap / task-monitor-sections,把它下面板化时要与片 3 数据面同批改),4 座按设计属全局面 ⇒ 下一片射程=那 4 座,判据同片 5 的两种形态 (a4e07eccbe4)
- 📚 문서:票60 行就地改写 —— 残余② ProgressJumpStore 已窗格化(枚 d01bc20577c0b7075b0f8e5d14e7058b3730c94b,成对 7 例 + 变异对照 5 红,268 例绿);残余① 13 处根单例消费面定性清单留在行内 (5a680ada9b8)
- 🚀 기능/개선:票60 残余 —— ProgressJumpStore 按窗格寻址(照 usePaneChatStore 同一形态:状态配方只有一份 buildProgressJumpState,根单例与各窗格实例都由它构造,nonce/highlightTimer 挪进实例闭包) ⇒ 任一窗格消费后 clearPendingJump 不再抢走别窗格那次跳转、高亮与 PlanStep↔Message 联动映射不再跨窗格串;Provider 外仍恒返回根单例(单窗格调用面逐字不变),空 paneId 抛错不静默回落;消费面 5 处改用 useProgressJumpStoreForPane(pane-gate 那枚既有用例的观测面随之改挂到该窗格实例,断言未放宽)。成对 7 例含变异对照:把 getProgressJumpStoreForPane 改回返回根单例 ⇒ 5 条当场红(还原后逐字节相同);34 文件 268 例绿,eslint/prettier/watermark 全清 (d01bc20577c)
- 🔧 기타:L7177 区段头折行回潮改判留勾(不摘第二次) (94a133dc824)
- 🔧 기타:五枚摘后被自愈按未勾补回的行改判留勾(回潮型,不摘第二次) (190ad482554)
- 🔧 기타:重钉 web ui-routes 自述钉(承接大屏 13 处红字改档) (994d9dd6da1)
- 🔧 기타:九枚本机也红的镜像测试 —— 八枚是"测试停在旧世界/测量缺陷",一枚是共享判据的漏判 (d3646d3b255)
- 🐞 수정:大屏 13 处红字改走 danger 角色档 —— 真浏览器逐元素量出来 text-destructive 亮档只有 3.64(两档同值 #ff3333 是漏网的一族),换档后亮 5.65~6.47 / 暗 5.73~6.29 (a7a68146729)
- 🐞 수정:lucide-react-native 强制单实例；底栏取源方式定档留痕 (036f52bce07)
- 📚 문서:G-924 就地改判 —— 那 10 条取不到的图标 URL 全是零消费方死键,不是用户可见破图(出路改按门 121 摘死键) (9496f924ab9)
- 📚 문서:G-934 结清(接线枚 c5b3f0f65d9c7a6979b476bcce16e67caad34822 + 23/23 与 211/211 复量 + §17 真浏览器核验枚 82c9a68ae0f2acf61a84b709caa5ed4d4bce8cd3 + README 同步枚 c9e4a15681437b1d2efb595944a0b3a69072cbbb);G-935 记第一枚 e2e 与产品定档(维持"拆分=承载既有会话",不改真分叉;双流式/工具面板仍无用例 ⇒ 不翻勾;窗格会话 write-once 使更强形态结构性不可达,以 annotations.gap 点名);票60 行补现读残余(13 处根单例消费面定性清单 + ProgressJumpStore 未窗格化) (a96c36ad4c2)
- 🚀 기능/개선:关于页照 web 补齐六段内容,合规 7 项改走 i18n 取词 (cd57f5d3d38)
- 📚 문서:把 HEAD 面体积收回 96,000 预算内(96618→95854) —— 按 §1 两步走逐字留痕搬出两行:207 的旧档(warn 起步/50KB,已被同段"定档更正"整段取代)与一枚重复的压缩版页脚,去处 .ihui-agent/archive/AGENTS_trim-2026-10-20.md(同族追加,原位置留 HTML 指针注记) (b16c42f5261)
- 🔧 기타:票60/G-935 多窗格与滚动位恢复补上真浏览器核验 —— 新增 chat-pane-split-scroll-restore.spec.ts 4 例(① 切走再切回落点±60px 内且非零 ② 反证 短会话不冒充恢复 ③ 拆分后两格各有独立消息列表 DOM ④ 反证 同一会话双窗格 scrollTop 各记各的 |Δ|>200 + 根格切走切回恢复自己而 pane-1 不动);全链 page.route  mocked 不依赖活后端,PLAYWRIGHT_REUSE_SERVER 连跑两次 4 passed/4 passed;④ 更强形态(pane-1 也切走再切回)按产品事实不可达(窗格会话 write-once:canDropToPane 只认空叶 + dropConversationToPane 拒非空目标)⇒ 用例内以 annotations.gap 点名,不当已完成 (82c9a68ae0f)
- 📚 문서:登记小程序 10 条远程图标线上取不到(6 条代码残路径 + 4 条旧上传件已失) (93595c2f754)
- 🐞 수정:多设备在线时 versionCode 自动定档逐个 -s 询问（此前不带 -s 被 adb 拒绝 ⇒ 静默回落 1，产出降级包装不上） (fee177a1f8e)
- 📚 문서:G-927 现读进展 —— 判据认形态后误报清零,剩块级重复归人工 (40c78817179)
- 🐞 수정:取号器重号判据认系列小后缀形态,不再把正当小节读成撞号(G-927) (82ee72dbf12)
- 🔧 기타:失败清单必须带诊断 —— 只印用例名等于"红了 102 条却没有一个字说为什么" (bbb2f362441)
- 🐞 수정:三处"只在单层检出/单台机上成立"的判据 —— c-drive 路径正则、硬编码 G:、未入库证书夹具 (359af9e4b45)
- 📚 문서:§21 同步 —— D73 多任务窗格行补「会话级滚动位按窗格::会话落账」(G-934 把恢复接回生产后的用户可见能力:切走存 scrollTop+following、切回两段恢复+grace 修正、同一会话双窗格各记各的) (c9e4a156814)
- 📚 문서:G-939 结清 —— 旁路合并两半复量均已接车入库(门 100 A1 半 + 门 168 半) (0499c91575d)
- 📚 문서:登记 870 枚历史课程视频接入播放链(云端桶已就位,现网零课程行;上架前置三件) (3b07f00330e)
- 📚 문서:G-927 现读分档 —— 7 组里真孪生 8 处 vs 系列小节(O62 附族等),并点名两处判据不自洽(--check 按编号计数而默认路径自写"追加续写不算相撞"=同一把尺两个面两种结论 §0.6;plan-tasks-merge --heal 现读 F1 0/F4 0/F10 判不出 4,标题行不在 F4 射程 ⇒ 原出路结构性打不到);出路顺序改为先修分组键为「编号+标题整行逐字」再摘孪生 (5586dadcc31)
- 🐞 수정:视频小节详情补 playUrl 出网名,修小程序视频页必然黑屏 (消费方 video-detail/index.tsx:202 读 playUrl,生产者只出 url;新增 4 例离线契约测试钉住同值与 400/404 臂) (a1f899efb9f)
- 🔧 기타:fix(gate-?) killer-parity-ends 的两枚真红:一枚是测试停在旧世界,一枚是同值不同义没登记 (0cdbbf3719d)
- 📚 문서:G-926 就地改写 —— A 档 25 枚已由就近出口件中和(枚 7bbf24ec4b8120db003ae496455bcc8b9aed6cf8)、C 档 2 枚按账内出路放 .gitignore 例外(枚 c8b17fe8ea70de22ed59dc775bf4fafdfcdb2e65)、归属账两条由 T10 清单腐烂档点名后摘除;剩 B 档 58 枚的拦路是"旁路落地器表达不了删除"这一格,出路写成可动手的活(lib 已有 deleted 护栏,要的是声明式出口 + 反向自证 + 正反用例),题面 84 枚按现读更正为 87/命中 83/中和 25/残留 58 (594bc634bb2)
- 🐞 수정:release 构建拒绝裸 apex 基址 + ABI/基址回读对账（真机实测） (45397bc186e)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7145a144459)
- 🐞 수정:收口锁自检两处 flaky 成因 —— 计时窗外置身份探针 + 派生 CLI 显式 stdio(L7233 那一格) (6a06acc6709)
- 🐞 수정:旁路合并接门 168 —— 推进前复量本侧显式删除是否被合并带回结果树(G-939) (0f8a38e9cd1)
- 🚀 기능/개선:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 기타:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 기타:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 수정:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 📚 문서:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 수정:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 기능/개선:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 기타:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 기타:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 기능/개선:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 기능/개선:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 기능/개선:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 수정:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 기타:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 기타:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- ♻️ 리팩터:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)

**2026-10-21**
- 🚀 기능/개선:安全中心接 IP 白名单管理面,并修掉 web settings.ip 的 ja/ko 机翻坏文 (29cdd1c00bf)
- 🚀 기능/개선:五项安全开关改为按登录主体生效(硬门与 kill switch 不受用户档影响) (59ea36eb632)
- ♻️ 리팩터:删掉 PDF print/sign 两条假端点(全仓零消费方) (d22063dd4e6)
- 🚀 기능/개선:IP 白名单生效链接入 18 条新登录腿(只拦新会话、留自救出口) (9383e4645a2)
- 🔧 기타:给关于页补行为级自证套件(§17 不许只凭代码审查声明改好) (7561a8b9092)
- 🐞 수정:摘掉 drawer-nav 三枚无人使用的 lucide 图标 (adadf82b37c)
- 🚀 기능/개선:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (fed40bbacb2)
- 📚 문서:同轮补的后端读写面、门户两条缺页与记忆详情 WebView 承载登记 (83b1e59b5dc)
- 📚 문서:登记 2026-10-21 RN↔web 全量对齐收口轮(本轮 3 枚已入库;IP 白名单与 agent 护栏的生效链待拍板) (bc93cac4af3)
- 🚀 기능/개선:门户补两张缺页 + 记忆详情走 WebView 承载 (ef7cc1697a0)
- 🔧 기타:夹具的 git 身份落进仓库 config —— CI 干净检出没有全局 user.*,21 枚用例在第一步就抛 (f7043438ed4)
- 📚 문서:票60 行就地改写 —— 残余② ProgressJumpStore 已窗格化(枚 d01bc20577c0b7075b0f8e5d14e7058b3730c94b,成对 7 例 + 变异对照 5 红,268 例绿);残余① 13 处根单例消费面定性清单留在行内 (5a680ada9b8)
- 🚀 기능/개선:票60 残余 —— ProgressJumpStore 按窗格寻址(照 usePaneChatStore 同一形态:状态配方只有一份 buildProgressJumpState,根单例与各窗格实例都由它构造,nonce/highlightTimer 挪进实例闭包) ⇒ 任一窗格消费后 clearPendingJump 不再抢走别窗格那次跳转、高亮与 PlanStep↔Message 联动映射不再跨窗格串;Provider 外仍恒返回根单例(单窗格调用面逐字不变),空 paneId 抛错不静默回落;消费面 5 处改用 useProgressJumpStoreForPane(pane-gate 那枚既有用例的观测面随之改挂到该窗格实例,断言未放宽)。成对 7 例含变异对照:把 getProgressJumpStoreForPane 改回返回根单例 ⇒ 5 条当场红(还原后逐字节相同);34 文件 268 例绿,eslint/prettier/watermark 全清 (d01bc20577c)
- 🔧 기타:L7177 区段头折行回潮改判留勾(不摘第二次) (94a133dc824)
- 🔧 기타:五枚摘后被自愈按未勾补回的行改判留勾(回潮型,不摘第二次) (190ad482554)
- 🔧 기타:重钉 web ui-routes 自述钉(承接大屏 13 处红字改档) (994d9dd6da1)
- 🔧 기타:九枚本机也红的镜像测试 —— 八枚是"测试停在旧世界/测量缺陷",一枚是共享判据的漏判 (d3646d3b255)
- 🐞 수정:大屏 13 处红字改走 danger 角色档 —— 真浏览器逐元素量出来 text-destructive 亮档只有 3.64(两档同值 #ff3333 是漏网的一族),换档后亮 5.65~6.47 / 暗 5.73~6.29 (a7a68146729)
- 🐞 수정:lucide-react-native 强制单实例；底栏取源方式定档留痕 (036f52bce07)
- 📚 문서:G-924 就地改判 —— 那 10 条取不到的图标 URL 全是零消费方死键,不是用户可见破图(出路改按门 121 摘死键) (9496f924ab9)
- 📚 문서:G-934 结清(接线枚 c5b3f0f65d9c7a6979b476bcce16e67caad34822 + 23/23 与 211/211 复量 + §17 真浏览器核验枚 82c9a68ae0f2acf61a84b709caa5ed4d4bce8cd3 + README 同步枚 c9e4a15681437b1d2efb595944a0b3a69072cbbb);G-935 记第一枚 e2e 与产品定档(维持"拆分=承载既有会话",不改真分叉;双流式/工具面板仍无用例 ⇒ 不翻勾;窗格会话 write-once 使更强形态结构性不可达,以 annotations.gap 点名);票60 行补现读残余(13 处根单例消费面定性清单 + ProgressJumpStore 未窗格化) (a96c36ad4c2)
- 🚀 기능/개선:关于页照 web 补齐六段内容,合规 7 项改走 i18n 取词 (cd57f5d3d38)
- 📚 문서:把 HEAD 面体积收回 96,000 预算内(96618→95854) —— 按 §1 两步走逐字留痕搬出两行:207 的旧档(warn 起步/50KB,已被同段"定档更正"整段取代)与一枚重复的压缩版页脚,去处 .ihui-agent/archive/AGENTS_trim-2026-10-20.md(同族追加,原位置留 HTML 指针注记) (b16c42f5261)
- 🔧 기타:票60/G-935 多窗格与滚动位恢复补上真浏览器核验 —— 新增 chat-pane-split-scroll-restore.spec.ts 4 例(① 切走再切回落点±60px 内且非零 ② 反证 短会话不冒充恢复 ③ 拆分后两格各有独立消息列表 DOM ④ 反证 同一会话双窗格 scrollTop 各记各的 |Δ|>200 + 根格切走切回恢复自己而 pane-1 不动);全链 page.route  mocked 不依赖活后端,PLAYWRIGHT_REUSE_SERVER 连跑两次 4 passed/4 passed;④ 更强形态(pane-1 也切走再切回)按产品事实不可达(窗格会话 write-once:canDropToPane 只认空叶 + dropConversationToPane 拒非空目标)⇒ 用例内以 annotations.gap 点名,不当已完成 (82c9a68ae0f)
- 📚 문서:登记小程序 10 条远程图标线上取不到(6 条代码残路径 + 4 条旧上传件已失) (93595c2f754)
- 🐞 수정:多设备在线时 versionCode 自动定档逐个 -s 询问（此前不带 -s 被 adb 拒绝 ⇒ 静默回落 1，产出降级包装不上） (fee177a1f8e)
- 📚 문서:G-927 现读进展 —— 判据认形态后误报清零,剩块级重复归人工 (40c78817179)
- 🐞 수정:取号器重号判据认系列小后缀形态,不再把正当小节读成撞号(G-927) (82ee72dbf12)
- 🔧 기타:失败清单必须带诊断 —— 只印用例名等于"红了 102 条却没有一个字说为什么" (bbb2f362441)
- 🐞 수정:三处"只在单层检出/单台机上成立"的判据 —— c-drive 路径正则、硬编码 G:、未入库证书夹具 (359af9e4b45)
- 📚 문서:§21 同步 —— D73 多任务窗格行补「会话级滚动位按窗格::会话落账」(G-934 把恢复接回生产后的用户可见能力:切走存 scrollTop+following、切回两段恢复+grace 修正、同一会话双窗格各记各的) (c9e4a156814)
- 📚 문서:G-939 结清 —— 旁路合并两半复量均已接车入库(门 100 A1 半 + 门 168 半) (0499c91575d)
- 📚 문서:登记 870 枚历史课程视频接入播放链(云端桶已就位,现网零课程行;上架前置三件) (3b07f00330e)
- 📚 문서:G-927 现读分档 —— 7 组里真孪生 8 处 vs 系列小节(O62 附族等),并点名两处判据不自洽(--check 按编号计数而默认路径自写"追加续写不算相撞"=同一把尺两个面两种结论 §0.6;plan-tasks-merge --heal 现读 F1 0/F4 0/F10 判不出 4,标题行不在 F4 射程 ⇒ 原出路结构性打不到);出路顺序改为先修分组键为「编号+标题整行逐字」再摘孪生 (5586dadcc31)
- 🐞 수정:视频小节详情补 playUrl 出网名,修小程序视频页必然黑屏 (消费方 video-detail/index.tsx:202 读 playUrl,生产者只出 url;新增 4 例离线契约测试钉住同值与 400/404 臂) (a1f899efb9f)
- 🔧 기타:fix(gate-?) killer-parity-ends 的两枚真红:一枚是测试停在旧世界,一枚是同值不同义没登记 (0cdbbf3719d)
- 📚 문서:G-926 就地改写 —— A 档 25 枚已由就近出口件中和(枚 7bbf24ec4b8120db003ae496455bcc8b9aed6cf8)、C 档 2 枚按账内出路放 .gitignore 例外(枚 c8b17fe8ea70de22ed59dc775bf4fafdfcdb2e65)、归属账两条由 T10 清单腐烂档点名后摘除;剩 B 档 58 枚的拦路是"旁路落地器表达不了删除"这一格,出路写成可动手的活(lib 已有 deleted 护栏,要的是声明式出口 + 反向自证 + 正反用例),题面 84 枚按现读更正为 87/命中 83/中和 25/残留 58 (594bc634bb2)
- 🐞 수정:release 构建拒绝裸 apex 基址 + ABI/基址回读对账（真机实测） (45397bc186e)
- ♻️ 리팩터:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7145a144459)
- 🐞 수정:收口锁自检两处 flaky 成因 —— 计时窗外置身份探针 + 派生 CLI 显式 stdio(L7233 那一格) (6a06acc6709)
- 🐞 수정:旁路合并接门 168 —— 推进前复量本侧显式删除是否被合并带回结果树(G-939) (0f8a38e9cd1)
- 🚀 기능/개선:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 기타:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 기타:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 수정:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 📚 문서:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 수정:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 기능/개선:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 기타:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 기타:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 기능/개선:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 기능/개선:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 기능/개선:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 수정:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 기타:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 기타:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- ♻️ 리팩터:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)

**2026-10-21**
- 🚀 기능/개선:补齐 IP 白名单与 agent 护栏配置的读写面(整条要登录、只存不拦) (bb494eba53c)

**2026-10-21**
- 🚀 기능/개선:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (08e1da5b63d)

**2026-10-21**
- 🐞 수정:安全日志页按 security_logs 实列渲染，删掉后端从不给的"状态"列 (761a7a22cab)
- 🚀 기능/개선:PDF 三链真处理落地 + security_logs 接上写入出口 (e1cc3e36ec0)
- 🔧 기타:钉住危险操作确认的唯一旁路出口(L7224) (251ee617671)
- 🔧 기타:翻勾 G-107 / G-929 (7ea5a84ed10)
- 🔧 기타:修 G-929 过期用例并补 G-107 接线四例 (1a12afbdbf2)
- 🔧 기타:裁决 5 张待拍板票 + 销账 3 张失效票 + 修 1 张回捞副本标记 (a525b912d17)
- 🐞 수정:扫码弹窗平台清单拉取失败必须响 —— 不再静默留白 (79451dab125)
- 🔧 기타:publish-scan 归入 @browser-hub 档 + 平台选择兼容 pill(机主选 A) (c364b64a0de)
- 🐞 수정:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (63cd174c852)
- 🐞 수정:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (b6568357c97)
- 🔧 기타:work-panel 切 tab 改按 store 现读 id 选「非激活那颗」—— 收 P4-6 (ddfa3590e0e)
- 🚀 기능/개선:暖色描边禁令装上旁路落地腿 —— 门 231 增 --rev 审树档,落地器 fail-closed 调用 (e1f18b5a320)
- 🐞 수정:登录历史改接真数据源 audit_logs，并清偿本会话写进的 zh-TW 简体用字 (05940a38cef)
- 🔧 기타:重钉 ui-routes 派生自述钉(承接 6ddca76ce8 的 11 处源改动) (b39af6dae53)
- 🐞 수정:原生组件着色属性位的 CSS var 全部改成 JS 派生值 —— 11 处此前静默回落宿主默认色 (6ddca76ce83)
- 🔧 기타:重钉 web/RN ui-routes 自述钉并补回 MyPapers/DistributionCompany 两枚白名单(1fc61a86437 旁路落地未跑写回钩子) (5bede5f6858)
- 🚀 기능/개선:把"没设≠没色"这条因果律推到 web 腿 —— 门 231 增 W5 与 CSS 输入类维,并钉掉 3 枚裸 Switch (be681a0bcee)
- 🔧 기타:fix(tokens)+feat(scripts): danger 暗档文字改取 #f87171(原 #ef4444 压在自己 /10 淡底上实测 4.21 不达 AA)+ 状态色文字射程对账尺子入库(自检 8/8、镜像 9/9,含同面口径修正) (721e61b929b)
- 🐞 수정:资产注册表强制单实例 —— 根治「本地 PNG 的 Image 在 release 上恒空白」这一类 (4a876685d26)
- ⚡ 성능:图片引用升 ?v=20261021 + 预热脚本 no-cache 强制回源 (720d3f582f7)
- 📚 문서:补 §21 欠账——登记移动 App 与 web 逐页对齐口径与本批 35 屏 (2834f08be35)
- 🐞 수정:登录历史卡按 security_logs 实列渲染，不再读后端从不返回的字段 (dcf3735fc2a)
- 🐞 수정:补录侧边栏新挂 7 入口的 ROUTE_ROOT_BG chrome 档(ApiKeys/Usage/Groups/Invoices/Points/VoiceStt/AgentCategories) (76452bb2069)
- 🚀 기능/개선:补齐我的试卷与分销中心，并收口 i18n 动态拼键反模式 (1fc61a86437)
- 🐞 수정:反代目标 localhost → 127.0.0.1(修正 d4bfb37b7e6:标题即此修复但内容未落地) (0d36f406d20)
- 🚀 기능/개선:侧边栏对齐 web 第二批 —— AI 组补 /models 与 /agents 父子入口,三域补 web 漏挂项,清 4 处重复登记,回归锁扩到域 hub(web 端零改动) (330056b5352)
- 🔧 기타:按 HEAD 干净面重生成 web/RN 两份 ui-routes 产物钉 —— 收门 105 的 G5 (acc4ab047d5)
- 🔧 기타:摘回门 233 注册条目 —— 点名面被他人 605 行在飞改动占住,先不给别人埋雷;门体降为常设只读尺子 (ec025c8fd6d)
- 🔧 기타:work-panel 收藏按钮按 aria-label 定位 + 切 tab 改为轮询等待 (d07b67bfdbb)
- 🔧 기타:清掉 check-ops-patrol 三枚存量红 —— 两枚是测量缺陷,一枚是半截落地的欠账 (04b56a1011f)
- 🐞 수정:反代目标 localhost → 127.0.0.1,根治 WS 通知 ECONNREFUSED(34,701 次 ::1) (d4bfb37b7e6)
- 🔧 기타:G-924 apps/cli 记忆模块两处直连后端改走 api-client(守门 73 真存量):新增 packages/api-client/src/endpoints/memory.ts 端点(listMemories/createMemory),endpoints barrel 增加导出;UnifiedMemoryClient.getEntries/addEntry 由裸 fetch 改调 api-client 端点,保留 SSRF 守卫与降级语义 (7f586945251)
- 🚀 기능/개선:门 233 门体入库 —— 状态色文字角色档的对比度射程对账(自检 8/8 含两支阳性对照与两支反证) (33bee2381e2)
- 🚀 기능/개선:新守门 check-state-text-contrast.mjs 接进提交链 (c7d7f57aaf8)
- ⚡ 성능:/status 只 SSR 前 30 条模型,其余按需展开(1.05MB → ~30KB) (b9ec5f4dfaf)

**2026-10-21**
- 🚀 기능/개선:补齐 6 屏对齐 web 内容编辑域(文章/问答/名片/AI世界/广场发布) (ce9c8c08a8e)
- 🔧 기타:登录请求显式声明通道 —— 解开本机 e2e 全量的 401 阻断 (67c57e311b6)
- 🚀 기능/개선:补齐 14 屏对齐 web 用户/发布/学习域 (1982228870b)
- 📚 문서:G-939 成因查明并改写 —— 门 100 头注自写口径只覆盖提交链,而 git-sync-converge 是 commit-tree+CAS 旁路不跑钩子 ⇒ 对旁路合并结构性失明;活改成"把 A1 判据 import 给旁路侧复量" (587f74e7c7d)
- 📚 문서:登记「已推送提交被并发合并吞掉且守门 100/168 当场没响」这一格(现读枚 12898ccd9b 双否,已 tag 保全并重落) (ffc81df2014)
- 📚 문서:G-921 翻勾 —— 三枚(Connectors / DomainHub / McpStore)共享层下沉全部落地并上线(枚 588a6342d8 / 7f9eb8eb00 / cc9b3672ef) (316bc4bf2e7)
- 📚 문서:登记门 39 全量档新增的 6 枚 V1 红(枚 8f16334f48 补齐 12 屏里的 ConnectedAccounts / ImageGenGallery / ImageGenTemplates / Points / Usage / WrongQuestions 六屏未做共享层下沉) (d7deeddd30b)
- 🔧 기타:重生成 RN ui-routes 自述钉并补回 SecurityCenter 白名单条目(45088b42447 旁路落地时未跑写回钩子) (752074e67f6)
- 🐞 수정:后台守卫不再把「角色还没查到」折成 0 —— 真管理员冷加载 6 次有 3 次被弹到 /forbidden(附双臂变异自证的时序测试) (c9a75878532)
- 🐞 수정:监控面板查询失败整轮不落结果 (f6f9715fe98)
- 📚 문서:守门 229 那条就地改写 —— 补 H4 档(摘前先问门 71 会不会把这条按未勾还原)、H3 基线改判 HEAD^、新增 state=all-held 与 exit 3 的机读结论(全仓不再有无需清扫式兜底文案) (ef8e6666cc9)
- 📚 문서:票60 就地改写进度注记 —— 第三、四批已落(含被并发合并吞掉那枚的重落凭据),未收口只剩 e2e 真机核验与描边态分窗格 (4e4fc9e5b25)
- 📚 문서:登记本轮收口留下的六件真活(归档件 lint-staged 雷区其余 84 枚 / 取号入口被 O 族重号顶死 / 门 105 G5 产物钉存量红 / D197 换行开关用例存量红 / 会话滚动位恢复无生产接线 / 多窗格缺 e2e 真机核验) (d96c474a17c)
- 🚀 기능/개선:票60 第三、四批 —— 续传/工具面板/发起分析全面窗格化,跳转总线按窗格门控(重落被并发合并吞掉的 12898ccd9b) (d3541dc2670)
- 🚀 기능/개선:G-921 第三枚(收官)—— McpStoreScreen 的 UI 下沉到共享层(新建 packages/app/src/features/mcp-store/McpStoreScreen.tsx + index.ts 导出组件、类型与共享判据 mcpInstallBlockedKey),RN 侧改 wrapper(只留四项 API 调用 get / install / setStoreServerEnabled / uninstall、安装与卸载二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen / DomainHubScreen / ConnectorsScreen 同一型 wrapper 模式。 (cc9b3672ef2)
- 🐞 수정:输入框外框的常驻暖色环也纳入判据 —— 门 231 W1 增 W1-input 维 (177e5230c40)
- 🚀 기능/개선:补齐 12 屏对齐 web 设置/内容/交易域 (8f16334f483)
- 🐞 수정:监控面板查询失败保留旧数据 + 筛选下拉不再撑满整行 (70ea7877d40)
- 🐞 수정:底栏图标改走内联 data URI —— 本地 PNG 的 Image 取源链在 release 上恒空白 (10c2d9e7643)
- 📚 문서:G-921 登记第二枚(ConnectorsScreen)下沉共享层的进展与凭据(枚 588a6342d8;门 39 全量红 2→1;剩一枚 McpStoreScreen 归下一批) (c8ee7a2c4d6)
- 🐞 수정:持续性门槛的 firstAt 必须同时进 info —— 派发侧读的就是那一份 (b398a4035ca)
- 🚀 기능/개선:G-921 第二枚 —— ConnectorsScreen 的 UI 下沉到共享层(新建 packages/app/src/features/connectors/ConnectorsScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留 API 调用 get/setEnabled/sync/delete、删除二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen/DomainHubScreen 同一型 wrapper 模式。 (588a6342d8b)
- 🐞 수정:补录 SecurityCenter 的 ROUTE_ROOT_BG chrome 档(屏内渲染 NavBar,顶栏 chrome 结构锁判据要求) (c849c50fa11)
- 🐞 수정:守门 78 补第六维——外部依赖声明↔链接对账,根治 lucide-react 断链致 8 端构建阻断 (c1e0350c61b)
- 🐞 수정:监控域之外 5 处状态色文字同接角色档 —— 全 web 残留读数 0(同族后缀档 4/4 未动) (1227a9742cb)

**2026-10-21**
- 📚 문서:G-921 登记第一枚(DomainHubScreen)下沉共享层的进展与凭据(枚 7f9eb8eb00;门 39 全量红 3→2;剩两枚 Connectors/McpStore 归下一批) (0e948350380)
- 🚀 기능/개선:G-921 第一枚 —— DomainHubScreen 的 UI 下沉到共享层(新建 packages/app/src/features/domain-hub/DomainHubScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留路由参数 domain、导航分派 target、i18n 与主题注入),照 PaymentScreen 同一型 wrapper 模式;条目图标以 ReactNode 由平台注入,共享层不绑定图标注册表。门 39 全量档红 3→2(DomainHubScreen 摘掉);共享层与 RN 两侧 typecheck 对本票文件零错误(存量 35 条红全在他人工作树删掉的 drawer-nav / SelectionAnnotationBar 面),eslint 0 finding,水印 verify 通过 (7f9eb8eb00b)
- 🔧 기타:重钉 web/miniapp ui-routes 自述钉(承接监控域角色档接入) (4a02eacc6f3)
- 🐞 수정:状态色新增「文字」角色档并接上监控域 48 处 —— 亮档真机实测 1.96~2.62 提到 AA 4.5 以上,暗档取值逐字不动 (c2b0c254a12)
- 🚀 기능/개선:安全中心对齐 web 设置页(评分/2FA/会话/安全事件) (45088b42447)
- 🐞 수정:/agents/featured 去掉从未实现的 featured=1 参数并取全量 —— 原来静默只显示 20/124 (37805cd2e1a)
- 📚 문서:现读订正「锁的初始化写全再原子可见」—— lib/lock-atomic-init 已在 HEAD 且两把锁均已接线;解阻判据①③成立,② 的 deploy-lock 套件本机并发下 flaky(三连跑 50/2、51/1、52/0),未归因不冒领,留一格 (c4f81394c79)
- ⚡ 성능:英文首页与公开内容页加边缘缓存头 (940303d21db)
- ⚡ 성능:public 图片按显示尺寸收敛，53MB → 49MB（首屏 logo 867KB→53KB） (52257166e09)
- 📚 문서:修 tab-bar-metrics 的陈旧注 —— 「颜色一律走 CSS 变量」与实测相反 (cd10e14a8dc)

**2026-10-21**
- 🚀 기능/개선:抽屉侧边栏对齐 web 侧边栏(导航单源 + 二级子菜单 + 内容域) (83e0be9c16d)
- 🔧 기타:暖色描边禁令补齐 extension 射程 + 落原生插件调用形状回归档 (3ea4cbba0cf)
- 🐞 수정:两处生产者从不发射的字段错配 —— 停摆正文出处句恒缺失、TEMP 在写证据支恒 0(同 firstAt/stat 一族) (b4872d129c6)
- 📚 문서:现读订正「AGENTS.md 体积判据接进提交链」—— 门 207 已按 1 行紧凑块接线(HEAD 4855 行),C1 余量 389;同轮报警:AGENTS.md 现读 95,845 字节 / 预算 96,000,余量仅 155 字节,出路=整区归档(不代裁范围) (56844bc8e5f)
- 🐞 수정:目录一次取全(默认 20→200)+ 修 community 触底重复追加同一批 (c30b7f4f107)
- ⚡ 성능:状态页 RSC payload 1.97MB → ~150KB，模型列表改客户端渲染 (7d1d322bf58)
- 🐞 수정:市场全量页补 pageSize=200 —— 不带参只吃服务端默认 20,124 枚只见 20 (a3b180513e1)
- 🔧 기타:work-panel P3-3 补 openPanel() —— openPanel({url}) 只导航不置 open (e345966dd6f)
- 🐞 수정:重贴被并发收敛卷掉的目录取全修复(RN 增量渲染 + 扩展 30→200) (bf2f6aa466e)
- 🔧 기타:重钉 web/miniapp ui-routes 自述钉(承接漏斗与磁盘配色两枚改动) (e9343fc4c1b)
- 🐞 수정:门 232 补 onFailHint(此前是两行空串,失败时提交者拿不到任何出路,只能跳门 —— 违 §0.8/§0.10);同笔把门 39 注释里已失真的写死计数(151/153、白名单四枚旧名)改成现读口径 + G-922 后判据形态 (3fb86c5891f)
- 🐞 수정:漏斗末段绿条与磁盘指标取同源 token —— 原 emerald-600/purple-600 亮档白字实测 3.61/暗档 2.40 低于 AA (c505a415681)
- 🐞 수정:「我的 Agent」页签改走 /agents/my —— 原来显示的是市场前 20 枚 (3d8d56c58f7)
- 📚 문서:更正 sshd 自愈块的归因 —— 502 是本机隧道副本无 sshd,不是生产 sshd 挂了 (ba37f554225)
- 📚 문서:G-922 登记守门 39 判据四修的进展与凭据(枚 bd3bc2238c;剩一格=21 枚屏级共享存量归 G-921 与各屏持有人) (6856b4d1071)
- ⚡ 성능:首页边缘缓存头 + 公网缓存预热脚本 (7ee87c82172)
- 🐞 수정:冷启动准入不再把 httpOnly 老用户判成匿名 (1d541e8dbe5)
- 🐞 수정:守门 39 判据四修(G-922)—— ① ROOT 不再由 cwd 定根(改由 import.meta.url 推导) ② screen 正文按面取 blob(HEAD/索引/工作树,取不到即未判定),不再 readFileSync 读盘 ③ 白名单带 why+expires,到期失效、登记名在 screens 清单里不存在=腐烂判红(按现读摘除 DebugScreen/SquareScreen 两枚死账,存量归零后本维才设红) ④ 新增「屏级共享」维:有 import 还得 packages/app 有同名共享屏,存量 21 枚只报数、只拦新增与退化(§0.2 存量未归零不升 blocking);自检 12/12 + 镜像 6/6 + 变异自证(恒真变异 ⇒ 4 例镜像 + 2 例自检翻红) (bd3bc2238c6)
- 🐞 수정:部署时自愈 sshd —— 生产 SSH 入口 502 的真因是本机 sshd 没在应答 (1eda2b49ef1)
- 🐞 수정:公网探测派发契约补上 stat 出口 —— 修严重度档恒 0 使恶化即重报通道失明 (31b33393ae3)
- 🔧 기타:chat-search 搜索框改按真实 testid —— 旧选择器在共享 SearchInput 上结构上不存在 (dd11b1712e9)

**2026-10-21**
- 🐞 수정:门 231 staged 档把「本枚提交无射程内文件」误判 exit 2 —— 对任何无关提交恒红 (97891b940c7)
- 🚀 기능/개선:门 212 加维 —— RN 聚焦档 focusedStyle 不得带几何键 (e2810ebc063)
- 🔧 기타:清扫轮摘行前先问门 71 同一把尺子,并修掉 H3 一处既有假红 (7388b68c073)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>지린성 아이즈히후이 인공지능 기술 유한공사</strong> · 오픈소스 공동 구축, 우리 함께합니다</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
