define([], function(){
	var imgs = ["bike", "ground", "head", "sky", "susp1", "susp2", "wheel"];

	function loading(canv){
		canv.fillStyle = "#00ff00";
		canv.fillRect(0, 0, 1, 1);
	}

	return function(path){
		var r = {};
		imgs.forEach(function(i){
			var img = new Image();
			img.src = path + "/" + i + ".png";
			img.onload = function(){
				r[i] = function(canv){
					canv.drawImage(img, 0, 0, 1, 1);
				};
			};
			r[i] = loading;
		});
		return r;
	};
});
