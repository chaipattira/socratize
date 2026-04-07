import { useState } from 'react'

interface ToolCallRowProps {
  name: string
  input: Record<string, unknown>
  done: boolean
}

function CommandScript({ command }: { command: string }) {
  const [expanded, setExpanded] = useState(false)
  const lines = command.split('\n')
  const isMultiLine = lines.length > 1

  if (!isMultiLine) {
    return (
      <span className="font-mono text-stone-400 bg-vellum border border-sepia px-1.5 py-0.5 rounded text-[11px] break-all whitespace-pre-wrap">
        {command}
      </span>
    )
  }

  return (
    <div className="mt-0.5 w-full">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition font-mono max-w-[240px]"
      >
        <span className="truncate">{lines[0]}…</span>
        <span className="text-stone-300 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <pre className="mt-1 pl-3 border-l border-sepia text-[11px] text-stone-400 leading-relaxed font-mono max-h-40 overflow-y-auto">
          {command}
        </pre>
      )}
    </div>
  )
}

export function ToolCallRow({ name, input, done }: ToolCallRowProps) {
  const label = (input.filename ?? input.section)
    ? String(input.filename ?? input.section)
    : ''
  const command = name === 'run_command' && typeof input.command === 'string'
    ? input.command
    : null

  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      <div className="flex items-center gap-2 text-xs text-stone-400">
        {done ? (
          <span className="w-1.5 h-1.5 rounded-full bg-sepia shrink-0" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-wine/40 animate-pulse shrink-0" />
        )}
        <span className="font-medium text-stone-500 capitalize">{name.replace(/_/g, ' ')}</span>
        {label && (
          <span className="font-mono text-stone-400 bg-vellum border border-sepia px-1.5 py-0.5 rounded text-[11px] truncate max-w-[240px]">
            {label}
          </span>
        )}
      </div>
      {command && <div className="pl-3.5"><CommandScript command={command} /></div>}
    </div>
  )
}
