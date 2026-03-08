const https = require('https');

// Sample AppName / CatalogItemId from Epic
const fetchEpicImage = (id) => {
    const url = `https://store-content-ipv4.ak.epicgames.com/api/en-US/content/products/${id}`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    console.log(JSON.parse(data));
                    resolve(true);
                } catch { resolve(false); }
            });
        }).on('error', () => resolve(false));
    });
};

fetchEpicImage('rocket-league').then(() => fetchEpicImage('sugar'));
