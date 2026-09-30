// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:next-plan-id.mjs(第二发号出口)的远端那一维。
 *
 * 背景(G-313 硬前置,2026-09-30):取号出口有两处 —— live-doc-edit.mjs(令牌展开)与本器(手动
 * CLI)。此前只有前者看了远端;本器按本地宽面给号,对面"已推未并"的登记结构上永远看不见,
 * G-978062 那组撞号正是两批各按旧基准取号造出来的。翻新后本器与第一出口**共用同一把尺**
 * (import readRemoteIdBasis + idBasisGate,不抄第二份)。
 *
 *  T1  源码形状锁:必须 import 第一出口的那两个出口(抄第二份必漂);本器自身不得出现
 *      ls-remote/fetch 派生(传输面只住在 live-doc-edit.mjs 那一份)。
 *  T2  闸门必须真的强制在发号路径上:gate.block ⇒ exit 1,且字样里写明拒绝理由;应急 env
 *      必须被读取(IHUI_PLAN_ID_ALLOW_UNALIGNED)。
 *  T3  --check 不发号 ⇒ 源码形状上它必须在远端读取之前分岔(不问远端,stdout/stderr 契约不变)。
 *  T4  真仓只读冒烟:--next-only 恒一行号且 exit 0;完整报告 exit 0(不断言具体号 —— 号是现读的,
 *      把它断死等于给并发会话造一台恒红)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = resolve(ROOT, 'scripts', 'next-plan-id.mjs')
const TOOL_SRC = readFileSync(CLI, 'utf8')

test('T1 源码形状锁:远端尺必须 import 自 live-doc-edit.mjs,本器不得自带第二份传输面', () => {
  assert.match(
    TOOL_SRC,
    /import\s*\{\s*readRemoteIdBasis,\s*idBasisGate\s*\}\s*from\s*'\.\/live-doc-edit\.mjs'/,
    '远端基准与闸门必须与第一发号出口同一份实现(抄第二份必漂,AGENTS §3)',
  )
  assert.doesNotMatch(TOOL_SRC, /ls-remote/, '本器不得自带 ls-remote 派生(传输面只有一份,在 live-doc-edit.mjs)')
  assert.doesNotMatch(TOOL_SRC, /'fetch'/, '本器不得自带 fetch(自补救住在共享 transport 里)')
  assert.doesNotMatch(TOOL_SRC, /\bexecFileSync\(/, 'git 派生纪律只许住在 lib 层(守门 52/80 口径)')
})

test('T2 闸门必须强制在发号路径上:block ⇒ exit 1;应急 env 必须被读取', () => {
  const gateCall = TOOL_SRC.indexOf('idBasisGate({')
  assert.ok(gateCall > 0, 'idBasisGate 没有调用点 ⇒ 闸门没装车(造好没装车那一型)')
  const gateSection = TOOL_SRC.slice(gateCall, gateCall + 800)
  assert.match(gateSection, /IHUI_PLAN_ID_ALLOW_UNALIGNED/, '应急旗必须接到闸门的 allowUnaligned')
  assert.match(gateSection, /process\.exit\(1\)/, 'block 必须以非零退出收场(警告照样能提交就是本票要堵的原病)')
  assert.match(TOOL_SRC, /拒绝发号/, '拒绝措辞必须在场(出路要写明白,不得只喊不行)')
})

test('T3 --check 不问远端:发号维必须在 --check 分岔之后', () => {
  const checkBranch = TOOL_SRC.indexOf("flags.has('--check')")
  const remoteRead = TOOL_SRC.indexOf('readRemoteIdBasis({')
  assert.ok(checkBranch > 0 && remoteRead > checkBranch, '--check 分岔必须在远端读取之前(不发号就不问远端,契约逐字不变)')
  assert.match(TOOL_SRC, /SOURCE === 'HEAD'/, '--source 显式指面时不得重复问远端(那一面本来就是被指的面)')
})

test('T4 真仓只读冒烟:--next-only 恒一行号;完整报告正常退出(不断言具体号,号是现读的)', () => {
  const r1 = spawnSync(process.execPath, [CLI, '--next-only'], { cwd: ROOT, encoding: 'utf8', timeout: 180_000 })
  assert.equal(r1.status, 0, `--next-only 必须 exit 0(真仓此刻远端可问/离线都该走得到发号):\n${r1.stderr}`)
  assert.match(String(r1.stdout).trim(), /^O\d+$/, `--next-only 的 stdout 恒为一行号,实得:${r1.stdout}`)
  const r2 = spawnSync(process.execPath, [CLI], { cwd: ROOT, encoding: 'utf8', timeout: 180_000 })
  assert.equal(r2.status, 0, `完整报告必须 exit 0:\n${r2.stderr}`)
  assert.match(String(r2.stdout), /下一个号 = O\d+/)
})
