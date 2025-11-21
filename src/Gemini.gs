/**
 * Gemini.gs
 * Integration with Google Gemini API.
 */

const GEMINI_MODEL = 'gemini-2.5-pro'; // User requested model
const API_VERSION = 'v1beta';

/**
 * Calls the Gemini API.
 * @param {Object} payload The JSON payload.
 * @return {Object} The parsed JSON response.
 */
function callGemini(payload) {
  const apiKey = getScriptProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in Script Properties.');
  }
  
  const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText();
  
  if (code !== 200) {
    throw new Error(`Gemini API Error (${code}): ${text}`);
  }
  
  return JSON.parse(text);
}

/**
 * Analyzes a news item to classify it and generate metadata.
 * @param {string} title News title.
 * @param {string} content News content (text).
 * @param {string} type 'GWS' or 'GCP'.
 * @return {Object} { section, subSection, summary }
 */
function analyzeNewsItem(title, content, type) {
  const categories = type === 'GWS' 
    ? 'Comms, Collab, Security, Admin, Developers, Other'
    : 'AI/ML, Compute, Storage, Databases, Networking, Security, Data Analytics, Other';

  const prompt = `
    Analyze the following news item for Google ${type}.
    Title: ${title}
    Content: ${truncateText(content, 1000)}

    Task:
    1. Classify into one of these Sections: ${categories}.
    2. Provide a specific Sub-section (e.g., "Gmail", "Cloud Run").
    3. Write a 1-sentence summary.

    Return ONLY valid JSON in this format:
    {
      "section": "...",
      "subSection": "...",
      "summary": "..."
    }
  `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const result = callGemini(payload);
    const text = result.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  } catch (e) {
    console.error('Error analyzing news item:', e);
    return { section: 'Unclassified', subSection: 'General', summary: 'Analysis failed' };
  }
}

/**
 * Generates content for a Google Doc based on a group of news items.
 * @param {Array} items List of news items for a topic.
 * @param {string} topic The topic name.
 * @return {Object} { title, body }
 */
function generateDocContent(items, topic) {
  const itemsText = items.map(item => `- ${item.title}: ${item.summary} (${item.link})`).join('\n');
  
  const prompt = `
    You are a tech news scriptwriter. Create a script for a YouTube video segment about "${topic}".
    
    News Items:
    ${itemsText}
    
    Output Format (JSON):
    {
      "docTitle": "Video Script: ${topic} - ${new Date().toLocaleDateString()}",
      "body": "Title: [Catchy Title]\n\nDescription:\n[YouTube Description with timestamps if applicable]\n\nScript:\n[Engaging script covering these updates]"
    }
  `;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };
  
  try {
    const result = callGemini(payload);
    const text = result.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  } catch (e) {
    console.error('Error generating doc content:', e);
    return { docTitle: `Update: ${topic}`, body: itemsText };
  }
}
