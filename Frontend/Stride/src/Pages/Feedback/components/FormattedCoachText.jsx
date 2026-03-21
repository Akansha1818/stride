import React from 'react'

const NUMBERED_ITEM_REGEX = /^(\d+)\.\s+(.+?):\s*(.+)$/
const BULLET_ITEM_REGEX = /^[-*]\s+(.+)$/

const normalizeLine = (line) =>
  line
    .replace(/\*\*/g, '')
    .replace(/\u00c2/g, '')
    .trim()

// convert "OVERALL ASSESSMENT" -> "Overall assessment"
const toSentenceCase = (text) => {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

const buildBlocks = (text) => {
  if (!text) return []

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(normalizeLine)

  const blocks = []
  let paragraphLines = []

  const flushParagraph = () => {
    if (!paragraphLines.length) return
    blocks.push({
      type: 'paragraph',
      content: paragraphLines.join(' '),
    })
    paragraphLines = []
  }

  for (const line of lines) {
    if (!line) {
      flushParagraph()
      continue
    }

    const headingMatch = line.match(/^(.+):$/)
    const numberedItemMatch = line.match(NUMBERED_ITEM_REGEX)
    const bulletItemMatch = line.match(BULLET_ITEM_REGEX)

    if (numberedItemMatch) {
      flushParagraph()
      blocks.push({
        type: 'numbered-item',
        number: numberedItemMatch[1],
        title: numberedItemMatch[2],
        content: numberedItemMatch[3],
      })
      continue
    }

    if (bulletItemMatch) {
      flushParagraph()
      blocks.push({
        type: 'bullet-item',
        content: bulletItemMatch[1],
      })
      continue
    }

    if (headingMatch) {
      flushParagraph()
      blocks.push({
        type: 'heading',
        content: (headingMatch?.[1] || line).replace(/:$/, ''),
      })
      continue
    }

    paragraphLines.push(line)
  }

  flushParagraph()
  return blocks
}

const FormattedCoachText = ({ text, variant = 'panel' }) => {
  const blocks = buildBlocks(text)

  if (!blocks.length) {
    return null
  }

  const itemClassName =
    variant === 'bubble'
      ? 'rounded-xl bg-white/70 px-3 py-3'
      : 'rounded-2xl border border-[#ECECEC] bg-white px-4 py-4'

  return (
    <div className="space-y-4 text-[15px] leading-7 text-[#171717]">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <div key={`${block.type}-${index}`} className="pt-2">
              <p className="text-[17px] font-semibold text-black mt-4 mb-2">
                {toSentenceCase(block.content)}
              </p>
            </div>
          )
        }
        if (block.type === 'numbered-item') {
          return (
            <div key={`${block.type}-${index}`} className={itemClassName}>
              <p>
                <span className="font-semibold text-black">
                  {block.number}. {block.title}:
                </span>{' '}
                {block.content}
              </p>
            </div>
          )
        }

        if (block.type === 'bullet-item') {
          return (
            <div key={`${block.type}-${index}`} className="flex gap-3">
              <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-black/70" />
              <p className="flex-1">{block.content}</p>
            </div>
          )
        }

        return <p key={`${block.type}-${index}`}>{block.content}</p>
      })}
    </div>
  )
}

export default FormattedCoachText