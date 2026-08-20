from groq import Groq

from config import GROQ_API_KEY, GROQ_MODEL


# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)
# Model parameters
MODEL_PARAMETERS = {
    "temperature": 0.7,
    "max_completion_tokens": 1024,
}

def groq_response(system_prompt, conversation):
    """
    Send a conversation to Llama 3.3 70B through Groq.
    """

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    # Add previous conversation messages
    messages.extend(conversation)

    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=MODEL_PARAMETERS["temperature"],
        max_completion_tokens=MODEL_PARAMETERS["max_completion_tokens"],
    )

    response_text = completion.choices[0].message.content

    return {
        "response_text": response_text or ""
    }