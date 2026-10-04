// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-09-28 —— 钩子信任清单的**写盘安全性**与**损坏 fail-closed** 对账。
 *
 * 钉的是哪一格敞口:`apps/cli/src/hooks/trust.ts` 里那份"批准后免批"的清单此前用裸
 * `writeFileSync` / `appendFileSync` 落盘,而判这条纪律的守门 `scripts/check-file-write-safety.mjs`
 * 射程是 `SCAN_DIR='apps/cli/src/tools'`(现读:该面枚举 62 个文件,`hooks/` 不在内)⇒ 那几处裸写
 * **结构上不可见**。写坏它 = 钩子在无人批准下执行;清空它 = 批准静默丢失。
 *
 * 断言一律走**生产入口**(`gateHook` / `saveTrustedFolderRecord` / `readTrustedFolderRecord` /
 * `untrustFolder` / `grantHumanHookOverride` / `readTrustFileSnapshot`)。测试里**不得**内联第二份
 * 原子写实现、第二份损坏判定,或第二份"什么算裸写"的识别规则 —— 最后那一件直接从守门 import
 * 它自己的 `analyzeFile`/`maskCommentsAndStrings`(两处各写一遍必然漂移,而漂移的表现是
 * "门和测试都说没事")。
 *
 * 六组判据(全部成对):
 *   A 源码级反向锁 —— 代码面不得再出现裸写盘,且唯一出口必须既被 import 也被真调用。
 *   B 读后写冲突 —— 别人在窗口内改过 ⇒ 要么重试后**在别人那份之上重算**(不是后写赢),
 *     要么有界重试仍冲突 ⇒ **拒绝覆盖 + 点名**,磁盘仍是对方那份。
 *   C 损坏 fail-closed —— 某行读不出摘要 ⇒ 整份改名留证(`.corrupt-<UTC 时刻>`,原字节逐字可复得)、
 *     **任何**钩子都不放行(含清单里那条完好的记录),且人工放行台账这一轮不参与。
 *   D 回归对照 —— 读盘判定与"注入同一份文本"的判定逐字同结论(本票只换了取材,没换判据)。
 *   E 标记与坏行不得被读成批准 —— 注释行、摘要表坏行、台账里缺理由/缺 grantedBy 的行。
 *   F 快照四态 —— absent / ok / corrupt / unreadable 各自交出的记录集与现场处置。
 *
 * 夹具落点 `scripts/lib/scratch-dir.mjs`(§26:不落 os.tmpdir());真实 `~/.ihui` 一个字节都不写
 * —— 所有写点都由调用方把路径指进夹具。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as fsType from 'node:fs';

import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

/**
 * 并发写者的模拟开关。`node:fs` 的 readFileSync 被本文件 mock 了一层:命中 target 且到达指定
 * 调用次序时,先落一份"别人的"字节再返回它 —— 这正是 `commitAtomicWrite` 读后写校验要拦的形态。
 * `{n}` 占位换成注入序号:B 组用它分别演"改一次就收敛"与"一直有人抢着写"。
 */
const conc = vi.hoisted(() => ({
  target: '',
  fromCall: 2,
  maxInjects: 1,
  template: 'OTHER#{n}\n',
  calls: {} as Record<string, number>,
  injections: 0,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof fsType;
  return {
    ...actual,
    readFileSync: ((...args: Parameters<typeof actual.readFileSync>) => {
      const p = typeof args[0] === 'string' ? args[0] : '';
      const value = (actual.readFileSync as (...a: unknown[]) => unknown)(...args);
      if (p !== '' && p === conc.target) {
        conc.calls[p] = (conc.calls[p] ?? 0) + 1;
        if (conc.calls[p] >= conc.fromCall && conc.injections < conc.maxInjects) {
          conc.injections += 1;
          const churn = conc.template.replace('{n}', String(conc.injections));
          actual.writeFileSync(p, churn, 'utf-8');
          return churn;
        }
      }
      return value;
    }) as typeof actual.readFileSync,
  };
});

import {
  gateHook,
  grantHumanHookOverride,
  hasHumanHookOverride,
  isFolderTrusted,
  normalizeFolderPath,
  readTrustedFolderRecord,
  readTrustFileSnapshot,
  saveTrustedFolderRecord,
  untrustFolder,
} from '../src/hooks/trust.js';

// 反向锁用的判据 = 那道 blocking 守门自己的实现(§22c:测试不得再抄一份)
import { __test__ as writeSafety } from '../../../scripts/check-file-write-safety.mjs'; // arch-exempt: §22c 镜像测试必须 import 被判门体本身(禁止在测试里抄第二份判据),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

const { analyzeFile } = writeSafety;

const TRUST_SOURCE_REL = 'apps/cli/src/hooks/trust.ts';
const TRUST_SOURCE_PATH = fileURLToPath(new URL('../src/hooks/trust.ts', import.meta.url));

let scratch = '';
let trustPath = '';
let overridesPath = '';
let warnSpy: ReturnType<typeof vi.spyOn> = vi.fn() as unknown as ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  scratch = mkScratch('hooks-trust-atomic-') as string;
  trustPath = path.join(scratch, 'trusted-folders');
  overridesPath = path.join(scratch, 'hook-overrides.jsonl');
  conc.target = '';
  conc.fromCall = 2;
  conc.maxInjects = 1;
  conc.template = 'OTHER#{n}\n';
  conc.calls = {};
  conc.injections = 0;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
  rmScratch(scratch);
});

/** 一行新格式记录(列序与生产写点同源:路径 \t 束 \t 单条表) */
function lineOf(folder: string, bundleDigest: string, declTable = '{}'): string {
  return `${folder}\t${bundleDigest}\t${declTable}`;
}

/** 刻意不 trim:尾换行差一个字节就是另一份清单(本仓因 .trim() 静默失效过一整天) */
function readText(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

function evidenceFiles(): string[] {
  return fs.readdirSync(scratch).filter((n: string) => n.includes('.corrupt-'));
}

describe('A 源码级反向锁:裸写盘不得回来,唯一出口必须真被引用', () => {
  it('A1 trust.ts 代码面零裸 writeFileSync/appendFileSync —— 用守门自己的判据', () => {
    const src = readText(TRUST_SOURCE_PATH);
    expect(analyzeFile(TRUST_SOURCE_REL, src).bareWrites).toEqual([]);
    // 有牙证明:同一把尺子喂"把一处 writeOrComplain 退回裸写"的构造面必须命中,
    // 否则 A1 只是恒真断言(§22c"镜像测试只复读实现就是复读机")。
    const mutated = src.replace('writeOrComplain(', 'writeFileSync(');
    expect(mutated).not.toBe(src);
    expect(analyzeFile(TRUST_SOURCE_REL, mutated).bareWrites.length).toBeGreaterThan(0);
  });

  it('A2 唯一出口既被 import 也被真调用(半个接线 = 造好没装车)', () => {
    const src = readText(TRUST_SOURCE_PATH);
    const code = writeSafety.maskComments(src).join('\n');
    expect(writeSafety.EXIT_IMPORT_RE.test(code)).toBe(true);
    const facts = analyzeFile(TRUST_SOURCE_REL, src);
    expect(facts.importsAtomicExit).toBe(true);
    expect(facts.callsCaptureBaseline).toBeGreaterThan(0);
    expect(facts.callsCommitAtomic).toBeGreaterThan(0);
    // 捕获与提交必须成对:只 commit 不 capture 就是绕开读后写校验(守门 122 的 R3 同型)
    expect(facts.callsCommitAtomic).toBeLessThanOrEqual(facts.callsCaptureBaseline);
    // 反向对照:把 import 那行删掉,判据必须看不见出口
    const noImport = src.replace(/import \{ captureWriteBaseline[\s\S]*?atomic-write\.js'\n/, '');
    expect(noImport).not.toBe(src);
    expect(analyzeFile(TRUST_SOURCE_REL, noImport).importsAtomicExit).toBe(false);
  });

  it('A3 遮噪方向按守门口径:注释里的裸写形态不计入,真代码必须计入', () => {
    const withComment = '// 旧写法在这里 writeFileSync(p, x)\nconst a = 1\n';
    expect(analyzeFile('apps/cli/src/hooks/probe.ts', withComment).bareWrites).toEqual([]);
    expect(analyzeFile('apps/cli/src/hooks/probe.ts', 'fs.writeFileSync(p, x)\n').bareWrites.length).toBe(1);
  });
});

describe('B 读后写冲突:拒绝覆盖并点名,不是后写赢', () => {
  const otherLine = lineOf('C:/other/folder', 'sha-other');

  it('B1 窗口内被改一次 ⇒ 重试后收敛,别人那一行仍在(不是后写赢)', () => {
    fs.writeFileSync(trustPath, `${otherLine}\n`, 'utf-8');
    conc.target = trustPath;
    conc.maxInjects = 1;
    conc.template = `${otherLine}\n`;

    expect(saveTrustedFolderRecord('C:/mine/folder', 'sha-mine', {}, trustPath)).toBe(true);

    const after = readText(trustPath);
    expect(after).toContain('C:/other/folder');
    expect(after).toContain('sha-mine');
    expect(warnSpy).not.toHaveBeenCalled();
    // 生产读侧两条都认得(不是"写进去了但读不回来")
    expect(isFolderTrusted('C:/other/folder', undefined, trustPath)).toBe(true);
    expect(isFolderTrusted('C:/mine/folder', undefined, trustPath)).toBe(true);
    // 同目录不留 tmp
    expect(fs.readdirSync(scratch).filter((n: string) => n.includes('.tmp-'))).toEqual([]);
  });

  it('B2 一直有人抢着写 ⇒ 返回 false + 点名 + 我们那一行没被写进去(磁盘仍是别人那份)', () => {
    fs.writeFileSync(trustPath, `${otherLine}\n`, 'utf-8');
    conc.target = trustPath;
    conc.maxInjects = 99;
    conc.template = 'CONCURRENT#{n}\n';

    expect(saveTrustedFolderRecord('C:/mine/folder', 'sha-mine', {}, trustPath)).toBe(false);

    const after = readText(trustPath);
    expect(after).not.toContain('sha-mine');
    // 磁盘仍是"别人"最后写进去的那一份(注入器写的),我们的记录没有落上
    expect(after.startsWith('CONCURRENT#')).toBe(true);
    const named = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(named.some((c) => c.includes('拒绝写入信任清单') && c.includes(trustPath))).toBe(true);
    expect(fs.readdirSync(scratch).filter((n: string) => n.includes('.tmp-'))).toEqual([]);
  });

  it('B3 人工放行台账的追加同样走原子出口:冲突时不覆盖别人的台账行', () => {
    const prior = JSON.stringify({
      grantedAt: '2026-09-28T00:00:00.000Z',
      grantedBy: 'human',
      hookName: 'hook-who-was-first',
      folder: 'C:/x',
      bundleDigest: 'sha-first',
      reason: '别人这条放行必须原样留着',
    });
    fs.writeFileSync(overridesPath, `${prior}\n`, 'utf-8');
    conc.target = overridesPath;
    conc.maxInjects = 99;
    conc.template = 'CONCURRENT#{n}\n';

    const res = grantHumanHookOverride(
      { hookName: 'hook-mine', folder: 'C:/y', bundleDigest: 'sha-mine', reason: '我这轮放不了' },
      overridesPath,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('write-failed');
    expect(typeof res.errorDetail).toBe('string');
    expect(res.errorDetail).toContain('写入冲突');
    expect(readText(overridesPath)).not.toContain('hook-mine');
  });

  it('B4 成对对照:没有并发时同一调用逐字成功(证明 B2 的红来自判据而不是夹具)', () => {
    expect(saveTrustedFolderRecord('C:/mine/folder', 'sha-mine', {}, trustPath)).toBe(true);
    expect(readText(trustPath)).toContain('sha-mine');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('C 清单损坏:改名留证 + 不放行任何钩子', () => {
  const good = 'C:/good/folder';
  const bad = 'C:/bad/folder';

  function writeCorruptList(): string {
    const text = [lineOf(good, 'sha-good', '{"h":"d-h"}'), lineOf(bad, 'sha-bad', '{not json'), ''].join('\n');
    fs.writeFileSync(trustPath, text, 'utf-8');
    return text;
  }

  it('C1 损坏 ⇒ gateHook 判拒,原文件被改名留证,损坏字节逐字可复得', () => {
    const original = writeCorruptList();

    const g = gateHook(
      { name: 'h', bundleDigest: 'sha-good', hookName: 'h', declarationDigest: 'd-h' },
      good,
      undefined,
      undefined,
      trustPath,
    );
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('folder-not-trusted');
    expect(g.detail).toContain('corrupt');
    expect(fs.existsSync(trustPath)).toBe(false);

    const evidences = evidenceFiles();
    expect(evidences.length).toBe(1);
    const evidencePath = path.join(scratch, evidences[0]);
    expect(Buffer.compare(Buffer.from(readText(evidencePath), 'utf-8'), Buffer.from(original, 'utf-8'))).toBe(0);
  });

  it('C2 留证之后,清单里**完好**的那一条同样不放行(拒绝放行任何钩子)', () => {
    writeCorruptList();
    const g = gateHook({ name: 'h', bundleDigest: 'sha-good' }, good, undefined, undefined, trustPath);
    expect(g.allowed).toBe(false);
    expect(readTrustFileSnapshot(trustPath).state).toBe('absent');
    expect(isFolderTrusted(good, undefined, trustPath)).toBe(false);
    expect(isFolderTrusted(bad, undefined, trustPath)).toBe(false);
  });

  it('C3 台账在清单损坏这一轮不参与(不得把损坏当空清单照常放行),且台账本身未被改动', () => {
    const original = writeCorruptList();
    const grant = grantHumanHookOverride(
      { hookName: 'h', folder: good, bundleDigest: 'sha-good', declarationDigest: 'd-h', reason: '人工复核过这条命令' },
      overridesPath,
    );
    expect(grant.ok).toBe(true);
    const overridesText = readText(overridesPath);
    expect(hasHumanHookOverride('h', good, 'sha-good', 'd-h', overridesText)).toBe(true);

    const g = gateHook(
      { name: 'h', bundleDigest: 'sha-good', hookName: 'h', declarationDigest: 'd-h' },
      good,
      undefined,
      overridesText,
      trustPath,
    );
    expect(g.allowed).toBe(false);
    expect(g.overridden).toBeUndefined();
    expect(g.detail).toContain('不参与');
    expect(readText(overridesPath)).toBe(overridesText);
    expect(evidenceFiles().length).toBe(1);
    expect(readText(path.join(scratch, evidenceFiles()[0]))).toBe(original);
  });

  it('C4 成对对照:同一份清单没有坏行时,同样的 gateHook 判定为放行且不动盘', () => {
    fs.writeFileSync(trustPath, `${lineOf(good, 'sha-good', '{"h":"d-h"}')}\n`, 'utf-8');
    const g = gateHook(
      { name: 'h', bundleDigest: 'sha-good', hookName: 'h', declarationDigest: 'd-h' },
      good,
      undefined,
      undefined,
      trustPath,
    );
    expect(g.allowed).toBe(true);
    expect(fs.existsSync(trustPath)).toBe(true);
    expect(evidenceFiles()).toEqual([]);
  });
});

describe('D 回归对照:取材换了,判据一字未改', () => {
  it('D1 读盘判定 = 注入同一份磁盘文本的判定(生产入口两处同形)', () => {
    const folder = 'C:/round/trip';
    expect(saveTrustedFolderRecord(folder, 'sha-1', { h: 'd-h' }, trustPath)).toBe(true);
    const onDisk = readText(trustPath);

    const fromFile = readTrustedFolderRecord(folder, undefined, trustPath);
    const fromText = readTrustedFolderRecord(folder, onDisk);
    expect(fromFile).not.toBeNull();
    expect(fromFile).toEqual(fromText);
    expect(fromFile?.legacy).toBe(false);
    expect(fromFile?.malformed).toBe(false);
    expect(fromFile?.declarationDigests).toEqual({ h: 'd-h' });

    const viaFile = gateHook(
      { name: 'h', bundleDigest: 'sha-1', hookName: 'h', declarationDigest: 'd-h' },
      folder,
      undefined,
      undefined,
      trustPath,
    );
    const viaText = gateHook(
      { name: 'h', bundleDigest: 'sha-1', hookName: 'h', declarationDigest: 'd-h' },
      folder,
      onDisk,
    );
    expect(viaFile).toEqual(viaText);
    expect(viaFile.allowed).toBe(true);
  });

  it('D2 覆盖同一目录只留一行,其它行逐字不动(旧 append 会留下两行而读侧只认第一行)', () => {
    // 平台中立取材:Linux 上 path.resolve('C:/twice') 会挂上 cwd 前缀,字面 Windows
    // 盘符路径经 normalizeFolderPath 后行首不再匹配 ⇒ 断言恒红。夹具目录改用真实
    // 绝对路径(scratch 之下),两端同判。
    const keepFolder = path.join(scratch, 'keep', 'me');
    const twice = path.join(scratch, 'twice');
    const keep = lineOf(keepFolder, 'sha-keep', '{"k":"d-k"}');
    fs.writeFileSync(trustPath, `${keep}\n`, 'utf-8');
    expect(saveTrustedFolderRecord(twice, 'sha-a', {}, trustPath)).toBe(true);
    expect(saveTrustedFolderRecord(twice, 'sha-b', { x: 'd-x' }, trustPath)).toBe(true);

    const lines = readText(trustPath).split('\n');
    expect(lines.filter((l: string) => l.startsWith(twice)).length).toBe(1);
    expect(lines.some((l: string) => l.includes('sha-a'))).toBe(false);
    expect(lines[0]).toBe(keep);
    expect(isFolderTrusted(keepFolder, undefined, trustPath)).toBe(true);
  });

  it('D3 撤销按目录匹配整行;撤销后判"从未批准"而不是"内容未确认"', () => {
    const folder = 'C:/untrust/me';
    expect(saveTrustedFolderRecord(folder, 'sha-u', {}, trustPath)).toBe(true);
    expect(untrustFolder(folder, trustPath)).toBe(true);
    expect(isFolderTrusted(folder, undefined, trustPath)).toBe(false);
    const g = gateHook({ name: 'h', bundleDigest: 'sha-u' }, folder, undefined, undefined, trustPath);
    expect(g.reason).toBe('folder-not-trusted');
    // 不在名单里时撤销返回 false,而不是重写一次文件
    expect(untrustFolder(folder, trustPath)).toBe(false);
  });

  it('D4 含制表符/换行的路径拒绝写入(旧契约未变),且真的没落盘', () => {
    expect(saveTrustedFolderRecord('C:/we\trd', 'sha', {}, trustPath)).toBe(false);
    expect(fs.existsSync(trustPath)).toBe(false);
  });

  it('D5 旧格式裸目录行既不判"已信任"也不判"从未批准"(legacy 语义未被损坏判据吞掉)', () => {
    fs.writeFileSync(trustPath, 'C:/legacy/folder\n', 'utf-8');
    expect(isFolderTrusted('C:/legacy/folder', undefined, trustPath)).toBe(true);
    const g = gateHook({ name: 'h', bundleDigest: 'sha-any' }, 'C:/legacy/folder', undefined, undefined, trustPath);
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('content-not-confirmed');
    expect(evidenceFiles()).toEqual([]);
  });
});

describe('E 标记与坏行不得被读成批准', () => {
  it('E1 注释行里的"记录"不算批准;坏行在注入面上只判"摘要读不出来"', () => {
    const text = [`# ${lineOf('C:/commented/out', 'sha-c')}`, lineOf('C:/malformed', 'sha-m', '{not json')].join('\n');
    expect(isFolderTrusted('C:/commented/out', text)).toBe(false);
    expect(isFolderTrusted('C:/malformed', text)).toBe(true); // 目录级"批过没有"仍为真
    const g = gateHook({ name: 'h', bundleDigest: 'sha-m' }, 'C:/malformed', text);
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('content-not-confirmed');
    expect(g.detail).toContain('摘要字段读不出来');
  });

  it('E2 台账里缺理由 / 缺 grantedBy / 只是同名标记文本的行,都不构成放行', () => {
    const notGrants = [
      JSON.stringify({ hookName: 'h', folder: 'C:/z', bundleDigest: 'sha-z', reason: '   ' }),
      JSON.stringify({ hookName: 'h', folder: 'C:/z', bundleDigest: 'sha-z', reason: '有理由', grantedBy: 'auto' }),
      `# ${JSON.stringify({ hookName: 'h', folder: 'C:/z', bundleDigest: 'sha-z', reason: '注释里的', grantedBy: 'human' })}`,
      'digest-name-exempt: 这不是放行记录',
    ].join('\n');
    expect(hasHumanHookOverride('h', 'C:/z', 'sha-z', undefined, notGrants)).toBe(false);
    // 夹具必须让门真的走到"拒绝 ⇒ 查台账"那一格:目录批过但束摘要不符(否则门直接放行,
    // 这一条断言就成了"测夹具"而不是"测判据"——E3 就是它的正向对照)。
    const g = gateHook({ name: 'h', bundleDigest: 'sha-z' }, 'C:/z', lineOf('C:/z', 'sha-not-z'), notGrants);
    expect(g.allowed).toBe(false);
    expect(g.overridden).toBeUndefined();
  });

  it('E3 放行的束摘要必须逐字对上被拒那一刻(内容再变,旧放行不覆盖新内容)', () => {
    const folder = 'C:/bound/folder';
    const grant = JSON.stringify({
      grantedAt: '2026-09-28T00:00:00.000Z',
      grantedBy: 'human',
      hookName: 'h',
      folder,
      bundleDigest: 'sha-old',
      reason: '放的是那一份,不是这一份',
    });
    expect(
      gateHook({ name: 'h', bundleDigest: 'sha-new' }, folder, lineOf(folder, 'sha-anything'), grant).allowed,
    ).toBe(false);
    const matching = JSON.stringify({ ...JSON.parse(grant), bundleDigest: 'sha-new' });
    const g = gateHook({ name: 'h', bundleDigest: 'sha-new' }, folder, lineOf(folder, 'sha-different'), matching);
    expect(g.allowed).toBe(true);
    expect(g.overridden).toBe('human');
  });

  it('E4 normalizeFolderPath 与判侧同一把尺子(带尾斜杠的同一路径仍是同一条记录)', () => {
    const folder = 'C:/slash/folder';
    expect(saveTrustedFolderRecord(folder, 'sha-s', {}, trustPath)).toBe(true);
    expect(isFolderTrusted(`${folder}${path.sep}`, undefined, trustPath)).toBe(true);
    expect(isFolderTrusted(`${folder}/`, undefined, trustPath)).toBe(true);
    expect(normalizeFolderPath(`${folder}/`)).toBe(normalizeFolderPath(folder));
  });
});

describe('F readTrustFileSnapshot 的四个态', () => {
  it('F1 absent:文件不存在 ⇒ 空记录集且不动盘', () => {
    const snap = readTrustFileSnapshot(trustPath);
    expect(snap.state).toBe('absent');
    expect(snap.records).toEqual([]);
    expect(snap.evidencePath).toBeNull();
    expect(fs.existsSync(trustPath)).toBe(false);
  });

  it('F2 ok:记录集与 detail 自洽,detail 为空', () => {
    fs.writeFileSync(trustPath, `${lineOf('C:/ok/folder', 'sha-ok')}\n`, 'utf-8');
    const snap = readTrustFileSnapshot(trustPath);
    expect(snap.state).toBe('ok');
    expect(snap.records.map((r: { folder: string }) => r.folder)).toEqual([normalizeFolderPath('C:/ok/folder')]);
    expect(snap.detail).toBe('');
    expect(snap.text).toBe(readText(trustPath));
  });

  it('F3 corrupt:点名坏行行号,记录集清空,留证件在位且不会留第二次', () => {
    fs.writeFileSync(trustPath, `${lineOf('C:/a', 'sha-a')}\n${lineOf('C:/b', 'sha-b', '[1,2,3]')}\n`, 'utf-8');
    const snap = readTrustFileSnapshot(trustPath);
    expect(snap.state).toBe('corrupt');
    expect(snap.malformedLines).toEqual([2]);
    expect(snap.records).toEqual([]);
    expect(snap.evidencePath).toContain('.corrupt-');
    expect(readTrustFileSnapshot(trustPath).state).toBe('absent');
    expect(evidenceFiles().length).toBe(1);
  });

  it('F4 unreadable:清单路径被目录占据 ⇒ 不放行,但**不**改名(没读过内容就不许动现场)', () => {
    fs.mkdirSync(trustPath, { recursive: true });
    const snap = readTrustFileSnapshot(trustPath);
    expect(snap.state).toBe('unreadable');
    expect(snap.records).toEqual([]);
    expect(snap.detail).toContain('不放行任何钩子');
    expect(fs.existsSync(trustPath)).toBe(true);
    expect(evidenceFiles()).toEqual([]);
    expect(
      gateHook({ name: 'h', bundleDigest: 'sha' }, 'C:/any', undefined, undefined, trustPath).allowed,
    ).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
