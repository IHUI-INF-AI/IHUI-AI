// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)
// 按需拉取语言包的运行时清单:version = 载荷 gzip+b64 的 sha256(storage 缓存 key 与失效判据),
// bytes = 载荷字节数(下载完整性粗校验)。载荷真相在 generated/remote-locales.gen.ts(离线对账)
// 与 src/assets/remote-locales/<locale>.b64.txt(CDN 部署),三者同批派生、同钉对账。
// IHUI-GEN-PIN-BEGIN
// generator: scripts/gen-i18n-compressed.mjs
// sourceCommit: d8fa4faf4f7afb0fb09095636d75af165ff3fbb7
// inputsSha256: 6f3f8493f33c503aa5dfc7c4f670253c552f2370cb75af198e0194c2ccd52905
// input: packages/i18n/messages/miniapp-taro/en.json d9d9f2910713c909e4d8ac94441126872620a5db1f3ef34131b413b5d9798bfa
// input: packages/i18n/messages/miniapp-taro/ja.json 5f46c45406a3ab18a6780a2d0b67d9ba794a4c7065523b9e16e2510b8c71290b
// input: packages/i18n/messages/miniapp-taro/ko.json 51e9084bdec59c058e4717bc8ff1d240ce033e7eebf49d212a31a8708b2619b7
// input: packages/i18n/messages/miniapp-taro/zh-TW.json 8532ecba712df53724898b6ee574ea9d3bad759b5be381739e1a8eeedd0ca999
// input: packages/i18n/messages/mobile-rn/en.json 58d37f43ea1bf5dcb6756e1c18926ba18a815587dc69a39d0f41a88f3984a858
// input: packages/i18n/messages/mobile-rn/ja.json 42e65ddba2525d3da1879c503026bc2fd0eaea822b958b68bf739030331c0a12
// input: packages/i18n/messages/mobile-rn/ko.json 1900a0426be364d838a774ac95386774ea4a81e102aac37a70553dde59a6c242
// input: packages/i18n/messages/mobile-rn/zh-TW.json 831d529f3c645167416447d8de16b0d64b5fe98c05d68df7234cde7144c42768
// input: packages/i18n/messages/shared/en.json d4280effbd6ad87e6cc54bc3d3a404c0d80244f0e4d23273b2c394cd58b0eadc
// input: packages/i18n/messages/shared/ja.json 263ec4c5fc78c0617410ac4a64b5a259a9f8944cad45eaf3d4158540b00cfbd3
// input: packages/i18n/messages/shared/ko.json 4b1b3a01d03177b3a0681bf6bf8e84edbe8c6be7435d121ac9985ac0dca0b69f
// input: packages/i18n/messages/shared/zh-TW.json 1f5cd73a5deda5c2724e4d64ddebe25a8f0b3322ea47b8eaf61a8810408077e6
// carried: present
// carriedKeys: en=847 ja=847 ko=847 zh-TW=847
// generatedAt: 2026-11-25T23:26:45.866Z
// IHUI-GEN-PIN-END
export type RemoteLocale = 'en' | 'ja' | 'ko' | 'zh-TW'
export const REMOTE_LOCALE_MANIFEST: Record<RemoteLocale, { version: string; bytes: number }> = {
  en: { version: 'e1b51e61f2d65b4472623cbc93b8efb4dd82df74159b84c314f52d02aa816702', bytes: 175824 },
  ja: { version: '2f0137a11b20e976720febca1137b533538fac9af9457f73d21b199d6ca1bd1b', bytes: 202644 },
  ko: { version: 'a4c6f703bcdd125b6100f3a1859ba276b542e98364752ad5d6d126e3ada2be26', bytes: 193068 },
  'zh-TW': { version: 'a168e6e870e92b910eb0578c8dbab824fba9e87cb3f86f303b0cf663c3492f85', bytes: 183752 },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
