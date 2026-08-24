import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_HEADER } from '@shared/constants'
import { imageFileName, imageKindOf, promptSlug, requestImage } from './image-request'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03])

describe('imageKindOf', () => {
  it('reads the format from the bytes, not from any header', () => {
    expect(imageKindOf(jpeg)).toEqual({ mime: 'image/jpeg', extension: 'jpg' })
    expect(imageKindOf(png)).toEqual({ mime: 'image/png', extension: 'png' })
  })

  it('refuses to guess when the bytes match nothing it knows', () => {
    expect(imageKindOf(unknown).extension).toBe('bin')
  })

  it('does not mistake a truncated header for a match', () => {
    expect(imageKindOf(new Uint8Array([0x89, 0x50])).extension).toBe('bin')
    expect(imageKindOf(new Uint8Array([])).extension).toBe('bin')
  })
})

describe('promptSlug', () => {
  it('turns a prompt into a filename-safe slug', () => {
    expect(promptSlug('A ginger cat, watching rain!')).toBe('a-ginger-cat-watching-rain')
  })

  it('keeps non-latin words instead of dropping them to nothing', () => {
    const cat = '\u6a58\u732b'
    const rain = '\u770b\u96e8'
    expect(promptSlug(`${cat} ${rain}`)).toBe(`${cat}-${rain}`)
  })

  it('falls back when the prompt has nothing usable', () => {
    expect(promptSlug('   ')).toBe('ai-image')
    expect(promptSlug('!!!___!!!')).toBe('ai-image')
  })

  it('truncates a long prompt and never ends on a separator', () => {
    const slug = promptSlug('word '.repeat(50))
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('imageFileName', () => {
  it('joins the slug with the extension the bytes implied', () => {
    expect(imageFileName('A ginger cat', imageKindOf(jpeg).extension)).toBe('a-ginger-cat.jpg')
    expect(imageFileName('   ', imageKindOf(png).extension)).toBe('ai-image.png')
  })
})

describe('requestImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const respondWith = (bytes: Uint8Array, contentType: string) => {
    const fetchMock = vi.fn(async () => new Response(bytes.slice().buffer as ArrayBuffer, { status: 200, headers: { 'Content-Type': contentType } }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('names the file from the bytes even when the response header lies about the type', async () => {
    respondWith(jpeg, 'image/png')
    const file = await requestImage('A ginger cat')
    expect(file.type).toBe('image/jpeg')
    expect(file.name).toBe('a-ginger-cat.jpg')
  })

  it('trusts the bytes for a real png too', async () => {
    respondWith(png, 'application/octet-stream')
    const file = await requestImage('A ginger cat')
    expect(file.type).toBe('image/png')
    expect(file.name).toBe('a-ginger-cat.png')
  })

  it('posts the prompt to the image endpoint with the client header the worker requires', async () => {
    const fetchMock = respondWith(jpeg, 'image/jpeg')
    await requestImage('a prompt')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/ai/image')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ prompt: 'a prompt' })
    expect((init.headers as Record<string, string>)[CLIENT_HEADER]).toBe('1')
  })

  it('throws a classifiable error carrying the status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('over quota', { status: 429 })))
    await expect(requestImage('a prompt')).rejects.toMatchObject({ httpStatus: 429 })
  })
})
