// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// archive-dir 回归测试:钉三件事 —— ① 表里每个 kind 都交出 §15b 那个根下的路径;
// ② "参数写错"与"环境交不出落点"是两个退出码(混成一个会把"问错了"读成"没有落点");
// ③ 落点解析档只回答"落在哪"(不建目录、不写文件、不碰网盘);写盘动作只许出现在保留档留痕
//    那一处 —— 射程由 ③ 的两条锁一起钉(2026-11-01 收窄,旧整文件禁词面与 archive-retention
//    的留痕要求互斥,两套测试不可能同时绿)。
// 跑法:node --test scripts/tests/archive-dir.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

import { maskComments } from '../lib/code-mask.mjs'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLI = join(ROOT, 'scripts', 'archive-dir.mjs')

async function loadTool() {
  const mod = await import('../archive-dir.mjs')
  return mod.__test__
}

function runCli(args) {
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  return spawnSync(process.execPath, [CLI, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  })
}

test('表里每个 kind 都交出一个 §15b 备份根下的绝对路径(正向证明,不是只测缺省)', async () => {
  const { archiveDirFor, KINDS, ROOT: toolRoot } = await loadTool()
  const keys = Object.keys(KINDS)
  assert.ok(keys.length >= 2, 'kind 表为空 ⇒ 下面的断言全部空转')
  for (const k of keys) {
    const res = archiveDirFor(k, toolRoot)
    assert.ok(res.path, `${k} 未交出落点:${res.reason}`)
    assert.match(res.path, /^[A-Za-z]:\//, `${k} 的落点不是绝对路径:${res.path}`)
    assert.ok(res.path.includes('/backups/'), `${k} 的落点不在 §15b 唯一备份目录下:${res.path}`)
    assert.ok(res.path.endsWith(KINDS[k].join('/')), `${k} 落点尾段与表不符:${res.path}`)
    assert.ok(!res.path.includes('BaiduSyncdisk'), `${k} 的落点指向网盘同步目录:${res.path}`)
  }
})

test('本链缺省落点是 sql/image-source-migration(迁移脚本头部写的就是这个)', async () => {
  const { archiveDirFor, ROOT: toolRoot } = await loadTool()
  const res = archiveDirFor('image-source-migration', toolRoot)
  assert.ok(res.path.endsWith('/sql/image-source-migration'), res.path)
})

test('未知 kind ⇒ cause=bad-arg(参数错),不得与"环境交不出落点"同档', async () => {
  const { archiveDirFor } = await loadTool()
  const res = archiveDirFor('nope-not-a-kind')
  assert.equal(res.path, null)
  assert.equal(res.cause, 'bad-arg')
})

test('交不出备份根 ⇒ cause=unresolved,不冒路径也不静默(夹具工作树走层的 scratch 判据)', async () => {
  const { archiveDirFor } = await loadTool()
  // 层的 null 档只认 `ihui-scratch` 段(见 scripts/lib/gitdir.mjs 头注的能力边界)——
  // 拿它当注入面,比自造一个"不存在的盘"更真:后者层的回答是"照样给路径"。
  const res = archiveDirFor('sql', 'D:/DevEnv/Temp/ihui-scratch/fake-repo')
  assert.equal(res.path, null, `夹具工作树却交出了落点:${res.path}`)
  assert.equal(res.cause, 'unresolved')
})

test('本工具不做存在性校验(层的既定行为:除夹具外一律交出落点)—— 登记能力边界,不得假装验过', async () => {
  const { archiveDirFor } = await loadTool()
  const res = archiveDirFor('sql', 'Z:/definitely-not-a-worktree-ihui')
  assert.ok(res.path, '非夹具工作树应当交出落点(盘的可达性由写盘那一步大声失败)')
  assert.match(res.path, /^Z:\//, `落点由传入的工作树所在盘推导,实得:${res.path}`)
})

test('CLI 三档退出码:0 只打一行路径 / 2 参数错 / 1 环境交不出(调用方按码分流)', () => {
  const ok = runCli([])
  assert.equal(ok.status, 0, ok.stderr)
  const lines = ok.stdout.trim().split('\n')
  assert.equal(lines.length, 1, `stdout 必须恒为一行路径,实得:${JSON.stringify(ok.stdout)}`)
  assert.ok(!/\s/.test(lines[0].trim()), '落点含空白会让调用方的引号拼接出错')

  const badArg = runCli(['--kind', 'nope-not-a-kind'])
  assert.equal(badArg.status, 2, `未知 kind 应 2(参数错),实得 ${badArg.status}`)
  assert.equal(badArg.stdout.trim(), '', '参数错时 stdout 必须为空(不得把诊断喂给 $())')

  const missing = runCli(['--kind'])
  assert.equal(missing.status, 2, '--kind 缺值应 2,实得 ' + missing.status)
})

test('写盘动作只允许出现在保留档留痕那一处(禁词射程锁)', () => {
  // 契约住在 archive-dir.mjs 头注:「**落点解析档**不建目录、不写文件 —— 建目录是调用方的事」。
  // 旧形拿整文件禁词扫描当尺,等于把这一档的契约扩成「全文件永不写盘」;而 G-24 的保留档
  // (台账 G-245「双上限 + 最近 N 代」)必须往留痕账追加行 —— 本条与 archive-retention.test.mjs
  // 因此互斥,2026-11-01 实测两套不可能同时绿(10-25 那枚"清理归档退役残留"误把实现整片写回
  // 旧基线,就是为了让这对矛盾看起来"成立")。现在按契约的真实射程判:写盘标识符只准出现在
  // appendRetentionLedger 的函数体内,射程外一枚都不许有;且那一段必须真有这两枚(豁免必须验过才免)。
  const src = readFileSync(CLI, 'utf8')
  const code = maskComments(src)
  const start = code.indexOf('export function appendRetentionLedger')
  assert.ok(start >= 0, '保留档留痕函数消失 ⇒ 本条的豁免射程无从划定(不是"没有写盘所以绿")')
  const end = code.indexOf('\n}', start)
  assert.ok(end > start, '留痕函数体收不出界 ⇒ 射程判断失效,拒绝报绿')
  const ledgerBody = code.slice(start, end)
  const callSites = (name) => {
    const out = []
    for (let i = code.indexOf(name); i >= 0; i = code.indexOf(name, i + 1)) out.push(i)
    return out
  }
  // 判**调用点**而不是标识符:`import { appendFileSync, mkdirSync } from 'node:fs'` 里那两名
  // 是声明面,拿标识符扫会把 import 语句判成越界写盘(2026-11-01 本条第一版就是这么红的)。
  for (const name of ['mkdirSync(', 'writeFileSync(', 'appendFileSync(', 'rmSync(', 'cpSync(']) {
    for (const i of callSites(name)) {
      assert.ok(
        i >= start && i < end,
        `${name.slice(0, -1)} 的调用点落在留痕函数之外(偏移 ${i},射程 [${start},${end})) ⇒ 越界写盘`,
      )
    }
  }
  // 阳性对照:豁免段里确实有这两枚动作,否则上面那条"射程外不得有"是被空集蒙过去的绿。
  assert.ok(
    /mkdirSync\(/.test(ledgerBody) && /appendFileSync\(/.test(ledgerBody),
    '留痕函数里没有 mkdirSync+appendFileSync 调用 ⇒ 豁免段是空的,整条判据空转',
  )
  // 反向对照:真删不走这里(全仓唯一 rmSync 出口在 retire 层,本器只委托)。
  assert.equal(callSites('rmSync(').length, 0, '本器直接 rmSync = 绕过全仓唯一删除出口(§5b 归档面)')
  // 阳性对照:剥注释这一步真在起作用(而不是"源码本来就干净"蒙过去的绿)
  assert.ok(/mkdirSync/.test(src), '夹具失效:注释里已没有 mkdirSync 字样,本条的剥注释对照无从成立')
})

test('落点解析档跑一次不改磁盘(行为锁:解析前后父目录条目一致)', async () => {
  // 契约的**动作**面证明,不看措辞:每一档 kind 各解析一次,父目录的条目集合必须一字不变。
  const { archiveDirFor, KINDS } = await loadTool()
  const keys = Object.keys(KINDS)
  assert.ok(keys.length >= 2, 'kind 表为空 ⇒ 本条空转')
  // archiveDirFor 交的是 {path, cause, reason} 三态(缺省落点也可能为 null ⇒ 不猜)
  const paths = keys.map((k) => archiveDirFor(k, ROOT).path).filter((p) => typeof p === 'string')
  assert.equal(paths.length, keys.length, '有 kind 解析不出 path ⇒ 本条的父目录集不全,拒绝报绿')
  const parents = [...new Set(paths.map((p) => dirname(p)))]
  const snap = () =>
    parents.map((p) => `${p} => ${existsSync(p) ? readdirSync(p).sort().join('|') : '(不存在)'}`)
  const before = snap()
  for (const k of keys) {
    const r = runCli(['--kind', k])
    assert.equal(r.status, 0, `解析 ${k} 应 0,实得 ${r.status} stderr=${r.stderr.slice(0, 60)}`)
  }
  const def = runCli([])
  assert.equal(def.status, 0, '缺省解析应 0')
  assert.deepEqual(
    snap(),
    before,
    '解析档跑完父目录条目变了 ⇒ 它建了目录或写了文件(契约:落点解析只回答"落在哪")',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
