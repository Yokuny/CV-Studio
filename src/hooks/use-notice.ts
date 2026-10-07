import { useEffect, useState } from 'react'

export function useNotice(timeout = 8500) {
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), timeout)
    return () => clearTimeout(timer)
  }, [notice, timeout])
  return [notice, setNotice] as const
}
