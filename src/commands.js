import config from './config'
import { map, pullAll, mapValues, values, join, keys, pickBy, isEmpty, promiseAll, reduce, endent, zipObject, unary } from '@dword-design/functions'
import glob from 'glob-promise'
import P from 'path'
import Confirm from 'prompt-confirm'
import getPluginName from './get-plugin-name'

const sync = async (operation, endpointName = 'live', { yes }) => {
  const fromEndpoint = config.endpoints[operation === 'push' ? 'local' : endpointName]
  const toEndpoint = config.endpoints[operation === 'push' ? endpointName : 'local']
  if (!yes && !(await (() => {
    const hints = config.plugins
      |> mapValues(
        ({ endpointToString }, pluginName) => {
          const fromPluginConfig = fromEndpoint?.[pluginName]
          const toPluginConfig = toEndpoint?.[pluginName]
          return ` - ${fromPluginConfig |> endpointToString} => ${toPluginConfig |> endpointToString}\n`
        }
      )
      |> values
      |> join('')
    const confirm = new Confirm(endent`
      Are you sure you want to …
      ${hints}
    `)
    return confirm.run()
  })())) {
    return
  }
  if (config.plugins |> isEmpty) {
    return console.log('No plugins specified. Doing nothing …')
  }
  return config.plugins
    |> mapValues(({ endpointToString, sync }, pluginName) => {
      const fromPluginConfig = fromEndpoint?.[pluginName]
      const toPluginConfig = toEndpoint?.[pluginName]
      console.log(`${endpointToString(fromPluginConfig)} => ${endpointToString(toPluginConfig)} …`)
      return sync(fromPluginConfig, toPluginConfig)
    })
    |> values
    |> promiseAll
    |> await
}

export default {
  push: {
    arguments: '[endpoint]',
    description: 'Push data to an endpoint or to all endpoints',
    options: [
      {
        name: '-y, --yes',
        description: 'do not ask for confirmation',
      },
    ],
    handler: async (endpointName, options) => sync('push', endpointName, options),
  },
  pull: {
    arguments: '[endpoint]',
    description: 'Pull data from an endpoint or from all endpoints',
    options: [
      {
        name: '-y, --yes',
        description: 'do not ask for confirmation',
      },
    ],
    handler: async (endpointName, options) => sync('pull', endpointName, options),
  },
  migrate: {
    arguments: '[endpoint]',
    description: 'Migrate data at an endpoint',
    options: [
      {
        name: '-y, --yes',
        description: 'do not ask for confirmation',
      },
    ],
    handler: async (endpointName = 'local', { yes }) => {
      const endpoint = config.endpoints[endpointName]
      const shortPluginNames = glob('*', { cwd: 'migrations' }) |> await
      const migrations = zipObject(
        shortPluginNames |> map(unary(getPluginName)),
        shortPluginNames
          |> map(async shortPluginName => {
            const pluginName = shortPluginName |> getPluginName
            const pluginConfig = endpoint?.[pluginName]
            const { getExecutedMigrations } = config.plugins[pluginName]
            const executedMigrations = pluginConfig |> getExecutedMigrations |> await
            const migrationNames = glob('*', { cwd: P.resolve('migrations', shortPluginName) })
              |> await
              |> map(filename => P.basename(filename, '.js'))
              |> pullAll(executedMigrations)
            return zipObject(
              migrationNames,
              migrationNames
                |> map(filename => require(P.resolve('migrations', shortPluginName, filename)))
            )
          })
          |> promiseAll
          |> await
      )
        |> pickBy(migrations => !(migrations |> isEmpty))

      if (!yes && !(await (() => {
        const hints = migrations
          |> mapValues(
            (migrations, pluginName) => {
              const { endpointToString } = config.plugins[pluginName]
              return endent`
                ${endpoint?.[pluginName] |> endpointToString}
                 ${migrations |> keys |> map(name => `- ${name}`) |> join('\n')}
              `
            }
          )
          |> values
          |> map(string => `${string}\n`)
          |> join('')
        const confirm = new Confirm(endent`
          Are you sure you want to …
          ${hints}
        `)
        return confirm.run()
      })())) {
        return
      }
      if (config.plugins |> isEmpty) {
        return console.log('No plugins specified. Doing nothing …')
      }

      migrations
        |> mapValues(async (migrations, pluginName) => {
          const pluginConfig = config.endpoints[endpointName]?.[pluginName]
          const { endpointToString, setExecutedMigrations, getMigrationParams } = config.plugins[pluginName]

          console.log(`Migrating ${pluginConfig |> endpointToString} …`)
          migrations
            |> mapValues(({ up }, name) => {
              console.log(` - ${name}`)
              return up(pluginConfig |> getMigrationParams)
            })
            |> values
            |> reduce((acc, promise) => acc.then(() => promise), Promise.resolve())
            |> await
          return setExecutedMigrations(pluginConfig, migrations |> keys)
        })
        |> values
        |> promiseAll
        |> await
    },
  },
}