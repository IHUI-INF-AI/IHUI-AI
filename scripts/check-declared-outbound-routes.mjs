#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-declared-outbound-routes.mjs — 跨语言「声明的自仓出站点 ↔ 对侧路由注册」静态对账
 *
 * 在修什么(第九轮 ZCode 吸收 B1):
 *   `apps/ai-service/app/services/orchestration_hub.py` 的 `_PILLAR_API_PATHS` 声明了 6 条支柱端点
 *   (`/api/{rules,hooks,specs,context,subagents,terminal}/orchestrate`),而 `apps/api` 的注册面里
 *   **一条都不存在**(`orchestrate` 在 `apps/api/src/routes/*.ts` 只命中另一条 `/hooks/auto-orchestrate`,
 *   路径与服务都不同)。这一型的失效形态是:一侧硬编码了出站路径,对侧根本没有那条路由 ——
 *   `tsc` 不红、单测不红、其余守门也不红,**只有运行时才 404**(与守门 72/78/126 同族:本地全绿、
 *   出事的是别人)。既有守门 `check-api-routes.mjs` 方向相同,覆盖面却只有「前端 fetch → api」;
 *   **服务端↔服务端(Python↔TS)那一格无人看守** —— 本门补的就是这一格。
 *
 * 判据(声明 D / 注册 R / 一条红):
 *   D 「声明」= 以 `/api/` 开头的**字符串字面量**,且同一行具备下列证据之一(宁漏不误报):
 *       E1 selfbase-line —— 同一行把该路径拼到「自家 base」上(`f"{base}/api/x"` / `` `${cfg.AI_SERVICE_URL}/api/x` ``);
 *       E2 egress-call   —— 同一行是 HTTP 出站调用:通用客户端(fetch / axios.x / httpx / aiohttp / requests /
 *                            client.x / session.x / .request()),或**由代码推导出来的**本仓出站包装函数
 *                            (`deriveEgressWrappers`:形参收 path、体内把 path 拼到 base、再发请求)。
 *                            包装名不写死清单 —— 清单必然腐烂(§4 对 `RN_ONLY_BRAND_KEYS` 的教训)。
 *       E3 path-table    —— 字面量是「路径表」(如 `_PILLAR_API_PATHS` 这类常量对象/字典)的值,且该表名
 *                            或它的一跳别名在同一文件里出现在带自家 base 的 URL 组装行上。
 *     「自家 base」同样由代码推导:初值/默认值命中 SELF_HOSTS(localhost / 127.0.0.1 / ::1 / 0.0.0.0 /
 *     host.docker.internal)的变量、字段、环境变量默认值,以及 return 这种字面量的函数,再一跳展开
 *     (`base = api_base_url()`、`base_url, src = _resolve()`)。⇒ 第三方厂商 base
 *     (`api_base = "https://dashscope.aliyuncs.com/..."`)不会被当作出站点(D5 反例钉死)。
 *     三种证据都没有的字面量(鉴权白名单、限流前缀、中间件跳过表等**入站匹配**用法)不计声明,
 *     但计入 `ignoredNonEgress` 并打印 —— 绝不静默丢弃。
 *   R 「注册」= `apps/api/src/**` 的 Fastify 形态(`server.get('/x')`、`server.get<{...}>('/x')`、
 *       `route({method,url})`、`server.register(fn,{prefix})`、`registerRoutes(server)` 直调)与
 *       `apps/ai-service/app/**` 的 FastAPI 形态(`@router.get('/x')` + `APIRouter(prefix=...)` +
 *       `include_router(..., prefix=...)` + `app.mount(prefix, ...)`),沿挂载图从入口
 *       (`server.ts` / `main.py` 的 `app`)拼出完整路径集合。动态段(`:id` / `{id}` / `${x}`)归一成 `*`,
 *       所以注册 `/api/agents/:id` 能对上声明 `/api/agents/<uuid>`。
 *   ✗ 判红:D 中某条路径**两边注册集都匹配不到任何路由** ⇒ 点名 文件:行号 + 该路径 + 对照的注册集大小。
 *
 * 三态纪律(与守门 77/83/98/103/118 同口径):
 *   - **默认档只报数不判红**(exit 0),`--strict` 才判红。本仓当下已知有 6 条真红(hub 那批),
 *     当场 blocking 就是一台与任何提交都无关的恒红门,唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e)。
 *     修复出口 = 补对侧实现,或删这行硬编码声明(定性归持有人)。**禁止**用豁免清单/基线文件把 6 条遮掉
 *     —— 台账会腐烂,而这 6 条是真缺陷;也不得为让默认档好看去削判据(strict 只改退出码,不改覆盖面)。
 *   - 宁漏不误报:解析不出来的形态(base 解不出、前缀由变量拼出、挂载图走不通、`app.mount` 子树不可见)
 *     一律进「未判定」并**逐条打印**,绝不静默算通过,也绝不判红。
 *   - 取材**同面同轮**:默认判 HEAD blob、`--staged` 判索引 blob、`--worktree` 仅人工逃生舱,
 *     两面旗同给 ⇒ exit 2;任一面取不到 ⇒ exit 2 且**不回落**另一个面(回落就是把"没判"写成"判过了")。
 *     清单(`ls-tree` / `ls-files`)与正文(**一次** `cat-file --batch`)同面同轮;枚举到 0 个源文件判死;
 *     注册集与不透明前缀**双双为 0** 判死(解析器失明不得读成"没有声明被打到 ⇒ 绿")。
 *     取材一律走 `scripts/lib/face-reader.mjs` 的读取入口(`catBatch` / `readWorktreeFile`)——
 *     门 118 专判"引了层却自己派生 git"的半接线。
 *
 * 行内豁免:`route-declare-exempt: <原因>`(须带原因),只救本行;被豁免处计数并打印。
 *
 * 用法:
 *   node scripts/check-declared-outbound-routes.mjs                  # 全量(HEAD blob),只报数 ⇒ exit 0
 *   node scripts/check-declared-outbound-routes.mjs --strict         # 未匹配>0 ⇒ exit 1 并逐条点名
 *   node scripts/check-declared-outbound-routes.mjs --staged         # 索引面(提交链)
 *   node scripts/check-declared-outbound-routes.mjs --worktree       # 磁盘面(人工排查)
 *   node scripts/check-declared-outbound-routes.mjs --explain        # 逐条声明 + 证据 + 匹配结果
 *   node scripts/check-declared-outbound-routes.mjs --json           # 机器可读
 *   node scripts/check-declared-outbound-routes.mjs --files a.py,b.ts  # 只审指定文件的声明面(注册面仍全量)
 *   node scripts/check-declared-outbound-routes.mjs --self-test      # 判据自检(构造面正反例 + 真语料端到端)
 * 退出码:0 = 默认档(或 --strict 且零未匹配);1 = --strict 且检出未匹配;2 = 无法判定
 *
 * onFailHint:① `--strict --explain` 看清哪条声明在打哪条不存在的路由;② 二选一 —— 在对侧实现该路由,
 *   或删除这行硬编码声明;③ 禁止为本门加基线文件/豁免清单消红,禁止改判据阈值让它好看。
 * 紧急跳过:本门**尚未接入提交链**(注册表由主会话单写,§12),故当前没有 skipEnv;
 *   接入时按 runner 现值取 `HUSKY_SKIP_DECLARED_OUTBOUND_ROUTES=1`。
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  Undetermined,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import {
  FASTIFY_ENTRY,
  FASTAPI_ENTRY,
  SCAN_DIRS,
  SELF_HOSTS,
  TEST_DIR_RE,
  TEST_FILE_RE,
  classifyWrapper,
  collectPathTables,
  decide,
  deriveBaseNames,
  deriveEgressWrappers,
  extractDeclarations,
  isRegistrationLine,
  isTableUsedForEgress,
  joinPrefix,
  matchDeclared,
  normSegs,
  pathSegs,
  scanApiLiterals,
  segmentsMatch,
} from './lib/outbound-route-facts.mjs'
import {
  analyzePyFile,
  analyzeTsFile,
  buildFastApiRegistrations,
  buildFastifyRegistrations,
} from './lib/outbound-route-registrations.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_DECLARED_OUTBOUND_ROUTES'

/* ------------------------------- 取材 ------------------------------- */

export function listSourceFiles(root, face) {
  const out =
    face === 'staged'
      ? gitRaw(['ls-files', '-z', '--', ...SCAN_DIRS], root)
      : gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS], root)
  return String(out)
    .split('\0')
    .filter(Boolean)
    .filter((p) => (p.endsWith('.ts') || p.endsWith('.py')) && !TEST_FILE_RE.test(p) && !TEST_DIR_RE.test(p))
}

/** 一次 `cat-file --batch` 把同一面全部候选读满(清单与内容同面同轮) */
export function readSourceFiles(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${p}`)
      map.set(p, t)
    }
    return map
  }
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const specs = paths.map((p) => pre + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  for (let i = 0; i < paths.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${paths[i]} ⇒ 不回落另一个面`)
    map.set(paths[i], t)
  }
  return map
}

export function analyze(root, face, opts = {}) {
  const paths = listSourceFiles(root, face)
  if (paths.length === 0)
    throw new Undetermined(`${face} 面枚举到 0 个服务端源文件 —— 判据失效,不计通过`)
  const texts = readSourceFiles(root, face, paths)
  const regTs = buildFastifyRegistrations(texts)
  const regPy = buildFastApiRegistrations(texts)
  const reg = { paths: new Set([...regTs.paths, ...regPy.paths]), opaque: new Set([...regTs.opaque, ...regPy.opaque]) }
  // 两个解析器同时失明 ⇒ 硬失败。判据失效的表现不能是"没有声明被打到 ⇒ 绿"。
  if (reg.paths.size === 0 && reg.opaque.size === 0)
    throw new Undetermined('注册面解析到 0 条路由且 0 个不透明前缀 —— 判据失效,不计通过')
  const extracted = extractDeclarations(texts)
  const only = opts.onlyFiles && opts.onlyFiles.length ? new Set(opts.onlyFiles) : null
  const candidates = only ? extracted.decls.filter((d) => only.has(d.file)) : extracted.decls
  const verdict = decide({
    decls: candidates,
    reg,
    exempted: (extracted.exempted || []).filter((e) => !only || only.has(e.file)),
    strict: !!opts.strict,
  })
  const matchedBy = new Map(verdict.covered.map((c) => [`${c.file}:${c.line}`, c.via]))
  return {
    ...verdict,
    face,
    strict: !!opts.strict,
    filesScanned: paths.length,
    ignoredNonEgress: extracted.ignoredNonEgress,
    externalBase: extracted.externalBase,
    skippedRegistration: extracted.skippedRegistration,
    wrappers: [...extracted.wrappers],
    unresolved: [...regTs.unresolved, ...regPy.unresolved],
    opaqueList: [...reg.opaque],
    regTs: regTs.paths.size,
    regPy: regPy.paths.size,
    declsAll: extracted.decls,
    matchedBy,
  }
}

export function formatReport(out) {
  const lines = []
  const faceLabel =
    out.face === 'staged'
      ? '索引 blob(本次提交会带走的那一份)'
      : out.face === 'worktree'
        ? '工作树(人工逃生舱,提交链不走这档)'
        : 'HEAD blob(全量审计)'
  if (out.unmatched.length) {
    lines.push(
      `${out.strict ? '❌ 判红' : '⚠️ 只报数(默认档不判红;要问责用 --strict)'}:` +
        ` ${out.unmatched.length} 条声明的自仓出站点在两侧路由注册面里都匹配不到任何路由`,
    )
    for (const u of out.unmatched)
      lines.push(`   ${u.file}:${u.line}  ${u.path}  (证据=${u.evidence};对照注册集 ${out.counts.registered} 条)`)
    lines.push('   问责路径:① --strict --explain 看清哪条声明打的是不存在的路由;')
    lines.push('             ② 二选一 —— 在对侧实现该路由,或删除这行硬编码声明;')
    lines.push('             ③ 禁止用基线文件/豁免清单把真红遮掉(台账会腐烂,而这批是真缺陷)。')
  }
  lines.push(
    `声明 ${out.counts.declared} / 注册 ${out.counts.registered} / 未匹配 ${out.counts.unmatched} / 未判定 ${out.counts.undetermined}` +
      `  (命中 ${out.counts.covered};豁免命中 ${out.counts.exempt};取材面:${faceLabel})`,
  )
  lines.push(
    `   拆分:Fastify 注册 ${out.regTs} + FastAPI 注册 ${out.regPy};入站匹配而忽略的字面量 ${out.ignoredNonEgress};` +
      `第三方 base ${out.externalBase};注册面行 ${out.skippedRegistration};不透明前缀 ${out.opaqueList.length} 个;挂载图未解析 ${out.unresolved.length} 处。`,
  )
  return lines
}

const USAGE = `用法: node scripts/check-declared-outbound-routes.mjs [--staged|--worktree] [--strict] [--explain] [--json] [--files a,b] [--self-test]
  默认档只报数不判红(exit 0)—— 真仓当下有 hub 那批真红,当场判红就是恒红门(§12e)。
  问责:① --strict --explain 看清哪条声明打的是不存在的路由;② 二选一 —— 补对侧路由,或删这行硬编码声明;
        ③ 禁止为本门加基线文件/豁免清单让它好看,禁止为消红削判据。
  紧急跳过(接入提交链后):${SELF_SKIP}=1`

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return 0
  }
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  const onlyFiles = argv.includes('--files')
    ? String(argv[argv.indexOf('--files') + 1] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null
  let out
  try {
    out = analyze(ROOT, face, { strict: argv.includes('--strict'), onlyFiles })
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          face: out.face,
          strict: out.strict,
          filesScanned: out.filesScanned,
          counts: out.counts,
          ignoredNonEgress: out.ignoredNonEgress,
          externalBase: out.externalBase,
          skippedRegistration: out.skippedRegistration,
          wrappers: out.wrappers,
          unresolved: out.unresolved,
          unmatched: out.unmatched,
          undetermined: out.opaqueCovered,
          exempted: out.exemptHit,
        },
        null,
        2,
      ),
    )
    return out.exit
  }
  if (argv.includes('--explain')) {
    console.log('—— 逐条声明 ——')
    for (const d of out.declsAll)
      console.log(`  ${d.file}:${d.line}  ${d.path}  证据=${d.evidence}  ⇒ ${out.matchedBy.get(`${d.file}:${d.line}`) || '未匹配/未判定'}`)
    console.log('—— 未判定(注册面在该前缀下不透明)——')
    for (const o of out.opaqueCovered) console.log(`  ${o.file}:${o.line}  ${o.path}  (不透明前缀 ${o.opaque})`)
    console.log('—— 挂载图未解析 ——')
    for (const u of out.unresolved.slice(0, 40)) console.log(`  ${u}`)
    if (out.unresolved.length > 40) console.log(`  …另 ${out.unresolved.length - 40} 条`)
  }
  for (const l of formatReport(out)) console.log(l)
  return out.exit
}

/* ------------------------------- 自检 ------------------------------- */

function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }

  /* 面选择 */
  eq('A1 两面旗同给 ⇒ 判死', selectFace({ staged: true, worktree: true, def: 'head' }).error, '--staged 与 --worktree 不得同用(两个判定面互斥)')
  eq('A2 默认面是 HEAD(不是磁盘)', selectFace({ staged: false, worktree: false, def: 'head' }).face, 'head')

  /* 归一与匹配 */
  eq('B1 :id 归一', normSegs('/api/agents/:id'), ['api', 'agents', '*'])
  eq('B2 ${ID_A} 归一', normSegs('/api/agents/${ID_A}/transition'), ['api', 'agents', '*', 'transition'])
  eq('B3 查询串不参与匹配', normSegs('/api/context/sources?page=2'), ['api', 'context', 'sources'])
  eq('B4 参数化路由能吃(注册 :id ↔ 声明具体值)', segmentsMatch(['api', 'agents', '123'], ['api', 'agents', '*']), true)
  eq('B5 段数不等 ⇒ 不匹配', segmentsMatch(['api', 'a', 'b', 'c'], ['api', 'a', 'b']), false)
  eq('B6 静态段不同 ⇒ 不匹配', segmentsMatch(['api', 'hooks', 'orchestrate'], ['api', 'hooks', 'auto-orchestrate']), false)
  eq('B7 前缀拼接', joinPrefix('/api', '/rules/:id'), '/api/rules/:id')

  /* base 推导正反 */
  const base = (s, l) => deriveBaseNames(s, l)
  eq('C1 pydantic 字段默认值是自家 ⇒ 推出 self token', base('api_service_url: str = "http://localhost:8802"\n', 'py').self.has('api_service_url'), true)
  eq('C2 第三方域初值 ⇒ 归 external 而非 self(反例)', base('_DASH = "https://dashscope.aliyuncs.com/api/v1"\n', 'py').self.has('_DASH'), false)
  eq('C2b 同一条:确实归入 external', base('_DASH = "https://dashscope.aliyuncs.com/api/v1"\n', 'py').external.has('_DASH'), true)
  eq('C3 return 自家 URL 的函数 ⇒ 函数名也是来源', base('def _resolve_api_base_url():\n    return "http://localhost:8802"\n', 'py').self.has('_resolve_api_base_url'), true)
  eq('C4 一跳展开(base = api_base_url())', base('def api_base_url():\n    return "http://localhost:8803"\nx = api_base_url()\n', 'py').self.has('x'), true)

  /* 三种证据各自正反 */
  const HUB = [
    '_PILLAR_API_PATHS: dict[str, str] = {',
    '    "rules": "/api/rules/orchestrate",',
    '    "hook": "/api/hooks/orchestrate",',
    '}',
    'def _resolve_api_base_url():',
    '    return "http://localhost:8802"',
    'async def _run(self, pillar):',
    '    api_path = _PILLAR_API_PATHS.get(pillar)',
    '    base_url = _resolve_api_base_url()',
    '    url = f"{base_url}{api_path}"',
    '    async with aiohttp.ClientSession() as s:',
    '        await s.post(url)',
    '',
  ].join('\n')
  const dHub = extractDeclarations(new Map([['apps/ai-service/app/services/hub.py', HUB]]))
  eq('D1 E3 path-table:hub 表值被认成声明(正例)', dHub.decls.map((x) => x.path), ['/api/rules/orchestrate', '/api/hooks/orchestrate'])
  eq('D2 E3 证据名如实', dHub.decls[0] && dHub.decls[0].evidence, 'path-table')
  eq('D3 表未被任何出站用法引用 ⇒ 不算声明(反例)', extractDeclarations(new Map([['app/a.py', 'TABLE_PATHS = {\n    "x": "/api/x/y",\n}\n']])).decls.length, 0)
  eq('D4 E1 selfbase-line 正例', extractDeclarations(new Map([['app/b.py', 'url = f"{settings.api_service_url}/api/im-gateway/send"\napi_service_url: str = "http://localhost:8802"\n']])).decls[0].evidence, 'selfbase-line')
  eq('D5 第三方 base 的插值 ⇒ 不得算声明(反例)', extractDeclarations(new Map([['app/c.py', '_DASH = "https://dashscope.aliyuncs.com/api/v1"\nurl = f"{_DASH}/api/v1/services/aigc/x"\n']])).decls.length, 0)
  const TS_WRAP = [
    'const cfg = { AI_SERVICE_URL: "http://localhost:8803" }',
    'export async function aiServiceFetch(request: unknown, path: string) {',
    '  const url = `${cfg.AI_SERVICE_URL}${path}`',
    '  return fetch(url)',
    '}',
    "const r = await aiServiceFetch(null, '/api/browser/render', {})",
    '',
  ].join('\n')
  const dWrap = extractDeclarations(new Map([['apps/api/src/utils/f.ts', TS_WRAP]]))
  eq('D6 E2 egress-call(包装名由代码推导,不靠清单)正例', dWrap.decls.map((x) => x.path), ['/api/browser/render'])
  eq('D7 包装函数确实被推导出来', [...dWrap.wrappers].includes('aiServiceFetch'), true)
  eq('D8 入站匹配用途的字面量 ⇒ 不算声明(反例)', extractDeclarations(new Map([['apps/api/src/plugins/x.ts', "if (url === '/api/health' || url.startsWith('/api/admin')) return true\n"]])).decls.length, 0)
  eq('D9 注释里的路径不算声明(遮噪在位)', extractDeclarations(new Map([['apps/api/src/plugins/y.ts', '// 说明:这里打 /api/never-real\n']])).decls.length, 0)
  eq('D10 注册面行不得同时被当成声明', extractDeclarations(new Map([['apps/api/src/routes/z.ts', "server.post('/api/z/self', async () => ({}))\n"]])).decls.length, 0)
  eq('D11 未判定不等于通过:同一条路径按证据分桶', dHub.decls.every((x) => x.evidence === 'path-table'), true)

  /* Fastify 前缀拼接正反 */
  const fx = new Map([
    ['apps/api/src/server.ts', "import { rulesRoutes } from './routes/rules.js'\nserver.register(rulesRoutes, { prefix: '/api' })\n"],
    ['apps/api/src/routes/rules.ts', 'export const rulesRoutes = async (server) => {\n  server.post<{ Params: { id: string } }>("/rules/:id/feedback", async () => ({}))\n}\n'],
  ])
  eq('F1 Fastify 前缀拼接 + 泛型实参能吃(正例)', buildFastifyRegistrations(fx).paths.has('api/rules/*/feedback'), true)
  const fx2 = new Map([
    ['apps/api/src/server.ts', "import { rulesRoutes } from './routes/rules.js'\nserver.register(rulesRoutes)\n"],
    ['apps/api/src/routes/rules.ts', 'export const rulesRoutes = async (server) => {\n  server.get("/rules", async () => ({}))\n}\n'],
  ])
  eq('F2 无 prefix 时不得凭空造 /api(反例)', buildFastifyRegistrations(fx2).paths.has('api/rules'), false)
  const fx3 = new Map([
    ['apps/api/src/server.ts', "import { registerRoutes } from './routes/index.js'\nregisterRoutes(server)\n"],
    ['apps/api/src/routes/index.ts', "import { healthRoutes } from './health.js'\nexport function registerRoutes(server: any) {\n  server.register(healthRoutes, { prefix: '/api' })\n}\n"],
    ['apps/api/src/routes/health.ts', 'export const healthRoutes = async (server) => {\n  server.get("/health/ready", async () => ({}))\n}\n'],
  ])
  eq('F3 直调函数(不经 register)也沿图走通', buildFastifyRegistrations(fx3).paths.has('api/health/ready'), true)
  const fx4 = new Map([
    ['apps/api/src/server.ts', 'const crudRoutes = async (app) => {\n  app.get("/crud/:id", async () => ({}))\n}\nserver.register(crudRoutes, { prefix: \'/api/v1\' })\n'],
  ])
  const mk = (path, file = 'app/x.py', line = 1) => ({ path, file, line, evidence: 'egress-call' })
  // F4/F4b 是一对:同文件 const 插件(路由挂在别名实例上)本层不追进去 —— 该前缀下的路由**既不算命中也不算未匹配**,
  // 而是记不透明前缀 ⇒ 落"未判定"桶。判红必须只在"确信没有"的时候发生(宁漏不误报)。
  eq('F4 同文件 const 插件 + 前缀 ⇒ 该前缀记为不透明(未判定,不判红)', [...buildFastifyRegistrations(fx4).opaque].includes('/api/v1'), true)
  eq('F4b 同一形态:其路由不得被当成"已注册"(那会把不透明的子树洗成确信)', buildFastifyRegistrations(fx4).paths.has('api/v1/crud/*'), false)
  eq('F4c 声明落在不透明前缀下 ⇒ 计未判定、退出码仍 0', decide({ decls: [mk('/api/v1/crud/1')], reg: { paths: buildFastifyRegistrations(fx4).paths, opaque: buildFastifyRegistrations(fx4).opaque }, exempted: [], strict: true }).counts.undetermined, 1)

  /* FastAPI 前缀拼接正反 */
  const py = new Map([
    ['apps/ai-service/app/main.py', "from app.routers import hooks\napp.include_router(hooks.router, prefix='/api')\n"],
    ['apps/ai-service/app/routers/hooks.py', "router = APIRouter(prefix='/hooks')\n\n@router.post('/auto-orchestrate')\nasync def a():\n    pass\n"],
  ])
  eq('F5 FastAPI include_router + APIRouter 前缀拼接(正例)', buildFastApiRegistrations(py).paths.has('api/hooks/auto-orchestrate'), true)
  const py2 = new Map([['apps/ai-service/app/routers/orphan.py', "@router.get('/never-mounted')\nasync def o():\n    pass\n"]])
  eq('F6 未被挂载的 router ⇒ 不得进注册集(反例)', buildFastApiRegistrations(py2).paths.has('never-mounted'), false)
  const py3 = new Map([
    ['apps/ai-service/app/main.py', 'from app.services import mcp_export\nmcp_export.mount_to_app(app)\n'],
    ['apps/ai-service/app/services/mcp_export.py', 'MCP_EXPORT_PREFIX = "/api/mcp/export"\n\n\ndef mount_to_app(app, prefix: str = MCP_EXPORT_PREFIX) -> None:\n    app.mount(prefix, app=get_export_app())\n'],
  ])
  eq('F7 app.mount 子树不可见 ⇒ 记不透明前缀而不是判红', [...buildFastApiRegistrations(py3).opaque].includes('/api/mcp/export'), true)
  const py4 = new Map([
    ['apps/ai-service/app/main.py', "from app.routers import rules\napp.include_router(rules.router, prefix='/api')\n"],
    ['apps/ai-service/app/routers/rules.py', "router = APIRouter()\n\n@router.get('/rules/{rule_id}/history')\nasync def h(rule_id: str):\n    return {}\n"],
  ])
  eq('F8 FastAPI {param} 路径段归一', buildFastApiRegistrations(py4).paths.has('api/rules/*/history'), true)

  /* 聚合三态 */
  const regX = { paths: new Set(['api/agents']), opaque: new Set(['/api/mcp/export']) }
  eq('G1 默认档:未匹配存在仍 exit 0(存量不得造恒红门)', decide({ decls: [mk('/api/nope')], reg: regX, exempted: [], strict: false }).exit, 0)
  eq('G2 strict:同一条输入必须判红', decide({ decls: [mk('/api/nope')], reg: regX, exempted: [], strict: true }).exit, 1)
  eq('G2b strict 判红时必须点名', decide({ decls: [mk('/api/nope')], reg: regX, exempted: [], strict: true }).unmatched.length, 1)
  eq('G3 命中的不得混进未匹配', decide({ decls: [mk('/api/agents')], reg: regX, exempted: [], strict: true }).counts.unmatched, 0)
  eq('G4 不透明前缀覆盖 ⇒ 计未判定、不判红', decide({ decls: [mk('/api/mcp/export/sse')], reg: regX, exempted: [], strict: true }).exit, 0)
  // G5a/G5b 是一对:注册的动态段**只吃声明本身也是动态**的段。
  // 正例:调用方拼的是运行时的 id ⇒ 参数化路由必须认(否则每条带 id 的出站调用都假红)。
  eq('G5a 声明带插值段 ⇒ 参数化路由要吃下它', decide({ decls: [{ ...mk('/api/agents/' + '${agentId}'), segs: pathSegs('/api/agents/' + '${agentId}') }], reg: { paths: new Set(['api/agents/*']), opaque: new Set() }, exempted: [], strict: true }).counts.unmatched, 0)
  // 反例:声明写死一个静态词 ⇒ 不能被 GET /api/rules/:id 这种"形状相同"的路由洗白。
  //        这一条就是 hub 6 条里 rules/hooks 两条曾经隐身的原因(实测,不是假想)。
  eq('G5b 声明是写死的静态段 ⇒ 不得被参数化路由的形状吞掉(反例)', decide({ decls: [mk('/api/rules/orchestrate')], reg: { paths: new Set(['api/rules/*']), opaque: new Set() }, exempted: [], strict: true }).counts.unmatched, 1)
  eq('G5c 同一条静态路径若有真静态路由在册 ⇒ 必须算命中(证明 G5b 红在形状不在判据)', decide({ decls: [mk('/api/rules/orchestrate')], reg: { paths: new Set(['api/rules/orchestrate']), opaque: new Set() }, exempted: [], strict: true }).counts.unmatched, 0)
  const ex = [{ file: 'app/x.py', line: 7, reason: '该端点由网关转发,不在本仓注册面', literals: 1 }]
  eq('G6 豁免(带原因)命中该行 ⇒ 计 exempt 不计未匹配', decide({ decls: [mk('/api/nope', 'app/x.py', 7)], reg: regX, exempted: ex, strict: true }).counts.exempt, 1)
  eq('G7 豁免只救本行(别处同路径仍算未匹配)', decide({ decls: [mk('/api/nope', 'app/x.py', 9)], reg: regX, exempted: ex, strict: true }).counts.unmatched, 1)

  /* 真语料端到端(判 HEAD blob,现读不钉数字) */
  const real = analyze(ROOT, 'head', {})
  const hub6 = [
    '/api/rules/orchestrate',
    '/api/hooks/orchestrate',
    '/api/specs/orchestrate',
    '/api/context/orchestrate',
    '/api/subagents/orchestrate',
    '/api/terminal/orchestrate',
  ]
  const declared = new Set(real.declsAll.map((d) => d.path))
  eq('R1 真语料:6 条 hub 声明必须全被认出来(漏一条=门对该型全盲)', hub6.filter((p) => !declared.has(p)), [])
  const unmatchedPaths = new Set(real.unmatched.map((u) => u.path))
  eq('R2 真语料:6 条都归入"未匹配"报数(没被不透明前缀洗掉)', hub6.filter((p) => !unmatchedPaths.has(p)), [])
  eq('R3 真语料:确有声明命中注册路由(证明判据不是恒红)', real.counts.covered > 50 && real.covered.some((c) => c.path === '/api/browser/render' && c.file === 'apps/api/src/jobs/ai-world-sync.ts'), true)
  eq('R4 真语料:注册集不得为 0(0=解析器坏了而一路绿灯)', real.counts.registered > 500, true)
  eq('R5 真语料:默认档 exit 0(存量 6 条不得钉红每次提交)', real.exit, 0)
  eq('R6 真语料:strict 必须判红(判据本身有牙)', analyze(ROOT, 'head', { strict: true }).exit, 1)
  console.log(
    `  ℹ️ 真仓现读:声明 ${real.counts.declared} / 注册 ${real.counts.registered} / 未匹配 ${real.counts.unmatched} / 未判定 ${real.counts.undetermined} / 忽略 ${real.ignoredNonEgress}`,
  )

  // 豁免出口必须是**活的**:本仓最高频的失效型是"文档写了出路,实现读不到"
  // (实测旧实现把标记扫在 maskComments 之后的面上 ⇒ 标记写在注释里永远命中不了)
  {
    const ex = extractDeclarations(
      new Map([
        [
          'app/same.ts',
          "const API_BASE = 'http://localhost:8802'\nconst u = `${API_BASE}/api/v1/ghostA` // route-declare-exempt: 第三方 host\n",
        ],
        [
          'app/prev.ts',
          "const API_BASE = 'http://localhost:8802'\n// route-declare-exempt: 上一行带因由\nconst v = `${API_BASE}/api/v1/ghostB`\n",
        ],
        ['app/bare.ts', '// route-declare-exempt: 这一行根本没有出站点\nconst t = 1\n'],
        [
          'app/noneed.ts',
          "const API_BASE = 'http://localhost:8802'\nconst w = `${API_BASE}/api/v1/ghostC`\n",
        ],
      ]),
    )
    eq(
      'X1 同行注释里的豁免必须被读到(旧实现在这里永远为 0)',
      ex.exempted.filter((e) => e.file === 'app/same.ts').length,
      1,
    )
    eq(
      'X2 紧邻上一行的豁免必须被读到,且归属到声明那一行',
      ex.exempted.some((e) => e.file === 'app/prev.ts' && e.line === 3),
      true,
    )
    eq(
      'X3 标记所在行没有声明 ⇒ 不得凭空造免(一行救不了别处)',
      ex.exempted.filter((e) => e.file === 'app/bare.ts').length,
      0,
    )
    eq(
      'X4 无标记的同类声明必须仍计入(证明 X1/X2 不是"全都免了")',
      ex.decls.filter((d) => d.file === 'app/noneed.ts').length,
      1,
    )
    eq(
      'X5 带原因才算豁免(裸标记不得生效)',
      extractDeclarations(
        new Map([
          [
            'app/x.ts',
            "const API_BASE = 'http://localhost:8802'\nconst q = `${API_BASE}/api/v1/g` // route-declare-exempt:\n",
          ],
        ]),
      ).exempted.length,
      0,
    )
  }

  console.log(fail ? `\n❌ 自检 ${fail}/${ran} 例失败` : `\n全部 ${ran} 例通过(三证据正反 + 两侧前缀拼接正反 + 聚合三态 + 真语料端到端)`)
  process.exit(fail ? 1 : 0)
}

/* §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const a = process.argv.slice(2)
  if (a.includes('--self-test')) selfTest()
  else process.exit(main(a))
}

export const __test__ = {
  // 判据本体在 lib;这里只把自检/镜像要打的符号原名透出(§22c:测试不得复制实现)
  scanApiLiterals,
  deriveBaseNames,
  deriveEgressWrappers,
  classifyWrapper,
  extractDeclarations,
  collectPathTables,
  isTableUsedForEgress,
  isRegistrationLine,
  analyzeTsFile,
  analyzePyFile,
  buildFastifyRegistrations,
  buildFastApiRegistrations,
  normSegs,
  joinPrefix,
  segmentsMatch,
  matchDeclared,
  decide,
  analyze,
  listSourceFiles,
  readSourceFiles,
  formatReport,
  SELF_HOSTS,
  SCAN_DIRS,
  FASTIFY_ENTRY,
  FASTAPI_ENTRY,
  SELF_SKIP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
