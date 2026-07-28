import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const supportedLocales = new Set(['en', 'zh-CN', 'ja'])
const locale = process.argv[2]

if (!supportedLocales.has(locale)) {
  throw new Error(`Unsupported locale: ${locale}. Use en, zh-CN, or ja.`)
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entryPath = path.join(projectRoot, 'index.html')
const source = await readFile(entryPath, 'utf8')
const updated = source.replace(
  /<html lang="[^"]+" data-locale="[^"]+">/,
  `<html lang="${locale}" data-locale="${locale}">`,
)

if (updated === source && !source.includes(`data-locale="${locale}"`)) {
  throw new Error('Could not find the locale marker in index.html.')
}

await writeFile(entryPath, updated)
console.log(`Giverny promo locale set to ${locale}.`)
