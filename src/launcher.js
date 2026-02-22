const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const WinReg = require('winreg');

const steamPath = 'C:\\Program Files (x86)\\Steam'; // Ruta de Steam
const steamAppsPath = path.join(steamPath, 'steamapps');

// Leer todos los juegos instalados
function getSteamGames() {
  const apps = [];

  // Leer los archivos appmanifest_*.acf
  const files = fs.readdirSync(steamAppsPath).filter(f => f.startsWith('appmanifest_'));
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(steamAppsPath, file), 'utf8');
    const nameMatch = content.match(/"name"\s+"(.+?)"/);
    const appidMatch = content.match(/"appid"\s+(\d+)/);

    if(nameMatch && appidMatch){
      apps.push({
        name: nameMatch[1],
        appid: appidMatch[1]
      });
    }
  });

  return apps;
}

// Crear la grilla de juegos
function displayGames(games) {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';

  games.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';
    
    // Imagen desde Steam
    const img = document.createElement('img');
    img.src = `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`;

    const p = document.createElement('p');
    p.textContent = game.name;

    card.appendChild(img);
    card.appendChild(p);

    // Click para abrir juego
    card.addEventListener('click', () => {
      exec(`"${steamPath}\\Steam.exe" -applaunch ${game.appid}`);
    });

    grid.appendChild(card);
  });
}

// Filtrado por búsqueda
document.getElementById('search').addEventListener('input', e => {
  const query = e.target.value.toLowerCase();
  const filtered = allGames.filter(g => g.name.toLowerCase().includes(query));
  displayGames(filtered);
});

// Inicialización
const allGames = getSteamGames();
displayGames(allGames);
