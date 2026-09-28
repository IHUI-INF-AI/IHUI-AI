// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 工具名显示覆盖率守门(D54 / H16,2026-09-21 立)。
 *
 * 判据:`apps/ai-service/app/services/mcp_server.py` 的自研工具注册表 `_TOOLS` 里每一个
 * `name="..."` 都必须在 `packages/shared/src/chat/tool-display.ts` 的 `TOOL_DISPLAY_KEYS`
 * 有对应 display key,且该 key 在五语言 `packages/i18n/messages/shared/*.json` 的 `taskStatus`
 * 里都真的有值。三者任一缺失即 exit 1(blocking)。
 *
 * 为什么必须是静态脚本而不是运行时兜底:界面禁止把 `read_file` / `browser_click_element` 这类
 * 英文码名当作用户可见文案。运行时"回落原展示"是必要的兜底,但它同时会让新增工具**静默地**
 * 带着英文码名上线 —— 只有静态比对能拦住这件事。
 *
 * 用法:
 *   node scripts/check-tool-name-display-coverage.mjs            # 全量(默认判 HEAD blob)
 *   node scripts/check-tool-name-display-coverage.mjs --staged   # pre-commit 模式:判索引 blob(提交会带走的那一份)
 *   node scripts/check-tool-name-display-coverage.mjs --worktree # 人工排查(盘上内容,提交链不走这档)
 *   node scripts/check-tool-name-display-coverage.mjs --json     # 机器可读输出(键集与迁移前逐字一致)
 *
 * 取材面(2026-09-27 随"判红行点名文件"一并收口,与守门 56/36/124/93 同口径):判定内容(输入清单、
 * 提取式、阈值、豁免通道)一字未动,只换"字节从哪儿来" —— 旧版按磁盘直读(模块级拼仓库根路径再读盘),
 * 而共享工作树常年被并行会话的半编辑态占据;按磁盘判在"恒红/假绿"之间来回跳(守门 118 正是为此而立,
 * 它把"本次改动动过而仍按磁盘判的门"判红,出路只有走 `scripts/lib/face-reader.mjs`)。
 * 两个面旗同给 = 自相矛盾 ⇒ exit 2;该面取不到 ⇒ **exit 2「无法判定」且不回落**到另一个面
 * (回落就是把"没判"写成"判过了")。
 *
 * 判红行点名(2026-09-27,本票立因):`safe-commit` 的跳门归因铰链
 * (`scripts/lib/commit-gate-attribution.mjs`)第一态是"结论行点名本次声明的文件 ⇒ 本任务自己的红,
 * 拒绝 --no-verify"。旧判红输出只点**符号**(未映射的工具名),铰链结构上看不见文件,
 * 于是自引入的红会被裁成"与本次无关"(2026-09-27 实测发生过一次)。现在每条判红行都以
 * **裸仓根相对路径**点名"该改哪个文件"(`⇒ 违规落点 <rel>`),覆盖率数字与未映射工具名逐字保留。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// "输出被截断 ⇒ 无法判定" 都由层兜住 —— 各门自己写一遍就会各漏一遍(AGENTS §4/守门 118)。
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

/** 判定输入的仓根相对路径(与旧磁盘版逐个同一批文件,只是字节来自被审面而不是磁盘)。 */
const MCP_SERVER_REL = 'apps/ai-service/app/services/mcp_server.py'
const TOOL_DISPLAY_REL = 'packages/shared/src/chat/tool-display.ts'
const sharedLocaleRel = (lang) => `packages/i18n/messages/shared/${lang}.json`
export const INPUT_RELS = [MCP_SERVER_REL, TOOL_DISPLAY_REL, ...LANGS.map(sharedLocaleRel)]
const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不是磁盘"这一格能被构造面证明,
 * 而不是等人跑一次真仓看结论行(与守门 56 的 faceFromArgv 同形)。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

/**
 * 同一面、同一轮一次读完全部 7 个输入;任一必需项取不到即抛 `Undetermined`,**不回落**到另一个面。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场。
 */
export function readFaceInputs(repoRoot, face) {
  const map = new Map()
  if (face === 'worktree') {
    for (const rel of INPUT_RELS) map.set(rel, readWorktreeFile(repoRoot, rel))
  } else {
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    const specs = INPUT_RELS.map((rel) => prefix + rel)
    const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
    for (let i = 0; i < INPUT_RELS.length; i++) map.set(INPUT_RELS[i], got.get(specs[i]) ?? null)
  }
  const lack = INPUT_RELS.filter((r) => map.get(r) === null || map.get(r) === undefined)
  if (lack.length)
    throw new Undetermined(
      `${FACE_TXT[face] ?? face} 取不到必需输入 ${lack.join(' , ')} ⇒ 无法判定(不记为通过)`,
    )
  return map
}

/** 从 mcp_server.py 的 _TOOLS 字面量里提取注册工具名(方括号配平,避开 list[MCPTool] 的假锚点) */
export function extractRegisteredToolNames(pyText) {
  const start = pyText.indexOf('_TOOLS: list[MCPTool] = [')
  if (start === -1) throw new Error('找不到 _TOOLS 注册表锚点(mcp_server.py 结构变更?)')
  const open = pyText.indexOf('= [', start)
  if (open === -1) throw new Error('_TOOLS 锚点后找不到字面量起点')
  let depth = 0
  let end = -1
  for (let i = open + 2; i < pyText.length; i += 1) {
    if (pyText[i] === '[') depth += 1
    else if (pyText[i] === ']') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error('_TOOLS 字面量方括号未配平')
  const block = pyText.slice(start, end + 1)
  return [...new Set([...block.matchAll(/name=["']([a-z0-9_]+)["']/g)].map((m) => m[1]))].sort()
}

/** 从 tool-display.ts 取 工具名 → display key 映射(只认对象字面量里的 `name: 'key',` 行) */
export function extractDisplayKeyMap(tsText) {
  const start = tsText.indexOf('const TOOL_DISPLAY_KEYS')
  if (start === -1) throw new Error('找不到 TOOL_DISPLAY_KEYS')
  const end = tsText.indexOf('\n}', start)
  const block = tsText.slice(start, end === -1 ? tsText.length : end)
  const map = new Map()
  for (const m of block.matchAll(/^\s*([a-z0-9_]+):\s*'([A-Za-z0-9_]+)'/gm)) map.set(m[1], m[2])
  return map
}

async function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const { face, error } = faceFromArgv(argv)
  if (error) {
    console.error(`[tool-name-coverage] ❌ 无法判定:${error}`)
    return 2
  }
  let inputs
  try {
    inputs = readFaceInputs(ROOT, face)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断。
    const known = e instanceof Undetermined
    console.error(
      `[tool-name-coverage] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${
        known ? e.message : (e?.stack ?? e)
      }`,
    )
    return 2
  }
  const pyText = inputs.get(MCP_SERVER_REL)
  const tsText = inputs.get(TOOL_DISPLAY_REL)
  const locales = {}
  for (const lang of LANGS) {
    const parsed = JSON.parse(inputs.get(sharedLocaleRel(lang)))
    locales[lang] = parsed.taskStatus ?? {}
  }

  const names = extractRegisteredToolNames(pyText)
  const map = extractDisplayKeyMap(tsText)
  const unmapped = names.filter((n) => !map.has(n))
  const missingI18n = []
  // 与 missingI18n 同批构建的"按语言分组"投影:判定条目文本逐字相同,只是多带一份 lang→条目 的索引,
  // 供判红行逐条点名"该改哪个文件"(2026-09-27 点名改造;不改任何判定)。
  const missingByLang = new Map()
  for (const name of names) {
    const key = map.get(name)
    if (!key) continue
    for (const lang of LANGS) {
      if (typeof locales[lang][key] !== 'string' || locales[lang][key].trim() === '') {
        const entry = `${lang}.taskStatus.${key} (工具 ${name})`
        missingI18n.push(entry)
        if (!missingByLang.has(lang)) missingByLang.set(lang, [])
        missingByLang.get(lang).push(entry)
      }
    }
  }
  // 反向:词表里有映射但注册表已不存在的工具名不算错(历史工具仍在界面出现于旧消息),只报信息
  const stale = [...map.keys()].filter((n) => !names.includes(n))

  const result = {
    registered: names.length,
    mapped: names.length - unmapped.length,
    unmapped,
    missingI18n,
    staleMapped: stale.length,
    ok: unmapped.length === 0 && missingI18n.length === 0,
  }

  if (json) {
    console.log(JSON.stringify(result))
    process.exit(result.ok ? 0 : 1)
  }
  if (result.ok) {
    console.log(
      `[tool-name-coverage] ✅ ${result.registered}/${names.length} 工具名有本地化功能名,五语言 taskStatus 全有值(词表另含 ${stale.length} 个未注册历史名)`,
    )
    return 0
  }
  console.error(`[tool-name-coverage] ❌ 覆盖率 ${result.mapped}/${result.registered}`)
  if (unmapped.length) {
    // 逐条点名两侧落点:映射表(要补 `name → toolXxx`)与注册表(新增工具名的那一侧)。
    // 路径保持**裸仓根相对 token**(铰链按段边界子串匹配,装饰会把它挡住)。
    console.error(
      `  未映射工具名(${unmapped.length}):${unmapped.join(', ')} ⇒ 违规落点 ${TOOL_DISPLAY_REL} / ${MCP_SERVER_REL}`,
    )
  }
  if (missingI18n.length) {
    console.error(`  缺 i18n 值(${missingI18n.length}):`)
    for (const [lang, entries] of missingByLang) {
      console.error(
        `    ${lang}(${entries.length} 处):${entries.slice(0, 20).join('; ')}` +
          (entries.length > 20 ? ` …另 ${entries.length - 20} 条` : '') +
          ` ⇒ 违规落点 ${sharedLocaleRel(lang)}`,
      )
    }
  }
  console.error(
    '  修法:在 packages/shared/src/chat/tool-display.ts 的 TOOL_DISPLAY_KEYS 补 name → toolXxx,' +
      '并给 packages/i18n/messages/shared/{zh-CN,zh-TW,en,ja,ko}.json 的 taskStatus 补 toolXxx 五语言文案。',
  )
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      if (typeof code === 'number' && code !== 0) process.exit(code)
    })
    .catch((error) => {
      console.error(`❌ ${error?.message ?? error}`)
      process.exit(2)
    })
}
