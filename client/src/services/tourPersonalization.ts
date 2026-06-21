import { ref, computed } from 'vue'
import { StorageManager } from '@/utils/storage'

export type UserRole = 'newUser' | 'returningUser' | 'developer' | 'business'
export type TourVariant = 'A' | 'B'

interface TourStep {
  target: string
  title: string
  content: string
  placement?: string
}

interface PersonalizedTourConfig {
  role: UserRole
  steps: TourStep[]
  variant: TourVariant
}

const USER_ROLE_KEY = 'tour_user_role'
const TOUR_VARIANT_KEY = 'tour_variant'

const userRole = ref<UserRole>(StorageManager.getItem<UserRole>(USER_ROLE_KEY) || 'newUser')
const tourVariant = ref<TourVariant>(StorageManager.getItem<TourVariant>(TOUR_VARIANT_KEY) || 'A')

const tourConfigs: Record<UserRole, Record<TourVariant, TourStep[]>> = {
  newUser: {
    A: [
      { target: '.hero-section', title: '欢迎来到智汇 AI', content: '让我们开始您的AI之旅！这里将带您了解平台的核心功能。' },
      { target: '.feature-cards', title: '探索核心功能', content: '这里展示了平台的主要功能模块，包括AI对话、模型选择等。' },
      { target: '.chat-input', title: '开始对话', content: '在这里输入您的问题，AI将为您提供智能回答。' },
    ],
    B: [
      { target: '.hero-section', title: '欢迎使用', content: '让我们快速了解如何使用平台功能。' },
      { target: '.agent-list', title: '选择智能体', content: '浏览并选择您感兴趣的智能体开始对话。' },
      { target: '.chat-input', title: '立即体验', content: '输入您的问题，体验AI的强大能力！' },
    ],
  },
  returningUser: {
    A: [
      { target: '.dashboard', title: '欢迎回来！', content: '查看您最近的活动和推荐内容。' },
      { target: '.new-features', title: '新功能上线', content: '我们新增了一些功能，快来体验吧！' },
    ],
    B: [
      { target: '.dashboard', title: '欢迎回来', content: '您的个性化推荐已更新。' },
      { target: '.quick-actions', title: '快速操作', content: '从这里快速开始新对话。' },
    ],
  },
  developer: {
    A: [
      { target: '.api-section', title: 'API 文档', content: '查看完整的API文档和示例代码。' },
      { target: '.sdk-download', title: 'SDK 下载', content: '下载各语言的SDK，快速集成AI能力。' },
      { target: '.webhook-config', title: 'Webhook 配置', content: '配置Webhook接收事件通知。' },
    ],
    B: [
      { target: '.api-keys', title: 'API 密钥管理', content: '创建和管理您的API密钥。' },
      { target: '.code-examples', title: '代码示例', content: '查看各语言的集成示例。' },
    ],
  },
  business: {
    A: [
      { target: '.team-management', title: '团队管理', content: '管理团队成员和权限设置。' },
      { target: '.billing', title: '账单与订阅', content: '查看账单详情和管理订阅。' },
      { target: '.analytics', title: '数据分析', content: '查看使用统计和性能指标。' },
    ],
    B: [
      { target: '.enterprise-features', title: '企业功能', content: '探索专为企业设计的功能。' },
      { target: '.support', title: '专属支持', content: '联系您的专属客户经理。' },
    ],
  },
}

const setUserRole = (role: UserRole) => {
  userRole.value = role
  StorageManager.setItem(USER_ROLE_KEY, role)
}

const setTourVariant = (variant: TourVariant) => {
  tourVariant.value = variant
  StorageManager.setItem(TOUR_VARIANT_KEY, variant)
}

const assignRandomVariant = (): TourVariant => {
  const variant: TourVariant = Math.random() < 0.5 ? 'A' : 'B'
  setTourVariant(variant)
  return variant
}

const getTourSteps = computed(() => {
  return tourConfigs[userRole.value][tourVariant.value]
})

const getPersonalizedConfig = (): PersonalizedTourConfig => {
  return {
    role: userRole.value,
    steps: getTourSteps.value,
    variant: tourVariant.value,
  }
}

const detectUserRole = (): UserRole => {
  const lastVisit = StorageManager.getItem<number>('last_visit_time')
  const hasApiKey = StorageManager.getItem<boolean>('has_api_key')
  const isEnterprise = StorageManager.getItem<boolean>('is_enterprise_user')
  
  if (isEnterprise) return 'business'
  if (hasApiKey) return 'developer'
  if (lastVisit && Date.now() - lastVisit < 30 * 24 * 60 * 60 * 1000) return 'returningUser'
  return 'newUser'
}

const autoDetectAndSetRole = () => {
  const detectedRole = detectUserRole()
  setUserRole(detectedRole)
  return detectedRole
}

export function useTourPersonalization() {
  return {
    userRole,
    tourVariant,
    setUserRole,
    setTourVariant,
    assignRandomVariant,
    getTourSteps,
    getPersonalizedConfig,
    detectUserRole,
    autoDetectAndSetRole,
  }
}

export const tourPersonalization = {
  getRole: () => userRole.value,
  getVariant: () => tourVariant.value,
  setRole: setUserRole,
  setVariant: setTourVariant,
  getSteps: () => getTourSteps.value,
}
