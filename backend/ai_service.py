import os
import json
import logging
from dotenv import load_dotenv
from pathlib import Path
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
MODEL_PROVIDER = "gemini"
MODEL_NAME = "gemini-2.5-flash"


def _create_chat(session_id: str, system_message: str):
    chat = LlmChat(
        api_key=GEMINI_API_KEY,
        session_id=session_id,
        system_message=system_message
    )
    chat.with_model(MODEL_PROVIDER, MODEL_NAME)
    return chat


async def generate_ai_response(conversation_context: list, customer_info: dict = None, knowledge_context: str = ""):
    system_msg = """You are an intelligent customer service AI assistant for a business. 
Your role is to help customers with their inquiries professionally and empathetically.
Guidelines:
- Be concise but helpful
- Maintain a professional yet friendly tone
- If you're unsure, suggest connecting with a human agent
- Use the customer context and knowledge base to personalize responses
- Never make up information about products or policies"""

    if customer_info:
        system_msg += f"\n\nCustomer Info: Name: {customer_info.get('name', 'Unknown')}, Segment: {customer_info.get('segment', 'general')}"
    if knowledge_context:
        system_msg += f"\n\nRelevant Knowledge: {knowledge_context}"

    import uuid
    chat = _create_chat(str(uuid.uuid4()), system_msg)

    context_text = ""
    for msg in conversation_context[-10:]:
        role = msg.get("sender_type", "customer")
        text = msg.get("content", "")
        context_text += f"{role}: {text}\n"

    user_message = UserMessage(text=f"Conversation so far:\n{context_text}\n\nProvide a helpful response to the customer's latest message.")

    try:
        response = await chat.send_message(user_message)
        return {"response": response, "confidence": 0.85}
    except Exception as e:
        logger.error(f"AI response generation failed: {e}")
        return {"response": "I'd be happy to help you with that. Let me connect you with a specialist who can assist you better.", "confidence": 0.3}


async def analyze_sentiment(text: str):
    import uuid
    system_msg = """You are a sentiment analysis engine. Analyze the given text and return ONLY a JSON object with these fields:
- score: float between -1.0 (very negative) and 1.0 (very positive)
- emotion: one of [angry, frustrated, confused, neutral, satisfied, happy, excited]
- confidence: float between 0 and 1
- keywords: list of up to 5 key sentiment-bearing words
Return ONLY valid JSON, no markdown or explanation."""

    chat = _create_chat(str(uuid.uuid4()), system_msg)
    user_message = UserMessage(text=text)

    try:
        response = await chat.send_message(user_message)
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(cleaned)
        return {
            "score": float(result.get("score", 0)),
            "emotion": result.get("emotion", "neutral"),
            "confidence": float(result.get("confidence", 0.5)),
            "keywords": result.get("keywords", [])
        }
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        return {"score": 0.0, "emotion": "neutral", "confidence": 0.3, "keywords": []}


async def classify_intent(text: str):
    import uuid
    system_msg = """You are an intent classification engine. Classify the given customer message and return ONLY a JSON object with:
- intent: one of [product_inquiry, pricing_question, complaint, order_status, technical_support, general_question, cancellation, feedback, billing, greeting, farewell]
- confidence: float between 0 and 1
- entities: object with extracted entities like {product: "", order_id: "", date: "", amount: ""}
- urgency: one of [low, medium, high, critical]
Return ONLY valid JSON."""

    chat = _create_chat(str(uuid.uuid4()), system_msg)
    user_message = UserMessage(text=text)

    try:
        response = await chat.send_message(user_message)
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(cleaned)
        return {
            "intent": result.get("intent", "general_question"),
            "confidence": float(result.get("confidence", 0.5)),
            "entities": result.get("entities", {}),
            "urgency": result.get("urgency", "medium")
        }
    except Exception as e:
        logger.error(f"Intent classification failed: {e}")
        return {"intent": "general_question", "confidence": 0.3, "entities": {}, "urgency": "medium"}


async def generate_lead_score(lead_data: dict):
    import uuid
    system_msg = """You are a lead scoring engine. Given lead data, return ONLY a JSON object with:
- score: integer 0-100
- grade: one of [hot, warm, cold]
- reasoning: brief string explaining the score
- next_action: suggested next action string
Return ONLY valid JSON."""

    chat = _create_chat(str(uuid.uuid4()), system_msg)
    user_message = UserMessage(text=f"Score this lead: {json.dumps(lead_data)}")

    try:
        response = await chat.send_message(user_message)
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(cleaned)
        return result
    except Exception as e:
        logger.error(f"Lead scoring failed: {e}")
        return {"score": 50, "grade": "warm", "reasoning": "Default score", "next_action": "Follow up"}


async def summarize_conversation(messages: list):
    import uuid
    system_msg = """Summarize the following customer conversation in 2-3 sentences. Focus on the customer's issue, any resolution provided, and the current status. Return plain text only."""

    chat = _create_chat(str(uuid.uuid4()), system_msg)
    text = "\n".join([f"{m.get('sender_type', 'unknown')}: {m.get('content', '')}" for m in messages])
    user_message = UserMessage(text=text)

    try:
        response = await chat.send_message(user_message)
        return response.strip()
    except Exception as e:
        logger.error(f"Conversation summary failed: {e}")
        return "Unable to generate summary."


def calculate_churn_risk(customer_data: dict):
    risk_score = 0.0
    factors = []

    sentiment_avg = customer_data.get("avg_sentiment", 0)
    if sentiment_avg < -0.3:
        risk_score += 0.3
        factors.append("Negative sentiment trend")
    elif sentiment_avg < 0:
        risk_score += 0.15
        factors.append("Slightly negative sentiment")

    ticket_count = customer_data.get("recent_tickets", 0)
    if ticket_count > 5:
        risk_score += 0.25
        factors.append("High ticket volume")
    elif ticket_count > 2:
        risk_score += 0.1
        factors.append("Moderate ticket volume")

    days_since_contact = customer_data.get("days_since_last_contact", 0)
    if days_since_contact > 60:
        risk_score += 0.2
        factors.append("Long inactivity period")
    elif days_since_contact > 30:
        risk_score += 0.1
        factors.append("Moderate inactivity")

    complaints = customer_data.get("complaint_count", 0)
    if complaints > 3:
        risk_score += 0.25
        factors.append("Multiple complaints")

    return {
        "risk_score": min(risk_score, 1.0),
        "risk_level": "critical" if risk_score > 0.7 else "high" if risk_score > 0.5 else "medium" if risk_score > 0.3 else "low",
        "factors": factors
    }
