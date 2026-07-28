import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LegalDocScreen, type LegalDocSection } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 用户协议 — 复用共享 LegalDocScreen */
export function AgreementScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const sections: LegalDocSection[] = [
    { title: t('agreement.sectionTerms'), body: t('agreement.sectionTermsBody') },
    { title: t('agreement.sectionRights'), body: t('agreement.sectionRightsBody') },
    { title: t('agreement.sectionObligations'), body: t('agreement.sectionObligationsBody') },
  ]

  return (
    <LegalDocScreen
      t={t}
      title={t('agreement.title')}
      subtitle={t('agreement.subtitle')}
      updatedAt="2026-07-19"
      sections={sections}
      onBack={() => navigation.goBack()}
    />
  )
}
