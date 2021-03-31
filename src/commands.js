import {
  endent,
  fromPairs,
  identity,
  isEmpty,
  join,
  keys,
  map,
  mapValues,
  pickBy,
  promiseAll,
  property,
  pullAll,
  sortBy,
  values,
} from '@dword-design/functions'
import globby from 'globby'
import inquirer from 'inquirer'
import P from 'path'
import { transform as pluginNameToPackageName } from 'plugin-name-to-package-name'
import sequential from 'promise-sequential'

import config from './config'

const sync = async (operation, endpointName = 'live', options) => {
  const fromEndpoint =
    config.endpoints[operation === 'push' ? 'local' : endpointName]

  const toEndpoint =
    config.endpoints[operation === 'push' ? endpointName : 'local']
  if (
    !options.yes &&
    !(await (async () => {
      const hints =
        config.plugins
        |> mapValues((plugin, pluginName) => {
          const fromPluginConfig = fromEndpoint?.[pluginName]

          const toPluginConfig = toEndpoint?.[pluginName]

          return `  - ${fromPluginConfig |> plugin.endpointToString} => ${
            toPluginConfig |> plugin.endpointToString
          }\n`
        })
        |> values
        |> join('')

      return (
        inquirer.prompt({
          default: false,
          message: endent`
        Are you sure you want to …
        ${hints}
      `,
          name: 'confirm',
          type: 'confirm',
        })
        |> await
        |> property('confirm')
      )
    })())
  ) {
    return undefined
  }
  if (config.plugins |> isEmpty) {
    console.log('No plugins specified. Doing nothing …')

    return undefined
  }

  return (
    config.plugins
    |> mapValues((plugin, pluginName) => {
      const fromPluginConfig = fromEndpoint?.[pluginName]

      const toPluginConfig = toEndpoint?.[pluginName]
      console.log(
        `${plugin.endpointToString(
          fromPluginConfig
        )} => ${plugin.endpointToString(toPluginConfig)} …`
      )

      return plugin.sync(fromPluginConfig, toPluginConfig)
    })
    |> values
    |> promiseAll
  )
}

export default {
  migrate: {
    arguments: '[endpoint]',
    description: 'Migrate data at an endpoint',
    handler: async (endpointName = 'local', options) => {
      const endpoint = config.endpoints[endpointName]

      const shortPluginNames =
        globby('*', { cwd: 'migrations', onlyDirectories: true })
        |> await
        |> sortBy(identity)

      const migrations =
        shortPluginNames
        |> map(async shortPluginName => {
          const pluginName = pluginNameToPackageName(
            shortPluginName,
            'ceiling-plugin'
          )

          const pluginConfig = endpoint?.[pluginName]

          const plugin = config.plugins[pluginName]

          const executedMigrations =
            pluginConfig |> plugin.getExecutedMigrations |> await

          const migrationNames =
            globby('*', { cwd: P.resolve('migrations', shortPluginName) })
            |> await
            |> sortBy(identity)
            |> map(filename => P.basename(filename, '.js'))
            |> pullAll(executedMigrations)

          return [
            pluginName,
            migrationNames
              |> map(filename => [
                filename,
                require(P.resolve('migrations', shortPluginName, filename)),
              ])
              |> fromPairs,
          ]
        })
        |> promiseAll
        |> await
        |> fromPairs
        |> pickBy(pluginMigrations => !(pluginMigrations |> isEmpty))
      if (
        !options.yes &&
        !(await (async () => {
          const hints =
            migrations
            |> mapValues((pluginMigrations, pluginName) => {
              const plugin = config.plugins[pluginName]

              return endent`
                ${endpoint?.[pluginName] |> plugin.endpointToString}
                  ${
                    pluginMigrations
                    |> keys
                    |> map(name => `- ${name}`)
                    |> join('\n')
                  }
              `
            })
            |> values
            |> map(string => `${string}\n`)
            |> join('')

          return (
            inquirer.prompt({
              default: false,
              message: endent`
            Are you sure you want to …
            ${hints}
          `,
              name: 'confirm',
              type: 'confirm',
            })
            |> await
            |> property('confirm')
          )
        })())
      ) {
        return
      }
      if (config.plugins |> isEmpty) {
        console.log('No plugins specified. Doing nothing …')

        return
      }

      const runPluginMigrations = async (pluginMigrations, pluginName) => {
        const pluginConfig = config.endpoints[endpointName]?.[pluginName]

        const plugin = config.plugins[pluginName]
        console.log(`Migrating ${pluginConfig |> plugin.endpointToString} …`)
        await (pluginMigrations
          |> mapValues((migration, name) => () => {
            console.log(`  - ${name}`)

            return migration.up(pluginConfig |> plugin.getMigrationParams)
          })
          |> values
          |> sequential)

        return plugin.addExecutedMigrations(
          pluginConfig,
          pluginMigrations |> keys
        )
      }
      await (migrations
        |> mapValues((pluginMigrations, pluginName) => () =>
          runPluginMigrations(pluginMigrations, pluginName)
        )
        |> values
        |> sequential)
    },
    options: [
      {
        description: 'do not ask for confirmation',
        name: '-y, --yes',
      },
    ],
  },
  pull: {
    arguments: '[endpoint]',
    description: 'Pull data from an endpoint or from all endpoints',
    handler: (endpointName, options) => sync('pull', endpointName, options),
    options: [
      {
        description: 'do not ask for confirmation',
        name: '-y, --yes',
      },
    ],
  },
  push: {
    arguments: '[endpoint]',
    description: 'Push data to an endpoint or to all endpoints',
    handler: (endpointName, options) => sync('push', endpointName, options),
    options: [
      {
        description: 'do not ask for confirmation',
        name: '-y, --yes',
      },
    ],
  },
}
