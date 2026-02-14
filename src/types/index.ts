// 汉字信息接口
export interface CharacterInfo {
  char: string       // 汉字
  code: string       // GB2312编码 (十六进制)
  pinyin: string     // 拼音 (带声调)
  radical: string    // 部首
  strokes: number    // 笔画数
}

export type Visibility = 'private' | 'public'
export type Role = 'user' | 'admin' | 'guest'
export type WorkStatus = 'draft' | 'pending' | 'published' | 'rejected'

export interface User {
  id: string
  username: string
  password?: string // Only used locally for password reset flow; never stored on client from server
  role: Role
  createdAt: number
  collectedWorkIds?: string[] // IDs of public works collected by this user
  collectionVisibility?: 'public' | 'private' // Global visibility setting for this user
}

export interface Rating {
  userId: string
  targetId: string
  targetType: 'sample' | 'work'
  score: number // 0-100
  createdAt: number
}

// 收集的字符样本
export interface CharacterSample {
  id: string                // 唯一ID
  userId: string            // 用户ID
  visibility: Visibility    // 可见性 (Deprecated in favor of User.collectionVisibility + isRefined)
  char: string              // 对应的汉字
  svgPath: string           // SVG路径数据 (压缩后)
  svgViewBox: string        // SVG viewBox
  thumbnail: string         // 缩略图 Base64 (WebP)
  rating: number            // 自评评分 1-5 (保留用于兼容)
  score?: number            // 公众评分平均分 0-100
  isAdjusted?: boolean      // 是否已调整 (Position/Scale)
  isRefined?: boolean       // 是否已精修 (Ready for public)
  createdAt: number         // 创建时间戳
  tags: string[]            // 标签
}

// 字符收集状态
export interface CharacterCollection {
  char: string              // 汉字
  samples: CharacterSample[] // 收集的样本列表
  updatedAt: number         // 最后更新时间
}

// 格子类型
export type GridType = 'mi' | 'tian' | 'hui' | 'none' | 'text'

// 图像处理结果 - 单个字符
export interface ExtractedCharacter {
  id: string                // 临时ID
  imageData: ImageData      // 原始图像数据
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

// 应用设置
export interface AppSettings {
  gridType: GridType        // 默认格子类型
  defaultLayout?: 'horizontal' | 'vertical' // 默认排版方向
  gridSize: number          // 格子大小 (像素)
  compressionLevel: number  // 压缩级别 0-9
  theme: 'light' | 'dark'   // 主题
  defaultVisibility?: 'public' | 'private' // 默认可见性 (作品和字形)
}

// 书法作品
export interface Work {
  id: string // Deprecated
  status: WorkStatus        // 审核状态
  title: string
  author?: string           // 作者
  content: string           // 作品内容
  charStyles: Record<number, string> // 字符索引 -> sampleId (指定每个位置使用哪个样本)
  charAdjustments?: Record<number, { scale: number, offsetX: number, offsetY: number }> // 字符索引 -> 调整参数
  layout: 'horizontal' | 'vertical' // 排版方向
  gridType?: GridType       // 格子类型
  score?: number            // 公众评分平均分 0-100
  isRefined?: boolean       // 是否已精修
  createdAt: number
  updatedAt: number
  userId: string            // 用户ID
  visibility: Visibility    // 可见性
  authorDeleted?: boolean   // 作者是否已删除(仅对公开作品有效，删除后仅从作者列表移除)
  originWorkId?: string     // 如果是收藏的作品，指向原始作品ID
}

export interface CharacterStats {
  sample: CharacterSample
  totalCount: number
  adjustedCount: number
}

// 导出数据格式
export interface ExportData {
  version: string
  exportedAt: number
  characters: CharacterCollection[]
  settings: AppSettings
}
