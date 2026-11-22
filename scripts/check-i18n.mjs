// Fails when en.json and uk.json disagree on their keys. Plural forms differ by language
// (English: one/other; Ukrainian: one/few/many/other), so a key is compared without its suffix.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = new URL('../src/renderer/i18n/', import.meta.url)
const load = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(name, dir)), 'utf-8'))

const PLURAL = /_(zero|one|two|few|many|other)$/

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`.replace(PLURAL, '')]
  )
}

const files = { en: load('en.json'), uk: load('uk.json') }
const sets = Object.fromEntries(Object.entries(files).map(([lang, json]) => [lang, new Set(keys(json))]))

let missing = 0
for (const [lang, set] of Object.entries(sets)) {
  for (const [other, otherSet] of Object.entries(sets)) {
    if (lang === other) continue
    for (const key of otherSet) {
      if (!set.has(key)) {
        console.error(`${lang}.json is missing "${key}" (present in ${other}.json)`)
        missing++
      }
    }
  }
}

if (missing) {
  console.error(`\n${missing} missing key(s).`)
  process.exit(1)
}
console.log(`i18n OK: ${sets.en.size} keys in both languages.`)
