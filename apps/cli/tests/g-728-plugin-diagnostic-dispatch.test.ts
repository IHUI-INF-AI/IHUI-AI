// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPluginsWithDiagnostics, type PluginLogger } from '../src/plugins/index.js';
import { reportPluginDiagnostics } from '../src/commands/agent.js';

/**
 * G-728 — 插件装载诊断「造好没装车」的收口证据。
 *
 * 钉的实测缺陷:装载器(G-683/G-684)早已把"某份清单为什么没生效"编码成 diagnostics,
 * 但生产调用点 `apps/cli/src/commands/agent.ts` 一直调数组薄封装 loadPlugins(),诊断整块被丢
 * —— 与守门 64/70/81/115/138 记过的「出口在位而无人调用」同型。所以本文件断言的是两件事
 * **必须同时成立**:
 *   ① 坏清单存在 ⇒ 装载继续(其余正常插件仍装上,永不抛穿 —— 旧测试已钉,此处复核);
 *   ② 诊断**真的被派发出去**且日志点名那份坏清单(捕获 logger 断言内容,
 *      只断言"函数被调用过"证不了人前可见,票面明令)。
 * 外加装载点自身的装车证明(源码锁):agent.ts 必须真调 loadPluginsWithDiagnostics 并派发,
 * 薄封装 loadPlugins({…}) 的调用面清零。
 */

let root: string;

beforeEach(() => {
  root = mkScratch('g-728-plugin-diag-');
});

afterEach(() => {
  rmScratch(root);
});

/** 在夹具根下建一个插件子目录并写清单文本,返回清单文件绝对路径 */
function writePluginSubDir(name: string, manifestText: string, file = 'plugin.json'): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  fs.writeFileSync(target, manifestText, 'utf-8');
  return target;
}

/** 捕获型 logger:每次派发改一条 {level, msg},断言只看这份记录 */
interface CapturedCall {
  level: 'info' | 'warn' | 'error';
  msg: string;
}
function makeCapturingLogger(): { logger: PluginLogger; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const logger: PluginLogger = {
    info: (msg: string) => {
      calls.push({ level: 'info', msg });
    },
    warn: (msg: string) => {
      calls.push({ level: 'warn', msg });
    },
    error: (msg: string) => {
      calls.push({ level: 'error', msg });
    },
  };
  return { logger, calls };
}

describe('G-728 reportPluginDiagnostics — 装载诊断按 severity 派发到 logger', () => {
  it('一份坏清单 ⇒ 装载继续(正常插件仍装上)且 error 档日志点名该坏文件', () => {
    const badFile = writePluginSubDir('broken', '{ this is not valid json ');
    const goodFile = writePluginSubDir('healthy', JSON.stringify({ name: 'healthy-plugin', version: '1.0.0' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });
    // ① 装载继续:坏清单不拖垮好清单,且装载器永不抛穿(本行若抛即红)
    expect(result.plugins.map((p) => p.name)).toEqual(['healthy-plugin']);
    expect(result.plugins[0]?.source).toBe(goodFile);
    // ② 诊断被真派发,且点名那份坏清单(不是只"函数存在")
    const { logger, calls } = makeCapturingLogger();
    reportPluginDiagnostics(result.diagnostics, logger);

    const errorCalls = calls.filter((c) => c.level === 'error');
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0]!.msg).toContain(badFile);
    expect(errorCalls[0]!.msg).toContain('manifest-json-invalid');
    // 好清单没有任何诊断,所以不得连带被点名
    expect(calls.some((c) => c.msg.includes(goodFile))).toBe(false);
  });

  it('全部清单都坏 ⇒ plugins 为空但诊断照样逐条点名(旧形态在此零行日志)', () => {
    const badFile = writePluginSubDir('only-broken', JSON.stringify({ version: '1.0.0' /* 缺 name */ }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });
    expect(result.plugins).toHaveLength(0);

    const { logger, calls } = makeCapturingLogger();
    reportPluginDiagnostics(result.diagnostics, logger);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.level).toBe('error');
    expect(calls[0]!.msg).toContain(badFile);
    expect(calls[0]!.msg).toContain('manifest-name-missing');
  });

  it('被优先级压掉的清单 ⇒ warning 档(logger.warn),不升 error', () => {
    writePluginSubDir('dual', JSON.stringify({ name: 'dual-plugin', version: '1.0.0' }), 'plugin.json');
    const shadowedFile = writePluginSubDir(
      'dual',
      JSON.stringify({ name: 'dual-plugin', version: '0.9.0' }),
      'plugin.config.json',
    );

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });
    // 装载继续:高优先级那份正常装上
    expect(result.plugins.map((p) => p.name)).toEqual(['dual-plugin']);

    const { logger, calls } = makeCapturingLogger();
    reportPluginDiagnostics(result.diagnostics, logger);
    const shadow = calls.filter((c) => c.msg.includes('manifest-shadowed-by-priority'));
    expect(shadow).toHaveLength(1);
    expect(shadow[0]!.level).toBe('warn');
    expect(shadow[0]!.msg).toContain(shadowedFile);
  });

  it('同名弃权(G-684)⇒ 两份都不装载,各自点名一条 error 并带上对方路径', () => {
    const fileA = writePluginSubDir('dup-a', JSON.stringify({ name: 'dup', version: '1.0.0' }));
    const fileB = writePluginSubDir('dup-b', JSON.stringify({ name: 'dup', version: '2.0.0' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });
    expect(result.plugins).toHaveLength(0);

    const { logger, calls } = makeCapturingLogger();
    reportPluginDiagnostics(result.diagnostics, logger);
    const ambiguous = calls.filter((c) => c.msg.includes('plugin_ambiguous_name'));
    expect(ambiguous).toHaveLength(2);
    expect(ambiguous.every((c) => c.level === 'error')).toBe(true);
    expect(ambiguous.some((c) => c.msg.includes(fileA) && c.msg.includes(fileB))).toBe(true);
    expect(ambiguous.some((c) => c.msg.includes(fileB) && c.msg.includes(fileA))).toBe(true);
  });

  it('正向对照:干净目录 ⇒ 派发零调用(否则"恒喊"与"从不喊"账面同形)', () => {
    writePluginSubDir('clean', JSON.stringify({ name: 'clean-plugin', version: '1.0.0' }));

    const result = loadPluginsWithDiagnostics({ pluginsDir: root });
    expect(result.diagnostics).toHaveLength(0);

    const { logger, calls } = makeCapturingLogger();
    reportPluginDiagnostics(result.diagnostics, logger);
    expect(calls).toHaveLength(0);
  });
});

describe('G-728 装车证明 — agent.ts 装载调用点必须真走诊断出口并派发', () => {
  /** 读本票被钉的装载点源码(锚点取测试文件自身位置,不依赖 cwd) */
  function readAgentSource(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return fs.readFileSync(path.join(here, '..', 'src', 'commands', 'agent.ts'), 'utf-8');
  }

  it('装载点调 loadPluginsWithDiagnostics 且派发函数真被调用', () => {
    const source = readAgentSource();
    // 实际调用形态(带参),不是注释里的提法 —— `loadPluginsWithDiagnostics({` 只可能出现在调用点
    expect(/loadPluginsWithDiagnostics\(\s*\{/.test(source)).toBe(true);
    expect(/reportPluginDiagnostics\(\s*diagnostics/.test(source)).toBe(true);
  });

  it('数组薄封装 loadPlugins({…}) 的调用在装载点清零(旧形态回升即红)', () => {
    const source = readAgentSource();
    // loadPlugins( 后紧跟可选空白再 { 才是调用形态;注释里的 loadPlugins() 与裸词名均不匹配
    expect(/(^|[^a-zA-Z])loadPlugins\(\s*\{/.test(source)).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
