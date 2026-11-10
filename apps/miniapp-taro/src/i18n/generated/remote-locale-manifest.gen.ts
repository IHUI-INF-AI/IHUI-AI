// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)
// 按需拉取语言包的运行时清单:version = 载荷 gzip+b64 的 sha256(storage 缓存 key 与失效判据),
// bytes = 载荷字节数(下载完整性粗校验)。载荷真相在 generated/remote-locales.gen.ts(离线对账)
// 与 src/assets/remote-locales/<locale>.b64.txt(CDN 部署),三者同批派生、同钉对账。
// IHUI-GEN-PIN-BEGIN
// generator: scripts/gen-i18n-compressed.mjs
// sourceCommit: c592e24cebe463b52e95c45410e8571ef7a544b2
// inputsSha256: 60b1feafc52cbbf0a466c8cb40c84e403a3e08d10d8ba1fcb41717c6f92e43a9
// input: packages/i18n/messages/miniapp-taro/en.json 20484dfa55bd6ed9c31a507e6156e724788d18245f304540dc23a5fcb76749db
// input: packages/i18n/messages/miniapp-taro/ja.json 838f988aa0bd5d2e8c9404790a6113c812ea190a9abf39f8d2fb53c2391f484d
// input: packages/i18n/messages/miniapp-taro/ko.json 841513cd86209d5f128513aa95c17e2c4f6b624fe405e5f7fb072b7df88daf7c
// input: packages/i18n/messages/miniapp-taro/zh-TW.json 64068a1e8e9a0e6a7792a1eee54e60e583ff1a13a7c0f451927f4093a9d08a73
// input: packages/i18n/messages/mobile-rn/en.json 03f1a5f0cfb03fd752f703eb9f3ff2a5f0667ef8f9e9be348969a42a77f45938
// input: packages/i18n/messages/mobile-rn/ja.json e920fa8991fa651b0f3fafbb7b38e24346bf94e882f0fd645c4696f0f7401cfd
// input: packages/i18n/messages/mobile-rn/ko.json a43473f8ea8aa24ead0ee8aba868695abb12b4b13b5838cba39be16a5df24807
// input: packages/i18n/messages/mobile-rn/zh-TW.json ac03a18eec306cca657ac074191e4335e9031ee1a1194b741e35b338ddde5114
// input: packages/i18n/messages/shared/en.json de5962e21329c92c48e1e66711a1bb4cf9715c61b4ca69c7d5616caf581ca654
// input: packages/i18n/messages/shared/ja.json 145d5252eeb933961441a0a9ed05c806241b6f10342db595acb4db5ab42297e3
// input: packages/i18n/messages/shared/ko.json 00ae4fe1c941807069fcb61405fa0848a8f15c6738fd95a9e16ed41a4e6eb310
// input: packages/i18n/messages/shared/zh-TW.json f27a5023a57482fea81f285151325569539d54b1733d1a7a3c48dfcf1a258129
// carried: present
// carriedKeys: en=656 ja=656 ko=656 zh-TW=656
// generatedAt: 2026-11-10T08:35:39.321Z
// IHUI-GEN-PIN-END
export type RemoteLocale = 'en' | 'ja' | 'ko' | 'zh-TW'
export const REMOTE_LOCALE_MANIFEST: Record<RemoteLocale, { version: string; bytes: number }> = {
  en: { version: 'b1f929061f93604b55bc2919f8b8ecbea41f5afd1685ce113f9d1dfd68ba1235', bytes: 148288 },
  ja: { version: '35137fdbeab8f94a28e52ea535f5bcc292b0aa30c4f0bba5f7fb4cd8bdc384b9', bytes: 170196 },
  ko: { version: '9e7e7c8c53a6ed08e6769759399076c9ffa071f453ae33661423afbc6f93177f', bytes: 161868 },
  'zh-TW': { version: '5b4030b63c3ce782111f7e54b7e761c814cfc7e9d6ab903f0a7d8ae5a3517995', bytes: 153912 },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
