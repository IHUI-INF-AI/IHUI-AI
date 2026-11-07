// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 225 的取材面镜像测试(2026-11-07)。
 *
 * case① 阴性对照:用事故当天的原始写法(`face === 'staged' ? '' : 'HEAD:' + p`)取索引面,
 *          `git cat-file --batch` 把裸路径当 rev 解 ⇒ 全部 missing ⇒ 必须 exit 2「取数面不可用」。
 * case② 正确写法(`:path`)⇒ exit 0,且被删除的候选归 `absent`、不冒充取数失败。
 *
 * 两类结论必须可分辨:该面确实没有这一路径(删除)≠ 路径在册但取不到正文。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as GATE } from '../check-generator-resource-release.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GEN = [
  'async def stream():',
  '    async with pool.acquire() as conn:',
  '        yield conn',
  '',
  '',
  'async def consume():',
  '    it = stream()',
  '    await it.aclose()',
  '',
].join('\n')

function git(root, args) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  })
}

/** 暂存面夹具:HEAD 有 gone.py(随后被 staged 删除),索引里新增 gen.py。 */
function makeFixture(prefix) {
  const root = mkScratch(prefix)
  git(root, ['init', '-q'])
  git(root, ['config', 'user.email', 'test@example.com'])
  git(root, ['config', 'user.name', 'ihui-test'])
  const appDir = join(root, 'apps', 'ai-service', 'app')
  mkdirSync(appDir, { recursive: true })
  writeFileSync(join(appDir, 'gone.py'), 'def gone():\n    yield 1\n')
  git(root, ['add', '--', 'apps/ai-service/app/gone.py'])
  git(root, ['commit', '-q', '-m', 'base'])
  git(root, ['rm', '-q', 'apps/ai-service/app/gone.py'])
  mkdirSync(appDir, { recursive: true }) // git rm 会把空目录一并收掉
  writeFileSync(join(appDir, 'gen.py'), GEN)
  git(root, ['add', '--', 'apps/ai-service/app/gen.py'])
  return root
}

test('case① 事故原始写法(裸路径)⇒ 取数面不可用 exit 2', () => {
  const root = makeFixture('gen-release-face-old-')
  try {
    const res = GATE.runGate({
      root,
      face: 'staged',
      // 事故当天的原文:索引面拼出裸路径
      specOf: (face, p) => (face === 'staged' ? '' : 'HEAD:' + p),
    })
    assert.equal(res.rc, 2, '旧算法必须报红(exit 2),不能静默通过')
    assert.equal(res.stage, 'read', '应落在「取数面不可用」而不是「该面确实 0 份」')
    assert.ok(res.failures >= 1, '至少一条路径必须记为取数失败')
  } finally {
    rmScratch(root)
  }
})

test('case② 正确写法(:path)⇒ exit 0,且删除的候选归 absent 不冒充失败', () => {
  const root = makeFixture('gen-release-face-new-')
  try {
    assert.equal(GATE.faceBlobSpec('staged', 'a.py'), ':a.py')
    const res = GATE.runGate({ root, face: 'staged' })
    assert.equal(res.rc, 0, '索引面正文必须取得到')
    assert.equal(res.stage, 'audit')
    assert.equal(res.absent, 1, '被 staged 删除的 gone.py 属于「该面确实不存在」')
    assert.equal(res.candidates, 1)
    assert.equal(res.counts.violation, 0)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
