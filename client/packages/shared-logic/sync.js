import { watch } from 'chokidar'
import { copyFile, mkdir, rm, readdir, stat } from 'fs/promises'
import { join, relative } from 'path'
import config from './sync.config.js'

const { source, targets, watchOptions, exclude } = config

function shouldExclude(filePath) {
  return exclude.some(re => re.test(filePath))
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function removeTarget(targetDir) {
  try {
    await rm(targetDir, { recursive: true, force: true })
  } catch { /* noop */ }
}

async function syncTree(srcDir, destDir, relativePath = '') {
  const entries = await readdir(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

    if (shouldExclude(srcPath)) continue

    if (entry.isDirectory()) {
      await ensureDir(destPath)
      await syncTree(srcPath, destPath, relPath)
    } else {
      await ensureDir(destDir)
      await copyFile(srcPath, destPath)
      log('sync', relPath)
    }
  }
}

function log(action, filePath) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const rel = relative(source, filePath)
  const targetsStr = targets.map(t => relative(process.cwd(), t)).join(', ')
  console.log(`[${time}] ${action.padEnd(6)} ${rel} → ${targetsStr}`)
}

async function initialSync() {
  console.log('--- Initial sync ---')
  for (const target of targets) {
    await removeTarget(target)
    await syncTree(source, target)
  }
  console.log(`--- Synced to ${targets.length} targets ---\n`)
}

function startWatcher() {
  console.log('Watching for changes...')
  console.log(`  Source:      ${source}`)
  targets.forEach(t => console.log(`  Target:      ${t}`))
  console.log('')

  const watcher = watch(source, {
    ignoreInitial: true,
    awaitWriteFinish: watchOptions.awaitWriteFinish,
  })

  watcher
    .on('add', async (filePath) => {
      if (shouldExclude(filePath)) return
      const rel = relative(source, filePath)
      for (const target of targets) {
        const destPath = join(target, rel)
        await ensureDir(join(destPath, '..'))
        await copyFile(filePath, destPath)
      }
      log('add', filePath)
    })
    .on('change', async (filePath) => {
      if (shouldExclude(filePath)) return
      const rel = relative(source, filePath)
      for (const target of targets) {
        const destPath = join(target, rel)
        await copyFile(filePath, destPath)
      }
      log('change', filePath)
    })
    .on('unlink', async (filePath) => {
      if (shouldExclude(filePath)) return
      const rel = relative(source, filePath)
      for (const target of targets) {
        const destPath = join(target, rel)
        try { await rm(destPath) } catch { /* noop */ }
      }
      log('delete', filePath)
    })
    .on('addDir', async (dirPath) => {
      if (shouldExclude(dirPath)) return
      const rel = relative(source, dirPath)
      for (const target of targets) {
        await ensureDir(join(target, rel))
      }
    })
    .on('unlinkDir', async (dirPath) => {
      if (shouldExclude(dirPath)) return
      const rel = relative(source, dirPath)
      for (const target of targets) {
        try { await rm(join(target, rel), { recursive: true }) } catch { /* noop */ }
      }
      log('rmdir', dirPath)
    })
    .on('error', (error) => {
      console.error('Watcher error:', error)
    })

  return watcher
}

await initialSync()
const watcher = startWatcher()

process.on('SIGINT', () => {
  console.log('\nStopping sync...')
  watcher.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  watcher.close()
  process.exit(0)
})
