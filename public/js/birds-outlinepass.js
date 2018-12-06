const lines = document.getElementById('lines');
const width = window.innerWidth, height = window.innerHeight;
const linesPlayer = new LinesPlayer(lines);

let camera, scene, renderer, controls;
let linesTexture; /* texture gets updated */
let clock, mixer;
let composer, effectFXAA, outlinePass;

var outlineParams = {
	edgeStrength: 10.0,
	edgeGlow: 0.0,
	edgeThickness: 1.0,
	pulsePeriod: 0,
	rotate: false,
	usePatternTexture: false,
	visibleEdgeColor: '#264F72',
	hiddenEdgeColor: '#152c3f'

};

let bird;
let eyeColor;

let mesh;

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
	scene.background = new THREE.Color( 0xff00ff );

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize(width, height);
	document.body.appendChild(renderer.domElement);
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	// effect = new THREE.OutlineEffect( renderer, {
	// 	defaultThickNess: 5,
	// 	defaultColor: new THREE.Color( 0x264F72 )
	// } );

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1100 );
	controls = new THREE.DeviceOrientationControls( camera );
	camera.position.z = 10;
	camera.position.y = 5;

	var geometry = new THREE.BoxBufferGeometry( 5, 5, 5 );
	var material = new THREE.MeshBasicMaterial(  );
	mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	composer = new THREE.EffectComposer( renderer );

	var renderPass = new THREE.RenderPass( scene, camera );
	// renderPass.renderToScreen = true;
	composer.addPass( renderPass );

	outlinePass = new THREE.OutlinePass( new THREE.Vector2( window.innerWidth, window.innerHeight ), scene, camera );
	// for (const key in outlineParams) {
	// 	outlinePass[key] = outlineParams[key];
	// }
	// outlinePass.renderToScreen = true;
	
	composer.addPass( outlinePass );

	effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );
	effectFXAA.renderToScreen = true;
	composer.addPass( effectFXAA );

	/* blender */
	mixer = new THREE.AnimationMixer( scene );
	// let loader = new THREE.JSONLoader();
	var loader = new THREE.GLTFLoader();
	loader.load("models/nightjar_1.gltf", function( gltf ) {
		// console.log(gltf);
		bird = gltf.scene.children[0];
		scene.add( bird );
		bird.traverse(function(o) {
			if (o.material) {
				if (o.material.name == "Eye") {
					eyeColor = o.material.color;
				}
			}
		});
		// eyeColor
		outlinePass.selectedObjects.push( bird );
		mixer.clipAction( gltf.animations[2] ).play();
		// scene.add(bird);
		animate();
	});
	// fullscreen();
}

function animate() {
	requestAnimationFrame(animate);
	mixer.update( clock.getDelta() );
	mesh.rotation.x += 0.005;
	mesh.rotation.y += 0.01;

	// effect.render( scene, camera );
	// renderer.render(scene, camera);
	composer.render();

	controls.update();
}

/* boring */
function onWindowResize() { 
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