/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Radix primitives that mount react-remove-scroll (runtime <style> injection, blocked by our style-src 'self').
const FORBIDDEN = ['Dialog', 'AlertDialog', 'Select', 'DropdownMenu']
const FORBIDDEN_PKGS = ['dialog', 'alert-dialog', 'select', 'dropdown-menu']

const files = (dir: URL): URL[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(new URL(`${e.name}/`, dir)) : /\.(ts|tsx)$/.test(e.name) ? [new URL(e.name, dir)] : [],
  )

describe('CSP guard', () => {
  it('no source file imports a Radix primitive that mounts RemoveScroll', () => {
    const importRe = /import\s+(?:type\s+)?(?:[\w*\s{},]*?)\s*from\s*['"]([^'"]+)['"]/g
    const offenders: string[] = []
    for (const url of files(new URL('./', import.meta.url))) {
      if (url.pathname.endsWith('guard.test.ts')) continue
      const text = readFileSync(url, 'utf8')
      for (const m of text.matchAll(importRe)) {
        const [stmt, source] = m
        const pkg = FORBIDDEN_PKGS.some((p) => source === `@radix-ui/react-${p}`)
        const named =
          source === 'radix-ui' &&
          FORBIDDEN.some((n) => new RegExp(`(?:\\{[^}]*\\b${n}\\b(?:\\s+as\\s+\\w+)?[^}]*\\})`).test(stmt))
        if (pkg || named) offenders.push(`${url.pathname.split('/src/')[1]}: ${stmt.replace(/\s+/g, ' ')}`)
      }
    }
    expect(
      offenders,
      'Dialog, AlertDialog, Select and DropdownMenu from radix-ui mount react-remove-scroll, which injects a <style> tag at runtime and violates our CSP (style-src \'self\'). Use components/ui/Modal instead.',
    ).toEqual([])
  })
})
