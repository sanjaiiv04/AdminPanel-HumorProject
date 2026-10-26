'use client'

import Link from 'next/link'
import { AdminNotice } from '@/components/admin/ui'

export default function AdminError({ retry }: { error: unknown; retry: () => void }) {
  return <AdminNotice title="This admin page could not load" error>
    <p>Try loading the page again. If the problem continues, check your connection and sign-in session.</p>
    <div className="mt-4 flex flex-wrap gap-4">
      <button type="button" onClick={() => retry()} className="font-bold underline">Try again</button>
      <Link href="/admin" className="font-bold underline">Back to overview</Link>
    </div>
  </AdminNotice>
}
