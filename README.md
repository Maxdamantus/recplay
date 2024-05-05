# recplay

This is a library for reading, rendering and playing Elasto Mania `.lev` and `.rec` files.

Previous versions used source files implemented in AMD form (asynchronous module definition) with no necessary build process, and a basic "amd.js" loader was provided.

The current version is implemented in TypeScript using ES6 modules, but a drop-in standalone "amd.js" file can be built using:
```sh
npm install
npm run amd-fake
```

Correct rendering depends on various images that are normally part of an `.lgr` file. There should be a `gh-pages` branch in this repository with an `images` directory containing images derived from the `lgrdk10.zip` distribution of the LGR development kit. Note that these images however have a higher pixel depth (24-bit) than the ones used in the actual game (possibly 8-bit mapped?).

# Basic usage

Install package from git repository:
```sh
npm install git+https://github.com/Maxdamantus/recplay
```

Render level `stuff/chainpi3.lev` and play replay `stuff/chainpi3adi.rec`, assuming LGR images are accessible in the `images` directory:
```ts
import * as controller from "recplay/lib/controller";

document.addEventListener("DOMContentLoaded", () => {
	const target = document.body.appendChild(document.createElement("div"));
	controller.make("stuff/chainpi3.lev", "images", target, document)(cnt => {
		cnt.resize(1024, 768);
		cnt.loadReplay("stuff/chainpi3adi.rec", []);
	});
});
```

Various sample usages are also included in the `gh-pages` branch.

# Development
The `update-gh-pages.sh` script can be used to easily experiment with changes:
```sh
npm run amd-fake && ./update-gh-pages
```
This will build and populate a `gh-pages` directory based on the latest version of the `gh-pages` branch (containing images and sample pages) with the new version of "amd.js".

In older browsers, the sample pages could be viewed locally using `file://` URIs, but nowadays an HTTP server must be used, eg:
```sh
python3 -m http.server -d gh-pages/
```
