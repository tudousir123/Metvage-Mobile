import Feather from '@expo/vector-icons/Feather'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from 'react-native-keyboard-controller'
import { PetAvatar } from 'src/components/metvage/brand'
import { RecordInteractions } from 'src/components/records/record-interactions'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
import { getPublicRecord, publicRecordPhotoUrl } from 'src/lib/metvage-public'
import { useAuth } from 'src/state/AuthProvider'

const noteDate = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

function NotePhoto({ uri, index }: { uri: string; index: number }) {
  const [aspectRatio, setAspectRatio] = useState(4 / 5)
  return (
    <Image
      accessibilityLabel={`笔记照片 ${index + 1}`}
      source={{ uri }}
      cachePolicy="none"
      contentFit="contain"
      onLoad={({ source }) => {
        if (source.width > 0 && source.height > 0)
          setAspectRatio(source.width / source.height)
      }}
      style={{ width: '100%', aspectRatio, borderRadius: 16, backgroundColor: c.field }}
    />
  )
}

export default function PublicNote() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const recordId = Number(id)
  const [commentActionHeight, setCommentActionHeight] = useState<number>(m.touch)
  const note = useQuery({
    queryKey: ['metvage-public-note', recordId, user?.server, user?.token],
    queryFn: () => getPublicRecord(recordId),
    enabled: Number.isInteger(recordId) && recordId > 0,
  })
  const record = note.data?.record

  return (
    <KeyboardProvider>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        // Include the input/action gap and clearance above the keyboard.
        bottomOffset={commentActionHeight + m.inset * 2}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.background }}
        contentContainerStyle={{ padding: m.edge, gap: m.edge }}
      >
        <Stack.Screen
          options={{
            title: '公开笔记',
            headerTintColor: c.green,
            headerStyle: { backgroundColor: c.background },
            headerShadowVisible: false,
            headerTitleStyle: { fontSize: m.body, fontWeight: '600' },
          }}
        />
        {note.isLoading && (
          <ActivityIndicator color={c.green} accessibilityLabel="正在加载笔记" />
        )}
        {note.isError && (
          <View style={{ gap: m.inset, alignItems: 'center', paddingVertical: m.edge }}>
            <Feather name="file-text" size={28} color={c.secondaryText} />
            <Text style={{ color: c.secondaryText, fontSize: m.body }}>
              此笔记暂时无法查看。
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => note.refetch()}
              style={({ pressed }) => ({
                minHeight: m.touch,
                justifyContent: 'center',
                paddingHorizontal: m.edge,
                backgroundColor: c.softGreen,
                borderRadius: 24,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: c.green, fontSize: m.cardTitle }}>重试</Text>
            </Pressable>
          </View>
        )}
        {!note.isError && record && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`查看${record.pet.nickname}的主页`}
              onPress={() =>
                router.push(`/pet/${record.pet_id}` as Parameters<typeof router.push>[0])
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: m.inset,
                minHeight: m.touch,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <PetAvatar
                name={record.pet.nickname}
                species={record.pet.species}
                uri={
                  record.photos[0]
                    ? publicRecordPhotoUrl(record.photos[0].url)
                    : undefined
                }
                size={40}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.text, fontSize: m.body, fontWeight: '600' }}>
                  {record.pet.nickname}
                </Text>
                <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
                  {record.published_at
                    ? `${noteDate.format(new Date(record.published_at))} · `
                    : ''}
                  公开笔记
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={c.secondaryText} />
            </Pressable>
            {record.photos.length > 0 && (
              <View style={{ gap: m.gap }}>
                {record.photos.map((photo, index) => (
                  <NotePhoto
                    key={photo.id}
                    uri={publicRecordPhotoUrl(photo.url)}
                    index={index}
                  />
                ))}
              </View>
            )}
            {(record.title || record.text) && (
              <View style={{ gap: m.gap }}>
                {record.title && (
                  <Text
                    selectable
                    style={{
                      color: c.text,
                      fontSize: m.body,
                      fontWeight: '700',
                      lineHeight: 24,
                    }}
                  >
                    {record.title}
                  </Text>
                )}
                {record.text && (
                  <Text
                    selectable
                    style={{ color: c.text, fontSize: m.cardTitle, lineHeight: 23 }}
                  >
                    {record.text}
                  </Text>
                )}
              </View>
            )}
            <View style={{ height: 1, backgroundColor: c.border }} />
            <RecordInteractions
              recordId={recordId}
              visibility="public"
              onCommentActionLayout={setCommentActionHeight}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  user
                    ? (`/reports/new?target_type=record&target_id=${recordId}` as Parameters<
                        typeof router.push
                      >[0])
                    : '/handleLogin'
                )
              }
              style={({ pressed }) => ({
                minHeight: m.touch,
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: m.gap,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Feather name="flag" size={16} color={c.secondaryText} />
              <Text style={{ color: c.secondaryText, fontSize: m.cardTitle }}>
                举报这篇公开笔记
              </Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollView>
    </KeyboardProvider>
  )
}
