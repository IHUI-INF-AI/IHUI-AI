import { redirect } from 'next/navigation'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') qs.set(k, v)
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
  }
  const query = qs.toString()
  redirect(`/admin/edu/exam/questions${query ? `?${query}` : ''}`)
}
