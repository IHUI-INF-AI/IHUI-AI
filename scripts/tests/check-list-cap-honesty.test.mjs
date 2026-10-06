// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-list-cap-honesty.mjs(§22c 模式)。
 *
 * 判据本体(`SLICE_RE` / `OMITTED_RE` / `STRINGISH_RE` / `DYNAMIC_SLICE_RE` /
 * `judgeSlice` / `scanFile` / `listScanFiles` 与扫描面 `SCAN_DIR`)全部从
 * `../check-list-cap-honesty.mjs` 的 `__test__` 出口取;本文件不声明任何形态清单、
 * 也不在这里重写"±20 行窗口"那条取材口径(那是 scanFile 的判据,由 scanFile 自己跑)。
 *
 * 断言输入逐字取自真仓 HEAD(经 scripts/lib/face-reader.mjs 的 catBatch 现读):
 *   · apps/web/src/components/ai/progress-sections/terminal-section.tsx(动态界 ⇒ 未判定 + omitted 证据行)
 *   · apps/web/src/components/ai/progress-sections/changes-section.tsx(路径尾截 ⇒ 不判)
 *   · apps/web/src/components/ai/progress-sections/thinking-section.tsx(文本尾截 ⇒ 不判)
 *   · apps/web/src/hooks/use-task-receiver.ts(集合裁尾且无 omitted ⇒ 命中形状)
 *
 * 成对口径:
 *   L1 真站点四格各归位(命中 / 放过之外,还有"不判"与"未判定",四态不并桶)/
 *   L2 同一行原文,换窗口 ⇒ hit↔cleared 翻面(证明 omitted 那一维真有牙)/
 *   L3 四条正则各自的正反命中(全部跑在 HEAD 原文上)/
 *   L4 listScanFiles 枚举 + scanFile 自算与 CLI 退出码同一结论/
 *   L5 端到 CLI(临时目录里的门副本):裁尾不报数必红并点名,补上诚实披露必绿。
 * 不钉任何存量数字(AGENTS §12e:把存量写进断言 = 修好了那天冒出一条无关的红)。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as gate } from '../check-list-cap-honesty.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(SCRIPTS_DIR, '..')
const GATE_REL = 'check-list-cap-honesty.mjs'

const TERMINAL_REL = `${gate.SCAN_DIR}/terminal-section.tsx`
const CHANGES_REL = `${gate.SCAN_DIR}/changes-section.tsx`
const THINKING_REL = `${gate.SCAN_DIR}/thinking-section.tsx`
const RECEIVER_REL = 'apps/web/src/hooks/use-task-receiver.ts'

const BLOB_SPECS = [TERMINAL_REL, CHANGES_REL, THINKING_REL, RECEIVER_REL].map((r) => `HEAD:${r}`)
const READ = catBatch(REPO_ROOT, BLOB_SPECS, { timeout: 120_000 })
const BLOBS = {}
for (const [i, rel] of [TERMINAL_REL, CHANGES_REL, THINKING_REL, RECEIVER_REL].entries()) {
  const text = READ.get(BLOB_SPECS[i])
  if (typeof text !== 'string') throw new Error(`HEAD 面取不到 ${rel} ⇒ 取证失败,不记绿`)
  BLOBS[rel] = text
}

/** 在 HEAD 原文里按"数据锚点"现取那一行(锚点漂了本条自己红,不会静默换样本)。 */
function headLine(rel, anchor) {
  const hit = BLOBS[rel].split('\n').find((l) => l.includes(anchor))
  if (typeof hit !== 'string') throw new Error(`${rel} 的 HEAD 面里找不到锚点 ${anchor} ⇒ 真站点已漂移,先核对再改本条`)
  return hit
}

const DYNAMIC_LINE = headLine(TERMINAL_REL, 'fullOutput.slice(-')
const PATH_LINE = headLine(CHANGES_REL, 'parts.slice(-')
const TEXT_LINE = headLine(THINKING_REL, 'trimmed.slice(-')
const BARE_LINE = headLine(RECEIVER_REL, 'arr.slice(-')
const OMITTED_LINE = headLine(TERMINAL_REL, 'omittedCount } = tailWithOmittedCount(')

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  return abs
}

function runGate(scriptAbs, args) {
  try {
    const out = execFileSync(process.execPath, [scriptAbs, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: typeof e?.status === 'number' ? e.status : -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
  }
}

test('L1 真站点四格各归位:命中 / 不判(路径)/ 不判(文本)/ 未判定 —— 四态不并桶', () => {
  const dir = mkScratch('list-cap-mirror-')
  try {
    const found = {}
    for (const rel of [TERMINAL_REL, CHANGES_REL, THINKING_REL, RECEIVER_REL]) {
      const local = put(dir, rel, BLOBS[rel])
      found[rel] = gate.scanFile(local, rel)
    }
    const dyn = found[TERMINAL_REL].filter((f) => f.undetermined === true)
    assert.equal(dyn.length, 1, `动态界必须被登记成 1 处未判定(实得 ${JSON.stringify(found[TERMINAL_REL])})`)
    assert.equal(dyn[0].text, DYNAMIC_LINE.trim(), '未判定那一格报的必须是 HEAD 那一行原文')
    assert.equal(
      found[TERMINAL_REL].filter((f) => f.undetermined !== true).length,
      0,
      '动态界不得被冒判成命中(判不了就是判不了,冒红与静默放过同罪)',
    )
    assert.deepEqual(found[CHANGES_REL], [], `路径尾截属"票面明示不判",不得出现在任何一格里:${JSON.stringify(found[CHANGES_REL])}`)
    assert.deepEqual(found[THINKING_REL], [], `文本尾截同上:${JSON.stringify(found[THINKING_REL])}`)
    const bare = found[RECEIVER_REL].filter((f) => f.undetermined !== true)
    assert.equal(bare.length, 1, `集合裁尾且窗口内无 omitted ⇒ 必须恰 1 处命中:${JSON.stringify(found[RECEIVER_REL])}`)
    assert.equal(bare[0].text, BARE_LINE.trim(), '命中那一格报的必须是 HEAD 那一行原文')
  } finally {
    rmScratch(dir)
  }
})

test('L2 同一行原文换窗口即翻面:无披露 ⇒ 命中,补上 HEAD 的诚实披露行 ⇒ 放过', () => {
  const alone = gate.judgeSlice(BARE_LINE, BARE_LINE)
  assert.equal(alone, 'hit', '这一行自己就是"裁尾不报数"的形状')
  const honest = gate.judgeSlice(BARE_LINE, `${OMITTED_LINE}\n${BARE_LINE}`)
  assert.equal(honest, 'cleared', '同一行,窗口里出现 HEAD 的 omittedCount 披露行就必须放过(否则判据不认它自己要求的证据)')
  assert.notEqual(alone, honest, '正反两臂同形 ⇒ omitted 这一维是装饰,不是判据')
  const stillSkipping = gate.judgeSlice(PATH_LINE, `${OMITTED_LINE}\n${PATH_LINE}`)
  assert.equal(stillSkipping, 'skip', '路径尾截不因为窗口里有 omitted 就被改判(不判的那一格不得被拉进来)')
})

test('L3 四条形态正则各自有正反,且都跑在 HEAD 原文上', () => {
  gate.SLICE_RE.lastIndex = 0
  const onBare = gate.SLICE_RE.exec(BARE_LINE)
  assert.ok(onBare, 'SLICE_RE 必须认得 HEAD 的集合裁尾那一行')
  assert.equal(onBare[1], 'arr', '接收者必须是切出来的那一段,不是整行')
  assert.equal(onBare[2], '100', '界常量位必须是原文里的数字')
  gate.SLICE_RE.lastIndex = 0
  const onDyn = gate.SLICE_RE.exec(DYNAMIC_LINE)
  assert.ok(onDyn && onDyn[2] === 'OUTPUT_PREVIEW_LIMIT', '动态界也要能切出来,否则 DYNAMIC_SLICE_RE 无从对齐')
  assert.ok(gate.DYNAMIC_SLICE_RE.test(DYNAMIC_LINE), '动态界必须落 DYNAMIC_SLICE_RE')
  assert.ok(!gate.DYNAMIC_SLICE_RE.test(BARE_LINE), '数字界被认成动态 ⇒ 全仓的静态裁尾都会滑进未判定')
  gate.SLICE_RE.lastIndex = 0
  const pathRecv = gate.SLICE_RE.exec(PATH_LINE)?.[1] ?? ''
  assert.ok(gate.STRINGISH_RE.test(pathRecv), '路径尾截的接收者必须落在这张"不判"名单里')
  assert.ok(!gate.STRINGISH_RE.test('arr'), '集合接收者不得被 STRINGISH 吞掉(那会把命中静默判成不判)')
  assert.ok(!gate.STRINGISH_RE.test('fullOutput'), '同上:fullOutput 也不属字符串/路径语义词')
  assert.ok(gate.OMITTED_RE.test(OMITTED_LINE), 'omitted 证据行必须被 OMITTED_RE 认得')
  assert.ok(!gate.OMITTED_RE.test(BARE_LINE), '裁尾行自己不含披露 ⇒ 这一维才是有内容的')
})

test('L4 扫描面枚举非空且逐项在 SCAN_DIR 内;scanFile 自算结论与 CLI 退出码同一答案', () => {
  const face = gate.listScanFiles()
  assert.ok(Array.isArray(face) && face.length > 0, `扫描面枚举到 0(${gate.SCAN_DIR})⇒ 尺子失明,不得当成"全仓干净"`)
  for (const rel of face) {
    assert.ok(
      rel.split(sep).join('/').startsWith(gate.SCAN_DIR),
      `枚举项 ${rel} 不在 SCAN_DIR(${gate.SCAN_DIR})里 ⇒ 覆盖面漂移`,
    )
  }
  let hits = 0
  let undetermined = 0
  for (const rel of face) {
    for (const f of gate.scanFile(join(REPO_ROOT, rel), rel)) {
      if (f.undetermined === true) undetermined++
      else hits++
    }
  }
  const cli = runGate(join(SCRIPTS_DIR, GATE_REL), [])
  console.log(
    `    · 现读:扫描面 ${face.length} 文件 / 自算命中 ${hits} / 自算未判定 ${undetermined} / CLI exit ${cli.code}`,
  )
  assert.equal(
    hits === 0,
    cli.code === 0,
    `自算(${hits} 处命中)与 CLI 退出码(${cli.code})结论相反 ⇒ 有一面在说谎:${cli.out}`,
  )
  if (hits > 0) {
    assert.ok(/hit/.test(cli.out), `CLI 判红必须逐条点名:${cli.out}`)
  }
  assert.ok(!/无法判定/.test(cli.out), `扫描面存在时不得报"无法判定":${cli.out}`)
})

test('L5 端到 CLI(临时目录里的门副本):裁尾不报数必红并点名,补 HEAD 的诚实披露行必绿', () => {
  const dir = mkScratch('list-cap-cli-')
  try {
    const scriptsCopy = join(dir, 'scripts')
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, scriptsCopy, ['lib/scratch-dir.mjs'])
    const gateAbs = join(scriptsCopy, GATE_REL)
    const fixtureRel = join(gate.SCAN_DIR, 'mirror-fixture.tsx')
    put(dir, fixtureRel, `export function render(items: unknown[]) {\n${BARE_LINE}\n  return items\n}\n`)
    const bad = runGate(gateAbs, [])
    assert.equal(bad.code, 1, `有裁尾无披露必须 exit 1,实得 ${bad.code}:${bad.out}`)
    assert.ok(bad.out.includes('mirror-fixture.tsx'), `判红必须点名夹具文件:${bad.out}`)
    assert.ok(bad.out.includes(BARE_LINE.trim()), `判红必须把原文那一行带出来:${bad.out}`)
    put(
      dir,
      fixtureRel,
      `export function render(items: unknown[]) {\n${OMITTED_LINE}\n${BARE_LINE}\n  return items\n}\n`,
    )
    const good = runGate(gateAbs, [])
    assert.equal(good.code, 0, `补上 HEAD 的披露行就必须归零,实得 ${good.code}:${good.out}`)
    assert.ok(good.code !== bad.code, '两臂同形 ⇒ omitted 这一维在端到面上没有牙')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
