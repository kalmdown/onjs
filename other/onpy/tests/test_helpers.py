import os
import json
import inspect
from functools import wraps
from datetime import datetime
import pytest

LOG_FILE = "TESTS_API_CALLS.txt"

def log_api_call(http_method, endpoint, payload=None, base_url="https://cad.onshape.com/api/v10"):
    """Log API calls to a file with test context"""
    # Get the current test name
    current_test = os.environ.get('PYTEST_CURRENT_TEST', '').split(':')[-1].split(' ')[0]
    if not current_test:
        current_test = "unknown_test"
    
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"\n[{timestamp}] TEST: {current_test}\n")
        f.write(f"  {http_method} {base_url}{endpoint}\n")
        if payload:
            f.write(f"  PAYLOAD: {json.dumps(payload, indent=2)}\n")
        f.write("-" * 80 + "\n")

@pytest.fixture(autouse=True)
def setup_test_name(request):
    """Fixture to set the current test name in environment variable"""
    test_name = request.node.name
    os.environ['PYTEST_CURRENT_TEST'] = test_name
    # Clear the log file if this is the first test
    if not hasattr(setup_test_name, 'initialized'):
        if os.path.exists(LOG_FILE):
            os.remove(LOG_FILE)
        setup_test_name.initialized = True
    
    yield
    
    # Clean up after the test
    os.environ.pop('PYTEST_CURRENT_TEST', None)