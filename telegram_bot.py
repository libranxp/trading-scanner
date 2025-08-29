from telegram import Bot
from config import TELEGRAM_TOKEN, TELEGRAM_CHAT_ID

bot = Bot(token=TELEGRAM_TOKEN)

def send_to_telegram(msg): bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=msg)

def send_alert(ticker, data, tier=1, score=None):
    msg = f"🚨 ${ticker} | Price: ${data['price']} | Volume: {data['volume']} | RSI: {data['rsi']}"
    if tier == 2:
        msg += f"\n📊 AI Score: {score}/10\n🧠 Reason: {data['narrative']}"
        msg += f"\n🎯 SL: {data['sl']} | TP: {data['tp']} | Size: {data['size']}"
    msg += f"\n🔗 [Chart](https://www.tradingview.com/symbols/{ticker})"
    send_to_telegram(msg)
