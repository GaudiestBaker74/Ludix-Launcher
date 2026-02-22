const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const WinReg = require('winreg');

const steamPath = 'C:\\Program Files (x86)\\Steam'; // Steam path
const steamAppsPath = path.join(steamPath, 'steamapps');

// Read all installed games
function getSteamGames() {
  const apps = [];

  // Read appmanifest_*.acf files
  const files = fs.readdirSync(steamAppsPath).filter(f => f.startsWith('appmanifest_'));

  files.forEach(file => {
    const content = fs.readFileSync(path.join(steamAppsPath, file), 'utf8');
    const nameMatch = content.match(/"name"\s+"(.+?)"/);
    const appidMatch = content.match(/"appid"\s+(\d+)/);

    if (nameMatch && appidMatch) {
      apps.push({
        name: nameMatch[1],
        appid: appidMatch[1]
      });
    }
  });

  return apps;
}

// Create the game grid
function displayGames(games) {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';

  games.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';

    // Image from Steam
    const img = document.createElement('img');
    img.src = `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`;

    const p = document.createElement('p');
    p.textContent = game.name;

    card.appendChild(img);
    card.appendChild(p);

    // Click to open game
    card.addEventListener('click', () => {
      exec(`"${steamPath}\\Steam.exe" -applaunch ${game.appid}`);
    });

    grid.appendChild(card);
  });
}

// Filter by search
document.getElementById('search').addEventListener('input', e => {
  const query = e.target.value.toLowerCase();
  const filtered = allGames.filter(g => g.name.toLowerCase().includes(query));
  displayGames(filtered);
});

// Initialization
const allGames = getSteamGames();
displayGames(allGames);
