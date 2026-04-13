'use client'
import dynamic from 'next/dynamic'
import { useCallback, useMemo } from 'react'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

interface EditorPaneProps {
  filename: string
  content: string
  onChange: (value: string) => void
  onDownload: () => void
  files?: string[]
  onFileClick?: (filename: string) => void
  activeFilename?: string
  onSelectionChange?: (text: string) => void
}

export function EditorPane({
  filename,
  content,
  onChange,
  onDownload,
  files,
  onFileClick,
  activeFilename,
  onSelectionChange,
}: EditorPaneProps) {
  const handleDownload = useCallback(() => onDownload(), [onDownload])
  const showSidebar = !!files

  const extensions = useMemo(() => {
    const base = [markdown(), EditorView.lineWrapping]
    if (!onSelectionChange) return base
    return [
      ...base,
      EditorView.updateListener.of(update => {
        if (!update.selectionSet) return
        const sel = update.state.selection.main
        if (sel.empty) {
          onSelectionChange('')
        } else {
          onSelectionChange(update.state.doc.sliceString(sel.from, sel.to))
        }
      }),
    ]
  }, [onSelectionChange])

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      {showSidebar && (
        <div className="w-48 shrink-0 border-r border-sepia flex flex-col bg-vellum">
          <div className="px-3 py-2 text-xs text-stone-500 border-b border-sepia font-medium uppercase tracking-wide">
            Files
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {files!.length === 0 && (
              <p className="px-3 py-2 text-xs text-stone-400 italic">No files yet</p>
            )}
            {files!.map(f => (
              <button
                key={f}
                onClick={() => onFileClick?.(f)}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate transition ${
                  f === activeFilename
                    ? 'bg-linen text-stone-900'
                    : 'text-stone-500 hover:bg-linen hover:text-stone-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-4 py-2 bg-vellum border-b border-sepia text-xs text-stone-600 flex justify-between items-center shrink-0">
          <span className="font-mono truncate">{filename || 'No file selected'}</span>
          <div className="flex items-center gap-3 shrink-0">
            {!showSidebar && <span className="text-wine/60">● Auto-updating</span>}
            <button
              onClick={handleDownload}
              className="text-wine hover:text-wine-hover transition text-xs"
            >
              Download .md
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {(!showSidebar || filename) ? (
            <CodeMirror
              value={content}
              onChange={onChange}
              height="100%"
              theme="light"
              extensions={extensions}
              className="h-full text-sm"
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-stone-400 text-sm">
              Select a file from the sidebar
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
