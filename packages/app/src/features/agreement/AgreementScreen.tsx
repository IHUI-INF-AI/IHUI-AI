import { LegalDocScreen } from '../legal-doc/LegalDocScreen'
import type { AgreementScreenProps, LegalDocSection } from '../../types'

/**
 * 用户协议共享屏 — LegalDocScreen 的静态配置版,封装用户协议 sections。
 *
 * sections 内化在共享层,wrapper 只需注入 t/onBack/colorScheme,
 * 无需各自拼装 sections 数据,保证多端展示一致。
 */
export function AgreementScreen({ t, onBack, colorScheme }: AgreementScreenProps) {
  const sections: LegalDocSection[] = [
    { title: t('agreementSections.sectionTerms'), body: t('agreementSections.sectionTermsBody') },
    { title: t('agreementSections.sectionRights'), body: t('agreementSections.sectionRightsBody') },
    { title: t('agreementSections.sectionObligations'), body: t('agreementSections.sectionObligationsBody') },
  ]

  return (
    <LegalDocScreen
      t={t}
      title={t('agreement.title')}
      subtitle={t('agreement.subtitle')}
      updatedAt="2026-07-19"
      sections={sections}
      onBack={onBack}
      colorScheme={colorScheme}
    />
  )
}
