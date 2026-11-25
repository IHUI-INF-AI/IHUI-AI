// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `resolveAvatarUrlCore` 三态判定锁(§22c:判据 import 端侧 core,不在本文件复制规则)。
 * 端侧 `apps/miniapp-taro/src/utils/web-asset-url.ts` 的 `resolveAvatarUrl` 注入
 * `resolveWebAssetUrl` 作为补全回调;此处用等价的拼底座回调钉住三态分支。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAvatarUrlCore } from '../../apps/miniapp-taro/src/utils/avatar-url-core.ts'

const FALLBACK = '/pkg-ai/assets/default-agent.png'
/** 等价端侧 resolveWebAssetUrl:站内相对路径拼站点底座;绝对 URL 由 core 先拦截透传 */
const resolveAsset = (path) => `https://aizhs.top${path}`

test('相对路径(后端下发 /agents/coze/<bot>.webp)补全站点底座', () => {
  const out = resolveAvatarUrlCore('/agents/coze/7496003839914115111.webp', {
    fallback: FALLBACK,
    resolveAsset,
  })
  assert.equal(out, 'https://aizhs.top/agents/coze/7496003839914115111.webp')
})

test('http/https 绝对 URL 原样透传,不拼 base', () => {
  assert.equal(
    resolveAvatarUrlCore('https://cdn.example.com/a.webp', { fallback: FALLBACK, resolveAsset }),
    'https://cdn.example.com/a.webp',
  )
  assert.equal(
    resolveAvatarUrlCore('http://cdn.example.com/b.webp', { fallback: FALLBACK, resolveAsset }),
    'http://cdn.example.com/b.webp',
  )
})

test('空值/非字符串 → 本地占位图', () => {
  assert.equal(resolveAvatarUrlCore('', { fallback: FALLBACK, resolveAsset }), FALLBACK)
  assert.equal(resolveAvatarUrlCore('   ', { fallback: FALLBACK, resolveAsset }), FALLBACK)
  assert.equal(resolveAvatarUrlCore(null, { fallback: FALLBACK, resolveAsset }), FALLBACK)
  assert.equal(resolveAvatarUrlCore(undefined, { fallback: FALLBACK, resolveAsset }), FALLBACK)
  assert.equal(resolveAvatarUrlCore(123, { fallback: FALLBACK, resolveAsset }), FALLBACK)
})

test('本端静态路径(/pkg-ai/ 等)原样透传,不拼站点底座', () => {
  assert.equal(
    resolveAvatarUrlCore('/pkg-ai/assets/default-agent.png', { fallback: FALLBACK, resolveAsset }),
    '/pkg-ai/assets/default-agent.png',
  )
})

test('补全落空(resolveAsset 返回 undefined)→ 本地占位图兜底', () => {
  const out = resolveAvatarUrlCore('/agents/coze/x.webp', {
    fallback: FALLBACK,
    resolveAsset: () => undefined,
  })
  assert.equal(out, FALLBACK)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
