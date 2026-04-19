import { Translations } from '../types';

const enTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'Hand — H',
  'toolbar.selection': 'Selection — V',
  'toolbar.mind': 'Mind — M',
  'toolbar.text': 'Text — T',
  'toolbar.arrow': 'Arrow — A',
  'toolbar.shape': 'Shape',
  'toolbar.image': 'Image — Cmd+U',
  'toolbar.iconLibrary': 'Icon Library',
  'toolbar.extraTools': 'Extra Tools',

  'toolbar.pen': 'Pen — P',
  'toolbar.eraser': 'Eraser — E',

  'toolbar.arrow.straight': 'Straight Arrow Line',
  'toolbar.arrow.elbow': 'Elbow Arrow Line',
  'toolbar.arrow.curve': 'Curve Arrow Line',

  'toolbar.shape.rectangle': 'Rectangle — R',
  'toolbar.shape.ellipse': 'Ellipse — O',
  'toolbar.shape.triangle': 'Triangle',
  'toolbar.shape.terminal': 'Terminal',
  'toolbar.shape.noteCurlyLeft': 'Curly Note — Left',
  'toolbar.shape.noteCurlyRight': 'Curly Note — Right',
  'toolbar.shape.diamond': 'Diamond',
  'toolbar.shape.parallelogram': 'Parallelogram',
  'toolbar.shape.roundRectangle': 'Round Rectangle',

  // Zoom controls
  'zoom.in': 'Zoom In — Cmd++',
  'zoom.out': 'Zoom Out — Cmd+-',
  'zoom.fit': 'Fit to Screen',
  'zoom.100': 'Zoom to 100%',

  // Themes
  'theme.default': 'Default',
  'theme.colorful': 'Colorful',
  'theme.soft': 'Soft',
  'theme.retro': 'Retro',
  'theme.dark': 'Dark',
  'theme.starry': 'Starry',

  // Colors
  'color.none': 'Topic Color',
  'color.unknown': 'Other Color',
  'color.default': 'Basic Black',
  'color.white': 'White',
  'color.gray': 'Grey',
  'color.deepBlue': 'Deep Blue',
  'color.red': 'Red',
  'color.green': 'Green',
  'color.yellow': 'Yellow',
  'color.purple': 'Purple',
  'color.orange': 'Orange',
  'color.pastelPink': 'Paster Pink',
  'color.cyan': 'Cyan',
  'color.brown': 'Brown',
  'color.forestGreen': 'Forest Green',
  'color.lightGray': 'Light Grey',

  // General
  'general.undo': 'Undo',
  'general.redo': 'Redo',
  'general.menu': 'App Menu',
  'general.moreOptions': 'More Options',
  'general.duplicate': 'Duplicate',
  'general.delete': 'Delete',
  'general.layerOrder': 'Layer Order',
  'general.bringForward': 'Bring Forward',
  'general.sendBackward': 'Send Backward',
  'general.bringToFront': 'Bring to Front',
  'general.sendToBack': 'Send to Back',
  'general.arrange': 'Arrange',
  'general.alignToCanvas': 'Align to Canvas',
  'general.alignToSelection': 'Align to Selection',
  'general.alignLeft': 'Align Left',
  'general.alignCenter': 'Align Center',
  'general.alignRight': 'Align Right',
  'general.alignTop': 'Align Top',
  'general.alignMiddle': 'Align Middle',
  'general.alignBottom': 'Align Bottom',
  'general.distribute': 'Distribute',
  'general.distributeHorizontally': 'Distribute Horizontally',
  'general.distributeVertically': 'Distribute Vertically',

  // Language
  'language.switcher': 'Language',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',
  // Menu items
  'menu.open': 'Open',
  'menu.saveFile': 'Save File',
  'menu.exportImage': 'Export Image',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.cleanBoard': 'Clear Board',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid to Drawnix',
  'dialog.mermaid.description': 'Currently supports',
  'dialog.mermaid.flowchart': 'flowcharts',
  'dialog.mermaid.sequence': 'sequence diagrams',
  'dialog.mermaid.class': 'class diagrams',
  'dialog.mermaid.otherTypes':
    ', and other diagram types (rendered as images).',
  'dialog.mermaid.syntax': 'Mermaid Syntax',
  'dialog.mermaid.placeholder': 'Write your Mermaid chart definition here…',
  'dialog.mermaid.preview': 'Preview',
  'dialog.mermaid.insert': 'Insert',
  'dialog.markdown.description':
    'Supports automatic conversion of Markdown syntax to mind map.',
  'dialog.markdown.syntax': 'Markdown Syntax',
  'dialog.markdown.placeholder': 'Write your Markdown text definition here...',
  'dialog.markdown.preview': 'Preview',
  'dialog.markdown.insert': 'Insert',
  'dialog.svg.description':
    'Upload a ZIP asset package that contains the main SVG and a `components/` directory. Drawnix will prefer `_nobg` component images and rebuild texts, arrows, and components using the main SVG coordinate system.',
  'dialog.svg.syntax': 'ZIP Package Info',
  'dialog.svg.placeholder':
    'After selecting a ZIP package, the main SVG name and component count will appear here…',
  'dialog.svg.preview': 'Import Preview',
  'dialog.svg.insert': 'Insert',
  'dialog.svg.upload': 'Upload ZIP Package',
  'dialog.svg.error.invalidSvg': 'Invalid SVG content',
  'dialog.svg.summary.texts': 'Texts',
  'dialog.svg.summary.arrows': 'Connector arrows',
  'dialog.svg.summary.components': 'Components',
  'dialog.svg.summary.backgrounds': 'Ignored backgrounds',
  'dialog.autodraw.basicInfo': 'Basic Info',
  'dialog.autodraw.resources': 'Resources',
  'dialog.autodraw.chooseFile': 'Choose File',
  'dialog.autodraw.advancedSettings': 'Advanced Settings',
  'dialog.autodraw.noJob': 'No Job',
  'dialog.autodraw.filterLogs': 'Filter logs...',
  'dialog.autodraw.autoScroll': 'Auto-scroll',
  'dialog.autodraw.clearLogs': 'Clear Logs',
  'dialog.autodraw.description':
    'Enter method text and upload a reference style image. Autodraw will call the backend, stream logs, and import the generated bundle into the canvas.',
  'dialog.autodraw.backendUrl': 'Backend URL',
  'dialog.autodraw.methodText': 'Method Text',
  'dialog.autodraw.placeholder': 'Describe the method you want to visualize...',
  'dialog.autodraw.referenceImage': 'Reference Style Image',
  'dialog.autodraw.uploadZip': 'Import Local ZIP',
  'dialog.autodraw.bundleHint':
    'Upload a local bundle.zip to render it directly into the canvas without creating a backend job.',
  'dialog.autodraw.existingJobId': 'Existing Job ID',
  'dialog.autodraw.existingJobPlaceholder':
    'Enter any job_id and load its flow',
  'dialog.autodraw.loadJob': 'Load Job',
  'dialog.autodraw.provider': 'Provider',
  'dialog.autodraw.apiKey': 'API Key',
  'dialog.autodraw.baseUrl': 'Base URL',
  'dialog.autodraw.imageModel': 'Image Model',
  'dialog.autodraw.svgModel': 'SVG Model',
  'dialog.autodraw.generate': 'Generate',
  'dialog.autodraw.resume': 'Resume',
  'dialog.autodraw.copyJobId': 'Copy ID',
  'dialog.autodraw.copied': 'Copied',
  'dialog.autodraw.viewFlow': 'View Flow',
  'dialog.autodraw.hideWorkbench': 'Minimize',
  'dialog.autodraw.referenceGallery': 'Reference Gallery',
  'dialog.autodraw.galleryChooseFolder': 'Choose Gallery Folder',
  'dialog.autodraw.galleryRefresh': 'Refresh Gallery',
  'dialog.autodraw.galleryDisconnect': 'Disconnect Gallery',
  'dialog.autodraw.galleryDirectoryReady': 'Gallery Connected',
  'dialog.autodraw.galleryHint':
    'Choose a local folder as the style gallery. Each file name becomes the visible style name.',
  'dialog.autodraw.galleryLive': 'Persistent Gallery',
  'dialog.autodraw.galleryEmpty':
    'No usable images in the gallery yet. Supported: png, jpg, jpeg, webp.',
  'dialog.autodraw.galleryLoading': 'Loading gallery...',
  'dialog.autodraw.galleryUnsupported':
    'This browser cannot read a local gallery folder. Use Chromium or the temporary upload below.',
  'dialog.autodraw.galleryPermissionHint':
    'Gallery permission is missing. Reconnect or refresh the selected folder.',
  'dialog.autodraw.galleryLoadFailed': 'Failed to load gallery',
  'dialog.autodraw.galleryMissingSelection':
    'The previously selected reference is no longer in the gallery.',
  'dialog.autodraw.manualReference': 'Temporary Upload',
  'dialog.autodraw.manualReferenceHint':
    'Temporary uploads only last for the current session. Put reusable references into the gallery above.',
  'dialog.autodraw.selectedStyle': 'Current Reference Style',
  'dialog.autodraw.assetRoom': 'Asset Room',
  'dialog.autodraw.assetHint':
    'Generated figures, icons, and SVGs appear here as they are produced. Click any visual asset to enlarge it.',
  'dialog.autodraw.assetHintLive':
    'Only previewable visual assets are shown here, and the shelf updates live with pipeline progress.',
  'dialog.autodraw.noAssets':
    'Assets will appear here once the pipeline starts producing them.',
  'dialog.autodraw.openPreview': 'Open Preview',
  'dialog.autodraw.timeline': 'Timeline',
  'dialog.autodraw.rawLogs': 'Raw Logs',
  'dialog.autodraw.history': 'History',
  'dialog.autodraw.noHistory': 'No history yet',
  'dialog.autodraw.clearHistory': 'Clear History',
  'dialog.autodraw.importMonitor': 'Import Monitor',
  'dialog.autodraw.returnWorkbench': 'Expand Workbench',
  'dialog.autodraw.importWatchingHint':
    'The workbench docks itself while importing so you can watch the actual assembly on the canvas.',
  'dialog.autodraw.historyJob': 'Generated Job',
  'dialog.autodraw.historyLocal': 'Local ZIP',
  'dialog.autodraw.statusLabel': 'Status',
  'dialog.autodraw.jobId': 'Job ID',
  'dialog.autodraw.failedStage': 'Failed Stage',
  'dialog.autodraw.logMode': 'Log Mode',
  'dialog.autodraw.emptyLogs': 'No logs yet',
  'dialog.autodraw.summary.texts': 'Texts',
  'dialog.autodraw.summary.arrows': 'Arrows',
  'dialog.autodraw.summary.components': 'Components',
  'dialog.autodraw.workbench': 'Pipeline Workbench',
  'dialog.autodraw.activity': 'Live Activity',
  'dialog.autodraw.latestImport': 'Canvas Assembly',
  'dialog.autodraw.readyHint':
    'Describe the method and add a reference image to watch the pipeline assemble here step by step.',
  'dialog.autodraw.runningStageHint':
    'The board favors assets from the active stage. If that stage has no visual file yet, only progress stays visible here.',
  'dialog.autodraw.referenceHint':
    'Use a paper figure with a close visual rhythm to stabilize typography and layout.',
  'dialog.autodraw.stage.generateFigure': 'Generate Figure',
  'dialog.autodraw.stage.parseStructure': 'Parse Structure',
  'dialog.autodraw.stage.extractAssets': 'Extract Assets',
  'dialog.autodraw.stage.rebuildSvg': 'Rebuild SVG',
  'dialog.autodraw.stage.importCanvas': 'Import to Canvas',
  'dialog.autodraw.status.idle': 'Ready',
  'dialog.autodraw.status.queued': 'Queued',
  'dialog.autodraw.status.running': 'Running',
  'dialog.autodraw.status.submitting': 'Submitting',
  'dialog.autodraw.status.importing': 'Importing',
  'dialog.autodraw.status.succeeded': 'Succeeded',
  'dialog.autodraw.status.failed': 'Failed',
  'dialog.autodraw.error.noMethodText': 'Please enter method text first',
  'dialog.autodraw.error.submitFailed': 'Failed to submit job',
  'dialog.autodraw.error.jobFailed': 'Job failed',
  'dialog.autodraw.error.noBundle': 'Job succeeded but no bundle was returned',
  'dialog.autodraw.error.logFailed': 'Failed to fetch logs',
  'dialog.error.loadMermaid': 'Failed to load Mermaid library',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid to Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown to Drawnix',
  'extraTools.autodraw': 'Autodraw',

  // Clean confirm dialog
  'cleanConfirm.title': 'Clear Board',
  'cleanConfirm.description':
    'This will clear the entire board. Do you want to continue?',
  'cleanConfirm.cancel': 'Cancel',
  'cleanConfirm.ok': 'OK',

  // Link popup items
  'popupLink.delLink': 'Delete Link',

  // Tool popup items
  'popupToolbar.fillColor': 'Fill Color',
  'popupToolbar.fontFamily': 'Font',
  'popupToolbar.fontSize': 'Font Size',
  'popupToolbar.fontColor': 'Font Color',
  'popupToolbar.link': 'Insert Link',
  'popupToolbar.stroke': 'Stroke',
  'popupToolbar.opacity': 'Opacity',

  // Icon library
  'iconLibrary.upload': 'Upload Icons',
  'iconLibrary.uploading': 'Uploading...',
  'iconLibrary.empty': 'Upload SVG, PNG, or JPG icon assets to get started.',
  'iconLibrary.hint':
    'Click an icon to insert it onto the board. If a node is selected, it will be replaced directly.',
  'iconLibrary.remove': 'Remove icon',

  // Text placeholders
  'textPlaceholders.link': 'Link',
  'textPlaceholders.text': 'Text',

  // Line tool
  'line.source': 'Start',
  'line.target': 'End',
  'line.arrow': 'Arrow',
  'line.none': 'None',

  // Stroke style
  'stroke.solid': 'Solid',
  'stroke.dashed': 'Dashed',
  'stroke.dotted': 'Dotted',

  //markdown example
  'markdown.example': `# I have started

  - Let me see who made this bug 🕵️ ♂️ 🔍
    - 😯 💣
      - Turns out it was me 👈 🎯 💘

  - Unexpectedly, it cannot run; why is that 🚫 ⚙️ ❓
    - Unexpectedly, it can run now; why is that? 🎢 ✨
      - 🤯 ⚡ ➡️ 🎉

  - What can run 🐞 🚀
    - then do not touch it 🛑 ✋
      - 👾 💥 🏹 🎯

  ## Boy or girl 👶 ❓ 🤷 ♂️ ♀️

  ### Hello world 👋 🌍 ✨ 💻

  #### Wow, a programmer 🤯 ⌨️ 💡 👩 💻`,

  // Draw elements text
  'draw.lineText': 'Text',
  'draw.geometryText': 'Text',

  // Mind map elements text
  'mind.centralText': 'Central Topic',
  'mind.abstractNodeText': 'Summary',

  'toolbar.llmMermaid': 'auto-mermaid',
  'dialog.llmMermaid.title': 'AI Pipeline Assistant',
  'dialog.llmMermaid.chat': 'Chat',
  'dialog.llmMermaid.preview': 'Preview',
  'dialog.llmMermaid.placeholder':
    'Describe the flowchart you want to generate...',
  'dialog.llmMermaid.insert': 'Insert',
  'dialog.llmMermaid.close': 'Close',

  'dialog.close': 'Close',

  'tutorial.title': 'Drawnix',
  'tutorial.description':
    'All-in-one whiteboard, including mind maps, flowcharts, free drawing, and more',
  'tutorial.dataDescription': 'All data is stored locally in your browser',
  'tutorial.appToolbar': 'Export, language settings, ...',
  'tutorial.creationToolbar': 'Select a tool to start your creation',
  'tutorial.themeDescription': 'Switch between light and dark themes',
};

export default enTranslations;
