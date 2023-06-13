import { endent } from '@dword-design/functions'
import { execa } from 'execa'
import { createRequire } from 'module'
import outputFiles from 'output-files'
import { pEvent } from 'p-event'
import stripAnsi from 'strip-ansi'
import withLocalTmpDir from 'with-local-tmp-dir'

const _require = createRequire(import.meta.url)

export default {
  confirm: () =>
    withLocalTmpDir(async () => {
      await outputFiles({
        'ceiling.config.js': endent`
          module.exports = {
            plugins: ['mongodb', 'mysql'],
            endpoints: {
              local: {
                mongodb: {
                  host: 'mongodb-local.de',
                },
                mysql: {
                  host: 'mysql-local.de',
                },
              },
              live: {
                mongodb: {
                  host: 'mongodb-live.de',
                },
                mysql: {
                  host: 'mysql-live.de',
                },
              },
            },
          }
        `,
        node_modules: {
          'ceiling-plugin-mongodb/index.js': endent`
            module.exports = {
              endpointToString: ({ host }) => \`mongodb://\${host}\`,
              sync: () => console.log('synced mongodb'),
            }
          `,
          'ceiling-plugin-mysql/index.js': endent`
            module.exports = {
              endpointToString: ({ host }) => \`mysql://\${host}\`,
              sync: () => console.log('synced mysql'),
            }
          `,
        },
        'package.json': endent`
          {
            "devDependencies": {
              "ceiling-plugin-mongodb": "^1.0.0",
              "ceiling-plugin-mysql": "^1.0.0"
            }
          }
        `,
      })

      const childProcess = execa(_require.resolve('./cli.js'), ['pull'], {
        all: true,
      })
      await pEvent(childProcess.all, 'data')
      childProcess.stdin.write('y\n')

      const output = await childProcess
      expect(output.all |> stripAnsi).toEqual(endent`
        ? Are you sure you want to …
          - mongodb://mongodb-live.de => mongodb://mongodb-local.de
          - mysql://mysql-live.de => mysql://mysql-local.de
         (y/N) y? Are you sure you want to …
          - mongodb://mongodb-live.de => mongodb://mongodb-local.de
          - mysql://mysql-live.de => mysql://mysql-local.de
         Yes
        mongodb://mongodb-live.de => mongodb://mongodb-local.de …
        synced mongodb
        mysql://mysql-live.de => mysql://mysql-local.de …
        synced mysql
      `)
    }),
  'error inside plugin': () =>
    withLocalTmpDir(async () => {
      await outputFiles({
        'ceiling.config.js': endent`
          module.exports = {
            plugins: ['mysql'],
          }
        `,
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          module.exports = {
            sync: () => { throw new Error('foo') }
          }
        `,
        'package.json': endent`
          {
            "devDependencies": {
              "ceiling-plugin-mysql": "^1.0.0"
            }
          }
        `,
      })
      let all
      try {
        await execa(_require.resolve('./cli.js'), ['pull', '-y'], { all: true })
      } catch (error) {
        all = error.all
      }
      expect(all).toEqual(endent`
        undefined => undefined …
        foo
      `)
    }),
  'no endpointToString': () =>
    withLocalTmpDir(async () => {
      await outputFiles({
        'ceiling.config.js': endent`
          module.exports = {
            plugins: ['mysql'],
          }
        `,
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          module.exports = {
            sync: () => {},
          }
        `,
        'package.json': endent`
          {
            "devDependencies": {
              "ceiling-plugin-mysql": "^1.0.0"
            }
          }
        `,
      })

      const output = await execa(_require.resolve('./cli.js'), ['pull', '-y'], {
        all: true,
      })
      expect(output.all).toEqual('undefined => undefined …')
    }),
  'no plugins': () =>
    withLocalTmpDir(async () => {
      const output = await execa(_require.resolve('./cli.js'), ['pull', '-y'], {
        all: true,
      })
      expect(output.all).toEqual('No plugins specified. Doing nothing …')
    }),
  'no sync': () =>
    withLocalTmpDir(async () => {
      await outputFiles({
        'ceiling.config.js': endent`
          module.exports = {
            plugins: ['mysql'],
          }
        `,
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          module.exports = {}
        `,
        'package.json': endent`
          {
            "devDependencies": {
              "ceiling-plugin-mysql": "^1.0.0"
            }
          }
        `,
      })

      const output = await execa(_require.resolve('./cli.js'), ['pull', '-y'], {
        all: true,
      })
      expect(output.all).toEqual('undefined => undefined …')
    }),
  'two plugins': () =>
    withLocalTmpDir(async () => {
      await outputFiles({
        'ceiling.config.js': endent`
          module.exports = {
            plugins: ['mysql', 'mongodb'],
            endpoints: {
              local: {
                mysql: {
                  host: 'mysql-local.de',
                },
                mongodb: {
                  host: 'mongodb-local.de',
                },
              },
              live: {
                mysql: {
                  host: 'mysql-live.de',
                },
                mongodb: {
                  host: 'mongodb-live.de',
                },
              },
            },
          }
        `,
        node_modules: {
          'ceiling-plugin-mongodb/index.js': endent`
            module.exports = {
              endpointToString: ({ host }) => \`mongodb://\${host}\`,
              sync: (from, to) => {
                console.log(from)
                console.log(to)
              },
            }
          `,
          'ceiling-plugin-mysql/index.js': endent`
            module.exports = {
              endpointToString: ({ host }) => \`mysql://\${host}\`,
              sync: (from, to) => {
                console.log(from)
                console.log(to)
              },
            }
          `,
        },
        'package.json': endent`
          {
            "devDependencies": {
              "ceiling-plugin-mysql": "^1.0.0",
              "ceiling-plugin-mongodb": "^1.0.0"
            }
          }
        `,
      })

      const output = await execa(_require.resolve('./cli.js'), ['pull', '-y'], {
        all: true,
      })
      expect(output.all).toEqual(endent`
        mysql://mysql-live.de => mysql://mysql-local.de …
        { host: 'mysql-live.de' }
        { host: 'mysql-local.de' }
        mongodb://mongodb-live.de => mongodb://mongodb-local.de …
        { host: 'mongodb-live.de' }
        { host: 'mongodb-local.de' }
      `)
    }),
  valid: () =>
    withLocalTmpDir(async () => {
      await outputFiles({
        'ceiling.config.js': endent`
          module.exports = {
            plugins: ['mysql'],
            endpoints: {
              local: {
                mysql: {
                  host: 'local.de',
                },
              },
              live: {
                mysql: {
                  host: 'live.de',
                },
              },
            },
          }
        `,
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          module.exports = {
            endpointToString: ({ host }) => \`mysql://\${host}\`,
            sync: (from, to) => {
              console.log(from)
              console.log(to)
            },
          }
        `,
        'package.json': endent`
          {
            "devDependencies": {
              "ceiling-plugin-mysql": "^1.0.0"
            }
          }
        `,
      })

      const output = await execa(_require.resolve('./cli.js'), ['pull', '-y'], {
        all: true,
      })
      expect(output.all).toEqual(endent`
        mysql://live.de => mysql://local.de …
        { host: 'live.de' }
        { host: 'local.de' }
      `)
    }),
}
