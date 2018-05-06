window.require = function(names, fn){
	var args = names.map(function(n){
		switch(n.split("/").pop()){
			case "controller": return require("./controller").make;
			default: throw new Error("Unknown module: " + n);
		}
	});
	fn.apply(undefined, args);
};
