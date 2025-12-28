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

// --- 文件同步逻辑 ---
export async function syncToFile() {
  // 仅在开发环境或支持API的环境下运行
  try {
    const samples = await db.samples.toArray()
    const works = await db.works.toArray()
    const settings = await db.settings.get(1)

    const data = {
      samples,
      works,
      settings
    }

    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  } catch (e) {
    console.error('Sync to file failed:', e)
  }
}

export async function loadFromFile() {
  try {
    const res = await fetch('/api/data')
    if (!res.ok) return

    const data = await res.json()

    // 检查本地是否有数据
    const localSampleCount = await db.samples.count()
    const remoteSampleCount = data.samples?.length || 0

    // 策略：
    // 始终以远程文件为准（覆盖本地）
    // 这样确保本地文件是唯一的数据源

    await db.transaction('rw', db.samples, db.works, db.settings, db.characters, async () => {
      // 清空现有数据
      await db.samples.clear()
      await db.works.clear()
      await db.settings.clear()
      await db.characters.clear()

      // 导入数据
      if (data.samples?.length) {
        await db.samples.bulkAdd(data.samples)

        // 重建 characters 索引
        const charMap = new Map<string, number>()
        data.samples.forEach((s: CharacterSample) => {
          charMap.set(s.char, Math.max(charMap.get(s.char) || 0, s.createdAt))
        })

        const chars = Array.from(charMap.entries()).map(([char, updatedAt]) => ({
          char,
          samples: [],
          updatedAt
        }))
        await db.characters.bulkAdd(chars)
      }

      if (data.works?.length) await db.works.bulkAdd(data.works)
      if (data.settings) await db.settings.add(data.settings)
    })
  } catch (e) {
    console.error('Load from file failed:', e)
  }
}

// 初始化设置
export async function initSettings() {
  // 尝试从文件加载
  await loadFromFile()

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
    // 保存默认设置到文件
    syncToFile()
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
  syncToFile()
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
  syncToFile()
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
  syncToFile()
}

export async function getWorks(): Promise<Work[]> {
  return await db.works.orderBy('createdAt').reverse().toArray()
}

export async function getWork(id: string): Promise<Work | undefined> {
  return await db.works.get(id)
}

export async function deleteWork(id: string) {
  await db.works.delete(id)
  syncToFile()
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
  syncToFile()
}
