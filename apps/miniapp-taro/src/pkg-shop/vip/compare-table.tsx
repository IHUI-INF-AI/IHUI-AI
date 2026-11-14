// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会员对比表(第 5 批薄壳):表格 UI 下沉共享组件 `VipMatrix`
 * (`packages/app/src/features/vip-compare/VipMatrix.tsx`,消费端 RN 见
 * `apps/mobile-rn/src/screens/VipCompareScreen.tsx:73`)。
 * 本模块只保留本端职责:GET /vip-compare 取数、三态文案、feature 机器键→译名。
 */

import { Text } from '@tarojs/components'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/i18n'
import { useTheme } from '@/rn-compat/theme'
import { getVipCompare } from '@ihui/api-client'
import { unwrapApi } from '@/utils/api-bridge'
import { logger } from '@/utils/logger'
import { VipMatrix } from '@ihui/rn-app/features/vip-compare/VipMatrix'
import { mapCompareRows, type CompareMatrixRow } from './details-props'

/**
 * 数据契约与 RN 容器 `apps/mobile-rn/src/screens/VipCompareScreen.tsx` 同一份:
 * GET /vip-compare(api 路由按 vip_levels 的 levelValue 1/2/3 聚成 basic/premium/enterprise 三列)。
 */
export default function CompareTable() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [rows, setRows] = useState<CompareMatrixRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  /**
   * /vip-compare 的 feature 值 = vip_levels.benefits 里的机器键;译名复用端内同一张表
   * `vip.benefitList.*`(与 api/index.ts getVipPrivilege 的口径逐字同源);未登记译名的键原样透出。
   */
  const featureLabel = useCallback(
    (k: string) => {
      const key = `vip.benefitList.${k}`
      const v = t(key)
      return v === key ? k : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await unwrapApi(getVipCompare())
      const list = Array.isArray(data) ? data : []
      setRows(mapCompareRows(list, featureLabel))
    } catch (e) {
      logger.error('pkg-shop/vip/details', '获取会员对比', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [featureLabel])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <Text className="block py-[32rpx] text-center text-label text-muted-foreground">
        {t('common.loading')}
      </Text>
    )
  }
  if (error) {
    return (
      <Text
        className="block py-[32rpx] text-center text-label text-muted-foreground"
        onClick={() => void load()}
      >
        {t('common.loadFailed')}
      </Text>
    )
  }
  if (rows.length === 0) {
    return (
      <Text className="block py-[32rpx] text-center text-label text-muted-foreground">
        {t('common.empty')}
      </Text>
    )
  }
  return (
    <VipMatrix
      columns={[
        t('vipCompare.feature'),
        t('vipCompare.basic'),
        t('vipCompare.premium'),
        t('vipCompare.enterprise'),
      ]}
      rows={rows}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
