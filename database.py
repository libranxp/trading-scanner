from pymongo import MongoClient
from datetime import datetime, timedelta
from config import MONGO_URI

client = MongoClient(MONGO_URI)
db = client['scanner']
alerts = db['alerts']

def log_alert(ticker, tier, score=None):
    alerts.insert_one({
        'ticker': ticker,
        'tier': tier,
        'score': score,
        'timestamp': datetime.utcnow()
    })

def check_recent_alerts(ticker):
    recent = datetime.utcnow() - timedelta(hours=6)
    return alerts.find_one({'ticker': ticker, 'timestamp': {'$gte': recent}})

def get_recent_alerts():
    recent = datetime.utcnow() - timedelta(hours=1)
    return list(alerts.find({'timestamp': {'$gte': recent}}))
