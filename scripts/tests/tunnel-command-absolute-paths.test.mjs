// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 结构锁:check-tunnel-leg-health.mjs / record-tunnel-metrics.mjs 的采集入口不得再用裸命令名。
//
// 立因(2026-11-03 真机实测):nssm 服务 `IHUI-GIT-GUARD` 的 AppEnvironmentExtra 写的是
// `PATH=C:/Program Files\Git\cmd`,而 nssm 对同名变量是**整值覆盖**(不是追加)⇒ 守护进程 PATH
// 里没有 System32;采集器用裸名 `netstat` / `netsh` + execFile(shell=false) ⇒
// `spawn netstat ENOENT` / `spawn netsh ENOENT`,而同批 `tasklist`/`wevtutil`/`sc` 因为写的是绝对
// 路径全部正常。所以这条锁判的是**执行面**:两个脚本的 collect() 区段里,被派生命令必须是绝对路径
// 常量,且常量区必须有 SystemRoot/windir 容错兜底。
//
// 取材纪律(§22c):只对**区段切片**做断言,绝不对整份源码 `assert.match(整个文件)` —— 否则注释或
// 别处的字符串命中一次,这条锁就永远为真(假绿)。区段标记找不到时直接判红,不让锁空转。
//
// 变异对照:IHUI_TUNNEL_SRC_DIR 只供"把改动前源码拷到临时目录再跑同一枚测试"使用,
// 默认始终读本仓 scripts/ 下的现行文件。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const SRC_DIR = process.env.IHUI_TUNNEL_SRC_DIR
  ? resolve(process.env.IHUI_TUNNEL_SRC_DIR)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..')

const read = (name) => readFileSync(resolve(SRC_DIR, name), 'utf8')

/** 按起止标记切出"真会被执行的那一面";标记缺失或区段为空 ⇒ 当场判红(不许空转)。 */
function section(src, start, end, label) {
  const i = src.indexOf(start)
  assert.ok(i !== -1, `${label}:起止标记「${start}」不见了 ⇒ 区段锁失去取材面`)
  const j = src.indexOf(end, i + start.length)
  assert.ok(j > i, `${label}:结束标记「${end}」不见了 ⇒ 区段锁失去取材面`)
  const s = src.slice(i, j)
  assert.ok(s.length > 0, `${label}:切出的区段为空 ⇒ 这条锁在空转`)
  return s
}

/** 被派生为**命令**的裸名(只认调用位,不认注释/字符串表里的普通出现)。 */
const BARE_COMMAND = /\b(?:runCapture|execFileSync|execFile|exec|spawnSync|spawn)\s*\(\s*(?:'netstat'|"netstat"|'netsh'|"netsh")\s*[,)]/

test('check-tunnel-leg-health.collect:netstat/netsh 不得以裸名被派生', () => {
  const src = read('check-tunnel-leg-health.mjs')
  const body = section(src, 'async function collect()', 'function formatHuman(', 'check-tunnel-leg-health')
  assert.ok(!BARE_COMMAND.test(body), 'collect() 区段里仍有裸名 netstat/netsh ⇒ 受限 PATH 下必然 spawn ENOENT')
  assert.equal([...body.matchAll(/runCapture\(NETSTAT_BIN,/g)].length, 1, 'collect() 里 netstat 必须恰有一处走 NETSTAT_BIN 绝对路径常量')
  assert.equal([...body.matchAll(/runCapture\(NETSH_BIN,/g)].length, 2, 'collect() 里两处 netsh(ipv6/ipv4)都必须走 NETSH_BIN 绝对路径常量')
})

test('record-tunnel-metrics.collect:netstat 不得以裸名被派生,且复用同一份 NETSTAT_BIN', () => {
  const src = read('record-tunnel-metrics.mjs')
  const body = section(src, 'async function collect()', 'function selfTest(', 'record-tunnel-metrics')
  assert.ok(!BARE_COMMAND.test(body), 'collect() 区段里仍有裸名 netstat ⇒ 受限 PATH 下必然 spawn ENOENT')
  assert.match(body, /runCapture\(NETSTAT_BIN,\s*\['-ano'\]\)/, 'record-tunnel-metrics 的 netstat 必须走 NETSTAT_BIN 绝对路径常量')
  // 常量只有一份:本文件必须从 check-tunnel-leg-health.mjs 取,不许另写第二种解析。
  const imports = src.slice(0, src.indexOf('const TASKLIST ='))
  assert.match(
    imports,
    /import\s*\{[^}]*\bNETSTAT_BIN\b[^}]*\}\s*from\s*'\.\/check-tunnel-leg-health\.mjs'/,
    'record-tunnel-metrics 没有从 check-tunnel-leg-health.mjs 复用 NETSTAT_BIN ⇒ 出现第二份命令解析',
  )
})

test('绝对路径常量区:SystemRoot/windir 容错兜底 + 硬编码候选 + existsSync 选在位者', () => {
  const src = read('check-tunnel-leg-health.mjs')
  const constants = section(src, 'const SYSTEM_ROOT =', 'const SPAWN_TIMEOUT_MS =', 'check-tunnel-leg-health 常量区')
  const decl = constants.slice(0, constants.indexOf('\n'))
  assert.ok(
    decl.includes("process.env.SystemRoot || process.env.windir || 'C:\\\\Windows'"),
    'SYSTEM_ROOT 必须按 SystemRoot || windir || 固定盘符 容错(该服务键下 SystemRoot 实测为空值)',
  )
  assert.ok(decl.includes(".replace(/[\\\\/]+$/, '')"), 'SYSTEM_ROOT 必须去掉尾部斜杠')
  assert.ok(constants.includes('NETSTAT_CANDIDATES') && constants.includes('NETSH_CANDIDATES'), '两侧命令都必须有绝对路径候选表')
  assert.ok(constants.includes("'C:\\\\Windows\\\\System32\\\\netstat.exe'"), 'netstat 候选表必须有硬编码兜底')
  assert.ok(constants.includes("'C:\\\\Windows\\\\System32\\\\netsh.exe'"), 'netsh 候选表必须有硬编码兜底')
  assert.ok(constants.includes('existsSync(p)'), '候选必须按当次存在性选在位者,而不是盲取第一个')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
