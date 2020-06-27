(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var controller = require("./controller");
window.require = function (names, fn) {
    var args = names.map(function (n) {
        switch (n.split("/").pop()) {
            case "controller": return controller.make;
            default: throw new Error("Unknown module: " + n);
        }
    });
    fn.apply(undefined, args);
};

},{"./controller":3}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reader = void 0;
function reader(data) {
    var pos = 0;
    function end() {
        return pos >= data.length;
    }
    function seek(p) {
        if (p > data.length)
            throw new Error("out of range: " + p);
        pos = p;
    }
    function byte() {
        if (pos >= data.length)
            throw new Error("out of range");
        return data.charCodeAt(pos++);
    }
    function unbyte() {
        if (pos < 0)
            throw new Error("out of range");
        return data.charCodeAt(pos--);
    }
    function seq(n) {
        if (pos + n > data.length)
            throw new Error("out of range");
        pos += n;
        return data.substr(pos - n, n);
    }
    function skip(n) {
        pos += n;
    }
    function binFloat64le() {
        skip(7);
        var b = unbyte();
        var sign = b >> 7;
        var exp = b & 127;
        b = unbyte();
        exp <<= 4;
        exp |= b >> 4;
        var mant = b & 15;
        for (b = 0; b < 6; b++) {
            mant *= 1 << 8;
            mant += unbyte();
        }
        skip(9);
        return (sign ? -1 : 1) * Math.pow(2, exp - 1023) * (1 + mant * Math.pow(2, -52));
    }
    function binFloat32le() {
        skip(3);
        var b = unbyte();
        var sign = b >> 7;
        var exp = b & 127;
        b = unbyte();
        exp <<= 1;
        exp |= b >> 7;
        var mant = b & 127;
        for (b = 0; b < 2; b++) {
            mant *= 1 << 8;
            mant += unbyte();
        }
        skip(5);
        return (sign ? -1 : 1) * Math.pow(2, exp - 127) * (1 + mant * Math.pow(2, -23));
    }
    function word32le() {
        return word16le() | word16le() << 16;
    }
    function word16le() {
        return byte() | byte() << 8;
    }
    function int32le() {
        var r = word32le();
        return r > 1 << 31 ? r - (1 << 32) : r;
    }
    function int16le() {
        var r = word16le();
        return r > 1 << 15 ? r - (1 << 16) : r;
    }
    function int8() {
        var r = byte();
        return r > 1 << 7 ? r - (1 << 8) : r;
    }
    function string(max) {
        if (max === undefined)
            max = Infinity;
        var n;
        for (n = 0; n < max && pos + n < data.length && data[pos + n] != "\u0000"; n++)
            ;
        return seq(n);
    }
    function pstring(n) {
        var s = seq(n);
        return (n = s.indexOf("\u0000")) >= 0 ? s.substr(0, n) : s;
    }
    return {
        end: end,
        seek: seek,
        byte: byte,
        seq: seq,
        skip: skip,
        binFloat64le: binFloat64le,
        binFloat32le: binFloat32le,
        word32le: word32le,
        word16le: word16le,
        int32le: int32le,
        int16le: int16le,
        int8: int8,
        string: string,
        pstring: pstring,
        pos: function () {
            return pos;
        }
    };
}
exports.reader = reader;

},{}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.make = void 0;
var levRn = require("./levReader");
var recRn = require("./recReader");
var get = require("./get");
var lgr = require("./lgr");
var player = require("./player");
function make(levName, imagesPath, elem, document) {
    var createElement = document.createElementNS ?
        (function (tag) { return document.createElementNS("http://www.w3.org/1999/xhtml", tag); }) :
        (function (tag) { return document.createElement(tag); });
    var mkCanv = function (w, h) {
        var o = createElement("canvas");
        o.width = w;
        o.height = h;
        return o;
    };
    return function (cont) {
        var canvase = mkCanv(600, 480);
        var canvas = canvase.getContext("2d");
        var stopDraw = false;
        elem.appendChild(canvase);
        get.get(levName, function (lev) {
            var pllgr = lgr.make(imagesPath, function () { return createElement("img"); }, mkCanv);
            var pl = player.make(levRn.reader(lev), pllgr, mkCanv);
            window["pl"] = pl; // just so it's accessible in the console
            function listener(e) {
                var kc = e.keyCode;
                var result;
                if (!e.ctrlKey && !e.metaKey && !e.altKey && kc >= "A".charCodeAt(0) && kc <= "Z".charCodeAt(0))
                    result = String.fromCharCode(kc + (e.shiftKey ? 0 : 32));
                else {
                    var fromCode = { "219": "[", "221": "]", "8": "backspace", "32": "space", "37": "left", "38": "up", "39": "right", "40": "down" };
                    result = fromCode[String(kc)];
                }
                if (result !== undefined) {
                    if (pl.inputKey(result))
                        e.preventDefault();
                }
            }
            ;
            canvase.setAttribute("tabindex", "0");
            canvase.addEventListener("keydown", listener, true);
            var loop = typeof requestAnimationFrame != "undefined" ? function (fn) {
                void function go() {
                    requestAnimationFrame(go);
                    fn();
                }();
            } : function (fn) {
                var fps = 30;
                setInterval(fn, 1000 / fps);
            };
            function draw() {
                pl.draw(canvas, 0, 0, canvase.width, canvase.height, true);
            }
            setTimeout(function () {
                if (!stopDraw)
                    loop(draw);
                stopDraw = true;
            }, 0);
            function rect() {
                return canvase.getBoundingClientRect();
            }
            canvase.addEventListener("click", function (e) {
                var r = rect();
                pl.inputClick(e.clientX - r.left, e.clientY - r.top, canvase.width, canvase.height);
                e.preventDefault();
            });
            canvase.addEventListener("mousedown", function (e) {
                var r = rect();
                var cont = pl.inputDrag(e.clientX - r.left, e.clientY - r.top, canvase.width, canvase.height);
                function onmousemove(e) {
                    cont.update(e.clientX - r.left, e.clientY - r.top);
                    e.preventDefault();
                }
                function onmouseup() {
                    cont.end();
                    // /me dislikes function identity
                    document.removeEventListener("mousemove", onmousemove);
                    document.removeEventListener("mouseup", onmouseup);
                    e.preventDefault();
                }
                document.addEventListener("mousemove", onmousemove);
                document.addEventListener("mouseup", onmouseup);
            });
            canvase.addEventListener("touchstart", function ontouchstart(e) {
                var ts = e.changedTouches;
                var r = rect();
                if (ts.length < 1)
                    return;
                e.preventDefault();
                var cont = pl.inputDrag(ts[0].clientX - r.left, ts[0].clientY - r.top, canvase.width, canvase.height);
                var isClick = true;
                function ontouchmove(e) {
                    var ts = e.changedTouches;
                    if (ts.length < 1)
                        return;
                    isClick = false;
                    cont.update(ts[0].clientX - r.left, ts[0].clientY - r.top);
                    e.preventDefault();
                }
                function ontouchend() {
                    cont.end();
                    if (isClick)
                        pl.inputClick(ts[0].clientX - r.left, ts[0].clientY - r.top, canvase.width, canvase.height);
                    // ..
                    document.removeEventListener("touchmove", ontouchmove);
                    document.removeEventListener("touchend", ontouchend);
                    document.removeEventListener("touchcancel", ontouchend);
                    canvase.addEventListener("touchstart", ontouchstart);
                }
                document.addEventListener("touchmove", ontouchmove);
                document.addEventListener("touchend", ontouchend);
                document.addEventListener("touchcancel", ontouchend);
                canvase.removeEventListener("touchstart", ontouchstart);
            });
            canvase.addEventListener("wheel", function (e) {
                var r = rect();
                var delta = e.deltaMode == WheelEvent.DOM_DELTA_LINE ? 53 / 3 * e.deltaY : e.deltaY;
                pl.inputWheel(e.clientX - r.left, e.clientY - r.top, canvase.width, canvase.height, delta);
                e.preventDefault();
            });
            cont({
                loadReplay: function (recName, shirts) {
                    get.get(recName, function (rec) {
                        pl.addReplay(recRn.reader(rec), !shirts ? [] : shirts.map(function (s) {
                            return s == null ? null : pllgr.lazy(s);
                        }));
                    });
                },
                loadLevel: function (levName, cont) {
                    get.get(levName, function (lev) {
                        pl.changeLevel(levRn.reader(lev));
                        if (cont)
                            cont();
                    });
                },
                resize: function (wd, ht) {
                    canvase.width = wd;
                    canvase.height = ht;
                    pl.invalidate();
                },
                player: function () {
                    return pl;
                },
                // NOTE: this function needs to be called
                // immediately in `cont`
                stopDraw: function () {
                    if (stopDraw)
                        throw new Error("Must be called immediately");
                    stopDraw = true;
                },
                draw: draw
            });
        });
    };
}
exports.make = make;
;

},{"./get":4,"./levReader":5,"./lgr":7,"./player":9,"./recReader":10}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = void 0;
// crude way to get files as binary strings
function get(url, fn) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4)
            fn(xhr.responseText.split("").map(function (c) { return String.fromCharCode(c.charCodeAt(0) & 0xff); }).join(""));
    };
    xhr.open("GET", url);
    xhr.overrideMimeType("text/plain; charset=x-user-defined");
    xhr.send(null);
}
exports.get = get;

},{}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reader = void 0;
var bin = require("./binReader");
var ticker = function () {
    var n = 0;
    return function (m) {
        n += m;
        return n - m;
    };
}();
var offsType = ticker(5);
ticker(2);
var offsIdent = ticker(4);
var offsIntegrities = ticker(4 * 8);
var offsDesc = ticker(51);
var offsLgr = ticker(16);
var offsGround = ticker(10);
var offsSky = ticker(10);
var offsPolyCount = ticker(8);
var offsPolys = ticker(0);
function reader(data) {
    var br = bin.reader(data);
    function polyCount() {
        br.seek(offsPolyCount);
        return Math.floor(br.binFloat64le());
    }
    function objCount() {
        br.seek(offsObjCount);
        return Math.floor(br.binFloat64le());
    }
    function picCount() {
        br.seek(offsPicCount);
        return Math.floor(br.binFloat64le());
    }
    var offsObjCount = function () {
        var pc = polyCount();
        br.seek(offsPolys);
        for (var x = 0; x < pc; x++) {
            br.skip(4); // grass
            br.skip(br.word32le() * (8 + 8));
        }
        return br.pos();
    }();
    var offsObjs = offsObjCount + 8;
    var offsPicCount = function () {
        br.seek(offsObjCount);
        return offsObjs + Math.floor(br.binFloat64le()) * ((8 + 8) + (4 + 4 + 4));
    }();
    var offsPics = offsPicCount + 8;
    function obj(n, onFlower, onApple, onKiller, onStart) {
        br.seek(offsObjs + n * ((8 + 8) + (4 + 4 + 4)));
        var vx = br.binFloat64le(), vy = br.binFloat64le();
        var obj = br.word32le(), grav = br.word32le(), anim = br.word32le();
        switch (obj) {
            case 1: return onFlower(vx, vy);
            case 2: return onApple(vx, vy, grav, anim);
            case 3: return onKiller(vx, vy);
            case 4: return onStart(vx, vy);
            default: throw new Error("hmm: " + obj + ", x = " + vx + ", y = " + vy);
        }
    }
    function pic(n, onPic) {
        br.seek(offsPics + n * (10 + 10 + 10 + 8 + 8 + 4 + 4));
        var picture = br.pstring(10), texture = br.pstring(10), mask = br.pstring(10);
        var vx = br.binFloat64le(), vy = br.binFloat64le();
        var dist = br.word32le(), clipping_ = br.word32le();
        var clipping = ["u" /* Unclipped */, "g" /* Ground */, "s" /* Sky */][clipping_];
        return onPic(picture, texture, mask, vx, vy, dist, clipping);
    }
    return {
        rightType: function () {
            br.seek(offsType);
            return br.seq(5) == "POT14";
        },
        ident: function () {
            br.seek(offsIdent);
            return br.seq(4);
        },
        integrities: function () {
            br.seek(offsIntegrities);
            var o = [];
            for (var x = 0; x < 4; x++)
                o.push(br.binFloat64le());
            return o;
        },
        desc: function () {
            br.seek(offsDesc);
            return br.string(51);
        },
        lgr: function () {
            br.seek(offsLgr);
            return br.string(16);
        },
        ground: function () {
            br.seek(offsGround);
            return br.string(10);
        },
        sky: function () {
            br.seek(offsSky);
            return br.string(10);
        },
        polyCount: polyCount,
        objCount: objCount,
        picCount: picCount,
        polyReader: function (forEachPoly) {
            /* lr.polyReader(function(grass, vcount, vertices){
             *   // for each polygon
             *   vertices(function(x, y){
             *     // for each vertex in it
             *   });
             * });
             */
            var count = polyCount();
            br.seek(offsPolys);
            var _loop_1 = function (x) {
                var grass = br.word32le(), vcount = br.word32le(), pos = br.pos();
                br.seek(pos);
                forEachPoly(grass != 0, vcount, function (forEachVertex) {
                    for (var y = 0; y < vcount; y++) {
                        br.seek(pos + y * (8 + 8));
                        forEachVertex(br.binFloat64le(), br.binFloat64le());
                    }
                });
                br.seek(pos + vcount * (8 + 8));
            };
            for (var x = 0; x < count; x++) {
                _loop_1(x);
            }
        },
        obj: obj,
        obj_: function (n) {
            function h(s) {
                return function (vx, vy, grav, anim) {
                    var o = { type: s, x: vx, y: vy };
                    if (grav !== undefined) {
                        o.grav = grav;
                        o.anim = anim;
                    }
                    return o;
                };
            }
            return obj(n, h("flower"), h("apple"), h("killer"), h("start"));
        },
        pic: pic,
        pic_: function (n) {
            return pic(n, function (picture, texture, mask, vx, vy, dist, clipping) {
                return {
                    picture: picture,
                    texture: texture,
                    mask: mask,
                    x: vx,
                    y: vy,
                    dist: dist,
                    clipping: clipping
                };
            });
        }
    };
}
exports.reader = reader;

},{"./binReader":2}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderer = void 0;
var quadTree = require("./util/quadTree");
var geom = require("./util/geom");
function hypot(a, b) {
    return Math.sqrt(a * a + b * b);
}
function getNum(pic) {
    return pic.num;
}
function setNum(pic, n) {
    pic.num = n;
}
function windowDbg() {
    return window["dbg"];
}
function renderer(reader, lgr) {
    var polyTree = [];
    var grassPolys = [];
    function isSub(v, outer) {
        function hits(a, b) {
            // does the line [x, y]–[x, inf] intersect the line a–b?
            var left = Math.min(a[0], b[0]), right = Math.max(a[0], b[0]);
            if (v[0] < left || v[0] >= right)
                return false;
            var m = (b[1] - a[1]) / (b[0] - a[0]);
            var yint = m * (v[0] - a[0]) + a[1];
            return yint > v[1];
        }
        var n = 0;
        for (var z = 0; z < outer.length; z++)
            if (hits(outer[z], outer[(z + 1) % outer.length]))
                n++;
        return n % 2 != 0;
    }
    function addPoly(vertices, tree) {
        var newTree = [];
        var x;
        for (x = 0; x < tree.length; x++) {
            if (isSub(vertices[0], tree[x].vertices)) {
                // assertion: newTree non-empty or consistency error
                if (false && newTree.length) // actually, game itself doesn't care, only the editor
                    throw new Error("inconsistent!");
                return addPoly(vertices, tree[x].inner);
            }
            if (isSub(tree[x].vertices[0], vertices)) {
                newTree.push(tree[x]);
                if (x + 1 == tree.length)
                    tree.pop();
                else
                    tree[x] = tree.pop();
                x--;
            }
        }
        return tree[x] = { vertices: vertices, inner: newTree };
    }
    function traverse(tree, isSolid, fn) {
        tree.forEach(function (poly) {
            fn(isSolid, poly.vertices);
            traverse(poly.inner, !isSolid, fn);
        });
    }
    var minX = Infinity, minY = Infinity;
    var maxX = -Infinity, maxY = -Infinity;
    reader.polyReader(function (grass, count, vertices) {
        var poly = [];
        vertices(function (x, y) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            poly.push([x, y]);
        });
        if (grass)
            grassPolys.push(poly);
        else
            addPoly(poly, polyTree);
    });
    var pictures = function () {
        var tree = null;
        var maxImgW = 0, maxImgH = 0; // for overbounding in .traverse
        function traverse(x, y, w, h, fn) {
            tree.traverse(x - maxImgW, y - maxImgH, w + maxImgW, h + maxImgH, fn);
        }
        function calc() {
            tree = quadTree.make(1);
            maxImgW = maxImgH = 0;
            var count = reader.picCount();
            for (var x = 0; x < count; x++) {
                var pic = reader.pic_(x);
                setNum(pic, x);
                // TODO: defaults?
                tree.add(pic.x, pic.y, pic);
                [pic.picture, pic.mask, pic.texture].forEach(function (picname) {
                    var img = lgr.picts[picname];
                    if (img && img.width !== undefined && img.height !== undefined) {
                        img.touch();
                        maxImgW = Math.max(maxImgW, img.width / 48);
                        maxImgH = Math.max(maxImgH, img.height / 48);
                    }
                });
            }
        }
        return {
            calc: calc,
            traverse: traverse,
            dbgdraw: function (canv, x, y, w, h) {
                tree.dbgdraw(canv, x, y, w, h);
            }
        };
    }();
    var grass = function () {
        var tree = null;
        var maxImgW = 0, maxImgH = 0; // for overbounding in .traverse
        // assuming w and h are positive
        function traverse(x, y, w, h, fn) {
            tree.traverse(x - maxImgW, y - maxImgH, w + maxImgW, h + maxImgH, fn);
        }
        function calc() {
            tree = quadTree.make(1);
            maxImgW = maxImgH = 0;
            grassPolys.forEach(function (p) {
                calcGrassPoly(48, p);
            });
            function calcGrassPoly(scale, poly) {
                // the path selection is demonstrably wrong, but it probably works in all reasonable cases.
                // it draws along the path from the left-most vertex to the right-most vertex that doesn't
                //   include the widest edge.
                // haven't figured out exactly what Elma itself does.
                var minX = Infinity, maxX = -Infinity, minXi = 0, maxXi = 0;
                for (var z = 0; z < poly.length; z++) {
                    // WARNING: funny code
                    if (minX != (minX = Math.min(minX, poly[z][0])))
                        minXi = z;
                    if (maxX != (maxX = Math.max(maxX, poly[z][0])))
                        maxXi = z;
                }
                var maxW = 0;
                for (var z = minXi; z % poly.length != maxXi; z++)
                    maxW = Math.max(maxW, Math.abs(poly[z % poly.length][0] - poly[(z + 1) % poly.length][0]));
                var dir = -1;
                for (var z = poly.length + minXi; z % poly.length != maxXi; z--)
                    if (maxW != (maxW = Math.max(maxW, Math.abs(poly[z % poly.length][0] - poly[(z - 1) % poly.length][0]))))
                        dir = 1;
                function yAt(x) {
                    for (var z = poly.length + minXi; z % poly.length != maxXi; z += dir) {
                        var from = poly[z % poly.length], to = poly[(z + dir) % poly.length];
                        if (from[0] <= x && x < to[0]) {
                            var m = (to[1] - from[1]) / (to[0] - from[0]);
                            return m * (x - from[0]) + from[1];
                        }
                    }
                    throw new Error();
                }
                var curX = poly[minXi][0] * scale, curY = poly[minXi][1] * scale;
                var gUps = lgr.grassUp(), gDowns = lgr.grassDown();
                while (curX < maxX * scale) {
                    var bestD = Infinity, bestA = null, bestI = -1;
                    for (var a = 0; a < gUps.length; a++) {
                        if (curX + gUps[a].width >= maxX * scale)
                            continue;
                        var dist = Math.abs(yAt((curX + gUps[a].width) / scale) * scale - (curY - (gUps[a].height - 41)));
                        if (dist < bestD) {
                            bestD = dist;
                            bestA = gUps;
                            bestI = a;
                        }
                    }
                    for (var a = 0; a < gDowns.length; a++) {
                        if (curX + gDowns[a].width >= maxX * scale)
                            continue;
                        var dist = Math.abs(yAt((curX + gDowns[a].width) / scale) * scale - (curY + (gDowns[a].height - 41)));
                        if (dist < bestD) {
                            bestD = dist;
                            bestA = gDowns;
                            bestI = a;
                        }
                    }
                    if (!bestA) {
                        curX++;
                        continue;
                    }
                    var pict = bestA[bestI];
                    var fall = (pict.height - 41) * (bestA == gUps ? -1 : 1);
                    var fcx = Math.floor(curX), fcy = Math.floor(curY + fall);
                    var fcyTop = Math.floor(curY) - Math.ceil((pict.height - fall) / 2);
                    maxImgW = Math.max(maxImgW, pict.width / scale);
                    maxImgH = Math.max(maxImgH, pict.height / scale);
                    tree.add(fcx / scale, fcyTop / scale, pict);
                    curX += pict.width;
                    curY += fall;
                }
            }
        }
        return {
            calc: calc,
            traverse: traverse,
            dbgdraw: function (canv, x, y, w, h) {
                tree.dbgdraw(canv, x, y, w, h);
            }
        };
    }();
    function drawPictures(pics, canv, scale, clipping, x, y, w, h) {
        function draw(pic) {
            // TODO: are masks specifically for textures? dunno
            var img = lgr.picts[pic.picture];
            if (pic.clipping != clipping)
                return;
            if (img && img.draw) {
                if (!geom.rectsOverlap(pic.x, pic.y, img.width, img.height, x, y, w, h))
                    return;
                canv.save();
                canv.translate(pic.x * scale, pic.y * scale);
                canv.scale(scale / 48, scale / 48);
                img.drawAt(canv);
                canv.restore();
                return;
            }
            img = lgr.picts[pic.texture];
            var mask = lgr.picts[pic.mask];
            if (img && img.draw && mask && mask.draw) {
                if (!geom.rectsOverlap(pic.x, pic.y, mask.width, mask.height, x, y, w, h))
                    return;
                // TODO: scale textures, fix otherwise
                var px = Math.round(pic.x * scale), py = Math.round(pic.y * scale);
                var offsX = px >= 0 ? px % img.width : img.width - -px % img.width;
                var offsY = py >= 0 ? py % img.height : img.height - -py % img.height;
                mask.touch();
                canv.save();
                canv.translate(pic.x * scale, pic.y * scale);
                canv.beginPath();
                canv.moveTo(0, 0);
                canv.lineTo(mask.width * scale / 48, 0);
                canv.lineTo(mask.width * scale / 48, mask.height * scale / 48);
                canv.lineTo(0, mask.height * scale / 48);
                canv.clip();
                canv.translate(-offsX, -offsY);
                img.repeat(canv, offsX + mask.width * scale / 48, offsY + mask.height * scale / 48);
                canv.restore();
            }
        }
        pics.forEach(draw);
    }
    var lgrIdent = {};
    var optIdent = {};
    var optGrass = true;
    var optPictures = true;
    var optCustomBackgroundSky = true;
    // (x, y)–(x + w, y + h): viewport in Elma dimensions
    function draw(canv, x, y, w, h, scale) {
        if (lgrIdent != lgr._ident) {
            if (optGrass)
                grass.calc();
            if (optPictures)
                pictures.calc();
            lgrIdent = lgr._ident;
        }
        var pics = [];
        pictures.traverse(x, y, w, h, function (x, y, pic) {
            pics.push(pic);
        });
        pics.sort(function (a, b) {
            return (a.dist < b.dist ? 1 : 0) - (a.dist > b.dist ? 1 : 0) || (getNum(a) < getNum(b) ? 1 : 0) - (getNum(a) > getNum(b) ? 1 : 0);
        });
        if (optPictures) {
            canv.save();
            canv.translate(-x * scale, -y * scale);
            drawPictures(pics, canv, scale, "s", x, y, w, h); // sky
            canv.restore();
        }
        canv.save();
        canv.beginPath();
        canv.moveTo(0, 0);
        canv.lineTo(w * scale, 0);
        canv.lineTo(w * scale, h * scale);
        canv.lineTo(0, h * scale);
        canv.translate(-x * scale, -y * scale);
        traverse(polyTree, false, function (isSolid, verts) {
            canv.moveTo(scale * verts[verts.length - 1][0], scale * verts[verts.length - 1][1]);
            for (var z = verts.length - 2; z >= 0; z--)
                canv.lineTo(scale * verts[z][0], scale * verts[z][1]);
        });
        canv.translate(x * scale, y * scale);
        canv.clip(); // clip isn't antialiased in Chromium—different with destination-out
        {
            // TODO: check that it's not accessing something it shouldn't
            var img = optCustomBackgroundSky && lgr.picts[reader.ground()] || lgr.picts["ground"];
            var px = Math.floor(x * scale), py = Math.floor(y * scale);
            var pw = Math.floor(w * scale), ph = Math.floor(h * scale);
            var offsX = x >= 0 ? px % img.width : img.width - -px % img.width;
            var offsY = y >= 0 ? py % img.height : img.height - -py % img.height;
            canv.save();
            canv.translate(-img.width - offsX, -img.height - offsY);
            img.repeat(canv, pw + img.width * 2, ph + img.height * 2);
            canv.restore();
        }
        if (optPictures) {
            canv.save();
            canv.translate(-x * scale, -y * scale);
            drawPictures(pics, canv, scale, "g", x, y, w, h); // ground
            canv.restore();
        }
        canv.translate(-x * scale, -y * scale);
        if (optGrass) {
            canv.save();
            canv.beginPath();
            grass.traverse(x, y, w, h + 24, function (grassX, grassY, pict) {
                canv.save();
                canv.translate(grassX * scale, grassY * scale);
                var b = pict.borders;
                canv.scale(scale / 48, scale / 48);
                canv.moveTo(0, -24);
                for (var z = 0; z < b.length; z++) {
                    canv.lineTo(z, b[z] + 1);
                    canv.lineTo(z + 1, b[z] + 1);
                }
                canv.lineTo(pict.width, -24);
                canv.closePath();
                canv.restore();
            });
            canv.clip();
            canv.translate(x * scale, y * scale);
            {
                var img = lgr.picts["qgrass"];
                var px = Math.floor(x * scale), py = Math.floor(y * scale);
                var pw = Math.floor(w * scale), ph = Math.floor(h * scale);
                var offsX = x >= 0 ? px % img.width : img.width - -px % img.width;
                var offsY = y >= 0 ? py % img.height : img.height - -py % img.height;
                canv.save();
                canv.translate(-img.width - offsX, -img.height - offsY);
                img.repeat(canv, pw + img.width * 2, ph + img.height * 2);
                canv.restore();
            }
            canv.restore();
            grass.traverse(x, y, w, h, function (grassX, grassY, pict) {
                canv.save();
                canv.translate(grassX * scale, grassY * scale);
                canv.scale(scale / 48, scale / 48);
                pict.drawAt(canv);
                canv.restore();
            });
        }
        canv.restore();
        if (optPictures) {
            canv.save();
            canv.translate(-x * scale, -y * scale);
            drawPictures(pics, canv, scale, "u", x, y, w, h); // unclipped
            canv.restore();
        }
        canv.strokeStyle = "#ff0000";
        if (windowDbg()) {
            canv.strokeRect(0, 0, w * scale, h * scale);
            if (windowDbg() > 1) {
                canv.save();
                canv.translate(-x * scale, -y * scale);
                canv.scale(scale, scale);
                canv.lineWidth = 1 / 48;
                canv.strokeStyle = "orange";
                if (windowDbg() & 2)
                    grass.dbgdraw(canv, x, y, w, h);
                canv.strokeStyle = "purple";
                if (windowDbg() & 4)
                    pictures.dbgdraw(canv, x, y, w, h);
                canv.restore();
            }
        }
    }
    ;
    function cached(num, mkCanv) {
        var cscale = 1, xp = 0, yp = 0, wp = 0, hp = 0;
        var canvs = [];
        var cacheLgrIdent = null;
        var cacheOptIdent = null;
        function update(which, canv) {
            var x = which % num, y = Math.floor(which / num);
            x = xp + x * wp;
            y = yp + y * hp;
            var ctx = canv.getContext("2d");
            ctx.clearRect(0, 0, canv.width, canv.height);
            draw(ctx, x / cscale, y / cscale, wp / cscale, hp / cscale, cscale);
        }
        function invalid() {
            return (lgr._ident != lgrIdent ||
                cacheLgrIdent != lgrIdent ||
                cacheOptIdent != optIdent);
        }
        return function cachedDraw(canv, x, y, w, h, scale) {
            w = Math.ceil(w * scale);
            h = Math.ceil(h * scale);
            x = Math.floor(x * scale);
            y = Math.floor(y * scale);
            if (invalid() || scale != cscale || Math.ceil(w / (num - 1)) != wp || Math.ceil(h / (num - 1)) != hp || !geom.rectsOverlap(xp, yp, wp * num, hp * num, x, y, w, h)) {
                cacheLgrIdent = lgrIdent;
                cacheOptIdent = optIdent;
                wp = Math.ceil(w / (num - 1));
                hp = Math.ceil(h / (num - 1));
                xp = x - Math.floor(wp / 2);
                yp = y - Math.floor(hp / 2);
                cscale = scale;
                canvs = [];
                for (var z = 0; z < num * num; z++)
                    update(z, canvs[z] = mkCanv(wp, hp));
            }
            // TODO: will render things unnecessarily if it jumps a whole column/row
            // doesn't matter when num == 2
            // should try to generalise this—whole thing looks unreadable
            // NOTE: using `any` because I can't really understand the code; will be removed soon anyway
            while (yp > y) { // stuff missing from top
                yp -= hp;
                canvs.splice.apply(canvs, [0, 0].concat(canvs.splice(num * (num - 1), num)));
                for (var z = 0; z < num; z++)
                    update(z, canvs[z]);
            }
            while (yp + num * hp < y + h) { // stuff missing from bottom
                yp += hp;
                canvs.splice.apply(canvs, [num * (num - 1), 0].concat(canvs.splice(0, num)));
                for (var z = 0; z < num; z++)
                    update(num * (num - 1) + z, canvs[num * (num - 1) + z]);
            }
            while (xp > x) { // stuff missing from left
                xp -= wp;
                for (var z = 0; z < num; z++) {
                    canvs.splice(z * num, 0, canvs.splice((z + 1) * num - 1, 1)[0]);
                    update(z * num, canvs[z * num]);
                }
            }
            while (xp + num * wp < x + w) { // stuff missing from right
                xp += wp;
                for (var z = 0; z < num; z++) {
                    canvs.splice((z + 1) * num - 1, 0, canvs.splice(z * num, 1)[0]);
                    update((z + 1) * num - 1, canvs[(z + 1) * num - 1]);
                }
            }
            for (var xi = 0; xi < num; xi++)
                for (var yi = 0; yi < num; yi++)
                    canv.drawImage(canvs[yi * num + xi], xp - x + xi * wp, yp - y + yi * hp);
        };
    }
    return {
        draw: draw,
        cached: cached,
        setGrass: function (v) { optGrass = v; optIdent = {}; },
        setPictures: function (v) { optPictures = v; optIdent = {}; },
        setCustomBackgroundSky: function (v) { optCustomBackgroundSky = v; optIdent = {}; },
        drawSky: function (canv, x, y, w, h, scale) {
            // TODO: check that it's not accessing something it shouldn't
            var img = optCustomBackgroundSky && lgr.picts[reader.sky()] || lgr.picts["sky"];
            x = Math.floor(x * scale / 3);
            w *= scale;
            h *= scale;
            if ((x = x % img.width) < 0)
                x = img.width + x;
            canv.save();
            canv.translate(-x, 0);
            img.repeat(canv, w + img.width, h);
            canv.restore();
        }
    };
}
exports.renderer = renderer;

},{"./util/geom":12,"./util/quadTree":13}],7:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.make = void 0;
var imgs = { bike: "bike", ground: "ground", head: "head", sky: "sky", susp1: "susp1", susp2: "susp2", wheel: "wheel", qfood1: "qfood1", qfood2: "qfood2", qkiller: "qkiller", qexit: "qexit", q1body: "q1body", q1forarm: "q1forarm", q1leg: "q1leg", q1thigh: "q1thigh", q1up_arm: "q1up_arm", myshirt: "myshirt" };
var picts = [
    ["qgrass", "text", 400, "s"],
    ["qdown_1", "pict", 400, "s"],
    ["qdown_14", "pict", 400, "s"],
    ["qdown_5", "pict", 400, "s"],
    ["qdown_9", "pict", 400, "s"],
    ["qup_0", "pict", 400, "s"],
    ["qup_1", "pict", 400, "s"],
    ["qup_14", "pict", 400, "s"],
    ["qup_5", "pict", 400, "s"],
    ["qup_9", "pict", 400, "s"],
    ["qup_18", "pict", 400, "s"],
    ["qdown_18", "pict", 400, "s"],
    ["cliff", "pict", 400, "s"],
    ["stone1", "text", 750, "g"],
    ["stone2", "text", 750, "g"],
    ["stone3", "text", 750, "s"],
    ["st3top", "pict", 740, "s"],
    ["brick", "text", 750, "g"],
    ["qfood1", "pict", 400, "u"],
    ["qfood2", "pict", 400, "u"],
    ["bridge", "pict", 400, "u"],
    ["sky", "text", 800, "s"],
    ["tree2", "pict", 540, "s"],
    ["bush3", "pict", 440, "s"],
    ["tree4", "pict", 600, "s"],
    ["tree5", "pict", 600, "s"],
    ["log2", "pict", 420, "s"],
    ["sedge", "pict", 430, "s"],
    ["tree3", "pict", 560, "s"],
    ["plantain", "pict", 450, "u"],
    ["bush1", "pict", 550, "s"],
    ["bush2", "pict", 550, "s"],
    ["ground", "text", 800, "g"],
    ["flag", "pict", 450, "s"],
    ["secret", "pict", 550, "s"],
    ["hang", "pict", 434, "s"],
    ["edge", "pict", 440, "u"],
    ["mushroom", "pict", 430, "s"],
    ["log1", "pict", 420, "s"],
    ["tree1", "pict", 550, "s"],
    ["maskbig", "mask", , ""],
    ["maskhor", "mask", , ""],
    ["masklitt", "mask", , ""],
    ["barrel", "pict", 380, "s"],
    ["supphred", "pict", 380, "s"],
    ["suppvred", "pict", 380, "s"],
    ["support2", "pict", 380, "u"],
    ["support3", "pict", 380, "u"],
    ["support1", "pict", 380, "u"],
    ["suspdown", "pict", 380, "u"],
    ["suspup", "pict", 380, "u"],
    ["susp", "pict", 380, "u"]
];
function loading(canv) {
    canv.save();
    canv.lineWidth = 1 / 20;
    canv.strokeStyle = "red";
    canv.beginPath();
    canv.moveTo(0.5, 0);
    canv.lineTo(0.5, 1);
    canv.moveTo(0, 0.5);
    canv.lineTo(1, 0.5);
    canv.arc(0.5, 0.5, 0.5, 0, Math.PI * 2);
    canv.stroke();
    canv.restore();
}
function borders(mkCanv, img, up) {
    var canve = mkCanv(img.width, img.height);
    var canv = canve.getContext("2d");
    img.drawAt(canv);
    var data = canv.getImageData(0, 0, img.width, img.height).data;
    var o = [];
    if (data)
        for (var x = 0; x < img.width; x++) {
            var y = void 0;
            for (y = 0; y < img.height && data[4 * (y * img.width + x) + 3] == 0; y++)
                ;
            o.push(y);
        }
    else {
        var diff = img.height - 41;
        var from = img.height / 2 + (up ? 1 : -1) * diff / 2;
        var to = img.height / 2 + (up ? -1 : 1) * diff / 2;
        for (var x = 0; x < img.width; x++)
            o.push(from + (to - from) * (x / img.width));
    }
    return o;
}
function make(path, mkImage, mkCanv) {
    var numLoading = 0;
    var listeners = [];
    function allLoaded() {
        var ls = listeners;
        listeners = [];
        ls.forEach(function (f) {
            f();
        });
    }
    // will call the given function the next time there are no images loading
    // optimally, should be called after trying to render a frame, so it's known
    //   that all required images are ready on the second render
    function whenLoaded(l) {
        if (numLoading > 0)
            listeners.push(l);
        else
            l();
    }
    ;
    function lazy(path, cont) {
        return lazy_(path, null, cont);
    }
    function lazy_(path, name, cont) {
        var loaded = false;
        var img = null;
        function ondone() {
            r._ident = {};
            if (cont)
                cont(pict);
            if (--numLoading == 0)
                allLoaded();
        }
        function requested() {
            if (!img) {
                ++numLoading;
                img = mkImage();
                img.src = path;
                img.onload = function () {
                    loaded = true;
                    pict.width = img.width;
                    pict.height = img.height;
                    ondone();
                };
                img.onerror = ondone;
                return false;
            }
            return loaded;
        }
        var pict = {
            name: name,
            touch: requested,
            width: 48, height: 48,
            draw: function (canv) {
                if (requested())
                    canv.drawImage(img, 0, 0, 1, 1);
                else
                    loading(canv);
            },
            drawAt: function (canv) {
                if (requested())
                    canv.drawImage(img, 0, 0);
                else {
                    canv.save();
                    canv.scale(48, 48);
                    loading(canv);
                    canv.restore();
                }
            },
            repeat: function (canv, w, h) {
                if (requested()) {
                    canv.fillStyle = canv.createPattern(img, "repeat");
                    canv.fillRect(0, 0, w, h);
                }
                else {
                    canv.save();
                    canv.fillStyle = "blue";
                    canv.fillRect(0, 0, w, h);
                    canv.beginPath();
                    canv.strokeStyle = "white";
                    for (var x = 0; x <= w; x += 20) {
                        canv.moveTo(x, 0);
                        canv.lineTo(x, h);
                    }
                    for (var y = 0; y <= h; y += 20) {
                        canv.moveTo(0, y);
                        canv.lineTo(w, y);
                    }
                    canv.stroke();
                    canv.restore();
                }
            },
            frame: function (canv, num, of) {
                if (requested()) {
                    num = Math.floor(num);
                    var wdPer = img.width / of;
                    canv.drawImage(img, num * wdPer, 0, wdPer, img.height, 0, 0, 1, 1);
                }
                else {
                    canv.save();
                    canv.translate(0.5, 0.5);
                    canv.rotate(Math.PI * 2 * num / of);
                    canv.translate(-0.5, -0.5);
                    loading(canv);
                    canv.restore();
                }
            }
        };
        return pict;
    }
    var lgrImgs = {};
    for (var i_ in imgs) {
        var i = i_;
        lgrImgs[i] = lazy_(path + "/" + imgs[i] + ".png", i);
    }
    var grassUp = [], grassDown = [];
    var grassUpCount = 0, grassDownCount = 0;
    var lgrPicts = {};
    picts.forEach(function (info) {
        var add = undefined;
        var i = info[0], type = info[1], dist = info[2], clipping = info[3];
        if (i.indexOf("qup_") == 0) {
            grassUpCount++;
            add = function (g) {
                g.borders = borders(mkCanv, g, true);
                grassUp.push(g);
                grassUp.sort(function (a, b) {
                    return (a.name > b.name ? 1 : 0) - (a.name < b.name ? 1 : 0);
                });
            };
        }
        if (i.indexOf("qdown_") == 0) {
            grassDownCount++;
            add = function (g) {
                g.borders = borders(mkCanv, g, false);
                grassDown.push(g);
                grassDown.sort(function (a, b) {
                    return (a.name > b.name ? 1 : 0) - (a.name < b.name ? 1 : 0);
                });
            };
        }
        var img = lgrPicts[i] = lazy_(path + "/picts/" + i + ".png", i, add);
        img.type = type;
        img.dist = dist;
        img.clipping = clipping;
    });
    var r = __assign({ _ident: {}, picts: lgrPicts, lazy: lazy,
        whenLoaded: whenLoaded,
        grassUp: function () {
            if (grassUp.length < grassUpCount)
                picts.forEach(function (i) {
                    if (i[0].indexOf("qup_") == 0)
                        r.picts[i[0]].touch();
                });
            return grassUp;
        },
        grassDown: function () {
            if (grassDown.length < grassDownCount)
                picts.forEach(function (i) {
                    if (i[0].indexOf("qdown_") == 0)
                        r.picts[i[0]].touch();
                });
            return grassDown;
        } }, lgrImgs);
    return r;
}
exports.make = make;

},{}],8:[function(require,module,exports){
"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderer = void 0;
function renderer(levReader, recReader) {
    var appleCount = 0;
    var objs = function () {
        var flowers = [], apples = [], killers = [], starts = [];
        // TODO: handle errors
        var count = levReader.objCount();
        for (var x = 0; x < count; x++)
            levReader.obj(x, function (x, y) { flowers.push({ type: "fl", pos: [x, y] }); }, function (x, y, grav, anim) {
                appleCount++;
                apples.push({ type: "ap", pos: [x, y], grav: grav, anim: anim, taken: -1 });
            }, function (x, y) { killers.push({ type: "ki", pos: [x, y] }); }, function (x, y) { starts.push({ type: "st", pos: [x, y] }); });
        return __spreadArrays(killers, apples, flowers, starts);
    }();
    var applesTaken = [];
    var gravityChanges = [];
    {
        var _loop_1 = function (rec, recR) {
            var count = recR.eventCount();
            var gravC = [];
            for (var x = 0; x < count; x++)
                recR.event(x, function (time, info, type) {
                    if (type == 0) { // TODO: check it's actually there?
                        if (info > objs.length)
                            return;
                        var obj = objs[info];
                        if (obj.type == "ap" && obj.taken == -1) { // TODO: maybe track gravity here?
                            var frame = time / .01456;
                            obj.taken = frame;
                            applesTaken.push([frame, rec]);
                            if (obj.grav > 0)
                                gravC.push([frame, ["up" /* Up */, "down" /* Down */, "left" /* Left */, "right" /* Right */][obj.grav - 1]]);
                        }
                    }
                });
            gravityChanges.push(gravC);
        };
        for (var rec = 0, recR = recReader; recR; recR = recR.next, rec++) {
            _loop_1(rec, recR);
        }
        applesTaken.sort(function (a, b) {
            return (a[0] > b[0] ? 1 : 0) - (a[0] < b[0] ? 1 : 0);
        });
    }
    var isAppleTaken = recReader && recReader.isAppleTaken || (function (frame, id) {
        var obj = objs[id];
        return obj.type == "ap" && obj.taken > -1 && obj.taken <= frame;
    });
    return {
        appleCount: function () {
            return appleCount;
        },
        applesTaken: recReader && recReader.applesTaken || (function (frame) {
            var x;
            for (x = 0; x < applesTaken.length; x++)
                if (applesTaken[x][0] >= frame)
                    break;
            return x;
        }),
        gravity: function (frame, rec) {
            var gravC = gravityChanges[rec];
            if (gravC.length == 0) // returns empty string if gravity is default for whole rec
                return "";
            var x;
            for (x = 0; x < gravC.length; x++)
                if (gravC[x][0] >= frame)
                    break;
            return x ? gravC[x - 1][1] : "down";
        },
        draw: function (canv, lgr, frame, x, y, w, h, scale) {
            canv.save();
            canv.scale(scale, scale);
            canv.translate(-x, -y);
            for (var z = 0; z < objs.length; z++) {
                var obj = objs[z];
                canv.save();
                canv.translate(objs[z].pos[0], objs[z].pos[1]);
                canv.scale(40 / 48, 40 / 48);
                canv.translate(-0.5, -0.5);
                switch (obj.type) {
                    case "ap":
                        if (isAppleTaken(frame, z))
                            break;
                        if (obj.anim)
                            lgr.qfood2.frame(canv, frame % 51, 51);
                        else
                            lgr.qfood1.frame(canv, frame % 34, 34);
                        break;
                    case "fl":
                        lgr.qexit.frame(canv, frame % 50, 50);
                        break;
                    case "ki":
                        lgr.qkiller.frame(canv, frame % 33, 33);
                        break;
                }
                canv.restore();
            }
            canv.restore();
        }
    };
}
exports.renderer = renderer;
;

},{}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.make = void 0;
var levRnd = require("./levRender");
var recRnd = require("./recRender");
var objRnd = require("./objRender");
function signum(n) {
    return n < 0 ? -1 : n > 0 ? 1 : 0;
}
function pad(n, s) {
    s = String(s);
    while (s.length < n)
        s = "0" + s;
    return s;
}
function make(levRd, lgr, makeCanvas) {
    var replays = [], levRn = null;
    var lastFrame = 0;
    var refFrame = 0, refTime = 0;
    var invalidate = true;
    var viewports = [];
    var focus = true; // whether focus is on replays[0]
    var playing = true;
    var startX = 0, startY = 0;
    var zoom = 0; // scale = 0.8^zoom, of Elma units, where 1 Elma unit is 48 px
    var speed = 1; // where 1 is normal speed, -1 is reversed
    var defaultObjRn = null; // for when not spying
    // levRender options; makes sense to persist these
    var optGrass = true;
    var optPictures = true;
    var optCustomBackgroundSky = true;
    reset();
    function reset() {
        replays = [];
        levRn = levRnd.renderer(levRd, lgr);
        updateLevOpts();
        lastFrame = 0;
        refFrame = 0;
        refTime = Date.now();
        invalidate = true;
        viewports = [];
        focus = true;
        playing = true;
        startX = 0;
        startY = 0;
        {
            var nvm = function () { };
            var l = levRd.objCount();
            for (var x = 0; x < l; x++)
                levRd.obj(x, nvm, nvm, nvm, function (x, y) {
                    startX = x;
                    startY = y;
                });
        }
        zoom = 0;
        speed = 1;
        defaultObjRn = objRnd.renderer(levRd, null);
    }
    function updateLevOpts() {
        levRn.setGrass(optGrass);
        levRn.setPictures(optPictures);
        levRn.setCustomBackgroundSky(optCustomBackgroundSky);
    }
    function getViewport(n) {
        if (!viewports[n])
            viewports[n] = {
                offsX: 0, offsY: 0,
                // hack! Firefox seems to perform a lot better without the cache
                // suspect it has to do with the offscreen antialiasing it's doing
                levRn: levRn.cached(4, makeCanvas)
            };
        return viewports[n];
    }
    function setRef() {
        refFrame = lastFrame;
        refTime = Date.now();
        invalidate = true;
    }
    function calcFrameCount() {
        if (replays.length == 0)
            return 60 * 30; // animate objects for a minute
        return replays.map(function (rp) {
            return rp.frameCount;
        }).reduce(function (a, b) {
            return Math.max(a, b);
        }, 0) + 30;
    }
    var frameCount = calcFrameCount();
    function setSpeed(n) {
        if (n == 0)
            return;
        setRef();
        speed = n;
    }
    function setScale(n) {
        if (n == 0)
            return;
        setZoom(Math.log(n) / Math.log(0.8));
    }
    function setZoom(n) {
        zoom = n;
        setRef();
        zoom = n;
    }
    function getScale() {
        return Math.pow(0.8, zoom);
    }
    var dragging = false;
    // (w, h), size of canvas
    function inputClick(x, y, w, h) {
        if (dragging)
            dragging = false;
        else
            changeFocus();
    }
    function inputWheel(x, y, w, h, delta) {
        // was planning on making it zoom around the cursor, but
        // .. what if there are multiple viewports?
        setZoom(zoom + signum(delta));
    }
    function inputDrag(x, y, w, h) {
        if (y < 12 && replays.length > 0)
            return dragSeek(x, y, w, h);
        return dragPosition(x, y, w, h);
    }
    function dragPosition(x, y, w, h) {
        var vp = focus && replays.length > 0 ?
            getViewport(Math.floor(y / h * replays[0].subs.length)) :
            getViewport(0);
        var firstOx = vp.offsX, firstOy = vp.offsY;
        return {
            update: function (cx, cy) {
                dragging = true;
                invalidate = true;
                vp.offsX = firstOx - (cx - x) / (48 * getScale());
                vp.offsY = firstOy - (cy - y) / (48 * getScale());
            },
            end: function () { }
        };
    }
    function dragSeek(x, y, w, h) {
        var firstPlaying = playing;
        playing = false;
        function update(cx, cy) {
            dragging = true;
            if (replays.length == 0)
                return;
            lastFrame = replays[0].frameCount * cx / w;
            if (lastFrame < 0)
                lastFrame = 0;
            if (lastFrame >= frameCount)
                lastFrame = frameCount - 1;
            setRef();
        }
        update(x, y);
        return {
            update: update,
            end: function () {
                playing = firstPlaying;
                setRef();
            }
        };
    }
    function changeFocus() {
        invalidate = true;
        if (replays.length > 0)
            replays.unshift(replays.pop());
        for (var z = 0; z < viewports.length; z++)
            viewports[z].offsX = viewports[z].offsY = 0;
    }
    function playPause() {
        playing = !playing;
        setRef();
    }
    function arrow(str) {
        if (str == "up")
            return "\u2191";
        if (str == "down")
            return "\u2193";
        if (str == "left")
            return "\u2190";
        if (str == "right")
            return "\u2192";
        return "";
    }
    function eround(n) {
        var escale = 48 * getScale();
        return Math.round(n * escale) / escale;
    }
    function drawViewport(vp, canv, x, y, w, h, frame, topRec) {
        canv.save();
        canv.translate(x, y);
        canv.beginPath();
        canv.moveTo(0, 0);
        canv.lineTo(w, 0);
        canv.lineTo(w, h);
        canv.lineTo(0, h);
        canv.clip();
        var centreX = vp.offsX, centreY = vp.offsY;
        if (topRec) {
            var lf = Math.min(frame, topRec.rd.frameCount() - 1);
            centreX += topRec.rn.bikeXi(lf);
            centreY -= topRec.rn.bikeYi(lf);
        }
        else {
            centreX += startX;
            centreY += startY;
        }
        var escale = 48 * getScale();
        var ex = eround(centreX - w / escale / 2), ey = eround(centreY - h / escale / 2);
        var ew = eround(w / escale), eh = eround(h / escale);
        levRn.drawSky(canv, ex, ey, ew, eh, escale);
        vp.levRn(canv, ex, ey, ew, eh, escale);
        if (focus && replays.length > 0)
            replays[0].objRn.draw(canv, lgr, Math.min(frame, replays[0].frameCount - 1), ex, ey, ew, eh, escale);
        else
            defaultObjRn.draw(canv, lgr, frame, ex, ey, ew, eh, escale);
        for (var z = replays.length - 1; z >= 0; z--) {
            for (var zx = replays[z].subs.length - 1; zx >= 0; zx--) {
                var rec = replays[z].subs[zx];
                if (rec != topRec) // object identity
                    rec.rn.draw(canv, lgr, rec.shirt, Math.min(frame, rec.rd.frameCount() - 1), ex, ey, escale);
            }
        }
        if (topRec)
            topRec.rn.draw(canv, lgr, topRec.shirt, Math.min(frame, topRec.rd.frameCount() - 1), ex, ey, escale);
        canv.restore();
    }
    function drawFrame(canv, x, y, w, h, frame) {
        x = Math.floor(x);
        y = Math.floor(y);
        w = Math.floor(w);
        h = Math.floor(h);
        canv.save();
        canv.translate(x, y);
        canv.beginPath();
        canv.moveTo(0, 0);
        canv.lineTo(w, 0);
        canv.lineTo(w, h);
        canv.lineTo(0, h);
        canv.clip();
        canv.fillStyle = "yellow";
        canv.fillRect(0, 0, w, h);
        if (focus && replays.length > 0) {
            var vph = Math.floor(h / replays[0].subs.length);
            // the last viewport gets an extra pixel when h%2 == .subs.length%2
            for (var z = 0; z < replays[0].subs.length; z++)
                drawViewport(getViewport(z), canv, 0, z * vph, w, vph - (z < replays[0].subs.length - 1 ? 1 : 0), frame, replays[0].subs[z]);
            var t = Math.floor(Math.min(frame, replays[0].frameCount - 1) * 100 / 30);
            canv.font = "14px monospace";
            canv.fillStyle = "yellow";
            var csec = pad(2, String(t % 100));
            t = Math.floor(t / 100);
            var sec = pad(2, String(t % 60));
            t = Math.floor(t / 60);
            canv.fillText(t + ":" + sec + "." + csec, 10, 12 * 2);
            canv.fillText(replays[0].objRn.applesTaken(frame) + "/" + replays[0].objRn.appleCount(), 10, 12 * 3);
            //				canv.fillText(arrow(replays[0].objRn.gravity(frame, 0)), 10, 12*4);
            canv.fillRect(w * frame / replays[0].frameCount - 2.5, 0, 5, 12);
        }
        else
            drawViewport(getViewport(0), canv, x, y, w, h, frame, null);
        invalidate = false;
        canv.restore();
    }
    ;
    return {
        changeLevel: function (levRd_) {
            levRd = levRd_;
            reset();
        },
        reset: reset,
        getLevel: function () {
            return levRd;
        },
        drawFrame: drawFrame,
        draw: function (canv, x, y, w, h, onlyMaybe) {
            var curFrame = refFrame;
            var now = Date.now();
            if (playing)
                curFrame += (now - refTime) * speed * 30 / 1000;
            if (replays.length > 0) {
                while (frameCount && curFrame >= frameCount) {
                    curFrame = refFrame = curFrame - frameCount;
                    refTime = now;
                }
                while (frameCount && curFrame < 0) {
                    curFrame = refFrame = frameCount + curFrame;
                    refTime = now;
                }
            }
            if (onlyMaybe && lastFrame == curFrame && !invalidate)
                return;
            lastFrame = curFrame;
            drawFrame(canv, x, y, w, h, lastFrame);
        },
        // shirts should be created by lgr.lazy
        addReplay: function (recRd, shirts) {
            if (replays.length == 0) {
                lastFrame = 0;
                setRef();
            }
            var objRn = objRnd.renderer(levRd, recRd);
            var subs = [];
            while (recRd) {
                subs.push({ rd: recRd, rn: recRnd.renderer(recRd), shirt: shirts[0] || null });
                recRd = recRd.next;
                shirts = shirts.slice(1);
            }
            var replay = {
                objRn: objRn,
                subs: subs,
                frameCount: subs.reduce(function (a, b) {
                    return Math.max(a, b.rd.frameCount());
                }, 0)
            };
            replays.push(replay);
            frameCount = calcFrameCount();
            invalidate = true;
        },
        changeFocus: changeFocus,
        setSpeed: setSpeed,
        setScale: setScale,
        setZoom: setZoom,
        speed: function () { return speed; },
        // scale is deprecated, should prefer to use zoom instead
        scale: function () { return getScale(); },
        zoom: function () { return zoom; },
        setLevOpts: function (o) {
            if (o.grass != undefined)
                optGrass = o.grass;
            if (o.pictures != undefined)
                optPictures = o.pictures;
            if (o.customBackgroundSky != undefined)
                optCustomBackgroundSky = o.customBackgroundSky;
            updateLevOpts();
        },
        setFrame: function (s) {
            lastFrame = s;
            setRef();
        },
        frame: function () {
            return lastFrame; // TODO: this is a hack
        },
        playPause: playPause,
        playing: function () { return playing; },
        inputKey: function (key) {
            switch (key) {
                case "space":
                    playPause();
                    break;
                case "[":
                    setSpeed(speed * 0.8); // 0.8^n is actually representable
                    break;
                case "]":
                    setSpeed(speed / 0.8);
                    break;
                case "backspace":
                    setSpeed(signum(speed));
                    break;
                case "w":
                    setZoom(zoom + 1);
                    break;
                case "e":
                    setZoom(zoom - 1);
                    break;
                case "r":
                    setSpeed(-speed);
                    break;
                case "p":
                    var val = !optCustomBackgroundSky;
                    optPictures = optCustomBackgroundSky = val;
                    updateLevOpts();
                    break;
                case "g":
                    optGrass = !optGrass;
                    updateLevOpts();
                    break;
                case "G":
                    optGrass = optPictures = optCustomBackgroundSky = true;
                    updateLevOpts();
                    break;
                case "right":
                    lastFrame += 30 * 2.5 * speed;
                    setRef();
                    break;
                case "left":
                    lastFrame -= 30 * 2.5 * speed;
                    setRef();
                    break;
                default:
                    return false;
            }
            return true;
        },
        inputClick: inputClick,
        inputDrag: inputDrag,
        inputWheel: inputWheel,
        invalidate: function () {
            invalidate = true;
        }
    };
}
exports.make = make;

},{"./levRender":6,"./objRender":8,"./recRender":11}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reader = void 0;
var bin = require("./binReader");
var ticker = function () {
    var n = 0;
    return function (m) {
        n += m;
        return n - m;
    };
}();
var goffsFrameCount = ticker(4);
var goffsType = ticker(4);
ticker(8);
var goffsLevIdent = ticker(4);
var goffsLevName = ticker(16);
var goffsFloat32s = ticker(0);
function reader(data) {
    var br = bin.reader(data);
    return readerFrom(0);
    function readerFrom(beginPos) {
        var offsFrameCount = beginPos + goffsFrameCount;
        var offsType = beginPos + goffsType;
        var offsLevIdent = beginPos + goffsLevIdent;
        var offsLevName = beginPos + goffsLevName;
        var offsFloat32s = beginPos + goffsFloat32s;
        br.seek(beginPos);
        if (beginPos < 0 || br.end())
            return null;
        var frameCount = br.word32le();
        var gticker = function () {
            var offs = offsFloat32s;
            return function (size, count, reader) {
                var offs_ = offs;
                offs += size * count * frameCount;
                return function (n) {
                    return function (frame) {
                        br.seek(offs_ + size * (n * frameCount + frame));
                        return reader();
                    };
                };
            };
        }();
        var float32s = gticker(4, 2, br.binFloat32le); // bikeX, bikeY
        var int16s = gticker(2, 7, br.int16le); // leftX, leftY, rightX, rightY, headX, headY, bikeR
        var word8s = gticker(1, 5, br.byte); // leftR, rightR, turn, unk1, unk2
        var eventCount = gticker(4, 1, br.word32le)(0)(0); // heh
        var offsEvents = br.pos();
        function event(n, fn) {
            br.seek(offsEvents + n * (8 + 4 + 4));
            return fn(br.binFloat64le(), br.word16le(), br.byte(), br.byte(), br.binFloat32le());
        }
        return {
            frameCount: function () {
                return frameCount;
            },
            bikeX: float32s(0),
            bikeY: float32s(1),
            leftX: int16s(0),
            leftY: int16s(1),
            rightX: int16s(2),
            rightY: int16s(3),
            headX: int16s(4),
            headY: int16s(5),
            bikeR: int16s(6),
            leftR: word8s(0),
            rightR: word8s(1),
            turn: word8s(2),
            eventCount: function () {
                return eventCount;
            },
            event: event,
            event_: function (n) {
                return event(n, function (time, info, type, _, dunno) {
                    return {
                        time: time,
                        info: info,
                        type: type,
                        dunno: dunno
                    };
                });
            },
            next: readerFrom(offsEvents + eventCount * (8 + 4 + 4) + 4)
        };
    }
}
exports.reader = reader;

},{"./binReader":2}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderer = void 0;
function hypot(a, b) {
    return Math.sqrt(a * a + b * b);
}
// (x1, y1)–(x2, y2): line to draw image along
// bx: length of image used before (x1, y1)
// br: length of image used after (x2, y2)
// by: proportional (of ih) y offset within the image the line is conceptually along
// ih: image height
function skewimage(canv, img, bx, by, br, ih, x1, y1, x2, y2, box) {
    var o = x2 - x1, a = y2 - y1;
    canv.save();
    canv.translate(x1, y1);
    canv.rotate(Math.atan2(a, o));
    canv.translate(-bx, -by * ih);
    canv.scale(bx + br + hypot(o, a), ih);
    img.draw(canv);
    if (box) {
        canv.strokeStyle = "purple";
        canv.lineWidth = 0.02;
        canv.strokeRect(0, 0, 1, 1);
    }
    canv.restore();
}
function target(canv, x, y, s) {
    canv.beginPath();
    canv.moveTo(x - s / 2, y);
    canv.lineTo(x + s / 2, y);
    canv.moveTo(x, y - s / 2);
    canv.lineTo(x, y + s / 2);
    canv.stroke();
}
function limb(cwInner, fstParams, sndParams) {
    return function (canv, fstImg, x1, y1, sndImg, x2, y2) {
        var dist = hypot(x2 - x1, y2 - y1);
        var fstLen = fstParams.length, sndLen = sndParams.length;
        var prod = (dist + fstLen + sndLen) *
            (dist - fstLen + sndLen) *
            (dist + fstLen - sndLen) *
            (-dist + fstLen + sndLen);
        var angle = Math.atan2(y2 - y1, x2 - x1);
        var jointangle = 0;
        if (prod >= 0 && dist < fstLen + sndLen) {
            // law of sines
            var circumr = dist * fstLen * sndLen / Math.sqrt(prod);
            jointangle = Math.asin(sndLen / (2 * circumr));
        }
        else
            fstLen = fstLen / (fstLen + sndLen) * dist;
        if (cwInner)
            jointangle *= -1;
        var jointx = x1 + fstLen * Math.cos(angle + jointangle);
        var jointy = y1 + fstLen * Math.sin(angle + jointangle);
        skewimage(canv, fstImg, fstParams.bx, fstParams.by, fstParams.br, fstParams.ih, jointx, jointy, x1, y1);
        skewimage(canv, sndImg, sndParams.bx, sndParams.by, sndParams.br, sndParams.ih, x2, y2, jointx, jointy);
    };
}
var legLimb = limb(false, {
    length: 26.25 / 48,
    bx: 0, by: 0.6, br: 6 / 48, ih: 39.4 / 48 / 3
}, {
    length: 1 - 26.25 / 48,
    bx: 5 / 48 / 3, by: 0.45, br: 4 / 48, ih: 60 / 48 / 3
});
var armLimb = limb(true, {
    length: 0.3234,
    bx: 12.2 / 48 / 3, by: 0.5, br: 13 / 48 / 3, ih: -32 / 48 / 3
}, {
    length: 0.3444,
    bx: 3 / 48, by: 0.5, br: 13.2 / 48 / 3, ih: 22.8 / 48 / 3
});
function renderer(reader) {
    var turnFrames = function () {
        if (reader.lastTurn)
            return [];
        var fc = reader.frameCount();
        var o = [];
        var t = 0;
        for (var f = 0; f < fc; f++) {
            var tmp = reader.turn(f) >> 1 & 1;
            if (tmp != t)
                o.push(f);
            t = tmp;
        }
        return o;
    }();
    var volts = function () {
        if (reader.lastVolt)
            return [];
        var ec = reader.eventCount();
        var o = [];
        for (var e = 0; e < ec; e++)
            reader.event(e, function (time, info, type, a, b) {
                var frame = Math.ceil(time / .01456);
                switch (type) {
                    case 6: // right volt
                        o.push([frame, true]);
                        break;
                    case 7: // left volt
                        o.push([frame, false]);
                        break;
                }
            });
        return o;
    }();
    var lastTurn = reader.lastTurn || (function (frame) {
        var x;
        for (x = 0; x < turnFrames.length; x++)
            if (turnFrames[x] > frame)
                break;
        return x ? turnFrames[x - 1] : -1;
    });
    var lastVolt = reader.lastVolt || (function (frame) {
        var x;
        for (x = 0; x < volts.length; x++)
            if (volts[x][0] > frame)
                break;
        return x ? volts[x - 1] : null;
    });
    function interpolate(fn) {
        return function (n) {
            var f = Math.floor(n), o = n - f, r = fn(f);
            if (o == 0)
                return r;
            return r + (fn(f + 1) - r) * o;
        };
    }
    function interpolateAng(fn, mod) {
        return function (n) {
            var f = Math.floor(n), o = n - f, r = fn(f);
            if (o == 0)
                return r;
            var rs = fn(f + 1), offs = 0;
            var diff1 = rs - r, diff2 = (rs + mod / 2) % mod - (r + mod / 2) % mod;
            var diff = Math.abs(diff1) < Math.abs(diff2) ? diff1 : diff2;
            return r + diff * o;
        };
    }
    function turnScale(x) {
        return -Math.cos(x * Math.PI);
    }
    var bikeXi = interpolate(reader.bikeX);
    var bikeYi = interpolate(reader.bikeY);
    var bikeRi = interpolateAng(reader.bikeR, 10000);
    var leftXi = interpolate(reader.leftX);
    var leftYi = interpolate(reader.leftY);
    var leftRi = interpolateAng(reader.leftR, 250);
    var rightXi = interpolate(reader.rightX);
    var rightYi = interpolate(reader.rightY);
    var rightRi = interpolateAng(reader.rightR, 250);
    var headXi = interpolate(reader.headX);
    var headYi = interpolate(reader.headY);
    function wheel(canv, lgr, wheelX, wheelY, wheelR) {
        canv.save();
        canv.translate(wheelX, -wheelY);
        canv.rotate(-wheelR);
        canv.scale(38.4 / 48, 38.4 / 48);
        canv.translate(-0.5, -0.5);
        lgr.wheel.draw(canv);
        canv.restore();
    }
    // (x, y): top left in Elma coordinates
    // arguably a microoptimisation, but it doesn't produce any objects in the JS world
    function draw(canv, lgr, shirt, frame, x, y, scale) {
        canv.save();
        canv.translate(/*Math.ceil*/ (scale * (-x + bikeXi(frame))), /*Math.ceil*/ (scale * (-y - bikeYi(frame))));
        canv.scale(scale, scale);
        canv.beginPath();
        var bikeR = bikeRi(frame) * Math.PI * 2 / 10000;
        var turn = !!(reader.turn(Math.floor(frame)) >> 1 & 1);
        var leftX = leftXi(frame) / 1000;
        var leftY = leftYi(frame) / 1000;
        var leftR = leftRi(frame) * Math.PI * 2 / 250;
        var rightX = rightXi(frame) / 1000;
        var rightY = rightYi(frame) / 1000;
        var rightR = rightRi(frame) * Math.PI * 2 / 250;
        var headX = headXi(frame) / 1000;
        var headY = headYi(frame) / 1000;
        var lastTurnF = lastTurn(frame);
        var lv = lastVolt(frame);
        var animlen = 28;
        var animpos = lv != null && frame - lv[0] < animlen ? (frame - lv[0]) / animlen : 0;
        var turnpos = lastTurnF >= 0 && lastTurnF + 24 > frame ? (frame - lastTurnF) / 24 : 0;
        var backX = !turn ? rightX : leftX;
        var backY = !turn ? rightY : leftY;
        var backR = !turn ? rightR : leftR;
        var frontX = turn ? rightX : leftX;
        var frontY = turn ? rightY : leftY;
        var frontR = turn ? rightR : leftR;
        if (turnpos == 0 || turnpos > 0.5)
            wheel(canv, lgr, backX, backY, backR);
        if (turnpos <= 0.5)
            wheel(canv, lgr, frontX, frontY, frontR);
        canv.save();
        canv.rotate(-bikeR);
        if (turn)
            canv.scale(-1, 1);
        if (turnpos > 0)
            canv.scale(turnScale(turnpos), 1);
        var wx, wy, a, r;
        var hbarsX = -21.5, hbarsY = -17;
        canv.save();
        canv.scale(1 / 48, 1 / 48);
        // front suspension
        wx = turn ? rightX : leftX;
        wy = turn ? -rightY : -leftY;
        a = Math.atan2(wy, (turn ? -1 : 1) * wx) + (turn ? -1 : 1) * bikeR;
        r = hypot(wx, wy);
        skewimage(canv, lgr.susp1, 2, 0.5, 5, 6, 48 * r * Math.cos(a), 48 * r * Math.sin(a), hbarsX, hbarsY);
        // rear suspension
        wx = turn ? leftX : rightX;
        wy = turn ? -leftY : -rightY;
        a = Math.atan2(wy, (turn ? -1 : 1) * wx) + (turn ? -1 : 1) * bikeR;
        r = hypot(wx, wy);
        //skewimage(canv, lgr.susp2, 5, 0.5, 5, 6.5, 48*r*Math.cos(a), 48*r*Math.sin(a), 10, 20);
        skewimage(canv, lgr.susp2, 0, 0.5, 5, 6, 9, 20, 48 * r * Math.cos(a), 48 * r * Math.sin(a));
        canv.restore();
        canv.save(); // bike
        canv.translate(-43 / 48, -12 / 48);
        canv.rotate(-Math.PI * 0.197);
        canv.scale(0.215815 * 380 / 48, 0.215815 * 301 / 48);
        lgr.bike.draw(canv);
        canv.restore();
        canv.save(); // kuski
        r = hypot(headX, headY);
        a = Math.atan2(-headY, turn ? -headX : headX) + (turn ? -bikeR : bikeR);
        wx = r * Math.cos(a);
        wy = r * Math.sin(a);
        canv.translate(wx, wy);
        canv.save(); // head
        canv.translate(-15.5 / 48, -42 / 48);
        canv.scale(23 / 48, 23 / 48);
        lgr.head.draw(canv);
        canv.restore();
        var bumx = 19.5 / 48, bumy = 0;
        var pedalx = -wx + 10.2 / 48 / 3, pedaly = -wy + 65 / 48 / 3;
        legLimb(canv, lgr.q1thigh, bumx, bumy, lgr.q1leg, pedalx, pedaly);
        canv.save(); // torso
        canv.translate(17 / 48, 9.25 / 48);
        canv.rotate(Math.PI + 2 / 3);
        canv.scale(100 / 48 / 3, 58 / 48 / 3);
        if (shirt && shirt.touch()) {
            // assumes shirts are rotated as on EOL site
            canv.translate(0.5, 0.5);
            canv.rotate(Math.PI / 2);
            canv.translate(-0.5, -0.5);
            shirt.draw(canv);
        }
        else
            lgr.q1body.draw(canv);
        canv.restore();
        var shoulderx = 0 / 48, shouldery = -17.5 / 48;
        var handlex = -wx - 64.5 / 48 / 3, handley = -wy - 59.6 / 48 / 3;
        var handx = handlex, handy = handley;
        var animx = shoulderx, animy = shouldery;
        if (animpos > 0) {
            var dangle = void 0, ascale = void 0;
            if (lv[1] == turn) {
                if (animpos >= 0.25)
                    animpos = 0.25 - 0.25 * (animpos - 0.25) / 0.75;
                dangle = 10.8 * animpos;
                ascale = 1 - 1.2 * animpos;
            }
            else {
                if (animpos >= 0.2)
                    animpos = 0.2 - 0.2 * (animpos - 0.2) / 0.8;
                dangle = -8 * animpos;
                ascale = 1 + 0.75 * animpos;
            }
            var at = Math.atan2(handley - animy, handlex - animx) + dangle;
            var dist = ascale * hypot(handley - animy, handlex - animx);
            handx = animx + dist * Math.cos(at);
            handy = animy + dist * Math.sin(at);
        }
        armLimb(canv, lgr.q1up_arm, shoulderx, shouldery, lgr.q1forarm, handx, handy);
        canv.restore();
        canv.restore();
        if (turnpos != 0 && turnpos <= 0.5)
            wheel(canv, lgr, backX, backY, backR);
        if (turnpos > 0.5)
            wheel(canv, lgr, frontX, frontY, frontR);
        canv.restore();
    }
    return {
        draw: draw,
        bikeXi: bikeXi,
        bikeYi: bikeYi
    };
}
exports.renderer = renderer;

},{}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rectsOverlap = void 0;
function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return ( // parentheses required! ASI!
    x1 + w1 >= x2 &&
        y1 + h1 >= y2 &&
        x2 + w2 >= x1 &&
        y2 + h2 >= y1);
}
exports.rectsOverlap = rectsOverlap;

},{}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.make = void 0;
var geom = require("./geom");
var Tree = {
    tip: function (v) {
        return { type: "tip", v: v };
    },
    branch: function (v) {
        return { type: "branch", v: v };
    }
};
var nil = { type: "nil", v: undefined };
function make(minW) {
    // root must be a (quad) branch
    var root = Tree.branch([nil, nil, nil, nil]);
    var rootW = 1; // length of top-level squares, all touching (0,0)
    function add(valx, valy, val) {
        switch (root.type) {
            case "branch":
                var quads = root.v;
                while (Math.abs(valx) >= rootW || Math.abs(valy) >= rootW) {
                    quads[0] = Tree.branch([nil, nil, nil, quads[0]]);
                    quads[1] = Tree.branch([nil, nil, quads[1], nil]);
                    quads[2] = Tree.branch([nil, quads[2], nil, nil]);
                    quads[3] = Tree.branch([quads[3], nil, nil, nil]);
                    rootW *= 2;
                }
                break;
            default:
                throw new Error("Impossible");
        }
        if (add_({ x: valx, y: valy, val: val }, root, 0, 0, rootW) !== root)
            throw new Error("internal error: a gyökér csomópontoknak egyezniük kell!"); // hehe
    }
    function add_(desc, tree, x, y, w) {
        switch (tree.type) {
            case "nil":
                return Tree.tip([desc]);
            case "tip":
                var descs = tree.v;
                if (w < minW) {
                    descs.push(desc);
                    return tree;
                }
                var r = Tree.branch([nil, nil, nil, nil]);
                for (var z = 0; z < descs.length; z++)
                    r = add_(descs[z], r, x, y, w);
                return add_(desc, r, x, y, w);
            case "branch":
                var quads = tree.v;
                var dx = desc.x < x ? -1 : 1;
                var dy = desc.y < y ? -1 : 1;
                var quad = 2 * (dy < 0 ? 0 : 1) + (dx < 0 ? 0 : 1);
                quads[quad] = add_(desc, quads[quad], x + dx * w / 2, y + dy * w / 2, w / 2);
                return tree;
        }
    }
    // assuming w and h are positive
    function traverse(x, y, w, h, fn) {
        traverse_(root, 0, 0, rootW, x, y, w, h, function (desc) {
            if (desc.x >= x && desc.y >= y &&
                desc.x < x + w && desc.y < y + h)
                fn(desc.x, desc.y, desc.val);
        });
    }
    function traverse_(tree, tx, ty, tw, x, y, w, h, fn) {
        switch (tree.type) {
            case "nil":
                break;
            case "tip":
                var descs = tree.v;
                descs.forEach(fn);
                break;
            case "branch":
                var quads = tree.v;
                var n = 0;
                for (var sy = 0; sy < 2; sy++)
                    for (var sx = 0; sx < 2; sx++) {
                        var dx = sx == 0 ? -1 : 1;
                        var dy = sy == 0 ? -1 : 1;
                        if (geom.rectsOverlap(x, y, w, h, tx - tw + sx * tw, ty - tw + sy * tw, tw, tw))
                            traverse_(quads[n], tx + dx * tw / 2, ty + dy * tw / 2, tw / 2, x, y, w, h, fn);
                        n++;
                    }
                break;
        }
    }
    function dbgdraw(canv, x, y, w, h) {
        dbgdraw_(canv, root, 0, 0, rootW, x, y, w, h);
    }
    function dbgdraw_(canv, tree, tx, ty, tw, x, y, w, h) {
        if (!geom.rectsOverlap(x, y, w, h, tx - tw, ty - tw, tw * 2, tw * 2))
            return;
        canv.strokeRect(tx - tw, ty - tw, tw * 2, tw * 2);
        switch (tree.type) {
            case "nil":
            case "tip":
                break;
            case "branch":
                var quads = tree.v;
                var n = 0;
                for (var sy = 0; sy < 2; sy++)
                    for (var sx = 0; sx < 2; sx++) {
                        var dx = sx == 0 ? -1 : 1;
                        var dy = sy == 0 ? -1 : 1;
                        dbgdraw_(canv, quads[n++], tx + dx * tw / 2, ty + dy * tw / 2, tw / 2, x, y, w, h);
                    }
        }
    }
    return {
        add: add,
        traverse: traverse,
        dbgdraw: dbgdraw
    };
}
exports.make = make;

},{"./geom":12}]},{},[1]);
