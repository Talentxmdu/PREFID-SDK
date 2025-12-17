"""
Script to push PrefID agent prompts to LangSmith Hub.

Usage:
    export LANGCHAIN_API_KEY="..."
    pip install langchainhub
    python3 scripts/push_to_hub.py
"""

from langchain import hub
from langchain_core.prompts import ChatPromptTemplate

# 1. Restaurant Recommender Prompt
restaurant_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful restaurant recommendation assistant.

IMPORTANT: Before making recommendations:
1. Call get_thinking_preferences to understand HOW the user wants responses
2. Call get_user_preferences with 'food_profile' to understand WHAT they like
3. Structure your response according to their thinking preferences

If the user asks why you're responding a certain way, use explain_response_style.
If the user tells you how they prefer responses, use learn_thinking_preference.
"""),
    ("placeholder", "{chat_history}"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

# 2. Basic Agent Prompt
basic_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful assistant with access to user preferences.
Use the provided tools to personalize your responses based on user preferences.
"""),
    ("placeholder", "{chat_history}"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

if __name__ == "__main__":
    print("Pushing prompts to LangSmith Hub...")
    try:
        # Push to your handle (requires login)
        # Change 'talentxmdu' to your handle if different, or just 'prefid-sdk'
        
        hub.push("prefid/restaurant-recommender", restaurant_prompt)
        print("✅ Pushed: prefid/restaurant-recommender")
        
        hub.push("prefid/basic-agent", basic_prompt)
        print("✅ Pushed: prefid/basic-agent")
        
        print("\nSuccess! View at https://smith.langchain.com/hub/prefid")
    except Exception as e:
        print(f"\nError pushing to hub: {e}")
        print("Did you login? Run: langchain hub login")
