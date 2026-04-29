import React, { useEffect, useRef, useState } from 'react'

const TAB_INDEX = {
  links: 0,
  cart: 1,
  reminders: 2,
  timer: 3,
}

const HELP_GROUPS = {
  general: ['help', 'history', 'date', 'exit', 'hide', 'clear', 'cd links/cart/reminders/timer'],
  ln: ['ls', 'new', 'drop [nickname]', 'roulette'],
  ct: ['ls', 'new', 'drop [nickname]', 'checkout'],
  rm: ['ls', 'add [text]', 'done [index]', 'nuke'],
  tm: ['start [minutes]', 'stop', 'status', 'hack'],
}

const formatTimerMs = (ms) => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hundredths = Math.floor((Math.max(0, ms) % 1000) / 10)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`
}

const normalizeText = (value) => (value || '').trim().toLowerCase()

const randomHex = (length) => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
const randomBinary = (length) => Array.from({ length }, () => (Math.random() > 0.5 ? '1' : '0')).join('')

export default function Terminal({
  user,
  activeTab,
  setActiveTab,
  onExit,
  savedLinks = [],
  cartItems = [],
  reminders = [],
  requestOpenLinksForm,
  requestOpenCartForm,
  deleteLinkByNickname,
  deleteCartItemByNickname,
  addReminder,
  deleteReminderByIndex,
  deleteAllReminders,
  timerApi,
}) {
  const [input, setInput] = useState('')
  const [outputLines, setOutputLines] = useState([
    { id: 0, text: 'terminal ready. type help for commands.' },
  ])
  const [commandHistory, setCommandHistory] = useState([])
  const [historyCursor, setHistoryCursor] = useState(null)
  const outputRef = useRef(null)
  const inputRef = useRef(null)
  const lineIdRef = useRef(1)
  const matrixIntervalRef = useRef(null)
  const userLabel = (user?.displayName || user?.email || 'user').toLowerCase()

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [outputLines])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (matrixIntervalRef.current) {
        clearInterval(matrixIntervalRef.current)
      }
    }
  }, [])

  const pushLine = (text) => {
    setOutputLines((current) => [...current, { id: lineIdRef.current++, text }])
  }

  const pushBlock = (text) => {
    String(text)
      .split('\n')
      .forEach((line) => pushLine(line))
  }

  const clearMatrix = () => {
    if (matrixIntervalRef.current) {
      clearInterval(matrixIntervalRef.current)
      matrixIntervalRef.current = null
    }
  }

  const clearOutput = () => {
    clearMatrix()
    setOutputLines([])
  }

  const renderHelpGroup = (groupName) => {
    const normalized = normalizeText(groupName)
    if (normalized === 'help') {
      pushLine('usage: help [general|ln|ct|rm|tm]')
      return
    }

    if (normalized === 'general') {
      pushLine('general commands:')
      HELP_GROUPS.general.forEach((item) => pushLine(`- ${item}`))
      return
    }

    if (HELP_GROUPS[normalized]) {
      pushLine(`${normalized} commands:`)
      HELP_GROUPS[normalized].forEach((item) => pushLine(`- ${item}`))
      return
    }

    pushLine(`help section not found: ${groupName}`)
  }

  const logReceipt = () => {
    const width = 27
    const lines = [
      `+${'-'.repeat(width)}+`,
      `| checkout receipt${' '.repeat(width - ' checkout receipt'.length + 1)}|`,
      `+${'-'.repeat(width)}+`,
    ]

    if (cartItems.length === 0) {
      lines.push(`| cart is empty.${' '.repeat(width - ' cart is empty.'.length + 1)}|`)
    } else {
      cartItems.forEach((item, index) => {
        const label = item.title || item.nickname || item.url || 'untitled'
        const content = `${String(index + 1).padStart(2, '0')}. ${label}`
        lines.push(`| ${content.slice(0, width - 2).padEnd(width - 1, ' ')}|`)
      })
    }

    lines.push(`+${'-'.repeat(width)}+`)
    pushBlock(lines.join('\n'))
  }

  const navigateTo = (tabName) => {
    setActiveTab(TAB_INDEX[tabName])
  }

  const executeCommand = async (rawInput) => {
    const trimmed = rawInput.trim()
    const tokens = trimmed.split(/\s+/)
    const command = tokens[0] || ''
    const arg = tokens.slice(1).join(' ')

    if (command === 'help') {
      if (!arg) {
        pushLine('help sections:')
        pushLine('- general')
        pushLine('- ln')
        pushLine('- ct')
        pushLine('- rm')
        pushLine('- tm')
        pushLine("type help [section] for more detail.")
        return
      }

      renderHelpGroup(arg)
      return
    }

    if (command === 'history') {
      if (commandHistory.length === 0) {
        pushLine('no history yet.')
        return
      }

      commandHistory.forEach((item, index) => pushLine(`${index}: ${item}`))
      return
    }

    if (command === 'date') {
      pushLine(new Date().toISOString())
      return
    }

    if (command === 'exit') {
      clearMatrix()
      onExit()
      return
    }

    if (command === 'hide') {
      clearMatrix()
      onExit()
      return
    }

    if (command === 'clear') {
      clearOutput()
      return
    }

    if (command === 'cd') {
      if (['links', 'cart', 'reminders', 'timer'].includes(arg)) {
        navigateTo(arg)
        pushLine(`switched to ${arg}.`)
      } else {
        pushLine(`unknown destination: ${arg}`)
      }
      return
    }

    if (command === 'ln') {
      const subcommand = tokens[1] || ''
      const value = tokens.slice(2).join(' ')

      if (subcommand === 'ls') {
        if (savedLinks.length === 0) {
          pushLine('no saved links.')
          return
        }

        savedLinks.forEach((item) => {
          pushLine(`- ${item.nickname || 'untitled'}: ${item.url || ''}`)
        })
        return
      }

      if (subcommand === 'new') {
        navigateTo('links')
        requestOpenLinksForm?.()
        pushLine('links form opened.')
        return
      }

      if (subcommand === 'drop') {
        const result = await deleteLinkByNickname?.(value)
        pushLine(result?.message || `link not found: ${value}`)
        return
      }

      if (subcommand === 'roulette') {
        if (savedLinks.length === 0) {
          pushLine('no saved links to roulette.')
          return
        }

        const chosenLink = savedLinks[Math.floor(Math.random() * savedLinks.length)]
        window.open(chosenLink.url, '_blank', 'noopener,noreferrer')
        pushLine(`opening ${chosenLink.nickname || chosenLink.url}.`)
        return
      }
    }

    if (command === 'ct') {
      const subcommand = tokens[1] || ''
      const value = tokens.slice(2).join(' ')

      if (subcommand === 'ls') {
        if (cartItems.length === 0) {
          pushLine('cart is empty.')
          return
        }

        cartItems.forEach((item) => {
          pushLine(`- ${item.title || item.nickname || 'untitled'}: ${item.url || ''}`)
        })
        return
      }

      if (subcommand === 'new') {
        navigateTo('cart')
        requestOpenCartForm?.()
        pushLine('cart form opened.')
        return
      }

      if (subcommand === 'drop') {
        const result = await deleteCartItemByNickname?.(value)
        pushLine(result?.message || `cart item not found: ${value}`)
        return
      }

      if (subcommand === 'checkout') {
        logReceipt()
        return
      }
    }

    if (command === 'rm') {
      const subcommand = tokens[1] || ''
      const value = tokens.slice(2).join(' ')

      if (subcommand === 'ls') {
        if (reminders.length === 0) {
          pushLine('no active reminders.')
          return
        }

        reminders.forEach((item, index) => {
          pushLine(`[${index}] ${item.text || 'untitled'}`)
        })
        return
      }

      if (subcommand === 'add') {
        const result = await addReminder?.(value)
        pushLine(result?.message || 'reminder added.')
        return
      }

      if (subcommand === 'done') {
        const index = Number.parseInt(value, 10)
        const result = await deleteReminderByIndex?.(index)
        pushLine(result?.message || `reminder ${index} completed.`)
        return
      }

      if (subcommand === 'nuke') {
        const result = await deleteAllReminders?.()
        pushLine(result?.message || '\\o/ BOOM')
        return
      }
    }

    if (command === 'tm') {
      const subcommand = tokens[1] || ''
      const value = tokens[2]

      if (subcommand === 'start') {
        const result = timerApi?.startTimerCountdown?.(value)
        pushLine(result?.message || 'timer started.')
        return
      }

      if (subcommand === 'stop') {
        const result = timerApi?.stopTimer?.()
        pushLine(result?.message || 'timer stopped.')
        return
      }

      if (subcommand === 'status') {
        pushLine(timerApi?.getTimerStatus?.() || `time remaining: ${formatTimerMs(timerApi?.timerDisplayMs || 0)}`)
        return
      }

      if (subcommand === 'hack') {
        timerApi?.startTimerCountdown?.(1)
        pushLine(`root@system: ${randomHex(8)}::${randomBinary(8)}`)
        pushLine(`decoding payload ${randomHex(6)}`)
        pushLine(`packet stream ${randomBinary(16)}`)
        return
      }
    }

    if (command === 'sudo') {
      pushLine('user is not in the sudoers file. this incident will be reported.')
      return
    }

    if (command === 'ping') {
      pushLine(`reply from ${arg || 'input'}: bytes=32 time=14ms ttl=117.`)
      return
    }

    if (command === 'matrix') {
      clearMatrix()
      pushLine('opening matrix stream...')
      let linesPushed = 0
      matrixIntervalRef.current = setInterval(() => {
        pushLine(randomBinary(42))
        linesPushed += 1
        if (linesPushed >= 10) {
          clearMatrix()
        }
      }, 55)
      return
    }

    if (command === 'coffee') {
      pushLine("error 418: i'm a teapot.")
      return
    }

    pushLine(`command not found: ${trimmed}. type 'help' for available commands.`)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const rawInput = input.trim().toLowerCase()
    if (!rawInput) return

    if (rawInput === 'clear') {
      setCommandHistory((current) => [...current, rawInput])
      setHistoryCursor(null)
      setInput('')
      await executeCommand(rawInput)
      return
    }

    setOutputLines((current) => [...current, { id: lineIdRef.current++, text: `$_ ${rawInput}` }])
    await executeCommand(rawInput)
    setCommandHistory((current) => [...current, rawInput])
    setHistoryCursor(null)
    setInput('')
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (commandHistory.length === 0) return

      const nextIndex = historyCursor === null ? commandHistory.length - 1 : Math.max(historyCursor - 1, 0)
      setHistoryCursor(nextIndex)
      setInput(commandHistory[nextIndex] || '')
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (historyCursor === null) return

      const nextIndex = historyCursor + 1
      if (nextIndex >= commandHistory.length) {
        setHistoryCursor(null)
        setInput('')
        return
      }

      setHistoryCursor(nextIndex)
      setInput(commandHistory[nextIndex] || '')
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      handleSubmit(event)
    }
  }

  return (
    <section className="terminal-shell" aria-label="global terminal">
      <div className="terminal-header">
        <span className="terminal-title">terminal</span>
        <button type="button" className="terminal-minimize" onClick={onExit}>hide</button>
      </div>

      <form className="terminal-input-row" onSubmit={handleSubmit}>
        <span className="terminal-prompt">&lt;{userLabel}&gt; $_ &gt;&gt;</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setHistoryCursor(null)
          }}
          onKeyDown={handleKeyDown}
          spellCheck="false"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </form>

      <div className="terminal-output" ref={outputRef}>
        {outputLines.map((line) => (
          <div key={line.id} className="terminal-line">
            {line.text}
          </div>
        ))}
      </div>
    </section>
  )
}
