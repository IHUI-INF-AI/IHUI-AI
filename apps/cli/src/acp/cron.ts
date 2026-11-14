// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * cron 表达式判据 —— 只算「下一次触发时刻」,不做调度。
 *
 * ## 边界（重要，先说清）
 *
 * 本模块**不启动任何定时器**。CLI 是短生命周期进程，没有常驻调度器，
 * 一个"自己会响的闹钟"在这里无法存活 —— 那正是上一轮把 `schedule` 判为
 * 「缺消费方」的理由。
 *
 * 但「下一次该什么时候触发」这个**判据**是有消费方的：
 *   · `turn-store` 的挂起回合支持 `notBefore`（一次性到点）；
 *     加上 cron 后，它可以表达「每 30 分钟重试」这类周期挂起；
 *   · 上层（编辑器/未来的常驻服务）拿到 `nextAt` 后自己决定何时拉一次
 *     `x.ai/turn/parked` —— 触发面不在本模块，判据在。
 *
 * 这就是判据与调度的分离：**判据可测、可复用；调度器由有生命周期的宿主提供。**
 *
 * ## 支持的语法（5 段，够用即可）
 *
 *   ┌ 分 0-59
 *   │ ┌ 时 0-23
 *   │ │ ┌ 日 1-31
 *   │ │ │ ┌ 月 1-12
 *   │ │ │ │ ┌ 周 0-6（0=周日）
 *   * * * * *
 *
 * 每段支持：`*`、数字、`a-b` 区间、`a,b,c` 列表、`* / n` 与 `a-b / n` 步进。
 * **不支持** `L`/`W`/`#`/`?` 等扩展 —— 那些在近半实际用例中不出现，
 * 而支持它们会让"算下一个时刻"的实现复杂十倍。不支持时**明确报错**，
 * 不静默当成 `*`（那会导致"配了每月 1 号结果每天都跑"）。
 */

export class CronParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CronParseError';
  }
}

interface Field {
  readonly min: number;
  readonly max: number;
  readonly name: string;
}

const FIELDS: readonly Field[] = [
  { min: 0, max: 59, name: '分钟' },
  { min: 0, max: 23, name: '小时' },
  { min: 1, max: 31, name: '日' },
  { min: 1, max: 12, name: '月' },
  { min: 0, max: 6, name: '周' },
];

/** 解析单段成允许值集合。 */
function parseField(raw: string, field: Field): Set<number> {
  const out = new Set<number>();
  const segs = raw.split(',');
  if (segs.length === 0) throw new CronParseError(`${field.name}段为空`);

  for (const seg of segs) {
    const trimmed = seg.trim();
    if (trimmed === '') throw new CronParseError(`${field.name}段含空项`);

    // 拒绝扩展语法 —— 静默降级会让配置悄悄失效
    if (/[LW#?]/i.test(trimmed)) {
      throw new CronParseError(
        `${field.name}段 "${trimmed}" 含不支持的扩展语法(L/W/#/?) —— 本实现只支持 */n/a-b/a,b`,
      );
    }

    const [rangePart, stepPart] = trimmed.split('/');
    if (stepPart !== undefined) {
      const step = Number(stepPart);
      if (!Number.isInteger(step) || step < 1) {
        throw new CronParseError(`${field.name}段步进 "${stepPart}" 必须是 >= 1 的整数`);
      }
      const { from, to } = parseRange(rangePart!, field);
      for (let v = from; v <= to; v += step) out.add(v);
    } else {
      const { from, to } = parseRange(trimmed, field);
      for (let v = from; v <= to; v++) out.add(v);
    }
  }

  if (out.size === 0) throw new CronParseError(`${field.name}段 "${raw}" 未产生任何取值`);
  return out;
}

function parseRange(raw: string, field: Field): { from: number; to: number } {
  const s = raw.trim();
  if (s === '*') return { from: field.min, to: field.max };

  if (s.includes('-')) {
    const [a, b] = s.split('-');
    const from = Number(a);
    const to = Number(b);
    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      throw new CronParseError(`${field.name}段区间 "${s}" 含非整数`);
    }
    if (from > to) {
      throw new CronParseError(`${field.name}段区间 "${s}" 起点大于终点`);
    }
    if (from < field.min || to > field.max) {
      throw new CronParseError(
        `${field.name}段区间 "${s}" 越界(允许 ${field.min}-${field.max})`,
      );
    }
    return { from, to };
  }

  const v = Number(s);
  if (!Number.isInteger(v)) {
    throw new CronParseError(`${field.name}段 "${s}" 不是整数`);
  }
  if (v < field.min || v > field.max) {
    throw new CronParseError(`${field.name}段 "${s}" 越界(允许 ${field.min}-${field.max})`);
  }
  return { from: v, to: v };
}

export interface ParsedCron {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly daysOfMonth: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly daysOfWeek: ReadonlySet<number>;
  /** 原始表达式(便于日志/回显)。 */
  readonly source: string;
}

/** 解析 5 段 cron。语法错误一律抛 `CronParseError`。 */
export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new CronParseError(`cron 必须是 5 段(分 时 日 月 周),收到 ${parts.length} 段:"${expr}"`);
  }
  return {
    minutes: parseField(parts[0]!, FIELDS[0]!),
    hours: parseField(parts[1]!, FIELDS[1]!),
    daysOfMonth: parseField(parts[2]!, FIELDS[2]!),
    months: parseField(parts[3]!, FIELDS[3]!),
    daysOfWeek: parseField(parts[4]!, FIELDS[4]!),
    source: expr.trim(),
  };
}

/**
 * 计算 `after` 之后（**严格晚于**）的下一次触发时刻。
 *
 * 实现：按分钟步进向前搜，最多搜 4 年（约 210 万分钟）。
 * 为什么不用更聪明的算法：cron 的"日/周同时给时取或"语义让逆向推算易错；
 * 按分钟推进虽然朴素，但**可验证**（每一步都能说清为什么跳过），
 * 且搜索上限由表达式本身决定 —— 合法表达式最坏情况（2 月 29 日）在 4 年内必中。
 *
 * 注意标准语义：**日与周同时受限时取「或」**（不是与）。这是 cron 的历史行为，
 * 很多人以为是"与"。本实现遵循标准（或），并在文档里写明。
 */
export function nextCronOccurrence(parsed: ParsedCron, after: Date): Date {
  const domRestricted = parsed.daysOfMonth.size !== 31;
  const dowRestricted = parsed.daysOfWeek.size !== 7;

  const start = new Date(after.getTime());
  start.setSeconds(0, 0);
  // 严格晚于 ⇒ 从下一分钟开始
  start.setMinutes(start.getMinutes() + 1);

  const limit = new Date(start.getTime());
  limit.setFullYear(limit.getFullYear() + 4);

  const cur = new Date(start.getTime());
  while (cur <= limit) {
    if (!parsed.months.has(cur.getMonth() + 1)) {
      // 整月跳过：直接跳到下个月 1 号 00:00
      cur.setMonth(cur.getMonth() + 1, 1);
      cur.setHours(0, 0, 0, 0);
      continue;
    }
    if (!parsed.hours.has(cur.getHours())) {
      // 整天跳过：跳到明天 00:00
      cur.setDate(cur.getDate() + 1);
      cur.setHours(0, 0, 0, 0);
      continue;
    }
    if (!parsed.minutes.has(cur.getMinutes())) {
      cur.setMinutes(cur.getMinutes() + 1);
      continue;
    }

    // 日与周的匹配（按 cron 标准语义：两者都受限时取或）
    const domHit = parsed.daysOfMonth.has(cur.getDate());
    const dowHit = parsed.daysOfWeek.has(cur.getDay());
    const dayOk =
      domRestricted && dowRestricted
        ? domHit || dowHit
        : domRestricted
          ? domHit
          : dowRestricted
            ? dowHit
            : true;

    if (dayOk) return new Date(cur.getTime());

    // 该日不匹配 ⇒ 跳到明天 00:00（不再逐分钟试探当天剩余部分）
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }

  throw new CronParseError(
    `表达式 "${parsed.source}" 在 4 年内没有触发时刻 —— 可能是 2 月 30 日这类永不成立的组合`,
  );
}

/** 便捷包装:直接给表达式与基准时刻,返回毫秒时间戳。 */
export function nextCronAt(expr: string, after: number): number {
  return nextCronOccurrence(parseCron(expr), new Date(after)).getTime();
}

/** 人读描述(只覆盖常见形态,其余回显原式)。 */
export function describeCron(expr: string): string {
  const t = expr.trim();
  if (t === '* * * * *') return '每分钟';
  if (t === '0 * * * *') return '每小时整点';
  if (t === '0 0 * * *') return '每天 00:00';
  if (t === '0 0 * * 1') return '每周一 00:00';
  if (t === '0 0 1 * *') return '每月 1 日 00:00';
  const m = /^\*\/(\d+) \* \* \* \*$/.exec(t);
  if (m) return `每 ${m[1]} 分钟`;
  return t;
}
