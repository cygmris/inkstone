import { Hono } from 'hono'
import { isAllowedCloudflareModel, supportsThinkingToggle } from '@shared/ai-models'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/errors'
import { JSON_BODY_LIMITS, readJson } from '../lib/request'
import { transformWorkersAiStream } from '../lib/workers-ai-stream'
import { requireAuth } from '../middleware/auth'

export const aiRoutes = new Hono<AppBindings>()

aiRoutes.use('*', requireAuth)

const MAX_OUTPUT_TOKENS = 16384
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell'
const MAX_IMAGE_PROMPT_CHARS = 1000
const JPEG_MAGIC = [0xff, 0xd8]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatBody {
  model?: unknown
  messages?: unknown
  max_tokens?: unknown
}

function readMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw ApiError.badRequest('messages must be a non-empty array')
  }
  return value.map((entry) => {
    const message = entry as Record<string, unknown>
    const role = message?.role
    const content = message?.content
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      throw ApiError.badRequest('each message needs a role of system, user or assistant')
    }
    if (typeof content !== 'string') {
      throw ApiError.badRequest('each message needs string content')
    }
    return { role, content }
  })
}

function readMaxTokens(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw ApiError.badRequest('max_tokens must be a positive number')
  }
  return Math.min(Math.floor(value), MAX_OUTPUT_TOKENS)
}

function upstreamFailure(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : String(error)
  if (/\b429\b|rate limit|quota|capacity|exceeded/i.test(message)) {
    return new ApiError(429, 'too_many_attempts', message)
  }
  return new ApiError(502, 'internal', message)
}

aiRoutes.post('/chat', async (c) => {
  const ai = c.env.AI
  if (!ai) {
    throw new ApiError(503, 'server_misconfigured', 'Workers AI is not bound to this deployment')
  }

  const body = await readJson<ChatBody>(c, JSON_BODY_LIMITS.note)
  if (!isAllowedCloudflareModel(body.model)) {
    throw ApiError.badRequest('That model is not available on this server')
  }
  const messages = readMessages(body.messages)
  const maxTokens = readMaxTokens(body.max_tokens)

  let upstream: ReadableStream<Uint8Array>
  try {
    upstream = await ai.run<ReadableStream<Uint8Array>>(body.model, {
      messages,
      stream: true,
      reasoning_effort: 'low',
      ...(supportsThinkingToggle(body.model) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
    })
  } catch (error) {
    throw upstreamFailure(error)
  }

  return new Response(transformWorkersAiStream(upstream, body.model), {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  })
})

interface ImageBody {
  prompt?: unknown
}

function readImagePrompt(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw ApiError.badRequest('prompt must be a non-empty string')
  }
  return value.trim().slice(0, MAX_IMAGE_PROMPT_CHARS)
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte)
}

export function imageMediaType(bytes: Uint8Array): string {
  if (startsWith(bytes, PNG_MAGIC)) return 'image/png'
  if (startsWith(bytes, JPEG_MAGIC)) return 'image/jpeg'
  return 'application/octet-stream'
}

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function normalizeImageResult(result: unknown): Promise<Uint8Array> {
  if (result instanceof ReadableStream) {
    return new Uint8Array(await new Response(result).arrayBuffer())
  }
  if (result instanceof ArrayBuffer) return new Uint8Array(result)
  if (result instanceof Uint8Array) return result
  const image = (result as { image?: unknown })?.image
  if (typeof image === 'string') return decodeBase64(image)
  throw new ApiError(502, 'internal', 'The image model returned an unexpected payload')
}

aiRoutes.post('/image', async (c) => {
  const ai = c.env.AI
  if (!ai) {
    throw new ApiError(503, 'server_misconfigured', 'Workers AI is not bound to this deployment')
  }

  const body = await readJson<ImageBody>(c, JSON_BODY_LIMITS.note)
  const prompt = readImagePrompt(body.prompt)

  let bytes: Uint8Array
  try {
    bytes = await normalizeImageResult(await ai.run(IMAGE_MODEL, { prompt }))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw upstreamFailure(error)
  }
  if (!bytes.length) throw new ApiError(502, 'internal', 'The image model returned no data')

  return new Response(bytes, {
    headers: {
      'Content-Type': imageMediaType(bytes),
      'Content-Length': String(bytes.length),
      'Cache-Control': 'no-store',
    },
  })
})
