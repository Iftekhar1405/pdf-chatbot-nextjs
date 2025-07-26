export type Chunk = {
  id: string;
  text: string;
  vector: number[];
};

export const memory: Chunk[] = [];

export function addChunk(chunk: Chunk) {
  console.log("Chukn dadded");
  memory.push(chunk);
}

export function search(queryVector: number[], topK = 3) {
  return memory
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(chunk.vector, queryVector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}
