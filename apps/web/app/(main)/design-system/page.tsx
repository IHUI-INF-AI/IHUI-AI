import type { Metadata } from 'next'

import { DesignSystemDemoContent } from './DesignSystemDemoContent'

export const metadata: Metadata = {
  title: '设计系统演示',
  description:
    '展示项目设计 token：颜色、字体、间距、按钮、卡片、表单、徽章、头像、标签页与 Toast。',
}

export default function DesignSystemPage() {
  return <DesignSystemDemoContent />
}
