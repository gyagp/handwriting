// 汉字信息接口
export interface CharacterInfo {
  char: string       // 汉字
  code: string       // GB2312编码 (十六进制)
  pinyin: string     // 拼音 (带声调)
  radical: string    // 部首
  strokes: number    // 笔画数
}

// 收集的字符样本
export interface CharacterSample {
  id: string                // 唯一ID
  char: string              // 对应的汉字
  svgPath: string           // SVG路径数据 (压缩后)
  svgViewBox: string        // SVG viewBox
  thumbnail: string         // 缩略图 Base64 (WebP)
  rating: number            // 评分 1-5
  isAdjusted?: boolean      // 是否已精修调整
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
export type GridType = 'mi' | 'tian' | 'hui' | 'none'

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
  recognized?: string       // OCR识别结果 (可选)
  confidence?: number       // 识别置信度
}

// 应用设置
export interface AppSettings {
  gridType: GridType        // 默认格子类型
  gridSize: number          // 格子大小 (像素)
  autoRecognize: boolean    // 自动OCR识别
  compressionLevel: number  // 压缩级别 0-9
  theme: 'light' | 'dark'   // 主题
}

// 书法作品
export interface Work {
  id: string
  title: string
  author?: string           // 作者
  content: string           // 作品内容
  charStyles: Record<number, string> // 字符索引 -> sampleId (指定每个位置使用哪个样本)
  charAdjustments?: Record<number, { scale: number, offsetX: number, offsetY: number }> // 字符索引 -> 调整参数
  layout: 'horizontal' | 'vertical' // 排版方向
  gridType?: GridType       // 格子类型
  createdAt: number
  updatedAt: number
}

// 导出数据格式
export interface ExportData {
  version: string
  exportedAt: number
  characters: CharacterCollection[]
  settings: AppSettings
}
