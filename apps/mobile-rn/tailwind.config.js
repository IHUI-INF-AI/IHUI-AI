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
  plugins: [],
}