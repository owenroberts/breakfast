let state = 'intro'; /* sound, start, game */
let useSound = false;
let timer = performance.now();
const interval = 1000 / 30;

/* on boarding ui */
const uiCanvas = document.getElementById('ui');
const uiLines = new LinesPlayer( uiCanvas );
uiLines.onPlayedOnce = () => {
	uiLines.isPlaying = false;
	uiLines.onPlayedOnce = null;
	uiLines.loadAnimation( '/public/drawings/sound.json', () => {
		uiLines.isPlaying = true;
	});
	state = 'sound';
};
uiLines.loadAnimation( '/public/drawings/title.json' );


/* lines texture  */
const lines = document.getElementById('lines');
let width = window.innerWidth, height = window.innerHeight;
const linesPlayer = new LinesPlayer(lines);
linesPlayer.isTexture = true;
let linesTexture; /* texture gets updated */

const bgMusic = new Audio();
bgMusic.src = '/public/audio/theme_1.mp3';
bgMusic.loop = true;

const tapSound = new Audio();
tapSound.src = '/public/audio/bounce.mp3';

const drawings = [
	"/public/drawings/end_2.json", // fast
	/*"/public/drawings/feeder_4.json", */ // slow
	"/public/drawings/feeder_close.json", // medium
	"/public/drawings/feeder_pole.json", // fast
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

let camera, scene, renderer, controls;

let clock, mixer;

let bird;
const birdModel = Math.random() < 0.65 ? 'nightjar' : 'wren';

let linesGroup;
let testCube;

// better than mobile check, includes ipad
function onMotion(ev) {
	window.removeEventListener('devicemotion', onMotion, false);
	if (ev.acceleration.x != null || ev.accelerationIncludingGravity.x != null) {
		// init();
		document.addEventListener('visibilitychange', location.reload) // hacky for now
	}
}
window.addEventListener('devicemotion', onMotion, false);

init();

function init() {
	clock = new THREE.Clock();
	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xffffff );

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize(width, height);
	document.body.appendChild(renderer.domElement);
	renderer.domElement.style.display = 'none';
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	effect = new THREE.OutlineEffect( renderer, {
		defaultThickness: 0.006,
		defaultColor: new THREE.Color( 0x264F72 )
	} );

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1100 );
	controls = new THREE.DeviceOrientationControls( camera );
	camera.position.z = 10;
	camera.position.y = 20;

	/* test cube */
	var geometry = new THREE.BoxBufferGeometry( 5, 5, 5 );
	var material = new THREE.MeshBasicMaterial(  );
	testCube = new THREE.Mesh( geometry, material );
	// scene.add( testCube );

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
	linesTexture = new THREE.Texture(lines);
	const linesMaterial = new THREE.MeshBasicMaterial({ map: linesTexture, transparent: true, side: THREE.DoubleSide /*, color: 0xff00ff */});
	linesPlayer.loadAnimation( "/public/drawings/feeder_2.json" );

	var groundMesh = new THREE.Mesh( ground, linesMaterial );
	
	// var vertexNormalsHelper = new THREE.FaceNormalsHelper( groundMesh, 3 );
	// groundMesh.add( vertexNormalsHelper );
	scene.add( groundMesh );

	const testPlane = new THREE.Mesh( new THREE.PlaneBufferGeometry( 100, 100, 4, 4 ), linesMaterial );
	testPlane.position.set( 0, 0, -20 );
	// scene.add( textPlane );

	/* blender */
	mixer = new THREE.AnimationMixer( scene );
	// let loader = new THREE.JSONLoader();
	var loader = new THREE.GLTFLoader();
	loader.load(`/public/models/${birdModel}.gltf`, function( gltf ) {
		// console.log( gltf );

		bird = gltf.scene.children[0];
		bird.animations = gltf.animations;
		const dur = birdModel == 'nightjar' ? 10 : 20;
		bird.animations[1].duration = 1000 / 24 * 10 / 1000;
		bird.position.y = 2;
		
		bird.rotation.x = 0;
		bird.rotation.y = Math.PI * 1.25;
		bird.rotation.z = 0;

		bird.isMoving = false;
		bird.speed = 1.5;
		bird.targets = [];
		scene.add( bird );
		bird.traverse(function(o) {
			if (o.material) {
				if (o.material.name == "Eye") {
					bird.eyeColor = o.material.color;
					bird.originalColor = {
						r: bird.eyeColor.r,
						g: bird.eyeColor.g,
						b: bird.eyeColor.b,
					}
				}
			}
		});

		// eyeColor
		function setEyeColor() {
			bird.eyeColor.r = 1;
			bird.eyeColor.g = 1;
			bird.eyeColor.b = 1;
			setTimeout(() => {
				bird.eyeColor.r = bird.originalColor.r;
				bird.eyeColor.g = bird.originalColor.g;
				bird.eyeColor.b = bird.originalColor.b;
				setTimeout( setEyeColor, Cool.random( 100, 5000 ) );
			}, 100);
		}
		setTimeout( setEyeColor, Cool.random( 2000, 4000 ) );

		// start animation			
		mixer.clipAction(bird.animations[0]).play();
		
		// animate();
	});

	// fullscreen();
}

function animate() {
	requestAnimFrame(animate);
	if (performance.now() > interval + timer) {
		timer = performance.now();
		linesPlayer.draw(); // one animate frame
		mixer.update( clock.getDelta() );
		linesTexture.needsUpdate = true;
			
		// testCube.rotation.x += 0.005;
		// testCube.rotation.y += 0.01;

		if (bird.isMoving) {
			if (bird.targets.length > 0) {
				const dist = bird.position.distanceTo(bird.targets[0]);
				if ( dist > 3.01) {
					bird.position.x += bird.position.x > bird.targets[0].x ? -bird.speed : bird.speed;
					bird.position.z += bird.position.z > bird.targets[0].z ? -bird.speed : bird.speed;
					bird.position.y += bird.position.y < dist ? bird.speed / 2 : -bird.speed;
				} else {
					bird.targets.shift();
					if (bird.targets.length > 0)
						bird.lookAt( bird.targets[0] );
				}
			} else {
				bird.isMoving = false;
				mixer.clipAction(bird.animations[1]).stop();
				mixer.clipAction(bird.animations[0]).play();
				const dr = Cool.random( drawings );
				// console.log(dr);
				linesPlayer.loadAnimation( dr );
			}
		}

		camera.position.x = bird.position.x;
		camera.position.z = bird.position.z + 10;

		// renderer.render(scene, camera);
		effect.render( scene, camera );
		controls.update();
	}
}

/* events */
function tapStart(event) {

	lastTouch = event.touches[0];

	if (state == 'game') {
		if (useSound) {
			tapSound.currentTime = Cool.random(tapSound.duration);
			tapSound.play();
			setTimeout(() => { tapSound.pause(); }, 800);
		}

		if (!bird.isMoving) {
			bird.isMoving = true;
			mixer.clipAction(bird.animations[0]).stop();
			mixer.clipAction(bird.animations[1]).play();
			const off = 12;
			const t1 = new THREE.Vector3(
				Cool.random(bird.position.x - off, bird.position.x + off),
				bird.position.y,
				Cool.random(bird.position.z - off, bird.position.z + off)
			);
			const t2 = new THREE.Vector3(
				Cool.random(t1.x - off, t1.x + off),
				bird.position.y,
				Cool.random(t1.z - off, t1.z + off)
			);
			const t3 = new THREE.Vector3(
				Cool.random(t2.x - off, t2.x + off),
				bird.position.y,
				Cool.random(t2.z - off, t2.z + off)
			);
			bird.targets.push( t1 );
			bird.targets.push( t2 );
			bird.targets.push( t3 );
			bird.lookAt( t1 );
		}
	}
}

function tapEnd(event) {
	
	/* intro scenes */
	if (state == 'start') {
		uiCanvas.style.display = 'none';
		uiLines.isPlaying = false;
		state = 'game';
		animate();
		renderer.domElement.style.display = 'block';
	}

	if (state == 'sound') {
		if (lastTouch.clientY < height / 2) {
			bgMusic.play();
			useSound = true;
		}
		uiLines.loadAnimation( '/public/drawings/join.json', () => {
			state = 'start';
		});
	}
}

let lastTouch;
window.addEventListener('touchstart', tapStart);
window.addEventListener('touchend', tapEnd);

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

function fullscreen() {
	if (renderer.domElement.requestFullscreen) {
		renderer.domElement.requestFullscreen();
	} else if (renderer.domElement.msRequestFullscreen) {
		renderer.domElement.msRequestFullscreen();
	} else if (renderer.domElement.mozRequestFullScreen) {
		renderer.domElement.mozRequestFullScreen();
	} else if (renderer.domElement.webkitRequestFullscreen) {
		renderer.domElement.webkitRequestFullscreen();
	}
}
function exitFullscreen() {
	document.exitFullscreen = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
	if (document.exitFullscreen)
		document.exitFullscreen();
}