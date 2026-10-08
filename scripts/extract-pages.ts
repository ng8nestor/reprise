// Runs extraction on every image in eval/pages/ and saves raw + parsed
// results to eval/results/<PROMPT_VERSION>/. Run with `npm run extract` (reads .env).
//
// Images are converted to JPEG and downscaled (long edge <= 1568px) with
// macOS's built-in `sips`, so this script only runs on macOS.

import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  extractHighlights,
  type ExtractResult,
} from '../server/extraction/extract.ts'
import { PROMPT_VERSION } from '../server/extraction/prompt.ts'

const run = promisify(execFile)

const ROOT = path.resolve(import.meta.dirname, '..')
const PAGES_DIR = path.join(ROOT, 'eval', 'pages')
// One folder per prompt version so runs never overwrite each other.
const RESULTS_DIR = path.join(ROOT, 'eval', 'results', PROMPT_VERSION)
const MAX_EDGE = 1568
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
  '.webp',
  '.tif',
  '.tiff',
])

async function imageSize(file: string): Promise<{ w: number; h: number }> {
  const { stdout } = await run('sips', [
    '-g',
    'pixelWidth',
    '-g',
    'pixelHeight',
    file,
  ])
  const w = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1])
  const h = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1])
  if (!w || !h) throw new Error(`sips could not read size of ${file}`)
  return { w, h }
}

// Returns the image as base64 JPEG, long edge capped at MAX_EDGE.
// Smaller images are converted but never upscaled.
async function toJpegBase64(file: string): Promise<string> {
  const tmp = await mkdtemp(path.join(tmpdir(), 'reprise-extract-'))
  try {
    const out = path.join(tmp, 'page.jpg')
    const { w, h } = await imageSize(file)
    const resize = Math.max(w, h) > MAX_EDGE ? ['-Z', String(MAX_EDGE)] : []
    await run('sips', ['-s', 'format', 'jpeg', ...resize, file, '--out', out])
    return (await readFile(out)).toString('base64')
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

function clip(text: string, max = 90): string {
  const oneLine = text.replace(/\s+/g, ' ')
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

function printSummary(name: string, result: ExtractResult): void {
  const tokens = result.usage.reduce(
    (sum, u) => sum + u.input_tokens + u.output_tokens,
    0,
  )
  const attempts = `${result.attempts} attempt${result.attempts === 1 ? '' : 's'}`
  console.log(`\n=== ${name}  (${attempts}, ${tokens} tokens)`)

  if (!result.ok) {
    const { error } = result
    const detail =
      error.kind === 'parse'
        ? `${error.parseError.kind}: ${error.parseError.message}`
        : error.kind === 'api'
          ? `${error.status ?? 'network'}: ${error.message}`
          : error.kind === 'refusal'
            ? (error.explanation ?? 'no explanation')
            : error.stopReason
    console.log(`  FAILED (${error.kind}) ${detail}`)
    return
  }

  const { highlights, warnings } = result.data
  if (highlights.length === 0) console.log('  (no highlights)')
  for (const h of highlights) {
    const tags = [...h.codes, ...h.symbols]
    const tagText = tags.length ? ` [${tags.join(', ')}]` : ''
    console.log(
      `  ${h.position}. ${h.color.padEnd(6)}${tagText} "${clip(h.text)}"`,
    )
  }
  for (const w of warnings) console.log(`  ! ${w}`)
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Add it to .env.')
    process.exit(1)
  }

  const files = (await readdir(PAGES_DIR))
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort()
  if (files.length === 0) {
    console.log(`No images found in ${path.relative(ROOT, PAGES_DIR)}/`)
    return
  }

  await mkdir(RESULTS_DIR, { recursive: true })

  let failures = 0
  for (const file of files) {
    const name = path.parse(file).name
    let result: ExtractResult
    try {
      const imageBase64 = await toJpegBase64(path.join(PAGES_DIR, file))
      result = await extractHighlights({ imageBase64, mediaType: 'image/jpeg' })
    } catch (err) {
      failures++
      console.log(`\n=== ${file}\n  CRASHED ${String(err)}`)
      continue
    }

    if (!result.ok) failures++
    printSummary(file, result)

    const raw = result.raws
      .map((r, i) => `----- attempt ${i + 1} -----\n${r}`)
      .join('\n\n')
    await writeFile(path.join(RESULTS_DIR, `${name}.raw.txt`), raw)
    await writeFile(
      path.join(RESULTS_DIR, `${name}.json`),
      JSON.stringify({ source: file, ...result }, null, 2) + '\n',
    )
  }

  console.log(
    `\nDone: ${files.length - failures}/${files.length} pages extracted. Results in ${path.relative(ROOT, RESULTS_DIR)}/`,
  )
  if (failures > 0) process.exitCode = 1
}

await main()
