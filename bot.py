import requests
import time
from collections import defaultdict
from datetime import datetime, timedelta
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import threading
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

logging.basicConfig(level=logging.INFO)

TOKEN = "8631940655:AAEGkEEL3yHKMUB-qI0K9sYyFOyBaclnc10"
ETHERSCAN_API_KEY = "4YDW7PM5GMKMVU7GZC3BGRCI2M957VHTX5"

USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"

# Цены монет в USD (кэш на 5 минут)
price_cache = {}
price_cache_time = {}

def get_usd_price(coin):
    """Получить цену монеты в USD с CoinGecko"""
    coin_ids = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "USDT": "tether",
        "BNB": "binancecoin",
        "SOL": "solana",
        "TON": "the-open-network"
    }
    
    coin_id = coin_ids.get(coin)
    if not coin_id:
        return 0
    
    # Проверяем кэш (5 минут)
    if coin_id in price_cache_time and time.time() - price_cache_time[coin_id] < 300:
        return price_cache.get(coin_id, 0)
    
    try:
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=usd"
        resp = requests.get(url)
        data = resp.json()
        price = data.get(coin_id, {}).get("usd", 0)
        price_cache[coin_id] = price
        price_cache_time[coin_id] = time.time()
        return price
    except:
        return 0

# ==========================================
# ETHEREUM BALANCE
# ==========================================
def get_eth_balance(address):
    url = "https://api.etherscan.io/v2/api"
    params = {
        "chainid": 1,
        "module": "account",
        "action": "balance",
        "address": address,
        "tag": "latest",
        "apikey": ETHERSCAN_API_KEY
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    if data.get("status") == "1":
        return int(data["result"]) / 10**18
    return 0

def get_eth_transactions(address, days=30):
    url = "https://api.etherscan.io/v2/api"
    params = {
        "chainid": 1,
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": "0",
        "endblock": "99999999",
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    
    if data.get("status") != "1":
        return [], 0, 0
    
    cutoff = int(time.time()) - days * 86400
    txs = [tx for tx in data["result"] if int(tx["timeStamp"]) >= cutoff]
    
    incoming = 0
    outgoing = 0
    for tx in txs:
        value = int(tx["value"]) / 10**18
        if tx.get("to", "").lower() == address.lower():
            incoming += value
        elif tx.get("from", "").lower() == address.lower():
            outgoing += value
    
    return txs, incoming, outgoing

# ==========================================
# USDT ETHEREUM
# ==========================================
def get_usdt_balance(address):
    url = "https://api.etherscan.io/v2/api"
    params = {
        "chainid": 1,
        "module": "account",
        "action": "tokenbalance",
        "contractaddress": USDT_CONTRACT,
        "address": address,
        "tag": "latest",
        "apikey": ETHERSCAN_API_KEY
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    if data.get("status") == "1":
        return int(data["result"]) / 10**6
    return 0

def get_usdt_transactions(address, days=30):
    url = "https://api.etherscan.io/v2/api"
    params = {
        "chainid": 1,
        "module": "account",
        "action": "tokentx",
        "contractaddress": USDT_CONTRACT,
        "address": address,
        "startblock": "0",
        "endblock": "99999999",
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    
    if data.get("status") != "1":
        return [], 0, 0
    
    cutoff = int(time.time()) - days * 86400
    txs = [tx for tx in data["result"] if int(tx["timeStamp"]) >= cutoff]
    
    incoming = 0
    outgoing = 0
    for tx in txs:
        value = int(tx["value"]) / 10**6
        if tx.get("to", "").lower() == address.lower():
            incoming += value
        elif tx.get("from", "").lower() == address.lower():
            outgoing += value
    
    return txs, incoming, outgoing

# ==========================================
# BITCOIN
# ==========================================
def get_btc_balance(address):
    try:
        resp = requests.get(f"https://mempool.space/api/address/{address}")
        data = resp.json()
        return data.get("chain_stats", {}).get("balance", 0) / 10**8
    except:
        return 0

def get_btc_transactions(address, days=30):
    try:
        resp = requests.get(f"https://mempool.space/api/address/{address}/txs")
        data = resp.json()
        cutoff = int(time.time()) - days * 86400
        txs = [tx for tx in data if tx.get("status", {}).get("block_time", 0) >= cutoff]
        incoming = 0
        outgoing = 0
        for tx in txs:
            for vin in tx.get("vin", []):
                if vin.get("prevout", {}).get("scriptpubkey_address") == address:
                    outgoing += vin.get("value", 0) / 10**8
            for vout in tx.get("vout", []):
                if vout.get("scriptpubkey_address") == address:
                    incoming += vout.get("value", 0) / 10**8
        return txs, incoming, outgoing
    except:
        return [], 0, 0

# ==========================================
# SOLANA
# ==========================================
def get_sol_balance(address):
    try:
        resp = requests.post("https://api.mainnet-beta.solana.com", 
            json={"jsonrpc": "2.0", "id": 1, "method": "getBalance", "params": [address]},
            headers={"Content-Type": "application/json"})
        data = resp.json()
        if "result" in data:
            return data["result"]["value"] / 10**9
        return 0
    except:
        return 0

def get_sol_transactions(address, days=30):
    return [], 0, 0

# ==========================================
# FLASK APP
# ==========================================
flask_app = Flask(__name__, static_folder='webapp', static_url_path='')
CORS(flask_app)

@flask_app.route('/')
def index():
    return send_from_directory('webapp', 'index.html')

@flask_app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('webapp', path)

@flask_app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    address = data.get('address')
    coin = data.get('coin')
    network = data.get('network')
    days = int(data.get('days', 30))
    
    print(f"Analyze: coin={coin}, network={network}, address={address}")
    
    # BTC
    if coin == "BTC":
        balance = get_btc_balance(address)
        txs, incoming, outgoing = get_btc_transactions(address, days)
        insight = "Bitcoin analysis completed"
    
    # SOL
    elif coin == "SOL":
        balance = get_sol_balance(address)
        txs, incoming, outgoing = get_sol_transactions(address, days)
        insight = "Solana analysis completed"
    
    # USDT on Ethereum
    elif coin == "USDT" and network == "ethereum":
        balance = get_usdt_balance(address)
        txs, incoming, outgoing = get_usdt_transactions(address, days)
        insight = "You receive more than you send" if incoming > outgoing else "You spend more than you receive" if outgoing > incoming else "Balance of flows is approximately equal"
    
    # ETH on Ethereum
    elif coin == "ETH" and network == "ethereum":
        balance = get_eth_balance(address)
        txs, incoming, outgoing = get_eth_transactions(address, days)
        insight = "You receive more than you send" if incoming > outgoing else "You spend more than you receive" if outgoing > incoming else "Balance of flows is approximately equal"
    
    else:
        return jsonify({'error': f'Coin {coin} on network {network} not supported'}), 400
    
    # Get USD price for this coin
    usd_price = get_usd_price(coin)
    balance_usd = balance * usd_price
    
    # Daily data for chart
    daily = defaultdict(int)
    now_ts = int(time.time())
    for i in range(days):
        day_date = datetime.fromtimestamp(now_ts - i * 86400).strftime('%Y-%m-%d')
        daily[day_date] = 0
    
    for tx in txs:
        ts = tx.get("timeStamp") or tx.get("status", {}).get("block_time") or 0
        if ts:
            tx_date = datetime.fromtimestamp(int(ts)).strftime('%Y-%m-%d')
            if tx_date in daily:
                daily[tx_date] += 1
    
    daily_data = [{'date': d, 'count': daily[d]} for d in sorted(daily.keys())]
    
    result = {
        'balance': round(balance, 6),
        'balanceUsd': round(balance_usd, 2),
        'txCount': len(txs),
        'incoming': round(incoming, 6),
        'outgoing': round(outgoing, 6),
        'insight': insight,
        'topSenders': [],
        'topReceivers': [],
        'dailyData': daily_data
    }
    
    print(f"Result: balance={balance}, balanceUsd={balance_usd}")
    return jsonify(result)

def run_flask():
    flask_app.run(host='0.0.0.0', port=8080)

threading.Thread(target=run_flask, daemon=True).start()

# ==========================================
# TELEGRAM BOT
# ==========================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton("Open App", web_app=WebAppInfo(url="https://crypto-bot-production-d6b8.up.railway.app"))]]
    await update.message.reply_text("Click the button:", reply_markup=InlineKeyboardMarkup(keyboard))

app = ApplicationBuilder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))

print("Bot started with USD price support!")
app.run_polling()
