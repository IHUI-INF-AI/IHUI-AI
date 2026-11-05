// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * iOS 站点腿中继调度器 `sweepIosIpaRelay` 的镜像测试(2026-11-03 立)。
 *
 * 立因:iOS 包在 macOS runner 上构建,这台机器从前从不需要它的字节 ⇒ 站点腿永远等不到 `.ipa`,
 * 下载栏里 iOS 就一直是唯一挂在 GitHub 资产域名上的实物包。执行器造好而没有调度器,就是
 * "造好没装车 = 没有"(§0.9);而调度器最容易犯的错是**把未判定当失败天天喊**(§5e-3 噪声)
 * 或反过来**永远不喊**(§0.10 静默)—— 这两条都得有牙。
 *
 * 钉死:
 *   R1 rc0 ⇒ published,清持续台账,不发信;
 *   R2 rc1 ⇒ 当场喊人(包已在腿上但账没收口),正文给两条可查动作;
 *   R3 rc2 首轮 ⇒ 只写日志不喊人(版本号自证资产要等下一次 iOS 构建,天天喊即噪声);
 *   R4 rc2 持续 72h+ ⇒ 升格喊人,身份固定为 escalated(不随小时数抖);
 *   R5 节流窗口内不第二次派发;
 *   R6 装车锁(定义 / !CHECK_ONLY 调用 / 出口表 / env 覆盖 / 执行器在位);
 *   R7 执行器契约锁:三档退出码语义与脚本头注一致(未判定必须归 2 不归 1)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { sweepIosIpaRelay } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const NOW = Date.parse('2026-11-03T04:00:00.000Z')

function harness({ status, stdout = '', stderr = '', seedFirstMs = null, scratchName = 'ios-relay' } = {}) {
  const scratch = mkScratch(scratchName)
  const tickFile = join(scratch, 'tick.ts')
  const firstFile = join(scratch, 'first.json')
  if (seedFirstMs !== null) {
    writeFileSync(firstFile, JSON.stringify({ firstMs: seedFirstMs }), 'utf8')
  }
  const logs = []
  const calls = []
  const result = sweepIosIpaRelay({
    now: NOW,
    tickFile,
    firstFile,
    logger: (m) => logs.push(String(m)),
    notify: (title, body, opts) => calls.push({ title, body, opts }),
    runner: () => ({ status, stdout, stderr }),
  })
  return { result, calls, logs, scratch, firstFile, tickFile }
}

test('R1 rc0 ⇒ published,不发信,持续台账被清', () => {
  const h = harness({ status: 0, stdout: '[ipa] ✓ 登记腿 registered', seedFirstMs: NOW - 3_600_000 })
  assert.equal(h.result.state, 'published')
  assert.equal(h.calls.length, 0)
  assert.equal(existsSync(h.firstFile), false, '成功后必须清持续台账,否则下次故障从旧起点起算')
  rmScratch(h.scratch)
})

test('R2 rc1 ⇒ 当场喊人,正文含两条可查动作', () => {
  const h = harness({ status: 1, stderr: '✗ app_versions 未登记:站点腿已发布' })
  assert.equal(h.result.state, 'fail')
  assert.equal(h.calls.length, 1)
  const { body, opts, title } = h.calls[0]
  assert.match(String(opts.dedupKey), /^verdict=fail;held=/)
  assert.match(title, /站点腿/)
  assert.match(body, /register-app-version-latest/, '要给唯一整改出口')
  assert.match(body, /IHUI-IMAGE-CDN|127\.0\.0\.1:80/, '自证失败要给本地源站的查法')
  rmScratch(h.scratch)
})

test('R3 rc2 首轮 ⇒ 未判定不喊人', () => {
  const h = harness({ status: 2, stderr: '✗ 未判定:ipa-asset-missing' })
  assert.equal(h.result.state, 'undetermined')
  assert.equal(h.calls.length, 0, '版本号自证资产要等下一次 iOS 构建才有,首几轮天天喊就是噪声')
  assert.match(h.logs.join('\n'), /未判定/)
  rmScratch(h.scratch)
})

test('R4 rc2 持续 72h+ ⇒ 升格喊人,身份固定不随小时数抖', () => {
  const h = harness({ status: 2, stderr: '✗ 未判定', seedFirstMs: NOW - 80 * 3_600_000 })
  assert.equal(h.result.state, 'undetermined-escalated')
  assert.equal(h.calls.length, 1)
  assert.match(String(h.calls[0].opts.dedupKey), /escalated=72h\+$/)
  assert.match(h.calls[0].body, /ios-version\.json/, '升格那封必须点名最可能的成因')
  assert.match(h.calls[0].body, /--ipa <path> --version/, '并给显式补一次的命令')
  rmScratch(h.scratch)
})

test('R5 节流窗口内不第二次派发', () => {
  const first = harness({ status: 0, scratchName: 'ios-relay-throttle' })
  let dispatched = false
  const second = sweepIosIpaRelay({
    now: NOW + 30 * 60 * 1000,
    tickFile: join(first.scratch, 'tick.ts'),
    firstFile: join(first.scratch, 'first.json'),
    logger: () => {},
    notify: () => {},
    runner: () => {
      dispatched = true
      return { status: 0, stdout: '', stderr: '' }
    },
  })
  assert.equal(second.ran, false)
  assert.equal(dispatched, false, '30 分钟后仍在 60 分钟窗口内 ⇒ 不该再拖一次 42MB')
  rmScratch(first.scratch)
})

test('R6 装车锁:定义/调用/出口/env 覆盖/执行器在位,五项齐', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'git-guardian.mjs'), 'utf-8')
  assert.match(src, /export function sweepIosIpaRelay\(/)
  assert.match(src, /if \(!CHECK_ONLY\) sweepIosIpaRelay\(\)/, '必须挂在巡检轮体内(与同族腿同函数)')
  assert.match(src, /sweepIosIpaRelay,\n/, '必须在出口表里')
  assert.match(src, /IHUI_IOS_RELAY_INTERVAL_MS/, '节流可由 env 覆盖')
  assert.ok(existsSync(join(import.meta.dirname, '..', 'publish-mobile-ipa.mjs')), '派发的目标必须真在位(门 89 R7 同型)')
})

test('R7 执行器契约锁:未判定归 exit 2、真失败归 1(两档混了就会天天喊或永远不喊)', () => {
  const exec = readFileSync(join(import.meta.dirname, '..', 'publish-mobile-ipa.mjs'), 'utf-8')
  assert.match(exec, /return 2/, '取不到版本号/取不到包必须按未判定退出')
  assert.match(exec, /未判定:release 资产取不到/, '跨境段取包失败要归"没有输入",不归"腿坏了"')
  assert.match(exec, /if \(!reg\.ok\) return 1/, '包已上腿但登记不成才算真失败')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
