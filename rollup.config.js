import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import pkg from './package.json';

const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];

export default [
  {
    input: 'src/index.js',
    treeshake: true,
    strictDeprecations: true,
    external: ['mongoose'],
    output: [{ file: pkg.module, format: 'es' }],
    plugins: [
      json({ compact: true, preferConst: true }),
      nodeResolve({ extensions }),
      commonjs(),
    ],
  },
];
