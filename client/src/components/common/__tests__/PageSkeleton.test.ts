import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageSkeleton from '../PageSkeleton.vue'

describe('PageSkeleton', () => {
  describe('基础渲染', () => {
    it('应该正确渲染页面骨架屏', () => {
      const wrapper = mount(PageSkeleton)

      expect(wrapper.find('.page-skeleton').exists()).toBe(true)
    })

    it('应该渲染列表类型骨架', () => {
      const wrapper = mount(PageSkeleton, {
        props: { type: 'list' },
      })

      expect(wrapper.find('.list-skeleton-item').exists()).toBe(true)
    })

    it('应该渲染卡片类型骨架', () => {
      const wrapper = mount(PageSkeleton, {
        props: { type: 'card' },
      })

      expect(wrapper.find('.card-skeleton-grid').exists()).toBe(true)
    })

    it('应该渲染详情类型骨架', () => {
      const wrapper = mount(PageSkeleton, {
        props: { type: 'detail' },
      })

      expect(wrapper.find('.detail-skeleton').exists()).toBe(true)
    })
  })

  describe('Props', () => {
    it('应该接受loading prop', () => {
      const wrapper = mount(PageSkeleton, {
        props: { loading: true },
      })

      expect(wrapper.props('loading')).toBe(true)
    })

    it('应该接受type prop', () => {
      const wrapper = mount(PageSkeleton, {
        props: { type: 'card' },
      })

      expect(wrapper.props('type')).toBe('card')
    })

    it('应该接受count prop', () => {
      const wrapper = mount(PageSkeleton, {
        props: { count: 5 },
      })

      expect(wrapper.props('count')).toBe(5)
    })

    it('应该有默认props', () => {
      const wrapper = mount(PageSkeleton)

      expect(wrapper.props('loading')).toBe(true)
      expect(wrapper.props('type')).toBe('list')
      expect(wrapper.props('count')).toBe(3)
    })
  })

  describe('条件渲染', () => {
    it('当loading为false时应该渲染slot内容', () => {
      const wrapper = mount(PageSkeleton, {
        props: { loading: false },
        slots: {
          default: '<div class="content">实际内容</div>',
        },
      })

      expect(wrapper.find('.content').exists()).toBe(true)
      expect(wrapper.find('.page-skeleton').exists()).toBe(false)
    })

    it('当loading为true时应该渲染骨架屏', () => {
      const wrapper = mount(PageSkeleton, {
        props: { loading: true },
        slots: {
          default: '<div class="content">实际内容</div>',
        },
      })

      expect(wrapper.find('.page-skeleton').exists()).toBe(true)
      expect(wrapper.find('.content').exists()).toBe(false)
    })
  })

  describe('数量配置', () => {
    it('应该根据count prop渲染正确数量的列表项', () => {
      const wrapper = mount(PageSkeleton, {
        props: { type: 'list', count: 5 },
      })

      const items = wrapper.findAll('.list-skeleton-item')
      expect(items.length).toBe(5)
    })
  })
})
