# ==========================================
# 1. ИМПОРТЫ
# ==========================================
import requests
import time
import datetime
import io
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
import threading

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# ==========================================
# 2. НАСТРОЙКИ И КОНСТАНТЫ
# ==========================================
logging.basicConfig(level=logging.INFO)

TOKEN = "8631940655:AAEGkEEL3yHKMUB-qI0K9sYyFOyBaclnc10"
ETHERSCAN_API_KEY = "4YDW7PM5GMKMVU7GZC3BGRCI2M957VHTX5"
USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"

# ==========================================
# 3. ФУНКЦИИ ДЛЯ РАБОТЫ С ETHERSCAN
# ==========================================
def get_eth_balance(address: str):
    url = "https://api.etherscan.io/v2/api"
    params = {
        "module": "account",
        "action": "balance",
        "address": address,
        "tag": "latest",
        "chainid": "1",
        "apikey": ETHERSCAN_API_KEY
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    if data.get("status") == "1":
        return int(data["result"]) / 10**18
    return 0

def get_recent_transactions(address: str, days: int = 7):
    now = int(time.time())
    cutoff = now - days*86400
    url = "https://api.etherscan.io/v2/api"
    params = {
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": "0",
        "endblock": "99999999",
        "sort": "desc",
        "chainid": "1",
        "apikey": ETHERSCAN_API_KEY
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    if data.get("status") != "1":
        return []
    txs = [tx for tx in data["result"] if int(tx["timeStamp"]) >= cutoff]
    return txs

def get_token_transactions(address, contract=USDT_CONTRACT, days=7):
    now = int(time.time())
    cutoff = now - days*86400
    url = "https://api.etherscan.io/v2/api"
    params = {
        "module": "account",
        "action": "tokentx",
        "contractaddress": contract,
        "address": address,
        "startblock": "0",
        "endblock": "99999999",
        "sort": "desc",
        "chainid": "1",
        "apikey": ETHERSCAN_API_KEY
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    if data.get("status") != "1":
        return []
    txs = [tx for tx in data["result"] if int(tx["timeStamp"]) >= cutoff]
    return txs

def get_token_balance(address, contract=USDT_CONTRACT):
    url = "https://api.etherscan.io/v2/api"
    params = {
        "module": "account",
        "action": "tokenbalance",
        "contractaddress": contract,
        "address": address,
        "tag": "latest",
        "chainid": "1",
        "apikey": ETHERSCAN_API_KEY
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    if data.get("status") != "1":
        return 0
    return int(data["result"]) / 10**6

def get_eth_transactions_analysis(address, days):
    txs = get_recent_transactions(address, days)
    incoming = 0
    outgoing = 0
    for tx in txs:
        value_eth = int(tx["value"]) / 10**18
        if tx["to"] and tx["to"].lower() == address.lower():
            incoming += value_eth
        elif tx["from"] and tx["from"].lower() == address.lower():
            outgoing += value_eth
    return incoming, outgoing, len(txs), txs

def get_usdt_transactions_analysis(address, days):
    txs = get_token_transactions(address, USDT_CONTRACT, days)
    incoming = 0
    outgoing = 0
    for tx in txs:
        value = int(tx["value"]) / 10**6
        if tx["to"].lower() == address.lower():
            incoming += value
        elif tx["from"].lower() == address.lower():
            outgoing += value
    return incoming, outgoing, len(txs), txs

def generate_insights(incoming, outgoing):
    if incoming > outgoing:
        return "You receive more than you send"
    elif outgoing > incoming:
        return "You spend more than you receive"
    else:
        return "Balance of flows is approximately equal"

def top_addresses(txs, address, n=3, decimals=18):
    incoming = Counter()
    outgoing = Counter()
    for tx in txs:
        value = int(tx["value"]) / (10**decimals)
        if value == 0:
            continue
        if tx["to"].lower() == address.lower():
            frm = tx["from"].lower()
            incoming[frm] += value
        elif tx["from"].lower() == address.lower():
            to = tx["to"].lower()
            outgoing[to] += value
    return incoming.most_common(n), outgoing.most_common(n)

# ==========================================
# 4. TELEGRAM БОТ
# ==========================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton("🚀 Открыть приложение", web_app=WebAppInfo(url="https://crypto-bot-production-d6b8.up.railway.app"))]]
    await update.message.reply_text("Нажмите кнопку:", reply_markup=InlineKeyboardMarkup(keyboard))

# ==========================================
# 5. FLASK ДЛЯ ВЕБ-ПРИЛОЖЕНИЯ
# ==========================================
flask_app = Flask(__name__, static_folder='webapp', static_url_path='')

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
    token = data.get('token', 'ETH')
    days = int(data.get('days', 7))
    
    if token == "ETH":
        balance = get_eth_balance(address)
        incoming, outgoing, count, txs = get_eth_transactions_analysis(address, days)
        decimals = 18
    else:
        balance = get_token_balance(address, USDT_CONTRACT)
        incoming, outgoing, count, txs = get_usdt_transactions_analysis(address, days)
        decimals = 6
    
    insight = generate_insights(incoming, outgoing)
    top_in, top_out = top_addresses(txs, address, decimals=decimals)
    
    # Подсчёт транзакций - 7 дней = 7 точек, 30 дней = 4 недели
    from collections import defaultdict
    
    if days == 7:
        # 7 дней - 7 точек
        daily = defaultdict(int)
        now_ts = int(time.time())
        for i in range(7):
            day_date = datetime.fromtimestamp(now_ts - i * 86400).strftime('%Y-%m-%d')
            daily[day_date] = 0
        
        for tx in txs:
            ts = int(tx.get('timeStamp', 0))
            if ts:
                tx_date = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                if tx_date in daily:
                    daily[tx_date] += 1
        
        daily_data = [{'date': d, 'count': daily[d]} for d in sorted(daily.keys())]
    
    else:  # 30 дней - группируем по неделям
        weekly = defaultdict(int)
        now_ts = int(time.time())
        
        # Создаём 4 недели
        for week in range(4):
            week_start = now_ts - (week + 1) * 7 * 86400
            week_end = now_ts - week * 7 * 86400
            week_label = f"Week {4 - week}"
            weekly[week_label] = 0
        
        for tx in txs:
            ts = int(tx.get('timeStamp', 0))
            if ts:
                for week in range(4):
                    week_start = now_ts - (week + 1) * 7 * 86400
                    week_end = now_ts - week * 7 * 86400
                    if week_start <= ts < week_end:
                        weekly[f"Week {4 - week}"] += 1
                        break
        
        daily_data = [{'date': k, 'count': v} for k, v in sorted(weekly.items())]
    
    return jsonify({
        'balance': round(balance, 6),
        'txCount': count,
        'incoming': round(incoming, 6),
        'outgoing': round(outgoing, 6),
        'insight': insight,
        'topSenders': [[addr, val] for addr, val in top_in],
        'topReceivers': [[addr, val] for addr, val in top_out],
        'dailyData': daily_data
    })

def run_flask():
    flask_app.run(host='0.0.0.0', port=8080)

threading.Thread(target=run_flask, daemon=True).start()

# ==========================================
# 6. ЗАПУСК TELEGRAM БОТА
# ==========================================
app = ApplicationBuilder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))

print("Бот запущен...")
app.run_polling()
