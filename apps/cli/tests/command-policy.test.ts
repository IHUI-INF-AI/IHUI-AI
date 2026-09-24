// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { isAlwaysConfirmCommand, evaluateArgv, evaluateCommand, isAutoApprovableCommand } from '../src/tools/command-policy/index.js'
import { isReadonlyCommand, matchDangerousCommand } from '../src/tools/command-safety.js'

/**
 * 覆盖 WP-1 要求的七类判定。
 *
 * 与 `command-safety.test.ts` 的分工:那份锁"旧导出函数的行为不得反转",
 * 本份锁"新求值器的判据本身"—— 包括旧字符串扫描看不见、只有 argv 结构才能看见的那一类。
 */

describe('引号与转义绕过 —— 旧字符串正则漏掉、结构化面必须补上', () => {
  it('"rm" -rf 判危险(旧实现的正则要求 rm 后紧跟空白,引号挡住了它)', () => {
    expect(matchDangerousCommand('"rm" -rf /tmp')).not.toBeNull()
    expect(evaluateCommand('"rm" -rf /tmp').dangerous).toBe(true)
  })

  it("rm '-rf' 判危险(选项被引号包起来也一样)", () => {
    expect(matchDangerousCommand("rm '-rf' /tmp")).not.toBeNull()
    expect(evaluateCommand("rm '-rf' /tmp").dangerous).toBe(true)
  })

  it('反斜杠转义不影响判定:rm \\-rf', () => {
    expect(evaluateCommand('rm \\-rf /tmp').dangerous).toBe(true)
  })

  it('引号包住的普通 rm 仍然是只读以外(mv/rm 不可能免确认)', () => {
    expect(isReadonlyCommand('"rm" file.txt')).toBe(false)
  })
})

describe('变量与命令替换 —— 结论只能是 unknown,绝不回落只读', () => {
  it('$CMD 作命令名 → unknown 且不免确认', () => {
    const assessment = evaluateCommand('$CMD -rf /tmp')
    expect(assessment.verdict).toBe('unknown')
    expect(isReadonlyCommand('$CMD -rf /tmp')).toBe(false)
  })

  it('命令替换作命令名 → unknown', () => {
    expect(evaluateCommand('$(which rm) -rf /tmp').verdict).toBe('unknown')
  })

  it('命令替换里的危险面照样要看见', () => {
    expect(evaluateCommand('echo $(rm -rf /tmp)').dangerous).toBe(true)
    expect(matchDangerousCommand('echo $(rm -rf /tmp)')).not.toBeNull()
  })

  it('操作数是变量 → rm -rf "$HOME" 判危险', () => {
    expect(evaluateCommand('rm -rf "$HOME"').dangerous).toBe(true)
  })

  it('cat $FILE 因值不可静态确定而不免确认', () => {
    expect(isReadonlyCommand('cat $FILE')).toBe(false)
    expect(evaluateCommand('cat $FILE').verdict).toBe('unknown')
  })
})

describe('复合命令 —— 逐段求值后取最劣,两段都只读也不免确认', () => {
  it('git status && git log 两段都只读 → 仍不免确认', () => {
    const assessment = evaluateCommand('git status && git log')
    expect(assessment.segments.every((s) => s.verdict === 'read-only')).toBe(true)
    expect(assessment.verdict).toBe('mutating')
    expect(isReadonlyCommand('git status && git log')).toBe(false)
  })

  it('ls && rm -rf / → 危险面来自第二段', () => {
    const assessment = evaluateCommand('ls && rm -rf /')
    expect(assessment.dangerous).toBe(true)
    expect(assessment.alwaysConfirm).toBe(true)
  })

  it('git status && docker run ubuntu → mutating(不危险,YOLO 面与旧实现一致)', () => {
    const assessment = evaluateCommand('git status && docker run ubuntu')
    expect(assessment.verdict).toBe('mutating')
    expect(assessment.dangerous).toBe(false)
    expect(matchDangerousCommand('git status && docker run ubuntu')).toBeNull()
  })

  it('管道与分号同样分段', () => {
    expect(isReadonlyCommand('ls | grep foo')).toBe(false)
    expect(isReadonlyCommand('ls ; rm file')).toBe(false)
  })

  it('重定向到文件即写副作用', () => {
    expect(evaluateCommand('ls -la > /tmp/list.txt').verdict).toBe('mutating')
    expect(evaluateCommand('sort a.txt > b.txt').verdict).toBe('mutating')
    // 丢弃到 /dev/null 不是写文件
    expect(evaluateCommand('git status > /dev/null 2>&1').verdict).toBe('unknown')
  })
})

describe('git push 的三态归位', () => {
  it('git push origin main → mutating(显式登记的网络+写,而不是靠子命令白名单漏掉)', () => {
    const assessment = evaluateCommand('git push origin main')
    expect(assessment.verdict).toBe('mutating')
    expect(assessment.effects).toEqual(expect.arrayContaining(['write', 'network']))
    expect(assessment.dangerous).toBe(false)
    expect(isReadonlyCommand('git push origin main')).toBe(false)
  })

  it('git push --force → 危险 + 永远确认', () => {
    const assessment = evaluateCommand('git push --force origin main')
    expect(assessment.dangerous).toBe(true)
    expect(assessment.alwaysConfirm).toBe(true)
    expect(assessment.destructive).toBe(true)
  })

  it('git push -f 短选项同样命中', () => {
    expect(evaluateCommand('git push -f origin').dangerous).toBe(true)
  })
})

describe('只读子命令上的写语义选项(旧实现对选项盲视)', () => {
  it('git branch 只读,git branch -D 不再免确认且判危险', () => {
    expect(isReadonlyCommand('git branch')).toBe(true)
    const assessment = evaluateCommand('git branch -D feature')
    expect(assessment.verdict).toBe('mutating')
    expect(assessment.dangerous).toBe(true)
    expect(assessment.alwaysConfirm).toBe(true)
    expect(isReadonlyCommand('git branch -D feature')).toBe(false)
  })

  it('git remote 只读,git remote remove 不免确认', () => {
    expect(isReadonlyCommand('git remote -v')).toBe(true)
    expect(isReadonlyCommand('git remote remove origin')).toBe(false)
  })

  it('sort 只读,sort -o out.txt 判写', () => {
    expect(isReadonlyCommand('sort a.txt')).toBe(true)
    expect(evaluateCommand('sort a.txt -o out.txt').verdict).toBe('mutating')
  })

  it('hostname 只读,hostname newname 判写', () => {
    expect(isReadonlyCommand('hostname')).toBe(true)
    expect(evaluateCommand('hostname ihui-box').verdict).toBe('mutating')
  })
})

describe('sed / awk / find —— 写面与脚本体不可静态分析', () => {
  it('sed -i 判写', () => {
    const assessment = evaluateCommand("sed -i 's/a/b/' file.txt")
    expect(assessment.verdict).toBe('mutating')
    expect(assessment.effects).toContain('write')
    expect(isReadonlyCommand("sed -i 's/a/b/' file.txt")).toBe(false)
  })

  it('sed --in-place=.bak 判写(带内联值的长选项)', () => {
    expect(evaluateCommand("sed --in-place=.bak 's/a/b/' f").effects).toContain('write')
  })

  it('sed -n 1,5p file → 脚本体判不出 → unknown(不是只读)', () => {
    expect(evaluateCommand("sed -n '1,5p' file.txt").verdict).toBe('unknown')
    expect(isReadonlyCommand("sed -n '1,5p' file.txt")).toBe(false)
  })

  it('awk -i inplace 判写', () => {
    expect(evaluateCommand("gawk -i inplace '{print}' f").verdict).toBe('unknown')
    expect(evaluateCommand("awk -i inplace '{print}' f").effects).toContain('write')
  })

  it('find -delete → destructive + 永远确认,但不并入旧危险档', () => {
    const assessment = evaluateCommand('find . -name "*.log" -delete')
    expect(assessment.destructive).toBe(true)
    expect(assessment.alwaysConfirm).toBe(true)
    expect(assessment.dangerous).toBe(false)
  })

  it('find -exec 会起子进程 → 效果已知是 system,判 mutating(两种结论都不免确认)', () => {
    const assessment = evaluateCommand('find . -name x -exec rm {} \\;')
    expect(assessment.effects).toContain('system')
    expect(assessment.verdict).toBe('mutating')
    expect(isReadonlyCommand('find . -name x -exec rm {} \\;')).toBe(false)
  })
})

describe('未登记命令 / 子命令 → unknown', () => {
  it('完全未登记的命令', () => {
    const assessment = evaluateCommand('foobar --baz qux')
    expect(assessment.verdict).toBe('unknown')
    expect(isReadonlyCommand('foobar --baz qux')).toBe(false)
  })

  it('已登记命令 + 未登记子命令', () => {
    expect(evaluateCommand('docker timemachine').verdict).toBe('unknown')
    expect(evaluateCommand('git nosuchsub').verdict).toBe('unknown')
  })

  it('已登记命令 + 未登记选项 → 不再免确认', () => {
    expect(evaluateCommand('ls --absolutely-unknown-flag').verdict).toBe('unknown')
    expect(isReadonlyCommand('ls --absolutely-unknown-flag')).toBe(false)
  })

  it('kubectl delete 属破坏性档(新增知识,不并入旧危险档)', () => {
    const assessment = evaluateCommand('kubectl delete ns prod')
    expect(assessment.destructive).toBe(true)
    expect(assessment.alwaysConfirm).toBe(true)
    expect(assessment.dangerous).toBe(false)
    expect(isReadonlyCommand('kubectl delete ns prod')).toBe(false)
  })

  it('docker run --privileged 永远确认', () => {
    expect(isAlwaysConfirmCommand('docker run --privileged ubuntu')).toBe(true)
    expect(evaluateCommand('docker run --privileged ubuntu').dangerous).toBe(false)
  })
})

describe('短选项簇 / 内联值 / `--` 终止符(argv 入口)', () => {
  it('-rf 与 -fr 都解析出 r 与 f', () => {
    expect(evaluateArgv(['rm', '-rf', '/tmp/x']).dangerous).toBe(true)
    expect(evaluateArgv(['rm', '-fr', '/tmp/x']).dangerous).toBe(true)
    expect(evaluateArgv(['rm', '-f', '/tmp/x']).dangerous).toBe(false)
  })

  it('-n10 内联值不会被当成子命令', () => {
    expect(evaluateArgv(['head', '-n10', 'f.txt']).verdict).toBe('read-only')
  })

  it('-D 与 -d 大小写敏感(短选项不许被折成小写)', () => {
    expect(evaluateArgv(['git', 'branch', '-D', 'x']).dangerous).toBe(true)
    expect(evaluateArgv(['git', 'branch', '-d', 'x']).dangerous).toBe(true)
    expect(evaluateArgv(['git', 'branch', '-v', 'x']).dangerous).toBe(false)
  })

  it('`--` 之后的内容一律按操作数,不当选项', () => {
    const assessment = evaluateArgv(['grep', '-r', '--', 'pattern', '-rf'])
    expect(assessment.verdict).toBe('read-only')
    expect(assessment.dangerous).toBe(false)
  })

  it('子命令之前的全局选项带值不吞掉子命令', () => {
    expect(evaluateArgv(['git', '-C', '/tmp/repo', 'status']).verdict).toBe('read-only')
  })

  it('Windows 路径与可执行后缀归一', () => {
    expect(evaluateArgv(['C:\\Program Files\\Git\\bin\\git.exe', 'status']).verdict).toBe('read-only')
  })
})

describe('逃生舱语义:免确认与危险档各自可控', () => {
  it('isAutoApprovableCommand 默认等于只读判定', () => {
    expect(isAutoApprovableCommand('git status')).toBe(true)
    expect(isAutoApprovableCommand('git push origin main')).toBe(false)
  })

  it('yolo 档放开通用命令,但绝不放过"永远确认"子集', () => {
    expect(isAutoApprovableCommand('git push origin main', { yolo: true })).toBe(true)
    expect(isAutoApprovableCommand('git reset --hard HEAD~1', { yolo: true })).toBe(false)
    expect(isAutoApprovableCommand('rm -rf /', { yolo: true })).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
