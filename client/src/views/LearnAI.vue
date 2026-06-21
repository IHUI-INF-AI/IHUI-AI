<script setup lang="ts">
/**
 * LearnAI.vue - 智汇 AI 数字化教育底座官方重构版 (Premium Master Edition)
 *
 * @description 首席设计师交付：2026 工业级极简 (Brutalist Modernism)
 * @author Architecture Team
 */

import { ref, reactive, computed, onMounted, onActivated, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useEduPlatformNav } from '@/composables/useEduPlatformNav'
import { getProxiedImageUrl, switchImageProxy } from '@/utils/imageProxy'
import { usePagePerf } from '@/composables/usePagePerf'
import { useSEO } from '@/composables/useSEO'

const { t: _t } = useI18n()

useSEO({
  title: _t('learnAI.seo.title'),
  description: _t('learnAI.seo.description'),
  keywords: _t('learnAI.seo.keywords'),
  ogTitle: _t('learnAI.seo.ogTitle'),
  ogDescription: _t('learnAI.seo.ogDescription'),
  canonical: 'https://www.zhihui-ai.com/learn-ai'
})

// ============ 高级动效系统 ============
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())
// 滚动进度
const scrollProgress = ref(0)

// 初始化滚动动画观察器
const initScrollAnimations = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay || '0'
          const animation = el.dataset.animation || 'fadeInUp'

          setTimeout(() => {
            el.classList.add('scroll-animated', `animate-${animation}`)
          }, parseInt(delay))

          // 添加到已观察集合，避免重复触发
          observedElements.value.add(el)
        }
      })
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  )

  // 观察所有带有 scroll-reveal 类的元素
  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// 滚动进度计算
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = Math.min(scrollTop / docHeight, 1)

    // 更新 CSS 变量
    document.documentElement.style.setProperty('--scroll-progress', `${scrollProgress.value}`)
  })
}

// ============ 图片错误处理 ============
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (!img) return

  // 如果当前是代理图片，尝试切换到下一个代理
  if (img.src.includes('images.weserv.nl') || img.src.includes('wsrv.nl')) {
    switchImageProxy()
    const originalSrc = img.src.replace(/^https:\/\/(images\.weserv\.nl|wsrv\.nl)\/\?url=/, '').replace(/&.*$/, '')
    if (originalSrc) {
      img.src = getProxiedImageUrl(decodeURIComponent(originalSrc), true)
      return
    }
  }

  // 如果代理都失败，使用默认图片
  img.src = '/images/APP.jpg'
}

// ============ 数字计数动画 ============
const animatedNumbers = ref<Map<string, number>>(new Map())
const _targetNumbers = ref<Map<string, number>>(new Map())

const initCountAnimation = () => {
  // 观察统计数字元素
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const target = parseInt(el.dataset.target || '0')
          const id = el.dataset.countId || Math.random().toString()

          animateNumber(id, 0, target, 2000)
          counterObserver.unobserve(el)
        }
      })
    },
    { threshold: 0.5 }
  )

  nextTick(() => {
    document.querySelectorAll('.count-up').forEach((el) => {
      counterObserver.observe(el)
    })
  })
}

const animateRafIds = new Set<number>()

const animateNumber = (id: string, start: number, end: number, duration: number) => {
  const startTime = performance.now()

  const update = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)

    // 缓动函数 - easeOutExpo
    const easeOutExpo = 1 - Math.pow(2, -10 * progress)
    const current = Math.floor(start + (end - start) * easeOutExpo)

    animatedNumbers.value.set(id, current)

    if (progress < 1) {
      requestAnimationFrame(update)
    }
  }

  requestAnimationFrame(update)
}

// ============ 磁吸按钮效果 ============
const _handleMagneticMove = (e: MouseEvent, btnRef: HTMLElement | null) => {
  if (!btnRef) return

  const rect = btnRef.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2

  btnRef.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`
}

const _resetMagnetic = (btnRef: HTMLElement | null) => {
  if (!btnRef) return
  btnRef.style.transform = 'translate(0, 0)'
}

// ============ 涟漪点击效果 ============
const createRipple = (e: MouseEvent, el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  const ripple = document.createElement('span')
  const size = Math.max(rect.width, rect.height)

  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  ripple.classList.add('ripple-effect')

  el.appendChild(ripple)

  setTimeout(() => ripple.remove(), 600)
}

// ============ 视差滚动 ============
const parallaxY = ref(0)
const handleParallax = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    parallaxY.value = window.scrollY * 0.3
    document.documentElement.style.setProperty('--parallax-y', `${parallaxY.value}px`)
  })
}

import {
  CircleCheckFilled, Document,
  Setting, Share, Lock, VideoPlay, DataAnalysis, Cpu,
  User, Star, ShoppingCart, CreditCard, Medal, Bell, Activity, Search, Files, Clock, ArrowRight,
  VideoCamera, ChatDotRound, View
} from 'lucide-vue-next'

const isVisible = ref(false)

const animatedStats = reactive({
  microservices: 0,
  api: 0,
  enterprise: 0,
  users: 0
})

const targetStats = {
  microservices: 22,
  api: 320,
  enterprise: 500,
  users: 100
}

const animateStats = () => {
  const duration = 2000
  const startTime = performance.now()

  const update = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOut = 1 - Math.pow(2, -10 * progress)

    animatedStats.microservices = Math.floor(targetStats.microservices * easeOut)
    animatedStats.api = Math.floor(targetStats.api * easeOut)
    animatedStats.enterprise = Math.floor(targetStats.enterprise * easeOut)
    animatedStats.users = Math.floor(targetStats.users * easeOut)

    if (progress < 1) {
      animateRafIds.delete(rafId)
      rafId = requestAnimationFrame(update)
      animateRafIds.add(rafId)
    } else {
      animateRafIds.delete(rafId)
    }
  }

  let rafId = requestAnimationFrame(update)
  animateRafIds.add(rafId)
}

// 中台切换状态
const activeCenterIndex = ref(0)

// 1. 打字机逻辑 - 展示AI+行业核心特性
const phrases = [
  _t('data.learn_a_i.AI智能助手21'),
  _t('learnAI.phraseLlmDev'),
  _t('learnAI.phraseAiEdu'),
  _t('learnAI.phraseAiEnterprise'),
  _t('learnAI.phraseAiKnowledge'),
  _t('learnAI.phraseAiCert'),
  _t('learnAI.phraseSmartQa'),
  _t('learnAI.phraseKnowledgeGraph')
]
const currentTypingText = ref('')
let phraseIdx = 0
let charIdx = 0
let isDeletingText = false
let typingTimer: ReturnType<typeof setTimeout> | null = null

const runTypeEffect = () => {
  if (!phrases.length) return
  const currentPhrase = phrases[phraseIdx]
  if (!currentPhrase?.length) {
    phraseIdx = (phraseIdx + 1) % phrases.length
    typingTimer = setTimeout(runTypeEffect, 500)
    return
  }
  let speed: number
  if (isDeletingText) {
    if (charIdx <= 0) {
      isDeletingText = false
      phraseIdx = (phraseIdx + 1) % phrases.length
      currentTypingText.value = ''
      charIdx = 0
      speed = 500
    } else {
      charIdx--
      currentTypingText.value = currentPhrase.substring(0, charIdx)
      speed = 60
    }
  } else {
    currentTypingText.value = currentPhrase.substring(0, charIdx + 1)
    charIdx++
    if (charIdx >= currentPhrase.length) {
      isDeletingText = true
      speed = 2000
    } else {
      speed = 120
    }
  }
  typingTimer = setTimeout(runTypeEffect, speed)
}

const startTypewriter = () => {
  if (typingTimer) clearTimeout(typingTimer)
  phraseIdx = 0
  charIdx = 0
  isDeletingText = false
  currentTypingText.value = ''
  runTypeEffect()
}

// 2. 22个微服务数据 - 基于 G:\edu 项目实际源码
const businessCenters = [
  {
    id: 'teaching',
    label: _t('data.learn_a_i.教学教研中台'),
    desc: _t('learnAI.center.teaching.desc'),
    icon: Document,
    services: [
      { id: '01', name: 'learn-service', title: _t('title.learn_a_i.学习服务'), desc: _t('learnAI.service.learn.desc'), icon: Document, port: 6607 },
      { id: '02', name: 'exam-service', title: _t('title.learn_a_i.考试服务1'), desc: _t('learnAI.service.exam.desc'), icon: DataAnalysis, port: 6609 },
      { id: '03', name: 'content-service', title: _t('title.learn_a_i.内容服务2'), desc: _t('learnAI.service.content.desc'), icon: Share, port: 6606 },
      { id: '04', name: 'resource-service', title: _t('title.learn_a_i.资源服务3'), desc: _t('learnAI.service.resource.desc'), icon: Files, port: 6605 },
      { id: '05', name: 'oss-service', title: _t('title.learn_a_i.云存服务4'), desc: _t('learnAI.service.oss.desc'), icon: Cpu, port: 6617 },
      { id: '06', name: 'schedule-service', title: _t('title.learn_a_i.排课服务5'), desc: _t('learnAI.service.schedule.desc'), icon: Clock, port: 6619 }
    ]
  },
  {
    id: 'interaction',
    label: _t('data.learn_a_i.互动社交中台1'),
    desc: _t('learnAI.center.interaction.desc'),
    icon: Share,
    services: [
      { id: '07', name: 'live-service', title: _t('title.learn_a_i.直播服务6'), desc: _t('learnAI.service.live.desc'), icon: VideoPlay, port: 6608 },
      { id: '08', name: 'ask-service', title: _t('title.learn_a_i.问答服务7'), desc: _t('learnAI.service.ask.desc'), icon: ChatDotRound, port: 6610 },
      { id: '09', name: 'circle-service', title: _t('title.learn_a_i.圈子服务8'), desc: _t('learnAI.service.circle.desc'), icon: User, port: 6611 },
      { id: '10', name: 'behavior-service', title: _t('title.learn_a_i.行为服务9'), desc: _t('learnAI.service.behavior.desc'), icon: Activity, port: 6612 },
      { id: '11', name: 'message-service', title: _t('title.learn_a_i.消息服务10'), desc: _t('learnAI.service.message.desc'), icon: ChatDotRound, port: 6615 }
    ]
  },
  {
    id: 'business',
    label: _t('data.learn_a_i.经营增长中台2'),
    desc: _t('learnAI.center.business.desc'),
    icon: ShoppingCart,
    services: [
      { id: '12', name: 'member-service', title: _t('title.learn_a_i.会员服务11'), desc: _t('learnAI.service.member.desc'), icon: Star, port: 6602 },
      { id: '13', name: 'order-service', title: _t('title.learn_a_i.订单服务12'), desc: _t('learnAI.service.order.desc'), icon: ShoppingCart, port: 6621 },
      { id: '14', name: 'pay-service', title: _t('title.learn_a_i.支付服务13'), desc: _t('learnAI.service.pay.desc'), icon: CreditCard, port: 6613 },
      { id: '15', name: 'point-service', title: _t('title.learn_a_i.积分服务14'), desc: _t('learnAI.service.point.desc'), icon: Medal, port: 6614 },
      { id: '16', name: 'notification-service', title: _t('title.learn_a_i.通知服务15'), desc: _t('learnAI.service.notification.desc'), icon: Bell, port: 6616 }
    ]
  },
  {
    id: 'support',
    label: _t('data.learn_a_i.支撑数据中台3'),
    desc: _t('learnAI.center.support.desc'),
    icon: Activity,
    services: [
      { id: '17', name: 'gateway-service', title: _t('title.learn_a_i.API网关16'), desc: _t('learnAI.service.gateway.desc'), icon: Cpu, port: 6600 },
      { id: '18', name: 'auth-service', title: _t('title.learn_a_i.认证服务17'), desc: _t('learnAI.service.auth.desc'), icon: Lock, port: 6601 },
      { id: '19', name: 'usercenter-service', title: _t('title.learn_a_i.用户中心18'), desc: _t('learnAI.service.usercenter.desc'), icon: User, port: 6603 },
      { id: '20', name: 'setting-service', title: _t('title.learn_a_i.系统设置19'), desc: _t('learnAI.service.setting.desc'), icon: Setting, port: 6604 },
      { id: '21', name: 'search-service', title: _t('title.learn_a_i.搜索服务20'), desc: _t('learnAI.service.search.desc'), icon: Search, port: 6618 },
      { id: '22', name: 'visit-tracking-service', title: _t('title.learn_a_i.访问追踪21'), desc: _t('learnAI.service.visit.desc'), icon: Activity, port: 6620 }
    ]
  }
]

// 3. 定价模型 - 面向客户的功能描述
const pricingPlans = [
  {
    id: 'standard',
    name: _t('data.learn_a_i.标准版4'),
    price: '48,000',
    services: _t('learnAI.pricing.standard.services'),
    desc: _t('learnAI.pricing.standard.desc'),
    features: [
      _t('data.learn_a_i.API统一网关22'),
      _t('learnAI.pricing.standard.feature1'),
      _t('learnAI.pricing.standard.feature2'),
      _t('learnAI.pricing.standard.feature3'),
      _t('learnAI.pricing.standard.feature4'),
      _t('learnAI.pricing.standard.feature5'),
      _t('learnAI.pricing.standard.feature6'),
      _t('learnAI.pricing.standard.feature7'),
      _t('learnAI.pricing.standard.feature8'),
      _t('learnAI.pricing.standard.feature9')
    ],
    recommended: false
  },
  {
    id: 'professional',
    name: _t('data.learn_a_i.专业版5'),
    price: '98,000',
    services: _t('learnAI.pricing.professional.services'),
    desc: _t('learnAI.pricing.professional.desc'),
    features: [
      _t('data.learn_a_i.包含标准版全部功23'),
      _t('learnAI.pricing.professional.feature1'),
      _t('learnAI.pricing.professional.feature2'),
      _t('learnAI.pricing.professional.feature3'),
      _t('learnAI.pricing.professional.feature4'),
      _t('learnAI.pricing.professional.feature5'),
      _t('learnAI.pricing.professional.feature6'),
      _t('learnAI.pricing.professional.feature7'),
      _t('learnAI.pricing.professional.feature8')
    ],
    recommended: true
  },
  {
    id: 'enterprise',
    name: _t('data.learn_a_i.企业版6'),
    price: '198,000',
    services: _t('learnAI.pricing.enterprise.services'),
    desc: _t('learnAI.pricing.enterprise.desc'),
    features: [
      _t('data.learn_a_i.包含专业版全部功24'),
      _t('learnAI.pricing.enterprise.feature1'),
      _t('learnAI.pricing.enterprise.feature2'),
      _t('learnAI.pricing.enterprise.feature3'),
      _t('learnAI.pricing.enterprise.feature4'),
      _t('learnAI.pricing.enterprise.feature5'),
      _t('learnAI.pricing.enterprise.feature6'),
      _t('learnAI.pricing.enterprise.feature7')
    ],
    recommended: false
  }
]

// 4. AI 核心能力
const aiCapabilities = [
  {
    id: 'assistant',
    title: _t('title.learn_a_i.AI智能助手22'),
    desc: _t('learnAI.capability.assistant.desc'),
    features: [_t('data.learn_a_i.多轮对话25'), _t('learnAI.capability.assistant.feature2'), _t('learnAI.capability.assistant.feature3'), _t('learnAI.capability.assistant.feature4')],
    icon: ChatDotRound
  },
  {
    id: 'knowledge',
    title: _t('title.learn_a_i.知识图谱23'),
    desc: _t('learnAI.capability.knowledge.desc'),
    features: [_t('data.learn_a_i.自动抽取26'), _t('learnAI.capability.knowledge.feature2'), _t('learnAI.capability.knowledge.feature3'), _t('learnAI.capability.knowledge.feature4')],
    icon: Share
  },
  {
    id: 'content',
    title: _t('title.learn_a_i.AI内容生成24'),
    desc: _t('learnAI.capability.content.desc'),
    features: [_t('data.learn_a_i.课程生成27'), _t('learnAI.capability.content.feature2'), _t('learnAI.capability.content.feature3'), _t('learnAI.capability.content.feature4')],
    icon: Document
  },
  {
    id: 'analysis',
    title: _t('title.learn_a_i.智能分析25'),
    desc: _t('learnAI.capability.analysis.desc'),
    features: [_t('data.learn_a_i.行为分析28'), _t('learnAI.capability.analysis.feature2'), _t('learnAI.capability.analysis.feature3'), _t('learnAI.capability.analysis.feature4')],
    icon: DataAnalysis
  },
  {
    id: 'speech',
    title: _t('title.learn_a_i.语音交互26'),
    desc: _t('learnAI.capability.speech.desc'),
    features: [_t('data.learn_a_i.语音识别29'), _t('learnAI.capability.speech.feature2'), _t('learnAI.capability.speech.feature3'), _t('learnAI.capability.speech.feature4')],
    icon: VideoCamera
  },
  {
    id: 'vision',
    title: _t('title.learn_a_i.AI视觉27'),
    desc: _t('learnAI.capability.vision.desc'),
    features: [_t('data.learn_a_i.图像识别30'), _t('learnAI.capability.vision.feature2'), _t('learnAI.capability.vision.feature3'), _t('learnAI.capability.vision.feature4')],
    icon: Search
  }
]

// 5. AI + 行业应用场景
const aiIndustries = [
  {
    id: 'education',
    name: _t('data.learn_a_i.AI教育培训7'),
    desc: _t('learnAI.industry.education.desc'),
    color: 'var(--el-text-color-primary)',
    cases: [_t('data.learn_a_i.K12在线教育31'), _t('learnAI.industry.education.case2'), _t('learnAI.industry.education.case3'), _t('learnAI.industry.education.case4')]
  },
  {
    id: 'enterprise',
    name: _t('data.learn_a_i.AI企业内训8'),
    desc: _t('learnAI.industry.enterprise.desc'),
    color: 'var(--color-gray-333)',
    cases: [_t('data.learn_a_i.新员工入职培训32'), _t('learnAI.industry.enterprise.case2'), _t('learnAI.industry.enterprise.case3'), _t('learnAI.industry.enterprise.case4')]
  },
  {
    id: 'knowledge',
    name: _t('data.learn_a_i.AI知识付费9'),
    desc: _t('learnAI.industry.knowledge.desc'),
    color: 'var(--color-gray-555555)',
    cases: [_t('data.learn_a_i.专业知识博主33'), _t('learnAI.industry.knowledge.case2'), _t('learnAI.industry.knowledge.case3'), _t('learnAI.industry.knowledge.case4')]
  },
  {
    id: 'certification',
    name: _t('data.learn_a_i.AI技能认证10'),
    desc: _t('learnAI.industry.certification.desc'),
    color: 'var(--color-gray-222)',
    cases: [_t('data.learn_a_i.职业资格认证34'), _t('learnAI.industry.certification.case2'), _t('learnAI.industry.certification.case3'), _t('learnAI.industry.certification.case4')]
  }
]

// 6. 平台数据统计 - 基于实际项目规模
const platformStats = [
  { label: _t('data.learn_a_i.AI模型接入11'), value: '15', suffix: _t('learnAI.stat.suffixCount'), icon: Cpu },
  { label: _t('data.learn_a_i.行业解决方案12'), value: '8', suffix: _t('learnAI.stat.suffixSet'), icon: Document },
  { label: _t('data.learn_a_i.API接口13'), value: '320', suffix: _t('learnAI.stat.suffixCount'), icon: Activity },
  { label: _t('data.learn_a_i.服务企业14'), value: '500', suffix: _t('learnAI.stat.suffixCompany'), icon: User },
  { label: _t('data.learn_a_i.用户覆盖15'), value: '100', suffix: _t('learnAI.stat.suffixTenThousand'), icon: Star },
  { label: _t('data.learn_a_i.持续迭代16'), value: '3', suffix: _t('learnAI.stat.suffixYear'), icon: Clock }
]

// 7. 技术栈展示 - AI 增强版
const techStacks = [
  { category: _t('data.learn_a_i.AI大模型17'), items: ['GPT-4 / Claude', _t('learnAI.tech.aiModel2'), 'DeepSeek', _t('learnAI.tech.aiModel4')] },
  { category: _t('data.learn_a_i.AI能力层18'), items: [_t('data.learn_a_i.LangChai35'), _t('learnAI.tech.aiCapability2'), _t('learnAI.tech.aiCapability3'), _t('learnAI.tech.aiCapability4')] },
  { category: _t('data.learn_a_i.后端架构19'), items: ['Spring Boot 3.2', 'Spring Cloud 2023', 'Spring AI', 'Python FastAPI'] },
  { category: _t('data.learn_a_i.前端技术20'), items: ['Vue.js 3', 'TypeScript', 'TailwindCSS', 'Element Plus'] }
]

// 8. 客户成功案例
const customerCases = [
  {
    id: 'case1',
    company: _t('learnAI.case.case1.company'),
    industry: _t('learnAI.case.case1.industry'),
    logo: getProxiedImageUrl('https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=80&h=80&fit=crop&crop=face', false),
    challenge: _t('learnAI.case.case1.challenge'),
    solution: _t('learnAI.case.case1.solution'),
    results: [
      { metric: _t('learnAI.case.case1.result1Metric'), value: _t('learnAI.case.case1.result1Value') },
      { metric: _t('learnAI.case.case1.result2Metric'), value: _t('learnAI.case.case1.result2Value') },
      { metric: _t('learnAI.case.case1.result3Metric'), value: _t('learnAI.case.case1.result3Value') }
    ]
  },
  {
    id: 'case2',
    company: _t('learnAI.case.case2.company'),
    industry: _t('learnAI.case.case2.industry'),
    logo: getProxiedImageUrl('https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&h=80&fit=crop&crop=face', false),
    challenge: _t('learnAI.case.case2.challenge'),
    solution: _t('learnAI.case.case2.solution'),
    results: [
      { metric: _t('learnAI.case.case2.result1Metric'), value: _t('learnAI.case.case2.result1Value') },
      { metric: _t('learnAI.case.case2.result2Metric'), value: _t('learnAI.case.case2.result2Value') },
      { metric: _t('learnAI.case.case2.result3Metric'), value: _t('learnAI.case.case2.result3Value') }
    ]
  },
  {
    id: 'case3',
    company: _t('learnAI.case.case3.company'),
    industry: _t('learnAI.case.case3.industry'),
    logo: getProxiedImageUrl('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&crop=face', false),
    challenge: _t('learnAI.case.case3.challenge'),
    solution: _t('learnAI.case.case3.solution'),
    results: [
      { metric: _t('learnAI.case.case3.result1Metric'), value: _t('learnAI.case.case3.result1Value') },
      { metric: _t('learnAI.case.case3.result2Metric'), value: _t('learnAI.case.case3.result2Value') },
      { metric: _t('learnAI.case.case3.result3Metric'), value: _t('learnAI.case.case3.result3Value') }
    ]
  }
]

// 9. 合作伙伴/AI 生态
const partners = {
  aiModels: ['OpenAI', _t('learnAI.partner.aiModel2'), _t('learnAI.partner.aiModel3'), _t('learnAI.partner.aiModel4'), _t('learnAI.partner.aiModel5'), 'Anthropic'],
  cloudServices: [_t('data.learn_a_i.阿里云36'), _t('learnAI.partner.cloudService2'), _t('learnAI.partner.cloudService3'), 'AWS', _t('learnAI.partner.cloudService5')],
  techPartners: ['Elasticsearch', 'Redis', 'RocketMQ', 'Nacos', 'MinIO']
}

// 10. 客户评价
const testimonials = [
  {
    content: _t('content.learn_a_i.AI智能出题功能50'),
    author: _t('learnAI.testimonial.testimonial1.author'),
    role: _t('learnAI.testimonial.testimonial1.role'),
    company: _t('learnAI.testimonial.testimonial1.company'),
    avatar: getProxiedImageUrl('https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face', false)
  },
  {
    content: _t('content.learn_a_i.企业培训系统的智51'),
    author: _t('learnAI.testimonial.testimonial2.author'),
    role: _t('learnAI.testimonial.testimonial2.role'),
    company: _t('learnAI.testimonial.testimonial2.company'),
    avatar: getProxiedImageUrl('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face', false)
  },
  {
    content: _t('content.learn_a_i.知识图谱功能让学52'),
    author: _t('learnAI.testimonial.testimonial3.author'),
    role: _t('learnAI.testimonial.testimonial3.role'),
    company: _t('learnAI.testimonial.testimonial3.company'),
    avatar: getProxiedImageUrl('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face', false)
  }
]

// 11. 荣誉资质
const achievements = [
  { icon: '🏆', title: _t('title.learn_a_i.高新技术企业28'), desc: _t('learnAI.achievement.achievement1.desc') },
  { icon: '📜', title: _t('title.learn_a_i.软件著作权29'), desc: _t('learnAI.achievement.achievement2.desc') },
  { icon: '🔒', title: _t('title.learn_a_i.信息安全等保30'), desc: _t('learnAI.achievement.achievement3.desc') },
  { icon: '🌐', title: _t('title.learn_a_i.ISO认证31'), desc: _t('learnAI.achievement.achievement4.desc') }
]

// 12. 服务承诺
const servicePromises = [
  {
    icon: Clock,
    title: _t('title.learn_a_i.724小时响应32'),
    desc: _t('learnAI.servicePromise.promise1.desc')
  },
  {
    icon: Setting,
    title: _t('title.learn_a_i.专属技术顾问33'),
    desc: _t('learnAI.servicePromise.promise2.desc')
  },
  {
    icon: Files,
    title: _t('title.learn_a_i.完整技术文档34'),
    desc: _t('learnAI.servicePromise.promise3.desc')
  },
  {
    icon: Star,
    title: _t('title.learn_a_i.999可用性35'),
    desc: _t('learnAI.servicePromise.promise4.desc')
  }
]

// 13. 资源下载
const resources = [
  { icon: '📄', title: _t('title.learn_a_i.AI平台白皮书36'), desc: _t('learnAI.resource.resource1.desc'), type: 'PDF' },
  { icon: '📊', title: _t('title.learn_a_i.客户案例集37'), desc: _t('learnAI.resource.resource2.desc'), type: 'PDF' },
  { icon: '📘', title: _t('title.learn_a_i.技术架构文档38'), desc: _t('learnAI.resource.resource3.desc'), type: 'PDF' },
  { icon: '🎬', title: _t('title.learn_a_i.产品演示视频39'), desc: _t('learnAI.resource.resource4.desc'), type: 'VIDEO' }
]

// 14. 适用场景 - AI 赋能版
const useCases = [
  {
    title: _t('title.learn_a_i.AI智能教学平台40'),
    desc: _t('learnAI.useCase.useCase1.desc'),
    features: [_t('data.learn_a_i.AI助教37'), _t('learnAI.useCase.useCase1.feature2'), _t('learnAI.useCase.useCase1.feature3'), _t('learnAI.useCase.useCase1.feature4')]
  },
  {
    title: _t('title.learn_a_i.AI企业培训系统41'),
    desc: _t('learnAI.useCase.useCase2.desc'),
    features: [_t('data.learn_a_i.AI知识库38'), _t('learnAI.useCase.useCase2.feature2'), _t('learnAI.useCase.useCase2.feature3'), _t('learnAI.useCase.useCase2.feature4')]
  },
  {
    title: _t('title.learn_a_i.AI内容创作平台42'),
    desc: _t('learnAI.useCase.useCase3.desc'),
    features: [_t('data.learn_a_i.AI写作39'), _t('learnAI.useCase.useCase3.feature2'), _t('learnAI.useCase.useCase3.feature3'), _t('learnAI.useCase.useCase3.feature4')]
  },
  {
    title: _t('title.learn_a_i.AI测评认证系统43'),
    desc: _t('learnAI.useCase.useCase4.desc'),
    features: [_t('data.learn_a_i.智能组卷40'), _t('learnAI.useCase.useCase4.feature2'), _t('learnAI.useCase.useCase4.feature3'), _t('learnAI.useCase.useCase4.feature4')]
  }
]

// 7. 安全保障
const securityFeatures = [
  { title: _t('title.learn_a_i.数据加密传输44'), desc: _t('learnAI.security.security1.desc'), icon: Lock },
  { title: _t('title.learn_a_i.身份认证安全45'), desc: _t('learnAI.security.security2.desc'), icon: User },
  { title: _t('title.learn_a_i.接口访问控制46'), desc: _t('learnAI.security.security3.desc'), icon: Setting },
  { title: _t('title.learn_a_i.日志审计追踪47'), desc: _t('learnAI.security.security4.desc'), icon: Activity },
  { title: _t('title.learn_a_i.防攻击防护48'), desc: _t('learnAI.security.security5.desc'), icon: Lock },
  { title: _t('title.learn_a_i.数据备份恢复49'), desc: _t('learnAI.security.security6.desc'), icon: Files }
]

// 8. 常见问题
const faqList = [
  {
    q: _t('learnAI.faq.faq1.q'),
    a: _t('learnAI.faq.faq1.a')
  },
  {
    q: _t('learnAI.faq.faq2.q'),
    a: _t('learnAI.faq.faq2.a')
  },
  {
    q: _t('learnAI.faq.faq3.q'),
    a: _t('learnAI.faq.faq3.a')
  },
  {
    q: _t('learnAI.faq.faq4.q'),
    a: _t('learnAI.faq.faq4.a')
  },
  {
    q: _t('learnAI.faq.faq5.q'),
    a: _t('learnAI.faq.faq5.a')
  },
  {
    q: _t('learnAI.faq.faq6.q'),
    a: _t('learnAI.faq.faq6.a')
  }
]

// 9. 矩阵对比 - 基于实际技术栈和功能
const matrixData = [
  { item: _t('learnAI.matrix.item1'), std: '✓', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item2'), std: '✓', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item3'), std: '✓', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item4'), std: '✓', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item5'), std: '✓', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item6'), std: '-', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item7'), std: '-', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item8'), std: '-', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item9'), std: '-', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item10'), std: '-', pro: '✓', ent: '✓' },
  { item: _t('learnAI.matrix.item11'), std: '-', pro: '-', ent: '✓' },
  { item: _t('learnAI.matrix.item12'), std: '-', pro: '-', ent: '✓' },
  { item: _t('learnAI.matrix.item13'), std: '-', pro: '-', ent: '✓' },
  { item: _t('learnAI.matrix.item14'), std: '-', pro: '-', ent: '✓' },
  { item: _t('learnAI.matrix.item15'), std: '-', pro: '-', ent: '✓' }
]

// ============ 课程中心 ============
const activeCourseCategory = ref('all')
const courseSearchKeyword = ref('')
const courseCategories = [
  { id: 'all', name: _t('learnAI.courseCategory.all') },
  { id: 'ai-base', name: _t('learnAI.courseCategory.aiBase') },
  { id: 'llm', name: _t('learnAI.courseCategory.llm') },
  { id: 'ai-edu', name: _t('learnAI.courseCategory.aiEdu') },
  { id: 'ai-dev', name: _t('learnAI.courseCategory.aiDev') },
  { id: 'ai-creative', name: _t('learnAI.courseCategory.aiCreative') },
]

interface CourseItem {
  id: string
  title: string
  description: string
  category: string
  categoryId: string
  cover: string
  tags: string[]
  views: number
  duration: string
}

const courseList = ref<CourseItem[]>([
  { id: 'c1', title: _t('learnAI.course.c1.title'), description: _t('learnAI.course.c1.description'), category: _t('learnAI.course.c1.category'), categoryId: 'llm', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=240&fit=crop', false), tags: ['LangChain', 'Python', 'RAG'], views: 12800, duration: _t('learnAI.course.c1.duration') },
  { id: 'c2', title: _t('learnAI.course.c2.title'), description: _t('learnAI.course.c2.description'), category: _t('learnAI.course.c2.category'), categoryId: 'llm', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&h=240&fit=crop', false), tags: ['RAG', 'Embedding', _t('learnAI.course.c2.tag3')], views: 8900, duration: _t('learnAI.course.c2.duration') },
  { id: 'c3', title: _t('learnAI.course.c3.title'), description: _t('learnAI.course.c3.description'), category: _t('learnAI.course.c3.category'), categoryId: 'ai-edu', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=240&fit=crop', false), tags: [_t('learnAI.course.c3.tag1'), _t('learnAI.course.c3.tag2'), _t('learnAI.course.c3.tag3')], views: 6500, duration: _t('learnAI.course.c3.duration') },
  { id: 'c4', title: _t('learnAI.course.c4.title'), description: _t('learnAI.course.c4.description'), category: _t('learnAI.course.c4.category'), categoryId: 'ai-dev', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=400&h=240&fit=crop', false), tags: ['Vue 3', 'Spring AI', _t('learnAI.course.c4.tag3')], views: 15200, duration: _t('learnAI.course.c4.duration') },
  { id: 'c5', title: _t('learnAI.course.c5.title'), description: _t('learnAI.course.c5.description'), category: _t('learnAI.course.c5.category'), categoryId: 'ai-creative', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1686191128892-3b3220b38b34?w=400&h=240&fit=crop', false), tags: ['Midjourney', _t('learnAI.course.c5.tag2'), _t('learnAI.course.c5.tag3')], views: 22000, duration: _t('learnAI.course.c5.duration') },
  { id: 'c6', title: _t('learnAI.course.c6.title'), description: _t('learnAI.course.c6.description'), category: _t('learnAI.course.c6.category'), categoryId: 'ai-base', cover: getProxiedImageUrl('https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&h=240&fit=crop', false), tags: ['NLP', 'Python', _t('learnAI.course.c6.tag3')], views: 9800, duration: _t('learnAI.course.c6.duration') },
])

const filteredCourses = computed(() => {
  let list = courseList.value
  if (activeCourseCategory.value !== 'all') {
    list = list.filter(c => c.categoryId === activeCourseCategory.value)
  }
  if (courseSearchKeyword.value) {
    const kw = courseSearchKeyword.value.toLowerCase()
    list = list.filter(c =>
      c.title.toLowerCase().includes(kw) ||
      c.description.toLowerCase().includes(kw) ||
      c.tags.some(t => t.toLowerCase().includes(kw))
    )
  }
  return list
})

const filterCourses = () => {}

// 生命周期
usePagePerf('LearnAI')

onMounted(() => {
  isVisible.value = true
  startTypewriter()
  animateStats()

  // 初始化高级动效系统
  initScrollAnimations()
  initCountAnimation()

  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('scroll', handleParallax, { passive: true })

  // 初始滚动进度计算
  handleScroll()
})

onActivated(() => {
  startTypewriter()
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (typingTimer) { clearTimeout(typingTimer); typingTimer = null } })
cleanup.add(() => { animateRafIds.forEach(id => cancelAnimationFrame(id)); animateRafIds.clear() })
cleanup.add(() => { if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null } })
cleanup.add(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('scroll', handleParallax)
})
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })

const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }

// 跳转到文档页面
const router = useRouter()
const goToDocumentation = () => { router.push('/docs') }

// 教育平台跳转（用户端 / 总管理端），与头部导航行为一致
const { goToEduWeb: _goToEduWeb, goToEduAdmin: _goToEduAdmin } = useEduPlatformNav()
</script>

<template>
  <div class="ihui-edu-showcase-root">
    <!-- 滚动进度指示器 -->
    <div class="scroll-progress-bar" :style="{ transform: `scaleX(${scrollProgress})` }"></div>

    <!-- 1. 深度量子背景系统 -->
    <div class="showcase-bg-system">
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
      <div class="ambient-aura cyan"></div>
      <div class="ambient-aura purple"></div>
    </div>

    <!-- 2. Hero: 工业级视觉 -->
    <section id="learnai-hero" class="hero-section ihui-ai-fade-in-top-animation" aria-labelledby="learnai-hero-title">
      <div class="container hero-wrapper">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="status-dot"></span>
            <span class="badge-text font-edix">{{ _t('learnAI.aiPowered') }}</span>
          </div>
          <h1 id="learnai-hero-title" class="hero-title">{{ _t('learnAI.AI全行业') }}<br />
            <span class="accent-gradient">{{ currentTypingText }}</span><span class="cursor-line">_</span>
          </h1>
          <p class="hero-desc">{{ _t('learnAI.用') }}<strong>{{ _t('learnAI.AI重新定义学习与培') }}</strong>{{
            _t('learnAI.我们提供一站式AI赋') }}<strong>{{ _t('learnAI.教育机构企业培训知识') }}</strong>{{ _t('learnAI.等各行业实现智能化转') }}</p>
          <div class="hero-actions">
            <button class="btn-luxe ghost ripple-btn hero-action-edu"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); scrollTo('ai-capabilities') }">
              <span class="btn-text">{{ _t('learnAI.了解AI方案') }}</span>
            </button>
            <button class="btn-luxe ghost ripple-btn hero-action-edu"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); goToDocumentation() }">
              <span class="btn-text">{{ _t('learnAI.learnMore') }}</span>
            </button>
            <a class="btn-luxe ghost magnetic-btn ripple-btn hero-action-link" href="https://user-edu.aizhs.top"
              target="_blank" rel="noopener noreferrer" @click="(e) => createRipple(e, e.currentTarget as HTMLElement)"
              @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
              @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)">
              <span class="btn-text">{{ _t('login.project.user') }}</span>
            </a>
            <a class="btn-luxe ghost magnetic-btn ripple-btn hero-action-link" href="https://admin-edu.aizhs.top"
              target="_blank" rel="noopener noreferrer" @click="(e) => createRipple(e, e.currentTarget as HTMLElement)"
              @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
              @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)">
              <span class="btn-text">{{ _t('login.project.admin') }}</span>
            </a>
          </div>
        </div>

        <div class="hero-visual ihui-ai-fade-in-bottom-animation">
          <div class="platform-stats-visual">
            <div class="stats-card glass">
              <div class="stats-header">
                <span class="stats-label">{{ _t('learnAI.platformScale') }}</span>
                <span class="stats-badge">{{ _t('learnAI.industryGrade') }}</span>
              </div>
              <div class="stats-grid-v">
                <div class="stat-item">
                  <span class="stat-num">{{ animatedStats.microservices }}</span>
                  <span class="stat-unit">{{ _t('learnAI.microservicesUnit') }}</span>
                  <span class="stat-name">{{ _t('learnAI.microservicesName') }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-num">{{ animatedStats.api }}+</span>
                  <span class="stat-unit">{{ _t('learnAI.apiUnit') }}</span>
                  <span class="stat-name">{{ _t('learnAI.apiName') }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-num">{{ animatedStats.enterprise }}+</span>
                  <span class="stat-unit">{{ _t('learnAI.enterpriseUnit') }}</span>
                  <span class="stat-name">{{ _t('learnAI.enterpriseName') }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-num">{{ animatedStats.users }}<span class="stat-suffix">{{ _t('learnAI.tenThousand') }}+</span></span>
                  <span class="stat-unit">{{ _t('learnAI.userUnit') }}</span>
                  <span class="stat-name">{{ _t('learnAI.userName') }}</span>
                </div>
              </div>
              <div class="stats-footer">
                <span class="tech-tag">Spring Cloud</span>
                <span class="tech-tag">Vue 3</span>
                <span class="tech-tag">AI Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. AI 核心能力 -->
    <section id="ai-capabilities" class="ai-section" aria-labelledby="learnai-ai-capabilities-heading">
      <div class="container">
        <div class="section-title centered scroll-reveal" data-animation="fadeInUp">
          <span class="idx">{{ _t('learnAI.sections.aiCore') }}</span>
          <h2 id="learnai-ai-capabilities-heading">{{ _t('learnAI.AI核心能力矩阵') }}</h2>
          <p>{{ _t('learnAI.六大AI能力模块全面') }}</p>
        </div>

        <div class="ai-grid">
          <div v-for="(cap, idx) in aiCapabilities" :key="cap.id" class="ai-card glass scroll-reveal"
            :data-delay="Number(idx) * 100" data-animation="fadeInUp">
            <div class="ai-icon">
              <el-icon>
                <component :is="cap.icon" />
              </el-icon>
            </div>
            <h3 class="ai-title">{{ cap.title }}</h3>
            <p class="ai-desc">{{ cap.desc }}</p>
            <div class="ai-features">
              <span v-for="f in cap.features" :key="f" class="ai-tag">{{ f }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. AI + 行业应用 -->
    <section id="learnai-industry" class="industry-section" aria-labelledby="learnai-industry-heading">
      <div class="container">
        <div class="section-title centered scroll-reveal" data-animation="fadeInUp">
          <span class="idx">{{ _t('learnAI.sections.aiIndustry') }}</span>
          <h2 id="learnai-industry-heading">{{ _t('learnAI.AI全行业赋能') }}</h2>
          <p>{{ _t('learnAI.用AI重新定义每一个') }}</p>
        </div>

        <div class="industry-grid">
          <div v-for="(ind, idx) in aiIndustries" :key="ind.id" class="industry-card glass scroll-reveal"
            :style="{ '--accent-color': ind.color }" :data-delay="Number(idx) * 80" data-animation="fadeInUp">
            <div class="ind-header">
              <h3>{{ ind.name }}</h3>
              <div class="ind-line"></div>
            </div>
            <p class="ind-desc">{{ ind.desc }}</p>
            <div class="ind-cases">
              <span v-for="c in ind.cases" :key="c" class="ind-case">{{ c }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. 技术全景：22 个微服务（悬停切换组件） -->
    <section id="architecture" class="architecture-section" aria-labelledby="learnai-architecture-heading">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.section01') }}</span>
          <h2 id="learnai-architecture-heading">{{ _t('learnAI.22个微服务全景生态') }}</h2>
          <div class="title-underline"></div>
        </div>

        <!-- 中台切换组件 -->
        <div class="centers-switcher">
          <!-- 左侧：中台导航标签 -->
          <div class="centers-nav">
            <div v-for="(center, index) in businessCenters" :key="center.id" class="center-tab"
              :class="{ active: activeCenterIndex === index }" @mouseenter="activeCenterIndex = index">
              <div class="tab-icon">
                <el-icon>
                  <component :is="center.icon" />
                </el-icon>
              </div>
              <div class="tab-content">
                <h3>{{ center.label }}</h3>
                <p>{{ center.desc }}</p>
              </div>
              <div class="tab-indicator"></div>
            </div>
          </div>

          <!-- 右侧：服务内容区 -->
          <div class="centers-content">
            <transition name="fade-slide" mode="out-in">
              <div :key="businessCenters[activeCenterIndex].id" class="services-panel">
                <div class="panel-header">
                  <div class="panel-icon">
                    <el-icon>
                      <component :is="businessCenters[activeCenterIndex].icon" />
                    </el-icon>
                  </div>
                  <div class="panel-info">
                    <h3>{{ businessCenters[activeCenterIndex].label }}</h3>
                    <span class="service-count">{{ businessCenters[activeCenterIndex].services.length }} {{
                      _t('learnAI.microservices') }}</span>
                  </div>
                </div>

                <div class="services-grid">
                  <div v-for="svc in businessCenters[activeCenterIndex].services" :key="svc.id" class="service-card">
                    <div class="card-head">
                      <el-icon class="icon">
                        <component :is="svc.icon" />
                      </el-icon>
                      <span class="svc-id">{{ _t('learnAI.servicePrefix') }}_{{ svc.id }}</span>
                    </div>
                    <h4 class="svc-title">{{ svc.title }}</h4>
                    <p class="svc-desc">{{ svc.desc }}</p>
                    <div class="card-footer">
                      <span class="svc-name">{{ svc.name }}</span>
                      <el-icon>
                        <ArrowRight />
                      </el-icon>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. 课程中心 -->
    <section id="course-center" class="course-center-section" aria-labelledby="learnai-course-heading">
      <div class="container">
        <div class="section-title centered scroll-reveal" data-animation="fadeInUp">
          <span class="idx">{{ _t('learnAI.sections.aiSolution') }}</span>
          <h2 id="learnai-course-heading">{{ _t('learnAI.courseCenterTitle') }}</h2>
          <p>{{ _t('learnAI.courseCenterSubtitle') }}</p>
        </div>

        <!-- 分类 Tab -->
        <div class="course-tabs scroll-reveal" data-animation="fadeInUp">
          <button
            v-for="tab in courseCategories"
            :key="tab.id"
            :class="['course-tab', { active: activeCourseCategory === tab.id }]"
            @click="activeCourseCategory = tab.id"
          >
            {{ tab.name }}
          </button>
        </div>

        <!-- 搜索 -->
        <div class="course-search scroll-reveal" data-animation="fadeInUp">
          <el-input v-model="courseSearchKeyword" :placeholder="_t('learnAI.searchCourses')" clearable @input="filterCourses">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>

        <!-- 课程列表 -->
        <div class="course-grid">
          <div
            v-for="(course, idx) in filteredCourses"
            :key="course.id"
            class="course-card glass scroll-reveal"
            :data-delay="Number(idx) * 80"
            data-animation="fadeInUp"
          >
            <div class="course-cover">
              <img :src="course.cover" :alt="course.title" loading="lazy" @error="handleImageError" />
              <span class="course-badge">{{ course.category }}</span>
            </div>
            <div class="course-body">
              <h4 class="course-title">{{ course.title }}</h4>
              <p class="course-desc">{{ course.description }}</p>
              <div class="course-tags">
                <span v-for="tag in course.tags" :key="tag" class="course-tag">{{ tag }}</span>
              </div>
              <div class="course-footer">
                <span class="course-stat">
                  <el-icon><View /></el-icon> {{ course.views }}
                </span>
                <span class="course-stat">
                  <el-icon><Clock /></el-icon> {{ course.duration }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredCourses.length === 0" class="course-empty">
          <p>{{ _t('learnAI.noCourses') }}</p>
        </div>
      </div>
    </section>

    <!-- 5. 定价方案 -->
    <section id="pricing" class="pricing-section" aria-labelledby="learnai-pricing-heading">
      <div class="container">
        <div class="section-title centered scroll-reveal" data-animation="fadeInUp">
          <span class="idx">{{ _t('learnAI.sections.section02') }}</span>
          <h2 id="learnai-pricing-heading">{{ _t('learnAI.全量源码交付方案') }}</h2>
          <p>{{ _t('learnAI.一次性获取全套数字化') }}</p>
        </div>

        <div class="pricing-grid">
          <div v-for="(plan, idx) in pricingPlans" :key="plan.id" class="pricing-card glass scroll-reveal"
            :class="{ 'hot': plan.recommended }" :data-delay="Number(idx) * 150" data-animation="fadeInUp">
            <div v-if="plan.recommended" class="hot-tag">{{ _t('learnAI.recommended') }}</div>
            <div class="plan-header">
              <span class="p-name">{{ plan.name }}</span>
              <div class="p-price">
                <span class="currency">¥</span>
                <span class="amount">{{ plan.price }}</span>
              </div>
              <span class="p-services">{{ plan.services }}</span>
            </div>
            <p class="p-desc">{{ plan.desc }}</p>
            <ul class="p-features">
              <li v-for="feat in plan.features" :key="feat">
                <el-icon class="check">
                  <CircleCheckFilled />
                </el-icon>
                <span>{{ feat }}</span>
              </li>
            </ul>
            <button class="plan-btn" :class="{ 'primary': plan.recommended }">{{ _t('learnAI.申请商业授权') }}</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 7. 平台数据统计 -->
    <section class="stats-section">
      <div class="container">
        <div class="section-title centered scroll-reveal" data-animation="fadeInUp">
          <span class="idx">{{ _t('learnAI.sections.aiScale') }}</span>
          <h2>{{ _t('learnAI.AI平台规模') }}</h2>
          <p>{{ _t('learnAI.持续3年AI能力沉淀') }}</p>
        </div>

        <div class="stats-grid">
          <div v-for="(stat, idx) in platformStats" :key="stat.label" class="stat-card glass scroll-reveal glow-border"
            :data-delay="Number(idx) * 100" data-animation="fadeInUp">
            <div class="stat-icon pulse-glow">
              <el-icon>
                <component :is="stat.icon" />
              </el-icon>
            </div>
            <div class="stat-value">
              <span class="number count-up gradient-text" :data-target="stat.value" :data-count-id="stat.label">{{
                animatedNumbers.get(stat.label) || 0 }}</span>
              <span class="suffix">{{ stat.suffix }}</span>
            </div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 8. 技术栈展示 -->
    <section class="tech-section">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.aiTech') }}</span>
          <h2>{{ _t('learnAI.AI技术架构') }}</h2>
          <p>{{ _t('learnAI.大模型微服务构建企业') }}</p>
        </div>

        <div class="tech-grid">
          <div v-for="stack in techStacks" :key="stack.category" class="tech-card glass">
            <h4 class="tech-category">{{ stack.category }}</h4>
            <div class="tech-items">
              <span v-for="item in stack.items" :key="item" class="tech-item">{{ item }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 9. 适用场景 -->
    <section class="usecase-section">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.aiSolution') }}</span>
          <h2>{{ _t('learnAI.AI解决方案') }}</h2>
          <p>{{ _t('learnAI.四大AI场景覆盖学习') }}</p>
        </div>

        <div class="usecase-grid">
          <div v-for="(uc, idx) in useCases" :key="idx" class="usecase-card glass">
            <div class="uc-number">0{{ Number(idx) + 1 }}</div>
            <h4 class="uc-title">{{ uc.title }}</h4>
            <p class="uc-desc">{{ uc.desc }}</p>
            <div class="uc-features">
              <span v-for="f in uc.features" :key="f" class="uc-tag">{{ f }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 10. 客户成功案例 -->
    <section class="cases-section">
      <div class="container">
        <div class="section-title centered scroll-reveal" data-animation="fadeInUp">
          <span class="idx">{{ _t('learnAI.sections.successStory') }}</span>
          <h2>{{ _t('learnAI.客户成功案例') }}</h2>
          <p>{{ _t('learnAI.已帮助500企业实现') }}</p>
        </div>

        <div class="cases-grid">
          <div v-for="(c, idx) in customerCases" :key="c.id" class="case-card glass scroll-reveal"
            :data-delay="Number(idx) * 150" data-animation="fadeInUp">
            <div class="case-header">
              <img class="case-logo" :src="c.logo" :alt="c.company" loading="lazy" decoding="async"
                @error="handleImageError" />
              <div class="case-info">
                <h4>{{ c.company }}</h4>
                <span class="case-industry">{{ c.industry }}</span>
              </div>
            </div>
            <div class="case-challenge">
              <span class="label">{{ _t('learnAI.痛点') }}</span>
              <p>{{ c.challenge }}</p>
            </div>
            <div class="case-solution">
              <span class="label">{{ _t('learnAI.方案') }}</span>
              <p>{{ c.solution }}</p>
            </div>
            <div class="case-results">
              <div v-for="r in c.results" :key="r.metric" class="result-item">
                <span class="result-value">{{ r.value }}</span>
                <span class="result-metric">{{ r.metric }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 11. 客户评价 -->
    <section class="testimonials-section">
      <div class="container">
        <div class="section-title centered scroll-reveal" data-animation="fadeInUp">
          <span class="idx">{{ _t('learnAI.sections.testimonials') }}</span>
          <h2>{{ _t('learnAI.客户口碑') }}</h2>
          <p>{{ _t('learnAI.听听他们怎么说') }}</p>
        </div>

        <div class="testimonials-grid">
          <div v-for="(item, idx) in testimonials" :key="item.author" class="testimonial-card glass scroll-reveal"
            :data-delay="Number(idx) * 120" data-animation="fadeInUp">
            <div class="quote-icon">"</div>
            <p class="testimonial-content">{{ item.content }}</p>
            <div class="testimonial-author">
              <img class="author-avatar" :src="item.avatar" :alt="item.author" loading="lazy" decoding="async"
                @error="handleImageError" />
              <div class="author-info">
                <span class="author-name">{{ item.author }}</span>
                <span class="author-role">{{ item.role }} · {{ item.company }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 12. 合作伙伴生态 -->
    <section class="partners-section">
      <div class="container">
        <div class="section-title centered scroll-reveal" data-animation="fadeInUp">
          <span class="idx">{{ _t('learnAI.sections.aiEcosystem') }}</span>
          <h2>{{ _t('learnAI.AI生态伙伴') }}</h2>
          <p>{{ _t('learnAI.深度整合主流AI大模') }}</p>
        </div>

        <div class="partners-wrap">
          <div class="partner-category">
            <h4>{{ _t('learnAI.AI大模型') }}</h4>
            <div class="partner-logos">
              <span v-for="p in partners.aiModels" :key="p" class="partner-logo glass">{{ p }}</span>
            </div>
          </div>
          <div class="partner-category">
            <h4>{{ _t('learnAI.云服务') }}</h4>
            <div class="partner-logos">
              <span v-for="p in partners.cloudServices" :key="p" class="partner-logo glass">{{ p }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 13. 荣誉资质 -->
    <section class="achievements-section">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.credentials') }}</span>
          <h2>{{ _t('learnAI.荣誉资质') }}</h2>
          <p>{{ _t('learnAI.权威认证品质保障') }}</p>
        </div>

        <div class="achievements-grid">
          <div v-for="a in achievements" :key="a.title" class="achievement-card glass">
            <span class="achievement-icon">{{ a.icon }}</span>
            <h4>{{ a.title }}</h4>
            <p>{{ a.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 14. 服务承诺 -->
    <section class="service-section">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.serviceSla') }}</span>
          <h2>{{ _t('learnAI.服务承诺') }}</h2>
          <p>{{ _t('learnAI.企业级服务保障让您无') }}</p>
        </div>

        <div class="service-grid">
          <div v-for="s in servicePromises" :key="s.title" class="service-card glass">
            <div class="service-icon">
              <el-icon>
                <component :is="s.icon" />
              </el-icon>
            </div>
            <h4>{{ s.title }}</h4>
            <p>{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 15. 资源下载 -->
    <section class="resources-section">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.resources') }}</span>
          <h2>{{ _t('learnAI.资源下载') }}</h2>
          <p>{{ _t('learnAI.免费获取深度资料助力') }}</p>
        </div>

        <div class="resources-grid">
          <div v-for="r in resources" :key="r.title" class="resource-card glass">
            <span class="resource-icon">{{ r.icon }}</span>
            <div class="resource-info">
              <h4>{{ r.title }}</h4>
              <p>{{ r.desc }}</p>
            </div>
            <button class="resource-btn">
              {{ r.type === 'VIDEO' ? _t('learnAI.watchNow') : _t('learnAI.freeDownload') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 16. 能力对比矩阵 -->
    <section class="comparison-section">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.section06') }}</span>
          <h2>{{ _t('learnAI.核心能力对比矩阵') }}</h2>
          <p>{{ _t('learnAI.labGradeSpecs') }}</p>
        </div>

        <div class="comparison-matrix-wrap glass">
          <table class="comparison-table">
            <thead>
              <tr>
                <th class="feature-col">{{ _t('learnAI.能力项') }}</th>
                <th>{{ _t('learnAI.标准版') }}</th>
                <th>{{ _t('learnAI.专业版') }}</th>
                <th class="hot">{{ _t('learnAI.企业版') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in matrixData" :key="row.item">
                <td class="feature-name">{{ row.item }}</td>
                <td>{{ row.std }}</td>
                <td>{{ row.pro }}</td>
                <td class="hot-cell">{{ row.ent }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 9. 安全保障 -->
    <section class="security-section">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.section07') }}</span>
          <h2>{{ _t('learnAI.安全保障') }}</h2>
          <p>{{ _t('learnAI.企业级安全防护保障数') }}</p>
        </div>

        <div class="security-grid">
          <div v-for="sec in securityFeatures" :key="sec.title" class="security-card glass">
            <div class="sec-icon">
              <el-icon>
                <component :is="sec.icon" />
              </el-icon>
            </div>
            <h4 class="sec-title">{{ sec.title }}</h4>
            <p class="sec-desc">{{ sec.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 10. 常见问题 -->
    <section class="faq-section">
      <div class="container">
        <div class="section-title centered">
          <span class="idx">{{ _t('learnAI.sections.section08') }}</span>
          <h2>{{ _t('learnAI.常见问题') }}</h2>
          <p>{{ _t('learnAI.解答您关心的问题') }}</p>
        </div>

        <div class="faq-list">
          <div v-for="(faq, idx) in faqList" :key="idx" class="faq-item glass">
            <div class="faq-q">
              <span class="q-icon">Q</span>
              <span class="q-text">{{ faq.q }}</span>
            </div>
            <div class="faq-a">
              <span class="a-icon">A</span>
              <span class="a-text">{{ faq.a }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 11. 联系咨询 CTA -->
    <section class="cta-section">
      <div class="container">
        <div class="cta-content glass">
          <div class="cta-text">
            <h2>{{ _t('learnAI.开启AI赋能之旅') }}</h2>
            <p>{{ _t('learnAI.立即体验AI能力获取') }}</p>
          </div>
          <div class="cta-actions">
            <button class="btn-luxe primary large">{{ _t('learnAI.免费试用AI') }}</button>
            <button class="btn-luxe ghost large" @click="goToDocumentation">{{ _t('learnAI.获取解决方案') }}</button>
          </div>
          <div class="cta-contact">
            <span>{{ _t('learnAI.电话') }}</span>
            <span>{{ _t('learnAI.邮箱') }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as bp;

$bg-page: var(--el-bg-color-page);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);

// 使用项目规范的黑色主题，蓝色仅作点缀
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--color-gray-333);
$accent-highlight: var(--el-text-color-primary); // 仅用于少量点缀

// ============ 滚动进度指示器 ============


.ihui-edu-showcase-root {
  background: $bg-page;
  color: $text-main;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  font-family: var(--font-family-chinese);
  padding-top: 0;

}

.showcase-bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
}

// ============ 滚动触发动画系统 ============
.scroll-reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: none;

  &.scroll-animated {
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.animate-fadeInUp {
    opacity: 1;
    transform: translateY(0);
  }

  &.animate-fadeInLeft {
    opacity: 1;
    transform: translateX(0);
  }

  &.animate-fadeInRight {
    opacity: 1;
    transform: translateX(0);
  }

  &.animate-fadeInScale {
    opacity: 1;
    transform: scale(1);
  }
}

// 从左侧进入的初始状态
.scroll-reveal[data-animation="fadeInLeft"] {
  transform: translateX(-40px);
}

// 从右侧进入的初始状态
.scroll-reveal[data-animation="fadeInRight"] {
  transform: translateX(40px);
}

// 缩放进入的初始状态
.scroll-reveal[data-animation="fadeInScale"] {
  transform: scale(0.9);
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(60px, 60px);
  }
}

@keyframes floatOrb {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  25% {
    transform: translate(30px, -20px) scale(1.05);
  }

  50% {
    transform: translate(-20px, 30px) scale(0.95);
  }

  75% {
    transform: translate(-30px, -10px) scale(1.02);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }

  51%,
  100% {
    opacity: 0;
  }
}

// 数字计数动画
@keyframes countUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 光泽扫过动画
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }

  100% {
    background-position: 200% 0;
  }
}

// 边框流光动画
@keyframes borderGlow {
  0%,
  100% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }
}

// 脉冲发光（扁平化：用透明度替代阴影）
@keyframes pulseGlow {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.85;
  }
}

// 涟漪扩散
@keyframes rippleExpand {
  0% {
    transform: scale(0);
    opacity: 0.6;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

// 渐变文字流动
@keyframes gradientFlow {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

// 光束扫过
@keyframes lightBeam {
  0% {
    left: -100%;
  }

  100% {
    left: 200%;
  }
}

// 浮动动画
@keyframes gentleFloat {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

// ============ 高级交互效果 ============

// 磁吸按钮
.magnetic-btn {
  position: relative;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  .btn-text {
    position: relative;
    z-index: calc(var(--z-base) + 1);
  }

}

// 涟漪效果容器
.ripple-btn {
  position: relative;
  overflow: hidden;
}



// 渐变文字
.gradient-text {
  color: $brand-primary;
}

// 脉冲发光图标
.pulse-glow {
  animation: pulseGlow 2s ease-in-out infinite;
}



// 悬浮卡片增强
.hover-lift {
  border: var(--unified-border);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: rgba($brand-primary, 0.3);
  }
}

// 柔和浮动
.gentle-float {
  animation: gentleFloat 4s ease-in-out infinite;
}

// 视差层
.parallax-layer {
  transform: translateY(calc(var(--parallax-y) * -1));
  will-change: transform;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 40px;
  position: relative;
  z-index: var(--z-base);
}

.hero-section {
  padding: 40px 0 60px;

  .hero-wrapper {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 80px;
    align-items: center;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 16px;

    .status-dot {
      width: 6px;
      height: 6px;
      background: $brand-secondary;
      border-radius: var(--global-border-radius);
      animation: pulse 2s infinite;
    }
  }

  .hero-title {
    font-size: clamp(42px, 5vw, 72px);
    font-weight: 950;
    line-height: 1.2;
    letter-spacing: -0.04em;

    .accent-gradient {
      color: $brand-primary;
    }

    .cursor-line {
      animation: blink 1s infinite;
    }
  }

  .hero-desc {
    font-size: 18px;
    color: $text-sec;
    margin: 40px 0 60px;
    line-height: 1.8;
    max-width: 650px;

    strong {
      color: $brand-primary;
      font-weight: 900;
    }
  }
}

.hero-actions {
  display: flex;

  .hero-action-link {
    text-decoration: none;
    color: inherit;
  }

  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  overflow: hidden;
}

/* 全部 hero 按钮：禁用磁吸位移，避免容器扩大，行为统一 */
.hero-actions .hero-action-edu {
  transform: none ;
  transition: background-color 0.2s, border-color 0.2s;
  will-change: auto;
}

.hero-actions .hero-action-edu:hover,
.hero-actions .hero-action-edu:active {
  transform: none ;
}

.ai-section {
  padding: 40px 0;
}

.ai-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.ai-card {
  padding: 32px 28px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  background: transparent;

  &:hover {
    border-color: rgba($brand-primary, 0.25);

    .ai-icon {
      color: var(--el-bg-color);
      transform: scale(1.1);
    }
  }

  .ai-icon {
    width: 64px;
    height: 64px;
    color: $brand-primary;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    margin-bottom: 24px;
    transition: all 0.4s;
  }

  .ai-title {
    font-size: 22px;
    font-weight: 900;
    margin: 0 0 12px;
  }

  .ai-desc {
    font-size: 14px;
    color: $text-sec;
    line-height: 1.7;
    margin: 0 0 24px;
  }

  .ai-features {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ai-tag {
    font-size: 12px;
    font-weight: 700;
    padding: 6px 14px;
    color: $brand-primary;
    border-radius: var(--global-border-radius);
  }
}

.industry-section {
  padding: 40px 0;
}

.industry-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.industry-card {
  padding: 32px 24px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: all 0.4s;
  background: transparent;

  &:hover {
    border-color: rgba($brand-primary, 0.25);

    .ind-line {
      width: 100%;
    }
  }

  .ind-header {
    margin-bottom: 20px;

    h3 {
      font-size: 20px;
      font-weight: 900;
      margin: 0 0 16px;
    }

    .ind-line {
      height: 3px;
      width: 48px;
      border-radius: var(--global-border-radius);
      transition: width 0.4s;
    }
  }

  .ind-desc {
    font-size: 14px;
    color: $text-sec;
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .ind-cases {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ind-case {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent-color);
    padding-left: 16px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 6px;
      height: 6px;
      border-radius: var(--global-border-radius);
    }
  }
}

.platform-stats-visual {
  display: flex;
  align-items: center;
  justify-content: center;

  .stats-card {
    width: 380px;
    padding: 32px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    background: var(--el-bg-color);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: rgba($brand-primary, 0.25);
      transform: translateY(-4px);
    }
  }

  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: var(--unified-border-bottom);

    .stats-label {
      font-size: 14px;
      font-weight: 800;
      color: $text-main;
    }

    .stats-badge {
      font-size: 12px;
      font-weight: 900;
      color: $brand-primary;
      padding: 4px 12px;
      border-radius: var(--global-border-radius);
      background: var(--el-fill-color-light);
    }
  }

  .stats-grid-v {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin-bottom: 28px;
  }

  .stat-item {
    text-align: center;
    padding: 16px 8px;
    border-radius: var(--global-border-radius);
    background: var(--el-fill-color-light);
    transition: all 0.3s ease;

    &:hover {
      background: var(--el-fill-color);

      .stat-num {
        color: $brand-primary;
      }
    }

    .stat-num {
      font-size: 36px;
      font-weight: 950;
      color: $text-main;
      line-height: 1;
      transition: color 0.3s ease;

      .stat-suffix {
        font-size: 18px;
        font-weight: 800;
      }
    }

    .stat-unit {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: $brand-primary;
      margin-top: 4px;
    }

    .stat-name {
      display: block;
      font-size: 12px;
      color: $text-sec;
      margin-top: 6px;
    }
  }

  .stats-footer {
    display: flex;
    justify-content: center;
    gap: 12px;
    padding-top: 20px;
    border-top: var(--unified-border);

    .tech-tag {
      font-size: 12px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
      color: $text-sec;
      transition: all 0.3s ease;

      &:hover {
        border-color: rgba($brand-primary, 0.3);
        color: $brand-primary;
      }
    }
  }
}

.architecture-section {
  padding: 40px 0;
}

// 中台切换组件样式
.centers-switcher {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 48px;
  min-height: 560px;
}

/* 中台导航容器 */
.centers-nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 20px;
}

/* 中台选项卡 */
.center-tab {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  cursor: pointer;
  position: relative;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    transform: translateX(4px);
    border-width: 2px;
  }

  &.active {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    background: var(--el-fill-color-light);
    border-width: 2px;

    &:hover {
      transform: translateX(4px);
    }
  }

  .tab-icon {
    width: 48px;
    height: 48px;
    color: var(--el-color-primary);
    background: var(--el-fill-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
    border-radius: var(--global-border-radius);
    transition: all 0.3s ease;
  }

  &:hover .tab-icon {
    background: var(--el-color-primary);
    color: var(--el-bg-color);
    transform: scale(1.05);
  }

  &.active .tab-icon {
    background: var(--el-color-primary);
    color: var(--el-bg-color);
  }

  .tab-content {
    flex: 1;
    min-width: 0;

    h3 {
      font-size: 16px;
      font-weight: 800;
      margin: 0 0 6px;
      color: var(--el-text-color-primary);
      transition: all 0.3s ease;
    }

    p {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin: 0;
      line-height: 1.5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  &.active .tab-content h3 {
    color: var(--el-color-primary);
  }

  .tab-indicator {
    position: absolute;
    left: -1px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 0;
    background: var(--el-color-primary);
    border-radius: 0 2px 2px 0;
    transition: height 0.3s ease;
  }

  &.active .tab-indicator {
    height: 50%;
  }
}

.centers-content {
  position: relative;
}

/* 服务面板容器 */
.services-panel {
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 32px;
  transition: all 0.3s ease;
}

/* 面板头部 */
.services-panel .panel-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 32px;
  padding: 24px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: all 0.3s ease;

  &:hover {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    border-width: 2px;
  }

  .panel-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    color: var(--el-color-primary);
    background: var(--el-fill-color);
    border-radius: var(--global-border-radius);
    transition: all 0.3s ease;
  }

  &:hover .panel-icon {
    background: var(--el-color-primary);
    color: var(--el-bg-color);
    transform: scale(1.05);
  }

  .panel-info h3 {
    font-size: 24px;
    font-weight: 900;
    margin: 0 0 6px;
    color: var(--el-text-color-primary);
  }

  .service-count {
    font-size: 13px;
    color: var(--el-color-primary);
    font-weight: 700;
  }
}

/* 服务网格 */
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

/* 服务卡片 */
:where(.services-panel) :where(.services-grid) .service-card {
  padding: 28px;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &:hover {
    transform: translateY(-4px);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    border-width: 2px;
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;

    .icon {
      font-size: 22px;
      color: var(--el-color-primary);
      transition: all 0.3s ease;
    }

    .svc-id {
      font-size: 12px;
      font-weight: 900;
      color: var(--el-text-color-secondary);
      opacity: 0.6;
      font-family: var(--font-family-mono);
      transition: all 0.3s ease;
    }
  }

  &:hover .card-head .icon {
    transform: scale(1.1) rotate(5deg);
  }

  &:hover .card-head .svc-id {
    color: var(--el-color-primary);
    opacity: 1;
  }

  .svc-title {
    font-size: 17px;
    font-weight: 900;
    margin-bottom: 10px;
    color: var(--el-text-color-primary);
    transition: all 0.3s ease;
  }

  &:hover .svc-title {
    color: var(--el-color-primary);
  }

  .svc-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    flex-grow: 1;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    padding-top: 16px;
    border-top: var(--unified-border);

    .svc-name {
      font-size: 12px;
      font-weight: 900;
      color: var(--el-text-color-secondary);
      opacity: 0.6;
      text-transform: uppercase;
      transition: all 0.3s ease;
    }

    .el-icon {
      color: var(--el-text-color-secondary);
      opacity: 0.4;
      transition: all 0.3s ease;
    }
  }

  &:hover .card-footer .svc-name {
    opacity: 1;
    color: var(--el-color-primary);
  }

  &:hover .card-footer .el-icon {
    opacity: 1;
    color: var(--el-color-primary);
    transform: translateX(4px);
  }
}

// 切换动画
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 定价区域 */
.pricing-section {
  padding: 60px 0;
}

/* 定价网格 */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 定价卡片 */
.pricing-card {
  padding: 28px 24px;
  border-radius: var(--global-border-radius);
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: var(--unified-border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-6px);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    border-width: 2px;
  }

  /* 推荐卡片 */
  &.hot {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    background: var(--el-fill-color-light);
    transform: scale(1.02);
    z-index: calc(var(--z-base) + 1);

    &:hover {
      transform: scale(1.02) translateY(-6px);
      border-width: 2px;
    }
  }

  /* 推荐标签 */
  .hot-tag {
    position: absolute;
    top: 16px;
    right: 16px;
    background: var(--el-color-primary);
    color: var(--el-bg-color);
    font-size: 12px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: var(--global-border-radius);
    letter-spacing: 0.5px;
  }

  /* 方案头部 */
  .plan-header {
    margin-bottom: 20px;

    .p-name {
      font-size: 13px;
      font-weight: 800;
      color: var(--el-text-color-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .p-price {
      margin: 16px 0 8px;
      display: flex;
      align-items: baseline;
      gap: 2px;

      .currency {
        font-size: 20px;
        font-weight: 800;
        color: var(--el-text-color-primary);
      }

      .amount {
        font-size: 36px;
        font-weight: 900;
        letter-spacing: -0.02em;
        color: var(--el-text-color-primary);
      }
    }

    .p-services {
      font-size: 12px;
      font-weight: 700;
      color: var(--el-color-primary);
      background: var(--el-fill-color);
      padding: 4px 10px;
      border-radius: var(--global-border-radius);
      display: inline-block;
    }
  }

  /* 方案描述 */
  .p-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin: 0 0 20px;
    line-height: 1.5;
    min-height: 40px;
  }

  /* 功能列表 */
  .p-features {
    list-style: none;
    padding: 0;
    margin: 0 0 24px;
    flex-grow: 1;

    li {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);

      .check {
        color: var(--el-color-primary);
        font-size: 16px;
        flex-shrink: 0;
      }
    }
  }

  /* 申请按钮 */
  .plan-btn {
    height: 44px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    background: var(--el-fill-color);
    color: var(--el-text-color-primary);
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;

    &.primary {
      background: var(--el-color-primary);
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      color: var(--el-bg-color);
    }

    &:hover {
      background: var(--el-color-primary);
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      color: var(--el-bg-color);
      transform: translateY(-2px);
      border-width: 2px;
    }
  }
}

.stats-section {
  padding: 40px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 20px;
}

.stat-card {
  padding: 32px 20px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  text-align: center;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  background: transparent;

  &:hover {
    border-color: rgba($brand-primary, 0.25);

    .stat-icon {
      color: var(--el-bg-color);
      transform: scale(1.1) rotate(5deg);
    }

    .number {
      animation: gradientFlow 2s ease infinite;
    }
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 20px;
    color: $brand-primary;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    z-index: var(--z-base);
  }

  .stat-value {
    margin-bottom: 8px;
    position: relative;
    z-index: var(--z-base);

    .number {
      font-size: 42px;
      font-weight: 950;
      letter-spacing: -0.02em;
      color: $brand-primary;
    }

    .suffix {
      font-size: 16px;
      font-weight: 800;
      color: $text-sec;
    }
  }

  .stat-label {
    font-size: 14px;
    color: $text-sec;
    font-weight: 700;
  }
}

.tech-section {
  padding: 40px 0;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.tech-card {
  padding: 32px;
  border-radius: var(--global-border-radius);

  .tech-category {
    font-size: 14px;
    font-weight: 900;
    color: $brand-primary;
    margin: 0 0 20px;
    text-transform: uppercase;
  }

  .tech-items {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tech-item {
    font-size: 15px;
    font-weight: 700;
    padding: 12px 16px;
    border-radius: var(--global-border-radius);
    transition: all 0.3s;

    &:hover {
      color: $brand-primary;
    }
  }
}

// ============ 课程中心 ============
.course-center-section {
  padding: 40px 0;
}

.course-tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.course-tab {
  background: var(--el-fill-color-extra-light);
  border: var(--unified-border);
  color: var(--el-text-color-secondary);
  padding: 8px 20px;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;

  &.active {
    background: $brand-primary;
    color: var(--el-bg-color);
    border-color: $brand-primary;
  }
}

html.dark .course-tab {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color);
}

html.dark .course-tab.active {
  background: var(--el-color-primary);
  color: var(--el-text-color-primary);
  border-color: var(--el-color-primary);
}

.course-search {
  max-width: 480px;
  margin: 0 auto 32px;
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.course-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: all 0.4s;
  cursor: pointer;

  &:hover {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    transform: translateY(-4px);
  }

  .course-cover {
    position: relative;
    height: 180px;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .course-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: var(--el-color-primary);
      color: var(--el-bg-color);
      padding: 4px 10px;
      border-radius: var(--global-border-radius);
      font-size: 12px;
      font-weight: 700;
    }
  }

  .course-body {
    padding: 20px;
  }

  .course-title {
    font-size: 16px;
    font-weight: 800;
    color: var(--el-text-color-primary);
    margin: 0 0 8px;
  }

  .course-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    margin: 0 0 12px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .course-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .course-tag {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    border: var(--unified-border);
    padding: 2px 8px;
    border-radius: var(--global-border-radius);
  }

  .course-footer {
    display: flex;
    justify-content: space-between;
    padding-top: 12px;
    border-top: var(--unified-border);
  }

  .course-stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    font-family: var(--font-family-mono);
  }
}

.course-empty {
  text-align: center;
  padding: 60px 0;
  color: var(--el-text-color-secondary);
}

.usecase-section {
  padding: 40px 0;
}

.usecase-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.usecase-card {
  padding: 32px 28px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: all 0.4s;
  background: transparent;

  &:hover {
    border-color: rgba($brand-primary, 0.2);
  }

  .uc-number {
    font-size: 48px;
    font-weight: 950;
    color: rgba($brand-primary, 0.15);
    margin-bottom: 16px;
  }

  .uc-title {
    font-size: 20px;
    font-weight: 900;
    margin: 0 0 12px;
  }

  .uc-desc {
    font-size: 14px;
    color: $text-sec;
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .uc-features {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .uc-tag {
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    color: $brand-primary;
    border-radius: var(--global-border-radius);
  }
}

.comparison-section {
  padding: 40px 0;
}

.comparison-matrix-wrap {
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  overflow: hidden;

  .comparison-table {
    width: 100%;
    border-collapse: collapse;

    th,
    td {
      padding: 24px 32px;
      text-align: center;
      border-bottom: var(--unified-border-bottom);
    }

    th {
      font-weight: 900;
      font-size: 13px;
    }

    .feature-col {
      text-align: left;
      width: 340px;
      opacity: 0.5;
    }

    .feature-name {
      text-align: left;
      font-weight: 800;
    }

    .hot {
      color: $brand-primary;
    }

    .hot-cell {
      font-weight: 900;
      color: $brand-primary;
    }
  }
}

.security-section {
  padding: 40px 0;
}

.security-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.security-card {
  padding: 32px 28px;
  border-radius: var(--global-border-radius);
  transition: all 0.3s;
  background: transparent;

  .sec-icon {
    width: 52px;
    height: 52px;
    color: $brand-primary;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    margin-bottom: 20px;
  }

  .sec-title {
    font-size: 18px;
    font-weight: 900;
    margin: 0 0 12px;
  }

  .sec-desc {
    font-size: 14px;
    color: $text-sec;
    line-height: 1.6;
    margin: 0;
  }
}

.faq-section {
  padding: 40px 0;
}

.faq-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.faq-item {
  padding: 28px;
  border-radius: var(--global-border-radius);

  .faq-q {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;

    .q-icon {
      width: 28px;
      height: 28px;
      color: var(--el-bg-color);
      border-radius: var(--global-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 900;
      flex-shrink: 0;
    }

    .q-text {
      font-size: 16px;
      font-weight: 800;
      line-height: 1.5;
    }
  }

  .faq-a {
    display: flex;
    gap: 16px;

    .a-icon {
      width: 28px;
      height: 28px;
      color: $brand-primary;
      border-radius: var(--global-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 900;
      flex-shrink: 0;
    }

    .a-text {
      font-size: 14px;
      color: $text-sec;
      line-height: 1.7;
    }
  }
}

.cases-section {
  padding: 40px 0;
}

.cases-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.case-card {
  padding: 32px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  background: transparent;

  &:hover {
    border-color: rgba($brand-primary, 0.25);

    .case-logo {
      transform: scale(1.05);
      border-color: rgba($brand-primary, 0.35);
    }
  }

  .case-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 24px;
    border-bottom: var(--unified-border-bottom);

    .case-logo {
      width: 60px;
      height: 60px;
      border-radius: var(--global-border-radius);
      object-fit: cover;
      flex-shrink: 0;
      border: 2px solid var(--border-unified-color);
      transition: all 0.3s;
    }

    .case-info {
      h4 {
        font-size: 18px;
        font-weight: 900;
        margin: 0 0 6px;
      }

      .case-industry {
        display: inline-block;
        font-size: 12px;
        color: var(--el-bg-color);
        font-weight: 700;
        padding: 3px 10px;
        border-radius: var(--global-border-radius);
      }
    }
  }

  .case-challenge,
  .case-solution {
    margin-bottom: 20px;

    .label {
      display: inline-block;
      font-size: 12px;
      font-weight: 900;
      padding: 4px 12px;
      color: $brand-primary;
      border-radius: var(--global-border-radius);
      margin-bottom: 10px;
    }

    p {
      font-size: 14px;
      color: $text-sec;
      line-height: 1.7;
      margin: 0;
    }
  }

  .case-solution .label {
    color: var(--color-emerald-500);
  }

  .case-results {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding-top: 24px;
    border-top: var(--unified-border);

    .result-item {
      text-align: center;
      padding: 12px 8px;
      border-radius: var(--global-border-radius);

      .result-value {
        display: block;
        font-size: 18px;
        font-weight: 950;
        color: $brand-primary;
        margin-bottom: 4px;
      }

      .result-metric {
        font-size: 12px;
        color: $text-sec;
        font-weight: 600;
      }
    }
  }
}

.testimonials-section {
  padding: 40px 0;
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.testimonial-card {
  padding: 32px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  position: relative;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  background: transparent;

  &:hover {
    border-color: rgba($brand-primary, 0.2);

    .quote-icon {
      transform: scale(1.1);
      color: rgba($brand-primary, 0.2);
    }

    .author-avatar {
      transform: scale(1.05);
    }
  }

  .quote-icon {
    position: absolute;
    top: 24px;
    left: 32px;
    font-size: 72px;
    font-weight: 900;
    color: rgba($brand-primary, 0.15);
    line-height: 1;
    transition: all 0.3s;
  }

  .testimonial-content {
    font-size: 15px;
    line-height: 1.9;
    color: $text-sec;
    margin: 0 0 28px;
    position: relative;
    z-index: var(--z-base);
    padding-top: 20px;
    font-style: italic;
  }

  .testimonial-author {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-top: 20px;
    border-top: var(--unified-border);

    .author-avatar {
      width: 52px;
      height: 52px;
      border-radius: var(--global-border-radius);
      object-fit: cover;
      flex-shrink: 0;
      border: 2px solid var(--border-unified-color);
      transition: all 0.3s;
    }

    .author-info {
      .author-name {
        display: block;
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 2px;
      }

      .author-role {
        font-size: 13px;
        color: $text-sec;
      }
    }
  }
}

.partners-section {
  padding: 40px 0;
}

.partners-wrap {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.partner-category {
  text-align: center;

  h4 {
    font-size: 14px;
    font-weight: 900;
    color: $text-sec;
    margin: 0 0 24px;
    text-transform: uppercase;
  }

  .partner-logos {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .partner-logo {
    padding: 16px 32px;
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 800;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-4px);
      border-color: rgba($brand-primary, 0.2);
    }
  }
}

.achievements-section {
  padding: 40px 0;
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.achievement-card {
  padding: 36px 24px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  text-align: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  background: transparent;

  &:hover {
    transform: translateY(-6px);
    border-color: rgba($brand-primary, 0.25);

    &::before {
      opacity: 1;
    }

    .achievement-icon {
      transform: scale(1.15);
    }
  }

  .achievement-icon {
    font-size: 52px;
    display: block;
    margin-bottom: 20px;
    transition: transform 0.3s;
  }

  h4 {
    font-size: 18px;
    font-weight: 900;
    margin: 0 0 8px;
  }

  p {
    font-size: 13px;
    color: $text-sec;
    margin: 0;
  }
}

.service-section {
  padding: 40px 0;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.service-card {
  padding: 32px 24px;
  border-radius: var(--global-border-radius);
  text-align: center;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);

    .service-icon {
      color: var(--el-bg-color);
    }
  }

  .service-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 20px;
    color: $brand-primary;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    transition: all 0.3s;
  }

  h4 {
    font-size: 18px;
    font-weight: 900;
    margin: 0 0 8px;
  }

  p {
    font-size: 13px;
    color: $text-sec;
    margin: 0;
    line-height: 1.6;
  }
}

.resources-section {
  padding: 40px 0;
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.resource-card {
  padding: 28px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-4px);
    border-color: rgba($brand-primary, 0.2);
  }

  .resource-icon {
    font-size: 36px;
    flex-shrink: 0;
  }

  .resource-info {
    flex: 1;
    min-width: 0;

    h4 {
      font-size: 15px;
      font-weight: 800;
      margin: 0 0 4px;
    }

    p {
      font-size: 12px;
      color: $text-sec;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .resource-btn {
    padding: 8px 16px;
    border-radius: var(--global-border-radius);
    color: $brand-primary;
    font-size: 12px;
    font-weight: 800;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.3s;

    &:hover {
      color: var(--el-bg-color);
    }
  }
}

.cta-section {
  padding: 40px 0;
}

.cta-content {
  padding: 40px;
  border-radius: var(--global-border-radius);
  text-align: center;
  background: transparent;
  border: none;
  backdrop-filter: none;

  &.glass {
    background: transparent;
    border: none;
    backdrop-filter: none;
  }

  .cta-text {
    margin-bottom: 40px;

    h2 {
      font-size: 36px;
      font-weight: 950;
      margin: 0 0 16px;
    }

    p {
      font-size: 18px;
      color: $text-sec;
      margin: 0;
    }
  }

  .cta-actions {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-bottom: 32px;

    .btn-luxe.large {
      height: 64px;
      padding: 0 48px;
      font-size: 16px;
    }
  }

  .cta-contact {
    display: flex;
    justify-content: center;
    gap: 40px;
    color: $text-sec;
    font-size: 14px;
    font-weight: 700;
  }
}

.section-title {
  margin-bottom: 48px;

  span.idx {
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 900;
    color: $brand-primary;
    opacity: 0.6;
  }

  h2 {
    font-size: 42px;
    font-weight: 950;
    letter-spacing: -0.02em;
  }

  p {
    font-size: 18px;
    color: $text-sec;
    margin-top: 12px;
  }

  .title-underline {
    width: 60px;
    height: 4px;
    margin-top: 24px;
  }

  &.centered {
    text-align: center;

    .title-underline {
      margin: 24px auto 0;
    }
  }
}

.btn-luxe {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 24px;
  border-radius: var(--global-border-radius);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;

  &.primary {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color);
    border: var(--unified-border);
  }

  &.ghost {
    background: transparent;
    border: var(--unified-border);
    color: var(--el-text-color-primary);
  }

  &:hover {
    border-color: $brand-primary;
  }
}

html.dark .btn-luxe {
  &.primary {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color);
  }

  &.ghost {
    background: transparent;
    border-color: var(--border-unified-color);
    color: var(--el-text-color-primary);
  }
}

.glass {
  backdrop-filter: blur(24px);
  border: var(--unified-border);
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 1;
  }

  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

@include bp.mobile-only {
  .hero-wrapper {
    grid-template-columns: 1fr;
    text-align: center;

    .hero-visual {
      display: flex;
      justify-content: center;
      margin-top: 40px;
    }
  }

  .platform-stats-visual .stats-card {
    width: 100%;
    max-width: 340px;
    padding: 24px;
  }

  .platform-stats-visual .stats-grid-v {
    gap: 16px;
  }

  .platform-stats-visual .stat-item {
    padding: 12px 6px;

    .stat-num {
      font-size: 28px;
    }
  }

  .pricing-grid {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    flex-direction: column;
  }

  .container {
    padding: 0 24px;
  }

  .comparison-matrix-wrap {
    overflow-x: auto;

    .comparison-table {
      min-width: 800px;
    }
  }

  // 移动端中台切换组件
  .centers-switcher {
    grid-template-columns: 1fr;
    gap: 32px;
    min-height: auto;
  }

  .centers-nav {
    flex-direction: row;
    overflow-x: auto;
    gap: 12px;
    padding-bottom: 12px;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .center-tab {
    flex-direction: column;
    min-width: 160px;
    padding: 16px;
    text-align: center;
    gap: 12px;

    .tab-icon {
      width: 44px;
      height: 44px;
      font-size: 18px;
    }

    .tab-content {
      h3 {
        font-size: 14px;
      }

      p {
        display: none;
      }
    }

    .tab-indicator {
      display: none;
    }
  }

  .services-grid {
    grid-template-columns: 1fr;
  }

  .service-card {
    padding: 24px;
  }

  // 新增板块响应式
  .ai-grid {
    grid-template-columns: 1fr;
  }

  .industry-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .tech-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .usecase-grid {
    grid-template-columns: 1fr;
  }

  .security-grid {
    grid-template-columns: 1fr;
  }

  .faq-list {
    grid-template-columns: 1fr;
  }

  .cases-grid {
    grid-template-columns: 1fr;
  }

  .testimonials-grid {
    grid-template-columns: 1fr;
  }

  .achievements-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .service-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .resources-grid {
    grid-template-columns: 1fr;
  }

  .cta-content {
    padding: 40px 24px;

    .cta-actions {
      flex-direction: column;
    }

    .cta-contact {
      flex-direction: column;
      gap: 12px;
    }
  }
}

@include bp.tablet-only {
  .ai-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .industry-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .cases-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .testimonials-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

// 深色模式下的标签样式
:where(html.dark) .ai-card .ai-tag {
  color: var(--el-bg-color);
}

// 深色模式下使用 $brand-primary 作为文字颜色的元素
html.dark {
  // 核心图标 - 提高选择器优先级
  .architecture-core-visual .core-node .core-icon,
  .core-icon {
    color: var(--el-bg-color);
  }

  // AI 卡片图标 - 提高选择器优先级
  .ai-card .ai-icon,
  .ai-icon {
    color: var(--el-bg-color);
  }

  // 行业图标
  .industry-card .industry-icon,
  .industry-icon {
    color: var(--el-bg-color);
  }

  // 服务图标
  .service-icon .icon,
  .service-count {
    color: var(--el-bg-color);
  }

  // 定价卡片
  .pricing-card {
    background: var(--el-bg-color-overlay);
    border-color: var(--el-border-color-darker);

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      border-width: 2px;
    }

    &.hot {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      background: var(--el-fill-color-darker);

      &:hover {
        border-width: 2px;
      }
    }

    .hot-tag {
      color: var(--el-text-color-primary);
    }

    .p-services {
      color: var(--el-color-primary);
      background: var(--el-fill-color);
    }

    .p-features li .check {
      color: var(--el-color-primary);
    }

    .plan-btn {
      background: var(--el-fill-color);
      border-color: var(--el-border-color);
      color: var(--el-text-color-primary);

      &.primary {
        background: var(--el-color-primary);
        border: var(--el-border-width-primary) solid var(--el-color-primary);
        color: var(--el-bg-color);
      }

      &:hover {
        background: var(--el-color-primary);
        border: var(--el-border-width-primary) solid var(--el-color-primary);
        color: var(--el-bg-color);
      }
    }
  }

  // 对比矩阵
  .comparison-matrix-wrap {
    .hot,
    .hot-cell {
      color: var(--el-bg-color);
    }
  }

  // 统计数据
  .stat-icon {
    color: var(--el-bg-color);
  }

  // 案例标签
  .case-tag {
    color: var(--el-bg-color);
  }

  // 推荐卡片
  .testimonial-card .quote-icon {
    color: var(--el-bg-color);
  }

  // 成就标签
  .achievement-tag {
    color: var(--el-bg-color);
  }

  // 资源标签
  .resource-tag {
    color: var(--el-bg-color);
  }

  // 中台导航
  .centers-nav {
    background: var(--el-fill-color-darker);
    border-color: var(--el-border-color-darker);
  }

  .center-tab {
    background: var(--el-bg-color-overlay);
    border-color: var(--el-border-color-darker);

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      border-width: 2px;
    }

    &.active {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      background: var(--el-fill-color-darker);
      border-width: 2px;
    }

    .tab-icon {
      background: var(--el-fill-color);
      color: var(--el-text-color-primary);
    }

    .tab-icon .el-icon {
      color: var(--el-text-color-primary);
    }

    &:hover .tab-icon,
    &.active .tab-icon {
      background: var(--el-color-primary);
      color: var(--el-bg-color);
    }

    &:hover .tab-icon .el-icon,
    &.active .tab-icon .el-icon {
      color: var(--el-bg-color);
    }

    .tab-content h3 {
      color: var(--el-text-color-primary);
    }

    &.active .tab-content h3 {
      color: var(--el-color-primary);
    }

    .tab-content p {
      color: var(--el-text-color-secondary);
    }
  }

  // 数据可视化卡片
  .platform-stats-visual .stats-card {
    background: var(--el-bg-color-overlay);
    border-color: var(--el-border-color-darker);

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
    }
  }

  .platform-stats-visual .stat-item {
    background: var(--el-fill-color-darker);

    &:hover {
      background: var(--el-fill-color-dark);
    }

    .stat-num {
      color: var(--el-bg-color);
    }
  }

  :where(.platform-stats-visual) :where(.stats-footer) .tech-tag {
    border-color: var(--el-border-color-darker);
    color: var(--el-text-color-secondary);

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      color: var(--el-bg-color);
    }
  }

  // 服务链接
  .service-link:hover {
    color: var(--el-bg-color);
  }

  // Hero 区域
  .hero-title .accent-gradient,
  .hero-desc strong {
    color: var(--el-bg-color);
  }

  // Element Plus 下拉菜单图标 - 使用 :where(html.dark) 降低特异性
  :where(html.dark) body .el-dropdown-menu__item .el-icon,
  :where(html.dark) body .el-dropdown-menu.ai-capability-menu .el-dropdown-menu__item .el-icon {
    color: var(--el-text-color-primary);
  }

  // 服务卡片图标
  :where(.services-panel) :where(.services-grid) .service-card .card-head .icon {
    color: var(--el-bg-color);
  }

  // 服务面板暗色模式
  .services-panel {
    background: var(--el-fill-color-darker);
    border-color: var(--el-border-color-darker);
  }

  .services-panel .panel-header {
    background: var(--el-bg-color-overlay);
    border-color: var(--el-border-color-darker);

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      border-width: 2px;
    }

    .panel-icon {
      background: var(--el-fill-color);
      color: var(--el-text-color-primary);
    }

    .panel-icon .el-icon {
      color: var(--el-text-color-primary);
    }

    &:hover .panel-icon {
      background: var(--el-color-primary);
      color: var(--el-bg-color);
    }

    &:hover .panel-icon .el-icon {
      color: var(--el-bg-color);
    }
  }

  :where(.services-panel) :where(.services-grid) .service-card {
    background: var(--el-bg-color-overlay);
    border-color: var(--el-border-color-darker);

    &:hover {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      border-width: 2px;
    }

    .card-footer {
      border-top-color: var(--el-border-color);
    }
  }
}
</style>
