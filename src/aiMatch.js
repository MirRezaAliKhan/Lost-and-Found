import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

// Initialize Gemini API
let genAI = null;
let model = null;

export const initGenAI = (apiKey) => {
  if (!apiKey) {
    console.warn("Gemini API Key is missing!");
    return;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "text-embedding-004" });
};

// Generate Embedding for a text string
export const getEmbedding = async (text) => {
  if (!model) {
    console.error("Gemini AI not initialized");
    return null;
  }
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
};

// Compute Cosine Similarity between two vectors
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
};

// Find matches for a lost item
export const findMatchesAI = async (searchText, searchCategory, searchLocation, userUid) => {
  if (!model) {
    console.error("Gemini AI not initialized");
    return [];
  }

  console.log(`🤖 AI Searching for: ${searchText}`);

  try {
    // 1. Generate Embedding for the search query
    // We combine relevant fields to make the embedding richer
    const queryText = `${searchText} ${searchCategory} ${searchLocation}`;
    const queryEmbedding = await getEmbedding(queryText);

    if (!queryEmbedding) {
      throw new Error("Failed to generate query embedding");
    }

    // 2. Fetch ALL 'found' items from Firestore
    // Note: In a production app with thousands of items, you'd use a vector database (like Pinecone or Firestore Vector Search).
    // For this project (client-side only), we fetch active found items and compute similarity locally.
    const q = query(
      collection(db, "items"),
      where("type", "==", "found"),
      where("status", "in", ["open", "claimed_pending"]) // Include pending claims so people can still see them
    );

    const querySnapshot = await getDocs(q);
    const results = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Skip my own items
      if (data.uid === userUid) return;

      let similarity = 0;

      // A. If the item has a pre-computed embedding, use it
      if (data.embedding) {
        similarity = cosineSimilarity(queryEmbedding, data.embedding);
      } 
      // B. Fallback: If no embedding (legacy item), use basic text overlap score
      else {
        // Simple keyword match fallback
        const itemText = `${data.name} ${data.category} ${data.description} ${data.location}`.toLowerCase();
        const searchTerms = searchText.toLowerCase().split(" ");
        let matchCount = 0;
        searchTerms.forEach(term => {
          if (itemText.includes(term)) matchCount++;
        });
        // Normalize somewhat (arbitrary fallback score)
        similarity = matchCount > 0 ? 0.3 + (matchCount * 0.1) : 0; 
      }

      // Convert similarity (0-1) to percentage score (0-100)
      // We can boost the score if Category matches exactly
      if (data.category === searchCategory) {
        similarity += 0.1; 
      }
      
      // Boost if Location matches exactly
      if (data.location === searchLocation) {
        similarity += 0.05;
      }

      const score = Math.min(Math.round(similarity * 100), 100);

      // Only return relevant matches (e.g., > 40%)
      if (score > 40) {
        results.push({ id: doc.id, ...data, score });
      }
    });

    // 3. Sort by Score (Highest first)
    results.sort((a, b) => b.score - a.score);

    return results;

  } catch (error) {
    console.error("Error in AI matching:", error);
    return [];
  }
};
