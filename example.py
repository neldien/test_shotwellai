import requests
import json

SERVER_URL = "http://localhost:3000/api/respond"

prompt = "Write a short poem about spring."
context = "You are a helpful assistant."

response = requests.post(SERVER_URL, json={"prompt": prompt, "context": context})
response.raise_for_status()

data = response.json()
example = {
    "prompt": prompt,
    "context": context,
    "answer": data["output"],
}

print(json.dumps(example, indent=2))
