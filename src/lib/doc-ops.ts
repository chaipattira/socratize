export type DocOp =
  | { op: 'append'; section: string; content: string }
  | { op: 'update'; section: string; find: string; replace: string }
  | { op: 'insert_section'; after: string; content: string }
  | { op: 'replace_section'; section: string; content: string }

export function applyDocOps(markdown: string, ops: DocOp[]): string {
  return ops.reduce((doc, op) => applyDocOp(doc, op), markdown)
}

function getSectionBounds(
  lines: string[],
  heading: string
): { headingIdx: number; contentStart: number; contentEnd: number } | null {
  const headingIdx = lines.findIndex(l => l.trimEnd() === heading)
  if (headingIdx === -1) return null
  const contentStart = headingIdx + 1
  let contentEnd = lines.length
  for (let i = contentStart; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && i > headingIdx) {
      contentEnd = i
      break
    }
  }
  return { headingIdx, contentStart, contentEnd }
}

function applyDocOp(markdown: string, op: DocOp): string {
  const lines = markdown.split('\n')

  if (op.op === 'append') {
    const bounds = getSectionBounds(lines, op.section)
    if (!bounds) {
      // Section doesn't exist — append it at the end
      return markdown.trimEnd() + `\n\n${op.section}\n\n${op.content}`
    }
    // Insert content before the next section (or end)
    const insertAt = bounds.contentEnd
    lines.splice(insertAt, 0, '', op.content)
    return lines.join('\n')
  }

  if (op.op === 'update') {
    const bounds = getSectionBounds(lines, op.section)
    if (!bounds) return markdown
    const sectionLines = lines.slice(bounds.contentStart, bounds.contentEnd)
    const sectionText = sectionLines.join('\n').replace(op.find, op.replace)
    const newLines = [
      ...lines.slice(0, bounds.contentStart),
      ...sectionText.split('\n'),
      ...lines.slice(bounds.contentEnd),
    ]
    return newLines.join('\n')
  }

  if (op.op === 'insert_section') {
    const bounds = getSectionBounds(lines, op.after)
    if (!bounds) {
      return markdown.trimEnd() + `\n\n${op.content}`
    }
    lines.splice(bounds.contentEnd, 0, '', ...op.content.split('\n'))
    return lines.join('\n')
  }

  if (op.op === 'replace_section') {
    const bounds = getSectionBounds(lines, op.section)
    if (!bounds) return markdown
    const newLines = [
      ...lines.slice(0, bounds.headingIdx),
      ...op.content.split('\n'),
      ...lines.slice(bounds.contentEnd),
    ]
    return newLines.join('\n')
  }

  return markdown
}
