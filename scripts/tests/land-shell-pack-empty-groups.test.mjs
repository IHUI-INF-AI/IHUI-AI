// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 落地器词包接缝的「无事可做」档(§22c:import 源 __test__,零复制判据)。
 *
 * 立因(2026-10-27 实测):壳承载形制里「t() 全落在通用命名空间」的屏(knowledge-planet /
 * learn / sub-package-index 只用到 common.back|more|retry)没有专属词条 ⇒ 计划里 groups=[]。
 * 旧 writePackText 直接调 insertJsonMembers([]) 得 `没有可插入的成员组` ⇒ 整批判定失败 ⇒
 * 这三屏永远落不下来,而 why 看起来像"词包坏了"。无事可做必须是**跳过**,不是失败。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as L } from '../land-cross-end-shell-pages.mjs'

const CANON = '{\n  "common": {\n    "back": "返回"\n  }\n}\n'

test('E1 空成员组 ⇒ 跳过(原样返回,不判失败)', () => {
  const r = L.writePackText(CANON, [], [])
  assert.equal(r.ok, true, `无事可做不该报错:${r.why}`)
  assert.equal(r.skipped, true)
  assert.equal(r.text, CANON, '跳过必须逐字节不改写底稿')
})

test('E2 非空成员组 ⇒ 仍走按行插(反控:别把正常的写路径一起跳过)', () => {
  const r = L.writePackText(CANON, [['  "learn": {', '    "title": "学习"', '  }']], [])
  assert.equal(r.ok, true, r.why)
  assert.equal(r.skipped, undefined)
  assert.match(r.text, /"learn"/)
})

test('E3 已存在顶层命名空间 ⇒ 转并键档(而不是当成插入失败)', () => {
  const r = L.writePackText(CANON, [['  "common": {', '    "back": "返回"', '  }']], [
    { ns: 'common', obj: { more: '更多' } },
  ])
  assert.equal(r.ok, true, r.why)
  assert.match(r.text, /"more"/, '并键档必须把缺的键补进来')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('E4 装配:空成员组的词包不进 blob 清单(否则「写回旧版」守卫会把整批打回)', () => {
  const CONFIG =
    "export default defineAppConfig({\n  pages: ['pages/index/index'],\n  subPackages: [\n    {\n      root: 'pkg-x',\n      pages: ['a/index'],\n    },\n  ],\n})\n"
  const headOf = (rel) =>
    rel === 'apps/miniapp-taro/src/app.config.ts'
      ? CONFIG
      : rel === 'scripts/data/cross-end-screen-registry.json'
        ? '{\n  "entries": [\n    {\n      "shared": "a",\n      "rn": "b",\n      "miniapp": "c"\n    }\n  ]\n}\n'
        : '{\n  "common": {\n    "back": "返回"\n  }\n}\n'
  const plan = {
    spec: 'packages/app/src/features/x/XScreen.tsx',
    pageRel: 'apps/miniapp-taro/src/pkg-x/b/index.tsx',
    pageText: 'export default function P(){return null}\n',
    subRoot: 'pkg-x',
    page: 'b/index',
    route: 'pkg-x/b/index',
    registryEntry: {
      shared: 'packages/app/src/features/x/XScreen.tsx',
      rn: 'apps/mobile-rn/src/screens/XScreen.tsx',
      miniapp: 'pkg-x/b/index',
    },
    langBlocks: [
      { packRel: 'packages/i18n/messages/miniapp-taro/en.json', groups: [], members: [], paths: [] },
    ],
  }
  const r = L.assembleBlobs([plan], { headOf, watermarkOf: (_rel, t) => t })
  assert.equal(r.ok, true, r.why)
  assert.equal(r.packs, 0, '空组不该算作改动的词包')
  assert.equal(
    r.files.some((f) => f.path.endsWith('en.json')),
    false,
    '未变的词包不得进 blob 清单',
  )
  const r2 = L.assembleBlobs(
    [
      {
        ...plan,
        langBlocks: [
          {
            packRel: 'packages/i18n/messages/miniapp-taro/en.json',
            groups: [['  "x": {', '    "title": "X"', '  }']],
            members: [{ ns: 'x', obj: { title: 'X' } }],
            paths: ['x.title'],
          },
        ],
      },
    ],
    { headOf, watermarkOf: (_rel, t) => t },
  )
  assert.equal(r2.ok, true, r2.why)
  assert.equal(r2.packs, 1, '反控:真有新键时必须进清单')
})

