// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { Metadata } from 'next'
import { MasterRegistryConsole } from '@/components/master/MasterRegistryConsole'

export const metadata: Metadata = {
  title: '待你确认 · 总管 | 智汇 AI',
  description: '总管要动你的东西之前，先在这里点一下头。',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <MasterRegistryConsole embedded initialView="approvals" />
}
