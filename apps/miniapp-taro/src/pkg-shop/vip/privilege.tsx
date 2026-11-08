// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳(第 4 批):header/入口卡/权益列表/矩阵与权益弹层/底部升级条全部交给共享屏
//   VipBenefitScreen;本端只保留 ① G-933 冷启动鉴权门控;② 数据拉取与 ?type= 自动弹层;
//   ③ 升级跳转。

import './privilege.css'
import { useTt } from '@/i18n'
import { useDidShow, useRouter } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getVipPrivilege, getVipInfo, type VipInfo } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { VipBenefitScreen as SharedVipBenefitScreen } from '@ihui/rn-app/features/vip-benefit/VipBenefitScreen'
import {
  buildVipBenefitEntries,
  buildVipBenefitHeader,
  buildVipBenefitPopup,
} from './vip-privilege-props'
import type { TFunction, VipBenefitEntry, VipBenefitItem } from '@ihui/types'

interface Privilege {
  id: string
  title: string
  desc: string
}

type PopupType = VipBenefitEntry['id']

export default function PrivilegePage() {
  const tt = useTt()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [list, setList] = useState<Privilege[]>([])
  const [loading, setLoading] = useState(true)
  // XUI-066:加载失败曾被静默成空列表,现在如实上抛。
  const [loadError, setLoadError] = useState('')
  const [vipInfo, setVipInfo] = useState<VipInfo | null>(null)
  const [popup, setPopup] = useState<PopupType | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [privRes, info] = await Promise.all([getVipPrivilege(), getVipInfo().catch(() => null)])
      setList((privRes.list || []) as Privilege[])
      if (info) setVipInfo(info)
    } catch {
      setLoadError(tt('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [tt])

  // G-933 冷启动门控：load 内 getVipInfo(需鉴权) 与 getVipPrivilege 共用一次状态事务，
  // 拆支会改加载态语义 ⇒ 整块延后到鉴权判定落定；游客在落定后仍会走一次（终态与改前一致）。
  const { waitUntilReady } = useAuthReadyGate()
  useDidShow(() => {
    waitUntilReady(() => {
      void load()
    })
  })

  /** 进入页面时根据 ?type= 自动弹起对应弹窗 */
  useEffect(() => {
    const type = router.params.type
    if (type === 'level' || type === 'trader' || type === 'privateAdvisory') {
      setPopup(type)
    }
  }, [router.params.type])

  const goUpgrade = useCallback(() => {
    Taro.navigateTo({ url: '/pkg-shop/vip/index' })
  }, [])

  const items: VipBenefitItem[] = list.map((item) => ({
    id: item.id,
    name: item.title,
    desc: item.desc,
  }))

  const header = buildVipBenefitHeader(vipInfo, tt)
  const entries: VipBenefitEntry[] = buildVipBenefitEntries(tt, setPopup)
  const popupContent = popup ? buildVipBenefitPopup(popup, tt) : null

  return (
    <ThemeRoot>
      <SharedVipBenefitScreen
        t={tt as unknown as TFunction}
        items={items}
        loading={loading}
        error={loadError}
        onBack={() => {
          void Taro.navigateBack()
        }}
        onRetry={() => {
          void load()
        }}
        colorScheme={resolvedTheme}
        header={header}
        entries={entries}
        popup={
          popupContent
            ? {
                ...popupContent,
                onPrimary: goUpgrade,
                onClose: () => setPopup(null),
              }
            : null
        }
        upgrade={{ label: tt('vip.privilege.upgrade', '立即升级'), onPress: goUpgrade }}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
