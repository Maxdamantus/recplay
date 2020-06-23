import * as controller from "./controller";

(window as any).require = function(names: string[], fn: (...modules: any[]) => void){
	var args = names.map(function(n){
		switch(n.split("/").pop()){
			case "controller": return controller.make;
			default: throw new Error("Unknown module: " + n);
		}
	});
	fn.apply(undefined, args);
};
