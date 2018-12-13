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
};

class Bird {
	constructor(socket) {
		this.id = socket.id;
		this.needsUpdate = false;
		this.position = { 
			x: 0, 
			y: 2, 
			z: 0 
		};
		this.targets = [];
		this.model = Math.random() < 0.65 ? 'nightjar' : 'wren';

		socket.on('tap', targets => {
			this.needsUpdate = true;
			this.targets = targets;
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

io.on('connection', socket => {
	// console.log('new bird', socket.id);

	if (Object.keys(birds).length == 0) {
		updateInterval = setInterval(update, 1000 / 30);
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
		if (birds[socket.id]) {
			io.sockets.emit('remove bird', socket.id);
			delete birds[socket.id];
		}
		if (Object.keys(birds).length == 0) {
			clearInterval(updateInterval);
		}
	});

	/* debug */
	socket.on('send-eval', msg => {
		if (!DEBUG)
			return;
		const res = eval(msg);
		socket.emit('get-eval', res);
	});
});

