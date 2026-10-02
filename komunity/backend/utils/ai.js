const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Checks if a block of text is toxic or spammy.
 * @param {string} text 
 * @returns {Promise<{isSafe: boolean, reason: string}>}
 */
const checkModeration = async (text) => {
  if (!process.env.GEMINI_API_KEY) {
    // If no key is set, bypass moderation safely
    return { isSafe: true, reason: 'No API key configured' };
  }

  try {
    const prompt = `
      You are an automated moderation system for a community platform.
      Analyze the following text and determine if it is safe, or if it is toxic, hate speech, severe spam, or highly inappropriate.
      Respond ONLY with a JSON object in this exact format: {"isSafe": true/false, "reason": "short explanation"}
      
      Text to analyze:
      "${text}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResult = response.text().trim();
    
    // Remove markdown code blocks if any
    if (textResult.startsWith('\`\`\`json')) {
      textResult = textResult.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    }
    
    return JSON.parse(textResult);
  } catch (err) {
    console.error('AI Moderation failed:', err);
    // Default to true to not block users if AI fails
    return { isSafe: true, reason: 'AI check failed, defaulting to safe' };
  }
};

/**
 * Summarizes a long discussion.
 * @param {string} postTitle 
 * @param {string} postContent 
 * @param {Array<string>} comments 
 * @returns {Promise<string>}
 */
const summarizeDiscussion = async (postTitle, postContent, comments) => {
  if (!process.env.GEMINI_API_KEY) {
    return 'AI API Key is not configured. Cannot generate summary.';
  }

  try {
    const prompt = `
      Summarize the following community discussion into a concise "TL;DR" (Too Long; Didn't Read).
      Keep it under 3-4 short bullet points.
      
      Post Title: ${postTitle}
      Post Content: ${postContent}
      
      Top Comments:
      ${comments.map((c, i) => `${i + 1}. ${c}`).join('\n')}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (err) {
    console.error('AI Summarization failed:', err);
    throw new Error('Failed to generate summary');
  }
};

/**
 * Generates a course outline based on a topic.
 * @param {string} topic 
 * @returns {Promise<Array<{title: string, description: string, lessons: Array<{title: string, content: string}>}>>}
 */
const generateCourseOutline = async (topic) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('AI API Key is not configured. Cannot generate outline.');
  }

  try {
    const prompt = `
      You are an expert curriculum designer. The user wants to create a course about: "${topic}".
      Generate a comprehensive but concise course outline.
      Include 3 to 4 modules. Each module should have 2 to 4 lessons.
      
      Respond ONLY with a valid JSON array of modules in this exact format (do not include markdown formatting or backticks, just raw JSON):
      [
        {
          "title": "Module 1 Title",
          "description": "Short module description",
          "lessons": [
            { "title": "Lesson 1 Title", "content": "Short description of what the lesson covers" }
          ]
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResult = response.text().trim();
    
    // Remove markdown code blocks if any
    if (textResult.startsWith('\`\`\`json')) {
      textResult = textResult.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    } else if (textResult.startsWith('\`\`\`')) {
      textResult = textResult.replace(/\`\`\`/g, '').trim();
    }
    
    return JSON.parse(textResult);
  } catch (err) {
    console.error('AI Course Generation failed:', err);
    throw new Error('Failed to generate course outline');
  }
};

module.exports = {
  checkModeration,
  summarizeDiscussion,
  generateCourseOutline
};
