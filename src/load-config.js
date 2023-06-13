import {
  fromPairs,
  identity,
  map,
  mapKeys,
  mapValues,
  noop,
  stubArray,
} from '@dword-design/functions'
import { cosmiconfig } from 'cosmiconfig'
import jiti from 'jiti'
import { transform as pluginNameToPackageName } from 'plugin-name-to-package-name'

export default async () => {
  const explorer = cosmiconfig('ceiling')

  const searchResult = ((await explorer.search()) || undefined)?.config || {}

  const pluginNames =
    searchResult.plugins || []
    |> map(shortName => pluginNameToPackageName(shortName, 'ceiling-plugin'))

  const jitiInstance = jiti(process.cwd(), {
    esmResolve: true,
    interopDefault: true,
  })

  return {
    endpoints:
      searchResult.endpoints || {}
      |> mapValues(
        mapKeys((pluginConfig, pluginName) =>
          pluginNameToPackageName(pluginName, 'ceiling-plugin'),
        ),
      ),
    plugins:
      pluginNames
      |> map(name => [
        name,
        {
          addExecutedMigrations: noop,
          endpointToString: JSON.stringify,
          getExecutedMigrations: stubArray,
          getMigrationParams: identity,
          sync: noop,
          ...jitiInstance(name),
        },
      ])
      |> fromPairs,
  }
}
