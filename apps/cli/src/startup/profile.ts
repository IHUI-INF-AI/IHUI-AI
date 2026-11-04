// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 启动画像器(纯判据,零 I/O)—— 对标 WorkBuddy `startup-profile.cjs`(REA 取证
 * `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/W1-workbuddy-main.md` 缺口 ⑪)。
 *
 * 与对方的差异(复现行为与设计,不抄源码):
 *   - 本层**不碰文件系统、不读环境变量、不接网络** —— 时钟由调用方注入,
 *     消费方(index.ts)负责在入口登记里程碑并决定何时落输出;
 *   - 三态诚实:`measured` 只在全量必需里程碑都量到时出现;缺任何一枚 ⇒
 *     `unjudged` 并**点名缺哪枚**,绝不把"没量到"渲染成 0ms 冒充"启动很快"
 *     (§0.3「没判绝不写成判过」+ §「读数不得断行」同族口径);
 *   - 时钟回拨(非单调)同样落 unjudged 并点名,不静默产出负耗时。
 *
 * 结论行单行不折行、ASCII 英文(守门 70 硬编码中文棘轮:诊断播报走 ASCII,
 * 与 index.ts 里 background-drain 那条同一惯例)。
 */

/** 全部受支持的里程碑名(内部 camelCase;渲染时转 kebab-case)。 */
export const MILESTONE_NAMES = ['entry', 'commandParsed', 'firstAwait', 'exit'] as const;

export type MilestoneName = (typeof MILESTONE_NAMES)[number];

/** 里程碑名 → 结论行里的渲染形态(单行、无空格,读者不需要第二份映射表)。 */
const MILESTONE_LABELS: Record<MilestoneName, string> = {
  entry: 'entry',
  commandParsed: 'command-parsed',
  firstAwait: 'first-await',
  exit: 'exit',
};

/**
 * 入口(index.ts)默认必需集:direct-run 块结构上只观察得到这三枚。
 * `firstAwait` 属"接得到才标"的可选里程碑 —— 标了必进 delta,没标不算缺失,
 * 不做"为了账面好看而伪造的里程碑"。
 */
export const DEFAULT_REQUIRED_MILESTONES: readonly MilestoneName[] = ['entry', 'commandParsed', 'exit'];

/** 注入式单调时钟:返回毫秒数(消费方生产档传 `() => performance.now()`)。 */
export type MonotonicClock = () => number;

export interface StartupReadingMeasured {
  status: 'measured';
  /** 各里程碑相对 entry 的偏移(毫秒,≥0);未标记的可选里程碑不出现在这里。 */
  deltasMs: Partial<Record<Exclude<MilestoneName, 'entry'>, number>>;
  /** entry → exit 的整段跨度(毫秒,≥0)。 */
  spanMs: number;
}

export interface StartupReadingUnjudged {
  status: 'unjudged';
  /** 缺量的必需里程碑(点名用);非单调时钟时为空数组,原因见 nonMonotonic。 */
  missing: MilestoneName[];
  /** 时间戳违序(回拨/重复取钟)的里程碑对,任一存在即不可判 measured。 */
  nonMonotonic: MilestoneName[];
}

export type StartupReading = StartupReadingMeasured | StartupReadingUnjudged;

export interface StartupTracker {
  /** 打点:同名只认第一次(重放安全);时钟读数由注入的 clock 现取。 */
  mark(name: MilestoneName): void;
  /** 已打点快照(渲染与判定的输入,消费方不需要再拿原始时间戳)。 */
  reading(): StartupReading;
}

/**
 * 创建画像跟踪器。clock 必须单调(生产用 performance.now);
 * 违序不抛错,而是落进 reading() 的 unjudged.nonMonotonic —— 画像器的失效
 * 方向是"多要一次说明",不是"把这次启动判死"。
 */
export function createStartupTracker(
  clock: MonotonicClock,
  required: readonly MilestoneName[] = DEFAULT_REQUIRED_MILESTONES,
): StartupTracker {
  const stamps = new Map<MilestoneName, number>();
  return {
    mark(name: MilestoneName): void {
      if (stamps.has(name)) return;
      stamps.set(name, clock());
    },
    reading(): StartupReading {
      const missing = required.filter((name) => !stamps.has(name));
      if (missing.length > 0) {
        return { status: 'unjudged', missing: [...missing], nonMonotonic: [] };
      }
      const entry = stamps.get('entry');
      if (entry === undefined) {
        // 结构上到不了(required 含 entry 时上面已拦);required 被消费方
        // 收窄到不含 entry 时,这里仍按缺锚点处理,不产出无锚 delta。
        return { status: 'unjudged', missing: ['entry'], nonMonotonic: [] };
      }
      const nonMonotonic: MilestoneName[] = [];
      const ordered: Array<[MilestoneName, number]> = [];
      for (const name of MILESTONE_NAMES) {
        const at = stamps.get(name);
        if (at === undefined) continue;
        ordered.push([name, at]);
      }
      for (let i = 1; i < ordered.length; i += 1) {
        if (ordered[i]![1] < ordered[i - 1]![1]) nonMonotonic.push(ordered[i]![0]);
      }
      if (nonMonotonic.length > 0) {
        return { status: 'unjudged', missing: [], nonMonotonic };
      }
      const deltasMs: Partial<Record<Exclude<MilestoneName, 'entry'>, number>> = {};
      for (const [name, at] of ordered) {
        if (name !== 'entry') deltasMs[name] = at - entry;
      }
      const exitAt = stamps.get('exit');
      const spanMs = exitAt === undefined ? Number.NaN : exitAt - entry;
      return { status: 'measured', deltasMs, spanMs };
    },
  };
}

/**
 * 毫秒读数格式化:小于 0.01ms 的正值渲染为 `<0.01`(而非 `0.00`),
 * 保证**任何 measured 行都不出现"值为 0"的读数**;取不到/NaN 一律
 * 渲染 `unjudged` 语义串,不渲染数字。
 */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'unjudged';
  if (ms < 0.01) return '<0.01ms';
  return `${ms.toFixed(2)}ms`;
}

/**
 * 渲染单行结论(整条不换行、不含控制字符;缺量/违序点名到里程碑名)。
 * unjudged 行**不含任何 `<数字>ms` 读数** —— 缺席的里程碑不得被账面化成耗时。
 */
export function renderStartupLine(reading: StartupReading): string {
  if (reading.status === 'unjudged') {
    if (reading.missing.length > 0) {
      const names = reading.missing.map((n) => MILESTONE_LABELS[n]).join(',');
      return `[startup-profile] status=unjudged reason=missing-milestones missing=${names} (absent milestones are never reported as a measurement)`;
    }
    const names = reading.nonMonotonic.map((n) => MILESTONE_LABELS[n]).join(',');
    return `[startup-profile] status=unjudged reason=non-monotonic-clock out-of-order=${names} (negative elapsed time is never reported as a measurement)`;
  }
  const parts: string[] = [];
  for (const name of MILESTONE_NAMES) {
    if (name === 'entry') continue;
    const delta = reading.deltasMs[name];
    if (delta !== undefined) parts.push(`${MILESTONE_LABELS[name]}=${formatMs(delta)}`);
  }
  parts.push(`span=${formatMs(reading.spanMs)}`);
  return `[startup-profile] status=measured ${parts.join(' ')}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
