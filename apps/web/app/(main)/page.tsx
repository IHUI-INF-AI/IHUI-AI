import { HeroSection } from '@/components/home/HeroSection'
import { StatsSection } from '@/components/home/StatsSection'
import { FeaturesSection } from '@/components/home/FeaturesSection'
import { ShowcaseSection } from '@/components/home/ShowcaseSection'
import { PricingSection } from '@/components/home/PricingSection'
import { TestimonialsSection } from '@/components/home/TestimonialsSection'
import { FAQSection } from '@/components/home/FAQSection'
import { PartnersSection } from '@/components/home/PartnersSection'
import { NewsletterSection } from '@/components/home/NewsletterSection'
import { CTASection } from '@/components/home/CTASection'

export default function HomePage() {
  return (
    <div className="w-full">
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <ShowcaseSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <PartnersSection />
      <NewsletterSection />
      <CTASection />
    </div>
  )
}
