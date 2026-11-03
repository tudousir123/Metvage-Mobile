/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { RecordInteractions } from '../src/components/records/record-interactions'
import { commentOnRecord } from '../src/lib/interactions'

let mockInput
let mockComments = []
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('../src/state/AuthProvider', () => ({
  useAuth: () => ({ user: { server: 'pets.example', token: 'test-token' } }),
}))
jest.mock('../src/lib/pets', () => ({
  getPets: async () => ({ current_pet_id: 3, pets: [{ id: 3, nickname: '豆包' }] }),
}))
jest.mock('../src/lib/interactions', () => ({
  getRecordInteractions: async () => ({ likes: [], comments: mockComments }),
  newCommentRequestId: () => `comment-${Math.random()}`,
  commentOnRecord: jest.fn(),
  deleteRecordComment: jest.fn(),
  likeRecord: jest.fn(),
  unlikeRecord: jest.fn(),
}))
jest.mock('react-native', () => ({
  ActivityIndicator: () => null,
  Pressable: ({ children, onPress, disabled }) => (
    <button type="button" onClick={onPress} disabled={disabled}>
      {children}
    </button>
  ),
  Text: ({ children }) => <span>{children}</span>,
  TextInput: (props) => {
    mockInput = props
    return (
      <textarea
        aria-label={props.accessibilityLabel}
        value={props.value}
        readOnly={props.editable === false}
        onChange={() => {}}
      />
    )
  },
  View: ({ children }) => <div>{children}</div>,
}))

let container
let root
let client
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
}
const send = () =>
  [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '发送评论'
  )
function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  mockComments = []
  jest.clearAllMocks()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <RecordInteractions recordId={12} visibility="public" />
      </QueryClientProvider>
    )
  )
  await flush()
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
})

test('one send action is in flight even if the still-enabled button receives rapid taps', async () => {
  const pending = deferred()
  commentOnRecord.mockReturnValue(pending.promise)
  await act(async () => mockInput.onChangeText('键盘打开时也要发送'))
  const button = send()
  await act(async () => {
    button.click()
    button.click()
  })
  expect(commentOnRecord).toHaveBeenCalledTimes(1)
  expect(commentOnRecord).toHaveBeenCalledWith(
    12,
    '键盘打开时也要发送',
    expect.any(String)
  )
  expect(mockInput.editable).toBe(false)
  await act(async () => pending.resolve({}))
  await flush()
  expect(mockInput.value).toBe('')
})

test('one tap retries a failed comment without changing its key or losing the text', async () => {
  commentOnRecord.mockRejectedValueOnce(new Error('网络暂不可用'))
  await act(async () => mockInput.onChangeText('保留失败后的评论'))
  await act(async () => send().click())
  await flush()
  expect(container.textContent).toContain('网络暂不可用')
  expect(mockInput.value).toBe('保留失败后的评论')
  expect(mockInput.editable).toBe(true)
  commentOnRecord.mockImplementationOnce(async (_, text) => {
    mockComments = [
      { id: 7, text, actor_pet: { id: 3, nickname: '豆包' }, can_delete: true },
    ]
    return { comment: mockComments[0] }
  })
  await act(async () => send().click())
  await flush()
  expect(commentOnRecord).toHaveBeenCalledTimes(2)
  expect(commentOnRecord.mock.calls[0]).toEqual(commentOnRecord.mock.calls[1])
  expect(mockInput.value).toBe('')
  expect(container.textContent).toContain('1 条评论')
  expect(container.textContent).toContain('保留失败后的评论')
})

test('empty and whitespace-only comments do not send a request', async () => {
  expect(send().disabled).toBe(true)
  await act(async () => mockInput.onChangeText('   '))
  await act(async () => send().click())
  expect(commentOnRecord).not.toHaveBeenCalled()
})
