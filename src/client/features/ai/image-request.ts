import { CLIENT_HEADER } from '@shared/constants'

const JPEG_MAGIC = [0xff, 0xd8]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const MAX_SLUG_CHARS = 40
const FALLBACK_SLUG = 'ai-image'

export interface GeneratedImage {
  mime: string
  extension: string
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte)
}

export function imageKindOf(bytes: Uint8Array): GeneratedImage {
  if (startsWith(bytes, PNG_MAGIC)) return { mime: 'image/png', extension: 'png' }
  if (startsWith(bytes, JPEG_MAGIC)) return { mime: 'image/jpeg', extension: 'jpg' }
  return { mime: 'application/octet-stream', extension: 'bin' }
}

export function promptSlug(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_CHARS)
    .replace(/-+$/g, '')
  return slug || FALLBACK_SLUG
}

export function imageFileName(prompt: string, extension: string): string {
  return `${promptSlug(prompt)}.${extension}`
}

export async function requestImage(prompt: string, signal?: AbortSignal): Promise<File> {
  const response = await fetch('/api/ai/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [CLIENT_HEADER]: '1' },
    body: JSON.stringify({ prompt }),
    signal,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const error = new Error(`HTTP ${response.status}`) as Error & { httpStatus: number; httpBody: string }
    error.httpStatus = response.status
    error.httpBody = detail.slice(0, 240)
    throw error
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const kind = imageKindOf(bytes)
  return new File([bytes], imageFileName(prompt, kind.extension), { type: kind.mime })
}
