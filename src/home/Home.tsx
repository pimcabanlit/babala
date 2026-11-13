import type { ReactNode } from 'react'
import { PATHS } from '../route'
import { ButtonLink } from '../ui/Button'
import Icon, { type IconName } from '../ui/Icon'

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
      <main className="flex-1">
        <section className="bg-brand text-on-brand">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-10 sm:py-16 lg:grid-cols-[1fr_22rem]">
            <div>
              <h1 className="text-headline-lg font-bold sm:text-display-sm">
                When the signal drops, warnings <span className="text-highlight-on-brand">shouldn’t.</span>
              </h1>
              <p className="mt-4 max-w-xl text-body-lg text-on-brand-variant">
                Babala turns a storm bulletin into a checked, plain-language typhoon alert for each household, and keeps it
                on residents’ phones for when the network goes down.
              </p>
            </div>
            <AlertIllustration />
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4">
          <section aria-labelledby="views-title" className="py-10">
            <h2 id="views-title" className="text-headline-sm">
              Choose your view
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ViewCard
                icon="smartphone"
                title="I’m a resident"
                text="See your purok’s typhoon alert in plain words. It’s saved on your phone, so it opens with no signal."
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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-body-md text-on-surface-variant">
          <p>Demo, not official guidance. The storm and barangay are fictional.</p>
          <a className="font-medium text-primary underline underline-offset-2" href={REPO}>
            Source code on GitHub
          </a>
        </div>
      </footer>
    </>
  )
}

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
    <div className="flex flex-col rounded-lg border border-outline-variant bg-surface-container-lowest p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <Icon name={icon} className="size-6" />
      </span>
      <h3 className="mt-4 text-title-lg">{title}</h3>
      <p className="mt-2 text-body-lg text-on-surface-variant">{text}</p>
      {note && <p className="mt-3 text-body-md text-on-surface-variant">{note}</p>}
      {/* mt-auto keeps both cards' buttons on one line when their texts differ in length. */}
      <div className="mt-auto pt-6">{children}</div>
    </div>
  )
}

/**
 * A picture of what a resident's phone shows, with no signal number or
 * instruction in it: a made-up warning on the front page could pass for a real
 * one (docs/build-plan.md, Phase 4, change 4). Hidden on phones, where it
 * would push the two ways in below the fold.
 */
function AlertIllustration() {
  return (
    <figure className="mx-auto hidden w-full max-w-xs sm:block lg:max-w-none">
      <div aria-hidden="true" className="overflow-hidden rounded-xl bg-surface-container-lowest text-on-surface shadow-lg">
        <div className="flex items-center gap-2 bg-error px-5 py-3 text-on-error">
          <Icon name="warning" />
          <span className="text-title-sm">Typhoon Sample</span>
        </div>
        <div className="space-y-2.5 px-5 py-5">
          <div className="h-3 w-full rounded-full bg-surface-container-highest" />
          <div className="h-3 w-11/12 rounded-full bg-surface-container-highest" />
          <div className="h-3 w-4/5 rounded-full bg-surface-container-highest" />
          <div className="h-3 w-2/3 rounded-full bg-surface-container-highest" />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-outline-variant px-5 py-3 text-label-md text-on-surface-variant">
          <span className="inline-flex items-center gap-1">
            <Icon name="fact_check" className="size-4" />
            Checked by code
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="wifi_off" className="size-4" />
            Opens with no signal
          </span>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-body-sm text-on-brand-variant">
        Demo: Typhoon Sample over Barangay Halimbawa
      </figcaption>
    </figure>
  )
}
