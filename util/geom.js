exports.rectsOverlap = rectsOverlap;
function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2){
	return ( // parentheses required! ASI!
		x1 + w1 >= x2 &&
		y1 + h1 >= y2 &&
		x2 + w2 >= x1 &&
		y2 + h2 >= y1);
}
