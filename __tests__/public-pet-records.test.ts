import { getPublicPetRecords } from '../src/lib/metvage-public'
import { metvageApi, metvageRequest } from '../src/lib/metvage-request'
import { getPetTimeline, type PetRecord } from '../src/lib/records'

jest.mock('../src/lib/metvage-request', () => ({
  metvageRequest: jest.fn(),
  metvageApi: jest.fn(),
}))

const publicRequest = jest.mocked(metvageRequest)
const ownerRequest = jest.mocked(metvageApi)
const pet = { id: 7, nickname: 'U1Cat', species: 'cat' as const, bio: null }
const publicRecord: PetRecord = {
  id: 11,
  pet_id: pet.id,
  pet,
  title: '公开故事',
  text: '在阳光下打盹',
  photos: [],
  visibility: 'public',
  created_at: '2026-11-03T10:00:00Z',
  published_at: '2026-11-03T10:00:00Z',
}
const privateRecord: PetRecord = {
  ...publicRecord,
  id: 12,
  title: null,
  text: 'U1 cat private record',
  visibility: 'private',
  published_at: null,
}

beforeEach(() => jest.clearAllMocks())

test('the owner sees only public notes on a public pet profile but keeps private notes in their own timeline', async () => {
  const ownerTimeline = { records: [privateRecord, publicRecord] }
  publicRequest.mockResolvedValueOnce(ownerTimeline)
  ownerRequest.mockResolvedValueOnce(ownerTimeline)

  await expect(getPublicPetRecords(pet.id)).resolves.toEqual({ records: [publicRecord] })
  await expect(getPetTimeline(pet.id)).resolves.toEqual(ownerTimeline)
  // Public views remain authenticated when possible, preserving account block rules.
  expect(publicRequest).toHaveBeenCalledWith('/api/v1/metvage/pets/7/records', {
    origin: 'configured',
    auth: 'optional',
  })
})

test('a private-only owner timeline produces an empty public profile', async () => {
  publicRequest.mockResolvedValueOnce({ records: [privateRecord] })

  await expect(getPublicPetRecords(pet.id)).resolves.toEqual({ records: [] })
})

test('a rejected public-profile read stays rejected instead of falling back to a guest read', async () => {
  const blocked = new Error('This pet is unavailable')
  publicRequest.mockRejectedValueOnce(blocked)

  await expect(getPublicPetRecords(pet.id)).rejects.toBe(blocked)
  expect(publicRequest).toHaveBeenCalledTimes(1)
  expect(ownerRequest).not.toHaveBeenCalled()
})
