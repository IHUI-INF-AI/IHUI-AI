// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/lib/derived-copy-state.mjs —— 「盘上那份能不能覆盖」的三态判别。
 *
 * 立因(2026-10-27 两条实测):派生件的写回档一律以"盘 ≠ 面"作让路条件,而本仓旁路落地只推进
 * HEAD/索引、不写工作树 ⇒ 工作树副本常年是该路径的历史旧版,于是护栏天天触发、器物天天让路、
 * 守门 105 天天红。收窄之后必须留住反向对照:**别人正写着的内容一行都不许动**。
 * 所以本文件是成对的:摘掉任一半(滞后放行 / 在飞拦住)当场翻红。
 *
 * 跑法:node --test scripts/tests/derived-copy-state.test.mjs
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { __test__ as S } from '../lib/derived-copy-state.mjs'
import { renderPin } from '../lib/generated-input-pin.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const REL = 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts'

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
/** 生成器形态的产物(横幅 + 自述钉),用来造"未落库的生成器输出"这一档 */
function generatedText(extra = '') {
  return [
    '// GENERATED FILE — DO NOT EDIT. 由 scripts/gen-i18n-compressed.mjs 生成(pnpm gen:i18n)',
    renderPin({
      generator: 'g',
      sourceCommit: 'x',
      inputs: [{ rel: 'a.json', text: '{}' }],
      generatedAt: '2026-01-01T00:00:00.000Z',
    }).join('\n'),
    `export const REMOTE_LOCALE_B64 = { en: '${extra}' }`,
    '',
  ].join('\n')
}

function makeHistoryRepo() {
  const dir = mkScratch('dcs-hist-')
  git(dir, ['init', '-q', '-b', 'main'])
  put(dir, REL, generatedText('V1'))
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'v1'])
  put(dir, REL, generatedText('V2'))
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'v2'])
  return dir
}

test('D1 四态成对对照:同形=equal / 历史旧版=滞后 / 未入库的生成器输出=可再生 / 手写内容=在飞', () => {
  const dir = makeHistoryRepo()
  try {
    // 正向对照:这把尺看得见"本来就好"的形态
    assert.equal(
      S.classifyCopyDelta({ rel: REL, face: 'head', root: dir }).kind,
      'equal',
      '盘 == HEAD 时应判 equal',
    )

    // ① 滞后副本:盘上回退成该路径**历史上真出现过**的 V1(旁路落地不写工作树就是这个形态)
    put(dir, REL, generatedText('V1'))
    assert.equal(
      S.classifyCopyDelta({ rel: REL, face: 'head', root: dir }).kind,
      'lagging-copy',
      '盘上是历史旧版 ⇒ 必须放行,否则护栏天天让路、器物永不干活',
    )

    // ② 未入库的生成器输出:从没入过库,但结构上就是生成器吐的 ⇒ 覆盖不丢信息
    put(dir, REL, generatedText('NEVER-COMMITTED-BUT-GENERATED'))
    assert.equal(
      S.classifyCopyDelta({ rel: REL, face: 'head', root: dir }).kind,
      'generated-copy',
      '自称产物(横幅+钉齐全)而从未入库 ⇒ 应判生成器输出',
    )

    // ③ 在飞改写:既不在历史里、又不是生成器形态 ⇒ 那是别席正写着的现场
    put(dir, REL, 'SOMEONE-ELSE-IS-WRITING\n')
    const busy = S.classifyCopyDelta({ rel: REL, face: 'head', root: dir })
    assert.equal(busy.kind, 'in-flight', '盘上那份不是生成器形态也不是历史版 ⇒ 必须判在飞并让路')
    assert.ok(String(busy.why ?? '').length > 0, '让路必须点名为什么让(不静默)')

    // 放行/拦住的出口只认 kind,防"新增一档默认被当成可覆盖"
    assert.equal(S.mayOverwrite({ kind: 'lagging-copy' }), true)
    assert.equal(S.mayOverwrite({ kind: 'generated-copy' }), true)
    assert.equal(S.mayOverwrite({ kind: 'in-flight' }), false)
    assert.equal(S.mayOverwrite({ kind: 'absent-both' }), false, '缺席一档不在本判据的授权范围里')
  } finally {
    rmScratch(dir)
  }
})

test('D2 凭据取不到 ⇒ 保守判在飞:证明不了"安全"就不动手(§0.3 没判不冒进)', () => {
  const dir = mkScratch('dcs-nogit-')
  try {
    put(dir, REL, 'ON-DISK\n')
    const r = S.classifyCopyDelta({
      rel: REL,
      face: 'head',
      root: dir,
      run: () => {
        throw new Error('git 不可用')
      },
    })
    assert.equal(r.kind, 'in-flight', `失效方向必须是不动手,实得 ${r.kind}`)
    assert.ok(String(r.why ?? '').length > 0, '未判定也要留下点名')

    // 盘上没有这一份 ⇒ 同样不许当成"可以随便写"
    const empty = mkScratch('dcs-nodisk-')
    try {
      const r2 = S.classifyCopyDelta({
        rel: REL,
        face: 'head',
        root: empty,
        run: () => 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        historyOf: () => new Set(),
      })
      assert.equal(r2.kind, 'in-flight', '盘上取不到字节 ⇒ 无法证明不是别人现场,应让路')
    } finally {
      rmScratch(empty)
    }
  } finally {
    rmScratch(dir)
  }
})

test('D3 载荷形态档:.b64.txt 是单个 base64 token 才算生成物,掺进别的字符就按人改处理', () => {
  const dir = mkScratch('dcs-b64-')
  try {
    const rel = 'apps/miniapp-taro/src/assets/remote-locales/en.b64.txt'
    put(dir, rel, 'H4sIAAAAAAAAAwAAAP//')
    assert.equal(S.isMachineGenerated(rel, { root: dir }).ok, true, '纯 base64 token 应认成生成物')
    put(dir, rel, 'H4sI...\n// 我加的注释')
    assert.equal(
      S.isMachineGenerated(rel, { root: dir }).ok,
      false,
      '形态一坏就按人动过处理(失效方向:不动手)',
    )
    // 不在认识范围内的扩展名一律不认(不许"看着像生成物"就放行)
    put(dir, 'notes.md', 'anything')
    assert.equal(S.isMachineGenerated('notes.md', { root: dir }).ok, false)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
