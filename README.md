## Grunt前端一体打包框架

1、支持HTML、CSS、JavaScript 压缩混淆

2、支持CSS、JavaScript 自动引用合并

3、支持image、js、css、html和变量引入

4、支持js、css、html 压缩合并，image压缩

5、简化grunt 打包操作，只需通过简单配置即可实现前端工程化

6、资源md5功能待实现


##smart-grunt  5个命令介绍

smart_clean:目录文件清理

smart_copy: 文件复制到指定目录

smart_js: js文件合并，支持混淆压缩

smart_css: css文件合并，支持css压缩

smart_html: html文件中html、css、js  inline处理、 

##任务初始化配置
grunt.loadNpmTasks('smart-grunt');
grunt.initConfig({

    smart_clean: {
      all: ['dist/html/**']
    },

    smart_html: {
      generated: {
        options: {
          vars: {},
          srcRootDir: ['src','prototype'],
          exceptInline: ['css/global.css','framework/sdk/sdk-all-min.js'],
          compressJS:false,
          compressCss:false,
          compressHtml:false
        },
        files: [
          {
            expand: true,
            cwd: 'src',
            src: ['modules/**/*.*'],
            dest: 'dist/html'
          }
        ]
      }
    },

    smart_copy: {
      conf:{
        files: [
          {expand: true, cwd: 'src', src: ['conf/*.*'], dest: 'dist/html'}
        ]
      },
      js: {
        files: [
          {expand: true, cwd: 'src', src: ['commons/*.js'], dest: 'dist/html'}
        ]
      },
      css: {
        files: [
          {expand: true, cwd: 'prototype', src: ['css/*.css'], dest: 'dist/html'}
        ]
      },
      image: {
        files: [
          {
            expand: true,
            cwd: 'prototype',
            src: [
              'images/*.{png,jpg,jpeg,gif,webp,svg}'
            ],
            dest: 'dist/html'
          }
        ]
      }
    },

    smart_css:{
      generated:{
        files:[
          {
            src: [
              'src/style/list.css',
              'src/style/panel.css',
            ],
            dest:'dist/html/style/common.css'
          }
        ]
      }
    },
    
    smart_js:{
      generated:{
        files:[
          {
            src: [
              'src/framework/sdk/sdk-common.js',
              'src/framework/sdk/sdk-business.js',
            ],
            dest:'dist/html/framework/sdk/sdk-all-min.js'
          }
        ]
      }
    }
   );
   
##注册任务
grunt.registerTask('dev', ['smart_copy:js', 'smart_copy:css', 'smart_copy:image', 'smart_js:generated','smart_html:generated']);
grunt.registerTask('prod', ['smart_copy:js:true', 'smart_copy:css:true', 'smart_copy:image:true', 'smart_js:generated:true','smart_html:generated:true']);


注意： html中css、js、images资源都用相对路程使用，这样能保证本地能直接运行。