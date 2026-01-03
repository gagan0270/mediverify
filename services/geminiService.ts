
import { GoogleGenAI, Type } from "@google/genai";
import { PrescriptionData, TabletData, UserProfile, VerificationResult, MatchStatus, AlertSeverity, Language, MedicineRate } from "../types";

const getLanguageInstruction = (lang: Language) => {
  const instructions = {
    en: "Respond in English.",
    hi: "Respond in Hindi (हिन्दी). Provide medical terms in English brackets where necessary.",
    es: "Respond in Spanish (Español)."
  };
  return instructions[lang] || instructions.en;
};

/**
 * Uses Gemini 3 Flash for fast extraction of prescription data.
 */
export const analyzePrescription = async (imageBase64: string, lang: Language = 'en'): Promise<PrescriptionData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } },
        { text: `System: You are an expert medical OCR agent. 
        Extract structured medical prescription data from this image. 
        Ensure all medicine names, dosages, frequencies, and instructions are identified with high precision.
        Focus specifically on handwritten or typed medicine names.
        ${getLanguageInstruction(lang)} Return valid JSON.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          doctorName: { type: Type.STRING },
          clinicName: { type: Type.STRING },
          date: { type: Type.STRING },
          medicines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                dosage: { type: Type.STRING },
                frequency: { type: Type.STRING },
                instructions: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

/**
 * Uses Gemini 3 Flash for rapid tablet identification.
 */
export const identifyTablet = async (imageBase64: string, lang: Language = 'en'): Promise<TabletData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } },
        { text: `System: You are a pill identification expert. 
        Analyze this image of a medical tablet. 
        Detect the color, shape, and specifically look for any imprints or markings on the surface.
        Provide a detailed clinical description including what it is and its common uses.
        ${getLanguageInstruction(lang)} Return valid JSON.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          color: { type: Type.STRING },
          shape: { type: Type.STRING },
          imprint: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          description: { type: Type.STRING },
          uses: { type: Type.STRING }
        }
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return { ...data, imageUrl: imageBase64 };
};

/**
 * Uses Gemini 3 Flash with Google Search for real-time pricing.
 */
export const getMedicineRates = async (tablets: TabletData[], lang: Language = 'en'): Promise<{ results: MedicineRate[], sources: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const medicineNames = tablets.map(t => t.name).join(', ');
  
  const prompt = `Search for the current market prices and extremely detailed medical descriptions for: ${medicineNames}. 
  Cross-check True Medicine, 1mg, and Netmeds for the most accurate rates.
  For each medicine, provide:
  1. Full Name & Chemical Composition
  2. Estimated Price Range (e.g., per strip of 10)
  3. Deep clinical description and therapeutic benefits.
  ${getLanguageInstruction(lang)}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  return {
    results: [{ 
      name: "Consolidated Price Report", 
      estimatedPrice: "See breakdown below", 
      description: response.text || "No results found." 
    }],
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};

/**
 * The core safety engine. Uses Gemini 3 Pro with Thinking Mode for critical analysis.
 */
export const verifyMedicineSafety = async (
  profile: UserProfile, 
  prescription: PrescriptionData, 
  tablets: TabletData[],
  lang: Language = 'en'
): Promise<VerificationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    TASK: High-Stakes Medical Verification and Safety Audit.
    
    PATIENT PROFILE: ${JSON.stringify(profile)}
    PRESCRIBED LIST: ${JSON.stringify(prescription.medicines)}
    PHYSICAL SAMPLES PROVIDED: ${JSON.stringify(tablets.map(t => ({ name: t.name, color: t.color, shape: t.shape, imprint: t.imprint })))}
    
    REQUIRED ACTIONS:
    1. MATCHING: For each physical sample, determine if it exactly matches an item in the prescription. 
    2. DESCRIPTIONS: For ALL samples, provide an extensive clinical profile (drug class, mechanism) and detailed medical uses.
    3. SAFETY: Identify potential allergic reactions based on patient profile or dangerous drug-drug interactions.
    4. ALERTS: Generate critical alerts if non-prescribed medicines are found or if prescribed ones are missing.
    
    ${getLanguageInstruction(lang)}
    
    OUTPUT: Valid JSON only.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING },
          matchScore: { type: Type.NUMBER },
          identifiedTablets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                isMatch: { type: Type.BOOLEAN },
                description: { type: Type.STRING },
                uses: { type: Type.STRING }
              }
            }
          },
          matchStats: {
            type: Type.OBJECT,
            properties: {
              matchedCount: { type: Type.INTEGER },
              unmatchedCount: { type: Type.INTEGER },
              totalPrescribed: { type: Type.INTEGER }
            }
          },
          alerts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const analysis = JSON.parse(response.text || '{}');
  
  // Re-map images from input to analyzed output
  const finalTablets = tablets.map((orig, i) => {
    const aiData = (analysis.identifiedTablets || [])[i] || {};
    return {
      ...orig,
      ...aiData
    };
  });

  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    prescription,
    identifiedTablets: finalTablets,
    ...analysis
  };
};

export const getHealthSearch = async (query: string, lang: Language = 'en'): Promise<{ text: string, sources: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 32768 }
    }
  });

  return {
    text: response.text || "",
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};

export const getQuickSummary = async (text: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Summarize this medical text in 2 concise bullet points: ${text}. ${getLanguageInstruction(lang)}`
  });
  return response.text || "";
};

export const analyzeHealthImage = async (imageBase64: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } },
        { text: `Analyze this health image and provide a clinical interpretation. ${getLanguageInstruction(lang)}` }
      ]
    },
    config: {
      thinkingConfig: { thinkingBudget: 32768 }
    }
  });
  return response.text || "";
};

export const getDeepReasoning = async (query: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: query,
    config: {
      thinkingConfig: { thinkingBudget: 32768 }
    }
  });
  return response.text || "";
};

export const generatePillVisual = async (prompt: string, aspectRatio: string = "1:1", imageSize: string = "1K"): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: `A medical reference photo of a pill: ${prompt}` }]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: imageSize as any
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Generation failed");
};
