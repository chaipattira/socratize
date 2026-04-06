interface ToolCallRowProps {
  name: string
  input: Record<string, unknown>
  done: boolean
}

export function ToolCallRow({ name, input, done }: ToolCallRowProps) {
  const label = (input.filename ?? input.section)
    ? String(input.filename ?? input.section)
    : ''
  return (
    <div className="flex items-center gap-2 text-xs text-stone-400 py-0.5">
      {done ? (
        <span className="w-1.5 h-1.5 rounded-full bg-sepia shrink-0" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-wine/40 animate-pulse shrink-0" />
      )}
      <span className="font-medium text-stone-500 capitalize">{name.replace(/_/g, ' ')}</span>
      {label && <span className="font-mono text-stone-400 bg-vellum border border-sepia px-1.5 py-0.5 rounded text-[11px] truncate max-w-[240px]">{label}</span>}
    </div>
  )
}
