// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 可复跑判据:渲染与 seed 路径不得再出现「境外图片域名」的完整 URL。
 *
 * 为什么存在:picsum 这类境外图源在移动网络不可达(首页轮播加载失败的病灶面);
 * 修一次不难,难的是没人拦"下一次又写回去"。本门就是那把常驻马尺。
 *
 * 运行(判据的境外域名清单 import 自图源池同一份常量,禁止在本文件内联第二份):
 *   cd packages/database
 *   pnpm exec tsx scripts/check-image-source-domains.mjs              # 全量档:审 HEAD blob(报告 + 存量报数)
 *   pnpm exec tsx scripts/check-image-source-domains.mjs --strict     # 全量档判红化(存量清零后问责用)
 *   pnpm exec tsx scripts/check-image-source-domains.mjs --staged     # 提交档:审索引 blob,零容忍清单+HEAD 棘轮
 *   pnpm exec tsx scripts/check-image-source-domains.mjs --worktree   # 仅人工逃生舱
 *   pnpm exec tsx scripts/check-image-source-domains.mjs --self-test  # 判据自检(含阳性对照)
 * 口径同守门 77/83/98:全量判 HEAD blob、--staged 判索引 blob、两面旗同给 exit 2、
 * 取不到 ⇒ exit 2「无法判定」(不冒红也不记绿)、HEAD 面枚举到 0 个在途文件判死。
 *
 * 定级说明(为什么不接 guardian):本票禁改根 scripts/** 与 runner 注册表,故它是"可复跑判据"
 * 而非已接线守门 —— 如实登记:当前无调度器,问责靠手动/CI。接线路径见交付报告。
 *
 * 三态(不静默):命中 / 放过 / 未判定。豁免只有"文档化射程边界",没有行内遮丑通道。
 * 已知形态放过规则:
 *   - 只数 https?(s):// 开头的完整 URL;裸域名(注释里的"picsum.photos 这类"叙述、
 *     判据字符串 c.includes('picsum.photos'))不构成数据源加载,不判。
 *   - 域名归属:cdn.bspapp.com 属 DCloud(境内主体,虽已停用)、aizhs.top 属本厂 ——
 *     均不入"境外"清单;"死链"与"境外"是两个问题,本门只管后者。
 *   - SELF_EXCLUDE(逐条带理由):migrate-overseas-images.ts 的境外 URL 仅以 --self-test
 *     判据夹具出现,不是渲染数据源;摘掉该豁免会让本门在自己的夹具上恒红(本仓最高频反面型)。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 单一域名清单来源:import 图源池常量,禁止第二份登记表
import {
  isOverseasImageUrl,
  OVERSEAS_IMAGE_ONLY_DOMAINS,
} from '../../shared/src/constants/image-source-pool.ts'
// git 二进制解析走仓内首选链(与全体守门同一出口,不赌服务账户 PATH)
import { gitBinary } from '../../../scripts/lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const GIT = gitBinary()

/** 射程目录:seed 数据源 + 各渲染面源码 */
const SCOPE_DIRS = [
  'packages/database/seed',
  'apps/web/src',
  'apps/web/app',
  'apps/miniapp-taro/src',
  'apps/mobile-rn/src',
  'apps/desktop/src',
  'apps/extension',
  'packages/shared/src',
  'packages/ui-react/src',
  'packages/app/src',
  'packages/design-tokens/src',
]
/** 显式射程排除(每条带理由,不是垃圾桶):
 *  apps/web/public — mock-data/*.json 全仓零消费者的死文件(任务书禁删),不属"渲染与 seed 路径";
 *  测试/夹具/stories — 断言夹具里的境外 URL 是把反例写进代码,不是数据源;
 *  .md — 文档叙述。 */
const EXCLUDE_RE = [
  /(^|\/)(node_modules|dist|build|\.next|\.swc|coverage)(\/|$)/,
  /(^|\/)(__tests__|tests|e2e|test|stories)(\/|$)/,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /\.stories\.[cm]?[jt]sx?$/,
  /^apps\/web\/public\//,
  /\.md$/,
]
/** 零容忍清单(本票整改面):这些文件在任何被审面上出现 1 处即红 */
const ZERO_FILES = new Set([
  'packages/database/seed/lessons.ts',
  'packages/database/seed/update-picsum-urls.ts',
  'apps/miniapp-taro/src/pages/index/index.tsx',
  'apps/miniapp-taro/src/pkg-ai/aigc/list.tsx',
  'packages/shared/src/constants/image-source-pool.ts',
])
/** 文档化豁免(见头注) */
const SELF_EXCLUDE = new Set(['packages/database/seed/migrate-overseas-images.ts'])

function runGit(args, input) {
  return execFileSync(GIT || 'git', ['-c', 'safe.directory=*', '-C', ROOT, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60_000,
    windowsHide: true,
    ...(input === undefined ? {} : { input }),
  })
}

/** 判据本体:一段源码文本 → 命中的境外图片 URL 清单(与迁移脚本共用同一 isOverseasImageUrl) */
export function findOverseasImageUrls(text) {
  const urls = text.match(/https?:\/\/[^\s"'`<>)\]]+/g) || []
  return urls.filter((u) => isOverseasImageUrl(u))
}

function inScope(path) {
  if (!SCOPE_DIRS.some((d) => path.startsWith(d + '/'))) return false
  return !EXCLUDE_RE.some((re) => re.test(path))
}

function listFaceFiles(face) {
  if (face === 'head') {
    return runGit(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCOPE_DIRS])
      .split('\n')
      .filter(Boolean)
  }
  if (face === 'staged') {
    return runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', ...SCOPE_DIRS])
      .split('\n')
      .filter(Boolean)
  }
  return runGit(['ls-files', '--', ...SCOPE_DIRS])
    .split('\n')
    .filter(Boolean)
}

function readFace(face, path) {
  if (face === 'worktree') return readFileSync(join(ROOT, path), 'utf8')
  const spec = face === 'head' ? `HEAD:${path}` : `:${path}`
  return runGit(['cat-file', 'blob', spec])
}

/** HEAD 棘轮锚点:该文件在 HEAD 自身的命中数;文件不在 HEAD ⇒ 0(新文件零容忍) */
function headAnchor(path) {
  try {
    return findOverseasImageUrls(readFace('head', path)).length
  } catch {
    return 0
  }
}

/** 预筛模式:判据裸域名清单的超集(任何被计入的完整 URL 必含其一)。
 *  由池常量推导 —— 禁止在这里再手抄一份域名(单一来源纪律)。 */
const PREFILTER_DOMAINS = [
  ...OVERSEAS_IMAGE_ONLY_DOMAINS,
  'x.ai', // SITE 档:x.ai 的 og 图与博客链接共享前缀,超集收录、精确判据再分流
]

function grepCandidates(face) {
  const patArgs = PREFILTER_DOMAINS.flatMap((d) => ['-e', d])
  const base = ['grep', '-I', '-l', '--no-color', ...patArgs]
  try {
    if (face === 'head')
      return runGit([...base, 'HEAD', '--', ...SCOPE_DIRS])
        .split('\n')
        .filter(Boolean)
        .map((l) => l.replace(/^HEAD:/, ''))
    if (face === 'staged')
      return runGit([...base, '--cached', '--', ...SCOPE_DIRS])
        .split('\n')
        .filter(Boolean)
    return runGit([...base, '--', ...SCOPE_DIRS])
      .split('\n')
      .filter(Boolean)
  } catch (e) {
    // git grep:exit 1 = 零命中(合法);其余 = 工具失败 ⇒ 交上层判"无法判定"
    if (e && e.status === 1) return []
    throw e
  }
}

function audit(face) {
  // 全量枚举一次 ls-tree 只为"射程非空"判死;精确内容判断只查预筛候选(N 小)
  const all = listFaceFiles(face).filter(inScope)
  if (face === 'head' && all.length === 0) {
    // 只判全量档:staged 档枚举为空是常态(无关提交),不得替每一次提交挡路(恒挡=逼人跳门)
    return {
      undetermined: `head 面上在射程内枚举到 0 个文件(射程目录漂移或被审面取不到),判"无法判定",不记绿`,
    }
  }
  const candidates = new Set(grepCandidates(face).filter(inScope))
  const rows = []
  const reds = []
  let total = 0
  for (const f of [...candidates].sort()) {
    if (SELF_EXCLUDE.has(f)) continue
    let text
    try {
      text = readFace(face, f)
    } catch (e) {
      return {
        undetermined: `${face} 面取不到 ${f}:${String((e && e.message) || e).slice(0, 160)}`,
      }
    }
    const hits = findOverseasImageUrls(text)
    if (hits.length === 0) continue
    total += hits.length
    rows.push({ file: f, count: hits.length, sample: hits[0] })
    if (face === 'staged') {
      if (ZERO_FILES.has(f)) {
        reds.push(`${f}:零容忍清单文件出现 ${hits.length} 处(样例 ${hits[0]})`)
      } else {
        const cap = headAnchor(f)
        if (hits.length > cap) {
          reds.push(`${f}:命中 ${hits.length} 处 > 该文件 HEAD 自身存量 ${cap} 处(棘轮只拦新增)`)
        }
      }
    }
  }
  // 预筛超集自证:判据命中的域名,其裸域名字符串必须在预筛表里(漏了=门对该形态全盲)
  for (const r of rows) {
    const d = [...OVERSEAS_IMAGE_ONLY_DOMAINS, 'x.ai'].find((x) => r.sample.includes(x))
    if (!d || !PREFILTER_DOMAINS.includes(d)) {
      reds.push(
        `预筛不闭合:${r.file} 的命中样例 "${r.sample.slice(0, 60)}" 不在超集内(判据产出了预筛看不见的形态)`,
      )
    }
  }
  return { files: all, rows, reds, total }
}

function selfTest() {
  const cases = []
  const ok = (name, cond) => {
    cases.push(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) process.exitCode = 1
  }
  ok(
    '阳性对照:修复前 lessons.ts 真实旧行(逐字)必须被看见',
    findOverseasImageUrls(`    image: 'https://picsum.photos/seed/python/400/300',`).length === 1,
  )
  ok(
    '新形态 domesticImageAt(i) 不命中',
    findOverseasImageUrls('    image: domesticImageAt(0),').length === 0,
  )
  ok(
    '境内池全 URL 不命中',
    findOverseasImageUrls("'https://statics.moonshot.cn/a.png' 'https://cdn.deepseek.com/b.jpeg'")
      .length === 0,
  )
  ok(
    'sanity 全 URL 命中',
    findOverseasImageUrls("'https://cdn.sanity.io/images/x/y.jpg'").length === 1,
  )
  ok(
    'ctfassets 命中',
    findOverseasImageUrls('https://images.ctfassets.net/a/b/c.png?w=1').length === 1,
  )
  ok(
    'dicebear/wikimedia 各命中',
    findOverseasImageUrls(
      'https://api.dicebear.com/9.x/initials/svg?seed=A https://upload.wikimedia.org/a/b.png',
    ).length === 2,
  )
  ok(
    'x.ai 只判带图片后缀的,博客链接不误伤',
    findOverseasImageUrls('https://x.ai/images/news/a-og.png https://x.ai/blog/post').length === 1,
  )
  ok(
    '同形两 URL 同行计 2',
    findOverseasImageUrls("['https://picsum.photos/1','https://picsum.photos/2']").length === 2,
  )
  ok(
    '裸域名叙述不计(注释/judgment 字符串形态)',
    findOverseasImageUrls("// picsum.photos 这类境外随机图服务\n  c.includes('picsum.photos')")
      .length === 0,
  )
  ok(
    'bspapp(境内主体已停用)不按境外判',
    findOverseasImageUrls('https://x.cdn.bspapp.com/a.png').length === 0,
  )
  ok(
    '域名清单单一来源:池常量的境外清单非空且为裸域名(不含 scheme)',
    Array.isArray(OVERSEAS_IMAGE_ONLY_DOMAINS) &&
      OVERSEAS_IMAGE_ONLY_DOMAINS.length > 0 &&
      OVERSEAS_IMAGE_ONLY_DOMAINS.includes('picsum.photos') &&
      OVERSEAS_IMAGE_ONLY_DOMAINS.every((d) => !/^https?:\/\//.test(d)),
  )
  ok(
    '零容忍清单在判据面生效(ZERO_FILES 含 4 个整改文件+池)',
    [
      'packages/database/seed/lessons.ts',
      'packages/database/seed/update-picsum-urls.ts',
      'apps/miniapp-taro/src/pages/index/index.tsx',
      'apps/miniapp-taro/src/pkg-ai/aigc/list.tsx',
    ].every((p) => ZERO_FILES.has(p)),
  )
  ok(
    '射程边界:apps/web/public 死 mock 排除、seed 在册、测试夹具排除',
    !inScope('apps/web/public/mock-data/carousels.json') &&
      inScope('packages/database/seed/lessons.ts') &&
      !inScope('apps/web/src/components/x.test.tsx'),
  )
  ok(
    'SELF_EXCLUDE 只含迁移夹具文件且带点名输出能力',
    SELF_EXCLUDE.has('packages/database/seed/migrate-overseas-images.ts') &&
      [...SELF_EXCLUDE].length === 1,
  )
  console.log(cases.join('\n'))
  console.log(`--self-test ${cases.length} 条:${process.exitCode === 1 ? '有红 ❌' : '全绿 ✅'}`)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    selfTest()
    return
  }
  const wantStaged = args.includes('--staged')
  const wantWorktree = args.includes('--worktree')
  if (wantStaged && wantWorktree) {
    console.error('❌ --staged 与 --worktree 不得同时给(取材面矛盾)')
    process.exit(2)
  }
  const face = wantStaged ? 'staged' : wantWorktree ? 'worktree' : 'head'
  let res
  try {
    res = audit(face)
  } catch (e) {
    console.error(`无法判定:${String((e && e.message) || e).slice(0, 300)}`)
    process.exit(2)
    return
  }
  if (res.undetermined) {
    console.error(`无法判定:${res.undetermined}`)
    process.exit(2)
  }
  const strict = args.includes('--strict')
  const zeroInFace = [...ZERO_FILES].filter((f) => res.files.includes(f))
  const report = {
    face,
    scannedFiles: res.files.length,
    totalOverseasImageUrls: res.total,
    byFile: res.rows,
    zeroFilesInFace: zeroInFace,
    reds: res.reds,
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`面=${face} 扫描=${res.files.length} 文件 · 境外图片 URL 合计 ${res.total} 处`)
    for (const r of res.rows) console.log(`  ${r.file} ×${r.count}  例:${r.sample.slice(0, 90)}`)
    console.log(`零容忍清单在本面出现的文件:${zeroInFace.join(', ') || '(无)'}`)
    console.log(`豁免面(点名不静默,理由见头注):${[...SELF_EXCLUDE].join(', ')}`)
    if (res.reds.length) console.log(res.reds.map((r) => `  ❌ ${r}`).join('\n'))
  }
  if (res.reds.length) process.exit(1)
  if (strict && res.total > 0) {
    console.log('❌ --strict:存量未清零即判红(上表逐处)')
    process.exit(1)
  }
  if (!strict) {
    console.log(
      `结论:${res.total > 0 ? `存量 ${res.total} 处只报数(非提交链判红;清零后跑 --strict 问责)` : '境外图片 URL 已为 0 ✅'}`,
    )
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
