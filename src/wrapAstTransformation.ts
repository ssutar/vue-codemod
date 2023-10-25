import type { JSCodeshift, Transform, Core } from 'jscodeshift'
import { SFCDescriptor } from './sfcUtils'

export type Context = {
  root: ReturnType<Core>
  j: JSCodeshift
  filename: string
  descriptor?: SFCDescriptor
}

export type ASTTransformation<Params = void> = {
  (context: Context, params: Params): void
}


export default function astTransformationToJSCodeshiftModule<Params = any>(
  transformAST: ASTTransformation<Params>
): Transform {
  const transform: Transform = (file, api, options: Params & { descriptor: SFCDescriptor }) => {
    const j = api.jscodeshift
    const root = j(file.source)

    transformAST({ root, j, filename: file.path, descriptor: options?.descriptor }, options)

    return root.toSource({ lineTerminator: '\n' })
  }

  return transform
}
