import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import TilesField from './components/TilesField'
import PromptSuggestion from './components/PromptSuggestion'
import FormattedCoachText from './components/FormattedCoachText'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import IosLoader from '../../components/IosLoader'

const Feedback = () => {
  const navigate = useNavigate()
  const { analysisId } = useParams()

  const [scrolled, setScrolled] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [chats, setChats] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // scroll effect
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 🔥 MAIN FIX: polling for analysis
  useEffect(() => {
    let cancelled = false
    let retryTimeout = null

    const fetchAnalysis = async () => {
      if (!analysisId) return

      try {
        setError('')
        setLoading(true)

        const aRes = await api.get(`/analysis/record/${analysisId}`)

        if (cancelled) return

        const a = aRes.data.analysis
        setAnalysis(a)
        setSuggestions(a?.promptSuggestions || [])

        // fetch chats AFTER analysis exists
        const cRes = await api.get(`/coach/history/${analysisId}`)
        setChats(cRes.data.chats || [])

        setLoading(false)
      } catch (e) {
        if (cancelled) return

        // 🔥 If analysis not ready yet → retry
        if (e.response?.status === 404) {
          retryTimeout = setTimeout(fetchAnalysis, 2000)
        } else {
          setError(e?.customMessage || 'Failed to load feedback')
          setLoading(false)
        }
      }
    }

    fetchAnalysis()

    return () => {
      cancelled = true
      if (retryTimeout) clearTimeout(retryTimeout)
    }
  }, [analysisId])

  // ask coach
  const askCoach = async (question) => {
    if (!analysisId) return
    try {
      setError('')
      setLoading(true)

      const res = await api.post('/coach/ask', { analysisId, question })
      const chat = res.data.chat

      setChats((prev) => [...prev, chat])

      if (chat?.suggestions?.length) {
        setSuggestions(chat.suggestions)
      }
    } catch (e) {
      setError(e?.customMessage || 'Failed to get coach response')
    } finally {
      setLoading(false)
    }
  }

  const title = analysis?.filename || 'Processing...'
  const createdAt = analysis?.createdAt ? new Date(analysis.createdAt) : null

  const subtitle = createdAt
    ? createdAt.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : ''

  const m = analysis?.rawMetrics || {}

  const num = (v, digits = 1) =>
    v == null || Number.isNaN(Number(v)) ? 'N/A' : Number(v).toFixed(digits)

  const tiles = [
    { label: 'Left knee avg', value: `${num(m.left_knee_angle_avg, 1)}°` },
    { label: 'Right knee avg', value: `${num(m.right_knee_angle_avg, 1)}°` },
    { label: 'Left hip avg', value: `${num(m.left_hip_angle_avg, 1)}°` },
    { label: 'Right hip avg', value: `${num(m.right_hip_angle_avg, 1)}°` },
    // { label: 'Trunk lean avg', value: `${num(m.trunk_lean_avg, 1)}°` },
    { label: 'Symmetry score', value: num(m.knee_symmetry_score, 1) },
    { label: 'Stability score', value: num(m.stability_score, 0) },
  ]

  return (
    <div className="min-h-screen bg-[#F3f3f3] pb-10 lg:bg-[#F3F3F3] lg:p-10">
      {loading && !analysis ? (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-50">
          <IosLoader />
        </div>
      ) : null}

      <div className="lg:bg-white lg:rounded-xl lg:px-5 lg:py-3">
        <div
          className={`sticky lg:static top-0 w-full h-13 p-3 flex items-center border-b ${
            scrolled
              ? 'bg-[#F3F3F380] backdrop-blur-xl border-[#EBEBEB]'
              : 'bg-transparent'
          }`}
        >
          <button
            type="button"
            className="flex items-center gap-1"
            onClick={() => navigate('/dashboard')}
          >
            <ChevronLeft color="#717171" strokeWidth={1.3} />
            <p className="text-[#717171]">Back</p>
          </button>
        </div>

        <div className="flex flex-col ml-5 mt-5 min-w-0">
          <p className="text-2xl text-black font-medium mb-5 ml-1">
            {subtitle ? `${subtitle} - ` : ''}
            {title}
          </p>

          {error && (
            <p className="text-[12px] text-red-500 mb-3 ml-1">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {tiles.map((t) => (
              <TilesField key={t.label} label={t.label} value={t.value} />
            ))}
          </div>

          <div className="mr-6 ml-1 text-black font-medium mt-6 min-w-0">
            <div className="pr-2 min-w-0">
              {analysis
                ? <FormattedCoachText text={analysis.feedback} />
                : 'Analyzing your video... This may take a few seconds.'}
            </div>
          </div>

          <div className="mt-6 mr-6 ml-1 flex flex-col gap-3">
            {(chats || []).map((c) => (
              <div key={c._id} className="flex flex-col gap-4 mb-2">
                
                <div className="flex justify-end mb-1">
                  <div className="max-w-[85%] bg-white border rounded-2xl px-4 py-2 my-8 text-sm">
                    {c.question}
                  </div>
                </div>

                <div className="flex justify-start mt-1">
                  <div className="max-w-[85%] bg-[#F6F6F6] border rounded-2xl px-4 py-3 text-sm min-w-0 break-words">
                    <FormattedCoachText text={c.answer} variant="bubble" />
                  </div>
                </div>

              </div>
            ))}
          </div>

          <div className="sticky bottom-0 z-20 mt-8 mr-6 bg-gradient-to-t from-[#F3F3F3] via-[#F3F3F3]/96 to-transparent pt-6 lg:from-white lg:via-white/96">
            <PromptSuggestion
              suggestions={suggestions}
              disabled={loading || !analysis}
              onAsk={askCoach}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Feedback
