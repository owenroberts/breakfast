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
const players = {};
let started = false;
let updateInterval;

