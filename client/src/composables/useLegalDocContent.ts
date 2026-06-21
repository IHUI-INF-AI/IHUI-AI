import { computed, unref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

type MaybeRefOrGetter<T> = Ref<T> | (() => T) | T
function toValue<T>(r: MaybeRefOrGetter<T>): T {
  return typeof r === 'function' ? (r as () => T)() : unref(r)
}

export interface LegalSection {
  title: string
  content: string
}

export interface LegalDocContent {
  title: string
  lastUpdated: string
  sections: LegalSection[]
}

const LEGAL_KEYS: Record<string, { base: string; sectionKeys: string[] }> = {
  'terms-of-service': {
    base: 'legal.termsOfService',
    sectionKeys: [
      'sections.acceptance',
      'sections.serviceDescription',
      'sections.userObligations',
      'sections.prohibitedUse',
      'sections.intellectualProperty',
      'sections.limitationOfLiability',
      'sections.termination',
      'sections.changes',
    ],
  },
  'privacy-policy': {
    base: 'legal.privacyPolicy',
    sectionKeys: [
      'sections.introduction',
      'sections.dataCollection',
      'sections.dataUsage',
      'sections.dataSecurity',
      'sections.userRights',
      'sections.thirdParty',
      'sections.changes',
      'sections.contact',
    ],
  },
  'user-agreement': {
    base: 'legal.userAgreement',
    sectionKeys: [
      'sections.registration',
      'sections.accountSecurity',
      'sections.userContent',
      'sections.aiGeneratedContent',
      'sections.serviceAvailability',
      'sections.disclaimer',
      'sections.jurisdiction',
    ],
  },
  'payment-terms': {
    base: 'legal.paymentTerms',
    sectionKeys: [
      'sections.paymentMethods',
      'sections.pricing',
      'sections.billing',
      'sections.refundPolicy',
      'sections.subscription',
      'sections.responsibility',
    ],
  },
}

/**
 * 获取法律文档内容（条款与政策），用于在 /docs 页中渲染
 */
export function useLegalDocContent(docId: MaybeRefOrGetter<string | undefined>) {
  const { t } = useI18n()

  return computed<LegalDocContent | null>(() => {
    const id = toValue(docId)
    if (!id) return null
    const config = LEGAL_KEYS[id]
    if (!config) return null

    const sections: LegalSection[] = config.sectionKeys.map((key) => ({
      title: t(`${config.base}.${key}.title`),
      content: t(`${config.base}.${key}.content`),
    }))

    return {
      title: t(`${config.base}.title`),
      lastUpdated: t(`${config.base}.lastUpdated`),
      sections,
    }
  })
}
