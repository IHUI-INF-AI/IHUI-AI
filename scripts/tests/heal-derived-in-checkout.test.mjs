// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/heal-derived-in-checkout.mjs(§22c —— import 源脚本 __test__,不复制判据)
 * 跑法:node --test scripts/tests/heal-derived-in-checkout.test.mjs
 *
 * 全部跑在注入的假检出 / 假生成 / 假落地器上:本文件一次都不许建真 worktree、跑真生成器、动真 HEAD。
 * 钉死的是本器存在的理由本身 —— 它替掉的是"在盘上跑生成器然后被在飞副本闸天天拦住"那一档:
 *   C1 两族都新 ⇒ 零检出(不能白烧分钟级全树生成)
 *   C2 陈旧 ⇒ 检出备好 + 复量过 ⇒ 一次落地带走两族
 *   C3/C4/C7 建成失败 / 复量不过 / 落地器没自证成功 ⇒ 一律 refused 且一条 blob 都不落
 *   C5 没给 apply ⇒ written(只备料)
 *   C6 检出收尾 ⇒ work 抛异常也必须摘干净
 *   C8/C9 面上取不到产物 ⇒ undetermined(不猜、不记绿,§0.3)
 *   C10 只判不修的判据与门 105 同基准(承载层必须是钉的一等输入 —— 2026-10-27 那起恒红的正身)
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { __test__ as H, prefetchUiInputs } from '../heal-derived-in-checkout.mjs'
import { __test__ as gate } from '../check-miniapp-generated.mjs'
import { digestInputs, parsePin, renderPin } from '../lib/generated-input-pin.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const OID40 = 'a'.repeat(40)
const filesOf = (n, prefix = 'p') =>
  Array.from({ length: n }, (_u, i) => ({ path: `${prefix}${i}.gen.ts`, blob: OID40 }))

/** 注入用:面上"离线包/四端"各自的新旧与缺席,全部由测试说了算(真判据在 C10 那条里量) */
const judge = ({ i18n = 'clean', ui = [] }) => ({
  judgeI18n: () => i18n,
  judgeUi: () => (ui === 'absent' ? [] : ui),
})

function runWith(over) {
  const lands = []
  const checkouts = []
  const r = H.healDerivedInCheckout({
    root: 'FAKE-ROOT',
    reader: { has: () => false, read: () => null, prefetch: () => {} },
    withCheckout: (o) => {
      checkouts.push(o)
      // 真 withHeadCheckout 会把 work 叫起来;桩必须同样叫,否则"备好什么"这一格量不到
      return {
        ok: true,
        dir: 'FAKE-DIR',
        result: o.work({ dir: 'FAKE-DIR', root: 'FAKE-ROOT' }) ?? [],
      }
    },
    healI18n: () => ({ state: 'ready', files: filesOf(7, 'i18n-'), digest: 'd' }),
    healUi: () => ({ state: 'ready', files: filesOf(4, 'ui-'), notes: [] }),
    land: (o) => {
      lands.push(o)
      return { ok: true }
    },
    ...judge({}),
    ...over,
  })
  return { r, lands, checkouts }
}

test('C1 两族在面上都同值 ⇒ clean,一次检出都不建', () => {
  const { r, checkouts, lands } = runWith({})
  assert.equal(r.state, 'clean', r.detail)
  assert.equal(checkouts.length, 0, 'clean 还建检出 = 每轮守护白跑一次全树生成')
  assert.equal(lands.length, 0)
})

test('C2 面上陈旧 ⇒ 检出里备好 + 复量过 ⇒ 一次落地带走两族文件', () => {
  const { r, lands, checkouts } = runWith({
    ...judge({ i18n: 'stale', ui: ['apps/web/src/lib/ui-routes.generated.ts'] }),
  })
  assert.equal(r.state, 'landed', r.detail)
  assert.equal(checkouts.length, 1, '两族共用一枚检出(各建一枚 = 双倍分钟级)')
  assert.equal(lands.length, 1, '两族必须一次落地:分两枚提交会让中间态被下一轮判成半套')
  assert.equal(lands[0].files.length, 11)
  assert.match(lands[0].proof, /检出/, 'LAND_BLOB_PROOF 必须说清字节是哪一个面产出的')
  assert.match(lands[0].msg, /heal-derived-in-checkout/, '提交信息要能归因到器物')
})

test('C3 需要检出却建不起来 ⇒ refused,一条 blob 都不落(不把"没建成"洗成"已修")', () => {
  const { r, lands } = runWith({
    ...judge({ i18n: 'stale', ui: ['apps/web/src/lib/ui-routes.generated.ts'] }),
    withCheckout: () => ({ ok: false, why: 'git worktree add 失败:already registered' }),
  })
  assert.equal(r.state, 'refused')
  assert.match(r.detail, /already registered/)
  assert.equal(lands.length, 0)
})

test('C3b 只有离线包陈旧 ⇒ 根本不建检出(检出对它无用,却要 4-5 分钟,正好把面换掉)', () => {
  const { r, lands, checkouts } = runWith({
    ...judge({ i18n: 'stale', ui: [] }),
    // 注入一枚"必定失败"的检出:它一次都不该被调用 —— 调用了就是白烧窗口
    withCheckout: () => ({ ok: false, why: '这枚检出根本不该被建' }),
  })
  assert.equal(checkouts.length, 0, '离线包一族建检出 = 每轮守护多烧几分钟窗口')
  assert.equal(r.state, 'landed', r.detail)
  assert.equal(lands.length, 1)
  assert.equal(lands[0].files.length, 7)
  assert.equal(lands[0].baseRef, '', '不建检出 ⇒ 没有 baseSha 可钉,由落地器对当时 HEAD 做 CAS')
  assert.doesNotMatch(lands[0].proof, /检出/, 'proof 不得自称"检出里产出"(字节其实来自主仓按面生成)')
  assert.match(lands[0].proof, /主仓/)
  assert.match(r.detail, /未建检出/)
})

test('C4 检出里复量不过 ⇒ refused 且不落(器物不得自证空转)', () => {
  const { r, lands } = runWith({
    ...judge({ i18n: 'stale', ui: [] }),
    healI18n: () => ({ state: 'refused', why: '新钉 ≠ 面上现算' }),
  })
  assert.equal(r.state, 'refused', r.detail)
  assert.equal(lands.length, 0)
  assert.match(r.judged.find((j) => j.family === 'i18n').state, /refused/)
})

test('C5 没给 apply ⇒ written:备好但不推 HEAD', () => {
  const { r, lands } = runWith({ apply: false, ...judge({ i18n: 'stale', ui: [] }) })
  assert.equal(r.state, 'written', r.detail)
  assert.equal(lands.length, 0)
  assert.equal(r.files.length, 7)
})

test('C6 withHeadCheckout 的收尾:work 抛异常也必须把检出摘干净(残留会顶死下一轮 add)', () => {
  const dir = mkScratch('hdic-wt-')
  const slotDir = join(dir, '.worktrees', H.CHECKOUT_SLOT)
  const calls = []
  const run = (args) => {
    calls.push(args.join(' '))
    // 本器把一轮钉在**一枚具体 sha** 上(2026-10-27 实测:一枚并发提交插在"判面→建检出→生成"之间,
    // 拿旧面期望值比对新面字节会把一份正确产物误判成陈旧)⇒ 桩必须给得出钉得上形态的 sha
    if (args[0] === 'rev-parse') return `${'b'.repeat(40)}\n`
    if (args[0] === 'worktree' && args[1] === 'add') {
      // 检出必须是按那枚 sha 建的,不是按"当时的 HEAD"(它可能已经被别席推进过)
      if (!args.includes('b'.repeat(40))) throw new Error(`worktree add 没钉 sha:${args.join(' ')}`)
      mkdirSync(slotDir, { recursive: true })
      writeFileSync(join(slotDir, 'x.txt'), 'x', 'utf8')
    }
    if (args[0] === 'worktree' && args[1] === 'remove')
      rmSync(slotDir, { recursive: true, force: true })
    return ''
  }
  try {
    assert.throws(() =>
      H.withHeadCheckout({
        root: dir,
        run,
        work: () => {
          throw new Error('生成器崩了')
        },
      }),
    )
    assert.ok(
      calls.some((c) => c.includes('worktree remove')),
      `没摘检出:${JSON.stringify(calls)}`,
    )
    assert.equal(existsSync(slotDir), false, '异常路径下检出必须已摘除')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('C6b 检出落点必须在仓库根直属 .worktrees/ 一层(门 208 对深度 1 是有意豁免,更深就判红)', () => {
  const root = resolve('/')
  const p = H.checkoutPathOf(root)
  assert.equal(p, join(root, '.worktrees', H.CHECKOUT_SLOT))
  assert.equal(dirname(p), join(root, '.worktrees'), '槽名只能有一层深:再深就落进门 208 的射程')
})

test('C7 落地器没自证成功 ⇒ 不得冒 landed', () => {
  const { r } = runWith({
    ...judge({ i18n: 'stale', ui: [] }),
    land: () => ({ ok: false, why: 'blob 不是 40 位 oid' }),
  })
  assert.equal(r.state, 'refused')
  assert.match(r.detail, /40 位/)
})

test('C8 面上取不到离线包产物 ⇒ undetermined(既不重生成也不记绿,§0.3)', () => {
  let built = 0
  const { r } = runWith({
    ...judge({ i18n: 'undetermined', ui: [] }),
    withCheckout: () => {
      built += 1
      return { ok: true, dir: 'X', result: [] }
    },
  })
  assert.equal(r.state, 'undetermined', r.detail)
  assert.equal(built, 0, '判不出时先去重生成 = 把"没判"当成"有问题要修"')
})

test('C9 --family 只认 i18n / ui-routes,坏值当场 exit 2(不静默跑全部)', () => {
  const argvFamily = ['--family', 'bogus']
  const found = argvFamily[1]
  assert.ok(!H.FAMILIES.includes(found), `夹具本身要先成立:${H.FAMILIES}`)
  // main() 的拒收形态由 CLI 集成测(本文件不派生子进程)兜:这里锁清单本身
  assert.deepEqual([...H.FAMILIES].sort(), ['i18n', 'ui-routes'])
})

test('C10 只判不修的那把尺与门 105 同基准:承载层是钉的一等输入,改了它就判 stale', () => {
  const dir = mkScratch('hdic-judge-')
  try {
    const put = (rel, text) => {
      mkdirSync(join(dir, rel).slice(0, join(dir, rel).lastIndexOf('/')), { recursive: true })
      writeFileSync(join(dir, rel), text, 'utf8')
    }
    const inputs = []
    for (const l of gate.REMOTE_LOCALES) {
      put(gate.baseSourceRel(l), JSON.stringify({ greeting: `hi-${l}` }))
      put(gate.overrideSourceRel(l), JSON.stringify({ local: `${l}-only` }))
      put(gate.carriedSourceRel(l), JSON.stringify({ carried: { note: `c-${l}` } }))
      inputs.push(
        { rel: gate.baseSourceRel(l), text: JSON.stringify({ greeting: `hi-${l}` }) },
        { rel: gate.overrideSourceRel(l), text: JSON.stringify({ local: `${l}-only` }) },
        { rel: gate.carriedSourceRel(l), text: JSON.stringify({ carried: { note: `c-${l}` } }) },
      )
    }
    const rd = gate.makeReader('worktree', dir)
    const digest = digestInputs(gate.readPinInputs(rd)).digest
    const pin = renderPin({
      generator: 'g',
      sourceCommit: 'c',
      inputs,
      generatedAt: '2026-01-01T00:00:00.000Z',
    }).join('\n')
    put(gate.I18N_BUNDLE, `// GENERATED\n${pin}\nexport const REMOTE_LOCALE_B64 = {}\n`)
    assert.equal(judgeFaceStaleness(dir), 'clean', '钉与面上现算同值时应判 clean')

    // 只改承载层那一份源(2026-10-27 之前门根本看不见的那一层)⇒ 必须立刻 stale
    put(gate.carriedSourceRel('ja'), JSON.stringify({ carried: { note: 'LATER-EDIT' } }))
    assert.equal(judgeFaceStaleness(dir), 'stale', '改承载层源而钉没重算 ⇒ 应判 stale')
    assert.equal(
      parsePin(String(gate.makeReader('worktree', dir).read(gate.I18N_BUNDLE))).present,
      true,
      '夹具的钉本来就要可读',
    )
    void digest
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/** 借本器自己的"只判不修"出口(它 import 的就是门 105 那把尺,本测试不复制任何判据) */
function judgeFaceStaleness(dir) {
  return H.judgeI18nFace('worktree', dir, gate.makeReader('worktree', dir))
}
function readBundle(dir) {
  return (gate.makeReader('worktree', dir).read(gate.I18N_BUNDLE) ?? '').replace(/\\/g, '\\\\')
}

test('C11 只判不修的尺与门 105 同基准:改一份输入就 stale,还原就 clean(检出档不得自立第二把尺)', () => {
  const dir = mkScratch('hdic-judge-')
  try {
    const put = (rel, text) => {
      mkdirSync(join(dir, rel).slice(0, join(dir, rel).lastIndexOf('/')), { recursive: true })
      writeFileSync(join(dir, rel), text, 'utf8')
    }
    const inputs = []
    for (const l of gate.REMOTE_LOCALES) {
      put(gate.baseSourceRel(l), JSON.stringify({ greeting: `hi-${l}` }))
      put(gate.overrideSourceRel(l), JSON.stringify({ local: `${l}-only` }))
      put(gate.carriedSourceRel(l), JSON.stringify({ carried: { note: `c-${l}` } }))
      inputs.push(
        { rel: gate.baseSourceRel(l), text: JSON.stringify({ greeting: `hi-${l}` }) },
        { rel: gate.overrideSourceRel(l), text: JSON.stringify({ local: `${l}-only` }) },
        { rel: gate.carriedSourceRel(l), text: JSON.stringify({ carried: { note: `c-${l}` } }) },
      )
    }
    const rd = gate.makeReader('worktree', dir)
    const digest = digestInputs(gate.readPinInputs(rd)).digest
    const pin = renderPin({
      generator: 'g',
      sourceCommit: 'c',
      inputs,
      generatedAt: '2026-01-01T00:00:00.000Z',
    }).join('\n')
    put(gate.I18N_BUNDLE, `// GENERATED\n${pin}\nexport const REMOTE_LOCALE_B64 = {}\n`)
    assert.equal(H.judgeI18nFace('worktree', dir, rd), 'clean', '钉与面上现算同值时应判 clean')
    assert.equal(digest.length, 64)

    // 只改承载层那一份源(2026-10-27 之前门根本看不见的那一层)⇒ 必须立刻 stale
    put(gate.carriedSourceRel('ja'), JSON.stringify({ carried: { note: 'LATER-EDIT' } }))
    assert.equal(
      H.judgeI18nFace('worktree', dir, gate.makeReader('worktree', dir)),
      'stale',
      '改承载层源而钉没重算 ⇒ 应判 stale',
    )

    // 面上根本没有 RN 词包 ⇒ 两层口径,不得因此冒红(§12e 恒红门禁令)
    const bare = mkScratch('hdic-judge-bare-')
    try {
      const bareInputs = []
      for (const l of gate.REMOTE_LOCALES) {
        const b = JSON.stringify({ greeting: `hi-${l}` })
        const o = '{}'
        const putBare = (rel, text) => {
          mkdirSync(join(bare, rel).slice(0, join(bare, rel).lastIndexOf('/')), { recursive: true })
          writeFileSync(join(bare, rel), text, 'utf8')
        }
        putBare(gate.baseSourceRel(l), b)
        putBare(gate.overrideSourceRel(l), o)
        bareInputs.push(
          { rel: gate.baseSourceRel(l), text: b },
          { rel: gate.overrideSourceRel(l), text: o },
        )
      }
      const bareRd = gate.makeReader('worktree', bare)
      const barePin = renderPin({
        generator: 'g',
        sourceCommit: 'c',
        inputs: bareInputs,
        generatedAt: '2026-01-01T00:00:00.000Z',
      }).join('\n')
      putBare2(bare, barePin)
      assert.equal(
        H.judgeI18nFace('worktree', bare, gate.makeReader('worktree', bare)),
        'clean',
        '没有承载层时按两层算也应 clean',
      )
      assert.equal(
        digestInputs(gate.readPinInputs(bareRd)).perInput.length,
        gate.REMOTE_LOCALES.length * 2,
      )
    } finally {
      rmScratch(bare)
    }
  } finally {
    rmScratch(dir)
  }
})
function putBare2(root, pin) {
  const rel = gate.I18N_BUNDLE
  mkdirSync(join(root, rel).slice(0, join(root, rel).lastIndexOf('/')), { recursive: true })
  writeFileSync(
    join(root, rel),
    `// GENERATED\n${pin}\nexport const REMOTE_LOCALE_B64 = {}\n`,
    'utf8',
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('C12 ui-routes 输入预取不是空转:函数在、两段式齐、两处调用都走这一出口', () => {
  // 2026-10-27 实测:本文件两处调用 prefetchUiInputs,而全仓没有任何定义或 import ⇒
  // 走到 judgeUiRoutesFace 就 ReferenceError,整条 ui-routes 自愈腿从未真正跑起来过。
  assert.equal(typeof prefetchUiInputs, 'function', '预取出口必须真存在(调用一个未定义标识符 = 整条腿跑飞)')
  const src = readFileSync(new URL('../heal-derived-in-checkout.mjs', import.meta.url), 'utf8')
  assert.match(src, /export function prefetchUiInputs\(reader\)/, '实现要留在源脚本里,不许测试内自造一份')
  assert.match(
    src,
    /\.\.\.specs\.map\(\(a\) => a\.rel\)[\s\S]{0,200}?TARO_APP_CONFIG/,
    '第一段基集必须含 app.config —— inputRels 求值要读它,漏了就抛「未 prefetch 就 read」',
  )
  assert.equal(
    (src.match(/prefetchUiInputs\(rd\)/g) || []).length,
    2,
    '两处调用(healUiRoutesFamily / judgeUiRoutesFace)都必须走同一出口',
  )
})

