// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 可复跑判据:渲染与 seed 路径不得再出现「境外图片域名」的完整 URL。
 *
 * 为什么存在:picsum 这类境外图源在移动网络不可达(首页轮播加载失败的病灶面);
 * 修一次不难,难的是没人拦"下一次又写回去"。本门就是那把常驻马尺。
 *
 * 运行(判据的域名清单从**被审面**的图源池文本里现读,本文件内不内联第二份,也不 import 池):
 *   node scripts/check-image-source-domains.mjs              # 全量档:审 HEAD blob(报告 + 存量报数)
 *   node scripts/check-image-source-domains.mjs --strict     # 全量档判红化(存量清零后问责用)
 *   node scripts/check-image-source-domains.mjs --staged     # 提交档:审索引 blob,零容忍清单+HEAD 棘轮
 *   node scripts/check-image-source-domains.mjs --worktree   # 仅人工逃生舱
 *   node scripts/check-image-source-domains.mjs --self-test  # 判据自检(含阳性对照)
 *   node --test scripts/tests/image-source-pool-parity.test.mjs  # 三方**行为**一致性(真模块执行)
 * 口径同守门 77/83/98:全量判 HEAD blob、--staged 判索引 blob、两面旗同给 exit 2、
 * 取不到 ⇒ exit 2「无法判定」(不冒红也不记绿)、HEAD 面枚举到 0 个在途文件判死。
 *
 * 本门住在根 scripts/(tooling 层)而不是 packages/database/scripts/:
 * 架构契约表层序为 contract(10) ← platform(20,含 packages/database) ← composite(30,含 shared) ← tooling(90),
 * "rank 小的可被 rank 大的依赖,反向即违规"。判据要同时看 shared 的池与各端源码,放在 database 层
 * 就必然反向 import shared(守门 103 实测 18 处 D1/D2/D3 红)。放在 tooling 层,向下取用合法。
 * 旧路径 `packages/database/scripts/check-image-source-domains.mjs` 留着做**转发壳**(不删:它是守门 30c
 * 的保护区路径,且 `pnpm --filter @ihui/database check:image-domains` 是已发布的问责入口),壳内零 import。
 *
 * 定级说明(现状如实登记):本门**尚未**注册进 `scripts/guardian-runner.mjs`。
 * 接线要求"注册块 + AGENTS/README 点名 + 判据本体"同枚入库(守门 89 的 R2/R4 与"注册指向不存在脚本"
 * 那两条事故都记在 AGENTS 里,半途声称更糟),所以接线是紧随的另一枚提交,不在本枚里做半截。
 * 当前问责靠手动、CI 与 `pnpm --filter @ihui/database check:image-domains`(经转发壳)。
 * 提交档判据是"零容忍清单 + 每文件 HEAD 自身存量棘轮",seed 数据存量(现读 53 处)只报数,
 * 所以接线不会造出与任何提交都无关的恒红门(§12e 那一型)。
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
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 取材一律走 scripts/lib/face-reader.mjs 的读取入口(catBatch / readWorktreeFile) ——
// 本门自己 import 图源池的 .ts 再判它,等于让被审对象交出答案当尺子,而且 import 走的是磁盘、
// 判的是 HEAD/索引,两面混取正是守门 118 要防的那一型。清单改为**从被审面解析字面量**。
import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 60_000

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
/** 镜像对账的三个键(canonical 在 shared,database 侧只能做镜像 —— 层序禁止反向依赖) */
const POOL_CANONON = 'packages/shared/src/constants/image-source-pool.ts'
const POOL_MIRROR = 'packages/database/seed/image-source-pool.ts'
const POOL_PAIR_KEYS = [
  'DOMESTIC_IMAGE_POOL',
  'OVERSEAS_IMAGE_ONLY_DOMAINS',
  'OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT',
]
/** 零容忍清单(本票整改面):这些文件在任何被审面上出现 1 处即红 */
const ZERO_FILES = new Set([
  'packages/database/seed/lessons.ts',
  'packages/database/seed/update-picsum-urls.ts',
  'apps/miniapp-taro/src/pages/index/index.tsx',
  'apps/miniapp-taro/src/pkg-ai/aigc/list.tsx',
  'packages/shared/src/constants/image-source-pool.ts',
  POOL_MIRROR,
])
/** 文档化豁免(见头注) */
const SELF_EXCLUDE = new Set(['packages/database/seed/migrate-overseas-images.ts'])

function git(args, opts = {}) {
  return String(gitRaw(args, ROOT, { timeout: GIT_TIMEOUT, ...opts }))
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)(\?[^\s"'`)]*)?$/i

function hostOf(url) {
  const m = /^https?:\/\/([^/]+)/i.exec(url)
  const raw = m?.[1]
  if (!raw) return ''
  return raw.split(':')[0].toLowerCase()
}

/**
 * 判据本体:一段源码文本 → 命中的境外图片 URL 清单。
 *
 * 域名清单**必须由调用方从同一个被审面解析后喂进来**。本门刻意不 import 图源池:
 * import 走磁盘、判定走 HEAD/索引,两面混取会让报告说的和提交里的不是同一份代码
 * (守门 118 立项要防的那一型);而"判据 import 被审对象自己"还会把"池里写了什么"
 * 直接当成尺子,池被清空时门会跟着一起瞎。三方行为一致性由
 * `scripts/tests/image-source-pool-parity.test.mjs` 用真模块执行锁住(shared ↔ 镜像 ↔ 本门)。
 */
export function findOverseasImageUrls(text, lists) {
  const imageOnly = lists?.OVERSEAS_IMAGE_ONLY_DOMAINS ?? []
  const siteExt = lists?.OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT ?? []
  const urls = text.match(/https?:\/\/[^\s"'`<>)\]]+/g) || []
  return urls.filter((u) => {
    const host = hostOf(u)
    if (!host) return false
    if (imageOnly.some((d) => host === d || host.endsWith(`.${d}`))) return true
    return (
      siteExt.some((d) => host === d || host.endsWith(`.${d}`)) && IMAGE_EXT_RE.test(u)
    )
  })
}

function inScope(path) {
  if (!SCOPE_DIRS.some((d) => path.startsWith(d + '/'))) return false
  return !EXCLUDE_RE.some((re) => re.test(path))
}

function listFaceFiles(face) {
  if (face === 'head') {
    return git(['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', ...SCOPE_DIRS])
      .split('\0')
      .filter(Boolean)
  }
  if (face === 'staged') {
    return git([
      'diff',
      '--cached',
      '--name-only',
      '--diff-filter=ACMR',
      '-z',
      '--',
      ...SCOPE_DIRS,
    ])
      .split('\0')
      .filter(Boolean)
  }
  return git(['ls-files', '-z', '--', ...SCOPE_DIRS])
    .split('\0')
    .filter(Boolean)
}

/** 一批路径一次批量读满(catBatch);某条在被审面上不存在 ⇒ 该键值为 null,由调用方定性,不静默跳过。 */
function readMany(face, paths) {
  const list = [...new Set(paths)]
  if (list.length === 0) return new Map()
  if (face === 'worktree') {
    const map = new Map()
    for (const p of list) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = list.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  const map = new Map()
  for (let i = 0; i < list.length; i++) map.set(list[i], got.get(specs[i]) ?? null)
  return map
}

/** 预筛模式:判据裸域名清单的**超集**(任何被计入的完整 URL 必含其一)。
 *  静态一份是刻意的:预筛发生在取内容之前,不可能由被审面的清单现推。
 *  "超集"不是口头承诺 —— audit 会用被审面解析出的判据清单逐条反查本表(闭合成不住 ⇒ 红),
 *  所以往池里加一个域名而忘了加这里,门当场点名,而不是对该形态全盲还报绿。 */
const PREFILTER_DOMAINS = [
  'picsum.photos',
  'images.ctfassets.net',
  'cdn.sanity.io',
  'api.dicebear.com',
  'upload.wikimedia.org',
  'x.ai', // SITE 档:x.ai 的 og 图与博客链接共享前缀,超集收录、精确判据再分流
]

function grepCandidates(face) {
  const patArgs = PREFILTER_DOMAINS.flatMap((d) => ['-e', d])
  const base = ['grep', '-I', '-l', '-z', '--no-color', ...patArgs]
  try {
    if (face === 'head')
      return git([...base, 'HEAD', '--', ...SCOPE_DIRS])
        .split('\0')
        .filter(Boolean)
        .map((l) => l.replace(/^HEAD:/, ''))
    if (face === 'staged')
      return git([...base, '--cached', '--', ...SCOPE_DIRS]).split('\0').filter(Boolean)
    return git([...base, '--', ...SCOPE_DIRS]).split('\0').filter(Boolean)
  } catch (e) {
    // git grep:exit 1 = 零命中(合法);其余 = 工具失败 ⇒ 交上层判"无法判定"
    if (e instanceof Undetermined && e.status === 1) return []
    throw e
  }
}

/** 从源码文本里取出 `export const NAME: readonly string[] = [...]` 的字符串字面量清单 */
export function stringArrayLiteral(text, name) {
  const re = new RegExp('export const ' + name + '[^=]*=\\s*\\[([\\s\\S]*?)\\]')
  const m = re.exec(text)
  if (!m) return null
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1])
}

/** 从一份池文本里解析出三张清单(缺任一张 ⇒ 该键 null,由调用方定性) */
function poolLists(text) {
  if (typeof text !== 'string') return null
  const out = {}
  for (const key of POOL_PAIR_KEYS) out[key] = stringArrayLiteral(text, key)
  return out
}

/**
 * 镜像等值对账。database 侧那份是 shared 那份的镜像(层序禁止 database 依赖 shared,见镜像文件头注)。
 * 镜像只有在「机器强制它不能漂」时才不是第二份真相 —— 所以按同一个被审面读两份、逐键比清单。
 * 读不到(null)与"清单为空"是两种不同的结论,都必须点名,不得静默放过。
 */
function parityReds(read) {
  let a
  let b
  try {
    a = read(POOL_CANONON)
    b = read(POOL_MIRROR)
  } catch (e) {
    return ['镜像对账无法判定:' + String((e && e.message) || e).slice(0, 140)]
  }
  if (a === null || a === undefined) {
    return [`镜像对账判不出:${POOL_CANONON} 在本面取不到(单一真相源缺失 ⇒ 无尺子可比)`]
  }
  if (b === null || b === undefined) {
    return [`镜像对账判不出:${POOL_MIRROR} 在本面取不到(database 侧镜像缺失或被删除)`]
  }
  const la = poolLists(a)
  const lb = poolLists(b)
  const out = []
  for (const key of POOL_PAIR_KEYS) {
    const xa = la[key]
    const xb = lb[key]
    if (!Array.isArray(xa) || !Array.isArray(xb)) {
      out.push(
        '镜像对账判不出:' +
          key +
          ' 一侧找不到数组字面量(shared=' +
          (Array.isArray(xa) ? '有' : '缺') +
          ', 镜像=' +
          (Array.isArray(xb) ? '有' : '缺') +
          ')',
      )
      continue
    }
    if (xa.join('\u0000') !== xb.join('\u0000')) {
      out.push(
        '镜像漂移:' + key + ' shared=' + JSON.stringify(xa) + ' vs 镜像=' + JSON.stringify(xb) + ' —— 两份必须逐字等值',
      )
    }
  }
  return out
}

/** 判据清单自身的健康度:空清单不是"没有违规",而是"门对该型全盲"(与"枚举到 0 判死"同一条纪律) */
export function listHealthReds(lists) {
  const imageOnly = lists?.OVERSEAS_IMAGE_ONLY_DOMAINS ?? []
  const domestic = lists?.DOMESTIC_IMAGE_POOL ?? []
  const out = []
  if (imageOnly.length === 0) {
    out.push('判据清单为空:OVERSEAS_IMAGE_ONLY_DOMAINS 零成员(门对境外图源全盲,不得记绿)')
  }
  if (domestic.length === 0) {
    out.push('境内图源池为空:DOMESTIC_IMAGE_POOL 零成员(消费方一律取不到境内源)')
  }
  return out
}

/** 预筛闭合:被审清单里的每条裸域名必须能在静态超集表里点到(漏一条 = 该域名整片隐身)。 */
export function prefilterClosureReds(lists) {
  const all = [
    ...(lists?.OVERSEAS_IMAGE_ONLY_DOMAINS ?? []),
    ...(lists?.OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT ?? []),
  ]
  const out = []
  for (const d of all) {
    if (!PREFILTER_DOMAINS.includes(d)) {
      out.push(
        `预筛不闭合:判据清单里的 ${d} 不在 PREFILTER_DOMAINS —— 加了池忘了加预筛,门对该域名全盲`,
      )
    }
  }
  return out
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
  const candidates = [...new Set(grepCandidates(face).filter(inScope))].sort()
  // 一次批量读满:候选文件 + 两份池,同一个面、同一轮。
  // 分两轮读会在并行会话推进的瞬间产出自洽却错位的尺子(本仓"两面混取"记过多次)。
  const texts = readMany(face, [...candidates, POOL_CANONON, POOL_MIRROR])
  const lists = poolLists(texts.get(POOL_CANONON))
  if (!lists) {
    return {
      undetermined: `${face} 面取不到单一真相源 ${POOL_CANONON} —— 判据没有清单可用,判"无法判定",不冒红也不记绿`,
    }
  }
  const reds = []
  for (const key of POOL_PAIR_KEYS) {
    if (!Array.isArray(lists[key])) {
      return {
        undetermined: `${face} 面上 ${POOL_CANONON} 解析不出 ${key} 数组字面量 ⇒ 判据失明,无法判定`,
      }
    }
  }
  // 空清单不是"没有违规",是"门对该型全盲";预筛表必须是被审清单的超集 —— 两条都抽成
  // 导出纯函数,自检才能拿**构造面**做阳性对照(拿真仓现状当"判据有牙"的证明是本仓记过的假绿型)
  reds.push(...listHealthReds(lists))
  reds.push(...prefilterClosureReds(lists))
  const anchors = face === 'staged' ? readMany('head', candidates) : null
  const rows = []
  let total = 0
  for (const f of candidates) {
    if (SELF_EXCLUDE.has(f)) continue
    const text = texts.get(f)
    if (typeof text !== 'string') {
      return {
        undetermined: `${face} 面取不到 ${f}(候选来自同一轮 git grep,取不到即取材面不自洽)`,
      }
    }
    const hits = findOverseasImageUrls(text, lists)
    if (hits.length === 0) continue
    total += hits.length
    rows.push({ file: f, count: hits.length, sample: hits[0] })
    if (face === 'staged') {
      if (ZERO_FILES.has(f)) {
        reds.push(`${f}:零容忍清单文件出现 ${hits.length} 处(样例 ${hits[0]})`)
      } else {
        // HEAD 棘轮锚点:该文件在 HEAD 自身的命中数;不在 HEAD ⇒ 0(新文件零容忍)
        const at = anchors.get(f)
        const cap = typeof at === 'string' ? findOverseasImageUrls(at, lists).length : 0
        if (hits.length > cap) {
          reds.push(`${f}:命中 ${hits.length} 处 > 该文件 HEAD 自身存量 ${cap} 处(棘轮只拦新增)`)
        }
      }
    }
  }
  // 预筛超集自证(第二把尺子):命中样例里必须量得到一条在册裸域名
  for (const r of rows) {
    const d = [...lists.OVERSEAS_IMAGE_ONLY_DOMAINS, ...lists.OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT].find((x) => r.sample.includes(x))
    if (!d || !PREFILTER_DOMAINS.includes(d)) {
      reds.push(
        `预筛不闭合:${r.file} 的命中样例 "${r.sample.slice(0, 60)}" 不在超集内(判据产出了预筛看不见的形态)`,
      )
    }
  }
  // 镜像等值对账(与上面同一个被审面、同一轮取数)
  for (const r of parityReds((f) => texts.get(f) ?? null)) reds.push(r)
  return {
    files: all,
    rows,
    reds,
    total,
    parityKeys: POOL_PAIR_KEYS.length,
    listSizes: {
      domestic: lists.DOMESTIC_IMAGE_POOL.length,
      imageOnly: lists.OVERSEAS_IMAGE_ONLY_DOMAINS.length,
      siteExt: lists.OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT.length,
    },
  }
}

function selfTest() {
  const cases = []
  const ok = (name, cond) => {
    cases.push(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) process.exitCode = 1
  }
  // 判据清单必须由被审面解析而来,所以自检自带一份**构造**清单,而不是 import 磁盘上的池
  // (import 走磁盘而问责走 HEAD/索引 —— 两面混取是本仓最高频的自洽假绿)。
  const LISTS = {
    DOMESTIC_IMAGE_POOL: [
      'https://statics.moonshot.cn/a.png',
      'https://cdn.deepseek.com/b.jpeg',
    ],
    OVERSEAS_IMAGE_ONLY_DOMAINS: [
      'picsum.photos',
      'images.ctfassets.net',
      'cdn.sanity.io',
      'api.dicebear.com',
      'upload.wikimedia.org',
    ],
    OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT: ['x.ai'],
  }
  const hit = (text) => findOverseasImageUrls(text, LISTS)
  ok(
    '阳性对照:修复前 lessons.ts 真实旧行(逐字)必须被看见',
    hit(`    image: 'https://picsum.photos/seed/python/400/300',`).length === 1,
  )
  ok('新形态 domesticImageAt(i) 不命中', hit('    image: domesticImageAt(0),').length === 0)
  ok(
    '境内池全 URL 不命中',
    hit("'https://statics.moonshot.cn/a.png' 'https://cdn.deepseek.com/b.jpeg'").length === 0,
  )
  ok('sanity 全 URL 命中', hit("'https://cdn.sanity.io/images/x/y.jpg'").length === 1)
  ok('ctfassets 命中', hit('https://images.ctfassets.net/a/b/c.png?w=1').length === 1)
  ok(
    'dicebear/wikimedia 各命中',
    hit('https://api.dicebear.com/9.x/initials/svg?seed=A https://upload.wikimedia.org/a/b.png')
      .length === 2,
  )
  ok(
    'x.ai 只判带图片后缀的,博客链接不误伤',
    hit('https://x.ai/images/news/a-og.png https://x.ai/blog/post').length === 1,
  )
  ok('同形两 URL 同行计 2', hit("['https://picsum.photos/1','https://picsum.photos/2']").length === 2)
  ok(
    '裸域名叙述不计(注释/judgment 字符串形态)',
    hit("// picsum.photos 这类境外随机图服务\n  c.includes('picsum.photos')").length === 0,
  )
  ok('bspapp(境内主体已停用)不按境外判', hit('https://x.cdn.bspapp.com/a.png').length === 0)
  ok(
    '子域名按裸域名命中(host.endsWith)',
    hit('https://fastly.picsum.photos/id/1/200/300.jpg').length === 1,
  )
  ok(
    '清单文本解析:三键齐备解析出数组、裸域名不含 scheme',
    poolLists(
      `export const DOMESTIC_IMAGE_POOL: readonly string[] = ['u1', 'u2']
export const OVERSEAS_IMAGE_ONLY_DOMAINS: readonly string[] = ['d.example']
export const OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT: readonly string[] = ['s.example']`,
    ).OVERSEAS_IMAGE_ONLY_DOMAINS.join() === 'd.example',
  )
  ok(
    '解析取不到的答案是 null 而不是空数组(空数组会被读成"清单已空"而 null 才是"没看见")',
    poolLists('export const SOMETHING_ELSE = 1').DOMESTIC_IMAGE_POOL === null &&
      poolLists(null) === null,
  )
  // —— 判据失明检查:成对(现状必 0 红 / 注入一个脱表域名与清空池必红)——
  ok('清单健康检查对现状清单判 0 红', listHealthReds(LISTS).length === 0)
  ok(
    '判据清单为空 ⇒ 必须点名"门全盲",不得记绿(阳性对照)',
    listHealthReds({ ...LISTS, OVERSEAS_IMAGE_ONLY_DOMAINS: [] }).some((r) =>
      r.includes('全盲'),
    ),
  )
  ok(
    '境内池为空 ⇒ 必须点名(消费方一律取不到境内源)',
    listHealthReds({ ...LISTS, DOMESTIC_IMAGE_POOL: [] }).some((r) => r.includes('境内图源池为空')),
  )
  ok(
    '预筛闭合:现状在册域名逐条能在超集里点到(阴性)',
    prefilterClosureReds(LISTS).length === 0,
  )
  ok(
    '预筛不闭合 ⇒ 必须点名(加了池忘了加预筛 = 门对该域名全盲,阳性对照)',
    prefilterClosureReds({
      ...LISTS,
      OVERSEAS_IMAGE_ONLY_DOMAINS: [...LISTS.OVERSEAS_IMAGE_ONLY_DOMAINS, 'nope.invalid'],
    }).length === 1,
  )
  ok(
    '零容忍清单在判据面生效(ZERO_FILES 含 4 个整改文件+池+镜像)',
    [
      'packages/database/seed/lessons.ts',
      'packages/database/seed/update-picsum-urls.ts',
      'apps/miniapp-taro/src/pages/index/index.tsx',
      'apps/miniapp-taro/src/pkg-ai/aigc/list.tsx',
      POOL_MIRROR,
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

  // —— 镜像等值对账的自检:等值必绿、漂移必红、缺文件必"判不出"(不得被读成通过) ——
  {
    // 夹具必须覆盖三个键 —— 只写一个键会让"等值"用例被另外两键的"判不出"顶红,
    // 红的是夹具而非判据(本仓"比对器坏了冒充结论"同型)。
    const poolText = (domestic) =>
      `export const DOMESTIC_IMAGE_POOL: readonly string[] = [
${domestic.map((u) => `  '${u}',`).join('\n')}
]
export const OVERSEAS_IMAGE_ONLY_DOMAINS: readonly string[] = [
  'cdn.example',
]
export const OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT: readonly string[] = [
  'example.site',
]`
    const SAME = ['https://a/x.png', 'https://b/y.jpeg']
    const readSame = () => poolText(SAME)
    ok(
      '镜像等值:三份清单逐字相同 ⇒ 不判红',
      parityReds(readSame).length === 0,
    )
    const readDrift = (f) => (f === POOL_MIRROR ? poolText([SAME[0]]) : poolText(SAME))
    const drift = parityReds(readDrift)
    ok(
      '镜像漂移:少一条 URL ⇒ 必红并点名键',
      drift.length === 1 && drift[0].includes('DOMESTIC_IMAGE_POOL'),
    )
    ok(
      '镜像漂移只点名真正漂的那一键,其余两键不得连带计债',
      drift.length === 1 &&
        !drift[0].includes('OVERSEAS_IMAGE_ONLY_DOMAINS') &&
        !drift[0].includes('OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT'),
    )
    const readNoArray = () => 'export const SOMETHING_ELSE = 1'
    const noArr = parityReds(readNoArray)
    ok(
      '取不到数组字面量 ⇒ 判"判不出"并点名(不得静默算通过)',
      noArr.length === POOL_PAIR_KEYS.length && noArr.every((x) => x.includes('判不出')),
    )
    const readOneSided = (f) => (f === POOL_MIRROR ? 'export const X = 1' : poolText(SAME))
    const oneSided = parityReds(readOneSided)
    ok(
      '只有一侧有清单 ⇒ 逐键"判不出"并点名是哪一侧缺(不得读成"两份相同")',
      oneSided.length === POOL_PAIR_KEYS.length &&
        oneSided.every((x) => x.includes('镜像=缺') && x.includes('shared=有')),
    )
    const readThrow = () => {
      throw new Error('面上取不到')
    }
    const und = parityReds(readThrow)
    ok(
      '两份都读不到 ⇒ 一条"无法判定",不冒绿也不冒充漂移红',
      und.length === 1 && und[0].startsWith('镜像对账无法判定'),
    )
    // null 与"抛错"是两种不同的失败(catBatch 对不存在的路径回 null,层不抛)
    const nullMirror = parityReds((f) => (f === POOL_MIRROR ? null : poolText(SAME)))
    ok(
      '镜像那一侧在本面不存在 ⇒ 一条点名"在本面取不到",不得读成"两份相同"',
      nullMirror.length === 1 && nullMirror[0].includes('在本面取不到'),
    )
    const nullCanon = parityReds((f) => (f === POOL_CANONON ? null : poolText(SAME)))
    ok(
      '单一真相源取不到 ⇒ 判"取不到"并点名路径(没有尺子可比,不冒漂移红)',
      nullCanon.length === 1 && nullCanon[0].includes(POOL_CANONON),
    )
  }

  console.log(cases.join('\n'))
  console.log(`--self-test ${cases.length} 条:${process.exitCode === 1 ? '有红 ❌' : '全绿 ✅'}`)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    selfTest()
    return
  }
  const picked = selectFace({
    staged: args.includes('--staged'),
    worktree: args.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error('❌ ' + picked.error)
    process.exit(2)
  }
  const face = picked.face
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
    listSizes: res.listSizes,
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

// §22d:本文件既要被 CLI 直接执行,也要被 parity 测试 import(import 时绝不许跑 main ——
// 它会派生 git 并按结论 process.exit,把测试进程一起带走)。
import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}

export const __test__ = {
  poolLists,
  stringArrayLiteral,
  findOverseasImageUrls,
  listHealthReds,
  prefilterClosureReds,
  parityReds,
  inScope,
  PREFILTER_DOMAINS,
  POOL_CANONON,
  POOL_MIRROR,
  POOL_PAIR_KEYS,
  ZERO_FILES,
  SELF_EXCLUDE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
