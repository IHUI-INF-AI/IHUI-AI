// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AGENTS.md 体积守门(2026-10-14 立;**未接提交链**,接入前置见文末「装车状态」)。
 *
 * 为什么要有这道门(实测锚点,不是推测):
 *   AGENTS.md 被客户端**逐字注入每一轮对话**,它的大小就是每轮固定上下文账单的大头。
 *   2026-10-14 本机同一份会话日志(`usage.context_usage_ratio`)实测:
 *     · 文件 1,261,607 字节 ⇒ ratio = 1.000(新会话第 1 轮即 100%,没有任何历史就被自动压缩 —— 机主报的故障)
 *     · 压缩后 55,405 字节 ⇒ ratio = 0.079
 *   每字节对上下文的贡献近似线性 ⇒ 1.26 MB ≈ 打满 100%,79.8 KB ≈ 6.3%。
 *   预算取 96,000 字节(≈ 7.6%)就是从这个锚点推出来的,不是拍的整数。
 *
 * 装车状态(为什么"造好了却还没接线",这是实测撞出来的,不是拖延):
 *   2026-10-14 本门按 `gate-registry-insert.mjs` 注册进 `scripts/guardian-runner.mjs` 后,守门 103 的
 *   C1 判据当场把整仓顶红:`guardian-runner.mjs [C1] 6019 行 > 上限 6000` —— 注册前该文件实测 5998 行,
 *   距上限只剩 2 行,而一枚门的最小注册块(注释+对象+闭合)就要 20 行。这不是本门的错,是注册表
 *   已经长到装不下任何新门;但按 §12e,造出一道与提交内容无关的全仓恒红门的唯一结局是逼人
 *   `--no-verify` 并连带废掉整条守门链,所以注册块已当场撤回(0 插入 / 21 删除,C1 复跑转绿)。
 *   接入前置 = 注册表按域拆分(§0.6 单一真相源仍然成立:拆成多份清单文件,判据实现仍只一份)。
 *   存量现读:HEAD 面 AGENTS.md 实测 55,405 字节 < 预算 96,000 ⇒ 违规数 0,拆分落地后接入可直接
 *   按 blocking 定级(§12e 升档前置已满足,无需再走 warn 观察档)。
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
