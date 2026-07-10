'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  GraduationCap, BookOpen, ClipboardCheck, Users, UserCog, BookMarked,
  FolderTree, Award, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@ihui/ui'

interface Module {
  href: string
  title: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
}

const MODULES: Module[] = [
  { href: '/admin/edu/exam', title: '考试管理', desc: '题库、试卷、组卷、批阅、排名', icon: GraduationCap, gradient: 'from-indigo-500 to-purple-600' },
  { href: '/admin/edu/answer', title: '答题管理', desc: '在线答题、编程判题、答题卡', icon: ClipboardCheck, gradient: 'from-rose-500 to-pink-600' },
  { href: '/admin/edu/learn', title: '学习管理', desc: '课程、直播录播、资料作业、进度排行', icon: BookOpen, gradient: 'from-emerald-500 to-green-600' },
  { href: '/admin/edu/student', title: '学员管理', desc: '学员信息、详情、等级', icon: Users, gradient: 'from-sky-500 to-blue-600' },
  { href: '/admin/edu/teacher', title: '讲师管理', desc: '讲师信息、详情、审核', icon: UserCog, gradient: 'from-amber-500 to-orange-600' },
  { href: '/admin/edu/course', title: '课程管理', desc: '课程CRUD、分类、章节', icon: BookMarked, gradient: 'from-violet-500 to-fuchsia-600' },
  { href: '/admin/edu/class', title: '班级管理', desc: '班级、成员、排课', icon: FolderTree, gradient: 'from-teal-500 to-cyan-600' },
  { href: '/admin/edu/certificate', title: '证书管理', desc: '颁发、模板、已发证书', icon: Award, gradient: 'from-yellow-500 to-amber-600' },
  { href: '/admin/edu/finance', title: '财务管理', desc: '订单、发票、统计', icon: Wallet, gradient: 'from-red-500 to-rose-600' },
]

export default function EduHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">教育后台</h1>
        <p className="mt-1 text-sm text-muted-foreground">考试、答题、学习、学员、讲师、课程、班级、证书、财务管理</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const Icon = m.icon
          return (
            <Link key={m.href} href={m.href}>
              <Card className="transition-all hover:shadow-md hover:border-primary/30">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white', m.gradient)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{m.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
