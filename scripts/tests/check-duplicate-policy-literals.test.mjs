// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像锁:check-duplicate-policy-literals 的 render 崩溃回归(§22c 单源 import,本文件不复算判据)
// 立因:render(res) 函数体内引用 free identifier `strict`(输出层判「❌ 判红 / ⚠️ 存量红」那一支),
// 而 `strict` 只住在 main() 的局部 —— 被审面只要有红 ⇒ render 一进 reds 分支就 ReferenceError,
// 默认全量档(--staged 之外全部人读档)当场崩,顶层 catch 以 exit 2 收场(与「未判定」同码,静默伪装成判定)。
// 本文件两条腿:①单元腿直接调 __test__.render,代入旧实现(形参没接 strict)必抛 ⇒ 锁即红;
// ②CLI 腿真跑默认全量档,断言 stderr 不含 `is not defined`、stdout 正常产出「判定面=」结论行。
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { __test__ as gate } from '../check-duplicate-policy-literals.mjs'

const { render, decideExit } = gate

const GATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'check-duplicate-policy-literals.mjs')

// 构造面:一支带红的 head 档结果(字段形状 = analyze 的返回面,零副作用)
function resWithReds(face) {
  return {
    face,
    fellBack: false,
    filesScanned: 2,
    candidates: 1,
    counts: { ladderKeys: 1, bundleKeys: 0, foreignBundles: 0, nonOptionBundles: 0, unparsedBundles: 0, nonLadderShapes: 0 },
    nonLadderGroups: [],
    sameNameDiffValue: [],
    reds: [
      {
        kind: 'DL',
        key: '1,2,3',
        files: ['apps/a/x.ts', 'apps/b/y.ts'],
        sites: [
          { file: 'apps/a/x.ts', line: 1 },
          { file: 'apps/b/y.ts', line: 2 },
        ],
        why: '测试夹具:同值阶梯两份',
      },
    ],
    legacyGroups: [],
    ratchetedOut: 0,
    undetermined: [],
  }
}

describe('render 崩溃回归锁(2026-10 实测 ReferenceError: strict is not defined)', () => {
  it('腿一·有红的 head 档:render 不得抛(代入旧实现即红)', () => {
    assert.doesNotThrow(() => render(resWithReds('head'), false))
    const text = render(resWithReds('head'), false)
    assert.match(text, /判定面=/)
    assert.match(text, /⚠️ 存量红/)
    assert.doesNotMatch(text, /❌ 判红/)
  })

  it('腿一b·strict=true 同输入必须出「❌ 判红」(问责档语义,修崩溃不得洗掉)', () => {
    const text = render(resWithReds('head'), true)
    assert.match(text, /❌ 判红/)
  })

  it('腿一c·staged 档(非 strict)有红也判红:mode==="staged" 一支与 strict 同路', () => {
    const text = render(resWithReds('staged'), false)
    assert.match(text, /❌ 判红/)
  })

  it('腿一d·缺省第二参不得抛(默认 false,不回落 free identifier)', () => {
    assert.doesNotThrow(() => render(resWithReds('head')))
  })

  it('腿一e·render 的 head 档结论与 decideExit 同判(全量档有红 ⇒ 只报数 exit 0)', () => {
    const res = resWithReds('head')
    assert.equal(decideExit({ reds: res.reds, undetermined: res.undetermined, strict: false, mode: 'head' }), 0)
  })

  it('腿二·默认全量档真 CLI:rc 不得是崩溃档,stderr 不得含 is not defined', () => {
    const p = spawnSync(process.execPath, [GATE], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(p.error, undefined, `CLI 腿自身失败:${p.error?.message}`)
    assert.doesNotMatch(String(p.stderr), /is not defined/, 'render 崩溃回潮(ReferenceError 逃逸到顶层 catch)')
    assert.ok(p.stdout.includes('判定面='), '结论行必须产出(render 正常走完)')
    // 崩溃型失效永远以 exit 2 收场且 stdout 空;绿/报数档 exit 0;§0.3 不许把崩当判
    assert.notEqual(p.status, 1)
    assert.ok(p.status === 0 || p.status === 2)
    if (p.status === 2) {
      assert.match(p.stdout, /无法判定/, 'exit 2 只能是显式未判定,不得是顶层 catch 的崩溃')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
