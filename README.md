<p align="center">
  <img src="./apps/web/public/logo/xai.svg" width="72" alt="XAI logo" />
</p>
<p align="center">
  <strong>XAI Board</strong>
  <br />
  <span>based on Drawnix</span>
</p>
<p align="center">
  <picture style="width: 320px">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h.svg?raw=true" />
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h_dark.svg?raw=true" />
    <img src="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h.svg?raw=true" width="360" alt="Drawnix logo and name" />
  </picture>
</p>
<div align="center">
  <h2>
    基于 Drawnix 二次开发的智能绘图工作台
  <br />
  </h2>
</div>

<div align="center">
  <figure>
    <a target="_blank" rel="noopener">
      <img src="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/product_showcase/case-2.png" alt="Product showcase" width="80%" />
    </a>
    <figcaption>
      <p align="center">
        All in one 白板，思维导图、流程图、自由画等
      </p>
    </figcaption>
  </figure>
</div>

## 项目定位

当前项目基于 *Drawnix* 进行二次开发，面向课题组和研究场景，定位为一套本地优先的智能绘图工作台。

它保留了 Drawnix 的白板能力和插件架构，在这个基础上扩展了 AutoDraw、PaperDraw、可编辑导入等能力，重点解决从文本、图片和结构化资产到可编辑画布的转换问题。

## 当前功能

- 一体化白板：支持自由画、流程图、思维导图等常见绘图方式
- 基础编辑能力：支持撤销、重做、复制、粘贴、缩放、滚动和无限画布
- Mermaid / Markdown 转图：支持 Mermaid 生成流程图，支持 Markdown 文本生成思维导图
- AutoDraw 流程：支持文本输入后进入文生图、分割、去背景、SVG 矢量化，再导入画板继续编辑
- 可编辑导入：支持将生成结果或资产包导入为 Drawnix 场景，保留后续编辑能力
- 本地任务链路：仓库内包含独立后端目录，用于提交任务、轮询状态、下载 `bundle.zip` 等产物

## 项目说明

目前仓库里的前端落地页和产品能力，已经不是原始 Drawnix 的直接展示，而是基于 Drawnix 底座演进出的项目版本。

当前重点包括：

- 白板基础能力与多种绘图模式
- AutoDraw 智能生成与导入链路
- 面向论文和流程图场景的 PaperDraw 能力演进
- `scene-import` 与 `svg-import` 两条可编辑导入链路

当前版本以本地开发和场景验证为主，不以线上部署为目标。


## 仓储结构

```
drawnix/
├── apps/
│   ├── web                   # Web 应用
│   │    └── index.html       # HTML
├── autodraw/                 # AutoDraw 后端与任务流水线
├── dist/                     # 构建产物
├── packages/
│   ├── drawnix/              # 白板应用与导入能力
│   ├── react-board/          # 白板 React 视图层
│   └── react-text/           # 文本渲染模块
├── package.json
├── ...
└── README.md

```


## 开发

```
npm install

npm run start
```

## Docker

```
docker pull pubuzhixing/drawnix:latest
```

## 依赖

- [plait](https://github.com/worktile/plait) - 开源画图框架
- [slate](https://github.com/ianstormtaylor/slate) - 富文本编辑器框架
- [floating-ui](https://github.com/floating-ui/floating-ui) - 弹出层基础库



## 贡献

欢迎任何形式的贡献：

- 提 Bug

- 贡献代码

## 感谢支持

感谢公司对本项目的持续支持。

<p align="left">
  <a href="https://pingcode.com?utm_source=drawnix" target="_blank">
      <img src="https://cdn-aliyun.pingcode.com/static/site/img/pingcode-logo.4267e7b.svg" width="120" alt="PingCode" />
  </a>
</p>

## License

[MIT License](https://github.com/plait-board/drawnix/blob/master/LICENSE)  
