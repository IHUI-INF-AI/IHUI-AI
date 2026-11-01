// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getBalance } from '@ihui/api-client'
import { WalletScreen as SharedWalletScreen, type WalletBalance } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 对齐说明:Uniapp 历史项目无独立"钱包/余额"页(资金能力分散在
 * pages/tools/token_value.vue 我的智汇值 / pagesA/top-up/index.vue 充值 / withdrawal 提现),
 * 按钮文案对齐 Uniapp:recharge=充值(top-up 标题) / withdraw=提现(withdrawal 标题)。
 * mobile-rn/shared zh-CN 暂无 wallet.* key(translate 缺 key 返回 key 本身),
 * key 就绪后此覆盖可删。
 */
const UNIAPP_TEXT: Record<string, string> = {
  'wallet.title': '我的钱包',
  'wallet.balance': '可用余额',
  'wallet.frozen': '冻结金额',
  'wallet.totalRecharge': '累计充值',
  'wallet.totalWithdraw': '累计提现',
  'wallet.recharge': '充值',
  'wallet.withdraw': '提现',
  'wallet.loadFailed': '加载失败',
}

export function WalletScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getBalance()
      if (!res.success || !res.data) throw new Error(res.error)
      // 余额单位是「分」(userMargins.tokenQuantity,与 web /api/finance/margin/balance 同源;
      // web 钱包页按 value/100 渲染),壳内投影 /100,避免共享屏 toFixed(2) 放大 100 倍。
      const d = res.data
      // null 安全:后端缺值时保留 null ⇒ 共享屏显示 — 占位符;
      // 不被 /100 换算强转成 0,避免静默击穿「余额为 null 显示 —」既有特性。
      setBalance({
        balance: Number.isFinite(d.balance) ? d.balance / 100 : null,
        frozenBalance: Number.isFinite(d.frozenBalance) ? d.frozenBalance / 100 : null,
        totalRecharge: Number.isFinite(d.totalRecharge) ? d.totalRecharge / 100 : null,
        totalWithdraw: Number.isFinite(d.totalWithdraw) ? d.totalWithdraw / 100 : null,
      } as WalletBalance)
    } catch {
      setError(uniappT('wallet.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [uniappT])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedWalletScreen
      t={uniappT}
      balance={balance}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onAction={(action) => navigation.navigate(action === 'withdraw' ? 'Withdraw' : 'Recharge')}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
