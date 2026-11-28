// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)
// 按需拉取语言包的运行时清单:version = 载荷 gzip+b64 的 sha256(storage 缓存 key 与失效判据),
// bytes = 载荷字节数(下载完整性粗校验)。载荷真相在 generated/remote-locales.gen.ts(离线对账)
// 与 src/assets/remote-locales/<locale>.b64.txt(CDN 部署),三者同批派生、同钉对账。
// IHUI-GEN-PIN-BEGIN
// generator: scripts/gen-i18n-compressed.mjs
// sourceCommit: c82e834c24ce0a79458aff58bdef396a16605afe
// inputsSha256: 1835a67af353031a1b33362cbb5019ae1759ab645204a3440a1a0aa266386258
// input: packages/i18n/messages/miniapp-taro/en.json 75a80b1b9e2bca216acc37833a0ac8d00616985eae0709b7226ed629534198c3
// input: packages/i18n/messages/miniapp-taro/ja.json 264deaaf87b155300929f3821b6a52d3b7d196b4b6517526dc0174a031803e8f
// input: packages/i18n/messages/miniapp-taro/ko.json 26a5720650b7e40473f8088805da6891db08c3ebf3bca2461702f24babea891a
// input: packages/i18n/messages/miniapp-taro/zh-TW.json d8294b4a2a68cc3c1a62fee66a153e8e0fad48783a2b03badddbec523377fab9
// input: packages/i18n/messages/mobile-rn/en.json 5138da9ae580dff01f882e386a140a2e6ed610b7da92e4348be0fbbfaebf5b7d
// input: packages/i18n/messages/mobile-rn/ja.json cdf61342bb6ea3853d091766d84ffe1eab1c54d732846c083edb0c85f236e42d
// input: packages/i18n/messages/mobile-rn/ko.json cf626f0e37d1e0254e34368fe2b49cb22280bc4b92705c6ce1707d4c06a3f51a
// input: packages/i18n/messages/mobile-rn/zh-TW.json 483d3d79c6a7bdaf5bc4960a1a5e702d8c828b99633b04a25232353ef6c9fc8b
// input: packages/i18n/messages/shared/en.json d4280effbd6ad87e6cc54bc3d3a404c0d80244f0e4d23273b2c394cd58b0eadc
// input: packages/i18n/messages/shared/ja.json 263ec4c5fc78c0617410ac4a64b5a259a9f8944cad45eaf3d4158540b00cfbd3
// input: packages/i18n/messages/shared/ko.json 4b1b3a01d03177b3a0681bf6bf8e84edbe8c6be7435d121ac9985ac0dca0b69f
// input: packages/i18n/messages/shared/zh-TW.json 17bd3582d5e57510c79409c3c3d765e4971b9cdec20650eef50fd633f90aa03a
// carried: present
// carriedKeys: en=1213 ja=1213 ko=1213 zh-TW=1213
// generatedAt: 2026-11-28T08:14:16.167Z
// IHUI-GEN-PIN-END
export type RemoteLocale = 'en' | 'ja' | 'ko' | 'zh-TW'
export const REMOTE_LOCALE_MANIFEST: Record<RemoteLocale, { version: string; bytes: number }> = {
  en: { version: 'a6e55614032530245b2a31550fa7ed3a3db4fcd4206fb59d36dd5dcf425e2414', bytes: 183208 },
  ja: { version: '54629817c589a927ac1af9ab1126ebe2b6f7f97dd6eac93aacf97635a0c8341e', bytes: 211284 },
  ko: { version: '6dfc02f493618a628915cd05b2a3a82d05b29a82e36c84ced65f68a87d09856f', bytes: 200992 },
  'zh-TW': { version: 'da4260874e4d7a6698d8015c8e1cfff7cc5348ed16740d1b850af57f47b5cb5b', bytes: 191724 },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
