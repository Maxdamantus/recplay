define(["./levReader", "./recReader", "./get", "./lgr", "./player"], function(levReader, recReader, get, lgr, player){
	return function(levName, imagesPath, elem, document){
		function mkCanv(w, h){
			var o = document.createElement("canvas");
			o.width = w;
			o.height = h;
			return o;
		}

		return function(cont){
			var canvase = mkCanv(1024, 768);
			var canvas = canvase.getContext("2d");
			elem.appendChild(canvase);
			get(levName, function(lev){
				var pl = player(levReader(lev), window.lgr = lgr(imagesPath, function(){
					return document.createElement("img");
				}, mkCanv), mkCanv);
				window.pl = pl; // just so it's accessible in the console

				function listener(e){
					var kc = e.keyCode, result;
					if(!e.ctrlKey && !e.metaKey && !e.altKey && kc >= "A".charCodeAt(0) && kc <= "Z".charCodeAt(0))
						result = String.fromCharCode(kc + (!e.shiftKey)*32);
					else
						result = { 219: "[", 221: "]", 8: "backspace", 32: "space", 37: "left", 38: "up", 39: "right", 40: "down" }[kc];
					if(result !== undefined){
						console.log(result);
						pl.inputKey(result);
						e.preventDefault();
					}
				};

				document.addEventListener("keydown", listener, true);
			
				elem.insertBefore(document.createElement("br"), canvase);

				console.log(window.requestAnimationFrame);

				var loop = typeof requestAnimationFrame != "undefined"? function(fn){
					void function go(){
						fn();
						requestAnimationFrame(go);
					}();
				} : function(fn){
					var fps = 30;
					setInterval(fn, 1000/fps);
				};

				function draw(){
					pl.draw(canvas, 0, 0, canvase.width, canvase.height, true);
				}

				var frame = 0, frameType = 0;
				function drawFrame(){
					console.log(frame);
					if(frameType%2 == 0){
						pl.drawFrame(canvas, 0, 0, canvase.width, canvase.height, frame);
					}
					if(frameType == 0)
						return;
					var img = new Image();
					var n = String(Math.round(frame));
					while(n.length < 5)
						n = "0" + n;
					img.src = "cmptest/snp" + n + ".png";
					img.onload = function(){
						if(frameType == 3) // doesn't work
							canvas.globalAlpha = 0.5;
						canvas.drawImage(img, 0, 0);
						canvas.globalAlpha = 1;
						//pl.drawFrame(canvas, 0, 0, canvase.width, canvase.height, frame);
					};
				}

				loop(draw);

				canvase.onclick = function(e){
					pl.inputClick(e.clientX, e.clientY, canvase.width, canvase.height); // TODO
					e.preventDefault();
				};

				canvase.onmousedown = function(e){
					var cont = pl.inputDrag(e.clientX, e.clientY, canvase.width, canvase.height); // TODO

					canvase.onmousemove = function(e){
						cont(e.clientX, e.clientY); // TODO
					};

					canvase.onmouseup = function(){
						canvase.onmousemove = undefined;
						canvase.onmouseup = undefined;
					};
				};

				cont({
					loadReplay: function(recName){
						get(recName, function(rec){
							pl.addReplay(recReader(rec));
						});
					},

					loadLevel: function(levName, cont){
						get(levName, function(lev){
							pl.changeLevel(levReader(lev));
							if(cont)
								cont();
						});
					}
				});
			});
		};
	};
});
