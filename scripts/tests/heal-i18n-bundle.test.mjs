// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/heal-i18n-bundle.mjs(§22c —— import 源脚本 __test__,不复制判据)
// 跑法:node --test scripts/tests/heal-i18n-bundle.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { __test__ as heal } from '../heal-i18n-bundle.mjs'
// 落地器的**解析面**:分隔符这类两边字面约定,只能拿对方自己的解析器 round-trip,不许在测试里再抄一遍
import { parseArgs as parseLandArgs } from '../object-space-land.mjs'
import { __test__ as gate } from '../check-miniapp-generated.mjs'
import { renderPin } from '../lib/generated-input-pin.mjs'
import { bundleInputRels } from '../lib/i18n-bundle-inputs.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

function git(dir, args) {
  return execFileSync(
    'git',
    [
      '-c',
      'safe.directory=*',
      '-c',
      'core.quotepath=false',
      '-c',
      'user.email=t@t',
      '-c',
      'user.name=t',
      '-C',
      dir,
      ...args,
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/** 只记"被调了几次 / 拿到什么"的假出口 —— 本器的红线是"不该动的东西一次都不许动" */
function spy(returns = { ok: true }) {
  const calls = []
  const fn = (arg) => {
    calls.push(arg)
    return returns
  }
  return [fn, calls]
}

/* ───────────────── H1–H7:闭环各档(全注入,不碰真 git/真生成器/真 HEAD) ───────────────── */

const baseCtx = () => ({
  face: 'head',
  root: 'FAKE',
  judge: () => ({ state: 'stale', pinned: 'a'.repeat(64), computed: 'b'.repeat(64), inputs: 12 }),
  inFlight: () => ({ busy: [], lagging: [] }),
  runGenerator: () => ({ ok: true }),
  pinOfFresh: () => ({ present: true, digest: 'b'.repeat(64) }), // == verdict.computed
  oidOfFace: () => 'FACEOID',
  oidOfDisk: () => 'DISKOID',
  land: () => ({ ok: true }),
  maxChangedBytes: 10, // 让"changed 字节"这条闸在测试里真能被打到
})

test('H1 面上钉与现算相等 ⇒ clean,生成器与落地器一次都不许被调(健康仓零副作用)', () => {
  const [gen, genCalls] = spy()
  const [land, landCalls] = spy()
  const r = heal.healI18nBundle({
    ...baseCtx(),
    judge: () => ({ state: 'clean', pinned: 'x', inputs: 12 }),
    runGenerator: gen,
    land,
  })
  assert.equal(r.state, 'clean')
  assert.equal(genCalls.length, 0, 'clean 还去跑生成器 = 每次守护都重写一遍产物')
  assert.equal(landCalls.length, 0, 'clean 决不许落 HEAD')
})

test('H2 在飞副本命中 ⇒ refused,生成器一次都不跑(§12 不替别人覆盖现场)', () => {
  const [gen, genCalls] = spy()
  const r = heal.healI18nBundle({
    ...baseCtx(),
    inFlight: () => ({
      busy: [{ rel: 'p/q.ts', faceOid: 'f1', disk: 'd1', why: '盘上那份不在该路径任何历史版本里' }],
      lagging: [],
    }),
    runGenerator: gen,
  })
  assert.equal(r.state, 'refused')
  assert.match(r.detail, /在飞副本闸/)
  assert.ok(
    r.detail.includes('盘上那份不在该路径任何历史版本里'),
    `拒绝理由必须原样点名,实际:${r.detail}`,
  )
  assert.equal(genCalls.length, 0)
})

test('H3 滞后副本不构成让路 ⇒ 照干,并把"几份是滞后"报出来(护栏天天让路=器物永不干活)', () => {
  const [gen, genCalls] = spy()
  const r = heal.healI18nBundle({
    ...baseCtx(),
    inFlight: () => ({ busy: [], lagging: [{ rel: 'p/a.gen.ts', faceOid: 'f', disk: 'old' }] }),
    runGenerator: gen,
    maxChangedBytes: 10_000_000,
  })
  assert.equal(genCalls.length, 1, '滞后副本应当继续动手')
  assert.equal(r.state, 'written', `没给 --apply 只该写到工作区,实得 ${r.state}`)
  assert.match(r.detail, /滞后副本/)
})

test('H4 生成器没跑成 ⇒ refused,绝不把"没生成"洗成"已修"', () => {
  const [land, landCalls] = spy()
  const r = heal.healI18nBundle({
    ...baseCtx(),
    runGenerator: () => ({ ok: false, why: 'ENOENT' }),
    land,
  })
  assert.equal(r.state, 'refused')
  assert.match(r.detail, /生成器未跑成/)
  assert.equal(landCalls.length, 0)
})

test('H5 重跑出来的新钉 ≠ 面上现算输入哈希 ⇒ refused(器物不得自证空转)', () => {
  const [land, landCalls] = spy()
  const r = heal.healI18nBundle({
    ...baseCtx(),
    pinOfFresh: () => ({ present: true, digest: 'z'.repeat(64) }),
    land,
  })
  assert.equal(r.state, 'refused')
  assert.match(r.detail, /重跑后新钉/)
  assert.equal(landCalls.length, 0, '口径不同形时落半套比不落更坏')
})

test('H6 --apply 且各闸全过 ⇒ landed,落地器拿到 7 份路径与 blob 清单', () => {
  const [land, landCalls] = spy()
  const r = heal.healI18nBundle({ ...baseCtx(), apply: true, land, maxChangedBytes: 10_000_000 })
  assert.equal(r.state, 'landed', r.detail)
  assert.equal(landCalls.length, 1)
  assert.deepEqual(
    landCalls[0].paths.sort(),
    [...heal.TARGET_PATHS].sort(),
    '落地清单必须一次带走全部 7 份落点',
  )
  assert.match(landCalls[0].proof, /hash-object/, 'LAND_BLOB_PROOF 要说清字节是怎么算出来的')
})

test('H7 写回量超上限 ⇒ refused 且**不落 HEAD**,并如实说工作区已被写(不许谎称"已复原")', () => {
  const [land, landCalls] = spy()
  const r = heal.healI18nBundle({ ...baseCtx(), apply: true, land, maxChangedBytes: -1 })
  assert.equal(r.state, 'refused')
  assert.match(r.detail, /写回量 .* > 上限/)
  assert.equal(landCalls.length, 0)
  assert.match(r.detail, /git checkout --/, '出路必须给真跑得通的那一条(§0.8)')
})

/* ───────────────── H8–H9:在飞/滞后的判别(真临时 git 仓) ───────────────── */

function makeHistoryRepo(rel) {
  const dir = mkScratch('hib-hist')
  git(dir, ['init', '-q', '-b', 'main'])
  put(dir, rel, 'V1\n')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'v1'])
  put(dir, rel, 'V2\n')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'v2'])
  return dir
}

test('H8 盘上=该路径历史里的旧版 ⇒ 判滞后;盘上=从没入库过的新内容 ⇒ 判在飞(成对对照)', () => {
  const rel = heal.TARGET_PATHS[0]
  const dir = makeHistoryRepo(rel)
  try {
    // 正向对照:这把尺子看得见"正常那份"(盘 == 面 ⇒ equal)
    const equal = heal.classifyCopyDelta({ rel, face: 'head', root: dir })
    assert.equal(equal.kind, 'equal', `HEAD 就是 V2 而盘上也是 V2 ⇒ 应判 equal,实得 ${equal.kind}`)

    // ① 滞后副本:把盘上回退成 V2 的**祖先版本**(旁路落地不写工作树就是这个形态)
    put(dir, rel, 'V1\n')
    const lag = heal.classifyCopyDelta({ rel, face: 'head', root: dir })
    assert.equal(
      lag.kind,
      'lagging-copy',
      `盘上是该路径历史上真出现过的 V1 ⇒ 应判滞后,实得 ${lag.kind}`,
    )

    // ② 未落库的生成器输出:从没入过库,但结构上就是生成器吐的 ⇒ 覆盖它不丢信息,不该让路
    put(
      dir,
      rel,
      [
        '// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)',
        renderPin({
          generator: 'g',
          sourceCommit: 'x',
          inputs: [{ rel: 'a.json', text: '{}' }],
          generatedAt: '2026-01-01T00:00:00.000Z',
        }).join('\n'),
        'export const REMOTE_LOCALE_B64 = {}',
        '',
      ].join('\n'),
    )
    const regen = heal.classifyCopyDelta({ rel, face: 'head', root: dir })
    assert.equal(
      regen.kind,
      'generated-copy',
      `自称产物(横幅+钉齐全)而从未入库 ⇒ 应判生成器输出,实得 ${regen.kind}:${regen.why}`,
    )

    // ③ 在飞改写:既不在历史里、又不是生成器形态
    put(dir, rel, 'SOMEONE-ELSE-IS-WRITING\n')
    const busy = heal.classifyCopyDelta({ rel, face: 'head', root: dir })
    assert.equal(
      busy.kind,
      'in-flight',
      `盘上那份不是生成器形态也不是历史版 ⇒ 必须判在飞并让路,实得 ${busy.kind}`,
    )
    assert.match(String(busy.why), /不在历史里|不是生成器形态/)
  } finally {
    rmScratch(dir)
  }
})

test('H9 历史取不到(判据失去凭据)⇒ 保守判在飞,绝不"证明不了就当滞后"放行覆盖', () => {
  const rel = heal.TARGET_PATHS[0]
  const dir = mkScratch('hib-nogit')
  try {
    put(dir, rel, 'ON-DISK\n') // 盘上有、面上取不到 ⇒ 唯一能走通的失效方向是不动手
    const r = heal.classifyCopyDelta({
      rel,
      face: 'head',
      root: dir,
      run: () => {
        throw new Error('git 不可用')
      },
    })
    assert.equal(r.kind, 'in-flight', `取不到凭据时失效方向必须是**不动手**,实得 ${r.kind}`)
    assert.ok(String(r.why ?? '').length > 0, '让路必须点名为什么让(不静默)')
  } finally {
    rmScratch(dir)
  }
})

/* ───────────────────── H10:判定与守门 105 同基准(摘掉即翻红) ───────────────────── */

test('H11 落地 env 必须过落地器自己的解析器(分隔符写错的现场实测:整串被当一条路径 ⇒ 整轮静默 refused)', () => {
  const dir = mkScratch('hib-landenv')
  const repo = resolve(import.meta.dirname, '..', '..')
  try {
    // blob 取**真仓 HEAD 上在位**的对象:落地器的空内容守卫要能量到字节数,编 oid 会被判"取不到"
    const realOid = (p) => git(repo, ['rev-parse', `HEAD:${p}`]).trim()
    const manifest = join(dir, 'blobs.json')
    writeFileSync(
      manifest,
      JSON.stringify({ files: heal.TARGET_PATHS.map((p) => ({ path: p, blob: realOid(p) })) }),
      'utf8',
    )
    const env = heal.landEnv({
      paths: heal.TARGET_PATHS,
      manifest,
      msg: 'MSG',
      proof: 'P',
    })
    const parsed = parseLandArgs({ ...env, LAND_ROOT: repo })
    assert.equal(parsed.error, undefined, `落地器解析面直接拒了:${parsed.error}`)
    assert.deepEqual(
      parsed.paths,
      heal.TARGET_PATHS,
      `LAND_PATHS 经落地器解析后必须逐条回来,实得 ${JSON.stringify(parsed.paths)}`,
    )
    assert.equal(parsed.msg, 'MSG')
    assert.equal(heal.LAND_PATHS_SEP, ';', '分隔符的唯一出口必须就是落地器契约那一个')
  } finally {
    rmScratch(dir)
  }
})

test('H10 judgeStaleness 与门 105 的 G5 用同一把尺:输入一改就 stale,还原就 clean', () => {
  const dir = mkScratch('hib-judge')
  try {
    const inputs = []
    for (const l of gate.REMOTE_LOCALES) {
      put(dir, gate.baseSourceRel(l), JSON.stringify({ greeting: `hi-${l}` }))
      put(dir, gate.overrideSourceRel(l), JSON.stringify({ local: `${l}-only` }))
      put(dir, gate.carriedSourceRel(l), JSON.stringify({ carried: { note: `c-${l}` } }))
      inputs.push(
        { rel: gate.baseSourceRel(l), text: JSON.stringify({ greeting: `hi-${l}` }) },
        { rel: gate.overrideSourceRel(l), text: JSON.stringify({ local: `${l}-only` }) },
        { rel: gate.carriedSourceRel(l), text: JSON.stringify({ carried: { note: `c-${l}` } }) },
      )
    }
    const pin = renderPin({
      generator: 'x',
      sourceCommit: 'cafebabe',
      inputs,
      generatedAt: '2026-01-01T00:00:00.000Z',
    }).join('\n')
    put(dir, gate.I18N_BUNDLE, `// GENERATED\n${pin}\nexport const REMOTE_LOCALE_B64 = {}\n`)

    const clean = heal.judgeStaleness({ face: 'worktree', root: dir })
    assert.equal(
      clean.state,
      'clean',
      `钉与现算同值时应判 clean,实得 ${clean.state}:${clean.why ?? ''}`,
    )
    assert.equal(
      clean.inputs,
      gate.REMOTE_LOCALES.length * 3,
      '承载层必须算进输入集(2026-10-27 那起恒红的正身)',
    )

    // 只改承载层那一份源(门 105 过去看不见的那一层)⇒ 必须立刻 stale
    put(dir, gate.carriedSourceRel('ja'), JSON.stringify({ carried: { note: 'LATER-EDIT' } }))
    const stale = heal.judgeStaleness({ face: 'worktree', root: dir })
    assert.equal(stale.state, 'stale', `改了承载层源而钉没重算 ⇒ 应判 stale,实得 ${stale.state}`)
    assert.notEqual(stale.computed, stale.pinned)

    // 反向对照:把面上根本没有 RN 词包的那一格也量一遍(不该因此冒红)
    const bare = mkScratch('hib-judge-bare')
    try {
      const bareInputs = []
      for (const l of gate.REMOTE_LOCALES) {
        put(bare, gate.baseSourceRel(l), JSON.stringify({ greeting: `hi-${l}` }))
        put(bare, gate.overrideSourceRel(l), JSON.stringify({ local: `${l}-only` }))
        bareInputs.push(
          { rel: gate.baseSourceRel(l), text: JSON.stringify({ greeting: `hi-${l}` }) },
          { rel: gate.overrideSourceRel(l), text: JSON.stringify({ local: `${l}-only` }) },
        )
      }
      const barePin = renderPin({
        generator: 'x',
        sourceCommit: 'c',
        inputs: bareInputs,
        generatedAt: '2026-01-01T00:00:00.000Z',
      }).join('\n')
      put(bare, gate.I18N_BUNDLE, `// GENERATED\n${barePin}\nexport const REMOTE_LOCALE_B64 = {}\n`)
      const r = heal.judgeStaleness({ face: 'worktree', root: bare })
      assert.equal(
        r.state,
        'clean',
        `面上没有 RN 词包时两层口径应判 clean(不得造恒红门),实得 ${r.state}`,
      )
      assert.equal(r.inputs, gate.REMOTE_LOCALES.length * 2)
      // 与门那条规则逐字同集(本器不得自立第三套清单)
      assert.deepEqual(
        bundleInputRels(gate.REMOTE_LOCALES, (rel) => gate.makeReader('worktree', bare).has(rel))
          .length,
        r.inputs,
        '输入集构造必须只有一条规则',
      )
    } finally {
      rmScratch(bare)
    }
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
