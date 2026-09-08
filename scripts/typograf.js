const fs = require('fs')
const path = require('path')
const Typograf = require('typograf')

const ROOT = path.join(__dirname, '..')
const FILES = [
  'index.html',
  'project-1.html',
  'project-2.html',
  'project-3.html',
  'project-4.html'
]

// Контентные теги, чей текст мы типографируем.
// Атрибуты тегов НЕ трогаем (в typograf выключено common/html/processingAttrs).
const CONTENT_TAGS = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'title', 'span', 'dt', 'dd', 'figcaption', 'blockquote']

const tp = new Typograf({
  locale: ['ru', 'en-US'],
  htmlEntity: { type: 'name', onlyInvisible: true }
})

// Обработка содержимого одного тега `<tag ...>CONTENT</tag>`, лежащего в одной строке.
function typografLine(line) {
  if (!line.includes('<') || !line.includes('>')) return line

  const tagRe = /<\/?[\w-]+/g
  const tagNames = new Set(CONTENT_TAGS)

  // Регэксп для `<открывающий тег>...внутренности...</закрывающий>` в пределах строки.
  // Открывающий тег может содержать атрибуты. Найдите поочерёдно все открывающие teги
  // из CONTENT_TAGS и обработайте их парное содержимое, если они симметричны на одной строке.
  let result = line

  for (const tag of CONTENT_TAGS) {
    // Используем единый подход: `<tag\b[^>]*>([\s\S]*?)</tag>`
    // но важно не задевать вложенные такие же теги на одной строке (редко).
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g')
    result = result.replace(re, (full, inner) => {
      const processed = tp.execute(inner)
      return full.replace(inner, processed)
    })
  }

  return result
}

// Обработка только текстовых строк, не трогая структуру HTML и <script>/<style>.
// Отступы и переносы сохраняются: обрабатываем построчно.
function processContent(html) {
  const lines = html.split('\n')
  let inScript = false
  let inStyle = false
  const out = lines.map((line) => {
    if (/<script\b/i.test(line)) inScript = true
    if (/<style\b/i.test(line)) inStyle = true

    let processed = line
    if (!inScript && !inStyle) {
      processed = typografLine(line)
    }

    if (/<\/script>/i.test(line)) inScript = false
    if (/<\/style>/i.test(line)) inStyle = false
    return processed
  })
  return out.join('\n')
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8')
  const processed = processContent(original)

  if (processed === original) {
    console.log(`[OK]  ${path.basename(filePath)} — без изменений`)
    return false
  }

  fs.writeFileSync(filePath, processed, 'utf8')
  console.log(`[изменён]  ${path.basename(filePath)}`)
  return true
}

console.log('Запуск типографика (безопасная обработка текстовых узлов)...\n')

let changed = 0
for (const file of FILES) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) {
    console.log(`[пропущен] ${file} — файл не найден`)
    continue
  }
  if (processFile(p)) changed++
}

console.log(`\nГотово. Изменено файлов: ${changed}`)