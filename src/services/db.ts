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

// Cache control for loadFromFile
let _lastLoadTime = 0
let _loadPromise: Promise<void> | null = null
const LOAD_CACHE_TTL = 30_000 // 30 seconds — reuse in-memory data within this window

// =============================================
// Optimistic sync: fire-and-forget with rollback
// =============================================
import { showNotify } from 'vant'

/** Snapshot a piece of store state for rollback */
function snapshot<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/**
 * Fire a sync operation in the background.
 * If it fails, restore the snapshot and notify the user.
 */
function optimisticSync(
  syncFn: () => Promise<void>,
  rollbackFn: () => void,
  errorMsg = '同步失败，已回滚'
) {
  // Bump cache timer so loadFromFile() won't overwrite local changes
  // before the sync completes
  _lastLoadTime = Date.now()
  syncFn().then(() => {
    // After successful sync, bump again so reads stay fresh
    _lastLoadTime = Date.now()
  }).catch((e) => {
    console.error('Optimistic sync failed, rolling back:', e)
    rollbackFn()
    showNotify({ type: 'danger', message: errorMsg })
  })
}

// Cache for allowed characters
let allowedChars: Set<string> | null = null

function getAllowedChars(): Set<string> {
  if (!allowedChars) {
    const punctuation = ['，', '。', '！', '？', '、', '；', '：', '"', '"', '\u2018', '\u2019', '（', '）', '【', '】', '《', '》', '…', '—', '·']
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

// =============================================
// Granular sync helpers (replace old syncToFile)
// =============================================

/** Save current user's samples to server */
async function syncSamples() {
  if (!currentUser.value || currentUser.value.role === 'guest') return
  const userId = currentUser.value.id
  const mySamples = store.samples.filter(s => s.userId === userId)
  const res = await fetch(`/api/users/${userId}/samples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mySamples)
  })
  if (!res.ok) throw new Error('Sync samples failed')
}

/** Save current user's works to server */
async function syncWorks() {
  if (!currentUser.value || currentUser.value.role === 'guest') return
  const userId = currentUser.value.id
  const myWorks = store.works.filter(w => w.userId === userId)
  const res = await fetch(`/api/users/${userId}/works`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(myWorks)
  })
  if (!res.ok) throw new Error('Sync works failed')
}

/** Save a rating to server */
async function syncRating(userId: string, targetId: string, targetType: string, score: number, targetUserId?: string) {
  const res = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'saveRating',
      payload: { userId, targetId, targetType, score, targetUserId }
    })
  })
  if (!res.ok) throw new Error('Sync rating failed')
}

/** Save settings to server */
async function syncSettingsToServer(settings: Partial<AppSettings>) {
  const res = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'saveSettings', payload: settings })
  })
  if (!res.ok) throw new Error('Sync settings failed')
}

/** Update user fields on server */
async function syncUserUpdate(userId: string, updates: Record<string, any>) {
  const res = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'updateUser',
      payload: { userId, updates }
    })
  })
  if (!res.ok) throw new Error('Sync user update failed')
}

// Legacy syncToFile — kept as no-op for backward compat
export async function syncToFile() {
  // No-op: granular sync functions are used instead
}

// =============================================
// Data loading
// =============================================

export async function loadFromFile(force = false) {
  // Return cached data if still fresh
  if (!force && _lastLoadTime > 0 && Date.now() - _lastLoadTime < LOAD_CACHE_TTL) {
    return
  }
  // Dedup concurrent calls — reuse in-flight promise
  if (_loadPromise) return _loadPromise
  _loadPromise = _doLoadFromFile()
  try {
    await _loadPromise
  } finally {
    _loadPromise = null
  }
}

async function _doLoadFromFile() {
  try {
    const res = await fetch('/api/data')
    if (!res.ok) return

    const data = await res.json()

    store.users = data.users || []
    store.samples = data.samples || []
    store.works = data.works || []
    store.ratings = data.ratings || []
    store.settings = data.settings || null

    // Migration: Convert 100-point scale to 10-point scale (local only)
    store.ratings.forEach(r => {
      if (r.score > 10) r.score = r.score / 10
    })
    store.samples.forEach(s => {
      if (s.score && s.score > 10) s.score = s.score / 10
    })
    store.works.forEach(w => {
      if (w.score && w.score > 10) w.score = w.score / 10
    })

    _lastLoadTime = Date.now()
  } catch (e) {
    console.error('Load from file failed:', e)
  }
}

// =============================================
// User Management
// =============================================

export async function registerUser(username: string, password?: string): Promise<User> {
  // Server handles validation, hashing, and storage
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', username, password })
  })
  if (!res.ok) {
    let errorMsg = '注册失败'
    try { const data = await res.json(); errorMsg = data.error || errorMsg } catch {}
    throw new Error(errorMsg)
  }
  const data = await res.json()

  const user = data.user as User
  store.users.push(user)
  return user
}

export async function loginUser(username: string, password?: string): Promise<User> {
  // Server verifies password (hashed comparison)
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username, password })
  })
  if (!res.ok) {
    let errorMsg = '登录失败'
    try { const data = await res.json(); errorMsg = data.error || errorMsg } catch {}
    throw new Error(errorMsg)
  }
  const data = await res.json()

  const user = data.user as User
  // Update local store with server-returned user (no password fields)
  const idx = store.users.findIndex(u => u.id === user.id)
  if (idx >= 0) store.users[idx] = user
  else store.users.push(user)

  currentUser.value = user
  localStorage.setItem('last_user', user.username)
  localStorage.setItem('current_user', JSON.stringify(user))
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
  localStorage.setItem('current_user', JSON.stringify(guestUser))
  return guestUser
}

export function logoutUser() {
  currentUser.value = null
  localStorage.removeItem('last_user')
  localStorage.removeItem('current_user')
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

  // If password is being reset, do it via the dedicated server endpoint
  if (user.password) {
    const res = await fetch('/api/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resetPassword',
        payload: { userId: user.id, newPassword: user.password }
      })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '更新失败')
    }
  }

  // Update other fields (role, etc.) via updateUser
  const { password: _, ...safeUser } = user
  store.users[index] = safeUser as User
  await syncUserUpdate(user.id, { role: user.role })
}

export async function changePassword(oldPassword: string, newPassword: string) {
  if (!currentUser.value || currentUser.value.role === 'guest') {
    throw new Error('Must be logged in as a regular user')
  }

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'changePassword',
      userId: currentUser.value.id,
      oldPassword,
      newPassword
    })
  })

  if (!res.ok) {
    let errorMsg = '修改密码失败'
    try {
      const data = await res.json()
      errorMsg = data.error || errorMsg
    } catch {}
    throw new Error(errorMsg)
  }

  return true
}

export async function createUser(username: string, password: string, role: 'user' | 'admin' = 'user'): Promise<User> {
  if (currentUser.value?.role !== 'admin') {
    throw new Error('Only administrators can create users')
  }

  // Use registerUser to create the user
  const user = await registerUser(username, password)
  
  // If admin wants to create an admin user, update the role
  if (role === 'admin') {
    await updateUser({ ...user, role: 'admin' })
    user.role = 'admin'
    const idx = store.users.findIndex(u => u.id === user.id)
    if (idx >= 0) store.users[idx].role = 'admin'
  }

  return user
}

export function getUsername(userId: string): string {
  const user = store.users.find(u => u.id === userId)
  if (user) return user.username
  if (userId.startsWith('guest-')) return '游客'
  return 'Unknown'
}

// =============================================
// App Initialization
// =============================================

export async function initSettings() {
  await loadFromFile()

  // Ensure admin user exists (registration via API if needed)
  let adminUser = store.users.find(u => u.username === 'admin')
  if (!adminUser) {
    // Create admin via register endpoint
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username: 'admin', password: 'admin12345' })
      })
      const data = await res.json()
      if (res.ok) {
        adminUser = data.user
        store.users.push(adminUser!)
        // Set role to admin
        await syncUserUpdate(adminUser!.id, { role: 'admin' })
        adminUser!.role = 'admin'
      }
    } catch (e) {
      console.error('Failed to create admin user:', e)
    }
  }

  // Ensure gyagp user exists
  let gyagpUser = store.users.find(u => u.username === 'gyagp')
  if (!gyagpUser) {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username: 'gyagp', password: 'gy12345' })
      })
      const data = await res.json()
      if (res.ok) {
        gyagpUser = data.user
        store.users.push(gyagpUser!)
      }
    } catch (e) {
      console.error('Failed to create gyagp user:', e)
    }
  }

  // Auto login: restore from stored user object, then refresh from server data
  const storedUser = localStorage.getItem('current_user')
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser)
      currentUser.value = parsed
      // Refresh with latest server data if available
      const freshUser = store.users.find(u => u.id === parsed.id)
      if (freshUser) {
        currentUser.value = freshUser
        localStorage.setItem('current_user', JSON.stringify(freshUser))
      }
    } catch {
      localStorage.removeItem('current_user')
    }
  } else {
    // Fallback: legacy last_user key
    const lastUser = localStorage.getItem('last_user')
    if (lastUser) {
      const user = store.users.find(u => u.username === lastUser)
      if (user) {
        currentUser.value = user
        localStorage.setItem('current_user', JSON.stringify(user))
      }
    }
  }

  // Migrate data: Assign unowned items to gyagp
  if (gyagpUser) {
    let samplesChanged = false
    let worksChanged = false

    store.samples.forEach(s => {
      if (!s.userId || (adminUser && s.userId === adminUser.id)) {
        s.userId = gyagpUser!.id
        if (!s.visibility) s.visibility = 'private'
        samplesChanged = true
      }
    })
    store.works.forEach(w => {
      if (!w.userId || (adminUser && w.userId === adminUser.id)) {
        w.userId = gyagpUser!.id
        if (!w.visibility) w.visibility = 'public'
        if (!w.status) w.status = 'published'
        worksChanged = true
      }
      if (!w.status) {
        w.status = w.visibility === 'public' ? 'published' : 'draft'
        worksChanged = true
      }
    })

    if (samplesChanged) await syncSamples()
    if (worksChanged) await syncWorks()
  }

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
    await syncWorks()
  }
}

// =============================================
// Rating System
// =============================================

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

  // Find the owner of the target for server-side score update
  let targetUserId: string | undefined
  if (targetType === 'sample') {
    const sample = store.samples.find(s => s.id === targetId)
    targetUserId = sample?.userId
  } else {
    const work = store.works.find(w => w.id === targetId)
    targetUserId = work?.userId
  }

  // Update average score locally
  updateAverageScore(targetId, targetType)

  // Fire-and-forget sync with rollback
  const prevRatings = snapshot(store.ratings)
  optimisticSync(
    () => syncRating(currentUser.value!.id, targetId, targetType, score, targetUserId),
    () => { store.ratings = prevRatings },
    '评分同步失败，已回滚'
  )
}

function updateAverageScore(targetId: string, targetType: 'sample' | 'work') {
  const ratings = store.ratings.filter(r => r.targetId === targetId && r.targetType === targetType)
  if (ratings.length === 0) return

  const total = ratings.reduce((sum, r) => sum + r.score, 0)
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

// =============================================
// Settings
// =============================================

export async function getSettings(): Promise<AppSettings> {
  return store.settings as AppSettings
}

export async function saveSettings(settings: Partial<AppSettings>) {
  const prevSettings = snapshot(store.settings)
  store.settings = { ...store.settings, ...settings } as AppSettings
  optimisticSync(
    () => syncSettingsToServer(settings),
    () => { store.settings = prevSettings },
    '设置同步失败，已回滚'
  )
}

// =============================================
// Samples
// =============================================

export async function saveSample(sample: CharacterSample) {
  if (!currentUser.value) throw new Error('Must be logged in')

  // Validate character against GB2312
  if (!getAllowedChars().has(sample.char)) {
    throw new Error(`Character '${sample.char}' is not in the allowed character set (GB2312).`)
  }

  const index = store.samples.findIndex(s => s.id === sample.id)

  if (currentUser.value.role === 'admin') {
    if (index === -1) {
      throw new Error('Admin cannot create samples')
    }
    if (store.samples[index].visibility !== 'public') {
      throw new Error('Admin can only manage public data')
    }
    store.samples[index] = sample
  } else {
    if (index >= 0) {
      if (store.samples[index].userId !== currentUser.value.id) {
        throw new Error('Permission denied')
      }
      store.samples[index] = sample
    } else {
      sample.userId = currentUser.value.id
      if (!sample.visibility) {
        sample.visibility = store.settings?.defaultVisibility || 'private'
      }
      store.samples.push(sample)
    }
  }
  // Fire-and-forget sync with rollback
  const prevSamples = snapshot(store.samples)
  optimisticSync(
    () => syncSamples(),
    () => { store.samples = prevSamples },
    '书写同步失败，已回滚'
  )
}

export async function setAllVisibility(visibility: 'public' | 'private') {
  if (!currentUser.value) throw new Error('Must be logged in')

  const userIndex = store.users.findIndex(u => u.id === currentUser.value!.id)
  if (userIndex >= 0) {
    const prevVisibility = store.users[userIndex].collectionVisibility
    store.users[userIndex].collectionVisibility = visibility
    currentUser.value.collectionVisibility = visibility
    optimisticSync(
      () => syncUserUpdate(currentUser.value!.id, { collectionVisibility: visibility }),
      () => {
        store.users[userIndex].collectionVisibility = prevVisibility
        if (currentUser.value) currentUser.value.collectionVisibility = prevVisibility
      },
      '可见性同步失败，已回滚'
    )
  }
}

export async function getSamplesByChar(char: string): Promise<CharacterSample[]> {
  const currentUserId = currentUser.value?.id

  return store.samples
    .filter(s => s.char === char)
    .filter(s => {
      if (s.userId === currentUserId) return true
      const owner = store.users.find(u => u.id === s.userId)
      if (owner?.role === 'admin' && s.visibility === 'public') return true
      if (owner?.role === 'user' && owner.collectionVisibility === 'public' && s.isRefined) return true
      return false
    })
    .sort((a, b) => {
      if (a.userId === currentUserId && b.userId !== currentUserId) return -1
      if (b.userId === currentUserId && a.userId !== currentUserId) return 1
      return (b.score || 0) - (a.score || 0)
    })
}

export async function getCollectedChars(): Promise<string[]> {
  const currentUserId = currentUser.value?.id
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

export async function getCollectedSamplesMap(): Promise<Record<string, CharacterSample>> {
  const map: Record<string, CharacterSample> = {}
  const currentUserId = currentUser.value?.id

  const visibleSamples = store.samples.filter(s => s.userId === currentUserId)

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
  const sampleIds = new Set(Object.values(work.charStyles))
  const extraChars = new Set((work.title + (work.author || '')).split('').filter(c => c.trim()))

  return store.samples.filter(s => {
    if (sampleIds.has(s.id)) return true
    if (extraChars.has(s.char) && s.userId === work.userId) return true
    return false
  })
}

export async function getWorkStats(works: Work[]): Promise<Record<string, number>> {
  const stats: Record<string, number> = {}

  // Build a map of userId_char for quick lookup
  const userCharSet = new Set<string>()
  // Build a map of sampleId -> sample for checking specific samples
  const sampleMap = new Map<string, CharacterSample>()
  for (const s of store.samples) {
    userCharSet.add(`${s.userId}_${s.char}`)
    sampleMap.set(s.id, s)
  }

  for (const work of works) {
    let count = 0

    // Count title characters
    const title = work.title || ''
    for (const char of title) {
      if (/\s/.test(char)) continue
      if (userCharSet.has(`${work.userId}_${char}`)) {
        count++
      }
    }

    // Count author characters
    const author = work.author || ''
    for (const char of author) {
      if (/\s/.test(char)) continue
      if (userCharSet.has(`${work.userId}_${char}`)) {
        count++
      }
    }

    // Count content characters - need to check charStyles
    const content = work.content || ''
    const contentChars = content.split('').filter(c => !(/\s/.test(c)))
    for (let i = 0; i < contentChars.length; i++) {
      const char = contentChars[i]

      // Check if a specific style is selected for this position
      const selectedSampleId = work.charStyles?.[i]
      if (selectedSampleId) {
        // If a specific sample is selected, check if it belongs to the user
        const sample = sampleMap.get(selectedSampleId)
        if (sample && sample.userId === work.userId) {
          count++
        }
      } else {
        // No specific sample selected, check if user has any sample for this char
        if (userCharSet.has(`${work.userId}_${char}`)) {
          count++
        }
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

  return Object.keys(charStatus).filter(char => {
    const status = charStatus[char]
    return status.adjusted < status.total
  })
}

// =============================================
// Works
// =============================================

export async function saveWork(work: Work) {
  if (!currentUser.value) throw new Error('Must be logged in')

  work.updatedAt = Date.now()

  if (currentUser.value.role === 'admin') {
    if (work.visibility === 'public') {
      work.status = 'published'
    }
  } else {
    if (work.visibility === 'public') {
      if (work.status !== 'published') {
        work.status = 'pending'
      }
    } else {
      work.status = 'published'
    }
  }

  const index = store.works.findIndex(w => w.id === work.id)

  if (index >= 0) {
    const existingWork = store.works[index]

    if (currentUser.value.role === 'admin') {
      if (existingWork.visibility !== 'public' && existingWork.userId !== currentUser.value.id) {
        throw new Error('Admin can only manage public data or own data')
      }
      store.works[index] = work
    } else {
      if (existingWork.userId !== currentUser.value.id) {
        throw new Error('Permission denied')
      }

      if (existingWork.visibility === 'public' && existingWork.status === 'published') {
        if (work.visibility === 'public') {
          if (work.content !== existingWork.content ||
              work.title !== existingWork.title ||
              work.author !== existingWork.author) {
            throw new Error('已公开的作品无法修改内容，请联系管理员')
          }
        }
      }

      store.works[index] = work
    }
  } else {
    work.userId = currentUser.value.id
    if (work.isRefined === undefined) work.isRefined = false
    if (!work.createdAt) work.createdAt = Date.now()
    store.works.push(work)
  }
  // Fire-and-forget sync with rollback
  const prevWorks = snapshot(store.works)
  optimisticSync(
    () => syncWorks(),
    () => { store.works = prevWorks },
    '作品同步失败，已回滚'
  )
}

export async function approveWork(workId: string, approved: boolean) {
  if (currentUser.value?.role !== 'admin') throw new Error('Admin only')

  const work = store.works.find(w => w.id === workId)
  if (!work) throw new Error('Work not found')

  const prevStatus = work.status
  const prevUpdatedAt = work.updatedAt
  work.status = approved ? 'published' : 'rejected'
  work.updatedAt = Date.now()
  optimisticSync(
    () => syncWorks(),
    () => { work.status = prevStatus; work.updatedAt = prevUpdatedAt },
    '审核同步失败，已回滚'
  )
}

export async function getWorks(): Promise<Work[]> {
  const currentUserId = currentUser.value?.id
  const isAdmin = currentUser.value?.role === 'admin'

  return [...store.works]
    .filter(w => {
      if (w.userId === currentUserId) return true
      if (w.visibility === 'public' && w.status === 'published') return true
      if (w.visibility === 'private' && w.isRefined) {
        const owner = store.users.find(u => u.id === w.userId)
        if (owner && owner.collectionVisibility === 'public') {
          return true
        }
      }
      if (isAdmin) return true
      return false
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
}

export async function getRelatedPublicWorks(title: string, excludeId?: string): Promise<Work[]> {
  const currentUserId = currentUser.value?.id

  return store.works.filter(w => {
    if (w.id === excludeId) return false
    if (w.title.trim() !== title.trim()) return false
    if (w.visibility !== 'public') return false
    if (w.userId === currentUserId) return false
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
    store.works = store.works.filter(w => w.id !== id)
  } else {
    if (work.userId !== currentUser.value?.id) {
      throw new Error('Permission denied')
    }
    if (work.visibility === 'public' && work.status === 'published') {
      throw new Error('已公开的作品无法删除')
    }
    store.works = store.works.filter(w => w.id !== id)
  }

  // Fire-and-forget sync with rollback
  const prevWorks = snapshot(store.works.concat([work]))
  optimisticSync(
    () => syncWorks(),
    () => { store.works = prevWorks },
    '删除同步失败，已回滚'
  )
}

// =============================================
// Delete sample
// =============================================

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
  // Fire-and-forget sync with rollback
  const prevSamples = snapshot(store.samples.concat([sample]))
  optimisticSync(
    () => syncSamples(),
    () => { store.samples = prevSamples },
    '删除同步失败，已回滚'
  )
}

// =============================================
// Collect / Uncollect works
// =============================================

export async function collectWork(workId: string) {
  if (!currentUser.value) throw new Error('Must be logged in')

  const work = store.works.find(w => w.id === workId)
  if (!work) throw new Error('Work not found')

  const newWork: Work = {
    id: crypto.randomUUID(),
    userId: currentUser.value.id,
    visibility: 'private',
    status: 'published',
    title: work.title,
    author: work.author,
    content: work.content,
    charStyles: {},
    charAdjustments: {},
    layout: work.layout,
    gridType: work.gridType,
    isRefined: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    originWorkId: work.id
  }

  store.works.push(newWork)

  if (!currentUser.value.collectedWorkIds) currentUser.value.collectedWorkIds = []
  if (!currentUser.value.collectedWorkIds.includes(workId)) {
    currentUser.value.collectedWorkIds.push(workId)
  }

  // Fire-and-forget sync with rollback
  const prevWorks = snapshot(store.works)
  const prevCollected = snapshot(currentUser.value.collectedWorkIds)
  optimisticSync(
    async () => {
      await syncWorks()
      await syncUserUpdate(currentUser.value!.id, { collectedWorkIds: currentUser.value!.collectedWorkIds })
    },
    () => {
      store.works = prevWorks
      if (currentUser.value) currentUser.value.collectedWorkIds = prevCollected
    },
    '收集同步失败，已回滚'
  )
}

export async function uncollectWork(workId: string) {
  await deleteWork(workId)
}

// =============================================
// Clear all data
// =============================================

export async function clearAllData() {
  const prevSamples = snapshot(store.samples)
  const prevWorks = snapshot(store.works)
  const prevSettings = snapshot(store.settings)
  store.samples = []
  store.works = []
  store.settings = null

  optimisticSync(
    async () => {
      await syncSamples()
      await syncWorks()
    },
    () => {
      store.samples = prevSamples
      store.works = prevWorks
      store.settings = prevSettings
    },
    '清空同步失败，已回滚'
  )
  await initSettings()
}
