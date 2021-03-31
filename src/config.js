import {
  fromPairs,
  identity,
  map,
  mapKeys,
  mapValues,
  noop,
  stubArray,
} from '@dword-design/functions'
import { cosmiconfigSync } from 'cosmiconfig'
import { transform as pluginNameToPackageName } from 'plugin-name-to-package-name'
import resolveFrom from 'resolve-from'

const explorer = cosmiconfigSync('ceiling')

const searchResult = (explorer.search() || undefined)?.config || {}

const pluginNames =
  searchResult.plugins || []
  |> map(shortName => pluginNameToPackageName(shortName, 'ceiling-plugin'))

export default {
  endpoints:
    searchResult.endpoints || {}
    |> mapValues(
      mapKeys((pluginConfig, pluginName) =>
        pluginNameToPackageName(pluginName, 'ceiling-plugin')
      )
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
        ...require(resolveFrom(process.cwd(), name)),
      },
    ])
    |> fromPairs,
}
