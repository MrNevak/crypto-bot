# ==========================================
# 1. ИМПОРТЫ
# ==========================================
import requests
import time
import datetime
import io
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import threading

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# ==========================================
# 2. НАСТРОЙКИ И КОНСТАНТЫ
# ==========================================
logging.basicConfig(level=logging.INFO)

TOKEN = "8631940655:AAEGkEEL3yHKMUB-qI0K9sYyFOyBaclnc10"
ETHERSCAN_API_KEY = "4YDW7PM5GMKMVU7GZC3BGRCI2M957VHTX5"
BSCSCAN_API_KEY = "4YDW7PM5GMKMVU7GZC3BGRCI2M957VHTX5"
POLYGONSCAN_API_KEY = "4YDW7PM5GMKMVU7GZC3BGRCI2M957VHTX5"
ARBISCAN_API_KEY = "4YDW7PM5GMKMVU7GZC3BGRCI2M957VHTX5"
OPTIMISMSCAN_API_KEY = "4YDW7PM5GMKMVU7GZC3BGRCI2M957VHTX5"

# Контракты USDT по сетям
USDT_CONTRACTS = {
    "ethereum": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "bsc": "0x55d398326f99059fF775485246999027B3197955",
    "polygon": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "arbitrum": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "optimism": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"
}

# ==========================================
# 3. ФУНКЦИИ ДЛЯ РАБОТЫ С EVM СЕТЯМИ
# ==========================================
def get_evm_balance(address, chain, contract=None):
    """Get balance for EVM chains (Ethereum, BSC, Polygon, Arbitrum, Optimism)"""
    explorers = {
        "ethereum": {"url": "https://api.etherscan.io/v2/api", "api_key": ETHERSCAN_API_KEY},
        "bsc": {"url": "https://api.bscscan.com/v2/api", "api_key": BSCSCAN_API_KEY},
        "polygon": {"url": "https://api.polygonscan.com/v2/api", "api_key": POLYGONSCAN_API_KEY},
        "arbitrum": {"url": "https://api.arbiscan.io/v2/api", "api_key": ARBISCAN_API_KEY},
        "optimism": {"url": "https://api-optimistic.etherscan.io/v2/api", "api_key": OPTIMISMSCAN_API_KEY}
    }
    
    explorer = explorers.get(chain)
    if not explorer:
        return 0
    
    if contract:
        # Token balance
        params = {
            "module": "account",
            "action": "tokenbalance",
            "contractaddress": contract,
            "address": address,
            "tag": "latest",
            "apikey": explorer["api_key"]
        }
        resp = requests.get(explorer["url"], params=params)
        data = resp.json()
        if data.get("status") == "1":
            return int(data["result"]) / 10**18
    else:
        # Native coin balance
        params = {
            "module": "account",
            "action": "balance",
            "address": address,
            "tag": "latest",
            "apikey": explorer["api_key"]
        }
        resp = requests.get(explorer["url"], params=params)
        data = resp.json()
        if data.get("status") == "1":
            return int(data["result"]) / 10**18
    return 0

def get_evm_transactions(address, chain, days=30, contract=None):
    """Get transactions for EVM chains"""
    explorers = {
        "ethereum": {"url": "https://api.etherscan.io/v2/api", "api_key": ETHERSCAN_API_KEY},
        "bsc": {"url": "https://api.bscscan.com/v2/api", "api_key": BSCSCAN_API_KEY},
        "polygon": {"url": "https://api.polygonscan.com/v2/api", "api_key": POLYGONSCAN_API_KEY},
        "arbitrum": {"url": "https://api.arbiscan.io/v2/api", "api_key": ARBISCAN_API_KEY},
        "optimism": {"url": "https://api-optimistic.etherscan.io/v2/api", "api_key": OPTIMISMSCAN_API_KEY}
    }
    
    explorer = explorers.get(chain)
    if not explorer:
        return [], 0, 0
    
    now = int(time.time())
    cutoff = now - days * 86400
    
    if contract:
        # Token transactions
        params = {
            "module": "account",
            "action": "tokentx",
            "contractaddress": contract,
            "address": address,
            "startblock": "0",
            "endblock": "99999999",
            "sort": "desc",
            "apikey": explorer["api_key"]
        }
    else:
        # Native transactions
        params = {
            "module": "account",
            "action": "txlist",
            "address": address,
            "startblock": "0",
            "endblock": "99999999",
            "sort": "desc",
            "apikey": explorer["api_key"]
        }
    
    resp = requests.get(explorer["url"], params=params)
    data = resp.json()
    
    if data.get("status") != "1":
        return [], 0, 0
    
    txs = [tx for tx in data["result"] if int(tx["timeStamp"]) >= cutoff]
    
    incoming = 0
    outgoing = 0
    for tx in txs:
        if contract:
            value = int(tx["value"]) / 10**18
        else:
            value = int(tx["value"]) / 10**18
        
        if tx.get("to", "").lower() == address.lower():
            incoming += value
        elif tx.get("from", "").lower() == address.lower():
            outgoing += value
    
    return txs, incoming, outgoing

# ==========================================
# 4. ФУНКЦИИ ДЛЯ BITCOIN
# ==========================================
def get_btc_balance(address):
    """Get BTC balance from mempool.space"""
    try:
        resp = requests.get(f"https://mempool.space/api/address/{address}")
        data = resp.json()
        return data.get("chain_stats", {}).get("balance", 0) / 10**8
    except:
        return 0

def get_btc_transactions(address, days=30):
    """Get BTC transactions"""
    try:
        resp = requests.get(f"https://mempool.space/api/address/{address}/txs")
        data = resp.json()
        
        now = int(time.time())
        cutoff = now - days * 86400
        
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
# 5. ФУНКЦИИ ДЛЯ SOLANA
# ==========================================
def get_sol_balance(address):
    """Get SOL balance from Solscan"""
    try:
        headers = {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDM2MjA5ODU5MjQsImVtYWlsIjoiYW5kcmV5LmR2b3JvdkBnbWFpbC5jb20iLCJhY3Rpb24iOiJmcmVlIn0.RV3vV3ulV0qXq6hVxg3Lsxf8oJq9sWvD7PqVqVqVqVq"}
        resp = requests.get(f"https://public-api.solscan.io/account/{address}", headers=headers)
        data = resp.json()
        return data.get("lamports", 0) / 10**9
    except:
        return 0

def get_sol_transactions(address, days=30):
    """Get SOL transactions"""
    try:
        headers = {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDM2MjA5ODU5MjQsImVtYWlsIjoiYW5kcmV5LmR2b3JvdkBnbWFpbC5jb20iLCJhY3Rpb24iOiJmcmVlIn0.RV3vV3ulV0qXq6hVxg3Lsxf8oJq9sWvD7PqVqVqVqVq"}
        resp = requests.get(f"https://public-api.solscan.io/account/transactions?account={address}&limit=100", headers=headers)
        data = resp.json()
        
        now = int(time.time())
        cutoff = now - days * 86400
        
        txs = [tx for tx in data if tx.get("blockTime", 0) >= cutoff]
        
        incoming = 0
        outgoing = 0
        for tx in txs:
            for detail in tx.get("tokenTransfers", []):
                if detail.get("toAddress") == address:
                    incoming += detail.get("tokenAmount", 0) / 10**9
                if detail.get("fromAddress") == address:
                    outgoing += detail.get("tokenAmount", 0) / 10**9
        
        return txs, incoming, outgoing
    except:
        return [], 0, 0

# ==========================================
# 6. FLASK APP
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
    coin = data.get('coin', 'ETH')
    network = data.get('network', 'ethereum')
    days = int(data.get('days', 30))
    
    # BTC
    if coin == "BTC":
        balance = get_btc_balance(address)
        txs, incoming, outgoing = get_btc_transactions(address, days)
        decimals = 8
        
        # Daily data for chart
        daily = defaultdict(int)
        now_ts = int(time.time())
        for i in range(days):
            day_date = datetime.fromtimestamp(now_ts - i * 86400).strftime('%Y-%m-%d')
            daily[day_date] = 0
        
        for tx in txs:
            ts = tx.get("status", {}).get("block_time", 0)
            if ts:
                tx_date = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                if tx_date in daily:
                    daily[tx_date] += 1
        
        daily_data = [{'date': d, 'count': daily[d]} for d in sorted(daily.keys())]
        
        return jsonify({
            'balance': round(balance, 6),
            'txCount': len(txs),
            'incoming': round(incoming, 6),
            'outgoing': round(outgoing, 6),
            'insight': "Bitcoin analysis completed",
            'topSenders': [],
            'topReceivers': [],
            'dailyData': daily_data
        })
    
    # SOL
    if coin == "SOL":
        balance = get_sol_balance(address)
        txs, incoming, outgoing = get_sol_transactions(address, days)
        decimals = 9
        
        daily = defaultdict(int)
        now_ts = int(time.time())
        for i in range(days):
            day_date = datetime.fromtimestamp(now_ts - i * 86400).strftime('%Y-%m-%d')
            daily[day_date] = 0
        
        for tx in txs:
            ts = tx.get("blockTime", 0)
            if ts:
                tx_date = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                if tx_date in daily:
                    daily[tx_date] += 1
        
        daily_data = [{'date': d, 'count': daily[d]} for d in sorted(daily.keys())]
        
        return jsonify({
            'balance': round(balance, 6),
            'txCount': len(txs),
            'incoming': round(incoming, 6),
            'outgoing': round(outgoing, 6),
            'insight': "Solana analysis completed",
            'topSenders': [],
            'topReceivers': [],
            'dailyData': daily_data
        })
    
    # EVM coins (ETH, BNB, USDT)
    if coin in ["ETH", "BNB", "USDT"]:
        if coin == "USDT":
            contract = USDT_CONTRACTS.get(network)
            if not contract:
                return jsonify({'error': 'Network not supported for USDT'}), 400
            balance = get_evm_balance(address, network, contract)
            txs, incoming, outgoing = get_evm_transactions(address, network, days, contract)
        else:
            balance = get_evm_balance(address, network)
            txs, incoming, outgoing = get_evm_transactions(address, network, days)
        
        # Daily data
        daily = defaultdict(int)
        now_ts = int(time.time())
        for i in range(days):
            day_date = datetime.fromtimestamp(now_ts - i * 86400).strftime('%Y-%m-%d')
            daily[day_date] = 0
        
        for tx in txs:
            ts = int(tx.get("timeStamp", 0))
            if ts:
                tx_date = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                if tx_date in daily:
                    daily[tx_date] += 1
        
        daily_data = [{'date': d, 'count': daily[d]} for d in sorted(daily.keys())]
        
        insight = "You receive more than you send" if incoming > outgoing else "You spend more than you receive" if outgoing > incoming else "Balance of flows is approximately equal"
        
        return jsonify({
            'balance': round(balance, 6),
            'txCount': len(txs),
            'incoming': round(incoming, 6),
            'outgoing': round(outgoing, 6),
            'insight': insight,
            'topSenders': [],
            'topReceivers': [],
            'dailyData': daily_data
        })
    
    return jsonify({'error': 'Coin not supported'}), 400

def run_flask():
    flask_app.run(host='0.0.0.0', port=8080)

threading.Thread(target=run_flask, daemon=True).start()

# ==========================================
# 7. TELEGRAM BOT
# ==========================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton("Open App", web_app=WebAppInfo(url="https://crypto-bot-production-d6b8.up.railway.app"))]]
    await update.message.reply_text("Click the button:", reply_markup=InlineKeyboardMarkup(keyboard))

app = ApplicationBuilder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))

print("Bot started...")
app.run_polling()
