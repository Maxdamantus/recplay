window.onload = function(){
	var canv = document.getElementById("golf");
	canv.width = 800;
	canv.height = 600;
	golf(canv.getContext("2d"), canv, 800, 600);
};

function golf(canv, canve, width, height){
	var bx = 400, by = 300, bdx = 0, bdy = 0;

	requestAnimationFrame(dostuff);

	function dostuff(){
		requestAnimationFrame(dostuff);

		bx += bdx *= 0.99;
		by += bdy *= 0.99;
		if(bx > width && bdx > 0 || bx < 0 && bdx < 0)
			bdx *= -1;
		if(by > height && bdy > 0 || by < 0 && bdy < 0)
			bdy *= -1;
		if(Math.abs(bdx) < 1e-2 || Math.abs(bdy) < 1e-2)
			bdx = bdy = 0;

		canv.clearRect(0, 0, width, height);
		canv.beginPath();
		canv.arc(bx, by, 3, 0, 2*Math.PI);
		canv.fill();
	}

	function rect(){
		return canve.getBoundingClientRect();
	}

	canve.onclick = function(e){
		if(bdx != 0 || bdy != 0)
			return;
		var r = rect();
		bdx = (e.clientX - r.left - bx)/30;
		bdy = (e.clientY - r.top - by)/30;
	};
}
