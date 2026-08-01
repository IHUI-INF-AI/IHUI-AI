import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Languages, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/ko/use-cases/ai-translation#webpage',
      url: 'https://aizhs.top/ko/use-cases/ai-translation',
      name: 'AI 다국어 번역 Agent 사용 사례 — IHUI AI',
      description:
        'IHUI AI 풀스택 AI OS 기반의 AI 다국어 번역 Agent:다국어 문서 번역, 로컬라이제이션 워크플로우, 용어집 관리, 번역 리뷰, 문화 적응, 자막 번역. 30분 온보딩, 8엔드포인트 배포.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/ko/use-cases/ai-translation#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '사용 사례', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 번역', item: 'https://aizhs.top/ko/use-cases/ai-translation' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/ko/use-cases/ai-translation#howto',
      name: '30분 만에 AI 다국어 번역 Agent 구축',
      description:
        'IHUI AI 풀스택 AI OS에서 AI 다국어 번역 Agent를 구축하는 6단계:용어집 구축 → 번역 메모리 업로드 → 대상 언어 설정 → 문화 적응 학습 → 리뷰 규칙 설정 → 워크플로우 연결. 번역 효율 6배, 비용 70% 절감.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '용어집 / 번역 메모리 / 브랜드 톤 문서 / 대상 언어 목록' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 다국어 번역 엔진' },
        { '@type': 'HowToTool', name: 'IHUI AI 용어집 관리 모듈' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '용어집 구축', text: '제품/브랜드/업계 용어를 50+ 언어로 등록, Agent가 용어 일관성을 엄격히 지키고 번역 분산을 방지합니다.' },
        { '@type': 'HowToStep', position: 2, name: '번역 메모리 업로드', text: '과거 고품질 대역 문서를 업로드, Agent가 팀 문체를 학습하여 AI 산출물이 과거 번역 스타일을 따르도록 합니다.' },
        { '@type': 'HowToStep', position: 3, name: '대상 언어 설정', text: '50+ 주요 언어 (번체/간체 지역 변형 포함) 선택, 원클릭 일괄 번역 시작.' },
        { '@type': 'HowToStep', position: 4, name: '문화 적응 학습', text: '대상 시장의 문화 관습 (일본어 경어, 아랍어 RTL, 스페인 라틴아메리카/스페인 변형)에 맞게 번역을 미세 조정, 문화 마찰 회피.' },
        { '@type': 'HowToStep', position: 5, name: '리뷰 규칙 설정', text: '용어 일관성/숫자 형식/날짜 형식/단위 환산/민감어 규칙 설정, Agent가 의심스러운 번역을 자동 플래그.' },
        { '@type': 'HowToStep', position: 6, name: '워크플로우 연결', text: 'Git/CMS/Confluence/Notion/Figma 등 콘텐츠 소스 연결, 번역 업데이트 자동 동기화, 사람은 중요 콘텐츠만 최종 리뷰.' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 다국어 번역 — 문서/로컬라이제이션/용어집/자막 | IHUI AI',
  description:
    'IHUI AI로 AI 다국어 번역 Agent 구축:문서 번역 + 로컬라이제이션 워크플로우 + 용어집 관리 + 번역 리뷰 + 문화 적응 + 자막 번역. 30분 온보딩, 8엔드포인트 배포.',
  alternates: { canonical: '/ko/use-cases/ai-translation' },
  openGraph: {
    title: 'AI 다국어 번역 Agent — IHUI AI',
    description: '다국어 번역 + 용어집 + 문화 적응, 30분 온보딩.',
    url: 'https://aizhs.top/ko/use-cases/ai-translation',
    type: 'article',
  },
}

const problems = [
  '해외 진출에 10+ 언어 로컬라이제이션이 필요하며, 외주 인력 번역 비용이 높음 (1000자당 0.3-1.5 CNY × 10개 언어)',
  '제품 용어/브랜드명이 언어 버전마다 번역이 분산되어 사용자 인식이 혼란스러움',
  '문서(API/도움말/매뉴얼) 업데이트 후 번역본이 지연되어 사용자 경험이 단절됨',
  '마케팅 카피 번역에 문화 적응이 부족하여 직역이 대상 시장의 반감을 사는 문화 마찰 빈번',
  '자막/UI 텍스트/PDF/Word/Markdown/JSON 등 다중 형식 번역에 도구 수동 전환이 번거로움',
  '번역 품질이 소수의 시니어 번역자에 의존하여 생산성이 제한되고 인력 변동 리스크도 큼',
]

const capabilities = [
  { title: '50+ 언어 문서 번역', desc: '50+ 주요 언어(중/영/일/한/프/독/서/러/아랍/포/이/번간체) 지원, Word/PDF/Markdown/JSON/CSV 등 일괄 번역, 용어 일관성 99%.' },
  { title: '로컬라이제이션 워크플로우', desc: 'Git/CMS/Confluence/Notion 등 콘텐츠 소스 연결, 소스 업데이트 시 자동 번역 트리거, 사람은 중요 콘텐츠만 최종 리뷰.' },
  { title: '용어집 관리', desc: '다국어 용어집 구축, AI가 용어 일관성 엄격 준수, 브랜드명/제품명/기술 용어 오역 제로, TM(번역 메모리)을 프로젝트 횡단 재사용.' },
  { title: '스마트 번역 리뷰', desc: '용어 일관성/숫자/날짜/단위 환산/민감어 규칙 설정, Agent가 의심스러운 번역 자동 플래그, 사람 리뷰 75% 절감.' },
  { title: '문화 적응', desc: '대상 시장의 문화 관습(일본어 경어 위계, 아랍어 RTL, 스페인 라틴아메리카/스페인 변형)에 따라 표현 자동 조정, 문화 마찰 회피.' },
  { title: '자막 번역', desc: '영상 자막 SRT/VTT 파일을 파싱하여 번역, 타임라인 자동 정렬, 다국어 자막 버전 내보내기, 자막 번역 효율 8배.' },
]

const cases = [
  {
    title: '해외 진출 SaaS:로컬라이제이션 비용 -70%',
    desc: '중국발 SaaS가 12개국(미/일/한/독/프/서/러/아랍 등)에 진출, AI 번역 Agent로 로컬라이제이션 연간 비용 240만 CNY에서 72만 CNY로 절감, 번역 업데이트 사이클 2주에서 2일로 단축.',
  },
  {
    title: '크로스보더 커머스:상품 다국어 등록 6배',
    desc: '某 크로스보더 커머스 플랫폼이 AI 번역 Agent 도입, 상품 정보(제목/상세/사양)를 10개 언어로 일괄 번역, 신규 상품 등록 시간 1.5일에서 6시간으로 단축, GMV 38% 성장.',
  },
  {
    title: '온라인 교육:자막 로컬라이제이션 1일 8개 언어',
    desc: '某 온라인 교육 플랫폼의 1000+ 강의 영상이 AI 자막 번역 도입, 8개 언어(일/한/영/서/포/러/아/프) 자막 로컬라이제이션 기간 30일에서 1일로 단축, 해외 유료 전환율 52% 향상.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 엔드 번역 워크벤치와 용어집 관리' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 엔드 번역 메모리(TM)와 프로젝트 버전 관리' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '다국어 번역 + 문화 적응 + 리뷰 규칙 엔진' },
  { name: 'MCP 도구 프로토콜', purpose: 'Git/CMS/Confluence/Notion/Figma 콘텐츠 소스 어댑터' },
  { name: 'Tauri 2 데스크톱', purpose: '로컬 문서 번역 + 오프라인 용어집' },
  { name: 'WXT 브라우저 확장', purpose: '웹 원클릭 번역과 용어 하이라이트' },
  { name: 'Taro 4 미니프로그램', purpose: '모바일 문서 사진 번역' },
  { name: 'CLI 명령행', purpose: '문서 일괄 번역과 CI/CD 연동' },
]

const metrics = [
  { value: '50+', label: '지원 언어' },
  { value: '6×', label: '번역 효율' },
  { value: '70%', label: '비용 절감' },
  { value: '30min', label: '온보딩 시간' },
]

export default function AiTranslationPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Languages className="h-3.5 w-3.5 text-primary" />
            다국어 번역
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 다국어 번역:50+ 언어 로컬라이제이션, 비용 70% 절감
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 배포, Apache 2.0 오픈소스, 온프레미스 지원, 용어집 + 문화 적응으로 번역 품질 보장.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-primary min-[768px]:text-3xl">{m.value}</div>
                <div className="mt-1 text-xs text-muted-foreground min-[768px]:text-sm">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 문제점 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 min-[768px]:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">해외 진출 팀의 로컬라이제이션 과제</h2>
          </div>
          <ul className="mt-6 space-y-3">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground min-[768px]:text-base">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* 능력 */}
        <section className="mt-16">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">6대 핵심 능력</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
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
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 min-[768px]:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">고객 도입 사례</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-3">
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
            <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">기술 스택과 툴체인</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground min-[768px]:text-base">
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 소스 통합, 핵심 컴포넌트 모두 오픈소스, Git/CMS/Confluence/Notion과 깊이 통합.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-4">
            {toolchain.map((t, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5">
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 문의 / CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">AI 다국어 번역 어시스턴트 구축을 시작하세요</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            가입 시 1000 크레딧 증정, 번역 시나리오 템플릿에서 원클릭 fork, 30분 만에 다국어 일괄 번역을 체험.
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 번역 상담 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 용어집 트레이닝 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 온프레미스 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 언어 확장 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
