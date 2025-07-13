// Flat Data postprocessing script to process workout with OpenAI
// This script processes the workout data and generates AI explanations

/// <reference lib="deno.ns" />

import { readTXT, writeJSON, writeTXT } from 'https://deno.land/x/flat@0.0.15/mod.ts';

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
  const prompt = `Act as a senior CrossFit coach with extensive experience in workout programming and technique coaching. Explain the following workout step by step, including proper form tips, scaling options, and potential modifications for beginners:\n\n${workoutText}`;

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
          content: 'You are a senior CrossFit coach with extensive experience in workout programming and technique coaching.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function processWorkoutWithAI() {
  console.log('🚀 Starting workout processing with AI...');

  // Get the filename from Flat Data (first argument)
  const filename = Deno.args[0];
  if (!filename) {
    console.error('❌ No filename provided as argument');
    return;
  }

  console.log(`📄 Processing file: ${filename}`);

  try {
    // Read the raw text file downloaded by Flat Data
    let rawData: string;
    try {
      rawData = await readTXT(filename);
    } catch (error) {
      // If reading as text fails, try reading as string directly
      rawData = await Deno.readTextFile(filename);
    }
    console.log('📥 Raw data loaded successfully');
    console.log(`📊 Data length: ${rawData.length} characters`);

    // Parse the workout data from the AJAX response
    let workoutData: WorkoutData;
    try {
      // The AJAX response should contain JSON data
      const parsedData = JSON.parse(rawData);

      // Extract workout information from the AJAX response
      // The response likely contains HTML content that we need to parse
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
      workoutData = {
        timestamp: new Date().toISOString(),
        source_url: "https://www.crossfitmins.com/workout-of-the-day/",
        success: true,
        data: {
          date: new Date().toISOString().split('T')[0],
          title: "CrossFit MINS Workout",
          text: rawData.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
          full_text: rawData
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
    if (!apiKey) {
      processedData.error = "OpenAI API key not found in environment variables";
      await writeJSON('workout_with_explanation.json', processedData);
      console.log('❌ OpenAI API key not found');
      return;
    }

    console.log('🤖 Generating AI explanation...');
    console.log(`📝 Processing workout: ${workoutData.data.title}`);

    // Generate AI explanation
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
${processedData.combined_content.ai_explanation}

---
*Generated on ${processedData.timestamp} using AI assistance*
`;

    await writeTXT('workout_explanation.md', markdownContent);

    console.log('✅ Successfully processed workout and saved results');
    console.log(`📅 Workout date: ${processedData.combined_content.date}`);
    console.log(`📝 Workout title: ${processedData.combined_content.title}`);
    console.log('🤖 AI explanation generated successfully');
    console.log('� Files created:');
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
