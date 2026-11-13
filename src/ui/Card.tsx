import type { ReactNode } from 'react'

/** An M3 outlined card holding one part of a page, named by its heading. */
export default function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-md border border-outline-variant bg-surface-container-lowest p-4 sm:p-6 ${className}`}>
      <h2 className="mb-4 text-title-lg text-on-surface">{title}</h2>
      {children}
    </section>
  )
}
