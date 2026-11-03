import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { Stack } from 'expo-router'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { PawMark, PetAvatar } from 'src/components/metvage/brand'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
import type { PetProfile } from 'src/lib/pets'
import type { RecordVisibility } from 'src/lib/records'

export function ComposerPage({
  title,
  onCancel,
  headerAction,
  footer,
  children,
}: {
  title: string
  onCancel: () => void
  headerAction?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.background }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: m.edge,
          minHeight: m.touch,
          gap: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消编辑"
          onPress={onCancel}
          style={({ pressed }) => ({
            minHeight: m.touch,
            minWidth: m.touch,
            justifyContent: 'center',
            paddingVertical: 8,
            paddingRight: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: c.green, fontSize: m.body }}>取消</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: m.title,
            fontWeight: '700',
            color: c.text,
          }}
        >
          {title}
        </Text>
        {headerAction ?? <View style={{ width: 44 }} />}
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: m.edge,
            paddingTop: 4,
            paddingBottom: m.gap,
            gap: m.gap,
          }}
        >
          {children}
        </ScrollView>
        {footer && (
          <View
            style={{
              paddingHorizontal: m.edge,
              paddingTop: 6,
              paddingBottom: 6,
              backgroundColor: c.background,
            }}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export type ComposerPhoto = {
  key: string
  uri: string
  headers?: Record<string, string>
  onRemove: () => void
}

export function ComposerFields({
  pets,
  petId,
  onPetChange,
  photos,
  onAddPhotos,
  title,
  onTitleChange,
  text,
  onTextChange,
  visibility,
  onVisibilityChange,
  busy = false,
}: {
  pets: PetProfile[]
  petId: number | null
  onPetChange: (id: number) => void
  photos: ComposerPhoto[]
  onAddPhotos: () => void
  title: string
  onTitleChange: (value: string) => void
  text: string
  onTextChange: (value: string) => void
  visibility: RecordVisibility
  onVisibilityChange?: (value: RecordVisibility) => void
  busy?: boolean
}) {
  const [picker, setPicker] = useState<'pet' | 'visibility' | null>(null)
  const insets = useSafeAreaInsets()
  const pet = pets.find((item) => item.id === petId)
  const choosePet = () => {
    if (!busy) setPicker('pet')
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="选择发布的宠物身份"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={choosePet}
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: m.gap,
          padding: m.gap,
          borderRadius: 14,
          backgroundColor: c.field,
          alignItems: 'center',
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <PetAvatar name={pet?.nickname ?? '选择宠物'} species={pet?.species} size={36} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: c.secondaryText, fontSize: 13 }}>以谁的身份发布</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                flexShrink: 1,
                fontSize: m.petName,
                fontWeight: '700',
                color: c.text,
              }}
            >
              {pet?.nickname ?? '选择宠物'}
            </Text>
            <Feather name="chevron-down" size={21} color={c.text} />
          </View>
        </View>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingTop: 2, paddingBottom: 2 }}
      >
        {photos.map((photo, index) => (
          <View key={photo.key} style={{ width: 98, height: 100 }}>
            <Image
              source={{ uri: photo.uri, headers: photo.headers }}
              cachePolicy="none"
              contentFit="cover"
              style={{ width: '100%', height: '100%', borderRadius: 10 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`移除第 ${index + 1} 张照片`}
              hitSlop={{ left: 12, bottom: 12 }}
              disabled={busy}
              onPress={photo.onRemove}
              style={({ pressed }) => ({
                position: 'absolute',
                right: 2,
                top: 2,
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 18,
                backgroundColor: c.surface,
                opacity: pressed ? 0.6 : 0.94,
              })}
            >
              <Feather name="x" size={18} color={c.text} />
            </Pressable>
          </View>
        ))}
        {photos.length < 9 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`添加照片，已选 ${photos.length} 张，最多 9 张`}
            disabled={busy}
            onPress={onAddPhotos}
            style={({ pressed }) => ({
              width: photos.length ? 86 : 100,
              height: 100,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: c.border,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Feather name="plus" size={24} color={c.text} />
            <Text style={{ color: c.secondaryText, fontSize: m.cardTitle }}>
              添加照片
            </Text>
            <Text style={{ color: c.secondaryText, fontSize: m.caption }}>最多 9 张</Text>
          </Pressable>
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 12,
          backgroundColor: c.field,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          accessibilityLabel="记录标题（可选）"
          placeholder="给这份回忆起个名字"
          placeholderTextColor={c.secondaryText}
          value={title}
          onChangeText={onTitleChange}
          maxLength={50}
          editable={!busy}
          style={{
            flex: 1,
            minHeight: m.touch,
            color: c.text,
            fontSize: m.body,
            paddingVertical: 8,
          }}
        />
        <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
          {title.length}/50
        </Text>
      </View>
      <TextInput
        accessibilityLabel="记录内容"
        placeholder="记录你和它的日常故事…"
        placeholderTextColor={c.secondaryText}
        value={text}
        onChangeText={onTextChange}
        multiline
        textAlignVertical="top"
        editable={!busy}
        style={{
          minHeight: 88,
          backgroundColor: c.field,
          color: c.text,
          padding: m.inset,
          borderRadius: 12,
          fontSize: m.body,
          lineHeight: 24,
        }}
      />

      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="更改关联宠物"
          disabled={busy}
          onPress={choosePet}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: m.gap,
            minHeight: m.touch,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: c.border,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <PawMark size={m.icon} color={c.text} />
          <Text style={{ color: c.text, fontSize: m.body, flex: 1 }}>关联宠物</Text>
          <PetAvatar name={pet?.nickname ?? '宠物'} species={pet?.species} size={28} />
          <Text
            numberOfLines={2}
            style={{ color: c.text, fontSize: m.body, maxWidth: '35%' }}
          >
            {pet?.nickname ?? '请选择'}
          </Text>
          <Feather name="chevron-right" size={21} color={c.text} />
        </Pressable>
        <Pressable
          accessibilityRole={onVisibilityChange ? 'button' : 'text'}
          accessibilityLabel={`可见范围：${visibility === 'public' ? '公开' : '仅自己'}`}
          disabled={busy || !onVisibilityChange}
          onPress={() => setPicker('visibility')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            gap: m.gap,
            alignItems: 'center',
            minHeight: m.touch,
            paddingVertical: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Feather
            name={visibility === 'public' ? 'globe' : 'lock'}
            size={m.icon}
            color={c.text}
          />
          <Text style={{ color: c.text, fontSize: m.body, flex: 1 }}>可见范围</Text>
          <Text style={{ color: c.secondaryText, fontSize: m.body }}>
            {visibility === 'public' ? '公开' : '仅自己'}
          </Text>
          {onVisibilityChange && <Feather name="chevron-down" size={21} color={c.text} />}
        </Pressable>
        <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
          {visibility === 'public'
            ? '公开笔记可供未登录访客浏览。'
            : '私人记录仅你自己可见。'}
          {!onVisibilityChange ? '可在宠物时间线更改可见范围。' : ''}
        </Text>
      </View>

      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(16,24,32,0.28)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            accessibilityLabel="关闭选择"
            accessibilityRole="button"
            onPress={() => setPicker(null)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              backgroundColor: c.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: Math.max(20, insets.bottom),
              maxHeight: '70%',
              gap: 14,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: m.title, fontWeight: '700', color: c.text }}>
                {picker === 'pet' ? '选择宠物身份' : '谁可以看到'}
              </Text>
              <Pressable
                accessibilityLabel="关闭选择"
                accessibilityRole="button"
                onPress={() => setPicker(null)}
                style={{ padding: 12 }}
              >
                <Feather name="x" size={22} color={c.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {picker === 'pet'
                ? pets.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: item.id === petId }}
                      onPress={() => {
                        onPetChange(item.id)
                        setPicker(null)
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: m.gap,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: item.id === petId ? c.softGreen : c.field,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <PetAvatar name={item.nickname} species={item.species} />
                      <Text style={{ flex: 1, fontSize: m.body, color: c.text }}>
                        {item.nickname}
                      </Text>
                      {item.id === petId && (
                        <Feather name="check" size={22} color={c.green} />
                      )}
                    </Pressable>
                  ))
                : (['public', 'private'] as const).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: value === visibility }}
                      onPress={() => {
                        onVisibilityChange?.(value)
                        setPicker(null)
                      }}
                      style={({ pressed }) => ({
                        padding: 16,
                        borderRadius: 12,
                        backgroundColor: visibility === value ? c.softGreen : c.field,
                        gap: 5,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ fontSize: m.body, color: c.text }}>
                        {value === 'public' ? '公开' : '仅自己'}
                      </Text>
                      <Text style={{ fontSize: 13, color: c.secondaryText }}>
                        {value === 'public'
                          ? '公开分享，访客也可以浏览'
                          : '留给自己，保存在宠物时间线'}
                      </Text>
                    </Pressable>
                  ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

export function ComposerSubmit({
  title,
  busy,
  onPress,
}: {
  title: string
  busy: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: c.green,
        borderRadius: 32,
        minHeight: m.touch,
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: m.inset,
        alignItems: 'center',
        opacity: busy || pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: c.surface, fontSize: m.body, fontWeight: '700' }}>
        {title}
      </Text>
    </Pressable>
  )
}
