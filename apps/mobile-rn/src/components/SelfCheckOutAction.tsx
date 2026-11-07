// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学生本人「签退」动作(mobile-rn 端)。
 *
 * 只做一次 POST /attendance/self-check-out,载荷仅业务日:身份与班级由服务端按登录态/在册学籍现取,
 * 不传 studentId/classId;重复签退由后端幂等口径裁决,失败 message 原样上屏、不静默、不做本地乐观改状态。
 * 状态词表复用 teacher 屏同一出口(attendance-status),本组件不另立判据。
 */
import { useCallback, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { fetchApi } from '@ihui/api-client'
import { getTokens } from '@ihui/rn-app'
import { Tappable } from '@ihui/ui-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { appAlert } from './BottomPops'
import { attendanceStatusLabel } from './attendance-status'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'

export function SelfCheckOutAction({
  date,
  enabled,
  onDone,
}: {
  /** 上海业务日(与服务端会话时区同口径) */
  date: string
  /** 今日已签到且尚未签退;由服务端回读行现算,不在端上自报 */
  enabled: boolean
  onDone: () => Promise<void> | void
}) {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const tk = getTokens(resolvedTheme)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async () => {
    if (busy || !enabled) return
    setBusy(true)
    try {
      const res = await fetchApi<{ classId?: string; status?: string; checkOutTime?: string }>(
        '/api/edu-ai-management/attendance/self-check-out',
        { method: 'POST', body: JSON.stringify({ date }) },
      )
      if (res.success) {
        const echoed = res.data?.status ? ` (${attendanceStatusLabel(t, res.data.status)})` : ''
        appAlert(t('eduMyAttendance.title'), `${t('eduAttendance.actionDone')}${echoed}`)
        await onDone()
      } else {
        appAlert(
          t('eduMyAttendance.title'),
          `${t('eduAttendance.actionFailed')}:${res.error ?? '-'}`,
        )
      }
    } catch (e) {
      appAlert(
        t('eduMyAttendance.title'),
        `${t('eduAttendance.actionFailed')}:${e instanceof Error ? e.message : '-'}`,
      )
    } finally {
      setBusy(false)
    }
  }, [busy, date, enabled, onDone, t])

  if (!enabled) return null

  const st = styles(tk)

  return (
    <Tappable
      onPress={() => void run()}
      pressedStyle={st.pressed}
      accessibilityRole="button"
      disabled={busy}
      style={st.btn}
    >
      <Text style={st.btnText}>{t('eduAttendance.checkOut')}</Text>
    </Tappable>
  )
}

function styles(tk: ReturnType<typeof getTokens>) {
  return StyleSheet.create({
    btn: {
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      alignItems: 'center',
    },
    btnText: { color: tk.text.primary, fontSize: rnType.body.size },
    pressed: { opacity: 0.85 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
