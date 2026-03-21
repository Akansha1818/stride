import React, { useState } from 'react'
import { Plus, SendHorizontal } from 'lucide-react'

const PromptSuggestion = ({ suggestions = [], disabled = false, onAsk }) => {
  const [text, setText] = useState('')

  const submit = async (question) => {
    const q = (question ?? text).trim()
    if (!q) return
    await onAsk?.(q)
    setText('')
  }

  return (
    <div className='w-full max-w-full rounded-xl bg-[#F3F3F3] flex flex-col border border-[#E3E3E3] lg:bg-white'>
      <div className='flex items-center mx-5 my-3 gap-2 '>
        <img className='h-4 w-4 text-black' src='https://ik.imagekit.io/g2fqofeyv/_3.png' alt='magic wand'></img>
        <p className='text-black text-sm font-medium'>Prompt Suggestion</p>
      </div>

      <div className='flex flex-nowrap overflow-x-auto mx-4 gap-3 mb-3'>
        {(suggestions || []).map((s, idx) => (
          <button
            key={`${s}-${idx}`}
            type="button"
            disabled={disabled}
            onClick={() => submit(s)}
            className='mb-2 border border-[#E2E2E2] lg:bg-white bg-[#F6F6F6] px-3 h-7 rounded-md flex items-center gap-2 disabled:opacity-60'
          >
            <Plus size={12} color="#999999" />
            <p className='text-[#999999] text-[12px] text-nowrap'>{s}</p>
          </button>
        ))}
      </div>

      <div className='mx-4 mb-4 border border-[#E2E2E2] bg-[#F6F6F6] w-[calc(100%-2rem)] h-10 rounded-md flex items-center px-3 gap-2'>
        <img className='h-3 w-3' src='https://ik.imagekit.io/g2fqofeyv/_4.png' alt='search'></img>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder='Ask your coach anything about this sesh...'
          className='bg-transparent outline-none w-full text-[13px] text-[#444]'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => submit()}
          className='text-[#111] disabled:opacity-60'
          aria-label="Send"
        >
          <SendHorizontal size={16} />
        </button>
      </div>
    </div>
  )
}

export default PromptSuggestion
