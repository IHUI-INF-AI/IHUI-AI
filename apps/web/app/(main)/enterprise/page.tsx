import type { Metadata } from 'next'

import { EnterpriseContent } from './EnterpriseContent'

export const metadata: Metadata = {
  title: '智汇 AI 企业服务',
  description:
    'AI时代企业理性效率服务与互助社群,帮助决策者深度理解AI与企业的关系,构建人机协同的超级组织。',
  openGraph: {
    title: '智汇 AI 企业服务',
    description:
      'AI时代企业理性效率服务与互助社群,帮助决策者构建人机协同的超级组织。早鸟价 ¥6000/人/年,限18席。',
  },
}

export default function EnterprisePage() {
  return <EnterpriseContent />
}
