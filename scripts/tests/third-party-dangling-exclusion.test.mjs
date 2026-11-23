// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 已登记第三方 root 的排除面 —— 水印层 / 落地预检 / D1 悬空导入三处共用**同一份**台账的镜像测试(§22c)。
 *
 * 立因(2026-11-24 实测):archify 3.3.0 入库后,`provenance-ledger --worktree` 判出 8 条 P2
 * 「拿了没登记」(4 个 vendor 目录 + 4 个带第三方归属头的文件),而 `object-space-land` 的水印预检
 * 要求 432 条路径逐条带可解码载荷 —— 两件事说明同一个事实:这 441 份是**上游作品**,既不该被
 * 本仓盖章(会判 P8 归属反噬),也不该被本仓的导入规范判红(D1 对它 10 处 CJS 导入必然 exit 2)。
 *
 * 这组测试钉四件:
 *  1. 登记成整目录 root 后,谓词对目录内任意深度路径为真 —— 包括**尚未 git add 的新文件**
 *     (前缀分支的意义:否则门禁会先把横幅打进它再谈登记);
 *  2. 反向:本仓自研源码不得被排除 —— 台账写宽一格就等于把自家代码架空了;
 *  3. 条目形状:P8 与 P3 的口径(modified-copy + inRepo 内容寻址许可)必须写在台账里,
 *     写错字段不会被判据发现,只会被 P 系列在下次提交时判红;
 *  4. 形状锁:`auditOneFace` 的第三参数缺省 null ⇒ 自检与锚点历史面的既有断言一字不变。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createExclusionPredicate, readLedgerRoots, LEDGER_DIR } from '../lib/third-party-roots.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('archify 整目录登记 ⇒ 任意深度文件被排除(三处共用的那一个谓词)', () => {
  const pred = createExclusionPredicate(REPO_ROOT)
  // 目录内、深路径、以及**本次新增尚未 git add** 的形态(前缀分支负责这一格)
  assert.equal(pred.isExcluded('.ihui/skills/archify/bin/visual-check.mjs'), true)
  assert.equal(pred.isExcluded('.ihui/skills/archify/modules/code-analysis/vendor/typescript.cjs'), true)
  assert.equal(pred.isExcluded('.ihui/skills/archify/not-yet-added/new-file.mjs'), true)
  // 反斜杠形态必须等价(NTFS 上 ls-tree 与磁盘两处来源不同)
  assert.equal(pred.isExcluded('.ihui\\skills\\archify\\SKILL.md'), true)
})

test('反向:本仓自研源码不得被第三方台账排除', () => {
  const pred = createExclusionPredicate(REPO_ROOT)
  assert.equal(pred.isExcluded('scripts/watermark.mjs'), false)
  assert.equal(pred.isExcluded('scripts/check-dangling-local-imports.mjs'), false)
  assert.equal(pred.isExcluded('apps/web/src/components/common/view-more-link.tsx'), false)
  // 前缀不得被"像不像"地模糊命中
  assert.equal(pred.isExcluded('.ihui/skills/archify-other/x.mjs'), false)
})

test('台账形状:整目录 root 恰好一条,且 P3/P8 口径写在条目里', () => {
  const { declared } = readLedgerRoots(REPO_ROOT)
  const hits = declared.filter((d) => d.root === '.ihui/skills/archify')
  assert.equal(hits.length, 1, '.ihui/skills/archify 整目录 root 必须恰好登记一条(重复登记 = 清单漂开)')
  assert.match(hits[0].source, /copied:archify-skill/, '来源账必须是 copied 那本')

  const doc = JSON.parse(readFileSync(join(REPO_ROOT, LEDGER_DIR, 'copied.json'), 'utf8'))
  const e = doc.entries.find((x) => x.id === 'archify-skill-v3.3.0-bundle')
  assert.ok(e, '条目 archify-skill-v3.3.0-bundle 必须存在')
  // P8 口径:打过补丁就不能自称 unmodified-copy
  assert.equal(e.modification, 'modified-copy')
  assert.match(e.modificationNote, /visual-check\.mjs/, '补丁落点必须写清,否则下次升级无人知道改了哪两份')
  // P3 口径:inRepo 形态要能被内容寻址复算
  assert.equal(e.license.texts[0].form, 'inRepo')
  assert.equal(e.license.texts[0].inRepo, '.ihui/skills/archify/LICENSE')
  assert.match(e.license.texts[0].sha256, /^[0-9a-f]{64}$/)
  assert.ok(Number.isInteger(e.license.texts[0].byteLength) && e.license.texts[0].byteLength > 0)
  // P4 口径:有版本时 gitRevision 不得为空串
  assert.equal(e.upstream.version, '3.3.0')
  assert.match(e.upstream.gitRevision, /^[0-9a-f]{40}$/)
})

test('形状锁:auditOneFace 第三参数缺省 null,且排除面报数行在场', () => {
  const src = readFileSync(join(REPO_ROOT, 'scripts/check-dangling-local-imports.mjs'), 'utf8')
  assert.match(
    src,
    /export function auditOneFace\(rev, shadowCtx[\s\S]{0,80}thirdParty = null\)/,
    '第三参数必须缺省 null —— 缺省值一改,自检与锚点历史面的既有断言会静默漂',
  )
  assert.match(src, /const files = thirdParty \? allSrc\.filter\(\(p\) => !thirdParty\(p\)\) : allSrc/)
  assert.match(src, /const thirdPartySkipped = allSrc\.length - files\.length/)
  assert.match(
    src,
    /第三方排除面:/,
    '排除面必须报数 —— 不加这一行,"少审了 N 个"与"这些文件全都干净"在输出里无法区分',
  )
  assert.match(
    src,
    /from '\.\/lib\/third-party-roots\.mjs'/,
    '排除面必须复用既有出口;另立第二份"哪些目录算 vendored"的清单必然与归属台账漂开(§0.6)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
