#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:对外文档数字对账(README / README.en.md / 仓库简介里的数字必须等于现算值)
 *
 * 在修什么(2026-09-27 外部审计点名):
 *   文档里的数字此前**各处手抄**,同一件事有三种说法 —— 仓库简介写「340 tables」、README 写
 *   「542 张表」,而 schema 源码现读是 583 个 `pgTable` 声明;简介写「176 LLMs」,而仓内唯一
 *   入库的模型清单(default_models.json)是 118 条。数字没有主键,抄一次就多一份真相。
 *   唯一算法住在 `scripts/gen-doc-numbers.mjs`,本门只判**文档有没有照它写**。
 *
 * 三条判据(互不重叠,各有正反用例):
 *   DN1 生成块齐备性 —— README.md 必须有 `BLOCK_BEGIN…BLOCK_END` 的派生块,块内每个取数键的
 *       数值必须与现算值逐字相等;块不在 = 没有对账对象 ⇒ 红并给出生成命令。
 *   DN2 散文里的同一数字 —— 块**外**凡是命中某指标措辞的数字,必须等于现算值。这条才是门牙:
 *       光有生成块,别人照样能在正文里写一个旧数("542 张表"就是这么活的)。
 *       措辞表是**封闭集**(CLAIMS),刻意不做相似度匹配 —— 认不准的宁可判"未判定"也不猜。
 *   DN3 简介面(可选输入)—— `--description <文件或 ->` 提供 GitHub repo description 时逐条判;
 *       没给输入 ⇒ 计「未判定」并点名(默认不影响退出码,`--strict` 下影响)。
 *       为什么刻意不做成默认必判:提交链里调 `gh api` = 每台每次联网,离线即恒红 ⇒ 逼人
 *       `--no-verify` 连带废掉全部守门(AGENTS §12e 同型)。
 *
 * 判责时机(DN4,本门的防恒红设计):块里多数数字(`trackedFiles`/`apiRoutes`/`testFiles`…)随
 *   **每一次**普通提交漂移,若任何提交都必须同步重算块,本门就在与提交内容无关处恒红 —— 唯一
 *   结局是各会话合法 `--no-verify`,连带废掉全部守门(§12e)。所以注册条目带
 *   `stagedTriggers: ['README.md', 'README.en.md']`,而门体自身再收一道(纵深防御,防手工直跑):
 *   `--staged`/全量档先问"被审文档本轮是否被改动"(`touchedAuditedDocs`),未改动 ⇒ 漂移只报数
 *   exit 0;改动了 ⇒ 块与散文全判。`--strict`(问责档,`pnpm check:doc-numbers` 走这档)与
 *   `--worktree`(人工面)⇒ 无条件全判。
 *
 * 取材口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工、两面旗同给 ⇒ exit 2;内容经 `scripts/lib/face-reader.mjs` 的 `catBatch`,
 * 清单与内容同面同轮;取不到 ⇒ exit 2「无法判定」,**不冒红也不记绿**;
 * 一条候选都枚举不到 ⇒ 判死(尺子失效不是通过)。
 *
 * 无基线文件:期望值每次现算,把当前读数冻成基线等于给腐烂发通行证。
 *
 * 手动:
 *   node scripts/check-doc-numbers.mjs              # 全量(HEAD)
 *   node scripts/check-doc-numbers.mjs --staged     # 提交链
 *   node scripts/check-doc-numbers.mjs --strict --description -   # 连简介一起问责
 *   node scripts/check-doc-numbers.mjs --self-test
 * 紧急跳过:HUSKY_SKIP_DOC_NUMBERS=1
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { BLOCK_BEGIN, BLOCK_END, ORDER, collectNumbers, specOf } from './gen-doc-numbers.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_DOC_NUMBERS'
/** 带对外数字、必须被审的文档(新增一份就加一行,别在别处再抄清单) */
export const AUDITED_DOCS = ['README.md', 'README.en.md']

/**
 * DN2 的措辞表:**封闭集**,每条都带 `pick` 从捕获组里挑那个数字。
 *
 * 为什么不写宽一点:本仓正文里"相邻但不同义"的写法极多,第一版把措辞放宽后在真 README 上
 * 命中 108 处、其中约四分之一是假阳(`45 张表` 是某个子 schema、`719`… 之外还有
 * `24+7 LLM provider` 被读成模型数、`5,4393` 被逗号粘连读成 54393)。**假阳比漏报贵**:
 * 它指使人去"修"没坏的东西,还把判据口径说歪成"数字很多",最终结局是逼人 `--no-verify`
 * 连带废掉全部守门(AGENTS §12e)。所以三条收窄手段同时用:
 *   ① 数字两侧禁止再粘数字/逗号(`(?<![\d,])…(?![\d,])`),堵掉粘连读法;
 *   ② 只有**带单位量词**或**指标专属词紧邻**的形态才算声明,漏了不算红(宁漏不误报);
 *   ③ 位数下限:表数 / 路由数 / 测试文件数这类"总量级"指标只认 ≥3 位数字,
 *      于是"45 张表(某个子 schema)""每域平均 18 张表"不会被当成总量声明。
 *   ④ 千位逗号分组必须归一(2026-10-10 G-1117442)——写法只许 `NUM()` 一份。
 */

/**
 * 数字捕获片段的**唯一**构造器。
 *
 * 立它的理由不是"复用好看",是旧写法**从来没匹配成功过**:千位分组的首段只有 1-3 位,
 * 而旧片段写成 `\d{2,6}(?:,\d{3})*` —— 首段要求 ≥2 位,于是 "4,415 API routes" 这一支
 * 永不成立(实测 `checked=0`);更糟的是自检把"违规数=0"当成"归一生效"的证据,而 0 违规
 * 与"根本没看见"在文本上同形 ⇒ 一条恒真断言替一台瞎掉的尺子发合格证。
 *
 * 两条并列,顺序无关:
 *   · `\d{min,max}` —— 原样保留位数下限,所以 1 位数仍然不会被当成总量声明(零假阳扩面);
 *   · `\d{1,3}(?:,\d{3})+` —— **至少一个**逗号组才走这一支,没有分组文字的位数判据不受影响。
 */
export function NUM(min, max) {
  return `(?:\\d{${min},${max}}|\\d{1,3}(?:,\\d{3})+)`
}

export const CLAIMS = [
  {
    key: 'dbTables',
    label: '数据库表数',
    re: new RegExp(`(?<![\\d,])(${NUM(3, 6)})(?![\\d,])\\s*(?:张(?:数据库)?表|个数据库表|数据库表|tables?\\b)`, 'gi'),
    pick: (m) => m[1],
    sample: '<N> 张表',
    probe: '583',
  },
  {
    key: 'apiRoutes',
    label: 'API 路由数',
    // 中文那一支**必须带 API 前缀**:"879 条路由"(ai-service 内部计数)、"288 路由文件"都不是总量声明,
    // 放宽到裸"路由"就把子量级读成总量(实测抓到两型假阳)。
    // 英文那一支以前缺逗号分组归一 ⇒ README.en.md 的 "4,415 API routes" 整型隐身(G-1117442);
    // 两支现在共用 NUM(),位数下限与假阳护栏逐字不变。
    re: new RegExp(
      `(?<![\\d,])(${NUM(2, 6)})(?![\\d,])\\s*(?:条\\s*)?API\\s*路由(?!文件)|(?<![\\d,])(${NUM(2, 6)})(?![\\d,])\\s*(?:API\\s)?routes?\\b(?! files?)`,
      'gi',
    ),
    pick: (m) => m[1] ?? m[2],
    sample: '<N> API 路由',
    probe: '4363',
  },
  {
    key: 'aiServiceRoutes',
    label: 'AI 服务路由数',
    re: new RegExp(`(?<![\\d,])(${NUM(2, 6)})(?![\\d,])\\s*(?:条\\s*)?(?:FastAPI|AI-?Service|ai-service)\\s*(?:路由|routes?\\b)`, 'gi'),
    pick: (m) => m[1],
    sample: '<N> FastAPI 路由',
    probe: '548',
  },
  {
    key: 'wsEndpoints',
    label: 'WebSocket 端点数',
    re: /(?<![\d,])(\d{1,4})(?![\d,])\s*(?:个|条)?\s*(?:WebSocket|WS)\s*(?:端点|通道)|(?:WebSocket|WS)\s*(?:端点|通道)\s*[（(]?\s*(\d{1,4})/gi,
    pick: (m) => m[1] ?? m[2],
    sample: '<N> 个 WebSocket 端点',
    probe: '25',
  },
  {
    key: 'llmModels',
    label: '模型数',
    re: /(?<![\d,])(\d{2,5})(?![\d,])\s*(?:个|种)?\s*(?:大模型|模型清单|入库模型)|(?<![\d,])(\d{2,5})(?![\d,])\s*(?:catalogued LLMs?|LLMs)\b/gi,
    pick: (m) => m[1] ?? m[2],
    sample: '<N> 大模型',
    probe: '118',
  },
  {
    key: 'publishPlatforms',
    label: '发布平台数',
    // 英文分支("14-Platform Auto-Publishing"这类)2026-09-28 补:en README 一直用这个措辞
    // 做头图声称,旧判据只认中文"平台发布",于是 14 与现算 38 的偏差结构上看不见。
    re:
      /(?<![\d,])(\d{1,3})(?![\d,])\s*(?:个)?\s*(?:大)?发布平台|(?<![\d,])(\d{1,3})(?![\d,])\s*(?:个)?\s*平台(?:自动)?发布|(?<![\d,])(\d{1,3})[- ]platforms? auto-publishing|(?<![\d,])(\d{1,3})[- ]platforms? publishing/gi,
    pick: (m) => m[1] ?? m[2] ?? m[3] ?? m[4],
    sample: '<N> 平台自动发布',
    probe: '38',
  },
  {
    key: 'testFiles',
    label: '测试文件数',
    re: new RegExp(`(?<![\\d,])(${NUM(3, 6)})(?![\\d,])\\s*(?:个)?\\s*测试文件`, 'gi'),
    pick: (m) => m[1],
    sample: '<N> 测试文件',
    probe: '2104',
  },
  {
    key: 'i18nLanguages',
    label: '语言数',
    re: /(?<![\d,])(\d{1,2})(?![\d,])\s*(?:种)?\s*语言\s*(?:i18n|parity|locale|消息包)/gi,
    pick: (m) => m[1],
    sample: '<N> 语言 i18n',
    probe: '5',
  },
  {
    key: 'ciWorkflows',
    label: 'CI 工作流数',
    // "CI" 必须紧邻:否则 "GitHub Actions(build / ci / e2e / knip 4 workflow)" 这种
    // 列举具体文件的写法会被读成"总量声明"(S15 假阳护栏实测抓到)。
    re: /(?<![\d,])(\d{1,3})(?![\d,])\s*(?:个)?\s*CI\s*workflows?\b|(?<![\d,])(\d{1,3})(?![\d,])\s*(?:个)?\s*workflows?\.ya?ml\b|workflows?\s*[（(]\s*(\d{1,3})\s*(?:个)?\s*(?:yml|文件)/gi,
    pick: (m) => m[1] ?? m[2] ?? m[3],
    sample: '<N> CI workflows',
    probe: '46',
  },
  {
    key: 'guardianGates',
    label: '守门数',
    re: /(?<![\d,])(\d{3,4})(?![\d,])\s*(?:道|个|项)\s*(?:工程)?守门(?!期)|(?<![\d,])(\d{3,4})(?![\d,])\s*(?:工程)?守门(?:脚本|闸)/gi,
    pick: (m) => m[1] ?? m[2],
    sample: '<N> 道工程守门',
    probe: '188',
  },
  {
    key: 'appPackages',
    label: 'app 工作区包数',
    re: /(?<![\d,])(\d{1,3})(?![\d,])\s*(?:个)?\s*(?:workspace\s*)?app\s*(?:packages?\b|工作区包)/gi,
    pick: (m) => m[1],
    sample: '<N> app packages',
    probe: '9',
  },
]

/** 归一化 `4,393` / `4393` 两种写法为数字。 */
export function toInt(text) {
  const n = Number(String(text).replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/**
 * DN2:找出块外所有命中措辞的数字并判等。纯函数 ⇒ 构造面可证,不依赖仓库瞬时状态。
 * @returns {{violations:{key:string,found:number,want:number,line:number,excerpt:string}[],checked:number,unmappable:{line:number,excerpt:string}[]}}
 */
export function findStaleClaims(text, numbers, { blockBegin = BLOCK_BEGIN, blockEnd = BLOCK_END } = {}) {
  const lines = text.split(/\r?\n/)
  // 先把生成块整段挖掉(用等长空行占位,行号不得漂移 —— 本门按行报点)
  const masked = [...lines]
  let open = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (open < 0 && lines[i].includes(blockBegin)) open = i
    else if (open >= 0 && lines[i].includes(blockEnd)) {
      for (let k = open; k <= i; k += 1) masked[k] = ''
      open = -1
    }
  }
  const dangling = open >= 0
  const violations = []
  let checked = 0
  for (let i = 0; i < masked.length; i += 1) {
    const line = masked[i]
    if (!line) continue
    // 行内出口 `doc-num-exempt: <原因>` —— 只救本行,且**必须带原因**(裸标记不算豁免,
    // 与守门 102/108 同一条锁)。用在"这个数字是叙述性引用、不是当前总量声明"的场合,
    // 例如记录历史事故的"当年约 110 道守门对全队同时失效"—— 它讲的是过去某个时点的量。
    if (/doc-num-exempt:\s*\S/.test(line)) continue
    for (const claim of CLAIMS) {
      claim.re.lastIndex = 0
      let m
      while ((m = claim.re.exec(line))) {
        const digits = claim.pick(m)
        if (digits === undefined) continue // 该措辞这一支不带数 ⇒ 只当触发器不计数
        const found = toInt(digits)
        const want = numbers[claim.key]
        if (!Number.isFinite(found) || !Number.isFinite(want)) continue
        checked += 1
        if (found !== want) {
          violations.push({
            key: claim.key,
            found,
            want,
            line: i + 1,
            excerpt: line.trim().slice(0, 120),
          })
        }
      }
    }
  }
  return { violations, checked, danglingBlock: dangling }
}

/**
 * DN1:README 的派生块必须存在且逐键等值。
 * `checked` 也计入本门的"候选数"—— 一个只写生成块、正文不再重复数字的 README 是**合规**的,
 * 若候选只从散文里数,它会被 `decide` 判成"尺子失明"(exit 2),那是把合规当成故障。
 * @returns {{ok:boolean, problems:string[], checked:number}}
 */
export function checkGeneratedBlock(text, numbers) {
  const problems = []
  const b = text.indexOf(BLOCK_BEGIN)
  const e = text.indexOf(BLOCK_END)
  if (b < 0 || e < 0 || e < b) {
    problems.push(`缺生成块(或块结束标记在开始标记之前):跑 \`node scripts/gen-doc-numbers.mjs --markdown\` 生成后粘进 README`)
    return { ok: false, problems, checked: 0 }
  }
  const block = text.slice(b, e)
  let checked = 0
  for (const key of ORDER) {
    if (!Number.isFinite(numbers[key])) continue
    const row = new RegExp(`\\|\\s*[^|]*\\|\\s*([\\d,]+)\\s*\\|\\s*\`${key}\`\\s*\\|`).exec(block)
    if (!row) {
      problems.push(`生成块里没有 \`${key}\` 这一行 ⇒ 该数字无人对账`)
      continue
    }
    checked += 1
    const got = toInt(row[1])
    if (got !== numbers[key]) problems.push(`生成块 \`${key}\` = ${got},现算 ${numbers[key]}`)
  }
  return { ok: problems.length === 0, problems, checked }
}

/** DN3:仓库简介里出现的数字与现算值逐条判等。纯函数。 */
export function checkDescription(text, numbers) {
  const problems = []
  let checked = 0
  for (const claim of CLAIMS) {
    claim.re.lastIndex = 0
    let m
    while ((m = claim.re.exec(text))) {
      const digits = claim.pick(m)
      if (digits === undefined) continue
      const found = toInt(digits)
      const want = numbers[claim.key]
      if (!Number.isFinite(found) || !Number.isFinite(want)) continue
      checked += 1
      if (found !== want) problems.push(`简介 \`${claim.key}\` = ${found},现算 ${want}`)
    }
  }
  return { problems, checked }
}

/**
 * 被审文档在"本轮判定"里是否真的被改动(只列路径,不读内容 —— 与 `cat-file` 不同,这是枚举)。
 *   staged:索引 vs HEAD(`git diff --cached`);HEAD 取不到(仓库无提交)⇒ 全算被触及。
 *   head   :HEAD vs HEAD^(merge 比第一父即可);HEAD^ 取不到(根提交)⇒ 全算被触及。
 * git 以 status 1 说"没有这个对象"是答案;其余非零 ⇒ 抛 Undetermined(无法判定,不猜)。
 */
export function touchedAuditedDocs(root, face) {
  const q = (args) =>
    gitRaw(args, root, { timeout: 60000 })
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
  try {
    if (face === 'staged') return q(['diff', '--cached', '--name-only', 'HEAD', '--', ...AUDITED_DOCS])
    gitRaw(['rev-parse', '--verify', 'HEAD^'], root, { timeout: 60000 })
    return q(['diff', '--name-only', 'HEAD^', 'HEAD', '--', ...AUDITED_DOCS])
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return [...AUDITED_DOCS] // 无 HEAD / 无父提交 ⇒ 本轮全部问责
    throw e
  }
}

/**
 * 本轮问责规划(纯函数,构造面可证)。
 * 立此收窄的理由(§12e/§16f 同型):块里多数数字(`trackedFiles`/`testFiles`/`apiRoutes`…)随
 * **每一次**普通提交漂移,若任何提交都必须带上重算块,门就在与提交内容无关处恒红 ⇒ 各会话
 * 合法 `--no-verify` ⇒ 该提交的全部守门作废。所以判责时机 = "谁改被审文档,当场对账":
 *   · 提交链(runner 下发 `--staged` + 注册条目 `stagedTriggers=README*`)⇒ 未触及被审文档 ⇒ 漂移只报数;
 *   · 改 README 的那枚 ⇒ 全量判等(块与散文一起);
 *   · `--strict`(问责档)与 `--worktree`(人工面)⇒ 无条件全判。
 */
export function planAccountability({ face, touched, strict }) {
  if (face === 'worktree') return { enforce: true, why: '人工面(worktree)⇒ 全判' }
  if (strict) return { enforce: true, why: '--strict 问责档 ⇒ 全判(未触及也要求合格证)' }
  if (!touched || touched.length === 0)
    return { enforce: false, why: '本轮未触及被审文档 ⇒ 不问责,漂移只报数(改 README 那枚必须重跑生成块)' }
  return { enforce: true, why: `本轮改动被审文档(${touched.join(', ')})⇒ 全判` }
}

/**
 * 退出码决策(纯函数,三态绝不并桶):
 *   red      ⇒ 1  (判据命中:数字对不上 / 生成块缺失或过期 / 未判定的**内容**问题)
 *   undetermined(strict 时也算红)⇒ 2(无法判定,不出具合格证)
 *   其余 ⇒ 0
 */
export function decide({ violations, blockProblems, descProblems, undetermined, strict, candidates, scopeApplicable = true }) {
  if (!scopeApplicable) return { code: 0, why: '本轮未触及被审文档 ⇒ 不问责(漂移只报数)' }
  if (candidates === 0)
    return { code: 2, why: '一条候选都没枚举到 ⇒ 判据失明,不记为通过(检查被审文档清单与取材面)' }
  if (violations.length > 0 || blockProblems.length > 0 || descProblems.length > 0)
    return { code: 1, why: '数字对不上 / 生成块不齐备' }
  if (strict && undetermined.length > 0)
    return { code: 2, why: `--strict:${undetermined.length} 项未判定 ⇒ 拒绝出具合格证` }
  return { code: 0, why: '一致' }
}

function readArg(argv, name) {
  const i = argv.findIndex((a) => a === name || a.startsWith(`${name}=`))
  if (i < 0) return null
  return argv[i].includes('=') ? argv[i].slice(i === -1 ? 0 : argv[i].indexOf('=') + 1) : argv[i + 1] ?? null
}

/** 自检:构造面(不依赖真仓),正反成对。 */
export function selfTest() {
  const numbers = { dbTables: 583, apiRoutes: 4363, llmModels: 118, testFiles: 2103, i18nLanguages: 5, guardianGates: 187, appPackages: 9, aiServiceRoutes: 548, wsEndpoints: 25, publishPlatforms: 38, ciWorkflows: 46 }
  let pass = 0
  let fail = 0
  const ok = (name, cond) => {
    if (cond) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.log(`  ❌ ${name}`)
    }
  }
  // S1 一致 ⇒ 不判红(阳性对照的前提)
  const good = `正文 ${numbers.dbTables} 张表\n${BLOCK_BEGIN}\n| 数据库表 | ${numbers.dbTables} | \`dbTables\` |\n${BLOCK_END}\n`
  ok('S1 现算值原样写进文档 ⇒ 0 违规', findStaleClaims(good, numbers).violations.length === 0)
  // S2 旧数 ⇒ 必红且点名
  const stale = `正文 ${542} 张表,另有 ${numbers.dbTables} 张。\n${BLOCK_BEGIN}\n| 数据库表 | ${numbers.dbTables} | \`dbTables\` |\n${BLOCK_END}\n`
  const s2 = findStaleClaims(stale, numbers)
  ok('S2 手抄旧数(542)⇒ 判红且点名 dbTables', s2.violations.length === 1 && s2.violations[0].key === 'dbTables' && s2.violations[0].found === 542)
  // S3 生成块内的数字不参与散文判据(否则派生块自己顶自己)
  const inBlockOnly = `x\n${BLOCK_BEGIN}\n| 数据库表 | ${542} | \`dbTables\` |\n${BLOCK_END}\n`
  ok('S3 块内不判散文(块内过期由 DN1 管)', findStaleClaims(inBlockOnly, numbers).violations.length === 0)
  // S4 相邻不同义措辞不得误伤:"288 路由文件" 不是路由数
  const nearMiss = `4363 API 路由跨 288 路由文件,16 共享包,200+ services。\n${BLOCK_BEGIN}\nx\n${BLOCK_END}\n`
  ok('S4 "288 路由文件" 不得被读成路由数', findStaleClaims(nearMiss, numbers).violations.length === 0)
  // S5 缺块 ⇒ DN1 红并给命令
  ok('S5 无生成块 ⇒ DN1 红', !checkGeneratedBlock('只有正文没有块', numbers).ok)
  // S6 块内缺键 ⇒ 红(该键无人对账)
  ok('S6 块内少一行 ⇒ DN1 红', checkGeneratedBlock(`${BLOCK_BEGIN}\n| a | ${numbers.dbTables} | \`dbTables\` |\n${BLOCK_END}`, numbers).problems.length > 0)
  // S7 简介:旧表数 ⇒ 红
  ok('S7 简介里 340 tables ⇒ DN3 点名 dbTables', checkDescription('RLS over 340 tables', numbers).problems.some((p) => p.includes('dbTables')))
  // S8 简介:现算值 ⇒ 0 问题(反向对照)
  ok('S8 简介现算值 ⇒ DN3 无问题', checkDescription(`RLS over ${numbers.dbTables} tables · ${numbers.llmModels} catalogued LLMs`, numbers).problems.length === 0)
  // S9 逗号写法归一。**必须断 checked===1**:旧版只断"违规=0",而 `\d{2,6}(?:,\d{3})*` 对
  //     "4,363" 从未匹配过(首段只有 1 位)⇒ checked=0 也绿,这条断言一直替瞎掉的尺子发合格证。
  ok(
    'S9 "4,363 API 路由" 与现算值等值(且真被匹配到)',
    (() => {
      const r = findStaleClaims(`4,363 API 路由\n${BLOCK_BEGIN}\nx\n${BLOCK_END}`, numbers)
      return r.checked === 1 && r.violations.length === 0
    })(),
  )
  // S10 三态:0 候选判死优先于一切
  ok('S10 枚举到 0 候选 ⇒ exit 2(不记绿)', decide({ violations: [], blockProblems: [], descProblems: [], undetermined: [], strict: false, candidates: 0 }).code === 2)
  // S11 未判定在默认档不红、strict 档 exit 2
  const u = { violations: [], blockProblems: [], descProblems: [], undetermined: [{ key: 'x', reason: '没输入' }], candidates: 3 }
  ok('S11 默认档:未判定不冒红', decide({ ...u, strict: false }).code === 0)
  ok('S11b strict 档:未判定拒绝出合格证 ⇒ exit 2', decide({ ...u, strict: true }).code === 2)
  // S12 红优先于未判定(已判出违规就不许降级成"无法判定")
  ok('S12 有违规 ⇒ exit 1', decide({ ...u, violations: [{ key: 'dbTables' }], strict: true }).code === 1)
  // S13 悬空块(有 begin 无 end)必须点名,不得静默把整篇当块内
  const dangling = `${BLOCK_BEGIN}\n542 张表\n`
  ok('S13 块未闭合 ⇒ 点名 danglingBlock', findStaleClaims(dangling, numbers).danglingBlock === true)
  // S14 specOf:索引档必须带前导冒号(漏了就 --staged 恒"取不到")
  ok('S14 索引 spec 带前导冒号', specOf('staged', 'README.md') === ':README.md' && specOf('head', 'README.md') === 'HEAD:README.md')
  // S15 收窄的反向护栏:子量级 / 相邻不同义的写法不得被当成总量声明(第一版就是在真 README 上
  //     命中 108 处、其中约 1/4 是这一类假阳,假阳的直接后果是逼人 --no-verify)
  const noise = [
    '| **edu-full schema** | 45 张表(最大 schema) |',
    '每域平均 18 张表,密度合理。',
    'PostgreSQL 2 张表(`im-adapters.ts`):',
    '| L1 数据层 | 24+7 LLM provider 字段字典化 |',
    'Web 250+ 页面 + API 288 路由文件 + 16 共享包 + 200+ services',
    'GitHub Actions(build / ci / e2e / knip 4 workflow)',
    'AI 翻译流水线:从 zh-CN 差异 → 4 语言补全',
    '其余 4 语言同',
  ].join('\n')
  ok('S15 子量级/同形不同义 ⇒ 零违规(假阳护栏)', findStaleClaims(noise, numbers).violations.length === 0)
  // S16 阳性对照:真事故形态必须逐个点名(收窄不等于把门关掉)
  const real = [
    'RLS over 340 tables', // dbTables
    '542 张表', // dbTables
    '176 大模型统一调度', // llmModels
    '188 守门脚本', // guardianGates(≥3 位才算总量声明;子量级的"4 守门脚本"不判,见 CLAIMS 注释)
    '719 测试文件', // testFiles
    '40 CI workflows', // ciWorkflows
    '12 WebSocket 通道', // wsEndpoints
    '25 平台发布', // publishPlatforms
    '4393 API 路由', // apiRoutes
  ].join('\n')
  const s16 = findStaleClaims(real, numbers).violations
  ok(
    'S16 真事故形态 ⇒ 8 个指标全部点名(收窄没把判据弄瞎)',
    new Set(s16.map((v) => v.key)).size === 8 && s16.length === 9,
  )
  // S17 逗号粘连不得跨数字吞("…16,250+ 页面)+ API(Fastify 5,4393 路由" 曾被读成 54393)
  ok('S17 粘连数字不被吞并', findStaleClaims('Next.js 16,250+ 页面,Fastify 5,4393 路由', numbers).violations.every((v) => v.found === 4393))
  // S18 每条措辞的**正向证明**:sample 用现算值时必须真被正则取到(pick 出同一个数),
  //     换一个错值时必须恰好产出一条该键的违规。名单类判据只有反向证明 = 名单可以是张死表
  //     (守门 120 那一型:"拦到坏值才红"从不证明名单里这一条真能命中)。
  ok(
    'S18 每条措辞正向可命中 + 换错值必点名',
    CLAIMS.every((c) => {
      const v = numbers[c.key]
      c.re.lastIndex = 0
      const m = c.re.exec(c.sample.replace('<N>', String(v)))
      const hit = m !== null && toInt(c.pick(m)) === v
      const wrong = findStaleClaims(c.sample.replace('<N>', String(v + 1)) + `\n${BLOCK_BEGIN}\n${BLOCK_END}`, numbers)
      return hit && wrong.violations.length === 1 && wrong.violations[0].key === c.key
    }),
  )
  // S19 覆盖面对账:CLAIMS 覆盖的键必须是 ORDER 的子集且非空(漏一个键 = 那个数字无人对账,
  //     而账面仍然全绿 —— 与本门立项理由同型)
  const claimKeys = new Set(CLAIMS.map((c) => c.key))
  ok(
    'S19 CLAIMS 与 ORDER 无空档',
    claimKeys.size === CLAIMS.length &&
      [...claimKeys].every((k) => ORDER.includes(k)) &&
      claimKeys.size >= 10,
  )
  // S20 行内豁免:带原因才生效,裸标记不生效(防"用一个标记救整篇")
  const withExempt = `当年约 110 道守门同时失效 <!-- doc-num-exempt: 叙述 2026-09-24 事故当时的量,非当前总量 -->`
  const bareExempt = `当年约 110 道守门同时失效 <!-- doc-num-exempt -->`
  ok(
    'S20 豁免须带原因且只救本行',
    findStaleClaims(withExempt, numbers).violations.length === 0 &&
      findStaleClaims(bareExempt, numbers).violations.length === 1 &&
      findStaleClaims(withExempt + '\n542 张表', numbers).violations.length === 1,
  )
  // S21 判责时机(防恒红收窄):未触及被审文档 ⇒ 不问责;触及/worktree/strict ⇒ 全判。
  //     decide 的 scopeApplicable=false 一支必须**先于** candidates===0 判死 —— 否则"没人改
  //     README 的普通轮次"会被判成尺子失明,收窄就成了新的恒红门(§12e)。
  ok('S21a staged 未触及 ⇒ 不问责', planAccountability({ face: 'staged', touched: [], strict: false }).enforce === false)
  ok('S21b staged 触及 README ⇒ 全判', planAccountability({ face: 'staged', touched: ['README.md'], strict: false }).enforce === true)
  ok('S21c strict ⇒ 无条件全判', planAccountability({ face: 'head', touched: [], strict: true }).enforce === true)
  ok('S21d worktree ⇒ 全判(人工面)', planAccountability({ face: 'worktree', touched: [], strict: false }).enforce === true)
  ok(
    'S21e 不问责轮次:0 候选也不判死(收窄不得造新恒红)',
    decide({ violations: [], blockProblems: [], descProblems: [], undetermined: [], strict: false, candidates: 0, scopeApplicable: false }).code === 0,
  )
  ok(
    'S21f 反例:问责轮次 0 候选仍判死(不问责≠永久豁免)',
    decide({ violations: [], blockProblems: [], descProblems: [], undetermined: [], strict: false, candidates: 0 }).code === 2,
  )
  // S22 逗号分组归一(G-1117442)——三条同时成立才算这一族有牙,缺任一条就是恒真断言:
  //     ① 英文支带逗号**必被抓**(checked 必须 ≥1 —— "0 违规"与"根本没看见"过去同形);
  //     ② 不带逗号不误伤(位数下限逐字保持原判据:1 位数、无英文措辞的裸数仍不算总量声明);
  //     ③ 带逗号且写对现算值 ⇒ 抓到但不判红(证明"匹配到"不等于"判成漂移")。
  const s22a = findStaleClaims(`4,415 API routes\n${BLOCK_BEGIN}\nx\n${BLOCK_END}`, numbers)
  ok(
    'S22a 英文支带逗号必被抓(checked=1 且点名 4415≠4363)',
    s22a.checked === 1 &&
      s22a.violations.length === 1 &&
      s22a.violations[0].key === 'apiRoutes' &&
      s22a.violations[0].found === 4415,
  )
  const s22b = findStaleClaims(`5 API routes\n4 张表\n3 test files\n5,000 测试文件\n${BLOCK_BEGIN}\nx\n${BLOCK_END}`, numbers)
  ok(
    'S22b 不带逗号不误伤:1 位数与无英文措辞的裸数仍不算总量声明',
    s22b.checked === 1 && s22b.violations.length === 1 && s22b.violations[0].found === 5000,
  )
  const s22c = findStaleClaims(`4,363 API routes\n${BLOCK_BEGIN}\nx\n${BLOCK_END}`, numbers)
  ok('S22c 带逗号写对现算值 ⇒ 抓到且判等通过', s22c.checked === 1 && s22c.violations.length === 0)
  // S23 逗号分组写法只许 NUM 出一份 —— 判据比对的是**实际吃进 RegExp 的那一串**,不是源码文本
  //     (注释里提到这一片段是正当的,按文本数会把自己判红;而手抄一份 `(?:,\d{3})*` 恰恰就是
  //     本票要防的第二真相:两处算同一件事必漂移,漂开的表现不是报错,是两条判据各自发合格证)。
  const usesNumFabric = (src) => {
    if (!src.includes(',\\d{3}')) return true // 不含分组形态 ⇒ 与本锁无关
    return [1, 2, 3, 4, 5, 6].some((max) => [1, 2, 3].some((min) => src.includes(NUM(min, max))))
  }
  const s23 = CLAIMS.filter((c) => !usesNumFabric(c.re.source))
  ok(
    'S23 分组写法只由 NUM 出一份(每条 claim 的分组形态必须逐字是 NUM 的产物)',
    s23.length === 0 &&
      // 阳性对照:把旧的死写法(首段仍要求 ≥2 位)喂同一把锁,必须被判成"不是 NUM 的产物"
      !usesNumFabric(new RegExp(`(\\d{2,6}(?:,\\d{3})*)x`, 'gi').source) &&
      usesNumFabric(NUM(2, 6)),
  )
  console.log(`\n自检:pass ${pass} / fail ${fail}`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定:${error}`)
    return 2
  }
  const strict = argv.includes('--strict')
  const root = resolve(readArg(argv, '--root') ?? ROOT)
  let derived
  const docsText = new Map()
  try {
    assertRepoRoot(root, '本门')
    derived = collectNumbers({ root, face })
    if (face === 'worktree') {
      for (const rel of AUDITED_DOCS) {
        const t = readWorktreeFile(root, rel)
        if (t !== null) docsText.set(rel, t)
      }
    } else {
      const blobs = catBatch(root, AUDITED_DOCS.map((rel) => specOf(face, rel)))
      for (const rel of AUDITED_DOCS) {
        const v = blobs.get(specOf(face, rel))
        if (typeof v === 'string') docsText.set(rel, v)
      }
    }
  } catch (e) {
    console.error(`❌ 无法判定(取材失败):${e instanceof Undetermined ? e.message : e?.message ?? e}`)
    return 2
  }

  const undetermined = [...(derived.undetermined ?? [])]
  const violations = []
  const blockProblems = []
  const descProblems = []
  let candidates = 0

  if (docsText.size === 0) {
    console.error(`❌ 无法判定:被审文档在${face}面上一个都取不到(${AUDITED_DOCS.join(', ')})`)
    return 2
  }
  let touched = []
  try {
    touched = face === 'worktree' ? [...AUDITED_DOCS] : touchedAuditedDocs(root, face)
  } catch (e) {
    console.error(`❌ 无法判定(改动清单取不到):${e instanceof Undetermined ? e.message : e?.message ?? e}`)
    return 2
  }
  const plan = planAccountability({ face, touched, strict })
  // 按**文档**分别问责:strict/worktree 面全判;提交链面只判"本轮被触及的那份" ——
  // 否则改 zh 的那枚会为 en 的旧账挡路(别人欠的债钉红无关提交,§12e 同型),
  // 未触及文档的偏差如实计入"漂移只报数",它被改动的那枚必判。
  const judgeAll = plan.enforce && (strict || face === 'worktree')
  const driftDocs = []
  for (const [rel, text] of docsText) {
    const r = findStaleClaims(text, derived.numbers)
    const g = rel === 'README.md' ? checkGeneratedBlock(text, derived.numbers) : { ok: true, problems: [], checked: 0 }
    if (!judgeAll && !touched.includes(rel)) {
      const n = r.violations.length + g.problems.length + (r.danglingBlock ? 1 : 0)
      if (n > 0) driftDocs.push({ rel, n })
      continue
    }
    candidates += r.checked + g.checked
    for (const v of r.violations) violations.push({ ...v, file: rel })
    if (r.danglingBlock) blockProblems.push(`${rel}:生成块未闭合(有 begin 无 end)`)
    if (!g.ok) blockProblems.push(...g.problems.map((p) => `${rel}:${p}`))
  }

  const descArg = readArg(argv, '--description')
  if (descArg) {
    try {
      const text = (descArg === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(root, descArg), 'utf8')).trim()
      if (!text) undetermined.push({ key: 'description', reason: '简介输入是空串' })
      else {
        const d = checkDescription(text, derived.numbers)
        candidates += d.checked
        descProblems.push(...d.problems)
      }
    } catch (e) {
      undetermined.push({ key: 'description', reason: `读不到简介输入(${descArg}):${e.message}` })
    }
  } else {
    undetermined.push({ key: 'description', reason: '未提供 --description ⇒ 简介面本轮不判(问责请跑 --strict --description -)' })
  }

  const { code, why } = decide({
    violations,
    blockProblems,
    descProblems,
    undetermined,
    strict,
    candidates,
    scopeApplicable: plan.enforce,
  })
  const driftCount = driftDocs.reduce((a, d) => a + d.n, 0)
  if (!plan.enforce) {
    const drift = driftCount + violations.length + blockProblems.length + descProblems.length
    console.log(`face=${face} · 现算 ${Object.keys(derived.numbers).length} 个数字 · ${plan.why}`)
    if (drift > 0) console.log(`   当前漂移 ${drift} 处(只报数)—— 明细:node scripts/check-doc-numbers.mjs --strict`)
    return code
  }
  console.log(
    `face=${face} · 现算 ${Object.keys(derived.numbers).length} 个数字 · 散文/简介命中 ${candidates} 处数字 · 守门 ${derived.numbers.guardianGates ?? '?'} 道 · 问责:${plan.why}`,
  )
  if (driftDocs.length > 0 && !judgeAll)
    console.log(`   ${driftDocs.map((d) => `${d.rel}(${d.n} 处漂移)`).join('、')} 本轮未被触及 ⇒ 不判,被改动那枚必判`)
  for (const v of violations)
    console.log(`❌ ${v.file}:${v.line} \`${v.key}\` 写着 ${v.found},现算 ${v.want} —— ${v.excerpt}`)
  for (const p of blockProblems) console.log(`❌ ${p}`)
  for (const p of descProblems) console.log(`❌ ${p}`)
  for (const u of undetermined) console.log(`⚠️ 未判定 ${u.key}:${u.reason}`)
  console.log(
    code === 0
      ? `✅ 文档数字与现算值一致(${why})。要刷新 README 块:node scripts/gen-doc-numbers.mjs --markdown`
      : `结论:${why}`,
  )
  return code
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
