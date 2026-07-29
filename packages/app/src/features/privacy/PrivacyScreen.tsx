import type { LegalDocSection, PrivacyScreenProps } from '../../types'
import { LegalDocScreen } from '../legal-doc/LegalDocScreen'

/**
 * 隐私政策共享屏 — LegalDocScreen 的静态配置版,封装隐私政策 sections。
 *
 * 平台无关:sections(数据收集 / Cookie / 第三方共享)内化在共享层,
 * wrapper 只需注入 t 与 onBack。
 */
export function PrivacyScreen({
  t,
  onBack,
  colorScheme,
}: PrivacyScreenProps) {
  const sections: LegalDocSection[] = [
    { title: t('privacy.sectionData'), body: t('privacy.sectionDataBody') },
    { title: t('privacy.sectionCookie'), body: t('privacy.sectionCookieBody') },
    { title: t('privacy.sectionThirdParty'), body: t('privacy.sectionThirdPartyBody') },
  ]

  return (
    <LegalDocScreen
      t={t}
      title={t('privacy.title')}
      subtitle={t('privacy.subtitle')}
      updatedAt="2026-07-19"
      sections={sections}
      onBack={onBack}
      colorScheme={colorScheme}
    />
  )
}
