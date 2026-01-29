
import { GoogleGenAI, Type } from "@google/genai";

// Gemini API를 사용하여 이미지 검색 결과를 가져옵니다.
export const searchImages = async (query) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Find 10 high-quality direct image URLs for the search query: "${query}". 
    The images should be publicly accessible and suitable for a Notion database cover.
    Provide the results in a structured JSON format.`,
    config: {
      tools: [{ googleSearch: {} }],
      // googleSearch 사용 시 responseMimeType: "application/json"을 사용하여 구조화된 데이터를 요청합니다.
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          images: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Short descriptive title of the image" },
                url: { type: Type.STRING, description: "Direct URL to the image file (jpg, png, etc)" },
                source: { type: Type.STRING, description: "Source website URL" }
              },
              required: ["title", "url"]
            }
          }
        },
        required: ["images"]
      }
    }
  });

  try {
    let jsonStr = response.text || '';
    // 마크다운 코드 블록 제거 로직 추가
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
    }
    
    const result = JSON.parse(jsonStr);
    return {
      images: result.images || [],
      // 검색 출처(grounding chunks) 필수 포함 (지침 준수)
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return { images: [], groundingMetadata: null };
  }
};
