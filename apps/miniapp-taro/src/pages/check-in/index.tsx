// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/check-in/CheckInScreen UI 与
// apps/mobile-rn CheckInScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import { fetchApi } from '@ihui/api-client'
import type { CheckInInfo } from '@ihui/types'
import ThemeRoot from '@/components/ThemeRoot'

/** 已签到日历格白色对勾图标(RN 端为 lucide Check,stroke 白色) */
const CHECK_ICON = '/static/images/icons/check-white.svg'

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐共享屏 createStyles) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tk.surface.bg,
  }),
  center: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: toRpx(14),
    paddingRight: toRpx(14),
    backgroundColor: tk.surface.bg,
  }),
  retryBtn: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: toRpx(12),
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    height: toRpx(44),
    borderRadius: toRpx(12),
    backgroundColor: tk.brand.DEFAULT,
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: toRpx(10),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(8),
  }),
  backBtn: (): CSSProperties => ({
    alignSelf: 'flex-start',
    marginBottom: toRpx(8),
  }),
  statsCard: (tk: RnThemeTokens): CSSProperties => ({
    marginLeft: toRpx(10),
    marginRight: toRpx(10),
    paddingLeft: toRpx(14),
    paddingRight: toRpx(14),
    paddingTop: toRpx(14),
    paddingBottom: toRpx(14),
    borderRadius: toRpx(12),
    backgroundColor: tk.surface.light,
  }),
  statsRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  }),
  statsCol: (): CSSProperties => ({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
  }),
  signBtn: (tk: RnThemeTokens, disabled: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: toRpx(14),
    height: toRpx(50),
    borderRadius: toRpx(12),
    backgroundColor: disabled ? tk.surface.muted : tk.brand.DEFAULT,
  }),
  calendarGrid: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginLeft: toRpx(10),
    marginRight: toRpx(10),
  }),
  calendarCell: (tk: RnThemeTokens, signed: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '13%',
    aspectRatio: '1',
    borderRadius: toRpx(12),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: signed ? tk.brand.DEFAULT : tk.border.light,
    backgroundColor: signed ? tk.brand.DEFAULT : tk.surface.bg,
  }),
  bodyScroll: (): CSSProperties => ({
    flex: 1,
  }),
}

const textStyles = {
  muted: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    color: tk.text.secondary,
    textAlign: 'center',
  }),
  error: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.danger.DEFAULT,
    marginBottom: toRpx(8),
    textAlign: 'center',
  }),
  retryBtnText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    color: tk.surface.light,
  }),
  backText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    color: tk.text.secondary,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(24),
    fontWeight: '700',
    color: tk.text.primary,
  }),
  subtitle: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  statsValue: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(22),
    fontWeight: '700',
    color: tk.brand.DEFAULT,
  }),
  statsLabel: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(11),
    color: tk.brand.DEFAULT,
  }),
  signBtnText: (tk: RnThemeTokens, disabled: boolean): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: '600',
    color: disabled ? tk.text.secondary : tk.surface.light,
  }),
  calendarTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  calendarDate: (tk: RnThemeTokens, signed: boolean): CSSProperties => ({
    fontSize: toRpx(14),
    color: signed ? tk.surface.light : tk.text.primary,
  }),
  calendarMarkReward: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(10),
    color: tk.text.secondary,
  }),
  errorInline: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    color: tk.danger.DEFAULT,
    textAlign: 'center',
  }),
}

export default function CheckIn() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  const [info, setInfo] = useState<CheckInInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [signing, setSigning] = useState(false)

  // 加载:对齐 mobile-rn load 状态机(端点 /checkin/today)
  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      try {
        const res = await fetchApi<CheckInInfo>('/checkin/today')
        if (!res.success) throw new Error()
        setInfo(res.data ?? null)
      } catch {
        setError(tt('checkIn.loadFailed', '加载签到信息失败'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [tt],
  )

  useDidShow(() => {
    void load()
  })

  // 签到:对齐 mobile-rn handleSign(POST /checkin,成功 toast + 刷新)
  const handleSign = async () => {
    if (!info || info.todaySigned || signing) return
    setSigning(true)
    try {
      const res = await fetchApi('/checkin', { method: 'POST' })
      if (res.success) {
        Taro.showToast({
          title: `${tt('checkIn.signSuccess', '签到成功')} +${info.todayReward}`,
          icon: 'none',
        })
        void load(true)
      } else {
        Taro.showToast({ title: tt('checkIn.signFailed', '签到失败'), icon: 'none' })
      }
    } finally {
      setSigning(false)
    }
  }

  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  if (loading) {
    return (
      <ThemeRoot>
        <View style={viewStyles.container(tk)}>
          <View style={viewStyles.center(tk)}>
            <Text style={textStyles.muted(tk)}>{tt('common.loading', '加载中...')}</Text>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  if (error && !info) {
    return (
      <ThemeRoot>
        <View style={viewStyles.container(tk)}>
          <View style={viewStyles.center(tk)}>
            <Text style={textStyles.error(tk)}>{error}</Text>
            <View style={viewStyles.retryBtn(tk)} onTap={() => void load()}>
              <Text style={textStyles.retryBtnText(tk)}>{tt('checkIn.retry', '重试')}</Text>
            </View>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      <View style={viewStyles.container(tk)}>
        <ScrollView
          scrollY
          style={viewStyles.bodyScroll()}
          refresherEnabled
          refresherTriggered={refreshing}
          onRefresherRefresh={() => void load(true)}
        >
          <View style={viewStyles.header()}>
            <View style={viewStyles.backBtn()} onTap={goBack}>
              <Text style={textStyles.backText(tk)}>{tt('common.back', '返回')}</Text>
            </View>
            <Text style={textStyles.title(tk)}>{tt('checkIn.title', '每日签到')}</Text>
            <Text style={textStyles.subtitle(tk)}>{tt('checkIn.subtitle', '连续签到领积分')}</Text>
          </View>

          {info ? (
            <View>
              <View style={viewStyles.statsCard(tk)}>
                <View style={viewStyles.statsRow()}>
                  <View style={viewStyles.statsCol()}>
                    <Text style={textStyles.statsValue(tk)}>{info.streak}</Text>
                    <Text style={textStyles.statsLabel(tk)}>{tt('checkIn.streak', '连续签到')}</Text>
                  </View>
                  <View style={viewStyles.statsCol()}>
                    <Text style={textStyles.statsValue(tk)}>{info.monthlyDays}</Text>
                    <Text style={textStyles.statsLabel(tk)}>
                      {tt('checkIn.monthlyDays', '本月签到')}
                    </Text>
                  </View>
                  <View style={viewStyles.statsCol()}>
                    <Text style={textStyles.statsValue(tk)}>{info.totalDays}</Text>
                    <Text style={textStyles.statsLabel(tk)}>
                      {tt('checkIn.totalDays', '累计签到')}
                    </Text>
                  </View>
                </View>
                <View
                  style={viewStyles.signBtn(tk, info.todaySigned)}
                  onTap={() => void handleSign()}
                >
                  <Text style={textStyles.signBtnText(tk, info.todaySigned)}>
                    {signing
                      ? tt('common.loading', '加载中...')
                      : info.todaySigned
                        ? tt('checkIn.checkedIn', '已签到')
                        : `${tt('checkIn.checkInBtn', '签到')} +${info.todayReward}`}
                  </Text>
                </View>
              </View>

              <View style={{ paddingLeft: toRpx(10), paddingTop: toRpx(16), paddingBottom: toRpx(8) }}>
                <Text style={textStyles.calendarTitle(tk)}>{tt('checkIn.calendar', '签到日历')}</Text>
              </View>
              <View style={viewStyles.calendarGrid()}>
                {info.calendar.map((day) => (
                  <View key={day.date} style={viewStyles.calendarCell(tk, day.signed)}>
                    <Text style={textStyles.calendarDate(tk, day.signed)}>
                      {day.date.slice(-2)}
                    </Text>
                    {day.signed ? (
                      <Image style={{ width: toRpx(14), height: toRpx(14) }} src={CHECK_ICON} />
                    ) : (
                      <Text style={textStyles.calendarMarkReward(tk)}>+{day.reward}</Text>
                    )}
                  </View>
                ))}
              </View>

              {error ? <Text style={textStyles.errorInline(tk)}>{error}</Text> : null}
            </View>
          ) : (
            <View style={viewStyles.center(tk)}>
              <Text style={textStyles.muted(tk)}>{tt('checkIn.empty', '暂无签到记录')}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
