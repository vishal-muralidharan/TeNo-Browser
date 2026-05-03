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
  onHeightChange,
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
  const shellRef = useRef(null)
  const outputRef = useRef(null)
  const inputRef = useRef(null)
  const lineIdRef = useRef(1)
  const matrixIntervalRef = useRef(null)
  const userLabel = (user?.displayName || user?.email?.split('@')[0] || 'user')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  const terminalPrompt = `teno/${userLabel} $_ >>`

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleTerminalPointerDown = (event) => {
    if (event.target === inputRef.current) return
    focusInput()
  }

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

  useEffect(() => {
    if (!shellRef.current || !onHeightChange) return undefined

    const emitHeight = () => {
      const height = shellRef.current?.getBoundingClientRect?.().height
      if (height) {
        onHeightChange(Math.round(height))
      }
    }

    emitHeight()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => emitHeight())
      observer.observe(shellRef.current)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', emitHeight)
    return () => window.removeEventListener('resize', emitHeight)
  }, [onHeightChange])

  const pushOutputLine = (text) => {
    setOutputLines((current) => [...current, { id: lineIdRef.current++, kind: 'output', text }])
  }

  const pushCommandLine = (text) => {
    setOutputLines((current) => [...current, { id: lineIdRef.current++, kind: 'command', text }])
  }

  const getCommandPrefix = () => terminalPrompt

  const pushBlock = (text) => {
    String(text)
      .split('\n')
      .forEach((line) => pushOutputLine(line))
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
      pushOutputLine('usage: help [general|ln|ct|rm|tm]')
      return
    }

    if (normalized === 'general') {
      pushOutputLine('general commands:')
      HELP_GROUPS.general.forEach((item) => pushOutputLine(`- ${item}`))
      return
    }

    if (HELP_GROUPS[normalized]) {
      pushOutputLine(`${normalized} commands:`)
      HELP_GROUPS[normalized].forEach((item) => pushOutputLine(`- ${item}`))
      return
    }

    pushOutputLine(`help section not found: ${groupName}`)
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
        pushOutputLine('help sections:')
        pushOutputLine('- general')
        pushOutputLine('- ln')
        pushOutputLine('- ct')
        pushOutputLine('- rm')
        pushOutputLine('- tm')
        pushOutputLine("type help [section] for more detail.")
        return
      }

      renderHelpGroup(arg)
      return
    }

    if (command === 'history') {
      if (commandHistory.length === 0) {
        pushOutputLine('no history yet.')
        return
      }

      commandHistory.forEach((item, index) => pushOutputLine(`${index + 1}. ${item}`))
      return
    }

    if (command === 'date') {
      pushOutputLine(new Date().toISOString())
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
        pushOutputLine(`switched to ${arg}.`)
      } else {
        pushOutputLine(`unknown destination: ${arg}`)
      }
      return
    }

    if (command === 'ln') {
      const subcommand = tokens[1] || ''
      const value = tokens.slice(2).join(' ')

      if (subcommand === 'ls') {
        if (savedLinks.length === 0) {
          pushOutputLine('no saved links.')
          return
        }

        savedLinks.forEach((item) => {
          pushOutputLine(`- ${item.nickname || 'untitled'}: ${item.url || ''}`)
        })
        return
      }

      if (subcommand === 'new') {
        navigateTo('links')
        requestOpenLinksForm?.()
        pushOutputLine('links form opened.')
        return
      }

      if (subcommand === 'drop') {
        const result = await deleteLinkByNickname?.(value)
        pushOutputLine(result?.message || `link not found: ${value}`)
        return
      }

      if (subcommand === 'roulette') {
        if (savedLinks.length === 0) {
          pushOutputLine('no saved links to roulette.')
          return
        }

        const chosenLink = savedLinks[Math.floor(Math.random() * savedLinks.length)]
        window.open(chosenLink.url, '_blank', 'noopener,noreferrer')
        pushOutputLine(`opening ${chosenLink.nickname || chosenLink.url}.`)
        return
      }
    }

    if (command === 'ct') {
      const subcommand = tokens[1] || ''
      const value = tokens.slice(2).join(' ')

      if (subcommand === 'ls') {
        if (cartItems.length === 0) {
          pushOutputLine('cart is empty.')
          return
        }

        cartItems.forEach((item) => {
          pushOutputLine(`- ${item.title || item.nickname || 'untitled'}: ${item.url || ''}`)
        })
        return
      }

      if (subcommand === 'new') {
        navigateTo('cart')
        requestOpenCartForm?.()
        pushOutputLine('cart form opened.')
        return
      }

      if (subcommand === 'drop') {
        const result = await deleteCartItemByNickname?.(value)
        pushOutputLine(result?.message || `cart item not found: ${value}`)
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
          pushOutputLine('no active reminders.')
          return
        }

        reminders.forEach((item, index) => {
          pushOutputLine(`[${index}] ${item.text || 'untitled'}`)
        })
        return
      }

      if (subcommand === 'add') {
        const result = await addReminder?.(value)
        pushOutputLine(result?.message || 'reminder added.')
        return
      }

      if (subcommand === 'done') {
        const index = Number.parseInt(value, 10)
        const result = await deleteReminderByIndex?.(index)
        pushOutputLine(result?.message || `reminder ${index} completed.`)
        return
      }

      if (subcommand === 'nuke') {
        const result = await deleteAllReminders?.()
        pushOutputLine(result?.message || '\\o/ BOOM')
        return
      }
    }

    if (command === 'tm') {
      const subcommand = tokens[1] || ''
      const value = tokens[2]

      if (subcommand === 'start') {
        const result = timerApi?.startTimerCountdown?.(value)
        pushOutputLine(result?.message || 'timer started.')
        return
      }

      if (subcommand === 'stop') {
        const result = timerApi?.stopTimer?.()
        pushOutputLine(result?.message || 'timer stopped.')
        return
      }

      if (subcommand === 'status') {
        pushOutputLine(timerApi?.getTimerStatus?.() || `time remaining: ${formatTimerMs(timerApi?.timerDisplayMs || 0)}`)
        return
      }

      if (subcommand === 'hack') {
        timerApi?.startTimerCountdown?.(1)
        pushOutputLine(`root@system: ${randomHex(8)}::${randomBinary(8)}`)
        pushOutputLine(`decoding payload ${randomHex(6)}`)
        pushOutputLine(`packet stream ${randomBinary(16)}`)
        return
      }
    }

    if (command === 'sudo') {
      pushOutputLine('user is not in the sudoers file. this incident will be reported.')
      return
    }

    if (command === 'ping') {
      pushOutputLine(`reply from ${arg || 'input'}: bytes=32 time=14ms ttl=117.`)
      return
    }

    if (command === 'matrix') {
      clearMatrix()
      pushOutputLine('opening matrix stream...')
      let linesPushed = 0
      matrixIntervalRef.current = setInterval(() => {
        pushOutputLine(randomBinary(42))
        linesPushed += 1
        if (linesPushed >= 10) {
          clearMatrix()
        }
      }, 55)
      return
    }

    if (command === 'coffee') {
      pushOutputLine("error 418: i'm a teapot.")
      return
    }

    pushOutputLine(`command not found: ${trimmed}. type 'help' for available commands.`)
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

    pushCommandLine(rawInput)
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
    <section ref={shellRef} className="terminal-shell" aria-label="global terminal" onPointerDownCapture={handleTerminalPointerDown} onClick={(event) => event.stopPropagation()}>
      <div className="terminal-header">
        <span className="terminal-title">terminal</span>
        <button type="button" className="terminal-minimize" onClick={onExit}>hide</button>
      </div>

      <form className="terminal-input-row" onSubmit={handleSubmit}>
        <span className="terminal-prompt">{terminalPrompt}</span>
        <div className="typing-caret-field terminal-input-field" data-empty={!input}>
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
        </div>
      </form>

      <div className="terminal-output" ref={outputRef}>
        {outputLines.map((line) => (
          <div key={line.id} className={`terminal-line ${line.kind === 'command' ? 'terminal-command-line' : 'terminal-output-line'}`}>
            {line.kind === 'command' ? (
              <>
                <span className="terminal-command-prefix">{getCommandPrefix()}</span>
                <span className="terminal-command-text"> {line.text}</span>
              </>
            ) : (
              line.text
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
