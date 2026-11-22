// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 学生本人「签退」按钮(miniapp-taro 端):只在可签退时出现。
// 端点 POST /edu-ai-management/attendance/self-check-out { date }:
// 身份与班级由后端按登录态/在册学籍现取,客户端不传 studentId/classId/status;
// 重复签退由后端幂等口径裁决,失败 message 原样上屏、不静默、不做本地乐观改行。
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { useI18n } from '@/i18n'
import { Button } from '@/components/Button'
import { post } from '@/api'
import { buildSelfCheckOutPayload } from '../edu-mgmt-attendance/contract'

export const SELF_CHECK_OUT_URL = '/edu-ai-management/attendance/self-check-out'

interface SelfCheckOutResult {
  classId?: string
  status?: string
  checkOutTime?: string | null
}

/**
 * 自签退请求出口(与组件解耦,便于用例直接验 URL/载荷/失败分支):
 * 成功返回后端回显 status;失败返回可上屏原因(401/403/409 的 message 由 unwrapApi 抛出)。
 */
export async function submitSelfCheckOut(
  date: string,
  postFn: typeof post = post,
): Promise<{ ok: true; status?: string } | { ok: false; error: string }> {
  try {
    const res = await postFn<SelfCheckOutResult>(SELF_CHECK_OUT_URL, buildSelfCheckOutPayload(date))
    return res ? { ok: true, status: res.status } : { ok: false, error: '' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.trim() : '' }
  }
}

/** 状态码取词:词表未命中(后端新增协议码)原样回显,不吞数据 */
const statusText = (t: (k: string) => string, s: string): string => {
  const k = `eduAttendance.status.${s}`
  const v = t(k)
  return v === k ? s : v
}

export function SelfCheckOutAction({
  date,
  canCheckOut,
  onDone,
}: {
  /** 上海业务日(@/utils/time nowDate) */
  date: string
  /** 由 actionAvailability(contract.ts 单源)现算:已签到且未签退 */
  canCheckOut: boolean
  onDone: () => Promise<void> | void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    if (busy || !canCheckOut) return
    setBusy(true)
    try {
      const r = await submitSelfCheckOut(date)
      if (r.ok) {
        const echoed = r.status ? ` (${statusText(t, r.status)})` : ''
        Taro.showToast({ title: `${t('eduAttendance.checkedOutToast')}${echoed}`, icon: 'success' })
        await onDone()
      } else {
        Taro.showToast({ title: r.error || t('common.loadFailed'), icon: 'none' })
      }
    } finally {
      setBusy(false)
    }
  }

  if (!canCheckOut) return null

  return (
    <Button size="sm" variant="outline" loading={busy} onClick={() => void run()}>
      {t('eduAttendance.checkOut')}
    </Button>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
