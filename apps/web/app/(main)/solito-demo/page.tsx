'use client'

import { useRouter } from 'next/navigation'
import { AboutScreen } from '@ihui/app'

/**
 * Solito 共享层 PoC 页面。
 * 引用 packages/app 的 AboutScreen(react-native-web 渲染),
 * 验证 web 端能正确渲染共享组件。
 */
export default function SolitoDemoPage() {
  const router = useRouter()
  return <AboutScreen onBack={() => router.push('/')} />
}
