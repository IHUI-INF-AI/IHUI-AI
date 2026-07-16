import {
  Radio,
  FileStack,
  FolderTree,
  ListOrdered,
  ClipboardList,
  TrendingUp,
  CalendarDays,
  Bell,
  Users,
  Trophy,
  MapIcon,
  Layers,
} from 'lucide-react'
import type { LForm, Lesson } from './types'

export const PAGE_SIZE = 10

export const EMPTY: LForm = {
  title: '',
  categoryId: '',
  intro: '',
  introduction: '',
  image: '',
  cidList: [],
  lecturerName: '',
  price: '0',
  isFree: false,
  isPublished: false,
  sort: '0',
}

export const SUB_LINKS = [
  { href: '/admin/edu/learn/live', label: 'subLink.live', icon: Radio },
  { href: '/admin/edu/learn/recorded', label: 'subLink.recorded', icon: FileStack },
  { href: '/admin/edu/learn/materials', label: 'subLink.materials', icon: FolderTree },
  { href: '/admin/edu/learn/homework', label: 'subLink.homework', icon: ClipboardList },
  { href: '/admin/edu/learn/records', label: 'subLink.records', icon: ListOrdered },
  { href: '/admin/edu/learn/progress', label: 'subLink.progress', icon: TrendingUp },
  { href: '/admin/edu/learn/plan', label: 'subLink.plan', icon: CalendarDays },
  { href: '/admin/edu/learn/maps', label: 'subLink.maps', icon: MapIcon },
  { href: '/admin/edu/learn/topics', label: 'subLink.topics', icon: Layers },
  { href: '/admin/edu/learn/remind', label: 'subLink.remind', icon: Bell },
  { href: '/admin/edu/learn/community', label: 'subLink.community', icon: Users },
  { href: '/admin/edu/learn/ranking', label: 'subLink.ranking', icon: Trophy },
]

export function lessonToForm(l: Lesson): LForm {
  return {
    title: l.title,
    categoryId: l.categoryId ?? '',
    intro: l.intro ?? '',
    introduction: l.introduction ?? '',
    image: l.image ?? '',
    cidList: l.cidList ?? [],
    lecturerName: l.lecturerName ?? '',
    price: l.price,
    isFree: l.isFree,
    isPublished: l.isPublished,
    sort: String(l.sort),
  }
}
