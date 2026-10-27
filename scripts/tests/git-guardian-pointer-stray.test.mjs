// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 取证镜像:票面「git-guardian 的 `.git` 修复路径在"工作区 `.git` 是指针文件"那台机上失效」
// 的第③格(修复面)。2026-10-27 现读判定见文件末 `HEAD 前提对账` 一节 —— 票面点名的
// `EEXIST … mkdir` 那一型**在 HEAD 已不成立**(两条兜底恢复路径都排在 `gitdirTargetSafe()` 之后,
// 且 `resolveGitdir` 永不把指针文件自身当 gitdir),仍然活着的是**指针腿自己**:旧 `healPointer()`
// 无条件 `rmSync(POINTER)` + 覆盖,会把那枚 25MB 异形现场**静默删掉、零归档、零到人**。
//
// 判据一律 import 源脚本的 `__test__`(§22c:镜像禁止复制第二份判据);形态一律在 scratch 夹具上
// **真跑**(§15b 唯一夹具出口,落点在工作区之外),不在活仓上演练(共享工作树,演练期间每条 git
// 命令都会失败而别的会话正在提交 —— 属 §8「高危操作必须暂停等人工」)。
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'

import { __test__ as G } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { parseGitdirPointer } from '../lib/gitdir.mjs'

const { GITFILE_MAX_BYTES, pointerFormVerdict, inspectGitdirPointer, gitdirRepairPlan, pointerContentOk, writeGitdirPointer } = G

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(resolve(HERE, '..', 'git-guardian.mjs'), 'utf8')
const LIB_SRC = readFileSync(resolve(HERE, '..', 'lib', 'gitdir.mjs'), 'utf8')

// ── 夹具 ──

const scratchDirs = []
const fixture = (prefix) => {
  const dir = mkScratch(prefix)
  scratchDirs.push(dir)
  return dir
}
after(() => {
  for (const d of scratchDirs) rmScratch(d, { bestEffort: true })
  scratchDirs.length = 0
})

/** 树快照:路径 + 字节数 + 内容,用于「这台机的这条路径不得回退」的逐字节对照 */
function treeSnapshot(root) {
  const out = []
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(dir, e.name)
      const r = `${rel}/${e.name}`
      if (e.isDirectory()) walk(p, r)
      else out.push(`${r}\u0000${statSync(p).size}\u0000${readFileSync(p, 'utf8')}`)
    }
  }
  walk(root, '')
  return out.join('\n')
}

const norm = (p) => resolve(String(p).replace(/\\/g, '/')).toLowerCase().replace(/\\/g, sep)
const isWithin = (parent, child) => {
  const pp = norm(parent)
  const cp = norm(child)
  return cp === pp || cp.startsWith(pp.endsWith(sep) ? pp : pp + sep)
}

/** 造一棵"指针形态"的假仓:工作树里躺 `.git` 指针,真身在**工作树之外** */
function makePointerFixture({ strayBytes = null, pointerText = null } = {}) {
  const root = fixture('gitdir-pointer-')
  const wt = join(root, 'FakeWt')
  const gitdir = join(root, 'FakeWt-git-repo') // 真身在工作树之外(§5b 设计)
  mkdirSync(wt, { recursive: true })
  for (const d of ['objects', 'refs']) mkdirSync(join(gitdir, d), { recursive: true })
  writeFileSync(join(gitdir, 'HEAD'), 'ref: refs/heads/main\n')
  if (strayBytes !== null) writeFileSync(join(wt, '.git'), Buffer.alloc(strayBytes, 0x78))
  else writeFileSync(join(wt, '.git'), pointerText ?? `gitdir: ${gitdir.replace(/\\/g, '/')}\n`)
  return { root, wt, gitdir, pointer: join(wt, '.git'), expected: `gitdir: ${gitdir.replace(/\\/g, '/')}\n` }
}

/** 从 openIdx 处的开括号扫到其配对闭括号(跳过字符串与注释;不解析正则字面量,被测函数体内没有) */
function matchBalanced(s, openIdx) {
  const open = s[openIdx]
  const close = open === '(' ? ')' : open === '[' ? ']' : '}'
  let depth = 0
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i]
    const nx = s[i + 1]
    if (c === '/' && nx === '/') {
      const nl = s.indexOf('\n', i)
      if (nl < 0) return s.length
      i = nl
      continue
    }
    if (c === '/' && nx === '*') {
      const end = s.indexOf('*/', i + 2)
      if (end < 0) return s.length
      i = end + 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      for (let j = i + 1; j < s.length; j++) {
        if (s[j] === '\\') {
          j++
          continue
        }
        if (s[j] === c) {
          i = j
          break
        }
      }
      continue
    }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * 顶层函数体(先配对参数括号的 `)`,再取紧随其后的 `{…}` ⇒ 多行解构签名不会被参数表的
 * 第 0 列 `}` 截断 —— 首版正是栽在这一格(实测取到 272 字节的半截体,锁在空转)。
 */
function fnBody(src, name, mutated = null) {
  const S = mutated ?? src
  const m = new RegExp(`\\n(?:export\\s+)?function\\s+${name}\\s*\\(`).exec(S)
  assert.ok(m, `夹具前提:面上应存在顶层函数 ${name}(取不到 ⇒ 锁在空转)`)
  // m[0] 含前导 `\n`(m.index 就指在那个换行符上)⇒ 绝对位置 = m.index + indexOf,不得再 +1
  // (首版 +1 把开括号挪了一格:轻则 parenChar 落在别处、体取成半截,重则所有锁空转)。
  const parenIdx = m.index + m[0].indexOf('(')
  const parenEnd = matchBalanced(S, parenIdx)
  assert.equal(S[parenIdx], '(', `夹具前提:${name} 的开括号定位漂了(实得 ${JSON.stringify(S[parenIdx])})`)
  assert.ok(parenEnd > 0, `夹具前提:${name} 的参数括号没配平`)
  const braceIdx = S.indexOf('{', parenEnd)
  assert.ok(braceIdx > 0, `夹具前提:${name} 的体起点找不到`)
  const bodyEnd = matchBalanced(S, braceIdx)
  assert.ok(bodyEnd > braceIdx, `夹具前提:${name} 的体没配平`)
  return S.slice(braceIdx + 1, bodyEnd)
}

// ── ① 判据:五态各归各(纯函数构造面) ──

describe('pointerFormVerdict — 修复面两形态五态分流', () => {
  it('无 .git ⇒ 直接落指针,不产归档', () => {
    const v = pointerFormVerdict({ exists: false })
    assert.equal(v.state, 'absent')
    assert.equal(v.action, 'write')
    assert.equal(v.archives, false)
  })
  it('合法 gitfile 指针 ⇒ 直接重写,不产归档(一行文本没有损失风险)', () => {
    const v = pointerFormVerdict({ exists: true, pointerTarget: 'D:/Other/x-git-repo' })
    assert.equal(v.state, 'valid-pointer')
    assert.equal(v.action, 'write')
    assert.equal(v.archives, false)
  })
  it('普通文件而内容不含 gitdir: ⇒ 形态不认识 ⇒ 必须先归档现场', () => {
    const v = pointerFormVerdict({ exists: true, pointerTarget: parseGitdirPointer('ÿØÿ\u0000 不是指针'), preview: 'ÿØÿ\u0000' })
    assert.equal(v.state, 'stray-file')
    assert.equal(v.action, 'archive-then-write')
    assert.equal(v.archives, true)
    assert.match(v.why, /形态不认识/)
  })
  it(`体积超 gitfile 上限(${GITFILE_MAX_BYTES})⇒ 同归 stray,且不必读内容(25MB 那一型)`, () => {
    const v = pointerFormVerdict({ exists: true, sizeBytes: 25433594 })
    assert.equal(v.state, 'stray-file')
    assert.equal(v.archives, true)
    assert.match(v.why, /25,433,594|不可能是合法指针/)
  })
  it('目录形态(本机)⇒ 拒绝动它,既不写也不归档', () => {
    const v = pointerFormVerdict({ exists: true, isDirectory: true })
    assert.equal(v.state, 'directory')
    assert.equal(v.action, 'refuse')
    assert.equal(v.writes, false)
    assert.match(v.why, /删库/)
  })
  it('形态读不出来 ⇒ 显式未判定并点名原因(§0.3:不记绿也不冒红)', () => {
    const v = pointerFormVerdict({ unreadable: true, reason: 'stat EACCES' })
    assert.equal(v.state, 'unreadable')
    assert.equal(v.action, 'refuse')
    assert.equal(v.writes, false)
    assert.match(v.why, /未判定/)
    assert.match(v.why, /EACCES/)
  })
})

// ── ② 现读形态:在 scratch 夹具上真跑 ──

describe('inspectGitdirPointer — 形态现读(票面要求"修复前先现问形态")', () => {
  it('指针文件 ⇒ valid-pointer,并解出目标', () => {
    const f = makePointerFixture()
    const v = inspectGitdirPointer(f.pointer)
    assert.equal(v.state, 'valid-pointer')
    assert.ok(
      v.why.includes(f.gitdir.replace(/\\/g, '/')),
      `why 必须点名解析出的目标,实得:${v.why}`,
    )
  })
  it('小文件而内容不含 gitdir: ⇒ stray-file(体积不到上限也得认出来)', () => {
    const f = makePointerFixture({ pointerText: '这不是指针内容\n' })
    const v = inspectGitdirPointer(f.pointer)
    assert.equal(v.state, 'stray-file')
    assert.equal(v.archives, true)
  })
  it('异形大文件 ⇒ stray-file(不读满 25MB 也判得出)', () => {
    const f = makePointerFixture({ strayBytes: GITFILE_MAX_BYTES + 1 })
    assert.equal(inspectGitdirPointer(f.pointer).state, 'stray-file')
  })
  it('.git 不存在 ⇒ absent', () => {
    const f = makePointerFixture()
    rmSync(f.pointer, { force: true })
    assert.equal(inspectGitdirPointer(f.pointer).state, 'absent')
  })
  it('目录形态 ⇒ directory(本机今天的面,指针腿不得靠近)', () => {
    const root = fixture('gitdir-pointer-')
    const wt = join(root, 'FakeWt')
    mkdirSync(join(wt, '.git', 'refs'), { recursive: true })
    writeFileSync(join(wt, '.git', 'HEAD'), 'ref: refs/heads/main\n')
    assert.equal(inspectGitdirPointer(join(wt, '.git')).state, 'directory')
  })
})

// ── ③ 修复面分流:目标在 ⇒ 只重写 gitfile;目标不在 ⇒ 才走恢复源 ──

describe('gitdirRepairPlan — 两形态分流的判序', () => {
  it('① 指针形态 + 目标在(骨架齐)⇒ rewrite-pointer,绝不进恢复源', () => {
    assert.equal(gitdirRepairPlan({ gitdirOk: true, pointerOk: false }), 'rewrite-pointer')
  })
  it('② 指针形态 + 目标不在 ⇒ restore-gitdir(这才轮到恢复源;归档纪律在恢复源与指针腿各自把关)', () => {
    assert.equal(gitdirRepairPlan({ gitdirOk: false, pointerOk: false }), 'restore-gitdir')
    // 真身坏了就是坏了,不得因为"指针也坏"就降级成只重写指针
    assert.notEqual(gitdirRepairPlan({ gitdirOk: false, pointerOk: true }), 'rewrite-pointer')
  })
  it('两面都好 ⇒ none;恢复面优先级恒高于指针面', () => {
    assert.equal(gitdirRepairPlan({ gitdirOk: true, pointerOk: true }), 'none')
    for (const g of [true, false]) for (const p of [true, false]) {
      const plan = gitdirRepairPlan({ gitdirOk: g, pointerOk: p })
      if (!g) assert.equal(plan, 'restore-gitdir', `gitdirOk=${g} pointerOk=${p} 应优先走恢复源`)
      else assert.equal(plan, p ? 'none' : 'rewrite-pointer', `gitdirOk=${g} pointerOk=${p}`)
    }
  })
})

// ── ④ 执行单元真跑(路径全入参,不碰活仓) ──

describe('writeGitdirPointer — 归档纪律与两形态处置(真跑)', () => {
  it('① 合法指针 + 真身在:只重写 gitfile,归档出口一次都不派生,真身树逐字节不变', () => {
    const f = makePointerFixture({ pointerText: 'gitdir: D:/别处/坏掉的旧位置\n' })
    const targetBefore = treeSnapshot(f.gitdir)
    let archiveCalls = 0
    const r = writeGitdirPointer({
      pointer: f.pointer,
      expectedPointer: f.expected,
      archiveNameFor: () => {
        archiveCalls += 1
        throw new Error('合法指针形态不该产归档')
      },
    })
    assert.equal(r.ok, true, r.why)
    assert.equal(r.state, 'valid-pointer')
    assert.equal(archiveCalls, 0, '合法指针 ⇒ 归档出口被派生 = 给每一次正常自愈留一份垃圾')
    assert.equal(readFileSync(f.pointer, 'utf8').trim(), f.expected.trim())
    assert.ok(targetBefore.length > 0, '夹具前提:真身里得有东西可对照')
    assert.equal(treeSnapshot(f.gitdir), targetBefore, '目标在那一格动了真身 ⇒ 23GB cpSync 那一型复活')
    // 临时件不得留在现场(§15)
    assert.deepEqual(readdirSync(f.wt), ['.git'], `夹具工作树根残留: ${readdirSync(f.wt)}`)
  })

  it('② 异形现场:先归档再落指针,归档落点必须在工作树之外且字节等于原现场', () => {
    const f = makePointerFixture({ strayBytes: GITFILE_MAX_BYTES + 512 })
    const raw = readFileSync(f.pointer)
    const archives = join(f.root, 'archives')
    const r = writeGitdirPointer({
      pointer: f.pointer,
      expectedPointer: f.expected,
      archiveNameFor: (tag) => join(archives, `.git.stray-${tag}`),
    })
    assert.equal(r.ok, true, r.why)
    assert.equal(r.state, 'stray-file')
    assert.ok(r.archived, 'stray 分支必须交出归档落点')
    assert.ok(!isWithin(f.wt, r.archived), `归档落在工作树内 ⇒ 会被下一次批量清理吃掉:${r.archived}`)
    assert.ok(existsSync(r.archived))
    assert.deepEqual(readFileSync(r.archived), raw, '归档必须逐字节等于被覆盖前的现场')
    assert.equal(readFileSync(f.pointer, 'utf8').trim(), f.expected.trim())
  })

  it('②b 归档落点取不到 ⇒ 拒绝覆盖:现场字节还在、指针没落、结论点名(既不冒已修好也不冒没救)', () => {
    const f = makePointerFixture({ strayBytes: GITFILE_MAX_BYTES + 8 })
    const raw = readFileSync(f.pointer)
    const notes = []
    const r = writeGitdirPointer({
      pointer: f.pointer,
      expectedPointer: f.expected,
      archiveNameFor: () => null,
      notify: (t) => notes.push(t),
    })
    assert.equal(r.ok, false)
    assert.equal(r.state, 'refused-no-archive')
    assert.match(r.why, /拒绝覆盖/)
    assert.deepEqual(readFileSync(f.pointer), raw, '拒绝覆盖却不留现场 ⇒ 那就是把唯一取证删了')
    assert.notEqual(readFileSync(f.pointer, 'utf8').trim(), f.expected.trim())
    assert.equal(notes.length, 1, '那一型此刻零到人出口 ⇒ 必须寄(§5e 单通道,由 notifyGuardRed 落)')
  })

  it('②c 归档落点与指针同目录(= 工作区根)⇒ 同样拒绝:§5b 明令不得把 .git* 留在一级目录', () => {
    const f = makePointerFixture({ strayBytes: GITFILE_MAX_BYTES + 8 })
    const raw = readFileSync(f.pointer)
    const r = writeGitdirPointer({
      pointer: f.pointer,
      expectedPointer: f.expected,
      archiveNameFor: (tag) => join(f.wt, `.git.broken-${tag}`),
    })
    assert.equal(r.ok, false)
    assert.equal(r.state, 'refused-no-archive')
    assert.match(r.why, /同目录|工作区根/)
    assert.deepEqual(readFileSync(f.pointer), raw)
    assert.deepEqual(readdirSync(f.wt), ['.git'], '拒绝覆盖时不得在根上留下归档残骸')
  })

  it('③ 目录形态(本机今天这条腿)⇒ 指针腿一步不动,整棵树逐字节等价', () => {
    const root = fixture('gitdir-pointer-')
    const wt = join(root, 'FakeWt')
    mkdirSync(join(wt, '.git', 'refs', 'heads'), { recursive: true })
    writeFileSync(join(wt, '.git', 'HEAD'), 'ref: refs/heads/main\n')
    writeFileSync(join(wt, '.git', 'config'), '[core]\n\tbare = false\n')
    writeFileSync(join(wt, '.git', 'refs', 'heads', 'main'), `${'0'.repeat(40)}\n`)
    const before = treeSnapshot(wt)
    const r = writeGitdirPointer({
      pointer: join(wt, '.git'),
      expectedPointer: 'gitdir: X:/不该存在的位置\n',
      archiveNameFor: () => {
        throw new Error('目录形态不该派生归档')
      },
    })
    assert.equal(r.ok, false)
    assert.equal(r.state, 'directory')
    assert.equal(r.archived, null)
    assert.equal(treeSnapshot(wt), before, '本机形态回退一个字节 = 拿 8 端换一台机的判据')
  })

  it('未判定支(形态读不出来)⇒ 让路 + 寄到人,现场与指针都不动', () => {
    const f = makePointerFixture({ strayBytes: 16 })
    const raw = readFileSync(f.pointer)
    const notes = []
    const r = writeGitdirPointer({
      pointer: f.pointer,
      expectedPointer: f.expected,
      inspect: () => pointerFormVerdict({ unreadable: true, reason: 'stat EIO 演练' }),
      notify: (t) => notes.push(t),
    })
    assert.equal(r.ok, false)
    assert.equal(r.state, 'unreadable')
    assert.deepEqual(readFileSync(f.pointer), raw)
    assert.deepEqual(notes, ['.git 形态无法判定(指针腿未判定)'])
  })

  it('回读尺子 pointerContentOk:两侧都归一,不一致必须判不一致(不得把"写了"当"修好了")', () => {
    const f = makePointerFixture()
    assert.equal(pointerContentOk(f.expected, f.expected), true)
    assert.equal(pointerContentOk('gitdir: A\n', 'gitdir: B\n'), false, '尺子恒真 ⇒ 上面每一条 ok=true 都是空口白话')
    assert.equal(pointerContentOk('  gitdir: A  \n', 'gitdir: A\n'), true, '尾随换行/空白不该被当成故障')
    assert.equal(pointerContentOk(null, 'gitdir: A\n'), false)
    // 真跑:落盘后再问一次盘面,必须与期望逐字相等(executor 的 ok 就是这条尺子给的)
    const r = writeGitdirPointer({ pointer: f.pointer, expectedPointer: f.expected })
    assert.equal(r.ok, true, r.why)
    assert.equal(pointerContentOk(readFileSync(f.pointer, 'utf8'), f.expected), true)
    assert.equal(
      /ok = pointerContentOk\(readFileSync\(pointer, 'utf8'\), expectedPointer\)/.test(fnBody(SRC, 'writeGitdirPointer')),
      true,
      '执行单元的 ok 不再来自回读 ⇒ "写了 ≠ 修好了"那一型复活',
    )
  })
})

// ── ⑤ 形状锁 + 变异自证(摘掉新分支必翻红) ──

describe('形状锁 — 指针腿的现场纪律与两形态分流不得被绕过', () => {
  const locks = {
    // 指针腿必须走执行单元,不得再出现对 POINTER 的裸 rmSync(那枚 25MB 现场就是被它删掉的)
    pointerLegUsesExecutor: (s) => {
      const body = fnBody(s, 'healPointer')
      const bad = []
      if (!/writeGitdirPointer\s*\(/.test(body)) bad.push({ fn: 'healPointer', why: '没走执行单元 ⇒ 现场归档纪律整体失效' })
      if (/\brmSync\s*\(\s*POINTER\b/.test(body)) bad.push({ fn: 'healPointer', why: '出现对 POINTER 的裸 rmSync ⇒ 异形现场被静默删掉那一型复活' })
      if (!/archiveNameFor\s*:/.test(body)) bad.push({ fn: 'healPointer', why: '没接归档落点出口 ⇒ 归档会退到工作区根(§5b)' })
      return bad
    },
    // 本机那条腿必须逐字原样在场(一字不许改,改了就是拿 8 端换一台机)
    legacyDirectoryLegIntact: (s) => {
      const body = fnBody(s, 'healPointer')
      const LEGACY = "  if (!needsGitdirPointer()) {\n    log('修复跳过: 当前为常规仓库(.git 即 gitdir 目录),无需也不应重建指针文件')\n    return true\n  }"
      return body.includes(LEGACY) ? [] : [{ fn: 'healPointer', why: '本机(目录形态)早退腿被改写 ⇒ 本机路径回退风险' }]
    },
    // 归档必须先于删除/覆盖出现在执行单元体内
    archiveBeforeDestroy: (s) => {
      const body = fnBody(s, 'writeGitdirPointer')
      const atArchive = body.search(/\bcpSync\s*\(\s*pointer\s*,\s*dst\b/)
      const atDestroy = body.search(/\brmSync\s*\(\s*pointer\b/)
      if (atArchive < 0) return [{ fn: 'writeGitdirPointer', why: '没有现场归档动作 ⇒ stray 分支被摘掉' }]
      if (atDestroy < 0) return [{ fn: 'writeGitdirPointer', why: '指针覆盖动作不见了 ⇒ 先核对夹具再谈判据' }]
      if (atArchive > atDestroy) return [{ fn: 'writeGitdirPointer', why: '归档排在覆盖之后 ⇒ 覆盖失败时现场已经没了' }]
      return []
    },
    // 修复面两形态分流必须由那把纯判据给结论,不得退回两条裸 if
    remediateUsesPlan: (s) => {
      const body = fnBody(s, 'remediate')
      const bad = []
      if (!/gitdirRepairPlan\s*\(/.test(body)) bad.push({ fn: 'remediate', why: '判序退回裸 if ⇒ 两形态分流无从取证' })
      if (/if\s*\(\s*!before\.gitdirOk\s*\)/.test(body) || /if\s*\(\s*!before\.pointerOk\s*\)/.test(body))
        bad.push({ fn: 'remediate', why: '仍在原地各判各的(旧形)⇒ 与 gitdirRepairPlan 双份判据,必漂移(§0.6)' })
      return bad
    },
    // 指针腿不得对 GITDIR 动手(①那一格:目标在时最坏的出路就是把整份备份灌下去)
    pointerLegNeverTouchesGitdir: (s) => {
      const bad = []
      for (const fn of ['healPointer', 'writeGitdirPointer']) {
        const body = fnBody(s, fn)
        if (/\b(mkdirSync|rmSync|rmdirSync|writeFileSync)\s*\(\s*GITDIR\b/.test(body) || /\bcpSync\s*\([^,()]+,\s*GITDIR\b/.test(body))
          bad.push({ fn, why: '指针腿里出现对 GITDIR 的写 ⇒ rewrite-pointer 那一格失守' })
      }
      return bad
    },
  }

  for (const [name, lock] of Object.entries(locks)) {
    it(`现读:${name}`, () => {
      assert.deepEqual(lock(SRC), [], `${name} 失守`)
    })
  }

  it('夹具自证:函数体提取器取到的是整截(提取器坏了 ⇒ 上面每一条都是空转的绿)', () => {
    const ex = fnBody(SRC, 'writeGitdirPointer')
    assert.ok(ex.includes('cpSync(pointer, dst)'), `执行单元体应含现场归档动作,实得 ${ex.length} 字节`)
    assert.ok(ex.includes('rmSync(pointer, { recursive: true, force: true })'))
    assert.ok(ex.includes('return { ok, state: v.state, archived, why: v.why }'), '体尾必须在场 ⇒ 截断即点名')
    const hp = fnBody(SRC, 'healPointer')
    assert.ok(hp.includes('notify: (title, detail) => notifyGuardRed(title, detail)'), 'healPointer 体被截断')
    assert.ok(fnBody(SRC, 'remediate').includes('if (!refsOk()) healRefs()'), 'remediate 体被截断')
    assert.ok(fnBody(SRC, 'resolveGitdir', LIB_SRC).includes('siblingGitdir(wt)'), 'lib 侧体被截断')
  })

  it('变异自证:逐条摘掉新增分支,对应锁必须点名(否则上面的绿是恒真断言)', () => {
    const mutations = [
      { why: '指针腿退回裸覆盖', from: '  const r = writeGitdirPointer({', to: '  const r = { ok: true, state: "legacy", archived: null }; void POINTER; {' },
      { why: '本机早退腿被改字', from: '修复跳过: 当前为常规仓库(.git 即 gitdir 目录),无需也不应重建指针文件', to: '修复跳过' },
      { why: '现场归档挪到覆盖之后', from: '      cpSync(pointer, dst)', to: '      void 0' },
      { why: '判序退回裸 if', from: '  const plan = gitdirRepairPlan({ gitdirOk: before.gitdirOk, pointerOk: before.pointerOk })', to: '  const plan = before.gitdirOk ? (before.pointerOk ? "none" : "rewrite-pointer") : "restore-gitdir"' },
    ]
    for (const m of mutations) {
      const mutated = SRC.replace(m.from, m.to)
      assert.notEqual(mutated, SRC, `变异没打到文本(${m.why})⇒ 先修夹具再谈判据`)
      const tripped = Object.entries(locks)
        .filter(([, lock]) => {
          try {
            return lock(mutated).length > 0
          } catch {
            return true // 锁连体都取不到 ⇒ 同样算点名
          }
        })
        .map(([k]) => k)
      assert.ok(tripped.length >= 1, `摘掉「${m.why}」后没有任何锁喊 ⇒ 这组锁无牙`)
    }
  })

  it('单一真相源:`gitdir:` 解析在 lib 里只许一份实现(§0.6)', () => {
    const sites = [...LIB_SRC.matchAll(/\/\^gitdir:/g)].map((m) => m.index)
    assert.equal(sites.length, 1, `lib/gitdir.mjs 里出现 ${sites.length} 份内联 gitdir 解析(应恰为 parseGitdirPointer 那一份)`)
    assert.match(fnBody(LIB_SRC, 'resolveGitdir'), /parseGitdirPointer\s*\(/, 'resolveGitdir 应 import 自己的那一份,而不是再抄一条正则')
  })
})

// ── ⑥ HEAD 前提对账(写给下一个人,免得再核一遍) ──

describe('票面前提对账(2026-10-27 现读)', () => {
  it('两条兜底恢复路径仍排在 gitdirTargetSafe 之后 ⇒ 票面③的 EEXIST-mkdir 那一型在 HEAD 不成立', () => {
    for (const fn of ['healFromBackup', 'healFromRemote']) {
      const body = fnBody(SRC, fn)
      assert.match(body, /gitdirTargetSafe\s*\(\s*\)/, `${fn} 的守卫被摘掉了 ⇒ 那型复活`)
      const guard = body.search(/gitdirTargetSafe\s*\(\s*\)/)
      const mkdir = body.search(/\bmkdirSync\s*\(\s*GITDIR\b/)
      if (mkdir >= 0) assert.ok(guard < mkdir, `${fn}:mkdir 排到了守卫之前`)
    }
  })
  it('resolveGitdir 永不把指针文件自身当 gitdir(自指那一格仍在位)', () => {
    assert.match(fnBody(LIB_SRC, 'resolveGitdir'), /statSync\(pointer\)\.isDirectory\(\)/)
    assert.doesNotMatch(fnBody(LIB_SRC, 'resolveGitdir'), /return normalizePath\(pointer\)\s*\n\s*}\s*\n\s*return siblingGitdir/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
