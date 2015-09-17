var path = require('path');
var fs = require('fs');
var os = require('os');
var chalk = require('chalk');
var crypto = require('crypto');
var utils = require('./utils');
var async = require('async');
var prettyBytes = require('pretty-bytes');

var Uglify = require('uglify-js');
var CleanCSS = require('clean-css');
var HtmlMinifier = require('html-minifier');
var Imagemin = require('imagemin');

module.exports = function (grunt) {
  'use strict';

  function compressImg(src, dest) {
    //console.log('>>src:' + src + ' dest:' +path.dirname(dest) );
    var imagemin = new Imagemin().src(src).dest(path.dirname(dest));

    switch (path.extname(src).toLowerCase()) {
      case '.jpg' :
        imagemin.use(Imagemin.jpegtran(utils.defaultCompressImageOption));
        break;
      case '.png' :
        imagemin.use(Imagemin.optipng(utils.defaultCompressImageOption));
        break;
      case '.gif' :
        imagemin.use(Imagemin.gifsicle(utils.defaultCompressImageOption));
        break;
      case '.svg' :
        imagemin.use(Imagemin.svgo());
        break;
      default:
        console.log(src + ' not support');
        break;
    }
    return imagemin;
  }

  function fileCopy(src, dest, copyOptions, isCompress, images) {
    if (isCompress) {
      if (utils.isCSS(src)) {
        var content = grunt.file.read(src);
        content = new CleanCSS().minify(content).styles;
        grunt.file.write(dest, content);
      } else if (utils.isJS(src)) {
        var content = grunt.file.read(src);
        var jsOption = utils.defaultCompressJSOption;
        jsOption.fromString = true;
        content = Uglify.minify(content, jsOption).code
        grunt.file.write(dest, content);
      } else if (utils.isHtml(src)) {
        var content = grunt.file.read(src);
        content = HtmlMinifier.minify(content, utils.defaultCompressHtmlOption);
        grunt.file.write(dest, content);
      } else if (utils.isImage(src)) {
        grunt.file.copy(src, dest, copyOptions);
        images.push(dest);
      } else {
        grunt.file.copy(src, dest, copyOptions);
      }
    } else {
      grunt.file.copy(src, dest, copyOptions);
    }
  }

  var detectDestType = function (dest) {
    if (grunt.util._.endsWith(dest, '/')) {
      return 'directory';
    } else {
      return 'file';
    }
  };

  var unixifyPath = function (filepath) {
    if (process.platform === 'win32') {
      return filepath.replace(/\\/g, '/');
    } else {
      return filepath;
    }
  };

  grunt.registerMultiTask('smart-copy', 'Copy files.', function (isCompress) {
    var images=[];
    var msg;
    var options = this.options({
      encoding: grunt.file.defaultEncoding,
      processContent: false,
      processContentExclude: [],
      timestamp: false,
      mode: false
    });

    var copyOptions = {
      encoding: options.encoding,
      process: options.process || options.processContent,
      noProcess: options.noProcess || options.processContentExclude,
    };

    var dest;
    var isExpandedPair;
    var dirs = {};
    var tally = {
      dirs: 0,
      files: 0
    };

    this.files.forEach(function (filePair) {
      isExpandedPair = filePair.orig.expand || false;

      filePair.src.forEach(function (src) {
        if (detectDestType(filePair.dest) === 'directory') {
          dest = (isExpandedPair) ? filePair.dest : unixifyPath(path.join(filePair.dest, src));
        } else {
          dest = filePair.dest;
        }

        if (grunt.file.isDir(src)) {
          grunt.verbose.writeln('Creating ' + chalk.cyan(dest));
          grunt.file.mkdir(dest);

          if (options.timestamp) {
            dirs[dest] = src;
          }

          tally.dirs++;
        } else {
          grunt.verbose.writeln('Copying ' + chalk.cyan(src) + ' -> ' + chalk.cyan(dest));
          fileCopy(src, dest, copyOptions, isCompress, images);
          tally.files++;
        }
      });
    });

    if (tally.dirs) {
      grunt.log.writeln('Created ' + chalk.cyan(tally.dirs.toString()) + ' directories');
    }

    if (tally.files) {
      grunt.log.writeln((tally.dirs ? ', copied ' : 'Copied ') + chalk.cyan(tally.files.toString()) + (tally.files === 1 ? ' file' : ' files'));
    }

    // Í¼Æ¬Ñ¹Ëõ
    if(isCompress && images.length>0){
      //console.log('>>>images:', images.join(','));
      var done = this.async();
      var totalSaved = 0;
      var len = images.length;
      var i=0;
      grunt.log.write(chalk.green(len +' images are compressing'));
      async.forEachLimit(images, os.cpus().length, function (src, next) {
        var imagemin = compressImg(src, src);
        fs.stat(src, function (err, stats) {
          if (err) {
            grunt.warn(err + ' in file ' + src);
            return next();
          }
          imagemin.run(function (err, data) {
            if (err) {
              console.error(src + 'not compressed' + ' error:' + err);
              return next();
            }
            var origSize = stats.size;
            var diffSize = origSize - data[0].contents.length;
            totalSaved += diffSize;
            if (diffSize < 10) {
              msg = 'already optimized';
            } else {
              msg = [
                'saved ' + prettyBytes(diffSize) + ' -',
                (diffSize / origSize * 100).toFixed() + '%'
              ].join(' ');
            }
            process.nextTick(next);
            i++;
            grunt.log.write(chalk.green('.'));
            if(i==len){
              grunt.log.write(chalk.green(images.length + ' images  compressed finished (saved ' + prettyBytes(totalSaved) + ')'));
              done();
            }
          });
        });
      });
    }
  });


};
