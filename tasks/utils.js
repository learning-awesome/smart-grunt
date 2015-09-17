exports.isCSS=function (path){
 return /\.css/.test(path.toLowerCase());
}

exports.isJS=function (path){
 return /\.js/.test(path.toLowerCase());
}

exports.isHtml=function (path){
 return /\.html/.test(path.toLowerCase())||/\.htm/.test(path.toLowerCase());
}

exports.isImage=function (path){
 return /(\.png|\.jpg|\.gif|\.jpeg)/.test(path.toLowerCase());
}

exports.defaultCompressImageOption= {
 interlaced: true,
 optimizationLevel: 3,
 progressive: true
}

exports.defaultCompressHtmlOption={
 removeComments: true,
 removeCommentsFromCDATA: true,
 collapseWhitespace: true,
 collapseBooleanAttributes: true,
 removeAttributeQuotes: false,
 removeEmptyAttributes: false
}

exports.defaultCompressJSOption = {
 mangle: {
  except: ['require', 'exports', 'module', 'window']
 },
 compress: {
  global_defs: {
   PROD: true
  },
  dead_code: true,
  pure_funcs: [
   "console.log",
   "console.info",
   "console.warn",
   //"console.error",
   "console.assert",
   "console.count",
   "console.clear",
   "console.group",
   "console.groupEnd",
   "console.groupCollapsed",
   "console.trace",
   "console.debug",
   "console.dir",
   "console.dirxml",
   "console.profile",
   "console.profileEnd",
   "console.time",
   "console.timeEnd",
   "console.timeStamp",
   "console.table",
   "console.exception"
  ]
 }
}

