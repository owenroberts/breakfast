const socket = io();

/* settings */
const jumpDistance = 10;
const messageDistance = 15;
const birdSpeed = 1.5;
const cameraOffset = 5;
const cameraHeight = 20;
const messageHeight = 10;

const birdData = {
	nightjar: {
		idle: { index: 2, duration:  1000 / 24 * 46 / 1000 },
		fly: { index: 0, duration: 1000 / 24 * 10 / 1000 },
		sing: { index: 1, duration: 1000 / 24 * 46 / 1000 }
	},
	wren: {
		idle: { index: 2, duration: 1000 / 24 * 30 / 1000 },
		fly: { index: 0, duration: 1000 / 24 * 22 / 1000 },
		sing: { index: 1, duration: 1000 / 24 * 40 / 1000 }
	}
};

const Birds = {};
let userId;
let tapCount = 0;
const tapAmount = 10;

let state = 'intro'; /* sound, start, game */
let useSound = false;
let timer = performance.now();
const interval = 1000 / 30;

/* on boarding ui */
const uiCanvas = document.getElementById( 'ui' );
const uiLines = new LinesPlayer( uiCanvas );
uiLines.onPlayedOnce = () => {
	uiLines.isPlaying = false;
	uiLines.onPlayedOnce = null;
	uiLines.loadAnimation( '/public/ui/sound.json', () => {
		uiLines.isPlaying = true;
	});
	state = 'sound';
};

/* drawing canvas */
const drawCanvas = document.getElementById( 'draw' );
const drawLines = new LinesDraw( drawCanvas, '264F72' );

/* lines texture  */
const lines = document.getElementById('lines');
let width = window.innerWidth, height = window.innerHeight;
const linesPlayer = new LinesPlayer(lines);
linesPlayer.isTexture = true;
let linesTexture; /* texture gets updated */
let groundMesh;

const bgMusic = new Audio();
bgMusic.src = '/public/audio/theme_1.mp3';
bgMusic.loop = true;

const tapSound = new Audio();
tapSound.src = '/public/audio/bounce.mp3';

const drawings = [
	"/public/drawings/end_2.json", // fast
	/*"/public/drawings/feeder_4.json", */ // slow
	"/public/drawings/feeder_close.json", // medium
	/*"/public/drawings/feeder_pole.json",*/ // fast
	"/public/drawings/feeder_trees_0.json", // fast
	"/public/drawings/feeder_trees_1.json", // fast
	"/public/drawings/moon_fast.json", // med
	"/public/drawings/shadow.json", // fast
	"/public/drawings/sunset_0.json", // fast
	"/public/drawings/sunset_1.json", // med
	"/public/drawings/tree_close_0.json", // fast
	"/public/drawings/tree_close_1.json", // fast
	"/public/drawings/wind.json" // fast
];

const aiDrawings = [
	"/public/ai/answer.json",
	"/public/ai/asks.json",
	"/public/ai/boring.json",
	"/public/ai/empty.json",
	"/public/ai/fart.json",
	"/public/ai/guess.json",
	"/public/ai/hate.json",
	"/public/ai/healthy.json",
	"/public/ai/hi.json",
	"/public/ai/mouth.json",
	"/public/ai/noone.json",
	"/public/ai/oldest.json",
	"/public/ai/other.json",
	"/public/ai/same.json",
	"/public/ai/skip.json",
	"/public/ai/star.json"
];

/* three stuff */
import * as THREE from './jsm/three.module.js';
import { DeviceOrientationControls } from './jsm/DeviceOrientationControlsTouch.js';
import { OutlineEffect } from './jsm/OutlineEffect.js';
import { GLTFLoader } from './jsm/GLTFLoader.js';

let camera, scene, renderer, controls;
let cameraDirectionVector;
let clock, mixer;
let effect;
let messageScene;
let downVector = new THREE.Vector3( 0, -5, 0 );


uiLines.loadAnimation( '/public/ui/title.json' );

// desktop
if (!Cool.mobilecheck()) {
	uiCanvas.addEventListener('click', event => {
		sceneManager( true, event.offsetY );	
	});
}

function init() {

	cameraDirectionVector = new THREE.Vector3();
	clock = new THREE.Clock();
	scene = new THREE.Scene();
	messageScene = new THREE.Scene();
	scene.background = new THREE.Color( 0xffffff );

	renderer = new THREE.WebGLRenderer();
	renderer.autoClear = false;
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize(width, height);
	document.body.appendChild(renderer.domElement);
	renderer.domElement.style.display = 'none';
	// renderer.gammaInput = true;
	// renderer.gammaOutput = true;
	effect = new OutlineEffect( renderer, {
		defaultThickness: 0.006,
		defaultColor: new THREE.Color( 0x264F72 )
	} );

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1100 );
	controls = new DeviceOrientationControls( camera );

	if (!Cool.mobilecheck()) setupDesktop();
	
	camera.position.z = 10;
	camera.position.y = cameraHeight;

	/* ground */
	var s = 150;
	var d = s / 8;
	var ground = new THREE.Geometry();
	var geo = new THREE.BoxBufferGeometry( 1, 1, 1 );
	var mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

	noise.seed(Math.random());
	var xf = 0;
	for (let x = -s; x <= s; x += d) {
		var zf = 0;
		for (let z = -s; z <= s; z += d) {
			var y = Cool.map(noise.perlin2(xf, zf), -1, 1, -8, 8);
			ground.vertices.push( new THREE.Vector3( x, y, z ) );
			zf += 0.2;
		}
		xf += 0.2;
	}

	const n = s / d * 2 + 1; // number of columns and rows
	for (let i = 0; i < ground.vertices.length - n; i++) {
		const c = Math.floor(i/n); // x column
		const m = i % n; // z row 
		if (m < n - 1) {
			/*
				mapping faces to texture
				i 	i+n
				i+1	i+n+1
				to uv (inverted y)
				0,1	1,1
				0,0	1,0
			*/
			ground.faces.push( new THREE.Face3( i, i + 1, i + n ) );
			ground.faceVertexUvs[0].push([
				new THREE.Vector2(c/n,  m/n), // 0,0 ~ 0,1
				new THREE.Vector2(c/n, (m/n + 1/n)), // 0,1 ~ 0,0
				new THREE.Vector2(c/n + 1/n,  m/n) // 1,0 ~ 1,1
			]);
			ground.faces.push( new THREE.Face3( i + 1, i + n + 1, i + n, ) );
			ground.faceVertexUvs[0].push([
				new THREE.Vector2(c/n, (m/n + 1/n)), // 0,1 ~ 0,0
				new THREE.Vector2(c/n + 1/n,  (m/n + 1/n)), // 1,1 ~ 1,0
				new THREE.Vector2(c/n + 1/n, m/n) // 1,0 ~ 1,1
			]);
		}
		ground.computeFaceNormals();
	}

	/* lines texture */
	lines.width =  1024;
	lines.height = 1024;
	linesTexture = new THREE.Texture( lines );
	const linesMaterial = new THREE.MeshBasicMaterial({ map: linesTexture, transparent: true, side: THREE.DoubleSide /*, color: 0xff00ff */});
	linesPlayer.loadAnimation( "/public/drawings/feeder_2.json" );

	groundMesh = new THREE.Mesh( ground, linesMaterial );
	scene.add( groundMesh );

	mixer = new THREE.AnimationMixer( scene ); // one animation mixer

	socket.emit( 'loaded' );
	socketEvents();
	// fullscreen();
}

function addBird( id, model, position, drawing ) {
	// console.log( 'add bird', id );
	
	const loader = new GLTFLoader();
	loader.load(`/public/models/${model}.gltf`, function( gltf ) {
		// console.log( model, gltf.animations );

		Birds[id] = {};
		Birds[id].targets = [];
		Birds[id].isMoving = false;
		Birds[id].speed = birdSpeed;
		Birds[id].model = model;

		Birds[id].bird = gltf.scene.children[0];
		Birds[id].animations = {
			idle: gltf.animations[ birdData[model].idle.index ],
			fly: gltf.animations[  birdData[model].fly.index ],
			sing: gltf.animations[ birdData[model].sing.index ],
		};

		Birds[id].animations.idle.duration = birdData[model].idle.duration;
		Birds[id].animations.fly.duration = birdData[model].fly.duration;
		Birds[id].animations.sing.duration = birdData[model].sing.duration;

		Birds[id].bird.position.y = position.y;
		Birds[id].bird.position.x = position.x;
		Birds[id].bird.position.z = position.z;
		
		Birds[id].bird.rotation.set( 0, Math.PI * 1.25, 0 );

		/* message texture */
		Birds[id].messageCanvas = document.createElement( 'canvas' );
		Birds[id].messageCanvas.classList.add( 'message' );
		
		document.body.appendChild( Birds[id].messageCanvas );
		Birds[id].messageLines = new LinesPlayer( Birds[id].messageCanvas );
		Birds[id].messageLines.isTexture = true;
		if (drawing == 'ai') {
			Birds[id].messageLines.loadAnimation( Cool.random( aiDrawings ), setupTexture);
		} else {
			Birds[id].messageLines.loadJSON( drawing, setupTexture);
		}

		function setupTexture() {
			Birds[id].messageLines.ctx.miterLimit = 1;
			Birds[id].messageLines.ctx.lineWidth = 2;
			Birds[id].messageCanvas.width = Birds[id].messageCanvas.height = 256;
			Birds[id].messageTexture = new THREE.Texture( Birds[id].messageCanvas );
			const mat = new THREE.MeshBasicMaterial({ map: Birds[id].messageTexture, transparent: true, side: THREE.DoubleSide });

			const geo = new THREE.PlaneGeometry( 10, 10, 1 );
			Birds[id].message = new THREE.Mesh( geo, mat );

			Birds[id].message.position.set( Birds[id].bird.position.x, Birds[id].bird.position.y, Birds[id].bird.position.z );
			Birds[id].message.position.y = messageHeight;

			messageScene.add( Birds[id].message );
		}

		Birds[id].drawMessage = () => {
			if (Birds[id].message) {
				if (!Birds[id].message.visible)
					Birds[id].message.visible = true;
				Birds[id].message.lookAt( camera.position );
				Birds[id].messageTexture.needsUpdate = true;
				Birds[id].message.position.x = Birds[id].bird.position.x;
				Birds[id].message.position.z = Birds[id].bird.position.z;
				Birds[id].messageLines.draw();
			}
		};
		
		Birds[id].bird.targets = [];
		scene.add( Birds[id].bird );
		
		let eyeMaterial;

		Birds[id].bird.traverse( function( o ) {
			if ( o.material ) {
				if ( o.material.name == "Eye" ) {
					eyeMaterial = o.material;
					eyeMaterial.color.set( 0x264F72 );
				}
			}
		});

		// eyeColor
		function setEyeColor() {
			eyeMaterial.color.set( 0xffffff );
			Birds[id].eyeAnimation = setTimeout(() => {
				eyeMaterial.color.set( 0x264F72 );
				Birds[id].eyeAnimation = setTimeout( setEyeColor, Cool.random( 100, 5000 ) );
			}, 100);
		}
		Birds[id].eyeAnimation = setTimeout( setEyeColor, Cool.random( 2000, 4000 ) );

		Birds[id].currentAnimation = '';
		Birds[id].animate = label => {
			if (label != Birds[id].currentAnimation) {
				if (Birds[id].currentAnimation) {
					mixer.clipAction( Birds[id].animations[ Birds[id].currentAnimation ], Birds[id].bird ).stop();
				}
				mixer.clipAction( Birds[id].animations[ label ], Birds[id].bird ).play();
				Birds[id].currentAnimation = label;
			}
		};

		Birds[id].animate( 'idle' ); // start animation
	});
}

function removeBird( id ) {
	if (Birds[id]) {
		Birds[id].messageCanvas.remove();
		scene.remove( Birds[id].bird );
		messageScene.remove( Birds[id].message );
		// renderer.clear();
		clearTimeout( Birds[id].eyeAnimation );
		delete Birds[id];
	}
}

function updateBirds() {
	
	// get birds close to each other to draw messages
	let drawMesssageList = []; // really "sing" list now

	for (const k in Birds) {
		const b = Birds[k];
		if (b.isMoving) {
			if (b.targets.length > 0) {
				const dist = b.bird.position.distanceTo( b.targets[0] );
				if ( dist > 3.01 ) {
					b.bird.position.x += b.bird.position.x > b.targets[0].x ? -b.speed : b.speed;
					b.bird.position.z += b.bird.position.z > b.targets[0].z ? -b.speed : b.speed;
					b.bird.position.y += b.bird.position.y < dist ? b.speed / 2 : -b.speed;
				} else {
					b.targets.shift();
					if (b.targets.length > 0)
						b.bird.lookAt( b.targets[0] );
				}
			} else {
				b.isMoving = false;
				b.animate( 'idle' );

				socket.emit( 'done moving' );
				
				/* when to change animations */
				if (k == userId) {
					tapCount++;
					if (tapCount == tapAmount) {
						tapCount = 0;
						const dr = Cool.random( drawings );
						linesPlayer.loadAnimation( dr );
					}
				}
			}
		} else {
			// check terrain y
			let ray = new THREE.Raycaster( b.bird.position, downVector );
			let col = ray.intersectObject( groundMesh );
			if (col.length > 0) {
				b.bird.position.y = col[0].point.y + 1.5;
			}
		}

		// only show messages of other birds when they're close
		// currently just for triggering the "sing" animation which i dont know if it works
		for (const j in Birds) {
			if (k != j) {
				if (b.bird.position.distanceTo( Birds[j].bird.position ) < messageDistance) {
					if (!drawMesssageList.includes( j )) {
						drawMesssageList.push( j );
						if (!drawMesssageList.includes( k )) {
							drawMesssageList.push( k );
						}
					}
				}
			}
		}

		// if (!drawMesssageList.includes(k)) {
		// 	if (b.message)
		// 		b.message.visible = false;
		// }

		Birds[k].drawMessage();
	}

	if (drawMesssageList.length > 0) {
		// draw other birds messages if in range
		for (let i = 0; i < drawMesssageList.length; i++) {
			const j = drawMesssageList[i];
			// Birds[j].drawMessage();
			if (!Birds[j].isMoving) Birds[j].animate( 'sing' );
		}
	}
}

function update( data ) {
	for (const id in data) {
		for (let i = 0; i < data[id].targets.length; i++) {
			Birds[id].targets.push( new THREE.Vector3( 
				data[id].targets[i].x,
				data[id].targets[i].y,
				data[id].targets[i].z
			) );
		}
		// if there's an update, birds has to fly and look at new target
		// console.log( Birds[id].targets[0] ); // targets undefined sometimes?
		Birds[id].bird.lookAt( Birds[id].targets[0] );
		Birds[id].isMoving = true;
		Birds[id].animate( 'fly' );
	}
}

function animate() {
	requestAnimFrame(animate);
	if (performance.now() > interval + timer) {
		timer = performance.now();
		linesPlayer.draw(); // one animate frame
		
		linesTexture.needsUpdate = true;
		mixer.update( clock.getDelta() );

		updateBirds();

		if (Birds[userId]) {
			camera.position.x = Birds[userId].bird.position.x;
			camera.position.z = Birds[userId].bird.position.z + cameraOffset;
		}
		
		// renderer.render(scene, camera);
		effect.render( scene, camera );
		renderer.render( messageScene, camera );
		controls.update();
	}
}

function moveBird() {
	if (useSound) {
		tapSound.currentTime = Cool.random(tapSound.duration);
		tapSound.play();
		setTimeout(() => { tapSound.pause(); }, 800);
	}

	const bird = Birds[userId].bird;

	if (!Birds[userId].isMoving) {
		const cameraDirection = camera.getWorldDirection( cameraDirectionVector );
		socket.emit( 'move', cameraDirection, jumpDistance )
	}
}

function sceneManager( click, y ) {

	// move bird
	if ( state == 'game' && click ) {
		moveBird();
	}
	
	/* intro scenes */
	if (state == 'join') {
		uiCanvas.style.display = 'none';
		uiLines.isPlaying = false;
		state = 'game';
		animate();
		renderer.domElement.style.display = 'block';
	}

	if (state == 'sound') {
		init(); // first user input
		if (y < uiCanvas.clientHeight / 2) {
			bgMusic.play();
			useSound = true;
		}
		uiLines.loadAnimation( '/public/ui/draw.json', () => {
			state = 'draw-instructions';
		});
	}

	if (state == 'draw-instructions') {
		uiLines.loadAnimation( '/public/ui/save.json', () => {
			state = 'draw';
			drawCanvas.style.display = 'block';
			drawLines.setup();
			drawLines.start();
		});
	}

	if (state == 'draw') {
		if (y < 50) {
			const drawing = drawLines.save();
			socket.emit( 'add drawing', drawing );
			drawCanvas.style.display = 'none';
			drawLines.end();
			uiLines.loadAnimation( '/public/ui/join.json', () => {
				state = 'join';
			});
		}
	}
}

function socketEvents() {
	socket.on( 'add bird', bird => {
		// console.log( 'add', bird.id );
		addBird( bird.id, bird.model, bird.position, bird.drawing );
	});

	socket.on( 'remove bird', id => {
		// console.log( 'remove', id );
		removeBird( id );
	});

	socket.on( 'init', (birds, id) => {
		userId = id;
		for (const k in birds) {
			if (k != id) {
				addBird( birds[k].id, birds[k].model, birds[k].position, birds[k].drawing );
			}
		}
	});

	socket.on( 'update', data => {
		update(data);
	});
}

/* events */
function tapStart( event ) {

	// event.preventDefault();
	touch.start.x = event.touches[0].clientX;
	touch.start.y = event.touches[0].clientY;
	touch.move.x = event.touches[0].clientX;
	touch.move.y = event.touches[0].clientY;
}

function tapEnd( event ) {

	const delta = {
		x: touch.move.x - touch.start.x,
		y: touch.move.y - touch.start.y
	};

	// lines game would be better for this
	sceneManager( delta.x == 0 && delta.y == 0, touch.move.y );
}

function touchMove( event ) {
	event.preventDefault();

	const delta = {
		x: event.touches[0].clientX - touch.move.x,
		y: event.touches[0].clientY - touch.move.y
	};

	touch.move.x = event.touches[0].clientX;
	touch.move.y = event.touches[0].clientY;
}

const touch = {
	start: { x: 0, y: 0},
	move: { x: 0, y: 0 }
};
window.addEventListener( 'touchstart', tapStart );
window.addEventListener( 'touchend', tapEnd );
window.addEventListener( 'touchmove', touchMove );

// destktop click 
function setupDesktop() {
	renderer.domElement.addEventListener( 'click', moveBird );
}


/* boring */
function onWindowResize() { 
	// console.log('resize');
	width =  document.documentElement.clientWidth;
	height =  document.documentElement.clientHeight;
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize(width, height);
}
window.addEventListener( 'resize', onWindowResize, false );

/* debug */
socket.on('get-eval', msg => {
	console.log(msg);
});

function servLog(statement) {
	socket.emit('send-eval', statement);
}

/* stop sound/site when leaving browser */
document.addEventListener('visibilitychange', ev => {
	// location.reload(); // easier for now
	if (document.hidden && !bgMusic.paused) {
		bgMusic.pause();
	} else if (!document.hidden && bgMusic.paused) {
		if (useSound) bgMusic.play();
	}
});

/*
	try later - based on orbit controls?
	https://stackoverflow.com/questions/35283320/three-js-rotate-camera-with-both-touch-and-device-orientation
	device + touch
*/