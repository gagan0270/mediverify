
import { GoogleGenAI, Type } from "@google/genai";
import { 
  PrescriptionData, 
  TabletData, 
  UserProfile, 
  VerificationResult, 
  Language, 
  ReportAnalysis, 
  AlertSeverity
} from "../types";

const getLanguageInstruction = (lang: Language) => {
  const instructions = {
    en: "Respond in English.",
    hi: "Respond in Hindi (हिन्दी). Provide medical terms in English brackets where necessary.",
    es: "Respond in Spanish (Español).",
    kn: "Respond in Kannada (ಕನ್ನಡ). Provide medical terms in English brackets where necessary for clarity."
  };
  return instructions[lang] || instructions.en;
};

/**
 * Helper to downsample base64 images for faster API transmission
 */
const resizeImage = (base64Str: string, maxWidth = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64Str;
  });
};

export const analyzeHealthImage = async (image: string, lang: Language = 'en'): Promise<string> => {
  const optimizedImage = await resizeImage(image);
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: optimizedImage.split(',')[1], mimeType: 'image/jpeg' } },
        { text: `Analyze this medical image in extreme detail. Provide a comprehensive clinical explanation using deep reasoning. ${getLanguageInstruction(lang)}` }
      ]
    },
    config: {
      thinkingConfig: { thinkingBudget: 32768 }
    }
  });
  return response.text || "No analysis could be generated.";
};

export const getDeepReasoning = async (query: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: query,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      systemInstruction: `You are a world-class clinical expert. Provide highly detailed, deep reasoning for complex queries. ${getLanguageInstruction(lang)}`
    }
  });
  return response.text || "No reasoning could be generated.";
};

export const generatePillVisual = async (prompt: string, aspectRatio: string = '1:1', imageSize: string = '1K'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        { text: `A crisp, photorealistic clinical photograph of a medication pill. Description: ${prompt}` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: imageSize as any
      }
    }
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate visual.");
};

export const getMedicineRates = async (medicines: TabletData[], lang: Language = 'en'): Promise<{ text: string, sources: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const medList = medicines.map(m => m.name).join(', ');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Find current real-world market rates, local pharmacy prices, and generic alternatives for: ${medList}. Provide accurate price ranges. ${getLanguageInstruction(lang)}`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  return { 
    text: response.text || "Market rate data unavailable.", 
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
  };
};

export const analyzeMedicalReports = async (
  base64Data: string, 
  mimeType: string,
  profile: UserProfile, 
  lang: Language = 'en'
): Promise<ReportAnalysis> => {
  const optimizedImage = mimeType.startsWith('image/') ? await resizeImage(base64Data) : base64Data;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    ROLE: Senior Clinical Pathologist.
    TASK: Analyze the medical report.
    PATIENT: ${JSON.stringify(profile)}
    FORMAT: Group findings into "High", "Low", and "Normal" compartments.
    Explain findings simply for someone without a medical degree.
    ${getLanguageInstruction(lang)}
    Output valid JSON only.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: optimizedImage.split(',')[1], mimeType: mimeType } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reportType: { type: Type.STRING },
          doctorName: { type: Type.STRING },
          patientName: { type: Type.STRING },
          date: { type: Type.STRING },
          severity: { type: Type.STRING },
          overallHealthGrade: { type: Type.STRING },
          simpleSummary: { type: Type.STRING },
          highFindings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.STRING },
                range: { type: Type.STRING },
                status: { type: Type.STRING },
                problemSimplified: { type: Type.STRING },
                majorDiseaseRisk: { type: Type.STRING },
                suggestedSolution: { type: Type.STRING }
              }
            }
          },
          lowFindings: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.STRING }, range: { type: Type.STRING }, status: { type: Type.STRING }, problemSimplified: { type: Type.STRING }, majorDiseaseRisk: { type: Type.STRING }, suggestedSolution: { type: Type.STRING } } } },
          normalFindings: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.STRING }, range: { type: Type.STRING }, status: { type: Type.STRING }, problemSimplified: { type: Type.STRING }, majorDiseaseRisk: { type: Type.STRING }, suggestedSolution: { type: Type.STRING } } } },
          top3Risks: { type: Type.ARRAY, items: { type: Type.STRING } },
          immediateSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });

  return {
    id: crypto.randomUUID(),
    imageUrl: optimizedImage,
    mimeType: mimeType,
    ...JSON.parse(response.text || '{}')
  };
};

export const analyzePrescription = async (imageBase64: string, lang: Language = 'en'): Promise<PrescriptionData> => {
  const optimizedImage = await resizeImage(imageBase64);
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: optimizedImage.split(',')[1], mimeType: "image/jpeg" } },
        { text: `Extract all medicine details. CRITICAL: Categorize each item as 'Tablet', 'Syrup', 'Injection', 'Cream', 'Drops', or 'Other'. ${getLanguageInstruction(lang)}` }
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
                instructions: { type: Type.STRING },
                type: { type: Type.STRING, description: "Categorization: Tablet, Syrup, Injection, Cream, Drops, Other" }
              }
            }
          }
        }
      }
    }
  });
  return { id: crypto.randomUUID(), ...JSON.parse(response.text || '{}') };
};

export const identifyTablet = async (imageBase64: string, lang: Language = 'en'): Promise<TabletData> => {
  const optimizedImage = await resizeImage(imageBase64);
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: optimizedImage.split(',')[1], mimeType: "image/jpeg" } },
        { text: `Identify this medication pill. Provide comprehensive details including Pharmacological Class and Mechanism of Action. ${getLanguageInstruction(lang)}` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          dosage: { type: Type.STRING },
          frequency: { type: Type.STRING },
          color: { type: Type.STRING },
          shape: { type: Type.STRING },
          imprint: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          description: { type: Type.STRING },
          uses: { type: Type.STRING },
          genericName: { type: Type.STRING },
          sideEffects: { type: Type.STRING },
          specialWarnings: { type: Type.STRING },
          pharmacologyClass: { type: Type.STRING },
          mechanismOfAction: { type: Type.STRING }
        }
      }
    }
  });
  const text = response.text;
  if (!text) throw new Error("Empty response from AI identification service.");
  
  const data = JSON.parse(text);
  return { ...data, imageUrl: optimizedImage, confidence: data.confidence || 0.9 };
};

export const verifyMedicineSafety = async (p: UserProfile, allPr: PrescriptionData[], t: TabletData[], l: Language = 'en'): Promise<VerificationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const masterMedicineList = allPr.flatMap(pr => pr.medicines);

  const prompt = `
    ROLE: Senior Clinical Pharmacist.
    TASK: Perform a Multi-Factor Clinical Audit comparing prescribed medications against physical identified pills.
    
    PATIENT PROFILE: ${JSON.stringify(p)}
    ALL PRESCRIPTIONS: ${JSON.stringify(masterMedicineList)}
    IDENTIFIED PILLS: ${JSON.stringify(t.map(x => ({name: x.name, dosage: x.dosage, imprint: x.imprint})))}
    
    SCORING ALGORITHM RULES:
    1. Identity Score (0-1): 
       - 1.0: Exact molecule and name match.
       - 0.5: Different brand but same active generic molecule.
       - 0.0: Different chemical class or molecule.
    2. Posology (Dosage) Score (0-1):
       - 1.0: Exact strength (e.g., 500mg vs 500mg).
       - 0.7: Minimal difference (e.g., 500mg vs 650mg).
       - 0.3: High difference (e.g., 5mg vs 50mg).
       - 0.0: Unknown or dangerous mismatch.
    3. Chronology (Frequency) Score (0-1):
       - 1.0: Exact match (e.g., BID vs Twice daily).
       - 0.5: Mismatch in timing but same daily count.
       - 0.0: Total mismatch.

    SEVERITY LEVELS:
    - CRITICAL: Life-threatening mismatch (Wrong drug, 10x dosage error, or allergy conflict).
    - MAJOR_WARNING: Clinically significant mismatch (Wrong brand with different efficacy, 2x dosage error).
    - WARNING: Minor discrepancy (Slight dosage variance, timing mismatch).
    - INFO: Perfect match or minimal note.

    ${getLanguageInstruction(l)}
    Output valid JSON only.
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
          status: { type: Type.STRING, description: "One of: PERFECT_MATCH, PARTIAL_MATCH, NO_MATCH, REQUIRES_REVIEW" },
          matchScore: { type: Type.NUMBER, description: "Aggregated safety score from 0 to 1" },
          identifiedTablets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                isMatch: { type: Type.BOOLEAN },
                matchSeverity: { type: Type.STRING, description: "CRITICAL, MAJOR_WARNING, WARNING, INFO" },
                identityScore: { type: Type.NUMBER },
                posologyScore: { type: Type.NUMBER },
                chronologyScore: { type: Type.NUMBER },
                scoreExplanation: { type: Type.STRING, description: "Nuanced reason for the given scores" },
                discrepancyDetails: { type: Type.STRING },
                genericName: { type: Type.STRING },
                pharmacologyClass: { type: Type.STRING },
                mechanismOfAction: { type: Type.STRING },
                specialWarnings: { type: Type.STRING }
              }
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
  
  const text = response.text;
  if (!text) throw new Error("Empty safety verification response.");
  
  const analysis = JSON.parse(text);
  const finalTablets = t.map((orig, i) => ({ 
    ...orig, 
    ...(analysis.identifiedTablets || [])[i] 
  }));

  return { 
    id: crypto.randomUUID(), 
    timestamp: new Date().toISOString(), 
    prescription: allPr[0],
    allPrescriptions: allPr,
    identifiedTablets: finalTablets,
    matchStats: {
      matchedCount: finalTablets.filter(t => t.isMatch).length,
      unmatchedCount: finalTablets.filter(t => !t.isMatch).length,
      totalPrescribed: masterMedicineList.length
    },
    ...analysis 
  };
};

export const getHealthSearch = async (query: string, lang: Language = 'en'): Promise<{ text: string, sources: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: query,
    config: { tools: [{ googleSearch: {} }] }
  });
  return { text: response.text || "", sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
};
