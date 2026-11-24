// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui workflow run` —— `workflow-runtime.ts` 的**真实消费方**。
 *
 * ## 为什么需要它
 *
 * `workflow-runtime.ts` 提供了拓扑分层与并行执行,但它的 `run` 需要**进程内执行体**
 * (一个 `() => Promise<StepResult>` 函数),这种东西不能过 ACP 的 JSON-RPC 线。
 * 所以上一轮只能暴露 `x.ai/workflow/plan`(纯拓扑校验) —— `runWorkflow` 本身没有调用方,
 * 是死码。
 *
 * 本命令把它接上:从 **JSON 文件**声明工作流,每个步骤声明要跑的命令,
 * 命令层负责把声明翻译成执行体,再交给 `runWorkflow`。
 *
 * ## 声明格式
 *
 * ```json
 * {
 *   "steps": [
 *     { "id": "lint",   "run": "pnpm lint" },
 *     { "id": "test",   "run": "pnpm test",   "needs": ["lint"] },
 *     { "id": "build",  "run": "pnpm build",  "needs": ["lint"] },
 *     { "id": "deploy", "run": "./deploy.sh", "needs": ["test", "build"] }
 *   ]
 * }
 * ```
 *
 * ## 为什么用 JSON 而不是复用 commands/workflows.ts
 *
 * 后者是**服务端工作流**的客户端(打 API 取实例),语义完全不同:
 * 它跑的是平台上定义好的工作流,本命令跑的是**本地声明的一组命令**。
 * 硬合并会把两种东西搅在一起。
 *
 * ## 安全边界
 *
 * 执行体只跑 `run` 字段里的命令,且走 `spawn(shell: true)` —— 这意味着
 * **用户写的 JSON 可以跑任意命令**。这是设计意图(它是构建脚本的替代品),
 * 但必须:① 只在用户显式执行该命令时读文件;② 不接收远程来源;
 * ③ 失败时把完整 stderr 报出来,不吞。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describeWorkflow, runWorkflow, type StepResult, type WorkflowStep } from '../acp/workflow-runtime.js';

/** 声明文件里的单步。 */
export interface DeclaredStep {
  readonly id: string;
  /** 要执行的 shell 命令。 */
  readonly run: string;
  readonly needs?: readonly string[];
  /** 失败是否允许(默认不允许)。 */
  readonly optional?: boolean;
  /** 工作目录(相对声明文件所在目录)。 */
  readonly cwd?: string;
}

export interface WorkflowDeclaration {
  readonly steps: readonly DeclaredStep[];
}

export class WorkflowDeclarationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowDeclarationError';
  }
}

/**
 * 解析声明文件。
 *
 * 校验比 `planLayers` 更早一层:文件读不到、JSON 坏、结构与字段缺失,
 * 都在**跑任何命令之前**报错 —— 不能让用户跑到第三步才发现第四个步骤少个字段。
 */
export function parseDeclaration(raw: string, sourceLabel = '<inline>'): WorkflowDeclaration {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new WorkflowDeclarationError(
      `${sourceLabel} 不是合法 JSON:${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new WorkflowDeclarationError(`${sourceLabel} 顶层必须是对象 { steps: [...] }`);
  }
  const stepsRaw = (parsed as { steps?: unknown }).steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
    throw new WorkflowDeclarationError(`${sourceLabel} 的 steps 必须是非空数组`);
  }

  const steps: DeclaredStep[] = stepsRaw.map((s, i) => {
    if (s === null || typeof s !== 'object' || Array.isArray(s)) {
      throw new WorkflowDeclarationError(`steps[${i}] 必须是对象`);
    }
    const o = s as Record<string, unknown>;
    if (typeof o.id !== 'string' || o.id.trim() === '') {
      throw new WorkflowDeclarationError(`steps[${i}] 缺 id(必须是非空字符串)`);
    }
    if (typeof o.run !== 'string' || o.run.trim() === '') {
      throw new WorkflowDeclarationError(`steps[${i}] (${o.id}) 缺 run(必须是非空命令)`);
    }
    if (o.needs !== undefined && (!Array.isArray(o.needs) || o.needs.some((x) => typeof x !== 'string'))) {
      throw new WorkflowDeclarationError(`steps[${i}] (${o.id}) 的 needs 必须是字符串数组`);
    }
    if (o.optional !== undefined && typeof o.optional !== 'boolean') {
      throw new WorkflowDeclarationError(`steps[${i}] (${o.id}) 的 optional 必须是布尔`);
    }
    return {
      id: o.id,
      run: o.run,
      ...(o.needs === undefined ? {} : { needs: o.needs as string[] }),
      ...(o.optional === undefined ? {} : { optional: o.optional as boolean }),
      ...(typeof o.cwd === 'string' ? { cwd: o.cwd } : {}),
    };
  });

  return { steps };
}

/** 执行一条 shell 命令,返回是否成功与输出。 */
function runShell(
  command: string,
  options: { cwd: string; signal?: AbortSignal },
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd: options.cwd,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    let stdout = '';
    let stderr = '';
    const CAP = 64 * 1024; // 64KB 上限,防止超大输出打爆内存
    child.stdout?.on('data', (d: Buffer) => {
      if (stdout.length < CAP) stdout += d.toString('utf8');
    });
    child.stderr?.on('data', (d: Buffer) => {
      if (stderr.length < CAP) stderr += d.toString('utf8');
    });
    child.on('error', (e) => resolve({ ok: false, stdout, stderr: `${stderr}${e.message}` }));
    child.on('close', (code) => resolve({ ok: code === 0, stdout, stderr }));
  });
}

export interface RunDeclaredWorkflowOptions {
  readonly declarationPath: string;
  /** 是否把每一步的输出打出来。 */
  readonly verbose?: boolean;
  readonly signal?: AbortSignal;
  readonly log?: (line: string) => void;
}

export interface RunDeclaredWorkflowResult {
  readonly succeeded: boolean;
  readonly summary: string;
  readonly failed: readonly string[];
  /** 每步的输出(便于上层回报)。 */
  readonly outputs: Readonly<Record<string, { stdout: string; stderr: string }>>;
}

/**
 * 读声明文件 → 翻译成执行体 → 交给 runWorkflow。
 *
 * 这是本模块的全部价值:把"声明式的工作流文件"变成"可并行、有依赖、失败隔离的执行"。
 */
export async function runDeclaredWorkflow(
  options: RunDeclaredWorkflowOptions,
): Promise<RunDeclaredWorkflowResult> {
  const log = options.log ?? ((l: string) => console.info(l));
  const abs = path.resolve(options.declarationPath);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (e) {
    throw new WorkflowDeclarationError(`读不到工作流声明 ${abs}:${e instanceof Error ? e.message : String(e)}`);
  }

  const decl = parseDeclaration(raw, abs);
  const baseDir = path.dirname(abs);
  const outputs: Record<string, { stdout: string; stderr: string }> = {};

  const steps: WorkflowStep[] = decl.steps.map((s) => ({
    id: s.id,
    ...(s.needs === undefined ? {} : { needs: s.needs }),
    run: async ({ signal }): Promise<StepResult> => {
      const cwd = s.cwd === undefined ? baseDir : path.resolve(baseDir, s.cwd);
      const started = Date.now();
      const r = await runShell(s.run, { cwd, ...(signal === undefined ? {} : { signal }) });
      outputs[s.id] = { stdout: r.stdout, stderr: r.stderr };
      if (options.verbose) {
        log(`  [${s.id}] $ ${s.run} (${Date.now() - started}ms)`);
        if (r.stdout.trim()) log(r.stdout.trimEnd());
        if (r.stderr.trim()) log(r.stderr.trimEnd());
      }
      return r.ok
        ? { ok: true, output: r.stdout.slice(0, 500) }
        : {
            ok: false,
            error: r.stderr.trim().slice(0, 500) || `命令退出码非 0:${s.run}`,
            ...(s.optional === true ? { optional: true } : {}),
          };
    },
  }));

  const result = await runWorkflow(steps, {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });

  return {
    succeeded: result.succeeded,
    summary: describeWorkflow(result),
    failed: result.failed,
    outputs,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
