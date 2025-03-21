import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
    input: 'web/js/index.js',
    output: {
        file: 'dist/main.js',
        format: 'iife',
        name: 'SVG2Onshape'  // Add this line
    },
    plugins: [
        commonjs(),
        resolve()
    ]
};