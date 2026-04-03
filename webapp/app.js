let tg = window.Telegram.WebApp;
tg.expand();

let selectedToken = 'ETH';
let selectedDays = 7;
let chart = null;

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
    document.getElementById('chartContainer').classList.add('hidden');
    
    try {
        const response = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, token: selectedToken, days: selectedDays })
        });
        
        const data = await response.json();
        console.log('Response data:', data); // ОТЛАДКА
        console.log('dailyData:', data.dailyData); // ОТЛАДКА
        
        document.getElementById('loading').classList.add('hidden');
        displayResults(data);
    } catch (error) {
        console.error('Error:', error); // ОТЛАДКА
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
    
    console.log('Calling drawChart with:', data.dailyData); // ОТЛАДКА
    
    if (data.dailyData && data.dailyData.length > 0) {
        drawChart(data.dailyData);
    } else {
        console.log('No dailyData received or empty');
        document.getElementById('chartContainer').classList.add('hidden');
    }
    
    document.getElementById('results').classList.remove('hidden');
    tg.ready();
}

function drawChart(dailyData) {
    console.log('drawChart called with:', dailyData); // ОТЛАДКА
    
    const container = document.getElementById('chartContainer');
    const canvas = document.getElementById('txChart');
    
    if (!dailyData || dailyData.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    const labels = dailyData.map(d => d.date.slice(5));
    const counts = dailyData.map(d => d.count);
    
    console.log('Labels:', labels); // ОТЛАДКА
    console.log('Counts:', counts); // ОТЛАДКА
    
    if (chart) {
        chart.destroy();
    }
    
    chart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transactions',
                data: counts,
                backgroundColor: '#3390ec',
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 3000,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    labels: { color: '#aaa', font: { size: 11 } }
                },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    titleColor: '#fff',
                    bodyColor: '#aaa'
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
    
    console.log('Chart created'); // ОТЛАДКА
}
