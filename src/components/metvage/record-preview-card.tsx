import Feather from '@expo/vector-icons/Feather'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { getRecordInteractions } from 'src/lib/interactions'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { publicRecordPhotoUrl } from 'src/lib/metvage-public'
import type { PetRecord } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'
import { PawMark, PetAvatar } from './brand'

export function RecordPreviewCard({ record }: { record: PetRecord }) {
  const { user } = useAuth()
  const interactions = useQuery({
    queryKey: ['metvage-interactions', record.id, user?.server, user?.token],
    queryFn: () => getRecordInteractions(record.id),
  })
  const photo = record.photos[0] ? publicRecordPhotoUrl(record.photos[0].url) : undefined
  const open = () =>
    router.push(`/note/${record.id}` as Parameters<typeof router.push>[0])
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`阅读${record.pet.nickname}的公开笔记`}
      onPress={open}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: 16,
        backgroundColor: c.surface,
        overflow: 'hidden',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          cachePolicy="none"
          contentFit="cover"
          style={{ width: '100%', aspectRatio: 0.86 }}
        />
      ) : (
        <View
          style={{
            aspectRatio: 0.86,
            padding: 18,
            justifyContent: 'center',
            gap: 18,
            backgroundColor: c.softGreen,
          }}
        >
          <PawMark size={32} color={c.green} />
          <Text
            numberOfLines={5}
            style={{ color: c.green, fontSize: 18, lineHeight: 29, fontWeight: '600' }}
          >
            {record.text || record.title || '记录此刻'}
          </Text>
        </View>
      )}
      <View style={{ padding: 10, gap: 9 }}>
        <Text
          numberOfLines={2}
          style={{ color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '600' }}
        >
          {record.title || record.text || '这一刻，值得记录'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看${record.pet.nickname}的宠物档案`}
            onPress={(event) => {
              event.stopPropagation()
              router.push(`/pet/${record.pet_id}` as Parameters<typeof router.push>[0])
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 40,
            }}
          >
            <PetAvatar
              name={record.pet.nickname}
              species={record.pet.species}
              uri={photo}
              size={27}
            />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 12, color: c.secondaryText }}
            >
              {record.pet.nickname}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看点赞和评论"
            onPress={(event) => {
              event.stopPropagation()
              open()
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 40 }}
          >
            <Feather name="heart" size={20} color={c.coral} />
            {interactions.data && (
              <Text style={{ color: c.text, fontSize: 12 }}>
                {interactions.data.likes.length}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  )
}
