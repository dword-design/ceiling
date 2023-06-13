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
        migrations: {
          'mongodb/1-test.js': endent`
            export default {
              up: ({ host }) => console.log(\`\${host}: mongodb up 1\`),
            }
          `,
          'mysql/1-test.js': endent`
            export default {
              up: ({ host }) => console.log(\`\${host}: mysql up 1\`),
            }
          `,
        },
        node_modules: {
          'ceiling-plugin-mongodb/index.js': endent`
            export default {
              endpointToString: ({ host }) => \`mongodb://\${host}\`,
            }
          `,
          'ceiling-plugin-mysql/index.js': endent`
            export default {
              endpointToString: ({ host }) => \`mysql://\${host}\`,
            }
          `,
        },
      })

      const childProcess = execa(_require.resolve('./cli.js'), ['migrate'], {
        all: true,
      })
      await pEvent(childProcess.all, 'data')
      childProcess.stdin.write('y\n')

      const output = await childProcess
      expect(output.all |> stripAnsi).toEqual(endent`
        ? Are you sure you want to …
        mongodb://mongodb-local.de
          - 1-test
        mysql://mysql-local.de
          - 1-test
         (y/N) y? Are you sure you want to …
        mongodb://mongodb-local.de
          - 1-test
        mysql://mysql-local.de
          - 1-test
         Yes
        Migrating mongodb://mongodb-local.de …
          - 1-test
        mongodb-local.de: mongodb up 1
        Migrating mysql://mysql-local.de …
          - 1-test
        mysql-local.de: mysql up 1
      `)
    },
    'executed migrations': async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          plugins: ['mysql'],
        }),
        'migrations/mysql': {
          '1-test.js': endent`
            export default {
              up: () => console.log('up 1'),
            }
          `,
          '2-test2.js': endent`
            export default {
              up: () => console.log('up 2'),
            }
          `,
        },
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          export default {
            getExecutedMigrations: () => ['1-test'],
          }
        `,
      })

      const output = await execa(
        _require.resolve('./cli.js'),
        ['migrate', '-y'],
        {
          all: true,
        },
      )
      expect(output.all).toEqual(endent`
        Migrating undefined …
          - 2-test2
        up 2
      `)
    },
    'executed migrations set': async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          plugins: ['mysql'],
        }),
        'migrations/mysql': {
          '1-test.js': endent`
            export default {
              up: () => console.log('up 1'),
            }
          `,
        },
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          export default {
            addExecutedMigrations: (endpoint, migrations) => console.log(\`Added executed migrations \${migrations.join(',')}\`),
          }
        `,
      })

      const output = await execa(
        _require.resolve('./cli.js'),
        ['migrate', '-y'],
        {
          all: true,
        },
      )
      expect(output.all).toEqual(endent`
        Migrating undefined …
          - 1-test
        up 1
        Added executed migrations 1-test
      `)
    },
    'no migrations': async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          plugins: ['mysql'],
        }),
        'node_modules/ceiling-plugin-mysql/index.js': 'export default {}',
      })

      const output = await execa(
        _require.resolve('./cli.js'),
        ['migrate', '-y'],
        {
          all: true,
        },
      )
      expect(output.all).toEqual('')
    },
    'no plugins': async () => {
      const output = await execa(
        _require.resolve('./cli.js'),
        ['migrate', '-y'],
        {
          all: true,
        },
      )
      expect(output.all).toEqual('No plugins specified. Doing nothing …')
    },
    'two plugins': async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          endpoints: {
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
        migrations: {
          'mongodb/1-test.js': endent`
            export default {
              up: ({ host }) => console.log(\`\${host}: mongodb up 1\`),
            }
          `,
          'mysql/1-test.js': endent`
            export default {
              up: ({ host }) => console.log(\`\${host}: mysql up 1\`),
            }
          `,
        },
        node_modules: {
          'ceiling-plugin-mongodb/index.js': endent`
            export default {
              endpointToString: ({ host }) => \`mongodb://\${host}\`,
            }
          `,
          'ceiling-plugin-mysql/index.js': endent`
            export default {
              endpointToString: ({ host }) => \`mysql://\${host}\`,
            }
          `,
        },
      })

      const output = await execa(
        _require.resolve('./cli.js'),
        ['migrate', '-y'],
        {
          all: true,
        },
      )
      expect(output.all).toEqual(endent`
        Migrating mongodb://mongodb-local.de …
          - 1-test
        mongodb-local.de: mongodb up 1
        Migrating mysql://mysql-local.de …
          - 1-test
        mysql-local.de: mysql up 1
      `)
    },
    valid: async () => {
      await outputFiles({
        '.ceilingrc.json': JSON.stringify({
          endpoints: {
            local: {
              mysql: {
                host: 'local.de',
              },
            },
          },
          plugins: ['mysql'],
        }),
        'migrations/mysql/1-test.js': endent`
          export default {
            up: ({ host }) => console.log(\`\${host}: up 1\`),
          }
        `,
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          export default {
            endpointToString: ({ host }) => \`mysql://\${host}\`,
          }
        `,
      })

      const output = await execa(
        _require.resolve('./cli.js'),
        ['migrate', '-y'],
        {
          all: true,
        },
      )
      expect(output.all).toEqual(endent`
        Migrating mysql://local.de …
          - 1-test
        local.de: up 1
      `)
    },
  },
  [testerPluginTmpDir()],
)
