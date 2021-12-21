/* eslint-disable no-undef */
const webpack = require('webpack');
const path = require('path');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const TypescriptDeclarationPlugin = require('typescript-declaration-webpack-plugin');

module.exports = {
  entry: './src/api/dms-player.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'dms-player.js',
    library: 'dmsPlayer',
    libraryTarget: 'umd',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.css'],
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css?$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'url-loader',
        options: {
          name: '[hash].[ext]',
          limit: 1000000,
        },
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery/src/jquery',
      jquery: 'jquery/src/jquery',
    }),
    new CleanWebpackPlugin(),
    new UglifyJSPlugin(),
    new TypescriptDeclarationPlugin({   // d.ts 파일 생성
      out: 'dms-player.d.ts'
    })
  ],
  devServer: {
    clientLogLevel: 'info',
    contentBase: [path.join(__dirname, 'public')],
    publicPath: '/dist/',
    port: 8081,
    watchContentBase: true,
  },
};
