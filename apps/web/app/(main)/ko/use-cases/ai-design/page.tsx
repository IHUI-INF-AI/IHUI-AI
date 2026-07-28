import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, PaintBucket, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/ko/use-cases/ai-design#webpage',
      url: 'https://aizhs.top/ko/use-cases/ai-design',
      name: 'AI 디자인 협업 Agent 사용 사례 — IHUI AI',
      description:
        'IHUI AI 풀스택 AI OS 기반의 AI 디자인 협업 Agent:포스터/Logo 콘셉트, UI 스케치를 코드로, 브랜드 자산 관리, 디자인 리뷰, 디자인 시스템 검색. 30분 온보딩, 8엔드포인트 배포.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/ko/use-cases/ai-design#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '사용 사례', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 디자인', item: 'https://aizhs.top/ko/use-cases/ai-design' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/ko/use-cases/ai-design#howto',
      name: '30분 만에 AI 디자인 협업 Agent 구축',
      description:
        'IHUI AI 풀스택 AI OS에서 AI 디자인 협업 Agent를 구축하는 6단계:브랜드 자산 업로드 → 디자인 시스템 설정 → 콘셉트 생성 학습 → 스케치를 코드로 → 리뷰 규칙 설정 → 협업 도구 연결. 디자인 사이클 60% 단축.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '브랜드 VI 매뉴얼 / 과거 디자인 초안 / 디자인 시스템 토큰' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 디자인 콘셉트 엔진' },
        { '@type': 'HowToTool', name: 'IHUI AI 스케치-투-코드 모듈' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '브랜드 자산 업로드', text: '브랜드 VI/과거 포스터/Logo/디자인 시스템 토큰 업로드, AI가 팔레트/폰트/레이아웃을 추출합니다.' },
        { '@type': 'HowToStep', position: 2, name: '디자인 시스템 설정', text: 'Figma 토큰(컬러/폰트 크기/스페이싱/라운드/섀도우) 임포트, 이후 모든 생성이 디자인 시스템을 엄격히 준수합니다.' },
        { '@type': 'HowToStep', position: 3, name: '콘셉트 생성 학습', text: '과거 히트 포스터/Logo로 학습, AI가 브랜드 톤에 맞는 3-5개 크리에이티브 방향을 제안합니다.' },
        { '@type': 'HowToStep', position: 4, name: '스케치를 코드로', text: '수기 UI 스케치 업로드, Agent가 컴포넌트 구조 인식, 85% 이상 정확도로 React + Tailwind 코드를 생성합니다.' },
        { '@type': 'HowToStep', position: 5, name: '리뷰 규칙 설정', text: 'a11y/브랜드 일관성/반응형 규칙 설정, Agent가 디자인 자동 리뷰, 필요한 변경을 플래그합니다.' },
        { '@type': 'HowToStep', position: 6, name: '협업 도구 연결', text: 'Figma/Sketch/即时设计/兰호/Notion을 통합, AI가 기존 워크플로우에 임베드됩니다.' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 디자인 협업 — 콘셉트 / 스케치를 코드로 / 리뷰 | IHUI AI',
  description:
    'IHUI AI로 AI 디자인 협업 Agent 구축:포스터/Logo 콘셉트 + UI 스케치를 코드로 + 브랜드 자산 관리 + 디자인 리뷰 + 디자인 시스템 검색. 30분 온보딩, 8엔드포인트 배포.',
  alternates: { canonical: '/ko/use-cases/ai-design' },
  openGraph: {
    title: 'AI 디자인 협업 Agent — IHUI AI',
    description: '콘셉트 + 스케치를 코드로 + 리뷰, 30분 온보딩.',
    url: 'https://aizhs.top/ko/use-cases/ai-design',
    type: 'article',
  },
}

const problems = [
  '포스터/배너/Logo 콘셉트 회의에 시간이 많이 소요, 디자이너 1인당 주 5-8개 콘셉트만 제공',
  '수기 스케치를 코드로 옮길 때 디자이너/개발자 왕복으로 주 3일 이상 소요',
  '디자인 시스템(컬러/폰트/스페이싱)이 디자이너마다 일관성 깨짐, 코드와 디자인 싱크 불일치',
  '브랜드 자산을 Figma/사내 NAS/로컬 PC에 분산 관리, 검색과 재사용 효율 저하',
  '디자인 리뷰가 수동으로 진행, a11y/반응형/브랜드 규칙 위반이 출품 후 발견됨',
  '디자인-개발 핸드오프에서 CSS 변수/컴포넌트 매핑이 누락되어 재작업 빈번',
]

const capabilities = [
  { title: '포스터/Logo 콘셉트', desc: '과거 히트 디자인과 브랜드 VI로 학습, AI가 3-5개 콘셉트 방향 자동 제안, 디자이너는 다듬기만 하면 됨, 콘셉트 효율 5배 향상.' },
  { title: 'UI 스케치를 코드로', desc: '수기 UI 스케치를 업로드, Agent가 컴포넌트 구조 인식, 85% 이상 정확도로 React + Tailwind 코드 생성, 개발자 왕복 70% 감소.' },
  { title: '디자인 시스템 통합', desc: 'Figma 토큰(컬러/폰트/스페이싱/라운드/섀도우)을 임포트, 이후 모든 생성이 디자인 시스템 엄격 준수, 일관성 99%.' },
  { title: '브랜드 자산 관리', desc: 'Figma/사내 NAS/로컬 PC 자산을 통합 검색, AI가 사용 시나리오에 따라 자산을 자동 추천, 자산 재사용률 60% 향상.' },
  { title: '스마트 디자인 리뷰', desc: 'a11y/브랜드 일관성/반응형 규칙 설정, Agent가 디자인 자동 리뷰, 출품 전 위반 사항 플래그, 리뷰 시간 80% 단축.' },
  { title: '디자인-개발 핸드오프', desc: 'Figma 컴포넌트와 코드 컴포넌트 매핑 자동 생성, CSS 변수/Props 자동 동기화, 핸드오프 재작업 90% 감소.' },
]

const cases = [
  {
    title: '브랜드 디자인팀:콘셉트 산출 5배',
    desc: '某 신소비재 브랜드 디자인팀 8명이 AI 디자인 Agent 도입, 주 콘셉트 산출 5개에서 25개로 5배 향상, 디자인 승인 주기 7일에서 2일로 단축.',
  },
  {
    title: 'SaaS 프론트엔드:스케치를 코드로 70% 시간 절약',
    desc: '某 SaaS 회사 프론트엔드 팀이 AI 디자인 Agent의 스케치를 코드로 기능 활용, 디자이너-개발자 왕복 70% 감소, 신규 페이지 출시 주기 12일에서 4일로 단축.',
  },
  {
    title: '디자인 에이전시:리뷰 효율 80% 향상',
    desc: '某 디자인 에이전시가 AI 디자인 Agent의 스마트 리뷰 활용, 프로젝트당 리뷰 라운드 평균 3.5회에서 1.2회로 감소, 고객 만족도 92%.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 엔드 디자인 콘솔과 컴포넌트 庫' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 엔드 디자인 자산과 버전 관리' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '콘셉트 생성 + 스케치를 코드로 + 리뷰 엔진' },
  { name: 'MCP 도구 프로토콜', purpose: 'Figma/Sketch/即时设计/兰호/Notion 어댑터' },
  { name: 'Tauri 2 데스크톱', purpose: '오프라인 디자인 에디터와 로컬 자산 庫' },
  { name: 'WXT 브라우저 확장', purpose: '웹페이지 디자인 원클릭 수집과 리뷰' },
  { name: 'Taro 4 미니프로그램', purpose: '모바일 디자인 미리보기와 팀 승인' },
  { name: 'CLI 명령행', purpose: '디자인 자산 일괄 임포트 + 코드 생성' },
]

const metrics = [
  { value: '5×', label: '콘셉트 산출' },
  { value: '70%', label: '스케치를 코드로 시간 절약' },
  { value: '85%+', label: '코드 정확도' },
  { value: '30min', label: '온보딩 시간' },
]

export default function AiDesignPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <PaintBucket className="h-3.5 w-3.5 text-primary" />
            디자인 협업
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI 디자인 협업:콘셉트 + 스케치를 코드로 + 리뷰
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 배포, Apache 2.0 오픈소스, 온프레미스 지원, 디자인 시스템과 브랜드 자산 통합.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-primary md:text-3xl">{m.value}</div>
                <div className="mt-1 text-xs text-muted-foreground md:text-sm">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 문제점 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 md:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">디자인 팀의 실제 페인 포인트</h2>
          </div>
          <ul className="mt-6 space-y-3">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* 능력 */}
        <section className="mt-16">
          <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">6대 핵심 능력</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c, i) => (
              <div key={c.title} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 사례 */}
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 md:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">고객 도입 사례</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {cases.map((cs, i) => (
              <div key={i} className="rounded-2xl border bg-card p-6">
                <h3 className="text-base font-semibold">{cs.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cs.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 툴체인 */}
        <section className="mt-16">
          <div className="flex items-center justify-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">기술 스택과 툴체인</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground md:text-base">
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 소스 통합, Figma/Sketch/即时设计/兰호/Notion과 깊이 통합.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {toolchain.map((t, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5">
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 문의 / CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center md:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">AI 디자인 협업 어시스턴트 구축을 시작하세요</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            가입 시 1000 크레딧 증정, 디자인 시나리오 템플릿에서 원클릭 fork, 30분 만에 콘셉트 생성을 체험.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sso/register"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              무료 가입
            </Link>
            <Link
              href="/use-cases"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium hover:bg-accent"
            >
              다른 사용 사례 보기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 디자인 상담 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 시스템 트레이닝 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 온프레미스 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 도구 확장 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
