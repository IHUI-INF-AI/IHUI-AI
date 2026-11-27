// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { Metadata } from 'next'
import { MasterRegistryConsole } from '@/components/master/MasterRegistryConsole'

export const metadata: Metadata = {
  title: '总管 · 智能体控制台 | 智汇 AI',
  description: '一个注册表、一个运行账本、一层审批：注册、调度、查看、暂停、删除审批与版本回滚。',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <MasterRegistryConsole />
}
