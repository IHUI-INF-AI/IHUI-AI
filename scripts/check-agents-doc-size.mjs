// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AGENTS.md 体积守门(守门 207,blocking;**无逃生舱**,见下方「为什么没有 skipEnv」)。
 *
 * 为什么要有这道门(实测锚点,不是推测):
 *   AGENTS.md 被客户端**逐字注入每一轮对话**,它的大小就是每轮固定上下文账单的大头。
 *   2026-10-14 本机同一份会话日志(`usage.context_usage_ratio`)实测:
 *     · 文件 1,261,607 字节 ⇒ ratio = 1.000(新会话第 1 轮即 100%,没有任何历史就被自动压缩 —— 机主报的故障)
 *     · 压缩后 55,405 字节 ⇒ ratio = 0.079
 *   每字节对上下文的贡献近似线性 ⇒ 1.26 MB ≈ 打满 100%,79.8 KB ≈ 6.3%。
 *   预算取 96,000 字节(≈ 7.6%)就是从这个锚点推出来的,不是拍的整数。
 *
 * 装车形态(为什么注册条目只有 1 行,而不是 gate-registry-insert 生成的 20 行块):
 *   `scripts/guardian-runner.mjs` 实测 5998 行,而守门 103 的 C1 判据给单文件上限 6000 行 ⇒ 整个注册表
 *   只剩 2 行余量。按 `gate-registry-insert.mjs` 的常规形态注册(注释+对象+多行字段+闭合 = 20 行)会把
 *   它顶到 6019 行,当场造出一道**与提交者本次内容无关的全仓恒红门**(§12e:那种门的唯一结局是逼人
 *   `--no-verify`,连带废掉整条守门链)—— 2026-10-14 实测踩过,那 20 行已按 object-space-land 撤回。
 *   所以本门注册条目压成 1 行紧凑对象(id/script/args/mode/skipEnv/stagedTriggers 同在一行,
 *   `args: []` **不可省** —— 执行循环是 `[...check.args]` 展开,缺它 runner 当场 TypeError)。
 *   **C1 的行数口径现读为 `text.split('\n').length`,而该文件无尾换行 ⇒ 比 `wc -l` 多 1**:
 *   接线后实测 split=6000 / wc=5999,即**余量 0**(判据是 `> 6000`,所以此刻绿)。任何人在该文件
 *   再加一行(含把本门改回常规 20 行形态)都会当场顶红全仓 —— 根因(注册表该按域拆分)已登记台账。
 *   另一颗雷:`gate-registry-insert.mjs` 与 R8/R6/192/`gen-doc-numbers` 都按「id 独占一行」锚定解析,
 *   看不见本门这行里的 `id: '207'` ⇒ 下一次工具取号仍会算出 207 并重号(撞 R5)。**取号请显式从 208 起**。
 *   定级依据:存量现读 HEAD 面 AGENTS.md 55,756 字节 < 预算 96,000 ⇒ 违规数 0,§12e 升 blocking 前置已满足。
 *
 * 判面纪律(§0.4):全量判 HEAD blob / `--staged` 判索引 blob / `--worktree` 仅人工逃生舱;
 *   两面旗同给 exit 2;取不到判「无法判定」,绝不回落另一个面(共享工作树副本实测滞后 HEAD)。
 *
 * 失效方向(为什么必须由门拦而不是靠人记):该文件 2026-09-29 约 180 KB、2026-10-14 已 1.26 MB,
 *   15 天涨 7 倍无人察觉 —— 因为 `check-file-size.mjs` 只扫源码且全量档 warn-only,
 *   `check-project-plan-size.mjs` 只管台账,注入面从来没有判据覆盖过。判据失效的表现永远是安静。
 *
 * 为什么没有 skipEnv(2026-11-05 摘除,RP-5 ③):
 *   runner 的 skipEnv 是为「并发会话未提交 WIP 造成工作区级假红」设计的 —— 跳过只免本次退出码。
 *   本门判的是**即将落地的 AGENTS.md 真字节数**(--staged 判索引 blob、全量判 HEAD blob),从不读工作区,
 *   所以那一类假阳性在结构上不存在:超限就是这次真的要把超限内容写进每轮注入面。
 *   跳过它也没有后手门——本门只挂在 stagedTriggers=['AGENTS.md'],无 CI 面、无巡检面,
 *   一旦放过,直到下次有人再改 AGENTS.md 才会被重新发现,而每一轮对话已经为它付过账单。
 *   故超限的唯一出路是裁剪(见 exit 1 提示),不是放行;谁把跳过变量加回注册条目,`judgeRegistration`
 *   与镜像测试的反向例当场判红(证明摘除不是无人察觉)。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { catBatch, selectFace, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'AGENTS.md'
const BUDGET_BYTES = 96000

/**
 * 体积判定唯一实现(镜像测试 import 本函数,不得在测试里复制阈值/算法 —— §22c)。
 * @returns {{face:string,bytes:number,budget:number,over:boolean}|null} 面取不到 ⇒ null ⇒ 调用方 exit 2
 */
export function judgeSize(content, face, budget = BUDGET_BYTES) {
  if (typeof content !== 'string') return null
  const bytes = Buffer.byteLength(content, 'utf8')
  return { face, bytes, budget, over: bytes > budget }
}

/**
 * 注册形态唯一实现(镜像测试 import 本函数,不得在测试里手写正则复制判据 —— §22c)。
 * 门 207 自 2026-11-05 起**无逃生舱**:出现 `skipEnv` 即判红,理由见头注「为什么没有 skipEnv」。
 * 取不到条目文本同样判红(未判定不记绿,§0.3)。
 *
 * 取条目 = **锚点所在行**(本条目按头注要求恒为单行紧凑对象,那条要求来自 runner 6000 行上限)。
 * 不按前后若干字符开窗:窗口会把相邻条目的字段算进来(实测 600 字符窗吃到了下一道门的 skipEnv,
 * 把刚摘干净的条目判成"仍有逃生舱" ⇒ 假红)。
 * @returns {{ok:boolean, reason:string}}
 */
export function judgeRegistration(runnerText) {
  const t = String(runnerText ?? '')
  const anchor = "script: 'check-agents-doc-size.mjs'"
  const i = t.indexOf(anchor)
  if (i < 0) return { ok: false, reason: '注册条目取不到或未接线(未判定不记绿)' }
  const lineStart = t.lastIndexOf('\n', i) + 1
  const lineEnd = t.indexOf('\n', i)
  const entry = t.slice(lineStart, lineEnd < 0 ? t.length : lineEnd)
  if (/skipEnv\s*:/.test(entry)) {
    return { ok: false, reason: '门 207 不得声明 skipEnv:超限唯一出路是裁剪到预算内,不是跳过(§0.10)' }
  }
  if (!/mode:\s*'blocking'/.test(entry)) return { ok: false, reason: "注册条目缺 mode: 'blocking'" }
  if (!/args:\s*\[\]/.test(entry)) return { ok: false, reason: '注册条目缺 args: [](执行循环 [...check.args] 会 TypeError)' }
  if (!/id:\s*'207'/.test(entry)) return { ok: false, reason: "注册条目缺 id: '207'(双引号形态对按单引号解析的判据隐身)" }
  return { ok: true, reason: 'blocking / args / id 齐备,且无 skipEnv' }
}

function readFace(face) {
  if (face === 'worktree') return readWorktreeFile(ROOT, FILE)
  const spec = face === 'staged' ? `:${FILE}` : `HEAD:${FILE}`
  try {
    return catBatch(ROOT, [spec], { timeout: 60000 }).get(spec) ?? null
  } catch {
    return null
  }
}

/** 正向对照:self-test 必须真造出一个超限样本并看到它被判红,否则"判过"是空话。 */
function selfTest() {
  const cases = [
    { name: '预算内判绿', got: judgeSize('a'.repeat(10), 'head', 100), want: false },
    { name: '超限判红', got: judgeSize('a'.repeat(101), 'head', 100), want: true },
    { name: 'CJK 按字节不按字符计', got: judgeSize('啊'.repeat(50), 'head', 99), want: true },
    { name: '取不到面返回 null(不冒充判绿)', got: judgeSize(null, 'head', 100), want: null },
  ]
  let bad = 0
  for (const c of cases) {
    const ok = c.want === null ? c.got === null : c.got !== null && c.got.over === c.want
    if (!ok) bad += 1
    console.log(`${ok ? '✅' : '❌'} self-test:${c.name}`)
  }

  // 注册形态:无逃生舱这件事必须有牙 —— 反向例把 skipEnv 加回,本判据必须翻红。
  const regOk =
    "script: 'check-agents-doc-size.mjs', args: [], mode: 'blocking', id: '207', stagedTriggers: ['AGENTS.md']"
  const regBad = regOk.replace('args: []', "args: [], skipEnv: 'HUSKY_SKIP_AGENTS_DOC_SIZE'")
  const regCases = [
    { name: '注册条目无 skipEnv ⇒ 判绿', got: judgeRegistration(regOk).ok, want: true },
    { name: '把 skipEnv 加回 ⇒ 判红(反向例)', got: judgeRegistration(regBad).ok, want: false },
    { name: '注册条目取不到 ⇒ 不记绿(未判定)', got: judgeRegistration('').ok, want: false },
  ]
  for (const c of regCases) {
    const ok = c.got === c.want
    if (!ok) bad += 1
    console.log(`${ok ? '✅' : '❌'} self-test:${c.name}`)
  }
  return bad === 0 ? 0 : 1
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()

  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`⏭  ${picked.error}`)
    return 2
  }
  const verdict = judgeSize(readFace(picked.face), picked.face)
  if (verdict === null) {
    console.error(`⏭  ${FILE} 在 ${picked.face} 面取不到 ⇒ 无法判定(不回落其他面,不记绿)`)
    return 2
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify(verdict))
    return verdict.over ? 1 : 0
  }

  if (verdict.over) {
    console.error(
      `❌ ${FILE} 体积 ${verdict.bytes} 字节 > 预算 ${verdict.budget}(面=${verdict.face},超出 ${verdict.bytes - verdict.budget})`,
    )
    console.error('   本文件逐字注入每一轮对话;巨型化会让新会话第 1 轮即占满上下文并被自动压缩。')
    console.error('   出路:把守门历史/取证叙述/重复登记副本整区逐字移入 .ihui-agent/archive/<按日命名>.md,')
    console.error('         原位置只留一句指针注记(§1 两步归档:先移动、再留 HTML 注释占位,占位点名的文件必须真在审面里)。')
    return 1
  }

  console.log(
    `✅ ${FILE} 体积 ${verdict.bytes} 字节(预算 ${verdict.budget},面=${verdict.face},余量 ${verdict.budget - verdict.bytes})`,
  )
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = { judgeSize, judgeRegistration, readFace, BUDGET_BYTES, FILE, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
