// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 夹具:锁住「git 参数顺序错必须报红(rc=2),不得被读成无违例(0/1)」。
 *
 * 背景(2026-11-07):门 251 的 `--staged` 面写了 `git grep -l -E <pattern> --cached`,
 * git 把 `--cached` 当作 revision 名 → `fatal: unable to resolve revision: --cached`,rc=2。
 * 调用方把「跑不起来」读成「没命中」,于是这道门在提交面上**从未检查过任何东西,却一直是绿的**
 * —— 这是「假绿」形态里最干净的一例。断言分三层:
 *  ① 纯函数层:`--cached` 必须排在 `-E`/pattern 之前;
 *  ② 反例层:旧顺序对 git 必须 rc=2 且 stderr 有 "unable to resolve revision";
 *  ③ 正向层:正确顺序只能是 0(有命中)/1(无命中),绝不能是 2。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildGrepListArgs, RN_GREP_PATTERN } from '../lib/git-grep-args.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PATHS = ['packages/app/src']

function runGit(args) {
  return spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

const isRepo = runGit(['rev-parse', '--is-inside-work-tree']).status === 0

test('staged 面:--cached 必须排在 -E / pattern 之前(纯函数层)', () => {
  const args = buildGrepListArgs('staged', RN_GREP_PATTERN, PATHS)
  const cached = args.indexOf('--cached')
  const flag = args.indexOf('-E')
  const pat = args.indexOf(RN_GREP_PATTERN)
  const sep = args.indexOf('--')
  assert.equal(args[0], 'grep')
  assert.ok(cached > 0, '`--cached` 必须存在')
  assert.ok(cached < flag, '`--cached` 必须在 `-E` 之前')
  assert.ok(flag < pat, '`-E` 必须在 pattern 之前')
  assert.ok(pat < sep, '`--` 必须排在 pattern 之后')
  assert.equal(sep, args.length - PATHS.length - 1, '`--` 必须紧接 paths 之前')

  const head = buildGrepListArgs('head', RN_GREP_PATTERN, PATHS)
  assert.ok(head.indexOf('HEAD') > head.indexOf(RN_GREP_PATTERN), 'HEAD 必须排在 pattern 之后')
  assert.equal(head.indexOf('--cached'), -1, 'head 面不许出现 --cached')
})

test('反例:旧顺序(--cached 在 pattern 之后)对 git 必须非 0(实测 128)', { skip: !isRepo && '不在 git 工作树内' }, () => {
  const bad = runGit(['grep', '-l', '-E', RN_GREP_PATTERN, '--cached', '--', ...PATHS])
  // git 对 fatal 报 128;门自身把它再映射成 exit 2(未判定)。关键是**绝不许是 0/1**
  // ——0/1 会被读成"有/无命中",于是这道门重新变回永远绿的假门。
  assert.notEqual(bad.status, 0)
  assert.notEqual(bad.status, 1)
  assert.match(bad.stderr, /unable to resolve revision/)
})

test('正向:正确顺序只能是 0(有命中)/1(无命中),不得 2', { skip: !isRepo && '不在 git 工作树内' }, () => {
  for (const face of ['staged', 'head']) {
    const r = runGit(buildGrepListArgs(face, RN_GREP_PATTERN, PATHS))
    assert.ok([0, 1].includes(r.status), `face=${face} status=${r.status} stderr=${r.stderr}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
