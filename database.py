from supabase import create_client
from datetime import datetime, timedelta
import os

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def log_alert(ticker, tier, score=None):
    supabase.table("alerts").insert({
        "ticker": ticker,
        "tier": tier,
        "score": score,
        "timestamp": datetime.utcnow().isoformat()
    }).execute()

def check_recent_alerts(ticker):
    recent = (datetime.utcnow() - timedelta(hours=6)).isoformat()
    result = supabase.table("alerts").select("ticker").eq("ticker", ticker).gte("timestamp", recent).execute()
    return len(result.data) > 0

def get_recent_alerts():
    recent = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    result = supabase.table("alerts").select("*").gte("timestamp", recent).execute()
    return result.data
