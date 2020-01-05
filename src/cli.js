#!/usr/bin/env node

import makeCli from 'make-cli'
import commands from './commands'
import { omit, mapValues, values } from '@dword-design/functions'

makeCli({
  commands: commands
    |> mapValues((command, name) => ({
      ...command |> omit('arguments'),
      name: `${name}${command.arguments !== undefined ? ` ${command.arguments}` : ''}`,
      handler: async (...args) => {
        try {
          return command.handler(...args) |> await
        } catch (error) {
          console.log(error.message)
          process.exit(1)
        }
      },
    }))
    |> values,
})
