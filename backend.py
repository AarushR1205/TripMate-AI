import os
import certifi
from dotenv import load_dotenv
from typing import TypedDict, Annotated
import operator
import uuid
from langchain.messages import HumanMessage
import psycopg
from psycopg.rows import dict_row
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langchain_core.messages import AnyMessage, AIMessage
from langchain_groq import ChatGroq
from tools import tavily_search, search_flights

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

load_dotenv()

def get_database_url():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError(
            "DATABASE_URL is missing. Please add your Render PostgreSQL External Database URL to .env"
        )

    if "sslmode=" not in database_url:
        separator = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{separator}sslmode=require"
    return database_url

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Add it in your .env file")

llm = ChatGroq(model="openai/gpt-oss-120b", api_key=GROQ_API_KEY)

class TravelState(TypedDict):
    messages : Annotated[list[AnyMessage], operator.add]
    query : str
    flight_results : str
    hotel_results : str
    itinerary : str
    llm_calls : int

def flight_agent_node(state:TravelState)->dict:
    query = state['query']
    flight_data = search_flights(query)
    return {
        "flight_results" : flight_data,
        "messages" : [AIMessage(content="Flight results fetched")],
        "llm_calls" : state.get("llm_calls", 0) + 1
    }

def hotel_agent_node(state:TravelState)->dict:
    query = state["query"]
    hotel_results = tavily_search(f"Best hotels for {query}")
    return {
        "hotel_results" : hotel_results,
        "messages" : [AIMessage(content="Hotel results fetched.")],
        "llm_calls" : state.get("llm_calls", 0) + 1
    }

def itinerary_agent_node(state:TravelState)->dict:
    prompt = f"""You are ana travel planner. Create a 
                complete travel itinerary.
                
                User Query: {state['query']}
                Flight Results: {state['flight_results']}
                Hotel Results: {state['hotel_results']}
                
                Make the itinerary practical, budget-aware, and easy to follow."""

    response = llm.invoke(prompt)
    itinerary_result = response.content.strip()
    return {
        "itinerary" : itinerary_result,
        "messages" : [response],
        "llm_calls" : state.get("llm_calls", 0) + 1
    }

def final_response_node(state:TravelState)->dict:
    final_prompt = f"""
    You are a professional AI travel booking assistant.
    Generate the final travel response for the user.
    
    User Request: {state["query"]}
    Flight Information: {state["flight_results"]}
    Hotel Information: {state["hotel_results"]}
    Itinerary: {state["itinerary"]}

    Structure the response using these sections:
    ## Trip Summary
    ## Flight Information
    ## Hotel Suggestions
    ## Day-by-Day Itinerary
    ## Estimated Budget
    ## Final Recommendations

    Formatting rules:

    - Use Markdown headings such as ## and ###.
    - Use **bold text** for important labels and information.
    - Use normal Markdown bullet points for lists.
    - Use numbered lists when appropriate.
    - Do NOT use Markdown tables.
    - Do NOT use the pipe character "|" anywhere in the response.
    - Use colons ":" for labels such as:
    - Airline:
    - Departure:
    - Arrival:
    - Location:
    - Price:
    - Rating:

    - Keep commas, colons, periods, parentheses, currency symbols, and other normal punctuation.
    - Do not remove useful information simply to satisfy formatting.
    - Keep the response clean, readable, structured, and practical.
    - Do not add unnecessary decorative symbols.
    - Mention that live flight API data may not provide ticket prices if pricing is unavailable.
    - Clearly distinguish live flight information from estimated or general travel information.
    - Provide useful recommendations based on the available information.

    Return only the final travel response. """

    response = llm.invoke(final_prompt)
    print(f"\n {response.content}")
    return {
        "messages" : [response],
        "llm_calls" : state.get("llm_calls", 0) + 1
    }

graph = StateGraph(state_schema=TravelState)

graph.add_node("flight_agent",flight_agent_node)
graph.add_node("hotel_agent",hotel_agent_node)
graph.add_node("itinerary_agent",itinerary_agent_node)
graph.add_node("final_response",final_response_node)

graph.add_edge(START, "flight_agent")
graph.add_edge("flight_agent", "hotel_agent")
graph.add_edge("hotel_agent","itinerary_agent")
graph.add_edge("itinerary_agent", "final_response")
graph.add_edge("final_response", END)

DATABASE_URL = get_database_url()
_conn = psycopg.connect(
    DATABASE_URL,
    autocommit=True,
    row_factory=dict_row
)

checkpointer = PostgresSaver(_conn)
checkpointer.setup()

travel_graph = graph.compile()


def run_travel_agent(user_input: str, thread_id: str | None=None):
    if not thread_id:
        thread_id = f"user_{uuid.uuid4().hex()}"

    config = {"configurable" : {"thread_id" : thread_id}}
    
    result = travel_graph.invoke({
        "messages" : [HumanMessage(content=user_input)],
        "query" : user_input,
        "flight_results" : "",
        "hotel_results" : "",
        "itinerary" : "",
        "llm_calls" : 0
    },
    config=config
    )

    final_answer = result["messages"][-1].content
    return {
        "thread_id": thread_id,
        "answer": final_answer,
        "flight_results": result.get("flight_results", ""),
        "hotel_results": result.get("hotel_results", ""),
        "itinerary": result.get("itinerary", ""),
        "llm_calls": result.get("llm_calls", 0)
    }




