/**
 * Tailwind CSS 配置 — 与 web 端共享语义命名 (2026-07-27 重构)
 *
 * 注意:本项目使用 Tailwind v3(而非 v4),原因:
 * Taro 4.0.9 官方文档支持 Tailwind v3 的 postcss 插件格式(tailwindcss: {})。
 * Tailwind v4 使用 @tailwindcss/postcss 替代,配置方式改为 CSS-based,
 * 与 Taro 的 postcss 配置体系不兼容,升级风险高。
 * web 端使用 Next.js + Turbopack,原生支持 v4。
 *
 * 语义色 + 圆角映射已抽取到 @ihui/design-tokens/tailwind-preset 共享 preset,
 * 与 mobile-rn 端共用,消除重复定义 + 统一 borderRadius.sm = 0.25rem。
 * CSS 变量值通过 `node scripts/sync-design-tokens.mjs` 自动同步到 src/app.css。
 */
import type { Config } from 'tailwindcss'
import sharedPreset from '@ihui/design-tokens/tailwind-preset'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [sharedPreset],
  plugins: [],
  corePlugins: {
    preflight: false,
  },
} satisfies Config
