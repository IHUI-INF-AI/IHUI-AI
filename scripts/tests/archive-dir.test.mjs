// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// archive-dir 回归测试:钉三件事 —— ① 表里每个 kind 都交出 §15b 那个根下的路径;
// ② "参数写错"与"环境交不出落点"是两个退出码(混成一个会把"问错了"读成"没有落点");
// ③ 它只回答"落在哪",不建目录、不写文件、不碰网盘。
// 跑法:node --test scripts/tests/archive-dir.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLI = join(ROOT, 'scripts', 'archive-dir.mjs')

async function loadTool() {
  const mod = await import('../archive-dir.mjs')
  return mod.__test__
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
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

test('本工具不得建目录或写文件(它只回答"落在哪")', () => {
  const src = readFileSync(CLI, 'utf8')
  // 判据面必须先剥注释:本文件头注里写着"mkdirSync 是调用方的事"这句话 ——
  // 不剥注释就是门把自己解释自己的散文判成违规(守门 131/70 同型)。
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
  for (const forbidden of ['mkdirSync', 'writeFileSync', 'appendFile', 'rmSync', 'cpSync']) {
    assert.ok(!code.includes(forbidden), `archive-dir 的代码面出现了 ${forbidden} —— 建目录/写盘是调用方的事`)
  }
  // 阳性对照:剥注释这一步真在起作用(而不是"源码本来就干净"蒙过去的绿)
  assert.ok(/mkdirSync/.test(src), '夹具失效:注释里已没有 mkdirSync 字样,本条的剥注释对照无从成立')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
