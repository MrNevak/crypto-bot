let tg = window.Telegram.WebApp;
tg.expand();

function showOptions() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('optionsScreen').style.display = 'block';
}

document.getElementById('startWorkBtn').onclick = function() {
    showOptions();
};
