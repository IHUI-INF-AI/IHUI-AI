import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..')

export default {
  source: join(__dirname, 'src'),
  targets: [
    join(ROOT, 'miniapp', 'src', 'composables', 'shared-logic'),
    join(ROOT, 'src', 'composables', 'shared-logic'),
  ],
  watchOptions: {
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  },
  exclude: [
    /\.DS_Store$/,
    /Thumbs\.db$/,
  ],
}
