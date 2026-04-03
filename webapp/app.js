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

// Network configurations with image icons
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
    
    BNB: [
        { id: "bsc", name: "BNB Chain", icon: "icons/bnb-bnb-logo.svg", description: "BSC Mainnet" }
    ],
    
    SOL: [
        { id: "solana", name: "Solana", icon: "icons/solana-sol-logo.svg", description: "Solana Mainnet" }
    ],
    
    TON: [
        { id: "ton", name: "TON", icon: "icons/toncoin-ton-logo.svg", description: "TON Mainnet" }
    ]
};

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    return `${day} ${month}`;
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
    
    const currentData = startData.map((start, i) => {
        const target = targetData[i];
        return start + (target - start) * progress;
    });
    
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
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    isAnimating = false;
}

function startAnimation(chart, targetData, startData, duration) {
    stopAnimation();
    isAnimating = true;
    const startTime = performance.now();
    animationFrame = requestAnimationFrame(() => animateChart(chart, targetData, startData, duration, startTime));
}

// Screen navigation
function showWelcome() {
    const welcome = document.getElementById('welcomeScreen');
    const options = document.getElementById('optionsScreen');
    const coin = document.getElementById('coinScreen');
    const network = document.getElementById('networkScreen');
    const main = document.getElementById('mainScreen');
    
    if (welcome) welcome.style.display = 'flex';
    if (options) options.style.display = 'none';
    if (coin) coin.style.display = 'none';
    if (network) network.style.display = 'none';
    if (main) main.style.display = 'none';
}

function showOptionsScreen() {
    const welcome = document.getElementById('welcomeScreen');
    const options = document.getElementById('optionsScreen');
    const coin = document.getElementById('coinScreen');
    const network = document.getElementById('networkScreen');
    const main = document.getElementById('mainScreen');
    
    if (welcome) welcome.style.display = 'none';
    if (options) options.style.display = 'block';
    if (coin) coin.style.display = 'none';
    if (network) network.style.display = 'none';
    if (main) main.style.display = 'none';
}

function showCoinScreen() {
    const welcome = document.getElementById('welcomeScreen');
    const options = document.getElementById('optionsScreen');
    const coin = document.getElementById('coinScreen');
    const network = document.getElementById('networkScreen');
    const main = document.getElementById('mainScreen');
    
    if (welcome) welcome.style.display = 'none';
    if (options) options.style.display = 'none';
    if (coin) coin.style.display = 'block';
    if (network) network.style.display = 'none';
    if (main) main.style.display = 'none';
}

function showNetworkScreen(coin) {
    selectedCoin = coin;
    const selectedCoinName = document.getElementById('selectedCoinName');
    if (selectedCoinName) selectedCoinName.textContent = `${coin} Networks`;
    
    const networksList = document.getElementById('networksList');
    if (networksList) {
        networksList.innerHTML = '';
        
        const coinNetworks = networks[coin] || [];
        coinNetworks.forEach(net => {
            const div = document.createElement('div');
            div.className = 'network-card';
            
            const iconHtml = `<img src="${net.icon}" class="network-icon-img" alt="${net.name}" onerror="this.src='https://placehold.co/32x32?text=${net.icon.charAt(0)}'">`;
            
            div.innerHTML = `
                ${iconHtml}
                <div class="network-info">
                    <h4>${net.name}</h4>
                    <p>${net.description}</p>
                </div>
            `;
            div.onclick = () => {
                selectedNetwork = net.id;
                showMainScreen();
            };
            networksList.appendChild(div);
        });
    }
    
    const welcome = document.getElementById('welcomeScreen');
    const options = document.getElementById('optionsScreen');
    const coinScreen = document.getElementById('coinScreen');
    const networkScreen = document.getElementById('networkScreen');
    const main = document.getElementById('mainScreen');
    
    if (welcome) welcome.style.display = 'none';
    if (options) options.style.display = 'none';
    if (coinScreen) coinScreen.style.display = 'none';
    if (networkScreen) networkScreen.style.display = 'block';
    if (main) main.style.display = 'none';
}

function showMainScreen() {
    const analysisTitle = document.getElementById('analysisTitle');
    const analysisSubtitle = document.getElementById('analysisSubtitle');
    const walletAddress = document.getElementById('walletAddress');
    
    if (analysisTitle) analysisTitle.textContent = `${selectedCoin} Analysis`;
    if (analysisSubtitle) analysisSubtitle.textContent = `Network: ${selectedNetwork.toUpperCase()}`;
    if (walletAddress) walletAddress.placeholder = getPlaceholder();
    
    const welcome = document.getElementById('welcomeScreen');
    const options = document.getElementById('optionsScreen');
    const coin = document.getElementById('coinScreen');
    const network = document.getElementById('networkScreen');
    const main = document.getElementById('mainScreen');
    
    if (welcome) welcome.style.display = 'none';
    if (options) options.style.display = 'none';
    if (coin) coin.style.display = 'none';
    if (network) network.style.display = 'none';
    if (main) main.style.display = 'block';
    
    if (walletAddress) walletAddress.value = '';
    
    const results = document.getElementById('results');
    const showChartBtn = document.getElementById('showChartBtn');
    
    if (results) results.style.display = 'none';
    if (showChartBtn) showChartBtn.style.display = 'none';
    currentDailyData = null;
}

function getPlaceholder() {
    if (selectedCoin === 'BTC') return 'Enter Bitcoin address (bc1... or 1...)';
    if (selectedCoin === 'SOL') return 'Enter Solana address';
    if (selectedCoin === 'TON') return 'Enter TON address';
    return 'Enter wallet address (0x...)';
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Welcome screen button
    const startBtn = document.getElementById('startWorkBtn');
    if (startBtn) {
        startBtn.onclick = function(e) {
            e.preventDefault();
            showOptionsScreen();
        };
    }
    
    // Options screen cards
    const analyzeCard = document.getElementById('analyzeWalletCard');
    if (analyzeCard) {
        analyzeCard.onclick = function() {
            showCoinScreen();
        };
    }
    
    const portfolioCard = document.getElementById('portfolioCard');
    if (portfolioCard) {
        portfolioCard.onclick = function() {
            tg.showPopup({ title: 'Coming Soon', message: 'Portfolio Tracker will be available soon!', buttons: [{type: 'ok'}] });
        };
    }
    
    // Back buttons
    const backToOptions = document.getElementById('backToOptions');
    if (backToOptions) {
        backToOptions.onclick = function() {
            showOptionsScreen();
        };
    }
    
    const backToCoin = document.getElementById('backToCoin');
    if (backToCoin) {
        backToCoin.onclick = function() {
            showCoinScreen();
        };
    }
    
    const backToNetwork = document.getElementById('backToNetwork');
    if (backToNetwork) {
        backToNetwork.onclick = function() {
            if (selectedCoin) {
                showNetworkScreen(selectedCoin);
            }
        };
    }
    
    // Coin cards
    document.querySelectorAll('.coin-card').forEach(card => {
        card.onclick = () => {
            const coin = card.dataset.coin;
            showNetworkScreen(coin);
        };
    });
    
    // Period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDays = parseInt(btn.dataset.days);
        };
    });
    
    // Analyze button
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.onclick = async () => {
            const addressInput = document.getElementById('walletAddress');
            const address = addressInput ? addressInput.value.trim() : '';
            
            if (!address) {
                tg.showPopup({ title: 'Error', message: 'Enter a wallet address', buttons: [{type: 'ok'}] });
                return;
            }
            
            const loading = document.getElementById('loading');
            const results = document.getElementById('results');
            const showChartBtn = document.getElementById('showChartBtn');
            
            if (loading) loading.style.display = 'block';
            if (results) results.style.display = 'none';
            if (showChartBtn) showChartBtn.style.display = 'none';
            
            try {
                const response = await fetch(`${API_URL}/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        address, 
                        coin: selectedCoin, 
                        network: selectedNetwork, 
                        days: selectedDays 
                    })
                });
                
                const data = await response.json();
                if (loading) loading.style.display = 'none';
                
                if (data.error) {
                    tg.showPopup({ title: 'Error', message: data.error, buttons: [{type: 'ok'}] });
                    return;
                }
                
                displayResults(data);
            } catch (error) {
                if (loading) loading.style.display = 'none';
                tg.showPopup({ title: 'Error', message: 'Failed to connect to server', buttons: [{type: 'ok'}] });
            }
        };
    }
    
    // Show chart button
    const showChartBtn = document.getElementById('showChartBtn');
    if (showChartBtn) {
        showChartBtn.onclick = () => {
            if (currentDailyData && !isAnimating) {
                showChartModal(currentDailyData);
            }
        };
    }
    
    // Back button in modal
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            stopAnimation();
            const chartModal = document.getElementById('chartModal');
            if (chartModal) chartModal.style.display = 'none';
        };
    }
});

function displayResults(data) {
    const balanceEl = document.getElementById('balance');
    if (balanceEl) balanceEl.textContent = `${data.balance} ${selectedCoin}`;
    
    const balanceUsdElement = document.getElementById('balanceUsd');
    if (balanceUsdElement && data.balanceUsd !== undefined && data.balanceUsd > 0) {
        balanceUsdElement.textContent = `≈ $${data.balanceUsd} USD`;
        balanceUsdElement.style.display = 'block';
    } else if (balanceUsdElement) {
        balanceUsdElement.style.display = 'none';
    }
    
    const txCountEl = document.getElementById('txCount');
    if (txCountEl) txCountEl.textContent = data.txCount;
    
    const incomingEl = document.getElementById('incoming');
    if (incomingEl) incomingEl.textContent = `${data.incoming} ${selectedCoin}`;
    
    const outgoingEl = document.getElementById('outgoing');
    if (outgoingEl) outgoingEl.textContent = `${data.outgoing} ${selectedCoin}`;
    
    const insightEl = document.getElementById('insight');
    if (insightEl) insightEl.textContent = data.insight;
    
    const topSendersEl = document.getElementById('topSenders');
    if (topSendersEl) {
        topSendersEl.innerHTML = data.topSenders?.length ? 
            data.topSenders.map(([addr, val]) => `<div>${addr.slice(0,6)}...${addr.slice(-4)}: ${val.toFixed(4)}</div>`).join('') : 'no data';
    }
    
    const topReceiversEl = document.getElementById('topReceivers');
    if (topReceiversEl) {
        topReceiversEl.innerHTML = data.topReceivers?.length ?
            data.topReceivers.map(([addr, val]) => `<div>${addr.slice(0,6)}...${addr.slice(-4)}: ${val.toFixed(4)}</div>`).join('') : 'no data';
    }
    
    currentDailyData = data.dailyData;
    
    const showChartBtn = document.getElementById('showChartBtn');
    if (showChartBtn && currentDailyData && currentDailyData.length > 0) {
        showChartBtn.style.display = 'block';
    } else if (showChartBtn) {
        showChartBtn.style.display = 'none';
    }
    
    const results = document.getElementById('results');
    if (results) results.style.display = 'block';
    tg.ready();
}

function showChartModal(dailyData) {
    const canvas = document.getElementById('txChartModal');
    
    if (!canvas || !dailyData || dailyData.length === 0) return;
    
    const labels = dailyData.map(d => d.date.includes('Week') ? d.date : formatDate(d.date));
    const targetData = dailyData.map(d => d.count);
    const startData = new Array(targetData.length).fill(0);
    
    const maxValue = Math.max(...targetData, 1);
    
    if (chart) {
        chart.destroy();
        chart = null;
    }
    
    chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transactions',
                data: startData.slice(),
                borderColor: '#D4C4A8',
                backgroundColor: 'rgba(212, 196, 168, 0.05)',
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: '#F0E1B9',
                pointBorderColor: '#0a0a0a',
                pointBorderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    titleColor: '#F0E1B9',
                    bodyColor: '#aaa',
                    borderColor: '#D4C4A8',
                    borderWidth: 1
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: maxValue,
                    grid: { color: 'rgba(212, 196, 168, 0.1)' }, 
                    ticks: { color: '#aaa', stepSize: Math.ceil(maxValue / 5) || 1 }
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#aaa', maxRotation: 45, autoSkip: true } 
                }
            }
        }
    });
    
    const chartModal = document.getElementById('chartModal');
    if (chartModal) chartModal.style.display = 'flex';
    
    setTimeout(() => {
        if (chart && !isAnimating) {
            startAnimation(chart, targetData, startData, animationDuration);
        }
    }, 100);
}

// Start with welcome screen
showWelcome();
