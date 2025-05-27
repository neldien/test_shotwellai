import express from 'express';
import { Configuration, OpenAIApi } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post('/api/respond', async (req, res) => {
  const { prompt, context } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
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
    res.json({ output });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating response' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
