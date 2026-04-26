# Sunson

一个基于 Vue 3、TypeScript 和 Vite 的专辑播放页面项目，当前页面围绕周杰伦《太阳之子》专题歌单进行展示。项目内置播放器、歌词联动、歌曲列表和下载能力，适合做专辑页、音乐展示页或本地音频播放界面的参考模板。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Ant Design Vue

## 怎么运行这个项目

### 1. 安装依赖

建议先准备较新的 Node.js LTS 版本，然后在项目根目录执行：

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

启动后按终端提示打开本地地址，默认通常是：

```text
http://localhost:5173
```

### 3. 打包生产版本

```bash
npm run build
```

打包完成后，产物会输出到 `dist/` 目录。

### 4. 本地预览打包结果

```bash
npm run preview
```

## 这个项目怎么用

页面主要分为顶部主播放器和底部歌曲列表两部分，使用方式如下：

1. 打开页面后，顶部会显示当前歌曲的封面、标题、歌手、专辑和简介信息。
2. 点击中间的播放按钮可以播放或暂停当前歌曲。
3. 点击上一首和下一首按钮可以切换歌曲。
4. 右上角的播放模式按钮可以切换为顺序播放、单曲循环或随机播放。
5. 拖动播放进度条可以快速定位到指定时间。
6. 左侧歌词区域会随播放进度自动滚动并高亮当前歌词。
7. 点击任意一句歌词，可以直接跳转到该句对应的播放时间。
8. 页面下方的歌曲卡片可以切换当前歌曲，也可以直接播放或下载对应音频文件。

## 音频和歌词资源说明

项目默认从 `public/music/sunson/` 目录读取音频和歌词资源。

- 音频文件路径：`public/music/sunson/`
- 歌单配置文件：`src/data/sunsonTracks.ts`
- FLAC 元数据解析：`src/utils/flac.ts`

页面会自动尝试读取 FLAC 文件中的以下信息：

- 歌曲标题
- 歌手
- 专辑名
- 时长
- 封面图
- 内嵌歌词

如果目录中存在与歌曲同名的 `.lrc` 文件，页面也会自动加载并显示同步歌词。例如：

```text
public/music/sunson/周杰伦 - 太阳之子.flac
public/music/sunson/周杰伦 - 太阳之子.lrc
```

如果你想替换成自己的歌曲资源，需要同时处理这两部分：

1. 把音频文件和歌词文件放到 `public/music/sunson/`。
2. 按实际文件名修改 `src/data/sunsonTracks.ts` 中的 `fileName`、`title` 和 `note`。

## 项目特点

- 支持专辑封面和 FLAC 元数据自动读取
- 支持同步歌词高亮与滚动
- 支持点击歌词跳播
- 支持顺序播放、单曲循环、随机播放
- 支持歌曲下载
- 支持本地资源直出，部署简单

## 目录参考

```text
sunson/
├─ public/
│  └─ music/
│     └─ sunson/        # 音频与歌词资源
├─ src/
│  ├─ App.vue           # 主页面
│  ├─ style.css         # 全局样式
│  ├─ data/
│  │  └─ sunsonTracks.ts
│  └─ utils/
│     └─ flac.ts
├─ package.json
└─ README.md
```

## 常用命令

```bash
npm run dev
npm run build
npm run preview
```
