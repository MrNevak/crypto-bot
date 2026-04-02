let tg = window.Telegram.WebApp;
tg.expand();

let selectedToken = 'ETH';
let selectedDays = 7;

const API_URL = 'https://crypto-bot-production-d6b8.up.railway.app';

document.querySelectorAll('.token-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.token-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedToken = btn.dataset.token;
    });
});

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDays = parseInt(btn.dataset.days);
    });
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const address = document.getElementById('walletAddress').value.trim();
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
        tg.showPopup({ title: 'Error', message: 'Enter a valid wallet address (0x...)', buttons: [{type: 'ok'}] });
        return;
    }
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    
    try {
        const response = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, token: selectedToken, days: selectedDays })
        });
        
        const data = await response.json();
        document.getElementById('loading').classList.add('hidden');
        displayResults(data);
    } catch (error) {
        document.getElementById('loading').classList.add('hidden');
        tg.showPopup({ title: 'Error', message: 'Failed to connect to server', buttons: [{type: 'ok'}] });
    }
});

function displayResults(data) {
    document.getElementById('balance').textContent = `${data.balance} ${selectedToken}`;
    document.getElementById('txCount').textContent = data.txCount;
    document.getElementById('incoming').textContent = `${data.incoming} ${selectedToken}`;
    document.getElementById('outgoing').textContent = `${data.outgoing} ${selectedToken}`;
    document.getElementById('insight').textContent = data.insight;
    document.getElementById('gasFees').textContent = `0 ETH`;
    
    if (data.topSenders && data.topSenders.length > 0) {
        document.getElementById('topSenders').innerHTML = data.topSenders.map(([addr, val]) => 
            `<div>${addr.slice(0,6)}...${addr.slice(-4)}: ${val.toFixed(4)} ${selectedToken}</div>`
        ).join('');
    } else {
        document.getElementById('topSenders').innerHTML = 'no data';
    }
    
    if (data.topReceivers && data.topReceivers.length > 0) {
        document.getElementById('topReceivers').innerHTML = data.topReceivers.map(([addr, val]) => 
            `<div>${addr.slice(0,6)}...${addr.slice(-4)}: ${val.toFixed(4)} ${selectedToken}</div>`
        ).join('');
    } else {
        document.getElementById('topReceivers').innerHTML = 'no data';
    }
    
    document.getElementById('results').classList.remove('hidden');
    tg.ready();
}
