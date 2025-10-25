
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
    You are an expert sample-based producer, like Madlib or The Alchemist, with a deep understanding of music theory. You are analyzing a melodic or instrumental sample.
    The audio sample is ${duration.toFixed(2)} seconds long.
    Your goal is to find the 8 most musically compelling points to chop this sample for creating new melodies.
    Focus on chopping at the beginning of new melodic phrases, significant chord changes, or impactful notes that can be re-pitched and re-sequenced. The chops should provide a versatile palette of sounds.
    - The first chop must start at 0.
    - The final array must contain exactly 8 floating-point numbers, sorted in ascending order.
    - Do not include any explanation, just the JSON object.
  `;
};

export const getMelodicChopPoints = async (duration: number): Promise<number[]> => {
  if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set. Using fallback linear chopping.");
    return linearChop(duration);
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });
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
