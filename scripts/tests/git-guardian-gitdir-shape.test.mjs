// 镜像测试:gitdir-pointer 票 · 本席(gitdir-pointer-chair)收的格 ——
// 「恢复面从只认目录形态改成按当次实测的 gitdir 形态分派」+「失效方向 = 多要一次定向说明,
// 绝不是多放一次跳门」(AGENTS §0.10)。
//
// 立因(现读,§5b:gitdir 形态属七类必须每次现读的机器事实,不得把任何一台机的形态写进判据):
// 旧 `gitdirTargetSafe()` 把 `samePath(GITDIR, POINTER)` 无条件当"自指损坏态"输入 ——
// 目录形态机(工作区 `.git` 本身是实体目录,本机当次实测即此型;`resolveGitdir` 对健康目录形态
// 仓恒返回 `<wt>/.git`)上该判据恒真,整条恢复阶梯 healFromBackup/healFromRemote 对这类机
// 永久死锁,报错文案还把合法布局说成「先修 gitdir.mjs 的解析」。真自指损坏态(2026-09-23 那型,
// 即 2026-10-16 25MB 灌指针事故的根)的实测特征是「路径相同 ∧ 存在 ∧ 不是目录」,只有那一型禁写。
//
// §22c:判据一律 import 源脚本 `__test__`,本文件零复制。§0.10/阳性对照:每条锁都配变异对照
// (摘掉本次修复 ⇒ 当场翻红),恒真断言比没有断言更糟。
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { __test__ as G } from '../git-guardian.mjs'
import { resolveGitdir, resolveWorktree } from '../lib/gitdir.mjs'

const { gitdirTargetVerdict, gitdirTargetVerdictFromFace } = G
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(path.resolve(HERE, '..', 'git-guardian.mjs'), 'utf8')

describe('gitdirTargetVerdictFromFace — 当次实测三事实的形态分派(唯一一份实现,§0.6)', () => {
  it('目录形态实测(pathsMatch ∧ exists ∧ isDirectory)⇒ 放行:目录形态机的恢复阶梯不得死锁', () => {
    const v = gitdirTargetVerdictFromFace({ pathsMatch: true, exists: true, isDirectory: true })
    assert.equal(
      v.ok,
      true,
      '旧接线在这一格恒拒(同路径无条件当自指)⇒ 目录形态机上 healFromBackup/healFromRemote 双双瘫痪;翻红即该型回潮',
    )
  })
  it('真自指损坏态(pathsMatch ∧ exists ∧ 不是目录)⇒ 照旧拒:写它 = 把备份灌进指针文件(2026-10-16 那型)', () => {
    const v = gitdirTargetVerdictFromFace({ pathsMatch: true, exists: true, isDirectory: false })
    assert.equal(v.ok, false)
    assert.match(v.why, /自指|指针文件自身/)
  })
  it('不同路径的既有维度一律不放松:缺 gitdir ⇒ 可建;存在但不是目录 ⇒ 拒;目录 ⇒ 放行', () => {
    assert.equal(gitdirTargetVerdictFromFace({ pathsMatch: false, exists: false }).ok, true)
    assert.equal(gitdirTargetVerdictFromFace({ pathsMatch: false, exists: true, isDirectory: false }).ok, false)
    assert.equal(gitdirTargetVerdictFromFace({ pathsMatch: false, exists: true, isDirectory: true }).ok, true)
  })
  it('分派只改"同路径"那一格的输入语义,四态其余判据与纯函数逐字同义(不另起一把尺子)', () => {
    // 非同路径时 FromFace 必须是纯 verdict 的直通:同一输入,同一结论
    for (const exists of [true, false]) {
      for (const isDirectory of [true, false]) {
        assert.deepEqual(
          gitdirTargetVerdictFromFace({ pathsMatch: false, exists, isDirectory }),
          gitdirTargetVerdict({ samePointer: false, exists, isDirectory }),
        )
      }
    }
    // 同路径 ∧ 缺在面上 ⇒ 交回纯判据的保守档(拒,不猜):失效方向是"多要一次说明",不是放行
    assert.equal(gitdirTargetVerdictFromFace({ pathsMatch: true, exists: false }).ok, false)
  })
})

describe('本机当次实测面 — 两型机器上恢复面都必须问得出答案(§5b,不写死任何一台机的形态)', () => {
  it('现读 GITDIR/POINTER 三事实喂进分派 ⇒ 判定必须给得出来(绿机上恒 ok)', () => {
    const wt = resolveWorktree()
    const gd = resolveGitdir(wt)
    const pointer = path.join(wt, '.git')
    const BSL = String.fromCharCode(92)
    const norm = (s) => String(s).split(BSL).join('/').toLowerCase()
    const exists = existsSync(gd)
    let isDirectory = false
    try {
      isDirectory = exists ? statSync(gd).isDirectory() : false
    } catch (e) {
      assert.fail(`未判定:GITDIR 形态读不出(${e && e.code})—— 测试不许把读不到记成通过,也不许记成自指`)
    }
    const v = gitdirTargetVerdictFromFace({ pathsMatch: norm(gd) === norm(pointer), exists, isDirectory })
    assert.equal(
      v.ok,
      true,
      `当次实测 pathsMatch=${norm(gd) === norm(pointer)}, exists=${exists}, isDirectory=${isDirectory} ⇒ ${v.why}`,
    )
  })
})

// ── 接线形状锁(§0.6 单源 + §0.10 失效方向),各配阳性对照(变异 ⇒ 翻红)──

function functionBody(src, name) {
  const m = src.match(new RegExp(`\\nfunction ${name}\\(\\)[\\s\\S]*?\\n\\}\\n`))
  assert.ok(m, `夹具前提:源码里找不到 function ${name} ⇒ 先修夹具再谈判据`)
  return m[0]
}

describe('形状锁 — 接线:同路径判定只许住在 FromFace 一处,调用方只喂实测事实', () => {
  it('现读:gitdirTargetSafe 走 FromFace;`samePointer:` 输入键全文件只许出现 1 次(FromFace 体内)', () => {
    const safe = functionBody(SRC, 'gitdirTargetSafe')
    assert.match(safe, /gitdirTargetVerdictFromFace\s*\(/, '恢复面没走形态分派出口 = 目录形态机死锁那一型回潮')
    assert.doesNotMatch(safe, /samePointer:/, '调用方自己拼 samePointer = 第二份形态判定(§0.6 单源被破)')
    const allSites = [...SRC.matchAll(/\bsamePointer:/g)].length
    assert.equal(allSites, 1, `samePointer: 输入键全文件应恰 1 处(FromFace 体内),实得 ${allSites}`)
  })
  it('变异对照(阳性对照):将旧接线原样放回 gitdirTargetSafe ⇒ 两把锁当场点名', () => {
    const anchor = 'v = gitdirTargetVerdictFromFace({'
    assert.ok(SRC.includes(anchor), '夹具前提:找不到分派调用点 ⇒ 先修夹具再谈判据')
    const mutated = SRC.replace(anchor, 'v = gitdirTargetVerdict({')
    const safe = functionBody(mutated, 'gitdirTargetSafe')
    assert.ok(
      !/gitdirTargetVerdictFromFace\s*\(/.test(safe) || /samePointer:/.test(safe),
      '变异没打到接线 ⇒ 上一条锁是装饰',
    )
  })
})

describe('形状锁 — 失效方向:拒绝恢复必须经派发口喊人(多要一次定向说明),不许只剩日志', () => {
  it('现读:gitdirTargetSafe 的两条拒绝路径(读不出 / 判拒)都真调用 notifyGuardRed', () => {
    const safe = functionBody(SRC, 'gitdirTargetSafe')
    const sites = [...safe.matchAll(/\bnotifyGuardRed\s*\(/g)].length
    assert.ok(
      sites >= 2,
      `拒绝档到人出口应 >=2 条(unreadable + 判拒),实得 ${sites} —— 该型表现正是"每台每次 git 写操作静默失败",零到人 = §0.10 违令`,
    )
    assert.match(safe, /dedupKey/, '到人信必须带稳定身份(§5e-1),不得退回措辞换指纹的旧档')
  })
  it('变异对照(阳性对照):摘掉体内全部 notifyGuardRed 调用 ⇒ 锁当场翻红', () => {
    const mutated = SRC.replace(
      new RegExp(`(\\nfunction gitdirTargetSafe\\(\\)[\\s\\S]*?)\\n(\\s*)notifyGuardRed\\(`, 'm'),
      '$1$2noopGuardRed(',
    )
    assert.notEqual(mutated, SRC, '变异没打到文本 ⇒ 先修夹具再谈判据')
    const safe = functionBody(mutated, 'gitdirTargetSafe')
    assert.ok(
      [...safe.matchAll(/\bnotifyGuardRed\s*\(/g)].length < 2,
      '摘掉到人出口后锁仍绿 ⇒ 这条锁无牙',
    )
  })
})
