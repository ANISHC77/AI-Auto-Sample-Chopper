
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';

// Fallback function if AI fails
const linearChop = (duration: number): number[] => {
  console.warn("AI chop generation failed or returned invalid format. Falling back to linear chopping.");
  const chopCount = 8;
  const interval = duration / chopCount;
  return Array.from({ length: chopCount }, (_, i) => i * interval);
};

const getMelodicPrompt = (duration: number): string => {
  return `
  You are an expert sample-based producer with a strong ear for musical structure. Analyze a melodic or instrumental audio sample.

  • The audio is ${duration.toFixed(2)} seconds long.
  • Return 8 musically expressive chop start times as floating-point seconds inside
    a JSON object called "chopStartTimes".

  Musical priorities for selecting chop points:
  1. Beginnings of new melodic phrases.
  2. Noticeable pitch jumps or motif changes.
  3. Breath or pause points in vocals or lead instruments.
  4. Bar starts or strong downbeats that anchor rhythm.
  5. Avoid sections with sustained notes lacking clear attack.
  6. Distribute chops across the full duration so they cover early, middle, and late moments.

  Hard rules:
  • The first chop must always be 0.
  • Provide exactly 8 numbers, strictly sorted in ascending order.
  • All times must be >= 0 and <= total duration.
  • Only reply with the JSON object. No text outside JSON.
  `;
};

export const getMelodicChopPoints = async (duration: number): Promise<number[]> => {
  
  const ai = new GoogleGenAI({ apiKey: ""});
  const prompt = getMelodicPrompt(duration);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { role: 'user', parts: [{ text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chopStartTimes: {
              type: Type.ARRAY,
              description: 'An array of 8 floating-point numbers representing the start time in seconds for each chop.',
              items: {
                type: Type.NUMBER,
              },
            },
          },
          required: ['chopStartTimes'],
        },
      },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);

    if (result.chopStartTimes && Array.isArray(result.chopStartTimes) && result.chopStartTimes.length === 8) {
      const chops = (result.chopStartTimes as number[]).map(t => Math.max(0, t)).sort((a, b) => a - b);
      chops[0] = 0; // Ensure the first chop is always at the beginning.
      // Ensure no chop time exceeds the duration
      return chops.map(t => Math.min(t, duration));
    } else {
      console.error("AI response was not in the expected format:", result);
      return linearChop(duration);
    }
  } catch (error) {
    console.error("Error calling Gemini API for chopping:", error);
    return linearChop(duration);
  }
};
