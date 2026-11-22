// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DG-08 部署轮次被杀后的「标记=HEAD 但健康未证明」必须在下一轮补跑门禁。
//
// 病灶(deploy/win/ihui-deploy.ps1:3970-3976 自述):构建完成、交换 .next、写 IHUI_BUILD_SHA
// 之后,健康门禁出结论之前被强杀 ⇒ 下一轮 behind=0 且 marker==HEAD 命中「无需部署」跳过判定,
// 整轮不跑 ⇒ 未经健康证明的版本长期在线。
//
// 本测试是「装车证明」:被测对象是真跑会重启线上服务的部署脚本,故按仓库既有惯例
// (build-cooldown-fingerprint.test.mjs 同型)落静态结构断言。改前必红:这些锚点在旧实现里不存在。
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

test('① Get-BuildStale 必须在「构建=HEAD」之后再复核健康结论', () => {
  const body = fnBody(src, 'Get-BuildStale')
  assert.match(body, /Get-HealthUnproven/, 'Get-BuildStale 未复核健康结论 ⇒ 被杀轮次的构建仍会被判新鲜')
  assert.match(body, /health-unproven/, '未把「健康未证明」单独归因 ⇒ 日志无法区分重建原因')
  // 构建与 HEAD 相等的分支之后必须还有一次 return $true 的机会(健康未证明)
  const eqAt = body.search(/\$built\s+-ne\s+\$head/)
  const healthAt = body.search(/Get-HealthUnproven/)
  assert.ok(eqAt >= 0 && healthAt > eqAt, '健康复核必须排在「构建 sha == HEAD」判断之后')
})

test('② Get-HealthUnproven:标记缺失或 sha 不等于构建 ⇒ 未证明', () => {
  const body = fnBody(src, 'Get-HealthUnproven')
  assert.match(body, /IHUI_HEALTH_SHA/, '未读健康标记文件')
  assert.match(body, /IHUI_BUILD_SHA/, '未与构建标记比对')
  assert.match(body, /return\s+\$true/, '缺失/读不出时必须判「未证明」')
  assert.match(body, /\$hSha\s+-ne\s+\$built/, 'sha 不等时必须判「未证明」')
})

test('③ Set-HealthMarker 写 sha+verdict,成功尾部与 force 分支都必须写', () => {
  const body = fnBody(src, 'Set-HealthMarker')
  assert.match(body, /IHUI_HEALTH_SHA/, 'Set-HealthMarker 未写健康标记')
  assert.match(body, /sha=\$sha/, '健康标记缺 sha 字段')
  assert.match(body, /verdict=\$Verdict/, '健康标记缺 verdict 字段')

  const calls = [...src.matchAll(/Set-HealthMarker\s+-Verdict\s+'([a-z-]+)'/g)].map((m) => m[1])
  assert.ok(calls.includes('forced'), 'force 豁免分支未写健康标记 ⇒ 强制切流后每轮都会重建')
  for (const v of ['pass', 'pass-unproven', 'entry-broken']) {
    assert.ok(calls.includes(v), `门禁结论 ${v} 未写健康标记`)
  }
})

test('④ 残余注释不得再声称「下一轮不会重新走门禁」', () => {
  assert.ok(
    !src.includes('且**下一轮不会重新走门禁**'),
    '旧的 DG-08 残余自述仍在 ⇒ 修复未登记或注释未同步(以实现为准改注释)',
  )
  assert.match(src, /DG-08/, '缺少 DG-08 闭合说明')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
