// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import router from '../index'

describe('router', () => {
  it('默认导出存在且是对象', () => {
    expect(router).toBeDefined()
    expect(typeof router).toBe('object')
    expect(router).not.toBeNull()
  })

  it('router 有 push, replace, go 方法', () => {
    expect(typeof router.push).toBe('function')
    expect(typeof router.replace).toBe('function')
    expect(typeof router.go).toBe('function')
  })

  it('router 有 back, forward 方法', () => {
    expect(typeof router.back).toBe('function')
    expect(typeof router.forward).toBe('function')
  })

  it('router 是 vue-router 创建的实例', () => {
    // vue-router 实例特征: install 方法 + options.routes + currentRoute
    expect(typeof router.install).toBe('function')
    expect(router.options).toBeDefined()
    expect(Array.isArray(router.options.routes)).toBe(true)
    expect(router.currentRoute).toBeDefined()
  })

  it('router 包含配置的路由表', () => {
    const routes = router.options.routes
    expect(routes.length).toBeGreaterThan(0)
    const rootRoute = routes.find(r => r.path === '/')
    expect(rootRoute).toBeDefined()
    expect(rootRoute?.redirect).toBe('/admin')
  })
})
