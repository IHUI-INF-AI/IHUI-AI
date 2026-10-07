// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814413 派单面的四个验收点,各一条用例钉住。全部走**分派入口**
 * `buildCustomCommandInvocation`(REPL repl.ts 的 default: 分支真调的那个),
 * 与单元面 `tests/custom-command-expand.test.ts` 互补而不重复 —— 那份钉实现,本份钉
 * "REPL 接线上这些语义真的发生":
 *  ① `$ARGUMENTS` 整串替换;
 *  ② `$1..$n` 位置替换(引号/转义按一个参数计);
 *  ③ 正文无占位符而用户给了参数 ⇒ 追加 `User arguments:` 段(上游
 *     `custom-command-expand.ts:41-43` 同语义);
 *  ④ **探测保留名时不得调用会执行 `!` 的 resolver** —— 哨兵文件阳性对照:保留名短路
 *     发生在 load 之前,内嵌 shell 连被读到都不会,更不会被执行;先故意执行一次证明
 *     "哨兵不存在"这半边判据有牙(只留"不存在"等于给一台没在看的尺子发合格证)。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fsNode from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  buildCustomCommandInvocation,
  getCustomCommandsDir,
  probeCustomCommand,
} from '../src/commands/custom-commands.js';

/** 写一条命令文件(绕过 save,模拟用户手写 / 搬家来的文件) */
function writeCommandFile(name: string, body: string): string {
  const dir = getCustomCommandsDir();
  fsNode.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.md`);
  fsNode.writeFileSync(file, body, 'utf-8');
  return file;
}

describe('G-814413:自定义命令展开链($ARGUMENTS / $1..$n / User arguments: / 探测不执行 !)', () => {
  let tmpHome = '';
  let originalEnv: NodeJS.ProcessEnv = {};

  beforeEach(() => {
    tmpHome = fsNode.mkdtempSync(path.join(os.tmpdir(), 'ihui-g814413-'));
    originalEnv = { ...process.env };
    // §15b:落点是用户级目录,测试经 IHUI_HOME 换根,不碰真实 ~/.ihui
    process.env.IHUI_HOME = tmpHome;
  });

  afterEach(() => {
    process.env = originalEnv;
    fsNode.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('① $ARGUMENTS 被整串替换,且不再追加 User arguments 段', () => {
    writeCommandFile('g814413-echo', 'Echo: $ARGUMENTS');
    const inv = buildCustomCommandInvocation('g814413-echo', 'a b c');
    expect(inv.handled).toBe(true);
    if (inv.handled) {
      expect(inv.prompt).toContain('Echo: a b c');
      expect(inv.prompt).not.toContain('User arguments:');
      expect(inv.usedArgumentsPlaceholder).toBe(true);
      expect(inv.argumentCount).toBe(3);
    }
  });

  it('② $1..$n 按位置替换,引号包住的空格算一个参数', () => {
    writeCommandFile('g814413-two', '第一 [$1] 第二 [$2]');
    const inv = buildCustomCommandInvocation('g814413-two', '"带 空格 的参数" second');
    expect(inv.handled).toBe(true);
    if (inv.handled) {
      expect(inv.prompt).toContain('第一 [带 空格 的参数] 第二 [second]');
      expect(inv.usedArgumentsPlaceholder).toBe(true);
      expect(inv.argumentCount).toBe(2);
    }
  });

  it('③ 正文无占位符而给了参数 ⇒ 追加 User arguments: 段(上游 :41-43 同语义)', () => {
    writeCommandFile('g814413-plain', '列出未完成任务');
    const inv = buildCustomCommandInvocation('g814413-plain', 'alpha beta');
    expect(inv.handled).toBe(true);
    if (inv.handled) {
      expect(inv.prompt).toContain('User arguments:\nalpha beta');
      expect(inv.usedArgumentsPlaceholder).toBe(false);
      expect(inv.argumentCount).toBe(2);
    }
  });

  it('④ 探测保留名不执行 !:保留名短路先于读盘,内嵌 shell 连被读到都不会(哨兵阳性对照)', () => {
    const sentinel = path.join(tmpHome, 'g814413-sentinel.txt');
    const embedded = `require('fs').writeFileSync(${JSON.stringify(sentinel)},'ran')`;
    // 阳性对照:这段 body 若被执行,哨兵必然出现 —— 先故意执行一次,证明判据有牙。
    // (2026-10-04:Windows 下 spawnSync 须给 stdio,否则 EBUSY;与既有套件同一坑)
    execFileSync(process.execPath, ['-e', embedded], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(fsNode.existsSync(sentinel)).toBe(true);
    fsNode.rmSync(sentinel, { force: true });

    // 保留名 'model' 名下埋一份含内嵌 shell 的文件 —— 探测判据(保留名先问)必须在读盘之前返回
    const planted = writeCommandFile('model', `看看 !\`${embedded}\` 的结果`);
    expect(fsNode.existsSync(planted)).toBe(true); // 文件确实在盘上,不是"没读到才绿"

    expect(probeCustomCommand('model')).toBe(false);
    expect(fsNode.existsSync(sentinel)).toBe(false); // 探测跑完,哨兵不存在

    const inv = buildCustomCommandInvocation('model', 'x');
    expect(inv.handled).toBe(false);
    if (!inv.handled) expect(inv.reason).toBe('reserved');
    expect(fsNode.existsSync(sentinel)).toBe(false); // 分派同样不执行
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
