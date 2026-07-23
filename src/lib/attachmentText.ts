import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const ATTACHMENT_TEXT_LIMIT = 16000

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

export async function extractAttachmentText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || file.type.startsWith('text/')) {
    return (await file.text()).slice(0, ATTACHMENT_TEXT_LIMIT)
  }
  if (name.endsWith('.docx')) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const docXml = await zip.file('word/document.xml')?.async('string')
    if (!docXml) return ''
    const withBreaks = docXml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
    return decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, ''))
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, ATTACHMENT_TEXT_LIMIT)
  }
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const parts: string[] = []
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 20); pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, ATTACHMENT_TEXT_LIMIT)
  }
  if (name.endsWith('.pptx')) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const slideFiles = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((left, right) => Number(left.match(/\d+/)?.[0] ?? 0) - Number(right.match(/\d+/)?.[0] ?? 0))
    const parts: string[] = []
    for (const path of slideFiles) {
      const xml = await zip.file(path)?.async('string') ?? ''
      const withBreaks = xml.replace(/<\/a:p>/g, '\n').replace(/<\/a:r>/g, ' ')
      const text = decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim()
      if (text) parts.push(text)
    }
    return parts.join('\n\n').slice(0, ATTACHMENT_TEXT_LIMIT)
  }
  return ''
}
