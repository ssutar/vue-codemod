import { ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier, StringLiteral } from 'jscodeshift';
import wrap from '../src/wrapAstTransformation'
import type { ASTTransformation } from '../src/wrapAstTransformation'

import { transformAST as addImport } from './add-import'

import * as fs from 'fs'
import * as path from 'path'

const PATH_TO_COMPONENTS_FOLDER = '/Users/ssutar/src/frontend/apps/admin/src/components'

const COMPONENTS_TO_IGNORE = [
  'Transition',
  'Teleport',
  'TransitionGroup',
  'RouterLink',
  'RouterView',
  'ShareNetwork',
  'KeepAlive',
  'VDropdown',
  'VMenu',
  'VTooltip',
]

function toPascalCase(text: string) {
  if (text === 'i18n' || text === 'si18n') {
    return text
  }
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

function clearAndUpper(text: string) {
  return text.replace(/-/, "").toUpperCase();
}

function getAllFiles(dirPath: string, arrayOfFiles: string[]) {
  const files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file))
    }
  })

  return arrayOfFiles
}

function createComponentsPathMap() {
  const map: Record<string, string> = {}

  const allComponentPaths = getAllFiles(PATH_TO_COMPONENTS_FOLDER, [])

  allComponentPaths.forEach(function(componentPath) {
    const relativePath = componentPath
      .replace(`${PATH_TO_COMPONENTS_FOLDER}/`, '')
      .replace('.ts', '')
    const componentName = relativePath
                            .replace('/index', '')
                            .replace(/\//g, '')
                            .replace('.vue', '')
                            .toLowerCase()
    map[componentName] = relativePath
  })

  return map;
}

const componentPathMap = createComponentsPathMap()

export const transformAST: ASTTransformation = (
  context
) => {
  const content = context.descriptor?.template?.content;

  if (!content) {
    return
  }

  const templateContent = content.replace(/<!--[\s\S]+-->/g, '')

  const components = [
    ...new Set(
      (templateContent.match(/<(([A-Z]\w+)|((\w+\-\w+)(\-\w+)*)|i18n|si18n)(>|\n|\s)/g) || [])
        .map(component => {
          return toPascalCase(
            component
              .replace('<', '')
              .replace('>', '')
              .replace('\n', '')
              .trim()
            )
          }
        )
      )
    ];

  if (!components?.length) {
    return
  }

  components.forEach((component) => {
    const { root, j, filename } = context

    if (COMPONENTS_TO_IGNORE.includes(component)) {
      return
    }

    const duplicate = root.find(j.ImportDeclaration, {
      specifiers: (
        arr: Array<
          ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier
        >
      ) =>
        // @ts-ignore there's a bug in ast-types definition, the `local` should be non-nullable
        arr.some((s) => s.local.name === component),
    })

    if (duplicate.length) {
      return
    }

    const isDefinedAsync = root.find(j.CallExpression, {
      callee: {
        type: 'Import'
      },
      arguments: (arr: Array<StringLiteral>) => arr.some((s) => {
        return s.value.includes(component) || s.value.includes(componentPathMap[component.toLowerCase()])
      })
    })

    if (isDefinedAsync.length) {
      return
    }

    const defaultExport = root.find(j.ExportDefaultDeclaration)
    const componentsProps = defaultExport.find(j.ObjectProperty, {
      key: {
        name: 'components'
      }
    })

    const existingComponentProps = componentsProps.find(j.ObjectProperty, {
      key: {
        name: component
      }
    })

    if (existingComponentProps.length) {
      return
    }

    if (defaultExport.length && componentsProps.length) {
      // Component has default export with components property
      const importProp = j.objectProperty(j.identifier(component), j.identifier(component))
      importProp.shorthand = true
      componentsProps.get('value').get('properties').push(importProp)
    }

    if (defaultExport.length && !componentsProps.length) {
      // Component has default export but no components property
      const importProp = j.objectProperty(j.identifier(component), j.identifier(component))
      importProp.shorthand = true
      const compProp = j.objectProperty(j.identifier('components'), j.objectExpression([importProp]))
       defaultExport.find(j.ObjectExpression).get('properties').unshift(compProp)
    }

    const importPath = componentPathMap[component.toLowerCase()]

    if (!importPath) {
      console.warn(`${filename}: could not find import path for ${component}`)
    }

    addImport(context, {
      specifier: { type: 'default', local: component },
      source: `~/components/${importPath}`,
    })
  })
}

export default wrap(transformAST)
export const parser = 'babylon'
