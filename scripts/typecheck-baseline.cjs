#!/usr/bin/env node

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const baselinePath = path.join(root, 'typecheck-baseline.json')
const mode = process.argv[2] || '--check'

if (!['--check', '--full', '--init', '--update'].includes(mode)) {
  console.error('Usage: node scripts/typecheck-baseline.cjs [--check|--full|--init|--update]')
  process.exit(2)
}

function generateRouteTypes() {
  const appRoot = path.join(root, 'src/app')
  if (!fs.existsSync(appRoot)) throw new Error(`Route directory missing: ${appRoot}`)
  process.env.EXPO_ROUTER_APP_ROOT = appRoot
  const requireContext = require('expo-router/build/testing-library/require-context-ponyfill').default
  const { EXPO_ROUTER_CTX_IGNORE } = require('expo-router/_ctx-shared')
  const { getTypedRoutesDeclarationFile } = require('expo-router/build/typed-routes/generate')
  const context = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE)
  const declaration = getTypedRoutesDeclarationFile(context)
  if (!declaration) throw new Error('Expo Router did not generate route types')
  const typesDir = path.join(root, '.expo/types')
  fs.mkdirSync(typesDir, { recursive: true })
  fs.writeFileSync(path.join(typesDir, 'router.d.ts'), declaration)
  return context.keys().length
}

function diagnostics() {
  const configPath = path.join(root, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  if (parsed.options.strict !== true) throw new Error('TypeScript strict mode must stay enabled')
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  return [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  )
}

function identity(diagnostic) {
  const file = diagnostic.file
    ? path.relative(root, diagnostic.file.fileName).split(path.sep).join('/')
    : '<project>'
  // Generated route unions change diagnostic prose whenever a route is added.
  // The offending source span and line stay stable across that change and line moves.
  const start = diagnostic.start || 0
  const line = diagnostic.file && diagnostic.start !== undefined
    ? diagnostic.file.getLineAndCharacterOfPosition(start).line
    : 0
  const lineStarts = diagnostic.file && diagnostic.file.getLineStarts()
  const sourceLine = diagnostic.file
    ? diagnostic.file.text.slice(lineStarts[line], lineStarts[line + 1] || diagnostic.file.text.length).trim().replace(/\s+/g, ' ')
    : ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').split(root).join('<project>')
  const sourceSpan = diagnostic.file && diagnostic.start !== undefined
    ? diagnostic.file.text.slice(start, start + (diagnostic.length || 0)).trim().replace(/\s+/g, ' ')
    : ''
  const fingerprint = crypto.createHash('sha256')
    .update(JSON.stringify([file, diagnostic.code, sourceLine, sourceSpan]))
    .digest('hex')
  return { fingerprint, file, code: diagnostic.code }
}

function snapshot(all) {
  const entries = new Map()
  for (const diagnostic of all) {
    const item = identity(diagnostic)
    const prior = entries.get(item.fingerprint)
    if (prior) prior.count += 1
    else entries.set(item.fingerprint, { ...item, count: 1 })
  }
  return {
    version: 1,
    typescript: ts.version,
    total: all.length,
    diagnostics: [...entries.values()].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)),
  }
}

function summary(all, routeFiles) {
  const codes = new Map()
  const areas = new Map()
  for (const diagnostic of all) {
    const { file, code } = identity(diagnostic)
    const area = file.startsWith('src/') ? file.split('/').slice(0, 2).join('/') : file.split('/')[0]
    codes.set(code, (codes.get(code) || 0) + 1)
    areas.set(area, (areas.get(area) || 0) + 1)
  }
  const ordered = (map) => Object.fromEntries([...map].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))))
  console.log(`TypeScript ${ts.version}; ${routeFiles} route files; ${all.length} diagnostics`)
  console.log(`By code: ${JSON.stringify(ordered(codes))}`)
  console.log(`By area: ${JSON.stringify(ordered(areas))}`)
}

function main() {
  const routeFiles = generateRouteTypes()
  const all = diagnostics()
  const current = snapshot(all)
  summary(all, routeFiles)

  if (mode === '--full') {
    console.log(ts.formatDiagnosticsWithColorAndContext(all, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (file) => file,
      getNewLine: () => '\n',
    }))
    process.exitCode = all.length ? 1 : 0
    return
  }

  if (mode === '--init') {
    if (fs.existsSync(baselinePath)) throw new Error('Baseline already exists; use --update to shrink it')
    fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
    console.log(`Created ${path.relative(root, baselinePath)}`)
    return
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  if (baseline.version !== 1 || baseline.typescript !== ts.version) {
    throw new Error('Baseline format or TypeScript version changed; review and migrate the baseline explicitly')
  }
  const allowed = new Map(baseline.diagnostics.map((item) => [item.fingerprint, item.count]))
  const additions = current.diagnostics.filter((item) => item.count > (allowed.get(item.fingerprint) || 0))
  if (additions.length) {
    const newFingerprints = new Set(additions.map((item) => item.fingerprint))
    const samples = all.filter((diagnostic) => newFingerprints.has(identity(diagnostic).fingerprint)).slice(0, 20)
    console.error(`${additions.reduce((sum, item) => sum + item.count - (allowed.get(item.fingerprint) || 0), 0)} new diagnostics in ${additions.length} groups:`)
    console.error(ts.formatDiagnostics(samples, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (file) => file,
      getNewLine: () => '\n',
    }))
    process.exitCode = 1
    return
  }

  if (mode === '--update') {
    if (current.total === baseline.total) {
      console.log('Baseline is unchanged')
      return
    }
    fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
    console.log(`Reduced baseline: ${baseline.total} -> ${current.total}`)
    return
  }

  if (current.total < baseline.total) {
    console.error(`Diagnostics fell from ${baseline.total} to ${current.total}; run npm run check:ts:update and commit the smaller baseline`)
    process.exitCode = 1
    return
  }
  console.log(`No new diagnostics (baseline ${baseline.total}, current ${current.total})`)
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 2
}
