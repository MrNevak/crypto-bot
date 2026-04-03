let tg = window.Telegram.WebApp;
tg.expand();

console.log('App started');

function showOptions() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('optionsScreen').style.display = 'block';
}

document.getElementById('startWorkBtn').onclick = function() {
    alert('Button clicked');
    showOptions();
};
