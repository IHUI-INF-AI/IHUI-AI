// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 旗标闸镜像测试（RP-79，2026-10-30）
 * 判据一律 import 源文件那一份出口，不在此重抄清单（§22c）。
 * 负对照一律落在**临时夹具仓**：万一闸接错，被开跑真实收敛的是夹具，不是真仓。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'git-sync-converge.mjs')

const { findUnknownFlag, KNOWN_FLAGS, DECLARATION_FLAGS, USAGE } = await import(pathToFileURL(SCRIPT).href)
const wrap = (arr) => ['node', SCRIPT, ...arr]

const gitIn = (cwd, args) =>
  spawnSync('git', args, { cwd, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

test('闸本身：未知旗必须被点名返回（不得 null 放进默认档）', () => {
  assert.equal(findUnknownFlag(wrap(['--helpz'])), '--helpz', '近似旗最容易静默掉进默认档')
  assert.equal(findUnknownFlag(wrap(['--delete-everything'])), '--delete-everything')
  assert.equal(findUnknownFlag(wrap(['--dry-run', '--nope'])), '--nope', '合法旗之后的未知旗也必须抓到')
})

test('闸不误杀：KNOWN_FLAGS 逐条 + 带值形 + 等号形 + 声明旗多值全部合法', () => {
  assert.equal(findUnknownFlag(wrap([])), null, '空 argv 走默认档是合法用法')
  for (const f of ['--self-test', '--dry-run', '--no-proxy', '--status', '--align-only', '--help', '-h', '--branch', '--rounds']) {
    assert.equal(f === '--branch' || f === '--rounds' ? findUnknownFlag(wrap([f, 'x'])) : findUnknownFlag(wrap([f])), null, `${f} 必须被认识`)
  }
  for (const d of DECLARATION_FLAGS) {
    assert.equal(findUnknownFlag(wrap([d, 'AGENTS.md'])), null, `声明旗 ${d} 必须被认识且吃掉其值`)
    assert.equal(findUnknownFlag(wrap([`${d}=AGENTS.md`])), null, `${d}=value 等号形必须被认识`)
  }
  assert.equal(findUnknownFlag(wrap(['--branch', 'main', '--rounds', '3', '--dry-run', '--take-theirs-doc', 'README.md'])), null, '组合真实调用串不得误杀')
})

test('清单成套：KNOWN_FLAGS ⊇ 声明旗，且 USAGE 点名的每一条都在清单里（§0.6 只许一份清单）', () => {
  for (const d of DECLARATION_FLAGS) assert.ok(KNOWN_FLAGS.includes(d), `${d} 在 DECLARATION_FLAGS 却不在 KNOWN_FLAGS ⇒ 正当用法会被自己拦死`)
  const namedInUsage = new Set((USAGE.join(' ').match(/--[a-z][a-z-]*/g) || []))
  for (const f of namedInUsage) {
    assert.ok(KNOWN_FLAGS.includes(f) || f === '--help', `USAGE 里印了 ${f} 却不认识 ⇒ 文档写了跑不通的出路(§0.8)`)
  }
})

test('负对照在夹具仓落地：未知旗 rc=2 且零副作用（HEAD 与树逐字节不动）', () => {
  const dir = mkScratch('arg-guard-fixture')
  try {
    const st = gitIn(dir, ['init', '-q', '-b', 'main'])
    assert.equal(st.status, 0, `夹具 git init 失败: ${st.stderr}`)
    gitIn(dir, ['config', 'user.email', 'guard@example.invalid'])
    gitIn(dir, ['config', 'user.name', 'guard'])
    writeFileSync(join(dir, 'a.txt'), 'one\n', 'utf8')
    gitIn(dir, ['add', 'a.txt'])
    const c = gitIn(dir, ['commit', '-q', '-m', 'seed'])
    assert.equal(c.status, 0, `夹具 seed 提交失败: ${c.stderr}`)
    const headBefore = gitIn(dir, ['rev-parse', 'HEAD']).stdout.trim()

    const run = spawnSync(process.execPath, [SCRIPT, '--help-please'], {
      cwd: dir,
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    })
    assert.equal(run.status, 2, `未知旗必须 rc=2（实得 ${run.status}；stdout=${String(run.stdout).slice(0, 120)}）`)
    assert.match(`${run.stderr}${run.stdout}`, /未认识的旗标/, '必须点名是哪枚旗，不许裸栈/静默')
    assert.doesNotMatch(`${run.stderr}${run.stdout}`, /ERR_INVALID_ARG_TYPE|at ModuleJob/, '不得以裸栈当用法错出口')
    assert.notEqual(`${run.stdout}${run.stderr}`, '', '闸必须真的说话')

    const headAfter = gitIn(dir, ['rev-parse', 'HEAD']).stdout.trim()
    assert.equal(headAfter, headBefore, '用法错这一趟绝不许推进 HEAD（零副作用）')
    const idx = gitIn(dir, ['diff', '--cached', '--name-only']).stdout.trim()
    assert.equal(idx, '', '用法错这一趟绝不许留索引中间态（本次实测病根就是 16 项 index≠HEAD）')
    assert.ok(existsSync(join(dir, 'a.txt')), '夹具工作区不得被动过')
  } finally {
    rmScratch(dir)
  }
})

test('--help 必须是纯查询：rc=0、打印用法、不动夹具仓任何东西', () => {
  const dir = mkScratch('arg-guard-help')
  try {
    gitIn(dir, ['init', '-q', '-b', 'main'])
    const before = gitIn(dir, ['rev-parse', 'HEAD'])
    const run = spawnSync(process.execPath, [SCRIPT, '--help'], {
      cwd: dir,
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    })
    assert.equal(run.status, 0, `--help 必须 rc=0（实得 ${run.status}）`)
    assert.match(run.stdout, /用法:/, '--help 必须打印用法')
    assert.doesNotMatch(run.stdout, /第 1\/3 轮|索引层合并/, '--help 绝不允许开跑收敛')
    if (before.status === 0) {
      const after = gitIn(dir, ['rev-parse', 'HEAD'])
      assert.equal(after.stdout.trim(), before.stdout.trim(), '--help 不得推进 HEAD')
    }
  } finally {
    rmScratch(dir)
  }
})

test('装车锁：闸排在一切动作之前（源码形状：必须先于 --self-test 与默认档）', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const iBad = src.indexOf('const badFlag = findUnknownFlag(process.argv)')
  const iSelf = src.indexOf("if (argv.includes('--self-test'))")
  const iBranch = src.indexOf("const branch = getOpt('--branch', 'main')")
  assert.ok(iBad > 0, 'main 里没有接上闸 ⇒ 清单只是注释（§0.9 造好没装车=没有）')
  assert.ok(iSelf > iBad, '闸必须排在 --self-test 之前')
  assert.ok(iBranch > iBad, '闸必须排在任何取值/动作之前')
  assert.equal([...src.matchAll(/export function findUnknownFlag/g)].length, 1, '闸的实现全仓只许一份')
  assert.equal([...src.matchAll(/export const KNOWN_FLAGS/g)].length, 1, '旗清单只许一份')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
