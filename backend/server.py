from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, Body, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging
import os
import httpx
import socketio

from database import db
from auth_utils import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, get_current_user,
    require_role
)
from ai_service import (
    generate_ai_response, analyze_sentiment, classify_intent,
    generate_lead_score, summarize_conversation, calculate_churn_risk,
    generate_nurture_message, get_company_knowledge
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── SOCKET.IO SETUP ──────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

fastapi_app = FastAPI(title="Pulse Engine AI Platform")
app = socketio.ASGIApp(sio, other_app=fastapi_app)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

WHATSAPP_PHONE_ID = os.environ.get('WHATSAPP_PHONE_NUMBER_ID', '')
WHATSAPP_TOKEN = os.environ.get('WHATSAPP_ACCESS_TOKEN', '')


# ─── SOCKET.IO EVENTS ─────────────────────────────────────────
connected_users = {}

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket connected: {sid}")

@sio.event
async def disconnect(sid):
    # Remove from connected users
    for uid, s in list(connected_users.items()):
        if s == sid:
            del connected_users[uid]
    logger.info(f"Socket disconnected: {sid}")

@sio.event
async def join(sid, data):
    user_id = data.get('user_id', '')
    if user_id:
        connected_users[user_id] = sid
        logger.info(f"User {user_id} joined as {sid}")

@sio.event
async def join_conversation(sid, data):
    convo_id = data.get('conversation_id', '')
    if convo_id:
        await sio.enter_room(sid, f"convo_{convo_id}")

@sio.event
async def leave_conversation(sid, data):
    convo_id = data.get('conversation_id', '')
    if convo_id:
        await sio.leave_room(sid, f"convo_{convo_id}")

async def emit_new_message(conversation_id: str, message: dict):
    """Broadcast new message to all users in the conversation room"""
    try:
        await sio.emit('new_message', {'conversation_id': conversation_id, 'message': message}, room=f"convo_{conversation_id}")
        await sio.emit('conversation_updated', {'conversation_id': conversation_id}, room=None)
    except Exception as e:
        logger.error(f"Socket emit error: {e}")


# ─── PYDANTIC MODELS ──────────────────────────────────────────
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str
    role: str = "admin"
    company_name: str = ""
    company_industry: str = ""
    company_size: str = ""
    phone: str = ""

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


# ─── GOOGLE AUTH (Emergent) ────────────────────────────────────
async def get_current_user_flexible(request: Request):
    """Support both JWT Bearer token AND session cookie auth"""
    # Try session cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one(
            {"session_token": session_token}, {"_id": 0}
        )
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at and expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one(
                    {"id": session["user_id"]}, {"_id": 0, "password": 0}
                )
                if user:
                    return {"sub": user["id"], "email": user.get("email", ""), "role": user.get("role", "agent"), "name": user.get("name", ""), "company_id": user.get("company_id", "")}

    # Try JWT Bearer token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = decode_token(token)
        if payload and payload.get("sub"):
            return payload

    raise HTTPException(status_code=401, detail="Not authenticated")


@api.post("/auth/session")
async def process_google_session(request: Request, response: Response, session_id: str = Body(..., embed=True)):
    """Exchange Emergent Google Auth session_id for local session"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            google_data = resp.json()
    except httpx.RequestError as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Auth service unavailable")

    email = google_data.get("email", "")
    name = google_data.get("name", "")
    picture = google_data.get("picture", "")
    session_token = google_data.get("session_token", "")

    # Find or create user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["id"]
        await db.users.update_one({"id": user_id}, {"$set": {
            "name": name, "avatar": picture, "last_login": now_iso(),
            "auth_provider": "google"
        }})
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    else:
        user_id = make_id()
        # Create default company for Google auth users
        company_id = make_id()
        company = {
            "id": company_id,
            "name": f"{name}'s Company",
            "industry": "",
            "size": "1-10",
            "plan": "free",
            "created_at": now_iso(),
        }
        await db.companies.insert_one(company)
        user = {
            "id": user_id,
            "email": email,
            "password": "",
            "name": name,
            "role": "admin",
            "status": "active",
            "avatar": picture,
            "company_id": company_id,
            "auth_provider": "google",
            "created_at": now_iso(),
            "last_login": now_iso(),
        }
        await db.users.insert_one(user)
        user = {k: v for k, v in user.items() if k not in ("password", "_id")}

    # Create session
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now_iso(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        path="/",
        secure=True,
        httponly=True,
        samesite="none",
        max_age=7 * 24 * 3600,
    )

    # Also return JWT for backwards compatibility
    token_data = {"sub": user_id, "email": email, "role": user.get("role", "admin"), "name": name, "company_id": user.get("company_id", "")}
    jwt_token = create_access_token(token_data)

    return {
        "user": {k: v for k, v in user.items() if k not in ("password", "_id")},
        "token": jwt_token,
        "session_token": session_token,
    }


@api.get("/auth/me")
async def get_me(request: Request):
    current_user = await get_current_user_flexible(request)
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Get company info
    if user.get("company_id"):
        company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
        user["company"] = company
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/", secure=True, httponly=True, samesite="none")
    return {"status": "logged out"}


# ─── AUTH ROUTES ───────────────────────────────────────────────
@api.post("/auth/register")
async def register(body: RegisterInput):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create company
    company_id = make_id()
    company = {
        "id": company_id,
        "name": body.company_name or f"{body.name}'s Company",
        "industry": body.company_industry,
        "size": body.company_size,
        "phone": body.phone,
        "plan": "free",
        "created_at": now_iso(),
    }
    await db.companies.insert_one(company)

    user_id = make_id()
    user = {
        "id": user_id,
        "email": body.email,
        "password": hash_password(body.password),
        "name": body.name,
        "role": body.role if body.role in ["admin", "manager", "agent", "analyst"] else "admin",
        "status": "active",
        "avatar": "",
        "company_id": company_id,
        "auth_provider": "email",
        "created_at": now_iso(),
        "last_login": now_iso(),
    }
    await db.users.insert_one(user)
    token_data = {"sub": user_id, "email": body.email, "role": user["role"], "name": body.name, "company_id": company_id}
    return {
        "token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": {"id": user_id, "email": body.email, "name": body.name, "role": user["role"], "company_id": company_id}
    }


@api.post("/auth/login")
async def login(body: LoginInput):
    user = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not user or not user.get("password") or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": now_iso()}})
    token_data = {"sub": user["id"], "email": user["email"], "role": user["role"], "name": user["name"], "company_id": user.get("company_id", "")}
    return {
        "token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "avatar": user.get("avatar", ""), "company_id": user.get("company_id", "")}
    }


@api.post("/auth/refresh")
async def refresh_token(refresh_token: str = Body(..., embed=True)):
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    new_data = {"sub": payload["sub"], "email": payload["email"], "role": payload["role"], "name": payload["name"], "company_id": payload.get("company_id", "")}
    return {"token": create_access_token(new_data), "refresh_token": create_refresh_token(new_data)}


# ─── USERS ─────────────────────────────────────────────────────
@api.get("/users")
async def list_users(request: Request):
    current_user = await get_current_user_flexible(request)
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(500)
    return users


@api.put("/users/{user_id}")
async def update_user(user_id: str, request: Request, updates: dict = Body(...)):
    current_user = await get_current_user_flexible(request)
    updates.pop("password", None)
    updates.pop("_id", None)
    updates["updated_at"] = now_iso()
    await db.users.update_one({"id": user_id}, {"$set": updates})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return user


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await db.users.delete_one({"id": user_id})
    return {"status": "deleted"}


# ─── CONVERSATIONS ─────────────────────────────────────────────
@api.get("/conversations")
async def list_conversations(
    request: Request,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
):
    current_user = await get_current_user_flexible(request)
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
async def get_conversation(convo_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    convo = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return convo


@api.post("/conversations")
async def create_conversation(body: ConversationCreate, request: Request):
    current_user = await get_current_user_flexible(request)
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
async def update_conversation(convo_id: str, request: Request, updates: dict = Body(...)):
    current_user = await get_current_user_flexible(request)
    updates.pop("_id", None)
    updates["updated_at"] = now_iso()
    await db.conversations.update_one({"id": convo_id}, {"$set": updates})
    convo = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    return convo


@api.get("/conversations/{convo_id}/messages")
async def get_messages(convo_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    messages = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return messages


@api.post("/conversations/{convo_id}/messages")
async def send_message(convo_id: str, body: MessageCreate, request: Request):
    current_user = await get_current_user_flexible(request)
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

    if body.sender_type == "customer":
        try:
            sentiment = await analyze_sentiment(body.content)
            message["sentiment"] = sentiment
            intent = await classify_intent(body.content)
            message["intent"] = intent
            await db.conversations.update_one({"id": convo_id}, {"$set": {
                "sentiment_score": sentiment["score"],
                "sentiment_label": sentiment["emotion"],
            }})
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")

    await db.messages.insert_one(message)
    await db.conversations.update_one({"id": convo_id}, {"$set": {
        "last_message": body.content[:100],
        "last_message_at": now_iso(),
        "updated_at": now_iso(),
        "message_count": convo.get("message_count", 0) + 1,
    }, "$inc": {"unread_count": 1 if body.sender_type == "customer" else 0}})

    clean_doc(message)

    # Emit WebSocket event
    await emit_new_message(convo_id, message)

    # Send via WhatsApp if channel is whatsapp and sender is agent
    if body.sender_type == "agent" and convo.get("channel") == "whatsapp":
        customer = await db.customers.find_one({"id": convo.get("customer_id", "")}, {"_id": 0})
        if customer and customer.get("phone"):
            await send_whatsapp_message(customer["phone"], body.content)

    ai_response = None
    if body.sender_type == "customer" and convo.get("ai_handled", True):
        try:
            messages_history = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
            customer = await db.customers.find_one({"id": convo.get("customer_id", "")}, {"_id": 0})
            result = await generate_ai_response(messages_history, customer, db=db)
            if result["confidence"] > 0.6:
                ai_msg_id = make_id()
                ai_message = {
                    "id": ai_msg_id, "conversation_id": convo_id, "content": result["response"],
                    "sender_type": "ai", "sender_id": "ai-assistant", "sender_name": "AI Assistant",
                    "attachments": [], "ai_confidence": result["confidence"], "read": False, "created_at": now_iso(),
                }
                await db.messages.insert_one(ai_message)
                await db.conversations.update_one({"id": convo_id}, {"$set": {
                    "last_message": result["response"][:100], "last_message_at": now_iso(),
                    "message_count": convo.get("message_count", 0) + 2, "ai_handled": True,
                }})
                ai_response = clean_doc(ai_message)
                await emit_new_message(convo_id, ai_response)

                # Send AI response via WhatsApp if applicable
                if convo.get("channel") == "whatsapp" and customer and customer.get("phone"):
                    await send_whatsapp_message(customer["phone"], result["response"])
        except Exception as e:
            logger.error(f"AI response failed: {e}")

    return {"message": message, "ai_response": ai_response}


@api.post("/conversations/{convo_id}/ai-respond")
async def trigger_ai_response(convo_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    convo = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages_history = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    customer = await db.customers.find_one({"id": convo.get("customer_id", "")}, {"_id": 0})
    result = await generate_ai_response(messages_history, customer)
    ai_msg_id = make_id()
    ai_message = {
        "id": ai_msg_id, "conversation_id": convo_id, "content": result["response"],
        "sender_type": "ai", "sender_id": "ai-assistant", "sender_name": "AI Assistant",
        "attachments": [], "ai_confidence": result["confidence"], "read": False, "created_at": now_iso(),
    }
    await db.messages.insert_one(ai_message)
    await db.conversations.update_one({"id": convo_id}, {"$set": {
        "last_message": result["response"][:100], "last_message_at": now_iso(), "updated_at": now_iso(),
    }, "$inc": {"message_count": 1}})
    return clean_doc(ai_message)


@api.post("/conversations/{convo_id}/summarize")
async def get_conversation_summary(convo_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    messages = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    summary = await summarize_conversation(messages)
    return {"summary": summary}


# ─── LEADS ─────────────────────────────────────────────────────
@api.get("/leads")
async def list_leads(request: Request, status: Optional[str] = None, grade: Optional[str] = None, source: Optional[str] = None, search: Optional[str] = None):
    current_user = await get_current_user_flexible(request)
    query = {}
    if status: query["status"] = status
    if grade: query["grade"] = grade
    if source: query["source"] = source
    if search: query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}, {"company": {"$regex": search, "$options": "i"}}]
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return leads


@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead: raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@api.post("/leads")
async def create_lead(body: LeadCreate, request: Request):
    current_user = await get_current_user_flexible(request)
    lead_id = make_id()
    lead = {"id": lead_id, "name": body.name, "email": body.email, "phone": body.phone, "company": body.company, "source": body.source, "status": body.status, "score": 50, "grade": "warm", "notes": body.notes, "assigned_to": current_user["sub"], "assigned_name": current_user.get("name", ""), "activities": [], "created_at": now_iso(), "updated_at": now_iso()}
    await db.leads.insert_one(lead)
    return clean_doc(lead)


@api.put("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadUpdate, request: Request):
    current_user = await get_current_user_flexible(request)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    await db.leads.delete_one({"id": lead_id})
    return {"status": "deleted"}


@api.post("/leads/{lead_id}/score")
async def score_lead(lead_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead: raise HTTPException(status_code=404, detail="Lead not found")
    result = await generate_lead_score(lead)
    await db.leads.update_one({"id": lead_id}, {"$set": {"score": result.get("score", 50), "grade": result.get("grade", "warm"), "scoring_reason": result.get("reasoning", ""), "next_action": result.get("next_action", ""), "updated_at": now_iso()}})
    updated = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


# ─── CUSTOMERS ─────────────────────────────────────────────────
@api.get("/customers")
async def list_customers(request: Request, segment: Optional[str] = None, search: Optional[str] = None):
    current_user = await get_current_user_flexible(request)
    query = {}
    if segment: query["segment"] = segment
    if search: query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return customers


@api.get("/customers/{customer_id}")
async def get_customer(customer_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer: raise HTTPException(status_code=404, detail="Customer not found")
    convo_count = await db.conversations.count_documents({"customer_id": customer_id})
    customer["conversation_count"] = convo_count
    customer["churn_risk"] = calculate_churn_risk(customer)
    return customer


@api.post("/customers")
async def create_customer(body: CustomerCreate, request: Request):
    current_user = await get_current_user_flexible(request)
    cust_id = make_id()
    customer = {"id": cust_id, "name": body.name, "email": body.email, "phone": body.phone, "company": body.company, "channels": body.channels, "tags": body.tags, "segment": body.segment, "avatar": "", "lifetime_value": 0, "avg_sentiment": 0.0, "recent_tickets": 0, "complaint_count": 0, "days_since_last_contact": 0, "total_conversations": 0, "created_at": now_iso(), "updated_at": now_iso()}
    await db.customers.insert_one(customer)
    return clean_doc(customer)


@api.put("/customers/{customer_id}")
async def update_customer(customer_id: str, body: CustomerUpdate, request: Request):
    current_user = await get_current_user_flexible(request)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.customers.update_one({"id": customer_id}, {"$set": updates})
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return customer


# ─── TICKETS ───────────────────────────────────────────────────
@api.get("/tickets")
async def list_tickets(request: Request, status: Optional[str] = None, priority: Optional[str] = None, category: Optional[str] = None, assigned_to: Optional[str] = None):
    current_user = await get_current_user_flexible(request)
    query = {}
    if status: query["status"] = status
    if priority: query["priority"] = priority
    if category: query["category"] = category
    if assigned_to: query["assigned_to"] = assigned_to
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return tickets


@api.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@api.post("/tickets")
async def create_ticket(body: TicketCreate, request: Request):
    current_user = await get_current_user_flexible(request)
    ticket_id = make_id()
    ticket_number = f"TKT-{str(uuid.uuid4())[:8].upper()}"
    ticket = {"id": ticket_id, "ticket_number": ticket_number, "conversation_id": body.conversation_id, "customer_id": body.customer_id, "subject": body.subject, "description": body.description, "priority": body.priority, "category": body.category, "status": "open", "assigned_to": current_user["sub"], "assigned_name": current_user.get("name", ""), "resolution": "", "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=24 if body.priority == "high" else 48)).isoformat(), "notes": [], "created_at": now_iso(), "updated_at": now_iso(), "resolved_at": None}
    await db.tickets.insert_one(ticket)
    return clean_doc(ticket)


@api.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, body: TicketUpdate, request: Request):
    current_user = await get_current_user_flexible(request)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    if updates.get("status") == "resolved": updates["resolved_at"] = now_iso()
    await db.tickets.update_one({"id": ticket_id}, {"$set": updates})
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return ticket


@api.post("/tickets/{ticket_id}/notes")
async def add_ticket_note(ticket_id: str, request: Request, content: str = Body(..., embed=True)):
    current_user = await get_current_user_flexible(request)
    note = {"id": make_id(), "content": content, "author_id": current_user["sub"], "author_name": current_user.get("name", ""), "created_at": now_iso()}
    await db.tickets.update_one({"id": ticket_id}, {"$push": {"notes": note}, "$set": {"updated_at": now_iso()}})
    return note


# ─── KNOWLEDGE BASE ────────────────────────────────────────────
@api.get("/knowledge-base")
async def list_kb_docs(request: Request, category: Optional[str] = None, search: Optional[str] = None):
    current_user = await get_current_user_flexible(request)
    query = {}
    if category: query["category"] = category
    if search: query["$or"] = [{"title": {"$regex": search, "$options": "i"}}, {"content": {"$regex": search, "$options": "i"}}]
    docs = await db.knowledge_base.find(query, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return docs


@api.get("/knowledge-base/{doc_id}")
async def get_kb_doc(doc_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    doc = await db.knowledge_base.find_one({"id": doc_id}, {"_id": 0})
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    return doc


@api.post("/knowledge-base")
async def create_kb_doc(body: KBDocCreate, request: Request):
    current_user = await get_current_user_flexible(request)
    doc_id = make_id()
    doc = {"id": doc_id, "title": body.title, "content": body.content, "category": body.category, "tags": body.tags, "author_id": current_user["sub"], "author_name": current_user.get("name", ""), "views": 0, "created_at": now_iso(), "updated_at": now_iso()}
    await db.knowledge_base.insert_one(doc)
    return clean_doc(doc)


@api.put("/knowledge-base/{doc_id}")
async def update_kb_doc(doc_id: str, request: Request, updates: dict = Body(...)):
    current_user = await get_current_user_flexible(request)
    updates.pop("_id", None)
    updates["updated_at"] = now_iso()
    await db.knowledge_base.update_one({"id": doc_id}, {"$set": updates})
    doc = await db.knowledge_base.find_one({"id": doc_id}, {"_id": 0})
    return doc


@api.delete("/knowledge-base/{doc_id}")
async def delete_kb_doc(doc_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    await db.knowledge_base.delete_one({"id": doc_id})
    return {"status": "deleted"}


# ─── ANALYTICS ─────────────────────────────────────────────────
@api.get("/analytics/overview")
async def analytics_overview(request: Request):
    current_user = await get_current_user_flexible(request)
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
    positive = await db.conversations.count_documents({"sentiment_score": {"$gt": 0.3}})
    negative = await db.conversations.count_documents({"sentiment_score": {"$lt": -0.3}})
    neutral_count = total_convos - positive - negative
    channels = {}
    for ch in ["whatsapp", "instagram", "facebook", "web_chat", "twitter"]:
        channels[ch] = await db.conversations.count_documents({"channel": ch})
    return {"total_conversations": total_convos, "open_conversations": open_convos, "total_leads": total_leads, "hot_leads": hot_leads, "total_customers": total_customers, "total_tickets": total_tickets, "open_tickets": open_tickets, "resolved_tickets": resolved_tickets, "ai_resolution_rate": round(ai_rate, 1), "avg_response_time": "1.2m", "csat_score": 4.3, "nps_score": 72, "sentiment_distribution": {"positive": positive, "neutral": neutral_count, "negative": negative}, "channel_distribution": channels}


@api.get("/analytics/conversations")
async def analytics_conversations(request: Request, days: int = 30):
    current_user = await get_current_user_flexible(request)
    pipeline = [{"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "count": {"$sum": 1}, "ai_handled": {"$sum": {"$cond": [{"$eq": ["$ai_handled", True]}, 1, 0]}}}}, {"$sort": {"_id": 1}}, {"$limit": days}]
    results = await db.conversations.aggregate(pipeline).to_list(days)
    data = [{"date": r["_id"], "total": r["count"], "ai_handled": r["ai_handled"], "human_handled": r["count"] - r["ai_handled"]} for r in results]
    if not data:
        import random
        base = datetime.now(timezone.utc)
        data = [{"date": (base - timedelta(days=29 - i)).strftime("%Y-%m-%d"), "total": random.randint(20, 80), "ai_handled": random.randint(10, 50), "human_handled": random.randint(10, 30)} for i in range(30)]
    return data


@api.get("/analytics/leads")
async def analytics_leads(request: Request):
    current_user = await get_current_user_flexible(request)
    status_data = await db.leads.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]).to_list(20)
    source_data = await db.leads.aggregate([{"$group": {"_id": "$source", "count": {"$sum": 1}}}]).to_list(20)
    grade_data = await db.leads.aggregate([{"$group": {"_id": "$grade", "count": {"$sum": 1}}}]).to_list(20)
    return {"by_status": {r["_id"]: r["count"] for r in status_data if r["_id"]}, "by_source": {r["_id"]: r["count"] for r in source_data if r["_id"]}, "by_grade": {r["_id"]: r["count"] for r in grade_data if r["_id"]}}


@api.get("/analytics/sentiment")
async def analytics_sentiment(request: Request):
    current_user = await get_current_user_flexible(request)
    pipeline = [{"$match": {"sentiment": {"$ne": None}}}, {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "avg_score": {"$avg": "$sentiment.score"}, "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}, {"$limit": 30}]
    results = await db.messages.aggregate(pipeline).to_list(30)
    data = [{"date": r["_id"], "avg_sentiment": round(r["avg_score"], 2), "volume": r["count"]} for r in results]
    if not data:
        import random
        base = datetime.now(timezone.utc)
        data = [{"date": (base - timedelta(days=29 - i)).strftime("%Y-%m-%d"), "avg_sentiment": round(random.uniform(-0.3, 0.8), 2), "volume": random.randint(10, 50)} for i in range(30)]
    return data


@api.get("/analytics/agents")
async def analytics_agents(request: Request):
    current_user = await get_current_user_flexible(request)
    agents = await db.users.find({"role": {"$in": ["agent", "admin", "manager"]}}, {"_id": 0, "password": 0}).to_list(50)
    agent_stats = []
    for agent in agents:
        convo_count = await db.conversations.count_documents({"assigned_to": agent["id"]})
        resolved = await db.conversations.count_documents({"assigned_to": agent["id"], "status": "resolved"})
        agent_stats.append({"id": agent["id"], "name": agent["name"], "role": agent["role"], "conversations_handled": convo_count, "resolved": resolved, "resolution_rate": round((resolved / convo_count * 100) if convo_count > 0 else 0, 1), "avg_response_time": "2.3m", "csat": 4.2, "status": agent.get("status", "active")})
    return agent_stats


# ─── SETTINGS ──────────────────────────────────────────────────
@api.get("/settings/channels")
async def get_channel_settings(request: Request):
    current_user = await get_current_user_flexible(request)
    channels = await db.channel_settings.find({}, {"_id": 0}).to_list(20)
    if not channels:
        defaults = [
            {"channel": "whatsapp", "enabled": False, "display_name": "WhatsApp Business", "api_key": "", "api_secret": "", "phone_number_id": "", "access_token": "", "webhook_url": "", "extra_config": {}},
            {"channel": "instagram", "enabled": False, "display_name": "Instagram", "api_key": "", "api_secret": "", "page_id": "", "access_token": "", "webhook_url": "", "extra_config": {}},
            {"channel": "facebook", "enabled": False, "display_name": "Facebook Messenger", "api_key": "", "api_secret": "", "page_id": "", "access_token": "", "webhook_url": "", "extra_config": {}},
            {"channel": "twitter", "enabled": False, "display_name": "Twitter / X", "api_key": "", "api_secret": "", "access_token": "", "webhook_url": "", "extra_config": {}},
            {"channel": "web_chat", "enabled": True, "display_name": "Web Chat Widget", "api_key": "", "api_secret": "", "webhook_url": "", "extra_config": {"widget_color": "#2563eb", "welcome_message": "Hi! How can we help you today?"}},
        ]
        for d in defaults:
            d["id"] = make_id()
            d["created_at"] = now_iso()
            d["updated_at"] = now_iso()
        await db.channel_settings.insert_many(defaults)
        channels = defaults
    return clean_docs(channels)


@api.put("/settings/channels/{channel}")
async def update_channel_settings(channel: str, body: ChannelSettingsUpdate, request: Request):
    current_user = await get_current_user_flexible(request)
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
async def get_company_settings(request: Request):
    current_user = await get_current_user_flexible(request)
    settings = await db.company_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {"id": make_id(), "company_name": "Pulse Engine", "timezone": "UTC", "language": "en", "business_hours": {"start": "09:00", "end": "18:00", "days": ["Mon", "Tue", "Wed", "Thu", "Fri"]}, "ai_enabled": True, "ai_confidence_threshold": 0.7, "auto_assign": True, "created_at": now_iso()}
        await db.company_settings.insert_one(settings)
    return clean_doc(settings)


@api.put("/settings/company")
async def update_company_settings(request: Request, updates: dict = Body(...)):
    current_user = await get_current_user_flexible(request)
    updates.pop("_id", None)
    updates["updated_at"] = now_iso()
    await db.company_settings.update_one({}, {"$set": updates}, upsert=True)
    settings = await db.company_settings.find_one({}, {"_id": 0})
    return settings


@api.get("/settings/templates")
async def list_templates(request: Request):
    current_user = await get_current_user_flexible(request)
    templates = await db.templates.find({}, {"_id": 0}).to_list(200)
    return templates


@api.post("/settings/templates")
async def create_template(body: TemplateCreate, request: Request):
    current_user = await get_current_user_flexible(request)
    tmpl = {"id": make_id(), "name": body.name, "content": body.content, "category": body.category, "channel": body.channel, "created_by": current_user["sub"], "created_at": now_iso(), "updated_at": now_iso()}
    await db.templates.insert_one(tmpl)
    return clean_doc(tmpl)


@api.delete("/settings/templates/{template_id}")
async def delete_template(template_id: str, request: Request):
    current_user = await get_current_user_flexible(request)
    await db.templates.delete_one({"id": template_id})
    return {"status": "deleted"}


# ─── AI TOOLS ──────────────────────────────────────────────────
@api.post("/ai/sentiment")
async def ai_sentiment(request: Request, text: str = Body(..., embed=True)):
    current_user = await get_current_user_flexible(request)
    return await analyze_sentiment(text)


@api.post("/ai/classify")
async def ai_classify(request: Request, text: str = Body(..., embed=True)):
    current_user = await get_current_user_flexible(request)
    return await classify_intent(text)


# ─── WEBHOOKS ──────────────────────────────────────────────────
@api.get("/webhooks/whatsapp")
async def whatsapp_verify(hub_mode: str = Query(None, alias="hub.mode"), hub_token: str = Query(None, alias="hub.verify_token"), hub_challenge: str = Query(None, alias="hub.challenge")):
    settings = await db.channel_settings.find_one({"channel": "whatsapp"}, {"_id": 0})
    verify_token = settings.get("extra_config", {}).get("verify_token", "nexus_verify") if settings else "nexus_verify"
    if hub_mode == "subscribe" and hub_token == verify_token:
        return int(hub_challenge) if hub_challenge else ""
    raise HTTPException(status_code=403, detail="Verification failed")


@api.post("/webhooks/whatsapp")
async def whatsapp_webhook(payload: dict = Body(...)):
    logger.info(f"WhatsApp webhook received")
    return {"status": "ok"}


@api.get("/webhooks/facebook")
async def facebook_verify(hub_mode: str = Query(None, alias="hub.mode"), hub_token: str = Query(None, alias="hub.verify_token"), hub_challenge: str = Query(None, alias="hub.challenge")):
    if hub_mode == "subscribe":
        return int(hub_challenge) if hub_challenge else ""
    raise HTTPException(status_code=403, detail="Verification failed")


@api.post("/webhooks/facebook")
async def facebook_webhook(payload: dict = Body(...)):
    return {"status": "ok"}


@api.post("/webhooks/instagram")
async def instagram_webhook(payload: dict = Body(...)):
    return {"status": "ok"}


# ─── SEED DATA ─────────────────────────────────────────────────
@api.post("/seed")
async def seed_data():
    existing_admin = await db.users.find_one({"email": "admin@pulseengine.com"})
    if existing_admin:
        return {"message": "Data already seeded"}

    company_id = make_id()
    await db.companies.insert_one({"id": company_id, "name": "Pulse Engine Demo", "industry": "Technology", "size": "50-200", "plan": "enterprise", "created_at": now_iso()})

    users = [
        {"id": make_id(), "email": "admin@pulseengine.com", "password": hash_password("admin123"), "name": "Alex Morgan", "role": "admin", "status": "active", "avatar": "", "company_id": company_id, "auth_provider": "email", "created_at": now_iso(), "last_login": now_iso()},
        {"id": make_id(), "email": "manager@pulseengine.com", "password": hash_password("manager123"), "name": "Sarah Chen", "role": "manager", "status": "active", "avatar": "", "company_id": company_id, "auth_provider": "email", "created_at": now_iso(), "last_login": now_iso()},
        {"id": make_id(), "email": "agent1@pulseengine.com", "password": hash_password("agent123"), "name": "James Wilson", "role": "agent", "status": "active", "avatar": "", "company_id": company_id, "auth_provider": "email", "created_at": now_iso(), "last_login": now_iso()},
        {"id": make_id(), "email": "agent2@pulseengine.com", "password": hash_password("agent123"), "name": "Maya Patel", "role": "agent", "status": "active", "avatar": "", "company_id": company_id, "auth_provider": "email", "created_at": now_iso(), "last_login": now_iso()},
        {"id": make_id(), "email": "analyst@pulseengine.com", "password": hash_password("analyst123"), "name": "David Kim", "role": "analyst", "status": "active", "avatar": "", "company_id": company_id, "auth_provider": "email", "created_at": now_iso(), "last_login": now_iso()},
    ]
    await db.users.insert_many(users)
    admin_id, agent1_id, agent2_id = users[0]["id"], users[2]["id"], users[3]["id"]

    customers = [
        {"id": make_id(), "name": "Emily Johnson", "email": "emily@techcorp.com", "phone": "+1234567890", "company": "TechCorp Inc", "channels": ["whatsapp", "web_chat"], "tags": ["enterprise", "tech"], "segment": "enterprise", "avatar": "", "lifetime_value": 25000, "avg_sentiment": 0.6, "recent_tickets": 1, "complaint_count": 0, "days_since_last_contact": 2, "total_conversations": 12, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Michael Brown", "email": "michael@startup.io", "phone": "+1987654321", "company": "StartupIO", "channels": ["instagram", "facebook"], "tags": ["startup", "saas"], "segment": "growth", "avatar": "", "lifetime_value": 8500, "avg_sentiment": 0.3, "recent_tickets": 3, "complaint_count": 1, "days_since_last_contact": 5, "total_conversations": 8, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Sofia Rodriguez", "email": "sofia@globalretail.com", "phone": "+1555666777", "company": "Global Retail", "channels": ["whatsapp", "facebook", "web_chat"], "tags": ["retail", "vip"], "segment": "vip", "avatar": "", "lifetime_value": 75000, "avg_sentiment": 0.8, "recent_tickets": 0, "complaint_count": 0, "days_since_last_contact": 1, "total_conversations": 25, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Raj Patel", "email": "raj@financeplus.com", "phone": "+1444555666", "company": "FinancePlus", "channels": ["web_chat"], "tags": ["finance"], "segment": "general", "avatar": "", "lifetime_value": 5000, "avg_sentiment": -0.2, "recent_tickets": 4, "complaint_count": 2, "days_since_last_contact": 10, "total_conversations": 15, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Lisa Wang", "email": "lisa@designstudio.co", "phone": "+1333444555", "company": "Design Studio Co", "channels": ["instagram"], "tags": ["creative", "design"], "segment": "growth", "avatar": "", "lifetime_value": 12000, "avg_sentiment": 0.5, "recent_tickets": 1, "complaint_count": 0, "days_since_last_contact": 3, "total_conversations": 6, "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.customers.insert_many(customers)

    conversations = [
        {"id": make_id(), "customer_id": customers[0]["id"], "customer_name": "Emily Johnson", "channel": "whatsapp", "subject": "Integration API query", "status": "open", "priority": "high", "assigned_to": agent1_id, "assigned_name": "James Wilson", "ai_handled": False, "sentiment_score": 0.4, "sentiment_label": "neutral", "message_count": 5, "last_message": "Can you help me with the API documentation?", "last_message_at": now_iso(), "unread_count": 2, "tags": ["api", "technical"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "customer_id": customers[1]["id"], "customer_name": "Michael Brown", "channel": "facebook", "subject": "Pricing inquiry", "status": "open", "priority": "medium", "assigned_to": agent2_id, "assigned_name": "Maya Patel", "ai_handled": True, "sentiment_score": 0.6, "sentiment_label": "satisfied", "message_count": 3, "last_message": "What plans do you offer for startups?", "last_message_at": now_iso(), "unread_count": 1, "tags": ["pricing", "sales"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "customer_id": customers[2]["id"], "customer_name": "Sofia Rodriguez", "channel": "instagram", "subject": "VIP support request", "status": "open", "priority": "high", "assigned_to": agent1_id, "assigned_name": "James Wilson", "ai_handled": False, "sentiment_score": 0.8, "sentiment_label": "happy", "message_count": 8, "last_message": "Thank you for the quick resolution!", "last_message_at": now_iso(), "unread_count": 0, "tags": ["vip", "support"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "customer_id": customers[3]["id"], "customer_name": "Raj Patel", "channel": "web_chat", "subject": "Billing complaint", "status": "escalated", "priority": "critical", "assigned_to": admin_id, "assigned_name": "Alex Morgan", "ai_handled": False, "sentiment_score": -0.6, "sentiment_label": "frustrated", "message_count": 12, "last_message": "I want to speak with a manager about this charge", "last_message_at": now_iso(), "unread_count": 3, "tags": ["billing", "complaint"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "customer_id": customers[4]["id"], "customer_name": "Lisa Wang", "channel": "web_chat", "subject": "Feature request", "status": "open", "priority": "low", "assigned_to": agent2_id, "assigned_name": "Maya Patel", "ai_handled": True, "sentiment_score": 0.5, "sentiment_label": "satisfied", "message_count": 4, "last_message": "Would love to see dark mode", "last_message_at": now_iso(), "unread_count": 1, "tags": ["feature-request"], "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.conversations.insert_many(conversations)

    for convo in conversations:
        msgs = [
            {"id": make_id(), "conversation_id": convo["id"], "content": f"Hi, I need help with {convo['subject'].lower()}", "sender_type": "customer", "sender_id": convo["customer_id"], "sender_name": convo["customer_name"], "attachments": [], "read": True, "created_at": now_iso()},
            {"id": make_id(), "conversation_id": convo["id"], "content": "Hello! I'd be happy to help. Let me look into this.", "sender_type": "ai", "sender_id": "ai-assistant", "sender_name": "AI Assistant", "attachments": [], "ai_confidence": 0.85, "read": True, "created_at": now_iso()},
            {"id": make_id(), "conversation_id": convo["id"], "content": convo["last_message"], "sender_type": "customer", "sender_id": convo["customer_id"], "sender_name": convo["customer_name"], "attachments": [], "read": False, "created_at": now_iso()},
        ]
        await db.messages.insert_many(msgs)

    leads = [
        {"id": make_id(), "name": "John Smith", "email": "john@acmeinc.com", "phone": "+1222333444", "company": "Acme Inc", "source": "web_chat", "status": "qualified", "score": 85, "grade": "hot", "notes": "Interested in enterprise plan", "assigned_to": agent1_id, "assigned_name": "James Wilson", "activities": [], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Alice Wong", "email": "alice@mediaco.com", "phone": "+1888999000", "company": "MediaCo", "source": "instagram", "status": "new", "score": 45, "grade": "warm", "notes": "Social media management", "assigned_to": agent2_id, "assigned_name": "Maya Patel", "activities": [], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Carlos Mendez", "email": "carlos@buildright.com", "phone": "+1777888999", "company": "BuildRight", "source": "facebook", "status": "contacted", "score": 65, "grade": "warm", "notes": "Custom integration", "assigned_to": agent1_id, "assigned_name": "James Wilson", "activities": [], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Priya Sharma", "email": "priya@healthtech.io", "phone": "+1666777888", "company": "HealthTech", "source": "whatsapp", "status": "proposal", "score": 92, "grade": "hot", "notes": "Ready to close", "assigned_to": admin_id, "assigned_name": "Alex Morgan", "activities": [], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "name": "Tom Baker", "email": "tom@retailx.com", "phone": "+1555444333", "company": "RetailX", "source": "web_chat", "status": "new", "score": 30, "grade": "cold", "notes": "Just browsing", "assigned_to": "", "assigned_name": "", "activities": [], "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.leads.insert_many(leads)

    tickets = [
        {"id": make_id(), "ticket_number": "TKT-A1B2C3D4", "conversation_id": conversations[3]["id"], "customer_id": customers[3]["id"], "subject": "Incorrect billing charge", "description": "Customer charged twice", "priority": "critical", "category": "billing", "status": "open", "assigned_to": admin_id, "assigned_name": "Alex Morgan", "resolution": "", "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(), "notes": [], "created_at": now_iso(), "updated_at": now_iso(), "resolved_at": None},
        {"id": make_id(), "ticket_number": "TKT-E5F6G7H8", "conversation_id": conversations[0]["id"], "customer_id": customers[0]["id"], "subject": "API rate limiting", "description": "429 errors during peak hours", "priority": "high", "category": "technical", "status": "in_progress", "assigned_to": agent1_id, "assigned_name": "James Wilson", "resolution": "", "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(), "notes": [], "created_at": now_iso(), "updated_at": now_iso(), "resolved_at": None},
    ]
    await db.tickets.insert_many(tickets)

    kb_docs = [
        {"id": make_id(), "title": "Getting Started Guide", "content": "Welcome to Pulse Engine! Configure channels, invite team, set up AI templates.", "category": "getting_started", "tags": ["onboarding"], "author_id": admin_id, "author_name": "Alex Morgan", "views": 234, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": make_id(), "title": "WhatsApp Setup", "content": "Create Meta Business account, get Phone Number ID and Access Token.", "category": "integration", "tags": ["whatsapp", "api"], "author_id": admin_id, "author_name": "Alex Morgan", "views": 156, "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.knowledge_base.insert_many(kb_docs)

    return {"message": "Seed data created", "users": len(users), "customers": len(customers), "conversations": len(conversations), "leads": len(leads), "tickets": len(tickets)}


@api.get("/dashboard/feed")
async def dashboard_feed(request: Request):
    current_user = await get_current_user_flexible(request)
    recent_convos = await db.conversations.find({}, {"_id": 0}).sort("updated_at", -1).limit(5).to_list(5)
    recent_leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_tickets = await db.tickets.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return {"recent_conversations": recent_convos, "recent_leads": recent_leads, "recent_tickets": recent_tickets}


app.include_router(api)


@app.on_event("startup")
async def startup():
    logger.info("Pulse Engine AI Platform starting up...")
    existing = await db.users.find_one({"email": "admin@pulseengine.com"})
    if not existing:
        logger.info("No seed data found, will seed on first /api/seed call")
