import type { CharacterSample, AppSettings, Work, User, Rating, CharacterStats } from '@/types'
import { ref } from 'vue'
import { generateGB2312Level1Chars, generateGB2312Level2Chars } from '@/data/gb2312-generator'

// In-memory store
interface LocalData {
  users: User[]
  samples: CharacterSample[]
  works: Work[]
  ratings: Rating[]
  settings: AppSettings | null
}

let store: LocalData = {
  users: [],
  samples: [],
  works: [],
  ratings: [],
  settings: null
}

// Cache for allowed characters
let allowedChars: Set<string> | null = null

function getAllowedChars(): Set<string> {
  if (!allowedChars) {
    const punctuation = ['，', '。', '！', '？', '、', '；', '：', '“', '”', '‘', '’', '（', '）', '【', '】', '《', '》', '…', '—', '·']
    allowedChars = new Set([
      ...generateGB2312Level1Chars(),
      ...generateGB2312Level2Chars(),
      ...punctuation
    ])
  }
  return allowedChars
}

// Current User State
export const currentUser = ref<User | null>(null)

// --- User Management ---

function getUsernameLength(str: string) {
  let len = 0
  for (const char of str) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      len += 2
    } else {
      len += 1
    }
  }
  return len
}

export async function registerUser(username: string, password?: string): Promise<User> {
  // Username validation
  if (!username) throw new Error('用户名不能为空')

  // Check allowed characters: Chinese, numbers, letters, _, ., -
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_.-]+$/.test(username)) {
    throw new Error('用户名只允许使用汉字、数字、字母、下划线、点和短横线')
  }

  const nameLen = getUsernameLength(username)
  if (nameLen < 4 || nameLen > 30) {
    throw new Error('用户名长度需为4至30个字符(1个汉字=2个字符)')
  }

  // Password validation
  if (!password) throw new Error('密码不能为空')
  if (password.length < 7 || password.length > 16) {
    throw new Error('密码长度必须是7-16位')
  }
  if (/^\d+$/.test(password)) {
    throw new Error('密码不能是纯数字')
  }
  // Optional: Check if password contains only allowed characters (letters, numbers, symbols)
  // The requirement says "英文字母、数字、字符组合", usually implies ASCII printable characters.
  // Let's assume standard keyboard characters.

  if (store.users.find(u => u.username === username)) {
    throw new Error('用户名已存在')
  }
  const user: User = {
    id: crypto.randomUUID(),
    username,
    password,
    role: 'user',
    createdAt: Date.now(),
    collectionVisibility: 'private'
  }
  store.users.push(user)
  await syncToFile()
  return user
}

export async function loginUser(username: string, password?: string): Promise<User> {
  const user = store.users.find(u => u.username === username)
  if (!user) {
    throw new Error('User not found')
  }
  // In a real app, check password. For now, simple login.
  if (user.password && user.password !== password) {
     throw new Error('Invalid password')
  }
  // Ensure default visibility
  if (!user.collectionVisibility) user.collectionVisibility = 'private'

  currentUser.value = user
  localStorage.setItem('last_user', user.username)
  return user
}

export async function loginAsGuest(): Promise<User> {
  const guestUser: User = {
    id: 'guest-' + crypto.randomUUID(),
    username: '游客',
    role: 'guest',
    createdAt: Date.now(),
    collectionVisibility: 'private'
  }
  currentUser.value = guestUser
  return guestUser
}

export function logoutUser() {
  currentUser.value = null
  localStorage.removeItem('last_user')
}

export function getCurrentUser() {
  return currentUser.value
}

export async function getAllUsers(): Promise<User[]> {
  if (currentUser.value?.role !== 'admin') throw new Error('Admin only')
  return store.users
}

export async function updateUser(user: User) {
  if (currentUser.value?.role !== 'admin') throw new Error('Admin only')
  const index = store.users.findIndex(u => u.id === user.id)
  if (index === -1) throw new Error('User not found')

  // Prevent modifying admin itself via this if needed, but admin can modify admin
  store.users[index] = user
  await syncToFile()
}

export function getUsername(userId: string): string {
  const user = store.users.find(u => u.id === userId)
  if (user) return user.username
  if (userId.startsWith('guest-')) return '游客'
  return 'Unknown'
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
    const res = await fetch('/api/data?t=' + Date.now())
    if (!res.ok) return

    const data = await res.json()

    store.users = data.users || []
    store.samples = data.samples || []
    store.works = data.works || []
    store.ratings = data.ratings || []
    store.settings = data.settings || null

    // Migration: Convert 100-point scale to 10-point scale
    let migrationNeeded = false
    store.ratings.forEach(r => {
      if (r.score > 10) {
        r.score = r.score / 10
        migrationNeeded = true
      }
    })
    store.samples.forEach(s => {
      if (s.score && s.score > 10) {
        s.score = s.score / 10
        migrationNeeded = true
      }
    })
    store.works.forEach(w => {
      if (w.score && w.score > 10) {
        w.score = w.score / 10
        migrationNeeded = true
      }
    })

    if (migrationNeeded) {
      await syncToFile()
    }

  } catch (e) {
    console.error('Load from file failed:', e)
  }
}

// 初始化设置
export async function initSettings() {
  // 尝试从文件加载
  await loadFromFile()

  // Ensure admin user exists
  let adminUser = store.users.find(u => u.username === 'admin')
  if (!adminUser) {
    adminUser = {
      id: crypto.randomUUID(),
      username: 'admin',
      password: 'admin12345',
      role: 'admin',
      createdAt: Date.now()
    }
    store.users.push(adminUser)
  } else {
    if (adminUser.role !== 'admin') {
      adminUser.role = 'admin'
    }
    if (adminUser.password !== 'admin12345') {
      adminUser.password = 'admin12345'
    }
  }

  // Ensure gyagp user exists
  let gyagpUser = store.users.find(u => u.username === 'gyagp')
  if (!gyagpUser) {
    gyagpUser = {
      id: crypto.randomUUID(),
      username: 'gyagp',
      password: 'gy12345',
      role: 'user',
      createdAt: Date.now()
    }
    store.users.push(gyagpUser)
  } else {
    if (gyagpUser.role !== 'user') {
      gyagpUser.role = 'user'
    }
    if (gyagpUser.password !== 'gy12345') {
      gyagpUser.password = 'gy12345'
    }
  }

  // Auto login default user or last user
  const lastUser = localStorage.getItem('last_user')
  if (lastUser) {
      const user = store.users.find(u => u.username === lastUser)
      if (user) currentUser.value = user
  }

  // If no user logged in, login gyagp
  // if (!currentUser.value) {
  //     currentUser.value = gyagpUser
  // }

  // Migrate data: Assign unowned items to gyagp
  // const adminUser = store.users.find(u => u.role === 'admin') // Already declared above

  store.samples.forEach(s => {
      if (!s.userId || (adminUser && s.userId === adminUser.id)) {
          s.userId = gyagpUser!.id
          if (!s.visibility) s.visibility = 'private'
      }
  })
  store.works.forEach(w => {
      if (!w.userId || (adminUser && w.userId === adminUser.id)) {
          w.userId = gyagpUser!.id
          if (!w.visibility) w.visibility = 'public'
          if (!w.status) w.status = 'published'
      }
      if (!w.status) {
        w.status = w.visibility === 'public' ? 'published' : 'draft'
      }
  })

  if (!store.settings) {
    store.settings = {
      // @ts-ignore
      id: 1,
      gridType: 'none',
      defaultLayout: 'horizontal',
      gridSize: 100,
      compressionLevel: 5,
      theme: 'light',
      defaultVisibility: 'private'
    } as AppSettings
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

  const defaultUser = store.users.find(u => u.username === 'gyagp') || currentUser.value
  if (!defaultUser) return

  for (const work of defaultWorks) {
    if (!existingTitles.has(work.title)) {
      store.works.push({
        id: crypto.randomUUID(),
        userId: defaultUser.id,
        visibility: 'public',
        status: 'published',
        title: work.title,
        author: work.author,
        content: work.content,
        charStyles: {},
        charAdjustments: {},
        layout: 'horizontal',
        gridType: 'none',
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

// --- Rating System ---

export async function saveRating(targetId: string, targetType: 'sample' | 'work', score: number) {
  if (!currentUser.value) throw new Error('Must be logged in')
  if (currentUser.value.role === 'guest') throw new Error('游客不能评分')
  if (score < 0 || score > 10) throw new Error('Score must be 0-10')

  const existingIndex = store.ratings.findIndex(r =>
    r.userId === currentUser.value!.id &&
    r.targetId === targetId &&
    r.targetType === targetType
  )

  if (existingIndex >= 0) {
    store.ratings[existingIndex].score = score
    store.ratings[existingIndex].createdAt = Date.now()
  } else {
    store.ratings.push({
      userId: currentUser.value.id,
      targetId,
      targetType,
      score,
      createdAt: Date.now()
    })
  }

  // Update average score on target
  updateAverageScore(targetId, targetType)

  await syncToFile()
}

function updateAverageScore(targetId: string, targetType: 'sample' | 'work') {
  const ratings = store.ratings.filter(r => r.targetId === targetId && r.targetType === targetType)
  if (ratings.length === 0) return

  const total = ratings.reduce((sum, r) => sum + r.score, 0)
  // Keep 1 decimal place
  const avg = Math.round((total / ratings.length) * 10) / 10

  if (targetType === 'sample') {
    const sample = store.samples.find(s => s.id === targetId)
    if (sample) sample.score = avg
  } else {
    const work = store.works.find(w => w.id === targetId)
    if (work) work.score = avg
  }
}

export function getMyRating(targetId: string, targetType: 'sample' | 'work'): number | undefined {
  if (!currentUser.value) return undefined
  const rating = store.ratings.find(r =>
    r.userId === currentUser.value!.id &&
    r.targetId === targetId &&
    r.targetType === targetType
  )
  return rating?.score
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
  if (!currentUser.value) throw new Error('Must be logged in')

  // Validate character against GB2312
  if (!getAllowedChars().has(sample.char)) {
    throw new Error(`Character '${sample.char}' is not in the allowed character set (GB2312).`)
  }

  // Check if sample exists (by id)
  const index = store.samples.findIndex(s => s.id === sample.id)

  if (currentUser.value.role === 'admin') {
    if (index === -1) {
      throw new Error('Admin cannot create samples')
    }
    // Admin can only modify public samples
    if (store.samples[index].visibility !== 'public') {
      throw new Error('Admin can only manage public data')
    }
    // Allow update
    store.samples[index] = sample
  } else {
    // Normal user
    if (index >= 0) {
      if (store.samples[index].userId !== currentUser.value.id) {
        throw new Error('Permission denied')
      }
      store.samples[index] = sample
    } else {
      sample.userId = currentUser.value.id
      if (!sample.visibility) {
        // Use default visibility from settings if available
        sample.visibility = store.settings?.defaultVisibility || 'private'
      }
      store.samples.push(sample)
    }
  }
  await syncToFile()
}

export async function setAllVisibility(visibility: 'public' | 'private') {
  if (!currentUser.value) throw new Error('Must be logged in')

  // Update user setting
  const userIndex = store.users.findIndex(u => u.id === currentUser.value!.id)
  if (userIndex >= 0) {
    store.users[userIndex].collectionVisibility = visibility
    currentUser.value.collectionVisibility = visibility
    await syncToFile()
  }
}

// 获取某个字的所有样本
export async function getSamplesByChar(char: string): Promise<CharacterSample[]> {
  // Ensure we have the latest data from other users
  await loadFromFile()

  const currentUserId = currentUser.value?.id
  const isAdmin = currentUser.value?.role === 'admin'

  return store.samples
    .filter(s => s.char === char)
    .filter(s => {
      // My samples
      if (s.userId === currentUserId) return true
      // Admin samples (always public if marked public)
      const owner = store.users.find(u => u.id === s.userId)
      if (owner?.role === 'admin' && s.visibility === 'public') return true
      // Other users' samples: Public Collection AND Refined
      if (owner?.role === 'user' && owner.collectionVisibility === 'public' && s.isRefined) return true

      return false
    })
    .sort((a, b) => {
      // Current user's samples always come first
      if (a.userId === currentUserId && b.userId !== currentUserId) return -1
      if (b.userId === currentUserId && a.userId !== currentUserId) return 1
      // Then sort by score desc
      return (b.score || 0) - (a.score || 0)
    })
}

// 获取所有已收集的字
export async function getCollectedChars(): Promise<string[]> {
  await loadFromFile()
  const currentUserId = currentUser.value?.id

  // Only return chars that have at least one visible sample
  const chars = new Set<string>()

  for (const s of store.samples) {
      let visible = false
      if (s.userId === currentUserId) visible = true
      else {
          const owner = store.users.find(u => u.id === s.userId)
          if (owner?.role === 'admin' && s.visibility === 'public') visible = true
          else if (owner?.role === 'user' && owner.collectionVisibility === 'public' && s.isRefined) visible = true
      }

      if (visible) chars.add(s.char)
  }

  return Array.from(chars)
}

// 获取所有已收集的字及其最新样本
export async function getCollectedSamplesMap(): Promise<Record<string, CharacterSample>> {
  await loadFromFile()
  const map: Record<string, CharacterSample> = {}
  const currentUserId = currentUser.value?.id

  // Only show my own samples, regardless of admin status or public visibility of others
  const visibleSamples = store.samples.filter(s => s.userId === currentUserId)

  // Sort by score ascending (so last one overwrites)
  visibleSamples.sort((a, b) => {
    const scoreA = a.score || 0
    const scoreB = b.score || 0
    if (scoreA !== scoreB) return scoreA - scoreB
    return a.createdAt - b.createdAt
  })

  for (const s of visibleSamples) {
    map[s.char] = s
  }

  return map
}

export async function getSamplesForWork(work: Work): Promise<CharacterSample[]> {
  await loadFromFile()
  const sampleIds = new Set(Object.values(work.charStyles))

  // Also include samples for title and author from the work's author
  // We filter out whitespace to avoid unnecessary checks
  const extraChars = new Set((work.title + (work.author || '')).split('').filter(c => c.trim()))

  // Return samples that match the IDs OR are needed for title/author, regardless of visibility
  // Because they are part of a visible work
  return store.samples.filter(s => {
      if (sampleIds.has(s.id)) return true
      if (extraChars.has(s.char) && s.userId === work.userId) return true
      return false
  })
}

export async function getWorkStats(works: Work[]): Promise<Record<string, number>> {
  await loadFromFile()
  const stats: Record<string, number> = {}

  // Build lookup
  const userCharSet = new Set<string>()
  for (const s of store.samples) {
    userCharSet.add(`${s.userId}_${s.char}`)
  }

  for (const work of works) {
    let count = 0
    const fullText = (work.title || '') + (work.author || '') + work.content
    for (const char of fullText) {
      if (/\s/.test(char)) continue
      if (userCharSet.has(`${work.userId}_${char}`)) {
        count++
      }
    }
    stats[work.id] = count
  }
  return stats
}

export async function getCollectedStatsMap(): Promise<Record<string, CharacterStats>> {
  const map: Record<string, CharacterStats> = {}
  const currentUserId = currentUser.value?.id
  const isAdmin = currentUser.value?.role === 'admin'

  let targetSamples = store.samples
  if (!isAdmin) {
    targetSamples = store.samples.filter(s => s.userId === currentUserId)
  }

  for (const s of targetSamples) {
    if (!map[s.char]) {
      map[s.char] = {
        sample: s,
        totalCount: 0,
        adjustedCount: 0
      }
    }

    // Update representative sample (prioritize high score)
    const currentBest = map[s.char].sample
    const scoreS = s.score || 0
    const scoreBest = currentBest.score || 0

    if (scoreS > scoreBest) {
      map[s.char].sample = s
    } else if (scoreS === scoreBest) {
      if (s.createdAt > currentBest.createdAt) {
        map[s.char].sample = s
      }
    }

    // Update counts
    map[s.char].totalCount++
    if (s.isAdjusted) {
      map[s.char].adjustedCount++
    }
  }
  return map
}

export async function getUnrefinedChars(): Promise<string[]> {
  const currentUserId = currentUser.value?.id
  if (!currentUserId) return []

  const mySamples = store.samples.filter(s => s.userId === currentUserId)
  const charStatus: Record<string, { total: number, adjusted: number }> = {}

  for (const s of mySamples) {
    if (!charStatus[s.char]) {
      charStatus[s.char] = { total: 0, adjusted: 0 }
    }
    charStatus[s.char].total++
    if (s.isAdjusted) {
      charStatus[s.char].adjusted++
    }
  }

  // Return chars where adjusted < total (has unadjusted samples)
  return Object.keys(charStatus).filter(char => {
      const status = charStatus[char]
      return status.adjusted < status.total
  })
}

// 作品相关操作
export async function saveWork(work: Work) {
  if (!currentUser.value) throw new Error('Must be logged in')

  work.updatedAt = Date.now()

  // Determine status logic
  if (currentUser.value.role === 'admin') {
     // Admin can publish directly
     if (work.visibility === 'public') {
        work.status = 'published'
     }
  } else {
     // Normal user
     if (work.visibility === 'public') {
        // If it's already published (approved), keep it published (unless we want to re-approve on edit?)
        // Requirement: "Once public, only admin can modify or delete".
        // So user shouldn't be able to edit a published public work.
        // But if it's a new submission or pending:
        if (work.status !== 'published') {
            work.status = 'pending'
        }
     } else {
        // Private works are always published (active)
        work.status = 'published'
     }
  }

  const index = store.works.findIndex(w => w.id === work.id)

  if (index >= 0) {
    // Update existing
    const existingWork = store.works[index]

    if (currentUser.value.role === 'admin') {
       // Admin can edit any public work or own work
       if (existingWork.visibility !== 'public' && existingWork.userId !== currentUser.value.id) {
          throw new Error('Admin can only manage public data or own data')
       }
       store.works[index] = work
    } else {
       // Normal user can only edit own work
       if (existingWork.userId !== currentUser.value.id) {
         throw new Error('Permission denied')
       }

       // Check if user is trying to edit a published public work
       if (existingWork.visibility === 'public' && existingWork.status === 'published') {
           // Requirement: "作品一旦公开，admin之外无权修改或删除"
           // But maybe they can change it back to private?
           // "Once public... admin only".
           // Let's strictly forbid editing content if it's public & published.
           // Unless they are changing it to private?
           // If they change visibility to private, then it's no longer "public work".
           if (work.visibility === 'public') {
               // Allow owner to modify writing (styles/adjustments/refined status)
               // But forbid modifying content/title/author
               if (work.content !== existingWork.content ||
                   work.title !== existingWork.title ||
                   work.author !== existingWork.author) {
                   throw new Error('已公开的作品无法修改内容，请联系管理员')
               }
               // If content is same, allow update (it's just writing update)
           }
       }

       store.works[index] = work
    }
  } else {
    // Create new
    work.userId = currentUser.value.id
    // work.visibility is already set by the caller (WorkEditor)
    // work.status is already set by the logic above
    if (work.isRefined === undefined) work.isRefined = false

    if (!work.createdAt) work.createdAt = Date.now()
    store.works.push(work)
  }
  await syncToFile()
}

export async function approveWork(workId: string, approved: boolean) {
  if (currentUser.value?.role !== 'admin') throw new Error('Admin only')

  const work = store.works.find(w => w.id === workId)
  if (!work) throw new Error('Work not found')

  work.status = approved ? 'published' : 'rejected'
  work.updatedAt = Date.now()
  await syncToFile()
}

export async function getWorks(): Promise<Work[]> {
  const currentUserId = currentUser.value?.id
  const isAdmin = currentUser.value?.role === 'admin'

  return [...store.works]
    .filter(w => {
      // 1. Own works are visible to the user
      if (w.userId === currentUserId) return true

      // 2. Public works (Templates)
      // Requirement: "审核通过后，该作品公开，所有用户可见"
      if (w.visibility === 'public' && w.status === 'published') return true

      // 3. Other Users' Refined Instances (Writing Visibility)
      // Requirement: "已精修且处于公开状态的书写，所有普通账户和游客可见"
      if (w.visibility === 'private' && w.isRefined) {
          const owner = store.users.find(u => u.id === w.userId)
          if (owner && owner.collectionVisibility === 'public') {
              return true
          }
      }

      // 4. Admin sees pending works
      if (isAdmin) return true

      return false
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0)) // Sort by score
}

export async function getRelatedPublicWorks(title: string, excludeId?: string): Promise<Work[]> {
  await loadFromFile()
  const currentUserId = currentUser.value?.id

  // Get stats for completeness check
  // const stats = await getWorkStats(store.works)

  return store.works.filter(w => {
    if (w.id === excludeId) return false
    if (w.title.trim() !== title.trim()) return false
    if (w.visibility !== 'public') return false
    if (w.userId === currentUserId) return false // Exclude my own works (they are in My Works)

    // Check completeness (ignore punctuation)
    // Only count Chinese characters, letters, and numbers
    // const validChars = w.content.split('').filter(c => /[a-zA-Z0-9\u4e00-\u9fa5]/.test(c)).length
    // const writtenCount = stats[w.id] || 0
    // return writtenCount >= validChars && validChars > 0
    return true
  }).sort((a, b) => (b.score || 0) - (a.score || 0))
}

export async function getWork(id: string): Promise<Work | undefined> {
  const work = store.works.find(w => w.id === id)
  if (!work) return undefined

  const currentUserId = currentUser.value?.id
  const isAdmin = currentUser.value?.role === 'admin'

  if (work.userId === currentUserId) return work
  if (isAdmin) return work
  if (work.visibility === 'public') return work

  return undefined
}

export async function deleteWork(id: string) {
  const work = store.works.find(w => w.id === id)
  if (!work) return

  if (currentUser.value?.role === 'admin') {
    // Admin can delete anything, but let's stick to the rule: admin manages public data
    // Actually admin should be able to delete any public work.
    // If admin deletes, it's gone for good.
    store.works = store.works.filter(w => w.id !== id)
  } else {
    if (work.userId !== currentUser.value?.id) {
      throw new Error('Permission denied')
    }

    // Ordinary users can only delete private works or non-published public works (pending/rejected)
    if (work.visibility === 'public' && work.status === 'published') {
      throw new Error('已公开的作品无法删除')
    }

    // Private works are permanently deleted
    store.works = store.works.filter(w => w.id !== id)
  }

  await syncToFile()
}

// 删除样本
export async function deleteSample(id: string) {
  const sample = store.samples.find(s => s.id === id)
  if (!sample) return

  if (currentUser.value?.role === 'admin') {
    if (sample.visibility !== 'public') {
      throw new Error('Admin can only manage public data')
    }
  } else {
    if (sample.userId !== currentUser.value?.id) {
      throw new Error('Permission denied')
    }
  }

  store.samples = store.samples.filter(s => s.id !== id)
  await syncToFile()
}

export async function collectWork(workId: string) {
  if (!currentUser.value) throw new Error('Must be logged in')

  const work = store.works.find(w => w.id === workId)
  if (!work) throw new Error('Work not found')

  // Check if already collected (by checking if I have a work with same title/content? Or just allow duplicates?)
  // The prompt says "add public works to own collection... unrefined state".
  // Let's allow duplicates for now, or check if we already have a work with same title/content.
  // But user might want multiple versions.

  const newWork: Work = {
    id: crypto.randomUUID(),
    userId: currentUser.value.id,
    visibility: 'private', // Always private initially
    status: 'published', // Private works are published/active
    title: work.title,
    author: work.author,
    content: work.content,
    charStyles: {}, // Start fresh or copy? "Unrefined" implies we need to select handwriting.
    charAdjustments: {},
    layout: work.layout,
    gridType: work.gridType,
    isRefined: false, // Unrefined state
    createdAt: Date.now(),
    updatedAt: Date.now(),
    originWorkId: work.id
  }

  store.works.push(newWork)

  if (!currentUser.value.collectedWorkIds) currentUser.value.collectedWorkIds = []
  if (!currentUser.value.collectedWorkIds.includes(workId)) {
    currentUser.value.collectedWorkIds.push(workId)
  }

  await syncToFile()
}

export async function uncollectWork(workId: string) {
  // This is now just deleting my work
  await deleteWork(workId)
}

export async function clearAllData() {
  store.samples = []
  store.works = []
  store.settings = null

  await syncToFile()
  // Re-init settings to defaults
  await initSettings()
}
