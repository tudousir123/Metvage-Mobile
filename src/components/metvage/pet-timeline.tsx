import Feather from '@expo/vector-icons/Feather'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { RecordInteractions } from 'src/components/records/record-interactions'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import {
  type PetRecord,
  type RecordVisibility,
  recordPhotoUrl,
  updateRecordVisibility,
} from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

export function PetTimeline({
  records,
  isOwner,
}: {
  records: PetRecord[]
  isOwner: boolean
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<number | null>(null)
  const visibility = useMutation({
    mutationFn: ({ id, value }: { id: number; value: RecordVisibility }) =>
      updateRecordVisibility(id, value),
    onSuccess: () => queryClient.invalidateQueries(),
  })

  function changeVisibility(record: PetRecord) {
    if (visibility.isPending) return
    const value = record.visibility === 'public' ? 'private' : 'public'
    Alert.alert(
      value === 'public' ? '公开这条记录？' : '只留给自己？',
      value === 'public'
        ? '公开后，未登录访客也能看到这条笔记。'
        : '改为私人记录后，只有你可以查看。已有互动会保留。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: value === 'public' ? '确认公开' : '设为仅自己',
          onPress: () => visibility.mutate({ id: record.id, value }),
        },
      ]
    )
  }

  function openActions(record: PetRecord) {
    Alert.alert(record.title || '这份日常', undefined, [
      {
        text: '编辑或删除记录',
        onPress: () =>
          router.push(`/records/${record.id}/edit` as Parameters<typeof router.push>[0]),
      },
      {
        text: record.visibility === 'public' ? '改为私人记录' : '公开这条记录',
        onPress: () => changeVisibility(record),
      },
      { text: '取消', style: 'cancel' },
    ])
  }

  return (
    <View>
      {visibility.error && (
        <Text accessibilityRole="alert" style={{ color: c.error, padding: 16 }}>
          {visibility.error.message}
        </Text>
      )}
      {records.length === 0 && (
        <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
          <Feather name="book-open" size={32} color={c.green} />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>
            每一天，都值得记下来
          </Text>
          <Text style={{ color: c.secondaryText, textAlign: 'center', lineHeight: 22 }}>
            还没有记录，留下属于它的第一份回忆吧。
          </Text>
        </View>
      )}
      {records.map((record) => {
        const date = new Date(record.created_at)
        return (
          <View key={record.id} style={{ flexDirection: 'row', paddingHorizontal: 16 }}>
            <View style={{ width: 44, paddingTop: 13 }}>
              <Text style={{ color: c.secondaryText, fontSize: 13 }}>
                {date.getMonth() + 1}月
              </Text>
              <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>
                {date.getDate()}
              </Text>
              <Text style={{ color: c.secondaryText, fontSize: 12 }}>
                {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]}
              </Text>
            </View>
            <View style={{ width: 14, alignItems: 'center' }}>
              <View
                style={{
                  position: 'absolute',
                  top: 21,
                  bottom: 0,
                  width: 1,
                  backgroundColor: c.border,
                }}
              />
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: c.coral,
                  marginTop: 18,
                }}
              />
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: c.surface,
                borderRadius: 18,
                padding: 14,
                marginBottom: 14,
                gap: 10,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                {record.title ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      flex: 1,
                      color: c.text,
                      fontSize: 17,
                      fontWeight: '700',
                      lineHeight: 23,
                    }}
                  >
                    {record.title}
                  </Text>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 5,
                    borderRadius: 20,
                    backgroundColor:
                      record.visibility === 'public' ? c.softGreen : c.field,
                    flexDirection: 'row',
                    gap: 5,
                    alignItems: 'center',
                  }}
                >
                  <Feather
                    name={record.visibility === 'public' ? 'globe' : 'lock'}
                    size={13}
                    color={record.visibility === 'public' ? c.green : c.secondaryText}
                  />
                  <Text
                    style={{
                      color: record.visibility === 'public' ? c.green : c.secondaryText,
                      fontSize: 11,
                    }}
                  >
                    {record.visibility === 'public' ? '公开' : '仅自己'}
                  </Text>
                </View>
                {isOwner && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`管理记录：${record.title || record.text || '照片记录'}`}
                    disabled={visibility.isPending}
                    onPress={() => openActions(record)}
                    style={({ pressed }) => ({
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.5 : 1,
                    })}
                  >
                    <Feather name="more-horizontal" size={18} color={c.secondaryText} />
                  </Pressable>
                )}
              </View>
              {record.text && (
                <Text style={{ color: c.secondaryText, fontSize: 15, lineHeight: 23 }}>
                  {record.text}
                </Text>
              )}
              {record.photos.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {record.photos.map((photo) => (
                    <Image
                      key={photo.id}
                      accessibilityLabel={`${record.pet.nickname}的记录照片`}
                      source={{
                        uri: recordPhotoUrl(photo.url),
                        headers: user?.token
                          ? { Authorization: `Bearer ${user.token}` }
                          : undefined,
                      }}
                      cachePolicy="none"
                      contentFit="cover"
                      style={{
                        width: record.photos.length === 1 ? 216 : 142,
                        height: 144,
                        borderRadius: 12,
                      }}
                    />
                  ))}
                </ScrollView>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: expanded === record.id }}
                onPress={() => setExpanded(expanded === record.id ? null : record.id)}
                style={({ pressed }) => ({
                  minHeight: 32,
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text style={{ color: c.green, fontSize: 12 }}>
                  {expanded === record.id
                    ? '收起互动'
                    : record.visibility === 'private'
                      ? '查看历史互动'
                      : '查看互动'}{' '}
                </Text>
              </Pressable>
              {expanded === record.id && (
                <RecordInteractions recordId={record.id} visibility={record.visibility} />
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}
