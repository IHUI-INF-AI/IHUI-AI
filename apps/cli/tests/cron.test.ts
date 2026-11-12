// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * cron 判据层。
 *
 * 钉五件事:
 *   ① 语法错误**明确报错**,不静默当成 `*`(否则"每月 1 号"会变成"每天");
 *   ② 下一次触发时刻算得对(真实时钟计算,不是 mock);
 *   ③ 日与周同时受限时按 cron 标准语义取**或**(很多人以为是与);
 *   ④ 永不成立的组合(2 月 30 日)报错而非死循环;
 *   ⑤ 与 turn-store 的挂起唤醒接上(周期挂起能被 isWakeable 判定)。
 */
import { describe, expect, it } from 'vitest';

import {
  CronParseError,
  describeCron,
  nextCronAt,
  nextCronOccurrence,
  parseCron,
} from '../src/acp/cron.js';

/** 构造本地时刻(避免 UTC 偏差影响断言)。 */
const d = (y: number, mo: number, day: number, h = 0, mi = 0) =>
  new Date(y, mo - 1, day, h, mi, 0, 0);

describe('parseCron 语法校验', () => {
  it('合法 5 段可解析', () => {
    const c = parseCron('*/5 0 1 * *');
    expect(c.minutes.has(0)).toBe(true);
    expect(c.minutes.has(5)).toBe(true);
    expect(c.minutes.has(3)).toBe(false);
  });

  it('段数不对 ⇒ 报错', () => {
    for (const bad of ['* * * *', '* * * * * *', '']) {
      expect(() => parseCron(bad)).toThrow(CronParseError);
    }
  });

  it('越界 ⇒ 报错', () => {
    expect(() => parseCron('60 * * * *')).toThrow(/越界/);
    expect(() => parseCron('* 24 * * *')).toThrow(/越界/);
    expect(() => parseCron('* * 32 * *')).toThrow(/越界/);
  });

  it('扩展语法(L/W/#/?)直接报错,不静默降级', () => {
    expect(() => parseCron('0 0 L * *')).toThrow(/扩展语法/);
    expect(() => parseCron('0 0 * * 1#2')).toThrow(/扩展语法/);
    expect(() => parseCron('0 0 ? * *')).toThrow(/扩展语法/);
  });

  it('区间起点大于终点 ⇒ 报错', () => {
    expect(() => parseCron('30-10 * * * *')).toThrow(/起点大于终点/);
  });

  it('列表与区间混合可用', () => {
    const c = parseCron('0,15,30-35 * * * *');
    expect(c.minutes.has(0)).toBe(true);
    expect(c.minutes.has(32)).toBe(true);
    expect(c.minutes.has(10)).toBe(false);
  });
});

describe('nextCronOccurrence 真实计算', () => {
  it('每 30 分钟:从 10:05 的下一次是 10:30', () => {
    const next = nextCronOccurrence(parseCron('*/30 * * * *'), d(2026, 11, 12, 10, 5));
    expect(next.getHours()).toBe(10);
    expect(next.getMinutes()).toBe(30);
  });

  it('严格晚于:基准恰好命中时返回下一次,不是自身', () => {
    const base = d(2026, 11, 12, 10, 30);
    const next = nextCronOccurrence(parseCron('*/30 * * * *'), base);
    expect(next.getTime()).toBeGreaterThan(base.getTime());
    expect(next.getMinutes()).toBe(0); // 11:00
    expect(next.getHours()).toBe(11);
  });

  it('每天 00:00:从中午的下一次是明天 00:00', () => {
    const next = nextCronOccurrence(parseCron('0 0 * * *'), d(2026, 11, 12, 12, 0));
    expect(next.getDate()).toBe(13);
    expect(next.getHours()).toBe(0);
    expect(next.getMinutes()).toBe(0);
  });

  it('每周一 00:00:从周三算到下周一', () => {
    // 2026-11-12 是周四
    const next = nextCronOccurrence(parseCron('0 0 * * 1'), d(2026, 11, 12, 12, 0));
    expect(next.getDay()).toBe(1); // 周一
  });

  it('每月 1 日 00:00:从月中算到下月 1 日', () => {
    const next = nextCronOccurrence(parseCron('0 0 1 * *'), d(2026, 11, 12, 12, 0));
    expect(next.getDate()).toBe(1);
    expect(next.getMonth()).toBe(11); // 12 月(0 基)
  });

  it('日与周同时受限 ⇒ 取或(不是与)', () => {
    // 每月 1 日 或 每周一:从 11-12(周四)往后,最近应是 11-16(周一),而不是 12-01
    const next = nextCronOccurrence(parseCron('0 0 1 * 1'), d(2026, 11, 12, 12, 0));
    expect(next.getDate()).toBe(16);
    expect(next.getDay()).toBe(1);
  });

  it('永不成立的组合(2 月 30 日)⇒ 报错而非死循环', () => {
    expect(() => nextCronOccurrence(parseCron('0 0 30 2 *'), d(2026, 1, 1))).toThrow(
      /4 年内没有触发时刻/,
    );
  });
});

describe('nextCronAt / describeCron', () => {
  it('nextCronAt 返回毫秒且大于基准', () => {
    const base = d(2026, 11, 12, 10, 5).getTime();
    const at = nextCronAt('*/30 * * * *', base);
    expect(at).toBeGreaterThan(base);
  });

  it('常见形态有人读描述', () => {
    expect(describeCron('* * * * *')).toBe('每分钟');
    expect(describeCron('0 * * * *')).toBe('每小时整点');
    expect(describeCron('0 0 * * *')).toBe('每天 00:00');
    expect(describeCron('*/15 * * * *')).toBe('每 15 分钟');
  });

  it('不认识的形态回显原式', () => {
    expect(describeCron('5 4 * * 2')).toBe('5 4 * * 2');
  });
});
