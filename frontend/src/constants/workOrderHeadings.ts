/** Standard “Work order heading” options (project sheet). */
export const WORK_ORDER_HEADING_OPTIONS = [
  'SEMI-UNITIZED SLEEK MULLION CURTAIN WALL SYSTEM ( GF-1ST, 31F-TERRACE FLOOR)',
  'EXTRUDED ALUMINIUM FIN PROFILE AND ALUMINIUM LOUVERS IN SHAFT AREA',
  'SEAMLESS GLASS RAILING SYSTEM (1ST-TERRACE FLOOR)',
  'MS RAILING (TERRACE FLOOR)',
  'SLIDING DOOR & WINDOW SYSTEM (FF -32ND FLOOR)',
  'DOOR/ WINDOW WALL GLAZING SYSTEM ( FF-32ND FLOOR)',
  'WINDOW WALL GLAZING SYSTEM ( FF-32ND FLOOR)',
  'WINDOW WALL GLAZING SYSTEM SINGLE GLASS ( GF -32ND FLOOR)',
  'Performance Prototype Testing',
] as const

const set = new Set<string>(WORK_ORDER_HEADING_OPTIONS)

/** Pick a valid dropdown value: prefer stored if listed, else fallback if listed, else first option. */
export function pickWorkOrderHeading(stored: string | null | undefined, fallback: string | null | undefined): string {
  const s = (stored ?? '').trim()
  if (s && set.has(s)) return s
  const f = (fallback ?? '').trim()
  if (f && set.has(f)) return f
  return WORK_ORDER_HEADING_OPTIONS[0]
}
