const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const favicon = require('serve-favicon');

const app = express();
const server = http.Server(app);
const io = socketIO(server);

const port = process.env.PORT || 5000;
app.set('port', port);
app.use('/public', express.static(__dirname + '/public'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));

app.get('/', function(request, response){
	response.sendFile(path.join(__dirname, 'public/index.html'));
});

server.listen(port, function() {
	console.log('Starting server on port ' + port);
});

const DEBUG = true;
const birds = {};
let aiCount = 0;
let updateInterval;

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
		this.position = { x: 0, y: 2, z: 0 };
		this.targets = [];
		this.model = Math.random() < 0.65 ? 'nightjar' : 'wren';

		if (socket) {
			this.id = socket.id;
			socket.on('move', (direction, distance) => {
				this.needsUpdate = true;
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
		let x, z;
		if (direction) {
			x = direction.x * 5;
			z = direction.z * 5;
		} else {
			x = 0;
			z = 0;
		}

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
	}
	initSockets() {

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
		birds[id].drawing = 'hey.json';
		io.sockets.emit('add bird', birds[id]);

		let moveTimeout;
		function mover() {
			birds[id].move();
			moveTimeout = setTimeout(mover, random(800, 1200));
		}
		moveTimeout = setTimeout(mover, random(800, 1200));

		setTimeout(() => {
			clearTimeout(moveTimeout);
			removeBird(id);
			setTimeout(addAIBird, 2000);
		}, random(5000, 10000));
	}
}

function removeBird(id) {
	if (birds[id]) {
		io.sockets.emit('remove bird', id);
		delete birds[id];
	}
	if (Object.keys(birds).length == 0) {
		clearInterval(updateInterval);
	}
}

io.on('connection', socket => {
	// console.log('new bird', socket.id);

	if (Object.keys(birds).length == 0) {
		updateInterval = setInterval(update, 1000 / 30);
		setTimeout( addAIBird, 2000 );
	}
	birds[socket.id] = new Bird(socket);
	
	socket.on('loaded', () => {
		socket.emit('init', init(), socket.id);
		// io.sockets.emit('add bird', birds[socket.id]);
	});

	socket.on('add drawing', drawing => {
		// console.log( 'drawing', socket.id );
		birds[socket.id].drawing = drawing;
		io.sockets.emit('add bird', birds[socket.id]);
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

