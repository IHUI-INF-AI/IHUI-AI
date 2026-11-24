#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tracked 生成物 .next-* 变体引用守门(门 50)。
 *
 * 背景: apps/web 的 next build 在 IHUI_BUILD_DIST 覆盖 distDir 时(部署脚本
 *   ihui-deploy.ps1 用 .next-staging 做零停机交换)会把被跟踪的 next-env.d.ts
 *   改写为引用 `.next-staging/types/...`。该引用残留会污染源码树,且违反
 *   AGENTS.md「next-env.d.ts 的 .next-* 变体永不提交」铁律。
 *
 * 2026-11-04 扩射程(机制缺口补齐):旧版只判 `apps/web/next-env.d.ts` 一枚文件,
 *   且正文取自**磁盘工作树**(readFileSync)。两个后果:
 *     ① 同一形态出现在任何其他 tracked 文件里都不会被发现 —— 实证 `74d85e2f21 chore(auto)`
 *        把 `.next-e2e-perf` 变体收编进 HEAD,而门当时判的是那枚文件的磁盘副本;
 *     ② 磁盘面会被并发会话正在跑的活 distDir 污染,把"已入库内容"的结论和"此刻磁盘脏"
 *        混成一谈(面混用)。
 *   现在判据面固定为 **git 面**,不读磁盘正文:全量档 = HEAD tree 的全部 tracked blob;
 *   `--staged` 档 = 索引面(这一笔要提交的内容)。
 *
 * 检测: 任何 tracked 文件里出现 import 引用 `./.next-<suffix>`(suffix 非空)→ 污染,exit 1。
 *   捕获组 1 = 变体目录名。
 *   合法: `.next` / `.next/dev` / `.next/types`(纯 .next 路径,Next.js 默认或 dev 模式);
 *         `.next-` 后无后缀;散文、注释、`.gitignore` 配置行里的同名字样(不是 import 引用)。
 *
 * 守门策略:
 *   - pre-commit(--staged):判**索引面**,与暂存路径无关的文件保持 HEAD 面内容 ⇒
 *     并发会话的脏工作树不会混进结论;污染进了索引即无条件拦截(不因目录存在而放行)。
 *   - 手动运行(无 --staged):判 HEAD tree 全部 tracked blob。HEAD 面出现变体引用 =
 *     铁律已被破(已入库),一律 exit 1。旧版"活 distDir 存在则只提示"的豁免随之删除 ——
 *     那条豁免的立因是"读的是磁盘脏副本",HEAD 面不存在"活"的副本(§0.6 判据跟着面走)。
 *
 * 用法: node scripts/check-next-env-dist.mjs [--staged|--self-test]
 *   exit 0 = 判据面里没有 .next-* 变体引用(或仓里还没有该面,未判定)
 *   exit 1 = 发现变体引用(修复:改回 ./.next/…;next-env.d.ts 可 git checkout -- apps/web/next-env.d.ts)
 *   exit 2 = 脚本自身异常
 * 跳过: HUSKY_SKIP_NEXT_ENV_DIST=1 git commit ...(runner 的 skipEnv 统一生效)
 * 自检: node scripts/check-next-env-dist.mjs --self-test(内存断言 + 反例,不读仓库面)
 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = process.cwd()
const NEXT_ENV = join(ROOT, 'apps', 'web', 'next-env.d.ts')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// 污染:import 语句引用 `./.next-<suffix>`(suffix 非空)的 distDir 路径。捕获组 1 = 变体目录名。
// 样例形状(此处刻意不写完整字面量:本文件自身也是 tracked blob,直写会被本判据命中):
//   变体引用 → 命中;纯 `.next` / `.next/dev` / `.next/types` → 不命中(无后缀);
//   `.next-` 后无后缀 → 不命中;散文 / `.gitignore` 配置行里的同名字样 → 不命中(不是 import 引用)。
const POLLUTION = /import\s+['"]\.\/(\.next-[^/'"]+)/

/** 判据面:只认 git 给的两张面,不认磁盘工作树(面混用是本门 2026-11-04 前的旧病)。 */
const FACE_HEAD = 'HEAD'
const FACE_INDEX = 'INDEX'

/**
 * git grep 的预筛字面量。2026-11-04 现读:全仓含 `.next-` 的 tracked blob 共 66 个、
 * 合计 135MB(单枚最大 56MB),整取会撞 face-reader 的 maxBuffer;
 * 先让 git 在面上做文本筛,再让 POLLUTION 判命中的那 288 行。
 */
const PREFILTER = '.next-'

/**
 * 索引面里这一笔要提交的路径(ACMR:新增/复制/修改/改名;删除无需判内容)。
 * 用 -z 输出,避免文件名里的空格/Unicode 被拆行。
 */
export function stagedPaths(root = ROOT) {
  try {
    return String(gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root))
      .split('\0')
      .filter(Boolean)
  } catch (e) {
    if (e?.status === 128) return [] // 索引面取不到(空仓)
    throw e
  }
}

/**
 * 在指定 git 面上取"含 `.next-` 字面量"的行(原始输出,含 path:line:正文)。
 *
 * 面 = git 自己给的:HEAD tree 或索引;本函数不读磁盘正文,也不做"磁盘有没有这个目录"的判断。
 * 返回 null = HEAD 面取不到(仓里还没有任何提交):调用方必须报"未判定",不得写成"无违规"。
 */
export function scanFace(face = FACE_HEAD, root = ROOT) {
  if (face === FACE_INDEX) {
    const paths = stagedPaths(root)
    if (!paths.length) return ''
    // 只扫本笔暂存路径(实测 2026-11-04:全索引 grep 5.9s,限定 pathspec 后 0.5s)。
    // 分批 200 是 Windows CreateProcess 命令行长度上限的老坑(与收编器 MAX_PATHS 同因)。
    const rows = []
    for (let i = 0; i < paths.length; i += 200) {
      const chunk = paths.slice(i, i + 200)
      try {
        const out = String(
          gitRaw(
            ['grep', '--cached', '-I', '-n', '-F', '-e', PREFILTER, '--', ...chunk.map((p) => `:(literal)${p}`)],
            root,
          ),
        )
        rows.push(out)
      } catch (e) {
        if (e?.status !== 1) throw e // 1 = 这批路径上没有命中
      }
    }
    return rows.filter(Boolean).join('\n')
  }
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader(绝对路径二进制 + safe.directory + stdio/windowsHide 统一)。
    return String(gitRaw(['grep', '-I', '-n', '-F', '-e', PREFILTER, face, '--'], root))
  } catch (e) {
    // git grep 的正常非零结论:1 = 面上无命中;128 = 仓里还没有该面(空仓 / 无 HEAD)。
    if (e?.status === 1) return ''
    if (e?.status === 128) return null
    throw e
  }
}

/**
 * 把 scanFace 的原始输出判成违规清单(pure;镜像测试与 --self-test 共用同一份判据)。
 * 输出行:HEAD 面为 `HEAD:<path>:<line>:<content>`,索引面为 `<path>:<line>:<content>`。
 * 输出行解析只认"路径:行号:正文"三段(仓内路径不含冒号);解析不了的行跳过,不猜。
 */
export function judgeLines(raw, face = FACE_HEAD) {
  const violations = []
  if (raw === null || raw === undefined) return violations
  for (const line of String(raw).split(/\r?\n/)) {
    if (!line) continue
    const body = face === FACE_INDEX ? line : line.replace(new RegExp(`^${face}:`), '')
    const m = /^(.*?):(\d+):(.*)$/.exec(body)
    if (!m) continue
    const hit = POLLUTION.exec(m[3])
    if (!hit) continue
    violations.push({ path: m[1], line: Number(m[2]), variant: hit[1], text: m[3].trim() })
  }
  return violations
}

/**
 * 自检(--self-test):内存断言 + 反例,不读仓库面。
 * 本文件自身也是 tracked blob,所以下面构造污染样例一律**拼接**给出 ——
 * 直写一行会被本门自己的全量档判成违规(2026-11-04 写头注时实测命中过一次)。
 */
export function selfTest() {
  const rows = []
  const push = (name, ok, detail = '') => rows.push({ name, ok, detail })
  const IMP = ['im', 'port '].join('')
  const Q = '"'
  const DN = ['.', 'next'].join('')
  const ref = (rest) => `${IMP}${Q}./${DN}${rest}${Q}`

  const hit = POLLUTION.exec(ref('-e2e-x/types/routes.d.ts'))
  push(
    '反例: tracked 生成物含 .next-e2e-x/ 引用 ⇒ 必须命中',
    Boolean(hit) && hit[1] === `${DN}-e2e-x`,
    hit ? hit[0] : '(未命中)',
  )
  push('合法: .next/types 不得命中', POLLUTION.exec(ref('/types/routes.d.ts')) === null)
  push('合法: .next/dev/types 不得命中', POLLUTION.exec(ref('/dev/types/routes.d.ts')) === null)
  push('合法: .next- 后无后缀不得命中', POLLUTION.exec(ref('-/types/routes.d.ts')) === null)

  const prose = `见 ${DN}-e2e-x/types/routes.d.ts`
  push('合法: 散文/配置行里的同名字样(非 import 引用)不得命中', POLLUTION.exec(prose) === null, prose)

  const raw = [
    `${FACE_HEAD}:probe.generated.ts:3:${ref('-e2e-x/types/routes.d.ts')}`,
    `${FACE_HEAD}:legal.ts:1:${ref('/types/routes.d.ts')}`,
    '',
    '解析不了的行',
  ].join('\n')
  const v = judgeLines(raw, FACE_HEAD)
  push(
    '判面: HEAD 原始输出行 → 违规恰 1 处,path/line/变体取对',
    v.length === 1 && v[0].path === 'probe.generated.ts' && v[0].line === 3 && v[0].variant === `${DN}-e2e-x`,
    JSON.stringify(v),
  )

  const idx = `${`probe.generated.ts`}:7:${ref('-e2e-x/types/routes.d.ts')}`
  const vi = judgeLines(idx, FACE_INDEX)
  push('判面: 索引面原始输出行同判', vi.length === 1 && vi[0].path === 'probe.generated.ts' && vi[0].line === 7, JSON.stringify(vi))
  push('未判定面(null)空集,不冒充违规也不冒充通过', judgeLines(null, FACE_HEAD).length === 0)

  const failed = rows.filter((r) => !r.ok).length
  return { rows, passed: rows.length - failed, failed }
}

function main() {
  if (process.argv.includes('--self-test')) {
    const r = selfTest()
    for (const row of r.rows) {
      console.log(`${row.ok ? C.green + '✓' : C.red + '✗'}${C.reset} ${row.name}${row.ok || !row.detail ? '' : ` :: ${row.detail}`}`)
    }
    console.log(`${C.dim}自检 ${r.passed}/${r.rows.length} 通过${C.reset}`)
    process.exit(r.failed ? 1 : 0)
  }

  const staged = process.argv.includes('--staged')
  const face = staged ? FACE_INDEX : FACE_HEAD
  const label = staged ? '索引面(这一笔要提交的内容)' : 'HEAD tree(全部 tracked blob)'
  const raw = scanFace(face)
  if (raw === null) {
    // §0.3:取不到面就报"未判定",绝不写成"无违规";空仓(无 HEAD)下也无从判。
    console.log(`${C.dim}⚠${C.reset} ${label} 取不到(空仓 / 无 HEAD),本次未判定`)
    process.exit(0)
  }

  const violations = judgeLines(raw, face)
  if (violations.length) {
    console.log(`${C.red}✗${C.reset} ${label} 里有 ${violations.length} 处 .next-* 变体引用(tracked 生成物不得含本地 build 变体):`)
    for (const v of violations.slice(0, 20)) console.log(`    ${C.dim}${v.path}:${v.line}${C.reset} → ${v.variant}`)
    if (violations.length > 20) console.log(`    ${C.dim}… 其余 ${violations.length - 20} 处省略${C.reset}`)
    console.log(`  ${C.yellow}修复:${C.reset} 把引用改回 ./.next/…;apps/web/next-env.d.ts 可 git checkout -- apps/web/next-env.d.ts`)
    process.exit(1)
  }

  const hitLines = raw ? raw.split(/\r?\n/).filter(Boolean).length : 0
  if (staged && hitLines === 0) {
    console.log(`${C.green}✓${C.reset} 索引面无暂存路径,跳过(这一笔没有要提交的内容)`)
    process.exit(0)
  }
  console.log(`${C.green}✓${C.reset} ${label} 无 .next-* 变体引用(面内含 "${PREFILTER}" 字面量的行 = ${hitLines})`)
  process.exit(0)
}

// §22d 双形态入口守卫:CLI 直跑才执行入口,被测试 import 时零副作用 —— 旧写法是顶层裸调用,
// 测试一 import 就会跑 git / 读 next-env.d.ts 并按结论 process.exit,把 node --test 进程打死。
// main() 是同步函数(本票禁止改成 async,那属行为变化),同步抛错接不进 `.catch` ⇒ 用 try/catch 形。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(String(e?.stack ?? e))
    process.exit(2)
  }
}

export const __test__ = {
  POLLUTION,
  NEXT_ENV,
  FACE_HEAD,
  FACE_INDEX,
  PREFILTER,
  stagedPaths,
  scanFace,
  judgeLines,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
