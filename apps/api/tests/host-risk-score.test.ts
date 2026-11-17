// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机风险启发式(2026-11-17)。
 *
 * 钉住三件事:
 * ① 权重是可回读规则,不是黑箱:同样两维命中必须得到同一个分数;
 * ② 取不到的维度进 undetermined,绝不默认算 0 分(那会把"没判"说成"安全");
 * ③ 必须有 disclaimer —— 本仓没有官方风控桥,不能让别人把这张分当成"已被标记/不会被标记"。
 */
import { describe, expect, it } from 'vitest'
import { scoreHostRisk } from '../src/services/host-diagnostics.js'

describe('本机风险启发式', () => {
  it('R1 实体机且无异常特征 ⇒ 0 分 low', () => {
    const r = scoreHostRisk({
      hypervisor: false,
      container: false,
      wsl: false,
      cpuModel: 'Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz',
      osManufacturer: 'ASUS',
      vbs: false,
      hvci: false,
    })
    expect(r.score).toBe(0)
    expect(r.level).toBe('low')
    expect(r.undetermined).toEqual([])
  })

  it('R2 虚拟机 + 容器 ⇒ 45 分 medium', () => {
    const r = scoreHostRisk({
      hypervisor: true,
      container: true,
      wsl: false,
      cpuModel: 'Intel Core Processor (Broadwell)',
    })
    expect(r.score).toBe(45)
    expect(r.level).toBe('medium')
  })

  it('R3 虚拟化全命中(QEMU 型号)⇒ 65 分 high', () => {
    const r = scoreHostRisk({
      hypervisor: true,
      container: true,
      wsl: true,
      cpuModel: 'QEMU Virtual CPU version 2.5+',
    })
    expect(r.score).toBe(65)
    expect(r.level).toBe('high')
    expect(r.hits.map((h) => h.key)).toContain('virt-cpu-model')
  })

  it('R4 VBS/HVCI 开启抵扣分数(不互斥)', () => {
    const r = scoreHostRisk({
      hypervisor: true,
      container: true,
      wsl: false,
      cpuModel: 'Virtual CPU',
      vbs: true,
      hvci: true,
    })
    expect(r.score).toBe(25 + 20 + 10 - 10 - 5)
  })

  it('R5 全部取不到 ⇒ 0 分但逐维进 undetermined,且带声明', () => {
    const r = scoreHostRisk({
      hypervisor: null,
      container: null,
      wsl: null,
      cpuModel: 'unknown',
    })
    expect(r.score).toBe(0)
    expect(r.undetermined).toEqual(
      expect.arrayContaining(['hypervisor', 'container', 'wsl', 'vbs', 'hvci', 'osManufacturer']),
    )
    expect(r.disclaimer).toContain('不是上游官方风控评分')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
