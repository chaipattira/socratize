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
        <div className="w-48 shrink-0 border-r border-gray-800 flex flex-col bg-gray-950">
          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-800 font-medium uppercase tracking-wide">
            Files
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {files!.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-600 italic">No files yet</p>
            )}
            {files!.map(f => (
              <button
                key={f}
                onClick={() => onFileClick?.(f)}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate transition ${
                  f === activeFilename
                    ? 'bg-gray-800 text-gray-100'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500 flex justify-between items-center shrink-0">
          <span className="font-mono truncate">{filename || 'No file selected'}</span>
          <div className="flex items-center gap-3 shrink-0">
            {!showSidebar && <span className="text-green-500">● Auto-updating</span>}
            <button
              onClick={handleDownload}
              className="text-blue-400 hover:text-blue-300 transition text-xs"
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
              theme={"dark" as any}
              extensions={extensions}
              className="h-full text-sm"
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Select a file from the sidebar
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
