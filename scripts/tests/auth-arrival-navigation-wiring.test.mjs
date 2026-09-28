// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 装车锁:`RootNavigator.tsx` 必须真的调用 `authArrivalAction(` 并接 `navigationRef.reset`。
//
// **为什么这一半住在 scripts/tests 而不是 apps/mobile-rn/tests**:
// `config/architecture-policy.yaml` 把 repo-tooling 排在 rank 90、端排在 40,而 D2 判据
// **只比 rank 数值**(策略表原文已记:`补 requires 只消 D1 不消 D2`,换路径照样红)。
// 端内测试写 `import '../../../scripts/lib/code-mask.mjs'` 就是一条向上的依赖边,守门 103
// 判红且**没有**合规的声明办法 —— 上一版把它放在端内,于是 HEAD 面上留了一道与任何提交
// 都无关的 blocking 红(AGENTS §12f:那种红的后果是每台每次被逼跳门,连带全部守门作废)。
//
// 出路也不是把 `maskComments` 抄进端内:遮罩实现全仓只许有一份(6 道门共用 `lib/code-mask.mjs`,
// 镜像测试反向钉死"任一门不得留本地副本")。所以按策略表给同一型记过的成例走 ——
// **把锁放到不反向的那一层**:同模块内 import 不构成跨模块边,而读端内源码用 `readFileSync`
// 不是 import,门不判(对照先例:`packages/shared/tests/chat/` 那一型、
// `deploy/tests/prod-bundle-diagnose.test.mjs` 的"读文本不 import")。
//
// 行为判据那半(六种 `hadToken/hasToken/routeName` 组合的结论,含两条反向对照)仍留在
// `apps/mobile-rn/tests/auth-arrival-navigation.test.ts` —— 那半不需要工具层,挪它反而丢覆盖。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { maskComments } from '../lib/code-mask.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const NAV_FILE = path.join(ROOT, 'apps', 'mobile-rn', 'src', 'navigation', 'RootNavigator.tsx')

// 读工作树而非 HEAD:这条锁断言的是"本次交付把线接上了",而 HEAD 在那之前结构上不可能含它
// (读 HEAD 会让任何新增调用点都先红一轮 —— 与本仓"判据不得替人做出『还没做』的判断"同取向)。
const src = readFileSync(NAV_FILE, 'utf8')
const code = maskComments(src)

test('夹具自证:这文件确实有注释可被剥(否则"剥注释"这一步是空操作)', () => {
  assert.notEqual(src, code)
})

test('调用点在场:authArrivalAction( 出现在代码面而非注释里', () => {
  assert.match(code, /authArrivalAction\(\s*\{/)
})

test('出口在场:判定为 reset-to-main 时走 navigationRef.reset 到 Main', () => {
  assert.match(code, /action !== 'reset-to-main'\) return/)
  assert.match(
    code,
    /navigationRef\.reset\(\{\s*index: 0, routes: \[\{ name: 'Main' \}\]/,
  )
})

test('prevToken 初值取当前 token(冷启动已登录不得被判成"刚到")', () => {
  assert.match(code, /useRef<string \| null>\(token\)/)
})

// ↓ 两条构造面把"这条锁有牙"钉成断言,而不是留成一次性取证(AGENTS §22c:镜像只复读实现
// 就是复读机)。第 2 条尤其不能省 —— 注释形态若也能匹配,上面三条就同时是恒真的。
test('阳性对照:调用点只写在注释里 ⇒ 遮罩后必须匹配不到', () => {
  const onlyComment = `
// authArrivalAction({ hadToken, hasToken, routeName }) 早先这里就是这么调的
const other = 1
`
  assert.ok(onlyComment.includes('authArrivalAction('), '夹具自证:原文里含该字样')
  assert.ok(onlyComment !== maskComments(onlyComment), '夹具自证:遮罩真的动了这一份')
  assert.doesNotMatch(maskComments(onlyComment), /authArrivalAction\(\s*\{/)
})

test('反向对照:代码形态必须匹配到,且同文件里另有注释也写着同一串也不影响', () => {
  const wired = `
// 说明里也提一句 authArrivalAction({  —— 不该被当成调用点
const a = authArrivalAction({ hadToken, hasToken, routeName })
`
  assert.match(maskComments(wired), /authArrivalAction\(\s*\{/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
