// In a full implementation, this would connect to an embeddings service
// (e.g., OpenAI embeddings, local transformers).
// For the frontend phase, we simulate the embedding fetch.

export interface EmbeddingVector {
  values: number[];
}

/**
 * Generates or fetches an embedding vector for a given text.
 */
export async function getEmbedding(text: string): Promise<EmbeddingVector> {
  // Simulating an embedding fetch. In reality, POST to /api/embeddings
  return new Promise((resolve) => {
    // Generate deterministic pseudo-random embedding based on text length and content
    const values = Array(1536).fill(0).map((_, i) => {
      return Math.sin(text.length * i) * 0.1; 
    });
    resolve({ values });
  });
}

/**
 * Computes cosine similarity between two embedding vectors
 */
export function cosineSimilarity(vecA: EmbeddingVector, vecB: EmbeddingVector): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.values.length; i++) {
    dotProduct += vecA.values[i] * vecB.values[i];
    normA += vecA.values[i] * vecA.values[i];
    normB += vecB.values[i] * vecB.values[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
