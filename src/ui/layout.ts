/**
 * Each page's content width. The home page and the resident page share one
 * width on a laptop, where the resident page opens into two columns; on a
 * tablet the resident page stays one readable column. The officer workspace
 * uses the whole window for its drawer.
 */
export const WIDTH = {
  home: 'max-w-6xl',
  resident: 'max-w-[40rem] lg:max-w-6xl',
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
