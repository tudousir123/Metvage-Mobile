import { act } from 'react'

/** Wait for an observable result while React processes scheduled query updates. */
export async function waitForState(assertion, { timeout = 1000 } = {}) {
  const deadline = performance.now() + timeout
  let failure
  do {
    try {
      assertion()
      return
    } catch (error) {
      failure = error
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  } while (performance.now() < deadline)
  throw failure
}
