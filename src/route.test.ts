import { describe, expect, it } from 'vitest'
import { pageFor } from './route'

describe('pageFor', () => {
  it('opens the home page at the root', () => {
    expect(pageFor('/')).toBe('home')
  })

  it('opens the home page at /index.html, which Hosting also serves', () => {
    expect(pageFor('/index.html')).toBe('home')
  })

  it('opens the resident view at /resident, the installed app’s start page', () => {
    expect(pageFor('/resident')).toBe('resident')
  })

  it('opens the resident view below /resident', () => {
    expect(pageFor('/resident/')).toBe('resident')
  })

  it('opens the officer workspace at /officer', () => {
    expect(pageFor('/officer')).toBe('officer')
  })

  it('opens the officer workspace below /officer', () => {
    expect(pageFor('/officer/')).toBe('officer')
  })

  it('does not take a longer word that starts with a page’s name for that page', () => {
    expect(pageFor('/residents')).toBe('not-found')
  })

  it('sends any other path to the not-found page', () => {
    expect(pageFor('/console')).toBe('not-found')
  })
})
