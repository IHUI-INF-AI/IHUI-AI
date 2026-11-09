// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 240 的取材面镜像测试(2026-11-07)。
 *
 * 事故原文:`readAt(':!0', p)` / `readFace` 里 `rev = ':!0'` —— `:!0` 不是合法 rev,
 * `git show ':!0:<path>'` 当场 fatal ⇒ 被审面恒取不到 ⇒ exit 2。
 *
 * case① 阴性对照:注入原始 `:!0` 读法 ⇒ 必须 exit 2。
 * case② 正确写法(`:` = 索引 stage 0)⇒ exit 0(R1–R8 全绿,R8 差值 0)。
 * case③ HEAD 面没有该页(只存在于索引/合并面)⇒ 报「不适用(NA)」exit 0,不是红。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as GATE } from '../check-readout-no-break.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { REPO_ROOT, TARGET_REL, FACE_REV } = GATE
const REAL_PAGE = join(REPO_ROOT, TARGET_REL)

function git(root, args) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function initRepo(prefix) {
  const root = mkScratch(prefix)
  git(root, ['init', '-q'])
  git(root, ['config', 'user.email', 'test@example.com'])
  git(root, ['config', 'user.name', 'ihui-test'])
  writeFileSync(join(root, 'README.md'), '# fixture\n')
  git(root, ['add', '--', 'README.md'])
  git(root, ['commit', '-q', '-m', 'base'])
  return root
}

function writePage(root, text) {
  const p = join(root, TARGET_REL)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text)
  git(root, ['add', '--', TARGET_REL])
}

const PAGE = readFileSync(REAL_PAGE, 'utf8')

test('case① 事故原始写法(:!0)⇒ 取数面不可用 exit 2', () => {
  const root = initRepo('readout-face-old-')
  try {
    const text = PAGE + '\n// fixture: 仅触发 R8 射程,不新增读数\n'
    writePage(root, text)
    const res = GATE.runGate({
      root,
      face: 'staged',
      // 事故当天的原文:`git show ':!0:<path>'`
      faceReader: (face, r) => {
        try {
          return gitRaw(['show', `:!0:${TARGET_REL}`], r, { maxBuffer: 1 << 26 })
        } catch {
          return null
        }
      },
    })
    assert.equal(res, 2, '旧算法必须报红(exit 2),不能静默通过')
  } finally {
    rmScratch(root)
  }
})

test('case② 正确写法(:path)⇒ exit 0,索引面与 HEAD 基线都取得到', () => {
  const root = initRepo('readout-face-new-')
  try {
    assert.equal(FACE_REV.staged, ':')
    // HEAD 先放同一份页面,再在索引面追加一行注释 ⇒ R8 射程内有改动但违规数不变
    writePage(root, PAGE)
    git(root, ['commit', '-q', '-m', 'page'])
    const text = PAGE + '\n// fixture: 仅触发 R8 射程,不新增读数\n'
    writePage(root, text)
    const res = GATE.runGate({ root, face: 'staged' })
    assert.equal(res, 0, '索引面正文必须取得到且判据全绿')
  } finally {
    rmScratch(root)
  }
})

test('case③ HEAD 面没有该页 ⇒ NA(exit 0),不是红', () => {
  const root = initRepo('readout-face-na-')
  try {
    writePage(root, PAGE) // 只在索引面存在
    const res = GATE.runGate({ root, face: 'head' })
    assert.equal(res, 0, 'HEAD 面不含该页属于「不适用」,不得报红')
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
