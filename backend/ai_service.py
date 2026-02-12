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


async def get_company_knowledge(db, company_id: str = None):
    """Fetch company product data and knowledge base for RAG context"""
    knowledge_chunks = []

    # Get company product data
    products = await db.company_products.find(
        {"company_id": company_id} if company_id else {},
        {"_id": 0}
    ).to_list(50)
    for p in products:
        knowledge_chunks.append(f"Product: {p.get('name', '')} - {p.get('description', '')} | Price: {p.get('price', 'N/A')} | Category: {p.get('category', 'general')}")

    # Get company FAQs
    faqs = await db.company_faqs.find(
        {"company_id": company_id} if company_id else {},
        {"_id": 0}
    ).to_list(50)
    for f in faqs:
        knowledge_chunks.append(f"FAQ: Q: {f.get('question', '')} A: {f.get('answer', '')}")

    # Get knowledge base articles
    kb_docs = await db.knowledge_base.find({}, {"_id": 0, "title": 1, "content": 1}).to_list(20)
    for doc in kb_docs:
        knowledge_chunks.append(f"KB: {doc.get('title', '')} - {doc.get('content', '')[:300]}")

    # Get company info
    if company_id:
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        if company:
            knowledge_chunks.insert(0, f"Company: {company.get('name', '')} | Industry: {company.get('industry', '')} | Description: {company.get('description', '')}")

    return "\n".join(knowledge_chunks)


async def generate_ai_response(conversation_context: list, customer_info: dict = None, knowledge_context: str = "", company_id: str = None, db=None):
    """Generate AI response with RAG context from company data"""

    # Build RAG context
    rag_context = knowledge_context
    if db and not rag_context:
        try:
            rag_context = await get_company_knowledge(db, company_id)
        except Exception as e:
            logger.error(f"RAG context fetch failed: {e}")

    system_msg = """You are an intelligent customer service AI assistant for a business.
Your role is to help customers with their inquiries professionally and empathetically.
Guidelines:
- Be concise but helpful (2-3 sentences max per response)
- Maintain a professional yet friendly tone
- If you're unsure, suggest connecting with a human agent
- Use the company knowledge base and product data to give accurate answers
- Never make up product details, pricing, or policies
- Personalize responses using customer context when available"""

    if customer_info:
        system_msg += f"\n\nCustomer: {customer_info.get('name', 'Unknown')}, Segment: {customer_info.get('segment', 'general')}, LTV: ${customer_info.get('lifetime_value', 0)}"
    if rag_context:
        system_msg += f"\n\n--- Company Knowledge Base ---\n{rag_context[:3000]}\n--- End Knowledge ---"

    import uuid
    chat = _create_chat(str(uuid.uuid4()), system_msg)

    context_text = ""
    for msg in conversation_context[-10:]:
        role = msg.get("sender_type", "customer")
        text = msg.get("content", "")
        context_text += f"{role}: {text}\n"

    user_message = UserMessage(text=f"Conversation:\n{context_text}\n\nRespond to the customer's latest message helpfully.")

    try:
        response = await chat.send_message(user_message)
        return {"response": response, "confidence": 0.85}
    except Exception as e:
        logger.error(f"AI response generation failed: {e}")
        return {"response": "I'd be happy to help you with that. Let me connect you with a specialist.", "confidence": 0.3}


async def analyze_sentiment(text: str):
    import uuid
    system_msg = """Analyze sentiment. Return ONLY JSON: {"score": float(-1 to 1), "emotion": "angry|frustrated|confused|neutral|satisfied|happy|excited", "confidence": float(0-1), "keywords": [up to 5 words]}"""
    chat = _create_chat(str(uuid.uuid4()), system_msg)
    try:
        response = await chat.send_message(UserMessage(text=text))
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(cleaned)
        return {"score": float(result.get("score", 0)), "emotion": result.get("emotion", "neutral"), "confidence": float(result.get("confidence", 0.5)), "keywords": result.get("keywords", [])}
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        return {"score": 0.0, "emotion": "neutral", "confidence": 0.3, "keywords": []}


async def classify_intent(text: str):
    import uuid
    system_msg = """Classify intent. Return ONLY JSON: {"intent": "product_inquiry|pricing_question|complaint|order_status|technical_support|general_question|cancellation|feedback|billing|greeting", "confidence": float(0-1), "entities": {}, "urgency": "low|medium|high|critical"}"""
    chat = _create_chat(str(uuid.uuid4()), system_msg)
    try:
        response = await chat.send_message(UserMessage(text=text))
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(cleaned)
        return {"intent": result.get("intent", "general_question"), "confidence": float(result.get("confidence", 0.5)), "entities": result.get("entities", {}), "urgency": result.get("urgency", "medium")}
    except Exception as e:
        logger.error(f"Intent classification failed: {e}")
        return {"intent": "general_question", "confidence": 0.3, "entities": {}, "urgency": "medium"}


async def generate_lead_score(lead_data: dict):
    import uuid
    system_msg = """Score lead. Return ONLY JSON: {"score": int(0-100), "grade": "hot|warm|cold", "reasoning": "brief string", "next_action": "suggested action"}"""
    chat = _create_chat(str(uuid.uuid4()), system_msg)
    try:
        response = await chat.send_message(UserMessage(text=f"Score this lead: {json.dumps(lead_data)}"))
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return json.loads(cleaned)
    except Exception as e:
        logger.error(f"Lead scoring failed: {e}")
        return {"score": 50, "grade": "warm", "reasoning": "Default score", "next_action": "Follow up"}


async def generate_nurture_message(lead_data: dict, stage: str, company_context: str = ""):
    """Generate personalized lead nurturing message based on stage and company data"""
    import uuid
    system_msg = f"""You are a sales nurturing AI. Generate a personalized follow-up message for a lead.
Stage: {stage}
Guidelines:
- Keep it under 3 sentences
- Be personalized using lead data
- Include a clear call-to-action
- Match tone to the lead stage (warm intro for new, urgency for qualified, value prop for proposal)
{f'Company context: {company_context[:1000]}' if company_context else ''}"""

    chat = _create_chat(str(uuid.uuid4()), system_msg)
    try:
        response = await chat.send_message(UserMessage(text=f"Lead: {json.dumps(lead_data)}"))
        return {"message": response.strip(), "stage": stage}
    except Exception as e:
        logger.error(f"Nurture message failed: {e}")
        return {"message": f"Hi {lead_data.get('name', 'there')}, just following up on our conversation. Would love to help you get started!", "stage": stage}


async def summarize_conversation(messages: list):
    import uuid
    system_msg = """Summarize this conversation in 2-3 sentences. Focus on the issue, resolution, and status."""
    chat = _create_chat(str(uuid.uuid4()), system_msg)
    text = "\n".join([f"{m.get('sender_type', 'unknown')}: {m.get('content', '')}" for m in messages])
    try:
        response = await chat.send_message(UserMessage(text=text))
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
    complaints = customer_data.get("complaint_count", 0)
    if complaints > 3:
        risk_score += 0.25
        factors.append("Multiple complaints")
    return {"risk_score": min(risk_score, 1.0), "risk_level": "critical" if risk_score > 0.7 else "high" if risk_score > 0.5 else "medium" if risk_score > 0.3 else "low", "factors": factors}
