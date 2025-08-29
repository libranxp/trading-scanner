from data_fetcher import fetch_tickers, fetch_indicators, fetch_sentiment, fetch_news, fetch_insider
from telegram_bot import send_alert
from database import log_alert, check_recent_alerts
from ai_model import run_model

def tier1_scan():
    tickers = fetch_tickers()
    for ticker in tickers:
        data = fetch_indicators(ticker)
        if not data or check_recent_alerts(ticker): continue

        if (
            data['price_change'] > 1 and
            data['rvol'] > 1.2 and
            45 <= data['rsi'] <= 75 and
            data['ema_stack'] == 'bullish' and
            abs(data['vwap_proximity']) <= 1.5 and
            not data['is_pump']
        ):
            send_alert(ticker, data, tier=1)
            log_alert(ticker, tier=1)

def tier2_scan(ticker):
    data = fetch_indicators(ticker)
    sentiment = fetch_sentiment(ticker)
    news = fetch_news(ticker)
    insider = fetch_insider(ticker)
    enriched = {**data, **sentiment, **news, **insider}
    score, narrative, risk = run_model(enriched)
    enriched.update({'score': score, 'narrative': narrative, **risk})
    send_alert(ticker, enriched, tier=2)
    log_alert(ticker, tier=2, score=score)

if __name__ == "__main__":
    tier1_scan()
