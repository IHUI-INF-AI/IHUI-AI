import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageSkeleton from '@/components/common/PageSkeleton.vue'

describe('PageSkeleton', () => {
  it('renders when loading is true', () => {
    const wrapper = mount(PageSkeleton, {
      props: {
        loading: true,
      },
    })

    expect(wrapper.find('.page-skeleton').exists()).toBe(true)
  })

  it('does not render when loading is false', () => {
    const wrapper = mount(PageSkeleton, {
      props: {
        loading: false,
      },
      slots: {
        default: '<div class="content">Actual Content</div>',
      },
    })

    expect(wrapper.find('.page-skeleton').exists()).toBe(false)
    expect(wrapper.find('.content').exists()).toBe(true)
  })

  it('renders list type skeleton by default', () => {
    const wrapper = mount(PageSkeleton, {
      props: {
        loading: true,
        type: 'list',
        count: 3,
      },
    })

    const listItems = wrapper.findAll('.list-skeleton-item')
    expect(listItems.length).toBe(3)
  })

  it('renders card type skeleton', () => {
    const wrapper = mount(PageSkeleton, {
      props: {
        loading: true,
        type: 'card',
        count: 4,
      },
    })

    expect(wrapper.find('.card-skeleton-grid').exists()).toBe(true)
  })

  it('renders detail type skeleton', () => {
    const wrapper = mount(PageSkeleton, {
      props: {
        loading: true,
        type: 'detail',
      },
    })

    expect(wrapper.find('.detail-skeleton').exists()).toBe(true)
    expect(wrapper.find('.detail-skeleton-content').exists()).toBe(true)
  })

  it('renders table type skeleton', () => {
    const wrapper = mount(PageSkeleton, {
      props: {
        loading: true,
        type: 'table',
        count: 5,
      },
    })

    expect(wrapper.find('.table-skeleton').exists()).toBe(true)
    expect(wrapper.find('.table-skeleton-header').exists()).toBe(true)
    const rows = wrapper.findAll('.table-skeleton-row')
    expect(rows.length).toBe(5)
  })

  it('renders correct number of list items based on count prop', () => {
    const count = 7
    const wrapper = mount(PageSkeleton, {
      props: {
        loading: true,
        type: 'list',
        count,
      },
    })

    const listItems = wrapper.findAll('.list-skeleton-item')
    expect(listItems.length).toBe(count)
  })

  it('renders slot content when not loading', () => {
    const wrapper = mount(PageSkeleton, {
      props: {
        loading: false,
      },
      slots: {
        default: '<div class="custom-content">Loaded Content</div>',
      },
    })

    expect(wrapper.find('.custom-content').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loaded Content')
  })

  it('applies default props correctly', () => {
    const wrapper = mount(PageSkeleton, {
      props: {},
    })

    expect(wrapper.find('.page-skeleton').exists()).toBe(true)
    const listItems = wrapper.findAll('.list-skeleton-item')
    expect(listItems.length).toBe(3)
  })
})
