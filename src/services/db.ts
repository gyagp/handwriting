import Dexie, { Table } from 'dexie'
import type { CharacterCollection, CharacterSample, AppSettings, Work } from '@/types'

class HandwritingDatabase extends Dexie {
  characters!: Table<CharacterCollection>
  samples!: Table<CharacterSample>
  settings!: Table<AppSettings>
  works!: Table<Work>

  constructor() {
    super('HandwritingDB')

    this.version(1).stores({
      characters: 'char, updatedAt',
      samples: 'id, char, createdAt, rating',
      settings: 'id' // 单例，id=1
    })

    this.version(2).stores({
      works: 'id, createdAt'
    })
  }
}

export const db = new HandwritingDatabase()

// 初始化设置
export async function initSettings() {
  const count = await db.settings.count()
  if (count === 0) {
    await db.settings.add({
      // @ts-ignore
      id: 1,
      gridType: 'mi',
      gridSize: 100,
      autoRecognize: true,
      compressionLevel: 5,
      theme: 'light'
    })
  }
}

// 获取设置
export async function getSettings(): Promise<AppSettings> {
  const settings = await db.settings.get(1)
  return settings as AppSettings
}

// 保存设置
export async function saveSettings(settings: Partial<AppSettings>) {
  await db.settings.update(1, settings)
}

// 保存样本
export async function saveSample(sample: CharacterSample) {
  await db.transaction('rw', db.characters, db.samples, async () => {
    // 1. 保存样本
    await db.samples.put(sample)

    // 2. 更新字符集合状态
    const charEntry = await db.characters.get(sample.char)
    if (charEntry) {
      // 如果已存在，更新列表（这里只存引用或简要信息，或者直接不存samples数组在characters表里，而是查询时联表）
      // 为了简单，我们在characters表里只存元数据，samples通过索引查询
      await db.characters.update(sample.char, {
        updatedAt: Date.now()
      })
    } else {
      await db.characters.add({
        char: sample.char,
        samples: [], // 实际不存完整sample
        updatedAt: Date.now()
      })
    }
  })
}

// 获取某个字的所有样本
export async function getSamplesByChar(char: string): Promise<CharacterSample[]> {
  return await db.samples.where('char').equals(char).reverse().sortBy('createdAt')
}

// 获取所有已收集的字
export async function getCollectedChars(): Promise<string[]> {
  const chars = await db.characters.toArray()
  return chars.map(c => c.char)
}

// 获取所有已收集的字及其最新样本
export async function getCollectedSamplesMap(): Promise<Record<string, CharacterSample>> {
  const samples = await db.samples.orderBy('createdAt').toArray()
  const map: Record<string, CharacterSample> = {}
  // 遍历所有样本，由于是按时间正序，后面的会覆盖前面的，所以最后map里存的是最新的
  // 为了性能，如果数据量巨大，可以优化。目前几千个字问题不大。
  for (const s of samples) {
    map[s.char] = s
  }
  return map
}

// 作品相关操作
export async function saveWork(work: Work) {
  work.updatedAt = Date.now()
  await db.works.put(work)
}

export async function getWorks(): Promise<Work[]> {
  return await db.works.orderBy('createdAt').reverse().toArray()
}

export async function getWork(id: string): Promise<Work | undefined> {
  return await db.works.get(id)
}

export async function deleteWork(id: string) {
  await db.works.delete(id)
}

// 删除样本
export async function deleteSample(id: string) {
  const sample = await db.samples.get(id)
  if (sample) {
    await db.samples.delete(id)
    // 检查是否还有该字的样本
    const count = await db.samples.where('char').equals(sample.char).count()
    if (count === 0) {
      await db.characters.delete(sample.char)
    }
  }
}
