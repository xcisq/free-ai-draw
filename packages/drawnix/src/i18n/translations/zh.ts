import { Translations } from '../types';

const zhTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': '手形工具 — H',
  'toolbar.selection': '选择 — V',
  'toolbar.mind': '思维导图 — M',
  'toolbar.text': '文本 — T',
  'toolbar.arrow': '箭头 — A',
  'toolbar.shape': '形状',
  'toolbar.image': '图片 — Cmd+U',
  'toolbar.iconLibrary': '图标库',
  'toolbar.extraTools': '更多工具',

  'toolbar.pen': '画笔 — P',
  'toolbar.eraser': '橡皮擦 — E',

  'toolbar.arrow.straight': '直线',
  'toolbar.arrow.elbow': '肘线',
  'toolbar.arrow.curve': '曲线',

  'toolbar.shape.rectangle': '长方形 — R',
  'toolbar.shape.ellipse': '圆 — O',
  'toolbar.shape.triangle': '三角形',
  'toolbar.shape.terminal': '椭圆角矩形',
  'toolbar.shape.noteCurlyLeft': '左花括注释',
  'toolbar.shape.noteCurlyRight': '右花括注释',
  'toolbar.shape.diamond': '菱形',
  'toolbar.shape.parallelogram': '平行四边形',
  'toolbar.shape.roundRectangle': '圆角矩形',

  // Zoom controls
  'zoom.in': '放大 — Cmd++',
  'zoom.out': '缩小 — Cmd+-',
  'zoom.fit': '自适应',
  'zoom.100': '缩放至 100%',

  // Themes
  'theme.default': '默认',
  'theme.colorful': '缤纷',
  'theme.soft': '柔和',
  'theme.retro': '复古',
  'theme.dark': '暗夜',
  'theme.starry': '星空',

  // Colors
  'color.none': '主题颜色',
  'color.unknown': '其他颜色',
  'color.default': '黑色',
  'color.white': '白色',
  'color.gray': '灰色',
  'color.deepBlue': '深蓝色',
  'color.red': '红色',
  'color.green': '绿色',
  'color.yellow': '黄色',
  'color.purple': '紫色',
  'color.orange': '橙色',
  'color.pastelPink': '淡粉色',
  'color.cyan': '青色',
  'color.brown': '棕色',
  'color.forestGreen': '森绿色',
  'color.lightGray': '浅灰色',

  // General
  'general.undo': '撤销',
  'general.redo': '重做',
  'general.menu': '应用菜单',
  'general.moreOptions': '更多选项',
  'general.duplicate': '复制',
  'general.delete': '删除',
  'general.layerOrder': '层级',
  'general.bringForward': '上移一层',
  'general.sendBackward': '下移一层',
  'general.bringToFront': '置顶',
  'general.sendToBack': '置底',
  'general.arrange': '排列',
  'general.alignToCanvas': '对齐到画布',
  'general.alignToSelection': '对齐到选区',
  'general.alignLeft': '左对齐',
  'general.alignCenter': '水平居中',
  'general.alignRight': '右对齐',
  'general.alignTop': '顶部对齐',
  'general.alignMiddle': '垂直居中',
  'general.alignBottom': '底部对齐',
  'general.distribute': '等间距分布',
  'general.distributeHorizontally': '水平分布',
  'general.distributeVertically': '垂直分布',

  // Language
  'language.switcher': 'Language',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',
  // Menu items
  'menu.open': '打开',
  'menu.saveFile': '保存文件',
  'menu.exportImage': '导出图片',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.cleanBoard': '清除画布',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid 转 Drawnix',
  'dialog.mermaid.description': '目前仅支持',
  'dialog.mermaid.flowchart': '流程图',
  'dialog.mermaid.sequence': '序列图',
  'dialog.mermaid.class': '类图',
  'dialog.mermaid.otherTypes': '。其他类型在 Drawnix 中将以图片呈现。',
  'dialog.mermaid.syntax': 'Mermaid 语法',
  'dialog.mermaid.placeholder': '在此处编写 Mermaid 图表定义…',
  'dialog.mermaid.preview': '预览',
  'dialog.mermaid.insert': '插入',
  'dialog.markdown.description': '支持 Markdown 语法自动转换为思维导图。',
  'dialog.markdown.syntax': 'Markdown 语法',
  'dialog.markdown.placeholder': '在此处编写 Markdown 文本定义…',
  'dialog.markdown.preview': '预览',
  'dialog.markdown.insert': '插入',
  'dialog.svg.description':
    '上传 ZIP 资源包。资源包需包含总 SVG 与 `components/` 目录；Drawnix 会优先使用 `_nobg` 组件图，并按总 SVG 坐标重建文本、箭头与组件布局。',
  'dialog.svg.syntax': 'ZIP 资源信息',
  'dialog.svg.placeholder': '选择 ZIP 资源包后，将在此显示总 SVG 与组件数量…',
  'dialog.svg.preview': '导入预览',
  'dialog.svg.insert': '插入',
  'dialog.svg.upload': '上传 ZIP 包',
  'dialog.svg.error.invalidSvg': 'SVG 内容无效，无法解析',
  'dialog.svg.summary.texts': '文本',
  'dialog.svg.summary.arrows': '连接箭头',
  'dialog.svg.summary.components': '组件图',
  'dialog.svg.summary.backgrounds': '忽略背景',
  'dialog.autodraw.basicInfo': '基础信息',
  'dialog.autodraw.resources': '资源文件',
  'dialog.autodraw.chooseFile': '选择文件',
  'dialog.autodraw.advancedSettings': '高级设置',
  'dialog.autodraw.noJob': '暂无任务',
  'dialog.autodraw.filterLogs': '过滤日志...',
  'dialog.autodraw.autoScroll': '自动滚动',
  'dialog.autodraw.clearLogs': '清除日志',
  'dialog.autodraw.description':
    '输入方法描述文本，上传参考风格图片，Autodraw 将调用后端生成图示并在成功后自动导入画板。',
  'dialog.autodraw.backendUrl': '后端地址',
  'dialog.autodraw.methodText': '方法描述',
  'dialog.autodraw.placeholder': '请输入需要生成图示的方法描述...',
  'dialog.autodraw.referenceImage': '参考风格图片',
  'dialog.autodraw.uploadZip': '直接导入本地 ZIP',
  'dialog.autodraw.bundleHint':
    '上传本地 bundle.zip 后可直接在前端导入画板，不需要先创建后端任务。',
  'dialog.autodraw.existingJobId': '已有任务 ID',
  'dialog.autodraw.existingJobPlaceholder': '输入任意 job_id 后查看对应流程',
  'dialog.autodraw.loadJob': '加载任务',
  'dialog.autodraw.provider': 'Provider',
  'dialog.autodraw.apiKey': 'API Key',
  'dialog.autodraw.baseUrl': 'Base URL',
  'dialog.autodraw.imageModel': 'Image Model',
  'dialog.autodraw.svgModel': 'SVG Model',
  'dialog.autodraw.generate': '开始生成',
  'dialog.autodraw.resume': '继续执行',
  'dialog.autodraw.copyJobId': '复制 ID',
  'dialog.autodraw.copied': '已复制',
  'dialog.autodraw.viewFlow': '查看流程',
  'dialog.autodraw.hideWorkbench': '临时收起',
  'dialog.autodraw.referenceGallery': '参考图库',
  'dialog.autodraw.galleryChooseFolder': '选择图库文件夹',
  'dialog.autodraw.galleryRefresh': '刷新图库',
  'dialog.autodraw.galleryDisconnect': '断开图库',
  'dialog.autodraw.galleryDirectoryReady': '已连接图库',
  'dialog.autodraw.galleryHint':
    '选择一个本地文件夹作为风格图库，文件名会直接作为前端风格名称。',
  'dialog.autodraw.galleryLive': '持久化图库',
  'dialog.autodraw.galleryEmpty':
    '图库里还没有可用图片。支持 png、jpg、jpeg、webp。',
  'dialog.autodraw.galleryLoading': '正在读取图库...',
  'dialog.autodraw.galleryUnsupported':
    '当前浏览器不支持本地图库文件夹，请改用 Chromium 浏览器或下方临时上传。',
  'dialog.autodraw.galleryPermissionHint':
    '图库权限暂未授予，请重新选择或刷新该文件夹。',
  'dialog.autodraw.galleryLoadFailed': '图库读取失败',
  'dialog.autodraw.galleryMissingSelection':
    '上次选择的参考图已不在图库中，请重新选择。',
  'dialog.autodraw.manualReference': '临时上传',
  'dialog.autodraw.manualReferenceHint':
    '临时上传只在当前会话使用；想长期复用请放入上方图库。',
  'dialog.autodraw.selectedStyle': '当前参考风格',
  'dialog.autodraw.assetRoom': '资产室',
  'dialog.autodraw.assetHint':
    '生成中的图片、图标和 SVG 会在这里逐步亮起，可点击放大预览。',
  'dialog.autodraw.assetHintLive':
    '这里只展示可预览视觉资产，并会随着任务推进实时刷新。',
  'dialog.autodraw.noAssets': '生成资产后会在这里出现。',
  'dialog.autodraw.openPreview': '打开预览',
  'dialog.autodraw.timeline': '时间线',
  'dialog.autodraw.rawLogs': '原始日志',
  'dialog.autodraw.history': '历史记录',
  'dialog.autodraw.noHistory': '还没有历史记录',
  'dialog.autodraw.clearHistory': '清空历史',
  'dialog.autodraw.importMonitor': '导入监视器',
  'dialog.autodraw.returnWorkbench': '展开工作台',
  'dialog.autodraw.importWatchingHint':
    '导入画板时工作台会收边停靠，方便直接观察画板上的真实落板过程。',
  'dialog.autodraw.historyJob': '生成任务',
  'dialog.autodraw.historyLocal': '本地 ZIP',
  'dialog.autodraw.statusLabel': '状态',
  'dialog.autodraw.jobId': '任务 ID',
  'dialog.autodraw.failedStage': '失败阶段',
  'dialog.autodraw.logMode': '日志模式',
  'dialog.autodraw.emptyLogs': '暂无日志输出',
  'dialog.autodraw.summary.texts': '文本',
  'dialog.autodraw.summary.arrows': '箭头',
  'dialog.autodraw.summary.components': '组件',
  'dialog.autodraw.workbench': '实验室工作台',
  'dialog.autodraw.activity': '过程活动',
  'dialog.autodraw.latestImport': '落板预览',
  'dialog.autodraw.readyHint':
    '输入方法描述并上传参考图后，工作台会在这里逐步搭建你的 pipeline。',
  'dialog.autodraw.runningStageHint':
    '当前阶段会优先展示对应产物；若该阶段还没生成可视文件，这里只保留推进状态。',
  'dialog.autodraw.referenceHint':
    '建议上传版式风格接近的论文图，帮助字体和布局更稳定。',
  'dialog.autodraw.stage.generateFigure': '生成原始图',
  'dialog.autodraw.stage.parseStructure': '解析结构',
  'dialog.autodraw.stage.extractAssets': '提取图标',
  'dialog.autodraw.stage.rebuildSvg': '重建 SVG',
  'dialog.autodraw.stage.importCanvas': '导入画板',
  'dialog.autodraw.status.idle': '待开始',
  'dialog.autodraw.status.queued': '排队中',
  'dialog.autodraw.status.running': '执行中',
  'dialog.autodraw.status.submitting': '提交中',
  'dialog.autodraw.status.importing': '导入中',
  'dialog.autodraw.status.succeeded': '已完成',
  'dialog.autodraw.status.failed': '失败',
  'dialog.autodraw.error.noMethodText': '请先输入方法描述',
  'dialog.autodraw.error.submitFailed': '任务提交失败',
  'dialog.autodraw.error.jobFailed': '任务执行失败',
  'dialog.autodraw.error.noBundle': '任务完成但未返回 bundle',
  'dialog.autodraw.error.logFailed': '日志获取失败',
  'dialog.error.loadMermaid': '加载 Mermaid 库失败',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid 到 Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown 到 Drawnix',
  'extraTools.autodraw': 'Autodraw',

  // Clean confirm dialog
  'cleanConfirm.title': '清除画布',
  'cleanConfirm.description': '这将会清除整个画布。你是否要继续?',
  'cleanConfirm.cancel': '取消',
  'cleanConfirm.ok': '确认',

  // Link popup items
  'popupLink.delLink': '移除连结',

  // Tool popup items
  'popupToolbar.fillColor': '填充颜色',
  'popupToolbar.fontFamily': '字体',
  'popupToolbar.fontSize': '字号',
  'popupToolbar.fontColor': '字体颜色',
  'popupToolbar.link': '链接',
  'popupToolbar.stroke': '边框',
  'popupToolbar.opacity': '不透明度',

  // Icon library
  'iconLibrary.upload': '上传图标',
  'iconLibrary.uploading': '上传中...',
  'iconLibrary.empty': '先上传一些 SVG、PNG 或 JPG 图标素材吧。',
  'iconLibrary.hint':
    '点击图标可插入到画板；如果当前已选中节点，则会直接替换为该图标。',
  'iconLibrary.remove': '删除图标',

  // Text placeholders
  'textPlaceholders.link': '链接',
  'textPlaceholders.text': '文本',

  // Line tool
  'line.source': '起点',
  'line.target': '终点',
  'line.arrow': '箭头',
  'line.none': '无',

  // Stroke style
  'stroke.solid': '实线',
  'stroke.dashed': '虚线',
  'stroke.dotted': '点线',

  // Draw elements text
  'draw.lineText': '文本',
  'draw.geometryText': '文本',

  // Mind map elements text
  'mind.centralText': '中心主题',
  'mind.abstractNodeText': '摘要',

  //markdown example
  'markdown.example': `# 我开始了

  - 让我看看是谁搞出了这个 bug 🕵️ ♂️ 🔍
    - 😯 💣
      - 原来是我 👈 🎯 💘

  - 竟然不可以运行，为什么呢 🚫 ⚙️ ❓
    - 竟然可以运行了，为什么呢？🎢 ✨
      - 🤯 ⚡ ➡️ 🎉

  - 能运行起来的 🐞 🚀
    - 就不要去动它 🛑 ✋
      - 👾 💥 🏹 🎯

  ## 男孩还是女孩 👶 ❓ 🤷 ♂️ ♀️

  ### Hello world 👋 🌍 ✨ 💻

  #### 哇 是个程序员 🤯 ⌨️ 💡 👩 💻`,

  // LLM Mermaid
  'toolbar.llmMermaid': 'auto-mermaid',
  'dialog.llmMermaid.title': 'AI Pipeline 助手',
  'dialog.llmMermaid.chat': 'AI 对话',
  'dialog.llmMermaid.preview': '预览',
  'dialog.llmMermaid.placeholder': '描述你想生成的流程图...',
  'dialog.llmMermaid.insert': '插入',
  'dialog.llmMermaid.close': '关闭',

  'dialog.close': '关闭',

  'tutorial.title': 'XAI Board',
  'tutorial.description': 'XAI 课题组专用绘图工具',
  'tutorial.dataDescription':
    '支持思维导图、流程图等多种绘图方式，数据本地存储，安全可靠。',
  'tutorial.appToolbar': '导出，语言设置，...',
  'tutorial.creationToolbar': '选择一个工具开始你的创作',
  'tutorial.themeDescription': '在明亮和黑暗主题之间切换',
};

export default zhTranslations;
