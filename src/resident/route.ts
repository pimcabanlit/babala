/** The resident view lives at /resident; everything else is the officer's page. */
export const RESIDENT_PATH = '/resident'

export function isResidentPath(pathname: string): boolean {
  return pathname === RESIDENT_PATH || pathname.startsWith(`${RESIDENT_PATH}/`)
}
