import { CharacterInfo } from '@/types'

// GB2312一级字库生成器
// GB2312一级字库编码范围：B0A1-D7FE（高字节B0-D7，低字节A1-FE）
// 共87个区（高字节），每区94个字符（低字节）

// 生成GB2312一级字库的所有汉字
export function generateGB2312Level1Chars(): string[] {
  const chars: string[] = []

  // 一级汉字区：B0-D7 (高字节)，A1-FE (低字节)
  for (let high = 0xB0; high <= 0xD7; high++) {
    for (let low = 0xA1; low <= 0xFE; low++) {
      // 排除 D7FA-D7FE (这5个编码未定义)
      if (high === 0xD7 && low > 0xF9) {
        continue
      }

      // 将GB2312编码转换为Unicode字符
      const gb2312Bytes = new Uint8Array([high, low])
      try {
        const decoder = new TextDecoder('gb2312')
        const char = decoder.decode(gb2312Bytes)
        if (char && char.length === 1 && char !== '�') {
          chars.push(char)
        }
      } catch {
        // 忽略无法解码的字符
      }
    }
  }

  return chars
}

// 生成GB2312二级字库的所有汉字
export function generateGB2312Level2Chars(): string[] {
  const chars: string[] = []

  // 二级汉字区：D8-F7 (高字节)，A1-FE (低字节)
  for (let high = 0xD8; high <= 0xF7; high++) {
    for (let low = 0xA1; low <= 0xFE; low++) {
      // 将GB2312编码转换为Unicode字符
      const gb2312Bytes = new Uint8Array([high, low])
      try {
        const decoder = new TextDecoder('gb2312')
        const char = decoder.decode(gb2312Bytes)
        if (char && char.length === 1 && char !== '') {
          chars.push(char)
        }
      } catch {
        // 忽略无法解码的字符
      }
    }
  }

  return chars
}

// 拼音数据 - 按GB2312一级字库顺序（部分核心数据）
// 完整数据较大，这里提供生成逻辑和部分示例
const pinyinMap: Record<string, string> = {
  '啊': 'ā', '阿': 'ā', '埃': 'āi', '挨': 'āi', '哎': 'āi', '唉': 'āi', '哀': 'āi', '皑': 'ái', '癌': 'ái', '蔼': 'ǎi',
  '矮': 'ǎi', '艾': 'ài', '碍': 'ài', '爱': 'ài', '隘': 'ài', '鞍': 'ān', '氨': 'ān', '安': 'ān', '俺': 'ǎn', '按': 'àn',
  '暗': 'àn', '岸': 'àn', '胺': 'àn', '案': 'àn', '肮': 'āng', '昂': 'áng', '盎': 'àng', '凹': 'āo', '敖': 'áo', '熬': 'áo',
  '翱': 'áo', '袄': 'ǎo', '傲': 'ào', '奥': 'ào', '懊': 'ào', '澳': 'ào', '芭': 'bā', '捌': 'bā', '扒': 'bā', '叭': 'bā',
  '吧': 'ba', '笆': 'bā', '八': 'bā', '疤': 'bā', '巴': 'bā', '拔': 'bá', '跋': 'bá', '靶': 'bǎ', '把': 'bǎ', '耙': 'bà',
  '坝': 'bà', '霸': 'bà', '罢': 'bà', '爸': 'bà', '白': 'bái', '柏': 'bǎi', '百': 'bǎi', '摆': 'bǎi', '佰': 'bǎi', '败': 'bài',
  '拜': 'bài', '稗': 'bài', '斑': 'bān', '班': 'bān', '搬': 'bān', '扳': 'bān', '般': 'bān', '颁': 'bān', '板': 'bǎn', '版': 'bǎn',
  '扮': 'bàn', '拌': 'bàn', '伴': 'bàn', '瓣': 'bàn', '半': 'bàn', '办': 'bàn', '绊': 'bàn', '邦': 'bāng', '帮': 'bāng', '梆': 'bāng',
  '榜': 'bǎng', '膀': 'bǎng', '绑': 'bǎng', '棒': 'bàng', '磅': 'bàng', '蚌': 'bàng', '镑': 'bàng', '傍': 'bàng', '谤': 'bàng', '苞': 'bāo',
  '胞': 'bāo', '包': 'bāo', '褒': 'bāo', '剥': 'bāo', '薄': 'báo', '雹': 'báo', '保': 'bǎo', '堡': 'bǎo', '饱': 'bǎo', '宝': 'bǎo',
  // ... 更多拼音数据
}

// 部首数据
const radicalMap: Record<string, string> = {
  '啊': '口', '阿': '阝', '埃': '土', '挨': '扌', '哎': '口', '唉': '口', '哀': '口', '皑': '白', '癌': '疒', '蔼': '艹',
  '矮': '矢', '艾': '艹', '碍': '石', '爱': '爫', '隘': '阝', '鞍': '革', '氨': '气', '安': '宀', '俺': '亻', '按': '扌',
  '暗': '日', '岸': '山', '胺': '月', '案': '木', '肮': '月', '昂': '日', '盎': '皿', '凹': '凵', '敖': '攵', '熬': '灬',
  // ... 更多部首数据
}

// 笔画数据
const strokesMap: Record<string, number> = {
  '啊': 10, '阿': 7, '埃': 10, '挨': 10, '哎': 8, '唉': 10, '哀': 9, '皑': 12, '癌': 17, '蔼': 14,
  '矮': 13, '艾': 5, '碍': 13, '爱': 10, '隘': 12, '鞍': 15, '氨': 10, '安': 6, '俺': 10, '按': 9,
  '暗': 13, '岸': 8, '胺': 10, '案': 10, '肮': 8, '昂': 8, '盎': 10, '凹': 5, '敖': 10, '熬': 14,
  // ... 更多笔画数据
}

// 获取字符的拼音
export function getPinyin(char: string): string {
  return pinyinMap[char] || ''
}

// 获取字符的部首
export function getRadical(char: string): string {
  return radicalMap[char] || ''
}

// 获取字符的笔画数
export function getStrokes(char: string): number {
  return strokesMap[char] || 0
}

// 获取字符的GB2312编码
export function getGB2312Code(char: string): string {
  try {
    const encoder = new TextEncoder()
    // 这里简化处理，实际需要使用GB2312编码器
    // 浏览器环境使用TextEncoder只支持UTF-8
    // 返回一个占位符，实际使用时需要查表
    const code = char.charCodeAt(0)
    return code.toString(16).toUpperCase().padStart(4, '0')
  } catch {
    return ''
  }
}

// 常用标点符号
export const punctuationChars = [
  '，', '。', '、', '；', '：', '？', '！', '“', '”', '‘', '’', '（', '）', '【', '】', '《', '》', '—', '…', '·'
]

// 默认导出生成的字符列表
export const gb2312Level1Chars = [...punctuationChars, ...generateGB2312Level1Chars()]
export const gb2312Level2Chars = generateGB2312Level2Chars()
export const gb2312AllChars = [...punctuationChars, ...generateGB2312Level1Chars(), ...generateGB2312Level2Chars()]

export default gb2312AllChars
