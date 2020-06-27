export function rectsOverlap(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number){
	return ( // parentheses required! ASI!
		x1 + w1 >= x2 &&
		y1 + h1 >= y2 &&
		x2 + w2 >= x1 &&
		y2 + h2 >= y1);
}
