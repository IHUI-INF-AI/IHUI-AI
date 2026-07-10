/**
 * 将共享包打包为单文件，供 UniApp（Vue2）引用，避免 split-chunks 解析 monorepo 路径失败
 */
import { build } from 'esbuild'
import { mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const bundles = [
  {
    name: 'shared-api',
    entry: join(root, 'packages/shared-api/src/index.ts'),
    outfile: join(root, 'miniapp/src/vendor/shared-api.bundle.js'),
  },
  {
    name: 'shared-auth',
    entry: join(root, 'packages/shared-auth/src/index.ts'),
    outfile: join(root, 'miniapp/src/vendor/shared-auth.bundle.js'),
  },
  {
    name: 'shared-services',
    entry: join(root, 'packages/shared-services/src/index.ts'),
    outfile: join(root, 'miniapp/src/vendor/shared-services.bundle.js'),
  },
]

for (const bundle of bundles) {
  await mkdir(dirname(bundle.outfile), { recursive: true })

  await build({
    entryPoints: [bundle.entry],
    bundle: true,
    outfile: bundle.outfile,
    format: 'esm',
    platform: 'neutral',
    target: 'es2018',
    logLevel: 'info',
  })

  console.log(`[bundle-shared] wrote ${bundle.outfile}`)
}
