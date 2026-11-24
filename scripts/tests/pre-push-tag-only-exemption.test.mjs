// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:.husky/pre-push 的「纯 tag 推送不跑代码质量门」判据。
 *
 * 为什么不另写一份判据:这段逻辑住在 shell 里,测试里重抄一遍 awk 就成了第二把尺子
 * (AGENTS §0.6 单一真相源)。本器把钩子**当前那两条 awk 程序逐字抠出来**,喂夹具跑
 * 真 awk ⇒ 测的就是钩子自己会用的那条判据;抠不到即判红(钩子被改写 ⇒ 锁必须响,
 * 不能静默空转成"通过")。
 *
 * 立因(2026-10-30 实测):原判据只看 local 侧 `$1 ~ /^refs\/tags\//`,而**删除 tag** 时
 * git 传给钩子的是 `(nil) <全0> refs/tags/<名> <旧sha>` —— tag 名只在远端侧 $3。于是删除类
 * 推送一条都不计入,豁免结构上够不着:纯删 8093 枚冗余 tag 时每批仍照跑全量门(3~4 分钟/批)。
 * 删除与新建是同一件事的两个方向,没有理由只豁免一个。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = readFileSync(join(ROOT, '.husky', 'pre-push'), 'utf8')
const ZERO = '0'.repeat(40)
const SHA = 'a'.repeat(40)

/** 从钩子原文里逐字抠出 awk 程序(第 1 条 = 所有 ref 行,第 2 条 = 其中算作 tag 的行)。 */
function extractAwk(marker) {
  const line = HOOK.split('\n').find((l) => l.trimStart().startsWith(marker))
  if (!line) return null
  const m = line.match(/awk '([^']*)'/)
  return m ? m[1] : null
}

const REF_AWK = extractAwk('_ref_n=')
const TAG_AWK = extractAwk('_tag_n=')

function countWith(awkProg, refs) {
  const input = refs.join('\n') + '\n'
  const r = spawnSync('sh', ['-c', `awk '${awkProg}' | wc -l`], { input, encoding: 'utf8' })
  assert.equal(r.status, 0, `sh 跑 awk 失败:${r.stderr}`)
  return Number(r.stdout.trim())
}

/** 钩子的落地判据:_ref_n>0 且 _ref_n==_tag_n ⇒ 纯 tag 推送 ⇒ 豁免代码质量门。 */
function isTagOnly(refs) {
  const n = countWith(REF_AWK, refs)
  const t = countWith(TAG_AWK, refs)
  return n > 0 && n === t
}

test('形状锁:两条 awk 必须仍住在钩子原文里(抠不到=判据被改写,锁必须响)', () => {
  assert.ok(REF_AWK, '钩子里找不到 _ref_n= 那行或其 awk 程序')
  assert.ok(TAG_AWK, '钩子里找不到 _tag_n= 那行或其 awk 程序')
})

test('新建/推进 tag ⇒ 豁免(旧行为不得退化)', () => {
  assert.equal(isTagOnly([`refs/tags/lost-commit/x ${SHA} refs/tags/lost-commit/x ${ZERO}`]), true)
})

test('删除 tag(local 侧是 (nil))⇒ 豁免 —— 本票要治的那一型', () => {
  assert.equal(isTagOnly([`(nil) ${ZERO} refs/tags/lost-commit/x ${SHA}`]), true)
})

test('混合一批:既有删 tag 又有新建 tag ⇒ 仍算纯 tag', () => {
  assert.equal(
    isTagOnly([
      `(nil) ${ZERO} refs/tags/backup/a ${SHA}`,
      `refs/tags/backup/b ${SHA} refs/tags/backup/b ${ZERO}`,
    ]),
    true,
  )
})

test('反向对照①:推进分支 ⇒ 不豁免(否则代码质量门就被这条出口绕开了)', () => {
  assert.equal(isTagOnly([`refs/heads/main ${SHA} refs/heads/main ${ZERO}`]), false)
})

test('反向对照②:删除分支 ⇒ 不豁免(它的 local 侧同样是 (nil),不能靠 (nil) 单独放行)', () => {
  assert.equal(isTagOnly([`(nil) ${ZERO} refs/heads/feature/x ${SHA}`]), false)
})

test('反向对照③:tag 与分支混推 ⇒ 不豁免(判据取"每一行都存在侧都在 refs/tags/ 下")', () => {
  assert.equal(
    isTagOnly([
      `refs/heads/main ${SHA} refs/heads/main ${ZERO}`,
      `(nil) ${ZERO} refs/tags/lost-commit/y ${SHA}`,
    ]),
    false,
  )
})

test('反向对照④:空清单 ⇒ 不豁免(拿不到清单不等于只推了 tag)', () => {
  assert.equal(isTagOnly([]), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
