'use client'
import dynamic from 'next/dynamic'
import { useCallback } from 'react'
import { markdown } from '@codemirror/lang-markdown'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

interface EditorPaneProps {
  filename: string
  content: string
  onChange: (value: string) => void
  onDownload: () => void
}

export function EditorPane({ filename, content, onChange, onDownload }: EditorPaneProps) {
  const handleDownload = useCallback(() => onDownload(), [onDownload])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500 flex justify-between items-center">
        <span className="font-mono">{filename}</span>
        <div className="flex items-center gap-3">
          <span className="text-green-500">● Auto-updating</span>
          <button
            onClick={handleDownload}
            className="text-blue-400 hover:text-blue-300 transition text-xs"
          >
            Download .md
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          onChange={onChange}
          height="100%"
          theme={"dark" as any}
          extensions={[markdown()]}
          className="h-full text-sm"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
          }}
        />
      </div>
    </div>
  )
}
