from telegram import Bot
import os

bot = Bot(token=os.environ["TELEGRAM_TOKEN"])
CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

def send_to_telegram(msg): bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode="Markdown")

def send_alert(ticker, data, tier=1):
    msg = f"🚨 *${ticker}* | Price: ${data['price']} | Change: {data['price_change']}% | Volume: {data['volume']}\n"
    msg += f"RSI: {data['rsi']} | RVOL: {data['rvol']} | EMA Stack: {data['ema_stack']} | VWAP Δ: {data['vwap_proximity']}%\n"
    msg += f"ATR: {data['atr']}\n"
    if tier == 2:
        msg += f"\n🧠 *AI Score*: {data['score']}/10\n🧠 *Validation*: {data['narrative']}\n"
        msg += f"🎯 Entry: ${data['entry']} | TP: ${data['tp']} | SL: ${data['sl']}\n"
        msg += f"\n🔗 [Sentiment]({data['sentiment_link']}) | [Catalyst]({data['catalyst_link']}) | [News]({data['news_link']})"
    msg += f"\n📈 [TradingView](https://www.tradingview.com/symbols/{ticker}) | [Webull](https://www.webull.com/quote/{ticker})"
    send_to_telegram(msg)
