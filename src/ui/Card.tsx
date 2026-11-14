import type { ReactNode } from 'react'

/**
 * An M3 outlined card holding one part of a page, named by its heading. With
 * an id, it can be scrolled to and focused, as the officer drawer's steps do.
 */
export default function Card({ title, id, children, className = '' }: { title: string; id?: string; children: ReactNode; className?: string }) {
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-label={title}
      className={`scroll-mt-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4 outline-none sm:p-6 ${className}`}
    >
      <h2 className="mb-4 text-title-lg text-on-surface">{title}</h2>
      {children}
    </section>
  )
}
