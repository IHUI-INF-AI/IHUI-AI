#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像档 —— 守门 226(钩子装载形态对账)
 *
 * §22c 纪律:判据一律 import 源脚本的 __test__,本文件**不复制任何常量或判定**。
 * 跑法:node scripts/tests/check-husky-hook-form.test.mjs
 *
 * 本档存在的理由:2026-10-19 那次事故里,"钩子还是不是薄壳"这件事没有任何一层能拦住
 * —— 并席一次无关提交就把 node 正文写回了 .husky/post-commit,而链子死掉的表型是
 * **安静**(post-commit 不拦提交,safe-commit 照打"将自动推送")。所以回归锁必须住在
 * 每一枚碰 .husky/ 的提交都要跑的那一层,并且要有一组"摘掉即翻红"的成对夹具。
 */

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-husky-hook-form.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

const NODE_BODY = '#!/usr/bin/env node\n// ─── post-commit(跨平台 Node 钩子) ───\nconst { execSync } = require("child_process")\n'
const SH_SHELL = '#!/bin/sh\nunset GIT_DIR\nwscript //nologo scripts/hook-run-hidden.vbs post-commit scripts/lib/post-commit-hook.js "$@" || exit 1\n'
const FULL_FACE = new Set(['.husky/post-commit', 'scripts/hook-run-hidden.vbs', 'scripts/lib/post-commit-hook.js'])

const cases = []
const t = (name, fn) => cases.push({ name, fn })

t('M1 事故原形:node 正文钩子判且只判 H1(注释里的示例不得再咬一口)', () => {
  const r = G.auditHookTexts([{ p: '.husky/post-commit', s: NODE_BODY }], FULL_FACE)
  if (r.violations.length !== 1 || r.violations[0].rule !== 'H1') throw new Error(`实得 ${JSON.stringify(r.violations)}`)
})

t('M2 正控:sh 薄壳零违规;sh 族各写法都放行', () => {
  if (G.auditHookTexts([{ p: '.husky/post-commit', s: SH_SHELL }], FULL_FACE).violations.length !== 0) throw new Error('合规薄壳被误判')
  for (const s of ['#!/bin/sh\nx\n', '#!/bin/bash\nx\n', '#!/usr/bin/env sh\nx\n', '#!/usr/bin/env bash\nx\n']) {
    if (G.judgeShebang(s, '.husky/pre-commit') !== null) throw new Error(`sh 族被误判:${s.split('\n')[0]}`)
  }
})

t('M3 反向断言:无 shebang / python / pwsh 解释器都判红', () => {
  for (const s of ['node scripts/x.mjs\n', '#!/usr/bin/env python3\nprint(1)\n', '#!/usr/bin/env pwsh\nWrite-Host 1\n', '']) {
    if (!G.judgeShebang(s, '.husky/post-merge')) throw new Error(`放过形态:${JSON.stringify(s.split('\n')[0])}`)
  }
})

t('M4 死链:H2 成对 —— 抽掉正文即红,补回即绿', () => {
  const withoutBody = G.judgeDispatchRefs(SH_SHELL, new Set(['.husky/post-commit', 'scripts/hook-run-hidden.vbs']))
  if (withoutBody.length !== 1 || !/post-commit-hook\.js/.test(withoutBody[0].detail)) throw new Error(`正文丢失未点名:${JSON.stringify(withoutBody)}`)
  if (G.judgeDispatchRefs(SH_SHELL, FULL_FACE).length !== 0) throw new Error('齐备薄壳被误判')
})

t('M5 注释不是出路:sh 的 # 与 node 正文的 // 都不参与 H2', () => {
  for (const txt of ['#!/bin/sh\n#   wscript //nologo scripts/hook-run-hidden.vbs <label> <script>\ntrue\n', NODE_BODY + '//   wscript //nologo a.vbs lbl b.js\n']) {
    const hits = G.judgeDispatchRefs(txt, new Set(['.husky/x']))
    if (hits.length !== 0) throw new Error(`注释被判成死链:${JSON.stringify(hits)}`)
  }
})

t('M6 清单射程:只收 .husky 直属的 git 钩子名', () => {
  const list = ['.husky/post-commit', '.husky/README.md', '.husky/_/h', '.husky/pre-commit.sample', '.husky/commit-msg', '.husky/post-commit/inner', 'scripts/post-commit'].join('\0')
  const got = G.filterHookPaths(list)
  if (got.join(',') !== '.husky/commit-msg,.husky/post-commit') throw new Error(`清单错位:${JSON.stringify(got)}`)
})

t('M7 覆盖面:真仓被审面枚举非空,且整面路径集下 H2 零误咬', () => {
  const listed = G.listFace(ROOT, 'head')
  if (listed.hooks.length < 5) throw new Error(`真仓只枚举到 ${listed.hooks.length} 枚 ⇒ 判据可能在空集上"全绿"`)
  if (listed.all.size < 1000) throw new Error(`整面只有 ${listed.all.size} 条路径 ⇒ H2 必然误咬`)
  const texts = G.readHooks(ROOT, 'head', listed.hooks)
  const r = G.auditHookTexts(listed.hooks.map((p) => ({ p, s: texts.get(p) })), listed.all)
  const h2 = r.violations.filter((v) => v.rule === 'H2')
  if (h2.length !== 0) throw new Error(`真仓薄壳被误咬:${h2.map((v) => v.detail).join(' | ')}`)
})

t('M8 形状锁:判据不许被掏空成恒绿门', () => {
  if (!G.SH_SHEBANGS.includes('#!/bin/sh')) throw new Error('SH_SHEBANGS 里没有了 #!/bin/sh ⇒ 本门等于没装')
  if (!G.GIT_HOOK_NAMES.has('post-commit') || !G.GIT_HOOK_NAMES.has('pre-commit')) throw new Error('钩子名集缺 post-commit/pre-commit ⇒ 射程被缩')
})

t('M9 装车成套:注册条目 blocking + skipEnv 齐备(读将要提交的那一面)', () => {
  const rel = 'scripts/guardian-runner.mjs'
  let text = null
  let faceUsed = ''
  for (const spec of [`:${rel}`, `HEAD:${rel}`]) {
    try {
      text = execFileSync('git', ['show', spec], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] })
      faceUsed = spec
      break
    } catch {}
  }
  if (text === null) throw new Error('注册表两个面都取不到 ⇒ 未判定(不记绿)')
  const entry = /check-husky-hook-form\.mjs/.exec(text)
  if (!entry) throw new Error(`${faceUsed} 面上没有 check-husky-hook-form.mjs 的注册条目 ⇒ 门没接进提交链(§0.9:造好没装车=没有)`)
  const window = text.slice(Math.max(0, entry.index - 600), entry.index + 600)
  if (!/blocking/.test(window)) throw new Error('条目未定级 blocking(或定级写在窗口外,请核对注册块)')
  if (!/HUSKY_SKIP_HOOK_FORM/.test(window)) throw new Error('条目缺 skipEnv ⇒ 应急放行没有登记过的出口')
  if (!/stagedTriggers/.test(window) || !/\.husky\//.test(window)) throw new Error('条目缺 stagedTriggers=[".husky/"] ⇒ 会给无关提交造恒红(§12e)')
})

t('M8 H3 装载位:core.hooksPath 指向不存在目录判红,齐备薄壳零违规,未设置按 .git/hooks 判', () => {
  const red = G.judgeHooksInstall(ROOT, { configValue: '.git/no-hooks', exists: () => false })
  if (!red || red.rule !== 'H3') throw new Error('10-21 事故原形(core.hooksPath=.git/no-hooks)未被判红')
  if (!/pre-commit\/post-commit/.test(red.detail)) throw new Error(`缺件未点名:${red.detail}`)
  if (G.judgeHooksInstall(ROOT, { configValue: '.husky', exists: () => true }) !== null) throw new Error('齐备薄壳被误判')
  const unset = G.judgeHooksInstall(ROOT, { configValue: '', exists: (p) => /pre-commit$/.test(p) })
  if (!unset || !/\.git[\\/]hooks/.test(unset.detail)) throw new Error(`未设置时未回落到 .git/hooks:${JSON.stringify(unset)}`)
})

let pass = 0
const fails = []
for (const c of cases) {
  try {
    c.fn()
    pass++
  } catch (e) {
    fails.push(`${c.name} — ${e && e.message ? e.message : String(e)}`)
  }
}
for (const f of fails) console.log(`  ❌ ${f}`)
console.log(`\n镜像 ${pass}/${cases.length} 通过${fails.length ? `,失败 ${fails.length} 条` : ''}(取材面判定 import 源脚本 __test__)`)
process.exit(fails.length ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
