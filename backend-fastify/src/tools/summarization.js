// Summarization Tool - Summarizes text using extractive summarization

function summarize(text, maxSentences) {
  if (!text || text.trim().length === 0) {
    return { error: 'No text provided' };
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const limit = maxSentences || Math.max(3, Math.ceil(sentences.length * 0.3));

  if (sentences.length <= limit) {
    return { original_length: sentences.length, summary: text, compression: '100%' };
  }

  // Score sentences by word frequency
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  const scored = sentences.map((s, i) => {
    const sWords = s.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const score = sWords.reduce((sum, w) => sum + (freq[w] || 0), 0) / Math.max(sWords.length, 1);
    // Boost first and last sentences slightly
    const positionBoost = (i === 0 || i === sentences.length - 1) ? 0.2 : 0;
    return { sentence: s.trim(), score: score + positionBoost, index: i };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).sort((a, b) => a.index - b.index);
  const summary = top.map(s => s.sentence).join(' ');

  return {
    original_sentences: sentences.length,
    summary_sentences: limit,
    compression: `${Math.round((limit / sentences.length) * 100)}%`,
    summary,
  };
}

module.exports = { summarize };
