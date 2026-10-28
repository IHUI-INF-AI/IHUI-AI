// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 构建失败冷却必须比对「失败时记录的 head」的源码子树指纹,不得只看时间戳(G-916430②)。
//
// 成因:Test-BuildCooldown 此前只判 `ageMin ∈ [0,30)`,于是 08:06 一次真构建失败写下的
// 30 分钟冷却,在 08:24 分叉解开、HEAD 早已推进、失败根因已随新提交消除之后仍白拦 9 轮
// (实测 08:24–08:35,用户多看 12 分钟旧版)。
// 刻意不按"HEAD 变了就不拦"修:本机 HEAD 每 1–2 分钟被并发会话推进一次,台账提交与
// 源码提交混在一起,按 sha 键控等于把真构建失败的节流整条关掉(每 60 秒重试全量 next
// build ⇒ CPU 风暴)。正解与 push-gate 的 computeGateFingerprint 同源:比
// `<sha>:apps` + `<sha>:packages` 两棵树的 tree hash —— 台账提交不触碰冷却,源码子树
// 变了才放行本轮重试。
//
// 本测试是「装车证明」:被测对象是生产部署脚本(真跑会重启线上服务),故把可判定的
// 结构约束落成静态断言(与 ihui-deploy-mail-channel.test.mjs 同一动机)。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEPLOY_PS1 = resolve(HERE, '../../deploy/win/ihui-deploy.ps1')
const src = readFileSync(DEPLOY_PS1, 'utf8')

/** 取 `function <name> { ... }` 的大括号配对正文(脚本内无孤立花括号)。 */
function fnBody(source, name) {
  const start = source.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `未找到 function ${name}(改名或删除会使本护栏失明)`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error(`function ${name} 的花括号未闭合`)
}

test('① Test-BuildCooldown 必须在时间窗之上再比对源码子树指纹(不是只看时间戳)', () => {
  const body = fnBody(src, 'Test-BuildCooldown')
  // 时间窗仍是第一道(原口径不变):30 分钟边界必须在位
  assert.match(body, /ageMin/, '冷却判定不再读 ageMin ⇒ 时间窗被摘除')
  assert.match(body, /30/, '30 分钟窗口字面量丢失')
  // 指纹比对在位:两次取指纹(失败时记录的 head + 当前 HEAD)且判不等
  assert.match(body, /Get-BuildSrcFingerprint/, 'Test-BuildCooldown 未调用指纹函数 ⇒ 只看时间戳的旧口径复活')
  assert.match(body, /\$st\.head/, '未回读冷却记录里存的 head ⇒ 无法比对失败时的源码面')
  assert.match(body, /\$curFp\s+-ne\s+\$oldFp/, '指纹不等时放行的分支丢失 ⇒ 白拦缺陷回归')
})

test('② 指纹必须与 push-gate 同源:HEAD:apps + HEAD:packages 两棵树的 rev-parse', () => {
  const body = fnBody(src, 'Get-BuildSrcFingerprint')
  assert.match(body, /rev-parse/, '未走 git rev-parse')
  assert.match(body, /\$\$\{?Sha\}?:apps|\$Sha`:apps|"\$Sha`:apps"|\$\{Sha\}:apps/, '指纹不含 <sha>:apps 子树')
  assert.match(body, /\$\$\{?Sha\}?:packages|\$Sha`:packages|"\$Sha`:packages"|\$\{Sha\}:packages/, '指纹不含 <sha>:packages 子树')
  // 两棵树都取到才成指纹:缺一即返回 ''(不当作"判过")
  assert.match(body, /Count\s+-lt\s+2/, '未按"两棵树都在"收口 ⇒ 半截指纹会被当完整指纹')
})

test('③ 顺序与降级:时间窗先判,指纹任一侧取不到时退回纯时间戳口径(不把没判成当判过)', () => {
  const body = fnBody(src, 'Test-BuildCooldown')
  const timeCheck = body.search(/ageMin/)
  const fpCheck = body.search(/Get-BuildSrcFingerprint/)
  assert.ok(timeCheck >= 0 && fpCheck > timeCheck, '时间窗必须先于指纹判定(窗口外直接 false,不浪费两次 rev-parse)')
  // 指纹放行必须要求两侧都非空:`-and $curFp -ne $oldFp` 形态
  assert.match(
    body,
    /\$oldFp\s+-and\s+\$curFp\s+-and\s+\$curFp\s+-ne\s+\$oldFp/,
    '指纹放行未要求两侧均取到 ⇒ 取不到指纹的一侧(空串)会被误判成"源码已变"而放行',
  )
  // catch 兜底仍是 false(冷却态读不出来时保持冷却,宁可多重试一轮也不误关节流)
  assert.match(body, /catch\s*\{\s*return\s+\$false\s*\}/, '异常面未退回 $false')
})

test('④ 输入在位:Set-BuildCooldown 仍记录 head(指纹的失败侧数据源)', () => {
  const body = fnBody(src, 'Set-BuildCooldown')
  assert.match(body, /head\s*=\s*\$sha/, '冷却记录不再存 head ⇒ 指纹比对没有失败侧输入')
  assert.match(body, /rev-parse\s+HEAD/, 'Set 时未取 HEAD')
})
