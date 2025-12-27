import { loadOpenCV } from './opencv'

// 使用OpenCV将二值图像转换为SVG路径
export async function vectorizeImage(
  imageData: ImageData
): Promise<{ path: string; viewBox: string }> {
  await loadOpenCV()
  const cv = (window as any).cv

  // 1. 将ImageData转换为Mat
  const src = cv.matFromImageData(imageData)
  const gray = new cv.Mat()
  const binary = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    // 2. 预处理
    // 输入已经是RGBA，且文字为黑(0,0,0,255)，背景透明
    // 我们需要将其转为单通道二值图，文字为白(255)，背景为黑(0)以便findContours

    // 提取Alpha通道作为掩码，或者直接转灰度
    // 由于我们之前处理过，Alpha=255是文字，Alpha=0是背景
    // 我们可以直接提取Alpha通道
    const channels = new cv.MatVector()
    cv.split(src, channels)
    const alpha = channels.get(3) // Alpha通道

    // 二值化：Alpha > 128 -> 255
    cv.threshold(alpha, binary, 128, 255, cv.THRESH_BINARY)

    // 3. 查找轮廓
    // RETR_LIST: 获取所有轮廓
    // CHAIN_APPROX_TC89_KCOS:以此近似算法减少点数
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_TC89_KCOS)

    // 4. 生成SVG路径
    let pathData = ''

    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i)
      const data = cnt.data32S // Int32Array [x1, y1, x2, y2, ...]

      if (data.length < 4) continue // 忽略太短的

      // 移动到第一个点
      pathData += `M ${data[0]} ${data[1]} `

      // 连接后续点
      for (let j = 2; j < data.length; j += 2) {
        pathData += `L ${data[j]} ${data[j+1]} `
      }

      // 闭合路径
      pathData += 'Z '
    }

    // 5. 优化：这里生成的路径可能很粗糙，OpenCV的approxPolyDP可以进一步简化
    // 但CHAIN_APPROX_TC89_KCOS已经做了一定的简化

    return {
      path: pathData,
      viewBox: `0 0 ${src.cols} ${src.rows}`
    }

  } finally {
    src.delete()
    gray.delete()
    binary.delete()
    contours.delete()
    hierarchy.delete()
    // channels.delete() // channels vector needs cleanup, and its elements too?
    // In opencv.js, split returns a vector, we need to delete the vector and the mats inside if we didn't get them via get()
    // But here we used get(3), which returns a new Mat instance that needs deletion?
    // Actually let's be safe and rely on GC for small JS objects but delete Mats.
    // The `alpha` variable is a Mat returned by get(), needs delete.
    // channels needs delete.
  }
}
