import { getUnavailableFeature } from '../src/lib/unavailable-features'

describe('未开放功能说明', () => {
  it.each([
    ['explore', '探索'],
    ['nearby', '附近'],
    ['shop', '商城'],
    ['daily-inspiration', '每日灵感'],
    ['tasks', '任务'],
    ['growth', '成长'],
    ['messages', '私信'],
    ['auto-book', '自动成册'],
  ])('%s 只展示用途和未开放状态', (key, title) => {
    const feature = getUnavailableFeature(key)

    expect(feature.title).toBe(title)
    expect(feature.status).toBe('未开放')
    expect(feature.description.length).toBeGreaterThan(0)
  })

  it('未知入口不显示虚构内容', () => {
    expect(getUnavailableFeature('unknown')).toEqual({
      title: '暂缓功能',
      description: '该功能正在规划中。',
      status: '未开放',
    })
  })
})
