// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 沙箱结果的终态投影 —— 把"进程被墙钟中止"这件事从一次文本拼装里剥出来,单独成一份可断言的形状。
 *
 * ⚠️ **来历必须说清(读这个文件的人第一个要知道的就是这件事)**:本模块的**原实现从未入库**。
 * 判据不是"我没找到":`git log --all --diff-filter=A -- '*failure-classification*'` 与
 * `git log --all -- apps/cli/src/tools/failure-classification.ts` 均 0 命中(全历史),而
 * `apps/cli/src/tools/builtins.ts:32`(枚 `5452985324`,`git cat-file -e` 可证)从落进 HEAD 那一刻起
 * 就 import 它 ⇒ `pnpm --filter @ihui/cli typecheck` 在干净 HEAD 上恒红(TS2307),守门 98 同步判红。
 * 也就是说:**下面这两个导出的语义不是我设计的,是从两处已在的证据里逐字反推出来的**——
 *  ① 调用点自己的文档注释(`builtins.ts` 的 G-937951 接线段:`timedOut ⇒ terminalState 'timed_out'`
 *     `+ interrupted: true`,并写明 cancelled 档不在沙箱结果层而在执行链边界 `index.ts::execBudgetResult`);
 *  ② 已入库的用例(`apps/cli/tests/gh-rate-limit.test.ts:129-138`:`out.terminalState === 'timed_out'`、
 *     `out.interrupted === true`、输出含 `'aborted before completion'`)。
 * 两处都在 HEAD 里,所以这份载体不引入任何新契约,只是把已声明却没落盘的契约补齐。
 *
 * **不在这里、也禁止被读成"这里有"的东西**:`scripts/check-error-code-not-text-matching.mjs` 的
 * `OUTLET_REQUIREMENTS` 把 `ToolError` / `resolveFailureCode` / `getFailureFallbackStats` 三枚出口点名给
 * 本文件 —— 那三枚同样在**全历史 0 命中**(该门自己的头注就写着它"尚未接线、出口未落地",
 * 报 `self-not-landed`)。补齐它们属于那张票的语义设计,不得由这次"把编译修好"顺手代答,
 * 所以这里**一个都不写**。要写的人请连带把那条门的 `--strict` 与它的镜像测试一起对齐。
 *
 * 词汇不另起炉灶:`'timed_out'` 取自 `apps/cli/src/sandbox/index.ts` 的 `SandboxFailureKind`,
 * `'interrupted'` 取自 `packages/types/src/agent-runtime.ts` 的状态词汇 —— 同一件事在三种语言里
 * 有五个名字是本仓记过多次的漂移源,所以这一份只做投影,不做第二张登记表。
 */

/** 沙箱一层能自证的终态:只有"被超时中止"。正常跑完(哪怕非零退出)不产出终态标记。 */
export type SandboxTerminalStatus = 'timed_out';

/**
 * 投影输入。刻意收成"调用方手上真有的那一个字段"(`SandboxResult.timedOut`),
 * 而不是接收整个 SandboxResult:那样本模块会顺手依赖 stdout/exitCode 的形状,
 * 而那两个字段归沙箱层演进,不属于终态词汇。
 */
export interface SandboxTerminalInput {
  timedOut?: boolean;
}

/** 归档结果:写进 `ToolResult` 的两个字段(`terminalState` / `interrupted`)。 */
export interface SandboxTerminalState {
  status: SandboxTerminalStatus;
  /** 副作用不确定:调用方/模型不得把这一档读成"干净终态"。 */
  interrupted: true;
}

/**
 * `timedOut` ⇒ 终态;其余一切 ⇒ `null`。
 *
 * 失效方向刻意是"少标一个终态",不是"多标一个":非零退出、空输出、被 maxBuffer 截断都**不**算中止,
 * 因为那些情形下命令自己跑完了(归因见 `sandbox/index.ts::classifySpawnSyncFailure` 的归因序
 * `spawn_error > timed_out > cancelled > output_limit`)。把"跑完但失败"标成 interrupted,
 * 等于让重试逻辑与状态行都读到假的中止 —— 那比少标严重。
 */
export function mapTerminalState(input: SandboxTerminalInput): SandboxTerminalState | null {
  return input.timedOut ? { status: 'timed_out', interrupted: true } : null;
}

/**
 * 模型面尾注:超时那一档在 `[超时]` 之后追加的一行。
 *
 * 文案里 `'aborted before completion'` 这个短语**是用例逐字断言的**
 * (`tests/gh-rate-limit.test.ts:137`),所以它是契约的一部分,不是可随意润色的措辞。
 */
export const ABORTED_BEFORE_COMPLETION_NOTE =
  '[中止] 命令在完成前被中止(aborted before completion):输出与副作用均不确定,不得读成干净终态;重试前先核对盘上/远端现场。';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
