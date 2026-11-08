// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门判据面注册表(2026-11-08):把"只看本笔改动(delta)"与"看仓库存量(stock)"分开,
// 供 scripts/lib/guardian-executor.mjs 在提交路径上对 stock 门做"未触及只报数、触及才阻断"。
//
// 为什么住独立 JSON-式常量而不是给 guardian-runner.mjs 的 341 条 checks 逐条加字段:
// 门 192(注册表工作树超集,--staged 问责)按「条目行逐字等值」比对 HEAD↔索引,给既有条目插字段
// 会被判成 228 条 P2 改写(2026-10-12 实测即红,提交被拦)。故分类面住本文件,注册表字节不动。
//
// stock 集合来源(2026-11-08 静态分桶,只覆盖已被证有存量面的门):
//   · 32 道脚本完全不读 --staged(判据面 = 工具全仓/仓库存量)
//   · 2 道 refs 面(for-each-ref/show-ref/branch 列举)
//   · 90 道全树枚举(ls-files/ls-tree/readdir)且无 delta 过滤
//   并集 104 道(含 41/57/204/70b 四道已实证存量面门;57 属"delta 选 blob、整仓判定"的启发式盲区,显式纳入)。
//
// 语义(由调用方 decideStockOutcome 实施):
//   · delta 门:meta 档常跑、全量档必跑,判红即阻断(行为不变)。
//   · stock 门:本笔未触及它的判据面 ⇒ 判红只报数 + 写存量台账,rc 不受影响;
//              本笔触及 ⇒ 升级为阻断;显式 full/CI/不带 --staged ⇒ 一律阻断。
//   · refs 面(41/30b):"触及"= 相对上次基线新建/重指了非当前分支;否则只报数。

/** stock 门 id 集合(串行比较用,String(check.id) 后查)。 */
export const STOCK_GATE_IDS = new Set(["100","104","117","11c","122","125","126","127","128","129","130","132","133","134","140","142","143","148","149","150","152","163","164","165","166","174","175","176","178","179","180","181","182","183","184","185","187","188","192","202","204","208","215","220","222","223","230","233","237","241","242","243","244","245","246","247","248","251","252","255","26","264","265","269","28","281","284","285","294","296","297","2e-dupns","2f-cli","304","306","307","308","30b","311","33","37","4","40","41","48","49","4b","4c","57","58","59","61","62","64","65","66","68","70b","75","85","86","88","9","94"])

/** 只在全量档出现、但静态判据面无法确证的门:先按 delta 保守处理,待逐门确认后迁入 stock。 */
export const PENDING_DELTA_GATE_IDS = new Set(["1","10","102","103","105","106","107","108","109","11","111","112","113","115","116","119","11b","11d","11e","11f","11g","11h","12","120","121","123","124","131","135","136","137","138","139","141","144","145","146","147","15","157","159","160","161","167","168","17","170","171","177","18","189","195","197","198","199","2","20","200","201","205","206","207","209","212","213","214","217","218","219","224","227","228","231","232","235","238","240","249","24a","25","253","254","256","258","259","260","263","266","268","27","270","271","272","273","274","275","278","279","283","287","288","289","29","290","291","295","2b","2c","2d","2e","2f-ext","2f-miniapp-taro","2f-mobile-rn","2f-shared","2f-shared-diff","2f-web","2g-ext","2g-web","2h-ext","2i-ext","2j-shared","2k-shared","2m-shared","2n-web","2o-miniapp-taro","2o-mobile-rn","2o-shared","2p-api","2q-cli","2r-miniapp-taro","2s-mobile-rn","2t-api","2u-cli","2v-miniapp-taro","2w-mobile-rn","30","309","30c","310","34","35","36","38","39","42","46","50","51","52","53","55","56","6","60","63","67","69","7","70","72","73","74","77","78","8","81","83","84","87","90","91","93","97","98"])

/** refs 面门:触及判据 = 分支引用相对基线发生变化(排除当前分支自身)。 */
export const REFS_FACE_GATE_IDS = new Set(["30b","41"])

/**
 * stock 门的判据面路径。只有会"因为仓库存量而判红、且输出不点名暂存路径"的门需要显式列出;
 * 其余回落到 check.stagedTriggers 去掉全局通配后的窄清单(窄清单为空则保持通配 = 保守阻断)。
 */
export const STOCK_FACE_PATHS = {
  '57': ['apps/miniapp-taro/', 'apps/web/', 'packages/shared/', 'apps/ai-service/app/core/sse_contract.py', 'scripts/data/'],
  '204': ['apps/', 'packages/'],
  '70b': ['packages/i18n/messages/', 'apps/miniapp-taro/src/', 'apps/web/src/', 'packages/shared/src/'],
}

/** 该门是否 stock 判据面。 */
export function gateFace(check) {
  return STOCK_GATE_IDS.has(String(check?.id)) ? 'stock' : 'delta'
}

/** 该门是否 refs 面。 */
export function isRefsFace(check) {
  return REFS_FACE_GATE_IDS.has(String(check?.id))
}

/** stock 门用来判"本笔是否触及"的路径集合。 */
export function stockFacePaths(check) {
  const curated = STOCK_FACE_PATHS[String(check?.id)]
  if (curated && curated.length) return curated
  const raw = Array.isArray(check?.stagedTriggers) ? check.stagedTriggers : []
  const narrow = raw.filter((t) => t !== '**/*' && t !== '**' && t !== '*' && t !== '**/*.*')
  return narrow.length ? narrow : raw
}

/**
 * 判定 stock 门这一次判红要不要阻断。
 * 只对 kind='red'(有结论的违规)降级;undetermined/crash 一律阻断(未判定 ≠ 通过)。
 */
export function decideStockOutcome({ face, touched, explicitFull, kind }) {
  if (face !== 'stock') return 'block'
  if (explicitFull) return 'block'
  if (touched) return 'block'
  if (kind === 'red') return 'advisory'
  return 'block'
}

/**
 * refs 面"触及"判定:当前 refs 快照 vs 上次基线。
 * 排除当前分支自身(每次提交都会移动它,不是"新建/重指旁支")。
 *
 * "触及"= 新建 ref(基线里没有)/ 删除 ref / **非快进重指**(新值不是旧值的后代)。
 * 快进前进(主线被推着往前走)不算"重指":那是同一开发线上正常推进,
 * 若把它也算触及,则每次 push 之后**任何**工作区的下一笔提交都会被 41 假红一次。
 * 判定所需的后代关系由调用方注入 `isFastForward(oldSha,newSha)`;不注入或读不了 ⇒ 按触及处理
 * (失效方向是阻断,不是放行)。
 */
export function refsTouched(current, baseline, currentBranch, isFastForward) {
  if (!baseline || typeof baseline !== 'object') return false
  const branch = String(currentBranch || '')
  const branchRefs = new Set([branch, branch.startsWith('refs/') ? branch : `refs/heads/${branch}`])
  const cur = current || {}
  const base = baseline || {}
  const names = new Set([...Object.keys(cur), ...Object.keys(base)])
  for (const name of names) {
    if (branchRefs.has(name)) continue
    const now = cur[name]
    const was = base[name]
    if (now === was) continue
    // 新建 / 删除:没有可比的后代关系,直接算触及。
    if (!now || !was) return true
    if (typeof isFastForward === 'function' && isFastForward(was, now)) continue
    return true
  }
  return false
}

/**
 * 存量台账一行(可累加、可追溯):门 id + 读数 + 被点名的项 + 当时的 HEAD/暂存面。
 * 执行器负责 append 到 .ihui-agent/state/gate-stock-ledger.jsonl;这里只造形状,便于夹具断言。
 */
export function buildStockLedgerEntry({
  at,
  head,
  check,
  touched,
  rc,
  items,
  stagedSample,
  stagedCount,
  explicitFull,
}) {
  return {
    at: at || new Date().toISOString(),
    head: head || '',
    gateId: String(check?.id ?? ''),
    label: check?.label ?? '',
    script: check?.script ?? '',
    face: 'stock',
    touched: !!touched,
    rc: typeof rc === 'number' ? rc : null,
    redCount: Array.isArray(items) ? items.length : 0,
    items: Array.isArray(items) ? items.slice(0, 20) : [],
    stagedCount: Number.isFinite(stagedCount) ? stagedCount : 0,
    stagedSample: Array.isArray(stagedSample) ? stagedSample.slice(0, 10) : [],
    explicitFull: !!explicitFull,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
