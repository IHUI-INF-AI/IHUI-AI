/**
 * 本地 mock SMTP 服务器(仅用于开发测试)
 *
 * 功能:
 * - 监听 127.0.0.1:1025
 * - 接收任意邮件,解析邮件内容(From/To/Subject/Body)
 * - 将邮件保存到 .trae-cn/tmp/mock-smtp-mails.jsonl(JSON Lines 格式,每行一封邮件)
 * - 控制台打印邮件摘要
 *
 * 用法:
 *   node .trae-cn/tmp/mock-smtp.mjs                # 启动
 *   测试完成后 Ctrl+C 停止
 *
 * 验证:
 *   发送邮件后,读取 .trae-cn/tmp/mock-smtp-mails.jsonl 即可拿到邮件内容
 */

import { SMTPServer } from 'smtp-server'
import { simpleParser } from 'mailparser'
import { appendFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mailsFile = resolve(__dirname, '..', '..', '.trae-cn', 'tmp', 'mock-smtp-mails.jsonl')

// 启动时清空旧邮件文件
writeFileSync(mailsFile, '')

const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  onData(stream, session, callback) {
    const chunks = []
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        const parsed = await simpleParser(raw)
        const mail = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          time: new Date().toISOString(),
          from: parsed.from?.text || '',
          to: parsed.to?.text || '',
          subject: parsed.subject || '',
          text: parsed.text || '',
          html: parsed.html ? parsed.html.substring(0, 500) : '',
        }
        appendFileSync(mailsFile, JSON.stringify(mail) + '\n', 'utf8')
        console.log(`[mock-smtp] 收到邮件 #${mail.id}`)
        console.log(`  From: ${mail.from}`)
        console.log(`  To:   ${mail.to}`)
        console.log(`  Subj: ${mail.subject}`)
        console.log(`  Body: ${mail.text.substring(0, 100)}${mail.text.length > 100 ? '...' : ''}`)
        callback()
      } catch (e) {
        console.error('[mock-smtp] 解析失败:', e.message)
        callback(e)
      }
    })
  },
})

server.on('error', (err) => {
  console.error('[mock-smtp] 服务器错误:', err.message)
})

server.listen(1025, '127.0.0.1', () => {
  console.log('[mock-smtp] 服务器已启动:127.0.0.1:1025')
  console.log(`[mock-smtp] 邮件保存到:${mailsFile}`)
  console.log('[mock-smtp] 等待邮件...')
})
