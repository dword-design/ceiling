import { mapValues, values } from '@dword-design/functions'

import commands from './commands.js'

export default commands |> mapValues('action') |> values
