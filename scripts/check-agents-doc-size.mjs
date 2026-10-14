// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AGENTS.md 体积守门(守门 207,blocking;跳过 `HUSKY_SKIP_AGENTS_DOC_SIZE=1`)。
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

export const __test__ = { judgeSize, readFace, BUDGET_BYTES, FILE, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
