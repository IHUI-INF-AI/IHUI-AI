// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { Metadata } from 'next'
import { MasterRegistryConsole } from '@/components/master/MasterRegistryConsole'

export const metadata: Metadata = {
  title: '智能体与子智能体 · 总管 | 智汇 AI',
  description: '总管的用人面板：智能体与子智能体、待你确认。',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <MasterRegistryConsole embedded initialView="registry" />
}
