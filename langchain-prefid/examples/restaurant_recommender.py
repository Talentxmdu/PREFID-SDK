"""
Example: Restaurant Recommender with PrefID
Shows how to use PrefID tools with LangChain agents
"""

from langchain_anthropic import ChatAnthropic
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate
from langchain_prefid import create_prefid_tools

# Configuration
CLIENT_ID = "your-client-id"
ACCESS_TOKEN = "user-access-token"
USER_ID = "user_123"

# Create PrefID tools
tools = create_prefid_tools(
    client_id=CLIENT_ID,
    access_token=ACCESS_TOKEN,
    user_id=USER_ID
)

# Initialize LLM
llm = ChatAnthropic(model="claude-3-5-sonnet-20241022", temperature=0)

# Create prompt
system_prompt = """You are a helpful restaurant recommendation assistant.

IMPORTANT: Before making recommendations:
1. Call get_thinking_preferences to understand HOW the user wants responses
2. Call get_user_preferences with 'food_profile' to understand WHAT they like
3. Structure your response according to their thinking preferences

If the user asks why you're responding a certain way, use explain_response_style.
If the user tells you how they prefer responses, use learn_thinking_preference.
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("placeholder", "{chat_history}"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

# Create agent
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Example interactions
if __name__ == "__main__":
    # Example 1: Get recommendation
    print("=== Example 1: Restaurant Recommendation ===")
    result = executor.invoke({
        "input": "Recommend a restaurant for date night"
    })
    print(f"\nResponse: {result['output']}\n")
    
    # Example 2: Learn preference
    print("=== Example 2: Learn Preference ===")
    result = executor.invoke({
        "input": "I prefer when you give me just one clear recommendation instead of multiple options"
    })
    print(f"\nResponse: {result['output']}\n")
    
    # Example 3: Ask why
    print("=== Example 3: Introspection ===")
    result = executor.invoke({
        "input": "Why did you respond that way?"
    })
    print(f"\nResponse: {result['output']}\n")
