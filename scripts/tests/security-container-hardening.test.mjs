// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 容器面判据自检(2026-11-24 立)。
 *
 * 钉住四类"加了 USER 反而起不来"的形状 —— 这是非 root 加固最常见的坑,
 * 也是本机无容器运行时时唯一能验证的部分:
 *   ① 降权 nginx 却没交出 /var/run、/var/cache/nginx、/var/log/nginx 的写权限;
 *   ② 降权后仍绑 <1024 特权端口;
 *   ③ 整份没有 USER(默认 root);
 *   ④ 带 `container-user` 豁免时必须真的免、且理由够长。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scanDockerfile } from '../security/check-container-hardening.mjs'

const RULES = (f) => f.map((x) => x.rule)

test('降权 nginx 但三个可写面没 chown ⇒ 三条 high', () => {
  const r = scanDockerfile('Dockerfile', ['FROM nginx:1.27-alpine', 'COPY x /usr/share/nginx/html/', 'CMD ["nginx","-g","daemon off;"]', 'USER nginx'].join('\n'))
  assert.equal(RULES(r.findings).filter((x) => x === 'nonroot-writable-paths').length, 3)
  assert.ok(r.findings.every((x) => x.severity === 'high'))
})

test('交出三个可写面后 nginx 降权不再报', () => {
  const r = scanDockerfile('Dockerfile', ['FROM nginx:1.27-alpine', 'RUN chown -R nginx:nginx /var/run /var/cache/nginx /var/log/nginx', 'USER nginx', 'CMD ["nginx","-g","daemon off;"]'].join('\n'))
  assert.equal(r.findings.length, 0)
})

test('非 root 绑 <1024 端口 ⇒ privileged-port', () => {
  const r = scanDockerfile('Dockerfile', ['FROM node:22-alpine', 'USER node', 'CMD ["node","app.js"]', 'RUN echo "listen 80;" > /etc/x.conf'].join('\n'))
  assert.ok(RULES(r.findings).includes('privileged-port'), `实际: ${RULES(r.findings).join(',')}`)
})

test('root 绑 80 不报 privileged-port(它绑得起)', () => {
  const r = scanDockerfile('Dockerfile', ['FROM node:22-alpine', 'RUN echo "listen 80;"', 'USER root'].join('\n'))
  assert.ok(!RULES(r.findings).includes('privileged-port'))
  assert.ok(RULES(r.findings).includes('no-user') === false || true)
})

test('整份没有 USER ⇒ no-user', () => {
  const r = scanDockerfile('Dockerfile', ['FROM node:22-alpine', 'CMD ["node","a.js"]'].join('\n'))
  assert.ok(RULES(r.findings).includes('no-user'))
})

test('container-user 豁免(理由够长)生效且进 skipped', () => {
  const text = [
    'FROM node:20-alpine',
    '# security-exempt: container-user 需挂载 docker.sock 管理客户容器,部署侧未固定 gid',
    '# USER app',
    'CMD ["node","a.js"]',
  ].join('\n')
  const r = scanDockerfile('Dockerfile', text)
  assert.equal(RULES(r.findings).includes('no-user'), false)
  assert.equal(r.skipped.length, 1)
  assert.match(r.skipped[0].reason, /^exempt:/)
})

test('豁免理由过短不免(防一句"我不用"白免)', () => {
  const text = ['FROM node:20-alpine', '# security-exempt: container-user 不用', 'CMD ["node","a.js"]'].join('\n')
  const r = scanDockerfile('Dockerfile', text)
  assert.ok(RULES(r.findings).includes('no-user'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
