import requests
from config import POLYGON_KEY, FMP_KEY

def get_ohlcv(ticker=None):
    # Replace with actual API call
    return {
        'close': 12.34,
        'change_pct': 2.1,
        'avg_volume': 600_000,
        'spike_pct': 0
    }

def get_volume(ticker): return 800_000
def get_rsi(ticker): return 60
def get_ema(ticker): return {'ema5': 12.5, 'ema13': 12.3, 'ema50': 11.8}
def get_vwap(ticker): return 12.4
