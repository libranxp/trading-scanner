import pandas_ta as ta
from api_clients import get_ohlcv, get_volume, get_rsi, get_ema, get_vwap

def fetch_tickers(price_max, volume_min):
    # Fetch tickers from Polygon/FMP, filter by price and volume
    return [t for t in get_ohlcv() if t['price'] < price_max and t['volume'] > volume_min]

def fetch_indicators(ticker):
    try:
        ohlcv = get_ohlcv(ticker)
        volume = get_volume(ticker)
        rsi = get_rsi(ticker)
        ema = get_ema(ticker)
        vwap = get_vwap(ticker)

        return {
            'price': ohlcv['close'],
            'volume': volume,
            'rsi': rsi,
            'price_change': ohlcv['change_pct'],
            'rvol': volume / ohlcv['avg_volume'],
            'ema_stack': 'bullish' if ema['ema5'] > ema['ema13'] > ema['ema50'] else 'neutral',
            'vwap_proximity': (ohlcv['close'] - vwap) / vwap * 100,
            'is_pump': ohlcv['spike_pct'] > 50 and volume < 300_000
        }
    except:
        return None

def fetch_sentiment(ticker): return {'tweets': 120, 'engagement': 340}
def fetch_news(ticker): return {'headline': "Earnings beat", 'source': "Yahoo Finance"}
def fetch_insider(ticker): return {'activity': "Buy", 'confidence': "High"}
