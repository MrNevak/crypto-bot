let tg = window.Telegram.WebApp;
tg.expand();

let selectedCoin = null;
let selectedNetwork = null;
let selectedDays = 30;
let chart = null;
let currentDailyData = null;
let animationFrame = null;
let isAnimating = false;
let animationDuration = 4000;

const API_URL = 'https://crypto-bot-production-d6b8.up.railway.app';

// Все сети для каждой монеты
const networks = {
    BTC: [{ id: "bitcoin", name: "Bitcoin", icon: "icons/bitcoin-btc-logo.svg", description: "Bitcoin Mainnet" }],
    ETH: [
        { id: "ethereum", name: "Ethereum", icon: "icons/ethereum-eth-logo.svg", description: "ERC-20" },
        { id: "arbitrum", name: "Arbitrum", icon: "icons/arbitrum-arb-logo.svg", description: "Arbitrum One" },
        { id: "optimism", name: "Optimism", icon: "icons/optimism-ethereum-op-logo.svg", description: "OP Mainnet" },
        { id: "polygon", name: "Polygon", icon: "icons/polygon-matic-logo.svg", description: "MATIC" },
        { id: "base", name: "Base", icon: "icons/base-logo-in-blue.svg", description: "Base Chain" },
        { id: "avalanche", name: "Avalanche", icon: "icons/avalanche-avax-logo.svg", description: "AVAX C-Chain" }
    ],
    USDT: [
        { id: "ethereum", name: "Ethereum", icon: "icons/ethereum-eth-logo.svg", description: "ERC-20" },
        { id: "bsc", name: "BNB Chain", icon: "icons/bnb-bnb-logo.svg", description: "BEP-20" },
        { id: "polygon", name: "Polygon", icon: "icons/polygon-matic-logo.svg", description: "MATIC" },
        { id: "arbitrum", name: "Arbitrum", icon: "icons/arbitrum-arb-logo.svg", description: "Arbitrum" },
        { id: "optimism", name: "Optimism", icon: "icons/optimism-ethereum-op-logo.svg", description: "Optimism" },
        { id: "avalanche", name: "Avalanche", icon: "icons/avalanche-avax-logo.svg", description: "AVAX" }
    ],
    BNB: [{ id: "bsc", name: "BNB Chain", icon: "icons/bnb-bnb-logo.svg", description: "BSC Mainnet" }],
    SOL: [{ id: "solana", name: "Solana", icon: "icons/solana-sol-logo.svg", description: "Solana Mainnet" }],
    TON: [{ id: "ton", name: "TON", icon: "icons/toncoin-ton-logo.svg", description: "TON Mainnet" }]
};

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })}`;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function animateChart(chart, targetData, startData, duration, startTime) {
    if (!isAnimating) return;
    const now = performance.now();
    const elapsed = now - startTime;
    let progress = Math.min(1, elapsed / duration);
    progress = easeOutCubic(progress);
    const currentData = startData.map((start, i) => start + (targetData[i] - start) * progress);
    chart.data.datasets[0].data = currentData;
    chart.update('none');
    if (progress < 1) {
        animationFrame = requestAnimationFrame(() => animateChart(chart, targetData, startData, duration, startTime));
    } else {
        chart.data.datasets[0].data = targetData;
        chart.update('none');
        isAnimating = false;
        animationFrame = null;
    }
}

function stopAnimation() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    isAnimating = false;
    animationFrame = null;
}

function startAnimation(chart, targetData, startData, duration) {
    stopAnimation();
    isAnimating = true;
    const startTime = performance.now();
    animationFrame = requestAnimationFrame(() => animateChart(chart, targetData, startData, duration, startTime));
}

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
    (networks[coin] || []).forEach(net => {
        const div = document.createElement('div');
        div.className = 'network-card';
        div.innerHTML = `<img src="${net.icon}" class="network-icon-img" alt="${net.name}"><div class="network-info"><h4>${net.name}</h4><p>${net.description}</p></div>`;
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
    
    let placeholder = 'Enter wallet address (0x...)';
    if (selectedCoin === 'BTC') placeholder = 'Enter Bitcoin address';
    if (selectedCoin === 'SOL') placeholder = 'Enter Solana address';
    if (selectedCoin === 'TON') placeholder = 'Enter TON address';
    document.getElementById('walletAddress').placeholder = placeholder;
    
    document.getElementById('walletAddress').value = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('showChartBtn').style.display = 'none';
    currentDailyData = null;
}

function displayResults(data) {
    // Баланс в выбранной валюте
    document.getElementById('balance').innerHTML = `${data.balance} ${selectedCoin}`;
    
    // Конвертация в USD
    const usdEl = document.getElementById('balanceUsd');
    if (usdEl && data.balanceUsd !== undefined && data.balanceUsd > 0) {
        usdEl.innerHTML = `≈ $${data.balanceUsd} USD`;
        usdEl.style.display = 'block';
    } else if (usdEl) {
        usdEl.style.display = 'none';
    }
    
    document.getElementById('txCount').innerHTML = data.txCount;
    document.getElementById('incoming').innerHTML = `${data.incoming} ${selectedCoin}`;
    document.getElementById('outgoing').innerHTML = `${data.outgoing} ${selectedCoin}`;
    document.getElementById('insight').innerHTML = data.insight;
    document.getElementById('results').style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('showChartBtn').style.display = data.dailyData?.length > 0 ? 'block' : 'none';
    
    currentDailyData = data.dailyData;
    tg.ready();
}

function showChartModal(dailyData) {
    const canvas = document.getElementById('txChartModal');
    if (!dailyData?.length) return;
    const labels = dailyData.map(d => d.date.includes('Week') ? d.date : formatDate(d.date));
    const targetData = dailyData.map(d => d.count);
    const maxValue = Math.max(...targetData, 1);
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Transactions', data: new Array(targetData.length).fill(0), borderColor: '#D4C4A8', backgroundColor: 'rgba(212,196,168,0.05)', borderWidth: 3, pointRadius: 5, pointHoverRadius: 8, pointBackgroundColor: '#F0E1B9', pointBorderColor: '#0a0a0a', pointBorderWidth: 2, tension: 0.4, fill: true }] },
        options: { responsive: true, maintainAspectRatio: true, animation: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a1a', titleColor: '#F0E1B9', bodyColor: '#aaa', borderColor: '#D4C4A8', borderWidth: 1 } }, scales: { y: { beginAtZero: true, max: maxValue, grid: { color: 'rgba(212,196,168,0.1)' }, ticks: { color: '#aaa', stepSize: Math.ceil(maxValue / 5) || 1 } }, x: { grid: { display: false }, ticks: { color: '#aaa', maxRotation: 45, autoSkip: true } } } }
    });
    document.getElementById('chartModal').style.display = 'flex';
    setTimeout(() => { if (chart && !isAnimating) startAnimation(chart, targetData, new Array(targetData.length).fill(0), animationDuration); }, 100);
}

// BUTTONS
document.getElementById('startWorkBtn').onclick = showOptionsScreen;
document.getElementById('analyzeWalletCard').onclick = showCoinScreen;
document.getElementById('portfolioCard').onclick = () => tg.showPopup({ title: 'Coming Soon', message: 'Portfolio Tracker will be available soon!' });
document.getElementById('backToOptions').onclick = showOptionsScreen;
document.getElementById('backToCoin').onclick = showCoinScreen;
document.getElementById('backToNetwork').onclick = showCoinScreen;
document.getElementById('backBtn').onclick = () => { stopAnimation(); document.getElementById('chartModal').style.display = 'none'; };

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
    document.getElementById('showChartBtn').style.display = 'none';
    
    try {
        const response = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, coin: selectedCoin, network: selectedNetwork, days: selectedDays })
        });
        const data = await response.json();
        document.getElementById('loading').style.display = 'none';
        if (data.error) {
            tg.showPopup({ title: 'Error', message: data.error });
            return;
        }
        displayResults(data);
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        tg.showPopup({ title: 'Error', message: 'Failed to connect to server' });
    }
};
document.getElementById('showChartBtn').onclick = () => {
    if (currentDailyData && currentDailyData.length > 0) {
        showChartModal(currentDailyData);
    } else {
        // Тестовый график если нет данных
        const canvas = document.getElementById('txChartModal');
        if (canvas) {
            new Chart(canvas, {
                type: 'line',
                data: { labels: ['No data'], datasets: [{ label: 'Transactions', data: [0] }] }
            });
            document.getElementById('chartModal').style.display = 'flex';
        }
    }
};
showWelcome();
