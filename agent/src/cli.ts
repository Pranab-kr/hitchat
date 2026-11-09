#!/usr/bin/env node
import { Command, CommanderError } from 'commander'
import { randomUUID } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { HitchatError, listRooms, readMessages, sendCode, sendMessage } from './client'
import { type Config, DEFAULT_URL, resolveConfig, writeConfig } from './config'

// A thin shell over the client. It owns no rules: every limit, ban, lock and quota is
// decided by the app. What it does own is three conventions the spec pins down — every
// success prints JSON so it pipes, errors go to stderr and exit 1, usage errors exit 2.

export type CliIo = { out: (s: string) => void; err: (s: string) => void }

// Thrown for "you called me wrong", as opposed to "the server said no".
class UsageError extends Error {}

type SendOptions = {
  codeFile?: string
  lang?: string
  title?: string
  lab?: string
  replyTo?: string
}

function requireConfig(): Config {
  const config = resolveConfig()
  if (!config) {
    throw new UsageError('No config yet. Run `hitchat init --url <url> --new` first.')
  }
  return config
}

function buildProgram(io: CliIo, fetchImpl?: typeof fetch): Command {
  const program = new Command()

  program
    .name('hitchat')
    .description('Post into a hitchat room as an anonymous handle. Everything expires in 8 hours.')
    .exitOverride()
    .configureOutput({ writeOut: io.out, writeErr: io.err })

  program
    .command('init')
    .description('Save the URL and token, after proving both work.')
    .option('--url <url>', `hitchat base URL (default ${DEFAULT_URL})`)
    .option('--token <token>', 'the token to post as (the identity)')
    .option('--new', 'mint a fresh UUID token instead')
    .action(async (options: { url?: string; token?: string; new?: boolean }) => {
      // One-time setup: the URL and the token are written to the config file, so every
      // later command needs neither. --url and HITCHAT_URL override the published site
      // for anyone running their own copy.
      const url = options.url ?? process.env.HITCHAT_URL ?? DEFAULT_URL

      const token = options.new ? randomUUID() : (options.token ?? process.env.HITCHAT_TOKEN)
      if (!token) throw new UsageError('Add --token <token> or --new.')

      const config: Config = { url, token }
      // Prove the pair before writing it. A saved config that 401s is the worst first
      // run there is, because the next command fails somewhere else entirely.
      await listRooms(config, fetchImpl)
      writeConfig(config)
      io.out(`${JSON.stringify({ ok: true })}\n`)
    })

  program
    .command('rooms')
    .description('List every room path.')
    .action(async () => {
      const rooms = await listRooms(requireConfig(), fetchImpl)
      io.out(`${JSON.stringify(rooms)}\n`)
    })

  program
    .command('read')
    .description('Print a room snapshot, oldest first.')
    .argument('<room>', 'room path, e.g. cse/3/2/A')
    .option('--limit <n>', 'how many messages, 1-50 (default 20)')
    .action(async (room: string, options: { limit?: string }) => {
      let limit: number | undefined
      if (options.limit !== undefined) {
        limit = Number(options.limit)
        if (!Number.isInteger(limit)) throw new UsageError('--limit must be a whole number.')
      }

      const messages = await readMessages(requireConfig(), room, limit, fetchImpl)
      io.out(`${JSON.stringify(messages)}\n`)
    })

  program
    .command('send')
    .description('Post text, or a file as code.')
    .argument('<room>', 'room path, e.g. cse/3/2/A')
    .argument('[message]', 'the text to post')
    .option('--code-file <path>', 'post the file at <path> as a code message')
    .option('--lang <lang>', 'language for --code-file')
    .option('--title <title>', 'optional code title')
    .option('--lab <tag>', 'optional lab tag, up to 24 characters')
    .option('--reply-to <id>', 'optional id of a live message in the same room')
    .action(async (room: string, message: string | undefined, options: SendOptions) => {
      const config = requireConfig()

      if (options.codeFile) {
        if (!options.lang) throw new UsageError('--code-file needs --lang <lang>.')

        const code = readFileSync(options.codeFile, 'utf8')
        const sent = await sendCode(
          config,
          {
            room,
            code,
            lang: options.lang,
            title: options.title,
            lab_tag: options.lab,
            reply_to_id: options.replyTo,
          },
          fetchImpl,
        )
        io.out(`${JSON.stringify(sent)}\n`)
        return
      }

      if (!message) throw new UsageError('Add a message, or --code-file <path> --lang <lang>.')

      const sent = await sendMessage(
        config,
        { room, text: message, reply_to_id: options.replyTo },
        fetchImpl,
      )
      io.out(`${JSON.stringify(sent)}\n`)
    })

  return program
}

export async function runCli(
  argv: string[],
  io: CliIo,
  fetchImpl?: typeof fetch,
): Promise<number> {
  const program = buildProgram(io, fetchImpl)

  // Commander would exit 0 in complete silence for a bare `hitchat`, which reads as a
  // successful no-op. Naming the commands is the only useful answer.
  if (argv.length === 0) {
    program.outputHelp()
    return 2
  }

  try {
    await program.parseAsync(argv, { from: 'user' })
    return 0
  } catch (error) {
    if (error instanceof CommanderError) {
      // Commander already wrote the message through configureOutput. --help and
      // --version exit 0; everything it rejects as malformed is a usage error.
      return error.exitCode === 0 ? 0 : 2
    }

    if (error instanceof UsageError) {
      io.err(`${error.message}\n`)
      return 2
    }

    if (error instanceof HitchatError) {
      io.err(`${error.message}\n`)
      return 1
    }

    // A missing --code-file, a permission error, a bug: still one line on stderr.
    io.err(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

// The published bin is this module, so it needs to run itself — but the tests import
// `runCli` from the same file, and an unconditional run would fire on import. Comparing
// the entry path keeps the two apart. `dist/cli.js` resolves here after the build.
function isDirectInvocation(): boolean {
  const entry = process.argv[1]
  if (!entry) return false

  try {
    // npm installs the global bin as a symlink on Linux/macOS, so argv[1] is the shim
    // path while import.meta.url is the real module. Resolve both before comparing, or
    // the guard is false and the CLI exits 0 having done nothing.
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isDirectInvocation()) {
  void runCli(process.argv.slice(2), {
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
  }).then((code) => {
    process.exitCode = code
  })
}
