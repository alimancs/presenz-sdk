// rollup.config.mjs

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';
import json from '@rollup/plugin-json';

import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const isProduction = process.env.NODE_ENV === 'production';

export default [
  // 1. Main bundle: JS (CJS + ESM)
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.main || 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: pkg.module || 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
        exports: 'named'
      }
    ],
    plugins: [
      json(),
      peerDepsExternal(),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      postcss({
        extensions: ['.css'],
        minimize: isProduction,
        extract: 'styles.css'
      }),
      isProduction && terser()
    ],
    external: ['react', 'react-dom', 'tslib', 'axios']
  },

  // 2. Types (.d.ts) build
  {
    input: 'src/index.ts',
    output: [{ file: pkg.types || 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
    external: [/\.css$/, /\.json$/]
  }
];