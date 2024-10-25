import { join, resolve } from 'node:path'
import { getExportsSize } from 'export-size'
import { filesize } from 'filesize'
import fs from 'fs-extra'
import { markdownTable } from 'markdown-table'
import { packages } from '../meta/packages'
import { version } from '../package.json'

async function run() {
  // made shared library imported can resolve correctly
  const packagesRoot = resolve(__dirname, '..', 'packages')
  await fs.writeFile(join(packagesRoot, 'shared/index.mjs'), 'export * from "./dist/index.mjs"', 'utf-8')
  await fs.writeFile(join(packagesRoot, 'core/index.mjs'), 'export * from "./dist/index.mjs"', 'utf-8')
  await fs.copy(join(packagesRoot, 'shared/dist'), join(packagesRoot, 'core/dist/node_modules/@vueuse/shared'), { overwrite: true })

  let md = '# Export size\n\n'
  const mdJSON = <{ [name: string]: string }>{}
  md += 'generated by [export-size](https://github.com/antfu/export-size)<br>\n'
  md += `version: ${version}<br>\n`
  md += `date: ${new Date().toISOString()}\n\n`

  md += '> Please note this is bundle size for each individual APIs (excluding Vue). '
  md += 'Since we have a lot shared utilities underneath each function, importing two '
  md += 'different functions does NOT necessarily mean the bundle size will be the sum of them (usually smaller). '
  md += 'Depends on the bundler and minifier you use, the final result might vary, this list is for reference only.'
  md += '\n\n'

  for (const pkg of [...packages.slice(2), packages[1]]) {
    const { exports, packageJSON } = await getExportsSize({
      pkg: `./packages/${pkg.name}/dist`,
      output: false,
      bundler: 'rollup',
      external: ['vue-demi', ...(pkg.external || [])],
      includes: ['@vueuse/shared'],
    })

    md += `<kbd>${packageJSON.name}</kbd>\n\n`

    md += markdownTable([
      ['Function', 'min+gzipped'],
      ...exports.map((i) => {
        mdJSON[i.name] = filesize(i.minzipped)
        return [`\`${i.name}\``, filesize(i.minzipped)]
      }),
    ])

    md += '\n\n'
  }

  md = md.replace(/\r\n/g, '\n')

  await fs.remove(join(packagesRoot, 'shared/index.mjs'))
  await fs.remove(join(packagesRoot, 'core/index.mjs'))
  await fs.writeFile('packages/export-size.md', md, 'utf-8')
  await fs.writeJSON('packages/export-size.json', mdJSON, { spaces: 2 })
}

run()
