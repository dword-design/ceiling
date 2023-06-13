import { endent } from '@dword-design/functions'
import tester from '@dword-design/tester'
import testerPluginTmpDir from '@dword-design/tester-plugin-tmp-dir'
import { execa } from 'execa'
import { createRequire } from 'module'
import outputFiles from 'output-files'
import { pEvent } from 'p-event'
import stripAnsi from 'strip-ansi'

const _require = createRequire(import.meta.url)

export default tester(
  {
    confirm: async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          endpoints: {
            live: {
              mongodb: {
                host: 'mongodb-live.de',
              },
              mysql: {
                host: 'mysql-live.de',
              },
            },
            local: {
              mongodb: {
                host: 'mongodb-local.de',
              },
              mysql: {
                host: 'mysql-local.de',
              },
            },
          },
          plugins: ['mongodb', 'mysql'],
        }),
        node_modules: {
          'ceiling-plugin-mongodb/index.js': endent`
            export default {
              endpointToString: ({ host }) => \`mongodb://\${host}\`,
              sync: () => console.log('synced mongodb'),
            }
          `,
          'ceiling-plugin-mysql/index.js': endent`
            export default {
              endpointToString: ({ host }) => \`mysql://\${host}\`,
              sync: () => console.log('synced mysql'),
            }
          `,
        },
      })

      const childProcess = execa(_require.resolve('./cli.js'), ['push'], {
        all: true,
      })
      await pEvent(childProcess.all, 'data')
      childProcess.stdin.write('y\n')

      const output = await childProcess
      expect(output.all |> stripAnsi).toEqual(endent`
        ? Are you sure you want to …
          - mongodb://mongodb-local.de => mongodb://mongodb-live.de
          - mysql://mysql-local.de => mysql://mysql-live.de
         (y/N) y? Are you sure you want to …
          - mongodb://mongodb-local.de => mongodb://mongodb-live.de
          - mysql://mysql-local.de => mysql://mysql-live.de
         Yes
        mongodb://mongodb-local.de => mongodb://mongodb-live.de …
        synced mongodb
        mysql://mysql-local.de => mysql://mysql-live.de …
        synced mysql
      `)
    },
    'no endpointToString': async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          plugins: ['mysql'],
        }),
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          export default {
            sync: () => {},
          }
        `,
      })

      const output = await execa(_require.resolve('./cli.js'), ['push', '-y'], {
        all: true,
      })
      expect(output.all).toEqual('undefined => undefined …')
    },
    'no plugins': async () => {
      const output = await execa(_require.resolve('./cli.js'), ['push', '-y'], {
        all: true,
      })
      expect(output.all).toEqual('No plugins specified. Doing nothing …')
    },
    'no sync': async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          plugins: ['mysql'],
        }),
        'node_modules/ceiling-plugin-mysql/index.js': 'export default {}',
      })

      const output = await execa(_require.resolve('./cli.js'), ['push', '-y'], {
        all: true,
      })
      expect(output.all).toEqual('undefined => undefined …')
    },
    'two plugins': async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          endpoints: {
            live: {
              mongodb: {
                host: 'mongodb-live.de',
              },
              mysql: {
                host: 'mysql-live.de',
              },
            },
            local: {
              mongodb: {
                host: 'mongodb-local.de',
              },
              mysql: {
                host: 'mysql-local.de',
              },
            },
          },
          plugins: ['mysql', 'mongodb'],
        }),
        node_modules: {
          'ceiling-plugin-mongodb/index.js': endent`
            export default {
              endpointToString: ({ host }) => \`mongodb://\${host}\`,
              sync: (from, to) => {
                console.log(from)
                console.log(to)
              },
            }
          `,
          'ceiling-plugin-mysql/index.js': endent`
            export default {
              endpointToString: ({ host }) => \`mysql://\${host}\`,
              sync: (from, to) => {
                console.log(from)
                console.log(to)
              },
            }
          `,
        },
      })

      const output = await execa(_require.resolve('./cli.js'), ['push', '-y'], {
        all: true,
      })
      expect(output.all).toEqual(endent`
        mysql://mysql-local.de => mysql://mysql-live.de …
        { host: 'mysql-local.de' }
        { host: 'mysql-live.de' }
        mongodb://mongodb-local.de => mongodb://mongodb-live.de …
        { host: 'mongodb-local.de' }
        { host: 'mongodb-live.de' }
      `)
    },
    valid: async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          endpoints: {
            live: {
              mysql: {
                host: 'live.de',
              },
            },
            local: {
              mysql: {
                host: 'local.de',
              },
            },
          },
          plugins: ['mysql'],
        }),
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          export default {
            endpointToString: ({ host }) => \`mysql://\${host}\`,
            sync: (from, to) => {
              console.log(from)
              console.log(to)
            },
          }
        `,
      })

      const output = await execa(_require.resolve('./cli.js'), ['push', '-y'], {
        all: true,
      })
      expect(output.all).toEqual(endent`
        mysql://local.de => mysql://live.de …
        { host: 'local.de' }
        { host: 'live.de' }
      `)
    },
  },
  [testerPluginTmpDir()],
)
