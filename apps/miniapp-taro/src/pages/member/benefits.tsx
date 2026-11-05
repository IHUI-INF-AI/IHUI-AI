// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/vip-benefit/VipBenefitScreen.tsx(直载共享屏 + 注入本端事实)
//
// 本端保留(不可丢的业务):
//   ① G-933 冷启动鉴权门控(GET /api/member/benefits 在 otherRoutes 的 authenticate 之下)
//   ② useDidShow 回前台重拉(权益可能随下单/升级变化)
//   ③ 后端 icon 双形态:图片路径走 Image、文字/emoji 走 Text;无 icon 时保留端内星标兜底
//   ④ 错误面 = 重试重拉(共享屏 onRetry 已暴露,注入 load);返回出口 = 原生导航返回
// 版面(标题/权益卡/等级阶梯)、阶梯目录(与端内 TIERS 同一张表,已上提共享屏)、取词键由共享屏输出。
// 观感差异(已知并接受):① 共用返回面包屑与页面标题(端内原靠原生导航栏);
// ② 空态多一枚"返回"动作;③ 错误态按钮文案取 common.back(共享屏既有实现),动作仍是重试;
// ④ 等级阶梯图标由端内 PNG 换为共享屏线图标。

import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useI18n } from '@/i18n'
import { getMemberBenefits } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { VipBenefitScreen as SharedVipBenefitScreen } from '@ihui/rn-app/features/vip-benefit/VipBenefitScreen'
// 类型不从共享屏模块取:types/rn-shells.generated.d.ts 已为它生成「只含组件」的环境声明,
// 环境声明会遮蔽源码的 type 再导出(TS2305);VipBenefitItem 的单源在 @ihui/types。
import type { VipBenefitItem } from '@ihui/types'

interface Benefit {
  id: string
  title: string
  desc: string
  icon?: string
}

// 统一判断 icon 是否为图片路径(http(s):// 远程 URL 或 / 开头本地路径或 import 路径)
function isImagePath(s: string): boolean {
  return /^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')
}

export default function MemberBenefitsPage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()
  const [list, setList] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const tt = (key: string, fallback: string, params?: Record<string, string | number>) => {
    const v = t(key, params)
    if (v === key) {
      if (!params) return fallback
      return fallback.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
    }
    return v
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getMemberBenefits()
      setList(res.list || [])
    } catch (e) {
      logger.error('member/benefits', '获取权益', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // G-933 冷启动抢跑门控:GET /api/member/benefits 挂在 otherRoutes 的统一 preHandler
  // (`apps/api/src/routes/other/index.ts:42` addHook authenticate)之下 ⇒ 属需鉴权请求,
  // 未落定期间不发;落定(含"落定但未登录")后照发一次,页面空态由既有分支渲染。
  useDidShow(() => {
    gate.waitUntilReady(load)
  })

  // 后端 icon 双形态落成共享屏的两个可选槽位(其它端不传 ⇒ 不渲染,零观感影响)
  const items: VipBenefitItem[] = list.map((b) => {
    const iconIsImage = !!b.icon && isImagePath(b.icon)
    return {
      id: b.id,
      name: b.title,
      desc: b.desc,
      ...(iconIsImage ? { iconUri: b.icon as string } : {}),
      // 端内原兜底:无 icon 时星标占位(共享屏无图标槽位缺失即不渲染)
      icon: iconIsImage ? undefined : (b.icon ?? '⭐'),
    }
  })

  return (
    <ThemeRoot>
      <SharedVipBenefitScreen
        t={t}
        items={items}
        loading={loading}
        error={error ? tt('member.benefits.loadFailed', '加载失败') : ''}
        onBack={() => {
          void Taro.navigateBack()
        }}
        onRetry={load}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
