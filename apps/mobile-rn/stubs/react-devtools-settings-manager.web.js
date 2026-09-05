// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

// 平台特有:web stub,由 metro.config.cjs 在 platform=web 时 alias 到此文件。
// react-native@0.86 dev 构建中 setUpReactDevTools.js require 的
// src/private/devsupport/rndevtools/ReactDevToolsSettingsManager 在 pnpm 提升布局下缺失,
// 导致 web dev bundle 500 → 灰屏。此模块仅用于把 RN DevTools hook 设置透传给
// react-devtools-core,浏览器场景无该能力,no-op 降级即可。

/** web 端无全局 React DevTools hook,恒返回 null 让调用方跳过设置 */
export function getGlobalHookSettings() {
  return null
}

/** no-op:web 端不存在需要持久化的 DevTools 设置 */
export function setGlobalHookSettings(_settings) {}

export default { getGlobalHookSettings, setGlobalHookSettings }
