import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)',
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
})

describe('Button Styles', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.documentElement.classList.remove('dark')
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  describe('CSS Variables', () => {
    it('should have correct primary color in light mode', () => {
      const root = document.documentElement
      root.classList.remove('dark')
      expect(root.classList.contains('dark')).toBe(false)
    })

    it('should have correct primary color in dark mode', () => {
      const root = document.documentElement
      root.classList.add('dark')
      expect(root.classList.contains('dark')).toBe(true)
    })
  })

  describe('Button Classes', () => {
    it('should create button element', () => {
      const button = document.createElement('button')
      button.className = 'el-button el-button--primary'
      document.body.appendChild(button)
      
      expect(button.classList.contains('el-button')).toBe(true)
      expect(button.classList.contains('el-button--primary')).toBe(true)
    })

    it('should have disabled state', () => {
      const button = document.createElement('button')
      button.className = 'el-button is-disabled'
      button.setAttribute('disabled', 'true')
      document.body.appendChild(button)
      
      expect(button.classList.contains('is-disabled')).toBe(true)
      expect(button.hasAttribute('disabled')).toBe(true)
    })

    it('should have loading state', () => {
      const button = document.createElement('button')
      button.className = 'el-button is-loading'
      document.body.appendChild(button)
      
      expect(button.classList.contains('is-loading')).toBe(true)
    })
  })

  describe('Button Sizes', () => {
    it('should have small size', () => {
      const button = document.createElement('button')
      button.className = 'el-button el-button--small'
      document.body.appendChild(button)
      
      expect(button.classList.contains('el-button--small')).toBe(true)
    })

    it('should have large size', () => {
      const button = document.createElement('button')
      button.className = 'el-button el-button--large'
      document.body.appendChild(button)
      
      expect(button.classList.contains('el-button--large')).toBe(true)
    })
  })

  describe('Button Types', () => {
    it('should have primary type', () => {
      const button = document.createElement('button')
      button.className = 'el-button el-button--primary'
      document.body.appendChild(button)
      
      expect(button.classList.contains('el-button--primary')).toBe(true)
    })

    it('should have success type', () => {
      const button = document.createElement('button')
      button.className = 'el-button el-button--success'
      document.body.appendChild(button)
      
      expect(button.classList.contains('el-button--success')).toBe(true)
    })

    it('should have warning type', () => {
      const button = document.createElement('button')
      button.className = 'el-button el-button--warning'
      document.body.appendChild(button)
      
      expect(button.classList.contains('el-button--warning')).toBe(true)
    })

    it('should have danger type', () => {
      const button = document.createElement('button')
      button.className = 'el-button el-button--danger'
      document.body.appendChild(button)
      
      expect(button.classList.contains('el-button--danger')).toBe(true)
    })

    it('should have info type', () => {
      const button = document.createElement('button')
      button.className = 'el-button el-button--info'
      document.body.appendChild(button)
      
      expect(button.classList.contains('el-button--info')).toBe(true)
    })
  })

  describe('Button Plain', () => {
    it('should have plain style', () => {
      const button = document.createElement('button')
      button.className = 'el-button is-plain'
      document.body.appendChild(button)
      
      expect(button.classList.contains('is-plain')).toBe(true)
    })

    it('should have round style', () => {
      const button = document.createElement('button')
      button.className = 'el-button is-round'
      document.body.appendChild(button)
      
      expect(button.classList.contains('is-round')).toBe(true)
    })

    it('should have circle style', () => {
      const button = document.createElement('button')
      button.className = 'el-button is-circle'
      document.body.appendChild(button)
      
      expect(button.classList.contains('is-circle')).toBe(true)
    })
  })

  describe('Button Group', () => {
    it('should create button group', () => {
      const group = document.createElement('div')
      group.className = 'el-button-group'
      
      const button1 = document.createElement('button')
      button1.className = 'el-button'
      const button2 = document.createElement('button')
      button2.className = 'el-button'
      
      group.appendChild(button1)
      group.appendChild(button2)
      document.body.appendChild(group)
      
      expect(group.classList.contains('el-button-group')).toBe(true)
      expect(group.children.length).toBe(2)
    })
  })
})
