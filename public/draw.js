/* draw module */
function LinesDraw(canvas, lineColor) {
	const self = this;

	this.canvas = canvas;
	this.ctx = this.canvas.getContext('2d');
	this.ctx.miterLimit = 1;
	this.ctx.lineWidth = 2;
	this.width = this.canvas.width = window.innerWidth;
	this.height = this.canvas.height = window.innerWidth;

	/* hard coded for now bc other options suck
		bounding rect changes on mobile with drag
		can get CSS but it's weird
		https://stackoverflow.com/questions/6338217/get-a-css-value-with-javascript/16112771 */
	this.offset = 80; 


	this.lines = [];
	this.isPlaying = false;

	this.lps = 10; // default
	this.lineInterval = 1000 / this.lps;
	this.timer = performance.now();
	this.intervalRatio = 1;

	this.frames = [];
	this.drawings = [];
	this.ctx.strokeStyle = '#' + lineColor;
	this.mixedColors = false;

	this.segNum = 2;
	this.jiggle = 1;

	this.draw = function() {
		requestAnimFrame(this.draw.bind(this));
		if (performance.now() > this.lineInterval + this.timer) {
			this.timer = performance.now();
			this.ctx.clearRect(0, 0, this.width, this.height);
			this.ctx.beginPath();
			for (let i = 0; i < this.lines.length - 1; i++) {
				const s = this.lines[i];
				if (lines != 'end') {
					const e = this.lines[i + 1];
					const v = new Cool.Vector(e.x, e.y);
					v.subtract(s);
					v.divide(this.segNum);
					this.ctx.moveTo(
						s.x + Cool.random(-this.jiggle, this.jiggle),
						s.y + Cool.random(-this.jiggle, this.jiggle)
					);
					for (let j = 0; j < this.segNum; j++) {
						const p = new Cool.Vector(s.x + v.x * j, s.y + v.y * j);
						this.ctx.lineTo(
							p.x + v.x + Cool.random(-this.jiggle, this.jiggle),
							p.y + v.y + Cool.random(-this.jiggle, this.jiggle)
						);
					}

				}
			}
			this.ctx.stroke();
		}
	};

	this.start = function() {
		this.isPlaying = true;
		requestAnimFrame(this.draw.bind(this));
		this.ctx.lineWidth = 2;
	};

	this.end = function() {
		this.isPlaying = false;
	};

	this.save = function() {
		/* add wiggle */
		/* add explode */
		/* return json string */
		const json = {};
		const frames = [];
		const wiggle = Cool.randomInt(1, 3);
		const speed = Cool.random(0.1, 0.5).toFixed(2);

		const segmentsPerFrame = Math.floor(this.lines.length / 50) || 1;
		for (let i = 0; i < this.lines.length; i += segmentsPerFrame) {
			const layer = {
				d: 0,
				s: 0,
				e: i,
				c: lineColor,
				x: 0,
				y: 0,
				n: 2,
				r: 1,
				w: wiggle,
				v: speed
			};
			frames.push([layer]);
		}

		for (let i = 0; i < this.lines.length; i += segmentsPerFrame) {
			const layer = {
				d: 0,
				s: i,
				e: this.lines.length,
				c: lineColor,
				x: 0,
				y: 0,
				n: 2,
				r: 1,
				w: wiggle,
				v: speed
			};
			frames.push([layer]);
		}

		json.w = this.width;
		json.h = this.height;
		json.fps = 10;
		json.f = frames;
		json.d = [this.lines];
		return JSON.stringify(json);
	};

	this.isDrawing = false;
	this.drawTimer = performance.now();
	this.drawInterval = 30;

	this.addLine = function(x, y) {
		self.lines.push(new Cool.Vector(x, y));
	};

	this.drawUpdate = function(ev) {
		const touch = ev.touches[0];
		if (performance.now() > self.drawInterval + self.drawTimer) {
			self.drawTimer = performance.now();
			if (self.isDrawing && touch)
				self.addLine(
					Math.round(touch.clientX), 
					Math.round(touch.clientY) - self.offset
				);
		}
	};

	this.drawStart = function(ev) {
		const touch = ev.touches[0];
		const offset = touch.target.getBoundingClientRect();
		if (touch) {
			self.isDrawing = true;
			self.drawTimer = performance.now();
			self.addLine(
				Math.round(touch.clientX), 
				Math.round(touch.clientY) - self.offset
			);
		}
	};

	this.drawEnd = function(ev) {
		self.isDrawing = false;
		self.lines.push("end");
	};

	this.canvas.addEventListener('touchstart', self.drawStart);
	this.canvas.addEventListener('touchend', self.drawEnd);
	this.canvas.addEventListener('touchmove', self.drawUpdate);
}	