import { describe, it, expect } from 'vitest'
import { applyDocOps } from '@/lib/doc-ops'
import type { DocOp } from '@/lib/doc-ops'

const BASE_DOC = `# Confounding

## Overview

Intro text.

## Core Concepts

Initial concept.`

describe('applyDocOps', () => {
  describe('append', () => {
    it('appends content to an existing section', () => {
      const ops: DocOp[] = [
        { op: 'append', section: '## Core Concepts', content: 'New concept added.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      expect(result).toContain('Initial concept.\n\nNew concept added.')
    })

    it('creates section if it does not exist', () => {
      const ops: DocOp[] = [
        { op: 'append', section: '## Misconceptions', content: 'Common mistake.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      expect(result).toContain('## Misconceptions\n\nCommon mistake.')
    })
  })

  describe('update', () => {
    it('replaces text within a section', () => {
      const ops: DocOp[] = [
        { op: 'update', section: '## Overview', find: 'Intro text.', replace: 'Better intro.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      expect(result).toContain('Better intro.')
      expect(result).not.toContain('Intro text.')
    })
  })

  describe('insert_section', () => {
    it('inserts a new section after a specified heading', () => {
      const ops: DocOp[] = [
        { op: 'insert_section', after: '## Overview', content: '## Procedures\n\nStep 1.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      const overviewIdx = result.indexOf('## Overview')
      const proceduresIdx = result.indexOf('## Procedures')
      const conceptsIdx = result.indexOf('## Core Concepts')
      expect(proceduresIdx).toBeGreaterThan(overviewIdx)
      expect(proceduresIdx).toBeLessThan(conceptsIdx)
    })
  })

  describe('replace_section', () => {
    it('replaces entire section content', () => {
      const ops: DocOp[] = [
        { op: 'replace_section', section: '## Core Concepts', content: '## Core Concepts\n\nReplaced content.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      expect(result).toContain('Replaced content.')
      expect(result).not.toContain('Initial concept.')
    })
  })

  it('applies multiple ops in sequence', () => {
    const ops: DocOp[] = [
      { op: 'append', section: '## Core Concepts', content: 'Added.' },
      { op: 'append', section: '## Overview', content: 'Also added.' },
    ]
    const result = applyDocOps(BASE_DOC, ops)
    expect(result).toContain('Added.')
    expect(result).toContain('Also added.')
  })

  it('returns unchanged doc when ops array is empty', () => {
    expect(applyDocOps(BASE_DOC, [])).toBe(BASE_DOC)
  })
})
