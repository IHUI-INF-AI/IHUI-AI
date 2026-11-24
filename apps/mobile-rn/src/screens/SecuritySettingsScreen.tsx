// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  SecuritySettingsScreen as SharedSecuritySettingsScreen,
  type SecuritySettingsItem,
  type SecuritySettingsSection,
} from '@ihui/rn-app'
import type { LooseNavigation } from '../host/use-host-ports'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 两步验证的真实写面所在屏(启用/校验/关闭整条流程走 /api/auth/2fa/*)。 */
const TWO_FACTOR_HOST_SCREEN = 'SecurityCenter'

export function SecuritySettingsScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [settings, setSettings] = useState<SecuritySettingsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((key) => key + 1)

  const openTwoFactorHostScreen = useCallback(() => {
    navigation.navigate(TWO_FACTOR_HOST_SCREEN)
  }, [navigation])

  /**
   * 「这一行到底能不能真跳过去」按**当前宿主**在册的屏名判,不按端名判:读数口径与宿主端口
   * performHostNavigate(apps/mobile-rn/src/host/use-host-ports.ts 的 `nav.getState()?.routeNames ?? []`)
   * 同一份 —— 导航器 state 的 routeNames(RN = RootNavigator 在册屏,含 SecurityCenter;小程序 rn-compat
   * 走 RN_ROUTE_MAP,不含)。拿不到即不注入 ⇒ 共享屏那一行原样只读,结构上长不出「点了没反应的入口」
   * (门 290 A1/A2「假可点/空端口」那一型)。
   */
  const hostRouteNames =
    typeof navigation.getState === 'function'
      ? ((navigation as unknown as LooseNavigation).getState()?.routeNames ?? [])
      : []
  const onOpenTwoFactor = hostRouteNames.includes(TWO_FACTOR_HOST_SCREEN)
    ? openTwoFactorHostScreen
    : undefined

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetchApi<SecuritySettingsItem>('/user/security')
        if (cancelled) return
        if (!resp.success) {
          // 透出后端 message,而非一律「加载失败」。
          setError(resp.error || t('securitySettings.loadFailed'))
          return
        }
        setSettings(resp.data ?? null)
      } catch {
        if (!cancelled) setError(t('securitySettings.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t, reloadKey])

  // 只读形态:后端 user-security-routes.ts 只有 GET /user/security,这一条路径上没有任何**行内**
  // 写端点,四项开关此前只改本地 state(关掉再进来全回原值)—— 那是假成功。改为只读展示,
  // 由共享屏渲染真实状态 + 明确提示,不再注入 onToggle。
  // 口径提醒:「这条路径无写端点」只约束本页的行内开关,不等于后端整体不支持修改 —— 两步验证
  // 走的是另一条已打通的路(/api/auth/2fa/*,见同端 SecurityCenterScreen)。提示文案点名的是它,
  // 而"点名"要能被走进去:上屏的那一行由 onOpenTwoFactor 注入真实跳转(宿主不在册时为 undefined)。
  // 端侧数据驱动:RN 交自己的 4 行账号安全读数(小程序端交系统权限 + 本地隐私两组,两端值不同)。
  // 只读口径不变 —— 这一条路径没有行内写端点,不得注入 onToggle 造"关掉再进来会回原值"的假开关;
  // 两步验证那行仍按宿主在册屏名注入真实入口(未在册 ⇒ 原样只读)。
  const sections = useMemo<readonly SecuritySettingsSection[] | null>(() => {
    if (!settings) return null
    const stateRow = (key: keyof SecuritySettingsItem, label: string) => ({
      key,
      label,
      stateText: t(settings[key] ? 'securitySettings.stateOn' : 'securitySettings.stateOff'),
      stateTone: settings[key] ? ('success' as const) : ('muted' as const),
    })
    return [
      {
        key: 'security',
        desc: t('securitySettings.desc'),
        hint: t('securitySettings.readOnlyHint'),
        items: [
          stateRow('passwordEnabled', t('securitySettings.password')),
          stateRow('biometricEnabled', t('securitySettings.biometric')),
          onOpenTwoFactor
            ? { ...stateRow('twoFactorEnabled', t('securitySettings.twoFactor')), onPress: onOpenTwoFactor }
            : stateRow('twoFactorEnabled', t('securitySettings.twoFactor')),
          stateRow('loginAlert', t('securitySettings.loginAlert')),
        ],
      },
    ]
  }, [settings, t, onOpenTwoFactor])

  return (
    <SharedSecuritySettingsScreen
      t={t}
      sections={sections}
      showHeader={true}
      footerLink={{
        label: t('privacy.title'),
        onPress: () => navigation.navigate('Privacy'),
      }}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onRetry={reload}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
