export function supportsThinking(provider: string, model: string): boolean {
  if (provider === 'anthropic') {
    // claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5, claude-3-7-sonnet-20250219
    return /claude-(opus|sonnet|haiku)-4-\d/.test(model) || model.includes('claude-3-7')
  }
  if (provider === 'openai') {
    return model.startsWith('o') || model.startsWith('gpt-5')
  }
  return false
}
