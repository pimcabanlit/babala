/** The household types that each get their own alert (build plan, "Users and screens"). */
import type { RequiredFact } from '../checker'

export type HouseholdId = 'general' | 'seniors' | 'families' | 'fishers'

export type Household = {
  id: HouseholdId
  label: string
  /** Who the alert speaks to, in the prompt. */
  audience: string
  /** What this household should do, spoken to them, with no full stop, no figures and no claim words. */
  advice: string
  /** Facts the checker requires in this household's alert. */
  required: RequiredFact[]
}

export const HOUSEHOLDS: Household[] = [
  {
    id: 'general',
    label: 'General',
    audience: 'all residents',
    advice: 'Leave now',
    required: ['signal', 'time', 'place', 'hotline'],
  },
  {
    id: 'seniors',
    label: 'Seniors',
    audience: 'older residents and people with disabilities',
    advice: 'Leave early, bring your medicines and ask a neighbour for help',
    required: ['signal', 'time', 'place', 'hotline'],
  },
  {
    id: 'families',
    label: 'Families with kids',
    audience: 'families with young children',
    advice: 'Keep your children close and bring water and food',
    required: ['signal', 'time', 'place', 'hotline'],
  },
  {
    id: 'fishers',
    label: 'Fishers',
    audience: 'fishers and boat owners',
    advice: 'Do not go out to sea, tie up your boats',
    required: ['signal', 'time', 'hotline'],
  },
]
