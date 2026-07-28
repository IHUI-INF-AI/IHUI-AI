import type { Metadata } from 'next'
import { SponsorContent } from './SponsorContent'

export const metadata: Metadata = {
  title: '赞助 IHUI AI — 开源 AI 操作系统持续开发',
  description:
    '赞助 IHUI AI 开源项目。5 档赞助等级 Bronze/Silver/Gold/Platinum/Diamond,月费 ¥99 起,享 README 致谢、会员群、优先 Issue、技术分享、1 对 1 咨询等权益。',
  alternates: {
    canonical: '/sponsor',
  },
  openGraph: {
    title: '赞助 IHUI AI — 支持开源 AI 操作系统',
    description:
      '5 档赞助等级,支持开源 AI 平台持续开发,获专属权益。',
    url: 'https://aizhs.top/sponsor',
    type: 'website',
  },
}

export default function SponsorPage() {
  return <SponsorContent />
}
