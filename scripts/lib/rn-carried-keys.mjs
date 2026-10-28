// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lib/rn-carried-keys.mjs —— 「承载页可达的 i18n 键」的唯一算式(单一真相源)。
 *
 * 立因(2026-10-26 现读):小程序端承载 RN 壳/共享屏后,取词走端内包(`shared` + `miniapp-taro`)。
 * 实测 3 张承载页闭包里共 **46 个键**在端内不可解析(`dashboard.loadFailed`、`login.platformWechat`、
 * `mcpStore.cannotInstall` …),因为它们只住在 `packages/i18n/messages/mobile-rn/*.json`。
 * 此前这些字"看起来有",是因为 RN 那份内联了 10 个 JSON 词包的模块被逐页打进了分块(每页 +1.36 MB)
 * —— 那是**用体积换文字**,不是对齐。正确解法是把"可达键"作为端内包的第三层输入自动并进去
 * (逐语取自 mobile-rn 包,零新译),并由门判"可达键必须在包里"。
 *
 * 本文件只算,不写盘、不判定红绿;写盘在 gen-i18n-compressed,判定在门 251 —— 两边 import 同一份。
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import ts from 'typescript'
import { walkClosure } from './rn-shell-closure.mjs'

const TS_EXTS = ['.tsx', '.ts', '.jsx', '.js']

/** `t('a.b')` / `t("a.b")` / `i18n.t('a.b')` / `t('a.b', {...})`;模板串与变量键不算(算不出就是不算)。 */
const T_KEY_RE = /(?:\bi18n\.)?\bt\(\s*['"]([A-Za-z][A-Za-z0-9_.]*)['"]/g

/** 一个文件里显式取用的 i18n 键(去重排序)。 */
export function extractTKeys(text) {
  const out = new Set()
  if (!text) return out
  for (const m of String(text).matchAll(T_KEY_RE)) out.add(m[1])
  return out
}

/** 点分路径取值:`a.b.c` → obj.a.b.c;取不到返回 undefined。 */
export function pickByPath(obj, dotted) {
  return dotted.split('.').reduce((cur, seg) => (cur && typeof cur === 'object' ? cur[seg] : undefined), obj)
}

/** 只保留"端内还没有"的键 ⇒ 绝不覆盖端内已定的措辞(端内包是译文真相源,RN 包只补漏)。 */
export function subsetMissing(haveRoots, keys, rnPack) {
  const has = (k) => haveRoots.some((r) => pickByPath(r, k) !== undefined)
  const out = {}
  for (const k of [...keys].sort()) {
    if (has(k)) continue
    const v = pickByPath(rnPack, k)
    if (v === undefined) continue
    const segs = k.split('.')
    let node = out
    for (let i = 0; i < segs.length - 1; i++) node = node[segs[i]] ??= {}
    node[segs.at(-1)] = v
  }
  return out
}

/** packages/app 桶口:名字 → 特性文件(仓库相对)。星号再导出单独记,遇到就整支入图。 */
export function buildBarrelMap(readFile, barrelRel = 'packages/app/src/index.ts') {
  const text = readFile(barrelRel) ?? ''
  const named = new Map()
  const stars = []
  const src = ts.createSourceFile('barrel', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const resolveSpec = (fromDir, spec) => {
    const base = fromDir + '/' + spec
    for (const e of TS_EXTS) if (readFile(base + e) !== null && readFile(base + e) !== undefined) return base + e
    for (const e of TS_EXTS) if (readFile(base + '/index' + e) !== null && readFile(base + '/index' + e) !== undefined) return base + '/index' + e
    return null
  }
  const dirOf = (p) => p.split('/').slice(0, -1).join('/')
  const visit = (node) => {
    if ((ts.isExportDeclaration(node) || ts.isImportDeclaration(node)) && node.moduleSpecifier?.text?.startsWith('.')) {
      const spec = node.moduleSpecifier.text
      const target = resolveSpec(dirOf(barrelRel), spec)
      const names = []
      if (ts.isNamedExports?.(node.exportClause)) for (const el of node.exportClause.elements) names.push(el.propertyName?.text ?? el.name.text)
      if (ts.isImportClause(node) && ts.isNamedImports(node.namedBindings)) for (const el of node.namedBindings.elements) names.push(el.propertyName?.text ?? el.name.text)
      if (target) for (const n of names) named.set(n, target)
      if (ts.isExportDeclaration(node) && !node.exportClause) stars.push(target)
    }
    node.forEachChild(visit)
  }
  src.statements.forEach(visit)
  return { named, stars: stars.filter(Boolean) }
}

/**
 * 从"承载页清单"算出可达文件集与可达键集。
 * carriers = [{rel, text}](小程序端 import 了 @rn-shells/* 或 @ihui/rn-app/* 的那些页)。
 */
export function carriedKeys({ carriers, readFile: readFileRaw = null, readBatch: readBatchRaw = null, resolveRel, mpSrc = 'apps/miniapp-taro/src' }) {
  // 注入进来的读取器可能是"门/生成器那把面尺"—— 它们对目录、对特殊文件是**抛错**的
  // (readWorktreeFile 遇 EISDIR 抛 Undetermined)。闭包解析本来就要反复探路,
  // 所以这里统一折算成 null:取不到正文 = 这一支不走,而不是整轮崩。
  const safeOne = (rel) => {
    try {
      if (readBatchRaw) return readBatchRaw([rel]).get(rel) ?? null
      return readFileRaw(rel) ?? null
    } catch {
      return null
    }
  }
  const safeBatch =
    readBatchRaw ??
    ((rels) => new Map(rels.map((r) => [r, safeOne(r)])))
  const readFile = safeOne
  const barrel = buildBarrelMap(readFile)
  const RN_ROOT = 'apps/mobile-rn/src'
  const toRel = (fromFile, spec) => {
    if (spec.startsWith('@rn-shells/')) return `${RN_ROOT}/screens/${spec.slice('@rn-shells/'.length)}.tsx`
    if (spec === '@ihui/rn-app') return 'packages/app/src/index.ts'
    if (spec.startsWith('@ihui/rn-app/')) return resolveRel('packages/app/src/' + spec.slice('@ihui/rn-app/'.length))
    if (spec.startsWith('@/')) return resolveRel(mpSrc + '/' + spec.slice(2))
    if (spec.startsWith('.')) return resolveRel(fromFile.split('/').slice(0, -1).join('/') + '/' + spec)
    return null
  }
  const roots = carriers.flatMap((c) => [
    { file: c.rel, text: c.text },
    ...barrel.stars.map((s) => ({ file: s, text: readFile(s) })),
  ])
  const walk = walkClosure({
    roots,
    readFile,
    readBatch: safeBatch,
    toRel,
    isBare: (s) => !s.startsWith('.') && !s.startsWith('@/') && !s.startsWith('@rn-shells/') && !s.startsWith('@ihui/rn-app'),
    barrelOf: (file, spec, names) => (spec === '@ihui/rn-app' ? names.map((n) => barrel.named.get(n)).filter(Boolean) : null),
  })
  const keys = new Set()
  for (const rel of walk.files) for (const k of extractTKeys(readFile(rel))) keys.add(k)
  for (const c of carriers) for (const k of extractTKeys(c.text)) keys.add(k)
  return { keys, files: [...walk.files], unresolved: walk.unresolved, walk }
}

/** 带扩展名的说明符(如 `../../package.json`)先按字面试,再走扩展名探测。 */
export function makeResolver(readFile, tsExts = TS_EXTS) {
  return (base) => {
    if (readFile(base) !== null && readFile(base) !== undefined) return base
    for (const e of tsExts) if (readFile(base + e) !== null && readFile(base + e) !== undefined) return base + e
    for (const e of tsExts) if (readFile(base + '/index' + e) !== null && readFile(base + '/index' + e) !== undefined) return base + '/index' + e
    return null
  }
}

/**
 * 同一套探路的批量版:一条说明符的 9 个候选**一次问完**。
 * 磁盘面用不上(逐文件读很便宜),git 面必须用它 —— 否则 122 个文件的闭包要起 1000 次 git 进程,
 * 门慢到没人跑就等于没装(§0.9)。
 */
export function makeBatchResolver(readBatch, tsExts = TS_EXTS) {
  return (base) => {
    const cands = [base, ...tsExts.map((e) => base + e), ...tsExts.map((e) => `${base}/index${e}`)]
    let got
    try {
      got = readBatch(cands)
    } catch {
      return null
    }
    return cands.find((r) => got.get(r) !== null && got.get(r) !== undefined) ?? null
  }
}

/**
 * 从"仓库现状"算可达键:承载页 = 端内 import 了 `@rn-shells/*` 或 `@ihui/rn-app/*` 的那些 .tsx。
 * 文件枚举与读取都由调用方注入 ⇒ 同一份算式可跑工作树面,也可跑 HEAD/索引面(守门 118 同面同轮)。
 */
export function carriedKeysFromRepo({ readFile: readFileRaw = null, readBatch: readBatchRaw = null, listFiles, mpSrc = 'apps/miniapp-taro/src' }) {
  const safeOne = (rel) => {
    try {
      if (readBatchRaw) return readBatchRaw([rel]).get(rel) ?? null
      return readFileRaw(rel) ?? null
    } catch {
      return null
    }
  }
  const safeBatch =
    readBatchRaw ??
    ((rels) => {
      const out = new Map()
      for (const r of rels) out.set(r, safeOne(r))
      return out
    })
  const resolveRel = readBatchRaw ? makeBatchResolver(safeBatch) : makeResolver(safeOne)
  const rels = listFiles(mpSrc).filter((p) => p.endsWith('.tsx'))
  const texts = safeBatch(rels)
  const carriers = []
  for (const rel of rels) {
    const text = texts.get(rel) ?? null
    if (text && /@rn-shells\/|@ihui\/rn-app\//.test(text)) carriers.push({ rel, text })
  }
  const r = carriedKeys({ carriers, readFile: safeOne, readBatch: safeBatch, resolveRel, mpSrc })
  // 第二格:共享特性屏**整片**纳入(2026-10-28 立,治"页面上出现原始键")。
  // 为什么不只靠上面那条 import 闭包:闭包在 HEAD 面上有断链(现读承载页 141 枚 → 可达文件 294 枚 /
  // 可达键 432 个,而 259 枚 `packages/app/src/features/**` 屏自述消费 1994 个键),漏掉的那批屏
  // 被承载页渲染时,端内包取不到它的键 ⇒ 屏幕上就是 `activityDetail.title` 这种原始键(实测
  // `pkg-content/activity-detail-shared` 正是纯壳承载页,自身零文案)。承载页只可能渲染共享屏,
  // 故"共享屏消耗的键"是这条补键的安全上界:多补的键只是词包体积(实测 328 键 / 约 10.4KB),
  // 而漏补的键是用户可见的破相。端内已有措辞一律不覆盖(subsetMissing 同一口径)。
  const featureRoot = 'packages/app/src'
  let featureFiles = []
  try {
    featureFiles = listFiles(featureRoot).filter((p) => p.includes('/features/') && p.endsWith('.tsx'))
  } catch {
    featureFiles = []
  }
  const featureTexts = featureFiles.length ? safeBatch(featureFiles) : new Map()
  for (const rel of featureFiles) {
    const text = featureTexts.get(rel) ?? ''
    for (const k of extractTKeys(text)) r.keys.add(k)
    // 裸字面量键表也必须认:`owner: 'circleMember.owner'` / `return 'connectedAccounts.platformWechat'`
    // 这型在屏里当键表登记,调用点再 `t(KEY[role])` —— extractTKeys 只看得到 `t('x')`,这两族实测漏补。
    // 形状取「小写字母开头 + 至少一个点 + 段内驼峰」(与正文闸 screenConsumedKeys 同一形状):
    // 路由名(带斜杠)与包名(带 @)落不进来;多认出来的键还要在 RN 包里存在才会被 subsetMissing 采用。
    for (const m of text.matchAll(/'([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)'/g)) r.keys.add(m[1])
  }
  return { ...r, carriers, featureFiles: featureFiles.length }
}
/** 从生成件文本里抠出一个字符串常量(词包 b64 就是单行长字符串)。 */
/**
 * 解端内生成的词包(与运行时同一条路:base64 → gunzip → JSON)。
 * fflate 从端内依赖面取(pnpm 隔离布局下根 scripts/ 解析不到,与生成器同一个 createRequire 钉法)。
 */
export function decodePackB64(b64, repoRoot) {
  const { gunzipSync, strFromU8 } = createRequire(join(repoRoot, 'apps/miniapp-taro/package.json'))('fflate')
  const bytes = new Uint8Array(Buffer.from(String(b64), 'base64'))
  return JSON.parse(strFromU8(gunzipSync(bytes)))
}

/** 从生成件里取某一语的 b64(`{ en: '…', ja: '…' }` 形态)。 */
export function extractLocaleB64(tsText, locale) {
  const m = new RegExp(`['\"]?${locale}['\"]?\\s*:\\s*'([A-Za-z0-9+/=]+)'`).exec(tsText)
  return m ? m[1] : null
}

export function extractStringConst(tsText, name) {
  const m = new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*'([^']*)'`).exec(tsText)
  return m ? m[1] : null
}

/** 把嵌套词包摊成点分键集合。 */
export function flattenKeys(obj, pre = '') {
  const out = new Set()
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = pre ? `${pre}.${k}` : k
    if (isPlain(v)) {
      for (const sub of flattenKeys(v, key)) out.add(sub)
      if (Object.keys(v).length === 0) out.add(key)
    } else out.add(key)
  }
  return out
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export const __test__ = {
  extractTKeys,
  pickByPath,
  subsetMissing,
  buildBarrelMap,
  carriedKeys,
  carriedKeysFromRepo,
  makeResolver,
  makeBatchResolver,
  decodePackB64,
  extractStringConst,
  flattenKeys,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
