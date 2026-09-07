// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 新用户接入引导页 metadata(SEO)。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: '新用户接入引导 | IHUI AI',
  },
  description:
    'IHUI AI 新用户五步接入引导:配置模型 → 首次对话 → Agent 执行 → 时间线回放 → 成本与价表,零配置跑通全平台 AI 能力。',
  alternates: { canonical: '/onboarding' },
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
