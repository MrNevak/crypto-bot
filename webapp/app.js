let tg = window.Telegram.WebApp;
tg.expand();

let selectedToken = 'ETH';
let selectedDays = 7;
let chart = null;
let currentDailyData = null;
let animationFrame = null;
let isAnimating = false;
let animationDuration = 4000;

const API_URL = 'https://crypto-bot-production-d6b8.up.railway.app';

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

// Переключение экранов
function showWelcomeScreen() {
    const welcome = document.getElementById('welcomeScreen');
    const start = document.getElementById('startScreen');
    const main = document.getElementById('mainScreen');
    if (welcome) welcome.classList.remove('hidden');
    if (start) start.classList.add('hidden');
    if (main) main.classList.add('hidden');
}

function showStartScreen() {
    const welcome = document.getElementById('welcomeScreen');
    const start = document.getElementById('startScreen');
    const main = document.getElementById('mainScreen');
    if (welcome) welcome.classList.add('hidden');
    if (start) start.classList.remove('hidden');
    if (main) main.classList.add('hidden');
}

function showMainScreen() {
    const welcome = document.getElementById('welcomeScreen');
    const start = document.getElementById('startScreen');
    const main = document.getElementById('mainScreen');
    if (welcome) welcome.classList.add('hidden');
    if (start) start.classList.add('hidden');
    if (main) main.classList.remove('hidden');
}

// Обработчики
const startBtn = document.getElementById('startWorkBtn');
if (startBtn) {
    startBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Button clicked');
        showStartScreen();
    });
}

const analyzeCard = document.getElementById('analyzeCard');
if (analyzeCard) {
    analyzeCard.addEventListener('click', () => {
        showMainScreen();
    });
}

const portfolioCard = document.getElementById('portfolioCard');
if (portfolioCard) {
    portfolioCard.addEventListener('click', () => {
        tg.showPopup({ title: 'Coming Soon', message: 'Portfolio Tracker will be available soon!', buttons: [{type: 'ok'}] });
    });
}

const backToStart = document.getElementById('backToStart');
if (backToStart) {
    backToStart.addEventListener('click', () => {
        showStartScreen();
        const walletInput = document.getElementById('walletAddress');
        if (walletInput) walletInput.value = '';
        const results = document.getElementById('results');
        if (results) results.classList.add('hidden');
        const chartBtn = document.getElementById('showChartBtn');
        if (chartBtn) chartBtn.classList.add('hidden');
        currentDailyData = null;
    });
}

const tokenBtns = document.querySelectorAll('.token-btn');
tokenBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tokenBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedToken = btn.dataset.token;
    });
});

const periodBtns = document.querySelectorAll('.period-btn');
periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        periodBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDays = parseInt(btn.dataset.days);
    });
});

const analyzeBtn = document.getElementById('analyzeBtn');
if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        const addressInput = document.getElementById('walletAddress');
        const address = addressInput ? addressInput.value.trim() : '';
        
        if (!address || !address.startsWith('0x') || address.length !== 42) {
            tg.showPopup({ title: 'Error', message: 'Enter a valid wallet address (0x...)', buttons: [{type: 'ok'}] });
            return;
        }
        
        const loading = document.getElementById('loading');
        const results = document.getElementById('results');
        const chartBtn = document.getElementById('showChartBtn');
        
        if (loading) loading.classList.remove('hidden');
        if (results) results.classList.add('hidden');
        if (chartBtn) chartBtn.classList.add('hidden');
        
        try {
            const response = await fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, token: selectedToken, days: selectedDays })
            });
            
            const data = await response.json();
            if (loading) loading.classList.add('hidden');
            displayResults(data);
        } catch (error) {
            if (loading) loading.classList.add('hidden');
            tg.showPopup({ title: 'Error', message: 'Failed to connect to server', buttons: [{type: 'ok'}] });
        }
    });
}

const showChartBtn = document.getElementById('showChartBtn');
if (showChartBtn) {
    showChartBtn.addEventListener('click', () => {
        if (currentDailyData && !isAnimating) {
            showChartModal(currentDailyData);
        }
    });
}

const backBtn = document.getElementById('backBtn');
if (backBtn) {
    backBtn.addEventListener('click', () => {
        stopAnimation();
        const modal = document.getElementById('chartModal');
        if (modal) modal.classList.add('hidden');
    });
}

function displayResults(data) {
    const balanceEl = document.getElementById('balance');
    const txCountEl = document.getElementById('txCount');
    const incomingEl = document.getElementById('incoming');
    const outgoingEl = document.getElementById('outgoing');
    const insightEl = document.getElementById('insight');
    const topSendersEl = document.getElementById('topSenders');
    const topReceiversEl = document.getElementById('topReceivers');
    const resultsEl = document.getElementById('results');
    const chartBtn = document.getElementById('showChartBtn');
    
    if (balanceEl) balanceEl.textContent = `${data.balance} ${selectedToken}`;
    if (txCountEl) txCountEl.textContent = data.txCount;
    if (incomingEl) incomingEl.textContent = `${data.incoming} ${selectedToken}`;
    if (outgoingEl) outgoingEl.textContent = `${data.outgoing} ${selectedToken}`;
    if (insightEl) insightEl.textContent = data.insight;
    
    if (data.topSenders && data.topSenders.length > 0 && topSendersEl) {
        topSendersEl.innerHTML = data.topSenders.map(([addr, val]) => 
            `<div>${addr.slice(0,6)}...${addr.slice(-4)}: ${val.toFixed(4)} ${selectedToken}</div>`
        ).join('');
    } else if (topSendersEl) {
        topSendersEl.innerHTML = 'no data';
    }
    
    if (data.topReceivers && data.topReceivers.length > 0 && topReceiversEl) {
        topReceiversEl.innerHTML = data.topReceivers.map(([addr, val]) => 
            `<div>${addr.slice(0,6)}...${addr.slice(-4)}: ${val.toFixed(4)} ${selectedToken}</div>`
        ).join('');
    } else if (topReceiversEl) {
        topReceiversEl.innerHTML = 'no data';
    }
    
    currentDailyData = data.dailyData;
    
    if (currentDailyData && currentDailyData.length > 0 && chartBtn) {
        chartBtn.classList.remove('hidden');
    } else if (chartBtn) {
        chartBtn.classList.add('hidden');
    }
    
    if (resultsEl) resultsEl.classList.remove('hidden');
    tg.ready();
}

function showChartModal(dailyData) {
    const canvas = document.getElementById('txChartModal');
    
    if (!canvas || !dailyData || dailyData.length === 0) {
        return;
    }
    
    const labels = dailyData.map(d => {
        if (d.date.includes('Week')) {
            return d.date;
        }
        return formatDate(d.date);
    });
    const targetData = dailyData.map(d => d.count);
    const startData = new Array(targetData.length).fill(0);
    
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
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    titleColor: '#F0E1B9',
                    bodyColor: '#aaa',
                    borderColor: '#D4C4A8',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `📊 Transactions: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(212, 196, 168, 0.1)',
                        lineWidth: 1
                    },
                    ticks: { 
                        color: '#aaa', 
                        stepSize: 1,
                        font: { size: 11 }
                    },
                    title: {
                        display: true,
                        text: 'Number of Transactions',
                        color: '#888',
                        font: { size: 11 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: '#aaa', 
                        maxRotation: 45, 
                        autoSkip: true,
                        font: { size: 11 }
                    }
                }
            },
            elements: {
                line: {
                    borderJoin: 'round'
                }
            }
        }
    });
    
    const modal = document.getElementById('chartModal');
    if (modal) modal.classList.remove('hidden');
    
    setTimeout(() => {
        if (chart && !isAnimating) {
            startAnimation(chart, targetData, startData, animationDuration);
        }
    }, 100);
}

// Показываем приветственный экран
showWelcomeScreen();
