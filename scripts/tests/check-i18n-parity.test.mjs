// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-i18n-parity 镜像测试(2026-11-04,修复 --target 未实现 + 恒 exit 0 时立)。
 *
 * 钉住四件事:
 *  ① 某 target 缺 key ⇒ exit 1 且点名缺失键;
 *  ② 键集全齐 ⇒ exit 0;
 *  ③ --target 不存在 ⇒ exit 2(不冒充 0);
 *  ④ 多余 key ⇒ exit 1(与 check-i18n-keys / check-cli-i18n-parity 同口径)。
 *
 * 夹具一律建在 mkScratch 临时根,经真实子进程跑门 —— 断言的是进程退出码,
 * 不是判据函数的返回值(后者无法证明"门有没有把 0 写死")。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-i18n-parity.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(HERE, '..', 'check-i18n-parity.mjs')
const REPO_ROOT = join(HERE, '..', '..')

function writeLocale(root, target, locale, data) {
  const dir = join(root, 'packages', 'i18n', 'messages', target)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${locale}.json`), JSON.stringify(data, null, 2), 'utf8')
}

function runGate(root, args = []) {
  const r = spawnSync('node', [SOURCE_SCRIPT, `--root=${root}`, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = `${r.stdout || ''}${r.stderr || ''}`
  return r
}

const FULL = { greeting: 'hello', nested: { a: 'A', b: 'B' } }

/** 建一组合法夹具:clean 全齐;missing 的 zh-CN 少 nested.b;extra 的 zh-CN 多 onlyZh。 */
function createFixture() {
  const root = mkScratch('ihui-i18n-parity-')
  for (const locale of gate.REQUIRED_LOCALES) {
    writeLocale(root, 'clean', locale, FULL)
    writeLocale(
      root,
      'missing',
      locale,
      locale === 'zh-CN' ? { greeting: '你好', nested: { a: 'A' } } : FULL,
    )
    writeLocale(root, 'extra', locale, locale === 'zh-CN' ? { ...FULL, onlyZh: '仅中文' } : FULL)
  }
  return root
}

test('端名单: 真实仓库 messages 目录实测枚举 = 既有登记的 7 端', () => {
  const { targets, error } = gate.listTargets(join(REPO_ROOT, 'packages', 'i18n', 'messages'))
  assert.equal(error, null)
  assert.deepEqual(targets, gate.KNOWN_TARGET_ORDER)
  assert.equal(targets.length, 7)
})

test('① 缺 key ⇒ exit 1 且点名缺失键', () => {
  const root = createFixture()
  try {
    const r = runGate(root, ['--target=missing'])
    assert.equal(r.status, 1, `缺 key 应 exit 1,实得 ${r.status}\n${r.out}`)
    assert.match(r.out, /nested\.b/)
  } finally {
    rmScratch(root)
  }
})

test('② 键集全齐 ⇒ exit 0', () => {
  const root = createFixture()
  try {
    const r = runGate(root, ['--target=clean'])
    assert.equal(r.status, 0, `全齐应 exit 0,实得 ${r.status}\n${r.out}`)
  } finally {
    rmScratch(root)
  }
})

test('③ --target 不存在 ⇒ exit 2(不冒充 0)', () => {
  const root = createFixture()
  try {
    const r = runGate(root, ['--target=nosuch'])
    assert.equal(r.status, 2, `未知 target 应 exit 2,实得 ${r.status}\n${r.out}`)
    assert.match(r.out, /不是受支持的端/)
    assert.match(r.out, /clean \/ extra \/ missing/)
  } finally {
    rmScratch(root)
  }
})

test('③b --target= 空值 ⇒ exit 2(不得按"未点名"回落全量)', () => {
  const root = createFixture()
  try {
    const r = runGate(root, ['--target='])
    assert.equal(r.status, 2)
    assert.match(r.out, /需要一个端名/)
  } finally {
    rmScratch(root)
  }
})

test('④ 多余 key ⇒ exit 1(与既有门同口径)', () => {
  const root = createFixture()
  try {
    const r = runGate(root, ['--target=extra'])
    assert.equal(r.status, 1, `多余 key 应 exit 1,实得 ${r.status}\n${r.out}`)
    assert.match(r.out, /onlyZh/)
  } finally {
    rmScratch(root)
  }
})

test('未给 --target ⇒ 全量跑,任一端漂移即 exit 1', () => {
  const root = createFixture()
  try {
    const r = runGate(root)
    assert.equal(r.status, 1, `全量档应因 missing/extra 判红,实得 ${r.status}\n${r.out}`)
    assert.match(r.out, /\[missing\]/)
    assert.match(r.out, /\[extra\]/)
  } finally {
    rmScratch(root)
  }
})

test('--target 空格形态与 = 形态同义', () => {
  const root = createFixture()
  try {
    const a = runGate(root, ['--target', 'clean'])
    const b = runGate(root, ['--target=clean'])
    assert.equal(a.status, 0)
    assert.equal(b.status, 0)
  } finally {
    rmScratch(root)
  }
})

test('判据: getAllKeys 递归展平,数组/标量为叶子', () => {
  assert.deepEqual(gate.getAllKeys({ nav: { home: 'H' }, actions: ['x'], top: 'T' }).sort(), [
    'actions',
    'nav.home',
    'top',
  ])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
