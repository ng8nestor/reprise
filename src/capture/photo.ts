// Shrinks a camera photo in the browser before upload. A phone photo is
// 3-12 MB; /api/extract takes at most 3 MB, and the model gains nothing
// past a 1568px long edge, so we send ~300-700 KB instead.

export const MAX_LONG_EDGE = 1568
export const JPEG_QUALITY = 0.85

export interface Size {
  width: number
  height: number
}

// Scales down so the longer side is at most maxLongEdge, keeping the aspect
// ratio. Never scales up.
export function fitLongEdge(size: Size, maxLongEdge = MAX_LONG_EDGE): Size {
  const longEdge = Math.max(size.width, size.height)
  if (longEdge <= maxLongEdge) return size
  const scale = maxLongEdge / longEdge
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  }
}

// "data:image/jpeg;base64,/9j/..." -> "/9j/...", the plain base64 the API
// expects.
export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma === -1) {
    throw new Error('Not a data URL')
  }
  return dataUrl.slice(comma + 1)
}

// "from-image" applies the photo's EXIF rotation while decoding, so a page
// shot in portrait arrives upright, and width/height are the upright ones.
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })
  try {
    const { width, height } = fitLongEdge(bitmap)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable')
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('JPEG encoding failed')),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
  } finally {
    bitmap.close()
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(stripDataUrlPrefix(reader.result))
      } else {
        reject(new Error('Unexpected FileReader result'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsDataURL(blob)
  })
}
