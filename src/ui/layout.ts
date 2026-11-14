/**
 * Each page's content width, shared by its app bar so the logo lines up with
 * the content: the resident page is read on phones and stays narrow on a
 * laptop; the officer workspace uses the whole screen for its drawer.
 */
export const WIDTH = {
  home: 'max-w-5xl',
  resident: 'max-w-[40rem]',
  officer: 'max-w-none',
  'not-found': 'max-w-3xl',
} as const

/** The name beside the logo in each page's app bar. */
export const TITLE = {
  home: 'Community warning system',
  resident: 'Your alert',
  officer: 'Officer workspace',
  'not-found': undefined,
} as const
