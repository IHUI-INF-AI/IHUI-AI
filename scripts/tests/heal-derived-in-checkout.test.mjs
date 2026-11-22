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
 *   C9b/C13/C14/C15 2026-10-27 补样式派生面(tokens)一族:在册 / 落后必须建检出并带走 blob /
 *     判不出整轮未判定 / 复校不过一条 blob 都不落(编号接在既有 C12 之后,不复用别人用过的号)
 *   C17/C18 2026-11-05 补 --report-only 只读档:canary runner 行为级证明"一条写动作都不发出"(含
 *     写判一体腿必带 --check)+ 三态如实 + 写树结构不可达(函数体零写原语、接线先回于 healDerivedInCheckout)
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

/** 注入用:面上"离线包/四端/样式派生"各自的新旧与缺席,全部由测试说了算(真判据在 C10 那条里量) */
const judge = ({ i18n = 'clean', ui = [], tokens = 'clean' }) => ({
  judgeI18n: () => i18n,
  judgeUi: () => (ui === 'absent' ? [] : ui),
  judgeTokens: () =>
    Array.isArray(tokens)
      ? { state: 'stale', stale: tokens.map((label) => ({ label, why: '' })), why: '' }
      : { state: tokens, stale: [], why: tokens === 'undetermined' ? '夹具:判不出' : '' },
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
    healTokens: () => ({ state: 'ready', files: filesOf(2, 'tok-'), notes: [] }),
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
  assert.doesNotMatch(
    lands[0].proof,
    /检出/,
    'proof 不得自称"检出里产出"(字节其实来自主仓按面生成)',
  )
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

test('C9 --family 只认登记在册的族,坏值当场 exit 2(不静默跑全部)', () => {
  const argvFamily = ['--family', 'bogus']
  const found = argvFamily[1]
  assert.ok(!H.FAMILIES.includes(found), `夹具本身要先成立:${H.FAMILIES}`)
  // main() 的拒收形态由 CLI 集成测(本文件不派生子进程)兜:这里锁清单本身
  // 2026-10-27 补 tokens:样式派生面此前在守护轮**一条腿都没有**,而提交链的派生腿只认 staged
  // (旁路落地不跑钩子 ⇒ HEAD 常年欠一格,靠人手工补,近两枚提交标题即"派生产物按 HEAD 面重生成并落地")。
  assert.deepEqual([...H.FAMILIES].sort(), ['i18n', 'tokens', 'ui-routes'])
})

test('C9b 样式族(tokens)在册:它是这一轮唯一会在守护轮里被自动补的派生面,漏登即整族无人判', () => {
  assert.ok(H.FAMILIES.includes('tokens'), `FAMILIES 现读:${H.FAMILIES.join(',')}`)
})

test('C13 只有样式派生面落后 ⇒ 必须建检出(该族只能在"盘==HEAD"的等价面上验),并带走它的文件', () => {
  const { r, lands, checkouts } = runWith({
    ...judge({ tokens: ['miniapp-taro app.css'] }),
    healI18n: () => ({ state: 'ready', files: [], digest: 'd' }),
  })
  assert.equal(
    checkouts.length,
    1,
    '样式族不建检出就没有任何判据能对着 HEAD 判它(主仓盘是滞后副本)',
  )
  assert.equal(r.state, 'landed', r.detail)
  assert.equal(lands[0].files.length, 2, JSON.stringify(lands[0].files.map((f) => f.path)))
  assert.match(
    lands[0].proof,
    /tokens/,
    'LAND_BLOB_PROOF 要说清样式族凭什么算同形(否则与另两族混成一谈)',
  )
})

test('C14 样式族判不出 ⇒ 整轮未判定,且不建检出(没判不是要修)', () => {
  const { r, checkouts, lands } = runWith({ ...judge({ tokens: 'undetermined' }) })
  assert.equal(r.state, 'undetermined', r.detail)
  assert.equal(checkouts.length, 0)
  assert.equal(lands.length, 0)
})

test('C15 样式族在检出里复校不过 ⇒ refused 且一条 blob 都不落', () => {
  const { r, lands } = runWith({
    ...judge({ tokens: ['mobile-rn global.css'] }),
    healTokens: () => ({
      state: 'refused',
      files: [],
      notes: [{ rel: 'mobile-rn global.css', state: 'refused', why: '复校仍红' }],
    }),
  })
  assert.equal(r.state, 'refused', r.detail)
  assert.equal(lands.length, 0, '复量不过的一族不得借另两族的车落进 HEAD')
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
  assert.equal(
    typeof prefetchUiInputs,
    'function',
    '预取出口必须真存在(调用一个未定义标识符 = 整条腿跑飞)',
  )
  const src = readFileSync(new URL('../heal-derived-in-checkout.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /export function prefetchUiInputs\(reader\)/,
    '实现要留在源脚本里,不许测试内自造一份',
  )
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

/**
 * C16 —— 与基线逐字节全等的落点必须被剔出本批。
 * 现场理由(2026-11-01):守护日志里 i18n 一族自 10-31 21:19 起**每轮** refused,原话点名 4 份
 * CDN 载荷"构造内容与某历史 blob 逐字节相同 ⇒ 按写回旧版处理";逐字节去量,那 4 份盘 == HEAD
 * 一字节没变,而真变的 3 份 gen.ts 被它们一起堵在后面 ⇒ 105 的 G5(blocking)常驻在完好仓上。
 * 正反成对:全等 ⇒ identical;不同形 ⇒ changed;面上取不到(null)= 新增,不是全等(阳性对照);
 * 一份读不回 ⇒ error 且整批不备(不得"落能读到的那几份")。
 * 委托形状锁:healI18nFamily 必须真调它并消费 identical / bytesAll —— 定义了不接线 = 没有(§0.8)。
 */
test('C16 全等落点剔出本批 / 变化集仍交落地 / 读不回整批不报 / 委托形状锁', () => {
  const rels = ['a.gen.ts', 'b.gen.ts', 'c.b64.txt']
  const disk = { 'a.gen.ts': 'A2', 'b.gen.ts': 'B2', 'c.b64.txt': 'C2' }
  const face = { 'a.gen.ts': 'A2', 'b.gen.ts': 'B1', 'c.b64.txt': null }
  const r = H.partitionIdenticalOutputs({
    rels,
    readDisk: (p) => disk[p],
    readFace: (p) => face[p],
  })
  assert.equal(r.error, undefined, '三份都读得回 ⇒ 不该有 error')
  assert.deepEqual(r.identical, ['a.gen.ts'], '与基线逐字节全等 ⇒ 不进本批')
  assert.deepEqual(
    r.changed.map((c) => c.path).sort(),
    ['b.gen.ts', 'c.b64.txt'],
    '变了的那份与"面上还没有"的新增份都必须在变化集里',
  )
  assert.equal(
    r.bytesAll,
    6,
    'bytesAll 量整批写回字节(含全等那几份)⇒ 上限那一闸不许被剔除逻辑顺手缩小',
  )
  const e = H.partitionIdenticalOutputs({
    rels,
    readDisk: (p) => (p === 'b.gen.ts' ? null : disk[p]),
    readFace: (p) => face[p],
  })
  assert.equal(e.error, 'b.gen.ts', '生成后读不回一份 ⇒ 点名是哪一份')
  assert.equal(e.changed.length, 0, '读不回一份 ⇒ 整批不备,不落半套')

  const src = readFileSync(new URL('../heal-derived-in-checkout.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /const part = partitionIdenticalOutputs\(\{/,
    'healI18nFamily 必须真调这一判据(定义了不接线 = 没有,§0.8)',
  )
  assert.match(
    src,
    /const bytes = part\.bytesAll/,
    '字节上限闸必须消费剔除函数算出的整批字节,不是变化集字节',
  )
  assert.match(
    src,
    /const identical = part\.identical/,
    '被剔掉的路径清单要拿得到(JSON 结论与拒落原因都靠它,静默剔除等于没有留痕)',
  )
})

test('C17 --report-only 只读档的行为级零写证明:canary runner 见任何"写形态 argv"当场抛,整档跑完一条都不抛', () => {
  // 立因(2026-11-05):--dry-run 并非零写(apply=!argv.includes('--dry-run') 裸跑即写档、判成写 state 件、
  // 还要 git worktree add),而 judgeTokensFace 对登记表里 check 与 cmd 同体的那条腿(sync-extension-tokens.mjs)
  // 是**裸跑**——该器不带 --check 即写回模式往主工作树落字节。只读档的"零写"必须由行为证明:
  // 这里注入的 run 是一只金丝雀——凡见到 (a) 写判一体腿没带 --check、(b) 任何登记外的旗标/写动词,
  // 都按"写动作发生了"抛错。整档能安静跑完 = 它一条写动作都没发出。判据实现不复制(§22c):全走 __test__。
  const SHA = '0'.repeat(40)
  const fakeRd = (text) => ({ has: () => true, read: () => text, prefetch: () => {} })
  const REG_DUAL = [
    'const TOKEN_SYNC_TARGETS = [',
    '  {',
    "    label: 'miniapp app.css',",
    "    file: 'apps/miniapp-taro/src/app.css',",
    "    cmd: 'pnpm --filter @ihui/miniapp-taro sync-tokens',",
    "    trigger: 'tokens',",
    "    check: 'check-miniapp-tokens-sync.mjs',",
    '  },',
    '  {',
    "    label: 'extension 注入样式色值',",
    "    file: 'apps/extension/entrypoints/content/content-toolbar.tsx',",
    "    cmd: 'node scripts/sync-extension-tokens.mjs --quiet',",
    "    trigger: 'tokens',",
    "    check: 'sync-extension-tokens.mjs',",
    '  },',
    ']',
  ].join('\n')
  const seen = []
  const READ_ONLY_FLAGS = new Set(['--check', '--staged', '--worktree'])
  const r = H.reportTokensTier({
    root: '/T',
    sourceSha: SHA,
    reader: fakeRd(REG_DUAL),
    scriptExists: () => true,
    run: (cwd, argv) => {
      seen.push({ cwd, argv })
      const base = String(argv[1]).split(/[\\/]/).pop()
      if (base === 'sync-extension-tokens.mjs' && !argv.includes('--check'))
        throw new Error('金丝雀:写判一体腿被裸跑 = 写回模式,零写档漏了写动作')
      for (const a of argv.slice(2))
        if (!READ_ONLY_FLAGS.has(a)) throw new Error(`金丝雀:argv 出现只读档不认识的旗:${a}`)
      for (const a of argv)
        if (/hash-object|worktree|commit-tree|--write|--apply|-w\b/.test(String(a)))
          throw new Error(`金丝雀:argv 出现写动词:${a}`)
      return { ok: true, stdout: '', code: 0 }
    },
  })
  assert.equal(r.state, 'clean', r.detail)
  assert.equal(seen.length, 2, '两条在册腿必须都真派了(没派到每条腿的"clean"是假绿)')
  assert.equal(seen[1].argv.includes('--check'), true, '写判一体腿必须显式 --check')
  assert.equal(seen[0].argv.includes('--check'), false, '纯判腿(门体)不吃 --check,乱挂会撞互斥闸')
  assert.ok(
    seen.every(
      (c) =>
        c.cwd === '/T' &&
        c.argv[0] === process.execPath &&
        /[\\/]scripts[\\/]/.test(String(c.argv[1])),
    ),
    JSON.stringify(seen.map((c) => c.argv)),
  )
  // 机读键形状(与同族尺子对账用):state 与待落枚数键必须在
  for (const k of [
    'tier',
    'face',
    'state',
    'pending',
    'pendingPaths',
    'unjudged',
    'legs',
    'source',
  ]) assert.ok(k in r, `JSON 结论缺键 ${k}`)
  assert.equal(r.tier, 'report-only')
})

test('C18 只读档三态如实 + 写树结构不可达(函数体零写原语、--report-only 先回于 healDerivedInCheckout)', () => {
  const SHA = '0'.repeat(40)
  const fakeRd = (text) => ({ has: () => true, read: () => text, prefetch: () => {} })
  const REG =
    "const TOKEN_SYNC_TARGETS = [\n  {\n    label: 'a',\n    file: 'a.css',\n    cmd: 'node scripts/sync-a.mjs',\n    trigger: 'tokens',\n    check: 'check-a.mjs',\n  },\n]"
  const tierWith = (code) =>
    H.reportTokensTier({
      root: '/T',
      sourceSha: SHA,
      reader: fakeRd(REG),
      scriptExists: () => true,
      run: () =>
        code === 0 ? { ok: true, stdout: '', code: 0 } : { ok: false, why: 'x', code, output: '漂移 3 档' },
    })
  assert.equal(tierWith(1).state, 'stale')
  assert.deepEqual(tierWith(1).pendingPaths, ['a.css'], '待落 file 面逐枚点名,级联侧数得出来')
  assert.match(tierWith(1).legs[0].why, /漂移 3 档/, '"落后几档"的原话来自校验器自己,本器不复算')
  assert.equal(
    tierWith(2).state,
    'undetermined',
    '校验器坏了(exit 2)不得被读成"落后"(冒红)也不得记绿',
  )
  const noHook = H.reportTokensTier({
    root: '/T',
    sourceSha: SHA,
    reader: { has: () => false, read: () => null, prefetch: () => {} },
    scriptExists: () => true,
    run: () => ({ ok: true, stdout: '', code: 0 }),
  })
  assert.equal(noHook.state, 'undetermined', '登记表取不到 ⇒ 没有尺子,未判定(§0.3)')

  // 结构锁(行为证明之外再兜一维):只读执行体与 CLI 接线体内不得出现任何写原语;
  // --report-only 的回车点必须排在 healDerivedInCheckout 调用之前(先回即达,写树不可达)。
  const src = readFileSync(new URL('../heal-derived-in-checkout.mjs', import.meta.url), 'utf8')
  const bodyOf = (startMark, endMark) => {
    const s = src.indexOf(startMark)
    assert.ok(s >= 0, `体标缺失:${startMark}`)
    const e = src.indexOf(endMark, s)
    assert.ok(e > s, `尾标缺失:${endMark}`)
    return src.slice(s, e)
  }
  const tierBody = bodyOf('export function reportTokensTier', 'const LAND_MSG_LINES')
  for (const forbid of [
    'tokensStateWrite',
    'landBlobs',
    'withHeadCheckout',
    'runGenerator',
    'hash-object',
    'hashText',
    'writeFileSync',
    'rmSync',
  ])
    assert.ok(!tierBody.includes(forbid), `只读执行体出现写原语:${forbid}`)
  const roBody = bodyOf('function mainReportOnly', 'function main(argv)')
  assert.ok(!/healDerivedInCheckout|tokensStateWrite|withCheckout/.test(roBody), roBody.slice(0, 120))
  const mainBody = bodyOf('function main(argv)', 'const isDirectRun')
  const roIdx = mainBody.indexOf("if (argv.includes('--report-only')) return mainReportOnly(argv)")
  const writeIdx = mainBody.indexOf('healDerivedInCheckout({')
  assert.ok(roIdx >= 0 && roIdx < writeIdx, `接线位不对:report-only@${roIdx} vs 写树@${writeIdx}`)
})
