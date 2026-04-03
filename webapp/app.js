let tg = window.Telegram.WebApp;
tg.expand();

let selectedToken = 'ETH';
let selectedDays = 7;
let chart = null;
let currentDailyData = null;

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
    document.getElementById('showChartBtn').classList.add('hidden');
    
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

document.getElementById('showChartBtn').addEventListener('click', () => {
    if (currentDailyData) {
        showChartModal(currentDailyData);
    }
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('chartModal').classList.add('hidden');
});

document.getElementById('chartModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('chartModal')) {
        document.getElementById('chartModal').classList.add('hidden');
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
    
    currentDailyData = data.dailyData;
    
    if (currentDailyData && currentDailyData.length > 0) {
        document.getElementById('showChartBtn').classList.remove('hidden');
    } else {
        document.getElementById('showChartBtn').classList.add('hidden');
    }
    
    document.getElementById('results').classList.remove('hidden');
    tg.ready();
}

function showChartModal(dailyData) {
    const canvas = document.getElementById('txChartModal');
    
    if (!dailyData || dailyData.length === 0) {
        return;
    }
    
    const labels = dailyData.map(d => d.date.slice(5));
    const realCounts = dailyData.map(d => d.count);
    const zeroCounts = new Array(realCounts.length).fill(0);
    
    if (chart) {
        chart.destroy();
    }
    
    chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transactions per day',
                data: zeroCounts,
                borderColor: '#3390ec',
                backgroundColor: 'rgba(51, 144, 236, 0.1)',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#3390ec',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 0
            },
            plugins: {
                legend: {
                    labels: { color: '#aaa', font: { size: 11 } }
                },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    titleColor: '#fff',
                    bodyColor: '#aaa',
                    callbacks: {
                        label: function(context) {
                            return `Transactions: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#2a2a2a' },
                    ticks: { color: '#aaa', stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#aaa', maxRotation: 45, autoSkip: true }
                }
            }
        }
    });
    
    document.getElementById('chartModal').classList.remove('hidden');
    
    setTimeout(() => {
        chart.data.datasets[0].data = realCounts;
        chart.update({
            duration: 3000,
            easing: 'easeOutQuart'
        });
    }, 100);
}
