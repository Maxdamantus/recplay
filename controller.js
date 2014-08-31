define(["./levReader", "./recReader", "./get", "./lgr", "./player"], function(levReader, recReader, get, lgr, player){
	return function(levName, imagesPath, elem, document){
		return function(cont){
			var canvase = elem.appendChild(document.createElement("canvas"));
			canvase.width = "1280";
			canvase.height = "600";
			var canvas = canvase.getContext("2d");
			get(levName, function(lev){
				function mkCanv(w, h){
					var o = document.createElement("canvas");
					o.width = w;
					o.height = h;
					return o;
				}

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

				document.addEventListener("keydown", listener);
			
				elem.insertBefore(document.createElement("br"), canvase);

				function anim(){
					pl.draw(canvas, 0, 0, canvase.width, canvase.height, true);
					// note: this actually uses 4/3 times the CPU on Chromium as setInterval
					requestAnimationFrame(anim);
					//setTimeout(anim, 1000/30);
				}
				anim();
	//			setInterval(anim, 1000/60);

	/*			setInterval(function(){
					//pl.draw(canvas, canvase.width*0.25, canvase.height*0.25, canvase.width/2, canvase.height/2);
					if(raf === null)
						raf = requestAnimationFrame(anim);
				}, 30);*/

				canvase.onclick = function(e){
					pl.inputClick(); // TODO
					e.preventDefault();
				};

				cont({
					loadReplay: function(recName){
						get(recName, function(rec){
							pl.addReplay(recReader(rec));
						});
					}
				});
			});
		};
	};
});
