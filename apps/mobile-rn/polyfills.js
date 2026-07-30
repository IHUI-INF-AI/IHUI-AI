// 2026-07-29 修复:React Native 0.79 的 RendererProxy 源码顶层访问
// window.__REACT_DEVTOOLS_GLOBAL_HOOK__(无 typeof 守卫),Hermes 引擎下 window 未定义
// 导致 ReferenceError。RN 社区标准 polyfill:global.window = global。
// 注意:仅定义 window(指向 global),不定义 self/process(会导致 JNI NULL field error)。
if (typeof global.window === 'undefined') {
  global.window = global
}

// 2026-07-29 修复:react-native-css-interop@0.2.6 的 doctor.js / web/color-scheme.js /
// web/rem.js / web/stylesheet.js 在模块顶层访问 globalThis.window.document 和
// globalThis.window.getComputedStyle。polyfill 的 global.window = global 让这些守卫
// (`globalThis.window ? ... : ...`)走 truthy 分支,但 window.document 为 undefined,
// 导致 "Cannot read properties of undefined (reading 'documentElement')" 崩溃。
// 补齐最小 DOM stub,让 css-interop 的 web 文件被错误加载时也能安全返回。
// 正常路径下 Metro 平台解析会加载 .native.js 变体(无 window 访问),stub 不会被触发;
// stub 仅作为 fallback 兜底(pnpm junction 异常导致 Metro 默认解析失败时)。
if (typeof global.document === 'undefined') {
  const _classList = {
    contains: function () {
      return false
    },
    add: function () {},
    remove: function () {},
    toggle: function () {
      return false
    },
  }
  global.document = {
    documentElement: {
      classList: _classList,
      style: {},
    },
    head: { appendChild: function () {} },
    body: { appendChild: function () {} },
    getElementsByTagName: function () {
      return [{ appendChild: function () {} }]
    },
    createElement: function () {
      return {
        style: {},
        setAttribute: function () {},
        appendChild: function () {},
        classList: _classList,
      }
    },
    querySelector: function () {
      return null
    },
    querySelectorAll: function () {
      return []
    },
    addEventListener: function () {},
    removeEventListener: function () {},
  }
}
if (typeof global.window.getComputedStyle === 'undefined') {
  global.window.getComputedStyle = function () {
    return {
      getPropertyValue: function () {
        return ''
      },
      fontSize: '16px',
    }
  }
}
if (typeof global.window.matchMedia === 'undefined') {
  global.window.matchMedia = function () {
    return { matches: false, addEventListener: function () {}, removeEventListener: function () {} }
  }
}

// 2026-07-29 修复:RN 0.79 Hermes 引擎下 performance 全局对象未定义,
// 导致 performance.now() 调用报 "Cannot read property 'now' of undefined"。
// 用 Date.now() 提供毫秒级时间戳(足够 RN 运行时使用)。
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: function () {
      return Date.now()
    },
  }
}

// 某些模块在 RN InitializeCore 之前顶层访问 FormData 等 Web API,
// 导致 ReferenceError。提供空构造函数占位,InitializeCore 运行后会被覆盖。
if (typeof global.FormData === 'undefined') {
  global.FormData = function FormData() {
    this._data = {}
    this.append = function (k, v) {
      this._data[k] = v
    }
    this.get = function (k) {
      return this._data[k]
    }
  }
}
if (typeof global.XMLHttpRequest === 'undefined') {
  global.XMLHttpRequest = function XMLHttpRequest() {}
}
if (typeof global.Blob === 'undefined') {
  global.Blob = function Blob() {}
}
if (typeof global.File === 'undefined') {
  global.File = function File() {}
}
if (typeof global.FileReader === 'undefined') {
  global.FileReader = function FileReader() {}
}
if (typeof global.URLSearchParams === 'undefined') {
  global.URLSearchParams = function URLSearchParams() {
    this.get = function () {
      return null
    }
    this.toString = function () {
      return ''
    }
  }
}
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = function (fn, ...args) {
    return setTimeout(() => fn(...args), 0)
  }
  global.clearImmediate = function (id) {
    clearTimeout(id)
  }
}
