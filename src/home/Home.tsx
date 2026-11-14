import type { ReactNode } from 'react'
import { PATHS } from '../route'
import { useOfflineApp } from '../offline/useOfflineApp'
import AppBar from '../ui/AppBar'
import { ButtonLink } from '../ui/Button'
import Icon, { type IconName } from '../ui/Icon'
import { TITLE, WIDTH } from '../ui/layout'

const REPO = 'https://github.com/pimcabanlit/babala'

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'computer',
    title: 'Drafted on the laptop',
    text: 'Gemini Nano writes an alert for each household from the storm bulletin, on the officer’s laptop, with the cloud as a fallback.',
  },
  {
    icon: 'fact_check',
    title: 'Checked by code',
    text: 'Every figure and place is checked against the bulletin. Nothing goes out until it passes and an officer approves it.',
  },
  {
    icon: 'smartphone',
    title: 'Kept on the phone',
    text: 'Residents’ phones save the approved alert and its translations, so it opens and answers questions with no signal.',
  },
]

/**
 * The home page at /: what Babala is, and the way into each view. It loads no
 * Firebase, so a judge's first look is quick and costs no App Check token.
 */
export default function Home() {
  return (
    <>
      <AppBar home title={TITLE.home}>
        <OfflinePill />
      </AppBar>
      <main className="flex-1">
        <section className="overflow-hidden bg-brand text-on-brand">
          {/* On a laptop the padding and headline follow the window's height, so the two ways in below fit on the first screen. */}
          <div className={`relative mx-auto ${WIDTH.home} px-4 py-10 sm:py-12 lg:py-[clamp(1.25rem,4.5vh,4rem)]`}>
            <SignalLines />
            <h1 className="relative text-headline-lg font-bold sm:text-display-sm lg:text-[length:min(3.5rem,max(2.5rem,1.25rem_+_2vw),7.5vh)] lg:leading-[1.15]">
              When the signal drops,
              {/* Breaks after the comma from a tablet up, so each line is one thought. */}
              <br className="max-sm:hidden" /> warnings <span className="text-highlight-on-brand">shouldn’t.</span>
            </h1>
            <p className="relative mt-4 max-w-xl text-body-lg text-on-brand-variant lg:max-w-2xl lg:text-title-lg">
              Babala turns a storm bulletin into a checked, plain-language typhoon alert for each household, and keeps it on
              residents’ phones for when the network goes down.
            </p>
          </div>
        </section>

        <div className={`mx-auto px-4 ${WIDTH.home}`}>
          <section aria-labelledby="views-title" className="py-10 lg:pt-[clamp(1rem,3vh,2.5rem)] lg:pb-8">
            <h2 id="views-title" className="text-headline-sm">
              Choose your view
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:mt-3">
              <ViewCard
                icon="smartphone"
                title="I’m a resident"
                text="See your purok’s typhoon alert in plain words. It’s saved on your phone, so it opens with no signal."
                note="No sign-in. Works in any phone browser."
              >
                <ButtonLink variant="tonal" href={PATHS.resident}>
                  View alerts
                </ButtonLink>
              </ViewCard>
              <ViewCard
                icon="computer"
                title="I’m a barangay officer"
                text="Turn a storm bulletin into alerts for each household, then check and approve them."
                note="Judges: sign in with the test officer account from the testing instructions."
              >
                <ButtonLink variant="filled" href={PATHS.officer}>
                  Open workspace
                </ButtonLink>
              </ViewCard>
            </div>
          </section>

          <section aria-labelledby="how-title" className="border-t border-outline-variant py-10 lg:pt-6">
            <h2 id="how-title" className="text-headline-sm">
              How it works
            </h2>
            <ol className="mt-6 grid gap-6 md:grid-cols-3 lg:mt-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                    <Icon name={step.icon} />
                  </span>
                  <div>
                    <h3 className="text-title-md">
                      <span className="sr-only">Step {i + 1}: </span>
                      {step.title}
                    </h3>
                    <p className="mt-1 text-body-md text-on-surface-variant">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <footer className="border-t border-outline-variant">
        <div className={`mx-auto flex ${WIDTH.home} flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-body-md text-on-surface-variant`}>
          <p>Demo, not official guidance. The storm and barangay are fictional.</p>
          <a className="font-medium text-primary underline underline-offset-2" href={REPO}>
            Source code on GitHub
          </a>
        </div>
      </footer>
    </>
  )
}

/**
 * One way in. On a phone and a tablet the button sits under the text; on a
 * laptop it moves up beside the title, which keeps both cards short enough
 * to show under the hero without scrolling.
 */
function ViewCard({
  icon,
  title,
  text,
  note,
  children,
}: {
  icon: IconName
  title: string
  text: string
  note?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col rounded-lg border border-outline-variant bg-surface-container-lowest p-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-x-4 lg:p-5">
      <div className="flex items-center gap-4 lg:contents">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Icon name={icon} className="size-6" />
        </span>
        <h3 className="text-title-lg">{title}</h3>
      </div>
      <p className="mt-4 text-body-lg text-on-surface-variant lg:col-span-3 lg:mt-3">{text}</p>
      {note && <p className="mt-3 text-body-md text-on-surface-variant lg:col-span-3 lg:mt-1">{note}</p>}
      {/* mt-auto keeps both cards' buttons on one line when their texts differ in length. */}
      <div className="mt-auto pt-6 lg:col-start-3 lg:row-start-1 lg:mt-0 lg:pt-0">{children}</div>
    </div>
  )
}

/**
 * Faint rings, as from a signal source, solid near it and broken further out,
 * to balance the headline on a laptop. Decoration only: *How it works* says
 * what Babala does, so the hero needs no second picture of it.
 */
function SignalLines() {
  const rings = [56, 104, 152, 200, 248, 296, 344]
  return (
    // The fade keeps the rings from ending in a hard line at the app bar and the page.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)] lg:block"
    >
      <svg
        viewBox="0 0 400 400"
        className="absolute top-1/2 right-0 h-[150%] max-h-[32rem] -translate-y-1/2 overflow-visible text-on-brand-variant"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="300" cy="200" r="6" fill="currentColor" stroke="none" opacity="0.25" />
        {rings.map((r, i) => (
          <circle
            key={r}
            cx="300"
            cy="200"
            r={r}
            strokeWidth="1.5"
            opacity={0.22 - i * 0.025}
            strokeDasharray={i < 3 ? undefined : `${14 - i * 1.5} ${6 + i * 3}`}
          />
        ))}
      </svg>
    </div>
  )
}

/** Tells a first-time visitor the app now opens with no signal, once the service worker has saved it. */
function OfflinePill() {
  const app = useOfflineApp()
  // The dev server and browsers without service workers can't save the app; the resident page explains why.
  if (app.state === 'unavailable') return null
  const ready = app.state === 'ready'
  return (
    <p role="status" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-on-brand-variant/50 px-3 text-label-lg">
      <Icon name={ready ? 'check_circle' : 'cloud'} className="size-[18px]" />
      {ready ? 'Offline ready' : 'Saving for offline…'}
    </p>
  )
}
