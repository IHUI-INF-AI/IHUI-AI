// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「token 续期失败成因到人」—— 第十轮小面接线票的验收面。
 *
 * 上一票建立了失败固化台账与只读出口 `readRefreshFailure`,但它生产面零消费方:
 * 成因算出来了,人看不见,四个不同的处置动作被压成同一句"请重新登录"。
 * 本票把那句改成**由封闭原因码单向投影**的唯一出口 `missingTokenHint`。
 *
 * 断言的组织方式就是任务书那五格:
 *  ① `auth` 保持现状文案(重登是对的);
 *  ② `network` / ③ `timeout` 明说"稍后重试即可,不需要重新登录"(现状这句在误导人);
 *  ④ `cancelled` 明说"已被取消",不得与失败混写;
 *  ⑤ 取不到成因 ⇒ 与现状**逐字**相同,不得伪造成因。
 * 外加一条变异对照(把 network 落回"请重新登录"必红)与一条"判据只有一份"的结构锁。
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hintForRefreshFailure,
  missingTokenHint,
  NO_TOKEN_HINT,
} from '../src/commands/token-manager.js';
import {
  LEDGER_FAILURE_CODES,
  InflightLedger,
  LedgerFailure,
} from '../src/util/inflight-ledger.js';

/**
 * 改造前 40 个调用点逐字相同的那句话。这里把它**抄死在测试里**而不是 import 常量:
 * ⑤ 要证明的是"无成因时输出与现状完全一致",引用被审对象自己的常量就等于同义反复。
 */
const LEGACY_TEXT_BEFORE_THIS_TICKET = '✗ 未登录或 token 已失效,请运行: ihui login';

function failureOf(code: (typeof LEDGER_FAILURE_CODES)[number]): LedgerFailure {
  return new LedgerFailure(code, `测试用:${code}`);
}

describe('token 续期失败成因到人(成因 → 文案的唯一投影)', () => {
  it('① auth ⇒ 保持现状"请重新登录"文案', () => {
    expect(hintForRefreshFailure(failureOf('auth'))).toBe(LEGACY_TEXT_BEFORE_THIS_TICKET);
  });

  it('② network ⇒ 明说是网络/超时、稍后重试即可,并明写"不需要重新登录"', () => {
    const text = hintForRefreshFailure(failureOf('network'));
    expect(text).toContain('网络/超时');
    expect(text).toContain('不需要重新登录');
    expect(text).not.toBe(LEGACY_TEXT_BEFORE_THIS_TICKET);
  });

  it('③ timeout ⇒ 与 network 同一处置档(都是"重试即可",不是重登)', () => {
    expect(hintForRefreshFailure(failureOf('timeout'))).toBe(
      hintForRefreshFailure(failureOf('network')),
    );
    expect(hintForRefreshFailure(failureOf('timeout'))).toContain('不需要重新登录');
  });

  it('④ cancelled ⇒ 明说"已被取消",且不得与失败混写成同一句', () => {
    const cancelled = hintForRefreshFailure(failureOf('cancelled'));
    expect(cancelled).toContain('取消');
    for (const other of ['network', 'timeout', 'auth'] as const) {
      expect(cancelled).not.toBe(hintForRefreshFailure(failureOf(other)));
    }
  });

  it('⑤ 台账无记录 ⇒ 与改造前逐字相同,绝不伪造成因', () => {
    expect(hintForRefreshFailure(null)).toBe(LEGACY_TEXT_BEFORE_THIS_TICKET);
    // 只读出口在空台账上必须给 null(而不是凭空造一个原因码),否则上面那条断言就空心了
    const emptyLedger = new InflightLedger<string>();
    expect(missingTokenHint('http://localhost:8802', emptyLedger)).toBe(
      LEGACY_TEXT_BEFORE_THIS_TICKET,
    );
  });

  it('⑥ 封闭集每一档都有专属文案(表漏档 ⇒ 返回 undefined,这里判死)', () => {
    for (const code of LEDGER_FAILURE_CODES) {
      const text = hintForRefreshFailure(failureOf(code));
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
    // 原因码若被扩到 5 档而表没跟上,Record<LedgerFailureCode,…> 在 tsc 就红了;
    // 这条断言把同一件事在运行时也钉住,防止只靠类型层。
    expect(LEDGER_FAILURE_CODES).toEqual(['network', 'auth', 'timeout', 'cancelled']);
  });

  it('⑦ 判据只有一份:调用点不许再写旧字面量,也不许用 message 文本猜成因', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const commandsDir = path.resolve(here, '../src/commands');
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.ts'));
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(commandsDir, f), 'utf8');
      // 投影出口的本家(token-manager.ts)当然持有那张表,不参与"调用点"的约束
      if (f === 'token-manager.ts') continue;
      if (src.includes(LEGACY_TEXT_BEFORE_THIS_TICKET)) offenders.push(`${f}: 仍写死旧文案`);
      if (/message\.includes\(/.test(src)) offenders.push(`${f}: 用 message 文本猜成因`);
      // 出现了 missingTokenHint 就必须是"未登录"分支唯一的那一处判据来源
      if (src.includes('missingTokenHint') && !src.includes("from './token-manager.js'")) {
        offenders.push(`${f}: 用了出口却没从 token-manager 导入(悬空引用)`);
      }
    }
    expect(offenders).toEqual([]);
    // 反向锁:本家确实导出了这份唯一文案,否则上面全绿只是因为没人用
    expect(NO_TOKEN_HINT).toBe(LEGACY_TEXT_BEFORE_THIS_TICKET);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
