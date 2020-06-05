/**
 * @author richt / http://richt.me
 * @author WestLangley / http://github.com/WestLangley
 *
 * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
 */

/*
	i added manual controls from this example:
	http://richtr.github.io/threeVR/examples/vr_basic.html
*/

import {
	Euler,
	MathUtils,
	Quaternion,
	Vector3,
	Matrix4
} from "./three.module.js";

var DeviceOrientationControls = function ( object ) {

	var scope = this;

	this.object = object;
	this.object.rotation.reorder( 'YXZ' );

	this.enabled = true;

	this.deviceOrientation = {};
	this.screenOrientation = 0;

	this.alphaOffset = 0; // radians

	var freeze = true;
	var enableManualDrag = true; // enable manual user drag override control by default
	var useQuaternions = true; // use quaternions for orientation calculation by default

	// Manual rotate override components
	var startX = 0, startY = 0,
	    currentX = 0, currentY = 0,
	    scrollSpeedX, scrollSpeedY,
	    tmpQuat = new Quaternion();

	var CONTROLLER_STATE = {
		AUTO: 0,
		MANUAL_ROTATE: 1,
		MANUAL_ZOOM: 2
	};

	var appState = CONTROLLER_STATE.AUTO;

	var CONTROLLER_EVENT = {
		CALIBRATE_COMPASS:  'compassneedscalibration',
		SCREEN_ORIENTATION: 'orientationchange',
		MANUAL_CONTROL:     'userinteraction', // userinteractionstart, userinteractionend
		ZOOM_CONTROL:       'zoom',            // zoomstart, zoomend
		ROTATE_CONTROL:     'rotate',          // rotatestart, rotateend
	};

	// Consistent Object Field-Of-View fix components
	var startClientHeight = window.innerHeight,
	    startFOVFrustrumHeight = 2000 * Math.tan( MathUtils.degToRad( ( this.object.fov || 75 ) / 2 ) ),
	    relativeFOVFrustrumHeight, relativeVerticalFOV;

	var deviceQuat = new Quaternion();

	var fireEvent = function () {
		var eventData;

		return function ( name ) {
			eventData = arguments || {};

			eventData.type = name;
			eventData.target = this;

			this.dispatchEvent( eventData );
		}.bind( this );
	};

	var constrainObjectFOV = function () {
		relativeFOVFrustrumHeight = startFOVFrustrumHeight * ( window.innerHeight / startClientHeight );

		relativeVerticalFOV = MathUtils.radToDeg( 2 * Math.atan( relativeFOVFrustrumHeight / 2000 ) );

		object.fov = relativeVerticalFOV;
	};

	var onDocumentMouseDown = function ( event ) {
		if ( enableManualDrag !== true ) return;

		event.preventDefault();

		appState = CONTROLLER_STATE.MANUAL_ROTATE;

		freeze = true;

		tmpQuat.copy( object.quaternion );

		startX = currentX = event.pageX;
		startY = currentY = event.pageY;

		// Set consistent scroll speed based on current viewport width/height
		scrollSpeedX = ( 1200 / window.innerWidth ) * 0.2;
		scrollSpeedY = ( 800 / window.innerHeight ) * 0.2;

		window.addEventListener( 'mousemove', onDocumentMouseMove, false );
		window.addEventListener( 'mouseup', onDocumentMouseUp, false );

		fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'start' );
		fireEvent( CONTROLLER_EVENT.ROTATE_CONTROL + 'start' );
	};

	var onDocumentMouseMove = function ( event ) {
		currentX = event.pageX;
		currentY = event.pageY;
	};

	var onDocumentMouseUp = function ( event ) {
		window.removeEventListener( 'mousemove', this.onDocumentMouseMove, false );
		window.removeEventListener( 'mouseup', this.onDocumentMouseUp, false );

		appState = CONTROLLER_STATE.AUTO;

		freeze = false;

		fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'end' );
		fireEvent( CONTROLLER_EVENT.ROTATE_CONTROL + 'end' );
	};

	var onDocumentTouchStart = function ( event ) {
		// event.preventDefault();
		event.stopPropagation();

		// console.log( event );

		if ( event.touches.length > 0 ) {
			if ( enableManualDrag !== true ) return;

			appState = CONTROLLER_STATE.MANUAL_ROTATE;

			freeze = true;

			tmpQuat.copy( object.quaternion );

			startX = currentX = event.touches[ 0 ].pageX;
			startY = currentY = event.touches[ 0 ].pageY;

			// Set consistent scroll speed based on current viewport width/height
			scrollSpeedX = ( 1200 / window.innerWidth ) * 0.1;
			scrollSpeedY = ( 800 / window.innerHeight ) * 0.1;

			window.addEventListener( 'touchmove', onDocumentTouchMove, false );
			window.addEventListener( 'touchend', onDocumentTouchEnd, false );

			fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'start' );
			fireEvent( CONTROLLER_EVENT.ROTATE_CONTROL + 'start' );

		}
	};

	var onDocumentTouchMove = function ( event ) {
		switch( event.touches.length ) {
			case 1:
				currentX = event.touches[ 0 ].pageX;
				currentY = event.touches[ 0 ].pageY;
				break;

			case 2:
				zoomP1.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				zoomP2.set( event.touches[ 1 ].pageX, event.touches[ 1 ].pageY );
				break;
		}
	};

	var onDocumentTouchEnd = function ( event ) {
		window.removeEventListener( 'touchmove', onDocumentTouchMove, false );
		window.removeEventListener( 'touchend', onDocumentTouchEnd, false );

		if ( appState === CONTROLLER_STATE.MANUAL_ROTATE ) {

			appState = CONTROLLER_STATE.AUTO; // reset control state

			freeze = false;

			fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'end' );
			fireEvent( CONTROLLER_EVENT.ROTATE_CONTROL + 'end' );

		} else if ( appState === CONTROLLER_STATE.MANUAL_ZOOM ) {

			constrainObjectFOV(); // re-instate original object FOV

			appState = CONTROLLER_STATE.AUTO; // reset control state

			freeze = false;

			fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'end' );
			fireEvent( CONTROLLER_EVENT.ZOOM_CONTROL + 'end' );

		}
	};

	var createQuaternion = function () {

		var finalQuaternion = new Quaternion();

		var deviceEuler = new Euler();

		var screenTransform = new Quaternion();

		var worldTransform = new Quaternion( - Math.sqrt(0.5), 0, 0, Math.sqrt(0.5) ); // - PI/2 around the x-axis

		var minusHalfAngle = 0;

		return function ( alpha, beta, gamma, screenOrientation ) {

			deviceEuler.set( beta, alpha, - gamma, 'YXZ' );

			finalQuaternion.setFromEuler( deviceEuler );

			minusHalfAngle = - screenOrientation / 2;

			screenTransform.set( 0, Math.sin( minusHalfAngle ), 0, Math.cos( minusHalfAngle ) );

			finalQuaternion.multiply( screenTransform );

			finalQuaternion.multiply( worldTransform );

			return finalQuaternion;

		}

	}();

	var createRotationMatrix = function () {

		var finalMatrix = new Matrix4();

		var deviceEuler = new Euler();
		var screenEuler = new Euler();
		var worldEuler = new Euler( - Math.PI / 2, 0, 0, 'YXZ' ); // - PI/2 around the x-axis

		var screenTransform = new Matrix4();

		var worldTransform = new Matrix4();
		worldTransform.makeRotationFromEuler(worldEuler);

		return function (alpha, beta, gamma, screenOrientation) {

			deviceEuler.set( beta, alpha, - gamma, 'YXZ' );

			finalMatrix.identity();

			finalMatrix.makeRotationFromEuler( deviceEuler );

			screenEuler.set( 0, - screenOrientation, 0, 'YXZ' );

			screenTransform.identity();

			screenTransform.makeRotationFromEuler( screenEuler );

			finalMatrix.multiply( screenTransform );

			finalMatrix.multiply( worldTransform );

			return finalMatrix;

		}

	}();

	this.updateManualMove = function () {


		var lat, lon;
		var phi, theta;

		var rotation = new Euler( 0, 0, 0, 'YXZ' );

		var rotQuat = new Quaternion();
		var objQuat = new Quaternion();

		var tmpZ, objZ, realZ;

		var zoomFactor, minZoomFactor = 1; // maxZoomFactor = Infinity

		return function () {

			objQuat.copy( tmpQuat );

			if ( appState === CONTROLLER_STATE.MANUAL_ROTATE ) {

				lat = ( startY - currentY ) * scrollSpeedY;
				lon = ( startX - currentX ) * scrollSpeedX;

				phi	 = MathUtils.degToRad( lat );
				theta = MathUtils.degToRad( lon );

				rotQuat.set( 0, Math.sin( theta / 2 ), 0, Math.cos( theta / 2 ) );

				objQuat.multiply( rotQuat );

				rotQuat.set( Math.sin( phi / 2 ), 0, 0, Math.cos( phi / 2 ) );

				objQuat.multiply( rotQuat );

				// Remove introduced z-axis rotation and add device's current z-axis rotation

				tmpZ  = rotation.setFromQuaternion( tmpQuat, 'YXZ' ).z;
				objZ  = rotation.setFromQuaternion( objQuat, 'YXZ' ).z;
				realZ = rotation.setFromQuaternion( deviceQuat || tmpQuat, 'YXZ' ).z;

				rotQuat.set( 0, 0, Math.sin( ( realZ - tmpZ  ) / 2 ), Math.cos( ( realZ - tmpZ ) / 2 ) );

				tmpQuat.multiply( rotQuat );

				rotQuat.set( 0, 0, Math.sin( ( realZ - objZ  ) / 2 ), Math.cos( ( realZ - objZ ) / 2 ) );

				objQuat.multiply( rotQuat );

				this.object.quaternion.copy( objQuat );

			} else if ( appState === CONTROLLER_STATE.MANUAL_ZOOM ) {

				zoomCurrent = zoomP1.distanceTo( zoomP2 );

				zoomFactor = zoomStart / zoomCurrent;

				if ( zoomFactor <= minZoomFactor ) {

					this.object.fov = tmpFOV * zoomFactor;

					this.object.updateProjectionMatrix();

				}

				// Add device's current z-axis rotation

				if ( deviceQuat ) {

					tmpZ  = rotation.setFromQuaternion( tmpQuat, 'YXZ' ).z;
					realZ = rotation.setFromQuaternion( deviceQuat, 'YXZ' ).z;

					rotQuat.set( 0, 0, Math.sin( ( realZ - tmpZ ) / 2 ), Math.cos( ( realZ - tmpZ ) / 2 ) );

					tmpQuat.multiply( rotQuat );

					this.object.quaternion.copy( tmpQuat );

				}

			}

		};

	}();

	this.updateDeviceMove = function () {

		var alpha, beta, gamma, orient;

		var deviceMatrix;

		return function () {

			alpha  = MathUtils.degToRad( this.deviceOrientation.alpha || 0 ); // Z
			beta   = MathUtils.degToRad( this.deviceOrientation.beta  || 0 ); // X'
			gamma  = MathUtils.degToRad( this.deviceOrientation.gamma || 0 ); // Y''
			orient = MathUtils.degToRad( this.screenOrientation       || 0 ); // O

			// only process non-zero 3-axis data
			if ( alpha !== 0 && beta !== 0 && gamma !== 0) {

				if ( this.useQuaternions ) {

					deviceQuat = createQuaternion( alpha, beta, gamma, orient );

				} else {

					deviceMatrix = createRotationMatrix( alpha, beta, gamma, orient );

					deviceQuat.setFromRotationMatrix( deviceMatrix );

				}

				if ( freeze ) return;

				//this.object.quaternion.slerp( deviceQuat, 0.07 ); // smoothing
				this.object.quaternion.copy( deviceQuat );

			}

		};

	}();


	var onDeviceOrientationChangeEvent = function ( event ) {

		scope.deviceOrientation = event;

	};

	var onScreenOrientationChangeEvent = function () {

		scope.screenOrientation = window.orientation || 0;

	};

	// The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

	var setObjectQuaternion = function () {

		var zee = new Vector3( 0, 0, 1 );

		var euler = new Euler();

		var q0 = new Quaternion();

		var q1 = new Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

		return function ( quaternion, alpha, beta, gamma, orient ) {

			euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us

			quaternion.setFromEuler( euler ); // orient the device

			quaternion.multiply( q1 ); // camera looks out the back of the device, not the top

			quaternion.multiply( q0.setFromAxisAngle( zee, - orient ) ); // adjust for screen orientation

		};

	}();

	var setupEvents = function() {
		window.addEventListener( 'resize', constrainObjectFOV, false );
		window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );
		window.addEventListener( 'mousedown', onDocumentMouseDown, false );
		window.addEventListener( 'touchstart', onDocumentTouchStart, false );
		freeze = false;
	};

	this.connect = function () {

		onScreenOrientationChangeEvent(); // run once on load

		// iOS 13+

		if ( window.DeviceOrientationEvent !== undefined && typeof window.DeviceOrientationEvent.requestPermission === 'function' ) {

			window.DeviceOrientationEvent.requestPermission().then( function ( response ) {

				if ( response == 'granted' ) {
					setupEvents();
					// events.onControlsGranted();
				} else {
					// events.onControlsDenied();
				}

			} ).catch( function ( error ) {
				console.error( 'THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:', error );
				// events.onControlsDenied();
			} );

		} else {

			setupEvents();
			// onControlsGranted(); // android
			// events.onCheckDevice();
		}

		scope.enabled = true;

	};

	this.disconnect = function () {

		window.removeEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.removeEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = false;

	};

	this.update = function () {


		this.updateDeviceMove();


		if ( appState !== CONTROLLER_STATE.AUTO ) {
			this.updateManualMove();
		}
	};

	// this.update = function () {

	// 	if ( scope.enabled === false ) return;

	// 	var device = scope.deviceOrientation;

	// 	if ( device ) {

	// 		var alpha = device.alpha ? MathUtils.degToRad( device.alpha ) + scope.alphaOffset : 0; // Z

	// 		var beta = device.beta ? MathUtils.degToRad( device.beta ) : 0; // X'

	// 		var gamma = device.gamma ? MathUtils.degToRad( device.gamma ) : 0; // Y''

	// 		var orient = scope.screenOrientation ? MathUtils.degToRad( scope.screenOrientation ) : 0; // O

	// 		setObjectQuaternion( scope.object.quaternion, alpha, beta, gamma, orient );

	// 	}
	// };

	this.dispose = function () {

		scope.disconnect();

	};

	this.connect();

};

export { DeviceOrientationControls };
