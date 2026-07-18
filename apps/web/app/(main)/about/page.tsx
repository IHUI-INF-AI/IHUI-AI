import * as React from 'react'
import type { Metadata } from 'next'
import { AboutContent, type AboutValue, type AboutInfo } from './AboutContent'

export const metadata: Metadata = {
  title: '关于我们',
  description:
    '智汇 AI 社区是 AI 时代企业理性效率服务与互助社群,帮助决策者深度理解 AI 与企业的关系,构建人机协同的超级组织。',
}

// 静态降级内容(API 不可用或未配置时使用)
export const FALLBACK_INFO: AboutInfo = {
  siteName: '智汇 AI 社区',
  description:
    '智汇 AI 社区是 AI 时代企业理性效率服务与互助社群。我们帮助决策者深度理解 AI 与企业的关系,构建人机协同的超级组织,实现企业的理性效率提升。',
}

export const FALLBACK_VALUES: AboutValue[] = [
  {
    icon: 'target',
    title: '我们的使命',
    desc: '帮助决策者深度理解 AI 与企业的关系,推动企业理性效率提升。',
  },
  {
    icon: 'users',
    title: '我们的社群',
    desc: '汇聚 AI 时代企业决策者,构建人机协同的超级组织,互助共进。',
  },
  {
    icon: 'shield',
    title: '我们的承诺',
    desc: '不满意全额退款。前 18 位会员享受一对一 AI 顾问咨询。',
  },
  {
    icon: 'rocket',
    title: '我们的方向',
    desc: '从 AI 新工具到企业 AI 文化,三阶段循序渐进,持续演进。',
  },
]

export default function AboutPage() {
  return <AboutContent fallbackInfo={FALLBACK_INFO} fallbackValues={FALLBACK_VALUES} />
}
