/**
 * The no-AI route: a plain text search of the alert saved on the phone. It
 * quotes the alert's own sentences, word for word, so it can't say anything
 * the barangay didn't approve. It runs offline, with no model, in English,
 * Filipino or Cebuano.
 */
import { LANDFALL_WORDS, extractFigures, isEverydayWord, phrasePattern, placeNames, sentences } from '../checker'

export type Topic = 'where' | 'when' | 'signal' | 'call' | 'todo'

/** Question words for each topic, in English, Filipino and Cebuano. Plurals match. */
const TOPIC_WORDS: Record<Topic, string[]> = {
  where: [
    'where', 'go', 'evacuate', 'evacuation', 'centre', 'center', 'shelter', 'place',
    'saan', 'pupunta', 'punta', 'pumunta', 'lumikas', 'likas', 'paglikas',
    'asa', 'adto', 'moadto', 'mobakwit', 'bakwit', 'pagbakwit',
  ],
  when: [
    'when', 'what time', 'time', 'landfall', 'arrive', 'hit', 'come', 'coming', 'date',
    'kailan', 'oras', 'anong oras', 'tatama', 'darating', 'dating',
    'kanus-a', 'unsang orasa', 'motugpa', 'moabot', 'abot',
  ],
  signal: ['signal', 'warning', 'level', 'strong', 'strength', 'lakas', 'kalakas', 'kusog'],
  call: [
    'call', 'hotline', 'number', 'phone', 'contact', 'help', 'emergency',
    'tawag', 'tumawag', 'tawagan', 'numero', 'tulong', 'telepono', 'tabang',
  ],
  todo: [
    'what to do', 'what do', 'should', 'bring', 'pack', 'prepare', 'take', 'medicine', 'water', 'food', 'children', 'kids', 'boat', 'sea', 'fish',
    'fishing', 'leave', 'neighbour', 'neighbor',
    'gawin', 'dalhin', 'magdala', 'dala', 'gamot', 'tubig', 'pagkain', 'anak', 'bata', 'bangka', 'dagat', 'umalis',
    'buhaton', 'dad-a', 'tambal', 'pagkaon', 'sakayan', 'baroto', 'mobiya', 'pangisda',
  ],
}

/** Words that tell a resident what to do, in the alert's three languages. */
const ACTION_WORDS =
  /\b(?:leave|evacuate|go|bring|keep|ask|tie|do not|don’t|don't|lumikas|umalis|pumunta|dalhin|magdala|panatilihin|huwag|itali|bakwit|mobakwit|adto|dad-a|dad-on|ayaw|higti|biya)\b/i

/** Words that tell a resident where to go. */
const GO_WORDS = /\b(?:evacuate|go to|lumikas|pumunta|bakwit|mobakwit|adto|moadto)\b/i

/** The topics one alert sentence covers, read from its figures, names and words. */
export function sentenceTopics(sentence: string): Set<Topic> {
  const topics = new Set<Topic>()
  const figures = extractFigures(sentence, placeNames(sentence))
  const centre = placeNames(sentence).some((p) => !/^(?:purok|barangay|brgy)\b/i.test(p.text) || /\bhall\b/i.test(p.text))
  if (centre || GO_WORDS.test(sentence)) topics.add('where')
  if (figures.some((f) => f.kind === 'time' || f.kind === 'date') || LANDFALL_WORDS.test(sentence)) topics.add('when')
  if (figures.some((f) => f.kind === 'signal')) topics.add('signal')
  if (figures.some((f) => f.kind === 'phone') || /\bhotline\b/i.test(sentence)) topics.add('call')
  if (ACTION_WORDS.test(sentence)) topics.add('todo')
  return topics
}

/** The topics a question asks about. */
export function questionTopics(question: string): Set<Topic> {
  const topics = new Set<Topic>()
  for (const [topic, words] of Object.entries(TOPIC_WORDS) as [Topic, string[]][])
    if (words.some((w) => phrasePattern(w, { plural: true }).test(question))) topics.add(topic)
  return topics
}

const contentWords = (text: string) =>
  new Set(
    [...text.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)]
      .map((m) => m[0].toLowerCase())
      .filter((w) => w.length > 2 && !isEverydayWord(w)),
  )

export type SearchResult =
  /** The sentences that answer the question, quoted word for word, in alert order. */
  | { found: true; sentences: string[] }
  /** Nothing in the alert matches. */
  | { found: false }

/** At most this many sentences are quoted; the alert has three. */
const MAX_QUOTED = 2
/** A topic match counts this much; each shared word counts 1. */
const TOPIC_SCORE = 3
const MIN_SCORE = 2

/**
 * Scores each sentence of the alert against the question: a shared topic
 * (where, when, signal, call, what to do) scores 3, and each shared word 1.
 * Returns the best one or two sentences, or nothing if none scores 2.
 */
export function searchAlert(alert: string, question: string): SearchResult {
  const asked = questionTopics(question)
  const askedWords = contentWords(question)
  const scored = sentences(alert).map((s, index) => {
    const topics = sentenceTopics(s.text)
    const shared = [...contentWords(s.text)].filter((w) => askedWords.has(w)).length
    const score = [...asked].filter((t) => topics.has(t)).length * TOPIC_SCORE + shared
    return { text: s.text, index, score }
  })
  const best = Math.max(0, ...scored.map((s) => s.score))
  if (best < MIN_SCORE) return { found: false }
  const picked = scored
    .filter((s) => s.score >= MIN_SCORE && s.score >= best - TOPIC_SCORE + 1)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_QUOTED)
    .sort((a, b) => a.index - b.index)
  return { found: true, sentences: picked.map((s) => s.text) }
}
