// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Computer Use 可视化驾驶舱页 metadata(SEO):服务端 wrapper 注入唯一 title/OG,区别于工作区通用标题。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Computer Use 可视化驾驶舱 | IHUI AI',
  },
  description:
    'IHUI AI Computer Use 浏览器可视化驾驶舱:真实驱动 headless Chromium,打开网页、交互元素快照、点击/输入、截图、提取文本,对标 Claude Computer Use。',
  alternates: { canonical: '/computer-use' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: 'Computer Use 可视化驾驶舱 | IHUI AI',
    description:
      'IHUI AI Computer Use:真实浏览器快速打开页面、交互元素快照、点击/输入、截图、提取文本。',
    url: 'https://aizhs.top/computer-use',
    siteName: 'IHUI AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IHUI AI Computer Use' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Computer Use 可视化驾驶舱 | IHUI AI',
    description: 'IHUI AI Computer Use,浏览器可视化自动驾驶舱。',
    images: ['/og-image.png'],
  },
}

export default function ComputerUseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
