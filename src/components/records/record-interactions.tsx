import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import {
  commentOnRecord,
  deleteRecordComment,
  getRecordInteractions,
  likeRecord,
  newCommentRequestId,
  unlikeRecord,
} from 'src/lib/interactions'
import { getPets } from 'src/lib/pets'
import type { RecordVisibility } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export function RecordInteractions({
  recordId,
  visibility,
}: {
  recordId: number
  visibility: RecordVisibility
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [requestId, setRequestId] = useState(newCommentRequestId)
  const interactions = useQuery({
    queryKey: ['metvage-interactions', recordId, user?.server, user?.token],
    queryFn: () => getRecordInteractions(recordId),
  })
  const pets = useQuery({
    queryKey: ['metvage-pets', user?.server, user?.token],
    queryFn: getPets,
    enabled: !!user && visibility === 'public',
  })
  const currentPetId = pets.data?.current_pet_id
  const hasCurrentPet = pets.data?.pets.some((pet) => pet.id === currentPetId)
  const liked = interactions.data?.likes.some(
    (like) => like.actor_pet.id === currentPetId
  )

  const like = useMutation({
    mutationFn: async () => {
      if (liked) await unlikeRecord(recordId)
      else await likeRecord(recordId)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['metvage-interactions', recordId] }),
  })
  const comment = useMutation({
    mutationFn: ({ content, key }: { content: string; key: string }) =>
      commentOnRecord(recordId, content, key),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['metvage-interactions', recordId],
      })
      setText('')
      setRequestId(newCommentRequestId())
    },
  })
  const removeComment = useMutation({
    mutationFn: deleteRecordComment,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['metvage-interactions', recordId] }),
  })

  function requirePet(): boolean {
    if (!user) {
      router.push('/login')
      return false
    }
    if (!hasCurrentPet) {
      router.push('/settings/pets')
      return false
    }
    return true
  }

  function submitComment() {
    const content = text.trim()
    if (!content || comment.isPending || !requirePet()) return
    comment.mutate({ content, key: requestId })
  }

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontWeight: '700', fontSize: 18 }}>互动</Text>
      {interactions.isLoading && <ActivityIndicator accessibilityLabel="正在加载互动" />}
      {interactions.error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#b42318' }}>{interactions.error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => interactions.refetch()}>
            <Text style={{ color: green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {interactions.data && (
        <>
          <Text style={{ color: '#63746f' }}>
            {interactions.data.likes.length} 个赞 · {interactions.data.comments.length}{' '}
            条评论
          </Text>
          {interactions.data.likes.length > 0 && (
            <Text style={{ color: '#63746f' }}>
              点赞：
              {interactions.data.likes.map((item) => item.actor_pet.nickname).join('、')}
            </Text>
          )}
          {visibility === 'public' && (
            <View style={{ gap: 12 }}>
              {!user ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/login')}
                >
                  <Text style={{ color: green }}>登录后点赞或评论</Text>
                </Pressable>
              ) : pets.error && !pets.data ? (
                <Pressable accessibilityRole="button" onPress={() => pets.refetch()}>
                  <Text style={{ color: '#b42318' }}>宠物身份加载失败，点此重试</Text>
                </Pressable>
              ) : !hasCurrentPet && !pets.isLoading ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/settings/pets')}
                >
                  <Text style={{ color: green }}>建立并选定宠物身份后互动</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    disabled={like.isPending || pets.isLoading}
                    onPress={() => {
                      if (requirePet()) like.mutate()
                    }}
                  >
                    <Text style={{ color: green }}>{liked ? '取消点赞' : '点赞'}</Text>
                  </Pressable>
                  <TextInput
                    accessibilityLabel="写评论"
                    placeholder="写评论"
                    value={text}
                    onChangeText={(value) => {
                      setText(value)
                      setRequestId(newCommentRequestId())
                    }}
                    multiline
                    maxLength={2000}
                    style={{
                      borderWidth: 1,
                      borderColor: '#ccd8d2',
                      borderRadius: 8,
                      padding: 12,
                      minHeight: 70,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={!text.trim() || comment.isPending || pets.isLoading}
                    onPress={submitComment}
                  >
                    <Text style={{ color: green }}>
                      {comment.isPending ? '正在发送…' : '发送评论'}
                    </Text>
                  </Pressable>
                </>
              )}
              {(pets.error || like.error || comment.error) && (
                <Text style={{ color: '#b42318' }}>
                  {(pets.error || like.error || comment.error)?.message}
                </Text>
              )}
            </View>
          )}
          {visibility !== 'public' && (
            <Text style={{ color: '#63746f' }}>
              私人记录保留历史互动，当前不接受新互动。
            </Text>
          )}
          {interactions.data.comments.map((item) => (
            <View
              key={item.id}
              style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 6 }}
            >
              <Text style={{ color: green, fontWeight: '700' }}>
                {item.actor_pet.nickname}
              </Text>
              <Text>{item.text}</Text>
              {visibility === 'public' && item.can_delete && (
                <Pressable
                  accessibilityRole="button"
                  disabled={removeComment.isPending}
                  onPress={() => removeComment.mutate(item.id)}
                >
                  <Text style={{ color: '#b42318' }}>删除我的评论</Text>
                </Pressable>
              )}
              {visibility === 'public' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      user
                        ? (`/reports/new?target_type=comment&target_id=${item.id}` as Parameters<
                            typeof router.push
                          >[0])
                        : '/handleLogin'
                    )
                  }
                >
                  <Text style={{ color: '#b42318' }}>举报这条评论</Text>
                </Pressable>
              )}
            </View>
          ))}
          {removeComment.error && (
            <Text style={{ color: '#b42318' }}>{removeComment.error.message}</Text>
          )}
        </>
      )}
    </View>
  )
}
