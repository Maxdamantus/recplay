var require = function(document, global){
	var cache = {};

	function normPath(p){
		var prefix;
		// yuck, meh
		if(prefix = /^[a-zA-Z]+:\/\//.exec(p)){
			p = p.substr(prefix[0].length);
			prefix = prefix[0].toLowerCase();
		}else{
			prefix = "";
		}
		var parts = p.split("/").filter(function(n, i){
			return n.length > 0 && (i == 0 || n != ".");
		});
		for(var x = 0; x < parts.length; x++)
			if(parts[x] == ".." && x > 0 && parts[x - 1] != ".."){
				parts.splice(x - 1, 2);
				x -= 2;
			}
		return prefix + parts.join("/");
	}

	function makeDefine(file, cont){
		var path = file == null? "." : normPath(file.substr(0, file.lastIndexOf("/")));
		return function define(deps, fn){
			delete global.define;
			deps = deps.map(function(d){
				return normPath(/^[a-zA-Z]+:\/\//.test(d)? d : path + "/" + d);
			});
			var args = [];
			deps.reduceRight(function(rest, dep){
				return function(icont){
					if(!(dep in cache)){
						cache[dep] = undefined;
						global.define = makeDefine(dep, function(){
							args.push(cache[dep]);
							rest(icont);
						});
						document.body.appendChild(document.createElement("script")).src = dep + ".js";
					}else{
						// cycle check? dunno
						args.push(cache[dep]);
						rest(icont);
					}
				};
			}, function(icont){
				icont();
			})(function(){
				var res = fn.apply(null, args);
				if(file != null)
					cache[file] = res;
				cont();
			});
		};
	}

	return function(deps, fn){
		makeDefine(null, function(){})(deps, fn);
	};
}(document, this);
