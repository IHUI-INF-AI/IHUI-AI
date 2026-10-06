#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-bpe-encoding-parity.mjs —— 跨端 BPE 词表对账(台账 G-1058650 残余②「跨端 BPE 分歧未归因」)
 *
 * 【接线状态:未接 pre-commit、未登记 guardian-runner;接线归主会话裁决,理由见下方「为什么暂不装车」】
 *   实测依据(2026-10-07 现读):`grep -n "bpe-encoding-parity" scripts/guardian-runner.mjs` = **0 命中**。
 *   本门**刻意不写** "已接 pre-commit" —— 那种自称已在本仓因"锚字面量而不核真值源"倒过 40+ 例。
 *   问责入口:`node scripts/check-bpe-encoding-parity.mjs --strict`(默认档与 --strict 同语义,理由见下)。
 *   取证:`node scripts/check-bpe-encoding-parity.mjs --self-test`(含两次变异对照)
 *   §22c 镜像:`node --test scripts/tests/check-bpe-encoding-parity.test.mjs`
 *   **没有紧急跳过变量** —— 它不在钩子链上,不存在「被跳过」这件事。
 *
 * 它钉的是什么病(主会话已用可重跑命令**独立坐实**,不是假想、不是本文的推测):
 *   两端根本不是同一套 BPE 词表,而两侧注释都声称「一致」,还互指对方为等价实现:
 *     · TS 侧唯一 BPE 入口 packages/context-compaction/src/token-estimate.ts:8 =
 *       `import { encode } from 'gpt-tokenizer'`(**未指定编码**)。该包(gpt-tokenizer ^3.4.0)
 *       主入口**实际再导出 `./encoding/o200k_base.js`**(实测 esm/main.js 第 2 行),即 **o200k_base**。
 *     · Python 侧 apps/ai-service/app/core/context_compaction.py:92 =
 *       `tiktoken.get_encoding("cl100k_base")`,而 :88 的 docstring 白纸黑字写着
 *       「cl100k_base,与 TS 端 gpt-tokenizer 一致」。
 *   分歧样本(**纯 ASCII、无 CJK、无 emoji**):"Addition is defined by the successor function."
 *   实测 TS=8 / PY=9。差在 `Add+ition` 这一个合并:o200k 切 ['Addition',…],cl100k 切 ['Add','ition',…]。
 *   语义路径:压缩按估算占比触发(0.88),两端对同一段对话算出不同 token 数 ⇒ 同一段上下文
 *   在 TS 侧已触发压缩而 Python 侧未触发(或反之),而 typecheck / lint / 全部既有守门都不红。
 *
 * ⚠️ **既有 24 条夹具(HEAD)的同值是巧合,不是一致性证据**(本门存在的头号理由):
 *   packages/context-compaction/tests/fixtures/parity.json 在 HEAD 上是 24 条消息,
 *   在 o200k 与 cl100k 下逐条总读数**完全相等**(实测 o200k=29250 / cl100k=29250 / 差=0 /
 *   有差异条数=0/24)。那只说明这批文本整批落在两张表的**等值子集**上,**踩不到任何分歧词**。
 *   ⇒ 「24 条逐值相同」这条反向锁**证明不了跨端一致**,它只证明"这批文本没踩到分歧词"。
 *   任何文档 / 注释 / 汇报里把「24 条同值」当一致性证据的说法都要拿掉(本票改正的三处谎报即此)。
 *
 *   **实测补充(2026-10-07 worktree)**:并发会话往夹具补了 2 条**中文**消息
 *   ("你好,世界。" 与一段中文长文),本门跑出来这两条**真的分叉**
 *   (TS=4/PY=7、TS=121/PY=176)。这是对本票缺陷的**独立印证**,且说明"巧合"确实是巧合 ——
 *   同一份夹具里,ASCII 那批同值、中文那批分叉。所以本门把夹具当**历史语料**报告,
 *   **不**当"必须永不漂移"的反向锁(那会把"语料更新"误报成"实现坏了")。
 *
 * 判据(三条,逐层加固 —— 上一层可能被绕过,下一层兜底):
 *   C1 **声明层**(锚「两端声明用同一套编码」,**读真值源**,不锚会过期的注释文本):
 *      · TS 侧:从 token-estimate.ts 的**实际 import 说明符**解析出编码标识符。解析链是真的:
 *        说明符 `gpt-tokenizer/encoding/<x>` 直接取 <x>;裸 `gpt-tokenizer` 则**去问这个包**
 *        (读它的 package.json 落点文件、跟随里面的 re-export 链),取它**实际**再导出的
 *        `./encoding/<x>.js`。**刻意不硬编码"主入口=o200k"那张表** —— 哪天上游换主入口,
 *        本门自动跟到新值;写死就变成一条恒绿的谎报。自检 S1b 就是钉这一条(换掉主入口,解析跟着变)。
 *      · Python 侧:从 context_compaction.py 的 **tiktoken.get_encoding("…") 实际实参**解析。
 *      · 两端标识符不等 ⇒ 判红,并点名"谁是什么 / 凭什么这么读出来的"。
 *   C2 **行为层正向锁**(不只比字符串标识符 —— 标识符解析可能漏判:别名、再导出、包装、运行时换表):
 *      对一组**能区分两张词表**的探针文本(见 PROBES:ASCII + 中文 + emoji + 中英混排),
 *      **实跑两端生产估算器**并逐值比对:全等 ⇒ 绿;任一条不等 ⇒ 红,并打印是哪个探针、两端各多少。
 *      两侧都跑**生产实现本体**(TS 直接 import src/token-estimate.ts 的 estimateTokens;
 *      Python 侧派生进程 import app.core.context_compaction 的 _estimate_text_with_image_placeholders),
 *      不在本门里重写一份算法 —— 重写那份只会与生产实现同源漂移,门绿着而生产代码已经变了。
 *      探针里**刻意含一条纯 ASCII**:这样"分歧只可能来自 CJK/emoji 编码假设"这条辩解被排除。
 *      中文/emoji 是本仓真实载荷的主体形态,必须单独覆盖(实测中文差 8~10 token,不是小数点)。
 *   C3 **反向锁(防空转)**:**不同编码下取值相同**的探针不得被报成分歧,否则门会逼人"把一切都判红",
 *      而恒红门的唯一结局是被 `--no-verify` 跳掉(等于没有门)。既有 24 条恰好就是这种文本,
 *      本门把它们当反向锁语料(逐条跑两端、要求同值),另配一组人工挑的等值形态
 *      (REVERSE_PROBES:JSON / 代码 / 常用 ASCII 句)证明"同值"是这类文本的**普遍性质**,
 *      从而把"既有 24 条同值"从证据降级为常识。
 *
 * 三态绝不并桶(本仓最高频的失效型是"把没判写成判过了"):
 *   同值 / 漂移 / **未判定**。未判定(面取不到、包解析不出、Python 派生失败、探针枚举到 0 条)
 *   一律 exit 2,**既不记绿也不冒红**。一例都没判到 ⇒ 判死(宁可大声,不可发合格证)。
 *
 * 为什么暂不装车(不许照抄别门的「已接 pre-commit」就以为能装车):
 *   ① 本门需要 ai-service 的 .venv 解释器,而**解释器在不在是机器状态**:缺它的提交者结构上
 *      满足不了,挂 blocking 就是每台每次被逼 `--no-verify`,而一次绕过等于该枚提交上**全部**
 *      守门作废(AGENTS §12e 同型;先例 scripts/check-line-split-parity.mjs 头注逐字同因,本门照它办理)。
 *   ② 更要紧的是**它现在就该是红的**:缺陷已坐实,而"该统一到哪张表"是**替真实业务选模型**,须人拍板。
 *      一台恒红门开着只会训练人跳门。所以默认档就等同于问责档,接线由主会话裁决。
 *
 * 取材面:同 70/77/83/98/101/103/118 —— 缺省判 **HEAD blob**、`--staged` 判**索引 blob**、
 *   `--worktree` 仅人工取证、两面旗同给 exit 2、取不到不回落另一个面。
 *   **C1 与 C2 判同一个面**:C2 把所选面的文本**落进临时目录后执行**(TS 侧替换裸包说明符为
 *   同一模块的绝对 file URL;Python 侧连`from .tunables import …` 的依赖一起搬),
 *   所以不会出现"声明读 HEAD、行为跑工作树"的错面 —— 那是"自洽却错面"的尺子(§ 取材面纪律,
 *   同族门 check-line-split-parity.mjs 的 loadTsModuleFromFace 同形)。
 *
 * 已知覆盖边界(如实登记,不得读成"已确认没有"):
 *   · C1 只解析**字面量声明**。若有人把编码改成运行时计算(如从 env 读),本门报「解析不到」
 *     ⇒ 未判定,而不是悄悄跳过。
 *   · C2 跑的是**工作树当前**实现;若 src 被改坏到 import 失败,归未判定并点名。
 *   · **Python 的两条静默降级路径**(加载失败退 `p50k_base`、encode 失败退 `len(text)//4`)
 *     触发时,C1 解析到的声明与运行时实际用的表就会**脱钩**,两端分歧进一步扩大。
 *     本门不试图预测降级是否已发生(那要看日志),但把运行时实际 encoding 读出来与声明对照,
 *     不一致就点名 —— 降级一旦已发生,输出里会出现那条 ⚠️。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 被审的两份文件:一侧是 TS 的 BPE 入口,一侧是 Python 的 encoder 获取点。 */
const TS_REL = 'packages/context-compaction/src/token-estimate.ts'
const PY_REL = 'apps/ai-service/app/core/context_compaction.py'

/** 夹具:既有 24 条跨端语料 —— 本门**只**用它当反向锁,不当一致性证据(见头注⚠️)。 */
const FIXTURE_REL = 'packages/context-compaction/tests/fixtures/parity.json'

/**
 * Python 面的相对 import 依赖(context_compaction.py:35 `from .tunables import …`)。
 * C2 要把被审面落成一个独立包,少搬它 import 就失败 —— 所以它也是被审面的一部分。
 */
const TUNABLES_REL = 'apps/ai-service/app/core/tunables.py'

/**
 * 行为层的正向探针语料。`expect` 字段**刻意不存在** —— 判据不写死任何读数,
 * 只报「两端实测各是多少、不等就红」。写死读数会把"两端一致"错装成"两端等于某个数",那是另一回事。
 *
 * 每一条都实测过能区分 o200k/cl100k(S5 逐条复核,不是声称)。语料是**量出来的、不是想出来的**:
 * 多数英文句子在两张表下同值(实测 16 条候选里只有 2 条能区分)—— 所以本表的挑选标准
 * 是"实测不等",不是"读起来像技术术语"。
 */
export const PROBES = Object.freeze([
  { name: 'ascii-addition', text: 'Addition is defined by the successor function.', kind: 'ascii' },
  { name: 'ascii-disparity', text: 'Disparity between implementations must be attributed.', kind: 'ascii' },
  { name: 'cjk-compaction', text: '上下文压缩模块的跨端一致性判据。', kind: 'cjk' },
  { name: 'cjk-summary', text: '请把这条消息压缩成摘要。', kind: 'cjk' },
  { name: 'cjk-regression', text: '珠穆朗玛峰是地球上海拔最高的山峰。', kind: 'cjk' },
  { name: 'emoji-target', text: '🎯 target reached ✅ done', kind: 'emoji' },
  { name: 'emoji-family', text: '🚀 shipped 👨‍👩‍👧 family 👩🏽‍💻', kind: 'emoji' },
  { name: 'mixed-parser', text: 'fix bug: 修复 🐛 in parser.ts', kind: 'mixed' },
])

/**
 * 反向锁语料(C3):**不同编码下取值相同**的文本,两端必须同值,且**不得**被报成分歧。
 * 自检 S6 会实测它们在 o200k/cl100k 下逐条同值 —— 反向锁的防空转能力是被验证过的,不是声称的。
 */
export const REVERSE_PROBES = Object.freeze([
  { name: 'json-shape', text: '{"role":"user","content":"hello world"}' },
  { name: 'code-reduce', text: 'const total = items.reduce((a, b) => a + b, 0)' },
  { name: 'ascii-induction', text: 'Mathematical induction is a method of proof.' },
  { name: 'ascii-regression', text: 'Please summarize the regression test failures.' },
  { name: 'ascii-thanks', text: 'Thank you for your help.' },
])

/**
 * 已批准作为**主表**候选的编码(见 C1b 判据)。
 *
 * 这**不是**"选定 o200k 或 cl100k 为正解" —— 那属于替真实业务选模型,须人拍板,本门不越权。
 * 它只回答一个更窄的问题:"两端约定的必须是这两张**真词表**之一,不能是别的"。
 * 之所以必须钉这一条,是因为纯"两端相等"判据有个真实的空转形态:
 *   两端**同时**退到 `p50k_base` 时,它们彼此是**相等**的 ⇒ 纯相等判据会记绿。
 * 而 `p50k_base` 在本仓只以**降级兜底**的身份出现(context_compaction.py:95 的 except 分支),
 * 从来不是 anybody 的主动选择 —— 所以"两端一起退到降级表"必须判红,而不是记绿。
 * 新增/移除候选编码是一次**须留痕的拍板**,不是随手加一行。
 */
export const APPROVED_ENCODINGS = Object.freeze(['o200k_base', 'cl100k_base'])

// ── C1:声明层 —— 从真值源解析两端编码标识符 ─────────────────────────────

/**
 * 从 gpt-tokenizer 的**实际导出**解析裸主入口 `'gpt-tokenizer'` 指向哪张编码表。
 *
 * 刻意不写死 `{ 'gpt-tokenizer': 'o200k_base' }`:那张表是**某一次安装的观测**,不是契约。
 * 实测(3.4.0):package.json 的 module/main 都落 `esm/main.js`,其第 2 行
 * `export { default } from './encoding/o200k_base.js'` —— 于是跟到 o200k_base。
 *
 * @param {string} pkgDir 包目录
 * @param {(p:string)=>string} readFile 注入的读文件出口(镜像测试用假包,不碰真仓库)
 * @returns {{ok:true, encoding:string, chain:string[]} | {ok:false, why:string}}
 */
export function resolveBareEntrypointEncoding(pkgDir, readFile, depth = 0) {
  if (depth > 4) return { ok: false, why: '跟随 gpt-tokenizer 主入口的 re-export 链超过 4 跳(异常深)' }
  let pkg
  try {
    pkg = JSON.parse(readFile(path.join(pkgDir, 'package.json')))
  } catch (e) {
    return { ok: false, why: `读不到/解析不了 gpt-tokenizer/package.json:${(e && e.message) || e}` }
  }
  // exports['.'] 优先(main/module 是老式 fallback);都取不到才算判不出。
  const dot = pkg.exports && pkg.exports['.']
  const entry =
    (dot && typeof dot === 'object' && typeof dot.import === 'string' ? dot.import : undefined) ||
    (typeof dot === 'string' ? dot : undefined) ||
    (typeof pkg.module === 'string' ? pkg.module : undefined) ||
    (typeof pkg.main === 'string' ? pkg.main : undefined) ||
    null
  if (!entry) return { ok: false, why: 'gpt-tokenizer/package.json 里 exports["."]/module/main 都取不到入口' }

  const chain = [entry]
  let file
  try {
    file = readFile(path.join(pkgDir, entry))
  } catch (e) {
    return { ok: false, why: `主入口文件 ${entry} 读不到:${(e && e.message) || e}` }
  }
  // gpt-tokenizer 的编码入口都在 ./encoding/<x>.js 下;命中即得标识符。
  for (const m of file.matchAll(/from\s+['"]\.\/encoding\/([A-Za-z0-9_]+)\.js['"]/g)) {
    return { ok: true, encoding: m[1], chain }
  }
  // 没有 ./encoding/ 的再导出 ⇒ 可能再指向别的相对文件(例如 esm 门面再转一层)。跟一跳。
  const rel = file.match(/from\s+['"](\.[^'"]+)['"]/)
  if (!rel) {
    return { ok: false, why: `主入口 ${entry} 里既没有 ./encoding/* 的再导出,也没有可跟随的相对再导出` }
  }
  const next = path.normalize(path.join(path.dirname(entry), rel[1]))
  chain.push(next)
  return resolveBareEntrypointEncoding(pkgDir, readFile, depth + 1)
}

/**
 * 把**注释**按原偏移替换成等长空格(代码结构与行号完全保留)。
 *
 * 为什么要它(本轮实测踩到过,不是假想):C1 是"读真值源"的判据,而**注释不是声明**。
 * 本票改正后的 TS 头注里写了一句 `import { encode } from 'gpt-tokenizer'`(那是**散文**,
 * 陈述事实,不是声明)。不剥注释就会被数成"encode 从 2 个不同说明符导入" ⇒ 判不出。
 * Python 侧同源问题更隐蔽:模块头注里的 `tiktoken.get_encoding("cl100k_base")` 会被
 * 正则扫成"第 0 处实参" ⇒ C1 变成锚注释文本(该侧已改用 AST 根治,见 pythonAstProgram)。
 *
 * **刻意不屏蔽字符串字面量** —— 那样会把 import 说明符本身一起抹掉,而说明符正是 C1 要读的
 * 东西(屏蔽字符串等于把答案擦掉)。残留风险:形如 `const s = "from 'gpt-tokenizer'"`
 * 的字符串会被误当声明;真出现时 C1 会给出"多个说明符 ⇒ 判不出",是**响**的失败,不是静默的绿。
 *
 * 等长替换是关键:偏移与行号不变,所以掩码上的解析结果仍能回指原文真实位置。
 */
export function maskComments(src) {
  const out = src.split('')
  const n = src.length
  let i = 0
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (c === '/' && c2 === '/') {
      let j = i
      while (j < n && src[j] !== '\n') j++
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && c2 === '*') {
      let j = src.indexOf('*/', i + 2)
      j = j === -1 ? n : j + 2
      blank(i, j)
      i = j
      continue
    }
    i++
  }
  return out.join('')
}

/**
 * 从 TS 源解析编码标识符(锚**实际 import 说明符**,不锚注释文本)。
 * 认得两种形态:`gpt-tokenizer/encoding/<x>` 直取 <x>;裸 `gpt-tokenizer` 去问这个包。
 *
 * @param {string} src TS 源文本
 * @param {() => string|null} resolvePkgDir 定位包目录的出口(镜像测试可注入假目录)
 */
export function parseTsEncoding(src, resolvePkgDir) {
  // **先剥注释**再扫 import:头注里的散文不是声明(见 maskComments 的注释)。
  // 实测踩过:头注写了一句 `import { encode } from 'gpt-tokenizer'` 后,
  // 不剥就会被数成"从 2 个说明符导入" ⇒ 判不出。
  const code = maskComments(src)
  const specifiers = [...code.matchAll(/import\s*(?:type\s*)?\{[^}]*\bencode\b[^}]*\}\s*from\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1],
  )
  if (specifiers.length === 0) {
    return { ok: false, why: `${TS_REL} 里解析不到「import { encode } from 'gpt-tokenizer…'」形态的语句(改了包名或换成 require?)` }
  }
  const uniq = [...new Set(specifiers)]
  if (uniq.length > 1) {
    return { ok: false, why: `${TS_REL} 里 encode 从 ${uniq.length} 个不同说明符导入(${uniq.join(' / ')})⇒ 判不出该用哪张表` }
  }
  const specifier = uniq[0]
  const direct = specifier.match(/^gpt-tokenizer\/encoding\/([A-Za-z0-9_]+)$/)
  if (direct) {
    return { ok: true, encoding: direct[1], specifier, evidence: `import 说明符 ${specifier} 直接点名 ${direct[1]}` }
  }
  if (specifier !== 'gpt-tokenizer') {
    return { ok: false, why: `encode 的 import 说明符是 ${specifier},既不是 gpt-tokenizer 也不是 gpt-tokenizer/encoding/*` }
  }
  const pkgDir = resolvePkgDir()
  if (!pkgDir) return { ok: false, why: 'gpt-tokenizer 在 node_modules 里找不到(未 pnpm install?)' }
  const r = resolveBareEntrypointEncoding(pkgDir, (p) => readFileSync(p, 'utf8'), 0)
  if (!r.ok) return { ok: false, why: `裸主入口 gpt-tokenizer 的实际导出解析失败:${r.why}` }
  return {
    ok: true,
    encoding: r.encoding,
    specifier,
    evidence: `裸主入口 gpt-tokenizer → ${r.chain.join(' → ')} → ./encoding/${r.encoding}.js(向包现读,非硬编码)`,
  }
}

/**
 * Python 侧派生程序:**用 AST** 取真实的 `tiktoken.get_encoding` 调用点。
 *
 * 为什么必须是 AST 而不能正则扫文本(这是本门自查出来的真缺陷,不是假想):
 *   正则 `/tiktoken\.get_encoding\(\s*['"]…['"]\s*\)/` **不区分代码与散文** ——
 *   本模块头注里写了一句 ``tiktoken.get_encoding("cl100k_base")``(那是陈述事实),
 *   正则就把那句散文当成了"第 0 处实参"。那等于"锚注释文本",而锚注释文本正是本判据
 *   明令禁止的形态:注释会过期,也容易被后来的人引用成"这就是声明"。
 *   实测该坑真实触发过(见 git log 本次改动),故改成 AST:只有 Call 节点算声明。
 *
 * 顺带白拿两件靠正则做不到的事:
 *   · 区分**主表**与 **except 兜底**:后者在 `ast.ExceptHandler` 内部,
 *     正是头注登记的那两条静默降级路径(加载失败退 p50k_base、encode 失败退 len/4)。
 *   · 变量实参(`get_encoding(ENC)`)显式记为 `None`,让门判"解析不到"⇒ 未判定,
 *     而不是把 `None` 当成一个编码名继续比。
 */
export function pythonAstProgram() {
  return [
    'import ast, json, sys',
    '',
    'src = open(sys.argv[1], encoding="utf-8").read()',
    'tree = ast.parse(src)',
    '',
    '# except 体内的调用 = 降级兜底;其余 = 主表候选。',
    'inside_except = set()',
    'for node in ast.walk(tree):',
    '    for child in ast.iter_child_nodes(node):',
    '        if isinstance(node, ast.ExceptHandler):',
    '            inside_except.add(id(child))',
    '',
    'calls = []',
    'for node in ast.walk(tree):',
    '    if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)):',
    '        continue',
    '    if node.func.attr != "get_encoding":',
    '        continue',
    '    # 必须是 tiktoken.get_encoding(...) 而不是别的什么.get_encoding(...)',
    '    base = node.func.value',
    '    if not (isinstance(base, ast.Name) and base.id == "tiktoken"):',
    '        continue',
    '    arg = node.args[0] if node.args else None',
    '    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):',
    '        name = arg.value',
    '    elif isinstance(arg, ast.Constant) and arg.value is None:',
    '        name = None  # get_encoding() 无参 —— 显式记为"取不到"',
    '    else:',
    '        name = None  # 变量/表达式实参 ⇒ 取不到,不猜',
    '    calls.append({"name": name, "lineno": node.lineno, "fallback": id(node) in inside_except})',
    '',
    'primary = None',
    'for c in calls:',
    '    if not c["fallback"]:',
    '        primary = c',
    '        break',
    'fallbacks = [c for c in calls if c["fallback"]]',
    'sys.stdout.write(json.dumps({"calls": calls, "primary": primary, "fallbacks": fallbacks}))',
    '',
  ].join('\n')
}

/**
 * 消费 `pythonAstProgram` 的 AST 结果,给出编码标识符。
 *
 * 分开成纯函数是为了让镜像测试能**构造**三态(可判 / 不可判 / 有降级兜底)而不必跑 Python。
 */
export function parsePyEncodingFromAst(astResult) {
  const calls = (astResult && astResult.calls) || []
  if (calls.length === 0) {
    return { ok: false, why: `${PY_REL} 的 AST 里找不到 tiktoken.get_encoding(...) 调用(改了调用形态?)` }
  }
  const primary = astResult.primary
  if (!primary) {
    return { ok: false, why: `${PY_REL} 里tiktoken.get_encoding 只出现在 except 体内(全是降级兜底,没有主表声明)` }
  }
  if (!primary.name) {
    const shape = calls
      .map((c) => `line ${c.lineno}: ${c.fallback ? 'except 兜底' : '主表'}${c.name ? ` "${c.name}"` : '(非字面量实参)'}`)
      .join('; ')
    return { ok: false, why: `${PY_REL}:${primary.lineno} 的 get_encoding 实参不是字面量字符串 ⇒ 解析不到(不猜)。(全部调用点:${shape})` }
  }
  const fbNames = astResult.fallbacks.filter((c) => c.name).map((c) => c.name)
  return {
    ok: true,
    encoding: primary.name,
    evidence:
      `AST:第 ${primary.lineno} 行 tiktoken.get_encoding("${primary.name}")` +
      (astResult.fallbacks.length > 0
        ? `(另有 ${astResult.fallbacks.length} 处 except 兜底:${fbNames.join(', ') || '非字面量'} —— 降级路径,见头注)`
        : ''),
    fallbacks: fbNames,
  }
}

/**
 * 跑 AST 侧(C1 的 Python 半边):把被审面文本喂给 `pythonAstProgram` 取回调用点。
 * 与 C2 共用同一个解释器 —— 两者都缺 ⇒ 同一条"未判定"理由,不会各说各话。
 */
export function runPyAst({ pythonPath, pyText, scratch }) {
  if (!pythonPath) return { undetermined: 'ai-service 的 .venv python 找不到' }
  const srcFile = path.join(scratch, 'py_face.py')
  const progFile = path.join(scratch, 'py_ast.py')
  writeFileSync(srcFile, pyText, 'utf8')
  writeFileSync(progFile, pythonAstProgram(), 'utf8')
  let res
  try {
    res = spawnSync(pythonPath, [progFile, srcFile], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 4 << 20,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })
  } catch (e) {
    return { undetermined: `派生 Python(AST)抛错:${(e && e.message) || e}` }
  }
  if (res.error) {
    return { undetermined: `跑 Python AST 侧失败:${res.error.code || res.error.message}(本机 spawn 偶发 EBUSY,重跑可排除)` }
  }
  if (res.status !== 0) {
    const tail = String(res.stderr || '')
      .trim()
      .split('\n')
      .slice(-2)
      .join(' | ')
    return { undetermined: `Python AST 侧以 exit ${res.status} 退出(被审面 SyntaxError?):${tail || '(无 stderr)'}` }
  }
  try {
    return { ok: true, ast: JSON.parse(res.stdout) }
  } catch {
    return { undetermined: `Python AST 侧输出不可解析:${String(res.stdout || '').slice(0, 160)}` }
  }
}

// ── C2/C3:行为层 —— 实跑两端生产估算器 ──────────────────────────────────

/**
 * 找 ai-service 的 venv python(先例 check-egress-facts / check-load-state-loaded-marks 同一份形状)。
 * **不猜 PATH 上的 `python`**:那会把"机器上恰好装了哪个版本"变成判据输入。
 */
export function findPython(root = ROOT, exists = existsSync) {
  const candidates = [
    path.join(root, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe'),
    path.join(root, 'apps', 'ai-service', '.venv', 'bin', 'python'),
  ]
  for (const p of candidates) if (exists(p)) return p
  return null
}

/**
 * Python 侧派生程序。**不重写一份算法** —— 直接 import 被审面的实现本体
 * (`app.core.context_compaction._estimate_text_with_image_placeholders`),因为 TS 侧跑的
 * 也是生产 `estimateTokens`。两侧各在本门里抄一份的话,抄的那份会与生产实现漂移。
 *
 * 语料用 UTF-16 base64 喂入:§26 —— 中文出参会被 Windows 码页吃掉,ensure_ascii=False 的
 * 中文字面量能在 stdout 侧直接 UnicodeEncodeError,把整门折成"未判定"而原因读起来像 Python 坏了。
 *
 * `mod` 从 payload 读而不是写死:自检的变异对照要 import **变异后的**模块副本,
 * 写死模块名就等于"变异只改了声明文本、行为层跑的还是磁盘上的原件" ——
 * 那是"自洽却错面"的尺子,变异后仍全绿什么都不能证明。
 */
export function pythonProgram() {
  return [
    'import base64, importlib, json, sys',
    '',
    'payload = json.loads(open(sys.argv[1], encoding="utf-8").read())',
    'sys.path.insert(0, payload["import_root"])',
    '',
    'cc = importlib.import_module(payload["mod"])',
    'est = cc._estimate_text_with_image_placeholders',
    '',
    'def dec(s):',
    '    return base64.b64decode(s).decode("utf-16-le")',
    '',
    'out = {}',
    'for item in payload["probes"]:',
    '    try:',
    '        out[item["name"]] = {"value": int(est(dec(item["b64"]))), "ok": True, "why": ""}',
    '    except Exception as e:',
    '        out[item["name"]] = {"value": None, "ok": False, "why": "%s: %s" % (type(e).__name__, e)}',
    '',
    '# JSON 的 \\\\uXXXX 转义由 JSON.parse 原样还原,不影响判据输入。',
    'sys.stdout.write(json.dumps({"probes": out, "encoding": cc._get_encoder().name}))',
    '',
  ].join('\n')
}

const encUtf16 = (s) => Buffer.from(s, 'utf16le').toString('base64')

/**
 * 跑 Python 侧。返回 `{ok, values, encoding}` 或 `{undetermined}` ——
 * 绝不把"没跑到"折成"结论是绿的"。三种失败形状各有文案,不合并。
 */
export function runPythonSide({ pythonPath, probes, importRoot, mod, scratch }) {
  if (!pythonPath) return { undetermined: 'ai-service 的 .venv python 找不到' }
  const payloadFile = path.join(scratch, 'payload.json')
  const progFile = path.join(scratch, 'py_side.py')
  writeFileSync(
    payloadFile,
    JSON.stringify({
      import_root: importRoot,
      mod,
      probes: probes.map((p) => ({ name: p.name, b64: encUtf16(p.text) })),
    }),
    'utf8',
  )
  writeFileSync(progFile, pythonProgram(), 'utf8')
  let res
  try {
    // 2026-10-04:不吃 stdin 的子进程必须显式 stdio,否则本机报 spawnSync EBUSY(status:null)
    res = spawnSync(pythonPath, [progFile, payloadFile], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 8 << 20,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })
  } catch (e) {
    return { undetermined: `派生 Python 抛错:${(e && e.message) || e}` }
  }
  if (res.error) {
    return {
      undetermined: `跑 Python 侧失败:${res.error.code || res.error.message}(本机 spawn 偶发 EBUSY,重跑可排除;不是判据结论)`,
    }
  }
  if (res.status !== 0) {
    const tail = String(res.stderr || '')
      .trim()
      .split('\n')
      .slice(-3)
      .join(' | ')
    return { undetermined: `Python 侧以 exit ${res.status} 退出:${tail || '(无 stderr)'}` }
  }
  let json
  try {
    json = JSON.parse(res.stdout)
  } catch {
    return { undetermined: `Python 侧输出不可解析:${String(res.stdout || '').slice(0, 160)}` }
  }
  return { ok: true, values: json.probes, encoding: json.encoding }
}

/**
 * 把**被审面**的 TS 源落进临时目录再 import。
 *
 * 为什么必须落盘(而不是直接 import 仓库里那个文件):
 *   直接 import 磁盘文件 = **审的是工作树、报的是 HEAD 的结论**。并发会话推进 HEAD 或
 *   有人半编辑该文件时,门会拿一个面去比另一个面 —— 这正是"自洽却错面"的尺子(§ 取材面纪律)。
 *   同族门 `check-line-split-parity.mjs` 走同一形状(它的 `loadTsModuleFromFace`)。
 *
 * 裸说明符 `from 'gpt-tokenizer'` 在 scratch 里解析不到(那儿没有 node_modules),
 * 故替换成**同一模块**的绝对 file URL —— 语义不变(实测三条探针读数与就地 import 逐条相同)。
 * 替换点只认 import 语句里的那一处,不做全文替换。
 */
export function materializeTsFace(faceText, scratch, resolveBare) {
  const dir = path.join(scratch, 'tsface')
  mkdirSync(dir, { recursive: true })
  // 同目录放一个 type:module,免掉 MODULE_TYPELESS_PACKAGE_JSON 警告(噪音会淹掉结论)
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8')
  const abs = pathToFileURL(resolveBare()).href
  // 锚**最后一处**裸说明符(真import):头注散文里也有一模一样的一句,
  // 换第一处会改到散文而真 import 仍解析不到 scratch 里的包名 ⇒ import 直接失败。
  const from = "from 'gpt-tokenizer'"
  const i = faceText.lastIndexOf(from)
  const text = i === -1 ? faceText : faceText.slice(0, i) + `from ${JSON.stringify(abs)}` + faceText.slice(i + from.length)
  const file = path.join(dir, 'token-estimate.mts')
  writeFileSync(file, text, 'utf8')
  return file
}

/**
 * 把**被审面**的 Python 模块落进临时包再 import(理由同 `materializeTsFace`)。
 * 连`tunables.py` 一起搬:它有 `from .tunables import …` 相对 import,少一个就 import 失败。
 */
export function materializePyFace(faceText, tunablesText, scratch, tag = 'pyface') {
  const root = path.join(scratch, tag)
  const pkg = path.join(root, 'facecore')
  mkdirSync(pkg, { recursive: true })
  writeFileSync(path.join(pkg, '__init__.py'), '', 'utf8')
  writeFileSync(path.join(pkg, 'tunables.py'), tunablesText, 'utf8')
  writeFileSync(path.join(pkg, 'context_compaction.py'), faceText, 'utf8')
  return { importRoot: root, mod: 'facecore.context_compaction' }
}

/**
 * 跑 TS 侧:import 被审面落盘后的实现,调用其`estimateTokens`。
 * **不用 dist/** —— 它在 .gitignore 里(实测命中),拿被忽略的构建产物当判据输入,
 * 等于拿"上次构建时的东西"冒充当前真值源。
 */
export async function runTsSide(tsEntryAbs, probes) {
  let mod
  try {
    mod = await import(pathToFileURL(tsEntryAbs).href)
  } catch (e) {
    return { undetermined: `import 被审面 TS 实现失败:${(e && e.message) || e}` }
  }
  if (typeof mod.estimateTokens !== 'function') {
    return { undetermined: `被审面 TS 实现没有导出 estimateTokens(叶子模块被改名/挪走?)` }
  }
  const values = {}
  for (const p of probes) {
    try {
      values[p.name] = { value: Number(mod.estimateTokens(p.text)), ok: true, why: '' }
    } catch (e) {
      values[p.name] = { value: null, ok: false, why: `${(e && e.name) || 'Error'}: ${(e && e.message) || e}` }
    }
  }
  return { ok: true, values }
}

// ── 比对与定级 ──────────────────────────────────────────────────────────

/** 比一侧的探针结果。任一条不等 ⇒ 漂移(红),逐条点名"哪个探针 / 两端各多少"。 */
export function compareProbes(probes, ts, py) {
  const drifts = []
  const undetermined = []
  let checked = 0
  for (const p of probes) {
    const t = ts.values[p.name]
    const y = py.values[p.name]
    if (!t || !t.ok) {
      undetermined.push(`探针 ${p.name}:TS 侧没跑出值(${(t && t.why) || '无该条'})`)
      continue
    }
    if (!y || !y.ok) {
      undetermined.push(`探针 ${p.name}:Python 侧没跑出值(${(y && y.why) || '无该条'})`)
      continue
    }
    checked++
    if (t.value !== y.value) drifts.push({ name: p.name, text: p.text, ts: t.value, py: y.value })
  }
  return { checked, drifts, undetermined }
}

/**
 * 定级。**红只由真分歧产生**;同值一律绿(反向锁生效);未判定 exit 2(既不记绿也不冒红)。
 * 一例都没判到 ⇒ 判死。
 *
 * 三处漂移分开记,不并桶 —— 它们的**含义完全不同**:
 *   · `drifts`(正向探针):这是本门要抓的目标缺陷,判红的正当理由。
 *   · `reverseDrifts`(REVERSE_PROBES):这些文本实测在两张表下**必然同值**,两端却报出不同值
 *     ⇒ 不是"词表不同",而是**别处坏了**(估算逻辑本身变了/ 投影口径分叉)。同样是红,但修法完全不同。
 *   · `fixtureDrifts`(既有夹具消息):夹具是**历史语料**,不是本门的设计断言。
 *     它恰好同值时是"运气"(见头注⚠️),它**出现分歧时同样是证据** ——
 *     实测(2026-10-07 worktree)并发会话往夹具补的两条中文消息就真的分叉,
 *     独立印证了本票缺陷。所以这一桶进"报告"而不是进"反向锁判红"。
 */
export function decide({ tsEnc, pyEnc, positive, reverse, fixture, approved = APPROVED_ENCODINGS }) {
  const undetermined = [...positive.undetermined, ...reverse.undetermined, ...fixture.undetermined]
  if (tsEnc.undetermined) undetermined.push(`TS 侧编码:${tsEnc.undetermined}`)
  if (pyEnc.undetermined) undetermined.push(`Python 侧编码:${pyEnc.undetermined}`)

  const drifts = [...positive.drifts]
  // 反向锁漂移 = "本该同值的文本却不同值" ⇒ 实现本身另有问题,同样是红,但修法不同。
  const reverseDrifts = [...reverse.drifts]
  // 夹具漂移 = 历史语料上的真实分歧,是**证据**(不并进反向锁判红,见上方注释)。
  const fixtureDrifts = [...fixture.drifts]
  const encodingDrift =
    tsEnc.encoding && pyEnc.encoding && tsEnc.encoding !== pyEnc.encoding
      ? `两端声明的编码不同:TS = ${tsEnc.encoding},Python = ${pyEnc.encoding}`
      : null

  // C1b:两端约定的编码必须落在已批准候选内。挡住"两端同时退到降级兜底表"这种
  // **彼此相等但显然不是任何人主动选择**的形态 —— 纯相等判据在那种形态下会记绿。
  const unapproved = []
  for (const [side, e] of [
    ['TS', tsEnc.encoding],
    ['Python', pyEnc.encoding],
  ]) {
    if (e && !approved.includes(e) && !unapproved.some((u) => u.enc === e)) {
      unapproved.push({ side, enc: e })
    }
  }
  const encodingUnapproved =
    unapproved.length === 0
      ? null
      : `编码不在已批准候选(${approved.join(' / ')})内:${unapproved.map((u) => `${u.side}=${u.enc}`).join(', ')} —— 两端即使彼此相等也不记绿(p50k_base 这类降级兜底表不是主动选择)`

  const base = {
    rc: 0,
    verdict: 'aligned',
    drifts: [],
    reverseDrifts: [],
    fixtureDrifts: [],
    encodingDrift: null,
    encodingUnapproved: null,
    undetermined: [],
  }
  const verdictOf = (rc, v, extra = {}) => ({
    ...base,
    rc,
    verdict: v,
    drifts,
    reverseDrifts,
    fixtureDrifts,
    encodingDrift,
    encodingUnapproved,
    ...extra,
  })
  if (undetermined.length > 0) return verdictOf(2, 'undetermined', { undetermined })
  const totalChecked = positive.checked + reverse.checked + fixture.checked
  if (totalChecked === 0) {
    return verdictOf(2, 'undetermined', {
      undetermined: ['一例都没判到(正向/反向/夹具全空)⇒ 不出具"一致"的合格证'],
    })
  }
  if (drifts.length > 0 || reverseDrifts.length > 0 || encodingDrift || encodingUnapproved) {
    return verdictOf(1, 'drift', { undetermined: [] })
  }
  return verdictOf(0, 'aligned')
}

/**
 * 取判定面内容:HEAD blob(缺省)/ 索引 blob(--staged)/ 工作树(--worktree)。取不到不回落。
 *
 * `catBatch` 的spec 必须是 `<rev>:<path>` 形态(`HEAD:foo` / `:foo` = 索引),
 * 这与 `check-line-split-parity.mjs` 同一份形状;漏掉前缀会静默取到空串 ——
 * 于是 C1 两面都"解析不到声明",门折成 exit 2,看起来像"环境坏了"而不是"前缀写错了"。
 */
export function readBothContents(root, face) {
  if (face === 'worktree') {
    const get = (rel) => readWorktreeFile(root, rel)
    const miss = [TS_REL, PY_REL, TUNABLES_REL].filter((r) => typeof get(r) !== 'string')
    if (miss.length > 0) throw new Undetermined(`worktree 面取不到 ${miss.join(' / ')}`)
    return new Map([[TS_REL, get(TS_REL)], [PY_REL, get(PY_REL)], [TUNABLES_REL, get(TUNABLES_REL)], [FIXTURE_REL, get(FIXTURE_REL)]])
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const rels = [TS_REL, PY_REL, TUNABLES_REL, FIXTURE_REL]
  const specs = rels.map((r) => `${prefix}${r}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 26 })
  return new Map(specs.map((s, i) => [rels[i], got.get(s) ?? null]))
}

/** 从夹具取 24 条消息的正文(C3 反向锁语料)。取不到/结构不符 ⇒ 未判定,不静默跳过。 */
export function fixtureProbes(fixtureText) {
  if (typeof fixtureText !== 'string') {
    return { probes: [], undetermined: `${FIXTURE_REL} 在该面取不到 ⇒ 反向锁语料缺失` }
  }
  let json
  try {
    json = JSON.parse(fixtureText)
  } catch (e) {
    return { probes: [], undetermined: `${FIXTURE_REL} 解析失败:${(e && e.message) || e}` }
  }
  const msgs = json && json.input && json.input.messages
  if (!Array.isArray(msgs) || msgs.length === 0) {
    return { probes: [], undetermined: `${FIXTURE_REL} 的 input.messages 取不到或为空` }
  }
  const probes = []
  msgs.forEach((m, i) => {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    if (typeof text === 'string' && text.length > 0) probes.push({ name: `fixture-${i + 1}`, text })
  })
  return { probes, undetermined: probes.length === 0 ? `${FIXTURE_REL} 里没抽出任何正文` : null }
}

// ── 报告 ───────────────────────────────────────────────────────────────

function report(ctx) {
  const { face, tsEnc, pyEnc, positive, reverse, fixture, d } = ctx
  const L = []
  L.push('')
  L.push('════════ 跨端 BPE 词表对账(G-1058650 残余②)════════')
  L.push(`取材面:**${face}**(C1 声明层与 C2/C3 行为层判的是同一个面 —— 行为层把该面文本落盘后执行)`)
  L.push('')
  L.push('【C1 声明层】两端声明用同一套编码?')
  L.push(tsEnc.undetermined ? `  TS     :未判定 —— ${tsEnc.undetermined}` : `  TS     : ${tsEnc.encoding}(${tsEnc.evidence})`)
  L.push(pyEnc.undetermined ? `  Python :未判定 —— ${pyEnc.undetermined}` : `  Python : ${pyEnc.encoding}(${pyEnc.evidence})`)
  L.push(d.encodingDrift ? `  ❌ ${d.encodingDrift}` : '  ✅ 两端声明的编码标识符相等')
  L.push(
    d.encodingUnapproved
      ? `  ❌ ${d.encodingUnapproved}`
      : `  ✅ 约定编码落在已批准候选(${APPROVED_ENCODINGS.join(' / ')})内`,
  )

  L.push('')
  L.push('【C2 行为层正向锁】能区分两张词表的探针,两端实跑生产估算器逐值比对')
  L.push(`  判到 ${positive.checked}/${PROBES.length} 条`)
  if (d.drifts.length === 0) {
    L.push('  ✅ 全部同值')
  } else {
    L.push(`  ❌ ${d.drifts.length} 条分歧:`)
    for (const x of d.drifts) {
      const shown = x.text.length > 48 ? `${x.text.slice(0, 48)}…` : x.text
      L.push(`     · ${x.name}  TS=${x.ts} / Python=${x.py}   文本=${JSON.stringify(shown)}`)
    }
  }

  const reverseClean = d.reverseDrifts.length === 0
  L.push('')
  L.push('【C3 反向锁】不同编码下取值相同的文本,不得被报成分歧')
  L.push(`  等值形态探针:判到 ${reverse.checked}/${REVERSE_PROBES.length} 条`)
  L.push(
    `  ${reverseClean ? '✅ 反向锁全同值(没被误报成分歧 —— 防空转生效)' : `❌ 反向锁出现 ${d.reverseDrifts.length} 条分歧:等值文本竟报出不同值,请查实现`}`,
  )
  for (const x of d.reverseDrifts) L.push(`     · ${x.name}  TS=${x.ts} / Python=${x.py}   文本=${JSON.stringify(x.text.length > 40 ? `${x.text.slice(0, 40)}…` : x.text)}`)
  L.push('')
  L.push(`【既有夹具】${FIXTURE_REL} —— **历史语料,不是一致性证据**(判到 ${fixture.checked}/${fixture.total} 条)`)
  L.push('  ⚠️ HEAD 那 24 条的同值是**巧合**:整批落在两张表的等值子集上,踩不到任何分歧词。')
  L.push('     它证明的只是"这批文本没踩到分歧词",**证明不了跨端一致**。别拿它当一致性证明。')
  if (d.fixtureDrifts.length === 0) {
    L.push(`  ℹ️ 本面这 ${fixture.total} 条恰好也全同值 —— 同样是巧合,不是"已证明一致"。`)
  } else {
    L.push(`  📌 本面有 ${d.fixtureDrifts.length} 条夹具消息**真的分叉**了 —— 这是对本票缺陷的独立印证:`)
    for (const x of d.fixtureDrifts) {
      const shown = x.text.length > 40 ? `${x.text.slice(0, 40)}…` : x.text
      L.push(`     · ${x.name}  TS=${x.ts} / Python=${x.py}   文本=${JSON.stringify(shown)}`)
    }
  }

  if (d.verdict === 'undetermined') {
    L.push('')
    L.push('【未判定】既不记绿也不冒红:')
    for (const u of d.undetermined) L.push(`  · ${u}`)
  }

  L.push('')
  L.push(
    d.verdict === 'aligned'
      ? '✅ 结论:两端在判到的所有探针上同值。'
      : d.verdict === 'drift'
        ? '❌ 结论:两端 BPE 词表分歧(见上)。'
        : '⚠️ 结论:未判定。',
  )
  L.push('')
  return L.join('\n')
}

// ── 主流程 ──────────────────────────────────────────────────────────────

/**
 * 一次完整判据运行。**按给定文本取材**,不自己读文件 —— 这样自检的变异对照可以在内存里
 * 造出"改过编码"的两侧文本,喂进同一个判据,而不必改磁盘上的仓库(改仓库＝拿工作树当实验动物)。
 *
 * **两层都判同一个面**:C1 读 `contents` 的文本,C2 把**同一份文本**落盘后执行 ——
 * 于是不存在"声明读 HEAD、行为跑工作树"的错面(见 `materializeTsFace` 的理由)。
 * 要做变异对照,调用方只需把变异后的文本与变异后的落盘体一起传进来。
 */
export async function evaluate({
  root,
  face,
  contents,
  readPkgDir,
  resolveBareEntry,
  tunablesText,
  scratch,
  execTsText = null,
  pythonPath = findPython(root),
}) {
  const tsText = contents.get(TS_REL)
  const pyText = contents.get(PY_REL)

  const tsEncRaw =
    typeof tsText === 'string' ? parseTsEncoding(tsText, readPkgDir) : { ok: false, why: `${TS_REL} 在该面取不到` }
  const tsEnc = tsEncRaw.ok ? { encoding: tsEncRaw.encoding, evidence: tsEncRaw.evidence } : { undetermined: tsEncRaw.why }

  // C1 的 Python 半边走 AST(散文里的 get_encoding 不算声明 —— 见 pythonAstProgram 注释)
  let pyEncRaw
  if (typeof pyText !== 'string') {
    pyEncRaw = { ok: false, why: `${PY_REL} 在该面取不到` }
  } else {
    const astRun = runPyAst({ pythonPath, pyText, scratch })
    pyEncRaw = astRun.undetermined ? { ok: false, why: astRun.undetermined } : parsePyEncodingFromAst(astRun.ast)
  }
  const pyEnc = pyEncRaw.ok ? { encoding: pyEncRaw.encoding, evidence: pyEncRaw.evidence } : { undetermined: pyEncRaw.why }

  const fixture = fixtureProbes(contents.get(FIXTURE_REL))
  const positiveProbes = PROBES
  const reverseProbes = REVERSE_PROBES
  const allProbes = [...positiveProbes, ...reverseProbes, ...fixture.probes]

  // C2:把被审面落盘后执行(声明与行为同面)
  let tsRun
  let pyRun
  if (typeof tsText !== 'string') {
    tsRun = { undetermined: `${TS_REL} 在该面取不到 ⇒ C2 无从执行` }
  } else if (typeof pyText !== 'string') {
    tsRun = { undetermined: `${PY_REL} 在该面取不到 ⇒ C2 无从执行` }
  } else if (typeof tunablesText !== 'string') {
    tsRun = { undetermined: 'TUNABLES_REL 在该面取不到 ⇒ Python 面落不完整(缺相对 import 的依赖)' }
  } else {
    const tsEntry = materializeTsFace(execTsText || tsText, scratch, resolveBareEntry)
    const pyFace = materializePyFace(pyText, tunablesText, scratch)
    tsRun = await runTsSide(tsEntry, allProbes)
    pyRun = runPythonSide({
      pythonPath,
      probes: allProbes,
      importRoot: pyFace.importRoot,
      mod: pyFace.mod,
      scratch,
    })
  }

  const bucket = (probes) => {
    if (tsRun.undetermined) return { checked: 0, drifts: [], undetermined: [tsRun.undetermined] }
    if (pyRun.undetermined) return { checked: 0, drifts: [], undetermined: [pyRun.undetermined] }
    return compareProbes(probes, tsRun, pyRun)
  }

  const positive = bucket(positiveProbes)
  const reverse = bucket(reverseProbes)
  const fixtureRun = bucket(fixture.probes)
  if (fixture.undetermined) fixtureRun.undetermined.push(fixture.undetermined)

  const d = decide({ tsEnc, pyEnc, positive, reverse, fixture: fixtureRun })
  return {
    face,
    tsEnc,
    pyEnc,
    positive,
    reverse,
    fixture: { ...fixtureRun, total: fixture.probes.length },
    pyEncoding: pyRun && pyRun.ok ? pyRun.encoding : null,
    pyRunUndetermined: (pyRun && pyRun.undetermined) || null,
    d,
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const root = (() => {
    const i = argv.indexOf('--root')
    return i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : ROOT
  })()

  if (argv.includes('--self-test')) return selfTest(root)

  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    return 2
  }
  const face = sel.face

  let contents
  try {
    contents = readBothContents(root, face)
  } catch (e) {
    console.error(`❌ 未判定:${e instanceof Undetermined ? e.message : String((e && e.message) || e)}`)
    return 2
  }

  const pkgDir = path.join(root, 'packages', 'context-compaction', 'node_modules', 'gpt-tokenizer')
  const readPkgDir = () => (existsSync(pkgDir) ? pkgDir : null)
  // scratch 里没有 node_modules,裸说明符解析不到 ⇒ 换成同一模块的绝对 file URL(语义不变)
  const resolveBareEntry = () => {
    const req = createRequire(path.join(root, 'packages', 'context-compaction', 'package.json'))
    return req.resolve('gpt-tokenizer')
  }

  let scratch = null
  let ctx
  try {
    scratch = mkScratch('ihui-bpe-parity-')
    ctx = await evaluate({
      root,
      face,
      contents,
      readPkgDir,
      resolveBareEntry,
      tunablesText: contents.get(TUNABLES_REL),
      pythonPath: findPython(root),
      scratch,
    })
  } catch (e) {
    console.error(`❌ 判据自身异常:${(e && e.stack) || e}`)
    return 2
  } finally {
    cleanupScratch(scratch)
  }

  console.log(report(ctx))

  if (ctx.pyEncoding) {
    console.log(`Python 侧运行时实际使用的 encoding:${ctx.pyEncoding}`)
    if (ctx.tsEnc.encoding && ctx.tsEnc.encoding !== ctx.pyEncoding) {
      console.log('  ⚠️ 与 TS 声明的表不同 —— 这正是本门要报的分歧本体。')
    }
  }
  if (ctx.pyRunUndetermined) {
    console.log('')
    console.log('【Python 侧未跑通】')
    for (const u of [ctx.pyRunUndetermined]) console.log(`  · ${u}`)
  }
  console.log('「两端该统一到哪张表」属替真实业务选模型 —— 本门不替你选,只把分歧摆出来等人拍板。')
  return ctx.d.rc
}

// ── 自检(含两次变异对照) ───────────────────────────────────────────────

/**
 * 变异对照的前提是**注入真的生效** —— 否则"变异后仍全绿"什么都不能证明。
 * 故每次变异都先 assert 变异文本确实变了(而不是"我改了呀"),再喂判据。
 */
function makeFakePkg(entryBody) {
  const files = {
    'package.json': JSON.stringify({ version: '9.9.9', module: 'esm/main.js' }),
    'esm/main.js': entryBody,
  }
  return (absPath) => {
    const key = Object.keys(files).find((k) => absPath.endsWith(k.split('/').join(path.sep)))
    if (!key) throw new Error(`假包里没有 ${absPath}`)
    return files[key]
  }
}

/** 自检用的便捷包装:现取 scratch 跑一次 AST(供 S3z 那种"必须真跑"的断言用)。 */
function pythonAstResultOf(pyText) {
  const scratch = mkScratch('ihui-bpe-ast-')
  try {
    return runPyAst({ pythonPath: findPython(ROOT), pyText, scratch })
  } finally {
    cleanupScratch(scratch)
  }
}

/**
 * 清理 scratch,**绝不因清理失败而改变判据结论**。
 *
 * 为什么要专门包一层(实测踩到,不是假想):本机safe-delete shim 对**一次轮内累计删除文件数**
 * 有阈值(实测 54 > 50 触发 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`),而本门每跑一次要删
 * 几十个临时文件。于是 `rmScratch` 抛错 → 从 `finally` 冒出去 → 把一个**本该 rc=1 的红**
 * 变成 rc=2 的"未判定"。那正是本仓最忌的失效型:**环境噪声吞掉检查结论**。
 * 清理失败只该在 stderr 留一句,不该改 exitCode。
 */
function cleanupScratch(dir) {
  if (!dir) return
  try {
    rmScratch(dir)
  } catch (e) {
    console.error(`⚠️ 临时目录清理未执行 ${dir}:${(e && e.message) || e}(不影响判据结论)`)
  }
}

async function selfTest(root) {
  const cases = []
  const t = (name, ok, got) => cases.push({ name, ok: ok === true, got })

  // ── S1:裸主入口解析必须向包现读,不得硬编码"主入口=o200k"那张表 ──
  {
    const r = resolveBareEntrypointEncoding('/pkg', makeFakePkg("export { default } from './encoding/o200k_base.js';\n"), 0)
    t('S1a 假包主入口 → o200k_base', r.ok && r.encoding === 'o200k_base', r)
  }
  {
    // S1 的防空转 companion:换掉主入口,解析结果必须跟着变。
    const r = resolveBareEntrypointEncoding('/pkg', makeFakePkg("export { default } from './encoding/cl100k_base.js';\n"), 0)
    t('S1b 假包主入口换成 cl100k ⇒ 解析跟着变(证明没硬编码那张表)', r.ok && r.encoding === 'cl100k_base', r)
  }
  {
    const r = resolveBareEntrypointEncoding('/pkg', makeFakePkg('export const x = 1;\n'), 0)
    t('S1c 主入口里没有 encoding 再导出 ⇒ 判不出(不猜)', r.ok === false, r)
  }

  // ── S2:TS import 解析四形态 ──
  {
    // 裸主入口**必须**去问包 —— 用一个"被调用就记账"的出口验证确实问了。
    let asked = 0
    const r0 = parseTsEncoding("import { encode } from 'gpt-tokenizer'\n", () => {
      asked++
      return null // 装作"包不在" ⇒ 判不出;若压根没问包,r0 就会是 ok
    })
    t('S2a 裸主入口确实去问包(asked=1),包缺失时判不出', asked === 1 && r0.ok === false, { asked, r0 })
  }
  {
    // 走**真包**(node_modules/gpt-tokenizer):断言的是"面对真安装,裸主入口解析出的就是
    // o200k_base" —— 即本票缺陷在判定层的读数,不是假包里的自洽。
    const pkgDir = path.join(root, 'packages', 'context-compaction', 'node_modules', 'gpt-tokenizer')
    if (!existsSync(pkgDir)) {
      t('S2b 裸主入口 + 真包 ⇒ o200k_base', false, 'gpt-tokenizer 未安装,无法取证')
    } else {
      const r = parseTsEncoding("import { encode } from 'gpt-tokenizer'\n", () => pkgDir)
      t('S2b 裸主入口 + 真包 ⇒ o200k_base', r.ok && r.encoding === 'o200k_base', r)
    }
  }
  {
    const r = parseTsEncoding("import { encode } from 'gpt-tokenizer/encoding/cl100k_base'\n", () => null)
    t('S2c 显式 /encoding/cl100k_base ⇒ cl100k_base(不问包)', r.ok && r.encoding === 'cl100k_base', r)
  }
  {
    const r = parseTsEncoding("// 这里提到 'gpt-tokenizer/encoding/p50k_base' 只是注释\nconst x = 1\n", () => null)
    t('S2d 注释里的说明符不构成声明 ⇒ 判不出', r.ok === false, r)
  }
  {
    // S2 的**散文回归锁**(实测踩过):头注里写一句与真import **一模一样**的散文,
    // 不剥注释就会被数成"从 2 个说明符导入" ⇒ 判不出(实测真发生过)。
    // 散文那句必须被忽略,C1 仍只认真import 那一处。
    const src = [
      "// 头注散文:import { encode } from 'gpt-tokenizer' —— 这不是声明,只是陈述",
      "import { encode } from 'gpt-tokenizer/encoding/cl100k_base'",
      '',
      'export const x = 1',
    ].join('\n')
    const r = parseTsEncoding(src, () => null)
    t(
      'S2e 头注散文与真 import 同形 ⇒ 只认真 import(不判"多个说明符")',
      r.ok && r.encoding === 'cl100k_base',
      r,
    )
  }

  // ── S3:Python 侧 AST 解析(主表 / except 兜底 / 不可判) ──
  //
  // 这一组构造的是 **AST 结果**(纯函数入口),不跑 Python;真跑 AST 的那条由 S3e 取证。
  {
    const r1 = parsePyEncodingFromAst({
      calls: [{ name: 'cl100k_base', lineno: 92, fallback: false }],
      primary: { name: 'cl100k_base', lineno: 92, fallback: false },
      fallbacks: [],
    })
    t('S3a 字面量实参 ⇒ cl100k_base', r1.ok && r1.encoding === 'cl100k_base', r1)

    const r2 = parsePyEncodingFromAst({
      calls: [{ name: null, lineno: 92, fallback: false }],
      primary: { name: null, lineno: 92, fallback: false },
      fallbacks: [],
    })
    t('S3b 变量实参(名字取不到)⇒ 判不出(不猜)', r2.ok === false, r2)

    const r3 = parsePyEncodingFromAst({
      calls: [
        { name: 'cl100k_base', lineno: 92, fallback: false },
        { name: 'p50k_base', lineno: 95, fallback: true },
      ],
      primary: { name: 'cl100k_base', lineno: 92, fallback: false },
      fallbacks: [{ name: 'p50k_base', lineno: 95, fallback: true }],
    })
    t(
      'S3c except 兜底被登记为 fallbacks,主表仍取非 except 那处',
      r3.ok && r3.fallbacks.length === 1 && r3.fallbacks[0] === 'p50k_base',
      r3,
    )

    // 只有 except 兜底、没有主表 ⇒ 判不出(不能把兜底当声明)
    const r4 = parsePyEncodingFromAst({
      calls: [{ name: 'p50k_base', lineno: 95, fallback: true }],
      primary: null,
      fallbacks: [{ name: 'p50k_base', lineno: 95, fallback: true }],
    })
    t('S3d 全在 except 里(无主表)⇒ 判不出', r4.ok === false, r4)

    const r5 = parsePyEncodingFromAst({ calls: [], primary: null, fallbacks: [] })
    t('S3e 找不到任何 get_encoding 调用 ⇒ 判不出', r5.ok === false, r5)
  }

  // ── S3z:回归锁 —— **散文(docstring)里的 get_encoding 不构成声明** ──
  //
  // 这条是本门自查出来的真缺陷,不是假想:改正后的模块头注里写了一句
  // `tiktoken.get_encoding("cl100k_base")`(陈述事实),而当时的正则扫文本,
  // 把那句**散文**当成了"第 0 处实参"—— 那等于"锚注释文本",正是本判据禁止的形态。
  // 正则版已换成 AST;这条锁住"不许退回正则"。
  {
    const py = readWorktreeFile(root, PY_REL)
    if (typeof py !== 'string') {
      t('S3z 散文不构成声明(模块头注里那句 get_encoding 不是声明)', false, '取不到源文件')
    } else {
      // 散文里出现多次该字样,真实调用只在函数体内 —— AST 必须只认后者。
      const ast = pythonAstResultOf(py)
      if (!ast.ok) {
        t('S3z 散文不构成声明(模块头注里那句 get_encoding 不是声明)', false, ast.undetermined)
      } else {
        const got = parsePyEncodingFromAst(ast.ast)
        const realLines = ast.ast.calls.filter((c) => !c.fallback).map((c) => c.lineno)
        // 声明必须落在真实调用行上;而头注里那句所在的行号必然更早(module docstring 在文件顶部)
        const declLine = ast.ast.primary ? ast.ast.primary.lineno : -1
        const headerProse = py.slice(0, py.indexOf('"""', py.indexOf('"""') + 3))
        const proseHasIt = headerProse.includes('get_encoding("')
        t(
          `S3z 散文不构成声明:头注散文含该字样=${proseHasIt},AST 主表落在第 ${declLine} 行(调用点行号=${realLines.join('/')})`,
          got.ok && got.encoding === 'cl100k_base' && declLine > 60,
          got.ok ? `encoding=${got.encoding} declLine=${declLine}` : got.why,
        )
      }
    }
  }

  // ── S4:定级三态 + C1b 语义 ──
  {
    const ok = { checked: 3, drifts: [], undetermined: [] }
    const a = decide({
      tsEnc: { encoding: 'o200k_base' },
      pyEnc: { encoding: 'o200k_base' },
      positive: ok,
      reverse: ok,
      fixture: ok,
    })
    t('S4a 同编码且无分歧 ⇒ 绿(aligned)', a.rc === 0 && a.verdict === 'aligned', a)

    const b = decide({
      tsEnc: { encoding: 'o200k_base' },
      pyEnc: { encoding: 'cl100k_base' },
      positive: ok,
      reverse: ok,
      fixture: ok,
    })
    t('S4b 标识符不同 ⇒ 红(即便行为层没跑出分歧)', b.rc === 1 && !!b.encodingDrift, b)

    const c = decide({
      tsEnc: { undetermined: '取不到' },
      pyEnc: { encoding: 'cl100k_base' },
      positive: { checked: 0, drifts: [], undetermined: [] },
      reverse: ok,
      fixture: ok,
    })
    t('S4c 有一面未判定 ⇒ exit 2(既不记绿也不冒红)', c.rc === 2 && c.verdict === 'undetermined', c)

    const e = decide({
      tsEnc: { encoding: 'o200k_base' },
      pyEnc: { encoding: 'o200k_base' },
      positive: { checked: 0, drifts: [], undetermined: [] },
      reverse: { checked: 0, drifts: [], undetermined: [] },
      fixture: { checked: 0, drifts: [], undetermined: [] },
    })
    t('S4d 一例都没判到 ⇒ 判死(exit 2)', e.rc === 2, e)

    const f = decide({
      tsEnc: { encoding: 'o200k_base' },
      pyEnc: { encoding: 'o200k_base' },
      positive: ok,
      reverse: { checked: 2, drifts: [{ name: 'json-shape', ts: 10, py: 11 }], undetermined: [] },
      fixture: ok,
    })
    t('S4e 反向锁侧漂移也算漂移(不吞掉)', f.rc === 1 && f.reverseDrifts.length === 1, f)

    // C1b 的防空转 companion:两端**都**是未批准的表、且彼此相等 ⇒ 仍须判红。
    // 这是 S7d 的纯函数版本(不依赖落盘),钉住"相等 ≠ 放行"这条语义。
    const g = decide({
      tsEnc: { encoding: 'p50k_base' },
      pyEnc: { encoding: 'p50k_base' },
      positive: ok,
      reverse: ok,
      fixture: ok,
    })
    t('S4f 两端相等但都是未批准表 ⇒ 判红(C1b 防空转)', g.rc === 1 && !!g.encodingUnapproved, g)

    // 反向:C1b 不得把"已批准的另一张真表"也判红 —— 否则它就是一根硬编码 o200k 的锁,
    // 等于本门替人拍板选了模型(越权)。
    const h = decide({
      tsEnc: { encoding: 'cl100k_base' },
      pyEnc: { encoding: 'cl100k_base' },
      positive: ok,
      reverse: ok,
      fixture: ok,
    })
    t('S4g 两端同为 cl100k(已批准的另一张)⇒ 不因 C1b 判红', h.rc === 0 && h.encodingUnapproved === null, h)
  }

  // ── S5/S6:语料本身的性质(用真包实测,证明探针不是空转的) ──
  {
    const req = createRequire(path.join(root, 'packages', 'context-compaction', 'package.json'))
    const o = req('gpt-tokenizer/encoding/o200k_base')
    const c = req('gpt-tokenizer/encoding/cl100k_base')
    const detail = PROBES.map((p) => `${p.name}:${o.encode(p.text).length}/${c.encode(p.text).length}`)
    const disc = PROBES.filter((p) => o.encode(p.text).length !== c.encode(p.text).length)
    t(
      `S5 正向探针 ${disc.length}/${PROBES.length} 条真能区分 o200k/cl100k(逐条实测)`,
      disc.length === PROBES.length,
      detail.join(' '),
    )
    const revDiff = REVERSE_PROBES.filter((p) => o.encode(p.text).length !== c.encode(p.text).length)
    t(
      `S6 反向锁 ${REVERSE_PROBES.length} 条在 o200k/cl100k 下逐条同值(防空转能力已验证)`,
      revDiff.length === 0,
      revDiff.map((x) => x.name).join(',') || '(全部同值)',
    )
  }

  // ── S7:两次变异对照(判据**真跑**变异体;先验注入生效) ──
  //
  // 变异体是真会被执行的:`evaluate` 自己把所给的面落盘后执行
  // (`materializeTsFace` / `materializePyFace`),所以同一份变异文本既是 C1 的声明来源、
  // 也是 C2 的执行体 —— 不存在"声明改了、行为跑的是原件"那种错面,那种错面即便判红
  // 也证明不了判据有效(它可能只是 C1 在比字符串)。
  let scratch = null
  try {
    const tsReal = readWorktreeFile(root, TS_REL)
    const pyReal = readWorktreeFile(root, PY_REL)
    const tunReal = readWorktreeFile(root, TUNABLES_REL)
    const fxReal = readWorktreeFile(root, FIXTURE_REL)
    if ([tsReal, pyReal, tunReal, fxReal].some((x) => typeof x !== 'string')) {
      t('S7 变异对照前置:两侧源 + tunables + 夹具都取到', false, '取不到源文件')
    } else {
      scratch = mkScratch('ihui-bpe-parity-selftest-')
      const pkgDir = path.join(root, 'packages', 'context-compaction', 'node_modules', 'gpt-tokenizer')
      const req = createRequire(path.join(root, 'packages', 'context-compaction', 'package.json'))

      // TS 变异文本:裸主入口 → 目标编码的绝对 file URL(scratch 里没有 node_modules),
      // 并剥掉 `import type` 行(纯类型导入,运行时不参与,留着多一处无谓依赖)。
      //
      // ⚠ 用**最后**一处而不是第一处:头注里有一句散文
      // `import { encode } from 'gpt-tokenizer'`(陈述事实),replace() 默认只换第一处 ⇒ 会改到散文、
      // 真import 原封不动 ⇒ "变异注入生效"是假的。锚最后一处才是真import。
      // 另备一份"声明面"文本:变异体的编码以绝对 URL 形态出现,C1 解析不出标识符,
      // 所以 C1 那侧要读能解析出标识符的形态,否则测到的会是"未判定"而不是想测的漂移。
      const makeTsMut = (encName) => {
        const abs = pathToFileURL(req.resolve(`gpt-tokenizer/encoding/${encName}`)).href
        const replaceLast = (text, from, to) => {
          const i = text.lastIndexOf(from)
          return i === -1 ? null : text.slice(0, i) + to + text.slice(i + from.length)
        }
        const execText = replaceLast(tsReal, "from 'gpt-tokenizer'", `from ${JSON.stringify(abs)}`).replace(
          /^import type .*$/gm,
          '',
        )
        if (execText === tsReal || !execText.includes(abs)) return null
        const declText = replaceLast(tsReal, "from 'gpt-tokenizer'", `from 'gpt-tokenizer/encoding/${encName}'`)
        if (!declText || declText === tsReal) return null
        return { execText, declText }
      }
      // Python 变异文本:改 get_encoding 的**主表**实参。同样锚**最后一处**(头注散文在文件顶部,
      // 真调用在函数体内),否则会改到散文、真调用原封不动。
      const makePyMut = (encName) => {
        const from = 'tiktoken.get_encoding("cl100k_base")'
        const i = pyReal.lastIndexOf(from)
        if (i === -1) return null
        const text = pyReal.slice(0, i) + `tiktoken.get_encoding("${encName}")` + pyReal.slice(i + from.length)
        if (text === pyReal) return null
        return text
      }

      const common = {
        root,
        face: 'worktree',
        readPkgDir: () => (existsSync(pkgDir) ? pkgDir : null),
        resolveBareEntry: () => req.resolve('gpt-tokenizer'),
        tunablesText: tunReal,
        pythonPath: findPython(root),
      }
      const contentsOf = (ts, py, fx) =>
        new Map([
          [TS_REL, ts],
          [PY_REL, py],
          [TUNABLES_REL, tunReal],
          [FIXTURE_REL, fx],
        ])
      // execTsText 存在时用它落盘执行(C2),不存在则用声明面文本本身
      const runOne = async (tsText, pyText, execTsText) => {
        const dir = mkScratch('ihui-bpe-parity-run-')
        try {
          return await evaluate({
            ...common,
            scratch: dir,
            contents: contentsOf(tsText, pyText, fxReal),
            execTsText: execTsText || tsText,
          })
        } finally {
          cleanupScratch(dir)
        }
      }

      // ── 变异①:TS 侧改成与 Python 一致(cl100k)⇒ 必须转绿 ──
      const m1 = makeTsMut('cl100k_base')
      t('S7a 变异①注入生效(TS 变异文本含 cl100k 绝对 URL 且不同于原文)', m1 !== null, m1 === null ? '注入失败' : 'ok')
      if (m1) {
        const r = await runOne(m1.declText, pyReal, m1.execText)
        t(
          `S7b 变异①真跑:TS→cl100k(与 Python 一致)⇒ 转绿(rc=${r.d.rc},C1=${r.tsEnc.encoding},drifts=${r.d.drifts.length},und=${r.d.undetermined.length})`,
          r.d.rc === 0 && r.d.verdict === 'aligned' && r.d.drifts.length === 0 && r.tsEnc.encoding === 'cl100k_base',
          `rc=${r.d.rc} C1=${r.tsEnc.encoding} drifts=${r.d.drifts.length} und=${r.d.undetermined.join(';')}`,
        )
      }

      // ── 变异②:两端**同时**改成第三张表(p50k)⇒ 必须**仍判红**(防"只比一个方向") ──
      const m2 = makeTsMut('p50k_base')
      const py2 = makePyMut('p50k_base')
      t(
        'S7c 变异②注入生效(两端变异文本都已不同于原文)',
        m2 !== null && py2 !== null,
        `ts=${m2 === null ? 'FAIL' : 'ok'} py=${py2 === null ? 'FAIL' : 'ok'}`,
      )
      if (m2 && py2) {
        const r = await runOne(m2.declText, py2, m2.execText)
        // 变异②的**诚实读数**:两端都真跑 p50k 时,它们的行为层是彼此**一致**的
        // (所以 drifts=0 是对的,不是漏判)。仍判红靠的是 C1b ——
        // "约定编码不在已批准候选内"。这正是纯相等判据的空转形态:
        // 两端一起退到降级兜底表 ⇒ 彼此相等 ⇒ 纯相等判据记绿 ⇒ 门被绕开。
        // 所以这里断言"仍判红且理由是 C1b",而不是硬塞一个 drifts>0。
        const encStillEqual = r.d.encodingDrift === null
        t(
          `S7d 变异②真跑:两端同改 p50k(声明彼此相等=${encStillEqual},行为一致故 drifts=${r.d.drifts.length})⇒ 仍判红且理由是 C1b`,
          r.d.rc === 1 && encStillEqual && r.d.drifts.length === 0 && r.d.encodingUnapproved !== null,
          `rc=${r.d.rc} encDrift=${r.d.encodingDrift} unapproved=${r.d.encodingUnapproved} drifts=${r.d.drifts.length}`,
        )
      }

      // ── S7e:真实现状(不变异)必须判红 —— 证明这台尺子在今天的仓上不是恒绿 ──
      const r = await runOne(tsReal, pyReal, null)
      t(
        `S7e 真实现状:两端 o200k vs cl100k ⇒ 判红(rc=${r.d.rc},drifts=${r.d.drifts.length},und=${r.d.undetermined.length})`,
        r.d.rc === 1 && r.d.encodingDrift !== null && r.d.drifts.length > 0,
        `rc=${r.d.rc} encDrift=${r.d.encodingDrift} drifts=${r.d.drifts.length} und=${r.d.undetermined.join(';')}`,
      )
    }
  } finally {
    cleanupScratch(scratch)
  }

  let failed = 0
  for (const c of cases) {
    if (!c.ok) failed++
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : `  实得:${JSON.stringify(c.got)}`}`)
  }
  console.log(`--self-test: ${cases.length - failed}/${cases.length} 通过`)
  return failed ? 1 : 0
}

export const __test__ = {
  TS_REL,
  PY_REL,
  TUNABLES_REL,
  FIXTURE_REL,
  PROBES,
  REVERSE_PROBES,
  APPROVED_ENCODINGS,
  resolveBareEntrypointEncoding,
  parseTsEncoding,
  parsePyEncodingFromAst,
  pythonAstProgram,
  runPyAst,
  pythonProgram,
  findPython,
  compareProbes,
  decide,
  fixtureProbes,
  readBothContents,
  materializeTsFace,
  materializePyFace,
  evaluate,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ [bpe-encoding-parity] 脚本自身异常:${(e && e.stack) || e}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
