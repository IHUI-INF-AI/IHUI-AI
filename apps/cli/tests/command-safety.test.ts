import { describe, expect, it } from 'vitest'
import {
  DANGEROUS_COMMAND_PATTERNS,
  READONLY_COMMAND_BASENAMES,
  GIT_READONLY_SUBCOMMANDS,
  matchDangerousCommand,
  isReadonlyCommand,
} from '../src/tools/command-safety.js'

describe('matchDangerousCommand — 命中危险模式', () => {
  it('匹配 rm -rf', () => {
    expect(matchDangerousCommand('rm -rf /tmp/foo')).not.toBeNull()
  })

  it('匹配 rm -r', () => {
    expect(matchDangerousCommand('rm -r /tmp/foo')).not.toBeNull()
  })

  it('匹配 rm -fr', () => {
    expect(matchDangerousCommand('rm -fr /tmp')).not.toBeNull()
  })

  it('匹配 rm --recursive', () => {
    expect(matchDangerousCommand('rm --recursive /tmp')).not.toBeNull()
  })

  it('匹配 chmod 777', () => {
    expect(matchDangerousCommand('chmod 777 file.txt')).not.toBeNull()
  })

  it('匹配 chmod 755', () => {
    expect(matchDangerousCommand('chmod 755 script.sh')).not.toBeNull()
  })

  it('匹配 chmod u+s(setuid)', () => {
    expect(matchDangerousCommand('chmod u+s binary')).not.toBeNull()
  })

  it('匹配 chmod g+s(setgid)', () => {
    expect(matchDangerousCommand('chmod g+s binary')).not.toBeNull()
  })

  it('匹配 chown', () => {
    expect(matchDangerousCommand('chown root:root file')).not.toBeNull()
  })

  it('匹配 chgrp', () => {
    expect(matchDangerousCommand('chgrp admin file')).not.toBeNull()
  })

  it('匹配 chattr', () => {
    expect(matchDangerousCommand('chattr +i file')).not.toBeNull()
  })

  it('匹配 pkill', () => {
    expect(matchDangerousCommand('pkill -f node')).not.toBeNull()
  })

  it('匹配 kill -9', () => {
    expect(matchDangerousCommand('kill -9 1234')).not.toBeNull()
  })

  it('匹配 killall -9', () => {
    expect(matchDangerousCommand('killall -9 chrome')).not.toBeNull()
  })

  it('匹配 git push --force', () => {
    expect(matchDangerousCommand('git push --force origin main')).not.toBeNull()
  })

  it('匹配 git push -f', () => {
    expect(matchDangerousCommand('git push -f origin')).not.toBeNull()
  })

  it('匹配 git push --force-with-lease', () => {
    expect(matchDangerousCommand('git push --force-with-lease')).not.toBeNull()
  })

  it('匹配 git reset --hard', () => {
    expect(matchDangerousCommand('git reset --hard HEAD~1')).not.toBeNull()
  })

  it('匹配 git clean -fd', () => {
    expect(matchDangerousCommand('git clean -fd')).not.toBeNull()
  })

  it('匹配 git branch -D', () => {
    expect(matchDangerousCommand('git branch -D feature')).not.toBeNull()
  })

  it('匹配 shutdown', () => {
    expect(matchDangerousCommand('shutdown -h now')).not.toBeNull()
  })

  it('匹配 reboot', () => {
    expect(matchDangerousCommand('reboot')).not.toBeNull()
  })

  it('匹配 mkfs', () => {
    expect(matchDangerousCommand('mkfs.ext4 /dev/sda1')).not.toBeNull()
  })

  it('匹配 dd 写设备', () => {
    expect(matchDangerousCommand('dd if=img.iso of=/dev/sdb')).not.toBeNull()
  })

  it('返回命中的 pattern(RegExp 实例)', () => {
    const pattern = matchDangerousCommand('rm -rf /tmp')
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern!.source).toMatch(/rm/)
  })
})

describe('matchDangerousCommand — 未命中(安全命令)', () => {
  it('未匹配 ls', () => {
    expect(matchDangerousCommand('ls -la')).toBeNull()
  })

  it('未匹配 cat', () => {
    expect(matchDangerousCommand('cat file.txt')).toBeNull()
  })

  it('未匹配 grep', () => {
    expect(matchDangerousCommand('grep -r pattern .')).toBeNull()
  })

  it('未匹配 git status', () => {
    expect(matchDangerousCommand('git status')).toBeNull()
  })

  it('未匹配 git log', () => {
    expect(matchDangerousCommand('git log --oneline')).toBeNull()
  })

  it('未匹配 rm(无 -r 标志)', () => {
    expect(matchDangerousCommand('rm file.txt')).toBeNull()
  })

  it('未匹配 kill(无 -9)', () => {
    expect(matchDangerousCommand('kill 1234')).toBeNull()
  })

  it('未匹配 kill -15(SIGTERM)', () => {
    expect(matchDangerousCommand('kill -15 1234')).toBeNull()
  })

  it('未匹配 git push(无 --force)', () => {
    expect(matchDangerousCommand('git push origin main')).toBeNull()
  })

  it('未匹配 git reset --soft', () => {
    expect(matchDangerousCommand('git reset --soft HEAD~1')).toBeNull()
  })

  it('未匹配 chmod +x(非 setuid/setgid/777)', () => {
    expect(matchDangerousCommand('chmod +x script.sh')).toBeNull()
  })

  it('未匹配空命令', () => {
    expect(matchDangerousCommand('')).toBeNull()
  })
})

describe('isReadonlyCommand — 命中只读命令', () => {
  it('ls 是只读', () => {
    expect(isReadonlyCommand('ls -la')).toBe(true)
  })

  it('cat 是只读', () => {
    expect(isReadonlyCommand('cat file.txt')).toBe(true)
  })

  it('pwd 是只读', () => {
    expect(isReadonlyCommand('pwd')).toBe(true)
  })

  it('date 是只读', () => {
    expect(isReadonlyCommand('date')).toBe(true)
  })

  it('whoami 是只读', () => {
    expect(isReadonlyCommand('whoami')).toBe(true)
  })

  it('hostname 是只读', () => {
    expect(isReadonlyCommand('hostname')).toBe(true)
  })

  it('ps 是只读', () => {
    expect(isReadonlyCommand('ps aux')).toBe(true)
  })

  it('head 是只读', () => {
    expect(isReadonlyCommand('head -n 10 file')).toBe(true)
  })

  it('tail 是只读', () => {
    expect(isReadonlyCommand('tail -f log.txt')).toBe(true)
  })

  it('wc 是只读', () => {
    expect(isReadonlyCommand('wc -l file')).toBe(true)
  })

  it('grep 是只读', () => {
    expect(isReadonlyCommand('grep -r pattern .')).toBe(true)
  })

  it('rg 是只读', () => {
    expect(isReadonlyCommand('rg pattern src/')).toBe(true)
  })

  it('git status 是只读', () => {
    expect(isReadonlyCommand('git status')).toBe(true)
  })

  it('git log 是只读', () => {
    expect(isReadonlyCommand('git log --oneline')).toBe(true)
  })

  it('git diff 是只读', () => {
    expect(isReadonlyCommand('git diff HEAD~1')).toBe(true)
  })

  it('git branch 是只读', () => {
    expect(isReadonlyCommand('git branch')).toBe(true)
  })

  it('git show 是只读', () => {
    expect(isReadonlyCommand('git show HEAD')).toBe(true)
  })

  it('git rev-parse 是只读', () => {
    expect(isReadonlyCommand('git rev-parse HEAD')).toBe(true)
  })

  it('git config --get 是只读', () => {
    expect(isReadonlyCommand('git config --get user.name')).toBe(true)
  })

  it('带路径前缀的命令(/usr/bin/ls)是只读', () => {
    expect(isReadonlyCommand('/usr/bin/ls -la')).toBe(true)
  })

  it('带 .exe 后缀的命令(Windows)是只读', () => {
    expect(isReadonlyCommand('git.exe status')).toBe(true)
  })
})

describe('isReadonlyCommand — 未命中(非只读命令)', () => {
  it('rm 不是只读', () => {
    expect(isReadonlyCommand('rm file.txt')).toBe(false)
  })

  it('chmod 不是只读', () => {
    expect(isReadonlyCommand('chmod 755 file')).toBe(false)
  })

  it('node 不是只读(不在白名单)', () => {
    expect(isReadonlyCommand('node script.js')).toBe(false)
  })

  it('echo 不是只读(不在白名单)', () => {
    expect(isReadonlyCommand('echo hello')).toBe(false)
  })

  it('npm 不是只读(不在白名单)', () => {
    expect(isReadonlyCommand('npm install')).toBe(false)
  })

  it('git push 不是只读', () => {
    expect(isReadonlyCommand('git push origin main')).toBe(false)
  })

  it('git commit 不是只读', () => {
    expect(isReadonlyCommand('git commit -m "msg"')).toBe(false)
  })

  it('git checkout 不是只读', () => {
    expect(isReadonlyCommand('git checkout main')).toBe(false)
  })

  it('git config(无 --get)不是只读', () => {
    expect(isReadonlyCommand('git config user.name')).toBe(false)
  })

  it('git(无子命令)不是只读', () => {
    expect(isReadonlyCommand('git')).toBe(false)
  })

  it('git --version 不是只读(子命令不在白名单)', () => {
    expect(isReadonlyCommand('git --version')).toBe(false)
  })

  it('空命令不是只读', () => {
    expect(isReadonlyCommand('')).toBe(false)
  })

  it('空白命令不是只读', () => {
    expect(isReadonlyCommand('   ')).toBe(false)
  })
})

describe('isReadonlyCommand — 复合命令永远 false', () => {
  it('ls && rm 不是只读', () => {
    expect(isReadonlyCommand('ls && rm file')).toBe(false)
  })

  it('ls | grep 不是只读', () => {
    expect(isReadonlyCommand('ls | grep foo')).toBe(false)
  })

  it('ls ; rm 不是只读', () => {
    expect(isReadonlyCommand('ls ; rm file')).toBe(false)
  })

  it('ls || echo 不是只读', () => {
    expect(isReadonlyCommand('ls || echo fail')).toBe(false)
  })

  it('git status && git log 不是只读(即使两段都只读)', () => {
    expect(isReadonlyCommand('git status && git log')).toBe(false)
  })
})

describe('isReadonlyCommand — git 子命令限定', () => {
  it('git status = true', () => {
    expect(isReadonlyCommand('git status')).toBe(true)
  })

  it('git push = false', () => {
    expect(isReadonlyCommand('git push')).toBe(false)
  })

  it('git commit = false', () => {
    expect(isReadonlyCommand('git commit')).toBe(false)
  })

  it('git log = true', () => {
    expect(isReadonlyCommand('git log')).toBe(true)
  })

  it('git diff = true', () => {
    expect(isReadonlyCommand('git diff')).toBe(true)
  })

  it('git add = false', () => {
    expect(isReadonlyCommand('git add file')).toBe(false)
  })

  it('git merge = false', () => {
    expect(isReadonlyCommand('git merge feature')).toBe(false)
  })

  it('git rebase = false', () => {
    expect(isReadonlyCommand('git rebase main')).toBe(false)
  })

  it('git config --get = true(两词子命令)', () => {
    expect(isReadonlyCommand('git config --get user.name')).toBe(true)
  })

  it('git config user.name = false(无 --get)', () => {
    expect(isReadonlyCommand('git config user.name')).toBe(false)
  })
})

describe('isReadonlyCommand — cargo/kubectl/docker 子命令限定', () => {
  it('cargo check = true', () => {
    expect(isReadonlyCommand('cargo check')).toBe(true)
  })

  it('cargo build --dry-run = true', () => {
    expect(isReadonlyCommand('cargo build --dry-run')).toBe(true)
  })

  it('cargo build(无 --dry-run) = false', () => {
    expect(isReadonlyCommand('cargo build')).toBe(false)
  })

  it('cargo run = false', () => {
    expect(isReadonlyCommand('cargo run')).toBe(false)
  })

  it('kubectl get = true', () => {
    expect(isReadonlyCommand('kubectl get pods')).toBe(true)
  })

  it('kubectl logs = true', () => {
    expect(isReadonlyCommand('kubectl logs app-pod')).toBe(true)
  })

  it('kubectl delete = false', () => {
    expect(isReadonlyCommand('kubectl delete pod foo')).toBe(false)
  })

  it('kubectl apply = false', () => {
    expect(isReadonlyCommand('kubectl apply -f deploy.yaml')).toBe(false)
  })

  it('docker ps = true', () => {
    expect(isReadonlyCommand('docker ps')).toBe(true)
  })

  it('docker logs = true', () => {
    expect(isReadonlyCommand('docker logs web')).toBe(true)
  })

  it('docker rm = false', () => {
    expect(isReadonlyCommand('docker rm container')).toBe(false)
  })

  it('docker stop = false', () => {
    expect(isReadonlyCommand('docker stop container')).toBe(false)
  })
})

describe('导出常量完整性', () => {
  it('DANGEROUS_COMMAND_PATTERNS 非空且为 RegExp 数组', () => {
    expect(DANGEROUS_COMMAND_PATTERNS.length).toBeGreaterThan(10)
    for (const p of DANGEROUS_COMMAND_PATTERNS) {
      expect(p).toBeInstanceOf(RegExp)
    }
  })

  it('READONLY_COMMAND_BASENAMES 包含 ls/cat/git/grep/rg', () => {
    expect(READONLY_COMMAND_BASENAMES).toContain('ls')
    expect(READONLY_COMMAND_BASENAMES).toContain('cat')
    expect(READONLY_COMMAND_BASENAMES).toContain('git')
    expect(READONLY_COMMAND_BASENAMES).toContain('grep')
    expect(READONLY_COMMAND_BASENAMES).toContain('rg')
  })

  it('GIT_READONLY_SUBCOMMANDS 包含 status/log/diff/branch', () => {
    expect(GIT_READONLY_SUBCOMMANDS).toContain('status')
    expect(GIT_READONLY_SUBCOMMANDS).toContain('log')
    expect(GIT_READONLY_SUBCOMMANDS).toContain('diff')
    expect(GIT_READONLY_SUBCOMMANDS).toContain('branch')
  })

  it('GIT_READONLY_SUBCOMMANDS 不含 push/commit/merge', () => {
    expect(GIT_READONLY_SUBCOMMANDS).not.toContain('push')
    expect(GIT_READONLY_SUBCOMMANDS).not.toContain('commit')
    expect(GIT_READONLY_SUBCOMMANDS).not.toContain('merge')
  })
})
