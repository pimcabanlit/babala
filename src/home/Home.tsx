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
        <section className="bg-brand text-on-brand">
          {/* On a laptop the padding and headline follow the window's height, so the two ways in below fit on the first screen. */}
          <div
            className={`mx-auto grid ${WIDTH.home} items-center gap-10 px-4 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-16 lg:py-[clamp(1rem,4vh,5rem)]`}
          >
            <div>
              <h1 className="text-headline-lg font-bold sm:text-display-sm lg:text-[length:min(3.5rem,max(2.5rem,1.25rem_+_2vw),7.5vh)] lg:leading-[1.15]">
                When the signal drops, warnings <span className="text-highlight-on-brand">shouldn’t.</span>
              </h1>
              <p className="mt-4 max-w-xl text-body-lg text-on-brand-variant lg:max-w-2xl lg:text-title-lg">
                Babala turns a storm bulletin into a checked, plain-language typhoon alert for each household, and keeps it
                on residents’ phones for when the network goes down.
              </p>
            </div>
            <AlertIllustration />
          </div>
        </section>

        <div className={`mx-auto px-4 ${WIDTH.home}`}>
          <section aria-labelledby="views-title" className="py-10 lg:pt-[clamp(1rem,3vh,2.5rem)]">
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

          <section aria-labelledby="how-title" className="border-t border-outline-variant py-10">
            <h2 id="how-title" className="text-headline-sm">
              How it works
            </h2>
            <ol className="mt-6 grid gap-6 md:grid-cols-3">
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

const JOURNEY: { icon: IconName; text: string; chip: string }[] = [
  { icon: 'computer', text: 'Drafted on the laptop', chip: 'Gemini Nano' },
  { icon: 'fact_check', text: 'Every figure checked', chip: 'Code, not AI' },
  { icon: 'check_circle', text: 'Approved by an officer', chip: 'Signed in' },
  { icon: 'smartphone', text: 'Saved on residents’ phones', chip: 'Opens offline' },
]

/**
 * One alert's way from the bulletin to a phone, as a card. It holds no signal
 * number or instruction: a made-up warning on the front page could pass for a
 * real one (docs/build-plan.md, Phase 4, change 4), so it is marked "Demo".
 * One line per row keeps it short enough for the two ways in to fit under
 * it. Hidden on phones, where *How it works* says the same.
 */
function AlertIllustration() {
  return (
    <div aria-hidden="true" className="mx-auto hidden w-full max-w-md overflow-hidden rounded-xl bg-surface-container-lowest text-on-surface shadow-lg sm:block lg:max-w-none">
      <div className="flex items-center gap-2 bg-error px-5 py-2 text-on-error">
        <Icon name="warning" />
        <span className="flex-1 text-title-sm">Typhoon Sample · Purok Ilaya</span>
        <span className="rounded-sm border border-on-error/70 px-2 text-label-md">Demo</span>
      </div>
      <ol className="px-5 py-2.5">
        {JOURNEY.map((step, i) => (
          <li key={step.text} className="relative flex items-center gap-3 py-1">
            {i < JOURNEY.length - 1 && <span className="absolute top-1/2 left-4 h-full w-px bg-outline-variant" />}
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <Icon name={step.icon} className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1 text-body-md">{step.text}</span>
            <span className="shrink-0 rounded-sm bg-surface-container-high px-2 py-0.5 text-label-md text-on-surface-variant">{step.chip}</span>
          </li>
        ))}
      </ol>
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
