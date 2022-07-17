const { app, BrowserWindow } = require('electron')
const { Server } = require('ws');
const fs = require('fs');
const gh = require('./github/api.js');
const fetch = require('node-fetch');

let da = require('./data.json');
const { spawn } = require('child_process');
let currentVerion = null;
let sock;

if(!da.versions){
    da.versions = [];
}

if(da.cVersion){
    currentVerion = da.cVersion;
}

fs.writeFileSync('data.json', JSON.stringify(da));

let server = new Server({ port: 9685 });
let sockets = [];

class Window extends BrowserWindow {
    constructor(options) {
        super(options)
        this.loadFile('views/loader.html')
    }
}

app.on('ready', () => {
    let win = new Window({
        width: 800,
        height: 500,
        title: 'Thorium Launcher',
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
    })

    server.on('connection', ( socket ) => {
        sock = socket;
        sockets.push(socket);

        log('ELECTRON', 'Loaded Window')
        socket.on('message', ( data ) => {
            let msg = JSON.parse(data);

            if(msg.cmd === 'versions'){
                gh.getPage(msg.page, ( data ) => {
                    socket.send(JSON.stringify({
                        cmd: 'versionData',
                        data: data
                    }))
                })
            }

            if(msg.cmd === 'setVer'){
                log('VERSIONS', 'Version Set To: '+msg.ver)
            }
    
            if(msg.cmd === 'min'){
                log('ELECTRON', 'Minimizing Window');
                win.minimize();
            }
    
            if(msg.cmd === 'close'){
                log('ELECTRON', 'Closing Window');
                win.close();
            }

            if(msg.cmd === 'play'){
                log('THORIUM', 'Starting Game');

                socket.send(JSON.stringify({
                    cmd: 'setload',
                    p: '0'
                }));

                launchGame();
            }
        })
    
        socket.on('close', () => {
            sockets = sockets.filter(x => x !== socket);
        })
    })
})

let log = (item, text) => {
    console.log('['+item+']', text);

    sockets.forEach(socket => {
        socket.send(JSON.stringify({ cmd: 'log', text: '['+item+'] ' + text }));
    })
}

let launchGame = () => {
    if(!currentVerion){
        gh.getLatest(data => {
            let asset = data.assets.find(x => x.name === 'Mindustry.jar');

            if(!asset){
                log('THORIUM', 'Cannot Find JAVA File');
                sock.send(JSON.stringify({ cmd: 'error', msg: 'Invaild Version' }));

                return;
            }

            fs.mkdirSync('vers/'+(data.tag_name.split('.').join('-'))+'/', { recursive: true });
            log('NETWORK', 'Downloading '+data.name+' From '+asset.browser_download_url);

            fetch(asset.browser_download_url).then(g => {
                let clength = g.headers.get('content-length');
                let gd = '';

                let stream = fs.createWriteStream('vers/'+(data.tag_name.split('.').join('-'))+'/Mindustry.jar')
                g.body.pipe(stream);

                g.body.on('data', chunk => {
                    gd += chunk;
                    sock.send(JSON.stringify({ cmd: 'setload', p: ( gd.length / clength ) * 100 }));
                })

                g.body.on('end', () => {
                    log('NETWORK', 'Download Finished...');

                    sock.send(JSON.stringify({ cmd: 'setload', p: 100 }));
                    currentVerion = data.tag_name.split('.').join('-');

                    da.cVersion = data.tag_name.split('.').join('-');
                    da.versions.push(data);

                    fs.writeFileSync('data.json', JSON.stringify(da));
                    launchGame();
                })
            }).catch(e => {
                log('NETWORK', 'Download Failed: '+e);
                sock.send(JSON.stringify({ cmd: 'error', msg: 'Download Failed' }));
            })
        })
    } else{
        let game = spawn('java', ['-jar', 'vers/'+currentVerion+'/Mindustry.jar']);

        sock.send(JSON.stringify({ cmd: 'setload', p: 100 }));
        sock.send(JSON.stringify({ cmd: 'gamestarted' }));

        log('THORIUM', 'Game Starting');

        game.stdout.on('data', data => {
            log('MINDUSTRY', data.toString().replace('\n', ''));
        })

        game.stderr.on('data', data => {
            log('MINDUSTRY', data.toString().replace('\n', ''));
        })

        game.on('close', code => {
            sock.send(JSON.stringify({ cmd: 'gamestopped' }));

            log('THORIUM', 'Game Closed');
            sock.send(JSON.stringify({
                cmd: 'setload',
                p: '0'
            }));
        })
    }
}