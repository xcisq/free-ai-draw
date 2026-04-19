import { Translations } from '../types';

const viTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'Kéo — H',
  'toolbar.selection': 'Chọn — V',
  'toolbar.mind': 'Mind Map — M',
  'toolbar.text': 'Văn bản — T',
  'toolbar.arrow': 'Mũi tên — A',
  'toolbar.shape': 'Hình dạng',
  'toolbar.image': 'Hình ảnh — Cmd+U',
  'toolbar.iconLibrary': 'Thư viện biểu tượng',
  'toolbar.extraTools': 'Công cụ mở rộng',

  'toolbar.pen': 'Bút vẽ — P',
  'toolbar.eraser': 'Tẩy — E',

  'toolbar.arrow.straight': 'Mũi tên thẳng',
  'toolbar.arrow.elbow': 'Mũi tên vuông góc',
  'toolbar.arrow.curve': 'Mũi tên cong',

  'toolbar.shape.rectangle': 'Hình chữ nhật — R',
  'toolbar.shape.ellipse': 'Hình elip — O',
  'toolbar.shape.triangle': 'Hình tam giác',
  'toolbar.shape.terminal': 'Terminal',
  'toolbar.shape.noteCurlyLeft': 'Ghi chú ngoặc móc trái',
  'toolbar.shape.noteCurlyRight': 'Ghi chú ngoặc móc phải',
  'toolbar.shape.diamond': 'Hình thoi',
  'toolbar.shape.parallelogram': 'Hình bình hành',
  'toolbar.shape.roundRectangle': 'Hình chữ nhật bo tròn',

  // Zoom controls
  'zoom.in': 'Phóng to — Cmd++',
  'zoom.out': 'Thu nhỏ — Cmd+-',
  'zoom.fit': 'Vừa màn hình',
  'zoom.100': 'Zoom 100%',

  // Themes
  'theme.default': 'Mặc định',
  'theme.colorful': 'Đầy màu sắc',
  'theme.soft': 'Nhẹ nhàng',
  'theme.retro': 'Cổ điển',
  'theme.dark': 'Tối',
  'theme.starry': 'Bầu trời sao',

  // Colors
  'color.none': 'Màu chủ đề',
  'color.unknown': 'Màu khác',
  'color.default': 'Đen cơ bản',
  'color.white': 'Trắng',
  'color.gray': 'Xám',
  'color.deepBlue': 'Xanh đậm',
  'color.red': 'Đỏ',
  'color.green': 'Xanh lá',
  'color.yellow': 'Vàng',
  'color.purple': 'Tím',
  'color.orange': 'Cam',
  'color.pastelPink': 'Hồng phấn',
  'color.cyan': 'Xanh lơ',
  'color.brown': 'Nâu',
  'color.forestGreen': 'Xanh rừng',
  'color.lightGray': 'Xám nhạt',

  // General
  'general.undo': 'Hoàn tác',
  'general.redo': 'Làm lại',
  'general.menu': 'Menu ứng dụng',
  'general.moreOptions': 'Tùy chọn khác',
  'general.duplicate': 'Nhân bản',
  'general.delete': 'Xóa',
  'general.layerOrder': 'Thứ tự lớp',
  'general.bringForward': 'Đưa lên một lớp',
  'general.sendBackward': 'Đưa xuống một lớp',
  'general.bringToFront': 'Đưa lên trên cùng',
  'general.sendToBack': 'Đưa xuống dưới cùng',
  'general.arrange': 'Sắp xếp',
  'general.alignToCanvas': 'Căn theo canvas',
  'general.alignToSelection': 'Căn theo vùng chọn',
  'general.alignLeft': 'Căn trái',
  'general.alignCenter': 'Căn giữa ngang',
  'general.alignRight': 'Căn phải',
  'general.alignTop': 'Căn trên',
  'general.alignMiddle': 'Căn giữa dọc',
  'general.alignBottom': 'Căn dưới',
  'general.distribute': 'Phân bố đều',
  'general.distributeHorizontally': 'Phân bố ngang',
  'general.distributeVertically': 'Phân bố dọc',

  // Language
  'language.switcher': 'Ngôn ngữ',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',

  // Menu items
  'menu.open': 'Mở',
  'menu.saveFile': 'Lưu tệp',
  'menu.exportImage': 'Xuất hình ảnh',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.cleanBoard': 'Xóa bảng',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid sang Drawnix',
  'dialog.mermaid.description': 'Hiện hỗ trợ',
  'dialog.mermaid.flowchart': 'lưu đồ',
  'dialog.mermaid.sequence': 'biểu đồ tuần tự',
  'dialog.mermaid.class': 'biểu đồ lớp',
  'dialog.mermaid.otherTypes':
    ', và các loại biểu đồ khác (hiển thị dưới dạng hình ảnh).',
  'dialog.mermaid.syntax': 'Cú pháp Mermaid',
  'dialog.mermaid.placeholder':
    'Viết định nghĩa biểu đồ Mermaid của bạn ở đây...',
  'dialog.mermaid.preview': 'Xem trước',
  'dialog.mermaid.insert': 'Chèn',
  'dialog.markdown.description':
    'Hỗ trợ tự động chuyển đổi cú pháp Markdown sang sơ đồ tư duy.',
  'dialog.markdown.syntax': 'Cú pháp Markdown',
  'dialog.markdown.placeholder': 'Viết nội dung Markdown của bạn ở đây...',
  'dialog.markdown.preview': 'Xem trước',
  'dialog.markdown.insert': 'Chèn',
  'dialog.svg.description':
    'Tải lên gói ZIP chứa SVG chính và thư mục `components/`. Drawnix sẽ ưu tiên ảnh thành phần `_nobg` và dựng lại văn bản, mũi tên cùng bố cục theo hệ tọa độ của SVG chính.',
  'dialog.svg.syntax': 'Thông tin gói ZIP',
  'dialog.svg.placeholder':
    'Sau khi chọn gói ZIP, tên SVG chính và số lượng thành phần sẽ hiển thị tại đây…',
  'dialog.svg.preview': 'Xem trước nhập',
  'dialog.svg.insert': 'Chèn',
  'dialog.svg.upload': 'Tải lên gói ZIP',
  'dialog.svg.error.invalidSvg': 'Nội dung SVG không hợp lệ',
  'dialog.svg.summary.texts': 'Văn bản',
  'dialog.svg.summary.arrows': 'Mũi tên kết nối',
  'dialog.svg.summary.components': 'Thành phần',
  'dialog.svg.summary.backgrounds': 'Nền đã bỏ qua',
  'dialog.autodraw.description':
    'Enter method text and upload a reference style image. Autodraw will call the backend, stream logs, and import the generated bundle into the canvas.',
  'dialog.autodraw.basicInfo': 'Basic Info',
  'dialog.autodraw.resources': 'Resources',
  'dialog.autodraw.chooseFile': 'Choose File',
  'dialog.autodraw.advancedSettings': 'Advanced Settings',
  'dialog.autodraw.noJob': 'No Job',
  'dialog.autodraw.filterLogs': 'Filter logs...',
  'dialog.autodraw.autoScroll': 'Auto-scroll',
  'dialog.autodraw.clearLogs': 'Clear Logs',
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
  'dialog.error.loadMermaid': 'Không thể tải thư viện Mermaid',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid sang Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown sang Drawnix',
  'extraTools.autodraw': 'Autodraw',

  // Clean confirm dialog
  'cleanConfirm.title': 'Xóa bảng',
  'cleanConfirm.description':
    'Thao tác này sẽ xóa toàn bộ bảng. Bạn có muốn tiếp tục không?',
  'cleanConfirm.cancel': 'Hủy',
  'cleanConfirm.ok': 'Đồng ý',

  // Link popup items
  'popupLink.delLink': 'Xóa liên kết',

  // Tool popup items
  'popupToolbar.fillColor': 'Màu tô',
  'popupToolbar.fontFamily': 'Phông chữ',
  'popupToolbar.fontSize': 'Cỡ chữ',
  'popupToolbar.fontColor': 'Màu chữ',
  'popupToolbar.link': 'Chèn liên kết',
  'popupToolbar.stroke': 'Đường viền',
  'popupToolbar.opacity': 'Độ trong suốt',

  // Icon library
  'iconLibrary.upload': 'Tải biểu tượng',
  'iconLibrary.uploading': 'Đang tải...',
  'iconLibrary.empty': 'Hãy tải SVG, PNG hoặc JPG để tạo thư viện biểu tượng.',
  'iconLibrary.hint':
    'Nhấp vào biểu tượng để chèn vào bảng. Nếu đang chọn một nút, nút đó sẽ được thay thế trực tiếp.',
  'iconLibrary.remove': 'Xóa biểu tượng',

  // Text placeholders
  'textPlaceholders.link': 'Liên kết',
  'textPlaceholders.text': 'Văn bản',

  // Line tool
  'line.source': 'Bắt đầu',
  'line.target': 'Kết thúc',
  'line.arrow': 'Mũi tên',
  'line.none': 'Không',
  'line.enableAnimation': 'Bật hieu ung chuyen dong',
  'line.disableAnimation': 'Tat hieu ung chuyen dong',

  // Stroke style
  'stroke.solid': 'Nét liền',
  'stroke.dashed': 'Nét đứt',
  'stroke.dotted': 'Nét chấm',

  //markdown example
  'markdown.example': `# Tôi đã bắt đầu

    - Hãy xem ai đã tạo ra lỗi này 🕵️ ♂️ 🔍
      - 😯 💣
        - Hóa ra là tôi 👈 🎯 💘

    - Bất ngờ thay, nó không chạy được; tại sao vậy 🚫 ⚙️ ❓
      - Bất ngờ thay, giờ nó chạy được rồi; tại sao vậy? 🎢 ✨
        - 🤯 ⚡ ➡️ 🎉

    - Cái gì chạy được 🐞 🚀
      - thì đừng chạm vào nó 🛑 ✋
        - 👾 💥 🏹 🎯

    ## Trai hay gái 👶 ❓ 🤷 ♂️ ♀️

    ### Xin chào thế giới 👋 🌍 ✨ 💻

    #### Wow, một lập trình viên 🤯 ⌨️ 💡 👩 💻`,

  // Draw elements text
  'draw.lineText': 'Văn bản',
  'draw.geometryText': 'Văn bản',

  // Mind map elements text
  'mind.centralText': 'Chủ đề trung tâm',
  'mind.abstractNodeText': 'Tóm tắt',

  'toolbar.llmMermaid': 'auto-mermaid',
  'dialog.llmMermaid.title': 'Trợ lý AI Pipeline',
  'dialog.llmMermaid.chat': 'Trò chuyện AI',
  'dialog.llmMermaid.preview': 'Xem trước',
  'dialog.llmMermaid.placeholder': 'Mô tả sơ đồ bạn muốn tạo...',
  'dialog.llmMermaid.insert': 'Chèn',
  'dialog.llmMermaid.close': 'Đóng',
  'dialog.close': 'Đóng',

  'tutorial.title': 'DPIT Draw MindMap',
  'tutorial.description':
    'Bảng trắng tất cả trong một, bao gồm sơ đồ tư duy, lưu đồ, vẽ tự do và hơn thế nữa',
  'tutorial.dataDescription':
    'Tất cả dữ liệu được lưu trữ cục bộ trong trình duyệt của bạn',
  'tutorial.appToolbar': 'Xuất, cài đặt ngôn ngữ, ...',
  'tutorial.creationToolbar': 'Chọn một công cụ để bắt đầu sáng tạo',
  'tutorial.themeDescription': 'Chuyển đổi giữa chế độ sáng và tối',
};

export default viTranslations;
