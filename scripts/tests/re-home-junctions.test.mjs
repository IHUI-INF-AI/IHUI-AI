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
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { __test__ as R } from '../re-home-junctions.mjs'

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
    const d = R.diffFingerprint(R.fingerprintTree(src), new Map([['a.txt', 999], ['nested/b.bin', 2048]]))
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
  assert.match(src, /import \{ registryOf \} from '\.\/check-home-junctions\.mjs'/, '登记表必须来自门 96')
  assert.match(src, /import \{ devEnvRoot \} from '\.\/seal-c-root-stray\.mjs'/, 'D 盘根必须复用 devEnvRoot()')
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
  assert.match(guard, /if \(!CHECK_ONLY\) healHomeJunctions\(\)/, '挂点必须在早退之前(--check 挂这里等于永不执行)')
  const fixer = readFileSync(new URL('../re-home-junctions.mjs', import.meta.url), 'utf8')
  assert.match(fixer, /cool\[it\.src\] > now/, 'main 必须先查冷却再决定是否重抄')
  assert.match(fixer, /action: 'cooldown'/, '被跳过的项必须如实报 cooldown,不得静默')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
