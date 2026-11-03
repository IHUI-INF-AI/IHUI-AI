// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * grep / read_file 的"假绿"回归(第三十六批)。
 *
 * 钉住的四型,全都共同指向一件事:**外部命令或边界的失败不得伪装成一个可信的否定结论**。
 *  ① 坏正则(rg 默认引擎不支持的 lookaround)不得回成光秃秃的"未找到匹配";
 *     两条通道都答不上来时必须是 `success:false`。
 *  ② 真无匹配仍然要回"未找到匹配"——收紧不能把合法答案一起收紧。
 *  ③ rg 缺失时确实走 JS walk,且**结果集与 rg 通道一致**(降级换了通道不能换答案)。
 *  ④ 二进制嗅探窗口与注释同值:NULL 在窗口内 ⇒ 判二进制,在窗口外 ⇒ 不判(成对)。
 *  ⑤ read_file 的字节上限:超限必须如实报总量与已读量,不得静默变短。
 *
 * 刻意不断言"本仓一定搜得到某个词"这类仓库瞬时状态 —— 夹具全部现造在临时目录里。
 * 也不假设本机装了 rg:凡依赖该事实的断言都由测试自己探测后分支,两个分支各有实断言。
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { grep, read_file, MAX_READ_BYTES, BINARY_SNIFF_BYTES } from '../src/tools/builtins.js';
import type { ToolContext } from '../src/tools/index.js';

const createdDirs: string[] = [];

function mkWorkspace(): { dir: string; ctx: ToolContext } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-grep-engine-'));
  createdDirs.push(dir);
  return { dir, ctx: { workspacePath: dir } };
}

function writeAt(dir: string, name: string, data: string | Buffer): string {
  const abs = path.join(dir, name);
  fs.writeFileSync(abs, data);
  return abs;
}

afterEach(() => {
  while (createdDirs.length) {
    const d = createdDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

/**
 * 本机 rg 是否可用的**独立探测**(不复用被测模块里的那个探测)。
 * 理由:测试要按这个事实分支断言,若共用被测方状态,探测逻辑坏了测试就会跟着
 * 一起选错分支 —— 那等于让被测对象给自己的前提背书。
 */
function rgInstalledHere(): boolean {
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    return spawnSync('rg', ['--version'], { encoding: 'utf-8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).status === 0;
  } catch {
    return false;
  }
}

/** 结论/标注行(engine=… / [ripgrep warning] / 截断提示)不参与命中集比对。 */
function matchLines(output: string): string[] {
  return output
    .split('\n')
    .filter((l) => l !== '' && !l.startsWith('[') && !l.startsWith('...'))
    .sort();
}

describe('grep 三态语义(外部命令报错不得当成"没有匹配")', () => {
  it('① rg 拒绝的正向预查(lookahead)不得回成"未找到匹配":降级 JS walk 并留原因', async () => {
    const { dir, ctx } = mkWorkspace();
    writeAt(dir, 'sample.txt', 'foo bar\nhello world');

    // `(?!foo)bar` 是合法 JS 正则,却是 rg **默认引擎**的语法错误(实测退出码 2 + 空 stdout)。
    // 旧实现在这里回一个空数组 ⇒ 下游印"未找到匹配" ⇒ 模型读到 success:true 的假否定。
    const result = await grep.execute({ pattern: '(?!foo)bar', path: '.' }, ctx);

    expect(result.success).toBe(true);
    // 答案本身必须出来(不是"没找到")
    expect(matchLines(result.output)).toEqual([`sample.txt:1 foo bar`]);
    // 且必须说清"这一份不是 rg 答的,以及为什么"
    expect(result.output).toContain('engine=js-walk');
    expect(result.output).toContain('degraded_reason=');
    expect(result.output).not.toContain('engine=ripgrep');
    if (rgInstalledHere()) {
      expect(result.output).toContain('ripgrep exit 2');
    }
    expect(result.output).not.toMatch(/^未找到匹配/);
  });

  it('①b 两条通道都编译不了的模式 ⇒ 必须 success:false,而不是"未找到匹配"', async () => {
    const { dir, ctx } = mkWorkspace();
    writeAt(dir, 'sample.txt', 'foo bar');

    // `(` 未闭合:rg 退出码 2,`new RegExp('(')` 抛 SyntaxError ⇒ 谁都答不了。
    const result = await grep.execute({ pattern: '(', path: '.' }, ctx);

    expect(result.success).toBe(false);
    expect(result.output).toBe('');
    expect(result.error ?? '').toContain('either channel');
    expect(result.error ?? '').toContain('[js-walk]');
    expect(result.error ?? '').toContain('JS RegExp');
    if (rgInstalledHere()) expect(result.error ?? '').toContain('[ripgrep] ripgrep exit 2');
    // 失败绝不允许以"未找到匹配"的形态出现(那正是本票的病灶)
    expect(`${result.output}${result.error ?? ''}`).not.toContain('未找到匹配');
  });

  it('② 真无匹配仍回"未找到匹配",且答案出自哪条通道要可见', async () => {
    const { dir, ctx } = mkWorkspace();
    writeAt(dir, 'a.txt', 'hello world');
    writeAt(dir, 'b.txt', 'goodbye moon');

    const result = await grep.execute({ pattern: 'zzz-not-in-any-fixture-4f2c9a', path: '.' }, ctx);

    expect(result.success).toBe(true);
    expect(result.output).toMatch(/^未找到匹配/);
    expect(result.output).toContain('engine=');
    if (rgInstalledHere()) {
      // rg 退出码 1 是**合法**的"确实没有":不得被误判成失败而降级。
      expect(result.output).toContain('engine=ripgrep');
      expect(result.output).not.toContain('degraded_reason=');
    } else {
      expect(result.output).toContain('engine=js-walk');
      expect(result.output).toContain('degraded_reason=');
    }
  });

  it('③ rg 缺失时走 JS walk,且命中集与 rg 通道逐条一致', async () => {
    const { dir, ctx } = mkWorkspace();
    writeAt(dir, 'a.txt', 'hello world\nsecond line');
    writeAt(dir, 'b.txt', 'hello again\nthird line');

    const viaCurrentChannel = await grep.execute({ pattern: 'hello', path: '.' }, ctx);
    const expected = matchLines(viaCurrentChannel.output);
    expect(expected).toHaveLength(2);

    // 造"rg 不在 PATH":清空 PATH 后重新取一份**全新模块实例**
    // (模块级探测缓存必须被重置,否则复用的还是上一次已缓存的"可用"结论)。
    const savedPath = process.env.PATH;
    const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-empty-bin-'));
    createdDirs.push(emptyBin);
    try {
      process.env.PATH = emptyBin;
      vi.resetModules();
      const fresh = await import('../src/tools/builtins.js');
      const viaWalk = await fresh.grep.execute({ pattern: 'hello', path: '.' }, ctx);

      expect(viaWalk.output).toContain('engine=js-walk');
      // 降级必须喊出为什么 —— 静默换通道就是"用 rg 的名义报告一次纯遍历扫描"
      expect(viaWalk.output).toContain('degraded_reason=');
      expect(matchLines(viaWalk.output)).toEqual(expected);
    } finally {
      process.env.PATH = savedPath;
      vi.resetModules();
    }
  });

  it('③b 命中行走 rg 通道时也必须带 engine 标注(可见性不因成功而免)', async () => {
    const { dir, ctx } = mkWorkspace();
    writeAt(dir, 'a.txt', 'hello world');
    const result = await grep.execute({ pattern: 'hello', path: '.' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('engine=');
    if (rgInstalledHere()) expect(result.output).toContain('engine=ripgrep');
  });
});

describe('二进制嗅探窗口与注释同值', () => {
  it('④ NULL 落在窗口内 ⇒ 判二进制(此前 8 字节窗口会把它当文本整读)', async () => {
    const { dir, ctx } = mkWorkspace();
    const inside = Buffer.concat([
      Buffer.from('x'.repeat(BINARY_SNIFF_BYTES - 10), 'utf8'),
      Buffer.from([0x00]),
      Buffer.from('tail', 'utf8'),
    ]);
    writeAt(dir, 'inside.txt', inside);

    const result = await read_file.execute({ path: 'inside.txt' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('NULL');
  });

  it('④b 同一位置改到窗口外 ⇒ 不判二进制(成对:窗口判据真的有牙)', async () => {
    const { dir, ctx } = mkWorkspace();
    const outside = Buffer.concat([
      Buffer.from('x'.repeat(BINARY_SNIFF_BYTES + 40), 'utf8'),
      Buffer.from([0x00]),
      Buffer.from('tail', 'utf8'),
    ]);
    writeAt(dir, 'outside.txt', outside);

    const result = await read_file.execute({ path: 'outside.txt' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).not.toContain('NULL');
    // 前 BINARY_SNIFF_BYTES+40 个 'x' 远超 500 行?不,它是一行 ⇒ 行数闸不触发
    expect(result.output).toContain('xxxx');
  });
});

describe('read_file 字节上限(超限必须如实,不得静默变短)', () => {
  it('⑤ 超过字节上限 ⇒ 输出带总量与已读量,且尾部内容确实没被读到', async () => {
    const { dir, ctx } = mkWorkspace();
    const line = 'x'.repeat(200);
    const lineCount = Math.ceil(MAX_READ_BYTES / (line.length + 1)) + 50; // 刻意越过上限
    const body = Array.from({ length: lineCount }, (_, i) => `${i} ${line.slice(String(i).length)}`).join('\n');
    const abs = writeAt(dir, 'big.txt', `${body}\nTAIL-MUST-NOT-APPEAR`);
    const totalBytes = fs.statSync(abs).size;
    expect(totalBytes).toBeGreaterThan(MAX_READ_BYTES);

    const result = await read_file.execute({ path: 'big.txt' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('truncated:');
    expect(result.output).toContain(`file is ${totalBytes} bytes`);
    expect(result.output).toContain('only the first ');
    expect(result.output).toContain('NOT inspected');
    expect(result.output).not.toContain('TAIL-MUST-NOT-APPEAR');
    // 行数闸仍在,且不再谎称知道文件总行数
    expect(result.output).toContain(`仅显示前 500 行`);
  });

  it('⑤b 未超限的文件不得出现截断标注(成对:上限不是恒报警)', async () => {
    const { dir, ctx } = mkWorkspace();
    writeAt(dir, 'small.txt', 'one\ntwo\nthree');
    const result = await read_file.execute({ path: 'small.txt' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).not.toContain('truncated:');
    expect(result.output).toContain('three');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
