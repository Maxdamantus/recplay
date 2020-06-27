// crude way to get files as binary strings
export function get(url: string, fn: (c: string) => void): void {
	const xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function(){
		if(xhr.readyState == 4)
			fn(xhr.responseText.split("").map(function(c){ return String.fromCharCode(c.charCodeAt(0) & 0xff); }).join(""));
	};
	xhr.open("GET", url);
	xhr.overrideMimeType("text/plain; charset=x-user-defined");
	xhr.send(null);
}
