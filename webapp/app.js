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
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
}

function showStartScreen() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'block';
    document.getElementById('mainScreen').style.display = 'none';
}

function showMainScreen() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'block';
}

// КНОПКА START WORK
document.getElementById('startWorkBtn').onclick = function() {
    showStartScreen();
};

// КНОПКА ANALYZE WALLET
document.getElementById('analyzeCard').onclick = function() {
    showMainScreen();
};

// КНОПКА BACK НА СТАРТОВЫЙ ЭКРАН
document.getElementById('backToStart').onclick = function() {
    showStartScreen();
    document.getElementById('walletAddress').value = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('showChartBtn').style.display = 'none';
    currentDailyData = null;
};

// Portfolio Tracker
document.getElementById('portfolioCard').onclick = function() {
    tg.showPopup({ title: 'Coming Soon', message: 'Portfolio Tracker will be available soon!', buttons: [{type: 'ok'}] });
};

// Token buttons
document.querySelectorAll('.token-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.token-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedToken = btn.dataset.token;
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
document.getElementById('analyzeBtn').onclick = async () => {
    const address = document.getElementById('walletAddress').value.trim();
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
        tg.showPopup({ title: 'Error', message: 'Enter a valid wallet address (0x...)', buttons: [{type: 'ok'}] });
        return;
    }
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('showChartBtn').style.display = 'none';
    
    try {
        const response = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, token: selectedToken, days: selectedDays })
        });
        
        const data = await response.json();
        document.getElementById('loading').style.display = 'none';
        displayResults(data);
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        tg.showPopup({ title: 'Error', message: 'Failed to connect to server', buttons: [{type: 'ok'}] });
    }
};

// Show chart button
document.getElementById('showChartBtn').onclick = () => {
    if (currentDailyData && !isAnimating) {
        showChartModal(currentDailyData);
    }
};

// Back button in modal
document.getElementById('backBtn').onclick = () => {
    stopAnimation();
    document.getElementById('chartModal').style.display = 'none';
};

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
    
    currentDailyData = data.dailyData;
    
    if (currentDailyData && currentDailyData.length > 0) {
        document.getElementById('showChartBtn').style.display = 'block';
    } else {
        document.getElementById('showChartBtn').style.display = 'none';
    }
    
    document.getElementById('results').style.display = 'block';
    tg.ready();
}

function showChartModal(dailyData) {
    const canvas = document.getElementById('txChartModal');
    
    if (!dailyData || dailyData.length === 0) {
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
                legend: { display: false },
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
                    grid: { color: 'rgba(212, 196, 168, 0.1)', lineWidth: 1 },
                    ticks: { color: '#aaa', stepSize: 1, font: { size: 11 } },
                    title: { display: true, text: 'Number of Transactions', color: '#888', font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#aaa', maxRotation: 45, autoSkip: true, font: { size: 11 } }
                }
            }
        }
    });
    
    document.getElementById('chartModal').style.display = 'flex';
    
    setTimeout(() => {
        if (chart && !isAnimating) {
            startAnimation(chart, targetData, startData, animationDuration);
        }
    }, 100);
}

// Start
showWelcomeScreen();
