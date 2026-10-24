#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试文件需 console 输出 */
/**
 * 守门 242(check-identity-principal-source.mjs)的镜像测试。
 *
 * §22c 纪律:判据只有一份,住在门体的 `__test__` 导出里 —— 本文件**不得复制任何正则或
 * 客户端/令牌名单**,否则两份必然漂移。这里只做三件事:
 *  ① 用生产同一把尺子跑成对夹具(命中档 + 合法对照档);
 *  ② 形状锁:注册条目 blocking + skipEnv 成套(证明它真装在提交链上,读 runner 现值);
 *  ③ 反向锁:门体不得改判工作区(§0.4 取材面纪律)—— 裸判 worktree 只准是人工逃生舱。
 *
 * 用法:node scripts/tests/check-identity-principal-source.test.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../check-identity-principal-source.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const cases = []
const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })

// ① 成对夹具:每一档都必须"命中"与"放过"同时成立(缺一即判据半边失效)
ok('W1 cast 形态命中', G.judgeW1('const a = (req.user as { userId?: string } | undefined)?.userId\n').length === 1)
ok('W1 可选链形态命中', G.judgeW1('  return req.user?.userId\n').length === 1)
ok('W1 放过 request.userId 与透传 body.user', G.judgeW1('const a = req.userId\nif (req.user !== undefined) body.user = req.user\n').length === 0)
ok('W2 客户端在前命中', G.judgeW2('        userId: q.userId || authUser,\n').length === 1)
ok('W2 令牌在前命中', G.judgeW2('    const subjectId = request.userId ?? query.userId\n').length === 1)
ok('W2 纯令牌读数放过', G.judgeW2('    const userId = request.userId\n').length === 0)
ok('W2 isSystemAdmin 具名出口放过', G.judgeW2(`    const u = isSystemAdmin(req, A) ? q.userId || '' : authUser\n`).length === 0)
ok('W2 摘掉具名谓词即翻红', G.judgeW2('    const u = true ? q.userId || "" : authUser\n').length === 1)
ok('W3 假 oracle 命中', G.judgeW3('    request.user = admin\n').length === 1)
ok('W3 按生产字段填充的夹具放过', G.judgeW3('    request.userId = admin.userId\n').length === 0)
ok('遮罩层在生效', G.maskForJudge('// req.user?.userId\nconst x = 1\n') !== '// req.user?.userId\nconst x = 1\n')

// ② 形状锁:注册条目成套在位(未装车 = 没有)
const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
const at = runner.indexOf("id: '242'")
const entry = at < 0 ? null : runner.slice(at, runner.indexOf('\n  },', at))
ok('242 已登记进 runner', Boolean(entry) && entry.length > 80)
ok('242 blocking 在位', Boolean(entry) && /mode:\s*'blocking'/.test(entry))
ok('242 skipEnv 成套(应急出口唯一)', Boolean(entry) && /HUSKY_SKIP_IDENTITY_PRINCIPAL_SOURCE/.test(entry))
ok('242 射程收到 apps/api/src/', Boolean(entry) && /apps\/api\/src\//.test(entry))
ok('242 指向的门体文件真实存在', runner.includes('check-identity-principal-source.mjs'))

// ③ 反向锁:门体自带 worktree 档必须自称逃生舱,且默认档是 HEAD blob
const gate = readFileSync(path.join(ROOT, 'scripts', 'check-identity-principal-source.mjs'), 'utf8')
ok('门体默认档 = HEAD blob', gate.includes("face = 'head'") || gate.includes("'head'"))
ok('门体保留两面旗同给即未判定', /两面旗同给/.test(gate))

let rc = 0
for (const c of cases) {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
  if (!c.pass) rc = 1
}
console.log(`mirror ${cases.filter((c) => c.pass).length}/${cases.length}`)
process.exit(rc)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
