"""
Pulse Engine API Backend Tests
Testing: Authentication, Conversations, Leads, Company Data, Analytics
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://pulse-engine-support.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "admin@pulseengine.com"
TEST_PASSWORD = "admin123"

class TestHealthAndAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful, user: {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401, "Should reject invalid credentials"
        print("✓ Invalid login rejected correctly")
    
    def test_get_me_authenticated(self):
        """Test /auth/me with valid token"""
        # First login
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_res.json()["token"]
        
        # Get user info
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_EMAIL
        print(f"✓ Auth/me returned user: {data['name']}")
    
    def test_get_me_unauthenticated(self):
        """Test /auth/me without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthenticated /auth/me correctly rejected")


@pytest.fixture
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Authentication failed")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestConversations:
    """Conversation and messaging tests"""
    
    def test_list_conversations(self, auth_headers):
        """Test listing conversations"""
        response = requests.get(f"{BASE_URL}/api/conversations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} conversations")
    
    def test_list_conversations_by_channel(self, auth_headers):
        """Test filtering conversations by channel"""
        for channel in ["whatsapp", "facebook", "instagram", "web_chat"]:
            response = requests.get(f"{BASE_URL}/api/conversations?channel={channel}", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            for convo in data:
                assert convo["channel"] == channel, f"Expected {channel}, got {convo['channel']}"
        print("✓ Channel filtering works correctly")
    
    def test_get_conversation_messages(self, auth_headers):
        """Test getting messages for a conversation"""
        # Get first conversation
        convos_res = requests.get(f"{BASE_URL}/api/conversations", headers=auth_headers)
        convos = convos_res.json()
        if not convos:
            pytest.skip("No conversations available")
        
        convo_id = convos[0]["id"]
        response = requests.get(f"{BASE_URL}/api/conversations/{convo_id}/messages", headers=auth_headers)
        assert response.status_code == 200
        messages = response.json()
        assert isinstance(messages, list)
        print(f"✓ Got {len(messages)} messages for conversation")
    
    def test_send_message(self, auth_headers):
        """Test sending a message to a conversation"""
        # Get first conversation
        convos_res = requests.get(f"{BASE_URL}/api/conversations", headers=auth_headers)
        convos = convos_res.json()
        if not convos:
            pytest.skip("No conversations available")
        
        convo_id = convos[0]["id"]
        response = requests.post(
            f"{BASE_URL}/api/conversations/{convo_id}/messages",
            headers=auth_headers,
            json={"content": "TEST_message from automated test", "sender_type": "agent"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"]["content"] == "TEST_message from automated test"
        print("✓ Message sent successfully")
    
    def test_get_single_conversation(self, auth_headers):
        """Test getting a single conversation"""
        # Get list first
        convos_res = requests.get(f"{BASE_URL}/api/conversations", headers=auth_headers)
        convos = convos_res.json()
        if not convos:
            pytest.skip("No conversations available")
        
        convo_id = convos[0]["id"]
        response = requests.get(f"{BASE_URL}/api/conversations/{convo_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == convo_id
        print(f"✓ Got conversation: {data['subject']}")


class TestLeads:
    """Lead management tests"""
    
    def test_list_leads(self, auth_headers):
        """Test listing leads"""
        response = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} leads")
    
    def test_create_lead(self, auth_headers):
        """Test creating a new lead"""
        lead_data = {
            "name": "TEST_Lead User",
            "email": "testlead@example.com",
            "phone": "+1234567890",
            "company": "Test Company",
            "source": "web_chat",
            "notes": "Created by automated test"
        }
        response = requests.post(f"{BASE_URL}/api/leads", headers=auth_headers, json=lead_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == lead_data["name"]
        assert data["email"] == lead_data["email"]
        assert "id" in data
        print(f"✓ Created lead: {data['name']} with ID {data['id']}")
        return data["id"]
    
    def test_get_lead(self, auth_headers):
        """Test getting a single lead"""
        leads_res = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        leads = leads_res.json()
        if not leads:
            pytest.skip("No leads available")
        
        lead_id = leads[0]["id"]
        response = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == lead_id
        print(f"✓ Got lead: {data['name']}")
    
    def test_update_lead_status(self, auth_headers):
        """Test updating lead status"""
        leads_res = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        leads = leads_res.json()
        if not leads:
            pytest.skip("No leads available")
        
        lead_id = leads[0]["id"]
        original_status = leads[0]["status"]
        new_status = "contacted" if original_status != "contacted" else "qualified"
        
        response = requests.put(
            f"{BASE_URL}/api/leads/{lead_id}",
            headers=auth_headers,
            json={"status": new_status}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == new_status
        print(f"✓ Updated lead status to: {new_status}")
    
    def test_score_lead_with_ai(self, auth_headers):
        """Test AI lead scoring"""
        leads_res = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        leads = leads_res.json()
        if not leads:
            pytest.skip("No leads available")
        
        lead_id = leads[0]["id"]
        response = requests.post(f"{BASE_URL}/api/leads/{lead_id}/score", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "grade" in data
        print(f"✓ AI scored lead: score={data['score']}, grade={data['grade']}")
    
    def test_nurture_lead(self, auth_headers):
        """Test lead nurturing with AI"""
        leads_res = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        leads = leads_res.json()
        if not leads:
            pytest.skip("No leads available")
        
        lead_id = leads[0]["id"]
        response = requests.post(f"{BASE_URL}/api/leads/{lead_id}/nurture", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "stage" in data
        print(f"✓ Generated nurture message for stage: {data['stage']}")


class TestCompanyData:
    """Company data (Products & FAQs) tests for RAG"""
    
    def test_list_products(self, auth_headers):
        """Test listing products"""
        response = requests.get(f"{BASE_URL}/api/company-data/products", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} products")
    
    def test_create_product(self, auth_headers):
        """Test creating a product"""
        product_data = {
            "name": "TEST_Product",
            "description": "Test product description for RAG",
            "price": "$99/month",
            "category": "software"
        }
        response = requests.post(f"{BASE_URL}/api/company-data/products", headers=auth_headers, json=product_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == product_data["name"]
        assert "id" in data
        print(f"✓ Created product: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/company-data/products/{data['id']}", headers=auth_headers)
    
    def test_delete_product(self, auth_headers):
        """Test deleting a product"""
        # Create first
        product_data = {"name": "TEST_DeleteProduct", "description": "To be deleted", "price": "$50"}
        create_res = requests.post(f"{BASE_URL}/api/company-data/products", headers=auth_headers, json=product_data)
        product_id = create_res.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/company-data/products/{product_id}", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Deleted product successfully")
    
    def test_list_faqs(self, auth_headers):
        """Test listing FAQs"""
        response = requests.get(f"{BASE_URL}/api/company-data/faqs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} FAQs")
    
    def test_create_faq(self, auth_headers):
        """Test creating an FAQ"""
        faq_data = {
            "question": "TEST_What is the refund policy?",
            "answer": "30-day money back guarantee",
            "category": "billing"
        }
        response = requests.post(f"{BASE_URL}/api/company-data/faqs", headers=auth_headers, json=faq_data)
        assert response.status_code == 200
        data = response.json()
        assert data["question"] == faq_data["question"]
        print(f"✓ Created FAQ: {data['question']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/company-data/faqs/{data['id']}", headers=auth_headers)
    
    def test_delete_faq(self, auth_headers):
        """Test deleting an FAQ"""
        # Create first
        faq_data = {"question": "TEST_Delete FAQ?", "answer": "To be deleted"}
        create_res = requests.post(f"{BASE_URL}/api/company-data/faqs", headers=auth_headers, json=faq_data)
        faq_id = create_res.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/company-data/faqs/{faq_id}", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Deleted FAQ successfully")


class TestAnalytics:
    """Analytics endpoint tests"""
    
    def test_analytics_overview(self, auth_headers):
        """Test analytics overview"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_conversations" in data
        assert "total_leads" in data
        assert "ai_resolution_rate" in data
        assert "sentiment_distribution" in data
        assert "channel_distribution" in data
        print(f"✓ Analytics overview: {data['total_conversations']} convos, {data['total_leads']} leads")
    
    def test_analytics_conversations(self, auth_headers):
        """Test conversation analytics"""
        response = requests.get(f"{BASE_URL}/api/analytics/conversations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            assert "date" in data[0]
            assert "total" in data[0] or "ai_handled" in data[0]
        print(f"✓ Conversation analytics: {len(data)} data points")
    
    def test_analytics_leads(self, auth_headers):
        """Test leads analytics"""
        response = requests.get(f"{BASE_URL}/api/analytics/leads", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "by_status" in data or "by_source" in data or "by_grade" in data
        print("✓ Leads analytics retrieved")
    
    def test_analytics_sentiment(self, auth_headers):
        """Test sentiment analytics"""
        response = requests.get(f"{BASE_URL}/api/analytics/sentiment", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Sentiment analytics: {len(data)} data points")
    
    def test_analytics_agents(self, auth_headers):
        """Test agent analytics"""
        response = requests.get(f"{BASE_URL}/api/analytics/agents", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Agent analytics: {len(data)} agents")


class TestCustomers:
    """Customer management tests"""
    
    def test_list_customers(self, auth_headers):
        """Test listing customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} customers")
    
    def test_get_customer(self, auth_headers):
        """Test getting a single customer"""
        customers_res = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        customers = customers_res.json()
        if not customers:
            pytest.skip("No customers available")
        
        customer_id = customers[0]["id"]
        response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == customer_id
        assert "churn_risk" in data  # Calculated field
        print(f"✓ Got customer: {data['name']} with churn risk: {data['churn_risk']['risk_level']}")


class TestSettings:
    """Settings endpoints tests"""
    
    def test_get_channel_settings(self, auth_headers):
        """Test getting channel settings"""
        response = requests.get(f"{BASE_URL}/api/settings/channels", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        channels = [c["channel"] for c in data]
        assert "whatsapp" in channels
        assert "facebook" in channels
        assert "instagram" in channels
        assert "web_chat" in channels
        print(f"✓ Got {len(data)} channel settings")
    
    def test_get_company_settings(self, auth_headers):
        """Test getting company settings"""
        response = requests.get(f"{BASE_URL}/api/settings/company", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "company_name" in data
        assert "ai_enabled" in data
        print(f"✓ Got company settings: {data['company_name']}")
    
    def test_list_templates(self, auth_headers):
        """Test listing templates"""
        response = requests.get(f"{BASE_URL}/api/settings/templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} templates")


class TestDashboard:
    """Dashboard feed tests"""
    
    def test_dashboard_feed(self, auth_headers):
        """Test dashboard feed endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/feed", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "recent_conversations" in data
        assert "recent_leads" in data
        assert "recent_tickets" in data
        print("✓ Dashboard feed retrieved successfully")


class TestUsers:
    """User management tests"""
    
    def test_list_users(self, auth_headers):
        """Test listing users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} users")


class TestTickets:
    """Ticket management tests"""
    
    def test_list_tickets(self, auth_headers):
        """Test listing tickets"""
        response = requests.get(f"{BASE_URL}/api/tickets", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} tickets")
    
    def test_create_ticket(self, auth_headers):
        """Test creating a ticket"""
        ticket_data = {
            "subject": "TEST_Automated Test Ticket",
            "description": "Created by automated test",
            "priority": "medium",
            "category": "technical"
        }
        response = requests.post(f"{BASE_URL}/api/tickets", headers=auth_headers, json=ticket_data)
        assert response.status_code == 200
        data = response.json()
        assert data["subject"] == ticket_data["subject"]
        assert "ticket_number" in data
        print(f"✓ Created ticket: {data['ticket_number']}")


class TestKnowledgeBase:
    """Knowledge base tests"""
    
    def test_list_knowledge_base(self, auth_headers):
        """Test listing knowledge base articles"""
        response = requests.get(f"{BASE_URL}/api/knowledge-base", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} KB articles")


class TestAI:
    """AI endpoint tests"""
    
    def test_ai_sentiment_analysis(self, auth_headers):
        """Test AI sentiment analysis"""
        response = requests.post(
            f"{BASE_URL}/api/ai/sentiment",
            headers=auth_headers,
            json={"text": "I am very happy with the service!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "emotion" in data
        print(f"✓ AI sentiment analysis: emotion={data['emotion']}, score={data['score']}")
    
    def test_ai_classify_intent(self, auth_headers):
        """Test AI intent classification"""
        response = requests.post(
            f"{BASE_URL}/api/ai/classify",
            headers=auth_headers,
            json={"text": "What are your pricing plans?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "intent" in data
        assert "urgency" in data
        print(f"✓ AI intent classification: intent={data['intent']}, urgency={data['urgency']}")


class TestAIResponse:
    """AI auto-response tests"""
    
    def test_trigger_ai_response(self, auth_headers):
        """Test triggering AI response for a conversation"""
        # Get first conversation
        convos_res = requests.get(f"{BASE_URL}/api/conversations", headers=auth_headers)
        convos = convos_res.json()
        if not convos:
            pytest.skip("No conversations available")
        
        convo_id = convos[0]["id"]
        response = requests.post(f"{BASE_URL}/api/conversations/{convo_id}/ai-respond", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "content" in data
        assert data["sender_type"] == "ai"
        print(f"✓ AI response generated: {data['content'][:50]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
