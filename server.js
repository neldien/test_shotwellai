import express from 'express';
import OpenAI from 'openai';
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to generate evaluation configuration from schema
function generateEvaluationConfig(schema) {
  const config = {};
  
  for (const [fieldName, description] of Object.entries(schema)) {
    const fieldConfig = {
      evaluation_type: "llm_judge", // default
      accepted_values: description,
      ui_hint: "text_input", // default
      optional: false
    };

    // Determine evaluation type and UI hint based on field name and description
    const desc = description.toLowerCase();
    const field = fieldName.toLowerCase();
    
    // Temperature fields
    if (field.includes('temperature')) {
      fieldConfig.evaluation_type = "number_match";
      fieldConfig.accepted_values = [-50, 50]; // reasonable range for Celsius
      fieldConfig.ui_hint = "number_input";
      fieldConfig.optional = desc.includes("if specified") || desc.includes("when available");
    }
    // Wind speed
    else if (field.includes('wind_speed')) {
      fieldConfig.evaluation_type = "number_match";
      fieldConfig.accepted_values = [0, 200]; // reasonable range for km/h
      fieldConfig.ui_hint = "number_input";
      fieldConfig.optional = desc.includes("if specified");
    }
    // Precipitation chance
    else if (field.includes('precipitation_chance')) {
      fieldConfig.evaluation_type = "number_match";
      fieldConfig.accepted_values = [0, 100]; // percentage
      fieldConfig.ui_hint = "range_slider";
      fieldConfig.optional = desc.includes("if mentioned");
    }
    // Weather conditions
    else if (field.includes('weather_condition') || field.includes('weather_conditions')) {
      fieldConfig.evaluation_type = "string_match";
      fieldConfig.accepted_values = [
        "sunny", "cloudy", "partly cloudy", "rainy", "showers", 
        "clear", "overcast", "stormy", "snowy", "foggy", "misty"
      ];
      fieldConfig.ui_hint = "dropdown";
      fieldConfig.optional = false;
    }
    // Day of week
    else if (field.includes('day')) {
      fieldConfig.evaluation_type = "string_match";
      fieldConfig.accepted_values = [
        "Monday", "Tuesday", "Wednesday", "Thursday", 
        "Friday", "Saturday", "Sunday"
      ];
      fieldConfig.ui_hint = "dropdown";
      fieldConfig.optional = false;
    }
    // Weather warnings
    else if (field.includes('warning')) {
      fieldConfig.evaluation_type = "boolean_match";
      fieldConfig.accepted_values = [true, false];
      fieldConfig.ui_hint = "checkbox";
      fieldConfig.optional = true;
    }
    // Precipitation details
    else if (field.includes('precipitation_details')) {
      fieldConfig.evaluation_type = "string_match";
      fieldConfig.accepted_values = [
        "none", "light rain", "moderate rain", "heavy rain",
        "light showers", "showers", "heavy showers",
        "drizzle", "light snow", "snow", "heavy snow"
      ];
      fieldConfig.ui_hint = "dropdown";
      fieldConfig.optional = true;
    }

    config[fieldName] = fieldConfig;
  }

  return config;
}

app.post('/api/submit', async (req, res) => {
  try {
    const weatherText = "Monday: High 25°C, Low 16°C, mostly sunny, wind 15 km/h, no precipitation mentioned. Tuesday: High 22°C, Low 14°C, increasing clouds, 20% chance of rain, wind not specified. Wednesday: High 20°C, Low 12°C, showers in afternoon, 60% chance of precipitation, wind not specified. Thursday: Partly cloudy, temperatures 21–18°C, wind not specified, no precipitation chance mentioned. Friday: Partly cloudy, temperatures 21–18°C, winds increase to 25 km/h, no precipitation chance mentioned. Saturday: Cool and breezy, occasional light rain, temperatures not specified, wind not specified. Sunday: No details provided. No weather warnings are in effect.";

    console.log('Making OpenAI API call...');
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `You are an intelligent assistant that extracts structured data schemas from natural language outputs.

Given a prompt, context, and a natural language response, your task is to infer a structured schema representing the fields in the response. Each field should have a name (in snake_case) and a brief description of what it represents.

Return the schema as a flat JSON object, where each key is a field name, and each value is a short (1–2 sentence) description of that field.

If the response contains repeated elements (e.g. daily summaries, transaction logs, entries in a list), infer the schema of one repeated element.

⚠️ Do not extract actual values — only return the field names and their definitions. RESPONSE${weatherText}`
    });
    
    console.log('OpenAI Response:', JSON.stringify(response, null, 2));
    
    const rawContent = response.output[0].content[0].text;
    console.log('Raw content from OpenAI:', rawContent);
    
    let schema;
    try {
        // More robust JSON extraction
        let jsonContent = rawContent;
        
        // Remove markdown code block if present
        if (rawContent.includes('```')) {
            const codeBlockMatch = rawContent.match(/```(?:json)?\n([\s\S]*?)\n```/);
            if (codeBlockMatch) {
                jsonContent = codeBlockMatch[1];
            }
        }
        
        // Clean up the content
        jsonContent = jsonContent.trim();
        
        // Try parsing
        schema = JSON.parse(jsonContent);
        console.log('Parsed schema:', JSON.stringify(schema, null, 2));
    } catch (parseError) {
        console.error('Error parsing schema JSON:', parseError);
        console.error('Raw content that failed to parse:', rawContent);
        console.error('Cleaned content that failed to parse:', jsonContent);
        throw new Error(`Failed to parse schema from OpenAI response: ${parseError.message}`);
    }
    
    const evaluationConfig = generateEvaluationConfig(schema);
    console.log('Generated evaluation config:', JSON.stringify(evaluationConfig, null, 2));
    
    res.json({ 
      schema: schema,
      evaluation_config: evaluationConfig
    });
  } catch (err) {
    console.error('Server error:', err);
    console.error('Full error object:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      status: err.status,
      code: err.code,
      type: err.type
    });
    res.status(500).json({ 
      error: 'Error making API call',
      details: err.message || 'Unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
