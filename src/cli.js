#!/usr/bin/env node

import { mapValues, omit, values } from '@dword-design/functions'
import makeCli from 'make-cli'

import commands from './commands.js'

makeCli({
  commands:
    commands
    |> mapValues((command, name) => ({
      ...(command |> omit('arguments')),
      handler: async (...args) => {
        try {
          return command.handler(...args) |> await
        } catch (error) {
          console.log(error.message)
          process.exit(1)
        }

        return undefined
      },
      name: `${name}${
        command.arguments === undefined ? '' : ` ${command.arguments}`
      }`,
    }))
    |> values,
})
