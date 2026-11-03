import Feather from '@expo/vector-icons/Feather'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { PetAvatar } from 'src/components/metvage/brand'
import {
  commentOnRecord,
  deleteRecordComment,
  getRecordInteractions,
  likeRecord,
  newCommentRequestId,
  unlikeRecord,
} from 'src/lib/interactions'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
import { getPets } from 'src/lib/pets'
import type { RecordVisibility } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const commentDate = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })

export function RecordInteractions({
  recordId,
  visibility,
  onCommentActionLayout,
}: {
  recordId: number
  visibility: RecordVisibility
  onCommentActionLayout?: (height: number) => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const commentLock = useRef(false)
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
    onSettled: () => {
      commentLock.current = false
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
    if (!content || commentLock.current || !requirePet()) return
    commentLock.current = true
    comment.mutate({ content, key: requestId })
  }

  const currentPet = pets.data?.pets.find((pet) => pet.id === currentPetId)

  return (
    <View style={{ gap: m.inset }}>
      {interactions.isLoading && (
        <ActivityIndicator color={c.green} accessibilityLabel="正在加载互动" />
      )}
      {interactions.error && (
        <View style={{ gap: m.gap }}>
          <Text
            accessibilityRole="alert"
            style={{ color: c.error, fontSize: m.cardTitle }}
          >
            {interactions.error.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => interactions.refetch()}
            style={({ pressed }) => ({
              minHeight: m.touch,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: c.green, fontSize: m.cardTitle }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {interactions.data && (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: m.gap,
              flexWrap: 'wrap',
            }}
          >
            {visibility === 'public' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={liked ? '取消点赞' : '点赞'}
                accessibilityState={{
                  selected: !!liked,
                  disabled: like.isPending || pets.isLoading || (!!user && !pets.data),
                }}
                disabled={like.isPending || pets.isLoading || (!!user && !pets.data)}
                onPress={() => {
                  if (requirePet()) like.mutate()
                }}
                style={({ pressed }) => ({
                  minHeight: m.touch,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: m.gap,
                  paddingHorizontal: m.edge,
                  paddingVertical: m.gap,
                  borderRadius: 24,
                  backgroundColor: liked ? c.softGreen : c.field,
                  opacity: pressed || like.isPending ? 0.6 : 1,
                })}
              >
                <Feather name="heart" size={20} color={liked ? c.coral : c.green} />
                <Text
                  style={{ color: c.green, fontSize: m.cardTitle, fontWeight: '600' }}
                >
                  {liked ? '已赞' : '点赞'} · {interactions.data.likes.length}
                </Text>
              </Pressable>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  gap: m.gap,
                  alignItems: 'center',
                  minHeight: m.touch,
                }}
              >
                <Feather name="heart" size={20} color={c.secondaryText} />
                <Text style={{ color: c.secondaryText, fontSize: m.cardTitle }}>
                  {interactions.data.likes.length} 个赞
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: m.gap }}>
              <Feather name="message-circle" size={20} color={c.secondaryText} />
              <Text style={{ color: c.text, fontSize: m.cardTitle, fontWeight: '600' }}>
                {interactions.data.comments.length} 条评论
              </Text>
            </View>
          </View>
          {interactions.data.likes.length > 0 && (
            <Text
              numberOfLines={2}
              style={{ color: c.secondaryText, fontSize: m.caption }}
            >
              {interactions.data.likes.map((item) => item.actor_pet.nickname).join('、')}{' '}
              觉得很赞
            </Text>
          )}
          {visibility === 'public' && (
            <View style={{ gap: m.inset }}>
              {!user ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/login')}
                  style={({ pressed }) => ({
                    minHeight: m.touch,
                    padding: m.inset,
                    backgroundColor: c.softGreen,
                    borderRadius: 16,
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: c.green, fontSize: m.cardTitle }}>
                    登录后点赞或评论
                  </Text>
                </Pressable>
              ) : pets.error && !pets.data ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => pets.refetch()}
                  style={{ minHeight: m.touch, justifyContent: 'center' }}
                >
                  <Text style={{ color: c.error, fontSize: m.cardTitle }}>
                    宠物身份加载失败，点此重试
                  </Text>
                </Pressable>
              ) : !hasCurrentPet && !pets.isLoading ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/settings/pets')}
                  style={({ pressed }) => ({
                    minHeight: m.touch,
                    padding: m.inset,
                    backgroundColor: c.softGreen,
                    borderRadius: 16,
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: c.green, fontSize: m.cardTitle }}>
                    建立并选定宠物身份后互动
                  </Text>
                </Pressable>
              ) : (
                <View
                  style={{
                    gap: m.inset,
                    padding: m.inset,
                    borderRadius: 16,
                    backgroundColor: c.field,
                  }}
                >
                  <TextInput
                    accessibilityLabel="写评论"
                    placeholder="写评论，分享你的小感受…"
                    placeholderTextColor={c.secondaryText}
                    value={text}
                    editable={!comment.isPending}
                    onChangeText={(value) => {
                      setText(value)
                      setRequestId(newCommentRequestId())
                    }}
                    multiline
                    maxLength={2000}
                    style={{
                      minHeight: 64,
                      padding: 0,
                      color: c.text,
                      fontSize: m.cardTitle,
                      lineHeight: 22,
                      textAlignVertical: 'top',
                    }}
                  />
                  <View
                    onLayout={(event) =>
                      onCommentActionLayout?.(event.nativeEvent.layout.height)
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: m.gap,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: m.gap,
                      }}
                    >
                      {currentPet && (
                        <PetAvatar
                          name={currentPet.nickname}
                          species={currentPet.species}
                          size={24}
                        />
                      )}
                      <Text
                        numberOfLines={2}
                        style={{ flex: 1, color: c.secondaryText, fontSize: m.caption }}
                      >
                        {currentPet?.nickname ?? '加载宠物身份…'}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: !text.trim() || comment.isPending || pets.isLoading,
                        busy: comment.isPending,
                      }}
                      disabled={!text.trim() || comment.isPending || pets.isLoading}
                      onPress={submitComment}
                      style={({ pressed }) => ({
                        minHeight: m.touch,
                        minWidth: m.touch,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: m.gap,
                        paddingHorizontal: m.edge,
                        paddingVertical: m.gap,
                        borderRadius: 24,
                        backgroundColor: c.green,
                        opacity:
                          !text.trim() || comment.isPending || pets.isLoading
                            ? 0.5
                            : pressed
                              ? 0.7
                              : 1,
                      })}
                    >
                      <Feather name="send" size={18} color={c.surface} />
                      <Text
                        style={{
                          color: c.surface,
                          fontSize: m.cardTitle,
                          fontWeight: '600',
                        }}
                      >
                        {comment.isPending ? '正在发送…' : '发送评论'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {(pets.error || like.error || comment.error) && (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={{ color: c.error, fontSize: m.cardTitle }}
                >
                  {(pets.error || like.error || comment.error)?.message}
                </Text>
              )}
            </View>
          )}
          {visibility !== 'public' && (
            <View
              style={{
                flexDirection: 'row',
                gap: m.gap,
                padding: m.inset,
                borderRadius: 12,
                backgroundColor: c.field,
              }}
            >
              <Feather name="lock" size={18} color={c.secondaryText} />
              <Text
                style={{
                  flex: 1,
                  color: c.secondaryText,
                  fontSize: m.cardTitle,
                  lineHeight: 22,
                }}
              >
                私人记录保留历史互动，当前不接受新互动。
              </Text>
            </View>
          )}
          {interactions.data.comments.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                gap: m.inset,
                paddingVertical: m.inset,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              }}
            >
              <PetAvatar
                name={item.actor_pet.nickname}
                species={item.actor_pet.species}
                size={32}
              />
              <View style={{ flex: 1, gap: m.gap }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: m.gap,
                    flexWrap: 'wrap',
                  }}
                >
                  <Text
                    style={{
                      color: c.green,
                      fontSize: m.cardTitle,
                      fontWeight: '600',
                      flexShrink: 1,
                    }}
                  >
                    {item.actor_pet.nickname}
                  </Text>
                  {item.created_at && (
                    <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
                      {commentDate.format(new Date(item.created_at))}
                    </Text>
                  )}
                </View>
                <Text
                  selectable
                  style={{ color: c.text, fontSize: m.cardTitle, lineHeight: 22 }}
                >
                  {item.text}
                </Text>
                {visibility === 'public' && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: m.inset }}>
                    {item.can_delete && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="删除我的评论"
                        disabled={removeComment.isPending}
                        onPress={() => removeComment.mutate(item.id)}
                        style={({ pressed }) => ({
                          minHeight: m.touch,
                          minWidth: m.touch,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          opacity: pressed || removeComment.isPending ? 0.6 : 1,
                        })}
                      >
                        <Feather name="trash-2" size={16} color={c.error} />
                        <Text style={{ color: c.error, fontSize: m.caption }}>删除</Text>
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="举报这条评论"
                      onPress={() =>
                        router.push(
                          user
                            ? (`/reports/new?target_type=comment&target_id=${item.id}` as Parameters<
                                typeof router.push
                              >[0])
                            : '/handleLogin'
                        )
                      }
                      style={({ pressed }) => ({
                        minHeight: m.touch,
                        minWidth: m.touch,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Feather name="flag" size={16} color={c.secondaryText} />
                      <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
                        举报
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          ))}
          {removeComment.error && (
            <Text
              accessibilityRole="alert"
              style={{ color: c.error, fontSize: m.cardTitle }}
            >
              {removeComment.error.message}
            </Text>
          )}
        </>
      )}
    </View>
  )
}
