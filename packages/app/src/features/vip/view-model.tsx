// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { VipFeatureItem } from '../../types'

/** i18n 取词:key 缺失时用 fallback(与小程序 useTt 同签名) */
export type VipIndexTt = (key: string, fallback: string) => string

const FEATURE_SPEC: ReadonlyArray<{
  id: string
  titleKey: string
  titleFallback: string
  descKey: string
  descFallback: string
}> = [
  {
    id: 'ai_copywriting',
    titleKey: 'vip.feature.aiCopywriting',
    titleFallback: 'AI营销文案',
    descKey: 'vip.feature.aiCopywritingDesc',
    descFallback: '智能生成各类营销文案',
  },
  {
    id: 'ai_chat',
    titleKey: 'vip.feature.aiChat',
    titleFallback: 'AI智能对话',
    descKey: 'vip.feature.aiChatDesc',
    descFallback: '智能助手解答各类问题',
  },
  {
    id: 'ai_analysis',
    titleKey: 'vip.feature.aiAnalysis',
    titleFallback: 'AI数据分析',
    descKey: 'vip.feature.aiAnalysisDesc',
    descFallback: '智能分析各类数据报表',
  },
  {
    id: 'ai_design',
    titleKey: 'vip.feature.aiDesign',
    titleFallback: 'AI智能设计',
    descKey: 'vip.feature.aiDesignDesc',
    descFallback: '智能生成图片和设计',
  },
  {
    id: 'ai_video',
    titleKey: 'vip.feature.aiVideo',
    titleFallback: 'AI视频制作',
    descKey: 'vip.feature.aiVideoDesc',
    descFallback: '智能生成视频内容',
  },
  {
    id: 'ai_live',
    titleKey: 'vip.feature.aiLive',
    titleFallback: 'AI直播助手',
    descKey: 'vip.feature.aiLiveDesc',
    descFallback: '智能直播辅助工具',
  },
]

/** 6 项会员特权(小程序与 RN 共用同一份目录) */
export function resolveVipIndexFeatures(tt: VipIndexTt): VipFeatureItem[] {
  return FEATURE_SPEC.map((spec) => ({
    id: spec.id,
    title: tt(spec.titleKey, spec.titleFallback),
    desc: tt(spec.descKey, spec.descFallback),
    tag: 'VIP',
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
