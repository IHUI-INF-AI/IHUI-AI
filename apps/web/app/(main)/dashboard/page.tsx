import { AnnouncementBar } from '@/components/home/AnnouncementBar'
import { HomeBanner } from '@/components/home/HomeBanner'
import { MemberCard } from '@/components/home/MemberCard'
import { HomeModules } from '@/components/home/HomeModules'

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-4">
      <AnnouncementBar />
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col md:flex-row">
          <HomeBanner />
          <MemberCard />
        </div>
      </section>
      <HomeModules />
    </div>
  )
}
