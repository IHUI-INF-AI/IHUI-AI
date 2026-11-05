// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// i18n-content-exempt-file: 配额读数(实测数与上限数)即拒装文案本身,拆开写会让拒绝不可整改 until 2027-05-04
/**
 * 解压/落位配额 —— `maxEntries` 与 `maxExpandedBytes` 双上限的**唯一判据实现**(纯函数,零 fs)。
 *
 * 立的因(goal-b49 取证 Q1 §3 #9):对照程序在 `bundled-resources/manifest.json` 的每枚归档里
 * 显式写死 `archive.maxEntries` 与 `archive.maxExpandedBytes`(现读样本:97 条目 / 25,864,942 B),
 * 于是"包内条目数"与"展开后字节数"两条上限在解压**之前**就把解压炸弹挡在外面。
 * 本仓装机面此前**一条上限都没有**:`copyDirRecursive` 对来路不明的树照单全收(既不看条目数,
 * 也不看展开体积),`installer.ts` 里唯一的上限 `DIGEST_LIMITS` 只在**落位之后**采摘要时才生效。
 *
 * 三条纪律:
 *   1. **超限必拒**,且拒绝必须发生在任何写盘动作之前(次序由调用方 `installer.ts` 保证)。
 *   2. **读数必须同时带实测数与上限数**:只说"超限"的结论没人能整改(AGENTS §5e-1 可整改性),
 *      所以 `report` 恒把两侧数字打出来,量不到的那一维显式写 `量不出` 而不是补 0。
 *   3. **三态**(§0.3):上限没声明 / 上限形态坏 / 实测取不到 ⇒ `unjudged` 并点名是哪一维,
 *      既不记绿(`within`)也不冒红(`exceeded`)。
 */

/** 双上限(来自清单声明的那一档) */
export interface ArchiveQuotaLimits {
  maxEntries: number;
  maxExpandedBytes: number;
}

/** 实测读数;`null` = 这一维量不出(读不动/中途失败),**不等于 0** */
export interface ArchiveObservation {
  entries: number | null;
  expandedBytes: number | null;
}

export type ArchiveQuotaVerdict = 'within' | 'exceeded' | 'unjudged';

export interface ArchiveQuotaDecision {
  verdict: ArchiveQuotaVerdict;
  /** 逐条点名哪一维超限/量不出,并带上两侧数字 */
  reasons: string[];
  /** 单行读数:实测数与上限数同时在场,供人直接照做 */
  report: string;
  observedEntries: number | null;
  observedBytes: number | null;
  limitEntries: number | null;
  limitBytes: number | null;
  /** 超限的维度(未超限/未判定时为空) */
  exceededDimensions: Array<'entries' | 'bytes'>;
}

/**
 * 本仓装机面(插件落位)的默认双上限。**数值不是拍的**:
 *   下限锚 = 摘要台账 `installer.ts::DIGEST_LIMITS`(maxFiles 2000 / maxTotalBytes 128 MiB)。
 *   不变量 = "能被放行落位的树"必须**包含**"能被摘要台账证到的树",否则会出现"装上了却永远
 *   证不了"的死格(采集侧落 `unjudged`);故拷贝档取台账档的整数倍余量。
 *   上限意图 = 挡"炸弹形"(10^5~10^7 条目 / GiB 级展开),不裁正当插件。
 */
export const INSTALL_COPY_QUOTA: ArchiveQuotaLimits = {
  maxEntries: 20_000,
  maxExpandedBytes: 512 * 1024 * 1024,
};

/** 一维读数:`实测(或 量不出) / 上限(或 未声明)` —— report 与 reasons 共用同一个形 */
function side(observed: number | null, limit: number | null): string {
  return `${observed === null ? '量不出' : observed} / 上限 ${limit === null ? '未声明' : limit}`;
}

function readCount(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * 配额判定(唯一出口)。
 * 判序:先审上限形态(判据本身坏了就不许拿它裁别人)⇒ 再审实测是否齐 ⇒ 两维各自比 ⇒ 任一跳牌即 `exceeded`。
 */
export function evaluateArchiveQuota(
  observed: ArchiveObservation | null | undefined,
  limits: ArchiveQuotaLimits | null | undefined,
): ArchiveQuotaDecision {
  const obsEntries = readCount(observed?.entries);
  const obsBytes = readCount(observed?.expandedBytes);
  const limitEntries = readCount(limits?.maxEntries);
  const limitBytes = readCount(limits?.maxExpandedBytes);

  const stamp = (
    verdict: ArchiveQuotaVerdict,
    reasons: string[],
    exceeded: Array<'entries' | 'bytes'> = [],
  ): ArchiveQuotaDecision => ({
    verdict,
    reasons,
    exceededDimensions: exceeded,
    observedEntries: obsEntries,
    observedBytes: obsBytes,
    limitEntries,
    limitBytes,
    report:
      `解压配额 条目 ${side(obsEntries, limitEntries)} · 展开字节 ${side(obsBytes, limitBytes)} ⇒ ` +
      (verdict === 'exceeded' ? `超限(${exceeded.join('+')})` : verdict === 'within' ? '未超限' : '未判定'),
  });

  if (!limits) {
    return stamp('unjudged', ['上限未声明:没有 maxEntries/maxExpandedBytes,配额维无从判(不记绿)']);
  }
  if (limitEntries === null || limitBytes === null) {
    const bad = [
      limitEntries === null ? `maxEntries(${String(limits.maxEntries)})` : '',
      limitBytes === null ? `maxExpandedBytes(${String(limits.maxExpandedBytes)})` : '',
    ].filter((s) => s.length > 0);
    return stamp('unjudged', [`上限形态非法:${bad.join('、')} 不是有限非负数 ⇒ 判据本身坏,不拿它裁实测`]);
  }
  if (!observed) {
    return stamp('unjudged', ['实测取不到(未传观测面):不拿"没量过"冒充"没超限"']);
  }
  if (obsEntries === null || obsBytes === null) {
    const miss = [obsEntries === null ? '条目数' : '', obsBytes === null ? '展开字节' : ''].filter((s) => s.length > 0);
    return stamp('unjudged', [`实测有维度量不出(${miss.join('、')}):量不出 ≠ 没超限`]);
  }

  const exceeded: Array<'entries' | 'bytes'> = [];
  const reasons: string[] = [];
  if (obsEntries > limitEntries) {
    exceeded.push('entries');
    reasons.push(`条目超限:实测 ${side(obsEntries, limitEntries)}`);
  }
  if (obsBytes > limitBytes) {
    exceeded.push('bytes');
    reasons.push(`展开字节超限:实测 ${side(obsBytes, limitBytes)}`);
  }
  if (exceeded.length > 0) return stamp('exceeded', reasons, exceeded);
  return stamp('within', [`双上限均未触:条目 ${side(obsEntries, limitEntries)} · 字节 ${side(obsBytes, limitBytes)}`]);
}

/** 该结论是否允许继续落位:只认 `within` —— `unjudged` 一律不算放行证据(§0.3) */
export function quotaAllowsLanding(decision: ArchiveQuotaDecision): boolean {
  return decision.verdict === 'within';
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
