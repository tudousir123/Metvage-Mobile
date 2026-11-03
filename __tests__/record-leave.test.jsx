/** @jest-environment jsdom */
import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  StackRouter,
  useNavigationBuilder,
} from '@react-navigation/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Alert } from 'react-native'
import EditRecordScreen from '../src/app/(auth)/records/[id]/edit'
import NewRecordScreen from '../src/app/(auth)/records/new'
import { loadRecordDraft, saveRecordDraft } from '../src/lib/record-drafts'
import { createPetRecord, deletePetRecord, updatePetRecord } from '../src/lib/records'

let mockNavigation
let mockFields
let mockPage
let mockSubmit
let mockMode = 'new'
function mockNavigateTo(type, href) {
  const petId = /^\/pets\/(\d+)\/records$/.exec(href)?.[1]
  mockNavigation.dispatch({
    type,
    payload: petId ? { name: 'Timeline', params: { petId } } : { name: 'Home' },
  })
}
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '12', mode: 'public' }),
  router: {
    canGoBack: () => mockNavigation.canGoBack(),
    back: () => mockNavigation.goBack(),
    replace: (href) => mockNavigateTo('REPLACE', href),
    dismissTo: (href) => mockNavigateTo('POP_TO', href),
  },
}))
jest.mock('../src/state/AuthProvider', () => ({
  useAuth: () => ({
    user: { server: 'pets.example', token: 'test-token' },
    userCache: { id: 'owner' },
  }),
}))
jest.mock('@expo/vector-icons/Feather', () => () => null)
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }))
jest.mock('../src/lib/pets', () => ({
  getPets: async () => ({
    current_pet_id: 3,
    pets: [
      { id: 3, nickname: '豆包' },
      { id: 4, nickname: '奶糖' },
    ],
  }),
}))
jest.mock('../src/lib/records', () => ({
  getPetRecord: async () => ({
    record: {
      id: 12,
      pet_id: 3,
      text: '原记录',
      title: '散步',
      visibility: 'public',
      photos: [{ id: 20, url: '/photo.jpg' }],
    },
  }),
  createPetRecord: jest.fn(),
  updatePetRecord: jest.fn(),
  deletePetRecord: jest.fn(),
  recordPhotoUrl: (url) => url,
}))
jest.mock('../src/lib/record-drafts', () => ({
  loadRecordDraft: jest.fn(async () => null),
  saveRecordDraft: jest.fn(async (_, draft) => draft),
  discardRecordDraft: jest.fn(async () => {}),
}))
// Replace only presentation: the real route owns the form, mutations, and navigation guard.
jest.mock('../src/components/records/record-composer', () => ({
  ComposerPage: (props) => {
    mockPage = props
    return (
      <>
        {props.children}
        {props.footer}
      </>
    )
  },
  ComposerFields: (props) => {
    mockFields = props
    return null
  },
  ComposerSubmit: (props) => {
    if (props.title !== '恢复草稿') mockSubmit = props
    return null
  },
}))
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  ActivityIndicator: () => null,
  Pressable: ({ children, onPress, disabled }) => (
    <button type="button" onClick={onPress} disabled={disabled}>
      {children}
    </button>
  ),
  Text: ({ children }) => <span>{children}</span>,
  View: ({ children }) => <div>{children}</div>,
  Platform: { OS: 'android', select: (options) => options.android ?? options.default },
}))

function TestNavigator(props) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    StackRouter,
    props
  )
  const route = state.routes[state.index]
  return <NavigationContent>{descriptors[route.key].render()}</NavigationContent>
}
const Stack = createNavigatorFactory(TestNavigator)()
const HomeScreen = () => <div>Home</div>
let root
let container
let client
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
}
async function mount(mode = 'new', routes = [{ name: 'Home' }, { name: 'Composer' }]) {
  mockMode = mode
  mockNavigation = createNavigationContainerRef()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <BaseNavigationContainer
          ref={mockNavigation}
          initialState={{ index: routes.length - 1, routes }}
        >
          <Stack.Navigator>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="Timeline"
              component={HomeScreen}
              getId={({ params }) => params?.petId}
            />
            <Stack.Screen
              name="Composer"
              component={mockMode === 'new' ? NewRecordScreen : EditRecordScreen}
            />
          </Stack.Navigator>
        </BaseNavigationContainer>
      </QueryClientProvider>
    )
  })
  await flush()
  expect(mockFields).toBeDefined()
}
const currentRoute = () => mockNavigation.getCurrentRoute().name
const back = async () => {
  await act(async () => mockNavigation.goBack())
}
const changeText = async (value) => {
  await act(async () => mockFields.onTextChange(value))
}
const choose = async (label) => {
  const buttons = Alert.alert.mock.calls.at(-1)[2]
  await act(async () => {
    await buttons.find((button) => button.text === label).onPress?.()
  })
}

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  jest.clearAllMocks()
  mockFields = undefined
  mockPage = undefined
  mockSubmit = undefined
  loadRecordDraft.mockResolvedValue(null)
  saveRecordDraft.mockImplementation(async (_, draft) => draft)
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  client?.clear()
})

test('system navigation back keeps a typed new record until the owner explicitly discards it', async () => {
  await mount()
  await changeText('UXaudit-back-1103')
  await back()
  expect(currentRoute()).toBe('Composer')
  expect(Alert.alert).toHaveBeenCalledWith(
    '保留这份回忆？',
    expect.any(String),
    expect.any(Array),
    expect.anything()
  )
  await choose('继续编辑')
  expect(mockFields.text).toBe('UXaudit-back-1103')
  await back()
  await choose('不保存离开')
  expect(currentRoute()).toBe('Home')
})

test.each(['new', 'edit'])(
  'both cancel and navigation back protect changed %s records',
  async (mode) => {
    await mount(mode)
    await changeText('更改后的回忆')
    await act(async () => mockPage.onCancel())
    expect(currentRoute()).toBe('Composer')
    await choose('继续编辑')
    await back()
    expect(currentRoute()).toBe('Composer')
    expect(mockFields.text).toBe('更改后的回忆')
    await choose(mode === 'edit' ? '放弃更改' : '不保存离开')
    expect(currentRoute()).toBe('Home')
  }
)

test('a successful explicit draft save is safe to leave, but later changes need confirmation', async () => {
  await mount()
  await changeText('已经保存的文字')
  await act(async () => mockPage.headerAction.props.onPress())
  await flush()
  await changeText('保存之后的修改')
  await back()
  expect(currentRoute()).toBe('Composer')
  await choose('继续编辑')
  await changeText('已经保存的文字')
  Alert.alert.mockClear()
  await back()
  expect(currentRoute()).toBe('Home')
  expect(Alert.alert).not.toHaveBeenCalled()
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

test.each(['new', 'edit'])(
  'pending %s submission blocks back and duplicate presses; failure retains edits for retry',
  async (mode) => {
    const request = mode === 'new' ? createPetRecord : updatePetRecord
    const pending = deferred()
    request.mockReturnValueOnce(pending.promise)
    await mount(mode)
    await changeText('不能丢失的回忆')
    await act(async () => {
      const press = mockSubmit.onPress
      press()
      press()
    })
    await back()
    expect(currentRoute()).toBe('Composer')
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledTimes(1)
    await act(async () => pending.reject(new Error('网络暂不可用')))
    await flush()
    expect(mockFields.text).toBe('不能丢失的回忆')
    await back()
    expect(currentRoute()).toBe('Composer')
    await choose('继续编辑')
    request.mockResolvedValueOnce({ record: { id: 12, pet_id: 3 } })
    Alert.alert.mockClear()
    await act(async () => mockSubmit.onPress())
    await flush()
    expect(currentRoute()).toBe('Timeline')
    expect(Alert.alert).not.toHaveBeenCalled()
    if (mode === 'new') {
      expect(request.mock.calls[0][0].client_request_id).toBe(
        request.mock.calls[1][0].client_request_id
      )
    }
  }
)

test.each(['new', 'edit'])(
  'an untouched %s form can leave without a prompt',
  async (mode) => {
    await mount(mode)
    await back()
    expect(currentRoute()).toBe('Home')
    expect(Alert.alert).not.toHaveBeenCalled()
  }
)

test.each(['pet', 'privacy'])(
  'new record %s changes are not silently lost',
  async (field) => {
    await mount()
    await act(async () => {
      if (field === 'pet') mockFields.onPetChange(4)
      else mockFields.onVisibilityChange('private')
    })
    await back()
    expect(currentRoute()).toBe('Composer')
    expect(Alert.alert).toHaveBeenCalled()
  }
)

test('removing an existing photo from an edit is protected on stack replacement', async () => {
  await mount('edit')
  await act(async () => mockFields.photos[0].onRemove())
  await act(async () =>
    mockNavigation.dispatch({ type: 'REPLACE', payload: { name: 'Home' } })
  )
  expect(currentRoute()).toBe('Composer')
  await choose('继续编辑')
  expect(mockFields.photos).toHaveLength(0)
})

test('failed draft persistence retains the form and exit protection; successful retry exits to the requested destination', async () => {
  await mount()
  await changeText('本机草稿必须保存成功')
  saveRecordDraft.mockRejectedValueOnce(new Error('草稿保存失败'))
  await back()
  await choose('存草稿并离开')
  await flush()
  expect(currentRoute()).toBe('Composer')
  expect(mockFields.text).toBe('本机草稿必须保存成功')
  await back()
  await choose('存草稿并离开')
  expect(saveRecordDraft).toHaveBeenLastCalledWith(
    { server: 'pets.example', accountId: 'owner' },
    expect.objectContaining({ text: '本机草稿必须保存成功', petId: 3 })
  )
  expect(currentRoute()).toBe('Home')
})

test('saving a draft blocks back and publish until its files are durable', async () => {
  await mount()
  await changeText('等待照片写入')
  const pending = deferred()
  saveRecordDraft.mockReturnValueOnce(pending.promise)
  await act(async () => mockPage.headerAction.props.onPress())
  await back()
  await act(async () => mockSubmit.onPress())
  expect(currentRoute()).toBe('Composer')
  expect(Alert.alert).not.toHaveBeenCalled()
  expect(createPetRecord).not.toHaveBeenCalled()
  await act(async () => pending.resolve(saveRecordDraft.mock.calls.at(-1)[1]))
  await flush()
  await back()
  expect(currentRoute()).toBe('Home')
})

test.each(['save', 'delete'])(
  '%s returns to the existing timeline without adding another copy',
  async (operation) => {
    await mount('edit', [
      { name: 'Home' },
      { name: 'Timeline', params: { petId: '3' } },
      { name: 'Composer' },
    ])
    const timelineKey = mockNavigation.getRootState().routes[1].key
    if (operation === 'save') {
      updatePetRecord.mockResolvedValueOnce({ record: { id: 12, pet_id: 3 } })
      await changeText('保留一次时间线')
      await act(async () => mockSubmit.onPress())
    } else {
      deletePetRecord.mockResolvedValueOnce({})
      await act(async () =>
        [...container.querySelectorAll('button')]
          .find((button) => button.textContent === '删除记录')
          .click()
      )
      await choose('删除')
    }
    await flush()
    const routes = mockNavigation.getRootState().routes
    expect(routes.map((route) => route.name)).toEqual(['Home', 'Timeline'])
    expect(routes[1].key).toBe(timelineKey)
    await back()
    expect(currentRoute()).toBe('Home')
  }
)

test.each(['save', 'delete'])(
  '%s from a directly opened editor falls back to its pet timeline',
  async (operation) => {
    await mount('edit', [{ name: 'Composer' }])
    if (operation === 'save') {
      updatePetRecord.mockResolvedValueOnce({ record: { id: 12, pet_id: 3 } })
      await act(async () => mockSubmit.onPress())
    } else {
      deletePetRecord.mockResolvedValueOnce({})
      await act(async () =>
        [...container.querySelectorAll('button')]
          .find((button) => button.textContent === '删除记录')
          .click()
      )
      await choose('删除')
    }
    await flush()
    const routes = mockNavigation.getRootState().routes
    expect(routes).toHaveLength(1)
    expect(routes[0]).toMatchObject({ name: 'Timeline', params: { petId: '3' } })
    expect(mockNavigation.canGoBack()).toBe(false)
  }
)

test('moving a record to another pet opens the updated pet timeline, not the old one', async () => {
  await mount('edit', [
    { name: 'Home' },
    { name: 'Timeline', params: { petId: '3' } },
    { name: 'Composer' },
  ])
  await act(async () => mockFields.onPetChange(4))
  updatePetRecord.mockResolvedValueOnce({ record: { id: 12, pet_id: 4 } })
  await act(async () => mockSubmit.onPress())
  await flush()
  expect(mockNavigation.getCurrentRoute()).toMatchObject({
    name: 'Timeline',
    params: { petId: '4' },
  })
  expect(
    mockNavigation
      .getRootState()
      .routes.filter((route) => route.name === 'Timeline' && route.params.petId === '4')
  ).toHaveLength(1)
})
