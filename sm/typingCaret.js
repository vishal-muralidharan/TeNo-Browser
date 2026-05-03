const WRAPPER_SELECTOR = '.typing-caret-field'
const ACTIVE_CLASS = 'typing-caret-field--show-caret'
const MIRROR_CLASS = 'typing-caret-field__mirror'

const STYLE_PROPERTIES = [
  'boxSizing',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'textIndent',
  'textTransform',
  'width',
  'wordSpacing',
  'whiteSpace',
]

function getCaretIndex(field) {
  try {
    if (typeof field.selectionStart === 'number') {
      return field.selectionStart
    }
  } catch (_error) {
    // Some input types (for example number) can reject selection access.
  }

  return field.value.length
}

function getMirror(wrapper) {
  let mirror = wrapper.querySelector(`.${MIRROR_CLASS}`)

  if (!mirror) {
    mirror = document.createElement('div')
    mirror.className = MIRROR_CLASS
    wrapper.appendChild(mirror)
  }

  return mirror
}

function syncMirrorStyle(field, mirror) {
  const computed = window.getComputedStyle(field)

  STYLE_PROPERTIES.forEach((property) => {
    mirror.style[property] = computed[property]
  })

  mirror.style.position = 'absolute'
  mirror.style.inset = '0'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.overflow = 'hidden'
  mirror.style.color = computed.color
  mirror.style.border = computed.border
  mirror.style.borderRadius = computed.borderRadius
  mirror.style.height = field.clientHeight ? `${field.clientHeight}px` : 'auto'
  mirror.style.width = field.clientWidth ? `${field.clientWidth}px` : '100%'
  mirror.style.maxWidth = '100%'
}

function measureCaretPosition(field, wrapper, mirror) {
  const caretIndex = getCaretIndex(field)
  const isTextarea = field.tagName === 'TEXTAREA'
  const textBeforeCaret = field.value.slice(0, caretIndex)
  const displayText = textBeforeCaret.replace(/ /g, '\u00a0')

  mirror.textContent = ''

  const textNode = document.createElement('span')
  textNode.textContent = displayText

  const caretMarker = document.createElement('span')
  caretMarker.textContent = '_'

  if (isTextarea) {
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordBreak = 'break-word'
    mirror.style.overflowWrap = 'break-word'
  } else {
    mirror.style.whiteSpace = 'pre'
    mirror.style.wordBreak = 'normal'
    mirror.style.overflowWrap = 'normal'
  }

  mirror.append(textNode, caretMarker)

  const mirrorRect = mirror.getBoundingClientRect()
  const markerRect = caretMarker.getBoundingClientRect()

  const left = markerRect.left - mirrorRect.left - field.scrollLeft
  const top = markerRect.top - mirrorRect.top - (field.scrollTop || 0)

  wrapper.style.setProperty('--typing-caret-left', `${Math.max(0, left)}px`)
  wrapper.style.setProperty('--typing-caret-top', `${Math.max(0, top)}px`)
}

function updateActiveCaret() {
  const activeElement = document.activeElement

  document.querySelectorAll(WRAPPER_SELECTOR).forEach((wrapper) => {
    wrapper.classList.remove(ACTIVE_CLASS)
  })

  if (!activeElement || !(activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)) {
    return
  }

  const wrapper = activeElement.closest(WRAPPER_SELECTOR)
  if (!wrapper) {
    return
  }

  const mirror = getMirror(wrapper)
  syncMirrorStyle(activeElement, mirror)
  measureCaretPosition(activeElement, wrapper, mirror)
  wrapper.classList.add(ACTIVE_CLASS)
}

export function setupTypingCaret() {
  const events = ['focusin', 'click', 'keyup', 'input', 'selectionchange', 'scroll', 'resize']
  const handler = () => requestAnimationFrame(updateActiveCaret)

  events.forEach((eventName) => {
    const target = eventName === 'resize' ? window : document
    target.addEventListener(eventName, handler, true)
  })

  updateActiveCaret()

  return () => {
    events.forEach((eventName) => {
      const target = eventName === 'resize' ? window : document
      target.removeEventListener(eventName, handler, true)
    })

    document.querySelectorAll(`.${MIRROR_CLASS}`).forEach((mirror) => mirror.remove())
    document.querySelectorAll(WRAPPER_SELECTOR).forEach((wrapper) => {
      wrapper.classList.remove(ACTIVE_CLASS)
      wrapper.style.removeProperty('--typing-caret-left')
      wrapper.style.removeProperty('--typing-caret-top')
    })
  }
}