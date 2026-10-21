'use client'

import { useEffect, useState } from 'react'

export function FormattedDate({ dateString }: { dateString?: string | null }) {
  const [formatted, setFormatted] = useState<string>('')

  useEffect(() => {
    if (!dateString) return
    setFormatted(new Date(dateString).toLocaleDateString())
  }, [dateString])

  if (!dateString) return <span>N/A</span>
  return <span>{formatted || dateString}</span>
}