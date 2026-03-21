const axios = require('axios');
const Groq = require('groq-sdk');

const CV_SERVICE_URL = process.env.CV_SERVICE_URL || 'http://localhost:8000';

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});


// ─────────────────────────────────────────────────────────
// 1. Call the Python CV microservice
// ─────────────────────────────────────────────────────────
const runPoseAnalysis = async (videoUrl, videoId, userId) => {
  const response = await axios.post(
    `${CV_SERVICE_URL}/analyze`,
    { video_url: videoUrl, video_id: videoId, user_id: userId},
    { timeout: 120000 }
  );

  return response.data;
};

// ─────────────────────────────────────────────────────────
// 2. Build a coaching prompt from the raw metrics
// ─────────────────────────────────────────────────────────
const buildPrompt = (metrics, filename,movement, sport) => {

  const flags =
    metrics.injury_flags && metrics.injury_flags.length > 0
      ? metrics.injury_flags
          .map(
            (f) =>
              `• [${f.severity.toUpperCase()}] ${f.type}: ${f.detail}`
          )
          .join('\n')
      : '• No major flags detected';

  return `
You are an elite sports biomechanics coach reviewing physics-based movement data captured from an athlete's video.

SPORT: ${sport}
MOVEMENT TYPE: ${movement}
VIDEO: ${filename}
DURATION: ${metrics.duration_seconds}s | FRAMES ANALYZED: ${metrics.frames_analyzed} at ${metrics.fps} FPS

JOINT ANGLES
Knee:
Left avg: ${metrics.left_knee_angle_avg ?? 'N/A'}°
Right avg: ${metrics.right_knee_angle_avg ?? 'N/A'}°

Hip:
Left avg: ${metrics.left_hip_angle_avg ?? 'N/A'}°
Right avg: ${metrics.right_hip_angle_avg ?? 'N/A'}°

Elbow:
Left avg: ${metrics.left_elbow_angle_avg ?? 'N/A'}°
Right avg: ${metrics.right_elbow_angle_avg ?? 'N/A'}°

POSTURE
Trunk lean avg: ${metrics.trunk_lean_avg ?? 'N/A'}°
Max trunk lean: ${metrics.trunk_lean_max ?? 'N/A'}°

SCORES
Symmetry score: ${metrics.knee_symmetry_score ?? 'N/A'}
Stability score: ${metrics.stability_score ?? 'N/A'}

DETECTED ISSUES
${flags}

Provide:

1. Overall assessment
2. Top 3 issues with explanation
3. One priority drill
4. Positive findings

Speak directly to the athlete using clear coaching language.
`.trim();
};


// ─────────────────────────────────────────────────────────
// 3. Generate follow-up suggestions
// ─────────────────────────────────────────────────────────
const buildSuggestions = (metrics) => {

  const base = [
    "What warm-up exercises improve my movement pattern?",
    "How should I track these metrics over time?",
    "What does my symmetry score mean for injury risk?"
  ];

  const flagBased = (metrics.injury_flags || [])
    .map((f) => {

      const map = {
        left_knee_valgus: "Show me drills to correct knee valgus",
        right_knee_valgus: "Show me drills to correct knee valgus",
        insufficient_left_knee_flexion: "How can I improve knee flexion depth?",
        insufficient_right_knee_flexion: "How can I improve knee flexion depth?",
        excessive_trunk_lean: "How do I fix excessive trunk lean?",
        asymmetric_movement: "How can I improve left right symmetry?"
      };

      return map[f.type] || null;

    })
    .filter(Boolean);

  return [...new Set([...flagBased, ...base])].slice(0, 4);
};


// ─────────────────────────────────────────────────────────
// 4. Call Groq for coaching feedback
// ─────────────────────────────────────────────────────────
const getLLMFeedback = async (analysis, filename, sport) => {
  const metrics = analysis.metrics;
  const movements = analysis.movements;

  const movement = movements?.[0]?.movement || "general";
  const prompt = buildPrompt(metrics, filename, movement, sport);

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [ 
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.4
  });

  if (!completion || !completion.choices || !completion.choices.length) {
    throw new Error("Groq returned empty response");
  }

  return completion.choices[0].message.content;
};


module.exports = {
  runPoseAnalysis,
  getLLMFeedback,
  buildSuggestions,
};