import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { release } from '../release'

type Props = { open: boolean; onClose: () => void }

export default function ReleaseHistory({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape)
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', escape)
      document.body.style.overflow = originalOverflow
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="oculivo-release-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="oculivo-release-dialog" role="dialog" aria-modal="true" aria-labelledby="oculivo-release-title" aria-describedby="oculivo-release-intro">
        <header className="oculivo-release-header">
          <div><span className="oculivo-release-eyebrow">WHAT'S NEW · RELEASE HISTORY</span><h2 id="oculivo-release-title">{release.product} · v{release.version}</h2></div>
          <button type="button" ref={closeRef} onClick={onClose} aria-label="Close release notes"><X size={20}/></button>
        </header>
        <div className="oculivo-release-content">
          <p id="oculivo-release-intro">{release.title}</p>
          <span className="oculivo-release-date">{release.releasedAt}</span>
          <ul>{release.notes.map(note => <li key={note}>{note}</li>)}</ul>
        </div>
      </section>
    </div>, document.body
  )
}
