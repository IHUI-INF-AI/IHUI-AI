import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Megaphone, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/ko/use-cases/ai-marketing#webpage',
      url: 'https://ihui.ai/ko/use-cases/ai-marketing',
      name: 'AI 마케팅 콘텐츠 생성 Agent 사용 사례 — IHUI AI',
      description:
        'IHUI AI 풀스택 AI OS 기반의 AI 마케팅 콘텐츠 생성 Agent:멀티 플랫폼 카피 (XHS/Douyin/Weibo/WeChat/LinkedIn), SEO 블로그, 브랜드 톤 일관성, A/B 테스트, 페르소나 기반 콘텐츠. 30분 온보딩, 8엔드포인트 배포.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/ko/use-cases/ai-marketing#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '사용 사례', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 마케팅', item: 'https://ihui.ai/ko/use-cases/ai-marketing' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://ihui.ai/ko/use-cases/ai-marketing#howto',
      name: '30분 만에 AI 마케팅 콘텐츠 생성 Agent 구축',
      description:
        'IHUI AI 풀스택 AI OS에서 AI 마케팅 콘텐츠 생성 Agent를 구축하는 6단계:브랜드 가이드 업로드 → 톤 모델 학습 → 멀티 플랫폼 API 연결 → A/B 테스트 설정 → 페르소나 임포트 → 데이터 피드백. 콘텐츠 산출 10배.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '브랜드 가이드 / 과거 히트 글 / 제품 매뉴얼 / 타겟 페르소나' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 멀티 플랫폼 카피 엔진' },
        { '@type': 'HowToTool', name: 'IHUI AI 브랜드 톤 모듈' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '브랜드 가이드 업로드', text: '브랜드 스토리/톤 문서/과거 히트 글을 업로드, AI가 어조와 금기 표현을 학습합니다.' },
        { '@type': 'HowToStep', position: 2, name: '톤 모델 학습', text: '과거 브랜드 콘텐츠로 LLM을 미세 조정, 수동 리뷰 80% 감소하면서도 브랜드 정체성 유지.' },
        { '@type': 'HowToStep', position: 3, name: '멀티 플랫폼 API 연결', text: 'XHS/Douyin/Weibo/WeChat/LinkedIn/Twitter Open API를 원클릭 연결, 도구 전환 불필요.' },
        { '@type': 'HowToStep', position: 4, name: 'A/B 테스트 설정', text: '주제별 3-5개의 제목과 커버 후보 자동 생성, Agent가 A/B 테스트 실행, 72시간 내 고CTR 버전 식별.' },
        { '@type': 'HowToStep', position: 5, name: '페르소나 임포트', text: 'CRM의 페르소나(연령/지역/소비력/관심사)를 임포트, Agent가 어조/각도/CTA를 자동 매칭, 전환율 35% 향상.' },
        { '@type': 'HowToStep', position: 6, name: '데이터 피드백', text: '플랫폼 지표(조회/좋아요/전환)를 가져오고, AI가 고성과 패턴을 리뷰하여 다음 생성에 반영합니다.' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 마케팅 콘텐츠 생성 — 멀티 플랫폼 / SEO / A/B | IHUI AI',
  description:
    'IHUI AI로 AI 마케팅 콘텐츠 생성 Agent 구축:멀티 플랫폼 카피 + SEO 블로그 + 브랜드 톤 일관성 + A/B 테스트 + 페르소나 기반. 30분 온보딩, 8엔드포인트 배포.',
  alternates: { canonical: '/ko/use-cases/ai-marketing' },
  openGraph: {
    title: 'AI 마케팅 콘텐츠 생성 Agent — IHUI AI',
    description: '멀티 플랫폼 카피 + SEO + A/B, 30분 온보딩.',
    url: 'https://ihui.ai/ko/use-cases/ai-marketing',
    type: 'article',
  },
}

const problems = [
  '멀티 플랫폼(XHS/Douyin/Weibo/WeChat/LinkedIn) 카피 톤이 분산되어 브랜드 일관성이 깨짐',
  'SEO 블로그/뉴스레터 발행 빈도가 낮아 자연 유입이 정체',
  '광고 카피 A/B 테스트를 사람이 수동으로 굴려 시간 소요, 학습 사이클이 느림',
  '페르소나가 CRM에 흩어져 있어 콘텐츠 각도 매칭이 어려워 전환율이 낮음',
  '과거 히트 콘텐츠를 자산화하지 못해 매번 0에서 시작, 콘텐츠 제작 ROI가 낮음',
  '콘텐츠 성과(조회/좋아요/전환) 피드백이 다음 생성에 반영되지 않아 개선 사이클이 끊김',
]

const capabilities = [
  { title: '멀티 플랫폼 카피 생성', desc: 'XHS/Douyin/Weibo/WeChat/LinkedIn 등 6대 메인 플랫폼의 톤 규칙을 내장, 원클릭으로 6개 버전 카피를 생성, 톤 일치율 95% 이상.' },
  { title: 'SEO 블로그 자동 생성', desc: '키워드 트렌드와 경쟁사 콘텐츠 갭을 분석, SEO 친화적 블로그 자동 생성, 자연 유입 40% 향상.' },
  { title: '브랜드 톤 일관성', desc: '브랜드 가이드/과거 히트 글 기반 LLM 미세 조정, 산출물이 브랜드 정체성과 일치, 수동 리뷰 80% 감소.' },
  { title: 'A/B 테스트 자동화', desc: '주제당 3-5개의 제목/커버 후보 생성, Agent가 A/B 테스트 실행, 72시간 내 고CTR 버전 식별, 카피 학습 사이클 5배 가속.' },
  { title: '페르소나 기반 콘텐츠', desc: 'CRM 페르소나 임포트, Agent가 자동으로 어조/각도/CTA를 매칭, 전환율 35% 향상.' },
  { title: '성과 피드백 루프', desc: '플랫폼 지표 자동 수집, AI가 고성과 패턴 리뷰, 다음 생성 라운드에 반영, 콘텐츠 ROI 200% 향상.' },
]

const cases = [
  {
    title: '소비재 브랜드:6 플랫폼 콘텐츠 산출 10배',
    desc: '某 소비재 브랜드가 AI 마케팅 Agent를 도입, XHS/Douyin/Weibo/WeChat/LinkedIn/Twitter 6개 플랫폼 카피를 자동 생성, 콘텐츠 산출 10배, 자연 유입 38% 증가.',
  },
  {
    title: 'B2B SaaS:SEO 자연 유입 +150%',
    desc: '某 B2B SaaS가 AI 마케팅 Agent로 주 5회 SEO 블로그 발행, 키워드 300+ 커버, 자연 유입 5개월 내 0에서 월 8만 UV로 성장, 세일즈 리드 120% 증가.',
  },
  {
    title: '크로스보더 커머스:CTR 3.2%로 향상',
    desc: '某 크로스보더 커머스가 AI 마케팅 Agent의 A/B 테스트 기능 활용, 광고 카피 CTR 0.8%에서 3.2%로 4배 향상, ROAS 2.1배 증가.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 엔드 마케팅 콘솔과 콘텐츠 캘린더' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 엔드 콘텐츠 자산/페르소나 데이터' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '멀티 플랫폼 카피 + A/B 테스트 + SEO 추천 엔진' },
  { name: 'MCP 도구 프로토콜', purpose: 'XHS/Douyin/Weibo/WeChat/LinkedIn/Twitter 플랫폼 어댑터' },
  { name: 'Tauri 2 데스크톱', purpose: '오프라인 콘텐츠 에디터와 로컬 자료庫' },
  { name: 'WXT 브라우저 확장', purpose: '경쟁사 페이지/트렌드 페이지 원클릭 수집' },
  { name: 'Taro 4 미니프로그램', purpose: '모바일 콘텐츠 미리보기 + 팀 승인' },
  { name: 'CLI 명령행', purpose: '일괄 콘텐츠 임포트 + 데이터 내보내기' },
]

const metrics = [
  { value: '10×', label: '콘텐츠 산출' },
  { value: '40%', label: '자연 유입 향상' },
  { value: '35%', label: '전환율 향상' },
  { value: '30min', label: '온보딩 시간' },
]

export default function AiMarketingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5 text-primary" />
            마케팅 콘텐츠
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI 마케팅 콘텐츠:6개 플랫폼 동시 발행, 산출 10배
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 배포, Apache 2.0 오픈소스, 온프레미스 지원, 브랜드 톤 일관성과 A/B 테스트로 ROI 향상.
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
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">마케팅 팀의 실제 페인 포인트</h2>
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
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 소스 통합, 핵심 컴포넌트 모두 오픈소스. XHS/Douyin/Weibo/WeChat/LinkedIn/Twitter 6대 플랫폼과 깊이 통합.
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
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">AI 마케팅 어시스턴트 구축을 시작하세요</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            가입 시 1000 크레딧 증정, 마케팅 시나리오 템플릿에서 원클릭 fork, 30분 만에 멀티 플랫폼 동시 발행을 체험.
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 마케팅 상담 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 톤 트레이닝 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 온프레미스 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 플랫폼 확장 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
