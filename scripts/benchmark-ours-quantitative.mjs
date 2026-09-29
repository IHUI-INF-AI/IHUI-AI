// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 常驻取证工具(D160 的产物之二):我方侧「量化显示项 × 端」对账表。
// 每个格子都是对 HEAD 面跑 git grep 得到的真实读数(命中文件数 + 前若干条代表 site),
// 不凭记忆填表 —— 本线已经吃过"按印象写我方有/没有"的亏(V4 §十二 的六条否证即此类)。
// 刻意不接提交链(它判清单与代码是否一致,与提交内容无关 ⇒ blocking 即恒红门;同 benchmark-asar-read)。
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const git = (args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    maxBuffer: 1 << 26,
  })

const ENDS = [
  ['web', 'apps/web/src'],
  ['小程序', 'apps/miniapp-taro/src'],
  ['RN', 'apps/mobile-rn/src'],
  ['共享屏', 'packages/app/src'],
  ['扩展', 'apps/extension/entrypoints'],
  ['CLI', 'apps/cli/src'],
]

const ITEMS = [
  ['消息/轮次时间戳', 'toLocaleTimeString|Intl\\.DateTimeFormat|formatTime'],
  ['耗时(秒)', 'elapsed|durationSec|耗时|formatDuration'],
  ['token 用量', 'totalTokens|promptTokens'],
  ['上下文占用比例', 'contextUsage|context_used|usageRatio'],
  ['队列位次/排队态', 'queuePosition|queued|队列'],
]

const isTest = (l) => /(^|\/)(tests?|__tests__|e2e)(\/|$)/.test(l) || /\.(test|spec)\./.test(l)

function probe(pattern, path) {
  let out = ''
  try {
    out = git(['grep', '-l', '-I', '-E', pattern, 'HEAD', '--', path])
  } catch (e) {
    out = String(e.stdout ?? '')
  }
  const files = out.split('\n').map((s) => s.replace(/^HEAD:/, '')).filter((s) => s && !isTest(s))
  return files
}

/** 先算成矩阵(rows 与正文里的"哪几端无命中"必须来自同一份数据,不能我手写一遍)。 */
const matrix = ITEMS.map(([label, pat]) => {
  const perEnd = ENDS.map(([name, path]) => ({ name, files: probe(pat, path) }))
  return { label, perEnd }
})

const rows = matrix.map(({ label, perEnd }) => {
  const cells = perEnd.map(({ files }) => {
    if (files.length === 0) return '**无命中**'
    const sample = files.slice(0, 2).map((f) => f.replace(/^apps\/[a-z-]+\//, '').replace(/^packages\//, ''))
    return `${files.length} 个文件(${sample.join('、')}${files.length > 2 ? ' …' : ''})`
  })
  return `| ${label} | ${cells.join(' | ')} |`
})

/** 某一行的"无命中端"名单,由矩阵算出来供正文引用(正文里的每一串端名都必须能回到数据)。 */
function missText(label) {
  const row = matrix.find((r) => r.label === label)
  if (!row) throw new Error(`矩阵里没有这一行:${label}`)
  const misses = row.perEnd.filter((e) => e.files.length === 0).map((e) => e.name)
  if (misses.length === 0) return '(本次无命中端为空 —— 说明这一项各端都有落点,正文那句得改)'
  return misses.join(' / ')
}

const header = `| 量化显示项 | ${ENDS.map(([l]) => l).join(' | ')} |\n| --- | ${ENDS.map(() => '---').join(' | ')} |`

const md = `# 我方侧「量化显示项 × 端」对账(机器生成,HEAD 面)

> D160 的产物之二(与 \`frame-by-end-matrix.md\` 同一套纪律)。重新生成:
> \`node scripts/benchmark-ours-quantitative.mjs\`。**格子里的数字与文件名都是 git grep 的输出**,
> 不要手工改本文件 —— 要改的是代码,然后重跑。

**判读口径(三条,缺一条就会把这张表读反)**

1. \`N 个文件(代表 site)\` = 该端**源码里**有这个语义的标识符/文案键,且已排除测试面。
   它只到"这端有实现"这一层,**不判**"用户在屏幕上看得见"—— 那需要浏览器/模拟器会话,本机没有。
2. \`**无命中**\` = 该端源码里没有这些标识符。它**不等于**"该端没有这个功能"(别名、动态拼接、
   经共享层透传都会让它失明),也**不等于**"该端不该有"。要下结论必须按 V4 §十二 的正向证据规矩另查。
3. 标识符集合是按**现有实现实际用的词**列的(如 \`contextUsage\`/\`usageRatio\`、\`elapsed\`/\`durationSec\`),
   不是竞品有的概念。换句话说:这张表回答"我们已经把哪些数字上屏、在哪端",
   不回答"竞品还应该有哪个数字"—— 后者是差距票的活。

${header}
${rows.join('\n')}

## 由这张表立刻能读出的三件事(每条都能被上面的命令复核)

- **上下文占用比例**在 ${missText('上下文占用比例')} 是**无命中** —— 而"这一轮还剩多少上下文"是
  Codex/Qoder 都摆在决策面上的信息。这一格要不要补,得先回答"那些端有没有等价的用量帧消费面"
  (见 \`frame-by-end-matrix.md\` 的 usage 行),不能直接照竞品补个 UI。
- **队列位次/排队态**在 ${missText('队列位次/排队态')} 是**无命中** —— 与 D162(队列动作缺拒因说明)
  同片区域,但这格说明的是**整条队列可视化在那些端还没有落点**,不是"文案没写好"。
- **时间戳 / 耗时 / token** 三项各端命中密度差得很多(web 38 / 56 / 21 对比共享屏与扩展的个位数)——
  这种差异**不能**直接当差距读:共享屏只有一个文件命中很可能是因为多数渲染在 web 侧;
  要判"某端少了什么"必须逐 site 看渲染归属,那是下一票的活。

## 这份清单不覆盖的(如实登记)

- 不判竞品侧对应项(竞品侧的同类判定走三份 \`codex/qoder/trae\` 清单 + V4 §十二 的否证规矩);
- 不判 i18n 文案是否五语言齐(那是 §19 那套门的活);
- 不判运行时是否真的渲染出来(本机无浏览器/模拟器会话)。
`

const OUT = 'docs/benchmark-evidence/2026-09/ours/quantitative-display-inventory.md'
mkdirSync(join(ROOT, 'docs/benchmark-evidence/2026-09/ours'), { recursive: true })
writeFileSync(join(ROOT, OUT), md, 'utf8')
// AGENTS §5c:任何 writeFileSync 产出被跟踪文件后必须**自己**注入水印 —— 否则重新生成一次就把
// 溯源横幅洗掉,而覆盖率门禁是自愈式的,会替生成器"擦屁股",于是这条纪律在提交链上永远不响。
// (幂等判据:同一份输入连续生成两次,文件的 git hash 必须不变 —— 见本文件的 --self-test 之外的实跑核对。)
execFileSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), 'inject', join(ROOT, OUT)], {
  cwd: ROOT,
  stdio: 'pipe',
  windowsHide: true,
  timeout: 120000,
})
console.log(`已写 ${OUT}:${ITEMS.length} 行 × ${ENDS.length} 端(已注入水印)`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
