import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CLIENT_DIR = join(process.cwd(), 'src/client')
const STYLES_DIR = join(CLIENT_DIR, 'styles')

const INJECTED_AT_RUNTIME = [/^--shiki-/, /^--code-/, /^--app-viewport-/]
const KNOWN_UPSTREAM_GAPS = ['--shadow-soft', '--danger-soft']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(tsx?|css)$/.test(entry)) out.push(path)
  }
  return out
}

function definedTokens(): Set<string> {
  const names = new Set<string>()
  for (const file of readdirSync(STYLES_DIR).filter((name) => name.endsWith('.css'))) {
    const css = readFileSync(join(STYLES_DIR, file), 'utf8')
    for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:/gi)) names.add(match[1])
  }
  return names
}

function usedTokens(): Map<string, string[]> {
  const uses = new Map<string, string[]>()
  for (const file of walk(CLIENT_DIR)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/var\((--[a-z0-9-]+)/gi)) {
      const name = match[1]
      const list = uses.get(name) ?? []
      if (!list.includes(file)) list.push(file)
      uses.set(name, list)
    }
  }
  return uses
}

describe('CSS custom properties', () => {
  it('never references a token that no stylesheet defines', () => {
    const defined = definedTokens()
    const undefinedUses = [...usedTokens()]
      .filter(([name]) => !defined.has(name))
      .filter(([name]) => !INJECTED_AT_RUNTIME.some((pattern) => pattern.test(name)))
      .filter(([name]) => !KNOWN_UPSTREAM_GAPS.includes(name))
      .map(([name, files]) => `${name} used in ${files.map((f) => f.replace(CLIENT_DIR, '')).join(', ')}`)
    expect(undefinedUses).toEqual([])
  })

  it('still sees the known gaps, so the exception list cannot rot silently', () => {
    const defined = definedTokens()
    for (const name of KNOWN_UPSTREAM_GAPS) expect(defined.has(name)).toBe(false)
  })

  it('actually knows about the tokens this project defines', () => {
    const defined = definedTokens()
    expect(defined.has('--bg-overlay')).toBe(true)
    expect(defined.has('--bg-surface')).toBe(true)
    expect(defined.has('--bg-elevated')).toBe(false)
  })
})
