// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getUserSignUps, type SignUpRow } from '@ihui/api-client'
import {
  SignUpScreen as SharedSignUpScreen,
  type SignUpRowView,
  type SignUpStatusView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 与 web STATUS_LABEL 同四档(page.tsx:44-49);后端已把两路原始态归一到这四个值。 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'signUpPage.statusDraft',
  published: 'signUpPage.statusPublished',
  rejected: 'signUpPage.statusRejected',
  completed: 'signUpPage.statusCompleted',
}

/**
 * RN 端「我的报名」薄壳 —— 承载 web /user/sign-up。
 * 渲染全部委托共享屏 `packages/app/src/features/sign-up/SignUpScreen.tsx`,本文件只管平台侧:
 * 取当前登录用户 id(GET /api/sign-ups?userId= 非本人且非 admin 会被后端拒),
 * 未登录/未就绪不发注定 401 的查询(与 web useAuthGate 同口径,界面落空态),
 * 以及 Intl 日期格式化(与 web 同参 年/月/日)。
 */
export function SignUpScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SignUpRow[]>([])

  const load = useCallback(async () => {
    const id = user?.id
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getUserSignUps(id)
      if (!res.success || !res.data) {
        setError(t('common.loadFailed'))
        setRows([])
        return
      }
      setRows(Array.isArray(res.data.list) ? res.data.list : [])
    } catch {
      setError(t('common.loadFailed'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

  useEffect(() => {
    void load()
  }, [load])

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [locale],
  )

  const viewRows = useMemo<SignUpRowView[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        targetTitle: r.targetTitle,
        // 与 web 同形:targetType 原文渲染(lesson/exam),web 端未给它建文案键,这里不自造译文
        typeText: r.targetType ?? '',
        status: (r.status ?? 'draft') as SignUpStatusView,
        statusText: r.status ? t(STATUS_LABEL_KEYS[r.status] ?? 'signUpPage.statusDraft') : '',
        dateText: r.createdAt ? dateFmt.format(new Date(r.createdAt)) : '',
      })),
    [rows, t, dateFmt],
  )

  return (
    <SharedSignUpScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      rows={viewRows}
    />
  )
}

export default SignUpScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
