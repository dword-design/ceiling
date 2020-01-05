import { spawn } from 'child-process-promise'
import withLocalTmpDir from 'with-local-tmp-dir'
import expect from 'expect'
import outputFiles from 'output-files'
import { endent } from '@dword-design/functions'

export default () => withLocalTmpDir(__dirname, async () => {
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
      'ceiling-plugin-mysql/index.js': endent`
        module.exports = {
          endpointToString: ({ host }) => \`mysql://\${host}\`,
          sync: (from, to) => {
            console.log(from)
            console.log(to)
          },
        }
      `,
      'ceiling-plugin-mongodb/index.js': endent`
        module.exports = {
          endpointToString: ({ host }) => \`mongodb://\${host}\`,
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
  const { stdout } = await spawn('ceiling', ['push', '-y'], { capture: ['stdout'] })
  expect(stdout).toEqual(endent`
    mysql://mysql-local.de => mysql://mysql-live.de …
    { host: 'mysql-local.de' }
    { host: 'mysql-live.de' }
    mongodb://mongodb-local.de => mongodb://mongodb-live.de …
    { host: 'mongodb-local.de' }
    { host: 'mongodb-live.de' }

  `)
})