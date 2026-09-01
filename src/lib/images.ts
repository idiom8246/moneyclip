/**
 * Image processing: downscale via canvas (spec §4 attachments).
 * Original ↔ longest side ≤ 2000px (JPEG q0.8); thumbnail ≤ 400px.
 */

const MAX_FULL = 2000
const MAX_THUMB = 400
const QUALITY = 0.8

export interface ProcessedImage {
  blob: Blob
  thumbBlob: Blob
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image-decode-failed'))
    img.src = dataUrl
  })
}

async function resizeTo(
  img: HTMLImageElement,
  maxSide: number,
): Promise<Blob> {
  const { naturalWidth: w, naturalHeight: h } = img
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas-unavailable')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas-encode-failed'))),
      'image/jpeg',
      QUALITY,
    )
  })
}

export async function processImageFile(file: File | Blob): Promise<ProcessedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('file-read-failed'))
    reader.readAsDataURL(file)
  })
  const img = await loadImage(dataUrl)
  const [blob, thumbBlob] = await Promise.all([
    resizeTo(img, MAX_FULL),
    resizeTo(img, MAX_THUMB),
  ])
  return { blob, thumbBlob }
}

const objectUrls = new Set<string>()

export function blobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  objectUrls.add(url)
  return url
}

export function releaseBlobUrl(url: string): void {
  if (objectUrls.delete(url)) URL.revokeObjectURL(url)
}
