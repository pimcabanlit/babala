import { useEffect, useState, type FormEvent } from 'react'
import { QUESTION_MAX } from '../ask/prompt'
import type { AiRoute } from '../ask/route'
import type { AskOutcome, Try } from '../ask/run'
import { searchAlert } from '../ask/search'
import { formatTime } from '../console/format'
import type { Language } from './pack'
import { useAsk, type AskSetup } from './useAsk'

/** Example questions in the language the resident reads the alert in. */
const EXAMPLES: Record<Language, string[]> = {
  en: ['Where do we go?', 'When does the storm make landfall?', 'What number do we call?'],
  fil: ['Saan kami pupunta?', 'Kailan tatama ang bagyo?', 'Anong numero ang tatawagan?'],
  ceb: ['Asa mi moadto?', 'Kanus-a motugpa ang bagyo?', 'Unsang numero ang tawagan?'],
}

const ROUTE_LABEL: Record<AiRoute | 'search', string> = {
  on_device: 'AI on this device',
  cloud: 'AI in the cloud',
  search: 'No AI: text search of the saved alert',
}

const BADGE: Record<AiRoute | 'search', string> = {
  on_device: 'bg-emerald-100 text-emerald-900',
  cloud: 'bg-sky-100 text-sky-900',
  search: 'bg-slate-200 text-slate-900',
}

type Props = {
  setup: AskSetup
  online: boolean
  /** The approved English alert, the text the resident reads, its language, and the storm and area names. */
  english: string
  shown: string
  language: Language
  names: string[]
}

/**
 * "Ask about your alert": a question box under the resident's alert. Each
 * answer comes from one of three routes (on the device, in the cloud, or a
 * text search with no AI), says which, and quotes the alert sentences it
 * rests on. An AI answer is shown only after the code check passes it.
 */
export default function Ask({ setup, online, english, shown, language, names }: Props) {
  const { state, ask, planFor, cloudLeft, cloudBackAtMs } = useAsk(setup, online)
  const [question, setQuestion] = useState('')
  const running = state.kind === 'running'
  const next = planFor(question, language)
  const nextRoute = next.tries[0] ?? 'search'

  const submit = (text: string) => {
    const q = text.trim()
    if (q === '' || running) return
    setQuestion(q)
    void ask({ question: q, alert: { english, shown, names }, language })
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(question)
  }

  return (
    <section aria-labelledby="ask-title" className="mt-4 border-t border-slate-200 pt-4">
      <h3 id="ask-title" className="text-base font-bold">
        Ask about your alert
      </h3>
      <form className="mt-2 flex gap-2" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="ask-question">
          Your question
        </label>
        <input
          id="ask-question"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white p-2 text-base"
          value={question}
          maxLength={QUESTION_MAX}
          placeholder={EXAMPLES[language][0]}
          lang={language}
          autoComplete="off"
          onFocus={setup.warmUp}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
          disabled={running || question.trim() === ''}
        >
          Ask
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES[language].map((example) => (
          <button
            key={example}
            type="button"
            lang={language}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-50"
            disabled={running}
            onClick={() => submit(example)}
          >
            {example}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {!running && <>Answers now: {ROUTE_LABEL[nextRoute]}. </>}
        {online && setup.configured && (
          <>
            {cloudLeft > 0
              ? `${cloudLeft} cloud answer${cloudLeft === 1 ? '' : 's'} left this hour on this phone. `
              : `No cloud answers left this hour${cloudBackAtMs ? `; more from ${formatTime(new Date(cloudBackAtMs))}` : ''}. `}
          </>
        )}
        Questions aren’t saved. A cloud answer sends your question to Google’s Gemini, so leave out names and personal details.
      </p>

      {state.kind === 'running' && <Running route={state.route} startedAt={state.startedAt} />}
      {state.kind === 'done' && <Outcome question={state.question} outcome={state.outcome} shown={shown} language={language} />}
    </section>
  )
}

function Running({ route, startedAt }: { route: AiRoute | 'search'; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000))
  return (
    <p className="mt-3 rounded bg-slate-100 p-3 text-sm" role="status">
      Answering with {ROUTE_LABEL[route].toLowerCase()}… {seconds} s
      {route === 'on_device' && ' (the first answer on this device can take about 30 s)'}
    </p>
  )
}

/** What happened on a route that didn't answer, in one line. */
function tryText(t: Try): string {
  const where = t.route === 'on_device' ? 'The on-device AI' : 'The cloud AI'
  switch (t.outcome) {
    case 'slow':
      return `${where} took longer than ${t.seconds} s, so the phone stopped waiting.`
    case 'unreadable':
      return `${where} answered in a form the app couldn’t read.`
    case 'held':
      return `${where}’s answer was held back by the code check: ${t.issues.slice(0, 3).map((i) => i.message).join(' ')}`
    case 'error':
      return /\b429\b|quota|resource.?exhausted|too many/i.test(t.error)
        ? `${where} is busy right now. Try again shortly.`
        : `${where} didn’t answer: ${shortError(t.error)}`
  }
}

/** The SDK's error without the request URL, short enough for a phone. */
function shortError(error: string): string {
  const text = error.replace(/Error fetching from \S+?:(?=\s)/, '').replace(/\s+/g, ' ').trim()
  return text.length > 160 ? `${text.slice(0, 159)}…` : text
}

function Outcome({ question, outcome, shown, language }: { question: string; outcome: AskOutcome; shown: string; language: Language }) {
  const route = outcome.kind === 'search' ? 'search' : outcome.route
  const hotline = searchAlert(shown, 'hotline call')
  const notes = [...outcome.tries.map(tryText), ...(outcome.kind === 'search' && outcome.reason ? [outcome.reason] : [])]
  return (
    <div className="mt-3 rounded border border-slate-300 bg-white p-3" aria-live="polite">
      <p>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${BADGE[route]}`}>{ROUTE_LABEL[route]}</span>
      </p>
      <p className="mt-2 text-sm text-slate-600" lang={language}>
        You asked: “{question}”
      </p>
      {outcome.kind === 'answer' && (
        <>
          <p className="mt-2 text-lg" lang={language}>
            {outcome.answer}
          </p>
          <Quotes label="From your alert, word for word:" quotes={outcome.quotes} language={language} />
          <p className="mt-2 text-xs text-slate-600">
            Written by AI and checked by code against your alert: same figures and places, nothing added. The barangay didn’t
            write this answer; follow the alert itself.
          </p>
        </>
      )}
      {outcome.kind === 'not-in-alert' && (
        <>
          <p className="mt-2">Your alert doesn’t answer that. For anything it doesn’t cover, ask your barangay.</p>
          {hotline.found && <Quotes label="From your alert:" quotes={hotline.sentences} language={language} />}
        </>
      )}
      {outcome.kind === 'search' &&
        (outcome.result.found ? (
          <Quotes label="The part of your alert that matches, word for word:" quotes={outcome.result.sentences} language={language} />
        ) : (
          <>
            <p className="mt-2">Nothing in your alert matches that question. Read the whole alert above, or ask your barangay.</p>
            {hotline.found && <Quotes label="From your alert:" quotes={hotline.sentences} language={language} />}
          </>
        ))}
      {notes.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Quotes({ label, quotes, language }: { label: string; quotes: string[]; language: Language }) {
  return (
    <figure className="mt-2">
      <figcaption className="text-sm font-semibold text-slate-700">{label}</figcaption>
      <blockquote className="mt-1 border-l-4 border-red-700 pl-3 text-base" lang={language}>
        {quotes.join(' ')}
      </blockquote>
    </figure>
  )
}
