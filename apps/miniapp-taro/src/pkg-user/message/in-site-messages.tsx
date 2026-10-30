// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 MessageCenterScreen items 卡片的端内子模块:共享屏 TABS 里 order/course 两类的
// 站内消息(edu_messages,GET /messages?msgType=)。类型徽章取用与共享屏 typeLabel
// 同一套静态键(未知值默认「系统」档,与 spec default 分支同形)。
// 本页拆 ./ 子模块由还原度门并入载体面(check-miniapp-mirror-fidelity localModuleRels)。
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { get } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'

/** GET /messages(edu_messages)本块用到的字段;其余字段不声明、不解构 */
interface InSiteMessageRow {
  id: string
  title: string | null
  content: string | null
  msgType: string
  createdAt: string
}

interface InSiteMessageListRes {
  list: InSiteMessageRow[]
  total?: number
}

export interface InSiteMessagePaneProps {
  /** 站内消息分类键,取值与共享屏 TABS 的 order/course 同源 */
  msgType: 'order' | 'course'
}

export function InSiteMessagePane({ msgType }: InSiteMessagePaneProps) {
  const { t } = useI18n()
  // gate 对象每次渲染都是新字面量,只有 waitUntilReady(useCallback([]))是稳定引用;
  // effect 依赖只解构取它,取整枚 gate 会每次重渲染重跑 ⇒ 请求循环。
  const { waitUntilReady } = useAuthReadyGate()
  const [rows, setRows] = useState<InSiteMessageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const cancel = waitUntilReady(() => {
      if (cancelled) return
      void get<InSiteMessageListRes>('/messages', { page: 1, pageSize: 20, msgType })
        .then((res) => {
          if (!cancelled) setRows(res.list || [])
        })
        .catch(() => {
          if (!cancelled) setRows([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })
    return () => {
      cancelled = true
      cancel()
    }
  }, [waitUntilReady, msgType])

  const typeLabel = (type: string): string => {
    if (type === 'order') return t('messageCenter.type.order')
    if (type === 'course') return t('messageCenter.type.course')
    return t('message.tabs.system')
  }

  if (loading) {
    return (
      <Text className="block text-center text-[length:28rpx] text-muted-foreground py-[96rpx]">
        {t('common.loading')}
      </Text>
    )
  }
  if (!rows.length) {
    return (
      <Text className="block text-center text-[length:28rpx] text-muted-foreground py-[96rpx]">
        {t('message.empty')}
      </Text>
    )
  }
  return (
    <View className="p-[20rpx]">
      {rows.map((row) => (
        <View key={row.id} className="py-[20rpx] px-[16rpx] rounded-xl">
          <View className="flex flex-row items-center gap-[12rpx]">
            <Text className="px-[10rpx] py-[2rpx] rounded-md bg-muted text-[length:22rpx] font-semibold text-muted-foreground">
              {typeLabel(row.msgType)}
            </Text>
            <Text className="flex-1 text-[length:30rpx] font-semibold text-foreground truncate">
              {row.title || row.content || t('message.unnamedRoom')}
            </Text>
          </View>
          {row.title && row.content ? (
            <Text className="block mt-[4rpx] text-[length:26rpx] text-muted-foreground truncate">
              {row.content}
            </Text>
          ) : null}
          <Text className="block mt-[4rpx] text-[length:22rpx] text-muted-foreground">
            {row.createdAt}
          </Text>
        </View>
      ))}
    </View>
  )
}

export default InSiteMessagePane
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
