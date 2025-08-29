import streamlit as st
from scanner import tier2_scan
from database import get_recent_alerts

st.set_page_config(page_title="📊 Stock Momentum Scanner", layout="wide")
st.title("📊 Stock Momentum Scanner")

st.write("Last Scan: [auto every 45 min]")
alerts = get_recent_alerts()

for alert in alerts:
    with st.expander(f"${alert['ticker']} | Tier {alert['tier']}"):
        st.write(f"Price: ${alert['price']} | Change: {alert['price_change']}% | Volume: {alert['volume']}")
        st.write(f"RSI: {alert['rsi']} | RVOL: {alert['rvol']} | EMA Stack: {alert['ema_stack']} | VWAP Δ: {alert['vwap_proximity']}%")
        st.write(f"ATR: {alert['atr']}")
        if alert['tier'] == 2:
            st.write(f"AI Score: {alert['score']} | Reason: {alert['narrative']}")
            st.write(f"Entry: ${alert['entry']} | TP: ${alert['tp']} | SL: ${alert['sl']}")
            st.write(f"[Sentiment Link]({alert['sentiment_link']}) | [Catalyst Link]({alert['catalyst_link']}) | [News Link]({alert['news_link']})")
        if st.button(f"Run Deep Scan for {alert['ticker']}"):
            tier2_scan(alert['ticker'])
