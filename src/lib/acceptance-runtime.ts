import * as Application from 'expo-application'

// Inlined by Expo only for an explicitly launched local development session.
// No identity, account data or diagnostic UI is included in this acknowledgement.
export async function reportAcceptanceRuntime(
  encoded = process.env.EXPO_PUBLIC_METVAGE_ACCEPTANCE_PROOF
) {
  if (!__DEV__ || !encoded) return
  let proof: { url: string; nonce: string; source: string }
  try {
    proof = JSON.parse(encoded)
  } catch {
    return
  }
  if (
    !proof ||
    typeof proof !== 'object' ||
    typeof proof.url !== 'string' ||
    typeof proof.nonce !== 'string' ||
    typeof proof.source !== 'string' ||
    !/^http:\/\/localhost:\d+\/proof$/.test(proof.url) ||
    !/^[a-f0-9]{32}$/.test(proof.nonce) ||
    !/^[a-f0-9]{64}$/.test(proof.source)
  )
    return
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(proof.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce: proof.nonce,
        source: proof.source,
        package: Application.applicationId,
      }),
      signal: controller.signal,
    })
  } catch {
    // A failed or stale acknowledgement keeps the external runner closed.
  } finally {
    clearTimeout(timeout)
  }
}
