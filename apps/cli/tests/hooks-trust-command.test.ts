// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui hooks trust` / `untrust` / `list` 子命令回归。
 *
 * 立因:项目钩子的目录信任门是 default-deny 的,而 `trust.ts` 里
 * `trustFolder` / `untrustFolder` / `isFolderTrusted` / `listTrustedFolders`
 * 四个函数**没有任何 CLI 入口** —— 用户唯一的出路是手写 `~/.ihui/trusted-folders`。
 * 一道只有红、没有出口的门,实际效果等价于逼人设 `IHUI_TRUST_WORKSPACE=1`
 * (它信任的是整个工作区,粒度比单个目录粗得多)。
 *
 * 本文件用一份内存假名单跑真实子命令(不碰任何人的 ~/.ihui),钉四件事:
 *   ① trust / untrust 子命令确实注册了,参数形态正确;
 *   ② trust 落盘的是解析后的绝对路径,且幂等;
 *   ③ 门里给用户的出口文案(`gateHook` 的 detail)指向的命令**真实存在**
 *      —— 文案指一条不存在的子命令,等于没有出口;
 *   ④ 命令输出面不含凭据读取(只打印路径)。
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

/** 真实存在的一次性目录:trust 子命令会拒绝不存在的目标,夹具不能凭空捏路径 */
function mkTarget(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-trust-' + label + '-'));
}

const here = path.dirname(fileURLToPath(import.meta.url));


// 内存假名单:测试绝不写真实的 ~/.ihui/trusted-folders
const { store, normalizeFolderPath } = vi.hoisted(() => {
  const norm = (p: string): string => {
    let n = path.resolve(p);
    if (n.length > 1 && (n.endsWith('/') || n.endsWith('\\'))) n = n.slice(0, -1);
    return process.platform === 'win32' ? n.toLowerCase() : n;
  };
  return {
    store: { folders: [] as string[] },
    normalizeFolderPath: norm,
  };
});

vi.mock('../src/hooks/trust.js', () => ({
  normalizeFolderPath,
  isFolderTrusted: (p: string) => store.folders.includes(normalizeFolderPath(p)),
  trustFolder: (p: string) => {
    const key = normalizeFolderPath(p);
    if (store.folders.includes(key)) return false;
    store.folders.push(key);
    return true;
  },
  untrustFolder: (p: string) => {
    const key = normalizeFolderPath(p);
    const before = store.folders.length;
    store.folders = store.folders.filter((f) => f !== key);
    return store.folders.length !== before;
  },
  listTrustedFolders: () => [...store.folders],
  isHookDisabled: () => false,
  listDisabledHooks: () => [],
  disableHook: () => false,
  enableHook: () => false,
  gateHook: () => ({ allowed: true }),
}));

import { registerHooksCommand } from '../src/commands/hooks.js';
import { setLocale } from '../src/i18n/index.js';

// trust / untrust / list 的输出文案已接进 t()/语言包(守门 70),而取词 locale 由系统语言推,
// 非中文机器上本文件的中文子串断言会假红。显式钉住 zh-CN(同 branch-ops.test.ts 的夹具),
// 不放宽断言。
beforeAll(() => {
  setLocale('zh-CN');
});

function build(): Command {
  const program = new Command();
  program.name('ihui').exitOverride().configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });
  registerHooksCommand(program);
  return program;
}

function hooksCommand(program: Command): Command {
  const cmd = program.commands.find((c) => c.name() === 'hooks');
  if (!cmd) throw new Error('hooks 命令未注册');
  return cmd;
}

/** 跑一条子命令并抓 stdout(命令一律走 console.info) */
async function run(program: Command, args: string[]): Promise<string> {
  const chunks: string[] = [];
  const spy = vi.spyOn(console, 'info').mockImplementation(((...parts: unknown[]) => {
    chunks.push(parts.map(String).join(' '));
  }) as () => void);
  try {
    await program.parseAsync(['node', 'ihui', 'hooks', ...args]);
  } finally {
    spy.mockRestore();
  }
  return chunks.join('\n');
}

describe('ihui hooks trust / untrust 子命令', () => {
  beforeEach(() => {
    store.folders = [];
  });

  it('trust 与 untrust 都已注册,且信任目标可选(默认当前目录)', () => {
    const names = hooksCommand(build()).commands.map((c) => c.name());
    expect(names).toContain('trust');
    expect(names).toContain('untrust');
    expect(names).toContain('list');
    const trusted = hooksCommand(build()).commands.find((c) => c.name() === 'trusted');
    expect(trusted).toBeUndefined(); // 名单展示挂在 list 里,不另立第二条出口
  });

  it('trust <path> 落盘的是解析后的绝对路径,并喊清它放开了什么', async () => {
    const program = build();
    const target = mkTarget('probe');
    const out = await run(program, ['trust', target]);

    expect(store.folders).toEqual([normalizeFolderPath(target)]);
    expect(out).toContain(target);
    // 信任一个目录 = 它自带的 command 钩子会走 shell、webhook 会把工具输入输出外发,
    // 这句风险提示不得少(否则用户会以为只是"允许它读配置")
    expect(out).toContain('hooks.json');
  });

  it('trust 幂等:第二次不重复写入,也不报错', async () => {
    const program = build();
    const target = mkTarget('idem');
    await run(program, ['trust', target]);
    const out = await run(program, ['trust', target]);
    expect(store.folders).toHaveLength(1);
    expect(out).toContain('已在信任名单里');
  });

  it('trust 不存在的目录时不写名单(给出可诊断的失败,而不是静默成功)', async () => {
    const program = build();
    const missing = path.resolve(process.cwd(), 'definitely-not-here-ihui-trust-probe');
    expect(fs.existsSync(missing)).toBe(false);
    const out = await run(program, ['trust', missing]);
    expect(store.folders).toEqual([]);
    expect(out).toContain('目录不存在');
  });

  it('untrust 把目录移出名单;本来不在名单时如实说"本来就不在"', async () => {
    const program = build();
    const target = mkTarget('remove');
    await run(program, ['trust', target]);
    expect(store.folders).toHaveLength(1);

    const removed = await run(program, ['untrust', target]);
    expect(store.folders).toEqual([]);
    expect(removed).toContain('已取消信任');

    const again = await run(program, ['untrust', target]);
    expect(again).toContain('本来就不在信任名单里');
  });

  it('list 段落里能看到已信任目录与当前目录的相对关系', async () => {
    const program = build();
    await run(program, ['trust', process.cwd()]);
    const out = await run(program, ['list']);
    expect(out).toContain('已信任的目录');
    expect(out).toContain('当前目录');
  });
});

describe('门的文案出口与真实子命令对账', () => {
  it('gateHook 的 not-trusted 提示指向的 `ihui hooks trust` 确实注册了', async () => {
    // 读真实 trust.ts 源码里的 detail 文案(未经上面的 mock),
    // 再与 commander 实际登记的子命令名比对 —— 文案漂移成一条不存在的命令即红。
    const src = fs.readFileSync(path.resolve(here, '..', 'src', 'hooks', 'trust.ts'), 'utf-8');
    expect(src).toContain('ihui hooks trust');
    const names = hooksCommand(build()).commands.map((c) => c.name());
    expect(names).toContain('trust');
  });
});

describe('输出面卫生', () => {
  it('hooks 命令源码不读任何凭据面(命令输出只有路径与钩子名)', () => {
    const src = fs.readFileSync(
      path.resolve(here, '..', 'src', 'commands', 'hooks.ts'),
      'utf-8',
    );
    expect(src).not.toMatch(/apiKey|api_key|secret|password|Bearer|token/i);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
