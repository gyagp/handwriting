// OpenCV加载和封装服务

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js'

let cvLoaded = false
let cvLoadingPromise: Promise<void> | null = null

export async function loadOpenCV(): Promise<void> {
  if (cvLoaded) return Promise.resolve()
  if (cvLoadingPromise) return cvLoadingPromise

  cvLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = OPENCV_URL
    script.async = true
    script.onload = () => {
      // OpenCV.js 加载后会初始化 cv 对象
      // 通常需要等待 cv.onRuntimeInitialized
      if ((window as any).cv.getBuildInformation) {
        cvLoaded = true
        resolve()
      } else {
        (window as any).cv['onRuntimeInitialized'] = () => {
          cvLoaded = true
          resolve()
        }
      }
    }
    script.onerror = () => {
      cvLoadingPromise = null
      reject(new Error('Failed to load OpenCV.js'))
    }
    document.body.appendChild(script)
  })

  return cvLoadingPromise
}

export interface ProcessedContour {
  x: number
  y: number
  width: number
  height: number
  image: ImageData
}

// 图像预处理和字符分割
export async function processImage(
  imageSource: HTMLImageElement | HTMLCanvasElement
): Promise<ProcessedContour[]> {
  await loadOpenCV()
  const cv = (window as any).cv

  const src = cv.imread(imageSource)
  const gray = new cv.Mat()
  const binary = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    // 1. 灰度化
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0)

    // 2. 二值化 (自适应阈值)
    // cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2)
    // 或者使用简单的OTSU
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)

    // 3. 膨胀处理：连接断开的笔画
    // 汉字往往由不连通的笔画组成，直接查找轮廓会将一个字识别为多个部分
    // 通过膨胀操作，让笔画粘连在一起，形成一个整体区域
    const morph = new cv.Mat()
    binary.copyTo(morph)

    // 动态计算核大小：基于图像短边的 1/80，最小 3px，最大 30px
    // 稍微大一点的核可以更好地连接左右结构的字
    const kSize = Math.min(30, Math.max(3, Math.floor(Math.min(src.cols, src.rows) / 80)))
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kSize, kSize))

    cv.dilate(morph, morph, kernel)

    // 4. 轮廓检测 (使用膨胀后的图像)
    cv.findContours(morph, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const results: ProcessedContour[] = []
    const minArea = kSize * kSize * 4 // 最小面积过滤，随核大小动态调整

    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i)
      const area = cv.contourArea(cnt)

      if (area > minArea) {
        const rect = cv.boundingRect(cnt)

        // 提取ROI
        // 稍微扩大一点边界
        const padding = 2
        const x = Math.max(0, rect.x - padding)
        const y = Math.max(0, rect.y - padding)
        const w = Math.min(src.cols - x, rect.width + 2 * padding)
        const h = Math.min(src.rows - y, rect.height + 2 * padding)

        const roi = binary.roi(new cv.Rect(x, y, w, h))
        // 克隆ROI以确保数据连续
        const roiCont = roi.clone()

        // 创建一个新的ImageData用于显示（因为roi.data是单通道，ImageData需要RGBA）
        const rgbaData = new Uint8ClampedArray(roiCont.cols * roiCont.rows * 4)
        for (let j = 0; j < roiCont.rows * roiCont.cols; j++) {
          const val = roiCont.data[j]
          // 反转颜色：文字为黑，背景为白 (或者保持二值化结果：文字白背景黑)
          // 这里我们希望显示时文字是黑色的，背景透明或白色
          // OpenCV二值化结果通常是文字白(255)，背景黑(0) (因为用了THRESH_BINARY_INV)
          // 我们将其转为：文字黑(0,0,0,255)，背景透明(0,0,0,0)

          if (val > 128) { // 文字部分
            rgbaData[j * 4 + 0] = 0   // R
            rgbaData[j * 4 + 1] = 0   // G
            rgbaData[j * 4 + 2] = 0   // B
            rgbaData[j * 4 + 3] = 255 // A
          } else { // 背景部分
            rgbaData[j * 4 + 0] = 255
            rgbaData[j * 4 + 1] = 255
            rgbaData[j * 4 + 2] = 255
            rgbaData[j * 4 + 3] = 0   // 透明
          }
        }

        results.push({
          x, y, width: w, height: h,
          image: new ImageData(rgbaData, roiCont.cols, roiCont.rows)
        })

        roiCont.delete()
        roi.delete()
      }
    }

    // 对结果进行排序：从上到下，从左到右
    // 简单的行扫描算法：如果Y坐标差异小于平均高度的一半，则视为同一行
    if (results.length > 0) {
      const avgHeight = results.reduce((sum, r) => sum + r.height, 0) / results.length
      const lineThreshold = avgHeight / 2

      results.sort((a, b) => {
        const yDiff = Math.abs(a.y - b.y)
        if (yDiff < lineThreshold) {
          return a.x - b.x // 同一行，按X排序
        }
        return a.y - b.y // 不同行，按Y排序
      })
    }

    return results
  } finally {
    src.delete()
    gray.delete()
    binary.delete()
    contours.delete()
    hierarchy.delete()
    if (typeof morph !== 'undefined') morph.delete()
    if (typeof kernel !== 'undefined') kernel.delete()
  }
}
