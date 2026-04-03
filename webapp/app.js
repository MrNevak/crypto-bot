let tg = window.Telegram.WebApp;
tg.expand();

let selectedCoin = null;
let selectedNetwork = null;
let selectedDays = 30;

const API_URL = 'https://crypto-bot-production-d6b8.up.railway.app';

function showWelcome() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('optionsScreen').style.display = 'none';
    document.getElementById('coinScreen').style.display = 'none';
    document.getElementById('networkScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
}

function showOptionsScreen() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('optionsScreen').style.display = 'block';
    document.getElementById('coinScreen').style.display = 'none';
    document.getElementById('networkScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
}

function showCoinScreen() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('optionsScreen').style.display = 'none';
    document.getElementById('coinScreen').style.display = 'block';
    document.getElementById('networkScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
}

function showNetworkScreen(coin) {
    selectedCoin = coin;
    document.getElementById('coinScreen').style.display = 'none';
    document.getElementById('networkScreen').style.display = 'block';
    document.getElementById('selectedCoinName').textContent = coin + ' Networks';
    
    const list = document.getElementById('networksList');
    list.innerHTML = '';
    const networksList = [{ id: "ethereum", name: "Ethereum", icon: "⟠" }];
    networksList.forEach(net => {
        const div = document.createElement('div');
        div.className = 'network-card';
        div.innerHTML = `<div style="font-size:32px">${net.icon}</div><div><h4>${net.name}</h4></div>`;
        div.onclick = () => {
            selectedNetwork = net.id;
            showMainScreen();
        };
        list.appendChild(div);
    });
}

function showMainScreen() {
    document.getElementById('networkScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'block';
    document.getElementById('analysisTitle').textContent = selectedCoin + ' Analysis';
    document.getElementById('analysisSubtitle').textContent = 'Network: ' + selectedNetwork.toUpperCase();
    document.getElementById('walletAddress').value = '';
    document.getElementById('results').style.display = 'none';
}

function displayResults(data) {
    document.getElementById('balance').innerHTML = `${data.balance} ${selectedCoin}`;
    document.getElementById('txCount').innerHTML = data.txCount;
    document.getElementById('incoming').innerHTML = `${data.incoming} ${selectedCoin}`;
    document.getElementById('outgoing').innerHTML = `${data.outgoing} ${selectedCoin}`;
    document.getElementById('insight').innerHTML = data.insight;
    document.getElementById('results').style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    tg.ready();
}

// BUTTONS
document.getElementById('startWorkBtn').onclick = showOptionsScreen;
document.getElementById('analyzeWalletCard').onclick = showCoinScreen;
document.getElementById('backToOptions').onclick = showOptionsScreen;
document.getElementById('backToCoin').onclick = showCoinScreen;
document.getElementById('backToNetwork').onclick = showCoinScreen;

document.querySelectorAll('.coin-card').forEach(card => {
    card.onclick = () => showNetworkScreen(card.dataset.coin);
});

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDays = parseInt(btn.dataset.days);
    };
});

document.getElementById('analyzeBtn').onclick = async () => {
    const address = document.getElementById('walletAddress').value.trim();
    if (!address) {
        tg.showPopup({ title: 'Error', message: 'Enter wallet address' });
        return;
    }
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    
    const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, coin: selectedCoin, network: selectedNetwork, days: selectedDays })
    });
    const data = await response.json();
    displayResults(data);
};

showWelcome();
