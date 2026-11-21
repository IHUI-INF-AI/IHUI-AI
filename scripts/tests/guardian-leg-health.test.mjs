// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 接线锁:第 82 项(2026-11-21)—— guardian 存活哨兵不得把活着的判死 / 不得拿统一阈值读异节律腿。
// 判据单源 = scripts/check-guardian-leg-health.mjs 的 judgeLegHealth(本测试 import,不复制阈值)。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { judgeLegHealth } from '../check-guardian-leg-health.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const leg = (over = {}) => ({ exists: true, stale: false, down: false, ...over })

test('① 汇总判据:全 down ⇒ down;部分 stale ⇒ stale;全新鲜 ⇒ ok', () => {
  assert.equal(judgeLegHealth({ a: leg({ down: true }), b: leg({ down: true }) }), 'down')
  assert.equal(judgeLegHealth({ a: leg(), b: leg({ stale: true }) }), 'stale')
  // 第 87 项:任一腿越过 downMs 就必须是 down —— 旧规则这里给 stale,而 runner 对 stale 只登记不发信,
  // 实测 disk-root-hygiene 25h 没跑时哨兵仍报 stale、到人通道一格都没走(单腿死只落 warn = 没有求救信号)。
  assert.equal(judgeLegHealth({ a: leg(), b: leg({ stale: true }), c: leg({ down: true }) }), 'down')
  assert.equal(judgeLegHealth({ a: leg(), b: leg({ down: true }) }), 'down', '单腿 down 必须喊人')
  assert.equal(judgeLegHealth({ a: leg(), b: leg(), c: leg() }), 'ok')
  assert.equal(judgeLegHealth({}), 'down')
})

test('①b 从未跑过(缺失)不等于死腿:全缺 ⇒ down,单腿缺 ⇒ 只是 stale', () => {
  const missing = leg({ exists: false, missing: true, stale: false, down: false })
  assert.equal(judgeLegHealth({ a: missing, b: missing }), 'down', '一台从没跑过守护的机器必须报 down')
  assert.equal(judgeLegHealth({ a: leg(), b: missing }), 'stale', '该腿本机不适用时不得单独判急')
  // 读数形状锁:缺失不得被写成 down(旧写法 `age === null || age > downMs`)
  const src = readFileSync(join(ROOT, 'scripts', 'check-guardian-leg-health.mjs'), 'utf8')
  assert.doesNotMatch(src, /down:\s*age\s*===\s*null\s*\|\|/, '缺失被折成 down ⇒ 单腿缺也会报急')
  assert.match(src, /missing:\s*age\s*===\s*null/)
})

test('② 阈值按腿分化: 24h 腿 17h 不算 stale(旧代码统一 30min 会读错)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'check-guardian-leg-health.mjs'), 'utf8')
  // 每腿自带 staleMs/downMs,且 temp-scrub / worktree-reap 的 staleMs 必须是小时量级(≥20h)
  assert.match(src, /'temp-scrub':\s*\{[\s\S]*?staleMs:\s*26\s*\*\s*60\s*\*\s*60\s*\*\s*1000/)
  assert.match(src, /'worktree-reap':\s*\{[\s\S]*?staleMs:\s*26\s*\*\s*60\s*\*\s*60\s*\*\s*1000/)
  // 不再用统一 STALE_MS 判定每条腿
  assert.doesNotMatch(src, /stale:\s*age\s*!==\s*null\s*&&\s*age\s*>\s*STALE_MS\b/)
  assert.doesNotMatch(src, /down:\s*age\s*===\s*null\s*\|\|\s*age\s*>\s*DOWN_MS\b/)
})

test('③ pid 文件缺席不再直接判 down:读数写明来源,判活交给 tick', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'check-guardian-leg-health.mjs'), 'utf8')
  assert.doesNotMatch(src, /if\s*\(!daemonAlive\s*\|\|\s*allDown\)\s*state\s*=\s*'down'/)
  assert.match(src, /pidSource\s*=\s*pid\s*===\s*null\s*\?\s*'absent'/)
  assert.match(src, /const state = judgeLegHealth\(legs\)/)
})

test('④ daemon 启动必须自己写 pid 文件(不论由 nssm/服务/计划任务拉起)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  const start = src.indexOf('function startDaemon(')
  assert.ok(start > 0, 'startDaemon 必须存在')
  const body = src.slice(start, start + 6000)
  assert.match(body, /GUARDIAN_PID_FILE/, 'startDaemon 体内必须写 GUARDIAN_PID_FILE')
  assert.match(body, /writeFileSync\(/, 'startDaemon 体内必须真正落盘 pid 文件')
  assert.match(body, /pid=\$\{process\.pid\}/, '格式必须与哨兵读的 pid=(\d+) 一致')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
