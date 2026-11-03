// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 结构锁:三处 netstat 派生(desktop-dev-saas / release-mobile-rn / rotate-local-dev-db-password)
// 一律走绝对路径 BIN 常量,不得再用裸命令名。
//
// 立因(与 tunnel-command-absolute-paths.test.mjs 同一 root cause 家族,2026-11-03 真机实测):
// nssm 服务身份下 `PATH` 会被整值覆盖,裸名 `netstat` + execFile/spawn(shell=false) 直接
// `spawn netstat ENOENT`;同批写绝对路径的命令全部正常。因此锁判的是**执行面**:
// 每个脚本的"常量区 + 调用区段"里,被派生的 netstat 必须是绝对路径常量。
//
// 取材纪律(§22c):只对**区段切片**断言,绝不对整份源码 `assert.match(整个文件)` —— 否则注释或
// 别处的字符串命中一次,这条锁就永远为真(假绿)。区段标记找不到时直接判红,不让锁空转。
//
// 变异对照:IHUI_NETSTAT_SRC_DIR 只供"把改动前源码拷到临时目录再跑同一枚测试"使用,
// 默认始终读本仓 scripts/ 下的现行文件。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const SRC_DIR = process.env.IHUI_NETSTAT_SRC_DIR
  ? resolve(process.env.IHUI_NETSTAT_SRC_DIR)
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

/** 被派生为**命令**的裸名(只认调用位,不认注释/错误文案里的普通出现)。 */
const BARE_NETSTAT = /\b(?:execFileSync|execFile|exec|spawnSync|spawn|runCapture)\s*\(\s*(?:'netstat'|"netstat")\s*[,)]/

/** 一份区段必须同时满足:无裸名调用 + 恰有一处走 NETSTAT_BIN + 常量区按存在性选在位者。 */
function assertAbsoluteNetstat(body, { label, call }) {
  assert.ok(!BARE_NETSTAT.test(body), `${label}:区段里仍有裸名 netstat ⇒ 受限 PATH 下必然 spawn ENOENT`)
  assert.match(body, call, `${label}:netstat 必须走 NETSTAT_BIN 绝对路径常量`)
  assert.ok(
    body.includes("process.env.SystemRoot || process.env.windir || 'C:\\\\Windows'"),
    `${label}:SYSTEM_ROOT 必须按 SystemRoot || windir || 固定盘符 容错`,
  )
  assert.ok(body.includes(".replace(/[\\\\/]+$/, '')"), `${label}:SYSTEM_ROOT 必须去掉尾部斜杠`)
  assert.ok(body.includes('candidates.find((p) => existsSync(p))'), `${label}:候选必须按当次存在性选在位者`)
  assert.ok(body.includes("'C:\\\\Windows\\\\System32\\\\netstat.exe'"), `${label}:候选表必须有硬编码兜底`)
}

test('desktop-dev-saas.listenersOfPort:netstat 不得以裸名被派生', () => {
  const src = read('desktop-dev-saas.mjs')
  const body = section(src, 'const SYSTEM_ROOT =', 'function freePort(', 'desktop-dev-saas')
  assertAbsoluteNetstat(body, {
    label: 'desktop-dev-saas',
    call: /spawnSync\(NETSTAT_BIN,\s*\['-ano',\s*'-p',\s*'TCP'\]/,
  })
})

test('release-mobile-rn.probeLocalProxy:netstat 不得以裸名被派生', () => {
  const src = read('release-mobile-rn.mjs')
  const body = section(src, 'const SYSTEM_ROOT =', 'const test = (port)', 'release-mobile-rn')
  assertAbsoluteNetstat(body, {
    label: 'release-mobile-rn',
    call: /execFileSync\(NETSTAT_BIN,\s*\['-ano',\s*'-p',\s*'tcp'\]/,
  })
})

test('rotate-local-dev-db-password.liveServicePorts:netstat 不得以裸名被派生', () => {
  const src = read('rotate-local-dev-db-password.mjs')
  const body = section(src, 'const SYSTEM_ROOT =', 'function runDbCode(', 'rotate-local-dev-db-password')
  assertAbsoluteNetstat(body, {
    label: 'rotate-local-dev-db-password',
    call: /execFileSync\(NETSTAT_BIN,\s*\['-ano'\]/,
  })
})
