from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging
import os

from database import db
from auth_utils import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, get_current_user,
    require_role
)
from ai_service import (
    generate_ai_response, analyze_sentiment, classify_intent,
    generate_lead_score, summarize_conversation, calculate_churn_risk
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="NexusEngage AI Platform")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ─── PYDANTIC MODELS ──────────────────────────────────────────
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str
    role: str = "agent"

class LoginInput(BaseModel):
    email: str
    password: str

class ConversationCreate(BaseModel):
    customer_id: str
    channel: str = "web_chat"
    subject: str = ""

class MessageCreate(BaseModel):
    content: str
    sender_type: str = "agent"
    attachments: list = []

class LeadCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    company: str = ""
    source: str = "web_chat"
    status: str = "new"
    notes: str = ""

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    score: Optional[int] = None
    grade: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    company: str = ""
    channels: list = []
    tags: list = []
    segment: str = "general"

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    channels: Optional[list] = None
    tags: Optional[list] = None
    segment: Optional[str] = None

class TicketCreate(BaseModel):
    conversation_id: str = ""
    customer_id: str = ""
    subject: str
    description: str = ""
    priority: str = "medium"
    category: str = "general"

class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None

class KBDocCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    tags: list = []

class ChannelSettingsUpdate(BaseModel):
    channel: str
    enabled: bool = False
    api_key: str = ""
    api_secret: str = ""
    webhook_url: str = ""
    page_id: str = ""
    phone_number_id: str = ""
    access_token: str = ""
    extra_config: dict = {}

class TemplateCreate(BaseModel):
    name: str
    content: str
    category: str = "general"
    channel: str = "all"


# ─── HELPER ────────────────────────────────────────────────────
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def make_id():
    return str(uuid.uuid4())

def clean_doc(doc):
    if doc and "_id" in doc:
        del doc["_id"]
    return doc

def clean_docs(docs):
    return [clean_doc(d) for d in docs]


# ─── AUTH ROUTES ───────────────────────────────────────────────
@api.post("/auth/register")
async def register(body: RegisterInput):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = make_id()
    user = {
        "id": user_id,
        "email": body.email,
        "password": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "status": "active",
        "avatar": "",
        "created_at": now_iso(),
        "last_login": now_iso(),
    }
    await db.users.insert_one(user)
    token_data = {"sub": user_id, "email": body.email, "role": body.role, "name": body.name}
    return {
        "token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": {"id": user_id, "email": body.email, "name": body.name, "role": body.role}
    }


@api.post("/auth/login")
async def login(body: LoginInput):
    user = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": now_iso()}})
    token_data = {"sub": user["id"], "email": user["email"], "role": user["role"], "name": user["name"]}
    return {
        "token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "avatar": user.get("avatar", "")}
    }


@api.post("/auth/refresh")
async def refresh_token(refresh_token: str = Body(..., embed=True)):
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    new_data = {"sub": payload["sub"], "email": payload["email"], "role": payload["role"], "name": payload["name"]}
    return {"token": create_access_token(new_data), "refresh_token": create_refresh_token(new_data)}


@api.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─── USERS ─────────────────────────────────────────────────────
@api.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(500)
    return users


@api.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict = Body(...), current_user: dict = Depends(get_current_user)):
    updates.pop("password", None)
    updates.pop("_id", None)
    updates["updated_at"] = now_iso()
    await db.users.update_one({"id": user_id}, {"$set": updates})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return user


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_role(["admin"]))):
    await db.users.delete_one({"id": user_id})
    return {"status": "deleted"}


# ─── CONVERSATIONS ─────────────────────────────────────────────
@api.get("/conversations")
async def list_conversations(
    channel: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if channel:
        query["channel"] = channel
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to"] = assigned_to
    if search:
        query["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}}
        ]
    convos = await db.conversations.find(query, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return convos


@api.get("/conversations/{convo_id}")
async def get_conversation(convo_id: str, current_user: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return convo


@api.post("/conversations")
async def create_conversation(body: ConversationCreate, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": body.customer_id}, {"_id": 0})
    convo_id = make_id()
    convo = {
        "id": convo_id,
        "customer_id": body.customer_id,
        "customer_name": customer["name"] if customer else "Unknown",
        "customer_avatar": customer.get("avatar", "") if customer else "",
        "channel": body.channel,
        "subject": body.subject or "New Conversation",
        "status": "open",
        "priority": "medium",
        "assigned_to": current_user["sub"],
        "assigned_name": current_user.get("name", ""),
        "ai_handled": False,
        "sentiment_score": 0.0,
        "sentiment_label": "neutral",
        "message_count": 0,
        "last_message": "",
        "last_message_at": now_iso(),
        "unread_count": 0,
        "tags": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.conversations.insert_one(convo)
    return clean_doc(convo)


@api.put("/conversations/{convo_id}")
async def update_conversation(convo_id: str, updates: dict = Body(...), current_user: dict = Depends(get_current_user)):
    updates.pop("_id", None)
    updates["updated_at"] = now_iso()
    await db.conversations.update_one({"id": convo_id}, {"$set": updates})
    convo = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    return convo


@api.get("/conversations/{convo_id}/messages")
async def get_messages(convo_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return messages


@api.post("/conversations/{convo_id}/messages")
async def send_message(convo_id: str, body: MessageCreate, current_user: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_id = make_id()
    message = {
        "id": msg_id,
        "conversation_id": convo_id,
        "content": body.content,
        "sender_type": body.sender_type,
        "sender_id": current_user["sub"] if body.sender_type != "customer" else convo.get("customer_id", ""),
        "sender_name": current_user.get("name", "") if body.sender_type != "customer" else convo.get("customer_name", ""),
        "attachments": body.attachments,
        "sentiment": None,
        "intent": None,
        "read": False,
        "created_at": now_iso(),
    }

    # Run sentiment analysis on customer messages
    if body.sender_type == "customer":
        try:
            sentiment = await analyze_sentiment(body.content)
            message["sentiment"] = sentiment
            intent = await classify_intent(body.content)
            message["intent"] = intent
            # Update conversation sentiment
            await db.conversations.update_one({"id": convo_id}, {"$set": {
                "sentiment_score": sentiment["score"],
                "sentiment_label": sentiment["emotion"],
            }})
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")

    await db.messages.insert_one(message)

    # Update conversation
    await db.conversations.update_one({"id": convo_id}, {"$set": {
        "last_message": body.content[:100],
        "last_message_at": now_iso(),
        "updated_at": now_iso(),
        "message_count": convo.get("message_count", 0) + 1,
    }, "$inc": {"unread_count": 1 if body.sender_type == "customer" else 0}})

    clean_doc(message)

    # If customer message, check if AI should respond
    ai_response = None
    if body.sender_type == "customer" and convo.get("ai_handled", True):
        try:
            messages_history = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
            customer = await db.customers.find_one({"id": convo.get("customer_id", "")}, {"_id": 0})
            result = await generate_ai_response(messages_history, customer)
            if result["confidence"] > 0.6:
                ai_msg_id = make_id()
                ai_message = {
                    "id": ai_msg_id,
                    "conversation_id": convo_id,
                    "content": result["response"],
                    "sender_type": "ai",
                    "sender_id": "ai-assistant",
                    "sender_name": "AI Assistant",
                    "attachments": [],
                    "sentiment": None,
                    "intent": None,
                    "ai_confidence": result["confidence"],
                    "read": False,
                    "created_at": now_iso(),
                }
                await db.messages.insert_one(ai_message)
                await db.conversations.update_one({"id": convo_id}, {"$set": {
                    "last_message": result["response"][:100],
                    "last_message_at": now_iso(),
                    "message_count": convo.get("message_count", 0) + 2,
                    "ai_handled": True,
                }})
                ai_response = clean_doc(ai_message)
        except Exception as e:
            logger.error(f"AI response failed: {e}")

    return {"message": message, "ai_response": ai_response}


@api.post("/conversations/{convo_id}/ai-respond")
async def trigger_ai_response(convo_id: str, current_user: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages_history = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    customer = await db.customers.find_one({"id": convo.get("customer_id", "")}, {"_id": 0})
    result = await generate_ai_response(messages_history, customer)
    ai_msg_id = make_id()
    ai_message = {
        "id": ai_msg_id,
        "conversation_id": convo_id,
        "content": result["response"],
        "sender_type": "ai",
        "sender_id": "ai-assistant",
        "sender_name": "AI Assistant",
        "attachments": [],
        "ai_confidence": result["confidence"],
        "read": False,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(ai_message)
    await db.conversations.update_one({"id": convo_id}, {"$set": {
        "last_message": result["response"][:100],
        "last_message_at": now_iso(),
        "updated_at": now_iso(),
    }, "$inc": {"message_count": 1}})
    return clean_doc(ai_message)


@api.post("/conversations/{convo_id}/summarize")
async def get_conversation_summary(convo_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    summary = await summarize_conversation(messages)
    return {"summary": summary}


# ─── LEADS ─────────────────────────────────────────────────────
@api.get("/leads")
async def list_leads(
    status: Optional[str] = None,
    grade: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if grade:
        query["grade"] = grade
    if source:
        query["source"] = source
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
        ]
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return leads


@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@api.post("/leads")
async def create_lead(body: LeadCreate, current_user: dict = Depends(get_current_user)):
    lead_id = make_id()
    lead = {
        "id": lead_id,
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "company": body.company,
        "source": body.source,
        "status": body.status,
        "score": 50,
        "grade": "warm",
        "notes": body.notes,
        "assigned_to": current_user["sub"],
        "assigned_name": current_user.get("name", ""),
        "activities": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.leads.insert_one(lead)
    return clean_doc(lead)


@api.put("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadUpdate, current_user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    await db.leads.delete_one({"id": lead_id})
    return {"status": "deleted"}


@api.post("/leads/{lead_id}/score")
async def score_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    result = await generate_lead_score(lead)
    await db.leads.update_one({"id": lead_id}, {"$set": {
        "score": result.get("score", 50),
        "grade": result.get("grade", "warm"),
        "scoring_reason": result.get("reasoning", ""),
        "next_action": result.get("next_action", ""),
        "updated_at": now_iso(),
    }})
    updated = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


# ─── CUSTOMERS ─────────────────────────────────────────────────
@api.get("/customers")
async def list_customers(
    segment: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if segment:
        query["segment"] = segment
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return customers


@api.get("/customers/{customer_id}")
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    # Get conversation count
    convo_count = await db.conversations.count_documents({"customer_id": customer_id})
    customer["conversation_count"] = convo_count
    # Get churn risk
    customer["churn_risk"] = calculate_churn_risk(customer)
    return customer


@api.post("/customers")
async def create_customer(body: CustomerCreate, current_user: dict = Depends(get_current_user)):
    cust_id = make_id()
    customer = {
        "id": cust_id,
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "company": body.company,
        "channels": body.channels,
        "tags": body.tags,
        "segment": body.segment,
        "avatar": "",
        "lifetime_value": 0,
        "avg_sentiment": 0.0,
        "recent_tickets": 0,
        "complaint_count": 0,
        "days_since_last_contact": 0,
        "total_conversations": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.customers.insert_one(customer)
    return clean_doc(customer)


@api.put("/customers/{customer_id}")
async def update_customer(customer_id: str, body: CustomerUpdate, current_user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.customers.update_one({"id": customer_id}, {"$set": updates})
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return customer


# ─── TICKETS ───────────────────────────────────────────────────
@api.get("/tickets")
async def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = category
    if assigned_to:
        query["assigned_to"] = assigned_to
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return tickets


@api.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@api.post("/tickets")
async def create_ticket(body: TicketCreate, current_user: dict = Depends(get_current_user)):
    ticket_id = make_id()
    ticket_number = f"TKT-{str(uuid.uuid4())[:8].upper()}"
    ticket = {
        "id": ticket_id,
        "ticket_number": ticket_number,
        "conversation_id": body.conversation_id,
        "customer_id": body.customer_id,
        "subject": body.subject,
        "description": body.description,
        "priority": body.priority,
        "category": body.category,
        "status": "open",
        "assigned_to": current_user["sub"],
        "assigned_name": current_user.get("name", ""),
        "resolution": "",
        "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=24 if body.priority == "high" else 48)).isoformat(),
        "notes": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "resolved_at": None,
    }
    await db.tickets.insert_one(ticket)
    return clean_doc(ticket)


@api.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, body: TicketUpdate, current_user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    if updates.get("status") == "resolved":
        updates["resolved_at"] = now_iso()
    await db.tickets.update_one({"id": ticket_id}, {"$set": updates})
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return ticket


@api.post("/tickets/{ticket_id}/notes")
async def add_ticket_note(ticket_id: str, content: str = Body(..., embed=True), current_user: dict = Depends(get_current_user)):
    note = {
        "id": make_id(),
        "content": content,
        "author_id": current_user["sub"],
        "author_name": current_user.get("name", ""),
        "created_at": now_iso(),
    }
    await db.tickets.update_one({"id": ticket_id}, {"$push": {"notes": note}, "$set": {"updated_at": now_iso()}})
    return note


# ─── KNOWLEDGE BASE ────────────────────────────────────────────
@api.get("/knowledge-base")
async def list_kb_docs(
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.knowledge_base.find(query, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return docs


@api.get("/knowledge-base/{doc_id}")
async def get_kb_doc(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.knowledge_base.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@api.post("/knowledge-base")
async def create_kb_doc(body: KBDocCreate, current_user: dict = Depends(get_current_user)):
    doc_id = make_id()
    doc = {
        "id": doc_id,
        "title": body.title,
        "content": body.content,
        "category": body.category,
        "tags": body.tags,
        "author_id": current_user["sub"],
        "author_name": current_user.get("name", ""),
        "views": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.knowledge_base.insert_one(doc)
    return clean_doc(doc)


@api.put("/knowledge-base/{doc_id}")
async def update_kb_doc(doc_id: str, updates: dict = Body(...), current_user: dict = Depends(get_current_user)):
    updates.pop("_id", None)
    updates["updated_at"] = now_iso()
    await db.knowledge_base.update_one({"id": doc_id}, {"$set": updates})
    doc = await db.knowledge_base.find_one({"id": doc_id}, {"_id": 0})
    return doc


@api.delete("/knowledge-base/{doc_id}")
async def delete_kb_doc(doc_id: str, current_user: dict = Depends(get_current_user)):
    await db.knowledge_base.delete_one({"id": doc_id})
    return {"status": "deleted"}


# ─── ANALYTICS ─────────────────────────────────────────────────
@api.get("/analytics/overview")
async def analytics_overview(current_user: dict = Depends(get_current_user)):
    total_convos = await db.conversations.count_documents({})
    open_convos = await db.conversations.count_documents({"status": "open"})
    total_leads = await db.leads.count_documents({})
    hot_leads = await db.leads.count_documents({"grade": "hot"})
    total_customers = await db.customers.count_documents({})
    total_tickets = await db.tickets.count_documents({})
    open_tickets = await db.tickets.count_documents({"status": "open"})
    resolved_tickets = await db.tickets.count_documents({"status": "resolved"})
    ai_handled = await db.conversations.count_documents({"ai_handled": True})
    ai_rate = (ai_handled / total_convos * 100) if total_convos > 0 else 0

    # Sentiment distribution
    positive = await db.conversations.count_documents({"sentiment_score": {"$gt": 0.3}})
    negative = await db.conversations.count_documents({"sentiment_score": {"$lt": -0.3}})
    neutral_count = total_convos - positive - negative

    # Channel distribution
    channels = {}
    for ch in ["whatsapp", "instagram", "facebook", "web_chat", "twitter"]:
        channels[ch] = await db.conversations.count_documents({"channel": ch})

    return {
        "total_conversations": total_convos,
        "open_conversations": open_convos,
        "total_leads": total_leads,
        "hot_leads": hot_leads,
        "total_customers": total_customers,
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "resolved_tickets": resolved_tickets,
        "ai_resolution_rate": round(ai_rate, 1),
        "avg_response_time": "1.2m",
        "csat_score": 4.3,
        "nps_score": 72,
        "sentiment_distribution": {"positive": positive, "neutral": neutral_count, "negative": negative},
        "channel_distribution": channels,
    }


@api.get("/analytics/conversations")
async def analytics_conversations(days: int = 30, current_user: dict = Depends(get_current_user)):
    # Generate time-series data from actual conversations
    pipeline = [
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": 1},
            "ai_handled": {"$sum": {"$cond": [{"$eq": ["$ai_handled", True]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}},
        {"$limit": days}
    ]
    results = await db.conversations.aggregate(pipeline).to_list(days)
    data = [{"date": r["_id"], "total": r["count"], "ai_handled": r["ai_handled"], "human_handled": r["count"] - r["ai_handled"]} for r in results]

    # If no data, generate sample data
    if not data:
        import random
        base = datetime.now(timezone.utc)
        data = []
        for i in range(30):
            d = base - timedelta(days=29 - i)
            total = random.randint(20, 80)
            ai = int(total * random.uniform(0.5, 0.8))
            data.append({"date": d.strftime("%Y-%m-%d"), "total": total, "ai_handled": ai, "human_handled": total - ai})

    return data


@api.get("/analytics/leads")
async def analytics_leads(current_user: dict = Depends(get_current_user)):
    pipeline_status = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    status_data = await db.leads.aggregate(pipeline_status).to_list(20)
    pipeline_source = [{"$group": {"_id": "$source", "count": {"$sum": 1}}}]
    source_data = await db.leads.aggregate(pipeline_source).to_list(20)
    pipeline_grade = [{"$group": {"_id": "$grade", "count": {"$sum": 1}}}]
    grade_data = await db.leads.aggregate(pipeline_grade).to_list(20)
    return {
        "by_status": {r["_id"]: r["count"] for r in status_data if r["_id"]},
        "by_source": {r["_id"]: r["count"] for r in source_data if r["_id"]},
        "by_grade": {r["_id"]: r["count"] for r in grade_data if r["_id"]},
    }


@api.get("/analytics/sentiment")
async def analytics_sentiment(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"sentiment": {"$ne": None}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "avg_score": {"$avg": "$sentiment.score"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 30}
    ]
    results = await db.messages.aggregate(pipeline).to_list(30)
    data = [{"date": r["_id"], "avg_sentiment": round(r["avg_score"], 2), "volume": r["count"]} for r in results]
    if not data:
        import random
        base = datetime.now(timezone.utc)
        data = [{"date": (base - timedelta(days=29 - i)).strftime("%Y-%m-%d"), "avg_sentiment": round(random.uniform(-0.3, 0.8), 2), "volume": random.randint(10, 50)} for i in range(30)]
    return data


@api.get("/analytics/agents")
async def analytics_agents(current_user: dict = Depends(get_current_user)):
    agents = await db.users.find({"role": {"$in": ["agent", "admin", "manager"]}}, {"_id": 0, "password": 0}).to_list(50)
    agent_stats = []
    for agent in agents:
        convo_count = await db.conversations.count_documents({"assigned_to": agent["id"]})
        resolved = await db.conversations.count_documents({"assigned_to": agent["id"], "status": "resolved"})
        agent_stats.append({
            "id": agent["id"],
            "name": agent["name"],
            "role": agent["role"],
            "conversations_handled": convo_count,
            "resolved": resolved,
            "resolution_rate": round((resolved / convo_count * 100) if convo_count > 0 else 0, 1),
            "avg_response_time": "2.3m",
            "csat": 4.2,
            "status": agent.get("status", "active"),
        })
    return agent_stats


# ─── SETTINGS ──────────────────────────────────────────────────
@api.get("/settings/channels")
async def get_channel_settings(current_user: dict = Depends(get_current_user)):
    channels = await db.channel_settings.find({}, {"_id": 0}).to_list(20)
    if not channels:
        defaults = [
            {"channel": "whatsapp", "enabled": False, "display_name": "WhatsApp Business", "api_key": "", "api_secret": "", "phone_number_id": "", "access_token": "", "webhook_url": "", "extra_config": {}},
            {"channel": "instagram", "enabled": False, "display_name": "Instagram", "api_key": "", "api_secret": "", "page_id": "", "access_token": "", "webhook_url": "", "extra_config": {}},
            {"channel": "facebook", "enabled": False, "display_name": "Facebook Messenger", "api_key": "", "api_secret": "", "page_id": "", "access_token": "", "webhook_url": "", "extra_config": {}},
            {"channel": "twitter", "enabled": False, "display_name": "Twitter / X", "api_key": "", "api_secret": "", "access_token": "", "webhook_url": "", "extra_config": {}},
            {"channel": "web_chat", "enabled": True, "display_name": "Web Chat Widget", "api_key": "", "api_secret": "", "webhook_url": "", "extra_config": {"widget_color": "#8b5cf6", "welcome_message": "Hi! How can we help you today?"}},
        ]
        for d in defaults:
            d["id"] = make_id()
            d["created_at"] = now_iso()
            d["updated_at"] = now_iso()
        await db.channel_settings.insert_many(defaults)
        channels = defaults
    return clean_docs(channels)


@api.put("/settings/channels/{channel}")
async def update_channel_settings(channel: str, body: ChannelSettingsUpdate, current_user: dict = Depends(require_role(["admin", "manager"]))):
    updates = body.model_dump()
    updates["updated_at"] = now_iso()
    result = await db.channel_settings.update_one({"channel": channel}, {"$set": updates})
    if result.matched_count == 0:
        updates["id"] = make_id()
        updates["created_at"] = now_iso()
        await db.channel_settings.insert_one(updates)
    setting = await db.channel_settings.find_one({"channel": channel}, {"_id": 0})
    return setting


@api.get("/settings/company")
async def get_company_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.company_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "id": make_id(),
            "company_name": "NexusEngage",
            "timezone": "UTC",
            "language": "en",
            "business_hours": {"start": "09:00", "end": "18:00", "days": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
            "ai_enabled": True,
            "ai_confidence_threshold": 0.7,
            "auto_assign": True,
            "created_at": now_iso(),
        }
        await db.company_settings.insert_one(settings)
    return clean_doc(settings)


@api.put("/settings/company")
async def update_company_settings(updates: dict = Body(...), current_user: dict = Depends(require_role(["admin"]))):
    updates.pop("_id", None)
    updates["updated_at"] = now_iso()
    await db.company_settings.update_one({}, {"$set": updates}, upsert=True)
    settings = await db.company_settings.find_one({}, {"_id": 0})
    return settings


@api.get("/settings/templates")
async def list_templates(current_user: dict = Depends(get_current_user)):
    templates = await db.templates.find({}, {"_id": 0}).to_list(200)
    return templates


@api.post("/settings/templates")
async def create_template(body: TemplateCreate, current_user: dict = Depends(get_current_user)):
    tmpl = {
        "id": make_id(),
        "name": body.name,
        "content": body.content,
        "category": body.category,
        "channel": body.channel,
        "created_by": current_user["sub"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.templates.insert_one(tmpl)
    return clean_doc(tmpl)


@api.delete("/settings/templates/{template_id}")
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    await db.templates.delete_one({"id": template_id})
    return {"status": "deleted"}


# ─── AI TOOLS ──────────────────────────────────────────────────
@api.post("/ai/sentiment")
async def ai_sentiment(text: str = Body(..., embed=True), current_user: dict = Depends(get_current_user)):
    result = await analyze_sentiment(text)
    return result


@api.post("/ai/classify")
async def ai_classify(text: str = Body(..., embed=True), current_user: dict = Depends(get_current_user)):
    result = await classify_intent(text)
    return result


# ─── WEBHOOKS (for social platforms) ───────────────────────────
@api.get("/webhooks/whatsapp")
async def whatsapp_verify(hub_mode: str = Query(None, alias="hub.mode"), hub_token: str = Query(None, alias="hub.verify_token"), hub_challenge: str = Query(None, alias="hub.challenge")):
    settings = await db.channel_settings.find_one({"channel": "whatsapp"}, {"_id": 0})
    verify_token = settings.get("extra_config", {}).get("verify_token", "nexus_verify") if settings else "nexus_verify"
    if hub_mode == "subscribe" and hub_token == verify_token:
        return int(hub_challenge) if hub_challenge else ""
    raise HTTPException(status_code=403, detail="Verification failed")


@api.post("/webhooks/whatsapp")
async def whatsapp_webhook(payload: dict = Body(...)):
    logger.info(f"WhatsApp webhook received: {payload}")
    # Process incoming WhatsApp messages
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") == "messages":
                    for msg in change.get("value", {}).get("messages", []):
                        # Create or find customer, create conversation, store message
                        phone = msg.get("from", "")
                        text = msg.get("text", {}).get("body", "")
                        if text:
                            customer = await db.customers.find_one({"phone": phone}, {"_id": 0})
                            if not customer:
                                customer = {"id": make_id(), "name": f"WhatsApp User {phone[-4:]}", "phone": phone, "email": "", "company": "", "channels": ["whatsapp"], "tags": [], "segment": "general", "avatar": "", "lifetime_value": 0, "avg_sentiment": 0.0, "recent_tickets": 0, "complaint_count": 0, "days_since_last_contact": 0, "total_conversations": 0, "created_at": now_iso(), "updated_at": now_iso()}
                                await db.customers.insert_one(customer)
                            # Find or create conversation
                            convo = await db.conversations.find_one({"customer_id": customer["id"], "channel": "whatsapp", "status": "open"}, {"_id": 0})
                            if not convo:
                                convo = {"id": make_id(), "customer_id": customer["id"], "customer_name": customer["name"], "channel": "whatsapp", "subject": f"WhatsApp: {text[:50]}", "status": "open", "priority": "medium", "assigned_to": "", "ai_handled": True, "sentiment_score": 0.0, "sentiment_label": "neutral", "message_count": 0, "last_message": text[:100], "last_message_at": now_iso(), "unread_count": 1, "tags": [], "created_at": now_iso(), "updated_at": now_iso()}
                                await db.conversations.insert_one(convo)
                            msg_doc = {"id": make_id(), "conversation_id": convo["id"], "content": text, "sender_type": "customer", "sender_id": customer["id"], "sender_name": customer["name"], "attachments": [], "read": False, "created_at": now_iso()}
                            await db.messages.insert_one(msg_doc)
    except Exception as e:
        logger.error(f"WhatsApp webhook processing error: {e}")
    return {"status": "ok"}


@api.get("/webhooks/facebook")
async def facebook_verify(hub_mode: str = Query(None, alias="hub.mode"), hub_token: str = Query(None, alias="hub.verify_token"), hub_challenge: str = Query(None, alias="hub.challenge")):
    settings = await db.channel_settings.find_one({"channel": "facebook"}, {"_id": 0})
    verify_token = settings.get("extra_config", {}).get("verify_token", "nexus_verify") if settings else "nexus_verify"
    if hub_mode == "subscribe" and hub_token == verify_token:
        return int(hub_challenge) if hub_challenge else ""
    raise HTTPException(status_code=403, detail="Verification failed")


@api.post("/webhooks/facebook")
async def facebook_webhook(payload: dict = Body(...)):
    logger.info(f"Facebook webhook received: {payload}")
    return {"status": "ok"}


@api.post("/webhooks/instagram")
async def instagram_webhook(payload: dict = Body(...)):
    logger.info(f"Instagram webhook received: {payload}")
    return {"status": "ok"}


# ─── SEED DATA ─────────────────────────────────────────────────
@api.post("/seed")
async def seed_data():
    # Check if already seeded
    existing_admin = await db.users.find_one({"email": "admin@nexusengage.com"})
    if existing_admin:
        return {"message": "Data already seeded"}

    # Create users
    users = [
        {"id": make_id(), "email": "admin@nexusengage.com", "password": hash_password("admin123"), "name": "Alex Morgan", "role": "admin", "status": "active", "avatar": "", "created_at": now_iso(), "last_login": now_iso()},
        {"id": make_id(), "email": "manager@nexusengage.com", "password": hash_password("manager123"), "name": "Sarah Chen", "role": "manager", "status": "active", "avatar": "", "created_at": now_iso(), "last_login": now_iso()},
        {"id": make_id(), "email": "agent1@nexusengage.com", "password": hash_password("agent123"), "name": "James Wilson", "role": "agent", "status": "active", "avatar": "", "created_at": now_iso(), "last_login": now_iso()},
        {"id": make_id(), "email": "agent2@nexusengage.com", "password": hash_password("agent123"), "name": "Maya Patel", "role": "agent", "status": "active", "avatar": "", "created_at": now_iso(), "last_login": now_iso()},
        {"id": make_id(), "email": "analyst@nexusengage.com", "password": hash_password("analyst123"), "name": "David Kim", "role": "analyst", "status": "active", "avatar": "", "created_at": now_iso(), "last_login": now_iso()},
    ]
    await db.users.insert_many(users)
    admin_id = users[0]["id"]
    agent1_id = users[2]["id"]
    agent2_id = users[3]["id"]

    # Create customers
    customers = [
        {"id": make_id(), "name": "Emily Johnson", "email": "emily@techcorp.com", "phone": "+1234567890", "company": "TechCorp Inc", "channels": ["whatsapp", "web_chat"], "tags": ["enterprise", "tech"], "segment": "enterprise", "avatar": "", "lifetime_value": 25000, "avg_sentiment": 0.6, "recent_tickets": 1, "complaint_count": 0, "days_since_last_contact": 2, "total_conversations": 12, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Michael Brown", "email": "michael@startup.io", "phone": "+1987654321", "company": "StartupIO", "channels": ["instagram", "facebook"], "tags": ["startup", "saas"], "segment": "growth", "avatar": "", "lifetime_value": 8500, "avg_sentiment": 0.3, "recent_tickets": 3, "complaint_count": 1, "days_since_last_contact": 5, "total_conversations": 8, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Sofia Rodriguez", "email": "sofia@globalretail.com", "phone": "+1555666777", "company": "Global Retail", "channels": ["whatsapp", "facebook", "web_chat"], "tags": ["retail", "vip"], "segment": "vip", "avatar": "", "lifetime_value": 75000, "avg_sentiment": 0.8, "recent_tickets": 0, "complaint_count": 0, "days_since_last_contact": 1, "total_conversations": 25, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Raj Patel", "email": "raj@financeplus.com", "phone": "+1444555666", "company": "FinancePlus", "channels": ["web_chat"], "tags": ["finance"], "segment": "general", "avatar": "", "lifetime_value": 5000, "avg_sentiment": -0.2, "recent_tickets": 4, "complaint_count": 2, "days_since_last_contact": 10, "total_conversations": 15, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Lisa Wang", "email": "lisa@designstudio.co", "phone": "+1333444555", "company": "Design Studio Co", "channels": ["instagram"], "tags": ["creative", "design"], "segment": "growth", "avatar": "", "lifetime_value": 12000, "avg_sentiment": 0.5, "recent_tickets": 1, "complaint_count": 0, "days_since_last_contact": 3, "total_conversations": 6, "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.customers.insert_many(customers)

    # Create conversations
    conversations = [
        {"id": make_id(), "customer_id": customers[0]["id"], "customer_name": customers[0]["name"], "channel": "whatsapp", "subject": "Integration API query", "status": "open", "priority": "high", "assigned_to": agent1_id, "assigned_name": "James Wilson", "ai_handled": False, "sentiment_score": 0.4, "sentiment_label": "neutral", "message_count": 5, "last_message": "Can you help me with the API documentation?", "last_message_at": now_iso(), "unread_count": 2, "tags": ["api", "technical"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "customer_id": customers[1]["id"], "customer_name": customers[1]["name"], "channel": "instagram", "subject": "Pricing inquiry", "status": "open", "priority": "medium", "assigned_to": agent2_id, "assigned_name": "Maya Patel", "ai_handled": True, "sentiment_score": 0.6, "sentiment_label": "satisfied", "message_count": 3, "last_message": "What plans do you offer for startups?", "last_message_at": now_iso(), "unread_count": 1, "tags": ["pricing", "sales"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "customer_id": customers[2]["id"], "customer_name": customers[2]["name"], "channel": "facebook", "subject": "VIP support request", "status": "open", "priority": "high", "assigned_to": agent1_id, "assigned_name": "James Wilson", "ai_handled": False, "sentiment_score": 0.8, "sentiment_label": "happy", "message_count": 8, "last_message": "Thank you for the quick resolution!", "last_message_at": now_iso(), "unread_count": 0, "tags": ["vip", "support"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "customer_id": customers[3]["id"], "customer_name": customers[3]["name"], "channel": "web_chat", "subject": "Billing complaint", "status": "escalated", "priority": "critical", "assigned_to": admin_id, "assigned_name": "Alex Morgan", "ai_handled": False, "sentiment_score": -0.6, "sentiment_label": "frustrated", "message_count": 12, "last_message": "I want to speak with a manager about this charge", "last_message_at": now_iso(), "unread_count": 3, "tags": ["billing", "complaint", "escalated"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "customer_id": customers[4]["id"], "customer_name": customers[4]["name"], "channel": "web_chat", "subject": "Feature request", "status": "open", "priority": "low", "assigned_to": agent2_id, "assigned_name": "Maya Patel", "ai_handled": True, "sentiment_score": 0.5, "sentiment_label": "satisfied", "message_count": 4, "last_message": "Would love to see dark mode in the next update", "last_message_at": now_iso(), "unread_count": 1, "tags": ["feature-request"], "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.conversations.insert_many(conversations)

    # Create messages for each conversation
    for convo in conversations:
        msgs = [
            {"id": make_id(), "conversation_id": convo["id"], "content": f"Hi, I need help with {convo['subject'].lower()}", "sender_type": "customer", "sender_id": convo["customer_id"], "sender_name": convo["customer_name"], "attachments": [], "read": True, "created_at": now_iso()},
            {"id": make_id(), "conversation_id": convo["id"], "content": "Hello! I'd be happy to help you with that. Let me look into this for you.", "sender_type": "ai", "sender_id": "ai-assistant", "sender_name": "AI Assistant", "attachments": [], "ai_confidence": 0.85, "read": True, "created_at": now_iso()},
            {"id": make_id(), "conversation_id": convo["id"], "content": convo["last_message"], "sender_type": "customer", "sender_id": convo["customer_id"], "sender_name": convo["customer_name"], "attachments": [], "read": False, "created_at": now_iso()},
        ]
        await db.messages.insert_many(msgs)

    # Create leads
    leads = [
        {"id": make_id(), "name": "John Smith", "email": "john@acmeinc.com", "phone": "+1222333444", "company": "Acme Inc", "source": "web_chat", "status": "qualified", "score": 85, "grade": "hot", "notes": "Interested in enterprise plan", "assigned_to": agent1_id, "assigned_name": "James Wilson", "activities": [{"type": "note", "content": "Had a great initial call", "date": now_iso()}], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Alice Wong", "email": "alice@mediaco.com", "phone": "+1888999000", "company": "MediaCo", "source": "instagram", "status": "new", "score": 45, "grade": "warm", "notes": "Inquired about social media management", "assigned_to": agent2_id, "assigned_name": "Maya Patel", "activities": [], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Carlos Mendez", "email": "carlos@buildright.com", "phone": "+1777888999", "company": "BuildRight", "source": "facebook", "status": "contacted", "score": 65, "grade": "warm", "notes": "Looking for custom integration", "assigned_to": agent1_id, "assigned_name": "James Wilson", "activities": [{"type": "call", "content": "Left voicemail", "date": now_iso()}], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Priya Sharma", "email": "priya@healthtech.io", "phone": "+1666777888", "company": "HealthTech", "source": "whatsapp", "status": "proposal", "score": 92, "grade": "hot", "notes": "Ready to close, needs pricing approval", "assigned_to": admin_id, "assigned_name": "Alex Morgan", "activities": [{"type": "meeting", "content": "Demo completed", "date": now_iso()}, {"type": "note", "content": "Sent proposal", "date": now_iso()}], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Tom Baker", "email": "tom@retailx.com", "phone": "+1555444333", "company": "RetailX", "source": "web_chat", "status": "new", "score": 30, "grade": "cold", "notes": "Just browsing", "assigned_to": "", "assigned_name": "", "activities": [], "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.leads.insert_many(leads)

    # Create tickets
    tickets = [
        {"id": make_id(), "ticket_number": "TKT-A1B2C3D4", "conversation_id": conversations[3]["id"], "customer_id": customers[3]["id"], "subject": "Incorrect billing charge", "description": "Customer was charged twice for monthly subscription", "priority": "critical", "category": "billing", "status": "open", "assigned_to": admin_id, "assigned_name": "Alex Morgan", "resolution": "", "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(), "notes": [{"id": make_id(), "content": "Investigating duplicate charge", "author_name": "Alex Morgan", "created_at": now_iso()}], "created_at": now_iso(), "updated_at": now_iso(), "resolved_at": None},
        {"id": make_id(), "ticket_number": "TKT-E5F6G7H8", "conversation_id": conversations[0]["id"], "customer_id": customers[0]["id"], "subject": "API rate limiting issue", "description": "Customer experiencing 429 errors during peak hours", "priority": "high", "category": "technical", "status": "in_progress", "assigned_to": agent1_id, "assigned_name": "James Wilson", "resolution": "", "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(), "notes": [], "created_at": now_iso(), "updated_at": now_iso(), "resolved_at": None},
        {"id": make_id(), "ticket_number": "TKT-I9J0K1L2", "conversation_id": "", "customer_id": customers[4]["id"], "subject": "Feature request: Dark mode", "description": "Customer requested dark mode for the dashboard", "priority": "low", "category": "feature_request", "status": "open", "assigned_to": agent2_id, "assigned_name": "Maya Patel", "resolution": "", "sla_deadline": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), "notes": [], "created_at": now_iso(), "updated_at": now_iso(), "resolved_at": None},
    ]
    await db.tickets.insert_many(tickets)

    # Create KB docs
    kb_docs = [
        {"id": make_id(), "title": "Getting Started Guide", "content": "Welcome to NexusEngage! This guide will help you set up your account and start engaging with customers across all channels. Step 1: Configure your channels in Settings. Step 2: Invite your team members. Step 3: Set up AI response templates. Step 4: Start conversations!", "category": "getting_started", "tags": ["onboarding", "setup"], "author_id": admin_id, "author_name": "Alex Morgan", "views": 234, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "title": "WhatsApp Business API Setup", "content": "To integrate WhatsApp Business API: 1. Create a Meta Business account. 2. Set up a WhatsApp Business Platform account. 3. Get your Phone Number ID and Access Token. 4. Configure webhooks in Settings > Channels > WhatsApp. 5. Set your verify token for webhook verification.", "category": "integration", "tags": ["whatsapp", "api", "setup"], "author_id": admin_id, "author_name": "Alex Morgan", "views": 156, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "title": "AI Response Configuration", "content": "Configure how the AI responds to customer queries: 1. Set confidence thresholds in Company Settings. 2. Create response templates for common queries. 3. Add knowledge base articles for AI to reference. 4. Set escalation rules for complex queries. The AI uses sentiment analysis and intent classification to determine the best response.", "category": "ai", "tags": ["ai", "configuration", "responses"], "author_id": admin_id, "author_name": "Alex Morgan", "views": 189, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "title": "Lead Scoring Guide", "content": "Understanding lead scores: Hot (80-100): Ready to buy, prioritize immediate follow-up. Warm (40-79): Interested but needs nurturing. Cold (0-39): Early stage, add to nurture campaigns. Scores are calculated based on engagement, stated intent, and behavioral signals.", "category": "sales", "tags": ["leads", "scoring", "sales"], "author_id": admin_id, "author_name": "Alex Morgan", "views": 98, "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.knowledge_base.insert_many(kb_docs)

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.conversations.create_index("id", unique=True)
    await db.conversations.create_index("customer_id")
    await db.conversations.create_index("channel")
    await db.conversations.create_index("status")
    await db.messages.create_index("conversation_id")
    await db.leads.create_index("id", unique=True)
    await db.customers.create_index("id", unique=True)
    await db.customers.create_index("email")
    await db.tickets.create_index("id", unique=True)

    return {"message": "Seed data created successfully", "users": len(users), "customers": len(customers), "conversations": len(conversations), "leads": len(leads), "tickets": len(tickets), "kb_docs": len(kb_docs)}


# ─── DASHBOARD FEED ────────────────────────────────────────────
@api.get("/dashboard/feed")
async def dashboard_feed(current_user: dict = Depends(get_current_user)):
    recent_convos = await db.conversations.find({}, {"_id": 0}).sort("updated_at", -1).limit(5).to_list(5)
    recent_leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_tickets = await db.tickets.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return {
        "recent_conversations": recent_convos,
        "recent_leads": recent_leads,
        "recent_tickets": recent_tickets,
    }


# Include router
app.include_router(api)


@app.on_event("startup")
async def startup():
    logger.info("NexusEngage AI Platform starting up...")
    # Auto-seed on first start
    existing = await db.users.find_one({"email": "admin@nexusengage.com"})
    if not existing:
        logger.info("No seed data found, seeding...")
        # Call seed through direct logic
        from auth_utils import hash_password as hp
        users = [
            {"id": make_id(), "email": "admin@nexusengage.com", "password": hp("admin123"), "name": "Alex Morgan", "role": "admin", "status": "active", "avatar": "", "created_at": now_iso(), "last_login": now_iso()},
        ]
        await db.users.insert_many(users)
        logger.info("Admin user seeded")


@app.on_event("shutdown")
async def shutdown():
    from database import client
    client.close()
