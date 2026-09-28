#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 凭据前缀一致性守门(2026-09-13 立)。
 *
 * 根因案例(2026-09-13 实修 8 处):IHUI 中转站对外 API 的凭据体系是两个字段——
 *   - `key`    形如 `ihui_` + 24 位 hex,**唯一可当 Bearer 用**的凭据
 *   - `secret` 形如 `sk_`  + 32 位 hex,**只走 `X-Api-Secret` 头**的可选二次校验因子
 * 鉴权实现见 `apps/api/src/plugins/api-key-auth.ts`(Bearer → 查 `developer_api_keys.key`;
 * `X-Api-Secret` → 校验 `secret`)。但 4 个 UI 页面 + 4 份文档把 Bearer 占位符写成
 * `sk-xxx`,用户照抄必然 401 `Invalid or revoked API key`。
 *
 * 规则:面向用户的凭据文案/示例中,`Authorization: Bearer` / `api_key` / `API_KEY`
 * 一律使用 `ihui_` 前缀;`sk_` 只允许出现在描述 `X-Api-Secret` 的语境里。
 *
 * 豁免(不误报):
 *   - 上游厂商自有 key(DeepSeek/OpenAI 等 `sk-...`)——测试夹具、provider smoke 脚本
 *     (`tests/` `__tests__/` `*.test.*` `*.spec.*` 与 `apps/ai-service/scripts/` 均不在扫描面)
 *   - 脱敏展示值 `sk-***`(响应示例里已被掩码,非可复制凭据)
 *
 * 用法(取材面 2026-09-28 收口,与守门 36/70/77/83/93/98/101/103/118 同口径):
 *   node scripts/check-api-credential-prefix.mjs --staged    (pre-commit,判**索引 blob**,有违规则 exit 1)
 *   node scripts/check-api-credential-prefix.mjs             (全量报告,判 **HEAD blob**,有违规 exit 0)
 *   node scripts/check-api-credential-prefix.mjs --worktree  (人工逃生舱:判磁盘,提交链不走这档)
 *   node scripts/check-api-credential-prefix.mjs --self-test (自检规则正则)
 * 退出码:0 = 通过(或全量档只报告)/ 1 = 暂存档发现违规 / 2 = 无法判定(两面旗同给、ROOT 不是仓库根、
 * 被审面取不到正文、全量面枚举到 0 个候选)。
 *
 * 只换取材来源,**六条规则、行级豁免(LINE_ALLOW/SUPPRESS/BYOK)、inScope/isExcluded 判据、
 * "暂存档才判红"的退出码含义,一项都没动**。换掉的是三处:
 *   ① 全量档 `readdirSync` 磁盘枚举 + `readFileSync` 取正文 —— 共享工作树常年滞后 HEAD,同一份 HEAD
 *      代码会在"恒红"与"假绿"之间来回跳;
 *   ② 暂存档**清单来自索引而正文来自磁盘**(自洽却错位的尺子:本次提交带走的是索引那一份);
 *   ③ `ROOT = process.cwd()` 落在仓库子目录时,`ls-tree`/`ls-files` 回的是**前缀相对路径**,inScope
 *      一条都匹配不上 ⇒ 旧形态在此刻打"✅ 凭据前缀一致(0 个文件)"= 把"根本没扫"洗成通过。
 *      现由 `assertRepoRoot` 判死(2 = 无法判定)。
 * 一条如实登记的口径边界:**暂存档枚举到 0 个射程内文件不判死** —— `scripts/lib/pre-commit-hook.js`
 * 对每次提交都调本门 `--staged`(无暂存路径触发条件),一次只改代码的提交结构上不会暂存 docs/README,
 * 判死等于替每一次无关提交挡路,而恒挡的唯一结局是各会话走应急跳门、连带全部守门作废(§12e 同型)。
 * 覆盖面差值也说清(数字按当次实测取,别照本行派单):旧磁盘遍历比三面多出来的那批候选**全部是
 * gitignore 的第三方构建产物** —— `.gitignore:12` 的 `apps/web/public/vs/**`(Monaco bundle)与
 * `:15` 的 `apps/web/public/downloads/manifest.json`。它们既不在 HEAD 也不在索引,按定义不属于任何
 * 被审面(与守门 118 对"只存在于部署机的 gitignore 副本"的同一处置)。所以磁盘面是"跟踪 ⊕ 未跟踪
 * 非忽略",而不是"盘上所有后缀匹配的文件" —— 这一格是写明在案的忽略项,不是暗减。
 * 枚举(ls-tree / diff --cached --name-only / ls-files)都不产正文,不算散写读内容;正文一律经
 * `scripts/lib/face-reader.mjs` 的读取入口(`catBatch` / `readWorktreeFile`)。
 */
import { pathToFileURL } from 'node:url'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const isSelfTest = argv.includes('--self-test')
const GIT_TIMEOUT = 120000

/** 扫描面:面向用户暴露凭据文案的目录/文件(相对 ROOT)。 */
const SCAN_ROOTS = [
  'apps/web',
  'docs',
  'packages/sdk',
  'apps/cli/README.md',
  'README.md',
  'README.en.md',
  'README.ja.md',
  'README.ko.md',
]
const SCAN_EXTS = ['.md', '.ts', '.tsx', '.js', '.jsx', '.vue', '.json']
const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.next',
  'out',
  'coverage',
  'tests',
  '__tests__',
  'test',
  'e2e',
  '.ihui-agent',
  '.git',
  '.workbuddy',
  '.husky',
])

/**
 * 违规规则。每条 = { id, re, why, suggest }。
 * 全部为「把 secret 当 Bearer / 把不存在的 sk- 前缀当产品凭据」的写法。
 */
const RULES = [
  {
    id: 'bearer-sk',
    // Bearer 后跟 sk- 或 sk_(我们的 secret 前缀),无论出现在示例还是文案里都是错的
    re: /Bearer\s+sk[-_]/i,
    why: 'Bearer 必须用公开标识 `ihui_xxx`,不能用 `sk_`(secret 只走 X-Api-Secret)',
  },
  {
    id: 'placeholder-sk',
    re: /sk-your-api-key/i,
    why: '占位符 `sk-your-api-key` 会让用户照抄成不可用的 Bearer,应为 `ihui_xxx`',
  },
  {
    id: 'mixed-prefix',
    re: /ihui_sk_/i,
    why: '`ihui_sk_` 是混合前缀(不存在),应为 `ihui_`',
  },
  {
    id: 'apikey-sk-ihui',
    // 明确的本公司凭据标记:sk-ihui-xxxxx(不存在的混合前缀)
    re: /api[-_]?key["']?\s*[:=]\s*["']sk-ihui/i,
    why: '公司凭据不能写成 `sk-ihui-xxx`,应为 `ihui_xxx`(secret 是 `X-Api-Secret` 专用)',
  },
  {
    id: 'apikey-sk-placeholder',
    // 通用占位符 sk-xxx 出现在 apiKey 赋值处(上游厂商 key 形如 sk-ant-/sk-step-/sk-... 不命中)
    // BYOK 语境豁免:紧邻上文出现 provider 字段 / CreateUserModel / create_user_model 时,
    // 该 apiKey 指的是「用户自有的上游厂商 key」,`sk-xxx` 是正确写法(见 contextIsByok)。
    re: /api[-_]?key["']?\s*[:=]\s*["']sk-xxx["']/i,
    contextIsByok: true,
    why: '`apiKey` 字段承载的 Bearer 凭据应为 `ihui_xxx`(secret 是 `X-Api-Secret` 专用)',
  },
  {
    id: 'env-sk',
    re: /IHUI_API_KEY\s*[:=]\s*["']?sk[-_]/i,
    why: '`IHUI_API_KEY` 应为 `ihui_xxx`(或 JWT 访问令牌),不能是 `sk_`',
  },
]

/** 允许出现的正则(行级豁免)——脱敏展示值。 */
const LINE_ALLOW = [/sk-\*{2,}/, /\bsk-\*\*\*/, /X-Api-Secret/i]

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不再判磁盘"这一格能被构造面证明,
 * 而不是等人跑一次真仓看结论行 —— 结论行会被人改,函数不会。
 */
export function faceFromArgv(list) {
  return selectFace({
    staged: list.includes('--staged'),
    worktree: list.includes('--worktree'),
    def: 'head',
  })
}

/**
 * 枚举走**被审面的清单出口**:head→ls-tree、staged→diff --cached --name-only、worktree→ls-files
 * ⊕ 未跟踪(`--others --exclude-standard`,与旧 `walk()` 磁盘遍历的覆盖面同形)。
 * 暂存档带 `--diff-filter=ACMR` ⇒ 索引里的删除不在清单上,所以"清单有而正文取不到"只可能是取材失败
 * 或未合并冲突态,那一格由调用方判"无法判定",不静默跳过。(旧实现是 `--diff-filter=ACM`:改名条目
 * 不进面 ⇒ 一次"重命名 + 顺手改内容"的暂存会整条躲过本门。ACMR 是**收紧**,不是放宽判据。)
 */
export function listFacePaths(root, face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  return [
    ...new Set([
      ...gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean),
      // 磁盘面 = 跟踪 ⊕ 未跟踪(旧 `readdirSync` 磁盘遍历看得见未跟踪文件;只列跟踪面会把那一族
      // 覆盖丢掉 ⇒ 收口变成缩小扫描面)。逃生舱仍必须是"盘上那棵树"。
      ...gitRaw(['ls-files', '--others', '--exclude-standard', '-z'], root, {
        timeout: GIT_TIMEOUT,
      })
        .split('\0')
        .filter(Boolean),
    ]),
  ]
}

/** 清单与内容**同面同轮**:一次 `cat-file --batch` 读满整批正文;取不到 ⇒ null(调用方判"无法判定")。 */
export function readFaceContents(root, paths, face) {
  const map = new Map()
  if (paths.length === 0) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = paths.map((p) => prefix + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  paths.forEach((p, i) => map.set(p, got.get(specs[i]) ?? null))
  return map
}

/** 该文件是否属于扫描面。 */
function inScope(file) {
  return SCAN_ROOTS.some((r) => (r.endsWith('.md') ? file === r : file.startsWith(`${r}/`)))
}

/** 该文件是否命中排除目录。 */
function isExcluded(file) {
  return file.split('/').some((seg) => EXCLUDE_DIR_NAMES.has(seg) || isExcludedDirName(seg))
}

/** 与旧 `walk()` / `listStagedFiles()` 出口同形的选取判据(扩展名 + 扫描面 + 排除段)。 */
export function selectCandidate(file) {
  return SCAN_EXTS.some((e) => file.endsWith(e)) && inScope(file) && !isExcluded(file)
}

const SUPPRESS = /check-api-credential-prefix-disable-next-line|api-credential-prefix-ignore/i

/** BYOK 语境标记:该处 apiKey 指的是用户自有的上游厂商 key,而非平台凭据。 */
const BYOK_CONTEXT = /["']?provider["']?\s*[:=]|create_user_model|CreateUserModel/

/**
 * 扫描单个文件,返回 findings。
 * ⚠️ 正文由调用方**按判定面**取好再传进来(旧形态在这里 `readFileSync(join(ROOT, file))`,
 * 于是"清单来自索引、内容来自磁盘"—— 本门只换取材来源,下面的六条规则与三档豁免一行都没动)。
 * `text` 不是字符串 ⇒ 交给调用方判"无法判定",这里绝不返回 `[]`(空数组会被读成"扫过且干净")。
 */
export function scanFile(file, text) {
  // 契约:正文必须是调用方从**判定面**取到的字符串。传进来不是字符串 ⇒ 抛,而不是 `return []` ——
  // 旧实现在这里 `readFileSync` 失败就返回空数组,把"读不到"洗成"扫过且干净"(守门 118 要防的那一型)。
  if (typeof text !== 'string')
    throw new TypeError(
      `scanFile(${file}) 需要由调用方按判定面取好的字符串正文,实得 ${typeof text}`,
    )
  const findings = []
  const lines = String(text).split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (LINE_ALLOW.some((re) => re.test(line))) continue
    if (SUPPRESS.test(line)) continue
    for (const rule of RULES) {
      if (!rule.re.test(line)) continue
      // BYOK 语境豁免:向上回看 4 行,若出现 provider 字段/用户自定义模型 API,则跳过
      if (rule.contextIsByok) {
        const from = Math.max(0, i - 4)
        const ctx = lines.slice(from, i + 1).join('\n')
        if (BYOK_CONTEXT.test(ctx)) continue
      }
      findings.push({ file, line: i + 1, rule: rule.id, why: rule.why, text: line.trim() })
      break
    }
  }
  return findings
}

function selfTest() {
  const cases = [
    ['-H "Authorization: Bearer sk-xxx"', true],
    ['-H "Authorization: Bearer sk_abc"', true],
    ['Authorization: Bearer ihui_xxx', false],
    ['X-Api-Secret: sk_xxx', false],
    ['"apiKey": "sk-xxx"', true],
    ['APIKey:   "sk-xxx",', true],
    ['client = IHUIClient(api_key="sk-ihui-...")', true],
    ['api_key="sk-ihui-xxxxx",', true],
    ['"apiKey": "sk-***"', false],
    ['"openai": {"api_key": "sk-...", "api_base": "https://api.openai.com/v1"},', false],
    ['"anthropic":  {"api_key": "sk-ant-..."},', false],
    ['openaiApiKey: "sk-...",', false],
    ['"stepfun":    {"api_key": "sk-step-..."},', false],
    ['apiKey: "ihui_xxx"', false],
    ['IHUI_API_KEY="sk-your-api-key"', true],
    ['IHUI_API_KEY="ihui_your_api_key"', false],
    ['export IHUI_API_KEY="eyJhbGciOi..."', false],
    ['sk-your-api-key', true],
    ['ihui_sk_xxxx', true],
    ['Bearer eyJhbGciOiJIUzI1NiJ9', false],
  ]
  let bad = 0
  for (const [line, expect] of cases) {
    if (LINE_ALLOW.some((re) => re.test(line))) {
      if (expect) {
        console.error(`${C.red}✗ 自检失败(被豁免掉但期望命中):${line}`)
        bad++
      }
      continue
    }
    const hit = RULES.some((r) => r.re.test(line))
    if (hit !== expect) {
      console.error(`${C.red}✗ 自检失败:${line} → 命中=${hit} 期望=${expect}`)
      bad++
    }
  }
  if (bad === 0) console.log(`${C.green}✅ 规则自检通过(${cases.length} 条)`)
  else console.error(`${C.red}❌ 规则自检失败 ${bad} 条`)
  return bad === 0
}

/**
 * 结论 → 退出码,判据语义与旧版逐字同形:
 *  - **只有暂存档判红**(`return isStaged ? 1 : 0`),全量/磁盘面是报告档 ⇒ 0;
 *  - 新增的只有"无法判定"这一档:被审面取不到正文 ⇒ 2(不静默跳过,不回落另一个面)、
 *    全量面/磁盘面枚举到 0 个候选 ⇒ 2(空转不是通过)、暂存档零候选 ⇒ 0(见头注那条口径边界)。
 */
export function decideExit({ face, files, unreadable, findings }) {
  if (unreadable.length > 0) return 2
  if (files.length === 0 && face !== 'staged') return 2
  if (findings.length === 0) return 0
  return face === 'staged' ? 1 : 0
}

/**
 * 一次审计(root/face 都是入参:镜像与自检因此能在临时 git 仓里造"索引≠磁盘"的现场,
 * 不依赖真仓瞬时状态)。取材面不是仓库根 ⇒ assertRepoRoot 抛,由调用方折成 2。
 */
export function runGate(root, face) {
  assertRepoRoot(root, 'credential-prefix 的 ROOT')
  const files = listFacePaths(root, face).filter(selectCandidate)
  const contents = readFaceContents(root, files, face)
  // 磁盘面的 null = 盘上没有这一份(跟踪清单里有而工作树里没落盘,§5b 清理层形态),那不属于"这一面
  // 读错了",只点名不判死 —— 否则人工逃生舱恰在最需要它的时刻不可用。全量/暂存档的 null 才是
  // "面上有而正文取不到" ⇒ 判死,不静默跳过(旧 `scanFile` 在这里 `return []`,把读不到洗成扫过且干净)。
  const missing =
    face === 'worktree' ? files.filter((f) => typeof contents.get(f) !== 'string') : []
  const unreadable =
    face === 'worktree' ? [] : files.filter((f) => typeof contents.get(f) !== 'string')
  const findings = files
    .filter((f) => typeof contents.get(f) === 'string')
    .flatMap((f) => scanFile(f, contents.get(f)))
  return {
    face,
    files,
    unreadable,
    missing,
    findings,
    exit: decideExit({ face, files, unreadable, findings }),
  }
}

function main() {
  if (isSelfTest) return selfTest() ? 0 : 1
  const sel = faceFromArgv(argv)
  if (sel.error) {
    console.error(`${C.red}❌ 无法判定:${sel.error}`)
    return 2
  }
  let out
  try {
    out = runGate(ROOT, sel.face)
  } catch (e) {
    const known = e instanceof Undetermined
    console.error(
      `${C.red}❌ 无法判定(${sel.face} 面)⇒ 不记为通过:${
        known ? e.message : `${e?.message ?? e}\n${e?.stack ?? ''}`
      }`,
    )
    return 2
  }
  if (out.unreadable.length > 0) {
    console.error(
      `${C.red}❌ 无法判定:${out.face} 面取不到 ${out.unreadable.length} 个候选正文 —— ${out.unreadable
        .slice(0, 5)
        .join(', ')}(不静默跳过,也不回落另一个面)`,
    )
    return 2
  }
  if (out.files.length === 0 && out.face !== 'staged') {
    console.error(`${C.red}❌ 无法判定:${out.face} 面枚举到 0 个射程内候选 ⇒ 尺子空转不是通过`)
    return 2
  }

  if (out.missing?.length) {
    console.error(
      `${C.yellow}⚠️ 磁盘面有 ${out.missing.length} 个跟踪路径盘上没有(§5b 清理层形态,不属于本面判定对象):${out.missing
        .slice(0, 5)
        .join(', ')}`,
    )
  }

  const findings = out.findings
  if (findings.length === 0) {
    const scope =
      out.face === 'staged' ? `${out.files.length} 个已暂存文件` : `${out.files.length} 个文件`
    console.log(`${C.green}✅ 凭据前缀一致(${scope},取材面:${out.face})`)
    return 0
  }

  console.error(`${C.red}❌ 发现 ${findings.length} 处凭据前缀误用(取材面:${out.face}):`)
  for (const f of findings) {
    console.error(`   ${f.file}:${f.line}  [${f.rule}]  ${f.text}`)
    console.error(`      → ${f.why}`)
  }
  console.error('')
  console.error('   统一口径:`Authorization: Bearer ihui_xxx`;`sk_xxx` 仅用于 `X-Api-Secret`。')
  console.error('   权威说明:docs/developer/getting-started/authentication.md')
  return out.exit
}

/** §22d 双形态入口守护:测试 import 不触发 CLI 副作用(旧版是顶层裸 `process.exit(main())`,
 *  任何 import 都会在 setup 阶段就把整条 CLI 跑一遍并按结论退出 —— 镜像测试因此无法成立)。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = {
  RULES,
  LINE_ALLOW,
  SUPPRESS,
  BYOK_CONTEXT,
  SCAN_ROOTS,
  SCAN_EXTS,
  inScope,
  isExcluded,
  selectCandidate,
  scanFile,
  faceFromArgv,
  listFacePaths,
  readFaceContents,
  runGate,
  decideExit,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
