import { describe, expect, it } from 'vitest'
import { hotlineNumbers } from './hotline'

describe('hotlineNumbers', () => {
  it('takes the hotline from the approved alert as written', () => {
    expect(
      hotlineNumbers('Signal No. 3 is raised over Purok Ilaya. Evacuate now to Halimbawa Elementary School gym. For help, call 0917 555 0100.'),
    ).toEqual(['0917 555 0100'])
  })

  it('finds the hotline in a Filipino translation', () => {
    expect(hotlineNumbers('Para sa tulong, tumawag sa 0917 555 0100.')).toEqual(['0917 555 0100'])
  })

  it('lists the same number once when the alert repeats it in another form', () => {
    expect(hotlineNumbers('Call 0917 555 0100. Text +63 917 555 0100 if you can’t call.')).toEqual(['0917 555 0100'])
  })

  it('does not take the landfall time or the signal number for a phone number', () => {
    expect(hotlineNumbers('Signal No. 3. Landfall at 6:00 PM on Nov 14.')).toEqual([])
  })
})
