import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv(override=True)

try:
    llm = ChatGroq(
        model_name="openai/gpt-oss-120b",
        temperature=0
    )
    res = llm.invoke("Say Hello")
    print("SUCCESS:", res.content)
except Exception as e:
    print("\nEXACT ERROR ENCOUNTERED:")
    print(e)