// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 对齐目标(RN 共享屏): packages/app/src/features/vip-trader/VipTraderScreen.tsx
// 镜像 packages/app/src/features/vip-trader/VipTraderScreen.tsx
import { useI18n } from '@/i18n'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useTheme } from '@/rn-compat/theme'
import ThemeRoot from '@/components/ThemeRoot'
import { VipTraderScreen as SharedVipTraderScreen } from '@ihui/rn-app/features/vip-trader/VipTraderScreen'
import type { VipTraderScreenProps, VipTraderStat } from '@ihui/rn-app/features/vip-trader/VipTraderScreen'
import { onToast } from '@/host/on-toast'

// 共享屏 vipTrader.* 键 → 端内既有词条(门 299:逐键对齐,不得回落裸 key)。
// 端内 vipTrader.opened 语义为"开通成功"(toast),与共享屏作"已开通"按钮态标签不同,
// 此处显式覆盖为 RN 同义文案"已开通"。其余键端内 zh-CN 包已齐备,直落 t()。
const VIP_TRADER_TEXT: Record<string, string> = {
  'vipTrader.opened': '已开通',
}

export default function VipTraderIndexPage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [stats, setStats] = useState<VipTraderStat[]>([])
  const [opened, setOpened] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // 共享屏文案适配:共享键 → 端内词条(必要处显式覆盖);透传 ICU 参数避免 heroDesc 占位符裸显。
  const sharedT = useCallback<VipTraderScreenProps['t']>(
    (key, options) => {
      const override = VIP_TRADER_TEXT[key]
      if (override !== undefined) return override
      return t(key, options)
    },
    [t],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      // ⚠️ @demo-data 历史业绩/收益统计为端内置演示数字,非真实战绩(同原 host PERFORMANCE_METRICS
      // 的合规批注)。共享屏 stats 槽本应由 wrapper 从 CommissionOverview 构建,端内暂以演示数字填充,
      // 待真实佣金概览端点接入后替换(台账在账,2026-10-24 全端 mock 审计)。
      const demoStats: VipTraderStat[] = [
        { label: '年化收益', value: '+38.6%', trend: '近一年' },
        { label: '胜率', value: '72.4%', trend: '近三月' },
        { label: '最大回撤', value: '-12.8%', trend: '区间' },
        { label: '累计收益', value: '+186.2%', trend: '成立以来' },
      ]
      setStats(demoStats)
    } catch {
      // 演示数据为本页内置常量,正常不会抛;保留兜底错误态分支以对齐共享屏 error 渲染。
      setError('加载交易者失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useDidShow(load)

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  // 保留原 host 一键开通的弹窗交互(真实购买链路 POST /api/vip/purchase 尚未接入,
  // 开通成功态以 opened 本地态表达,不冒充服务端真值,见交付报告)。
  const handleOpen = useCallback(() => {
    Taro.showModal({
      title: t('vipTrader.openTitle'),
      content: t('vipTrader.confirmPay') + ' ¥9980 ' + t('vipTrader.openTrader') + '?',
      success: (res) => {
        if (res.confirm) {
          setOpened(true)
          onToast(t('vipTrader.opened'), { kind: 'success' })
        }
      },
    })
  }, [t])

  return (
    <ThemeRoot>
      <SharedVipTraderScreen
        t={sharedT}
        stats={stats}
        opened={opened}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={handleRefresh}
        onOpen={handleOpen}
        onBack={() => {
          void Taro.navigateBack({ delta: 1 })
        }}
        colorScheme={resolvedTheme}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
