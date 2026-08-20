import os
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
)

if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is missing. "
        "Create a .env file in the project root and add your Groq API key."
    )



# Model generation settings
MODEL_PARAMETERS = {
    "temperature": 0.7,
    "max_completion_tokens": 2048,
}

print("Groq model:", GROQ_MODEL) 