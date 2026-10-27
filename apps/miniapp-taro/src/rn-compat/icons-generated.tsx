// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ⚠️ 生成物,请勿手改 —— 重新生成:`node scripts/gen-rn-compat.mjs --write`
 *
 * 内容:共享层(packages/app)与 RN 端取用的全部 lucide 图标 —— 一个名字一枚具名导出,
 * 与 `import { Heart } from 'lucide-react-native'` 同形,所以 alias 过去后各屏零改动可用。
 * 名字全集按 HEAD 面现算:新增图标只要被任何一屏 import,重跑生成器即覆盖,不需要人工登记。
 * (缺这一格时的现场:webpack 具名导入取不到 ⇒ 该屏整块编译失败,而不是少一个图标。)
 *
 * 渲染口径:SVG 为纯黑描边,由 CSS mask 只取 alpha ⇒ 实际颜色走 background-color,
 * 与端内 LineIcon 同一手法,主题切换时随 token 换色(不会定死成黑色)。
 */
import { makeIcon } from './icons-runtime'
import type { CompatIconProps } from './icons-runtime'

/** lucide-react-native 的组件类型名(消费面有写 import type { LucideIcon } 的)—— 别名指到本文件,这个类型位也必须在这里 */
export type LucideIcon = (props: CompatIconProps) => ReturnType<typeof makeIcon>

const S = {
  Activity:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-activity"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />\n</svg>\n',
  AlertCircle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-alert-circle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <line x1="12" x2="12" y1="8" y2="12" />\n  <line x1="12" x2="12.01" y1="16" y2="16" />\n</svg>\n',
  AlertTriangle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-alert-triangle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />\n  <path d="M12 9v4" />\n  <path d="M12 17h.01" />\n</svg>\n',
  AppWindow:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-app-window"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect x="2" y="4" width="20" height="16" rx="2" />\n  <path d="M10 4v4" />\n  <path d="M2 8h20" />\n  <path d="M6 4v4" />\n</svg>\n',
  ArrowDown:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-arrow-down"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 5v14" />\n  <path d="m19 12-7 7-7-7" />\n</svg>\n',
  ArrowRight:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-arrow-right"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M5 12h14" />\n  <path d="m12 5 7 7-7 7" />\n</svg>\n',
  ArrowUp:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-arrow-up"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m5 12 7-7 7 7" />\n  <path d="M12 19V5" />\n</svg>\n',
  Award:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-award"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />\n  <circle cx="12" cy="8" r="6" />\n</svg>\n',
  BadgeCheck:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-badge-check"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />\n  <path d="m16 9-5.5 5.5L8 12" />\n</svg>\n',
  Banknote:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-banknote"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="20" height="12" x="2" y="6" rx="2" />\n  <circle cx="12" cy="12" r="2" />\n  <path d="M6 12h.01M18 12h.01" />\n</svg>\n',
  BarChart3:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-bar-chart-3"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3 3v16a2 2 0 0 0 2 2h16" />\n  <path d="M18 17V9" />\n  <path d="M13 17V5" />\n  <path d="M8 17v-3" />\n</svg>\n',
  Bell: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-bell"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10.268 21a2 2 0 0 0 3.464 0" />\n  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />\n</svg>\n',
  BellRing:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-bell-ring"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10.268 21a2 2 0 0 0 3.464 0" />\n  <path d="M22 8c0-2.3-.8-4.3-2-6" />\n  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />\n  <path d="M4 2C2.8 3.7 2 5.7 2 8" />\n</svg>\n',
  Blocks:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-blocks"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" />\n  <rect x="14" y="2" width="8" height="8" rx="1" />\n</svg>\n',
  BookMarked:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-book-marked"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 2v8l3-3 3 3V2" />\n  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />\n</svg>\n',
  BookOpen:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-book-open"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 5v16" />\n  <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />\n</svg>\n',
  Bookmark:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-bookmark"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />\n</svg>\n',
  BookmarkCheck:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-bookmark-check"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />\n  <path d="m9 10 2 2 4-4" />\n</svg>\n',
  Bot: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-bot"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 8V4H8" />\n  <rect width="16" height="12" x="4" y="8" rx="2" />\n  <path d="M2 14h2" />\n  <path d="M20 14h2" />\n  <path d="M15 13v2" />\n  <path d="M9 13v2" />\n</svg>\n',
  Boxes:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-boxes"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />\n  <path d="m7 16.5-4.74-2.85" />\n  <path d="m7 16.5 5-3" />\n  <path d="M7 16.5v5.17" />\n  <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />\n  <path d="m17 16.5-5-3" />\n  <path d="m17 16.5 4.74-2.85" />\n  <path d="M17 16.5v5.17" />\n  <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />\n  <path d="M12 8 7.26 5.15" />\n  <path d="m12 8 4.74-2.85" />\n  <path d="M12 13.5V8" />\n</svg>\n',
  Brain:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-brain"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 18V5" />\n  <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />\n  <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />\n  <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />\n  <path d="M18 18a4 4 0 0 0 2-7.464" />\n  <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />\n  <path d="M6 18a4 4 0 0 1-2-7.464" />\n  <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />\n</svg>\n',
  BriefcaseBusiness:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-briefcase-business"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 12h.01" />\n  <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />\n  <path d="M22 13a18.15 18.15 0 0 1-20 0" />\n  <rect width="20" height="14" x="2" y="6" rx="2" />\n</svg>\n',
  Building2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-building-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 12h4" />\n  <path d="M10 8h4" />\n  <path d="M14 21v-3a2 2 0 0 0-4 0v3" />\n  <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />\n  <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />\n</svg>\n',
  Calendar:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-calendar"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M8 2v3" />\n  <path d="M16 2v3" />\n  <rect x="3" y="3" width="18" height="18" rx="2" />\n  <path d="M3 9h18" />\n</svg>\n',
  CalendarCheck:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-calendar-check"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M8 2v3" />\n  <path d="M16 2v3" />\n  <rect x="3" y="3" width="18" height="18" rx="2" />\n  <path d="M3 9h18" />\n  <path d="m9 15 2 2 4-4" />\n</svg>\n',
  CalendarClock:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-calendar-clock"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M16 14v2.2l1.6 1" />\n  <path d="M16 2v3" />\n  <path d="M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338" />\n  <path d="M3 9h5.859" />\n  <path d="M8 2v3" />\n  <circle cx="16" cy="16" r="6" />\n</svg>\n',
  CalendarDays:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-calendar-days"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M8 2v3" />\n  <path d="M16 2v3" />\n  <rect x="3" y="3" width="18" height="18" rx="2" />\n  <path d="M3 9h18" />\n  <path d="M8 13h.01" />\n  <path d="M12 13h.01" />\n  <path d="M16 13h.01" />\n  <path d="M8 17h.01" />\n  <path d="M12 17h.01" />\n  <path d="M16 17h.01" />\n</svg>\n',
  Camera:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-camera"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />\n  <circle cx="12" cy="13" r="3" />\n</svg>\n',
  ChartLine:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-chart-line"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3 3v16a2 2 0 0 0 2 2h16" />\n  <path d="m19 9-5 5-4-4-3 3" />\n</svg>\n',
  Check:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-check"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 6 9 17l-5-5" />\n</svg>\n',
  CheckCircle2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-check-circle-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="m16 9-5.5 5.5L8 12" />\n</svg>\n',
  ChevronDown:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-chevron-down"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m6 9 6 6 6-6" />\n</svg>\n',
  ChevronLeft:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-chevron-left"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m15 18-6-6 6-6" />\n</svg>\n',
  ChevronRight:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-chevron-right"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m9 18 6-6-6-6" />\n</svg>\n',
  ChevronUp:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-chevron-up"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m18 15-6-6-6 6" />\n</svg>\n',
  ChevronsLeft:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-chevrons-left"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m11 17-5-5 5-5" />\n  <path d="m18 17-5-5 5-5" />\n</svg>\n',
  ChevronsRight:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-chevrons-right"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m6 17 5-5-5-5" />\n  <path d="m13 17 5-5-5-5" />\n</svg>\n',
  Circle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-circle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n</svg>\n',
  CircleAlert:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-circle-alert"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <line x1="12" x2="12" y1="8" y2="12" />\n  <line x1="12" x2="12.01" y1="16" y2="16" />\n</svg>\n',
  CircleCheck:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-circle-check"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="m16 9-5.5 5.5L8 12" />\n</svg>\n',
  CircleDashed:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-circle-dashed"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10.1 2.182a10 10 0 0 1 3.8 0" />\n  <path d="M13.9 21.818a10 10 0 0 1-3.8 0" />\n  <path d="M17.609 3.721a10 10 0 0 1 2.69 2.7" />\n  <path d="M2.182 13.9a10 10 0 0 1 0-3.8" />\n  <path d="M20.279 17.609a10 10 0 0 1-2.7 2.69" />\n  <path d="M21.818 10.1a10 10 0 0 1 0 3.8" />\n  <path d="M3.721 6.391a10 10 0 0 1 2.7-2.69" />\n  <path d="M6.391 20.279a10 10 0 0 1-2.69-2.7" />\n</svg>\n',
  CircleDollarSign:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-circle-dollar-sign"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />\n  <path d="M12 18V6" />\n</svg>\n',
  CircleHelp:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-circle-help"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />\n  <path d="M12 17h.01" />\n</svg>\n',
  CircleQuestionMark:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-circle-question-mark"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />\n  <path d="M12 17h.01" />\n</svg>\n',
  Clapperboard:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-clapperboard"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m12.296 3.464 3.02 3.956" />\n  <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z" />\n  <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />\n  <path d="m6.18 5.276 3.1 3.899" />\n</svg>\n',
  ClipboardList:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-clipboard-list"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />\n  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />\n  <path d="M12 11h4" />\n  <path d="M12 16h4" />\n  <path d="M8 11h.01" />\n  <path d="M8 16h.01" />\n</svg>\n',
  Clock:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-clock"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="M12 6v6l4 2" />\n</svg>\n',
  Code: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-code"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m16 18 6-6-6-6" />\n  <path d="m8 6-6 6 6 6" />\n</svg>\n',
  Coins:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-coins"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />\n  <path d="M15 6h1v4" />\n  <path d="m6.134 14.768.866-.5 2 3.464" />\n  <circle cx="16" cy="8" r="6" />\n</svg>\n',
  Compass:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-compass"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />\n</svg>\n',
  Copy: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-copy"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />\n  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />\n</svg>\n',
  CornerDownLeft:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-corner-down-left"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 4v7a4 4 0 0 1-4 4H4" />\n  <path d="m9 10-5 5 5 5" />\n</svg>\n',
  Cpu: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-cpu"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 20v2" />\n  <path d="M12 2v2" />\n  <path d="M17 20v2" />\n  <path d="M17 2v2" />\n  <path d="M2 12h2" />\n  <path d="M2 17h2" />\n  <path d="M2 7h2" />\n  <path d="M20 12h2" />\n  <path d="M20 17h2" />\n  <path d="M20 7h2" />\n  <path d="M7 20v2" />\n  <path d="M7 2v2" />\n  <rect x="4" y="4" width="16" height="16" rx="2" />\n  <rect x="8" y="8" width="8" height="8" rx="1" />\n</svg>\n',
  CreditCard:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-credit-card"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="20" height="14" x="2" y="5" rx="2" />\n  <line x1="2" x2="22" y1="10" y2="10" />\n</svg>\n',
  Crown:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-crown"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />\n  <path d="M5 21h14" />\n</svg>\n',
  Database:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-database"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <ellipse cx="12" cy="5" rx="9" ry="3" />\n  <path d="M3 5V19A9 3 0 0 0 21 19V5" />\n  <path d="M3 12A9 3 0 0 0 21 12" />\n</svg>\n',
  Download:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-download"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 15V3" />\n  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />\n  <path d="m7 10 5 5 5-5" />\n</svg>\n',
  Earth:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-earth"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" />\n  <path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17" />\n  <path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" />\n  <circle cx="12" cy="12" r="10" />\n</svg>\n',
  Eraser:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-eraser"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />\n  <path d="m5.082 11.09 8.828 8.828" />\n</svg>\n',
  ExternalLink:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-external-link"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15 3h6v6" />\n  <path d="M10 14 21 3" />\n  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />\n</svg>\n',
  Eye: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-eye"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />\n  <circle cx="12" cy="12" r="3" />\n</svg>\n',
  EyeOff:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-eye-off"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />\n  <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />\n  <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />\n  <path d="m2 2 20 20" />\n</svg>\n',
  FileAudio:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-file-audio"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 6.835V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-.343" />\n  <path d="M14 2v5a1 1 0 0 0 1 1h5" />\n  <path d="M2 19a2 2 0 0 1 4 0v1a2 2 0 0 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 0 1-4 0v-1a2 2 0 0 1 4 0" />\n</svg>\n',
  FileCode:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-file-code"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />\n  <path d="M14 2v5a1 1 0 0 0 1 1h5" />\n  <path d="M10 12.5 8 15l2 2.5" />\n  <path d="m14 12.5 2 2.5-2 2.5" />\n</svg>\n',
  FileJson:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-file-json"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />\n  <path d="M14 2v5a1 1 0 0 0 1 1h5" />\n  <path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" />\n  <path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" />\n</svg>\n',
  FileSpreadsheet:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-file-spreadsheet"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />\n  <path d="M14 2v5a1 1 0 0 0 1 1h5" />\n  <path d="M8 13h2" />\n  <path d="M14 13h2" />\n  <path d="M8 17h2" />\n  <path d="M14 17h2" />\n</svg>\n',
  FileText:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-file-text"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />\n  <path d="M14 2v5a1 1 0 0 0 1 1h5" />\n  <path d="M10 9H8" />\n  <path d="M16 13H8" />\n  <path d="M16 17H8" />\n</svg>\n',
  FileUp:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-file-up"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />\n  <path d="M14 2v5a1 1 0 0 0 1 1h5" />\n  <path d="M12 12v6" />\n  <path d="m15 15-3-3-3 3" />\n</svg>\n',
  Files:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-files"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />\n  <path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z" />\n  <path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1" />\n</svg>\n',
  Film: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-film"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="18" height="18" x="3" y="3" rx="2" />\n  <path d="M7 3v18" />\n  <path d="M3 7.5h4" />\n  <path d="M3 12h18" />\n  <path d="M3 16.5h4" />\n  <path d="M17 3v18" />\n  <path d="M17 7.5h4" />\n  <path d="M17 16.5h4" />\n</svg>\n',
  Flame:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-flame"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />\n</svg>\n',
  FlaskConical:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-flask-conical"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />\n  <path d="M6.453 15h11.094" />\n  <path d="M8.5 2h7" />\n</svg>\n',
  Folder:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-folder"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />\n</svg>\n',
  FolderOpen:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-folder-open"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />\n</svg>\n',
  Gauge:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-gauge"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m12 14 4-4" />\n  <path d="M3.34 19a10 10 0 1 1 17.32 0" />\n</svg>\n',
  Gem: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-gem"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10.5 3 8 9l4 13 4-13-2.5-6" />\n  <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" />\n  <path d="M2 9h20" />\n</svg>\n',
  Gift: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-gift"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 7v14" />\n  <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />\n  <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" />\n  <rect x="3" y="7" width="18" height="4" rx="1" />\n</svg>\n',
  GitBranchPlus:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-git-branch-plus"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M6 3v12" />\n  <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />\n  <path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />\n  <path d="M15 6a9 9 0 0 0-9 9" />\n  <path d="M18 15v6" />\n  <path d="M21 18h-6" />\n</svg>\n',
  Globe:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-globe"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />\n  <path d="M2 12h20" />\n</svg>\n',
  Globe2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-globe-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" />\n  <path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17" />\n  <path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" />\n  <circle cx="12" cy="12" r="10" />\n</svg>\n',
  GraduationCap:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-graduation-cap"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />\n  <path d="M22 10v6" />\n  <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />\n</svg>\n',
  Handshake:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-handshake"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m11 17 2 2a1 1 0 1 0 3-3" />\n  <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />\n  <path d="m21 3 1 11h-2" />\n  <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />\n  <path d="M3 4h8" />\n</svg>\n',
  Hash: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-hash"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <line x1="4" x2="20" y1="9" y2="9" />\n  <line x1="4" x2="20" y1="15" y2="15" />\n  <line x1="10" x2="8" y1="3" y2="21" />\n  <line x1="16" x2="14" y1="3" y2="21" />\n</svg>\n',
  Heart:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-heart"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />\n</svg>\n',
  HelpCircle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-help-circle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />\n  <path d="M12 17h.01" />\n</svg>\n',
  History:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-history"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />\n  <path d="M3 3v5h5" />\n  <path d="M12 7v5l4 2" />\n</svg>\n',
  Home: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-home"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />\n  <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />\n</svg>\n',
  IdCard:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-id-card"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M16 10h2" />\n  <path d="M16 14h2" />\n  <path d="M6.17 15a3 3 0 0 1 5.66 0" />\n  <circle cx="9" cy="11" r="2" />\n  <rect x="2" y="5" width="20" height="14" rx="2" />\n</svg>\n',
  Image:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-image"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />\n  <circle cx="9" cy="9" r="2" />\n  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />\n</svg>\n',
  ImageOff:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-image-off"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <line x1="2" x2="22" y1="2" y2="22" />\n  <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />\n  <line x1="13.5" x2="6" y1="13.5" y2="21" />\n  <line x1="18" x2="21" y1="12" y2="15" />\n  <path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59" />\n  <path d="M21 15V5a2 2 0 0 0-2-2H9" />\n</svg>\n',
  Images:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-images"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16" />\n  <path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" />\n  <circle cx="13" cy="7" r="1" fill="currentColor" />\n  <rect x="8" y="2" width="14" height="14" rx="2" />\n</svg>\n',
  Inbox:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-inbox"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />\n  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />\n</svg>\n',
  Info: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-info"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="M12 16v-4" />\n  <path d="M12 8h.01" />\n</svg>\n',
  Key: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-key"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m2 21 9.6-9.6" />\n  <path d="m7.5 15.5 2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19" />\n  <circle cx="15.5" cy="7.5" r="5.5" />\n</svg>\n',
  KeyRound:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-key-round"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />\n  <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />\n</svg>\n',
  Keyboard:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-keyboard"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 8h.01" />\n  <path d="M12 12h.01" />\n  <path d="M14 8h.01" />\n  <path d="M16 12h.01" />\n  <path d="M18 8h.01" />\n  <path d="M6 8h.01" />\n  <path d="M7 16h10" />\n  <path d="M8 12h.01" />\n  <rect width="20" height="16" x="2" y="4" rx="2" />\n</svg>\n',
  Landmark:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-landmark"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 18v-7" />\n  <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" />\n  <path d="M14 18v-7" />\n  <path d="M18 18v-7" />\n  <path d="M3 22h18" />\n  <path d="M6 18v-7" />\n</svg>\n',
  Languages:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-languages"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m5 8 6 6" />\n  <path d="m4 14 6-6 2-3" />\n  <path d="M2 5h12" />\n  <path d="M7 2h1" />\n  <path d="m22 22-5-10-5 10" />\n  <path d="M14 18h6" />\n</svg>\n',
  Layers:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-layers"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />\n  <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />\n  <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />\n</svg>\n',
  LayoutGrid:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-layout-grid"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="7" height="7" x="3" y="3" rx="1" />\n  <rect width="7" height="7" x="14" y="3" rx="1" />\n  <rect width="7" height="7" x="14" y="14" rx="1" />\n  <rect width="7" height="7" x="3" y="14" rx="1" />\n</svg>\n',
  LayoutTemplate:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-layout-template"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="18" height="7" x="3" y="3" rx="1" />\n  <rect width="9" height="7" x="3" y="14" rx="1" />\n  <rect width="5" height="7" x="16" y="14" rx="1" />\n</svg>\n',
  Library:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-library"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m16 6 4 14" />\n  <path d="M12 6v14" />\n  <path d="M8 8v12" />\n  <path d="M4 4v16" />\n</svg>\n',
  Lightbulb:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-lightbulb"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />\n  <path d="M9 18h6" />\n  <path d="M10 22h4" />\n</svg>\n',
  Link: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-link"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />\n  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />\n</svg>\n',
  Link2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-link-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9 17H7A5 5 0 0 1 7 7h2" />\n  <path d="M15 7h2a5 5 0 1 1 0 10h-2" />\n  <line x1="8" x2="16" y1="12" y2="12" />\n</svg>\n',
  Link2Off:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-link-2-off"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9 17H7A5 5 0 0 1 7 7" />\n  <path d="M15 7h2a5 5 0 0 1 4 8" />\n  <line x1="8" x2="12" y1="12" y2="12" />\n  <line x1="2" x2="22" y1="2" y2="22" />\n</svg>\n',
  ListChecks:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-list-checks"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M13 5h8" />\n  <path d="M13 12h8" />\n  <path d="M13 19h8" />\n  <path d="m3 17 2 2 4-4" />\n  <path d="m3 7 2 2 4-4" />\n</svg>\n',
  Loader2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-loader-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21 12a9 9 0 1 1-6.219-8.56" />\n</svg>\n',
  Lock: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-lock"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />\n  <path d="M7 11V7a5 5 0 0 1 10 0v4" />\n</svg>\n',
  LogIn:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-log-in"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m10 17 5-5-5-5" />\n  <path d="M15 12H3" />\n  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />\n</svg>\n',
  LogOut:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-log-out"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m16 17 5-5-5-5" />\n  <path d="M21 12H9" />\n  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />\n</svg>\n',
  Mail: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-mail"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />\n  <rect x="2" y="4" width="20" height="16" rx="2" />\n</svg>\n',
  MailOpen:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-mail-open"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" />\n  <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />\n</svg>\n',
  Map: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-map"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />\n  <path d="M15 5.764v15" />\n  <path d="M9 3.236v15" />\n</svg>\n',
  MapPin:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-map-pin"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />\n  <circle cx="12" cy="10" r="3" />\n</svg>\n',
  Maximize:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-maximize"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M8 3H5a2 2 0 0 0-2 2v3" />\n  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />\n  <path d="M3 16v3a2 2 0 0 0 2 2h3" />\n  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />\n</svg>\n',
  Medal:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-medal"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />\n  <path d="M11 12 5.12 2.2" />\n  <path d="m13 12 5.88-9.8" />\n  <path d="M8 7h8" />\n  <circle cx="12" cy="17" r="5" />\n  <path d="M12 18v-2h-.5" />\n</svg>\n',
  Megaphone:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-megaphone"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />\n  <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" />\n  <path d="M8 6v8" />\n</svg>\n',
  Menu: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-menu"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 5h16" />\n  <path d="M4 12h16" />\n  <path d="M4 19h16" />\n</svg>\n',
  MessageCircle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-message-circle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />\n</svg>\n',
  MessageSquare:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-message-square"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />\n</svg>\n',
  MessageSquarePlus:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-message-square-plus"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />\n  <path d="M12 8v6" />\n  <path d="M9 11h6" />\n</svg>\n',
  MessagesSquare:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-messages-square"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />\n  <path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" />\n</svg>\n',
  Mic: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-mic"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 19v3" />\n  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />\n  <rect x="9" y="2" width="6" height="13" rx="3" />\n</svg>\n',
  Minimize:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-minimize"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M8 3v3a2 2 0 0 1-2 2H3" />\n  <path d="M21 8h-3a2 2 0 0 1-2-2V3" />\n  <path d="M3 16h3a2 2 0 0 1 2 2v3" />\n  <path d="M16 21v-3a2 2 0 0 1 2-2h3" />\n</svg>\n',
  Minimize2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-minimize-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m14 10 7-7" />\n  <path d="M20 10h-6V4" />\n  <path d="m3 21 7-7" />\n  <path d="M4 14h6v6" />\n</svg>\n',
  Minus:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-minus"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M5 12h14" />\n</svg>\n',
  Monitor:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-monitor"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="20" height="14" x="2" y="3" rx="2" />\n  <line x1="8" x2="16" y1="21" y2="21" />\n  <line x1="12" x2="12" y1="17" y2="21" />\n</svg>\n',
  Moon: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-moon"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />\n</svg>\n',
  MoreHorizontal:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-more-horizontal"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="1" />\n  <circle cx="19" cy="12" r="1" />\n  <circle cx="5" cy="12" r="1" />\n</svg>\n',
  MousePointerClick:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-mouse-pointer-click"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M14 4.1 12 6" />\n  <path d="m5.1 8-2.9-.8" />\n  <path d="m6 12-1.9 2" />\n  <path d="M7.2 2.2 8 5.1" />\n  <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />\n</svg>\n',
  Music:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-music"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9 18V5l12-2v13" />\n  <circle cx="6" cy="18" r="3" />\n  <circle cx="18" cy="16" r="3" />\n</svg>\n',
  Network:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-network"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect x="16" y="16" width="6" height="6" rx="1" />\n  <rect x="2" y="16" width="6" height="6" rx="1" />\n  <rect x="9" y="2" width="6" height="6" rx="1" />\n  <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />\n  <path d="M12 12V8" />\n</svg>\n',
  Newspaper:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-newspaper"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15 18h-5" />\n  <path d="M18 14h-8" />\n  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" />\n  <rect width="8" height="4" x="10" y="6" rx="1" />\n</svg>\n',
  NotebookPen:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-notebook-pen"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4" />\n  <path d="M2 6h4" />\n  <path d="M2 10h4" />\n  <path d="M2 14h4" />\n  <path d="M2 18h4" />\n  <path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />\n</svg>\n',
  Orbit:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-orbit"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20.341 6.484A10 10 0 0 1 10.266 21.85" />\n  <path d="M3.659 17.516A10 10 0 0 1 13.74 2.152" />\n  <circle cx="12" cy="12" r="3" />\n  <circle cx="19" cy="5" r="2" />\n  <circle cx="5" cy="19" r="2" />\n</svg>\n',
  Package:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-package"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />\n  <path d="M12 22V12" />\n  <polyline points="3.29 7 12 12 20.71 7" />\n  <path d="m7.5 4.27 9 5.15" />\n</svg>\n',
  PackageOpen:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-package-open"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 22v-9" />\n  <path d="M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z" />\n  <path d="M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13" />\n  <path d="M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z" />\n</svg>\n',
  Palette:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-palette"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />\n  <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />\n  <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />\n  <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />\n  <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />\n</svg>\n',
  Paperclip:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-paperclip"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />\n</svg>\n',
  PartyPopper:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-party-popper"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M5.8 11.3 2 22l10.7-3.79" />\n  <path d="M4 3h.01" />\n  <path d="M22 8h.01" />\n  <path d="M15 2h.01" />\n  <path d="M22 20h.01" />\n  <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />\n  <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17" />\n  <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" />\n  <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" />\n</svg>\n',
  Pause:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-pause"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect x="14" y="3" width="5" height="18" rx="1" />\n  <rect x="5" y="3" width="5" height="18" rx="1" />\n</svg>\n',
  PauseCircle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-pause-circle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <line x1="10" x2="10" y1="15" y2="9" />\n  <line x1="14" x2="14" y1="15" y2="9" />\n</svg>\n',
  PenLine:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-pen-line"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M13 21h8" />\n  <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />\n</svg>\n',
  Pencil:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-pencil"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />\n  <path d="m15 5 4 4" />\n</svg>\n',
  Phone:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-phone"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />\n</svg>\n',
  Pin: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-pin"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 17v5" />\n  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />\n</svg>\n',
  PinOff:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-pin-off"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 17v5" />\n  <path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89" />\n  <path d="m2 2 20 20" />\n  <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11" />\n</svg>\n',
  Play: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-play"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />\n</svg>\n',
  PlayCircle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-play-circle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z" />\n  <circle cx="12" cy="12" r="10" />\n</svg>\n',
  Plug: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-plug"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 22v-5" />\n  <path d="M15 8V2" />\n  <path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z" />\n  <path d="M9 8V2" />\n</svg>\n',
  Plus: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-plus"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M5 12h14" />\n  <path d="M12 5v14" />\n</svg>\n',
  Presentation:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-presentation"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M2 3h20" />\n  <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />\n  <path d="m7 21 5-5 5 5" />\n</svg>\n',
  Puzzle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-puzzle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" />\n</svg>\n',
  QrCode:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-qr-code"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="5" height="5" x="3" y="3" rx="1" />\n  <rect width="5" height="5" x="16" y="3" rx="1" />\n  <rect width="5" height="5" x="3" y="16" rx="1" />\n  <path d="M21 16h-3a2 2 0 0 0-2 2v3" />\n  <path d="M21 21v.01" />\n  <path d="M12 7v3a2 2 0 0 1-2 2H7" />\n  <path d="M3 12h.01" />\n  <path d="M12 3h.01" />\n  <path d="M12 16v.01" />\n  <path d="M16 12h1" />\n  <path d="M21 12v.01" />\n  <path d="M12 21v-1" />\n</svg>\n',
  Radio:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-radio"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M16.247 7.761a6 6 0 0 1 0 8.478" />\n  <path d="M19.075 4.933a10 10 0 0 1 0 14.134" />\n  <path d="M4.925 19.067a10 10 0 0 1 0-14.134" />\n  <path d="M7.753 16.239a6 6 0 0 1 0-8.478" />\n  <circle cx="12" cy="12" r="2" />\n</svg>\n',
  Receipt:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-receipt"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 17V7" />\n  <path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" />\n  <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />\n</svg>\n',
  RefreshCcw:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-refresh-ccw"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />\n  <path d="M3 3v5h5" />\n  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />\n  <path d="M16 16h5v5" />\n</svg>\n',
  RefreshCw:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-refresh-cw"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />\n  <path d="M21 3v5h-5" />\n  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />\n  <path d="M8 16H3v5" />\n</svg>\n',
  Repeat:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-repeat"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m17 2 4 4-4 4" />\n  <path d="M3 11v-1a4 4 0 0 1 4-4h14" />\n  <path d="m7 22-4-4 4-4" />\n  <path d="M21 13v1a4 4 0 0 1-4 4H3" />\n</svg>\n',
  Rocket:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-rocket"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />\n  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" />\n  <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" />\n  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" />\n</svg>\n',
  RotateCcw:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-rotate-ccw"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />\n  <path d="M3 3v5h5" />\n</svg>\n',
  Save: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-save"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />\n  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />\n  <path d="M7 3v4a1 1 0 0 0 1 1h7" />\n</svg>\n',
  Scale:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-scale"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 3v18" />\n  <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />\n  <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />\n  <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />\n  <path d="M7 21h10" />\n</svg>\n',
  ScanLine:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-scan-line"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M3 7V5a2 2 0 0 1 2-2h2" />\n  <path d="M17 3h2a2 2 0 0 1 2 2v2" />\n  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />\n  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />\n  <path d="M7 12h10" />\n</svg>\n',
  Scissors:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-scissors"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="6" cy="6" r="3" />\n  <path d="M8.12 8.12 12 12" />\n  <path d="M20 4 8.12 15.88" />\n  <circle cx="6" cy="18" r="3" />\n  <path d="M14.8 14.8 20 20" />\n</svg>\n',
  ScrollText:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-scroll-text"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15 12h-5" />\n  <path d="M15 8h-5" />\n  <path d="M19 17V5a2 2 0 0 0-2-2H4" />\n  <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />\n</svg>\n',
  Search:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-search"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m21 21-4.34-4.34" />\n  <circle cx="11" cy="11" r="8" />\n</svg>\n',
  Send: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-send"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />\n  <path d="m21.854 2.147-10.94 10.939" />\n</svg>\n',
  Server:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-server"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />\n  <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />\n  <line x1="6" x2="6.01" y1="6" y2="6" />\n  <line x1="6" x2="6.01" y1="18" y2="18" />\n</svg>\n',
  Settings:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-settings"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />\n  <circle cx="12" cy="12" r="3" />\n</svg>\n',
  Share2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-share-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="18" cy="5" r="3" />\n  <circle cx="6" cy="12" r="3" />\n  <circle cx="18" cy="19" r="3" />\n  <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />\n  <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />\n</svg>\n',
  Shield:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-shield"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />\n</svg>\n',
  ShieldAlert:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-shield-alert"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />\n  <path d="M12 8v4" />\n  <path d="M12 16h.01" />\n</svg>\n',
  ShieldCheck:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-shield-check"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />\n  <path d="m9 12 2 2 4-4" />\n</svg>\n',
  ShieldOff:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-shield-off"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m2 2 20 20" />\n  <path d="M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71" />\n  <path d="M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264" />\n</svg>\n',
  ShoppingBag:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-shopping-bag"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M16 10a4 4 0 0 1-8 0" />\n  <path d="M3.103 6.034h17.794" />\n  <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />\n</svg>\n',
  ShoppingCart:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-shopping-cart"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18" />\n  <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25" />\n  <circle cx="18" cy="20" r="2" />\n  <circle cx="8" cy="20" r="2" />\n</svg>\n',
  Slash:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-slash"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M22 2 2 22" />\n</svg>\n',
  SlidersHorizontal:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-sliders-horizontal"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 5H3" />\n  <path d="M12 19H3" />\n  <path d="M14 3v4" />\n  <path d="M16 17v4" />\n  <path d="M21 12h-9" />\n  <path d="M21 19h-5" />\n  <path d="M21 5h-7" />\n  <path d="M8 10v4" />\n  <path d="M8 12H3" />\n</svg>\n',
  Smartphone:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-smartphone"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />\n  <path d="M12 18h.01" />\n</svg>\n',
  Sparkles:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-sparkles"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />\n  <path d="M20 2v4" />\n  <path d="M22 4h-4" />\n  <circle cx="4" cy="20" r="2" />\n</svg>\n',
  Speaker:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-speaker"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="16" height="20" x="4" y="2" rx="2" />\n  <path d="M12 6h.01" />\n  <circle cx="12" cy="14" r="4" />\n  <path d="M12 14h.01" />\n</svg>\n',
  Square:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-square"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="18" height="18" x="3" y="3" rx="2" />\n</svg>\n',
  SquareFunction:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-square-function"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />\n  <path d="M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3" />\n  <path d="M9 11.2h5.7" />\n</svg>\n',
  SquarePen:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-square-pen"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />\n  <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />\n</svg>\n',
  Stamp:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-stamp"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" />\n  <path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" />\n  <path d="M5 22h14" />\n</svg>\n',
  Star: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-star"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />\n</svg>\n',
  StickyNote:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-sticky-note"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />\n  <path d="M15 3v5a1 1 0 0 0 1 1h5" />\n</svg>\n',
  Store:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-store"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />\n  <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />\n  <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />\n</svg>\n',
  Subtitles:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-subtitles"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="18" height="14" x="3" y="5" rx="2" ry="2" />\n  <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />\n</svg>\n',
  Sun: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-sun"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="4" />\n  <path d="M12 2v2" />\n  <path d="M12 20v2" />\n  <path d="m4.93 4.93 1.41 1.41" />\n  <path d="m17.66 17.66 1.41 1.41" />\n  <path d="M2 12h2" />\n  <path d="M20 12h2" />\n  <path d="m6.34 17.66-1.41 1.41" />\n  <path d="m19.07 4.93-1.41 1.41" />\n</svg>\n',
  Tag: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-tag"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />\n  <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />\n</svg>\n',
  Target:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-target"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <circle cx="12" cy="12" r="6" />\n  <circle cx="12" cy="12" r="2" />\n</svg>\n',
  ThumbsDown:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-thumbs-down"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />\n  <path d="M17 14V2" />\n</svg>\n',
  ThumbsUp:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-thumbs-up"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />\n  <path d="M7 10v12" />\n</svg>\n',
  Ticket:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-ticket"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />\n  <path d="M13 5v2" />\n  <path d="M13 17v2" />\n  <path d="M13 11v2" />\n</svg>\n',
  Trash2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-trash-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 11v6" />\n  <path d="M14 11v6" />\n  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />\n  <path d="M3 6h18" />\n  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />\n</svg>\n',
  TrendingUp:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-trending-up"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M16 7h6v6" />\n  <path d="m22 7-8.5 8.5-5-5L2 17" />\n</svg>\n',
  TriangleAlert:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-triangle-alert"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />\n  <path d="M12 9v4" />\n  <path d="M12 17h.01" />\n</svg>\n',
  Trophy:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-trophy"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" />\n  <path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" />\n  <path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" />\n  <path d="M4 22h16" />\n  <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" />\n  <path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" />\n</svg>\n',
  Type: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-type"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 4v16" />\n  <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />\n  <path d="M9 20h6" />\n</svg>\n',
  Undo2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-undo-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M9 14 4 9l5-5" />\n  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />\n</svg>\n',
  Upload:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-upload"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 3v12" />\n  <path d="m17 8-5-5-5 5" />\n  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />\n</svg>\n',
  User: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-user"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />\n  <circle cx="12" cy="7" r="4" />\n</svg>\n',
  UserCheck:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-user-check"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m16 11 2 2 4-4" />\n  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />\n  <circle cx="9" cy="7" r="4" />\n</svg>\n',
  UserCog:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-user-cog"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M10 15H6a4 4 0 0 0-4 4v2" />\n  <path d="m14.305 16.53.923-.382" />\n  <path d="m15.228 13.852-.923-.383" />\n  <path d="m16.852 12.228-.383-.923" />\n  <path d="m16.852 17.772-.383.924" />\n  <path d="m19.148 12.228.383-.923" />\n  <path d="m19.53 18.696-.382-.924" />\n  <path d="m20.772 13.852.924-.383" />\n  <path d="m20.772 16.148.924.383" />\n  <circle cx="18" cy="15" r="3" />\n  <circle cx="9" cy="7" r="4" />\n</svg>\n',
  UserPlus:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-user-plus"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />\n  <circle cx="9" cy="7" r="4" />\n  <line x1="19" x2="19" y1="8" y2="14" />\n  <line x1="22" x2="16" y1="11" y2="11" />\n</svg>\n',
  UserRoundX:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-user-round-x"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m16.5 16.5 5 5" />\n  <path d="M2 21a8 8 0 0 1 11.531-7.18" />\n  <path d="m21.5 16.5-5 5" />\n  <circle cx="10" cy="8" r="5" />\n</svg>\n',
  Users:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-users"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />\n  <path d="M16 3.128a4 4 0 0 1 0 7.744" />\n  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />\n  <circle cx="9" cy="7" r="4" />\n</svg>\n',
  UsersRound:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-users-round"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M18 21a8 8 0 0 0-16 0" />\n  <circle cx="10" cy="8" r="5" />\n  <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />\n</svg>\n',
  Video:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-video"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />\n  <rect x="2" y="6" width="14" height="12" rx="2" />\n</svg>\n',
  Volume2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-volume-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />\n  <path d="M16 9a5 5 0 0 1 0 6" />\n  <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />\n</svg>\n',
  Wallet:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-wallet"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />\n  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />\n</svg>\n',
  Wand2:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-wand-2"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />\n  <path d="m14 7 3 3" />\n  <path d="M5 6v4" />\n  <path d="M19 14v4" />\n  <path d="M10 2v2" />\n  <path d="M7 8H3" />\n  <path d="M21 16h-4" />\n  <path d="M11 3H9" />\n</svg>\n',
  Wifi: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-wifi"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 20h.01" />\n  <path d="M2 8.82a15 15 0 0 1 20 0" />\n  <path d="M5 12.859a10 10 0 0 1 14 0" />\n  <path d="M8.5 16.429a5 5 0 0 1 7 0" />\n</svg>\n',
  WifiOff:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-wifi-off"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 20h.01" />\n  <path d="M8.5 16.429a5 5 0 0 1 7 0" />\n  <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />\n  <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />\n  <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />\n  <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />\n  <path d="m2 2 20 20" />\n</svg>\n',
  Workflow:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-workflow"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <rect width="8" height="8" x="3" y="3" rx="2" />\n  <path d="M7 11v4a2 2 0 0 0 2 2h4" />\n  <rect width="8" height="8" x="13" y="13" rx="2" />\n</svg>\n',
  Wrench:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-wrench"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />\n</svg>\n',
  X: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-x"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M18 6 6 18" />\n  <path d="m6 6 12 12" />\n</svg>\n',
  XCircle:
    '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-x-circle"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <circle cx="12" cy="12" r="10" />\n  <path d="m15 9-6 6" />\n  <path d="m9 9 6 6" />\n</svg>\n',
  Zap: '<!-- @license lucide-static v1.31.0 - ISC -->\n<svg\n  class="lucide lucide-zap"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="#000000"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />\n</svg>\n',
} as const

/**
 * 按图标名取 SVG。名字与表同批生成 ⇒ 正常跑不会缺;真缺了(手动改过本文件/生成器漏名)
 * **大声告警并画占位**,而不是把 undefined 交给 makeIcon —— 那既过不了类型,也会在运行期静默少一枚图标。
 */
function src(name: string): string {
  const hit: string | undefined = S[name as keyof typeof S]
  if (hit === undefined)
    console.warn(
      `[rn-compat] 图标表里没有 '${name}' ⇒ 渲染为占位,请重跑 node scripts/gen-rn-compat.mjs --write`,
    )
  return hit ?? ''
}

export const Activity = makeIcon('Activity', src('Activity'))
export const AlertCircle = makeIcon('AlertCircle', src('AlertCircle'))
export const AlertTriangle = makeIcon('AlertTriangle', src('AlertTriangle'))
export const AppWindow = makeIcon('AppWindow', src('AppWindow'))
export const ArrowDown = makeIcon('ArrowDown', src('ArrowDown'))
export const ArrowRight = makeIcon('ArrowRight', src('ArrowRight'))
export const ArrowUp = makeIcon('ArrowUp', src('ArrowUp'))
export const Award = makeIcon('Award', src('Award'))
export const BadgeCheck = makeIcon('BadgeCheck', src('BadgeCheck'))
export const Banknote = makeIcon('Banknote', src('Banknote'))
export const BarChart3 = makeIcon('BarChart3', src('BarChart3'))
export const Bell = makeIcon('Bell', src('Bell'))
export const BellRing = makeIcon('BellRing', src('BellRing'))
export const Blocks = makeIcon('Blocks', src('Blocks'))
export const BookMarked = makeIcon('BookMarked', src('BookMarked'))
export const BookOpen = makeIcon('BookOpen', src('BookOpen'))
export const Bookmark = makeIcon('Bookmark', src('Bookmark'))
export const BookmarkCheck = makeIcon('BookmarkCheck', src('BookmarkCheck'))
export const Bot = makeIcon('Bot', src('Bot'))
export const Boxes = makeIcon('Boxes', src('Boxes'))
export const Brain = makeIcon('Brain', src('Brain'))
export const BriefcaseBusiness = makeIcon('BriefcaseBusiness', src('BriefcaseBusiness'))
export const Building2 = makeIcon('Building2', src('Building2'))
export const Calendar = makeIcon('Calendar', src('Calendar'))
export const CalendarCheck = makeIcon('CalendarCheck', src('CalendarCheck'))
export const CalendarClock = makeIcon('CalendarClock', src('CalendarClock'))
export const CalendarDays = makeIcon('CalendarDays', src('CalendarDays'))
export const Camera = makeIcon('Camera', src('Camera'))
export const ChartLine = makeIcon('ChartLine', src('ChartLine'))
export const Check = makeIcon('Check', src('Check'))
export const CheckCircle2 = makeIcon('CheckCircle2', src('CheckCircle2'))
export const ChevronDown = makeIcon('ChevronDown', src('ChevronDown'))
export const ChevronLeft = makeIcon('ChevronLeft', src('ChevronLeft'))
export const ChevronRight = makeIcon('ChevronRight', src('ChevronRight'))
export const ChevronUp = makeIcon('ChevronUp', src('ChevronUp'))
export const ChevronsLeft = makeIcon('ChevronsLeft', src('ChevronsLeft'))
export const ChevronsRight = makeIcon('ChevronsRight', src('ChevronsRight'))
export const Circle = makeIcon('Circle', src('Circle'))
export const CircleAlert = makeIcon('CircleAlert', src('CircleAlert'))
export const CircleCheck = makeIcon('CircleCheck', src('CircleCheck'))
export const CircleDashed = makeIcon('CircleDashed', src('CircleDashed'))
export const CircleDollarSign = makeIcon('CircleDollarSign', src('CircleDollarSign'))
export const CircleHelp = makeIcon('CircleHelp', src('CircleHelp'))
export const CircleQuestionMark = makeIcon('CircleQuestionMark', src('CircleQuestionMark'))
export const Clapperboard = makeIcon('Clapperboard', src('Clapperboard'))
export const ClipboardList = makeIcon('ClipboardList', src('ClipboardList'))
export const Clock = makeIcon('Clock', src('Clock'))
export const Code = makeIcon('Code', src('Code'))
export const Coins = makeIcon('Coins', src('Coins'))
export const Compass = makeIcon('Compass', src('Compass'))
export const Copy = makeIcon('Copy', src('Copy'))
export const CornerDownLeft = makeIcon('CornerDownLeft', src('CornerDownLeft'))
export const Cpu = makeIcon('Cpu', src('Cpu'))
export const CreditCard = makeIcon('CreditCard', src('CreditCard'))
export const Crown = makeIcon('Crown', src('Crown'))
export const Database = makeIcon('Database', src('Database'))
export const Download = makeIcon('Download', src('Download'))
export const Earth = makeIcon('Earth', src('Earth'))
export const Eraser = makeIcon('Eraser', src('Eraser'))
export const ExternalLink = makeIcon('ExternalLink', src('ExternalLink'))
export const Eye = makeIcon('Eye', src('Eye'))
export const EyeOff = makeIcon('EyeOff', src('EyeOff'))
export const FileAudio = makeIcon('FileAudio', src('FileAudio'))
export const FileCode = makeIcon('FileCode', src('FileCode'))
export const FileJson = makeIcon('FileJson', src('FileJson'))
export const FileSpreadsheet = makeIcon('FileSpreadsheet', src('FileSpreadsheet'))
export const FileText = makeIcon('FileText', src('FileText'))
export const FileUp = makeIcon('FileUp', src('FileUp'))
export const Files = makeIcon('Files', src('Files'))
export const Film = makeIcon('Film', src('Film'))
export const Flame = makeIcon('Flame', src('Flame'))
export const FlaskConical = makeIcon('FlaskConical', src('FlaskConical'))
export const Folder = makeIcon('Folder', src('Folder'))
export const FolderOpen = makeIcon('FolderOpen', src('FolderOpen'))
export const Gauge = makeIcon('Gauge', src('Gauge'))
export const Gem = makeIcon('Gem', src('Gem'))
export const Gift = makeIcon('Gift', src('Gift'))
export const GitBranchPlus = makeIcon('GitBranchPlus', src('GitBranchPlus'))
export const Globe = makeIcon('Globe', src('Globe'))
export const Globe2 = makeIcon('Globe2', src('Globe2'))
export const GraduationCap = makeIcon('GraduationCap', src('GraduationCap'))
export const Handshake = makeIcon('Handshake', src('Handshake'))
export const Hash = makeIcon('Hash', src('Hash'))
export const Heart = makeIcon('Heart', src('Heart'))
export const HelpCircle = makeIcon('HelpCircle', src('HelpCircle'))
export const History = makeIcon('History', src('History'))
export const Home = makeIcon('Home', src('Home'))
export const IdCard = makeIcon('IdCard', src('IdCard'))
export const Image = makeIcon('Image', src('Image'))
export const ImageOff = makeIcon('ImageOff', src('ImageOff'))
export const Images = makeIcon('Images', src('Images'))
export const Inbox = makeIcon('Inbox', src('Inbox'))
export const Info = makeIcon('Info', src('Info'))
export const Key = makeIcon('Key', src('Key'))
export const KeyRound = makeIcon('KeyRound', src('KeyRound'))
export const Keyboard = makeIcon('Keyboard', src('Keyboard'))
export const Landmark = makeIcon('Landmark', src('Landmark'))
export const Languages = makeIcon('Languages', src('Languages'))
export const Layers = makeIcon('Layers', src('Layers'))
export const LayoutGrid = makeIcon('LayoutGrid', src('LayoutGrid'))
export const LayoutTemplate = makeIcon('LayoutTemplate', src('LayoutTemplate'))
export const Library = makeIcon('Library', src('Library'))
export const Lightbulb = makeIcon('Lightbulb', src('Lightbulb'))
export const Link = makeIcon('Link', src('Link'))
export const Link2 = makeIcon('Link2', src('Link2'))
export const Link2Off = makeIcon('Link2Off', src('Link2Off'))
export const ListChecks = makeIcon('ListChecks', src('ListChecks'))
export const Loader2 = makeIcon('Loader2', src('Loader2'))
export const Lock = makeIcon('Lock', src('Lock'))
export const LogIn = makeIcon('LogIn', src('LogIn'))
export const LogOut = makeIcon('LogOut', src('LogOut'))
export const Mail = makeIcon('Mail', src('Mail'))
export const MailOpen = makeIcon('MailOpen', src('MailOpen'))
export const Map = makeIcon('Map', src('Map'))
export const MapPin = makeIcon('MapPin', src('MapPin'))
export const Maximize = makeIcon('Maximize', src('Maximize'))
export const Medal = makeIcon('Medal', src('Medal'))
export const Megaphone = makeIcon('Megaphone', src('Megaphone'))
export const Menu = makeIcon('Menu', src('Menu'))
export const MessageCircle = makeIcon('MessageCircle', src('MessageCircle'))
export const MessageSquare = makeIcon('MessageSquare', src('MessageSquare'))
export const MessageSquarePlus = makeIcon('MessageSquarePlus', src('MessageSquarePlus'))
export const MessagesSquare = makeIcon('MessagesSquare', src('MessagesSquare'))
export const Mic = makeIcon('Mic', src('Mic'))
export const Minimize = makeIcon('Minimize', src('Minimize'))
export const Minimize2 = makeIcon('Minimize2', src('Minimize2'))
export const Minus = makeIcon('Minus', src('Minus'))
export const Monitor = makeIcon('Monitor', src('Monitor'))
export const Moon = makeIcon('Moon', src('Moon'))
export const MoreHorizontal = makeIcon('MoreHorizontal', src('MoreHorizontal'))
export const MousePointerClick = makeIcon('MousePointerClick', src('MousePointerClick'))
export const Music = makeIcon('Music', src('Music'))
export const Network = makeIcon('Network', src('Network'))
export const Newspaper = makeIcon('Newspaper', src('Newspaper'))
export const NotebookPen = makeIcon('NotebookPen', src('NotebookPen'))
export const Orbit = makeIcon('Orbit', src('Orbit'))
export const Package = makeIcon('Package', src('Package'))
export const PackageOpen = makeIcon('PackageOpen', src('PackageOpen'))
export const Palette = makeIcon('Palette', src('Palette'))
export const Paperclip = makeIcon('Paperclip', src('Paperclip'))
export const PartyPopper = makeIcon('PartyPopper', src('PartyPopper'))
export const Pause = makeIcon('Pause', src('Pause'))
export const PauseCircle = makeIcon('PauseCircle', src('PauseCircle'))
export const PenLine = makeIcon('PenLine', src('PenLine'))
export const Pencil = makeIcon('Pencil', src('Pencil'))
export const Phone = makeIcon('Phone', src('Phone'))
export const Pin = makeIcon('Pin', src('Pin'))
export const PinOff = makeIcon('PinOff', src('PinOff'))
export const Play = makeIcon('Play', src('Play'))
export const PlayCircle = makeIcon('PlayCircle', src('PlayCircle'))
export const Plug = makeIcon('Plug', src('Plug'))
export const Plus = makeIcon('Plus', src('Plus'))
export const Presentation = makeIcon('Presentation', src('Presentation'))
export const Puzzle = makeIcon('Puzzle', src('Puzzle'))
export const QrCode = makeIcon('QrCode', src('QrCode'))
export const Radio = makeIcon('Radio', src('Radio'))
export const Receipt = makeIcon('Receipt', src('Receipt'))
export const RefreshCcw = makeIcon('RefreshCcw', src('RefreshCcw'))
export const RefreshCw = makeIcon('RefreshCw', src('RefreshCw'))
export const Repeat = makeIcon('Repeat', src('Repeat'))
export const Rocket = makeIcon('Rocket', src('Rocket'))
export const RotateCcw = makeIcon('RotateCcw', src('RotateCcw'))
export const Save = makeIcon('Save', src('Save'))
export const Scale = makeIcon('Scale', src('Scale'))
export const ScanLine = makeIcon('ScanLine', src('ScanLine'))
export const Scissors = makeIcon('Scissors', src('Scissors'))
export const ScrollText = makeIcon('ScrollText', src('ScrollText'))
export const Search = makeIcon('Search', src('Search'))
export const Send = makeIcon('Send', src('Send'))
export const Server = makeIcon('Server', src('Server'))
export const Settings = makeIcon('Settings', src('Settings'))
export const Share2 = makeIcon('Share2', src('Share2'))
export const Shield = makeIcon('Shield', src('Shield'))
export const ShieldAlert = makeIcon('ShieldAlert', src('ShieldAlert'))
export const ShieldCheck = makeIcon('ShieldCheck', src('ShieldCheck'))
export const ShieldOff = makeIcon('ShieldOff', src('ShieldOff'))
export const ShoppingBag = makeIcon('ShoppingBag', src('ShoppingBag'))
export const ShoppingCart = makeIcon('ShoppingCart', src('ShoppingCart'))
export const Slash = makeIcon('Slash', src('Slash'))
export const SlidersHorizontal = makeIcon('SlidersHorizontal', src('SlidersHorizontal'))
export const Smartphone = makeIcon('Smartphone', src('Smartphone'))
export const Sparkles = makeIcon('Sparkles', src('Sparkles'))
export const Speaker = makeIcon('Speaker', src('Speaker'))
export const Square = makeIcon('Square', src('Square'))
export const SquareFunction = makeIcon('SquareFunction', src('SquareFunction'))
export const SquarePen = makeIcon('SquarePen', src('SquarePen'))
export const Stamp = makeIcon('Stamp', src('Stamp'))
export const Star = makeIcon('Star', src('Star'))
export const StickyNote = makeIcon('StickyNote', src('StickyNote'))
export const Store = makeIcon('Store', src('Store'))
export const Subtitles = makeIcon('Subtitles', src('Subtitles'))
export const Sun = makeIcon('Sun', src('Sun'))
export const Tag = makeIcon('Tag', src('Tag'))
export const Target = makeIcon('Target', src('Target'))
export const ThumbsDown = makeIcon('ThumbsDown', src('ThumbsDown'))
export const ThumbsUp = makeIcon('ThumbsUp', src('ThumbsUp'))
export const Ticket = makeIcon('Ticket', src('Ticket'))
export const Trash2 = makeIcon('Trash2', src('Trash2'))
export const TrendingUp = makeIcon('TrendingUp', src('TrendingUp'))
export const TriangleAlert = makeIcon('TriangleAlert', src('TriangleAlert'))
export const Trophy = makeIcon('Trophy', src('Trophy'))
export const Type = makeIcon('Type', src('Type'))
export const Undo2 = makeIcon('Undo2', src('Undo2'))
export const Upload = makeIcon('Upload', src('Upload'))
export const User = makeIcon('User', src('User'))
export const UserCheck = makeIcon('UserCheck', src('UserCheck'))
export const UserCog = makeIcon('UserCog', src('UserCog'))
export const UserPlus = makeIcon('UserPlus', src('UserPlus'))
export const UserRoundX = makeIcon('UserRoundX', src('UserRoundX'))
export const Users = makeIcon('Users', src('Users'))
export const UsersRound = makeIcon('UsersRound', src('UsersRound'))
export const Video = makeIcon('Video', src('Video'))
export const Volume2 = makeIcon('Volume2', src('Volume2'))
export const Wallet = makeIcon('Wallet', src('Wallet'))
export const Wand2 = makeIcon('Wand2', src('Wand2'))
export const Wifi = makeIcon('Wifi', src('Wifi'))
export const WifiOff = makeIcon('WifiOff', src('WifiOff'))
export const Workflow = makeIcon('Workflow', src('Workflow'))
export const Wrench = makeIcon('Wrench', src('Wrench'))
export const X = makeIcon('X', src('X'))
export const XCircle = makeIcon('XCircle', src('XCircle'))
export const Zap = makeIcon('Zap', src('Zap'))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
