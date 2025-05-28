import express from 'express';
import { Configuration, OpenAIApi } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is not set');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function generateDSPyClasses(context, prompt) {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are a DSPy expert. Your task is to generate DSPy classes that could be used to structure the output for a given LLM interaction.
        Focus on creating appropriate DSPy classes with:
        - Proper input/output signatures
        - Relevant fields and types
        - Appropriate DSPy decorators and patterns
        
        Consider both the system context and user prompt when designing the classes.
        Output ONLY the DSPy class definitions, no explanations or additional text.
        Use proper Python syntax and DSPy conventions.`
      },
      {
        role: 'user',
        content: `Generate the DSPy classes that could be used for the output for the following LLM interaction:

System Context:
${context}

User Prompt:
${prompt}

Output only the DSPy classes `
      }
    ];

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
    });
    
    return completion.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating DSPy classes:', error);
    throw new Error(`Failed to generate DSPy classes: ${error.message}`);
  }
}

app.post('/api/respond', async (req, res) => {
  const { prompt, context } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // Generate DSPy classes based on both context and prompt
    const dspyClasses = await generateDSPyClasses(context || '', prompt);
    
    // Get the actual response to the prompt
    const messages = [];
    if (context) {
      messages.push({ role: 'system', content: context });
    }
    messages.push({ role: 'user', content: prompt });

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages,
    });
    const output = completion.data.choices[0].message.content;

    // Return both the DSPy classes and the response
    res.json({ 
      output,
      dspyClasses,
      example: {
        prompt,
        context,
        answer: output,
        dspyStructure: dspyClasses
      }
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ 
      error: 'Error generating response',
      details: err.message || 'Unknown error occurred'
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
