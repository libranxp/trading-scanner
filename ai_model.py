import numpy as np
from sklearn.ensemble import RandomForestClassifier

# Placeholder model – replace with trained version or load from pickle
model = RandomForestClassifier()

def run_model(data):
    features = [
        data['rsi'], data['rvol'], data['price_change'],
        data['tweets'], data['engagement']
    ]
    X = np.array(features).reshape(1, -1)
    score = int(model.predict_proba(X)[0][1] * 10)

    narrative = "Strong momentum with bullish indicators and high sentiment."
    risk = {
        'sl': round(data['price'] * 0.95, 2),
        'tp': round(data['price'] * 1.1, 2),
        'size': "2% of portfolio"
    }
    return score, narrative, risk
