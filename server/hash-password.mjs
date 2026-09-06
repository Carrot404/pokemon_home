import { createPasswordHash } from './server.mjs'

function readHiddenPassword(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('请在交互式终端中运行此命令')
  }

  return new Promise((resolve, reject) => {
    let value = ''
    const input = process.stdin
    const output = process.stdout

    function finish(error) {
      input.off('data', onData)
      input.setRawMode(false)
      input.pause()
      output.write('\n')
      if (error) reject(error)
      else resolve(value)
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === '\u0003') {
          finish(new Error('已取消'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          if (value) {
            value = value.slice(0, -1)
            output.write('\b \b')
          }
          continue
        }
        if (character >= ' ' && value.length < 256) {
          value += character
          output.write('*')
        }
      }
    }

    output.write(prompt)
    input.setRawMode(true)
    input.setEncoding('utf8')
    input.resume()
    input.on('data', onData)
  })
}

try {
  const password = await readHiddenPassword('输入同步密码（至少 12 个字符）：')
  const confirmation = await readHiddenPassword('再次输入同步密码：')
  if (password !== confirmation) throw new Error('两次输入的密码不一致')

  const passwordHash = await createPasswordHash(password)
  console.log(`SYNC_PASSWORD_HASH=${passwordHash}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
