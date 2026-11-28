// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { Metadata } from 'next'
import { MasterRegistryConsole } from '@/components/master/MasterRegistryConsole'

export const metadata: Metadata = {
  title: 'AI总管 · 今日 | 智汇 AI',
  description: 'AI总管今日面：今日队列与八张能力入口，左边直接跟总管说。',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <MasterRegistryConsole embedded initialView="workbench" />
}
