// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * component-props-parity.mjs —— 「两端同名组件 props/行为一致」判据单源(守门 285 的引擎)。
 *
 * 立因(2026-11-03 现读):跨端对账族里,观感维有门 128(几何/圆角/SL/IC/RS + web 两腿),
 * 契约接线有门 259(spec↔小程序集合相等),屏级必填有 lib/cross-end-screen-props;而
 * **同名组件对的 props 键集/必选性对称性**这一格全仓零尺零器物 —— 门 128 头注自证
 * "props 命名只随读数打印,不是观感本身"(S1 证据,不判)。失效型不是账面难看:RN 端调用方
 * 把一个只有对端消费的 prop 传过去 ⇒ 本端静默忽略,不报错、看不出错 —— 与 badge-spec:
 * 缺档同族,只是从"档"降到"腿"。
 *
 * 判据纪律(全族既有规矩,逐条继承,不另造第二把尺):
 *  - **配对单源**:同名对集合 import 门 128 `collect(repoRoot, face)`(§0.6)——配对口径
 *    (选腿优先级 / 可达性剔除 / 别名表)变了,两把尺不可能一段绿一段红。
 *  - **props 解析 = 类型系统自己回答**(机制同 lib/cross-end-screen-props:65-120):
 *    TS TypeChecker 取默认出口/同名出口组件的 props 首参类型;miniapp 腿用 apps/miniapp-taro
 *    编译面、RN 腿用 apps/mobile-rn 编译面(react-native/taro 类型各只在自己端齐)。
 *    正则猜接口名是坏尺(同 screen-props 头注的 0 枚教训),禁止。
 *  - **取不到 ⇒ undetermined 点名,不记绿也不记红**(§0.3):文件不在编译面、出口形态漂移、
 *    一个文件多个组件族(如 ScreenStates 型)都不冒充"已对齐"。
 *  - **INJECTABLE 豁免沿用 screen-props 同一集合**(import,不复制):t/colorScheme/onBack 类
 *    平台注入腿允许只在一端声明,那是承载差异不是行为缺口。
 *
 * 档位(§12e 恒红门禁令):存量 17 对漂移是本仓事实,直接全量判红 = 逼人 --no-verify。
 * 所以本尺 = **台账制差值棘轮**:基线快照登记当下账,只拦**新增退化**(新键/新对/必选性
 * 漂移变多);键集缩小 = 向统一收敛,放行。升绝对零的前置 = 存量归零,归零前不判那种红。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { pathToFileURL } from 'node:url'

import { INJECTABLE } from './cross-end-screen-props.mjs'

/** 语义等价映射表(命名差异 → mapped 类,不计漂移存量;行为缺口不得入此表) */
export const EQUIVALENCE_REL = 'scripts/data/component-props-equivalence.json'

/** 读映射表(盘上现值;表坏 ⇒ undetermined,不回落空表冒充"无命名差") */
export function loadEquivalence(rootDir) {
  const p = join(rootDir, EQUIVALENCE_REL)
  if (!existsSync(p)) return { state: 'ok', entries: [], reason: '映射表未建(0 条目)' }
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'))
    if (!Array.isArray(j?.entries)) return { state: 'undetermined', reason: '映射表缺少 entries 数组', entries: [] }
    return { state: 'ok', entries: j.entries }
  } catch (e) {
    return { state: 'undetermined', reason: `映射表 JSON 坏:${String(e?.message ?? e).slice(0, 120)}`, entries: [] }
  }
}

/** 两端编译面(七类机器事实之外的仓内真相源;路径漂移会在 undetermined 里点名) */
export const END_TSCONFIG = {
  miniapp: 'apps/miniapp-taro/tsconfig.json',
  rn: 'apps/mobile-rn/tsconfig.json',
}

const programCache = new Map()
/**
 * 最小编译面:rootNames 只喂本端入账的配对文件(传递依赖由 TS 顺 import 自动解析),
 * compilerOptions/paths/types 一律取该端 tsconfig 现值 —— 解析语义与全量面一致,
 * 内存从"整端数千文件"降到"配对数百文件"。
 * 立因:全量面双 program 在默认堆(~4GB)实测 OOM(2026-11-03;与门 251 超时同型病灶);
 * 守门跑在提交链/守护派发里,OOM 的尺子比没有尺子更坏(它会让整批守门被 --no-verify 连坐)。
 */
function loadProgram(rootDir, cfgRel, rootFiles) {
  const key = `${rootDir}|${cfgRel}`
  if (programCache.has(key)) return programCache.get(key)
  const cfg = join(rootDir, cfgRel)
  const cfgFile = ts.readConfigFile(cfg, ts.sys.readFile)
  if (cfgFile.error) throw new Error(`读不到 ${cfgRel}:${ts.flattenDiagnosticMessageText(cfgFile.error.messageText, ' ')}`)
  const parsed = ts.parseJsonConfigFileContent(cfgFile.config, ts.sys, rootDir)
  const program = ts.createProgram({
    rootNames: rootFiles.map((f) => join(rootDir, f)),
    options: { ...parsed.options, noEmit: true, skipLibCheck: true },
  })
  programCache.set(key, program)
  return program
}

/**
 * 单端组件 props 全集(名 + 必选位)。候选过滤与 screen 版的 *Screen 正则不同:
 * 组件族认「默认出口」或「与文件同名(含 .taro / Shared 前缀形态)的具名出口」。
 * 一切解析不出来 ⇒ state=undetermined 带 reason —— 调用侧一律不得把 undetermined 读成空集。
 */
export function componentPropsOf(rootDir, fileRel, end, program) {
  const absolute = join(rootDir, fileRel)
  try {
    program = program ?? loadProgram(rootDir, END_TSCONFIG[end])
  } catch (e) {
    return { state: 'undetermined', reason: `编译面取不到:${String(e?.message ?? e).slice(0, 120)}`, props: [] }
  }
  const source = program.getSourceFile(absolute)
  if (!source) return { state: 'undetermined', reason: '该文件不在本端编译面(路径或 tsconfig include 漂移)', props: [] }
  const checker = program.getTypeChecker()
  const symbol = checker.getSymbolAtLocation(source)
  if (!symbol) return { state: 'undetermined', reason: '模块符号解析失败', props: [] }
  const base = fileRel.split('/').pop().replace(/\.(taro\.)?(tsx|jsx)$/, '')
  const exports = checker.getExportsOfModule(symbol)
  const shape = new RegExp(`^(${base}|default|Shared${base}|${base}(Taro|Native)?)$`)
  const cands = exports.filter((s) => shape.test(s.getName()))
  if (cands.length === 0)
    return {
      state: 'undetermined',
      reason: `出口无默认/同名组件(出口=${exports
        .map((s) => s.getName())
        .filter((n) => /^[A-Z]/.test(n))
        .slice(0, 6)
        .join(',')})`,
      props: [],
    }
  if (exports.filter((s) => /^[A-Z]/.test(s.getName()) && !shape.test(s.getName())).length > 0 && cands.length === 0)
    return { state: 'undetermined', reason: '多个具名组件,族级账对不上单组件', props: [] }
  const propsTypes = []
  for (const c of cands) {
    const decl = c.valueDeclaration ?? c.declarations?.[0]
    if (!decl) continue
    let target = c
    if (target.flags & ts.SymbolFlags.Alias) {
      try {
        target = checker.getAliasedSymbol(target)
      } catch {
        /* re-export 解不动 ⇒ 落 undetermined(下面 propsTypes 为空时点名) */
      }
    }
    const t = checker.getTypeOfSymbolAtLocation(target, target.valueDeclaration ?? decl)
    for (const s of t.getCallSignatures()) {
      const p = s.getParameters()[0]
      if (p) propsTypes.push(checker.getTypeOfSymbol(p))
    }
    if (propsTypes.length === 0) {
      const sig = checker.getSignatureFromDeclaration(decl)
      const p = sig?.getParameters?.()[0]
      if (p) propsTypes.push(checker.getTypeOfSymbol(p))
    }
  }
  if (propsTypes.length === 0)
    return { state: 'zero-props', reason: '组件签名里没有 props 参数(零 props 组件)', props: [] }
  const map = new Map()
  for (const type of propsTypes)
    for (const prop of type.getProperties()) {
      const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0
      const prev = map.get(prop.getName())
      map.set(prop.getName(), { optional: prev ? prev.optional && optional : optional })
    }
  return {
    state: 'ok',
    props: [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * 一对的差集读数(纯函数,镜像测试直接喂两侧 props 表;§22c:判据只住这一份)。
 * 规则:键并集 = 两侧 props 名集(排除 INJECTABLE);同键必选性不同 = reqDrift。
 * 任一侧 undetermined ⇒ state=undetermined(不产出差集,不冒充"没有差")。
 * zero-props 一侧对 ok 一侧 ⇒ 差 = 对端全部键(零 props ≠ 无缺口,是整族未接)。
 */
export function pairDelta(name, rnRes, miniRes, equivalenceEntries = []) {
  if (rnRes.state === 'undetermined' || miniRes.state === 'undetermined')
    return {
      name,
      state: 'undetermined',
      reason: `rn=${rnRes.state}${rnRes.reason ? `(${rnRes.reason})` : ''} mini=${miniRes.state}${miniRes.reason ? `(${miniRes.reason})` : ''}`,
    }
  const isProps = (s) => s === 'ok' || s === 'zero-props'
  if (!isProps(rnRes.state) || !isProps(miniRes.state))
    return { name, state: 'undetermined', reason: `未知解析形态 rn=${rnRes.state} mini=${miniRes.state}` }
  const rnMap = new Map(rnRes.props.filter((x) => !INJECTABLE.has(x.name)).map((x) => [x.name, x]))
  const miniMap = new Map(miniRes.props.filter((x) => !INJECTABLE.has(x.name)).map((x) => [x.name, x]))
  let onlyRn = [...rnMap.keys()].filter((k) => !miniMap.has(k)).sort()
  let onlyMini = [...miniMap.keys()].filter((k) => !rnMap.has(k)).sort()
  const reqDrift = []
  for (const k of rnMap.keys()) {
    if (!miniMap.has(k)) continue
    if (rnMap.get(k).optional !== miniMap.get(k).optional)
      reqDrift.push(`${k}(${rnMap.get(k).optional ? 'op' : 'req'}/${miniMap.get(k).optional ? 'op' : 'req'})`)
  }
  reqDrift.sort()
  /* 语义等价映射:同一槽位两端命名不同 ⇒ 命中条目归 mapped,不计存量;
     行为缺口不得入表(见 EQUIVALENCE_REL 头注)。条目只在"至少一侧此刻确实漂移"时生效,
     两端已自然对齐的条目记 mappedStale 供门体检,不静默留白。 */
  const rnAll = new Set(rnRes.props.map((x) => x.name))
  const miniAll = new Set(miniRes.props.map((x) => x.name))
  const mapped = []
  const mappedStale = []
  const mappedRn = new Set()
  const mappedMini = new Set()
  for (const e of equivalenceEntries.filter((x) => x && x.pair === name)) {
    const oursOnRn = rnAll.has(e.ours)
    const theirsOnMini = miniAll.has(e.theirs)
    const oursDrift = onlyRn.includes(e.ours)
    const theirsDrift = onlyMini.includes(e.theirs)
    if (!oursOnRn || !theirsOnMini || (!oursDrift && !theirsDrift)) {
      mappedStale.push({ ours: e.ours, theirs: e.theirs, why: !oursOnRn || !theirsOnMini ? 'declaration-missing' : 'no-longer-drift' })
      continue
    }
    mapped.push({ ours: e.ours, theirs: e.theirs, kind: e.kind })
    if (oursDrift) mappedRn.add(e.ours)
    if (theirsDrift) mappedMini.add(e.theirs)
  }
  if (mappedRn.size) onlyRn = onlyRn.filter((k) => !mappedRn.has(k))
  if (mappedMini.size) onlyMini = onlyMini.filter((k) => !mappedMini.has(k))
  return {
    name,
    state: 'ok',
    onlyRn,
    onlyMini,
    reqDrift,
    mapped,
    mappedStale,
    mappedKeyCount: mappedRn.size + mappedMini.size,
    driftTotal: onlyRn.length + onlyMini.length + reqDrift.length,
  }
}

/**
 * 面级全账:配对取门 128 collect(单源)→ 逐对两端解析 → 差集表。
 * collect 取不到(返回无 pairs)⇒ {state:'undetermined'}(整尺不产结论,§0.3)。
 */
export async function computeParity(rootDir, face = 'head') {
  let parityMod
  try {
    parityMod = await import(pathToFileURL(join(rootDir, 'scripts', 'check-cross-end-ui-parity.mjs')).href)
  } catch (e) {
    return { state: 'undetermined', reason: `门 128 模块取不到:${String(e?.message ?? e).slice(0, 140)}` }
  }
  const collect = parityMod.collect ?? parityMod.__test__?.collect
  if (typeof collect !== 'function')
    return { state: 'undetermined', reason: '门 128 collect 出口取不到(配对单源失踪,不自行重扫)' }
  let coll
  try {
    coll = collect(rootDir, face, {})
  } catch (e) {
    return { state: 'undetermined', reason: `collect(${face}) 抛错:${String(e?.message ?? e).slice(0, 140)}` }
  }
  const pairs = coll?.pairs?.pairs ?? coll?.pairs
  if (!Array.isArray(pairs))
    return { state: 'undetermined', reason: 'collect 返回里没有 pairs 数组(配对面漂移,逐条不判)' }
  let rnProgram = null
  let miniProgram = null
  try {
    rnProgram = loadProgram(rootDir, END_TSCONFIG.rn, [...new Set(pairs.map((p) => p.rn))])
    miniProgram = loadProgram(rootDir, END_TSCONFIG.miniapp, [...new Set(pairs.map((p) => p.miniapp))])
  } catch {
    /* 单端程序建不起 ⇒ 逐对落 undetermined(componentPropsOf 各自点名),不整批冒充读过 */
  }
  const equiv = loadEquivalence(rootDir)
  if (equiv.state !== 'ok') return { state: 'undetermined', reason: equiv.reason }
  const deltas = []
  for (const p of pairs) {
    const rnRes = componentPropsOf(rootDir, p.rn, 'rn', rnProgram ?? undefined)
    const miniRes = componentPropsOf(rootDir, p.miniapp, 'miniapp', miniProgram ?? undefined)
    deltas.push(pairDelta(p.name, rnRes, miniRes, equiv.entries))
  }
  return { state: 'ok', face, deltas, equivalence: { entryCount: equiv.entries.length } }
}

export const __test__ = { componentPropsOf, pairDelta, computeParity, loadEquivalence, END_TSCONFIG, EQUIVALENCE_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
