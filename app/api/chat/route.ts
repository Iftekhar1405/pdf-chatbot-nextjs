import { NextRequest } from 'next/server';

export type GetChatResponse = {
    "answer": string,
    "confidence": number,
    "model_used": string,
    "sources": string,
    "suggestion"?: string,
    "alternativeAnswers": []
}

// Available QA models with their characteristics
const QA_MODELS = {
  'roberta': 'deepset/roberta-base-squad2',
  'distilbert': 'distilbert/distilbert-base-cased-distilled-squad',
  'albert': 'twmkn9/albert-base-v2-squad2',
  'electra': 'deepset/electra-base-squad2',
  'tinyroberta': 'deepset/tinyroberta-squad2',
  'bert': 'deepset/bert-base-cased-squad2'
};

// Model-specific configurations
const MODEL_CONFIGS = {
  'distilbert/distilbert-base-cased-distilled-squad': {
    max_seq_len: 512,
    doc_stride: 128,
    max_answer_len: 100
  },
  'twmkn9/albert-base-v2-squad2': {
    max_seq_len: 512,
    doc_stride: 64,
    max_answer_len: 150
  },
  'deepset/electra-base-squad2': {
    max_seq_len: 512,
    doc_stride: 128,
    max_answer_len: 120
  },
  'deepset/tinyroberta-squad2': {
    max_seq_len: 384,
    doc_stride: 64,
    max_answer_len: 100
  },
  'deepset/bert-base-cased-squad2': {
    max_seq_len: 512,
    doc_stride: 128,
    max_answer_len: 150
  }
};

type MODEL_CONFIGS = keyof typeof MODEL_CONFIGS;

function chunkText(text: string, maxTokens: number = 250, overlap: number = 30): string[] {
  const sentences = text.split(/[.!?]+(?=\s|$)/).filter(s => s.trim().length > 10);
  const chunks: string[] = [];
  let currentChunk = '';
  let wordCount = 0;
  
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    
    if (wordCount + sentenceWords > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      const sentences = currentChunk.split(/[.!?]+/).filter(s => s.trim());
      const overlapSentences = sentences.slice(-2).join('. ');
      currentChunk = overlapSentences + (overlapSentences ? '. ' : '') + sentence.trim();
      wordCount = overlapSentences.split(/\s+/).length + sentenceWords;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
      wordCount += sentenceWords;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 20);
}

function findRelevantChunks(chunks: string[], question: string, topK: number = 4): Array<{chunk: string, score: number}> {
  const questionWords = question.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  const scored = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    
    // Enhanced scoring with different weights
    questionWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = (chunkLower.match(regex) || []).length;
      score += matches * 3; // Higher weight for exact matches
    });
    
    // Partial matching
    questionWords.forEach(word => {
      if (chunkLower.includes(word)) {
        score += 1;
      }
    });
    
    // Question phrase bonus
    const questionPhrase = question.toLowerCase().replace(/[^\w\s]/g, ' ');
    if (chunkLower.includes(questionPhrase)) {
      score += 8;
    }
    
    return { chunk, score };
  });
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Function to try multiple models in sequence
async function queryModel(modelName: MODEL_CONFIGS, question: string, context: string): Promise<{  
  answer: string;
  score: number;
}> {
  const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS['distilbert/distilbert-base-cased-distilled-squad'];
  
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${modelName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          question: question,
          context: context,
        },
        parameters: config
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Model ${modelName} failed: ${response.statusText}`);
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    const data: {
      preferredModel: keyof typeof QA_MODELS,
      question: string,
      context: string
    } = await req.json();
    const { question, context, preferredModel = 'distilbert' } = data;

    console.log('Question received:', question);
    console.log('Context length:', context?.length);
    console.log('Preferred model:', preferredModel);

    if (!question || !context) {
      return new Response(
        JSON.stringify({ error: "Question and context are required" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clean and chunk text
    const cleanedContext = context
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[^\w\s.,!?;:()-]/g, ' ')
      .trim();
    
    const chunks = chunkText(cleanedContext, 250, 30);
    console.log('Number of chunks created:', chunks.length);
    
    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid text chunks found" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find relevant chunks
    const relevantChunksWithScores = findRelevantChunks(chunks, question, 4);
    console.log('Relevant chunks found:', relevantChunksWithScores.length);
    
    const chunksToProcess = relevantChunksWithScores.length > 0 && relevantChunksWithScores[0].score > 0
      ? relevantChunksWithScores.slice(0, 3).map(c => c.chunk)
      : chunks.slice(0, 3);

    // Determine models to try (preferred model first, then fallbacks)
    const selectedModel = QA_MODELS[preferredModel] || QA_MODELS['distilbert'];
    const fallbackModels = [
      QA_MODELS['distilbert'],
      QA_MODELS['tinyroberta'],
      QA_MODELS['electra'],
      QA_MODELS['roberta']
    ].filter(model => model !== selectedModel);

    const modelsToTry = [selectedModel, ...fallbackModels];

    // Try models in sequence until we get good results
    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName}`);
        
        const promises = chunksToProcess.map(chunk => 
          queryModel(modelName as MODEL_CONFIGS, question, chunk)
        );

        const results = await Promise.all(promises);
        const validResults = results
          .filter(result => 
            result && 
            result.answer && 
            result.answer.trim() !== "" && 
            result.answer.toLowerCase() !== "no answer" &&
            (result.score || 0) > 0.01
          )
          .sort((a, b) => (b.score || 0) - (a.score || 0));

        console.log(`Model ${modelName} - Valid results:`, validResults.length);

        if (validResults.length > 0) {
          const bestResult = validResults[0];
          
          return new Response(
            JSON.stringify({ 
              answer: bestResult.answer,
              confidence: bestResult.score || 0.1,
              model_used: modelName,
              sources: `Found in ${validResults.length} relevant section(s)`,
              alternativeAnswers: validResults.slice(1, 2).map(r => ({
                answer: r.answer,
                confidence: r.score || 0.1
              }))
            }), 
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      } catch (error) {
        continue; // Try next model
      }
    }

    // If all models fail
    return new Response(
      JSON.stringify({ 
        answer: "I couldn't find a relevant answer in the provided text using any of the available models.",
        confidence: 0,
        sources: "No relevant context found across multiple models",
        suggestion: "Try rephrasing your question or ensure the document contains information about the topic."
      }), 
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in QA processing:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to process question",
        details: error instanceof Error ? error.message : "Unknown error"
      }), 
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}
