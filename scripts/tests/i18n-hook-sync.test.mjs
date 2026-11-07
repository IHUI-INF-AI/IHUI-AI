// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n-hook-sync.test.mjs —— 提交链离线包派生腿的镜像测试(2026-11-04 立)
 *
 * 不碰真 git / 真生成器:heal 与 stage 全部注入。
 * 覆盖三件事:① clean 必须零写盘(元数据抖动不触发重写);② ready 必须落索引并**复判**;
 * ③ refused/undetermined/blocked 一律不许被读成通过。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXIT_CODE, runSync } from '../hook-i18n-bundle-sync.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOOK_REL = resolve(HERE, '../lib/pre-commit-hook.js')
const LEG_REL = 'scripts/hook-i18n-bundle-sync.mjs'

const clean = (digest = 'a'.repeat(16)) => ({ state: 'clean', digest })
const ready = (paths) => ({
  state: 'ready',
  digest: 'b'.repeat(16),
  files: paths.map((path) => ({ path, blob: 'c'.repeat(40) })),
})

test('T1 clean ⇒ 零写盘(只改 generatedAt 类元数据的轮次不会触发重生成)', () => {
  let staged = 0
  const res = runSync({
    heal: () => clean(),
    stage: () => {
      staged++
    },
  })
  assert.equal(res.state, 'clean')
  assert.equal(res.files.length, 0)
  assert.equal(staged, 0)
})

test('T2 ready ⇒ 先落索引,再复判 clean 才算通过', () => {
  const calls = []
  let healCount = 0
  const res = runSync({
    heal: () => {
      healCount++
      return healCount === 1
        ? ready(['apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts', 'x/ko.b64.txt'])
        : clean()
    },
    stage: ({ files }) => {
      calls.push(files.map((f) => f.path))
      return files.map((f) => f.path)
    },
  })
  assert.equal(res.state, 'healed')
  assert.equal(healCount, 2)
  assert.deepEqual(calls[0], [
    'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts',
    'x/ko.b64.txt',
  ])
  assert.equal(res.files.length, 2)
})

test('T3 落索引抛错 ⇒ blocked,不许报 healed', () => {
  let healCount = 0
  const res = runSync({
    heal: () => (++healCount === 1 ? ready(['a.ts']) : clean()),
    stage: () => {
      throw new Error('索引 blob 与申报不符')
    },
  })
  assert.equal(res.state, 'blocked')
  assert.match(res.why, /落索引失败/)
})

test('T4 落地后复判不是 clean ⇒ blocked', () => {
  let healCount = 0
  const res = runSync({
    heal: () => {
      healCount++
      return healCount === 1 ? ready(['a.ts']) : { state: 'refused', why: '又漂了' }
    },
    stage: () => ['a.ts'],
  })
  assert.equal(res.state, 'blocked')
  assert.match(res.why, /落地后复判不是 clean/)
})

test('T5 refused ⇒ 不落索引,原样点名', () => {
  let staged = 0
  const res = runSync({
    heal: () => ({ state: 'refused', why: '在飞副本闸:x' }),
    stage: () => {
      staged++
    },
  })
  assert.equal(res.state, 'refused')
  assert.equal(staged, 0)
})

test('T6 undetermined ⇒ 不猜、不落索引', () => {
  let staged = 0
  const res = runSync({
    heal: () => ({ state: 'undetermined', why: '取不到钉' }),
    stage: () => {
      staged++
    },
  })
  assert.equal(res.state, 'undetermined')
  assert.equal(staged, 0)
})

test('T7 ready 但变化集为空 ⇒ 判据矛盾,拒绝落地', () => {
  const res = runSync({ heal: () => ready([]), stage: () => [] })
  assert.equal(res.state, 'refused')
  assert.match(res.why, /变化集为空/)
})

test('T8 退出码:只有 clean/healed 是 0;未判定/拒绝/阻断分别非零', () => {
  assert.equal(EXIT_CODE.clean, 0)
  assert.equal(EXIT_CODE.healed, 0)
  assert.equal(EXIT_CODE.undetermined, 2)
  assert.equal(EXIT_CODE.refused, 3)
  assert.equal(EXIT_CODE.blocked, 4)
})

test('T9 装车锁:钩子链按 staged 触发 i18n 输入/生成器,且本段没有 skip 变量', () => {
  const src = readFileSync(HOOK_REL, 'utf8')
  const block = src.slice(src.indexOf('const I18N_INPUT_PREFIX'), src.indexOf('README 数字生成块'))
  assert.ok(block.includes("packages/i18n/messages/"), '钩子链缺少 i18n 输入触发面')
  assert.ok(block.includes('scripts/gen-i18n-compressed.mjs'), '钩子链缺少生成器触发面')
  assert.ok(block.includes(LEG_REL), '钩子链没有调用离线包派生腿')
  assert.ok(block.includes("'--staged', '--json'"), '钩子链必须以 staged 面 + JSON 调用')
  assert.ok(!/HUSKY_SKIP|skipEnv|SKIP_I18N/.test(block), '本腿不得引入 skip 变量')
})

test('T10 装车锁:钩子链对 healed 产物登记入口快照(防退出时被 unstage)', () => {
  const src = readFileSync(HOOK_REL, 'utf8')
  const block = src.slice(src.indexOf('const I18N_INPUT_PREFIX'), src.indexOf('README 数字生成块'))
  assert.ok(block.includes('INITIAL_STAGED_SNAPSHOT.add(f.path)'), 'healed 后未登记入口快照')
  assert.ok(block.includes('process.exit(1)'), '未通过时必须阻断提交')
})
