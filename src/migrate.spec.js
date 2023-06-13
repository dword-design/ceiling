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
            },
          }
        `,
        migrations: {
          'mongodb/1-test.js': endent`
            module.exports = {
              up: ({ host }) => console.log(\`\${host}: mongodb up 1\`),
            }
          `,
          'mysql/1-test.js': endent`
            module.exports = {
              up: ({ host }) => console.log(\`\${host}: mysql up 1\`),
            }
          `,
        },
        node_modules: {
          'ceiling-plugin-mongodb/index.js': endent`
            module.exports = {
              endpointToString: ({ host }) => \`mongodb://\${host}\`,
            }
          `,
          'ceiling-plugin-mysql/index.js': endent`
            module.exports = {
              endpointToString: ({ host }) => \`mysql://\${host}\`,
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
    }),
  'executed migrations': () =>
    withLocalTmpDir(async () => {
      await outputFiles({
        'ceiling.config.js': endent`
          module.exports = {
            plugins: ['mysql'],
          }
        `,
        'migrations/mysql': {
          '1-test.js': endent`
            module.exports = {
              up: () => console.log('up 1'),
            }
          `,
          '2-test2.js': endent`
            module.exports = {
              up: () => console.log('up 2'),
            }
          `,
        },
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          module.exports = {
            getExecutedMigrations: () => ['1-test'],
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
    }),
  'executed migrations set': () =>
    withLocalTmpDir(async () => {
      await outputFiles({
        'ceiling.config.js': endent`
          module.exports = {
            plugins: ['mysql'],
          }
        `,
        'migrations/mysql': {
          '1-test.js': endent`
            module.exports = {
              up: () => console.log('up 1'),
            }
          `,
        },
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          module.exports = {
            addExecutedMigrations: (endpoint, migrations) => console.log(\`Added executed migrations \${migrations.join(',')}\`),
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
    }),
  'no migrations': () =>
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

      const output = await execa(
        _require.resolve('./cli.js'),
        ['migrate', '-y'],
        {
          all: true,
        },
      )
      expect(output.all).toEqual('')
    }),
  'no plugins': () =>
    withLocalTmpDir(async () => {
      const output = await execa(
        _require.resolve('./cli.js'),
        ['migrate', '-y'],
        {
          all: true,
        },
      )
      expect(output.all).toEqual('No plugins specified. Doing nothing …')
    }),
  'two plugins': () =>
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
            },
          }
        `,
        migrations: {
          'mongodb/1-test.js': endent`
            module.exports = {
              up: ({ host }) => console.log(\`\${host}: mongodb up 1\`),
            }
          `,
          'mysql/1-test.js': endent`
            module.exports = {
              up: ({ host }) => console.log(\`\${host}: mysql up 1\`),
            }
          `,
        },
        node_modules: {
          'ceiling-plugin-mongodb/index.js': endent`
            module.exports = {
              endpointToString: ({ host }) => \`mongodb://\${host}\`,
            }
          `,
          'ceiling-plugin-mysql/index.js': endent`
            module.exports = {
              endpointToString: ({ host }) => \`mysql://\${host}\`,
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
            },
          }
        `,
        'migrations/mysql/1-test.js': endent`
          module.exports = {
            up: ({ host }) => console.log(\`\${host}: up 1\`),
          }
        `,
        'node_modules/ceiling-plugin-mysql/index.js': endent`
          module.exports = {
            endpointToString: ({ host }) => \`mysql://\${host}\`,
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
    }),
}
