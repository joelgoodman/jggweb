import resolve from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import path from 'path';

const SRC_DIR = "_includes";
const ASSETS_DIR = "_includes/assets";
const DIST_DIR = "_site";

const JS_SRC = path.join(ASSETS_DIR, 'js');
const JS_DIST = path.join(DIST_DIR, "assets/js");

export default {
    input: path.join(JS_SRC, 'jgg.js'),
    output: {
        file: path.join(JS_DIST, 'jgg.bundle.js'),
        format: 'iife'
    },
    plugins: [
        resolve(),
		terser()
    ]
}