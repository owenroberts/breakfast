/* play module */
function LinesPlayer(canvas, src, lps, callback, isTexture) {
	this.canvas = canvas;
	if (!this.canvas) 
		this.canvas = document.getElementById('lines');
	if (!this.canvas) {
		this.canvas = document.createElement("canvas");
		document.body.appendChild(this.canvas);
	}
	this.ctx = this.canvas.getContext('2d');
	this.ctx.miterLimit = 1;
	this.width;
	this.height;
	this.scale = 1;
	
	this.currentFrame = 0; // always int, floor cfc
	this.currentFrameCounter = 0; // uses intervalRatio, so it's a float
	this.isPlaying = true;
	
	this.lps = lps || 10; // default
	this.lineInterval = 1000 / this.lps;
	this.timer = performance.now();
	this.intervalRatio = 1;
	/* 	initialize to one but this is the math
	 this.lineInterval / (1000 / this.lps);    */

	this.frames = [];
	this.drawings = [];
	this.ctxStrokeColor;
	this.mixedColors = false;
	this.isTexture = isTexture || false; /* if used for 3d texture it doesnt animate or resize */

	this.drawLines = function(params) {
	};

	this.draw = function() {
		if (!this.isTexture && this.isPlaying)
			requestAnimFrame(this.draw.bind(this));
		if (performance.now() > this.lineInterval + this.timer) {
			this.timer = performance.now();
			if (this.isPlaying && this.currentFrameCounter < this.frames.length) {
				this.currentFrameCounter += this.intervalRatio;
				this.currentFrame = Math.floor(this.currentFrameCounter);
			}
			if (this.isPlaying && this.currentFrame >= this.frames.length) {
				this.currentFrame = this.currentFrameCounter = 0;
				if (this.onPlayedOnce)
					this.onPlayedOnce();
			}
			this.ctx.clearRect(0, 0, this.width, this.height);
			if (this.frames[this.currentFrame]) {
				if (!this.mixedColors)
					this.ctx.beginPath();
				for (let i = 0; i < this.frames[this.currentFrame].length; i++) {
					const fr = this.frames[this.currentFrame][i];
					const jig = +fr.r;
					const seg = +fr.n;
					const dr = this.drawings[fr.d];
					const wig = +fr.w || 0; // or zero for older drawings for now 
					const wigSpeed = +fr.v || 0;
					const off = {
						x: Cool.random(0, wig),
						xSpeed: Cool.random(-wigSpeed, wigSpeed),
						y: Cool.random(0, wig),
						ySpeed: Cool.random(-wigSpeed, wigSpeed)
					};
					if (this.mixedColors)
						this.ctx.beginPath();
					for (let h = fr.s; h < fr.e - 1; h++) {
						const s = dr[h];
						const e = dr[h + 1];
						let v = new Cool.Vector(e.x, e.y);
						v.subtract(s);
						v.divide(seg);
						this.ctx.moveTo( 
							fr.x + s.x + Cool.random(-jig, jig) + off.x, 
							fr.y + s.y + Cool.random(-jig, jig) + off.y
						);
						for (let j = 0; j < seg; j++) {
							let p = new Cool.Vector(s.x + v.x * j, s.y + v.y * j);
							this.ctx.lineTo( 
								fr.x + p.x + v.x + Cool.random(-jig, jig) + off.x, 
								fr.y + p.y + v.y + Cool.random(-jig, jig) + off.y
							);
						}
						if (this.ctxStrokeColor != fr.c) {
							this.ctxStrokeColor = fr.c;
							this.ctx.strokeStyle= "#" + this.ctxStrokeColor;
						}

						off.x += off.xSpeed;
						if (off.x >= wig || off.x <= -wig)
							off.xSpeed *= -1;

						off.y += off.ySpeed;
						if (off.y >= wig || off.y <= -wig)
							off.ySpeed *= -1;

					}

					if (this.mixedColors)
						this.ctx.stroke();
				}
				if (!this.mixedColors)
					this.ctx.stroke();
			}
		}
	};

	this.sizeCanvas = function() {
		const padding = 0; /* seems like its for the comics, fucks the mobile stuff */ 
		const top = canvas.getBoundingClientRect().top;

		if (window.innerWidth - padding * 2 < this.width)
			this.scale = (window.innerWidth - padding * 2) / this.width;
		else if ((window.innerHeight - top - padding * 2) < this.height)
			this.scale = (window.innerHeight - top - padding * 2) / this.height;
		else
			this.scale = 1;

		if (this.scale != 1) {
			if (this.scale * this.width / (window.innerHeight - top) > this.width/this.height) {
				this.canvas.height = window.innerHeight;
				this.canvas.width = this.canvas.height * (this.width / this.height);
				this.scale = this.canvas.height / this.height;
			} else {
				this.canvas.width = Math.min(this.width * this.scale, this.width);
				this.canvas.height = Math.min(this.height * this.scale, this.height);
			}
			this.ctx.scale(this.scale, this.scale);
		}
		this.ctxStrokeColor = undefined; // color gets f*ed when resetting canvas
	};

	this.loadAnimation = function(src, callback) {
		fetch(src)
			.then(response => { return response.json() })
			.then(data => {
				this.frames = data.f;
				this.drawings = data.d;
				this.intervalRatio = this.lineInterval / (1000 / data.fps);
				this.currentFrame = this.currentFrameCounter = 0;
				this.width = this.canvas.width = data.w;
				this.height = this.canvas.height = data.h;
				this.ctxStrokeColor = undefined; // note setting canvas width resets the color
				this.ctx.miterLimit = 1;
				if (data.mc)
					this.mixedColors = data.mc;
				if (data.bg)
					this.canvas.style.backgroundColor = '#' + data.bg;
				if (callback) 
					callback(); // callback to do something after drawing loads

				if (!this.isTexture) {
					requestAnimFrame(this.draw.bind(this));
					this.sizeCanvas();
					window.addEventListener('resize', this.sizeCanvas.bind(this), false);
				}
			});
	};

	if (src) 
		this.loadAnimation(src, callback);
}

function loadAnimation(src, canvas, callback) {
	const player = new LinesPlayer(canvas, src, callback);
}