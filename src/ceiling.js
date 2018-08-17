const _ = require('lodash')
const notnull = require('not-null')

class Ceiling {

  static get PUSH() {
    return 'push'
  }
  static get PULL() {
    return 'pull'
  }

  constructor(obj) {
    this.syncProviders = {}
    this.endpoints = {}
    Object.assign(this, obj)
  }

  getEndpoint(endpointName, syncProviderName) {
    return notnull(this.endpoints[endpointName], {})[syncProviderName]
  }

  validate(endpoint) {
    _.forIn(this.syncProviders, syncProvider => syncProvider.validate(endpoint))
  }

  _sync(operation, endpointName) {
    if (_.isEmpty(this.syncProviders)) {
      console.log('No sync providers defined. Doing nothing ...')
    }

    return Promise.all(
      _(this.syncProviders)
        .mapValues((syncProvider, syncProviderName) => {
          try {
            if (syncProvider.sync != null) {
              const fromEndpoint = this.getEndpoint(operation == Ceiling.PUSH ? 'local' : endpointName, syncProviderName)
              const toEndpoint = this.getEndpoint(operation == Ceiling.PUSH ? endpointName : 'local', syncProviderName)
              const endpointToString = notnull(syncProvider.endpointToString, JSON.stringify)

              console.log(`${endpointToString.call(syncProvider, fromEndpoint)} => ${endpointToString.call(syncProvider, toEndpoint)} ...`)
              return syncProvider.sync(fromEndpoint, toEndpoint)
            } else {
              return Promise.resolve()
            }
          } catch (err) {
            return new Promise(({}, reject) => reject(err))
          }
        })
        .values()
        .value()
    )
      .catch(err => console.log(err.message))
  }

  push(endpointName = 'live') {
    return this._sync(Ceiling.PUSH, endpointName)
  }

  pull(endpointName = 'live') {
    return this._sync(Ceiling.PULL, endpointName)
  }

  migrate(endpointName = 'local') {
    return Promise.all(
      _(this.syncProviders)
        .mapValues((syncProvider, syncProviderName) => {
          try {
            if (syncProvider.migrate != null) {
              const endpoint = this.getEndpoint(endpointName, syncProviderName)
              const endpointToString = notnull(syncProvider.endpointToString, JSON.stringify)
              console.log(`Migrating ${endpointToString.call(syncProvider, endpoint)} ...`)
              return syncProvider.migrate(endpoint)
            } else {
              return Promise.resolve()
            }
          } catch (err) {
            return new Promise(({}, reject) => reject(err))
          }
        })
        .values()
        .value()
    )
      .catch(err => console.log(err.message))
  }
}

module.exports = Ceiling
