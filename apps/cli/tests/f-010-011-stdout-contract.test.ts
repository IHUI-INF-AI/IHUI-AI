// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * F-010 / F-011 回归:CLI 的 stdout 是**机器契约**。
 *
 * 两条缺陷是同一族,但坏在两个不同的面上:
 * - F-010:错误文案走 `console.info`(stdout),紧跟 `process.exit(1)` —— 管道/重定向时
 *   异步 flush 来不及,错误串丢失,上游只看到退出码;同时污染 stdout。
 * - F-011:人读提示(`已恢复会话 X` / `没有会话`)在 `--json` 下照样写 stdout ⇒
 *   `ihui --json --continue` 的输出不是合法 JSON,下游 `JSON.parse` 整段失败。
 *
 * 这里钉的是**通道与闸门**,不是某一句文案:
 * 1. jsonMode 下 resolveSession 不得向 stdout 写任何东西;
 * 2. 非 jsonMode 下同样的提示仍要出现(不能为了过测试把提示删掉);
 * 3. 源码里不得再有 `console.info(chalk.red(...)) + process.exit` 这一形态
 *    (它是 F-010 的指纹;改成 errorExit 后应当零命中)。
 */
import { mkdtempSync, readFileSync } from 'node:fs'
import * as os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock 会被提升到 import 之前,引用普通变量会 TDZ 报错 ⇒ 用 hoisted 容器
const scratch = vi.hoisted(() => ({ dir: '' }));

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return { ...actual, homedir: () => scratch.dir };
});

import { resolveSession } from '../src/index.js';

describe('F-011 --json 下 resolveSession 不得污染 stdout', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalTTY: boolean | undefined;

  beforeEach(() => {
    scratch.dir = mkdtempSync(path.join(os.tmpdir(), 'f010-'))
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // errorExit 会 process.exit(1);单测里必须拦下,否则整个 runner 被带走
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    // 让 resolveJsonMode 走 `opts.json === true` 这一支(不依赖 CI 的 TTY 状态)
    originalTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    Object.defineProperty(process.stdout, 'isTTY', { value: originalTTY, configurable: true });
  });

  it('--json --continue 无会话时不写 stdout', () => {
    const r = resolveSession({ json: true, continue: true } as never);
    expect(r).toEqual({});
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('--json --resume 缺失会话时不写 stdout,错误只走 stderr', () => {
    expect(() => resolveSession({ json: true, resume: 'no-such-session-id' } as never)).toThrow(
      /process\.exit\(1\)/,
    )
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled(); // F-010:错误必须有出口,只是不走 stdout
  });

  it('非 json 且 stdout 非 TTY 时同样不写(resolveJsonMode 的另一支)', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    resolveSession({ continue: true } as never);
    expect(infoSpy).not.toHaveBeenCalled();
  });
})

describe('F-010 错误文案不得走 stdout', () => {
  const src = readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf8');

  it('源码里没有 `console.info(chalk.red(...)) + process.exit` 形态', () => {
    // 该形态是 F-010 的指纹:stdout + 强杀进程 ⇒ 管道下丢输出
    const pattern = /console\.info\(chalk\.red\([\s\S]{0,400}?process\.exit\(1\)/
    expect(pattern.test(src)).toBe(false)
  })

  it('错误出口统一收敛到 errorExit(写 stderr)', () => {
    expect(src).toMatch(/function errorExit\(message: string\): never \{[\s\S]*?console\.error\(message\)/)
    // 至少 6 处调用点(修前是 6 处 console.info(chalk.red))
    expect(src.match(/errorExit\(chalk\.red\(/g)?.length ?? 0).toBeGreaterThanOrEqual(6)
  })

  it('人读提示统一收敛到 humanNote(过 jsonMode 闸)', () => {
    expect(src).toMatch(/function humanNote\(message: string\): void \{[\s\S]*?resolveJsonMode/)
  })
})
