import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, BookOpen, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/ko/use-cases/ai-research#webpage',
      url: 'https://aizhs.top/ko/use-cases/ai-research',
      name: 'AI 학술 연구 어시스턴트 Agent 사용 사례 — IHUI AI',
      description:
        'IHUI AI 풀스택 AI OS 기반의 AI 학술 연구 어시스턴트:논문 검색/리뷰, PDF 파싱, 인용 관리, 연구 동향 분석, 융합 학문 지식 그래프. 30분 온보딩, 8엔드포인트 배포.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/ko/use-cases/ai-research#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '사용 사례', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 학술 연구', item: 'https://aizhs.top/ko/use-cases/ai-research' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/ko/use-cases/ai-research#howto',
      name: '30분 만에 AI 학술 연구 어시스턴트 구축',
      description:
        'IHUI AI 풀스택 AI OS에서 AI 학술 연구 어시스턴트를 구축하는 6단계:DB 연결 → 문헌 업로드 → 인용 스타일 설정 → 리뷰 모델 학습 → 지식 그래프 구축 → 동향 리포트 출력. 문헌 조사 효율 8배 향상.',
      inLanguage: ['ko', 'zh-CN', 'zh-TW', 'en', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '연구 분야 키워드 / 기존 PDF 문헌 / 인용 스타일 (APA/MLA/Chicago)' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 문헌 검색 엔진' },
        { '@type': 'HowToTool', name: 'IHUI AI PDF 파싱 모듈' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '학술 DB 연결', text: 'arXiv/PubMed/IEEE/CNKI/Wanfang 등 30+ DB를 연결, 매일 신규 논문을 자동 수집합니다.' },
        { '@type': 'HowToStep', position: 2, name: 'PDF 문헌 업로드', text: '기존 PDF 문헌을 일괄 업로드, AI가 제목/저자/초록/참고문헌을 추출하여 로컬 문헌庫를 구축합니다.' },
        { '@type': 'HowToStep', position: 3, name: '인용 스타일 설정', text: 'APA/MLA/Chicago/GB/T 7714/IEEE/Vancouver 등 20+ 인용 스타일을 지원, Agent가 저널 규격에 맞춰 참고문헌을 생성합니다.' },
        { '@type': 'HowToStep', position: 4, name: '리뷰 모델 학습', text: 'Agent가 팀의 기존 리뷰 작성 스타일을 학습, 구조화된 문헌 리뷰를 생성하고 사람은 다듬기만 합니다.' },
        { '@type': 'HowToStep', position: 5, name: '지식 그래프 구축', text: '논문에서 엔터티(저자/기관/방법/데이터셋)와 관계를 추출, 융합 학문 지식 그래프를 시각화합니다.' },
        { '@type': 'HowToStep', position: 6, name: '동향 리포트 출력', text: '시계열과 토픽 모델로 연구 핫스팟/신규 방법/협력 후보를 주간 단위로 리포트화합니다.' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 학술 연구 어시스턴트 — 논문 검색/리뷰/인용 관리 | IHUI AI',
  description:
    'IHUI AI로 AI 학술 연구 어시스턴트 구축:논문 검색 + PDF 파싱 + 인용 관리 + 리뷰 생성 + 지식 그래프 + 동향 분석. 30분 온보딩, 8엔드포인트 배포, Apache 2.0 오픈소스.',
  alternates: { canonical: '/ko/use-cases/ai-research' },
  openGraph: {
    title: 'AI 학술 연구 어시스턴트 — IHUI AI',
    description: '문헌 검색 + 리뷰 생성 + 지식 그래프, 30분 온보딩.',
    url: 'https://aizhs.top/ko/use-cases/ai-research',
    type: 'article',
  },
}

const problems = [
  'arXiv/PubMed/CNKI/Wanfang/Google Scholar 등 교차 DB 검색에 시간 소요, 신입 연구자는 분야 핵심 문헌 파악에 2-3개월 소요',
  'PDF 문헌이 쌓여 100편 수동 정독에 평균 40시간, 정보 추출 효율이 매우 낮음',
  'APA/MLA/Chicago/GB/T 7714 등 인용 형식 수동 정리는 오류가 잦아 투고 품질에 영향',
  '문헌 리뷰 작성이 개인 경험에 의존, 융합 학문 연관성 발견이 어려워 혁신 포인트 발굴이 제한됨',
  '연구 핫스팟 변화가 빨라 수동 주간/월간 추적이滞后, 협력 기회를 놓치기 쉬움',
  '연구팀 구성원이 각자 문헌庫를 관리, 지식 자산이 팀 내에 축적/재사용되지 않음',
]

const capabilities = [
  { title: '30+ DB 교차 검색', desc: 'arXiv/PubMed/IEEE/CNKI/Wanfang/Springer/Elsevier 등 학술 DB를 통합 검색, 신규 논문은 매일 자동 적재됩니다.' },
  { title: 'PDF 스마트 파싱', desc: 'PDF를 일괄 파싱하여 제목/저자/초록/그림/수식/참고문헌 추출, 100편 파싱 시간을 40시간에서 20분으로 단축.' },
  { title: '인용 스타일 자동 생성', desc: 'APA/MLA/Chicago/GB/T 7714/IEEE/Vancouver 등 20+ 인용 스타일을 지원, Agent가 저널 요구사항에 맞춰 참고문헌을 자동 생성합니다.' },
  { title: '문헌 리뷰 생성', desc: 'Agent가 팀의 리뷰 작성 스타일을 학습, 로컬 문헌庫 기반으로 구조화된 리뷰를 생성, 작성 주기를 2주에서 2일로 단축.' },
  { title: '융합 학문 지식 그래프', desc: '논문의 엔터티(저자/기관/방법/데이터셋)와 관계를 추출, 시각화 가능한 지식 그래프를 생성하여 탐색적 조회와 잠재 협력자 발굴을 지원합니다.' },
  { title: '연구 동향 분석', desc: '시계열과 토픽 모델로 연구 핫스팟/신규 방법/고인용 논문을 추적, 주간 동향 리포트를 출력하여选题 결정을 지원합니다.' },
]

const cases = [
  {
    title: '대학 연구실:박사과정 조사 주기 2개월 → 1주',
    desc: '某 985 대학 컴퓨터공학과 박사과정 12명이 AI 학술 연구 어시스턴트를 도입, 문헌 정독 효율 8배 향상, 리뷰 작성 시간 평균 14일에서 2.5일로 단축, SCI 논문 발표 수 전년 대비 35% 증가.',
  },
  {
    title: '연구소:융합 학문 과제 사이클 60% 단축',
    desc: '중국 某 신형 연구소가 AI 학술 어시스턴트의 지식 그래프로 생물정보학과 재료과학의 교차점을 자동 발견, 8개 융합 과제立项 지원, 평균立项 주기 6개월에서 2.4개월로 단축.',
  },
  {
    title: '기업 R&D:기술 인텔리전스 주간 리포트 자동화',
    desc: '某 AI 대형 모델 기업이 AI 학술 어시스턴트를 도입, 글로벌 30+ 톱 컨퍼런스(NeurIPS/ICML/CVPR/ACL)의 신규 논문을 자동 모니터링, 매주 월요일 기술 인텔리전스 주간 리포트 자동 생성, R&D 팀의 프런티어 동향 대응 속도 5배 향상.',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 엔드 문헌 검색/정독/작업 워크벤치' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 엔드 문헌 메타데이터 관리와 권한 제어' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'PDF 파싱 + 리뷰 생성 + 지식 그래프 추출' },
  { name: 'MCP 도구 프로토콜', purpose: 'arXiv/PubMed/CNKI/Wanfang 등 데이터 소스 어댑터' },
  { name: 'Tauri 2 데스크톱', purpose: '오프라인 문헌庫 + 로컬 PDF 주석' },
  { name: 'WXT 브라우저 확장', purpose: 'Google Scholar/PubMed 웹페이지에서 원클릭 입고' },
  { name: 'Taro 4 미니프로그램', purpose: '모바일 문헌 속독 + 속기' },
  { name: 'CLI 명령행', purpose: '일괄 문헌 관리와 BibTeX 내보내기' },
]

const metrics = [
  { value: '30+', label: '학술 DB' },
  { value: '8×', label: '문헌 조사 가속' },
  { value: '20+', label: '인용 스타일' },
  { value: '30min', label: '온보딩 시간' },
]

export default function AiResearchPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            학술 연구
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 학술 연구 어시스턴트:문헌 조사 효율 8배 향상
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 배포(Web/데스크톱/미니프로그램/브라우저 확장/RN/CLI/API/AI-Service), Apache 2.0 오픈소스, 온프레미스 배포 지원.
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
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">연구자의 실제 페인 포인트</h2>
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
            IHUI AI 풀스택 AI OS 기반, 8엔드포인트 소스 통합, 핵심 컴포넌트 모두 오픈소스.
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
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">AI 학술 연구 어시스턴트 구축을 시작하세요</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            가입 시 1000 크레딧 증정, 학술 연구 시나리오 템플릿에서 원클릭 fork, 30분 만에 체험.
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 상담 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 교육용 8802</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 연구실 배포 8803</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 미러 가속 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
