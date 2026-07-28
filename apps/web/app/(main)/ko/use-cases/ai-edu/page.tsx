import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, GraduationCap, AlertTriangle, Wrench, MessageSquare, Palette, Globe, Lightbulb } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/ko/use-cases/ai-edu#webpage',
      url: 'https://ihui.ai/ko/use-cases/ai-edu',
      name: 'AI 스마트 교육 Agent 사용 사례 — IHUI AI',
      description:
        'IHUI AI 풀스택 AI OS 기반의 AI 스마트 교육 Agent:개인화 학습 경로, 지능형 Q&A, 문제 생성 및 채점, 학습 데이터 분석, 교무 협업, 가정보校 소통. 30분 온보딩, 8엔드포인트 배포.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/ko/use-cases/ai-edu#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '사용 사례', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 교육', item: 'https://ihui.ai/ko/use-cases/ai-edu' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://ihui.ai/ko/use-cases/ai-edu#howto',
      name: '30분 만에 AI 스마트 교육 Agent 구축',
      description:
        'IHUI AI 풀스택 AI OS에서 AI 스마트 교육 Agent를 구축하는 6단계:학생 데이터 설정 → 학습 경로 모델 학습 → 문제집 통합 → 채점 규칙 설정 → 분석 활성화 → 가정보校 연결. 100% 개인화 커버리지.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '학생 데이터 / 문제집 / 교과서 / 교무 자료' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 개인화 학습 경로 엔진' },
        { '@type': 'HowToTool', name: 'IHUI AI 스마트 문제집 모듈' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '학생 데이터 설정', text: '과거 성적/과제/학습 행동을 임포트, AI가 학생 프로필과 강점/약점을 파악합니다.' },
        { '@type': 'HowToStep', position: 2, name: '학습 경로 학습', text: '지식 그래프와 과거 데이터로 개인화 경로 모델 학습, 학생별 일/주간 계획을 자동 생성합니다.' },
        { '@type': 'HowToStep', position: 3, name: '문제집 통합', text: '학교/지역/타 문제집(K12/어학/직업 훈련)을 연결, AI가 학생 레벨에 맞는 테스트를 자동 생성합니다.' },
        { '@type': 'HowToStep', position: 4, name: '채점 규칙 설정', text: '객관식/주관식(작문/자유 기술) 규칙 설정, Agent가 24시간 채점, 주관식 85% 이상 정확도.' },
        { '@type': 'HowToStep', position: 5, name: '분석 활성화', text: '반/학년/과목 데이터 집계, 학습 리포트 자동 생성, 공통 약점 발견으로 교무를 지원합니다.' },
        { '@type': 'HowToStep', position: 6, name: '가정보校 소통', text: 'WeChat/DingTalk/WeCom 학부모 앱 연결, 주간 리포트/과제/진도 하이라이트 자동 전송.' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 스마트 교육 — 개인화/지능형 Q&A/가정보校 | IHUI AI',
  description:
    'IHUI AI로 AI 스마트 교육 Agent 구축:개인화 학습 경로 + 24시간 Q&A + 문제 생성 채점 + 학습 분석 + 교무 협업 + 가정보校 소통. 30분 온보딩, 8엔드포인트 배포.',
  alternates: { canonical: '/ko/use-cases/ai-edu' },
  openGraph: {
    title: 'AI 스마트 교육 Agent — IHUI AI',
    description: '개인화 학습 + Q&A + 채점, 30분 온보딩.',
    url: 'https://ihui.ai/ko/use-cases/ai-edu',
    type: 'article',
  },
}

const problems = [
  '대규모 학급(40-60명)에서 맞춤 학습이 어려우며, 빠른 학생은 부족함을 느끼고 느린 학생은 뒤처짐',
  '방과 후 Q&A가 교사 온라인 시간에 의존, 저녁과 주말에 질문이 쌓여 학습 연속성이 훼손됨',
  '채점(특히 작문/주관식)이 교사 시간을 잡아먹어, 피드백 지연으로 오류 수정 효과 약화',
  '학생 데이터(성적/과제/수업 행동)가 시스템별로 분산, 종합 분석이 어려워 교무 진행이 느림',
  '교무 협업(교안/슬라이드/문제)에 통합 플랫폼이 부재, 고품질 자원 공유가 학교/지역 간에 어려움',
  '가정보校 소통이 면담과 WeChat 그룹에 의존, 정보 비대칭으로 학부모가 학생 상황을 적시에 파악하기 어려움',
]

const capabilities = [
  { title: '개인화 학습 경로', desc: '지식 그래프와 학생 프로필로 일/주간 계획을 동적 생성, 빠른 학생은 확장 문제, 느린 학생은 집중 보충, 차별화 교수를 스케일화.' },
  { title: '24시간 지능형 Q&A', desc: 'AI Q&A Agent가 교과 지식 그래프와 과거 Q&A로 상시 응답, 30초 이내 답변, K12 92% 정확도로 주요 과목 커버.' },
  { title: '스마트 문제 생성/채점', desc: '문제집 통합으로 학생 레벨에 맞는 테스트 자동 생성, 객관식은 즉시 채점, 주관식(작문/기술) 85% 이상 정확도 채점, 교사 업무 70% 절감.' },
  { title: '학습 데이터 분석', desc: '반/학년/과목 데이터 집계, 학습 리포트 자동 생성, 공통 약점 발견, 데이터 기반 교무 지원.' },
  { title: '교무 협업', desc: '교안/슬라이드/문제/성찰 일원화 관리, 학교/지역 간 공유로 고품질 자원 재사용률을 30%에서 75%로 향상.' },
  { title: '가정보校 소통', desc: 'WeChat/DingTalk/WeCom 학부모 앱 연결, 주간 리포트/과제/진도 자동 전송, 학부모 만족도 60% 향상.' },
]

const cases = [
  {
    title: '지역 교육국:3만 명 학생 개인화 학습',
    desc: '중국 某 시 지역 교육국이 32개 학교 3만 명 학생에 AI 스마트 교육 Agent를 도입, 월 280만 건 Q&A 처리, 채점 효율 8배 향상, 교사 맞춤 멘토링 시간 35% 증가.',
  },
  {
    title: 'K12 교육 기관:재등록률 +25%',
    desc: '某 주요 K12 교육 기관이 AI 스마트 교육 Agent 활용, 주간 학습 리포트로 학부모가 진도를 확인, 재등록률 62%에서 87%로 상승, 학부모 불만 70% 감소.',
  },
  {
    title: '대학:교양 과목 24시간 Q&A 커버리지',
    desc: '某 985 대학이 교양 과목(미적분/영어/컴퓨터 기초)에 AI Q&A Agent 활용, 학생 질문 30초 이내 답변, 교사는 반복 Q&A에서 해방되어 수업 설계에 집중, 합격률 18% 상승.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 엔드 교무 관리 콘솔과 학습 대시보드' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 엔드 학생 데이터 보관과 권한 격리' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '개인화 + Q&A + 주관식 채점 엔진' },
  { name: 'MCP 도구 프로토콜', purpose: '문제집/교과서/학습 시스템/가정보校 플랫폼 어댑터' },
  { name: 'Tauri 2 데스크톱', purpose: '교사 오프라인 교안 준비와 로컬 문제집' },
  { name: 'WXT 브라우저 확장', purpose: '교무 사이트/문제집 원클릭 수집' },
  { name: 'Taro 4 미니프로그램', purpose: '학생 사진 문제 검색과 학부모 학습 리포트' },
  { name: 'CLI 명령행', purpose: '문제집 일괄 임포트와 학생 데이터 내보내기' },
]

const metrics = [
  { value: '100%', label: '개인화 커버리지' },
  { value: '70%', label: '교사 업무 절감' },
  { value: '92%', label: 'Q&A 정확도' },
  { value: '30min', label: '온보딩 시간' },
]

export default function AiEduPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            스마트 교육
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI 스마트 교육:모든 학생을 위한 개인화 학습 경로
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 배포, Apache 2.0 오픈소스, 온프레미스 지원, K12/고등교육/직업 훈련 시나리오 커버.
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
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">교육 현장이 직면한 과제</h2>
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
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 소스 통합, 핵심 컴포넌트 모두 오픈소스, K12/고등교육/직업 훈련 시나리오 커버.
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
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">AI 스마트 교육 어시스턴트 구축을 시작하세요</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            가입 시 1000 크레딧 증정, 스마트 교육 시나리오 템플릿에서 원클릭 fork, 30분 만에 개인화 학습을 체험.
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 교육 상담 8801</span>
            <span className="flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> 교무 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />校内 도입 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 지역 솔루션 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
