const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const askCoachLLM = async (analysis, question) => {

  const metrics = analysis.rawMetrics;

  const prompt = `
You are an elite biomechanics coach.

ATHLETE SESSION DATA

Knee avg: ${metrics.left_knee_angle_avg} / ${metrics.right_knee_angle_avg}
Hip avg: ${metrics.left_hip_angle_avg} / ${metrics.right_hip_angle_avg}
Trunk lean avg: ${metrics.trunk_lean_avg}
Stability score: ${metrics.stability_score}
Symmetry score: ${metrics.knee_symmetry_score}

Athlete question:
${question}

Give a clear coaching explanation.
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4
  });

  return completion.choices[0].message.content;
};

const generateFollowups = async (answer) => {

  const prompt = `
Based on this coaching answer, generate 4 short follow-up questions the athlete might ask.

Answer:
${answer}

Return only questions.
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5
  });

  const text = completion.choices[0].message.content;

  return text.split("\n").filter(q => q.trim().length > 0).slice(0,4);
};

module.exports = {
  askCoachLLM,
  generateFollowups
};