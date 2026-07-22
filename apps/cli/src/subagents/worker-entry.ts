#!/usr/bin/env node
/**
 * Subagent 子进程入口 — 由 SubagentWorkerPool.fork() 启动。
 *
 * IPC 协议:
 *   - 父进程 fork 后 send({ type: 'start', subagentId, persona, task, workspacePath, model, maxIterations })
 *   - 子进程每 5s send({ type: 'heartbeat' }) 给父进程
 *   - 子进程调用 runAgent(jsonMode=true) → stdout 输出 NDJSON 事件流(含 complete 事件)
 *   - 子进程 stderr 输出日志
 *   - 退出码:0=completed,1=failed,2=timeout(被父进程 SIGTERM/SIGKILL 时由 Node 设为 null)
 *
 * 做减法:复用现有 runAgent,不重新实现 agent runtime。jsonMode=true 让 runAgent
 * 输出结构化 NDJSON 事件(start/message_delta/tool_call/tool_result/iteration/complete/error),
 * 父进程解析 NDJSON 即可拿到 stopReason/iterations/usage + assistantText。
 */

import { runAgent } from '../commands/agent.js';
import { installEgressGuard } from './egress-guard.js';
import type { SubagentPersona, CapabilityMode, NetworkEgressPolicy, WorkerResourceLimits } from '@ihui/types';

interface StartMessage {
  type: 'start';
  subagentId: string;
  persona: SubagentPersona;
  task: string;
  workspacePath: string;
  model?: string;
  capability?: CapabilityMode;
  maxIterations?: number;
  /** 网络出站策略(P1-5,调 installEgressGuard 注入 fetch 拦截) */
  networkEgressPolicy?: NetworkEgressPolicy;
  /** 资源限制(P1-3,memoryMb 覆盖 OOM 阈值,cpuCores/cpuSeconds 轮询) */
  resourceLimits?: WorkerResourceLimits;
}

const HEARTBEAT_INTERVAL_MS = 5_000;
const API_BASE_URL = process.env.IHUI_API_URL || 'http://localhost:8803';
const API_KEY = process.env.IHUI_API_KEY || '';
// P1-3 修复:子进程 RSS 自限阈值(默认 512MB,可被 IPC resourceLimits.memoryMb 覆盖)
// 超限时子进程优雅退出(exit code 3 = self-OOM),比被父进程 SIGKILL 更安全
let selfOomThresholdMb = parseInt(
  process.env.IHUI_SUBAGENT_OOM_MB || '512',
  10,
);
// P1-3 修复:CPU 限制(从 IPC 消息读,POSIX 轮询;Windows 跳过)
let cpuCoresLimit: number | undefined;
let cpuSecondsLimit: number | undefined;
let cumulativeCpuSeconds = 0;
let lastCpuUsage = process.resourceUsage();
let lastCpuCheckAt = Date.now();

/** 心跳定时器:每 5s 向父进程发 heartbeat(携带 RSS,父进程超 heartbeatTimeoutSeconds 标记 dead) */
const heartbeatTimer = setInterval(() => {
  try {
    if (typeof process.send === 'function') {
      // P1-3 修复:heartbeat 携带 RSS + heapUsed,父进程可监控内存趋势
      const mem = process.memoryUsage();
      process.send({
        type: 'heartbeat',
        rss: mem.rss,
        heapUsed: mem.heapUsed,
      });
      // P1-3 第一层软限制:子进程自检 RSS,超阈值优雅退出
      const rssMb = mem.rss / 1024 / 1024;
      if (rssMb > selfOomThresholdMb) {
        process.stdout.write(
          JSON.stringify({
            type: 'error',
            message: `self OOM: rss=${rssMb.toFixed(0)}MB > threshold=${selfOomThresholdMb}MB`,
          }) + '\n',
        );
        process.exit(3); // 3 = self-OOM 优雅退出
      }
      // P1-3 修复:CPU 限制轮询(POSIX 可用,Windows 跳过;exit code 4 = CPU 超限)
      if (process.platform !== 'win32' && (cpuCoresLimit || cpuSecondsLimit)) {
        const now = Date.now();
        const usage = process.resourceUsage();
        const cpuMicros =
          (usage.userCPUTime - lastCpuUsage.userCPUTime) +
          (usage.systemCPUTime - lastCpuUsage.systemCPUTime);
        const cpuSecs = cpuMicros / 1_000_000;
        const wallSecs = (now - lastCpuCheckAt) / 1000;
        // cpuCores:瞬时 CPU 占比(累计 CPU 时间 / wall 时间)超核心数 → 退出
        if (cpuCoresLimit && wallSecs > 0 && cpuSecs / wallSecs > cpuCoresLimit) {
          process.stdout.write(
            JSON.stringify({
              type: 'error',
              message: `cpu cores exceeded: ${cpuSecs.toFixed(2)}/${wallSecs.toFixed(2)}s > ${cpuCoresLimit} cores`,
            }) + '\n',
          );
          process.exit(4);
        }
        // cpuSeconds:累计 CPU 时间超限 → 退出
        cumulativeCpuSeconds += cpuSecs;
        if (cpuSecondsLimit && cumulativeCpuSeconds > cpuSecondsLimit) {
          process.stdout.write(
            JSON.stringify({
              type: 'error',
              message: `cpu seconds exceeded: ${cumulativeCpuSeconds.toFixed(2)}s > ${cpuSecondsLimit}s`,
            }) + '\n',
          );
          process.exit(4);
        }
        lastCpuUsage = usage;
        lastCpuCheckAt = now;
      }
    }
  } catch {
    // IPC 通道已关闭,停止心跳
    clearInterval(heartbeatTimer);
  }
}, HEARTBEAT_INTERVAL_MS);

// 父进程关闭 IPC 通道(进程被 kill)时优雅退出
process.on('disconnect', () => {
  clearInterval(heartbeatTimer);
  process.exit(2);
});

// SIGTERM(父进程超时或 shutdown 时发送)→ 退出码 2(timeout)
process.on('SIGTERM', () => {
  clearInterval(heartbeatTimer);
  process.exit(2);
});

process.on('message', async (msg: StartMessage) => {
  if (msg.type !== 'start') return;
  const { subagentId, task, workspacePath, model, maxIterations } = msg;

  // P1-3 修复:用 IPC 传入的 memoryMb 覆盖默认 OOM 阈值(替代硬编码 SELF_OOM_THRESHOLD_MB)
  if (msg.resourceLimits?.memoryMb) {
    selfOomThresholdMb = msg.resourceLimits.memoryMb;
  }
  // P1-3 修复:读取 CPU 限制并重置轮询基线(从任务起点计)
  if (msg.resourceLimits?.cpuCores) cpuCoresLimit = msg.resourceLimits.cpuCores;
  if (msg.resourceLimits?.cpuSeconds) cpuSecondsLimit = msg.resourceLimits.cpuSeconds;
  if (cpuCoresLimit || cpuSecondsLimit) {
    lastCpuUsage = process.resourceUsage();
    lastCpuCheckAt = Date.now();
    cumulativeCpuSeconds = 0;
  }

  // P0 安全:安装网络出站拦截器(在 runAgent 前注入,对齐 ai-service network_guard)
  // 进程退出时 monkey-patch 随之销毁,无需显式 uninstall
  if (msg.networkEgressPolicy) {
    installEgressGuard(msg.networkEgressPolicy);
  }

  try {
    const result = await runAgent({
      prompt: task,
      modelId: model ?? 'default',
      workspacePath,
      apiUrl: API_BASE_URL,
      apiKey: API_KEY || undefined,
      maxIterations: maxIterations ?? 25,
      jsonMode: true,
      allowDangerous: false,
    });

    clearInterval(heartbeatTimer);

    // runAgent(jsonMode=true) 已将 NDJSON 事件流写入 stdout(含 complete 事件)
    // 父进程解析 NDJSON 即可拿到 stopReason/iterations/usage + message_delta 拼接的 assistantText
    const exitCode = result.stopReason === 'error' ? 1 : 0;
    process.exit(exitCode);
  } catch (err) {
    clearInterval(heartbeatTimer);
    const errMsg = err instanceof Error ? err.message : String(err);
    // 错误事件写入 stdout(NDJSON 格式),供父进程解析
    process.stdout.write(JSON.stringify({ type: 'error', message: errMsg, subagentId }) + '\n');
    process.stderr.write(`[worker-entry] subagent ${subagentId} failed: ${errMsg}\n`);
    process.exit(1);
  }
});
