import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

marked.setOptions({
  gfm: true,
  breaks: true
})

export function renderMarkdown(content: string): string {
  if (!content) return ''
  const rawHtml = marked.parse(content) as string
  return DOMPurify.sanitize(rawHtml)
}
