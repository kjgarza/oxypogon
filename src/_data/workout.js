import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function() {
  const workoutPath = path.join(__dirname, '../../outputs/workout_with_explanation.json');

  try {
    const data = JSON.parse(fs.readFileSync(workoutPath, 'utf8'));
    return data;
  } catch (error) {
    console.warn('Could not load workout data:', error.message);
    return {
      success: false,
      error: 'Workout data not available',
      timestamp: new Date().toISOString(),
      combined_content: {
        title: 'No Workout Available',
        date: new Date().toISOString().split('T')[0],
        workout_text: '<p>Check back later for today\'s workout.</p>',
        ai_explanation: ''
      },
      ai_explanation: {
        explanation: ''
      }
    };
  }
}
