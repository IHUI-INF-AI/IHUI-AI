// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账行 L15556 的取证格:守护在「工作区 `.git` 是指针文件」那台机上把 25MB 备份灌进指针文件
 * ⇒ `fatal: too large to be a .git file`,整仓不可用(2026-10-16 00:21 实测)。两条正解已在门体
 * (`gitdirTargetSafe()` 拦在两兜底路径之前),**票面还差的那格是本文件**:
 * 形状锁「指针形态机上不得出现对 `.git` 的 mkdirSync」+ 判据四态。
 *
 * 为什么不在真仓上做"把指针临时换成大文件"的演练:那是一棵**共享工作树**,演练期间每条 git
 * 命令都会失败,别人正在提交/落地 —— 制造那种现场属于机主说的"高危操作必须暂停等人工"。
 * 形态判定已抽成纯函数 `gitdirTargetVerdict`(§22c:镜像直接吃源脚本那一份,不复制判据),
 * 真实现场那一格如实留在台账行里,由持有人决定何时做。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { __test__ as G } from '../git-guardian.mjs'

const { gitdirTargetVerdict } = G
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(path.resolve(HERE, '..', 'git-guardian.mjs'), 'utf8')

describe('gitdir 目标形态判据 — 四态各归各', () => {
  it('自指(GITDIR 解析成工作树 .git 指针本身)⇒ 拒,且不问其它输入', () => {
    const v = gitdirTargetVerdict({ samePointer: true, exists: true, isDirectory: true })
    assert.equal(v.ok, false)
    assert.match(v.why, /自指|指针文件自身/)
  })
  it('存在但不是目录(那次事故的真实形态)⇒ 拒,并留人工确认出口', () => {
    const v = gitdirTargetVerdict({ exists: true, isDirectory: false })
    assert.equal(v.ok, false)
    assert.match(v.why, /不是目录/)
  })
  it('形态读不出来 ⇒ 保守拒(§0.3:不猜它是目录,也不冒这个恢复的红)', () => {
    assert.equal(gitdirTargetVerdict({ unreadable: true }).ok, false)
  })
  it('不存在 / 已是目录 ⇒ 放行(否则守护在该修的时候不敢修)', () => {
    assert.equal(gitdirTargetVerdict({ exists: false }).ok, true)
    assert.equal(gitdirTargetVerdict({ exists: true, isDirectory: true }).ok, true)
  })
})

/**
 * 形状锁:每个**破坏 GITDIR**的写,必须在同一函数体内、写之前调过守卫。
 * 口径要划清(否则锁会把合法动作当违规喊):
 *  - 算破坏性:`mkdirSync(GITDIR…)`、`rmSync/rmdirSync(GITDIR…)`、`writeFileSync(GITDIR…)`、
 *    以及 `cpSync(<src>, GITDIR…)` —— GITDIR 作为**目的地**被灌;
 *  - **不算**:`cpSync(GITDIR, dst…)` —— GITDIR 是**源**,只读不写(那是 `archiveGitdir` 在归档现场,
 *    恰恰是 §5b 要求的保护动作)。上一版把它误纳,是"锁太粗 ⇒ 逼人放宽判据"的起点,不能这么写。
 */
function unguardedGitdirWrites(src) {
  const bad = []
  const RES = [
    /\b(mkdirSync|rmSync|rmdirSync|writeFileSync)\s*\(\s*GITDIR\b/g,
    /\bcpSync\s*\([^,()]+,\s*GITDIR\b/g,
  ]
  for (const RE of RES) {
    for (const m of src.matchAll(RE)) {
      // 注释行不算写点:守卫自己的头注里逐字写着事故链「每 10 秒 cpSync(BACKUP, GITDIR) 一次」,
      // 不排注释就会把那行当违规(实测第一版即此型)—— 锁若建在字符串巧合上,下一步就是被人放松判据。
      const lineStart = src.lastIndexOf('\n', m.index) + 1
      if (/^\s*(?:\*|\/\/|\/\*)/.test(src.slice(lineStart, m.index))) continue
      const fnStart = src.lastIndexOf('\nfunction ', m.index)
      const body = fnStart < 0 ? src.slice(0, m.index) : src.slice(fnStart, m.index)
      const fn = (body.match(/function\s+([A-Za-z0-9_]+)/) || [, '?'])[1]
      if (!/gitdirTargetSafe\s*\(\s*\)/.test(body)) bad.push({ at: m.index, call: m[1] || 'cpSync->', fn })
    }
  }
  return bad.sort((a, b) => a.at - b.at)
}

describe('形状锁 — 指针形态机上不得出现对 GITDIR 的裸写', () => {
  it('现读:每一处 GITDIR 破坏性写都排在守卫之后', () => {
    const sites = [...SRC.matchAll(/\b(?:mkdirSync|rmSync|rmdirSync|writeFileSync)\s*\(\s*GITDIR\b/g)].length
    assert.ok(sites >= 2, `夹具前提:面上应有 >=2 处 GITDIR 破坏性写(实测 ${sites}),少于这个数说明写点被删而锁在空转`)
    assert.deepEqual(unguardedGitdirWrites(SRC), [], '出现未过守卫的 GITDIR 写 ⇒ 25MB 备份灌进指针文件那一型复活')
  })
  it('变异对照:摘掉一处守卫,锁必须立刻点名(否则上一条是恒绿断言)', () => {
    const mutated = SRC.replace('if (!gitdirTargetSafe()) return false', 'if (false) return false')
    assert.notEqual(mutated, SRC, '变异没打到文本 ⇒ 先修夹具再谈判据')
    const bad = unguardedGitdirWrites(mutated)
    assert.ok(bad.length >= 1, '摘掉守卫后锁没喊 ⇒ 这条形状锁无牙(恒真断言比没有断言更糟)')
    assert.ok(bad.some((b) => b.fn === 'healFromBackup'), `应点名 healFromBackup,实得 ${JSON.stringify(bad)}`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
