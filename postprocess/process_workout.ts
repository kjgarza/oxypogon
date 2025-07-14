// Flat Data postprocessing script to process workout with OpenAI
// This script processes the workout data and generates AI explanations

import { readTXT, writeJSON, writeTXT } from 'https://deno.land/x/flat@0.0.15/mod.ts';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

interface WorkoutData {
  timestamp: string;
  source_url: string;
  success: boolean;
  data?: {
    date: string;
    title: string;
    text: string;
    full_text: string;
  };
  error?: string;
}

interface ProcessedWorkoutData {
  timestamp: string;
  success: boolean;
  original_data?: WorkoutData;
  ai_explanation?: {
    generated_at: string;
    model: string;
    explanation: string;
  };
  combined_content?: {
    date: string;
    title: string;
    workout_text: string;
    ai_explanation: string;
    full_content: string;
  };
  error?: string;
}

async function callOpenAI(workoutText: string, apiKey: string): Promise<string> {
  const prompt = `Explain the following WOD step by step, using a casual and frienly tone and a conversational style. including proper form tips, scaling options, and potential modifications for beginners:\n\n${workoutText}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Act as a senior CrossFit coach with extensive experience in workout programming and technique coaching.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 900,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. Details: ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function extractScriptData(htmlContent: string): { pid: string, security: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  
  let pid = '';
  let security = '';

  // Method 1: Extract security from ap-custom-script-js-extra script tag (blog object)
  const customScript = doc.getElementById('ap-custom-script-js-extra');
  if (customScript) {
    const scriptContent = customScript.textContent;
    if (scriptContent) {
      console.log('🔍 Found custom script content');
      
      // Look for blog object with security
      const blogObjectMatch = scriptContent.match(/var\s+blog\s*=\s*\{([^}]+)\}/s);
      if (blogObjectMatch) {
        const objContent = blogObjectMatch[1];
        console.log('🔍 Found blog object in script');
        
        // Extract security from blog object
        const securityMatch = objContent.match(/["']security["']\s*:\s*["']([^"']+)["']/);
        if (securityMatch) {
          security = securityMatch[1];
          console.log(`🔍 Found security in blog object: ${security.substring(0, 10)}...`);
        }
      }
      
      // Fallback: Look for any security pattern in the script
      if (!security) {
        const securityMatch = scriptContent.match(/["']?(?:security|nonce)["']?\s*:\s*["']([^"']+)["']/i);
        if (securityMatch) {
          security = securityMatch[1];
          console.log(`🔍 Found security with fallback pattern: ${security.substring(0, 10)}...`);
        }
      }
    }
  }

  // Method 2: Extract PID from wod-link rel attribute
  const wodLink = doc.querySelector('a.wod-link');
  if (wodLink) {
    const relAttribute = wodLink.getAttribute('rel');
    if (relAttribute) {
      pid = relAttribute;
      console.log(`🔍 Found PID in wod-link rel attribute: ${pid}`);
    }
  }

  // Method 3: Fallback - search entire HTML content for patterns
  if (!pid || !security) {
    console.log('🔍 Searching entire HTML content for fallback patterns');
    
    // Look for wod-link rel pattern in HTML
    if (!pid) {
      const wodLinkMatch = htmlContent.match(/<a[^>]+class[^>]*wod-link[^>]+rel\s*=\s*["']([^"']+)["']/i);
      if (wodLinkMatch) {
        pid = wodLinkMatch[1];
        console.log(`🔍 Found PID with HTML pattern search: ${pid}`);
      }
    }
    
    // Look for blog object security in HTML
    if (!security) {
      const blogSecurityMatch = htmlContent.match(/var\s+blog\s*=\s*\{[^}]*["']security["']\s*:\s*["']([^"']+)["']/i);
      if (blogSecurityMatch) {
        security = blogSecurityMatch[1];
        console.log(`🔍 Found security with HTML pattern search: ${security.substring(0, 10)}...`);
      }
    }
    
    // Additional fallback patterns
    if (!pid) {
      const patterns = [
        /rel\s*=\s*["'](\d+)["']/gi,
        /post[_-]?id\s*[=:]\s*["']?(\d+)["']?/gi,
        /pid\s*[=:]\s*["']?(\d+)["']?/gi
      ];
      
      for (const pattern of patterns) {
        const matches = htmlContent.matchAll(pattern);
        for (const match of matches) {
          if (!pid && match[1] && /^\d+$/.test(match[1])) {
            pid = match[1];
            console.log(`🔍 Found PID with additional pattern search: ${pid}`);
            break;
          }
        }
        if (pid) break;
      }
    }
  }

  console.log(`🔍 Final extraction results - PID: ${pid || 'NOT FOUND'}, Security: ${security ? 'FOUND (' + security.substring(0, 10) + '...)' : 'NOT FOUND'}`);
  
  return { pid, security };
}


async function fetchWorkoutData(pid: string, security: string): Promise<string> {
  const url = 'https://www.crossfitmins.com/wp-admin/admin-ajax.php';
  
  // Prepare form data
  const formData = new URLSearchParams();
  formData.append('action', 'load_posts_by_ajax');
  formData.append('pid', pid);
  formData.append('security', security);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; WorkoutBot/1.0)',
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    console.log(`📡 Response content type: ${contentType}`);
    console.log(`📡 Response status: ${response.status}`);

    const responseText = await response.text();
    
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response received from server');
    }

    console.log(`📥 Response length: ${responseText.length} characters`);
    return responseText;

  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${url}. Check your internet connection.`);
    }
    throw new Error(`Failed to fetch workout data: ${error.message}`);
  }
}


async function processWorkoutWithAI() {
  console.log('🚀 Starting workout processing with AI...');

  // Get the filename from Flat Data (first argument)
  const filename = Deno.args[0];
  if (!filename) {
    console.error('❌ No filename provided as argument');
    return;
  }

  console.log(`📄 Processing HTML file: ${filename}`);

  try {
    // Read the HTML file
    let htmlContent: string;
    try {
      htmlContent = await readTXT(filename);
    } catch (error) {
      // If reading as text fails, try reading as string directly
      htmlContent = await Deno.readTextFile(filename);
    }
    console.log('📥 HTML content loaded successfully');
    console.log(`📊 Content length: ${htmlContent.length} characters`);

    // Extract pid and security from HTML
    const { pid, security } = extractScriptData(htmlContent);
    
    if (!pid || !security) {
      throw new Error(`Missing required data - PID: ${pid ? 'found' : 'missing'}, Security: ${security ? 'found' : 'missing'}`);
    }

    console.log('🔍 Successfully extracted workout parameters from HTML');

    // Fetch workout data using extracted parameters
    console.log('📡 Fetching workout data from server...');
    const workoutResponse = await fetchWorkoutData(pid, security);
    console.log('📥 Workout data fetched successfully');

    // Parse the workout data from the AJAX response
    let workoutData: WorkoutData;
    try {
      // The AJAX response should contain JSON data
      const parsedData = JSON.parse(workoutResponse);

      // Extract workout information from the AJAX response
      let workoutText = '';
      let workoutTitle = 'CrossFit MINS Workout';

      if (typeof parsedData === 'string') {
        // If it's an HTML string, extract the workout content
        workoutText = parsedData;
      } else if (parsedData.data) {
        workoutText = parsedData.data;
      } else if (parsedData.html) {
        workoutText = parsedData.html;
      } else {
        workoutText = JSON.stringify(parsedData);
      }

      // Try to extract title from HTML if present
      const titleMatch = workoutText.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      if (titleMatch) {
        workoutTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      }

      // Clean up HTML tags for the text version
      const cleanText = workoutText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      workoutData = {
        timestamp: new Date().toISOString(),
        source_url: "https://www.crossfitmins.com/workout-of-the-day/",
        success: true,
        data: {
          date: new Date().toISOString().split('T')[0],
          title: workoutTitle,
          text: cleanText,
          full_text: workoutText
        }
      };
    } catch (parseError) {
      console.log('⚠️ Could not parse as JSON, treating as raw text');
      // If it's not JSON, create a basic workout structure
      const cleanText = workoutResponse.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      workoutData = {
        timestamp: new Date().toISOString(),
        source_url: "https://www.crossfitmins.com/workout-of-the-day/",
        success: true,
        data: {
          date: new Date().toISOString().split('T')[0],
          title: "CrossFit MINS Workout",
          text: cleanText,
          full_text: workoutResponse
        }
      };
    }

    // Initialize processed data
    const processedData: ProcessedWorkoutData = {
      timestamp: new Date().toISOString(),
      success: false,
      original_data: workoutData
    };

    // Check if we have valid workout data to process
    if (!workoutData.success || !workoutData.data) {
      processedData.error = "No valid workout data available to process";
      await writeJSON('workout_with_explanation.json', processedData);
      console.log('❌ No valid workout data to process');
      return;
    }

    // Get API key from environment
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    console.log(`🔑 API Key exists: ${apiKey ? 'YES' : 'NO'}`);
    console.log(`🔑 API Key length: ${apiKey ? apiKey.length : 0} characters`);
    console.log(`🔑 API Key starts with sk-: ${apiKey ? apiKey.startsWith('sk-') : 'NO'}`);

    if (!apiKey) {
      processedData.error = "OpenAI API key not found in environment variables";
      await writeJSON('workout_with_explanation.json', processedData);
      console.log('❌ OpenAI API key not found');
      return;
    }

    console.log('🤖 Generating AI explanation...');
    console.log(`📝 Processing workout: ${workoutData.data.title}`);

    // Generate AI explanation using the fetched workout data
    const explanation = await callOpenAI(workoutData.data.full_text, apiKey);

    // Create processed data
    processedData.success = true;
    processedData.ai_explanation = {
      generated_at: new Date().toISOString(),
      model: 'gpt-4o-mini',
      explanation: explanation
    };
    processedData.combined_content = {
      date: workoutData.data.date,
      title: workoutData.data.title,
      workout_text: workoutData.data.text,
      ai_explanation: explanation,
      full_content: `${workoutData.data.full_text}\n\n--- AI EXPLANATION ---\n\n${explanation}`
    };

    // Save processed data using Flat Data helpers
    await writeJSON('workout_with_explanation.json', processedData);

    // Save just the OpenAI explanation to a dedicated file
    await writeTXT('ai_explanation.txt', explanation);

    // Create markdown file for easy reading
    const markdownContent = `# CrossFit MINS Workout - ${processedData.combined_content.date}

## ${processedData.combined_content.title}

### Workout
${processedData.combined_content.workout_text}

### Expert Explanation
${processedData.ai_explanation.explanation}

---
*Generated on ${processedData.timestamp} using AI assistance*
`;

    await writeTXT('workout_explanation.md', markdownContent);

    console.log('✅ Successfully processed workout and saved results');
    console.log(`📅 Workout date: ${processedData.combined_content.date}`);
    console.log(`📝 Workout title: ${processedData.combined_content.title}`);
    console.log('🤖 AI explanation generated successfully');
    console.log('📁 Files created:');
    console.log('  - workout_with_explanation.json (complete data)');
    console.log('  - ai_explanation.txt (OpenAI response only)');
    console.log('  - workout_explanation.md (formatted markdown)');

  } catch (error) {
    console.error(`❌ Error processing workout: ${error.message}`);

    const errorData: ProcessedWorkoutData = {
      timestamp: new Date().toISOString(),
      success: false,
      error: `Processing error: ${error.message}`
    };

    await writeJSON('workout_with_explanation.json', errorData);
  }
}

// Run the processing function
await processWorkoutWithAI();
