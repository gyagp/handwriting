import type { CharacterCollection, CharacterSample, AppSettings, Work } from '@/types'

// In-memory store
interface LocalData {
  samples: CharacterSample[]
  works: Work[]
  settings: AppSettings | null
}

let store: LocalData = {
  samples: [],
  works: [],
  settings: null
}

// --- 文件同步逻辑 ---
export async function syncToFile() {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(store)
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
    
    store.samples = data.samples || []
    store.works = data.works || []
    store.settings = data.settings || null
    
  } catch (e) {
    console.error('Load from file failed:', e)
  }
}

// 初始化设置
export async function initSettings() {
  // 尝试从文件加载
  await loadFromFile()

  if (!store.settings) {
    store.settings = {
      // @ts-ignore
      id: 1,
      gridType: 'mi',
      gridSize: 100,
      autoRecognize: true,
      compressionLevel: 5,
      theme: 'light'
    } as AppSettings
    // 保存默认设置到文件
    await syncToFile()
  }

  await initDefaultWorks()
}

export async function initDefaultWorks() {
  const defaultWorks = [
    {
      title: '将进酒',
      author: '[唐] 李白',
      content: '君不见黄河之水天上来，奔流到海不复回。君不见高堂明镜悲白发，朝如青丝暮成雪。人生得意须尽欢，莫使金樽空对月。天生我材必有用，千金散尽还复来。烹羊宰牛且为乐，会须一饮三百杯。岑夫子，丹丘生，将进酒，杯莫停。与君歌一曲，请君为我倾耳听。钟鼓馔玉不足贵，但愿长醉不复醒。古来圣贤皆寂寞，惟有饮者留其名。陈王昔时宴平乐，斗酒十千恣欢谑。主人何为言少钱，径须沽取对君酌。五花马，千金裘，呼儿将出换美酒，与尔同销万古愁。'
    },
    {
      title: '满江红',
      author: '[宋] 岳飞',
      content: '怒发冲冠，凭栏处、潇潇雨歇。抬望眼，仰天长啸，壮怀激烈。三十功名尘与土，八千里路云和月。莫等闲、白了少年头，空悲切。靖康耻，犹未雪。臣子恨，何时灭。驾长车，踏破贺兰山缺。壮志饥餐胡虏肉，笑谈渴饮匈奴血。待从头、收拾旧山河，朝天阙。'
    },
    {
      title: '水调歌头',
      author: '[宋] 苏轼',
      content: '明月几时有？把酒问青天。不知天上宫阙，今夕是何年。我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在人间。转朱阁，低绮户，照无眠。不应有恨，何事长向别时圆？人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。'
    },
    {
      title: '长恨歌',
      author: '[唐] 白居易',
      content: '汉皇重色思倾国，御宇多年求不得。杨家有女初长成，养在深闺人未识。天生丽质难自弃，一朝选在君王侧。回眸一笑百媚生，六宫粉黛无颜色。春寒赐浴华清池，温泉水滑洗凝脂。侍儿扶起娇无力，始是新承恩泽时。云鬓花颜金步摇，芙蓉帐暖度春宵。春宵苦短日高起，从此君王不早朝。承欢侍宴无闲暇，春从春游夜专夜。后宫佳丽三千人，三千宠爱在一身。金屋妆成娇侍夜，玉楼宴罢醉和春。姊妹弟兄皆列土，可怜光彩生门户。遂令天下父母心，不重生男重生女。骊宫高处入青云，仙乐风飘处处闻。缓歌慢舞凝丝竹，尽日君王看不足。渔阳鼙鼓动地来，惊破霓裳羽衣曲。九重城阙烟尘生，千乘万骑西南行。翠华摇摇行复止，西出都门百余里。六军不发无奈何，宛转蛾眉马前死。花钿委地无人收，翠翘金雀玉搔头。君王掩面救不得，回看血泪相和流。黄埃散漫风萧索，云栈萦纡登剑阁。峨嵋山下少人行，旌旗无光日色薄。蜀江水碧蜀山青，圣主朝朝暮暮情。行宫见月伤心色，夜雨闻铃肠断声。天旋地转回龙驭，到此踌躇不能去。马嵬坡下泥土中，不见玉颜空死处。君臣相顾尽沾衣，东望都门信马归。归来池苑皆依旧，太液芙蓉未央柳。芙蓉如面柳如眉，对此如何不泪垂。春风桃李花开日，秋雨梧桐叶落时。西宫南内多秋草，落叶满阶红不扫。梨园弟子白发新，椒房阿监青娥老。夕殿萤飞思悄然，孤灯挑尽未成眠。迟迟钟鼓初长夜，耿耿星河欲曙天。鸳鸯瓦冷霜华重，翡翠衾寒谁与共。悠悠生死别经年，魂魄不曾来入梦。临邛道士鸿都客，能以精诚致魂魄。为感君王辗转思，遂教方士殷勤觅。排空驭气奔如电，升天入地求之遍。上穷碧落下黄泉，两处茫茫皆不见。忽闻海上有仙山，山在虚无缥缈间。楼阁玲珑五云起，其中绰约多仙子。中有一人字太真，雪肤花貌参差是。金阙西厢叩玉扃，转教小玉报双成。闻道汉家天子使，九华帐里梦魂惊。揽衣推枕起徘徊，珠箔银屏迤逦开。云鬓半偏新睡觉，花冠不整下堂来。风吹仙袂飘飘举，犹似霓裳羽衣舞。玉容寂寞泪阑干，梨花一枝春带雨。含情凝睇谢君王，一别音容两渺茫。昭阳殿里恩爱绝，蓬莱宫中日月长。回头下望人寰处，不见长安见尘雾。惟将旧物表深情，钿合金钗寄将去。钗留一股合一扇，钗擘黄金合分钿。但教心似金钿坚，天上人间会相见。临别殷勤重寄词，词中有誓两心知。七月七日长生殿，夜半无人私语时。在天愿作比翼鸟，在地愿为连理枝。天长地久有时尽，此恨绵绵无绝期。'
    },
    {
      title: '念奴娇·赤壁怀古',
      author: '[宋] 苏轼',
      content: '大江东去，浪淘尽，千古风流人物。故垒西边，人道是，三国周郎赤壁。乱石穿空，惊涛拍岸，卷起千堆雪。江山如画，一时多少豪杰。遥想公瑾当年，小乔初嫁了，雄姿英发。羽扇纶巾，谈笑间，樯橹灰飞烟灭。故国神游，多情应笑我，早生华发。人生如梦，一尊还酹江月。'
    },
    {
      title: '虞美人',
      author: '[五代] 李煜',
      content: '春花秋月何时了？往事知多少。小楼昨夜又东风，故国不堪回首月明中。雕栏玉砌应犹在，只是朱颜改。问君能有几多愁？恰似一江春水向东流。'
    },
    {
      title: '天净沙·秋思',
      author: '[元] 马致远',
      content: '枯藤老树昏鸦，小桥流水人家，古道西风瘦马。夕阳西下，断肠人在天涯。'
    },
    {
      title: '春江花月夜',
      author: '[唐] 张若虚',
      content: '春江潮水连海平，海上明月共潮生。滟滟随波千万里，何处春江无月明！江流宛转绕芳甸，月照花林皆似霰。空里流霜不觉飞，汀上白沙看不见。江天一色无纤尘，皎皎空中孤月轮。江畔何人初见月？江月何年初照人？人生代代无穷已，江月年年望相似。不知江月待何人，但见长江送流水。白云一片去悠悠，青枫浦上不胜愁。谁家今夜扁舟子？何处相思明月楼？可怜楼上月徘徊，应照离人妆镜台。玉户帘中卷不去，捣衣砧上拂还来。此时相望不相闻，愿逐月华流照君。鸿雁长飞光不度，鱼龙潜跃水成文。昨夜闲潭梦落花，可怜春半不还家。江水流春去欲尽，江潭落月复西斜。斜月沉沉藏海雾，碣石潇湘无限路。不知乘月几人归，落月摇情满江树。'
    },
    {
      title: '静夜思',
      author: '[唐] 李白',
      content: '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
    }
  ]

  const existingTitles = new Set(store.works.map(w => w.title))
  let hasNew = false

  for (const work of defaultWorks) {
    if (!existingTitles.has(work.title)) {
      store.works.push({
        id: crypto.randomUUID(),
        title: work.title,
        author: work.author,
        content: work.content,
        charStyles: {},
        charAdjustments: {},
        layout: 'vertical',
        gridType: 'mi',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      hasNew = true
    }
  }

  if (hasNew) {
    await syncToFile()
  }
}

// 获取设置
export async function getSettings(): Promise<AppSettings> {
  return store.settings as AppSettings
}

// 保存设置
export async function saveSettings(settings: Partial<AppSettings>) {
  store.settings = { ...store.settings, ...settings } as AppSettings
  await syncToFile()
}

// 保存样本
export async function saveSample(sample: CharacterSample) {
  // Check if sample exists (by id)
  const index = store.samples.findIndex(s => s.id === sample.id)
  if (index >= 0) {
    store.samples[index] = sample
  } else {
    store.samples.push(sample)
  }
  await syncToFile()
}

// 获取某个字的所有样本
export async function getSamplesByChar(char: string): Promise<CharacterSample[]> {
  return store.samples
    .filter(s => s.char === char)
    .sort((a, b) => b.createdAt - a.createdAt)
}

// 获取所有已收集的字
export async function getCollectedChars(): Promise<string[]> {
  const chars = new Set(store.samples.map(s => s.char))
  return Array.from(chars)
}

// 获取所有已收集的字及其最新样本
export async function getCollectedSamplesMap(): Promise<Record<string, CharacterSample>> {
  const map: Record<string, CharacterSample> = {}
  // Sort by createdAt asc so later ones overwrite earlier ones
  const sorted = [...store.samples].sort((a, b) => a.createdAt - b.createdAt)
  
  for (const s of sorted) {
    map[s.char] = s
  }
  return map
}

export interface CharacterStats {
  sample: CharacterSample
  totalCount: number
  adjustedCount: number
}

export async function getCollectedStatsMap(): Promise<Record<string, CharacterStats>> {
  const map: Record<string, CharacterStats> = {}
  const sorted = [...store.samples].sort((a, b) => a.createdAt - b.createdAt)

  for (const s of sorted) {
    if (!map[s.char]) {
      map[s.char] = {
        sample: s,
        totalCount: 0,
        adjustedCount: 0
      }
    }

    // Update latest sample
    map[s.char].sample = s

    // Update counts
    map[s.char].totalCount++
    if (s.isAdjusted) {
      map[s.char].adjustedCount++
    }
  }
  return map
}

// 作品相关操作
export async function saveWork(work: Work) {
  work.updatedAt = Date.now()
  const index = store.works.findIndex(w => w.id === work.id)
  if (index >= 0) {
    store.works[index] = work
  } else {
    store.works.push(work)
  }
  await syncToFile()
}

export async function getWorks(): Promise<Work[]> {
  return [...store.works].sort((a, b) => b.createdAt - a.createdAt)
}

export async function getWork(id: string): Promise<Work | undefined> {
  return store.works.find(w => w.id === id)
}

export async function deleteWork(id: string) {
  store.works = store.works.filter(w => w.id !== id)
  await syncToFile()
}

// 删除样本
export async function deleteSample(id: string) {
  store.samples = store.samples.filter(s => s.id !== id)
  await syncToFile()
}

export async function clearAllData() {
  store.samples = []
  store.works = []
  store.settings = null
  
  await syncToFile()
  // Re-init settings to defaults
  await initSettings()
}
