export function renderMarkdown(content: string): string {
  if (!content) return ''

  // Escape basic HTML entities first
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks
  html = html.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="my-3 p-3 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto border border-neutral-700"><code>${code.trim()}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-xs text-primary">$1</code>')

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h4 class="font-bold text-base mt-3 mb-1 text-neutral-900 dark:text-neutral-100">$1</h4>')
  html = html.replace(/^## (.*$)/gim, '<h3 class="font-bold text-lg mt-4 mb-2 text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-1">$1</h3>')
  html = html.replace(/^# (.*$)/gim, '<h2 class="font-bold text-xl mt-4 mb-2 text-neutral-900 dark:text-neutral-100">$1</h2>')

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-neutral-900 dark:text-neutral-100">$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')

  // Bullet items
  html = html.replace(/^[•*-] (.*$)/gim, '<li class="ml-4 list-disc text-sm text-neutral-700 dark:text-neutral-300 my-0.5">$1</li>')

  // Numbered list
  html = html.replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal text-sm text-neutral-700 dark:text-neutral-300 my-0.5">$1</li>')

  // Wrap lists
  html = html.replace(/(<li class="ml-4 list-disc[^>]*>.*?<\/li>)+/gs, '<ul class="my-2 space-y-1">$&</ul>')
  html = html.replace(/(<li class="ml-4 list-decimal[^>]*>.*?<\/li>)+/gs, '<ol class="my-2 space-y-1">$&</ol>')

  // Paragraphs (lines separated by double newline)
  const paragraphs = html.split(/\n{2,}/)
  return paragraphs
    .map(p => {
      const trimmed = p.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<pre')) {
        return trimmed
      }
      return `<p class="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 my-1.5">${trimmed.replace(/\n/g, '<br/>')}</p>`
    })
    .join('')
}
