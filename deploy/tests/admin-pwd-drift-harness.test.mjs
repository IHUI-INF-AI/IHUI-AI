// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// admin-credential 取值序/漂移判据的镜像测试入口(deploy/tests)
// =============================================================================
// 立因:这个 harness 与 alert-stall-dedup 一样**从来没有 .test.mjs 包装** ——
// 头注写的取证入口是"直接跑 powershell -File …",而没有任何 runner 会去跑它。
// 也就是说里面 23 条断言的存活性只取决于"哪天有人手工想到它",而 harness 这一层
// 恰恰是凭据取值序这种"漂了不响、错了才炸"的判据(2026-10-10 实测过一次 env 陈旧致 401)。
// 2026-10-21 起 run-script-tests 的发现面并入 deploy\tests,包装上即全量批跑。
// =============================================================================
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = join(HERE, 'admin-pwd-drift-harness.ps1')
const MODULE = join(HERE, '..', 'win', 'admin-credential.ps1')

function findPwsh() {
  const cands = [process.env.PWSH_PATH, 'C:/Program Files/PowerShell/7/pwsh.exe', 'C:/Program Files (x86)/PowerShell/7/pwsh.exe'].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

test('T0 前置:harness 与被测模块都在位(取不到判未判定,不判绿)', () => {
  if (!existsSync(HARNESS)) throw new Error('harness 不在位')
  if (!existsSync(MODULE)) throw new Error('admin-credential.ps1 不在位')
  if (!findPwsh()) throw new Error('未判定:取不到 powershell 7 ⇒ 不能据此判绿(§0.3)')
})

test('T1 判据本体:harness 必须零 FAIL 且退出码为 0', () => {
  const r = spawnSync(findPwsh(), ['-NoProfile', '-File', HARNESS], { encoding: 'utf8', windowsHide: true, timeout: 300_000 })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  const m = out.match(/pass=(\d+)\s+fail=(\d+)/)
  if (!m) throw new Error(`harness 没打印计数行 ⇒ 它可能崩在半路。输出头:\n${out.slice(0, 400)}`)
  const [, p, f] = m
  if (Number(f) !== 0) throw new Error(`harness 有 ${f} 条 FAIL(通过 ${p} 条):\n${out}`)
  if (Number(p) < 23) throw new Error(`用例数掉到 ${p} 条(<23)⇒ 覆盖面在缩水,不许默默少用例`)
  if (r.status !== 0) throw new Error(`harness 退出码 ${r.status} 而非 0`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
