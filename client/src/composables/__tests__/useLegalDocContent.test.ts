import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useLegalDocContent } from '../useLegalDocContent'

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: vi.fn((key: string) => {
      const translations: Record<string, string> = {
        'legal.termsOfService.title': '服务条款',
        'legal.termsOfService.lastUpdated': '2024年1月1日',
        'legal.termsOfService.sections.acceptance.title': '接受条款',
        'legal.termsOfService.sections.acceptance.content': '接受条款内容',
        'legal.privacyPolicy.title': '隐私政策',
        'legal.privacyPolicy.lastUpdated': '2024年1月1日',
        'legal.userAgreement.title': '用户协议',
        'legal.paymentTerms.title': '支付条款',
      }
      return translations[key] || key
    }),
  })),
}))

describe('useLegalDocContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该返回null当docId为空', () => {
    const docContent = useLegalDocContent(ref(undefined))
    expect(docContent.value).toBeNull()
  })

  it('应该返回null当docId为空字符串', () => {
    const docContent = useLegalDocContent(ref(''))
    expect(docContent.value).toBeNull()
  })

  it('应该返回null当docId不存在', () => {
    const docContent = useLegalDocContent(ref('non-existent'))
    expect(docContent.value).toBeNull()
  })

  it('应该返回服务条款内容', () => {
    const docContent = useLegalDocContent(ref('terms-of-service'))
    expect(docContent.value).not.toBeNull()
    expect(docContent.value?.title).toBe('服务条款')
    expect(docContent.value?.lastUpdated).toBe('2024年1月1日')
    expect(docContent.value?.sections.length).toBeGreaterThan(0)
  })

  it('应该返回隐私政策内容', () => {
    const docContent = useLegalDocContent(ref('privacy-policy'))
    expect(docContent.value).not.toBeNull()
    expect(docContent.value?.title).toBe('隐私政策')
  })

  it('应该返回用户协议内容', () => {
    const docContent = useLegalDocContent(ref('user-agreement'))
    expect(docContent.value).not.toBeNull()
    expect(docContent.value?.title).toBe('用户协议')
  })

  it('应该返回支付条款内容', () => {
    const docContent = useLegalDocContent(ref('payment-terms'))
    expect(docContent.value).not.toBeNull()
    expect(docContent.value?.title).toBe('支付条款')
  })

  it('应该支持响应式docId', () => {
    const docId = ref('terms-of-service')
    const docContent = useLegalDocContent(docId)
    
    expect(docContent.value?.title).toBe('服务条款')
    
    docId.value = 'privacy-policy'
    expect(docContent.value?.title).toBe('隐私政策')
  })

  it('应该支持getter函数', () => {
    const docContent = useLegalDocContent(() => 'terms-of-service')
    expect(docContent.value?.title).toBe('服务条款')
  })

  it('应该返回正确的章节结构', () => {
    const docContent = useLegalDocContent(ref('terms-of-service'))
    expect(docContent.value?.sections[0]).toHaveProperty('title')
    expect(docContent.value?.sections[0]).toHaveProperty('content')
  })
})
