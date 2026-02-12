import requests
import json
import sys
from datetime import datetime

class PulseEngineAPITester:
    def __init__(self, base_url="https://dev-build-8.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.current_user = None

    def log_result(self, test_name, passed, details=""):
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASS")
        else:
            self.failed_tests.append({"test": test_name, "details": details})
            print(f"❌ {test_name}: FAIL - {details}")

    def make_request(self, method, endpoint, data=None, params=None, expect_status=200):
        """Make API request with proper error handling"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            
            success = response.status_code == expect_status
            response_data = {}
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_content": response.text[:200]}
            
            return success, response.status_code, response_data
            
        except requests.exceptions.RequestException as e:
            return False, 0, {"error": str(e)}

    def test_auth_flow(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Flow...")
        
        # Test login with admin credentials
        success, status, data = self.make_request('POST', 'auth/login', {
            'email': 'admin@pulseengine.com',
            'password': 'admin123'
        })
        
        if success and 'token' in data:
            self.token = data['token']
            self.current_user = data.get('user', {})
            self.log_result("Admin Login", True)
        else:
            self.log_result("Admin Login", False, f"Status: {status}, Response: {data}")
            return False
        
        # Test get current user
        success, status, data = self.make_request('GET', 'auth/me')
        self.log_result("Get Current User", success and 'email' in data)
        
        # Test token refresh
        if self.token:
            refresh_token = data.get('refresh_token') if hasattr(data, 'get') else None
            if refresh_token:
                success, status, data = self.make_request('POST', 'auth/refresh', 
                    {'refresh_token': refresh_token})
                self.log_result("Token Refresh", success)
        
        return True

    def test_conversations_api(self):
        """Test conversation endpoints"""
        print("\n💬 Testing Conversations API...")
        
        # Get conversations list
        success, status, data = self.make_request('GET', 'conversations')
        self.log_result("List Conversations", success and isinstance(data, list))
        
        # Test with filters
        success, status, data = self.make_request('GET', 'conversations', 
            params={'channel': 'whatsapp'})
        self.log_result("Filter Conversations by Channel", success)
        
        success, status, data = self.make_request('GET', 'conversations', 
            params={'search': 'test'})
        self.log_result("Search Conversations", success)
        
        # If we have conversations, test individual conversation
        if success and data and len(data) > 0:
            convo_id = data[0].get('id')
            if convo_id:
                success, status, convo_data = self.make_request('GET', f'conversations/{convo_id}')
                self.log_result("Get Single Conversation", success and 'id' in convo_data)
                
                # Test getting messages for conversation
                success, status, msgs = self.make_request('GET', f'conversations/{convo_id}/messages')
                self.log_result("Get Conversation Messages", success and isinstance(msgs, list))
                
                # Test sending a message
                success, status, msg_data = self.make_request('POST', 
                    f'conversations/{convo_id}/messages', {
                        'content': 'Test message from API test',
                        'sender_type': 'agent'
                    }, expect_status=200)
                self.log_result("Send Message", success)
                
                # Test AI response trigger
                success, status, ai_data = self.make_request('POST', 
                    f'conversations/{convo_id}/ai-respond', expect_status=200)
                self.log_result("Trigger AI Response", success)

    def test_leads_api(self):
        """Test leads endpoints"""
        print("\n🎯 Testing Leads API...")
        
        # Get leads list
        success, status, data = self.make_request('GET', 'leads')
        self.log_result("List Leads", success and isinstance(data, list))
        
        # Test creating a new lead
        new_lead = {
            'name': 'Test Lead API',
            'email': 'testapi@example.com',
            'phone': '+1234567890',
            'company': 'Test Company API',
            'source': 'web_chat',
            'notes': 'Created via API test'
        }
        
        success, status, lead_data = self.make_request('POST', 'leads', new_lead, expect_status=200)
        created_lead_id = None
        if success and 'id' in lead_data:
            created_lead_id = lead_data['id']
            self.log_result("Create Lead", True)
        else:
            self.log_result("Create Lead", False, f"Status: {status}, Data: {lead_data}")
        
        # Test lead filtering
        success, status, data = self.make_request('GET', 'leads', params={'grade': 'warm'})
        self.log_result("Filter Leads by Grade", success)
        
        # If we created a lead, test operations on it
        if created_lead_id:
            # Test updating lead
            success, status, updated_data = self.make_request('PUT', f'leads/{created_lead_id}', 
                {'status': 'contacted'})
            self.log_result("Update Lead", success)
            
            # Test AI scoring
            success, status, scored_data = self.make_request('POST', f'leads/{created_lead_id}/score')
            self.log_result("AI Score Lead", success)
            
            # Clean up - delete test lead
            success, status, _ = self.make_request('DELETE', f'leads/{created_lead_id}')
            self.log_result("Delete Lead", success)

    def test_customers_api(self):
        """Test customers endpoints"""
        print("\n👥 Testing Customers API...")
        
        # Get customers list
        success, status, data = self.make_request('GET', 'customers')
        self.log_result("List Customers", success and isinstance(data, list))
        
        # Test customer search
        success, status, data = self.make_request('GET', 'customers', params={'search': 'test'})
        self.log_result("Search Customers", success)
        
        # Test creating a customer
        new_customer = {
            'name': 'Test Customer API',
            'email': 'testcustomer@example.com',
            'phone': '+1987654321',
            'company': 'Test Customer Co',
            'channels': ['web_chat'],
            'segment': 'general'
        }
        
        success, status, customer_data = self.make_request('POST', 'customers', new_customer)
        if success and 'id' in customer_data:
            customer_id = customer_data['id']
            self.log_result("Create Customer", True)
            
            # Test get single customer
            success, status, single_customer = self.make_request('GET', f'customers/{customer_id}')
            self.log_result("Get Single Customer", success and 'churn_risk' in single_customer)
        else:
            self.log_result("Create Customer", False, f"Status: {status}")

    def test_tickets_api(self):
        """Test tickets endpoints"""
        print("\n🎫 Testing Tickets API...")
        
        # Get tickets list
        success, status, data = self.make_request('GET', 'tickets')
        self.log_result("List Tickets", success and isinstance(data, list))
        
        # Test creating a ticket
        new_ticket = {
            'subject': 'Test Ticket API',
            'description': 'Test ticket created via API',
            'priority': 'medium',
            'category': 'technical'
        }
        
        success, status, ticket_data = self.make_request('POST', 'tickets', new_ticket)
        if success and 'id' in ticket_data:
            ticket_id = ticket_data['id']
            self.log_result("Create Ticket", True)
            
            # Test updating ticket
            success, status, _ = self.make_request('PUT', f'tickets/{ticket_id}', 
                {'status': 'in_progress'})
            self.log_result("Update Ticket", success)
            
            # Test adding note to ticket
            success, status, _ = self.make_request('POST', f'tickets/{ticket_id}/notes', 
                {'content': 'Test note added via API'})
            self.log_result("Add Ticket Note", success)
        else:
            self.log_result("Create Ticket", False, f"Status: {status}")

    def test_analytics_api(self):
        """Test analytics endpoints"""
        print("\n📊 Testing Analytics API...")
        
        # Test analytics overview
        success, status, data = self.make_request('GET', 'analytics/overview')
        expected_keys = ['total_conversations', 'total_leads', 'ai_resolution_rate']
        has_keys = all(key in data for key in expected_keys) if success else False
        self.log_result("Analytics Overview", success and has_keys)
        
        # Test conversation analytics
        success, status, data = self.make_request('GET', 'analytics/conversations')
        self.log_result("Conversation Analytics", success and isinstance(data, list))
        
        # Test lead analytics
        success, status, data = self.make_request('GET', 'analytics/leads')
        expected_sections = ['by_status', 'by_source', 'by_grade']
        has_sections = all(section in data for section in expected_sections) if success else False
        self.log_result("Lead Analytics", success and has_sections)
        
        # Test sentiment analytics
        success, status, data = self.make_request('GET', 'analytics/sentiment')
        self.log_result("Sentiment Analytics", success and isinstance(data, list))
        
        # Test agent analytics
        success, status, data = self.make_request('GET', 'analytics/agents')
        self.log_result("Agent Analytics", success and isinstance(data, list))

    def test_knowledge_base_api(self):
        """Test knowledge base endpoints"""
        print("\n📚 Testing Knowledge Base API...")
        
        # Get KB documents
        success, status, data = self.make_request('GET', 'knowledge-base')
        self.log_result("List KB Documents", success and isinstance(data, list))
        
        # Test creating KB document
        new_doc = {
            'title': 'Test KB Article API',
            'content': 'This is a test knowledge base article created via API testing.',
            'category': 'testing',
            'tags': ['api', 'test']
        }
        
        success, status, doc_data = self.make_request('POST', 'knowledge-base', new_doc)
        if success and 'id' in doc_data:
            doc_id = doc_data['id']
            self.log_result("Create KB Document", True)
            
            # Test get single document
            success, status, _ = self.make_request('GET', f'knowledge-base/{doc_id}')
            self.log_result("Get Single KB Document", success)
            
            # Clean up
            success, status, _ = self.make_request('DELETE', f'knowledge-base/{doc_id}')
            self.log_result("Delete KB Document", success)
        else:
            self.log_result("Create KB Document", False)

    def test_settings_api(self):
        """Test settings endpoints"""
        print("\n⚙️ Testing Settings API...")
        
        # Test channel settings
        success, status, data = self.make_request('GET', 'settings/channels')
        self.log_result("Get Channel Settings", success and isinstance(data, list))
        
        # Test company settings
        success, status, data = self.make_request('GET', 'settings/company')
        self.log_result("Get Company Settings", success and 'company_name' in data)
        
        # Test templates
        success, status, data = self.make_request('GET', 'settings/templates')
        self.log_result("Get Templates", success and isinstance(data, list))

    def test_dashboard_feed(self):
        """Test dashboard feed endpoint"""
        print("\n🏠 Testing Dashboard Feed...")
        
        success, status, data = self.make_request('GET', 'dashboard/feed')
        expected_keys = ['recent_conversations', 'recent_leads', 'recent_tickets']
        has_keys = all(key in data for key in expected_keys) if success else False
        self.log_result("Dashboard Feed", success and has_keys)

    def test_ai_tools(self):
        """Test AI tool endpoints"""
        print("\n🤖 Testing AI Tools...")
        
        # Test sentiment analysis
        success, status, data = self.make_request('POST', 'ai/sentiment', 
            {'text': 'I am very happy with the service!'})
        self.log_result("AI Sentiment Analysis", success)
        
        # Test intent classification
        success, status, data = self.make_request('POST', 'ai/classify', 
            {'text': 'I want to cancel my subscription'})
        self.log_result("AI Intent Classification", success)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Pulse Engine API Tests...")
        print(f"🌐 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Test authentication first
        if not self.test_auth_flow():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Test all other endpoints
        self.test_conversations_api()
        self.test_leads_api()
        self.test_customers_api()
        self.test_tickets_api()
        self.test_analytics_api()
        self.test_knowledge_base_api()
        self.test_settings_api()
        self.test_dashboard_feed()
        self.test_ai_tools()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📋 Test Summary:")
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {len(self.failed_tests)}/{self.tests_run}")
        print(f"📊 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n🚨 Failed Tests:")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: {failure['details']}")
        
        return len(self.failed_tests) == 0

def main():
    tester = PulseEngineAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())