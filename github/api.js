const fetch = require('node-fetch');

let cacheReleases = [];
let getPage = ( page, cb = () => {} ) => {
    fetch('https://api.github.com/repos/Anuken/Mindustry/releases?per_page=10&page='+page, { headers: { 'user-agent': '"Thorium Launcher"/0.1' } }).then(data => data.json()).then(data => {
        data.forEach(r => cacheReleases.push(r));
        cb(data);
    })
}

let getLatest = ( cb ) => {
    fetch('https://api.github.com/repos/Anuken/Mindustry/releases/latest', { headers: { 'user-agent': '"Thorium Launcher"/0.1' } }).then(data => data.json()).then(data => {
        cb(data);
    })
}

module.exports = { getPage, cacheReleases, getLatest };