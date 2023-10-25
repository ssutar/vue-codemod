import jscodeshift, { Transform, Parser } from 'jscodeshift'
// @ts-ignore
import getParser from 'jscodeshift/src/getParser'
import createDebug from 'debug'

import { parse as parseSFC, stringify as stringifySFC } from './sfcUtils'
import type { SFCDescriptor } from './sfcUtils'

import VueTransformation from './VueTransformation'

const debug = createDebug('vue-codemod')

type FileInfo = {
  path: string
  source: string
}

type JSTransformation = Transform & {
  parser?: string | Parser,
  descriptor?: SFCDescriptor
}

type JSTransformationModule =
  | JSTransformation
  | {
      default: Transform
      parser?: string | Parser
    }

type VueTransformationModule =
  | VueTransformation
  | {
      default: VueTransformation
    }

type TransformationModule = JSTransformationModule | VueTransformationModule

export default function runTransformation(
  fileInfo: FileInfo,
  transformationModule: TransformationModule,
  params: { [key: string]: any; } = {}
) {
  let transformation: VueTransformation | JSTransformation
  // @ts-ignore
  if (typeof transformationModule.default !== 'undefined') {
    // @ts-ignore
    transformation = transformationModule.default
  } else {
    transformation = transformationModule
  }

  if (transformation instanceof VueTransformation) {
    debug('TODO: Running VueTransformation')
    return fileInfo.source
  }

  debug('Running jscodeshift transform')

  const { path, source } = fileInfo
  const extension = (/\.([^.]*)$/.exec(path) || [])[0]
  let lang = extension.slice(1)

  let descriptor: SFCDescriptor
  let hasScriptSetup = false
  if (extension === '.vue') {
    descriptor = parseSFC(source, { filename: path }).descriptor

    if (descriptor.scriptSetup && !descriptor.script) {
      hasScriptSetup = true
    }
    // skip .vue files without script block
    if (!descriptor.script && !descriptor.scriptSetup) {
      return source
    }

    if (descriptor.scriptSetup && descriptor.script) {
      console.error(`${path} Found both script and script setup`)
    }
    lang = descriptor.script?.lang || descriptor.scriptSetup?.lang || 'js'
    fileInfo.source = descriptor.script?.content || descriptor.scriptSetup?.content || ''
  }

  let parser = getParser()
  let parserOption = (transformationModule as JSTransformationModule).parser
  // force inject `parser` option for .tsx? files, unless the module specifies a custom implementation
  if (typeof parserOption !== 'object') {
    if (lang.startsWith('ts')) {
      parserOption = lang
    }
  }

  if (parserOption) {
    parser =
      typeof parserOption === 'string' ? getParser(parserOption) : parserOption
  }

  const j = jscodeshift.withParser(parser)
  const api = {
    j,
    jscodeshift: j,
    stats: () => {},
    report: () => {},
  }

  params.descriptor = descriptor!
  const out = transformation(fileInfo, api, params)
  if (!out) {
    return source // skipped
  }

  // need to reconstruct the .vue file from descriptor blocks
  if (extension === '.vue') {
    if (out === descriptor!.script!?.content) {
      return source // skipped, don't bother re-stringifying
    }
    if (hasScriptSetup) {
      descriptor!.scriptSetup!.content  = out
    } else {
      descriptor!.script!.content = out
    }
    return stringifySFC(descriptor!)
  }

  return out
}
