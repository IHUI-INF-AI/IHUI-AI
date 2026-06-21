import type { Directive, DirectiveBinding, App } from 'vue'

interface LazyLoadOptions {
  threshold?: number
  rootMargin?: string
  placeholder?: string
}

const defaultOptions: LazyLoadOptions = {
  threshold: 0.1,
  rootMargin: '50px',
  placeholder: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlZWVlZWUiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2NjY2NjYyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
}

const observerMap = new WeakMap<Element, IntersectionObserver>()
const bgObserverMap = new WeakMap<HTMLElement, IntersectionObserver>()

function createObserver(options: LazyLoadOptions): IntersectionObserver {
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLImageElement
          const src = el.dataset.lazySrc
          if (src) {
            el.src = src
            el.removeAttribute('data-lazy-src')
            el.classList.add('lazy-loaded')
            el.classList.remove('lazy-loading')
          }
          const observer = observerMap.get(el)
          if (observer) {
            observer.unobserve(el)
            observerMap.delete(el)
          }
        }
      })
    },
    {
      threshold: options.threshold,
      rootMargin: options.rootMargin,
    }
  )
}

function getOptions(value: any): LazyLoadOptions {
  if (typeof value === 'string') {
    return { ...defaultOptions, placeholder: value }
  }
  if (typeof value === 'object' && value !== null) {
    return { ...defaultOptions, ...value as LazyLoadOptions }
  }
  return { ...defaultOptions }
}

export const vLazyLoad: Directive = {
  mounted(el: Element, binding: DirectiveBinding) {
    const imgEl = el as HTMLImageElement
    const options = getOptions(binding.value)

    const src = imgEl.src
    if (!src || src === '') {
      imgEl.src = options.placeholder || defaultOptions.placeholder!
    }

    imgEl.dataset.lazySrc = src
    imgEl.src = options.placeholder || defaultOptions.placeholder!
    imgEl.classList.add('lazy-loading')

    const observer = createObserver(options)
    observer.observe(el)
    observerMap.set(el, observer)
  },

  updated(el: Element, binding: DirectiveBinding) {
    const imgEl = el as HTMLImageElement
    const options = getOptions(binding.value)
    const newSrc = options.placeholder
    if (newSrc && imgEl.dataset.lazySrc !== newSrc) {
      imgEl.dataset.lazySrc = newSrc
    }
  },

  unmounted(el: Element) {
    const observer = observerMap.get(el)
    if (observer) {
      observer.unobserve(el)
      observerMap.delete(el)
    }
  },
}

export const vLazyBackground: Directive = {
  mounted(el: Element, binding: DirectiveBinding) {
    const src = binding.value as string | undefined
    if (!src) return

    const htmlEl = el as HTMLElement
    htmlEl.dataset.lazyBg = src
    htmlEl.classList.add('lazy-bg-loading')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement
            const bgSrc = target.dataset.lazyBg
            if (bgSrc) {
              target.style.backgroundImage = `url(${bgSrc})`
              target.removeAttribute('data-lazy-bg')
              target.classList.add('lazy-bg-loaded')
              target.classList.remove('lazy-bg-loading')
            }
            observer.unobserve(target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '50px' }
    )

    observer.observe(el)
    bgObserverMap.set(htmlEl, observer)
  },

  unmounted(el: Element) {
    const htmlEl = el as HTMLElement
    const observer = bgObserverMap.get(htmlEl)
    if (observer) {
      observer.disconnect()
      bgObserverMap.delete(htmlEl)
    }
  },
}

export default {
  install(app: App) {
    app.directive('lazy-load', vLazyLoad)
    app.directive('lazy-bg', vLazyBackground)
  },
}
