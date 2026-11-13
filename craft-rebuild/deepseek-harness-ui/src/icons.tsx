// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base(size: number | undefined, fallback = 16) {
  const s = size ?? fallback
  return {
    width: s,
    height: s,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

export function IconNewChat({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M2.4 11.25c-.78-1.36-1.05-2.95-.75-4.49.3-1.54 1.14-2.92 2.38-3.88C5.26 1.9 6.8 1.43 8.34 1.5c1.56.08 3.05.73 4.18 1.82C13.64 4.41 14.34 5.87 14.48 7.43c.13 1.56-.3 3.12-1.22 4.39-.93 1.27-2.27 2.16-3.8 2.51" />
      <path d="M8 5v6M5 8h6" />
    </svg>
  )
}

export function IconPlugin({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 7V3h4v4M8 7h4v4H8M4 11H2v3a1 1 0 0 0 1 1h3v-2" />
    </svg>
  )
}

export function IconAutomation({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  )
}

export function IconMore({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="3" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="13" cy="8" r=".9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconSearch({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  )
}

export function IconCollapse({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 4 3 8l3 4M12 4l-3 4 3 4" />
    </svg>
  )
}

export function IconExpand({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M10 4l3 4-3 4M4 4l3 4-3 4" />
    </svg>
  )
}

export function IconFolder({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p} style={{ color: 'var(--color-accent)', ...p.style }}>
      <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5Z" />
    </svg>
  )
}

export function IconChevronDown({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

export function IconPlus({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

export function IconFile({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 2h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M9 2v3h3" />
    </svg>
  )
}

export function IconFolderOpen({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V7" />
      <path d="M2 4.5V4a1 1 0 0 1 1-1h3.5L8 4.5" />
      <path d="M2.5 7h11l-1.5 6a1 1 0 0 1-1 .8H4a1 1 0 0 1-1-.8L2.5 7Z" />
    </svg>
  )
}

export function IconTerminal({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 5l4 3-4 3M9 12h4" />
    </svg>
  )
}

export function IconTheme({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 3v10" />
    </svg>
  )
}

export function IconSend({ size, ...p }: P) {
  return (
    <svg {...base(size, 16)} {...p} strokeWidth={1.6}>
      <path
        d="M8 13.5V3M8 3l-3.6 3.6M8 3l3.6 3.6"
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconX({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

export function IconBrand({ size = 26, ...p }: P) {
  return (
    <svg
      width={size}
      height={(size * 18) / 26}
      viewBox="0 0 26 18"
      {...p}
      fill="currentColor"
      stroke="none"
    >
      {/* 实心鲸身 */}
      <path d="M3.2 11.4C3.2 7.3 6.6 4 10.7 4c3.3 0 6.1 2 7.3 4.9.5-.6 1.3-1 2.2-1 1.6 0 2.9 1.3 2.9 2.9 0 1.6-1.3 2.9-2.9 2.9-.7 0-1.4-.3-1.9-.7-1.3 2.2-3.7 3.6-6.4 3.6h-2.2c-3.7 0-6.5-2.4-6.5-5.2Z" />
      {/* 尾鳍 */}
      <path d="M21.9 8.1 25 5.3c.5-.4 1.1.2.9.8l-1 3.3 1 3.3c.2.6-.4 1.1-.9.8l-3.1-2.8c.6-.4 1-.9 1-1.6 0-.4-.1-.7-.3-1Z" />
      {/* 眼睛（挖空） */}
      <circle cx="8.1" cy="8.4" r="1.15" fill="#fff" />
    </svg>
  )
}

export function IconBolt({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 1.5 3.5 9H7l-1 5.5L11.5 7H8l1-5.5Z" />
    </svg>
  )
}

export function IconGridDots({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p} strokeWidth={1.6}>
      <circle cx="4" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconPanelCollapse({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p} strokeWidth={1.4}>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
      <path d="M9 3.5v9" />
    </svg>
  )
}

export function IconSortLines({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p} strokeWidth={1.5}>
      <path d="M3 4.5h7M3 8h5M3 11.5h3M12.5 6v5M11 9.5l1.5 1.5L14 9.5" />
    </svg>
  )
}

export function IconFolderPlus({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p} strokeWidth={1.4}>
      <path d="M2.5 4.5a1 1 0 0 1 1-1h2.6l1.2 1.4h4.2a1 1 0 0 1 1 1v6.6a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V4.5Z" />
      <path d="M8 7.6v3.2M6.4 9.2h3.2" />
    </svg>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
