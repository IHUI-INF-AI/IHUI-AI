/** @type {import('tailwindcss').Config} */
// 共享 preset(darkMode + 语义色 + borderRadius)抽取自原配置,消除与 miniapp-taro 重复。
// design-tokens 包 type:module → require(esm) 返回 { default: <value> },需取 .default。
const _sharedPreset = require('@ihui/design-tokens/tailwind-preset')
const sharedPreset = _sharedPreset.default || _sharedPreset

module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}', '../../packages/ui-native/src/**/*.{ts,tsx}'],
  presets: [
    require('nativewind/preset'),
    sharedPreset,
  ],
  theme: {
    extend: {
      colors: {
        // RN 扩展语义色(2026-07-28 立,消除 screen 文件 hex 硬编码)
        // 值源自 global.css --rn-* 变量,暗色模式自动切换
        purple: {
          DEFAULT: 'var(--rn-purple)',
          light: 'var(--rn-purple-light)',
          soft: 'var(--rn-purple-soft)',
        },
        tertiary: 'var(--rn-tertiary)',
        body: 'var(--rn-body)',
        danger: {
          DEFAULT: 'var(--rn-danger)',
          light: 'var(--rn-danger-light)',
        },
        success: {
          light: 'var(--rn-success-light)',
          lighter: 'var(--rn-success-lighter)',
        },
        line: 'var(--rn-line)',
      },
    },
  },
  plugins: [],
}