const OPS_SCHEMA = {
  type: 'array' as const,
  description: 'List of document operations to apply in order',
  items: {
    type: 'object',
    properties: {
      op: { type: 'string', enum: ['append', 'update', 'insert_section', 'replace_section'] },
      section: { type: 'string' },
      content: { type: 'string' },
      after: { type: 'string' },
      find: { type: 'string' },
      replace: { type: 'string' },
    },
    required: ['op'],
  },
}

export const KB_TOOLS_ANTHROPIC = [
  {
    name: 'list_files',
    description: 'List all .md files in the knowledge base folder.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_file',
    description: 'Read the full content of a specific .md file.',
    input_schema: {
      type: 'object' as const,
      properties: { filename: { type: 'string', description: 'Filename, e.g. code-review.md' } },
      required: ['filename'],
    },
  },
  {
    name: 'update_file',
    description: 'Apply ops to an existing .md file in the knowledge base.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'File to update, e.g. code-review.md' },
        ops: OPS_SCHEMA,
      },
      required: ['filename', 'ops'],
    },
  },
  {
    name: 'create_file',
    description: 'Create a new .md file in the knowledge base folder.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'New filename, e.g. new-topic.md' },
        content: { type: 'string', description: 'Full initial content of the file' },
      },
      required: ['filename', 'content'],
    },
  },
]

export const KB_TOOLS_OPENAI = KB_TOOLS_ANTHROPIC.map(tool => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  },
}))
