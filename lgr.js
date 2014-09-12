define([], function(){
	var imgs = ["bike", "ground", "head", "sky", "susp1", "susp2", "wheel", "qfood1", "qfood2", "qkiller", "qexit", "q1body", "q1forarm", "q1leg", "q1thigh", "q1up_arm", "myshirt"];
	var picts = [
		["qgrass","text",400,"s"],
		["qdown_1","pict",400,"s"],
		["qdown_14","pict",400,"s"],
		["qdown_5","pict",400,"s"],
		["qdown_9","pict",400,"s"],
		["qup_0","pict",400,"s"],
		["qup_1","pict",400,"s"],
		["qup_14","pict",400,"s"],
		["qup_5","pict",400,"s"],
		["qup_9","pict",400,"s"],
		["qup_18","pict",400,"s"],
		["qdown_18","pict",400,"s"],
		["cliff","pict",400,"s"],
		["stone1","text",750,"g"],
		["stone2","text",750,"g"],
		["stone3","text",750,"s"],
		["st3top","pict",740,"s"],
		["brick","text",750,"g"],
		["qfood1","pict",400,"u"],
		["qfood2","pict",400,"u"],
		["bridge","pict",400,"u"],
		["sky","text",800,"s"],
		["tree2","pict",540,"s"],
		["bush3","pict",440,"s"],
		["tree4","pict",600,"s"],
		["tree5","pict",600,"s"],
		["log2","pict",420,"s"],
		["sedge","pict",430,"s"],
		["tree3","pict",560,"s"],
		["plantain","pict",450,"u"],
		["bush1","pict",550,"s"],
		["bush2","pict",550,"s"],
		["ground","text",800,"g"],
		["flag","pict",450,"s"],
		["secret","pict",550,"s"],
		["hang","pict",434,"s"],
		["edge","pict",440,"u"],
		["mushroom","pict",430,"s"],
		["log1","pict",420,"s"],
		["tree1","pict",550,"s"],
		["maskbig","mask",,""],
		["maskhor","mask",,""],
		["masklitt","mask",,""],
		["barrel","pict",380,"s"],
		["supphred","pict",380,"s"],
		["suppvred","pict",380,"s"],
		["support2","pict",380,"u"],
		["support3","pict",380,"u"],
		["support1","pict",380,"u"],
		["suspdown","pict",380,"u"],
		["suspup","pict",380,"u"],
		["susp","pict",380,"u"]];

	function loading(canv){
		canv.save();
		canv.lineWidth = 1/20;
		canv.strokeStyle = "red";
		canv.beginPath();
		canv.moveTo(0.5, 0);
		canv.lineTo(0.5, 1);
		canv.moveTo(0, 0.5);
		canv.lineTo(1, 0.5);
		canv.arc(0.5, 0.5, 0.5, 0, Math.PI*2);
		canv.stroke();
		canv.restore();
	}

	function borders(mkCanv, img){
		var canve = mkCanv(img.width, img.height);
		var canv = canve.getContext("2d");
		img.drawAt(canv);
		var data = canv.getImageData(0, 0, img.width, img.height).data;
		var o = [];
		for(var x = 0; x < img.width; x++){
			for(var y = 0; y < img.height && data[4*(y*img.width + x) + 3] == 0; y++);
			o.push(y);
		}
		return o;
	}

	return function(path, mkImage, mkCanv){
		var r = { _ident: {}, picts: {} };

		function lazy(path, name, cont){
			var loaded = false, img, pict;

			function requested(){
				if(!img){
					img = mkImage();
					img.src = path;
					img.onload = function(){
						pict.width = img.width;
						pict.height = img.height;
						r._ident = {};
						loaded = true;
						if(cont)
							cont(pict);
					};
					return false;
				}
				return loaded;
			}

			return pict = {
				name: name,

				touch: requested,

				width: 48, height: 48,

				draw: function(canv){
					if(requested())
						canv.drawImage(img, 0, 0, 1, 1);
					else
						loading(canv);
				},

				drawAt: function(canv){
					if(requested())
						canv.drawImage(img, 0, 0);
					else{
						canv.save();
						canv.scale(48, 48);
						loading(canv);
						canv.restore();
					}
				},

				repeat: function(canv, w, h){
					if(requested()){
						canv.fillStyle = canv.createPattern(img, "repeat");
						canv.fillRect(0, 0, w, h);
					}else{
						canv.save();
						canv.fillStyle = "blue";
						canv.fillRect(0, 0, w, h);
						canv.beginPath();
						canv.strokeStyle = "white";
						for(var x = 0; x <= w; x += 20){
							canv.moveTo(x, 0);
							canv.lineTo(x, h);
						}
						for(var y = 0; y <= h; y += 20){
							canv.moveTo(0, y);
							canv.lineTo(w, y);
						}
						canv.stroke();
						canv.restore();
					}
				},

				frame: function(canv, num, of){
					if(requested()){
						num = Math.floor(num);
						canv.save();
						canv.beginPath();
						canv.moveTo(0, 0);
						canv.lineTo(1, 0);
						canv.lineTo(1, 1);
						canv.lineTo(0, 1);
						canv.clip();
						canv.drawImage(img, -num, 0, of, 1);
						canv.restore();
					}else{
						canv.save();
						canv.translate(0.5, 0.5);
						canv.rotate(Math.PI*2*num/of);
						canv.translate(-0.5, -0.5);
						loading(canv);
						canv.restore();
					}
				}
			};
		}

		imgs.forEach(function(i){
			r[i] = lazy(path + "/" + i + ".png", i);
		});

		var grassUp = [], grassDown = [], grassUpCount = 0, grassDownCount = 0;

		picts.forEach(function(info){
			var add;
			var i = info[0];
			if(i.indexOf("qup_") == 0){
				grassUpCount++;
				add = function(g){
					g.borders = borders(mkCanv, g);
					grassUp.push(g);
					grassUp.sort(function(a, b){
						return (a.name > b.name) - (a.name < b.name);
					});
				};
			}
			if(i.indexOf("qdown_") == 0){
				grassDownCount++;
				add = function(g){
					g.borders = borders(mkCanv, g);
					grassDown.push(g);
					grassDown.sort(function(a, b){
						return (a.name > b.name) - (a.name < b.name);
					});
				};
			}

			var img = r.picts[i] = lazy(path + "/picts/" + i + ".png", i, add);
			img.type = info[1];
			img.dist = info[2];
			img.clipping = info[3];
		});

		r.grassUp = function(){
			if(grassUp.length < grassUpCount)
				picts.forEach(function(i){
					if(i[0].indexOf("qup_") == 0)
						r.picts[i[0]].touch();
				});
			return grassUp;
		};

		r.grassDown = function(){
			if(grassDown.length < grassDownCount)
				picts.forEach(function(i){
					if(i[0].indexOf("qdown_") == 0)
						r.picts[i[0]].touch();
				});
			return grassDown;
		};

		return r;
	};
});
