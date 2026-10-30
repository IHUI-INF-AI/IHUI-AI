function f(t, n, r, i) {
  let e = i(n, !1),
    o = t.maxWidth
  if (o === void 0 || !(o > 0) || e.width <= o) return e
  let u = Math.min(r, n),
    d = n
  e = i(d, !0)
  for (let a = 0; a < 3 && e.width > o && d > u; a++)
    ((d = Math.max(u, d - (e.width - o))), (e = i(d, !0)))
  return e
}
function h(t) {
  const n = t.maxWidth
  return n !== void 0 && n > 0 ? Math.max(80, n - 2 * (t.padding ?? 8)) : 4e3
}
function l(t, n, r, i = 0) {
  const e = t.maxWidth
  return e === void 0 || !(e > 0) ? n : Math.max(Math.min(r, n), Math.min(n, e - i))
}
const s = 640
function c(t, n) {
  const r = n(!1),
    i = t.maxWidth
  if (t.autoDirection === !1 || i === void 0 || !(i > 0) || r.width <= i) return r
  const e = t.directionBreakpoint
  if (i >= (e !== void 0 && e > 0 ? e : s)) return r
  const o = n(!0)
  return o.width < r.width ? o : r
}
function m(t) {
  return t === 'LR' || t === 'RL'
}
function p(t, n) {
  const r = n(!1),
    i = t.maxWidth
  if (i === void 0 || !(i > 0) || r.width <= i) return r
  const e = n(!0)
  return e.width < r.width ? e : r
}
export { f as a, h as b, l as c, c as d, m as e, p as f }
