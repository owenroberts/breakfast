function requireHTTPS(req, res, next) {
	// The 'x-forwarded-proto' check is for Heroku
	if (!req.secure && req.get('x-forwarded-proto') !== 'https' && 
		process.env.NODE_ENV !== "development") {
		return res.redirect('https://' + req.get('host') + req.url);
	} else {

	}
	next();
}
// https://stackoverflow.com/questions/8605720/how-to-force-ssl-https-in-express-js

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');
const favicon = require('serve-favicon');


const app = express();

let server;
if (process.env.NODE_ENV != 'production') {
	const options = {
		key: fs.readFileSync('./key.pem', 'utf8'),
		cert: fs.readFileSync('./server.crt', 'utf8')
	};
	server = https.Server(options, app);
} else {
	server = http.Server(app);
}

const io = socketIO(server);
const port = process.env.PORT || 5000;

app.set('port', port);
app.use('/public', express.static(__dirname + '/public'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));

server.listen(port, function() {
	console.log('Starting server on port ' + port);
});

// if deployed
app.use(requireHTTPS); // comment out for local

app.get('/', function(request, response){
	response.sendFile(path.join(__dirname, 'public/index.html'));
});

const DEBUG = true;
const birds = {};
let aiCount = 0;
let updateInterval;
let aiTimeout;

function random(min, max) {
	if (!max) {
		if (typeof min === "number") {
			return Math.random() * (min);
		} else {
			return min[Math.floor(Math.random() * min.length)];
		}
	} else {
		return Math.random() * (max - min) + min;
	}
}

class Bird {
	constructor(socket) {
		this.needsUpdate = false;
		this.position = { x: random(-5, 5), y: 2, z: random(-5, 5) };
		this.targets = [];
		this.model = Math.random() < 0.65 ? 'nightjar' : 'wren';

		if (socket) {
			this.id = socket.id;
			socket.on('move', (direction, distance) => {
				this.move(direction, distance);
			});

			socket.on('done moving', () => {
				// set new position
				if (this.targets.length > 0) {
					this.position.x = this.targets[2].x;
					this.position.z = this.targets[2].z;
					this.targets = []; // clear targets
				}
			});
		}
		
	}
	move(direction, distance) {
		let x = direction.x * 5;
		let z = direction.z * 5;
		
		const t1 = {
			x: random(this.position.x - distance + x, this.position.x + distance + x),
			y: this.position.y,
			z: random(this.position.z - distance + z, this.position.z + distance + z)
		};
		const t2 = {
			x: random(t1.x - distance + x, t1.x + distance + x),
			y: this.position.y,
			z: random(t1.z - distance + z, t1.z + distance + z)
		};
		const t3 = {
			x: random(t2.x - distance + x , t2.x + distance + x),
			y: this.position.y,
			z: random(t2.z - distance + z, t2.z + distance + z)
		};

		this.targets = [t1, t2, t3];
		this.needsUpdate = true;
	}
}

function init() {
	// add birds with drawings 
	const data = {};
	for (const id in birds) {
		if (birds[id].drawing)
			data[id] = birds[id];
	}
	return data;
}

function update() {
	// add birds with new targets 
	const data = {};
	for (const id in birds) {
		if (birds[id].needsUpdate) {
			data[id] = birds[id];
			birds[id].needsUpdate = false;
		}
	}
	if (Object.keys(data).length > 0)
		io.sockets.emit('update', data);
}

function addAIBird() {
	if (Object.keys(birds).length < 2) {
		const id = `ai-${aiCount++}`
		birds[id] = new Bird();
		birds[id].id = id;
		birds[id].drawing = 'ai';
		io.sockets.emit('add bird', birds[id]);

		let moveTimeout;
		function mover() {
			birds[id].move({x: 0, z: 0}, 5);
			moveTimeout = setTimeout(mover, random(2000, 3000));
		}
		moveTimeout = setTimeout(mover, random(2000, 3000));

		aiTimeout = setTimeout(() => {
			clearTimeout(moveTimeout);
			removeBird(id);
			aiTimeout = setTimeout(addAIBird, 2000);
		}, random(5000, 10000));
	}
}

function removeBird(id) {
	if (birds[id]) {
		io.sockets.emit('remove bird', id);
		delete birds[id];
	}
	if (Object.keys(birds).length == 1) {
		for (const k in birds) {
			if (birds[k].drawing == 'ai') {
				io.sockets.emit('remove bird', id);
				delete birds[id];
			} else {
				aiTimeout = setTimeout(addAIBird, 10000);
			}
		}
	} else if (Object.keys(birds).length == 0) {
		clearInterval(updateInterval);
		clearTimeout(aiTimeout);
		updateInterval = undefined;
	}
}

io.on('connection', socket => {
	// console.log('new bird', socket.id);
	
	socket.on('loaded', () => {
		socket.emit('init', init(), socket.id);
	});

	socket.on('add drawing', drawing => {
		// console.log( 'drawing', socket.id );
		birds[socket.id] = new Bird(socket);
		birds[socket.id].drawing = drawing;
		io.sockets.emit('add bird', birds[socket.id]);

		if (!updateInterval)
			updateInterval = setInterval(update, 1000 / 30);

		if (Object.keys(birds).length < 2)
			aiTimeout = setTimeout(addAIBird, 10000);
	});

	socket.on('disconnect', () => {
		// console.log('exit', socket.id);
		removeBird(socket.id);
	});

	/* debug */
	socket.on('send-eval', msg => {
		if (!DEBUG)
			return;
		const res = eval(msg);
		socket.emit('get-eval', res);
	});
});

