import { redirect } from 'next/navigation'

export default async function Page() {
  redirect('/admin/system/operation-logs')
}
