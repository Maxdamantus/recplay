define([], function(){
	var imgs = ["bike", "ground", "head", "sky", "susp1", "susp2", "wheel", "qfood1", "qkiller", "qexit", "q1body", "q1forarm", "q1leg", "q1thigh", "q1up_arm", "myshirt"];
	var picts = "qgrass qdown_1 qdown_14 qdown_5 qdown_9 qup_0 qup_1 qup_14 qup_5 qup_9 qup_18 qdown_18 cliff stone1 stone2 stone3 st3top brick qfood1 qfood2 bridge sky tree2 bush3 tree4 tree5 log2 sedge tree3 plantain bush1 bush2 ground flag secret hang edge mushroom log1 tree1 maskbig maskhor masklitt barrel supphred suppvred support2 support3 support1 suspdown suspup".split(" ");

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

		picts.forEach(function(i){
			var add;
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
			r.picts[i] = lazy(path + "/picts/" + i + ".png", i, add);
		});

		r.grassUp = function(){
			if(grassUp.length < grassUpCount)
				picts.forEach(function(i){
					if(i.indexOf("qup_") == 0)
						r.picts[i].touch();
				});
			return grassUp;
		};

		r.grassDown = function(){
			if(grassDown.length < grassDownCount)
				picts.forEach(function(i){
					if(i.indexOf("qdown_") == 0)
						r.picts[i].touch();
				});
			return grassDown;
		};

		return r;
	};
});
