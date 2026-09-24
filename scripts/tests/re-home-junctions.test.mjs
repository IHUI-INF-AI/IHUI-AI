// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §26 改道修复器镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 重点不是"函数返回什么",而是**真做一次端到端改道**:建真目录、写真文件、robocopy、
 * 校验、改名、mklink /J、经 junction 回读、删 stash —— 全在临时夹具里跑完并断言。
 * 因为这类工具的失败形态是"路径直接消失"(§26 记过),只有装车才暴露得出来。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { __test__ as R } from '../re-home-junctions.mjs'
import { __test__ as GATE96 } from '../check-home-junctions.mjs'

const { audit } = GATE96

const CMD = 'C:\\Windows\\System32\\cmd.exe'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ihui-rehome-it-'))
  const src = join(root, 'src', '.demo')
  const dst = join(root, 'dst', '.demo')
  mkdirSync(join(src, 'nested'), { recursive: true })
  writeFileSync(join(src, 'a.txt'), 'hello', 'utf8')
  writeFileSync(join(src, 'nested', 'b.bin'), Buffer.alloc(2048, 7))
  return { root, src, dst }
}

test('端到端:真复制 + 真建 junction + 经链接回读一致 + stash 已删', () => {
  const { root, src, dst } = fixture()
  try {
    const res = R.repairOne(src, dst)
    assert.equal(res.action, 'moved', res.note)
    assert.ok(lstatSync(src).isSymbolicLink(), '源必须已变成 junction')
    assert.equal(readFileSync(join(src, 'a.txt'), 'utf8'), 'hello', '经 junction 必须读得到内容')
    assert.equal(statSync(join(src, 'nested', 'b.bin')).size, 2048)
    assert.ok(existsSync(join(dst, 'a.txt')), 'D 侧目标必须真在位')
    assert.ok(!existsSync(`${src}.pre-junction-`), 'stash 前缀目录不应残留')
    // 关键:删 stash 不得穿透 junction 把 D 盘内容带走(§26 头号危险)
    assert.equal(
      R.fingerprintTree(dst).size,
      2,
      'D 侧内容被递归删除穿透了 —— junction 只能断链,不许穿透删',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('目标里有上次失败留下的残留:只清目标、绝不动源,清完必须收敛', () => {
  const { root, src, dst } = fixture()
  try {
    mkdirSync(join(dst, 'nested'), { recursive: true })
    writeFileSync(join(dst, 'a.txt'), 'hello', 'utf8')
    writeFileSync(join(dst, 'nested', 'b.bin'), Buffer.alloc(2048, 7))
    writeFileSync(join(dst, 'rogue.txt'), 'extra', 'utf8') // 本工具上一次失败留在目标里的残留
    const res = R.repairOne(src, dst)
    assert.equal(res.action, 'moved', `残留被清掉后应当收敛,实际:${res.action} / ${res.note}`)
    assert.ok(lstatSync(src).isSymbolicLink(), '源必须已变成 junction')
    assert.equal(readFileSync(join(src, 'a.txt'), 'utf8'), 'hello', '源内容必须完好')
    assert.ok(!existsSync(join(dst, 'rogue.txt')), '残留只允许从**目标**清掉')
    assert.equal(R.fingerprintTree(dst).size, 2, '目标最终必须与源逐文件一致')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('字节不同 = 真没复制对,不得当成残留清掉后硬收敛(判据必须分得清两种失败)', () => {
  const { root, src } = fixture()
  try {
    const d = R.diffFingerprint(
      R.fingerprintTree(src),
      new Map([
        ['a.txt', 999],
        ['nested/b.bin', 2048],
      ]),
    )
    assert.deepEqual(d.differ, ['a.txt'], '字节不同必须归入 differ,而不是 onlyB')
    assert.equal(d.onlyA.length, 0)
    assert.equal(d.onlyB.length, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('dry 模式零副作用:不建目标、不改源', () => {
  const { root, src, dst } = fixture()
  try {
    const res = R.repairOne(src, dst, { dry: true })
    assert.equal(res.action, 'would-move')
    assert.ok(!existsSync(dst), 'dry 不得创建目标')
    assert.ok(statSync(src).isDirectory() && !lstatSync(src).isSymbolicLink(), 'dry 不得改源')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('幂等:改道完成后再跑一次,必须报"已是指针"而不是重复搬', () => {
  const { root, src, dst } = fixture()
  try {
    assert.equal(R.repairOne(src, dst).action, 'moved')
    const again = R.repairOne(src, dst)
    assert.equal(again.action, 'link', again.note)
    assert.ok(again.ok)
    assert.equal(readFileSync(join(src, 'a.txt'), 'utf8'), 'hello', '二次运行不得破坏已改道结果')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('清单与盘符都复用既有真相源(不得自带第二份)', () => {
  const src = readFileSync(new URL('../re-home-junctions.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /import \{[^}]*\bregistryOf\b[^}]*\} from '\.\/check-home-junctions\.mjs'/,
    '登记表必须来自门 96',
  )
  assert.match(
    src,
    /import \{[^}]*\bfindStashes\b[^}]*\} from '\.\/check-home-junctions\.mjs'/,
    'stash 枚举必须复用门 96 的那一份(抄第二份必然漂移)',
  )
  assert.doesNotMatch(src, /^export function findStashes\(/m, '修复器里不得另写一份 findStashes')
  assert.match(
    src,
    /import \{ devEnvRoot \} from '\.\/seal-c-root-stray\.mjs'/,
    'D 盘根必须复用 devEnvRoot()',
  )
  // 抄一份清单的指纹是"字面量条目对象";plan 必须是对 registry 的 map
  assert.doesNotMatch(src, /\{\s*p:\s*join\(\s*home/, '不得在修复器里另列家目录项')
  assert.match(src, /registry\.map\(/, 'plan 必须由 registryOf() 推导')
  // 盘符不得写死在**生产路径推导**里(自检夹具里的 'D:\DevEnv' 是假数据,不算)
  const prod = src.slice(0, src.indexOf('function selfTest'))
  assert.doesNotMatch(prod, /['"]D:[\\/]/, '生产代码不得写死 D 盘符,必须走 devEnvRoot()')
  assert.match(prod, /devEnv = devEnvRoot\(\)/, 'plan 的默认根必须是 devEnvRoot()')
})

test('所有派生都带 windowsHide(§5b 禁弹窗)', () => {
  const src = readFileSync(new URL('../re-home-junctions.mjs', import.meta.url), 'utf8')
  const spawns = [...src.matchAll(/spawnSync\(/g)].length
  const hides = [...src.matchAll(/windowsHide: true/g)].length
  assert.ok(spawns > 0 && hides >= spawns, `spawnSync ${spawns} 处 / windowsHide ${hides} 处`)
})

test('真机 cmd 可用(mklink 走的是绝对路径 cmd.exe,不依赖 PATH)', () => {
  const r = spawnSync(CMD, ['/c', 'ver'], { windowsHide: true, timeout: 30000, encoding: 'utf8' })
  assert.equal(r.status, 0, `cmd.exe 绝对路径不可用:${r.error?.message}`)
})

test('冷却表:文件缺失/坏 JSON 一律退回空表,不得抛(守护链上抛错等于整轮不修)', () => {
  assert.deepEqual(R.readCooldown(join(tmpdir(), 'ihui-no-such-cooldown-file.json')), {})
  const root = mkdtempSync(join(tmpdir(), 'ihui-rehome-cool-'))
  try {
    const bad = join(root, 'cool.json')
    writeFileSync(bad, '{not json', 'utf8')
    assert.deepEqual(R.readCooldown(bad), {})
    writeFileSync(bad, '{"C:\\\\Users\\\\x\\\\.codex":99999999999999}', 'utf8')
    assert.equal(Object.keys(R.readCooldown(bad)).length, 1, '正常表必须读得出来')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('装车证明:守护每轮真的会触发修复器,且修复器真的会跳过冷却中的项', () => {
  const guard = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
  assert.match(guard, /function healHomeJunctions\(\)/, '守护里必须有这一层自愈')
  assert.match(guard, /call\(fixer, \['--apply'\]/, '判红后必须真的调修复器')
  assert.match(
    guard,
    /if \(!CHECK_ONLY\) healHomeJunctions\(\)/,
    '挂点必须在早退之前(--check 挂这里等于永不执行)',
  )
  const fixer = readFileSync(new URL('../re-home-junctions.mjs', import.meta.url), 'utf8')
  assert.match(fixer, /cool\[it\.src\] > now/, 'main 必须先查冷却再决定是否重抄')
  assert.match(fixer, /action: 'cooldown'/, '被跳过的项必须如实报 cooldown,不得静默')
  // 冷却不得吞掉人工窗口:跳过与"新添冷却"两处都必须被 !noCooldown 门住
  assert.match(fixer, /apply && !noCooldown && cool\[it\.src\] > now/, '--no-cooldown 必须真能绕过冷却判定')
  assert.match(fixer, /apply && !noCooldown && \(rows\.at\(-1\)\.action === 'rename-failed'/, '--no-cooldown 失败时不得再续冷却,否则下一个人工窗口照样被拦')
})

test('改道树被外部删掉(junction 悬空)⇒ 门 96 判红必须被自愈收口', () => {
  const { root, src, dst } = fixture()
  const fakeRegistry = [{ p: src, why: '夹具:模拟 §26 改道项' }]
  try {
    assert.equal(R.repairOne(src, dst).action, 'moved', '先造出"已改道"的正常态')
    assert.equal(audit(fakeRegistry).violations.length, 0, '前置条件:改道完成时门必须是绿的')

    rmSync(dst, { recursive: true, force: true }) // 模拟 D:\DevEnv\cache 被外部整体清掉
    const red = audit(fakeRegistry).violations
    assert.equal(red.length, 1, '悬空必须判红(否则本例是在验证"看不见问题")')
    assert.equal(red[0].kind, 'DANGLING', `要验的是悬空这一型,实际:${red[0].kind}`)

    const res = R.repairOne(src, dst)
    assert.equal(res.action, 'target-recreated', `必须真的重建目标而非早退,实际:${res.action} / ${res.note}`)
    assert.ok(res.ok, res.note)
    assert.ok(existsSync(dst), '目标目录必须回到位')
    assert.ok(lstatSync(src).isSymbolicLink(), '只许补目标,不得把用户的链接删掉')
    assert.equal(audit(fakeRegistry).violations.length, 0, '修完门必须转绿 —— 红→修→绿 不闭合等于没有自愈')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('repairOne 的判序:isLink 必须在 existsSync(src) 之前(悬空 junction 的 existsSync 是 false)', () => {
  const src = readFileSync(new URL('../re-home-junctions.mjs', import.meta.url), 'utf8')
  const body = src.slice(src.indexOf('export function repairOne'), src.indexOf('const before = fingerprintTree'))
  const iLink = body.indexOf('if (isLink(srcPath))')
  const iExists = body.indexOf('if (!existsSync(srcPath))')
  assert.ok(iLink >= 0, '必须先判 isLink')
  assert.ok(iExists > iLink, `existsSync(absent) 早退必须排在 isLink 之后,实际 isLink@${iLink} exists@${iExists}`)
})

/**
 * 2026-09-24 实测:`C:\Users\Administrator\.trae-cn` 搬完之后,家目录里仍挂着
 * `.trae-cn.pre-junction-2026-09-24T08-41-30-024Z`,而它自己又是一个**指向在用目标的 junction**。
 * 原来那条"stash 不残留"的断言查的是 `${src}.pre-junction-`(不带时间戳的字面名),而真名永远
 * 带 ISO 时间戳 ⇒ **该断言从写下那天起就恒真**,所以残留攒在家目录里没有任何一处知道。
 * 这里换成按前缀枚举,并给每一型配正/反对照(link 断链 / 目录须证明无独有内容 / 判不准就不删)。
 */
test('stash 清理按类型分流,且断链绝不穿透目标内容', () => {
  const root = mkdtempSync(join(tmpdir(), 'ihui-stash-it-'))
  const home = join(root, 'home')
  const dst = join(root, 'dstside')
  try {
    mkdirSync(home, { recursive: true })
    mkdirSync(join(dst, 'sub'), { recursive: true })
    writeFileSync(join(dst, 'k.txt'), '12345', 'utf8')
    writeFileSync(join(dst, 'sub', 'x.bin'), '1234567', 'utf8')
    const src = join(home, '.demo')
    spawnSync('cmd.exe', ['/c', 'mklink', '/J', src, dst], { windowsHide: true, timeout: 20000 })
    assert.ok(lstatSync(src).isSymbolicLink(), '夹具没建起来:src 不是指针')

    const linkStash = join(home, '.demo.pre-junction-2026-01-01T00-00-00-000Z')
    spawnSync('cmd.exe', ['/c', 'mklink', '/J', linkStash, dst], {
      windowsHide: true,
      timeout: 20000,
    })
    const covered = join(home, '.demo.pre-junction-2026-01-02T00-00-00-000Z')
    mkdirSync(join(covered, 'sub'), { recursive: true })
    writeFileSync(join(covered, 'k.txt'), 'abcde', 'utf8') // 字节数与在用内容等 ⇒ 同指纹
    writeFileSync(join(covered, 'sub', 'x.bin'), 'abcdefg', 'utf8')
    const unique = join(home, '.demo.pre-junction-2026-01-03T00-00-00-000Z')
    mkdirSync(unique, { recursive: true })
    writeFileSync(join(unique, 'k.txt'), '12345', 'utf8')
    writeFileSync(join(unique, 'not-in-use.bin'), 'only-here', 'utf8')
    const bare = join(home, '.demo.pre-junction-2026-01-04T00-00-00-000Z.txt')
    writeFileSync(bare, 'x', 'utf8')
    const decoy = join(home, '.demo.not-a-stash') // 名字不匹配前缀,内容还独有一份
    mkdirSync(decoy, { recursive: true })
    writeFileSync(join(decoy, 'precious.bin'), 'do-not-touch', 'utf8')

    assert.deepEqual(
      R.findStashes(src).map((p) => p.slice(home.length + 1)),
      [
        '.demo.pre-junction-2026-01-01T00-00-00-000Z',
        '.demo.pre-junction-2026-01-02T00-00-00-000Z',
        '.demo.pre-junction-2026-01-03T00-00-00-000Z',
        '.demo.pre-junction-2026-01-04T00-00-00-000Z.txt',
      ],
      '枚举必须恰好命中这 4 个前缀项(decoy 不得混进来)',
    )

    const dry = R.pruneStashes(src, dst, { apply: false })
    assert.ok(
      dry.every((r) => r.action === 'would-prune' || r.action === 'kept'),
      `只判模式出现动作:${JSON.stringify(dry)}`,
    )
    assert.ok(
      [linkStash, covered, unique, bare, decoy].every((p) => existsSync(p)),
      '只判模式就动了盘',
    )

    const rows = R.pruneStashes(src, dst, { apply: true })
    const byPath = new Map(rows.map((r) => [r.path, r]))
    assert.equal(byPath.get(linkStash).action, 'pruned', 'link 型未清理')
    assert.ok(!existsSync(linkStash), 'link 型 stash 必须断掉')
    assert.equal(
      R.fingerprintTree(dst).size,
      2,
      '删掉那个 junction 之后目标内容必须一个字都没少(穿透删除即为此而设的反例)',
    )
    assert.equal(byPath.get(covered).action, 'pruned', '被逐文件覆盖的目录型应可清')
    assert.ok(!existsSync(covered))
    assert.equal(byPath.get(unique).action, 'kept', '有独有文件的目录型被删了 = 数据事故')
    assert.ok(existsSync(unique), 'unique stash 必须还在')
    assert.equal(byPath.get(bare).action, 'kept', '裸文件读不出目录指纹,空集不等于"已被覆盖"')
    assert.ok(existsSync(bare))
    assert.ok(existsSync(join(decoy, 'precious.bin')), '前缀不匹配的兄弟条目不得被碰')
    // 更强的一条:枚举必须是**按前缀**,不是"按父目录整片"。后者一旦成立,清理就会波及
    // 同一个家目录里所有无关目录 —— 那才是真正会丢数据的那一型。
    assert.deepEqual(
      readdirSync(home).sort(),
      [
        '.demo',
        '.demo.not-a-stash',
        '.demo.pre-junction-2026-01-03T00-00-00-000Z',
        '.demo.pre-junction-2026-01-04T00-00-00-000Z.txt',
      ].sort(),
      '父目录最终态不对:多删或漏删都在这条里暴露',
    )

    // 源还不是指针时,任何目录型 stash 都可能就是原始数据本身
    const home2 = join(root, 'home2')
    const src2 = join(home2, '.demo2')
    mkdirSync(src2, { recursive: true })
    writeFileSync(join(src2, 'orig.bin'), 'real-data', 'utf8')
    const stash2 = join(home2, '.demo2.pre-junction-x')
    mkdirSync(stash2, { recursive: true })
    writeFileSync(join(stash2, 'orig.bin'), 'real-data', 'utf8')
    const r2 = R.pruneStashes(src2, join(root, 'nowhere'), { apply: true })
    assert.equal(r2[0].action, 'kept', r2[0].note)
    assert.ok(existsSync(stash2) && existsSync(join(src2, 'orig.bin')), '源未改道时不得动 stash')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('装车证明:门 96 会枚举 stash,守护会因 stash 残留叫起修复器', () => {
  const judge = readFileSync(new URL('../check-home-junctions.mjs', import.meta.url), 'utf8')
  assert.match(judge, /export function findStashes\(/, '门 96 必须自带 stash 枚举面')
  assert.match(judge, /stashes: staleStashes\(registry\)/, 'audit 必须把 stash 带进报告面')
  assert.match(judge, /--check-stash/, '必须有独立出口供守护查询(不进 blocking 退出码)')
  const fixer = readFileSync(new URL('../re-home-junctions.mjs', import.meta.url), 'utf8')
  assert.match(
    fixer,
    /pruneStashes\(it\.src, it\.dst, \{ apply \}\)/,
    '修复器每轮必须真调清理(与"本轮有没有项要搬"无关)',
  )
  const guard = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
  assert.match(guard, /\['--check-stash'\]/, '守护必须查 stash 残留,否则修复器永远不会为它被叫起')
  assert.match(guard, /first\.code === 0 && stash\.code === 0/, '体检绿但仍有 stash 残留时不得早退')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
