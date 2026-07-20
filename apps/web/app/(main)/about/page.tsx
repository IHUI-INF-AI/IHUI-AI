import type { Metadata } from 'next'
import { AboutContent } from './AboutContent'

export const metadata: Metadata = {
  title: '关于我们',
  description:
    '智汇 AI 社区是 AI 时代企业理性效率服务与互助社群,帮助决策者深度理解 AI 与企业的关系,构建人机协同的超级组织。',
}

export default function AboutPage() {
  return <AboutContent />
}
