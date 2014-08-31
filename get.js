// crude way to get files as binary strings
define([], function(){
	return function(url, fn){
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function(){
			if(xhr.readyState == 4)
				fn(Array.prototype.map.call(new Uint8Array(xhr.response), function(b){ return String.fromCharCode(b); }).join(""));
		};
		xhr.open("GET", url);
		xhr.responseType = "arraybuffer";
		xhr.send(null);
	};
});
