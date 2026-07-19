import { writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

writeFileSync(path.join(__dirname, '__test_write.txt'), 'hello from node script\n')
writeFileSync(path.join(__dirname, '..', '__test_write_root.txt'), 'hello from root\n')
console.log('OK')
