/**
 * Tailwind CSS 配置
 *
 * 注意：本项目使用 Tailwind v3（而非 v4），原因：
 * Taro 4.0.9 官方文档支持 Tailwind v3 的 postcss 插件格式（tailwindcss: {}）。
 * Tailwind v4 使用 @tailwindcss/postcss 替代，配置方式改为 CSS-based，
 * 与 Taro 的 postcss 配置体系不兼容，升级风险高。
 * web 端使用 Next.js + Turbopack，原生支持 v4。
 */
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
} satisfies Config
