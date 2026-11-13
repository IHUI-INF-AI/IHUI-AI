// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * asRpcError 守门 —— 防「新方法漏包 rpcMethod」。
 *
 * ## 为什么需要这道门
 *
 * `buildAcpAgentApp` 的方法注册表里,每条 handler 若**直接返回 agent 方法**而不经
 * `rpcMethod`,业务错误就会冒泡成 ACP SDK 的 `-32603 Internal error` 且不带 message
 * —— 客户端只能看到"内部错误",无法区分"会话不存在 / 检查点不存在 / 存储损坏"。
 * `rpcMethod` + `asRpcError` 的全部价值就是把这类错误转成**带原因的** `-32602`。
 *
 * 漏包是**静默**的:方法照常注册、照常返回结果,只有出错那一刻才露馅 —— 而出错
 * 恰恰是最需要精确原因的时候。所以必须用一道静态守门在提交前拦住。
 *
 * ## 守门口径
 *
 * 扫描 `buildAcpAgentApp` 的注册表(从 `.onRequest(` 到 `.onNotification(` 之间),
 * 对**每个** `.onRequest(` handler 断言它经过 `rpcMethod(`。
 *
 * **显式豁免**5 个既有方法:`initialize` / `authenticate` / `session/new` /
 * `session/load` / `session/prompt`。理由:它们是 ACP 标准方法,错误形态早已稳定,
 * 刻意不经 rpcMethod 以避免行为变更(见 rpcMethod 头注"既有方法的错误形态不动")。
 * 豁免必须是**具名清单** —— 新方法不在清单里就必须包 rpcMethod。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// 豁免清单:这些方法的 handler **刻意**不经 rpcMethod(既有 ACP 标准方法,错误形态不动)。
const RPC_METHOD_EXEMPT = new Set([
  'initialize',
  'authenticate',
  'session/new',
  'session/load',
  'session/prompt',
]);

describe('asRpcError 守门:新方法必须经 rpcMethod', () => {
  const serverSrc = readFileSync(
    path.join(__dirname, '..', 'src', 'acp', 'server.ts'),
    'utf8',
  );

  // 取注册表正文:buildAcpAgentApp 的 .onRequest(...) 链,到 .onNotification 结束
  const start = serverSrc.indexOf("export function buildAcpAgentApp");
  const chainStart = serverSrc.indexOf('.onRequest(', start);
  const end = serverSrc.indexOf('.onNotification(', chainStart);
  it('注册表可定位(守门自身先自证)', () => {
    expect(start).toBeGreaterThan(0);
    expect(chainStart).toBeGreaterThan(start);
    expect(end).toBeGreaterThan(chainStart);
  });

  const registry = serverSrc.slice(chainStart, end);

  /** 抽出每个 .onRequest( 块里的方法名字面量(第一个字符串字面量)。 */
  function methodNames(src: string): { name: string; body: string }[] {
    const out: { name: string; body: string }[] = [];
    const re = /\.onRequest\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const name = m[1]!;
      // 块体:从这个 match 到下一个 .onRequest( 之间(最后一个取到链尾)
      const nextIdx = src.indexOf('.onRequest', m.index + 1);
      const body = src.slice(m.index, nextIdx === -1 ? src.length : nextIdx);
      out.push({ name, body });
    }
    return out;
  }

  const methods = methodNames(registry);

  it('注册表非空且能解析出方法名(守门不自欺)', () => {
    expect(methods.length).toBeGreaterThan(10);
  });

  it('豁免清单里的方法确实存在(避免豁免腐化成空名单)', () => {
    const names = new Set(methods.map((m) => m.name));
    for (const exempt of RPC_METHOD_EXEMPT) {
      expect(names.has(exempt), `豁免清单里的 ${exempt} 应真实注册`).toBe(true);
    }
  });

  it('非豁免方法全部经过 rpcMethod(漏包即红)', () => {
    const offenders: string[] = [];
    for (const { name, body } of methods) {
      if (RPC_METHOD_EXEMPT.has(name)) continue;
      if (!body.includes('rpcMethod(')) offenders.push(name);
    }
    expect(
      offenders,
      `以下方法未包 rpcMethod,业务错误会冒泡成不带原因的 -32603,须包 rpcMethod 或进具名豁免清单:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('rpcMethod 与 asRpcError 的实现确实存在且被链路使用', () => {
    expect(serverSrc).toContain('function rpcMethod');
    expect(serverSrc).toContain('function asRpcError');
    // rpcMethod 内部必须调用 asRpcError(否则映射链断开)
    const rpcFn = serverSrc.slice(
      serverSrc.indexOf('function rpcMethod'),
      serverSrc.indexOf('function rpcMethod') + 400,
    );
    expect(rpcFn).toContain('asRpcError(');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
