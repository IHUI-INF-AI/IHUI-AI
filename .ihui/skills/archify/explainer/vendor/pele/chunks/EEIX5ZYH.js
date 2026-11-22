import { a as F, d as L, f as ct, g as K } from './GUJTEFZK.js'
import { b as G, c as z, d as J, k as Z, m as ht, n as ut, o as B } from './IZOKQ2GT.js'
import { a as V, c as H, g as ft } from './XTDUIGUI.js'
function $(c) {
  const e = c.trim()
  return e.length >= 2 && e.startsWith('"') && e.endsWith('"') ? e.slice(1, -1) : e
}
function Q(c) {
  return c.map($).sort()
}
const U = class {
  type = 'venn'
  title
  subsets = []
  textNodes = []
  styles = []
  known = new Set()
  current
  indent = !1
  setDiagramTitle(e) {
    this.title = e
  }
  addSubsetData(e, a, t) {
    const n = Q(e)
    ;((this.current = n),
      n.length === 1 && this.known.add(n[0]),
      this.subsets.push({ sets: n, size: t ?? 10 / e.length ** 2, label: a ? $(a) : void 0 }))
  }
  addTextData(e, a, t) {
    this.textNodes.push({ sets: Q(e), id: $(a), label: t ? $(t) : void 0 })
  }
  addStyleData(e, a) {
    const t = new Map()
    for (const [n, s] of a) t.set(n, s && $(s))
    this.styles.push({ targets: Q(e), styles: t })
  }
  validateUnionIdentifiers(e) {
    const a = e.map($).filter((t) => !this.known.has(t))
    if (a.length > 0)
      throw new V(`unknown set identifier: ${a.join(', ')}`, 'semantic', { type: 'venn' })
  }
  getCurrentSets() {
    return this.current
  }
  getIndentMode() {
    return this.indent
  }
  setIndentMode(e) {
    this.indent = e
  }
}
const tt = [
    '$end',
    'INVALID',
    'EOF',
    'NEWLINE',
    'VENN',
    'TITLE',
    'SET',
    'UNION',
    'TEXT',
    'INDENT_TEXT',
    'STYLE',
    'BRACKET_LABEL',
    'NUMERIC',
    'HEXCOLOR',
    'RGBCOLOR',
    'RGBACOLOR',
    'IDENTIFIER',
    'STRING',
    'COMMA',
    'COLON',
  ],
  xt = [
    ['venn-beta', 4],
    ['set', 6],
    ['union', 7],
    ['text', 8],
    ['style', 10],
  ],
  _ = class {
    constructor(e, a) {
      this.src = e
      this.host = a
    }
    src
    host
    text = ''
    start = 0
    at = 0
    lineStart = !1
    ended = !1
    word(e, a) {
      const t = this.src
      for (let n = 0; n < a.length; n++) {
        const s = t.charCodeAt(e + n),
          r = a.charCodeAt(n)
        if (s !== r && (s + 32 !== r || s < 65 || s > 90)) return !1
      }
      return !0
    }
    keyword(e, a) {
      return this.word(e, a) && !K(this.src.charCodeAt(e + a.length))
    }
    color(e, a) {
      let t = this.src,
        n = e + 1
      for (let s = 0; s < a; s++) {
        for (; F(t.charCodeAt(n));) n++
        const r = n
        for (; L(t.charCodeAt(n)) || t.charCodeAt(n) === 46;) n++
        if (n === r) return -1
        for (; F(t.charCodeAt(n));) n++
        if (t.charCodeAt(n) !== (s === a - 1 ? 41 : 44)) return -1
        n++
      }
      return n
    }
    lineEnd(e) {
      const a = this.src.indexOf(
        `
`,
        e,
      )
      return a === -1 ? this.src.length : a
    }
    next() {
      const e = this.src,
        a = e.length
      for (;;) {
        let t = this.at
        if (((this.start = t), (this.text = ''), t >= a))
          return this.ended ? 0 : ((this.ended = !0), 2)
        const n = e.charCodeAt(t)
        if (
          (n === 37 && e.charCodeAt(t + 1) === 37 && e.charCodeAt(t + 2) !== 123) ||
          (n !== 125 && e.charCodeAt(t + 1) === 37 && e.charCodeAt(t + 2) === 37)
        ) {
          this.at = this.lineEnd(t + 2)
          continue
        }
        if (this.lineStart) {
          if (n === 32 || n === 9) {
            let s = t + 1
            for (; e.charCodeAt(s) === 32 || e.charCodeAt(s) === 9;) s++
            if (((this.at = s), this.keyword(s, 'text') && this.host.getIndentMode()))
              return ((this.at = s + 4), (this.lineStart = !1), (this.text = e.slice(t, s)), 9)
            continue
          }
          n !== 10 && n !== 13 && (this.host.setIndentMode(!1), (this.lineStart = !1))
        }
        if (n === 10 || n === 13) {
          for (t++; e.charCodeAt(t) === 10 || e.charCodeAt(t) === 13;) t++
          return ((this.lineStart = !0), this.token(3, t))
        }
        if (n === 37 && e.charCodeAt(t + 1) === 37) {
          this.at = this.lineEnd(t)
          continue
        }
        if (n === 32 || n === 9) {
          for (t++; e.charCodeAt(t) === 32 || e.charCodeAt(t) === 9;) t++
          this.at = t
          continue
        }
        if (((n | 32) >= 97 && (n | 32) <= 122) || n === 95) {
          if (this.word(t, 'title') && F(e.charCodeAt(t + 5))) {
            let s = t + 6
            for (; s < a;) {
              const r = e.charCodeAt(s)
              if (r === 35 || r === 10 || r === 59) break
              s++
            }
            if (s > t + 6) return this.token(5, s)
          }
          for (const [s, r] of xt) if (this.keyword(t, s)) return this.token(r, t + s.length)
          if (this.word(t, 'rgb')) {
            const s = (e.charCodeAt(t + 3) | 32) === 97,
              r = t + (s ? 4 : 3),
              E = e.charCodeAt(r) === 40 ? this.color(r, s ? 4 : 3) : -1
            if (E !== -1) return this.token(s ? 15 : 14, E)
          }
          for (t++; K(e.charCodeAt(t)) || e.charCodeAt(t) === 45;) t++
          return this.token(16, t)
        }
        if (n === 91) {
          if (e.charCodeAt(t + 1) === 34) {
            const r = e.indexOf('"', t + 2)
            return r === -1 || e.charCodeAt(r + 1) !== 93
              ? 1
              : ((this.at = r + 2), (this.text = e.slice(t + 2, r)), 11)
          }
          let s = t + 1
          for (; s < a && e.charCodeAt(s) !== 93 && e.charCodeAt(s) !== 34;) s++
          return s === t + 1 || e.charCodeAt(s) !== 93
            ? 1
            : ((this.at = s + 1), (this.text = e.slice(t + 1, s).trim()), 11)
        }
        if (L(n) || n === 46 || n === 43 || n === 45) {
          ;(n === 43 || n === 45) && t++
          const s = t
          for (; L(e.charCodeAt(t));) t++
          if (t > s) {
            if (e.charCodeAt(t) === 46 && L(e.charCodeAt(t + 1)))
              for (t += 2; L(e.charCodeAt(t));) t++
          } else if (e.charCodeAt(t) === 46 && L(e.charCodeAt(t + 1)))
            for (t += 2; L(e.charCodeAt(t));) t++
          else return 1
          return this.token(12, t)
        }
        if (n === 35) {
          let s = t + 1
          for (; s < t + 9 && ct(e.charCodeAt(s));) s++
          return s >= t + 4 ? this.token(13, s) : 1
        }
        if (n === 34) {
          const s = e.indexOf('"', t + 1)
          return s === -1 ? 1 : this.token(17, s + 1)
        }
        return n === 44 ? this.token(18, t + 1) : n === 58 ? this.token(19, t + 1) : 1
      }
    }
    token(e, a) {
      return ((this.text = this.src.slice(this.at, a)), (this.at = a), e)
    }
  }
const Et = "'EOF', 'NEWLINE', 'TITLE', 'SET', 'UNION', 'TEXT', 'INDENT_TEXT', 'STYLE'",
  Mt = "'NUMERIC', 'IDENTIFIER', 'STRING', 'HEXCOLOR', 'RGBCOLOR', 'RGBACOLOR'"
function dt(c, e) {
  let a = new _(c, e),
    t = -1,
    n = () => (t === -1 ? (t = a.next()) : t),
    s = (g) => {
      throw n() === 1
        ? H('venn', c, a.start, '', !0)
        : H('venn', c, a.start, `Expecting ${g}, got '${tt[t]}'`)
    },
    r = () => ((t = -1), a.text),
    E = (g) => (n() !== g && s(`'${tt[g]}'`), r()),
    o = () => (n() !== 16 && t !== 17 && s("'IDENTIFIER', 'STRING'"), r()),
    d = () => {
      const g = [o()]
      for (; n() === 18;) (r(), g.push(o()))
      return g
    },
    u = (g, h) => {
      let m = n() === 11 ? r() : void 0,
        i
      if ((n() === 19 && (r(), (i = parseFloat(E(12)))), h)) {
        if (g.length < 2)
          throw new V('union requires multiple identifiers', 'semantic', { type: 'venn' })
        e.validateUnionIdentifiers(g)
      }
      ;(e.addSubsetData(g, m, i), e.setIndentMode(!0))
    },
    p = (g) => {
      const h = n()
      h !== 16 && h !== 17 && h !== 12 && s("'NUMERIC', 'IDENTIFIER', 'STRING'")
      const m = r(),
        i = h !== 12 && n() === 11 ? r() : void 0
      e.addTextData(g(), m, i)
    },
    x = () => {
      const g = d(),
        h = []
      for (;;) {
        const m = E(16)
        E(19)
        let i
        if (n() === 17) i = r()
        else {
          const f = []
          for (; n() === 16 || (t >= 12 && t <= 15);) f.push(r())
          ;(f.length === 0 && s(Mt), (i = f.join(' ')))
        }
        if ((h.push([m, i]), n() !== 18)) break
        r()
      }
      e.addStyleData(g, h)
    }
  for (; n() === 3;) r()
  for (E(4); ;) {
    const g = n()
    if (g === 2) return
    if (((g < 3 || g > 10 || g === 4) && s(Et), r(), g === 5)) e.setDiagramTitle(a.text.slice(6))
    else if (g === 6) u([o()], !1)
    else if (g === 7) u(d(), !0)
    else if (g === 8) {
      const h = d()
      p(() => h)
    } else
      g === 9
        ? p(() => {
            const h = e.getCurrentSets()
            if (!h) throw new V('text requires set', 'semantic', { type: 'venn' })
            return h
          })
        : g === 10 && x()
  }
}
const X = Math.PI * 2
function It(c) {
  const e = new Set(),
    a = new Map()
  for (const n of c)
    (e.add(JSON.stringify([...n.sets].sort())), n.sets.length === 1 && a.set(n.sets[0], n.size))
  const t = []
  for (const n of c) {
    if (n.sets.length < 3) continue
    const s = [...n.sets].sort()
    for (let r = 0; r < s.length - 1; r++)
      for (let E = r + 1; E < s.length; E++) {
        const o = [s[r], s[E]],
          d = JSON.stringify(o)
        if (e.has(d)) continue
        e.add(d)
        const u = a.get(o[0]),
          p = a.get(o[1])
        t.push({
          sets: o,
          size: u !== void 0 && p !== void 0 ? Math.min(u, p) / 4 : 2.5,
          label: '',
        })
      }
  }
  return t.length > 0 ? [...c, ...t] : c
}
function Ct(c, e, a) {
  if (a >= c + e) return 0
  const t = Math.min(c, e)
  if (a <= Math.abs(c - e)) return Math.PI * t * t
  const n = c * c * Math.acos((a * a + c * c - e * e) / (2 * a * c)),
    s = e * e * Math.acos((a * a + e * e - c * c) / (2 * a * e)),
    r = 0.5 * Math.sqrt(Math.max((-a + c + e) * (a + c - e) * (a - c + e) * (a + c + e), 0))
  return n + s - r
}
function Rt(c, e, a) {
  let t = Math.abs(c - e),
    n = c + e
  if (!(a > 0)) return n
  if (a >= Math.PI * Math.min(c, e) ** 2) return t
  for (let s = 0; s < 48; s++) {
    const r = (t + n) / 2
    Ct(c, e, r) > a ? (t = r) : (n = r)
  }
  return (t + n) / 2
}
function gt(c, e, a, t, n, s) {
  let r = 1 / 0
  for (const E of e) {
    const o = c[E],
      d = t - o.x,
      u = n - o.y,
      p = o.r - Math.sqrt(d * d + u * u)
    if (p < r) {
      if (p < s) return p
      r = p
    }
  }
  for (const E of a) {
    const o = c[E],
      d = t - o.x,
      u = n - o.y,
      p = Math.sqrt(d * d + u * u) - o.r
    if (p < r) {
      if (p < s) return p
      r = p
    }
  }
  return r
}
function j(c, e, a) {
  let t = 0,
    n = 0,
    s = c[e[0]]
  for (const h of e) {
    const m = c[h]
    ;((t += m.x / e.length), (n += m.y / e.length), m.r < s.r && (s = m))
  }
  let r = s.r,
    E = t,
    o = n,
    d = gt(c, e, a, E, o, -1 / 0),
    u = 0,
    p = (h, m) => {
      const i = gt(c, e, a, h, m, d - r * 1e-9)
      if (!(i > d - r * 1e-9)) return !1
      const f = Math.hypot(h - t, m - n)
      return i > d + r * 1e-9 || f < u - r * 1e-9 ? ((d = i), (u = f), (E = h), (o = m), !0) : !1
    },
    x = 10
  for (let h = -x; h <= x; h++)
    for (let m = -x; m <= x; m++) m * m + h * h <= x * x && p(s.x + (m * r) / x, s.y + (h * r) / x)
  let g = r / x
  for (let h = 0; h < 40 && g > r * 1e-6; h++) {
    let m = !1
    for (let i = 0; i < 8; i++) {
      const f = (i * X) / 8
      p(E + Math.cos(f) * g, o + Math.sin(f) * g) && (m = !0)
    }
    m || (g /= 2)
  }
  return { x: E, y: o, margin: d }
}
function pt(c) {
  const e = new Map()
  for (const i of c) for (const f of i.sets) e.has(f) || e.set(f, 10)
  for (const i of c) i.sets.length === 1 && e.set(i.sets[0], i.size)
  let a = new Map(),
    t = [],
    n = 0
  for (const i of e.values()) Number.isFinite(i) && i > n && (n = i)
  n === 0 && (n = 10)
  const s = Math.sqrt(n / Math.PI)
  for (const [i, f] of e) {
    a.set(i, t.length)
    const y = Number.isFinite(f) && f > 0 ? Math.sqrt(f / Math.PI) : 0
    t.push({ id: i, x: 0, y: 0, r: Math.max(y, s * 0.3) })
  }
  const r = t.length
  if (r < 2) return t
  const E = new Map()
  for (const i of It(c)) {
    if (i.sets.length !== 2) continue
    const f = a.get(i.sets[0]),
      y = a.get(i.sets[1])
    f !== y && E.set(Math.min(f, y) * r + Math.max(f, y), i.size)
  }
  const o = new Map()
  for (const [i, f] of E) o.set(i, Rt(t[Math.floor(i / r)].r, t[i % r].r, f))
  const d = s * 0.15,
    u = (i, f) => o.get(i * r + f) ?? t[i].r + t[f].r + d
  if (r === 2) return ((t[1].x = u(0, 1)), t)
  if (r === 3) {
    let i = u(0, 1),
      f = u(0, 2),
      y = u(1, 2),
      I = c.some((N) => new Set(N.sets).size === 3)
    for (let N = 0; N < 40; N++) {
      const w = i > 0 ? (i * i + f * f - y * y) / (2 * i) : 0
      if (
        ((t[1].x = i),
        (t[2].x = Math.max(-f, Math.min(f, w))),
        (t[2].y = Math.sqrt(Math.max(f * f - w * w, 0))),
        !I || j(t, [0, 1, 2], []).margin > s * 0.12)
      )
        break
      ;((i *= 0.94), (f *= 0.94), (y *= 0.94))
    }
    return t
  }
  let p = 0
  for (const i of t) p += 2 * i.r + d
  const x = Math.min(300, Math.floor(3e6 / (r * r)))
  if (r <= 64) {
    const i = p / X
    t.forEach((f, y) => {
      const I = (y * X) / r - Math.PI / 2
      ;((f.x = Math.cos(I) * i), (f.y = Math.sin(I) * i))
    })
  } else {
    const i = Math.ceil(Math.sqrt(r)),
      f = 2 * s + d
    t.forEach((y, I) => {
      ;((y.x = (I % i) * f), (y.y = Math.floor(I / i) * f))
    })
  }
  const g = new Float64Array(r),
    h = new Float64Array(r),
    m = new Int32Array(r)
  for (let i = 0; i < x; i++) {
    ;(g.fill(0), h.fill(0), m.fill(0))
    for (let f = 0; f < r; f++)
      for (let y = f + 1; y < r; y++) {
        let I = o.get(f * r + y),
          N = t[f].r + t[y].r + d,
          w = t[y].x - t[f].x,
          O = t[y].y - t[f].y,
          S = Math.hypot(w, O)
        if (I === void 0 && S >= N) continue
        S < 1e-9 && ((w = Math.cos(f + y)), (O = Math.sin(f + y)), (S = 1))
        const k = (S - (I ?? N)) / 2 / S
        ;((g[f] += w * k), (h[f] += O * k), (g[y] -= w * k), (h[y] -= O * k), m[f]++, m[y]++)
      }
    for (let f = 0; f < r; f++) m[f] !== 0 && ((t[f].x += g[f] / m[f]), (t[f].y += h[f] / m[f]))
  }
  return t
}
function mt(c, e) {
  const a = (o) =>
    `M${e(o.x - o.r)},${e(o.y)}A${e(o.r)},${e(o.r)} 0 1 1 ${e(o.x + o.r)},${e(o.y)}A${e(o.r)},${e(o.r)} 0 1 1 ${e(o.x - o.r)},${e(o.y)}Z`
  if (c.length === 1) return a(c[0])
  const t = (o, d, u, p) => {
      for (const x of c)
        if (x !== u && x !== p && Math.hypot(o - x.x, d - x.y) > x.r * (1 + 1e-9)) return !1
      return !0
    },
    n = []
  for (let o = 0; o < c.length; o++)
    for (let d = o + 1; d < c.length; d++) {
      const u = c[o],
        p = c[d],
        x = Math.hypot(p.x - u.x, p.y - u.y)
      if (x >= u.r + p.r || x <= Math.abs(u.r - p.r) || x === 0) continue
      const g = (u.r * u.r - p.r * p.r + x * x) / (2 * x),
        h = Math.sqrt(Math.max(u.r * u.r - g * g, 0)),
        m = u.x + ((p.x - u.x) * g) / x,
        i = u.y + ((p.y - u.y) * g) / x
      for (const f of [1, -1]) {
        const y = m + (f * h * (p.y - u.y)) / x,
          I = i - (f * h * (p.x - u.x)) / x
        t(y, I, u, p) && n.push({ x: y, y: I, a: u, b: p })
      }
    }
  if (n.length < 2) {
    let o = c[0]
    for (const d of c) d.r < o.r && (o = d)
    for (const d of c)
      if (d !== o && Math.hypot(d.x - o.x, d.y - o.y) + o.r > d.r * (1 + 1e-9)) return ''
    return a(o)
  }
  let s = 0,
    r = 0
  for (const o of n) ((s += o.x / n.length), (r += o.y / n.length))
  n.sort((o, d) => Math.atan2(o.y - r, o.x - s) - Math.atan2(d.y - r, d.x - s))
  let E = ''
  for (let o = 0; o < n.length; o++) {
    const d = n[o],
      u = n[(o + 1) % n.length]
    o === 0 && (E = `M${e(d.x)},${e(d.y)}`)
    let p,
      x = 0,
      g = 1 / 0
    for (const h of [d.a, d.b]) {
      if (h !== u.a && h !== u.b) continue
      let m = Math.atan2(d.y - h.y, d.x - h.x),
        i = Math.atan2(u.y - h.y, u.x - h.x) - m
      i <= 0 && (i += X)
      const f = h.x + h.r * Math.cos(m + i / 2),
        y = h.y + h.r * Math.sin(m + i / 2),
        I = Math.hypot(f - (d.x + u.x) / 2, y - (d.y + u.y) / 2)
      I < g && ((g = I), (p = h), (x = i > Math.PI ? 1 : 0))
    }
    p === void 0
      ? (E += `L${e(u.x)},${e(u.y)}`)
      : (E += `A${e(p.r)},${e(p.r)} 0 ${x} 1 ${e(u.x)},${e(u.y)}`)
  }
  return E + 'Z'
}
const Nt = 100,
  wt = 1.6,
  yt = Z([])
function et(c) {
  return c.length === 1 ? c[0] : JSON.stringify(c)
}
function bt(c, e, a) {
  const t = a.fontSize ?? 16,
    n = Math.round(t * 0.875),
    s = Math.round(t * 0.8125),
    r = a.measurer ?? ft(a.fontFamily),
    E = a.padding ?? 8,
    o = pt(c.subsets),
    d = new Map()
  o.forEach((l, b) => d.set(l.id, b))
  const u = new Map()
  for (const { targets: l, styles: b } of c.styles) {
    let M = et(l),
      C = u.get(M)
    C || u.set(M, (C = new Map()))
    for (const [A, T] of b) C.set(A, T)
  }
  const p = (l) => {
      const b = u.get(l)
      if (!b) return yt
      const M = []
      for (const [C, A] of b) M.push(`${C}:${A}`)
      return Z(M)
    },
    x = o.map(() => [])
  for (let l = 0; l < o.length; l++)
    for (let b = l + 1; b < o.length; b++)
      Math.hypot(o[l].x - o[b].x, o[l].y - o[b].y) < o[l].r + o[b].r && (x[l].push(b), x[b].push(l))
  const g = new Map()
  for (const l of c.subsets) g.set(et(l.sets), l)
  const h = new Map()
  for (const [l, b] of g) {
    let M = [...new Set(b.sets)],
      C = M.map((v) => d.get(v)),
      A = new Set(C),
      T = C[0]
    for (const v of C) o[v].r < o[T].r && (T = v)
    let R = p(l),
      D = b.label ?? (b.sets.length === 1 ? b.sets[0] : void 0),
      at = (R.bold ? 1 : 0) | (R.italic ? 2 : 0),
      Y = j(
        o,
        C,
        x[T].filter((v) => !A.has(v)),
      )
    Y.margin < o[T].r * 0.2 && (Y = j(o, C, []))
    const lt = { sets: M, inside: C, spot: Y, lines: [], style: R }
    if (D) {
      const v = M.length === 1 ? t : n
      lt.lines.push({ id: void 0, raw: D, size: v, base: at, label: B(D, !1, r, v, 4e3, at) })
    }
    h.set(l, lt)
  }
  for (const l of c.textNodes) {
    const b = l.label ?? l.id
    h.get(et(l.sets))?.lines.push({
      id: l.id,
      raw: b,
      size: s,
      base: 0,
      label: B(b, !1, r, s, 4e3),
    })
  }
  let m = 0
  for (const l of o) l.r > m && (m = l.r)
  let i = m > 0 ? Nt / m : 1,
    f = 1
  for (const l of h.values()) {
    if (l.spot.margin <= 0) continue
    let b = 0,
      M = 0
    for (const A of l.lines) ((b = Math.max(b, A.label.width)), (M += A.label.height))
    const C = Math.hypot(b, M) / 2 + 4
    f = Math.max(f, Math.min(C / (l.spot.margin * i), wt))
  }
  i *= f
  for (const l of h.values()) {
    const b = Math.max(l.spot.margin * i * 1.8, 72)
    for (const M of l.lines) M.label.width > b && (M.label = B(M.raw, !1, r, M.size, b, M.base))
  }
  let y = 1 / 0,
    I = 1 / 0,
    N = -1 / 0,
    w = -1 / 0
  for (const l of o)
    ((y = Math.min(y, (l.x - l.r) * i)),
      (I = Math.min(I, (l.y - l.r) * i)),
      (N = Math.max(N, (l.x + l.r) * i)),
      (w = Math.max(w, (l.y + l.r) * i)))
  for (const l of h.values()) {
    let b = 0,
      M = 0
    for (const C of l.lines) ((b = Math.max(b, C.label.width)), (M += C.label.height))
    ;((y = Math.min(y, l.spot.x * i - b / 2)),
      (N = Math.max(N, l.spot.x * i + b / 2)),
      (I = Math.min(I, l.spot.y * i - M / 2)),
      (w = Math.max(w, l.spot.y * i + M / 2)))
  }
  o.length === 0 && (y = I = N = w = 0)
  let O = B(c.title && $(c.title), !1, r, t, 4e3, 1),
    S = O.height > 0 ? O.height + 12 : 0,
    k = Math.max(N - y, O.width),
    nt = E + (k - (N - y)) / 2 - y,
    st = E + S - I,
    P = Math.ceil(k + 2 * E),
    rt = Math.ceil(w - I + S + 2 * E),
    ot = o.map((l) => ({ id: l.id, x: l.x * i + nt, y: l.y * i + st, r: l.r * i })),
    it = ''
  ot.forEach((l, b) => {
    const M = ht(b),
      C = h.get(l.id)?.style ?? yt
    it += `<circle class="pele-venn-set" data-id="${G(l.id)}" cx="${z(l.x)}" cy="${z(l.y)}" r="${z(l.r)}" fill="${M}" fill-opacity="0.2" stroke="${M}"${C.shape}/>`
  })
  let q = '',
    W = ''
  for (const l of h.values()) {
    const b = G(l.sets.join('|'))
    if (l.sets.length > 1 && l.style.shape !== '') {
      const R = mt(
        l.inside.map((D) => ot[D]),
        z,
      )
      R !== '' &&
        (q += `<path class="pele-venn-overlap" data-id="${b}" d="${R}" fill="none"${l.style.shape}/>`)
    }
    let M = 0
    for (const R of l.lines) M += R.label.height
    if (M === 0) continue
    let C = l.spot.x * i + nt,
      A = l.spot.y * i + st - M / 2,
      T = ''
    for (const R of l.lines) {
      const D =
        R.id === void 0
          ? ` class="pele-label"${R.size === t ? '' : ` font-size="${R.size}"`}${l.style.text}`
          : ` class="pele-venn-text" data-id="${G(R.id)}" font-size="${s}" fill="var(--_m)"${p(R.id).text}`
      ;((T += J(R.label, C, A + R.label.height / 2, D)), (A += R.label.height))
    }
    W += `<g class="pele-venn-region" data-id="${b}">${T}</g>`
  }
  return {
    svg: ut(
      'venn',
      P,
      rt,
      t,
      a,
      {},
      J(O, P / 2, E + O.height / 2, ' class="pele-title" font-weight="var(--_tw)"') +
        `<g class="pele-venn-sets">${it}</g>` +
        (q ? `<g class="pele-venn-overlaps">${q}</g>` : '') +
        (W ? `<g class="pele-venn-labels">${W}</g>` : ''),
    ),
    width: P,
    height: rt,
    links: [],
  }
}
const Ht = {
  type: 'venn',
  parse(c, e, a) {
    const t = new U()
    return (a && (t.title = a), dt(c, t), t)
  },
  render: bt,
}
export { Ht as a }
