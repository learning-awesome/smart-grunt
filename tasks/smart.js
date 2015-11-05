module.exports = function (grunt) {

  'use strict';
  var _ = grunt.util._;
  var chalk = require('chalk');
  var path = require('path');
  var fs = require('fs');
  var Uglify = require('uglify-js');
  var CleanCSS = require('clean-css');
  var HtmlMinifier = require('html-minifier');
  var utils = require('./utils');
  var headReg = /<head>([\S\s\t]*?)<\/head>/;
  var allJSFiles = [];
  var inlineJsFiles = [];

  grunt.registerMultiTask('smart_js', 'grunt pack framework', function (isCompress) {
    grunt.log.write(chalk.green('js file processing'));
    this.files.forEach(function (item, index) {
      grunt.log.write(chalk.green('.'));
      var content = '';
      item.src.forEach(function (file) {
        content += grunt.file.read(file) + '\r\n';
      });
      if (isCompress) {
        var compressJSOption = utils.defaultCompressJSOption;
        compressJSOption.fromString = true;
        content = Uglify.minify(content, compressJSOption).code;
      }
      grunt.file.write(item.dest, content);
    });
    grunt.log.write(chalk.green('finished!'));
  });

  grunt.registerMultiTask('smart_css', 'grunt pack framework', function (isCompress) {
    grunt.log.write(chalk.green('css file processing'));
    this.files.forEach(function (item, index) {
      grunt.log.write(chalk.green('.'));
      var content = '';
      item.src.forEach(function (file) {
        content += grunt.file.read(file) + '\r\n';
      });
      if (isCompress) {
        content = new CleanCSS().minify(content).styles;
      }
      grunt.file.write(item.dest, content);
    });
    grunt.log.write(chalk.green('finished!'));
  });

  grunt.registerMultiTask('smart_html', 'grunt pack framework', function (isCompress) {

    var errorMsg = [];
    var options = this.options({
      beforefix: '<!--',
      endfix: '-->',
      vars: {},
      exceptInline: [],
      srcRootDir: '',
      encoding: 'utf8'
    });

    if (!options.compressJSOption) {
      options.compressJSOption = utils.defaultCompressJSOption;
    }
    options.compressJSOption.fromString = true;

    if (isCompress) {
      options.compressJS = true;
      options.compressCss = true;
      options.compressHtml = true;
    }

    grunt.file.defaultEncoding = options.encoding;

    var globalVars = options.vars;

    var globalVarNames = Object.keys(globalVars);

    globalVarNames.forEach(function (globalVarName) {
      if (_.isString(globalVars[globalVarName])) {
        globalVars[globalVarName] = globalVars[globalVarName];
      } else {
        globalVars[globalVarName] = JSON.stringify(globalVars[globalVarName]);
      }
    });

    var globalVarRegExps = {};

    var requireRegExp = new RegExp(options.beforefix + 'import\\(\\s*["\'](.*?)["\'](,\\s*({[\\s\\S]*?})){0,1}\\s*\\)' + options.endfix,'g');

    function replace(content, localVars) {

      localVars = localVars || {};

      var varNames = Object.keys(localVars);
      var varRegExps = {};

      varNames.forEach(function (varName) {

        if (_.isString(localVars[varName])) {
          localVars[varName] = grunt.template.process(localVars[varName]);
        } else {
          localVars[varName] = JSON.stringify(localVars[varName]);
        }

        varRegExps[varName] = varRegExps[varName] || new RegExp("{{" + varName + "}}", 'g');

        content = content.replace(varRegExps[varName], localVars[varName]);
      });

      globalVarNames.forEach(function (globalVarName) {

        globalVarRegExps[globalVarName] = globalVarRegExps[globalVarName] || new RegExp(options.prefix + globalVarName + options.suffix, 'g');

        content = content.replace(globalVarRegExps[globalVarName], globalVars[globalVarName]);
      });

      return content;
    }

    function createReplaceFn(replacement) {
      return function () {
        return replacement;
      };
    }

    function calculateFileRelativePath(fileDir, importFileDir, resourcePath) {
      var resourceRelativePath = resourcePath;
      var relativeValue = fileDir.split('/').length - importFileDir.split('/').length;
      if (relativeValue > 0) {
        for (var i = 0; i < relativeValue; i++) {
          resourceRelativePath = '../' + resourceRelativePath;
        }
      } else {
        for (var i = 0; i < Math.abs(relativeValue); i++) {
          resourceRelativePath = resourceRelativePath.replace('../', '');
        }
      }
      //grunt.log.ok('>>>path:'+JSON.stringify({fileDir:fileDir, importFileDir: importFileDir, resourceRelativePath:resourceRelativePath}));
      return resourceRelativePath;
    }

    function calculateUnInlineFileRelativePath(fileDirAbs, importFileDirAbs, importPath) {
      var relativePath = path.relative(fileDirAbs, importFileDirAbs).replace(/\\/g, '/');
      //console.log('>>>relativePath:'+relativePath);
      var fileName = importPath;
      var lastIndex = importPath.lastIndexOf('/');
      if (lastIndex > -1) {
        fileName = importPath.substring(lastIndex);
      }
      return relativePath + fileName;
    }

    //import 图片, css、 script 路径搜索并转换为相对地址
    function searchResourceAndReplace(content, fileDir, importFileDir, tagReg, tagSrcReg) {
      //grunt.log.ok('>>>images', JSON.stringify(content.match(imgReg)));
      var tagList = content.match(tagReg);
      if (tagList) {
        tagList.forEach(function (tag) {
          var srcArr = tag.match(tagSrcReg);
          if (srcArr && srcArr.length > 1) {
            var src = srcArr[1];
            var resourceRelativePath = calculateFileRelativePath(fileDir, importFileDir, src);
            if (src != resourceRelativePath) {
              //grunt.log.ok('>>>path replace:' + src + " to " + resourceRelativePath);
              content = content.replace(new RegExp(src, 'gm'), resourceRelativePath);
            }
          }
        });
      }
      return content;
    }


    function processCssFileImagePath(content, fileDir, importFileDir) {
      content = content.replace(/\(['"]?((?!https?)[^'\(\)"]*(\.png|\.jpg|\.gif|\.jpeg))['"]?\)/gi, function (match, imageUrl) {
        var resourceRelativePath = calculateFileRelativePath(fileDir, importFileDir, imageUrl);
        //console.log('imageUrl:' + imageUrl + ' resourceRelativePath:'+resourceRelativePath);
        return '(' + resourceRelativePath + ')';
      });
      return content;
    }


    function isDirectory(dest) {
      return grunt.util._.endsWith(dest, '/');
    }

    function readFileContent(importPathAbs, localVars) {

      var files = grunt.file.expand(importPathAbs);
      var includeContent = '';

      files.forEach(function (filePath, index) {
        includeContent += grunt.file.read(filePath);
        includeContent += index !== files.length - 1 ? '\n' : '';
        includeContent = replace(includeContent, localVars);
        includeContent = readFile(includeContent, path.dirname(filePath), filePath);
        if (options.processIncludecontent && typeof options.processIncludecontent === 'function') {
          includeContent = options.processIncludecontent(includeContent, localVars);
        }
      });
      return includeContent;
    }

    function getImportFileAbs(importPath) {
      for (var i = 0, len = options.srcRootDir.length; i < len; i++) {
        var rootDir = options.srcRootDir[i];
        var importPathAbs = path.resolve(path.join(rootDir, importPath)).replace(/\\/g, '/');
        if (grunt.file.exists(importPathAbs)) {
          var importFileDir = path.dirname(path.join(rootDir, importPath)).replace(/\\/g, '/');
          var importFileDirAbs = path.resolve(importFileDir).replace(/\\/g, '/');
          return {importFileDir: importFileDir, importFileDirAbs: importFileDirAbs, importPathAbs: importPathAbs};
        }
      }
      return {};
    }

    function readFile(content, fileDir, filePath) {
      var matches;
      var importHTMLArray = [];
      var importCSSArray = [];
      var importJSArray = [];
      while ((matches = requireRegExp.exec(content)) !== null) {

        //console.log('matchList:', JSON.stringify(matches));

        if(matches.length<4) return content;

        var match, importPath, importPathAbs, localVars, importFileDir, importFileDirAbs;
        var fileDirAbs = path.resolve(fileDir).replace(/\\/g, '/');

        match = matches[0];
        importPath = matches[1];
        localVars = matches[3] ? JSON.parse(matches[3]) : {};

        var importFileInfos = getImportFileAbs(importPath);
        importFileDir = importFileInfos.importFileDir;
        importFileDirAbs = importFileInfos.importFileDirAbs;
        importPathAbs = importFileInfos.importPathAbs;

        //grunt.log.ok(">>> importPathAbs:" + importPathAbs + ' importFileDir:' + importFileDir + " importFileDirAbs:" + importFileDirAbs);
        if (importPathAbs) {
          if (utils.isHtml(importPath)) {
            importHTMLArray.push({
              match: match,
              sourceFile: filePath,
              importFileDir: importFileDir,
              importFileDirAbs: importFileDirAbs,
              importPathAbs: importPathAbs,
              importPath: importPath,
              vars: localVars
            });
          } else if (utils.isCSS(importPath)) {
            importCSSArray.push({
              match: match,
              sourceFile: filePath,
              importFileDir: importFileDir,
              importFileDirAbs: importFileDirAbs,
              importPathAbs: importPathAbs,
              importPath: importPath,
              vars: localVars
            });
          } else if (utils.isJS(importPath)) {
            importJSArray.push({
              match: match,
              sourceFile: filePath,
              importFileDir: importFileDir,
              importFileDirAbs: importFileDirAbs,
              importPathAbs: importPathAbs,
              importPath: importPath,
              vars: localVars
            });
          }
        } else {
          errorMsg.push('[' + filePath + '] no find the import file:' + importPath);
          content = content.replace(match, createReplaceFn(''));
        }
      }

      // 优先处理HTML
      //console.log('>>>html:' + importHTMLArray.length + ' js:' +  importJSArray.length+ ' css:' + importCSSArray.length);
      //grunt.log.ok('fileDir:' + fileDir + ' filepath:' + filePath);
      importHTMLArray.forEach(function (item, index) {
        var importHtmlContent = readFileContent(item.importPathAbs, item.vars);

        // 图片路径处理
        importHtmlContent = searchResourceAndReplace(importHtmlContent, fileDir, importFileDir,
          /<img[^>]+src\s*=\s*['\"]([^'\"]+)\.(png|jpg|gif|jpeg)['\"][^>]*>/gi,
          /src=['"]?((?!https?)[^'"]*\.(png|jpg|gif|jpeg))['"]?/i);

        // css路径处理
        importHtmlContent = searchResourceAndReplace(importHtmlContent, fileDir, importFileDir,
          /<link[^>]+href\s*=\s*['\"]([^'\"]+)\.(css)['\"][^>]*>/gi,
          /href=['"]?((?!https?)[^'"]*\.(css))['"]?/i);

        // script路径处理
        importHtmlContent = searchResourceAndReplace(importHtmlContent, fileDir, importFileDir,
          /<script[^>]+src\s*=\s*['\"]([^'\"]+)\.(js)['\"][^>]*>/gi,
          /src=['"]?((?!https?)[^'"]*\.(js))['"]?/i);

        // 文件内容替换
        //console.log('>>>content before:', content);
        content = content.replace(item.match, createReplaceFn(importHtmlContent));
        //console.log('>>>content after:', content);

      });

      importJSArray.forEach(function (item) {
        var unInlineFilePath = calculateUnInlineFileRelativePath(fileDirAbs, item.importFileDirAbs, item.importPath);
        if (options.exceptInline.indexOf(item.importPath) > -1) {
          var hasBodyTag = false;
          //grunt.log.ok('>>>content:' + content);
          content = content.replace(/<\/body>/gi, function (match) {
              hasBodyTag = true;
              //grunt.log.ok('--js inline match:' + match);
              return '\r\n<script src="' + unInlineFilePath + '" type="text/javascript"></script>\r\n' + match;
            }
          );
          //grunt.log.ok('--js inline hasBodyTag:' + hasBodyTag);
          if (!hasBodyTag) {
            content = content + '\r\n<script src="' + unInlineFilePath + '" type="text/javascript"></script>\r\n';
          }
          content = content.replace(item.match, createReplaceFn(''));
        } else {
          inlineJsFiles.push(item.importPath);
          var hasDefine = false;
          var fileName = item.importPath.replace('.js', '_seajs');
          var importJSContent = readFileContent(item.importPathAbs, item.vars);
          importJSContent = importJSContent.replace(/define\s*\(function\s*\(require\s*,\s*exports\s*,\s*module\s*\)/gi, function (match) {
              hasDefine = true;
              return 'define(\'' + fileName + '\',function (require, exports, module)';
            }
          );
          if (hasDefine) {
            importJSContent = importJSContent + '\r\nseajs.use(\'' + fileName + '\',function(){angular.bootstrap(document, [\'ngmApp\']);});\r\n';
          }

          if (options.compressJS) {
            importJSContent = Uglify.minify(importJSContent, options.compressJSOption).code
          }

          var hasBodyTag = false;

          //grunt.log.ok('>>>content:' + content);
          content = content.replace(/<\/body>/gi, function (match) {
              hasBodyTag = true;
              //grunt.log.ok('--js inline match:' + match);
              return '\r\n<script>\r\n' + importJSContent + '\r\n</script>\r\n' + match
            }
          );

          //grunt.log.ok('--js inline hasBodyTag:' + hasBodyTag);
          if (!hasBodyTag) {
            content = content + '\r\n<script>\r\n' + importJSContent + '\r\n</script>\r\n'
          }
          content = content.replace(item.match, createReplaceFn(''));
        }
      });

      // css inline and link 处理
      importCSSArray.forEach(function (item) {

        if (options.exceptInline.indexOf(item.importPath) > -1) {
          var unInlineFilePath = calculateUnInlineFileRelativePath(fileDirAbs, item.importFileDirAbs, item.importPath);
          var hasHeadTag = false;
          content = content.replace(/<\/head>/gi, function (match) {
              hasHeadTag = true;
              return '\r\n<link rel="stylesheet" href="' + unInlineFilePath + '">\r\n' + match;
            }
          );
          if (!hasHeadTag) {
            content = content.replace(item.match, createReplaceFn('\r\n<link rel="stylesheet" href="' + item.importPath + '">\r\n'));
          }
          content = content.replace(item.match, createReplaceFn(''));
        } else {
          var importCSSContent = readFileContent(item.importPathAbs, item.vars);

          importCSSContent = processCssFileImagePath(importCSSContent, item.sourceFile, item.importFileDir);

          // css压缩处理
          if (options.compressCss) {
            importCSSContent = new CleanCSS().minify(importCSSContent).styles;
          }

          var hasHeadTag = false;
          content = content.replace(/<\/head>/gi, function (match) {
              hasHeadTag = true;
              return '\r\n<style>\r\n' + importCSSContent + '\r\n</style>\r\n' + match
            }
          );

          if (hasHeadTag) {
            content = content.replace(item.match, createReplaceFn(''));
          } else {
            content = content.replace(item.match, createReplaceFn('\r\n<style>' + importCSSContent + '</style>\r\n'));
          }
        }
      });

      return content;
    }

    var htmlFileCount = 0;
    grunt.log.write(chalk.green('html processing'));
    this.files.forEach(function (config) {
      var dest = config.dest;
      config.src.forEach(function (src) {
        if (grunt.file.isFile(src)) {
          if (utils.isJS(src)) {
            allJSFiles.push({dest: dest, src: src});
          } else {
            htmlFileCount++;
            grunt.log.write(chalk.green('.'));
            var content = grunt.file.read(src);
            console.log('>>>pack start read file:' + src);
            content = readFile(content, path.dirname(src), src);
            if (options.compressHtml && utils.isHtml(src)) {
              content = HtmlMinifier.minify(content, utils.defaultCompressHtmlOption);
            }
            grunt.file.write(dest, content);
          }
        }
      });
    });

    var copyFileCount = 0;
    // 没有inline的文件copy到dest
    allJSFiles.forEach(function (item) {
      var isInline = inlineJsFiles.some(function (inlineSrc) {
        return item.src.indexOf(inlineSrc) > -1;
      });
      if (!isInline) {
        grunt.log.write(chalk.green('.'));
        copyFileCount++;
        var content = grunt.file.read(item.src);
        if (options.compressJS) {
          content = Uglify.minify(content, options.compressJSOption).code
        }
        grunt.file.write(item.dest, content);
      }
    });

    if (errorMsg.length > 0) {
      grunt.log.writeln(chalk.red(errorMsg.length + ' error happend:'));
      errorMsg.forEach(function (msg) {
        grunt.log.writeln(chalk.yellow(msg));
      });
    } else {
      grunt.log.write(chalk.green('finished!'));
    }
    grunt.log.writeln(chalk.green('processed ' + htmlFileCount + ' html files,') + chalk.green('copied ' + copyFileCount + ' js files!'));
  });
};
