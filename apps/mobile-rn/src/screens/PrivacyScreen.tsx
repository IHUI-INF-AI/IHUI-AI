import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LegalDocScreen, type LegalDocSection } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 隐私政策 — 复用共享 LegalDocScreen */
export function PrivacyScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

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
      onBack={() => navigation.goBack()}
    />
  )
}
