// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 壳承载引用判据(lib/rn-shell-refs)的镜像测试。
 *
 * 立因(2026-10-26 实测):造页器 form=shell 把"有 RN 屏 import 了这张共享屏"当成"同名 RN 壳存在",
 * 产出 2 枚指向不存在模块的壳承载页(console-table / switch-prefs),weapp 构建当场编不过
 * (Taro 解析 `@rn-shells/ConsoleTableScreen` ⇒ "…ConsoleTableScreen.vue doesn't exist"),
 * 而覆盖率账面因为标记行照涨 —— 绿账面 + 坏产物,是本仓最贵的那一型失效。
 *
 * 钉死四件事:
 *   S1 引用形态识别(单引号/双引号/别名变体不算);
 *   S2 落点按同名 RN 屏文件;
 *   S3 目标不在面上 ⇒ 点名;在面上 ⇒ 不判(反控,防"判据永远红"的假阳);
 *   S4 两把尺子(守门 251 C5 与跨端覆盖尺的镜像计数)import 的是同一份实现 —— 摘掉这份 import 即翻红。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import test from 'node:test'

import { shellRefsOf, shellTargetRel, hasDanglingShell } from '../lib/rn-shell-refs.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
const headFace = (rel) => {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 24,
    })
  } catch {
    return null
  }
}

test('S1 引用形态:只认 from 的引号字符串,别名变体/裸文本不认', () => {
  assert.deepEqual(
    [...shellRefsOf(`import A from '@rn-shells/ActivityDetailScreen'\nimport B from "@rn-shells/Foo"\n// @rn-shells/Commented\n`)],
    ['ActivityDetailScreen', 'Foo'],
  )
  assert.equal(shellRefsOf('要求 @rn-shells 这个别名').size, 0, '散文里提到别名不算引用')
  assert.equal(shellRefsOf(null).size, 0)
})

test('S2 落点 = 同名 RN 屏文件(别名口径)', () => {
  assert.equal(shellTargetRel('ActivityDetailScreen'), 'apps/mobile-rn/src/screens/ActivityDetailScreen.tsx')
})

test('S3 目标不在面上 ⇒ 点名;在面上 ⇒ 不判(反控)', () => {
  const text = `import S from '@rn-shells/ActivityDetailScreen'\n`
  // 真面上这枚壳存在 ⇒ 反控:不得无脑判红
  assert.equal(hasDanglingShell(text, headFace), null, '现读:该壳在 HEAD 面真实存在,判据必须放过')
  // 同一份文本换成不存在的壳 ⇒ 必须点名
  assert.equal(
    hasDanglingShell(`import S from '@rn-shells/DefinitelyNotAScreen9x'\n`, headFace),
    'DefinitelyNotAScreen9x',
  )
})

test('S4 两把尺子共用这一份实现(摘掉 import 即翻红)', () => {
  const src251 = headFace('scripts/check-rn-compat-coverage.mjs') ?? ''
  const srcCov = headFace('scripts/check-cross-end-screen-coverage.mjs') ?? ''
  assert.match(src251, /from '\.\/lib\/rn-shell-refs\.mjs'/)
  assert.match(srcCov, /from '\.\/lib\/rn-shell-refs\.mjs'/)
  // 判据不得在两处各写一份正则:任何一边再手写 matchAll(/@rn-shells/,就是第二份真相
  assert.doesNotMatch(src251, /matchAll\(\/from\\s\*\['"\]@rn-shells/, '门 251 里出现了第二份壳引用正则')
  assert.doesNotMatch(srcCov, /matchAll\(\/from\\s\*\['"\]@rn-shells/, '覆盖尺里出现了第二份壳引用正则')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
