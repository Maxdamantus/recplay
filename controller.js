define(["./levReader", "./recReader", "./get", "./lgr", "./player"], function(levReader, recReader, get, lgr, player){
	"use strict";

	return function(levName, imagesPath, elem, document){
		var createElement = "createElementNS" in document?
			function(tag){
				return document.createElementNS("http://www.w3.org/1999/xhtml", tag);
			} : function(tag){
				return document.createElement(tag);
			};

		function mkCanv(w, h){
			var o = createElement("canvas");
			o.width = w;
			o.height = h;
			return o;
		}

		return function(cont){
			var canvase = mkCanv(600, 480);
			var canvas = canvase.getContext("2d");
			elem.appendChild(canvase);
			get(levName, function(lev){
				var pllgr = lgr(imagesPath, function(){
					return createElement("img");
				}, mkCanv);
				var pl = player(levReader(lev), pllgr, mkCanv);
				window.pl = pl; // just so it's accessible in the console

				function listener(e){
					var kc = e.keyCode, result;
					if(!e.ctrlKey && !e.metaKey && !e.altKey && kc >= "A".charCodeAt(0) && kc <= "Z".charCodeAt(0))
						result = String.fromCharCode(kc + (!e.shiftKey)*32);
					else
						result = { 219: "[", 221: "]", 8: "backspace", 32: "space", 37: "left", 38: "up", 39: "right", 40: "down" }[kc];
					if(result !== undefined){
						console.log(result);
						if(pl.inputKey(result))
							e.preventDefault();
					}
				};

				canvase.setAttribute("tabindex", "0");
				canvase.addEventListener("keydown", listener, true);
			
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

				loop(draw);

				function rect(){
					return canvase.getBoundingClientRect();
				}

				canvase.addEventListener("click", function(e){
					var r = rect();
					pl.inputClick(e.clientX - r.left, e.clientY - r.top, canvase.width, canvase.height);
					e.preventDefault();
				});

				canvase.addEventListener("mousedown", function(e){
					var r = rect();
					var cont = pl.inputDrag(e.clientX - r.left, e.clientY - r.top, canvase.width, canvase.height);

					function onmousemove(e){
						cont.update(e.clientX - r.left, e.clientY - r.top);
						e.preventDefault();
					}

					function onmouseup(){
						cont.end();
						// /me dislikes function identity
						document.removeEventListener("mousemove", onmousemove);
						document.removeEventListener("mouseup", onmouseup);
						e.preventDefault();
					}

					document.addEventListener("mousemove", onmousemove);
					document.addEventListener("mouseup", onmouseup);
				});

				canvase.addEventListener("touchstart", function ontouchstart(e){
					var ts = e.changedTouches;
					var r = rect();

					if(ts.length < 1)
						return;
					e.preventDefault();

					var cont = pl.inputDrag(ts[0].clientX - r.left, ts[0].clientY - r.top, canvase.width, canvase.height);

					var isClick = true;

					function ontouchmove(e){
						var ts = e.changedTouches;
						if(ts.length < 1)
							return;
						isClick = false;
						cont.update(ts[0].clientX - r.left, ts[0].clientY - r.top);
						e.preventDefault();
					}

					function ontouchend(){
						cont.end();
						if(isClick)
							pl.inputClick(ts[0].clientX - r.left, ts[0].clientY - r.top, canvase.width, canvase.height);
						// ..
						document.removeEventListener("touchmove", ontouchmove);
						document.removeEventListener("touchend", ontouchend);
						document.removeEventListener("touchcancel", ontouchend);

						canvase.addEventListener("touchstart", ontouchstart);
					}

					document.addEventListener("touchmove", ontouchmove);
					document.addEventListener("touchend", ontouchend);
					document.addEventListener("touchcancel", ontouchend);

					canvase.removeEventListener("touchstart", ontouchstart);
				});

				cont({
					loadReplay: function(recName, shirts){
						get(recName, function(rec){
							pl.addReplay(recReader(rec), !shirts? [] : shirts.map(function(s){
								return s == null? null : pllgr.lazy(s);
							}));
						});
					},

					loadLevel: function(levName, cont){
						get(levName, function(lev){
							pl.changeLevel(levReader(lev));
							if(cont)
								cont();
						});
					},

					resize: function(wd, ht){
						canvase.width = wd;
						canvase.height = ht;
						pl.invalidate();
					},

					player: function(){
						return pl;
					}
				});
			});
		};
	};
});
