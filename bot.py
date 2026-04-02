# ==========================================
# 1. ИМПОРТЫ
# ==========================================
import requests
import time
import datetime
import io
from collections import Counter
import matplotlib.pyplot as plt
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
import threading
import os

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler

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

# ==========================================
# 4. АНАЛИЗ ТРАНЗАКЦИЙ
# ==========================================
def analyze_transactions(txs, address):
    incoming = 0
    outgoing = 0
    gas_total = 0
    for tx in txs:
        value_eth = int(tx["value"]) / 10**18
        gas_fee = int(tx.get("gasUsed", 0)) * int(tx.get("gasPrice", 0)) / 10**18
        if tx["to"] and tx["to"].lower() == address.lower():
            incoming += value_eth
        elif tx["from"] and tx["from"].lower() == address.lower():
            outgoing += value_eth
            gas_total += gas_fee
    return incoming, outgoing, gas_total, len(txs)

def generate_insights(incoming, outgoing):
    if incoming > outgoing:
        return "Ты больше получаешь, чем отправляешь"
    elif outgoing > incoming:
        return "Ты больше тратишь, чем получаешь"
    else:
        return "Баланс потоков примерно равный"

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
# 5. ГРАФИКИ
# ==========================================
def plot_transactions(txs, address):
    flows = {}
    for tx in txs:
        ts = int(tx["timeStamp"])
        day = datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        value_eth = int(tx["value"]) / 10**18
        if day not in flows:
            flows[day] = {"in": 0, "out": 0}
        if tx["to"].lower() == address.lower():
            flows[day]["in"] += value_eth
        elif tx["from"].lower() == address.lower():
            flows[day]["out"] += value_eth
    days = sorted(flows.keys())
    incoming = [flows[d]["in"] for d in days]
    outgoing = [flows[d]["out"] for d in days]
    plt.figure(figsize=(8,4))
    plt.bar(days, incoming, label="Incoming", color="green")
    plt.bar(days, outgoing, label="Outgoing", bottom=incoming, color="red")
    plt.xticks(rotation=45)
    plt.ylabel("ETH")
    plt.title("Транзакции за последние дни")
    plt.legend()
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png")
    buf.seek(0)
    plt.close()
    return buf

# ==========================================
# 6. TELEGRAM БОТ (ОБРАБОТЧИКИ)
# ==========================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    keyboard = [
        [
            InlineKeyboardButton("ETH", callback_data="token_ETH"),
            InlineKeyboardButton("USDT", callback_data="token_USDT"),
        ],
        [
            InlineKeyboardButton(
                "🚀 Открыть приложение",
                web_app=WebAppInfo(url="https://crypto-bot-production-d6b8.up.railway.app")
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Выберите токен или откройте приложение:", reply_markup=reply_markup)

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    chat_id = query.message.chat_id
    if data.startswith("token_"):
        context.user_data["token"] = data.split("_")[1]
        keyboard = [[InlineKeyboardButton("7 дней", callback_data="days_7"), InlineKeyboardButton("30 дней", callback_data="days_30")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await context.bot.send_message(chat_id=chat_id, text=f"Выбран токен: {context.user_data['token']}\nТеперь выберите период:", reply_markup=reply_markup)
    elif data.startswith("days_"):
        context.user_data["days"] = int(data.split("_")[1])
        token = context.user_data.get("token", "ETH")
        days = context.user_data.get("days", 7)
        await context.bot.send_message(chat_id=chat_id, text=f"Выбран токен: {token}\nПериод: {days} дней\nТеперь отправь адрес кошелька.")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    address = update.message.text.strip()
    token = context.user_data.get("token", "ETH")
    days = context.user_data.get("days", 7)
    if not (address.startswith("0x") and len(address) == 42):
        await update.message.reply_text("Некорректный адрес")
        return
    await update.message.reply_text(f"Анализирую {token} за {days} дней...")
    decimals = 18 if token == "ETH" else 6
    if token == "ETH":
        balance = get_eth_balance(address)
        txs = get_recent_transactions(address, days)
        incoming, outgoing, gas_total, count = analyze_transactions(txs, address)
    else:
        balance = get_token_balance(address, USDT_CONTRACT)
        txs = get_token_transactions(address, USDT_CONTRACT, days)
        incoming, outgoing = 0, 0
        for tx in txs:
            value = int(tx["value"]) / 10**6
            if tx["to"].lower() == address.lower():
                incoming += value
            elif tx["from"].lower() == address.lower():
                outgoing += value
        gas_total = 0
        count = len(txs)
        decimals = 6
    insight = generate_insights(incoming, outgoing)
    top_in, top_out = top_addresses(txs, address, decimals=decimals)
    top_in_text = "\n".join([f"{addr}: {val:.4f} {token}" for addr, val in top_in]) or "нет"
    top_out_text = "\n".join([f"{addr}: {val:.4f} {token}" for addr, val in top_out]) or "нет"
    msg = (f"Баланс: {balance:.6f} {token}\n\nТранзакций: {count}\nПолучено: {incoming:.6f} {token}\nОтправлено: {outgoing:.6f} {token}\nКомиссии: {gas_total:.6f} ETH\n\nИнсайт: {insight}\n\nТоп отправителей:\n{top_in_text}\n\nТоп получателей:\n{top_out_text}")
    await update.message.reply_text(msg)
    if txs and token == "ETH":
        buf = plot_transactions(txs, address)
        await update.message.reply_photo(photo=buf)

# ==========================================
# 7. FLASK ДЛЯ ВЕБ-ПРИЛОЖЕНИЯ
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
    
    decimals = 18 if token == "ETH" else 6
    if token == "ETH":
        balance = get_eth_balance(address)
        txs = get_recent_transactions(address, days)
        incoming, outgoing, gas_total, count = analyze_transactions(txs, address)
    else:
        balance = get_token_balance(address, USDT_CONTRACT)
        txs = get_token_transactions(address, USDT_CONTRACT, days)
        incoming, outgoing = 0, 0
        for tx in txs:
            value = int(tx["value"]) / 10**6
            if tx["to"].lower() == address.lower():
                incoming += value
            elif tx["from"].lower() == address.lower():
                outgoing += value
        gas_total = 0
        count = len(txs)
    
    insight = generate_insights(incoming, outgoing)
    top_in, top_out = top_addresses(txs, address, decimals=decimals)
    
    return jsonify({
        'balance': round(balance, 6),
        'txCount': count,
        'incoming': round(incoming, 6),
        'outgoing': round(outgoing, 6),
        'insight': insight,
        'topSenders': [[addr, val] for addr, val in top_in],
        'topReceivers': [[addr, val] for addr, val in top_out]
    })

def run_flask():
    flask_app.run(host='0.0.0.0', port=8080)

threading.Thread(target=run_flask, daemon=True).start()

# ==========================================
# 8. ЗАПУСК TELEGRAM БОТА
# ==========================================
app = ApplicationBuilder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
app.add_handler(CallbackQueryHandler(button_callback))

print("Бот запущен...")
app.run_polling()
