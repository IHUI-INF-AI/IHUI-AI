// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 学生本人考勤页(pkg-user/edu-my-attendance):列表 + 顶部「自签」按钮。
// 端点(路径前缀不带 /api,与本端现有 get()/post() 写法一致):
//   GET  /edu-ai-management/attendance/me?date=YYYY-MM-DD ⇒ { list: Row[] }(只认登录态;归属主体由后端按令牌身份收敛。不用 GET /attendance——那条要 edu:view/edu:manage,普通学生必 403)
//   POST /edu-ai-management/attendance/self-check-in    { date?, remark? }  (学生本人自签;
//        身份与班级均由后端按登录态/在册学籍现取,客户端不传 studentId/classId)
import { useCallback, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import { Button } from '@/components/Button'
import { EmptyState, ScreenSkeleton } from '@/components/ScreenStates.taro'
import { get, post } from '@/api'
import { isLoggedIn } from '@/utils/auth'

/**
 * 签到二维码载荷 → token:教师端(RN/Web)出的是 JSON 字符串
 * `{ type:'edu-attendance-checkin', version, classId, token, expiresAt }`。
 * 本函数只做「是不是本系统签到码」的形态闸并取出 token;签名与有效期一律由服务端核验
 * (§0.6 判据单源在 server,端上不复算、不信 classId)。
 */
const parseAttendanceToken = (raw: string): string | null => {
  try {
    const obj = JSON.parse(raw) as { type?: unknown; token?: unknown }
    if (obj?.type !== 'edu-attendance-checkin') return null
    return typeof obj.token === 'string' && obj.token.length > 0 ? obj.token : null
  } catch {
    return null
  }
}

interface Row {
  id: string
  date: string
  status: string
  checkInTime: string | null
  checkOutTime: string | null
}
interface SelfCheckInResult {
  classId?: string
  status?: string
  checkInTime?: string | null
}

export default function Page() {
  const { t } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const st = (s: string) => {
    const k = `eduAttendance.status.${s}`
    const v = t(k)
    return v === k ? s : v
  }
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [remark, setRemark] = useState('')
  // 自签成功后由后端回显的生效信息(班级/状态),仅用于展示"班级由后端决定",不做本地乐观改行
  const [echo, setEcho] = useState<SelfCheckInResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await get<{ list: Row[] }>(`/edu-ai-management/attendance/me?date=${today}`)
      setRows((res as { list?: Row[] } | null)?.list ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useDidShow(() => {
    void load()
  })

  const onSelfCheckIn = async () => {
    if (signing) return
    setSigning(true)
    try {
      // 新契约:入参只有 { date?, remark? };身份与班级由后端按登录态/在册学籍现取。
      const trimmed = remark.trim()
      const res = await post<SelfCheckInResult>(
        '/edu-ai-management/attendance/self-check-in',
        trimmed ? { date: today, remark: trimmed } : { date: today },
      )
      setEcho(res ?? null)
      Taro.showToast({ title: t('eduMyAttendance.selfDoneToast'), icon: 'success' })
      setRemark('')
      await load()
    } catch (e) {
      // 401/403/409 的失败原因由 unwrapApi 抛出(含后端 message),必须上屏、不许静默
      const msg = e instanceof Error ? e.message.trim() : ''
      Taro.showToast({ title: msg || t('common.loadFailed'), icon: 'none' })
    } finally {
      setSigning(false)
    }
  }

  /**
   * 扫码签到:走微信原生扫码面板(本端不渲染二维码,渲染交给教师端 RN/Web)。
   * 端点与 RN 学生端同一个:POST /edu-ai-management/attendance/qrcode-check-in { token }
   * —— 班级与签名都在 token 里,客户端不传 classId/studentId(身份由后端按登录态取)。
   * 取消扫码属常态(与 pages/user 的 handleScanLogin 同口径)⇒ 静默返回不弹错。
   */
  const onScanCheckIn = async () => {
    if (scanning) return
    if (!isLoggedIn()) {
      Taro.showToast({ title: t('scanLogin.needLogin'), icon: 'none' })
      return
    }
    setScanning(true)
    let raw = ''
    try {
      const res = await Taro.scanCode({ scanType: ['qrCode'] })
      raw = res.result
    } catch {
      setScanning(false)
      return
    }
    const token = parseAttendanceToken(raw)
    if (!token) {
      Taro.showToast({ title: t('eduMyAttendance.scanInvalidToast'), icon: 'none' })
      setScanning(false)
      return
    }
    try {
      const res = await post<SelfCheckInResult>('/edu-ai-management/attendance/qrcode-check-in', {
        token,
      })
      setEcho(res ?? null)
      Taro.showToast({ title: t('eduMyAttendance.scanDoneToast'), icon: 'success' })
      await load()
    } catch (e) {
      // 401/403/400/409 的后端 message 必须上屏(过期/换班/未在册/已签过全靠它分辨)
      const msg = e instanceof Error ? e.message.trim() : ''
      Taro.showToast({ title: msg || t('common.loadFailed'), icon: 'none' })
    } finally {
      setScanning(false)
    }
  }

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background p-4">
        <View className="flex items-center justify-between gap-3 py-3">
          <Text className="text-xl font-bold text-foreground shrink-0">
            {t('eduMyAttendance.title')}
          </Text>
          <View className="flex flex-row items-center gap-2">
            <Button size="sm" loading={signing} onClick={() => void onSelfCheckIn()}>
              {t('eduMyAttendance.selfCheckIn')}
            </Button>
            {/* 扫码签到:教师端出示二维码后,学生在本页扫码完成签到(同一端点、同一载荷) */}
            <Button
              size="sm"
              variant="outline"
              loading={scanning}
              onClick={() => void onScanCheckIn()}
            >
              {t('eduMyAttendance.scanCheckIn')}
            </Button>
          </View>
        </View>

        <View className="pb-3 space-y-2">
          <Text className="text-xs text-muted-foreground">
            {t('eduMyAttendance.classByBackendHint')}
            {echo?.status ? ` (${st(echo.status)})` : ''}
          </Text>
          <Input
            className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={remark}
            placeholder={t('eduMyAttendance.remarkPlaceholder')}
            onInput={(e) => setRemark(e.detail.value)}
          />
        </View>

        {loading ? (
          <ScreenSkeleton variant="list" />
        ) : failed ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-muted-foreground">{t('common.loadFailed')}</Text>
          </View>
        ) : rows.length === 0 ? (
          <EmptyState title={t('common.empty')} />
        ) : (
          <View className="space-y-3">
            {rows.map((r) => (
              <View key={r.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <View className="flex items-center justify-between gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">
                    {t('eduChildAttendance.date')}
                  </Text>
                  <Text className="text-sm text-right text-foreground">
                    {(r.date ?? '').slice(0, 10)}
                  </Text>
                </View>
                <View className="flex items-center justify-between gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">
                    {t('eduAttendance.statusTitle')}
                  </Text>
                  <Text className="text-sm text-right text-emerald-600">{st(r.status)}</Text>
                </View>
                <View className="flex items-center justify-between gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">
                    {t('eduAttendance.checkIn')}
                  </Text>
                  <Text className="text-sm text-right text-foreground">
                    {r.checkInTime?.slice(11, 16) ?? '—'}
                  </Text>
                </View>
                <View className="flex items-center justify-between gap-2">
                  <Text className="text-xs text-muted-foreground shrink-0">
                    {t('eduAttendance.checkOut')}
                  </Text>
                  <Text className="text-sm text-right text-foreground">
                    {r.checkOutTime?.slice(11, 16) ?? '—'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
