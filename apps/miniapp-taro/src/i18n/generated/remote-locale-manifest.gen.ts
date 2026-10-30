// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)
// 按需拉取语言包的运行时清单:version = 载荷 gzip+b64 的 sha256(storage 缓存 key 与失效判据),
// bytes = 载荷字节数(下载完整性粗校验)。载荷真相在 generated/remote-locales.gen.ts(离线对账)
// 与 src/assets/remote-locales/<locale>.b64.txt(CDN 部署),三者同批派生、同钉对账。
// IHUI-GEN-PIN-BEGIN
// generator: apps/miniapp-taro/scripts/gen-i18n-compressed.mjs
// sourceCommit: 182440479b516d06ec309b3029783fb63cb8ff79
// inputsSha256: 9d01f2c51368125f7232a53fb887aede8c5088fdfa3a7cb2c64dac18461744cc
// input: packages/i18n/messages/miniapp-taro/en.json 67450c64e4ed1ba00da2fca9017faca2eb820f0f1ab71a5c9dfd9e606f915928
// input: packages/i18n/messages/miniapp-taro/ja.json 40a87fa4985cc81e0e3d0a82a30d76d1aa6d34291dab5394eba350df184cdebb
// input: packages/i18n/messages/miniapp-taro/ko.json 100e461a4f0c253b0a010a9a7bd88e434a4c6de3945754052716030d8b162139
// input: packages/i18n/messages/miniapp-taro/zh-TW.json a28c48487f70b8abca7789b3a4cec178772d485e94c2fbc852f16e8179c7d23f
// input: packages/i18n/messages/mobile-rn/en.json f7bd9a64541eb948726856ea8e6cbe9b4daac4b52ab76805882f61b41112fe16
// input: packages/i18n/messages/mobile-rn/ja.json f190c8ff5f0236c7de2b624ea8c540fbca7c265a823bb5626181e95fd73458da
// input: packages/i18n/messages/mobile-rn/ko.json b730eb346c8e7c95a2039116bcee6df0b86f495b81a36998f51e3d7c37b7cbcd
// input: packages/i18n/messages/mobile-rn/zh-TW.json fcfc0157c7f2d23a8376bdc56c995dc94675318947b7abd642f16ee800ff915b
// input: packages/i18n/messages/shared/en.json 60e33213c275655994a6e157a83ded7e05fcd0cd313ee84e57d172934de91c4e
// input: packages/i18n/messages/shared/ja.json 07d85f7b08a865f1cac320cb56982f99ef61bbb6b2d6c3d3687ceb06c7016e0c
// input: packages/i18n/messages/shared/ko.json e12d93fcb0f41b4913e403f7fb7e1526b1fce8e9223cfb3c1780a3d0e9e28417
// input: packages/i18n/messages/shared/zh-TW.json 795fdcdfab5d399a8fa564046892bc82f68b73626525023781c4fa0c5f01ed34
// generatedAt: 2026-10-30T18:13:40.213Z
// IHUI-GEN-PIN-END
export type RemoteLocale = 'en' | 'ja' | 'ko' | 'zh-TW'
export const REMOTE_LOCALE_MANIFEST: Record<RemoteLocale, { version: string; bytes: number }> = {
  en: { version: 'e4ef5764779fa352c31ae8b4fa1a6e03e2feeb97114e55788eb76f55d2bfdd3b', bytes: 147148 },
  ja: { version: 'f0604b77f7e2cdfde1da4246a6e219bc06e6aaad45b0c152aa120fffe5c2364f', bytes: 168628 },
  ko: { version: '3f583d86a52bcd89ad7e3b0a721b7ac01a7b17a01c21b2cb6d37557ef728a253', bytes: 160388 },
  'zh-TW': { version: 'efd134e9c6bcfa2b0d9ad3ecd1a5538ba4194f4b17611ac88693b30fcc001091', bytes: 152560 },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
