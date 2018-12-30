# 开箱即用，自由配置
本项目是为了使countly-server适合本地调试和编译打包，然后pm2部署线上服务器。

## 写在前言
`
1、	请参考README.md和package.json
2、	请务必正确规范开发部署
  2.1  本地环境（见正文-安装使用）
  2.2  Linux环境（见正文-安装使用）
3、	node版本8+，npm版本 6+，mongodb版本3.4
4、	本地电脑和服务器必须安装C/ C++，Ruby，Python等执行编译环境
5、	pm2是一个带有负载均衡功能的Node应用的进程管理器

`

## 安装使用
# 启动服务，使用开发环境 (以yarn命令为示范)
`
1.	mongod        （启动mongodb数据库）
2.	yarn 或 cnpm install 或 npm install（项目根路径，安装项目依赖模块）
3.	yarn run grunt:task（如果改了html/css代码，需要重新编译打包，其他忽略）
4.	构建打包apn环境依赖: cd plugins/push/api/parts/apn && npm run install
5.	yarn run api
6.	yarn run server

`
 
# 第一次服务器部署，必须准备好环境依赖(以rhel服务器为示范)
`
1.	mongodb               （版本3.4）
2.	npm install pm2@latest -g （node部署管理工具）
3.	项目根路径下，执行shell脚本: /bin/bash bin/countly.install_rhel.sh

`

# 启动服务，部署liunx服务器环境（pm2会监听项目代码变动自动重启进程）

`
1.	cnpm install （优先使用cnpm下载，保证依赖文件包完整）
2.	yarn run grunt:task（如果改了html/css代码，需要重新编译打包，其他忽略）
3.	构建打包apn环境依赖: cd plugins/push/api/parts/apn && npm run install
4.	pm2 start pm2-api.json       (首次启动，其他具体参考pm2使用命令)
5.	pm2 start pm2-express.json   (首次启动，其他具体参考pm2使用命令)

`

## 说明
如果本项目对你有价值，请帮忙点个Star，谢谢！
附上中文文档https://resources.count.ly/v2.0/docs

## 补充
源代码和社区版权请访问https://github.com/Countly/countly-server
