import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import path from 'path';

const isProduction = process.env.ELEVENTY_ENV === 'production';
const cwd = process.cwd();
const stylesDir = path.join(cwd, '_includes/assets/scss');
const nodeModulesDir = path.join(cwd, 'node_modules');

export default {
  input: 'assets/css/jgg.scss',
  output: {
    // Dummy JS file — only the extracted CSS (below) is used.
    file: '_site/assets/css/__ignore.js',
    format: 'es',
  },
  plugins: [
    postcss({
      extract: path.join(cwd, '_site/assets/css/jgg.css'),
      minimize: isProduction,
      sourceMap: !isProduction,
      plugins: [
        autoprefixer(),
        ...(isProduction ? [cssnano()] : [])
      ],
      use: {
        sass: {
          includePaths: [stylesDir, nodeModulesDir]
        }
      }
    })
  ]
};
