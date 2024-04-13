#!/bin/bash

# Create a new commit suitable for pushing to `gh-pages`; does not actually push or update any branches.
# The tree of the new commit will be extracted to `./gh-pages`.

set -e

base="$1"
if [ "$base" = "" ]; then
	base=remotes/origin/gh-pages
fi

newamdjs="$(git hash-object -w amd.js)"
newtree="$(
	(
		git ls-tree "$base" | grep -v $'\tamd.js$'
		printf '%s %s %s\t%s\n' 100644 blob "$newamdjs" amd.js
	) | git mktree
)"
newcommit="$(git commit-tree "$newtree" -p "$base" -m "Generated from $(git rev-parse HEAD)")"

echo "$newcommit"
mkdir -p gh-pages
git archive "$newcommit" | tar -xC gh-pages
