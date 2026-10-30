// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 会员对比表(从 details.tsx 拆出:页面已近 250 行上限,新增块按规矩落同目录子模块)
import { View, Text } from '@tarojs/components'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/i18n'
import { get } from '@/api'
import { logger } from '@/utils/logger'
import type { VipCompareRow } from '@ihui/types'

/**
 * 镜像 packages/app/src/features/vip-compare/VipCompareScreen.tsx 的 table 区块:
 * 表头四列 = 功能 / 基础 / 高级 / 企业(与共享屏同用 vipCompare.* 四键),
 * 行 = feature + 三档取值;隔行 muted、表头 muted、单元格 padding 10 / fontSize 11
 * 按本端 rpx 档换算(与页面既有表格同一套观感)。
 *
 * 数据契约与 RN 容器 apps/mobile-rn/src/screens/VipCompareScreen.tsx 同一份:
 * GET /vip-compare(apps/api/src/routes/vip.ts 按 vip_levels 的 levelValue 1/2/3 聚成
 * basic/premium/enterprise 三列,值只有 ✓ 与 —);该路由公开、无需登录。
 */
export default function CompareTable() {
  const { t } = useI18n()
  const [rows, setRows] = useState<VipCompareRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await get<VipCompareRow[]>('/vip-compare')
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      logger.error('pkg-shop/vip/details', '获取会员对比', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cell = 'flex-1 py-[20rpx] px-[16rpx] text-center text-muted-foreground text-[length:22rpx]'

  /**
   * /vip-compare 的 feature 值 = vip_levels.benefits 里的机器键(生产现读形如
   * ["unlimitedChat",…],vip.ts:240-247 原样透出)。译名复用端内同一张表
   * `vip.benefitList.*`(与 api/index.ts getVipPrivilege 的口径逐字同源);
   * 未登记译名的键原样透出(§19:不在代码层拼中文),不新造文案键。
   */
  const featureLabel = (k: string) => {
    const key = `vip.benefitList.${k}`
    const v = t(key)
    return v === key ? k : v
  }

  let body = null
  if (error) {
    body = (
      <View className="flex flex-col items-center py-[32rpx]">
        <Text className="text-[length:24rpx] text-muted-foreground">{t('common.loadFailed')}</Text>
        <View
          className="mt-[16rpx] px-[28rpx] py-[8rpx] border-[length:2rpx] border-border rounded-md"
          hoverClass="opacity-60"
          onClick={load}
        >
          <Text className="text-[length:24rpx] text-foreground">{t('common.retry')}</Text>
        </View>
      </View>
    )
  } else if (loading) {
    body = (
      <Text className="block py-[32rpx] text-center text-[length:24rpx] text-muted-foreground">
        {t('common.loading')}
      </Text>
    )
  } else if (rows.length === 0) {
    // 与共享屏空态同一句文案(空态只属于「取到了但确实没有」)
    body = (
      <Text className="block py-[32rpx] text-center text-[length:24rpx] text-muted-foreground">
        {t('common.empty')}
      </Text>
    )
  } else {
    body = (
      <View className="flex flex-col">
        {rows.map((row, idx) => (
          <View
            key={row.feature}
            className={`flex items-stretch ${idx % 2 === 1 ? 'bg-muted' : ''}`}
          >
            <Text className="flex-[1.2] py-[20rpx] px-[16rpx] text-left text-foreground font-semibold text-[length:22rpx]">
              {featureLabel(row.feature)}
            </Text>
            <Text className={cell}>{row.basic}</Text>
            <Text className={cell}>{row.premium}</Text>
            <Text className={cell}>{row.enterprise}</Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View className="border-[length:2rpx] border-border rounded-xl overflow-hidden">
      <View className="flex items-stretch bg-muted">
        <Text className="flex-[1.2] py-[20rpx] px-[16rpx] text-left text-foreground font-semibold text-[length:22rpx]">
          {t('vipCompare.feature')}
        </Text>
        <Text className={cell}>{t('vipCompare.basic')}</Text>
        <Text className={cell}>{t('vipCompare.premium')}</Text>
        <Text className={cell}>{t('vipCompare.enterprise')}</Text>
      </View>
      {body}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
