/**
 * The answer check (rule 8): an AI answer to a resident's question may only
 * say what the approved alert says. Deterministic code, never a model, like
 * every other rule (docs/data-schema.md, "Checker rules").
 *
 * The phone has no fact sheet, only the approved alert (its resident copy), so
 * the alert itself is the source of truth here: every figure, place name and
 * claim in the answer must be in the alert, and most of its words must be the
 * alert's own or everyday words that add nothing.
 */
import { LANDFALL_WORDS } from './check'
import { extractFigures, type Figure } from './figures'
import { VENUE_WORDS } from './places'
import { checkPlaceholders, checkPlain } from './rules'
import { findAll, overlaps, phrasePattern, sentenceAt } from './text'
import type { CheckResult, Issue, Span, TranslatedClaim } from './types'

/** Answers are short: at most the alert's own three sentences. */
export const ANSWER_MAX_SENTENCES = 3
export const ANSWER_MAX_WORDS = { en: 45, other: 70 } as const

export type AnswerAlert = {
  /** The approved English alert. */
  english: string
  /** The text the resident reads and the answer is written in: the English, or a published translation. */
  shown: string
  /** Other names on the resident's screen with the alert: the storm and the area. */
  names: string[]
}

export type AnswerOptions = {
  /** The answer's language: 'en', 'fil' or 'ceb'. Only English answers get the landfall-time check. */
  language: string
  /** Rule 5's English claim words: allowed only when the alert says them. */
  claimWords: string[]
  /** Phrases that tell a resident to do less than an alert says ("stay home"): allowed only when the alert says them. */
  answerClaims: string[]
  /** Filipino and Cebuano claim words (rule 7), each backed by English words that must be in the English alert. */
  translatedClaims: TranslatedClaim[]
}

/**
 * Function words that carry no fact, instruction or yes-or-no: an answer may
 * use them freely. "Yes", negations ("not", "hindi", "dili"), instructions
 * ("stay", "leave") and claims are left out on purpose, so each one an answer
 * adds counts against it, and a bare "Yes." fails.
 */
const EVERYDAY_WORDS = new Set([
  // English
  'a', 'an', 'the', 'and', 'or', 'so', 'to', 'of', 'in', 'on', 'at', 'for', 'from', 'with', 'by', 'as',
  'is', 'are', 'be', 'it', 'its', "it's", 'this', 'that', 'there', 'you', 'your', 'we', 'our', 'us', 'they',
  'them', 'their', 'i', 'my', 'me', 'do', 'can', 'should', 'will', 'please', 'also', 'what', 'when',
  'where', 'who', 'how', 'which', 'alert', 'says', 'say', 'about', 'storm', 'typhoon',
  // Filipino
  'ang', 'ng', 'sa', 'mga', 'na', 'at', 'ay', 'ka', 'ko', 'mo', 'kayo', 'ninyo', 'nyo', 'kami', 'namin',
  'tayo', 'natin', 'sila', 'nila', 'ito', 'iyan', 'iyon', 'po', 'ba', 'para', 'kung', 'din',
  'rin', 'lang', 'ano', 'saan', 'kailan', 'sino', 'paano', 'alerto', 'sinasabi', 'sabi', 'ayon', 'nang',
  'si', 'ni', 'kay', 'nasa', 'bagyo',
  // Filipino words with the linker "-ng" glued on: "ninyong", "kayong".
  'ninyong', 'kayong', 'naming', 'nating', 'inyong', 'iyong', 'mong', 'kong',
  // Cebuano
  'og', 'ug', 'nga', 'kamo', 'mi', 'namo', 'kita', 'nato', 'kini', 'kana', 'kadto', 'kon', 'ra', 'usab',
  'unsa', 'asa', 'kanus-a', 'kinsa', 'unsaon', 'giingon', 'sumala', 'naa',
])

/** Whether a word is an everyday function word that adds no fact (see EVERYDAY_WORDS). */
export function isEverydayWord(word: string): boolean {
  return EVERYDAY_WORDS.has(wordKey(word))
}

/** Answers may add at most one word in four that isn't the alert's or everyday. */
const MAX_NEW_WORD_SHARE = 0.25

const WORD = /[\p{L}]+(?:['’-][\p{L}]+)*/gu

const words = (text: string): Span[] => findAll(text, WORD)
const wordKey = (w: string) => w.toLowerCase().replace(/’/g, "'")

/** Single venue words ("gym", "paaralan"), plus the markers of an area name. */
const VENUE_TOKENS = new Set([...VENUE_WORDS.flatMap((w) => w.split(/[\s-]+/)), 'purok', 'barangay', 'brgy'])
/** Words that start a sentence or a phrase in front of a name: "The Barangay Hall", "Sa Purok 1". */
const LEAD_WORDS = new Set(['the', 'a', 'an', 'to', 'at', 'in', 'go', 'sa', 'ang', 'mga', 'si', 'ni', 'og', 'ug'])

const isVenue = (token: string) => {
  const t = token.toLowerCase()
  return VENUE_TOKENS.has(t) || VENUE_TOKENS.has(t.replace(/e?s$/, ''))
}

/**
 * Place names in the text, by shape: a run of capitalised words, numbers and
 * venue words with only spaces between them, holding at least one venue word
 * or "Purok" or "Barangay": "Halimbawa Elementary School gym", "Purok 2",
 * "Barangay Hall", or just "gym". A word in front such as "The" is dropped.
 * The same code reads the alert and the answer, so they compare like for like.
 */
export function placeNames(text: string): Span[] {
  const tokens = findAll(text, /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)
  const isNameToken = (t: Span) => /^\p{Lu}/u.test(t.text) || /^\d+$/.test(t.text) || isVenue(t.text)
  const runs: Span[][] = []
  let run: Span[] = []
  for (const t of tokens) {
    const last = run.at(-1)
    const joined = last !== undefined && /^[ \t]+$/.test(text.slice(last.end, t.start))
    if (isNameToken(t) && (joined || run.length === 0)) run.push(t)
    else {
      if (run.length) runs.push(run)
      run = isNameToken(t) ? [t] : []
    }
  }
  if (run.length) runs.push(run)

  const names: Span[] = []
  for (const r of runs) {
    let first = 0
    while (first < r.length - 1 && LEAD_WORDS.has(r[first].text.toLowerCase())) first += 1
    const kept = r.slice(first)
    if (!kept.some((t) => isVenue(t.text))) continue
    // "the evacuation centre" names no place; the named centre is checked.
    const before = text.slice(0, kept[0].start)
    if (kept.every((t) => /^cent(?:re|er)s?$/i.test(t.text)) && /\bevacuation\s+$/i.test(before)) continue
    const start = kept[0].start
    const end = kept[kept.length - 1].end
    names.push({ start, end, text: text.slice(start, end) })
  }
  return names
}

const nameKey = (name: string) => name.toLowerCase().replace(/[\s-]+/g, ' ')

const LIST_MARKERS = /^\s*\d+\.(?=\s)/gm

/** Spans whose digits name a place, not a figure: "Purok 2", or a centre with a number in its name. */
function placeDigits(text: string): Span[] {
  return [...placeNames(text), ...findAll(text, LIST_MARKERS)]
}

const figureKey = (f: Figure) => `${f.kind}:${f.value}`

function checkAnswerFigures(answer: string, alert: AnswerAlert): Issue[] {
  const inAlert = [alert.english, alert.shown].flatMap((t) => extractFigures(t, placeDigits(t)))
  const allowed = new Set(inAlert.map(figureKey))
  const phones = new Set(inAlert.filter((f) => f.kind === 'phone').map((f) => f.value))
  return extractFigures(answer, placeDigits(answer))
    .filter((f) => !allowed.has(figureKey(f)))
    // A short hotline such as "911" reads as a plain number.
    .filter((f) => !(f.kind === 'number' && phones.has(f.value)))
    .map((f) => ({ rule: 'figures' as const, subject: f.kind, message: `“${f.span.text}” is not in your alert.`, span: f.span }))
}

/**
 * The alert's only time is the landfall time (rule 1), so an English answer
 * may say it only about landfall: "leave by 6 PM" moves it to another event.
 */
function checkAnswerTimes(answer: string): Issue[] {
  return extractFigures(answer, placeDigits(answer))
    .filter((f) => f.kind === 'time' && !LANDFALL_WORDS.test(sentenceAt(answer, f.span.start).text))
    .map((f) => ({
      rule: 'figures' as const,
      subject: 'landfall' as const,
      message: `“${f.span.text}” is when the storm makes landfall; the answer uses it for something else.`,
      span: f.span,
    }))
}

function checkAnswerPlaces(answer: string, alert: AnswerAlert): Issue[] {
  const known = new Set([alert.english, alert.shown, ...alert.names].flatMap((t) => placeNames(t).map((s) => nameKey(s.text))))
  return placeNames(answer)
    .filter((s) => !known.has(nameKey(s.text)))
    .map((span) => ({ rule: 'places' as const, subject: 'venue' as const, message: `“${span.text}” is not a place your alert names.`, span }))
}

/**
 * Claims, longest first so "walang panganib" is judged as itself: an English
 * claim word or a "do less" phrase needs the same words in the alert; a
 * Filipino or Cebuano claim word needs them in the alert the resident reads,
 * or one of its English words in the English alert.
 */
function checkAnswerClaims(answer: string, alert: AnswerAlert, options: AnswerOptions): Issue[] {
  const straight = (s: string) => s.replace(/’/g, "'")
  const text = straight(answer)
  const sources = [straight(alert.english), straight(alert.shown)]
  const inAlert = (phrase: string) => sources.some((s) => phrasePattern(straight(phrase), { plural: true }).test(s))
  type Claim = { word: string; backed: boolean; meaning?: string; plural: boolean }
  const claims: Claim[] = [
    ...[...options.claimWords, ...options.answerClaims].map((w) => ({ word: w, backed: inAlert(w), plural: true })),
    ...options.translatedClaims.flatMap((c) =>
      c.words.map((w) => ({
        word: w,
        backed:
          inAlert(w) || c.english.some((e) => e.trim() !== '' && phrasePattern(e, { plural: true }).test(straight(alert.english))),
        meaning: c.english[0],
        plural: false,
      })),
    ),
  ]
    .filter((c) => c.word.trim() !== '')
    .sort((a, b) => b.word.trim().length - a.word.trim().length)
  const taken: Span[] = []
  const issues: Issue[] = []
  for (const claim of claims) {
    for (const found of findAll(text, phrasePattern(straight(claim.word), { plural: claim.plural }))) {
      if (taken.some((t) => overlaps(found, t))) continue
      taken.push(found)
      if (claim.backed) continue
      const span = { ...found, text: answer.slice(found.start, found.end) }
      const meaning = claim.meaning ? ` (“${claim.meaning}”)` : ''
      issues.push({ rule: 'added-claims', message: `“${span.text}”${meaning} is not in your alert.`, span })
    }
  }
  return issues.sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0))
}

/**
 * Most of the answer must be the alert's own words: at most one word in four
 * may be new, not counting everyday words. A model told by the question to
 * write a poem, or that the storm is fake, writes words the alert doesn't have.
 */
function checkGrounded(answer: string, alert: AnswerAlert): Issue[] {
  const own = new Set([alert.english, alert.shown, ...alert.names].flatMap((t) => words(t).map((w) => wordKey(w.text))))
  const all = words(answer)
  const added = all.filter((w) => !own.has(wordKey(w.text)) && !EVERYDAY_WORDS.has(wordKey(w.text)))
  if (added.length <= Math.floor(all.length * MAX_NEW_WORD_SHARE)) return []
  const list = [...new Set(added.map((w) => w.text))].map((w) => `“${w}”`).join(', ')
  return [{ rule: 'answer', message: `Too many words that aren’t in your alert: ${list}.` }]
}

/**
 * Rule 8: checks an AI answer against the approved alert the resident reads.
 * Figures, place names and claims must all be in the alert, an English answer
 * says the landfall time only about landfall, most words are the alert's own,
 * and rules 4 (no placeholders) and 6 (plain, short, Latin letters) apply.
 */
export function checkAnswer(answer: string, alert: AnswerAlert, options: AnswerOptions): CheckResult {
  const english = options.language === 'en'
  const issues = [
    ...checkPlaceholders(answer),
    ...checkAnswerFigures(answer, alert),
    ...(english ? checkAnswerTimes(answer) : []),
    ...checkAnswerPlaces(answer, alert),
    ...checkAnswerClaims(answer, alert, options),
    ...checkGrounded(answer, alert),
    ...checkPlain(answer, ANSWER_MAX_SENTENCES, english ? ANSWER_MAX_WORDS.en : ANSWER_MAX_WORDS.other),
  ]
  if (answer.trim() === '') issues.unshift({ rule: 'answer', message: 'The answer is empty.' })
  return { pass: issues.length === 0, issues }
}
