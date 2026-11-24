// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时动态编排(dynamic workflow)。
 *
 * ## 与静态工作流的区别
 *
 * 既有 `commands/workflows.ts` 是**命令层**:工作流由服务端定义、按固定顺序执行。
 * 本模块补的是「**运行时**按依赖关系决定顺序」—— 两步之间的先后不由声明位置决定,
 * 而由 `needs` 声明推导。
 *
 * ## 为什么需要显式依赖而不是隐式顺序
 *
 * 隐式顺序(数组先后)在三种情况下会静默出错:
 *   ① 步骤被重排后语义变了,但代码照跑;
 *   ② 并行执行时不知道哪些能同时跑;
 *   ③ 某步失败后,不知道哪些后续步骤必须取消。
 *
 * 显式 `needs` 让这三件事都变成可判定:
 *   拓扑排序 → 分层并行 → 失败时只取消下游。
 *
 * ## 硬约束(每条对应一个真实事故)
 *
 *   ① **环检测**:A→B→A 必须有明确报错,不能静默死循环;
 *   ② **未知依赖**:`needs: ['nope']` 必须在**执行前**报错,而不是跑到一半才发现;
 *   ③ **失败隔离**:某步失败只取消它的下游,不牵连无关分支
 *      —— 全局 abort 会让"一个可选步骤失败"变成"整个工作流失败";
 *   ④ **重复 id**:同 id 两步会让依赖解析产生歧义,必须拒。
 */

export interface WorkflowStep {
  readonly id: string;
  /** 该步依赖哪些步必须**先完成**。空/缺省 = 无依赖,可立即执行。 */
  readonly needs?: readonly string[];
  /** 执行体。 */
  readonly run: (ctx: { readonly signal: AbortSignal }) => Promise<StepResult>;
}

export type StepResult =
  | { readonly ok: true; readonly output?: unknown }
  /** 失败但不阻断无关分支;`optional` 为 true 时下游按"跳过"处理而非失败。 */
  | { readonly ok: false; readonly error: string; readonly optional?: boolean };

export type StepStatus = 'ok' | 'failed' | 'skipped' | 'cancelled';

export interface StepOutcome {
  readonly id: string;
  readonly status: StepStatus;
  /** 该步在拓扑分层中的层号(0 起)。同层可并行。 */
  readonly layer: number;
  readonly output?: unknown;
  readonly error?: string;
  readonly durationMs: number;
}

export interface WorkflowResult {
  readonly outcomes: readonly StepOutcome[];
  /** 全部步骤都 ok(或 optional 跳过)⇒ true。 */
  readonly succeeded: boolean;
  /** 失败/取消的步骤 id。 */
  readonly failed: readonly string[];
}

/** 编排定义错误(在执行前就抛出,不会跑一半)。 */
export class WorkflowDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowDefinitionError';
  }
}

/**
 * 校验定义并计算拓扑层。
 *
 * 三件事一起做(因为它们的失败模式相同 —— 都应该在执行前报错):
 *   · 重复 id;
 *   · 未知依赖;
 *   · 环。
 */
export function planLayers(steps: readonly WorkflowStep[]): {
  layers: readonly (readonly string[])[];
  layerOf: ReadonlyMap<string, number>;
} {
  const ids = new Set<string>();
  for (const s of steps) {
    if (ids.has(s.id)) throw new WorkflowDefinitionError(`步骤 id 重复:${s.id}`);
    ids.add(s.id);
  }

  const needs = new Map<string, readonly string[]>();
  for (const s of steps) {
    const deps = s.needs ?? [];
    for (const d of deps) {
      if (!ids.has(d)) {
        throw new WorkflowDefinitionError(`步骤 ${s.id} 依赖不存在的 ${d}`);
      }
      if (d === s.id) {
        throw new WorkflowDefinitionError(`步骤 ${s.id} 依赖自身`);
      }
    }
    needs.set(s.id, deps);
  }

  // Kahn 拓扑分层 —— 同层可并行
  const layers: string[][] = [];
  const placed = new Set<string>();
  const remaining = new Set(ids);

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => (needs.get(id) ?? []).every((d) => placed.has(d)));
    if (ready.length === 0) {
      // 剩下的互相依赖 ⇒ 有环
      throw new WorkflowDefinitionError(`依赖存在环:${[...remaining].sort().join(' → ')}`);
    }
    layers.push(ready.sort()); // 排序保证稳定(同层顺序可复现)
    for (const id of ready) {
      placed.add(id);
      remaining.delete(id);
    }
  }

  const layerOf = new Map<string, number>();
  layers.forEach((idsInLayer, idx) => {
    for (const id of idsInLayer) layerOf.set(id, idx);
  });

  return { layers, layerOf };
}

/**
 * 执行工作流。
 *
 * 分层执行:同层内并行,层与层之间串行(下层必须等上层全部结束 —— 这是 `needs` 的语义)。
 * 失败传播:某步 failed(非 optional)⇒ 它的**直接/传递下游**全部 cancelled;
 * 无关分支照常跑完。
 */
export async function runWorkflow(
  steps: readonly WorkflowStep[],
  options: { readonly signal?: AbortSignal; readonly now?: () => number } = {},
): Promise<WorkflowResult> {
  const { layers } = planLayers(steps);
  const byId = new Map(steps.map((s) => [s.id, s]));
  const now = options.now ?? (() => Date.now());

  const outcomes: StepOutcome[] = [];
  /** 已判定为"不可执行"的步骤(自身失败或上游失败)。 */
  const blocked = new Map<string, string>(); // id -> 原因
  const done = new Map<string, StepResult>();

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const idsInLayer = layers[layerIdx]!;

    const runnable: string[] = [];
    for (const id of idsInLayer) {
      const deps = byId.get(id)!.needs ?? [];
      const blockedDep = deps.find((d) => blocked.has(d));
      if (blockedDep !== undefined) {
        blocked.set(id, `上游 ${blockedDep} 未成功`);
        outcomes.push({
          id,
          status: 'cancelled',
          layer: layerIdx,
          durationMs: 0,
          error: `上游 ${blockedDep} 未成功`,
        });
      } else {
        runnable.push(id);
      }
    }

    const settled = await Promise.all(
      runnable.map(async (id) => {
        const started = now();
        try {
          const res = await byId.get(id)!.run({ signal: options.signal ?? new AbortController().signal });
          return { id, res, durationMs: now() - started };
        } catch (e) {
          // 抛错等同于 failed(非 optional)—— 不吞,转成结构化结果
          return {
            id,
            res: { ok: false as const, error: e instanceof Error ? e.message : String(e) },
            durationMs: now() - started,
          };
        }
      }),
    );

    for (const { id, res, durationMs } of settled) {
      done.set(id, res);
      if (res.ok) {
        outcomes.push({ id, status: 'ok', layer: layerIdx, durationMs, ...(res.output === undefined ? {} : { output: res.output }) });
      } else {
        const optional = res.optional === true;
        if (optional) {
          // optional 失败:记 skipped,不阻断下游(下游照跑,但拿不到这步的输出)
          outcomes.push({ id, status: 'skipped', layer: layerIdx, durationMs, error: res.error });
        } else {
          blocked.set(id, res.error);
          outcomes.push({ id, status: 'failed', layer: layerIdx, durationMs, error: res.error });
        }
      }
    }
  }

  const failed = outcomes.filter((o) => o.status === 'failed' || o.status === 'cancelled').map((o) => o.id);
  // 稳定排序:按 layer 再按 id,便于比对
  outcomes.sort((a, b) => (a.layer !== b.layer ? a.layer - b.layer : a.id.localeCompare(b.id)));

  return { outcomes, succeeded: failed.length === 0, failed };
}

/** 把结果压成一句人读摘要。 */
export function describeWorkflow(r: WorkflowResult): string {
  const ok = r.outcomes.filter((o) => o.status === 'ok').length;
  const skipped = r.outcomes.filter((o) => o.status === 'skipped').length;
  const failed = r.outcomes.filter((o) => o.status === 'failed').length;
  const cancelled = r.outcomes.filter((o) => o.status === 'cancelled').length;
  const parts = [`成功 ${ok}`];
  if (skipped) parts.push(`跳过 ${skipped}(可选失败)`);
  if (failed) parts.push(`失败 ${failed}`);
  if (cancelled) parts.push(`取消 ${cancelled}`);
  return r.succeeded ? parts.join(', ') : `未全部成功:${parts.join(', ')}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
