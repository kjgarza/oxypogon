export const USER_PROMPT = `
Your task is to explain the provided Workout of the Day (WOD) step by step in a casual, friendly, and conversational style. Break down each movement with detailed instructions, including:

Be thorough and approachable in your explanations, as if speaking directly to a diverse group of athletes during an in-gym whiteboard briefing.

**Output Format**:
- Use markdown formatting for easy readability.
- Structure your output as an ordered list, delineating:
    1. Overview of the workout structure and intended goals.
    2. Step-by-step breakdown for each workout component.
    3. For each movement:
        - Step-by-step technique
        - Form tips
        - Scaling/modification options
    4. Loading and rep-modification options (Sweat, Train, Compete), with brief strategy advice.
- Ensure all step-by-step explanations start with the reasoning (why form matters, why to scale, etc.) and conclude with the summary/instruction.

---

**Example**

*Output: (this is an illustrative snapshot, not exhaustive)*:
## Workout Overview
   This WOD starts with a strength/skill segment focusing on Hang Power Snatches, prioritizing smooth technique and progressive loading. After, it transitions to a grindy conditioning piece with big, manageable sets intended to challenge muscular endurance and grit.

## Strength Segment
1. **Hang Power Snatch (Barbell):
    - **Technique Steps**:
        - Begin by deadlifting the bar and standing tall.
        - Hinge at the hips to reach the hang position (bar just above the knees).
        - From here, explosively extend and pull the bar overhead, catching it in a partial squat.
        - Stand tall, reset, and repeat.
    - **Form Tips**:
        - Keep the bar close to your body; elbows high on the pull.
        - Drive through your hips, not just your arms.
    - **Scaling/Modifications**:
        - Use a lighter barbell or PVC pipe to focus on form.
        - Dumbbell Snatches from hang if barbell not available.
    - **Loading**:
        - Build from 50% to 85% of your tested 1RM.

## Conditioning Segment [For Time]
    - **100 Alternating Dumbbell Hang Snatches**:
        - Hinge at your hips, hold the dumbbell in one hand between your legs, and explosively drive it overhead, switching hands each rep.
        - *Scaling*: Use lighter dumbbell, or fewer reps if new.
    - **100 V-Ups**:
        - Lie flat, arms overhead. Initiate each rep by raising legs and arms at the same time, aiming to touch toes.
        - *Modification*: Tuck-ups: bring knees to chest instead.
    - **Loading Options**:
        - Sweat: 10kg/5kg DB, use tuck ups
        - Train: 12.5kg/7.5kg DB
        - Compete: 15kg/10kg DB
    - **Strategy Advice**:
        - Aim for steady pace; break up big sets early, especially on core and grip-intensive moves.


**WOD**:\n
`;

export const SYSTEM_PROMPT =
  "Act as a senior CrossFit coach with extensive experience in workout programming and technique coaching.";


export const EXTRACT_PROMPT =
"Given the provided workout text, extracct the workout in a succinct format. " +
"WOD:\n";
