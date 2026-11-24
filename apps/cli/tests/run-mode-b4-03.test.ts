// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-03 形态判据的镜像测试:
 * ① 三态封闭(compiled/source/unjudged)与"认不出不猜";
 * ② 执行器身份(SEA / 打包器下 execPath 不是 node ⇒ 拒绝);
 * ③ 源码态两条路(tsx 优先、strip-types 兜底、都没有 ⇒ 不 spawn 且点名);
 * ④ 接线回潮闸:两处自举点必须经 planSelfRunner,不得再出现裸 `[modulePath, FLAG]` 拼法。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  canImportTsx,
  detectEntryMode,
  isNodeExecutable,
  planSelfRunner,
  stripTypesSupported,
} from '../src/util/run-mode.js';

const SRC_DIR = path.join(__dirname, '..', 'src');

describe('B4-03 detectEntryMode / isNodeExecutable', () => {
  it('compiled 家族(.js/.mjs/.cjs)与 source 家族(.ts/.mts/.cts)各自成对', () => {
    for (const name of ['index.js', 'x.mjs', 'y.cjs', 'D:\\a\\b.js']) {
      expect(detectEntryMode(name), name).toBe('compiled');
    }
    for (const name of ['index.ts', 'x.mts', 'y.cts', 'D:\\a\\b.ts']) {
      expect(detectEntryMode(name), name).toBe('source');
    }
  });

  it('认不出的扩展名 ⇒ unjudged(不按 "猜是 js" 处理)', () => {
    expect(detectEntryMode('runner')).toBe('unjudged');
    expect(detectEntryMode('x.exe')).toBe('unjudged');
  });

  it('execPath 身份:node / nodejs 是解释器,打包器与 SEA 不是', () => {
    expect(isNodeExecutable('C:\\Program Files\\nodejs\\node.exe')).toBe(true);
    expect(isNodeExecutable('/usr/local/bin/nodejs')).toBe(true);
    expect(isNodeExecutable('C:\\Apps\\ihui.exe')).toBe(false);
    expect(isNodeExecutable('C:\\Qoder CN\\Qoder.exe')).toBe(false);
  });

  it('strip-types 版本判据:22.6+ 起可用,解析失败一律 false', () => {
    expect(stripTypesSupported('v22.6.0')).toBe(true);
    expect(stripTypesSupported('22.18.1')).toBe(true);
    expect(stripTypesSupported('v23.0.0')).toBe(true);
    expect(stripTypesSupported('v24.1.0')).toBe(true);
    expect(stripTypesSupported('v22.5.1')).toBe(false);
    expect(stripTypesSupported('v20.19.0')).toBe(false);
    expect(stripTypesSupported('not-a-version')).toBe(false);
  });

  it('canImportTsx 是现读判据:仓库里装了 tsx 就必须 true(否则源码态接线会退兜底)', () => {
    expect(canImportTsx()).toBe(true);
  });
});

describe('B4-03 planSelfRunner 判序', () => {
  const base = {
    execPath: 'C:\\Program Files\\nodejs\\node.exe',
    entryPath: 'C:\\IHUI-AI\\apps\\cli\\src\\util\\parent-bound.ts',
    runnerArgs: ['--flag', 'payload'],
    loaderAvailable: false,
    stripTypesSupported: false,
  } as const;

  it('compiled:直跑入口,不需要加载器', () => {
    const plan = planSelfRunner({ ...base, entryPath: 'C:\\x\\parent-bound.js' });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.mode).toBe('compiled');
    expect(plan.loader).toBe('none');
    expect(plan.args).toEqual(['C:\\x\\parent-bound.js', '--flag', 'payload']);
  });

  it('source + tsx:补 `--import tsx` 且保持参数顺序', () => {
    const plan = planSelfRunner({ ...base, loaderAvailable: true });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.loader).toBe('tsx');
    expect(plan.args).toEqual(['--import', 'tsx', base.entryPath, '--flag', 'payload']);
  });

  it('source + 无 tsx 但 Node 支持 strip-types:走 `--experimental-strip-types`', () => {
    const plan = planSelfRunner({ ...base, loaderAvailable: false, stripTypesSupported: true });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.loader).toBe('strip-types');
    expect(plan.args[0]).toBe('--experimental-strip-types');
  });

  it('source + 两条路都没有 ⇒ 不 spawn,原因点名(绝不冒充跑过)', () => {
    const plan = planSelfRunner(base);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain('source-entry-without-loader');
  });

  it('execPath 不是 node ⇒ 先于形态拒绝(SEA / 打包器不能当解释器)', () => {
    const plan = planSelfRunner({ ...base, execPath: 'C:\\Apps\\ihui.exe', loaderAvailable: true });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain('exec-path-not-node');
  });

  it('形态认不出 ⇒ 拒绝并带扩展名', () => {
    const plan = planSelfRunner({ ...base, entryPath: 'C:\\x\\runner' });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain('entry-mode-unjudged');
    expect(plan.reason).toContain('no-ext');
  });
});

describe('B4-03 接线回潮闸(两处自举点同一判据)', () => {
  function read(rel: string): string {
    return fs.readFileSync(path.join(SRC_DIR, rel), 'utf8');
  }

  it('parent-bound 走 planSelfRunner,不再出现裸 `[modulePath, RUNNER_FLAG` 拼法', () => {
    const text = read('util/parent-bound.ts');
    expect(text).toContain('planSelfRunner');
    expect(text).toContain('from \'./run-mode.js\'');
    expect(text).not.toContain('[modulePath, RUNNER_FLAG');
    expect(text).not.toContain('spawn(process.execPath, [modulePath');
  });

  it('proxy-relay-host 的 runner 与 probe 两条腿都走 planSelfRunner,旧 loader 拼法清零', () => {
    const text = read('sandbox/egress/proxy-relay-host.ts');
    expect(text.match(/planSelfRunner\(/g)?.length ?? 0).toBe(2);
    expect(text).not.toContain("['--import', 'tsx']");
    expect(text).not.toContain('[...loader, modulePath');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
