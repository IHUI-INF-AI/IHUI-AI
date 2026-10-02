// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-733 —— 提交点必须**逐阶段**证明"任何一步死都零半成品"。
 *
 * 票面立因:「恢复代码写了却从没被逐阶段证明可用 = 本仓"判据失效的表现永远是安静"那一型」。
 * 本仓 `recoverStaleSwapArtifacts` 的处置表覆盖六类现场,但在本票之前,没有一个开关能让提交
 * 序列在**每一个** checkpoint 当场死一次 —— 于是"任何一步死都零半成品"是一句没有证人的承诺。
 *
 * 成对性(每条都不是"setter 能用"式的空断言):
 *  - 五档各跑一次,每一档都**必须**抛 `InjectedSwapFaultError`(有人加了枚举名而忘挂点 ⇒ 这一档不抛 ⇒ 红);
 *  - 每一档的**现场形状**互不相同,所以挂点接错位置也会红:
 *      afterStaging    ⇒ 目标仍是旧副本、归档不存在
 *      afterOwnership  ⇒ 目标让出、归档=旧副本、**归档里没有事务标记**
 *      afterMarker     ⇒ 同上,但归档里**有**标记(这一对是②③唯一的区分凭据)
 *      afterLand       ⇒ 目标=新副本、归档仍在(finalize 还没跑)
 *      beforeFinalize  ⇒ 同 afterLand,且归档仍在 ⇒ 证明 finalize 确实被跳过而非"跑了但没删"
 *  - 错误自带的两份现场读数必须与测试独立现读的盘上状态**逐值相等**(读数撒谎即红);
 *  - 反向锁:不传 `faultAt` ⇒ 常态提交一路走完,新副本在位、归档被清除、无遗留(证明上面那些
 *    现场全部由注入造成,而不是注入点把常态行为改坏了);
 *  - 权威面在整个循环里字节不变(提交序列不写 registry;若将来有人在注入路径上顺手落权威,这条红)。
 *
 * 夹具落点与豁免口径逐字沿用 `plugin-cache-rollback.test.ts`(同一套 scratch 根 + IHUI_HOME)。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):活进程的 TEMP 可能仍钉在 C 盘,故一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import {
  InjectedSwapFaultError,
  SWAP_FAULT_STAGES,
  commitStagedSwap,
  isUsableDirectoryCopy,
  prepareStagingDirectory,
  supersededPathFor,
  swapMarkerName,
  swapScratchMarkers,
  type SwapAuthority,
  type SwapFaultStage,
} from '../src/plugins/cache.js';

let root: string;
beforeEach(() => {
  root = mkScratch('swap-fault-');
});
afterEach(() => {
  rmScratch(root);
});

/** 权威面:一个真实存在的 registry 形状文件(提交序列只读不写 ⇒ 用它断言"未动")。 */
function makeAuthority(): { authority: SwapAuthority; file: string; seed: string } {
  const file = path.join(root, 'registry.json');
  const seed = JSON.stringify({ records: [{ name: 'demo', installedAt: '2026-01-01T00:00:00.000Z' }] });
  fs.writeFileSync(file, seed, 'utf-8');
  return { authority: { path: file, recordKey: 'demo' }, file, seed };
}

/** 造一个"目标已有旧副本 + staging 已备好新副本"的现场。 */
function makeScene(name: string): { target: string; staging: string } {
  const target = path.join(root, 'swap-root', name);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'old.txt'), 'old', 'utf-8');
  const staging = prepareStagingDirectory(target);
  fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');
  return { target, staging };
}

function listDir(p: string): string[] {
  return fs.existsSync(p) ? fs.readdirSync(p).sort() : [];
}

/** parent 下所有还没被消费的暂存目录(崩溃遗留物的判据口径)。 */
function leftoverStagings(parent: string): string[] {
  if (!fs.existsSync(parent)) return [];
  const marker = swapScratchMarkers().staging;
  return fs.readdirSync(parent).filter((n) => n.includes(marker));
}

/** 命中某一档并返回那个错误(同时把盘上现场读回来供逐值对账)。 */
function fireAt(stage: SwapFaultStage, target: string, staging: string, authority: SwapAuthority): InjectedSwapFaultError {
  let caught: unknown = null;
  try {
    commitStagedSwap(target, staging, { authority, faultAt: stage });
  } catch (e) {
    caught = e;
  }
  expect(caught, `注入档 ${stage} 必须真的当场死一次(挂点没接上就等于这一步没有证明)`).toBeInstanceOf(
    InjectedSwapFaultError,
  );
  return caught as InjectedSwapFaultError;
}

describe('G-733 提交点逐阶段故障注入 — 任何一步死都零半成品', () => {
  it('枚举封闭集就是这五档(新增一档必须同时有挂点与现场断言,否则这一档没有证明)', () => {
    expect([...SWAP_FAULT_STAGES]).toEqual([
      'afterStaging',
      'afterOwnership',
      'afterMarker',
      'afterLand',
      'beforeFinalize',
    ]);
  });

  it('逐阶段循环:每档都当场抛、现场形状各异、目标永不是半份、权威面一字未动', () => {
    const { authority, file, seed } = makeAuthority();
    const stagesTried: string[] = [];

    for (const stage of SWAP_FAULT_STAGES) {
      const { target, staging } = makeScene(`case-${stage}`);
      const err = fireAt(stage, target, staging, authority);
      stagesTried.push(err.stage);

      // ① 错误里的现场读数必须与盘上现读**逐值相等**(尺子给自己发合格证即红)
      const targetOnDisk = isUsableDirectoryCopy(target);
      const archive = supersededPathFor(target);
      const archiveOnDisk = isUsableDirectoryCopy(archive);
      expect(err.targetHasContent, `${stage}:错误读到的目标状态` ).toBe(targetOnDisk);
      expect(err.archiveHasContent, `${stage}:错误读到的归档状态`).toBe(archiveOnDisk);

      // ② 绝不出现"两代都没了"
      expect(targetOnDisk || archiveOnDisk, `${stage}:目标与归档同时为空 = 内容丢失`).toBe(true);

      // ③ 目标里若有内容,必须是**完整的一代**(恰一个文件),不得是新旧混装的半份
      if (targetOnDisk) {
        expect(listDir(target), `${stage}:目标目录混了两代内容`).toEqual(
          stage === 'afterStaging' ? ['old.txt'] : ['new.txt'],
        );
        expect(fs.readFileSync(path.join(target, stage === 'afterStaging' ? 'old.txt' : 'new.txt'), 'utf-8')).toBe(
          stage === 'afterStaging' ? 'old' : 'new',
        );
      }

      // ④ 归档若存在,逐字仍是那份旧副本(可回位)
      if (archiveOnDisk) {
        expect(fs.readFileSync(path.join(archive, 'old.txt'), 'utf-8'), `${stage}:归档里的旧副本被改坏`).toBe('old');
      }

      // ⑤ 每一档的现场形状互不相同 ⇒ 挂点接错位置也会红
      switch (stage) {
        case 'afterStaging':
          expect(targetOnDisk).toBe(true);
          expect(archiveOnDisk).toBe(false);
          break;
        case 'afterOwnership':
        case 'afterMarker':
          expect(targetOnDisk).toBe(false);
          expect(archiveOnDisk).toBe(true);
          // ②③唯一的区分凭据:事务标记到没到归档里
          expect(fs.existsSync(path.join(archive, swapMarkerName())), `${stage}:事务标记在位与否判错档`).toBe(
            stage === 'afterMarker',
          );
          break;
        case 'afterLand':
        case 'beforeFinalize':
          expect(targetOnDisk).toBe(true);
          expect(archiveOnDisk).toBe(true); // finalize 被跳过 ⇒ 归档一定还没被处置
          break;
      }

      // ⑥ 遗留的暂存目录(崩溃场景下允许存在)必须逐字还是那份完整新副本,不得半份
      for (const orphan of leftoverStagings(path.dirname(target))) {
        expect(listDir(path.join(path.dirname(target), orphan)), `${stage}:遗留暂存是半份`).toEqual(['new.txt']);
      }

      // ⑦ 权威面全程只读
      expect(fs.readFileSync(file, 'utf-8'), `${stage}:注入路径写动了权威记录`).toBe(seed);
    }

    // 循环真的跑满了五档(而不是被某种"提前返回"静默截短)
    expect(stagesTried).toEqual([...SWAP_FAULT_STAGES]);
  });

  it('反向锁:不传 faultAt ⇒ 常态提交照旧跑完(新副本在位、归档被清除、无遗留暂存)', () => {
    const { authority, file, seed } = makeAuthority();
    const { target, staging } = makeScene('no-fault');

    const result = commitStagedSwap(target, staging, { authority });

    expect(result.swap.superseded).toBe(supersededPathFor(target));
    expect(listDir(target)).toEqual(['new.txt']);
    expect(fs.readFileSync(path.join(target, 'new.txt'), 'utf-8')).toBe('new');
    // 归档此刻**应当**被 finalize 处置掉(与注入档"归档仍在"成对)
    expect(isUsableDirectoryCopy(supersededPathFor(target))).toBe(false);
    expect(leftoverStagings(path.dirname(target))).toEqual([]);
    expect(fs.readFileSync(file, 'utf-8')).toBe(seed);
    expect(result.finalized.deleted).toBe(true);
  });

  it('注入错误与真实换失败不同形(否则"期望抛错"会被真实失败顶掉)', () => {
    const { authority } = makeAuthority();
    const { target, staging } = makeScene('shape-check');
    const err = fireAt('afterLand', target, staging, authority);
    expect(err.name).toBe('InjectedSwapFaultError');
    expect(err.code).toBe('injected_swap_fault');
    expect(err.target).toBe(target);
    // 明确不是 DirectorySwapError:那才是生产真会抛的那一类
    expect(err.constructor.name).not.toBe('DirectorySwapError');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
