// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)
// 按需拉取语言包的运行时清单:version = 载荷 gzip+b64 的 sha256(storage 缓存 key 与失效判据),
// bytes = 载荷字节数(下载完整性粗校验)。载荷真相在 generated/remote-locales.gen.ts(离线对账)
// 与 src/assets/remote-locales/<locale>.b64.txt(CDN 部署),三者同批派生、同钉对账。
// IHUI-GEN-PIN-BEGIN
// generator: apps/miniapp-taro/scripts/gen-i18n-compressed.mjs
// sourceCommit: b1f82d3161a6d5ccb241e4bf140858bc70c41bfe
// inputsSha256: 44669719e84f0f956a0eb9902896261b991476d3697a1cb79e404c961d696711
// input: packages/i18n/messages/miniapp-taro/en.json 67450c64e4ed1ba00da2fca9017faca2eb820f0f1ab71a5c9dfd9e606f915928
// input: packages/i18n/messages/miniapp-taro/ja.json 40a87fa4985cc81e0e3d0a82a30d76d1aa6d34291dab5394eba350df184cdebb
// input: packages/i18n/messages/miniapp-taro/ko.json a056980f4310984abd15a43cf031a26eed18c7d3863794f9de98ee20b7f228b6
// input: packages/i18n/messages/miniapp-taro/zh-TW.json a28c48487f70b8abca7789b3a4cec178772d485e94c2fbc852f16e8179c7d23f
// input: packages/i18n/messages/mobile-rn/en.json f7bd9a64541eb948726856ea8e6cbe9b4daac4b52ab76805882f61b41112fe16
// input: packages/i18n/messages/mobile-rn/ja.json f190c8ff5f0236c7de2b624ea8c540fbca7c265a823bb5626181e95fd73458da
// input: packages/i18n/messages/mobile-rn/ko.json b730eb346c8e7c95a2039116bcee6df0b86f495b81a36998f51e3d7c37b7cbcd
// input: packages/i18n/messages/mobile-rn/zh-TW.json fcfc0157c7f2d23a8376bdc56c995dc94675318947b7abd642f16ee800ff915b
// input: packages/i18n/messages/shared/en.json 60e33213c275655994a6e157a83ded7e05fcd0cd313ee84e57d172934de91c4e
// input: packages/i18n/messages/shared/ja.json 07d85f7b08a865f1cac320cb56982f99ef61bbb6b2d6c3d3687ceb06c7016e0c
// input: packages/i18n/messages/shared/ko.json e12d93fcb0f41b4913e403f7fb7e1526b1fce8e9223cfb3c1780a3d0e9e28417
// input: packages/i18n/messages/shared/zh-TW.json d1dd408665eec301ec410e9aa8c0255d38c99a307f8a5d619d8400b47a1e3893
// carried: present
// carriedKeys: en=508 ja=508 ko=509 zh-TW=508
// generatedAt: 2026-10-30T20:40:31.708Z
// IHUI-GEN-PIN-END
export type RemoteLocale = 'en' | 'ja' | 'ko' | 'zh-TW'
export const REMOTE_LOCALE_MANIFEST: Record<RemoteLocale, { version: string; bytes: number }> = {
  en: { version: 'e4ef5764779fa352c31ae8b4fa1a6e03e2feeb97114e55788eb76f55d2bfdd3b', bytes: 147148 },
  ja: { version: 'f0604b77f7e2cdfde1da4246a6e219bc06e6aaad45b0c152aa120fffe5c2364f', bytes: 168628 },
  ko: { version: '0f21b807b133a10f761a93d3a863680d7e784738efb8ac83c5cc930fde07f4b7', bytes: 160356 },
  'zh-TW': { version: 'fd7917f80a93528f1c4ac3b93db17037b3500c7a0b98c2112a02fd7ad43fd62d', bytes: 152556 },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
