import json
import os

cells = [
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# PrefID Integration\n",
            "\n",
            "[PrefID](https://pref-id.vercel.app) provides identity-aware memory infrastructure for AI agents.\n",
            "It helps agents understand:\n",
            "- **WHAT** users like (content preferences)\n",
            "- **HOW** users want responses (thinking preferences / Atom of Thought)\n",
            "\n",
            "This integration allows LangChain agents to access and learn user preferences using standardized tools."
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Installation"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "%pip install -U langchain-prefid langchain-anthropic"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Setup\n",
            "\n",
            "Get your Client ID from the [PrefID Dashboard](https://pref-id.vercel.app/dashboard)."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "import os\n",
            "from langchain_prefid import create_prefid_tools\n",
            "from langchain_anthropic import ChatAnthropic\n",
            "from langchain.agents import create_tool_calling_agent, AgentExecutor\n",
            "from langchain_core.prompts import ChatPromptTemplate\n",
            "\n",
            "# Configuration\n",
            "# In production, use environment variables or OAuth flow\n",
            "CLIENT_ID = \"your-client-id\"\n",
            "ACCESS_TOKEN = \"user-access-token\" \n",
            "USER_ID = \"user_123\"\n",
            "\n",
            "# Initialize LLM\n",
            "llm = ChatAnthropic(model=\"claude-3-5-sonnet-20241022\", temperature=0)"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Create Tools\n",
            "\n",
            "The `create_prefid_tools` helper creates a suite of tools for reading/writing preferences and introspection."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "tools = create_prefid_tools(\n",
            "    client_id=CLIENT_ID,\n",
            "    access_token=ACCESS_TOKEN,\n",
            "    user_id=USER_ID\n",
            ")\n",
            "\n",
            "# View available tools\n",
            "for tool in tools:\n",
            "    print(f\"- {tool.name}: {tool.description}\")"
        ]
    },
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Create and Run Agent\n",
            "\n",
            "We'll create an agent that recommends restaurants based on BOTH content preferences (food) AND thinking preferences (verbosity/style)."
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "system_prompt = \"\"\"You are a helpful assistant.\n",
            "\n",
            "IMPORTANT: Before making recommendations:\n",
            "1. Call get_thinking_preferences to understand HOW the user wants responses (AoT)\n",
            "2. Call get_user_preferences with 'food_profile' to understand WHAT they like\n",
            "3. Structure your response according to their thinking preferences\n",
            "\n",
            "If the user asks why you're responding a certain way, use explain_response_style.\n",
            "\"\"\"\n",
            "\n",
            "prompt = ChatPromptTemplate.from_messages([\n",
            "    (\"system\", system_prompt),\n",
            "    (\"placeholder\", \"{chat_history}\"),\n",
            "    (\"human\", \"{input}\"),\n",
            "    (\"placeholder\", \"{agent_scratchpad}\"),\n",
            "])\n",
            "\n",
            "agent = create_tool_calling_agent(llm, tools, prompt)\n",
            "executor = AgentExecutor(agent=agent, tools=tools, verbose=True)\n",
            "\n",
            "# Run the agent\n",
            "result = executor.invoke({\n",
            "    \"input\": \"Recommend a restaurant for date night\"\n",
            "})\n",
            "\n",
            "print(result['output'])"
        ]
    }
]

nb = {
    "cells": cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "codemirror_mode": {
                "name": "ipython",
                "version": 3
            },
            "file_extension": ".py",
            "mimetype": "text/x-python",
            "name": "python",
            "nbconvert_exporter": "python",
            "pygments_lexer": "ipython3",
            "version": "3.11.7"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 5
}

output_path = os.path.join(os.path.dirname(__file__), '../docs/prefid.ipynb')
print(f"Generating notebook at: {output_path}")

with open(output_path, 'w') as f:
    json.dump(nb, f, indent=2)
    
print("Success!")
