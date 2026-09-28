// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * @react-native-clipboard/clipboard mock for vitest/jsdom environment
 */

export default {
  getString: () => Promise.resolve(''),
  setString: () => {},
  hasString: () => Promise.resolve(false),
}
