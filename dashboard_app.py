import streamlit as st
from scanner import tier2_scan
from database import get_recent_alerts

st.set_page_config(page_title="📊 Stock Momentum Scanner", layout="wide")
st.title("📊 Stock Momentum Scanner")

st.write(f"Last Scan: {time.strftime('%Y-%m-%d %H:%M:%S')}")
scan_type = st.radio("Scan Type", ["Tier 1", "Tier 2"])

alerts = get_recent_alerts()

for alert in alerts:
    with st.expander(f"${alert['ticker']} | Price: ${alert['price']}"):
        st.write(f"Volume: {alert['volume']} | RSI: {alert['rsi']} | RVOL: {alert['rvol']}")
        st.write(f"EMA Stack: {alert['ema_stack']} | VWAP Proximity: {alert['vwap_proximity']}%")
        if scan_type == "Tier 2":
            if st.button(f"Run Deep Scan for {alert['ticker']}"):
                tier2_scan(alert['ticker'])
