define([], function(){
	var imgs = ["bike", "ground", "head", "sky", "susp1", "susp2", "wheel", "qfood1", "qexit", "q1body", "q1forarm", "q1leg", "q1thigh", "q1up_arm", "myshirt"];

	function loading(canv){
		canv.save();
		canv.lineWidth = 1/20;
		canv.strokeStyle = "#00ff00";
		canv.strokeRect(0, 0, 1, 1);
		canv.restore();
	}

	return function(path){
		var r = { _ident: {} };
		imgs.forEach(function(i){
			var img = new Image();
			img.src = path + "/" + i + ".png";
			img.onload = function(){
				r[i].draw = function(canv){
					canv.drawImage(img, 0, 0, 1, 1);
				};
				r[i].repeat = function(canv, w, h){
					canv.fillStyle = canv.createPattern(img, "repeat");
					canv.fillRect(0, 0, w, h);
				};
				r[i].frame = function(canv, num, of){
					canv.save();
					canv.beginPath();
					canv.moveTo(0, 0);
					canv.lineTo(1, 0);
					canv.lineTo(1, 1);
					canv.lineTo(0, 1);
					canv.clip();
					canv.drawImage(img, -num, 0, of, 1);
					canv.restore();
				};

				r._ident = {};
			};
			r[i] = {
				draw: loading,
				repeat: loading,
				frame: loading
			};
		});
		return r;
	};
});
