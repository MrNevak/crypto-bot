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

CHAIN_IDS = {
    "ethereum": 1,
    "bsc": 56,
    "polygon": 137,
    "arbitrum": 42161,
    "optimism": 10,
}

USDT_CONTRACTS = {
    "ethereum": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "bsc": "0x55d398326f99059fF775485246999027B3197955",
    "polygon": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "arbitrum": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "optimism": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
}

def get_evm_balance(address, chain, contract=None):
    chain_id = CHAIN_IDS.get(chain)
    if not chain_id:
        return 0
    
    url = "https://api.etherscan.io/v2/api"
    
    if contract:
        params = {
            "chainid": chain_id,
            "module": "account",
            "action": "tokenbalance",
            "contractaddress": contract,
            "address": address,
            "tag": "latest",
            "apikey": ETHERSCAN_API_KEY
        }
    else:
        params = {
            "chainid": chain_id,
            "module": "account",
            "action": "balance",
            "address": address,
            "tag": "latest",
            "apikey": ETHERSCAN_API_KEY
        }
    
    resp = requests.get(url, params=params)
    data = resp.json()
    
    if data.get("status") == "1":
        raw = int(data["result"])
        if contract and "dAC17F958D2ee523a2206206994597C13D831ec7" in contract.lower():
            return raw / 10**6
        return raw / 10**18
    return 0

def get_evm_transactions(address, chain, days=30, contract=None):
    chain_id = CHAIN_IDS.get(chain)
    if not chain_id:
        return [], 0, 0
    
    url = "https://api.etherscan.io/v2/api"
    cutoff = int(time.time()) - days * 86400
    
    if contract:
        params = {
            "chainid": chain_id,
            "module": "account",
            "action": "tokentx",
            "contractaddress": contract,
            "address": address,
            "startblock": "0",
            "endblock": "99999999",
            "sort": "desc",
            "apikey": ETHERSCAN_API_KEY
        }
    else:
        params = {
            "chainid": chain_id,
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
    
    txs = [tx for tx in data["result"] if int(tx["timeStamp"]) >= cutoff]
    
    incoming = 0
    outgoing = 0
    
    for tx in txs:
        if contract:
            val = int(tx["value"])
            if "dAC17F958D2ee523a2206206994597C13D831ec7" in contract.lower():
                val = val / 10**6
            else:
                val = val / 10**18
        else:
            val = int(tx["value"]) / 10**18
        
        if tx.get("to", "").lower() == address.lower():
            incoming += val
        elif tx.get("from", "").lower() == address.lower():
            outgoing += val
    
    return txs, incoming, outgoing

def get_btc_balance(address):
    try:
        resp = requests.get(f"https://mempool.space/api/address/{address}")
        return resp.json().get("chain_stats", {}).get("balance", 0) / 10**8
    except:
        return 0

def get_btc_transactions(address, days=30):
    try:
        resp = requests.get(f"https://mempool.space/api/address/{address}/txs")
        data = resp.json()
        cutoff = int(time.time()) - days * 86400
        txs = [tx for tx in data if tx.get("status", {}).get("block_time", 0) >= cutoff]
        incoming = outgoing = 0
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

def get_sol_balance(address):
    try:
        headers = {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDM2MjA5ODU5MjQsImVtYWlsIjoiYW5kcmV5LmR2b3JvdkBnbWFpbC5jb20iLCJhY3Rpb24iOiJmcmVlIn0.RV3vV3ulV0qXq6hVxg3Lsxf8oJq9sWvD7PqVqVqVqVq"}
        resp = requests.get(f"https://public-api.solscan.io/account/{address}", headers=headers)
        return resp.json().get("lamports", 0) / 10**9
    except:
        return 0

def get_sol_transactions(address, days=30):
    try:
        headers = {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDM2MjA5ODU5MjQsImVtYWlsIjoiYW5kcmV5LmR2b3JvdkBnbWFpbC5jb20iLCJhY3Rpb24iOiJmcmVlIn0.RV3vV3ulV0qXq6hVxg3Lsxf8oJq9sWvD7PqVqVqVqVq"}
        resp = requests.get(f"https://public-api.solscan.io/account/transactions?account={address}&limit=100", headers=headers)
        data = resp.json()
        cutoff = int(time.time()) - days * 86400
        txs = [tx for tx in data if tx.get("blockTime", 0) >= cutoff]
        incoming = outgoing = 0
        for tx in txs:
            for detail in tx.get("tokenTransfers", []):
                if detail.get("toAddress") == address:
                    incoming += detail.get("tokenAmount", 0) / 10**9
                if detail.get("fromAddress") == address:
                    outgoing += detail.get("tokenAmount", 0) / 10**9
        return txs, incoming, outgoing
    except:
        return [], 0, 0

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
    
    print(f"Analyzing: coin={coin}, network={network}, address={address}")
    
    if coin == "BTC":
        balance = get_btc_balance(address)
        txs, incoming, outgoing = get_btc_transactions(address, days)
    elif coin == "SOL":
        balance = get_sol_balance(address)
        txs, incoming, outgoing = get_sol_transactions(address, days)
    elif coin in ["ETH", "BNB", "USDT"]:
        if coin == "USDT":
            contract = USDT_CONTRACTS.get(network)
            if not contract:
                return jsonify({'error': f'Network {network} not supported for USDT'}), 400
            balance = get_evm_balance(address, network, contract)
            txs, incoming, outgoing = get_evm_transactions(address, network, days, contract)
        else:
            balance = get_evm_balance(address, network)
            txs, incoming, outgoing = get_evm_transactions(address, network, days)
    else:
        return jsonify({'error': 'Coin not supported'}), 400
    
    # Daily data for chart
    daily = defaultdict(int)
    now_ts = int(time.time())
    for i in range(days):
        day_date = datetime.fromtimestamp(now_ts - i * 86400).strftime('%Y-%m-%d')
        daily[day_date] = 0
    
    for tx in txs:
        ts = tx.get("timeStamp") or tx.get("status", {}).get("block_time") or tx.get("blockTime", 0)
        if ts:
            tx_date = datetime.fromtimestamp(int(ts)).strftime('%Y-%m-%d')
            if tx_date in daily:
                daily[tx_date] += 1
    
    daily_data = [{'date': d, 'count': daily[d]} for d in sorted(daily.keys())]
    
    insight = "You receive more than you send" if incoming > outgoing else "You spend more than you receive" if outgoing > incoming else "Balance of flows is approximately equal"
    
    result = {
        'balance': round(balance, 6),
        'txCount': len(txs),
        'incoming': round(incoming, 6),
        'outgoing': round(outgoing, 6),
        'insight': insight,
        'topSenders': [],
        'topReceivers': [],
        'dailyData': daily_data
    }
    
    print(f"Result: balance={result['balance']}")
    return jsonify(result)

def run_flask():
    flask_app.run(host='0.0.0.0', port=8080)

threading.Thread(target=run_flask, daemon=True).start()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton("Open App", web_app=WebAppInfo(url="https://crypto-bot-production-d6b8.up.railway.app"))]]
    await update.message.reply_text("Click the button:", reply_markup=InlineKeyboardMarkup(keyboard))

app = ApplicationBuilder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))

print("Bot started...")
app.run_polling()
