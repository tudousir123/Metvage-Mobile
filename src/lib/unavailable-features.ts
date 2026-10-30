export type UnavailableFeatureKey =
  | 'explore'
  | 'nearby'
  | 'shop'
  | 'daily-inspiration'
  | 'tasks'
  | 'growth'
  | 'messages'
  | 'auto-book'

export type UnavailableFeature = {
  title: string
  description: string
  status: '未开放'
}

export const unavailableFeatures: Record<UnavailableFeatureKey, UnavailableFeature> = {
  explore: {
    title: '探索',
    description: '未来可按兴趣发现宠物故事与社区内容。',
    status: '未开放',
  },
  nearby: {
    title: '附近',
    description: '未来可发现附近适合带宠物前往的地点。',
    status: '未开放',
  },
  shop: {
    title: '商城',
    description: '未来可浏览适合宠物的商品。',
    status: '未开放',
  },
  'daily-inspiration': {
    title: '每日灵感',
    description: '未来可获得记录宠物生活的灵感。',
    status: '未开放',
  },
  tasks: {
    title: '任务',
    description: '未来可参加日常记录任务。',
    status: '未开放',
  },
  growth: {
    title: '成长',
    description: '未来可回顾宠物的成长历程。',
    status: '未开放',
  },
  messages: {
    title: '私信',
    description: '未来可与其他养宠人私下交流。',
    status: '未开放',
  },
  'auto-book': {
    title: '自动成册',
    description: '未来可将宠物记录整理成纪念册。',
    status: '未开放',
  },
}

const unknownFeature: UnavailableFeature = {
  title: '暂缓功能',
  description: '该功能正在规划中。',
  status: '未开放',
}

export function getUnavailableFeature(key: string): UnavailableFeature {
  return Object.hasOwn(unavailableFeatures, key)
    ? unavailableFeatures[key as UnavailableFeatureKey]
    : unknownFeature
}
